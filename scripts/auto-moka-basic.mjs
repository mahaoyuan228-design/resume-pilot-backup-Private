#!/usr/bin/env node
// Moka basic harness (first slice).
// MODE=readiness|fill (default readiness). Never clicks 保存/提交/投递.
// CDP_PORT default 9237. Prefer --synthetic / FIXTURE offline fill — live resume is login-walled on *.mokahr.com.
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runAtsExtensionHarness } from './lib/ats-extension-harness.mjs';
if (typeof globalThis.WebSocket === 'undefined') {
  const { default: WS } = await import('ws');
  globalThis.WebSocket = WS;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outDir = process.env.AUTO_RUNS_DIR
  ? path.resolve(process.env.AUTO_RUNS_DIR)
  : path.join(repoRoot, 'dist', 'auto-runs');
const scriptPath = path.join(repoRoot, 'src', 'content', 'moka-basic.js');
const fixtureName = 'moka-basic-form.html';
const SITE_ID = 'moka';
/** Documented public Moka sample (君乐宝); resume form not reachable without login. */
const SAMPLE_PORTAL = process.env.MOKA_PAGE || 'https://app.mokahr.com/campus-recruitment/ti/143986';

function stampIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/u, '').replace(/:/gu, '-');
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  const args = { synthetic: false, live: false, help: false, extension: false, caseName: 'ready' };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--synthetic') args.synthetic = true;
    else if (token === '--live') args.live = true;
    else if (token === '--extension') args.extension = true;
    else if (token === '--case') {
      args.caseName = argv[index + 1] || 'ready';
      index += 1;
    } else if (token === '--help' || token === '-h') args.help = true;
  }
  return args;
}

function modeFromEnv() {
  const mode = String(process.env.MODE || 'readiness').toLowerCase();
  return mode === 'fill' ? 'fill' : 'readiness';
}

function evidencePaths(kind, now = stampIso()) {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `moka-basic-${kind}-${now}.json`);
  const latest = path.join(outDir, `moka-basic-${kind}-latest.json`);
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
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'moka-'));
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
    at: new Date().toISOString(),
    samplePortal: SAMPLE_PORTAL,
    ...partial,
    saved: false,
    skippedSave: true
  };
}

const NEVER_SAVE_HOOK = `(() => {
  if (window.__mokaNeverSave) return window.__mokaNeverSave.clicks;
  const bag = { clicks: 0, labels: [] };
  window.__mokaNeverSave = bag;
  const re = /保存|提交|投递/;
  const textOf = (el) => String((el && (el.innerText || el.textContent || el.value)) || '').replace(/\\s+/g, '');
  const note = (el) => {
    const text = textOf(el);
    if (!re.test(text)) return;
    bag.clicks += 1;
    bag.labels.push(text.slice(0, 32));
  };
  document.addEventListener('click', (event) => {
    const el = event.target && event.target.closest && event.target.closest('button, a, input, [role="button"]');
    if (el) note(el);
  }, true);
  document.addEventListener('submit', () => {
    bag.clicks += 1;
    bag.labels.push('submit');
  }, true);
  const orig = HTMLElement.prototype.click;
  HTMLElement.prototype.click = function () {
    note(this);
    return orig.apply(this, arguments);
  };
  return bag.clicks;
})()`;

