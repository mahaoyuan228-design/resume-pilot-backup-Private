// Ed25519 signed entitlement verify (offline). Fail-closed.
// No payment APIs. Public key only in paid-config; private keys never ship in packages.

import { LICENSE_CODES, LicenseGateError } from './errors.mjs';

export const SIGNED_ENTITLEMENT_ALG = 'Ed25519';
export const SIGNED_ENTITLEMENT_VERSION = 1;

/**
 * Stable JSON for signing: sorted object keys, UTF-8 string.
 * Arrays keep order; primitives use JSON.stringify.
 */
export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
}

export function canonicalPayloadBytes(payload) {
  return new TextEncoder().encode(canonicalJson(payload));
}

/** True when the parsed object looks like a signed entitlement envelope. */
export function isSignedEntitlementEnvelope(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  if (!obj.payload || typeof obj.payload !== 'object' || Array.isArray(obj.payload)) return false;
  const sig = obj.signature ?? obj.sig;
  return typeof sig === 'string' && sig.length > 0;
}

/**
 * Fail-closed: when signatures are required, publicKeyPem must be a real SPKI PEM.
 * @param {object|null|undefined} config
 * @param {{ requireSignature?: boolean }} [opts]
 * @returns {string|null} pem when required and present
 */
export function assertPublicKeyWhenRequired(config, opts = {}) {
  const requireSignature =
    opts.requireSignature === true
    || config?.requireSignedEntitlement === true;
  if (!requireSignature) return null;

  const pem = config?.publicKeyPem;
  if (typeof pem !== 'string' || !pem.includes('BEGIN PUBLIC KEY')) {
    throw new LicenseGateError(LICENSE_CODES.CONFIG_MISSING, 'public_key_pem_missing');
  }
  return pem;
}

/** Decode base64 / base64url signature to Uint8Array. */
export function decodeSignature(sigText) {
  const compact = String(sigText ?? '').replace(/\s+/g, '');
  if (!compact) {
    throw new LicenseGateError(LICENSE_CODES.NOT_ACTIVATED, 'signature_empty');
  }
  let normalized = compact.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4;
  if (pad) normalized += '='.repeat(4 - pad);
  try {
    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(normalized, 'base64'));
    }
    const bin = atob(normalized);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    throw new LicenseGateError(LICENSE_CODES.NOT_ACTIVATED, 'signature_decode_failed');
  }
}

async function importNodeCrypto() {
  try {
    return await import('node:crypto');
  } catch {
    return null;
  }
}

async function importPublicKey(publicKeyPem) {
  const pem = String(publicKeyPem || '');
  if (!pem.includes('BEGIN PUBLIC KEY')) {
    throw new LicenseGateError(LICENSE_CODES.CONFIG_MISSING, 'public_key_pem_invalid');
  }
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s+/g, '');
  let der;
  try {
    der = typeof Buffer !== 'undefined'
      ? Buffer.from(b64, 'base64')
      : Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  } catch {
    throw new LicenseGateError(LICENSE_CODES.CONFIG_MISSING, 'public_key_pem_decode_failed');
  }

  try {
    const nodeCrypto = await importNodeCrypto();
    if (nodeCrypto?.createPublicKey) {
      return { kind: 'node', key: nodeCrypto.createPublicKey(pem) };
    }
  } catch {
    // fall through to Web Crypto
  }

  if (!globalThis.crypto?.subtle) {
    throw new LicenseGateError(LICENSE_CODES.CONFIG_MISSING, 'crypto_unavailable');
  }
  try {
    const key = await globalThis.crypto.subtle.importKey(
      'spki',
      der,
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
    return { kind: 'subtle', key };
  } catch {
    throw new LicenseGateError(LICENSE_CODES.CONFIG_MISSING, 'public_key_import_failed');
  }
}

/**
 * Verify Ed25519 signature over canonical payload bytes.
 * @returns {Promise<boolean>}
 */
export async function verifyEd25519Signature({ payload, signature, publicKeyPem }) {
  const bytes = payload instanceof Uint8Array ? payload : canonicalPayloadBytes(payload);
  const sig = signature instanceof Uint8Array ? signature : decodeSignature(signature);
  const imported = await importPublicKey(publicKeyPem);

  if (imported.kind === 'node') {
    const nodeCrypto = await importNodeCrypto();
    return nodeCrypto.verify(null, Buffer.from(bytes), imported.key, Buffer.from(sig));
  }

  return globalThis.crypto.subtle.verify({ name: 'Ed25519' }, imported.key, sig, bytes);
}

/**
 * Parse a signed envelope (object already decoded from JSON/base64 token text).
 * Does not verify the signature yet.
 */
