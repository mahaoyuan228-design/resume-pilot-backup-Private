import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { startZoo } from './support.mjs';

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
      for (const data of [before.data, result.data]) for (const id of ['birth-year', 'birth-month', 'birth-day']) {
        expect(data.fields.find(row => row.id === id)).toMatchObject({ semanticStatus: 'manual', currentValue: '' });
        expect(data.fields.find(row => row.id === id).path).toBeUndefined();
      }
      for (const [id, value] of [['birth-year', '-1'], ['birth-month', '0'], ['birth-day', '日'], ['real-year', '1996'],
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
