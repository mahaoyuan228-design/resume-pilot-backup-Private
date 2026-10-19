/**
 * Auto-page ↔ service worker contract:
 * - happy path posts the worker payload to reportPort
 * - a silent worker becomes BG_NO_RESPONSE instead of hanging
 * - BG_PING is registered from the worker's first import and does not swallow *_AUTO
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  BG_ACK_TIMEOUT_MS,
  BG_RESPONSE_TIMEOUT_MS,
  requestBackground
} from '../src/auto/bg-request.mjs';
import { installBgPing } from '../src/background/bg-ping.mjs';
import { installGthBasicAutoRunner } from '../src/background/gth-basic-auto.mjs';
import { installCmsBasicAutoRunner } from '../src/background/cms-basic-auto.mjs';

const root = resolve(import.meta.dirname, '..');

function makePort() {
  const messageListeners = [];
  const disconnectListeners = [];
  return {
    onMessage: { addListener(fn) { messageListeners.push(fn); } },
    onDisconnect: { addListener(fn) { disconnectListeners.push(fn); } },
    postMessage(payload) { for (const fn of messageListeners) fn(payload); },
    disconnect() { for (const fn of disconnectListeners) fn(); }
  };
}

function makeRuntime({ wake = 'ok', ping = 'pong', auto = 'ok', autoBody = null } = {}) {
  const messages = [];
  const runtime = {
    messages,
    lastError: null,
    connect() {
      const port = makePort();
      if (wake === 'ok') queueMicrotask(() => port.postMessage({ ok: true, type: 'BG_WAKE' }));
      return port;
    },
    sendMessage(message, callback) {
      messages.push(message);
      if (message.type === 'BG_PING') {
        if (ping === 'hang') return;
        if (ping === 'error') {
          runtime.lastError = { message: 'Could not establish connection. Receiving end does not exist.' };
          callback(undefined);
          runtime.lastError = null;
          return;
        }
        runtime.lastError = null;
        callback(ping === 'missing' ? undefined : { ok: true, reason: 'BG_PONG', at: 1 });
        return;
      }
      if (auto === 'hang') return;
      runtime.lastError = null;
      callback(auto === 'missing' ? undefined : autoBody);
    }
  };
  return runtime;
}

async function postReport(payload, fetchImpl) {
  const response = await fetchImpl('http://127.0.0.1:9/result', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return { posted: response.ok, status: response.status, body: JSON.parse(response.body) };
}

test('ack and response budgets stay under the paid runner cap', () => {
  assert.equal(BG_ACK_TIMEOUT_MS, 15000);
  assert.equal(BG_RESPONSE_TIMEOUT_MS, 160000);
  assert.equal(BG_ACK_TIMEOUT_MS + BG_RESPONSE_TIMEOUT_MS < 180000, true);
});

test('happy path report is the service worker payload', async () => {
  const sw = {
    ok: true,
    mode: 'fill',
    kind: 'gth_basic_auto',
    writeAttempted: false,
    saveAttempted: false
  };
  const runtime = makeRuntime({ autoBody: sw });
  const result = await requestBackground(
    { type: 'GTH_BASIC_AUTO', mode: 'fill' },
    { runtime, ackTimeoutMs: 500, responseTimeoutMs: 500 }
  );
  assert.deepEqual(runtime.messages.map((message) => message.type), ['BG_PING', 'GTH_BASIC_AUTO']);
  const posted = await postReport(result, async (_url, init) => ({ ok: true, status: 200, body: init.body }));
  assert.equal(posted.posted, true);
  assert.equal(posted.body.ok, true);
  assert.equal(posted.body.kind, 'gth_basic_auto');
  assert.equal(posted.body.mode, 'fill');
  assert.equal(posted.body.writeAttempted, false);
  assert.equal(posted.body.saveAttempted, false);
  assert.equal(posted.body.reason, undefined);
});

test('CMS_BASIC_AUTO happy path report is posted unchanged', async () => {
  const sw = {
    ok: true,
    mode: 'readiness',
    kind: 'cms_basic_auto',
    writeAttempted: false,
    saveAttempted: false
  };
  const runtime = makeRuntime({ autoBody: sw });
  const result = await requestBackground(
    { type: 'CMS_BASIC_AUTO', mode: 'readiness' },
    { runtime, ackTimeoutMs: 500, responseTimeoutMs: 500 }
  );
  const posted = await postReport(result, async (_url, init) => ({ ok: true, status: 200, body: init.body }));
  assert.equal(posted.body.kind, 'cms_basic_auto');
  assert.equal(posted.body.ok, true);
  assert.equal(posted.body.writeAttempted, false);
});

test('silent worker posts BG_NO_RESPONSE and does not start the auto job', async () => {
  const runtime = makeRuntime({ wake: 'hang', ping: 'hang' });
  const started = Date.now();
  const result = await requestBackground(
    { type: 'GTH_BASIC_AUTO', mode: 'fill' },
    { runtime, ackTimeoutMs: 80, wakeTimeoutMs: 80 }
  );
  const elapsed = Date.now() - started;
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'BG_NO_RESPONSE');
  assert.equal(result.phase, 'ack');
  assert.equal(result.helpNeeded, false);
  assert.equal(result.messageType, 'GTH_BASIC_AUTO');
  assert.equal(result.mode, 'fill');
  assert.equal(result.writeAttempted, false);
  assert.equal(result.saveAttempted, false);
  assert.equal(result.writeUnconfirmed, undefined);
  assert.equal(result.timeoutMs, 80);
  assert.equal(runtime.messages.some((message) => message.type === 'GTH_BASIC_AUTO'), false);
  assert.equal(elapsed < 1500, true);
  const posted = await postReport(result, async (_url, init) => ({ ok: true, status: 200, body: init.body }));
  assert.equal(posted.body.reason, 'BG_NO_RESPONSE');
  assert.equal(posted.body.writeAttempted, false);
});

test('ping connection error is BG_NO_RESPONSE before the auto message', async () => {
  const runtime = makeRuntime({ ping: 'error' });
  const result = await requestBackground(
    { type: 'CMS_BASIC_AUTO', mode: 'fill' },
    { runtime, ackTimeoutMs: 500, responseTimeoutMs: 500 }
  );
  assert.equal(result.reason, 'BG_NO_RESPONSE');
  assert.equal(result.phase, 'ack');
  assert.match(result.error, /Receiving end does not exist/);
  assert.deepEqual(runtime.messages.map((message) => message.type), ['BG_PING']);
});

test('worker that ignores BG_PING still delivers the auto report', async () => {
  const sw = { ok: true, mode: 'fill', kind: 'cms_basic_auto', writeAttempted: false, saveAttempted: false };
  const runtime = makeRuntime({ ping: 'missing', autoBody: sw });
  const result = await requestBackground(
    { type: 'CMS_BASIC_AUTO', mode: 'fill' },
    { runtime, ackTimeoutMs: 500, responseTimeoutMs: 500 }
  );
  assert.deepEqual(result, sw);
  assert.deepEqual(runtime.messages.map((message) => message.type), ['BG_PING', 'CMS_BASIC_AUTO']);
});

test('accepted auto message with no sendResponse posts phase response', async () => {
  const runtime = makeRuntime({ auto: 'hang' });
  const result = await requestBackground(
    { type: 'CMS_BASIC_AUTO', mode: 'fill' },
    { runtime, ackTimeoutMs: 500, responseTimeoutMs: 50 }
  );
  assert.equal(result.reason, 'BG_NO_RESPONSE');
  assert.equal(result.phase, 'response');
  assert.equal(result.writeAttempted, false);
  assert.equal(result.writeUnconfirmed, true);
  assert.equal(result.saveAttempted, false);
  assert.equal(result.ping, true);
  assert.deepEqual(runtime.messages.map((message) => message.type), ['BG_PING', 'CMS_BASIC_AUTO']);
});

test('missing auto listener still resolves so the page can report reload', async () => {
  const runtime = makeRuntime({ auto: 'missing' });
  const result = await requestBackground(
    { type: 'GTH_BASIC_AUTO', mode: 'readiness' },
    { runtime, ackTimeoutMs: 500, responseTimeoutMs: 500 }
  );
  assert.equal(result, undefined);
});

test('bgAckTimeoutMs query overrides the ack budget', async () => {
  const previous = globalThis.location;
  globalThis.location = { search: '?bgAckTimeoutMs=120' };
  try {
    const runtime = makeRuntime({ wake: 'ok', ping: 'hang' });
    const result = await requestBackground({ type: 'CMS_BASIC_AUTO', mode: 'fill' }, { runtime, wakeTimeoutMs: 10 });
    assert.equal(result.reason, 'BG_NO_RESPONSE');
    assert.equal(result.phase, 'ack');
    assert.equal(result.timeoutMs, 120);
  } finally {
    if (previous === undefined) delete globalThis.location;
    else globalThis.location = previous;
  }
});

test('SW registers BG_PING at top level and answers without swallowing auto messages', async () => {
  const messageListeners = [];
  const connectListeners = [];
  const api = {
    runtime: {
      id: 'ext',
      getURL: (path) => `chrome-extension://ext/${path}`,
      getManifest: () => ({ background: { service_worker: 'src/background/worker.mjs' } }),
      onMessage: { addListener(fn) { messageListeners.push(fn); } },
      onConnect: { addListener(fn) { connectListeners.push(fn); } }
    },
    storage: { local: { get: async () => ({}), set: async () => {}, remove: async () => {} } },
    tabs: {
      query: async () => [],
      get: async () => ({ id: 1 }),
      create: async () => ({ id: 1, url: 'about:blank' }),
      update: async () => ({ id: 1 })
    },
    windows: { update: async () => ({}) },
    scripting: { executeScript: async () => [] }
  };
  const ping = installBgPing(api);
  const again = installBgPing(api);
  installGthBasicAutoRunner({ api });
  installCmsBasicAutoRunner({ api });
  assert.equal(ping.installed, true);
  assert.equal(again.duplicate, true);
  assert.equal(messageListeners.length, 3);
  assert.equal(connectListeners.length, 1);

  let pong;
  assert.equal(messageListeners[0]({ type: 'BG_PING' }, { id: 'ext' }, (value) => { pong = value; }), false);
  assert.equal(pong.ok, true);
  assert.equal(pong.reason, 'BG_PONG');

  let swallowed = false;
  assert.equal(messageListeners[0]({ type: 'GTH_BASIC_AUTO' }, { id: 'ext' }, () => { swallowed = true; }), false);
  assert.equal(swallowed, false);
  assert.equal(messageListeners[0]({ type: 'CMS_BASIC_AUTO' }, { id: 'ext' }, () => { swallowed = true; }), false);
  assert.equal(swallowed, false);

  const sent = [];
  connectListeners[0]({
    name: 'bg-wake',
    postMessage(payload) { sent.push(payload); },
    disconnect() { sent.push('disconnected'); }
  });
  assert.equal(sent[0].type, 'BG_WAKE');
  assert.equal(sent[0].ok, true);
  assert.equal(sent[1], 'disconnected');
  connectListeners[0]({ name: 'other', postMessage() { throw new Error('unexpected'); }, disconnect() { throw new Error('unexpected'); } });

  const gth = await new Promise((resolve) => {
    const handled = messageListeners[1](
      { type: 'GTH_BASIC_AUTO', mode: 'readiness', openIfMissing: false },
      { id: 'ext', url: 'chrome-extension://ext/src/auto/gth-basic-auto.html' },
      resolve
    );
    assert.equal(handled, true);
  });
  assert.equal(gth.ok, false);
  assert.equal(typeof gth.reason, 'string');

  const cms = await new Promise((resolve) => {
    const handled = messageListeners[2](
      { type: 'CMS_BASIC_AUTO', mode: 'readiness', openIfMissing: false },
      { id: 'ext', url: 'chrome-extension://ext/src/auto/cms-basic-auto.html' },
      resolve
    );
    assert.equal(handled, true);
  });
  assert.equal(cms.ok, false);
  assert.equal(typeof cms.reason, 'string');

  const worker = await readFile(resolve(root, 'src/background/worker.mjs'), 'utf8');
  const imports = [...worker.matchAll(/^import\s.+/gm)].map((match) => match[0]);
  assert.match(imports[0], /['"]\.\/bg-ping\.mjs['"]/);
  assert.match(worker, /boot\('gth-basic-auto',\s*installGthBasicAutoRunner\)/);
  assert.match(worker, /boot\('cms-basic-auto',\s*installCmsBasicAutoRunner\)/);
});

test('dispatch through the registered BG_PING listener then the auto report', async () => {
  const messageListeners = [];
  const connectListeners = [];
  const messages = [];
  const runtime = {
    messages,
    lastError: null,
    onMessage: { addListener(fn) { messageListeners.push(fn); } },
    onConnect: { addListener(fn) { connectListeners.push(fn); } },
    connect(info) {
      const port = makePort();
      queueMicrotask(() => {
        for (const listener of connectListeners) listener(Object.assign(port, { name: info?.name }));
      });
      return port;
    },
    sendMessage(message, callback) {
      messages.push(message);
      queueMicrotask(() => {
        let answered = false;
        const sendResponse = (response) => {
          if (answered) return;
          answered = true;
          runtime.lastError = null;
          callback(response);
        };
        for (const listener of messageListeners) {
          const handled = listener(message, { id: 'ext' }, sendResponse);
          if (answered || handled === true) return;
        }
        runtime.lastError = null;
        callback(undefined);
      });
    }
  };
  installBgPing({ runtime });
  runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'CMS_BASIC_AUTO') return false;
    sendResponse({ ok: true, mode: 'fill', kind: 'cms_basic_auto', writeAttempted: false, saveAttempted: false });
    return false;
  });
  const result = await requestBackground(
    { type: 'CMS_BASIC_AUTO', mode: 'fill' },
    { runtime, ackTimeoutMs: 500, responseTimeoutMs: 500 }
  );
  const posted = await postReport(result, async (_url, init) => ({ ok: true, status: 200, body: init.body }));
  assert.equal(posted.body.ok, true);
  assert.equal(posted.body.kind, 'cms_basic_auto');
  assert.equal(posted.body.writeAttempted, false);
  assert.deepEqual(messages.map((message) => message.type), ['BG_PING', 'CMS_BASIC_AUTO']);
});

test('auto pages use the timeout helper and the note stays short', async () => {
  const pages = [
    'cms-basic-auto.js',
    'gth-basic-auto.js',
    'gth-education-auto.js',
    'gth-intent-auto.js',
    'gth-other-auto.js',
    'gth-simple-auto.js',
    'cms-education-auto.js',
    'beisen-2022-basic-auto.js',
    'feishu-atsx-basic-auto.js',
    'hotjob-mc-basic-auto.js',
    'moka-basic-auto.js'
  ];
  for (const name of pages) {
    const source = await readFile(resolve(root, 'src/auto', name), 'utf8');
    assert.match(source, /requestBackground\(/);
    assert.doesNotMatch(source, /chrome\.runtime\.sendMessage/);
    assert.match(source, /postReport\(/);
  }
  const doc = await readFile(resolve(root, 'docs/bg-auto-messaging.md'), 'utf8');
  const lines = doc.trimEnd().split('\n');
  assert.equal(lines.length <= 15, true);
  assert.match(doc, /BG_NO_RESPONSE/);
  assert.match(doc, /BG_PING/);
  assert.match(doc, /15s/);
});
