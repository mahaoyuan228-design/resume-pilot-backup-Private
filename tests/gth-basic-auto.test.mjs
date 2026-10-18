/**
 * GTH_BASIC_AUTO scaffolding smoke:
 * - trusted auto-page sender accepted; wrong sender rejected
 * - default mode=readiness probes without GTH_BASIC_TRIAL write
 * - fill path dispatches trial once and never sets saveAttempted
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGthBasicAutoRunner } from '../src/background/gth-basic-auto.mjs';
import { BASIC_PAGE, basicJobKey } from '../src/background/basic-task-runner.mjs';

const epoch = '00000000-0000-4000-8000-000000000001';
const tabId = 42;
const TITLES = ['基本信息', '教育经历', '求职意向', '工作经验', '职业技能与特长', '附件简历', '其他信息'];

const fixture = () => ({
  schemaVersion: 1,
  fullName: 'Synthetic Customer B',
  gender: '男',
  phone: '13800138000',
  birthDate: '1998-06',
  email: 'synthetic@example.com',
  education: Array.from({ length: 6 }, (_, index) =>
    index === 5 ? { degree: '硕士' } : {}),
  confirmedFields: [
    'fullName', 'gender', 'phone', 'birthDate', 'email', 'education.5.degree',
  ],
});

async function harness({ trialResponse } = {}) {
  const data = {
    resumeProfile: fixture(),
    resumeProfileLifecycle: { version: 1, epoch, state: 'ready' },
  };
  const clone = (value) => (value === undefined ? undefined : structuredClone(value));
  const stats = { trial: 0, status: 0, inject: 0, probe: 0 };
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
    ],
  };
  // coverage must match basicCoverage(response, 5)
  defaultTrial.coverage = [
    { key: 'fullName', question: '姓名', path: 'fullName', supported: true, status: 'verified', reason: 'preexisting_same_value' },
    { key: 'gender', question: '性别', path: 'gender', supported: true, status: 'verified', reason: 'preexisting_same_value' },
    { key: 'phone', question: '手机号码', path: 'phone', supported: true, status: 'skipped', reason: 'site_readonly', readOnlyState: 'same' },
    { key: 'birthDate', question: '出生年月', path: 'birthDate', supported: true, status: 'verified', reason: 'preexisting_same_value' },
    { key: 'email', question: '电子邮件', path: 'email', supported: true, status: 'skipped', reason: 'site_readonly', readOnlyState: 'same' },
    { key: 'currentCity', question: '现居住地', path: 'currentCity', supported: false, status: 'skipped', reason: 'control_not_supported' },
    { key: 'degree', question: '最高学历', path: 'education.5.degree', supported: true, status: 'verified', reason: 'preexisting_same_value' },
    { key: 'photo', question: '照片', path: null, supported: false, status: 'skipped', reason: 'control_not_supported' },
    { key: 'workStart', question: '参加工作时间', path: null, supported: false, status: 'skipped', reason: 'control_not_supported' },
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
          return trialResponse || defaultTrial;
        }
        if (message.type === 'GTH_BASIC_TRIAL_STATUS') {
          stats.status += 1;
          return { ok: true, data: { requestId: message.requestId, state: 'settled', outcome: 'verified_preexisting' } };
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
  assert.equal(h.data.resumeGthBasicAutoRun?.ok, true);
  assert.equal(h.data.resumeGthBasicAutoRun?.mode, 'readiness');
});

test('GTH_BASIC_AUTO defaults to readiness when mode omitted', async () => {
  const h = await harness();
  const response = await h.invoke({ type: 'GTH_BASIC_AUTO', educationIndex: 5 });
  assert.equal(response.ok, true);
  assert.equal(response.mode, 'readiness');
  assert.equal(response.writeAttempted, false);
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
  assert.equal(response.ok, true);
  assert.equal(response.mode, 'fill');
  assert.equal(response.saveAttempted, false);
  assert.equal(response.saveAllowedByPolicy, false);
  assert.equal(h.stats.inject, 1);
  assert.equal(h.stats.trial, 1);
  assert.equal(h.stats.status, 1);
  assert.equal(response.job?.state, 'completed');
  assert.equal(response.job?.softwareClickedSave, false);
  assert.equal(response.job?.fields?.length, 6);
  assert.equal(h.data[basicJobKey(tabId)]?.state, 'completed');
  assert.equal(h.data.resumeGthBasicAutoRun?.saveAttempted, false);
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
