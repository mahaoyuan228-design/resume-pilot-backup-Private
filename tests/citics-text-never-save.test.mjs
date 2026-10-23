import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { normalizeProfile } from '../src/profile/store.js';

const source = readFileSync(new URL('../src/content/citics-basic.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('./fixtures/citics-text-never-save.html', import.meta.url), 'utf8');
const core = { fullName: '测试', identityNumber: 'offline-identity', phone: '13800138000', email: 'offline@example.invalid',
  confirmedFields: ['fullName', 'identityNumber', 'phone', 'email'] };
const extra = [
  ['姓（拼音）', 'lastNamePinyin', 'last-pinyin', 'CE'],
  ['名（拼音）', 'firstNamePinyin', 'first-pinyin', 'SHI'],
  ['联系地址', 'address', 'address', '测试地址 1 号'],
  ['邮编', 'postalCode', 'postal-code', '001234'],
  ['微信', 'wechat', 'wechat', 'offline-wechat'],
  ['紧急联系人', 'emergencyContact', 'emergency-contact', '联系人甲'],
  ['紧急联系人手机', 'emergencyContactPhone', 'emergency-phone', '13900139000']
];

function harness(t, { url = 'https://careers.citics.com/my/jl', chrome } = {}) {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const { window: w } = dom;
  Object.defineProperty(w.HTMLElement.prototype, 'getClientRects', { value() {
    return [{ width: 120, height: 40 }];
  } });
  Object.defineProperty(w.HTMLElement.prototype, 'getBoundingClientRect', { value() {
    return { width: 120, height: 40, top: 0, left: 0, right: 120, bottom: 40 };
  } });
  const realTimeout = w.setTimeout.bind(w);
  w.setTimeout = (callback) => realTimeout(callback, 0);
  if (chrome) w.chrome = chrome;
  const clicks = [];
  w.document.addEventListener('click', (event) => {
    const button = event.target.closest('button, a');
    if (button) clicks.push(button.textContent.trim());
  }, true);
  w.document.addEventListener('submit', (event) => event.preventDefault());
  w.eval(source);
  const input = (id) => w.document.getElementById(id);
  const fill = (profile, options) => w.ResumeCiticsBasic.fillBasic({ profile }, options);
  return { w, input, fill, clicks, api: w.ResumeCiticsBasic };
}

function confirmedExtras() {
  return { ...core, ...Object.fromEntries(extra.map(([, key, , value]) => [key, value])),
    confirmedFields: [...core.confirmedFields, ...extra.map(([, key]) => key)] };
}

function occupyCore(input) {
  for (const id of ['last', 'first', 'identity', 'phone', 'email', 'confirm-email']) input(id).value = `keep-${id}`;
}

function neverSave(result, clicks) {
  assert.equal(result.saved, false);
  assert.equal(result.skippedSave, true);
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.supportClaimed, false);
  assert.equal(result.neverSave, true);
  assert.equal(result.leftUnsaved, true);
  for (const action of ['Save', 'Submit', 'Next', 'Deliver', 'Delete']) assert.equal(result[`softwareClicked${action}`], false);
  assert.equal(result.saveAllowed, false);
  assert.deepEqual(clicks, []);
}

test('planner keeps core gating/counts and uses seven independent confirmed text facts', (t) => {
  const { api } = harness(t);
  assert.equal(api.liveSupportClaimed, false);
  const baseline = api.planFromProfile(core);
  assert.equal(baseline.ok, true);
  assert.equal(baseline.fields.length, 6);
  assert.equal(baseline.values.lastNamePinyin, undefined);
  const planned = api.planFromProfile(confirmedExtras());
  assert.equal(planned.fields.length, 13);
  for (const [label, key, , value] of extra) {
    assert.equal(planned.fields.find((row) => row.label === label).path, key);
    assert.equal(planned.values[key], value);
  }
  const unconfirmed = api.planFromProfile({ ...core, lastNamePinyin: 'CE' });
  assert.equal(unconfirmed.ok, true);
  assert.equal(unconfirmed.values.lastNamePinyin, undefined);
  assert.equal(unconfirmed.blockers[0].reason, 'profile_fact_unconfirmed');
  assert.equal(api.planFromProfile({ ...confirmedExtras(), phone: '' }).ok, false);
});

test('normalized exact-label custom answers preserve confirmed facts without schema changes', async (t) => {
  const { api, fill, input, clicks } = harness(t);
  const profile = normalizeProfile({ ...core,
    customAnswers: Object.fromEntries(extra.map(([label, , , value]) => [label, value])),
    confirmedFields: [...core.confirmedFields, ...extra.map(([label]) => `customAnswers.${label}`)] });
  const planned = api.planFromProfile(profile);
  for (const [label, key, , value] of extra) {
    assert.equal(planned.values[key], value);
    assert.equal(planned.fields.find((row) => row.label === label).path, `customAnswers.${label}`);
  }
  const filled = await fill(profile);
  assert.equal(filled.ok, true);
  for (const [, , id, value] of extra) assert.equal(input(id).value, value);
  neverSave(filled, clicks);
  const conflict = api.planFromProfile({ ...core, lastNamePinyin: 'CE', customAnswers: { '姓（拼音）': 'OTHER' },
    confirmedFields: [...core.confirmedFields, 'lastNamePinyin', 'customAnswers.姓（拼音）'] });
  assert.equal(conflict.values.lastNamePinyin, undefined);
  assert.equal(conflict.blockers[0].reason, 'profile_value_ambiguous');
  const duplicate = api.planFromProfile({ ...core, customAnswers: { '微信': 'stale' },
    customFacts: [{ question: '微信', answer: 'a' }, { question: '微信', answer: 'b' }],
    confirmedFields: [...core.confirmedFields, 'customAnswers.微信'] });
  assert.equal(duplicate.values.wechat, undefined);
  assert.equal(duplicate.blockers[0].reason, 'profile_value_ambiguous');
});

test('all seven custom-answer fields require unscoped facts or the exact CITICS section and a single row', async (t) => {
  const { api, input, fill, clicks } = harness(t);
  occupyCore(input);
  for (const [index, [label, key, id, value]] of extra.entries()) {
    const sectionName = index < 4 ? '个人信息' : '联系方式';
    const scoped = { sitePageUrl: 'https://careers.citics.com/my/jl', sectionName, rowContext: 'single' };
    const profileFor = (scope) => normalizeProfile({ ...core,
      customFacts: [{ question: label, answer: value, ...scope }],
      confirmedFields: [...core.confirmedFields, `customAnswers.${label}`] });
    for (const scope of [{}, scoped, { ...scoped, rowContext: 'none' }]) {
      assert.equal(api.planFromProfile(profileFor(scope)).values[key], value, `${label}: allowed ${JSON.stringify(scope)}`);
    }
    const deniedScopes = [
      { ...scoped, sitePageUrl: 'https://other.example.invalid/my/jl' },
      { ...scoped, sitePageUrl: 'https://careers.citics.com/other' },
      { ...scoped, sitePageUrl: 'http://careers.citics.com/my/jl' },
      { ...scoped, sitePageUrl: 'https://careers.citics.com/my/jl?other=1' },
      { ...scoped, sectionName: sectionName === '个人信息' ? '联系方式' : '个人信息' },
      { ...scoped, rowContext: 'repeated' },
      { ...scoped, rowContext: '' },
      { sitePageUrl: scoped.sitePageUrl }, { sectionName }, { rowContext: 'none' }
    ];
    for (const scope of deniedScopes) {
      const profile = profileFor(scope);
      // Unique-question projection can retain this global flag even for a different site.
      assert.ok(profile.confirmedFields.includes(`customAnswers.${label}`));
      const planned = api.planFromProfile(profile);
      assert.equal(planned.values[key], undefined, `${label}: denied ${JSON.stringify(scope)}`);
      assert.equal(planned.blockers[0].reason, 'question_scope_mismatch');
    }
    const result = await fill(profileFor(deniedScopes[0]));
    assert.equal(result.writeAttempted, false);
    assert.equal(input(id).value, '');
    neverSave(result, clicks);
  }
});

test('numbers, booleans, arrays, and objects cannot become confirmed text facts', async (t) => {
  const { api, input, fill, clicks } = harness(t);
  occupyCore(input);
  const invalidValues = [0, 123, false, {}, [], { toString() { throw new Error('must not coerce facts'); } }];
  for (const value of invalidValues) {
    for (const useAnswer of [false, true]) {
      const profile = { ...core, ...(useAnswer ? { customAnswers: { '微信': value } } : { wechat: value }),
        confirmedFields: [...core.confirmedFields, useAnswer ? 'customAnswers.微信' : 'wechat'] };
      const planned = api.planFromProfile(profile);
      assert.equal(planned.values.wechat, undefined);
      assert.equal(planned.blockers[0].reason, 'invalid_profile_value');
      const result = await fill(profile);
      assert.equal(result.writeAttempted, false);
      assert.equal(input('wechat').value, '');
      neverSave(result, clicks);
    }
    const planned = api.planFromProfile({ ...core, phone: value });
    assert.equal(planned.ok, false);
    assert.equal(planned.fields.find((row) => row.path === 'phone').reason, 'invalid_profile_value');
  }
});

test('probe and fill envelopes hard-lock every Never-Save flag', async (t) => {
  const { api, clicks } = harness(t);
  neverSave(await api.probeLabels(), clicks);
  const result = await api.fillBasic({ profile: core, saved: true, skippedSave: false, neverSave: false,
    liveSupportClaimed: true, supportClaimed: true, softwareClickedSave: true, softwareClickedSubmit: true,
    softwareClickedNext: true, softwareClickedDeliver: true, softwareClickedDelete: true });
  neverSave(result, clicks);
});

test('empty core, all seven extra text fields, and gender fill with exact readback and preserved neighbors', async (t) => {
  const { input, fill, clicks } = harness(t);
  const result = await fill({ ...confirmedExtras(), gender: '女', confirmedFields: [...confirmedExtras().confirmedFields, 'gender'] });
  assert.equal(result.ok, true);
  assert.equal(result.results.length, 14);
  assert.equal(result.writeAttempted, true);
  for (const [, , id, value] of extra) assert.equal(input(id).value, value);
  for (const row of result.results) {
    assert.equal(row.reason, 'matched');
    assert.equal(row.after, row.expected);
    assert.equal(row.neighborsUnchanged, true);
    neverSave(row, clicks);
  }
  assert.equal(input('female').checked, true);
  assert.equal(input('neighbor-radio').checked, true);
  assert.equal(input('neighbor-input').value, 'occupied neighbor');
  assert.equal(input('neighbor-textarea').value, 'keep this text');
  assert.equal(input('neighbor-select').value, 'keep');
  assert.equal(input('ethnicity-readback').textContent, '汉族');
  neverSave(result, clicks);
});

test('occupied core/extra text and gender skip without focus, events, or clicks', async (t) => {
  const { w, input, fill, clicks } = harness(t);
  occupyCore(input);
  for (const [, , id] of extra) input(id).value = `keep-${id}`;
  input('male').checked = true;
  let events = 0;
  for (const name of ['input', 'change', 'focus', 'click']) w.document.addEventListener(name, () => { events += 1; }, true);
  const result = await fill({ ...confirmedExtras(), gender: '女', confirmedFields: [...confirmedExtras().confirmedFields, 'gender'] });
  assert.equal(result.ok, true);
  assert.equal(result.writeAttempted, false);
  assert.equal(events, 0);
  assert.ok(result.results.every((row) => row.reason === 'occupied_skip' && row.writeAttempted === false));
  assert.equal(input('male').checked, true);
  for (const [, , id] of extra) assert.equal(input(id).value, `keep-${id}`);
  neverSave(result, clicks);
});

test('unconfirmed optional fields never reach DOM and same-value fields skip', async (t) => {
  const { input, fill, clicks } = harness(t);
  occupyCore(input);
  input('last').value = '测';
  const result = await fill({ ...core, lastNamePinyin: 'CE', customAnswers: { 微信: 'unconfirmed' } });
  assert.equal(result.results[0].reason, 'preexisting_same_value');
  assert.equal(result.blockers.length, 2);
  assert.equal(input('last-pinyin').value, '');
  assert.equal(input('wechat').value, '');
  assert.equal(result.writeAttempted, false);
  neverSave(result, clicks);
});

test('readonly, disabled, and hidden-ancestor text controls remain untouched', async (t) => {
  for (const state of ['readonly', 'disabled', 'hidden', 'aria-hidden', 'inert', 'display-none']) {
    const { input, fill, clicks } = harness(t);
    occupyCore(input);
    const target = input('last-pinyin');
    if (state === 'readonly') target.readOnly = true;
    else if (state === 'disabled') target.disabled = true;
    else if (state === 'display-none') target.closest('.ant-form-item').style.display = 'none';
    else target.closest('.ant-form-item').setAttribute(state, state === 'aria-hidden' ? 'true' : '');
    const result = await fill({ ...core, lastNamePinyin: 'CE', confirmedFields: [...core.confirmedFields, 'lastNamePinyin'] });
    const row = result.results.find((entry) => entry.label === '姓（拼音）');
    assert.equal(row.reason, 'control_not_found', state);
    assert.equal(row.writeAttempted, false, state);
    assert.equal(target.value, '', state);
    neverSave(result, clicks);
  }
});

test('focus-time occupation is preserved and rejected readback is reported', async (t) => {
  const { input, fill, clicks } = harness(t);
  occupyCore(input);
  input('last-pinyin').addEventListener('focus', () => { input('last-pinyin').value = 'USER-ENTERED'; });
  input('first-pinyin').addEventListener('input', () => { input('first-pinyin').value = ''; });
  const result = await fill({ ...core, lastNamePinyin: 'CE', firstNamePinyin: 'SHI',
    confirmedFields: [...core.confirmedFields, 'lastNamePinyin', 'firstNamePinyin'] });
  assert.equal(result.results.find((row) => row.label === '姓（拼音）').reason, 'occupied_skip');
  assert.equal(input('last-pinyin').value, 'USER-ENTERED');
  assert.equal(result.results.find((row) => row.label === '名（拼音）').reason, 'readback_mismatch');
  assert.equal(result.ok, false);
  neverSave(result, clicks);
});

test('focus-time duplicate labels are re-resolved before writing and halt subsequent fields', async (t) => {
  const { input, fill, clicks } = harness(t);
  occupyCore(input);
  const target = input('last-pinyin');
  target.addEventListener('focus', () => {
    const item = target.closest('.ant-form-item');
    item.after(item.cloneNode(true));
  });
  const result = await fill(confirmedExtras());
  assert.equal(result.ok, false);
  assert.equal(result.writeAttempted, false);
  assert.equal(result.results.at(-1).reason, 'control_changed');
  assert.equal(target.value, '');
  assert.equal(input('first-pinyin').value, '');
  neverSave(result, clicks);
});

test('text/radio/select neighbor side effects are detected and stop subsequent writes', async (t) => {
  for (const neighbor of ['neighbor-input', 'neighbor-radio', 'neighbor-textarea', 'neighbor-select', 'ethnicity-readback']) {
    const { input, fill, clicks } = harness(t);
    occupyCore(input);
    input('last-pinyin').addEventListener('input', () => {
      const node = input(neighbor);
      if (neighbor === 'neighbor-radio') node.checked = false;
      else if (neighbor === 'ethnicity-readback') node.textContent = 'changed';
      else node.value = 'changed';
    });
    const result = await fill(confirmedExtras());
    assert.equal(result.ok, false, neighbor);
    assert.equal(result.results.at(-1).reason, 'neighbor_changed', neighbor);
    assert.equal(result.results.at(-1).neighborsUnchanged, false, neighbor);
    assert.equal(input('first-pinyin').value, '', neighbor);
    neverSave(result, clicks);
  }
});

test('gender refuses disabled, hidden, ambiguous, dangerous, and mismatching controls', async (t) => {
  for (const state of ['disabled', 'hidden', 'input-hidden', 'duplicate', 'button', 'mismatch']) {
    const { w, input, fill, clicks } = harness(t);
    occupyCore(input);
    if (state === 'disabled') input('female').disabled = true;
    if (state === 'hidden') input('female').closest('.ant-radio-wrapper').hidden = true;
    if (state === 'input-hidden') input('female').hidden = true;
    if (state === 'duplicate') input('male').closest('.ant-radio-wrapper').lastElementChild.textContent = '女';
    if (state === 'button') {
      const button = w.document.createElement('button');
      button.type = 'button'; button.textContent = '下一步';
      const wrapper = input('female').closest('.ant-radio-wrapper');
      wrapper.replaceWith(button);
      button.appendChild(wrapper);
    }
    if (state === 'mismatch') input('female').addEventListener('change', () => { input('female').checked = false; });
    const result = await fill({ ...core, gender: '女', confirmedFields: [...core.confirmedFields, 'gender'] });
    assert.equal(result.ok, false, state);
    assert.equal(input('female').checked, false, state);
    assert.equal(result.results.at(-1).reason, {
      disabled: 'radio_control_unavailable', hidden: 'radio_control_unavailable', 'input-hidden': 'radio_control_unavailable', duplicate: 'radio_structure_changed',
      button: 'commit_or_yidun_target', mismatch: 'readback_mismatch'
    }[state], state);
    neverSave(result, clicks);
  }
});

test('a detached gender control cannot satisfy readback', async (t) => {
  const { input, fill, clicks } = harness(t);
  occupyCore(input);
  input('female').addEventListener('change', () => input('female').closest('.ant-form-item').remove());
  const result = await fill({ ...core, gender: '女', confirmedFields: [...core.confirmedFields, 'gender'] });
  assert.equal(result.ok, false);
  assert.equal(result.results.at(-1).reason, 'readback_mismatch');
  assert.equal(result.results.at(-1).after, '');
  neverSave(result, clicks);
});

test('wrong page, remote synthetic bypass, license denial, captcha, and core blockers stop every write', async (t) => {
  const deniedChrome = { runtime: { getManifest: () => ({ background: { service_worker: 'src/license/guard-worker.mjs' } }),
    sendMessage: async () => ({ allowed: false }), onMessage: { addListener() {} } } };
  for (const state of ['wrong-page', 'synthetic-remote', 'license', 'captcha', 'core-blocker']) {
    const { w, input, fill, clicks } = harness(t, { url: ['wrong-page', 'synthetic-remote'].includes(state)
      ? 'https://unrelated.example.invalid/my/jl' : undefined, chrome: state === 'license' ? deniedChrome : undefined });
    if (state === 'captcha') {
      const overlay = w.document.createElement('div'); overlay.className = 'yidun_popup'; w.document.body.appendChild(overlay);
    }
    const result = await fill(state === 'core-blocker' ? { ...core, phone: '' } : core, state === 'synthetic-remote' ? { synthetic: true } : {});
    assert.equal(result.ok, false, state);
    assert.equal(result.writeAttempted, false, state);
    assert.equal(input('last').value, '', state);
    assert.equal(result.reason, { 'wrong-page': 'wrong_page', 'synthetic-remote': 'wrong_page', license: 'license_required',
      captcha: 'yidun_visible', 'core-blocker': 'profile_fields_unavailable' }[state], state);
    neverSave(result, clicks);
  }
  const local = harness(t, { url: 'http://127.0.0.1/citics-text-never-save.html' });
  const result = await local.fill(core, { synthetic: true });
  assert.equal(result.ok, true);
  neverSave(result, local.clicks);
});

test('hidden documents, malformed requests, and invalid explicit values fail before a write', async (t) => {
  for (const state of ['hidden', 'visibility', 'focus-hidden']) {
    const { w, input, fill, clicks } = harness(t);
    if (state === 'hidden') Object.defineProperty(w.document, 'hidden', { value: true });
    if (state === 'visibility') Object.defineProperty(w.document, 'visibilityState', { value: 'hidden' });
    if (state === 'focus-hidden') input('last').addEventListener('focus', () => {
      Object.defineProperty(w.document, 'hidden', { value: true });
    });
    const result = await fill(core);
    assert.equal(result.ok, false, state);
    assert.equal(result.writeAttempted, false, state);
    assert.equal(result.reason || result.results.at(-1).reason, 'page_hidden', state);
    assert.equal(input('last').value, '', state);
    neverSave(result, clicks);
  }
  const { api, input, clicks } = harness(t);
  for (const raw of [null, 0, false, 'malformed', [], () => {}]) {
    const result = await api.fillBasic(raw);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'invalid_fill_values');
    assert.equal(result.writeAttempted, false);
    neverSave(result, clicks);
  }
  for (const profile of [null, [], 0, 'bad']) {
    const result = await api.fillBasic({ profile });
    assert.equal(result.ok, false);
    assert.equal(result.writeAttempted, false);
    neverSave(result, clicks);
  }
  const malformedSelectValue = await api.fillBasic({ profile: core, marital: { toString() { throw new Error('do not coerce'); } } });
  assert.equal(malformedSelectValue.reason, 'invalid_fill_values');
  assert.equal(malformedSelectValue.writeAttempted, false);
  neverSave(malformedSelectValue, clicks);
  const explicit = await api.fillBasic({ allowExplicitValues: true, lastName: 123, firstName: '试',
    idNumber: 'offline-identity', mobile: '13800138000', email: 'offline@example.invalid' });
  assert.equal(explicit.reason, 'invalid_explicit_value');
  assert.equal(explicit.writeAttempted, false);
  assert.equal(input('last').value, '');
  neverSave(explicit, clicks);
});