async function runSynthetic(mode, caseName = 'ready') {
  const pageFixture = caseName === 'ambiguous'
    ? 'moka-basic-ambiguous.html'
    : fixtureName;
  const { server, port } = await startFixtureServer();
  const cdpPort = await freePort();
  let child;
  try {
    ({ child } = await launchChrome(cdpPort));
    const url = `http://127.0.0.1:${port}/${pageFixture}`;
    const { socket, send } = await attachPage(cdpPort, url);
    await injectScript(send);
    const probe = await evaluate(send, `ResumeMokaBasic.probeLabels({ synthetic: true })`);
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

    await evaluate(send, NEVER_SAVE_HOOK);
    const fill = await evaluate(send, `ResumeMokaBasic.fillBasic({
      allowExplicitValues: true,
      fullName: '测试甲',
      mobile: '13800138000',
      email: 'moka.fixture@example.com'
    }, { synthetic: true })`);
    const neverSave = await evaluate(send, `window.__mokaNeverSave || { clicks: -1, labels: [] }`);

    if (caseName === 'ambiguous') {
      const audit = await evaluate(send, `(() => {
        const rows = [...document.querySelectorAll('.moka-form-item')].map((node) => {
          const label = node.querySelector('.moka-form-item-label, label');
          const inputs = [...node.querySelectorAll('input')].map((el) => el.value);
          return { label: (label && label.textContent || '').trim(), inputs };
        });
        return { rows };
      })()`);
      const byLabel = (label) => (audit?.rows || []).filter((row) => row.label === label);
      const names = byLabel('姓名');
      const phones = byLabel('手机号码');
      const reasons = Object.fromEntries((fill?.results || []).map((row) => [row.label, row.reason]));
      const unchanged = names.length === 2
        && names[0]?.inputs?.[0] === 'KEEP-A'
        && names[1]?.inputs?.[0] === 'KEEP-B'
        && phones.length === 1
        && phones[0]?.inputs?.[0] === 'KEEP-PHONE'
        && byLabel('邮箱').length === 0;
      const ok = fill?.ok === false
        && fill?.reason === 'form_not_ready'
        && fill?.writeAttempted === false
        && fill?.saved === false
        && fill?.skippedSave === true
        && reasons['姓名'] === 'field_ambiguous'
        && reasons['邮箱'] === 'item_not_found'
        && reasons['手机号码'] === 'skipped_form_not_ready'
        && neverSave?.clicks === 0
        && unchanged;
      const payload = basePayload({
        ok,
        reason: ok ? 'ambiguous_fail_closed' : (fill?.reason || 'ambiguous_fail_closed_mismatch'),
        surface: 'synthetic-ambiguous-fixture',
        liveEdge: false,
        formFillClaimed: false,
        fill,
        neverSave,
        audit,
        unchanged
      });
      const written = writeEvidence('ambiguous', payload);
      socket.close();
      return { payload, written };
    }

    const neighbor = await evaluate(send, `(() => {
      const item = [...document.querySelectorAll('.moka-form-item')].find((node) => {
        const label = node.querySelector('.moka-form-item-label, label');
        return label && /工作年限/.test(label.textContent || '');
      });
      const input = item?.querySelector('input');
      return { value: input?.value || null, saveDisabled: document.getElementById('save-btn')?.disabled === true };
    })()`);

    const saveClicks = await evaluate(send, `(() => {
      // Harness must never click save; assert button still disabled / unclicked.
      return { saveDisabled: document.getElementById('save-btn')?.disabled === true, saveText: document.getElementById('save-btn')?.textContent || '' };
    })()`);

    const ok = fill?.ok === true
      && fill?.saved === false
      && fill?.skippedSave === true
      && neighbor?.value === '0'
      && saveClicks?.saveDisabled === true
      && neverSave?.clicks === 0;

    const payload = basePayload({
      ok,
      reason: ok ? 'synthetic_fill_pass' : (fill?.reason || 'synthetic_fill_fail'),
      surface: 'synthetic-fixture',
      liveEdge: false,
      probe,
      fill,
      neighbor,
      saveGuard: saveClicks,
      neverSave
    });
    const written = writeEvidence('fill', payload);
    socket.close();
    return { payload, written };
  } finally {
    try { child?.kill(); } catch {}
    try { server.close(); } catch {}
  }
}

