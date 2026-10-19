#!/usr/bin/env node
// CMB (招商银行 career.cmbchina.com) basic harness (first slice).
// MODE=readiness|fill (default readiness). Never clicks 保存/提交/投递.
// CDP_PORT default 9237. Prefer --synthetic / FIXTURE offline fill — live resume needs logged-in /center/resume.
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
if (typeof globalThis.WebSocket === 'undefined') {
  const { default: WS } = await import('ws');
  globalThis.WebSocket = WS;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outDir = process.env.AUTO_RUNS_DIR
  ? path.resolve(process.env.AUTO_RUNS_DIR)
  : path.join(repoRoot, 'dist', 'auto-runs');
const scriptPath = path.join(repoRoot, 'src', 'content', 'cmb-basic.js');
const fixtureName = 'cmb-basic-form.html';
const SITE_ID = 'cmb';
/** Public CMB SPA shell; resume edit needs login session. */
const SAMPLE_PORTAL = process.env.CMB_PAGE || 'https://career.cmbchina.com/center/resume';

function stampIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/u, '').replace(/:/gu, '-');
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  const args = { synthetic: false, live: false, help: false, extension: false, only: null };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--synthetic') args.synthetic = true;
    else if (token === '--live') args.live = true;
    else if (token === '--extension') args.extension = true;
    else if (token === '--only') args.only = argv[++index] || '';
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
  const file = path.join(outDir, `cmb-basic-${kind}-${now}.json`);
  const latest = path.join(outDir, `cmb-basic-${kind}-latest.json`);
  return { file, latest };
}

