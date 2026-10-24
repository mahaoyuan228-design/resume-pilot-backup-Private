#!/usr/bin/env node
// CITICS auto harness (merged):
// - Extension auto (legacy): no --only → opens citics-basic-auto.html via Edge (MODE=fill|readiness).
// - CDP select knife: --only 婚姻状况|政治面貌|户口类型|证件类型|民族 [--synthetic | --live]
// Default is fill-without-save. Never clicks 保存 / 提交 / 暂存. Never touches 易盾.
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
if (typeof globalThis.WebSocket === 'undefined') {
  const { default: WS } = await import('ws');
  globalThis.WebSocket = WS;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outDir = path.join(repoRoot, 'dist', 'auto-runs');
const ALLOWED_ONLY = Object.freeze(['婚姻状况', '政治面貌', '户口类型', '证件类型', '民族']);
const SELECT_FIXTURES = Object.freeze({
  '婚姻状况': {
    happy: 'citics-marital-select.html',
    double: 'citics-marital-select-double.html',
    badOptions: 'citics-marital-select-bad-options.html',
    noReadback: 'citics-marital-select-no-readback.html',
    before: '未婚',
    expectedDefault: '已婚',
    neighborLabel: '民族',
    neighborValue: '汉族',
    refuseLabel: '国籍',
    refuseValue: '中国'
  },
  '政治面貌': {
    happy: 'citics-political-select.html',
    double: 'citics-political-select-double.html',
    badOptions: 'citics-political-select-bad-options.html',
    noReadback: 'citics-political-select-no-readback.html',
    before: '群众',
    expectedDefault: '共青团员',
    neighborLabel: '民族',
    neighborValue: '汉族',
    refuseLabel: '国籍',
    refuseValue: '中国'
  },
  '户口类型': {
    happy: 'citics-hukou-type-select.html',
    double: 'citics-hukou-type-select-double.html',
    badOptions: 'citics-hukou-type-select-bad-options.html',
    noReadback: 'citics-hukou-type-select-no-readback.html',
    before: '家庭户口',
    expectedDefault: '集体户口',
    neighborLabel: '民族',
    neighborValue: '汉族',
    refuseLabel: '国籍',
    refuseValue: '中国'
  },
  '证件类型': {
    happy: 'citics-id-type-select.html',
    double: 'citics-id-type-select-double.html',
    badOptions: 'citics-id-type-select-bad-options.html',
    noReadback: 'citics-id-type-select-no-readback.html',
    before: '身份证',
    expectedDefault: '中国护照',
    neighborLabel: '民族',
    neighborValue: '汉族',
    refuseLabel: '国籍',
    refuseValue: '中国'
  },
  '民族': {
    happy: 'citics-ethnicity-select.html',
    double: 'citics-ethnicity-select-double.html',
    badOptions: 'citics-ethnicity-select-bad-options.html',
    noReadback: 'citics-ethnicity-select-no-readback.html',
    before: '汉族',
    expectedDefault: '回族',
    neighborLabel: '证件类型',
    neighborValue: '身份证',
    refuseLabel: '国籍',
    refuseValue: '中国'
  }
});
const scriptPath = path.join(repoRoot, 'src', 'content', 'citics-basic.js');

function stampIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/u, '').replace(/:/gu, '-');
}

function stampLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function pause(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  const args = { only: null, synthetic: false, live: false, help: false, extension: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--only') args.only = argv[++index] ?? '';
    else if (token === '--synthetic') args.synthetic = true;
    else if (token === '--live') args.live = true;
    else if (token === '--extension') args.extension = true;
    else if (token === '--help') args.help = true;
  }
  return args;
}

function evidencePaths(label, now = stampIso()) {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `citics-ant-select-${label}-${now}.json`);
  const latest = path.join(outDir, `citics-ant-select-${label}-latest.json`);
  return { file, latest };
}

function writeEvidence(payload) {
  const label = payload.label || '未知';
  const { file, latest } = evidencePaths(label);
  const json = JSON.stringify(payload, null, 2);
  fs.writeFileSync(file, json, 'utf8');
  fs.copyFileSync(file, latest);
  return { file, latest };
}

