/** Offline HTTP/WebSocket CDP stub only. No browser, account, or live page. */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import vm from 'node:vm';
import fs from 'node:fs';
import { WebSocketServer } from 'ws';
import { ROW_D_PAGE, ROW_D_FIELDS } from '../scripts/lib/cms-row-d-options.mjs';
import { runCmsRowDLive } from '../scripts/live/cms-row-d-live.mjs';

const PRIVATE = 'OFFLINE_PRIVATE_BODY_QUERY_ERROR_SENTINEL';
const autosaveUrl = new URL(`/wecruit/resume/info/edit/${new URL(ROW_D_PAGE).pathname.split('/')[1]}`, ROW_D_PAGE).href;

const historicalShape = JSON.parse(fs.readFileSync(new URL('./fixtures/cms-row-d-keeper-nongget-r6.json', import.meta.url), 'utf8'));

// Explicit hypothetical projection of the dictionary change; historical fields
// stay untouched in their fixture. This is not a new real-page observation.
const liveShape = structuredClone(historicalShape);
const researchProjection = liveShape.inspection.fields.find(row => row.key === 'researchInterests');
Object.assign(researchProjection, { optionsComplete: true, ok: true, status: 'observed', reason: 'read_only_options_preflight' });
delete researchProjection.samplePrefixMatched;

// Adapt only stale dictionary metadata while retaining the recorded twelve
// successful fields and four skips. This models a current incomplete probe,
// not a new observation or replay of the historical research verdict.
const twelveFieldShape = structuredClone(historicalShape);
const incompleteResearch = twelveFieldShape.inspection.fields.find(row => row.key === 'researchInterests');
Object.assign(incompleteResearch, { optionsComplete: true, reason: 'option_dictionary_mismatch' });
delete incompleteResearch.samplePrefixMatched;

