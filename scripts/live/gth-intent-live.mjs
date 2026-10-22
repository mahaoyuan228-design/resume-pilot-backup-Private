#!/usr/bin/env node
/**
 * Never-save live trial for GTH 求职意向.
 *
 * Connects to an already-open Edge CDP port, finds the hr.gtht.com resume
 * edit tab, injects the shipped writer (src/content/gth-intent.js), opens the
 * 求职意向 editor with the shipped `.title_ a.h-e-btn` 编辑 control, waits
 * until that form contains .el-form-item, fills three confirmed fixtures
 * through ResumeGthIntent.trial, reads every intent field back, then clicks
 * only that form's 取消 button. It never clicks 保存 / 提交 / 投递 / 删除 / 确定.
 *
 * The shipped writer still owns the fill. omitAbsent leaves 期望从事职位类别,
 * 现从事行业, 现从事职位类别, and 现薪资 untouched when this profile has no
 * answer for them. Those four are read back only.
 *
 * trial() fills every answered field and throws on the first picker_* abort,
 * leaving later answers not_run. There is no fields filter on that call.
 * omitAbsent plus one confirmed answer is the per-field call, so this runner
 * issues one trial per FIELDS entry. 期望薪资 and 到岗日期 still run when the
 * cascader aborts. A picker abort's pickerDiag is copied into the evidence.
 * That diag only reads the cascader panel. It does not click outside it and
 * it never clicks 保存.
 *
 * Windows PowerShell, from the repo root, with the resume tab already open:
 *
 *   $env:PORT='9239'; $env:OUTDIR='C:/Users/admin/Desktop/ResumeQuickFill-Dev/_temp-scripts'; node scripts/live/gth-intent-live.mjs
 *
 * PORT defaults to 9239. OUTDIR defaults to the current directory. The JSON
 * evidence file is gth-intent-live.json. liveSupportClaimed stays false.
 * This script stays out of extension packs and does not claim the live site
 * is supported.
 *
 * The only non-GET the run allows is the editor's salary-unit lookup,
 * https://hr.gtht.com/interface/js/type/getsalaryunit.json (query stripped).
 * Any other non-GET fails the run. That lookup was observed when the editor
 * opened on 2026-10-22, with no save.
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

export const BASE_TIP = 'a178ada';
export const DEFAULT_PORT = 9239;
export const EVIDENCE_NAME = 'gth-intent-live.json';
export const SALARY_UNIT_LOOKUP = 'https://hr.gtht.com/interface/js/type/getsalaryunit.json';
export const SECTION_TITLES = Object.freeze([
  '基本信息', '教育经历', '求职意向', '工作经验', '职业技能与特长', '附件简历', '其他信息'
]);
export const LIVE_FILES = Object.freeze([
  'src/content/gth-intent.js'
]);
export const RUNTIME_FILES = Object.freeze([
  'scripts/live/gth-intent-live.mjs',
  'scripts/probe-gth-intent.mjs',
  'scripts/gth-option-reader.mjs',
  'tools/live-harvest/cdp-client.mjs',
  'tools/live-harvest/errors.mjs',
  'src/content/gth-intent.js'
]);
export const REGION_PATH = '北京||大兴区';
// 2026-10-22 ~18:50 UTC+8: the chip and the input are L1+L2 joined.
export const REGION_READBACK = '北京大兴区';
export const SALARY_ANSWER = '15000';
export const ARRIVAL_ANSWER = '一个月内';
export const PLANNED = Object.freeze([
  { q: '期望工作地区', fill: true },
  { q: '期望从事职位类别', fill: false },
  { q: '期望薪资', fill: true },
  { q: '到岗日期', fill: true },
  { q: '现从事行业', fill: false },
  { q: '现从事职位类别', fill: false },
  { q: '现薪资', fill: false }
]);
export const FILL_QUESTIONS = Object.freeze(PLANNED.filter((item) => item.fill).map((item) => item.q));
export const READ_QUESTIONS = Object.freeze(PLANNED.filter((item) => !item.fill).map((item) => item.q));
export const LIVE_BINDING = Object.freeze({
  version: 1,
  epoch: '00000000-0000-4000-8000-0000000000ad',
  profileHash: 'ad'.repeat(32)
});
export const LIVE_SECTIONS = Object.freeze([
  {
    id: 'intent',
    section: '求职意向',
    sectionIndex: 2,
    globalName: 'ResumeGthIntent',
    questions: Object.freeze(PLANNED.map((item) => item.q))
  }
]);

export const HELP = `Usage (Windows PowerShell, repo root):
  $env:PORT='9239'; $env:OUTDIR='C:/Users/admin/Desktop/ResumeQuickFill-Dev/_temp-scripts'; node scripts/live/gth-intent-live.mjs

Never-save CDP trial of GTH 求职意向.
Attaches to an existing hr.gtht.com resume edit tab. Does not log in, does not
navigate, and does not claim the live site is supported.

  PORT                 Loopback CDP port. Default ${DEFAULT_PORT}
  OUTDIR               Directory for ${EVIDENCE_NAME}. Default current directory
  STEP_TIMEOUT_MS      Per CDP call timeout. Default 30000
  FIELDS               Comma list of fixture fields to fill.
                       Default 期望工作地区,期望薪资,到岗日期.
                       Only those three names are accepted.
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

export function confirmedCustomProfile(section, answers) {
  const questions = Object.keys(answers);
  return {
    customAnswers: { ...answers },
    confirmedFields: questions.map((question) => `customAnswers.${question}`),
    customFacts: questions.map((question) => ({
      question,
      answer: answers[question],
      sitePageUrl: EDIT_PAGE,
      sectionName: section,
      rowContext: 'none'
    }))
  };
}

export function fixedLiveProfile() {
  return confirmedCustomProfile('求职意向', {
    期望工作地区: REGION_PATH,
    期望薪资: SALARY_ANSWER,
    到岗日期: ARRIVAL_ANSWER
  });
}

export function expectedReadback() {
  return {
    期望工作地区: REGION_READBACK,
    期望薪资: SALARY_ANSWER,
    到岗日期: ARRIVAL_ANSWER
  };
}

const FIXTURE_ANSWERS = Object.freeze({
  期望工作地区: REGION_PATH,
  期望薪资: SALARY_ANSWER,
  到岗日期: ARRIVAL_ANSWER
});

export function readFillFields(env = process.env) {
  const raw = env.FIELDS;
  if (raw == null || String(raw).trim() === '') return [...FILL_QUESTIONS];
  const parts = String(raw).split(',').map((item) => item.trim()).filter(Boolean);
  const allowed = new Set(FILL_QUESTIONS);
  if (!parts.length || parts.some((item) => !allowed.has(item))) throw new Error('bad fields');
  return FILL_QUESTIONS.filter((question) => parts.includes(question));
}

export function liveProfileFor(questions) {
  const answers = {};
  for (const question of questions) {
    if (!Object.prototype.hasOwnProperty.call(FIXTURE_ANSWERS, question)) throw new Error('bad fields');
    answers[question] = FIXTURE_ANSWERS[question];
  }
  return confirmedCustomProfile('求职意向', answers);
}

export function liveFillRequest() {
  return {
    requestId: 'live-intent-0001',
    profileBinding: LIVE_BINDING,
    replaceExisting: true,
    omitAbsent: true,
    profile: fixedLiveProfile()
  };
}

export function liveFillRequestFor(question, index = 0) {
  const requestId = `live-intent-${String(index).padStart(4, '0')}`;
  return {
    requestId,
    profileBinding: LIVE_BINDING,
    replaceExisting: true,
    omitAbsent: true,
    profile: liveProfileFor([question])
  };
}

function compactLevels(levels) {
  if (!Array.isArray(levels)) return [];
  return levels.slice(0, 2).map((level, index) => ({
    level: Number.isInteger(level?.level) ? level.level : index + 1,
    options: Array.isArray(level?.options) ? level.options.slice(0, 40).map((option) => ({
      text: typeof option?.text === 'string' ? option.text.slice(0, 80) : '',
      classes: Array.isArray(option?.classes) ? option.classes.slice(0, 12).map((name) => String(name).slice(0, 40)) : []
    })) : []
  }));
}

function compactClicked(clicked) {
  if (!clicked || typeof clicked !== 'object') return null;
  return {
    level: Number.isInteger(clicked.level) ? clicked.level : null,
    text: typeof clicked.text === 'string' ? clicked.text.slice(0, 80) : '',
    classes: Array.isArray(clicked.classes) ? clicked.classes.slice(0, 12).map((name) => String(name).slice(0, 40)) : []
  };
}

function compactStep(step) {
  const siteValid = step?.siteValid === true ? true : step?.siteValid === false ? false : null;
  return {
    step: typeof step?.step === 'string' ? step.step.slice(0, 40) : '',
    panelFound: step?.panelFound === true,
    panelShown: step?.panelShown === true,
    levels: compactLevels(step?.levels),
    clicked: compactClicked(step?.clicked),
    inputValue: typeof step?.inputValue === 'string' ? step.inputValue.slice(0, 80) : '',
    confirmPresent: step?.confirmPresent === true,
    confirmClicked: step?.confirmClicked === true,
    siteValid,
    note: typeof step?.note === 'string' ? step.note.slice(0, 80) : ''
  };
}

export function compactPickerDiag(diag) {
  if (!diag || typeof diag !== 'object') return null;
  const siteValid = diag.siteValid === true ? true : diag.siteValid === false ? false : null;
  return {
    question: typeof diag.question === 'string' ? diag.question.slice(0, 40) : '',
    reason: typeof diag.reason === 'string' ? diag.reason.slice(0, 80) : '',
    inputBefore: typeof diag.inputBefore === 'string' ? diag.inputBefore.slice(0, 80) : '',
    inputAfter: typeof diag.inputAfter === 'string' ? diag.inputAfter.slice(0, 80) : '',
    confirmPresent: diag.confirmPresent === true,
    confirmClicked: diag.confirmClicked === true,
    siteValid,
    steps: Array.isArray(diag.steps) ? diag.steps.slice(0, 12).map(compactStep) : []
  };
}

export function mergeFillResults(fills) {
  const list = Array.isArray(fills) ? fills : [];
  const fields = [];
  const pickerDiags = [];
  for (const fill of list) {
    if (Array.isArray(fill?.fields)) {
      for (const row of fill.fields) {
        if (!row?.question) continue;
        const compact = {
          question: row.question,
          status: row.status || 'failed',
          reason: typeof row.reason === 'string' ? row.reason : ''
        };
        const index = fields.findIndex((item) => item.question === compact.question);
        if (index >= 0) fields[index] = compact;
        else fields.push(compact);
      }
    }
    const diag = compactPickerDiag(fill?.pickerDiag);
    if (diag) pickerDiags.push(diag);
  }
  const failed = fields.find((row) => row.status !== 'verified');
  return {
    ok: fields.length > 0 && fields.every((row) => row.status === 'verified'),
    reason: failed ? failed.reason : null,
    writeStarted: list.some((fill) => fill?.writeStarted === true),
    liveSupportClaimed: list.some((fill) => fill?.liveSupportClaimed === true),
    softwareClickedSave: list.some((fill) => fill?.softwareClickedSave === true),
    softwareClickedSubmit: list.some((fill) => fill?.softwareClickedSubmit === true),
    softwareClickedDelete: list.some((fill) => fill?.softwareClickedDelete === true),
    fields,
    pickerDiags
  };
}

export function isNonGetMethod(method) {
  const verb = String(method || '').toUpperCase();
  return verb !== '' && verb !== 'GET' && verb !== 'HEAD' && verb !== 'OPTIONS';
}

export function isAllowedLookup(url) {
  return redactUrl(url) === SALARY_UNIT_LOOKUP;
}

export function isDisallowedNonGet(method, url) {
  if (!isNonGetMethod(method)) return false;
  return !isAllowedLookup(url);
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
    if (isDisallowedNonGet(method, row?.url)) saveLikePost.push(item);
  }
  return { nonGet: nonGet.slice(0, 80), saveLikePost: saveLikePost.slice(0, 40) };
}

export function decideOpen(snapshot) {
  const halt = (reason, detail = null) => ({ action: 'stop', reason, detail });
  if (!snapshot || snapshot.hrefOk !== true) return halt('wrong_page');
  if (snapshot.readyState !== 'complete') return halt('page_not_ready');
  if (snapshot.visible !== true) return halt('page_hidden');
  if (snapshot.titlesOk !== true) return halt('section_structure_changed');
  if ((snapshot.foreignFormCount || 0) > 0) return halt('other_section_editor_open');
  const forms = snapshot.formCount || 0;
  const sec = snapshot.secFormCount || 0;
  const present = snapshot.editLinkPresentCount || 0;
  const visibleEdits = snapshot.editLinkCount || 0;
  if (sec === 1 && forms === 1 && present === 0) return { action: 'already_open' };
  if (sec === 1 && forms === 1 && present > 0) return halt('control_not_supported', 'edit_link_still_present');
  if (forms > 0 || sec > 0) return halt('control_not_supported', 'editor_not_unique');
  if (visibleEdits !== 1) return halt('control_not_supported', visibleEdits ? 'edit_not_unique' : 'edit_not_found');
  if (snapshot.editWouldNavigate === true) return halt('control_not_supported', 'edit_would_navigate');
  return { action: 'click_edit' };
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
  const labels = (Array.isArray(clicks) ? clicks : []).map((click) => click?.label);
  return labels.every((label) => label === '编辑' || label === '取消');
}

export function plannedFieldRows(reason) {
  return PLANNED.map((item) => ({
    q: item.q,
    status: 'failed',
    reason,
    value: null
  }));
}

export function buildFieldRows({ questions, fillQuestions, fillFields, readback, expected, extraLabels } = {}) {
  const fills = Array.isArray(fillFields) ? fillFields : [];
  const reads = Array.isArray(readback) ? readback : [];
  const want = Array.isArray(questions) ? questions : [];
  const fillSet = new Set(Array.isArray(fillQuestions) ? fillQuestions : want);
  const rows = want.map((q) => {
    const read = reads.find((row) => row?.q === q);
    const value = read && typeof read.value === 'string' ? read.value : null;
    if (!read || read.reason === 'control_not_supported') {
      return { q, status: 'failed', reason: 'control_not_supported', value };
    }
    if (!fillSet.has(q)) {
      return typeof value === 'string'
        ? { q, status: 'verified', reason: 'read_only', value }
        : { q, status: 'failed', reason: 'control_not_supported', value: null };
    }
    const fill = fills.find((row) => row?.question === q);
    if (!fill) {
      return { q, status: 'failed', reason: 'control_not_supported', value };
    }
    let status = fill.status === 'verified' || fill.status === 'failed' || fill.status === 'skipped'
      ? fill.status
      : 'failed';
    let reason = typeof fill.reason === 'string' ? fill.reason : 'control_not_supported';
    const expect = expected?.[q];
    if (typeof expect === 'string' && value !== expect && status === 'verified') {
      status = 'failed';
      reason = 'readback_mismatch';
    }
    return { q, status, reason, value };
  });
  const extras = Array.isArray(extraLabels) ? extraLabels : [];
  for (const label of extras) {
    if (typeof label !== 'string' || !label || want.includes(label)) continue;
    if (rows.some((row) => row.q === label)) continue;
    rows.push({ q: label, status: 'failed', reason: 'control_not_supported', value: null });
  }
  return rows;
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

export function evidenceExitCode(evidence) {
  const details = evidence?.finalDetails || {};
  const reason = details.reason;
  if (['cdp_unreachable', 'timeout', 'cdp_endpoint_invalid', 'cdp_targets_invalid'].includes(reason)) return 1;
  if (reason === 'refusing_forbidden_click' || details.bannedClick === true) return 3;
  if (Array.isArray(evidence?.saveLikePost) && evidence.saveLikePost.length > 0) return 3;
  const fields = Array.isArray(evidence?.fields) ? evidence.fields : [];
  const plannedOk = fields.length >= PLANNED.length
    && fields.every((row) => row.status === 'verified')
    && details.cancelsOk === true
    && details.moduleClaimedSupport !== true;
  return plannedOk ? 0 : 2;
}

export function buildPageExpression() {
  return [
    '(() => {',
    `const redactUrl = ${redactUrl.toString()};`,
    `const decideOpen = ${decideOpen.toString()};`,
    `const decideCancel = ${decideCancel.toString()};`,
    `const installGthLive = ${installGthLive.toString()};`,
    `return installGthLive(globalThis.document, ${JSON.stringify({ titles: SECTION_TITLES, pageUrl: EDIT_PAGE })});`,
    '})()'
  ].join('\n');
}

function installGthLive(doc, options) {
  const view = doc.defaultView;
  const titles = options.titles;
  const pageUrl = options.pageUrl;
  const posts = [];
  const clicks = [];
  const norm = (value) => String(value ?? '').replace(/[\s\u00a0]+/gu, ' ').trim();
  // Cascader panels keep a search input and checkboxes in the DOM while the
  // panel is display:none. Walk ancestors so those are not a second control.
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
  const banned = ['保存', '提交', '投递', '删除', '确定'];

  function note(method, url, via) {
    const verb = String(method || 'GET').toUpperCase();
    if (!verb || verb === 'GET' || verb === 'HEAD' || verb === 'OPTIONS') return;
    if (posts.length >= 80) return;
    posts.push({ via, method: verb, url: redactUrl(url) });
  }

  function installTap() {
    const originalFetch = view.fetch;
    const xhr = view.XMLHttpRequest;
    const originalOpen = xhr?.prototype?.open;
    const originalSend = xhr?.prototype?.send;
    const originalBeacon = view.navigator?.sendBeacon;
    if (typeof originalFetch === 'function') {
      view.fetch = function fetchTap(input, init, ...rest) {
        const method = String((init && init.method) || (typeof input === 'object' && input ? input.method : '') || 'GET').toUpperCase();
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        note(method, url, 'fetch');
        return originalFetch.call(this, input, init, ...rest);
      };
    }
    if (originalOpen && originalSend) {
      xhr.prototype.open = function openTap(method, url, ...rest) {
        this.__gthIntentLive = { method: String(method || 'GET').toUpperCase(), url: String(url || '') };
        return originalOpen.call(this, method, url, ...rest);
      };
      xhr.prototype.send = function sendTap(...rest) {
        if (this.__gthIntentLive) note(this.__gthIntentLive.method, this.__gthIntentLive.url, 'xhr');
        return originalSend.call(this, ...rest);
      };
    }
    if (typeof originalBeacon === 'function' && view.navigator) {
      view.navigator.sendBeacon = function beaconTap(url, ...rest) {
        note('POST', url, 'beacon');
        return originalBeacon.call(this, url, ...rest);
      };
    }
    return function removeTap() {
      if (typeof originalFetch === 'function') view.fetch = originalFetch;
      if (originalOpen) xhr.prototype.open = originalOpen;
      if (originalSend) xhr.prototype.send = originalSend;
      if (typeof originalBeacon === 'function' && view.navigator) view.navigator.sendBeacon = originalBeacon;
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

  function editLinks(section) {
    return [...section.querySelectorAll('.title_ a.h-e-btn')].filter((node) => norm(node.textContent) === '编辑');
  }

  function wouldNavigate(node) {
    if (!node || node.tagName !== 'A') return false;
    const href = node.getAttribute('href');
    if (href == null) return false;
    const text = href.trim();
    if (text === '' || text === '#') return false;
    return !/^javascript:(?:;|void\(0\))$/iu.test(text);
  }

  function snapshot(sectionIndex) {
    const page = pageState();
    const section = page.list[sectionIndex] || null;
    const forms = section ? [...section.querySelectorAll('form')] : [];
    const secForms = section ? [...section.querySelectorAll('form.el-form.sec-form')] : [];
    const links = section ? editLinks(section) : [];
    const visibleLinks = links.filter(visible);
    let foreignFormCount = 0;
    page.list.forEach((node, index) => {
      if (index === sectionIndex) return;
      foreignFormCount += node.querySelectorAll('form').length;
    });
    return {
      hrefOk: page.hrefOk,
      readyState: page.readyState,
      visible: page.visible,
      titlesOk: page.titlesOk,
      foreignFormCount,
      formCount: forms.length,
      secFormCount: secForms.length,
      editLinkCount: visibleLinks.length,
      editLinkPresentCount: links.length,
      editWouldNavigate: visibleLinks.length === 1 ? wouldNavigate(visibleLinks[0]) : false,
      secForms,
      visibleLinks
    };
  }

  function perform(node, expected) {
    const text = norm(node?.textContent);
    if (!node || text !== expected || banned.some((word) => text.includes(word))) {
      return { ok: false, reason: 'control_not_supported', detail: 'banned_click' };
    }
    clicks.push({ type: 'click', label: expected });
    node.click();
    return { ok: true };
  }

  async function waitFor(read, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    do {
      const found = read();
      if (found) return found;
      await new Promise((resolve) => view.setTimeout(resolve, 60));
    } while (Date.now() < deadline);
    return null;
  }

  async function open(sectionIndex) {
    const shot = snapshot(sectionIndex);
    const decision = decideOpen(shot);
    if (decision.action === 'stop') return { ok: false, openedByUs: false, alreadyOpen: false, ...decision };
    if (decision.action === 'already_open') {
      return { ok: true, action: 'already_open', openedByUs: false, alreadyOpen: true };
    }
    const link = shot.visibleLinks[0];
    if (!link || link.tagName !== 'A' || !link.matches('a.h-e-btn') || !link.closest('.title_')) {
      return { ok: false, action: 'stop', reason: 'control_not_supported', detail: 'edit_selector', openedByUs: false, alreadyOpen: false };
    }
    const clicked = perform(link, '编辑');
    if (!clicked.ok) return { ...clicked, action: 'stop', openedByUs: false, alreadyOpen: false };
    const appeared = await waitFor(() => {
      const again = decideOpen(snapshot(sectionIndex));
      if (again.action === 'already_open') return { ready: true };
      if (again.action === 'stop' && again.reason !== 'control_not_supported') return { failed: again };
      if (again.detail === 'editor_not_unique' || again.detail === 'edit_link_still_present' || again.detail === 'edit_would_navigate') {
        return { failed: again };
      }
      return null;
    }, 4000);
    if (!appeared) {
      return { ok: false, action: 'stop', reason: 'control_not_supported', detail: 'editor_not_opened', openedByUs: true, alreadyOpen: false };
    }
    if (appeared.failed) return { ok: false, openedByUs: true, alreadyOpen: false, ...appeared.failed };
    const itemsReady = await waitFor(() => (editorForm(sectionIndex).form?.querySelector('.el-form-item') ? true : null), 3000);
    if (!itemsReady) return { ok: false, action: 'stop', reason: 'control_not_supported', detail: 'editor_items_not_rendered', openedByUs: true, alreadyOpen: false };
    return { ok: true, action: 'click_edit', openedByUs: true, alreadyOpen: false };
  }

  function editorForm(sectionIndex) {
    const shot = snapshot(sectionIndex);
    const decision = decideOpen(shot);
    if (decision.action !== 'already_open') {
      return { ok: false, reason: decision.reason || 'control_not_supported', detail: decision.detail || 'editor_not_open', form: null };
    }
    return { ok: true, form: shot.secForms[0] };
  }

  function read(sectionIndex, questions) {
    const found = editorForm(sectionIndex);
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

  async function cancel(sectionIndex) {
    const found = editorForm(sectionIndex);
    if (!found.ok) {
      return { ok: false, closed: false, reason: 'control_not_supported', detail: found.detail || 'editor_not_open' };
    }
    const form = found.form;
    const buttons = [...form.querySelectorAll('button')].filter(visible);
    const cancels = buttons.filter((node) => norm(node.textContent) === '取消');
    const decision = decideCancel({
      cancelCount: cancels.length,
      cancelText: cancels.length === 1 ? norm(cancels[0].textContent) : '',
      cancelType: cancels.length === 1 ? String(cancels[0].type || '').toLowerCase() : ''
    });
    if (decision.action !== 'click_cancel') return { ok: false, closed: false, ...decision };
    const clicked = perform(cancels[0], '取消');
    if (!clicked.ok) return { ok: false, closed: false, ...clicked };
    const gone = await waitFor(() => (!form.isConnected || !visible(form) ? true : null), 2000);
    return gone
      ? { ok: true, closed: true, reason: null }
      : { ok: false, closed: false, reason: 'editor_still_open' };
  }

  const api = {
    open,
    read,
    cancel,
    posts: () => posts.slice(),
    clicks: () => clicks.slice(),
    restore: () => {
      try { removeTap(); } catch { /* leave the hooks if restore throws */ }
    }
  };
  view.__gthIntentLive = api;
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
      id: 'gth-intent-live-shim',
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
    liveSupportClaimed: fill.liveSupportClaimed === true,
    softwareClickedSave: fill.softwareClickedSave === true,
    softwareClickedSubmit: fill.softwareClickedSubmit === true,
    softwareClickedDelete: fill.softwareClickedDelete === true,
    fields: Array.isArray(fill.fields) ? fill.fields.map((row) => ({
      question: row?.question || '',
      status: row?.status || '',
      reason: row?.reason || ''
    })) : [],
    pickerDiags: Array.isArray(fill.pickerDiags) ? fill.pickerDiags.map(compactPickerDiag).filter(Boolean) : []
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

