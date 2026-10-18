// Thin entitlement helpers for paid worker + activate UI.
// Fail-closed. Internal flavor always allows fill. No payment credentials.

import { ENTITLEMENT_KEY, ensureInstallId, isInstallId } from './binding.mjs';
import { LICENSE_CODES, LicenseGateError, toUiLicenseCode } from './errors.mjs';
import { FLAVOR_INTERNAL, normalizeFlavor } from './flavor.mjs';
import { evaluateLocalGate } from './gate.mjs';
import {
  isSignedEntitlementEnvelope,
  reverifyStoredSignedEntitlement,
  verifySignedEntitlement,
} from './signed-entitlement.mjs';

/** Chinese copy aligned with popup.js license_required messages. */
export const LICENSE_CODE_ZH = Object.freeze({
  [LICENSE_CODES.NOT_ACTIVATED]: '尚未激活授权。请打开「授权激活」页粘贴经营者签发的令牌。',
  [LICENSE_CODES.LICENSE_REVOKED]: '许可已停用。如需继续使用，请联系经营者重新签发。',
  [LICENSE_CODES.LICENSE_EXPIRED]: '许可已过期。请向经营者申请续期令牌后重新激活。',
  [LICENSE_CODES.DEVICE_REVOKED]: '本机授权已撤销，无法在此浏览器继续填写。',
  [LICENSE_CODES.SERVER_UNAVAILABLE]: '暂时无法连接授权服务，请稍后重试（本机令牌未通过在线核验时也会出现）。',
  [LICENSE_CODES.CONFIG_MISSING]: '授权配置缺失，无法核验。',
  [LICENSE_CODES.BINDING_MISMATCH]: '授权与本机不匹配（installId 或席位绑定不符）。',
});

export function licenseCodeToZh(code) {
  const ui = toUiLicenseCode(code);
  return LICENSE_CODE_ZH[ui] || LICENSE_CODE_ZH[LICENSE_CODES.NOT_ACTIVATED];
}

/**
 * Paid-worker helper: is a fill allowed right now?
 * Always returns a plain object — never throws (fail-closed → allowed:false).
 *
 * @param {object} input same shape as evaluateLocalGate
 * @returns {{ allowed: boolean, flavor: string, licenseCode?: string, reason?: string, detail?: string }}
 */
export function isFillAllowed(input = {}) {
  const flavor = normalizeFlavor(input.flavor);
  if (flavor === FLAVOR_INTERNAL) {
    return { allowed: true, flavor: FLAVOR_INTERNAL };
  }
  try {
    const result = evaluateLocalGate(input);
    if (result?.allowed === true) {
      return { allowed: true, flavor: result.flavor };
    }
    return {
      allowed: false,
      flavor,
      licenseCode: LICENSE_CODES.NOT_ACTIVATED,
      reason: 'license_required',
      detail: 'gate_denied',
    };
  } catch (error) {
    const licenseCode = toUiLicenseCode(
      error instanceof LicenseGateError ? error.code : error?.code,
    );
    return {
      allowed: false,
      flavor,
      licenseCode,
      reason: 'license_required',
      detail: error?.detail || error?.message || 'gate_error',
    };
  }
}

/**
 * Async fill check: re-verifies Ed25519 when entitlement carries a signature
 * or config.requireSignedEntitlement is set. Internal bypass unchanged.
 * Fail-closed if signature required but publicKeyPem missing.
 */
export async function isFillAllowedAsync(input = {}) {
  const flavor = normalizeFlavor(input.flavor);
  if (flavor === FLAVOR_INTERNAL) {
    return { allowed: true, flavor: FLAVOR_INTERNAL };
  }

  const entitlement = input.entitlement;
  const requireSigned = input.config?.requireSignedEntitlement === true;
  const hasSig = Boolean(entitlement?.signature);

  if (requireSigned || hasSig) {
    try {
      const pem = input.config?.publicKeyPem;
      if (typeof pem !== 'string' || !pem.includes('BEGIN PUBLIC KEY')) {
        throw new LicenseGateError(LICENSE_CODES.CONFIG_MISSING, 'public_key_pem_missing');
      }
      if (!hasSig) {
        throw new LicenseGateError(LICENSE_CODES.NOT_ACTIVATED, 'signature_missing');
      }
      await reverifyStoredSignedEntitlement(entitlement, pem);
    } catch (error) {
      const licenseCode = toUiLicenseCode(
        error instanceof LicenseGateError ? error.code : error?.code,
      );
      return {
        allowed: false,
        flavor,
        licenseCode,
        reason: 'license_required',
        detail: error?.detail || error?.message || 'signature_error',
      };
    }
  }

  return isFillAllowed(input);
}

