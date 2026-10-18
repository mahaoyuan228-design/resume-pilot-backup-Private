# Anti-resale sketch (简历快填 commercial path)

Date: 2026-10-17 (Asia/Shanghai)  
Scope: design + local scaffolding only. **No live payment server. No claim of unbreakable DRM.**

## Binding ideas (will use)

| Signal | Purpose | Status |
| --- | --- | --- |
| **installId** | UUID created once in `chrome.storage.local` (`resumeLicenseInstallId`) | Scaffolded in `src/license/binding.mjs` |
| **profileHash** | Optional seat tie to the operator’s verified profile snapshot (reuse lifecycle hash) | Sketch; optional field on entitlement |
| **expiry (`expiresAtMs`)** | Time-bounded entitlement; local gate denies when past | Scaffolded in `gate.mjs` |
| **status** | `active` / `revoked` / `device_revoked` / `expired` | Scaffolded; maps to Chinese popup codes |
| **BINDING_MISMATCH** | installId or optional profileHash seat mismatch | Distinct from DEVICE_REVOKED; Chinese「授权与本机不匹配」 |
| **HTTPS license service** | Operator-owned domain; paid build embeds URL via `paid-config.mjs` | Build flag only; no production deploy in tree |
| **Signed entitlement (Ed25519)** | Verify with `publicKeyPem` in paid-config; envelope `{v,alg,payload,signature}` | Scaffolded offline + EXAMPLE fixtures; no production private key in tree |

Content/background **hooks already exist**: when `service_worker === 'src/license/guard-worker.mjs'`, write paths require `RESUME_PAID_VERIFY` / `verifyBeforeFill`. Internal builds keep `worker.mjs` → hooks inert.

## Flavor separation

- **Internal** (`scripts/build-internal.ps1`): 96-file package, `worker.mjs`, gate OFF. Jeremy’s 003753 / 011002 workflow unchanged.
- **Paid** (`scripts/build-paid.ps1 -LicenseServiceUrl https://…`): separate `dist/edge-paid-v…` tree, `guard-worker.mjs`, Chinese `activate.html` panel, fail-closed without activation.

## What we will NOT do yet

- Invent or commit payment-provider / merchant credentials.
- Claim a live public license or payment server exists for this product.
- Ship kernel drivers, browser-breaking DRM, or hardware ID scrapers.
- Point Jeremy’s loaded internal Edge unpacked folder at `guard-worker.mjs`.
- Commit or ship Ed25519 **private** keys (EXAMPLE test keys under `tests/fixtures/license/` only).
- Treat copyable internal ZIP as anti-resale proof.
- Wire online license checks into CMS/GTH live fills before paid-build smoke + CMS education closed-loop evidence.
- Add license modules to the internal WHITELIST / `build-internal.ps1` allowlist.

## Minimal ops path (later, needs Jeremy for domain/payment only)

1. Stand up owned HTTPS service implementing a narrow `/v1/verify` (and later activate/revoke).
2. Run `build-paid.ps1` with that URL; smoke deny cases (no license / expired / unreachable).
3. Issue entitlements bound to `installId` (+ seat policy).
4. Distribute **paid** ZIP only — never hand customers the internal trial tree as “授权版”.

## Offline edge cases (2026-10-17 evening)

Fail-closed unit coverage added (no production domain):

| Edge | Expected |
| --- | --- |
| Empty / non-UUID `installId` | `NOT_ACTIVATED` / `install_id_missing` |
| Blank / missing / unknown `status` (e.g. `pending_payment`, null) | `NOT_ACTIVATED` / `status_empty` |
| Non-finite / non-number `expiresAtMs` (NaN, Infinity, string) | `LICENSE_EXPIRED` / `expiry_invalid` |
| Non-object entitlement (string) / array without status | `NOT_ACTIVATED` |
| `requireSignedEntitlement` without PEM / without signature | `CONFIG_MISSING` / `signature_missing` |
| HTTP (non-HTTPS) license URL in paid-config | `CONFIG_MISSING` |

Still **not** DRM. Still **no** invented production HTTPS / payment credentials.
