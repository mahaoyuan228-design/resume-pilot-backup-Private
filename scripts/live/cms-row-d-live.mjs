#!/usr/bin/env node
/**
 * Explicitly invoked, inert CMS row D CDP probe. No fill adapter is installed.
 * Network/Fetch guards are mandatory; only correlated keeper info/edit blocks
 * may preserve the inspection verdict. Every non-GET is still aborted.
 * The merged inspector never opens, focuses, blurs, emits events, reads current
 * values, or mutates controls. Originals therefore need no restoration writes.
 * No live PASS/support claim. Parent accepted PASS_PREFLIGHT/bookD at 575abee8;
 * the existing booked total stays 70. This runner makes no acceptance decision.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { connectCdp, getJson } from '../../tools/live-harvest/cdp-client.mjs';
import {
  ROW_D_FIELDS, ROW_D_PAGE, buildCmsRowDOptionsProbeExpression
} from '../lib/cms-row-d-options.mjs';

export const ROW_D_LIVE_BASE_TIP = '23c0ce54b759aa1fc42516ecaf7c851bd63e785c';
// Evidence uses a normalized endpoint label; eligibility uses the recorded
// tenant endpoint. Never use the redacted label or a suffix match as authority.
const rowDPage = new URL(ROW_D_PAGE);
const rowDInfoEditPath = `/wecruit/resume/info/edit/${rowDPage.pathname.split('/')[1]}`;
export const EVIDENCE_NAME = 'cms-row-d-live.json';
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const safety = () => ({ neverSave: true, liveSupportClaimed: false,
  livePassClaimed: false, writeStarted: false, mutationAllowed: false,
  valuesExposed: false, probeOnly: true });
const validPort = port => Number.isInteger(port) && port >= 1 && port <= 65535;
const validOptionsWait = value => Number.isInteger(value) && value >= 0 && value <= 5000;
const validOptionsPoll = value => Number.isInteger(value) && value >= 25 && value <= 500;
// Error text is inspected locally, never copied into evidence.
function commandFailureKind(error) {
  if (error?.reason === 'timeout' || error?.name === 'StepTimeoutError') return 'timeout';
  const message = typeof error?.message === 'string' ? error.message : '';
  if (/Invalid InterceptionId\b/iu.test(message)) return 'invalid_interception_id';
  if (message === 'cdp_socket_closed') return 'socket_closed';
  return 'command_rejected';
}
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
  const optionsWaitText = env.OPTIONS_WAIT_MS ?? '2000';
  const optionsPollText = env.OPTIONS_POLL_MS ?? '100';
  if (typeof portText !== 'string' || !/^\d{1,5}$/u.test(portText) || !validPort(Number(portText))) {
    throw new TypeError('config_invalid');
  }
  if (typeof timeoutText !== 'string' || !/^\d+$/u.test(timeoutText)
    || Number(timeoutText) < 1000 || Number(timeoutText) > 30000) throw new TypeError('config_invalid');
  if (typeof optionsWaitText !== 'string' || !/^\d+$/u.test(optionsWaitText)
    || !validOptionsWait(Number(optionsWaitText))
    || typeof optionsPollText !== 'string' || !/^\d+$/u.test(optionsPollText)
    || !validOptionsPoll(Number(optionsPollText))) throw new TypeError('config_invalid');
  const outDir = rowDTemporaryPath(env.OUTDIR || path.join(root, '_temp-scripts/cms-row-d-live-never-save'), root, cwd);
  let requests = {};
  if (env.REQUESTS_FILE) {
    const input = rowDTemporaryPath(env.REQUESTS_FILE, root, cwd);
    if (!fs.statSync(input).isFile() || fs.statSync(input).size > 32768) throw new TypeError('config_invalid');
    requests = JSON.parse(fs.readFileSync(input, 'utf8'));
  }
  buildCmsRowDOptionsProbeExpression(requests); // Fixed-error validation, before CDP attachment.
  return { port: Number(portText), timeoutMs: Number(timeoutText),
    optionsWaitMs: Number(optionsWaitText), optionsPollMs: Number(optionsPollText), outDir, requests };
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
  const waiters = new Set();
  const notify = () => { for (const wake of waiters) wake(); };
  // Internal IDs only: never serialize correlation metadata or raw URLs.
  // Retain the bounded ledger after loadingFailed; failure alone proves no block.
  const requests = new Map();
  // Fetch.networkId is optional in CDP. A single id-less pause may be paired
  // by exact identity with one Network observation, never by counts alone.
  // Move this same entry object so an outstanding abort ack retains its target.
  const unlinkedPauseId = Symbol('unlinked_fetch_pause');
  let missingFetchNetworkId = false;
  const fetchIds = new Map();
  const earlyResponses = new Set();
  let keeperActive = false;
  let correlationFailed = false;
  let settlementDeadline;
  let settlementRounds = 0;
  let settlementEvents = 0;
  let settlementStopped;
  const rejections = new Set();
  const rejectCorrelation = reason => { correlationFailed = true; rejections.add(reason); };
  const traffic = { observedNonGetCount: 0, interceptedNonGetCount: 0,
    blockedNonGetCount: 0, infoEditObservedCount: 0, infoEditBlockedCount: 0,
    responseToNonGetCount: 0, commandFailed: false, truncated: false, records: [],
    commandFailures: [] };
  const commandFailure = (method, error, ignored = false) => {
    if (traffic.commandFailures.length < 20) traffic.commandFailures.push({
      method, reason: commandFailureKind(error), ignored });
    else traffic.truncated = true;
    if (!ignored) traffic.commandFailed = true;
  };
  const record = (phase, identity) => {
    if (traffic.records.length < 200) traffic.records.push({ phase, ...identity });
    else traffic.truncated = true;
  };
  const validId = id => typeof id === 'string' && id.length > 0 && id.length <= 1024;
  function track(phase, id, request, identity) {
    const idlessPause = phase === 'paused' && id === undefined;
    if (!idlessPause && !validId(id)) {
      rejectCorrelation('network_id_missing_or_invalid'); return undefined;
    }
    let eligible = false;
    let urlHash;
    try {
      const url = new URL(request.url);
      urlHash = createHash('sha256').update(url.href).digest('hex');
      const exactEndpoint = url.origin === rowDPage.origin
        && url.pathname === rowDInfoEditPath && !url.username && !url.password && !url.hash;
      eligible = keeperActive && identity.method === 'POST' && exactEndpoint;
      if (!keeperActive) rejections.add('outside_keeper');
      if (identity.method !== 'POST') rejections.add('method_ineligible');
      if (!exactEndpoint) rejections.add('endpoint_ineligible');
    } catch { rejections.add('endpoint_ineligible'); }
    if (idlessPause) {
      missingFetchNetworkId = true;
      id = unlinkedPauseId;
      if (requests.size === 1) {
        const [networkId, candidate] = requests.entries().next().value;
        if (candidate.observed && !candidate.paused && candidate.eligible && eligible
          && candidate.identity.method === identity.method && candidate.urlHash === urlHash) id = networkId;
      }
    } else if (phase === 'observed' && requests.size === 1 && requests.has(unlinkedPauseId)) {
      const candidate = requests.get(unlinkedPauseId);
      if (!candidate.observed && candidate.eligible && eligible
        && candidate.identity.method === identity.method && candidate.urlHash === urlHash) {
        requests.delete(unlinkedPauseId);
        requests.set(id, candidate);
      }
    }
    let entry = requests.get(id);
    if (!entry) {
      if (requests.size >= 200) { traffic.truncated = true; return undefined; }
      entry = { identity, urlHash, eligible, observed: false, paused: false, blocked: false, responded: false };
      requests.set(id, entry);
    }
    if (entry[phase]) rejectCorrelation('duplicate_network_phase');
    if (entry.identity.method !== identity.method || entry.urlHash !== urlHash) rejectCorrelation('request_identity_conflict');
    entry.eligible &&= eligible;
    entry[phase] = true;
    if (earlyResponses.has(id)) response(entry);
    return entry;
  }
  const response = entry => {
    if (entry && !entry.responded) {
      entry.responded = true;
      traffic.responseToNonGetCount += 1;
      record('response_observed', entry.identity);
    }
  };
  const responseFor = id => {
    const entry = observed.get(id);
    if (entry) response(entry);
    // Redirected GET responses must not be attributed to the old POST. Reuse
    // already fails correlation. Retain otherwise unknown IDs for event reordering.
    else if (!requests.has(id)) {
      if (!validId(id)) rejectCorrelation('network_id_missing_or_invalid');
      else if (earlyResponses.size < 200) earlyResponses.add(id);
      else traffic.truncated = true;
    }
  };
  function command(method, params, identity, entry) {
    let reply;
    try { reply = send(method, params); }
    catch (error) { reply = Promise.reject(error); }
    const task = Promise.resolve(reply).then(() => {
      if (method === 'Fetch.failRequest' && identity?.method !== 'GET') {
        if (entry) entry.blocked = true;
        traffic.blockedNonGetCount += 1;
        if (identity.infoEdit) traffic.infoEditBlockedCount += 1;
        record('blocked', identity);
      }
    }, error => {
      // Chromium can retire an interception before our decision arrives.
      // Do not retry a stale ID or claim an abort acknowledgement from it.
      // A non-GET without a successful block still fails the strict ledger.
      const retired = commandFailureKind(error) === 'invalid_interception_id';
      commandFailure(method, error, retired);
      if (identity?.method !== 'GET') record('block_failed', identity);
    });
    pending.add(task);
    void task.then(() => { pending.delete(task); notify(); });
  }
  const onEvent = message => {
    try {
      const params = message?.params || {};
      if (message?.method === 'Fetch.requestPaused') {
        const identity = trafficIdentity(params.request);
        const responseStage = params.responseStatusCode !== undefined || params.responseErrorReason !== undefined
          || params.responseHeaders !== undefined || params.responseStatusText !== undefined;
        let repeated = false;
        let priorWasGet = false;
        if (!validId(params.requestId)) rejectCorrelation('fetch_id_missing_or_invalid');
        else if (fetchIds.has(params.requestId)) {
          // One decision per interception, including while its ACK is pending.
          // Duplicate/conflicting evidence remains ineligible for preservation.
          repeated = true;
          priorWasGet = fetchIds.get(params.requestId) === 'GET';
          rejectCorrelation('duplicate_fetch_id');
        } else if (fetchIds.size < 200) fetchIds.set(params.requestId, identity.method);
        else traffic.truncated = true;
        if (identity.method === 'GET') {
          if (!repeated && validId(params.requestId)) {
            // An error-stage pause still requires resolution; failing it avoids
            // continuing an already failed response or leaving it stranded.
            command(params.responseErrorReason !== undefined ? 'Fetch.failRequest' : 'Fetch.continueRequest',
              { requestId: params.requestId,
                ...(params.responseErrorReason !== undefined ? { errorReason: 'BlockedByClient' } : {}) }, identity);
          }
        }
        else {
          traffic.interceptedNonGetCount += 1;
          record('paused', identity);
          const entry = track('paused', params.networkId, params.request, identity);
          if (entry && validId(params.networkId)) observed.set(params.networkId, entry);
          // A response-stage pause cannot establish request-stage prevention.
          if (params.redirectedRequestId !== undefined) rejectCorrelation('redirect_evidence');
          if (responseStage) {
            rejectCorrelation('response_stage_pause');
            if (params.responseStatusCode !== undefined) response(entry);
          }
          if ((!repeated || priorWasGet) && validId(params.requestId)) {
            if (priorWasGet) fetchIds.set(params.requestId, identity.method);
            command('Fetch.failRequest',
              { requestId: params.requestId, errorReason: 'BlockedByClient' }, identity, entry);
          }
        }
      } else if (message?.method === 'Network.requestWillBeSent') {
        const identity = trafficIdentity(params.request);
        // Redirect responses are server evidence for the preceding hop. Do not
        // mistake the later GET response for a response to its preceding POST.
        if (params.redirectResponse) {
          const preceding = observed.get(params.requestId);
          response(preceding);
          if (!preceding && identity.method !== 'GET') rejectCorrelation('unmatched_redirect');
        }
        const prior = requests.get(params.requestId);
        if (prior && (prior.observed || identity.method === 'GET')) rejectCorrelation('network_id_reused');
        observed.delete(params.requestId);
        if (identity.method !== 'GET') {
          traffic.observedNonGetCount += 1;
          if (identity.infoEdit) traffic.infoEditObservedCount += 1;
          const entry = track('observed', params.requestId, params.request, identity);
          if (entry) observed.set(params.requestId, entry);
          record('observed', identity);
        }
      } else if (['Network.responseReceived', 'Network.responseReceivedExtraInfo',
        'Network.responseReceivedEarlyHints', 'Network.dataReceived', 'Network.loadingFinished']
        .includes(message?.method)) {
        responseFor(params.requestId);
      }
    } catch (error) { commandFailure('event_observer', error); }
    finally {
      // Once optional-ID pairing is used, any second non-GET event makes the
      // identity inference ambiguous forever, including after inspection.
      if (missingFetchNetworkId && (traffic.observedNonGetCount > 1
        || traffic.interceptedNonGetCount > 1 || requests.size > 1)) {
        rejectCorrelation('missing_network_id_pair_ambiguous');
      }
      notify();
    }
  };
  function failed() {
    return traffic.commandFailed || traffic.truncated || correlationFailed
      || traffic.responseToNonGetCount > 0
      || traffic.observedNonGetCount !== requests.size
      || traffic.interceptedNonGetCount !== requests.size
      || [...requests.values()].some(entry => !entry.eligible
        || !entry.observed || !entry.paused || !entry.blocked);
  }
  const fatal = () => traffic.commandFailed || traffic.truncated || correlationFailed
    || traffic.responseToNonGetCount > 0 || [...requests.values()].some(entry => !entry.eligible);
  const pendingKinds = () => {
    const kinds = [];
    if ([...requests.values()].some(entry => !entry.observed)) kinds.push('network_observation_missing');
    if ([...requests.values()].some(entry => !entry.paused)) kinds.push('fetch_pause_missing');
    if ([...requests.values()].some(entry => entry.paused && !entry.blocked)) kinds.push('block_ack_pending');
    if (pending.size && !kinds.includes('block_ack_pending')) kinds.push('guard_decision_pending');
    return kinds;
  };
  return { onEvent, traffic,
    commandFailure,
    setKeeperActive(active) { keeperActive = active === true; notify(); },
    async drain() {
      for (let round = 0; pending.size && round < 20; round += 1) await Promise.all([...pending]);
      if (pending.size) traffic.commandFailed = true;
    },
    failed,
    hasPendingCommands: () => pending.size > 0,
    async settleKeeper(wait = delay) {
      const initial = this.assessment();
      const pendingAtStart = pendingKinds();
      const firstRound = settlementRounds;
      const firstEvent = settlementEvents;
      const finish = status => {
        if (['deadline_exceeded', 'event_limit_exceeded'].includes(status)) settlementStopped = status;
        return { status, ready: ['already_complete', 'settled'].includes(status),
          waitRounds: settlementRounds - firstRound, eventWakes: settlementEvents - firstEvent, pendingAtStart,
          initial, final: this.assessment() };
      };
      if (!keeperActive) return finish('inactive_keeper');
      if (fatal()) return finish('permanent_failure');
      if (settlementStopped) return finish(settlementStopped);
      if (!failed() && !pending.size) return finish('already_complete');
      // One total budget for this guard, never renewed by events/checkpoints.
      settlementDeadline ??= performance.now() + 250;
      while (settlementRounds < 10 && settlementEvents < 200) {
        const remaining = settlementDeadline - performance.now();
        if (remaining <= 0) break;
        let wake;
        const changed = new Promise(resolve => { wake = resolve; });
        waiters.add(wake);
        try {
          const tick = await Promise.race([wait(Math.min(25, remaining)).then(() => true), changed.then(() => false)]);
          if (tick) settlementRounds += 1;
          else settlementEvents += 1;
        }
        finally { waiters.delete(wake); }
        if (!keeperActive) return finish('inactive_keeper');
        if (fatal()) return finish('permanent_failure');
        // Evidence arriving beyond the deadline cannot authorize inspection.
        if (performance.now() > settlementDeadline) break;
        if (!failed() && !pending.size) return finish('settled');
      }
      return finish(settlementEvents >= 200 ? 'event_limit_exceeded' : 'deadline_exceeded');
    },
    // Fixed enums only: enough to diagnose redacted live failures without IDs,
    // raw URLs, query values, bodies, or hashes. This never supplies authority.
    assessment() {
      const reasons = new Set(rejections);
      if (traffic.commandFailed) reasons.add('guard_command_failed');
      if (traffic.truncated) reasons.add('tracking_truncated');
      if (traffic.responseToNonGetCount > 0) reasons.add('response_evidence');
      if (traffic.observedNonGetCount !== requests.size
        || traffic.interceptedNonGetCount !== requests.size
        || [...requests.values()].some(entry => !entry.observed || !entry.paused)) reasons.add('network_fetch_unmatched');
      if ([...requests.values()].some(entry => !entry.blocked)) reasons.add('block_unacknowledged');
      return { status: failed() ? 'rejected' : requests.size ? 'correlated_keeper_blocks' : 'no_non_get',
        reasons: [...reasons].sort(),
        ...(missingFetchNetworkId ? { correlationMode: 'unique_identity_missing_fetch_network_id' } : {}) };
    }
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
  'option_dictionary_incomplete', 'read_only_options_preflight', 'read_only_calendar_preflight',
  'read_only_location_preflight', 'read_only_preflight',
  'row_d_preflight_incomplete', 'document_read_failed', 'unknown_field',
  'request_type_invalid', 'request_empty', 'duplicate_option', 'option_unknown'
]);
const INSPECTION_TOP_REASONS = new Set([
  'no_document', 'wrong_page', 'page_hidden', 'page_not_ready', 'requests_type_invalid',
  'unknown_request_field', 'read_only_preflight', 'row_d_preflight_incomplete', 'document_read_failed'
]);
const AVAILABILITY_ISSUES = new Set([
  'collapsed_ancestor', 'disabled_attribute_or_class', 'hidden_control', 'hidden_non_search_input',
  'location_host_unavailable'
]);
const CONTROL_KIND_ISSUES = new Set([
  'conflicting_picker', 'unexpected_interactive_control', 'select_not_unique',
  'mixed_choice_controls', 'input_outside_select', 'unexpected_input_kind', 'location_host_structure_unverified'
]);
const OPTIONS_DEFINITION_ISSUES = new Set([
  'root_anchor_missing', 'current_root_unverified', 'current_chain_unverified',
  'select_component_unrecognized', 'current_props_unverified', 'loading',
  'select_mode_unsupported', 'search_filter_unsupported', 'option_render_unsupported',
  'aria_binding_unverified', 'option_shape_unsupported', 'option_text_unsupported',
  'option_text_ambiguous', 'definition_data_unavailable'
]);
const ENUMERATED_OPTIONS_REASONS = new Set([
  'option_list_ambiguous', 'option_dictionary_mismatch', 'reused_dictionary_unverified',
  'option_dictionary_incomplete', 'read_only_options_preflight', 'request_type_invalid',
  'request_empty', 'duplicate_option', 'option_unknown', 'read_only_location_preflight'
]);
const LOCATION_PROOF_REASONS = new Set([...ENUMERATED_OPTIONS_REASONS,
  'control_kind_mismatch', 'control_not_unique', 'control_not_available',
  'dropdown_reference_missing_or_ambiguous', 'dropdown_owner_not_unique',
  'current_options_unavailable', 'dropdown_target_not_unique', 'dropdown_scope_mismatch',
  'option_ownership_mismatch', 'option_not_available'
]);
const CALENDAR_DEFINITION_ISSUES = new Set([
  'calendar_owner_unverified', 'current_root_unverified', 'current_chain_unverified',
  'current_props_unverified', 'root_anchor_missing', 'month_component_unrecognized',
  'calendar_props_unsupported', 'calendar_reference_ambiguous',
  'calendar_portal_owner_unverified', 'calendar_portal_ambiguous', 'calendar_portal_hidden',
  'calendar_panel_shape_unsupported', 'calendar_open_state_mismatch', 'calendar_format_missing',
  'calendar_data_unavailable'
]);
const CALENDAR_METADATA = new Set([
  'calendarStructureObserved', 'calendarFramework', 'calendarEvidenceSource',
  'calendarPickerKind', 'calendarFormat', 'calendarMode', 'calendarOpen',
  'calendarPanelKind', 'calendarCellCount', 'calendarDefinitionIssue'
]);

// New compound-control evidence is a fixed own-data envelope. Unknown fields,
// getters, sparse arrays and current-value payloads cannot become provenance.
function ownInspectionData(value, name) {
  const descriptor = Object.getOwnPropertyDescriptor(value, name);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw new TypeError('inspection_invalid');
  return descriptor.value;
}
function exactInspectionData(value, names) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Reflect.ownKeys(value).length !== names.length
    || Reflect.ownKeys(value).some(name => typeof name !== 'string' || !names.includes(name))) {
    throw new TypeError('inspection_invalid');
  }
  const result = {};
  for (const name of names) result[name] = ownInspectionData(value, name);
  return result;
}
function cleanLocationComposite(value) {
  const result = exactInspectionData(value, ['hostCount', 'cascaderCount', 'hostsArePeers',
    'cascaderOwnsBoth', 'hostsNearestCascaderSame', 'optionsHostSlot', 'hosts']);
  if (result.hostCount !== 2 || result.cascaderCount !== 1 || result.hostsArePeers !== true
    || result.cascaderOwnsBoth !== true || result.hostsNearestCascaderSame !== true
    || result.optionsHostSlot !== 0 || !Array.isArray(result.hosts)
    || ownInspectionData(result.hosts, 'length') !== 2
    || Reflect.ownKeys(result.hosts).length !== 3) throw new TypeError('inspection_invalid');
  result.hosts = [0, 1].map(slot => {
    const host = exactInspectionData(ownInspectionData(result.hosts, String(slot)), [
      'hostSlot', 'comboOwned', 'selectionIsCombo', 'inputOwned', 'inputWithinCombo',
      'inputSearchHelper', 'attributeAvailable', 'ariaOwnerCount', 'referenceCount',
      'ariaBindingObserved', 'listState']);
    if (host.hostSlot !== slot || host.ariaOwnerCount !== 1 || host.referenceCount !== 1
      || !['comboOwned', 'selectionIsCombo', 'inputOwned', 'inputWithinCombo',
        'inputSearchHelper', 'attributeAvailable', 'ariaBindingObserved'].every(name => host[name] === true)
      || !['target_missing', 'linked_structure_observed'].includes(host.listState)) {
      throw new TypeError('inspection_invalid');
    }
    return host;
  });
  return result;
}

/** Copy allowlisted metadata only; never serialize arbitrary Runtime results. */
function cleanInspection(value) {
  const safeFlags = row => Object.entries(safety()).every(([key, expected]) => row?.[key] === expected);
  if (!safeFlags(value) || value.visibilityBasis !== 'attributes_only'
    || typeof value.ok !== 'boolean' || !INSPECTION_TOP_REASONS.has(value.reason)
    || !Array.isArray(value.fields) || value.fields.length > ROW_D_FIELDS.length
    || (value.reason !== 'document_read_failed' && value.fields.length !== ROW_D_FIELDS.length)) {
    throw new TypeError('inspection_invalid');
  }
  const fields = value.fields.map((row, index) => {
    const spec = ROW_D_FIELDS[index];
    const location = ['firstWorkLocation', 'secondWorkLocation'].includes(spec.key);
    const locationSuccess = row.reason === 'read_only_location_preflight';
    const calendarSuccess = row.reason === 'read_only_calendar_preflight';
    const optionsSuccess = row.reason === 'read_only_options_preflight';
    if (!safeFlags(row) || row.wrapperId !== spec.wrapperId || row.key !== spec.key
      || row.sectionId !== spec.sectionId || row.controlKind !== spec.controlKind
      || typeof row.ok !== 'boolean' || !['observed', 'skipped'].includes(row.status)
      || !INSPECTION_REASONS.has(row.reason)) throw new TypeError('inspection_invalid');
    if (row.ok !== (row.status === 'observed')
      || row.ok !== (optionsSuccess || locationSuccess || calendarSuccess)
      || (row.reason === 'calendar_live_evidence_missing' && spec.controlKind !== 'ant-calendar-picker')
      || (optionsSuccess && (!spec.optionsComplete || spec.reusedFrom
        || spec.controlKind === 'ant-calendar-picker'))
      || (locationSuccess && !location)
      || (calendarSuccess && spec.key !== 'englishExamDate')) throw new TypeError('inspection_invalid');
    if ((Object.hasOwn(row, 'optionsComplete') && row.optionsComplete !== spec.optionsComplete)
      || (Object.hasOwn(row, 'evidenceSource') && row.evidenceSource !== spec.evidenceSource)) {
      throw new TypeError('inspection_invalid');
    }
    const metadata = {};
    const optional = (name, valid) => {
      if (!Object.hasOwn(row, name)) return;
      const entry = ownInspectionData(row, name);
      if (!valid(entry)) throw new TypeError('inspection_invalid');
      metadata[name] = entry;
    };
    const count = (number, maximum) => Number.isSafeInteger(number) && number >= 0 && number <= maximum;
    optional('hiddenSearchInputCount', number => spec.controlKind === 'ant-select' && count(number, 1));
    optional('observedOptionCount', number => spec.controlKind !== 'ant-calendar-picker' && count(number, 10000));
    optional('optionsReadiness', status => spec.controlKind === 'ant-select'
      && (['target_missing', 'list_empty'].includes(status)
        ? row.reason === 'current_options_unavailable'
          || (['owned_select_vnodes', 'owned_react_props'].includes(row.optionsEvidenceSource) && row.observedOptionCount > 0
            && ENUMERATED_OPTIONS_REASONS.has(row.reason))
        : status === 'loading'
          ? row.reason === 'current_options_unavailable'
            && !Object.hasOwn(row, 'observedOptionCount') && !Object.hasOwn(row, 'optionsEvidenceSource')
          : status === 'observed' && (ENUMERATED_OPTIONS_REASONS.has(row.reason)
            || ['option_ownership_mismatch', 'option_not_available'].includes(row.reason))));
    optional('optionsDefinitionIssue', issue => spec.controlKind === 'ant-select'
      && row.reason === 'current_options_unavailable'
      && ['target_missing', 'list_empty'].includes(row.optionsReadiness)
      && !Object.hasOwn(row, 'observedOptionCount') && !Object.hasOwn(row, 'optionsEvidenceSource')
      && OPTIONS_DEFINITION_ISSUES.has(issue));
    optional('optionsEvidenceSource', source => spec.controlKind === 'ant-select'
      && row.observedOptionCount > 0 && ENUMERATED_OPTIONS_REASONS.has(row.reason)
      && (source === 'aria_controls_dom' ? row.optionsReadiness === 'observed'
        : ['owned_select_vnodes', 'owned_react_props'].includes(source) && ['target_missing', 'list_empty'].includes(row.optionsReadiness)));
    optional('optionsFramework', framework => spec.controlKind === 'ant-select' && framework === 'react');
    if (Object.hasOwn(row, 'optionsRootDiagnostic')) {
      const raw = row.optionsRootDiagnostic;
      const shapes = ['node_absent', 'absent', 'accessor', 'nullish', 'data'];
      if (spec.controlKind !== 'ant-select' || !['target_missing', 'list_empty'].includes(row.optionsReadiness)
        || !raw || !shapes.includes(raw.selectVue) || !shapes.includes(raw.appVue)
        || !['pathData', 'pathAccessor', 'pathAbsent', 'pathNullish'].every(key => count(raw[key], 32))
        || raw.pathData + raw.pathAccessor + raw.pathAbsent + raw.pathNullish > 32) throw new TypeError('inspection_invalid');
      metadata.optionsRootDiagnostic = { selectVue: raw.selectVue, appVue: raw.appVue,
        pathData: raw.pathData, pathAccessor: raw.pathAccessor, pathAbsent: raw.pathAbsent, pathNullish: raw.pathNullish };
    }
    optional('samplePrefixMatched', matched => spec.controlKind !== 'ant-calendar-picker'
      && spec.optionsComplete === false && typeof matched === 'boolean'
      && Object.hasOwn(row, 'observedOptionCount')
      && (!matched || row.observedOptionCount >= spec.options.length));
    optional('calendarStructureObserved', observed => spec.controlKind === 'ant-calendar-picker'
      && typeof observed === 'boolean'
      && (!observed || row.reason === 'calendar_live_evidence_missing' || calendarSuccess));
    for (const name of Reflect.ownKeys(row)) {
      if (typeof name === 'string' && name.startsWith('calendar') && !CALENDAR_METADATA.has(name)) {
        throw new TypeError('inspection_invalid');
      }
    }
    optional('calendarFramework', framework => spec.key === 'englishExamDate'
      && (calendarSuccess || row.reason === 'calendar_live_evidence_missing')
      && ['react', 'vue'].includes(framework));
    optional('calendarDefinitionIssue', issue => spec.key === 'englishExamDate'
      && row.reason === 'calendar_live_evidence_missing'
      && metadata.calendarStructureObserved === true && CALENDAR_DEFINITION_ISSUES.has(issue));
    optional('calendarEvidenceSource', source => calendarSuccess
      && ['owned_react_props', 'owned_calendar_vnodes', 'aria_controls_calendar_dom'].includes(source));
    optional('calendarPickerKind', kind => calendarSuccess && kind === 'month');
    optional('calendarFormat', format => calendarSuccess && ['YYYY-MM', 'YYYY/MM', 'YYYY年MM月'].includes(format));
    optional('calendarMode', mode => calendarSuccess && mode === 'month');
    optional('calendarOpen', open => calendarSuccess && typeof open === 'boolean');
    optional('calendarPanelKind', kind => calendarSuccess && ['month', 'date'].includes(kind));
    optional('calendarCellCount', cells => calendarSuccess && count(cells, 42));
    if (calendarSuccess) {
      const source = metadata.calendarEvidenceSource;
      const panel = source === 'aria_controls_calendar_dom';
      if (metadata.calendarStructureObserved !== true || metadata.calendarPickerKind !== 'month'
        || metadata.calendarMode !== 'month' || !source
        || !['react', 'vue'].includes(metadata.calendarFramework)
        || (source === 'owned_react_props' && metadata.calendarFramework !== 'react')
        || (source === 'owned_calendar_vnodes' && metadata.calendarFramework !== 'vue')
        || (!panel && (!Object.hasOwn(metadata, 'calendarFormat')
          || Object.hasOwn(metadata, 'calendarPanelKind') || Object.hasOwn(metadata, 'calendarCellCount')))
        || (panel && (metadata.calendarOpen === false || !['month', 'date'].includes(metadata.calendarPanelKind)
          || (metadata.calendarPanelKind === 'month' ? metadata.calendarCellCount !== 12
            : ![28, 35, 42].includes(metadata.calendarCellCount))))
        || Object.hasOwn(row, 'calendarDefinitionIssue')) throw new TypeError('inspection_invalid');
    } else if (Object.hasOwn(row, 'calendarFramework') && !metadata.calendarDefinitionIssue) {
      throw new TypeError('inspection_invalid');
    }
    optional('currentOptionsIndependentlyObserved', observed => locationSuccess && observed === true);
    optional('locationSelectionVerified', verified => location && verified === false);
    if (Object.hasOwn(row, 'locationCompositeEvidence')) {
      if (!location || !LOCATION_PROOF_REASONS.has(row.reason) || metadata.locationSelectionVerified !== false) {
        throw new TypeError('inspection_invalid');
      }
      metadata.locationCompositeEvidence = cleanLocationComposite(ownInspectionData(row, 'locationCompositeEvidence'));
    }
    if (Object.hasOwn(row, 'locationSelectionVerified') && !metadata.locationCompositeEvidence) {
      throw new TypeError('inspection_invalid');
    }
    if (locationSuccess && (metadata.currentOptionsIndependentlyObserved !== true
      || metadata.locationSelectionVerified !== false || !metadata.locationCompositeEvidence
      || metadata.observedOptionCount !== 30 || metadata.samplePrefixMatched !== true
      || !['aria_controls_dom', 'owned_select_vnodes', 'owned_react_props'].includes(metadata.optionsEvidenceSource)
      || metadata.locationCompositeEvidence.hosts[0].listState !==
        (metadata.optionsReadiness === 'target_missing' ? 'target_missing' : 'linked_structure_observed'))) {
      throw new TypeError('inspection_invalid');
    }
    optional('availabilityIssue', issue => row.reason === 'control_not_available' && AVAILABILITY_ISSUES.has(issue)
      && (issue !== 'location_host_unavailable' || location));
    optional('controlKindIssue', issue => row.reason === 'control_kind_mismatch' && CONTROL_KIND_ISSUES.has(issue)
      && (issue !== 'location_host_structure_unverified' || location));
    return { ...safety(), key: spec.key, wrapperId: spec.wrapperId, sectionId: spec.sectionId,
      controlKind: spec.controlKind, ok: row.ok, status: row.status, reason: row.reason,
      optionsComplete: spec.optionsComplete, evidenceSource: spec.evidenceSource,
      ...metadata,
      ...(spec.reusedFrom ? { independentOptionsEvidence: false, reusedFrom: spec.reusedFrom } : {}) };
  });
  const complete = fields.length === ROW_D_FIELDS.length
    && fields.every(row => row.ok || row.reason === 'calendar_live_evidence_missing');
  if (value.ok !== complete || (value.reason === 'read_only_preflight') !== complete) {
    throw new TypeError('inspection_invalid');
  }
  return { ok: value.ok, reason: value.reason, visibilityBasis: value.visibilityBasis, fields };
}

