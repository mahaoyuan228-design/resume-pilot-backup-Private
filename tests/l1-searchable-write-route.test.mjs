import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { assertProfileBinding, captureProfileBinding, PROFILE_LOCK } from '../src/profile/profile-lifecycle.js';
import { createControlWriteBridge, CONTROL_CANDIDATES_MESSAGE, CONTROL_WRITE_MESSAGE, CONTROL_WRITE_FLAG } from '../src/background/controls-write.mjs';

const desired = 'Offline Name';
const source = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const copy = value => value === undefined ? undefined : structuredClone(value);
const combo = '<input id="name" type="search" role="combobox" aria-autocomplete="list" aria-controls="choices" aria-expanded="false"><div id="choices" role="listbox" hidden></div>';

async function harness({ enabled = true, confirmed = true, extra = '' } = {}) {
  const dom = new JSDOM(`<!doctype html><body><form><label for="name">姓名</label>${combo}${extra}
    <input id="neighbor" value="KEEP"><button type="submit">Save</button></form></body>`,
  { url: 'https://offline.example/resume', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, calls = [], locks = [], responses = [], effects = [], listeners = [];
  w.Element.prototype.getClientRects = () => [{ width: 20, height: 20 }];
  w.CSS = { escape: value => value };
  const data = { [CONTROL_WRITE_FLAG]: enabled,
    resumeProfile: { schemaVersion: 1, fullName: desired, confirmedFields: confirmed ? ['fullName'] : [] },
    resumeProfileLifecycle: { version: 1, epoch: '00000000-0000-4000-8000-000000000001', state: 'ready' } };
  const storage = { get: async keys => Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, copy(data[key])])),
    set: async values => Object.assign(data, copy(values)) };
  const binding = await captureProfileBinding(storage);
  const tab = { id: 7, active: true, url: w.location.href };
  const sender = { id: 'offline-extension', url: tab.url, tab, frameId: 0 };
  const api = { storage: { local: storage }, tabs: { get: async () => ({ ...tab }) },
    runtime: { id: sender.id, getManifest: () => ({ background: { service_worker: 'src/background/worker.mjs' } }) },
    scripting: { executeScript: async request => {
      calls.push(request);
      if (request.files) { for (const file of request.files) w.eval(source(file)); return [{ frameId: 0 }]; }
      return [{ frameId: 0, result: copy(await w.eval(`(${request.func.toString()})`)(...copy(request.args))) }];
    } } };
  const bridge = createControlWriteBridge({ api, lifecycleOptions: { locks: {
    request: async (name, options, work) => { locks.push({ name, options }); return work(); }
  } } });
  const invoke = message => new Promise(resolve => bridge.listener(message, sender, result => { responses.push(result); resolve(result); }));
  w.chrome = { runtime: { id: sender.id, onMessage: {
    addListener: listener => listeners.push(listener), removeListener: () => {}
  }, sendMessage: async message => {
    if (message.type !== 'RESUME_PROFILE_BINDING_CHECK') return invoke(message);
    try { await assertProfileBinding(storage, message.profileBinding); return { allowed: true }; }
    catch { return { allowed: false }; }
  } },
  storage: { local: storage } };
  for (const type of ['input', 'change', 'blur', 'click', 'submit'])
    w.document.addEventListener(type, event => effects.push([type, event.target.id || event.target.tagName]));
  const input = w.document.getElementById('name'), list = w.document.getElementById('choices');
  input.addEventListener('click', () => { list.hidden = false; input.setAttribute('aria-expanded', 'true'); });
  input.addEventListener('input', () => {
    list.replaceChildren();
    const option = w.document.createElement('div'); option.id = 'choice'; option.setAttribute('role', 'option'); option.textContent = desired;
    option.addEventListener('click', () => {
      option.setAttribute('aria-selected', 'true'); list.hidden = true; input.setAttribute('aria-expanded', 'false');
    });
    list.append(option);
  });
  w.eval(source('src/core/matcher.js')); w.eval(source('src/content/engine.js'));
  const fill = () => new Promise(resolve => listeners[0]({ type: 'RESUME_FILL', profile: copy(data.resumeProfile), profileBinding: binding }, { id: sender.id }, resolve));
  const request = () => ({ type: CONTROL_WRITE_MESSAGE, selector: '#name', path: 'fullName', value: desired,
    profileBinding: binding, timeOrigin: w.performance.timeOrigin });
  return { dom, w, input, list, calls, locks, responses, effects, invoke, fill, request };
}

