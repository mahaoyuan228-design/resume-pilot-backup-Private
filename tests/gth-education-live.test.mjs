/**
 * Never-save GTH 教育经历 live runner.
 * The CDP attach is exercised with a fake session. The fill itself is the
 * shipped fullTrial on a jsdom editor. No Edge is required, and nothing here
 * claims the live site is supported.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import {
  ALL_QUESTIONS,
  COMPLEX_QUESTIONS,
  BASE_TIP,
  EDUCATION_INDEX,
  FILL_QUESTIONS,
  LIVE_BINDING,
  LIVE_FILES,
  PLAIN_FIELDS,
  RUNTIME_FILES,
  UNCLAIMED,
  buildEvidence,
  buildFieldRows,
  buildPageExpression,
  clicksAreDiscardOnly,
  decideCancel,
  evidenceExitCode,
  expectedReadback,
  isDisallowedNonGet,
  liveFillRequest,
  partitionTraffic,
  plainFieldsVerified,
  plannedFieldRows,
  readFillFields,
  readOutDir,
  readPort,
  readRowIndex,
  readTargetMode,
  runGthEducationLive,
  unclaimedStayUnclaimed
} from '../scripts/live/gth-education-live.mjs';

const source = fs.readFileSync(new URL('../scripts/live/gth-education-live.mjs', import.meta.url), 'utf8');
const educationSource = fs.readFileSync(new URL('../src/content/gth-education.js', import.meta.url), 'utf8');
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'https://hr.gtht.com/resume/edit/';
const TITLES = ['基本信息', '教育经历', '求职意向', '工作经验', '职业技能与特长', '附件简历', '其他信息'];
const POWERSHELL = "$env:PORT='9239'; $env:OUTDIR='C:/Users/admin/Desktop/ResumeQuickFill-Dev/_temp-scripts'; node scripts/live/gth-education-live.mjs";

function verifiedRows(reason = 'readback_reapplied') {
  return FILL_QUESTIONS.map((question) => ({ question, status: 'verified', reason }));
}

test('plain rows verify readback and leave select, radio, dates, and category unclaimed', () => {
  const expected = expectedReadback();
  const matched = buildFieldRows({
    questions: [...FILL_QUESTIONS, ...UNCLAIMED],
    fillQuestions: FILL_QUESTIONS,
    fillFields: verifiedRows(),
    readback: [
      ...FILL_QUESTIONS.map((q) => ({ q, value: expected[q], reason: null })),
      { q: '学历', value: '本科', reason: null },
      { q: '是否统招', value: '是', reason: null }
    ],
    expected
  });
  assert.equal(plainFieldsVerified(matched), true);
  assert.equal(matched.find((row) => row.q === '毕业学校').value, '复旦大学');
  assert.equal(matched.find((row) => row.q === '专业描述').reason, 'readback_reapplied');
  assert.equal(unclaimedStayUnclaimed(matched), true);
  for (const question of UNCLAIMED) {
    const row = matched.find((item) => item.q === question);
    assert.equal(row.status, 'failed');
    assert.equal(row.reason, 'control_not_supported');
    assert.equal(row.value, null);
  }

  const mismatch = buildFieldRows({
    questions: ['绩点', '学校所在地'],
    fillQuestions: ['绩点', '学校所在地'],
    fillFields: [
      { question: '绩点', status: 'verified', reason: 'readback_reapplied' },
      { question: '学校所在地', status: 'failed', reason: 'education_target_not_plain_text' }
    ],
    readback: [
      { q: '绩点', value: '2.00', reason: null },
      { q: '学校所在地', value: '上海', reason: null }
    ],
    expected,
    trialReason: 'education_editor_not_safe'
  });
  assert.deepEqual(mismatch, [
    { q: '绩点', status: 'failed', reason: 'readback_mismatch', value: '2.00' },
    { q: '学校所在地', status: 'failed', reason: 'education_target_not_plain_text', value: '上海' }
  ]);

  const closed = buildFieldRows({
    questions: ['毕业学校'],
    fillQuestions: ['毕业学校'],
    fillFields: [],
    readback: [{ q: '毕业学校', value: null, reason: 'control_not_supported' }],
    expected,
    trialReason: 'education_edit_not_unique'
  });
  assert.equal(closed[0].reason, 'education_edit_not_unique');
});

test('a narrowed FIELDS list leaves the other plain fields read-only', () => {
  const rows = buildFieldRows({
    questions: [...FILL_QUESTIONS, ...UNCLAIMED],
    fillQuestions: ['毕业学校'],
    fillFields: [{ question: '毕业学校', status: 'verified', reason: 'readback_matched' }],
    readback: FILL_QUESTIONS.map((q) => ({ q, value: q === '毕业学校' ? '复旦大学' : '已有', reason: null })),
    expected: expectedReadback()
  });
  assert.equal(rows.find((row) => row.q === '毕业学校').status, 'verified');
  assert.equal(rows.find((row) => row.q === '绩点').reason, 'read_only');
  assert.equal(rows.find((row) => row.q === '绩点').value, '已有');
  assert.equal(rows.find((row) => row.q === '学历').reason, 'control_not_supported');
});

test('every non-GET fails, including a dictionary lookup', () => {
  assert.equal(isDisallowedNonGet('POST'), true);
  assert.equal(isDisallowedNonGet('PUT'), true);
  assert.equal(isDisallowedNonGet('DELETE'), true);
  assert.equal(isDisallowedNonGet('GET'), false);
  assert.equal(isDisallowedNonGet('HEAD'), false);
  const traffic = partitionTraffic([
    { method: 'GET', url: 'https://hr.gtht.com/resume/edit/?token=secret', via: 'cdp' },
    { method: 'POST', url: 'https://hr.gtht.com/interface/js/type/getsalaryunit.json?token=secret', via: 'xhr' },
    { method: 'POST', url: 'https://hr.gtht.com/interface/js/type/getsalaryunit.json?token=secret', via: 'xhr' },
    { method: 'POST', url: 'https://hr.gtht.com/api/resume/save.json', via: 'fetch' }
  ]);
  assert.equal(traffic.nonGet.length, 2);
  assert.equal(traffic.nonGet.some((row) => row.url.includes('token')), false);
  assert.deepEqual(traffic.saveLikePost, traffic.nonGet);
});

test('cancel stays on the one type=button 取消 and discard clicks exclude save', () => {
  assert.equal(decideCancel({ cancelCount: 1, cancelText: '取消', cancelType: 'button' }).action, 'click_cancel');
  for (const cancelText of ['保存', '提交', '投递', '删除', '确定', '取消保存']) {
    assert.equal(decideCancel({ cancelCount: 1, cancelText, cancelType: 'button' }).reason, 'control_not_supported', cancelText);
  }
  assert.equal(decideCancel({ cancelCount: 1, cancelText: '取消', cancelType: 'submit' }).detail, 'cancel_not_button');
  assert.equal(decideCancel({ cancelCount: 0, cancelText: '', cancelType: '' }).detail, 'cancel_not_found');
  assert.equal(clicksAreDiscardOnly([
    { label: '编辑', allowed: true },
    { label: '取消', allowed: true }
  ]), true);
  assert.equal(clicksAreDiscardOnly([{ label: '添加', allowed: true }, { label: '取消', allowed: true }]), true);
  assert.equal(clicksAreDiscardOnly([{ label: '保存', allowed: false }]), false);
  assert.equal(clicksAreDiscardOnly([{ label: '确定', allowed: true }]), false);
  assert.equal(clicksAreDiscardOnly([{ label: '编辑', allowed: false }]), false);
});

test('evidence stays never-save and does not claim live support', () => {
  const evidence = buildEvidence({
    tipSha: BASE_TIP,
    fields: plannedFieldRows('not_run'),
    saveLikePost: [{ method: 'POST', url: 'https://hr.gtht.com/api/log', via: 'cdp' }],
    finalDetails: { liveSupportClaimed: true, neverSave: false, reason: 'disallowed_non_get', cancelsOk: true, fillQuestions: FILL_QUESTIONS }
  });
  assert.equal(evidence.tipSha, BASE_TIP);
  assert.equal(evidence.neverSave, true);
  assert.equal(evidence.liveSupportClaimed, false);
  assert.equal(evidence.finalDetails.liveSupportClaimed, false);
  assert.equal(evidence.finalDetails.neverSave, true);
  assert.equal(evidence.fields.length, FILL_QUESTIONS.length + UNCLAIMED.length);
  assert.equal(evidenceExitCode(evidence), 3);
  assert.equal(readPort({}), 9239);
  assert.equal(readPort({ PORT: '9240' }), 9240);
  assert.throws(() => readPort({ PORT: '0' }), /bad port/);
  assert.equal(path.isAbsolute(readOutDir({})), true);
  assert.equal(EDUCATION_INDEX, 1);
});

test('the fixed request confirms only plain education facts', () => {
  const request = liveFillRequest({});
  const candidate = request.educationCandidates[0];
  assert.equal(request.targetMode, 'existing');
  assert.equal(request.rowIndex, 0);
  assert.equal(request.profileIndex, 0);
  assert.equal(request.replaceExisting, true);
  assert.equal(request.profileBinding, LIVE_BINDING);
  assert.equal(LIVE_BINDING.profileHash.length, 64);
  assert.deepEqual(Object.keys(candidate).filter((key) => key !== 'profileIndex' && key !== 'confirmedPaths').sort(), PLAIN_FIELDS.map(([, key]) => key).sort());
  for (const [question, key, answer] of PLAIN_FIELDS) {
    assert.equal(candidate[key], answer);
    assert.equal(candidate.confirmedPaths.includes(`education.0.${key}`), true);
    assert.equal(expectedReadback()[question], answer);
  }
  for (const key of ['degree', 'unifiedAdmissions', 'startDate', 'endDate', 'majorCategory']) {
    assert.equal(candidate[key], undefined);
  }
  assert.equal(JSON.stringify(request).includes('学历'), false);
  const fresh = liveFillRequest({ TARGET_MODE: 'new', ROW_INDEX: '4', FIELDS: '绩点,毕业学校' });
  assert.equal(fresh.targetMode, 'new');
  assert.equal(fresh.rowIndex, undefined);
  assert.deepEqual(fresh.educationCandidates[0].confirmedPaths, ['education.0.school', 'education.0.gpa']);
  assert.deepEqual(readFillFields({}), [...FILL_QUESTIONS]);
  assert.deepEqual(readFillFields({ FIELDS: '学历' }), ['学历']);
  assert.throws(() => readFillFields({ FIELDS: '不存在' }), /bad fields/);
  assert.throws(() => liveFillRequest({ FIELDS: '学历' }), /missing DEGREE/);
  assert.throws(() => readTargetMode({ TARGET_MODE: 'add' }), /bad target-mode/);
  assert.throws(() => readRowIndex({ ROW_INDEX: '30' }), /bad row-index/);
  assert.deepEqual(LIVE_FILES, ['src/content/gth-education.js']);
  const blob = JSON.stringify(request);
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
  walk('scripts/live/gth-education-live.mjs');
  for (const rel of LIVE_FILES) seen.add(rel);
  assert.deepEqual([...seen].sort(), [...RUNTIME_FILES].sort());
});

test('the page expression guards actions while the writer requires an open editor', () => {
  const expression = buildPageExpression();
  assert.match(expression, /\.sec-context > \.sec-detail/);
  assert.match(expression, /\.el-icon-edit-outline/);
  assert.match(expression, /\.title_ a\.h-e-btn/);
  assert.match(expression, /添加/);
  assert.match(expression, /新增/);
  assert.match(educationSource, /\.sec-context > \.sec-detail/);
  assert.match(educationSource, /manual_open_editor_required/);
  assert.match(source, /ResumeGthEducationTextTrial\.fullTrial/);
  assert.match(source, /src\/content\/gth-education\.js/);
  assert.match(source, /disallowed_non_get/);
  assert.doesNotMatch(source, /perform\([^)]*['"]保存['"]/);
  assert.doesNotMatch(source, /perform\([^)]*['"]提交['"]/);
  assert.doesNotMatch(source, /perform\([^)]*['"]投递['"]/);
  assert.doesNotMatch(source, /perform\([^)]*['"]删除['"]/);
  assert.doesNotMatch(source, /perform\([^)]*['"]确定['"]/);
  assert.doesNotMatch(source, /liveSupportClaimed\s*[:=]\s*true/);
  assert.doesNotMatch(expression, /querySelector\('\.title_ a\.h-e-btn'\)[\s\S]{0,80}编辑/);
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
  const expected = expectedReadback();
  return FILL_QUESTIONS.map((q) => ({ q, value: expected[q], reason: null }));
}

function happyAnswers(fill = {}) {
  return {
    page_guard: { href: PAGE, title: '简历编辑', readyState: 'complete', password: false },
    chrome_shim: { ok: true, installed: true, preexisting: false },
    install_live: { ok: true },
    'inject_gth-education': { ok: true },
    inject_check: { fullTrial: true },
    inspect_education: { ok: true, reason: null, titleEditCount: 0, addCount: 1, rowCount: 1, rowIconCounts: [1] },
    fill_education: {
      ok: true,
      reason: null,
      writeStarted: true,
      editorLeftOpen: true,
      addClickCount: 0,
      targetMode: 'existing',
      liveSupportClaimed: false,
      softwareClickedSave: false,
      softwareClickedSubmit: false,
      softwareClickedDelete: false,
      fields: [
        ...verifiedRows(),
        { question: '学历', status: 'skipped', reason: 'missing_profile_value' },
        { question: '是否统招', status: 'skipped', reason: 'missing_profile_value' },
        { question: '在校时间（开始）', status: 'skipped', reason: 'missing_profile_value' },
        { question: '在校时间（结束）', status: 'skipped', reason: 'missing_profile_value' },
        { question: '专业类别', status: 'skipped', reason: 'missing_profile_value' }
      ],
      ...fill
    },
    read_education: { ok: true, readback: happyReadback(), extraLabels: [], unlabeled: 0 },
    cancel_education: { ok: true, closed: true, reason: null },
    read_posts: [],
    read_clicks: [
      { type: 'click', label: '编辑', allowed: true },
      { type: 'click', label: '取消', allowed: true }
    ]
  };
}

async function runFake(answers, { getJson, env } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gth-education-live-'));
  const session = fakeSession(answers);
  const evidence = await runGthEducationLive({
    port: 9239,
    outDir: dir,
    tipSha: 'a2c9a06abcdef',
    stepTimeoutMs: 1000,
    env: env || {},
    getJson: getJson || (async () => [resumeTarget()]),
    connectCdp: async () => session
  });
  return { dir, session, evidence };
}

test('a fake CDP run injects the shipped writer, records plain readback, and cancels', async () => {
  const { evidence, session } = await runFake(happyAnswers());
  assert.equal(evidence.neverSave, true);
  assert.equal(evidence.liveSupportClaimed, false);
  assert.equal(evidence.tipSha, 'a2c9a06abcdef');
  assert.deepEqual(evidence.saveLikePost, []);
  assert.equal(plainFieldsVerified(evidence.fields), true);
  assert.equal(unclaimedStayUnclaimed(evidence.fields), true);
  assert.equal(evidence.fields.find((row) => row.q === '在校活动/职务').value, '学生会学习部干事');
  assert.equal(evidence.finalDetails.exitCode, 0);
  assert.equal(evidence.finalDetails.cancelsOk, true);
  assert.equal(evidence.finalDetails.inspect.titleEditCount, 0);
  assert.equal(evidence.finalDetails.inspect.rowIconCounts[0], 1);
  assert.equal(evidence.finalDetails.moduleClaimedSupport, false);
  assert.equal(session.steps.includes('inject_gth-education'), true);
  assert.equal(session.steps.includes('fill_education'), true);
  assert.equal(session.steps.includes('cancel_education'), true);
  const file = JSON.parse(fs.readFileSync(evidence.finalDetails.path, 'utf8'));
  assert.equal(file.liveSupportClaimed, false);
  assert.equal(file.neverSave, true);
  assert.equal(file.finalDetails.baseTip, BASE_TIP);
  assert.equal(file.finalDetails.request.educationCandidates[0].school, '复旦大学');
  assert.equal(file.finalDetails.request.educationCandidates[0].degree, undefined);
});

test('FIELDS limits the confirmed facts and leaves the rest read-only', async () => {
  const answers = happyAnswers();
  answers.read_education = {
    ok: true,
    readback: FILL_QUESTIONS.map((q) => ({ q, value: q === '绩点' ? '3.70' : '已有', reason: null })),
    extraLabels: [],
    unlabeled: 0
  };
  const ran = await runFake(answers, { env: { FIELDS: '绩点' } });
  assert.deepEqual(ran.evidence.finalDetails.request.educationCandidates[0].confirmedPaths, ['education.0.gpa']);
  assert.equal(ran.evidence.finalDetails.request.educationCandidates[0].gpa, '3.70');
  assert.equal(ran.evidence.finalDetails.request.educationCandidates[0].school, undefined);
  assert.equal(ran.evidence.fields.find((row) => row.q === '绩点').status, 'verified');
  assert.equal(ran.evidence.fields.find((row) => row.q === '毕业学校').reason, 'read_only');
  assert.equal(unclaimedStayUnclaimed(ran.evidence.fields), true);
  assert.equal(ran.evidence.finalDetails.exitCode, 0);
  assert.equal(ran.evidence.liveSupportClaimed, false);
  assert.equal(ran.evidence.neverSave, true);
});

test('any non-GET fails, and a missing row edit does not claim the plain fields', async () => {
  const saving = happyAnswers();
  saving.read_posts = [{ method: 'POST', url: 'https://hr.gtht.com/api/resume/edit.json?token=secret', via: 'xhr' }];
  const saved = await runFake(saving);
  assert.equal(saved.evidence.finalDetails.exitCode, 3);
  assert.equal(saved.evidence.finalDetails.reason, 'disallowed_non_get');
  assert.equal(saved.evidence.neverSave, true);
  assert.equal(saved.evidence.liveSupportClaimed, false);
  assert.deepEqual(saved.evidence.saveLikePost, [{
    method: 'POST',
    url: 'https://hr.gtht.com/api/resume/edit.json',
    via: 'xhr'
  }]);

  const blocked = happyAnswers({
    ok: false,
    reason: 'education_edit_not_unique',
    writeStarted: false,
    editorLeftOpen: false,
    fields: []
  });
  blocked.read_education = {
    ok: false,
    reason: 'control_not_supported',
    readback: [...FILL_QUESTIONS, ...UNCLAIMED].map((q) => ({ q, value: null, reason: 'control_not_supported' })),
    extraLabels: []
  };
  blocked.cancel_education = { ok: true, closed: true, alreadyClosed: true, reason: null };
  blocked.read_clicks = [];
  const stopped = await runFake(blocked);
  assert.equal(stopped.session.steps.includes('fill_education'), true);
  assert.equal(stopped.session.steps.includes('cancel_education'), true);
  assert.equal(stopped.evidence.fields.find((row) => row.q === '毕业学校').reason, 'education_edit_not_unique');
  assert.equal(unclaimedStayUnclaimed(stopped.evidence.fields), true);
  assert.equal(stopped.evidence.finalDetails.exitCode, 2);
  assert.equal(stopped.evidence.liveSupportClaimed, false);
});

test('CDP unreachable and a missing tab still write never-save evidence', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gth-education-live-down-'));
  let connected = false;
  const down = await runGthEducationLive({
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

  const missing = await runGthEducationLive({
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
  const help = spawnSync(process.execPath, ['scripts/live/gth-education-live.mjs', '--help'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /\$env:PORT='9239'/);
  assert.match(help.stdout, /TARGET_MODE/);
  assert.match(help.stdout, /FIELDS/);
  assert.ok(help.stdout.includes(POWERSHELL));
});

function textItem(label, { tag = 'input', value = '', id = '' } = {}) {
  const control = tag === 'textarea'
    ? `<textarea id="${id}">${value}</textarea>`
    : `<input type="text" id="${id}" value="${value}">`;
  return `<div class="el-form-item"><label class="el-form-item__label">${label}</label><div class="el-form-item__content">${control}</div></div>`;
}

function educationEditorHtml() {
  const month = (id) => `<div class="el-date-editor el-date-editor--month"><span class="el-input__prefix"><i class="el-input__icon el-icon-date" id="${id}-icon"></i></span><input type="text" id="${id}" value=""></div>`;
  return `<form class="el-form sec-form" id="edu-form">
    ${textItem('毕业学校', { id: 'school', value: '旧学校' })}
    ${textItem('专业名称', { id: 'major', value: '旧专业' })}
    ${textItem('在校活动/职务', { tag: 'textarea', id: 'activities', value: '旧活动' })}
    ${textItem('在校成绩排名', { id: 'rank', value: '1/10' })}
    ${textItem('专业描述', { tag: 'textarea', id: 'description', value: '旧描述' })}
    ${textItem('绩点', { id: 'gpa', value: '2.00' })}
    ${textItem('学校所在地', { id: 'location', value: '北京' })}
    <div class="el-form-item"><label class="el-form-item__label">学历</label><div class="el-form-item__content"><div class="el-select"><input type="text" id="degree" value=""></div></div></div>
    <div class="el-form-item"><label class="el-form-item__label">是否统招</label><div class="el-form-item__content"><div class="el-radio-group"><label class="el-radio"><input type="radio" name="unified" value="是"><span class="el-radio__label">是</span></label><label class="el-radio"><input type="radio" name="unified" value="否"><span class="el-radio__label">否</span></label></div></div></div>
    <div class="el-form-item"><label class="el-form-item__label">在校时间</label><div class="el-form-item__content">${month('start')}${month('end')}</div></div>
    <div class="el-form-item"><label class="el-form-item__label">专业类别</label><div class="el-form-item__content"><div id="category-shell"></div></div></div>
    <button type="button" id="edu-cancel">取消</button>
    <button type="button" id="edu-save">保存</button>
  </form>`;
}

function resumeHtml({ mode = 'existing' } = {}) {
  return TITLES.map((title) => {
    if (title !== '教育经历') return `<section class="r-section"><div class="title_">${title}</div></section>`;
    if (mode === 'new') {
      return `<section class="r-section" id="edu-section"><div class="title_">${title}<a class="h-e-btn" id="edu-add" href="javascript:;">添加</a></div><div class="sec-context" id="edu-rows"></div></section>`;
    }
    return `<section class="r-section" id="edu-section"><div class="title_">${title}<a class="h-e-btn" id="edu-add" href="javascript:;">添加</a></div><div class="sec-context" id="edu-rows"><div class="sec-detail"><a href="javascript:;" id="edu-edit"><i class="el-icon-edit-outline"></i><span class="el-link--inner">编辑</span></a><span>已有教育</span></div></div></section>`;
  }).join('');
}

function liveWindow(html) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, {
    url: PAGE,
    pretendToBeVisual: true,
    runScripts: 'dangerously'
  });
  const { window } = dom;
  window.fetch = async () => ({ ok: true, status: 200 });
  window.Element.prototype.getClientRects = () => [{ width: 8, height: 8, top: 0, left: 0, bottom: 8, right: 8 }];
  Object.defineProperty(window.document, 'readyState', { configurable: true, get: () => 'complete' });
  Object.defineProperty(window.document, 'visibilityState', { configurable: true, get: () => 'visible' });
  const clicks = [];
  const original = window.HTMLElement.prototype.click;
  window.HTMLElement.prototype.click = function clicked() {
    clicks.push(String(this.textContent || '').replace(/[\s\u00a0]+/gu, ' ').trim());
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
  writer.textContent = educationSource;
  window.document.body.appendChild(writer);
  return { dom, window, clicks, api: window.__gthEducationLive };
}

function armEditor(window, triggerId) {
  window.document.getElementById(triggerId).addEventListener('click', () => {
    const row = window.document.getElementById('edu-edit')?.closest('.sec-detail');
    if (row) row.remove();
    const section = window.document.getElementById('edu-section');
    section.insertAdjacentHTML('beforeend', educationEditorHtml());
    section.querySelector('#edu-cancel').addEventListener('click', () => {
      section.querySelector('#edu-form').remove();
    });
  });
  // Fixture setup models the user's navigation, before the engine is invoked.
  window.document.getElementById(triggerId).click();
  const request = liveFillRequest(triggerId === 'edu-add' ? { TARGET_MODE: 'new' } : {});
  Object.assign(window.document.getElementById('edu-form').dataset, {
    resumeGthEducationRecordIndex: triggerId === 'edu-add' ? 'new' : '0',
    resumeGthEducationRequestId: request.requestId,
    resumeGthEducationProfileIndex: String(request.profileIndex),
  });
}

test('the hook blocks a non-GET and the inspect shows no title 编辑', async () => {
  const page = liveWindow(resumeHtml());
  const inspect = page.api.inspect();
  assert.equal(inspect.ok, true);
  assert.equal(inspect.titleEditCount, 0);
  assert.equal(inspect.addCount, 1);
  assert.equal(inspect.rowCount, 1);
  assert.deepEqual(Array.from(inspect.rowIconCounts), [1]);
  await assert.rejects(page.window.fetch('https://hr.gtht.com/api/resume/save.json?token=secret', { method: 'POST' }));
  const got = await page.window.fetch('https://hr.gtht.com/resume/edit/');
  assert.equal(got.ok, true);
  assert.deepEqual(Array.from(page.api.posts(), (row) => ({ via: String(row.via), method: String(row.method), url: String(row.url) })), [
    { via: 'fetch', method: 'POST', url: 'https://hr.gtht.com/api/resume/save.json' }
  ]);
  assert.equal(page.clicks.includes('保存'), false);
});

test('fullTrial fills the user-opened row and the runner cancels', async () => {
  const page = liveWindow(resumeHtml());
  armEditor(page.window, 'edu-edit');
  const result = await page.window.ResumeGthEducationTextTrial.fullTrial(liveFillRequest({}));
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.softwareClickedSave, false);
  assert.equal(result.editorLeftOpen, true);
  assert.equal(result.addClickCount, 0);
  assert.equal(page.window.document.getElementById('school').value, '复旦大学');
  assert.equal(page.window.document.getElementById('major').value, '金融学');
  assert.equal(page.window.document.getElementById('activities').value, '学生会学习部干事');
  assert.equal(page.window.document.getElementById('rank').value, '5/42');
  assert.equal(page.window.document.getElementById('description').value, '主修公司金融与财务报表分析。');
  assert.equal(page.window.document.getElementById('gpa').value, '3.70');
  assert.equal(page.window.document.getElementById('location').value, '上海');
  assert.equal(page.window.document.getElementById('degree').value, '');
  assert.equal(page.window.document.querySelector('input[value="是"]').checked, false);
  assert.equal(result.fields.find((row) => row.question === '毕业学校').reason, 'readback_reapplied');
  assert.equal(result.fields.find((row) => row.question === '学历').status, 'skipped');
  assert.equal(result.fields.find((row) => row.question === '是否统招').status, 'skipped');
  assert.equal(result.fields.find((row) => row.question === '在校时间（开始）').status, 'skipped');
  assert.equal(result.fields.find((row) => row.question === '专业类别').status, 'skipped');
  const read = page.api.read([...FILL_QUESTIONS, ...UNCLAIMED]);
  const rows = buildFieldRows({
    questions: [...FILL_QUESTIONS, ...UNCLAIMED],
    fillQuestions: FILL_QUESTIONS,
    fillFields: result.fields,
    readback: read.readback,
    expected: expectedReadback(),
    trialReason: result.reason
  });
  assert.equal(plainFieldsVerified(rows), true);
  assert.equal(unclaimedStayUnclaimed(rows), true);
  const closed = await page.api.cancel();
  assert.equal(closed.closed, true);
  assert.equal(page.window.document.querySelector('#edu-form'), null);
  assert.ok(page.window.document.getElementById('edu-add'));
  assert.deepEqual(page.clicks, ['编辑', '取消']);
  assert.equal(page.clicks.includes('保存'), false);
  assert.equal(page.clicks.includes('添加'), false);
  assert.equal(page.clicks.includes('确定'), false);
  assert.deepEqual(Array.from(page.api.clicks(), (click) => String(click.label)), ['编辑', '取消']);
});

test('fullTrial fills a user-opened new form and still does not save', async () => {
  const page = liveWindow(resumeHtml({ mode: 'new' }));
  armEditor(page.window, 'edu-add');
  const result = await page.window.ResumeGthEducationTextTrial.fullTrial(liveFillRequest({ TARGET_MODE: 'new' }));
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.addClickCount, 0);
  assert.equal(result.targetMode, 'new');
  assert.equal(result.softwareClickedSave, false);
  assert.equal(page.window.document.getElementById('school').value, '复旦大学');
  assert.equal(page.window.document.getElementById('degree').value, '');
  const closed = await page.api.cancel();
  assert.equal(closed.closed, true);
  assert.deepEqual(page.clicks, ['添加', '取消']);
  assert.equal(page.clicks.includes('保存'), false);
  assert.equal(page.clicks.includes('编辑'), false);
});


const complexEnv = {
  FIELDS: '学历,是否统招,在校时间,专业类别', DEGREE: '本科',
  UNIFIED_ADMISSIONS: '是', START_DATE: '2020-09', END_DATE: '2024-06', MAJOR_CATEGORY: '经济学/金融学'
};

test('complex trial inputs are explicit, validated, and date confirmation covers both endpoints', () => {
  const request = liveFillRequest(complexEnv);
  assert.deepEqual(request.educationCandidates[0], {
    profileIndex: 0,
    confirmedPaths: ['education.0.degree', 'education.0.unifiedAdmissions', 'education.0.startDate', 'education.0.endDate', 'education.0.majorCategory'],
    degree: '本科', unifiedAdmissions: '是', startDate: '2020-09', endDate: '2024-06', majorCategory: '经济学/金融学'
  });
  assert.equal(expectedReadback(complexEnv)['在校时间'], '2020-09 至 2024-06');
  for (const [variable, value] of [['DEGREE', ''], ['UNIFIED_ADMISSIONS', '1'], ['START_DATE', '2020-13'], ['END_DATE', '2019-09'], ['MAJOR_CATEGORY', '经济学//金融学']]) {
    assert.throws(() => liveFillRequest({ ...complexEnv, [variable]: value }), /missing|bad/, variable);
  }
  assert.throws(() => liveFillRequest({ FIELDS: '在校时间', START_DATE: '2020-09' }), /missing END_DATE/);
  // Unselected environment values never become confirmed facts.
  assert.equal(liveFillRequest({ ...complexEnv, FIELDS: '绩点' }).educationCandidates[0].degree, undefined);
});

function complexVerifiedRows() {
  return ['学历', '是否统招', '在校时间（开始）', '在校时间（结束）', '专业类别']
    .map(question => ({ question, status: 'verified', reason: 'readback_reapplied' }));
}

test('paired month evidence needs both writer outcomes and exact final endpoint readback', () => {
  const expected = expectedReadback(complexEnv);
  const build = (fillFields, value = expected['在校时间']) => buildFieldRows({
    questions: ['在校时间'], fillQuestions: ['在校时间'], fillFields,
    readback: [{ q: '在校时间', value, reason: null, dom: { itemCount: 1, controls: [{ tag: 'INPUT' }, { tag: 'INPUT' }] } }], expected
  })[0];
  assert.equal(build(complexVerifiedRows()).status, 'verified');
  const missingEnd = build(complexVerifiedRows().filter(row => row.question !== '在校时间（结束）'));
  assert.equal(missingEnd.reason, 'control_not_supported');
  assert.equal(missingEnd.detail, 'field_not_verified');
  assert.equal(missingEnd.dom.controls.length, 2);
  assert.equal(build(complexVerifiedRows(), '2020-09 至 2024-05').reason, 'readback_mismatch');
});

test('fake complex CDP run preserves diagnostics, verifies requested groups, cancels, and remains unclaimed', async () => {
  const answers = happyAnswers({ fields: [...verifiedRows(), ...complexVerifiedRows()] });
  const expected = expectedReadback(complexEnv);
  answers.read_education.readback = ALL_QUESTIONS.map(q => ({ q, value: expected[q], reason: null,
    ...(COMPLEX_QUESTIONS.includes(q) ? { dom: { itemCount: 1 }, detail: null } : {}) }));
  answers.read_clicks.splice(1, 0, { kind: 'picker_trigger', label: '', allowed: true }, { kind: 'category_confirm', label: '确定', allowed: true });
  const { evidence } = await runFake(answers, { env: complexEnv });
  assert.equal(evidence.finalDetails.exitCode, 0, evidence.finalDetails.reason);
  assert.equal(evidence.liveSupportClaimed, false);
  assert.equal(evidence.neverSave, true);
  assert.equal(evidence.fields.find(row => row.q === '在校时间').value, expected['在校时间']);
  assert.equal(evidence.fields.find(row => row.q === '专业类别').dom.itemCount, 1);
  assert.equal(evidence.finalDetails.read.readback.length, ALL_QUESTIONS.length);
  assert.equal(evidence.finalDetails.cancelsOk, true);

  answers.fill_education.fields = [{ question: '学历', status: 'skipped', reason: 'site_control_disabled' }];
  answers.read_education.readback.find(row => row.q === '学历').dom = { controls: [{ disabled: true, readOnly: true }] };
  const locked = await runFake(answers, { env: { FIELDS: '学历', DEGREE: '本科' } });
  assert.equal(locked.evidence.finalDetails.exitCode, 2);
  const row = locked.evidence.fields.find(row => row.q === '学历');
  assert.equal(row.reason, 'control_not_supported');
  assert.equal(row.detail, 'site_control_disabled');
  assert.equal(row.dom.controls[0].disabled, true);
});

test('missing traffic or click audit cannot produce a successful run', async () => {
  for (const step of ['read_posts', 'read_clicks']) {
    const answers = happyAnswers();
    answers[step] = new Error('audit unavailable');
    const { evidence } = await runFake(answers);
    assert.equal(evidence.finalDetails.exitCode, 2);
    assert.equal(evidence.finalDetails.reason, 'audit_incomplete');
  }
});


test('a final writer failure never passes even after all field readbacks verified', async () => {
  const { evidence } = await runFake(happyAnswers({ ok: false, reason: 'profile_binding_changed' }));
  assert.equal(evidence.fields.filter(row => FILL_QUESTIONS.includes(row.q)).every(row => row.status === 'verified'), true);
  assert.equal(evidence.finalDetails.cancelsOk, true);
  assert.equal(evidence.finalDetails.reason, 'profile_binding_changed');
  assert.equal(evidence.finalDetails.exitCode, 2);
});


test('an unresolved writer or unconfirmed cancellation keeps Never-Save hooks installed', async () => {
  for (const step of ['fill_education', 'cancel_education']) {
    const answers = happyAnswers();
    answers[step] = new Error('evaluation failed');
    const { evidence, session } = await runFake(answers);
    assert.equal(evidence.finalDetails.hooksRestored, false);
    assert.equal(session.steps.includes('restore_hooks'), false);
    assert.equal(evidence.finalDetails.steps.includes('retain_hooks'), true);
    assert.notEqual(evidence.finalDetails.exitCode, 0);
  }
});
