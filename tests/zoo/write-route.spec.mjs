import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { startZoo } from './support.mjs';

test('packaged auto readiness gate preserves page state and Never-Save for every status', async ({}, testInfo) => {
  const zoo = await startZoo('write-route');
  try {
    const bridge = await zoo.page.context().newPage();
    await bridge.goto(new URL('/manifest.json', zoo.worker.url()).href);
    await zoo.page.bringToFront();
    const results = [];
    for (const status of ['ready', 'login_required', 'form_not_ready', 'manual']) {
      await zoo.page.evaluate(status => {
        document.querySelector('#readiness-state')?.remove();
        document.querySelector('form').removeAttribute('aria-busy');
        const state = document.createElement('section'); state.id = 'readiness-state';
        if (status === 'login_required') state.innerHTML = '<h2 role="alert">Please sign in to continue</h2>';
        if (status === 'form_not_ready') document.querySelector('form').setAttribute('aria-busy', 'true');
        if (status === 'manual') state.innerHTML = '<div data-captcha>Offline challenge</div>';
        document.body.append(state);
      }, status);
      const before = await zoo.readback(), markup = await zoo.page.content();
      const result = await bridge.evaluate(async tabId => {
        const gate = await import(chrome.runtime.getURL('src/background/auto-form-readiness.mjs'));
        try { return await gate.requireAutoFormReady(chrome, tabId); }
        catch (error) { return { reason: error.message, ...gate.autoFormReadinessFailure(error) }; }
      }, zoo.tabId);
      expect(result, JSON.stringify(result)).toMatchObject({ status,
        writeStarted: false, writeAttempted: false, saveAttempted: false, liveSupportClaimed: false });
      expect(result.reason).toBeTruthy();
      expect(await zoo.readback()).toEqual(before);
      expect(await zoo.page.content()).toBe(markup);
      results.push(result);
    }
    const evidence = await zoo.evidence();
    expect(evidence).toMatchObject({ neverSave: true, liveSupportClaimed: false,
      nonGetObserved: 0, responseToNonGet: 0, nonGetBlocked: 0,
      blacklistClickAttempts: 0, blacklistClicks: 0, guardFailed: false });
    expect(evidence.routing).toMatchObject({ rejected: [], nonGetReachedRoute: 0 });
    await fs.writeFile(testInfo.outputPath('auto-readiness-evidence.json'), JSON.stringify({ results, evidence }, null, 2));
  } finally { await zoo.close(); }
});

