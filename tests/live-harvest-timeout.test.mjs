/**
 * A hung extension-storage evaluate must time out, write summary.json, and exit.
 * Never Save.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createServer as createNetServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { startFakeCdp } from './helpers/fake-cdp.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = resolve(root, 'tools/live-harvest/cli.mjs');

function runCli(args, timeoutMs = 15000) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    const killer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (err) => {
      clearTimeout(killer);
      reject(err);
    });
    child.on('exit', (code, signal) => {
      clearTimeout(killer);
      resolveRun({ code, signal, stdout, stderr });
    });
  });
}

function readSummary(outDir) {
  return JSON.parse(readFileSync(join(outDir, 'summary.json'), 'utf8'));
}

test('hung extension storage times out, continues, and writes the summary', { timeout: 20000 }, async () => {
  const fake = await startFakeCdp();
  const outDir = mkdtempSync(join(tmpdir(), 'live-harvest-'));
  const started = Date.now();
  try {
    const result = await runCli([
      '--port', String(fake.port),
      '--sites', 'ext-storage,cms',
      '--out-dir', outDir,
      '--run-id', 'hang-step',
      '--step-timeout-ms', '400',
      '--deadline-ms', '15000'
    ]);
    const elapsed = Date.now() - started;
    assert.equal(result.signal, null, result.stderr || result.stdout);
    assert.equal(result.code, 1, result.stderr || result.stdout);
    assert.ok(elapsed < 8000, `elapsed ${elapsed}`);
    const summary = readSummary(outDir);
    assert.equal(summary.neverSave, true);
    assert.equal(summary.claimedSupported, false);
    assert.equal(summary.supported, false);
    assert.equal(summary.timedOut, true);
    assert.equal(summary.exitCode, 1);
    assert.equal(summary.runId, 'hang-step');
    assert.ok(summary.finishedAt);
    const hung = summary.steps.find((row) => row.step === 'extension_storage');
    assert.deepEqual(
      { ok: hung.ok, reason: hung.reason, step: hung.step },
      { ok: false, reason: 'timeout', step: 'extension_storage' }
    );
    assert.equal(summary.results['ext-storage'].ok, false);
    assert.equal(summary.results['ext-storage'].reason, 'timeout');
    assert.equal(summary.results['ext-storage'].step, 'extension_storage');
    assert.equal(summary.results.cms.ok, true);
    assert.equal(summary.results.cms.readiness, 'form_visible_readonly_ok');
    assert.equal(summary.results.cms.supported, false);
    assert.ok(summary.evidencePaths.length >= 2);
    for (const file of summary.evidencePaths) {
      const packet = JSON.parse(readFileSync(file, 'utf8'));
      assert.equal(packet.neverSave, true);
      assert.equal(packet.claimedSupported, false);
    }
  } finally {
    await fake.close();
  }
});

test('global deadline cuts a hung evaluate before the step timeout', { timeout: 20000 }, async () => {
  const fake = await startFakeCdp();
  const outDir = mkdtempSync(join(tmpdir(), 'live-harvest-'));
  const started = Date.now();
  try {
    const result = await runCli([
      '--port', String(fake.port),
      '--sites', 'ext-storage',
      '--out-dir', outDir,
      '--run-id', 'hang-deadline',
      '--step-timeout-ms', '20000',
      '--deadline-ms', '800'
    ]);
    const elapsed = Date.now() - started;
    assert.equal(result.signal, null, result.stderr || result.stdout);
    assert.equal(result.code, 1, result.stderr || result.stdout);
    assert.ok(elapsed < 8000, `elapsed ${elapsed}`);
    const summary = readSummary(outDir);
    assert.equal(summary.neverSave, true);
    assert.equal(summary.timedOut, true);
    assert.ok(summary.steps.some((row) => row.ok === false && row.reason === 'timeout'));
    assert.ok(summary.finishedAt);
  } finally {
    await fake.close();
  }
});

test('unreachable CDP still writes a summary and exits', { timeout: 20000 }, async () => {
  const probe = createNetServer();
  await new Promise((resolveListen, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolveListen);
  });
  const port = probe.address().port;
  await new Promise((resolveClose) => probe.close(resolveClose));
  const outDir = mkdtempSync(join(tmpdir(), 'live-harvest-'));
  const result = await runCli([
    '--port', String(port),
    '--sites', 'cmb,nanyue',
    '--out-dir', outDir,
    '--run-id', 'closed-port',
    '--step-timeout-ms', '500',
    '--deadline-ms', '4000'
  ]);
  assert.equal(result.signal, null, result.stderr || result.stdout);
  assert.equal(result.code, 0, result.stderr || result.stdout);
  const summary = readSummary(outDir);
  assert.equal(summary.neverSave, true);
  assert.equal(summary.claimedSupported, false);
  assert.equal(summary.timedOut, false);
  assert.equal(summary.exitCode, 0);
  assert.equal(summary.ok, true);
  assert.ok(summary.finishedAt);
  assert.ok(summary.skipped.some((row) => row.reason === 'cdp_unreachable'));
});
