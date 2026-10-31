import test from 'node:test';
import assert from 'node:assert/strict';
import { createBasicTaskRunner, BASIC_PAGE, basicCandidate, basicJobKey } from '../src/background/basic-task-runner.mjs';
import { captureProfileBinding } from '../src/profile/profile-lifecycle.js';

const tabId = 42;
const pendingKey = `resumePendingFillReview:${tabId}`;
const clone = value => value === undefined ? undefined : structuredClone(value);

async function harness(t, formReadiness) {
  const profile = { schemaVersion: 1, fullName: 'Offline Applicant',
    education: [{ degree: '本科' }], confirmedFields: ['fullName', 'education.0.degree'] };
  const data = { resumeProfile: profile,
    resumeProfileLifecycle: { version: 1, epoch: '00000000-0000-4000-8000-000000000001', state: 'ready' },
    resumeTrustedOrigins: [new URL(BASIC_PAGE).origin] };
  const stats = { readiness: 0, trial: 0, status: 0, receipts: 0 };
  const local = {
    async get(keys) {
      return keys === null ? clone(data) : Object.fromEntries(
        (Array.isArray(keys) ? keys : [keys]).map(key => [key, clone(data[key])]));
    },
    async set(values) { Object.assign(data, clone(values)); },
    async remove(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key]; },
  };
  const sender = { id: 'offline-extension', url: 'chrome-extension://offline-extension/src/popup/popup.html' };
  const tab = { id: tabId, url: BASIC_PAGE, active: true };
  const api = {
    permissions: { getAll: async () => ({ origins: ['https://*/*'] }), contains: async () => true },
    storage: { local },
    runtime: { id: sender.id, getURL: path => `chrome-extension://offline-extension/${path}`,
      getManifest: () => ({ background: { service_worker: 'src/background/worker.mjs' } }) },
    tabs: {
      async get(id) { assert.equal(id, tabId); return clone(tab); },
      async query(query) { assert.deepEqual(query, { active: true, lastFocusedWindow: true }); return [clone(tab)]; },
      async sendMessage(id, message) {
        assert.equal(id, tabId);
        if (message.type === 'GTH_BASIC_TRIAL') {
          stats.trial++;
          assert.deepEqual(message.profile, basicCandidate(profile, 0).profile);
          return { ok: false, reason: 'fixture_stopped_before_write', writeStarted: false,
            softwareClickedSave: false, softwareClickedSubmit: false, softwareClickedDelete: false };
        }
        assert.equal(message.type, 'GTH_BASIC_TRIAL_STATUS');
        stats.status++;
        return { ok: true, data: { requestId: message.requestId, state: 'settled', outcome: 'failed_before_write' } };
      },
    },
    scripting: { async executeScript(request) {
      assert.equal(request.target.tabId, tabId);
      if (request.files) {
        assert.ok(['src/content/gth-basic.js', 'src/content/controls/resume-form.js'].includes(request.files[0]));
        return [];
      }
      assert.match(String(request.func), /ResumeFormFlow.*readiness/su);
      stats.readiness++;
      return [{ frameId: 0, result: clone(formReadiness) }];
    } },
  };
  const previousChrome = Object.getOwnPropertyDescriptor(globalThis, 'chrome');
  Object.defineProperty(globalThis, 'chrome', { configurable: true, writable: true, value: api });
  t.after(() => {
    if (previousChrome) Object.defineProperty(globalThis, 'chrome', previousChrome);
    else delete globalThis.chrome;
  });
  const lifecycleOptions = { locks: { request: async (_name, _options, work) => work() }, cryptoImpl: globalThis.crypto };
  const runner = createBasicTaskRunner({ api, lifecycleOptions,
    saveReceipt: async () => { stats.receipts++; return { statusCode: 'stopped_before_write' }; } });
  const message = { type: 'GTH_BASIC_JOB_START', tabId, pageUrl: BASIC_PAGE, educationIndex: 0,
    replaceExisting: false, candidateSnapshot: basicCandidate(profile, 0),
    profileBinding: await captureProfileBinding(local, lifecycleOptions) };
  return { data, stats, runner, message, sender,
    async run() {
      const accepted = await new Promise(resolve => {
        assert.equal(runner.listener(message, sender, resolve), true);
      });
      assert.equal(accepted.accepted, true);
      await runner.waitForIdle();
      return data[basicJobKey(tabId)];
    } };
}

for (const [status, reason] of [['login_required', 'visible_login_wall'],
  ['form_not_ready', 'form_loading'], ['manual', 'required_control_unrecognized']]) {
  test(`basic task ${status} records the hint and continues trial dispatch`, async t => {
    const formReadiness = { ok: true, status, reason, writeAttempted: false, liveSupportClaimed: false };
    const h = await harness(t, formReadiness);
    const job = await h.run();
    assert.equal(job.state, 'stopped_before_write');
    assert.equal(job.reason, 'fixture_stopped_before_write');
    assert.equal(job.formReadiness.status, status);
    assert.equal(job.formReadiness.reason, reason);
    assert.equal(job.formReadiness.advisory, true);
    assert.equal(job.formReadiness.blocking, false);
    assert.equal(job.formReadiness.advisoryHints[0].reason, reason);
    assert.equal(job.writeStarted, false);
    assert.equal(job.liveSupportClaimed, false);
    assert.deepEqual(h.stats, { readiness: 1, trial: 1, status: 1, receipts: 1 });
    assert.equal(h.data[pendingKey], undefined);
  });
}

test('basic task missing form-ready API preserves the unavailable hint and continues trial dispatch', async t => {
  const h = await harness(t, undefined);
  const job = await h.run();
  assert.equal(job.state, 'stopped_before_write');
  assert.equal(job.reason, 'fixture_stopped_before_write');
  assert.equal(job.formReadiness.reason, 'form_readiness_unavailable');
  assert.equal(job.formReadiness.status, 'manual');
  assert.equal(job.writeStarted, false);
  assert.equal(job.liveSupportClaimed, false);
  assert.deepEqual(h.stats, { readiness: 1, trial: 1, status: 1, receipts: 1 });
  assert.equal(h.data[pendingKey], undefined);
});

test('basic task ready reaches trial dispatch and keeps the explicit pre-write stop', async t => {
  const h = await harness(t, { status: 'ready', reason: 'visible_editable_form' });
  const job = await h.run();
  assert.deepEqual(h.stats, { readiness: 1, trial: 1, status: 1, receipts: 1 });
  assert.equal(job.state, 'stopped_before_write');
  assert.equal(job.reason, 'fixture_stopped_before_write');
  assert.equal(job.writeStarted, false);
  assert.equal(h.data[pendingKey], undefined);
});

test('basic task still rejects untrusted senders and ignores unrelated runtime messages', async t => {
  const h = await harness(t, { status: 'ready', reason: 'visible_editable_form' });
  for (const sender of [{ ...h.sender, id: 'other-extension' },
    { ...h.sender, url: 'chrome-extension://offline-extension/src/auto/gth-basic-auto.html' },
    { ...h.sender, tab: { id: tabId } }]) {
    let response;
    assert.equal(h.runner.listener(h.message, sender, value => { response = value; }), false);
    assert.deepEqual(response, { ok: false, error: 'wrong_sender' });
  }
  let answered = false;
  assert.equal(h.runner.listener({ type: 'UNRELATED' }, h.sender, () => { answered = true; }), false);
  assert.equal(answered, false);
  assert.equal(h.data[basicJobKey(tabId)], undefined);
  assert.equal(h.data[pendingKey], undefined);
  assert.deepEqual(h.stats, { readiness: 0, trial: 0, status: 0, receipts: 0 });
});
