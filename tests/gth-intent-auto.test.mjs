/**
 * GTH_INTENT_AUTO scaffolding smoke:
 * - trusted auto-page sender accepted; wrong sender rejected
 * - default mode=readiness probes without intent fill
 * - fill path injects matcher+engine once, sendMessage GTH_INTENT_TEST, never Save
 * - intentSource ready only with five confirmed site facts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGthIntentAutoRunner, intentSource } from '../src/background/gth-intent-auto.mjs';

const epoch = '00000000-0000-4000-8000-000000000001';
const tabId = 42;
const PAGE = 'https://hr.gtht.com/resume/edit/';
const SECTION = '求职意向';
const QUESTIONS = ['期望从事职位类别', '期望薪资', '现从事行业', '现从事职位类别', '现薪资'];
const TITLES = ['基本信息', '教育经历', '求职意向', '工作经验', '职业技能与特长', '附件简历', '其他信息'];

const answers = {
  '期望从事职位类别': '投资银行',
  '期望薪资': '300000',
  '现从事行业': '证券',
  '现从事职位类别': '研究员',
  '现薪资': '200000',
};

const fixture = () => ({
  schemaVersion: 1,
  fullName: 'Synthetic Customer B',
  customAnswers: { ...answers },
  confirmedFields: QUESTIONS.map((q) => `customAnswers.${q}`),
  customFacts: QUESTIONS.map((question) => ({
    question,
    answer: answers[question],
    sitePageUrl: PAGE,
    sectionName: SECTION,
    rowContext: 'none',
  })),
});

async function harness({ fillResponse } = {}) {
  const data = {
    resumeProfile: fixture(),
    resumeProfileLifecycle: { version: 1, epoch, state: 'ready' },
  };
  const clone = (value) => (value === undefined ? undefined : structuredClone(value));
  const stats = { inject: 0, fill: 0, probe: 0, sendMessage: 0 };
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
    url: 'chrome-extension://synthetic-extension/src/auto/gth-intent-auto.html?mode=readiness',
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
    data: {
      experimental: true,
      editorLeftOpen: true,
      savedOnSite: null,
      submitted: null,
      softwareClickedSave: false,
      softwareClickedSubmit: false,
      fields: QUESTIONS.map((question) => ({
        id: `gth:求职意向:${question}`,
        labels: [question],
        status: 'verified',
        reason: 'preexisting_same_value',
      })),
    },
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
        stats.sendMessage += 1;
        assert.equal(message.type, 'GTH_INTENT_TEST');
        assert.equal(typeof message.requestId, 'string');
        assert.ok(message.profileBinding);
        for (const q of QUESTIONS) assert.equal(message.answers[q], answers[q]);
        stats.fill += 1;
        return defaultFill;
      },
    },
    scripting: {
      executeScript: async (request) => {
        if (request.files) {
          stats.inject += 1;
          assert.deepEqual(request.files, ['src/core/matcher.js', 'src/content/engine.js']);
          return [];
        }
        if (typeof request.func === 'function' && request.world === 'MAIN') {
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
              sectionIndex: 2,
              sectionName: SECTION,
              sectionFormCount: 0,
              otherFormCount: 0,
            },
          }];
        }
        return [];
      },
    },
  };
  runner = createGthIntentAutoRunner({
    api,
    timeoutMs: 5000,
    lifecycleOptions: { locks: { request: async (_n, _o, work) => work() }, cryptoImpl: globalThis.crypto },
  });
  return { invoke, stats, data, autoSender, badSender };
}

test('GTH_INTENT_AUTO rejects non-intent auto page sender', async () => {
  const h = await harness();
  const response = await h.invoke({ type: 'GTH_INTENT_AUTO', mode: 'readiness' }, h.badSender);
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'gth_intent_wrong_sender');
  assert.equal(h.stats.fill, 0);
});

test('GTH_INTENT_AUTO readiness probes without intent fill', async () => {
  const h = await harness();
  const response = await h.invoke({ type: 'GTH_INTENT_AUTO', mode: 'readiness' });
  assert.equal(response.ok, true);
  assert.equal(response.kind, 'gth_intent_auto');
  assert.equal(response.mode, 'readiness');
  assert.equal(response.writeAttempted, false);
  assert.equal(response.saveAttempted, false);
  assert.equal(response.saveAllowedByPolicy, false);
  assert.equal(h.stats.probe >= 1, true);
  assert.equal(h.stats.fill, 0);
  assert.equal(h.stats.inject, 0);
  assert.equal(h.stats.sendMessage, 0);
  assert.equal(response.readiness?.pageState, 'ready');
  assert.equal(response.readiness?.intent?.ready, true);
  assert.equal(response.readiness?.intent?.readyCount, 5);
  assert.equal(h.data.resumeGthIntentAutoRun?.ok, true);
});

test('GTH_INTENT_AUTO defaults to readiness when mode omitted', async () => {
  const h = await harness();
  const response = await h.invoke({ type: 'GTH_INTENT_AUTO' });
  assert.equal(response.ok, true);
  assert.equal(response.mode, 'readiness');
  assert.equal(response.writeAttempted, false);
  assert.equal(h.stats.fill, 0);
});

test('GTH_INTENT_AUTO fill injects engine once, sendMessage, never Save', async () => {
  const h = await harness();
  const response = await h.invoke({
    type: 'GTH_INTENT_AUTO',
    mode: 'fill',
    originConfirmed: true,
  });
  assert.equal(response.ok, true);
  assert.equal(response.mode, 'fill');
  assert.equal(response.saveAttempted, false);
  assert.equal(response.saveAllowedByPolicy, false);
  assert.equal(h.stats.inject, 1);
  assert.equal(h.stats.sendMessage, 1);
  assert.equal(h.stats.fill, 1);
  assert.equal(response.job?.state, 'completed');
  assert.equal(response.job?.softwareClickedSave, false);
  assert.equal(response.job?.fields?.length, 5);
  assert.equal(h.data.resumeGthIntentAutoRun?.saveAttempted, false);
});

test('intentSource ready only with five confirmed site facts', () => {
  assert.equal(intentSource({ customAnswers: {}, confirmedFields: [], customFacts: [] }).ready, false);
  const partial = fixture();
  delete partial.customAnswers['期望薪资'];
  assert.equal(intentSource(partial).ready, false);
  assert.ok(intentSource(partial).missing.includes('期望薪资'));
  const unconfirmed = fixture();
  unconfirmed.confirmedFields = [];
  assert.equal(intentSource(unconfirmed).ready, false);
  assert.equal(intentSource(unconfirmed).unconfirmed.length, 5);
  assert.equal(intentSource(fixture()).ready, true);
});

test('GTH_INTENT_AUTO fill fail-closed missing_profile_value', async () => {
  const h = await harness();
  h.data.resumeProfile = { schemaVersion: 1, fullName: 'Synthetic', customAnswers: {}, confirmedFields: [], customFacts: [] };
  const response = await h.invoke({ type: 'GTH_INTENT_AUTO', mode: 'fill', originConfirmed: true });
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'missing_profile_value');
  assert.equal(response.saveAttempted, false);
  assert.equal(h.stats.fill, 0);
  assert.equal(h.stats.sendMessage, 0);
});

test('GTH_INTENT_AUTO fill fail-closed profile_fact_unconfirmed', async () => {
  const h = await harness();
  h.data.resumeProfile = {
    schemaVersion: 1,
    fullName: 'Synthetic',
    customAnswers: { ...answers },
    confirmedFields: [],
    customFacts: [],
  };
  const response = await h.invoke({ type: 'GTH_INTENT_AUTO', mode: 'fill', originConfirmed: true });
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'profile_fact_unconfirmed');
  assert.equal(response.saveAttempted, false);
  assert.equal(h.stats.fill, 0);
});

test('GTH_INTENT_AUTO fill fail-closed origin_unconfirmed', async () => {
  const h = await harness();
  const response = await h.invoke({ type: 'GTH_INTENT_AUTO', mode: 'fill' }); // no originConfirmed
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'intent_job_origin_unconfirmed');
  assert.equal(response.saveAttempted, false);
  assert.equal(h.stats.sendMessage, 0);
});

test('GTH_INTENT_AUTO related GTH tab without edit → login helpNeeded', async () => {
  const data = {
    resumeProfile: { schemaVersion: 1, fullName: 'S', customAnswers: {}, confirmedFields: [], customFacts: [] },
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
    url: 'chrome-extension://synthetic-extension/src/auto/gth-intent-auto.html?mode=readiness',
  };
  let runner;
  const invoke = (message, sender = autoSender) =>
    new Promise((resolve) => {
      const handled = runner.listener(message, sender, resolve);
      if (handled === false) resolve({ ok: false, reason: 'listener_ignored' });
    });
  runner = createGthIntentAutoRunner({
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
  const response = await invoke({ type: 'GTH_INTENT_AUTO', mode: 'readiness' });
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'gth_intent_login_or_wrong_page');
  assert.equal(response.helpNeeded, true);
  assert.equal(response.saveAttempted, false);
});
