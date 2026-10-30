/** Actual loopback WebSocket scheduling only; no browser or live page. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocketServer } from 'ws';
import { connectCdp } from '../tools/live-harvest/cdp-client.mjs';
import { StepTimeoutError } from '../tools/live-harvest/errors.mjs';

async function transportStub(t, onMessage) {
  const calls = [];
  const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  wss.on('connection', socket => {
    socket.on('message', raw => {
      const message = JSON.parse(String(raw));
      calls.push(message);
      onMessage(message, reply => socket.send(JSON.stringify(reply)));
    });
  });
  await once(wss, 'listening');
  t.after(async () => {
    for (const socket of wss.clients) socket.terminate();
    await new Promise(resolve => wss.close(resolve));
  });
  return { calls, url: `ws://127.0.0.1:${wss.address().port}` };
}

test('default CDP command timeout still closes the socket and rejects other pending commands', async t => {
  const stub = await transportStub(t, () => {});
  const session = await connectCdp(stub.url, { timeoutMs: 1000 });
  t.after(() => session.close());
  const outstanding = session.send('Fetch.failRequest', { requestId: 'offline-pending' })
    .then(value => ({ value }), error => ({ error }));
  await assert.rejects(session.send('Runtime.evaluate', { awaitPromise: true },
    { timeoutMs: 40, step: 'default_evaluation' }), error => {
    assert.ok(error instanceof StepTimeoutError);
    assert.equal(error.step, 'default_evaluation');
    return true;
  });
  assert.equal((await outstanding).error?.message, 'cdp_socket_closed');
  await assert.rejects(session.send('Network.disable'), /cdp_socket_closed/);
  assert.deepEqual(stub.calls.map(call => call.method), ['Fetch.failRequest', 'Runtime.evaluate']);
});

test('CDP closeOnTimeout=false expires only its command, retains pending abort and events, and ignores its late reply', async t => {
  let pendingAbort;
  let expiredEvaluation;
  const events = [];
  const stub = await transportStub(t, (message, send) => {
    if (message.method === 'Fetch.failRequest') { pendingAbort = message; return; }
    if (message.method === 'Runtime.evaluate') { expiredEvaluation = message; return; }
    if (message.method === 'Emulation.setFocusEmulationEnabled') {
      // Cleanup is dispatched only after the client has rejected the read.
      // Its late reply must not match or settle either outstanding command.
      send({ id: expiredEvaluation.id, result: { lateEvaluation: true } });
      send({ method: 'Network.loadingFailed', params: { requestId: 'offline-network' } });
      send({ id: pendingAbort.id, result: { blocked: true } });
      send({ id: message.id, result: { focusReset: true } });
      return;
    }
    send({ id: message.id, result: { networkDisabled: true } });
  });
  const session = await connectCdp(stub.url, { timeoutMs: 1000, onEvent: event => events.push(event) });
  t.after(() => session.close());
  const outstanding = session.send('Fetch.failRequest', { requestId: 'offline-pending' });
  await assert.rejects(session.send('Runtime.evaluate', { awaitPromise: false, throwOnSideEffect: true },
    { timeoutMs: 40, step: 'strict_inspection', closeOnTimeout: false }), error => {
    assert.ok(error instanceof StepTimeoutError);
    assert.equal(error.step, 'strict_inspection');
    return true;
  });
  assert.deepEqual(await session.send('Emulation.setFocusEmulationEnabled', { enabled: false }), { focusReset: true });
  assert.deepEqual(await outstanding, { blocked: true });
  assert.deepEqual(await session.send('Network.disable'), { networkDisabled: true });
  assert.deepEqual(events, [{ method: 'Network.loadingFailed', params: { requestId: 'offline-network' } }]);
  assert.deepEqual(stub.calls.map(call => call.method), [
    'Fetch.failRequest', 'Runtime.evaluate', 'Emulation.setFocusEmulationEnabled', 'Network.disable'
  ]);
});