for (const scenario of ['legacy', 'native', 'ud-select']) {
  const enabled = scenario !== 'legacy';
  test(`ordinary RESUME_FILL uses ${enabled ? `opt-in packaged ${scenario} writer` : 'default legacy path'}`, async ({}, testInfo) => {
    const zoo = await startZoo('write-route');
    try {
      const profile = { schemaVersion: 1, fullName: '离线姓名', confirmedFields: ['fullName'] };
      const profileBinding = await zoo.bind(profile);
      if (scenario === 'ud-select') await zoo.page.evaluate(() => {
        // Readonly/search displays must enter the ordinary route only after
        // MAIN identifies a writable, version-confirmed widget model.
        const input = document.querySelector('#fullName');
        input.readOnly = true; input.type = 'search'; input.setAttribute('role', 'combobox');
        input.setAttribute('aria-controls', 'route-name-options');
        window.UD = { version: 'fixture-contract-1' };
        const portal = document.createElement('div'); portal.id = 'route-name-options';
        portal.setAttribute('role', 'listbox'); portal.hidden = true;
        const option = document.createElement('div'); option.setAttribute('role', 'option'); option.textContent = '离线姓名';
        portal.append(option); document.body.append(portal);
        const props = { value: '', options: [{ value: 'name-code', label: '离线姓名' }],
          onChange(value) { props.value = value; input.value = '离线姓名'; portal.hidden = true; } };
        const host = { type: 'input', stateNode: input };
        const fiber = { type: { displayName: 'UdSelect', library: { name: 'ud', version: 'fixture-contract-1' } },
          memoizedProps: props, child: host, return: null };
        host.return = fiber;
        input.__reactFiber$zoo = fiber;
        input.addEventListener('click', () => { portal.hidden = false; });
        option.addEventListener('click', () => props.onChange('name-code'));
      });
      if (enabled) await zoo.worker.evaluate(() => chrome.storage.local.set({ resumeAtsEngineWriteEnabled: true }));
      await zoo.inject(['src/core/matcher.js', 'src/core/domain-memory.js', 'src/content/engine.js']);
      const result = await zoo.worker.evaluate(async ({ tabId, profile, profileBinding }) => chrome.tabs.sendMessage(tabId,
        { type: 'RESUME_FILL', profile, profileBinding }), { tabId: zoo.tabId, profile, profileBinding });
      expect(result.ok, JSON.stringify(result)).toBe(true);
      expect(await zoo.page.locator('#fullName').inputValue()).toBe('离线姓名');
      const field = result.data.fields.find(row => row.profilePath === 'fullName' || row.path === 'fullName' || row.question === '姓名');
      expect(field, JSON.stringify(result)).toBeTruthy();
      expect(field.status, JSON.stringify(result)).toBe('verified');
      if (enabled) {
        expect(field.adapter, JSON.stringify(result)).toBe(scenario === 'ud-select' ? 'ud-select' : 'native-text');
        expect(field.adapterStatus).toBe('success');
      }
      else expect(field.adapter).toBeUndefined();
      const evidence = await zoo.evidence();
      expect(evidence).toMatchObject({ nonGetObserved: 0, responseToNonGet: 0, nonGetBlocked: 0,
        blacklistClickAttempts: 0, blacklistClicks: 0, guardFailed: false, liveSupportClaimed: false });
      expect(evidence.routing.rejected).toEqual([]);
      expect(await zoo.page.locator('#neighbor').inputValue()).toBe('ZOO_NEIGHBOR_KEEP');
      await fs.writeFile(testInfo.outputPath('write-route-evidence.json'), JSON.stringify({ scenario, enabled, result, evidence }, null, 2));
    } finally { await zoo.close(); }
  });
}