export function parseSignedEnvelope(obj) {
  if (!isSignedEntitlementEnvelope(obj)) {
    throw new LicenseGateError(LICENSE_CODES.NOT_ACTIVATED, 'not_signed_envelope');
  }
  const alg = String(obj.alg || SIGNED_ENTITLEMENT_ALG);
  if (alg !== SIGNED_ENTITLEMENT_ALG) {
    throw new LicenseGateError(LICENSE_CODES.NOT_ACTIVATED, 'unsupported_alg');
  }
  const v = obj.v ?? obj.version ?? SIGNED_ENTITLEMENT_VERSION;
  if (Number(v) !== SIGNED_ENTITLEMENT_VERSION) {
    throw new LicenseGateError(LICENSE_CODES.NOT_ACTIVATED, 'unsupported_version');
  }
  const signature = obj.signature ?? obj.sig;
  return {
    v: SIGNED_ENTITLEMENT_VERSION,
    alg: SIGNED_ENTITLEMENT_ALG,
    payload: { ...obj.payload },
    signature: String(signature),
  };
}

/**
 * Normalize payload fields used for signing / re-verify (stable key set).
 */
export function normalizeSignedPayloadFields(p = {}) {
  let expiresAtMs = p.expiresAtMs ?? p.expires_at_ms ?? null;
  if (expiresAtMs != null) {
    expiresAtMs = Number(expiresAtMs);
    if (!Number.isFinite(expiresAtMs)) {
      throw new LicenseGateError(LICENSE_CODES.LICENSE_EXPIRED, 'token_expiry_invalid');
    }
  }
  return {
    status: String(p.status || '').toLowerCase(),
    installId: p.installId ?? p.install_id ?? null,
    profileHash: p.profileHash ?? p.profile_hash ?? null,
    licenseId: p.licenseId ?? p.license_id ?? null,
    expiresAtMs,
  };
}

/**
 * Verify signed entitlement and return gate-ready fields + exact signedPayload.
 * Fail-closed when publicKeyPem missing (signed envelope always requires a key).
 *
 * @param {object} input
 * @param {object|string} input.token signed envelope object or JSON text
 * @param {string|null} [input.publicKeyPem]
 * @returns {Promise<object>}
 */
export async function verifySignedEntitlement({
  token,
  publicKeyPem = null,
} = {}) {
  let obj = token;
  if (typeof token === 'string') {
    try {
      obj = JSON.parse(token);
    } catch {
      throw new LicenseGateError(LICENSE_CODES.NOT_ACTIVATED, 'signed_token_unparseable');
    }
  }

  const envelope = parseSignedEnvelope(obj);

  if (typeof publicKeyPem !== 'string' || !publicKeyPem.includes('BEGIN PUBLIC KEY')) {
    throw new LicenseGateError(LICENSE_CODES.CONFIG_MISSING, 'public_key_pem_missing');
  }

  // Sign over the payload object as carried in the envelope (not re-normalized keys),
  // so issuers control exact field names. Re-verify later uses the same object.
  const ok = await verifyEd25519Signature({
    payload: envelope.payload,
    signature: envelope.signature,
    publicKeyPem,
  });
  if (!ok) {
    throw new LicenseGateError(LICENSE_CODES.NOT_ACTIVATED, 'signature_invalid');
  }

  const fields = normalizeSignedPayloadFields(envelope.payload);
  return {
    ...fields,
    signature: envelope.signature,
    signedPayload: envelope.payload,
    signed: true,
  };
}

/**
 * Re-verify a stored entitlement that carries signature + signedPayload.
 */
export async function reverifyStoredSignedEntitlement(entitlement, publicKeyPem) {
  if (!entitlement || typeof entitlement !== 'object') {
    throw new LicenseGateError(LICENSE_CODES.NOT_ACTIVATED, 'entitlement_missing');
  }
  if (!entitlement.signature) {
    throw new LicenseGateError(LICENSE_CODES.NOT_ACTIVATED, 'signature_missing');
  }
  if (typeof publicKeyPem !== 'string' || !publicKeyPem.includes('BEGIN PUBLIC KEY')) {
    throw new LicenseGateError(LICENSE_CODES.CONFIG_MISSING, 'public_key_pem_missing');
  }
  const payload = entitlement.signedPayload;
  if (!payload || typeof payload !== 'object') {
    throw new LicenseGateError(LICENSE_CODES.NOT_ACTIVATED, 'signed_payload_missing');
  }
  const ok = await verifyEd25519Signature({
    payload,
    signature: entitlement.signature,
    publicKeyPem,
  });
  if (!ok) {
    throw new LicenseGateError(LICENSE_CODES.NOT_ACTIVATED, 'signature_invalid');
  }
  return true;
}
