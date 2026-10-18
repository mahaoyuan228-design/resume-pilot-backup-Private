# LICENSE / anti-resale inventory (narrow commercial ship)

Date: 2026-10-17 (Asia/Shanghai)  
Current ship tree: internal **0.1.4.9** under `/workspace/resume-autofill/` (WHITELIST productPaths / build-internal: 81 files).  
Paid gate for Jeremy’s loaded internal Edge (**003753** / **011002**): **OFF** (`manifest` → `src/background/worker.mjs`).

## What exists in / near this product

| Piece | Location | In current internal package? | Notes |
| --- | --- | --- | --- |
| Write-path license **hooks** | Content/background check `manifest.background.service_worker === 'src/license/guard-worker.mjs'` then `RESUME_PAID_VERIFY` | Hooks **yes**; worker **no** | Inert on ordinary internal worker — fill proceeds without online verify |
| CMS session / education / school / region / select / dates / GTH draft | Same pattern | Hook only | Fail reason `license_required` when paid worker present |
| Popup Chinese `license_required` | `cms-education-actions.js`, `popup.js`, GTH errors | Yes | UX ready (`尚未激活授权` 等) |
| Vendor OSS licenses | `src/import/vendor/{JSZIP,PAKO,PDFJS}-LICENSE.*` | Yes | Third-party, not product license |
| **License scaffolding** | `src/license/{flavor,errors,binding,gate,client,guard-worker,signed-entitlement}.mjs` + `paid-config.example.mjs` | **No** (excluded from `build-internal.ps1`) | Local fail-closed gate; Ed25519 verify; plugs HTTPS later |
| **Entitlement helpers + activate UI** | `src/license/entitlement.mjs` + `activate.{html,css,js}` | **No** | Chinese activate panel; `isFillAllowed` / async signed path; local token paste |
| **Ed25519 signed tokens (this pass)** | `signed-entitlement.mjs` + `tests/fixtures/license/EXAMPLE_*` + `scripts/dev-sign-example-entitlement.mjs` | **No** | Offline verify; EXAMPLE keys for tests/docs only; no payment domain |
| **Paid build script** | `scripts/build-paid.ps1` | N/A (separate `dist/edge-paid-v…`) | `-LicenseServiceUrl`; optional `-PublicKeyPemPath` / `-RequireSignedEntitlement`; activate UI; popup「授权激活」on **paid copy only** |
| **Fail-closed tests** | `license-gate-fail-closed`, `license-entitlement-helpers`, `license-signed-entitlement` | Test only | Node `--test`; valid/tamper/expired/internal bypass |
| **Anti-resale design** | `ANTI_RESALE.md` | Doc | Binding ideas + explicit non-goals |
| **DEV mock `/v1/verify`** | `scripts/dev-mock-license-server.mjs` + `tests/license-mock-server-smoke.test.mjs` | **No** | Local HTTPS/HTTP smoke only; never package |
| Historical paid candidate docs | Incoming `01_structure.md` (`server/license/`, Ed25519) | **No** in this tree | Candidate elsewhere; no production deploy here |
| Isolation paid deny evidence (historical) | Handoff notes: paid-test78 MV3 deny | Evidence referenced; artifacts not in this box tree | Not a live commercial service |

## Implemented this pass (2026-10-17 — activate UI + entitlement helpers)

1. `src/license/entitlement.mjs`: `isFillAllowed` (non-throwing, fail-closed), `readLicenseStatus`, `parseActivationToken` / `activateLocalToken` / `clearLocalEntitlement`, Chinese `licenseCodeToZh`.
2. Paid-only activate panel: `activate.html` + `activate.css` + `activate.js` (status, paste token, clear errors). Guarded by `paid-config` flavor; absent config → 「本页不可用」.
3. `guard-worker.mjs`: `RESUME_PAID_VERIFY` uses `isFillAllowed`; `RESUME_OPEN_LICENSE_ACTIVATE` opens activate page.
4. `scripts/build-paid.ps1`: packages entitlement + activate UI; injects「授权激活」link into **copied** popup only. `build-internal.ps1` still excludes all of `src/license/`.
5. Tests: `tests/license-entitlement-helpers.test.mjs` (internal bypass, deny paths, token activate, packaging asserts).
6. **Not** done (activate pass): real payment, production license host, signed ZIP channel.

## Implemented this pass (2026-10-17 — Ed25519 signed entitlement scaffolding)

1. `src/license/signed-entitlement.mjs`: canonical JSON, Ed25519 verify (Node crypto + Web Crypto), `verifySignedEntitlement`, `reverifyStoredSignedEntitlement`.
2. `entitlement.mjs`: signed envelope parse/activate; `isFillAllowedAsync` re-verifies signatures; fail-closed if key missing when signature required.
3. `gate.mjs` / `client.mjs` / `guard-worker.mjs`: `requireSignedEntitlement` sync checks + async re-verify on paid verify path.
4. EXAMPLE fixtures under `tests/fixtures/license/` + `scripts/dev-sign-example-entitlement.mjs` (tests/docs only — not production secrets).
5. `build-paid.ps1`: optional `-PublicKeyPemPath`, `-RequireSignedEntitlement`; packages `signed-entitlement.mjs`.
6. Tests: `tests/license-signed-entitlement.test.mjs` (valid accept; tampered reject; expired reject; internal bypass unchanged).
7. **Not** done: real payment, production license host, production key ceremony, invented payment domain.


## What is still missing for commercial anti-resale