test('ordinary discovery includes every generic searchable dropdown family without effects', async t => {
  const controls = [
    ['el-auto', 'el-autocomplete', 'ElAutocomplete', {}],
    ['ant-auto', 'ant-select ant-select-auto-complete', 'AAutoComplete', {}],
    ['el-filter', 'el-select', 'ElSelect', { filterable: true }],
    ['ant-filter', 'ant-select', 'ASelect', { showSearch: true }],
  ];
  const h = await harness({ extra: controls.map(([id, classes]) => `<div id="${id}" class="${classes}"><input></div>`).join('') });
  t.after(() => h.dom.window.close());
  h.w.ELEMENT = { version: '2.15.14' }; h.w.antd = { version: '1.7.8' };
  for (const [id, , name, props] of controls) {
    const root = h.w.document.getElementById(id);
    root.__vue__ = { $el: root, $options: { name }, $props: { value: '', ...props } };
  }
  const result = await h.invoke({ type: CONTROL_CANDIDATES_MESSAGE, timeOrigin: h.w.performance.timeOrigin });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.writeStarted, false); assert.equal(result.liveSupportClaimed, false);
  assert.deepEqual(result.candidates.map(row => row.adapter).sort(), [
    'native-combobox-search', 'el-autocomplete', 'antdv1-autocomplete', 'el-select-search', 'antdv1-select-search'
  ].sort());
  for (const candidate of result.candidates) {
    assert.equal(candidate.type, 'select-search');
    assert.equal(h.w.document.querySelectorAll(candidate.selector).length, 1);
  }
  assert.deepEqual(h.effects, []); assert.equal(h.input.value, '');
});

test('ordinary opt-in fill filters, clicks and verifies an owned combobox under the profile lock', async t => {
  const h = await harness(); t.after(() => h.dom.window.close());
  const result = await h.fill(), row = result.data.fields.find(field => field.id === 'name');
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(row.status, 'verified', JSON.stringify(row));
  assert.equal(row.adapter, 'native-combobox-search'); assert.equal(row.adapterStatus, 'success');
  assert.equal(row.reason, 'readback_matched');
  assert.equal(h.input.value, desired); assert.equal(h.list.hidden, true);
  assert.equal(h.w.document.getElementById('choice').getAttribute('aria-selected'), 'true');
  assert.equal(h.w.document.getElementById('neighbor').value, 'KEEP');
  assert.deepEqual(h.effects.filter(([type]) => type === 'input' || type === 'change' || type === 'submit'), [['input', 'name']]);
  assert.deepEqual(h.effects.filter(([type]) => type === 'click'), [['click', 'name'], ['click', 'choice']]);
  const write = h.calls.find(call => call.func?.name === 'writeControlInPage');
  assert.equal(write.world, 'MAIN'); assert.deepEqual(write.target, { tabId: 7, frameIds: [0] });
  assert.equal(h.locks[0].name, PROFILE_LOCK); assert.equal(h.locks[0].options.mode, 'exclusive');
  const response = h.responses.find(item => item.writeStarted === true);
  assert.equal(response.status, 'success'); assert.equal(response.strategy, 'ui');
  assert.equal(response.interaction, 'search'); assert.equal(response.liveSupportClaimed, false);
});

test('searchable writes require the explicit flag and a confirmed profile fact before effects', async t => {
  for (const [options, reason] of [[{ enabled: false }, 'control_write_disabled'], [{ confirmed: false }, 'control_fact_unconfirmed']]) {
    const h = await harness(options); t.after(() => h.dom.window.close());
    const result = await h.invoke(h.request());
    assert.equal(result.ok, false); assert.equal(result.reason, reason);
    assert.equal(result.writeStarted, false); assert.equal(result.liveSupportClaimed, false);
    assert.equal(h.input.value, ''); assert.equal(h.list.hidden, true);
    assert.equal(h.w.document.getElementById('neighbor').value, 'KEEP');
    assert.deepEqual(h.effects, []); assert.deepEqual(h.calls, []);
  }
});