async function cdpStub(t, {
  nonGet = false, blockFails = false, visibilityNonGetAt, networkCase, inspection,
  evaluationGet = true, omitEvaluationReplyAt
} = {}) {
  const calls = [];
  const server = http.createServer((request, response) => {
    assert.equal(request.method, 'GET');
    assert.equal(request.url, '/json/list');
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify([{ type: 'page', id: 'synthetic-tab',
      url: `${ROW_D_PAGE}?resumeId=${PRIVATE}`,
      webSocketDebuggerUrl: `ws://127.0.0.1:${server.address().port}/devtools/page/synthetic-tab` }]));
  });
  const wss = new WebSocketServer({ server });
  wss.on('connection', socket => {
    let focusEnabled = false;
    let evaluationCount = 0;
    socket.on('message', raw => {
      const message = JSON.parse(String(raw));
      calls.push(message);
      const reply = result => socket.send(JSON.stringify({ id: message.id, result }));
      const event = (method, params) => socket.send(JSON.stringify({ method, params }));
      const requestEvents = (method, { pause = true, networkId = `network-${method}`,
        missingNetworkId = false, reverse = false, tag = method } = {}) => {
        const request = { method, url: `${autosaveUrl}?iSaJAx=isAjax&request_locale=zh_CN&synthetic=${PRIVATE}`,
          postData: PRIVATE, headers: { 'X-Private': PRIVATE } };
        const observed = () => event('Network.requestWillBeSent', { requestId: `network-${tag}`, request });
        const intercepted = () => { if (pause) event('Fetch.requestPaused', { requestId: `paused-${tag}`,
          ...(missingNetworkId ? {} : { networkId }), request }); };
        if (reverse) { intercepted(); observed(); }
        else { observed(); intercepted(); }
        return request;
      };
      if (message.method === 'Fetch.enable' && networkCase === 'guard_enable') requestEvents('POST');
      if (['Target.activateTarget', 'Page.bringToFront', 'Emulation.setFocusEmulationEnabled'].includes(message.method)) {
        const names = calls.map(call => call.method);
        assert.ok(names.includes('Network.enable'));
        assert.ok(names.includes('Fetch.enable'));
        assert.equal(names.includes('Fetch.disable'), false);
        if (message.method === 'Emulation.setFocusEmulationEnabled') focusEnabled = message.params.enabled;
        if (message.method === visibilityNonGetAt && message.params.enabled !== false) requestEvents('POST');
      }
      if (message.method === 'Runtime.evaluate') {
        evaluationCount += 1;
        const names = calls.map(call => call.method);
        assert.ok(names.indexOf('Network.enable') < names.indexOf('Runtime.evaluate'));
        assert.ok(names.indexOf('Fetch.enable') < names.indexOf('Runtime.evaluate'));
        assert.ok(names.indexOf('Target.activateTarget') < names.indexOf('Page.bringToFront'));
        assert.ok(names.indexOf('Page.bringToFront') < names.indexOf('Emulation.setFocusEmulationEnabled'));
        assert.equal(focusEnabled, true);
        assert.equal(message.params.throwOnSideEffect, true);
        assert.equal(message.params.userGesture, false);
        assert.equal(message.params.awaitPromise, false);
        const methods = nonGet ? ['GET', 'POST', 'HEAD'] : evaluationGet ? ['GET'] : [];
        for (const method of methods) requestEvents(method);
        if (networkCase === 'early_response') event('Network.responseReceived', {
          requestId: 'network-POST', response: { status: 200, body: PRIVATE }
        });
        if (['blocked_info_edit', 'response', 'early_response', 'redirect'].includes(networkCase)) requestEvents('POST');
        if (networkCase === 'unmatched_observation') requestEvents('POST', { pause: false });
        if (networkCase === 'mismatched_network_id') requestEvents('POST', { networkId: 'unmatched-network' });
        if (networkCase === 'r7_missing_early_response') event('Network.responseReceived', { requestId: 'network-POST' });
        if (networkCase?.startsWith('r7_missing') && networkCase !== 'r7_missing_late') {
          requestEvents('POST', { missingNetworkId: true, reverse: networkCase === 'r7_missing_reverse' });
          if (networkCase === 'r7_missing_response') event('Network.responseReceived', { requestId: 'network-POST' });
          if (networkCase === 'r7_missing_second') requestEvents('POST', { missingNetworkId: true, tag: 'second' });
        }
        if (networkCase === 'response') event('Network.responseReceived', {
          requestId: 'network-POST', response: { status: 200, body: PRIVATE }
        });
        if (networkCase === 'redirect') {
          event('Network.requestWillBeSent', {
            requestId: 'network-POST',
            request: { method: 'GET', url: `https://wecruit.hotjob.cn/finished?token=${PRIVATE}` },
            redirectResponse: { status: 302, url: `https://wecruit.hotjob.cn/resume/info/edit?token=${PRIVATE}` }
          });
          event('Network.responseReceived', { requestId: 'network-POST', response: { status: 200, body: PRIVATE } });
        }
        // Default: execute the real inspector in an empty synthetic realm.
        // An explicit fixture replays sanitized per-field evidence only.
        if (evaluationCount === omitEvaluationReplyAt) return;
        const current = typeof inspection === 'function' ? inspection(evaluationCount) : inspection;
        reply({ result: { value: current ?? vm.runInNewContext(message.params.expression) } });
      } else if (message.method === 'Fetch.failRequest' && blockFails) {
        socket.send(JSON.stringify({ id: message.id, error: { message: PRIVATE } }));
      } else {
        if (message.method === 'Fetch.disable') {
          assert.equal(focusEnabled, false);
          if (networkCase === 'late_fetch_disable') requestEvents('POST');
          if (networkCase === 'r7_missing_late') requestEvents('POST', { missingNetworkId: true });
        }
        reply({});
      }
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    for (const socket of wss.clients) socket.terminate();
    await new Promise(resolve => wss.close(resolve));
    await new Promise(resolve => server.close(resolve));
  });
  return { calls, port: server.address().port };
}

function safe(result) {
  for (const row of [result, ...result.fields]) {
    assert.equal(row.neverSave, true);
    assert.equal(row.liveSupportClaimed, false);
    assert.equal(row.livePassClaimed, false);
    assert.equal(row.writeStarted, false);
    assert.equal(row.mutationAllowed, false);
    assert.equal(row.valuesExposed, false);
    assert.equal(row.probeOnly, true);
  }
  assert.equal(result.livePassClaimed, false);
  assert.equal(result.booked, 58);
  assert.equal(result.restoration, 'not_needed_no_interaction');
  assert.equal(JSON.stringify(result).includes(PRIVATE), false);
}

test('actual loopback CDP transport continues GET and returns an honest incomplete synthetic inspection', async t => {
  const stub = await cdpStub(t);
  const result = await runCmsRowDLive({ port: stub.port, timeoutMs: 1000, wait: async () => {} });
  safe(result);
  assert.equal(result.ok, false);
  assert.equal(result.probeCompleted, true);
  assert.equal(result.reason, 'no_document');
  assert.equal(result.fields.length, ROW_D_FIELDS.length);
  assert.equal(result.traffic.observedNonGetCount, 0);
  assert.equal(result.traffic.commandFailed, false);
  const names = stub.calls.map(call => call.method);
  assert.ok(names.includes('Fetch.continueRequest'));
  assert.equal(names.includes('Fetch.failRequest'), false);
  assert.ok(names.indexOf('Fetch.continueRequest') < names.indexOf('Fetch.disable'));
  assert.ok(names.indexOf('Fetch.disable') < names.indexOf('Network.disable'));
  assert.deepEqual(stub.calls.filter(call => call.method === 'Emulation.setFocusEmulationEnabled')
    .map(call => call.params), [{ enabled: true }, { enabled: false }]);
  assert.deepEqual(result.visibilityKeeper, { targetActivated: true, pageBroughtToFront: true,
    focusEmulationEnabled: true, focusEmulationCleared: true });
});

function modeledUnavailableInspection() {
  // This sanitized hypothetical projection exercises host timing only. It
  // does not add a CMS DOM capture or alter the historical fixture.
  const inspection = structuredClone(liveShape.inspection);
  const row = inspection.fields.find(field => field.key === 'expectedWorkNature');
  Object.assign(row, { ok: false, status: 'skipped', reason: 'current_options_unavailable',
    optionsReadiness: 'target_missing' });
  delete row.observedOptionCount;
  delete row.optionsEvidenceSource;
  return inspection;
}

test('actual loopback transport passively repeats the same strict expression and retains newest readiness evidence', async t => {
  const stub = await cdpStub(t, { evaluationGet: false,
    inspection: attempt => attempt === 1 ? modeledUnavailableInspection() : liveShape.inspection });
  const result = await runCmsRowDLive({ port: stub.port, timeoutMs: 1000,
    optionsWaitMs: 500, optionsPollMs: 25, wait: async () => {} });
  safe(result);
  assert.equal(result.reason, 'row_d_preflight_incomplete');
  assert.deepEqual(result.optionsReadiness, { status: 'ready', attempts: 2,
    waitRounds: 1, initialUnavailableCount: 1, finalUnavailableCount: 0 });
  assert.equal(result.fields.filter(row => row.ok).length, 13);
  const evaluations = stub.calls.filter(call => call.method === 'Runtime.evaluate');
  assert.equal(evaluations.length, 2);
  assert.equal(evaluations[0].params.expression, evaluations[1].params.expression);
  assert.ok(evaluations.every(call => call.params.throwOnSideEffect === true));
  assert.ok(evaluations[1].params.timeout <= 500);
  assert.equal(stub.calls.filter(call => call.method === 'Target.activateTarget').length, 1);
});

test('actual loopback transport avoids a short final read when completed inspection cost no longer fits', async t => {
  // The host clock models sample cost deterministically; transport and cleanup
  // use the real loopback CDP client. This is not a new CMS timing observation.
  let clock = 0;
  const stub = await cdpStub(t, { evaluationGet: false, inspection() {
    clock += 80;
    return modeledUnavailableInspection();
  } });
  const result = await runCmsRowDLive({ port: stub.port, timeoutMs: 1000,
    optionsWaitMs: 250, optionsPollMs: 100, now: () => clock,
    wait: async ms => { clock += ms; } });
  safe(result);
  assert.equal(result.ok, false);
  assert.equal(result.probeCompleted, true);
  assert.equal(result.reason, 'row_d_preflight_incomplete');
  assert.deepEqual(result.optionsReadiness, { status: 'timed_out', attempts: 1,
    waitRounds: 1, initialUnavailableCount: 1, finalUnavailableCount: 1 });
  assert.deepEqual(result.fields, modeledUnavailableInspection().fields);
  assert.equal(Object.hasOwn(result, 'failure'), false);
  assert.equal(result.visibilityKeeper.focusEmulationCleared, true);
  assert.equal(result.traffic.commandFailed, false);
  assert.deepEqual(result.traffic.keeperAssessment, { status: 'no_non_get', reasons: [] });
  assert.equal(stub.calls.filter(call => call.method === 'Runtime.evaluate').length, 1);
  assert.deepEqual(stub.calls.slice(-3).map(call => call.method), [
    'Emulation.setFocusEmulationEnabled', 'Fetch.disable', 'Network.disable'
  ]);
});

test('actual loopback missing readiness reply preserves cleanup and the latest incomplete snapshot', async t => {
  const stub = await cdpStub(t, { evaluationGet: false, inspection: modeledUnavailableInspection(),
    omitEvaluationReplyAt: 2 });
  const started = performance.now();
  const result = await runCmsRowDLive({ port: stub.port, timeoutMs: 1000,
    optionsWaitMs: 75, optionsPollMs: 25, wait: async () => {} });
  const elapsed = performance.now() - started;
  safe(result);
  assert.equal(result.ok, false);
  assert.equal(result.probeCompleted, true);
  assert.equal(result.reason, 'inspection_failed');
  assert.equal(result.optionsReadiness.status, 'inspection_failed');
  assert.equal(result.optionsReadiness.attempts, 2);
  assert.equal(result.optionsReadiness.initialUnavailableCount, 1);
  assert.equal(result.optionsReadiness.finalUnavailableCount, 1);
  assert.deepEqual(result.fields, modeledUnavailableInspection().fields);
  assert.equal(result.traffic.commandFailed, false);
  assert.deepEqual(result.traffic.keeperAssessment, { status: 'no_non_get', reasons: [] });
  assert.equal(result.visibilityKeeper.focusEmulationCleared, true);
  assert.ok(elapsed < 750, `remaining host timeout must bound the omitted reply, took ${elapsed} ms`);
  const evaluations = stub.calls.filter(call => call.method === 'Runtime.evaluate');
  assert.equal(evaluations.length, 2);
  assert.ok(evaluations.every(call => call.params.throwOnSideEffect === true));
  assert.ok(evaluations[1].params.timeout <= 75);
  assert.deepEqual(stub.calls.slice(-3).map(call => call.method), [
    'Emulation.setFocusEmulationEnabled', 'Fetch.disable', 'Network.disable'
  ]);
  assert.deepEqual(stub.calls.at(-3).params, { enabled: false });
});

// These timings model an omitted synchronous evaluation reply and an abort
// whose ACK arrives after that read has timed out. They are offline transport
// scheduling only, not a new CMS observation or DOM capture.
async function inspectionTimeoutStub(t, { lateReply = false, blockFails = false } = {}) {
  const calls = [];
  const trace = [];
  const timers = new Set();
  let evaluations = 0;
  let blockAcknowledged = false;
  let timedOutEvaluation;
  const server = http.createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify([{ type: 'page', id: 'timeout-tab', url: ROW_D_PAGE,
      webSocketDebuggerUrl: `ws://127.0.0.1:${server.address().port}/devtools/page/timeout-tab` }]));
  });
  const wss = new WebSocketServer({ server });
  wss.on('connection', socket => {
    const send = message => socket.send(JSON.stringify(message));
    socket.on('message', raw => {
      const message = JSON.parse(String(raw));
      calls.push(message);
      const reply = result => send({ id: message.id, result });
      if (message.method === 'Runtime.evaluate') {
        evaluations += 1;
        assert.equal(message.params.throwOnSideEffect, true);
        assert.equal(message.params.awaitPromise, false);
        assert.equal(message.params.userGesture, false);
        if (evaluations === 1) {
          reply({ result: { value: modeledUnavailableInspection() } });
          return;
        }
        assert.equal(evaluations, 2, 'a timed out sample must not dispatch another read');
        trace.push('omitted_evaluation');
        timedOutEvaluation = message;
        const request = { method: 'POST', url: `${autosaveUrl}?private=${PRIVATE}` };
        send({ method: 'Network.requestWillBeSent', params: { requestId: 'timeout-network', request } });
        send({ method: 'Fetch.requestPaused', params: {
          requestId: 'timeout-fetch', networkId: 'timeout-network', request
        } });
        return;
      }
      if (message.method === 'Fetch.failRequest') {
        assert.deepEqual(message.params, { requestId: 'timeout-fetch', errorReason: 'BlockedByClient' });
        trace.push('abort_pending');
        const timer = setTimeout(() => {
          timers.delete(timer);
          if (socket.readyState !== 1) return;
          trace.push(blockFails ? 'abort_rejected' : 'abort_acknowledged');
          blockAcknowledged = !blockFails;
          if (blockFails) send({ id: message.id, error: { message: PRIVATE } });
          else reply({});
          if (lateReply) {
            trace.push('late_evaluation_reply');
            send({ id: timedOutEvaluation.id, result: { result: { value: liveShape.inspection } } });
          }
        }, timedOutEvaluation.params.timeout + 40);
        timers.add(timer);
        return;
      }
      if (message.method === 'Emulation.setFocusEmulationEnabled' && !message.params.enabled) {
        trace.push('focus_reset');
        assert.equal(blockAcknowledged, !blockFails, 'cleanup waits for the outstanding abort result');
      }
      if (['Fetch.disable', 'Network.disable'].includes(message.method)) trace.push(message.method);
      reply({});
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    for (const timer of timers) clearTimeout(timer);
    for (const socket of wss.clients) socket.terminate();
    await new Promise(resolve => wss.close(resolve));
    await new Promise(resolve => server.close(resolve));
  });
  return { calls, trace, port: server.address().port };
}

for (const lateReply of [false, true]) {
  test(`actual loopback read timeout lets a pending non-GET block settle during cleanup (late reply=${lateReply})`, async t => {
    const stub = await inspectionTimeoutStub(t, { lateReply });
    const result = await runCmsRowDLive({ port: stub.port, timeoutMs: 1000,
      optionsWaitMs: 75, optionsPollMs: 25, wait: async () => {} });
    safe(result);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'inspection_failed');
    assert.equal(result.probeCompleted, true);
    assert.deepEqual(result.fields, modeledUnavailableInspection().fields);
    assert.deepEqual(result.optionsReadiness, { status: 'inspection_failed', attempts: 2,
      waitRounds: 1, initialUnavailableCount: 1, finalUnavailableCount: 1 });
    assert.equal(result.visibilityKeeper.focusEmulationCleared, true);
    assert.equal(result.traffic.commandFailed, false);
    assert.equal(result.traffic.observedNonGetCount, 1);
    assert.equal(result.traffic.interceptedNonGetCount, 1);
    assert.equal(result.traffic.blockedNonGetCount, 1);
    assert.equal(result.traffic.responseToNonGetCount, 0);
    assert.deepEqual(result.traffic.keeperAssessment, { status: 'correlated_keeper_blocks', reasons: [] });
    assert.ok(stub.trace.indexOf('abort_pending') < stub.trace.indexOf('abort_acknowledged'));
    assert.ok(stub.trace.indexOf('abort_acknowledged') < stub.trace.indexOf('focus_reset'));
    assert.deepEqual(stub.trace.slice(-3), ['focus_reset', 'Fetch.disable', 'Network.disable']);
    if (lateReply) assert.ok(stub.trace.indexOf('late_evaluation_reply') < stub.trace.indexOf('focus_reset'));
    assert.equal(stub.calls.filter(call => call.method === 'Runtime.evaluate').length, 2);
    assert.equal(stub.calls.some(call => call.method === 'Fetch.continueRequest'), false);
    assert.doesNotMatch(JSON.stringify(result), /timeout-network|timeout-fetch|private=/);
  });
}