async function runLiveReadiness(cdpPort) {
  // Read-only portal fingerprint on documented public URL. Does NOT claim form readiness.
  const listRes = await fetch(`http://127.0.0.1:${cdpPort}/json/list`).catch(() => null);
  if (!listRes?.ok) {
    return {
      payload: basePayload({
        ok: false,
        reason: 'cdp_unavailable',
        surface: 'cdp',
        liveEdge: false,
        hint: `Start Edge with --remote-debugging-port=${cdpPort}; resume form still login-walled`
      }),
      written: null
    };
  }
  const { socket, send } = await attachPage(cdpPort, SAMPLE_PORTAL);
  await pause(1500);
  await injectScript(send);
  const probe = await evaluate(send, `ResumeMokaBasic.probeLabels()`);
  const fp = probe?.fingerprint || {};
  const payload = basePayload({
    ok: fp.looksMoka === true,
    reason: probe?.foundCount >= 3
      ? 'live_labels_ready'
      : fp.looksMoka
        ? 'moka_portal_login_walled_no_form'
        : (probe?.reason || 'live_probe_fail'),
    surface: 'cdp-live-portal',
    liveEdge: true,
    formFillClaimed: false,
    probe,
    blocker: 'Resume/edit DOM requires Moka/mokahr login; first-slice fill validated offline only'
  });
  const written = writeEvidence('readiness', payload);
  try { socket.close(); } catch {}
  return { payload, written };
}

function printHelp() {
  console.log(`Moka basic harness (siteId=${SITE_ID})
  MODE=readiness|fill (default readiness)
  CDP_PORT=9237 (live readiness only)
  Prefer offline:
    MODE=fill node scripts/auto-moka-basic.mjs --synthetic
    MODE=readiness node scripts/auto-moka-basic.mjs --synthetic
    MODE=fill node scripts/auto-moka-basic.mjs --synthetic --case ambiguous
  Live portal fingerprint only (no fill claim):
    MODE=readiness node scripts/auto-moka-basic.mjs --live
    Extension path (Edge + SW message MOKA_BASIC_AUTO):
    MODE=readiness node scripts/auto-moka-basic.mjs --extension
  (--synthetic remains default offline; --extension does not replace it)
  Never clicks 保存/提交. Sample portal: ${SAMPLE_PORTAL}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }
  if (args.extension) {
    await runAtsExtensionHarness({
      outDir,
      autoHtmlPath: 'src/auto/moka-basic-auto.html',
      evidencePrefix: 'moka-basic-auto',
      latestName: 'moka-basic-latest.json',
      openPageUrl: SAMPLE_PORTAL,
      targetPage: process.env.TARGET_PAGE || null
    });
    return;
  }
  const mode = modeFromEnv();
  // Default offline fixture. --live = portal readiness only. --synthetic always wins over --live.
  const useSynthetic = args.synthetic || (!args.live && process.env.MOKA_SURFACE !== 'live');

  // Fill on live is refused — login wall; do not invent success.
  if (mode === 'fill' && args.live && !args.synthetic) {
    const payload = basePayload({
      ok: false,
      reason: 'live_fill_refused_login_wall',
      surface: 'cdp',
      liveEdge: false,
      formFillClaimed: false,
      hint: 'Use --synthetic for fill; live resume form needs Jeremy Moka/mokahr login first'
    });
    const written = writeEvidence('fill', payload);
    console.log(JSON.stringify({ event: 'refused', ...written, ...payload }, null, 2));
    process.exit(3);
  }

  try {
    if (args.live && !args.synthetic && mode === 'readiness') {
      const cdpPort = Number.parseInt(process.env.CDP_PORT || '9237', 10);
      const { payload, written } = await runLiveReadiness(cdpPort);
      const w = written || writeEvidence('readiness', payload);
      console.log(JSON.stringify({ event: 'saved', ...w, ok: payload.ok, reason: payload.reason }, null, 2));
      process.exit(payload.ok ? 0 : 2);
    }

    const { payload, written } = await runSynthetic(mode, args.caseName || 'ready');
    console.log(JSON.stringify({ event: 'saved', ...written, ok: payload.ok, reason: payload.reason, mode }, null, 2));
    process.exit(payload.ok ? 0 : 2);
  } catch (error) {
    const payload = basePayload({
      ok: false,
      reason: String(error?.message || error).slice(0, 300),
      surface: useSynthetic ? 'synthetic-fixture' : 'cdp',
      error: String(error?.stack || error).slice(0, 800)
    });
    const written = writeEvidence(mode, payload);
    console.error(JSON.stringify({ event: 'error', ...written, ...payload }, null, 2));
    process.exit(1);
  }
}

main();