function requiredShape(label, partial) {
  return {
    siteId: 'citics',
    label,
    ok: false,
    reason: null,
    before: null,
    after: null,
    expected: null,
    saved: false,
    skippedSave: true,
    skippedYidun: true,
    clickedOption: false,
    liveEdge: false,
    surface: null,
    structure: null,
    selectors: [],
    at: new Date().toISOString(),
    ...partial,
    saved: false,
    skippedSave: true,
    skippedYidun: true
  };
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


// Test-only package assets. Never copied into an extension product allowlist.
const CITICS_TEST_ASSETS = Object.freeze([
  { route: '/__citics_assets__/vue-2.7.16.js', package: 'vue', version: '2.7.16', file: 'dist/vue.js',
    size: 434871, sri: 'sha256-NrENO0kgWSpOwmwGTEKemj37RokjX9/JHhc2toHHZ4Y=', type: 'text/javascript; charset=utf-8' },
  { route: '/__citics_assets__/antd-1.7.8.js', package: 'ant-design-vue', version: '1.7.8', file: 'dist/antd.min.js',
    size: 1478243, sri: 'sha256-sNYD2f64gxJnB1zDymg4tebiJiE9cu1dcCFZu12i/+8=', type: 'text/javascript; charset=utf-8' },
  { route: '/__citics_assets__/antd-1.7.8.css', package: 'ant-design-vue', version: '1.7.8', file: 'dist/antd.min.css',
    size: 468534, sri: 'sha256-qmgRsNEN3Vze7Yad4+kDnTdst3Cmpy9BnaWWo72E9Rc=', type: 'text/css; charset=utf-8' }
].map(spec => Object.freeze(spec)));
const CITICS_TEST_PACKAGES = Object.freeze({
  vue: { version: '2.7.16', resolved: 'https://registry.npmjs.org/vue/-/vue-2.7.16.tgz',
    integrity: 'sha512-4gCtFXaAA3zYZdTp5s4Hl2sozuySsgz4jy1EnpBHNfpMa9dK1ZCG7viqBPCwXtmgc8nHqUsAu3G4gtmXkkY3Sw==' },
  'ant-design-vue': { version: '1.7.8', resolved: 'https://registry.npmjs.org/ant-design-vue/-/ant-design-vue-1.7.8.tgz',
    integrity: 'sha512-F1hmiS9vwbyfuFvlamdW5l9bHKqRlj9wHaGDIE41NZMWXyWy8qL0UFa/+I0Wl8gQWZCqODW5pN6Yfoyn85At3A==' }
});
function loadCiticsFixtureAssets(readFile = fs.readFileSync) {
  const json = relative => {
    try { return JSON.parse(readFile(path.join(repoRoot, relative), 'utf8')); }
    catch { throw new Error('fixture_asset_metadata_unavailable'); }
  };
  const lock = json('package-lock.json');
  for (const [name, expected] of Object.entries(CITICS_TEST_PACKAGES)) {
    const installed = json(`node_modules/${name}/package.json`);
    if (installed.version !== expected.version || installed.license !== 'MIT') throw new Error('fixture_asset_package_mismatch');
    const entry = lock.packages?.[`node_modules/${name}`];
    if (!entry || entry.version !== expected.version || entry.resolved !== expected.resolved || entry.integrity !== expected.integrity) {
      throw new Error('fixture_asset_lock_mismatch');
    }
  }
  if (json('node_modules/vue-template-compiler/package.json').version !== '2.7.16' ||
      lock.packages?.['node_modules/vue-template-compiler']?.version !== '2.7.16') {
    throw new Error('fixture_asset_compiler_mismatch');
  }
  const assets = new Map();
  for (const spec of CITICS_TEST_ASSETS) {
    let body;
    try { body = readFile(path.join(repoRoot, 'node_modules', spec.package, spec.file)); }
    catch { throw new Error('fixture_asset_content_unavailable'); }
    if (!Buffer.isBuffer(body) || body.length !== spec.size ||
        'sha256-' + createHash('sha256').update(body).digest('base64') !== spec.sri) throw new Error('fixture_asset_content_mismatch');
    assets.set(spec.route, { type: spec.type, body });
  }
  return assets;
}

function startFixtureServer() {
  const assets = loadCiticsFixtureAssets(); // Fail before opening a server or launching Chrome.
  const root = path.join(repoRoot, 'tests', 'fixtures');
  const server = http.createServer((req, res) => {
    const asset = assets.get(req.url);
    if (asset) {
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end('method_not_allowed'); return; }
      res.writeHead(200, { 'content-type': asset.type, 'content-length': asset.body.length, 'cache-control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : asset.body);
      return;
    }
    if ((req.url || '').startsWith('/__citics_assets__/')) { res.writeHead(404); res.end('missing'); return; }
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

async function waitFor(fn, ms) {
  const started = Date.now();
  let error;
  while (Date.now() - started < ms) {
    try {
      return await fn();
    } catch (caught) {
      error = caught;
      await pause(100);
    }
  }
  throw error || new Error('timeout');
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
  return candidates.find(candidate => fs.existsSync(candidate)) || 'google-chrome';
}

async function launchChrome(port) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'citics-select-'));
  const child = spawn(chromePath(), [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--window-size=1280,800',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userData}`,
    'about:blank'
  ], { stdio: 'ignore' });
  await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`);
    if (!response.ok) throw new Error('cdp_unavailable');
    return response.json();
  }, 15000);
  return {
    child,
    userData,
    async close() {
      child.kill('SIGKILL');
      await pause(100);
      fs.rmSync(userData, { recursive: true, force: true });
    }
  };
}

function connectSocket(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  const waiters = [];
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
      return;
    }
    for (const waiter of [...waiters]) {
      if (waiter.method === message.method) {
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.resolve(message.params || {});
      }
    }
  });
  function send(method, params = {}) {
    const msgId = ++id;
    return new Promise((resolve, reject) => {
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }
  function waitEvent(method, ms = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout_${method}`)), ms);
      waiters.push({
        method,
        resolve: params => {
          clearTimeout(timer);
          resolve(params);
        }
      });
    });
  }
  return new Promise((resolve, reject) => {
    ws.addEventListener('open', () => resolve({ ws, send, waitEvent }));
    ws.addEventListener('error', reject);
  });
}

