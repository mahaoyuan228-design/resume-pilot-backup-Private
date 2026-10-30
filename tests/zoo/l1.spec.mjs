import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { startZoo, workProfile, CMS } from './support.mjs';

const expectations = JSON.parse(await fs.readFile(new URL('./l1-shadow-expectations.json', import.meta.url), 'utf8'));

async function safety(zoo) {
  const evidence = await zoo.evidence();
  expect(evidence).toMatchObject({
    nonGetObserved: 0, nonGetBlocked: 0, responseToNonGet: 0,
    blacklistClickAttempts: 0, blacklistClicks: 0, guardFailed: false,
    neverSave: true, liveSupportClaimed: false,
  });
  expect(evidence.routing.rejected).toEqual([]);
  expect(evidence.routing.nonGetReachedRoute).toBe(0);
  expect(Object.keys(evidence.adapterHashes)).toContain('src/background/controls-shadow.mjs');
  const reads = await zoo.readback();
  expect(reads.model.neighbor).toBe('ZOO_NEIGHBOR_KEEP');
  expect(reads.model.disabledValue).toBe('ZOO_DISABLED_KEEP');
  expect(await zoo.page.locator('#neighbor').inputValue()).toBe('ZOO_NEIGHBOR_KEEP');
  expect(await zoo.page.locator('#disabled-neighbor').inputValue()).toBe('ZOO_DISABLED_KEEP');
  return evidence;
}

async function record(testInfo, zoo, result) {
  const evidence = await safety(zoo);
  await fs.writeFile(testInfo.outputPath('l1-evidence.json'), JSON.stringify({ result, reads: await zoo.readback(), evidence }, null, 2));
  await zoo.page.screenshot({ path: testInfo.outputPath('l1-fixture.png'), fullPage: true });
}

test('packaged detect/plan leaves cross-origin frames, captcha, unknown and broken controls manual', async ({}, testInfo) => {
  const zoo = await startZoo('cms-month');
  try {
    const frameUrl = 'https://manual-frame.invalid/challenge';
    await zoo.page.route(frameUrl, route => route.fulfill({ contentType: 'text/html', body: '<input value="FRAME_KEEP">' }));
    const originCheck = await zoo.page.evaluate(async url => {
      const host = document.createElement('section');
      host.id = 'manual-cases';
      host.innerHTML = '<iframe id="manual-frame"></iframe><div data-captcha><input id="manual-challenge"></div><div id="manual-unknown" role="combobox"></div><input id="manual-broken"><input id="manual-healthy">';
      document.body.append(host);
      const frame = host.querySelector('iframe');
      await new Promise(resolve => { frame.onload = resolve; frame.src = url; });
      let denied = false;
      try { void frame.contentWindow.document; } catch (error) { denied = error.name === 'SecurityError'; }
      const opaque = frame.contentDocument === null;
      window.__manualEffects = 0; window.__manualFrameReads = 0;
      for (const key of ['contentDocument', 'contentWindow']) Object.defineProperty(frame, key, { get() {
        window.__manualFrameReads++; throw Error('frame_access_forbidden');
      } });
      Object.defineProperty(host.querySelector('#manual-broken'), '__vue__', { get() { throw Error('component_unreadable'); } });
      for (const type of ['click', 'input', 'change', 'focus', 'submit']) host.addEventListener(type, () => window.__manualEffects++, true);
      return { denied, opaque };
    }, frameUrl);
    expect(originCheck).toEqual({ denied: true, opaque: true });
    const before = await zoo.page.locator('#manual-cases').evaluate(node => node.outerHTML);
    const selectors = ['#manual-frame', '#manual-challenge', '#manual-unknown', '#manual-broken', '#manual-healthy'];
    const result = await zoo.shadow(selectors.map(selector => ({ selector, fact: { value: 'synthetic' } })));
    expect(result).toMatchObject({ writeStarted: false, liveSupportClaimed: false });
    for (const row of result.plans.slice(0, 4)) {
      expect(row).toMatchObject({ status: 'manual', writeStarted: false, liveSupportClaimed: false,
        inspection: { status: 'manual', adapter: null } });
    }
    expect(result.plans[3].reason).toBe('component_probe_failed');
    expect(result.plans[4]).toMatchObject({ status: 'planned', adapter: 'native-text' });
    expect(await zoo.page.evaluate(() => ({ effects: window.__manualEffects, frameReads: window.__manualFrameReads,
      values: [...document.querySelectorAll('#manual-cases input')].map(node => node.value) })))
      .toEqual({ effects: 0, frameReads: 0, values: ['', '', ''] });
    expect(await zoo.page.locator('#manual-cases').evaluate(node => node.outerHTML)).toBe(before);
    await record(testInfo, zoo, result);
  } finally { await zoo.close(); }
});

