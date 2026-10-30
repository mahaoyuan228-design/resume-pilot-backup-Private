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
const autosaveUrl = new URL(`/wecruit/resume/info/edit/${new URL(ROW_D_PAGE).pathname.split('/')[1]}`, ROW_D_PAGE).href;
const keeperUrl = `${autosaveUrl}?iSaJAx=isAjax&request_locale=zh_CN&synthetic=${PRIVATE}`;
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
  assert.equal(evidence.booked, 70);
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
  Object.defineProperty(dom.window.document, 'readyState', { configurable: true, get: () => 'complete' });
  Object.defineProperty(dom.window.document, 'visibilityState', { configurable: true, get: () => 'visible' });
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
    async send(method, params = {}, options) {
      calls.push({ method, params, ...(options ? { options } : {}) });
      const override = onSend?.(method, params, { emit, calls });
      if (override !== undefined) return override;
      if (method === 'Runtime.enable') emit({ method: 'Runtime.executionContextCreated', params: {
        context: { id: 71, auxData: { isDefault: true, frameId: 'top-frame' } } } });
      if (method === 'Page.getFrameTree') return { frameTree: { frame: { id: 'top-frame', url: ROW_D_PAGE } } };
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

test('main world selection excludes utility worlds and default subframes', async () => {
  const fake = fakeCdp({ onSend(method, params, { emit }) {
    if (method === 'Runtime.enable') {
      for (const context of [
        { id: 9, auxData: { isDefault: false, frameId: 'top-frame' } },
        { id: 10, auxData: { isDefault: true, frameId: 'child-frame' } },
        { id: 71, auxData: { isDefault: true, frameId: 'top-frame' } }
      ]) emit({ method: 'Runtime.executionContextCreated', params: { context } });
      return {};
    }
  } });
  const evidence = await fake.run();
  assert.deepEqual(evidence.mainWorld, { status: 'pinned', contextId: 71 });
  const evaluation = fake.calls.find(call => call.method === 'Runtime.evaluate');
  assert.equal(evaluation.params.contextId, 71);
  assert.equal(evaluation.params.throwOnSideEffect, true);
  assertSafety(evidence);
});

for (const mode of ['missing', 'utility_only', 'duplicate', 'wrong_frame_url', 'destroyed', 'cleared']) {
  test(`main world ${mode} fails closed without an unpinned fallback`, async () => {
    const fake = fakeCdp({ onSend(method, params, { emit }) {
      if (method === 'Runtime.enable' && mode !== 'wrong_frame_url') {
        const event = context => emit({ method: 'Runtime.executionContextCreated', params: { context } });
        if (mode !== 'missing') event({ id: 71, auxData: { isDefault: mode !== 'utility_only', frameId: 'top-frame' } });
        if (mode === 'duplicate') event({ id: 72, auxData: { isDefault: true, frameId: 'top-frame' } });
        return {};
      }
      if (method === 'Page.getFrameTree' && mode === 'wrong_frame_url') {
        return { frameTree: { frame: { id: 'top-frame', url: 'https://example.invalid/' } } };
      }
      if (method === 'Runtime.evaluate' && ['destroyed', 'cleared'].includes(mode)) {
        emit({ method: mode === 'destroyed' ? 'Runtime.executionContextDestroyed' : 'Runtime.executionContextsCleared',
          params: { executionContextId: 71 } });
      }
    } });
    const evidence = await fake.run();
    assert.equal(evidence.ok, false);
    assert.equal(evidence.probeCompleted, false);
    assert.equal(evidence.reason, ['destroyed', 'cleared'].includes(mode) ? 'main_world_invalidated' : 'main_world_unavailable');
    assert.equal(fake.calls.filter(call => call.method === 'Runtime.evaluate').length, ['destroyed', 'cleared'].includes(mode) ? 1 : 0);
    assert.equal(evidence.visibilityKeeper.focusEmulationCleared, true);
    assert.equal(evidence.traffic.commandFailed, false);
    assertSafety(evidence);
  });
}
const paused = (method, url = `https://example.invalid/private?token=${PRIVATE}`, requestId = 'synthetic-request') =>
  ({ method: 'Fetch.requestPaused', params: { requestId, request: { method, url } } });
const keeperRequest = (id = 'keeper', method = 'POST', url = keeperUrl) => {
  const request = { method, url, postData: PRIVATE, headers: { private: PRIVATE } };
  return [
    { method: 'Network.requestWillBeSent', params: { requestId: `${PRIVATE}-network-${id}`, request } },
    { method: 'Fetch.requestPaused', params: { requestId: `${PRIVATE}-fetch-${id}`,
      networkId: `${PRIVATE}-network-${id}`, request } }
  ];
};
const unlinkedKeeperRequest = (id = 'unlinked', method = 'POST', url = keeperUrl) => {
  const events = keeperRequest(id, method, url);
  delete events[1].params.networkId;
  return events;
};

// Keep the recorded 12 successful fields and four skips, but adapt only the
// research metadata to the current reviewed complete dictionary. This models
// an incomplete current probe; it is not a replay or new live field verdict.
function modeledTwelveFieldInspection() {
  const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/cms-row-d-keeper-nongget-r6.json', import.meta.url), 'utf8'));
  const inspection = fixture.inspection;
  const research = inspection.fields.find(row => row.key === 'researchInterests');
  research.optionsComplete = true;
  research.reason = 'option_dictionary_mismatch';
  delete research.samplePrefixMatched;
  return inspection;
}

// Sanitizer models only. Component/DOM ownership is tested in the inspector's
// own synthetic fixtures; these envelopes cannot constitute new live evidence.
function locationProof() {
  return { hostCount: 2, cascaderCount: 1, hostsArePeers: true,
    cascaderOwnsBoth: true, hostsNearestCascaderSame: true, optionsHostSlot: 0,
    hosts: [0, 1].map(hostSlot => ({ hostSlot, comboOwned: true, selectionIsCombo: true,
      inputOwned: true, inputWithinCombo: true, inputSearchHelper: true,
      attributeAvailable: true, ariaOwnerCount: 1, referenceCount: 1,
      ariaBindingObserved: true, listState: 'target_missing' })) };
}
function secondaryInspection(id, metadata) {
  const inspection = noDocumentInspection();
  inspection.reason = 'row_d_preflight_incomplete';
  Object.assign(inspection.fields.find(row => row.wrapperId === id), metadata);
  return inspection;
}
function locationSuccessMetadata() {
  return { ok: true, status: 'observed', reason: 'read_only_location_preflight',
    observedOptionCount: 30, samplePrefixMatched: true,
    optionsReadiness: 'target_missing', optionsEvidenceSource: 'owned_react_props', optionsFramework: 'react',
    currentOptionsIndependentlyObserved: true, locationSelectionVerified: false,
    locationCompositeEvidence: locationProof() };
}
function calendarSuccessMetadata() {
  return { ok: true, status: 'observed', reason: 'read_only_calendar_preflight',
    calendarStructureObserved: true, calendarFramework: 'react',
    calendarEvidenceSource: 'owned_react_props', calendarPickerKind: 'month',
    calendarFormat: 'YYYY-MM', calendarMode: 'month', calendarOpen: false };
}

for (const requestMethod of ['GET', 'POST']) {
  for (const pending of [false, true]) test(`one Fetch decision per repeated ${requestMethod} interception (pending=${pending})`, async () => {
    const calls = [];
    let release;
    const guard = createRowDNetworkGuard((method, params) => {
      calls.push({ method, params });
      if (calls.length > 1) return Promise.reject(new Error('Invalid InterceptionId.'));
      return pending ? new Promise(resolve => { release = resolve; }) : Promise.resolve({});
    });
    guard.setKeeperActive(true);
    const [network, fetch] = keeperRequest('replay', requestMethod);
    guard.onEvent(network);
    guard.onEvent(fetch);
    if (!pending) await guard.drain();
    guard.onEvent(fetch);
    release?.({});
    await guard.drain();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].params.requestId, fetch.params.requestId);
    assert.equal(calls[0].method, requestMethod === 'GET' ? 'Fetch.continueRequest' : 'Fetch.failRequest');
    assert.equal(guard.traffic.commandFailed, false);
    assert.equal(guard.traffic.blockedNonGetCount, requestMethod === 'POST' ? 1 : 0);
    assert.equal(guard.failed(), true, 'duplicate evidence remains ineligible for preservation');
  });
}

test('distinct Fetch interception IDs sharing a network ID each receive an abort', async () => {
  const calls = [];
  const guard = createRowDNetworkGuard((method, params) => { calls.push({ method, params }); });
  guard.setKeeperActive(true);
  const [network, fetch] = keeperRequest('restart');
  guard.onEvent(network);
  guard.onEvent(fetch);
  guard.onEvent({ ...fetch, params: { ...fetch.params, requestId: 'second-interception' } });
  await guard.drain();
  assert.deepEqual(calls.map(call => call.method), ['Fetch.failRequest', 'Fetch.failRequest']);
  assert.deepEqual(calls.map(call => call.params.requestId), [fetch.params.requestId, 'second-interception']);
  assert.equal(guard.traffic.commandFailed, false);
  assert.equal(guard.traffic.blockedNonGetCount, 2);
  assert.equal(guard.failed(), true, 'duplicate network phases are still rejected');
});

for (const requestMethod of ['GET', 'POST']) test(`Invalid InterceptionId is redacted without inventing ${requestMethod} prevention`, async () => {
  const calls = [];
  const guard = createRowDNetworkGuard((method, params) => {
    calls.push({ method, params });
    throw new Error(JSON.stringify({ message: `Invalid InterceptionId. ${PRIVATE}` }));
  });
  guard.setKeeperActive(true);
  keeperRequest('retired', requestMethod).forEach(guard.onEvent);
  await guard.drain();
  assert.equal(calls.length, 1, 'never retry a retired interception');
  assert.equal(guard.traffic.commandFailed, false);
  assert.equal(guard.traffic.blockedNonGetCount, 0);
  assert.deepEqual(guard.traffic.commandFailures, [{ method: requestMethod === 'GET'
    ? 'Fetch.continueRequest' : 'Fetch.failRequest', reason: 'invalid_interception_id', ignored: true }]);
  assert.equal(guard.failed(), requestMethod === 'POST', 'unacknowledged non-GET still hard fails');
  assert.equal(JSON.stringify(guard.traffic).includes(PRIVATE), false);
});

for (const requestMethod of ['GET', 'POST']) test(`responseErrorReason ${requestMethod} pause is resolved without continue or fake block evidence`, async () => {
  const calls = [];
  const guard = createRowDNetworkGuard((method, params) => { calls.push({ method, params }); });
  guard.setKeeperActive(true);
  const [network, fetch] = keeperRequest('error-stage', requestMethod);
  fetch.params.responseErrorReason = 'Aborted';
  guard.onEvent(network);
  guard.onEvent(fetch);
  await guard.drain();
  assert.deepEqual(calls.map(call => call.method), ['Fetch.failRequest']);
  assert.equal(guard.traffic.blockedNonGetCount, requestMethod === 'POST' ? 1 : 0);
  assert.equal(guard.traffic.commandFailed, false);
  assert.equal(guard.failed(), requestMethod === 'POST');
});

test('a reused GET interception cannot authorize continuing a later POST', async () => {
  const calls = [];
  const guard = createRowDNetworkGuard((method, params) => { calls.push({ method, params }); });
  guard.setKeeperActive(true);
  guard.onEvent(paused('GET', keeperUrl, 'conflicting-id'));
  const events = keeperRequest('conflict');
  events[1].params.requestId = 'conflicting-id';
  events.forEach(guard.onEvent);
  guard.onEvent(events[1]);
  await guard.drain();
  assert.deepEqual(calls.map(call => call.method), ['Fetch.continueRequest', 'Fetch.failRequest']);
  assert.equal(guard.failed(), true);
});

