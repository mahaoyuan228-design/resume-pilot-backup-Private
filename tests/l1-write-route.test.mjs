import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { captureProfileBinding, assertProfileBinding, PROFILE_LOCK } from '../src/profile/profile-lifecycle.js';
import { createControlWriteBridge, CONTROL_WRITE_MESSAGE, CONTROL_VERIFY_MESSAGE, CONTROL_CANDIDATES_MESSAGE, CONTROL_WRITE_FLAG } from '../src/background/controls-write.mjs';

const root = new URL('../', import.meta.url);
const source = file => readFileSync(new URL(file, root), 'utf8');
const clone = value => value === undefined ? undefined : structuredClone(value);

async function harness({ enabled, html = '<form><label for="name">姓名</label><input id="name"></form>', paid = false,
  verifyBeforeFill, lockMissing = false } = {}) {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, { url: 'https://offline.example/resume', runScripts: 'outside-only', pretendToBeVisual: true });
  const window = dom.window, listeners = [], calls = [], locks = [];
  window.Element.prototype.getClientRects = () => [{ width: 20, height: 20 }];
  window.CSS = { escape: text => text.replace(/[^a-z0-9_-]/giu, char => `\\${char}`) };
  const data = { resumeProfile: { schemaVersion: 1, fullName: '离线姓名', confirmedFields: ['fullName'] },
    resumeProfileLifecycle: { version: 1, epoch: '00000000-0000-4000-8000-000000000001', state: 'ready' } };
  if (enabled !== undefined) data[CONTROL_WRITE_FLAG] = enabled;
  const storage = { get: async keys => Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, clone(data[key])])),
    set: async values => Object.assign(data, clone(values)) };
  const binding = await captureProfileBinding(storage), tab = { id: 7, active: true, url: window.location.href };
  const sender = { id: 'offline-extension', url: tab.url, tab: { ...tab }, frameId: 0 };
  const api = { storage: { local: storage }, tabs: { get: async () => ({ ...tab }) },
    runtime: { id: sender.id, getManifest: () => ({ background: { service_worker: paid ? 'src/license/guard-worker.mjs' : 'src/background/worker.mjs' } }) },
    scripting: { executeScript: async request => {
      calls.push(request);
      if (request.files) { for (const file of request.files) window.eval(source(file)); return [{ frameId: 0 }]; }
      const result = await window.eval(`(${request.func.toString()})`)(...clone(request.args));
      return [{ frameId: 0, result: clone(result) }];
    } } };
  const bridge = createControlWriteBridge({ api, verifyBeforeFill, lifecycleOptions: { locks: lockMissing ? {} : {
    request: async (name, options, work) => { locks.push({ name, options }); return work(); }
  } } });
  const invoke = (message, from = sender) => new Promise(resolve => bridge.listener(message, from, resolve));
  window.chrome = { runtime: { id: sender.id, onMessage: { addListener: listener => listeners.push(listener), hasListeners: () => listeners.length > 0,
    hasListener: listener => listeners.includes(listener), removeListener: listener => listeners.splice(listeners.indexOf(listener), 1) },
    sendMessage: async message => {
      if (message.type === 'RESUME_PROFILE_BINDING_CHECK') {
        try { await assertProfileBinding(storage, message.profileBinding); return { allowed: true }; } catch { return { allowed: false }; }
      }
      if ([CONTROL_WRITE_MESSAGE, CONTROL_VERIFY_MESSAGE, CONTROL_CANDIDATES_MESSAGE].includes(message.type)) return invoke(message);
      throw Error('unexpected_message');
    } }, storage: { local: storage } };
  window.eval(source('src/core/matcher.js'));
  window.eval(source('src/content/controls/resume-form.js'));
  window.eval(source('src/content/engine.js'));
  const run = async type => {
    const currentBinding = await captureProfileBinding(storage);
    return new Promise(resolve => listeners[0]({ type, profile: clone(data.resumeProfile), profileBinding: currentBinding }, { id: sender.id }, resolve));
  };
  const fill = () => run('RESUME_FILL'), inspect = () => run('RESUME_INSPECT');
  const request = () => ({ type: CONTROL_WRITE_MESSAGE, selector: '#name', path: 'fullName', value: data.resumeProfile.fullName,
    profileBinding: binding, timeOrigin: window.performance.timeOrigin });
  return { dom, window, data, calls, locks, sender, tab, binding, fill, inspect, invoke, request };
}

test('ordinary time discovery uses the existing confirmed-answer route only after opt-in', async t => {
  for (const enabled of [undefined, false, true]) {
    const h = await harness({ enabled, html: '<form><label for="arrival">到场时间</label><input id="arrival" type="time"><input id="neighbor" value="KEEP"><button type="submit">提交</button><button type="button">保存</button></form>' });
    t.after(() => h.dom.window.close());
    h.data.resumeProfile = { schemaVersion: 1, customAnswers: { 到场时间: '09:35' },
      customFacts: [{ question: '到场时间', answer: '09:35', sitePageUrl: h.tab.url,
        sectionName: 'form:single', rowContext: 'none' }], confirmedFields: ['customAnswers.到场时间'] };
    let forbidden = 0;
    for (const type of ['click', 'submit']) h.window.document.addEventListener(type, () => forbidden++);
    const before = await h.inspect();
    assert.equal(before.ok, true, JSON.stringify(before));
    assert.equal(h.window.document.getElementById('arrival').value, '');
    const result = await h.fill();
    assert.equal(result.ok, true, JSON.stringify(result));
    const writes = h.calls.filter(call => call.func?.name === 'writeControlInPage');
    if (enabled) {
      const row = result.data.fields.find(field => field.id === 'arrival');
      assert.equal(row.adapter, 'native-time', JSON.stringify(result));
      assert.equal(row.status, 'verified', JSON.stringify(result));
      assert.equal(row.currentValue, '09:35');
      assert.equal(h.window.document.getElementById('arrival').value, '09:35');
      assert.equal(writes.length, 1);
      assert.equal(result.data.liveSupportClaimed, false);
    } else assert.equal(writes.length, 0);
    assert.equal(h.window.document.getElementById('neighbor').value, 'KEEP');
    assert.equal(forbidden, 0);
  }
});

test('ordinary time batch readback catches a later field reverting the value without retry', async t => {
  const h = await harness({ enabled: true, html: '<form><label for="arrival">到场时间</label><input id="arrival" type="time"><label for="phone">手机号</label><input id="phone"></form>' });
  t.after(() => h.dom.window.close());
  h.data.resumeProfile = { schemaVersion: 1, phone: '13800138000', customAnswers: { 到场时间: '09:35' },
    customFacts: [{ question: '到场时间', answer: '09:35', sitePageUrl: h.tab.url,
      sectionName: 'form:single', rowContext: 'none' }], confirmedFields: ['phone', 'customAnswers.到场时间'] };
  const el = h.window.document.getElementById('arrival');
  let inputs = 0;
  el.addEventListener('input', () => inputs++);
  h.window.document.getElementById('phone').addEventListener('input', () => { el.value = ''; });
  const result = await h.fill(), row = result.data.fields.find(field => field.id === 'arrival');
  assert.equal(row.status, 'failed', JSON.stringify(result));
  assert.equal(row.adapterStatus, 'reverted');
  assert.equal(row.reason, 'readback_mismatch');
  assert.equal(inputs, 1);
  assert.equal(h.calls.filter(call => call.func?.name === 'writeControlInPage' && call.args[0].selector === '#arrival').length, 1);
});