test('actual loopback read timeout cannot hide a pending non-GET block rejection', async t => {
  const stub = await inspectionTimeoutStub(t, { blockFails: true, lateReply: true });
  const result = await runCmsRowDLive({ port: stub.port, timeoutMs: 1000,
    optionsWaitMs: 75, optionsPollMs: 25, wait: async () => {} });
  safe(result);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'non_get_or_guard_failure');
  assert.equal(result.optionsReadiness.status, 'inspection_failed');
  assert.deepEqual(result.fields, modeledUnavailableInspection().fields);
  assert.equal(result.traffic.commandFailed, true);
  assert.equal(result.traffic.blockedNonGetCount, 0);
  assert.equal(result.traffic.responseToNonGetCount, 0);
  assert.ok(result.traffic.keeperAssessment.reasons.includes('guard_command_failed'));
  assert.equal(result.visibilityKeeper.focusEmulationCleared, true);
  assert.ok(stub.trace.indexOf('abort_rejected') < stub.trace.indexOf('focus_reset'));
});

for (const visibilityNonGetAt of ['Target.activateTarget', 'Page.bringToFront', 'Emulation.setFocusEmulationEnabled']) {
  test(`actual CDP transport blocks info/edit during ${visibilityNonGetAt} and preserves inspection`, async t => {
    const stub = await cdpStub(t, { visibilityNonGetAt });
    const result = await runCmsRowDLive({ port: stub.port, timeoutMs: 1000, wait: async () => {} });
    safe(result);
    assert.equal(result.ok, false);
    assert.equal(result.probeCompleted, true);
    assert.equal(result.reason, 'no_document');
    assert.equal(result.fields.length, ROW_D_FIELDS.length);
    assert.equal(result.traffic.observedNonGetCount, 1);
    assert.equal(result.traffic.blockedNonGetCount, 1);
    assert.equal(result.traffic.responseToNonGetCount, 0);
    assert.equal(result.traffic.commandFailed, false);
    const names = stub.calls.map(call => call.method);
    assert.ok(names.indexOf('Fetch.failRequest') < names.indexOf('Runtime.evaluate'));
    assert.ok(names.indexOf('Fetch.failRequest') < names.indexOf('Fetch.disable'));
  });
}

