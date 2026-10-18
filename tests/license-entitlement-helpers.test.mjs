import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LICENSE_CODES, LicenseGateError } from '../src/license/errors.mjs';
import { FLAVOR_INTERNAL, FLAVOR_PAID } from '../src/license/flavor.mjs';
import { ENTITLEMENT_KEY } from '../src/license/binding.mjs';
import {
  activateLocalToken,
  clearLocalEntitlement,
  isFillAllowed,
  licenseCodeToZh,
  parseActivationToken,
  readLicenseStatus,
} from '../src/license/entitlement.mjs';

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

describe('isFillAllowed fail-closed + internal bypass', () => {
  it('allows internal without entitlement or config', () => {
    const result = isFillAllowed({ flavor: FLAVOR_INTERNAL });
    assert.equal(result.allowed, true);
    assert.equal(result.flavor, FLAVOR_INTERNAL);
    assert.equal(result.licenseCode, undefined);
  });

  it('denies paid with missing entitlement (fail-closed, non-throwing)', () => {
    const result = isFillAllowed({
      flavor: FLAVOR_PAID,
      config: validConfig,
      installId,
      entitlement: null,
    });
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'license_required');
    assert.equal(result.licenseCode, LICENSE_CODES.NOT_ACTIVATED);
  });

  it('denies revoked / expired', () => {
    const revoked = isFillAllowed({
      flavor: FLAVOR_PAID,
      config: validConfig,
      installId,
      entitlement: { ...activeEntitlement, status: 'revoked' },
    });
    assert.equal(revoked.allowed, false);
    assert.equal(revoked.licenseCode, LICENSE_CODES.LICENSE_REVOKED);

    const expired = isFillAllowed({
      flavor: FLAVOR_PAID,
      config: validConfig,
      installId,
      entitlement: { ...activeEntitlement, expiresAtMs: Date.now() - 10 },
      nowMs: Date.now(),
    });
    assert.equal(expired.allowed, false);
    assert.equal(expired.licenseCode, LICENSE_CODES.LICENSE_EXPIRED);
  });

  it('allows active matching entitlement', () => {
    const result = isFillAllowed({
      flavor: FLAVOR_PAID,
      config: validConfig,
      installId,
      entitlement: activeEntitlement,
      nowMs: Date.now(),
    });
    assert.equal(result.allowed, true);
  });
});

describe('parseActivationToken + activateLocalToken', () => {
  it('parses JSON and base64 tokens', () => {
    const json = parseActivationToken(JSON.stringify({
      status: 'active',
      licenseId: 'lic-1',
      expiresAtMs: Date.now() + 100000,
    }));
    assert.equal(json.status, 'active');
    assert.equal(json.licenseId, 'lic-1');

    const b64 = Buffer.from(JSON.stringify({
      status: 'active',
      license_id: 'lic-2',
      expires_at_ms: Date.now() + 100000,
    })).toString('base64');
    const fromB64 = parseActivationToken(b64);
    assert.equal(fromB64.licenseId, 'lic-2');
    assert.equal(Number.isFinite(fromB64.expiresAtMs), true);
  });

  it('rejects empty / garbage tokens fail-closed', () => {
    assert.throws(() => parseActivationToken(''), (e) => e.code === LICENSE_CODES.NOT_ACTIVATED);
    assert.throws(() => parseActivationToken('not-json-or-b64!!!'), (e) => e.detail === 'token_unparseable');
  });

  it('activates locally and then isFillAllowed becomes true', async () => {
    const storage = memoryStorage({ resumeLicenseInstallId: installId });
    const token = JSON.stringify({
      status: 'active',
      licenseId: 'lic-activate',
      expiresAtMs: Date.now() + 86400000,
    });
    const activated = await activateLocalToken({
      storage,
      tokenText: token,
      config: validConfig,
      flavor: FLAVOR_PAID,
    });
    assert.equal(activated.allowed, true);
    assert.equal(activated.entitlement.installId, installId);
    assert.equal(storage._data[ENTITLEMENT_KEY].licenseId, 'lic-activate');

    const decision = isFillAllowed({
      flavor: FLAVOR_PAID,
      config: validConfig,
      installId,
      entitlement: storage._data[ENTITLEMENT_KEY],
      nowMs: Date.now(),
    });
    assert.equal(decision.allowed, true);
  });

  it('refuses token bound to another installId', async () => {
    const storage = memoryStorage({ resumeLicenseInstallId: installId });
    const token = JSON.stringify({
      status: 'active',
      installId: '99999999-2222-4333-a444-555555555555',
      expiresAtMs: Date.now() + 86400000,
    });
    await assert.rejects(
      () => activateLocalToken({ storage, tokenText: token, config: validConfig }),
      (e) => e instanceof LicenseGateError && e.code === LICENSE_CODES.BINDING_MISMATCH,
    );
  });

  it('refuses activate on internal flavor', async () => {
    const storage = memoryStorage({ resumeLicenseInstallId: installId });
    await assert.rejects(
      () => activateLocalToken({
        storage,
        tokenText: JSON.stringify({ status: 'active', expiresAtMs: Date.now() + 1000 }),
        config: validConfig,
        flavor: FLAVOR_INTERNAL,
      }),
      (e) => e.detail === 'internal_no_activate',
    );
  });

  it('does not persist expired token as successful activation', async () => {
    const storage = memoryStorage({ resumeLicenseInstallId: installId });
    await assert.rejects(
      () => activateLocalToken({
        storage,
        tokenText: JSON.stringify({
          status: 'active',
          expiresAtMs: Date.now() - 1,
        }),
        config: validConfig,
        nowMs: Date.now(),
      }),
      (e) => e.code === LICENSE_CODES.LICENSE_EXPIRED,
    );
    assert.equal(storage._data[ENTITLEMENT_KEY], undefined);
  });
});