async function pageSocket(port, predicate) {
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
  const matches = pages.filter(page => page.type === 'page' && predicate(page));
  if (matches.length !== 1) {
    return { ok: false, reason: matches.length ? 'tab_not_unique' : 'citics_tab_missing', tabs: pages.filter(page => page.type === 'page').map(page => page.url) };
  }
  const socket = await connectSocket(matches[0].webSocketDebuggerUrl);
  return { ok: true, socket, url: matches[0].url };
}

async function evaluate(send, expression, awaitPromise = false) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
    userGesture: true
  });
  if (result.exceptionDetails) {
    const text = result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'evaluate_failed';
    throw new Error(text);
  }
  return result.result?.value;
}

async function injectAndFill(send, { label, expected, synthetic, restore, pickAlternate }) {
  const source = fs.readFileSync(scriptPath, 'utf8');
  await evaluate(send, source, false);
  await evaluate(send, `document.addEventListener('click', event => {
    const node = event.target && event.target.closest ? event.target.closest('button, a') : null;
    const text = (node && node.textContent || '').replace(/\\s+/g, '');
    if (node && /保存|提交|暂存/.test(text)) window.__citicsCommitClicks = (window.__citicsCommitClicks || 0) + 1;
  }, true);`, false);
  const call = `ResumeCiticsBasic.fillSelect(${JSON.stringify(label)}, ${expected == null ? 'null' : JSON.stringify(expected)}, ${JSON.stringify({
    synthetic,
    restore: restore === true,
    pickAlternate: pickAlternate === true
  })})`;
  const result = await evaluate(send, call, true);
  const commitClicks = await evaluate(send, 'window.__citicsCommitClicks || 0', false);
  const weirdClicks = await evaluate(send, 'window.__weirdClicks || 0', false);
  const opened = await evaluate(send, 'window.__opened || 0', false);
  return { result, commitClicks, weirdClicks, opened };
}

function assertEvidence(payload, label) {
  const missing = ['siteId', 'label', 'ok', 'before', 'after', 'expected', 'saved', 'skippedSave', 'skippedYidun', 'structure', 'selectors']
    .filter(key => !(key in payload));
  if (missing.length) throw new Error(`evidence_missing_${missing.join('_')}`);
  if (payload.siteId !== 'citics' || payload.label !== label) throw new Error('evidence_identity');
  if (payload.saved !== false || payload.skippedSave !== true || payload.skippedYidun !== true) throw new Error('evidence_save_flag');
  if (payload.ok === true && payload.after !== payload.expected) throw new Error('evidence_readback');
}

