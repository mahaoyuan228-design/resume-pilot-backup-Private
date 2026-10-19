// Auto-page → service worker call with a wake, a ping, and a hard stop.
// The page used to await chrome.runtime.sendMessage with no deadline. A stopped
// MV3 worker can leave that promise pending, so reportPort never sees /result.
export const BG_ACK_TIMEOUT_MS = 15000;
export const BG_RESPONSE_TIMEOUT_MS = 160000;
export const BG_WAKE_TIMEOUT_MS = 2000;

function boundedInt(value, min, max) {
  const n = Number.parseInt(value, 10);
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : null;
}

function searchParam(name) {
  try {
    const search = globalThis.location?.search;
    if (!search) return null;
    return new URLSearchParams(search).get(name);
  } catch {
    return null;
  }
}

export function bgNoResponse(message, extra = {}) {
  const phase = extra.phase === 'response' ? 'response' : 'ack';
  const payload = {
    ok: false,
    reason: 'BG_NO_RESPONSE',
    helpNeeded: false,
    messageType: message?.type ?? null,
    mode: message?.mode ?? null,
    phase,
    timeoutMs: extra.timeoutMs,
    writeAttempted: false,
    saveAttempted: false,
    at: Date.now(),
    version: 1
  };
  if (phase === 'response') payload.writeUnconfirmed = true;
  if (extra.error) payload.error = String(extra.error);
  if (extra.wake != null) payload.wake = extra.wake === true;
  if (extra.ping != null) payload.ping = extra.ping === true;
  return payload;
}

export function sendRuntimeMessage(runtime, message, timeoutMs) {
  return new Promise((resolve) => {
    if (!runtime || typeof runtime.sendMessage !== 'function' || timeoutMs <= 0) {
      resolve({ timedOut: true, error: timeoutMs <= 0 ? 'timeout' : 'runtime_unavailable' });
      return;
    }
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish({ timedOut: true, error: 'timeout' }), timeoutMs);
    try {
      runtime.sendMessage(message, (response) => {
        let error = null;
        try { error = runtime.lastError?.message || null; } catch (readError) {
          error = String(readError?.message || readError);
        }
        if (error) finish({ timedOut: false, error: String(error) });
        else finish({ timedOut: false, response });
      });
    } catch (error) {
      finish({ timedOut: false, error: String(error?.message || error) });
    }
  });
}

export function wakeServiceWorker(runtime, timeoutMs) {
  return new Promise((resolve) => {
    if (timeoutMs <= 0 || typeof runtime?.connect !== 'function') {
      resolve({ woke: false, reason: timeoutMs <= 0 ? 'no_budget' : 'connect_unavailable' });
      return;
    }
    let settled = false;
    let port = null;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => {
      finish({ woke: false, reason: 'wake_timeout' });
      try { port?.disconnect(); } catch { /* ignore */ }
    }, timeoutMs);
    try {
      port = runtime.connect({ name: 'bg-wake' });
    } catch (error) {
      finish({ woke: false, reason: String(error?.message || error) });
      return;
    }
    if (!port?.onMessage?.addListener) {
      finish({ woke: false, reason: 'port_unavailable' });
      return;
    }
    port.onMessage.addListener(() => {
      finish({ woke: true });
      try { port.disconnect(); } catch { /* ignore */ }
    });
    if (port.onDisconnect?.addListener) {
      port.onDisconnect.addListener(() => finish({ woke: true, disconnected: true }));
    }
  });
}

export async function requestBackground(message, options = {}) {
  const runtime = options.runtime || globalThis.chrome?.runtime;
  const ackTimeoutMs = options.ackTimeoutMs
    ?? boundedInt(searchParam('bgAckTimeoutMs'), 100, 60000)
    ?? BG_ACK_TIMEOUT_MS;
  const responseTimeoutMs = options.responseTimeoutMs
    ?? boundedInt(searchParam('bgResponseTimeoutMs'), 100, 175000)
    ?? BG_RESPONSE_TIMEOUT_MS;
  const started = Date.now();
  const remaining = () => ackTimeoutMs - (Date.now() - started);

  if (!runtime || typeof runtime.sendMessage !== 'function') {
    return bgNoResponse(message, { phase: 'ack', timeoutMs: ackTimeoutMs, error: 'runtime_unavailable', wake: false });
  }

  const wakeBudget = Math.max(0, Math.min(options.wakeTimeoutMs ?? BG_WAKE_TIMEOUT_MS, remaining()));
  const wake = await wakeServiceWorker(runtime, wakeBudget);
  const ackLeft = remaining();
  if (ackLeft <= 0) {
    return bgNoResponse(message, {
      phase: 'ack',
      timeoutMs: ackTimeoutMs,
      error: wake.reason || 'ack_timeout',
      wake: wake.woke === true
    });
  }

  const ping = await sendRuntimeMessage(runtime, { type: 'BG_PING' }, ackLeft);
  if (ping.timedOut || ping.error) {
    return bgNoResponse(message, {
      phase: 'ack',
      timeoutMs: ackTimeoutMs,
      error: ping.error || 'ack_timeout',
      wake: wake.woke === true
    });
  }

  const result = await sendRuntimeMessage(runtime, message, responseTimeoutMs);
  if (result.timedOut || result.error) {
    return bgNoResponse(message, {
      phase: 'response',
      timeoutMs: responseTimeoutMs,
      error: result.error || 'response_timeout',
      wake: true,
      ping: ping.response?.reason === 'BG_PONG'
    });
  }
  return result.response;
}
