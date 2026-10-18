#!/usr/bin/env node
// Dedicated CITICS run: Ant Select fill + readback for 婚姻状况 only.
// Default is fill-without-save. Never clicks 保存 / 提交 / 暂存. Never touches 易盾.
//
// Live (trial Edge CDP, usually 9237):
//   node scripts/auto-citics-basic.mjs --only 婚姻状况
// Synthetic Ant Design Vue 1 fixture (no Edge session):
//   node scripts/auto-citics-basic.mjs --only 婚姻状况 --synthetic
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outDir = path.join(repoRoot, 'dist', 'auto-runs');
const ONLY = '婚姻状况';
const scriptPath = path.join(repoRoot, 'src', 'content', 'citics-basic.js');

function stamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/u, '').replace(/:/gu, '-');
}

function pause(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  const args = { only: null, synthetic: false, live: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--only') args.only = argv[++index] ?? '';
    else if (token === '--synthetic') args.synthetic = true;
    else if (token === '--live') args.live = true;
    else if (token === '--help') args.help = true;
  }
  return args;
}

function evidencePaths(now = stamp()) {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `citics-ant-select-${ONLY}-${now}.json`);
  const latest = path.join(outDir, `citics-ant-select-${ONLY}-latest.json`);
  return { file, latest };
}

function writeEvidence(payload) {
  const { file, latest } = evidencePaths();
  const json = JSON.stringify(payload, null, 2);
  fs.writeFileSync(file, json, 'utf8');
  fs.copyFileSync(file, latest);
  return { file, latest };
}

