import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, it } from 'node:test';
import { ENTITLEMENT_KEY, INSTALL_ID_KEY } from '../src/license/binding.mjs';
import { createLicenseClient, createPaidVerifyHandler } from '../src/license/client.mjs';
import { activateLocalToken, readLicenseStatus } from '../src/license/entitlement.mjs';
import { assertPaidConfig } from '../src/license/gate.mjs';
import { canonicalJson } from '../src/license/signed-entitlement.mjs';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const installId = '11111111-2222-4333-a444-555555555555';
const otherInstallId = '99999999-2222-4333-a444-555555555555';
const nowMs = Date.now();
const config = {
  buildFlavor: 'paid',
  verificationMode: 'offline',
  licenseServiceUrl: null,
  publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
  requireSignedEntitlement: true,
};

function token(overrides = {}) {
  const payload = {
    status: 'active', installId, profileHash: null,
    licenseId: 'offline-paid-fill', expiresAtMs: nowMs + 86400000,
    ...overrides,
  };
  return {
    v: 1, alg: 'Ed25519', payload,
    signature: sign(null, Buffer.from(canonicalJson(payload)), privateKey).toString('base64'),
  };
}

function memoryStorage() {
  const data = { [INSTALL_ID_KEY]: installId };
  return {
    data,
    async get(key) { return { [key]: data[key] }; },
    async set(value) { Object.assign(data, structuredClone(value)); },
  };
}

async function activate(storage, envelope = token(), options = {}) {
  return activateLocalToken({
    storage, config, flavor: 'paid', nowMs,
    tokenText: typeof envelope === 'string' ? envelope : JSON.stringify(envelope),
    ...options,
  });
}

describe('offline signed activation', () => {
  it('opens the paid fill entitlement without a service or network', async () => {
    const storage = memoryStorage();
    let fetchCalls = 0;
    const client = createLicenseClient({
      config, storage,
      fetchImpl: async () => { fetchCalls += 1; throw new Error('offline'); },
    });
    const handle = createPaidVerifyHandler(client);
    assert.equal((await handle()).allowed, false);
    assert.equal((await readLicenseStatus({ flavor: 'paid', config, storage })).allowed, false);

    const encoded = Buffer.from(JSON.stringify(token())).toString('base64');
    assert.equal((await activate(storage, encoded)).allowed, true);
    assert.equal(await client.verifyBeforeFill(), true);
    assert.deepEqual(await handle(), { allowed: true });
    const status = await readLicenseStatus({ flavor: 'paid', config, storage });
    assert.equal(status.allowed, true);
    assert.equal(status.licenseId, 'offline-paid-fill');
    assert.equal(fetchCalls, 0);
  });

  it('requires signed configuration and rejects an online/offline conflict', async () => {
    assert.doesNotThrow(() => assertPaidConfig(config));
    for (const override of [
      { requireSignedEntitlement: false },
      { publicKeyPem: null },
      { licenseServiceUrl: 'https://unused.invalid' },
      { verificationMode: 'unknown' },
    ]) {
      assert.throws(() => assertPaidConfig({ ...config, ...override }),
        (error) => error.code === 'CONFIG_MISSING');
    }
    let fetchCalls = 0;
    const client = createLicenseClient({
      config, storage: memoryStorage(), requireOnline: true,
      fetchImpl: async () => { fetchCalls += 1; throw new Error('offline'); },
    });
    await assert.rejects(() => client.verifyBeforeFill(),
      (error) => error.code === 'CONFIG_MISSING' && error.detail === 'offline_online_conflict');
    assert.equal(fetchCalls, 0);
  });

  it('rejects missing, unsigned, expired, forged and wrong-device codes without persisting them', async () => {
    const forged = token();
    forged.payload.licenseId = 'forged';
    const badSignature = token();
    const bytes = Buffer.from(badSignature.signature, 'base64');
    bytes[0] ^= 0xff;
    badSignature.signature = bytes.toString('base64');
    for (const [value, detail] of [
      ['', 'token_empty'],
      ['invalid-code', 'token_unparseable'],
      [JSON.stringify(token().payload), 'signature_missing'],
      [token({ expiresAtMs: nowMs }), 'past_expiry'],
      [token({ installId: otherInstallId }), 'token_bound_other_device'],
      [forged, 'signature_invalid'],
      [badSignature, 'signature_invalid'],
    ]) {
      const storage = memoryStorage();
      await assert.rejects(() => activate(storage, value), (error) => error.detail === detail);
      assert.equal(storage.data[ENTITLEMENT_KEY], undefined, detail);
    }
  });

  it('rechecks expiry in both status and fill decisions', async () => {
    const storage = memoryStorage();
    await activate(storage);
    const expiredAt = token().payload.expiresAtMs;
    const client = createLicenseClient({ config, storage });
    await assert.rejects(() => client.verifyLocal({ nowMs: expiredAt }),
      (error) => error.code === 'LICENSE_EXPIRED');
    const status = await readLicenseStatus({ flavor: 'paid', config, storage, nowMs: expiredAt });
    assert.equal(status.allowed, false);
    assert.equal(status.licenseCode, 'LICENSE_EXPIRED');
  });

  it('rejects changes to stored signed fields, including a forged future expiry', async () => {
    for (const [field, value] of Object.entries({
      status: 'revoked', installId: otherInstallId, profileHash: 'forged-seat',
      licenseId: 'forged-license', expiresAtMs: nowMs + 2 * 86400000,
    })) {
      const storage = memoryStorage();
      await activate(storage, token({ profileHash: 'seat-a' }), { profileHash: 'seat-a' });
      storage.data[ENTITLEMENT_KEY][field] = value;
      const client = createLicenseClient({ config, storage });
      await assert.rejects(() => client.verifyLocal({ profileHash: 'seat-a' }),
        (error) => error.detail === 'signed_fields_mismatch', field);
      const status = await readLicenseStatus({ flavor: 'paid', config, storage, profileHash: 'seat-a' });
      assert.equal(status.allowed, false, field);
    }
  });

  it('reverifies stored signature in both the status page and fill handler', async () => {
    const storage = memoryStorage();
    await activate(storage);
    storage.data[ENTITLEMENT_KEY].signedPayload.licenseId = 'changed-after-activation';
    const client = createLicenseClient({ config, storage });
    assert.equal((await createPaidVerifyHandler(client)()).allowed, false);
    assert.equal((await readLicenseStatus({ flavor: 'paid', config, storage })).allowed, false);
  });

  it('preserves local binding for a signed token issued without a device binding', async () => {
    const storage = memoryStorage();
    await activate(storage, token({ installId: null }));
    assert.equal(storage.data[ENTITLEMENT_KEY].installId, installId);
    assert.equal(await createLicenseClient({ config, storage }).verifyBeforeFill(), true);
  });
});
