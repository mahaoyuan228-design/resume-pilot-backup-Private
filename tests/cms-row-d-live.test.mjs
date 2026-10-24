/**
 * Offline runner contract tests. CDP is always fake; jsdom topology is
 * synthetic. Passing these tests cannot establish live support or book +12.
 * Every temporary artifact stays under this repository's _temp-scripts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import {
  ROW_D_FIELDS, ROW_D_PAGE, buildCmsRowDOptionsProbeExpression
} from '../scripts/lib/cms-row-d-options.mjs';
import {
  ROW_D_LIVE_BASE_TIP, EVIDENCE_NAME, HELP, rowDTemporaryPath,
  readRowDProbeConfig, selectRowDTarget, createRowDNetworkGuard,
  rowDProbeEvidence, runCmsRowDLive
} from '../scripts/live/cms-row-d-live.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = path.join(root, '_temp-scripts');
const runner = path.join(root, 'scripts/live/cms-row-d-live.mjs');
const PRIVATE = 'SYNTHETIC_ROW_D_PRIVATE_DO_NOT_SERIALIZE';
const FLAGS = { neverSave: true, liveSupportClaimed: false, livePassClaimed: false,
  writeStarted: false, mutationAllowed: false, valuesExposed: false, probeOnly: true };
const exactUrl = `${ROW_D_PAGE}?resumeId=${PRIVATE}&tid=${PRIVATE}#${PRIVATE}`;
const target = (changes = {}) => ({ id: 'synthetic-tab', type: 'page', url: exactUrl,
  title: PRIVATE, webSocketDebuggerUrl: 'ws://127.0.0.1:9242/devtools/page/synthetic-tab', ...changes });
const clone = value => JSON.parse(JSON.stringify(value));
const escaped = text => String(text).replace(/[&<>"']/g,
  char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function assertSafety(evidence) {
  for (const row of [evidence, ...(evidence.fields || [])]) {
    for (const [key, expected] of Object.entries(FLAGS)) assert.equal(row[key], expected, key);
  }
  assert.equal(evidence.livePassClaimed, false);
  assert.equal(evidence.booked, 53);
  assert.equal(evidence.probeOnly, true);
  assert.equal(evidence.visibilityBasis, 'attributes_only');
  assert.equal(evidence.restoration, 'not_needed_no_interaction');
  const json = JSON.stringify(evidence);
  assert.equal(json.includes(PRIVATE), false, 'no selected value, body, URL, or exception leaks');
  assert.doesNotMatch(json, /resumeId=|tid=|webSocketDebuggerUrl|postData|headers|stack|exceptionDetails/);
}

function temporaryDirectory(t) {
  fs.mkdirSync(temporaryRoot, { recursive: true });
  const directory = fs.mkdtempSync(path.join(temporaryRoot, 'cms-row-d-live-test-'));
  t.after(() => {
    const resolvedRoot = fs.realpathSync(temporaryRoot);
    const resolvedDirectory = fs.realpathSync(directory);
    const relative = path.relative(resolvedRoot, resolvedDirectory);
    assert.ok(relative && !path.isAbsolute(relative) && !relative.startsWith('..'));
    fs.rmSync(resolvedDirectory, { recursive: true, force: true });
  });
  return directory;
}

function syntheticDom() {
  const control = field => {
    if (field.controlKind === 'ant-select') return `<div class="ant-select"><div class="ant-select-selection" role="combobox" aria-controls="synthetic-${field.wrapperId}"><span data-private-selected>${PRIVATE}</span><input type="text" value="${PRIVATE}"></div></div>`;
    if (field.controlKind === 'ant-calendar-picker') return `<span class="ant-calendar-picker"><input readonly value="${PRIVATE}"></span>`;
    const kind = field.controlKind === 'radio-group' ? 'radio' : 'checkbox';
    return `<div class="ant-${kind}-group">${field.options.map(label => `<label class="ant-${kind}-wrapper"><input type="${kind}" value="${PRIVATE}"><span>${escaped(label)}</span></label>`).join('')}</div>`;
  };
  const sections = [...new Set(ROW_D_FIELDS.map(field => field.sectionId))].map(id =>
    `<section id="${id}" class="form-cell">${ROW_D_FIELDS.filter(field => field.sectionId === id).map(field =>
      `<div id="${field.wrapperId}"><div class="ant-form-item"><div class="ant-form-item-label"><label>${escaped(field.label)}</label></div><div class="ant-form-item-control">${control(field)}</div></div></div>`).join('')}</section>`).join('');
  // Only 25 location labels exist in the harvest. Do not invent its missing five.
  const portals = ROW_D_FIELDS.filter(field => field.controlKind === 'ant-select').map(field =>
    `<div class="ant-select-dropdown" style="display:none"><ul id="synthetic-${field.wrapperId}">${field.options.map(label => `<li role="option">${escaped(label)}</li>`).join('')}</ul></div>`).join('');
  const dom = new JSDOM(`<!doctype html><body><form>${sections}<button>保存</button></form>${portals}</body>`,
    { url: exactUrl, pretendToBeVisual: true, runScripts: 'outside-only' });
  dom.window.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  Object.defineProperty(dom.window.document, 'readyState', { get: () => 'complete' });
  Object.defineProperty(dom.window.document, 'visibilityState', { get: () => 'visible' });
  return dom;
}

function noDocumentInspection() {
  // Execute the actual expression builder without a document, rather than
  // hand-creating permissive Runtime results in the orchestration tests.
  const dom = new JSDOM('', { runScripts: 'outside-only' });
  try {
    const expression = buildCmsRowDOptionsProbeExpression();
    return clone(dom.window.eval(expression.replace('globalThis.document,', 'undefined,')));
  } finally { dom.window.close(); }
}

function fakeCdp({ targets = [target()], evaluate = () => noDocumentInspection(),
  onSend, onWait, discoveryError = false, connectError = false } = {}) {
  const calls = [];
  let observer;
  const emit = message => observer(message);
  const session = {
    async send(method, params = {}) {
      calls.push({ method, params });
      const override = onSend?.(method, params, { emit, calls });
      if (override !== undefined) return override;
      if (method === 'Runtime.evaluate') return { result: { value: evaluate(params.expression) } };
      return {};
    },
    close() { calls.push({ method: 'close' }); }
  };
  const dependencies = {
    async getTargets(port, pathname, options) {
      calls.push({ method: 'getTargets', port, pathname, options });
      if (discoveryError) throw new Error(PRIVATE);
      return targets;
    },
    async connect(ws, options) {
      calls.push({ method: 'connect', ws, options });
      if (connectError) throw new Error(PRIVATE);
      observer = options.onEvent;
      return session;
    },
    async wait(ms) {
      calls.push({ method: 'wait', ms });
      await onWait?.({ emit, calls });
    }
  };
  return { calls, emit, dependencies, run: options => runCmsRowDLive({ ...dependencies, ...options }) };
}

const methods = fake => fake.calls.map(call => call.method);
const paused = (method, url = `https://example.invalid/private?token=${PRIVATE}`, requestId = 'synthetic-request') =>
  ({ method: 'Fetch.requestPaused', params: { requestId, request: { method, url } } });

test('baseline and initial evidence preserve Never-Save, no live PASS, and booked 53', () => {
  assert.equal(ROW_D_LIVE_BASE_TIP, '53791dfe6da2a6ae2b627b8e9b945ca0d411fefc');
  const evidence = rowDProbeEvidence();
  assertSafety(evidence);
  assert.equal(evidence.ok, false);
  assert.equal(evidence.probeCompleted, false);
  assert.equal(evidence.reason, 'not_started');
  assert.equal(EVIDENCE_NAME, 'cms-row-d-live.json');
});

test('one exact tenant page with query/hash and a matching loopback socket is selected', () => {
  for (const host of ['127.0.0.1', 'localhost', '[::1]']) {
    const candidate = target({ webSocketDebuggerUrl: `ws://${host}:9242/devtools/page/synthetic-tab` });
    const choice = selectRowDTarget([{ ...target(), type: 'service_worker' }, candidate], 9242);
    assert.equal(choice.ok, true);
    assert.equal(choice.target, candidate);
  }
});

for (const [description, url] of [
  ['different tenant', ROW_D_PAGE.replace('SU629dbc0c0dcad452299bc0f7', 'SUother')],
  ['different host', ROW_D_PAGE.replace('wecruit.hotjob.cn', 'example.invalid')],
  ['HTTP page', ROW_D_PAGE.replace('https:', 'http:')],
  ['extra path', `${ROW_D_PAGE}/extra`],
  ['URL credentials', ROW_D_PAGE.replace('https://', 'https://user:secret@')],
  ['nondefault page port', ROW_D_PAGE.replace('wecruit.hotjob.cn', 'wecruit.hotjob.cn:8443')]
]) test(`target selector rejects ${description}`, () => {
  assert.deepEqual(selectRowDTarget([target({ url })], 9242), { ok: false, reason: 'target_missing' });
});

for (const ws of [
  'wss://127.0.0.1:9242/devtools/page/synthetic-tab',
  'ws://example.invalid:9242/devtools/page/synthetic-tab',
  'ws://127.0.0.1.example.invalid:9242/devtools/page/synthetic-tab',
  'ws://user:secret@localhost:9242/devtools/page/synthetic-tab',
  'ws://127.0.0.1:9239/devtools/page/synthetic-tab',
  'ws://127.0.0.1/devtools/page/synthetic-tab',
  'ws://127.0.0.1:9242/devtools/page/different-tab',
  `ws://127.0.0.1:9242/devtools/page/synthetic-tab?${PRIVATE}`,
  `ws://127.0.0.1:9242/devtools/page/synthetic-tab#${PRIVATE}`,
  'invalid'
]) test(`target selector rejects unsafe or mismatched socket ${ws.split('?')[0].split('#')[0]}`, () => {
  assert.deepEqual(selectRowDTarget([target({ webSocketDebuggerUrl: ws })], 9242),
    { ok: false, reason: 'target_socket_invalid' });
});

test('ambiguous, missing, malformed target inventories never attach or inspect', async () => {
  for (const [targets, expected] of [
    [[target(), target({ id: 'second' })], 'target_ambiguous'],
    [[], 'target_missing'], [null, 'targets_invalid'], [{} , 'targets_invalid']
  ]) {
    const fake = fakeCdp({ targets });
    const evidence = await fake.run();
    assertSafety(evidence);
    assert.equal(evidence.reason, expected);
    assert.deepEqual(methods(fake), ['getTargets']);
  }
});

test('invalid requests and programmatic configuration stop before target discovery', async () => {
  for (const options of [{ port: 0 }, { port: '9242' }, { timeoutMs: 999 }, { timeoutMs: 30001 },
    { requests: { '13_47_0': PRIVATE } }, { requests: { '16_65_0': '2026-10-24' } }]) {
    const fake = fakeCdp();
    const evidence = await fake.run(options);
    assertSafety(evidence);
    assert.equal(evidence.reason, 'config_invalid');
    assert.deepEqual(methods(fake), []);
  }
});

for (const failedMethod of ['Network.enable', 'Fetch.enable']) {
  test(`${failedMethod} failure prevents every Runtime.evaluate`, async () => {
    const fake = fakeCdp({ onSend(method) { if (method === failedMethod) throw new Error(PRIVATE); } });
    const evidence = await fake.run();
    assertSafety(evidence);
    assert.equal(evidence.reason, 'network_guard_failed');
    assert.equal(evidence.probeCompleted, false);
    assert.equal(methods(fake).includes('Runtime.evaluate'), false);
    assert.equal(methods(fake).at(-1), 'close');
    if (failedMethod === 'Network.enable') assert.equal(methods(fake).includes('Fetch.enable'), false);
    else assert.ok(methods(fake).includes('Network.disable'));
  });
}

test('GET continues and every non-GET aborts; traffic evidence discards raw URLs and bodies', async () => {
  const commands = [];
  const guard = createRowDNetworkGuard((method, params) => { commands.push({ method, params }); return Promise.resolve({}); });
  const get = paused('get', `https://example.invalid/${PRIVATE}`);
  guard.onEvent(get);
  let bodyReads = 0;
  const post = paused('post', `https://wecruit.hotjob.cn/private/resume/info/edit?resumeId=${PRIVATE}`, 'edit');
  for (const property of ['postData', 'headers']) Object.defineProperty(post.params.request, property,
    { get() { bodyReads += 1; throw new Error(PRIVATE); } });
  guard.onEvent(post);
  for (const method of ['HEAD', 'OPTIONS', 'PUT', 'DELETE', 'malformed method', undefined]) {
    guard.onEvent(paused(method, undefined, String(method)));
  }
  await guard.drain();
  assert.equal(bodyReads, 0);
  assert.equal(commands.filter(row => row.method === 'Fetch.continueRequest').length, 1);
  assert.equal(commands.filter(row => row.method === 'Fetch.failRequest').length, 7);
  assert.ok(commands.filter(row => row.method === 'Fetch.failRequest').every(row => row.params.errorReason === 'BlockedByClient'));
  assert.equal(guard.traffic.infoEditBlockedCount, 1);
  assert.ok(guard.traffic.records.some(row => row.endpoint === '/resume/info/edit'));
  assert.ok(guard.traffic.records.some(row => row.endpoint === 'other'));
  assert.ok(guard.traffic.records.some(row => row.method === 'UNKNOWN'));
  assert.equal(guard.failed(), true);
  assert.equal(JSON.stringify(guard.traffic).includes(PRIVATE), false);
});

test('observed info/edit and correlated response remain documented even without an intercepted request', async () => {
  const guard = createRowDNetworkGuard(() => Promise.resolve({}));
  const request = { method: 'POST', url: `https://example.invalid/resume/info/edit?token=${PRIVATE}` };
  guard.onEvent({ method: 'Network.requestWillBeSent', params: { requestId: 'observed', request } });
  guard.onEvent({ method: 'Network.responseReceived', params: { requestId: 'observed', response: { body: PRIVATE } } });
  guard.onEvent({ method: 'Network.loadingFinished', params: { requestId: 'observed' } });
  guard.onEvent({ method: 'Network.responseReceived', params: { requestId: 'observed' } });
  await guard.drain();
  assert.equal(guard.traffic.observedNonGetCount, 1);
  assert.equal(guard.traffic.infoEditObservedCount, 1);
  assert.equal(guard.traffic.responseToNonGetCount, 1);
  assert.equal(guard.traffic.blockedNonGetCount, 0);
  assert.equal(guard.failed(), true);
  assert.deepEqual(new Set(guard.traffic.records.map(row => row.endpoint)), new Set(['/resume/info/edit']));
  assert.equal(JSON.stringify(guard.traffic).includes(PRIVATE), false);
});

test('POST to GET redirect cannot misclassify the later GET response as a non-GET response', async () => {
  const guard = createRowDNetworkGuard(() => Promise.resolve({}));
  guard.onEvent({ method: 'Network.requestWillBeSent', params: { requestId: 'redirected',
    request: { method: 'POST', url: `https://example.invalid/resume/info/edit?token=${PRIVATE}` } } });
  guard.onEvent({ method: 'Network.requestWillBeSent', params: { requestId: 'redirected',
    request: { method: 'GET', url: `https://example.invalid/finished?token=${PRIVATE}` } } });
  guard.onEvent({ method: 'Network.responseReceived', params: { requestId: 'redirected' } });
  await guard.drain();
  assert.equal(guard.traffic.observedNonGetCount, 1);
  assert.equal(guard.traffic.infoEditObservedCount, 1);
  assert.equal(guard.traffic.responseToNonGetCount, 0);
  assert.equal(guard.failed(), true, 'the earlier POST observation remains a failure');
  assert.equal(JSON.stringify(guard.traffic).includes(PRIVATE), false);
});

test('encoded and case-varied info/edit paths are normalized without exposing unknown method text', async () => {
  const guard = createRowDNetworkGuard(() => Promise.resolve({}));
  guard.onEvent(paused('POST', `https://example.invalid/%72esume/INFO/EdIt?token=${PRIVATE}`, 'encoded'));
  guard.onEvent(paused('PRIVATEVALUE', `https://example.invalid/${PRIVATE}`, 'unknown-method'));
  await guard.drain();
  assert.equal(guard.traffic.infoEditBlockedCount, 1);
  assert.ok(guard.traffic.records.some(row => row.endpoint === '/resume/info/edit'));
  assert.ok(guard.traffic.records.some(row => row.method === 'UNKNOWN'));
  assert.doesNotMatch(JSON.stringify(guard.traffic), /PRIVATEVALUE/);
  assert.equal(JSON.stringify(guard.traffic).includes(PRIVATE), false);
});

for (const requestMethod of ['GET', 'POST']) test(`guard ${requestMethod} send rejection is captured without throwing from observer`, async () => {
  for (const asynchronous of [false, true]) {
    const guard = createRowDNetworkGuard(() => {
      if (asynchronous) return Promise.reject(new Error(PRIVATE));
      throw new Error(PRIVATE);
    });
    assert.doesNotThrow(() => guard.onEvent(paused(requestMethod)));
    await guard.drain();
    assert.equal(guard.traffic.commandFailed, true);
    assert.equal(guard.traffic.blockedNonGetCount, 0);
    assert.equal(guard.failed(), true);
    assert.equal(JSON.stringify(guard.traffic).includes(PRIVATE), false);
  }
});

test('oversized traffic and unreadable event metadata fail closed', async () => {
  const guard = createRowDNetworkGuard(() => Promise.resolve({}));
  for (let index = 0; index < 250; index += 1) guard.onEvent({ method: 'Network.requestWillBeSent',
    params: { requestId: index, request: { method: 'POST', url: `https://example.invalid/${PRIVATE}` } } });
  assert.equal(guard.traffic.truncated, true);
  assert.ok(guard.traffic.records.length < 250);
  const malformed = createRowDNetworkGuard(() => Promise.resolve({}));
  assert.doesNotThrow(() => malformed.onEvent({ method: 'Fetch.requestPaused', params: {
    request: Object.defineProperty({}, 'method', { get() { throw new Error(PRIVATE); } }) } }));
  await malformed.drain();
  assert.equal(malformed.traffic.commandFailed, true);
  assert.equal(malformed.failed(), true);
});

test('non-GET intercepted while Fetch guard enables stops before inspection', async () => {
  const fake = fakeCdp({ onSend(method, params, { emit }) {
    if (method === 'Fetch.enable') emit(paused('POST', `https://wecruit.hotjob.cn/resume/info/edit?resumeId=${PRIVATE}`));
  } });
  const evidence = await fake.run();
  assertSafety(evidence);
  assert.equal(evidence.reason, 'non_get_or_guard_failure');
  assert.equal(evidence.probeCompleted, false);
  assert.equal(evidence.traffic.infoEditBlockedCount, 1);
  assert.equal(methods(fake).includes('Runtime.evaluate'), false);
});

test('real serialized inspector preserves incomplete fields without current-value reads or form interaction', async () => {
  const dom = syntheticDom();
  try {
    const { window } = dom;
    const document = window.document;
    const before = document.documentElement.outerHTML;
    let attempts = 0;
    const forbidden = () => { attempts += 1; throw new Error(PRIVATE); };
    for (const input of document.querySelectorAll('input')) {
      for (const name of ['value', 'checked', 'selected']) Object.defineProperty(input, name,
        { get: forbidden, set: forbidden });
    }
    for (const node of document.querySelectorAll('[data-private-selected]')) {
      Object.defineProperty(node, 'textContent', { get: forbidden, set: forbidden });
    }
    for (const name of ['click', 'blur', 'focus']) window.HTMLElement.prototype[name] = forbidden;
    window.EventTarget.prototype.dispatchEvent = forbidden;
    for (const name of ['submit', 'requestSubmit', 'reset']) window.HTMLFormElement.prototype[name] = forbidden;
    window.fetch = forbidden;
    window.XMLHttpRequest.prototype.send = forbidden;
    window.navigator.sendBeacon = forbidden;
    const observer = new window.MutationObserver(() => {});
    observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    const fake = fakeCdp({ evaluate: expression => clone(window.eval(expression)) });
    const evidence = await fake.run({ requests: { '13_195_0': '两周', '13_102501_0': ['宏观', '策略', '债券'] } });
    assertSafety(evidence);
    assert.equal(evidence.probeCompleted, true);
    assert.equal(evidence.ok, false);
    assert.equal(evidence.reason, 'row_d_preflight_incomplete');
    assert.equal(evidence.fields.length, ROW_D_FIELDS.length);
    const field = id => evidence.fields.find(row => row.wrapperId === id);
    assert.equal(field('13_195_0').reason, 'read_only_options_preflight');
    assert.equal(field('13_100701_0').reason, 'option_dictionary_mismatch');
    assert.equal(field('13_100702_0').ok, false);
    assert.equal(field('13_102501_0').reason, 'option_dictionary_incomplete');
    assert.equal(field('16_65_0').reason, 'calendar_live_evidence_missing');
    assert.equal(evidence.fields.some(row => row.sectionId === '14'), false);
    assert.equal(attempts, 0);
    assert.equal(observer.takeRecords().length, 0);
    observer.disconnect();
    assert.equal(document.documentElement.outerHTML, before);
    const evaluation = fake.calls.find(row => row.method === 'Runtime.evaluate');
    assert.equal(evaluation.params.throwOnSideEffect, true);
    assert.equal(evaluation.params.userGesture, false);
    assert.equal(evaluation.params.awaitPromise, false);
    assert.deepEqual(methods(fake), ['getTargets', 'connect', 'Network.enable', 'Fetch.enable',
      'Runtime.evaluate', 'wait', 'Fetch.disable', 'Network.disable', 'close']);
    assert.deepEqual(fake.calls.find(row => row.method === 'Fetch.enable').params,
      { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  } finally { dom.window.close(); }
});

test('inspection exceptions and arbitrary Runtime metadata never expose raw values', async () => {
  for (const [reply, expected] of [
    [{ exceptionDetails: { text: PRIVATE, exception: { description: PRIVATE } } }, 'inspection_exception'],
    [{ result: { value: { ...FLAGS, ok: false, reason: PRIVATE, fields: [] } } }, 'inspection_failed'],
    [{ result: { value: { ...noDocumentInspection(), writeStarted: true } } }, 'inspection_failed'],
    [{ result: { value: PRIVATE } }, 'inspection_failed']
  ]) {
    const fake = fakeCdp({ onSend(method) { if (method === 'Runtime.evaluate') return reply; } });
    const evidence = await fake.run();
    assertSafety(evidence);
    assert.equal(evidence.reason, expected);
    assert.equal(evidence.ok, false);
    assert.deepEqual(methods(fake).slice(-3), ['Fetch.disable', 'Network.disable', 'close']);
  }
  const inspection = noDocumentInspection();
  inspection.selectedValue = PRIVATE;
  inspection.fields[0].value = PRIVATE;
  inspection.fields[0].resolution = { requested: PRIVATE };
  const fake = fakeCdp({ evaluate: () => inspection });
  const evidence = await fake.run();
  assertSafety(evidence);
  assert.equal(evidence.reason, 'no_document');
  assert.equal(evidence.probeCompleted, true);
  assert.equal(Object.hasOwn(evidence.fields[0], 'value'), false);
  assert.equal(Object.hasOwn(evidence.fields[0], 'resolution'), false);
});

test('contradictory Runtime summaries cannot report complete preflight over skipped fields', async () => {
  for (const summary of [
    { ok: true, reason: 'read_only_preflight' },
    { ok: true, reason: 'row_d_preflight_incomplete' },
    { ok: false, reason: 'read_only_preflight' },
    { ok: false, reason: 'read_only_options_preflight' }
  ]) {
    const inspection = { ...noDocumentInspection(), ...summary };
    const fake = fakeCdp({ evaluate: () => inspection });
    const evidence = await fake.run();
    assertSafety(evidence);
    assert.equal(evidence.ok, false);
    assert.equal(evidence.reason, 'inspection_failed');
    assert.equal(evidence.probeCompleted, false);
    assert.deepEqual(evidence.fields, []);
  }
});

test('Runtime results must retain the attribute-only visibility limit', async () => {
  for (const visibilityBasis of [undefined, 'computed', PRIVATE]) {
    const inspection = { ...noDocumentInspection(), visibilityBasis };
    const fake = fakeCdp({ evaluate: () => inspection });
    const evidence = await fake.run();
    assertSafety(evidence);
    assert.equal(evidence.reason, 'inspection_failed');
    assert.equal(evidence.probeCompleted, false);
    assert.deepEqual(evidence.fields, []);
  }
});

for (const id of ['13_100701_0', '13_100702_0', '13_102501_0', '16_65_0']) {
  test(`forged observed success cannot promote incomplete/reused/calendar field ${id}`, async () => {
    const inspection = noDocumentInspection();
    Object.assign(inspection.fields.find(row => row.wrapperId === id), {
      ok: true, status: 'observed', reason: 'read_only_options_preflight'
    });
    const fake = fakeCdp({ evaluate: () => inspection });
    const evidence = await fake.run();
    assertSafety(evidence);
    assert.equal(evidence.ok, false);
    assert.equal(evidence.reason, 'inspection_failed');
    assert.equal(evidence.probeCompleted, false);
  });
}

test('field status, ok, and success reason must agree before accepting Runtime metadata', async () => {
  for (const changes of [
    { ok: false, status: 'observed', reason: 'no_document' },
    { ok: true, status: 'skipped', reason: 'read_only_options_preflight' },
    { ok: true, status: 'observed', reason: 'control_not_available' },
    { ok: false, status: 'skipped', reason: 'read_only_options_preflight' }
  ]) {
    const inspection = noDocumentInspection();
    Object.assign(inspection.fields.find(row => row.wrapperId === '13_195_0'), changes);
    const fake = fakeCdp({ evaluate: () => inspection });
    const evidence = await fake.run();
    assertSafety(evidence);
    assert.equal(evidence.reason, 'inspection_failed');
    assert.equal(evidence.probeCompleted, false);
  }
});

test('calendar skip exemption cannot make non-calendar fields complete', async () => {
  const inspection = noDocumentInspection();
  inspection.ok = true;
  inspection.reason = 'read_only_preflight';
  for (const row of inspection.fields) row.reason = 'calendar_live_evidence_missing';
  const fake = fakeCdp({ evaluate: () => inspection });
  const evidence = await fake.run();
  assertSafety(evidence);
  assert.equal(evidence.ok, false);
  assert.equal(evidence.reason, 'inspection_failed');
  assert.equal(evidence.probeCompleted, false);
});

test('discovery, connection, Runtime command, and settlement failures use fixed safe reasons', async () => {
  for (const [options, reason] of [
    [{ discoveryError: true }, 'target_discovery_failed'],
    [{ connectError: true }, 'connect_failed'],
    [{ onSend(method) { if (method === 'Runtime.evaluate') throw new Error(PRIVATE); } }, 'inspection_failed'],
    [{ onWait() { throw new Error(PRIVATE); } }, 'settlement_failed']
  ]) {
    const fake = fakeCdp(options);
    const evidence = await fake.run();
    assertSafety(evidence);
    assert.equal(evidence.reason, reason);
    assert.equal(evidence.ok, false);
  }
});

test('pending block decisions settle before Fetch.disable and session close', async () => {
  let release;
  let started;
  const began = new Promise(resolve => { started = resolve; });
  const pending = new Promise(resolve => { release = resolve; });
  const fake = fakeCdp({
    onWait({ emit }) { emit(paused('POST')); },
    onSend(method, params, { calls }) {
      if (method === 'Fetch.failRequest') {
        started();
        return pending.then(() => { calls.push({ method: 'block_decided' }); return {}; });
      }
    }
  });
  const running = fake.run();
  await began;
  assert.equal(methods(fake).includes('Fetch.disable'), false);
  assert.equal(methods(fake).includes('close'), false);
  release({});
  const evidence = await running;
  assertSafety(evidence);
  assert.equal(evidence.reason, 'non_get_or_guard_failure');
  assert.ok(methods(fake).indexOf('block_decided') < methods(fake).indexOf('Fetch.disable'));
  assert.deepEqual(methods(fake).slice(-3), ['Fetch.disable', 'Network.disable', 'close']);
});

test('a late request during Fetch.disable is drained before disabling Network and closing', async () => {
  let release;
  let started;
  const began = new Promise(resolve => { started = resolve; });
  const pending = new Promise(resolve => { release = resolve; });
  const fake = fakeCdp({ onSend(method, params, { emit, calls }) {
    if (method === 'Fetch.disable') emit(paused('POST', 'https://example.invalid/resume/info/edit'));
    if (method === 'Fetch.failRequest') {
      started();
      return pending.then(() => { calls.push({ method: 'late_block_decided' }); return {}; });
    }
  } });
  const running = fake.run();
  await began;
  assert.equal(methods(fake).includes('Network.disable'), false);
  assert.equal(methods(fake).includes('close'), false);
  release({});
  const evidence = await running;
  assertSafety(evidence);
  assert.equal(evidence.ok, false, 'a block acknowledgement cannot turn a late non-GET into probe success');
  assert.equal(evidence.traffic.infoEditBlockedCount, 1);
  assert.equal(evidence.reason, 'non_get_or_guard_failure');
  assert.ok(methods(fake).indexOf('late_block_decided') < methods(fake).indexOf('Network.disable'));
});

for (const failedMethod of ['Fetch.continueRequest', 'Fetch.failRequest', 'Fetch.disable', 'Network.disable']) {
  test(`${failedMethod} rejection fails the final probe and still closes the session`, async () => {
    const fake = fakeCdp({ onSend(method, params, { emit }) {
      if (method === 'Fetch.enable' && failedMethod === 'Fetch.continueRequest') emit(paused('GET'));
      if (method === 'Fetch.enable' && failedMethod === 'Fetch.failRequest') emit(paused('POST'));
      if (method === failedMethod) return Promise.reject(new Error(PRIVATE));
    } });
    const evidence = await fake.run();
    assertSafety(evidence);
    assert.equal(evidence.reason, 'non_get_or_guard_failure');
    assert.equal(evidence.traffic.commandFailed, true);
    assert.equal(methods(fake).at(-1), 'close');
  });
}

test('config defaults and optional harvested requests stay inside repository _temp-scripts', t => {
  const temporary = temporaryDirectory(t);
  const config = readRowDProbeConfig({}, root, root);
  assert.equal(config.port, 9242);
  assert.equal(config.timeoutMs, 10000);
  assert.equal(config.outDir, path.join(root, '_temp-scripts/cms-row-d-live-never-save'));
  assert.deepEqual(config.requests, {});
  const input = path.join(temporary, 'requests.json');
  const requests = { '13_47_0': '11-20万', '13_102501_0': ['宏观', '策略', '债券'] };
  fs.writeFileSync(input, JSON.stringify(requests), 'utf8');
  const custom = readRowDProbeConfig({ PORT: '9243', STEP_TIMEOUT_MS: '1000',
    OUTDIR: path.join(temporary, 'out'), REQUESTS_FILE: input }, root, root);
  assert.equal(custom.port, 9243);
  assert.equal(custom.timeoutMs, 1000);
  assert.deepEqual(custom.requests, requests);
});

test('config rejects bad ports/timeouts, path escapes, unknown labels, and oversized files', t => {
  const temporary = temporaryDirectory(t);
  for (const env of [{ PORT: '0' }, { PORT: '65536' }, { PORT: 'localhost' }, { PORT: 9242 },
    { STEP_TIMEOUT_MS: '999' }, { STEP_TIMEOUT_MS: '30001' }, { STEP_TIMEOUT_MS: 'Infinity' },
    { OUTDIR: root }, { OUTDIR: '../outside' }, { REQUESTS_FILE: runner }]) {
    assert.throws(() => readRowDProbeConfig(env, root, root));
  }
  for (const raw of ['', ' ', root, path.dirname(root), path.join(temporaryRoot, '..', 'outside')]) {
    assert.throws(() => rowDTemporaryPath(raw, root, root));
  }
  assert.equal(rowDTemporaryPath(path.join(temporary, 'new', 'nested'), root, root), path.join(temporary, 'new', 'nested'));
  for (const data of ['{', JSON.stringify({ '13_47_0': PRIVATE }), JSON.stringify({ unknown: '全职' }), ' '.repeat(32769)]) {
    const input = path.join(temporary, 'invalid-requests.json');
    fs.writeFileSync(input, data, 'utf8');
    assert.throws(() => readRowDProbeConfig({ REQUESTS_FILE: input }, root, root));
  }
});

test('existing directory junctions cannot escape output or request confinement', t => {
  const temporary = temporaryDirectory(t);
  const fakeRoot = path.join(temporary, 'repository');
  const allowed = path.join(fakeRoot, '_temp-scripts');
  const outside = path.join(temporary, 'outside-repository');
  fs.mkdirSync(allowed, { recursive: true });
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'requests.json'), '{}', 'utf8');
  const link = path.join(allowed, 'escaped');
  try { fs.symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) { t.skip('directory links unavailable'); return; }
    throw error;
  }
  assert.throws(() => rowDTemporaryPath(path.join(link, 'new-output'), fakeRoot, fakeRoot));
  assert.throws(() => readRowDProbeConfig({ OUTDIR: path.join(link, 'new-output') }, fakeRoot, fakeRoot));
  assert.throws(() => readRowDProbeConfig({ REQUESTS_FILE: path.join(link, 'requests.json') }, fakeRoot, fakeRoot));
  assert.equal(fs.existsSync(path.join(outside, 'new-output')), false);
});

test('--help and unknown CLI arguments cannot attach or write evidence', t => {
  const temporary = temporaryDirectory(t);
  const preload = path.join(temporary, 'block-network.mjs');
  fs.writeFileSync(preload, `import http from 'node:http';\nhttp.get = http.request = () => { process.stderr.write(${JSON.stringify(PRIVATE)}); throw new Error('offline_test_network_forbidden'); };\n`, 'utf8');
  const env = { ...process.env, PORT: 'invalid', OUTDIR: path.join(temporary, 'out'), REQUESTS_FILE: '' };
  for (const argument of ['--help', '-h']) {
    const child = spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, runner, argument], { cwd: root, env, encoding: 'utf8', timeout: 10000 });
    assert.equal(child.error, undefined);
    assert.equal(child.status, 0);
    assert.equal(child.stderr, '');
    assert.equal(child.stdout, HELP);
    assert.match(child.stdout, /No live PASS claimed/);
    assert.match(child.stdout, /Booked stays 53/);
  }
  for (const args of [['--unknown'], ['--help', '--unknown']]) {
    const child = spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, runner, ...args], { cwd: root, env, encoding: 'utf8', timeout: 10000 });
    assert.equal(child.error, undefined);
    assert.equal(child.status, 2);
    assert.equal(child.stderr, '');
    const evidence = JSON.parse(child.stdout);
    assertSafety(evidence);
    assert.equal(evidence.reason, 'config_invalid');
    assert.equal(evidence.probeCompleted, false);
  }
  assert.equal(fs.existsSync(path.join(temporary, 'out', EVIDENCE_NAME)), false);
});
