// Fixed, confirmed Never-Save trials. Product writers own every field write.
import {
  LIVE_BINDING,
  LIVE_SECTIONS as OTHER_SKILLS_SECTIONS,
  expectedAnswers,
  fixedLiveProfiles
} from '../gth-other-skills-live.mjs';
import {
  FILL_QUESTIONS,
  LIVE_SECTIONS as INTENT_SECTIONS,
  buildFieldRows as buildIntentFieldRows,
  expectedReadback,
  liveFillRequestFor
} from '../gth-intent-live.mjs';
import { acceptGthMonthInPage } from '../../../src/background/gth-open-fills.mjs';
import {
  ALL_QUESTIONS as EDUCATION_QUESTIONS,
  buildFieldRows as buildEducationFieldRows,
  expectedReadback as expectedEducationReadback,
  liveFillRequest as educationLiveFillRequest
} from '../gth-education-live.mjs';

const BASIC = Object.freeze([
  ['姓名', 'fullName'], ['性别', 'gender'], ['手机号码', 'phone'],
  ['出生年月', 'birthDate'], ['电子邮件', 'email'], ['现居住地', 'currentCity'],
  ['最高学历', 'degree'], ['照片', 'photo'], ['参加工作时间', 'workStart']
]);
const EDUCATION = Object.freeze([
  ['毕业学校', 'school'], ['专业名称', 'major'], ['在校活动/职务', 'campusActivities'],
  ['在校成绩排名', 'gradeRank'], ['专业描述', 'majorDescription'], ['绩点', 'gpa'],
  ['学校所在地', 'schoolLocation'], ['学历', 'degree'], ['是否统招', 'unifiedAdmissions'],
  ['在校时间', 'startDate'], ['专业类别', 'majorCategory']
]);
const WORK = Object.freeze([
  ['职位名称', 'position'], ['职位类别', 'jobCategory'], ['公司名称', 'organization'],
  ['任职时间', 'startDate'], ['工作地区', 'workArea'], ['职责与业绩', 'description'],
  ['公司所属行业', 'industry'], ['公司介绍', 'companyIntro'], ['所属部门', 'department'],
  ['汇报对象', 'reportTo'], ['下属人数', 'subordinateCount'], ['薪资', 'salary'],
  ['离职原因', 'leaveReason']
]);

export const SECTIONS = Object.freeze([
  { id: 'basic', section: '基本信息', sectionIndex: 0, globalName: 'ResumeGthBasic', questions: BASIC.map(([q]) => q) },
  { id: 'education', section: '教育经历', sectionIndex: 1, globalName: 'ResumeGthEducationTextTrial', method: 'fullTrial', questions: EDUCATION_QUESTIONS },
  { id: 'work', section: '工作经验', sectionIndex: 3, globalName: 'ResumeGthWorkOpen', questions: WORK.map(([q]) => q) },
  ...OTHER_SKILLS_SECTIONS,
  ...INTENT_SECTIONS
].map((section) => Object.freeze({ ...section, questions: Object.freeze([...section.questions]) })));

export const LIVE_FILES = Object.freeze([
  'src/content/gth-open-fill.js',
  'src/content/gth-basic.js',
  'src/content/gth-education.js',
  'src/content/gth-work-fill.js',
  'src/content/gth-skills.js',
  'src/content/gth-other.js',
  'src/content/gth-intent.js'
]);