function requiredShape(partial) {
  return {
    siteId: 'citics',
    label: ONLY,
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
  const candidates = [process.env.CHROME_PATH, process.env.EDGE_PATH, '/usr/local/bin/google-chrome', '/usr/bin/google-chrome'].filter(Boolean);
  return candidates.find(candidate => fs.existsSync(candidate)) || 'google-chrome';
}

async function launchChrome(port) {
  const userData = fs.mkdtempSync(path.join('/tmp', 'citics-select-'));
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

async function injectAndFill(send, { expected, synthetic, restore, pickAlternate }) {
  const source = fs.readFileSync(scriptPath, 'utf8');
  await evaluate(send, source, false);
  await evaluate(send, `document.addEventListener('click', event => {
    const node = event.target && event.target.closest ? event.target.closest('button, a') : null;
    const text = (node && node.textContent || '').replace(/\\s+/g, '');
    if (node && /保存|提交|暂存/.test(text)) window.__citicsCommitClicks = (window.__citicsCommitClicks || 0) + 1;
  }, true);`, false);
  const call = `ResumeCiticsBasic.fillSelect(${JSON.stringify(ONLY)}, ${expected == null ? 'null' : JSON.stringify(expected)}, ${JSON.stringify({
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

function assertEvidence(payload) {
  const missing = ['siteId', 'label', 'ok', 'before', 'after', 'expected', 'saved', 'skippedSave', 'skippedYidun', 'structure', 'selectors']
    .filter(key => !(key in payload));
  if (missing.length) throw new Error(`evidence_missing_${missing.join('_')}`);
  if (payload.siteId !== 'citics' || payload.label !== ONLY) throw new Error('evidence_identity');
  if (payload.saved !== false || payload.skippedSave !== true || payload.skippedYidun !== true) throw new Error('evidence_save_flag');
  if (payload.ok === true && payload.after !== payload.expected) throw new Error('evidence_readback');
}

async function runSynthetic(expected) {
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
    const cases = [
      ['happy', `http://127.0.0.1:${server.address().port}/citics-marital-select.html`, expected, true],
      ['double-select', `http://127.0.0.1:${server.address().port}/citics-marital-select-double.html`, '已婚', false],
      ['option-selector-miss', `http://127.0.0.1:${server.address().port}/citics-marital-select-bad-options.html`, '已婚', false],
      ['readback-missing', `http://127.0.0.1:${server.address().port}/citics-marital-select-no-readback.html`, '已婚', false]
    ];
    let happy = null;
    for (const [name, url, value, restore] of cases) {
      const loaded = waitEvent('Page.loadEventFired', 20000);
      await send('Page.navigate', { url });
      await loaded;
      if (name === 'happy') {
        await waitFor(async () => {
          const text = await evaluate(send, `document.querySelector('.ant-select-selection-selected-value')?.textContent || ''`, false);
          if (text.replace(/\s+/g, '') !== '未婚') throw new Error('fixture_not_ready');
          return text;
        }, 45000);
      } else {
        await pause(150);
      }
      const filled = await injectAndFill(send, { expected: value, synthetic: true, restore, pickAlternate: false });
      const row = filled.result || {};
      if (name === 'happy') {
        const nation = await evaluate(send, `[...document.querySelectorAll('.ant-form-item')].map(item => item.innerText).find(text => text.includes('民族')) || ''`, false);
        happy = requiredShape({
          ...row,
          liveEdge: false,
          surface: 'synthetic-ant-design-vue-1',
          commitClicks: filled.commitClicks,
          checks
        });
        checks.push({
          name: 'happy',
          ok: row.ok === true && row.after === value && row.before === '未婚' && row.final === '未婚' && row.restored === true && filled.commitClicks === 0 && String(nation).includes('汉族'),
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
    const refused = await evaluate(attached.socket.send, `ResumeCiticsBasic.fillSelect('民族', '汉族', { synthetic: true })`, true);
    checks.push({ name: 'other-label-refused', ok: refused?.reason === 'label_not_allowed' && refused.clickedOption === false, reason: refused?.reason });
    if (!happy) throw new Error('synthetic_happy_missing');
    happy.ok = happy.ok === true && checks.every(check => check.ok === true);
    if (!happy.ok) happy.reason = checks.find(check => check.ok !== true)?.reason || happy.reason || 'synthetic_check_failed';
    assertEvidence(happy);
    return happy;
  } finally {
    await chrome.close();
    await new Promise(resolve => server.close(resolve));
  }
}

async function runLive(port, expected) {
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
    return requiredShape({ reason: attached.reason, liveEdge: false, surface: 'cdp', structure: { tabs: attached.tabs || [] }, selectors: [] });
  }
  const { send } = attached.socket;
  await send('Runtime.enable');
  const explicit = expected != null && expected !== '';
  const filled = await injectAndFill(send, {
    expected: explicit ? expected : null,
    synthetic: false,
    restore: process.env.CITICS_RESTORE !== '0',
    pickAlternate: !explicit
  });
  const row = filled.result || {};
  const payload = requiredShape({
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
  assertEvidence(payload);
  return payload;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.only !== ONLY) {
    console.error('Usage: node scripts/auto-citics-basic.mjs --only 婚姻状况 [--synthetic | --live]');
    process.exit(args.help ? 0 : 2);
  }
  const expected = process.env.CITICS_EXPECT || (args.synthetic ? '已婚' : null);
  try {
    const payload = args.synthetic
      ? await runSynthetic(expected)
      : await runLive(Number.parseInt(process.env.CDP_PORT || '9237', 10), expected);
    const written = writeEvidence(payload);
    console.log(JSON.stringify({ event: 'saved', ...written, ok: payload.ok === true, reason: payload.reason, before: payload.before, after: payload.after, expected: payload.expected, liveEdge: payload.liveEdge }, null, 2));
    process.exit(payload.ok === true ? 0 : 2);
  } catch (error) {
    const payload = requiredShape({
      reason: String(error?.message || error).slice(0, 300),
      surface: args.synthetic ? 'synthetic-ant-design-vue-1' : 'cdp',
      structure: { error: String(error?.stack || error).slice(0, 800) }
    });
    const written = writeEvidence(payload);
    console.error(JSON.stringify({ event: 'error', ...written, ...payload }, null, 2));
    process.exit(1);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await main();

export { requiredShape, writeEvidence, ONLY };
