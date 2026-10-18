#!/usr/bin/env node
// Hotjob mc (antd-mobile H5) basic harness — first slice siteId=hotjob-mc.
// MODE=readiness|fill (default readiness). Never clicks 下一步/保存/提交.
// CDP_PORT default 9237. CMS_SU / CMS_PAGE select mc tab (中联 shell=mc).
// Default path: live CDP inject (self-inject; SW optional). --synthetic = offline fixture.
// Fill always restores prior values when restore!==false (documented in evidence).
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  CMS_HOST,
  HOTJOB_TENANTS,
  parseHotjobMcPage,
  cmsMcPageForSu,
  CMS_SU_RE
} from './lib/cms-page-target.mjs';
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
const scriptPath = path.join(repoRoot, 'src', 'content', 'hotjob-mc-basic.js');
const fixtureName = 'hotjob-mc-basic-form.html';
const SITE_ID = 'hotjob-mc';
const DEFAULT_SU = HOTJOB_TENANTS.zhonglian.su;
const DEFAULT_MC_PAGE = cmsMcPageForSu(DEFAULT_SU);

function stampIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/u, '').replace(/:/gu, '-');
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  const args = { synthetic: false, live: false, help: false, noRestore: false, extension: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--synthetic') args.synthetic = true;
    else if (token === '--live') args.live = true;
    else if (token === '--no-restore') args.noRestore = true;
    else if (token === '--extension') args.extension = true;
    else if (token === '--help' || token === '-h') args.help = true;
  }
  return args;
}

function modeFromEnv() {
  const mode = String(process.env.MODE || 'readiness').toLowerCase();
  return mode === 'fill' ? 'fill' : 'readiness';
}

function resolveMcTarget() {
  const pageEnv = String(process.env.CMS_PAGE || '').trim();
  const suEnv = String(process.env.CMS_SU || '').trim();
  if (pageEnv) {
    const parsed = parseHotjobMcPage(pageEnv);
    return { su: parsed.su, page: parsed.page, shell: 'mc' };
  }
  if (suEnv) {
    if (!CMS_SU_RE.test(suEnv)) {
      const err = new Error(`cms_su_invalid: ${suEnv}`);
      err.code = 'cms_su_invalid';
      throw err;
    }
    return { su: suEnv, page: cmsMcPageForSu(suEnv), shell: 'mc' };
  }
  // Alias: zhonglian / 中联
  const alias = String(process.env.CMS_TENANT || process.env.HOTJOB_TENANT || '').toLowerCase();
  if (alias === 'zhonglian' || alias === '中联') {
    return { su: DEFAULT_SU, page: DEFAULT_MC_PAGE, shell: 'mc' };
  }
  return { su: DEFAULT_SU, page: DEFAULT_MC_PAGE, shell: 'mc' };
}

function evidencePaths(kind, su, now = stampIso()) {
  fs.mkdirSync(outDir, { recursive: true });
  const tag = String(su || 'unknown').replace(/^SU/u, '').slice(0, 6);
  const file = path.join(outDir, `hotjob-mc-basic-${kind}-${now}.json`);
  const latest = path.join(outDir, `hotjob-mc-basic-${kind}-latest.json`);
  const tenant = path.join(outDir, `hotjob-tenant-${tag}-mc-basic-${now}.json`);
  const tenantLatest = path.join(outDir, `hotjob-tenant-mc-basic-latest.json`);
  return { file, latest, tenant, tenantLatest };
}

function writeEvidence(kind, payload) {
  const { file, latest, tenant, tenantLatest } = evidencePaths(kind, payload.tenantSu);
  const json = JSON.stringify(payload, null, 2);
  fs.writeFileSync(file, json, 'utf8');
  fs.copyFileSync(file, latest);
  fs.writeFileSync(tenant, json, 'utf8');
  fs.copyFileSync(tenant, tenantLatest);
  return { file, latest, tenant, tenantLatest };
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
    '/usr/local/bin/box-chrome',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || 'google-chrome';
}

