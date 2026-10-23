#!/usr/bin/env node
/** Offline preparation by default; explicit daytime collection delegates to the shipped Never-Save runner. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { connectCdp, getJson } from '../tools/live-harvest/cdp-client.mjs';
import { runCmsEducationLive, readPort, readRowIndex, readStepTimeout, fieldSpecsForRow, READBACK_WAIT_MS } from './live/cms-education-live.mjs';
import { EVIDENCE_SCHEMA_VERSION, REVIEWED_FILES, validateControlsDaytimeEvidence } from './validate-cms-education-controls-evidence.mjs';
import { buildDaytimeCaptureExpression } from './lib/cms-education-daytime-capture.mjs';

export const BASE_TIP = '392dbe0b6bf1234be47b2d516ab37ef8ee7e353d';
const hostRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const fail = code => { throw Object.assign(new Error(code), { code }); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const writeJson = (dir, name, value) => fs.writeFileSync(path.join(dir, name), `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
const OBSERVATION_FILES = Object.freeze({ before: 'snapshots-before.json', after: 'snapshots-after.json',
  prepare: 'prepare.json', run: 'readbacks.json', cleanup: 'cleanup.json' });

export const CHECKLIST = Object.freeze([
  { key: 'bytes_clean_page', bindings: [
    { file: 'reviewed-bytes.json', path: 'tipSha' },
    { file: 'reviewed-bytes.json', path: 'files' },
    { file: 'snapshots-before.json', path: 'boundary' }
  ], predicate: 'Independent approved hashes equal machine and runner bytes; twelve native hooks, absent API, body-click receipt, zero overlays.' },
  { key: 'seven_visible_probes', bindings: [
    { file: 'cms-education-live.json', path: 'finalDetails.widgetProbes' },
    { file: 'cms-education-live.json', path: 'finalDetails.widgetClickCount' },
    { file: 'observations.json', path: 'cleanup.widgetProbes' },
    { file: 'observations.json', path: 'cleanup.widgetClickCount' }
  ], predicate: 'Seven unique owned openings and closings, including degree; one counted opener and mousedown/mouseup/click actually observed each.' },
  { key: 'suppression_traffic_clicks', bindings: [
    { file: 'cms-education-live.json', path: 'suppressedAutosave' },
    { file: 'cms-education-live.json', path: 'suppressedLookup' },
    { file: 'cms-education-live.json', path: 'nonGet' },
    { file: 'cms-education-live.json', path: 'saveLikePost' },
    { file: 'cms-education-live.json', path: 'finalDetails.clickCount' },
    { file: 'cms-education-live.json', path: 'finalDetails.bannedClick' },
    { file: 'observations.json', path: 'cleanup.posts' },
    { file: 'observations.json', path: 'cleanup.clicks' },
    { file: 'observations.json', path: 'cleanup.suppressedAutosave' },
    { file: 'observations.json', path: 'cleanup.suppressedLookup' },
    { file: 'collector-status.json', path: 'suppressionExercised' }
  ], predicate: 'Existing bounded ownership/before-send classifiers pass; generic traffic arrays empty; zero forbidden clicks. Empty suppression does not establish exercised suppression.' },
  { key: 'nine_readbacks', bindings: [
    { file: 'snapshots-before.json', path: 'snapshots.dom' },
    { file: 'snapshots-before.json', path: 'snapshots.publicProps' },
    { file: 'observations.json', path: 'prepare.rowIndex' },
    { file: 'observations.json', path: 'prepare.recordCount' },
    { file: 'observations.json', path: 'prepare.identity' },
    { file: 'observations.json', path: 'prepare.identities' },
    { file: 'observations.json', path: 'run.rowIndex' },
    { file: 'observations.json', path: 'run.recordCount' },
    { file: 'observations.json', path: 'run.readbacks' },
    { file: 'observations.json', path: 'run.waitedMs' },
    { file: 'cms-education-live.json', path: 'fields' },
    { file: 'cms-education-live.json', path: 'finalDetails.waitedMs' },
    { file: 'collector-status.json', path: 'actualTrialMatches' }
  ], predicate: 'Actual originals retained; all nine exact waited readbacks; existing runner and validator agree.' },
  { key: 'restoration_neighbors', bindings: [
    ...['snapshots-before.json', 'snapshots-after.json'].flatMap(file =>
      ['snapshots.dom', 'snapshots.publicProps', 'snapshots.dto', 'snapshots.neighbors',
        'rawDom.educationOuterHTML', 'rawDom.neighborOuterHTML'].map(path => ({ file, path }))),
    { file: 'evidence-pack.json', path: 'restoration' },
    { file: 'collector-status.json', path: 'rawDomCaptured' },
    { file: 'collector-status.json', path: 'rawDomEqual' }
  ], predicate: 'Four independently computed matching snapshot hashes plus exact raw section/neighbor markup equality; lossless tagged values, whitespace, property absence and all neighboring rows retained.' },
  { key: 'settled_callbacks', bindings: [
    { file: 'observations.json', path: 'cleanup.timerSettle' },
    { file: 'cms-education-live.json', path: 'finalDetails.timerSettle' },
    { file: 'collector-status.json', path: 'actualTrialMatches' }
  ], predicate: 'Actual bounded settlement; pendingTimers=0, unobservableTimers=0; nonnegative safe observedNonFunctionTimeouts.' },
  { key: 'cleanup', bindings: [
    { file: 'snapshots-after.json', path: 'boundary' },
    { file: 'snapshots-after.json', path: 'identity' },
    { file: 'collector-status.json', path: 'identity' },
    { file: 'collector-status.json', path: 'observationsComplete' },
    { file: 'collector-status.json', path: 'errors' },
    { file: 'cms-education-live.json', path: 'finalDetails.cleanupOk' },
    { file: 'observations.json', path: 'cleanup.ok' }
  ], predicate: 'Actual hook and injected-global descriptor/value identity restored, context unchanged, absent API, zero overlays. Identity supplement is outside schema v1.' }
].map(({ key, bindings, predicate }) => Object.freeze({
  key, files: Object.freeze([...new Set(bindings.map(binding => binding.file))]),
  fields: Object.freeze([...new Set(bindings.map(binding => binding.path))]),
  // Each path starts at its named artifact's root; preparation emits requirements only.
  bindings: Object.freeze(bindings.map(binding => Object.freeze(binding))), predicate
})));

function newOutputDirectory(outDir) {
  if (typeof outDir !== 'string' || !outDir.trim()) fail('output_required');
  const absolute = path.resolve(outDir);
  const relative = path.relative(hostRoot, absolute);
  if (!relative || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
    && relative.split(path.sep)[0] !== '_temp-scripts')) fail('private_output_location_required');
  if (fs.existsSync(absolute)) fail('output_exists');
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.mkdirSync(absolute); // Atomic refusal if another collector created it.
  return absolute;
}

export function prepareDaytimeHarness(options = {}) {
  const root = options.repoRoot || hostRoot;
  const tipSha = options.reviewedRef || BASE_TIP;
  if (tipSha !== BASE_TIP) fail('reviewed_ref_invalid');
  let files;
  try {
    execFileSync('git', ['diff', '--quiet', '--no-ext-diff', tipSha, '--', ...REVIEWED_FILES],
      { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    files = REVIEWED_FILES.map(file => ({ path: file,
      reviewedSha256: sha256(fs.readFileSync(path.join(root, file))),
      reviewedBlobSha256: sha256(execFileSync('git', ['show', `${tipSha}:${file}`], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })) }));
  } catch { fail('reviewed_ref_unavailable'); }
  const outDir = newOutputDirectory(options.outDir);
  writeJson(outDir, 'reviewed-manifest.candidate.json', { schemaVersion: 1, approved: false, tipSha, source: 'review-checkout-exact-bytes',
    neverSave: true, liveSupportClaimed: false, files });
  writeJson(outDir, 'checklist.json', CHECKLIST);
  writeJson(outDir, 'collector-status.json', { mode: 'prepare', collected: false, complete: false,
    neverSave: true, liveSupportClaimed: false, requiresIndependentApproval: true });
  return { mode: 'prepare', exitCode: 0, collected: false, complete: false, neverSave: true, liveSupportClaimed: false };
}

function approvedBytes(manifestPath, machineRoot) {
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch { fail('approved_manifest_invalid'); }
  if (!object(manifest) || manifest.schemaVersion !== 1 || manifest.approved !== true
    || manifest.neverSave !== true || manifest.liveSupportClaimed !== false
    || manifest.tipSha !== BASE_TIP
    || !Array.isArray(manifest.files) || manifest.files.length !== REVIEWED_FILES.length) fail('approved_manifest_invalid');
  if (typeof machineRoot !== 'string' || !machineRoot.trim()) fail('machine_root_required');
  const files = REVIEWED_FILES.map(file => {
    const rows = manifest.files.filter(row => row?.path === file);
    if (rows.length !== 1 || typeof rows[0].reviewedSha256 !== 'string' || !/^[0-9a-f]{64}$/u.test(rows[0].reviewedSha256)) fail('approved_manifest_invalid');
    let machineSha256, runnerSha256;
    try {
      machineSha256 = sha256(fs.readFileSync(path.join(machineRoot, file)));
      runnerSha256 = sha256(fs.readFileSync(path.join(hostRoot, file)));
    } catch { fail('machine_bytes_unavailable'); }
    if (machineSha256 !== rows[0].reviewedSha256 || runnerSha256 !== rows[0].reviewedSha256) fail('reviewed_bytes_mismatch');
    return { path: file, reviewedSha256: rows[0].reviewedSha256, machineSha256 };
  });
  return { tipSha: manifest.tipSha, files };
}

function valueReply(reply) {
  if (reply?.exceptionDetails || !object(reply?.result) || !Object.hasOwn(reply.result, 'value')) fail('capture_unavailable');
  return reply.result.value;
}

/** Retains observations on the runner's one guarded connection; never installs, retries, or cleans the trial itself. */
export function createObservedConnector(connectFn, captureExpression, state) {
  return async (url, connectionOptions) => {
    const session = await connectFn(url, connectionOptions);
    let objectId = null;
    const group = `cms-education-daytime-${crypto.randomUUID()}`;
    const record = (key, value) => {
      state[key] = value;
      state.persist?.(key, value);
    };
    const captureCall = async (functionDeclaration, step, callOptions) => valueReply(await session.send('Runtime.callFunctionOn', {
      objectId, functionDeclaration, returnByValue: true
    }, { ...callOptions, step }));
    const release = async callOptions => {
      if (!objectId) return;
      try { await session.send('Runtime.releaseObjectGroup', { objectGroup: group }, { ...callOptions, step: 'capture_release' }); }
      catch { state.errors.push('capture_release_failed'); }
      objectId = null;
    };
    return {
      async send(method, params, callOptions = {}) {
        const step = callOptions.step;
        state.steps.push({ step, method });
        if (step === 'install_live') {
          // Network/Fetch are already mandatory in the shipped runner at this seam.
          try {
            const reply = await session.send('Runtime.evaluate', { expression: captureExpression,
              returnByValue: false, objectGroup: group }, { ...callOptions, step: 'capture_before_create' });
            if (reply?.exceptionDetails || typeof reply?.result?.objectId !== 'string') fail('capture_unavailable');
            objectId = reply.result.objectId;
            record('before', await captureCall('function () { return this.before; }', 'capture_before', callOptions));
          } catch { state.errors.push('capture_before_failed'); await release(callOptions); fail('capture_before_failed'); }
        }
        if (step === 'fetch_disable') await release(callOptions);
        let reply;
        try { reply = await session.send(method, params, callOptions); }
        catch (error) {
          if (step === 'cleanup') {
            state.errors.push('cleanup_call_failed');
            await release(callOptions);
          }
          throw error;
        }
        const key = { education_prepare: 'prepare', education_run: 'run', cleanup: 'cleanup' }[step];
        if (key) {
          try { record(key, valueReply(reply)); } catch { state.errors.push(`${key}_observation_failed`); }
        }
        if (step === 'cleanup' && objectId) {
          // Observation failure must never skip the runner's interception teardown.
          try { record('after', await captureCall('function () { return this.finish(); }', 'capture_after', callOptions)); }
          catch { state.errors.push('capture_after_failed'); }
          finally { await release(callOptions); }
        }
        return reply;
      },
      close() { session.close(); }
    };
  };
}

