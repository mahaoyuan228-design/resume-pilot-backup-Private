/**
 * GTH education auto fill fails closed:
 * - unsettled trial status does not report ok
 * - a Save claim is kept and does not report ok
 * - verified_preexisting still completes without a save claim
 * Offline only. No site is claimed supported.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGthEducationAutoRunner } from '../src/background/gth-education-auto.mjs';
import { EDUCATION_FIELDS, educationJobKey } from '../src/background/education-task-runner.mjs';

const epoch = '00000000-0000-4000-8000-000000000001';
const tabId = 42;
const PAGE = 'https://hr.gtht.com/resume/edit/';
const TITLES = ['基本信息', '教育经历', '求职意向', '工作经验', '职业技能与特长', '附件简历', '其他信息'];

function fields() {
  return EDUCATION_FIELDS.map(([question, key]) => ({
    question,
    path: `education.0.${key}`,
    status: 'verified',
    reason: 'preexisting_same_value',
  }));
}

function trialBody(extra = {}) {
  return {
    ok: true,
    editorLeftOpen: true,
    savedOnSite: null,
    submitted: null,
    softwareClickedSave: false,
    softwareClickedSubmit: false,
    softwareClickedDelete: false,
    writeStarted: false,
    targetMode: 'existing',
    complete: true,
    fields: fields(),
    ...extra,
  };
}

async function harness({ trialExtra = {}, statusOutcome = 'verified_preexisting' } = {}) {
  const data = {
    resumeProfile: {
      schemaVersion: 1,
      fullName: 'Synthetic',
      education: [{ school: 'Synthetic U' }],
      confirmedFields: [],
    },
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
  let runner;
  let seenRequestId = '';
  const autoSender = {
    id: 'synthetic-extension',
    url: 'chrome-extension://synthetic-extension/src/auto/gth-education-auto.html?mode=fill',
  };
  const invoke = (message, sender = autoSender) =>
    new Promise((resolve) => {
      const handled = runner.listener(message, sender, resolve);
      if (handled === false) resolve({ ok: false, reason: 'listener_ignored' });
    });
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
      query: async () => [{ id: tabId, url: PAGE, active: true, lastAccessed: Date.now() }],
      update: async () => ({ id: tabId, url: PAGE, windowId: 1 }),
      sendMessage: async (_id, message) => {
        if (message.type === 'GTH_EDUCATION_FULL_TRIAL') {
          seenRequestId = message.requestId;
          return trialBody(trialExtra);
        }
        if (message.type === 'GTH_EDUCATION_FULL_TRIAL_STATUS') {
          return {
            ok: true,
            data: { requestId: seenRequestId, state: 'settled', outcome: statusOutcome },
          };
        }
        throw Error('unexpected_message');
      },
    },
    scripting: {
      executeScript: async (request) => {
        if (request.files) return [];
        return [{
          frameId: 0,
          result: {
            ok: true,
            reason: 'gth_page_ready',
            href: PAGE,
            readyState: 'complete',
            visible: 'visible',
            titles: TITLES,
            educationCount: 1,
            editorOpen: false,
            editorMarker: null,
            timeOrigin: 1,
            eduFormCount: 0,
            otherFormCount: 0,
          },
        }];
      },
    },
  };
  runner = createGthEducationAutoRunner({
    api,
    timeoutMs: 5000,
    lifecycleOptions: { locks: { request: async (_n, _o, work) => work() }, cryptoImpl: globalThis.crypto },
  });
  return { invoke, data };
}

test('GTH education fill stays ok on a settled preexisting readback', async () => {
  const h = await harness();
  const response = await h.invoke({
    type: 'GTH_EDUCATION_AUTO',
    mode: 'fill',
    profileIndex: 0,
    originConfirmed: true,
    openIfMissing: false,
    inspectAfterFill: false,
  });
  assert.equal(response.ok, true);
  assert.equal(response.job?.state, 'completed');
  assert.equal(response.job?.outcome, 'verified_preexisting');
  assert.equal(response.softwareClickedSave, false);
  assert.equal(response.savedOnSite, false);
  assert.equal(response.saveAttempted, false);
  assert.equal(h.data[educationJobKey(42)]?.state, 'completed');
});

test('GTH education fill fails closed when trial status is unsettled', async () => {
  const h = await harness({ statusOutcome: 'unknown' });
  const response = await h.invoke({
    type: 'GTH_EDUCATION_AUTO',
    mode: 'fill',
    profileIndex: 0,
    originConfirmed: true,
    openIfMissing: false,
  });
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'gth_education_status_unsettled');
  assert.equal(response.job?.state, 'unknown');
  assert.equal(response.softwareClickedSave, false);
  assert.equal(response.saveAttempted, false);
  assert.equal(h.data.resumeGthEducationAutoRun?.ok, false);
});

test('GTH education fill keeps a Save claim and does not report ok', async () => {
  const h = await harness({ trialExtra: { softwareClickedSave: true, savedOnSite: true } });
  const response = await h.invoke({
    type: 'GTH_EDUCATION_AUTO',
    mode: 'fill',
    profileIndex: 0,
    originConfirmed: true,
    openIfMissing: false,
  });
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'gth_education_save_policy_violated');
  assert.equal(response.softwareClickedSave, true);
  assert.equal(response.savedOnSite, true);
  assert.equal(response.job?.softwareClickedSave, true);
  assert.equal(response.saveAttempted, false);
  assert.equal(h.data.resumeGthEducationAutoRun?.softwareClickedSave, true);
});
