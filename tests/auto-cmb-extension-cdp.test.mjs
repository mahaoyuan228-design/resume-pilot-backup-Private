// Offline CLI ↔ mock CDP regression. Never uses the real CMB page DOM or Edge.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { cmbExtensionOptions } from '../scripts/lib/cmb-extension-cdp.mjs';
import { startFakeCmbCdp, CMB_TEST_EXT_ID } from './helpers/fake-cmb-cdp.mjs';

const root = resolve(import.meta.dirname, '..');
const cli = join(root, 'scripts/auto-cmb-basic.mjs');

async function runCli(t, { fakeOptions = {}, args = [], env = {}, closedPort = false } = {}) {
  const fake = await startFakeCmbCdp(fakeOptions);
  if (closedPort) await fake.close();
  const outDir = mkdtempSync(join(tmpdir(), 'auto-cmb-cdp-'));
  t.after(async () => { if (!closedPort) await fake.close(); rmSync(outDir, { recursive: true, force: true }); });
  const run = await new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [cli, '--extension', '--port', String(fake.port), ...args], {
      cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, MODE: 'readiness', RESUME_EXT_ID: CMB_TEST_EXT_ID,
        AUTO_RUNS_DIR: outDir, AUTO_TIMEOUT_MS: '2500', CDP_STEP_TIMEOUT_MS: '500',
        OPEN_IF_MISSING: '0', CMB_PAGE: '', ...env }
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), 8000);
    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('close', (code, signal) => { clearTimeout(timer); resolveRun({ code, signal, stdout, stderr }); });
  });
  assert.equal(run.signal, null, run.stderr || run.stdout);
  const packet = JSON.parse(run.stdout);
  assert.equal(run.code, packet.exitCode, run.stderr || run.stdout);
  assert.equal(packet.neverSave, true);
  assert.equal(packet.supported, false);
  assert.equal(packet.claimedSupported, false);
  assert.equal(packet.liveSupportClaimed, false);
  assert.equal(packet.formFillClaimed, false);
  assert.equal(packet.saved, false);
  assert.equal(packet.saveAttempted, false);
  assert.ok(packet.runId);
  assert.ok(packet.finishedAt);
  const evidence = JSON.parse(readFileSync(packet.file, 'utf8'));
  const { event, file, latest, ...payload } = packet;
  assert.deepEqual(evidence, payload);
  assert.deepEqual(JSON.parse(readFileSync(latest, 'utf8')), evidence);
  for (const call of fake.calls.filter((c) => c.method)) {
    assert.ok(['Target.createTarget', 'Page.navigate', 'Runtime.evaluate'].includes(call.method), call.method);
    if (call.method === 'Runtime.evaluate') {
      assert.equal(call.params.awaitPromise, false);
      assert.doesNotMatch(call.params.expression, /chrome|storage|click|submit|save/iu);
    }
  }
  return { packet, fake, outDir };
}

test('extension CLI reuses auto page for readiness with a fresh runId', { timeout: 10000 }, async (t) => {
  const { packet, fake } = await runCli(t, { env: { RESUME_EXT_ID: '' }, args: ['--extension-id', CMB_TEST_EXT_ID] });
  assert.equal(packet.exitCode, 0);
  assert.equal(packet.reason, 'cmb_readiness_complete');
  assert.equal(packet.targetAction, 'reused');
  assert.equal(packet.writeAttempted, false);
  const navigate = fake.calls.find((call) => call.method === 'Page.navigate');
  const url = new URL(navigate.params.url);
  assert.equal(url.searchParams.get('mode'), 'readiness');
  assert.equal(url.searchParams.get('runId'), packet.runId);
  assert.equal(url.searchParams.get('openIfMissing'), '0');
  assert.equal(url.searchParams.get('targetPage'), 'https://career.cmbchina.com/center/resume');
  assert.equal(url.searchParams.has('reportPort'), false);
});

test('extension CLI creates auto page over browser CDP for Never-Save fill', { timeout: 10000 }, async (t) => {
  const { packet, fake } = await runCli(t, { fakeOptions: { existing: false }, args: ['--mode', 'fill', '--open-if-missing'] });
  assert.equal(packet.exitCode, 0);
  assert.equal(packet.mode, 'fill');
  assert.equal(packet.targetAction, 'created');
  assert.equal(packet.writeAttempted, true);
  assert.equal(packet.backgroundResult.job.saved, false);
  assert.equal(packet.backgroundResult.job.softwareClickedSubmit, false);
  const url = new URL(fake.calls.find((c) => c.method === 'Target.createTarget').params.url);
  assert.equal(url.searchParams.get('mode'), 'fill');
  assert.equal(url.searchParams.get('openIfMissing'), '1');
});

test('extension discovery works without a pinned ID', { timeout: 10000 }, async (t) => {
  const { packet } = await runCli(t, { env: { RESUME_EXT_ID: undefined } });
  assert.equal(packet.exitCode, 0);
  assert.equal(packet.extensionId, CMB_TEST_EXT_ID);
});

test('navigation context changes retry the snapshot without redispatching fill', { timeout: 10000 }, async (t) => {
  const { packet, fake } = await runCli(t, { args: ['--mode', 'fill'], fakeOptions: { contextFailures: 1 } });
  assert.equal(packet.exitCode, 0);
  assert.equal(fake.calls.filter((c) => c.method === 'Page.navigate').length, 1);
  assert.ok(fake.calls.filter((c) => c.method === 'Runtime.evaluate').length >= 2);
});