test('initial evidence preserves Never-Save and the parent-booked 70 without a new acceptance claim', () => {
  assert.equal(ROW_D_LIVE_BASE_TIP, '23c0ce54b759aa1fc42516ecaf7c851bd63e785c');
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
    { optionsWaitMs: -1 }, { optionsWaitMs: 5001 }, { optionsWaitMs: '100' },
    { optionsPollMs: 24 }, { optionsPollMs: 501 }, { optionsPollMs: 1.5 },
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
    assert.equal(methods(fake).includes('Target.activateTarget'), false);
    assert.equal(methods(fake).includes('Page.bringToFront'), false);
    assert.equal(methods(fake).includes('Emulation.setFocusEmulationEnabled'), false);
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

for (const reverse of [false, true]) test(`only a correlated acknowledged keeper block qualifies (reversed events=${reverse})`, async () => {
  let acknowledge;
  const guard = createRowDNetworkGuard(() => new Promise(resolve => { acknowledge = resolve; }));
  guard.setKeeperActive(true);
  const events = keeperRequest();
  for (const event of reverse ? events.toReversed() : events) guard.onEvent(event);
  assert.equal(guard.failed(), true, 'an outstanding block command is not successful prevention');
  acknowledge({});
  await guard.drain();
  assert.equal(guard.failed(), false);
  assert.deepEqual(guard.assessment(), { status: 'correlated_keeper_blocks', reasons: [] });
  guard.setKeeperActive(false);
  assert.equal(guard.failed(), false, 'completed proof remains valid after keeper teardown');
  assert.equal(guard.traffic.observedNonGetCount, 1);
  assert.equal(guard.traffic.interceptedNonGetCount, 1);
  assert.equal(guard.traffic.blockedNonGetCount, 1);
  assert.equal(guard.traffic.responseToNonGetCount, 0);
  assert.equal(JSON.stringify(guard.traffic).includes(PRIVATE), false);
});

for (const reverse of [false, true]) test(`R7 uniquely pairs a missing Fetch networkId in either event order (reverse=${reverse})`, async () => {
  let acknowledge;
  const commands = [];
  const guard = createRowDNetworkGuard((method, params) => {
    commands.push({ method, params });
    return new Promise(resolve => { acknowledge = resolve; });
  });
  guard.setKeeperActive(true);
  const events = unlinkedKeeperRequest();
  guard.onEvent(reverse ? events[1] : events[0]);
  if (reverse) assert.equal(commands[0].method, 'Fetch.failRequest', 'abort before any Network counterpart arrives');
  assert.equal(guard.failed(), true);
  guard.onEvent(reverse ? events[0] : events[1]);
  assert.equal(guard.failed(), true, 'a missing block acknowledgement cannot preserve');
  acknowledge({});
  await guard.drain();
  assert.equal(guard.failed(), false);
  assert.deepEqual(guard.assessment(), { status: 'correlated_keeper_blocks', reasons: [],
    correlationMode: 'unique_identity_missing_fetch_network_id' });
  assert.equal(guard.traffic.observedNonGetCount, 1);
  assert.equal(guard.traffic.interceptedNonGetCount, 1);
  assert.equal(guard.traffic.blockedNonGetCount, 1);
  assert.equal(guard.traffic.responseToNonGetCount, 0);
  guard.setKeeperActive(false);
  assert.equal(guard.failed(), false, 'completed proof survives final cleanup');
  assert.equal(commands.filter(row => row.method === 'Fetch.continueRequest').length, 0);
  assert.equal(JSON.stringify({ traffic: guard.traffic, assessment: guard.assessment() }).includes(PRIVATE), false);
});

for (const mode of ['outside_keeper', 'crossed_window', 'observed_only', 'paused_only',
  'different_query', 'different_endpoint', 'different_method', 'duplicate_observation', 'duplicate_pause',
  'second_paired_request_before', 'second_paired_request_after', 'second_unlinked_request',
  'missing_fetch_id', 'missing_network_request_id', 'response_stage', 'redirect', 'failed_block']) {
  test(`R7 missing Fetch networkId cannot exempt ${mode}`, async () => {
    const commands = [];
    const guard = createRowDNetworkGuard((method, params) => {
      commands.push({ method, params });
      return mode === 'failed_block' ? Promise.reject(new Error(PRIVATE)) : Promise.resolve({});
    });
    guard.setKeeperActive(mode !== 'outside_keeper');
    const [network, fetch] = unlinkedKeeperRequest();
    if (mode === 'different_query') fetch.params.request = { ...fetch.params.request, url: keeperUrl + '&other=1' };
    if (mode === 'different_endpoint') fetch.params.request = { ...fetch.params.request, url: 'https://example.invalid/resume/info/edit' };
    if (mode === 'different_method') fetch.params.request = { ...fetch.params.request, method: 'PUT' };
    if (mode === 'missing_fetch_id') delete fetch.params.requestId;
    if (mode === 'missing_network_request_id') delete network.params.requestId;
    if (mode === 'response_stage') fetch.params.responseStatusCode = 200;
    if (mode === 'redirect') fetch.params.redirectedRequestId = PRIVATE;
    if (mode === 'second_paired_request_before') keeperRequest('other').forEach(guard.onEvent);
    if (mode !== 'paused_only') guard.onEvent(network);
    if (mode === 'crossed_window') guard.setKeeperActive(false);
    if (mode !== 'observed_only') guard.onEvent(fetch);
    if (mode === 'duplicate_observation') guard.onEvent(network);
    if (mode === 'duplicate_pause') guard.onEvent(fetch);
    if (mode === 'second_paired_request_after') keeperRequest('other').forEach(guard.onEvent);
    if (mode === 'second_unlinked_request') unlinkedKeeperRequest('other').forEach(guard.onEvent);
    await guard.drain();
    assert.equal(guard.failed(), true, mode);
    assert.equal(guard.assessment().status, 'rejected');
    assert.equal(commands.filter(row => row.method === 'Fetch.continueRequest').length, 0);
    assert.equal(JSON.stringify({ traffic: guard.traffic, assessment: guard.assessment() }).includes(PRIVATE), false);
  });
}

for (const networkId of [null, '', 0, {}, 'x'.repeat(1025)]) test(`R7 never treats a malformed supplied Fetch networkId as absent (${typeof networkId})`, async () => {
  const guard = createRowDNetworkGuard(() => Promise.resolve({}));
  guard.setKeeperActive(true);
  const events = keeperRequest();
  events[1].params.networkId = networkId;
  events.forEach(guard.onEvent);
  await guard.drain();
  assert.equal(guard.failed(), true);
  assert.ok(guard.assessment().reasons.includes('network_id_missing_or_invalid'));
});

test('R7 a second non-GET after successful missing-ID settlement permanently invalidates the fallback', async () => {
  const guard = createRowDNetworkGuard(() => Promise.resolve({}));
  guard.setKeeperActive(true);
  unlinkedKeeperRequest().forEach(guard.onEvent);
  await guard.drain();
  assert.equal((await guard.settleKeeper()).ready, true);
  keeperRequest('later').forEach(guard.onEvent);
  await guard.drain();
  assert.equal(guard.failed(), true);
  const stop = await guard.settleKeeper();
  assert.equal(stop.status, 'permanent_failure');
  assert.equal(stop.ready, false);
  guard.setKeeperActive(false);
  assert.equal(guard.failed(), true, 'a prior successful checkpoint is no authority to preserve later ambiguity');
});

for (const responseMethod of ['Network.responseReceived', 'Network.responseReceivedExtraInfo',
  'Network.responseReceivedEarlyHints', 'Network.dataReceived', 'Network.loadingFinished']) {
  for (const early of [false, true]) test(`R7 missing-ID pair still rejects ${responseMethod} (early=${early})`, async () => {
    const guard = createRowDNetworkGuard(() => Promise.resolve({}));
    guard.setKeeperActive(true);
    const events = unlinkedKeeperRequest();
    const response = { method: responseMethod, params: { requestId: events[0].params.requestId } };
    if (early) guard.onEvent(response);
    events.toReversed().forEach(guard.onEvent);
    await guard.drain();
    if (!early) {
      assert.equal(guard.failed(), false);
      guard.onEvent({ method: 'Network.loadingFailed', params: { requestId: events[0].params.requestId } });
      guard.onEvent(response);
    }
    assert.equal(guard.failed(), true);
    assert.equal(guard.traffic.responseToNonGetCount, 1);
  });
}

for (const phase of ['activate', 'inspection', 'reset', 'cleanup']) {
  for (const reverse of [false, true]) test(`R7 blocked-only missing-ID keeper traffic preserves modeled 12/16 through finally (${phase}, reverse=${reverse})`, async () => {
    const inspection = modeledTwelveFieldInspection();
    assert.equal(inspection.fields.filter(row => row.ok).length, 12);
    let emitted = false;
    const emitBlock = emit => {
      if (emitted) return;
      emitted = true;
      const events = unlinkedKeeperRequest();
      (reverse ? events.toReversed() : events).forEach(emit);
    };
    const fake = fakeCdp({ evaluate: () => inspection,
      onSend(method, params, { emit }) {
        if ((phase === 'activate' && method === 'Target.activateTarget')
          || (phase === 'inspection' && method === 'Runtime.evaluate')
          || (phase === 'reset' && method === 'Emulation.setFocusEmulationEnabled' && !params.enabled)) emitBlock(emit);
      },
      onWait({ emit, calls }) {
        if (phase === 'cleanup' && calls.some(call => call.method === 'Emulation.setFocusEmulationEnabled' && !call.params.enabled)) emitBlock(emit);
      }
    });
    const evidence = await fake.run();
    assertSafety(evidence);
    assert.equal(emitted, true);
    assert.equal(evidence.probeCompleted, true);
    assert.equal(evidence.ok, false);
    assert.equal(evidence.reason, 'row_d_preflight_incomplete');
    assert.deepEqual(evidence.fields, inspection.fields);
    assert.equal(evidence.fields.filter(row => row.ok).length, 12);
    assert.equal(evidence.traffic.observedNonGetCount, 1);
    assert.equal(evidence.traffic.interceptedNonGetCount, 1);
    assert.equal(evidence.traffic.blockedNonGetCount, 1);
    assert.equal(evidence.traffic.infoEditObservedCount, 1);
    assert.equal(evidence.traffic.infoEditBlockedCount, 1);
    assert.equal(evidence.traffic.responseToNonGetCount, 0);
    assert.equal(evidence.traffic.commandFailed, false);
    assert.equal(evidence.traffic.truncated, false);
    assert.equal(evidence.traffic.keeperAssessment.correlationMode, 'unique_identity_missing_fetch_network_id');
    const evaluation = fake.calls.find(call => call.method === 'Runtime.evaluate');
    assert.equal(evaluation.params.throwOnSideEffect, true);
    assert.deepEqual(methods(fake).slice(-3), ['Fetch.disable', 'Network.disable', 'close']);
    assert.doesNotMatch(JSON.stringify(evidence), /networkId|requestId|wecruit\/resume|iSaJAx|request_locale/);
  });
}

for (const teardown of ['Fetch.disable', 'Network.disable']) test(`R7 missing-ID traffic first seen during ${teardown} remains fatal`, async () => {
  const fake = fakeCdp({ evaluate: modeledTwelveFieldInspection,
    onSend(method, params, { emit }) { if (method === teardown) unlinkedKeeperRequest().forEach(emit); }
  });
  const evidence = await fake.run();
  assertSafety(evidence);
  assert.equal(evidence.probeCompleted, true);
  assert.equal(evidence.fields.filter(row => row.ok).length, 12);
  assert.equal(evidence.reason, 'non_get_or_guard_failure');
  assert.equal(evidence.traffic.blockedNonGetCount, 1);
});

for (const mode of ['outside_keeper', 'crossed_window', 'observed_only', 'paused_only',
  'different_network_id', 'invalid_network_id', 'missing_fetch_id', 'missing_network_request_id',
  'duplicate_observation', 'duplicate_pause', 'reused_fetch_id', 'different_method',
  'different_query', 'response_stage', 'error_stage', 'response_headers', 'response_status_text',
  'fetch_redirect', 'untracked_redirect']) {
  test(`keeper block exception rejects ${mode}`, async () => {
    const guard = createRowDNetworkGuard(() => Promise.resolve({}));
    guard.setKeeperActive(mode !== 'outside_keeper');
    const [network, fetch] = keeperRequest();
    if (mode === 'different_network_id') fetch.params.networkId = 'other-network';
    if (mode === 'invalid_network_id') fetch.params.networkId = null;
    if (mode === 'missing_fetch_id') delete fetch.params.requestId;
    if (mode === 'missing_network_request_id') delete network.params.requestId;
    if (mode === 'different_method') fetch.params.request = { ...fetch.params.request, method: 'HEAD' };
    if (mode === 'different_query') fetch.params.request = { ...fetch.params.request, url: `${fetch.params.request.url}&other=1` };
    if (mode === 'response_stage') fetch.params.responseStatusCode = 200;
    if (mode === 'error_stage') fetch.params.responseErrorReason = 'Failed';
    if (mode === 'response_headers') fetch.params.responseHeaders = [{ name: 'PRIVATE', value: PRIVATE }];
    if (mode === 'response_status_text') fetch.params.responseStatusText = PRIVATE;
    if (mode === 'fetch_redirect') fetch.params.redirectedRequestId = PRIVATE;
    if (mode === 'untracked_redirect') network.params.redirectResponse = { status: 307 };
    if (mode !== 'paused_only') guard.onEvent(network);
    if (mode === 'crossed_window') guard.setKeeperActive(false);
    if (mode !== 'observed_only') guard.onEvent(fetch);
    if (mode === 'duplicate_observation') guard.onEvent(network);
    if (mode === 'duplicate_pause') guard.onEvent(fetch);
    if (mode === 'reused_fetch_id') {
      const second = keeperRequest('second');
      second[1].params.requestId = fetch.params.requestId;
      second.forEach(guard.onEvent);
    }
    await guard.drain();
    assert.equal(guard.failed(), true);
    const expectedReason = { outside_keeper: 'outside_keeper', crossed_window: 'outside_keeper',
      observed_only: 'network_fetch_unmatched', paused_only: 'network_fetch_unmatched',
      different_network_id: 'network_fetch_unmatched', invalid_network_id: 'network_id_missing_or_invalid',
      missing_fetch_id: 'fetch_id_missing_or_invalid', missing_network_request_id: 'network_id_missing_or_invalid',
      duplicate_observation: 'duplicate_network_phase', duplicate_pause: 'duplicate_network_phase',
      reused_fetch_id: 'duplicate_fetch_id', different_method: 'request_identity_conflict',
      different_query: 'request_identity_conflict', response_stage: 'response_stage_pause',
      error_stage: 'response_stage_pause', response_headers: 'response_stage_pause',
      response_status_text: 'response_stage_pause', fetch_redirect: 'redirect_evidence', untracked_redirect: 'unmatched_redirect' }[mode];
    assert.equal(guard.assessment().status, 'rejected');
    assert.ok(guard.assessment().reasons.includes(expectedReason), mode);
    assert.equal(JSON.stringify({ traffic: guard.traffic, assessment: guard.assessment() }).includes(PRIVATE), false);
    if (mode === 'different_network_id') {
      assert.equal(guard.traffic.observedNonGetCount, 1);
      assert.equal(guard.traffic.interceptedNonGetCount, 1);
      assert.equal(guard.traffic.blockedNonGetCount, 1, 'equal aggregate counts cannot establish correlation');
    }
  });
}

for (const [method, url] of [
  ['HEAD', keeperUrl],
  ['PUT', keeperUrl],
  ['POST', keeperUrl.replace('wecruit.hotjob.cn', 'example.invalid')],
  ['POST', keeperUrl.replace('https:', 'http:')],
  ['POST', keeperUrl.replace('wecruit.hotjob.cn', 'wecruit.hotjob.cn:8443')],
  ['POST', keeperUrl.replace('https://', 'https://user:secret@')],
  ['POST', 'https://wecruit.hotjob.cn/resume/info/edit'],
  ['POST', 'https://wecruit.hotjob.cn/private/resume/info/edit'],
  ['POST', autosaveUrl.replace('SU629dbc0c0dcad452299bc0f7', 'SUother')],
  ['POST', autosaveUrl.replace('SU629dbc0c0dcad452299bc0f7', 'xSU629dbc0c0dcad452299bc0f7')],
  ['POST', autosaveUrl + 'x'],
  ['POST', autosaveUrl + '/extra'],
  ['POST', autosaveUrl + '/'],
  ['POST', autosaveUrl.replace('/wecruit/', '/private/wecruit/')],
  ['POST', autosaveUrl.replace('/resume/', '/%72esume/')],
  ['POST', autosaveUrl.replace('/info/edit/', '/INFO/EdIt/')],
  ['POST', autosaveUrl.replace('SU629', 'su629')],
  ['POST', autosaveUrl.replace('SU629', '%53U629')],
  ['POST', autosaveUrl + '#fragment']
]) test(`keeper exception rejects method/origin/path ${method} ${url}`, async () => {
  const guard = createRowDNetworkGuard(() => Promise.resolve({}));
  guard.setKeeperActive(true);
  keeperRequest('ineligible', method, url).forEach(guard.onEvent);
  await guard.drain();
  assert.equal(guard.traffic.blockedNonGetCount, 1);
  assert.equal(guard.failed(), true);
  assert.equal(guard.assessment().status, 'rejected');
  assert.ok(guard.assessment().reasons.includes(method === 'POST' ? 'endpoint_ineligible' : 'method_ineligible'));
});

for (const responseMethod of ['Network.responseReceived', 'Network.responseReceivedExtraInfo',
  'Network.responseReceivedEarlyHints', 'Network.dataReceived', 'Network.loadingFinished']) {
  for (const early of [false, true]) test(`server evidence hard fails ${responseMethod} (early=${early})`, async () => {
    const guard = createRowDNetworkGuard(() => Promise.resolve({}));
    guard.setKeeperActive(true);
    const events = keeperRequest();
    const response = { method: responseMethod, params: { requestId: events[0].params.requestId, body: PRIVATE } };
    if (early) guard.onEvent(response);
    events.forEach(guard.onEvent);
    await guard.drain();
    if (!early) {
      assert.equal(guard.failed(), false);
      guard.onEvent({ method: 'Network.loadingFailed', params: { requestId: events[0].params.requestId } });
      guard.onEvent(response);
    }
    assert.equal(guard.traffic.responseToNonGetCount, 1);
    assert.equal(guard.failed(), true);
    assert.equal(JSON.stringify(guard.traffic).includes(PRIVATE), false);
  });
}

test('redirect server evidence defeats an acknowledged block without attributing the later GET response to POST', async () => {
  const guard = createRowDNetworkGuard(() => Promise.resolve({}));
  guard.setKeeperActive(true);
  const events = keeperRequest();
  events.forEach(guard.onEvent);
  await guard.drain();
  guard.onEvent({ method: 'Network.requestWillBeSent', params: {
    requestId: events[0].params.requestId, redirectResponse: { status: 302, body: PRIVATE },
    request: { method: 'GET', url: `https://wecruit.hotjob.cn/finished?token=${PRIVATE}` }
  } });
  guard.onEvent({ method: 'Network.responseReceived', params: { requestId: events[0].params.requestId } });
  assert.equal(guard.traffic.responseToNonGetCount, 1);
  assert.equal(guard.failed(), true);
  assert.equal(JSON.stringify(guard.traffic).includes(PRIVATE), false);
});

test('blocked keeper traffic preserves the 13/16 hypothetical field inspection across its retained lifetime', async () => {
  const dom = syntheticDom();
  try {
    const inspection = clone(dom.window.eval(buildCmsRowDOptionsProbeExpression()));
    assert.equal(inspection.fields.filter(row => row.ok).length, 13);
    for (const phase of ['activate', 'front', 'enable', 'inspection', 'settlement', 'reset', 'cleanup']) {
      let emitted = false;
      const emitBlock = emit => { emitted = true; keeperRequest(phase).forEach(emit); };
      const fake = fakeCdp({ evaluate: () => inspection,
        onSend(method, params, { emit }) {
          if ((phase === 'activate' && method === 'Target.activateTarget')
            || (phase === 'front' && method === 'Page.bringToFront')
            || (phase === 'enable' && method === 'Emulation.setFocusEmulationEnabled' && params.enabled)
            || (phase === 'inspection' && method === 'Runtime.evaluate')
            || (phase === 'reset' && method === 'Emulation.setFocusEmulationEnabled' && !params.enabled)) emitBlock(emit);
        },
        onWait({ emit, calls }) {
          const reset = calls.some(call => call.method === 'Emulation.setFocusEmulationEnabled' && !call.params.enabled);
          if ((phase === 'settlement' && !reset) || (phase === 'cleanup' && reset)) emitBlock(emit);
        }
      });
      const evidence = await fake.run();
      assertSafety(evidence);
      assert.equal(emitted, true, phase);
      assert.equal(evidence.probeCompleted, true, phase);
      assert.equal(evidence.ok, false, phase);
      assert.equal(evidence.reason, inspection.reason, phase);
      assert.equal(evidence.reason, 'row_d_preflight_incomplete');
      assert.equal(evidence.fields.filter(row => row.ok).length, 13);
      for (let index = 0; index < inspection.fields.length; index += 1) {
        assert.equal(evidence.fields[index].ok, inspection.fields[index].ok);
        assert.equal(evidence.fields[index].reason, inspection.fields[index].reason);
      }
      assert.equal(evidence.traffic.blockedNonGetCount, 1);
      assert.equal(evidence.traffic.responseToNonGetCount, 0);
      assert.deepEqual(evidence.visibilityKeeper, { targetActivated: true, pageBroughtToFront: true,
        focusEmulationEnabled: true, focusEmulationCleared: true });
      assert.equal(fake.calls.find(call => call.method === 'Runtime.evaluate').params.throwOnSideEffect, true);
    }
  } finally { dom.window.close(); }
});

test('a response still hard fails after completed field inspection without dropping field evidence', async () => {
  const dom = syntheticDom();
  try {
    const inspection = clone(dom.window.eval(buildCmsRowDOptionsProbeExpression()));
    const events = keeperRequest();
    const fake = fakeCdp({ evaluate: () => inspection, onSend(method, params, { emit }) {
      if (method === 'Runtime.evaluate') events.forEach(emit);
    }, onWait({ emit }) {
      emit({ method: 'Network.responseReceived', params: { requestId: events[0].params.requestId } });
    } });
    const evidence = await fake.run();
    assertSafety(evidence);
    assert.equal(evidence.probeCompleted, true);
    assert.equal(evidence.fields.filter(row => row.ok).length, 13);
    assert.equal(evidence.reason, 'non_get_or_guard_failure');
    assert.equal(evidence.traffic.responseToNonGetCount, 1);
  } finally { dom.window.close(); }
});

for (const teardown of ['Fetch.disable', 'Network.disable']) test(`fully correlated POST first seen during ${teardown} still fails`, async () => {
  const fake = fakeCdp({ onSend(method, params, { emit }) {
    if (method === teardown) keeperRequest(teardown).forEach(emit);
  } });
  const evidence = await fake.run();
  assertSafety(evidence);
  assert.equal(evidence.probeCompleted, true);
  assert.equal(evidence.reason, 'non_get_or_guard_failure');
  assert.equal(evidence.traffic.blockedNonGetCount, 1);
});

test('keeper setup awaits a pending correlated block acknowledgement before inspection', async () => {
  let release;
  let began;
  const pending = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { began = resolve; });
  const fake = fakeCdp({ onSend(method, params, { emit }) {
    if (method === 'Page.bringToFront') keeperRequest().forEach(emit);
    if (method === 'Fetch.failRequest') { began(); return pending; }
  } });
  const running = fake.run();
  await started;
  assert.equal(methods(fake).includes('Runtime.evaluate'), false);
  release({});
  const evidence = await running;
  assertSafety(evidence);
  assert.equal(evidence.probeCompleted, true);
  assert.equal(evidence.reason, 'no_document');
});

test('one guarded CDP session retains its visibility keeper through inspection and settlement', async () => {
  let focusEmulated = false;
  const fake = fakeCdp({
    onSend(method, params, { calls }) {
      if (['Target.activateTarget', 'Page.bringToFront', 'Emulation.setFocusEmulationEnabled'].includes(method)) {
        assert.ok(calls.some(call => call.method === 'Network.enable'));
        assert.ok(calls.some(call => call.method === 'Fetch.enable'));
        assert.equal(calls.some(call => call.method === 'Fetch.disable'), false);
      }
      if (method === 'Emulation.setFocusEmulationEnabled') focusEmulated = params.enabled;
      if (method === 'Runtime.evaluate') {
        assert.equal(focusEmulated, true);
        assert.equal(params.throwOnSideEffect, true);
      }
    },
    onWait({ calls }) {
      const reset = calls.some(call => call.method === 'Emulation.setFocusEmulationEnabled'
        && call.params.enabled === false);
      assert.equal(focusEmulated, !reset);
    }
  });
  const evidence = await fake.run();
  assertSafety(evidence);
  assert.equal(evidence.reason, 'no_document');
  assert.equal(evidence.probeCompleted, true);
  assert.equal(focusEmulated, false);
  assert.equal(fake.calls.filter(call => call.method === 'connect').length, 1);
  assert.deepEqual(fake.calls.find(call => call.method === 'Target.activateTarget').params,
    { targetId: 'synthetic-tab' });
  assert.deepEqual(fake.calls.filter(call => call.method === 'Emulation.setFocusEmulationEnabled')
    .map(call => call.params), [{ enabled: true }, { enabled: false }]);
  assert.deepEqual(evidence.visibilityKeeper, { targetActivated: true, pageBroughtToFront: true,
    focusEmulationEnabled: true, focusEmulationCleared: true });
});

for (const failedMethod of ['Target.activateTarget', 'Page.bringToFront', 'Emulation.setFocusEmulationEnabled']) {
  test(`${failedMethod} failure prevents inspection and still tears down its owned session`, async () => {
    const fake = fakeCdp({ onSend(method, params) {
      if (method === failedMethod && params.enabled !== false) throw new Error(PRIVATE);
    } });
    const evidence = await fake.run();
    assertSafety(evidence);
    assert.equal(evidence.reason, 'visibility_keeper_failed');
    assert.equal(evidence.probeCompleted, false);
    assert.equal(methods(fake).includes('Runtime.evaluate'), false);
    assert.deepEqual(methods(fake).slice(-3), ['Fetch.disable', 'Network.disable', 'close']);
    const reset = fake.calls.filter(call => call.method === 'Emulation.setFocusEmulationEnabled'
      && call.params.enabled === false);
    assert.equal(reset.length, failedMethod === 'Emulation.setFocusEmulationEnabled' ? 1 : 0);
  });
}

for (const triggeredMethod of ['Target.activateTarget', 'Page.bringToFront', 'Emulation.setFocusEmulationEnabled']) {
  test(`non-GET during ${triggeredMethod} is blocked before inspection`, async () => {
    const fake = fakeCdp({ onSend(method, params, { emit }) {
      if (method === triggeredMethod && params.enabled !== false) emit(paused('POST'));
    } });
    const evidence = await fake.run();
    assertSafety(evidence);
    assert.equal(evidence.reason, 'non_get_or_guard_failure');
    assert.equal(evidence.probeCompleted, false);
    assert.equal(evidence.traffic.blockedNonGetCount, 1);
    assert.equal(methods(fake).includes('Runtime.evaluate'), false);
    if (triggeredMethod === 'Target.activateTarget') assert.equal(methods(fake).includes('Page.bringToFront'), false);
  });
}

test('keeper cleanup rejection fails safely and still disables guards and closes', async () => {
  let cleanupWindows = 0;
  const fake = fakeCdp({
    onSend(method, params) {
      if (method === 'Emulation.setFocusEmulationEnabled' && !params.enabled) throw new Error(PRIVATE);
    },
    onWait({ calls }) {
      if (calls.some(call => call.method === 'Emulation.setFocusEmulationEnabled'
        && call.params.enabled === false)) cleanupWindows += 1;
    }
  });
  const evidence = await fake.run();
  assertSafety(evidence);
  assert.equal(evidence.reason, 'non_get_or_guard_failure');
  assert.equal(evidence.traffic.commandFailed, true);
  assert.deepEqual(evidence.traffic.commandFailures, [{
    method: 'Emulation.setFocusEmulationEnabled', reason: 'command_rejected', ignored: false
  }]);
  assert.equal(evidence.probeCompleted, true);
  assert.equal(evidence.ok, false);
  assert.equal(evidence.visibilityKeeper.focusEmulationCleared, false);
  assert.equal(cleanupWindows, 1);
  assert.deepEqual(methods(fake).slice(-3), ['Fetch.disable', 'Network.disable', 'close']);
});

test('focus override cleanup remains guarded and a resulting non-GET fails the probe', async () => {
  const fake = fakeCdp({ onSend(method, params, { emit, calls }) {
    if (method === 'Emulation.setFocusEmulationEnabled' && !params.enabled) {
      assert.equal(calls.some(call => call.method === 'Fetch.disable'), false);
      emit(paused('POST'));
    }
  } });
  const evidence = await fake.run();
  assertSafety(evidence);
  assert.equal(evidence.reason, 'non_get_or_guard_failure');
  assert.equal(evidence.probeCompleted, true);
  assert.equal(evidence.traffic.blockedNonGetCount, 1);
  assert.ok(methods(fake).indexOf('Fetch.failRequest') < methods(fake).indexOf('Fetch.disable'));
});

for (const mode of ['completed', 'inspection_exception', 'focus_enable_failure', 'focus_non_get']) {
  test(`delayed cleanup POST stays blocked before guard teardown after ${mode}`, async () => {
    let cleanupWindows = 0;
    const fake = fakeCdp({
      onSend(method, params, { emit }) {
        if (method === 'Runtime.evaluate' && mode === 'inspection_exception') {
          return { exceptionDetails: { text: PRIVATE } };
        }
        if (method === 'Emulation.setFocusEmulationEnabled' && params.enabled) {
          if (mode === 'focus_enable_failure') throw new Error(PRIVATE);
          if (mode === 'focus_non_get') emit(paused('POST', undefined, 'focus-request'));
        }
      },
      async onWait({ emit, calls }) {
        if (!calls.some(call => call.method === 'Emulation.setFocusEmulationEnabled'
          && call.params.enabled === false)) return;
        cleanupWindows += 1;
        assert.equal(calls.at(-1).ms, 250);
        assert.equal(calls.some(call => call.method === 'Fetch.disable'), false);
        assert.equal(calls.some(call => call.method === 'Network.disable'), false);
        await new Promise(resolve => setImmediate(resolve));
        emit(paused('POST', undefined, 'delayed-cleanup-request'));
      }
    });
    const evidence = await fake.run();
    assertSafety(evidence);
    assert.equal(cleanupWindows, 1);
    assert.equal(evidence.reason, 'non_get_or_guard_failure');
    assert.equal(evidence.ok, false);
    assert.equal(evidence.probeCompleted, mode === 'completed');
    assert.equal(evidence.traffic.blockedNonGetCount, mode === 'focus_non_get' ? 2 : 1);
    const blockIndex = fake.calls.findIndex(call => call.method === 'Fetch.failRequest'
      && call.params.requestId === 'delayed-cleanup-request');
    assert.ok(blockIndex !== -1 && blockIndex < methods(fake).indexOf('Fetch.disable'));
    assert.equal(methods(fake).at(-1), 'close');
  });
}

test('cleanup monitoring-window failure fails the result and still tears down guards', async () => {
  const fake = fakeCdp({ onWait({ calls }) {
    if (calls.some(call => call.method === 'Emulation.setFocusEmulationEnabled'
      && call.params.enabled === false)) throw new Error(PRIVATE);
  } });
  const evidence = await fake.run();
  assertSafety(evidence);
  assert.equal(evidence.reason, 'visibility_keeper_cleanup_failed');
  assert.equal(evidence.ok, false);
  assert.equal(evidence.probeCompleted, true);
  assert.deepEqual(methods(fake).slice(-3), ['Fetch.disable', 'Network.disable', 'close']);
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
    assert.equal(field('13_102501_0').reason, 'read_only_options_preflight');
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
      'Target.activateTarget', 'Page.bringToFront', 'Emulation.setFocusEmulationEnabled',
      'Runtime.enable', 'Page.getFrameTree', 'Runtime.evaluate', 'wait', 'Emulation.setFocusEmulationEnabled',
      'wait', 'Runtime.disable', 'Fetch.disable', 'Network.disable', 'close']);
    assert.deepEqual(fake.calls.find(row => row.method === 'Fetch.enable').params,
      { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  } finally { dom.window.close(); }
});