test('ordinary masked phone discovery writes raw once and verifies formatted readback without saving', async t => {
  const h = await harness({ enabled: true, html: '<form><label for="phone">手机号</label><input id="phone" type="tel" data-mask="### #### ####"><input id="neighbor" value="KEEP"><button type="submit">提交</button><button type="button">保存</button></form>' });
  t.after(() => h.dom.window.close());
  h.data.resumeProfile = { schemaVersion: 1, phone: '13800138000', confirmedFields: ['phone'] };
  const el = h.window.document.getElementById('phone'), rawInputs = [];
  el.addEventListener('input', () => {
    rawInputs.push(el.value);
    el.value = el.value.replace(/^(\d{3})(\d{4})(\d{4})$/u, '$1 $2 $3');
  });
  let forbidden = 0;
  for (const type of ['click', 'submit']) h.window.document.addEventListener(type, () => forbidden++);
  const before = await h.inspect();
  assert.equal(before.ok, true, JSON.stringify(before));
  assert.deepEqual(rawInputs, []);
  const candidates = await h.invoke({ type: CONTROL_CANDIDATES_MESSAGE, timeOrigin: h.window.performance.timeOrigin });
  await Promise.resolve();
  assert.equal(candidates.ok, true, JSON.stringify(candidates));
  assert.ok(candidates.candidates.some(row => row.adapter === 'native-input-mask' && row.type === 'input-mask'));
  assert.equal(candidates.writeStarted, false);
  assert.equal(candidates.liveSupportClaimed, false);
  const result = await h.fill(), row = result.data.fields.find(field => field.id === 'phone');
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(row.status, 'verified', JSON.stringify(result));
  assert.equal(row.adapter, 'native-input-mask');
  assert.equal(row.adapterStatus, 'success');
  assert.equal(el.value, '138 0013 8000');
  assert.deepEqual(rawInputs, ['13800138000']);
  assert.equal(result.data.liveSupportClaimed, false);
  assert.equal(h.calls.filter(call => call.func?.name === 'writeControlInPage').length, 1);
  assert.equal(h.calls.filter(call => call.func?.name === 'verifyControlInPage').length, 1);
  const repeated = await h.fill(), repeatedRow = repeated.data.fields.find(field => field.id === 'phone');
  assert.equal(repeatedRow.status, 'verified', JSON.stringify(repeated));
  assert.equal(repeatedRow.reason, 'preexisting_same_value');
  assert.deepEqual(rawInputs, ['13800138000']);
  assert.equal(h.window.document.getElementById('neighbor').value, 'KEEP');
  assert.equal(forbidden, 0);
});

test('masked write bridge projects an individually confirmed custom-answer singleton array', async t => {
  const question = '备用掩码号码', answer = ['138 0013 8000'];
  const h = await harness({ enabled: true, html: `<form><label for="masked">${question}</label><input id="masked" type="tel" data-mask="### #### ####"><input id="neighbor" value="KEEP"><button type="submit">保存</button></form>` });
  t.after(() => h.dom.window.close());
  h.data.resumeProfile = { schemaVersion: 1, customAnswers: { [question]: answer },
    customFacts: [{ question, answer, sitePageUrl: h.tab.url, sectionName: 'form:single', rowContext: 'none' }],
    confirmedFields: [`customAnswers.${question}`] };
  const el = h.window.document.getElementById('masked'), rawInputs = [];
  el.addEventListener('input', () => {
    rawInputs.push(el.value);
    el.value = el.value.replace(/^(\d{3})(\d{4})(\d{4})$/u, '$1 $2 $3');
  });
  let forbidden = 0;
  for (const type of ['click', 'submit']) h.window.document.addEventListener(type, () => forbidden++);
  const request = { type: CONTROL_WRITE_MESSAGE, selector: '#masked', path: `customAnswers.${question}`, value: answer,
    profileBinding: await captureProfileBinding(h.window.chrome.storage.local), timeOrigin: h.window.performance.timeOrigin };
  const result = await h.invoke(request);
  await Promise.resolve();
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.status, 'success', JSON.stringify(result));
  assert.equal(result.adapter, 'native-input-mask');
  assert.equal(el.value, '138 0013 8000');
  assert.deepEqual(rawInputs, ['13800138000']);
  const write = h.calls.find(call => call.func?.name === 'writeControlInPage');
  assert.deepEqual(write.args[0].value, answer);
  assert.equal(result.liveSupportClaimed, false);
  const readback = await h.invoke({ ...request, type: CONTROL_VERIFY_MESSAGE, readbackId: result.readbackId });
  await Promise.resolve();
  assert.equal(readback.status, 'success', JSON.stringify(readback));
  assert.equal(readback.writeStarted, false);
  assert.equal(readback.liveSupportClaimed, false);
  assert.equal(h.calls.filter(call => call.func?.name === 'verifyControlInPage').length, 1);
  assert.equal(h.window.document.getElementById('neighbor').value, 'KEEP');
  assert.equal(forbidden, 0);
});

test('ordinary masked phone final batch readback catches a later reversion without replay', async t => {
  const h = await harness({ enabled: true, html: '<form><label for="phone">手机号</label><input id="phone" type="tel" data-mask="### #### ####"><label for="name">姓名</label><input id="name"><button type="submit">保存</button></form>' });
  t.after(() => h.dom.window.close());
  h.data.resumeProfile = { schemaVersion: 1, phone: '13800138000', fullName: '离线姓名', confirmedFields: ['phone', 'fullName'] };
  const el = h.window.document.getElementById('phone');
  let inputs = 0, forbidden = 0;
  el.addEventListener('input', () => { inputs++; el.value = el.value.replace(/^(\d{3})(\d{4})(\d{4})$/u, '$1 $2 $3'); });
  h.window.document.getElementById('name').addEventListener('input', () => { el.value = '139 0013 8000'; });
  for (const type of ['click', 'submit']) h.window.document.addEventListener(type, () => forbidden++);
  const result = await h.fill(), row = result.data.fields.find(field => field.id === 'phone');
  assert.equal(row.status, 'failed', JSON.stringify(result));
  assert.equal(row.adapterStatus, 'reverted');
  assert.equal(row.reason, 'readback_mismatch');
  assert.equal(inputs, 1);
  assert.equal(h.calls.filter(call => call.func?.name === 'writeControlInPage' && call.args[0].selector === '#phone').length, 1);
  assert.equal(result.data.liveSupportClaimed, false);
  assert.equal(forbidden, 0);
});

