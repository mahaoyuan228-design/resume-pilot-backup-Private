import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { captureProfileBinding, assertProfileBinding, PROFILE_LOCK } from '../src/profile/profile-lifecycle.js';
import { createControlWriteBridge, CONTROL_CANDIDATES_MESSAGE, CONTROL_WRITE_MESSAGE, CONTROL_VERIFY_MESSAGE,
  CONTROL_WRITE_FLAG } from '../src/background/controls-write.mjs';
import { boot, labels, copy, adapterNames } from './fixtures/tree-select-harness.mjs';

const source = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

async function route(lib, enabled = true, config = {}) {
  const f = await boot(lib, { ...config, id: Object.hasOwn(config, 'id') ? config.id : 'name' });
  const w = f.w, calls = [], locks = [], listeners = [];
  const label = w.document.createElement('label'); label.htmlFor = 'name'; label.textContent = '姓名';
  f.root.before(label);
  w.CSS ||= {}; w.CSS.escape ||= value => value;
  const data = { [CONTROL_WRITE_FLAG]: enabled,
    resumeProfile: { schemaVersion: 1, fullName: labels.at(-1), confirmedFields: ['fullName'] },
    resumeProfileLifecycle: { version: 1, epoch: '00000000-0000-4000-8000-000000000001', state: 'ready' } };
  const storage = { get: async keys => Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, copy(data[key])])),
    set: async values => Object.assign(data, copy(values)) };
  const binding = await captureProfileBinding(storage), tab = { id: 7, active: true, url: w.location.href };
  const sender = { id: 'offline-extension', frameId: 0, url: tab.url, tab };
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
  const invoke = message => new Promise(resolve => bridge.listener(message, sender, resolve));
  w.chrome = { runtime: { id: sender.id,
    onMessage: { addListener: listener => listeners.push(listener), removeListener: () => {} },
    sendMessage: async message => {
      if (message.type !== 'RESUME_PROFILE_BINDING_CHECK') return invoke(message);
      try { await assertProfileBinding(storage, message.profileBinding); return { allowed: true }; }
      catch { return { allowed: false }; }
    } }, storage: { local: storage } };
  w.eval(source('src/core/matcher.js')); w.eval(source('src/content/engine.js'));
  const fill = () => new Promise(resolve => listeners[0]({ type: 'RESUME_FILL', profile: copy(data.resumeProfile),
    profileBinding: binding }, { id: sender.id }, resolve));
  const request = () => ({ type: CONTROL_WRITE_MESSAGE, selector: '#name', path: 'fullName',
    value: data.resumeProfile.fullName, profileBinding: binding, timeOrigin: w.performance.timeOrigin });
  return { ...f, data, calls, locks, invoke, fill, request };
}

function standardAntField(f, peers = []) {
  f.w.document.querySelector('label[for="name"]').remove();
  const row = f.w.document.createElement('div'); row.className = 'ant-form-item';
  row.innerHTML = '<div class="ant-form-item-label"><label>姓名</label></div><div class="ant-form-item-control"></div>';
  f.root.before(row); row.querySelector('.ant-form-item-control').append(f.root, ...peers);
  return row;
}

