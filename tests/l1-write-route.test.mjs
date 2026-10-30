import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { captureProfileBinding, assertProfileBinding, PROFILE_LOCK } from '../src/profile/profile-lifecycle.js';
import { createControlWriteBridge, CONTROL_WRITE_MESSAGE, CONTROL_CANDIDATES_MESSAGE, CONTROL_WRITE_FLAG } from '../src/background/controls-write.mjs';

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
      if ([CONTROL_WRITE_MESSAGE, CONTROL_CANDIDATES_MESSAGE].includes(message.type)) return invoke(message);
      throw Error('unexpected_message');
    } }, storage: { local: storage } };
  window.eval(source('src/core/matcher.js'));
  window.eval(source('src/content/engine.js'));
  const fill = async () => {
    const currentBinding = await captureProfileBinding(storage);
    return new Promise(resolve => listeners[0]({ type: 'RESUME_FILL', profile: clone(data.resumeProfile), profileBinding: currentBinding }, { id: sender.id }, resolve));
  };
  const request = () => ({ type: CONTROL_WRITE_MESSAGE, selector: '#name', path: 'fullName', value: data.resumeProfile.fullName,
    profileBinding: binding, timeOrigin: window.performance.timeOrigin });
  return { dom, window, data, calls, locks, sender, tab, binding, fill, invoke, request };
}

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
  assert.equal(h.calls.length, 4);
  assert.equal(h.calls[3].func.name, 'writeControlInPage');
  assert.equal(h.calls[3].world, 'MAIN');
  assert.deepEqual(h.calls[3].target, { tabId: 7, frameIds: [0] });
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
      assert.equal(f.input.value, '', scenario);
      assert.equal(f.props.value, '', scenario);
    }
    assert.equal(f.portal.hidden, true, scenario);
  }
});

test('resume entry refreshes MAIN candidates after revealing an opt-in widget editor', async t => {
  const h = await harness({ enabled: true,
    html: '<header><input type="search" value="KEEP_HEADER"></header><section><p>简历摘要</p><button type="button">编辑简历</button></section>' });
  t.after(() => h.dom.window.close());
  h.window.eval(source('src/content/controls/resume-form.js'));
  let edits = 0, widget;
  h.window.document.querySelector('button').addEventListener('click', () => {
    edits++;
    h.window.document.querySelector('section').innerHTML = '<form><label for="name">姓名</label><input id="name"></form>';
    widget = syntheticUdSelect(h);
  });
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