/**
 * Snapshot for activate UI status line.
 * @returns {Promise<{ flavor: string, installId: string|null, status: string, licenseId: string|null, expiresAtMs: number|null, allowed: boolean, licenseCode?: string, messageZh: string }>}
 */
export async function readLicenseStatus({
  flavor,
  config = null,
  storage,
  profileHash = null,
  nowMs = Date.now(),
} = {}) {
  const normalized = normalizeFlavor(flavor);
  if (normalized === FLAVOR_INTERNAL) {
    return {
      flavor: FLAVOR_INTERNAL,
      installId: null,
      status: 'internal_bypass',
      licenseId: null,
      expiresAtMs: null,
      allowed: true,
      messageZh: '内部试用版：无需激活授权。',
    };
  }

  let installId = null;
  try {
    installId = await ensureInstallId(storage);
  } catch {
    installId = null;
  }

  const bag = await storage.get(ENTITLEMENT_KEY);
  const entitlement = bag?.[ENTITLEMENT_KEY] ?? null;
  const decision = isFillAllowed({
    flavor: normalized,
    config,
    entitlement,
    installId,
    profileHash,
    nowMs,
  });

  const status = entitlement?.status
    ? String(entitlement.status)
    : (decision.allowed ? 'active' : 'not_activated');

  return {
    flavor: normalized,
    installId,
    status,
    licenseId: entitlement?.licenseId ?? null,
    expiresAtMs: Number.isFinite(entitlement?.expiresAtMs) ? entitlement.expiresAtMs : null,
    allowed: decision.allowed === true,
    licenseCode: decision.licenseCode,
    messageZh: decision.allowed
      ? '授权有效，可以使用填写功能。'
      : licenseCodeToZh(decision.licenseCode),
  };
}

/**
 * Parse a locally pasted activation token.
 * Accepted forms (no payment APIs):
 * - JSON object text (unsigned sketch OR signed envelope { v, alg, payload, signature })
 * - base64 / base64url encoding of that JSON
 * Signed envelopes are returned with signedEnvelope:true; crypto verify happens in activateLocalToken.
 */
export function parseActivationToken(raw) {
  const text = String(raw ?? '').trim();
  if (!text) {
    throw new LicenseGateError(LICENSE_CODES.NOT_ACTIVATED, 'token_empty');
  }

  let parsed = tryParseJson(text);
  if (parsed == null) {
    const decoded = tryDecodeBase64Json(text);
    if (decoded == null) {
      throw new LicenseGateError(LICENSE_CODES.NOT_ACTIVATED, 'token_unparseable');
    }
    parsed = decoded;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new LicenseGateError(LICENSE_CODES.NOT_ACTIVATED, 'token_not_object');
  }

  if (isSignedEntitlementEnvelope(parsed)) {
    const p = parsed.payload;
    const status = String(p.status || '').toLowerCase();
    if (!status) {
      throw new LicenseGateError(LICENSE_CODES.NOT_ACTIVATED, 'token_status_missing');
    }
    let expiresAtMs = p.expiresAtMs ?? p.expires_at_ms ?? null;
    if (expiresAtMs != null) {
      expiresAtMs = Number(expiresAtMs);
      if (!Number.isFinite(expiresAtMs)) {
        throw new LicenseGateError(LICENSE_CODES.LICENSE_EXPIRED, 'token_expiry_invalid');
      }
    }
    const installId = p.installId ?? p.install_id ?? null;
    if (installId != null && installId !== '' && !isInstallId(installId)) {
      throw new LicenseGateError(LICENSE_CODES.NOT_ACTIVATED, 'token_install_id_invalid');
    }
    return {
      status,
      installId: installId || null,
      profileHash: p.profileHash ?? p.profile_hash ?? null,
      licenseId: p.licenseId ?? p.license_id ?? null,
      expiresAtMs,
      signedEnvelope: true,
      envelope: parsed,
    };
  }

  const status = String(parsed.status || '').toLowerCase();
  if (!status) {
    throw new LicenseGateError(LICENSE_CODES.NOT_ACTIVATED, 'token_status_missing');
  }

  let expiresAtMs = parsed.expiresAtMs ?? parsed.expires_at_ms ?? null;
  if (expiresAtMs != null) {
    expiresAtMs = Number(expiresAtMs);
    if (!Number.isFinite(expiresAtMs)) {
      throw new LicenseGateError(LICENSE_CODES.LICENSE_EXPIRED, 'token_expiry_invalid');
    }
  }

  const installId = parsed.installId ?? parsed.install_id ?? null;
  if (installId != null && installId !== '' && !isInstallId(installId)) {
    throw new LicenseGateError(LICENSE_CODES.NOT_ACTIVATED, 'token_install_id_invalid');
  }

  return {
    status,
    installId: installId || null,
    profileHash: parsed.profileHash ?? parsed.profile_hash ?? null,
    licenseId: parsed.licenseId ?? parsed.license_id ?? null,
    expiresAtMs,
    signedEnvelope: false,
  };
}

