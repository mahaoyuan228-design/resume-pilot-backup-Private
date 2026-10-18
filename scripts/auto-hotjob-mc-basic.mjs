#!/usr/bin/env node
// hotjob-mc basic harness (first slice). siteId hotjob-mc.
// MODE=readiness|fill (default readiness). Never clicks 保存/提交/投递.
// CDP_PORT default 9237. --synthetic fills the fixture. --live attaches to an
// existing 中联 operationResumer tab and does not navigate away.
// Trial extension id default is hhembhoojafdefnkonmgoejfedgloanc (not hdek…).
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ZHONGLIAN_MC_PAGE } from './lib/cms-page-target.mjs';
if (typeof globalThis.WebSocket === 'undefined') {
  const { default: WS } = await import('ws');
  globalThis.WebSocket = WS;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outDir = process.env.AUTO_RUNS_DIR
  ? path.resolve(process.env.AUTO_RUNS_DIR)
  : path.join(repoRoot, 'dist', 'auto-runs');
const scriptPath = path.join(repoRoot, 'src', 'content', 'hotjob-mc-basic.js');
const fixtureName = 'hotjob-mc-basic-form.html';
const SITE_ID = 'hotjob-mc';
const TRIAL_EXT_ID = 'hhembhoojafdefnkonmgoejfedgloanc';
const EXT_ID = process.env.RESUME_EXT_ID || TRIAL_EXT_ID;
const SAMPLE_PAGE = process.env.HOTJOB_MC_PAGE || ZHONGLIAN_MC_PAGE;

function stampIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/u, '').replace(/:/gu, '-');
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  const args = { synthetic: false, live: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--synthetic') args.synthetic = true;
    else if (token === '--live') args.live = true;
    else if (token === '--help' || token === '-h') args.help = true;
  }
  return args;
}

function modeFromEnv() {
  const mode = String(process.env.MODE || 'readiness').toLowerCase();
  return mode === 'fill' ? 'fill' : 'readiness';
}

function evidencePaths(kind, now = stampIso()) {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `hotjob-mc-basic-${kind}-${now}.json`);
  const latest = path.join(outDir, `hotjob-mc-basic-${kind}-latest.json`);
  return { file, latest };
}

function writeEvidence(kind, payload) {
  const { file, latest } = evidencePaths(kind);
  const json = JSON.stringify(payload, null, 2);
  fs.writeFileSync(file, json, 'utf8');
  fs.copyFileSync(file, latest);
  return { file, latest };
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function startFixtureServer() {
  const root = path.join(repoRoot, 'tests', 'fixtures');
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const name = path.basename(url.pathname);
    const file = path.join(root, name);
    if (!file.startsWith(root) || !fs.existsSync(file)) {
      res.writeHead(404);
      res.end('missing');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
    server.on('error', reject);
  });
}

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    '/usr/local/bin/google-chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/local/bin/box-chrome'
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || 'google-chrome';
}

async function launchChrome(port) {
  const userData = fs.mkdtempSync(path.join('/tmp', 'hotjob-mc-'));
  const child = spawn(chromePath(), [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--no-first-run',
    `--user-data-dir=${userData}`,
    `--remote-debugging-port=${port}`,
    'about:blank'
  ], { stdio: 'ignore' });
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return { child, userData };
    } catch { /* wait */ }
    await pause(100);
  }
  try { child.kill(); } catch {}
  throw new Error('chrome_cdp_not_ready');
}

function wsConnect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const pending = new Map();
    let nextId = 1;
    socket.addEventListener('open', () => {
      resolve({
        socket,
        send(method, params = {}) {
          const id = nextId++;
          return new Promise((res, rej) => {
            pending.set(id, { res, rej });
            socket.send(JSON.stringify({ id, method, params }));
          });
        }
      });
    });
    socket.addEventListener('error', (err) => reject(err));
    socket.addEventListener('message', (event) => {
      let msg;
      try { msg = JSON.parse(String(event.data)); } catch { return; }
      if (msg.id != null && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message || JSON.stringify(msg.error)));
        else res(msg.result);
      }
    });
  });
}

