#!/usr/bin/env node
/**
 * Explicitly invoked, inert CMS row D CDP probe. No fill adapter is installed.
 * Network/Fetch guards are mandatory; even a blocked non-GET fails the run.
 * The merged inspector never opens, focuses, blurs, emits events, reads current
 * values, or mutates controls. Originals therefore need no restoration writes.
 * See cms-row-d-live.md. No live PASS/support claim; booked remains 53.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { connectCdp, getJson } from '../../tools/live-harvest/cdp-client.mjs';
import {
  ROW_D_FIELDS, ROW_D_PAGE, buildCmsRowDOptionsProbeExpression
} from '../lib/cms-row-d-options.mjs';

export const ROW_D_LIVE_BASE_TIP = '53791dfe6da2a6ae2b627b8e9b945ca0d411fefc';
export const EVIDENCE_NAME = 'cms-row-d-live.json';
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const safety = () => ({ neverSave: true, liveSupportClaimed: false,
  writeStarted: false, mutationAllowed: false, valuesExposed: false });
const validPort = port => Number.isInteger(port) && port >= 1 && port <= 65535;
const inside = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`);
};

/** Reject lexical escapes AND existing junction/symlink escapes before writes. */
export function rowDTemporaryPath(raw, root = repoRoot, cwd = process.cwd()) {
  if (typeof raw !== 'string' || !raw.trim()) throw new TypeError('temporary_path_invalid');
  const allowed = path.join(fs.realpathSync(root), '_temp-scripts');
  const candidate = path.resolve(cwd, raw);
  if (!inside(allowed, candidate)) throw new TypeError('temporary_path_invalid');
  let ancestor = candidate;
  const suffix = [];
  while (!fs.existsSync(ancestor)) {
    const parent = path.dirname(ancestor);
    if (parent === ancestor) throw new TypeError('temporary_path_invalid');
    suffix.unshift(path.basename(ancestor));
    ancestor = parent;
  }
  if (!inside(allowed, path.resolve(fs.realpathSync(ancestor), ...suffix))) {
    throw new TypeError('temporary_path_invalid');
  }
  return candidate;
}

export function readRowDProbeConfig(env = process.env, root = repoRoot, cwd = process.cwd()) {
  const portText = env.PORT || '9242';
  const timeoutText = env.STEP_TIMEOUT_MS || '10000';
  if (typeof portText !== 'string' || !/^\d{1,5}$/u.test(portText) || !validPort(Number(portText))) {
    throw new TypeError('config_invalid');
  }
  if (typeof timeoutText !== 'string' || !/^\d+$/u.test(timeoutText)
    || Number(timeoutText) < 1000 || Number(timeoutText) > 30000) throw new TypeError('config_invalid');
  const outDir = rowDTemporaryPath(env.OUTDIR || path.join(root, '_temp-scripts/cms-row-d-live-never-save'), root, cwd);
  let requests = {};
  if (env.REQUESTS_FILE) {
    const input = rowDTemporaryPath(env.REQUESTS_FILE, root, cwd);
    if (!fs.statSync(input).isFile() || fs.statSync(input).size > 32768) throw new TypeError('config_invalid');
    requests = JSON.parse(fs.readFileSync(input, 'utf8'));
  }
  buildCmsRowDOptionsProbeExpression(requests); // Fixed-error validation, before CDP attachment.
  return { port: Number(portText), timeoutMs: Number(timeoutText), outDir, requests };
}

export function selectRowDTarget(targets, port) {
  if (!Array.isArray(targets) || !validPort(port)) return { ok: false, reason: 'targets_invalid' };
  const matches = targets.filter(target => {
    if (target?.type !== 'page' || typeof target.url !== 'string') return false;
    try {
      const url = new URL(target.url);
      return !url.username && !url.password && `${url.origin}${url.pathname}` === ROW_D_PAGE;
    } catch { return false; }
  });
  if (matches.length !== 1) return { ok: false, reason: matches.length ? 'target_ambiguous' : 'target_missing' };
  const target = matches[0];
  try {
    const ws = new URL(target.webSocketDebuggerUrl);
    if (ws.protocol !== 'ws:' || !['127.0.0.1', 'localhost', '[::1]'].includes(ws.hostname)
      || Number(ws.port) !== port || ws.username || ws.password || ws.search || ws.hash
      || typeof target.id !== 'string' || !target.id || ws.pathname !== `/devtools/page/${target.id}`) {
      return { ok: false, reason: 'target_socket_invalid' };
    }
  } catch { return { ok: false, reason: 'target_socket_invalid' }; }
  // This internal result is never serialized into evidence (it contains URLs).
  return { ok: true, target };
}