export async function runGthIntentLive(options = {}) {
  const env = options.env || process.env;
  const port = options.port ?? readPort(env);
  const outDir = options.outDir || readOutDir(env);
  const stepTimeoutMs = options.stepTimeoutMs ?? readStepTimeout(env);
  const tipSha = options.tipSha || readTipSha(options.repoRoot || repoRoot);
  const getJsonFn = options.getJson || getJson;
  const connectFn = options.connectCdp || connectCdp;
  const filePath = path.join(outDir, EVIDENCE_NAME);
  const fillQuestions = Array.isArray(options.fillQuestions) ? options.fillQuestions : readFillFields(env);
  const profile = liveProfileFor(fillQuestions);
  const steps = [];
  const cdpPosts = [];
  const sessions = [];
  const sectionRuns = [];
  let reason = null;
  let href = null;
  let tabAction = 'none';
  let fatalDetail = null;

  const fieldMap = new Map(plannedFieldRows('not_run').map((row) => [row.q, row]));
  const extras = [];
  let clicks = [];
  let pagePosts = [];
  let moduleClaimedSupport = false;
  let bannedClick = false;
  let cancelsOk = false;

  function adopt(rows) {
    for (const row of rows) {
      if (fieldMap.has(row.q)) fieldMap.set(row.q, row);
      else if (!extras.some((item) => item.q === row.q)) extras.push(row);
    }
  }

  async function finishSession(session) {
    if (!session) return;
    try {
      await evaluate(session, 'globalThis.__gthIntentLive && globalThis.__gthIntentLive.restore()', {
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
            intent: typeof globalThis.ResumeGthIntent?.trial === 'function'
          })`, { timeoutMs: stepTimeoutMs, step: 'inject_check' });
          steps.push('inject_check');
          if (!check?.intent) {
            reason = 'inject_failed';
            fatalDetail = 'globals_missing';
          }
        }
        if (!reason) {
          for (const section of LIVE_SECTIONS) {
            const run = { id: section.id, section: section.section, open: null, fill: null, read: null, cancel: null };
            sectionRuns.push(run);
            try {
              run.open = await evaluate(
                session,
                `globalThis.__gthIntentLive.open(${section.sectionIndex})`,
                { timeoutMs: stepTimeoutMs, step: `open_${section.id}`, awaitPromise: true }
              );
              steps.push(`open_${section.id}`);
            } catch (error) {
              run.open = { ok: false, reason: error?.reason || 'eval_failed', detail: String(error?.message || error).slice(0, 200) };
              steps.push(`open_${section.id}_failed`);
            }
            if (run.open?.ok !== true) {
              adopt(section.questions.map((q) => ({
                q,
                status: 'failed',
                reason: run.open?.reason || 'control_not_supported',
                value: null
              })));
              continue;
            }
            const fills = [];
            for (let index = 0; index < fillQuestions.length; index += 1) {
              const question = fillQuestions[index];
              const step = `fill_${section.id}_${index}`;
              try {
                const fill = await evaluate(
                  session,
                  `globalThis.${section.globalName}.trial(${JSON.stringify(liveFillRequestFor(question, index))})`,
                  { timeoutMs: stepTimeoutMs, step, awaitPromise: true }
                );
                fills.push(fill);
                steps.push(step);
              } catch (error) {
                fills.push({
                  ok: false,
                  reason: error?.reason || 'eval_failed',
                  fields: [{ question, status: 'failed', reason: error?.reason || 'eval_failed' }],
                  writeStarted: false,
                  liveSupportClaimed: false,
                  softwareClickedSave: false,
                  softwareClickedSubmit: false,
                  softwareClickedDelete: false
                });
                steps.push(`${step}_failed`);
              }
            }
            run.fill = mergeFillResults(fills);
            if (run.fill?.liveSupportClaimed === true) moduleClaimedSupport = true;
            if (run.fill?.softwareClickedSave === true || run.fill?.softwareClickedSubmit === true || run.fill?.softwareClickedDelete === true) {
              bannedClick = true;
            }
            try {
              run.read = await evaluate(
                session,
                `globalThis.__gthIntentLive.read(${section.sectionIndex}, ${JSON.stringify(section.questions)})`,
                { timeoutMs: stepTimeoutMs, step: `read_${section.id}`, awaitPromise: true }
              );
              steps.push(`read_${section.id}`);
            } catch (error) {
              run.read = {
                ok: false,
                reason: error?.reason || 'eval_failed',
                readback: section.questions.map((q) => ({ q, value: null, reason: 'control_not_supported' })),
                extraLabels: []
              };
              steps.push(`read_${section.id}_failed`);
            }
            try {
              run.cancel = await evaluate(
                session,
                `globalThis.__gthIntentLive.cancel(${section.sectionIndex})`,
                { timeoutMs: stepTimeoutMs, step: `cancel_${section.id}`, awaitPromise: true }
              );
              steps.push(`cancel_${section.id}`);
            } catch (error) {
              run.cancel = { ok: false, closed: false, reason: error?.reason || 'eval_failed' };
              steps.push(`cancel_${section.id}_failed`);
            }
            adopt(buildFieldRows({
              questions: section.questions,
              fillQuestions,
              fillFields: run.fill?.fields,
              readback: run.read?.readback,
              expected: expectedReadback(),
              extraLabels: run.read?.extraLabels
            }));
          }
          try {
            pagePosts = await evaluate(session, 'globalThis.__gthIntentLive.posts()', {
              timeoutMs: stepTimeoutMs,
              step: 'read_posts'
            });
            steps.push('read_posts');
          } catch {
            pagePosts = [];
            steps.push('read_posts_failed');
          }
          try {
            clicks = await evaluate(session, 'globalThis.__gthIntentLive.clicks()', {
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

  if (reason) {
    for (const [q, row] of fieldMap) {
      if (row.reason === 'not_run') fieldMap.set(q, { ...row, reason });
    }
  }
  const fields = [...PLANNED.map((item) => fieldMap.get(item.q)), ...extras];
  const traffic = partitionTraffic([...(Array.isArray(pagePosts) ? pagePosts : []), ...cdpPosts]);
  if (!clicksAreDiscardOnly(clicks)) bannedClick = true;
  const opened = sectionRuns.filter((run) => run.open?.ok === true);
  cancelsOk = opened.length === LIVE_SECTIONS.length
    && opened.every((run) => run.cancel?.closed === true)
    && clicksAreDiscardOnly(clicks);
  if (bannedClick) reason = 'refusing_forbidden_click';
  else if (traffic.saveLikePost.length && !reason) reason = 'disallowed_non_get';
  else if (!reason && !fields.every((row) => row.status === 'verified')) {
    reason = fields.find((row) => row.status !== 'verified')?.reason || 'control_not_supported';
  } else if (!reason && !cancelsOk) reason = 'cancel_not_confirmed';

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
      allowedLookup: SALARY_UNIT_LOOKUP,
      cancelsOk,
      bannedClick,
      moduleClaimedSupport,
      profile,
      readbackExpected: expectedReadback(),
      sections: sectionRuns.map((run) => ({
        id: run.id,
        section: run.section,
        open: run.open,
        fill: publicFill(run.fill),
        read: run.read ? {
          ok: run.read.ok === true,
          reason: run.read.reason || null,
          extraLabels: run.read.extraLabels || [],
          unlabeled: run.read.unlabeled || 0
        } : null,
        cancel: run.cancel
      })),
      unfilled: fields.filter((row) => row.status !== 'verified').map((row) => ({ q: row.q, reason: row.reason })),
      fillQuestions,
      pickerDiags: sectionRuns.flatMap((run) => (Array.isArray(run.fill?.pickerDiags) ? run.fill.pickerDiags : [])),
      limits: [
        'Fills only 到岗日期 (el-select, exact option 一个月内), 期望工作地区 (cascader answer 北京||大兴区, input readback is L1+L2 joined 北京大兴区), and 期望薪资 (plain text 15000). FIELDS is a comma list restricted to those three. Each name is its own ResumeGthIntent.trial with omitAbsent and that one answer. trial() itself stops on the first thrown picker_* and would leave later answers not_run; one answer per call is how 期望薪资 and 到岗日期 still run after the cascader aborts. The shipped writer clicks inside the cascader, including its panel 确定. This runner does not.',
        'A picker_* abort returns pickerDiag (per-step panel found/shown, level option texts and classes, the option clicked, input before/after, whether 确定 was present or clicked, siteValid). This runner copies that object onto finalDetails.pickerDiags. The diag read does not click outside the cascader panel and never clicks 保存.',
        '期望从事职位类别, 现从事行业, 现从事职位类别, and 现薪资 are read back only. omitAbsent:true leaves a required question untouched when this profile has no answer. The product popup still requires all five before it sends GTH_INTENT_FILL.',
        '编辑 is only the one visible .title_ a.h-e-btn whose text is 编辑. After that click the 编辑 link must be gone, then the runner waits until form.el-form.sec-form contains .el-form-item.',
        '取消 is only the one visible button whose type is button and whose text is 取消 inside form.el-form.sec-form. 关闭, anchors, 保存, and 确定 are not clicked by this runner.',
        'The only allowed non-GET is https://hr.gtht.com/interface/js/type/getsalaryunit.json after the query string is removed. Any other non-GET is saveLikePost and fails the run. A different getsalaryunit.json path is not the lookup.',
        'A form in another .r-section stops the run with other_section_editor_open. This runner does not click that form.',
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
    const evidence = await runGthIntentLive();
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