test('host readiness re-reads passively populated synthetic aria target and empty list without interaction', async () => {
  const dom = syntheticDom();
  try {
    const { document } = dom.window;
    const missing = document.getElementById('synthetic-13_43_0');
    const parent = missing.parentElement;
    missing.remove();
    const empty = document.getElementById('synthetic-13_47_0');
    const children = [...empty.childNodes];
    empty.replaceChildren();
    let attempts = 0;
    const forbidden = () => { attempts += 1; throw new Error(PRIVATE); };
    for (const name of ['click', 'focus', 'blur']) dom.window.HTMLElement.prototype[name] = forbidden;
    dom.window.EventTarget.prototype.dispatchEvent = forbidden;
    dom.window.fetch = forbidden;
    dom.window.XMLHttpRequest.prototype.send = forbidden;
    dom.window.navigator.sendBeacon = forbidden;
    dom.window.MutationObserver = forbidden;
    dom.window.setTimeout = forbidden;
    dom.window.setInterval = forbidden;
    let populationStep = 0;
    const fake = fakeCdp({ evaluate: expression => clone(dom.window.eval(expression)), onWait() {
      // A synthetic external actor models passive population; the inspector
      // never creates these nodes or asks the page to populate them.
      populationStep += 1;
      if (populationStep === 1) parent.append(missing);
      if (populationStep === 2) empty.append(...children);
    } });
    const evidence = await fake.run({ optionsWaitMs: 1000, optionsPollMs: 100 });
    assertSafety(evidence);
    assert.equal(evidence.reason, 'row_d_preflight_incomplete');
    assert.equal(evidence.fields.filter(row => row.ok).length, 13);
    assert.deepEqual(evidence.optionsReadiness, { status: 'ready', attempts: 3,
      waitRounds: 2, initialUnavailableCount: 2, finalUnavailableCount: 0 });
    const evaluations = fake.calls.filter(row => row.method === 'Runtime.evaluate');
    assert.equal(new Set(evaluations.map(row => row.params.expression)).size, 1);
    for (const call of evaluations) {
      assert.equal(call.params.throwOnSideEffect, true);
      assert.equal(call.params.awaitPromise, false);
      assert.equal(call.params.userGesture, false);
      assert.equal(call.options.timeoutMs, call.params.timeout);
      assert.equal(call.options.step, 'inspection');
    }
    assert.equal(methods(fake).filter(method => method === 'Target.activateTarget').length, 1);
    assert.equal(methods(fake).filter(method => method === 'Page.bringToFront').length, 1);
    assert.equal(fake.calls.filter(row => row.method === 'Emulation.setFocusEmulationEnabled'
      && row.params.enabled).length, 1);
    assert.equal(attempts, 0);
  } finally { dom.window.close(); }
});