async function legacyReadback(zoo, name) {
  if (name === 'cms-month') {
    await zoo.inject(['src/content/cms-date-picker.js']);
    const legacy = await zoo.execute(async () => ResumeCmsDatePicker.fillBirthDate(document.querySelector('.ant-calendar-picker input'), '2023-01'));
    expect(legacy).toEqual({ status: 'skipped', reason: 'insufficient_precision' });
    return { result: legacy, dom: await zoo.page.locator('.ant-calendar-picker input').inputValue(), model: (await zoo.readback()).model.englishExamDate };
  }
  if (name === 'cms-school') {
    await zoo.inject(['src/content/cms-school-search.js']);
    const legacy = await zoo.execute(async () => ResumeCmsSchoolSearch.fillSchool(document.querySelector('#school .ant-select-selection--single'), '离线示例大学', '离线示例大学'));
    expect(legacy.status).toBe('verified');
    return { result: legacy, dom: (await zoo.page.locator('#school .ant-select-selection-selected-value').textContent()).trim(), model: (await zoo.readback()).model.school };
  }
  if (name === 'hotjob-pair') {
    await zoo.inject(['src/content/cms-region.js']);
    const legacy = await zoo.execute(async page => ResumeCmsRegion.fillRegion(document.querySelector('.cascader-plugins-wrap'), {
      confirmed: true, sitePageUrl: page, sectionName: '个人基本信息必填', question: '现居住地', rowContext: 'single', province: '北京市', city: '北京市',
    }), [CMS]);
    expect(legacy.status).toBe('verified');
    const model = (await zoo.readback()).model;
    return { result: legacy, dom: (await zoo.page.locator('.cascader-plugins-wrap .ant-select-selection-selected-value').allTextContents()).map(s => s.trim()), model: [model.residence, model.residenceTwin] };
  }
  await zoo.inject(['src/content/gth-open-fill.js', 'src/content/gth-work-fill.js']);
  const profile = workProfile(), profileBinding = await zoo.bind(profile);
  const legacy = await zoo.execute(async request => ResumeGthWorkOpen.trial(request), [{ requestId: 'offline-zoo-l1-shadow-0001', profile, profileBinding, profileIndex: 0, replaceExisting: false }]);
  expect(legacy.ok, JSON.stringify(legacy)).toBe(true);
  expect(legacy.liveSupportClaimed).toBe(false);
  const question = name === 'gth-month-range' ? '任职时间' : '职位类别';
  const field = legacy.fields.find(row => row.question === question);
  expect(field?.status).toBe('verified');
  const model = (await zoo.readback()).model;
  return name === 'gth-month-range'
    ? { result: field, dom: [await zoo.page.locator('#start-date').inputValue(), await zoo.page.locator('#end-date').inputValue()], model: [model.startDate, model.endDate] }
    : { result: field, dom: await zoo.page.locator('#job-category input.el-input__inner').inputValue(), model: model.jobCategory };
}

for (const [name, expected] of Object.entries(expectations.cases)) {
  test(`packaged L1 shadow leaves ${name} untouched and explains legacy comparison`, async ({}, testInfo) => {
    const zoo = await startZoo(name);
    try {
      const before = await zoo.readback();
      const beforeDom = await zoo.page.locator('#app').evaluate(node => node.outerHTML);
      const request = { selector: expected.selector, field: expected.field, fact: { value: expected.value } };
      const shadow = await zoo.shadow([request]);
      expect(shadow).toMatchObject({ mode: 'shadow', liveSupportClaimed: false });
      expect(shadow.plans).toHaveLength(1);
      const plan = shadow.plans[0];
      expect(plan.status, JSON.stringify(plan)).toBe(expected.status);
      if (expected.adapter) {
        expect(plan.adapter).toBe(expected.adapter);
        expect(plan.value).toEqual(expected.value);
      } else {
        expect(plan.adapter ?? null).toBeNull();
      }
      expect(await zoo.readback()).toEqual(before);
      expect(await zoo.page.locator('#app').evaluate(node => node.outerHTML)).toBe(beforeDom);
      await expect(zoo.page.locator('.ant-select-dropdown:visible,.ant-calendar-picker-container:visible,.el-picker-panel:visible,.plugin-dialog-wrap:visible')).toHaveCount(0);
      await safety(zoo);
      // Compare against an actual legacy execution on the unchanged fixture.
      // This is an accepted-readback comparison, not a fabricated legacy plan.
      const legacy = await legacyReadback(zoo, name);
      if (expected.comparison === 'legacy_readback_equal') {
        expect(legacy.dom).toEqual(request.fact.value);
        expect(legacy.model).toEqual(request.fact.value);
      } else if (name === 'cms-month') {
        expect(legacy.dom).toBe('');
        expect(legacy.model).toBe('');
        expect(expected.reason).toContain('legacy');
      } else {
        expect(legacy.dom).toBe(request.fact.value);
        expect(legacy.model).toBe(request.fact.value);
        expect(expected.reason).toContain('L3');
      }
      await record(testInfo, zoo, { shadow, legacy, comparison: expected.comparison, explanation: expected.reason || null });
    } finally { await zoo.close(); }
  });
}