test('unreachable CDP exits with transport evidence', { timeout: 10000 }, async (t) => {
  const { packet } = await runCli(t, { closedPort: true });
  assert.equal(packet.exitCode, 1);
  assert.equal(packet.reason, 'cdp_unreachable');
  assert.equal(packet.step, 'target_list');
  assert.equal(packet.writeAttempted, false);
});

for (const [reason, code, extra] of [
  ['cmb_host_permission_missing', 3, {}],
  ['cmb_basic_tab_missing', 2, { helpNeeded: true }],
  ['cmb_basic_login_or_wrong_page', 2, { helpNeeded: true }],
  ['BG_NO_RESPONSE', 1, { phase: 'response', writeAttempted: false, writeUnconfirmed: true }],
  ['extension_reload_required', 3, {}]
]) {
  test(`extension CLI records ${reason} with exit ${code}`, { timeout: 10000 }, async (t) => {
    const { packet } = await runCli(t, {
      args: ['--mode', 'fill'],
      fakeOptions: { result: { ok: false, reason, mode: 'fill', saveAttempted: false, ...extra } }
    });
    assert.equal(packet.ok, false);
    assert.equal(packet.exitCode, code);
    assert.equal(packet.reason, reason);
    assert.equal(packet.backgroundResult.reason, reason);
    assert.equal(packet.writeUnconfirmed, reason === 'BG_NO_RESPONSE');
    if (reason === 'BG_NO_RESPONSE') {
      assert.equal(packet.writeAttempted, null);
      assert.equal(packet.timedOut, true);
    }
  });
}

for (const [name, fakeOptions, reason, step] of [
  ['hung CDP evaluation', { hangMethod: 'Runtime.evaluate' }, 'timeout', 'auto_result'],
  ['hung auto navigation', { hangMethod: 'Page.navigate' }, 'timeout', 'auto_navigate'],
  ['hung target creation', { existing: false, hangMethod: 'Target.createTarget' }, 'timeout', 'auto_create'],
  ['hung HTTP discovery', { hangHttp: '/json/list' }, 'timeout', 'target_list'],
  ['stale result from an earlier run', { stale: true }, 'timeout', 'auto_result'],
  ['auto page with no terminal result', { noResult: true }, 'timeout', 'auto_result'],
  ['created target never appears', { existing: false, hiddenCreatedTarget: true }, 'timeout', 'auto_target_list'],
  ['CDP error', { evaluateError: true }, 'cmb_cdp_error', 'auto_result']
]) {
  test(`extension CLI exits and writes evidence for ${name}`, { timeout: 10000 }, async (t) => {
    const started = Date.now();
    const { packet } = await runCli(t, {
      fakeOptions, args: ['--mode', 'fill', '--timeout-ms', '900', '--step-timeout-ms', '250']
    });
    assert.ok(Date.now() - started < 6000);
    assert.equal(packet.exitCode, 1);
    assert.equal(packet.reason, reason);
    assert.equal(packet.step, step);
    assert.equal(packet.timedOut, reason === 'timeout');
    assert.equal(packet.writeUnconfirmed, step !== 'target_list');
  });
}

for (const [name, fakeOptions, env, reason] of [
  ['no extension', { existing: false, noExtension: true }, { RESUME_EXT_ID: undefined }, 'cmb_extension_target_missing'],
  ['ambiguous extension', { ambiguous: true }, { RESUME_EXT_ID: undefined }, 'cmb_extension_target_ambiguous'],
  ['invalid mode', {}, { MODE: 'save' }, 'cmb_extension_mode_invalid'],
  ['foreign page', {}, { CMB_PAGE: 'https://example.com/' }, 'cmb_page_invalid']
]) {
  test(`extension CLI refuses ${name} before navigation`, { timeout: 10000 }, async (t) => {
    const { packet, fake } = await runCli(t, { fakeOptions, env });
    assert.equal(packet.exitCode, 3);
    assert.equal(packet.reason, reason);
    assert.equal(packet.writeAttempted, false);
    assert.equal(fake.calls.some((c) => ['Page.navigate', 'Target.createTarget'].includes(c.method)), false);
  });
}

test('extension options reject unsafe modes, targets and mixed synthetic/live flags', () => {
  const defaults = cmbExtensionOptions([], {});
  assert.equal(defaults.port, 9237);
  assert.equal(defaults.mode, 'readiness');
  assert.equal(defaults.openIfMissing, false);
  assert.equal(cmbExtensionOptions(['--port', '9238'], { CDP_PORT: 'bad' }).port, 9238);
  for (const argv of [
    ['--port', '0'], ['--port', '9237junk'], ['--port', '65536'], ['--port'],
    ['--mode', 'submit'], ['--mode', 'reload'], ['--timeout-ms', '0'],
    ['--step-timeout-ms', 'Infinity'], ['--extension-id', 'not-an-extension'],
    ['--synthetic'], ['--live'], ['--only', '姓名']
  ]) assert.throws(() => cmbExtensionOptions(argv, {}));
});

test('an unexpected Save/Submit observation fails closed and preserves the raw evidence', { timeout: 10000 }, async (t) => {
  const { packet } = await runCli(t, {
    fakeOptions: { result: { ok: true, siteId: 'cmb', job: { softwareClickedSubmit: true } } }
  });
  assert.equal(packet.exitCode, 3);
  assert.equal(packet.reason, 'cmb_save_policy_violation');
  assert.equal(packet.backgroundResult.job.softwareClickedSubmit, true);
});
