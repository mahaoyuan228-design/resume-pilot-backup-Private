// Pure local license gate. Fail-closed: unknown / missing / expired → deny.
// No network. A future server client calls this after signature verify.

import { FLAVOR_INTERNAL, FLAVOR_PAID, isPaidFlavor, normalizeFlavor } from './flavor.mjs';
import { LICENSE_CODES, LicenseGateError } from './errors.mjs';
import { bindingMatches, isInstallId } from './binding.mjs';

/**
 * @typedef {object} PaidConfig
 * @property {'paid'|'internal'} [buildFlavor]
 * @property {string|null} [licenseServiceUrl]
 * @property {string|null} [publicKeyPem] Ed25519 SPKI PEM; required when requireSignedEntitlement
 * @property {boolean} [requireSignedEntitlement] when true, missing key or unsigned entitlement → deny
 */

/**
 * @typedef {object} EntitlementRecord
 * @property {string} [status]  active | revoked | expired
 * @property {string} [installId]
 * @property {string|null} [profileHash]
 * @property {string|null} [licenseId]
 * @property {number|null} [expiresAtMs]
 * @property {string} [signature] Ed25519 base64 over signedPayload
 * @property {object} [signedPayload] exact JSON object that was signed
 * @property {boolean} [signed]
 */

/**
 * Validate paid-config shape. Missing HTTPS URL → not usable (fail-closed).
 * @param {PaidConfig|null|undefined} config
 */
export function assertPaidConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new LicenseGateError(LICENSE_CODES.CONFIG_MISSING, 'paid_config_absent');
  }
  if (!isPaidFlavor(config.buildFlavor)) {
    throw new LicenseGateError(LICENSE_CODES.CONFIG_MISSING, 'flavor_not_paid');
  }
  const url = config.licenseServiceUrl;
  if (typeof url !== 'string' || !/^https:\/\/[^/\s]+/i.test(url)) {
    throw new LicenseGateError(LICENSE_CODES.CONFIG_MISSING, 'license_url_not_https');
  }
  return config;
}

/**
 * Evaluate a local entitlement snapshot. Does not contact a server.
 * @param {object} input
 * @param {'internal'|'paid'|string} input.flavor
 * @param {PaidConfig|null} [input.config] required when flavor is paid
 * @param {EntitlementRecord|null} [input.entitlement]
 * @param {string|null} [input.installId]
 * @param {string|null} [input.profileHash]
 * @param {number} [input.nowMs]
 * @returns {{ allowed: true } | never}
 */
export function evaluateLocalGate(input = {}) {
  const flavor = normalizeFlavor(input.flavor);
  // Internal flavor: gate is inert (ordinary worker never calls this).
  if (flavor === FLAVOR_INTERNAL) return { allowed: true, flavor: FLAVOR_INTERNAL };

  assertPaidConfig(input.config || null);

  const installId = input.installId;
  if (!isInstallId(installId)) {
    throw new LicenseGateError(LICENSE_CODES.NOT_ACTIVATED, 'install_id_missing');
  }

  const entitlement = input.entitlement;
  if (!entitlement || typeof entitlement !== 'object') {
    throw new LicenseGateError(LICENSE_CODES.NOT_ACTIVATED, 'entitlement_missing');
  }

  // Sync fail-closed for signed mode (crypto re-verify is async — see isFillAllowedAsync).
  const requireSigned = input.config?.requireSignedEntitlement === true;
  if (requireSigned) {
    const pem = input.config?.publicKeyPem;
    if (typeof pem !== 'string' || !pem.includes('BEGIN PUBLIC KEY')) {
      throw new LicenseGateError(LICENSE_CODES.CONFIG_MISSING, 'public_key_pem_missing');
    }
    if (!entitlement.signature) {
      throw new LicenseGateError(LICENSE_CODES.NOT_ACTIVATED, 'signature_missing');
    }
  }

  const status = String(entitlement.status || '').trim().toLowerCase();
  if (status === 'revoked') {
    throw new LicenseGateError(LICENSE_CODES.LICENSE_REVOKED, 'status_revoked');
  }
  if (status === 'device_revoked') {
    throw new LicenseGateError(LICENSE_CODES.DEVICE_REVOKED, 'device_revoked');
  }
  // Explicit expired status (distinct from past expiresAtMs below).
  if (status === 'expired') {
    throw new LicenseGateError(LICENSE_CODES.LICENSE_EXPIRED, 'status_expired');
  }
  // Fail-closed: missing / blank / unknown status is not active (anti-resale).
  if (status !== 'active') {
    throw new LicenseGateError(LICENSE_CODES.NOT_ACTIVATED, `status_${status || 'empty'}`);
  }

  if (!bindingMatches(entitlement, {
    installId,
    profileHash: input.profileHash ?? null,
  })) {
    // Wrong installId or optional profileHash seat mismatch — not "revoked".
    throw new LicenseGateError(LICENSE_CODES.BINDING_MISMATCH, 'binding_mismatch');
  }

  const nowMs = Number.isFinite(input.nowMs) ? input.nowMs : Date.now();
  const expiresAtMs = entitlement.expiresAtMs;
  if (expiresAtMs != null) {
    if (!Number.isFinite(expiresAtMs)) {
      throw new LicenseGateError(LICENSE_CODES.LICENSE_EXPIRED, 'expiry_invalid');
    }
    if (nowMs >= expiresAtMs) {
      throw new LicenseGateError(LICENSE_CODES.LICENSE_EXPIRED, 'past_expiry');
    }
  }

  return { allowed: true, flavor: FLAVOR_PAID };
}

/**
 * Wrap evaluateLocalGate into a verifyBeforeFill-compatible async function.
 * Fail-closed on any throw.
 */
export function createLocalVerifyBeforeFill(getState) {
  return async function verifyBeforeFill() {
    const state = await getState();
    const result = evaluateLocalGate(state);
    if (result?.allowed !== true) {
      throw new LicenseGateError(LICENSE_CODES.NOT_ACTIVATED, 'gate_denied');
    }
    return true;
  };
}
