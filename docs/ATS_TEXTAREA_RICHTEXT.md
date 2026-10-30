# L1 multiline text and richtext

The generic L1 route supports native textarea, the existing version-confirmed
Element UI 2 / Ant Design Vue 1 textarea adapters, and explicit native
`contenteditable` editing hosts. `liveSupportClaimed=false`; evidence is offline
only. Ordinary engine writes still require `resumeAtsEngineWriteEnabled=true`,
confirmed profile facts and the existing profile lifecycle lock.

Prose comparisons normalise CRLF / CR to LF only. Leading/trailing spaces,
tabs, blank lines and Unicode remain significant in both the component model
and DOM. Plans preserve nonempty data in either channel, enforce textarea
maxlength, bind to the original root/owner, and recheck guards before effects.
Readback detects mismatch and later reversion, including the final batch receipt.

Richtext writes insert plain text nodes separated by BR nodes, without HTML
parsing, editor APIs, toolbar clicks, save or submit. Readback uses a logical
plain-text projection: BR is LF; adjacent block boundaries contribute one LF;
an otherwise empty host/block containing one BR is an empty placeholder.
Comments and empty inline nodes do not add lines. Matching existing formatting
is preserved. This projection does not reproduce CSS paragraph margins.

Nested editors, noneditable islands, form/media descendants, hidden content,
unsupported layout overrides, frames/captcha and unknown framework models stay
manual. CSS classes alone do not establish a compatible framework version.
Richtext never falls back to the legacy native setter.

Run from the repository root on Windows:

```powershell
npm.cmd ci --ignore-scripts --no-audit --no-fund
node --test "tests/l1-*.test.mjs" tests/product-paths-whitelist.test.mjs tests/guard-worker-auto-runners.test.mjs tests/never-save-guard.test.mjs tests/cms-row-d-network-guard.test.mjs tests/pack-side-effect-import.test.mjs tests/build-paid-rebuild.test.mjs tests/build-offline-package.test.mjs tests/cms-basic-info-gaps.test.mjs tests/cms-row-d-preexisting-trial.test.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-internal.ps1
npm.cmd run test:zoo
git diff --check
```

The zoo uses disposable offline controls, real Vue textarea components and a
locally built extension. Network routing supplies fixture GETs and aborts other
requests. No production form or live support claim is involved. Product paths
and build allowlists are unchanged.
