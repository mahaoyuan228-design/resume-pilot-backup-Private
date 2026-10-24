/**
 * CMS education/internship document identity:
 * - SPA query churn (same timeOrigin + resumeId) must not abort
 * - true reload (timeOrigin change) before RUN rebinds once when allowRebind
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCmsEducationTaskRunner } from '../src/background/cms-education-task-runner.mjs';
import { PAGE } from '../src/profile/cms-internship-plan.mjs';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const epoch = '00000000-0000-4000-8000-000000000001';
const tabId = 7;
const resumeId = '6ad20d62ba3d21a99b3511eb';
const locks = { request: async (_name, _options, work) => work() };

test('source: sameResumeDocument tolerates query churn; bridges use timeOrigin not full href', () => {
  const runnerSrc = readFileSync(join(__dirname, '../src/background/cms-education-task-runner.mjs'), 'utf8');
  assert.match(runnerSrc, /sameResumeDocument/);
  assert.match(runnerSrc, /allowRebind/);
  assert.match(runnerSrc, /documentRebindRetry/);
  assert.equal(runnerSrc.includes('doc.href!==expected.href||doc.timeOrigin!==expected.timeOrigin'), false);
  const internshipBridge = readFileSync(join(__dirname, '../src/content/cms-internship-bridge.js'), 'utf8');
  const educationBridge = readFileSync(join(__dirname, '../src/content/cms-education-multi-bridge.js'), 'utf8');
  for (const src of [internshipBridge, educationBridge]) {
    assert.match(src, /performance\.timeOrigin!==doc\.timeOrigin/);
    assert.equal(src.includes('location.href===doc?.href'), false);
    assert.match(src, /__resumeCms.*BridgeRevision===4/);
  }
});

test('internship START: SPA href query change keeps same timeOrigin → reaches RUN', async () => {
  const live = {
    href: `${PAGE}?recruitType=1&resumeId=${resumeId}&tid=aaa&lang=1`,
    timeOrigin: 42,
    visible: true,
  };
  // Inspect captured a slightly different query (SPA replaceState).
  const captured = {
    href: `${PAGE}?recruitType=1&resumeId=${resumeId}&lang=1`,
    timeOrigin: 42,
    visible: true,
  };
  const experience = [{
    type: 'internship',
    organization: 'Acme',
    position: 'Intern',
    description: 'Work',
    startDate: '2022-09-01',
    endDate: '2022-12-01',
  }];
  const data = {
    resumeProfile: {
      schemaVersion: 1,
      fullName: 'A',
      experience,
      confirmedFields: experience.flatMap((row, index) =>
        Object.keys(row).map((key) => `experience.${index}.${key}`)),
    },
    resumeProfileLifecycle: { version: 1, epoch, state: 'ready' },
  };
  const clone = (value) => (value === undefined ? undefined : structuredClone(value));
  const stats = { run: 0, runDocument: null };
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
  const popup = { id: 'synthetic-extension', url: 'chrome-extension://synthetic-extension/src/popup/popup.html' };
  const invoke = (message, sender = popup) =>
    new Promise((resolve) => { runner.listener(message, sender, resolve); });
  const api = {
    storage: { local: storage },
    runtime: {
      id: popup.id,
      getURL: (path) => 'chrome-extension://synthetic-extension/' + path,
      getManifest: () => ({ background: { service_worker: 'src/background/worker.mjs' } }),
    },
    windows: { update: async () => ({}) },
    tabs: {
      get: async () => ({ id: tabId, url: live.href, windowId: 1 }),
      query: async () => [{ id: tabId, url: live.href }],
      update: async () => ({ id: tabId, url: live.href, windowId: 1 }),
      sendMessage: async (_tab, message) => {
        if (message.type === 'CMS_INTERNSHIP_MULTI_INSPECT') {
          return { ok: true, data: { document: captured, rows: [{ identity: 'row-1', fields: [] }] } };
        }
        if (message.type === 'CMS_INTERNSHIP_MULTI_STATUS') {
          return { ok: true, state: 'settled', requestId: message.requestId };
        }
        if (message.type === 'CMS_INTERNSHIP_MULTI_RUN') {
          stats.run += 1;
          stats.runDocument = message.document;
          // Soft-skip style settled outcome (no Save).
          return {
            ok: true,
            data: {
              ok: true,
              complete: false,
              reason: 'internship_records_partial',
              writeStarted: false,
              addClicks: 0,
              saveClicks: 0,
              deleteClicks: 0,
              finalSubmitClicks: 0,
              bindings: [{ profileIndex: 0, identity: 'row-1' }],
              fields: [],
              serialization: [],
              serializedRecordCount: 0,
              provisionalNewRecords: 0,
            },
          };
        }
        throw Error('unexpected:' + message.type);
      },
    },
    scripting: {
      executeScript: async (request) => {
        if (request.files) return [];
        if (typeof request.func === 'function' && request.world === 'MAIN') {
          // Focus probe + exactTab probe both hit here — always return live SPA href.
          return [{
            frameId: 0,
            result: {
              hasFocus: true,
              visible: true,
              href: live.href,
              timeOrigin: live.timeOrigin,
            },
          }];
        }
        return [{ frameId: 0, result: { ...live, hasFocus: true } }];
      },
    },
  };
  runner = createCmsEducationTaskRunner({
    api, locks, timeoutMs: 5000, keepAliveMs: 100000, recordKind: 'internship',
  });
  // Seed inspect path by crafting START with captured document (query differs from live).
  const binding = (await invoke({ type: 'CMS_INTERNSHIP_MULTI_INSPECT_JOB', tabId })).profileBinding;
  // Force sources via storage — inspect returns sources from profile.
  const inspected = await invoke({ type: 'CMS_INTERNSHIP_MULTI_INSPECT_JOB', tabId });
  assert.equal(inspected.ok, true);
  const source = inspected.sources.find((row) => row.profileIndex === 0);
  assert.ok(source);
  const start = {
    type: 'CMS_INTERNSHIP_MULTI_START',
    tabId,
    pageUrl: PAGE,
    profileBinding: inspected.profileBinding || binding,
    document: { ...captured },
    auto: true,
    focusTimeoutMs: 500,
    records: [{
      profileIndex: 0,
      sourceSnapshotHash: source.sourceSnapshotHash,
      supplementRefHash: source.supplementRefHash,
      target: { mode: 'existing', identity: 'row-1' },
      replaceExisting: true,
    }],
  };
  const accepted = await invoke(start);
  assert.equal(accepted.accepted, true, JSON.stringify(accepted));
  const key = 'resumeCmsInternshipJob:' + tabId;
  let job;
  for (let i = 0; i < 500; i++) {
    job = data[key];
    if (job && !['queued', 'running'].includes(job.state)) break;
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.ok(job, 'job missing');
  assert.equal(stats.run, 1, 'SPA query churn must not block RUN: ' + job.reason);
  assert.equal(stats.runDocument?.timeOrigin, 42);
  // Href on the RUN document should refresh to live SPA href when tolerated.
  assert.equal(stats.runDocument?.href, live.href);
});