test('L1 shadow reads component models only in MAIN and rejects an unknown library version', async ({}, testInfo) => {
  const zoo = await startZoo('cms-month');
  try {
    const before = await zoo.readback();
    const first = await zoo.shadow([{ selector: '.ant-calendar-picker', fact: { value: '2023-01' } }]);
    expect(first.plans[0]).toMatchObject({ adapter: 'antdv1-month', status: 'planned' });
    const isolated = await zoo.execute(() => ({ vue: !!document.querySelector('.ant-calendar-picker').__vue__, controls: typeof globalThis.ResumeControls }));
    expect(isolated).toEqual({ vue: false, controls: 'undefined' });
    const main = await zoo.execute(() => ({ vue: !!document.querySelector('.ant-calendar-picker').__vue__, controls: typeof globalThis.ResumeControls }), [], 'MAIN');
    expect(main.vue).toBe(true);
    expect(main.controls).not.toBe('undefined');
    await zoo.page.evaluate(() => {
      window.__zooSavedAntd = window.antd;
      window.antd = { ...window.antd, version: '9.0.0-unverified' };
    });
    const unknown = await zoo.shadow([{ selector: '.ant-calendar-picker', fact: { value: '2023-01' } }]);
    expect(unknown.plans[0], JSON.stringify(unknown)).toMatchObject({ adapter: 'date-unknown', status: 'manual' });
    await zoo.page.evaluate(() => { window.antd = window.__zooSavedAntd; delete window.__zooSavedAntd; });
    expect(await zoo.readback()).toEqual(before);
    await record(testInfo, zoo, { isolated, main, first, unknown });
  } finally { await zoo.close(); }
});

for (const name of ['cms-school', 'hotjob-pair', 'gth-month-range']) {
  test(`offline L1 writer fills ${name} through the packaged adapter`, async ({}, testInfo) => {
    const expected = expectations.cases[name];
    const zoo = await startZoo(name);
    try {
      const before = await zoo.readback();
      const shadow = await zoo.shadow([{ selector: expected.selector, fact: { value: expected.value } }]);
      expect(shadow.plans[0]).toMatchObject({ adapter: expected.adapter, status: 'planned' });
      expect(await zoo.readback()).toEqual(before);
      const write = await zoo.execute(async ({ selector, instruction }) => {
        const el = document.querySelector(selector);
        const adapter = ResumeControls.resolve(el);
        if (!adapter) throw Error('zoo_adapter_missing');
        const result = await adapter.write(el, instruction, { allowWrite: true, check: async () => {
          if (document.visibilityState !== 'visible' || !el.isConnected) throw Error('zoo_control_not_visible');
        } });
        return { result, verify: await ResumeControls.verify(el, instruction) };
      }, [{ selector: expected.selector, instruction: shadow.plans[0] }], 'MAIN');
      expect(write.verify.status, JSON.stringify(write)).toBe('success');
      expect(write.result.strategy, JSON.stringify(write)).toBe('ui');
      const reads = (await zoo.readback()).model;
      let dom, model, allowed;
      if (name === 'cms-school') {
        dom = (await zoo.page.locator('#school .ant-select-selection-selected-value').textContent()).trim();
        model = reads.school;
        allowed = ['school'];
        expect((await zoo.readback()).snapshot.effects.searchRequests).toBeGreaterThan(0);
      } else if (name === 'hotjob-pair') {
        dom = (await zoo.page.locator('.cascader-plugins-wrap .ant-select-selection-selected-value').allTextContents()).map(value => value.trim());
        model = [reads.residence, reads.residenceTwin];
        allowed = ['residence', 'residenceTwin'];
      } else {
        dom = [await zoo.page.locator('#start-date').inputValue(), await zoo.page.locator('#end-date').inputValue()];
        model = [reads.startDate, reads.endDate];
        allowed = ['startDate', 'endDate'];
      }
      expect(dom).toEqual(expected.value);
      expect(model).toEqual(expected.value);
      for (const key of Object.keys(before.model)) if (!allowed.includes(key)) expect(reads[key], `untouched ${key}`).toEqual(before.model[key]);
      await record(testInfo, zoo, { shadow, write, dom, model, scope: 'offline synthetic component writer only' });
    } finally { await zoo.close(); }
  });
}