test('host readiness uses a finite round cap with no-op waits and retains latest actual incomplete evidence', async () => {
  const dom = syntheticDom();
  try {
    dom.window.document.getElementById('synthetic-13_43_0').remove();
    const actual = clone(dom.window.eval(buildCmsRowDOptionsProbeExpression()));
    const fake = fakeCdp({ evaluate: () => clone(actual) });
    const evidence = await fake.run({ optionsWaitMs: 500, optionsPollMs: 100 });
    assertSafety(evidence);
    assert.equal(evidence.reason, 'row_d_preflight_incomplete');
    assert.deepEqual(evidence.optionsReadiness, { status: 'timed_out', attempts: 6,
      waitRounds: 5, initialUnavailableCount: 1, finalUnavailableCount: 1 });
    assert.equal(evidence.fields.find(row => row.wrapperId === '13_43_0').reason, 'current_options_unavailable');
    assert.equal(evidence.fields.find(row => row.wrapperId === '13_47_0').ok, true);
    const disabled = await fake.run({ optionsWaitMs: 0 });
    assert.equal(disabled.optionsReadiness.attempts, 1);
    assert.equal(disabled.optionsReadiness.waitRounds, 0);
    assert.equal(disabled.optionsReadiness.status, 'timed_out');
  } finally { dom.window.close(); }
});

test('host readiness reserves a complete strict sample after a slow initial inspection', async () => {
  const dom = syntheticDom();
  try {
    dom.window.document.getElementById('synthetic-13_43_0').remove();
    const actual = clone(dom.window.eval(buildCmsRowDOptionsProbeExpression()));
    let clock = 0;
    const fake = fakeCdp({ onSend(method) {
      if (method !== 'Runtime.evaluate') return;
      clock += 100;
      return { result: { value: clone(actual) } };
    } });
    const evidence = await fake.run({ optionsWaitMs: 150, optionsPollMs: 25, now: () => clock });
    assertSafety(evidence);
    assert.equal(evidence.reason, 'row_d_preflight_incomplete');
    assert.equal(evidence.probeCompleted, true);
    assert.deepEqual(evidence.optionsReadiness, { status: 'timed_out', attempts: 1,
      waitRounds: 0, initialUnavailableCount: 1, finalUnavailableCount: 1 });
    assert.equal(Object.hasOwn(evidence, 'failure'), false);
    assert.equal(methods(fake).filter(method => method === 'Runtime.evaluate').length, 1);
    assert.equal(evidence.visibilityKeeper.focusEmulationCleared, true);
  } finally { dom.window.close(); }
});

