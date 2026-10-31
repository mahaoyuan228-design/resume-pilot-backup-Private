#!/usr/bin/env node
// One-shot: optional open CMS edit URL, reload SW, run CMS_BASIC_AUTO, save JSON.
// Default mode=readiness. Set MODE=fill for fill-without-save. Never saves. CMS 个人基本信息必填 fields.
// Target page: CMS_PAGE (full wecruit.hotjob.cn/SU*/pb/resumeOperation.html URL) and/or CMS_SU.
// Unset → 招商 baseline (unchanged). Non-baseline SU also writes dist/auto-runs/hotjob-tenant-<tag>-cms-basic-<stamp>.json
// and does NOT overwrite the baseline cms-basic-latest / latest-cms-basic pointers.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { resolveCmsTarget, tenantEvidenceName } from './lib/cms-page-target.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
// AUTO_RUNS_DIR: test-only override for evidence output (default dist/auto-runs).
const outDir = process.env.AUTO_RUNS_DIR ? path.resolve(process.env.AUTO_RUNS_DIR) : path.join(repoRoot, 'dist', 'auto-runs');
fs.mkdirSync(outDir, { recursive: true });

const EXT_ID = process.env.RESUME_EXT_ID || 'hdekmacbpblppkbpamgocbanjafigfej';
const mode = process.env.MODE || 'readiness';
const openPage = (process.env.OPEN_CMS_PAGE || '1') !== '0';
const openIfMissing = (process.env.OPEN_IF_MISSING || '1') !== '0';
const timeoutMs = Number.parseInt(process.env.AUTO_TIMEOUT_MS || '180000', 10);
const skipReload = process.env.RELOAD !== '1';
let target;
try {
  target = resolveCmsTarget(process.env);
} catch (error) {
  const reason = error.code || 'cms_target_invalid';
  console.error(JSON.stringify({ event: 'refused', reason, detail: String(error.message || error),
    hint: 'CMS_PAGE must be https://wecruit.hotjob.cn/SU<id>/pb/resumeOperation.html (no query/hash); CMS_SU must be SU<id>' }, null, 2));
  process.exit(3);
}
if (target.shell === 'mc') {
  console.error(JSON.stringify({
    event: 'refused',
    reason: 'hotjob_mc_shell_requires_adapter',
    detail: `${target.page} is the hotjob-mc shell, not CMS pb`,
    hint: 'mc shell (/SU*/mc/deliver/operationResumer) is not CMS_BASIC. Use scripts/auto-hotjob-mc-basic.mjs or scripts/run-hotjob-tenant.cmd zhonglian'
  }, null, 2));
  process.exit(4);
}
const CMS_PAGE = target.page;
const harnessTarget = { su: target.su, page: target.page, isBaseline: target.isBaseline, source: target.source,
  tag: target.tag, tenantKey: target.tenantKey };
console.log(JSON.stringify({ event: 'cms_target', ...harnessTarget }));

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
  rejectResult(new Error(`auto_cms_basic_timeout_${timeoutMs}`));
  try { server.close(); } catch {}
}, timeoutMs);

try {
  if (openPage) {
    console.log(JSON.stringify({ event: 'open_cms_page', url: CMS_PAGE }));
    openEdge(CMS_PAGE);
    await wait(3500);
  }
  if (!skipReload) {
    const reloadUrl = `chrome-extension://${EXT_ID}/src/auto/cms-basic-auto.html?mode=reload&reportPort=${port}`;
    console.log(JSON.stringify({ event: 'open_reload', reloadUrl }));
    openEdge(reloadUrl);
    await wait(4500);
  }
  const qs = new URLSearchParams({
    mode,
    openIfMissing: openIfMissing ? '1' : '0',
    reportPort: String(port)
  });
  // Baseline keeps the exact historical auto URL; tenants pass the target page to the SW.
  if (!target.isBaseline) qs.set('cmsPage', CMS_PAGE);
  const autoUrl = `chrome-extension://${EXT_ID}/src/auto/cms-basic-auto.html?${qs}`;
  console.log(JSON.stringify({ event: 'open_auto', autoUrl, mode, openIfMissing }));
  openEdge(autoUrl);

  const { body } = await resultPromise;
  clearTimeout(timer);
  const runStamp = stamp();
  const evidence = { ...body, tenantSu: target.su, harnessTarget };
  const text = JSON.stringify(evidence, null, 2);
  const file = path.join(outDir, `cms-basic-auto-${runStamp}.json`);
  fs.writeFileSync(file, text, 'utf8');
  let latest = null;
  let tenantFile = null;
  if (target.isBaseline) {
    latest = path.join(outDir, 'cms-basic-latest.json');
    fs.writeFileSync(latest, text, 'utf8');
    fs.writeFileSync(path.join(outDir, 'latest-cms-basic.json'), text, 'utf8');
  } else {
    tenantFile = path.join(outDir, tenantEvidenceName(target.su, runStamp));
    fs.writeFileSync(tenantFile, text, 'utf8');
    latest = path.join(outDir, 'hotjob-tenant-cms-basic-latest.json');
    fs.writeFileSync(latest, text, 'utf8');
  }
  console.log(JSON.stringify({
    event: 'saved',
    file,
    latest,
    tenantFile,
    tenantSu: target.su,
    ok: body?.ok === true,
    mode: body?.mode || mode,
    state: body?.job?.state || body?.readiness?.pageState,
    reason: body?.reason || body?.job?.reason,
    helpNeeded: body?.helpNeeded === true,
    helpUrl: body?.helpUrl || null,
    writeAttempted: body?.writeAttempted === true,
    personalVerified: body?.job?.summary?.verified ?? body?.fill?.verified ?? null
  }, null, 2));
  try { server.close(); } catch {}
  process.exit(body?.ok ? 0 : 2);
} catch (error) {
  clearTimeout(timer);
  const runStamp = stamp();
  const file = path.join(outDir, `cms-basic-auto-${runStamp}-error.json`);
  const payload = { ok: false, reason: String(error?.message || error), at: new Date().toISOString(),
    tenantSu: target.su, harnessTarget };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  if (target.isBaseline) {
    fs.writeFileSync(path.join(outDir, 'cms-basic-latest.json'), JSON.stringify(payload, null, 2));
  } else {
    fs.writeFileSync(path.join(outDir, tenantEvidenceName(target.su, `${runStamp}-error`)), JSON.stringify(payload, null, 2));
    fs.writeFileSync(path.join(outDir, 'hotjob-tenant-cms-basic-latest.json'), JSON.stringify(payload, null, 2));
  }
  console.error(JSON.stringify({ event: 'error', file, ...payload }, null, 2));
  try { server.close(); } catch {}
  process.exit(1);
}
