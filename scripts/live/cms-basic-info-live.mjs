#!/usr/bin/env node
/**
 * Never-save live trial for 招商证券 CMS 个人基本信息.
 *
 * Connects to an already-open Edge CDP port, finds the baseline
 * wecruit.hotjob.cn resume tab whose path is /pb/resumeOperation.html
 * (query and hash allowed; they are stripped from evidence), and fills three
 * plain-text fields through the shipped engine. The write is
 * src/content/engine.js RESUME_FILL. cmsDecision leaves 姓名 (fullName) and
 * 移动电话 (phone) bound inside 个人基本信息必填, and the matcher binds the
 * long 电子邮箱 label to email. setBoundNativeValue uses the input prototype
 * setter plus input, change, and blur. This file does not reimplement that write.
 *
 * 现居住地 / 籍贯 are not targets: cms-region.js is unwired and is not injected.
 * 婚姻状况 is not a target: the shipped Ant v3 select fill clicks a menu, and
 * this trial fails on any click. No new DOM selector is introduced. Location
 * uses the same form-cell / ant-form-item label walk the engine already uses,
 * and refuses widgets the engine already refuses (.ant-select, calendar, cascader).
 *
 * The shipped fill refuses a different existing value (existing_value). The
 * live controls are already filled, so this runner blanks each input with the
 * prototype setter and no events, then calls RESUME_FILL. After readback it
 * restores a non-empty valid original the same way. It never clicks 保存 /
 * 提交 / 投递 or any other button.
 *
 * Windows PowerShell, from the repo root, with the resume tab already open:
 *
 *   $env:PORT='9239'; $env:OUTDIR='.'; node scripts/live/cms-basic-info-live.mjs
 *
 * PORT defaults to 9239. OUTDIR defaults to the current directory. The JSON
 * evidence file is cms-basic-info-live.json. liveSupportClaimed stays false.
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

export const BASE_TIP = 'e78cf7f';
export const DEFAULT_PORT = 9239;
export const EVIDENCE_NAME = 'cms-basic-info-live.json';
export const READBACK_WAIT_MS = 500;
export const SECTION_NAME = '个人基本信息必填';
export const ANCHOR_NAME = '个人基本信息';
export const POWERSHELL = "$env:PORT='9239'; $env:OUTDIR='.'; node scripts/live/cms-basic-info-live.mjs";
// This trial only writes 个人基本信息必填. Live headings include that title and
// 自我评价必填. 附件信息选填 is not on that page and is not required. 教育经历必填
// is not required here; the shipped engine still has its own section check.
export const SIGNATURE = Object.freeze(['个人基本信息必填', '自我评价必填']);
export const LIVE_FILES = Object.freeze([
  'src/core/matcher.js',
  'src/content/cms-session.js',
  'src/content/engine.js'
]);
export const RUNTIME_FILES = Object.freeze([
  'scripts/live/cms-basic-info-live.mjs',
  'scripts/lib/cms-page-target.mjs',
  'tools/live-harvest/cdp-client.mjs',
  'tools/live-harvest/errors.mjs',
  'src/core/matcher.js',
  'src/content/cms-session.js',
  'src/content/engine.js'
]);
export const LIVE_BINDING = Object.freeze({
  version: 1,
  epoch: '00000000-0000-4000-8000-0000000000af',
  profileHash: 'af'.repeat(32)
});
const BANNED_CLICK = Object.freeze(['保存', '提交', '投递', '删除', '确定']);
const RAW_FIELDS = Object.freeze([
  Object.freeze({
    rawLabel: '姓名*',
    path: 'fullName',
    key: 'fullName',
    placeholder: '请填写姓名',
    fixture: '试用甲'
  }),
  Object.freeze({
    rawLabel: '移动电话（请填写中国大陆移动电话，以便接收短信通知）*',
    path: 'phone',
    key: 'phone',
    placeholder: '请填写移动电话（请填写中国大陆移动电话，以便接收短信通知）',
    fixture: '13800138000'
  }),
  Object.freeze({
    rawLabel: '电子邮箱（请尽量使用163、qq等常见邮箱，尽量不要用gmail、hotmail等境外邮箱或学校邮箱）*',
    path: 'email',
    key: 'email',
    placeholder: '请填写电子邮箱（请尽量使用163、qq等常见邮箱，尽量不要用gmail、hotmail等境外邮箱或学校邮箱）',
    fixture: 'cms-basic@example.test'
  })
]);

export const HELP = `Usage (Windows PowerShell, repo root):
  ${POWERSHELL}

Never-save CDP trial of CMS 个人基本信息 plain-text fields (姓名, 移动电话,
电子邮箱) on the baseline 招商证券 resume tab (path contains
/pb/resumeOperation.html). Attaches to an existing tab. Does not log in, does
not navigate, does not click, and does not claim the live site is supported.

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

export const FIELD_SPECS = Object.freeze(RAW_FIELDS.map((row) => Object.freeze({
  q: normalizeCmsLabel(row.rawLabel),
  rawLabel: row.rawLabel,
  path: row.path,
  key: row.key,
  placeholder: row.placeholder,
  fixture: row.fixture
})));

export function isNonGetMethod(method) {
  const verb = String(method || '').toUpperCase();
  return verb !== '' && verb !== 'GET';
}

export function basicInfoProfile(values) {
  const source = values && typeof values === 'object' ? values : {};
  const profile = {
    confirmedFields: [],
    education: [],
    projects: [],
    familyMembers: [],
    customFacts: [],
    customAnswers: {},
    familyDisclosureEnabled: false
  };
  for (const spec of FIELD_SPECS) {
    if (!Object.prototype.hasOwnProperty.call(source, spec.path)) continue;
    profile[spec.path] = source[spec.path];
    profile.confirmedFields.push(spec.path);
  }
  return profile;
}

export function fixtureProfile() {
  return basicInfoProfile(Object.fromEntries(FIELD_SPECS.map((spec) => [spec.path, spec.fixture])));
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

export function locateBasicFields(doc) {
  const view = doc?.defaultView;
  const fail = (detail, anchorSeen = false) => ({
    ok: false,
    reason: 'control_not_supported',
    detail,
    fields: [],
    anchorSeen
  });
  if (!doc || !view) return { ok: false, reason: 'wrong_page', detail: 'no_document', fields: [], anchorSeen: false };
  const visibleNode = (node) => {
    if (!node || node.disabled || node.closest?.('[hidden],[aria-hidden="true"]')) return false;
    const style = view.getComputedStyle(node);
    return style.display !== 'none' && style.visibility !== 'hidden' && node.getClientRects().length > 0;
  };
  const headings = [...doc.querySelectorAll('.form-cell > .tit-wrap .tit')];
  const names = headings.map((node) => normalizeCmsLabel(node.textContent));
  if (!SIGNATURE.every((name) => names.includes(name))) {
    return { ok: false, reason: 'section_structure_changed', detail: 'signature', fields: [], anchorSeen: false };
  }
  const sections = [...doc.querySelectorAll('.form-cell')].filter((cell) => {
    const tit = cell.querySelector(':scope > .tit-wrap .tit');
    return normalizeCmsLabel(tit?.textContent) === SECTION_NAME;
  });
  if (sections.length !== 1) return fail(sections.length ? 'section_not_unique' : 'section_not_found');
  const section = sections[0];
  const tit = section.querySelector(':scope > .tit-wrap .tit');
  const paragraphs = [...(tit?.querySelectorAll('p') || [])];
  if (paragraphs.length && !paragraphs.some((node) => normalizeCmsLabel(node.textContent) === ANCHOR_NAME)) {
    return fail('heading_p_not_basic_info');
  }
  const anchorSeen = [...doc.querySelectorAll('i.anchor-title')]
    .some((node) => normalizeCmsLabel(node.textContent) === ANCHOR_NAME);
  const fields = [];
  for (const spec of FIELD_SPECS) {
    const items = [...section.querySelectorAll('.ant-form-item')].filter((item) => {
      const labels = [...item.querySelectorAll('.ant-form-item-label > label')]
        .filter((label) => label.closest('.ant-form-item') === item);
      return labels.length === 1 && normalizeCmsLabel(labels[0].textContent) === spec.q;
    });
    if (items.length !== 1) return fail(items.length ? 'input_not_unique' : 'input_not_found', anchorSeen);
    const item = items[0];
    const inputs = [...item.querySelectorAll('input')].filter((node) => (
      node instanceof view.HTMLInputElement
      && node.type === 'text'
      && node.closest('.ant-form-item') === item
      && visibleNode(node)
    ));
    if (inputs.length !== 1) return fail(inputs.length ? 'input_not_unique' : 'input_not_found', anchorSeen);
    const input = inputs[0];
    if (input.closest('.ant-select,.ant-picker,.ant-calendar-picker,.el-date-editor,.el-select,.el-cascader,.cascader-wrap,.cascader-plugins-wrap')) {
      return fail('widget_control', anchorSeen);
    }
    if (input.readOnly || input.disabled) return fail('not_editable', anchorSeen);
    if (!input.classList.contains('ant-input')) return fail('not_ant_input', anchorSeen);
    if ((input.getAttribute('placeholder') || '') !== spec.placeholder) return fail('placeholder_changed', anchorSeen);
    fields.push({ spec, input, original: String(input.value ?? '') });
  }
  return { ok: true, reason: null, detail: null, fields, anchorSeen };
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

export function decideInspect(field, domValue, spec) {
  if (!field || !spec || field.path !== spec.path || field.key !== spec.key) {
    return { action: 'stop', reason: 'control_not_supported', detail: 'binding_missing' };
  }
  const labels = Array.isArray(field.labels) ? field.labels : [];
  if (labels.length !== 1 || normalizeCmsLabel(labels[0]) !== spec.q) {
    return { action: 'stop', reason: 'control_not_supported', detail: 'label_not_basic' };
  }
  if (field.kind !== 'input') {
    return { action: 'stop', reason: 'control_not_supported', detail: 'not_input' };
  }
  if (field.reason !== 'ready' && field.reason !== 'existing_value') {
    return { action: 'stop', reason: 'control_not_supported', detail: field.reason || 'not_bindable' };
  }
  if (String(field.currentValue ?? '') !== String(domValue ?? '')) {
    return { action: 'stop', reason: 'control_not_supported', detail: 'inspect_dom_mismatch' };
  }
  return { action: 'fill', blankFirst: true };
}

export function decideProductFill(boundFields) {
  const list = Array.isArray(boundFields) ? boundFields : [];
  if (list.length !== FIELD_SPECS.length || list.some((field) => !field)) {
    return { ok: false, reason: 'control_not_supported' };
  }
  for (let index = 0; index < FIELD_SPECS.length; index += 1) {
    const spec = FIELD_SPECS[index];
    const field = list[index];
    if (field.path !== spec.path || field.status !== 'verified' || field.reason !== 'readback_matched') {
      return { ok: false, reason: field.reason || field.status || 'readback_mismatch' };
    }
  }
  return { ok: true, reason: 'readback_matched' };
}

export function restorePlan(original, key) {
  const text = String(original ?? '').trim();
  if (!text) return { action: 'native_events', reason: 'product_rejects_empty_value' };
  if (key === 'phone' && !/^1[3-9]\d{9}$/u.test(text)) {
    return { action: 'native_events', reason: 'product_rejects_invalid_phone' };
  }
  if (key === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(text)) {
    return { action: 'native_events', reason: 'product_rejects_invalid_email' };
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

export function plannedFields(reason) {
  return FIELD_SPECS.map((spec) => ({
    q: spec.q,
    status: 'failed',
    reason: reason || 'control_not_supported',
    value: null
  }));
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
    && fields.length === FIELD_SPECS.length
    && FIELD_SPECS.every((spec, index) => fields[index]?.q === spec.q
      && fields[index]?.status === 'verified'
      && fields[index]?.reason === 'readback_matched'
      && fields[index]?.value === spec.fixture);
  return ok ? 0 : 2;
}

export function buildPageExpression() {
  const options = {
    page: CMS_BASELINE_PAGE,
    fixtures: Object.fromEntries(FIELD_SPECS.map((spec) => [spec.path, spec.fixture])),
    binding: LIVE_BINDING,
    waitMs: READBACK_WAIT_MS
  };
  return [
    '(() => {',
    `const READBACK_WAIT_MS = ${READBACK_WAIT_MS};`,
    `const SIGNATURE = ${JSON.stringify(SIGNATURE)};`,
    `const SECTION_NAME = ${JSON.stringify(SECTION_NAME)};`,
    `const ANCHOR_NAME = ${JSON.stringify(ANCHOR_NAME)};`,
    `const FIELD_SPECS = ${JSON.stringify(FIELD_SPECS)};`,
    `const redactUrl = ${redactUrl.toString()};`,
    `const normalizeCmsLabel = ${normalizeCmsLabel.toString()};`,
    `const isNonGetMethod = ${isNonGetMethod.toString()};`,
    `const basicInfoProfile = ${basicInfoProfile.toString()};`,
    `const locateBasicFields = ${locateBasicFields.toString()};`,
    `const readReactSignals = ${readReactSignals.toString()};`,
    `const assessReadback = ${assessReadback.toString()};`,
    `const decideInspect = ${decideInspect.toString()};`,
    `const decideProductFill = ${decideProductFill.toString()};`,
    `const restorePlan = ${restorePlan.toString()};`,
    `const signalsMatch = ${signalsMatch.toString()};`,
    `const installCmsBasicInfoLive = ${installCmsBasicInfoLive.toString()};`,
    `return installCmsBasicInfoLive(globalThis.document, ${JSON.stringify(options)});`,
    '})()'
  ].join('\n');
}

function installCmsBasicInfoLive(doc, options) {
  const view = doc.defaultView;
  if (view.__cmsBasicInfoLive?.restore) {
    try { view.__cmsBasicInfoLive.restore(); } catch { /* replace a previous trial's hooks */ }
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
          return Promise.reject(new TypeError('cms_basic_info_live_blocked_non_get'));
        }
        return originalFetch(input, init, ...rest);
      };
    }
    if (originalOpen && originalSend) {
      xhr.prototype.open = function openTap(method, url, ...rest) {
        this.__cmsBasicInfoLive = { method: String(method || 'GET').toUpperCase(), url: String(url || '') };
        return originalOpen.call(this, method, url, ...rest);
      };
      xhr.prototype.send = function sendTap(...rest) {
        const meta = this.__cmsBasicInfoLive;
        if (meta && isNonGetMethod(meta.method)) {
          note(meta.method, meta.url, 'xhr');
          try { this.abort(); } catch { /* request was not sent */ }
          return undefined;
        }
        return originalSend.call(this, ...rest);
      };
    }
    if (typeof originalBeacon === 'function' && view.navigator) {
      view.navigator.sendBeacon = function beaconTap(url) {
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

  function valueDescriptor(node) {
    const proto = node instanceof view.HTMLTextAreaElement
      ? view.HTMLTextAreaElement.prototype
      : view.HTMLInputElement.prototype;
    return Object.getOwnPropertyDescriptor(proto, 'value');
  }

  function writeDomOnly(node, value) {
    const desc = valueDescriptor(node);
    if (!desc?.set || !desc?.get) return false;
    desc.set.call(node, value);
    return desc.get.call(node) === value;
  }

  function writeDomWithEvents(node, value) {
    const desc = valueDescriptor(node);
    if (!desc?.set || !desc?.get) return false;
    desc.set.call(node, value);
    for (const type of ['input', 'change', 'blur']) node.dispatchEvent(new view.Event(type, { bubbles: true }));
    return desc.get.call(node) === value;
  }

  function snapshotOthers(targets) {
    const skip = new Set(targets);
    return JSON.stringify([...doc.querySelectorAll('input,textarea,select')].filter((node) => !skip.has(node)).map((node) => [
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
    if (!Array.isArray(fields)) return { fields: [], unexpected: [] };
    const bound = FIELD_SPECS.map((spec) => {
      const rows = fields.filter((row) => row?.path === spec.path && row?.key === spec.key);
      return rows.length === 1 ? rows[0] : null;
    });
    const paths = new Set(FIELD_SPECS.map((spec) => spec.path));
    const unexpected = fields.filter((row) => row
      && !paths.has(row.path)
      && row.status === 'verified'
      && (row.reason === 'readback_matched' || row.reason === 'readback_reapplied'))
      .map((row) => ({ path: String(row.path || ''), reason: String(row.reason || '') }));
    return { fields: bound, unexpected };
  }

  async function productFill(values) {
    fillCalls.push({
      index: fillCalls.length,
      lengths: FIELD_SPECS.filter((spec) => Object.prototype.hasOwnProperty.call(values, spec.path))
        .map((spec) => ({ path: spec.path, length: String(values[spec.path] ?? '').length }))
    });
    return callEngine({
      type: 'RESUME_FILL',
      profile: basicInfoProfile(values),
      profileBinding: options.binding
    });
  }

  function lengthsOf(rows) {
    const out = {};
    for (const row of rows || []) out[row.spec.path] = String(row.original ?? '').length;
    return out;
  }

  async function restoreOriginal(rows) {
    const productRows = [];
    for (const row of rows) {
      if (restorePlan(row.original, row.spec.key).action === 'product_fill') productRows.push(row);
    }
    let via = productRows.length === rows.length && productRows.length ? 'product'
      : productRows.length ? 'mixed' : 'native_events';
    let productReason = null;
    if (productRows.length) {
      for (const row of productRows) writeDomOnly(row.input, '');
      const values = {};
      for (const row of productRows) values[row.spec.path] = row.original;
      const reply = await productFill(values);
      const found = fieldOf(reply);
      productReason = found.fields.every((field) => field) ? 'restore_fill_returned' : (reply?.ok ? null : reply?.error) || null;
    }
    await wait(waitMs);
    let pending = rows.filter((row) => readDom(row.input) !== row.original || !signalsMatch(readReactSignals(row.input), row.original));
    if (pending.length) {
      for (const row of pending) writeDomWithEvents(row.input, row.original);
      via = 'native_events';
      await wait(waitMs);
      pending = rows.filter((row) => readDom(row.input) !== row.original || !signalsMatch(readReactSignals(row.input), row.original));
    }
    const ok = pending.length === 0;
    return { ok, via: ok ? via : 'failed', reason: ok ? 'restored' : 'restore_failed', productReason };
  }

  async function execute() {
    const fail = (reason, detail = null) => ({
      ok: false,
      reason,
      detail,
      liveSupportClaimed: false,
      originalLengths: null,
      readbacks: [],
      restore: { ok: false, via: 'not_needed', reason: 'not_run' },
      otherChanged: false,
      unexpectedWrites: [],
      clickCount: clicks.length,
      clicks: clicks.slice(),
      anchorSeen: false,
      fillCalls: fillCalls.slice(),
      productReason: null,
      reactVia: {},
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
    if (posts.length) return fail('non_get_request');
    const located = locateBasicFields(doc);
    if (!located.ok) {
      const stopped = fail(located.reason || 'control_not_supported', located.detail || null);
      stopped.anchorSeen = located.anchorSeen === true;
      stopped.pageLeftAsFound = true;
      return stopped;
    }
    if (FIELD_SPECS.some((spec) => typeof options.fixtures?.[spec.path] !== 'string' || options.fixtures[spec.path] === '')) {
      return fail('control_not_supported', 'fixture_missing');
    }
    const inspected = await callEngine({ type: 'RESUME_INSPECT', profile: basicInfoProfile(options.fixtures) });
    if (inspected?.ok !== true) return fail(inspected?.error || 'inspect_failed');
    const inspectedFields = inspected.data?.fields || [];
    for (const row of located.fields) {
      const bound = inspectedFields.filter((field) => field?.path === row.spec.path && field?.key === row.spec.key);
      if (bound.length !== 1) return fail('control_not_supported', 'binding_missing');
      const inspectDecision = decideInspect(bound[0], readDom(row.input), row.spec);
      if (inspectDecision.action !== 'fill') return fail(inspectDecision.reason, inspectDecision.detail);
    }
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
    if (session?.authenticated !== true) {
      const stopped = fail(session?.reason || 'site_session_unverified');
      stopped.anchorSeen = located.anchorSeen === true;
      stopped.originalLengths = lengthsOf(located.fields);
      stopped.pageLeftAsFound = located.fields.every((row) => readDom(row.input) === row.original);
      return stopped;
    }
    const targets = located.fields.map((row) => row.input);
    const othersBefore = snapshotOthers(targets);
    let blanked = false;
    let restore = { ok: false, via: 'not_needed', reason: 'not_run' };
    try {
      view.ResumeCmsSession = { check: async () => session };
      for (const row of located.fields) {
        row.blurCount = 0;
        row.onBlur = () => { row.blurCount += 1; };
        row.input.addEventListener('blur', row.onBlur, true);
      }
      blanked = true;
      for (const row of located.fields) {
        if (!writeDomOnly(row.input, '')) {
          restore = await restoreOriginal(located.fields);
          const stopped = fail('control_not_supported', 'blank_failed');
          stopped.restore = restore;
          stopped.fillCalls = fillCalls.slice();
          stopped.originalLengths = lengthsOf(located.fields);
          stopped.anchorSeen = located.anchorSeen === true;
          stopped.pageLeftAsFound = restore.ok === true && located.fields.every((item) => readDom(item.input) === item.original);
          return stopped;
        }
      }
      const blurBefore = Object.fromEntries(located.fields.map((row) => [row.spec.path, row.blurCount]));
      const reply = await productFill(options.fixtures);
      await wait(waitMs);
      const readbacks = [];
      const reactVia = {};
      let blurred = true;
      for (const row of located.fields) {
        const dom = readDom(row.input);
        const signals = readReactSignals(row.input);
        const expected = options.fixtures[row.spec.path];
        const fieldBlurred = row.blurCount > blurBefore[row.spec.path];
        if (!fieldBlurred) blurred = false;
        const readback = assessReadback({
          dom,
          signals,
          expected,
          waitedMs: waitMs,
          blurred: fieldBlurred
        });
        reactVia[row.spec.path] = signals.map((item) => item.via);
        readbacks.push({
          path: row.spec.path,
          ok: readback.ok === true,
          reason: readback.reason,
          value: dom === expected ? expected : null
        });
      }
      const found = fieldOf(reply);
      const product = decideProductFill(found.fields);
      const otherChanged = snapshotOthers(targets) !== othersBefore;
      restore = await restoreOriginal(located.fields);
      const othersAfter = snapshotOthers(targets) !== othersBefore;
      const changed = otherChanged || othersAfter;
      const domRestored = located.fields.every((row) => readDom(row.input) === row.original
        && signalsMatch(readReactSignals(row.input), row.original));
      const pageLeftAsFound = restore.ok === true && !changed && domRestored;
      let reason = null;
      const lateClick = clickFailure();
      if (lateClick) reason = lateClick;
      else if (posts.length) reason = 'non_get_request';
      else if (found.unexpected.length) reason = 'unexpected_write';
      else if (changed) reason = 'other_values_changed';
      else if (!reply?.ok) reason = reply?.error || 'control_not_supported';
      else if (!product.ok) reason = product.reason || 'readback_mismatch';
      else if (readbacks.some((row) => row.ok !== true)) reason = readbacks.find((row) => row.ok !== true)?.reason || 'readback_mismatch';
      else if (!restore.ok) reason = 'restore_failed';
      else if (!pageLeftAsFound) reason = 'restore_failed';
      return {
        ok: reason == null,
        reason,
        detail: product.ok ? null : (found.fields.find((field) => field && field.reason !== 'readback_matched')?.reason || reply?.error || null),
        liveSupportClaimed: false,
        originalLengths: lengthsOf(located.fields),
        readbacks,
        restore,
        otherChanged: changed,
        unexpectedWrites: found.unexpected,
        clickCount: clicks.length,
        clicks: clicks.slice(),
        anchorSeen: located.anchorSeen === true,
        fillCalls: fillCalls.slice(),
        productReason: product.ok ? product.reason : (found.fields.find((field) => field)?.reason || null),
        reactVia,
        blurred,
        waitedMs: waitMs,
        pageLeftAsFound
      };
    } finally {
      for (const row of located.fields) {
        if (row.onBlur) row.input.removeEventListener('blur', row.onBlur, true);
      }
      if (blanked && restore?.ok !== true && located.fields.some((row) => readDom(row.input) !== row.original)) {
        try { restore = await restoreOriginal(located.fields); } catch { /* reported by the caller */ }
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
          originalLengths: null,
          readbacks: [],
          restore: { ok: false, via: 'failed', reason: 'restore_failed' },
          otherChanged: false,
          unexpectedWrites: [],
          clickCount: clicks.length,
          clicks: clicks.slice(),
          anchorSeen: false,
          fillCalls: fillCalls.slice(),
          productReason: null,
          reactVia: {},
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
      if (view.__cmsBasicInfoLive === api) delete view.__cmsBasicInfoLive;
    }
  };
  view.__cmsBasicInfoLive = api;
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
      id: 'cms-basic-info-live-shim',
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

export async function runCmsBasicInfoLive(options = {}) {
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
      await evaluate(session, 'globalThis.__cmsBasicInfoLive && globalThis.__cmsBasicInfoLive.restore()', {
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
            outcome = await evaluate(session, 'globalThis.__cmsBasicInfoLive.run()', {
              timeoutMs: stepTimeoutMs,
              step: 'basic_info_run',
              awaitPromise: true
            });
            steps.push('basic_info_run');
          } catch (error) {
            outcome = { ok: false, reason: error?.reason || 'eval_failed', detail: String(error?.message || error).slice(0, 200) };
            steps.push('basic_info_run_failed');
          }
          try {
            pagePosts = await evaluate(session, 'globalThis.__cmsBasicInfoLive.posts()', {
              timeoutMs: stepTimeoutMs,
              step: 'read_posts'
            });
            steps.push('read_posts');
          } catch {
            pagePosts = [];
            steps.push('read_posts_failed');
          }
          try {
            clicks = await evaluate(session, 'globalThis.__cmsBasicInfoLive.clicks()', {
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
  const readbackOk = outcome?.ok === true
    && outcome?.productReason === 'readback_matched'
    && FIELD_SPECS.every((spec) => {
      const row = (outcome.readbacks || []).find((item) => item?.path === spec.path);
      return row?.ok === true && row?.value === spec.fixture;
    });
  const restored = outcome?.restore?.ok === true && outcome?.pageLeftAsFound === true;
  let fields = plannedFields(reason || outcome?.reason || 'not_run');
  if (!reason && readbackOk && restored && outcome?.otherChanged !== true && !(outcome?.unexpectedWrites || []).length && outcome?.liveSupportClaimed !== true && clickDecision.ok) {
    fields = FIELD_SPECS.map((spec) => ({ q: spec.q, status: 'verified', reason: 'readback_matched', value: spec.fixture }));
  } else if (!reason) {
    fields = plannedFields(clickDecision.ok ? (outcome?.reason || 'control_not_supported') : clickDecision.reason);
  }
  if (!clickDecision.ok) reason = clickDecision.reason;
  else if (traffic.nonGet.length && !reason) reason = 'non_get_request';
  else if (!reason && fields.some((field) => field.status !== 'verified')) reason = fields.find((field) => field.status !== 'verified')?.reason || 'control_not_supported';
  if (fatalDetail == null && outcome?.ok !== true && typeof outcome?.detail === 'string' && outcome.detail) {
    fatalDetail = outcome.detail.slice(0, 300);
  }

  const evidence = buildEvidence({
    tipSha,
    fields,
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
      originalLengths: outcome?.originalLengths && typeof outcome.originalLengths === 'object' ? outcome.originalLengths : null,
      fillCalls: Array.isArray(outcome?.fillCalls) ? outcome.fillCalls : [],
      reactVia: outcome?.reactVia && typeof outcome.reactVia === 'object' ? outcome.reactVia : {},
      productReason: outcome?.productReason || null,
      blurred: outcome?.blurred === true,
      waitedMs: outcome?.waitedMs || 0,
      otherChanged: outcome?.otherChanged === true,
      unexpectedWrites: Array.isArray(outcome?.unexpectedWrites) ? outcome.unexpectedWrites : [],
      readbackReasons: Array.isArray(outcome?.readbacks) ? outcome.readbacks.map((row) => ({
        path: row?.path || '',
        reason: row?.reason || null
      })) : [],
      limits: [
        'Only 姓名, 移动电话, and 电子邮箱 inside 个人基本信息必填 are written, and only by src/content/engine.js RESUME_FILL. cmsDecision leaves 姓名 and 移动电话 bound in that section. The matcher binds the long 电子邮箱 label to email. setBoundNativeValue does the write.',
        '现居住地 and 籍贯 are not targets. cms-region.js is not injected. 婚姻状况 is not a target because the shipped Ant v3 fill clicks a menu, and any click fails this run.',
        'Each DOM value is blanked with the input prototype setter and no input event so the shipped existing_value guard sees an empty control. This runner does not type the fixture itself.',
        'A non-empty original that the matcher accepts is restored by the same RESUME_FILL path. An empty or invalid original cannot be a confirmed value, so that restore uses the prototype setter plus input, change, and blur.',
        'Readback requires each input value, a React value tracker or fiber value, a blur event, and a 500ms wait.',
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
    const evidence = await runCmsBasicInfoLive();
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