test('actual CDP transport preserves inspection for a correlated info/edit block during evaluation', async t => {
  const stub = await cdpStub(t, { networkCase: 'blocked_info_edit' });
  const result = await runCmsRowDLive({ port: stub.port, timeoutMs: 1000, wait: async () => {} });
  safe(result);
  assert.equal(result.ok, false);
  assert.equal(result.probeCompleted, true);
  assert.equal(result.reason, 'no_document');
  assert.equal(result.fields.length, ROW_D_FIELDS.length);
  assert.equal(result.traffic.observedNonGetCount, 1);
  assert.equal(result.traffic.interceptedNonGetCount, 1);
  assert.equal(result.traffic.blockedNonGetCount, 1);
  assert.equal(result.traffic.responseToNonGetCount, 0);
  assert.equal(result.traffic.commandFailed, false);
});

for (const networkCase of ['response', 'early_response', 'redirect']) {
  test(`actual CDP transport rejects ${networkCase} evidence despite an info/edit block acknowledgement`, async t => {
    const stub = await cdpStub(t, { networkCase });
    const result = await runCmsRowDLive({ port: stub.port, timeoutMs: 1000, wait: async () => {} });
    safe(result);
    assert.equal(result.ok, false);
    assert.equal(result.probeCompleted, true);
    assert.equal(result.reason, 'non_get_or_guard_failure');
    assert.equal(result.fields.length, ROW_D_FIELDS.length);
    assert.equal(result.traffic.observedNonGetCount, 1);
    assert.equal(result.traffic.blockedNonGetCount, 1);
    assert.ok(result.traffic.responseToNonGetCount > 0);
  });
}

