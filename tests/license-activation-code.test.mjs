import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, sep } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ENTITLEMENT_KEY, INSTALL_ID_KEY } from '../src/license/binding.mjs';
import { createLicenseClient, createPaidVerifyHandler } from '../src/license/client.mjs';
import { activateLocalToken, readLicenseStatus } from '../src/license/entitlement.mjs';
import { canonicalJson, decodeActivationCode, encodeActivationCode } from '../src/license/signed-entitlement.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const issuer = resolve(root, 'scripts/issue-entitlement.mjs');
const scratch = mkdtempSync(resolve(tmpdir(), 'resume-seat-code-'));
const privateKeyPath = resolve(scratch, 'operator-private.pem');
const otherKeyPath = resolve(scratch, 'ec-private.pem');
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const installId = '11111111-2222-4333-a444-555555555555';
const otherInstallId = '99999999-2222-4333-a444-555555555555';
const nowMs = Date.now();
const expiresAtMs = nowMs + 86400000;
const config = {
  buildFlavor: 'paid', verificationMode: 'offline', licenseServiceUrl: null,
  requireSignedEntitlement: true,
  publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
};
writeFileSync(privateKeyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }));
writeFileSync(otherKeyPath, generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  .privateKey.export({ type: 'pkcs8', format: 'pem' }));
after(() => {
  const target = resolve(scratch);
  assert.ok(target.startsWith(resolve(tmpdir()) + sep) && target.includes('resume-seat-code-'));
  rmSync(target, { recursive: true, force: true });
});

function issue(overrides = {}, flags = ['--code-only']) {
  const options = {
    '--private-key': privateKeyPath, '--install-id': installId,
    '--license-id': 'seat-001', '--expires-at-ms': String(expiresAtMs), ...overrides,
  };
  return spawnSync(process.execPath, [issuer,
    ...Object.entries(options).filter(([, value]) => value != null).flat(), ...flags,
  ], { cwd: root, encoding: 'utf8' });
}

function envelope(overrides = {}) {
  const payload = {
    status: 'active', installId, profileHash: null,
    licenseId: 'seat-001', expiresAtMs, ...overrides,
  };
  return {
    v: 1, alg: 'Ed25519', payload,
    signature: sign(null, Buffer.from(canonicalJson(payload)), privateKey).toString('base64'),
  };
}

