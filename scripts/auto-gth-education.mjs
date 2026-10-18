#!/usr/bin/env node
// One-shot: optional open GTH edit URL, reload SW, run GTH_EDUCATION_AUTO, save JSON.
// Default mode=readiness (inspect-only). Set MODE=fill for fill-without-save. Never saves.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outDir = path.join(repoRoot, 'dist', 'auto-runs');
fs.mkdirSync(outDir, { recursive: true });

const EXT_ID = process.env.RESUME_EXT_ID || 'hdekmacbpblppkbpamgocbanjafigfej';
const profileIndex = Number.parseInt(process.env.PROFILE_INDEX || '5', 10);
const replaceExisting = (process.env.REPLACE_EXISTING || '1') !== '0';
const mode = process.env.MODE || 'readiness';
const rowIndex = process.env.ROW_INDEX || '';
const openPage = (process.env.OPEN_GTH_PAGE || '1') !== '0';
const openIfMissing = (process.env.OPEN_IF_MISSING || '1') !== '0';
const timeoutMs = Number.parseInt(process.env.AUTO_TIMEOUT_MS || '180000', 10);
const skipReload = process.env.SKIP_RELOAD === '1';
const GTH_PAGE = 'https://hr.gtht.com/resume/edit/';

function stamp() {
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

const { server, port, resultPromise, rejectResult } = await startServer();
const timer = setTimeout(() => {
  rejectResult(new Error(`auto_gth_education_timeout_${timeoutMs}`));
  try { server.close(); } catch {}
}, timeoutMs);

try {
  if (openPage) {
    console.log(JSON.stringify({ event: 'open_gth_page', url: GTH_PAGE }));
    openEdge(GTH_PAGE);
    await wait(3500);
  }
  if (!skipReload) {
    const reloadUrl = `chrome-extension://${EXT_ID}/src/auto/gth-education-auto.html?mode=reload&reportPort=${port}`;
    console.log(JSON.stringify({ event: 'open_reload', reloadUrl }));
    openEdge(reloadUrl);
    await wait(4500);
  }
  const qs = new URLSearchParams({
    mode,
    profileIndex: String(profileIndex),
    replaceExisting: replaceExisting ? '1' : '0',
    openIfMissing: openIfMissing ? '1' : '0',
    reportPort: String(port)
  });
  if (rowIndex !== '') qs.set('rowIndex', rowIndex);
  const autoUrl = `chrome-extension://${EXT_ID}/src/auto/gth-education-auto.html?${qs}`;
  console.log(JSON.stringify({ event: 'open_auto', autoUrl, mode, profileIndex, replaceExisting }));
  openEdge(autoUrl);

  const { body } = await resultPromise;
  clearTimeout(timer);
  const file = path.join(outDir, `gth-education-auto-${stamp()}.json`);
  fs.writeFileSync(file, JSON.stringify(body, null, 2), 'utf8');
  const latest = path.join(outDir, 'gth-latest.json');
  fs.writeFileSync(latest, JSON.stringify(body, null, 2), 'utf8');
  fs.writeFileSync(path.join(outDir, 'latest-gth.json'), JSON.stringify(body, null, 2), 'utf8');
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
    draftReady: body?.draft?.readyToSave === true
  }, null, 2));
  try { server.close(); } catch {}
  process.exit(body?.ok ? 0 : 2);
} catch (error) {
  clearTimeout(timer);
  const file = path.join(outDir, `gth-education-auto-${stamp()}-error.json`);
  const payload = { ok: false, reason: String(error?.message || error), at: new Date().toISOString() };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  fs.writeFileSync(path.join(outDir, 'gth-latest.json'), JSON.stringify(payload, null, 2));
  console.error(JSON.stringify({ event: 'error', file, ...payload }, null, 2));
  try { server.close(); } catch {}
  process.exit(1);
}
