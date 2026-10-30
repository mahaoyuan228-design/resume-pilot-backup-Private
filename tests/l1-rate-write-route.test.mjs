import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { captureProfileBinding, assertProfileBinding, PROFILE_LOCK } from '../src/profile/profile-lifecycle.js';
import { createControlWriteBridge, CONTROL_CANDIDATES_MESSAGE, CONTROL_WRITE_MESSAGE, CONTROL_VERIFY_MESSAGE,
  CONTROL_WRITE_FLAG } from '../src/background/controls-write.mjs';
import { boot, adapters } from './fixtures/rate-harness.mjs';

const source = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const copy = value => value === undefined ? undefined : structuredClone(value);

async function route(t, family, enabled = true) {
  const f = boot(t, family), w = f.w, calls = [], locks = [], listeners = [];
  w.CSS ||= {}; w.CSS.escape ||= value => value;
  const label = w.document.createElement('label'); label.htmlFor = 'target'; label.textContent = '期望刻度';
  f.el.before(label);
  const data = { [CONTROL_WRITE_FLAG]: enabled,
    resumeProfile: { schemaVersion: 1, customAnswers: { 期望刻度: '4' },
      customFacts: [{ question: '期望刻度', answer: '4', sitePageUrl: w.location.href,
        sectionName: 'form:single', rowContext: 'none' }], confirmedFields: ['customAnswers.期望刻度'] },
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
  const invoke = message => new Promise(resolve => bridge.listener(message, sender, result => setTimeout(() => resolve(result), 0)));
  w.chrome = { runtime: { id: sender.id,
    onMessage: { addListener: listener => listeners.push(listener), removeListener: () => {} },
    sendMessage: async message => {
      if (message.type !== 'RESUME_PROFILE_BINDING_CHECK') return invoke(message);
      try { await assertProfileBinding(storage, message.profileBinding); return { allowed: true }; }
      catch { return { allowed: false }; }
    } }, storage: { local: storage } };
  w.eval(source('src/core/matcher.js')); w.eval(source('src/content/engine.js'));
  const fill = async () => {
    const currentBinding = await captureProfileBinding(storage);
    return new Promise(resolve => listeners[0]({ type: 'RESUME_FILL', profile: copy(data.resumeProfile),
      profileBinding: currentBinding }, { id: sender.id }, resolve));
  };
  const request = () => ({ type: CONTROL_WRITE_MESSAGE, selector: '#target', path: 'customAnswers.期望刻度',
    value: data.resumeProfile.customAnswers.期望刻度, profileBinding: binding, timeOrigin: w.performance.timeOrigin });
  return { ...f, data, calls, locks, invoke, fill, request };
}

for (const family of ['el', 'plus', 'antdv1', 'aria']) {
  test(`${family} ordinary rate discovery is passive and emits one bound target`, async t => {
    const f = await route(t, family);
    const candidates = await f.invoke({ type: CONTROL_CANDIDATES_MESSAGE, timeOrigin: f.w.performance.timeOrigin });
    assert.equal(candidates.ok, true, JSON.stringify(candidates));
    const rows = candidates.candidates.filter(row => row.type === 'rate');
    assert.equal(rows.length, 1, JSON.stringify(candidates));
    assert.equal(rows[0].adapter, adapters[family]);
    assert.equal(f.w.document.querySelector(rows[0].rootSelector), f.el);
    assert.ok(f.el.contains(f.w.document.querySelector(rows[0].selector)));
    assert.deepEqual(f.events, []); assert.equal(candidates.writeStarted, false);
    assert.equal(candidates.liveSupportClaimed, false);
  });

  test(`${family} ordinary opt-in rate fill uses its confirmed fact and retained readback under the profile lock`, async t => {
    const f = await route(t, family);
    const result = await f.fill(), row = result.data?.fields.find(field => field.adapter === adapters[family]);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(row?.status, 'verified', JSON.stringify(result));
    assert.equal(row.reason, 'readback_matched'); assert.equal(row.currentValue, 4);
    assert.equal(f.calls.filter(call => call.func?.name === 'writeControlInPage').length, 1);
    assert.equal(f.calls.filter(call => call.func?.name === 'verifyControlInPage').length, 1);
    assert.ok(f.locks.length > 0);
    assert.ok(f.locks.every(lock => lock.name === PROFILE_LOCK && lock.options.mode === 'exclusive'));
    assert.equal(f.neighbor.value, 'KEEP'); assert.equal(f.effects.save + f.effects.submit, 0);
    assert.equal(result.data.liveSupportClaimed, false);
  });

  test(`${family} rate write opt-out and unconfirmed profile facts produce zero effects`, async t => {
    for (const mode of ['off', 'unconfirmed']) {
      const f = await route(t, family, mode !== 'off');
      if (mode === 'unconfirmed') f.data.resumeProfile.confirmedFields = [];
      const direct = await f.invoke(f.request());
      assert.equal(direct.ok, false); assert.equal(direct.writeStarted, false);
      const result = await f.fill();
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.deepEqual(f.events, []); assert.equal(f.neighbor.value, 'KEEP');
      assert.equal(f.effects.save + f.effects.submit, 0);
    }
  });

  test(`${family} rate readback receipt detects reversion without another write`, async t => {
    const f = await route(t, family);
    const written = await f.invoke(f.request());
    assert.equal(written.status, 'success', JSON.stringify(written));
    f.paint(2);
    const before = f.events.length;
    const verified = await f.invoke({ ...f.request(), type: CONTROL_VERIFY_MESSAGE, readbackId: written.readbackId });
    assert.equal(verified.status, 'reverted', JSON.stringify(verified));
    assert.equal(verified.liveSupportClaimed, false); assert.equal(verified.writeStarted, false);
    assert.equal(f.events.length, before);
  });
}

for (const family of ['el', 'plus', 'antdv1', 'aria']) for (const peer of [false, true]) {
  test(`${family} a standard unbound form label ${peer ? 'stays ambiguous with a peer editor' : 'belongs to its single rate'}`, async t => {
    const f = await route(t, family);
    f.w.document.querySelector('label[for="target"]').remove();
    const row = f.w.document.createElement('div'); row.className = 'ant-form-item';
    row.innerHTML = '<div class="ant-form-item-label"><label>期望刻度</label></div><div class="ant-form-item-control"></div>';
    f.el.before(row); row.lastChild.append(f.el);
    if (peer) row.lastChild.append(f.neighbor);
    const result = await f.fill();
    assert.equal(result.ok, true, JSON.stringify(result));
    const written = f.calls.filter(call => call.func?.name === 'writeControlInPage');
    assert.equal(written.length, peer ? 0 : 1, JSON.stringify(result));
    if (peer) assert.deepEqual(f.events, []);
    else assert.equal(result.data.fields.find(field => field.adapter === adapters[family])?.status, 'verified');
    assert.equal(f.neighbor.value, 'KEEP'); assert.equal(f.effects.save + f.effects.submit, 0);
  });
}

for (const family of ['el', 'plus', 'antdv1', 'aria']) test(family + ' unconfirmed rate composition has no native text fallback', async t => {
  const f = await route(t, family);
  const input=f.w.document.createElement('input'); input.value='';
  const label=f.w.document.createElement('label'); label.textContent='??'; label.append(input); f.el.append(label);
  f.data.resumeProfile.fullName='????'; f.data.resumeProfile.confirmedFields.push('fullName');
  const result=await f.fill();
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(input.value,''); assert.deepEqual(f.events,[]);
  assert.equal(f.calls.filter(call=>call.func?.name==='writeControlInPage').length,0);
  assert.equal(f.effects.save+f.effects.submit,0);
});
