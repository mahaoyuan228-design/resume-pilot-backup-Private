/**
 * Smoke: DEV-ONLY mock /v1/verify allow + deny against createLicenseClient.
 * Starts an ephemeral HTTPS (or HTTP) mock; never claims a production service.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import https from 'node:https';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  startMockLicenseServer,
  buildVerifyResponse,
  ensureDevTlsMaterialSync,
} from '../scripts/dev-mock-license-server.mjs';
import { createLicenseClient } from '../src/license/client.mjs';
import { LICENSE_CODES, LicenseGateError } from '../src/license/errors.mjs';
import { ENTITLEMENT_KEY, INSTALL_ID_KEY } from '../src/license/binding.mjs';
import { FLAVOR_PAID } from '../src/license/flavor.mjs';
import { readFileSync as readFs } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const installId = '11111111-2222-4333-a444-555555555555';

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

/** fetch that accepts the DEV-ONLY self-signed cert (Node only). */
function createDevTrustingFetch(certPem) {
  const agent = new https.Agent({
    rejectUnauthorized: false,
    ca: certPem || undefined,
  });
  return async function fetchImpl(url, init = {}) {
    const target = typeof url === 'string' ? url : String(url);
    if (target.startsWith('https:')) {
      const { hostname, port, pathname } = new URL(target);
      const body = init.body || null;
      const headers = { ...(init.headers || {}) };
      return new Promise((resolve, reject) => {
        const req = https.request({
          hostname,
          port: port || 443,
          path: pathname,
          method: init.method || 'GET',
          headers,
          agent,
        }, (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const buf = Buffer.concat(chunks);
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              async json() {
                return JSON.parse(buf.toString('utf8') || '{}');
              },
              async text() {
                return buf.toString('utf8');
              },
            });
          });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
      });
    }
    return globalThis.fetch(url, init);
  };
}

describe('buildVerifyResponse modes (no listen)', () => {
  it('allow returns active future expiry', () => {
    const r = buildVerifyResponse('allow', { installId, profileHash: null });
    assert.equal(r.statusCode, 200);
    assert.equal(r.body.status, 'active');
    assert.equal(r.body.installId, installId);
    assert.ok(r.body.expiresAtMs > Date.now());
  });

  it('deny / expired / revoked / http_500 shapes', () => {
    assert.equal(buildVerifyResponse('deny', { installId }).body.status, 'inactive');
    assert.ok(buildVerifyResponse('expired', { installId }).body.expiresAtMs < Date.now());
    assert.equal(buildVerifyResponse('revoked', { installId }).body.status, 'revoked');
    assert.equal(buildVerifyResponse('http_500', { installId }).statusCode, 500);
  });
});

describe('mock HTTPS /v1/verify + license client smoke', () => {
  it('allow mode → verifyOnline succeeds when local entitlement active', async () => {
    const tls = ensureDevTlsMaterialSync();
    const mock = await startMockLicenseServer({ port: 0, mode: 'allow', http: false, tls });
    try {
      const storage = memoryStorage({
        [INSTALL_ID_KEY]: installId,
        [ENTITLEMENT_KEY]: {
          status: 'active',
          installId,
          profileHash: null,
          licenseId: 'local-seed',
          expiresAtMs: Date.now() + 86400000,
        },
      });
      const client = createLicenseClient({
        config: {
          buildFlavor: FLAVOR_PAID,
          licenseServiceUrl: mock.baseUrl,
          publicKeyPem: null,
        },
        storage,
        fetchImpl: createDevTrustingFetch(tls.cert),
        requireOnline: true,
      });
      const result = await client.verifyOnline({ profileHash: null });
      assert.equal(result.allowed, true);
      assert.equal(result.flavor, FLAVOR_PAID);
    } finally {
      await mock.close();
    }
  });

  it('deny mode → verifyOnline fail-closed NOT_ACTIVATED', async () => {
    const tls = ensureDevTlsMaterialSync();
    const mock = await startMockLicenseServer({ port: 0, mode: 'deny', http: false, tls });
    try {
      const storage = memoryStorage({
        [INSTALL_ID_KEY]: installId,
        [ENTITLEMENT_KEY]: {
          status: 'active',
          installId,
          profileHash: null,
          licenseId: 'local-seed',
          expiresAtMs: Date.now() + 86400000,
        },
      });
      const client = createLicenseClient({
        config: {
          buildFlavor: FLAVOR_PAID,
          licenseServiceUrl: mock.baseUrl,
          publicKeyPem: null,
        },
        storage,
        fetchImpl: createDevTrustingFetch(tls.cert),
        requireOnline: true,
      });
      await assert.rejects(
        () => client.verifyOnline({ profileHash: null }),
        (e) => e instanceof LicenseGateError && e.code === LICENSE_CODES.NOT_ACTIVATED,
      );
    } finally {
      await mock.close();
    }
  });

  it('expired mode → LICENSE_EXPIRED', async () => {
    const tls = ensureDevTlsMaterialSync();
    const mock = await startMockLicenseServer({ port: 0, mode: 'expired', http: false, tls });
    try {
      const storage = memoryStorage({
        [INSTALL_ID_KEY]: installId,
        [ENTITLEMENT_KEY]: {
          status: 'active',
          installId,
          profileHash: null,
          licenseId: 'local-seed',
          expiresAtMs: Date.now() + 86400000,
        },
      });
      const client = createLicenseClient({
        config: {
          buildFlavor: FLAVOR_PAID,
          licenseServiceUrl: mock.baseUrl,
          publicKeyPem: null,
        },
        storage,
        fetchImpl: createDevTrustingFetch(tls.cert),
        requireOnline: true,
      });
      await assert.rejects(
        () => client.verifyOnline({ profileHash: null }),
        (e) => e instanceof LicenseGateError && e.code === LICENSE_CODES.LICENSE_EXPIRED,
      );
    } finally {
      await mock.close();
    }
  });

  it('http_503 → SERVER_UNAVAILABLE', async () => {
    const tls = ensureDevTlsMaterialSync();
    const mock = await startMockLicenseServer({ port: 0, mode: 'http_503', http: false, tls });
    try {
      const storage = memoryStorage({
        [INSTALL_ID_KEY]: installId,
        [ENTITLEMENT_KEY]: {
          status: 'active',
          installId,
          profileHash: null,
          licenseId: 'local-seed',
          expiresAtMs: Date.now() + 86400000,
        },
      });
      const client = createLicenseClient({
        config: {
          buildFlavor: FLAVOR_PAID,
          licenseServiceUrl: mock.baseUrl,
          publicKeyPem: null,
        },
        storage,
        fetchImpl: createDevTrustingFetch(tls.cert),
        requireOnline: true,
      });
      await assert.rejects(
        () => client.verifyOnline({ profileHash: null }),
        (e) => e instanceof LicenseGateError && e.code === LICENSE_CODES.SERVER_UNAVAILABLE,
      );
    } finally {
      await mock.close();
    }
  });

  it('packaging asserts: mock script not in build-internal allowlist', () => {
    const buildInternal = readFs(join(repoRoot, 'scripts/build-internal.ps1'), 'utf8');
    const buildPaid = readFs(join(repoRoot, 'scripts/build-paid.ps1'), 'utf8');
    assert.equal(buildInternal.includes('dev-mock-license-server'), false);
    assert.equal(buildPaid.includes('dev-mock-license-server'), false);
    assert.equal(buildInternal.includes('dev-mock-license-certs'), false);
    // Product allowlist must still exclude scripts/ entirely for extension copy.
    assert.match(buildInternal, /src\/background\/cms-page-focus\.mjs/);
  });
});