function trafficIdentity(request) {
  const rawMethod = typeof request?.method === 'string' ? request.method.toUpperCase() : '';
  const method = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'CONNECT', 'TRACE']
    .includes(rawMethod) ? rawMethod : 'UNKNOWN';
  let infoEdit = false;
  try {
    const pathname = decodeURIComponent(new URL(request?.url).pathname).toLowerCase();
    infoEdit = /\/resume\/info\/edit(?:\/|$)/u.test(pathname);
  } catch { /* no raw URL */ }
  return { method, infoEdit, endpoint: infoEdit ? '/resume/info/edit' : 'other' };
}

/**
 * CDP callbacks must not throw: connectCdp deliberately swallows observer errors.
 * Record command failures explicitly and drain all replies before teardown.
 * requestWillBeSent is an observation, NOT proof that bytes reached the server.
 */
export function createRowDNetworkGuard(send) {
  const pending = new Set();
  const observed = new Map();
  const traffic = { observedNonGetCount: 0, interceptedNonGetCount: 0,
    blockedNonGetCount: 0, infoEditObservedCount: 0, infoEditBlockedCount: 0,
    responseToNonGetCount: 0, commandFailed: false, truncated: false, records: [] };
  const record = (phase, identity) => {
    if (traffic.records.length < 200) traffic.records.push({ phase, ...identity });
    else traffic.truncated = true;
  };
  function command(method, params, identity) {
    let reply;
    try { reply = send(method, params); }
    catch { reply = Promise.reject(new Error('guard_command_failed')); }
    const task = Promise.resolve(reply).then(() => {
      if (method === 'Fetch.failRequest') {
        traffic.blockedNonGetCount += 1;
        if (identity.infoEdit) traffic.infoEditBlockedCount += 1;
        record('blocked', identity);
      }
    }, () => {
      traffic.commandFailed = true;
      if (identity) record('block_failed', identity);
    });
    pending.add(task);
    void task.then(() => pending.delete(task));
  }
  const onEvent = message => {
    try {
      const params = message?.params || {};
      if (message?.method === 'Fetch.requestPaused') {
        const identity = trafficIdentity(params.request);
        if (identity.method === 'GET') command('Fetch.continueRequest', { requestId: params.requestId });
        else {
          traffic.interceptedNonGetCount += 1;
          record('paused', identity);
          command('Fetch.failRequest', { requestId: params.requestId, errorReason: 'BlockedByClient' }, identity);
        }
      } else if (message?.method === 'Network.requestWillBeSent') {
        const identity = trafficIdentity(params.request);
        // Redirects reuse requestId. A later GET response must not be reported
        // as a response to the preceding POST.
        observed.delete(params.requestId);
        if (identity.method !== 'GET') {
          traffic.observedNonGetCount += 1;
          if (identity.infoEdit) traffic.infoEditObservedCount += 1;
          // The bounded map only correlates response events; raw URLs/bodies are discarded.
          if (observed.size < 200) observed.set(params.requestId, identity);
          else traffic.truncated = true;
          record('observed', identity);
        }
      } else if (message?.method === 'Network.responseReceived' && observed.has(params.requestId)) {
        traffic.responseToNonGetCount += 1;
        record('response_observed', observed.get(params.requestId));
      } else if (['Network.loadingFinished', 'Network.loadingFailed'].includes(message?.method)) {
        observed.delete(params.requestId);
      }
    } catch { traffic.commandFailed = true; }
  };
  return { onEvent, traffic,
    async drain() {
      for (let round = 0; pending.size && round < 20; round += 1) await Promise.all([...pending]);
      if (pending.size) traffic.commandFailed = true;
    },
    failed: () => traffic.commandFailed || traffic.truncated
      || traffic.observedNonGetCount > 0 || traffic.interceptedNonGetCount > 0
  };
}

