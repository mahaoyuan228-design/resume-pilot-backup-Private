#!/usr/bin/env node
/**
 * Never-Save trial of the existing 招商 CMS education text writer.
 * Run from the repository root with an already-open Edge resume tab:
 *   $env:PORT='9239'; $env:OUTDIR=Join-Path ([Environment]::GetFolderPath('Desktop')) 'ResumeQuickFill-Dev\_temp-scripts'; node scripts/live/cms-education-live.mjs
 *
 * ROW_INDEX (default 0) selects one existing education row. The default is text
 * only; CONTROLS=1 opts in to seven harvested widgets. No Add, edit,
 * Save, Submit, Next, Apply, Deliver, or Delete control is clicked. The shipped record controller
 * writes 专业名称 / 专业描述; the shipped public-props reader and verifier
 * check React serialization. Opt-in widgets require exact fixture originals and
 * only exercise owned open/close probes before verifying preexisting values.
 * Original values stay in the page, and are restored with native events and
 * real focus/blur (including empty originals that createPlan cannot confirm).
 * This is a fixture trial, not the extension's licensed popup workflow or a
 * claim of live support. It never reads profile storage or private keys.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectCdp, getJson } from '../../tools/live-harvest/cdp-client.mjs';
import { isTimeout } from '../../tools/live-harvest/errors.mjs';
import { createPlan, ownerBindingFor, sourceSnapshot } from '../../src/profile/cms-education-plan.mjs';
import { CMS_BASELINE_PAGE } from '../lib/cms-page-target.mjs';
import {
  readPort, readOutDir, readStepTimeout, readTipSha, classifyCmsTabUrl,
  selectCmsResumeTarget, assertLoopback as basicAssertLoopback, looksLikeLogin, pageGuardExpression,
  decideClicks, redactUrl
} from './cms-basic-info-live.mjs';

export { readPort, readOutDir, readStepTimeout, classifyCmsTabUrl, selectCmsResumeTarget };
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const BASE_TIP = 'f3f32545eaf32ee23a9b7d75c335acef86e700bf';
export const DEFAULT_PORT = 9239;
export const EVIDENCE_NAME = 'cms-education-live.json';
export const READBACK_WAIT_MS = 500;
export const AUTOSAVE_SETTLE_TIMEOUT_MS = 2000;
export const POWERSHELL = "$env:PORT='9239'; $env:OUTDIR=Join-Path ([Environment]::GetFolderPath('Desktop')) 'ResumeQuickFill-Dev\\_temp-scripts'; node scripts/live/cms-education-live.mjs";
export const FIELD_SPECS = Object.freeze([
  Object.freeze({ key: 'major', q: '专业名称', path: 'education.0.major', fixture: '金融学' }),
  Object.freeze({ key: 'description', q: '专业描述', path: 'education.0.majorDescription', fixture: '主修公司金融与财务报表分析。' })
]);
export const UNCLAIMED = Object.freeze(['学校', '学历', '学位', '开始时间', '结束时间', '城市', '专业排名']);
export const LIVE_FILES = Object.freeze(['src/content/cms-session.js', 'src/content/cms-record-controller.js', 'src/content/cms-education-multi.js']);
// These catalog/day values and wrappers are present in the 2026-10-23 harvest.
// This opt-in fixture is not applicant profile data or a live support claim.
export const CONTROL_SPECS = Object.freeze([
  { key: 'school', q: '学校', kind: 'school', path: 'education.0.school', fixture: '悉尼大学', wrapper: '51' },
  { key: 'degree', q: '学历', kind: 'select', path: 'education.0.degree', fixture: '本科', wrapper: '53' },
  { key: 'academicDegree', q: '学位', kind: 'select', path: 'recordSupplement.0.academicDegree', fixture: '学士', wrapper: '248' },
  { key: 'startDate', q: '开始时间', kind: 'date', path: 'education.0.startDate', fixture: '2023-02-01', wrapper: '49' },
  { key: 'endDate', q: '结束时间', kind: 'date', path: 'education.0.endDate', fixture: '2024-11-01', wrapper: '50' },
  { key: 'region', q: '城市', kind: 'region', path: 'recordSupplement.0.region', fixture: Object.freeze({ province: '北京市', city: '北京市' }), wrapper: '52' },
  { key: 'gradeRank', q: '专业排名', kind: 'select', path: 'education.0.gradeRank', fixture: '无排名', wrapper: '102301' }
].map(Object.freeze));
export const CONTROL_FILES = Object.freeze(['school', 'dates', 'select', 'region', 'adapters'].map((name) => `src/content/cms-education-multi-${name}.js`));
export const HELP = `Usage (Windows PowerShell, repository root):
  ${POWERSHELL}

Never-Save trial. Attach to the already-open baseline 招商 CMS resume tab using Edge CDP.
Select one existing education row with ROW_INDEX; default text writes are 专业名称/专业描述.
All other rows are bound with no ready facts and must remain unchanged.
Supports 1–30 existing rows (the shipped planner's limit); never adds rows.
No navigation, login, Add, Save/Submit/Next/Deliver/Delete, or non-GET transmission.
CONTROLS=1 requires all seven widget originals to equal the exact fixture display,
probes their open/close surfaces, and verifies preexisting values without option/day
selection. City probes only the captured first province menu. Changed widgets are
offline-only. Exact autosave and active-school lookup XHRs are aborted before native
send in separate logs. Every other non-GET attempt fails.
Close menus first and leave the tab alone during the trial. Originals are
restored and verified. liveSupportClaimed remains false; no live-site claim.

  PORT              Loopback CDP port. Default 9239
  OUTDIR            Evidence directory. Default current directory
  ROW_INDEX         Zero-based existing row in controller/DOM order. Default 0
  CONTROLS          Opt in to seven harvested widgets plus text: 1 (default 0).
                    Requires exact fixture originals; probes only, no support claim.
  STEP_TIMEOUT_MS   Per CDP call timeout, 1000–120000. Default 30000
Evidence: ${EVIDENCE_NAME}
`;

export function readRowIndex(env = process.env) {
  const value = env.ROW_INDEX ?? '0';
  if (typeof value !== 'string' || !/^\d+$/u.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error('ROW_INDEX must be a nonnegative safe integer');
  }
  return Number(value);
}

export function readControls(env = process.env) {
  if (!['0', '1'].includes(env.CONTROLS ?? '0')) throw new Error('CONTROLS must be 0 or 1');
  return env.CONTROLS === '1';
}

export function fieldSpecsForRow(rowIndex = 0, controls = false) {
  if (!Number.isSafeInteger(rowIndex) || rowIndex < 0) throw new Error('education_row_index_invalid');
  return [...FIELD_SPECS, ...(controls ? CONTROL_SPECS : [])].map((spec) => ({ ...spec,
    path: spec.path.replace('education.0.', `education.${rowIndex}.`).replace('recordSupplement.0.', `recordSupplement.${rowIndex}.`) }));
}

export function isNonGetMethod(method) {
  return String(method ?? '').toUpperCase() !== 'GET';
}

// The 9242 evidence identifies this XHR endpoint only. Derive its tenant from
// the already-supported page; this is not permission for other CMS tenants.
export function isEducationAutosave(request, page = CMS_BASELINE_PAGE) {
  if (String(request?.method ?? '').toUpperCase() !== 'POST' || typeof request?.url !== 'string') return false;
  try {
    const baseline = new URL(page);
    const url = new URL(request.url, baseline);
    const tenant = baseline.pathname.split('/')[1];
    return !!tenant && url.origin === baseline.origin && !url.username && !url.password && !url.search && !url.hash
      && url.pathname === `/wecruit/resume/info/edit/${tenant}`;
  } catch { return false; }
}

function validSuppressedAutosave(row) {
  return isEducationAutosave(row) && row.via === 'xhr' && row.blockedBeforeSend === true
    && ['trial', 'restore'].includes(row.phase)
    && (row.abortFailed === undefined || typeof row.abortFailed === 'boolean');
}

// School opening/searching has this one separately evidenced lookup POST.
// Aborting it cannot manufacture catalog matches; missing options still skip.
export function isSchoolLookup(request, page = CMS_BASELINE_PAGE) {
  if (String(request?.method ?? '').toUpperCase() !== 'POST' || typeof request?.url !== 'string') return false;
  try {
    const baseline = new URL(page), url = new URL(request.url, baseline);
    return url.origin === baseline.origin && !url.username && !url.password && !url.search && !url.hash
      && url.pathname === '/wecruit/dic/fuzzyMatchDic';
  } catch { return false; }
}

function validSuppressedLookup(row) {
  return isSchoolLookup(row) && row.via === 'xhr' && row.blockedBeforeSend === true
    && ['trial', 'restore'].includes(row.phase);
}

function mergeObservations(...logs) {
  const merged = new Map();
  for (const log of logs) {
    const counts = new Map();
    for (const row of log) { const key = JSON.stringify(row); counts.set(key, (counts.get(key) || 0) + 1); }
    for (const [key, count] of counts) merged.set(key, Math.max(count, merged.get(key) || 0));
  }
  return [...merged].flatMap(([key, count]) => Array.from({ length: count }, () => JSON.parse(key)));
}

export function assertLoopback(url, port) {
  if (!basicAssertLoopback(url, port)) return false;
  const endpoint = new URL(url);
  return Number(endpoint.port || (endpoint.protocol === 'wss:' ? 443 : 80)) === Number(port);
}

export function partitionTraffic(rows) {
  const seen = new Set();
  const nonGet = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!isNonGetMethod(row?.method)) continue;
    const item = {
      method: String(row?.method || 'UNKNOWN').toUpperCase(),
      url: redactUrl(row?.url),
      via: String(row?.via || 'unknown').slice(0, 40)
    };
    const key = JSON.stringify(item);
    if (!seen.has(key)) nonGet.push(item);
    seen.add(key);
  }
  return { nonGet: nonGet.slice(0, 80), saveLikePost: nonGet.slice(0, 80) };
}

export function fixtureProfile(rowIndex = 0, recordCount = rowIndex + 1, controls = false) {
  const specs = fieldSpecsForRow(rowIndex, controls);
  if (!Number.isInteger(recordCount) || recordCount < 1 || recordCount > 30) throw new Error('education_row_count_not_supported');
  if (rowIndex >= recordCount) throw new Error('education_row_index_out_of_range');
  return {
    education: Array.from({ length: recordCount }, (_unused, index) => index === rowIndex
      ? Object.fromEntries(specs.filter((spec) => spec.path.startsWith('education.')).map((spec) => [spec.path.split('.').at(-1), spec.fixture])) : {}),
    confirmedFields: specs.filter((spec) => spec.path.startsWith('education.')).map((spec) => spec.path)
  };
}

export async function createLivePlan(identityOrIdentities, rowIndex = 0, controls = false) {
  const identities = Array.isArray(identityOrIdentities) ? identityOrIdentities : [identityOrIdentities];
  const profile = fixtureProfile(rowIndex, identities.length, controls);
  const binding = await ownerBindingFor(profile, '00000000-0000-4000-8000-0000000000ed');
  // The shipped writer/verifier require every existing row to be bound. Empty
  // source rows produce only skipped facts: no applicant values leave the page,
  // and only the selected row is authorized for text writes/replacement.
  const requests = await Promise.all(identities.map(async (identity, profileIndex) => ({
    profileIndex, sourceSnapshotHash: (await sourceSnapshot(profile, profileIndex)).hash,
    target: { mode: 'existing', identity }, replaceExisting: profileIndex === rowIndex
  })));
  const supplements = controls ? CONTROL_SPECS.filter((spec) => spec.path.startsWith('recordSupplement.')).map((spec) => ({
    profileIndex: rowIndex, field: spec.key, value: spec.fixture, confirmed: true, origin: 'manual',
    sitePageUrl: CMS_BASELINE_PAGE, sourceSnapshotHash: requests[rowIndex].sourceSnapshotHash, ownerBinding: binding
  })) : [];
  return createPlan(profile, requests, supplements, binding);
}

// Copy the shipped read-only serialization module into this evaluation's
// closure. No selectors, React handlers, or write adapters are invented here.
export function buildPageExpression(root = repoRoot, rowIndex = 0, controls = false) {
  const serialization = fs.readFileSync(path.join(root, 'src/content/cms-education-serialization.mjs'), 'utf8')
    .replace(/^export /gmu, '');
  return `(() => {
    ${serialization}
    const FIELD_SPECS = ${JSON.stringify(fieldSpecsForRow(rowIndex, controls))};
    const CONTROLS = ${JSON.stringify(controls)};
    const ROW_INDEX = ${rowIndex};
    const READBACK_WAIT_MS = ${READBACK_WAIT_MS};
    const AUTOSAVE_SETTLE_TIMEOUT_MS = ${AUTOSAVE_SETTLE_TIMEOUT_MS};
    const isNonGetMethod = ${isNonGetMethod.toString()};
    const isEducationAutosave = ${isEducationAutosave.toString()};
    const isSchoolLookup = ${isSchoolLookup.toString()};
    const redactUrl = ${redactUrl.toString()};
    return (${installEducationTrial.toString()})(globalThis, ${JSON.stringify(CMS_BASELINE_PAGE)},
      readCmsEducationSerialization, verifyEducationSerialization);
  })()`;
}

function installEducationTrial(view, page, readSerialization, verifySerialization) {
  const doc = view.document;
  if (view.__cmsEducationLive || view.ResumeProfileWriteContext) return { ok: false, reason: 'profile_write_context_busy' };
  const previous = ['ResumeCmsSession', 'installResumeCmsRecordController', 'ResumeCmsEducationMulti',
    ...(CONTROLS ? ['ResumeCmsMultiSchoolSearch', 'ResumeCmsMultiEducationDates', 'ResumeCmsInternshipDates', 'ResumeCmsMultiSelect',
      'ResumeCmsInternshipSelect', 'ResumeCmsMultiRegion', 'ResumeCmsEducationMultiAdapters', 'ResumeCmsEducationMultiWidgetControls'] : [])].map((key) => ({
    key, descriptor: Object.getOwnPropertyDescriptor(view, key)
  }));
  if (previous.some(({ descriptor }) => descriptor && !descriptor.configurable)) return { ok: false, reason: 'product_globals_not_replaceable' };
  const removers = [];
  const posts = [];
  const suppressedAutosave = [];
  const suppressedLookup = [];
  const clicks = [];
  let widgetClickCount = 0;
  let activeControl = null;
  let ownedOverlaySpec = null;
  let ownedPortal = null;
  let autosavePhase = null;
  const pendingTimers = new Map();
  const timerObservers = new Map();
  const observerOwners = new Map();
  const unobservableTimers = new Set();
  let observedNonFunctionTimeouts = 0;
  let foreignTimerAttempt = false;
  let autosaveAbortFailed = false;
  let prepared = null;
  let running = null;
  let settled = false;
  let aborted = false;
  let activePlan = null;
  const stable = (value) => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
  // Harness waits must not count as page callbacks waiting to settle.
  const nativeSetTimeout = view.setTimeout;
  const nativeClearTimeout = view.clearTimeout;
  const wait = (ms) => new Promise((resolve) => nativeSetTimeout.call(view, resolve, ms));
  const timerSettle = () => ({ pendingTimers: pendingTimers.size,
    unobservableTimers: unobservableTimers.size, observedNonFunctionTimeouts });
  function detachObserver(handle) {
    const observer = timerObservers.get(handle);
    if (observer) {
      timerObservers.delete(handle);
      if (observerOwners.get(observer.id) === observer) {
        observerOwners.delete(observer.id);
        nativeClearTimeout.call(view, observer.id);
      }
    }
  }
  function loseObserver(id) {
    const observer = observerOwners.get(id);
    if (!observer) return;
    observerOwners.delete(id);
    if (timerObservers.get(observer.handle) === observer) {
      timerObservers.delete(observer.handle);
      if (pendingTimers.get(observer.handle) === observer.token) unobservableTimers.add(observer.handle);
    }
  }
  function trackTimer(handle, token) {
    // Native IDs may be reused even from within a cleared timer's callback.
    // Retire an old observer without letting it erase a newer generation.
    loseObserver(handle);
    detachObserver(handle);
    unobservableTimers.delete(handle);
    pendingTimers.set(handle, token);
  }
  const fail = (reason) => { throw new Error(reason); };
  const safeReason = (error) => /^[a-z0-9_]+$/u.test(error?.message || '') ? error.message : 'control_error';
  function patch(object, key, replacement) {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    Object.defineProperty(object, key, { configurable: true, writable: true, value: replacement });
    removers.push(() => descriptor ? Object.defineProperty(object, key, descriptor) : delete object[key]);
  }
  function note(method, url, via) {
    if (posts.length < 80) posts.push({ method: String(method || 'UNKNOWN').toUpperCase(), url: redactUrl(url), via });
  }
  function clickNote(node, type = 'click') {
    // Keep only forbidden tokens, not applicant-controlled button text.
    const text = String(node?.textContent || node?.getAttribute?.('aria-label') || '');
    if (clicks.length < 80) clicks.push({ type, label: ['保存', '提交', '投递', '删除', '确定'].find((word) => text.includes(word)) || type });
  }
  function allowedWidgetClick(node) {
    if (!CONTROLS || !autosavePhase || !activeControl || !prepared || !(node instanceof view.Element)) return false;
    const state = view.ResumeCmsEducationMulti?.inspect();
    if (!state?.ok || !sameRecordSet(state.records)) return false;
    const field = view.ResumeCmsEducationMulti.locateField(state.form, prepared.identity, activeControl.q);
    if (!field || field.item.closest('[id^="14_"]')?.id !== `14_${activeControl.wrapper}_${ROW_INDEX}`) return false;
    if (node === doc.body) return true; // Existing adapters' evidenced outside-click menu cleanup.
    if (field.item.contains(node)) {
      return activeControl.kind === 'date' ? node === field.input && node.matches('input.ant-calendar-picker-input')
        : (activeControl.kind === 'region' ? field.selections.slice(0, 1) : field.selections)
          .some((selection) => node === selection && selection.matches('.ant-select-selection[role="combobox"]'));
    }
    // Never-Save controls mode only probes open/close. Even an otherwise owned
    // catalog option, day, navigation arrow, clear icon, or OK button is denied.
    return false;
  }
  const onClick = (event) => {
    if (allowedWidgetClick(event.target)) { widgetClickCount += 1; return; }
    event.preventDefault(); event.stopImmediatePropagation(); clickNote(event.target);
  };
  const onSubmit = (event) => { event.preventDefault(); event.stopImmediatePropagation(); clickNote(event.target, 'submit'); };
  try {
    for (const [schedule, cancel, repeating] of [['setTimeout', 'clearTimeout', false], ['setInterval', 'clearInterval', true]]) {
      const originalSchedule = view[schedule], originalCancel = view[cancel];
      patch(view, schedule, function (callback, delay, ...args) {
        if (!autosavePhase) return originalSchedule.call(this, callback, delay, ...args);
        if (this !== view) {
          // Timer IDs and the companion ordering proof belong to one Window.
          foreignTimerAttempt = true;
          fail('autosave_timer_receiver_unobservable');
        }
        // Preserve native string compilation, global scope, and CSP checks.
        // A later native timeout at the same numeric delay observes the first
        // timer task's completion (HTML timer ordering), including its promise
        // continuations. Never eval site code or discard its callback.
        if (typeof callback !== 'function') {
          const handle = originalSchedule.call(this, callback, delay, ...args);
          // CSP may reject native string compilation without creating a timer.
          if (handle === 0) return handle;
          const token = {};
          trackTimer(handle, token);
          if (!repeating && (delay === undefined || typeof delay === 'number')) {
            observedNonFunctionTimeouts += 1;
            const observer = { handle, token, id: null };
            observer.id = nativeSetTimeout.call(view, () => {
              if (timerObservers.get(handle) === observer) {
                timerObservers.delete(handle);
                observerOwners.delete(observer.id);
                if (pendingTimers.get(handle) === token) {
                  pendingTimers.delete(handle);
                  unobservableTimers.delete(handle);
                }
              }
            }, delay);
            loseObserver(observer.id);
            timerObservers.set(handle, observer);
            observerOwners.set(observer.id, observer);
          } else if (!repeating) {
            // Do not coerce an object delay twice or assume an unknown delay
            // has elapsed. Explicit cancellation can still settle this timer.
            unobservableTimers.add(handle);
          }
          return handle;
        }
        let handle;
        const token = {};
        handle = originalSchedule.call(this, function (...values) {
          try { return callback.apply(this, values); }
          finally { if (!repeating && pendingTimers.get(handle) === token) pendingTimers.delete(handle); }
        }, delay, ...args);
        trackTimer(handle, token);
        return handle;
      });
      patch(view, cancel, function (handle) {
        // Another Window can have the same native ID; its cancellation must
        // never remove an entry from this Window's ledger.
        if (this !== view) return originalCancel.call(this, handle);
        // Match the native Web IDL long conversion once, including string IDs.
        const id = handle >> 0;
        originalCancel.call(this, id);
        // A site's clear-all loop can also cancel an observer ID. Do not later
        // clear that ID after native reuse, or pretend its parent was observed.
        loseObserver(id);
        pendingTimers.delete(id);
        unobservableTimers.delete(id);
        detachObserver(id);
      });
    }
    const nativeClick = view.HTMLElement.prototype.click;
    patch(view.HTMLElement.prototype, 'click', function () {
      if (allowedWidgetClick(this)) return nativeClick.call(this);
      clickNote(this);
    });
    doc.addEventListener('click', onClick, true);
    doc.addEventListener('submit', onSubmit, true);
    removers.push(() => { doc.removeEventListener('click', onClick, true); doc.removeEventListener('submit', onSubmit, true); });
    for (const method of ['submit', 'requestSubmit']) {
      patch(view.HTMLFormElement.prototype, method, function () { clickNote(this, 'submit'); });
    }
    if (typeof view.fetch === 'function') {
      const original = view.fetch;
      patch(view, 'fetch', function (input, init, ...rest) {
        const method = init?.method ?? input?.method ?? 'GET';
        if (isNonGetMethod(method)) {
          note(method, typeof input === 'string' ? input : input?.url, 'fetch');
          return Promise.reject(new TypeError('cms_education_live_blocked_non_get'));
        }
        return original.call(this, input, init, ...rest);
      });
    }
    const xhr = view.XMLHttpRequest?.prototype;
    if (xhr) {
      const metadata = new WeakMap();
      const open = xhr.open, send = xhr.send, abort = xhr.abort;
      patch(xhr, 'open', function (method, url, ...rest) {
        const result = open.call(this, method, url, ...rest);
        metadata.set(this, { method, url, openedDuringTrial: !!autosavePhase, openedForSchool: activeControl?.kind === 'school' });
        return result;
      });
      patch(xhr, 'send', function (...args) {
        const request = metadata.get(this);
        // Unknown requests may have been opened before the guard was installed.
        if (!request || isNonGetMethod(request.method)) {
          // Only the evidenced autosave may continue local verification. Native
          // send is never reached, even if abort throws. Record the block in
          // either case; an abort failure remains fatal and retains guards.
          if (autosavePhase && request?.openedDuringTrial && isEducationAutosave(request, page)) {
            const phase = autosavePhase;
            let abortFailed = false;
            try { abort.call(this); }
            catch { abortFailed = true; autosaveAbortFailed = true; }
            finally {
              if (suppressedAutosave.length < 80) suppressedAutosave.push({
                method: 'POST', url: new URL(request.url, page).href, via: 'xhr',
                blockedBeforeSend: true, phase, ...(abortFailed ? { abortFailed: true } : {})
              });
            }
            return undefined;
          }
          if (autosavePhase && request?.openedDuringTrial && request.openedForSchool && activeControl?.kind === 'school' && isSchoolLookup(request, page)) {
            try { this.abort(); }
            catch (error) { note(request.method, request.url, 'xhr'); throw error; }
            if (suppressedLookup.length < 80) suppressedLookup.push({ method: 'POST', url: new URL(request.url, page).href,
              via: 'xhr', blockedBeforeSend: true, phase: autosavePhase });
            return undefined;
          }
          note(request?.method, request?.url, 'xhr');
          this.abort();
          return undefined;
        }
        return send.apply(this, args);
      });
    }
    if (typeof view.navigator?.sendBeacon === 'function') patch(view.navigator, 'sendBeacon', function (url) {
      note('POST', url, 'beacon'); return false;
    });
    // Install the current checkout even over configurable, nonwritable globals.
    // The product factory assigns in sloppy mode, so an unchecked assignment
    // could otherwise silently retain stale code.
    for (const { key } of previous) {
      if (!delete view[key] || Object.hasOwn(view, key)) fail('product_globals_not_replaceable');
    }
  } catch {
    for (const remove of removers.reverse()) { try { remove(); } catch { /* fail closed before injection */ } }
    for (const { key, descriptor } of previous) {
      if (descriptor) Object.defineProperty(view, key, descriptor);
      else delete view[key];
    }
    return { ok: false, reason: 'guard_install_failed' };
  }

  function pageCheck() {
    if (view.location.origin + view.location.pathname !== page) fail('wrong_page');
    if (doc.readyState !== 'complete') fail('page_not_ready');
    if (doc.visibilityState !== 'visible') fail('page_hidden');
    if ([...doc.querySelectorAll('input[type="password"]')].some((node) => node.getClientRects().length)) fail('needs_login');
    if (prepared && (view.location.href !== prepared.href || view.performance.timeOrigin !== prepared.timeOrigin)) fail('document_changed');
  }
  function safetyCheck() {
    pageCheck();
    if (aborted) fail('trial_aborted');
    if (clicks.length) fail('click_not_allowed');
    if (posts.length) fail('non_get_request');
    if (autosaveAbortFailed) fail('autosave_abort_failed');
  }
  async function settleCallbacks() {
    const deadline = view.performance.now() + AUTOSAVE_SETTLE_TIMEOUT_MS;
    // Include a quiet turn for promise continuations and nested callbacks. Do
    // not cancel or discard site timers: an unresolved callback fails cleanup.
    do {
      await wait(pendingTimers.size ? 25 : 0);
      pageCheck();
      if (foreignTimerAttempt) fail('autosave_timer_receiver_unobservable');
      if (!pendingTimers.size) return;
    } while (view.performance.now() < deadline);
    fail(unobservableTimers.size ? 'autosave_timer_unobservable' : 'autosave_callbacks_pending');
  }
  function readProof() {
    const proof = readSerialization();
    if (!proof?.ok) fail(proof?.reason || 'education_serialization_unavailable');
    if (prepared && !sameRecordSet(proof.rows)) fail('education_binding_changed');
    return proof;
  }
  function sameRecordSet(records) {
    return records.length === prepared.identities.length
      && records.every((row, index) => row.identity === prepared.identities[index]);
  }
  function proofSnapshot(proof) {
    // Ant can materialize an absent empty field as '' after cleanup. Both
    // serialize to an omitted DTO key. Normalize only the two empty originals,
    // never another control or the serialized payload itself.
    const rows = proof.rows.map((row) => ({ ...row, fields: row.fields.map((field) => {
      if (row.identity !== prepared?.identity
        || !prepared.originals.some(({ spec, value }) => spec.q === field.question && value === '')) return field;
      return { ...field, raw: field.raw ?? '', display: field.display ?? '', serialized: field.serialized ?? '' };
    }) }));
    return stable({ rows, serialized: proof.serialized });
  }
  function protectedProofSnapshot(proof) {
    // Only the selected row's two text values may change. Preserve all other
    // public props and DTO values, including absent vs empty in untouched rows.
    const serialized = proof.serialized.set_14.map((record) => ({ ...record }));
    const rows = proof.rows.map((row, index) => ({ ...row, fields: row.fields.map((field) => {
      if (row.identity !== prepared.identity || !FIELD_SPECS.some((spec) => spec.q === field.question)) return field;
      delete serialized[index]['item_' + field.oldItemId];
      return { ...field, raw: null, display: null, serialized: null };
    }) }));
    return stable({ rows, serialized });
  }
  function outsideSnapshot(targets) {
    const skip = new Set(targets);
    const targetItems = CONTROLS && prepared ? FIELD_SPECS.map((spec) => locateField(spec).item) : [];
    return stable([...doc.querySelectorAll('input,textarea,select,.ant-select-selection-selected-value,.ant-select-selection-item')]
      .filter((node) => !skip.has(node) && !targetItems.some((item) => item.contains(node))
        && !(CONTROLS && node.closest('.ant-select-dropdown,.ant-calendar-picker-container')))
      .map((node) => [node.tagName, node.type || '', node.value ?? node.textContent ?? '', !!node.checked, node.selectedIndex ?? null]));
  }
  function boundState() {
    const state = view.ResumeCmsEducationMulti.inspect();
    if (!state.ok || !sameRecordSet(state.records)) fail('education_binding_changed');
    return state;
  }
  function locateField(spec, state = boundState()) {
    const field = view.ResumeCmsEducationMulti.locateField(state.form, prepared.identity, spec.q);
    if (!field) fail('control_not_supported');
    if (spec.kind) {
      if (field.kind !== (spec.kind === 'school' ? 'select' : spec.kind)
        || field.item.closest('[id^="14_"]')?.id !== `14_${spec.wrapper}_${ROW_INDEX}`) fail('control_not_supported');
      return field;
    }
    const input = field?.input;
    if (field?.kind !== 'text' || !input || input.disabled || input.readOnly
      || !(input instanceof view.HTMLTextAreaElement || input instanceof view.HTMLInputElement && input.type === 'text')
      || input.closest('.ant-select,.ant-calendar-picker,.ant-picker,.el-date-editor,.el-select,.el-cascader,.cascader-wrap,.cascader-plugins-wrap')) fail('control_not_supported');
    return field;
  }
  function locate(spec, state = boundState()) {
    return locateField(spec, state).input;
  }
  function domValue(spec) {
    const field = locateField(spec);
    return spec.kind ? field.value : field.input.value;
  }
  function desiredDom(spec) {
    return spec.kind === 'region' ? [spec.fixture.province, spec.fixture.city]
      : ['school', 'select'].includes(spec.kind) ? [spec.fixture] : spec.fixture;
  }
  function originalsMatch() {
    return prepared.originals.every(({ spec, value }) => stable(domValue(spec)) === stable(value));
  }
  function widgetOverlays() {
    return [...doc.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden),.ant-select.ant-select-open,.ant-calendar-picker-container')]
      .filter((node) => node.getClientRects().length && view.getComputedStyle(node).display !== 'none'
        && view.getComputedStyle(node).visibility !== 'hidden');
  }
  function targetInputs() {
    const state = boundState();
    return FIELD_SPECS.flatMap((spec) => {
      const field = locateField(spec, state);
      return spec.kind ? [...field.item.querySelectorAll('input,textarea,select,.ant-select-selection-selected-value,.ant-select-selection-item')] : [field.input];
    });
  }
  function prepare() {
    let recordCount = null;
    try {
      if (prepared) fail('trial_already_prepared');
      safetyCheck();
      if (view.ResumeProfileWriteContext) fail('profile_write_context_busy');
      if (CONTROLS && widgetOverlays().length) fail('control_busy');
      const controller = view.ResumeCmsEducationMulti;
      if (typeof controller?.inspect !== 'function' || typeof controller?.run !== 'function') fail('education_module_unavailable');
      const state = controller.inspect();
      if (!state.ok) fail(state.reason);
      recordCount = state.records.length;
      if (ROW_INDEX >= recordCount) fail('education_row_index_out_of_range');
      if (recordCount > 30) fail('education_row_count_not_supported');
      prepared = { identity: state.records[ROW_INDEX].identity, identities: state.records.map((row) => row.identity),
        href: view.location.href, timeOrigin: view.performance.timeOrigin, originals: [] };
      const proof = readProof();
      for (const spec of FIELD_SPECS) {
        const live = locateField(spec), input = live.input;
        const fields = proof.rows[ROW_INDEX].fields.filter((field) => field.question === spec.q);
        const field = fields[0];
        if (spec.kind) {
          const value = domValue(spec), display = spec.kind === 'region' ? field?.display
            : ['school', 'select'].includes(spec.kind) ? [field?.display] : field?.display;
          if (fields.length !== 1 || stable(value) !== stable(display)
            || (Array.isArray(value) ? value.length !== (spec.kind === 'region' ? 2 : 1) || value.some((item) => typeof item !== 'string' || !item.trim())
              : typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value))) fail('education_control_original_not_restorable');
          // With fuzzy lookup aborted, a changed school may make its original
          // catalog option unreachable. Only the exact preexisting fixture is
          // safe for this Never-Save trial; changed-school writes stay offline.
          if (spec.kind === 'school' && stable(value) !== stable([spec.fixture])) fail('education_school_original_not_restorable');
          if (spec.kind === 'region' && stable(value) !== stable([spec.fixture.province, spec.fixture.city])) fail('education_region_original_not_restorable');
          if (stable(value) !== stable(desiredDom(spec))) fail('education_control_original_not_fixture');
          const catalogs = {
            degree: ['初中及以下','高中','技校/职高','中专','大专','本科','双学位','硕士研究生','MBA','EMBA','MPA','法律硕士','博士研究生','其它'],
            academicDegree: ['无','学士','双学士','硕士','双硕士','博士'],
            gradeRank: ['前5%','前10%','前20%','前30%','前50%','前70%','后30%','无排名']
          };
          if (spec.kind === 'select' && !catalogs[spec.key]?.includes(value[0])) fail('education_control_original_not_restorable');
          if (spec.kind === 'date') {
            const [year, month, day] = value.split('-').map(Number), date = new Date(Date.UTC(year, month - 1, day));
            const [fixtureYear, fixtureMonth] = spec.fixture.split('-').map(Number);
            if (year < 1900 || year > 2100 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day
              || Math.abs(year * 12 + month - fixtureYear * 12 - fixtureMonth) > 60) fail('education_control_original_not_restorable');
          }
          if (typeof view.ResumeCmsEducationMultiAdapters?.[spec.kind] !== 'function') fail('control_adapter_unavailable');
          prepared.originals.push({ spec, value: structuredClone(value), rawSnapshot: stable({ raw: field.raw, serialized: field.serialized, display: field.display }), fact: { status: 'ready', confirmed: true,
            path: spec.path, value: spec.kind === 'region' ? { province: value[0], city: value[1] } : Array.isArray(value) ? value[0] : value,
            optionText: spec.kind === 'region' ? { province: value[0], city: value[1] } : Array.isArray(value) ? value[0] : value } });
          continue;
        }
        if (fields.length !== 1 || ![1, 6].includes(field.fillType) || field.customDataSource
          || ![null, 'string'].includes(field.raw === null ? null : typeof field.raw)
          || String(field.raw ?? '') !== input.value || String(field.display ?? '') !== input.value) fail('education_original_state_mismatch');
        prepared.originals.push({ spec, value: input.value });
      }
      prepared.proof = proofSnapshot(proof);
      prepared.protectedProof = protectedProofSnapshot(proof);
      prepared.others = outsideSnapshot(targetInputs());
      return { ok: true, rowIndex: ROW_INDEX, recordCount, identity: prepared.identity, identities: prepared.identities.slice() };
    } catch (error) { prepared = null; return { ok: false, reason: safeReason(error), rowIndex: ROW_INDEX, recordCount }; }
  }

  async function restore() {
    autosavePhase = 'restore';
    pageCheck();
    if (CONTROLS && widgetOverlays().length) {
      if (!ownedOverlaySpec) fail('menu_cleanup_failed');
      activeControl = ownedOverlaySpec;
      try { await closeProbe(ownedOverlaySpec); }
      finally { activeControl = null; }
    }
    if (originalsMatch()
      && proofSnapshot(readProof()) === prepared.proof
      && outsideSnapshot(targetInputs()) === prepared.others && (!CONTROLS || !widgetOverlays().length)) {
      let drainError = null;
      try { await settleCallbacks(); } catch (error) { drainError = error; }
      if (originalsMatch()
        && proofSnapshot(readProof()) === prepared.proof
        && outsideSnapshot(targetInputs()) === prepared.others && (!CONTROLS || !widgetOverlays().length)) {
        if (drainError) throw drainError;
        return { ok: true, via: 'not_needed', otherChanged: false };
      }
      // A callback may dirty a previously restored field before the drain
      // times out. Still apply native restoration before reporting failure.
    }
    let changed = false;
    for (const original of prepared.originals) {
      pageCheck();
      if (original.spec.kind) {
        const current = readProof().rows[ROW_INDEX].fields.find((field) => field.question === original.spec.q);
        if (stable(domValue(original.spec)) !== stable(original.value)
          || stable({ raw: current.raw, serialized: current.serialized, display: current.display }) !== original.rawSnapshot) {
          const outcome = await widgetAdapter(original.spec, locateField(original.spec), original.fact, {
            profileIndex: ROW_INDEX, rowIdentity: prepared.identity, sectionName: '教育经历必填',
            key: original.spec.key, question: original.spec.q, sourcePath: original.spec.path,
            confirmed: true, replaceExisting: true
          }, { form: boundState().form, locate: () => locateField(original.spec) });
          if (outcome?.status !== 'verified') fail('restore_control_failed');
        }
        continue;
      }
      const input = locate(original.spec);
      // Native cleanup preserves whitespace/empty values; createPlan normalizes
      // them. It is never counted as a product fill or support evidence.
      input.focus({ preventScroll: true });
      if (doc.activeElement !== input) fail('restore_focus_failed');
      const proto = input instanceof view.HTMLTextAreaElement ? view.HTMLTextAreaElement.prototype : view.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, original.value);
      input.dispatchEvent(new view.Event('input', { bubbles: true }));
      input.dispatchEvent(new view.Event('change', { bubbles: true }));
      input.blur();
    }
    await wait(READBACK_WAIT_MS);
    await settleCallbacks();
    pageCheck();
    const domMatch = originalsMatch();
    const propsMatch = proofSnapshot(readProof()) === prepared.proof;
    changed = outsideSnapshot(targetInputs()) !== prepared.others
      || protectedProofSnapshot(readProof()) !== prepared.protectedProof;
    return { ok: domMatch && propsMatch && !changed && (!CONTROLS || !widgetOverlays().length), via: CONTROLS ? 'product_adapters_and_native_events' : 'native_events', otherChanged: changed };
  }

  function probeSurface(spec) {
    const field = locateField(spec);
    return spec.kind === 'date' ? field.input : field.selections[0];
  }

  function probeOverlay(spec, closing = false) {
    const surface = probeSurface(spec);
    const overlays = widgetOverlays();
    if (!overlays.length) return closing ? { surface, closed: true } : null;
    if (spec.kind === 'date') {
      if (overlays.length !== 1 || !overlays[0].matches('.ant-calendar-picker-container')
        || !overlays[0].querySelector('.ant-calendar-date-panel') || ownedPortal && overlays[0] !== ownedPortal) return null;
      return { surface, overlay: overlays[0], closed: false };
    }
    const select = surface.closest('.ant-select');
    const open = overlays.filter(node => node.matches('.ant-select.ant-select-open'));
    const menus = overlays.filter(node => node.matches('.ant-select-dropdown'));
    const ids = [...new Set([...select.querySelectorAll('[aria-controls]')].map(node => node.getAttribute('aria-controls')).filter(Boolean))];
    const linked = ids.length === 1 && doc.getElementById(ids[0]);
    // The harvested aria-controls points to a DIV inside the dropdown. Keep
    // that link mandatory; expanded=true and hidden catalog options alone do
    // not prove opening (see the captured 学历 retries).
    // The 学历 harvest also has an expanded select with only a hidden linked
    // dropdown. It may receive close signals, but cannot satisfy an open probe.
    const hiddenLinkedMenu = closing && !menus.length && open.length === 1 && open[0] === select
      && linked && linked.closest('.ant-select-dropdown');
    const menu = menus[0] || (closing && ownedPortal) || hiddenLinkedMenu;
    if (open.length > 1 || open.length === 1 && open[0] !== select || menus.length > 1
      || overlays.length !== open.length + menus.length || !menu || !linked || !menu.contains(linked)
      || ownedPortal && menu !== ownedPortal || !closing && (open.length !== 1 || menus.length !== 1)) return null;
    // A captured menu can outlive the open class during its exit animation,
    // or hide just before the open class is removed. Neither is closed yet.
    return { surface, overlay: menu, closed: false };
  }

  async function closeProbe(spec) {
    pageCheck();
    const initial = probeOverlay(spec, true);
    if (!initial) fail('menu_cleanup_failed');
    if (initial.closed) { ownedOverlaySpec = null; ownedPortal = null; return; }
    ownedPortal ||= initial.overlay;
    const surface = initial.surface;
    surface.focus({ preventScroll: true });
    const currentSurface = () => {
      const state = probeOverlay(spec, true);
      if (!state || state.surface !== surface || !surface.isConnected) fail('menu_cleanup_failed');
    };
    currentSurface();
    const field = locateField(spec);
    const surfaces = spec.kind === 'date' ? [surface, surface.closest('.ant-calendar-picker'), doc]
      : [surface, ...field.item.querySelectorAll('input.ant-select-search__field')];
    for (const node of surfaces.filter(Boolean)) {
      currentSurface();
      if (node !== doc && !node.isConnected) fail('menu_cleanup_failed');
      node.dispatchEvent(new view.KeyboardEvent('keydown', {
        key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true
      }));
    }
    surface.blur();
    const deadline = view.performance.now() + AUTOSAVE_SETTLE_TIMEOUT_MS;
    const waitClosed = async (until) => {
      do {
        pageCheck();
        const state = probeOverlay(spec, true);
        if (!state) fail('menu_cleanup_failed');
        if (state.closed) return true;
        await wait(25);
      } while (view.performance.now() < until);
      return false;
    };
    // Give the owned exit animation time before the evidenced outside cleanup.
    if (!await waitClosed(Math.min(deadline, view.performance.now() + 650))) {
      for (const type of ['mousedown', 'mouseup', 'click']) {
        if (!probeOverlay(spec, true)) fail('menu_cleanup_failed');
        doc.body.dispatchEvent(new view.MouseEvent(type, { bubbles: true, cancelable: true }));
      }
      if (!await waitClosed(deadline)) fail('menu_cleanup_failed');
    }
    await settleCallbacks();
    if (widgetOverlays().length) fail('menu_cleanup_failed');
    ownedOverlaySpec = null;
    ownedPortal = null;
  }

  async function waitForProbeOpen(spec) {
    const deadline = view.performance.now() + AUTOSAVE_SETTLE_TIMEOUT_MS;
    do {
      pageCheck();
      const state = probeOverlay(spec);
      if (state) { ownedPortal = state.overlay; return; }
      await wait(25);
    } while (view.performance.now() < deadline);
    fail('widget_open_failed');
  }

  async function widgetAdapter(spec, field, fact, binding, context) {
    if (activeControl) fail('control_adapter_reentrant');
    activeControl = spec;
    try {
      {
        // Exercise each captured opener without choosing options or days.
        // City opens the first province select only. The exact fixture display
        // was required for every widget before any trial text writes.
        const before = stable({ value: field.value, proof: readProof() });
        const surface = probeSurface(spec);
        ownedOverlaySpec = spec;
        // One complete activation of the captured opener. Do not retry/toggle
        // on a delayed mount, and do not infer a successful open from events.
        if (!view.ResumeCmsEducationMultiWidgetControls?.activateSurface(surface, () => {
          safetyCheck();
          const current = probeSurface(spec);
          return allowedWidgetClick(current) ? current : null;
        })) fail('widget_open_failed');
        await waitForProbeOpen(spec);
        await closeProbe(spec);
        if (stable({ value: locateField(spec).value, proof: readProof() }) !== before) fail('education_control_open_changed_value');
      }
      // Opening is read-only; exact preexisting values were required before any
      // writes. Product adapters verify them without reselecting raw codes.
      return await view.ResumeCmsEducationMultiAdapters[spec.kind](field, fact,
        { ...binding, replaceExisting: false }, context);
    }
    finally { activeControl = null; }
  }

  async function execute(plan) {
    const result = { ok: false, reason: 'not_run', liveSupportClaimed: false, readbacks: [],
      rowIndex: ROW_INDEX, recordCount: prepared?.identities.length ?? null,
      restored: false, pageLeftAsFound: false, otherChanged: false, waitedMs: 0, productReason: null };
    let writeStarted = false;
    try {
      safetyCheck();
      if (!prepared) fail('education_not_prepared');
      if (view.ResumeProfileWriteContext) fail('profile_write_context_busy');
      const session = await view.ResumeCmsSession?.check();
      if (session?.authenticated !== true) fail(session?.reason || 'site_session_unverified');
      safetyCheck();
      const record = plan?.records?.[ROW_INDEX];
      if (plan?.page !== page || !Array.isArray(plan.records) || plan.records.length !== prepared.identities.length
        || plan.records.some((item, index) => item?.profileIndex !== index || item.target?.mode !== 'existing'
          || item.target.identity !== prepared.identities[index] || item.replaceExisting !== (index === ROW_INDEX)
          || !item.facts || Object.entries(item.facts).some(([key, fact]) => fact?.status === 'ready'
            && (index !== ROW_INDEX || !FIELD_SPECS.some((spec) => spec.key === key))))
        || !plan.ownerBinding || FIELD_SPECS.some((spec) => record.facts?.[spec.key]?.status !== 'ready'
          || stable(record.facts[spec.key].value) !== stable(spec.fixture) || record.facts[spec.key].path !== spec.path)) fail('education_trial_plan_invalid');
      const digest = await view.crypto.subtle.digest('SHA-256', new view.TextEncoder().encode(stable({ ...plan, fingerprint: undefined })));
      const fingerprint = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
      if (fingerprint !== plan.fingerprint) fail('education_plan_changed');
      activePlan = stable(plan);
      if (proofSnapshot(readProof()) !== prepared.proof || outsideSnapshot(targetInputs()) !== prepared.others
        || !originalsMatch()) fail('education_original_state_changed');
      const check = () => {
        safetyCheck();
        if (stable(plan) !== activePlan) fail('education_plan_changed');
        if (outsideSnapshot(targetInputs()) !== prepared.others
          || protectedProofSnapshot(readProof()) !== prepared.protectedProof) fail('other_values_changed');
        return true;
      };
      writeStarted = true;
      autosavePhase = 'trial';
      const product = await view.ResumeCmsEducationMulti.run(plan, {
        verifyBeforeWrite: check,
        checkOwner: (owner) => check() && stable(owner) === stable(plan.ownerBinding),
        checkSource: (index, hash) => check() && Number.isInteger(index) && index >= 0
          && index < plan.records.length && hash === plan.records[index].sourceSnapshotHash,
        readSerialization: async () => { await wait(READBACK_WAIT_MS); await settleCallbacks(); check(); return readProof(); },
        verifySerialization,
        ...(CONTROLS ? { adapters: Object.fromEntries(['school', 'select', 'date', 'region'].map((kind) => [kind,
          (field, fact, binding, context) => {
            const spec = FIELD_SPECS.find((item) => item.key === binding.key && item.kind === kind);
            if (!spec) fail('control_adapter_binding_invalid');
            return widgetAdapter(spec, field, fact, binding, context);
          }])) } : {})
      });
      result.productReason = /^[a-z0-9_]+$/u.test(product?.reason || '') ? product.reason : 'product_failed';
      if (CONTROLS && product?.ok !== true) fail(result.productReason);
      await wait(READBACK_WAIT_MS);
      await settleCallbacks();
      safetyCheck();
      const proof = readProof();
      const verified = verifySerialization(plan, product.bindings || [], proof);
      result.waitedMs = READBACK_WAIT_MS;
      result.readbacks = FIELD_SPECS.map((spec) => {
        const fields = product.fields?.filter((field) => field.profileIndex === ROW_INDEX && field.key === spec.key && field.path === spec.path) || [];
        const serialized = verified.records?.find((row) => row.profileIndex === ROW_INDEX)?.fields.filter((field) => field.key === spec.key) || [];
        const ok = product.ok === true && verified.ok === true && fields.length === 1 && fields[0].status === 'verified'
          && serialized.length === 1 && serialized[0].status === 'verified' && stable(domValue(spec)) === stable(desiredDom(spec));
        return { path: spec.path, ok, reason: ok ? 'readback_matched' : 'readback_mismatch', value: ok ? spec.fixture : null };
      });
      result.otherChanged = outsideSnapshot(targetInputs()) !== prepared.others
        || protectedProofSnapshot(proof) !== prepared.protectedProof;
      if (product.addClicks || product.saveClicks || product.deleteClicks || product.finalSubmitClicks) fail('click_not_allowed');
      if (result.otherChanged) fail('other_values_changed');
      if (!product.ok || result.readbacks.some((row) => !row.ok)) fail('readback_mismatch');
      result.ok = true;
      result.reason = null;
    } catch (error) { result.reason = safeReason(error); }
    finally {
      if (writeStarted) {
        try {
          const restored = await restore();
          result.restored = restored.ok;
          result.otherChanged ||= restored.otherChanged;
          result.pageLeftAsFound = restored.ok && !result.otherChanged;
        } catch { result.restored = false; result.pageLeftAsFound = false; }
        if (!result.restored) { result.ok = false; result.reason ||= 'restore_failed'; }
      } else result.pageLeftAsFound = true;
      if (autosaveAbortFailed) { result.ok = false; result.reason = 'autosave_abort_failed'; }
      if (clicks.length || posts.length) { result.ok = false; result.reason = clicks.length ? 'click_not_allowed' : 'non_get_request'; }
      result.timerSettle = timerSettle();
    }
    return result;
  }

  const api = {
    prepare,
    run(plan) {
      if (running) return Promise.resolve({ ok: false, reason: 'trial_already_run', liveSupportClaimed: false });
      running = execute(plan).finally(() => { settled = true; });
      return running;
    },
    posts: () => posts.slice(),
    suppressedAutosave: () => suppressedAutosave.slice(),
    suppressedLookup: () => suppressedLookup.slice(),
    timerSettle,
    widgetClickCount: () => widgetClickCount,
    clicks: () => clicks.slice(),
    async cleanup() {
      aborted = true;
      if (running && !settled) await running;
      // Reverify after callbacks drain. On failure leave the page guards in
      // place; the host must not claim the page was left as found.
      try {
        if (autosavePhase) {
          if (!(await restore()).ok) fail('restore_failed');
        } else await settleCallbacks();
        if (autosaveAbortFailed) fail('autosave_abort_failed');
      } catch (error) {
        return { ok: false, reason: safeReason(error), posts: posts.slice(), clicks: clicks.slice(),
          suppressedAutosave: suppressedAutosave.slice(), suppressedLookup: suppressedLookup.slice(), widgetClickCount, timerSettle: timerSettle() };
      }
      for (const remove of [...removers].reverse()) remove();
      for (const { key, descriptor } of previous) {
        if (descriptor) Object.defineProperty(view, key, descriptor);
        else delete view[key];
      }
      if (view.__cmsEducationLive === api) delete view.__cmsEducationLive;
      return { ok: true, posts: posts.slice(), clicks: clicks.slice(), suppressedAutosave: suppressedAutosave.slice(),
        suppressedLookup: suppressedLookup.slice(), widgetClickCount, timerSettle: timerSettle() };
    }
  };
  view.__cmsEducationLive = api;
  return { ok: true };
}

