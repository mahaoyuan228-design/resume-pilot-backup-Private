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
import {
  isCmbBirthDateLabel,
  isCmbEducationLevelLabel,
  isCmbRelationshipLabel,
  isCmbAwardLevelLabel,
  isCmbEnglishLevelLabel,
  isCmbChannelTypeLabel,
  isCmbInterviewCityLabel,
  isCmbEthnicityLabel,
  isCmbIdCardTypeLabel,
  isCmbHeightLabel,
  isCmbMaritalLabel,
  isCmbPoliticsLabel,
  isCmbWeightLabel
} from '../src/content/cmb-profile-map.mjs';
import { assessCmbRankingMajor } from '../src/content/cmb-rankingmajor-gate.mjs';
import { CMB_BIRTHDATE_OFFLINE_GATE } from '../src/content/cmb-birthdate-hint-gate.mjs';
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
  const args = { synthetic: false, live: false, help: false, extension: false, only: null, onlyCount: 0 };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--synthetic') args.synthetic = true;
    else if (token === '--live') args.live = true;
    else if (token === '--extension') args.extension = true;
    else if (token === '--only') {
      args.onlyCount += 1;
      args.only = argv[++index] || '';
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

function gatedEvidencePaths(kind, now = stampIso()) {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `cmb-${kind}-select-${now}.json`);
  const latest = path.join(outDir, `cmb-${kind}-select-latest.json`);
  return { file, latest };
}

function birthEvidencePaths(now = stampIso()) {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `cmb-birthdate-hint-${now}.json`);
  const latest = path.join(outDir, 'cmb-birthdate-hint-latest.json');
  return { file, latest };
}

function birthPickerMarkup(state) {
  if (state.mode === 'year') {
    const cells = [];
    for (let year = state.decadeStart; year < state.decadeStart + 10; year += 1) {
      cells.push(`<td title="${year}" class="ant-picker-cell"><div class="ant-picker-cell-inner">${year}</div></td>`);
    }
    return `<div class="ant-picker-panel"><div class="ant-picker-year-panel"><div class="ant-picker-header"><button type="button" class="ant-picker-header-super-prev-btn"></button><button type="button" class="ant-picker-decade-btn">${state.decadeStart}-${state.decadeStart + 9}</button><button type="button" class="ant-picker-header-super-next-btn"></button></div><div class="ant-picker-body"><table><tbody><tr>${cells.join('')}</tr></tbody></table></div></div></div>`;
  }
  if (state.mode === 'month') {
    const cells = [];
    for (let month = 1; month <= 12; month += 1) {
      const title = `${state.year}-${String(month).padStart(2, '0')}`;
      cells.push(`<td title="${title}" class="ant-picker-cell"><div class="ant-picker-cell-inner">${month}月</div></td>`);
    }
    return `<div class="ant-picker-panel"><div class="ant-picker-month-panel"><div class="ant-picker-header"><button type="button" class="ant-picker-year-btn">${state.year}</button></div><div class="ant-picker-body"><table><tbody><tr>${cells.join('')}</tr></tbody></table></div></div></div>`;
  }
  const title = `${state.year}-${String(state.month).padStart(2, '0')}-02`;
  const showDay = state.year === 1990 && state.month === 1;
  const day = showDay
    ? `<td title="${title}" class="ant-picker-cell ant-picker-cell-in-view"><div class="ant-picker-cell-inner">2</div></td>`
    : `<td title="${state.year}-${String(state.month).padStart(2, '0')}-01" class="ant-picker-cell"><div class="ant-picker-cell-inner">1</div></td>`;
  return `<div class="ant-picker-panel"><div class="ant-picker-date-panel"><div class="ant-picker-header"><button type="button" class="ant-picker-header-super-prev-btn"></button><button type="button" class="ant-picker-header-prev-btn"></button><div class="ant-picker-header-view"><button type="button" class="ant-picker-year-btn">${state.year}</button><button type="button" class="ant-picker-month-btn">${state.month}月</button></div><button type="button" class="ant-picker-header-next-btn"></button><button type="button" class="ant-picker-header-super-next-btn"></button></div><div class="ant-picker-body"><table><tbody><tr>${day}</tr></tbody></table></div></div></div>`;
}