export function rowDProbeEvidence(reason = 'not_started') {
  return { version: 1, kind: 'cms_row_d_live_never_save_probe', ...safety(),
    baseTip: ROW_D_LIVE_BASE_TIP, booked: 70, visibilityBasis: 'attributes_only',
    visibilityKeeper: { targetActivated: false, pageBroughtToFront: false,
      focusEmulationEnabled: false, focusEmulationCleared: false },
    inspectionGate: { status: 'not_reached', checkpoints: [] },
    mainWorld: { status: 'not_reached' },
    optionsReadiness: { status: 'not_reached', attempts: 0, waitRounds: 0,
      initialUnavailableCount: 0, finalUnavailableCount: 0 },
    probeCompleted: false, ok: false, reason, restoration: 'not_needed_no_interaction', fields: [] };
}

/** Test dependencies are explicit. Importing this module never attaches. */
export async function runCmsRowDLive({ port = 9242, timeoutMs = 10000, requests = {},
  optionsWaitMs = 2000, optionsPollMs = 100,
  getTargets = getJson, connect = connectCdp, wait = delay, now = () => performance.now() } = {}) {
  const evidence = rowDProbeEvidence();
  let expression;
  try {
    if (!validPort(port) || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 30000
      || !validOptionsWait(optionsWaitMs) || !validOptionsPoll(optionsPollMs)) {
      throw new TypeError('config_invalid');
    }
    expression = buildCmsRowDOptionsProbeExpression(requests);
  } catch { evidence.reason = 'config_invalid'; return evidence; }
  let session;
  let fetchEnabled = false;
  let networkEnabled = false;
  let runtimeEnabled = false;
  let focusEmulationAttempted = false;
  let keeperCleanupFailed = false;
  let stage = 'target_discovery';
  const guard = createRowDNetworkGuard((method, params) => session.send(method, params));
  const contexts = new Map();
  const onEvent = event => {
    guard.onEvent(event);
    if (event.method === 'Runtime.executionContextCreated') {
      const context = event.params?.context;
      if (Number.isSafeInteger(context?.id)) contexts.set(context.id, context);
    } else if (event.method === 'Runtime.executionContextDestroyed') {
      contexts.delete(event.params?.executionContextId);
    } else if (event.method === 'Runtime.executionContextsCleared') contexts.clear();
  };
  const keeperCheckpoint = async checkpoint => {
    const settlement = await guard.settleKeeper();
    evidence.inspectionGate.checkpoints.push({ checkpoint, ...settlement });
    if (!settlement.ready) {
      evidence.inspectionGate.status = 'blocked';
      evidence.inspectionGate.blockedAt = checkpoint;
      evidence.reason = 'non_get_or_guard_failure';
      return false;
    }
    return true;
  };
  try {
    const choice = selectRowDTarget(await getTargets(port, '/json/list', { timeoutMs, step: stage }), port);
    if (!choice.ok) { evidence.reason = choice.reason; return evidence; }
    stage = 'connect';
    session = await connect(choice.target.webSocketDebuggerUrl, { timeoutMs, step: stage, onEvent });
    stage = 'network_guard';
    await session.send('Network.enable');
    networkEnabled = true;
    await session.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
    fetchEnabled = true;
    await guard.drain();
    if (guard.failed()) { evidence.reason = 'non_get_or_guard_failure'; return evidence; }
    stage = 'visibility_keeper';
    guard.setKeeperActive(true);
    // The real CMS document can remain hidden without a retained focus-emulated
    // CDP session. Guard network before activation: visibility/focus listeners
    // can themselves initiate requests. These are browser commands, not page
    // clicks, DOM focus calls, popup opens or field/value interactions.
    for (const [method, params, acknowledgment, checkpoint] of [
      ['Target.activateTarget', { targetId: choice.target.id }, 'targetActivated', 'target_activation'],
      ['Page.bringToFront', {}, 'pageBroughtToFront', 'bring_to_front'],
      ['Emulation.setFocusEmulationEnabled', { enabled: true }, 'focusEmulationEnabled', 'focus_emulation']
    ]) {
      if (method === 'Emulation.setFocusEmulationEnabled') focusEmulationAttempted = true;
      await session.send(method, params);
      evidence.visibilityKeeper[acknowledgment] = true;
      if (!await keeperCheckpoint(checkpoint)) return evidence;
    }
    if (!await keeperCheckpoint('before_inspection')) return evidence;
    evidence.inspectionGate.status = 'allowed';
    stage = 'main_world';
    await session.send('Runtime.enable');
    runtimeEnabled = true;
    const frame = (await session.send('Page.getFrameTree'))?.frameTree?.frame;
    const mainContexts = [...contexts.values()].filter(context => context.auxData?.isDefault === true
      && context.auxData.frameId === frame?.id);
    if (!frame?.id || typeof frame.url !== 'string' || frame.url.split(/[?#]/u, 1)[0] !== ROW_D_PAGE
      || mainContexts.length !== 1) {
      evidence.mainWorld.status = 'missing_or_ambiguous';
      evidence.reason = 'main_world_unavailable';
      return evidence;
    }
    const context = mainContexts[0];
    evidence.mainWorld = { status: 'pinned', contextId: context.id };
    const contextReady = () => {
      if (contexts.get(context.id) === context) return true;
      evidence.mainWorld.status = 'invalidated';
      evidence.ok = false;
      evidence.reason = 'main_world_invalidated';
      return false;
    };
    stage = 'inspection';
    const readiness = evidence.optionsReadiness;
    const unavailableCount = inspection => inspection.fields.filter(row =>
      row.controlKind === 'ant-select' && row.reason === 'current_options_unavailable').length;
    const retryable = inspection => inspection.reason === 'page_not_ready'
      || (inspection.reason === 'row_d_preflight_incomplete' && unavailableCount(inspection) > 0);
    let longestInspectionMs = 0;
    const evaluate = async evaluationTimeout => {
      if (!contextReady()) return undefined;
      const started = now();
      readiness.attempts += 1;
      const reply = await session.send('Runtime.evaluate', {
        expression, contextId: context.id, returnByValue: true, awaitPromise: false, userGesture: false,
        // Every sample retains this boundary. No page observer, timer, promise,
        // event, control open, or interaction is installed to await options.
        throwOnSideEffect: true, timeout: evaluationTimeout
      // The browser timeout still bounds synchronous evaluation. If its reply
      // misses the host deadline, stop inspection but retain the guards/socket
      // for focus reset and drain. Never retry or authorize that timed-out read.
      }, { timeoutMs: evaluationTimeout, step: 'inspection', closeOnTimeout: false });
      if (!contextReady()) return undefined;
      if (reply?.exceptionDetails) {
        readiness.status = 'inspection_failed';
        evidence.ok = false;
        evidence.reason = 'inspection_exception';
        return undefined;
      }
      const inspection = cleanInspection(reply?.result?.value);
      longestInspectionMs = Math.max(longestInspectionMs, now() - started);
      // Replace the entire snapshot. Earlier successful fields cannot conceal
      // a later ownership, label, visibility, dictionary, or control drift.
      evidence.fields = inspection.fields;
      evidence.visibilityBasis = inspection.visibilityBasis;
      evidence.probeCompleted = true;
      evidence.ok = inspection.ok;
      evidence.reason = inspection.reason;
      readiness.finalUnavailableCount = unavailableCount(inspection);
      return inspection;
    };
    const optionsGuardReady = () => {
      if (!guard.failed() && !guard.hasPendingCommands()) return true;
      readiness.status = 'guard_blocked';
      // Stop additional reads immediately. An in-flight abort acknowledgement
      // may still complete during the existing cleanup; that final strict
      // ledger remains authoritative over a previously clean actual verdict.
      if (!evidence.probeCompleted) {
        evidence.ok = false;
        evidence.reason = 'non_get_or_guard_failure';
      }
      return false;
    };
    if (!optionsGuardReady()) return evidence;
    let inspection = await evaluate(timeoutMs);
    if (!inspection) return evidence;
    readiness.initialUnavailableCount = readiness.finalUnavailableCount;
    if (!optionsGuardReady()) return evidence;
    if (!retryable(inspection)) readiness.status = 'not_needed';
    else {
      // One host-side budget starts after the first complete actual snapshot.
      // A round cap also bounds tests/callers whose injected wait is a no-op.
      const deadline = now() + optionsWaitMs;
      const maximumRounds = Math.ceil(optionsWaitMs / optionsPollMs);
      readiness.status = 'timed_out';
      for (let round = 0; round < maximumRounds; round += 1) {
        if (!optionsGuardReady()) return evidence;
        let remaining = deadline - now();
        // Do not dispatch a full strict inspection with only a tiny remainder
        // of its observed cost. Reserve twice the slowest completed sample,
        // with 25ms minimum host/protocol headroom. An exhausted readiness
        // budget leaves the latest incomplete snapshot intact; a dispatched
        // read that really times out still fails inspection and is not retried.
        const sampleBudget = Math.max(25, Math.ceil(longestInspectionMs * 2));
        if (remaining <= sampleBudget) break;
        readiness.waitRounds += 1;
        await wait(Math.min(optionsPollMs, remaining));
        if (!optionsGuardReady()) return evidence;
        remaining = deadline - now();
        if (remaining <= sampleBudget) break;
        const previous = inspection;
        inspection = await evaluate(Math.max(1, Math.min(timeoutMs, Math.ceil(remaining))));
        if (!inspection) return evidence;
        if (!optionsGuardReady()) return evidence;
        // A late reply remains the latest actual evidence, but cannot renew
        // this deadline or authorize a successful readiness wait.
        if (now() >= deadline) {
          if (evidence.ok) { evidence.ok = false; evidence.reason = 'options_readiness_timeout'; }
          break;
        }
        const terminalDrift = inspection.reason !== 'page_not_ready'
          && (!['row_d_preflight_incomplete', 'read_only_preflight'].includes(inspection.reason)
            || previous.fields.some((row, index) => {
              const current = inspection.fields[index];
              return (row.ok || row.reason === 'current_options_unavailable')
                && !current.ok && current.reason !== 'current_options_unavailable'
                && !(current.observedOptionCount > 0);
            }));
        if (terminalDrift) { readiness.status = 'stopped'; break; }
        if (!retryable(inspection)) { readiness.status = 'ready'; break; }
      }
    }
    stage = 'settlement';
    await wait(250); // Monitoring window only; not a restoration/support assertion.
    await guard.drain();
  } catch (error) {
    // CDP exception strings may contain page values, queries or remote URLs.
    evidence.ok = false;
    evidence.reason = `${stage}_failed`;
    evidence.failure = { stage, reason: commandFailureKind(error) };
    if (stage === 'inspection') evidence.optionsReadiness.status = 'inspection_failed';
  } finally {
    if (session) {
      await guard.drain();
      // Keep this session's focus override through evaluate and settlement.
      // Reset it before removing the guards, including after a rejected enable
      // whose browser-side outcome is unknown. No page values are restored.
      if (focusEmulationAttempted) {
        try {
          await session.send('Emulation.setFocusEmulationEnabled', { enabled: false });
          evidence.visibilityKeeper.focusEmulationCleared = true;
        } catch (error) {
          keeperCleanupFailed = true;
          guard.commandFailure('Emulation.setFocusEmulationEnabled', error);
        }
        // Focus/blur handlers may schedule requests after the command reply.
        // Keep the guards for a bounded window even after a failed reset or an
        // early stop. This does not isolate all possible later page activity.
        try { await wait(250); } catch { keeperCleanupFailed = true; }
      }
      await guard.drain();
      // Disable only CDP domains enabled by this session, after all known
      // paused requests received their decisions.
      guard.setKeeperActive(false);
      if (runtimeEnabled) {
        try { await session.send('Runtime.disable'); }
        catch (error) { guard.commandFailure('Runtime.disable', error); }
      }
      if (fetchEnabled) {
        try { await session.send('Fetch.disable'); }
        catch (error) { guard.commandFailure('Fetch.disable', error); }
      }
      await guard.drain();
      if (networkEnabled) {
        try { await session.send('Network.disable'); }
        catch (error) { guard.commandFailure('Network.disable', error); }
      }
      await guard.drain();
      try { session.close(); } catch (error) { guard.commandFailure('session_close', error); }
    }
    evidence.traffic = { ...guard.traffic, keeperAssessment: guard.assessment() };
    if (keeperCleanupFailed) {
      evidence.ok = false;
      evidence.reason = 'visibility_keeper_cleanup_failed';
    }
    if (guard.failed()) {
      // Includes the bounded optional-networkId pairing above. A qualifying
      // block leaves the actual inspection verdict intact; every rejection
      // still overrides it, including new traffic during guard teardown.
      evidence.ok = false;
      evidence.reason = 'non_get_or_guard_failure';
    }
  }
  return evidence;
}

export const HELP = `Usage: node scripts/live/cms-row-d-live.mjs
Inert Never-Save row D CDP probe. No open/fill/Save/submit, no value reads.
neverSave=true liveSupportClaimed=false livePassClaimed=false writeStarted=false
mutationAllowed=false valuesExposed=false probeOnly=true
Visibility uses attributes only; stylesheet/layout visibility is not verified.
Guarded CDP activation retains focus emulation through the inspection window.
No live PASS claimed. Parent accepted PASS_PREFLIGHT/bookD at tip 575abee8.
Booked stays 70; this probe does not make another acceptance or booking decision.
PORT defaults to 9242; STEP_TIMEOUT_MS defaults to 10000 (1000..30000).
OPTIONS_WAIT_MS defaults to 2000 (0..5000); OPTIONS_POLL_MS to 100 (25..500).
Options wait uses bounded host reads only; missing dormant lists remain skips.
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
