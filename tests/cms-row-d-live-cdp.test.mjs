/** Offline HTTP/WebSocket CDP stub only. No browser, account, or live page. */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import vm from 'node:vm';
import { WebSocketServer } from 'ws';
import { ROW_D_PAGE, ROW_D_FIELDS } from '../scripts/lib/cms-row-d-options.mjs';
import { runCmsRowDLive } from '../scripts/live/cms-row-d-live.mjs';

const PRIVATE = 'OFFLINE_PRIVATE_BODY_QUERY_ERROR_SENTINEL';

async function cdpStub(t, { nonGet = false, blockFails = false } = {}) {
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
    socket.on('message', raw => {
      const message = JSON.parse(String(raw));
      calls.push(message);
      const reply = result => socket.send(JSON.stringify({ id: message.id, result }));
      const event = (method, params) => socket.send(JSON.stringify({ method, params }));
      if (message.method === 'Runtime.evaluate') {
        const names = calls.map(call => call.method);
        assert.ok(names.indexOf('Network.enable') < names.indexOf('Runtime.evaluate'));
        assert.ok(names.indexOf('Fetch.enable') < names.indexOf('Runtime.evaluate'));
        assert.equal(message.params.throwOnSideEffect, true);
        assert.equal(message.params.userGesture, false);
        assert.equal(message.params.awaitPromise, false);
        const methods = nonGet ? ['GET', 'POST', 'HEAD'] : ['GET'];
        for (const method of methods) {
          const request = { method, url: `https://wecruit.hotjob.cn/resume/info/edit?resumeId=${PRIVATE}`,
            postData: PRIVATE, headers: { 'X-Private': PRIVATE } };
          event('Network.requestWillBeSent', { requestId: `network-${method}`, request });
          event('Fetch.requestPaused', { requestId: `paused-${method}`, networkId: `network-${method}`, request });
        }
        // Executes the real serialized inspector in an empty synthetic realm;
        // no_document is expected and must never become a live PASS.
        reply({ result: { value: vm.runInNewContext(message.params.expression) } });
      } else if (message.method === 'Fetch.failRequest' && blockFails) {
        socket.send(JSON.stringify({ id: message.id, error: { message: PRIVATE } }));
      } else reply({});
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
    assert.equal(row.writeStarted, false);
    assert.equal(row.mutationAllowed, false);
    assert.equal(row.valuesExposed, false);
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
