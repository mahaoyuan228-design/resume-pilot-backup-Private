/**
 * GTH_BASIC_AUTO scaffolding smoke:
 * - trusted auto-page sender accepted; wrong sender rejected
 * - default mode=readiness probes without GTH_BASIC_TRIAL write
 * - fill path dispatches trial once and never sets saveAttempted
 * - unsettled status, a Save click, or a pre-write failure does not report ok
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGthBasicAutoRunner } from '../src/background/gth-basic-auto.mjs';
import { BASIC_PAGE, BASIC_FIELDS, basicCandidate, basicCoverage, basicJobKey } from '../src/background/basic-task-runner.mjs';
import { emptyProfile, listFilledPaths, normalizeProfile } from '../src/profile/store.js';

const epoch = '00000000-0000-4000-8000-000000000001';
const tabId = 42;
const TITLES = ['基本信息', '教育经历', '求职意向', '工作经验', '职业技能与特长', '附件简历', '其他信息'];

const fixture = () => ({
  schemaVersion: 1,
  fullName: 'Synthetic Customer B',
  gender: '男',
  phone: '13800138000',
  birthDate: '1998-06',
  workStart: '2022-01',
  email: 'synthetic@example.com',
  education: Array.from({ length: 6 }, (_, index) =>
    index === 5 ? { degree: '硕士' } : {}),
  confirmedFields: [
    'fullName', 'gender', 'phone', 'birthDate', 'email', 'workStart', 'education.5.degree',
  ],
});

async function harness({ trialResponse, statusOutcome = 'verified_preexisting', patchTrial, profile } = {}) {
  const data = {
    resumeProfile: profile || fixture(),
    resumeProfileLifecycle: { version: 1, epoch, state: 'ready' },
  };
  const clone = (value) => (value === undefined ? undefined : structuredClone(value));
  const stats = { trial: 0, status: 0, inject: 0, probe: 0, trialProfile: null };
  const storage = {
    get: async (keys) =>
      keys === null
        ? clone(data)
        : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map((key) => [key, clone(data[key])])),
    set: async (values) => Object.assign(data, clone(values)),
    remove: async (keys) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key];
    },
  };
  let runner;
  const autoSender = {
    id: 'synthetic-extension',
    url: 'chrome-extension://synthetic-extension/src/auto/gth-basic-auto.html?mode=readiness',
  };
  const badSender = {
    id: 'synthetic-extension',
    url: 'chrome-extension://synthetic-extension/src/auto/gth-education-auto.html',
  };
  const invoke = (message, sender = autoSender) =>
    new Promise((resolve) => {
      const handled = runner.listener(message, sender, resolve);
      if (handled === false) resolve({ ok: false, reason: 'listener_ignored' });
    });
  const defaultTrial = {
    ok: true,
    scope: 'gth_basic_six',
    complete: false,
    supportedComplete: false,
    operableComplete: true,
    writeStarted: false,
    editorLeftOpen: true,
    savedOnSite: null,
    submitted: null,
    softwareClickedSave: false,
    softwareClickedSubmit: false,
    softwareClickedDelete: false,
    fields: [
      { question: '姓名', path: 'fullName', status: 'verified', reason: 'preexisting_same_value' },
      { question: '性别', path: 'gender', status: 'verified', reason: 'preexisting_same_value' },
      { question: '手机号码', path: 'phone', status: 'skipped', reason: 'site_readonly', readOnlyState: 'same' },
      { question: '出生年月', path: 'birthDate', status: 'verified', reason: 'preexisting_same_value' },
      { question: '电子邮件', path: 'email', status: 'skipped', reason: 'site_readonly', readOnlyState: 'same' },
      { question: '最高学历', path: 'education.5.degree', status: 'verified', reason: 'preexisting_same_value' },
      { question: '参加工作时间', path: 'workStart', status: 'verified', reason: 'preexisting_same_value' },
    ],
  };
  // coverage must match basicCoverage(response, 5)
  defaultTrial.coverage = [
    { key: 'fullName', question: '姓名', path: 'fullName', supported: true, status: 'verified', reason: 'preexisting_same_value' },
    { key: 'gender', question: '性别', path: 'gender', supported: true, status: 'verified', reason: 'preexisting_same_value' },
    { key: 'phone', question: '手机号码', path: 'phone', supported: true, status: 'skipped', reason: 'site_readonly', readOnlyState: 'same' },
    { key: 'birthDate', question: '出生年月', path: 'birthDate', supported: true, status: 'verified', reason: 'preexisting_same_value' },
    { key: 'email', question: '电子邮件', path: 'email', supported: true, status: 'skipped', reason: 'site_readonly', readOnlyState: 'same' },
    { key: 'currentCity', question: '现居住地', path: 'currentCity', supported: false, status: 'failed', reason: 'control_not_supported' },
    { key: 'degree', question: '最高学历', path: 'education.5.degree', supported: true, status: 'verified', reason: 'preexisting_same_value' },
    { key: 'photo', question: '照片', path: null, supported: false, status: 'failed', reason: 'control_not_supported' },
    { key: 'workStart', question: '参加工作时间', path: 'workStart', supported: true, status: 'verified', reason: 'preexisting_same_value' },
  ];
  const api = {
    storage: { local: storage },
    runtime: {
      id: autoSender.id,
      getURL: (path) => 'chrome-extension://synthetic-extension/' + path,
      getManifest: () => ({ background: { service_worker: 'src/background/worker.mjs' } }),
    },
    windows: { update: async () => ({}) },
    tabs: {
      get: async () => ({ id: tabId, url: BASIC_PAGE, windowId: 1, status: 'complete' }),
      create: async () => ({ id: tabId, url: BASIC_PAGE, windowId: 1, status: 'complete' }),
      query: async (query = {}) => {
        if (query.active && query.lastFocusedWindow) {
          return [{ id: tabId, url: BASIC_PAGE, active: true }];
        }
        return [{ id: tabId, url: BASIC_PAGE, active: true, lastAccessed: Date.now() }];
      },
      update: async () => ({ id: tabId, url: BASIC_PAGE, windowId: 1 }),
      sendMessage: async (_tab, message) => {
        if (message.type === 'GTH_BASIC_TRIAL') {
          stats.trial += 1;
          stats.trialProfile = clone(message.profile);
          const body = trialResponse || defaultTrial;
          return patchTrial ? patchTrial(structuredClone(body)) : body;
        }
        if (message.type === 'GTH_BASIC_TRIAL_STATUS') {
          stats.status += 1;
          return { ok: true, data: { requestId: message.requestId, state: 'settled', outcome: statusOutcome } };
        }
        throw Error('unexpected_message:' + message.type);
      },
    },
    scripting: {
      executeScript: async (request) => {
        if (request.files) {
          stats.inject += 1;
          return [];
        }
        if (typeof request.func === 'function' && request.world === 'MAIN') {
          stats.probe += 1;
          return [{
            frameId: 0,
            result: {
              ok: true,
              reason: 'gth_page_ready',
              href: BASIC_PAGE,
              readyState: 'complete',
              visible: 'visible',
              titles: TITLES,
              editorOpen: false,
              editLinkCount: 1,
              timeOrigin: 99,
            },
          }];
        }
        return [];
      },
    },
  };
  runner = createGthBasicAutoRunner({
    api,
    timeoutMs: 5000,
    lifecycleOptions: { locks: { request: async (_n, _o, work) => work() }, cryptoImpl: globalThis.crypto },
  });
  return { invoke, stats, data, autoSender, badSender };
}

test('GTH_BASIC_AUTO rejects non-basic auto page sender', async () => {
  const h = await harness();
  const response = await h.invoke({ type: 'GTH_BASIC_AUTO', mode: 'readiness' }, h.badSender);
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'gth_basic_wrong_sender');
  assert.equal(h.stats.trial, 0);
});

test('GTH_BASIC_AUTO readiness probes without trial write', async () => {
  const h = await harness();
  const response = await h.invoke({ type: 'GTH_BASIC_AUTO', mode: 'readiness', educationIndex: 5, replaceExisting: true });
  assert.equal(response.ok, true);
  assert.equal(response.kind, 'gth_basic_auto');
  assert.equal(response.mode, 'readiness');
  assert.equal(response.writeAttempted, false);
  assert.equal(response.saveAttempted, false);
  assert.equal(response.saveAllowedByPolicy, false);
  assert.equal(h.stats.probe >= 1, true);
  assert.equal(h.stats.trial, 0);
  assert.equal(h.stats.inject, 0);
  assert.equal(response.readiness?.pageState, 'ready');
  assert.equal(response.readiness?.sources?.find((row) => row.educationIndex === 5)?.hasDegree, true);
  assert.ok(response.readiness?.sources?.find((row) => row.educationIndex === 5)?.confirmedBasics.includes('workStart'));
  assert.equal(h.data.resumeGthBasicAutoRun?.ok, true);
  assert.equal(h.data.resumeGthBasicAutoRun?.mode, 'readiness');
});

test('GTH_BASIC_AUTO defaults to readiness when mode omitted', async () => {
  const h = await harness();
  const response = await h.invoke({ type: 'GTH_BASIC_AUTO', educationIndex: 5 });
  assert.equal(response.ok, true);
  assert.equal(response.mode, 'readiness');
  assert.equal(response.writeAttempted, false);
  assert.equal(response.complete, false);
  assert.equal(response.liveSupportClaimed, false);
  assert.equal(response.readiness?.coverageReadiness?.complete, false);
  assert.equal(response.readiness?.coverageReadiness?.fillAllowed, false);
  assert.equal(response.readiness?.coverageReadiness?.saveAllowed, false);
  assert.equal(response.readiness?.coverageReadiness?.writeAttempted, false);
  assert.equal(response.readiness?.coverageReadiness?.selector, null);
  assert.equal(response.readiness?.coverageReadiness?.blocked, true);
  const closed = response.readiness?.coverageReadiness?.fields || [];
  assert.deepEqual(closed.map((row) => row.key), ['currentCity', 'photo']);
  assert.equal(closed.every((row) => row.status === 'failed' && row.supported === false), true);
  assert.equal(JSON.stringify(response).includes('已支持'), false);
  assert.equal(h.stats.trial, 0);
});

test('GTH_BASIC_AUTO fill dispatches trial once and never Save', async () => {
  const h = await harness();
  const response = await h.invoke({
    type: 'GTH_BASIC_AUTO',
    mode: 'fill',
    educationIndex: 5,
    replaceExisting: true,
    originConfirmed: true,
  });
  assert.equal(response.ok, false);
  assert.equal(response.mode, 'fill');
  assert.equal(response.reason, 'control_not_supported');
  assert.equal(response.saveAttempted, false);
  assert.equal(response.saveAllowedByPolicy, false);
  assert.equal(response.writeAttempted, false);
  assert.equal(response.complete, false);
  assert.equal(response.liveSupportClaimed, false);
  assert.equal(h.stats.inject, 1);
  assert.equal(h.stats.trial, 1);
  assert.equal(h.stats.status, 1);
  assert.equal(response.job?.state, 'unknown');
  assert.notEqual(response.job?.state, 'completed');
  assert.equal(response.job?.complete, false);
  assert.equal(response.job?.softwareClickedSave, false);
  assert.equal(response.job?.softwareClickedSubmit, false);
  assert.equal(response.job?.fields?.length, 7);
  assert.equal(h.stats.trialProfile.workStart, '2022-01');
  assert.ok(h.stats.trialProfile.confirmedFields.includes('workStart'));
  assert.deepEqual(response.job.coverage.find(row => row.key === 'workStart'), {
    key: 'workStart', question: '参加工作时间', path: 'workStart', supported: true,
    status: 'verified', reason: 'preexisting_same_value'
  });
  const city = response.job?.coverage?.find((row) => row.key === 'currentCity');
  assert.equal(city?.status, 'failed');
  assert.equal(city?.reason, 'control_not_supported');
  assert.equal(response.job?.coverage?.filter((row) => row.status === 'failed').length, 2);
  assert.equal(h.data[basicJobKey(tabId)]?.state, 'unknown');
  assert.notEqual(h.data[basicJobKey(tabId)]?.state, 'completed');
  assert.ok(h.data['resumePendingFillReview:' + tabId]);
  assert.equal(h.data.resumeGthBasicAutoRun?.saveAttempted, false);
  assert.equal(JSON.stringify(response).includes('已支持'), false);
});

test('GTH_BASIC_AUTO related GTH tab without edit → login helpNeeded', async () => {
  const data = {
    resumeProfile: fixture(),
    resumeProfileLifecycle: { version: 1, epoch, state: 'ready' },
  };
  const clone = (value) => (value === undefined ? undefined : structuredClone(value));
  const storage = {
    get: async (keys) =>
      keys === null
        ? clone(data)
        : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map((key) => [key, clone(data[key])])),
    set: async (values) => Object.assign(data, clone(values)),
    remove: async (keys) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key];
    },
  };
  const autoSender = {
    id: 'synthetic-extension',
    url: 'chrome-extension://synthetic-extension/src/auto/gth-basic-auto.html?mode=readiness',
  };
  let runner;
  const invoke = (message, sender = autoSender) =>
    new Promise((resolve) => {
      const handled = runner.listener(message, sender, resolve);
      if (handled === false) resolve({ ok: false, reason: 'listener_ignored' });
    });
  runner = createGthBasicAutoRunner({
    api: {
      storage: { local: storage },
      runtime: {
        id: autoSender.id,
        getURL: (path) => 'chrome-extension://synthetic-extension/' + path,
        getManifest: () => ({ background: { service_worker: 'src/background/worker.mjs' } }),
      },
      windows: { update: async () => ({}) },
      tabs: {
        get: async () => ({ id: 9, url: 'https://hr.gtht.com/login', windowId: 1, status: 'complete' }),
        query: async () => ([{ id: 9, url: 'https://hr.gtht.com/login', active: true, lastAccessed: Date.now() }]),
        update: async () => ({}),
        sendMessage: async () => { throw Error('unexpected'); },
      },
      scripting: { executeScript: async () => [] },
    },
    timeoutMs: 5000,
    lifecycleOptions: { locks: { request: async (_n, _o, work) => work() }, cryptoImpl: globalThis.crypto },
  });
  const response = await invoke({ type: 'GTH_BASIC_AUTO', mode: 'readiness', educationIndex: 5 });
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'gth_basic_login_or_wrong_page');
  assert.equal(response.helpNeeded, true);
  assert.equal(response.saveAttempted, false);
});

test('GTH_BASIC_AUTO fill never Save even when trial reports softwareClickedSave false only', async () => {
  const h = await harness();
  const response = await h.invoke({
    type: 'GTH_BASIC_AUTO',
    mode: 'fill',
    educationIndex: 5,
    replaceExisting: true,
    originConfirmed: true,
  });
  assert.equal(response.saveAttempted, false);
  assert.equal(response.saveAllowedByPolicy, false);
  assert.equal(response.job?.softwareClickedSave, false);
});

const fillMessage = {
  type: 'GTH_BASIC_AUTO',
  mode: 'fill',
  educationIndex: 5,
  replaceExisting: true,
  originConfirmed: true,
};

test('optional workStart survives profile normalization and enters candidates only when confirmed', () => {
  assert.equal(Object.hasOwn(emptyProfile(), 'workStart'), false);
  assert.equal(Object.hasOwn(normalizeProfile({}), 'workStart'), false);
  const confirmed = normalizeProfile({ ...fixture(), sources: { workStart: 'import' } });
  assert.equal(confirmed.workStart, '2022-01');
  assert.ok(listFilledPaths(confirmed).includes('workStart'));
  assert.ok(confirmed.confirmedFields.includes('workStart'));
  assert.equal(confirmed.sources.workStart, 'import');
  assert.equal(normalizeProfile(JSON.parse(JSON.stringify(confirmed))).workStart, '2022-01');
  assert.ok(BASIC_FIELDS.some(([question, key]) => question === '参加工作时间' && key === 'workStart'));
  assert.equal(basicCandidate(confirmed, 5).profile.workStart, '2022-01');
  const unconfirmed = { ...fixture(), confirmedFields: fixture().confirmedFields.filter(path => path !== 'workStart') };
  assert.equal(basicCandidate(unconfirmed, 5).profile.workStart, '');
  assert.ok(!basicCandidate(unconfirmed, 5).profile.confirmedFields.includes('workStart'));
  const missing = fixture();
  delete missing.workStart;
  missing.experience = [{ startDate: '2019-02' }];
  assert.equal(basicCandidate(missing, 5).profile.workStart, '', 'experience must not be used to infer workStart');
  const invalid = { ...fixture(), workStart: '2022-13' };
  assert.equal(basicCandidate(invalid, 5).profile.workStart, '2022-13', 'writer must receive explicit source for its invalid-profile diagnostic');
});

test('basicCoverage retains workStart missing, unconfirmed, and invalid source diagnostics', () => {
  for (const reason of ['missing_profile_value', 'profile_fact_unconfirmed', 'invalid_profile_value']) {
    const coverage = basicCoverage({ fields: [{ question: '参加工作时间', path: 'workStart', status: 'skipped', reason }] }, 5);
    assert.deepEqual(coverage.find(row => row.key === 'workStart'), {
      key: 'workStart', question: '参加工作时间', path: 'workStart', supported: true, status: 'skipped', reason
    });
  }
});

test('basic auto rejects legacy six-field bodies that omit workStart evidence', async () => {
  const h = await harness({ patchTrial: trial => {
    trial.fields = trial.fields.filter(row => row.path !== 'workStart');
    trial.coverage = trial.coverage.map(row => row.key === 'workStart'
      ? { ...row, path: null, supported: false, status: 'failed', reason: 'control_not_supported' } : row);
    return trial;
  } });
  const response = await h.invoke(fillMessage);
  assert.equal(response.ok, false);
  assert.equal(response.job?.state, 'unknown');
  assert.equal(response.complete, false);
  assert.equal(response.liveSupportClaimed, false);
  assert.equal(response.saveAttempted, false);
});

test('GTH_BASIC_AUTO fill fails closed when post-fill status is unsettled', async () => {
  const h = await harness({ statusOutcome: 'unknown' });
  const response = await h.invoke(fillMessage);
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'gth_basic_status_unsettled');
  assert.equal(response.saveAttempted, false);
  assert.equal(response.saveAllowedByPolicy, false);
  assert.equal(response.softwareClickedSave, false);
  assert.equal(response.job?.state, 'unknown');
  assert.notEqual(response.job?.state, 'completed');
  assert.equal(h.data[basicJobKey(tabId)]?.state, 'unknown');
  assert.equal(h.data[basicJobKey(tabId)]?.softwareClickedSave, false);
  assert.equal(h.data.resumeGthBasicAutoRun?.ok, false);
  assert.equal(h.stats.trial, 1);
});

test('GTH_BASIC_AUTO fill fails closed before write and does not complete', async () => {
  const h = await harness({
    statusOutcome: 'failed_before_write',
    trialResponse: {
      ok: false,
      writeStarted: false,
      reason: 'basic_profile_invalid',
      softwareClickedSave: false,
      softwareClickedSubmit: false,
      softwareClickedDelete: false,
    },
  });
  const response = await h.invoke(fillMessage);
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'basic_profile_invalid');
  assert.equal(response.saveAttempted, false);
  assert.equal(response.saveAllowedByPolicy, false);
  assert.equal(response.job?.state, 'stopped_before_write');
  assert.equal(response.job?.softwareClickedSave, false);
  assert.equal(h.data[basicJobKey(tabId)]?.state, 'stopped_before_write');
  assert.equal(h.data.resumeGthBasicAutoRun?.ok, false);
});

test('GTH_BASIC_AUTO fill fails closed when trial reports a Save click', async () => {
  const h = await harness({
    patchTrial: (trial) => ({ ...trial, softwareClickedSave: true, writeStarted: true }),
  });
  const response = await h.invoke(fillMessage);
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'gth_auto_software_clicked_save_forbidden');
  assert.equal(response.saveAttempted, false);
  assert.equal(response.saveAllowedByPolicy, false);
  assert.equal(response.softwareClickedSave, true);
  assert.equal(response.job?.state, 'unknown');
  assert.equal(response.job?.softwareClickedSave, true);
  assert.equal(h.data[basicJobKey(tabId)]?.state, 'unknown');
  assert.equal(h.data[basicJobKey(tabId)]?.reason, 'gth_basic_save_clicked');
  assert.equal(h.data[basicJobKey(tabId)]?.softwareClickedSave, true);
  assert.equal(h.data.resumeGthBasicAutoRun?.ok, false);
  assert.equal(h.data.resumeGthBasicAutoRun?.softwareClickedSave, true);
});

test('GTH_BASIC_AUTO fill rejects a body whose writeStarted disagrees with field reasons', async () => {
  const h = await harness({
    patchTrial: (trial) => ({ ...trial, writeStarted: true }),
  });
  const response = await h.invoke(fillMessage);
  assert.equal(response.ok, false);
  assert.equal(response.saveAttempted, false);
  assert.equal(response.saveAllowedByPolicy, false);
  assert.equal(response.softwareClickedSave, false);
  assert.equal(response.job?.state, 'unknown');
  assert.equal(h.data[basicJobKey(tabId)]?.state, 'unknown');
  assert.notEqual(h.data[basicJobKey(tabId)]?.state, 'completed');
});

test('GTH_BASIC_AUTO fill does not complete when unsupported rows are still soft-skipped', async () => {
  const h = await harness({
    patchTrial: (trial) => {
      for (const row of trial.coverage) {
        if (row.supported === false) row.status = 'skipped';
      }
      return trial;
    },
  });
  const response = await h.invoke(fillMessage);
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'gth_basic_auto_failed');
  assert.equal(response.job?.state, 'unknown');
  assert.notEqual(response.job?.state, 'completed');
  assert.equal(response.writeAttempted, false);
  assert.equal(response.saveAttempted, false);
  assert.equal(response.softwareClickedSave, false);
  assert.equal(response.job?.coverage?.every((row) => row.supported !== false || row.status === 'failed'), true);
});

test('GTH_BASIC_AUTO fill fails closed when 现居住地 is not a unique region fact', async () => {
  const pair = JSON.stringify({ province: 'Synthetic Province', city: 'Synthetic City' });
  const other = JSON.stringify({ province: 'Synthetic Province', city: 'Synthetic City B' });
  const profile = fixture();
  profile.customFacts = [
    { question: '现居住地', answer: pair, sitePageUrl: BASIC_PAGE, sectionName: '基本信息', rowContext: 'single' },
    { question: '现居住地', answer: other, sitePageUrl: BASIC_PAGE, sectionName: '基本信息', rowContext: 'single' },
  ];
  profile.customAnswers = { 现居住地: pair };
  const h = await harness({ profile });
  const response = await h.invoke(fillMessage);
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'region_fact_not_unique');
  assert.equal(response.job?.state, 'unknown');
  assert.notEqual(response.job?.state, 'completed');
  assert.equal(response.writeAttempted, false);
  assert.equal(response.saveAttempted, false);
  assert.equal(response.softwareClickedSave, false);
  assert.equal(response.softwareClickedSubmit, false);
  assert.equal(response.liveSupportClaimed, false);
  const city = response.job?.coverage?.find((row) => row.key === 'currentCity');
  assert.equal(city?.status, 'failed');
  assert.equal(city?.reason, 'region_fact_not_unique');
  assert.equal(h.data[basicJobKey(tabId)]?.state, 'unknown');
  assert.equal(JSON.stringify(response).includes('已支持'), false);
});