async function runSyntheticBirthDate() {
  const { JSDOM } = await import('jsdom');
  const { fillCmbBirthDatePicker } = await import('../src/content/cmb-birthdate-picker.mjs');
  const { planCmbBasicFromProfile } = await import('../src/content/cmb-profile-map.mjs');
  const dom = new JSDOM('<!DOCTYPE html><body><button type="button" id="save-btn">保存</button><button type="submit" id="submit-btn">提交</button><button type="button" id="delete-btn">删除</button><div class="ant-picker"><div class="ant-picker-input"><input id="resume_basicInfo_birthday" readonly placeholder="请选择日期" value=""></div></div><input id="other-date" value="leave-me"></body>');
  const { document } = dom.window;
  const input = document.getElementById('resume_basicInfo_birthday');
  const state = { mode: 'date', year: 2026, month: 10, decadeStart: 2020 };
  let saveClicks = 0;
  document.addEventListener('click', (event) => {
    const el = event.target.closest && event.target.closest('button');
    if (el && /保存|提交|删除|投递/u.test(el.textContent || '')) saveClicks += 1;
  }, true);
  const render = () => {
    document.querySelectorAll('.ant-picker-dropdown').forEach((node) => node.remove());
    const dropdown = document.createElement('div');
    dropdown.className = 'ant-picker-dropdown';
    dropdown.innerHTML = birthPickerMarkup(state);
    document.body.appendChild(dropdown);
  };
  input.addEventListener('mousedown', () => {
    if (!document.querySelector('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)')) render();
  });
  document.addEventListener('click', (event) => {
    const dropdown = event.target.closest && event.target.closest('.ant-picker-dropdown');
    if (!dropdown) return;
    const yearButton = event.target.closest('.ant-picker-year-btn');
    const monthButton = event.target.closest('.ant-picker-month-btn');
    const superPrev = event.target.closest('.ant-picker-header-super-prev-btn');
    const superNext = event.target.closest('.ant-picker-header-super-next-btn');
    const cell = event.target.closest('.ant-picker-cell');
    if (yearButton && state.mode === 'date') {
      state.mode = 'year';
      render();
      return;
    }
    if (monthButton && state.mode === 'date') {
      state.mode = 'month';
      render();
      return;
    }
    if (superPrev && state.mode === 'year') {
      state.decadeStart -= 10;
      render();
      return;
    }
    if (superNext && state.mode === 'year') {
      state.decadeStart += 10;
      render();
      return;
    }
    if (cell && state.mode === 'year') {
      state.year = Number(cell.getAttribute('title'));
      state.mode = 'month';
      render();
      return;
    }
    if (cell && state.mode === 'month') {
      const title = cell.getAttribute('title') || '';
      state.year = Number(title.slice(0, 4));
      state.month = Number(title.slice(5, 7));
      state.mode = 'date';
      render();
      return;
    }
    if (cell && state.mode === 'date') {
      input.value = String(cell.getAttribute('title') || '').replace(/-/gu, '/');
      dropdown.remove();
    }
  });
  const result = await fillCmbBirthDatePicker(document, '1990/01/02');
  const plan = planCmbBasicFromProfile({
    fullName: '测试甲',
    phone: '13800138000',
    email: 'cmb.user@example.com',
    birthDate: '1990/01/02',
    confirmedFields: ['fullName', 'phone', 'email', 'birthDate']
  });
  const ok = result.ok === true
    && result.status === 'verified'
    && result.reason === 'matched'
    && result.after === '1990-01-02'
    && result.saved === false
    && result.supported === false
    && result.liveFillClaimed === false
    && result.liveSupportClaimed === false
    && input.value === '1990/01/02'
    && document.getElementById('other-date').value === 'leave-me'
    && saveClicks === 0
    && plan.values.birthDate === '1990-01-02'
    && !plan.blockers.some((row) => row.path === 'birthDate')
    && plan.birthDateHint.liveFillClaimed === false
    && plan.birthDateHint.saveAllowed === false;
  const payload = basePayload({
    ok,
    reason: ok ? 'synthetic_birthdate_picker_pass' : 'synthetic_birthdate_picker_fail',
    surface: 'synthetic-datepicker',
    liveEdge: false,
    formFillClaimed: false,
    liveFillClaimed: false,
    supported: false,
    saveAllowed: false,
    saveRefused: true,
    selector: null,
    writeAttempted: result.writeAttempted === true,
    syntheticDom: true,
    label: '出生日期',
    kind: 'DatePicker',
    selectId: 'resume_basicInfo_birthday',
    placeholder: '请选择日期',
    readOnly: true,
    fillHint: 'antd DatePicker readonly; format likely YYYY-MM-DD; Never Save',
    result,
    saveClicks,
    planReady: {
      ok: plan.ok,
      values: { birthDate: plan.values.birthDate },
      blockers: plan.blockers
    }
  });
  const written = birthEvidencePaths();
  fs.writeFileSync(written.file, JSON.stringify(payload, null, 2), 'utf8');
  fs.copyFileSync(written.file, written.latest);
  return { payload, written };
}

