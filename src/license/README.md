# src/license — commercial gate scaffolding (not in internal package)

**Internal daily use:** `manifest.json` → `src/background/worker.mjs`. Hooks that look for `src/license/guard-worker.mjs` stay inert. Do **not** point the loaded 003753 / 011002 Edge unpacked tree at this folder.

**Paid flavor (separate package):** `scripts/build-paid.ps1 -LicenseServiceUrl 'https://…'` copies product files, generates `paid-config.mjs`, sets the service worker to `guard-worker.mjs`, and includes the Chinese activate panel. Optional `-PublicKeyPemPath` embeds an Ed25519 public key; `-RequireSignedEntitlement` fail-closes unsigned tokens.

**Offline distribution:** `scripts/build-paid.ps1 -Offline -PublicKeyPemPath <public.pem>` requires signed activation tokens and generates `verificationMode: 'offline'` with no license-service URL. Activation, status, and each fill recheck signatures, signed fields, binding, and expiry locally. Trial packaging and manual installation/update steps: [offline distribution](../../docs/OFFLINE_DISTRIBUTION.md). `publicWebsite: null` reserves a public-site integration stub only.

| File | Role |
| --- | --- |
| `flavor.mjs` | `internal` vs `paid` |
| `errors.mjs` | Stable codes matching Chinese popup copy |
| `binding.mjs` | installId + optional profileHash sketch |
| `gate.mjs` | Pure local fail-closed evaluator |
| `client.mjs` | Local verify + optional HTTPS `/v1/verify` stub |
| `entitlement.mjs` | `isFillAllowed` / `isFillAllowedAsync` + local token activate / status helpers |
| `signed-entitlement.mjs` | Ed25519 verify of signed entitlement envelopes (fail-closed without publicKeyPem) |
| `guard-worker.mjs` | Paid SW: `RESUME_PAID_VERIFY` + the same runners as `worker.mjs`, including `*_AUTO`, each with `verifyBeforeFill` |
| `activate.html` / `.css` / `.js` | Paid-only Chinese activate panel (paste token locally) |
| `paid-config.mjs` | Source placeholder, not flavor `paid`. `build-paid.ps1` writes the real file into the paid package. Static import (Edge 155 rejects top-level `await import()`). |
| `paid-config.example.mjs` | Example only — never commit live secrets |

No payment provider credentials. No claim of a live license server in this tree.

Signed token shape (v1): `{ v:1, alg:"Ed25519", payload:{ status, installId, profileHash, licenseId, expiresAtMs }, signature:<base64> }`. Dev helper: `node scripts/dev-sign-example-entitlement.mjs` (EXAMPLE keys under `tests/fixtures/license/` only).

Per-seat code: `node scripts/issue-entitlement.mjs --private-key <outside-repo.pem> --install-id <uuid> --license-id <unique-seat-number> --days 365 --code-only` emits `RQF1.<base64url-UTF8-envelope>`. The existing activate panel accepts this code and verifies it locally before storing the same entitlement. Codes require a seat number, device binding and expiry; legacy JSON/Base64 tokens remain compatible. Issuing and installation steps: [offline distribution](../../docs/OFFLINE_DISTRIBUTION.md). No domain, payment gateway or online redemption ledger; `liveSupportClaimed=false`, Never-Save.

## DEV-ONLY mock verify (local smoke)

`scripts/dev-mock-license-server.mjs` implements a minimal HTTPS `POST /v1/verify` for `client.mjs` smoke. Marked DEV-ONLY; **not** packaged by `build-internal.ps1` / `build-paid.ps1`. See root `LICENSE_STATUS.md` for run steps. No production claims.