for (const networkCase of ['unmatched_observation', 'mismatched_network_id', 'guard_enable', 'late_fetch_disable']) {
  test(`actual CDP transport fails closed for ${networkCase}`, async t => {
    const stub = await cdpStub(t, { networkCase });
    const result = await runCmsRowDLive({ port: stub.port, timeoutMs: 1000, wait: async () => {} });
    safe(result);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'non_get_or_guard_failure');
    assert.equal(result.probeCompleted, networkCase !== 'guard_enable');
    assert.equal(result.traffic.observedNonGetCount, 1);
    assert.equal(result.traffic.blockedNonGetCount, networkCase === 'unmatched_observation' ? 0 : 1);
    assert.equal(result.traffic.responseToNonGetCount, 0);
    const names = stub.calls.map(call => call.method);
    if (networkCase === 'guard_enable') assert.equal(names.includes('Runtime.evaluate'), false);
    if (networkCase === 'late_fetch_disable') {
      assert.ok(names.indexOf('Fetch.disable') < names.indexOf('Fetch.failRequest'));
      assert.ok(names.indexOf('Fetch.failRequest') < names.indexOf('Network.disable'));
    }
  });
}

test('actual CDP transport block rejection during keeper setup prevents inspection', async t => {
  const stub = await cdpStub(t, { visibilityNonGetAt: 'Target.activateTarget', blockFails: true });
  const result = await runCmsRowDLive({ port: stub.port, timeoutMs: 1000, wait: async () => {} });
  safe(result);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'non_get_or_guard_failure');
  assert.equal(result.probeCompleted, false);
  assert.equal(result.traffic.blockedNonGetCount, 0);
  assert.equal(result.traffic.commandFailed, true);
  assert.equal(stub.calls.some(call => call.method === 'Runtime.evaluate'), false);
});

for (const blockFails of [false, true]) test(`actual CDP transport records info/edit and rejects non-GET (block failure=${blockFails})`, async t => {
  const stub = await cdpStub(t, { nonGet: true, blockFails });
  const result = await runCmsRowDLive({ port: stub.port, timeoutMs: 1000, wait: async () => {} });
  safe(result);
  assert.equal(result.ok, false);
  assert.equal(result.probeCompleted, true);
  assert.equal(result.reason, 'non_get_or_guard_failure');
  assert.equal(result.traffic.observedNonGetCount, 2);
  assert.equal(result.traffic.interceptedNonGetCount, 2);
  assert.equal(result.traffic.infoEditObservedCount, 2);
  assert.equal(result.traffic.blockedNonGetCount, blockFails ? 0 : 2);
  assert.equal(result.traffic.infoEditBlockedCount, blockFails ? 0 : 2);
  assert.equal(result.traffic.commandFailed, blockFails);
  const decisions = stub.calls.filter(call => call.method === 'Fetch.failRequest');
  assert.deepEqual(decisions.map(call => call.params), [
    { requestId: 'paused-POST', errorReason: 'BlockedByClient' },
    { requestId: 'paused-HEAD', errorReason: 'BlockedByClient' }
  ]);
  assert.ok(result.traffic.records.every(record => record.endpoint === '/resume/info/edit'));
});

