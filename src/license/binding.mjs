// Machine / install binding sketch. No hardware fingerprinting or OS secrets.
// Later plug: server seats bind to installId (+ optional profileHash).
// Browser-safe: uses Web Crypto only (works in MV3 worker and Node tests).

export const INSTALL_ID_KEY = 'resumeLicenseInstallId';
export const ENTITLEMENT_KEY = 'resumeLicenseEntitlement';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function isInstallId(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Stable SHA-256 hex of a canonical string (profile snapshot, etc.). */
export async function hashCanonical(text, cryptoImpl = globalThis.crypto) {
  if (!cryptoImpl?.subtle?.digest) throw new Error('crypto_digest_unavailable');
  const bytes = new TextEncoder().encode(String(text ?? ''));
  const digest = await cryptoImpl.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Ensure a durable install id exists in chrome.storage.local-like storage.
 * @param {{ get: Function, set: Function }} storage
 * @param {{ randomId?: () => string }} [options]
 */
export async function ensureInstallId(storage, { randomId } = {}) {
  const bag = await storage.get(INSTALL_ID_KEY);
  const existing = bag?.[INSTALL_ID_KEY];
  if (isInstallId(existing)) return existing;
  const make = randomId || (() => globalThis.crypto.randomUUID());
  const id = make();
  if (!isInstallId(id)) throw new Error('install_id_invalid');
  await storage.set({ [INSTALL_ID_KEY]: id });
  return id;
}

/**
 * Local binding token for anti-resale sketches (not a cryptographic device seal).
 * @param {{ installId: string, profileHash?: string|null, licenseId?: string|null }} parts
 */
export async function localBindingDigest(parts, cryptoImpl = globalThis.crypto) {
  const installId = parts?.installId || '';
  const profileHash = parts?.profileHash || '';
  const licenseId = parts?.licenseId || '';
  if (!isInstallId(installId)) return null;
  return hashCanonical(`v1|${installId}|${profileHash}|${licenseId}`, cryptoImpl);
}

/**
 * Compare stored entitlement binding to current install (+ optional profile).
 * Fail-closed: missing fields → mismatch.
 */
export function bindingMatches(entitlement, { installId, profileHash = null } = {}) {
  if (!entitlement || typeof entitlement !== 'object') return false;
  if (!isInstallId(installId) || entitlement.installId !== installId) return false;
  if (entitlement.profileHash != null && entitlement.profileHash !== ''
    && entitlement.profileHash !== profileHash) return false;
  return true;
}