const INSPECTION_REASONS = new Set([
  'no_document', 'wrong_page', 'page_hidden', 'page_not_ready', 'requests_type_invalid',
  'unknown_request_field', 'calendar_live_evidence_missing', 'section_not_unique_or_visible',
  'wrapper_not_unique', 'wrapper_scope_or_visibility_mismatch', 'label_mismatch',
  'question_not_unique', 'control_ownership_mismatch', 'control_kind_mismatch',
  'control_not_unique', 'control_not_available', 'dropdown_reference_missing_or_ambiguous',
  'dropdown_owner_not_unique', 'current_options_unavailable', 'dropdown_target_not_unique',
  'dropdown_scope_mismatch', 'option_ownership_mismatch', 'option_not_available',
  'option_list_ambiguous', 'option_dictionary_mismatch', 'reused_dictionary_unverified',
  'option_dictionary_incomplete', 'read_only_options_preflight', 'read_only_preflight',
  'row_d_preflight_incomplete', 'document_read_failed', 'unknown_field',
  'request_type_invalid', 'request_empty', 'duplicate_option', 'option_unknown'
]);
const INSPECTION_TOP_REASONS = new Set([
  'no_document', 'wrong_page', 'page_hidden', 'page_not_ready', 'requests_type_invalid',
  'unknown_request_field', 'read_only_preflight', 'row_d_preflight_incomplete', 'document_read_failed'
]);

/** Copy allowlisted metadata only; never serialize arbitrary Runtime results. */
function cleanInspection(value) {
  const safeFlags = row => Object.entries(safety()).every(([key, expected]) => row?.[key] === expected);
  if (!safeFlags(value) || typeof value.ok !== 'boolean' || !INSPECTION_TOP_REASONS.has(value.reason)
    || !Array.isArray(value.fields) || value.fields.length > ROW_D_FIELDS.length
    || (value.reason !== 'document_read_failed' && value.fields.length !== ROW_D_FIELDS.length)) {
    throw new TypeError('inspection_invalid');
  }
  const fields = value.fields.map((row, index) => {
    const spec = ROW_D_FIELDS[index];
    if (!safeFlags(row) || row.wrapperId !== spec.wrapperId || row.key !== spec.key
      || row.sectionId !== spec.sectionId || row.controlKind !== spec.controlKind
      || typeof row.ok !== 'boolean' || !['observed', 'skipped'].includes(row.status)
      || !INSPECTION_REASONS.has(row.reason)) throw new TypeError('inspection_invalid');
    if (row.ok !== (row.status === 'observed')
      || row.ok !== (row.reason === 'read_only_options_preflight')
      || (row.reason === 'calendar_live_evidence_missing' && spec.controlKind !== 'ant-calendar-picker')
      || (row.ok && (!spec.optionsComplete || spec.reusedFrom
        || spec.controlKind === 'ant-calendar-picker'))) throw new TypeError('inspection_invalid');
    return { ...safety(), key: spec.key, wrapperId: spec.wrapperId, sectionId: spec.sectionId,
      controlKind: spec.controlKind, ok: row.ok, status: row.status, reason: row.reason,
      optionsComplete: spec.optionsComplete, evidenceSource: spec.evidenceSource,
      ...(spec.reusedFrom ? { independentOptionsEvidence: false, reusedFrom: spec.reusedFrom } : {}) };
  });
  const complete = fields.length === ROW_D_FIELDS.length
    && fields.every(row => row.ok || row.reason === 'calendar_live_evidence_missing');
  if (value.ok !== complete || (value.reason === 'read_only_preflight') !== complete) {
    throw new TypeError('inspection_invalid');
  }
  return { ok: value.ok, reason: value.reason, fields };
}

export function rowDProbeEvidence(reason = 'not_started') {
  return { version: 1, kind: 'cms_row_d_live_never_save_probe', ...safety(),
    baseTip: ROW_D_LIVE_BASE_TIP, livePassClaimed: false, booked: 53, probeOnly: true,
    probeCompleted: false, ok: false, reason, restoration: 'not_needed_no_interaction', fields: [] };
}