test('enabled masked discovery retains unsupported contracts on the manual L1 path without effects', async t => {
  for (const scenario of ['format', 'owner']) {
    const h = await harness({ enabled: true, html: `<form><label for="phone">手机号</label><input id="phone" type="tel" data-mask="${scenario === 'format' ? '###.####.####' : '### #### ####'}"><input id="neighbor" value="KEEP"><button type="submit">保存</button></form>` });
    t.after(() => h.dom.window.close());
    h.data.resumeProfile = { schemaVersion: 1, phone: '13800138000', confirmedFields: ['phone'] };
    const el = h.window.document.getElementById('phone');
    if (scenario === 'owner') el.__vue__ = { $el: el, $options: { name: 'UnreviewedMaskInput' }, $props: { value: '' } };
    let effects = 0;
    for (const type of ['input', 'change', 'blur', 'click', 'submit']) h.window.document.addEventListener(type, () => effects++, true);
    const candidates = await h.invoke({ type: CONTROL_CANDIDATES_MESSAGE, timeOrigin: h.window.performance.timeOrigin });
    await Promise.resolve();
    assert.equal(candidates.ok, true, JSON.stringify(candidates));
    const candidate = candidates.candidates.find(row => h.window.document.querySelector(row.selector) === el);
    assert.equal(candidate?.adapter, scenario === 'format' ? 'native-input-mask' : 'input-mask-unknown');
    assert.equal(candidate.type, 'input-mask');
    const result = await h.fill(), row = result.data.fields.find(field => field.id === 'phone');
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(row.status, 'skipped', JSON.stringify(result));
    assert.equal(row.adapterStatus, 'manual');
    assert.equal(row.reason, 'input_mask_contract_unconfirmed');
    assert.equal(row.adapter, candidate.adapter);
    assert.equal(result.data.liveSupportClaimed, false);
    assert.equal(el.value, '');
    assert.equal(h.window.document.getElementById('neighbor').value, 'KEEP');
    assert.equal(effects, 0);
  }
});

test('ordinary country-code and phone selects compare the selected option, preserving distinct labels and values', async t => {
  // Legacy selectedIndex writes are covered in Chromium: jsdom 26 leaves its
  // previously accessed selectedOptions collection stale after that setter.
  for (const [enabled, preselected] of [[true, false], [false, true], [true, true]]) {
    const h = await harness({ enabled, html: `<form>
      <label for="prefix">国家码</label><select id="prefix" autocomplete="tel-country-code">
        <option value="">请选择</option><option value="+86" ${preselected ? 'selected' : ''}>中国 (+86)</option><option value="+44">英国 (+44)</option>
      </select><label for="phone">手机号</label><select id="phone"><option value="">请选择</option>
        <option value="13800138000" ${preselected ? 'selected' : ''}>138 0013 8000</option></select>
      <input id="neighbor" value="KEEP"><button type="submit">提交</button><button type="button">保存</button>
    </form>` });
    t.after(() => h.dom.window.close());
    h.data.resumeProfile = { schemaVersion: 1, phone: '13800138000', customAnswers: { 国家码: '+86' },
      customFacts: [{ question: '国家码', answer: '+86', sitePageUrl: h.tab.url, sectionName: 'form:single', rowContext: 'none' }],
      confirmedFields: ['phone', 'customAnswers.国家码'] };
    let events = 0, clicks = 0;
    h.window.document.addEventListener('input', () => events++);
    h.window.document.addEventListener('click', () => clicks++);
    const before = await h.inspect();
    for (const id of ['prefix', 'phone']) assert.equal(before.data.fields.find(row => row.id === id).reason, 'ready', JSON.stringify(before));
    assert.equal(events, 0);
    const result = await h.fill();
    assert.equal(result.ok, true, JSON.stringify(result));
    for (const id of ['prefix', 'phone']) {
      const row = result.data.fields.find(field => field.id === id);
      assert.equal(row.status, 'verified', JSON.stringify(result));
      assert.equal(row.reason, preselected ? 'preexisting_same_value' : 'readback_matched');
      if (enabled) { assert.equal(row.adapter, 'native-select'); assert.equal(row.adapterStatus, 'success'); }
    }
    assert.equal(h.window.document.getElementById('prefix').value, '+86');
    assert.equal(h.window.document.getElementById('phone').value, '13800138000');
    assert.equal(h.window.document.getElementById('neighbor').value, 'KEEP');
    assert.equal(clicks, 0);
    if (preselected) assert.equal(events, 0);
  }
});

test('ordinary shared rows bind explicit labels only to their own value controls', async t => {
  for (const enabled of [false, true]) for (const itemClass of ['form-item', 'ant-form-item']) {
    const label = (id, text) => itemClass === 'ant-form-item'
      ? `<div class="ant-form-item-label"><label for="${id}">${text}</label></div>`
      : `<label for="${id}">${text}</label>`;
    const h = await harness({ enabled, html: `<form>
      <div class="${itemClass}">${label('phone', '手机号')}
        <select id="prefix"><option value="+86">中国 (+86)</option></select><input id="phone" type="tel"></div>
      <div class="${itemClass}">${label('birthday', '生日')}
        <select id="year"><option value="-1">----</option><option value="1996">1996年</option></select><input id="birthday"></div>
      <label for="owned-prefix">国家码</label><select id="owned-prefix"><option value="+86">中国 (+86)</option></select>
      <input id="neighbor" value="KEEP"><button type="submit">保存</button></form>` });
    t.after(() => h.dom.window.close());
    h.data.resumeProfile = { schemaVersion: 1, phone: '13800138000', birthDate: '1996-02-29',
      customAnswers: { 国家码: '+86' }, customFacts: [{ question: '国家码', answer: '+86',
        sitePageUrl: h.tab.url, sectionName: 'form:single', rowContext: 'none' }],
      confirmedFields: ['phone', 'birthDate', 'customAnswers.国家码'] };
    const effects = [];
    for (const type of ['input', 'change', 'blur', 'click', 'submit'])
      h.window.document.addEventListener(type, event => effects.push([type, event.target.id]), true);
    const before = await h.inspect();
    const filled = await h.fill();
    for (const result of [before, filled]) {
      assert.equal(result.ok, true, JSON.stringify(result));
      for (const id of ['prefix', 'year']) {
        const field = result.data.fields.find(row => row.id === id);
        assert.equal(field.path, undefined, JSON.stringify(field));
        assert.equal(field.semanticStatus, 'manual');
        assert.notEqual(field.status, 'verified');
      }
      assert.equal(result.data.fields.find(row => row.id === 'year').currentValue, '');
    }
    const after = await h.inspect();
    const unconfirmedFramework = enabled && itemClass === 'ant-form-item';
    for (const [id, path, value] of [['phone', 'phone', '13800138000'], ['birthday', 'birthDate', '1996-02-29']]) {
      assert.equal(before.data.fields.find(row => row.id === id).currentValue, '');
      assert.equal(after.data.fields.find(row => row.id === id).path, path);
      assert.equal(after.data.fields.find(row => row.id === id).currentValue, unconfirmedFramework ? '' : value);
      const field = filled.data.fields.find(row => row.id === id);
      assert.equal(field.status, unconfirmedFramework ? 'skipped' : 'verified');
      if (unconfirmedFramework) assert.equal(field.reason, 'control_or_version_unconfirmed');
      assert.equal(h.window.document.getElementById(id).value, unconfirmedFramework ? '' : value);
    }
    assert.equal(after.data.fields.find(row => row.id === 'owned-prefix').path, 'customAnswers.国家码');
    assert.equal(h.window.document.getElementById('prefix').value, '+86');
    assert.equal(h.window.document.getElementById('year').value, '-1');
    assert.equal(h.window.document.getElementById('neighbor').value, 'KEEP');
    assert.equal(effects.every(([type, id]) => ['input', 'change', 'blur'].includes(type) && ['phone', 'birthday'].includes(id)), true);
    if (unconfirmedFramework) assert.deepEqual(effects, [], 'class-only frameworks must not fall through to native writes');
  }
});