function snapshotHashes(capture) {
  if (!object(capture?.snapshots)) return null;
  const hashes = {};
  for (const key of ['dom', 'publicProps', 'dto', 'neighbors']) {
    if (!Object.hasOwn(capture.snapshots, key) || capture.snapshots[key] === null || capture.snapshots[key] === undefined) return null;
    hashes[`${key}Sha256`] = sha256(JSON.stringify(capture.snapshots[key]));
  }
  return hashes;
}

function observedTrialChecks(state, report, rowIndex) {
  const { prepare, run, cleanup } = state;
  const specs = fieldSpecsForRow(rowIndex, true);
  // Keep the existing completion predicates, but retain which actual reply failed.
  return [
    { key: 'nine_readbacks', path: 'prepare', reason: 'prepare_mismatch',
      ok: prepare?.ok === true && prepare.rowIndex === rowIndex
        && prepare.recordCount === report?.finalDetails?.recordCount
        && Array.isArray(prepare.identities) && prepare.identities.length === prepare.recordCount
        && prepare.identity === prepare.identities[rowIndex] },
    { key: 'nine_readbacks', path: 'run', reason: 'run_mismatch',
      ok: run?.ok === true && run.rowIndex === rowIndex && run.recordCount === prepare?.recordCount
        && run.liveSupportClaimed === false && run.restored === true && run.pageLeftAsFound === true
        && run.otherChanged === false && Number.isFinite(run.waitedMs) && run.waitedMs >= READBACK_WAIT_MS },
    { key: 'nine_readbacks', path: 'run.readbacks', reason: 'readbacks_mismatch',
      ok: Array.isArray(run?.readbacks) && run.readbacks.length === specs.length
        && specs.every(spec => {
          const rows = run.readbacks.filter(row => row?.path === spec.path);
          return rows.length === 1 && rows[0].ok === true && rows[0].reason === 'readback_matched'
            && JSON.stringify(rows[0].value) === JSON.stringify(spec.fixture);
        }) },
    { key: 'cleanup', path: 'cleanup.ok', reason: 'cleanup_mismatch', ok: cleanup?.ok === true },
    { key: 'suppression_traffic_clicks', path: 'cleanup.posts', reason: 'cleanup_traffic_mismatch',
      ok: Array.isArray(cleanup?.posts) && cleanup.posts.length === 0 },
    { key: 'suppression_traffic_clicks', path: 'cleanup.clicks', reason: 'cleanup_clicks_mismatch',
      ok: Array.isArray(cleanup?.clicks) && cleanup.clicks.length === 0 },
    { key: 'settled_callbacks', path: 'cleanup.timerSettle', reason: 'timer_settle_mismatch',
      ok: ['pendingTimers', 'unobservableTimers', 'observedNonFunctionTimeouts'].every(key =>
        Number.isSafeInteger(cleanup?.timerSettle?.[key]) && cleanup.timerSettle[key] >= 0
        && cleanup.timerSettle[key] === report?.finalDetails?.timerSettle?.[key])
        && cleanup.timerSettle.pendingTimers === 0 && cleanup.timerSettle.unobservableTimers === 0 }
  ].map(check => ({ ...check, file: 'observations.json' }));
}