function plannedFields(reason = 'not_run', specs = FIELD_SPECS, controls = false) {
  return [
    ...specs.map((spec) => ({ q: spec.q, path: spec.path, status: 'failed', reason, value: null })),
    ...(controls ? [] : UNCLAIMED.map((q) => ({ q, status: 'skipped', reason: 'control_not_supported', value: null })))
  ];
}

export function evidenceExitCode(evidence) {
  const details = evidence?.finalDetails || {};
  if ((evidence?.nonGet || []).length || (evidence?.saveLikePost || []).length || details.clickCount > 0
    || details.reason === 'non_get_request' || details.reason === 'click_not_allowed' || details.reason === 'refusing_forbidden_click') return 3;
  if (['timeout', 'cdp_unreachable', 'cdp_endpoint_invalid', 'cdp_targets_invalid', 'interception_failed', 'network_guard_failed'].includes(details.reason)) return 1;
  if (!Number.isInteger(details.recordCount) || details.recordCount < 1 || details.recordCount > 30
    || !Number.isSafeInteger(details.rowIndex) || details.rowIndex < 0 || details.rowIndex >= details.recordCount) return 2;
  const controls = details.controls === true;
  const specs = fieldSpecsForRow(details.rowIndex, controls);
  const fields = evidence?.fields || [];
  const ok = evidence?.neverSave === true && evidence.liveSupportClaimed === false
    && Array.isArray(evidence.suppressedAutosave) && evidence.suppressedAutosave.every((row) => validSuppressedAutosave(row) && !row.abortFailed)
    && (controls ? Array.isArray(evidence.suppressedLookup) && evidence.suppressedLookup.every(validSuppressedLookup)
      && Number.isSafeInteger(details.widgetClickCount) && details.widgetClickCount >= 0
      : evidence.suppressedLookup === undefined || Array.isArray(evidence.suppressedLookup) && evidence.suppressedLookup.every(validSuppressedLookup))
    && details.liveSupportClaimed === false && details.moduleClaimedSupport === false
    && !details.reason && details.restored === true && details.pageLeftAsFound === true
    && details.cleanupOk === true && details.otherChanged === false
    && fields.length === (controls ? specs.length : FIELD_SPECS.length + UNCLAIMED.length)
    && specs.every((spec, index) => fields[index]?.q === spec.q && fields[index]?.path === spec.path
      && fields[index]?.status === 'verified' && fields[index]?.reason === 'readback_matched' && JSON.stringify(fields[index]?.value) === JSON.stringify(spec.fixture))
    && (controls || UNCLAIMED.every((q, index) => fields[index + FIELD_SPECS.length]?.q === q
      && fields[index + FIELD_SPECS.length]?.status === 'skipped'
      && fields[index + FIELD_SPECS.length]?.reason === 'control_not_supported'));
  return ok ? 0 : 2;
}