test('ordinary birthday part placeholders read empty while unbound parts remain manual', async t => {
  const h = await harness({ enabled: true, html: `<form><label for="year">年</label><select id="year"><option value="-1">年</option><option value="1996">1996</option></select>
    <label for="month">月</label><select id="month"><option value="0">月</option><option value="02">2</option></select>
    <label for="day">日</label><select id="day"><option value="日">日</option><option value="29">29</option></select>
    <label for="dash">年</label><select id="dash"><option value="-1">----</option><option value="1996">1996年</option></select>
    <label for="whole-birthday">生日</label><select id="whole-birthday"><option value="0">----</option><option value="1996">1996年</option></select>
    <label for="selected">年份</label><select id="selected"><option value="1996">1996</option></select>
    <label for="frequency">周期</label><select id="frequency"><option value="month">Month</option><option value="week">Week</option></select>
    <input id="neighbor" value="KEEP"></form>` });
  t.after(() => h.dom.window.close());
  h.data.resumeProfile = { schemaVersion: 1, birthDate: '1996-02-29', confirmedFields: ['birthDate'] };
  const previousListener = h.window.__resumeQuickFillEngineListener;
  h.window.__resumeQuickFillEngineRevision = 15;
  h.window.eval(source('src/content/engine.js'));
  assert.equal(h.window.__resumeQuickFillEngineRevision, 27);
  assert.notEqual(h.window.__resumeQuickFillEngineListener, previousListener);
  let events = 0;
  for (const type of ['input', 'change', 'click']) h.window.document.addEventListener(type, () => events++);
  for (const result of [await h.inspect(), await h.fill()]) {
    assert.equal(result.ok, true, JSON.stringify(result));
    for (const id of ['year', 'month', 'day', 'dash']) {
      const row = result.data.fields.find(field => field.id === id);
      assert.equal(row.currentValue, ''); assert.equal(row.semanticStatus, 'manual');
      assert.equal(row.path, undefined);
    }
    const wholeBirthday = result.data.fields.find(row => row.id === 'whole-birthday');
    assert.equal(wholeBirthday.currentValue, ''); assert.equal(wholeBirthday.path, 'birthDate');
    assert.equal(wholeBirthday.reason, 'option_not_found'); assert.equal(wholeBirthday.semanticStatus, 'manual');
    assert.notEqual(wholeBirthday.status, 'verified');
    assert.equal(result.data.fields.find(row => row.id === 'selected').currentValue, '1996');
    assert.equal(result.data.fields.find(row => row.id === 'frequency').currentValue, 'Month');
  }
  assert.equal(h.window.document.getElementById('year').value, '-1');
  assert.equal(h.window.document.getElementById('month').value, '0');
  assert.equal(h.window.document.getElementById('day').value, '日');
  assert.equal(h.window.document.getElementById('neighbor').value, 'KEEP');
  assert.equal(events, 0);
  assert.equal(h.calls.some(call => call.func?.name === 'writeControlInPage'), false);
});

test('ordinary RESUME_FILL keeps the absent/false flag on the existing write path', async t => {
  for (const enabled of [undefined, false, 'true']) {
    const h = await harness({ enabled }); t.after(() => h.dom.window.close());
    const result = await h.fill();
    assert.equal(result.ok, true);
    assert.equal(result.data.fields[0].status, 'verified');
    assert.equal(h.window.document.getElementById('name').value, '离线姓名');
    assert.equal(h.calls.length, 0);
  }
});

test('candidate detection skips a throwing component and captcha while retaining a healthy date', async t => {
  const h = await harness({ enabled: true, html: '<form><input id="broken"><div data-captcha><input type="date"></div><input id="healthy" type="date"></form>' });
  t.after(() => h.dom.window.close());
  Object.defineProperty(h.window.document.getElementById('broken'), '__vue__', { get() { throw Error('unreadable_component'); } });
  let effects = 0;
  for (const type of ['click', 'input', 'change']) h.window.document.addEventListener(type, () => effects++);
  const result = await h.invoke({ type: CONTROL_CANDIDATES_MESSAGE, timeOrigin: h.window.performance.timeOrigin });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.writeStarted, false);
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].adapter, 'native-date');
  assert.equal(h.window.document.querySelector(result.candidates[0].selector).id, 'healthy');
  assert.equal(effects, 0);
});

test('ordinary RESUME_FILL opt-in executes the actual MAIN registry plan/write/dual verify under the profile lock', async t => {
  const h = await harness({ enabled: true }); t.after(() => h.dom.window.close());
  const result = await h.fill(), row = result.data.fields[0];
  assert.equal(result.ok, true);
  assert.equal(row.status, 'verified');
  assert.equal(row.adapter, 'native-text');
  assert.equal(row.adapterStatus, 'success');
  assert.equal(row.reason, 'readback_matched');
  assert.equal(h.window.document.getElementById('name').value, '离线姓名');
  assert.equal(h.calls.length, 5);
  assert.equal(h.calls[3].func.name, 'writeControlInPage');
  assert.equal(h.calls[3].world, 'MAIN');
  assert.deepEqual(h.calls[3].target, { tabId: 7, frameIds: [0] });
  assert.equal(h.calls[4].func.name, 'verifyControlInPage');
  assert.equal(h.calls[4].files, undefined, 'readback must retain the original MAIN plan');
  assert.equal(h.locks[0].name, PROFILE_LOCK);
  assert.equal(h.locks[0].options.mode, 'exclusive');
});

test('ordinary opt-in route discovers generic native and My97 dates and uses the confirmed fact unchanged', async t => {
  for (const [attributes, value, adapter, display] of [
    ['type="date"', '2024-02-29', 'native-date', '2024-02-29'],
    ['type="month"', '2024-02', 'native-month', '2024-02'],
    ['class="Wdate" onfocus="WdatePicker({dateFmt:\'yyyy-MM-dd\'})"', '2024-02-29', 'my97-date', '2024-02-29'],
  ]) {
    const h = await harness({ enabled: true, html: `<form><label for="date">出生日期</label><input id="date" ${attributes}></form>` });
    t.after(() => h.dom.window.close());
    h.data.resumeProfile = { schemaVersion: 1, birthDate: value, confirmedFields: ['birthDate'] };
    let pickerCalls = 0;
    h.window.WdatePicker = () => { pickerCalls++; };
    const result = await h.fill(), row = result.data.fields[0];
    assert.equal(row.adapter, adapter, JSON.stringify(result));
    assert.equal(row.status, 'verified', JSON.stringify(result));
    assert.equal(row.adapterStatus, 'success');
    assert.equal(h.window.document.getElementById('date').value, display);
    assert.equal(pickerCalls, 0);
    const write = h.calls.find(call => call.func?.name === 'writeControlInPage');
    assert.equal(write.args[0].value, value);
    assert.equal(h.calls.some(call => call.func?.name === 'readControlCandidatesInPage'), true);
  }
});