async function runSynthetic(label, expected) {
  const fixture = SELECT_FIXTURES[label];
  if (!fixture) throw new Error('unknown_select_label');
  const cdpPort = await freePort();
  const { server } = await startFixtureServer();
  const chrome = await launchChrome(cdpPort);
  const checks = [];
  try {
    const attached = await pageSocket(cdpPort, page => page.type === 'page');
    if (!attached.ok) throw new Error(attached.reason || 'citics_tab_missing');
    const { send, waitEvent } = attached.socket;
    await send('Page.enable');
    await send('Runtime.enable');
    const base = `http://127.0.0.1:${server.address().port}`;
    const cases = [
      ['happy', `${base}/${fixture.happy}`, expected, true],
      ['double-select', `${base}/${fixture.double}`, expected, false],
      ['option-selector-miss', `${base}/${fixture.badOptions}`, expected, false],
      ['readback-missing', `${base}/${fixture.noReadback}`, expected, false]
    ];
    let happy = null;
    for (const [name, url, value, restore] of cases) {
      const loaded = waitEvent('Page.loadEventFired', 20000);
      await send('Page.navigate', { url });
      await loaded;
      if (name === 'happy') {
        await waitFor(async () => {
          const text = await evaluate(send, `document.querySelector('.ant-select-selection-selected-value')?.textContent || ''`, false);
          if (text.replace(/\s+/g, '') !== fixture.before) throw new Error('fixture_not_ready');
          return text;
        }, 45000);
      } else {
        await pause(150);
      }
      const filled = await injectAndFill(send, { label, expected: value, synthetic: true, restore, pickAlternate: false });
      const row = filled.result || {};
      if (name === 'happy') {
        const neighborExpr = `[...document.querySelectorAll('.ant-form-item')].map(item => item.innerText).find(text => text.includes(${JSON.stringify(fixture.neighborLabel)})) || ''`;
        const neighbor = await evaluate(send, neighborExpr, false);
        happy = requiredShape(label, {
          ...row,
          liveEdge: false,
          surface: 'synthetic-ant-design-vue-1',
          commitClicks: filled.commitClicks,
          checks
        });
        checks.push({
          name: 'happy',
          ok: row.ok === true && row.after === value && row.before === fixture.before && row.final === fixture.before && row.restored === true && filled.commitClicks === 0 && String(neighbor).includes(fixture.neighborValue),
          reason: row.reason,
          before: row.before,
          after: row.after,
          final: row.final
        });
      } else if (name === 'double-select') {
        checks.push({ name, ok: row.ok === false && row.reason === 'select_structure_unexpected' && row.clickedOption === false, reason: row.reason, clickedOption: row.clickedOption });
      } else if (name === 'option-selector-miss') {
        checks.push({
          name,
          ok: row.ok === false && row.reason === 'select_option_selector_missing' && row.clickedOption === false && filled.weirdClicks === 0,
          reason: row.reason,
          clickedOption: row.clickedOption,
          weirdClicks: filled.weirdClicks
        });
      } else if (name === 'readback-missing') {
        checks.push({
          name,
          ok: row.ok === false && row.reason === 'select_readback_missing' && row.clickedOption === false && filled.opened === 0,
          reason: row.reason,
          clickedOption: row.clickedOption,
          opened: filled.opened
        });
      }
    }
    const refused = await evaluate(attached.socket.send, `ResumeCiticsBasic.fillSelect(${JSON.stringify(fixture.refuseLabel)}, ${JSON.stringify(fixture.refuseValue)}, { synthetic: true })`, true);
    checks.push({ name: 'other-label-refused', ok: refused?.reason === 'label_not_allowed' && refused.clickedOption === false, reason: refused?.reason });
    if (!happy) throw new Error('synthetic_happy_missing');
    happy.ok = happy.ok === true && checks.every(check => check.ok === true);
    if (!happy.ok) happy.reason = checks.find(check => check.ok !== true)?.reason || happy.reason || 'synthetic_check_failed';
    assertEvidence(happy, label);
    return happy;
  } finally {
    await chrome.close();
    await new Promise(resolve => server.close(resolve));
  }
}