const GATED_SPECS = {
  marital: {
    label: '婚姻状况',
    fn: 'fillMaritalStatus',
    path: 'maritalStatus',
    selectId: 'resume_basicInfo_maritalStatus',
    invalid: '请选择',
    explicitReason: 'invalid_marital_status',
    liveReason: 'live_marital_select_fill_unclaimed',
    first: { text: '未婚', code: 'MS001' },
    second: { text: '已婚', code: 'MS002' }
  },
  politics: {
    label: '政治面貌',
    fn: 'fillPolitics',
    path: 'politics',
    selectId: 'resume_basicInfo_politicalAffinity',
    invalid: '党员',
    explicitReason: 'invalid_politics',
    liveReason: 'live_politics_select_fill_unclaimed',
    first: { text: '群众', code: 'PA0013' },
    second: { text: '中国共产党党员', code: 'PA001' }
  },
  ethnicity: {
    label: '民族',
    fn: 'fillEthnicity',
    path: 'ethnicity',
    selectId: 'resume_basicInfo_nation',
    invalid: '汉',
    explicitReason: 'invalid_ethnicity',
    liveReason: 'live_ethnicity_select_fill_unclaimed',
    first: { text: '汉族', code: 'NA0017' },
    second: { text: '回族', code: 'NA0018' }
  },
  idCard: {
    label: '证件类型',
    fn: 'fillIdCardType',
    path: 'idCardType',
    selectId: 'resume_basicInfo_idCardType',
    invalid: '请选择',
    explicitReason: 'invalid_id_card_type',
    liveReason: 'live_id_card_type_select_fill_unclaimed',
    first: { text: '身份证', code: 'ID001' },
    second: { text: '台胞证', code: 'ID0011' }
  },
  education: {
    label: '学历',
    fn: 'fillEducationLevel',
    path: 'educationLevel',
    selectId: 'resume_educationHistoryList_0_educationLevelCode',
    invalid: '研究生',
    explicitReason: 'invalid_education_level',
    liveReason: 'live_education_level_select_fill_unclaimed',
    first: { text: '本科', code: 'ED004' },
    second: { text: '硕士研究生', code: 'ED003' }
  },
  relationship: {
    label: '关系类型',
    fn: 'fillRelationshipType',
    path: 'relationshipType',
    selectId: 'resume_familyList_0_relationship',
    invalid: '父',
    explicitReason: 'invalid_relationship_type',
    liveReason: 'live_relationship_select_fill_unclaimed',
    first: { text: '父亲', code: 'RT0002' },
    second: { text: '配偶', code: 'RT0001' },
    row1: {
      fn: 'fillRelationshipTypeRow1',
      selectId: 'resume_familyList_1_relationship',
      text: '母亲',
      code: 'RT0003',
      invalid: '其他'
    }
  },
  award: {
    label: '获奖级别',
    fn: 'fillAwardLevel',
    path: 'awardLevel',
    selectId: 'resume_awardList_0_awardLevel',
    invalid: '国家级奖学金',
    explicitReason: 'invalid_award_level',
    liveReason: 'live_award_level_select_fill_unclaimed',
    first: { text: '院校级', code: 'AL002' },
    second: { text: '国家级', code: 'AL005' }
  },
  english: {
    label: '最高英语水平',
    fn: 'fillEnglishLevel',
    path: 'englishLevel',
    selectId: 'resume_skill_0_englishLevel',
    invalid: '托福',
    explicitReason: 'invalid_english_level',
    liveReason: 'live_english_level_select_fill_unclaimed',
    first: { text: 'CET-6', code: 'EL006' },
    second: { text: 'TOEFL', code: 'EL001' }
  },
  channel: {
    label: '招聘信息来源',
    fn: 'fillChannelType',
    path: 'channelType',
    selectId: 'resume_basicInfo_channelType',
    invalid: '微信',
    explicitReason: 'invalid_channel_type',
    liveReason: 'live_channel_type_select_fill_unclaimed',
    first: { text: '智联招聘', code: 'CT0017' },
    second: { text: '"招商银行招聘"微信公众号', code: 'CT002' }
  },
  interview: {
    label: '面试期望城市',
    fn: 'fillInterviewCity',
    path: 'interviewCity',
    selectId: 'resume_basicInfo_expectedInterviewCity',
    invalid: '北京',
    explicitReason: 'invalid_interview_city',
    liveReason: 'live_interview_city_select_fill_unclaimed',
    first: { text: '北京市', code: 'P00271' },
    second: { text: '重庆市', code: 'P00291' }
  }
};

// Trial Edge 9237 click evidence. Files are the attached probe JSON.
// Missing, stub, or mismatched files keep that field's original liveReason.
// RankingMajor is DOM_CONTROL_MISSING and is not in this map.
const LIVE_SELECT_EVIDENCE = {
  marital: 'cmb-live-select-marital-latest.json',
  politics: 'cmb-live-select-politics-latest.json',
  ethnicity: 'cmb-live-select-ethnicity-latest.json',
  idCard: 'cmb-live-select-idCardType-latest.json',
  education: 'cmb-live-select-educationLevel-latest.json',
  relationship: 'cmb-live-select-relationship-latest.json',
  award: 'cmb-live-select-awardLevel-latest.json',
  english: 'cmb-live-select-englishLevel-latest.json',
  channel: 'cmb-live-select-channelType-latest.json',
  interview: 'cmb-live-select-interviewCity-latest.json'
};

const LIVE_SELECT_FIELD = {
  marital: 'marital',
  politics: 'politics',
  ethnicity: 'ethnicity',
  idCard: 'idCardType',
  education: 'educationLevel',
  relationship: 'relationship',
  award: 'awardLevel',
  english: 'englishLevel',
  channel: 'channelType',
  interview: 'interviewCity'
};

function liveProbeClasses(probe) {
  return [probe.before, probe.after, probe.final]
    .map((row) => (row && typeof row.classes === 'string' ? row.classes : ''))
    .join(' ');
}

function readLiveSelectClaim(kind) {
  const spec = GATED_SPECS[kind];
  const name = LIVE_SELECT_EVIDENCE[kind];
  if (!spec || !name) return null;
  const file = path.join(outDir, name);
  if (!fs.existsSync(file)) return null;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
  const probe = data.probe;
  if (!probe || typeof probe !== 'object') return null;
  if (data.stub === true) return null;
  if (data.siteId !== 'cmb' || data.field !== LIVE_SELECT_FIELD[kind] || data.label !== spec.label) return null;
  if (data.neverSave !== true || data.formFillClaimed !== false) return null;
  if (data.liveSelectFillClaimed !== true || data.refuseCodeWas !== spec.liveReason) return null;
  const required = ['selectId', 'href', 'targetText', 'targetCode', 'before', 'after', 'final', 'pick', 'saved', 'neverSave', 'ok'];
  if (required.some((key) => probe[key] == null)) return null;
  if (typeof probe.selectId !== 'string' || probe.selectId !== spec.selectId) return null;
  if (probe.selectId.includes('_1_')) return null;
  if (spec.selectId.includes('_0_') && !probe.selectId.includes('_0_')) return null;
  if (typeof probe.targetText !== 'string' || probe.targetText.length === 0) return null;
  if (typeof probe.targetCode !== 'string' || probe.targetCode.length === 0) return null;
  if (probe.after?.text !== probe.targetText) return null;
  if (probe.pick?.ok !== true || probe.pick?.reason !== 'clicked') return null;
  if (probe.neverSave !== true || probe.saved !== false || probe.ok !== true) return null;
  if (!String(probe.href || '').includes('career.cmbchina.com/center/resume')) return null;
  if (kind === 'ethnicity' && !liveProbeClasses(probe).includes('ant-select-show-search')) return null;
  return { file, data };
}