test('ordinary opt-in route leaves unknown My97 configuration manual without legacy fallback', async t => {
  const h = await harness({ enabled: true,
    html: '<form><label for="date">出生日期</label><input id="date" class="Wdate" onfocus="WdatePicker({dateFmt:dynamicFormat})"></form>' });
  t.after(() => h.dom.window.close());
  h.window.WdatePicker = () => { throw Error('picker_must_not_run'); };
  h.data.resumeProfile = { schemaVersion: 1, birthDate: '2024-02-29', confirmedFields: ['birthDate'] };
  let events = 0;
  h.window.document.getElementById('date').addEventListener('input', () => events++);
  const result = await h.fill(), row = result.data.fields[0];
  assert.equal(row.adapter, 'date-unknown', JSON.stringify(result));
  assert.equal(row.adapterStatus, 'manual', JSON.stringify(result));
  assert.equal(h.window.document.getElementById('date').value, '');
  assert.equal(events, 0);
});

test('unassociated row labels and nested labels cannot bind multiple editors', async t => {
  const editors = '<select id="prefix"><option value="+86">China (+86)</option></select><input id="phone" type="tel">';
  for (const enabled of [false, true]) for (const html of [
    `<div class="form-item"><label>手机号</label>${editors}</div>`, `<label>手机号${editors}</label>`,
  ]) {
    const h = await harness({ enabled, html: `<form>${html}</form>` });
    t.after(() => h.dom.window.close());
    h.data.resumeProfile = { schemaVersion: 1, phone: '13800138000', confirmedFields: ['phone'] };
    const effects = [];
    for (const type of ['input', 'change', 'blur', 'click', 'submit'])
      h.window.document.addEventListener(type, event => effects.push(type), true);
    for (const result of [await h.inspect(), await h.fill()]) for (const field of result.data.fields) {
      assert.equal(field.path, undefined, JSON.stringify(field));
      assert.equal(field.semanticStatus, 'manual');
      assert.notEqual(field.status, 'verified');
    }
    assert.equal(h.window.document.getElementById('prefix').value, '+86');
    assert.equal(h.window.document.getElementById('phone').value, '');
    assert.deepEqual(effects, []);
  }
});

test('enabled route fails closed without falling back to the legacy native setter', async t => {
  const h = await harness({ enabled: true, html: '<form><div class="phoenix-select"><label for="name">姓名</label><input id="name"></div></form>' });
  t.after(() => h.dom.window.close());
  let inputs = 0; h.window.document.getElementById('name').addEventListener('input', () => { inputs++; });
  const result = await h.fill(), row = result.data.fields[0];
  assert.equal(row.adapterStatus, 'manual');
  assert.equal(row.status, 'skipped');
  assert.equal(row.reason, 'control_or_version_unconfirmed');
  assert.equal(h.window.document.getElementById('name').value, '');
  assert.equal(inputs, 0);
});

test('background route refuses default-off, stale binding, unconfirmed facts, changed fact and missing lifecycle lock before effects', async t => {
  for (const scenario of ['off', 'binding', 'unconfirmed', 'fact', 'lock']) {
    const h = await harness({ enabled: scenario !== 'off', lockMissing: scenario === 'lock' }); t.after(() => h.dom.window.close());
    const request = h.request();
    if (scenario === 'binding') h.data.resumeProfile.fullName = '其他客户';
    if (scenario === 'unconfirmed') { h.data.resumeProfile.confirmedFields = []; request.profileBinding = await captureProfileBinding({ get: async keys => Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, clone(h.data[key])])) }); }
    if (scenario === 'fact') request.value = '未经绑定的事实';
    const result = await h.invoke(request);
    assert.equal(result.ok, false, scenario);
    assert.equal(result.writeStarted, false, scenario);
    assert.equal(h.calls.length, 0, scenario);
    assert.equal(h.window.document.getElementById('name').value, '', scenario);
  }
});

test('sender, frame, active tab and paid authorization are checked independently', async t => {
  const h = await harness({ enabled: true }); t.after(() => h.dom.window.close());
  for (const changes of [{ id: 'stranger' }, { frameId: 1 }, { url: 'https://other.example/' }]) {
    assert.equal((await h.invoke(h.request(), { ...h.sender, ...changes })).reason, 'control_wrong_sender');
  }
  h.tab.active = false;
  assert.equal((await h.invoke(h.request())).reason, 'control_tab_changed');
  assert.equal(h.calls.length, 0);
  const paid = await harness({ enabled: true, paid: true }); t.after(() => paid.dom.window.close());
  assert.equal((await paid.invoke(paid.request())).reason, 'license_required');
  assert.equal(paid.calls.length, 0);
});

test('MAIN refuses a changed document or hidden page before the first registry effect', async t => {
  for (const kind of ['document', 'hidden']) {
    const h = await harness({ enabled: true }); t.after(() => h.dom.window.close());
    const request = h.request();
    if (kind === 'document') request.timeOrigin++;
    else Object.defineProperty(h.window.document, 'visibilityState', { configurable: true, value: 'hidden' });
    const result = await h.invoke(request);
    assert.equal(result.status, 'unsupported');
    assert.equal(result.writeStarted, false);
    assert.equal(h.window.document.getElementById('name').value, '');
  }
});

test('the real route rejects a post-write reversion and never retries via the old writer', async t => {
  const h = await harness({ enabled: true }); t.after(() => h.dom.window.close());
  const input = h.window.document.getElementById('name');
  let inputs = 0;
  input.addEventListener('input', () => {
    inputs++;
    h.window.setTimeout(() => { input.value = ''; }, 15);
  });
  const result = await h.fill(), row = result.data.fields[0];
  assert.equal(row.status, 'failed');
  // A busy runner can observe the change before the first sample (mismatch)
  // or between the two samples (reverted); neither permits another write.
  assert.ok(['mismatch', 'reverted'].includes(row.adapterStatus));
  assert.equal(row.reason, 'readback_mismatch');
  assert.equal(input.value, '');
  assert.equal(inputs, 1);
});

test('each MAIN effect rechecks adapter identity before a later synthetic event', async t => {
  const h = await harness({ enabled: true }); t.after(() => h.dom.window.close());
  const input = h.window.document.getElementById('name');
  const events = [];
  input.addEventListener('input', () => { events.push('input'); input.parentElement.className = 'phoenix-select'; });
  input.addEventListener('change', () => { events.push('change'); });
  input.addEventListener('blur', () => { events.push('blur'); });
  const result = await h.fill(), row = result.data.fields[0];
  assert.equal(row.status, 'failed');
  assert.equal(row.adapterStatus, 'unsupported');
  assert.equal(row.reason, 'control_adapter_changed');
  assert.deepEqual(events, ['input']);
});