async function runLive(port, label, expected) {
  const version = await fetch(`http://127.0.0.1:${port}/json/version`);
  if (!version.ok) throw new Error('cdp_unavailable');
  const attached = await pageSocket(port, page => {
    try {
      const url = new URL(page.url);
      return url.protocol === 'https:' && url.hostname === 'careers.citics.com' && url.pathname === '/my/jl';
    } catch {
      return false;
    }
  });
  if (!attached.ok) {
    return requiredShape(label, { reason: attached.reason, liveEdge: false, surface: 'cdp', structure: { tabs: attached.tabs || [] }, selectors: [] });
  }
  const { send } = attached.socket;
  await send('Runtime.enable');
  try { await send('Page.enable'); await send('Page.bringToFront'); } catch {}
  const explicit = expected != null && expected !== '';
  const filled = await injectAndFill(send, {
    label,
    expected: explicit ? expected : null,
    synthetic: false,
    restore: process.env.CITICS_RESTORE !== '0',
    pickAlternate: !explicit
  });
  const row = filled.result || {};
  const payload = requiredShape(label, {
    ...row,
    liveEdge: true,
    surface: 'careers.citics.com',
    commitClicks: filled.commitClicks,
    cdpPort: port
  });
  if (filled.commitClicks > 0) {
    payload.ok = false;
    payload.reason = 'commit_click_observed';
  }
  assertEvidence(payload, label);
  return payload;
}

async function runSelectKnife(args) {
  if (['学历', '学位', '学历/学位'].includes(args.only)) {
    const payload = {
      ok: false,
      siteId: 'citics',
      label: args.only,
      reason: args.only === '学位' ? 'live_degree_options_unharvested' : 'live_education_options_unharvested',
      saved: false,
      skippedSave: true,
      neverSave: true,
      leftUnsaved: true,
      softwareClickedSave: false,
      softwareClickedSubmit: false,
      softwareClickedNext: false,
      softwareClickedDeliver: false,
      softwareClickedDelete: false,
      writeAttempted: false,
      formFillClaimed: false,
      liveSupportClaimed: false,
      supportClaimed: false,
      liveEdge: false,
      optionsHarvested: false,
      optionCount: 0,
      syntheticDom: false,
      hint: '须 live 采选项后才能接线。仓内没有中信学历/学位选项全文，不编造 DOM。'
    };
    console.log(JSON.stringify(payload, null, 2));
    process.exit(3);
  }
  if (args.help || !ALLOWED_ONLY.includes(args.only)) {
    console.error('Usage: node scripts/auto-citics-basic.mjs --only 婚姻状况|政治面貌|户口类型|证件类型|民族 [--synthetic | --live]');
    console.error('学历 / 学历/学位 refuses live_education_options_unharvested; 学位 refuses live_degree_options_unharvested before CDP. No invented options.');
    console.error('Legacy extension harness: node scripts/auto-citics-basic.mjs --extension   (or omit --only)');
    process.exit(args.help ? 0 : 2);
  }
  const label = args.only;
  const fixture = SELECT_FIXTURES[label];
  const expected = process.env.CITICS_EXPECT || (args.synthetic ? fixture.expectedDefault : null);
  try {
    const payload = args.synthetic
      ? await runSynthetic(label, expected)
      : await runLive(Number.parseInt(process.env.CDP_PORT || '9237', 10), label, expected);
    const written = writeEvidence(payload);
    console.log(JSON.stringify({ event: 'saved', ...written, ok: payload.ok === true, reason: payload.reason, before: payload.before, after: payload.after, expected: payload.expected, liveEdge: payload.liveEdge }, null, 2));
    process.exit(payload.ok === true ? 0 : 2);
  } catch (error) {
    const payload = requiredShape(label, {
      reason: String(error?.message || error).slice(0, 300),
      surface: args.synthetic ? 'synthetic-ant-design-vue-1' : 'cdp',
      structure: { error: String(error?.stack || error).slice(0, 800) }
    });
    const written = writeEvidence(payload);
    console.error(JSON.stringify({ event: 'error', ...written, ...payload }, null, 2));
    process.exit(1);
  }
}

