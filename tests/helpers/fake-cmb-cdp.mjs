// Browser/auto-page transport stand-in, with no CMB recruitment DOM.
import http from 'node:http';
import vm from 'node:vm';
import { WebSocketServer } from 'ws';

export const CMB_TEST_EXT_ID = 'a'.repeat(32);
export const CMB_TEST_AUTO_PATH = '/src/auto/cmb-basic-auto.html';

export async function startFakeCmbCdp({
  existing = true, result = null, hangMethod = null, hangHttp = null,
  stale = false, noResult = false, noExtension = false, ambiguous = false,
  evaluateError = false, hiddenCreatedTarget = false, contextFailures = 0
} = {}) {
  const calls = [];
  let port;
  let autoUrl = `chrome-extension://${CMB_TEST_EXT_ID}${CMB_TEST_AUTO_PATH}?runId=old`;
  let created = false;
  const page = () => ({
    id: 'auto1', type: 'page', url: autoUrl,
    webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/page/auto1`
  });
  const targets = () => [
    ...(!noExtension ? [{ id: 'worker1', type: 'service_worker', url: `chrome-extension://${CMB_TEST_EXT_ID}/src/background/worker.mjs` }] : []),
    ...(ambiguous ? [{ id: 'worker2', type: 'service_worker', url: `chrome-extension://${'b'.repeat(32)}/src/background/worker.mjs` }] : []),
    ...((existing || (created && !hiddenCreatedTarget)) ? [page()] : [])
  ];
  const server = http.createServer((req, res) => {
    calls.push({ http: req.url });
    if (req.url === hangHttp) return;
    res.setHeader('content-type', 'application/json');
    if (req.url === '/json/list') res.end(JSON.stringify(targets()));
    else if (req.url === '/json/version') res.end(JSON.stringify({ webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/browser/test` }));
    else { res.writeHead(404); res.end('{}'); }
  });
  const wss = new WebSocketServer({ server });
  wss.on('connection', (socket) => socket.on('message', (buffer) => {
    const msg = JSON.parse(String(buffer));
    calls.push(msg);
    if (msg.method === hangMethod) return;
    let reply = {};
    if (msg.method === 'Page.navigate' || msg.method === 'Target.createTarget') {
      autoUrl = msg.params.url;
      if (msg.method === 'Target.createTarget') { created = true; reply.targetId = 'auto1'; }
      else reply.frameId = 'frame1';
    } else if (msg.method === 'Runtime.evaluate') {
      if (contextFailures-- > 0) {
        socket.send(JSON.stringify({ id: msg.id, error: { message: 'Execution context was destroyed.' } }));
        return;
      }
      if (evaluateError) {
        socket.send(JSON.stringify({ id: msg.id, error: { message: 'synthetic cdp failure' } }));
        return;
      }
      const mode = new URL(autoUrl).searchParams.get('mode');
      const terminal = result ?? {
        ok: true, siteId: 'cmb', kind: 'cmb_basic_auto', mode,
        saveAttempted: false, skippedSave: true, liveSupportClaimed: false,
        writeAttempted: mode === 'fill',
        ...(mode === 'fill' ? { job: { state: 'completed', saved: false, softwareClickedSave: false, softwareClickedSubmit: false } } : {})
      };
      // Execute the actual read-only snapshot against an auto-page-shaped stub.
      const value = vm.runInNewContext(msg.params.expression, {
        location: { href: stale ? `chrome-extension://${CMB_TEST_EXT_ID}${CMB_TEST_AUTO_PATH}?runId=old` : autoUrl },
        document: { getElementById: (id) => id === 'out' ? { textContent: JSON.stringify(noResult ? { openIfMissing: false } : terminal) } : null }
      }, { timeout: 100 });
      reply = { result: { type: 'object', value } };
    }
    socket.send(JSON.stringify({ id: msg.id, result: reply }));
  }));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  port = server.address().port;
  return {
    port, calls,
    async close() {
      for (const socket of wss.clients) socket.terminate();
      await new Promise((resolve) => wss.close(resolve));
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  };
}