function syntheticUdSelect(h, { version = 'fixture-contract-1', readonly = false } = {}) {
  const w = h.window, input = w.document.getElementById('name');
  input.type = 'search'; input.readOnly = true;
  input.setAttribute('role', 'combobox'); input.setAttribute('aria-controls', 'ud-name-options');
  const portal = w.document.createElement('div'); portal.id = 'ud-name-options'; portal.hidden = true; portal.setAttribute('role', 'listbox');
  const option = w.document.createElement('div'); option.setAttribute('role', 'option'); option.textContent = '离线姓名'; portal.append(option); w.document.body.append(portal);
  const props = { value: '', readonly, options: [{ value: 'name-code', label: '离线姓名' }] };
  const component = { displayName: 'UdSelect', library: { name: 'ud', version } };
  w.UD = { version };
  const owner = { type: component, memoizedProps: props, return: null };
  const host = { type: 'input', stateNode: input, memoizedProps: { value: '' }, return: owner };
  owner.child = host;
  input.__reactFiber$fixture = host;
  input.addEventListener('click', () => { portal.hidden = false; });
  option.addEventListener('click', () => { props.value = 'name-code'; input.value = '离线姓名'; portal.hidden = true; });
  return { input, props, portal };
}

test('batch readback rejects a later field changing either endpoint, options or owner without another write', async t => {
  for (const scenario of ['model', 'display', 'both', 'options', 'owner', 'preexisting-model']) {
    const h = await harness({ enabled: true, html: '<form><label for="name">姓名</label><input id="name"><label for="phone">手机号</label><input id="phone"><input id="neighbor" value="KEEP"></form>' });
    t.after(() => h.dom.window.close());
    h.data.resumeProfile.phone = '13800138000'; h.data.resumeProfile.confirmedFields.push('phone');
    const f = syntheticUdSelect(h);
    if (scenario === 'preexisting-model') { f.props.value = 'name-code'; f.input.value = '离线姓名'; }
    let selections = 0;
    f.portal.firstElementChild.addEventListener('click', () => { selections++; });
    h.window.document.getElementById('phone').addEventListener('input', () => {
      if (['model', 'both', 'preexisting-model'].includes(scenario)) f.props.value = '';
      if (['display', 'both'].includes(scenario)) f.input.value = '';
      if (scenario === 'options') {
        f.props.options = [{ value: 'remapped-code', label: '离线姓名' }];
        f.props.value = 'remapped-code';
      }
      if (scenario === 'owner') {
        const host = f.input.__reactFiber$fixture;
        host.return = { ...host.return, type: { ...host.return.type }, memoizedProps: { ...f.props } };
      }
    });
    const result = await h.fill(), name = result.data.fields.find(row => row.id === 'name');
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(name.status, 'failed', `${scenario}: ${JSON.stringify(result)}`);
    assert.notEqual(name.adapterStatus, 'success', scenario);
    assert.equal(result.data.fields.find(row => row.id === 'phone').status, 'verified');
    assert.equal(selections, scenario === 'preexisting-model' ? 0 : 1, `${scenario}: never repeat the selection after readback failure`);
    assert.equal(h.calls.filter(call => call.func?.name === 'writeControlInPage' && call.args[0].selector === '#name').length, 1);
    assert.equal(h.window.document.getElementById('neighbor').value, 'KEEP');
    assert.equal(f.portal.hidden, true);
  }
});

test('the engine rejects a missing write receipt or an unacknowledged success status in final readback', async t => {
  for (const scenario of ['missing-receipt', 'unacknowledged-status', 'write-started']) {
    const h = await harness({ enabled: true }); t.after(() => h.dom.window.close());
    const sendMessage = h.window.chrome.runtime.sendMessage;
    h.window.chrome.runtime.sendMessage = async message => {
      const response = await sendMessage(message);
      if (scenario === 'missing-receipt' && message.type === CONTROL_WRITE_MESSAGE) delete response.readbackId;
      if (message.type === CONTROL_VERIFY_MESSAGE) {
        if (scenario === 'unacknowledged-status') return { ...response, status: 'success', ok: false };
        if (scenario === 'write-started') return { ...response, status: 'success', writeStarted: true };
      }
      return response;
    };
    const result = await h.fill(), field = result.data.fields[0];
    assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(field.status, 'failed', scenario);
    assert.equal(h.window.document.getElementById('name').value, '离线姓名');
    assert.equal(h.calls.filter(call => call.func?.name === 'writeControlInPage').length, 1);
  }
});

test('readback consumes its receipt once and never emits an input, change or click', async t => {
  const h = await harness({ enabled: true }); t.after(() => h.dom.window.close());
  const written = await h.invoke(h.request());
  await Promise.resolve(); // Model the browser's asynchronous response delivery.
  assert.equal(written.status, 'success'); assert.equal(typeof written.readbackId, 'string');
  let effects = 0;
  for (const event of ['input', 'change', 'blur', 'click', 'submit']) h.window.document.addEventListener(event, () => { effects++; });
  const request = { ...h.request(), type: CONTROL_VERIFY_MESSAGE, readbackId: written.readbackId };
  const verified = await h.invoke(request);
  await Promise.resolve();
  assert.equal(verified.ok, true); assert.equal(verified.status, 'success');
  assert.equal(verified.writeStarted, false); assert.equal(verified.liveSupportClaimed, false);
  const replay = await h.invoke(request);
  assert.notEqual(replay.status, 'success'); assert.equal(replay.writeStarted, false);
  assert.equal(effects, 0); assert.equal(h.window.document.getElementById('name').value, '离线姓名');
  assert.equal(h.calls.filter(call => call.func?.name === 'writeControlInPage').length, 1);
});

test('missing, mismatched, expired and obsolete-document readback receipts fail closed without effects', async t => {
  for (const scenario of ['missing', 'selector', 'value', 'path', 'expired', 'document', 'detached']) {
    const h = await harness({ enabled: true }); t.after(() => h.dom.window.close());
    const written = await h.invoke(h.request());
    await Promise.resolve();
    assert.equal(written.status, 'success');
    const request = { ...h.request(), type: CONTROL_VERIFY_MESSAGE, readbackId: written.readbackId };
    if (scenario === 'missing') delete request.readbackId;
    if (scenario === 'selector') request.selector = 'input';
    if (scenario === 'value') request.value = 'other';
    if (scenario === 'path') request.path = 'phone';
    if (scenario === 'expired') {
      const now = h.window.performance.now(); Object.defineProperty(h.window.performance, 'now', { value: () => now + 10 * 60 * 1000 });
    }
    if (scenario === 'document') request.timeOrigin++;
    if (scenario === 'detached') h.window.document.getElementById('name').replaceWith(h.window.document.getElementById('name').cloneNode());
    let effects = 0;
    for (const event of ['input', 'change', 'blur', 'click', 'submit']) h.window.document.addEventListener(event, () => { effects++; });
    const result = await h.invoke(request);
    assert.notEqual(result.status, 'success', `${scenario}: ${JSON.stringify(result)}`);
    assert.equal(result.writeStarted, false, scenario); assert.equal(result.liveSupportClaimed, false, scenario);
    assert.equal(effects, 0, scenario);
    assert.equal(h.calls.filter(call => call.func?.name === 'writeControlInPage').length, 1, scenario);
  }
});