for (const drift of ['none', 'model', 'display', 'both', 'option-remap', 'replacement']) {
  test(`ordinary batch checks original model and display after later writes: ${drift}`, async ({}, testInfo) => {
    const zoo = await startZoo('write-route');
    try {
      await zoo.page.evaluate(drift => {
        const form = document.querySelector('form');
        form.innerHTML = `<label for="fullName">姓名</label><input id="fullName" type="search" readonly role="combobox" aria-controls="batch-options">
          <label for="phone">手机号</label><input id="phone" type="tel"><input id="neighbor" value="ZOO_NEIGHBOR_KEEP">
          <input id="disabled-neighbor" value="ZOO_DISABLED_KEEP" disabled>
          <button type="submit">提交</button><button type="button">保存</button>`;
        const input = form.querySelector('#fullName');
        window.UD = { version: 'fixture-contract-1' };
        const portal = document.createElement('div'); portal.id = 'batch-options';
        portal.setAttribute('role', 'listbox'); portal.hidden = true;
        const option = document.createElement('div'); option.setAttribute('role', 'option'); option.textContent = '离线姓名';
        portal.append(option); document.body.append(portal);
        const props = { value: '', options: [{ value: 'original-code', label: '离线姓名' }] };
        const host = { type: 'input', stateNode: input };
        const owner = { type: { displayName: 'UdSelect', library: { name: 'ud', version: 'fixture-contract-1' } },
          memoizedProps: props, child: host, return: null };
        host.return = owner; input.__reactFiber$batch = host;
        const effects = { selections: 0, phoneInputs: 0 };
        input.addEventListener('click', () => { portal.hidden = false; });
        option.addEventListener('click', () => {
          effects.selections++; props.value = 'original-code'; input.value = '离线姓名'; portal.hidden = true;
        });
        form.querySelector('#phone').addEventListener('input', () => {
          effects.phoneInputs++;
          if (['model', 'both'].includes(drift)) props.value = '';
          if (['display', 'both'].includes(drift)) input.value = '';
          if (drift === 'option-remap') {
            props.value = 'changed-code'; props.options = [{ value: 'changed-code', label: '离线姓名' }];
          }
          if (drift === 'replacement') {
            const replacement = input.cloneNode(); replacement.value = '离线姓名';
            const newHost = { type: 'input', stateNode: replacement, return: owner };
            owner.child = newHost; replacement.__reactFiber$batch = newHost; input.replaceWith(replacement);
          }
        });
        window.__batchReadback = { props, effects };
      }, drift);
      const profile = { schemaVersion: 1, fullName: '离线姓名', phone: '13800138000', confirmedFields: ['fullName', 'phone'] };
      const profileBinding = await zoo.bind(profile);
      await zoo.worker.evaluate(() => chrome.storage.local.set({ resumeAtsEngineWriteEnabled: true }));
      await zoo.inject(['src/core/matcher.js', 'src/core/domain-memory.js', 'src/content/engine.js']);
      const result = await zoo.worker.evaluate(async ({ tabId, profile, profileBinding }) =>
        chrome.tabs.sendMessage(tabId, { type: 'RESUME_FILL', profile, profileBinding }), { tabId: zoo.tabId, profile, profileBinding });
      expect(result.ok, JSON.stringify(result)).toBe(true);
      expect(result.data.liveSupportClaimed).toBe(false);
      const name = result.data.fields.find(row => row.path === 'fullName');
      expect(name.status, JSON.stringify(result)).toBe(drift === 'none' ? 'verified' : 'failed');
      if (drift === 'replacement') expect(name.reason).toBe('field_changed');
      else expect(name.adapterStatus).toBe(drift === 'none' ? 'success' : 'reverted');
      expect(result.data.fields.find(row => row.path === 'phone').status).toBe('verified');
      const state = await zoo.page.evaluate(() => ({ model: window.__batchReadback.props.value, effects: window.__batchReadback.effects }));
      expect(state.effects).toEqual({ selections: 1, phoneInputs: 1 });
      expect(await zoo.page.locator('#neighbor').inputValue()).toBe('ZOO_NEIGHBOR_KEEP');
      const evidence = await zoo.evidence();
      expect(evidence).toMatchObject({ neverSave: true, liveSupportClaimed: false, nonGetObserved: 0,
        responseToNonGet: 0, nonGetBlocked: 0, blacklistClickAttempts: 0, blacklistClicks: 0, guardFailed: false });
      expect(evidence.routing).toMatchObject({ rejected: [], nonGetReachedRoute: 0 });
      await fs.writeFile(testInfo.outputPath('batch-readback-evidence.json'), JSON.stringify({ drift, result, state, evidence }, null, 2));
    } finally { await zoo.close(); }
  });
}

