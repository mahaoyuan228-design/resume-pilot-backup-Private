/**
 * GTH_OTHER_AUTO scaffolding smoke:
 * - trusted auto-page sender accepted; wrong sender rejected
 * - default mode=readiness probes without other fill
 * - fill path injects once, never sets saveAttempted
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGthOtherAutoRunner } from '../src/background/gth-other-auto.mjs';

const epoch = '00000000-0000-4000-8000-000000000001';
const tabId = 42;
const PAGE = 'https://hr.gtht.com/resume/edit/';
const SECTION = '其他信息';
const QUESTIONS = ['描述', '标题'];
const TITLES = ['基本信息', '教育经历', '求职意向', '工作经验', '职业技能与特长', '附件简历', '其他信息'];

const ANSWERS = { '标题': 'Synthetic other title', '描述': 'Synthetic other desc' };

function siteFacts(answers, section = SECTION) {
  return Object.entries(answers).map(([question, answer]) => ({
    question, answer, sitePageUrl: PAGE, sectionName: section, rowContext: 'none',
  }));
}

const fixture = () => ({
  schemaVersion: 1,
  fullName: 'Synthetic Customer B',
  customAnswers: { ...ANSWERS },
  confirmedFields: ['标题', '描述'].map((question) => `customAnswers.${question}`),
  customFacts: siteFacts(ANSWERS),
});

async function harness({ fillResponse } = {}) {
  const data = {
    resumeProfile: fixture(),
    resumeProfileLifecycle: { version: 1, epoch, state: 'ready' },
  };
  const clone = (value) => (value === undefined ? undefined : structuredClone(value));
  const stats = { inject: 0, fill: 0, probe: 0, files: null };
  const sent = [];
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
    url: 'chrome-extension://synthetic-extension/src/auto/gth-other-auto.html?mode=readiness',
  };
  const badSender = {
    id: 'synthetic-extension',
    url: 'chrome-extension://synthetic-extension/src/auto/gth-simple-auto.html',
  };
  const invoke = (message, sender = autoSender) =>
    new Promise((resolve) => {
      const handled = runner.listener(message, sender, resolve);
      if (handled === false) resolve({ ok: false, reason: 'listener_ignored' });
    });
  const defaultFill = fillResponse || {
    ok: true,
    complete: false,
    scope: 'gth_other_two',
    section: SECTION,
    supportedComplete: true,
    operableComplete: true,
    writeStarted: false,
    editorLeftOpen: true,
    savedOnSite: null,
    submitted: null,
    softwareClickedSave: false,
    softwareClickedSubmit: false,
    softwareClickedDelete: false,
    liveSupportClaimed: false,
    fields: ['标题', '描述'].map((question) => ({
      question,
      path: `customAnswers.${question}`,
      labels: [question],
      status: 'verified',
      reason: 'preexisting_same_value',
    })),
  };
  const api = {
    storage: { local: storage },
    runtime: {
      id: autoSender.id,
      getURL: (path) => 'chrome-extension://synthetic-extension/' + path,
      getManifest: () => ({ background: { service_worker: 'src/background/worker.mjs' } }),
    },
    windows: { update: async () => ({}) },
    tabs: {
      get: async () => ({ id: tabId, url: PAGE, windowId: 1, status: 'complete' }),
      create: async () => ({ id: tabId, url: PAGE, windowId: 1, status: 'complete' }),
      query: async (query = {}) => {
        if (query.active && query.lastFocusedWindow) {
          return [{ id: tabId, url: PAGE, active: true }];
        }
        return [{ id: tabId, url: PAGE, active: true, lastAccessed: Date.now() }];
      },
      update: async () => ({ id: tabId, url: PAGE, windowId: 1 }),
      sendMessage: async (_tabId, message) => {
        if (message?.type === 'GTH_OTHER_FILL') {
          stats.fill += 1;
          sent.push(message);
          return defaultFill;
        }
        throw Error('unexpected_sendMessage');
      },
    },
    scripting: {
      executeScript: async (request) => {
        if (request.files) {
          stats.inject += 1;
          stats.files = request.files;
          return [];
        }
        if (typeof request.func === 'function' && (request.world === 'MAIN' || request.world === 'ISOLATED')) {
          const src = String(request.func);
          if (src.includes('expectedTitles') || src.includes('r-section')) {
            stats.probe += 1;
            return [{
              frameId: 0,
              result: {
                ok: true,
                reason: 'gth_page_ready',
                href: PAGE,
                readyState: 'complete',
                visible: 'visible',
                titles: TITLES,
                editorOpen: false,
                editLinkCount: 1,
                timeOrigin: 99,
                sectionIndex: 6,
                sectionName: SECTION,
              },
            }];
          }
          stats.fill += 1;
          return [{ frameId: 0, result: defaultFill }];
        }
        return [];
      },
    },
  };
  runner = createGthOtherAutoRunner({
    api,
    timeoutMs: 5000,
    lifecycleOptions: { locks: { request: async (_n, _o, work) => work() }, cryptoImpl: globalThis.crypto },
  });
  return { invoke, stats, sent, data, autoSender, badSender };
}

test('GTH_OTHER_AUTO rejects non-other auto page sender', async () => {
  const h = await harness();
  const response = await h.invoke({ type: 'GTH_OTHER_AUTO', mode: 'readiness' }, h.badSender);
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'gth_other_wrong_sender');
  assert.equal(h.stats.fill, 0);
});

test('GTH_OTHER_AUTO readiness probes without other fill', async () => {
  const h = await harness();
  const response = await h.invoke({ type: 'GTH_OTHER_AUTO', mode: 'readiness' });
  assert.equal(response.ok, true);
  assert.equal(response.kind, 'gth_other_auto');
  assert.equal(response.mode, 'readiness');
  assert.equal(response.writeAttempted, false);
  assert.equal(response.saveAttempted, false);
  assert.equal(response.saveAllowedByPolicy, false);
  assert.equal(h.stats.probe >= 1, true);
  assert.equal(h.stats.fill, 0);
  assert.equal(h.stats.inject, 0);
  assert.equal(response.readiness?.pageState, 'ready');
  assert.equal(response.readiness?.other?.ready, true);
  assert.equal(response.liveSupportClaimed, false);
  assert.equal(response.complete, false);
  assert.equal(h.data.resumeGthOtherAutoRun?.ok, true);
});

test('GTH_OTHER_AUTO defaults to readiness when mode omitted', async () => {
  const h = await harness();
  const response = await h.invoke({ type: 'GTH_OTHER_AUTO' });
  assert.equal(response.ok, true);
  assert.equal(response.mode, 'readiness');
  assert.equal(response.writeAttempted, false);
  assert.equal(h.stats.fill, 0);
});

test('GTH_OTHER_AUTO fill injects once and never Save', async () => {
  const h = await harness();
  const response = await h.invoke({
    type: 'GTH_OTHER_AUTO',
    mode: 'fill',
    originConfirmed: true,
  });
  assert.equal(response.ok, true);
  assert.equal(response.mode, 'fill');
  assert.equal(response.saveAttempted, false);
  assert.equal(response.saveAllowedByPolicy, false);
  assert.equal(h.stats.inject, 1);
  assert.equal(h.stats.fill, 1);
  assert.equal(response.job?.state, 'completed');
  assert.equal(response.job?.softwareClickedSave, false);
  assert.equal(response.job?.liveSupportClaimed, false);
  assert.equal(response.liveSupportClaimed, false);
  assert.equal(response.complete, false);
  assert.equal(response.job?.fields?.length, 2);
  assert.deepEqual(h.stats.files, ['src/content/gth-open-fill.js', 'src/content/gth-other.js']);
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].type, 'GTH_OTHER_FILL');
  assert.equal(h.sent[0].answers, undefined);
  assert.equal(h.sent[0].replaceExisting, false);
  assert.deepEqual(h.sent[0].profile, {
    customAnswers: { ...ANSWERS },
    confirmedFields: ['customAnswers.标题', 'customAnswers.描述'],
    customFacts: [
      { question: '标题', answer: ANSWERS['标题'], sitePageUrl: PAGE, sectionName: SECTION, rowContext: 'none' },
      { question: '描述', answer: ANSWERS['描述'], sitePageUrl: PAGE, sectionName: SECTION, rowContext: 'none' },
    ],
  });
  assert.equal(h.sent[0].profile.fullName, undefined);
  assert.equal(h.data.resumeGthOtherAutoRun?.saveAttempted, false);
});


test('GTH_OTHER_AUTO otherSource ready only with confirmed site facts for 描述+标题', async () => {
  const h = await harness();
  const runner = createGthOtherAutoRunner({
    api: {
      storage: { local: { get: async () => ({}), set: async () => {}, remove: async () => {} } },
      runtime: {
        id: 'x',
        getURL: (p) => 'chrome-extension://x/' + p,
        getManifest: () => ({ background: { service_worker: 'src/background/worker.mjs' } }),
      },
      tabs: {},
      scripting: {},
    },
  });
  assert.equal(runner.otherSource({ customAnswers: {}, confirmedFields: [] }).ready, false);
  assert.equal(runner.otherSource({
    customAnswers: { '描述': 'x', '标题': 'y' },
    confirmedFields: [],
  }).hasAllAnswers, true);
  assert.equal(runner.otherSource({
    customAnswers: { '描述': 'x', '标题': 'y' },
    confirmedFields: [],
  }).ready, false);
  assert.equal(runner.otherSource({
    customAnswers: { '描述': 'x', '标题': 'y' },
    confirmedFields: ['customAnswers.描述', 'customAnswers.标题'],
  }).ready, false);
  const facts = siteFacts({ '描述': 'x', '标题': 'y' });
  assert.equal(runner.otherSource({
    customAnswers: { '描述': 'x', '标题': 'y' },
    confirmedFields: ['customAnswers.描述', 'customAnswers.标题'],
    customFacts: facts,
  }).ready, true);
  assert.equal(runner.otherSource({
    customAnswers: { '描述': ' ', '标题': 'y' },
    confirmedFields: ['customAnswers.描述', 'customAnswers.标题'],
    customFacts: facts,
  }).hasAllAnswers, false);
  assert.equal(runner.otherSource({
    customAnswers: { '描述': 'x', '标题': 'y' },
    confirmedFields: ['customAnswers.描述', 'customAnswers.标题'],
    customFacts: facts.map((fact) => ({ ...fact, sectionName: '别的分区' })),
  }).ready, false);
});

test('GTH_OTHER_AUTO fill fail-closed missing_profile_value', async () => {
  const h = await harness();
  h.data.resumeProfile = { schemaVersion: 1, fullName: 'Synthetic', customAnswers: {}, confirmedFields: [] };
  const response = await h.invoke({ type: 'GTH_OTHER_AUTO', mode: 'fill', originConfirmed: true });
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'missing_profile_value');
  assert.equal(response.saveAttempted, false);
  assert.equal(response.liveSupportClaimed, false);
  assert.equal(h.stats.fill, 0);
});

test('GTH_OTHER_AUTO fill fail-closed profile_fact_unconfirmed', async () => {
  const h = await harness();
  h.data.resumeProfile = {
    schemaVersion: 1,
    fullName: 'Synthetic',
    customAnswers: { '描述': 'x', '标题': 'y' },
    confirmedFields: [],
  };
  const response = await h.invoke({ type: 'GTH_OTHER_AUTO', mode: 'fill', originConfirmed: true });
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'profile_fact_unconfirmed');
  assert.equal(response.saveAttempted, false);
  assert.equal(response.liveSupportClaimed, false);
  assert.equal(h.stats.fill, 0);
});

test('GTH_OTHER_AUTO fill fail-closed when confirmed answers have no site fact', async () => {
  const h = await harness();
  h.data.resumeProfile = {
    schemaVersion: 1,
    fullName: 'Synthetic',
    customAnswers: { '描述': 'TEST', '标题': 'TEST' },
    confirmedFields: ['customAnswers.描述', 'customAnswers.标题'],
  };
  const response = await h.invoke({ type: 'GTH_OTHER_AUTO', mode: 'fill', originConfirmed: true });
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'profile_fact_unconfirmed');
  assert.equal(response.liveSupportClaimed, false);
  assert.equal(response.saveAttempted, false);
  assert.equal(h.stats.fill, 0);
});

test('GTH_OTHER_AUTO keeps liveSupportClaimed false when the page claims support', async () => {
  const claimed = {
    ok: true,
    complete: false,
    scope: 'gth_other_two',
    section: SECTION,
    supportedComplete: true,
    operableComplete: true,
    writeStarted: false,
    editorLeftOpen: true,
    savedOnSite: null,
    submitted: null,
    softwareClickedSave: false,
    softwareClickedSubmit: false,
    softwareClickedDelete: false,
    liveSupportClaimed: true,
    fields: ['标题', '描述'].map((question) => ({
      question,
      path: `customAnswers.${question}`,
      labels: [question],
      status: 'verified',
      reason: 'preexisting_same_value',
    })),
  };
  const h = await harness({ fillResponse: claimed });
  const response = await h.invoke({ type: 'GTH_OTHER_AUTO', mode: 'fill', originConfirmed: true });
  assert.equal(response.ok, false);
  assert.equal(response.liveSupportClaimed, false);
  assert.equal(response.job?.liveSupportClaimed, false);
  assert.equal(response.saveAttempted, false);
});

test('GTH_OTHER_AUTO related GTH tab without edit → login helpNeeded', async () => {
  const data = {
    resumeProfile: { schemaVersion: 1, fullName: 'S', customAnswers: {}, confirmedFields: [] },
    resumeProfileLifecycle: { version: 1, epoch: '00000000-0000-4000-8000-000000000001', state: 'ready' },
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
    url: 'chrome-extension://synthetic-extension/src/auto/gth-other-auto.html?mode=readiness',
  };
  let runner;
  const invoke = (message, sender = autoSender) =>
    new Promise((resolve) => {
      const handled = runner.listener(message, sender, resolve);
      if (handled === false) resolve({ ok: false, reason: 'listener_ignored' });
    });
  runner = createGthOtherAutoRunner({
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
  const response = await invoke({ type: 'GTH_OTHER_AUTO', mode: 'readiness' });
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'gth_other_login_or_wrong_page');
  assert.equal(response.helpNeeded, true);
  assert.equal(response.saveAttempted, false);
});

function otherFill(extra = {}) {
  return {
    ok: true,
    sectionName: SECTION,
    editorLeftOpen: true,
    writeStarted: false,
    savedOnSite: false,
    submitted: false,
    softwareClickedSave: false,
    softwareClickedSubmit: false,
    fields: QUESTIONS.map((question) => ({ question, status: 'verified', reason: 'preexisting_same_value' })),
    ...extra,
  };
}

test('GTH_OTHER_AUTO fill fails closed when fields are unsettled', async () => {
  const h = await harness({ fillResponse: otherFill({ fields: [], reason: 'gth_other_fill_invalid' }) });
  const response = await h.invoke({ type: 'GTH_OTHER_AUTO', mode: 'fill', originConfirmed: true });
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'gth_other_fill_invalid');
  assert.equal(response.job?.state, 'unknown');
  assert.equal(response.saveAttempted, false);
});

test('GTH_OTHER_AUTO keeps savedOnSite and does not report ok', async () => {
  const h = await harness({ fillResponse: otherFill({ savedOnSite: true, submitted: true }) });
  const response = await h.invoke({ type: 'GTH_OTHER_AUTO', mode: 'fill', originConfirmed: true });
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'gth_other_save_policy_violated');
  assert.equal(response.job?.state, 'unknown');
  assert.equal(response.savedOnSite, true);
  assert.equal(response.submitted, true);
  assert.equal(response.job?.savedOnSite, true);
  assert.equal(response.saveAttempted, false);
  assert.equal(h.data.resumeGthOtherAutoRun?.ok, false);
  assert.equal(h.data.resumeGthOtherAutoRun?.savedOnSite, true);
});