test('ordinary RESUME_FILL reaches an input-backed ud-select only with the opt-in and confirmed writable model', async t => {
  for (const scenario of ['enabled', 'off', 'version', 'readonly']) {
    const h = await harness({ enabled: scenario !== 'off' }); t.after(() => h.dom.window.close());
    const f = syntheticUdSelect(h, { version: scenario === 'version' ? 'unknown-2' : 'fixture-contract-1', readonly: scenario === 'readonly' });
    const result = await h.fill();
    assert.equal(result.ok, true, JSON.stringify(result));
    if (scenario === 'enabled') {
      assert.equal(result.data.fields[0].adapter, 'ud-select');
      assert.equal(result.data.fields[0].adapterStatus, 'success');
      assert.equal(f.input.value, '离线姓名');
      assert.equal(f.props.value, 'name-code');
    } else {
      if (result.data.formReadiness.status !== 'ready')
        assert.equal(result.data.advisoryHints[0].blocking, false);
      assert.ok(result.data.fields.every(field => field.status !== 'verified'));
      assert.equal(h.calls.filter(call => call.func?.name === 'writeControlInPage').length, 0);
      assert.equal(f.input.value, '', scenario);
      assert.equal(f.props.value, '', scenario);
    }
    assert.equal(f.portal.hidden, true, scenario);
  }
});

test('manual editor opening refreshes MAIN candidates before filling an opt-in widget', async t => {
  const h = await harness({ enabled: true,
    html: '<header><input type="search" value="KEEP_HEADER"></header><section><p>简历摘要</p><button type="button">编辑简历</button></section>' });
  t.after(() => h.dom.window.close());
  h.window.eval(source('src/content/controls/resume-form.js'));
  let edits = 0, widget;
  const openEditor = () => {
    edits++;
    h.window.document.querySelector('section').innerHTML = '<form><label for="name">姓名</label><input id="name"></form>';
    widget = syntheticUdSelect(h);
  };
  h.window.document.querySelector('button').addEventListener('click', openEditor);
  const scanned = await h.fill();
  assert.equal(scanned.ok, true);
  assert.equal(scanned.data.formReadiness.status, 'manual');
  assert.equal(scanned.data.advisoryHints[0].blocking, false);
  assert.equal(h.calls.filter(call => call.func?.name === 'writeControlInPage').length, 0);
  assert.equal(edits, 0);
  assert.equal(widget, undefined);
  // Model the user's independent editor opening, then issue a fresh fill.
  openEditor();
  const result = await h.fill();
  assert.equal(result.ok, true, JSON.stringify(result));
  const row = result.data.fields.find(field => field.path === 'fullName');
  assert.equal(edits, 1);
  assert.equal(row.adapter, 'ud-select');
  assert.equal(row.adapterStatus, 'success');
  assert.equal(widget.input.value, '离线姓名');
  assert.equal(widget.props.value, 'name-code');
  assert.equal(widget.portal.hidden, true);
  assert.equal(h.window.document.querySelector('header input').value, 'KEEP_HEADER');
  assert.ok(h.calls.filter(call => call.func?.name === 'readControlCandidatesInPage').length >= 2);
});

test('ATS runner API scans the current document through the same bound generic writer', async t => {
  const h = await harness({ enabled: false, html: '<div role="alert">Please sign in to continue</div>'
    + '<form><label>姓名<input id="name"></label><label>邮箱<input id="mail"></label>'
    + '<label>未知字段<input id="unknown"></label><button type="button">新建简历</button><button>保存</button></form>' });
  t.after(() => h.window.close());
  h.data.resumeProfile.email = 'offline@example.test';
  h.data.resumeProfile.confirmedFields.push('email');
  const binding = await captureProfileBinding(h.window.chrome.storage.local);
  let clicks = 0;
  h.window.document.addEventListener('click', () => clicks++);
  const result = await h.window.ResumeQuickFillFillCurrentPage(clone(h.data.resumeProfile), binding);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.advisoryHints[0].status, 'login_required');
  for (const id of ['name', 'mail']) {
    const field = result.fields.find(row => row.id === id);
    assert.equal(field.status, 'verified');
    assert.equal(field.beforeValue, '');
    assert.equal(field.currentValue, h.window.document.getElementById(id).value);
  }
  assert.equal(result.fields.find(row => row.id === 'unknown').semanticStatus, 'manual');
  assert.equal(result.writeAttempted, true);
  assert.equal(result.skippedSave, true);
  assert.equal(result.saved, false);
  assert.equal(result.softwareClickedSave, false);
  assert.equal(result.softwareClickedSubmit, false);
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(clicks, 0);
});

for (const [name, evidence, status] of [
  ['login hint', '<div role="alert">Please sign in to continue</div>', 'login_required'],
  ['empty required region', '<div aria-required="true"></div>', 'form_not_ready'],
  ['unknown required widget', '<div role="combobox" aria-label="未知字段" aria-required="true"></div>', 'manual'],
]) test(`opt-in MAIN write and dual readback continue despite ${name}`, async t => {
  const h = await harness({ enabled: true, html: `${evidence}<form><label for="name">姓名</label><input id="name">`
    + '<label>未知字段<input id="unknown"></label><button type="button">编辑简历</button>'
    + '<button type="button">新建简历</button><button>保存</button><button>提交</button></form>' });
  t.after(() => h.window.close());
  let clicks = 0;
  h.window.document.addEventListener('click', () => clicks++);
  const before = await h.inspect();
  assert.equal(before.data.formReadiness.status, status);
  const result = await h.fill();
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.data.advisoryHints[0].status, status);
  const field = result.data.fields.find(row => row.id === 'name');
  assert.equal(field.status, 'verified');
  assert.equal(field.beforeValue, '');
  assert.equal(field.currentValue, '离线姓名');
  assert.equal(h.window.document.getElementById('name').value, '离线姓名');
  assert.equal(result.data.fields.find(row => row.id === 'unknown').semanticStatus, 'manual');
  assert.equal(h.calls.filter(call => call.func?.name === 'writeControlInPage').length, 1);
  assert.equal(h.calls.filter(call => call.func?.name === 'verifyControlInPage').length, 1);
  assert.equal(clicks, 0);
  assert.equal(result.data.liveSupportClaimed, false);
});

test('intent arrays project only individually confirmed entries into the opt-in route', async t => {
  for (const key of ['desiredRoles', 'desiredCities']) {
    const h = await harness({ enabled: true, html: `<form><label for="intent">${key === 'desiredRoles' ? '意向岗位' : '意向城市'}</label><select id="intent"><option value="">请选择</option><option value="confirmed-code">已确认选项</option><option value="private-code">未确认选项</option></select></form>` });
    t.after(() => h.dom.window.close());
    h.data.resumeProfile = { schemaVersion: 1, [key]: ['未确认选项', '已确认选项'], confirmedFields: [`${key}.1`] };
    const result = await h.fill(), field = result.data.fields[0];
    assert.equal(field.status, 'verified', JSON.stringify(result));
    assert.equal(field.adapter, 'native-select');
    assert.equal(h.window.document.getElementById('intent').value, 'confirmed-code');
    const write = h.calls.find(call => call.func?.name === 'writeControlInPage');
    assert.deepEqual(write.args[0].value, ['已确认选项']);
  }
});

