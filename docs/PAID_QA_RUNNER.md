# Paid Edge QA runner (Never Save)

From the repo root:

`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/win/run-paid-qa.ps1 -Port 9239 -ExtId decggijdlhflkjkgmofbclglilpaooij -Only "cms-basic,gth-basic" -TimeoutMs 180000`

Direct: `CDP_PORT=9239 ONLY=cms-basic,gth-basic AUTO_TIMEOUT_MS=180000 node scripts/run-paid-handoff-cdp.mjs`
Basic fill passes only with verified completion and an explicit `writeStarted`/`supportedComplete`/`operableComplete` contract. Legacy CMS `RESUME_FILL` replies lack this contract and fail closed; this is not a site-support claim.

Evidence dir `dist/auto-runs/paid-edge-<port>/<runId>/` holds `summary.json`, `<section>.json`, and `<section>.png` (site tab). Preflight failure exits 2 and writes `preflight-fail.json`. The printed `PAID_QA_SUMMARY=` line is the file to open. `PAID_QA_BG_PROBE=0` skips the background ping.

Reason codes:

- `CDP_UNREACHABLE` — debugging port did not answer.
- `EXT_NOT_LOADED` — no service worker. Load unpacked from the extension folder.
- `EXT_BLOCKED_BY_CLIENT` — `net::ERR_BLOCKED_BY_CLIENT`. Edge 155 ignores `--load-extension`; load unpacked manually.
- `SITE_TAB_MISSING` — `cms-*` needs a `wecruit.hotjob.cn` tab; `gth-*` needs `hr.gtht.com`. No wait.
- `BG_NO_RESPONSE` — 5s `PAID_QA_BG_PING` did not return, or the auto page was still on `正在请求后台 *_AUTO` with `lastReport` null at timeout.
- `AUTO_PAGE_NO_REPORT` — auto page opened (`open_reload` / `auto_begin`) but no `/result` before timeout.
- `SAVE_CLICK_FORBIDDEN` — a captured click or report claiming Save/submit/savedOnSite/submitted; evidence is retained. The runner never sends that click. `UNSETTLED_SUCCESS` means an unknown/pre-write job or an invalid basic completion contract.
