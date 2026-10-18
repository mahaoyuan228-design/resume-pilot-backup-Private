// Shared Edge + chrome-extension:// auto-page harness (mirror CMS/CITICS).
// Opens optional target page, optional SW reload, then auto HTML; posts result to local server.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

function stampLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function findEdge() {
  const candidates = [
    process.env.EDGE_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return 'msedge';
}

function openEdge(url) {
  const edge = findEdge();
  const child = spawn(edge, [url], { detached: true, stdio: 'ignore' });
  child.unref();
  return edge;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startServer() {
  const events = [];
  let resolveResult;
  let rejectResult;
  const resultPromise = new Promise((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    const chunks = [];
    if (req.method === 'POST') {
      for await (const chunk of req) chunks.push(chunk);
    }
    let body = {};
    try {
      body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') : {};
    } catch {
      res.writeHead(400);
      res.end('bad json');
      return;
    }
    if (req.method === 'POST' && req.url === '/event') {
      events.push(body);
      console.log(JSON.stringify({ event: 'page_event', ...body }));
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (req.method === 'POST' && req.url === '/result') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      resolveResult({ body, events });
      return;
    }
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, events: events.length }));
      return;
    }
    res.writeHead(404);
    res.end('no');
  });
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port, resultPromise, events, rejectResult });
    });
    server.on('error', reject);
  });
}

/**
 * @param {object} opts
 * @param {string} opts.outDir
 * @param {string} opts.autoHtmlPath e.g. src/auto/feishu-atsx-basic-auto.html
 * @param {string} opts.evidencePrefix e.g. feishu-atsx-basic-auto
 * @param {string} opts.latestName e.g. feishu-atsx-basic-latest.json
 * @param {string} [opts.openPageUrl]
 * @param {string} [opts.targetPage]
 */
export async function runAtsExtensionHarness({
  outDir,
  autoHtmlPath,
  evidencePrefix,
  latestName,
  openPageUrl = null,
  targetPage = null
}) {
  const EXT_ID = process.env.RESUME_EXT_ID || 'hdekmacbpblppkbpamgocbanjafigfej';
  const mode = process.env.MODE || 'readiness';
  const openPage = (process.env.OPEN_TARGET_PAGE || '1') !== '0';
  const openIfMissing = (process.env.OPEN_IF_MISSING || '1') !== '0';
  const timeoutMs = Number.parseInt(process.env.AUTO_TIMEOUT_MS || '180000', 10);
  const skipReload = process.env.SKIP_RELOAD === '1' || process.env.RELOAD === '0';

  fs.mkdirSync(outDir, { recursive: true });
  const { server, port, resultPromise, rejectResult } = await startServer();
  const timer = setTimeout(() => {
    rejectResult(new Error(`ats_extension_auto_timeout_${timeoutMs}`));
    try { server.close(); } catch {}
  }, timeoutMs);

  try {
    if (openPage && openPageUrl) {
      console.log(JSON.stringify({ event: 'open_target_page', url: openPageUrl }));
      openEdge(openPageUrl);
      await wait(3500);
    }
    if (!skipReload) {
      const reloadUrl = `chrome-extension://${EXT_ID}/${autoHtmlPath}?mode=reload&reportPort=${port}`;
      console.log(JSON.stringify({ event: 'open_reload', reloadUrl }));
      openEdge(reloadUrl);
      await wait(4500);
    }
    const qs = new URLSearchParams({
      mode,
      openIfMissing: openIfMissing ? '1' : '0',
      reportPort: String(port)
    });
    if (targetPage) qs.set('targetPage', targetPage);
    const autoUrl = `chrome-extension://${EXT_ID}/${autoHtmlPath}?${qs}`;
    console.log(JSON.stringify({ event: 'open_auto', autoUrl, mode, extId: EXT_ID }));
    openEdge(autoUrl);

    const { body } = await resultPromise;
    clearTimeout(timer);
    const file = path.join(outDir, `${evidencePrefix}-${stampLocal()}.json`);
    const text = JSON.stringify(body, null, 2);
    fs.writeFileSync(file, text, 'utf8');
    const latest = path.join(outDir, latestName);
    fs.writeFileSync(latest, text, 'utf8');
    console.log(JSON.stringify({
      event: 'saved',
      file,
      latest,
      ok: body?.ok === true,
      mode: body?.mode || mode,
      state: body?.job?.state || body?.readiness?.pageState,
      reason: body?.reason || body?.job?.reason,
      helpNeeded: body?.helpNeeded === true,
      helpUrl: body?.helpUrl || null,
      writeAttempted: body?.writeAttempted === true,
      liveSupportClaimed: body?.liveSupportClaimed === true,
      note: body?.reason === 'extension_reload_required' ? 'await_extension_reload' : undefined
    }, null, 2));
    try { server.close(); } catch {}
    process.exit(body?.ok ? 0 : 2);
  } catch (error) {
    clearTimeout(timer);
    const file = path.join(outDir, `${evidencePrefix}-${stampLocal()}-error.json`);
    const payload = { ok: false, reason: String(error?.message || error), at: new Date().toISOString() };
    fs.writeFileSync(file, JSON.stringify(payload, null, 2));
    fs.writeFileSync(path.join(outDir, latestName), JSON.stringify(payload, null, 2));
    console.error(JSON.stringify({ event: 'error', file, ...payload }, null, 2));
    try { server.close(); } catch {}
    process.exit(1);
  }
}
