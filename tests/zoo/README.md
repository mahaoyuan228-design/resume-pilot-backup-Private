# Offline page zoo

`npm ci`, then `npx playwright install chromium`, then `npm run test:zoo`.
The verifier starts a temporary loopback server and an isolated Playwright
Chromium instance. It never connects to the user's CDP session. Only GETs to
that server are permitted; production JavaScript, forms, and outbound connections
are disabled. Use `npm run test:zoo:offline` for real snapshots only.

| Site | Capture | Result |
| --- | --- | --- |
| [CMS hotjob-pb](real/cms-hotjob-pb/README.md) | Logged-in rendered page; read-only MAIN-world metadata | Local DOM/CSS replay; no live support claim |

The supplied `TEST_MATRIX_V2_2026-10-30.md` has 45 rows and exactly one
`runnable now=yes` row: logged-in CMS. **Zero public no-login pages are marked
runnable.** Public landing pages whose application forms require an account are
marked `no` in that matrix and have not been represented as runnable form
snapshots. The dated matrix is the scope for this capture, rather than a claim
about all public ATS pages.

The capture also follows `ATS_FIELDS_NOLOGIN_SAMPLE_2026-10-30.md`,
`REAL_USE_CMS_ROW_D_PROBE_f07879e1_2026-10-30.md`, and
`COMMERCIAL_SCORECARD_V2.md`. Their content hashes and the selected scope are in
[scope.json](scope.json); the original notes remain in `_temp-scripts`. They are
not copied here because the matrix includes a personal resume identifier.

For an explicitly authorized future CMS recapture only:
`node scripts/capture-zoo-cms.mjs --capture-readonly`. This attaches to the
existing CMS target on `127.0.0.1:9239`, preserves the existing non-GET guard,
adds its own request-stage non-GET guard, pins MAIN world, and uses
`throwOnSideEffect=true`. It never navigates, foregrounds, clicks, types, opens
panels, logs in, saves, or submits. Importing the module or running tests does
not capture a live page. Failed capture attempts do not replace saved fixtures.

The zoo is structural evidence only. Frozen markup and metadata do not prove
live autofill, autosave safety outside the observation window, calendar popup
behavior, or a commercial scorecard PASS. `liveSupportClaimed=false`.