test('host readiness updates its retry reserve from the slowest completed whole snapshot', async () => {
  const dom = syntheticDom();
  try {
    const document = dom.window.document;
    const firstList = document.getElementById('synthetic-13_43_0');
    const parent = firstList.parentElement;
    firstList.remove();
    document.getElementById('synthetic-13_47_0').remove();
    const initial = clone(dom.window.eval(buildCmsRowDOptionsProbeExpression()));
    parent.append(firstList);
    const latest = clone(dom.window.eval(buildCmsRowDOptionsProbeExpression()));
    let clock = 0;
    let samples = 0;
    const fake = fakeCdp({ onSend(method) {
      if (method !== 'Runtime.evaluate') return;
      samples += 1;
      clock += samples === 1 ? 50 : 160;
      return { result: { value: clone(samples === 1 ? initial : latest) } };
    }, onWait({ calls }) { clock += calls.at(-1).ms; } });
    const evidence = await fake.run({ optionsWaitMs: 500, optionsPollMs: 25, now: () => clock });
    assertSafety(evidence);
    assert.equal(evidence.reason, 'row_d_preflight_incomplete');
    assert.deepEqual(evidence.optionsReadiness, { status: 'timed_out', attempts: 2,
      waitRounds: 1, initialUnavailableCount: 2, finalUnavailableCount: 1 });
    const verdicts = fields => fields.map(({ key, ok, reason }) => ({ key, ok, reason }));
    assert.deepEqual(verdicts(evidence.fields), verdicts(latest.fields));
    assert.equal(Object.hasOwn(evidence, 'failure'), false);
    const evaluations = fake.calls.filter(call => call.method === 'Runtime.evaluate');
    assert.equal(evaluations.length, 2);
    assert.ok(evaluations.every(call => call.params.throwOnSideEffect === true
      && call.params.awaitPromise === false && call.params.userGesture === false));
    assert.ok(evaluations.every(call => call.options.closeOnTimeout === false));
    assert.equal(evaluations[1].params.timeout, 475);
    assert.equal(evaluations[1].options.timeoutMs, 475);
  } finally { dom.window.close(); }
});

test('host readiness rechecks sample headroom after a delayed host wait', async () => {
  const dom = syntheticDom();
  try {
    dom.window.document.getElementById('synthetic-13_43_0').remove();
    const actual = clone(dom.window.eval(buildCmsRowDOptionsProbeExpression()));
    let clock = 0;
    const fake = fakeCdp({ onSend(method) {
      if (method !== 'Runtime.evaluate') return;
      clock += 1;
      return { result: { value: clone(actual) } };
    }, onWait() { clock += 65; } });
    const evidence = await fake.run({ optionsWaitMs: 75, optionsPollMs: 25, now: () => clock });
    assertSafety(evidence);
    assert.equal(evidence.reason, 'row_d_preflight_incomplete');
    assert.deepEqual(evidence.optionsReadiness, { status: 'timed_out', attempts: 1,
      waitRounds: 1, initialUnavailableCount: 1, finalUnavailableCount: 1 });
    assert.equal(Object.hasOwn(evidence, 'failure'), false);
    assert.equal(methods(fake).filter(method => method === 'Runtime.evaluate').length, 1);
  } finally { dom.window.close(); }
});

test('host readiness deadline is checked after wait and before another Runtime command', async () => {
  const dom = syntheticDom();
  try {
    dom.window.document.getElementById('synthetic-13_43_0').remove();
    const actual = clone(dom.window.eval(buildCmsRowDOptionsProbeExpression()));
    let waited = false;
    const fake = fakeCdp({ evaluate: () => clone(actual), async onWait() {
      if (!waited) { waited = true; await new Promise(resolve => setTimeout(resolve, 40)); }
    } });
    const evidence = await fake.run({ optionsWaitMs: 25, optionsPollMs: 25 });
    assertSafety(evidence);
    assert.equal(evidence.optionsReadiness.status, 'timed_out');
    assert.equal(evidence.optionsReadiness.attempts, 1);
    assert.equal(methods(fake).filter(method => method === 'Runtime.evaluate').length, 1);
    assert.equal(evidence.fields.find(row => row.wrapperId === '13_43_0').reason, 'current_options_unavailable');
  } finally { dom.window.close(); }
});

test('host readiness does not authorize a late Runtime reply and still retains its whole actual snapshot', async () => {
  const dom = syntheticDom();
  try {
    const list = dom.window.document.getElementById('synthetic-13_43_0');
    const parent = list.parentElement;
    list.remove();
    let evaluationCount = 0;
    let clock = 0;
    const fake = fakeCdp({ onSend(method, params) {
      if (method !== 'Runtime.evaluate') return;
      evaluationCount += 1;
      if (evaluationCount !== 2) { clock += 1; return; }
      parent.append(list);
      const late = clone(dom.window.eval(params.expression));
      // Model a reply after the host deadline without wall-clock sleeps. The
      // fake transport deliberately returns it despite its 50ms timeout so
      // the runner's independent late-reply authorization check is exercised.
      clock += 90;
      return { result: { value: late } };
    }, evaluate: expression => clone(dom.window.eval(expression)),
    onWait({ calls }) { clock += calls.at(-1).ms; } });
    const evidence = await fake.run({ optionsWaitMs: 75, optionsPollMs: 25, now: () => clock });
    assertSafety(evidence);
    assert.equal(evidence.optionsReadiness.status, 'timed_out');
    assert.equal(evidence.optionsReadiness.attempts, 2);
    assert.equal(evidence.optionsReadiness.finalUnavailableCount, 0);
    assert.equal(evidence.fields.find(row => row.wrapperId === '13_43_0').ok, true);
    const retry = fake.calls.filter(call => call.method === 'Runtime.evaluate')[1];
    assert.equal(retry.params.timeout, 50);
    assert.equal(retry.options.timeoutMs, 50);
  } finally { dom.window.close(); }
});

for (const drift of ['label', 'disabled', 'kind', 'hidden_page', 'wrong_page']) {
  test(`host readiness stops on synthetic ${drift} drift and replaces earlier passing rows`, async () => {
    const dom = syntheticDom();
    try {
      const { document } = dom.window;
      const missing = document.getElementById('synthetic-13_43_0');
      const parent = missing.parentElement;
      missing.remove();
      let changed = false;
      const fake = fakeCdp({ evaluate: expression => clone(dom.window.eval(expression)), onWait() {
        if (changed) return;
        changed = true;
        parent.append(missing);
        const wrapper = document.getElementById('13_47_0');
        if (drift === 'label') wrapper.querySelector('label').textContent = 'synthetic label changed';
        if (drift === 'disabled') wrapper.querySelector('input').disabled = true;
        if (drift === 'kind') wrapper.querySelector('.ant-select').className = 'synthetic-wrong-control';
        if (drift === 'hidden_page') Object.defineProperty(document, 'visibilityState', { get: () => 'hidden' });
        if (drift === 'wrong_page') dom.reconfigure({ url: 'https://example.invalid/synthetic-navigation' });
      } });
      const evidence = await fake.run({ optionsWaitMs: 1000, optionsPollMs: 100 });
      assertSafety(evidence);
      assert.equal(evidence.optionsReadiness.status, 'stopped');
      assert.equal(evidence.optionsReadiness.attempts, 2);
      assert.equal(evidence.fields.find(row => row.wrapperId === '13_47_0').ok, false,
        'the first passing sample cannot conceal the latest failed field');
      if (!['hidden_page', 'wrong_page'].includes(drift)) {
        assert.equal(evidence.fields.find(row => row.wrapperId === '13_43_0').ok, true);
      }
    } finally { dom.window.close(); }
  });
}

test('host readiness does not retry a merely disabled control and can await a loading same-page document', async () => {
  const dom = syntheticDom();
  try {
    const { document } = dom.window;
    document.getElementById('13_43_0').querySelector('input').disabled = true;
    const disabled = fakeCdp({ evaluate: expression => clone(dom.window.eval(expression)) });
    const disabledEvidence = await disabled.run();
    assert.equal(disabledEvidence.optionsReadiness.status, 'not_needed');
    assert.equal(disabledEvidence.optionsReadiness.attempts, 1);
    assert.equal(disabledEvidence.fields.find(row => row.wrapperId === '13_43_0').reason, 'control_not_available');
    document.getElementById('13_43_0').querySelector('input').disabled = false;
    let ready = false;
    Object.defineProperty(document, 'readyState', { get: () => ready ? 'complete' : 'loading' });
    const loading = fakeCdp({ evaluate: expression => clone(dom.window.eval(expression)), onWait() { ready = true; } });
    const evidence = await loading.run({ optionsWaitMs: 1000 });
    assertSafety(evidence);
    assert.equal(evidence.optionsReadiness.status, 'ready');
    assert.equal(evidence.optionsReadiness.attempts, 2);
    assert.equal(evidence.fields.filter(row => row.ok).length, 13);
  } finally { dom.window.close(); }
});

for (const failure of ['exception', 'malformed']) {
  test(`host readiness stops on second ${failure} reply with no weaker evaluation fallback`, async () => {
    const dom = syntheticDom();
    try {
      dom.window.document.getElementById('synthetic-13_43_0').remove();
      const fake = fakeCdp({ evaluate: expression => clone(dom.window.eval(expression)), onSend(method, params, { calls }) {
        if (method !== 'Runtime.evaluate' || calls.filter(row => row.method === method).length !== 2) return;
        return failure === 'exception' ? { exceptionDetails: { text: PRIVATE } }
          : { result: { value: { ...noDocumentInspection(), reason: PRIVATE } } };
      } });
      const evidence = await fake.run({ optionsWaitMs: 1000 });
      assertSafety(evidence);
      assert.equal(evidence.optionsReadiness.status, 'inspection_failed');
      assert.equal(evidence.optionsReadiness.attempts, 2);
      assert.equal(evidence.reason, failure === 'exception' ? 'inspection_exception' : 'inspection_failed');
      assert.equal(evidence.fields.find(row => row.wrapperId === '13_43_0').reason, 'current_options_unavailable');
      assert.ok(fake.calls.filter(row => row.method === 'Runtime.evaluate').every(row => row.params.throwOnSideEffect));
    } finally { dom.window.close(); }
  });
}

for (const traffic of ['unmatched', 'response', 'new_unsafe', 'failed_get_guard']) {
  test(`host readiness stops further reads when passive wait sees ${traffic} traffic`, async () => {
    const dom = syntheticDom();
    try {
      dom.window.document.getElementById('synthetic-13_43_0').remove();
      let sent = false;
      const fake = fakeCdp({ evaluate: expression => clone(dom.window.eval(expression)),
        onSend(method) { if (traffic === 'failed_get_guard' && method === 'Fetch.continueRequest') return Promise.reject(new Error(PRIVATE)); },
        onWait({ emit }) {
          if (sent) return;
          sent = true;
          const events = keeperRequest('readiness');
          if (traffic === 'unmatched') emit(events[0]);
          if (traffic === 'response') {
            events.forEach(emit);
            emit({ method: 'Network.responseReceived', params: { requestId: events[0].params.requestId } });
          }
          if (traffic === 'new_unsafe') emit(paused('PUT'));
          if (traffic === 'failed_get_guard') emit(paused('GET'));
        } });
      const evidence = await fake.run({ optionsWaitMs: 1000 });
      assertSafety(evidence);
      assert.equal(evidence.reason, 'non_get_or_guard_failure');
      assert.equal(evidence.optionsReadiness.status, 'guard_blocked');
      assert.equal(evidence.optionsReadiness.attempts, 1);
      assert.equal(evidence.traffic.responseToNonGetCount, traffic === 'response' ? 1 : 0);
      assert.ok(fake.calls.filter(row => row.method === 'Fetch.continueRequest')
        .every(row => traffic === 'failed_get_guard'));
    } finally { dom.window.close(); }
  });
}