async function attachPage(cdpPort, targetUrl) {
  const list = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
  let page = list.find((row) => row.type === 'page' && row.webSocketDebuggerUrl);
  if (!page) {
    await fetch(`http://127.0.0.1:${cdpPort}/json/new?${encodeURIComponent(targetUrl)}`);
    await pause(300);
    const again = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
    page = again.find((row) => row.type === 'page' && row.webSocketDebuggerUrl);
  }
  if (!page?.webSocketDebuggerUrl) throw new Error('no_cdp_page');
  const { socket, send } = await wsConnect(page.webSocketDebuggerUrl);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: targetUrl });
  await pause(800);
  return { socket, send, page };
}

async function attachLiveTab(cdpPort) {
  const listRes = await fetch(`http://127.0.0.1:${cdpPort}/json/list`).catch(() => null);
  if (!listRes?.ok) return { ok: false, reason: 'cdp_unavailable' };
  const list = await listRes.json();
  const page = list.find((row) => row.type === 'page'
    && typeof row.url === 'string'
    && row.url.includes('/mc/operationResumer')
    && row.webSocketDebuggerUrl);
  if (!page) {
    return {
      ok: false,
      reason: 'mc_tab_missing',
      tabs: list.filter((row) => row.type === 'page').map((row) => row.url || '').slice(0, 8)
    };
  }
  const { socket, send } = await wsConnect(page.webSocketDebuggerUrl);
  await send('Runtime.enable');
  try { await send('Page.enable'); } catch { /* attach only; do not navigate */ }
  return { ok: true, socket, send, page };
}

async function injectScript(send) {
  const source = fs.readFileSync(scriptPath, 'utf8');
  await send('Runtime.evaluate', { expression: source, returnByValue: false });
}

async function evaluate(send, expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'evaluate_failed');
  }
  return result.result?.value;
}

function basePayload(partial) {
  return {
    siteId: SITE_ID,
    mode: modeFromEnv(),
    saved: false,
    skippedSave: true,
    liveSupportClaimed: false,
    trialExtId: EXT_ID,
    at: new Date().toISOString(),
    samplePage: SAMPLE_PAGE,
    ...partial,
    saved: false,
    skippedSave: true,
    liveSupportClaimed: false
  };
}

async function runSynthetic(mode) {
  const { server, port } = await startFixtureServer();
  const cdpPort = await freePort();
  let child;
  try {
    ({ child } = await launchChrome(cdpPort));
    const url = `http://127.0.0.1:${port}/${fixtureName}`;
    const { socket, send } = await attachPage(cdpPort, url);
    await injectScript(send);
    const probe = await evaluate(send, `ResumeHotjobMcBasic.probeLabels({ synthetic: true })`);
    if (mode === 'readiness') {
      const payload = basePayload({
        ok: probe?.foundCount >= 3,
        reason: probe?.reason || 'probe_empty',
        surface: 'synthetic-fixture',
        liveEdge: false,
        probe
      });
      const written = writeEvidence('readiness', payload);
      socket.close();
      return { payload, written };
    }

    const fill = await evaluate(send, `ResumeHotjobMcBasic.fillBasic({
      allowExplicitValues: true,
      fullName: '测试甲',
      mobile: '13800138000',
      email: 'hotjob.mc.fixture@example.com'
    }, { synthetic: true })`);

    const neighbor = await evaluate(send, `(() => {
      const item = [...document.querySelectorAll('.my-list-item')].find((node) => {
        const label = node.querySelector('.header-title');
        return label && /证件号码/.test(label.textContent || '');
      });
      const input = item?.querySelector('.am-input-control input');
      return { value: input?.value || null, saveDisabled: document.getElementById('save-btn')?.disabled === true };
    })()`);

    const ok = fill?.ok === true
      && fill?.saved === false
      && fill?.skippedSave === true
      && fill?.liveSupportClaimed === false
      && neighbor?.value === '0'
      && neighbor?.saveDisabled === true;

    const payload = basePayload({
      ok,
      reason: ok ? 'synthetic_fill_pass' : (fill?.reason || 'synthetic_fill_fail'),
      surface: 'synthetic-fixture',
      liveEdge: false,
      probe,
      fill,
      neighbor
    });
    const written = writeEvidence('fill', payload);
    socket.close();
    return { payload, written };
  } finally {
    try { child?.kill(); } catch {}
    try { server.close(); } catch {}
  }
}

