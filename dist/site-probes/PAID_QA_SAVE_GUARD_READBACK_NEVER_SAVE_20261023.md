# Paid QA guard readback · 2026-10-23

Base: `2ffb6f6b3e55fbe3864a3d5fd8f32d3f6a17f62b`. Offline tooling evidence; `liveSupportClaimed=false`.

Existing evidence: `PAID_EDGE_9239_QA_CHECKLIST_20261019.md` requires readback OK and Never Save OK; `PAID_EDGE_9239_QA_MATRIX_AB_20261019.md` says missing evidence is pending, not pass.

Gap: `readClicks()` converted any CDP evaluation error into `[]`; `READ_SAVE_CLICKS` also returned `[]` for missing history. A verified posted basic report could therefore pass without final Never-Save readback.

Reproduction uses the existing `tests/paid-qa-runner.test.mjs` fake driver and verified basic report; no employer DOM was added. Injecting final `Execution context was destroyed.` produced exit 0 / status pass on the base.

Before: `node --test --test-name-pattern='save guard|Save breach' tests/paid-qa-runner.test.mjs` — 0 pass, 5 fail, exit 1. Log: `%TEMP%\paid-qa-guard-before-20261023.log`.

After: the same focused command — 5 pass, 0 fail; `npm run test:paid-qa` — 33 pass, 0 fail.

Fix: require installed guard plus array history, reject unreadable/malformed final evidence, and retain `saveGuardError`, original report/events, and screenshot result. Initial failure prevents auto launch; posted Save remains the primary breach reason; timeout reasons remain visible.

Missing evidence: no live CDP, logged-in site, live save click, or live site-support result was collected. No runtime site selector or field behavior changed.
