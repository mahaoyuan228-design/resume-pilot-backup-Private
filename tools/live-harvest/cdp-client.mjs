/**
 * Loopback CDP client with a hard timeout on every call.
 *
 * The overnight hang: send() resolved only when a CDP id came back, and
 * tryPaidExtensionStorage called Runtime.evaluate with awaitPromise on
 * chrome.storage.local.get. If the extension service worker never ran the
 * callback, Chrome left that evaluation outstanding, the WebSocket stayed
 * open, and Node never exited. On timeout we reject, terminate the socket,
 * and let the caller record { ok:false, reason:'timeout', step }.
 */
import http from 'node:http';
import WebSocket from 'ws';
import { StepTimeoutError } from './errors.mjs';

export function getJson(port, pathname, { timeoutMs, step = 'connect' } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.reject(new StepTimeoutError(step));
  }
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (fn, value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      fn(value);
    };
    const req = http.get({
      host: '127.0.0.1',
      port,
      path: pathname,
      timeout: timeoutMs,
      agent: false
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try { finish(resolve, JSON.parse(body)); }
        catch (err) { finish(reject, err); }
      });
    });
    const timer = setTimeout(() => {
      req.destroy();
      finish(reject, new StepTimeoutError(step));
    }, timeoutMs);
    req.on('timeout', () => req.destroy());
    req.on('error', (err) => finish(reject, err));
  });
}

export function connectCdp(wsUrl, { timeoutMs, step = 'connect' } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.reject(new StepTimeoutError(step));
  }
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { handshakeTimeout: timeoutMs });
    const pending = new Map();
    let nextId = 0;
    let settled = false;
    let closed = false;

    const connectTimer = setTimeout(() => {
      failOpen(new StepTimeoutError(step));
    }, timeoutMs);

    function terminate() {
      if (closed) return;
      closed = true;
      clearTimeout(connectTimer);
      for (const entry of pending.values()) clearTimeout(entry.timer);
      for (const entry of pending.values()) entry.reject(new Error('cdp_socket_closed'));
      pending.clear();
      try { ws.terminate(); } catch { /* socket already gone */ }
    }

    function failOpen(err) {
      if (settled) return;
      settled = true;
      terminate();
      reject(err);
    }

    ws.on('open', () => {
      if (settled) return;
      settled = true;
      clearTimeout(connectTimer);
      resolve(session);
    });

    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(String(data)); } catch { return; }
      if (msg.id == null || !pending.has(msg.id)) return;
      const entry = pending.get(msg.id);
      pending.delete(msg.id);
      clearTimeout(entry.timer);
      if (msg.error) {
        entry.reject(new Error(typeof msg.error === 'string' ? msg.error : JSON.stringify(msg.error)));
      } else {
        entry.resolve(msg.result);
      }
    });

    ws.on('error', (err) => {
      if (!settled) failOpen(err instanceof Error ? err : new Error(String(err)));
    });

    ws.on('close', () => {
      if (!settled) failOpen(new Error('cdp_socket_closed'));
      else terminate();
    });

    const session = {
      send(method, params = {}, options = {}) {
        const callStep = options.step || method;
        const callTimeout = options.timeoutMs ?? timeoutMs;
        if (closed || ws.readyState !== WebSocket.OPEN) {
          return Promise.reject(new Error('cdp_socket_closed'));
        }
        if (!Number.isFinite(callTimeout) || callTimeout <= 0) {
          return Promise.reject(new StepTimeoutError(callStep));
        }
        const id = ++nextId;
        return new Promise((res, rej) => {
          const timer = setTimeout(() => {
            if (!pending.has(id)) return;
            pending.delete(id);
            rej(new StepTimeoutError(callStep));
            terminate();
          }, callTimeout);
          pending.set(id, { resolve: res, reject: rej, timer, step: callStep });
          try {
            ws.send(JSON.stringify({ id, method, params }));
          } catch (err) {
            clearTimeout(timer);
            pending.delete(id);
            rej(err);
          }
        });
      },
      close() {
        terminate();
      }
    };
  });
}
