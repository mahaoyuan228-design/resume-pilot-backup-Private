// Registered by evaluating this module (worker.mjs imports it first).
// A later install failure must not be required for BG_PING / bg-wake to exist.
const installed = new WeakSet();

export function installBgPing(api = globalThis.chrome) {
  const runtime = api?.runtime;
  if (!runtime?.onMessage?.addListener) return { installed: false };
  if (installed.has(runtime)) return { installed: true, duplicate: true };
  installed.add(runtime);

  const onMessage = (message, _sender, sendResponse) => {
    if (message?.type !== 'BG_PING') return false;
    try {
      sendResponse({ ok: true, reason: 'BG_PONG', at: Date.now(), version: 1 });
    } catch { /* Sender already gone. */ }
    return false;
  };
  runtime.onMessage.addListener(onMessage);

  const onConnect = (port) => {
    if (port?.name !== 'bg-wake') return;
    try { port.postMessage({ ok: true, type: 'BG_WAKE', at: Date.now() }); } catch { /* ignore */ }
    try { port.disconnect(); } catch { /* ignore */ }
  };
  if (runtime.onConnect?.addListener) runtime.onConnect.addListener(onConnect);
  return { installed: true, onMessage, onConnect };
}

if (globalThis.chrome?.runtime?.onMessage?.addListener) installBgPing(globalThis.chrome);