describe('readLicenseStatus + clear + Chinese copy', () => {
  it('reports internal bypass message', async () => {
    const snap = await readLicenseStatus({
      flavor: FLAVOR_INTERNAL,
      storage: memoryStorage(),
    });
    assert.equal(snap.allowed, true);
    assert.match(snap.messageZh, /内部试用/);
  });

  it('reports Chinese deny when not activated', async () => {
    const storage = memoryStorage({ resumeLicenseInstallId: installId });
    const snap = await readLicenseStatus({
      flavor: FLAVOR_PAID,
      config: validConfig,
      storage,
    });
    assert.equal(snap.allowed, false);
    assert.match(snap.messageZh, /尚未激活授权/);
    assert.match(licenseCodeToZh(LICENSE_CODES.LICENSE_EXPIRED), /许可已过期/);
    assert.match(licenseCodeToZh(LICENSE_CODES.BINDING_MISMATCH), /本机不匹配/);
    assert.match(licenseCodeToZh(LICENSE_CODES.DEVICE_REVOKED), /本机授权已撤销/);
    assert.match(licenseCodeToZh(LICENSE_CODES.SERVER_UNAVAILABLE), /无法连接|授权服务/);
  });

  it('clearLocalEntitlement removes stored entitlement', async () => {
    const storage = memoryStorage({
      resumeLicenseInstallId: installId,
      [ENTITLEMENT_KEY]: activeEntitlement,
    });
    await clearLocalEntitlement(storage);
    assert.equal(storage._data[ENTITLEMENT_KEY], null);
  });
});

describe('paid UI / helpers stay out of internal package', () => {
  it('build-internal allowlist excludes license activate + entitlement', () => {
    const script = readFileSync(resolve('scripts/build-internal.ps1'), 'utf8');
    assert.equal(script.includes('src/license/'), false);
    assert.equal(script.includes('activate.html'), false);
    assert.equal(script.includes('entitlement.mjs'), false);
  });

  it('build-paid.ps1 includes activate UI + entitlement helpers', () => {
    const script = readFileSync(resolve('scripts/build-paid.ps1'), 'utf8');
    assert.equal(script.includes('src/license/entitlement.mjs'), true);
    assert.equal(script.includes('src/license/activate.html'), true);
    assert.equal(script.includes('src/license/activate.js'), true);
    assert.equal(script.includes('src/license/activate.css'), true);
  });

  it('root manifest still ordinary worker (003753 path untouched in source)', () => {
    const manifest = JSON.parse(readFileSync(resolve('manifest.json'), 'utf8'));
    assert.equal(manifest.background.service_worker, 'src/background/worker.mjs');
  });
});
