#!/usr/bin/env node
/**
 * Offline completeness check for a retained Never-Save CONTROLS=1 evidence pack.
 * Reads JSON only: no CDP, browser, page evaluation, mutation, or capture defaults.
 * A complete artifact is not authentication of its observations or live support.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evidenceExitCode, LIVE_FILES, CONTROL_FILES, READBACK_WAIT_MS
} from './live/cms-education-live.mjs';

export const EVIDENCE_SCHEMA_VERSION = 1;
export const REVIEWED_FILES = Object.freeze([
  'scripts/live/cms-education-live.mjs',
  'src/content/cms-education-serialization.mjs',
  ...LIVE_FILES, ...CONTROL_FILES
]);
// Same descriptor boundaries retained by the existing fake-CDP success test.
export const HOOK_NAMES = Object.freeze([
  'fetch', 'click', 'submit', 'requestSubmit', 'XHR.open', 'XHR.send', 'XHR.abort',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'sendBeacon'
]);
const RESTORATION_HASHES = ['domSha256', 'publicPropsSha256', 'dtoSha256', 'neighborsSha256'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sha256 = value => typeof value === 'string' && /^[0-9a-f]{64}$/iu.test(value);
const sameHash = (left, right) => sha256(left) && sha256(right) && left.toLowerCase() === right.toLowerCase();
const count = value => Number.isSafeInteger(value) && value >= 0;

function validReviewedBytes(bytes, report) {
  return object(bytes) && typeof bytes.tipSha === 'string' && /^[0-9a-f]{40}$/iu.test(bytes.tipSha)
    && typeof report?.tipSha === 'string' && bytes.tipSha.toLowerCase() === report.tipSha.toLowerCase()
    && Array.isArray(bytes.files) && bytes.files.length === REVIEWED_FILES.length
    && REVIEWED_FILES.every(file => bytes.files.filter(row => row?.path === file
      && sameHash(row.reviewedSha256, row.machineSha256)).length === 1);
}

function validHook(hook) {
  // This is retained source/descriptor evidence, not proof of native identity.
  return object(hook) && typeof hook.source === 'string'
    && /^function\b[^{}]*\{\s*\[native code\]\s*\}$/u.test(hook.source.trim())
    && count(hook.ownerDepth)
    && ['configurable', 'enumerable', 'writable'].every(key => typeof hook[key] === 'boolean');
}

function validBoundary(boundary) {
  return object(boundary) && boundary.hasCmsLive === false && boundary.overlays === 0
    && boundary.bodyClickReached === true && object(boundary.hooks)
    && Object.keys(boundary.hooks).length === HOOK_NAMES.length
    && HOOK_NAMES.every(name => validHook(boundary.hooks[name]));
}

function validBoundaries(boundaries) {
  const before = boundaries?.before, after = boundaries?.after;
  return validBoundary(before) && validBoundary(after)
    && HOOK_NAMES.every(name => ['source', 'ownerDepth', 'configurable', 'enumerable', 'writable']
      .every(key => before.hooks[name][key] === after.hooks[name][key]));
}

function validRestoration(restoration) {
  return object(restoration?.before) && object(restoration?.after)
    && RESTORATION_HASHES.every(key => sameHash(restoration.before[key], restoration.after[key]));
}

function validSuppressionShapes(report) {
  // The host reads these rows with method.toUpperCase(). The legacy URL
  // classifiers coerce methods, so ['POST'] otherwise passes retained evidence.
  // Lookup abort failures take the fatal generic-traffic path before a row is
  // recorded. The legacy lookup check ignores abortFailed, so reject retained
  // rows that contradict successful suppression, including malformed flags.
  // Keep endpoint, ownership, transport, phase and before-send checks in the runner.
  return ['suppressedAutosave', 'suppressedLookup'].every(key => Array.isArray(report?.[key])
    && report[key].every(row => object(row) && typeof row.method === 'string'
      && (row.abortFailed === undefined || row.abortFailed === false)));
}

export function validateControlsDaytimeEvidence(artifact) {
  const report = artifact?.report;
  const details = report?.finalDetails;
  // Reuse the shipped bounded classifiers, seven probe and nine readback checks.
  // Never trust a caller's stored finalDetails.exitCode, and fail malformed input.
  let reportExitCode = 2;
  try { reportExitCode = evidenceExitCode(report); } catch { /* incomplete report */ }
  const timers = details?.timerSettle;
  const checks = [
    { key: 'policy', ok: object(artifact) && artifact.schemaVersion === EVIDENCE_SCHEMA_VERSION
      && artifact.neverSave === true && artifact.liveSupportClaimed === false },
    { key: 'runner_report', ok: object(report) && object(details) && Array.isArray(report.fields)
      && validSuppressionShapes(report)
      && reportExitCode === 0 && details.controls === true
      && details.neverSave === true && details.bannedClick === false
      && typeof details.waitedMs === 'number' && Number.isFinite(details.waitedMs)
      && details.waitedMs >= READBACK_WAIT_MS },
    { key: 'timers', ok: object(timers)
      && ['pendingTimers', 'unobservableTimers', 'observedNonFunctionTimeouts'].every(key => count(timers[key]))
      && timers.pendingTimers === 0 && timers.unobservableTimers === 0 },
    { key: 'reviewed_bytes', ok: validReviewedBytes(artifact?.reviewedBytes, report) },
    { key: 'page_boundaries', ok: validBoundaries(artifact?.boundaries) },
    { key: 'restoration', ok: validRestoration(artifact?.restoration) }
  ];
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION, complete: checks.every(check => check.ok),
    checks, reportExitCode, liveSupportClaimed: false
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv.length === 3 && process.argv[2] === '--help') {
    console.log('Usage: node scripts/validate-cms-education-controls-evidence.mjs <evidence-pack.json>');
    console.log('Offline JSON validation only. Exit 0: complete; exit 2: incomplete/invalid. liveSupportClaimed=false.');
  } else {
    let result;
    try {
      if (process.argv.length !== 3) throw new Error('input_required');
      result = validateControlsDaytimeEvidence(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
    } catch {
      // Do not echo applicant values, source JSON, local paths, or parser errors.
      result = { schemaVersion: EVIDENCE_SCHEMA_VERSION, complete: false,
        checks: [{ key: 'input_json', ok: false }], reportExitCode: null, liveSupportClaimed: false };
    }
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.complete ? 0 : 2;
  }
}
