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
import { isCmbHeightLabel, isCmbWeightLabel } from '../src/content/cmb-profile-map.mjs';
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

function heightEvidencePaths(now = stampIso()) {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `cmb-height-text-${now}.json`);
  const latest = path.join(outDir, 'cmb-height-text-latest.json');
  return { file, latest };
}

function weightEvidencePaths(now = stampIso()) {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `cmb-weight-text-${now}.json`);
  const latest = path.join(outDir, 'cmb-weight-text-latest.json');
  return { file, latest };
}

function formalWorkEvidencePaths(now = stampIso()) {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `cmb-formal-work-radio-${now}.json`);
  const latest = path.join(outDir, 'cmb-formal-work-radio-latest.json');
  return { file, latest };
}

function onlyKind(value) {
  const text = String(value ?? '').replace(/[\s\u00a0]+/gu, ' ').trim();
  if (text === '性别') return 'gender';
  if (text === '是否参加过正式工作') return 'formalWork';
  if (isCmbHeightLabel(text)) return 'height';
  if (isCmbWeightLabel(text)) return 'weight';
  return '';
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
        weight: items.find((item) => {
          const label = item.querySelector('.ant-form-item-label label, .ant-form-item-label');
          return label && /^体重(?:\\s*(?:[（(]\\s*)?kg(?:\\s*[）)])?)?$/iu.test(norm(label.textContent));
        })?.querySelector('input')?.value || null,
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

async function runSyntheticHeight() {
  const { server, port } = await startFixtureServer();
  const cdpPort = await freePort();
  let child;
  try {
    ({ child } = await launchChrome(cdpPort));
    const url = `http://127.0.0.1:${port}/${fixtureName}`;
    const { socket, send } = await attachPage(cdpPort, url);
    await injectScript(send);
    const refused = await evaluate(send, `ResumeCmbBasic.fillHeight('175')`);
    const invalid = await evaluate(send, `ResumeCmbBasic.fillHeight('175CM', { synthetic: true })`);
    const explicitInvalid = await evaluate(send, `ResumeCmbBasic.fillBasic({
      allowExplicitValues: true,
      fullName: '测试甲',
      mobile: '13800138000',
      email: 'cmb.fixture@example.com',
      height: '175 CM'
    }, { synthetic: true })`);
    const afterReject = await evaluate(send, `(() => {
      const norm = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
      const items = [...document.querySelectorAll('.ant-form-item')];
      const labelOf = (item) => {
        const label = item.querySelector('.ant-form-item-label label, .ant-form-item-label');
        return norm(label?.textContent || '');
      };
      const byText = (want) => items.find((item) => labelOf(item) === want);
      const heightItem = items.find((item) => /^身高(?:\\s*(?:[（(]\\s*)?cm(?:\\s*[）)])?)?$/iu.test(labelOf(item)));
      return {
        height: heightItem?.querySelector('input')?.value ?? null,
        name: byText('姓名')?.querySelector('input')?.value ?? null,
        weight: items.find((item) => /^体重(?:\\s*(?:[（(]\\s*)?kg(?:\\s*[）)])?)?$/iu.test(labelOf(item)))?.querySelector('input')?.value ?? null
      };
    })()`);
    const planReady = await evaluate(send, `ResumeCmbBasic.planFromProfile({
      fullName: '测试甲',
      phone: '13800138000',
      email: 'cmb.fixture@example.com',
      height: ' 182 ',
      confirmedFields: ['fullName', 'phone', 'email', 'height']
    })`);
    const planUnit = await evaluate(send, `ResumeCmbBasic.planFromProfile({
      fullName: '测试甲',
      phone: '13800138000',
      email: 'cmb.fixture@example.com',
      height: '175CM',
      confirmedFields: ['fullName', 'phone', 'email', 'height']
    })`);
    const first = await evaluate(send, `ResumeCmbBasic.fillHeight('175', { synthetic: true })`);
    const second = await evaluate(send, `ResumeCmbBasic.fillHeight('182', { synthetic: true })`);
    const decimal = await evaluate(send, `ResumeCmbBasic.fillHeight('180.5', { synthetic: true })`);
    const basic = await evaluate(send, `ResumeCmbBasic.fillBasic({
      allowExplicitValues: true,
      fullName: '测试甲',
      mobile: '13800138000',
      email: 'cmb.fixture@example.com',
      height: '175'
    }, { synthetic: true })`);
    const neighbor = await evaluate(send, `(() => {
      const norm = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
      const items = [...document.querySelectorAll('.ant-form-item')];
      const labelOf = (item) => {
        const label = item.querySelector('.ant-form-item-label label, .ant-form-item-label');
        return norm(label?.textContent || '');
      };
      const byText = (want) => items.find((item) => labelOf(item) === want);
      const heightItem = items.find((item) => /^身高(?:\\s*(?:[（(]\\s*)?cm(?:\\s*[）)])?)?$/iu.test(labelOf(item)));
      const checkedValues = (item) => [...(item?.querySelectorAll('input[type="radio"]') || [])]
        .filter((node) => node.checked)
        .map((node) => node.value);
      const heightValue = heightItem?.querySelector('input')?.value ?? null;
      return {
        workedChecked: checkedValues(byText('是否参加过正式工作')),
        genderChecked: checkedValues(byText('性别')),
        weight: items.find((item) => /^体重(?:\\s*(?:[（(]\\s*)?kg(?:\\s*[）)])?)?$/iu.test(labelOf(item)))?.querySelector('input')?.value || null,
        height: heightValue,
        heightHasUnit: /cm/iu.test(String(heightValue ?? '')),
        heightSuffix: heightItem?.querySelector('[data-unit]')?.textContent || '',
        saveDisabled: document.getElementById('save-btn')?.disabled === true,
        saveText: document.getElementById('save-btn')?.textContent || ''
      };
    })()`);

    const heightResult = basic?.results?.find((row) => row.label === '身高');
    const ok = refused?.reason === 'wrong_page'
      && refused?.ok === false
      && invalid?.reason === 'invalid_profile_value'
      && invalid?.ok === false
      && explicitInvalid?.reason === 'invalid_height'
      && explicitInvalid?.ok === false
      && explicitInvalid?.writeAttempted === false
      && afterReject?.height === ''
      && afterReject?.name === ''
      && afterReject?.weight === '60'
      && planReady?.ok === true
      && planReady?.values?.height === '182'
      && planUnit?.ok === true
      && planUnit?.values?.height === ''
      && planUnit?.blockers?.some((row) => row.label === '身高' && row.reason === 'invalid_profile_value')
      && first?.ok === true
      && first?.before === ''
      && first?.after === '175'
      && second?.ok === true
      && second?.before === '175'
      && second?.after === '182'
      && decimal?.ok === true
      && decimal?.before === '182'
      && decimal?.after === '180.5'
      && !/cm/iu.test(decimal?.after || '')
      && basic?.ok === true
      && basic?.saved === false
      && basic?.skippedSave === true
      && basic?.results?.length === 4
      && heightResult?.ok === true
      && heightResult?.after === '175'
      && !/cm/iu.test(heightResult?.after || '')
      && basic?.results?.some((row) => row.label === '性别') === false
      && neighbor?.workedChecked?.length === 1
      && neighbor.workedChecked[0] === '否'
      && Array.isArray(neighbor?.genderChecked)
      && neighbor.genderChecked.length === 0
      && neighbor?.weight === '60'
      && neighbor?.height === '175'
      && neighbor?.heightHasUnit === false
      && neighbor?.heightSuffix === 'CM'
      && neighbor?.saveDisabled === true
      && normSave(neighbor?.saveText) === '保存'
      && first?.saved === false
      && first?.skippedSave === true;

    const payload = basePayload({
      ok,
      reason: ok ? 'synthetic_height_text_pass' : 'synthetic_height_text_fail',
      surface: 'synthetic-fixture',
      liveEdge: false,
      formFillClaimed: false,
      liveHeightDomHarvested: false,
      fixture: 'synthetic-public-css-candidates',
      label: '身高',
      assumptions: [
        'label-scoped .ant-form-item whose label is 身高 with an optional CM suffix',
        'control is one input.ant-input (same public CSS candidate as 姓名/手机号/邮箱)',
        'written value is numeric centimeters only; CM stays on the label and is not written',
        'live label string and whether the live value contains a unit are unharvested'
      ],
      refused,
      invalid,
      explicitInvalid,
      afterReject,
      planReady,
      planUnit,
      first,
      second,
      decimal,
      fillBasic: basic,
      neighbor
    });
    const { file, latest } = heightEvidencePaths();
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

async function runSyntheticWeight() {
  const { server, port } = await startFixtureServer();
  const cdpPort = await freePort();
  let child;
  try {
    ({ child } = await launchChrome(cdpPort));
    const url = `http://127.0.0.1:${port}/${fixtureName}`;
    const { socket, send } = await attachPage(cdpPort, url);
    await injectScript(send);
    const refused = await evaluate(send, `ResumeCmbBasic.fillWeight('70')`);
    const invalid = await evaluate(send, `ResumeCmbBasic.fillWeight('60kg', { synthetic: true })`);
    const invalidUpper = await evaluate(send, `ResumeCmbBasic.fillWeight('60KG', { synthetic: true })`);
    const explicitInvalid = await evaluate(send, `ResumeCmbBasic.fillBasic({
      allowExplicitValues: true,
      fullName: '测试甲',
      mobile: '13800138000',
      email: 'cmb.fixture@example.com',
      weight: '60 KG'
    }, { synthetic: true })`);
    const afterReject = await evaluate(send, `(() => {
      const norm = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
      const items = [...document.querySelectorAll('.ant-form-item')];
      const labelOf = (item) => {
        const label = item.querySelector('.ant-form-item-label label, .ant-form-item-label');
        return norm(label?.textContent || '');
      };
      const byText = (want) => items.find((item) => labelOf(item) === want);
      const heightItem = items.find((item) => /^身高(?:\\s*(?:[（(]\\s*)?cm(?:\\s*[）)])?)?$/iu.test(labelOf(item)));
      const weightItem = items.find((item) => /^体重(?:\\s*(?:[（(]\\s*)?kg(?:\\s*[）)])?)?$/iu.test(labelOf(item)));
      const checkedValues = (item) => [...(item?.querySelectorAll('input[type="radio"]') || [])]
        .filter((node) => node.checked)
        .map((node) => node.value);
      return {
        weight: weightItem?.querySelector('input')?.value ?? null,
        height: heightItem?.querySelector('input')?.value ?? null,
        name: byText('姓名')?.querySelector('input')?.value ?? null,
        genderChecked: checkedValues(byText('性别')),
        saveDisabled: document.getElementById('save-btn')?.disabled === true
      };
    })()`);
    const planReady = await evaluate(send, `ResumeCmbBasic.planFromProfile({
      fullName: '测试甲',
      phone: '13800138000',
      email: 'cmb.fixture@example.com',
      weight: ' 65 ',
      confirmedFields: ['fullName', 'phone', 'email', 'weight']
    })`);
    const planUnit = await evaluate(send, `ResumeCmbBasic.planFromProfile({
      fullName: '测试甲',
      phone: '13800138000',
      email: 'cmb.fixture@example.com',
      weight: '60KG',
      confirmedFields: ['fullName', 'phone', 'email', 'weight']
    })`);
    const first = await evaluate(send, `ResumeCmbBasic.fillWeight('70', { synthetic: true })`);
    const second = await evaluate(send, `ResumeCmbBasic.fillWeight('65', { synthetic: true })`);
    const decimal = await evaluate(send, `ResumeCmbBasic.fillWeight('62.5', { synthetic: true })`);
    const basic = await evaluate(send, `ResumeCmbBasic.fillBasic({
      allowExplicitValues: true,
      fullName: '测试甲',
      mobile: '13800138000',
      email: 'cmb.fixture@example.com',
      weight: '58'
    }, { synthetic: true })`);
    const neighbor = await evaluate(send, `(() => {
      const norm = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
      const items = [...document.querySelectorAll('.ant-form-item')];
      const labelOf = (item) => {
        const label = item.querySelector('.ant-form-item-label label, .ant-form-item-label');
        return norm(label?.textContent || '');
      };
      const byText = (want) => items.find((item) => labelOf(item) === want);
      const heightItem = items.find((item) => /^身高(?:\\s*(?:[（(]\\s*)?cm(?:\\s*[）)])?)?$/iu.test(labelOf(item)));
      const weightItem = items.find((item) => /^体重(?:\\s*(?:[（(]\\s*)?kg(?:\\s*[）)])?)?$/iu.test(labelOf(item)));
      const checkedValues = (item) => [...(item?.querySelectorAll('input[type="radio"]') || [])]
        .filter((node) => node.checked)
        .map((node) => node.value);
      const heightValue = heightItem?.querySelector('input')?.value ?? null;
      const weightValue = weightItem?.querySelector('input')?.value ?? null;
      return {
        workedChecked: checkedValues(byText('是否参加过正式工作')),
        genderChecked: checkedValues(byText('性别')),
        height: heightValue,
        heightHasUnit: /cm/iu.test(String(heightValue ?? '')),
        heightSuffix: heightItem?.querySelector('[data-unit]')?.textContent || '',
        weight: weightValue,
        weightHasUnit: /kg/iu.test(String(weightValue ?? '')),
        weightSuffix: weightItem?.querySelector('[data-unit]')?.textContent || '',
        saveDisabled: document.getElementById('save-btn')?.disabled === true,
        saveText: document.getElementById('save-btn')?.textContent || ''
      };
    })()`);

    const weightResult = basic?.results?.find((row) => row.label === '体重');
    const ok = refused?.reason === 'wrong_page'
      && refused?.ok === false
      && invalid?.reason === 'invalid_profile_value'
      && invalid?.ok === false
      && invalidUpper?.reason === 'invalid_profile_value'
      && invalidUpper?.ok === false
      && explicitInvalid?.reason === 'invalid_weight'
      && explicitInvalid?.ok === false
      && explicitInvalid?.writeAttempted === false
      && afterReject?.weight === '60'
      && afterReject?.height === ''
      && afterReject?.name === ''
      && Array.isArray(afterReject?.genderChecked)
      && afterReject.genderChecked.length === 0
      && afterReject?.saveDisabled === true
      && planReady?.ok === true
      && planReady?.values?.weight === '65'
      && planReady?.values?.height === ''
      && planUnit?.ok === true
      && planUnit?.values?.weight === ''
      && planUnit?.blockers?.some((row) => row.label === '体重' && row.reason === 'invalid_profile_value')
      && first?.ok === true
      && first?.before === '60'
      && first?.after === '70'
      && second?.ok === true
      && second?.before === '70'
      && second?.after === '65'
      && decimal?.ok === true
      && decimal?.before === '65'
      && decimal?.after === '62.5'
      && !/kg/iu.test(decimal?.after || '')
      && basic?.ok === true
      && basic?.saved === false
      && basic?.skippedSave === true
      && basic?.results?.length === 4
      && weightResult?.ok === true
      && weightResult?.after === '58'
      && !/kg/iu.test(weightResult?.after || '')
      && basic?.results?.some((row) => row.label === '性别') === false
      && basic?.results?.some((row) => row.label === '身高') === false
      && neighbor?.workedChecked?.length === 1
      && neighbor.workedChecked[0] === '否'
      && Array.isArray(neighbor?.genderChecked)
      && neighbor.genderChecked.length === 0
      && neighbor?.height === ''
      && neighbor?.heightHasUnit === false
      && neighbor?.heightSuffix === 'CM'
      && neighbor?.weight === '58'
      && neighbor?.weightHasUnit === false
      && neighbor?.weightSuffix === 'KG'
      && neighbor?.saveDisabled === true
      && normSave(neighbor?.saveText) === '保存'
      && first?.saved === false
      && first?.skippedSave === true;

    const payload = basePayload({
      ok,
      reason: ok ? 'synthetic_weight_text_pass' : 'synthetic_weight_text_fail',
      surface: 'synthetic-fixture',
      liveEdge: false,
      formFillClaimed: false,
      liveWeightDomHarvested: false,
      fixture: 'synthetic-public-css-candidates',
      label: '体重',
      assumptions: [
        'label-scoped .ant-form-item whose label is 体重 with an optional KG suffix',
        'control is one input.ant-input (same public CSS candidate as 姓名/手机号/邮箱/身高)',
        'written value is numeric kilograms only; KG stays on the label and is not written',
        'live label string and whether the live value contains a unit are unharvested'
      ],
      refused,
      invalid,
      invalidUpper,
      explicitInvalid,
      afterReject,
      planReady,
      planUnit,
      first,
      second,
      decimal,
      fillBasic: basic,
      neighbor
    });
    const { file, latest } = weightEvidencePaths();
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

async function runSyntheticFormalWork() {
  const { server, port } = await startFixtureServer();
  const cdpPort = await freePort();
  let child;
  try {
    ({ child } = await launchChrome(cdpPort));
    const url = `http://127.0.0.1:${port}/${fixtureName}`;
    const { socket, send } = await attachPage(cdpPort, url);
    await injectScript(send);
    const refused = await evaluate(send, `ResumeCmbBasic.fillFormalWork('是')`);
    const invalid = await evaluate(send, `ResumeCmbBasic.fillFormalWork('未知', { synthetic: true })`);
    const explicitInvalid = await evaluate(send, `ResumeCmbBasic.fillBasic({
      allowExplicitValues: true,
      fullName: '测试甲',
      mobile: '13800138000',
      email: 'cmb.fixture@example.com',
      formalWork: '男'
    }, { synthetic: true })`);
    const afterReject = await evaluate(send, `(() => {
      const norm = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
      const items = [...document.querySelectorAll('.ant-form-item')];
      const labelOf = (item) => {
        const label = item.querySelector('.ant-form-item-label label, .ant-form-item-label');
        return norm(label?.textContent || '');
      };
      const byText = (want) => items.find((item) => labelOf(item) === want);
      const checkedValues = (item) => [...(item?.querySelectorAll('input[type="radio"]') || [])]
        .filter((node) => node.checked)
        .map((node) => node.value);
      return {
        workedChecked: checkedValues(byText('是否参加过正式工作')),
        genderChecked: checkedValues(byText('性别')),
        name: byText('姓名')?.querySelector('input')?.value ?? null,
        height: items.find((item) => /^身高(?:\\s*(?:[（(]\\s*)?cm(?:\\s*[）)])?)?$/iu.test(labelOf(item)))?.querySelector('input')?.value ?? null,
        weight: items.find((item) => /^体重(?:\\s*(?:[（(]\\s*)?kg(?:\\s*[）)])?)?$/iu.test(labelOf(item)))?.querySelector('input')?.value ?? null,
        saveDisabled: document.getElementById('save-btn')?.disabled === true
      };
    })()`);
    const planReady = await evaluate(send, `ResumeCmbBasic.planFromProfile({
      fullName: '测试甲',
      phone: '13800138000',
      email: 'cmb.fixture@example.com',
      formalWork: ' 是 ',
      confirmedFields: ['fullName', 'phone', 'email', 'formalWork']
    })`);
    const planInvalid = await evaluate(send, `ResumeCmbBasic.planFromProfile({
      fullName: '测试甲',
      phone: '13800138000',
      email: 'cmb.fixture@example.com',
      formalWork: '未知',
      confirmedFields: ['fullName', 'phone', 'email', 'formalWork']
    })`);
    const yes = await evaluate(send, `ResumeCmbBasic.fillFormalWork('是', { synthetic: true })`);
    const no = await evaluate(send, `ResumeCmbBasic.fillFormalWork('否', { synthetic: true })`);
    const basic = await evaluate(send, `ResumeCmbBasic.fillBasic({
      allowExplicitValues: true,
      fullName: '测试甲',
      mobile: '13800138000',
      email: 'cmb.fixture@example.com',
      formalWork: '是'
    }, { synthetic: true })`);
    const neighbor = await evaluate(send, `(() => {
      const norm = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
      const items = [...document.querySelectorAll('.ant-form-item')];
      const labelOf = (item) => {
        const label = item.querySelector('.ant-form-item-label label, .ant-form-item-label');
        return norm(label?.textContent || '');
      };
      const byText = (want) => items.find((item) => labelOf(item) === want);
      const checkedValues = (item) => [...(item?.querySelectorAll('input[type="radio"]') || [])]
        .filter((node) => node.checked)
        .map((node) => node.value);
      const heightItem = items.find((item) => /^身高(?:\\s*(?:[（(]\\s*)?cm(?:\\s*[）)])?)?$/iu.test(labelOf(item)));
      const weightItem = items.find((item) => /^体重(?:\\s*(?:[（(]\\s*)?kg(?:\\s*[）)])?)?$/iu.test(labelOf(item)));
      return {
        workedChecked: checkedValues(byText('是否参加过正式工作')),
        genderChecked: checkedValues(byText('性别')),
        height: heightItem?.querySelector('input')?.value ?? null,
        heightSuffix: heightItem?.querySelector('[data-unit]')?.textContent || '',
        weight: weightItem?.querySelector('input')?.value ?? null,
        weightSuffix: weightItem?.querySelector('[data-unit]')?.textContent || '',
        saveDisabled: document.getElementById('save-btn')?.disabled === true,
        saveText: document.getElementById('save-btn')?.textContent || ''
      };
    })()`);

    const formalResult = basic?.results?.find((row) => row.label === '是否参加过正式工作');
    const ok = refused?.reason === 'wrong_page'
      && refused?.ok === false
      && invalid?.reason === 'invalid_profile_value'
      && invalid?.ok === false
      && explicitInvalid?.reason === 'invalid_formal_work'
      && explicitInvalid?.ok === false
      && explicitInvalid?.writeAttempted === false
      && afterReject?.workedChecked?.length === 1
      && afterReject.workedChecked[0] === '否'
      && Array.isArray(afterReject?.genderChecked)
      && afterReject.genderChecked.length === 0
      && afterReject?.name === ''
      && afterReject?.height === ''
      && afterReject?.weight === '60'
      && afterReject?.saveDisabled === true
      && planReady?.ok === true
      && planReady?.values?.formalWork === '是'
      && planReady?.values?.gender === ''
      && planReady?.values?.height === ''
      && planReady?.values?.weight === ''
      && planInvalid?.ok === true
      && planInvalid?.values?.formalWork === ''
      && planInvalid?.blockers?.some((row) => row.label === '是否参加过正式工作' && row.reason === 'invalid_profile_value')
      && yes?.ok === true
      && yes?.before === '否'
      && yes?.after === '是'
      && yes?.saved === false
      && yes?.skippedSave === true
      && no?.ok === true
      && no?.before === '是'
      && no?.after === '否'
      && basic?.ok === true
      && basic?.saved === false
      && basic?.skippedSave === true
      && basic?.results?.length === 4
      && formalResult?.ok === true
      && formalResult?.after === '是'
      && basic?.results?.some((row) => row.label === '性别') === false
      && basic?.results?.some((row) => row.label === '身高') === false
      && basic?.results?.some((row) => row.label === '体重') === false
      && neighbor?.workedChecked?.length === 1
      && neighbor.workedChecked[0] === '是'
      && Array.isArray(neighbor?.genderChecked)
      && neighbor.genderChecked.length === 0
      && neighbor?.height === ''
      && neighbor?.heightSuffix === 'CM'
      && neighbor?.weight === '60'
      && neighbor?.weightSuffix === 'KG'
      && neighbor?.saveDisabled === true
      && normSave(neighbor?.saveText) === '保存';

    const payload = basePayload({
      ok,
      reason: ok ? 'synthetic_formal_work_radio_pass' : 'synthetic_formal_work_radio_fail',
      surface: 'synthetic-fixture',
      liveEdge: false,
      formFillClaimed: false,
      liveRadioDomHarvested: false,
      fixture: 'synthetic-public-css-candidates',
      label: '是否参加过正式工作',
      assumptions: [
        'label-scoped .ant-form-item whose label is exactly 是否参加过正式工作',
        '.ant-radio-wrapper text is exactly 是 or 否 (field map, not a live option list)',
        '.ant-radio wraps input[type=radio]',
        'readback is input.checked, not .ant-radio-checked',
        'shared radio name is a synthetic stand-in for single-select',
        '性别 / 身高 / 体重 stay untouched'
      ],
      refused,
      invalid,
      explicitInvalid,
      afterReject,
      planReady,
      planInvalid,
      yes,
      no,
      fillBasic: basic,
      neighbor
    });
    const { file, latest } = formalWorkEvidencePaths();
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

function normSave(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
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
    node scripts/auto-cmb-basic.mjs --only 是否参加过正式工作
    node scripts/auto-cmb-basic.mjs --only 身高
    node scripts/auto-cmb-basic.mjs --only 体重
  Gender is offline synthetic only. Live radio DOM is not harvested.
  Formal work (是否参加过正式工作) is offline synthetic radio only. Options are field-map 是/否.
  Live formal-work radio DOM is not harvested. --only 是否参加过正式工作 --live refuses.
  Height is offline synthetic text only. The value is numeric; CM is not written.
  Live height DOM is not harvested. --only 身高 --live refuses.
  Weight is offline synthetic text only. The value is numeric kilograms; KG is not written.
  Live weight DOM is not harvested. --only 体重 --live refuses.
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
  const kind = args.only == null ? '' : onlyKind(args.only);
  if (args.only != null && !kind) {
    console.error('Only 性别, 是否参加过正式工作, 身高, and 体重 are in this knife. Other second-slice labels are not implemented.');
    process.exit(2);
  }
  if (kind === 'height' && args.live && !args.synthetic) {
    const payload = basePayload({
      ok: false,
      reason: 'live_height_text_unharvested',
      surface: 'cdp',
      liveEdge: false,
      formFillClaimed: false,
      liveHeightDomHarvested: false,
      label: '身高',
      hint: 'Height text DOM was not harvested. Use --only 身高 without --live.'
    });
    const { file, latest } = heightEvidencePaths();
    fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
    fs.copyFileSync(file, latest);
    console.log(JSON.stringify({ event: 'refused', file, latest, ...payload }, null, 2));
    process.exit(3);
  }
  if (kind === 'height') {
    try {
      const { payload, written } = await runSyntheticHeight();
      console.log(JSON.stringify({
        event: 'saved',
        ...written,
        ok: payload.ok,
        reason: payload.reason,
        label: '身高'
      }, null, 2));
      process.exit(payload.ok ? 0 : 2);
    } catch (error) {
      const payload = basePayload({
        ok: false,
        reason: String(error?.message || error).slice(0, 300),
        surface: 'synthetic-fixture',
        liveEdge: false,
        formFillClaimed: false,
        liveHeightDomHarvested: false,
        error: String(error?.stack || error).slice(0, 800)
      });
      const { file, latest } = heightEvidencePaths();
      fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
      fs.copyFileSync(file, latest);
      console.error(JSON.stringify({ event: 'error', file, latest, ...payload }, null, 2));
      process.exit(1);
    }
  }
  if (kind === 'weight' && args.live && !args.synthetic) {
    const payload = basePayload({
      ok: false,
      reason: 'live_weight_text_unharvested',
      surface: 'cdp',
      liveEdge: false,
      formFillClaimed: false,
      liveWeightDomHarvested: false,
      label: '体重',
      hint: 'Weight text DOM was not harvested. Use --only 体重 without --live.'
    });
    const { file, latest } = weightEvidencePaths();
    fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
    fs.copyFileSync(file, latest);
    console.log(JSON.stringify({ event: 'refused', file, latest, ...payload }, null, 2));
    process.exit(3);
  }
  if (kind === 'weight') {
    try {
      const { payload, written } = await runSyntheticWeight();
      console.log(JSON.stringify({
        event: 'saved',
        ...written,
        ok: payload.ok,
        reason: payload.reason,
        label: '体重'
      }, null, 2));
      process.exit(payload.ok ? 0 : 2);
    } catch (error) {
      const payload = basePayload({
        ok: false,
        reason: String(error?.message || error).slice(0, 300),
        surface: 'synthetic-fixture',
        liveEdge: false,
        formFillClaimed: false,
        liveWeightDomHarvested: false,
        error: String(error?.stack || error).slice(0, 800)
      });
      const { file, latest } = weightEvidencePaths();
      fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
      fs.copyFileSync(file, latest);
      console.error(JSON.stringify({ event: 'error', file, latest, ...payload }, null, 2));
      process.exit(1);
    }
  }
  if (kind === 'gender' && args.live && !args.synthetic) {
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
  if (kind === 'formalWork' && args.live && !args.synthetic) {
    const payload = basePayload({
      ok: false,
      reason: 'live_formal_work_radio_unharvested',
      surface: 'cdp',
      liveEdge: false,
      formFillClaimed: false,
      liveRadioDomHarvested: false,
      label: '是否参加过正式工作',
      hint: 'Formal-work radio DOM was not harvested. Use --only 是否参加过正式工作 without --live.'
    });
    const { file, latest } = formalWorkEvidencePaths();
    fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
    fs.copyFileSync(file, latest);
    console.log(JSON.stringify({ event: 'refused', file, latest, ...payload }, null, 2));
    process.exit(3);
  }
  if (kind === 'formalWork') {
    try {
      const { payload, written } = await runSyntheticFormalWork();
      console.log(JSON.stringify({
        event: 'saved',
        ...written,
        ok: payload.ok,
        reason: payload.reason,
        label: '是否参加过正式工作'
      }, null, 2));
      process.exit(payload.ok ? 0 : 2);
    } catch (error) {
      const payload = basePayload({
        ok: false,
        reason: String(error?.message || error).slice(0, 300),
        surface: 'synthetic-fixture',
        liveEdge: false,
        formFillClaimed: false,
        liveRadioDomHarvested: false,
        error: String(error?.stack || error).slice(0, 800)
      });
      const { file, latest } = formalWorkEvidencePaths();
      fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
      fs.copyFileSync(file, latest);
      console.error(JSON.stringify({ event: 'error', file, latest, ...payload }, null, 2));
      process.exit(1);
    }
  }
  if (kind === 'gender') {
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
