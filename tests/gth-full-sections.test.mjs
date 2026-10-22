import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { SECTIONS, LIVE_FILES, requestsFor, chromeShimExpression, buildFieldRows } from '../scripts/live/lib/gth-full-sections.mjs';
import { expectedReadback, FILL_QUESTIONS } from '../scripts/live/gth-intent-live.mjs';

const section = (id) => SECTIONS.find((item) => item.id === id);
const verified = (question) => ({ question, status: 'verified', reason: 'readback_matched' });
const read = (values, extra = {}) => ({ ok: true, readback: Object.entries(values).map(([q, value]) => ({ q, value })), ...extra });

test('full trial adapters reuse six section definitions and confirmed work months/subordinate count', () => {
  assert.deepEqual(SECTIONS.map((item) => item.id), ['basic', 'education', 'work', 'skills', 'other', 'intent']);
  assert.deepEqual(SECTIONS.map((item) => item.questions.length), [9, 11, 13, 1, 2, 7]);
  assert.equal(LIVE_FILES[0], 'src/content/gth-open-fill.js');
  assert.equal(LIVE_FILES.length, 7);
  assert.equal(section('education').globalName, 'ResumeGthEducationTextTrial');
  assert.equal(section('education').method, 'fullTrial');
  assert.ok(LIVE_FILES.includes('src/content/gth-education.js'));
  assert.ok(!LIVE_FILES.includes('src/content/gth-education-fill.js'));
  const [{ request }] = requestsFor(section('work'));
  assert.equal(request.profile.experience[0].subordinateCount, '5');
  assert.equal(request.profile.experience[0].startDate, '2020-03');
  assert.equal(request.profile.experience[0].endDate, '2024-08');
  for (const key of ['startDate', 'endDate', 'subordinateCount']) {
    assert.ok(request.profile.confirmedFields.includes(`experience.0.${key}`));
  }
  assert.equal(request.profileIndex, 0);
  assert.equal(requestsFor(section('basic'))[0].request.educationIndex, 0);
});

test('basic full trial carries an explicitly confirmed work-start month and checks its readback', () => {
  const current = section('basic');
  const [{ request }] = requestsFor(current);
  assert.equal(request.profile.workStart, '2022-01');
  assert.ok(request.profile.confirmedFields.includes('workStart'));
  const fills = [{ fields: [verified('参加工作时间')] }];
  assert.equal(buildFieldRows(current, fills, read({ 参加工作时间: '2022-01' }))
    .find(row => row.q === '参加工作时间').status, 'verified');
  assert.equal(buildFieldRows(current, fills, read({ 参加工作时间: '2022-09' }))
    .find(row => row.q === '参加工作时间').reason, 'readback_mismatch');
});

test('education adapter uses current fullTrial candidate schema and paired month readback', () => {
  const current = section('education');
  const [{ request }] = requestsFor(current);
  assert.equal(request.targetMode, 'existing');
  assert.equal(request.rowIndex, 0);
  assert.equal(request.profileIndex, 0);
  assert.equal(request.profile, undefined);
  const [candidate] = request.educationCandidates;
  assert.equal(candidate.school, '复旦大学');
  assert.equal(candidate.majorCategory, '金融学');
  assert.equal(candidate.confirmedPaths.length, 12);
  for (const key of ['school', 'major', 'degree', 'unifiedAdmissions', 'startDate', 'endDate', 'majorCategory']) {
    assert.ok(candidate.confirmedPaths.includes(`education.0.${key}`));
  }
  const fills = [{ fields: [verified('在校时间（开始）'), verified('在校时间（结束）'), verified('专业类别')] }];
  const rows = buildFieldRows(current, fills, {
    ok: true, readback: [
      { q: '在校时间', value: '2020-09 至 2024-06', values: ['2020-09', '2024-06'], reason: null },
      { q: '专业类别', value: '金融学', reason: null }
    ]
  });
  assert.equal(rows.find(row => row.q === '在校时间').status, 'verified');
  assert.equal(rows.find(row => row.q === '在校时间').startMonth, '2020-09');
  assert.equal(rows.find(row => row.q === '在校时间').endMonth, '2024-06');
  assert.equal(rows.find(row => row.q === '专业类别').status, 'verified');
  const partial = buildFieldRows(current, [{ fields: [verified('在校时间（开始）')] }], {
    ok: true, readback: [{ q: '在校时间', value: '2020-09 至 2024-06', reason: null }]
  });
  assert.equal(partial.find(row => row.q === '在校时间').status, 'failed');
});

test('intent adapters preserve independent one-answer trials', () => {
  const trials = requestsFor(section('intent'));
  assert.deepEqual(trials.map((trial) => trial.questions), FILL_QUESTIONS.map((q) => [q]));
  for (const trial of trials) {
    assert.equal(trial.request.omitAbsent, true);
    assert.deepEqual(Object.keys(trial.request.profile.customAnswers), trial.questions);
  }
});

test('month evidence retains both month values and existing unsupported salary coverage', () => {
  const rows = buildFieldRows(section('work'), [{
    fields: [verified('任职时间'), verified('下属人数')],
    coverage: [{ question: '薪资', status: 'failed', reason: 'control_not_supported' }]
  }], read({ 任职时间: '2020-03 | 2024-08', 下属人数: '5', 薪资: '' }));
  assert.deepEqual(rows.find((row) => row.q === '任职时间'), {
    q: '任职时间', status: 'verified', reason: 'readback_matched', value: '2020-03 | 2024-08', startMonth: '2020-03', endMonth: '2024-08'
  });
  assert.equal(rows.find((row) => row.q === '下属人数').status, 'verified');
  assert.equal(rows.find((row) => row.q === '薪资').reason, 'control_not_supported');
});