// Values are the existing tests/gth-basic-auto.test.mjs fixture, with its
// explicitly selected degree moved to index zero for this standalone trial.
// workStart reuses the user's 2026-10-22 Never-Save probe input.
const BASIC_PROFILE = Object.freeze({
  fullName: 'Synthetic Customer B', gender: '男', phone: '13800138000',
  birthDate: '1998-06', workStart: '2022-01', email: 'synthetic@example.com', education: [{ degree: '硕士' }],
  confirmedFields: ['fullName', 'gender', 'phone', 'birthDate', 'workStart', 'email', 'education.0.degree']
});
// Reuse the current standalone education runner's request schema and plain
// facts, plus its existing complex-control fixture values. Synthetic trial
// facts do not establish live option support and are always discarded.
const EDUCATION_ENV = Object.freeze({
  FIELDS: EDUCATION_QUESTIONS.join(','),
  DEGREE: '本科', UNIFIED_ADMISSIONS: '是',
  START_DATE: '2020-09', END_DATE: '2024-06', MAJOR_CATEGORY: '金融学'
});
// Existing tests/gth-work-fill.test.mjs ROW, with the requested 下属人数=5.
// Salary is deliberately absent: the shipped writer marks its shape unsupported.
const WORK_ROW = Object.freeze({
  position: '分析师', organization: '示例证券', description: '负责研究',
  jobCategory: '金融/保险||银行', industry: '金融||证券/投资/基金/信托',
  startDate: '2020-03', endDate: '2024-08', workArea: '上海', companyIntro: '证券公司',
  department: '研究部', reportTo: '总监', subordinateCount: '5', leaveReason: '个人发展'
});

function rowProfile(name, row) {
  return { [name]: [{ ...row }], confirmedFields: Object.keys(row).map((key) => `${name}.0.${key}`) };
}

export function requestsFor(section) {
  if (section.id === 'education') {
    return [{ questions: [...section.questions], request: {
      ...educationLiveFillRequest(EDUCATION_ENV), requestId: 'live-full-education-0001'
    } }];
  }
  if (section.id === 'intent') {
    // Reuse the standalone runner's per-field trials: later intent answers run
    // even if a cascader aborts. The other product writers have no field filter.
    return FILL_QUESTIONS.map((question, index) => ({
      questions: [question], request: liveFillRequestFor(question, index)
    }));
  }
  const profiles = fixedLiveProfiles();
  let profile = profiles[section.id];
  const extra = {};
  if (section.id === 'basic') {
    profile = { ...BASIC_PROFILE, education: [{ degree: '硕士' }], confirmedFields: [...BASIC_PROFILE.confirmedFields] };
    extra.educationIndex = 0;
  } else if (section.id === 'work') {
    profile = rowProfile('experience', WORK_ROW);
    extra.profileIndex = 0;
  }
  if (!profile) throw new Error('unknown_section');
  return [{
    questions: [...section.questions],
    request: {
      requestId: `live-full-${section.id}-0001`, profileBinding: LIVE_BINDING,
      replaceExisting: true, profile, ...extra
    }
  }];
}

export function chromeShimExpression() {
  return `(() => {
    if (typeof globalThis.__gthFullResumeChromeRestore === 'function') globalThis.__gthFullResumeChromeRestore();
    const previous = globalThis.chrome;
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'chrome');
    const acceptMonth = ${acceptGthMonthInPage.toString()};
    const monthModels = [];
    const listeners = new Set();
    const runtime = {
      id: 'gth-full-resume-live-shim',
      getManifest: () => ({ background: { service_worker: 'src/background/worker.mjs' } }),
      async sendMessage(message) {
        if (message?.type === 'RESUME_PROFILE_BINDING_CHECK') return { allowed: true };
        if (message?.type === 'GTH_MONTH_MODEL_ACCEPT') {
          // Observe the shared bridge; never replace its acceptance verdict or
          // repair a failed month by assigning input.value in the harness.
          const inputs = [...document.querySelectorAll('[data-gth-month-role="input"]')];
          const input = inputs.length === 1 ? inputs[0] : null;
          const item = input?.closest('.el-form-item');
          const question = item?.querySelector('.el-form-item__label')?.textContent.trim();
          const known = ['出生年月', '参加工作时间', '任职时间', '在校时间'].includes(question);
          const peers = item ? [...item.querySelectorAll('.el-date-editor--month input')] : [];
          const month = value => /^[0-9]{4}-(0[1-9]|1[0-2])$/u.test(String(value || '').trim()) ? String(value).trim() : null;
          const panelConnected = document.querySelectorAll('[data-gth-month-role="panel"]').length === 1;
          const result = acceptMonth({ answer: message.answer });
          monthModels.push({ question: known ? question : null,
            endpoint: known && peers.length === 2 ? ['start', 'end'][peers.indexOf(input)] || null : null,
            answer: month(message.answer), result: result.result,
            panelConnected,
            value: known ? month(input?.value) : null });
          return result;
        }
        return { allowed: false };
      },
      onMessage: {
        addListener(listener) { listeners.add(listener); },
        removeListener(listener) { listeners.delete(listener); }
      }
    };
    const host = Object.assign({}, previous || {}, { runtime });
    globalThis.chrome = host;
    if (globalThis.chrome !== host) throw new Error('chrome_shim_unavailable');
    globalThis.__gthFullResumeMonthModels = () => monthModels.map(row => ({ ...row }));
    globalThis.__gthFullResumeChromeRestore = () => {
      if (descriptor) Object.defineProperty(globalThis, 'chrome', descriptor);
      else delete globalThis.chrome;
      delete globalThis.__gthFullResumeMonthModels;
      delete globalThis.__gthFullResumeChromeRestore;
    };
    return { ok: true, installed: true, monthBridge: true };
  })()`;
}