for (const atAttempt of [1, 2]) for (const unsafeCleanup of [false, true]) {
  test(`host readiness stops at pending ACK on attempt ${atAttempt}; final guard remains authoritative (unsafe cleanup=${unsafeCleanup})`, async () => {
    const dom = syntheticDom();
    try {
      dom.window.document.getElementById('synthetic-13_43_0').remove();
      let release;
      let notifyPending;
      const pendingAck = new Promise(resolve => { notifyPending = resolve; });
      let issued = false;
      const fake = fakeCdp({ evaluate: expression => clone(dom.window.eval(expression)),
        onSend(method, params, { calls, emit }) {
          if (method === 'Runtime.evaluate' && calls.filter(row => row.method === method).length === atAttempt) {
            keeperRequest('pending-readiness').forEach(emit);
            issued = true;
          }
          if (method === 'Fetch.failRequest' && !issued) {
            return new Promise(resolve => { release = resolve; notifyPending(); });
          }
          if (method === 'Emulation.setFocusEmulationEnabled' && params.enabled === false) {
            release?.({});
            if (unsafeCleanup) emit(paused('PUT'));
          }
        } });
      // Release the acknowledged keeper block at the start of final drain.
      // The runner deliberately waits for all guard replies before reset.
      const running = fake.run({ optionsWaitMs: 1000 });
      await pendingAck;
      setTimeout(() => release({}), 5);
      const evidence = await running;
      assertSafety(evidence);
      assert.equal(evidence.optionsReadiness.status, 'guard_blocked');
      assert.equal(evidence.optionsReadiness.attempts, atAttempt);
      assert.equal(evidence.fields.find(row => row.wrapperId === '13_43_0').reason, 'current_options_unavailable');
      assert.equal(evidence.reason, unsafeCleanup ? 'non_get_or_guard_failure' : 'row_d_preflight_incomplete');
      assert.equal(evidence.traffic.responseToNonGetCount, 0);
      assert.equal(evidence.traffic.keeperAssessment.status, unsafeCleanup ? 'rejected' : 'correlated_keeper_blocks');
    } finally { dom.window.close(); }
  });
}

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

test('allowlisted structural diagnostics survive evidence redaction without promoting incomplete fields', async () => {
  const inspection = noDocumentInspection();
  inspection.reason = 'row_d_preflight_incomplete';
  const changes = {
    '13_43_0': { reason: 'control_not_available', hiddenSearchInputCount: 1,
      availabilityIssue: 'hidden_non_search_input', observedOptionCount: 2 },
    '13_100701_0': { reason: 'control_kind_mismatch', controlKindIssue: 'conflicting_picker' },
    '13_102501_0': { reason: 'option_dictionary_mismatch', observedOptionCount: 31 },
    '16_65_0': { reason: 'calendar_live_evidence_missing', calendarStructureObserved: true }
  };
  for (const [id, metadata] of Object.entries(changes)) {
    Object.assign(inspection.fields.find(row => row.wrapperId === id), metadata, { arbitraryDiagnostic: PRIVATE });
  }
  const fake = fakeCdp({ evaluate: () => inspection });
  const evidence = await fake.run();
  assertSafety(evidence);
  assert.equal(evidence.probeCompleted, true);
  assert.equal(evidence.reason, 'row_d_preflight_incomplete');
  assert.equal(evidence.ok, false);
  for (const [id, metadata] of Object.entries(changes)) {
    const row = evidence.fields.find(field => field.wrapperId === id);
    assert.equal(row.ok, false);
    assert.equal(row.status, 'skipped');
    assert.equal(Object.hasOwn(row, 'arbitraryDiagnostic'), false);
    for (const [name, expected] of Object.entries(metadata)) assert.equal(row[name], expected);
  }
  assert.equal(evidence.fields.find(row => row.wrapperId === '13_102501_0').optionsComplete, true);
  assert.equal(evidence.fields.find(row => row.wrapperId === '16_65_0').optionsComplete, false);
});

test('only bounded option readiness and exact enumerated provenance metadata reach live evidence', async () => {
  const dom = syntheticDom();
  try {
    const document = dom.window.document;
    document.getElementById('synthetic-13_43_0').remove();
    document.getElementById('synthetic-13_47_0').replaceChildren();
    const fake = fakeCdp({ evaluate: expression => clone(dom.window.eval(expression)) });
    const evidence = await fake.run({ optionsWaitMs: 0 });
    assertSafety(evidence);
    const field = id => evidence.fields.find(row => row.wrapperId === id);
    assert.equal(field('13_43_0').optionsReadiness, 'target_missing');
    assert.equal(field('13_47_0').optionsReadiness, 'list_empty');
    assert.equal(field('13_195_0').optionsReadiness, 'observed');
    assert.equal(field('13_195_0').optionsEvidenceSource, 'aria_controls_dom');
    assert.equal(field('13_43_0').optionsEvidenceSource, undefined);
    assert.equal(field('13_47_0').optionsEvidenceSource, undefined);
    // A modeled sanitized current component enumeration checks the boundary
    // only; lib tests separately mount real Ant components and inspect VNodes.
    const actual = clone(dom.window.eval(buildCmsRowDOptionsProbeExpression()));
    delete actual.fields.find(row => row.wrapperId === '13_43_0').optionsDefinitionIssue;
    Object.assign(actual.fields.find(row => row.wrapperId === '13_43_0'), {
      optionsReadiness: 'target_missing', optionsEvidenceSource: 'owned_select_vnodes',
      observedOptionCount: 2, reason: 'read_only_options_preflight', ok: true, status: 'observed'
    });
    const vnode = await fakeCdp({ evaluate: () => clone(actual) }).run({ optionsWaitMs: 0 });
    assertSafety(vnode);
    assert.equal(vnode.fields.find(row => row.wrapperId === '13_43_0').optionsEvidenceSource, 'owned_select_vnodes');
  } finally { dom.window.close(); }
});

test('loading and failed option-definition diagnostics survive only as unavailable evidence', async () => {
  const dom = syntheticDom();
  try {
    const doc = dom.window.document;
    doc.getElementById('synthetic-13_43_0').remove();
    doc.getElementById('13_47_0').querySelector('.ant-select').setAttribute('aria-busy', 'true');
    const evidence = await fakeCdp({ evaluate: expression => clone(dom.window.eval(expression)) })
      .run({ optionsWaitMs: 0 });
    assertSafety(evidence);
    const missing = evidence.fields.find(row => row.wrapperId === '13_43_0');
    assert.equal(missing.reason, 'current_options_unavailable');
    assert.equal(missing.optionsDefinitionIssue, 'root_anchor_missing');
    const loading = evidence.fields.find(row => row.wrapperId === '13_47_0');
    assert.equal(loading.optionsReadiness, 'loading');
    assert.equal(loading.reason, 'current_options_unavailable');
    assert.equal(loading.observedOptionCount, undefined);
    assert.equal(loading.optionsEvidenceSource, undefined);
  } finally { dom.window.close(); }
});

test('malformed or misplaced structural diagnostics reject Runtime evidence', async () => {
  const invalid = [
    ['13_43_0', { hiddenSearchInputCount: -1 }],
    ['13_43_0', { hiddenSearchInputCount: 2 }],
    ['13_43_0', { hiddenSearchInputCount: 0.5 }],
    ['13_43_0', { hiddenSearchInputCount: PRIVATE }],
    ['13_102402_0', { hiddenSearchInputCount: 0 }],
    ['16_65_0', { observedOptionCount: 0 }],
    ['13_102501_0', { observedOptionCount: -1 }],
    ['13_102501_0', { observedOptionCount: 10001 }],
    ['13_102501_0', { observedOptionCount: 1.5 }],
    ['13_102501_0', { observedOptionCount: PRIVATE }],
    ['13_43_0', { samplePrefixMatched: true }],
    ['16_65_0', { samplePrefixMatched: true }],
    ['13_102501_0', { samplePrefixMatched: PRIVATE }],
    ['13_102501_0', { samplePrefixMatched: true }],
    ['13_102501_0', { samplePrefixMatched: false }],
    ['13_102501_0', { observedOptionCount: 24, samplePrefixMatched: true }],
    ['13_43_0', { calendarStructureObserved: false }],
    ['16_65_0', { reason: 'control_not_available', calendarStructureObserved: true }],
    ['16_65_0', { calendarStructureObserved: PRIVATE }],
    ['13_43_0', { availabilityIssue: 'hidden_control' }],
    ['13_43_0', { reason: 'control_not_available', availabilityIssue: PRIVATE }],
    ['13_43_0', { controlKindIssue: 'conflicting_picker' }],
    ['13_43_0', { reason: 'control_kind_mismatch', controlKindIssue: PRIVATE }],
    ['13_43_0', { optionsComplete: false }],
    ['13_102501_0', { optionsComplete: false }],
    ['13_43_0', { evidenceSource: PRIVATE }],
    ['13_43_0', { optionsReadiness: PRIVATE }],
    ['13_43_0', { optionsDefinitionIssue: PRIVATE }],
    ['13_43_0', { optionsDefinitionIssue: 'root_anchor_missing' }],
    ['13_43_0', { optionsReadiness: 'loading' }],
    ['13_43_0', { reason: 'current_options_unavailable', optionsReadiness: 'loading', observedOptionCount: 0 }],
    ['13_43_0', { reason: 'current_options_unavailable', optionsReadiness: 'loading', optionsDefinitionIssue: 'loading' }],
    ['13_102402_0', { reason: 'current_options_unavailable', optionsReadiness: 'loading' }],
    ['13_43_0', { optionsReadiness: 'observed' }],
    ['13_43_0', { optionsReadiness: 'target_missing' }],
    ['13_102402_0', { optionsReadiness: 'observed' }],
    ['13_43_0', { optionsEvidenceSource: PRIVATE }],
    ['13_43_0', { optionsReadiness: 'target_missing', optionsEvidenceSource: 'owned_select_vnodes' }],
    ['13_43_0', { reason: 'option_dictionary_mismatch', observedOptionCount: 2,
      optionsReadiness: 'observed', optionsEvidenceSource: 'owned_select_vnodes' }],
    ['13_43_0', { reason: 'option_dictionary_mismatch', observedOptionCount: 2,
      optionsReadiness: 'target_missing', optionsEvidenceSource: 'aria_controls_dom' }],
    ['13_43_0', { reason: 'current_options_unavailable', observedOptionCount: 2,
      optionsReadiness: 'target_missing', optionsEvidenceSource: 'owned_select_vnodes' }],
    ['13_43_0', { reason: 'control_not_available', observedOptionCount: 2,
      optionsReadiness: 'observed', optionsEvidenceSource: 'aria_controls_dom' }],
    ['16_65_0', { optionsReadiness: 'observed', optionsEvidenceSource: 'aria_controls_dom', observedOptionCount: 1 }]
  ];
  for (const [id, changes] of invalid) {
    const inspection = noDocumentInspection();
    Object.assign(inspection.fields.find(row => row.wrapperId === id), changes);
    const fake = fakeCdp({ evaluate: () => inspection });
    const evidence = await fake.run();
    assertSafety(evidence);
    assert.equal(evidence.reason, 'inspection_failed', `${id}: ${Object.keys(changes).join(',')}`);
    assert.equal(evidence.probeCompleted, false);
    assert.deepEqual(evidence.fields, []);
  }
});

for (const id of ['13_100701_0', '13_100702_0']) {
  test(`typed independent compound-location proof survives sanitizing for ${id}`, async () => {
    const metadata = locationSuccessMetadata();
    const inspection = secondaryInspection(id, metadata);
    const evidence = await fakeCdp({ evaluate: () => inspection }).run();
    assertSafety(evidence);
    assert.equal(evidence.probeCompleted, true);
    const row = evidence.fields.find(field => field.wrapperId === id);
    assert.equal(row.ok, true);
    assert.equal(row.reason, 'read_only_location_preflight');
    assert.equal(row.optionsComplete, false, 'preflight does not complete the historical dictionary');
    assert.deepEqual(row.locationCompositeEvidence, metadata.locationCompositeEvidence);
    assert.equal(row.currentOptionsIndependentlyObserved, true);
    assert.equal(row.locationSelectionVerified, false);
    if (id === '13_100702_0') {
      assert.equal(row.independentOptionsEvidence, false, 'historical harvest reuse remains explicit');
      assert.equal(row.reusedFrom, '13_100701_0');
    }
    assert.equal(evidence.ok, false, 'other incomplete fields retain their own verdict');
  });
}

