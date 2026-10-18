/**
 * CMS_INTERNSHIP_AUTO scaffolding smoke:
 * - trusted auto-page sender accepted; wrong sender rejected
 * - default mode=readiness inspects+binds without RUN / write
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCmsEducationTaskRunner } from '../src/background/cms-education-task-runner.mjs';
import { PAGE } from '../src/profile/cms-internship-plan.mjs';

const epoch = '00000000-0000-4000-8000-000000000001';
const tabId = 11;
const document = { href: PAGE + '?synthetic=internship-auto', timeOrigin: 42, visible: true };
const locks = { request: async (_name, _options, work) => work() };

const fixture = () => {
  const experience = [{
    type: 'internship',
    organization: 'Synthetic Org Alpha',
    position: 'Intern Analyst',
    description: 'Synthetic internship work',
    startDate: '2023-03-01',
    endDate: '2023-08-31',
  }];
  return {
    schemaVersion: 1,
    fullName: 'Synthetic Customer B',
    experience,
    confirmedFields: experience.flatMap((row, index) =>
      Object.keys(row).map((key) => 'experience.' + index + '.' + key)),
  };
};

async function harness() {
  const data = {
    resumeProfile: fixture(),
    resumeProfileLifecycle: { version: 1, epoch, state: 'ready' },
  };
  const clone = (value) => (value === undefined ? undefined : structuredClone(value));
  const stats = { run: 0, inspect: 0 };
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
    url: 'chrome-extension://synthetic-extension/src/auto/cms-internship-auto.html?mode=readiness',
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
  const api = {
    storage: { local: storage },
    runtime: {
      id: autoSender.id,
      getURL: (path) => 'chrome-extension://synthetic-extension/' + path,
      getManifest: () => ({ background: { service_worker: 'src/background/worker.mjs' } }),
    },
    windows: { update: async () => ({}) },
    tabs: {
      get: async () => ({ id: tabId, url: document.href, windowId: 1 }),
      query: async (query = {}) => {
        if (query.active && query.lastFocusedWindow) {
          return [{ id: tabId, url: document.href, active: true }];
        }
        return [{ id: tabId, url: document.href, active: true, lastAccessed: Date.now() }];
      },
      update: async () => ({ id: tabId, url: document.href, windowId: 1 }),
      sendMessage: async (_tab, message) => {
        if (message.type === 'CMS_INTERNSHIP_MULTI_INSPECT') {
          stats.inspect += 1;
          return {
            ok: true,
            data: {
              document,
              rows: [{
                identity: 'synthetic-internship-row',
                fields: [
                  { key: 'organization', question: '企业名称', value: 'Synthetic Org Alpha' },
                  { key: 'position', question: '职位名称', value: 'Intern Analyst' },
                  { key: 'startDate', question: '开始时间', value: '2023-03' },
                  { key: 'endDate', question: '结束时间', value: '2023-08' },
                ],
              }],
            },
          };
        }
        if (message.type === 'CMS_INTERNSHIP_MULTI_RUN') {
          stats.run += 1;
          throw Error('run_must_not_dispatch_in_readiness');
        }
        if (message.type === 'CMS_INTERNSHIP_MULTI_STATUS') {
          return { ok: true, state: 'settled', requestId: message.requestId };
        }
        throw Error('unexpected_message:' + message.type);
      },
    },
    scripting: {
      executeScript: async (request) => {
        if (request.files) return [];
        if (typeof request.func === 'function' && request.world === 'MAIN') {
          return [{
            frameId: 0,
            result: {
              href: document.href,
              timeOrigin: document.timeOrigin,
              visible: true,
              hasFocus: true,
            },
          }];
        }
        return [];
      },
    },
  };
  runner = createCmsEducationTaskRunner({
    api,
    recordKind: 'internship',
    locks,
    cryptoImpl: globalThis.crypto,
    timeoutMs: 5000,
  });
  return { invoke, stats, data, autoSender, badSender };
}

test('CMS_INTERNSHIP_AUTO rejects non-internship auto page sender', async () => {
  const h = await harness();
  const response = await h.invoke({ type: 'CMS_INTERNSHIP_AUTO', mode: 'readiness' }, h.badSender);
  assert.equal(response.ok, false);
  assert.equal(response.reason, 'cms_education_wrong_sender');
  assert.equal(h.stats.run, 0);
});

test('CMS_INTERNSHIP_AUTO readiness inspects and binds without RUN', async () => {
  const h = await harness();
  const response = await h.invoke({ type: 'CMS_INTERNSHIP_AUTO', mode: 'readiness', profileIndex: 0, replaceExisting: true });
  assert.equal(response.ok, true);
  assert.equal(response.kind, 'cms_internship_auto');
  assert.equal(response.mode, 'readiness');
  assert.equal(response.writeAttempted, false);
  assert.equal(response.bindOk, true);
  assert.equal(h.stats.inspect, 1);
  assert.equal(h.stats.run, 0);
  assert.equal(response.records?.length, 1);
  assert.equal(response.records[0].target.mode, 'existing');
  assert.equal(response.records[0].target.identity, 'synthetic-internship-row');
  assert.equal(h.data.resumeCmsInternshipAutoRun?.ok, true);
  assert.equal(h.data.resumeCmsInternshipAutoRun?.mode, 'readiness');
});

test('CMS_INTERNSHIP_AUTO defaults to readiness when mode omitted', async () => {
  const h = await harness();
  const response = await h.invoke({ type: 'CMS_INTERNSHIP_AUTO', profileIndex: 0 });
  assert.equal(response.ok, true);
  assert.equal(response.mode, 'readiness');
  assert.equal(response.writeAttempted, false);
  assert.equal(h.stats.run, 0);
});
