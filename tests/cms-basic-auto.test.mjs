/**
 * CMS_BASIC_AUTO scaffolding smoke:
 * - trusted auto-page sender accepted; wrong sender rejected
 * - default mode=readiness probes without RESUME_FILL write
 * - fill path dispatches RESUME_FILL once and never sets saveAttempted
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCmsBasicAutoRunner } from '../src/background/cms-basic-auto.mjs';
import { CMS_QUESTION_PAGE } from '../src/profile/site-question-templates.js';

const epoch = '00000000-0000-4000-8000-000000000001';
const tabId = 77;
const PAGE = CMS_QUESTION_PAGE;
const SIGNATURE = ['个人基本信息必填', '自我评价必填', '教育经历必填'];

const fixture = () => ({
  schemaVersion: 1,
  fullName: 'Synthetic Customer B',
  customAnswers: {
    __cms_basic_academic_degree: '硕士',
    __cms_basic_education_level: '硕士研究生',
    __cms_basic_major: '金融学',
    毕业院校: '悉尼大学',
    国籍地区: '中国',
    '国籍/地区': '中国',
    婚姻状况: '未婚',
  },
  confirmedFields: [
    'customAnswers.__cms_basic_academic_degree',
    'customAnswers.__cms_basic_education_level',
    'customAnswers.__cms_basic_major',
    'customAnswers.毕业院校',
    'customAnswers.国籍/地区',
    'customAnswers.婚姻状况',
  ],
});

async function harness({ fillResponse, patchFill } = {}) {
  const data = {
    resumeProfile: fixture(),
    resumeProfileLifecycle: { version: 1, epoch, state: 'ready' },
    resumeTrustedOrigins: [new URL(PAGE).origin],
  };
  const clone = (value) => (value === undefined ? undefined : structuredClone(value));
  const stats = { fill: 0, inject: 0, probe: 0, focus: 0 };
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
    url: 'chrome-extension://synthetic-extension/src/auto/cms-basic-auto.html?mode=readiness',
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
  const defaultFill = {
    ok: true,
    data: {
      url: PAGE,
      title: 'synthetic',
      fields: [
        {
          id: 'cms-academic-__cms_basic_academic_degree',
          labels: ['学位'],
          path: 'customAnswers.__cms_basic_academic_degree',
          status: 'verified',
          reason: 'preexisting_same_value',
          kind: 'cms_ant_v3_select',
          scope: { sectionName: '个人基本信息必填', rowContext: 'single' },
        },
        {
          id: 'other-section',
          labels: ['期望年薪'],
          path: 'customAnswers.期望年薪',
          status: 'skipped',
          reason: 'missing_profile_value',
          kind: 'cms_ant_v3_select',
          scope: { sectionName: '求职意向必填', rowContext: 'single' },
        },
      ],
      savedOnSite: null,
      submitted: null,
      softwareClickedSubmit: false,
      softwareClickedSave: false,
      writeStarted: false,
      supportedComplete: true,
      operableComplete: true,
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
      get: async () => ({ id: tabId, url: PAGE + '?r=1', windowId: 1, status: 'complete' }),
      create: async () => ({ id: tabId, url: PAGE + '?r=1', windowId: 1, status: 'complete' }),
      query: async (query = {}) => {
        if (query.active && query.lastFocusedWindow) {
          return [{ id: tabId, url: PAGE + '?r=1', active: true }];
        }
        return [{ id: tabId, url: PAGE + '?r=1', active: true, lastAccessed: Date.now() }];
      },
      update: async () => ({ id: tabId, url: PAGE + '?r=1', windowId: 1 }),
      sendMessage: async (_tab, message) => {
        if (message.type === 'RESUME_FILL') {
          stats.fill += 1;
          const response = structuredClone(fillResponse || defaultFill);
          patchFill?.(response);
          return response;
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
          // focus probe or page probe
          const src = String(request.func);
          if (src.includes('hasFocus')) {
            stats.focus += 1;
            return [{ frameId: 0, result: { hasFocus: true, visible: true, href: PAGE, timeOrigin: 1 } }];
          }
          stats.probe += 1;
          return [{
            frameId: 0,
            result: {
              ok: true,
              reason: 'cms_page_ready',
              href: PAGE,
              readyState: 'complete',
              visible: 'visible',
              headings: SIGNATURE,
              sectionPresent: true,
              itemCount: 12,
              timeOrigin: 99,
              sectionName: '个人基本信息必填',
            },
          }];
        }
        return [];
      },
    },
  };
  runner = createCmsBasicAutoRunner({
    api,
    timeoutMs: 5000,
    lifecycleOptions: { locks: { request: async (_n, _o, work) => work() }, cryptoImpl: globalThis.crypto },
  });
  return { invoke, stats, data, autoSender, badSender };
}

test('CMS_BASIC_AUTO rejects non-basic auto page sender', async () => {
  const h = await harness();
  const response = await h.invoke({ type: 'CMS_BASIC_AUTO', mode: 'readiness' }, h.badSender);
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'cms_basic_wrong_sender');
  assert.equal(h.stats.fill, 0);
});

test('CMS_BASIC_AUTO readiness probes without RESUME_FILL write', async () => {
  const h = await harness();
  const response = await h.invoke({ type: 'CMS_BASIC_AUTO', mode: 'readiness' });
  assert.equal(response.ok, true);
  assert.equal(response.kind, 'cms_basic_auto');
  assert.equal(response.mode, 'readiness');
  assert.equal(response.writeAttempted, false);
  assert.equal(response.saveAttempted, false);
  assert.equal(h.stats.probe >= 1, true);
  assert.equal(h.stats.fill, 0);
  assert.equal(h.stats.inject, 0);
  assert.equal(response.readiness?.pageState, 'ready');
  assert.equal(response.readiness?.sectionPresent, true);
  assert.equal(response.readiness?.basic?.readyCount >= 1, true);
  assert.equal(h.data.resumeCmsBasicAutoRun?.ok, true);
  assert.equal(h.data.resumeCmsBasicAutoRun?.mode, 'readiness');
});

test('CMS_BASIC_AUTO defaults to readiness when mode omitted', async () => {
  const h = await harness();
  const response = await h.invoke({ type: 'CMS_BASIC_AUTO' });
  assert.equal(response.ok, true);
  assert.equal(response.mode, 'readiness');
  assert.equal(response.writeAttempted, false);
  assert.equal(h.stats.fill, 0);
});

test('CMS_BASIC_AUTO fill dispatches RESUME_FILL once and never Save', async () => {
  const h = await harness();
  const response = await h.invoke({
    type: 'CMS_BASIC_AUTO',
    mode: 'fill',
    originConfirmed: true,
  });
  assert.equal(response.ok, true);
  assert.equal(response.mode, 'fill');
  assert.equal(response.saveAttempted, false);
  assert.equal(h.stats.inject, 1);
  assert.equal(h.stats.fill, 1);
  assert.equal(response.job?.state, 'completed');
  assert.equal(response.job?.outcome, 'verified_preexisting');
  assert.equal(response.job?.writeStarted, false);
  assert.equal(response.job?.supportedComplete, true);
  assert.equal(response.job?.operableComplete, true);
  assert.equal(response.job?.softwareClickedSave, false);
  assert.equal(response.job?.softwareClickedSubmit, false);
  assert.equal(response.job?.summary?.personalCount, 1);
  assert.equal(response.job?.summary?.verified, 1);
  assert.equal(response.job?.summary?.totalReturned, 2);
  assert.equal(h.data.resumeCmsBasicAutoRun?.saveAttempted, false);
});

test('CMS_BASIC_AUTO accepts cms-education-auto.html basic_* alias sender', async () => {
  const h = await harness();
  const eduSender = {
    id: 'synthetic-extension',
    url: 'chrome-extension://synthetic-extension/src/auto/cms-education-auto.html?mode=basic_readiness',
  };
  const response = await h.invoke({ type: 'CMS_BASIC_AUTO', mode: 'readiness' }, eduSender);
  assert.equal(response.ok, true);
  assert.equal(response.mode, 'readiness');
  assert.equal(response.writeAttempted, false);
  assert.equal(h.stats.fill, 0);
});

test('CMS_BASIC_AUTO fill fail-closed missing_profile_value when no ready facts', async () => {
  const h = await harness();
  h.data.resumeProfile = {
    schemaVersion: 1,
    fullName: 'Synthetic Customer B',
    customAnswers: {},
    confirmedFields: [],
  };
  const response = await h.invoke({
    type: 'CMS_BASIC_AUTO',
    mode: 'fill',
    originConfirmed: true,
  });
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'missing_profile_value');
  assert.equal(response.saveAttempted, false);
  assert.equal(response.writeAttempted, false);
  assert.equal(h.stats.fill, 0);
});

test('CMS_BASIC_AUTO fill fail-closed profile_fact_unconfirmed when value present but unconfirmed', async () => {
  const h = await harness();
  h.data.resumeProfile = {
    schemaVersion: 1,
    fullName: 'Synthetic Customer B',
    customAnswers: { __cms_basic_academic_degree: '硕士', 婚姻状况: '未婚' },
    confirmedFields: [],
  };
  const response = await h.invoke({
    type: 'CMS_BASIC_AUTO',
    mode: 'fill',
    originConfirmed: true,
  });
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'profile_fact_unconfirmed');
  assert.equal(response.saveAttempted, false);
  assert.equal(h.stats.fill, 0);
});

test('CMS_BASIC_AUTO fill fail-closed cms_basic_origin_unconfirmed without trust or confirm', async () => {
  const h = await harness();
  delete h.data.resumeTrustedOrigins;
  const response = await h.invoke({ type: 'CMS_BASIC_AUTO', mode: 'fill' });
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'cms_basic_origin_unconfirmed');
  assert.equal(response.saveAttempted, false);
  assert.equal(h.stats.fill, 0);
});

test('CMS_BASIC_AUTO related CMS tab without resumeOperation → login helpNeeded', async () => {
  const data = {
    resumeProfile: {
      schemaVersion: 1,
      fullName: 'Synthetic Customer B',
      customAnswers: {},
      confirmedFields: [],
    },
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
    url: 'chrome-extension://synthetic-extension/src/auto/cms-basic-auto.html?mode=readiness',
  };
  let runner;
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
      get: async () => ({ id: 9, url: 'https://wecruit.hotjob.cn/login', windowId: 1, status: 'complete' }),
      query: async () => ([{ id: 9, url: 'https://wecruit.hotjob.cn/sso/login', active: true, lastAccessed: Date.now() }]),
      update: async () => ({}),
      sendMessage: async () => { throw Error('unexpected'); },
    },
    scripting: { executeScript: async () => [] },
  };
  runner = createCmsBasicAutoRunner({
    api,
    timeoutMs: 5000,
    lifecycleOptions: { locks: { request: async (_n, _o, work) => work() }, cryptoImpl: globalThis.crypto },
  });
  const response = await invoke({ type: 'CMS_BASIC_AUTO', mode: 'readiness' });
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'cms_basic_login_or_wrong_page');
  assert.equal(response.helpNeeded, true);
  assert.equal(response.saveAttempted, false);
  assert.equal(response.writeAttempted, false);
});

test('CMS_BASIC_AUTO isPersonalField filters education/internship rows out of summary', async () => {
  const runner = createCmsBasicAutoRunner({
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
  assert.equal(runner.isPersonalField({
    path: 'customAnswers.__cms_basic_academic_degree',
    scope: { sectionName: '个人基本信息必填' },
  }), true);
  assert.equal(runner.isPersonalField({
    path: 'education.0.school',
    scope: { sectionName: '教育经历必填' },
    labels: ['学校'],
  }), false);
  assert.equal(runner.isPersonalField({
    path: 'education.0.major',
    status: 'failed',
    reason: 'duplicate_target',
    scope: { sectionName: '教育经历必填' },
    labels: ['专业名称'],
  }), false);
  assert.equal(runner.isPersonalField({
    path: 'customAnswers.__cms_education_academic_degree',
    scope: { sectionName: '教育经历必填' },
    labels: ['学位'],
  }), false);
  assert.equal(runner.isPersonalField({
    id: 'cms-academic-__cms_basic_education_level',
    labels: ['学历'],
  }), true);
  const summary = runner.summarizeFields([
    { id: 'a', path: 'customAnswers.__cms_basic_major', status: 'verified', scope: { sectionName: '个人基本信息必填' } },
    { id: 'b', path: 'education.0.major', status: 'verified', scope: { sectionName: '教育经历必填' } },
    {
      id: 'c',
      path: 'education.0.major',
      status: 'failed',
      reason: 'duplicate_target',
      scope: { sectionName: '教育经历必填' },
      labels: ['专业名称'],
    },
  ]);
  assert.equal(summary.personalCount, 1);
  assert.equal(summary.verified, 1);
  assert.equal(summary.failed, 0);
  assert.equal(summary.totalReturned, 3);
  const source = runner.basicSource({
    customAnswers: { __cms_basic_academic_degree: '硕士' },
    confirmedFields: ['customAnswers.__cms_basic_academic_degree'],
  });
  assert.equal(source.readyCount >= 1, true);
  assert.equal(source.ready, true);
});

test('CMS_BASIC_AUTO fill rejects softwareClickedSave and preserves the click evidence', async () => {
  const h = await harness({
    fillResponse: {
      ok: true,
      data: {
        fields: [{
          id: 'cms-academic-__cms_basic_academic_degree',
          labels: ['学位'],
          path: 'customAnswers.__cms_basic_academic_degree',
          status: 'verified',
          scope: { sectionName: '个人基本信息必填' },
        }],
        softwareClickedSave: true,
        softwareClickedSubmit: false,
      },
    },
  });
  const response = await h.invoke({
    type: 'CMS_BASIC_AUTO',
    mode: 'fill',
    originConfirmed: true,
  });
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'cms_basic_save_policy_violated');
  assert.equal(response.saveAttempted, false);
  assert.equal(response.softwareClickedSave, true);
  assert.equal(response.job.state, 'unknown');
  assert.equal(response.job.softwareClickedSave, true);
  assert.equal(response.fill.softwareClickedSave, true);
  assert.equal(h.data.resumeCmsBasicAutoRun.softwareClickedSave, true);
  assert.equal(h.data.resumeCmsBasicAutoRun.job.softwareClickedSave, true);
  assert.ok(h.data[`resumePendingFillReview:${tabId}`]);
});

test('CMS_BASIC_AUTO excludes path-null education 学历 duplicate_target from personal failures', async () => {
  const h = await harness({ fillResponse: { ok: true, data: {
    fields: [
      {
        id: 'cms-academic-__cms_basic_education_level', labels: ['学历*'],
        path: 'customAnswers.__cms_basic_education_level', status: 'verified',
        reason: 'preexisting_same_value', kind: 'cms_ant_v3_select',
        scope: { sectionName: '个人基本信息必填', rowContext: 'single' },
      },
      {
        id: 'cms-ant-v3-学历', labels: ['学历*'], path: null, status: 'failed',
        reason: 'duplicate_target', kind: 'cms_ant_v3_select',
        scope: { sectionName: '教育经历必填', rowContext: 'multiple' },
      },
    ], softwareClickedSave: false, softwareClickedSubmit: false,
    writeStarted: false, supportedComplete: true, operableComplete: true,
  } } });
  const response = await h.invoke({ type: 'CMS_BASIC_AUTO', mode: 'fill', originConfirmed: true });
  assert.equal(response.ok, true);
  assert.equal(response.job.summary.personalCount, 1);
  assert.equal(response.job.summary.verified, 1);
  assert.equal(response.job.summary.failed, 0);
  assert.equal(response.job.summary.totalReturned, 2);
  assert.equal(response.saveAttempted, false);
  assert.equal(response.job.softwareClickedSave, false);
  assert.equal(response.job.softwareClickedSubmit, false);
});

// Synthetic protocol responses only: these are not captured employer DOM or a
// claim that the legacy RESUME_FILL producer supplies a completion contract.
for (const status of ['unknown', 'pending', 'failed', 'skipped', null, undefined]) {
  test(`CMS_BASIC_AUTO does not complete an unverified personal status (${status})`, async () => {
    const h = await harness({ patchFill: response => {
      response.data.fields[0].status = status;
    } });
    const response = await h.invoke({ type: 'CMS_BASIC_AUTO', mode: 'fill' });
    assert.equal(response.ok, false);
    assert.equal(response.job.state, 'unknown');
    assert.equal(response.job.complete, false);
    assert.equal(h.data.resumeCmsBasicAutoRun.ok, false);
    assert.ok(h.data[`resumePendingFillReview:${tabId}`]);
  });
}

for (const key of ['writeStarted', 'supportedComplete', 'operableComplete']) {
  for (const value of [undefined, null, 'true', 1]) {
    test(`CMS_BASIC_AUTO requires a boolean ${key} (${value})`, async () => {
      const h = await harness({ patchFill: response => {
        if (value === undefined) delete response.data[key];
        else response.data[key] = value;
      } });
      const response = await h.invoke({ type: 'CMS_BASIC_AUTO', mode: 'fill' });
      assert.equal(response.ok, false);
      assert.equal(response.job.state, 'unknown');
      assert.equal(response.reason, 'cms_basic_response_incomplete');
      assert.equal(h.data.resumeCmsBasicAutoRun.ok, false);
    });
  }
}

for (const key of ['supportedComplete', 'operableComplete']) {
  test(`CMS_BASIC_AUTO refuses incomplete ${key}`, async () => {
    const h = await harness({ patchFill: response => { response.data[key] = false; } });
    const response = await h.invoke({ type: 'CMS_BASIC_AUTO', mode: 'fill' });
    assert.equal(response.ok, false);
    assert.equal(response.job.state, 'unknown');
  });
}

test('CMS_BASIC_AUTO requires personal readback evidence and consistent writeStarted', async () => {
  for (const patchFill of [
    response => { response.data.fields = []; },
    response => { response.data.fields.shift(); },
    response => { response.data.fields[0].reason = 'ready'; },
    response => { response.data.fields[0].reason = 'readback_matched'; },
    response => { response.data.writeStarted = true; },
    response => { response.writeStarted = true; },
    response => { response.fillNotStarted = true; },
    response => { response.data.status = 'unknown'; },
    response => { response.data.outcome = 'unknown'; },
    response => { response.data.status = 'verified'; },
    response => { response.data.ok = false; },
  ]) {
    const h = await harness({ patchFill });
    const response = await h.invoke({ type: 'CMS_BASIC_AUTO', mode: 'fill' });
    assert.equal(response.ok, false);
    assert.notEqual(response.job.state, 'completed');
    assert.equal(response.saveAttempted, false);
  }
});

test('CMS_BASIC_AUTO retains a reported click even if the profile binding changes after fill', async () => {
  const h = await harness({ patchFill: response => {
    response.data.softwareClickedSave = true;
    h.data.resumeProfile.fullName = 'Changed synthetic profile';
  } });
  const response = await h.invoke({ type: 'CMS_BASIC_AUTO', mode: 'fill' });
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'cms_basic_save_policy_violated');
  assert.equal(response.job.state, 'unknown');
  assert.equal(response.softwareClickedSave, true);
  assert.equal(h.data.resumeCmsBasicAutoRun.job.softwareClickedSave, true);
});

test('CMS_BASIC_AUTO completes a verified write with an explicit contract, without Save', async () => {
  const h = await harness({ patchFill: response => {
    response.data.fields[0].reason = 'readback_matched';
    response.data.writeStarted = true;
  } });
  const response = await h.invoke({ type: 'CMS_BASIC_AUTO', mode: 'fill' });
  assert.equal(response.ok, true);
  assert.equal(response.job.state, 'completed');
  assert.equal(response.job.outcome, 'verified');
  assert.equal(response.writeAttempted, true);
  assert.equal(response.job.complete, false);
  assert.equal(response.softwareClickedSave, false);
  assert.equal(response.softwareClickedSubmit, false);
  assert.equal(response.saveAttempted, false);
  assert.equal(h.data[`resumePendingFillReview:${tabId}`], undefined);
});

test('CMS_BASIC_AUTO pre-write failures stay false instead of being greened by auto()', async () => {
  const h = await harness({ fillResponse: {
    ok: false, error: 'site_session_unverified', fillNotStarted: true, writeStarted: false,
  } });
  const response = await h.invoke({ type: 'CMS_BASIC_AUTO', mode: 'fill' });
  assert.equal(response.ok, false);
  assert.equal(response.job.state, 'stopped_before_write');
  assert.equal(response.writeAttempted, false);
  assert.equal(response.reason, 'site_session_unverified');
  assert.equal(h.data.resumeCmsBasicAutoRun.ok, false);
  assert.equal(h.data[`resumePendingFillReview:${tabId}`], undefined);
});

for (const flag of ['softwareClickedSave', 'softwareClickedSubmit', 'savedOnSite', 'submitted']) {
  for (const location of ['envelope', 'data']) {
    for (const ok of [true, false]) {
      test(`CMS_BASIC_AUTO preserves ${location}.${flag} even with ok=${ok}`, async () => {
        const h = await harness({ patchFill: response => {
          response.ok = ok;
          response.writeStarted = false;
          response.fillNotStarted = true;
          (location === 'data' ? response.data : response)[flag] = true;
        } });
        const response = await h.invoke({ type: 'CMS_BASIC_AUTO', mode: 'fill' });
        assert.equal(response.ok, false);
        assert.equal(response.reason, 'cms_basic_save_policy_violated');
        assert.equal(response.job.state, 'unknown');
        assert.equal(response[flag], true);
        assert.equal(response.job[flag], true);
        assert.equal(response.fill[flag], true);
        assert.equal(h.data.resumeCmsBasicAutoRun[flag], true);
        assert.equal(h.data.resumeCmsBasicAutoRun.job[flag], true);
        assert.ok(h.data[`resumePendingFillReview:${tabId}`]);
      });
    }
  }
}

test('CMS_BASIC_AUTO fill fails closed when the page reports savedOnSite or submitted', async () => {
  const saved = await harness({
    fillResponse: {
      ok: true,
      data: {
        fields: [{
          id: 'cms-academic-__cms_basic_academic_degree',
          labels: ['学位'],
          path: 'customAnswers.__cms_basic_academic_degree',
          status: 'verified',
          reason: 'readback_matched',
          scope: { sectionName: '个人基本信息必填' },
        }],
        savedOnSite: true,
        submitted: null,
        softwareClickedSave: false,
        softwareClickedSubmit: false,
      },
    },
  });
  const savedResponse = await saved.invoke({ type: 'CMS_BASIC_AUTO', mode: 'fill', originConfirmed: true });
  assert.equal(savedResponse.ok, false);
  assert.equal(savedResponse.reason, 'cms_basic_save_policy_violated');
  assert.equal(savedResponse.saveAttempted, false);
  assert.equal(savedResponse.savedOnSite, true);
  assert.equal(savedResponse.softwareClickedSave, false);
  assert.equal(savedResponse.job?.state, 'unknown');
  assert.notEqual(savedResponse.job?.state, 'completed');

  const submitted = await harness({
    fillResponse: {
      ok: true,
      data: {
        fields: [{
          id: 'cms-academic-__cms_basic_academic_degree',
          labels: ['学位'],
          path: 'customAnswers.__cms_basic_academic_degree',
          status: 'verified',
          scope: { sectionName: '个人基本信息必填' },
        }],
        savedOnSite: null,
        submitted: true,
        softwareClickedSave: false,
        softwareClickedSubmit: false,
      },
    },
  });
  const submittedResponse = await submitted.invoke({ type: 'CMS_BASIC_AUTO', mode: 'fill', originConfirmed: true });
  assert.equal(submittedResponse.ok, false);
  assert.equal(submittedResponse.reason, 'cms_basic_save_policy_violated');
  assert.equal(submittedResponse.submitted, true);
  assert.equal(submittedResponse.job?.softwareClickedSubmit, false);
  assert.equal(submittedResponse.saveAttempted, false);
});

test('CMS_BASIC_AUTO fill fails closed before write and does not complete', async () => {
  const h = await harness({
    fillResponse: {
      ok: false,
      error: 'page_hidden',
      fillNotStarted: true,
      writeStarted: false,
    },
  });
  const response = await h.invoke({ type: 'CMS_BASIC_AUTO', mode: 'fill', originConfirmed: true });
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'page_hidden');
  assert.equal(response.saveAttempted, false);
  assert.equal(response.writeAttempted, false);
  assert.equal(response.softwareClickedSave, false);
  assert.equal(response.job?.state, 'stopped_before_write');
  assert.notEqual(response.job?.state, 'completed');
  assert.equal(h.data.resumeCmsBasicAutoRun?.ok, false);
  assert.equal(h.data['resumePendingFillReview:' + tabId], undefined);
});

test('CMS_BASIC_AUTO fill fails closed when personal readback is failed or missing', async () => {
  const failed = await harness({
    fillResponse: {
      ok: true,
      data: {
        fields: [{
          id: 'cms-academic-__cms_basic_academic_degree',
          labels: ['学位'],
          path: 'customAnswers.__cms_basic_academic_degree',
          status: 'failed',
          reason: 'readback_mismatch',
          scope: { sectionName: '个人基本信息必填' },
        }],
        savedOnSite: null,
        submitted: null,
        softwareClickedSave: false,
        softwareClickedSubmit: false,
      },
    },
  });
  const failedResponse = await failed.invoke({ type: 'CMS_BASIC_AUTO', mode: 'fill', originConfirmed: true });
  assert.equal(failedResponse.ok, false);
  assert.equal(failedResponse.reason, 'cms_basic_status_unsettled');
  assert.equal(failedResponse.saveAttempted, false);
  assert.equal(failedResponse.softwareClickedSave, false);
  assert.equal(failedResponse.job?.state, 'unknown');
  assert.equal(failedResponse.job?.summary?.failed, 1);
  assert.equal(failed.data.resumeCmsBasicAutoRun?.ok, false);
  assert.equal(failed.data['resumePendingFillReview:' + tabId]?.kind, 'cms_basic_auto');

  const empty = await harness({
    fillResponse: {
      ok: true,
      data: {
        fields: [{
          id: 'other-section',
          labels: ['期望年薪'],
          path: 'customAnswers.期望年薪',
          status: 'verified',
          scope: { sectionName: '求职意向必填' },
        }],
        savedOnSite: null,
        submitted: null,
        softwareClickedSave: false,
        softwareClickedSubmit: false,
      },
    },
  });
  const emptyResponse = await empty.invoke({ type: 'CMS_BASIC_AUTO', mode: 'fill', originConfirmed: true });
  assert.equal(emptyResponse.ok, false);
  assert.equal(emptyResponse.reason, 'cms_basic_status_unsettled');
  assert.equal(emptyResponse.job?.state, 'unknown');
  assert.equal(emptyResponse.job?.summary?.personalCount, 0);
  assert.equal(emptyResponse.saveAttempted, false);
});

test('CMS_BASIC_AUTO fails closed when 现居住地/籍贯 are skipped as region_fact_not_unique', async () => {
  const h = await harness({ fillResponse: { ok: true, data: {
    fields: [
      {
        id: 'cms-academic-__cms_basic_academic_degree', labels: ['学位'],
        path: 'customAnswers.__cms_basic_academic_degree', status: 'verified',
        reason: 'preexisting_same_value', kind: 'cms_ant_v3_select',
        scope: { sectionName: '个人基本信息必填', rowContext: 'single' },
      },
      {
        id: 'cms-region-residence', labels: ['现居住地*'], path: null, status: 'skipped',
        reason: 'region_fact_not_unique', kind: 'cms_region',
        scope: { sectionName: '个人基本信息必填', rowContext: 'single' },
      },
      {
        id: 'cms-region-origin', labels: ['籍贯*'], path: null, status: 'skipped',
        reason: 'region_fact_not_unique', kind: 'cms_region',
        scope: { sectionName: '个人基本信息必填', rowContext: 'single' },
      },
      {
        id: 'cms-ant-v3-学历', labels: ['学历*'], path: null, status: 'failed',
        reason: 'duplicate_target', kind: 'cms_ant_v3_select',
        scope: { sectionName: '教育经历必填', rowContext: 'multiple' },
      },
    ],
    softwareClickedSave: false, softwareClickedSubmit: false,
    writeStarted: false, supportedComplete: true, operableComplete: true,
  } } });
  const response = await h.invoke({ type: 'CMS_BASIC_AUTO', mode: 'fill', originConfirmed: true });
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'region_fact_not_unique');
  assert.equal(response.saveAttempted, false);
  assert.equal(response.softwareClickedSave, false);
  assert.equal(response.softwareClickedSubmit, false);
  assert.equal(response.job.state, 'unknown');
  assert.equal(response.job.complete, false);
  const residence = response.job.fields.find(field => field.labels[0] === '现居住地*');
  const origin = response.job.fields.find(field => field.labels[0] === '籍贯*');
  assert.equal(residence.status, 'failed');
  assert.equal(residence.reason, 'region_fact_not_unique');
  assert.equal(origin.status, 'failed');
  assert.equal(origin.reason, 'region_fact_not_unique');
  assert.equal(response.job.summary.failed, 2);
  assert.equal(response.job.fields.some(field => field.reason === 'duplicate_target'), false);
  assert.equal(response.job.summary.totalReturned, 4);
});

test('CMS_BASIC_AUTO region readiness stays unready when 现居住地 is not unique', () => {
  const runner = createCmsBasicAutoRunner({
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
  const pair = JSON.stringify({ province: 'Synthetic Province', city: 'Synthetic City' });
  const source = runner.basicSource({
    customAnswers: { 现居住地: pair, 籍贯: 'not-json' },
    confirmedFields: ['customAnswers.现居住地', 'customAnswers.籍贯'],
    customFacts: [
      { question: '现居住地', answer: pair, sitePageUrl: PAGE, sectionName: '个人基本信息必填', rowContext: 'single' },
      { question: '现居住地', answer: pair, sitePageUrl: PAGE, sectionName: '个人基本信息必填', rowContext: 'single' },
      { question: '籍贯', answer: 'not-json', sitePageUrl: PAGE, sectionName: '个人基本信息必填', rowContext: 'single' },
    ],
  }, PAGE);
  const residence = source.questions.find(row => row.question === '现居住地');
  const origin = source.questions.find(row => row.question === '籍贯');
  assert.equal(residence.ready, false);
  assert.equal(residence.region.reason, 'region_fact_not_unique');
  assert.equal(residence.region.status, 'failed');
  assert.equal(origin.ready, false);
  assert.equal(origin.region.reason, 'explicit_region_pair_required');
  assert.equal(JSON.stringify(source).includes('已支持'), false);
});
