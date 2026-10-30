// License client stub. Ready to plug an owned HTTPS service later.
// Does NOT invent payment credentials or claim a live server exists.
// Without a real paid-config + reachable service, online verify fails closed.

import { LICENSE_CODES, LicenseGateError, toUiLicenseCode } from './errors.mjs';
import { assertPaidConfig, evaluateLocalGate } from './gate.mjs';
import { ENTITLEMENT_KEY, ensureInstallId } from './binding.mjs';
import { FLAVOR_PAID } from './flavor.mjs';
import { reverifyStoredSignedEntitlement } from './signed-entitlement.mjs';

/**
 * @param {object} options
 * @param {import('./gate.mjs').PaidConfig} options.config
 * @param {{ get: Function, set: Function }} options.storage
 * @param {typeof fetch} [options.fetchImpl]
 * @param {boolean} [options.requireOnline=false] when true, attempt /v1/verify
 */
export function createLicenseClient({
  config,
  storage,
  fetchImpl = globalThis.fetch,
  requireOnline = false,
} = {}) {
  assertPaidConfig(config);

  async function readEntitlement() {
    const bag = await storage.get(ENTITLEMENT_KEY);
    return bag?.[ENTITLEMENT_KEY] ?? null;
  }

  /**
   * Local-only check. Used by unit tests and offline fail-closed paths.
   */
  async function verifyLocal({ profileHash = null, nowMs = Date.now() } = {}) {
    const installId = await ensureInstallId(storage);
    const entitlement = await readEntitlement();
    const requireSigned = config?.requireSignedEntitlement === true;
    if (requireSigned || entitlement?.signature) {
      const pem = config?.publicKeyPem;
      if (typeof pem !== 'string' || !pem.includes('BEGIN PUBLIC KEY')) {
        throw new LicenseGateError(LICENSE_CODES.CONFIG_MISSING, 'public_key_pem_missing');
      }
      if (!entitlement?.signature) {
        throw new LicenseGateError(LICENSE_CODES.NOT_ACTIVATED, 'signature_missing');
      }
      await reverifyStoredSignedEntitlement(entitlement, pem);
    }
    return evaluateLocalGate({
      flavor: FLAVOR_PAID,
      config,
      entitlement,
      installId,
      profileHash,
      nowMs,
    });
  }

  /**
   * Optional online check. Fail-closed if fetch missing, non-OK, or unreachable.
   * Endpoint contract is a sketch: POST { installId } → { status, expiresAtMs, ... }
   * No payment / order APIs here.
   */
  async function verifyOnline({ profileHash = null, nowMs = Date.now() } = {}) {
    if (config.verificationMode === 'offline' && requireOnline) {
      throw new LicenseGateError(LICENSE_CODES.CONFIG_MISSING, 'offline_online_conflict');
    }
    const local = await verifyLocal({ profileHash, nowMs });
    if (!requireOnline) return local;

    if (typeof fetchImpl !== 'function') {
      throw new LicenseGateError(LICENSE_CODES.SERVER_UNAVAILABLE, 'fetch_unavailable');
    }

    const installId = await ensureInstallId(storage);
    const url = new URL('/v1/verify', config.licenseServiceUrl).href;
    let response;
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ installId, profileHash }),
        cache: 'no-store',
        redirect: 'error',
      });
    } catch {
      throw new LicenseGateError(LICENSE_CODES.SERVER_UNAVAILABLE, 'fetch_failed');
    }
    if (!response?.ok) {
      throw new LicenseGateError(LICENSE_CODES.SERVER_UNAVAILABLE, `http_${response?.status || 0}`);
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new LicenseGateError(LICENSE_CODES.SERVER_UNAVAILABLE, 'json_invalid');
    }
    // Re-evaluate with server-provided entitlement fields when present.
    return evaluateLocalGate({
      flavor: FLAVOR_PAID,
      config,
      entitlement: {
        status: payload?.status,
        installId: payload?.installId || installId,
        profileHash: payload?.profileHash ?? profileHash,
        licenseId: payload?.licenseId ?? null,
        expiresAtMs: payload?.expiresAtMs ?? null,
      },
      installId,
      profileHash,
      nowMs,
    });
  }

  async function verifyBeforeFill(options = {}) {
    try {
      await verifyOnline(options);
      return true;
    } catch (error) {
      if (error instanceof LicenseGateError) throw error;
      const code = toUiLicenseCode(error?.code);
      throw new LicenseGateError(code, error?.message || 'verify_failed');
    }
  }

  return {
    verifyLocal,
    verifyOnline,
    verifyBeforeFill,
    readEntitlement,
  };
}

/**
 * Message handler for content-script RESUME_PAID_VERIFY.
 * Always returns { allowed: boolean, licenseCode?: string } — never throws to sender.
 */
export function createPaidVerifyHandler(client) {
  return async function handlePaidVerify() {
    try {
      await client.verifyBeforeFill({ requireOnline: false });
      return { allowed: true };
    } catch (error) {
      const licenseCode = toUiLicenseCode(error?.code || LICENSE_CODES.NOT_ACTIVATED);
      return { allowed: false, licenseCode, reason: 'license_required' };
    }
  };
}
