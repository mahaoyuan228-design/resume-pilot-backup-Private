#!/usr/bin/env node
/**
 * Never-Save trial of the existing 招商 CMS education text writer.
 * Run from the repository root with an already-open Edge resume tab:
 *   $env:PORT='9239'; $env:OUTDIR=Join-Path ([Environment]::GetFolderPath('Desktop')) 'ResumeQuickFill-Dev\_temp-scripts'; node scripts/live/cms-education-live.mjs
 *
 * ROW_INDEX (default 0) selects one existing education row. No Add, edit, select, date,
 * Save, Submit, or Apply control is clicked. The shipped record controller
 * writes 专业名称 / 专业描述; the shipped public-props reader and verifier
 * check React serialization. Other education fields stay unsupported.
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
export const BASE_TIP = '947e318e42c8f3b3dcb52111848989d3280ce0bc';
export const DEFAULT_PORT = 9239;
export const EVIDENCE_NAME = 'cms-education-live.json';
export const READBACK_WAIT_MS = 500;
export const POWERSHELL = "$env:PORT='9239'; $env:OUTDIR=Join-Path ([Environment]::GetFolderPath('Desktop')) 'ResumeQuickFill-Dev\\_temp-scripts'; node scripts/live/cms-education-live.mjs";
export const FIELD_SPECS = Object.freeze([
  Object.freeze({ key: 'major', q: '专业名称', path: 'education.0.major', fixture: '金融学' }),
  Object.freeze({ key: 'description', q: '专业描述', path: 'education.0.majorDescription', fixture: '主修公司金融与财务报表分析。' })
]);
export const UNCLAIMED = Object.freeze(['学校', '学历', '学位', '开始时间', '结束时间', '城市', '专业排名']);
export const LIVE_FILES = Object.freeze(['src/content/cms-session.js', 'src/content/cms-record-controller.js', 'src/content/cms-education-multi.js']);
export const HELP = `Usage (Windows PowerShell, repository root):
  ${POWERSHELL}

Never-Save trial. Attach to the already-open baseline 招商 CMS resume tab using Edge CDP.
Select one existing education row with ROW_INDEX; 专业名称 and 专业描述 only.
All other rows are bound with no ready facts and must remain unchanged.
Supports 1–30 existing rows (the shipped planner's limit); never adds rows.
No navigation, login, Add, clicks, 保存/提交/投递, or non-GET requests.
Close menus first and leave the tab alone during the trial. Originals are
restored and verified. liveSupportClaimed remains false; no live-site claim.

  PORT              Loopback CDP port. Default 9239
  OUTDIR            Evidence directory. Default current directory
  ROW_INDEX         Zero-based existing row in controller/DOM order. Default 0
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

export function fieldSpecsForRow(rowIndex = 0) {
  if (!Number.isSafeInteger(rowIndex) || rowIndex < 0) throw new Error('education_row_index_invalid');
  return FIELD_SPECS.map((spec) => ({ ...spec, path: spec.path.replace('education.0.', `education.${rowIndex}.`) }));
}

export function isNonGetMethod(method) {
  return String(method ?? '').toUpperCase() !== 'GET';
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

export function fixtureProfile(rowIndex = 0, recordCount = rowIndex + 1) {
  const specs = fieldSpecsForRow(rowIndex);
  if (!Number.isInteger(recordCount) || recordCount < 1 || recordCount > 30) throw new Error('education_row_count_not_supported');
  if (rowIndex >= recordCount) throw new Error('education_row_index_out_of_range');
  return {
    education: Array.from({ length: recordCount }, (_unused, index) => index === rowIndex
      ? { major: specs[0].fixture, majorDescription: specs[1].fixture } : {}),
    confirmedFields: specs.map((spec) => spec.path)
  };
}

export async function createLivePlan(identityOrIdentities, rowIndex = 0) {
  const identities = Array.isArray(identityOrIdentities) ? identityOrIdentities : [identityOrIdentities];
  const profile = fixtureProfile(rowIndex, identities.length);
  const binding = await ownerBindingFor(profile, '00000000-0000-4000-8000-0000000000ed');
  // The shipped writer/verifier require every existing row to be bound. Empty
  // source rows produce only skipped facts: no applicant values leave the page,
  // and only the selected row is authorized for text writes/replacement.
  const requests = await Promise.all(identities.map(async (identity, profileIndex) => ({
    profileIndex, sourceSnapshotHash: (await sourceSnapshot(profile, profileIndex)).hash,
    target: { mode: 'existing', identity }, replaceExisting: profileIndex === rowIndex
  })));
  return createPlan(profile, requests, [], binding);
}

// Copy the shipped read-only serialization module into this evaluation's
// closure. No selectors, React handlers, or write adapters are invented here.
export function buildPageExpression(root = repoRoot, rowIndex = 0) {
  const serialization = fs.readFileSync(path.join(root, 'src/content/cms-education-serialization.mjs'), 'utf8')
    .replace(/^export /gmu, '');
  return `(() => {
    ${serialization}
    const FIELD_SPECS = ${JSON.stringify(fieldSpecsForRow(rowIndex))};
    const ROW_INDEX = ${rowIndex};
    const READBACK_WAIT_MS = ${READBACK_WAIT_MS};
    const isNonGetMethod = ${isNonGetMethod.toString()};
    const redactUrl = ${redactUrl.toString()};
    return (${installEducationTrial.toString()})(globalThis, ${JSON.stringify(CMS_BASELINE_PAGE)},
      readCmsEducationSerialization, verifyEducationSerialization);
  })()`;
}

function installEducationTrial(view, page, readSerialization, verifySerialization) {
  const doc = view.document;
  if (view.__cmsEducationLive || view.ResumeProfileWriteContext) return { ok: false, reason: 'profile_write_context_busy' };
  const previous = ['ResumeCmsSession', 'installResumeCmsRecordController', 'ResumeCmsEducationMulti'].map((key) => ({
    key, descriptor: Object.getOwnPropertyDescriptor(view, key)
  }));
  if (previous.some(({ descriptor }) => descriptor && !descriptor.configurable)) return { ok: false, reason: 'product_globals_not_replaceable' };
  const removers = [];
  const posts = [];
  const clicks = [];
  let prepared = null;
  let running = null;
  let settled = false;
  let aborted = false;
  let activePlan = null;
  const stable = (value) => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
  const wait = (ms) => new Promise((resolve) => view.setTimeout(resolve, ms));
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
  const onClick = (event) => { event.preventDefault(); event.stopImmediatePropagation(); clickNote(event.target); };
  const onSubmit = (event) => { event.preventDefault(); event.stopImmediatePropagation(); clickNote(event.target, 'submit'); };
  try {
    patch(view.HTMLElement.prototype, 'click', function () { clickNote(this); });
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
      const open = xhr.open, send = xhr.send;
      patch(xhr, 'open', function (method, url, ...rest) {
        metadata.set(this, { method, url });
        return open.call(this, method, url, ...rest);
      });
      patch(xhr, 'send', function (...args) {
        const request = metadata.get(this);
        // Unknown requests may have been opened before the guard was installed.
        if (!request || isNonGetMethod(request.method)) {
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
    return stable([...doc.querySelectorAll('input,textarea,select,.ant-select-selection-selected-value,.ant-select-selection-item')]
      .filter((node) => !skip.has(node)).map((node) => [node.tagName, node.type || '', node.value ?? node.textContent ?? '', !!node.checked, node.selectedIndex ?? null]));
  }
  function boundState() {
    const state = view.ResumeCmsEducationMulti.inspect();
    if (!state.ok || !sameRecordSet(state.records)) fail('education_binding_changed');
    return state;
  }
  function locate(spec, state = boundState()) {
    const field = view.ResumeCmsEducationMulti.locateField(state.form, prepared.identity, spec.q);
    const input = field?.input;
    if (field?.kind !== 'text' || !input || input.disabled || input.readOnly
      || !(input instanceof view.HTMLTextAreaElement || input instanceof view.HTMLInputElement && input.type === 'text')
      || input.closest('.ant-select,.ant-calendar-picker,.ant-picker,.el-date-editor,.el-select,.el-cascader,.cascader-wrap,.cascader-plugins-wrap')) fail('control_not_supported');
    return input;
  }
  function targetInputs() {
    const state = boundState();
    return FIELD_SPECS.map((spec) => locate(spec, state));
  }
  function prepare() {
    let recordCount = null;
    try {
      if (prepared) fail('trial_already_prepared');
      safetyCheck();
      if (view.ResumeProfileWriteContext) fail('profile_write_context_busy');
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
        const input = locate(spec);
        const fields = proof.rows[ROW_INDEX].fields.filter((field) => field.question === spec.q);
        const field = fields[0];
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
    pageCheck();
    if (prepared.originals.every(({ spec, value }) => locate(spec).value === value)
      && proofSnapshot(readProof()) === prepared.proof
      && outsideSnapshot(targetInputs()) === prepared.others) {
      return { ok: true, via: 'not_needed', otherChanged: false };
    }
    let changed = false;
    for (const original of prepared.originals) {
      pageCheck();
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
    pageCheck();
    const domMatch = prepared.originals.every(({ spec, value }) => locate(spec).value === value);
    const propsMatch = proofSnapshot(readProof()) === prepared.proof;
    changed = outsideSnapshot(targetInputs()) !== prepared.others
      || protectedProofSnapshot(readProof()) !== prepared.protectedProof;
    return { ok: domMatch && propsMatch && !changed, via: 'native_events', otherChanged: changed };
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
          || record.facts[spec.key].value !== spec.fixture || record.facts[spec.key].path !== spec.path)) fail('education_trial_plan_invalid');
      const digest = await view.crypto.subtle.digest('SHA-256', new view.TextEncoder().encode(stable({ ...plan, fingerprint: undefined })));
      const fingerprint = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
      if (fingerprint !== plan.fingerprint) fail('education_plan_changed');
      activePlan = stable(plan);
      if (proofSnapshot(readProof()) !== prepared.proof || outsideSnapshot(targetInputs()) !== prepared.others
        || prepared.originals.some(({ spec, value }) => locate(spec).value !== value)) fail('education_original_state_changed');
      const check = () => {
        safetyCheck();
        if (stable(plan) !== activePlan) fail('education_plan_changed');
        if (outsideSnapshot(targetInputs()) !== prepared.others
          || protectedProofSnapshot(readProof()) !== prepared.protectedProof) fail('other_values_changed');
        return true;
      };
      writeStarted = true;
      const product = await view.ResumeCmsEducationMulti.run(plan, {
        verifyBeforeWrite: check,
        checkOwner: (owner) => check() && stable(owner) === stable(plan.ownerBinding),
        checkSource: (index, hash) => check() && Number.isInteger(index) && index >= 0
          && index < plan.records.length && hash === plan.records[index].sourceSnapshotHash,
        readSerialization: async () => { await wait(READBACK_WAIT_MS); check(); return readProof(); },
        verifySerialization
        // No school/select/date/region adapters: they cannot be clicked.
      });
      result.productReason = /^[a-z0-9_]+$/u.test(product?.reason || '') ? product.reason : 'product_failed';
      await wait(READBACK_WAIT_MS);
      safetyCheck();
      const proof = readProof();
      const verified = verifySerialization(plan, product.bindings || [], proof);
      result.waitedMs = READBACK_WAIT_MS;
      result.readbacks = FIELD_SPECS.map((spec) => {
        const fields = product.fields?.filter((field) => field.profileIndex === ROW_INDEX && field.key === spec.key && field.path === spec.path) || [];
        const serialized = verified.records?.find((row) => row.profileIndex === ROW_INDEX)?.fields.filter((field) => field.key === spec.key) || [];
        const ok = product.ok === true && verified.ok === true && fields.length === 1 && fields[0].status === 'verified'
          && serialized.length === 1 && serialized[0].status === 'verified' && locate(spec).value === spec.fixture;
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
      if (clicks.length || posts.length) { result.ok = false; result.reason = clicks.length ? 'click_not_allowed' : 'non_get_request'; }
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
    clicks: () => clicks.slice(),
    async cleanup() {
      aborted = true;
      if (running && !settled) await running;
      for (const remove of [...removers].reverse()) remove();
      for (const { key, descriptor } of previous) {
        if (descriptor) Object.defineProperty(view, key, descriptor);
        else delete view[key];
      }
      if (view.__cmsEducationLive === api) delete view.__cmsEducationLive;
      return { ok: true, posts: posts.slice(), clicks: clicks.slice() };
    }
  };
  view.__cmsEducationLive = api;
  return { ok: true };
}

function plannedFields(reason = 'not_run', specs = FIELD_SPECS) {
  return [
    ...specs.map((spec) => ({ q: spec.q, path: spec.path, status: 'failed', reason, value: null })),
    ...UNCLAIMED.map((q) => ({ q, status: 'skipped', reason: 'control_not_supported', value: null }))
  ];
}

export function evidenceExitCode(evidence) {
  const details = evidence?.finalDetails || {};
  if ((evidence?.nonGet || []).length || (evidence?.saveLikePost || []).length || details.clickCount > 0
    || details.reason === 'non_get_request' || details.reason === 'click_not_allowed' || details.reason === 'refusing_forbidden_click') return 3;
  if (['timeout', 'cdp_unreachable', 'cdp_endpoint_invalid', 'cdp_targets_invalid', 'interception_failed', 'network_guard_failed'].includes(details.reason)) return 1;
  if (!Number.isInteger(details.recordCount) || details.recordCount < 1 || details.recordCount > 30
    || !Number.isSafeInteger(details.rowIndex) || details.rowIndex < 0 || details.rowIndex >= details.recordCount) return 2;
  const specs = fieldSpecsForRow(details.rowIndex);
  const fields = evidence?.fields || [];
  const ok = evidence?.neverSave === true && evidence.liveSupportClaimed === false
    && details.liveSupportClaimed === false && details.moduleClaimedSupport === false
    && !details.reason && details.restored === true && details.pageLeftAsFound === true
    && details.cleanupOk === true && details.otherChanged === false
    && fields.length === FIELD_SPECS.length + UNCLAIMED.length
    && specs.every((spec, index) => fields[index]?.q === spec.q && fields[index]?.path === spec.path
      && fields[index]?.status === 'verified' && fields[index]?.reason === 'readback_matched' && fields[index]?.value === spec.fixture)
    && UNCLAIMED.every((q, index) => fields[index + FIELD_SPECS.length]?.q === q
      && fields[index + FIELD_SPECS.length]?.status === 'skipped'
      && fields[index + FIELD_SPECS.length]?.reason === 'control_not_supported');
  return ok ? 0 : 2;
}

export async function runCmsEducationLive(options = {}) {
  const env = options.env || process.env;
  const port = options.port ?? readPort(env);
  const outDir = options.outDir || readOutDir(env);
  const stepTimeoutMs = options.stepTimeoutMs ?? readStepTimeout(env);
  const rowIndex = options.rowIndex ?? readRowIndex(env);
  const specs = fieldSpecsForRow(rowIndex);
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
  let installed = false;
  let fetchEnabled = false;
  let cleanupOk = false;
  let interceptionFailed = false;
  let href = null;
  let tabAction = 'none';
  let recordCount = null;
  const safeReason = (value, fallback) => typeof value === 'string' && /^[a-z0-9_]+$/u.test(value) ? value : fallback;
  const recordTraffic = (request, via) => {
    if (trafficRows.length < 160 && isNonGetMethod(request?.method)) trafficRows.push({ method: request?.method, url: request?.url, via });
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
        const install = await evaluate(buildPageExpression(root, rowIndex), 'install_live');
        installed = install?.ok === true;
        if (!installed) reason = safeReason(install?.reason, 'guard_install_failed');
      }
      if (!reason) {
        for (const file of LIVE_FILES) {
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
          const plan = await createLivePlan(prepared.identities, rowIndex);
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
        const observed = await evaluate('globalThis.__cmsEducationLive.clicks()', 'read_clicks');
        if (!Array.isArray(observed)) throw new Error('click_read_failed');
        clicks = observed;
      } catch { reason ||= 'guard_read_failed'; }
      try {
        const cleanup = await evaluate('globalThis.__cmsEducationLive.cleanup()', 'cleanup', true);
        cleanupOk = cleanup?.ok === true && Array.isArray(cleanup.posts) && Array.isArray(cleanup.clicks);
        if (cleanupOk) {
          trafficRows.push(...cleanup.posts);
          // Never discard a click already observed in an earlier reply.
          const merged = new Map();
          for (const log of [clicks, cleanup.clicks]) {
            const counts = new Map();
            for (const row of log) { const key = JSON.stringify(row); counts.set(key, (counts.get(key) || 0) + 1); }
            for (const [key, count] of counts) merged.set(key, Math.max(count, merged.get(key) || 0));
          }
          clicks = [...merged].flatMap(([key, count]) => Array.from({ length: count }, () => JSON.parse(key)));
        }
        else reason ||= 'cleanup_failed';
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
  const verified = !reason && cleanupOk && outcome?.ok === true && outcome.liveSupportClaimed === false
    && outcome.rowIndex === rowIndex && outcome.recordCount === recordCount
    && outcome.restored === true && outcome.pageLeftAsFound === true && outcome.otherChanged === false
    && outcome.waitedMs >= READBACK_WAIT_MS && specs.every((spec) => {
      const found = outcome.readbacks?.filter((row) => row.path === spec.path) || [];
      return found.length === 1 && found[0].ok === true && found[0].reason === 'readback_matched' && found[0].value === spec.fixture;
    });
  if (!verified) reason ||= 'readback_mismatch';
  const fields = plannedFields(reason, specs);
  if (verified) for (let index = 0; index < specs.length; index += 1) Object.assign(fields[index], {
    status: 'verified', reason: 'readback_matched', value: specs[index].fixture
  });
  const evidence = {
    tipSha, neverSave: true, liveSupportClaimed: false, fields, ...traffic,
    finalDetails: {
      baseTip: BASE_TIP, port, rowIndex, recordCount, href, tabAction, reason, steps,
      neverSave: true, liveSupportClaimed: false, moduleClaimedSupport: false,
      clickCount: clicks.length, bannedClick: clickDecision.banned === true,
      cleanupOk, restored: outcome?.restored === true, pageLeftAsFound: outcome?.pageLeftAsFound === true,
      restoreVia: outcome ? 'native_events' : null, otherChanged: outcome?.otherChanged === true,
      waitedMs: Number(outcome?.waitedMs) || 0, productReason: safeReason(outcome?.productReason, null),
      limits: [
        'Offline-tested fixture trial only. No live site support is claimed.',
        'ROW_INDEX selects one existing row by the shipped controller identity; all other rows are bound with no ready facts and must stay unchanged. Zero Add or widget clicks.',
        `Only education.${rowIndex}.major and education.${rowIndex}.majorDescription are confirmed. No widget adapters are injected.`,
        'Trial writes use ResumeCmsEducationMulti.run and its native text writer; DOM and shipped React serialization proof must match.',
        'Cleanup uses native setters, input/change, and real focus/blur to preserve exact original text, including empty strings. Original values and proof stay in the page.',
        'All clicks and form submissions are blocked. Every non-GET, including HEAD/OPTIONS, fails; CDP interception is mandatory.',
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
    process.stderr.write('CMS education live runner failed; check PORT, OUTDIR, ROW_INDEX, and STEP_TIMEOUT_MS.\n');
    process.exitCode = 1;
  }
}