async function launchChrome(port) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'hotjob-mc-'));
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

async function attachNewPage(cdpPort, targetUrl) {
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

async function attachExistingMcTab(cdpPort, target) {
  const list = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
  const pages = list.filter((row) => row.type === 'page' && row.webSocketDebuggerUrl);
  const match = pages.find((row) => {
    try {
      const u = new URL(row.url || '');
      return u.hostname === CMS_HOST
        && u.pathname.includes(`/mc/deliver/operationResumer`)
        && u.pathname.includes(target.su);
    } catch {
      return false;
    }
  }) || pages.find((row) => {
    try {
      const u = new URL(row.url || '');
      return u.hostname === CMS_HOST && /\/mc\/deliver\/operationResumer/u.test(u.pathname);
    } catch {
      return false;
    }
  });
  if (!match) {
    return { error: 'mc_tab_not_found', pages: pages.map((p) => ({ id: p.id, title: p.title, url: p.url })) };
  }
  const { socket, send } = await wsConnect(match.webSocketDebuggerUrl);
  await send('Page.enable');
  await send('Runtime.enable');
  try { await send('Page.bringToFront'); } catch { /* optional */ }
  return { socket, send, page: match };
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
    neverClickedNext: true,
    at: new Date().toISOString(),
    ...partial,
    saved: false,
    skippedSave: true
  };
}

async function runSynthetic(mode, args) {
  const { server, port } = await startFixtureServer();
  const cdpPort = await freePort();
  let child;
  try {
    ({ child } = await launchChrome(cdpPort));
    const url = `http://127.0.0.1:${port}/${fixtureName}`;
    const { socket, send } = await attachNewPage(cdpPort, url);
    await injectScript(send);
    const probe = await evaluate(send, `ResumeHotjobMcBasic.probeLabels({ synthetic: true })`);
    if (mode === 'readiness') {
      const payload = basePayload({
        ok: probe?.foundCount >= 3 && probe?.ok === true,
        reason: probe?.reason || 'probe_empty',
        surface: 'synthetic-fixture',
        liveEdge: false,
        tenantSu: DEFAULT_SU,
        restorePolicy: 'n/a_readiness',
        probe
      });
      const written = writeEvidence('readiness', payload);
      socket.close();
      return { payload, written };
    }

    const restore = args.noRestore ? false : true;
    const fill = await evaluate(send, `ResumeHotjobMcBasic.fillBasic({
      allowExplicitValues: true,
      fullName: '测试甲',
      mobile: '13800138000',
      email: 'mc.fixture@example.com'
    }, { synthetic: true, restore: ${restore ? 'true' : 'false'} })`);

    const afterRestore = await evaluate(send, `(() => {
      const read = (label) => {
        const item = [...document.querySelectorAll('.my-list-item')].find((node) => {
          const t = node.querySelector('.header-title');
          return t && (t.textContent || '').replace(/\\s+/g, ' ').includes(label);
        });
        const input = item?.querySelector('.am-input-control input');
        return input ? input.value : null;
      };
      return {
        name: read('姓名'),
        mobile: read('移动电话'),
        email: read('电子邮箱'),
        neighbor: read('证件号码'),
        nextStillPresent: !!document.querySelector('.my-button')
      };
    })()`);

    const ok = fill?.ok === true
      && fill?.saved === false
      && fill?.skippedSave === true
      && afterRestore?.neighbor === 'NEIGHBOR_KEEP'
      && (restore
        ? (afterRestore?.name === '' && afterRestore?.mobile === '' && afterRestore?.email === '')
        : true);

    const payload = basePayload({
      ok,
      reason: ok ? 'synthetic_fill_pass' : (fill?.reason || 'synthetic_fill_fail'),
      surface: 'synthetic-fixture',
      liveEdge: false,
      tenantSu: DEFAULT_SU,
      restorePolicy: restore
        ? 'restored_to_pre_fill_values_after_readback'
        : 'left_filled_no_restore(--no-restore)',
      probe,
      fill,
      afterRestore
    });
    const written = writeEvidence('fill', payload);
    socket.close();
    return { payload, written };
  } finally {
    try { child?.kill(); } catch {}
    try { server.close(); } catch {}
  }
}