function expectedFor(section) {
  if (section.id === 'education') return expectedEducationReadback(EDUCATION_ENV);
  if (section.id === 'intent') return expectedReadback();
  if (section.id === 'skills' || section.id === 'other') return expectedAnswers();
  const pairs = section.id === 'basic' ? BASIC : section.id === 'education' ? EDUCATION : WORK;
  const values = section.id === 'basic' ? { ...BASIC_PROFILE, degree: '硕士' } : WORK_ROW;
  const expected = Object.fromEntries(pairs.filter(([, key]) => typeof values[key] === 'string')
    .map(([q, key]) => [q, values[key].includes('||') ? values[key].split('||').at(-1) : values[key]]));
  if (section.id !== 'basic') expected[section.id === 'work' ? '任职时间' : '在校时间'] = `${values.startDate} | ${values.endDate}`;
  return expected;
}

function applyDiagnostics(section, rows, fills, read, readback) {
  const unsupported = new Set(fills.flatMap((entry) => {
    const fill = entry?.fill || entry;
    return [...(fill?.coverage || []), ...(fill?.fields || [])]
      .filter((row) => row?.reason === 'control_not_supported' || row?.supported === false)
      .map((row) => row.question);
  }));
  for (const row of rows) {
    if (row.status !== 'verified') continue;
    const observed = readback.find((item) => item?.q === row.q);
    const readReason = read?.ok === false ? read.reason || 'readback_failed'
      : !observed || typeof observed.value !== 'string' ? 'control_not_supported'
        : observed.reason && !['site_readonly', 'read_only'].includes(observed.reason) ? observed.reason : null;
    if (readReason) Object.assign(row, { status: 'failed', reason: readReason });
  }
  const pairs = section.id === 'basic' ? BASIC : section.id === 'education' ? EDUCATION : section.id === 'work' ? WORK : [];
  for (const entry of fills) {
    const forbiddenRequest = Array.isArray(entry?.forbiddenRequests) && entry.forbiddenRequests.length > 0;
    const forbiddenClick = Array.isArray(entry?.blockedClicks) && entry.blockedClicks.some((click) => click?.allowed !== true);
    if (!forbiddenRequest && !forbiddenClick) continue;
    const fill = entry.fill || entry;
    const active = fill.activeField || fill.info?.activeField;
    const question = section.questions.includes(active) ? active : pairs.find(([, key]) => key === active)?.[0];
    const requested = Array.isArray(entry.questions) ? entry.questions : section.questions;
    // Product diagnostics identify the active field. A one-field intent trial
    // also identifies it when the writer catches an error without diagnostics.
    // Without either signal, only unsettled requested rows can be attributed;
    // never overwrite a different field's already verified result.
    const affected = question ? [question] : requested.length === 1 ? requested
      : rows.filter((row) => row.status !== 'verified' && requested.includes(row.q)).map((row) => row.q);
    for (const row of rows) {
      if (!affected.includes(row.q) || unsupported.has(row.q)) continue;
      Object.assign(row, { status: 'failed', reason: forbiddenRequest ? 'non_get_request' : 'refusing_forbidden_click' });
    }
  }
  return rows;
}