test('typed month component and owned calendar panels survive sanitizing without a fill claim', async () => {
  for (const changes of [
    {},
    { calendarFramework: 'vue', calendarEvidenceSource: 'owned_calendar_vnodes' },
    { calendarEvidenceSource: 'aria_controls_calendar_dom', calendarPanelKind: 'month', calendarCellCount: 12, calendarOpen: true },
    { calendarEvidenceSource: 'aria_controls_calendar_dom', calendarPanelKind: 'date', calendarCellCount: 35, calendarOpen: true }
  ]) {
    const metadata = { ...calendarSuccessMetadata(), ...changes };
    const evidence = await fakeCdp({ evaluate: () => secondaryInspection('16_65_0', metadata) }).run();
    assertSafety(evidence);
    assert.equal(evidence.probeCompleted, true);
    const row = evidence.fields.find(field => field.wrapperId === '16_65_0');
    assert.equal(row.ok, true);
    assert.equal(row.reason, 'read_only_calendar_preflight');
    assert.equal(row.optionsComplete, false);
    for (const name of Object.keys(metadata)) assert.equal(row[name], metadata[name], name);
  }
});

function reactPortalSuccessMetadata() {
  return { ok: true, status: 'observed', reason: 'read_only_calendar_preflight',
    calendarStructureObserved: true, calendarFramework: 'react',
    calendarEvidenceSource: 'owned_react_portal', calendarPickerKind: 'unverified',
    calendarMode: 'month', calendarPanelKind: 'month', calendarCellCount: 12 };
}

for (const timing of [undefined, 'observed_then_closed']) {
  test(`typed React portal shape survives cleaning with honest picker identity (timing=${timing})`, async () => {
    const metadata = reactPortalSuccessMetadata();
    if (timing !== undefined) metadata.calendarEvidenceTiming = timing;
    const evidence = await fakeCdp({ evaluate: () => secondaryInspection('16_65_0', metadata) }).run();
    assertSafety(evidence);
    assert.equal(evidence.probeCompleted, true);
    const row = evidence.fields.find(field => field.key === 'englishExamDate');
    assert.equal(row.ok, true);
    assert.equal(row.calendarPickerKind, 'unverified');
    assert.equal(row.calendarEvidenceSource, 'owned_react_portal');
    assert.equal(row.calendarEvidenceTiming, timing);
    assert.equal(Object.hasOwn(row, 'calendarFormat'), false);
    assert.equal(Object.hasOwn(row, 'calendarOpen'), false);
  });
}

for (const [name, change] of [
  ['forged MonthPicker kind', metadata => { metadata.calendarPickerKind = 'month'; }],
  ['date panel', metadata => { metadata.calendarPanelKind = 'date'; metadata.calendarCellCount = 42; }],
  ['extra month format', metadata => { metadata.calendarFormat = 'YYYY-MM'; }],
  ['extra open state', metadata => { metadata.calendarOpen = true; }],
  ['Vue framework mismatch', metadata => { metadata.calendarFramework = 'vue'; }],
  ['unknown evidence timing', metadata => { metadata.calendarEvidenceTiming = PRIVATE; }],
  ['internal panel ownership', metadata => { metadata.calendarPanelOwned = true; }],
  ['internal panel state', metadata => { metadata.calendarPanelState = 'month'; }],
  ['internal action target', metadata => { metadata.calendarPanelTarget = PRIVATE; }]
]) {
  test(`React portal cleaner rejects ${name}`, async () => {
    const metadata = reactPortalSuccessMetadata(); change(metadata);
    const evidence = await fakeCdp({ evaluate: () => secondaryInspection('16_65_0', metadata) }).run();
    assertSafety(evidence);
    assert.equal(evidence.reason, 'inspection_failed');
    assert.equal(evidence.probeCompleted, false);
    assert.deepEqual(evidence.fields, []);
  });
}

test('closed-panel observation merges the latest unrelated field failure instead of the candidate snapshot', async () => {
  const dom = syntheticDom();
  let initial;
  try { initial = clone(dom.window.eval(buildCmsRowDOptionsProbeExpression())); }
  finally { dom.window.close(); }
  for (const id of ['13_100701_0', '13_100702_0']) {
    const row = initial.fields.find(field => field.wrapperId === id);
    delete row.controlKindIssue;
    Object.assign(row, locationSuccessMetadata());
  }
  const initialCalendar = initial.fields.find(field => field.key === 'englishExamDate');
  Object.assign(initialCalendar, { calendarStructureObserved: true, calendarFramework: 'react',
    calendarDefinitionIssue: 'month_component_unrecognized' });
  initial.ok = true; initial.reason = 'read_only_preflight';
  const candidate = clone(initial);
  const candidateCalendar = candidate.fields.find(field => field.key === 'englishExamDate');
  delete candidateCalendar.calendarDefinitionIssue;
  Object.assign(candidateCalendar, reactPortalSuccessMetadata());
  const final = clone(initial);
  const drift = noDocumentInspection().fields.find(field => field.wrapperId === '13_43_0');
  drift.reason = 'control_not_available'; drift.availabilityIssue = 'hidden_control';
  final.fields[final.fields.findIndex(field => field.wrapperId === '13_43_0')] = drift;
  final.ok = false; final.reason = 'row_d_preflight_incomplete';
  let fullReads = 0, state = 'closed', action, geometryNode;
  const nodeIds = { open: 11, month_header: 12, close_focus: 13, close_blank: 14 };
  const fake = fakeCdp({ onSend(method, params) {
    if (method === 'Runtime.evaluate') {
      assert.equal(params.throwOnSideEffect, true);
      assert.equal(params.userGesture, false);
      assert.equal(params.awaitPromise, false);
      const actionMatch = params.expression.match(/return inspect\(picker, input, item, doc, "([a-z_]+)"\)/u);
      if (!actionMatch) {
        fullReads += 1;
        return { result: { value: clone(fullReads === 1 ? initial : fullReads === 2 ? candidate : final) } };
      }
      action = actionMatch[1];
      if (action !== 'evidence') return { result: { type: 'object', subtype: 'node', objectId: `calendar-node-${nodeIds[action]}` } };
      const value = state === 'closed' ? { ok: false, calendarFramework: 'react',
        calendarDefinitionIssue: 'calendar_portal_hidden', calendarPanelState: 'closed' }
        : state === 'date' ? { ok: false, calendarFramework: 'react', calendarDefinitionIssue: 'calendar_panel_shape_unsupported',
          calendarPanelOwned: true, calendarPanelState: 'date' }
          : { ok: true, calendarFramework: 'react', calendarPanelOwned: true, calendarPanelState: 'month' };
      return { result: { value } };
    }
    if (method === 'DOM.requestNode') return { nodeId: Number(params.objectId.split('-').at(-1)) };
    if (method === 'DOM.getBoxModel') {
      geometryNode = params.nodeId;
      return { model: { content: [10, 10, 30, 10, 30, 30, 10, 30] } };
    }
    if (method === 'Page.getLayoutMetrics') return { cssVisualViewport: {
      pageX: 0, pageY: 0, clientWidth: 100, clientHeight: 100, scale: 1 } };
    if (method === 'DOM.getNodeForLocation') return { backendNodeId: geometryNode + 100 };
    if (method === 'DOM.describeNode') return { node: { backendNodeId: params.nodeId + 100 } };
    if (method === 'Input.dispatchMouseEvent' && params.type === 'mouseReleased') {
      state = action === 'open' ? 'date' : action === 'month_header' ? 'month' : 'closed';
    }
    if (method === 'Input.dispatchKeyEvent' && params.type === 'keyUp') state = 'closed';
  } });
  const evidence = await fake.run({ calendarPanelReadOnly: true });
  assert.equal(fullReads, 3, 'initial, opened-panel candidate and closed-panel final reads');
  assert.equal(evidence.calendarObservation.status, 'observed');
  assert.equal(evidence.calendarObservation.panelClosed, true);
  assert.equal(evidence.restoration, 'calendar_panel_closed_no_value_writes');
  assertSafety({ ...evidence, restoration: 'not_needed_no_interaction' });
  assert.equal(evidence.ok, false, 'calendar evidence cannot conceal another field becoming unavailable');
  assert.equal(evidence.reason, 'row_d_preflight_incomplete');
  assert.equal(evidence.fields.find(field => field.wrapperId === '13_43_0').reason, 'control_not_available');
  const calendar = evidence.fields.find(field => field.key === 'englishExamDate');
  assert.equal(calendar.ok, true);
  assert.equal(calendar.calendarPickerKind, 'unverified');
  assert.equal(calendar.calendarEvidenceTiming, 'observed_then_closed');
  assert.equal(evidence.traffic.commandFailed, false);
  assert.equal(evidence.traffic.observedNonGetCount, 0);
});

test('new typed preflights can complete a modeled snapshot without new acceptance flags', async () => {
  const dom = syntheticDom();
  try {
    const inspection = clone(dom.window.eval(buildCmsRowDOptionsProbeExpression()));
    for (const id of ['13_100701_0', '13_100702_0']) {
      const row = inspection.fields.find(field => field.wrapperId === id);
      delete row.controlKindIssue;
      Object.assign(row, locationSuccessMetadata());
    }
    const calendar = inspection.fields.find(field => field.wrapperId === '16_65_0');
    delete calendar.calendarDefinitionIssue;
    Object.assign(calendar, calendarSuccessMetadata());
    inspection.ok = true;
    inspection.reason = 'read_only_preflight';
    const evidence = await fakeCdp({ evaluate: () => inspection }).run();
    assertSafety(evidence);
    assert.equal(evidence.ok, true);
    assert.equal(evidence.fields.filter(row => row.ok).length, 16);
    assert.equal(Object.hasOwn(evidence, 'PASS_PREFLIGHT'), false);
    assert.equal(Object.hasOwn(evidence, 'bookD'), false);
  } finally { dom.window.close(); }
});

test('compound-location successes reject missing, foreign, malformed and value-bearing proof', async () => {
  const cases = [
    metadata => { delete metadata.locationCompositeEvidence; },
    metadata => { delete metadata.currentOptionsIndependentlyObserved; },
    metadata => { metadata.currentOptionsIndependentlyObserved = false; },
    metadata => { delete metadata.locationSelectionVerified; },
    metadata => { metadata.locationSelectionVerified = true; },
    metadata => { metadata.observedOptionCount = 29; },
    metadata => { metadata.samplePrefixMatched = false; },
    metadata => { metadata.locationCompositeEvidence.hostCount = 3; },
    metadata => { metadata.locationCompositeEvidence.cascaderCount = 2; },
    metadata => { metadata.locationCompositeEvidence.cascaderOwnsBoth = false; },
    metadata => { metadata.locationCompositeEvidence.optionsHostSlot = 1; },
    metadata => { metadata.locationCompositeEvidence.value = PRIVATE; },
    metadata => { metadata.locationCompositeEvidence.hosts[0].inputOwned = false; },
    metadata => { metadata.locationCompositeEvidence.hosts[1].hostSlot = 0; },
    metadata => { metadata.locationCompositeEvidence.hosts[0].ariaOwnerCount = 2; },
    metadata => { metadata.locationCompositeEvidence.hosts[0].listState = 'linked_structure_observed'; },
    metadata => { metadata.locationCompositeEvidence.hosts[0].selectedValue = PRIVATE; },
    metadata => { delete metadata.locationCompositeEvidence.hosts[0]; },
    metadata => { metadata.locationCompositeEvidence.hosts.extra = PRIVATE; },
    metadata => { Object.defineProperty(metadata.locationCompositeEvidence, 'hostsArePeers', {
      enumerable: true, get() { throw new Error(PRIVATE); } }); },
    metadata => { Object.defineProperty(metadata.locationCompositeEvidence.hosts[0], 'inputOwned', {
      enumerable: true, get() { throw new Error(PRIVATE); } }); }
  ];
  for (const [index, tamper] of cases.entries()) {
    const metadata = locationSuccessMetadata();
    tamper(metadata);
    const inspection = secondaryInspection('13_100701_0', metadata);
    const evidence = await fakeCdp({ evaluate: () => inspection }).run();
    assertSafety(evidence);
    assert.equal(evidence.reason, 'inspection_failed', String(index));
    assert.equal(evidence.probeCompleted, false, String(index));
  }
  const getterInspection = secondaryInspection('13_100701_0', locationSuccessMetadata());
  Object.defineProperty(getterInspection.fields.find(row => row.wrapperId === '13_100701_0'),
    'locationSelectionVerified', { enumerable: true, get() { throw new Error(PRIVATE); } });
  const getterEvidence = await fakeCdp({ evaluate: () => getterInspection }).run();
  assertSafety(getterEvidence);
  assert.equal(getterEvidence.reason, 'inspection_failed');
  for (const id of ['13_43_0', '16_65_0']) {
    const evidence = await fakeCdp({ evaluate: () => secondaryInspection(id, locationSuccessMetadata()) }).run();
    assertSafety(evidence);
    assert.equal(evidence.reason, 'inspection_failed');
  }
});

