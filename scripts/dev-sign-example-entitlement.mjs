#!/usr/bin/env node
/**
 * DEV / TESTS ONLY — generate EXAMPLE Ed25519 keypair and/or sign a sample entitlement.
 *
 * Never use these keys for customer licenses. Never embed the private key in a paid package.
 *
 * Usage:
 *   node scripts/dev-sign-example-entitlement.mjs
 *   node scripts/dev-sign-example-entitlement.mjs --write-fixtures
 *   node scripts/dev-sign-example-entitlement.mjs --payload '{"status":"active","installId":"...","licenseId":"x","expiresAtMs":4102444800000,"profileHash":null}'
 *
 * Output goes to stdout and optionally tests/fixtures/license/ (EXAMPLE_* files).
 */

import { generateKeyPairSync, sign, createPrivateKey, createPublicKey } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJson } from '../src/license/signed-entitlement.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const fixtureDir = resolve(repoRoot, 'tests/fixtures/license');

const args = process.argv.slice(2);
const writeFixtures = args.includes('--write-fixtures');
const payloadIdx = args.indexOf('--payload');
const privateKeyPathIdx = args.indexOf('--private-key');

function loadOrMakeKeys() {
  const privPath = privateKeyPathIdx >= 0
    ? resolve(args[privateKeyPathIdx + 1])
    : resolve(fixtureDir, 'EXAMPLE_ed25519_private.pem');

  if (existsSync(privPath) && !args.includes('--rotate')) {
    const privateKeyPem = readFileSync(privPath, 'utf8');
    const privateKey = createPrivateKey(privateKeyPem);
    const publicKeyPem = createPublicKey(privateKey).export({ type: 'spki', format: 'pem' });
    return { privateKey, privateKeyPem, publicKeyPem };
  }

  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKey,
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
  };
}

const defaultPayload = {
  status: 'active',
  installId: '11111111-2222-4333-a444-555555555555',
  profileHash: null,
  licenseId: 'lic-example-test',
  expiresAtMs: 4102444800000,
};

let payload = defaultPayload;
if (payloadIdx >= 0) {
  payload = JSON.parse(args[payloadIdx + 1]);
}

const { privateKey, privateKeyPem, publicKeyPem } = loadOrMakeKeys();
const bytes = Buffer.from(canonicalJson(payload), 'utf8');
const signature = sign(null, bytes, privateKey).toString('base64');
const token = {
  v: 1,
  alg: 'Ed25519',
  payload,
  signature,
};

console.log('=== EXAMPLE ONLY — not for production ===');
console.log('publicKeyPem:\n' + publicKeyPem);
console.log('signed token JSON:\n' + JSON.stringify(token, null, 2));

if (writeFixtures) {
  mkdirSync(fixtureDir, { recursive: true });
  writeFileSync(resolve(fixtureDir, 'EXAMPLE_ed25519_private.pem'), privateKeyPem);
  writeFileSync(resolve(fixtureDir, 'EXAMPLE_ed25519_public.pem'), publicKeyPem);
  writeFileSync(
    resolve(fixtureDir, 'EXAMPLE_signed_entitlement.json'),
    JSON.stringify(token, null, 2) + '\n',
  );
  const expiredPayload = {
    ...payload,
    licenseId: 'lic-example-expired',
    expiresAtMs: 1000000000000,
  };
  const expiredSig = sign(null, Buffer.from(canonicalJson(expiredPayload), 'utf8'), privateKey).toString('base64');
  writeFileSync(
    resolve(fixtureDir, 'EXAMPLE_signed_entitlement_expired.json'),
    JSON.stringify({ v: 1, alg: 'Ed25519', payload: expiredPayload, signature: expiredSig }, null, 2) + '\n',
  );
  writeFileSync(
    resolve(fixtureDir, 'README.md'),
    `# EXAMPLE license crypto fixtures

**NOT production secrets.** These Ed25519 keys exist only so unit tests can
verify signed entitlement tokens offline. Never issue customer licenses with
these keys. Never embed the private key in a paid Edge package.

| File | Role |
| --- | --- |
| EXAMPLE_ed25519_public.pem | Test public key (docs / optional paid-build embed example) |
| EXAMPLE_ed25519_private.pem | Test private key — tests / this script only |
| EXAMPLE_signed_entitlement.json | Sample signed token (active, far-future expiry) |
| EXAMPLE_signed_entitlement_expired.json | Sample signed token already expired |

Regenerate: \`node scripts/dev-sign-example-entitlement.mjs --write-fixtures\`
`,
  );
  console.log('Wrote EXAMPLE fixtures under tests/fixtures/license/');
}