async function runLive(mode) {
  const cdpPort = Number.parseInt(process.env.CDP_PORT || '9237', 10);
  const attached = await attachLiveTab(cdpPort);
  if (!attached.ok) {
    const payload = basePayload({
      ok: false,
      reason: attached.reason,
      surface: 'cdp-live',
      liveEdge: false,
      formFillClaimed: false,
      tabs: attached.tabs || [],
      hint: `Open the logged-in 中联 tab ${SAMPLE_PAGE} on CDP ${cdpPort}. This harness does not navigate and does not click 保存.`
    });
    return { payload, written: writeEvidence(mode, payload) };
  }
  const { socket, send } = attached;
  await injectScript(send);
  const probe = await evaluate(send, `ResumeHotjobMcBasic.probeLabels()`);
  if (mode === 'readiness') {
    const payload = basePayload({
      ok: probe?.foundCount >= 3 && probe?.ok === true,
      reason: probe?.reason || 'live_probe_fail',
      surface: 'cdp-live',
      liveEdge: true,
      formFillClaimed: false,
      probe,
      href: attached.page.url || null
    });
    try { socket.close(); } catch {}
    return { payload, written: writeEvidence('readiness', payload) };
  }

  const fullName = process.env.HOTJOB_MC_FULL_NAME || '';
  const mobile = process.env.HOTJOB_MC_PHONE || '';
  const email = process.env.HOTJOB_MC_EMAIL || '';
  if (!fullName || !mobile || !email) {
    const payload = basePayload({
      ok: false,
      reason: 'live_fill_needs_explicit_values',
      surface: 'cdp-live',
      liveEdge: true,
      formFillClaimed: false,
      probe,
      hint: 'Set HOTJOB_MC_FULL_NAME, HOTJOB_MC_PHONE, HOTJOB_MC_EMAIL. No placeholders. Never Save.'
    });
    try { socket.close(); } catch {}
    return { payload, written: writeEvidence('fill', payload) };
  }

  const fill = await evaluate(send, `ResumeHotjobMcBasic.fillBasic(${JSON.stringify({
    allowExplicitValues: true,
    fullName,
    mobile,
    email
  })})`);
  const ok = fill?.ok === true && fill?.saved === false && fill?.skippedSave === true;
  const payload = basePayload({
    ok,
    reason: ok ? 'live_fill_pass' : (fill?.reason || 'live_fill_fail'),
    surface: 'cdp-live',
    liveEdge: true,
    formFillClaimed: false,
    probe,
    fill,
    href: attached.page.url || null
  });
  try { socket.close(); } catch {}
  return { payload, written: writeEvidence('fill', payload) };
}

function printHelp() {
  console.log(`hotjob-mc basic harness (siteId=${SITE_ID})
  Trial EXT id default: ${TRIAL_EXT_ID}
  Page: ${SAMPLE_PAGE}
  MODE=readiness|fill (default readiness)
  CDP_PORT=9237
  Offline:
    MODE=fill node scripts/auto-hotjob-mc-basic.mjs --synthetic
    MODE=readiness node scripts/auto-hotjob-mc-basic.mjs --synthetic
  Live (attach only; never navigates; never clicks 保存):
    MODE=readiness node scripts/auto-hotjob-mc-basic.mjs --live
    HOTJOB_MC_FULL_NAME=… HOTJOB_MC_PHONE=… HOTJOB_MC_EMAIL=… MODE=fill node scripts/auto-hotjob-mc-basic.mjs --live
  Not customer-ready.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }
  const mode = modeFromEnv();
  const useSynthetic = args.synthetic || !args.live;
  try {
    const { payload, written } = useSynthetic ? await runSynthetic(mode) : await runLive(mode);
    console.log(JSON.stringify({
      event: 'saved',
      ...written,
      ok: payload.ok,
      reason: payload.reason,
      mode,
      trialExtId: EXT_ID,
      liveSupportClaimed: false
    }, null, 2));
    process.exit(payload.ok ? 0 : 2);
  } catch (error) {
    const payload = basePayload({
      ok: false,
      reason: String(error?.message || error).slice(0, 300),
      surface: useSynthetic ? 'synthetic-fixture' : 'cdp-live',
      error: String(error?.stack || error).slice(0, 800)
    });
    const written = writeEvidence(mode, payload);
    console.error(JSON.stringify({ event: 'error', ...written, ...payload }, null, 2));
    process.exit(1);
  }
}

main();