function genderEvidencePaths(now = stampIso()) {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `cmb-gender-radio-${now}.json`);
  const latest = path.join(outDir, 'cmb-gender-radio-latest.json');
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
  const userData = fs.mkdtempSync(path.join('/tmp', 'cmb-'));
  const child = spawn(chromePath(), [
    '--headless=new',
    '--disable-gpu',
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

async function runSynthetic(mode) {
  const { server, port } = await startFixtureServer();
  const cdpPort = await freePort();
  let child;
  try {
    ({ child } = await launchChrome(cdpPort));
    const url = `http://127.0.0.1:${port}/${fixtureName}`;
    const { socket, send } = await attachPage(cdpPort, url);
    await injectScript(send);
    const probe = await evaluate(send, `ResumeCmbBasic.probeLabels({ synthetic: true })`);
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

    const fill = await evaluate(send, `ResumeCmbBasic.fillBasic({
      allowExplicitValues: true,
      fullName: '测试甲',
      mobile: '13800138000',
      email: 'cmb.fixture@example.com'
    }, { synthetic: true })`);

    const neighbor = await evaluate(send, `(() => {
      const item = [...document.querySelectorAll('.ant-form-item')].find((node) => {
        const label = node.querySelector('.ant-form-item-label, label');
        return label && /体重/.test(label.textContent || '');
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
      && neighbor?.value === '60'
      && saveClicks?.saveDisabled === true;

    const payload = basePayload({
      ok,
      reason: ok ? 'synthetic_fill_pass' : (fill?.reason || 'synthetic_fill_fail'),
      surface: 'synthetic-fixture',
      liveEdge: false,
      probe,
      fill,
      neighbor,
      saveGuard: saveClicks
    });
    const written = writeEvidence('fill', payload);
    socket.close();
    return { payload, written };
  } finally {
    try { child?.kill(); } catch {}
    try { server.close(); } catch {}
  }
}

async function runSyntheticGender() {
  const { server, port } = await startFixtureServer();
  const cdpPort = await freePort();
  let child;
  try {
    ({ child } = await launchChrome(cdpPort));
    const url = `http://127.0.0.1:${port}/${fixtureName}`;
    const { socket, send } = await attachPage(cdpPort, url);
    await injectScript(send);
    const refused = await evaluate(send, `ResumeCmbBasic.fillGender('男')`);
    const invalid = await evaluate(send, `ResumeCmbBasic.fillGender('未知', { synthetic: true })`);
    const female = await evaluate(send, `ResumeCmbBasic.fillGender('女', { synthetic: true })`);
    const male = await evaluate(send, `ResumeCmbBasic.fillGender('男', { synthetic: true })`);
    const basic = await evaluate(send, `ResumeCmbBasic.fillBasic({
      allowExplicitValues: true,
      fullName: '测试甲',
      mobile: '13800138000',
      email: 'cmb.fixture@example.com',
      gender: '女'
    }, { synthetic: true })`);
    const neighbor = await evaluate(send, `(() => {
      const norm = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
      const items = [...document.querySelectorAll('.ant-form-item')];
      const byLabel = (want) => items.find((item) => {
        const label = item.querySelector('.ant-form-item-label label, .ant-form-item-label');
        return label && norm(label.textContent) === want;
      });
      const checkedValues = (item) => [...(item?.querySelectorAll('input[type="radio"]') || [])]
        .filter((node) => node.checked)
        .map((node) => node.value);
      return {
        workedChecked: checkedValues(byLabel('是否参加过正式工作')),
        genderChecked: checkedValues(byLabel('性别')),
        weight: byLabel('体重')?.querySelector('input')?.value || null,
        saveDisabled: document.getElementById('save-btn')?.disabled === true,
        saveText: document.getElementById('save-btn')?.textContent || ''
      };
    })()`);

    const genderResult = basic?.results?.find((row) => row.label === '性别');
    const ok = refused?.reason === 'wrong_page'
      && refused?.ok === false
      && invalid?.reason === 'invalid_profile_value'
      && invalid?.ok === false
      && female?.ok === true
      && female?.after === '女'
      && female?.before === ''
      && male?.ok === true
      && male?.before === '女'
      && male?.after === '男'
      && basic?.ok === true
      && basic?.saved === false
      && basic?.skippedSave === true
      && basic?.results?.length === 4
      && genderResult?.ok === true
      && genderResult?.after === '女'
      && neighbor?.workedChecked?.length === 1
      && neighbor.workedChecked[0] === '否'
      && neighbor?.genderChecked?.length === 1
      && neighbor.genderChecked[0] === '女'
      && neighbor?.weight === '60'
      && neighbor?.saveDisabled === true
      && male?.saved === false
      && male?.skippedSave === true;

    const payload = basePayload({
      ok,
      reason: ok ? 'synthetic_gender_radio_pass' : 'synthetic_gender_radio_fail',
      surface: 'synthetic-fixture',
      liveEdge: false,
      formFillClaimed: false,
      liveRadioDomHarvested: false,
      fixture: 'synthetic-public-css-candidates',
      label: '性别',
      assumptions: [
        'label-scoped .ant-form-item',
        '.ant-radio-wrapper text is exactly 男 or 女',
        '.ant-radio wraps input[type=radio]',
        'readback is input.checked, not .ant-radio-checked',
        'shared radio name is a synthetic stand-in for single-select'
      ],
      refused,
      invalid,
      female,
      male,
      fillBasic: basic,
      neighbor
    });
    const { file, latest } = genderEvidencePaths();
    const json = JSON.stringify(payload, null, 2);
    fs.writeFileSync(file, json, 'utf8');
    fs.copyFileSync(file, latest);
    socket.close();
    return { payload, written: { file, latest } };
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
  const probe = await evaluate(send, `ResumeCmbBasic.probeLabels()`);
  const fp = probe?.fingerprint || {};
  const payload = basePayload({
    ok: fp.looksCmb === true,
    reason: probe?.foundCount >= 3
      ? 'live_labels_ready'
      : fp.looksCmb
        ? 'cmb_portal_login_walled_no_form'
        : (probe?.reason || 'live_probe_fail'),
    surface: 'cdp-live-portal',
    liveEdge: true,
    formFillClaimed: false,
    probe,
    blocker: 'Resume/edit DOM requires CMB login on /center/resume; first-slice fill validated offline only'
  });
  const written = writeEvidence('readiness', payload);
  try { socket.close(); } catch {}
  return { payload, written };
}

function printHelp() {
  console.log(`CMB basic harness (siteId=${SITE_ID})
  MODE=readiness|fill (default readiness)
  CDP_PORT=9237 (live readiness only)
  Prefer offline:
    MODE=fill node scripts/auto-cmb-basic.mjs --synthetic
    MODE=readiness node scripts/auto-cmb-basic.mjs --synthetic
    node scripts/auto-cmb-basic.mjs --only 性别
  Gender is offline synthetic only. Live radio DOM is not harvested.
  Live portal fingerprint only (no fill claim):
    MODE=readiness node scripts/auto-cmb-basic.mjs --live
    Extension path (Edge + SW message CMB_BASIC_AUTO):
    MODE=readiness node scripts/auto-cmb-basic.mjs --extension
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
    // SW/popup wiring deferred — this knife is offline scaffold only.
    const payload = basePayload({
      ok: false,
      reason: 'extension_path_not_wired_yet',
      surface: 'extension',
      liveEdge: false,
      formFillClaimed: false,
      hint: 'Use --synthetic; CMB_BASIC_AUTO / auto HTML not shipped in this offline knife'
    });
    const written = writeEvidence(modeFromEnv(), payload);
    console.log(JSON.stringify({ event: 'refused', ...written, ...payload }, null, 2));
    process.exit(3);
  }
  if (args.only != null && args.only !== '性别') {
    console.error('Only 性别 is in this knife. Other second-slice labels are not implemented.');
    process.exit(2);
  }
  if (args.only === '性别' && args.live && !args.synthetic) {
    const payload = basePayload({
      ok: false,
      reason: 'live_gender_radio_unharvested',
      surface: 'cdp',
      liveEdge: false,
      formFillClaimed: false,
      liveRadioDomHarvested: false,
      hint: 'Gender radio DOM was not harvested. Use --only 性别 without --live.'
    });
    const { file, latest } = genderEvidencePaths();
    fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
    fs.copyFileSync(file, latest);
    console.log(JSON.stringify({ event: 'refused', file, latest, ...payload }, null, 2));
    process.exit(3);
  }
  if (args.only === '性别') {
    try {
      const { payload, written } = await runSyntheticGender();
      console.log(JSON.stringify({
        event: 'saved',
        ...written,
        ok: payload.ok,
        reason: payload.reason,
        label: '性别'
      }, null, 2));
      process.exit(payload.ok ? 0 : 2);
    } catch (error) {
      const payload = basePayload({
        ok: false,
        reason: String(error?.message || error).slice(0, 300),
        surface: 'synthetic-fixture',
        liveEdge: false,
        formFillClaimed: false,
        error: String(error?.stack || error).slice(0, 800)
      });
      const { file, latest } = genderEvidencePaths();
      fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
      fs.copyFileSync(file, latest);
      console.error(JSON.stringify({ event: 'error', file, latest, ...payload }, null, 2));
      process.exit(1);
    }
  }

  const mode = modeFromEnv();
  // Default offline fixture. --live = portal readiness only. --synthetic always wins over --live.
  const useSynthetic = args.synthetic || (!args.live && process.env.CMB_SURFACE !== 'live');

  // Fill on live is refused — login wall; do not invent success.
  if (mode === 'fill' && args.live && !args.synthetic) {
    const payload = basePayload({
      ok: false,
      reason: 'live_fill_refused_login_wall',
      surface: 'cdp',
      liveEdge: false,
      formFillClaimed: false,
      hint: 'Use --synthetic for fill; live resume form needs Jeremy CMB login on /center/resume first'
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

    const { payload, written } = await runSynthetic(mode);
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