/** Test dependencies are explicit. Importing this module never attaches. */
export async function runCmsRowDLive({ port = 9242, timeoutMs = 10000, requests = {},
  getTargets = getJson, connect = connectCdp, wait = delay } = {}) {
  const evidence = rowDProbeEvidence();
  let expression;
  try {
    if (!validPort(port) || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 30000) {
      throw new TypeError('config_invalid');
    }
    expression = buildCmsRowDOptionsProbeExpression(requests);
  } catch { evidence.reason = 'config_invalid'; return evidence; }
  let session;
  let fetchEnabled = false;
  let networkEnabled = false;
  let stage = 'target_discovery';
  const guard = createRowDNetworkGuard((method, params) => session.send(method, params));
  try {
    const choice = selectRowDTarget(await getTargets(port, '/json/list', { timeoutMs, step: stage }), port);
    if (!choice.ok) { evidence.reason = choice.reason; return evidence; }
    stage = 'connect';
    session = await connect(choice.target.webSocketDebuggerUrl, { timeoutMs, step: stage, onEvent: guard.onEvent });
    stage = 'network_guard';
    await session.send('Network.enable');
    networkEnabled = true;
    await session.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
    fetchEnabled = true;
    await guard.drain();
    if (guard.failed()) { evidence.reason = 'non_get_or_guard_failure'; return evidence; }
    stage = 'inspection';
    const reply = await session.send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: false, userGesture: false,
      // CDP rejects attempted side effects as a second boundary around the
      // source-audited read-only inspector. There is no retry without this.
      throwOnSideEffect: true, timeout: timeoutMs
    });
    if (reply?.exceptionDetails) { evidence.reason = 'inspection_exception'; return evidence; }
    const inspection = cleanInspection(reply?.result?.value);
    evidence.fields = inspection.fields;
    evidence.probeCompleted = true;
    evidence.ok = inspection.ok;
    evidence.reason = inspection.reason;
    stage = 'settlement';
    await wait(250); // Monitoring window only; not a restoration/support assertion.
    await guard.drain();
  } catch {
    // CDP exception strings may contain page values, queries or remote URLs.
    evidence.ok = false;
    evidence.reason = `${stage}_failed`;
  } finally {
    if (session) {
      await guard.drain();
      // No interaction was induced. Restore only the CDP domains enabled by
      // this session, after all known paused requests received their decisions.
      if (fetchEnabled) {
        try { await session.send('Fetch.disable'); } catch { guard.traffic.commandFailed = true; }
      }
      await guard.drain();
      if (networkEnabled) {
        try { await session.send('Network.disable'); } catch { guard.traffic.commandFailed = true; }
      }
      await guard.drain();
      try { session.close(); } catch { guard.traffic.commandFailed = true; }
    }
    evidence.traffic = guard.traffic;
    if (guard.failed()) {
      evidence.ok = false;
      evidence.reason = 'non_get_or_guard_failure';
    }
  }
  return evidence;
}

export const HELP = `Usage: node scripts/live/cms-row-d-live.mjs
Inert Never-Save row D CDP probe. No open/fill/Save/submit, no value reads.
neverSave=true liveSupportClaimed=false writeStarted=false mutationAllowed=false
No live PASS claimed until parent runs real CDP Never-Save. Booked stays 53.
PORT defaults to 9242; STEP_TIMEOUT_MS defaults to 10000 (1000..30000).
OUTDIR defaults to repo/_temp-scripts/cms-row-d-live-never-save.
REQUESTS_FILE optionally names JSON wrapper IDs -> harvested labels/checkbox array.
OUTDIR and REQUESTS_FILE must stay within repo/_temp-scripts, including symlinks.
Evidence: ${EVIDENCE_NAME}. Exit 0: complete read-only preflight; 2: incomplete/error.
Known location/industry/calendar evidence gaps remain skips. See cms-row-d-live.md.
`;

export async function main(args = process.argv.slice(2), env = process.env) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    process.stdout.write(HELP);
    return 0;
  }
  let evidence;
  let config;
  try {
    if (args.length) throw new TypeError('arguments_invalid');
    config = readRowDProbeConfig(env);
    evidence = await runCmsRowDLive(config);
    // Recheck confinement immediately before mkdir/write as well as at config time.
    rowDTemporaryPath(config.outDir);
    fs.mkdirSync(config.outDir, { recursive: true });
    rowDTemporaryPath(path.join(config.outDir, EVIDENCE_NAME));
    fs.writeFileSync(path.join(config.outDir, EVIDENCE_NAME), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  } catch {
    evidence ||= rowDProbeEvidence('config_invalid');
    if (config) { evidence.ok = false; evidence.reason = 'evidence_write_failed'; }
  }
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
  return evidence.ok ? 0 : 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