for (const lib of ['ant', 'el', 'plus']) {
  test(`${lib} ordinary discovery exposes one answer target per owned tree with zero effects`, async t => {
    const f = await route(lib); t.after(() => f.close());
    const candidates = await f.invoke({ type: CONTROL_CANDIDATES_MESSAGE, timeOrigin: f.w.performance.timeOrigin });
    assert.equal(candidates.ok, true, JSON.stringify(candidates));
    const rows = candidates.candidates.filter(row => row.adapter === adapterNames[lib]);
    assert.equal(rows.length, 2, JSON.stringify(candidates));
    assert.equal(new Set(rows.map(row => row.rootSelector)).size, 2);
    for (const row of rows) {
      assert.equal(row.type, 'tree-select');
      const root = f.w.document.querySelector(row.rootSelector), input = f.w.document.querySelector(row.selector);
      assert.ok(root.contains(input));
    }
    assert.deepEqual(f.effects, []);
    assert.equal(candidates.writeStarted, false); assert.equal(candidates.liveSupportClaimed, false);
  });

  test(`${lib} ordinary opt-in fill clicks the tree and retains the original readback plan under the profile lock`, async t => {
    const f = await route(lib); t.after(() => f.close());
    const result = await f.fill(), row = result.data?.fields.find(field => field.id === 'name');
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(row?.adapter, adapterNames[lib], JSON.stringify(result));
    assert.equal(row.status, 'verified', JSON.stringify(row));
    assert.equal(row.adapterStatus, 'success'); assert.equal(row.reason, 'readback_matched');
    assert.equal(f.app.value, 30); assert.deepEqual(f.clicks, [labels.at(-1)]);
    assert.equal(f.app.second, undefined); assert.deepEqual(f.forbidden, []);
    assert.equal(f.w.document.getElementById('neighbor').value, 'KEEP');
    assert.ok(f.locks.length > 0); assert.ok(f.locks.every(lock => lock.name === PROFILE_LOCK && lock.options.mode === 'exclusive'));
    assert.equal(f.calls.filter(call => call.func?.name === 'writeControlInPage').length, 1);
    assert.equal(f.calls.filter(call => call.func?.name === 'verifyControlInPage').length, 1);
  });

  test(`${lib} MAIN readback receipt detects a visible reversion without replaying a node click`, async t => {
    const f = await route(lib); t.after(() => f.close());
    const result = await f.invoke(f.request());
    assert.equal(result.status, 'success', JSON.stringify(result));
    assert.match(result.readbackId, /^[a-f0-9-]{36}$/u);
    await Promise.resolve();
    f.paint('changed display');
    const before = f.effects.length;
    const verified = await f.invoke({ ...f.request(), type: CONTROL_VERIFY_MESSAGE, readbackId: result.readbackId });
    assert.equal(verified.status, 'reverted', JSON.stringify(verified));
    assert.equal(verified.writeStarted, false); assert.equal(verified.liveSupportClaimed, false);
    assert.equal(f.effects.length, before); assert.deepEqual(f.clicks, [labels.at(-1)]);
    assert.deepEqual(f.forbidden, []);
  });

  test(`${lib} disabled write flag and unconfirmed profile facts stop before any UI effects`, async t => {
    for (const scenario of ['off', 'unconfirmed']) {
      const f = await route(lib, scenario !== 'off'); t.after(() => f.close());
      if (scenario === 'unconfirmed') f.data.resumeProfile.confirmedFields = [];
      const result = await f.invoke(f.request());
      assert.equal(result.ok, false); assert.equal(result.writeStarted, false);
      assert.deepEqual(f.effects, []); assert.equal(f.app.value, undefined);
      assert.deepEqual(f.forbidden, []);
    }
  });
}

test('an open real Ant tree portal under a standard field label never becomes a native text answer', async t => {
  for (const enabled of [false, true]) {
    const f = await route('ant', enabled, { props: { getPopupContainer: trigger => trigger.parentNode } });
    t.after(() => f.close());
    const row = standardAntField(f);
    f.root.querySelector('.ant-select-selection').click(); await f.tick();
    const query = row.querySelector('.ant-select-dropdown-search input');
    assert.ok(query?.isConnected, 'the real portal search editor is inside the labeled form row');
    assert.equal(query.value, '');
    f.effects.length = 0;
    const result = await f.fill();
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(query.value, '', `flag=${enabled}: the search editor is never a fullName answer`);
    assert.equal(f.effects.some(event => event.target === query && ['input', 'change'].includes(event.type)), false);
    assert.equal(f.app.value, undefined); assert.equal(f.app.second, undefined);
    assert.deepEqual(f.clicks, []); assert.deepEqual(f.forbidden, []);
    assert.equal(f.w.document.getElementById('neighbor').value, 'KEEP');
  }
});

test('an inputless Ant tree uses an isolated standard field label without a for attribute or an id', async t => {
  const f = await route('ant', true, { id: null }); t.after(() => f.close());
  standardAntField(f);
  assert.equal(f.root.querySelector('input'), null); assert.equal(f.root.hasAttribute('id'), false);
  const result = await f.fill();
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(f.app.value, 30, JSON.stringify(result)); assert.deepEqual(f.clicks, [labels.at(-1)]);
  assert.ok(result.data.fields.some(field => field.adapter === 'antdv1-tree-select' && field.status === 'verified'));
  assert.equal(f.app.second, undefined); assert.deepEqual(f.forbidden, []);
  assert.equal(f.w.document.getElementById('neighbor').value, 'KEEP');
});

test('an inputless tree sharing a standard field row with a tree or editor cannot borrow its unbound label', async t => {
  for (const kind of ['tree', 'editor']) {
    const f = await route('ant', true, { id: null }); t.after(() => f.close());
    const peer = kind === 'tree' ? f.sibling : f.w.document.createElement('input');
    standardAntField(f, [peer]);
    const result = await f.fill();
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(f.app.value, undefined); assert.equal(f.app.second, undefined);
    if (kind === 'editor') assert.equal(peer.value, '');
    assert.deepEqual(f.clicks, []); assert.deepEqual(f.effects, []); assert.deepEqual(f.forbidden, []);
    assert.equal(f.w.document.getElementById('neighbor').value, 'KEEP');
  }
});
