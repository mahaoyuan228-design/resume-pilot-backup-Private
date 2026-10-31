// Source-tree placeholder so guard-worker.mjs can static-import this module.
// Edge 155 MV3 service workers do not register when this file is loaded with
// a top-level await import(). scripts/build-paid.ps1 writes the real
// paid-config.mjs into the paid package (buildFlavor 'paid' + operator HTTPS
// URL) and does not copy this placeholder. Not a license server. Not flavor
// paid, so source-tree verifies stay denied.

export const paidConfig = {
  buildFlavor: 'internal',
  licenseServiceUrl: null,
  publicKeyPem: null,
  requireSignedEntitlement: false,
};
