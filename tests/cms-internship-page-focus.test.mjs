/**
 * Internship multi parity: shared createCmsEducationTaskRunner(recordKind:'internship')
 * must call awaitCmsPageDocumentFocus before RUN — same gate as education.
 * Unfocused tab → stopped_before_write / page_unfocused; RUN must not dispatch.
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
const document = { href: PAGE + '?synthetic=1', timeOrigin: 17, visible: true };
const locks = { request: async (_name, _options, work) => work() };

const fixture = () => {
  const experience = Array.from({ length: 1 }, (_, i) => ({
    type: 'internship',
    organization: 'Synthetic Company ' + i,
    position: 'Synthetic Role ' + i,
    description: 'Synthetic Work ' + i,
    startDate: '2020-01-02',
    endDate: '2020-06-03',
  }));
  return {
    schemaVersion: 1,
    fullName: 'Synthetic Customer A',
    experience,
    confirmedFields: experience.flatMap((row, index) =>
      Object.keys(row).map((key) => 'experience.' + index + '.' + key)),
  };
};

async function harness({ hasFocus = true } = {}) {
  const data = {
    resumeProfile: fixture(),
    resumeProfileLifecycle: { version: 1, epoch, state: 'ready' },
  };
  const clone = (value) => (value === undefined ? undefined : structuredClone(value));
  const stats = { run: 0, focusProbes: 0, files: 0 };
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
    new Promise((resolve) => {
      runner.listener(message, sender, resolve);
    });
  const api = {
    storage: { local: storage },
    runtime: {
      id: popup.id,
      getURL: (path) => 'chrome-extension://synthetic-extension/' + path,
      getManifest: () => ({ background: { service_worker: 'src/background/worker.mjs' } }),
    },
    windows: { update: async () => ({}) },
    tabs: {
      get: async () => ({ id: tabId, url: document.href, windowId: 1 }),
      query: async () => [{ id: tabId, url: document.href }],
      update: async () => ({ id: tabId, url: document.href, windowId: 1 }),
      sendMessage: async (_tab, message) => {
        if (message.type === 'CMS_INTERNSHIP_MULTI_INSPECT') {
          return { ok: true, data: { document, rows: [{ identity: 'synthetic-existing-row', fields: [] }] } };
        }
        if (message.type === 'CMS_INTERNSHIP_MULTI_STATUS') {
          return { ok: true, state: 'settled', requestId: message.requestId };
        }
        if (message.type === 'CMS_INTERNSHIP_MULTI_RUN') {
          stats.run += 1;
          throw Error('run_should_not_dispatch_when_unfocused');
        }
        throw Error('unexpected_message:' + message.type);
      },
    },
    scripting: {
      executeScript: async (request) => {
        if (request.files) {
          stats.files += 1;
          return [];
        }
        // Focus probe from awaitCmsPageDocumentFocus (MAIN world, no files).
        if (typeof request.func === 'function' && request.world === 'MAIN') {
          stats.focusProbes += 1;
          return [{
            frameId: 0,
            result: {
              hasFocus,
              visible: true,
              href: document.href,
              timeOrigin: document.timeOrigin,
            },
          }];
        }
        return [{ frameId: 0, result: { ...document, hasFocus } }];
      },
    },
  };
  runner = createCmsEducationTaskRunner({
    api,
    locks,
    timeoutMs: 2000,
    keepAliveMs: 100000,
    recordKind: 'internship',
  });
  const inspected = await invoke({ type: 'CMS_INTERNSHIP_MULTI_INSPECT_JOB', tabId });
  assert.equal(inspected.ok, true);
  const request = {
    type: 'CMS_INTERNSHIP_MULTI_START',
    tabId,
    pageUrl: PAGE,
    profileBinding: inspected.profileBinding,
    document: clone(inspected.document),
    records: [{
      ...inspected.sources.find((row) => row.profileIndex === 0),
      target: { mode: 'existing', identity: 'synthetic-existing-row' },
      replaceExisting: true,
    }],
  };
  const settled = async () => {
    const key = 'resumeCmsInternshipJob:' + tabId;
    // Focus gate polls up to ~2000ms before page_unfocused; wait past that.
    for (let i = 0; i < 800; i++) {
      const job = data[key];
      if (job && !['queued', 'running'].includes(job.state)) return clone(job);
      await new Promise((r) => setTimeout(r, 10));
    }
    throw Error('fixture_timeout');
  };
  return { data, stats, invoke, request, settled };
}

test('source audit: internship and education share awaitCmsPageDocumentFocus call site', () => {
  const runnerPath = join(__dirname, '../src/background/cms-education-task-runner.mjs');
  const src = readFileSync(runnerPath, 'utf8');
  assert.match(src, /import \{awaitCmsPageDocumentFocus\} from '\.\/cms-page-focus\.mjs'/);
  assert.match(src, /recordKind==='internship'/);
  assert.match(src, /await awaitCmsPageDocumentFocus\(api,tabId/);
  // Single call site before RUN dispatch — not education-only.
  const focusCalls = src.split('awaitCmsPageDocumentFocus').length - 1;
  assert.ok(focusCalls >= 2, 'import + call expected');
  assert.equal(src.includes("if(!internship)await awaitCmsPageDocumentFocus"), false);
});

test('internship START with hasFocus false → page_unfocused, RUN not dispatched', async () => {
  const h = await harness({ hasFocus: false });
  const accepted = await h.invoke(h.request);
  assert.equal(accepted.accepted, true);
  const job = await h.settled();
  assert.equal(job.state, 'stopped_before_write');
  assert.equal(job.reason, 'page_unfocused');
  assert.equal(h.stats.run, 0);
  assert.ok(h.stats.focusProbes >= 1);
});

test('internship START with hasFocus true probes focus before continuing', async () => {
  // Focus true but we still throw on RUN to prove probe ran; accept stopped/unknown after dispatch attempt.
  const h = await harness({ hasFocus: true });
  // Override sendMessage RUN to settle without throwing so job can complete path to focus only:
  // Re-harness is heavy; assert probes from unfocused case + source audit is enough for parity.
  // Here: focus true → probe returns hasFocus; RUN is invoked (stats.run) then throws → unknown/stopped.
  const accepted = await h.invoke(h.request);
  assert.equal(accepted.accepted, true);
  const job = await h.settled();
  assert.ok(h.stats.focusProbes >= 1, 'focus gate must probe before RUN');
  assert.equal(h.stats.run, 1, 'focused internship must reach RUN');
  assert.ok(['unknown', 'stopped_before_write'].includes(job.state));
});