for (const enabled of [false, true]) for (const preselected of [false, true]) {
  test(`ordinary select readback: enabled=${enabled}, preselected=${preselected}`, async ({}, testInfo) => {
    const zoo = await startZoo('write-route');
    try {
      await zoo.page.evaluate(preselected => {
        document.querySelector('#fullName').value = 'KEEP_EXISTING_NAME';
        document.querySelector('form').insertAdjacentHTML('afterbegin', `
          <label for="prefix">国家码</label><select id="prefix" autocomplete="tel-country-code">
            <option value="">请选择</option><option value="+86" ${preselected ? 'selected' : ''}>中国 (+86)</option>
            <option value="+44">英国 (+44)</option></select>
          <label for="phone">手机号</label><select id="phone"><option value="">请选择</option>
            <option value="13800138000" ${preselected ? 'selected' : ''}>138 0013 8000</option></select>
          <label for="birth-year">年</label><select id="birth-year"><option value="-1">年</option><option value="1996">1996年</option></select>
          <label for="birth-month">月</label><select id="birth-month"><option value="0">月</option><option value="02">2月</option></select>
          <label for="birth-day">日</label><select id="birth-day"><option value="日">日</option><option value="29">29日</option></select>
          <label for="dash-year">年</label><select id="dash-year"><option value="-1">----</option><option value="1996">1996年</option></select>
          <label for="whole-birthday">生日</label><select id="whole-birthday"><option value="0">----</option><option value="1996">1996年</option></select>
          <label for="real-year">年份</label><select id="real-year"><option value="1996">1996</option></select>
          <label for="frequency">频率</label><select id="frequency"><option value="month">Month</option><option value="year">Year</option></select>`);
        window.__selectRouteEffects = [];
        for (const type of ['input', 'change', 'click', 'submit']) document.addEventListener(type,
          event => window.__selectRouteEffects.push([type, event.target.id]), true);
      }, preselected);
      const profile = { schemaVersion: 1, phone: '13800138000', birthDate: '1996-02-29',
        customAnswers: { 国家码: '+86' }, customFacts: [{ question: '国家码', answer: '+86',
          sitePageUrl: zoo.page.url(), sectionName: 'form:single', rowContext: 'none' }],
        confirmedFields: ['phone', 'birthDate', 'customAnswers.国家码'] };
      const profileBinding = await zoo.bind(profile);
      await zoo.worker.evaluate(enabled => chrome.storage.local.set({ resumeAtsEngineWriteEnabled: enabled }), enabled);
      await zoo.inject(['src/core/matcher.js', 'src/core/domain-memory.js', 'src/content/engine.js']);
      const invoke = type => zoo.worker.evaluate(async ({ tabId, type, profile, profileBinding }) =>
        chrome.tabs.sendMessage(tabId, { type, profile, profileBinding }), { tabId: zoo.tabId, type, profile, profileBinding });
      const before = await invoke('RESUME_INSPECT');
      expect(before.ok, JSON.stringify(before)).toBe(true);
      for (const id of ['prefix', 'phone']) expect(before.data.fields.find(row => row.id === id).reason).toBe('ready');
      expect(await zoo.page.evaluate(() => window.__selectRouteEffects)).toEqual([]);
      const result = await invoke('RESUME_FILL');
      expect(result.ok, JSON.stringify(result)).toBe(true);
      for (const [id, value, display] of [['prefix', '+86', '中国 (+86)'], ['phone', '13800138000', '138 0013 8000']]) {
        const field = result.data.fields.find(row => row.id === id);
        expect(field, JSON.stringify(result)).toMatchObject({ status: 'verified', currentValue: display,
          reason: preselected ? 'preexisting_same_value' : 'readback_matched' });
        if (enabled) expect(field).toMatchObject({ adapter: 'native-select', adapterStatus: 'success' });
        else expect(field.adapter).toBeUndefined();
        expect(await zoo.page.locator(`#${id}`).inputValue()).toBe(value);
      }
      for (const data of [before.data, result.data]) {
        for (const id of ['birth-year', 'birth-month', 'birth-day', 'dash-year']) {
          expect(data.fields.find(row => row.id === id)).toMatchObject({ semanticStatus: 'manual', currentValue: '' });
          expect(data.fields.find(row => row.id === id).path).toBeUndefined();
        }
        expect(data.fields.find(row => row.id === 'whole-birthday')).toMatchObject({ semanticStatus: 'manual',
          currentValue: '', path: 'birthDate', reason: 'option_not_found' });
        expect(data.fields.find(row => row.id === 'whole-birthday').status).not.toBe('verified');
      }
      for (const [id, value] of [['birth-year', '-1'], ['birth-month', '0'], ['birth-day', '日'], ['dash-year', '-1'], ['whole-birthday', '0'], ['real-year', '1996'],
        ['frequency', 'month'], ['fullName', 'KEEP_EXISTING_NAME'], ['neighbor', 'ZOO_NEIGHBOR_KEEP']]) {
        expect(await zoo.page.locator(`#${id}`).inputValue()).toBe(value);
      }
      expect(result.data.fields.find(row => row.id === 'real-year').currentValue).toBe('1996');
      expect(result.data.fields.find(row => row.id === 'frequency').currentValue).toBe('Month');
      const effects = await zoo.page.evaluate(() => window.__selectRouteEffects);
      expect(effects.every(([type, id]) => ['input', 'change'].includes(type) && ['prefix', 'phone'].includes(id))).toBe(true);
      if (preselected) expect(effects).toEqual([]);
      const evidence = await zoo.evidence();
      expect(evidence).toMatchObject({ neverSave: true, liveSupportClaimed: false, nonGetObserved: 0, responseToNonGet: 0,
        nonGetBlocked: 0, blacklistClickAttempts: 0, blacklistClicks: 0, guardFailed: false });
      expect(evidence.routing).toMatchObject({ rejected: [], nonGetReachedRoute: 0 });
      await fs.writeFile(testInfo.outputPath('select-readback-evidence.json'), JSON.stringify({ enabled, preselected, before, result, effects, evidence }, null, 2));
    } finally { await zoo.close(); }
  });
}

