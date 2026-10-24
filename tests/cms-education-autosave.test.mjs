/**
 * Offline regression only. The repository's fictional fixture supplies the DOM
 * and public React props; synthetic event handlers model the reported XHR
 * autosave endpoint. They are not evidence of additional live-site controls,
 * event timing, or live support. No live browser or network is contacted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { integrationFixture } from './fixtures/cms-education-fixture.mjs';
import { readCmsEducationSerialization } from '../src/content/cms-education-serialization.mjs';
import * as runner from '../scripts/live/cms-education-live.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';
const LIVE_URL = `${PAGE}?resumeId=private-applicant-token#private-fragment`;
const AUTOSAVE = 'https://wecruit.hotjob.cn/wecruit/resume/info/edit/SU629dbc0c0dcad452299bc0f7';
const PRIVATE = 'private-original-education-value';
const plain = value => JSON.parse(JSON.stringify(value));
const fixtureHtml = integrationFixture({
  schools: ['Fictional college A', 'Fictional college B'],
  regions: [
    { province: 'Fictional province A', city: 'Fictional city A' },
    { province: 'Fictional province B', city: 'Fictional city B' }
  ]
});

function target() {
  return { type: 'page', id: 'education-autosave-offline', url: LIVE_URL,
    webSocketDebuggerUrl: 'ws://127.0.0.1:9239/devtools/page/education-autosave-offline' };
}

async function educationDom(t, { originals, installTrial = true, beforeTrial } = {}) {
  const dom = new JSDOM(await fixtureHtml, {
    url: LIVE_URL, pretendToBeVisual: true, runScripts: 'dangerously',
    beforeParse(window) {
      window.structuredClone = structuredClone;
      window.TextEncoder = TextEncoder;
      Object.defineProperty(window.crypto, 'subtle', { configurable: true, value: webcrypto.subtle });
      window.Element.prototype.getClientRects = function () { return this.isConnected ? [{ width: 10, height: 10 }] : []; };
    }
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  Object.defineProperty(window.document, 'readyState', { configurable: true, get: () => 'complete' });
  Object.defineProperty(window.document, 'visibilityState', { configurable: true, get: () => 'visible' });
  window.document.hasFocus = () => true;
  const native = { sends: 0, fetches: 0, beacons: 0 };
  window.fetch = async () => { native.fetches += 1; return { ok: true, json: async () => ({ state: 200 }) }; };
  window.XMLHttpRequest.prototype.send = function () { native.sends += 1; };
  window.navigator.sendBeacon = () => { native.beacons += 1; return true; };
  const inputs = {
    major: window.document.getElementById('14_53_0').querySelector('input'),
    description: window.document.getElementById('14_55_0').querySelector('textarea')
  };
  for (const [key, value] of Object.entries(originals || {})) {
    inputs[key].value = value;
    inputs[key].dispatchEvent(new window.Event('input', { bubbles: true }));
  }
  if (beforeTrial) beforeTrial(window, { inputs, native });
  if (installTrial) {
    const installed = window.eval(runner.buildPageExpression(repoRoot));
    assert.equal(installed.ok, true, JSON.stringify(installed));
    for (const file of runner.LIVE_FILES) window.eval(fs.readFileSync(path.join(repoRoot, file), 'utf8'));
  }
  const readProof = () => plain(window.eval(`(${readCmsEducationSerialization.toString()})()`));
  return { window, inputs, native, readProof, api: window.__cmsEducationLive };
}

function sendXhr(window, { method = 'POST', url = AUTOSAVE } = {}) {
  const xhr = new window.XMLHttpRequest();
  xhr.open(method, url);
  // Applicant-controlled request bodies must never enter result/evidence logs.
  xhr.send(JSON.stringify({ privateApplicantValue: PRIVATE, education: window.fixtureProps.formData }));
}

function installSyntheticAutosave(window, inputs, { delay = 0, nested = false } = {}) {
  const observed = [];
  for (const [key, input] of Object.entries(inputs)) {
    for (const type of ['input', 'change', 'blur']) input.addEventListener(type, () => {
      observed.push({ key, type });
      window.setTimeout(() => {
        if (nested) window.setTimeout(() => sendXhr(window), 10);
        else sendXhr(window);
      }, delay);
      // Cancelled work must not hold cleanup open or be replayed afterward.
      const cancelled = window.setTimeout(() => { throw new Error('cancelled_autosave_executed'); }, 60000);
      window.clearTimeout(cancelled);
      const interval = window.setInterval(() => { throw new Error('cancelled_interval_executed'); }, 60000);
      window.clearInterval(interval);
    });
  }
  return observed;
}

// These are fictional timer workloads, not reconstructed live-site callbacks.
// REAL_USE_CMS_EDU_RETEST_3b51254e_2026-10-23.md reports the
// autosave_callbacks_unverifiable failure; no callback source or site timing
// is inferred from it. String execution verifies native timer order offline.
function installNonFunctionAutosave(window, inputs, options = {}) {
  const { omitDelay = false, nested = false } = options;
  const callback = Object.hasOwn(options, 'callback') ? options.callback : '__syntheticEducationAutosave()';
  const observed = [];
  window.__syntheticEducationAutosave = () => {
    if (nested) return Promise.resolve().then(() => window.setTimeout(() => sendXhr(window), 0));
    sendXhr(window);
  };
  for (const [key, input] of Object.entries(inputs)) {
    for (const type of ['input', 'change', 'blur']) input.addEventListener(type, () => {
      observed.push({ key, type });
      if (omitDelay) window.setTimeout(callback);
      else window.setTimeout(callback, 0);
      if (typeof callback !== 'string') window.setTimeout(() => sendXhr(window), 0);
    });
  }
  return observed;
}

function assertTimerDiagnostics(diagnostics, { observed = false } = {}) {
  const snapshot = plain(diagnostics);
  assert.deepEqual(Object.keys(snapshot).sort(), ['observedNonFunctionTimeouts', 'pendingTimers', 'unobservableTimers']);
  for (const value of Object.values(snapshot)) assert.ok(Number.isSafeInteger(value) && value >= 0);
  assert.equal(snapshot.pendingTimers, 0);
  assert.equal(snapshot.unobservableTimers, 0);
  if (observed) assert.ok(snapshot.observedNonFunctionTimeouts > 0);
}

// A synthetic native backend deliberately reuses the smallest available ID.
// This models permitted timer-ID reuse without asserting that the real page
// does so. Only this test backend evaluates strings; the shipped guard must
// pass callback values to its captured native scheduler unchanged.
function installReusingTimerBackend(window) {
  const native = {
    setTimeout: window.setTimeout, clearTimeout: window.clearTimeout,
    setInterval: window.setInterval, clearInterval: window.clearInterval
  };
  const active = new Map();
  function schedule(repeating, callback, delay, args) {
    let id = 1;
    while (active.has(id)) id += 1;
    const record = { id, nativeHandle: null };
    active.set(id, record);
    record.nativeHandle = native[repeating ? 'setInterval' : 'setTimeout'].call(window, () => {
      if (active.get(id) !== record) return;
      try {
        if (typeof callback === 'function') callback.apply(window, args);
        else window.eval(String(callback));
      } finally {
        if (!repeating && active.get(id) === record) active.delete(id);
      }
    }, delay);
    return id;
  }
  const cancel = value => {
    const id = value >> 0;
    const record = active.get(id);
    if (!record) return;
    native.clearTimeout.call(window, record.nativeHandle);
    native.clearInterval.call(window, record.nativeHandle);
    active.delete(id);
  };
  window.setTimeout = (callback, delay, ...args) => schedule(false, callback, delay, args);
  window.setInterval = (callback, delay, ...args) => schedule(true, callback, delay, args);
  window.clearTimeout = cancel;
  window.clearInterval = cancel;
  return {
    handles: () => [...active.keys()].sort((a, b) => a - b),
    wait: ms => new Promise(resolve => native.setTimeout.call(window, resolve, ms))
  };
}

async function runTrial(api) {
  const prepared = api.prepare();
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  return api.run(await runner.createLivePlan(plain(prepared.identities)));
}

function assertSuppressed(rows) {
  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.equal(row.method, 'POST');
    assert.equal(row.url, AUTOSAVE);
    assert.equal(row.via, 'xhr');
    assert.equal(row.blockedBeforeSend, true);
    assert.ok(['trial', 'restore'].includes(row.phase));
    assert.deepEqual(Object.keys(row).sort(), ['blockedBeforeSend', 'method', 'phase', 'url', 'via']);
  }
}

test('autosave classifier derives the one exact POST endpoint from the baseline page', () => {
  assert.equal(runner.isEducationAutosave({ method: 'POST', url: AUTOSAVE }), true);
  assert.equal(runner.isEducationAutosave({ method: 'POST', url: new URL(AUTOSAVE).pathname }), true);
  for (const method of ['GET', 'HEAD', 'OPTIONS', 'PUT', 'PATCH', 'DELETE', '', undefined]) {
    assert.equal(runner.isEducationAutosave({ method, url: AUTOSAVE }), false, String(method));
  }
  for (const url of [
    `${AUTOSAVE}/`, `${AUTOSAVE}/other`, `${AUTOSAVE}?resumeId=private-query`, `${AUTOSAVE}#private-fragment`,
    AUTOSAVE.replace('https:', 'http:'), AUTOSAVE.replace('wecruit.hotjob.cn', 'wecruit.hotjob.cn.evil.invalid'),
    AUTOSAVE.replace('SU629dbc0c0dcad452299bc0f7', 'different-tenant'),
    AUTOSAVE.replace('https://', 'https://private-user:private-password@'), 'not a URL'
  ]) assert.equal(runner.isEducationAutosave({ method: 'POST', url }), false, url);
  const fictionalPage = 'https://fixture.invalid/fictional-tenant/pb/resumeOperation.html';
  assert.equal(runner.isEducationAutosave({ method: 'POST', url: 'https://fixture.invalid/wecruit/resume/info/edit/fictional-tenant' }, fictionalPage), true);
  assert.equal(runner.isEducationAutosave({ method: 'POST', url: AUTOSAVE }, fictionalPage), false);
});

for (const [label, originals, delay, nested] of [
  ['empty originals', undefined, 0, false],
  ['whitespace originals and nested autosave later than the old 500 ms wait', { major: ' \t ', description: '\n \t\n' }, 650, true],
  ['private originals', { major: ` ${PRIVATE} `, description: `\n${PRIVATE}\n` }, 0, false]
]) {
  test(`shipped text writer verifies serialization and restores ${label} while XHR never reaches native send`, async t => {
    const { window, inputs, api, native, readProof } = await educationDom(t, { originals });
    const before = readProof();
    const observed = installSyntheticAutosave(window, inputs, { delay, nested });
    const result = await runTrial(api);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.restored, true);
    assert.equal(result.pageLeftAsFound, true);
    assert.equal(result.liveSupportClaimed, false);
    assert.equal(result.productReason, 'education_records_partial');
    assert.ok(result.readbacks.every(row => row.ok && row.reason === 'readback_matched'));
    for (const [key, input] of Object.entries(inputs)) assert.equal(input.value, originals?.[key] || '');
    assert.deepEqual(readProof().serialized, before.serialized, 'the shipped DTO reader confirms exact restored serialization');
    for (const type of ['input', 'change', 'blur']) assert.ok(observed.some(row => row.type === type));
    const suppressed = plain(api.suppressedAutosave());
    assertSuppressed(suppressed);
    assert.equal(suppressed.length, observed.length, 'all scheduled event autosaves were settled before the result');
    assert.ok(suppressed.some(row => row.phase === 'trial'));
    assert.ok(suppressed.some(row => row.phase === 'restore'));
    assert.deepEqual(plain(api.posts()), []);
    assert.deepEqual(plain(api.clicks()), []);
    assert.equal(native.sends, 0);
    assert.equal(window.fixtureCounts.saves, 0);
    assert.equal(window.fixtureCounts.submits, 0);
    const cleanup = await api.cleanup();
    assert.equal(cleanup.ok, true);
    assert.deepEqual(plain(cleanup.suppressedAutosave), suppressed);
    assert.equal(window.__cmsEducationLive, undefined);
    assert.equal(JSON.stringify({ result, cleanup }).includes(PRIVATE), false);
    assert.equal(JSON.stringify({ result, cleanup }).includes('private-applicant-token'), false);
  });
}

test('suppression remains armed through cleanup, then restores native XHR hooks', async t => {
  const { window, api, native } = await educationDom(t);
  const result = await runTrial(api);
  assert.equal(result.ok, true, JSON.stringify(result));
  sendXhr(window);
  const rows = plain(api.suppressedAutosave());
  assertSuppressed(rows);
  assert.equal(rows.at(-1).phase, 'restore');
  assert.equal(native.sends, 0);
  const cleanup = await api.cleanup();
  assert.equal(cleanup.ok, true);
  sendXhr(window);
  assert.equal(native.sends, 1, 'the test-only native stub is restored after successful cleanup');
});

for (const [label, options] of [
  ['undefined callback', { callback: undefined }],
  ['null callback', { callback: null }],
  ['executable string callback', {}],
  ['executable string callback with omitted delay', { omitDelay: true }],
  ['string callback scheduling promise and function timer autosave', { nested: true }]
]) {
  test(`short ${label} drains without a sticky unverifiable-timer failure`, async t => {
    const originals = { major: ` ${PRIVATE} `, description: `\n${PRIVATE}\n` };
    const { window, inputs, api, native, readProof } = await educationDom(t, { originals });
    const before = readProof();
    const observed = installNonFunctionAutosave(window, inputs, options);
    const result = await runTrial(api);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.restored, true);
    assert.equal(result.pageLeftAsFound, true);
    assert.equal(result.liveSupportClaimed, false);
    assert.equal(result.readbacks.length, 2);
    assert.ok(result.readbacks.every(row => row.ok && row.reason === 'readback_matched'));
    for (const [key, input] of Object.entries(inputs)) assert.equal(input.value, originals[key]);
    assert.deepEqual(readProof().serialized, before.serialized);
    const suppressed = plain(api.suppressedAutosave());
    assertSuppressed(suppressed);
    assert.equal(suppressed.length, observed.length, 'native callbacks and nested continuations finish before restoration is claimed');
    assert.ok(suppressed.some(row => row.phase === 'trial'));
    assert.ok(suppressed.some(row => row.phase === 'restore'));
    assertTimerDiagnostics(api.timerSettle(), { observed: true });
    assertTimerDiagnostics(result.timerSettle, { observed: true });
    assert.equal(native.sends, 0);
    assert.deepEqual(plain(api.posts()), []);
    assert.deepEqual(plain(api.clicks()), []);
    const cleanup = await api.cleanup();
    assert.equal(cleanup.ok, true, JSON.stringify(cleanup));
    assertTimerDiagnostics(cleanup.timerSettle, { observed: true });
    assert.equal(window.__cmsEducationLive, undefined);
    assert.equal(JSON.stringify({ result, cleanup }).includes(PRIVATE), false);
  });
}

test('cancelled string timeouts, intervals, and opaque delays clear pending work with shared native handle semantics', async t => {
  const { window, api, native } = await educationDom(t);
  const result = await runTrial(api);
  assert.equal(result.ok, true, JSON.stringify(result));
  let coercions = 0;
  let cancelCoercions = 0;
  const originalCallback = 'throw new Error("cancelled_synthetic_callback_executed")';
  for (const [index, [schedule, cancel]] of [
    ['setTimeout', 'clearTimeout'], ['setInterval', 'clearInterval'],
    ['setTimeout', 'clearInterval'], ['setInterval', 'clearTimeout']
  ].entries()) {
    const handle = window[schedule](originalCallback, 60000);
    assert.ok(api.timerSettle().pendingTimers > 0);
    const cancelledHandle = index === 2 ? String(handle)
      : index === 3 ? { valueOf() { cancelCoercions += 1; return handle; } } : handle;
    window[cancel](cancelledHandle);
    assertTimerDiagnostics(api.timerSettle());
  }
  assert.equal(cancelCoercions, 1, 'native timer ID coercion happens once even when cancellation also removes observer metadata');
  for (const delay of ['60000', { valueOf() { coercions += 1; return 60000; } }]) {
    const handle = window.setTimeout(originalCallback, delay);
    assert.equal(api.timerSettle().unobservableTimers, 1);
    window.clearTimeout(handle);
    assertTimerDiagnostics(api.timerSettle());
  }
  assert.equal(coercions, 1, 'opaque delay coercion belongs only to the original native scheduler');
  const cleanup = await api.cleanup();
  assert.equal(cleanup.ok, true, JSON.stringify(cleanup));
  assertTimerDiagnostics(cleanup.timerSettle);
  assert.equal(native.sends, 0);
});

test('a function timer cannot settle a newly scheduled callback that reuses its cleared timer ID', async t => {
  let backend;
  const { window, api } = await educationDom(t, { beforeTrial(view) { backend = installReusingTimerBackend(view); } });
  const result = await runTrial(api);
  assert.equal(result.ok, true, JSON.stringify(result));
  let firstHandle, replacementHandle;
  firstHandle = window.setTimeout(() => {
    window.clearTimeout(firstHandle);
    replacementHandle = window.setTimeout(() => { throw new Error('synthetic_replacement_must_stay_pending'); }, 60000);
  }, 0);
  await backend.wait(20);
  assert.equal(replacementHandle, firstHandle, 'the synthetic backend deliberately reuses an ID inside its old callback');
  assert.equal(api.timerSettle().pendingTimers, 1, 'the completed wrapper owns only its original timer generation');
  assert.deepEqual(backend.handles(), [replacementHandle]);
  window.clearTimeout(replacementHandle);
  assertTimerDiagnostics(api.timerSettle());
  assert.equal((await api.cleanup()).ok, true);
});

test('directly cancelling a companion observer fails closed without later cancelling a reused unrelated timer ID', async t => {
  let backend;
  const { window, api } = await educationDom(t, { beforeTrial(view) { backend = installReusingTimerBackend(view); } });
  const result = await runTrial(api);
  assert.equal(result.ok, true, JSON.stringify(result));
  const originalHandle = window.setTimeout('void 0', 60000);
  const observerHandle = backend.handles().find(handle => handle !== originalHandle);
  assert.ok(Number.isInteger(observerHandle));
  assert.equal(api.timerSettle().pendingTimers, 1);
  assert.equal(api.timerSettle().unobservableTimers, 0);
  window.clearTimeout(observerHandle);
  assert.equal(api.timerSettle().pendingTimers, 1);
  assert.equal(api.timerSettle().unobservableTimers, 1, 'without its observer the original native callback is unresolved');
  const replacementHandle = window.setTimeout(() => { throw new Error('synthetic_reused_observer_id_must_stay_pending'); }, 60000);
  assert.equal(replacementHandle, observerHandle);
  window.clearTimeout(originalHandle);
  assert.equal(api.timerSettle().pendingTimers, 1);
  assert.equal(api.timerSettle().unobservableTimers, 0);
  assert.deepEqual(backend.handles(), [replacementHandle], 'stale observer metadata cannot cancel the unrelated replacement callback');
  window.clearTimeout(replacementHandle);
  assertTimerDiagnostics(api.timerSettle());
  assert.equal((await api.cleanup()).ok, true);
});

test('borrowing an armed timer scheduler onto a foreign receiver fails before scheduling and retains the guard', async t => {
  const { window, api } = await educationDom(t);
  const result = await runTrial(api);
  assert.equal(result.ok, true, JSON.stringify(result));
  let callbacks = 0;
  for (const schedule of ['setTimeout', 'setInterval']) {
    assert.throws(() => window[schedule].call({}, () => { callbacks += 1; }, 0), /autosave_timer_receiver_unobservable/u);
  }
  assertTimerDiagnostics(api.timerSettle());
  const cleanup = await api.cleanup();
  assert.equal(cleanup.ok, false);
  assert.equal(cleanup.reason, 'autosave_timer_receiver_unobservable');
  assert.equal(callbacks, 0);
  assert.equal(window.__cmsEducationLive, api);
});

test('a borrowed foreign timer cancellation cannot remove a colliding local pending timer', async t => {
  let foreignClears = 0;
  const { window, api } = await educationDom(t, { beforeTrial(view) {
    const clearTimeout = view.clearTimeout;
    view.clearTimeout = function (handle) {
      if (this !== view) { foreignClears += 1; throw new TypeError('synthetic_foreign_clear_receiver'); }
      return clearTimeout.call(view, handle);
    };
  } });
  const result = await runTrial(api);
  assert.equal(result.ok, true, JSON.stringify(result));
  const localHandle = window.setTimeout(() => { throw new Error('synthetic_local_callback_must_stay_pending'); }, 60000);
  assert.throws(() => window.clearTimeout.call({}, localHandle), /synthetic_foreign_clear_receiver/u);
  assert.equal(foreignClears, 1);
  assert.equal(api.timerSettle().pendingTimers, 1, 'foreign and local native timer ID spaces cannot share ownership');
  window.clearTimeout(localHandle);
  assertTimerDiagnostics(api.timerSettle());
  assert.equal((await api.cleanup()).ok, true);
});

test('a long executable string timeout remains pending and retains the Never-Save guard', async t => {
  const originals = { major: ` ${PRIVATE} `, description: `\n${PRIVATE}\n` };
  const { window, inputs, api, native, readProof } = await educationDom(t, { originals });
  const before = readProof();
  window.__syntheticEducationAutosave = () => sendXhr(window);
  inputs.major.addEventListener('input', () => window.setTimeout('__syntheticEducationAutosave()', 60000), { once: true });
  const result = await runTrial(api);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'autosave_callbacks_pending');
  assert.equal(result.pageLeftAsFound, false);
  assert.equal(result.liveSupportClaimed, false);
  assert.ok(result.timerSettle.pendingTimers > 0);
  assert.equal(result.timerSettle.unobservableTimers, 0);
  for (const [key, input] of Object.entries(inputs)) assert.equal(input.value, originals[key]);
  assert.deepEqual(readProof().serialized, before.serialized);
  const cleanup = await api.cleanup();
  assert.equal(cleanup.ok, false);
  assert.equal(cleanup.reason, 'autosave_callbacks_pending');
  assert.ok(cleanup.timerSettle.pendingTimers > 0);
  assert.equal(window.__cmsEducationLive, api);
  sendXhr(window);
  assertSuppressed(plain(api.suppressedAutosave()));
  assert.equal(native.sends, 0);
});

for (const [label, makeDelay] of [
  ['string delay', () => '60000'],
  ['object delay', () => ({ valueOf: () => 60000 })]
]) {
  test(`an uncancelled non-function callback with ${label} early-stops with explicit opaque-delay evidence`, async t => {
    const originals = { major: 'original major', description: 'original description' };
    const { window, inputs, api, native } = await educationDom(t, { originals });
    inputs.major.addEventListener('input', () => window.setTimeout('void 0', makeDelay()), { once: true });
    const result = await runTrial(api);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'autosave_timer_unobservable');
    assert.equal(result.pageLeftAsFound, false);
    assert.equal(result.liveSupportClaimed, false);
    assert.ok(result.timerSettle.unobservableTimers > 0);
    for (const [key, input] of Object.entries(inputs)) assert.equal(input.value, originals[key]);
    const cleanup = await api.cleanup();
    assert.equal(cleanup.ok, false);
    assert.equal(cleanup.reason, 'autosave_timer_unobservable');
    assert.ok(cleanup.timerSettle.unobservableTimers > 0);
    assert.equal(window.__cmsEducationLive, api);
    sendXhr(window);
    assert.equal(native.sends, 0);
  });
}

test('an uncancelled executable string interval remains pending until explicitly cleared', async t => {
  const { window, inputs, api, native } = await educationDom(t);
  let handle;
  inputs.major.addEventListener('input', () => { handle = window.setInterval('void 0', 60000); }, { once: true });
  const result = await runTrial(api);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'autosave_callbacks_pending');
  assert.ok(api.timerSettle().pendingTimers > 0);
  const unresolved = await api.cleanup();
  assert.equal(unresolved.ok, false);
  assert.equal(window.__cmsEducationLive, api);
  window.clearInterval(handle);
  assertTimerDiagnostics(api.timerSettle());
  const cleanup = await api.cleanup();
  assert.equal(cleanup.ok, true, JSON.stringify(cleanup));
  assert.equal(window.__cmsEducationLive, undefined);
  assert.equal(native.sends, 0);
});

test('an unrelated non-GET inside a short string timeout remains fatal after timer completion', async t => {
  const { window, inputs, api, native } = await educationDom(t);
  window.__syntheticForbiddenRequest = () => sendXhr(window, { url: `${AUTOSAVE}/unrelated` });
  inputs.major.addEventListener('input', () => window.setTimeout('__syntheticForbiddenRequest()', 0), { once: true });
  const result = await runTrial(api);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'non_get_request');
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(api.posts().length, 1);
  assert.deepEqual(plain(api.suppressedAutosave()), []);
  assertTimerDiagnostics(api.timerSettle(), { observed: true });
  assert.equal(native.sends, 0);
  await api.cleanup();
});

test('exact autosave uses the captured prototype abort despite an instance override', async t => {
  const { window, inputs, api, native } = await educationDom(t);
  let overriddenAborts = 0;
  inputs.major.addEventListener('input', () => {
    const xhr = new window.XMLHttpRequest();
    xhr.open('POST', AUTOSAVE);
    xhr.abort = () => { overriddenAborts += 1; throw new Error('synthetic_instance_abort_override'); };
    xhr.send(PRIVATE);
  }, { once: true });
  const result = await runTrial(api);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(overriddenAborts, 0);
  assertSuppressed(plain(api.suppressedAutosave()));
  assert.equal(native.sends, 0);
  assert.equal((await api.cleanup()).ok, true);
});

test('an exact autosave whose native abort throws is recorded and fails with guards retained', async t => {
  let aborts = 0;
  const { window, inputs, api, native } = await educationDom(t, { beforeTrial(view) {
    const abort = view.XMLHttpRequest.prototype.abort;
    view.XMLHttpRequest.prototype.abort = function (...args) {
      aborts += 1;
      abort.apply(this, args);
      throw new Error('synthetic_private_abort_error');
    };
  } });
  inputs.major.addEventListener('input', () => sendXhr(window), { once: true });
  const result = await runTrial(api);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'autosave_abort_failed');
  assert.equal(result.liveSupportClaimed, false);
  assert.ok(aborts > 0);
  const suppressed = plain(api.suppressedAutosave());
  assert.equal(suppressed.length, 1);
  assert.deepEqual(suppressed[0], { ...suppressionRow(), abortFailed: true });
  assert.deepEqual(plain(api.posts()), []);
  const cleanup = await api.cleanup();
  assert.equal(cleanup.ok, false);
  assert.equal(cleanup.reason, 'autosave_abort_failed');
  assert.deepEqual(plain(cleanup.suppressedAutosave), suppressed);
  assert.equal(window.__cmsEducationLive, api);
  assert.equal(native.sends, 0);
  assert.equal(JSON.stringify({ result, cleanup }).includes('synthetic_private_abort_error'), false);
});

test('an unbounded delayed autosave fails with its guard still installed', async t => {
  const originals = { major: ' \t ', description: '\n \t\n' };
  const { window, inputs, api, native, readProof } = await educationDom(t, { originals });
  const before = readProof();
  let scheduled = false;
  inputs.major.addEventListener('input', () => {
    if (!scheduled) { scheduled = true; window.setTimeout(() => sendXhr(window), 60000); }
  });
  const result = await runTrial(api);
  assert.equal(result.ok, false);
  assert.equal(result.pageLeftAsFound, false);
  assert.equal(result.liveSupportClaimed, false);
  for (const [key, input] of Object.entries(inputs)) assert.equal(input.value, originals[key], 'pending callbacks do not prevent best-effort exact text restoration');
  assert.deepEqual(readProof().serialized, before.serialized);
  const cleanup = await api.cleanup();
  assert.equal(cleanup.ok, false, 'pending callback ownership cannot be claimed as settled');
  assert.equal(window.__cmsEducationLive, api, 'keep interception in place while scheduled work is unresolved');
  sendXhr(window);
  assert.equal(native.sends, 0);
});

test('late cleanup mutation is restored even when a tracked timer outlives the settle budget', async t => {
  const originals = { major: ` ${PRIVATE} `, description: `\n${PRIVATE}\n` };
  const { window, inputs, api, native, readProof } = await educationDom(t, { originals });
  const before = readProof();
  const result = await runTrial(api);
  assert.equal(result.ok, true, JSON.stringify(result));
  for (const [key, input] of Object.entries(inputs)) assert.equal(input.value, originals[key]);
  let mutated = false;
  // Both callbacks are synthetic tracked work created after successful restore.
  // Cleanup enters with matching originals, then the first callback makes them
  // dirty while the second prevents a settled/untouched-page claim.
  window.setTimeout(() => {
    mutated = true;
    inputs.major.value = `late-${PRIVATE}`;
    inputs.major.dispatchEvent(new window.Event('input', { bubbles: true }));
  }, 0);
  window.setTimeout(() => sendXhr(window), 60000);
  const cleanup = await api.cleanup();
  assert.equal(mutated, true);
  assert.equal(cleanup.ok, false);
  for (const [key, input] of Object.entries(inputs)) assert.equal(input.value, originals[key], 'cleanup restores exact originals after a drain mutates them');
  assert.deepEqual(readProof().serialized, before.serialized);
  assert.equal(window.__cmsEducationLive, api, 'unsettled cleanup retains its interception guard');
  sendXhr(window);
  assert.equal(native.sends, 0);
  assert.equal(JSON.stringify(cleanup).includes(PRIVATE), false);
});

test('an exact autosave attempted before trial arming remains a forbidden request', async t => {
  const { window, api, native } = await educationDom(t);
  sendXhr(window);
  assert.equal(api.prepare().ok, false);
  assert.deepEqual(plain(api.suppressedAutosave()), []);
  assert.equal(api.posts().length, 1);
  assert.equal(native.sends, 0);
  await api.cleanup();
});

test('XHR opened before arming cannot become an authorized autosave by sending during a write', async t => {
  const { window, inputs, api, native } = await educationDom(t);
  const xhr = new window.XMLHttpRequest();
  xhr.open('POST', AUTOSAVE);
  inputs.major.addEventListener('input', () => xhr.send(PRIVATE), { once: true });
  const result = await runTrial(api);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'non_get_request');
  assert.deepEqual(plain(api.suppressedAutosave()), []);
  assert.equal(api.posts().length, 1);
  assert.equal(native.sends, 0);
  await api.cleanup();
});

for (const [label, attempt] of [
  ['different tenant', window => sendXhr(window, { url: AUTOSAVE.replace('SU629dbc0c0dcad452299bc0f7', 'different-tenant') })],
  ['different path', window => sendXhr(window, { url: `${AUTOSAVE}/unexpected` })],
  ['different origin', window => sendXhr(window, { url: AUTOSAVE.replace('wecruit.hotjob.cn', 'fixture.invalid') })],
  ['query-bearing URL', window => sendXhr(window, { url: `${AUTOSAVE}?private-query=value` })],
  ['PUT method', window => sendXhr(window, { method: 'PUT' })],
  ['HEAD method', window => sendXhr(window, { method: 'HEAD' })],
  ['OPTIONS method', window => sendXhr(window, { method: 'OPTIONS' })],
  ['matching fetch', window => { window.fetch(AUTOSAVE, { method: 'POST', body: PRIVATE }).catch(() => {}); }],
  ['matching beacon', window => window.navigator.sendBeacon(AUTOSAVE, PRIVATE)]
]) {
  test(`${label} remains fatal even when triggered by the shipped education writer`, async t => {
    const { window, inputs, api, native } = await educationDom(t);
    inputs.major.addEventListener('input', () => attempt(window), { once: true });
    const result = await runTrial(api);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'non_get_request');
    assert.equal(result.liveSupportClaimed, false);
    assert.deepEqual(plain(api.suppressedAutosave()), []);
    assert.equal(api.posts().length, 1);
    assert.equal(native.sends, 0);
    assert.equal(native.beacons, 0);
    assert.equal(JSON.stringify({ result, posts: api.posts() }).includes(PRIVATE), false);
    assert.equal(JSON.stringify(api.posts()).includes('private-query'), false);
    await api.cleanup();
  });
}

async function runFake(t, { pageWindow, onStep, answers } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-education-autosave-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const calls = [];
  let emit;
  const session = {
    async send(method, params = {}, options = {}) {
      const step = options.step || method;
      calls.push({ method, params, step });
      if (onStep) await onStep(step, event => emit(event));
      if (method !== 'Runtime.evaluate') return {};
      const value = pageWindow ? await pageWindow.eval(params.expression) : answers[step];
      if (value instanceof Error) throw value;
      return { result: { value } };
    },
    close() { calls.push({ method: 'close', step: 'close' }); }
  };
  const evidence = await runner.runCmsEducationLive({
    env: {}, port: 9239, outDir: dir, tipSha: runner.BASE_TIP, stepTimeoutMs: 1000,
    getJson: async () => [target()],
    connectCdp: async (_url, options) => { emit = options.onEvent; return session; }
  });
  return { evidence, calls, dir };
}

function suppressionRow(phase = 'trial') {
  return { method: 'POST', url: AUTOSAVE, via: 'xhr', blockedBeforeSend: true, phase };
}

function happyAnswers(overrides = {}) {
  const identities = [JSON.stringify(['14_53_0', '14_55_0'])];
  return {
    page_guard: { href: LIVE_URL, title: 'Offline resume', readyState: 'complete', visible: 'visible', password: false },
    install_live: { ok: true },
    'inject_cms-session': { ok: true },
    'inject_cms-record-controller': { ok: true },
    'inject_cms-education-multi': { ok: true },
    education_prepare: { ok: true, rowIndex: 0, recordCount: 1, identity: identities[0], identities },
    education_run: {
      ok: true, reason: null, liveSupportClaimed: false, rowIndex: 0, recordCount: 1,
      productReason: 'education_records_partial', restored: true, pageLeftAsFound: true,
      otherChanged: false, waitedMs: runner.READBACK_WAIT_MS,
      readbacks: runner.FIELD_SPECS.map(spec => ({ path: spec.path, key: spec.key, ok: true, reason: 'readback_matched', value: spec.fixture }))
    },
    read_posts: [], read_clicks: [], read_suppressed_autosave: [],
    cleanup: { ok: true, posts: [], clicks: [], suppressedAutosave: [] },
    ...overrides
  };
}

test('host suppression evidence preserves repeated attempts without double counting read and cleanup snapshots', async t => {
  const { evidence } = await runFake(t, { answers: happyAnswers({
    read_suppressed_autosave: [suppressionRow(), suppressionRow()],
    cleanup: { ok: true, posts: [], clicks: [], suppressedAutosave: [suppressionRow(), suppressionRow(), suppressionRow(), suppressionRow('restore')] }
  }) });
  assert.equal(evidence.finalDetails.exitCode, 0, JSON.stringify(evidence));
  assert.equal(evidence.suppressedAutosave.length, 4);
  assert.equal(evidence.suppressedAutosave.filter(row => row.phase === 'trial').length, 3);
  assert.equal(evidence.suppressedAutosave.filter(row => row.phase === 'restore').length, 1);
  assert.deepEqual(evidence.nonGet, []);
  assert.deepEqual(evidence.saveLikePost, []);
});

test('cleanup cannot erase suppressed autosave already observed by the host', async t => {
  const { evidence } = await runFake(t, { answers: happyAnswers({ read_suppressed_autosave: [suppressionRow()] }) });
  assert.equal(evidence.finalDetails.exitCode, 0, JSON.stringify(evidence));
  assert.deepEqual(evidence.suppressedAutosave, [suppressionRow()]);
});

for (const phase of ['read', 'cleanup']) {
  test(`host preserves abort-failure suppression evidence from ${phase} and rejects an otherwise happy result`, async t => {
    const failed = { ...suppressionRow(), abortFailed: true };
    const overrides = phase === 'read'
      ? { read_suppressed_autosave: [failed] }
      : { cleanup: { ok: true, posts: [], clicks: [], suppressedAutosave: [failed] } };
    const { evidence, calls } = await runFake(t, { answers: happyAnswers(overrides) });
    assert.notEqual(evidence.finalDetails.exitCode, 0, JSON.stringify(evidence));
    assert.equal(evidence.finalDetails.reason, 'autosave_abort_failed');
    assert.equal(evidence.finalDetails.cleanupOk, false);
    assert.equal(evidence.finalDetails.pageLeftAsFound, false);
    assert.equal(evidence.liveSupportClaimed, false);
    assert.deepEqual(evidence.suppressedAutosave, [failed]);
    assert.deepEqual(evidence.nonGet, []);
    assert.deepEqual(evidence.saveLikePost, []);
    assert.equal(calls.some(call => call.method === 'Fetch.disable'), false, 'known abort failure keeps host interception armed');
  });
}

for (const [label, rows] of [
  ['missing suppression array', undefined],
  ['failed suppression read', new Error('read unavailable')],
  ['not blocked before send', [{ ...suppressionRow(), blockedBeforeSend: false }]],
  ['fetch masquerading as suppressed', [{ ...suppressionRow(), via: 'fetch' }]],
  ['CDP masquerading as suppressed', [{ ...suppressionRow(), via: 'cdp_intercept' }]],
  ['unknown phase', [{ ...suppressionRow(), phase: 'before_trial' }]],
  ['wrong endpoint', [{ ...suppressionRow(), url: `${AUTOSAVE}/different` }]],
  ['query-bearing endpoint', [{ ...suppressionRow(), url: `${AUTOSAVE}?private-query=value` }]],
  ['wrong method', [{ ...suppressionRow(), method: 'PUT' }]]
]) {
  test(`${label} cannot produce successful host evidence`, async t => {
    const { evidence } = await runFake(t, { answers: happyAnswers({ read_suppressed_autosave: rows }) });
    assert.notEqual(evidence.finalDetails.exitCode, 0);
    assert.equal(evidence.liveSupportClaimed, false);
    assert.equal(JSON.stringify(evidence).includes('private-query'), false);
  });
}

test('cleanup must also return a valid suppression snapshot', async t => {
  for (const suppressedAutosave of [undefined, [{ ...suppressionRow(), blockedBeforeSend: false }]]) {
    const { evidence } = await runFake(t, { answers: happyAnswers({ cleanup: { ok: true, posts: [], clicks: [], suppressedAutosave } }) });
    assert.notEqual(evidence.finalDetails.exitCode, 0);
    assert.equal(evidence.finalDetails.cleanupOk, false);
  }
});

test('malformed cleanup suppression cannot erase late forbidden POST or click evidence', async t => {
  const { evidence } = await runFake(t, { answers: happyAnswers({ cleanup: {
    ok: true,
    posts: [{ method: 'POST', url: AUTOSAVE, via: 'fetch' }],
    clicks: [{ type: 'click', label: 'click' }],
    suppressedAutosave: [{ ...suppressionRow(), blockedBeforeSend: false }]
  } }) });
  assert.equal(evidence.finalDetails.exitCode, 3);
  assert.equal(evidence.finalDetails.cleanupOk, false);
  assert.equal(evidence.finalDetails.clickCount, 1);
  assert.equal(evidence.nonGet.some(row => row.method === 'POST' && row.url === AUTOSAVE && row.via === 'fetch'), true);
  assert.equal(evidence.saveLikePost.some(row => row.method === 'POST' && row.url === AUTOSAVE && row.via === 'fetch'), true);
  assert.equal(evidence.liveSupportClaimed, false);
});

test('fake CDP with the shipped writer separates suppressed autosave from traffic and preserves all unsupported skips', async t => {
  const { window, inputs, native } = await educationDom(t, { installTrial: false,
    originals: { major: ` ${PRIVATE} `, description: `\n${PRIVATE}\n` } });
  const observed = installSyntheticAutosave(window, inputs);
  const { evidence, calls, dir } = await runFake(t, { pageWindow: window });
  assert.equal(evidence.finalDetails.exitCode, 0, JSON.stringify(evidence));
  assert.equal(evidence.neverSave, true);
  assert.equal(evidence.liveSupportClaimed, false);
  assert.equal(evidence.finalDetails.liveSupportClaimed, false);
  assert.equal(evidence.finalDetails.clickCount, 0);
  assert.equal(evidence.finalDetails.restored, true);
  assert.equal(evidence.finalDetails.pageLeftAsFound, true);
  assert.deepEqual(evidence.nonGet, []);
  assert.deepEqual(evidence.saveLikePost, []);
  assertSuppressed(evidence.suppressedAutosave);
  assert.equal(evidence.suppressedAutosave.length, observed.length, 'snapshot plus cleanup does not double count suppression');
  for (const spec of runner.FIELD_SPECS) assert.equal(evidence.fields.find(row => row.path === spec.path)?.status, 'verified');
  for (const q of runner.UNCLAIMED) {
    const field = evidence.fields.find(row => row.q === q);
    assert.equal(field.status, 'skipped');
    assert.equal(field.reason, 'control_not_supported');
    assert.equal(field.value, null);
  }
  assert.equal(native.sends, 0);
  assert.equal(window.fixtureCounts.saves, 0);
  assert.equal(window.fixtureCounts.submits, 0);
  assert.equal(calls.some(call => /^Input\.|Page\.navigate/u.test(call.method)), false);
  assert.equal(window.__cmsEducationLive, undefined);
  assert.equal(JSON.stringify(evidence).includes(PRIVATE), false);
  assert.equal(JSON.stringify(evidence).includes('private-applicant-token'), false);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, runner.EVIDENCE_NAME), 'utf8')), evidence);
});

test('fake CDP short string timers verify and restore both text fields while the seven unsupported controls remain skipped', async t => {
  const originals = { major: ` ${PRIVATE} `, description: `\n${PRIVATE}\n` };
  const { window, inputs, native, readProof } = await educationDom(t, { installTrial: false, originals });
  const before = readProof();
  const observed = installNonFunctionAutosave(window, inputs, { nested: true });
  const { evidence } = await runFake(t, { pageWindow: window });
  assert.equal(evidence.finalDetails.exitCode, 0, JSON.stringify(evidence));
  assert.equal(evidence.neverSave, true);
  assert.equal(evidence.liveSupportClaimed, false);
  assert.equal(evidence.finalDetails.liveSupportClaimed, false);
  assert.equal(evidence.finalDetails.clickCount, 0);
  assert.equal(evidence.finalDetails.restored, true);
  assert.equal(evidence.finalDetails.pageLeftAsFound, true);
  assert.equal(evidence.fields.filter(row => row.status === 'verified').length, 2);
  const skipped = evidence.fields.filter(row => row.status === 'skipped');
  assert.equal(skipped.length, 7);
  assert.ok(skipped.every(row => row.reason === 'control_not_supported' && row.value === null));
  assertSuppressed(evidence.suppressedAutosave);
  assert.equal(evidence.suppressedAutosave.length, observed.length);
  assert.deepEqual(evidence.nonGet, []);
  assert.deepEqual(evidence.saveLikePost, []);
  for (const [key, input] of Object.entries(inputs)) assert.equal(input.value, originals[key]);
  assert.deepEqual(readProof().serialized, before.serialized);
  assert.equal(native.sends, 0);
  assert.equal(window.fixtureCounts.saves, 0);
  assert.equal(window.fixtureCounts.submits, 0);
  assert.equal(window.__cmsEducationLive, undefined);
  assert.equal(JSON.stringify(evidence).includes(PRIVATE), false);
});

for (const eventMethod of ['Fetch.requestPaused', 'Network.requestWillBeSent']) {
  test(`an exact autosave seen by ${eventMethod} is still a fatal escape from the pre-send guard`, async t => {
    const { window } = await educationDom(t, { installTrial: false });
    let emitted = false;
    const { evidence, calls } = await runFake(t, { pageWindow: window, onStep(step, emit) {
      if (step !== 'education_run' || emitted) return;
      emitted = true;
      emit({ method: eventMethod, params: { requestId: 'escaped-autosave', request: { method: 'POST', url: AUTOSAVE } } });
    } });
    assert.equal(evidence.finalDetails.exitCode, 3);
    assert.equal(evidence.finalDetails.reason, 'non_get_request');
    assert.equal(evidence.liveSupportClaimed, false);
    assert.equal(evidence.nonGet.some(row => row.url === AUTOSAVE && row.method === 'POST'), true);
    assert.deepEqual(evidence.suppressedAutosave, []);
    if (eventMethod === 'Fetch.requestPaused') assert.equal(calls.some(call => call.method === 'Fetch.failRequest' && call.params.requestId === 'escaped-autosave'), true);
  });
}
