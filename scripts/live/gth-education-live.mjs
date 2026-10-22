#!/usr/bin/env node
/**
 * Never-Save GTH education trial. The shipped fullTrial owns editor opening
 * and field writes. The harness permits only scoped editor/picker actions,
 * reads the resulting controls, then cancels. It never claims live support.
 *
 * Plain fields retain their PR #74 defaults. Opt into complex fields with
 * FIELDS and explicit DEGREE, UNIFIED_ADMISSIONS, START_DATE, END_DATE and/or
 * MAJOR_CATEGORY values. No complex applicant facts are invented here.
 * See scripts/live/gth-education-live.md for PowerShell and evidence details.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { connectCdp, getJson } from '../../tools/live-harvest/cdp-client.mjs';
import { isTimeout } from '../../tools/live-harvest/errors.mjs';
import { installGthEducationLive } from './lib/gth-education-page.mjs';
import {
  EDIT_PAGE,
  assertLoopback,
  looksLikeLogin,
  pageGuardExpression,
  redactUrl,
  selectResumeTarget
} from '../probe-gth-intent.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const BASE_TIP = '4280724';
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
  'scripts/live/lib/gth-education-page.mjs',
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
export const COMPLEX_QUESTIONS = Object.freeze(['学历', '是否统招', '在校时间', '专业类别']);
// Compatibility name: these stay unclaimed in the default plain-only trial.
export const UNCLAIMED = COMPLEX_QUESTIONS;
export const FILL_QUESTIONS = Object.freeze(PLAIN_FIELDS.map(([question]) => question));
export const ALL_QUESTIONS = Object.freeze([...FILL_QUESTIONS, ...COMPLEX_QUESTIONS]);
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
const COMPLEX_FACTS = Object.freeze([
  ['学历', 'degree', 'DEGREE'],
  ['是否统招', 'unifiedAdmissions', 'UNIFIED_ADMISSIONS'],
  ['在校时间', 'startDate', 'START_DATE'],
  ['在校时间', 'endDate', 'END_DATE'],
  ['专业类别', 'majorCategory', 'MAJOR_CATEGORY']
]);

function complexFacts(env, questions) {
  const facts = [];
  for (const [question, key, variable] of COMPLEX_FACTS) {
    if (!questions.includes(question)) continue;
    const value = String(env[variable] ?? '').trim();
    if (!value) throw new Error(`missing ${variable} for ${question}`);
    const max = key === 'majorCategory' ? 500 : 200;
    if (value.length > max || /[\u0000-\u001f]/u.test(value)
      || key === 'unifiedAdmissions' && !['是', '否'].includes(value)
      || ['startDate', 'endDate'].includes(key) && !/^(19|20)\d{2}-(0[1-9]|1[0-2])$/u.test(value)
      || key === 'majorCategory' && (value.split('/').length > 6 || value.split('/').some(part => !part.trim()))) {
      throw new Error(`bad ${variable}`);
    }
    facts.push([question, key, value]);
  }
  const dates = Object.fromEntries(facts.map(([, key, value]) => [key, value]));
  if (dates.startDate && dates.endDate && dates.startDate > dates.endDate) throw new Error('bad date range');
  return facts;
}

export const HELP = `Usage (Windows PowerShell, repo root):
  $env:PORT='9239'; $env:OUTDIR='C:/Users/admin/Desktop/ResumeQuickFill-Dev/_temp-scripts'; node scripts/live/gth-education-live.mjs

Never-save CDP trial of GTH 教育经历 plain and explicitly requested complex fields.
Attaches to an existing hr.gtht.com resume edit tab. Does not log in, does not
navigate, and does not claim the live site is supported.

  PORT                 Loopback CDP port. Default ${DEFAULT_PORT}
  OUTDIR               Directory for ${EVIDENCE_NAME}. Default current directory
  STEP_TIMEOUT_MS      Per CDP call timeout. Default 30000
  TARGET_MODE          existing (default) or new.
                       existing calls the shipped row edit icon.
                       new calls the shipped title 添加 or 新增 link.
  ROW_INDEX            Existing row, 0-29. Default 0. Ignored for new.
  FIELDS               Comma list of fields to fill. Default plain fields:
                       ${FILL_QUESTIONS.join(',')}.
                       Also accepts 学历, 是否统招, 在校时间, 专业类别.
  DEGREE               Required when FIELDS includes 学历; exact option label.
  UNIFIED_ADMISSIONS   Required for 是否统招: 是 or 否.
  START_DATE, END_DATE Required for 在校时间: YYYY-MM, start <= end.
  MAJOR_CATEGORY       Required for 专业类别: exact leaf or parent/leaf path.
                       Values are explicit trial inputs, never saved.
  See scripts/live/gth-education-live.md for complete PowerShell examples.
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
  const allowed = new Set(ALL_QUESTIONS);
  if (!parts.length || parts.some((item) => !allowed.has(item))) throw new Error('bad fields');
  return ALL_QUESTIONS.filter((question) => parts.includes(question));
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

export function expectedReadback(env = {}) {
  const expected = { ...ANSWERS };
  const facts = complexFacts(env, readFillFields(env));
  for (const [question, , answer] of facts) expected[question] = answer;
  const dates = facts.filter(([question]) => question === '在校时间').map(([, , value]) => value);
  if (dates.length) expected['在校时间'] = dates.join(' 至 ');
  return expected;
}

export function liveFillRequest(env = process.env) {
  const targetMode = readTargetMode(env);
  const questions = readFillFields(env);
  const facts = [...PLAIN_FIELDS.filter(([question]) => questions.includes(question)), ...complexFacts(env, questions)];
  const candidate = {
    profileIndex: 0,
    confirmedPaths: facts.map(([, key]) => `education.0.${key}`)
  };
  for (const [, key, answer] of facts) candidate[key] = answer;
  const request = {
    requestId: 'live-education-0001', targetMode, profileIndex: 0,
    replaceExisting: true, profileBinding: LIVE_BINDING,
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
  return list.every((click) => click?.allowed === true && (
    ['编辑', '取消', '添加', '新增'].includes(click.label)
    || ['picker_trigger', 'select_option', 'radio_option', 'month_navigation', 'month_option', 'category_confirm', 'category_branch', 'category_option'].includes(click.kind)
      && !['保存', '提交', '投递', '删除'].some(word => String(click.label || '').includes(word))
      && (click.label !== '确定' || click.kind === 'category_confirm')
  ));
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
  const want = Array.isArray(questions) ? questions : ALL_QUESTIONS;
  const fillSet = new Set(Array.isArray(fillQuestions) ? fillQuestions : FILL_QUESTIONS);
  return want.map((q) => {
    const complex = COMPLEX_QUESTIONS.includes(q);
    const read = reads.find((row) => row?.q === q);
    const value = typeof read?.value === 'string' ? read.value : null;
    const evidence = complex ? {
      ...(read?.dom ? { dom: read.dom } : {}),
      ...(read?.detail ? { detail: read.detail } : {})
    } : {};
    if (!ALL_QUESTIONS.includes(q) || complex && !fillSet.has(q)) {
      return { q, status: 'failed', reason: 'control_not_supported', value: null, ...evidence };
    }
    if (!fillSet.has(q)) {
      return value !== null && !read?.reason
        ? { q, status: 'verified', reason: 'read_only', value }
        : { q, status: 'failed', reason: 'control_not_supported', value: null };
    }
    const names = q === '在校时间' ? ['在校时间（开始）', '在校时间（结束）'] : [q];
    const outcomes = names.map(name => fills.find(row => row?.question === name));
    const missing = outcomes.findIndex(row => row?.status !== 'verified');
    if (missing !== -1) {
      const detail = outcomes[missing]?.reason || trialReason || read?.detail || 'field_not_verified';
      return { q, status: 'failed', reason: complex ? 'control_not_supported' : detail,
        value, ...evidence, ...(complex ? { detail, trialFields: outcomes.filter(Boolean) } : {}) };
    }
    if (!read || read.reason || value === null) {
      return { q, status: 'failed', reason: 'control_not_supported', value, ...evidence };
    }
    const expect = expected?.[q];
    // A category path is chosen by the writer through exact parent columns;
    // its closed display can be that path or its terminal leaf.
    const matches = value === expect || q === '专业类别' && typeof expect === 'string'
      && (value === expect.split('/').at(-1) || !expect.includes('/') && value.split('/').at(-1) === expect);
    if (typeof expect !== 'string' || !matches) {
      return { q, status: 'failed', reason: 'readback_mismatch', value, ...evidence };
    }
    return { q, status: 'verified', reason: outcomes[0].reason || 'readback_matched', value, ...evidence };
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
      value: typeof row?.value === 'string' ? row.value : null,
      ...(row?.detail ? { detail: row.detail } : {}),
      ...(row?.dom ? { dom: row.dom } : {}),
      ...(row?.trialFields ? { trialFields: row.trialFields.map(({ question, status, reason }) => ({ question, status, reason })) } : {})
    })) : [],
    saveLikePost: Array.isArray(saveLikePost) ? saveLikePost : [],
    finalDetails: details
  };
}

export function plainFieldsVerified(fields) {
  const rows = Array.isArray(fields) ? fields : [];
  return FILL_QUESTIONS.every((question) => rows.find((row) => row.q === question)?.status === 'verified');
}

export function unclaimedStayUnclaimed(fields, fillQuestions = FILL_QUESTIONS) {
  const rows = Array.isArray(fields) ? fields : [];
  return UNCLAIMED.filter(question => !fillQuestions.includes(question)).every((question) => {
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
  const plannedOk = filledOk && otherPlainOk && unclaimedStayUnclaimed(fields, fillQuestions)
    && !reason && details.auditComplete !== false
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
    `return installGthEducationLive(globalThis.document, ${JSON.stringify({ titles: SECTION_TITLES, pageUrl: EDIT_PAGE, sectionIndex: EDUCATION_INDEX, questions: ALL_QUESTIONS })});`,
    '})()'
  ].join('\n');
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
    activeField: typeof fill.activeField === 'string' ? fill.activeField : null,
    selectorStep: typeof fill.selectorStep === 'string' ? fill.selectorStep : null,
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
  let fillPending = false;
  let hooksRestored = false;

  async function finishSession(session) {
    if (!session) return;
    // A CDP timeout does not abort the page's async writer. Leave its guards
    // installed until the operator reloads; never restore around pending work.
    if (fillPending || fill && cancel?.closed !== true) {
      steps.push('retain_hooks');
      return;
    }
    try {
      await evaluate(session, 'globalThis.__gthEducationLive && globalThis.__gthEducationLive.restore()', {
        timeoutMs: stepTimeoutMs,
        step: 'restore_hooks'
      });
      steps.push('restore_hooks');
      hooksRestored = true;
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
            fillPending = true;
            fill = await evaluate(
              session,
              `globalThis.ResumeGthEducationTextTrial.fullTrial(${JSON.stringify(request)})`,
              { timeoutMs: stepTimeoutMs, step: 'fill_education', awaitPromise: true }
            );
            fillPending = false;
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
      expected: expectedReadback(env),
      trialReason: fill?.reason || reason
    });
  const traffic = partitionTraffic([...(Array.isArray(pagePosts) ? pagePosts : []), ...cdpPosts]);
  if (!clicksAreDiscardOnly(clicks)) bannedClick = true;
  cancelsOk = cancel?.closed === true && clicksAreDiscardOnly(clicks);
  const fieldMiss = fields.find((row) => (fillQuestions.includes(row.q) || FILL_QUESTIONS.includes(row.q)) && row.status !== 'verified');
  const auditComplete = !['read_posts_failed', 'read_clicks_failed', 'network_enable_skipped'].some(step => steps.includes(step));
  if (bannedClick) reason = 'refusing_forbidden_click';
  else if (traffic.saveLikePost.length && !reason) reason = 'disallowed_non_get';
  else if (!reason && fill?.ok !== true) reason = fill?.reason || 'trial_failed';
  else if (!reason && fieldMiss) reason = fieldMiss.reason || 'control_not_supported';
  else if (!reason && !auditComplete) reason = 'audit_incomplete';
  else if (!reason && !unclaimedStayUnclaimed(fields, fillQuestions)) reason = 'control_not_supported';
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
      auditComplete,
      fillMayBeRunning: fillPending,
      hooksRestored,
      request,
      readbackExpected: Object.fromEntries(fillQuestions.map((question) => [question, expectedReadback(env)[question]])),
      inspect,
      fill: publicFill(fill),
      read: read ? {
        ok: read.ok === true,
        reason: read.reason || null,
        extraLabels: read.extraLabels || [],
        unlabeled: read.unlabeled || 0,
        readback: read.readback || []
      } : null,
      cancel,
      unfilled: fields.filter((row) => row.status !== 'verified').map((row) => ({ q: row.q, reason: row.reason })),
      fillQuestions,
      limits: [
        'Open belongs to ResumeGthEducationTextTrial.fullTrial in src/content/gth-education.js. Existing mode clicks the one visible a inside .sec-context > .sec-detail that contains .el-icon-edit-outline. New mode clicks the one visible .title_ a.h-e-btn whose text is 添加 or 新增. This runner does not click a title link whose text is 编辑. That missing title 编辑 is why the full-resume harness stopped at edit_not_found.',
        'Plain facts retain the prior trial defaults. Complex facts require FIELDS plus explicit environment values. Missing or ambiguous runtime DOM is control_not_supported with diagnostics; synthetic offline fixtures are not live evidence.',
        'The page hook allows scoped editor, radio and armed picker actions. Only a validated category panel-local inert 确定 is permitted; form-level 确定, 保存, 提交, 投递, 删除, navigation and submit controls are refused.',
        'Instrumented page fetch/XHR/beacon non-GET calls and form submits are blocked. CDP-observed non-GET traffic also fails the run; CDP observation itself is not request interception. There is no dictionary allowlist.',
        '取消 is the one visible button whose type is button and whose text is 取消 inside the education form. The runner clicks it after the trial and does not click 保存.',
        'The shipped fill compares location.href with https://hr.gtht.com/resume/edit/ exactly. A hash or query is wrong_page.',
        'Guards remain installed if the writer may still be running or cancellation is unconfirmed. Reload the tab manually before retrying such a run. liveSupportClaimed stays false; offline fixtures do not establish live support.'
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
