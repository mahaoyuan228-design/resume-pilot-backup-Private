#!/usr/bin/env node
/**
 * Never-save live trial for GTH 教育经历 plain fields.
 *
 * The full-resume harness opens a section only through `.title_ a.h-e-btn`
 * whose text is 编辑. On the 2026-10-22 run that control was missing
 * (`edit_not_found`), so no education field ran. The shipped writer in
 * src/content/gth-education.js does not use that title 编辑 link. For an
 * existing row it clicks the one visible `a` inside `.sec-context > .sec-detail`
 * that contains `.el-icon-edit-outline`. For a new row it clicks the one
 * visible `.title_ a.h-e-btn` whose text is 添加 or 新增. This runner does
 * not click either control itself. It calls ResumeGthEducationTextTrial.fullTrial,
 * which owns that open, then reads the editor and clicks only 取消.
 *
 * Confirmed facts are plain text and textarea only: 毕业学校, 专业名称,
 * 在校活动/职务, 在校成绩排名, 专业描述, 绩点, 学校所在地. 学历, 是否统招,
 * 在校时间, and 专业类别 are left empty, so the shipped trial records them
 * skipped and does not open their select, radio, month, or category widgets.
 * They stay control_not_supported in this evidence and are not claimed.
 * liveSupportClaimed stays false.
 *
 * Windows PowerShell, from the repo root, with the resume tab already open:
 *
 *   $env:PORT='9239'; $env:OUTDIR='C:/Users/admin/Desktop/ResumeQuickFill-Dev/_temp-scripts'; node scripts/live/gth-education-live.mjs
 *
 * PORT defaults to 9239. OUTDIR defaults to the current directory. The JSON
 * evidence file is gth-education-live.json. Any non-GET fails the run. This
 * script stays out of extension packs and does not claim the live site is
 * supported.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { connectCdp, getJson } from '../../tools/live-harvest/cdp-client.mjs';
import { isTimeout } from '../../tools/live-harvest/errors.mjs';
import {
  EDIT_PAGE,
  assertLoopback,
  looksLikeLogin,
  pageGuardExpression,
  redactUrl,
  selectResumeTarget
} from '../probe-gth-intent.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const BASE_TIP = 'a2c9a06';
export const DEFAULT_PORT = 9239;
export const EVIDENCE_NAME = 'gth-education-live.json';
export const EDUCATION_INDEX = 1;
export const SECTION_TITLES = Object.freeze([
  '基本信息', '教育经历', '求职意向', '工作经验', '职业技能与特长', '附件简历', '其他信息'
]);
export const LIVE_FILES = Object.freeze([
  'src/content/gth-education.js'
]);
export const RUNTIME_FILES = Object.freeze([
  'scripts/live/gth-education-live.mjs',
  'scripts/probe-gth-intent.mjs',
  'scripts/gth-option-reader.mjs',
  'tools/live-harvest/cdp-client.mjs',
  'tools/live-harvest/errors.mjs',
  'src/content/gth-education.js'
]);
export const PLAIN_FIELDS = Object.freeze([
  ['毕业学校', 'school', '复旦大学'],
  ['专业名称', 'major', '金融学'],
  ['在校活动/职务', 'campusActivities', '学生会学习部干事'],
  ['在校成绩排名', 'gradeRank', '5/42'],
  ['专业描述', 'majorDescription', '主修公司金融与财务报表分析。'],
  ['绩点', 'gpa', '3.70'],
  ['学校所在地', 'schoolLocation', '上海']
]);
export const UNCLAIMED = Object.freeze(['学历', '是否统招', '在校时间', '专业类别']);
export const FILL_QUESTIONS = Object.freeze(PLAIN_FIELDS.map(([question]) => question));
export const PLANNED = Object.freeze([
  ...FILL_QUESTIONS.map((question) => ({ q: question, fill: true })),
  ...UNCLAIMED.map((question) => ({ q: question, fill: false }))
]);
export const LIVE_BINDING = Object.freeze({
  version: 1,
  epoch: '00000000-0000-4000-8000-0000000000ae',
  profileHash: 'ae'.repeat(32)
});
const ANSWERS = Object.freeze(Object.fromEntries(PLAIN_FIELDS.map(([question, , answer]) => [question, answer])));
const KEYS = Object.freeze(Object.fromEntries(PLAIN_FIELDS.map(([question, key]) => [question, key])));

export const HELP = `Usage (Windows PowerShell, repo root):
  $env:PORT='9239'; $env:OUTDIR='C:/Users/admin/Desktop/ResumeQuickFill-Dev/_temp-scripts'; node scripts/live/gth-education-live.mjs

Never-save CDP trial of GTH 教育经历 plain fields.
Attaches to an existing hr.gtht.com resume edit tab. Does not log in, does not
navigate, and does not claim the live site is supported.

  PORT                 Loopback CDP port. Default ${DEFAULT_PORT}
  OUTDIR               Directory for ${EVIDENCE_NAME}. Default current directory
  STEP_TIMEOUT_MS      Per CDP call timeout. Default 30000
  TARGET_MODE          existing (default) or new.
                       existing calls the shipped row edit icon.
                       new calls the shipped title 添加 or 新增 link.
  ROW_INDEX            Existing row, 0-29. Default 0. Ignored for new.
  FIELDS               Comma list of plain fields to fill.
                       Default ${FILL_QUESTIONS.join(',')}.
                       学历, 是否统招, 在校时间, and 专业类别 are not accepted.
`;

export function readPort(env = process.env) {
  const raw = env.PORT == null || env.PORT === '' ? String(DEFAULT_PORT) : String(env.PORT);
  if (!/^\d+$/u.test(raw)) throw new Error('bad port');
  const port = Number(raw);
  if (port < 1 || port > 65535) throw new Error('bad port');
  return port;
}

export function readOutDir(env = process.env, cwd = process.cwd()) {
  const raw = env.OUTDIR == null || env.OUTDIR === '' ? cwd : String(env.OUTDIR);
  return path.resolve(cwd, raw);
}

export function readStepTimeout(env = process.env) {
  const raw = env.STEP_TIMEOUT_MS == null || env.STEP_TIMEOUT_MS === '' ? '30000' : String(env.STEP_TIMEOUT_MS);
  if (!/^\d+$/u.test(raw)) throw new Error('bad step-timeout');
  const ms = Number(raw);
  if (ms < 1000 || ms > 120000) throw new Error('bad step-timeout');
  return ms;
}

export function readTargetMode(env = process.env) {
  const raw = env.TARGET_MODE == null || String(env.TARGET_MODE).trim() === ''
    ? 'existing'
    : String(env.TARGET_MODE).trim();
  if (raw !== 'existing' && raw !== 'new') throw new Error('bad target-mode');
  return raw;
}

export function readRowIndex(env = process.env) {
  const raw = env.ROW_INDEX == null || String(env.ROW_INDEX).trim() === '' ? '0' : String(env.ROW_INDEX).trim();
  if (!/^\d+$/u.test(raw)) throw new Error('bad row-index');
  const index = Number(raw);
  if (index < 0 || index > 29) throw new Error('bad row-index');
  return index;
}

export function readFillFields(env = process.env) {
  const raw = env.FIELDS;
  if (raw == null || String(raw).trim() === '') return [...FILL_QUESTIONS];
  const parts = String(raw).split(',').map((item) => item.trim()).filter(Boolean);
  const allowed = new Set(FILL_QUESTIONS);
  if (!parts.length || parts.some((item) => !allowed.has(item))) throw new Error('bad fields');
  return FILL_QUESTIONS.filter((question) => parts.includes(question));
}

export function readTipSha(root = repoRoot) {
  try {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    if (/^[0-9a-f]{7,64}$/iu.test(sha)) return sha;
  } catch {
    /* evidence still names the base tip */
  }
  return BASE_TIP;
}

