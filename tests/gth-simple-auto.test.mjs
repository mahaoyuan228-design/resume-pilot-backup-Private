/**
 * GTH_SIMPLE_AUTO scaffolding smoke:
 * - trusted auto-page sender accepted; wrong sender rejected
 * - default mode=readiness probes without skills fill
 * - fill path injects once, never sets saveAttempted
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGthSimpleAutoRunner } from '../src/background/gth-simple-auto.mjs';

const epoch = '00000000-0000-4000-8000-000000000001';
const tabId = 42;
const PAGE = 'https://hr.gtht.com/resume/edit/';
const SECTION = '职业技能与特长';
const TITLES = ['基本信息', '教育经历', '求职意向', '工作经验', '职业技能与特长', '附件简历', '其他信息'];

const SKILL = 'Python / SQL / Excel';

const fixture = () => ({
  schemaVersion: 1,
  fullName: 'Synthetic Customer B',
  customAnswers: { [SECTION]: SKILL },
  confirmedFields: [`customAnswers.${SECTION}`],
  customFacts: [{
    question: SECTION,
    answer: SKILL,
    sitePageUrl: PAGE,
    sectionName: SECTION,
    rowContext: 'none',
  }],
});

async function harness({ fillResponse, onFill, onInject, timeoutMs = 5000, locks } = {}) {
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
    url: 'chrome-extension://synthetic-extension/src/auto/gth-simple-auto.html?mode=readiness',
  };
  const badSender = {
    id: 'synthetic-extension',
    url: 'chrome-extension://synthetic-extension/src/auto/gth-basic-auto.html',
  };
  const invoke = (message, sender = autoSender) =>
    new Promise((resolve) => {
      const handled = runner.listener(message, sender, resolve);
      if (handled === false) resolve({ ok: false, reason: 'listener_ignored' });
    });
  const defaultFill = fillResponse || {
    ok: true,
    complete: false,
    scope: 'gth_skills_one',
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
    fields: [{
      question: SECTION,
      path: `customAnswers.${SECTION}`,
      labels: [SECTION],
      status: 'verified',
      reason: 'preexisting_same_value',
    }],
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
        if (message?.type === 'GTH_SKILLS_FILL') {
          stats.fill += 1;
          sent.push(message);
          if (onFill) return onFill({ data, response: defaultFill });
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
          if (onInject) await onInject();
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
                sectionIndex: 4,
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
  runner = createGthSimpleAutoRunner({
    api,
    timeoutMs,
    lifecycleOptions: { locks: locks || { request: async (_n, _o, work) => work() }, cryptoImpl: globalThis.crypto },
  });
  return { invoke, stats, sent, data, autoSender, badSender };
}

test('GTH_SIMPLE_AUTO rejects non-simple auto page sender', async () => {
  const h = await harness();
  const response = await h.invoke({ type: 'GTH_SIMPLE_AUTO', mode: 'readiness' }, h.badSender);
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'gth_simple_wrong_sender');
  assert.equal(h.stats.fill, 0);
});

test('GTH_SIMPLE_AUTO readiness probes without skills fill', async () => {
  const h = await harness();
  const response = await h.invoke({ type: 'GTH_SIMPLE_AUTO', mode: 'readiness' });
  assert.equal(response.ok, true);
  assert.equal(response.kind, 'gth_simple_auto');
  assert.equal(response.mode, 'readiness');
  assert.equal(response.writeAttempted, false);
  assert.equal(response.saveAttempted, false);
  assert.equal(response.saveAllowedByPolicy, false);
  assert.equal(h.stats.probe >= 1, true);
  assert.equal(h.stats.fill, 0);
  assert.equal(h.stats.inject, 0);
  assert.equal(response.readiness?.pageState, 'ready');
  assert.equal(response.readiness?.skills?.ready, true);
  assert.equal(response.liveSupportClaimed, false);
  assert.equal(response.complete, false);
  assert.equal(h.data.resumeGthSimpleAutoRun?.ok, true);
});

test('GTH_SIMPLE_AUTO defaults to readiness when mode omitted', async () => {
  const h = await harness();
  const response = await h.invoke({ type: 'GTH_SIMPLE_AUTO' });
  assert.equal(response.ok, true);
  assert.equal(response.mode, 'readiness');
  assert.equal(response.writeAttempted, false);
  assert.equal(h.stats.fill, 0);
});

test('GTH_SIMPLE_AUTO fill injects once and never Save', async () => {
  const h = await harness();
  const response = await h.invoke({
    type: 'GTH_SIMPLE_AUTO',
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
  assert.equal(response.job?.fields?.length, 1);
  assert.deepEqual(h.stats.files, ['src/content/gth-open-fill.js', 'src/content/gth-skills.js']);
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].type, 'GTH_SKILLS_FILL');
  assert.equal(h.sent[0].answers, undefined);
  assert.equal(h.sent[0].replaceExisting, false);
  assert.deepEqual(h.sent[0].profile, {
    customAnswers: { [SECTION]: SKILL },
    confirmedFields: [`customAnswers.${SECTION}`],
    customFacts: [{
      question: SECTION, answer: SKILL, sitePageUrl: PAGE, sectionName: SECTION, rowContext: 'none',
    }],
  });
  assert.equal(h.sent[0].profile.fullName, undefined);
  assert.equal(h.data.resumeGthSimpleAutoRun?.saveAttempted, false);
});


test('GTH_SIMPLE_AUTO skillsSource ready only with a confirmed site fact', async () => {
  const runner = createGthSimpleAutoRunner({
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
  assert.equal(runner.skillsSource({ customAnswers: {}, confirmedFields: [] }).ready, false);
  assert.equal(runner.skillsSource({
    customAnswers: { '职业技能与特长': 'Python' },
    confirmedFields: [],
  }).hasAnswer, true);
  assert.equal(runner.skillsSource({
    customAnswers: { '职业技能与特长': 'Python' },
    confirmedFields: [],
  }).ready, false);
  assert.equal(runner.skillsSource({
    customAnswers: { '职业技能与特长': 'Python' },
    confirmedFields: ['customAnswers.职业技能与特长'],
  }).ready, false);
  const fact = {
    question: '职业技能与特长', answer: 'Python', sitePageUrl: PAGE, sectionName: SECTION, rowContext: 'none',
  };
  assert.equal(runner.skillsSource({
    customAnswers: { '职业技能与特长': 'Python' },
    confirmedFields: ['customAnswers.职业技能与特长'],
    customFacts: [fact],
  }).ready, true);
  assert.equal(runner.skillsSource({
    customAnswers: { '职业技能与特长': '   ' },
    confirmedFields: ['customAnswers.职业技能与特长'],
    customFacts: [fact],
  }).hasAnswer, false);
  assert.equal(runner.skillsSource({
    customAnswers: { '职业技能与特长': 'Python' },
    confirmedFields: ['customAnswers.职业技能与特长'],
    customFacts: [{ ...fact, sitePageUrl: 'https://example.invalid/resume' }],
  }).ready, false);
});

test('GTH_SIMPLE_AUTO fill fail-closed missing_profile_value', async () => {
  const h = await harness();
  h.data.resumeProfile = { schemaVersion: 1, fullName: 'Synthetic', customAnswers: {}, confirmedFields: [] };
  const response = await h.invoke({ type: 'GTH_SIMPLE_AUTO', mode: 'fill', originConfirmed: true });
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'missing_profile_value');
  assert.equal(response.saveAttempted, false);
  assert.equal(response.liveSupportClaimed, false);
  assert.equal(h.stats.fill, 0);
});

test('GTH_SIMPLE_AUTO fill fail-closed profile_fact_unconfirmed', async () => {
  const h = await harness();
  h.data.resumeProfile = {
    schemaVersion: 1,
    fullName: 'Synthetic',
    customAnswers: { '职业技能与特长': 'Python / SQL' },
    confirmedFields: [],
  };
  const response = await h.invoke({ type: 'GTH_SIMPLE_AUTO', mode: 'fill', originConfirmed: true });
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'profile_fact_unconfirmed');
  assert.equal(response.saveAttempted, false);
  assert.equal(response.liveSupportClaimed, false);
  assert.equal(h.stats.fill, 0);
});

test('GTH_SIMPLE_AUTO fill fail-closed when a confirmed answer has no site fact', async () => {
  const h = await harness();
  h.data.resumeProfile = {
    schemaVersion: 1,
    fullName: 'Synthetic',
    customAnswers: { '职业技能与特长': 'TEST' },
    confirmedFields: ['customAnswers.职业技能与特长'],
  };
  const response = await h.invoke({ type: 'GTH_SIMPLE_AUTO', mode: 'fill', originConfirmed: true });
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'profile_fact_unconfirmed');
  assert.equal(response.liveSupportClaimed, false);
  assert.equal(response.saveAttempted, false);
  assert.equal(h.stats.fill, 0);
});

test('GTH_SIMPLE_AUTO keeps liveSupportClaimed false when the page claims support', async () => {
  const claimed = simpleFill({ liveSupportClaimed: true });
  const h = await harness({ fillResponse: claimed });
  const response = await h.invoke({ type: 'GTH_SIMPLE_AUTO', mode: 'fill', originConfirmed: true });
  assert.equal(response.ok, false);
  assert.equal(response.liveSupportClaimed, false);
  assert.equal(response.job?.liveSupportClaimed, false);
  assert.equal(response.saveAttempted, false);
});

test('GTH_SIMPLE_AUTO related GTH tab without edit → login helpNeeded', async () => {
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
    url: 'chrome-extension://synthetic-extension/src/auto/gth-simple-auto.html?mode=readiness',
  };
  let runner;
  const invoke = (message, sender = autoSender) =>
    new Promise((resolve) => {
      const handled = runner.listener(message, sender, resolve);
      if (handled === false) resolve({ ok: false, reason: 'listener_ignored' });
    });
  runner = createGthSimpleAutoRunner({
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
  const response = await invoke({ type: 'GTH_SIMPLE_AUTO', mode: 'readiness' });
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'gth_simple_login_or_wrong_page');
  assert.equal(response.helpNeeded, true);
  assert.equal(response.saveAttempted, false);
});

function simpleFill(extra = {}) {
  return {
    ok: true,
    complete: false,
    scope: 'gth_skills_one',
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
    fields: [{
      question: SECTION,
      path: `customAnswers.${SECTION}`,
      labels: [SECTION],
      status: 'verified',
      reason: 'preexisting_same_value',
    }],
    ...extra,
  };
}

test('GTH_SIMPLE_AUTO fill fails closed when the reply is unsettled', async () => {
  const h = await harness({ fillResponse: simpleFill({ ok: false, reason: 'simple_readback_mismatch', fields: [] }) });
  const response = await h.invoke({ type: 'GTH_SIMPLE_AUTO', mode: 'fill', originConfirmed: true });
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'simple_readback_mismatch');
  assert.equal(response.job?.state, 'unknown');
  assert.equal(response.saveAttempted, false);
});

test('GTH_SIMPLE_AUTO keeps a submit claim and does not report ok', async () => {
  const h = await harness({ fillResponse: simpleFill({ softwareClickedSubmit: true }) });
  const response = await h.invoke({ type: 'GTH_SIMPLE_AUTO', mode: 'fill', originConfirmed: true });
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'gth_simple_save_policy_violated');
  assert.equal(response.softwareClickedSubmit, true);
  assert.equal(response.job?.softwareClickedSubmit, true);
  assert.equal(response.saveAttempted, false);
  assert.equal(h.data.resumeGthSimpleAutoRun?.ok, false);
});


test('GTH_SIMPLE_AUTO retains received write evidence when post-fill binding changes', async () => {
  for (const wrote of [false, true]) {
    const h = await harness({ onFill: ({ data, response }) => {
      data.resumeProfileLifecycle.epoch = '00000000-0000-4000-8000-000000000002';
      return { ...response, writeStarted: wrote, fields: response.fields.map(row => ({
        ...row, reason: wrote ? 'readback_matched' : 'preexisting_same_value'
      })) };
    } });
    const result = await h.invoke({ type: 'GTH_SIMPLE_AUTO', mode: 'fill', originConfirmed: true });
    assert.equal(h.stats.fill, 1);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'profile_binding_changed');
    assert.equal(result.job?.state, 'unknown');
    assert.equal(result.job?.outcome, 'unknown');
    assert.equal(result.writeAttempted, wrote);
    assert.equal(result.writeMayHaveStarted, wrote);
    assert.equal(result.job?.writeStarted, wrote);
    assert.deepEqual(result.job?.fields, [], 'stale-profile field results must not be retained');
    assert.equal(result.saveAttempted, false);
    assert.equal(result.saveAllowedByPolicy, false);
    assert.equal(result.liveSupportClaimed, false);
    assert.equal(result.complete, false);
    assert.deepEqual(h.data.resumeGthSimpleAutoRun, result);
  }
});

test('GTH_SIMPLE_AUTO preserves received policy claims through profile invalidation', async () => {
  const claims = { softwareClickedSave: true, softwareClickedSubmit: true,
    softwareClickedDelete: true, savedOnSite: true, submitted: true };
  const h = await harness({ onFill: ({ data, response }) => {
    data.resumeProfileLifecycle.epoch = '00000000-0000-4000-8000-000000000002';
    return { ...response, writeStarted: true, data: claims };
  } });
  const result = await h.invoke({ type: 'GTH_SIMPLE_AUTO', mode: 'fill', originConfirmed: true });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'gth_simple_save_policy_violated');
  assert.equal(result.job?.failureReason, 'profile_binding_changed');
  assert.equal(result.job?.state, 'unknown');
  assert.equal(result.writeAttempted, true);
  for (const flag of Object.keys(claims)) {
    assert.equal(result[flag], true, flag);
    assert.equal(result.job?.[flag], true, flag);
    assert.equal(h.data.resumeGthSimpleAutoRun?.[flag], true, flag);
  }
  assert.equal(result.saveAttempted, false, 'the worker never attempts Save');
  assert.equal(result.saveAllowedByPolicy, false);
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.complete, false);
});

test('GTH_SIMPLE_AUTO reports rejected or timed-out dispatched fills as uncertain writes', async () => {
  for (const mode of ['reject', 'timeout', 'late']) {
    const h = await harness({ timeoutMs: 20, onFill: async ({ response }) => {
      if (mode === 'reject') throw Error('synthetic_transport_failed');
      if (mode === 'timeout') return new Promise(() => {});
      await new Promise(done => setTimeout(done, 70));
      return { ...response, writeStarted: true };
    } });
    const result = await h.invoke({ type: 'GTH_SIMPLE_AUTO', mode: 'fill', originConfirmed: true });
    assert.equal(h.stats.fill, 1);
    assert.equal(result.ok, false);
    assert.equal(result.reason, mode === 'reject' ? 'synthetic_transport_failed' : 'gth_simple_auto_timeout');
    assert.equal(result.job?.state, 'unknown');
    assert.equal(result.writeAttempted, null, 'no reply proves whether a write started');
    assert.equal(result.writeMayHaveStarted, true);
    assert.equal(result.job?.writeMayHaveStarted, true);
    assert.equal(result.saveAttempted, false);
    assert.equal(result.liveSupportClaimed, false);
    assert.equal(result.complete, false);
    await new Promise(done => setTimeout(done, mode === 'late' ? 90 : 0));
    assert.deepEqual(h.data.resumeGthSimpleAutoRun, result, 'a late reply must not upgrade the failed run');
  }
});

test('GTH_SIMPLE_AUTO cannot start a queued dispatch after its timeout', async () => {
  let release, calls = 0;
  const locks = { request: async (_n, _o, work) => {
    calls += 1;
    if (calls === 2) await new Promise(done => { release = done; });
    return work();
  } };
  const h = await harness({ timeoutMs: 20, locks });
  const result = await h.invoke({ type: 'GTH_SIMPLE_AUTO', mode: 'fill', originConfirmed: true });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'gth_simple_auto_timeout');
  assert.equal(h.stats.fill, 0);
  assert.equal(result.writeAttempted, false);
  assert.equal(result.writeMayHaveStarted, false);
  release();
  await new Promise(done => setTimeout(done, 40));
  assert.equal(h.stats.inject, 0);
  assert.equal(h.stats.fill, 0);
  assert.deepEqual(h.data.resumeGthSimpleAutoRun, result);
});
test('GTH_SIMPLE_AUTO cannot send a fill after timed-out script injection finishes', async () => {
  let release;
  const h = await harness({ timeoutMs: 20,
    onInject: () => new Promise(done => { release = done; }) });
  const result = await h.invoke({ type: 'GTH_SIMPLE_AUTO', mode: 'fill', originConfirmed: true });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'gth_simple_auto_timeout');
  assert.equal(h.stats.inject, 1);
  assert.equal(h.stats.fill, 0);
  assert.equal(result.writeAttempted, false);
  assert.equal(result.writeMayHaveStarted, false);
  release();
  await new Promise(done => setTimeout(done, 40));
  assert.equal(h.stats.fill, 0);
  assert.deepEqual(h.data.resumeGthSimpleAutoRun, result);
});