export async function runCmsEducationLive(options = {}) {
  const env = options.env || process.env;
  const port = options.port ?? readPort(env);
  const outDir = options.outDir || readOutDir(env);
  const stepTimeoutMs = options.stepTimeoutMs ?? readStepTimeout(env);
  const rowIndex = options.rowIndex ?? readRowIndex(env);
  const controls = options.controls ?? readControls(env);
  if (typeof controls !== 'boolean') throw new Error('CONTROLS must be 0 or 1');
  const specs = fieldSpecsForRow(rowIndex, controls);
  const root = options.repoRoot || repoRoot;
  const tipSha = options.tipSha || readTipSha(root);
  const filePath = path.join(outDir, EVIDENCE_NAME);
  const getJsonFn = options.getJson || getJson;
  const connectFn = options.connectCdp || connectCdp;
  const steps = [];
  const trafficRows = [];
  const decisions = new Set();
  let session = null;
  let reason = null;
  let outcome = null;
  let clicks = [];
  let suppressedAutosave = [];
  let suppressedLookup = [];
  let widgetClickCount = 0;
  let installed = false;
  let fetchEnabled = false;
  let cleanupOk = false;
  let timerSettle = null;
  let interceptionFailed = false;
  let href = null;
  let tabAction = 'none';
  let recordCount = null;
  const safeReason = (value, fallback) => typeof value === 'string' && /^[a-z0-9_]+$/u.test(value) ? value : fallback;
  const recordTraffic = (request, via) => {
    if (trafficRows.length < 160 && isNonGetMethod(request?.method)) trafficRows.push({ method: request?.method, url: request?.url, via });
  };
  const readSuppression = (rows) => {
    if (!Array.isArray(rows) || rows.length > 80 || !rows.every(validSuppressedAutosave)) throw new Error('autosave_guard_invalid');
    return rows.map(({ method, url, via, blockedBeforeSend, phase, abortFailed }) => ({
      method: method.toUpperCase(), url: new URL(url, CMS_BASELINE_PAGE).href, via, blockedBeforeSend, phase,
      ...(abortFailed ? { abortFailed: true } : {})
    }));
  };
  const readLookupSuppression = (rows) => {
    if (!Array.isArray(rows) || rows.length > 80 || !rows.every(validSuppressedLookup)) throw new Error('lookup_guard_invalid');
    return rows.map(({ method, url, via, blockedBeforeSend, phase }) => ({ method: method.toUpperCase(),
      url: new URL(url, CMS_BASELINE_PAGE).href, via, blockedBeforeSend, phase }));
  };
  const send = async (method, params, step) => {
    const reply = await session.send(method, params, { timeoutMs: stepTimeoutMs, step });
    steps.push(step);
    return reply;
  };
  const evaluate = async (expression, step, awaitPromise = false) => {
    const reply = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise }, step);
    if (reply?.exceptionDetails) throw Object.assign(new Error('eval_failed'), { reason: 'eval_failed' });
    return reply?.result?.value;
  };
  const stopIfTraffic = () => {
    if (interceptionFailed) throw Object.assign(new Error('interception_failed'), { reason: 'interception_failed' });
    if (trafficRows.length) throw Object.assign(new Error('non_get_request'), { reason: 'non_get_request' });
  };
  try {
    const targets = await getJsonFn(port, '/json/list', { timeoutMs: stepTimeoutMs, step: 'target_list' });
    steps.push('target_list');
    if (!Array.isArray(targets)) throw Object.assign(new Error('cdp_targets_invalid'), { reason: 'cdp_targets_invalid' });
    const selected = selectCmsResumeTarget(targets);
    if (selected.action !== 'attach') reason = selected.reason;
    else {
      if (!assertLoopback(selected.target.webSocketDebuggerUrl, port)) throw Object.assign(new Error('cdp_endpoint_invalid'), { reason: 'cdp_endpoint_invalid' });
      session = await connectFn(selected.target.webSocketDebuggerUrl, {
        timeoutMs: stepTimeoutMs, step: 'page_attach',
        onEvent(message) {
          if (message?.method === 'Network.requestWillBeSent') recordTraffic(message.params?.request, 'cdp');
          if (message?.method !== 'Fetch.requestPaused') return;
          const params = message.params || {};
          const blocked = isNonGetMethod(params.request?.method);
          if (blocked) recordTraffic(params.request, 'cdp_intercept');
          // connectCdp deliberately ignores event callback promises. Track each
          // decision so a rejected block/continue command cannot produce PASS.
          const pending = Promise.resolve().then(() => session.send(blocked ? 'Fetch.failRequest' : 'Fetch.continueRequest',
            blocked ? { requestId: params.requestId, errorReason: 'BlockedByClient' } : { requestId: params.requestId },
            { timeoutMs: stepTimeoutMs, step: blocked ? 'block_non_get' : 'continue_get' }))
            .catch(() => { interceptionFailed = true; }).finally(() => decisions.delete(pending));
          decisions.add(pending);
        }
      });
      tabAction = 'attached';
      steps.push('page_attach');
      // Both observers and interception are mandatory, before page mutations.
      try {
        await send('Network.enable', {}, 'network_enable');
        await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] }, 'fetch_enable');
        fetchEnabled = true;
      } catch (error) {
        if (isTimeout(error)) throw error;
        throw Object.assign(new Error('network_guard_failed'), { reason: 'network_guard_failed' });
      }
      await send('Runtime.enable', {}, 'runtime_enable');
      await send('Page.bringToFront', {}, 'page_bring_to_front');
      const guard = await evaluate(pageGuardExpression(), 'page_guard');
      href = classifyCmsTabUrl(guard?.href).ok ? CMS_BASELINE_PAGE : null;
      if (looksLikeLogin(guard)) reason = 'needs_login';
      else if (!classifyCmsTabUrl(guard?.href).ok) reason = 'wrong_page';
      else if (guard?.readyState !== 'complete') reason = 'page_not_ready';
      else if (guard?.visible !== 'visible') reason = 'page_hidden';
      stopIfTraffic();
      if (!reason) {
        const install = await evaluate(buildPageExpression(root, rowIndex, controls), 'install_live');
        installed = install?.ok === true;
        if (!installed) reason = safeReason(install?.reason, 'guard_install_failed');
      }
      if (!reason) {
        for (const file of [...LIVE_FILES, ...(controls ? CONTROL_FILES : [])]) {
          stopIfTraffic();
          const source = fs.readFileSync(path.join(root, file), 'utf8');
          const injected = await evaluate(`(() => { try { ${source}\n return {ok:true}; } catch { return {ok:false}; } })()`, `inject_${path.basename(file, '.js')}`);
          if (injected?.ok !== true) { reason = 'inject_failed'; break; }
        }
      }
      if (!reason) {
        stopIfTraffic();
        const prepared = await evaluate('globalThis.__cmsEducationLive.prepare()', 'education_prepare');
        recordCount = Number.isSafeInteger(prepared?.recordCount) && prepared.recordCount >= 0 ? prepared.recordCount : null;
        if (!prepared?.ok) reason = safeReason(prepared?.reason, 'control_not_supported');
        else if (prepared.rowIndex !== rowIndex || !Array.isArray(prepared.identities)
          || prepared.identities.length !== recordCount || prepared.identity !== prepared.identities[rowIndex]) reason = 'education_binding_changed';
        else {
          const plan = await createLivePlan(prepared.identities, rowIndex, controls);
          stopIfTraffic();
          outcome = await evaluate(`globalThis.__cmsEducationLive.run(${JSON.stringify(plan)})`, 'education_run', true);
          if (outcome?.ok !== true) reason = safeReason(outcome?.reason, 'control_not_supported');
        }
      }
    }
  } catch (error) {
    reason = isTimeout(error) ? 'timeout' : safeReason(error?.reason, session ? 'cdp_error' : 'cdp_unreachable');
  } finally {
    if (installed) {
      try {
        const posts = await evaluate('globalThis.__cmsEducationLive.posts()', 'read_posts');
        if (!Array.isArray(posts)) throw new Error('traffic_read_failed');
        trafficRows.push(...posts);
        suppressedAutosave = readSuppression(await evaluate('globalThis.__cmsEducationLive.suppressedAutosave()', 'read_suppressed_autosave'));
        if (controls) suppressedLookup = readLookupSuppression(await evaluate('globalThis.__cmsEducationLive.suppressedLookup()', 'read_suppressed_lookup'));
        const observed = await evaluate('globalThis.__cmsEducationLive.clicks()', 'read_clicks');
        if (!Array.isArray(observed)) throw new Error('click_read_failed');
        clicks = observed;
      } catch { reason ||= 'guard_read_failed'; }
      try {
        const cleanup = await evaluate('globalThis.__cmsEducationLive.cleanup()', 'cleanup', true);
        const timers = cleanup?.timerSettle;
        if (timers && ['pendingTimers', 'unobservableTimers', 'observedNonFunctionTimeouts']
          .every((key) => Number.isSafeInteger(timers[key]) && timers[key] >= 0)) {
          timerSettle = Object.fromEntries(['pendingTimers', 'unobservableTimers', 'observedNonFunctionTimeouts'].map((key) => [key, timers[key]]));
        }
        if (Array.isArray(cleanup?.posts)) trafficRows.push(...cleanup.posts);
        if (Array.isArray(cleanup?.clicks)) clicks = mergeObservations(clicks, cleanup.clicks);
        // Even unsuccessful cleanup can report late blocked attempts. Preserve
        // them without permitting them to excuse any observed network traffic.
        suppressedAutosave = mergeObservations(suppressedAutosave, readSuppression(cleanup?.suppressedAutosave));
        if (controls) {
          suppressedLookup = mergeObservations(suppressedLookup, readLookupSuppression(cleanup?.suppressedLookup));
          if (!Number.isSafeInteger(cleanup?.widgetClickCount) || cleanup.widgetClickCount < 0) throw new Error('click_read_failed');
          widgetClickCount = cleanup.widgetClickCount;
        }
        cleanupOk = cleanup?.ok === true && Array.isArray(cleanup.posts) && Array.isArray(cleanup.clicks)
          && !suppressedAutosave.some((row) => row.abortFailed);
        if (suppressedAutosave.some((row) => row.abortFailed)) reason ||= 'autosave_abort_failed';
        if (!cleanupOk) reason ||= safeReason(cleanup?.reason, 'cleanup_failed');
      } catch { reason ||= 'cleanup_failed'; }
    }
    // Never disable interception until page execution/restore has settled.
    await Promise.all([...decisions]);
    if (fetchEnabled && (!installed || cleanupOk)) {
      try { await send('Fetch.disable', {}, 'fetch_disable'); }
      catch { interceptionFailed = true; }
    }
    // A pause can arrive while Fetch.disable is awaiting its acknowledgement.
    while (decisions.size) await Promise.all([...decisions]);
    if (session) { try { session.close(); } catch { reason ||= 'cleanup_failed'; } }
  }

  const traffic = partitionTraffic(trafficRows);
  const clickDecision = decideClicks(clicks);
  if (!clickDecision.ok) reason = clickDecision.reason;
  else if (traffic.nonGet.length) reason = 'non_get_request';
  else if (interceptionFailed) reason = 'interception_failed';
  else if (suppressedAutosave.some((row) => row.abortFailed)) reason = 'autosave_abort_failed';
  const verified = !reason && cleanupOk && outcome?.ok === true && outcome.liveSupportClaimed === false
    && outcome.rowIndex === rowIndex && outcome.recordCount === recordCount
    && outcome.restored === true && outcome.pageLeftAsFound === true && outcome.otherChanged === false
    && outcome.waitedMs >= READBACK_WAIT_MS && specs.every((spec) => {
      const found = outcome.readbacks?.filter((row) => row.path === spec.path) || [];
      return found.length === 1 && found[0].ok === true && found[0].reason === 'readback_matched' && JSON.stringify(found[0].value) === JSON.stringify(spec.fixture);
    });
  if (!verified) reason ||= 'readback_mismatch';
  const fields = plannedFields(reason, specs, controls);
  if (verified) for (let index = 0; index < specs.length; index += 1) Object.assign(fields[index], {
    status: 'verified', reason: 'readback_matched', value: specs[index].fixture
  });
  const evidence = {
    tipSha, neverSave: true, liveSupportClaimed: false, fields, ...traffic, suppressedAutosave, suppressedLookup,
    finalDetails: {
      baseTip: BASE_TIP, port, rowIndex, recordCount, controls, href, tabAction, reason, steps,
      neverSave: true, liveSupportClaimed: false, moduleClaimedSupport: false,
      clickCount: clicks.length, widgetClickCount, bannedClick: clickDecision.banned === true,
      cleanupOk, restored: outcome?.restored === true,
      pageLeftAsFound: cleanupOk && outcome?.pageLeftAsFound === true,
      restoreVia: outcome ? controls ? 'product_adapters_and_native_events' : 'native_events' : null, otherChanged: outcome?.otherChanged === true,
      waitedMs: Number(outcome?.waitedMs) || 0, productReason: safeReason(outcome?.productReason, null), timerSettle,
      limits: [
        'Offline-tested fixture trial only. No live site support is claimed.',
        'ROW_INDEX selects one existing row by the shipped controller identity; all other rows are bound with no ready facts and must stay unchanged. Zero Add, Save, Submit, Next, Deliver, or Delete clicks.',
        controls ? 'CONTROLS=1 opens/closes seven captured widget surfaces and uses shipped adapters with replaceExisting:false to verify exact preexisting fixture values. Every widget original must equal its fixture before any writes. City probes the first province menu only; its second menu was not harvested. Changed-widget writes remain offline-only.'
          : `Only education.${rowIndex}.major and education.${rowIndex}.majorDescription are confirmed. No widget adapters are injected.`,
        'Trial writes use ResumeCmsEducationMulti.run and its native text writer; DOM and shipped React serialization proof must match.',
        'Cleanup restores text with native setters/events and re-verifies unchanged widget values without option/day replacement. Exact DOM, raw public props, DTO proof, and closed overlays must match before guards are removed. Original values and proof stay in the page.',
        'All form submissions and forbidden clicks are blocked. Controls mode permits only the active bound opener and evidenced outside-click cleanup; options, days, navigation, clear icons, and confirmations cannot be clicked. An opened select needs one linked owned menu; a date needs one owned calendar portal. Only exact education autosave and active-school fuzzyMatchDic XHRs opened after arming are aborted before native send, in separate suppression logs. No HTTP success response or catalog option is synthesized.',
        'Every other non-GET attempt, including HEAD/OPTIONS or any CDP-observed request, fails; CDP interception is mandatory and never allows non-GET transmission.',
        'Function timeouts drain under the guards. Non-function timeouts with numeric/default delays keep native execution and drain through a later native timer at the same delay; cancellation removes both tracking and observer. An uncleared interval, unresolved callback, or non-function timeout with an unobservable delay fails cleanup and retains page hooks. Timer diagnostics contain counts only. Original DOM and serialization are reverified before hooks are removed.',
        'This bounded trial does not prove absence of arbitrary future callbacks through previously captured APIs, workers, or later asynchronous responses.',
        'If CDP disconnects or times out, cleanup may be unverifiable. Evidence fails and does not claim the page was restored.'
      ],
      path: filePath
    }
  };
  evidence.finalDetails.exitCode = evidenceExitCode(evidence);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  return evidence;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.includes('--help') || process.argv.includes('-h')) process.stdout.write(HELP);
    else {
      const evidence = await runCmsEducationLive();
      process.stdout.write(`${JSON.stringify({ path: evidence.finalDetails.path, tipSha: evidence.tipSha,
        exitCode: evidence.finalDetails.exitCode, neverSave: true, liveSupportClaimed: false,
        fields: evidence.fields.map(({ q, status, reason }) => ({ q, status, reason })) })}\n`);
      process.exitCode = evidence.finalDetails.exitCode;
    }
  } catch {
    process.stderr.write('CMS education live runner failed; check PORT, OUTDIR, ROW_INDEX, CONTROLS, and STEP_TIMEOUT_MS.\n');
    process.exitCode = 1;
  }
}