for (const networkCase of ['blocked_info_edit', 'mismatched_network_id', 'response', 'late_fetch_disable']) {
  test(`loopback models hypothetical 13/16 dictionary result with recorded tenant traffic: ${networkCase}`, async t => {
    const stub = await cdpStub(t, { networkCase, inspection: liveShape.inspection });
    const result = await runCmsRowDLive({ port: stub.port, timeoutMs: 1000, wait: async () => {} });
    safe(result);
    assert.equal(result.probeCompleted, true);
    assert.equal(result.ok, false);
    assert.equal(result.reason, networkCase === 'blocked_info_edit' ? 'row_d_preflight_incomplete' : 'non_get_or_guard_failure');
    assert.deepEqual(result.fields, liveShape.inspection.fields);
    assert.equal(result.fields.filter(row => row.ok).length, 13);
    assert.equal(result.traffic.observedNonGetCount, 1);
    assert.equal(result.traffic.interceptedNonGetCount, 1);
    assert.equal(result.traffic.blockedNonGetCount, 1);
    assert.equal(result.traffic.infoEditObservedCount, 1);
    assert.equal(result.traffic.infoEditBlockedCount, 1);
    assert.equal(result.traffic.commandFailed, false);
    assert.equal(result.traffic.truncated, false);
    if (networkCase === 'blocked_info_edit') {
      const { keeperAssessment, commandFailures, ...redactedTraffic } = result.traffic;
      assert.deepEqual(commandFailures, []);
      assert.deepEqual(redactedTraffic, liveShape.traffic, 'the reported aggregate and phases match the supplied live report');
      assert.deepEqual(keeperAssessment, { status: 'correlated_keeper_blocks', reasons: [] });
    } else {
      const reason = { mismatched_network_id: 'network_fetch_unmatched', response: 'response_evidence',
        late_fetch_disable: 'outside_keeper' }[networkCase];
      assert.equal(result.traffic.keeperAssessment.status, 'rejected');
      assert.ok(result.traffic.keeperAssessment.reasons.includes(reason));
    }
    assert.doesNotMatch(JSON.stringify(result), /network-POST|paused-POST|wecruit\/resume|iSaJAx|request_locale/);
    assert.equal(stub.calls.filter(call => call.method === 'Runtime.evaluate').length, 1);
    assert.equal(stub.calls.find(call => call.method === 'Runtime.evaluate').params.throwOnSideEffect, true);
  });
}

test('loopback rejects stale partial research metadata without rewriting historical evidence', async t => {
  const stub = await cdpStub(t, { inspection: historicalShape.inspection });
  const result = await runCmsRowDLive({ port: stub.port, timeoutMs: 1000, wait: async () => {} });
  safe(result);
  assert.equal(result.probeCompleted, false);
  assert.equal(result.reason, 'inspection_failed');
  assert.deepEqual(result.fields, []);
  assert.equal(historicalShape.inspection.fields.filter(row => row.ok).length, 12);
  assert.equal(historicalShape.inspection.fields.find(row => row.key === 'researchInterests').optionsComplete, false);
});

for (const networkCase of ['r7_missing', 'r7_missing_reverse', 'r7_missing_response',
  'r7_missing_early_response', 'r7_missing_second', 'r7_missing_late']) {
  test(`R7 loopback preserves modeled 12/16 only for a unique blocked missing-ID keeper pair: ${networkCase}`, async t => {
    const stub = await cdpStub(t, { networkCase, inspection: twelveFieldShape.inspection });
    const result = await runCmsRowDLive({ port: stub.port, timeoutMs: 1000, wait: async () => {} });
    safe(result);
    const preserved = ['r7_missing', 'r7_missing_reverse'].includes(networkCase);
    assert.equal(result.reason, preserved ? 'row_d_preflight_incomplete' : 'non_get_or_guard_failure');
    assert.equal(result.ok, false);
    assert.equal(result.probeCompleted, true);
    assert.deepEqual(result.fields, twelveFieldShape.inspection.fields);
    assert.equal(result.fields.filter(row => row.ok).length, 12);
    assert.equal(result.traffic.observedNonGetCount, networkCase === 'r7_missing_second' ? 2 : 1);
    assert.equal(result.traffic.interceptedNonGetCount, networkCase === 'r7_missing_second' ? 2 : 1);
    assert.equal(result.traffic.blockedNonGetCount, networkCase === 'r7_missing_second' ? 2 : 1);
    assert.equal(result.traffic.commandFailed, false);
    if (preserved) {
      const { keeperAssessment, commandFailures, ...traffic } = result.traffic;
      assert.deepEqual(commandFailures, []);
      // The sanitized observed -> paused -> blocked shape carries no raw IDs.
      // Fetch-first naturally records its first two phases in reverse order.
      assert.deepEqual({ ...traffic, records: historicalShape.traffic.records }, historicalShape.traffic);
      assert.deepEqual(traffic.records.map(row => row.phase), networkCase === 'r7_missing_reverse'
        ? ['paused', 'observed', 'blocked'] : ['observed', 'paused', 'blocked']);
      assert.deepEqual(keeperAssessment, { status: 'correlated_keeper_blocks', reasons: [],
        correlationMode: 'unique_identity_missing_fetch_network_id' });
    } else assert.equal(result.traffic.keeperAssessment.status, 'rejected');
    assert.doesNotMatch(JSON.stringify(result), /network-POST|paused-POST|requestId|networkId|wecruit\/resume|iSaJAx|request_locale/);
    const decisions = stub.calls.filter(call => call.method === 'Fetch.failRequest');
    assert.ok(decisions.every(call => call.params.errorReason === 'BlockedByClient'));
    assert.equal(stub.calls.filter(call => call.method === 'Runtime.evaluate').length, 1);
    assert.equal(stub.calls.find(call => call.method === 'Runtime.evaluate').params.throwOnSideEffect, true);
  });
}