test('month preflight rejects missing, foreign, contradictory and value-bearing calendar evidence', async () => {
  const cases = [
    metadata => { delete metadata.calendarStructureObserved; },
    metadata => { delete metadata.calendarEvidenceSource; },
    metadata => { delete metadata.calendarFramework; },
    metadata => { metadata.calendarFramework = 'vue'; },
    metadata => { metadata.calendarPickerKind = 'date'; },
    metadata => { delete metadata.calendarMode; },
    metadata => { metadata.calendarMode = 'date'; },
    metadata => { delete metadata.calendarFormat; },
    metadata => { metadata.calendarFormat = PRIVATE; },
    metadata => { metadata.calendarOpen = PRIVATE; },
    metadata => { metadata.calendarDefinitionIssue = 'calendar_format_missing'; },
    metadata => { metadata.calendarValue = PRIVATE; },
    metadata => { metadata.calendarPanelKind = 'month'; metadata.calendarCellCount = 12; },
    metadata => { metadata.calendarEvidenceSource = 'aria_controls_calendar_dom'; },
    metadata => { metadata.calendarEvidenceSource = 'aria_controls_calendar_dom';
      metadata.calendarPanelKind = 'month'; metadata.calendarCellCount = 11; },
    metadata => { metadata.calendarEvidenceSource = 'aria_controls_calendar_dom';
      metadata.calendarPanelKind = 'date'; metadata.calendarCellCount = 30; },
    metadata => { metadata.calendarEvidenceSource = 'aria_controls_calendar_dom';
      metadata.calendarPanelKind = 'month'; metadata.calendarCellCount = 12; metadata.calendarOpen = false; }
  ];
  for (const [index, tamper] of cases.entries()) {
    const metadata = calendarSuccessMetadata();
    tamper(metadata);
    const evidence = await fakeCdp({ evaluate: () => secondaryInspection('16_65_0', metadata) }).run();
    assertSafety(evidence);
    assert.equal(evidence.reason, 'inspection_failed', String(index));
    assert.equal(evidence.probeCompleted, false, String(index));
  }
  const getterInspection = secondaryInspection('16_65_0', calendarSuccessMetadata());
  Object.defineProperty(getterInspection.fields.find(row => row.wrapperId === '16_65_0'), 'calendarFormat', {
    enumerable: true, get() { throw new Error(PRIVATE); } });
  const getterEvidence = await fakeCdp({ evaluate: () => getterInspection }).run();
  assertSafety(getterEvidence);
  assert.equal(getterEvidence.reason, 'inspection_failed');
  for (const id of ['13_43_0', '13_100701_0']) {
    const evidence = await fakeCdp({ evaluate: () => secondaryInspection(id, calendarSuccessMetadata()) }).run();
    assertSafety(evidence);
    assert.equal(evidence.reason, 'inspection_failed');
  }
});

test('calendar diagnostics retain a missing-evidence verdict and never become proof', async () => {
  const metadata = { calendarStructureObserved: true, calendarFramework: 'react',
    calendarDefinitionIssue: 'calendar_format_missing', reason: 'calendar_live_evidence_missing' };
  const evidence = await fakeCdp({ evaluate: () => secondaryInspection('16_65_0', metadata) }).run();
  assertSafety(evidence);
  assert.equal(evidence.probeCompleted, true);
  const row = evidence.fields.find(field => field.wrapperId === '16_65_0');
  assert.equal(row.ok, false);
  assert.equal(row.calendarDefinitionIssue, 'calendar_format_missing');
  assert.equal(row.calendarEvidenceSource, undefined);
});

test('verified location structure survives later honest control and option refusals', async () => {
  for (const changes of [
    { reason: 'control_kind_mismatch', controlKindIssue: 'mixed_choice_controls' },
    { reason: 'control_not_unique' },
    { reason: 'control_not_available', availabilityIssue: 'hidden_control' },
    { reason: 'dropdown_reference_missing_or_ambiguous' },
    { reason: 'dropdown_owner_not_unique' },
    { reason: 'dropdown_target_not_unique' },
    { reason: 'dropdown_scope_mismatch' },
    { reason: 'option_ownership_mismatch' },
    { reason: 'option_not_available' }
  ]) {
    const metadata = { ...changes, locationSelectionVerified: false, locationCompositeEvidence: locationProof() };
    const evidence = await fakeCdp({ evaluate: () => secondaryInspection('13_100701_0', metadata) }).run();
    assertSafety(evidence);
    assert.equal(evidence.probeCompleted, true, changes.reason);
    const row = evidence.fields.find(field => field.wrapperId === '13_100701_0');
    assert.equal(row.ok, false);
    assert.equal(row.reason, changes.reason);
    assert.equal(row.locationCompositeEvidence.hostCount, 2);
    assert.equal(row.currentOptionsIndependentlyObserved, undefined);
  }
});

test('new location host diagnostics remain scoped honest refusals', async () => {
  for (const metadata of [
    { reason: 'control_kind_mismatch', controlKindIssue: 'location_host_structure_unverified' },
    { reason: 'control_not_available', availabilityIssue: 'location_host_unavailable' }
  ]) {
    const evidence = await fakeCdp({ evaluate: () => secondaryInspection('13_100701_0', metadata) }).run();
    assertSafety(evidence);
    assert.equal(evidence.probeCompleted, true);
    assert.equal(evidence.fields.find(field => field.wrapperId === '13_100701_0').reason, metadata.reason);
    const foreign = await fakeCdp({ evaluate: () => secondaryInspection('13_43_0', metadata) }).run();
    assertSafety(foreign);
    assert.equal(foreign.reason, 'inspection_failed');
  }
});

for (const id of ['13_100701_0', '13_100702_0', '16_65_0']) {
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
    [{ onWait({ calls }) {
      if (!calls.some(call => call.method === 'Emulation.setFocusEmulationEnabled'
        && call.params.enabled === false)) throw new Error(PRIVATE);
    } }, 'settlement_failed']
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
  assert.equal(config.optionsWaitMs, 2000);
  assert.equal(config.optionsPollMs, 100);
  assert.equal(config.outDir, path.join(root, '_temp-scripts/cms-row-d-live-never-save'));
  assert.deepEqual(config.requests, {});
  const input = path.join(temporary, 'requests.json');
  const requests = { '13_47_0': '11-20万', '13_102501_0': ['宏观', '策略', '债券'] };
  fs.writeFileSync(input, JSON.stringify(requests), 'utf8');
  const custom = readRowDProbeConfig({ PORT: '9243', STEP_TIMEOUT_MS: '1000',
    OPTIONS_WAIT_MS: '0', OPTIONS_POLL_MS: '25',
    OUTDIR: path.join(temporary, 'out'), REQUESTS_FILE: input }, root, root);
  assert.equal(custom.port, 9243);
  assert.equal(custom.timeoutMs, 1000);
  assert.equal(custom.optionsWaitMs, 0);
  assert.equal(custom.optionsPollMs, 25);
  assert.deepEqual(custom.requests, requests);
});

test('config rejects bad ports/timeouts, path escapes, unknown labels, and oversized files', t => {
  const temporary = temporaryDirectory(t);
  for (const env of [{ PORT: '0' }, { PORT: '65536' }, { PORT: 'localhost' }, { PORT: 9242 },
    { STEP_TIMEOUT_MS: '999' }, { STEP_TIMEOUT_MS: '30001' }, { STEP_TIMEOUT_MS: 'Infinity' },
    { OPTIONS_WAIT_MS: '-1' }, { OPTIONS_WAIT_MS: '5001' }, { OPTIONS_WAIT_MS: '' },
    { OPTIONS_WAIT_MS: 100 }, { OPTIONS_POLL_MS: '24' }, { OPTIONS_POLL_MS: '501' },
    { OPTIONS_POLL_MS: 'Infinity' }, { OPTIONS_POLL_MS: 100 },
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

test('read-only calendar panel config is explicitly opt-in', () => {
  const defaults = readRowDProbeConfig({}, root, root);
  const disabled = readRowDProbeConfig({ CALENDAR_PANEL_READONLY: '0' }, root, root);
  const enabled = readRowDProbeConfig({ CALENDAR_PANEL_READONLY: '1' }, root, root);
  assert.equal(Object.hasOwn(defaults, 'calendarPanelReadOnly'), false);
  assert.equal(Object.hasOwn(disabled, 'calendarPanelReadOnly'), false);
  assert.equal(enabled.calendarPanelReadOnly, true);
  for (const value of ['', 'true', 'false', 'yes', '2', '01', 1, true, {}]) {
    assert.throws(() => readRowDProbeConfig({ CALENDAR_PANEL_READONLY: value }, root, root), TypeError);
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
    assert.match(child.stdout, /Booked stays 70/);
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


test('R8 settlement shares one deadline across checkpoints and remains stopped after later full correlation', async t => {
  const guard = createRowDNetworkGuard(() => Promise.resolve({}));
  guard.setKeeperActive(true);
  const first = keeperRequest('settle-first');
  const second = keeperRequest('settle-second');
  const timers = [];
  t.after(() => { for (const timer of timers) clearTimeout(timer); });
  guard.onEvent(first[0]);
  timers.push(setTimeout(() => guard.onEvent(first[1]), 70));
  assert.equal((await guard.settleKeeper()).status, 'settled');
  guard.onEvent(second[0]);
  let lateDelivered = false;
  timers.push(setTimeout(() => { lateDelivered = true; guard.onEvent(second[1]); }, 230));
  const stop = await guard.settleKeeper();
  assert.equal(stop.status, 'deadline_exceeded', 'a second checkpoint cannot renew the first deadline');
  assert.equal(stop.ready, false);
  assert.equal(lateDelivered, false);
  for (const timer of timers) clearTimeout(timer);
  guard.onEvent(second[1]);
  await guard.drain();
  assert.equal(guard.failed(), false, 'the strict terminal ledger may become complete during cleanup');
  const retry = await guard.settleKeeper();
  assert.equal(retry.ready, false, 'cleanup proof cannot revive an expired inspection authorization');
  assert.equal(retry.status, 'deadline_exceeded');
});

for (const mode of ['invalid_network_id', 'invalid_fetch_id', 'duplicate', 'conflict', 'response', 'truncation', 'ineligible', 'outside_keeper']) {
  test(`R8 permanent ${mode} failure never enters settlement waiting`, async () => {
    const guard = createRowDNetworkGuard(() => Promise.resolve({}));
    guard.setKeeperActive(mode !== 'outside_keeper');
    const [network, fetch] = keeperRequest('fatal');
    if (mode === 'invalid_network_id') fetch.params.networkId = null;
    if (mode === 'invalid_fetch_id') delete fetch.params.requestId;
    if (mode === 'conflict') fetch.params.request = { ...fetch.params.request, url: fetch.params.request.url + '&conflict=1' };
    if (mode === 'ineligible') network.params.request = fetch.params.request = { method: 'POST', url: 'https://example.invalid/other' };
    guard.onEvent(network);
    guard.onEvent(fetch);
    if (mode === 'duplicate') guard.onEvent(network);
    if (mode === 'response') guard.onEvent({ method: 'Network.responseReceived', params: { requestId: network.params.requestId } });
    if (mode === 'truncation') for (let index = 0; index < 210; index += 1) keeperRequest('over-limit-' + index).forEach(guard.onEvent);
    await guard.drain();
    let waits = 0;
    const assessment = await guard.settleKeeper(async () => { waits += 1; });
    assert.equal(assessment.ready, false);
    assert.equal(assessment.status, mode === 'outside_keeper' ? 'inactive_keeper' : 'permanent_failure');
    assert.equal(waits, 0);
    assert.equal(JSON.stringify(assessment).includes(PRIVATE), false);
  });
}