/** Legacy: extension auto HTML (MODE=fill|readiness). Preserved from pre-PR live tree. */
async function runExtensionHarness() {
  const EXT_ID = process.env.RESUME_EXT_ID || 'hhembhoojafdefnkonmgoejfedgloanc';
  const mode = process.env.MODE || 'fill';
  const openPage = (process.env.OPEN_CITICS_PAGE || '1') !== '0';
  const openIfMissing = (process.env.OPEN_IF_MISSING || '1') !== '0';
  const timeoutMs = Number.parseInt(process.env.AUTO_TIMEOUT_MS || '180000', 10);
  const skipReload = process.env.SKIP_RELOAD === '1';
  const CITICS_PAGE = process.env.CITICS_PAGE
    || 'https://careers.citics.com/my/jl?resumeType=0&type=edit&name=xiaozhao-cn';

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

  fs.mkdirSync(outDir, { recursive: true });
  const { server, port, resultPromise, rejectResult } = await startServer();
  const timer = setTimeout(() => {
    rejectResult(new Error(`auto_citics_basic_timeout_${timeoutMs}`));
    try { server.close(); } catch {}
  }, timeoutMs);

  try {
    if (openPage) {
      console.log(JSON.stringify({ event: 'open_citics_page', url: CITICS_PAGE }));
      openEdge(CITICS_PAGE);
      await wait(3500);
    }
    if (!skipReload) {
      const reloadUrl = `chrome-extension://${EXT_ID}/src/auto/citics-basic-auto.html?mode=reload&reportPort=${port}`;
      console.log(JSON.stringify({ event: 'open_reload', reloadUrl }));
      openEdge(reloadUrl);
      await wait(4500);
    }
    const qs = new URLSearchParams({
      mode,
      openIfMissing: openIfMissing ? '1' : '0',
      reportPort: String(port)
    });
    const autoUrl = `chrome-extension://${EXT_ID}/src/auto/citics-basic-auto.html?${qs}`;
    console.log(JSON.stringify({ event: 'open_auto', autoUrl, mode, extId: EXT_ID }));
    openEdge(autoUrl);

    const { body } = await resultPromise;
    clearTimeout(timer);
    const file = path.join(outDir, `citics-basic-auto-${stampLocal()}.json`);
    fs.writeFileSync(file, JSON.stringify(body, null, 2), 'utf8');
    const latest = path.join(outDir, 'citics-basic-latest.json');
    fs.writeFileSync(latest, JSON.stringify(body, null, 2), 'utf8');
    fs.writeFileSync(path.join(outDir, 'latest-citics-basic.json'), JSON.stringify(body, null, 2), 'utf8');
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
      note: body?.reason === 'extension_reload_required'
        ? 'await_extension_reload'
        : undefined
    }, null, 2));
    try { server.close(); } catch {}
    process.exit(body?.ok ? 0 : 2);
  } catch (error) {
    clearTimeout(timer);
    const file = path.join(outDir, `citics-basic-auto-${stampLocal()}-error.json`);
    const payload = { ok: false, reason: String(error?.message || error), at: new Date().toISOString() };
    fs.writeFileSync(file, JSON.stringify(payload, null, 2));
    fs.writeFileSync(path.join(outDir, 'citics-basic-latest.json'), JSON.stringify(payload, null, 2));
    console.error(JSON.stringify({ event: 'error', file, ...payload }, null, 2));
    try { server.close(); } catch {}
    process.exit(1);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const wantsSelect = args.only != null || args.synthetic || args.live;
  if (args.help && !wantsSelect && !args.extension) {
    console.error('Usage:');
    console.error('  node scripts/auto-citics-basic.mjs --only 婚姻状况|政治面貌|户口类型|证件类型|民族 [--synthetic | --live]');
    console.error('  学历 / 学历/学位 refuses live_education_options_unharvested; 学位 refuses live_degree_options_unharvested before CDP. No invented options.');
    console.error('  node scripts/auto-citics-basic.mjs --extension   # legacy extension auto HTML');
    console.error('  (no --only) also runs legacy extension harness');
    process.exit(0);
  }
  if (wantsSelect) {
    await runSelectKnife(args);
    return;
  }
  await runExtensionHarness();
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await main();

export { requiredShape, writeEvidence, ALLOWED_ONLY, SELECT_FIXTURES, CITICS_TEST_ASSETS,
  loadCiticsFixtureAssets, startFixtureServer, injectAndFill, assertEvidence };