function retainedArtifactChecks(outDir, state, report) {
  return Object.entries({ ...OBSERVATION_FILES, report: 'cms-education-live.json' }).map(([name, file]) => {
    let value, reason;
    try { value = JSON.parse(fs.readFileSync(path.join(outDir, file), 'utf8')); }
    catch (error) { reason = error?.code === 'ENOENT' ? 'artifact_missing' : 'artifact_unreadable'; }
    if (!reason) {
      const actual = name === 'report' ? report : state[name];
      try {
        // Match the actual JSON-persisted representation, independent of formatting/key order.
        if (!object(actual) || !isDeepStrictEqual(value, JSON.parse(JSON.stringify(actual)))) reason = 'artifact_mismatch';
      } catch { reason = 'artifact_mismatch'; }
    }
    return { name, file, value, reason, matches: !reason };
  });
}

function collectionDiagnostics(outDir, status, trialChecks, state, retainedChecks) {
  const diagnostics = [];
  const artifacts = new Map([['collector-status.json', { value: status }],
    ...retainedChecks.map(check => [check.file, { value: check.value,
      reason: ['artifact_missing', 'artifact_unreadable'].includes(check.reason) ? check.reason : undefined }])]);
  for (const row of CHECKLIST) for (const { file, path: fieldPath } of row.bindings) {
    if (!artifacts.has(file)) {
      const filename = path.join(outDir, file);
      let artifact;
      try { artifact = { value: JSON.parse(fs.readFileSync(filename, 'utf8')) }; }
      catch (error) { artifact = { reason: error?.code === 'ENOENT' ? 'artifact_missing' : 'artifact_unreadable' }; }
      artifacts.set(file, artifact);
    }
    const artifact = artifacts.get(file);
    let value = artifact.value, reason = artifact.reason;
    if (!reason) {
      for (const part of fieldPath.split('.')) {
        if (value === null || typeof value !== 'object' || !Object.hasOwn(value, part)) {
          reason = 'path_missing'; break;
        }
        value = value[part];
      }
      if (!reason && value === null) reason = 'value_null';
    }
    if (reason) diagnostics.push({ key: row.key, file, path: fieldPath, reason });
  }
  for (const check of retainedChecks) if (!check.matches) diagnostics.push({
    key: ['before', 'after'].includes(check.name) ? 'restoration_neighbors'
      : ['prepare', 'run'].includes(check.name) ? 'nine_readbacks' : 'cleanup',
    file: 'collector-status.json', path: `retainedArtifactsMatch.${check.name}`, reason: check.reason
  });
  for (const { ok, ...failure } of trialChecks) if (!ok) diagnostics.push(failure);
  for (const flag of ['hooksRestored', 'globalsRestored', 'contextUnchanged']) {
    if (status.identity?.[flag] !== true) diagnostics.push({ key: 'cleanup', file: 'snapshots-after.json',
      path: `identity.${flag}`, reason: 'identity_mismatch' });
  }
  for (const side of ['before', 'after']) {
    const raw = state[side]?.rawDom;
    if (!object(raw)) continue; // Missing paths/null values are already located above.
    for (const field of ['educationOuterHTML', 'neighborOuterHTML']) {
      if (!Object.hasOwn(raw, field) || raw[field] === null) continue;
      const valid = field === 'educationOuterHTML'
        ? typeof raw[field] === 'string' && raw[field].length > 0
        : Array.isArray(raw[field]) && raw[field].every(html => typeof html === 'string');
      if (!valid) diagnostics.push({ key: 'restoration_neighbors', file: `snapshots-${side}.json`,
        path: `rawDom.${field}`, reason: 'raw_dom_invalid' });
    }
  }
  if (status.rawDomCaptured && !status.rawDomEqual) {
    for (const field of ['educationOuterHTML', 'neighborOuterHTML']) {
      if (JSON.stringify(state.before.rawDom[field]) !== JSON.stringify(state.after.rawDom[field])) {
        diagnostics.push({ key: 'restoration_neighbors', file: 'snapshots-after.json',
          path: `rawDom.${field}`, reason: 'raw_dom_mismatch' });
      }
    }
  }
  if (status.errors.length) diagnostics.push({ key: 'cleanup', file: 'collector-status.json',
    path: 'errors', reason: 'collector_errors' });
  // Values and parser/protocol messages never enter this availability/supplement report.
  // Presence is not a passing predicate; validation.json retains the schema verdict.
  return diagnostics;
}