for (const enabled of [false, true]) for (const itemClass of ['form-item', 'ant-form-item']) {
  test(`ordinary shared-row value ownership: enabled=${enabled}, class=${itemClass}`, async ({}, testInfo) => {
    const zoo = await startZoo('write-route');
    try {
      await zoo.page.evaluate(itemClass => {
        document.querySelector('#fullName').value = 'KEEP_EXISTING_NAME';
        const label = (id, text) => itemClass === 'ant-form-item'
          ? `<div class="ant-form-item-label"><label for="${id}">${text}</label></div>`
          : `<label for="${id}">${text}</label>`;
        document.querySelector('form').insertAdjacentHTML('afterbegin', `
          <div class="${itemClass}">${label('phone', '手机号')}
            <select id="prefix"><option value="+86">中国 (+86)</option></select><input id="phone" type="tel"></div>
          <div class="${itemClass}">${label('birthday', '生日')}
            <select id="year"><option value="-1">----</option><option value="1996">1996年</option></select><input id="birthday"></div>
          <label for="owned-prefix">国家码</label><select id="owned-prefix"><option value="+86">中国 (+86)</option></select>`);
        window.__ownershipEffects = [];
        for (const type of ['input', 'change', 'click', 'submit']) document.addEventListener(type,
          event => window.__ownershipEffects.push([type, event.target.id]), true);
      }, itemClass);
      const profile = { schemaVersion: 1, phone: '13800138000', birthDate: '1996-02-29',
        customAnswers: { 国家码: '+86' }, customFacts: [{ question: '国家码', answer: '+86',
          sitePageUrl: zoo.page.url(), sectionName: 'form:single', rowContext: 'none' }],
        confirmedFields: ['phone', 'birthDate', 'customAnswers.国家码'] };
      const profileBinding = await zoo.bind(profile);
      await zoo.worker.evaluate(enabled => chrome.storage.local.set({ resumeAtsEngineWriteEnabled: enabled }), enabled);
      await zoo.inject(['src/core/matcher.js', 'src/core/domain-memory.js', 'src/content/engine.js']);
      const invoke = type => zoo.worker.evaluate(async ({ tabId, type, profile, profileBinding }) =>
        chrome.tabs.sendMessage(tabId, { type, profile, profileBinding }), { tabId: zoo.tabId, type, profile, profileBinding });
      const before = await invoke('RESUME_INSPECT');
      expect(await zoo.page.evaluate(() => window.__ownershipEffects)).toEqual([]);
      const result = await invoke('RESUME_FILL');
      for (const data of [before, result]) {
        expect(data.ok, JSON.stringify(data)).toBe(true);
        for (const id of ['prefix', 'year']) {
          const field = data.data.fields.find(row => row.id === id);
          expect(field.path, JSON.stringify(field)).toBeUndefined();
          expect(field.semanticStatus).toBe('manual');
          expect(field.status).not.toBe('verified');
        }
        expect(data.data.fields.find(row => row.id === 'year').currentValue).toBe('');
      }
      const unconfirmedFramework = enabled && itemClass === 'ant-form-item';
      for (const [id, path, value] of [['phone', 'phone', '13800138000'], ['birthday', 'birthDate', '1996-02-29']]) {
        expect(before.data.fields.find(row => row.id === id)).toMatchObject({ path, currentValue: '' });
        expect(result.data.fields.find(row => row.id === id)).toMatchObject({ path,
          currentValue: unconfirmedFramework ? '' : value, status: unconfirmedFramework ? 'skipped' : 'verified',
          ...(unconfirmedFramework ? { reason: 'control_or_version_unconfirmed' } : {}) });
        expect(await zoo.page.locator(`#${id}`).inputValue()).toBe(unconfirmedFramework ? '' : value);
      }
      expect(result.data.fields.find(row => row.id === 'owned-prefix')).toMatchObject({ path: 'customAnswers.国家码', status: 'verified' });
      for (const [id, value] of [['prefix', '+86'], ['year', '-1'], ['fullName', 'KEEP_EXISTING_NAME'], ['neighbor', 'ZOO_NEIGHBOR_KEEP']])
        expect(await zoo.page.locator(`#${id}`).inputValue()).toBe(value);
      const effects = await zoo.page.evaluate(() => window.__ownershipEffects);
      expect(effects.every(([type, id]) => ['input', 'change'].includes(type) && ['phone', 'birthday'].includes(id))).toBe(true);
      if (unconfirmedFramework) expect(effects).toEqual([]);
      const evidence = await zoo.evidence();
      expect(evidence).toMatchObject({ neverSave: true, liveSupportClaimed: false, nonGetObserved: 0, responseToNonGet: 0,
        nonGetBlocked: 0, blacklistClickAttempts: 0, blacklistClicks: 0, guardFailed: false });
      expect(evidence.routing).toMatchObject({ rejected: [], nonGetReachedRoute: 0 });
      await fs.writeFile(testInfo.outputPath('shared-row-ownership-evidence.json'), JSON.stringify({ enabled, itemClass, before, result, effects, evidence }, null, 2));
    } finally { await zoo.close(); }
  });
}

