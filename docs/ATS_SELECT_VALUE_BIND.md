# Generic select value binding and readback

Base: `3e99628787c35cb28b9a264e661280b93238e719`, targeting
`cursor/expand-night-ats-f861`. `liveSupportClaimed=false`; Never-Save.

L1 dropdown plans now retain a private MAIN-world binding to their original
control root. Write entry, every guarded effect, and both verification samples
check that binding. Identical option codes or display labels on a sibling are
insufficient. Serialized shadow observations must be replanned against the
target in MAIN before execution; the ordinary write bridge already does this.

Vue Select ownership requires its library widget root and its own text/search
inputs. A shared row containing a native select, telephone/date editor, or nested
widget cannot supply a sibling's model. Real Element search/display inputs and
two-editor date ranges retain their existing ownership contracts.

The ordinary engine respects explicit label associations. Unassociated row and
wrapping labels require one owning control (or one radio group), so a phone or
birthday question cannot migrate onto an adjacent select. Dash-only year prompts
such as `----` read empty only with a sentinel code and an agreeing numeric year
option family; mixed choices, real codes and mismatched labels are preserved.
A full birthday fact is never split into year/month/day answers.

Changed runtime files: `src/content/controls/{model,native,registry}.js` and
`src/content/engine.js`. Model/registry/engine revisions are 5/8/16. Tests cover
cross-target plans, ownership changes during writes/readback, shared labels,
phone prefixes, year prompts and legitimate multi-input components. Existing
reinjection expectations and zoo writers follow the revised contracts. No ATS
site selectors, profile facts or whitelist entries changed.

Changed tests: `tests/l1-{extended-controls,select-readback,select-value-bind,
upload-controls,write-route}.test.mjs`, `tests/cms-basic-info-gaps.test.mjs`,
`tests/cms-row-d-preexisting-trial.test.mjs`, and
`tests/zoo/{extended,l1,write-route}.spec.mjs`.

Local reproduction (Node 24, PowerShell, repository root):

```powershell
npm ci --ignore-scripts
$l1 = @(Get-ChildItem tests -File -Filter 'l1-*.test.mjs' | Sort-Object Name | ForEach-Object FullName)
$l1 += (Join-Path (Get-Location) 'tests/product-paths-whitelist.test.mjs')
node --test @l1
node --test tests/engine-manual-controls.test.mjs tests/l3-ats-profiles.test.mjs tests/cms-basic-info-gaps.test.mjs tests/cms-row-d-preexisting-trial.test.mjs tests/never-save-guard.test.mjs tests/guard-worker-auto-runners.test.mjs
npx playwright install chromium
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-internal.ps1
npm run test:zoo
```

The zoo uses disposable browsers, packaged extension bytes and local fixture
responses. Its routing blocks non-GET traffic. No live-site verification,
business save/submit, or claim of live support is included.

Verified locally: 147 L1/whitelist tests, 211 engine/profile/guard tests and all
73 zoo tests passed. Build-internal packaged 148 files; ZIP SHA256:
`c7cca68718bbcfa1034b29945aa654faa6c23149dab0f5d23603382b1975fb8a`.