export function buildFieldRows(section, fills = [], read = {}) {
  const results = fills.map((entry) => entry?.fill || entry).filter(Boolean);
  const collected = new Map();
  for (const result of results) {
    for (const row of [...(result.coverage || []), ...(result.fields || [])]) {
      if (row?.question) collected.set(row.question, row);
    }
  }
  const readback = Array.isArray(read) ? read : read?.readback || [];
  if (section.id === 'education') {
    const rows = buildEducationFieldRows({
      questions: section.questions, fillQuestions: section.questions,
      fillFields: results.flatMap(result => result.fields || []),
      readback, expected: expectedFor(section),
      trialReason: results.find(result => result.reason)?.reason
    });
    const dates = rows.find(row => row.q === '在校时间');
    if (dates) {
      const observed = readback.find(row => row?.q === dates.q);
      const months = observed?.values || dates.value?.split(' 至 ') || [];
      dates.startMonth = months[0] || null;
      dates.endMonth = months[1] || null;
    }
    for (const q of read?.extraLabels || []) {
      if (q && !rows.some(row => row.q === q)) rows.push({ q, status: 'failed', reason: 'control_not_supported', value: null });
    }
    return applyDiagnostics(section, rows, fills, read, readback);
  }
  if (section.id === 'intent') {
    // Later per-field trials also include missing/not_run placeholders for other
    // questions. Pick the row belonging to that trial's one requested answer.
    const fields = FILL_QUESTIONS.map((question, index) => {
      const entry = fills.find((candidate) => candidate?.questions?.includes(question));
      const result = entry?.fill || entry || results[index];
      return result?.fields?.find((row) => row.question === question);
    }).filter(Boolean);
    const rows = buildIntentFieldRows({
      questions: section.questions, fillQuestions: FILL_QUESTIONS, fillFields: fields,
      readback, expected: expectedReadback(), extraLabels: read?.extraLabels
    });
    return applyDiagnostics(section, rows, fills, read, readback);
  }
  const expected = expectedFor(section);
  const rows = section.questions.map((q) => {
    const fill = collected.get(q);
    const observed = readback.find((row) => row?.q === q);
    const value = typeof observed?.value === 'string' ? observed.value : null;
    let status = ['verified', 'failed', 'skipped'].includes(fill?.status) ? fill.status : 'failed';
    let reason = fill?.reason || results.find((result) => result.reason)?.reason || 'not_run';
    // Unsupported coverage remains a failure, even if an old displayed value
    // can be read. Account-owned contact fields retain site_readonly status.
    if (status === 'verified' && (!observed || observed.reason === 'control_not_supported')) {
      status = 'failed'; reason = 'control_not_supported';
    } else if (status === 'verified' && typeof expected[q] === 'string' && value !== expected[q]) {
      status = 'failed'; reason = 'readback_mismatch';
    }
    const row = { q, status, reason, value };
    if (q === '任职时间' || q === '在校时间') {
      const [startMonth, endMonth] = typeof value === 'string' ? value.split(' | ') : [];
      row.startMonth = observed?.startMonth ?? startMonth ?? null;
      row.endMonth = observed?.endMonth ?? endMonth ?? null;
    }
    return row;
  });
  for (const q of read?.extraLabels || []) {
    if (q && !rows.some((row) => row.q === q)) rows.push({ q, status: 'failed', reason: 'control_not_supported', value: null });
  }
  return applyDiagnostics(section, rows, fills, read, readback);
}
