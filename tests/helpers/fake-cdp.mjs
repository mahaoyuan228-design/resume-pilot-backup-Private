/**
 * Loopback CDP stand-in. A chrome.storage Runtime.evaluate is left unanswered
 * so the harvest client must time out on its own.
 */
import http from 'node:http';
import { WebSocketServer } from 'ws';

const PAGE_VALUE = {
  href: 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html',
  title: '简历操作',
  loginHints: false,
  inputCount: 1,
  inputsFilled: 0,
  inputs: [],
  labels: ['姓名'],
  extMarker: { hasChromeRuntime: false },
  storageHints: { local: [], session: [] },
  bodySample: '个人基本信息',
  readiness: 'form_visible_readonly_ok'
};

function defaultTargets(port) {
  return [
    {
      id: 'ext1',
      type: 'page',
      url: 'chrome-extension://synthetic-extension/popup.html',
      webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/page/ext1`
    },
    {
      id: 'cms1',
      type: 'page',
      url: 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html?recruitType=1',
      webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/page/cms1`
    }
  ];
}

export function startFakeCdp({ hangExpression = /chrome\.storage/ } = {}) {
  const targets = [];
  const server = http.createServer((req, res) => {
    if (String(req.url || '').startsWith('/json')) {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(targets));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  const wss = new WebSocketServer({ server });
  wss.on('connection', (socket) => {
    socket.on('message', (buf) => {
      let msg;
      try { msg = JSON.parse(String(buf)); } catch { return; }
      if (msg.id == null) return;
      if (msg.method === 'Runtime.evaluate') {
        const expression = String(msg.params?.expression || '');
        if (hangExpression.test(expression)) return;
        socket.send(JSON.stringify({
          id: msg.id,
          result: { result: { type: 'object', value: PAGE_VALUE } }
        }));
        return;
      }
      socket.send(JSON.stringify({ id: msg.id, result: {} }));
    });
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      targets.push(...defaultTargets(port));
      resolve({
        port,
        async close() {
          for (const client of wss.clients) {
            try { client.terminate(); } catch { /* already gone */ }
          }
          await new Promise((done) => wss.close(() => done()));
          if (server.listening) await new Promise((done) => server.close(() => done()));
        }
      });
    });
  });
}