// Independent transport encoder also lets rejection tests exercise invalid signed fields.
function rawCode(value) {
  return 'RQF1.' + Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function storageFor(id = installId) {
  const data = { [INSTALL_ID_KEY]: id };
  return {
    data,
    async get(key) { return { [key]: data[key] }; },
    async set(value) { Object.assign(data, structuredClone(value)); },
  };
}

function activate(storage, tokenText, overrides = {}) {
  return activateLocalToken({ storage, tokenText, config, flavor: 'paid', nowMs, ...overrides });
}

describe('per-seat offline activation codes', () => {
  it('issues a code locally and opens the existing status and fill gates with zero fetches', async () => {
    const result = issue();
    assert.equal(result.status, 0, result.stderr);
    const code = result.stdout.trim();
    assert.match(code, /^RQF1\.[A-Za-z0-9_-]+$/u);
    const storage = storageFor();
    let fetchCalls = 0;
    const client = createLicenseClient({ config, storage, fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('network forbidden');
    } });
    assert.equal((await createPaidVerifyHandler(client)()).allowed, false);
    assert.equal((await activate(storage, code)).allowed, true);
    const status = await readLicenseStatus({ flavor: 'paid', config, storage, nowMs });
    assert.equal(status.allowed, true);
    assert.equal(status.licenseId, 'seat-001');
    assert.equal(status.expiresAtMs, expiresAtMs);
    assert.equal(await client.verifyBeforeFill({ nowMs }), true);
    assert.equal(fetchCalls, 0);
  });

  it('keeps separate seat numbers bound to their respective installs', async () => {
    const first = issue();
    const second = issue({ '--install-id': otherInstallId, '--license-id': 'seat-002' });
    assert.equal(first.status, 0, first.stderr);
    assert.equal(second.status, 0, second.stderr);
    assert.notEqual(first.stdout, second.stdout);
    const firstToken = decodeActivationCode(first.stdout.trim());
    const secondToken = decodeActivationCode(second.stdout.trim());
    assert.equal(firstToken.payload.licenseId, 'seat-001');
    assert.equal(secondToken.payload.licenseId, 'seat-002');
    assert.equal((await activate(storageFor(otherInstallId), second.stdout.trim())).allowed, true);
    const wrongDevice = storageFor(otherInstallId);
    await assert.rejects(() => activate(wrongDevice, first.stdout.trim()),
      error => error.code === 'BINDING_MISMATCH');
    assert.equal(wrongDevice.data[ENTITLEMENT_KEY], undefined);
  });

  it('roundtrips UTF-8 seat numbers through the browser-compatible transport', async () => {
    const seat = '私下席位-张三-😀';
    const result = issue({ '--license-id': seat });
    assert.equal(result.status, 0, result.stderr);
    const code = result.stdout.trim();
    const signedToken = decodeActivationCode(code);
    assert.equal(signedToken.payload.licenseId, seat);
    const nodeBuffer = globalThis.Buffer;
    try {
      // The shipped activation page has Web APIs but no Node Buffer global.
      globalThis.Buffer = undefined;
      assert.equal(encodeActivationCode(signedToken), code);
      assert.deepEqual(decodeActivationCode(code), signedToken);
    } finally {
      globalThis.Buffer = nodeBuffer;
    }
    const storage = storageFor();
    await activate(storage, code);
    assert.equal(storage.data[ENTITLEMENT_KEY].licenseId, seat);
    assert.equal(await createLicenseClient({ config, storage }).verifyBeforeFill({ nowMs }), true);
  });

  it('rejects malformed, unsigned and unbound codes without saving entitlement', async () => {
    const invalidValues = [
      '', 'RQF1.', 'RQF2.aaaa', 'RQF1.***', 'RQF1.e30=', 'RQF1._w',
      rawCode({}), rawCode(envelope().payload),
      rawCode({ ...envelope(), v: 2 }), rawCode({ ...envelope(), alg: 'RSA' }),
      ...[
        { installId: null }, { installId: 'invalid' }, { licenseId: '' },
        { licenseId: '   ' }, { expiresAtMs: null }, { expiresAtMs: '4102444800000' },
      ].map(fields => rawCode(envelope(fields))),
    ];
    for (const value of invalidValues) {
      const storage = storageFor();
      await assert.rejects(() => activate(storage, value), error => Boolean(error.code), value);
      assert.equal(storage.data[ENTITLEMENT_KEY], undefined, value);
    }
  });

  it('rejects wrong keys, tampering and expiry while preserving a previous activation', async () => {
    const storage = storageFor();
    await activate(storage, encodeActivationCode(envelope()));
    const previous = structuredClone(storage.data[ENTITLEMENT_KEY]);
    for (const fields of [
      { licenseId: 'forged-seat' }, { installId: otherInstallId },
      { expiresAtMs: expiresAtMs + 86400000 },
    ]) {
      const forged = envelope();
      Object.assign(forged.payload, fields);
      await assert.rejects(() => activate(storage, rawCode(forged)),
        error => error.detail === 'signature_invalid');
      assert.deepEqual(storage.data[ENTITLEMENT_KEY], previous);
    }
    const wrongPublicKey = generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' });
    await assert.rejects(() => activate(storage, encodeActivationCode(envelope()), {
      config: { ...config, publicKeyPem: wrongPublicKey },
    }), error => error.detail === 'signature_invalid');
    await assert.rejects(() => activate(storage, encodeActivationCode(envelope({ expiresAtMs: nowMs }))),
      error => error.code === 'LICENSE_EXPIRED');
    assert.deepEqual(storage.data[ENTITLEMENT_KEY], previous);
  });

  it('preserves legacy issuer JSON and Base64 activation modes', async () => {
    for (const flag of ['--json-only', '--base64-only']) {
      const result = issue({}, [flag]);
      assert.equal(result.status, 0, result.stderr);
      const storage = storageFor();
      assert.equal((await activate(storage, result.stdout.trim())).allowed, true);
      assert.equal(storage.data[ENTITLEMENT_KEY].licenseId, 'seat-001');
    }
  });

  it('refuses invalid issuance inputs rather than producing an activation code', () => {
    const invalidResults = [
      issue({ '--private-key': null }), issue({ '--license-id': '   ' }),
      issue({ '--install-id': 'invalid' }), issue({ '--expires-at-ms': '1' }),
      issue({ '--expires-at-ms': null, '--days': '0' }),
      issue({ '--expires-at-ms': null, '--days': '1.5' }),
      issue({ '--private-key': otherKeyPath }),
      issue({ '--private-key': resolve(root, 'operator-private.pem') }),
      issue({}, ['--code-only', '--json-only']),
    ];
    for (const result of invalidResults) {
      assert.notEqual(result.status, 0, result.stdout);
      assert.equal(result.stdout.trim(), '');
      assert.doesNotMatch(result.stderr, /BEGIN (?:EC |RSA )?PRIVATE KEY/u);
    }
  });
});