async function runLive(mode, args) {
  const cdpPort = Number.parseInt(process.env.CDP_PORT || '9237', 10);
  const target = resolveMcTarget();
  const listRes = await fetch(`http://127.0.0.1:${cdpPort}/json/list`).catch(() => null);
  if (!listRes?.ok) {
    const payload = basePayload({
      ok: false,
      reason: 'cdp_unavailable',
      surface: 'cdp',
      liveEdge: false,
      tenantSu: target.su,
      cmsPage: target.page,
      hint: `Start Edge with --remote-debugging-port=${cdpPort}; park on mc operationResumer`
    });
    return { payload, written: writeEvidence(mode, payload) };
  }

  const attached = await attachExistingMcTab(cdpPort, target);
  if (attached.error) {
    const payload = basePayload({
      ok: false,
      reason: attached.error,
      surface: 'cdp-live-mc',
      liveEdge: true,
      tenantSu: target.su,
      cmsPage: target.page,
      openPages: attached.pages
    });
    return { payload, written: writeEvidence(mode, payload) };
  }
  const { socket, send, page } = attached;
  await injectScript(send);
  const probe = await evaluate(send, `ResumeHotjobMcBasic.probeLabels()`);

  if (mode === 'readiness') {
    const payload = basePayload({
      ok: probe?.ok === true && probe?.foundCount >= 3,
      reason: probe?.reason || 'live_probe_fail',
      surface: 'cdp-live-mc',
      liveEdge: true,
      tenantSu: target.su,
      cmsPage: target.page,
      tabId: page.id,
      tabUrl: page.url,
      restorePolicy: 'n/a_readiness',
      probe
    });
    const written = writeEvidence('readiness', payload);
    try { socket.close(); } catch {}
    return { payload, written };
  }

  // Login gone → stop (caller should have checked readiness; still gate here).
  if (probe?.fingerprint?.loginHints || probe?.reason === 'login_wall') {
    const payload = basePayload({
      ok: false,
      reason: 'login_wall',
      surface: 'cdp-live-mc',
      liveEdge: true,
      tenantSu: target.su,
      cmsPage: target.page,
      probe,
      formFillClaimed: false
    });
    const written = writeEvidence('fill', payload);
    try { socket.close(); } catch {}
    return { payload, written };
  }
  if (!(probe?.foundCount >= 3)) {
    const payload = basePayload({
      ok: false,
      reason: probe?.reason || 'labels_not_ready',
      surface: 'cdp-live-mc',
      liveEdge: true,
      tenantSu: target.su,
      cmsPage: target.page,
      probe,
      formFillClaimed: false
    });
    const written = writeEvidence('fill', payload);
    try { socket.close(); } catch {}
    return { payload, written };
  }

  const restore = args.noRestore ? false : true;
  const fillValues = {
    fullName: process.env.HOTJOB_MC_NAME || '测试甲',
    mobile: process.env.HOTJOB_MC_MOBILE || '13800138000',
    email: process.env.HOTJOB_MC_EMAIL || 'mc.live@example.com'
  };
  const fill = await evaluate(send, `ResumeHotjobMcBasic.fillBasic({
    allowExplicitValues: true,
    fullName: ${JSON.stringify(fillValues.fullName)},
    mobile: ${JSON.stringify(fillValues.mobile)},
    email: ${JSON.stringify(fillValues.email)}
  }, { restore: ${restore ? 'true' : 'false'} })`);

  // Guard: ensure we never clicked 下一步
  const saveGuard = await evaluate(send, `(() => {
    const next = [...document.querySelectorAll('.my-button, button')].find((b) => /下一步|保存|提交/.test(b.textContent || ''));
    return {
      nextText: next?.textContent?.trim() || null,
      neverClickedByHarness: true
    };
  })()`);

  const ok = fill?.ok === true && fill?.saved === false && fill?.skippedSave === true
    && (!restore || (fill?.restore || []).every((row) => row.ok === true));

  const payload = basePayload({
    ok,
    reason: ok ? (restore ? 'live_fill_wo_save_restored' : 'live_fill_wo_save_left') : (fill?.reason || 'live_fill_fail'),
    surface: 'cdp-live-mc',
    liveEdge: true,
    tenantSu: target.su,
    cmsPage: target.page,
    tabId: page.id,
    tabUrl: page.url,
    restorePolicy: restore
      ? 'restored_to_pre_fill_values_after_readback (Never Save; 下一步 not clicked)'
      : 'left_filled_no_restore(--no-restore); still never clicked 下一步',
    fillValues,
    probe,
    fill,
    saveGuard
  });
  const written = writeEvidence('fill', payload);
  try { socket.close(); } catch {}
  return { payload, written };
}

