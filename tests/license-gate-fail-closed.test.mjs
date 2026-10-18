import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluateLocalGate, assertPaidConfig, createLocalVerifyBeforeFill } from '../src/license/gate.mjs';
import { LICENSE_CODES, LicenseGateError } from '../src/license/errors.mjs';
import { bindingMatches, ensureInstallId, isInstallId, localBindingDigest } from '../src/license/binding.mjs';
import { FLAVOR_INTERNAL, FLAVOR_PAID, isPaidFlavor, normalizeFlavor } from '../src/license/flavor.mjs';
import { createLicenseClient, createPaidVerifyHandler } from '../src/license/client.mjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const validConfig = {
  buildFlavor: FLAVOR_PAID,
  licenseServiceUrl: 'https://license.example.invalid',
  publicKeyPem: null,
};

const installId = '11111111-2222-4333-a444-555555555555';
const activeEntitlement = {
  status: 'active',
  installId,
  profileHash: null,
  licenseId: 'lic-demo',
  expiresAtMs: Date.now() + 86400000,
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

describe('flavor flags', () => {
  it('defaults unknown to internal', () => {
    assert.equal(normalizeFlavor(undefined), FLAVOR_INTERNAL);
    assert.equal(normalizeFlavor('paid'), FLAVOR_PAID);
    assert.equal(isPaidFlavor('paid'), true);
    assert.equal(isPaidFlavor('internal'), false);
    assert.equal(isPaidFlavor('PAID'), false);
  });
});

describe('paid config', () => {
  it('rejects missing / non-https config fail-closed', () => {
    assert.throws(() => assertPaidConfig(null), (e) => e.code === LICENSE_CODES.CONFIG_MISSING);
    assert.throws(() => assertPaidConfig({ buildFlavor: 'paid', licenseServiceUrl: 'http://insecure.example' }),
      (e) => e.code === LICENSE_CODES.CONFIG_MISSING);
    assert.throws(() => assertPaidConfig({ buildFlavor: 'internal', licenseServiceUrl: 'https://x.example' }),
      (e) => e.code === LICENSE_CODES.CONFIG_MISSING);
    assert.deepEqual(assertPaidConfig(validConfig), validConfig);
  });
});

describe('evaluateLocalGate fail-closed', () => {
  it('allows internal flavor without entitlement', () => {
    assert.deepEqual(evaluateLocalGate({ flavor: FLAVOR_INTERNAL }), {
      allowed: true,
      flavor: FLAVOR_INTERNAL,
    });
  });

  it('denies paid with no entitlement', () => {
    assert.throws(
      () => evaluateLocalGate({ flavor: FLAVOR_PAID, config: validConfig, installId, entitlement: null }),
      (e) => e instanceof LicenseGateError && e.code === LICENSE_CODES.NOT_ACTIVATED,
    );
  });

  it('denies revoked / expired / device mismatch', () => {
    assert.throws(
      () => evaluateLocalGate({
        flavor: FLAVOR_PAID, config: validConfig, installId,
        entitlement: { ...activeEntitlement, status: 'revoked' },
      }),
      (e) => e.code === LICENSE_CODES.LICENSE_REVOKED,
    );
    assert.throws(
      () => evaluateLocalGate({
        flavor: FLAVOR_PAID, config: validConfig, installId,
        entitlement: { ...activeEntitlement, expiresAtMs: Date.now() - 1 },
        nowMs: Date.now(),
      }),
      (e) => e.code === LICENSE_CODES.LICENSE_EXPIRED,
    );
    assert.throws(
      () => evaluateLocalGate({
        flavor: FLAVOR_PAID, config: validConfig, installId,
        entitlement: { ...activeEntitlement, installId: '99999999-2222-4333-a444-555555555555' },
      }),
      (e) => e.code === LICENSE_CODES.BINDING_MISMATCH,
    );
  });

  it('denies status=expired, exact expiry boundary, profileHash mismatch, device_revoked', () => {
    assert.throws(
      () => evaluateLocalGate({
        flavor: FLAVOR_PAID, config: validConfig, installId,
        entitlement: { ...activeEntitlement, status: 'expired' },
      }),
      (e) => e.code === LICENSE_CODES.LICENSE_EXPIRED && e.detail === 'status_expired',
    );
    const boundary = 1_700_000_000_000;
    assert.throws(
      () => evaluateLocalGate({
        flavor: FLAVOR_PAID, config: validConfig, installId,
        entitlement: { ...activeEntitlement, expiresAtMs: boundary },
        nowMs: boundary,
      }),
      (e) => e.code === LICENSE_CODES.LICENSE_EXPIRED && e.detail === 'past_expiry',
    );
    assert.throws(
      () => evaluateLocalGate({
        flavor: FLAVOR_PAID, config: validConfig, installId,
        entitlement: { ...activeEntitlement, profileHash: 'seat-abc' },
        profileHash: null,
      }),
      (e) => e.code === LICENSE_CODES.BINDING_MISMATCH,
    );
    assert.throws(
      () => evaluateLocalGate({
        flavor: FLAVOR_PAID, config: validConfig, installId,
        entitlement: { ...activeEntitlement, status: 'device_revoked' },
      }),
      (e) => e.code === LICENSE_CODES.DEVICE_REVOKED,
    );
  });


  it('denies empty installId, blank/unknown status, non-finite expiry (anti-resale edges)', () => {
    assert.throws(
      () => evaluateLocalGate({
        flavor: FLAVOR_PAID, config: validConfig, installId: '',
        entitlement: activeEntitlement,
      }),
      (e) => e.code === LICENSE_CODES.NOT_ACTIVATED && e.detail === 'install_id_missing',
    );
    assert.throws(
      () => evaluateLocalGate({
        flavor: FLAVOR_PAID, config: validConfig, installId: 'not-a-uuid',
        entitlement: activeEntitlement,
      }),
      (e) => e.code === LICENSE_CODES.NOT_ACTIVATED && e.detail === 'install_id_missing',
    );
    assert.throws(
      () => evaluateLocalGate({
        flavor: FLAVOR_PAID, config: validConfig, installId,
        entitlement: { ...activeEntitlement, status: '   ' },
      }),
      (e) => e.code === LICENSE_CODES.NOT_ACTIVATED,
    );
    assert.throws(
      () => evaluateLocalGate({
        flavor: FLAVOR_PAID, config: validConfig, installId,
        entitlement: { ...activeEntitlement, status: 'pending_payment' },
      }),
      (e) => e.code === LICENSE_CODES.NOT_ACTIVATED && String(e.detail||'').includes('status_'),
    );
    assert.throws(
      () => evaluateLocalGate({
        flavor: FLAVOR_PAID, config: validConfig, installId,
        entitlement: { ...activeEntitlement, expiresAtMs: Number.NaN },
      }),
      (e) => e.code === LICENSE_CODES.LICENSE_EXPIRED && e.detail === 'expiry_invalid',
    );
    assert.throws(
      () => evaluateLocalGate({
        flavor: FLAVOR_PAID, config: validConfig, installId,
        entitlement: { ...activeEntitlement, expiresAtMs: 'tomorrow' },
      }),
      (e) => e.code === LICENSE_CODES.LICENSE_EXPIRED && e.detail === 'expiry_invalid',
    );
  });

  it('denies missing/null status, Infinity expiry, array entitlement, requireSigned sync (anti-resale edges)', () => {
    assert.throws(
      () => evaluateLocalGate({
        flavor: FLAVOR_PAID, config: validConfig, installId,
        entitlement: { ...activeEntitlement, status: null },
      }),
      (e) => e.code === LICENSE_CODES.NOT_ACTIVATED && e.detail === 'status_empty',
    );
    assert.throws(
      () => evaluateLocalGate({
        flavor: FLAVOR_PAID, config: validConfig, installId,
        entitlement: (({ status, ...rest }) => rest)(activeEntitlement),
      }),
      (e) => e.code === LICENSE_CODES.NOT_ACTIVATED && e.detail === 'status_empty',
    );
    assert.throws(
      () => evaluateLocalGate({
        flavor: FLAVOR_PAID, config: validConfig, installId,
        entitlement: { ...activeEntitlement, expiresAtMs: Number.POSITIVE_INFINITY },
      }),
      (e) => e.code === LICENSE_CODES.LICENSE_EXPIRED && e.detail === 'expiry_invalid',
    );
    assert.throws(
      () => evaluateLocalGate({
        flavor: FLAVOR_PAID, config: validConfig, installId,
        entitlement: { ...activeEntitlement, expiresAtMs: Number.NEGATIVE_INFINITY },
      }),
      (e) => e.code === LICENSE_CODES.LICENSE_EXPIRED && e.detail === 'expiry_invalid',
    );
    // Arrays are typeof object but have no status → fail-closed as empty status.
    assert.throws(
      () => evaluateLocalGate({
        flavor: FLAVOR_PAID, config: validConfig, installId,
        entitlement: [activeEntitlement],
      }),
      (e) => e.code === LICENSE_CODES.NOT_ACTIVATED && e.detail === 'status_empty',
    );
    assert.throws(
      () => evaluateLocalGate({
        flavor: FLAVOR_PAID, config: validConfig, installId,
        entitlement: 'active',
      }),
      (e) => e.code === LICENSE_CODES.NOT_ACTIVATED && e.detail === 'entitlement_missing',
    );
    const signedCfg = { ...validConfig, requireSignedEntitlement: true, publicKeyPem: null };
    assert.throws(
      () => evaluateLocalGate({
        flavor: FLAVOR_PAID, config: signedCfg, installId,
        entitlement: { ...activeEntitlement, signature: 'deadbeef' },
      }),
      (e) => e.code === LICENSE_CODES.CONFIG_MISSING && e.detail === 'public_key_pem_missing',
    );
    assert.throws(
      () => evaluateLocalGate({
        flavor: FLAVOR_PAID,
        config: {
          ...validConfig,
          requireSignedEntitlement: true,
          publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA\n-----END PUBLIC KEY-----',
        },
        installId,
        entitlement: { ...activeEntitlement },
      }),
      (e) => e.code === LICENSE_CODES.NOT_ACTIVATED && e.detail === 'signature_missing',
    );
  });

  it('allows active matching entitlement', () => {
    const result = evaluateLocalGate({
      flavor: FLAVOR_PAID,
      config: validConfig,
      installId,
      entitlement: activeEntitlement,
      nowMs: Date.now(),
    });
    assert.equal(result.allowed, true);
    assert.equal(result.flavor, FLAVOR_PAID);
  });
});

describe('binding sketch', () => {
  it('ensures install id and matches entitlement', async () => {
    const storage = memoryStorage();
    const id = await ensureInstallId(storage, { randomId: () => installId });
    assert.equal(id, installId);
    assert.equal(await ensureInstallId(storage), installId);
    assert.equal(isInstallId(id), true);
    assert.equal(bindingMatches(activeEntitlement, { installId }), true);
    assert.equal(bindingMatches(activeEntitlement, { installId: '00000000-0000-4000-8000-000000000000' }), false);
    const digest = await localBindingDigest({ installId, profileHash: 'abc', licenseId: 'lic' });
    assert.match(digest, /^[a-f0-9]{64}$/);
  });
});

describe('client + RESUME_PAID_VERIFY handler', () => {
  it('handler returns allowed:false without entitlement (fail-closed)', async () => {
    const storage = memoryStorage({ resumeLicenseInstallId: installId });
    const client = createLicenseClient({ config: validConfig, storage });
    const handle = createPaidVerifyHandler(client);
    const result = await handle();
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'license_required');
    assert.equal(result.licenseCode, LICENSE_CODES.NOT_ACTIVATED);
  });

  it('handler allows when local entitlement active', async () => {
    const storage = memoryStorage({
      resumeLicenseInstallId: installId,
      resumeLicenseEntitlement: activeEntitlement,
    });
    const client = createLicenseClient({ config: validConfig, storage });
    const handle = createPaidVerifyHandler(client);
    assert.deepEqual(await handle(), { allowed: true });
  });

  it('online verify fails closed when server unreachable', async () => {
    const storage = memoryStorage({
      resumeLicenseInstallId: installId,
      resumeLicenseEntitlement: activeEntitlement,
    });
    const client = createLicenseClient({
      config: validConfig,
      storage,
      requireOnline: true,
      fetchImpl: async () => { throw new Error('network down'); },
    });
    await assert.rejects(
      () => client.verifyBeforeFill(),
      (e) => e.code === LICENSE_CODES.SERVER_UNAVAILABLE,
    );
  });

  it('createLocalVerifyBeforeFill fails closed on empty state', async () => {
    const verify = createLocalVerifyBeforeFill(async () => ({
      flavor: FLAVOR_PAID,
      config: validConfig,
      installId,
      entitlement: null,
    }));
    await assert.rejects(() => verify(), (e) => e.code === LICENSE_CODES.NOT_ACTIVATED);
  });
});

describe('internal bypass preserved in source tree', () => {
  it('root manifest still points at ordinary worker (paid gate OFF)', () => {
    const manifest = JSON.parse(readFileSync(resolve('manifest.json'), 'utf8'));
    assert.equal(manifest.background.service_worker, 'src/background/worker.mjs');
    assert.equal(manifest.version, '0.1.4.9');
  });

  it('build-internal allowlist does not include src/license', () => {
    const script = readFileSync(resolve('scripts/build-internal.ps1'), 'utf8');
    assert.equal(script.includes('src/license/'), false);
    assert.equal(script.includes('guard-worker.mjs'), false);
  });
});