for (const variant of ['existing', 'disabled']) {
  test(`L1 shadow preserves ${variant} component and neighbors`, async ({}, testInfo) => {
    const zoo = await startZoo('cms-school', variant);
    try {
      const before = await zoo.readback();
      const shadow = await zoo.shadow([{ selector: '#school.ant-select', fact: { value: '离线示例大学' } }]);
      const plan = shadow.plans[0];
      expect(plan.status, JSON.stringify(plan)).toBe(variant === 'existing' ? 'unsupported' : 'manual');
      if (variant === 'existing') expect(plan.reason).toBe('existing_value');
      expect(await zoo.readback()).toEqual(before);
      await record(testInfo, zoo, shadow);
    } finally { await zoo.close(); }
  });
}

test('offline L1 month writer accepts both DOM and component model readback', async ({}, testInfo) => {
  const zoo = await startZoo('cms-month');
  try {
    const shadow = await zoo.shadow([{ selector: '.ant-calendar-picker', fact: { value: '2023-01' } }]);
    expect(shadow.plans[0].status).toBe('planned');
    const write = await zoo.execute(async instruction => {
      const el = document.querySelector('.ant-calendar-picker');
      const adapter = ResumeControls.resolve(el);
      if (!adapter) throw Error('zoo_month_adapter_missing');
      const result = await adapter.write(el, instruction, { allowWrite: true, check: async () => {
        if (document.visibilityState !== 'visible' || !el.isConnected) throw Error('zoo_control_not_visible');
      } });
      const verify = await ResumeControls.verify(el, instruction);
      return { result, verify };
    }, [shadow.plans[0]], 'MAIN');
    expect(write.verify.status, JSON.stringify(write)).toBe('success');
    expect(write.result.strategy, JSON.stringify(write)).toBe('ui');
    expect(await zoo.page.locator('.ant-calendar-picker input').inputValue()).toBe('2023-01');
    expect((await zoo.readback()).model.englishExamDate).toBe('2023-01');
    // Change only the visible input. A correct model alone must not verify.
    const mismatch = await zoo.execute(async instruction => {
      const el = document.querySelector('.ant-calendar-picker');
      const input = el.querySelector('input');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '2040-12');
      return ResumeControls.verify(el, instruction, { settleMs: 0 });
    }, [shadow.plans[0]], 'MAIN');
    expect(mismatch.status, JSON.stringify(mismatch)).toBe('mismatch');
    expect((await zoo.readback()).model.englishExamDate).toBe('2023-01');
    // Begin with both readbacks correct, then simulate a later DOM reversion.
    const reverted = await zoo.execute(async instruction => {
      const el = document.querySelector('.ant-calendar-picker');
      const input = el.querySelector('input');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, '2023-01');
      setTimeout(() => setter.call(input, ''), 20);
      return ResumeControls.verify(el, instruction, { settleMs: 100 });
    }, [shadow.plans[0]], 'MAIN');
    expect(reverted.status, JSON.stringify(reverted)).toBe('reverted');
    const unsupported = await zoo.execute(async () => ResumeControls.verify(document.querySelector('.ant-calendar-picker'), { status: 'unsupported' }), [], 'MAIN');
    expect(unsupported.status).toBe('unsupported');
    await record(testInfo, zoo, { shadow, write, mismatch, reverted, unsupported, scope: 'offline synthetic component writer only' });
  } finally { await zoo.close(); }
});

