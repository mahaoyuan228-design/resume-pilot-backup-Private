import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LICENSE_CODES, LicenseGateError } from '../src/license/errors.mjs';
import { FLAVOR_INTERNAL, FLAVOR_PAID } from '../src/license/flavor.mjs';
import { ENTITLEMENT_KEY } from '../src/license/binding.mjs';
import {
  activateLocalToken,
  isFillAllowed,
  isFillAllowedAsync,
} from '../src/license/entitlement.mjs';
import {
  canonicalJson,
  verifySignedEntitlement,
  verifyEd25519Signature,
} from '../src/license/signed-entitlement.mjs';

const fixtureDir = resolve('tests/fixtures/license');
const publicKeyPem = readFileSync(resolve(fixtureDir, 'EXAMPLE_ed25519_public.pem'), 'utf8');
const signedActive = JSON.parse(
  readFileSync(resolve(fixtureDir, 'EXAMPLE_signed_entitlement.json'), 'utf8'),
);
const signedExpired = JSON.parse(
  readFileSync(resolve(fixtureDir, 'EXAMPLE_signed_entitlement_expired.json'), 'utf8'),
);

const installId = '11111111-2222-4333-a444-555555555555';

const paidConfigUnsignedOk = {
  buildFlavor: FLAVOR_PAID,
  licenseServiceUrl: 'https://license.example.invalid',
  publicKeyPem: null,
  requireSignedEntitlement: false,
};

const paidConfigSigned = {
  buildFlavor: FLAVOR_PAID,
  licenseServiceUrl: 'https://license.example.invalid',
  publicKeyPem,
  requireSignedEntitlement: true,
};

function memoryStorage(seed = {}) {
  const data = { ...seed };
  return {
    async get(key) {
      if (Array.isArray(key)) {
        const out = {};
        for (const k of key) out[k] = data[k];
        return out;
      }
      return { [key]: data[key] };
    },
    async set(bag) {
      Object.assign(data, bag);
    },
    _data: data,
  };
}

describe('Ed25519 signed entitlement — accept / reject', () => {
  it('accepts a valid EXAMPLE signature', async () => {
    const verified = await verifySignedEntitlement({
      token: signedActive,
      publicKeyPem,
    });
    assert.equal(verified.signed, true);
    assert.equal(verified.status, 'active');
    assert.equal(verified.licenseId, 'lic-example-test');
    assert.equal(verified.installId, installId);
  });

  it('rejects a tampered payload (signature no longer matches)', async () => {
    const tampered = structuredClone(signedActive);
    tampered.payload.licenseId = 'lic-tampered';
    await assert.rejects(
      () => verifySignedEntitlement({ token: tampered, publicKeyPem }),
      (e) => e instanceof LicenseGateError
        && e.code === LICENSE_CODES.NOT_ACTIVATED
        && e.detail === 'signature_invalid',
    );
  });

  it('rejects when signature bytes are flipped', async () => {
    const flipped = structuredClone(signedActive);
    const buf = Buffer.from(flipped.signature, 'base64');
    buf[0] ^= 0xff;
    flipped.signature = buf.toString('base64');
    const ok = await verifyEd25519Signature({
      payload: flipped.payload,
      signature: flipped.signature,
      publicKeyPem,
    });
    assert.equal(ok, false);
  });

  it('fail-closed: signed token without publicKeyPem → CONFIG_MISSING', async () => {
    await assert.rejects(
      () => verifySignedEntitlement({ token: signedActive, publicKeyPem: null }),
      (e) => e.code === LICENSE_CODES.CONFIG_MISSING && e.detail === 'public_key_pem_missing',
    );
  });

  it('canonicalJson is stable for key order', () => {
    const a = canonicalJson({ b: 1, a: 2 });
    const b = canonicalJson({ a: 2, b: 1 });
    assert.equal(a, b);
    assert.equal(a, '{"a":2,"b":1}');
  });
});