test('ordinary textarea routes retain line breaks, spaces and terminal blank lines', async t => {
  const value = '第一行  内容\r\n第二行\r\n\r\n';
  for (const component of ['native', 'ElInput', 'ATextarea']) {
    const h = await harness({ enabled: true, html: '<form><label for="prose">自我评价</label><textarea id="prose"></textarea><input id="neighbor" value="KEEP"></form>' });
    t.after(() => h.dom.window.close());
    h.data.resumeProfile = { schemaVersion: 1, selfEvaluation: value, confirmedFields: ['selfEvaluation'] };
    const el = h.window.document.getElementById('prose');
    let props;
    if (component !== 'native') {
      const lib = component === 'ElInput' ? 'ELEMENT' : 'antd';
      h.window[lib] = { version: component === 'ElInput' ? '2.15.14' : '1.7.8' };
      props = { value: '', type: 'textarea' };
      el.__vue__ = { $el: el, $options: { name: component }, $props: props };
      el.addEventListener('input', () => { props.value = el.value; });
    }
    const result = await h.fill(), row = result.data.fields.find(field => field.id === 'prose');
    assert.equal(row.status, 'verified', JSON.stringify(result));
    assert.equal(row.adapter, component === 'native' ? 'native-textarea' : component === 'ElInput' ? 'el-textarea' : 'antdv1-textarea');
    assert.equal(el.value, value.replace(/\r\n?/gu, '\n'));
    assert.equal(row.currentValue, el.value);
    if (props) assert.equal(props.value, el.value);
    assert.equal(h.window.document.getElementById('neighbor').value, 'KEEP');
    assert.equal(result.data.liveSupportClaimed, false);
    assert.equal(h.calls.filter(call => call.func?.name === 'writeControlInPage').length, 1);
  }
});

test('ordinary richtext discovery requires opt-in and preserves plain prose without HTML interpretation', async t => {
  const value = '<b>保留文字</b>  第一行\n第二行\n\n';
  for (const enabled of [undefined, false, true]) for (const label of ['for', 'aria']) {
    const h = await harness({ enabled, html: `<form>${label === 'for' ? '<label for="prose">自我评价</label>' : ''}<div id="prose" contenteditable="true"${label === 'aria' ? ' aria-label="自我评价"' : ''}></div><input id="neighbor" value="KEEP"><button type="submit">提交</button><button type="button">保存</button></form>` });
    t.after(() => h.dom.window.close());
    h.data.resumeProfile = { schemaVersion: 1, selfEvaluation: value, confirmedFields: ['selfEvaluation'] };
    let forbidden = 0;
    for (const type of ['click', 'submit']) h.window.document.addEventListener(type, () => forbidden++);
    const result = await h.fill(), el = h.window.document.getElementById('prose');
    assert.equal(result.ok, true, JSON.stringify(result));
    if (enabled) {
      const row = result.data.fields.find(field => field.id === 'prose');
      assert.equal(row.status, 'verified', JSON.stringify(result));
      assert.equal(row.adapter, 'native-richtext');
      assert.equal(row.currentValue, value);
      assert.equal(h.window.ResumeControls.helpers.richtextValue(el), value);
      assert.equal(el.querySelectorAll('br').length, value.split('\n').length - 1);
      assert.equal(el.firstChild.nodeType, h.window.Node.TEXT_NODE);
      assert.equal(result.data.liveSupportClaimed, false);
      assert.equal(h.calls.filter(call => call.func?.name === 'writeControlInPage').length, 1);
    } else {
      assert.equal(el.textContent, '');
      assert.equal(h.calls.filter(call => call.func?.name === 'writeControlInPage').length, 0);
    }
    assert.equal(h.window.document.getElementById('neighbor').value, 'KEEP');
    assert.equal(forbidden, 0);
  }
});

test('ordinary prose existing-value checks distinguish flattened lines and preserve formatted richtext', async t => {
  for (const html of ['<textarea id="prose">第一行 第二行</textarea>',
    '<div id="prose" contenteditable="true"><p>第一行</p><p>第二行</p></div>']) {
    const richtext = html.includes('contenteditable');
    const h = await harness({ enabled: true, html: `<form><label for="prose">自我评价</label>${html}</form>` });
    t.after(() => h.dom.window.close());
    h.data.resumeProfile = { schemaVersion: 1, selfEvaluation: '第一行\n第二行', confirmedFields: ['selfEvaluation'] };
    const el = h.window.document.getElementById('prose'), before = el.innerHTML;
    let effects = 0;
    for (const type of ['input', 'change', 'blur']) el.addEventListener(type, () => effects++);
    const result = await h.fill(), row = result.data.fields.find(field => field.id === 'prose');
    assert.equal(row.reason, richtext ? 'preexisting_same_value' : 'existing_value', JSON.stringify(result));
    assert.equal(row.status, richtext ? 'verified' : 'skipped', JSON.stringify(result));
    assert.equal(el.innerHTML, before);
    assert.equal(effects, 0);
  }
});

test('ordinary richtext final readback detects a later line flattening without retry', async t => {
  const h = await harness({ enabled: true, html: '<form><div id="prose" contenteditable="true" aria-label="自我评价"></div><label for="phone">手机号</label><input id="phone"></form>' });
  t.after(() => h.dom.window.close());
  h.data.resumeProfile = { schemaVersion: 1, selfEvaluation: '第一行\n第二行', phone: '13800138000', confirmedFields: ['selfEvaluation', 'phone'] };
  const el = h.window.document.getElementById('prose');
  let inputs = 0;
  el.addEventListener('input', () => inputs++);
  h.window.document.getElementById('phone').addEventListener('input', () => { el.textContent = '第一行 第二行'; });
  const result = await h.fill(), row = result.data.fields.find(field => field.id === 'prose');
  assert.equal(row.status, 'failed', JSON.stringify(result));
  assert.equal(row.reason, 'readback_mismatch');
  assert.equal(row.adapterStatus, 'reverted');
  assert.equal(row.currentValue, '第一行 第二行');
  assert.equal(inputs, 1);
  assert.equal(h.calls.filter(call => call.func?.name === 'writeControlInPage' && call.args[0].selector === '#prose').length, 1);
});

test('ordinary richtext candidates reject nested, disabled and unconfirmed framework surfaces', async t => {
  for (const html of ['<div id="prose" contenteditable="false"></div>',
    '<div id="prose" contenteditable="true" aria-disabled="true"></div>',
    '<div contenteditable="true"><div id="prose" contenteditable="true"></div></div>',
    '<div class="ant-editor"><div id="prose" contenteditable="true"></div></div>']) {
    const h = await harness({ enabled: true, html: `<form>${html.replace('id="prose"', 'id="prose" aria-label="自我评价"')}</form>` });
    t.after(() => h.dom.window.close());
    h.data.resumeProfile = { schemaVersion: 1, selfEvaluation: '安全边界', confirmedFields: ['selfEvaluation'] };
    const result = await h.fill();
    const readOnly = html.includes('contenteditable="false"') || html.includes('aria-disabled="true"');
    assert.equal(result.ok, true, JSON.stringify(result));
    if (readOnly) {
      assert.equal(result.data.formReadiness.status, 'form_not_ready');
      assert.equal(result.data.advisoryHints[0].blocking, false);
    }
    assert.equal(h.window.document.getElementById('prose').textContent, '');
    assert.equal(h.calls.filter(call => call.func?.name === 'writeControlInPage').length, 0);
  }
});
