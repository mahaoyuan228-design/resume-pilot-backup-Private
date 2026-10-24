#!/usr/bin/env node
/**
 * Never-save live trial for 招商证券 CMS 自我评价 / 评价内容.
 *
 * Connects to an already-open Edge CDP port, finds the baseline
 * wecruit.hotjob.cn resume tab whose path is /pb/resumeOperation.html
 * (query and hash allowed; they are stripped from evidence), and fills the
 * 评价内容 textarea through the shipped engine. The write is
 * src/content/engine.js RESUME_FILL: cmsDecision binds that label to
 * selfEvaluation and setBoundNativeValue uses the textarea prototype setter
 * plus input, change, and blur. This file does not reimplement that write.
 *
 * The shipped fill refuses a different existing value (existing_value). The
 * live control is inline and already filled, so this runner blanks the DOM
 * with the prototype setter and no events, then calls RESUME_FILL. After
 * readback it restores the original the same way when that original is
 * non-empty. It never clicks 保存 / 提交 / 投递 or any other button.
 *
 * Windows PowerShell, from the repo root, with the resume tab already open:
 *
 *   $env:PORT='9239'; $env:OUTDIR='.'; node scripts/live/cms-self-eval-live.mjs
 *
 * PORT defaults to 9239. OUTDIR defaults to the current directory. The JSON
 * evidence file is cms-self-eval-live.json. liveSupportClaimed stays false.
 * This script stays out of extension packs and does not claim the live site
 * is supported.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { connectCdp, getJson } from '../../tools/live-harvest/cdp-client.mjs';
import { isTimeout } from '../../tools/live-harvest/errors.mjs';
import { CMS_BASELINE_PAGE, CMS_BASELINE_SU, CMS_HOST, CMS_PAGE_PATH_RE } from '../lib/cms-page-target.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const BASE_TIP = '42bd726';
export const DEFAULT_PORT = 9239;
export const EVIDENCE_NAME = 'cms-self-eval-live.json';
export const READBACK_WAIT_MS = 500;
export const QUESTION = '评价内容';
export const SECTION_NAME = '自我评价必填';
export const PLACEHOLDER = '请填写评价内容';
export const FIXTURE_TEXT = '熟悉 Python 与数据分析，能把业务问题整理成可复核的结论。';
export const POWERSHELL = "$env:PORT='9239'; $env:OUTDIR='.'; node scripts/live/cms-self-eval-live.mjs";
export const SIGNATURE = Object.freeze(['个人基本信息必填', '自我评价必填', '教育经历必填']);
export const LIVE_FILES = Object.freeze([
  'src/core/matcher.js',
  'src/content/cms-session.js',
  'src/content/engine.js'
]);
export const RUNTIME_FILES = Object.freeze([
  'scripts/live/cms-self-eval-live.mjs',
  'scripts/lib/cms-page-target.mjs',
  'tools/live-harvest/cdp-client.mjs',
  'tools/live-harvest/errors.mjs',
  'src/core/matcher.js',
  'src/content/cms-session.js',
  'src/content/engine.js'
]);
export const LIVE_BINDING = Object.freeze({
  version: 1,
  epoch: '00000000-0000-4000-8000-0000000000ae',
  profileHash: 'ae'.repeat(32)
});
const BANNED_CLICK = Object.freeze(['保存', '提交', '投递', '删除', '确定']);

export const HELP = `Usage (Windows PowerShell, repo root):
  ${POWERSHELL}

Never-save CDP trial of CMS 自我评价 / 评价内容 on the baseline 招商证券
resume tab (path contains /pb/resumeOperation.html). Attaches to an existing
tab. Does not log in, does not navigate, does not click, and does not claim
the live site is supported.

  PORT                 Loopback CDP port. Default ${DEFAULT_PORT}
  OUTDIR               Directory for ${EVIDENCE_NAME}. Default current directory
  STEP_TIMEOUT_MS      Per CDP call timeout. Default 30000
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

export function redactUrl(raw) {
  const text = String(raw || '');
  try {
    const url = new URL(text, 'https://wecruit.hotjob.cn');
    return `${url.origin}${url.pathname}`;
  } catch {
    return text.split('?')[0].split('#')[0].slice(0, 200);
  }
}

// Kept identical to ResumeMatcher.normalize so the label check cannot drift
// from the shipped cmsDecision comparison.
export function normalizeCmsLabel(value) {
  return String(value ?? '')
    .replace(/\(必填\)|（必填）|\(选填\)|（选填）/g, '')
    .replace(/[＊*：:！!？?，,。.\s\u00a0]/g, '')
    .trim()
    .toLocaleLowerCase();
}

export function isNonGetMethod(method) {
  const verb = String(method || '').toUpperCase();
  return verb !== '' && verb !== 'GET';
}

export function selfEvalProfile(value) {
  return {
    selfEvaluation: value,
    confirmedFields: ['selfEvaluation'],
    education: [],
    projects: [],
    familyMembers: [],
    customFacts: [],
    customAnswers: {},
    familyDisclosureEnabled: false
  };
}

export function classifyCmsTabUrl(raw) {
  let url;
  try { url = new URL(String(raw || '')); } catch { return { ok: false, reason: 'wrong_page' }; }
  if (url.protocol !== 'https:' || url.hostname !== CMS_HOST || url.port || url.username || url.password) {
    return { ok: false, reason: 'wrong_page' };
  }
  const match = CMS_PAGE_PATH_RE.exec(url.pathname);
  if (!match || match[1] !== CMS_BASELINE_SU) return { ok: false, reason: 'wrong_page' };
  return { ok: true, su: match[1], page: `${url.origin}${url.pathname}` };
}

export function selectCmsResumeTarget(targets) {
  const pages = [];
  for (const target of Array.isArray(targets) ? targets : []) {
    if (!target || target.type !== 'page') continue;
    const url = String(target.url || '');
    if (!url || url.startsWith('chrome-extension:') || url.startsWith('devtools:') || url.startsWith('chrome:')) continue;
    if (!classifyCmsTabUrl(url).ok) continue;
    pages.push(target);
  }
  if (pages.length === 1) return { action: 'attach', target: pages[0] };
  if (pages.length > 1) return { action: 'stop', reason: 'tab_ambiguous' };
  return { action: 'missing', reason: 'tab_not_found' };
}

export function looksLikeLogin(guard) {
  if (!guard || typeof guard !== 'object') return false;
  if (guard.password === true) return true;
  return /\/(?:login|signin|sign-in|passport|oauth|cas|sso)(?:\/|$|\?|#)/iu.test(String(guard.href || ''))
    || /登录|统一认证/u.test(String(guard.title || ''));
}

export function pageGuardExpression() {
  return `(() => {
    const password = [...document.querySelectorAll('input[type="password"]')].some((node) => {
      const style = getComputedStyle(node);
      return style.display !== 'none' && style.visibility !== 'hidden' && node.getClientRects().length > 0;
    });
    return {
      href: location.href,
      title: document.title,
      readyState: document.readyState,
      visible: document.visibilityState,
      password
    };
  })()`;
}

export function assertLoopback(wsUrl, port) {
  let url;
  try { url = new URL(wsUrl); } catch { return false; }
  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') return false;
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) return false;
  if (url.username || url.password) return false;
  if (url.port && Number(url.port) !== Number(port)) return false;
  return true;
}

export function partitionTraffic(rows) {
  const nonGet = [];
  const seen = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    const method = String(row?.method || '').toUpperCase();
    if (!isNonGetMethod(method)) continue;
    const url = redactUrl(row?.url);
    const via = String(row?.via || 'unknown').slice(0, 40);
    const key = `${method} ${url} ${via}`;
    if (seen.has(key)) continue;
    seen.add(key);
    nonGet.push({ method, url, via });
  }
  return { nonGet: nonGet.slice(0, 80), saveLikePost: nonGet.slice(0, 80) };
}

export function locateSelfEval(doc, config = {}) {
  // Literals, not the exported constants: this function is copied into the page.
  const sectionName = config.section || '自我评价必填';
  const question = config.question || '评价内容';
  const placeholder = config.placeholder || '请填写评价内容';
  const signature = config.signature || ['个人基本信息必填', '自我评价必填', '教育经历必填'];
  const view = doc?.defaultView;
  const fail = (detail) => ({ ok: false, reason: 'control_not_supported', detail, textarea: null, anchorSeen: false });
  if (!doc || !view) return { ok: false, reason: 'wrong_page', detail: 'no_document', textarea: null, anchorSeen: false };
  const visibleNode = (node) => {
    if (!node || node.disabled || node.closest?.('[hidden],[aria-hidden="true"]')) return false;
    const style = view.getComputedStyle(node);
    return style.display !== 'none' && style.visibility !== 'hidden' && node.getClientRects().length > 0;
  };
  const headings = [...doc.querySelectorAll('.form-cell > .tit-wrap .tit')];
  const names = headings.map((node) => normalizeCmsLabel(node.textContent));
  if (!signature.every((name) => names.includes(name))) {
    return { ok: false, reason: 'section_structure_changed', detail: 'signature', textarea: null, anchorSeen: false };
  }
  const sections = [...doc.querySelectorAll('.form-cell')].filter((cell) => {
    const tit = cell.querySelector(':scope > .tit-wrap .tit');
    return normalizeCmsLabel(tit?.textContent) === sectionName;
  });
  if (sections.length !== 1) return fail(sections.length ? 'section_not_unique' : 'section_not_found');
  const section = sections[0];
  const tit = section.querySelector(':scope > .tit-wrap .tit');
  const paragraphs = [...(tit?.querySelectorAll('p') || [])];
  if (paragraphs.length && !paragraphs.some((node) => normalizeCmsLabel(node.textContent) === '自我评价')) {
    return fail('heading_p_not_self_evaluation');
  }
  const anchorSeen = [...doc.querySelectorAll('i.anchor-title')]
    .some((node) => normalizeCmsLabel(node.textContent) === '自我评价');
  const textareas = [...section.querySelectorAll('textarea')].filter((node) => {
    if (!(node instanceof view.HTMLTextAreaElement) || !visibleNode(node)) return false;
    const item = node.closest('.ant-form-item');
    const labels = [...(item?.querySelectorAll('.ant-form-item-label > label') || [])]
      .filter((label) => label.closest('.ant-form-item') === item);
    return labels.length === 1 && normalizeCmsLabel(labels[0].textContent) === question;
  });
  if (textareas.length !== 1) {
    return { ...fail(textareas.length ? 'textarea_not_unique' : 'textarea_not_found'), anchorSeen };
  }
  const textarea = textareas[0];
  if (textarea.readOnly || textarea.disabled) return { ...fail('not_editable'), anchorSeen };
  if (!textarea.classList.contains('ant-input')) return { ...fail('not_ant_input'), anchorSeen };
  if ((textarea.getAttribute('placeholder') || '') !== placeholder) return { ...fail('placeholder_changed'), anchorSeen };
  return {
    ok: true,
    reason: null,
    detail: null,
    textarea,
    anchorSeen,
    original: String(textarea.value ?? '')
  };
}

export function readReactSignals(node) {
  const signals = [];
  const tracker = node?._valueTracker;
  if (tracker && typeof tracker.getValue === 'function') {
    signals.push({ via: 'value_tracker', value: String(tracker.getValue() ?? '') });
  }
  const key = node ? Object.keys(node).find((name) => /^__(?:reactInternalInstance|reactFiber)\$/u.test(name)) : '';
  let fiber = key ? node[key] : null;
  for (let depth = 0; fiber && depth < 12; depth += 1, fiber = fiber.return) {
    const props = fiber.memoizedProps;
    if (props && Object.prototype.hasOwnProperty.call(props, 'value') && typeof props.value === 'string') {
      signals.push({ via: 'memoized_props', value: props.value });
      break;
    }
    const state = fiber.memoizedState;
    if (state && typeof state === 'object' && !state.queue
      && Object.prototype.hasOwnProperty.call(state, 'value') && typeof state.value === 'string') {
      signals.push({ via: 'memoized_state', value: state.value });
      break;
    }
  }
  return signals;
}

export function assessReadback({ dom, signals, expected, waitedMs, blurred, minWaitMs = 500 } = {}) {
  if (dom !== expected) return { ok: false, reason: 'readback_mismatch' };
  if (blurred !== true) return { ok: false, reason: 'blur_not_observed' };
  if (!(Number(waitedMs) >= minWaitMs)) return { ok: false, reason: 'react_wait_not_met' };
  const list = Array.isArray(signals) ? signals : [];
  if (!list.length) return { ok: false, reason: 'react_state_not_observed' };
  if (list.some((row) => row?.value !== expected)) return { ok: false, reason: 'react_state_mismatch' };
  return { ok: true, reason: 'readback_matched' };
}

export function decideInspect(field, domValue, question = '评价内容') {
  if (!field || field.path !== 'selfEvaluation' || field.key !== 'selfEvaluation') {
    return { action: 'stop', reason: 'control_not_supported', detail: 'binding_missing' };
  }
  const labels = Array.isArray(field.labels) ? field.labels : [];
  if (labels.length !== 1 || normalizeCmsLabel(labels[0]) !== question) {
    return { action: 'stop', reason: 'control_not_supported', detail: 'label_not_evaluation' };
  }
  if (field.kind !== 'textarea') {
    return { action: 'stop', reason: 'control_not_supported', detail: 'not_textarea' };
  }
  if (field.reason !== 'ready' && field.reason !== 'existing_value') {
    return { action: 'stop', reason: 'control_not_supported', detail: field.reason || 'not_bindable' };
  }
  if (String(field.currentValue ?? '') !== String(domValue ?? '')) {
    return { action: 'stop', reason: 'control_not_supported', detail: 'inspect_dom_mismatch' };
  }
  return { action: 'fill', blankFirst: true };
}

export function decideProductFill(field) {
  if (!field || field.path !== 'selfEvaluation') return { ok: false, reason: 'control_not_supported' };
  if (field.status === 'verified' && field.reason === 'readback_matched') return { ok: true, reason: 'readback_matched' };
  return { ok: false, reason: field.reason || field.status || 'readback_mismatch' };
}

export function restorePlan(original) {
  if (String(original ?? '').trim() === '') {
    return { action: 'native_events', reason: 'product_rejects_empty_self_evaluation' };
  }
  return { action: 'product_fill', reason: null };
}

export function decideClicks(clicks) {
  const list = Array.isArray(clicks) ? clicks : [];
  if (!list.length) return { ok: true, clickCount: 0, reason: null, banned: false };
  const banned = list.some((click) => BANNED_CLICK.some((word) => String(click?.label || '').includes(word))
    || click?.type === 'submit');
  return {
    ok: false,
    clickCount: list.length,
    banned,
    reason: banned ? 'refusing_forbidden_click' : 'click_not_allowed'
  };
}

export function signalsMatch(signals, expected) {
  const list = Array.isArray(signals) ? signals : [];
  return list.length > 0 && list.every((row) => row?.value === expected);
}

export function buildEvidence({ tipSha, fields, nonGet, finalDetails } = {}) {
  const traffic = Array.isArray(nonGet) ? nonGet : [];
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
    nonGet: traffic,
    saveLikePost: traffic,
    finalDetails: details
  };
}

export function evidenceExitCode(evidence) {
  const details = evidence?.finalDetails || {};
  const reason = details.reason;
  if (['cdp_unreachable', 'timeout', 'cdp_endpoint_invalid', 'cdp_targets_invalid'].includes(reason)) return 1;
  if (reason === 'refusing_forbidden_click' || reason === 'click_not_allowed' || details.bannedClick === true || (details.clickCount || 0) > 0) {
    return 3;
  }
  if ((evidence?.nonGet || []).length > 0 || (evidence?.saveLikePost || []).length > 0) return 3;
  const fields = Array.isArray(evidence?.fields) ? evidence.fields : [];
  const ok = evidence?.neverSave === true
    && evidence?.liveSupportClaimed === false
    && details.liveSupportClaimed !== true
    && details.moduleClaimedSupport !== true
    && details.restored === true
    && details.pageLeftAsFound === true
    && fields.length === 1
    && fields[0].q === QUESTION
    && fields[0].status === 'verified'
    && fields[0].reason === 'readback_matched'
    && fields[0].value === FIXTURE_TEXT;
  return ok ? 0 : 2;
}

export function buildPageExpression() {
  const options = {
    page: CMS_BASELINE_PAGE,
    fixture: FIXTURE_TEXT,
    binding: LIVE_BINDING,
    waitMs: READBACK_WAIT_MS
  };
  return [
    '(() => {',
    `const READBACK_WAIT_MS = ${READBACK_WAIT_MS};`,
    `const redactUrl = ${redactUrl.toString()};`,
    `const normalizeCmsLabel = ${normalizeCmsLabel.toString()};`,
    `const isNonGetMethod = ${isNonGetMethod.toString()};`,
    `const selfEvalProfile = ${selfEvalProfile.toString()};`,
    `const locateSelfEval = ${locateSelfEval.toString()};`,
    `const readReactSignals = ${readReactSignals.toString()};`,
    `const assessReadback = ${assessReadback.toString()};`,
    `const decideInspect = ${decideInspect.toString()};`,
    `const decideProductFill = ${decideProductFill.toString()};`,
    `const restorePlan = ${restorePlan.toString()};`,
    `const signalsMatch = ${signalsMatch.toString()};`,
    `const installCmsSelfEvalLive = ${installCmsSelfEvalLive.toString()};`,
    `return installCmsSelfEvalLive(globalThis.document, ${JSON.stringify(options)});`,
    '})()'
  ].join('\n');
}

function installCmsSelfEvalLive(doc, options) {
  const view = doc.defaultView;
  if (view.__cmsSelfEvalLive?.restore) {
    try { view.__cmsSelfEvalLive.restore(); } catch { /* replace a previous trial's hooks */ }
  }
  const posts = [];
  const clicks = [];
  const fillCalls = [];
  const waitMs = Math.max(READBACK_WAIT_MS, Number(options?.waitMs) || 0);

  function note(method, url, via) {
    const verb = String(method || 'GET').toUpperCase();
    if (!isNonGetMethod(verb)) return;
    if (posts.length >= 80) return;
    posts.push({ via, method: verb, url: redactUrl(url) });
  }

  function installTap() {
    const originalFetch = view.fetch?.bind(view);
    const xhr = view.XMLHttpRequest;
    const originalOpen = xhr?.prototype?.open;
    const originalSend = xhr?.prototype?.send;
    const originalBeacon = view.navigator?.sendBeacon?.bind(view.navigator);
    const originalSubmit = view.HTMLFormElement?.prototype?.submit;
    const originalRequestSubmit = view.HTMLFormElement?.prototype?.requestSubmit;
    if (typeof view.fetch === 'function') {
      view.fetch = function fetchTap(input, init, ...rest) {
        const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        if (isNonGetMethod(method)) {
          note(method, url, 'fetch');
          return Promise.reject(new TypeError('cms_self_eval_live_blocked_non_get'));
        }
        return originalFetch(input, init, ...rest);
      };
    }
    if (originalOpen && originalSend) {
      xhr.prototype.open = function openTap(method, url, ...rest) {
        this.__cmsSelfEvalLive = { method: String(method || 'GET').toUpperCase(), url: String(url || '') };
        return originalOpen.call(this, method, url, ...rest);
      };
      xhr.prototype.send = function sendTap(...rest) {
        const meta = this.__cmsSelfEvalLive;
        if (meta && isNonGetMethod(meta.method)) {
          note(meta.method, meta.url, 'xhr');
          try { this.abort(); } catch { /* request was not sent */ }
          return undefined;
        }
        return originalSend.call(this, ...rest);
      };
    }
    if (typeof originalBeacon === 'function' && view.navigator) {
      view.navigator.sendBeacon = function beaconTap(url, ...rest) {
        note('POST', url, 'beacon');
        return false;
      };
    }
    if (originalSubmit) {
      view.HTMLFormElement.prototype.submit = function submitTap() {
        clicks.push({ type: 'submit', label: 'submit' });
      };
    }
    if (originalRequestSubmit) {
      view.HTMLFormElement.prototype.requestSubmit = function requestSubmitTap() {
        clicks.push({ type: 'submit', label: 'requestSubmit' });
      };
    }
    return function removeTap() {
      if (typeof originalFetch === 'function') view.fetch = originalFetch;
      if (originalOpen) xhr.prototype.open = originalOpen;
      if (originalSend) xhr.prototype.send = originalSend;
      if (typeof originalBeacon === 'function' && view.navigator) view.navigator.sendBeacon = originalBeacon;
      if (originalSubmit) view.HTMLFormElement.prototype.submit = originalSubmit;
      if (originalRequestSubmit) view.HTMLFormElement.prototype.requestSubmit = originalRequestSubmit;
    };
  }

  const originalClick = view.HTMLElement.prototype.click;
  function guardedClick() {
    clicks.push({
      type: 'click',
      label: normalizeCmsLabel(this?.textContent || this?.getAttribute?.('aria-label') || '').slice(0, 40)
    });
  }
  function onSubmit(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    clicks.push({ type: 'submit', label: 'submit' });
  }
  view.HTMLElement.prototype.click = guardedClick;
  doc.addEventListener('submit', onSubmit, true);
  const removeTap = installTap();

  function removeGuards() {
    try { removeTap(); } catch { /* leave the page callable if a hook is already gone */ }
    if (view.HTMLElement.prototype.click === guardedClick) view.HTMLElement.prototype.click = originalClick;
    doc.removeEventListener('submit', onSubmit, true);
  }

  function readDom(node) {
    const proto = node instanceof view.HTMLTextAreaElement
      ? view.HTMLTextAreaElement.prototype
      : node instanceof view.HTMLInputElement
        ? view.HTMLInputElement.prototype
        : node instanceof view.HTMLSelectElement
          ? view.HTMLSelectElement.prototype
          : null;
    const desc = proto ? Object.getOwnPropertyDescriptor(proto, 'value') : null;
    if (desc?.get) return String(desc.get.call(node) ?? '');
    return String(node?.value ?? '');
  }

  function writeDomOnly(node, value) {
    const desc = Object.getOwnPropertyDescriptor(view.HTMLTextAreaElement.prototype, 'value');
    if (!desc?.set || !desc?.get) return false;
    desc.set.call(node, value);
    return desc.get.call(node) === value;
  }

  function writeDomWithEvents(node, value) {
    const desc = Object.getOwnPropertyDescriptor(view.HTMLTextAreaElement.prototype, 'value');
    if (!desc?.set || !desc?.get) return false;
    desc.set.call(node, value);
    for (const type of ['input', 'change', 'blur']) node.dispatchEvent(new view.Event(type, { bubbles: true }));
    return desc.get.call(node) === value;
  }

  function snapshotOthers(target) {
    return JSON.stringify([...doc.querySelectorAll('input,textarea,select')].filter((node) => node !== target).map((node) => [
      node.tagName,
      node.type || '',
      readDom(node),
      !!node.checked,
      node.selectedIndex ?? null
    ]));
  }

  function wait(ms) {
    return new Promise((resolve) => view.setTimeout(resolve, ms));
  }

  function clickFailure() {
    if (!clicks.length) return null;
    const bannedWords = ['保存', '提交', '投递', '删除', '确定'];
    const banned = clicks.some((click) => click?.type === 'submit'
      || bannedWords.some((word) => String(click?.label || '').includes(word)));
    return banned ? 'refusing_forbidden_click' : 'click_not_allowed';
  }

  function callEngine(message) {
    const listener = view.__resumeQuickFillEngineListener;
    if (typeof listener !== 'function') return Promise.resolve({ ok: false, error: 'engine_listener_missing' });
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value && typeof value === 'object' ? value : { ok: false, error: 'engine_reply_invalid' });
      };
      try {
        const returned = listener(message, { id: view.chrome?.runtime?.id }, finish);
        if (returned !== true) finish({ ok: false, error: 'engine_listener_rejected' });
      } catch (error) {
        finish({ ok: false, error: String(error?.message || error).slice(0, 180) });
      }
    });
  }

  function fieldOf(reply) {
    const fields = reply?.data?.fields;
    if (!Array.isArray(fields)) return { field: null, unexpected: [] };
    const bound = fields.filter((row) => row?.path === 'selfEvaluation');
    const unexpected = fields.filter((row) => row
      && row.path !== 'selfEvaluation'
      && row.status === 'verified'
      && (row.reason === 'readback_matched' || row.reason === 'readback_reapplied'))
      .map((row) => ({ path: String(row.path || ''), reason: String(row.reason || '') }));
    return { field: bound.length === 1 ? bound[0] : null, unexpected };
  }

  async function productFill(value) {
    fillCalls.push({ index: fillCalls.length, length: String(value ?? '').length });
    return callEngine({
      type: 'RESUME_FILL',
      profile: selfEvalProfile(value),
      profileBinding: options.binding
    });
  }

  async function restoreOriginal(textarea, original) {
    const plan = restorePlan(original);
    let via = plan.action === 'product_fill' ? 'product' : 'native_events';
    let productReason = null;
    if (plan.action === 'product_fill') {
      writeDomOnly(textarea, '');
      const reply = await productFill(original);
      const found = fieldOf(reply);
      productReason = found.field?.reason || (reply?.ok ? null : reply?.error) || null;
    } else {
      writeDomWithEvents(textarea, original);
    }
    await wait(waitMs);
    let dom = readDom(textarea);
    let signals = readReactSignals(textarea);
    if (dom !== original || !signalsMatch(signals, original)) {
      writeDomWithEvents(textarea, original);
      via = 'native_events';
      await wait(waitMs);
      dom = readDom(textarea);
      signals = readReactSignals(textarea);
    }
    const ok = dom === original && signalsMatch(signals, original);
    return { ok, via: ok ? via : 'failed', reason: ok ? 'restored' : 'restore_failed', productReason };
  }

  async function execute() {
    const fail = (reason, detail = null) => ({
      ok: false,
      reason,
      detail,
      liveSupportClaimed: false,
      originalLength: null,
      readbackValue: null,
      readback: { ok: false, reason },
      restore: { ok: false, via: 'not_needed', reason: 'not_run' },
      otherChanged: false,
      unexpectedWrites: [],
      clickCount: clicks.length,
      clicks: clicks.slice(),
      anchorSeen: false,
      fillCalls: fillCalls.slice(),
      productReason: null,
      reactVia: [],
      blurred: false,
      waitedMs: 0,
      pageLeftAsFound: true
    });
    if (`${view.location.origin}${view.location.pathname}` !== options.page) return fail('wrong_page');
    if (doc.readyState !== 'complete') return fail('page_not_ready');
    if (doc.visibilityState !== 'visible') return fail('page_hidden');
    const password = [...doc.querySelectorAll('input[type="password"]')].some((node) => node.getClientRects().length > 0);
    if (password) return fail('needs_login');
    const earlyClick = clickFailure();
    if (earlyClick) return fail(earlyClick);
    const located = locateSelfEval(doc);
    if (!located.ok) {
      const stopped = fail(located.reason || 'control_not_supported', located.detail || null);
      stopped.anchorSeen = located.anchorSeen === true;
      stopped.pageLeftAsFound = true;
      return stopped;
    }
    const textarea = located.textarea;
    const original = located.original;
    const inspected = await callEngine({ type: 'RESUME_INSPECT', profile: selfEvalProfile(options.fixture) });
    if (inspected?.ok !== true) return fail(inspected?.error || 'inspect_failed');
    const inspectedFields = inspected.data?.fields || [];
    const bound = inspectedFields.filter((row) => row?.path === 'selfEvaluation' && row?.key === 'selfEvaluation');
    if (bound.length !== 1) return fail('control_not_supported', 'binding_missing');
    const inspectDecision = decideInspect(bound[0], readDom(textarea));
    if (inspectDecision.action !== 'fill') return fail(inspectDecision.reason, inspectDecision.detail);
    let verdict = null;
    try {
      verdict = await view.chrome.runtime.sendMessage({
        type: 'RESUME_PROFILE_BINDING_CHECK',
        profileBinding: options.binding
      });
    } catch { verdict = null; }
    if (verdict?.allowed !== true) return fail('profile_binding_changed');
    const realSession = view.ResumeCmsSession;
    if (typeof realSession?.check !== 'function') return fail('site_session_unverified');
    const session = await realSession.check();
    if (session?.authenticated !== true) return fail(session?.reason || 'site_session_unverified');
    const othersBefore = snapshotOthers(textarea);
    let blurCount = 0;
    const onBlur = () => { blurCount += 1; };
    textarea.addEventListener('blur', onBlur, true);
    let blanked = false;
    let restore = { ok: false, via: 'not_needed', reason: 'not_run' };
    try {
      view.ResumeCmsSession = { check: async () => session };
      blanked = true;
      if (!writeDomOnly(textarea, '')) {
        restore = await restoreOriginal(textarea, original);
        const stopped = fail('control_not_supported', 'blank_failed');
        stopped.restore = restore;
        stopped.fillCalls = fillCalls.slice();
        stopped.pageLeftAsFound = restore.ok === true && readDom(textarea) === original;
        return stopped;
      }
      const blurBefore = blurCount;
      const reply = await productFill(options.fixture);
      await wait(waitMs);
      const dom = readDom(textarea);
      const signals = readReactSignals(textarea);
      const blurred = blurCount > blurBefore;
      const readback = assessReadback({
        dom,
        signals,
        expected: options.fixture,
        waitedMs: waitMs,
        blurred
      });
      const found = fieldOf(reply);
      const product = decideProductFill(found.field);
      const otherChanged = snapshotOthers(textarea) !== othersBefore;
      restore = await restoreOriginal(textarea, original);
      const othersAfter = snapshotOthers(textarea) !== othersBefore;
      const changed = otherChanged || othersAfter;
      const readbackValue = dom === options.fixture ? options.fixture : null;
      const pageLeftAsFound = restore.ok === true && !changed && readDom(textarea) === original
        && signalsMatch(readReactSignals(textarea), original);
      let reason = null;
      const lateClick = clickFailure();
      if (lateClick) reason = lateClick;
      else if (found.unexpected.length) reason = 'unexpected_write';
      else if (changed) reason = 'other_values_changed';
      else if (!reply?.ok) reason = reply?.error || 'control_not_supported';
      else if (!product.ok) reason = product.reason || 'readback_mismatch';
      else if (!readback.ok) reason = readback.reason;
      else if (!restore.ok) reason = 'restore_failed';
      else if (!pageLeftAsFound) reason = 'restore_failed';
      return {
        ok: reason == null,
        reason,
        detail: product.ok ? null : (found.field?.reason || reply?.error || null),
        liveSupportClaimed: false,
        originalLength: String(original ?? '').length,
        readbackValue,
        readback,
        restore,
        otherChanged: changed,
        unexpectedWrites: found.unexpected,
        clickCount: clicks.length,
        clicks: clicks.slice(),
        anchorSeen: located.anchorSeen === true,
        fillCalls: fillCalls.slice(),
        productReason: product.ok ? product.reason : (found.field?.reason || null),
        reactVia: signals.map((row) => row.via),
        blurred,
        waitedMs: waitMs,
        pageLeftAsFound
      };
    } finally {
      textarea.removeEventListener('blur', onBlur, true);
      if (blanked && restore?.ok !== true && readDom(textarea) !== original) {
        try { restore = await restoreOriginal(textarea, original); } catch { /* reported by the caller */ }
      }
      view.ResumeCmsSession = realSession;
    }
  }

  const api = {
    async run() {
      try { return await execute(); }
      catch (error) {
        return {
          ok: false,
          reason: 'control_error',
          detail: String(error?.message || error).slice(0, 180),
          liveSupportClaimed: false,
          originalLength: null,
          readbackValue: null,
          readback: { ok: false, reason: 'control_error' },
          restore: { ok: false, via: 'failed', reason: 'restore_failed' },
          otherChanged: false,
          unexpectedWrites: [],
          clickCount: clicks.length,
          clicks: clicks.slice(),
          anchorSeen: false,
          fillCalls: fillCalls.slice(),
          productReason: null,
          reactVia: [],
          blurred: false,
          waitedMs: 0,
          pageLeftAsFound: false
        };
      }
    },
    posts: () => posts.slice(),
    clicks: () => clicks.slice(),
    restore() {
      removeGuards();
      if (view.__cmsSelfEvalLive === api) delete view.__cmsSelfEvalLive;
    }
  };
  view.__cmsSelfEvalLive = api;
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
      id: 'cms-self-eval-live-shim',
      getManifest() {
        return { background: { service_worker: 'src/background/worker.mjs' } };
      },
      sendMessage(message) {
        if (message && message.type === 'RESUME_PROFILE_BINDING_CHECK') return Promise.resolve({ allowed: true });
        return Promise.resolve({ allowed: false });
      },
      onMessage: {
        addListener(listener) { listeners.add(listener); },
        removeListener(listener) { listeners.delete(listener); },
        hasListener(listener) { return listeners.has(listener); },
        hasListeners() { return listeners.size > 0; }
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

function plannedField(reason) {
  return { q: QUESTION, status: 'failed', reason, value: null };
}

export async function runCmsSelfEvalLive(options = {}) {
  const env = options.env || process.env;
  const port = options.port ?? readPort(env);
  const outDir = options.outDir || readOutDir(env);
  const stepTimeoutMs = options.stepTimeoutMs ?? readStepTimeout(env);
  const tipSha = options.tipSha || readTipSha(options.repoRoot || repoRoot);
  const getJsonFn = options.getJson || getJson;
  const connectFn = options.connectCdp || connectCdp;
  const root = options.repoRoot || repoRoot;
  const filePath = path.join(outDir, EVIDENCE_NAME);
  const steps = [];
  const cdpPosts = [];
  const sessions = [];
  let reason = null;
  let href = null;
  let tabAction = 'none';
  let fatalDetail = null;
  let outcome = null;
  let pagePosts = [];
  let clicks = [];

  async function finishSession(session) {
    if (!session) return;
    try {
      await evaluate(session, 'globalThis.__cmsSelfEvalLive && globalThis.__cmsSelfEvalLive.restore()', {
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
    const selected = selectCmsResumeTarget(targets);
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
          const request = msg.params?.request;
          if (!request || !isNonGetMethod(request.method)) return;
          cdpPosts.push({ via: 'cdp', method: request.method, url: request.url });
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
      } else if (!classifyCmsTabUrl(guard?.href).ok) {
        reason = 'wrong_page';
        fatalDetail = 'wrong_page';
      } else if (guard?.readyState !== 'complete') {
        reason = 'page_not_ready';
        fatalDetail = 'page_not_ready';
      } else if (guard?.visible !== 'visible') {
        reason = 'page_hidden';
        fatalDetail = 'page_hidden';
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
              const source = fs.readFileSync(path.join(root, rel), 'utf8');
              const step = `inject_${path.basename(rel).replace(/\.m?js$/u, '')}`;
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
            matcher: typeof globalThis.ResumeMatcher?.normalize === 'function',
            session: typeof globalThis.ResumeCmsSession?.check === 'function',
            engine: typeof globalThis.__resumeQuickFillEngineListener === 'function'
          })`, { timeoutMs: stepTimeoutMs, step: 'inject_check' });
          steps.push('inject_check');
          if (!check?.matcher || !check?.session || !check?.engine) {
            reason = 'inject_failed';
            fatalDetail = 'globals_missing';
          }
        }
        if (!reason) {
          try {
            outcome = await evaluate(session, 'globalThis.__cmsSelfEvalLive.run()', {
              timeoutMs: stepTimeoutMs,
              step: 'self_eval_run',
              awaitPromise: true
            });
            steps.push('self_eval_run');
          } catch (error) {
            outcome = { ok: false, reason: error?.reason || 'eval_failed', detail: String(error?.message || error).slice(0, 200) };
            steps.push('self_eval_run_failed');
          }
          try {
            pagePosts = await evaluate(session, 'globalThis.__cmsSelfEvalLive.posts()', {
              timeoutMs: stepTimeoutMs,
              step: 'read_posts'
            });
            steps.push('read_posts');
          } catch {
            pagePosts = [];
            steps.push('read_posts_failed');
          }
          try {
            clicks = await evaluate(session, 'globalThis.__cmsSelfEvalLive.clicks()', {
              timeoutMs: stepTimeoutMs,
              step: 'read_clicks'
            });
            steps.push('read_clicks');
          } catch {
            clicks = outcome?.clicks || [];
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

  const clickRows = Array.isArray(clicks) ? clicks : [];
  const clickDecision = decideClicks(clickRows);
  const traffic = partitionTraffic([...(Array.isArray(pagePosts) ? pagePosts : []), ...cdpPosts]);
  const readbackOk = outcome?.readback?.ok === true
    && outcome?.readbackValue === FIXTURE_TEXT
    && outcome?.productReason === 'readback_matched';
  const restored = outcome?.restore?.ok === true && outcome?.pageLeftAsFound === true;
  let field = plannedField(reason || outcome?.reason || 'not_run');
  if (!reason && readbackOk && restored && outcome?.otherChanged !== true && !(outcome?.unexpectedWrites || []).length && outcome?.liveSupportClaimed !== true && clickDecision.ok) {
    field = { q: QUESTION, status: 'verified', reason: 'readback_matched', value: FIXTURE_TEXT };
  } else if (!reason) {
    field = plannedField(clickDecision.ok ? (outcome?.reason || 'control_not_supported') : clickDecision.reason);
  }
  if (!clickDecision.ok) reason = clickDecision.reason;
  else if (traffic.nonGet.length && !reason) reason = 'non_get_request';
  else if (!reason && field.status !== 'verified') reason = field.reason;

  const evidence = buildEvidence({
    tipSha,
    fields: [field],
    nonGet: traffic.nonGet,
    finalDetails: {
      baseTip: BASE_TIP,
      port,
      href,
      tabAction,
      reason,
      fatalDetail,
      steps,
      clicks: clickRows,
      clickCount: clickRows.length,
      bannedClick: clickDecision.banned === true,
      nonGet: traffic.nonGet,
      restored: outcome?.restore?.ok === true,
      pageLeftAsFound: outcome?.pageLeftAsFound === true,
      restoreVia: outcome?.restore?.via || null,
      moduleClaimedSupport: false,
      anchorSeen: outcome?.anchorSeen === true,
      originalLength: Number.isInteger(outcome?.originalLength) ? outcome.originalLength : null,
      fillCalls: Array.isArray(outcome?.fillCalls) ? outcome.fillCalls : [],
      reactVia: Array.isArray(outcome?.reactVia) ? outcome.reactVia : [],
      productReason: outcome?.productReason || null,
      blurred: outcome?.blurred === true,
      waitedMs: outcome?.waitedMs || 0,
      otherChanged: outcome?.otherChanged === true,
      unexpectedWrites: Array.isArray(outcome?.unexpectedWrites) ? outcome.unexpectedWrites : [],
      readbackReason: outcome?.readback?.reason || null,
      limits: [
        'Only 评价内容 in 自我评价必填 is written, and only by src/content/engine.js RESUME_FILL. cmsDecision binds that label to selfEvaluation. setBoundNativeValue does the write.',
        'The DOM is blanked with the textarea prototype setter and no input event so the shipped existing_value guard sees an empty control. This runner does not type the fixture itself.',
        'A non-empty original is restored by the same RESUME_FILL path. An empty original cannot be a confirmed selfEvaluation, so that restore uses the prototype setter plus input, change, and blur.',
        'Readback requires the textarea value, a React value tracker or fiber value, a blur event, and a 500ms wait.',
        'No button is clicked. HTMLElement.click, form submit, and requestSubmit are swallowed. Any click fails the run.',
        'Any request whose method is not GET is blocked, recorded, and fails the run. saveLikePost lists those same non-GET requests. There is no allowed dictionary POST.',
        'The tab must be the baseline 招商证券 page https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html. Query and hash may be present on the open tab and are redacted. Other hotjob tenants are not targets.',
        'liveSupportClaimed stays false. This trial does not add a site to CMS core and does not claim the live page is supported.'
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
    const evidence = await runCmsSelfEvalLive();
    const summary = {
      path: evidence.finalDetails.path,
      exitCode: evidence.finalDetails.exitCode,
      tipSha: evidence.tipSha,
      neverSave: evidence.neverSave,
      liveSupportClaimed: evidence.liveSupportClaimed,
      pageLeftAsFound: evidence.finalDetails.pageLeftAsFound,
      nonGet: evidence.nonGet.length,
      fields: evidence.fields.map((row) => ({ q: row.q, status: row.status, reason: row.reason }))
    };
    process.stdout.write(`${evidence.finalDetails.path}\n${JSON.stringify(summary)}\n`);
    process.exit(evidence.finalDetails.exitCode);
  } catch (error) {
    process.stderr.write(`${error?.message || error}\n`);
    process.exit(1);
  }
}