export async function collectDaytimeHarness(options = {}) {
  if (options.neverSave !== true) fail('never_save_required');
  if (options.controls !== '1') fail('controls_one_required');
  // All configuration and independent-byte approval checks precede browser access.
  const env = { PORT: String(options.port ?? 9239), ROW_INDEX: String(options.rowIndex ?? 0),
    STEP_TIMEOUT_MS: String(options.stepTimeoutMs ?? 30000), CONTROLS: '1' };
  const port = readPort(env), rowIndex = readRowIndex(env), stepTimeoutMs = readStepTimeout(env);
  const reviewedBytes = approvedBytes(options.approvedManifest, options.machineRoot);
  const captureExpression = buildDaytimeCaptureExpression(options.machineRoot);
  const outDir = newOutputDirectory(options.outDir);
  const state = { before: null, after: null, prepare: null, run: null, cleanup: null, steps: [], errors: [] };
  state.persist = (key, value) => writeJson(outDir, OBSERVATION_FILES[key], value);
  writeJson(outDir, 'checklist.json', CHECKLIST);
  writeJson(outDir, 'reviewed-bytes.json', reviewedBytes);
  writeJson(outDir, 'collector-start.json', { mode: 'collect', neverSave: true, liveSupportClaimed: false,
    startedAt: new Date().toISOString(), collectorSha256: sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
    captureSha256: sha256(fs.readFileSync(path.join(hostRoot, 'scripts/lib/cms-education-daytime-capture.mjs'))),
    snapshotEncoding: 'cms-daytime-tagged-v1', approvedTipSha: reviewedBytes.tipSha });
  let report = null;
  try {
    report = await (options.runLive || runCmsEducationLive)({ env, port, rowIndex, stepTimeoutMs, controls: true,
      repoRoot: options.machineRoot, outDir, tipSha: reviewedBytes.tipSha,
      getJson: options.getJson || getJson,
      connectCdp: createObservedConnector(options.connectCdp || connectCdp, captureExpression, state) });
  } catch { state.errors.push('runner_failed'); }
  // An operator sync or other edit during the trial cannot retain byte approval.
  try { approvedBytes(options.approvedManifest, options.machineRoot); }
  catch { state.errors.push('reviewed_bytes_changed'); }
  const retainedChecks = retainedArtifactChecks(outDir, state, report);
  const retainedArtifactsMatch = Object.fromEntries(retainedChecks.map(({ name, matches }) => [name, matches]));
  const { persist: _persist, ...observations } = state;
  writeJson(outDir, 'observations.json', observations);
  const pack = { schemaVersion: EVIDENCE_SCHEMA_VERSION, neverSave: true, liveSupportClaimed: false,
    report, reviewedBytes, boundaries: { before: state.before?.boundary ?? null, after: state.after?.boundary ?? null },
    restoration: { before: snapshotHashes(state.before), after: snapshotHashes(state.after) } };
  const validation = validateControlsDaytimeEvidence(pack);
  const identity = state.after?.identity ?? null;
  const identityOk = identity?.hooksRestored === true && identity?.globalsRestored === true && identity?.contextUnchanged === true;
  const observed = ['before', 'after', 'prepare', 'run', 'cleanup'].every(key => object(state[key]));
  const trialChecks = observedTrialChecks(state, report, rowIndex);
  const actualTrialMatches = trialChecks.every(check => check.ok);
  const rawDomCaptured = [state.before?.rawDom, state.after?.rawDom].every(raw => object(raw)
    && typeof raw.educationOuterHTML === 'string' && raw.educationOuterHTML.length > 0
    && Array.isArray(raw.neighborOuterHTML) && raw.neighborOuterHTML.every(html => typeof html === 'string'));
  const rawDomEqual = rawDomCaptured && state.before.rawDom.educationOuterHTML === state.after.rawDom.educationOuterHTML
    && JSON.stringify(state.before.rawDom.neighborOuterHTML) === JSON.stringify(state.after.rawDom.neighborOuterHTML);
  const complete = validation.complete && identityOk && observed && actualTrialMatches && rawDomEqual
    && retainedChecks.every(check => check.matches) && state.errors.length === 0;
  const exitCode = complete ? 0 : [1, 3].includes(validation.reportExitCode) ? validation.reportExitCode : 2;
  const status = { mode: 'collect', exitCode, complete, neverSave: true, liveSupportClaimed: false,
    schemaComplete: validation.complete, identity, observationsComplete: observed, actualTrialMatches,
    rawDomCaptured, rawDomEqual, retainedArtifactsMatch, errors: state.errors,
    reviewRequired: true, suppressionExercised: {
      autosave: Array.isArray(report?.suppressedAutosave) && report.suppressedAutosave.length > 0,
      lookup: Array.isArray(report?.suppressedLookup) && report.suppressedLookup.length > 0
    } };
  writeJson(outDir, 'evidence-pack.json', pack);
  writeJson(outDir, 'validation.json', validation);
  status.diagnostics = collectionDiagnostics(outDir, status, trialChecks, state, retainedChecks);
  writeJson(outDir, 'collector-status.json', status);
  return status;
}

