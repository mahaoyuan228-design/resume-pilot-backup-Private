// EXAMPLE ONLY — never ship secrets here.
// scripts/build-paid.ps1 generates paid-config.mjs at package time from -LicenseServiceUrl
// and optional -PublicKeyPemPath / -RequireSignedEntitlement.
// This file is not loaded by internal builds (manifest still points at worker.mjs).

export const paidConfig = {
  buildFlavor: 'paid',
  // Operator-owned HTTPS license service. No payment merchant keys belong here.
  licenseServiceUrl: 'https://license.example.invalid',
  // Optional Ed25519 SPKI public key (PEM) for verifying signed entitlements.
  // Use tests/fixtures/license/EXAMPLE_ed25519_public.pem for local docs/tests only.
  // NEVER put a private key here. Production keys are operator-owned, not invented in-tree.
  publicKeyPem: null,
  // When true, unsigned activation tokens fail closed (requires publicKeyPem).
  requireSignedEntitlement: false,
};