test('blocked click maps a basic product key to its field without downgrading earlier verified rows', () => {
  const rows = buildFieldRows(section('basic'), [{
    questions: section('basic').questions,
    fill: {
      ok: false, reason: 'basic_trial_failed', activeField: 'gender',
      fields: [verified('姓名')],
      coverage: [
        { question: '性别', status: 'skipped', reason: 'not_run' },
        { question: '现居住地', status: 'failed', reason: 'control_not_supported' }
      ]
    },
    blockedClicks: [{ allowed: false, label: '男' }], forbiddenRequests: []
  }], read({ 姓名: 'Synthetic Customer B', 性别: '', 现居住地: '' }));
  assert.equal(rows.find((row) => row.q === '姓名').status, 'verified');
  assert.equal(rows.find((row) => row.q === '性别').reason, 'refusing_forbidden_click');
  assert.equal(rows.find((row) => row.q === '现居住地').reason, 'control_not_supported');
});

test('non-GET evidence uses nested activeField and preserves unrelated verified values', () => {
  const rows = buildFieldRows(section('work'), [{
    questions: section('work').questions,
    fill: {
      info: { activeField: '任职时间' }, reason: 'fill_failed',
      fields: [verified('职位名称'), { question: '任职时间', status: 'failed', reason: 'fill_failed' }]
    },
    blockedClicks: [], forbiddenRequests: [{ method: 'POST', url: 'https://hr.gtht.com/save.json' }]
  }], read({ 职位名称: '分析师', 任职时间: '2020-03 | 2024-08' }));
  assert.equal(rows.find((row) => row.q === '职位名称').status, 'verified');
  assert.equal(rows.find((row) => row.q === '任职时间').reason, 'non_get_request');
});

test('intent guard failures remain on the one attempted field while later trials verify', () => {
  const fills = FILL_QUESTIONS.map((q) => ({
    questions: [q], fill: { fields: FILL_QUESTIONS.map((question) => question === q ? verified(question)
      : { question, status: 'skipped', reason: 'not_run' }) },
    blockedClicks: q === FILL_QUESTIONS[0] ? [{ allowed: false }] : [], forbiddenRequests: []
  }));
  const rows = buildFieldRows(section('intent'), fills, read({ ...expectedReadback(), 期望从事职位类别: '', 现从事行业: '', 现从事职位类别: '', 现薪资: '' }));
  assert.equal(rows.find((row) => row.q === FILL_QUESTIONS[0]).reason, 'refusing_forbidden_click');
  assert.equal(rows.find((row) => row.q === '期望薪资').status, 'verified');
  assert.equal(rows.find((row) => row.q === '到岗日期').status, 'verified');
});

test('a missing readback does not hide an attributed click refusal behind control_not_supported', () => {
  const rows = buildFieldRows(section('intent'), [{
    questions: ['期望工作地区'],
    fill: { ok: false, reason: 'fill_failed', fields: [] },
    blockedClicks: [{ allowed: false }], forbiddenRequests: []
  }], { ok: false, reason: 'editor_not_open', readback: [] });
  assert.equal(rows.find((row) => row.q === '期望工作地区').reason, 'refusing_forbidden_click');
});

test('missing, failed, or explicitly errored readbacks cannot retain verified status', () => {
  for (const id of ['basic', 'intent']) {
    const current = section(id);
    const q = id === 'basic' ? '姓名' : '期望薪资';
    const value = id === 'basic' ? 'Synthetic Customer B' : '15000';
    const fills = [{ questions: [q], fill: { fields: [verified(q)] } }];
    for (const observed of [
      { ok: false, reason: 'editor_not_open', readback: [{ q, value }] },
      { ok: true, readback: [{ q, value, reason: 'readback_unavailable' }] },
      { ok: true, readback: [] }
    ]) {
      assert.equal(buildFieldRows(current, fills, observed).find((row) => row.q === q).status, 'failed');
    }
    assert.equal(buildFieldRows(current, fills, read({ [q]: value })).find((row) => row.q === q).status, 'verified');
  }
});

test('chrome shim uses the shipped page-world month accept bridge and restores original chrome', async () => {
  const dom = new JSDOM('<!doctype html><div class="el-date-editor"><input data-gth-month-role="input" data-gth-month-answer="2024-08"></div>', {
    url: 'https://hr.gtht.com/resume/edit/', runScripts: 'outside-only'
  });
  try {
    const { window } = dom;
    const originalChrome = { sentinel: true };
    window.chrome = originalChrome;
    const editor = window.document.querySelector('.el-date-editor');
    const input = editor.querySelector('input');
    let emitted = 0;
    editor.__vue__ = { emitInput(date) {
      emitted += 1;
      input.value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    } };
    const installed = window.eval(chromeShimExpression());
    assert.equal(installed.monthBridge, true);
    const accepted = await window.chrome.runtime.sendMessage({ type: 'GTH_MONTH_MODEL_ACCEPT', answer: '2024-08' });
    assert.equal(accepted.ok, true);
    assert.equal(accepted.result, 'emitted');
    assert.equal(input.value, '2024-08');
    assert.equal(emitted, 1);
    window.__gthFullResumeChromeRestore();
    assert.equal(window.chrome, originalChrome);
  } finally { dom.window.close(); }
});