function onlyKind(value) {
  const text = String(value ?? '').replace(/[\s\u00a0]+/gu, ' ').trim();
  if (text === 'RankingMajor' || text === '专业排名') return 'rankingMajor';
  if (text === '性别') return 'gender';
  if (text === '是否参加过正式工作') return 'formalWork';
  if (isCmbHeightLabel(text)) return 'height';
  if (isCmbWeightLabel(text)) return 'weight';
  if (isCmbMaritalLabel(text)) return 'marital';
  if (isCmbPoliticsLabel(text)) return 'politics';
  if (isCmbEthnicityLabel(text)) return 'ethnicity';
  if (isCmbIdCardTypeLabel(text)) return 'idCard';
  if (isCmbEducationLevelLabel(text)) return 'education';
  if (text === '家庭关系' || isCmbRelationshipLabel(text)) return 'relationship';
  if (isCmbAwardLevelLabel(text)) return 'award';
  if (text === '英语等级' || isCmbEnglishLevelLabel(text)) return 'english';
  if (text === '渠道' || isCmbChannelTypeLabel(text)) return 'channel';
  if (isCmbInterviewCityLabel(text)) return 'interview';
  if (isCmbBirthDateLabel(text)) return 'birthDate';
  return '';
}

function writeEvidence(kind, payload, now = stampIso()) {
  const { file, latest } = evidencePaths(kind, now);
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

async function attachOpenResumePage(cdpPort) {
  const listRes = await fetch(`http://127.0.0.1:${cdpPort}/json/list`).catch(() => null);
  if (!listRes?.ok) {
    const error = new Error('cdp_unavailable');
    error.code = 'live_cdp_unavailable';
    throw error;
  }
  const list = await listRes.json();
  const page = list.find((row) => (
    row.type === 'page'
    && row.webSocketDebuggerUrl
    && /career\.cmbchina\.com\/center\/resume/u.test(String(row.url || ''))
  ));
  if (!page) {
    const error = new Error('live_resume_page_missing');
    error.code = 'live_resume_page_missing';
    throw error;
  }
  const { socket, send } = await wsConnect(page.webSocketDebuggerUrl);
  await send('Runtime.enable');
  return { socket, send, page };
}

async function runLiveSelectFill(kind, cdpPort) {
  const spec = GATED_SPECS[kind];
  const claim = readLiveSelectClaim(kind);
  if (!claim) {
    const payload = basePayload({
      ok: false,
      reason: spec.liveReason,
      surface: 'cdp',
      liveEdge: false,
      formFillClaimed: false,
      liveSelectFillClaimed: false,
      clickEvidenceClaimed: false,
      optionListHarvested: true,
      label: spec.label,
      selectId: spec.selectId,
      hint: 'Live select click evidence is missing. Use --only without --live.'
    });
    const { file, latest } = gatedEvidencePaths(kind);
    fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
    fs.copyFileSync(file, latest);
    return { payload, written: { file, latest }, exitCode: 3 };
  }
  let attached = false;
  try {
    const { socket, page } = await attachOpenResumePage(cdpPort);
    attached = true;
    try { socket.close(); } catch {}
    // applyCodedSelect writes textContent / data-code / aria-selected. That is not a live click.
    const payload = basePayload({
      ok: false,
      reason: 'live_select_click_readback_unverified',
      surface: 'cdp-live-resume',
      liveEdge: true,
      formFillClaimed: false,
      liveSelectFillClaimed: false,
      clickEvidenceClaimed: true,
      syntheticDomMutation: false,
      saved: false,
      label: spec.label,
      selectId: spec.selectId,
      pageUrl: page.url || '',
      evidenceFile: path.relative(repoRoot, claim.file),
      hint: 'Evidence passed the gate. This run did not click the menu and did not call applyCodedSelect. Never Save. 招行 is not supported.'
    });
    const file = path.join(outDir, `cmb-${kind}-live-fill-latest.json`);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
    return { payload, written: { file, latest: file }, exitCode: 2 };
  } catch (error) {
    const code = !attached
      ? (error?.code === 'live_resume_page_missing' ? 'live_resume_page_missing' : 'live_cdp_unavailable')
      : 'live_select_click_readback_failed';
    const payload = basePayload({
      ok: false,
      reason: code,
      surface: attached ? 'cdp-live-resume' : 'cdp',
      liveEdge: attached,
      formFillClaimed: false,
      liveSelectFillClaimed: false,
      clickEvidenceClaimed: true,
      syntheticDomMutation: false,
      saved: false,
      label: spec.label,
      selectId: spec.selectId,
      evidenceFile: path.relative(repoRoot, claim.file),
      error: String(error?.message || error).slice(0, 300),
      hint: attached
        ? 'The resume tab was open. This run did not record a menu-click readback. Never Save. 招行 is not supported.'
        : 'Click evidence is on file. This attempt did not inject. Never Save. 招行 is not supported.'
    });
    const file = path.join(outDir, `cmb-${kind}-live-fill-latest.json`);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
    return { payload, written: { file, latest: file }, exitCode: 2 };
  }
}

async function runSyntheticGated(kind) {
  const spec = GATED_SPECS[kind];
  const { server, port } = await startFixtureServer();
  const cdpPort = await freePort();
  let child;
  try {
    ({ child } = await launchChrome(cdpPort));
    const url = `http://127.0.0.1:${port}/${fixtureName}`;
    const { socket, send } = await attachPage(cdpPort, url);
    await injectScript(send);
    const call = (expr) => evaluate(send, expr);
    const refused = await call(`ResumeCmbBasic.${spec.fn}(${JSON.stringify(spec.first.text)})`);
    const invalid = await call(`ResumeCmbBasic.${spec.fn}(${JSON.stringify(spec.invalid)}, { synthetic: true })`);
    const afterReject = await call(`(() => {
      const root = document.getElementById(${JSON.stringify(spec.selectId)});
      const shown = root?.querySelector('.ant-select-selection-item');
      return {
        text: (shown?.textContent || '').trim(),
        code: shown?.getAttribute('data-code') || '',
        saveDisabled: document.getElementById('save-btn')?.disabled === true,
        weight: document.querySelector('[data-field="体重"] input')?.value ?? null
      };
    })()`);
    const byCode = await call(`ResumeCmbBasic.${spec.fn}(${JSON.stringify(spec.second.code)}, { synthetic: true })`);
    const byText = await call(`ResumeCmbBasic.${spec.fn}(${JSON.stringify(spec.first.text)}, { synthetic: true })`);
    const explicitInvalid = await call(`ResumeCmbBasic.fillBasic({
      allowExplicitValues: true,
      fullName: '测试甲',
      mobile: '13800138000',
      email: 'cmb.fixture@example.com',
      ${spec.path}: ${JSON.stringify(spec.invalid)}
    }, { synthetic: true })`);
    const basic = await call(`ResumeCmbBasic.fillBasic({
      allowExplicitValues: true,
      fullName: '测试甲',
      mobile: '13800138000',
      email: 'cmb.fixture@example.com',
      ${spec.path}: ${JSON.stringify(spec.second.text)}
    }, { synthetic: true })`);
    const neighbor = await call(`(() => {
      const norm = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
      const read = (id) => {
        const root = document.getElementById(id);
        const shown = root?.querySelector('.ant-select-selection-item');
        const search = root?.querySelector('input.ant-select-selection-search-input');
        return {
          text: norm(shown?.textContent),
          code: shown?.getAttribute('data-code') || '',
          search: search ? search.value : ''
        };
      };
      const items = [...document.querySelectorAll('.ant-form-item')];
      const checkedValues = (want) => {
        const item = items.find((node) => norm(node.querySelector('.ant-form-item-label')?.textContent) === want);
        return [...(item?.querySelectorAll('input[type="radio"]') || [])].filter((node) => node.checked).map((node) => node.value);
      };
      return {
        marital: read('resume_basicInfo_maritalStatus'),
        politics: read('resume_basicInfo_politicalAffinity'),
        ethnicity: read('resume_basicInfo_nation'),
        idCard: read('resume_basicInfo_idCardType'),
        education: read('resume_educationHistoryList_0_educationLevelCode'),
        relationship: read('resume_familyList_0_relationship'),
        relationshipRow1: read('resume_familyList_1_relationship'),
        award: read('resume_awardList_0_awardLevel'),
        english: read('resume_skill_0_englishLevel'),
        channel: read('resume_basicInfo_channelType'),
        interview: read('resume_basicInfo_expectedInterviewCity'),
        englishScore: document.getElementById('resume_skill_0_englishScore')?.value ?? null,
        awardName: document.getElementById('resume_awardList_0_awardName')?.value ?? null,
        awardDate: document.getElementById('resume_awardList_0_awardDate')?.value ?? null,
        familyName0: document.getElementById('resume_familyList_0_name')?.value ?? null,
        familyPhone0: document.getElementById('resume_familyList_0_phone')?.value ?? null,
        familyName1: document.getElementById('resume_familyList_1_name')?.value ?? null,
        familyPhone1: document.getElementById('resume_familyList_1_phone')?.value ?? null,
        idNumber: document.getElementById('resume_basicInfo_idCard')?.value ?? null,
        genderChecked: checkedValues('性别'),
        workedChecked: checkedValues('是否参加过正式工作'),
        height: document.querySelector('[data-field="身高"] input')?.value ?? null,
        weight: document.querySelector('[data-field="体重"] input')?.value ?? null,
        saveDisabled: document.getElementById('save-btn')?.disabled === true,
        birthdayNode: document.getElementById('resume_basicInfo_birthday') ? true : false
      };
    })()`);
    const planReady = await call(`ResumeCmbBasic.planFromProfile({
      fullName: '测试甲',
      phone: '13800138000',
      email: 'cmb.fixture@example.com',
      ${spec.path}: ${JSON.stringify(spec.second.code)},
      birthDate: '1990-01-02',
      confirmedFields: ['fullName', 'phone', 'email', ${JSON.stringify(spec.path)}, 'birthDate']
    })`);
    const readFamilyRows = `(() => {
      const norm = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
      const read = (id) => {
        const root = document.getElementById(id);
        const shown = root?.querySelector('.ant-select-selection-item');
        return { text: norm(shown?.textContent), code: shown?.getAttribute('data-code') || '' };
      };
      return {
        row0: read('resume_familyList_0_relationship'),
        row1: read('resume_familyList_1_relationship'),
        familyName0: document.getElementById('resume_familyList_0_name')?.value ?? '',
        familyPhone0: document.getElementById('resume_familyList_0_phone')?.value ?? '',
        familyName1: document.getElementById('resume_familyList_1_name')?.value ?? '',
        familyPhone1: document.getElementById('resume_familyList_1_phone')?.value ?? ''
      };
    })()`;
    let indexIsolation = null;
    if (spec.row1) {
      const row1Fill = await call(`ResumeCmbBasic.${spec.row1.fn}(${JSON.stringify(spec.row1.code)}, { synthetic: true })`);
      const afterRow1 = await call(readFamilyRows);
      const row1Bad = await call(`ResumeCmbBasic.${spec.row1.fn}(${JSON.stringify(spec.row1.invalid)}, { synthetic: true })`);
      const afterBad = await call(readFamilyRows);
      const row0Again = await call(`ResumeCmbBasic.${spec.fn}(${JSON.stringify(spec.first.text)}, { synthetic: true })`);
      const afterRow0 = await call(readFamilyRows);
      indexIsolation = { row1Fill, afterRow1, row1Bad, afterBad, row0Again, afterRow0 };
    }
    const namesUntouched = (snap) => snap
      && snap.familyName0 === ''
      && snap.familyPhone0 === ''
      && snap.familyName1 === ''
      && snap.familyPhone1 === '';
    const isolationOk = !spec.row1 || (
      indexIsolation?.row1Fill?.ok === true
      && indexIsolation.row1Fill.rowIndex === 1
      && indexIsolation.row1Fill.selectId === spec.row1.selectId
      && indexIsolation.afterRow1?.row0?.text === spec.second.text
      && indexIsolation.afterRow1?.row0?.code === spec.second.code
      && indexIsolation.afterRow1?.row1?.text === spec.row1.text
      && indexIsolation.afterRow1?.row1?.code === spec.row1.code
      && namesUntouched(indexIsolation.afterRow1)
      && indexIsolation.row1Bad?.ok === false
      && indexIsolation.row1Bad?.reason === 'invalid_profile_value'
      && indexIsolation.afterBad?.row0?.code === spec.second.code
      && indexIsolation.afterBad?.row1?.code === spec.row1.code
      && indexIsolation.row0Again?.ok === true
      && indexIsolation.row0Again.rowIndex === 0
      && indexIsolation.row0Again.selectId === spec.selectId
      && indexIsolation.afterRow0?.row0?.text === spec.first.text
      && indexIsolation.afterRow0?.row0?.code === spec.first.code
      && indexIsolation.afterRow0?.row1?.text === spec.row1.text
      && indexIsolation.afterRow0?.row1?.code === spec.row1.code
      && namesUntouched(indexIsolation.afterRow0)
      && planReady?.values?.relationshipTypeRow1 === ''
    );
    const fieldResult = basic?.results?.find((row) => row.label === spec.label && (spec.row1 ? row.rowIndex === 0 : true));
    const othersEmpty = ['marital', 'politics', 'ethnicity', 'idCard', 'education', 'relationship', 'relationshipRow1', 'award', 'english', 'channel', 'interview'].every((name) => {
      const row = neighbor?.[name];
      if (name === kind) return row?.text === spec.second.text && row?.code === spec.second.code;
      return row?.text === '' && row?.code === '';
    });
    const ok = refused?.reason === 'wrong_page'
      && refused?.ok === false
      && invalid?.reason === 'invalid_profile_value'
      && invalid?.ok === false
      && afterReject?.text === ''
      && afterReject?.code === ''
      && afterReject?.weight === '60'
      && afterReject?.saveDisabled === true
      && byCode?.ok === true
      && byCode?.after === spec.second.text
      && byCode?.afterCode === spec.second.code
      && byCode?.before === ''
      && byText?.ok === true
      && byText?.before === spec.second.text
      && byText?.after === spec.first.text
      && byText?.afterCode === spec.first.code
      && explicitInvalid?.reason === spec.explicitReason
      && explicitInvalid?.writeAttempted === false
      && basic?.ok === true
      && basic?.saved === false
      && basic?.skippedSave === true
      && basic?.results?.length === 4
      && fieldResult?.ok === true
      && fieldResult?.after === spec.second.text
      && fieldResult?.afterCode === spec.second.code
      && othersEmpty
      && neighbor?.genderChecked?.length === 0
      && neighbor?.workedChecked?.length === 1
      && neighbor.workedChecked[0] === '否'
      && neighbor?.height === ''
      && neighbor?.weight === '60'
      && neighbor?.saveDisabled === true
      && neighbor?.birthdayNode === false
      && neighbor?.ethnicity?.search === ''
      && neighbor?.idNumber === ''
      && (neighbor?.familyName0 ?? '') === ''
      && (neighbor?.familyPhone0 ?? '') === ''
      && (neighbor?.familyName1 ?? '') === ''
      && (neighbor?.familyPhone1 ?? '') === ''
      && (neighbor?.awardName ?? '') === ''
      && (neighbor?.awardDate ?? '') === ''
      && (neighbor?.englishScore ?? '') === ''
      && planReady?.ok === true
      && planReady?.values?.[spec.path] === spec.second.text
      && planReady?.values?.birthDate === '1990-01-02'
      && !planReady?.blockers?.some((row) => row.path === 'birthDate')
      && isolationOk;

    const payload = basePayload({
      ok,
      reason: ok ? `synthetic_${kind}_select_pass` : `synthetic_${kind}_select_fail`,
      surface: 'synthetic-fixture',
      liveEdge: false,
      formFillClaimed: false,
      liveSelectFillClaimed: false,
      optionListHarvested: spec.optionListHarvested !== false,
      label: spec.label,
      fixture: 'synthetic-harvested-options',
      assumptions: [
        'option text and code come from the 2026-10-19 dict harvest',
        'option-row markup is a synthetic stand-in, not a live dropdown contract',
        'readback is the selection item text plus data-code',
        'show-search typing is not used; ethnicity search input stays empty',
        'live click evidence is on file for the ten selects; this run is still the synthetic fixture',
        '证件号 resume_basicInfo_idCard is present and is not written'
      ],
      refused,
      invalid,
      afterReject,
      byCode,
      byText,
      explicitInvalid,
      fillBasic: basic,
      neighbor,
      planReady,
      indexIsolation
    });
    const { file, latest } = gatedEvidencePaths(kind);
    fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
    fs.copyFileSync(file, latest);
    socket.close();
    return { payload, written: { file, latest } };
  } finally {
    try { child?.kill(); } catch {}
    try { server.close(); } catch {}
  }
}

function printHelp() {
  console.log(`CMB basic harness (siteId=${SITE_ID})
  MODE=readiness|fill (default readiness)
  CDP_PORT=9237 (trial CDP; --extension readiness or Never-Save fill)
  Prefer offline:
    MODE=fill node scripts/auto-cmb-basic.mjs --synthetic
    MODE=readiness node scripts/auto-cmb-basic.mjs --synthetic
    node scripts/auto-cmb-basic.mjs --only 性别
    node scripts/auto-cmb-basic.mjs --only 是否参加过正式工作
    node scripts/auto-cmb-basic.mjs --only 身高
    node scripts/auto-cmb-basic.mjs --only 体重
    node scripts/auto-cmb-basic.mjs --only 婚姻状况
    node scripts/auto-cmb-basic.mjs --only 政治面貌
    node scripts/auto-cmb-basic.mjs --only 民族
    node scripts/auto-cmb-basic.mjs --only 证件类型
    node scripts/auto-cmb-basic.mjs --only 学历
    node scripts/auto-cmb-basic.mjs --only 关系类型
    node scripts/auto-cmb-basic.mjs --only 获奖级别
    node scripts/auto-cmb-basic.mjs --only 最高英语水平
    node scripts/auto-cmb-basic.mjs --only 招聘信息来源
    node scripts/auto-cmb-basic.mjs --only 面试期望城市
    node scripts/auto-cmb-basic.mjs --only 出生日期
    node scripts/auto-cmb-basic.mjs --only RankingMajor
  Gender is offline synthetic only. Live radio DOM is not harvested.
  Formal work (是否参加过正式工作) is offline synthetic radio only. Options are field-map 是/否.
  Live formal-work radio DOM is not harvested. --only 是否参加过正式工作 --live refuses.
  Height is offline synthetic text only. The value is numeric; CM is not written.
  Live height DOM is not harvested. --only 身高 --live refuses.
  Weight is offline synthetic text only. The value is numeric kilograms; KG is not written.
  Live weight DOM is not harvested. --only 体重 --live refuses.
  Marital / politics / ethnicity selects use harvested text+code on a synthetic option list.
  Ethnicity showSearch is true because the live control has ant-select-show-search.
  Birth date records the DatePicker hint and does not write.
  证件类型 uses harvested id resume_basicInfo_idCardType and IdCardType text+code.
  The select has no show-search. 证件号 is not filled.
  学历 uses harvested row-0 id resume_educationHistoryList_0_educationLevelCode.
  Live options keep 博士后 ED000. The synthetic fixture may omit it.
  关系类型 uses live ids resume_familyList_0_relationship and resume_familyList_1_relationship.
  Row 0 and row 1 are filled separately. Family name and phone are not filled.
  获奖级别 uses live id resume_awardList_0_awardLevel.
  The level is not inferred from 奖项名称.
  最高英语水平 uses live id resume_skill_0_englishLevel.
  托福 / 四级 / a score are not converted.
  招聘信息来源 uses harvested id resume_basicInfo_channelType.
  Names stay exact, including quotation marks. 微信 / 官网 / 智联 are not merged.
  面试期望城市 uses harvested id resume_basicInfo_expectedInterviewCity.
  All 44 names stay complete. 北京 does not match 北京市. 重庆 does not match 重庆市.
  With a non-stub dist/auto-runs/cmb-live-select-*-latest.json, exactly one
  --only <select> --live no longer exits that field's live_*_select_fill_unclaimed.
  Stub, wrong siteId, wrong field, a row-1 id, or a missing probe field keeps the
  original liveReason. More than one --only is refused. applyCodedSelect is not
  live success. An open resume tab without a menu-click readback returns
  live_select_click_readback_unverified. No Edge is live_cdp_unavailable.
  RankingMajor stays DOM_CONTROL_MISSING and is not in this gate.
  Never clicks 保存.
  Fallback reasons if that evidence file is missing:
  live_marital_select_fill_unclaimed
  live_politics_select_fill_unclaimed
  live_ethnicity_select_fill_unclaimed
  live_id_card_type_select_fill_unclaimed
  live_education_level_select_fill_unclaimed
  live_relationship_select_fill_unclaimed
  live_award_level_select_fill_unclaimed
  live_english_level_select_fill_unclaimed
  live_channel_type_select_fill_unclaimed
  live_interview_city_select_fill_unclaimed
  Live portal fingerprint only (no fill claim):
    MODE=readiness node scripts/auto-cmb-basic.mjs --live
    Trial SW message CMB_BASIC_AUTO (src/auto/cmb-basic-auto.html).
    Attach an already running trial browser (no Edge launch):
    MODE=readiness node scripts/auto-cmb-basic.mjs --extension
    MODE=fill node scripts/auto-cmb-basic.mjs --extension --port 9237
    --extension-id <id> / RESUME_EXT_ID selects an extension when discovery is ambiguous.
    --mode readiness|fill overrides MODE. Other modes are refused.
    --timeout-ms / AUTO_TIMEOUT_MS: whole run (default 180000).
    --step-timeout-ms / CDP_STEP_TIMEOUT_MS: each CDP call (default 5000).
    --open-if-missing / OPEN_IF_MISSING=1 optionally opens the CMB resume page.
    Default OPEN_IF_MISSING=0 reports cmb_basic_tab_missing; no page is opened.
    Evidence: cmb-basic-extension-<mode>-latest.json plus a unique runId file.
    Exit 0: runner ok; 1: CDP/timeout/BG_NO_RESPONSE; 2: negative result;
    3: invalid arguments, missing host permission, or extension selection refusal.
    Results come from auto-page #out; no chrome.storage polling. 招行 is not supported.
  (--synthetic remains default offline; --extension is opt-in CDP)
  Never clicks 保存/提交. Sample portal: ${SAMPLE_PORTAL}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }
  if (args.extension) {
    const { runCmbExtensionCdp } = await import('./lib/cmb-extension-cdp.mjs');
    const payload = await runCmbExtensionCdp({ argv: process.argv.slice(2) });
    const written = writeEvidence(`extension-${payload.mode}`, payload, `${stampIso()}-${payload.runId}`);
    console.log(JSON.stringify({ event: 'recorded', ...written, ...payload }, null, 2));
    process.exit(payload.exitCode);
  }
  if (args.live && !args.synthetic && args.onlyCount > 1) {
    const payload = basePayload({
      ok: false,
      reason: 'live_select_one_field_only',
      surface: 'cdp',
      liveEdge: false,
      formFillClaimed: false,
      liveSelectFillClaimed: false,
      hint: 'Live select fill accepts one --only field. Never Save. 招行 is not supported.'
    });
    console.log(JSON.stringify({ event: 'refused', ...payload }, null, 2));
    process.exit(2);
  }
  const kind = args.only == null ? '' : onlyKind(args.only);
  if (args.only != null && !kind) {
    console.error('Only 性别, 是否参加过正式工作, 身高, 体重, 婚姻状况, 政治面貌, 民族, 证件类型, 学历, 关系类型, 获奖级别, 最高英语水平, 招聘信息来源, 面试期望城市, and 出生日期 are in this knife.');
    process.exit(2);
  }
  if (kind === 'rankingMajor') {
    const gate = assessCmbRankingMajor(null);
    const payload = basePayload({
      ok: false,
      reason: gate.verdict,
      surface: 'offline-gate',
      liveEdge: false,
      formFillClaimed: false,
      writeAttempted: false,
      supported: gate.supported,
      liveFillClaimed: gate.liveFillClaimed,
      fillAllowed: gate.fillAllowed,
      wireAllowed: gate.wireAllowed,
      saveAllowed: gate.saveAllowed,
      saveRefused: gate.saveRefused,
      selector: null,
      hint: 'RankingMajor is DOM_CONTROL_MISSING. No selector was recorded. Never Save. 招行 is not supported.'
    });
    console.log(JSON.stringify({ event: 'refused', ...payload }, null, 2));
    process.exit(3);
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
  if (kind === 'birthDate' && args.live && !args.synthetic) {
    const gate = CMB_BIRTHDATE_OFFLINE_GATE;
    const payload = basePayload({
      ok: false,
      reason: 'datepicker_hint_only',
      surface: 'hint-only',
      liveEdge: false,
      formFillClaimed: false,
      liveFillClaimed: false,
      supported: false,
      saveAllowed: gate.saveAllowed,
      saveRefused: gate.saveRefused,
      selector: null,
      writeAttempted: false,
      label: '出生日期',
      kind: 'DatePicker',
      selectId: 'resume_basicInfo_birthday',
      placeholder: '请选择日期',
      readOnly: true,
      fillHint: 'antd DatePicker readonly; format likely YYYY-MM-DD; Never Save'
    });
    const { file, latest } = birthEvidencePaths();
    fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
    fs.copyFileSync(file, latest);
    console.log(JSON.stringify({ event: 'refused', file, latest, ...payload }, null, 2));
    process.exit(3);
  }
  if (kind === 'birthDate') {
    try {
      const { payload, written } = await runSyntheticBirthDate();
      console.log(JSON.stringify({
        event: 'saved',
        ...written,
        ...payload
      }, null, 2));
      process.exit(payload.ok ? 0 : 2);
    } catch (error) {
      const payload = basePayload({
        ok: false,
        reason: String(error?.message || error).slice(0, 300),
        surface: 'synthetic-datepicker',
        liveEdge: false,
        formFillClaimed: false,
        liveFillClaimed: false,
        supported: false,
        saved: false,
        skippedSave: true,
        error: String(error?.stack || error).slice(0, 800)
      });
      const { file, latest } = birthEvidencePaths();
      fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
      fs.copyFileSync(file, latest);
      console.error(JSON.stringify({ event: 'error', file, latest, ...payload }, null, 2));
      process.exit(1);
    }
  }
  if (GATED_SPECS[kind] && args.live && !args.synthetic) {
    const cdpPort = Number.parseInt(process.env.CDP_PORT || '9237', 10);
    const { payload, written, exitCode } = await runLiveSelectFill(kind, cdpPort);
    console.log(JSON.stringify({
      event: payload.clickEvidenceClaimed && payload.reason !== GATED_SPECS[kind].liveReason ? 'live-select' : 'refused',
      ...written,
      ...payload
    }, null, 2));
    process.exit(exitCode);
  }
  if (GATED_SPECS[kind]) {
    try {
      const { payload, written } = await runSyntheticGated(kind);
      console.log(JSON.stringify({
        event: 'saved',
        ...written,
        ok: payload.ok,
        reason: payload.reason,
        label: GATED_SPECS[kind].label
      }, null, 2));
      process.exit(payload.ok ? 0 : 2);
    } catch (error) {
      const payload = basePayload({
        ok: false,
        reason: String(error?.message || error).slice(0, 300),
        surface: 'synthetic-fixture',
        liveEdge: false,
        formFillClaimed: false,
        liveSelectFillClaimed: false,
        error: String(error?.stack || error).slice(0, 800)
      });
      const { file, latest } = gatedEvidencePaths(kind);
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