export function expectedReadback() {
  return { ...ANSWERS };
}

export function liveFillRequest(env = process.env) {
  const targetMode = readTargetMode(env);
  const questions = readFillFields(env);
  const candidate = {
    profileIndex: 0,
    confirmedPaths: questions.map((question) => `education.0.${KEYS[question]}`)
  };
  for (const question of questions) candidate[KEYS[question]] = ANSWERS[question];
  const request = {
    requestId: 'live-education-0001',
    targetMode,
    profileIndex: 0,
    replaceExisting: true,
    profileBinding: LIVE_BINDING,
    educationCandidates: [candidate]
  };
  if (targetMode === 'existing') request.rowIndex = readRowIndex(env);
  return request;
}

export function isNonGetMethod(method) {
  const verb = String(method || '').toUpperCase();
  return verb !== '' && verb !== 'GET' && verb !== 'HEAD' && verb !== 'OPTIONS';
}

export function isDisallowedNonGet(method) {
  return isNonGetMethod(method);
}

export function partitionTraffic(rows) {
  const nonGet = [];
  const saveLikePost = [];
  const seen = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    const method = String(row?.method || '').toUpperCase();
    if (!isNonGetMethod(method)) continue;
    const url = redactUrl(row?.url);
    const via = String(row?.via || 'unknown').slice(0, 40);
    const key = `${method} ${url} ${via}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const item = { method, url, via };
    nonGet.push(item);
    saveLikePost.push(item);
  }
  return { nonGet: nonGet.slice(0, 80), saveLikePost: saveLikePost.slice(0, 40) };
}

export function decideCancel(snapshot) {
  const halt = (detail) => ({ action: 'stop', reason: 'control_not_supported', detail });
  const text = String(snapshot?.cancelText || '');
  const banned = ['保存', '提交', '投递', '删除', '确定'];
  if (banned.some((word) => text.includes(word))) return halt('cancel_banned');
  if (snapshot?.cancelCount !== 1 || text !== '取消') {
    return halt(snapshot?.cancelCount ? 'cancel_not_unique' : 'cancel_not_found');
  }
  if (snapshot.cancelType !== 'button') return halt('cancel_not_button');
  return { action: 'click_cancel' };
}

export function clicksAreDiscardOnly(clicks) {
  const list = Array.isArray(clicks) ? clicks : [];
  return list.every((click) => click?.allowed !== false
    && ['编辑', '取消', '添加', '新增'].includes(click?.label));
}

export function plannedFieldRows(reason) {
  return PLANNED.map((item) => ({
    q: item.q,
    status: 'failed',
    reason,
    value: null
  }));
}

export function buildFieldRows({ questions, fillQuestions, fillFields, readback, expected, trialReason } = {}) {
  const fills = Array.isArray(fillFields) ? fillFields : [];
  const reads = Array.isArray(readback) ? readback : [];
  const want = Array.isArray(questions) ? questions : PLANNED.map((item) => item.q);
  const fillSet = new Set(Array.isArray(fillQuestions) ? fillQuestions : FILL_QUESTIONS);
  const unclaimed = new Set(UNCLAIMED);
  return want.map((q) => {
    if (unclaimed.has(q) || !fillSet.has(q) && !PLAIN_FIELDS.some(([question]) => question === q)) {
      return { q, status: 'failed', reason: 'control_not_supported', value: null };
    }
    const read = reads.find((row) => row?.q === q);
    const value = read && typeof read.value === 'string' ? read.value : null;
    if (!fillSet.has(q)) {
      return typeof value === 'string' && read?.reason !== 'control_not_supported'
        ? { q, status: 'verified', reason: 'read_only', value }
        : { q, status: 'failed', reason: 'control_not_supported', value: null };
    }
    const fill = fills.find((row) => row?.question === q);
    if (!fill || fill.status !== 'verified') {
      return {
        q,
        status: 'failed',
        reason: fill?.reason || trialReason || 'control_not_supported',
        value
      };
    }
    const expect = expected?.[q];
    if (!read || read.reason === 'control_not_supported') {
      return { q, status: 'failed', reason: 'control_not_supported', value };
    }
    if (typeof expect === 'string' && value !== expect) {
      return { q, status: 'failed', reason: 'readback_mismatch', value };
    }
    return { q, status: 'verified', reason: fill.reason || 'readback_matched', value };
  });
}

export function buildEvidence({ tipSha, fields, saveLikePost, finalDetails } = {}) {
  const details = {
    ...(finalDetails && typeof finalDetails === 'object' ? finalDetails : {}),
    neverSave: true,
    liveSupportClaimed: false
  };
  return {
    tipSha: typeof tipSha === 'string' ? tipSha : '',
    neverSave: true,
    liveSupportClaimed: false,
    fields: Array.isArray(fields) ? fields.map((row) => ({
      q: typeof row?.q === 'string' ? row.q : '',
      status: row?.status || 'failed',
      reason: row?.reason || 'control_not_supported',
      value: typeof row?.value === 'string' ? row.value : null
    })) : [],
    saveLikePost: Array.isArray(saveLikePost) ? saveLikePost : [],
    finalDetails: details
  };
}

export function plainFieldsVerified(fields) {
  const rows = Array.isArray(fields) ? fields : [];
  return FILL_QUESTIONS.every((question) => rows.find((row) => row.q === question)?.status === 'verified');
}

export function unclaimedStayUnclaimed(fields) {
  const rows = Array.isArray(fields) ? fields : [];
  return UNCLAIMED.every((question) => {
    const row = rows.find((item) => item.q === question);
    return row && row.status !== 'verified' && row.reason === 'control_not_supported';
  });
}

export function evidenceExitCode(evidence) {
  const details = evidence?.finalDetails || {};
  const reason = details.reason;
  if (['cdp_unreachable', 'timeout', 'cdp_endpoint_invalid', 'cdp_targets_invalid'].includes(reason)) return 1;
  if (reason === 'refusing_forbidden_click' || details.bannedClick === true) return 3;
  if (Array.isArray(evidence?.saveLikePost) && evidence.saveLikePost.length > 0) return 3;
  const fields = Array.isArray(evidence?.fields) ? evidence.fields : [];
  const fillQuestions = Array.isArray(details.fillQuestions) ? details.fillQuestions : FILL_QUESTIONS;
  const filledOk = fillQuestions.every((question) => fields.find((row) => row.q === question)?.status === 'verified');
  const otherPlainOk = FILL_QUESTIONS.filter((question) => !fillQuestions.includes(question))
    .every((question) => fields.find((row) => row.q === question)?.status === 'verified');
  const plannedOk = filledOk && otherPlainOk && unclaimedStayUnclaimed(fields)
    && details.cancelsOk === true
    && details.moduleClaimedSupport !== true;
  return plannedOk ? 0 : 2;
}

export function buildPageExpression() {
  return [
    '(() => {',
    `const redactUrl = ${redactUrl.toString()};`,
    `const decideCancel = ${decideCancel.toString()};`,
    `const installGthEducationLive = ${installGthEducationLive.toString()};`,
    `return installGthEducationLive(globalThis.document, ${JSON.stringify({ titles: SECTION_TITLES, pageUrl: EDIT_PAGE, sectionIndex: EDUCATION_INDEX })});`,
    '})()'
  ].join('\n');
}

function installGthEducationLive(doc, options) {
  const view = doc.defaultView;
  const titles = options.titles;
  const pageUrl = options.pageUrl;
  const sectionIndex = options.sectionIndex;
  const posts = [];
  const clicks = [];
  const norm = (value) => String(value ?? '').replace(/[\s\u00a0]+/gu, ' ').trim();
  const banned = ['保存', '提交', '投递', '删除', '确定'];
  function visible(node) {
    if (!node || node.nodeType !== 1 || !node.isConnected) return false;
    let cur = node;
    while (cur && cur.nodeType === 1) {
      if (cur.hasAttribute('hidden')) return false;
      const style = view.getComputedStyle(cur);
      if (!style || style.display === 'none' || style.visibility === 'hidden') return false;
      cur = cur.parentElement;
    }
    return !!node.getClientRects().length;
  }
  function hrefSafe(node) {
    if (!node || node.tagName !== 'A') return false;
    const href = node.getAttribute('href');
    if (href == null) return true;
    const text = href.trim();
    if (text === '' || text === '#') return true;
    return /^javascript:(?:;|void\(0\))$/iu.test(text);
  }
  function classify(node) {
    const text = norm(node?.textContent);
    const denied = (label) => ({ type: 'click', label: (label || text || 'empty').slice(0, 40), allowed: false });
    if (!node || node.nodeType !== 1) return denied('empty');
    if (banned.some((word) => text.includes(word))) return denied(text);
    if (node.tagName === 'BUTTON' && String(node.type || '').toLowerCase() === 'button'
      && text === '取消' && !node.disabled && !node.hasAttribute('formaction')) {
      return { type: 'click', label: '取消', allowed: true };
    }
    const iconEdit = node.tagName === 'A' && node.querySelector('.el-icon-edit-outline') && (text === '' || text === '编辑');
    const addLink = node.tagName === 'A' && node.matches('a.h-e-btn') && node.closest('.title_')
      && (text === '添加' || text === '新增');
    if ((iconEdit || addLink) && hrefSafe(node)) {
      return { type: 'click', label: text || '编辑', allowed: true };
    }
    return denied(text);
  }

  function note(method, url, via) {
    const verb = String(method || 'GET').toUpperCase();
    if (!verb || verb === 'GET' || verb === 'HEAD' || verb === 'OPTIONS') return true;
    if (posts.length < 80) posts.push({ via, method: verb, url: redactUrl(url) });
    return false;
  }
  function blockedRequest() {
    const error = new Error('disallowed_non_get');
    error.reason = 'disallowed_non_get';
    return error;
  }
  function installTap() {
    const originalFetch = view.fetch;
    const xhr = view.XMLHttpRequest;
    const originalOpen = xhr?.prototype?.open;
    const originalSend = xhr?.prototype?.send;
    const originalBeacon = view.navigator?.sendBeacon;
    const originalClick = view.HTMLElement?.prototype?.click;
    const formPrototype = view.HTMLFormElement?.prototype;
    const originalSubmit = formPrototype?.submit;
    const originalRequestSubmit = formPrototype?.requestSubmit;
    if (typeof originalFetch === 'function') {
      view.fetch = function fetchTap(input, init, ...rest) {
        const method = String((init && init.method) || (typeof input === 'object' && input ? input.method : '') || 'GET').toUpperCase();
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        if (!note(method, url, 'fetch')) return Promise.reject(blockedRequest());
        return originalFetch.call(this, input, init, ...rest);
      };
    }
    if (originalOpen && originalSend) {
      xhr.prototype.open = function openTap(method, url, ...rest) {
        this.__gthEducationLive = { method: String(method || 'GET').toUpperCase(), url: String(url || '') };
        return originalOpen.call(this, method, url, ...rest);
      };
      xhr.prototype.send = function sendTap(...rest) {
        if (this.__gthEducationLive && !note(this.__gthEducationLive.method, this.__gthEducationLive.url, 'xhr')) {
          throw blockedRequest();
        }
        return originalSend.call(this, ...rest);
      };
    }
    if (typeof originalBeacon === 'function' && view.navigator) {
      view.navigator.sendBeacon = function beaconTap(url, ...rest) {
        if (!note('POST', url, 'beacon')) return false;
        return originalBeacon.call(this, url, ...rest);
      };
    }
    function guardClick(node) {
      const decision = classify(node);
      if (clicks.length < 80) clicks.push(decision);
      if (!decision.allowed) {
        const error = new Error('refusing_forbidden_click');
        error.reason = 'refusing_forbidden_click';
        throw error;
      }
    }
    if (typeof originalClick === 'function') {
      view.HTMLElement.prototype.click = function clickTap(...rest) {
        guardClick(this);
        return originalClick.call(this, ...rest);
      };
    }
    function blockSubmit(event) {
      const form = event?.target && event.target.tagName === 'FORM' ? event.target : this;
      note(form?.method || 'GET', form?.action || '', 'submit');
      if (event?.preventDefault) event.preventDefault();
      if (event?.stopImmediatePropagation) event.stopImmediatePropagation();
      throw blockedRequest();
    }
    if (formPrototype) {
      formPrototype.submit = function submitTap() { return blockSubmit.call(this); };
      if (originalRequestSubmit) formPrototype.requestSubmit = function requestSubmitTap() { return blockSubmit.call(this); };
    }
    doc.addEventListener('submit', blockSubmit, true);
    return function removeTap() {
      if (typeof originalFetch === 'function') view.fetch = originalFetch;
      if (originalOpen) xhr.prototype.open = originalOpen;
      if (originalSend) xhr.prototype.send = originalSend;
      if (typeof originalBeacon === 'function' && view.navigator) view.navigator.sendBeacon = originalBeacon;
      if (typeof originalClick === 'function') view.HTMLElement.prototype.click = originalClick;
      if (formPrototype) {
        if (originalSubmit) formPrototype.submit = originalSubmit;
        if (originalRequestSubmit) formPrototype.requestSubmit = originalRequestSubmit;
      }
      doc.removeEventListener('submit', blockSubmit, true);
    };
  }
  const removeTap = installTap();

  function sections() {
    return [...doc.querySelectorAll('.r-section')];
  }
  function titleOf(section) {
    const node = section.querySelector('.title_')?.cloneNode(true);
    node?.querySelectorAll('a,button').forEach((child) => child.remove());
    return norm(node?.textContent);
  }
  function pageState() {
    let href = '';
    try { href = String(view.location.href || ''); } catch { href = ''; }
    const list = sections();
    return {
      href,
      hrefOk: href === pageUrl,
      readyState: doc.readyState,
      visible: doc.visibilityState === 'visible',
      titlesOk: JSON.stringify(list.map(titleOf)) === JSON.stringify(titles),
      list
    };
  }
  function educationSection() {
    const page = pageState();
    if (!page.hrefOk || page.readyState !== 'complete' || !page.visible || !page.titlesOk) return { page, section: null };
    return { page, section: page.list[sectionIndex] || null };
  }
  function inspect() {
    const found = educationSection();
    const section = found.section;
    if (!section) {
      return { ok: false, reason: found.page.hrefOk ? 'section_structure_changed' : 'wrong_page', titleEditCount: 0, addCount: 0, rowCount: 0, rowIconCounts: [] };
    }
    const titleLinks = [...section.querySelectorAll('.title_ a.h-e-btn')];
    const rows = [...section.querySelectorAll('.sec-context > .sec-detail')];
    return {
      ok: true,
      reason: null,
      titleEditCount: titleLinks.filter((node) => visible(node) && norm(node.textContent) === '编辑').length,
      addCount: titleLinks.filter((node) => visible(node) && (norm(node.textContent) === '添加' || norm(node.textContent) === '新增')).length,
      rowCount: rows.length,
      rowIconCounts: rows.map((row) => [...row.querySelectorAll('a')].filter((node) => visible(node) && node.querySelector('.el-icon-edit-outline')).length)
    };
  }
  function formsInSection() {
    const section = educationSection().section;
    return section ? [...section.querySelectorAll('form')] : [];
  }
  function editorForm() {
    const forms = formsInSection();
    if (forms.length !== 1) {
      return { ok: false, reason: 'control_not_supported', detail: forms.length ? 'editor_not_unique' : 'editor_not_open', form: null };
    }
    return { ok: true, form: forms[0] };
  }
  function read(questions) {
    const found = editorForm();
    const wanted = Array.isArray(questions) ? questions : [];
    if (!found.ok) {
      return {
        ok: false,
        reason: found.reason,
        detail: found.detail,
        readback: wanted.map((q) => ({ q, value: null, reason: 'control_not_supported' })),
        extraLabels: [],
        unlabeled: 0
      };
    }
    const form = found.form;
    const items = [...form.querySelectorAll('.el-form-item')].filter((item) => item.closest('form') === form);
    const labeled = [];
    let unlabeled = 0;
    for (const item of items) {
      const labels = [...item.querySelectorAll('.el-form-item__label')].filter((node) => node.closest('.el-form-item') === item);
      if (labels.length !== 1) {
        unlabeled += 1;
        continue;
      }
      labeled.push({ item, q: norm(labels[0].textContent) });
    }
    const readback = wanted.map((q) => {
      const matches = labeled.filter((row) => row.q === q);
      if (matches.length !== 1) return { q, value: null, reason: 'control_not_supported' };
      const controls = [...matches[0].item.querySelectorAll('input,textarea')].filter((node) => {
        return node.closest('.el-form-item') === matches[0].item && visible(node);
      });
      if (controls.length !== 1) return { q, value: null, reason: 'control_not_supported' };
      return { q, value: String(controls[0].value ?? ''), reason: null };
    });
    const known = new Set(wanted);
    const extraLabels = labeled.map((row) => row.q).filter((q) => q && !known.has(q));
    return { ok: true, readback, extraLabels, unlabeled };
  }
  async function waitFor(readWait, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    do {
      const found = readWait();
      if (found) return found;
      await new Promise((resolve) => view.setTimeout(resolve, 60));
    } while (Date.now() < deadline);
    return null;
  }
  async function cancel() {
    const forms = formsInSection();
    if (forms.length === 0) return { ok: true, closed: true, alreadyClosed: true, reason: null };
    const found = editorForm();
    if (!found.ok) return { ok: false, closed: false, reason: 'control_not_supported', detail: found.detail || 'editor_not_open' };
    const form = found.form;
    const buttons = [...form.querySelectorAll('button')].filter((node) => visible(node) && norm(node.textContent) === '取消');
    const decision = decideCancel({
      cancelCount: buttons.length,
      cancelText: buttons.length === 1 ? norm(buttons[0].textContent) : '',
      cancelType: buttons.length === 1 ? String(buttons[0].type || '').toLowerCase() : ''
    });
    if (decision.action !== 'click_cancel') return { ok: false, closed: false, ...decision };
    buttons[0].click();
    const gone = await waitFor(() => (!form.isConnected || !visible(form) ? true : null), 2000);
    return gone
      ? { ok: true, closed: true, reason: null }
      : { ok: false, closed: false, reason: 'editor_still_open' };
  }

  const api = {
    inspect,
    read,
    cancel,
    posts: () => posts.slice(),
    clicks: () => clicks.slice(),
    restore: () => {
      try { removeTap(); } catch { /* leave the hooks if restore throws */ }
    }
  };
  view.__gthEducationLive = api;
  return { ok: true };
}

function chromeShimExpression() {
  return `(() => {
    const existing = globalThis.chrome;
    if (existing && existing.runtime && existing.runtime.onMessage && existing.runtime.onMessage.addListener && existing.runtime.id && existing.runtime.sendMessage) {
      return { ok: true, installed: false, preexisting: true };
    }
    const listeners = new Set();
    const runtime = {
      id: 'gth-education-live-shim',
      getManifest() {
        return { background: { service_worker: 'src/background/worker.mjs' } };
      },
      sendMessage(message) {
        if (message && message.type === 'RESUME_PROFILE_BINDING_CHECK') return Promise.resolve({ allowed: true });
        return Promise.resolve({ allowed: false });
      },
      onMessage: {
        addListener(listener) { listeners.add(listener); },
        removeListener(listener) { listeners.delete(listener); }
      }
    };
    const host = existing && typeof existing === 'object' ? existing : {};
    host.runtime = runtime;
    globalThis.chrome = host;
    return { ok: true, installed: true, preexisting: false };
  })()`;
}

function injectExpression(source, rel) {
  return `(() => {
    try {
      ${source}
      return { ok: true, file: ${JSON.stringify(rel)} };
    } catch (error) {
      return { ok: false, file: ${JSON.stringify(rel)}, error: String(error && (error.stack || error.message) || error).slice(0, 500) };
    }
  })()`;
}

function publicFill(fill) {
  if (!fill || typeof fill !== 'object') return null;
  return {
    ok: fill.ok === true,
    reason: typeof fill.reason === 'string' ? fill.reason : null,
    writeStarted: fill.writeStarted === true,
    editorLeftOpen: fill.editorLeftOpen === true,
    addClickCount: Number.isInteger(fill.addClickCount) ? fill.addClickCount : 0,
    targetMode: fill.targetMode === 'new' ? 'new' : fill.targetMode === 'existing' ? 'existing' : null,
    liveSupportClaimed: fill.liveSupportClaimed === true,
    softwareClickedSave: fill.softwareClickedSave === true,
    softwareClickedSubmit: fill.softwareClickedSubmit === true,
    softwareClickedDelete: fill.softwareClickedDelete === true,
    fields: Array.isArray(fill.fields) ? fill.fields.map((row) => ({
      question: row?.question || '',
      status: row?.status || '',
      reason: row?.reason || ''
    })) : []
  };
}

async function evaluate(session, expression, { timeoutMs, step, awaitPromise = false }) {
  const reply = await session.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise
  }, { timeoutMs, step });
  if (reply?.exceptionDetails) {
    const text = reply.exceptionDetails.exception?.description || reply.exceptionDetails.text || 'eval_failed';
    const error = new Error(String(text).slice(0, 300));
    error.reason = 'eval_failed';
    error.step = step;
    throw error;
  }
  return reply?.result?.value;
}

function connectFailure(error) {
  if (isTimeout(error) || error?.reason === 'timeout') return 'timeout';
  if (error?.reason === 'cdp_endpoint_invalid' || error?.reason === 'cdp_targets_invalid') return error.reason;
  return 'cdp_unreachable';
}

export async function runGthEducationLive(options = {}) {
  const env = options.env || process.env;
  const port = options.port ?? readPort(env);
  const outDir = options.outDir || readOutDir(env);
  const stepTimeoutMs = options.stepTimeoutMs ?? readStepTimeout(env);
  const tipSha = options.tipSha || readTipSha(options.repoRoot || repoRoot);
  const getJsonFn = options.getJson || getJson;
  const connectFn = options.connectCdp || connectCdp;
  const filePath = path.join(outDir, EVIDENCE_NAME);
  const fillQuestions = readFillFields(env);
  const request = liveFillRequest(env);
  const steps = [];
  const cdpPosts = [];
  const sessions = [];
  let reason = null;
  let href = null;
  let tabAction = 'none';
  let fatalDetail = null;
  let inspect = null;
  let fill = null;
  let read = null;
  let cancel = null;
  let clicks = [];
  let pagePosts = [];
  let moduleClaimedSupport = false;
  let bannedClick = false;
  let cancelsOk = false;

  async function finishSession(session) {
    if (!session) return;
    try {
      await evaluate(session, 'globalThis.__gthEducationLive && globalThis.__gthEducationLive.restore()', {
        timeoutMs: stepTimeoutMs,
        step: 'restore_hooks'
      });
      steps.push('restore_hooks');
    } catch {
      steps.push('restore_hooks_failed');
    }
  }

  try {
    let targets;
    try {
      targets = await getJsonFn(port, '/json/list', { timeoutMs: stepTimeoutMs, step: 'target_list' });
      steps.push('target_list');
    } catch (error) {
      if (isTimeout(error)) throw error;
      const failure = new Error('cdp_unreachable');
      failure.reason = 'cdp_unreachable';
      throw failure;
    }
    if (!Array.isArray(targets)) {
      const failure = new Error('cdp_targets_invalid');
      failure.reason = 'cdp_targets_invalid';
      throw failure;
    }
    const selected = selectResumeTarget(targets, 'hr.gtht.com/resume/edit');
    if (selected.action !== 'attach') {
      reason = selected.reason || 'tab_not_found';
      fatalDetail = reason;
    } else {
      const target = selected.target;
      if (!target?.webSocketDebuggerUrl || !assertLoopback(target.webSocketDebuggerUrl, port)) {
        const failure = new Error('cdp_endpoint_invalid');
        failure.reason = 'cdp_endpoint_invalid';
        throw failure;
      }
      tabAction = 'attached';
      const session = await connectFn(target.webSocketDebuggerUrl, {
        timeoutMs: stepTimeoutMs,
        step: 'page_attach',
        onEvent(msg) {
          if (msg?.method !== 'Network.requestWillBeSent') return;
          const req = msg.params?.request;
          if (!req || !isNonGetMethod(req.method)) return;
          cdpPosts.push({ via: 'cdp', method: req.method, url: req.url });
        }
      });
      sessions.push(session);
      steps.push('page_attach');
      try {
        await session.send('Page.setWebLifecycleState', { state: 'active' }, { timeoutMs: stepTimeoutMs, step: 'page_lifecycle_active' });
        steps.push('page_lifecycle_active');
      } catch {
        steps.push('page_lifecycle_skipped');
      }
      try {
        await session.send('Page.bringToFront', {}, { timeoutMs: stepTimeoutMs, step: 'page_bring_to_front' });
        steps.push('page_bring_to_front');
      } catch {
        steps.push('page_bring_to_front_skipped');
      }
      try {
        await session.send('Network.enable', {}, { timeoutMs: stepTimeoutMs, step: 'network_enable' });
        steps.push('network_enable');
      } catch {
        steps.push('network_enable_skipped');
      }
      await session.send('Runtime.enable', {}, { timeoutMs: stepTimeoutMs, step: 'runtime_enable' });
      steps.push('runtime_enable');
      await delay(200);
      const guard = await evaluate(session, pageGuardExpression(), { timeoutMs: stepTimeoutMs, step: 'page_guard' });
      steps.push('page_guard');
      href = typeof guard?.href === 'string' ? redactUrl(guard.href) : null;
      if (looksLikeLogin(guard)) {
        reason = 'needs_login';
        fatalDetail = 'needs_login';
      } else {
        const shim = await evaluate(session, chromeShimExpression(), { timeoutMs: stepTimeoutMs, step: 'chrome_shim' });
        steps.push('chrome_shim');
        if (!shim?.ok) {
          reason = 'inject_failed';
          fatalDetail = 'chrome_shim';
        } else {
          const installed = await evaluate(session, buildPageExpression(), {
            timeoutMs: stepTimeoutMs,
            step: 'install_live',
            awaitPromise: true
          });
          steps.push('install_live');
          if (!installed?.ok) {
            reason = 'inject_failed';
            fatalDetail = 'install_live';
          } else {
            for (const rel of LIVE_FILES) {
              const source = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
              const step = `inject_${rel.split('/').pop().replace(/\.js$/u, '')}`;
              const injected = await evaluate(session, injectExpression(source, rel), { timeoutMs: stepTimeoutMs, step });
              steps.push(step);
              if (!injected?.ok) {
                reason = 'inject_failed';
                fatalDetail = injected?.error || rel;
                break;
              }
            }
          }
        }
        if (!reason) {
          const check = await evaluate(session, `({
            fullTrial: typeof globalThis.ResumeGthEducationTextTrial?.fullTrial === 'function'
          })`, { timeoutMs: stepTimeoutMs, step: 'inject_check' });
          steps.push('inject_check');
          if (!check?.fullTrial) {
            reason = 'inject_failed';
            fatalDetail = 'globals_missing';
          }
        }
        if (!reason) {
          try {
            inspect = await evaluate(session, 'globalThis.__gthEducationLive.inspect()', {
              timeoutMs: stepTimeoutMs,
              step: 'inspect_education'
            });
            steps.push('inspect_education');
          } catch (error) {
            inspect = { ok: false, reason: error?.reason || 'eval_failed' };
            steps.push('inspect_education_failed');
          }
          try {
            fill = await evaluate(
              session,
              `globalThis.ResumeGthEducationTextTrial.fullTrial(${JSON.stringify(request)})`,
              { timeoutMs: stepTimeoutMs, step: 'fill_education', awaitPromise: true }
            );
            steps.push('fill_education');
          } catch (error) {
            fill = {
              ok: false,
              reason: error?.reason || 'eval_failed',
              fields: [],
              writeStarted: false,
              editorLeftOpen: true,
              liveSupportClaimed: false,
              softwareClickedSave: false,
              softwareClickedSubmit: false,
              softwareClickedDelete: false
            };
            steps.push('fill_education_failed');
          }
          if (fill?.liveSupportClaimed === true) moduleClaimedSupport = true;
          if (fill?.softwareClickedSave === true || fill?.softwareClickedSubmit === true || fill?.softwareClickedDelete === true) {
            bannedClick = true;
          }
          try {
            read = await evaluate(
              session,
              `globalThis.__gthEducationLive.read(${JSON.stringify(PLANNED.map((item) => item.q))})`,
              { timeoutMs: stepTimeoutMs, step: 'read_education', awaitPromise: true }
            );
            steps.push('read_education');
          } catch (error) {
            read = {
              ok: false,
              reason: error?.reason || 'eval_failed',
              readback: PLANNED.map((item) => ({ q: item.q, value: null, reason: 'control_not_supported' })),
              extraLabels: []
            };
            steps.push('read_education_failed');
          }
          try {
            cancel = await evaluate(session, 'globalThis.__gthEducationLive.cancel()', {
              timeoutMs: stepTimeoutMs,
              step: 'cancel_education',
              awaitPromise: true
            });
            steps.push('cancel_education');
          } catch (error) {
            cancel = { ok: false, closed: false, reason: error?.reason || 'eval_failed' };
            steps.push('cancel_education_failed');
          }
          try {
            pagePosts = await evaluate(session, 'globalThis.__gthEducationLive.posts()', {
              timeoutMs: stepTimeoutMs,
              step: 'read_posts'
            });
            steps.push('read_posts');
          } catch {
            pagePosts = [];
            steps.push('read_posts_failed');
          }
          try {
            clicks = await evaluate(session, 'globalThis.__gthEducationLive.clicks()', {
              timeoutMs: stepTimeoutMs,
              step: 'read_clicks'
            });
            steps.push('read_clicks');
          } catch {
            clicks = [];
            steps.push('read_clicks_failed');
          }
        }
      }
      await finishSession(session);
    }
  } catch (error) {
    reason = reason || connectFailure(error);
    fatalDetail = fatalDetail || String(error?.message || error).slice(0, 300);
    if (reason === 'timeout') fatalDetail = 'timeout';
  } finally {
    for (const session of sessions) {
      try { session.close(); } catch { /* already closed */ }
    }
  }

  const fields = reason && !fill
    ? plannedFieldRows(reason)
    : buildFieldRows({
      questions: PLANNED.map((item) => item.q),
      fillQuestions,
      fillFields: fill?.fields,
      readback: read?.readback,
      expected: expectedReadback(),
      trialReason: fill?.reason || reason
    });
  const traffic = partitionTraffic([...(Array.isArray(pagePosts) ? pagePosts : []), ...cdpPosts]);
  if (!clicksAreDiscardOnly(clicks)) bannedClick = true;
  cancelsOk = cancel?.closed === true && clicksAreDiscardOnly(clicks);
  const plainMiss = fields.find((row) => FILL_QUESTIONS.includes(row.q) && row.status !== 'verified');
  if (bannedClick) reason = 'refusing_forbidden_click';
  else if (traffic.saveLikePost.length && !reason) reason = 'disallowed_non_get';
  else if (!reason && plainMiss) reason = plainMiss.reason || 'control_not_supported';
  else if (!reason && !unclaimedStayUnclaimed(fields)) reason = 'control_not_supported';
  else if (!reason && !cancelsOk) reason = 'cancel_not_confirmed';

  const evidence = buildEvidence({
    tipSha,
    fields,
    saveLikePost: traffic.saveLikePost,
    finalDetails: {
      baseTip: BASE_TIP,
      port,
      href,
      tabAction,
      reason,
      fatalDetail,
      steps,
      clicks: Array.isArray(clicks) ? clicks : [],
      nonGet: traffic.nonGet,
      cancelsOk,
      bannedClick,
      moduleClaimedSupport,
      request,
      readbackExpected: Object.fromEntries(fillQuestions.map((question) => [question, ANSWERS[question]])),
      inspect,
      fill: publicFill(fill),
      read: read ? {
        ok: read.ok === true,
        reason: read.reason || null,
        extraLabels: read.extraLabels || [],
        unlabeled: read.unlabeled || 0
      } : null,
      cancel,
      unfilled: fields.filter((row) => row.status !== 'verified').map((row) => ({ q: row.q, reason: row.reason })),
      fillQuestions,
      limits: [
        'Open belongs to ResumeGthEducationTextTrial.fullTrial in src/content/gth-education.js. Existing mode clicks the one visible a inside .sec-context > .sec-detail that contains .el-icon-edit-outline. New mode clicks the one visible .title_ a.h-e-btn whose text is 添加 or 新增. This runner does not click a title link whose text is 编辑. That missing title 编辑 is why the full-resume harness stopped at edit_not_found.',
        'Confirmed facts are plain text only. 学历, 是否统招, 在校时间, and 专业类别 are omitted, reported control_not_supported, and not claimed. The shipped trial skips an empty fact and does not open that select, radio, month picker, or category cascader.',
        'The page hook allows only that product edit or add click and a type=button 取消. 保存, 提交, 投递, 删除, and 确定 are refused before the click.',
        'Any non-GET is blocked and fails the run. There is no dictionary allowlist.',
        '取消 is the one visible button whose type is button and whose text is 取消 inside the education form. The runner clicks it after the trial and does not click 保存.',
        'The shipped fill compares location.href with https://hr.gtht.com/resume/edit/ exactly. A hash or query is wrong_page.',
        'liveSupportClaimed stays false. A writer and a never-save trial are not a claim the live site is supported.'
      ],
      path: filePath
    }
  });
  evidence.finalDetails.exitCode = evidenceExitCode(evidence);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  return evidence;
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
  try {
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      process.stdout.write(HELP);
      process.exit(0);
    }
    const evidence = await runGthEducationLive();
    const summary = {
      path: evidence.finalDetails.path,
      exitCode: evidence.finalDetails.exitCode,
      tipSha: evidence.tipSha,
      neverSave: evidence.neverSave,
      liveSupportClaimed: evidence.liveSupportClaimed,
      saveLikePost: evidence.saveLikePost.length,
      fields: evidence.fields.map((row) => ({ q: row.q, status: row.status, reason: row.reason }))
    };
    process.stdout.write(`${evidence.finalDetails.path}\n${JSON.stringify(summary)}\n`);
    process.exit(evidence.finalDetails.exitCode);
  } catch (error) {
    process.stderr.write(`${error?.message || error}\n`);
    process.exit(1);
  }
}