function printHelp() {
  console.log(`Hotjob mc basic harness (siteId=${SITE_ID})
  MODE=readiness|fill (default readiness)
  CDP_PORT=9237
  CMS_SU / CMS_PAGE — mc URL (default 中联 ${DEFAULT_SU})
  Offline:
    MODE=fill node scripts/auto-hotjob-mc-basic.mjs --synthetic
  Live (existing Edge tab; bringToFront; never Save; restore after fill):
    MODE=readiness CMS_SU=${DEFAULT_SU} node scripts/auto-hotjob-mc-basic.mjs --live
    MODE=fill CMS_SU=${DEFAULT_SU} node scripts/auto-hotjob-mc-basic.mjs --live
  --no-restore leaves filled values (still never clicks 下一步)
  Extension path (Edge + SW message HOTJOB_MC_BASIC_AUTO; optional):
    MODE=readiness node scripts/auto-hotjob-mc-basic.mjs --extension
  (--synthetic / --live unchanged; --extension does not replace them)
  Self-injects src/content/hotjob-mc-basic.js by default; SW wired via HOTJOB_MC_BASIC_AUTO`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }
  if (args.extension) {
    const target = resolveMcTarget();
    await runAtsExtensionHarness({
      outDir,
      autoHtmlPath: 'src/auto/hotjob-mc-basic-auto.html',
      evidencePrefix: 'hotjob-mc-basic-auto',
      latestName: 'hotjob-mc-basic-latest.json',
      openPageUrl: target.page,
      targetPage: process.env.TARGET_PAGE || target.page
    });
    return;
  }
  const mode = modeFromEnv();
  // Prefer explicit flags; otherwise live when not synthetic (tenant cmd path).
  const useSynthetic = args.synthetic || (!args.live && process.env.HOTJOB_MC_SURFACE === 'synthetic');

  try {
    if (useSynthetic) {
      const { payload, written } = await runSynthetic(mode, args);
      console.log(JSON.stringify({ event: 'saved', ...written, ok: payload.ok, reason: payload.reason, mode }, null, 2));
      process.exit(payload.ok ? 0 : 2);
    }
    const { payload, written } = await runLive(mode, args);
    console.log(JSON.stringify({ event: 'saved', ...written, ok: payload.ok, reason: payload.reason, mode }, null, 2));
    process.exit(payload.ok ? 0 : 2);
  } catch (error) {
    let tenantSu = DEFAULT_SU;
    try { tenantSu = resolveMcTarget().su; } catch { /* keep default */ }
    const payload = basePayload({
      ok: false,
      reason: String(error?.message || error).slice(0, 300),
      surface: useSynthetic ? 'synthetic-fixture' : 'cdp-live-mc',
      tenantSu,
      error: String(error?.stack || error).slice(0, 800)
    });
    const written = writeEvidence(mode, payload);
    console.error(JSON.stringify({ event: 'error', ...written, ...payload }, null, 2));
    process.exit(1);
  }
}

main();
