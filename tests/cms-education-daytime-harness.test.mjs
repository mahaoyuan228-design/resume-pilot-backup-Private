/**
 * Offline harness tests. All CDP replies below are explicitly fictional unit
 * fixtures; this suite never attaches a browser or retains a daytime pass pack.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';
import {
  BASE_TIP, CHECKLIST, prepareDaytimeHarness, collectDaytimeHarness, createObservedConnector
} from '../scripts/cms-education-daytime-harness.mjs';
import { REVIEWED_FILES, HOOK_NAMES } from '../scripts/validate-cms-education-controls-evidence.mjs';
import { fieldSpecsForRow, CONTROL_SPECS, READBACK_WAIT_MS } from '../scripts/live/cms-education-live.mjs';
import { CMS_BASELINE_PAGE } from '../scripts/lib/cms-page-target.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'scripts/cms-education-daytime-harness.mjs');
const scratchParent = path.join(root, '_temp-scripts');

function scratch(t) {
  fs.mkdirSync(scratchParent, { recursive: true });
  const directory = fs.mkdtempSync(path.join(scratchParent, 'daytime-harness-unit-'));
  t.after(() => {
    assert.ok(directory.startsWith(scratchParent + path.sep));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return directory;
}

function jsonFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return jsonFiles(filename);
    return entry.name.endsWith('.json') ? [{ filename, value: JSON.parse(fs.readFileSync(filename, 'utf8')) }] : [];
  });
}

async function approvedInputs(t) {
  const directory = scratch(t), prepared = path.join(directory, 'prepared');
  await prepareDaytimeHarness({ outDir: prepared });
  const candidate = jsonFiles(prepared).find(({ value }) => value.approved === false && Array.isArray(value.files));
  assert.ok(candidate, 'prepare emits an unapproved manifest candidate');
  const approvedManifest = path.join(directory, 'approved-manifest.json');
  fs.writeFileSync(approvedManifest, JSON.stringify({ ...candidate.value, approved: true }));
  return { directory, approvedManifest, manifest: candidate.value,
    outDir: path.join(directory, 'collected'), machineRoot: root, neverSave: true, controls: '1' };
}

function noAttachOptions() {
  const calls = [];
  const blocked = name => async () => { calls.push(name); throw new Error('unexpected_network'); };
  return { calls, runLive: blocked('runLive'), connectCdp: blocked('connectCdp'), getJson: blocked('getJson') };
}

async function refusesBeforeAttach(options, checkOutput = true) {
  const denied = noAttachOptions();
  await assert.rejects(collectDaytimeHarness({ ...options, ...denied }), error => {
    assert.match(error.message, /^[a-z0-9_]+$/u, 'preconditions expose safe codes only');
    return true;
  });
  assert.deepEqual(denied.calls, []);
  if (checkOutput) assert.equal(fs.existsSync(options.outDir), false, 'preconditions precede output creation');
}

test('default and help are offline and have no collection side effects', t => {
  const directory = scratch(t);
  const networkBlock = 'data:text/javascript,' + encodeURIComponent(`
    import http from 'node:http'; import https from 'node:https'; import net from 'node:net';
    const refuse = () => { throw new Error('offline_test_network_forbidden'); };
    http.get = http.request = https.get = https.request = net.Socket.prototype.connect = refuse;
  `);
  for (const [index, args] of [['--out', path.join(directory, 'default-prepare')], ['--help']].entries()) {
    const result = spawnSync(process.execPath, ['--import', networkBlock, cli, ...args], {
      cwd: directory, encoding: 'utf8', timeout: 10000,
      env: { ...process.env, PORT: 'invalid-no-browser-port', CONTROLS: '1' }
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /prepare|Usage/u);
    if (index === 0) {
      const status = JSON.parse(fs.readFileSync(path.join(directory, 'default-prepare', 'collector-status.json'), 'utf8'));
      assert.equal(status.complete, false);
      assert.equal(status.collected, false);
    }
    assert.deepEqual(fs.readdirSync(directory), ['default-prepare']);
  }
});

test('prepare records exact reviewed checkout bytes and pinned Git provenance without approval', async t => {
  const directory = scratch(t), outDir = path.join(directory, 'prepared');
  await prepareDaytimeHarness({ outDir });
  const candidate = jsonFiles(outDir).find(({ value }) => value.approved === false && Array.isArray(value.files));
  assert.ok(candidate);
  assert.equal(candidate.value.tipSha, BASE_TIP);
  assert.equal(candidate.value.neverSave, true);
  assert.equal(candidate.value.liveSupportClaimed, false);
  assert.deepEqual(candidate.value.files.map(row => row.path), [...REVIEWED_FILES]);
  for (const row of candidate.value.files) {
    const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
    assert.equal(row.reviewedSha256, hash(fs.readFileSync(path.join(root, row.path))));
    assert.equal(row.reviewedBlobSha256, hash(execFileSync('git', ['show', `${BASE_TIP}:${row.path}`], { cwd: root })));
  }
  assert.equal(jsonFiles(outDir).some(({ value }) => value.complete === true), false);
});

test('collection requires explicit Never-Save and CONTROLS=1 before attach or output', async t => {
  const options = await approvedInputs(t);
  for (const neverSave of [undefined, false, 'true']) await refusesBeforeAttach({ ...options, neverSave });
  for (const controls of [undefined, false, true, '0', 1]) await refusesBeforeAttach({ ...options, controls });
});

test('unapproved, wrong-tip, and altered-byte manifests refuse before attaching', async t => {
  const options = await approvedInputs(t);
  const variants = [
    { ...options.manifest, approved: false },
    { ...options.manifest, approved: true, tipSha: '0'.repeat(40) },
    { ...options.manifest, approved: true, files: options.manifest.files.map((row, index) =>
      index === 0 ? { ...row, reviewedSha256: '0'.repeat(64) } : row) }
  ];
  for (const manifest of variants) {
    fs.writeFileSync(options.approvedManifest, JSON.stringify(manifest));
    await refusesBeforeAttach(options);
  }
});

test('deployed machine bytes are checked independently before attaching', async t => {
  const options = await approvedInputs(t), machineRoot = path.join(options.directory, 'machine');
  for (const file of REVIEWED_FILES) {
    const destination = path.join(machineRoot, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(root, file), destination);
  }
  fs.appendFileSync(path.join(machineRoot, REVIEWED_FILES[0]), '\n// offline unit byte mismatch\n');
  await refusesBeforeAttach({ ...options, machineRoot });
});

test('a substituted machine and caller repoRoot cannot bypass the imported runner byte check', async t => {
  const options = await approvedInputs(t), machineRoot = path.join(options.directory, 'substituted-machine');
  const files = options.manifest.files.map(row => {
    const destination = path.join(machineRoot, row.path);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const bytes = Buffer.concat([fs.readFileSync(path.join(root, row.path)), Buffer.from('\n// fictional substituted bytes\n')]);
    fs.writeFileSync(destination, bytes);
    return { ...row, reviewedSha256: crypto.createHash('sha256').update(bytes).digest('hex') };
  });
  fs.writeFileSync(options.approvedManifest, JSON.stringify({ ...options.manifest, approved: true, files }));
  await refusesBeforeAttach({ ...options, machineRoot, repoRoot: machineRoot });
});

test('tracked repository paths cannot receive private collection artifacts', async t => {
  const options = await approvedInputs(t);
  await refusesBeforeAttach({ ...options, outDir: path.join(root, 'tests', path.basename(options.directory)) });
});

test('collection refuses an existing output directory and preserves its bytes', async t => {
  const options = await approvedInputs(t);
  fs.mkdirSync(options.outDir);
  const existing = path.join(options.outDir, 'operator-evidence.txt');
  fs.writeFileSync(existing, 'existing operator evidence');
  await refusesBeforeAttach(options, false);
  assert.equal(fs.readFileSync(existing, 'utf8'), 'existing operator evidence');
  assert.deepEqual(fs.readdirSync(options.outDir), ['operator-evidence.txt']);
});

function observationState() {
  return { before: null, after: null, prepare: null, run: null, cleanup: null, steps: [], errors: [] };
}

function fictionalReplies() {
  const timerSettle = { pendingTimers: 0, unobservableTimers: 0, observedNonFunctionTimeouts: 0 };
  const widgetProbes = CONTROL_SPECS.map(({ key }) => ({ key, reason: null, openerClicks: 1,
    opened: true, closed: true, activation: { stage: 'complete', reason: null,
      events: ['mousedown', 'mouseup', 'click'], observedEvents: ['mousedown', 'mouseup', 'click'] } }));
  const boundary = { hasCmsLive: false, overlays: 0, bodyClickReached: true,
    hooks: Object.fromEntries(HOOK_NAMES.map(name => [name, { source: 'function fictionalNative() { [native code] }',
      ownerDepth: 0, configurable: true, enumerable: false, writable: true }])) };
  // Tagged unit data deliberately preserves missing/empty/raw distinctions.
  const snapshots = {
    dom: ['object', [['original', ['string', '  fictional unit original  ']]]],
    publicProps: ['object', [['empty', ['string', '']], ['nil', ['null']], ['undefined', ['undefined']]]],
    dto: ['object', [['education', ['array', []]]]],
    neighbors: ['array', [['object', [['absentDistinction', ['undefined']]]]]]
  };
  const rawDom = { educationOuterHTML: '<section>fictional</section>', neighborOuterHTML: [] };
  const prepare = { ok: true, rowIndex: 0, recordCount: 1, identity: 'fictional-row', identities: ['fictional-row'],
    originals: [{ field: 'major', value: '  fictional unit original  ' }] };
  const run = { ok: true, rowIndex: 0, recordCount: 1, waitedMs: READBACK_WAIT_MS, restored: true,
    pageLeftAsFound: true, otherChanged: false, liveSupportClaimed: false,
    readbacks: fieldSpecsForRow(0, true).map(spec => ({ path: spec.path, ok: true,
      reason: 'readback_matched', value: structuredClone(spec.fixture) })) };
  const cleanup = { ok: true, timerSettle, posts: [], clicks: [], suppressedAutosave: [], suppressedLookup: [],
    widgetClickCount: CONTROL_SPECS.length + 1, widgetProbes };
  const report = { tipSha: BASE_TIP, neverSave: true, liveSupportClaimed: false,
    fields: fieldSpecsForRow(0, true).map(spec => ({ q: spec.q, path: spec.path, status: 'verified',
      reason: 'readback_matched', value: structuredClone(spec.fixture) })),
    nonGet: [], saveLikePost: [], suppressedAutosave: [], suppressedLookup: [],
    finalDetails: { rowIndex: 0, recordCount: 1, controls: true, neverSave: true, liveSupportClaimed: false,
      moduleClaimedSupport: false, reason: null, cleanupOk: true, restored: true, pageLeftAsFound: true,
      otherChanged: false, clickCount: 0, widgetClickCount: cleanup.widgetClickCount, bannedClick: false,
      widgetProbes, timerSettle, waitedMs: READBACK_WAIT_MS, exitCode: 0 } };
  return { before: { boundary, snapshots, rawDom }, after: { boundary: structuredClone(boundary),
    snapshots: structuredClone(snapshots), rawDom: structuredClone(rawDom),
    identity: { hooksRestored: true, globalsRestored: true, contextUnchanged: true } },
    prepare, run, cleanup, report };
}

function fakeSession(replies, options = {}) {
  const calls = [];
  return { calls, close() { calls.push({ method: 'close' }); }, async send(method, params, callOptions = {}) {
    const step = callOptions.step;
    calls.push({ method, params, step });
    if (options.failAtStep === step) throw new Error('private protocol failure must never escape');
    if (step === 'capture_before_create') {
      if (options.failBeforeCreate) throw new Error('private applicant detail must never escape');
      return { result: { objectId: 'fictional-capture-object' } };
    }
    if (method === 'Runtime.callFunctionOn') {
      if (params.functionDeclaration.includes('this.before')) return { result: { value: replies.before } };
      if (options.failAfter) throw new Error('private failure detail must never escape');
      return { result: { value: replies.after } };
    }
    const key = { education_prepare: 'prepare', education_run: 'run', cleanup: 'cleanup' }[step];
    const value = key ? replies[key] : Object.hasOwn(options.answers || {}, step) ? options.answers[step] : { ok: true };
    return method === 'Runtime.evaluate' ? { result: { value } } : {};
  } };
}

async function driveObservedSession(session) {
  for (const step of ['install_live', 'education_prepare', 'education_run', 'cleanup']) {
    await session.send('Runtime.evaluate', { expression: `fictional_${step}()`, returnByValue: true }, { step, timeoutMs: 1000 });
  }
  await session.send('Fetch.disable', {}, { step: 'fetch_disable', timeoutMs: 1000 });
  session.close();
}

test('connector retains actual replies on one session and releases capture before Fetch.disable', async () => {
  const replies = fictionalReplies(), state = observationState(), raw = fakeSession(replies);
  let connections = 0;
  const connectionOptions = { timeoutMs: 1000, onEvent() {} };
  const connect = createObservedConnector(async (url, options) => {
    connections++;
    assert.equal(url, 'ws://127.0.0.1:9239/fictional-unit');
    assert.equal(options, connectionOptions);
    return raw;
  }, 'fictional_read_only_capture()', state);
  await driveObservedSession(await connect('ws://127.0.0.1:9239/fictional-unit', connectionOptions));
  assert.equal(connections, 1);
  for (const key of ['before', 'after', 'prepare', 'run', 'cleanup']) assert.deepEqual(state[key], replies[key]);
  assert.deepEqual(state.errors, []);
  const index = step => raw.calls.findIndex(call => call.step === step);
  assert.ok(index('capture_before_create') < index('install_live'));
  assert.ok(index('capture_before') < index('install_live'));
  assert.ok(index('cleanup') < index('capture_after'));
  assert.ok(index('capture_after') < index('capture_release'));
  assert.ok(index('capture_release') < index('fetch_disable'));
  assert.equal(raw.calls.at(-1).method, 'close');
  const capture = raw.calls.find(call => call.step === 'capture_before_create');
  assert.equal(capture.params.returnByValue, false);
  assert.equal(typeof capture.params.objectGroup, 'string');
  assert.equal(raw.calls.find(call => call.step === 'capture_release').params.objectGroup, capture.params.objectGroup);
});

test('failed before capture prevents guard installation and exposes only a safe error code', async () => {
  const replies = fictionalReplies(), state = observationState(), raw = fakeSession(replies, { failBeforeCreate: true });
  const connect = createObservedConnector(async () => raw, 'fictional_capture()', state);
  const session = await connect('ws://127.0.0.1:9239/fictional-unit', {});
  await assert.rejects(session.send('Runtime.evaluate', { expression: 'fictional_install()' }, { step: 'install_live' }),
    /^Error: capture_before_failed$/u);
  await session.send('Fetch.disable', {}, { step: 'fetch_disable' });
  session.close();
  assert.equal(raw.calls.some(call => call.step === 'install_live'), false);
  assert.equal(raw.calls.some(call => call.step === 'fetch_disable'), true);
  assert.deepEqual(state.errors, ['capture_before_failed']);
  assert.equal(state.before, null);
});

test('after-capture failure still permits interception teardown and closing the session', async () => {
  const replies = fictionalReplies(), state = observationState(), raw = fakeSession(replies, { failAfter: true });
  const connect = createObservedConnector(async () => raw, 'fictional_capture()', state);
  await driveObservedSession(await connect('ws://127.0.0.1:9239/fictional-unit', {}));
  assert.equal(state.after, null);
  assert.deepEqual(state.errors, ['capture_after_failed']);
  const release = raw.calls.findIndex(call => call.step === 'capture_release');
  const disable = raw.calls.findIndex(call => call.step === 'fetch_disable');
  assert.ok(release >= 0 && release < disable);
  assert.equal(raw.calls.at(-1).method, 'close');
  assert.deepEqual(state.cleanup, replies.cleanup);
});

async function collectFictional(t, modify = () => {}, fakeOptions = {}, drive = true) {
  const options = await approvedInputs(t), replies = fictionalReplies();
  modify(replies);
  const raw = fakeSession(replies, fakeOptions);
  const result = await collectDaytimeHarness({ ...options, getJson: async () => { throw new Error('unexpected_network'); },
    connectCdp: async () => raw,
    runLive: async runnerOptions => {
      assert.equal(runnerOptions.controls, true);
      assert.equal(runnerOptions.env.CONTROLS, '1');
      if (drive) await driveObservedSession(await runnerOptions.connectCdp('ws://127.0.0.1:9239/fictional-unit', {}));
      fs.writeFileSync(path.join(runnerOptions.outDir, 'cms-education-live.json'),
        fakeOptions.reportText ?? JSON.stringify(replies.report));
      return replies.report;
    }
  });
  return { ...options, result, replies, raw };
}

function assertChecklistBindings(checklist, artifacts) {
  assert.ok(Array.isArray(checklist) && checklist.length === 7, 'all seven checklist rows are retained');
  assert.deepEqual(checklist.map(row => row.key), ['bytes_clean_page', 'seven_visible_probes',
    'suppression_traffic_clicks', 'nine_readbacks', 'restoration_neighbors', 'settled_callbacks', 'cleanup']);
  for (const row of checklist) {
    assert.ok(Array.isArray(row.bindings) && row.bindings.length > 0, `${row.key} requires nonempty bindings`);
    assert.deepEqual(row.files, [...new Set(row.bindings.map(binding => binding.file))]);
    assert.deepEqual(row.fields, [...new Set(row.bindings.map(binding => binding.path))]);
    for (const binding of row.bindings) {
      assert.ok(typeof binding.file === 'string' && binding.file.length > 0, 'binding file is required');
      assert.ok(typeof binding.path === 'string' && binding.path.length > 0, 'binding path is required');
      assert.ok(Object.hasOwn(artifacts, binding.file), `missing checklist evidence file: ${binding.file}`);
      let value = artifacts[binding.file];
      for (const part of binding.path.split('.')) {
        assert.ok(part && value !== null && typeof value === 'object' && Object.hasOwn(value, part),
          `missing checklist evidence path: ${binding.file}:${binding.path}`);
        value = value[part];
      }
    }
  }
}

function assertDiagnostic(status, expected) {
  assert.ok(Array.isArray(status.diagnostics), 'collector emits safe incomplete-pack diagnostics');
  assert.ok(status.diagnostics.some(row => Object.keys(expected).every(key => row[key] === expected[key])),
    `missing diagnostic: ${JSON.stringify(expected)}`);
}

function assertSafeDiagnostics(status) {
  assert.ok(Array.isArray(status.diagnostics));
  for (const row of status.diagnostics) {
    assert.deepEqual(Object.keys(row).sort(), ['file', 'key', 'path', 'reason']);
    assert.ok(CHECKLIST.some(item => item.key === row.key), 'diagnostics use the existing seven checklist keys');
    assert.match(row.file, /^[a-z-]+\.json$/u, 'diagnostics name fixed local artifacts only');
    assert.match(row.path, /^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*$/u);
    assert.match(row.reason, /^[a-z_]+$/u, 'diagnostics contain safe reason codes only');
  }
}

test('checklist binds every requirement to emitted fictional artifacts and matches offline prepare', async t => {
  const collected = await collectFictional(t);
  const artifacts = Object.fromEntries(jsonFiles(collected.outDir).map(({ filename, value }) => [path.basename(filename), value]));
  const prepared = JSON.parse(fs.readFileSync(path.join(collected.directory, 'prepared', 'checklist.json'), 'utf8'));
  assert.deepEqual(prepared, artifacts['checklist.json']);
  assert.deepEqual(artifacts['checklist.json'], CHECKLIST);
  assertChecklistBindings(artifacts['checklist.json'], artifacts);
});

test('checklist coverage rejects missing bindings and old pack paths applied to standalone artifacts', async t => {
  const collected = await collectFictional(t);
  const artifacts = Object.fromEntries(jsonFiles(collected.outDir).map(({ filename, value }) => [path.basename(filename), value]));
  for (const bindings of [undefined, []]) {
    const missing = structuredClone(CHECKLIST);
    missing[0].bindings = bindings;
    assert.throws(() => assertChecklistBindings(missing, artifacts), /requires nonempty bindings/u);
  }
  for (const [file, path] of [
    ['reviewed-bytes.json', 'reviewedBytes.files'],
    ['snapshots-before.json', 'boundaries.before'],
    ['cms-education-live.json', 'report.finalDetails.widgetProbes']
  ]) {
    const wrongRoot = structuredClone(CHECKLIST);
    const row = wrongRoot.find(item => item.bindings?.some(binding => binding.file === file));
    assert.ok(row, `the actual checklist binds ${file}`);
    row.bindings = [{ file, path }];
    row.files = [file];
    row.fields = [path];
    assert.throws(() => assertChecklistBindings(wrongRoot, artifacts), /missing checklist evidence path/u);
  }
});

test('collector retains fictional unit observations separately from the runner report', async t => {
  const collected = await collectFictional(t);
  assert.equal(collected.result.complete, true, 'unit witness tests the success wiring only; no live evidence');
  assert.equal(collected.result.exitCode, 0);
  assert.equal(collected.result.neverSave, true);
  assert.equal(collected.result.liveSupportClaimed, false);
  for (const [filename, key] of [['snapshots-before.json', 'before'], ['snapshots-after.json', 'after'],
    ['prepare.json', 'prepare'], ['readbacks.json', 'run'], ['cleanup.json', 'cleanup']]) {
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(collected.outDir, filename), 'utf8')), collected.replies[key]);
  }
  const status = JSON.parse(fs.readFileSync(path.join(collected.outDir, 'collector-status.json'), 'utf8'));
  assert.deepEqual(status, collected.result);
  assert.equal(status.suppressionExercised.autosave, false);
  assert.equal(status.suppressionExercised.lookup, false);
  assert.deepEqual(status.diagnostics, [], 'false, zero, and empty traffic/suppression ledgers are present observations');
});

test('missing observed steps cannot be filled from a successful-looking runner report', async t => {
  const collected = await collectFictional(t, () => {}, {}, false);
  assert.equal(collected.result.complete, false);
  assert.notEqual(collected.result.exitCode, 0);
  assert.equal(collected.result.observationsComplete, false);
  assert.equal(fs.existsSync(path.join(collected.outDir, 'readbacks.json')), false);
  for (const [key, file, path] of [
    ['bytes_clean_page', 'snapshots-before.json', 'boundary'],
    ['restoration_neighbors', 'snapshots-after.json', 'snapshots.dom'],
    ['cleanup', 'snapshots-after.json', 'identity']
  ]) assertDiagnostic(collected.result, { key, file, path, reason: 'artifact_missing' });
  assertSafeDiagnostics(collected.result);
});

test('raw DOM must actually be captured on both sides even when schema hashes match', async t => {
  for (const missing of ['before', 'after']) {
    const collected = await collectFictional(t, replies => { delete replies[missing].rawDom; });
    assert.equal(collected.result.schemaComplete, true, 'schema v1 deliberately covers the existing semantic hashes only');
    assert.equal(collected.result.complete, false);
    assert.equal(collected.result.rawDomCaptured, false);
    assert.equal(collected.result.rawDomEqual, false);
    assert.notEqual(collected.result.exitCode, 0);
    const filename = `snapshots-${missing}.json`;
    const retained = JSON.parse(fs.readFileSync(path.join(collected.outDir, filename), 'utf8'));
    assert.equal(Object.hasOwn(retained, 'rawDom'), false, 'missing raw observations are never synthesized');
    for (const path of ['rawDom.educationOuterHTML', 'rawDom.neighborOuterHTML']) {
      assertDiagnostic(collected.result, { key: 'restoration_neighbors', file: filename, path, reason: 'path_missing' });
    }
  }
});

test('raw whitespace, attribute, and neighbor markup changes cannot hide behind equal semantic hashes', async t => {
  for (const [changed, mutate] of [
    ['educationOuterHTML', rawDom => { rawDom.educationOuterHTML = '<section> fictional</section>'; }],
    ['educationOuterHTML', rawDom => { rawDom.educationOuterHTML = '<section data-unit="changed">fictional</section>'; }],
    ['neighborOuterHTML', rawDom => { rawDom.neighborOuterHTML.push('<section>fictional neighboring markup</section>'); }]
  ]) {
    const collected = await collectFictional(t, replies => { mutate(replies.after.rawDom); });
    assert.equal(collected.result.schemaComplete, true);
    assert.equal(collected.result.complete, false);
    assert.equal(collected.result.rawDomCaptured, true);
    assert.equal(collected.result.rawDomEqual, false);
    assert.notEqual(collected.result.exitCode, 0);
    assertDiagnostic(collected.result, { key: 'restoration_neighbors', file: 'snapshots-after.json',
      path: `rawDom.${changed}`, reason: 'raw_dom_mismatch' });
    for (const stage of ['before', 'after']) {
      const retained = JSON.parse(fs.readFileSync(path.join(collected.outDir, `snapshots-${stage}.json`), 'utf8'));
      assert.deepEqual(retained.rawDom, collected.replies[stage].rawDom, 'all raw distinctions remain reviewable');
    }
  }
});

test('actual failed or missing readbacks stay incomplete and remain unmodified', async t => {
  const privateMarker = 'fictional-private-readback-marker-must-stay-in-raw-evidence';
  for (const [missing, mutate] of [
    [false, replies => { replies.run.readbacks[0] = { path: replies.run.readbacks[0].path, ok: false,
      reason: privateMarker, value: privateMarker }; }],
    [true, replies => { delete replies.run.readbacks; }]
  ]) {
    const collected = await collectFictional(t, mutate);
    assert.equal(collected.result.complete, false);
    assert.notEqual(collected.result.exitCode, 0);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(collected.outDir, 'readbacks.json'), 'utf8')), collected.replies.run);
    assertDiagnostic(collected.result, { key: 'nine_readbacks', file: 'observations.json',
      path: 'run.readbacks', reason: 'readbacks_mismatch' });
    if (missing) assertDiagnostic(collected.result, { key: 'nine_readbacks', file: 'observations.json',
      path: 'run.readbacks', reason: 'path_missing' });
    assertSafeDiagnostics(collected.result);
    assert.equal(JSON.stringify(collected.result.diagnostics).includes(privateMarker), false);
  }
});

test('incomplete-pack diagnostics distinguish terminal null from retained falsey observations', async t => {
  const missingValue = await collectFictional(t, replies => { replies.before.snapshots.dom = null; });
  assert.equal(missingValue.result.complete, false);
  assertDiagnostic(missingValue.result, { key: 'restoration_neighbors', file: 'snapshots-before.json',
    path: 'snapshots.dom', reason: 'value_null' });
  const nullSnapshot = JSON.parse(fs.readFileSync(path.join(missingValue.outDir, 'snapshots-before.json'), 'utf8'));
  assert.equal(nullSnapshot.snapshots.dom, null, 'diagnostics never synthesize a missing snapshot');

  const emptyValue = await collectFictional(t, replies => { replies.report.suppressedAutosave = ''; });
  assert.equal(emptyValue.result.complete, false, 'presence diagnostics do not relax the runner/validator verdict');
  assert.equal(emptyValue.result.diagnostics.some(row => row.file === 'cms-education-live.json'
    && row.path === 'suppressedAutosave' && ['artifact_missing', 'path_missing', 'value_null'].includes(row.reason)), false,
  'an observed empty string is present even though it has the wrong evidence type');
  assertSafeDiagnostics(emptyValue.result);
});

test('present but invalid raw DOM observations identify their side and field without exposing values', async t => {
  const privateMarker = 'fictional-private-invalid-raw-dom-marker';
  const collected = await collectFictional(t, replies => {
    replies.before.rawDom.educationOuterHTML = '';
    replies.after.rawDom.neighborOuterHTML = [privateMarker, null];
  });
  assert.equal(collected.result.schemaComplete, true, 'raw markup remains supplemental to schema version 1');
  assert.equal(collected.result.complete, false);
  assert.notEqual(collected.result.exitCode, 0);
  assert.equal(collected.result.rawDomCaptured, false);
  for (const [side, field] of [['before', 'educationOuterHTML'], ['after', 'neighborOuterHTML']]) {
    const file = `snapshots-${side}.json`, fieldPath = `rawDom.${field}`;
    assertDiagnostic(collected.result, { key: 'restoration_neighbors', file, path: fieldPath, reason: 'raw_dom_invalid' });
    assert.equal(collected.result.diagnostics.some(row => row.file === file && row.path === fieldPath
      && ['artifact_missing', 'path_missing', 'value_null'].includes(row.reason)), false,
    'invalid observed terminal values remain present');
    const retained = JSON.parse(fs.readFileSync(path.join(collected.outDir, file), 'utf8'));
    assert.deepEqual(retained.rawDom, collected.replies[side].rawDom, 'invalid raw observations remain unchanged');
  }
  assertSafeDiagnostics(collected.result);
  assert.equal(JSON.stringify(collected.result.diagnostics).includes(privateMarker), false);
});

test('identity mismatch diagnostics locate each supplemental flag without exposing observations', async t => {
  for (const flag of ['hooksRestored', 'globalsRestored', 'contextUnchanged']) {
    const collected = await collectFictional(t, replies => { replies.after.identity[flag] = false; });
    assert.equal(collected.result.schemaComplete, true, 'full identity remains outside schema version 1');
    assert.equal(collected.result.complete, false);
    assert.notEqual(collected.result.exitCode, 0);
    assertDiagnostic(collected.result, { key: 'cleanup', file: 'snapshots-after.json',
      path: `identity.${flag}`, reason: 'identity_mismatch' });
    const after = JSON.parse(fs.readFileSync(path.join(collected.outDir, 'snapshots-after.json'), 'utf8'));
    assert.equal(after.identity[flag], false, 'diagnostics preserve the actual failed identity observation');
    assertSafeDiagnostics(collected.result);
  }
});

test('diagnostics retain every actual supplement failure after an earlier prepare mismatch', async t => {
  const privateMarker = 'fictional-private-supplement-marker';
  const collected = await collectFictional(t, replies => {
    replies.prepare.identity = privateMarker;
    replies.run.waitedMs = READBACK_WAIT_MS - 1;
    replies.cleanup.ok = false;
    replies.cleanup.posts = [{ url: privateMarker }];
    replies.cleanup.clicks = [{ text: privateMarker }];
    replies.cleanup.timerSettle = { pendingTimers: 1, unobservableTimers: 0, observedNonFunctionTimeouts: 0 };
  });
  assert.equal(collected.result.schemaComplete, true, 'supplement diagnostics leave the independent report verdict unchanged');
  assert.equal(collected.result.actualTrialMatches, false);
  assert.equal(collected.result.complete, false);
  assert.notEqual(collected.result.exitCode, 0);
  for (const [key, path, reason] of [
    ['nine_readbacks', 'prepare', 'prepare_mismatch'],
    ['nine_readbacks', 'run', 'run_mismatch'],
    ['cleanup', 'cleanup.ok', 'cleanup_mismatch'],
    ['suppression_traffic_clicks', 'cleanup.posts', 'cleanup_traffic_mismatch'],
    ['suppression_traffic_clicks', 'cleanup.clicks', 'cleanup_clicks_mismatch'],
    ['settled_callbacks', 'cleanup.timerSettle', 'timer_settle_mismatch']
  ]) assertDiagnostic(collected.result, { key, file: 'observations.json', path, reason });
  const observations = JSON.parse(fs.readFileSync(path.join(collected.outDir, 'observations.json'), 'utf8'));
  assert.deepEqual(observations.prepare, collected.replies.prepare);
  assert.deepEqual(observations.run, collected.replies.run);
  assert.deepEqual(observations.cleanup, collected.replies.cleanup);
  assertSafeDiagnostics(collected.result);
  assert.equal(JSON.stringify(collected.result.diagnostics).includes(privateMarker), false);
});

test('unreadable retained report diagnostics expose a fixed reason without repairing raw output or changing its verdict', async t => {
  const privateMarker = 'fictional-private-parser-marker';
  const reportText = `{ malformed report ${privateMarker}`;
  const collected = await collectFictional(t, replies => { replies.report.fields[0].status = 'failed'; }, { reportText });
  assert.equal(collected.result.schemaComplete, false);
  assert.equal(collected.result.complete, false, 'diagnostics preserve the existing failed in-memory collection verdict');
  assert.notEqual(collected.result.exitCode, 0);
  assert.equal(fs.readFileSync(path.join(collected.outDir, 'cms-education-live.json'), 'utf8'), reportText,
    'unreadable retained output is neither repaired nor replaced from the returned report');
  const reportDiagnostics = collected.result.diagnostics.filter(row => row.file === 'cms-education-live.json');
  assert.ok(reportDiagnostics.length > 0);
  assert.ok(reportDiagnostics.every(row => row.reason === 'artifact_unreadable'));
  assertDiagnostic(collected.result, { key: 'seven_visible_probes', file: 'cms-education-live.json',
    path: 'finalDetails.widgetProbes', reason: 'artifact_unreadable' });
  assertSafeDiagnostics(collected.result);
  assert.equal(JSON.stringify(collected.result.diagnostics).includes(privateMarker), false);
});

test('a failed runner verdict stays failed even when capture and cleanup succeed', async t => {
  const collected = await collectFictional(t, replies => {
    replies.report.finalDetails.reason = 'fictional_trial_failed';
    replies.report.finalDetails.exitCode = 3;
    replies.report.fields[0].status = 'failed';
  });
  assert.equal(collected.result.complete, false);
  assert.notEqual(collected.result.exitCode, 0);
  assert.equal(collected.result.liveSupportClaimed, false);
});

async function collectWithShippedRunner(t, fakeOptions = {}) {
  const options = await approvedInputs(t), replies = fictionalReplies();
  const raw = fakeSession(replies, { ...fakeOptions, answers: {
    page_guard: { href: CMS_BASELINE_PAGE, title: 'Fictional offline unit page', readyState: 'complete', visible: 'visible', password: false },
    read_posts: [], read_suppressed_autosave: [], read_suppressed_lookup: [], read_clicks: []
  } });
  let connections = 0, targetLists = 0;
  const result = await collectDaytimeHarness({ ...options, stepTimeoutMs: 1000,
    getJson: async (port, pathname) => {
      targetLists++;
      assert.equal(port, 9239); assert.equal(pathname, '/json/list');
      return [{ id: 'fictional-unit', type: 'page', url: CMS_BASELINE_PAGE,
        webSocketDebuggerUrl: 'ws://127.0.0.1:9239/devtools/page/fictional-unit' }];
    }, connectCdp: async () => { connections++; return raw; }
  });
  assert.equal(connections, 1); assert.equal(targetLists, 1);
  return { ...options, result, replies, raw };
}

test('shipped runner and observed connector write one same-session pack using only fake CDP', async t => {
  const collected = await collectWithShippedRunner(t);
  assert.equal(collected.result.complete, true, 'fictional replies verify orchestration, not a daytime pass');
  const report = JSON.parse(fs.readFileSync(path.join(collected.outDir, 'cms-education-live.json'), 'utf8'));
  assert.equal(report.finalDetails.exitCode, 0);
  assert.equal(report.finalDetails.controls, true);
  assert.equal(report.finalDetails.cleanupOk, true);
  assert.equal(report.fields.length, 9);
  assert.equal(report.neverSave, true); assert.equal(report.liveSupportClaimed, false);
  assert.deepEqual(collected.result.diagnostics, []);
  const steps = collected.raw.calls.map(call => call.step);
  assert.ok(steps.indexOf('fetch_enable') < steps.indexOf('capture_before_create'));
  assert.ok(steps.indexOf('capture_before') < steps.indexOf('install_live'));
  assert.ok(steps.indexOf('education_prepare') < steps.indexOf('education_run'));
  assert.ok(steps.indexOf('cleanup') < steps.indexOf('capture_after'));
  assert.ok(steps.indexOf('capture_release') < steps.indexOf('fetch_disable'));
  assert.equal(collected.raw.calls.at(-1).method, 'close');
});

test('shipped runner still disables Fetch and closes after supplemental after-capture failure', async t => {
  const collected = await collectWithShippedRunner(t, { failAfter: true });
  assert.equal(collected.result.complete, false);
  assert.notEqual(collected.result.exitCode, 0);
  const report = JSON.parse(fs.readFileSync(path.join(collected.outDir, 'cms-education-live.json'), 'utf8'));
  assert.equal(report.finalDetails.cleanupOk, true);
  assert.ok(collected.raw.calls.some(call => call.step === 'fetch_disable'));
  assert.ok(collected.raw.calls.some(call => call.step === 'capture_release'));
  assert.equal(collected.raw.calls.at(-1).method, 'close');
  assert.deepEqual(collected.result.errors, ['capture_after_failed']);
  assertDiagnostic(collected.result, { key: 'cleanup', file: 'snapshots-after.json',
    path: 'identity', reason: 'artifact_missing' });
  assert.equal(fs.existsSync(path.join(collected.outDir, 'snapshots-after.json')), false);
  assertSafeDiagnostics(collected.result);
});

test('cleanup protocol failure releases only capture state and preserves dirty-page interception', async t => {
  const collected = await collectWithShippedRunner(t, { failAtStep: 'cleanup' });
  assert.equal(collected.result.complete, false);
  assert.notEqual(collected.result.exitCode, 0);
  const report = JSON.parse(fs.readFileSync(path.join(collected.outDir, 'cms-education-live.json'), 'utf8'));
  assert.equal(report.finalDetails.cleanupOk, false);
  assert.equal(report.finalDetails.reason, 'cleanup_failed');
  assert.equal(collected.raw.calls.some(call => call.step === 'fetch_disable'), false);
  assert.equal(collected.raw.calls.some(call => call.step === 'capture_after'), false);
  assert.equal(collected.raw.calls.filter(call => call.step === 'capture_release').length, 1);
  assert.equal(collected.raw.calls.at(-1).method, 'close');
  assertDiagnostic(collected.result, { key: 'cleanup', file: 'snapshots-after.json',
    path: 'identity', reason: 'artifact_missing' });
  assert.equal(fs.existsSync(path.join(collected.outDir, 'snapshots-after.json')), false);
  assert.equal(fs.existsSync(path.join(collected.outDir, 'cleanup.json')), false);
  assertSafeDiagnostics(collected.result);
});
