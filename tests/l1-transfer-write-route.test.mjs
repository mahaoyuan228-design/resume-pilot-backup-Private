import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertProfileBinding, captureProfileBinding, PROFILE_LOCK } from '../src/profile/profile-lifecycle.js';
import { createControlWriteBridge, CONTROL_CANDIDATES_MESSAGE, CONTROL_WRITE_MESSAGE, CONTROL_VERIFY_MESSAGE,
  CONTROL_WRITE_FLAG } from '../src/background/controls-write.mjs';
import { boot, adapterNames } from './fixtures/transfer-harness.mjs';

const source = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const copy = value => value === undefined ? undefined : structuredClone(value);

async function route(lib, { enabled = true, confirmed = true, values = ['Alpha', 'Beta'], afterWrite } = {}) {
  const f = await boot(lib, { id: 'target', props: lib === 'el' ? { filterable: true } : { showSearch: true } });
  const w = f.w, calls = [], locks = [], messages = [], listeners = [];
  w.CSS ||= {}; w.CSS.escape ||= value => value;
  const label = w.document.createElement('label'); label.htmlFor = 'target'; label.textContent = '期望城市';
  f.root.before(label);
  const data = { [CONTROL_WRITE_FLAG]: enabled, resumeProfile: { schemaVersion: 1, desiredCities: values,
    confirmedFields: confirmed ? values.map((_, index) => `desiredCities.${index}`) : [] },
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
  const invoke = message => new Promise(resolve => bridge.listener(message, sender, async result => {
    if (message.type === CONTROL_WRITE_MESSAGE && result.status === 'success') await afterWrite?.(f);
    resolve(result);
  }));
  w.chrome = { runtime: { id: sender.id,
    onMessage: { addListener: listener => listeners.push(listener), removeListener: () => {} },
    sendMessage: async message => {
      messages.push(copy(message));
      if (message.type !== 'RESUME_PROFILE_BINDING_CHECK') return invoke(message);
      try { await assertProfileBinding(storage, message.profileBinding); return { allowed: true }; }
      catch { return { allowed: false }; }
    } }, storage: { local: storage } };
  w.eval(source('src/core/matcher.js')); w.eval(source('src/content/engine.js'));
  const run = type => new Promise(resolve => listeners[0]({ type, profile: copy(data.resumeProfile),
    profileBinding: binding }, { id: sender.id }, resolve));
  return { ...f, data, calls, locks, messages, invoke, fill: () => run('RESUME_FILL'), inspect: () => run('RESUME_INSPECT') };
}

function safe(f) {
  assert.equal(f.w.document.getElementById('neighbor').value, 'KEEP');
  assert.deepEqual(f.forbidden, []);
  assert.equal(f.w.ResumeControls.liveSupportClaimed, false);
}

for (const lib of ['el', 'ant']) {
  test(`${lib} transfer discovery claims one root per answer and has no UI effects`, async t => {
    const f = await route(lib); t.after(() => f.close());
    const before = f.effects.length;
    const result = await f.invoke({ type: CONTROL_CANDIDATES_MESSAGE, timeOrigin: f.w.performance.timeOrigin });
    assert.equal(result.ok, true, JSON.stringify(result));
    const rows = result.candidates.filter(row => row.adapter === adapterNames[lib]);
    assert.equal(rows.length, 2, JSON.stringify(result));
    assert.equal(new Set(rows.map(row => row.rootSelector)).size, 2);
    for (const row of rows) {
      assert.equal(row.type, 'transfer');
      assert.equal(f.w.document.querySelector(row.selector), f.w.document.querySelector(row.rootSelector));
    }
    assert.equal(f.effects.length, before);
    assert.equal(result.writeStarted, false); assert.equal(result.liveSupportClaimed, false);
    safe(f);
  });

  test(`${lib} ordinary transfer fill preserves array facts and checks the retained readback under the profile lock`, async t => {
    for (const values of [['Alpha', 'Beta'], ['Alpha']]) {
      const f = await route(lib, { values }); t.after(() => f.close());
      const inspected = await f.inspect(), targets = inspected.data.fields.filter(row => row.path === 'desiredCities');
      assert.equal(targets.length, 1, JSON.stringify(inspected)); assert.equal(targets[0].reason, 'ready');
      assert.deepEqual(f.effects, []);
      const result = await f.fill(), row = result.data?.fields.find(field => field.path === 'desiredCities');
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(row?.adapter, adapterNames[lib], JSON.stringify(result));
      assert.equal(row.status, 'verified', JSON.stringify(row)); assert.equal(row.reason, 'readback_matched');
      assert.deepEqual(copy(f.app.value).sort(), values.map(value => value === 'Alpha' ? 'a' : 'b').sort());
      const writes = f.messages.filter(message => message.type === CONTROL_WRITE_MESSAGE);
      const verifies = f.messages.filter(message => message.type === CONTROL_VERIFY_MESSAGE);
      assert.equal(writes.length, 1); assert.equal(verifies.length, 1);
      assert.deepEqual(writes[0].value, values); assert.deepEqual(verifies[0].value, values);
      assert.ok(f.locks.length > 0);
      assert.ok(f.locks.every(lock => lock.name === PROFILE_LOCK && lock.options.mode === 'exclusive'));
      safe(f);
    }
  });

  test(`${lib} transfer internals never become native answers with the write flag off or an unconfirmed fact`, async t => {
    for (const options of [{ enabled: false }, { confirmed: false }]) {
      const f = await route(lib, options); t.after(() => f.close());
      assert.ok(f.root.querySelector('input:not([type="checkbox"])'), 'the real widget exposes a search editor');
      for (const input of f.root.querySelectorAll('input:not([type="checkbox"])')) input.setAttribute('aria-label', '期望城市');
      const result = await f.fill();
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(f.messages.some(message => message.type === CONTROL_WRITE_MESSAGE), false);
      assert.deepEqual(copy(f.app.value), ['keep']); assert.deepEqual(f.effects, []);
      safe(f);
    }
  });

  test(`${lib} transfer batch readback detects a later model reversion without replaying the move`, async t => {
    const f = await route(lib, { afterWrite: async f => { f.app.value = ['a']; await f.tick(); } }); t.after(() => f.close());
    const result = await f.fill(), row = result.data?.fields.find(field => field.path === 'desiredCities');
    assert.equal(row?.status, 'failed', JSON.stringify(result)); assert.equal(row.reason, 'readback_mismatch');
    assert.equal(f.messages.filter(message => message.type === CONTROL_WRITE_MESSAGE).length, 1);
    assert.equal(f.messages.filter(message => message.type === CONTROL_VERIFY_MESSAGE).length, 1);
    assert.deepEqual(copy(f.app.value), ['a']);
    safe(f);
  });
}
