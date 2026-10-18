#!/usr/bin/env node
/**
 * Production-oriented entitlement issuer (offline Ed25519).
 *
 * Private key MUST live OUTSIDE the repo (e.g. %USERPROFILE%\secrets\resume-paid-ed25519).
 * Never commit private keys. Never echo private key material.
 *
 * Windows (PowerShell), from repo root:
 *   node scripts/issue-entitlement.mjs `
 *     --private-key "$env:USERPROFILE\secrets\resume-paid-ed25519\resume-paid-private.pem" `
 *     --install-id "<customer-uuid>" `
 *     --days 365 `
 *     --license-id "lic-20261018-001"
 *
 * Optional:
 *   --expires-at-ms <epochMs>   (overrides --days)
 *   --profile-hash <hex|null>   (default null)
 *   --status active             (default active)
 *   --json-only                 (print only JSON, no headers)
 *   --base64-only               (print only Base64 of JSON)
 *
 * Output: signed JSON + Base64 for customer paste into activate UI.
 */
import { sign, createPrivateKey, createPublicKey, createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { canonicalJson } from '../src/license/signed-entitlement.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

function usage(code = 1) {
  const msg = `Usage:
  node scripts/issue-entitlement.mjs --private-key <path-OUTSIDE-repo> --install-id <uuid> --days <n> --license-id <id>
  node scripts/issue-entitlement.mjs --private-key <path> --install-id <uuid> --expires-at-ms <ms> --license-id <id>

Never pass EXAMPLE fixtures for customer tokens.
Never place private keys under the repo or Desktop public folders.`;
  console.error(msg);
  process.exit(code);
}

function getArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx < 0) return null;
  const v = process.argv[idx + 1];
  if (!v || v.startsWith('--')) return null;
  return v;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

if (hasFlag('--help') || hasFlag('-h')) usage(0);

const privateKeyPathRaw = getArg('--private-key');
const installId = getArg('--install-id');
const licenseId = getArg('--license-id');
const daysRaw = getArg('--days');
const expiresAtMsRaw = getArg('--expires-at-ms');
const status = getArg('--status') || 'active';
const profileHashRaw = getArg('--profile-hash');
const jsonOnly = hasFlag('--json-only');
const base64Only = hasFlag('--base64-only');

if (!privateKeyPathRaw || !installId || !licenseId) {
  console.error('Missing required: --private-key, --install-id, --license-id');
  usage(1);
}

const privateKeyPath = resolve(privateKeyPathRaw);
const normalizedKey = privateKeyPath.replace(/\\/g, '/').toLowerCase();
const normalizedRepo = repoRoot.replace(/\\/g, '/').toLowerCase();

if (normalizedKey.startsWith(normalizedRepo + '/') || normalizedKey === normalizedRepo) {
  console.error('REFUSED: private key path is inside the repository. Keep keys under %USERPROFILE%\\secrets\\…');
  process.exit(2);
}

if (/example/i.test(privateKeyPath) || /fixtures[\\/]+license/i.test(privateKeyPath)) {
  console.error('REFUSED: looks like EXAMPLE/fixtures key. Do not issue customer tokens with test keys.');
  process.exit(2);
}

if (!existsSync(privateKeyPath)) {
  console.error('Private key file not found:', privateKeyPath);
  process.exit(3);
}

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
if (!uuidRe.test(installId)) {
  console.error('installId must be a UUID (customer activate UI shows this). Got:', installId);
  process.exit(4);
}

let expiresAtMs;
if (expiresAtMsRaw != null) {
  expiresAtMs = Number(expiresAtMsRaw);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= 0) {
    console.error('--expires-at-ms must be a positive finite number');
    process.exit(4);
  }
} else if (daysRaw != null) {
  const days = Number(daysRaw);
  if (!Number.isFinite(days) || days <= 0 || days > 3650) {
    console.error('--days must be 1..3650');
    process.exit(4);
  }
  expiresAtMs = Date.now() + Math.round(days * 86400000);
} else {
  console.error('Provide --days or --expires-at-ms');
  usage(1);
}

let profileHash = null;
if (profileHashRaw != null && profileHashRaw !== 'null' && profileHashRaw !== '') {
  profileHash = profileHashRaw;
}

const privateKeyPem = readFileSync(privateKeyPath, 'utf8');
if (!privateKeyPem.includes('PRIVATE KEY')) {
  console.error('File does not look like a private key PEM');
  process.exit(3);
}
if (privateKeyPem.includes('BEGIN PUBLIC KEY') && !privateKeyPem.includes('PRIVATE KEY')) {
  console.error('Looks like a public key. Need private key for signing.');
  process.exit(3);
}

const privateKey = createPrivateKey(privateKeyPem);
const publicKeyPem = createPublicKey(privateKey).export({ type: 'spki', format: 'pem' });

const payload = {
  status,
  installId,
  profileHash,
  licenseId,
  expiresAtMs,
};

const bytes = Buffer.from(canonicalJson(payload), 'utf8');
const signature = sign(null, bytes, privateKey).toString('base64');
const token = {
  v: 1,
  alg: 'Ed25519',
  payload,
  signature,
};

const json = JSON.stringify(token);
const b64 = Buffer.from(json, 'utf8').toString('base64');

if (base64Only) {
  process.stdout.write(b64 + '\n');
  process.exit(0);
}
if (jsonOnly) {
  process.stdout.write(JSON.stringify(token, null, 2) + '\n');
  process.exit(0);
}

// Safe summary only — never print private key
const pubFingerprint = createHash('sha256')
  .update(createPublicKey(privateKey).export({ type: 'spki', format: 'der' }))
  .digest('hex')
  .slice(0, 16);

console.log('=== entitlement issued (give customer JSON or Base64) ===');
console.log('licenseId:', licenseId);
console.log('installId:', installId);
console.log('status:', status);
console.log('expiresAtMs:', expiresAtMs);
console.log('expiresAt (ISO):', new Date(expiresAtMs).toISOString());
console.log('publicKeySpkiSha256_16:', pubFingerprint + '…');
console.log('');
console.log('--- JSON (paste into activate UI) ---');
console.log(JSON.stringify(token, null, 2));
console.log('');
console.log('--- Base64 (same token, one line) ---');
console.log(b64);
console.log('');
console.log('NOTE: private key path used (not printed):', privateKeyPath);
console.log('Public key PEM path for build-paid: sibling resume-paid-public.pem');
