import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import JSZip from '../src/import/vendor/jszip.min.js';
import { parsePsStringArray } from '../scripts/paid-pack-guards.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'scripts/build-paid.ps1');
const run = (...args) => spawnSync('powershell.exe', [
  '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, ...args,
], { cwd: root, encoding: 'utf8', timeout: 60000 });
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('offline paid build requires a key and refuses a service URL', { skip: process.platform !== 'win32' }, () => {
  assert.notEqual(run('-Offline').status, 0);
  assert.notEqual(run('-Offline', '-PublicKeyPemPath', 'unused.pem', '-LicenseServiceUrl', 'https://unused.invalid').status, 0);
});

test('offline paid build rejects private, malformed, and non-Ed25519 keys', { skip: process.platform !== 'win32' }, () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'offline-bad-key-'));
  const pemPath = path.join(temp, 'key.pem');
  const { privateKey } = generateKeyPairSync('ed25519');
  const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  try {
    for (const pem of [
      privateKey.export({ type: 'pkcs8', format: 'pem' }),
      '-----BEGIN PUBLIC KEY-----\ninvalid\n-----END PUBLIC KEY-----',
      publicKey.export({ type: 'spki', format: 'pem' }),
    ]) {
      fs.writeFileSync(pemPath, pem);
      assert.notEqual(run('-Offline', '-PublicKeyPemPath', pemPath).status, 0);
    }
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('offline paid ZIP has signed-only config, exact allowlist, and matching hashes', { skip: process.platform !== 'win32' }, async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'offline-pack-'));
  const pemPath = path.join(temp, 'public.pem');
  const { publicKey } = generateKeyPairSync('ed25519');
  const pem = publicKey.export({ type: 'spki', format: 'pem' });
  fs.writeFileSync(pemPath, pem);
  try {
    const result = run('-Offline', '-PublicKeyPemPath', pemPath);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const match = result.stdout.match(/ZIP[^\r\n]*?([A-Za-z]:\\[^\r\n]+\.zip)/);
    assert.ok(match, result.stdout);
    const zipPath = match[1];
    assert.ok(path.resolve(zipPath).startsWith(path.join(root, 'dist') + path.sep));
    const buildRoot = path.dirname(zipPath);
    const ext = path.join(buildRoot, 'extension');
    const { paidConfig } = await import(pathToFileURL(path.join(ext, 'src/license/paid-config.mjs')));
    assert.equal(paidConfig.verificationMode, 'offline');
    assert.equal(paidConfig.licenseServiceUrl, null);
    assert.equal(paidConfig.requireSignedEntitlement, true);
    assert.equal(paidConfig.publicKeyPem, pem.replace(/\r/g, ''));
    assert.equal(paidConfig.publicWebsite, null);
    const archive = await JSZip.loadAsync(fs.readFileSync(zipPath));
    const expected = [
      ...parsePsStringArray(fs.readFileSync(script, 'utf8'), 'productFiles'),
      ...parsePsStringArray(fs.readFileSync(script, 'utf8'), 'licenseFiles'),
      'src/license/paid-config.mjs',
    ].sort();
    assert.deepEqual(Object.keys(archive.files).filter((rel) => !archive.files[rel].dir).sort(), expected);
    const manifest = JSON.parse(await archive.file('manifest.json').async('string'));
    assert.equal(manifest.background.service_worker, 'src/license/guard-worker.mjs');
    assert.equal(manifest.update_url, undefined);
    const sums = fs.readFileSync(path.join(buildRoot, 'SHA256SUMS.txt'), 'utf8').trim().split(/\r?\n/);
    assert.equal(sums.length, expected.length + 1);
    for (const line of sums) {
      const [hash, rel] = line.split('  ');
      const bytes = fs.readFileSync(path.join(buildRoot, rel));
      assert.equal(sha256(bytes), hash, rel);
      if (rel.startsWith('extension/')) {
        const packed = await archive.file(rel.slice('extension/'.length)).async('nodebuffer');
        assert.equal(sha256(packed), hash, rel);
      }
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