| Gap | Severity | Comment |
| --- | --- | --- |
| Seller-owned public HTTPS license service | High | Scaffold client only; no production deploy in tree |
| Real order / payment / entitlement issuance | High | Not present — do not invent provider credentials |
| Device seat binding + revoke in production data dir | Medium | Local installId sketch; server seats later |
| Tamper-resistant distribution (signed paid ZIP, update channel) | Medium | Internal Edge unpacked remains copyable |
| Customer activation UX page | **Done offline** | Chinese activate panel in paid package only |
| Ed25519 signed entitlement verify | **Done offline** | EXAMPLE keys only; operator PEM via `-PublicKeyPemPath` |
| Legal ToS / refund / seat policy copy | Missing | Out of code scope |

## Concrete next build steps (no Jeremy for most)

1. Keep loading **internal** `edge-internal-…-003753` / `011002` with `worker.mjs` — do not point them at `guard-worker.mjs` or `activate.html`.
2. Run locally:  
   `node --test tests/license-gate-fail-closed.test.mjs tests/license-entitlement-helpers.test.mjs tests/license-signed-entitlement.test.mjs`
3. When an owned HTTPS URL exists:  
   `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-paid.ps1 -LicenseServiceUrl 'https://<owned-domain>'`  
   Smoke **paid** unpacked: open「授权激活」, paste local entitlement JSON/Base64; no license / expired / wrong device → Chinese deny; never claim anti-resale from internal ZIP.
4. When operator has a real Ed25519 keypair: `build-paid.ps1 -PublicKeyPemPath <public.pem> -RequireSignedEntitlement`; issue signed envelopes with the private key offline (never commit private key).
5. Do **not** enable online license against CMS/GTH **live** fills until CMS education closed-loop evidence + paid-build smoke.


## Implemented this pass (2026-10-17 — DEV-ONLY mock `/v1/verify` for paid local smoke)

**Not production.** Local smoke only; no payment domain claims.

1. `scripts/dev-mock-license-server.mjs` — HTTPS (default) or `--http` on `127.0.0.1`; `POST /v1/verify` compatible with `src/license/client.mjs`; modes `allow|deny|expired|revoked|device_revoked|mismatch|http_500|http_503`.
2. Self-signed DEV certs under `scripts/dev-mock-license-certs/` (checked-in localhost PEMs for boxes without openssl; regenerate anytime; never ship in Edge ZIPs).
3. Smoke tests: `tests/license-mock-server-smoke.test.mjs` (allow / deny / expired / SERVER_UNAVAILABLE + packaging assert mock not in Edge allowlists).
4. `build-internal.ps1` / `build-paid.ps1` / WHITELIST: **do not** package mock script or certs. (Also added missing `src/background/cms-page-focus.mjs` to product allowlists so rebuilds keep the shared focus gate.)

### How to run mock + build-paid against it (dev smoke)

```text
# Terminal A — DEV-ONLY HTTPS mock (self-signed)
node scripts/dev-mock-license-server.mjs --port 8787 --mode allow

# Terminal B — Node smoke (trusts DEV cert via rejectUnauthorized:false inside the test)
node --test tests/license-mock-server-smoke.test.mjs

# Optional: build a separate paid unpacked pointing at the mock URL (still NOT a live commercial service)
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-paid.ps1 -LicenseServiceUrl 'https://127.0.0.1:8787'
```

Edge/Chromium will warn on the self-signed cert; Node smoke does not need a browser. Switch mock `--mode deny` / `expired` / `http_503` to exercise fail-closed paths. **Never** load this mock URL in customer paid ZIPs or claim anti-resale from mock allow.

## Ask Jeremy?

**No** for this Ed25519 offline scaffolding pass. Ask only when choosing production license domain, payment provider, production signing keys, or first paid ZIP recipients.


## Paid offline package smoke 2026-10-17 evening (Asia/Shanghai)

| Check | Result |
| --- | --- |
| `build-paid.ps1 -LicenseServiceUrl https://127.0.0.1:8787 -PublicKeyPemPath EXAMPLE_ed25519_public.pem` | PASS → `dist/edge-paid-v0.1.4.9-20261017-115116` (PC) |
| `scripts/build-paid-smoke.mjs` (Node mirror) | PASS on box + PC |
| Package contains | `guard-worker.mjs`, `activate.{html,css,js}`, `paid-config.mjs`, popup「授权激活」 |
| Mock verify | `tests/license-mock-server-smoke.test.mjs` allow/deny/expired/503 **pass** |
| Not done | Production domain; loading paid package into daily Edge; real payment |

DEV mock URL only — **do not** ship mock URL to customers.

## Edge-case polish (2026-10-17 evening)

- Local gate: `status=expired` → `LICENSE_EXPIRED`; binding fail → `BINDING_MISMATCH` (Chinese distinct from revoke).
- Activate / popup Chinese: fail-closed reasons +「授权激活」指引；不再写误导性的「在线核验」作为默认拒绝文案。
- `toUiLicenseCode`: CONFIG_MISSING still collapses to NOT_ACTIVATED; BINDING_MISMATCH stays visible.

## Jeremy 必供清单（生产 15%，未做完）

**权威中文清单：** 根目录 `LICENSE_JEREMY_CHECKLIST.md`。

| 你必须提供 | 状态 |
| --- | --- |
| 生产 HTTPS 校验域名（完整 `https://…/v1/verify`） | **未提供** — 勿编造 |
| 支付 / 发码流程（商户密钥不入库） | **未提供** |
| Ed25519 生产公钥（私钥仅你离线保管） | **未提供** — EXAMPLE 钥 ≠ 生产 |

离线已就绪：activate UI、signed entitlement、DEV mock、`build-paid` 冒烟。  
**未勾选上表前不得宣称已上线收款或防转售完成。** Ask Jeremy？仅当你准备选定域名/支付/钥时用「我需要帮助」一项决策。
