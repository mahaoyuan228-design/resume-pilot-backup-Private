/**
 * Offline schema witnesses only: no DOM, native-site handler, browser, or live
 * success is represented. R2's "Daytime evidence still required" checklist
 * supplies the required observations; this suite checks artifact completeness.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as runner from '../scripts/live/cms-education-live.mjs';
import {
  EVIDENCE_SCHEMA_VERSION, REVIEWED_FILES, HOOK_NAMES,
  validateControlsDaytimeEvidence
} from '../scripts/validate-cms-education-controls-evidence.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'scripts/validate-cms-education-controls-evidence.mjs');
const CHECK_KEYS = ['policy', 'runner_report', 'timers', 'reviewed_bytes', 'page_boundaries', 'restoration'];
const SHA256 = 'ab'.repeat(32);
const TIP = 'cd'.repeat(20);

function schemaWitness() {
  const hooks = Object.fromEntries(HOOK_NAMES.map((name, index) => [name, {
    source: `function ${name.replaceAll('.', '_')}() { [native code] }`,
    configurable: true, enumerable: index % 2 === 0, writable: true, ownerDepth: index % 3
  }]));
  const boundary = { hasCmsLive: false, overlays: 0, bodyClickReached: true, hooks };
  const restoration = Object.fromEntries(['domSha256', 'publicPropsSha256', 'dtoSha256', 'neighborsSha256']
    .map((name, index) => [name, String(index + 1).repeat(64)]));
  const report = {
    tipSha: TIP, neverSave: true, liveSupportClaimed: false,
    fields: runner.fieldSpecsForRow(0, true).map(spec => ({
      q: spec.q, path: spec.path, status: 'verified', reason: 'readback_matched', value: structuredClone(spec.fixture)
    })),
    nonGet: [], saveLikePost: [], suppressedAutosave: [], suppressedLookup: [],
    finalDetails: {
      recordCount: 1, rowIndex: 0, controls: true, neverSave: true,
      liveSupportClaimed: false, moduleClaimedSupport: false,
      clickCount: 0, widgetClickCount: runner.CONTROL_SPECS.length + 1, bannedClick: false,
      widgetProbes: runner.CONTROL_SPECS.map(spec => ({
        key: spec.key, reason: null, openerClicks: 1, opened: true, closed: true,
        activation: { stage: 'complete', reason: null,
          events: ['mousedown', 'mouseup', 'click'], observedEvents: ['mousedown', 'mouseup', 'click'] }
      })),
      reason: null, restored: true, pageLeftAsFound: true, cleanupOk: true,
      otherChanged: false, waitedMs: runner.READBACK_WAIT_MS,
      timerSettle: { pendingTimers: 0, unobservableTimers: 0, observedNonFunctionTimeouts: 0 }, exitCode: 0
    }
  };
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION, neverSave: true, liveSupportClaimed: false, report,
    reviewedBytes: { tipSha: TIP, files: REVIEWED_FILES.map(file => ({
      path: file, reviewedSha256: SHA256, machineSha256: SHA256
    })) },
    boundaries: { before: structuredClone(boundary), after: structuredClone(boundary) },
    restoration: { before: structuredClone(restoration), after: structuredClone(restoration) }
  };
}

function assertIncomplete(artifact, key, label) {
  const result = validateControlsDaytimeEvidence(artifact);
  assert.equal(result.complete, false, label);
  assert.equal(result.liveSupportClaimed, false, label);
  assert.equal(result.checks.find(check => check.key === key)?.ok, false, `${label}: ${key}`);
  return result;
}

test('daytime validator accepts a complete schema witness without making a live support claim', () => {
  assert.equal(EVIDENCE_SCHEMA_VERSION, 1);
  assert.deepEqual(REVIEWED_FILES, [
    'scripts/live/cms-education-live.mjs', 'src/content/cms-education-serialization.mjs',
    ...runner.LIVE_FILES, ...runner.CONTROL_FILES
  ]);
  assert.deepEqual(HOOK_NAMES, ['fetch', 'click', 'submit', 'requestSubmit', 'XHR.open', 'XHR.send', 'XHR.abort',
    'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'sendBeacon']);
  const artifact = schemaWitness(), before = structuredClone(artifact);
  assert.equal(runner.evidenceExitCode(artifact.report), 0);
  assert.deepEqual(validateControlsDaytimeEvidence(artifact), {
    schemaVersion: 1, complete: true,
    checks: CHECK_KEYS.map(key => ({ key, ok: true })), reportExitCode: 0, liveSupportClaimed: false
  });
  assert.deepEqual(artifact, before, 'validation does not mutate caller evidence');
});

test('an incomplete artifact is rejected without throwing or inventing missing observations', () => {
  for (const artifact of [undefined, null, false, [], {}, { schemaVersion: 1, neverSave: true, liveSupportClaimed: false }]) {
    const result = validateControlsDaytimeEvidence(artifact);
    assert.equal(result.complete, false);
    assert.equal(result.liveSupportClaimed, false);
    assert.deepEqual(result.checks.map(check => check.key), CHECK_KEYS);
    assert.ok(result.checks.some(check => !check.ok));
  }
});

test('policy flags require the explicit supported schema and Never-Save scope', () => {
  for (const [key, value] of [['schemaVersion', undefined], ['schemaVersion', 2], ['schemaVersion', '1'],
    ['neverSave', undefined], ['neverSave', false], ['liveSupportClaimed', undefined], ['liveSupportClaimed', true]]) {
    const artifact = schemaWitness();
    if (value === undefined) delete artifact[key]; else artifact[key] = value;
    assertIncomplete(artifact, 'policy', `${key}=${String(value)}`);
  }
});

test('legacy successful reports with absent or unsettled timer proof cannot complete the daytime artifact', () => {
  for (const timers of [undefined, null, {},
    { pendingTimers: 1, unobservableTimers: 0, observedNonFunctionTimeouts: 0 },
    { pendingTimers: 0, unobservableTimers: 1, observedNonFunctionTimeouts: 0 },
    { pendingTimers: 0, unobservableTimers: 0, observedNonFunctionTimeouts: -1 }]) {
    const artifact = schemaWitness();
    if (timers === undefined) delete artifact.report.finalDetails.timerSettle;
    else artifact.report.finalDetails.timerSettle = timers;
    assert.equal(runner.evidenceExitCode(artifact.report), 0, 'this is the distinct legacy report-validation gap');
    assertIncomplete(artifact, 'timers', JSON.stringify(timers));
  }
});

test('timer counters require safe nonnegative integers while observed non-function timeouts may be positive', () => {
  for (const key of ['pendingTimers', 'unobservableTimers', 'observedNonFunctionTimeouts']) {
    for (const value of [undefined, null, -1, 0.5, '0', Number.MAX_SAFE_INTEGER + 1]) {
      const artifact = schemaWitness();
      if (value === undefined) delete artifact.report.finalDetails.timerSettle[key];
      else artifact.report.finalDetails.timerSettle[key] = value;
      assertIncomplete(artifact, 'timers', `${key}=${String(value)}`);
    }
  }
  const artifact = schemaWitness();
  artifact.report.finalDetails.timerSettle.observedNonFunctionTimeouts = 4;
  assert.equal(validateControlsDaytimeEvidence(artifact).complete, true);
});

test('runner report requires controls scope, the full wait, and explicit Never-Save click boundaries', () => {
  for (const [key, value] of [['controls', false], ['controls', undefined],
    ['waitedMs', undefined], ['waitedMs', null], ['waitedMs', '500'], ['waitedMs', Infinity],
    ['waitedMs', runner.READBACK_WAIT_MS - 1], ['neverSave', undefined], ['neverSave', false],
    ['bannedClick', undefined], ['bannedClick', true]]) {
    const artifact = schemaWitness();
    if (value === undefined) delete artifact.report.finalDetails[key]; else artifact.report.finalDetails[key] = value;
    assertIncomplete(artifact, 'runner_report', `${key}=${String(value)}`);
  }
});

test('existing probe, traffic, suppression, readback, and restoration failures remain fatal', () => {
  const mutations = [
    ['missing degree probe', artifact => { artifact.report.finalDetails.widgetProbes = artifact.report.finalDetails.widgetProbes.filter(p => p.key !== 'degree'); }],
    ['unopened degree probe', artifact => { artifact.report.finalDetails.widgetProbes.find(p => p.key === 'degree').opened = false; }],
    ['duplicate probe key', artifact => { artifact.report.finalDetails.widgetProbes[1].key = 'school'; }],
    ['unobserved click', artifact => { artifact.report.finalDetails.widgetProbes[0].activation.observedEvents.pop(); }],
    ['uncounted opener', artifact => { artifact.report.finalDetails.widgetProbes[0].openerClicks = 0; }],
    ['missing generic traffic ledger', artifact => { delete artifact.report.nonGet; }],
    ['generic POST attempt', artifact => { artifact.report.nonGet.push({ method: 'POST', url: 'https://example.invalid/blocked', via: 'cdp' }); }],
    ['forbidden click', artifact => { artifact.report.finalDetails.clickCount = 1; }],
    ['malformed suppression', artifact => { artifact.report.suppressedLookup.push({ method: 'POST', blockedBeforeSend: false }); }],
    ['missing ninth readback', artifact => { artifact.report.fields.pop(); }],
    ['unrestored report', artifact => { artifact.report.finalDetails.restored = false; }],
    ['changed neighbor report', artifact => { artifact.report.finalDetails.otherChanged = true; }],
    ['claimed support', artifact => { artifact.report.liveSupportClaimed = true; }]
  ];
  for (const [label, mutate] of mutations) {
    const artifact = schemaWitness(); mutate(artifact);
    assertIncomplete(artifact, 'runner_report', label);
  }
});

test('malformed JSON-safe report containers fail closed even when the legacy validator throws', () => {
  for (const report of [null, [], { fields: {} }, { nonGet: {}, saveLikePost: {} },
    { finalDetails: { controls: true, recordCount: 1, rowIndex: 0 }, suppressedAutosave: [], suppressedLookup: [], fields: {} }]) {
    const artifact = schemaWitness(); artifact.report = report;
    assertIncomplete(artifact, 'runner_report', JSON.stringify(report));
  }
  const artifact = schemaWitness();
  // This JSON-safe method object prevents String(method) conversion in the
  // legacy classifier. The artifact validator must return an incomplete result.
  artifact.report.suppressedLookup = [{ method: { toString: null }, url: 'https://example.invalid/blocked' }];
  const before = structuredClone(artifact);
  assert.throws(() => runner.evidenceExitCode(artifact.report), TypeError);
  assertIncomplete(artifact, 'runner_report', 'malformed classifier input');
  assert.deepEqual(artifact, before, 'failed validation does not mutate evidence');
});

test('an array-like object cannot substitute for the nine readback fields array', () => {
  const artifact = schemaWitness(), fields = artifact.report.fields;
  artifact.report.fields = { ...fields, length: fields.length };
  assert.equal(runner.evidenceExitCode(artifact.report), 0,
    'the legacy verdict indexes fields and accepts this JSON-safe non-array');
  assertIncomplete(artifact, 'runner_report', 'array-like readback object');
});

test('reviewed bytes require the exact manifest, matching tip, and matching SHA-256 values', () => {
  for (const [label, mutate] of [
    ['missing manifest', artifact => { delete artifact.reviewedBytes; }],
    ['missing file', artifact => { artifact.reviewedBytes.files.pop(); }],
    ['duplicate file', artifact => { artifact.reviewedBytes.files[1] = structuredClone(artifact.reviewedBytes.files[0]); }],
    ['unknown file', artifact => { artifact.reviewedBytes.files.push({ path: 'unreviewed.js', reviewedSha256: SHA256, machineSha256: SHA256 }); }],
    ['mismatched machine bytes', artifact => { artifact.reviewedBytes.files[0].machineSha256 = 'ef'.repeat(32); }],
    ['invalid reviewed hash', artifact => { artifact.reviewedBytes.files[0].reviewedSha256 = 'not-a-hash'; }],
    ['invalid machine hash', artifact => { artifact.reviewedBytes.files[0].machineSha256 = 'a'.repeat(63); }],
    ['missing tip', artifact => { delete artifact.reviewedBytes.tipSha; }],
    ['mismatched tip', artifact => { artifact.reviewedBytes.tipSha = 'ef'.repeat(20); }],
    ['invalid report tip', artifact => { artifact.report.tipSha = 'not-a-tip'; }]
  ]) {
    const artifact = schemaWitness(); mutate(artifact);
    assertIncomplete(artifact, 'reviewed_bytes', label);
  }
});

test('manifest and hook order are immaterial and equivalent hash casing is accepted', () => {
  const artifact = schemaWitness();
  artifact.reviewedBytes.tipSha = TIP.toUpperCase();
  artifact.reviewedBytes.files.reverse();
  for (const file of artifact.reviewedBytes.files) file.machineSha256 = file.machineSha256.toUpperCase();
  artifact.boundaries.after.hooks = Object.fromEntries(Object.entries(artifact.boundaries.after.hooks).reverse());
  artifact.restoration.before.domSha256 = SHA256;
  artifact.restoration.after.domSha256 = SHA256.toUpperCase();
  assert.equal(validateControlsDaytimeEvidence(artifact).complete, true);
});

test('page boundaries require clean API, overlays, and native body-click evidence before and after', () => {
  for (const phase of ['before', 'after']) {
    for (const [key, value] of [['hasCmsLive', undefined], ['hasCmsLive', true],
      ['overlays', undefined], ['overlays', 1], ['overlays', '0'],
      ['bodyClickReached', undefined], ['bodyClickReached', false]]) {
      const artifact = schemaWitness();
      if (value === undefined) delete artifact.boundaries[phase][key]; else artifact.boundaries[phase][key] = value;
      assertIncomplete(artifact, 'page_boundaries', `${phase}.${key}=${String(value)}`);
    }
  }
});

test('hook evidence needs all twelve native sources and exact restored descriptor properties and owners', () => {
  for (const name of HOOK_NAMES) {
    const artifact = schemaWitness(); delete artifact.boundaries.before.hooks[name];
    assertIncomplete(artifact, 'page_boundaries', `missing ${name}`);
  }
  for (const [label, mutate] of [
    ['missing hooks', artifact => { delete artifact.boundaries.after.hooks; }],
    ['non-native source in both snapshots', artifact => {
      artifact.boundaries.before.hooks.fetch.source = artifact.boundaries.after.hooks.fetch.source = 'function fetch() { return blocked(); }';
    }],
    ['changed native source', artifact => { artifact.boundaries.after.hooks.fetch.source = 'function changed() { [native code] }'; }],
    ['missing descriptor property', artifact => { delete artifact.boundaries.after.hooks.fetch.enumerable; }],
    ['non-boolean descriptor property', artifact => { artifact.boundaries.before.hooks.fetch.configurable = artifact.boundaries.after.hooks.fetch.configurable = 'true'; }],
    ['changed descriptor property', artifact => { artifact.boundaries.after.hooks.fetch.writable = false; }],
    ['missing owner depth', artifact => { delete artifact.boundaries.after.hooks.fetch.ownerDepth; }],
    ['negative owner depth', artifact => { artifact.boundaries.before.hooks.fetch.ownerDepth = artifact.boundaries.after.hooks.fetch.ownerDepth = -1; }],
    ['fractional owner depth', artifact => { artifact.boundaries.before.hooks.fetch.ownerDepth = artifact.boundaries.after.hooks.fetch.ownerDepth = 0.5; }],
    ['unsafe owner depth', artifact => { artifact.boundaries.before.hooks.fetch.ownerDepth = artifact.boundaries.after.hooks.fetch.ownerDepth = Number.MAX_SAFE_INTEGER + 1; }],
    ['inherited owner replaced by own shadow', artifact => {
      artifact.boundaries.before.hooks.sendBeacon.ownerDepth = 1;
      artifact.boundaries.after.hooks.sendBeacon.ownerDepth = 0;
    }]
  ]) {
    const artifact = schemaWitness(); mutate(artifact);
    assertIncomplete(artifact, 'page_boundaries', label);
  }
});

test('restoration evidence requires matching DOM, public props, DTO, and neighbor hashes', () => {
  for (const key of ['domSha256', 'publicPropsSha256', 'dtoSha256', 'neighborsSha256']) {
    for (const [label, value] of [['missing', undefined], ['invalid', 'not-a-hash'], ['changed', SHA256]]) {
      const artifact = schemaWitness();
      if (value === undefined) delete artifact.restoration.after[key]; else artifact.restoration.after[key] = value;
      assertIncomplete(artifact, 'restoration', `${key} ${label}`);
    }
  }
  const artifact = schemaWitness(); delete artifact.restoration.before;
  assertIncomplete(artifact, 'restoration', 'missing before snapshot');
});

test('CLI validates saved artifacts offline and reports incomplete or invalid inputs without echoing them', t => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-edu-evidence-validator-'));
  t.after(() => {
    assert.ok(path.resolve(outDir).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(outDir, { recursive: true, force: true });
  });
  const artifactPath = path.join(outDir, 'artifact.json');
  fs.writeFileSync(artifactPath, JSON.stringify(schemaWitness()), 'utf8');
  const success = spawnSync(process.execPath, [cli, artifactPath], { cwd: root, encoding: 'utf8' });
  assert.equal(success.status, 0, success.stderr);
  assert.equal(JSON.parse(success.stdout).complete, true);
  const incomplete = schemaWitness(); incomplete.report.finalDetails.timerSettle.pendingTimers = 1;
  fs.writeFileSync(artifactPath, JSON.stringify(incomplete), 'utf8');
  const failed = spawnSync(process.execPath, [cli, artifactPath], { cwd: root, encoding: 'utf8' });
  assert.equal(failed.status, 2, failed.stderr);
  assert.equal(JSON.parse(failed.stdout).complete, false);
  const marker = 'PRIVATE_INPUT_MUST_NOT_BE_ECHOED';
  fs.writeFileSync(artifactPath, `{\"${marker}\":`, 'utf8');
  const invalid = spawnSync(process.execPath, [cli, artifactPath], { cwd: root, encoding: 'utf8' });
  assert.equal(invalid.status, 2);
  assert.equal(`${invalid.stdout}${invalid.stderr}`.includes(marker), false);
});