test('thin ATS profile keeps unknown fields manual through ordinary inspect/fill without effects', async ({}, testInfo) => {
  const zoo = await startZoo('write-route');
  try {
    const profile = { schemaVersion: 1, fullName: '离线姓名', confirmedFields: ['fullName'] };
    const profileBinding = await zoo.bind(profile);
    await zoo.page.evaluate(() => {
      document.querySelector('#fullName').value = 'KEEP_EXISTING_NAME';
      const label = document.createElement('label');
      label.htmlFor = 'unknown'; label.textContent = '未识别题目';
      const input = document.createElement('input'); input.id = 'unknown';
      document.querySelector('form').prepend(label, input);
      window.__thinProfileEffects = 0;
      for (const event of ['click', 'input', 'change', 'blur', 'pointerdown', 'mousedown', 'submit'])
        document.addEventListener(event, () => { window.__thinProfileEffects++; }, true);
    });
    const before = await zoo.readback();
    const markup = await zoo.page.locator('form').evaluate(node => node.outerHTML);
    await zoo.inject(['src/core/matcher.js', 'src/core/domain-memory.js', 'src/content/engine.js']);
    const results = [];
    for (const enabled of [false, true]) {
      await zoo.worker.evaluate(enabled => chrome.storage.local.set({ resumeAtsEngineWriteEnabled: enabled }), enabled);
      for (const type of ['RESUME_INSPECT', 'RESUME_FILL']) {
        const result = await zoo.worker.evaluate(async ({ tabId, type, profile, profileBinding }) =>
          chrome.tabs.sendMessage(tabId, { type, profile, profileBinding }), { tabId: zoo.tabId, type, profile, profileBinding });
        expect(result.ok, JSON.stringify(result)).toBe(true);
        const field = result.data.fields.find(row => row.id === 'unknown');
        expect(field).toMatchObject({ atsProfile: 'moka', semanticStatus: 'manual', reason: 'unknown_question' });
        expect(field.path).toBeUndefined();
        if (type === 'RESUME_FILL') expect(field.status).toBe('skipped');
        expect(result.data.fields.find(row => row.id === 'fullName')).toMatchObject({ atsProfile: 'moka', reason: 'existing_value' });
        results.push({ enabled, type, result });
      }
    }
    expect(await zoo.readback()).toEqual(before);
    expect(await zoo.page.locator('form').evaluate(node => node.outerHTML)).toBe(markup);
    expect(await zoo.page.locator('#unknown').inputValue()).toBe('');
    expect(await zoo.page.evaluate(() => window.__thinProfileEffects)).toBe(0);
    const evidence = await zoo.evidence();
    expect(evidence).toMatchObject({ neverSave: true, liveSupportClaimed: false,
      nonGetObserved: 0, responseToNonGet: 0, nonGetBlocked: 0,
      blacklistClickAttempts: 0, blacklistClicks: 0, guardFailed: false });
    expect(evidence.routing).toMatchObject({ rejected: [], nonGetReachedRoute: 0 });
    await fs.writeFile(testInfo.outputPath('thin-ats-profile-evidence.json'), JSON.stringify({ results, evidence }, null, 2));
  } finally { await zoo.close(); }
});