test('R7 loopback fallback also preserves the current 13/16 dictionary projection', async t => {
  const stub = await cdpStub(t, { networkCase: 'r7_missing', inspection: liveShape.inspection });
  const result = await runCmsRowDLive({ port: stub.port, timeoutMs: 1000, wait: async () => {} });
  safe(result);
  assert.equal(result.reason, 'row_d_preflight_incomplete');
  assert.equal(result.fields.filter(row => row.ok).length, 13);
  assert.equal(result.traffic.keeperAssessment.correlationMode, 'unique_identity_missing_fetch_network_id');
});

test('R7 loopback missing-ID abort rejection still overrides completed inspection', async t => {
  const stub = await cdpStub(t, { networkCase: 'r7_missing', inspection: twelveFieldShape.inspection, blockFails: true });
  const result = await runCmsRowDLive({ port: stub.port, timeoutMs: 1000, wait: async () => {} });
  safe(result);
  assert.equal(result.probeCompleted, true);
  assert.equal(result.reason, 'non_get_or_guard_failure');
  assert.equal(result.traffic.commandFailed, true);
  assert.equal(result.traffic.blockedNonGetCount, 0);
});

// R8 uses real loopback WebSocket event scheduling, including command replies
// preceding counterpart events. Nothing connects to a browser or live account.
async function keeperSettlementStub(t, mode) {
  const calls = [];
  const trace = [];
  const timers = new Set();
  let networkSeen = false;
  let pauseSeen = false;
  let blockAcked = false;
  let fatalSeen = false;
  const server = http.createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify([{ type: 'page', id: 'settlement-tab', url: ROW_D_PAGE,
      webSocketDebuggerUrl: `ws://127.0.0.1:${server.address().port}/devtools/page/settlement-tab` }]));
  });
  const wss = new WebSocketServer({ server });
  wss.on('connection', socket => {
    const event = (method, params) => socket.send(JSON.stringify({ method, params }));
    const request = { method: 'POST', url: `${autosaveUrl}?synthetic=${PRIVATE}` };
    const network = () => { networkSeen = true; trace.push('network');
      event('Network.requestWillBeSent', { requestId: 'settle-network', request }); };
    const pause = (extra = {}, override = request) => { pauseSeen = true; trace.push('pause');
      event('Fetch.requestPaused', { requestId: 'settle-fetch', networkId: 'settle-network', request: override, ...extra }); };
    const later = (ms, callback) => { const timer = setTimeout(() => {
      timers.delete(timer); if (socket.readyState === 1) callback();
    }, ms); timers.add(timer); };
    socket.on('message', raw => {
      const message = JSON.parse(String(raw));
      calls.push(message);
      const reply = result => socket.send(JSON.stringify({ id: message.id, result }));
      if (message.method === 'Emulation.setFocusEmulationEnabled' && message.params.enabled) {
        if (['fetch_first', 'missing_fetch_first', 'missing_fetch_first_ack_delayed'].includes(mode)) pause({ ...(mode.startsWith('missing_') ? { networkId: undefined } : {}) });
        else network();
        if (['ack_delayed', 'ack_after_deadline', 'missing_ack_delayed'].includes(mode)) pause({ ...(mode.startsWith('missing_') ? { networkId: undefined } : {}) });
        trace.push('keeper_reply');
        reply({});
        if (mode === 'network_first') later(35, () => pause());
        if (mode === 'missing_network_first') later(35, () => pause({ networkId: undefined }));
        if (mode === 'unmatched_id') later(20, () => pause({ networkId: 'unmatched-late-id' }));
        if (mode === 'block_command_failure') later(20, () => pause());
        if (['fetch_first', 'missing_fetch_first', 'missing_fetch_first_ack_delayed'].includes(mode)) later(35, network);
        if (mode === 'response_during_wait') later(20, () => { fatalSeen = true;
          event('Network.responseReceived', { requestId: 'settle-network', response: { status: 200, body: PRIVATE } }); });
        if (mode === 'conflict_during_wait') later(20, () => { fatalSeen = true; pause({}, { ...request, url: request.url + '&conflict=1' }); });
        if (mode === 'duplicate_during_wait') later(20, () => { fatalSeen = true; network(); });
        if (mode === 'invalid_id_during_wait') later(20, () => { fatalSeen = true; pause({ networkId: null }); });
        if (mode === 'redirect_during_wait') later(20, () => { fatalSeen = true; pause({ redirectedRequestId: PRIVATE }); });
        return;
      }
      if (message.method === 'Fetch.failRequest') {
        if (mode === 'block_command_failure') { socket.send(JSON.stringify({ id: message.id, error: { message: PRIVATE } })); return; }
        const acknowledge = () => { blockAcked = true; trace.push('block_ack'); reply({}); };
        if (['ack_delayed', 'missing_ack_delayed', 'missing_fetch_first_ack_delayed'].includes(mode)) later(45, acknowledge);
        else if (mode === 'ack_after_deadline') later(310, acknowledge);
        else acknowledge();
        return;
      }
      if (message.method === 'Emulation.setFocusEmulationEnabled' && !message.params.enabled
        && mode === 'cleanup_pair') pause();
      if (message.method === 'Fetch.disable' && mode === 'teardown_pair') pause();
      if (message.method === 'Runtime.evaluate') {
        trace.push('inspection');
        assert.equal(networkSeen && pauseSeen && blockAcked && !fatalSeen, true,
          'inspection cannot start before complete valid correlation and block ACK');
        assert.equal(message.params.throwOnSideEffect, true);
        reply({ result: { value: liveShape.inspection } });
      } else reply({});
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    for (const timer of timers) clearTimeout(timer);
    for (const socket of wss.clients) socket.terminate();
    await new Promise(resolve => wss.close(resolve));
    await new Promise(resolve => server.close(resolve));
  });
  return { calls, trace, port: server.address().port };
}

for (const mode of ['network_first', 'fetch_first', 'ack_delayed']) {
  test(`R8 loopback settles keeper reply before delayed ${mode} evidence and only then inspects`, async t => {
    const stub = await keeperSettlementStub(t, mode);
    const result = await runCmsRowDLive({ port: stub.port, timeoutMs: 1000, wait: async () => {} });
    safe(result);
    assert.equal(result.reason, 'row_d_preflight_incomplete');
    assert.equal(result.probeCompleted, true);
    assert.equal(result.fields.filter(row => row.ok).length, 13);
    assert.equal(result.inspectionGate.status, 'allowed');
    const check = result.inspectionGate.checkpoints.find(row => row.checkpoint === 'focus_emulation');
    assert.equal(check.status, 'settled');
    assert.ok(check.pendingAtStart.includes({ network_first: 'fetch_pause_missing', fetch_first: 'network_observation_missing', ack_delayed: 'block_ack_pending' }[mode]));
    assert.equal(check.initial.status, 'rejected');
    assert.equal(check.final.status, 'correlated_keeper_blocks');
    assert.equal(result.traffic.responseToNonGetCount, 0);
    assert.ok(stub.trace.indexOf('keeper_reply') < stub.trace.indexOf(mode === 'network_first' ? 'pause' : mode === 'fetch_first' ? 'network' : 'block_ack'));
    assert.ok(stub.trace.indexOf('block_ack') < stub.trace.indexOf('inspection'));
    assert.doesNotMatch(JSON.stringify(result), /settle-network|settle-fetch|synthetic=|conflict=|wecruit\/resume/);
  });
}

for (const mode of ['missing_network_first', 'missing_fetch_first', 'missing_ack_delayed', 'missing_fetch_first_ack_delayed']) {
  test(`R7 loopback settles missing-ID ${mode} before inspection and preserves through teardown`, async t => {
    const stub = await keeperSettlementStub(t, mode);
    const result = await runCmsRowDLive({ port: stub.port, timeoutMs: 1000, wait: async () => {} });
    safe(result);
    assert.equal(result.reason, 'row_d_preflight_incomplete');
    assert.equal(result.probeCompleted, true);
    assert.equal(result.fields.filter(row => row.ok).length, 13);
    assert.equal(result.inspectionGate.status, 'allowed');
    const check = result.inspectionGate.checkpoints.find(row => row.checkpoint === 'focus_emulation');
    assert.equal(check.status, 'settled');
    assert.equal(check.ready, true);
    assert.equal(result.traffic.keeperAssessment.correlationMode, 'unique_identity_missing_fetch_network_id');
    assert.equal(result.traffic.responseToNonGetCount, 0);
    assert.ok(stub.trace.indexOf('block_ack') < stub.trace.indexOf('inspection'));
    assert.ok(stub.trace.indexOf('network') < stub.trace.indexOf('inspection'));
    assert.ok(stub.trace.indexOf('pause') < stub.trace.indexOf('inspection'));
    assert.doesNotMatch(JSON.stringify(result), /settle-network|settle-fetch|requestId|networkId|synthetic=|wecruit\/resume/);
  });
}

for (const mode of ['never_paired', 'unmatched_id', 'cleanup_pair', 'teardown_pair', 'ack_after_deadline', 'block_command_failure',
  'response_during_wait', 'conflict_during_wait', 'duplicate_during_wait', 'invalid_id_during_wait', 'redirect_during_wait']) {
  test(`R8 loopback rejects ${mode} without inspection, including later cleanup success`, async t => {
    const stub = await keeperSettlementStub(t, mode);
    const result = await runCmsRowDLive({ port: stub.port, timeoutMs: 1000, wait: async () => {} });
    safe(result);
    assert.equal(result.reason, 'non_get_or_guard_failure');
    assert.equal(result.probeCompleted, false);
    assert.deepEqual(result.fields, []);
    assert.equal(result.inspectionGate.status, 'blocked');
    assert.equal(result.inspectionGate.blockedAt, 'focus_emulation');
    assert.equal(stub.calls.some(call => call.method === 'Runtime.evaluate'), false);
    const check = result.inspectionGate.checkpoints.at(-1);
    const permanent = mode.endsWith('_during_wait') || mode === 'block_command_failure';
    assert.equal(check.status, permanent ? 'permanent_failure' : 'deadline_exceeded');
    assert.ok(check.waitRounds <= 10);
    assert.ok(check.eventWakes <= 200);
    if (['cleanup_pair', 'ack_after_deadline'].includes(mode)) {
      assert.equal(result.traffic.keeperAssessment.status, 'correlated_keeper_blocks');
      assert.deepEqual(result.traffic.keeperAssessment.reasons, []);
      assert.equal(result.traffic.blockedNonGetCount, 1);
      assert.equal(result.traffic.responseToNonGetCount, 0);
      assert.equal(result.traffic.commandFailed, false);
    }
    if (mode === 'teardown_pair') assert.ok(result.traffic.keeperAssessment.reasons.includes('outside_keeper'));
    assert.doesNotMatch(JSON.stringify(result), /settle-network|settle-fetch|synthetic=|conflict=|wecruit\/resume/);
  });
}