describe('activate + gate: signed path + expiry + internal bypass', () => {
  it('activates valid signed token and isFillAllowedAsync allows fill', async () => {
    const storage = memoryStorage({ resumeLicenseInstallId: installId });
    const activated = await activateLocalToken({
      storage,
      tokenText: JSON.stringify(signedActive),
      config: paidConfigSigned,
      flavor: FLAVOR_PAID,
      nowMs: Date.now(),
    });
    assert.equal(activated.allowed, true);
    assert.equal(activated.entitlement.signed, true);
    assert.ok(activated.entitlement.signature);
    assert.ok(activated.entitlement.signedPayload);

    const decision = await isFillAllowedAsync({
      flavor: FLAVOR_PAID,
      config: paidConfigSigned,
      installId,
      entitlement: storage._data[ENTITLEMENT_KEY],
      nowMs: Date.now(),
    });
    assert.equal(decision.allowed, true);
  });

  it('rejects expired signed entitlement (after successful signature verify)', async () => {
    const storage = memoryStorage({ resumeLicenseInstallId: installId });
    await assert.rejects(
      () => activateLocalToken({
        storage,
        tokenText: JSON.stringify(signedExpired),
        config: paidConfigSigned,
        flavor: FLAVOR_PAID,
        nowMs: Date.now(),
      }),
      (e) => e.code === LICENSE_CODES.LICENSE_EXPIRED,
    );
    assert.equal(storage._data[ENTITLEMENT_KEY], undefined);

    // Direct verify of signature still ok; gate expiry is separate.
    const verified = await verifySignedEntitlement({
      token: signedExpired,
      publicKeyPem,
    });
    assert.equal(verified.signed, true);
    const denied = await isFillAllowedAsync({
      flavor: FLAVOR_PAID,
      config: paidConfigSigned,
      installId,
      entitlement: {
        ...verified,
        installId,
      },
      nowMs: Date.now(),
    });
    assert.equal(denied.allowed, false);
    assert.equal(denied.licenseCode, LICENSE_CODES.LICENSE_EXPIRED);
  });

  it('requireSignedEntitlement + missing publicKeyPem fail-closed on async check', async () => {
    const decision = await isFillAllowedAsync({
      flavor: FLAVOR_PAID,
      config: {
        ...paidConfigSigned,
        publicKeyPem: null,
      },
      installId,
      entitlement: {
        status: 'active',
        installId,
        signature: signedActive.signature,
        signedPayload: signedActive.payload,
        expiresAtMs: signedActive.payload.expiresAtMs,
        licenseId: 'x',
        profileHash: null,
      },
      nowMs: Date.now(),
    });
    assert.equal(decision.allowed, false);
    assert.equal(decision.licenseCode, LICENSE_CODES.NOT_ACTIVATED); // CONFIG_MISSING maps to UI NOT_ACTIVATED
    assert.equal(decision.detail, 'public_key_pem_missing');
  });

  it('requireSignedEntitlement rejects unsigned sketch tokens', async () => {
    const storage = memoryStorage({ resumeLicenseInstallId: installId });
    await assert.rejects(
      () => activateLocalToken({
        storage,
        tokenText: JSON.stringify({
          status: 'active',
          licenseId: 'unsigned',
          expiresAtMs: Date.now() + 86400000,
        }),
        config: paidConfigSigned,
        flavor: FLAVOR_PAID,
      }),
      (e) => e.detail === 'signature_missing',
    );
  });

  it('internal bypass unchanged (sync + async)', async () => {
    const sync = isFillAllowed({ flavor: FLAVOR_INTERNAL });
    assert.equal(sync.allowed, true);
    const asyncResult = await isFillAllowedAsync({
      flavor: FLAVOR_INTERNAL,
      entitlement: null,
      config: paidConfigSigned,
    });
    assert.equal(asyncResult.allowed, true);
    assert.equal(asyncResult.flavor, FLAVOR_INTERNAL);
  });

  it('unsigned local paste still works when signatures not required', async () => {
    const storage = memoryStorage({ resumeLicenseInstallId: installId });
    const activated = await activateLocalToken({
      storage,
      tokenText: JSON.stringify({
        status: 'active',
        licenseId: 'unsigned-ok',
        expiresAtMs: Date.now() + 86400000,
      }),
      config: paidConfigUnsignedOk,
      flavor: FLAVOR_PAID,
    });
    assert.equal(activated.allowed, true);
    assert.equal(activated.entitlement.signed, undefined);
  });
});

describe('packaging / docs: signed module in paid build, not internal', () => {
  it('build-paid.ps1 lists signed-entitlement.mjs and optional PublicKeyPemPath', () => {
    const script = readFileSync(resolve('scripts/build-paid.ps1'), 'utf8');
    assert.equal(script.includes('src/license/signed-entitlement.mjs'), true);
    assert.equal(script.includes('PublicKeyPemPath'), true);
  });

  it('build-internal.ps1 still excludes src/license/', () => {
    const script = readFileSync(resolve('scripts/build-internal.ps1'), 'utf8');
    assert.equal(script.includes('src/license/'), false);
  });

  it('EXAMPLE fixtures are clearly marked and private key stays under tests/', () => {
    const readme = readFileSync(resolve(fixtureDir, 'README.md'), 'utf8');
    assert.match(readme, /NOT production/i);
    assert.match(readme, /EXAMPLE/);
    const priv = readFileSync(resolve(fixtureDir, 'EXAMPLE_ed25519_private.pem'), 'utf8');
    assert.match(priv, /BEGIN PRIVATE KEY/);
  });
});
