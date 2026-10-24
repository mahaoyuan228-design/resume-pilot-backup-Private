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

const liveShape = JSON.parse(fs.readFileSync(new URL('./fixtures/cms-row-d-keeper-nongget-r6.json', import.meta.url), 'utf8'));

async function cdpStub(t, {
  nonGet = false, blockFails = false, visibilityNonGetAt, networkCase, inspection
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
    socket.on('message', raw => {
      const message = JSON.parse(String(raw));
      calls.push(message);
      const reply = result => socket.send(JSON.stringify({ id: message.id, result }));
      const event = (method, params) => socket.send(JSON.stringify({ method, params }));
      const requestEvents = (method, { pause = true, networkId = `network-${method}` } = {}) => {
        const request = { method, url: `${autosaveUrl}?iSaJAx=isAjax&request_locale=zh_CN&synthetic=${PRIVATE}`,
          postData: PRIVATE, headers: { 'X-Private': PRIVATE } };
        event('Network.requestWillBeSent', { requestId: `network-${method}`, request });
        if (pause) event('Fetch.requestPaused', { requestId: `paused-${method}`, networkId, request });
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
        const names = calls.map(call => call.method);
        assert.ok(names.indexOf('Network.enable') < names.indexOf('Runtime.evaluate'));
        assert.ok(names.indexOf('Fetch.enable') < names.indexOf('Runtime.evaluate'));
        assert.ok(names.indexOf('Target.activateTarget') < names.indexOf('Page.bringToFront'));
        assert.ok(names.indexOf('Page.bringToFront') < names.indexOf('Emulation.setFocusEmulationEnabled'));
        assert.equal(focusEnabled, true);
        assert.equal(message.params.throwOnSideEffect, true);
        assert.equal(message.params.userGesture, false);
        assert.equal(message.params.awaitPromise, false);
        const methods = nonGet ? ['GET', 'POST', 'HEAD'] : ['GET'];
        for (const method of methods) requestEvents(method);
        if (networkCase === 'early_response') event('Network.responseReceived', {
          requestId: 'network-POST', response: { status: 200, body: PRIVATE }
        });
        if (['blocked_info_edit', 'response', 'early_response', 'redirect'].includes(networkCase)) requestEvents('POST');
        if (networkCase === 'unmatched_observation') requestEvents('POST', { pause: false });
        if (networkCase === 'mismatched_network_id') requestEvents('POST', { networkId: 'unmatched-network' });
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
        reply({ result: { value: inspection ?? vm.runInNewContext(message.params.expression) } });
      } else if (message.method === 'Fetch.failRequest' && blockFails) {
        socket.send(JSON.stringify({ id: message.id, error: { message: PRIVATE } }));
      } else {
        if (message.method === 'Fetch.disable') {
          assert.equal(focusEnabled, false);
          if (networkCase === 'late_fetch_disable') requestEvents('POST');
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
  assert.equal(result.booked, 53);
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
  test(`loopback replays recorded 12/16 fields with tenant traffic: ${networkCase}`, async t => {
    const stub = await cdpStub(t, { networkCase, inspection: liveShape.inspection });
    const result = await runCmsRowDLive({ port: stub.port, timeoutMs: 1000, wait: async () => {} });
    safe(result);
    assert.equal(result.probeCompleted, true);
    assert.equal(result.ok, false);
    assert.equal(result.reason, networkCase === 'blocked_info_edit' ? 'row_d_preflight_incomplete' : 'non_get_or_guard_failure');
    assert.deepEqual(result.fields, liveShape.inspection.fields);
    assert.equal(result.fields.filter(row => row.ok).length, 12);
    assert.equal(result.traffic.observedNonGetCount, 1);
    assert.equal(result.traffic.interceptedNonGetCount, 1);
    assert.equal(result.traffic.blockedNonGetCount, 1);
    assert.equal(result.traffic.infoEditObservedCount, 1);
    assert.equal(result.traffic.infoEditBlockedCount, 1);
    assert.equal(result.traffic.commandFailed, false);
    assert.equal(result.traffic.truncated, false);
    if (networkCase === 'blocked_info_edit') {
      const { keeperAssessment, ...redactedTraffic } = result.traffic;
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
