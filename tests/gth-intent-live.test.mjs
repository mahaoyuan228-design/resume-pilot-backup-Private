/**
 * Decision logic for the GTH 求职意向 never-save live runner.
 * The CDP attach is exercised with a fake session. The fill itself is the
 * shipped writer on the 2026-10-20 census DOM. No Edge is required.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { assessGthIntentFill } from '../src/background/gth-intent-auto.mjs';
import { intentFormHtml, wireIntentForm } from './fixtures/gth-intent-census-dom.mjs';
import {
  ARRIVAL_ANSWER,
  BASE_TIP,
  FILL_QUESTIONS,
  LIVE_BINDING,
  LIVE_FILES,
  PLANNED,
  READ_QUESTIONS,
  REGION_PATH,
  REGION_READBACK,
  RUNTIME_FILES,
  SALARY_ANSWER,
  SALARY_UNIT_LOOKUP,
  buildEvidence,
  buildFieldRows,
  buildPageExpression,
  clicksAreDiscardOnly,
  decideCancel,
  decideOpen,
  evidenceExitCode,
  expectedReadback,
  fixedLiveProfile,
  isAllowedLookup,
  isDisallowedNonGet,
  liveFillRequest,
  partitionTraffic,
  plannedFieldRows,
  readOutDir,
  readPort,
  runGthIntentLive
} from '../scripts/live/gth-intent-live.mjs';

const source = fs.readFileSync(new URL('../scripts/live/gth-intent-live.mjs', import.meta.url), 'utf8');
const intentSource = fs.readFileSync(new URL('../src/content/gth-intent.js', import.meta.url), 'utf8');
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'https://hr.gtht.com/resume/edit/';
const TITLES = ['基本信息', '教育经历', '求职意向', '工作经验', '职业技能与特长', '附件简历', '其他信息'];
const POWERSHELL = "$env:PORT='9239'; $env:OUTDIR='C:/Users/admin/Desktop/ResumeQuickFill-Dev/_temp-scripts'; node scripts/live/gth-intent-live.mjs";

function closedEditorSnapshot(extra = {}) {
  return {
    hrefOk: true,
    readyState: 'complete',
    visible: true,
    titlesOk: true,
    foreignFormCount: 0,
    formCount: 0,
    secFormCount: 0,
    editLinkCount: 1,
    editLinkPresentCount: 1,
    editWouldNavigate: false,
    ...extra
  };
}

test('field rows verify fills against readback and leave the other four read-only', () => {
  const matched = buildFieldRows({
    questions: PLANNED.map((item) => item.q),
    fillQuestions: FILL_QUESTIONS,
    fillFields: [
      { question: '期望工作地区', status: 'verified', reason: 'readback_reapplied' },
      { question: '期望薪资', status: 'verified', reason: 'readback_reapplied' },
      { question: '到岗日期', status: 'verified', reason: 'readback_matched' }
    ],
    readback: [
      { q: '期望工作地区', value: REGION_READBACK, reason: null },
      { q: '期望从事职位类别', value: '投资/证券/基金', reason: null },
      { q: '期望薪资', value: SALARY_ANSWER, reason: null },
      { q: '到岗日期', value: ARRIVAL_ANSWER, reason: null },
      { q: '现从事行业', value: '证券/投资/基金/信托', reason: null },
      { q: '现从事职位类别', value: '投资/证券/基金', reason: null },
      { q: '现薪资', value: '12000', reason: null }
    ],
    expected: expectedReadback()
  });
  assert.equal(matched.find((row) => row.q === '期望工作地区').status, 'verified');
  assert.equal(matched.find((row) => row.q === '期望工作地区').value, '大兴区');
  assert.equal(matched.find((row) => row.q === '期望薪资').reason, 'readback_reapplied');
  assert.equal(matched.find((row) => row.q === '到岗日期').value, '一个月内');
  for (const question of READ_QUESTIONS) {
    const row = matched.find((item) => item.q === question);
    assert.equal(row.status, 'verified');
    assert.equal(row.reason, 'read_only');
    assert.equal(typeof row.value, 'string');
  }

  const mismatch = buildFieldRows({
    questions: ['期望薪资', '到岗日期'],
    fillQuestions: ['期望薪资', '到岗日期'],
    fillFields: [
      { question: '期望薪资', status: 'verified', reason: 'readback_reapplied' },
      { question: '到岗日期', status: 'verified', reason: 'readback_matched' }
    ],
    readback: [
      { q: '期望薪资', value: '12000', reason: null },
      { q: '到岗日期', value: null, reason: 'control_not_supported' }
    ],
    expected: expectedReadback(),
    extraLabels: ['证书']
  });
  assert.deepEqual(mismatch, [
    { q: '期望薪资', status: 'failed', reason: 'readback_mismatch', value: '12000' },
    { q: '到岗日期', status: 'failed', reason: 'control_not_supported', value: null },
    { q: '证书', status: 'failed', reason: 'control_not_supported', value: null }
  ]);
});

test('only the exact salary-unit lookup is an allowed non-GET', () => {
  const lookup = SALARY_UNIT_LOOKUP;
  assert.equal(lookup, 'https://hr.gtht.com/interface/js/type/getsalaryunit.json');
  assert.equal(isAllowedLookup(`${lookup}?token=secret`), true);
  assert.equal(isAllowedLookup(lookup), true);
  assert.equal(isDisallowedNonGet('POST', lookup), false);
  assert.equal(isDisallowedNonGet('POST', `${lookup}?token=secret`), false);
  assert.equal(isDisallowedNonGet('GET', 'https://hr.gtht.com/api/resume/edit.json'), false);
  assert.equal(isDisallowedNonGet('POST', 'https://hr.gtht.com/api/dict/getsalaryunit.json'), true);
  assert.equal(isDisallowedNonGet('POST', 'https://hr.gtht.com/api/resume/getsalaryunit.json'), true);
  assert.equal(isDisallowedNonGet('POST', 'https://hr.gtht.com/api/log'), true);
  assert.equal(isDisallowedNonGet('POST', 'https://hr.gtht.com/api/resume/edit.json'), true);
  assert.equal(isDisallowedNonGet('PUT', 'https://hr.gtht.com/profile/submit'), true);
  assert.equal(isDisallowedNonGet('DELETE', lookup), false);

  const traffic = partitionTraffic([
    { method: 'GET', url: 'https://hr.gtht.com/api/resume/edit.json?x=1', via: 'cdp' },
    { method: 'POST', url: `${lookup}?token=secret`, via: 'xhr' },
    { method: 'POST', url: `${lookup}?token=secret`, via: 'xhr' },
    { method: 'POST', url: lookup, via: 'cdp' },
    { method: 'POST', url: 'https://hr.gtht.com/api/dict/getsalaryunit.json', via: 'fetch' },
    { method: 'POST', url: 'https://hr.gtht.com/api/log', via: 'xhr' },
    { method: 'HEAD', url: 'https://hr.gtht.com/api/resume/save.json' }
  ]);
  assert.equal(traffic.nonGet.length, 4);
  assert.equal(traffic.nonGet.some((row) => row.url.includes('token')), false);
  assert.deepEqual(traffic.saveLikePost, [
    { method: 'POST', url: 'https://hr.gtht.com/api/dict/getsalaryunit.json', via: 'fetch' },
    { method: 'POST', url: 'https://hr.gtht.com/api/log', via: 'xhr' }
  ]);
});

test('open and cancel decisions use the shipped controls and refuse save clicks', () => {
  assert.equal(decideOpen(closedEditorSnapshot()).action, 'click_edit');
  assert.deepEqual(decideOpen(closedEditorSnapshot({ editLinkCount: 0, editLinkPresentCount: 0 })), {
    action: 'stop',
    reason: 'control_not_supported',
    detail: 'edit_not_found'
  });
  assert.equal(decideOpen(closedEditorSnapshot({ editLinkCount: 2 })).detail, 'edit_not_unique');
  assert.equal(decideOpen(closedEditorSnapshot({ editWouldNavigate: true })).detail, 'edit_would_navigate');
  assert.equal(decideOpen(closedEditorSnapshot({
    formCount: 1,
    secFormCount: 1,
    editLinkCount: 0,
    editLinkPresentCount: 0
  })).action, 'already_open');
  assert.equal(decideOpen(closedEditorSnapshot({
    formCount: 1,
    secFormCount: 1,
    editLinkCount: 0,
    editLinkPresentCount: 1
  })).detail, 'edit_link_still_present');
  assert.equal(decideOpen(closedEditorSnapshot({ foreignFormCount: 1 })).reason, 'other_section_editor_open');
  assert.equal(decideOpen(closedEditorSnapshot({ hrefOk: false })).reason, 'wrong_page');
  assert.equal(decideOpen(closedEditorSnapshot({ visible: false })).reason, 'page_hidden');

  assert.equal(decideCancel({ cancelCount: 1, cancelText: '取消', cancelType: 'button' }).action, 'click_cancel');
  for (const cancelText of ['保存', '提交', '投递', '删除', '确定', '取消保存']) {
    assert.equal(decideCancel({ cancelCount: 1, cancelText, cancelType: 'button' }).reason, 'control_not_supported', cancelText);
  }
  assert.equal(decideCancel({ cancelCount: 1, cancelText: '取消', cancelType: 'submit' }).detail, 'cancel_not_button');
  assert.equal(decideCancel({ cancelCount: 0, cancelText: '', cancelType: '' }).detail, 'cancel_not_found');
  assert.equal(decideCancel({ cancelCount: 2, cancelText: '取消', cancelType: 'button' }).detail, 'cancel_not_unique');
  assert.equal(clicksAreDiscardOnly([{ label: '编辑' }, { label: '取消' }]), true);
  assert.equal(clicksAreDiscardOnly([{ label: '编辑' }, { label: '保存' }]), false);
  assert.equal(clicksAreDiscardOnly([{ label: '编辑' }, { label: '确定' }]), false);
});

test('evidence stays never-save and does not claim live support', () => {
  const evidence = buildEvidence({
    tipSha: BASE_TIP,
    fields: plannedFieldRows('not_run'),
    saveLikePost: [{ method: 'POST', url: 'https://hr.gtht.com/api/log', via: 'cdp' }],
    finalDetails: { liveSupportClaimed: true, neverSave: false, reason: 'disallowed_non_get', cancelsOk: true }
  });
  assert.equal(evidence.tipSha, BASE_TIP);
  assert.equal(evidence.neverSave, true);
  assert.equal(evidence.liveSupportClaimed, false);
  assert.equal(evidence.finalDetails.liveSupportClaimed, false);
  assert.equal(evidence.finalDetails.neverSave, true);
  assert.equal(evidence.fields.length, PLANNED.length);
  assert.equal(evidenceExitCode(evidence), 3);
  assert.equal(readPort({}), 9239);
  assert.equal(readPort({ PORT: '9240' }), 9240);
  assert.throws(() => readPort({ PORT: '0' }), /bad port/);
  assert.equal(path.isAbsolute(readOutDir({})), true);
});

test('the fixed profile confirms only the three live fixtures', () => {
  const profile = fixedLiveProfile();
  const request = liveFillRequest();
  assert.equal(profile.customAnswers.期望工作地区, REGION_PATH);
  assert.equal(profile.customAnswers.期望薪资, SALARY_ANSWER);
  assert.equal(profile.customAnswers.到岗日期, ARRIVAL_ANSWER);
  assert.deepEqual(Object.keys(profile.customAnswers), ['期望工作地区', '期望薪资', '到岗日期']);
  assert.equal(request.omitAbsent, true);
  assert.equal(request.replaceExisting, true);
  assert.equal(request.profileBinding, LIVE_BINDING);
  assert.deepEqual(request.profile.customAnswers, profile.customAnswers);
  for (const fact of profile.customFacts) {
    assert.equal(fact.sitePageUrl, PAGE);
    assert.equal(fact.sectionName, '求职意向');
    assert.equal(fact.rowContext, 'none');
    assert.equal(fact.answer, profile.customAnswers[fact.question]);
    assert.equal(profile.confirmedFields.includes(`customAnswers.${fact.question}`), true);
  }
  for (const question of READ_QUESTIONS) assert.equal(profile.customAnswers[question], undefined);
  assert.equal(LIVE_BINDING.profileHash.length, 64);
  assert.deepEqual(LIVE_FILES, ['src/content/gth-intent.js']);
  assert.deepEqual(expectedReadback(), {
    期望工作地区: '大兴区',
    期望薪资: '15000',
    到岗日期: '一个月内'
  });
  const blob = JSON.stringify(profile);
  assert.doesNotMatch(blob, /placeholder|测试|TODO|示例|xxx|TEST/iu);
});

test('the sync list is the runner import graph plus the injected writer', () => {
  const seen = new Set();
  function walk(rel) {
    if (seen.has(rel)) return;
    seen.add(rel);
    const text = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
    for (const match of text.matchAll(/from '(\.[^']+)'/gu)) {
      const resolved = path.normalize(path.join(path.dirname(rel), match[1])).split(path.sep).join('/');
      walk(resolved);
    }
  }
  walk('scripts/live/gth-intent-live.mjs');
  for (const rel of LIVE_FILES) seen.add(rel);
  assert.deepEqual([...seen].sort(), [...RUNTIME_FILES].sort());
  for (const rel of RUNTIME_FILES) {
    assert.equal(fs.existsSync(path.join(repoRoot, rel)), true, rel);
  }
});

test('the page expression waits for form items and does not click save', () => {
  const expression = buildPageExpression();
  assert.match(expression, /\.title_ a\.h-e-btn/);
  assert.match(expression, /form\.el-form\.sec-form/);
  assert.match(expression, /\.el-form-item__label/);
  assert.match(expression, /editor_items_not_rendered/);
  assert.match(expression, /querySelector\('\.el-form-item'\)/);
  assert.match(expression, /decideOpen/);
  assert.match(expression, /decideCancel/);
  assert.match(source, /src\/content\/gth-intent\.js/);
  assert.match(source, /omitAbsent/);
  assert.match(source, new RegExp(SALARY_UNIT_LOOKUP.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(source, /isKnownDictEndpoint/);
  assert.doesNotMatch(source, /perform\([^)]*['"]保存['"]/);
  assert.doesNotMatch(source, /perform\([^)]*['"]提交['"]/);
  assert.doesNotMatch(source, /perform\([^)]*['"]投递['"]/);
  assert.doesNotMatch(source, /perform\([^)]*['"]删除['"]/);
  assert.doesNotMatch(source, /perform\([^)]*['"]确定['"]/);
  assert.doesNotMatch(source, /liveSupportClaimed\s*[:=]\s*true/);
});

function resumeTarget() {
  return {
    type: 'page',
    id: 'tab-1',
    url: PAGE,
    title: '简历编辑',
    webSocketDebuggerUrl: 'ws://127.0.0.1:9239/devtools/page/tab-1'
  };
}

function fakeSession(answers) {
  const steps = [];
  return {
    steps,
    async send(method, params, options = {}) {
      steps.push(options.step || method);
      if (method !== 'Runtime.evaluate') return {};
      const value = answers[options.step];
      if (value instanceof Error) return { exceptionDetails: { text: value.message } };
      return { result: { type: 'object', value: value ?? { ok: true } } };
    },
    close() {
      steps.push('close');
    }
  };
}

function happyReadback() {
  return [
    { q: '期望工作地区', value: REGION_READBACK, reason: null },
    { q: '期望从事职位类别', value: '投资/证券/基金', reason: null },
    { q: '期望薪资', value: SALARY_ANSWER, reason: null },
    { q: '到岗日期', value: ARRIVAL_ANSWER, reason: null },
    { q: '现从事行业', value: '证券/投资/基金/信托', reason: null },
    { q: '现从事职位类别', value: '投资/证券/基金', reason: null },
    { q: '现薪资', value: '12000', reason: null }
  ];
}

function happyAnswers() {
  return {
    page_guard: { href: PAGE, title: '简历编辑', readyState: 'complete', password: false },
    chrome_shim: { ok: true, installed: true, preexisting: false },
    install_live: { ok: true },
    'inject_gth-intent': { ok: true },
    inject_check: { intent: true },
    open_intent: { ok: true, action: 'click_edit', openedByUs: true, alreadyOpen: false },
    fill_intent: {
      ok: true,
      reason: null,
      writeStarted: true,
      liveSupportClaimed: false,
      softwareClickedSave: false,
      softwareClickedSubmit: false,
      softwareClickedDelete: false,
      fields: [
        { question: '期望薪资', status: 'verified', reason: 'readback_reapplied' },
        { question: '期望工作地区', status: 'verified', reason: 'readback_reapplied' },
        { question: '到岗日期', status: 'verified', reason: 'readback_matched' }
      ]
    },
    read_intent: { ok: true, readback: happyReadback(), extraLabels: [], unlabeled: 0 },
    cancel_intent: { ok: true, closed: true, reason: null },
    read_posts: [
      { method: 'POST', url: `${SALARY_UNIT_LOOKUP}?token=secret`, via: 'xhr' },
      { method: 'POST', url: SALARY_UNIT_LOOKUP, via: 'cdp' }
    ],
    read_clicks: [
      { type: 'click', label: '编辑' },
      { type: 'click', label: '取消' }
    ]
  };
}

async function runFake(answers, { getJson } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gth-intent-live-'));
  const session = fakeSession(answers);
  const evidence = await runGthIntentLive({
    port: 9239,
    outDir: dir,
    tipSha: 'a178adaabcdef',
    stepTimeoutMs: 1000,
    getJson: getJson || (async () => [resumeTarget()]),
    connectCdp: async () => session
  });
  return { dir, session, evidence };
}

test('a fake CDP run injects the shipped writer, records readback, and cancels', async () => {
  const { evidence, session } = await runFake(happyAnswers());
  assert.equal(evidence.neverSave, true);
  assert.equal(evidence.liveSupportClaimed, false);
  assert.equal(evidence.tipSha, 'a178adaabcdef');
  assert.deepEqual(evidence.saveLikePost, []);
  assert.deepEqual(evidence.fields.map((row) => row.q), PLANNED.map((item) => item.q));
  assert.equal(evidence.fields.every((row) => row.status === 'verified'), true);
  assert.equal(evidence.fields.find((row) => row.q === '期望工作地区').value, '大兴区');
  assert.equal(evidence.fields.find((row) => row.q === '现薪资').reason, 'read_only');
  assert.equal(evidence.finalDetails.exitCode, 0);
  assert.equal(evidence.finalDetails.cancelsOk, true);
  assert.equal(evidence.finalDetails.allowedLookup, SALARY_UNIT_LOOKUP);
  assert.equal(session.steps.includes('inject_gth-intent'), true);
  assert.equal(session.steps.includes('fill_intent'), true);
  assert.equal(session.steps.includes('cancel_intent'), true);
  const file = JSON.parse(fs.readFileSync(evidence.finalDetails.path, 'utf8'));
  assert.equal(file.liveSupportClaimed, false);
  assert.equal(file.neverSave, true);
  assert.equal(file.finalDetails.baseTip, BASE_TIP);
  assert.equal(file.finalDetails.profile.customAnswers.期望工作地区, REGION_PATH);
});

test('any non-GET other than the salary-unit lookup fails, and a blocked edit skips the fill', async () => {
  const saving = happyAnswers();
  saving.read_posts = [
    { method: 'POST', url: SALARY_UNIT_LOOKUP, via: 'xhr' },
    { method: 'POST', url: 'https://hr.gtht.com/api/dict/getsalaryunit.json?token=secret', via: 'xhr' }
  ];
  const saved = await runFake(saving);
  assert.equal(saved.evidence.finalDetails.exitCode, 3);
  assert.equal(saved.evidence.finalDetails.reason, 'disallowed_non_get');
  assert.equal(saved.evidence.neverSave, true);
  assert.equal(saved.evidence.liveSupportClaimed, false);
  assert.deepEqual(saved.evidence.saveLikePost, [{
    method: 'POST',
    url: 'https://hr.gtht.com/api/dict/getsalaryunit.json',
    via: 'xhr'
  }]);

  const blocked = happyAnswers();
  blocked.open_intent = { ok: false, action: 'stop', reason: 'control_not_supported', detail: 'edit_not_found', openedByUs: false };
  const stopped = await runFake(blocked);
  assert.equal(stopped.session.steps.includes('fill_intent'), false);
  assert.equal(stopped.session.steps.includes('cancel_intent'), false);
  assert.equal(stopped.evidence.fields.every((row) => row.reason === 'control_not_supported'), true);
  assert.equal(stopped.evidence.finalDetails.exitCode, 2);
  assert.equal(stopped.evidence.liveSupportClaimed, false);
});

test('CDP unreachable and a missing tab still write never-save evidence', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gth-intent-live-down-'));
  let connected = false;
  const down = await runGthIntentLive({
    port: 9239,
    outDir: dir,
    tipSha: BASE_TIP,
    stepTimeoutMs: 1000,
    getJson: async () => { throw new Error('connect ECONNREFUSED'); },
    connectCdp: async () => { connected = true; throw new Error('no socket'); }
  });
  assert.equal(connected, false);
  assert.equal(down.finalDetails.reason, 'cdp_unreachable');
  assert.equal(down.finalDetails.exitCode, 1);
  assert.equal(down.neverSave, true);
  assert.equal(down.liveSupportClaimed, false);
  assert.deepEqual(down.saveLikePost, []);
  assert.equal(down.fields.every((row) => row.status === 'failed' && row.reason === 'cdp_unreachable'), true);

  const missing = await runGthIntentLive({
    port: 9239,
    outDir: dir,
    tipSha: BASE_TIP,
    stepTimeoutMs: 1000,
    getJson: async () => [{ type: 'page', id: 'other', url: 'https://example.com/', webSocketDebuggerUrl: 'ws://127.0.0.1:9239/devtools/page/x' }],
    connectCdp: async () => { connected = true; throw new Error('no socket'); }
  });
  assert.equal(connected, false);
  assert.equal(missing.finalDetails.reason, 'tab_not_found');
  assert.equal(missing.finalDetails.exitCode, 2);
  assert.equal(missing.fields.every((row) => row.reason === 'tab_not_found'), true);
});

test('help text names the PowerShell command', () => {
  const help = spawnSync(process.execPath, ['scripts/live/gth-intent-live.mjs', '--help'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /\$env:PORT='9239'/);
  assert.ok(help.stdout.includes(POWERSHELL));
});

function intentInner() {
  const html = intentFormHtml({
    salaries: { 期望薪资: '12000', 现薪资: '12000' },
    arrival: ''
  });
  return html.replace(/^<form\b[^>]*>/u, '').replace(/<\/form>\s*$/u, '');
}

function resumeSections() {
  return TITLES.map((title) => {
    if (title !== '求职意向') return `<section class="r-section"><div class="title_">${title}</div></section>`;
    return `<section class="r-section" id="intent-section"><div class="title_">${title}<a class="h-e-btn" id="intent-edit" href="javascript:;">编辑</a></div><div id="intent-slot"></div></section>`;
  }).join('');
}

function liveWindow(html) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, {
    url: PAGE,
    pretendToBeVisual: true,
    runScripts: 'dangerously'
  });
  const { window } = dom;
  window.Element.prototype.getClientRects = () => [{ width: 8, height: 8, top: 0, left: 0, bottom: 8, right: 8 }];
  Object.defineProperty(window.document, 'readyState', { configurable: true, get: () => 'complete' });
  const clicks = [];
  const original = window.HTMLElement.prototype.click;
  window.HTMLElement.prototype.click = function clicked() {
    clicks.push(String(this.textContent || '').replace(/\s+/gu, ' ').trim());
    return original.call(this);
  };
  window.chrome = {
    runtime: {
      id: 'synthetic-extension',
      getManifest: () => ({ background: { service_worker: 'src/background/worker.mjs' } }),
      sendMessage: async (message) => (message?.type === 'RESUME_PROFILE_BINDING_CHECK' ? { allowed: true } : { allowed: false }),
      onMessage: { addListener() {}, removeListener() {} }
    }
  };
  const hooks = window.document.createElement('script');
  hooks.textContent = buildPageExpression();
  window.document.body.appendChild(hooks);
  const writer = window.document.createElement('script');
  writer.textContent = intentSource;
  window.document.body.appendChild(writer);
  return { dom, window, clicks, api: window.__gthIntentLive };
}

function valueOf(form, label) {
  const item = [...form.querySelectorAll('.el-form-item')].find((node) => {
    const labels = [...node.querySelectorAll('.el-form-item__label')].filter((labelNode) => labelNode.closest('.el-form-item') === node);
    return labels.length === 1 && labels[0].textContent.trim() === label;
  });
  return item.querySelector('input.el-input__inner').value;
}

test('click_edit waits for late form items, then the shipped writer fills and readback matches', async () => {
  const page = liveWindow(resumeSections());
  let stats = null;
  let itemsMounted = false;
  page.window.document.getElementById('intent-edit').addEventListener('click', () => {
    page.window.document.getElementById('intent-edit').remove();
    const slot = page.window.document.getElementById('intent-slot');
    slot.innerHTML = '<form class="el-form sec-form" id="intent-form"></form>';
    const form = slot.querySelector('form');
    page.window.setTimeout(() => {
      form.insertAdjacentHTML('afterbegin', intentInner());
      stats = wireIntentForm(form);
      form.querySelector('#intent-cancel').addEventListener('click', () => form.remove());
      itemsMounted = true;
    }, 120);
  });

  const opened = await page.api.open(2);
  assert.equal(itemsMounted, true);
  assert.equal(opened.ok, true);
  assert.equal(opened.action, 'click_edit');
  const form = page.window.document.querySelector('#intent-section form');
  assert.ok(form.querySelector('.el-form-item'));
  assert.equal(valueOf(form, '期望工作地区'), '北京');
  assert.equal(valueOf(form, '期望薪资'), '12000');
  assert.equal(valueOf(form, '到岗日期'), '');
  const before = Object.fromEntries(READ_QUESTIONS.map((label) => [label, valueOf(form, label)]));

  const result = await page.window.ResumeGthIntent.trial(liveFillRequest());
  assert.equal(result.ok, true);
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.softwareClickedSave, false);
  assert.equal(assessGthIntentFill(result).ok, false);
  assert.equal(valueOf(form, '期望工作地区'), REGION_READBACK);
  assert.equal(valueOf(form, '期望薪资'), SALARY_ANSWER);
  assert.equal(valueOf(form, '到岗日期'), ARRIVAL_ANSWER);
  for (const label of READ_QUESTIONS) assert.equal(valueOf(form, label), before[label]);
  assert.equal(stats.save, 0);
  assert.equal(stats.confirm, 1);

  const read = page.api.read(2, PLANNED.map((item) => item.q));
  assert.equal(read.ok, true);
  const rows = buildFieldRows({
    questions: PLANNED.map((item) => item.q),
    fillQuestions: FILL_QUESTIONS,
    fillFields: result.fields,
    readback: read.readback,
    expected: expectedReadback(),
    extraLabels: read.extraLabels
  });
  assert.equal(rows.every((row) => row.status === 'verified'), true);
  assert.equal(rows.find((row) => row.q === '期望工作地区').value, '大兴区');
  assert.equal(rows.find((row) => row.q === '现薪资').reason, 'read_only');
  assert.equal(rows.find((row) => row.q === '现薪资').value, '12000');

  const closed = await page.api.cancel(2);
  assert.equal(closed.closed, true);
  assert.equal(page.window.document.querySelector('#intent-section form'), null);
  assert.deepEqual(Array.from(page.api.clicks(), (click) => String(click.label)), ['编辑', '取消']);
  assert.equal(page.clicks.includes('保存'), false);
  assert.equal(page.clicks.includes('确定'), true);
  assert.equal(page.clicks.includes('编辑'), true);
  assert.equal(page.clicks.includes('取消'), true);
});

test('click_edit stops when the form shell never grows .el-form-item children', async () => {
  const page = liveWindow(resumeSections());
  page.window.document.getElementById('intent-edit').addEventListener('click', () => {
    page.window.document.getElementById('intent-edit').remove();
    page.window.document.getElementById('intent-slot').innerHTML = '<form class="el-form sec-form"></form>';
  });
  const started = Date.now();
  const opened = await page.api.open(2);
  assert.ok(Date.now() - started >= 2500);
  assert.equal(opened.ok, false);
  assert.equal(opened.action, 'stop');
  assert.equal(opened.reason, 'control_not_supported');
  assert.equal(opened.detail, 'editor_items_not_rendered');
  assert.equal(opened.openedByUs, true);
  assert.equal(opened.alreadyOpen, false);
  assert.equal(page.window.document.querySelector('#intent-section form.el-form.sec-form') instanceof page.window.Element, true);
  assert.equal(page.window.document.querySelector('#intent-section .el-form-item'), null);
  assert.deepEqual(Array.from(page.api.clicks(), (click) => String(click.label)), ['编辑']);
  assert.equal(page.clicks.includes('保存'), false);
});