/**
 * Activate locally: bind token to this install, store entitlement, re-check gate.
 * Does not call payment or invent credentials — only persists a pasted entitlement sketch.
 *
 * @returns {Promise<{ allowed: true, entitlement: object, installId: string }>}
 */
export async function activateLocalToken({
  storage,
  tokenText,
  config,
  profileHash = null,
  nowMs = Date.now(),
  flavor = 'paid',
} = {}) {
  const normalized = normalizeFlavor(flavor);
  if (normalized === FLAVOR_INTERNAL) {
    // Internal builds never need activation; refuse writing paid entitlement here.
    throw new LicenseGateError(LICENSE_CODES.CONFIG_MISSING, 'internal_no_activate');
  }

  const draft = parseActivationToken(tokenText);
  const installId = await ensureInstallId(storage);

  let entitlement;

  if (draft.signedEnvelope) {
    // Signed path: verify Ed25519 with publicKeyPem (fail-closed if key missing).
    const verified = await verifySignedEntitlement({
      token: draft.envelope,
      publicKeyPem: config?.publicKeyPem ?? null,
    });
    if (verified.installId && verified.installId !== installId) {
      throw new LicenseGateError(LICENSE_CODES.BINDING_MISMATCH, 'token_bound_other_device');
    }
    entitlement = {
      status: verified.status,
      installId: verified.installId || installId,
      profileHash: verified.profileHash ?? profileHash ?? null,
      licenseId: verified.licenseId,
      expiresAtMs: verified.expiresAtMs,
      signature: verified.signature,
      signedPayload: verified.signedPayload,
      signed: true,
    };
  } else {
    if (config?.requireSignedEntitlement === true) {
      throw new LicenseGateError(LICENSE_CODES.NOT_ACTIVATED, 'signature_missing');
    }
    if (draft.installId && draft.installId !== installId) {
      throw new LicenseGateError(LICENSE_CODES.BINDING_MISMATCH, 'token_bound_other_device');
    }
    entitlement = {
      status: draft.status,
      installId,
      profileHash: draft.profileHash ?? profileHash ?? null,
      licenseId: draft.licenseId,
      expiresAtMs: draft.expiresAtMs,
    };
  }

  // Validate before write (fail-closed — do not persist a known-deny entitlement as "success").
  evaluateLocalGate({
    flavor: normalized,
    config,
    entitlement,
    installId,
    profileHash: entitlement.profileHash,
    nowMs,
  });

  await storage.set({ [ENTITLEMENT_KEY]: entitlement });
  return { allowed: true, entitlement, installId };
}

/**
 * Clear local entitlement (deactivate on this browser profile).
 */
export async function clearLocalEntitlement(storage) {
  await storage.set({ [ENTITLEMENT_KEY]: null });
  return { cleared: true };
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function tryDecodeBase64Json(text) {
  const compact = text.replace(/\s+/g, '');
  let normalized = compact.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4;
  if (pad) normalized += '='.repeat(4 - pad);
  try {
    const json = typeof atob === 'function'
      ? atob(normalized)
      : Buffer.from(normalized, 'base64').toString('utf8');
    return tryParseJson(json);
  } catch {
    return null;
  }
}