test('offline native adapters preserve guards and verify text, select, radio and additive checkbox writes', async ({}, testInfo) => {
  const zoo = await startZoo('cms-month');
  try {
    await zoo.page.evaluate(() => {
      const form = document.createElement('form');
      form.id = 'l1-native-fixture';
      form.innerHTML = `<label>文本<input id="l1-text" type="text"></label>
        <label>多行<textarea id="l1-textarea"></textarea></label>
        <label>学历<select id="l1-select"><option value=""></option><option value="degree-bs">本科</option></select></label>
        <label><input id="l1-radio-a" name="l1-radio" type="radio" value="a">甲</label>
        <label><input id="l1-radio-b" name="l1-radio" type="radio" value="b">乙</label>
        <label><input id="l1-checkbox" type="checkbox">勾选</label>
        <input id="l1-existing" value="KEEP_EXISTING">
        <input id="l1-same" value="SAME">
        <input id="l1-readonly" readonly value="KEEP_READONLY">
        <input id="l1-disabled" disabled value="KEEP_DISABLED">
        <input id="l1-upload" type="file">`;
      form.addEventListener('submit', event => event.preventDefault());
      document.body.append(form);
    });
    const requests = [
      { selector: '#l1-text', fact: { value: '离线原生文本' }, adapter: 'native-text' },
      { selector: '#l1-textarea', fact: { value: '离线多行内容' }, adapter: 'native-textarea' },
      { selector: '#l1-select', fact: { value: '本科' }, adapter: 'native-select' },
      { selector: '#l1-radio-a', fact: { value: '乙' }, adapter: 'native-radio' },
      { selector: '#l1-checkbox', fact: { value: true }, adapter: 'native-checkbox' },
    ];
    const shadow = await zoo.shadow(requests.map(({ selector, fact }) => ({ selector, fact })));
    expect(shadow.plans).toHaveLength(requests.length);
    for (let i = 0; i < requests.length; i++) expect(shadow.plans[i], JSON.stringify(shadow)).toMatchObject({ adapter: requests[i].adapter, status: 'planned' });
    expect(await zoo.page.locator('#l1-text').inputValue()).toBe('');
    expect(await zoo.page.locator('#l1-checkbox').isChecked()).toBe(false);
    const denied = await zoo.execute(async instruction => ResumeControls.resolve(document.querySelector('#l1-text')).write(document.querySelector('#l1-text'), instruction), [shadow.plans[0]], 'MAIN');
    expect(denied).toMatchObject({ status: 'unsupported', reason: 'shadow_mode', attempts: 0 });
    expect(await zoo.page.locator('#l1-text').inputValue()).toBe('');
    const results = await zoo.execute(async ({ requests, instructions }) => {
      const results = [];
      for (let i = 0; i < requests.length; i++) {
        const el = document.querySelector(requests[i].selector), instruction = instructions[i];
        const written = await ResumeControls.resolve(el).write(el, instruction, { allowWrite: true, check: async () => {
          if (document.visibilityState !== 'visible' || !el.isConnected) throw Error('zoo_control_not_visible');
        } });
        results.push({ written, verified: await ResumeControls.verify(el, instruction) });
      }
      return results;
    }, [{ requests, instructions: shadow.plans }], 'MAIN');
    for (const result of results) expect(result.verified.status, JSON.stringify(results)).toBe('success');
    expect(await zoo.page.locator('#l1-text').inputValue()).toBe('离线原生文本');
    expect(await zoo.page.locator('#l1-textarea').inputValue()).toBe('离线多行内容');
    expect(await zoo.page.locator('#l1-select').inputValue()).toBe('degree-bs');
    expect(await zoo.page.locator('#l1-radio-b').isChecked()).toBe(true);
    expect(await zoo.page.locator('#l1-checkbox').isChecked()).toBe(true);
    const guards = await zoo.shadow([
      { selector: '#l1-existing', fact: { value: 'REPLACE' } },
      { selector: '#l1-same', fact: { value: 'SAME' } },
      { selector: '#l1-readonly', fact: { value: 'REPLACE' } },
      { selector: '#l1-disabled', fact: { value: 'REPLACE' } },
      { selector: '#l1-upload', fact: { value: 'file.pdf' } },
      { selector: '#l1-checkbox', fact: { value: false } },
    ]);
    expect(guards.plans[0]).toMatchObject({ status: 'unsupported', reason: 'existing_value' });
    expect(guards.plans[1]).toMatchObject({ status: 'success', reason: 'preexisting_same_value' });
    expect(guards.plans[2]).toMatchObject({ status: 'manual', reason: 'readonly' });
    expect(guards.plans[3]).toMatchObject({ status: 'manual', reason: 'disabled' });
    expect(guards.plans[4]).toMatchObject({ status: 'manual', reason: 'upload_manual' });
    expect(guards.plans[5]).toMatchObject({ status: 'unsupported', reason: 'existing_value' });
    expect(await zoo.page.locator('#l1-existing').inputValue()).toBe('KEEP_EXISTING');
    expect(await zoo.page.locator('#l1-readonly').inputValue()).toBe('KEEP_READONLY');
    expect(await zoo.page.locator('#l1-disabled').inputValue()).toBe('KEEP_DISABLED');
    expect(await zoo.page.locator('#l1-checkbox').isChecked()).toBe(true);
    await record(testInfo, zoo, { shadow, denied, results, guards, scope: 'offline native fixture only' });
  } finally { await zoo.close(); }
});