const HELP = `Usage (offline preparation is the default):
  node scripts/cms-education-daytime-harness.mjs --prepare --out <new-directory> [--reviewed-ref <40-digit-SHA>]
  node scripts/cms-education-daytime-harness.mjs --collect --never-save --approved-manifest <approved.json> --machine-root <deployed-root> --out <new-directory> [--port 9242] [--row-index 0]
Prepare checks the pinned review checkout and hashes exact review bytes; the candidate is NOT approved. Collect requires independent approval and exact machine bytes, and attaches only to the already-open baseline CMS tab. No browser launch, login, reload, sync, Save, retry, or live support claim. Private artifacts stay local. Never-Save; liveSupportClaimed=false.
`;

function parseArgs(args) {
  const options = { mode: 'prepare' };
  let modeSeen = false;
  const values = { '--out': 'outDir', '--reviewed-ref': 'reviewedRef', '--approved-manifest': 'approvedManifest',
    '--machine-root': 'machineRoot', '--port': 'port', '--row-index': 'rowIndex', '--step-timeout-ms': 'stepTimeoutMs' };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (['--prepare', '--collect'].includes(arg)) {
      if (modeSeen) fail('arguments_invalid');
      options.mode = arg.slice(2); modeSeen = true;
    } else if (arg === '--never-save') options.neverSave = true;
    else if (values[arg] && index + 1 < args.length && !args[index + 1].startsWith('--')) {
      if (Object.hasOwn(options, values[arg])) fail('arguments_invalid');
      options[values[arg]] = args[++index];
    } else fail('arguments_invalid');
  }
  options.outDir ||= path.join(hostRoot, '_temp-scripts', `cms-edu-daytime-${options.mode}-${crypto.randomUUID()}`);
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.slice(2).some(arg => ['--help', '-h'].includes(arg))) process.stdout.write(HELP);
    else {
      const options = parseArgs(process.argv.slice(2));
      const result = options.mode === 'collect'
        ? await collectDaytimeHarness({ ...options, controls: '1' }) : prepareDaytimeHarness(options);
      // Counts/booleans only: never echo source observations, paths, or applicant data.
      console.log(JSON.stringify({ mode: result.mode, exitCode: result.exitCode, complete: result.complete,
        neverSave: true, liveSupportClaimed: false }));
      process.exitCode = result.exitCode;
    }
  } catch (error) {
    const reason = typeof error?.code === 'string' && /^[a-z_]+$/u.test(error.code) ? error.code : 'harness_failed';
    console.log(JSON.stringify({ complete: false, reason, neverSave: true, liveSupportClaimed: false }));
    process.exitCode = 2;
  }
}
