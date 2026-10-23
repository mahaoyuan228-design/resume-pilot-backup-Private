# CMS education CONTROLS=1 daytime harness R3 diagnostics

Base: `4652b980965648d99580c7ce38906313ab6d2176` (merged #189).
Branch: `codex/cms-edu-controls1-daytime-harness-r3`.
Never-Save; `liveSupportClaimed=false`.

## Inventory and incremental gap

The requested upstream tip was fetched, the workdir reset, and HEAD verified
against the base above. R1 already collects same-session before/after captures,
actual prepare/run/cleanup replies, reviewed bytes, raw markup and supplemental
identity observations. R2 binds all seven checklist rows to 56 artifact-root
fields and rejects unsafe capture inputs. No missing leftover-to-field mapping
was found, and no new schema or validator matrix is needed.

The remaining offline gap is diagnosis of incomplete collection. Existing
fixtures demonstrate that missing raw captures or failed actual readbacks can
leave schema checks passing, `errors:[]`, and only aggregate collector flags
such as `actualTrialMatches:false` or `rawDomCaptured:false`. Those flags do
not locate the missing side, artifact or observation.

R3 adds `collector-status.json.diagnostics`, an array of fixed
`{key,file,path,reason}` entries. `key` is one of the existing seven checklist
keys; `path` starts at the named artifact's root. It records:

- Existing checklist bindings whose artifacts are missing/unreadable, paths
  are absent, or terminal values are null (`artifact_missing`,
  `artifact_unreadable`, `path_missing`, `value_null`). False, zero, empty
  strings and empty arrays remain present observations.
- Which existing actual prepare/run/readback/cleanup/traffic/click/timer
  predicate failed, using fixed mismatch codes and `observations.json` paths.
- Individual supplemental identity failures, present but invalid raw markup
  (`raw_dom_invalid`), changed raw section/neighbor markup, and the presence
  of collector protocol errors.

For example, a missing actual readback array points to
`observations.json:run.readbacks` with `path_missing` and
`readbacks_mismatch`. Missing after-capture markup points to
`snapshots-after.json:rawDom.educationOuterHTML`; an observed changed value
uses `raw_dom_mismatch` instead. Raw observations remain in their original
private artifacts. Diagnostic rows contain no applicant values, source JSON,
parser errors, protocol messages or machine paths.

Read `validation.json` for the unchanged six schema checks and report verdict,
then the existing collector gates and diagnostics for supplemental failures.
Diagnostics describe availability and existing collector predicates; they are
not an additional validator or authentication of retained observations.
An empty diagnostic array does not establish success, valid types, exercised
suppression, a visible opening, or a live support claim. Completion predicates,
schema version 1, reviewed-source pin, validator, capture helper, shipped
runner and PowerShell launcher remain unchanged.

## Leftovers and expected fields

All seven R8 obligations remain LIVE daytime work. The R2 bindings and detailed
predicates remain authoritative; R3 only adds failure locations beside them.

| Leftover | Existing expected fields / R3 diagnostic focus | Status |
| --- | --- | --- |
| Bytes; clean page | Reviewed `tipSha/files`; before `boundary` | Bound; approved deployment, native hooks, absent API, delivered body click and zero overlays still need actual observations. |
| Seven visible probes | Report and cleanup `widgetProbes/widgetClickCount` | Bound; all seven owned openings/closings and counted observed events still need LIVE evidence. Visible degree opening remains unproven. |
| Suppression; traffic; clicks | Report ledgers/counts; cleanup ledgers; `suppressionExercised`; actual cleanup traffic/click mismatch locations | Bound; actual ownership/timing, before-send abort, empty generic traffic and zero forbidden clicks remain LIVE. Empty suppression is not exercised suppression. |
| Nine readbacks | Before DOM/props; actual prepare/run; report fields/wait; `actualTrialMatches`; prepare/run/readback mismatch locations | Bound; actual originals and nine exact waited readbacks remain LIVE. |
| Restoration; neighbors | Both snapshots/raw DOM; restoration digests; raw capture/equality gates; missing-side and raw mismatch locations | Bound; complete actual raw-preserving snapshots and restoration remain LIVE. |
| Settled callbacks | Actual cleanup and report `timerSettle`; actual timer mismatch location | Bound; bounded settlement with zero pending/unobservable counts remains LIVE. |
| Cleanup | After boundary/identity; actual cleanup; collector gates/errors; individual identity mismatch locations | Bound; actual restoration remains LIVE. Full injected-global identity stays supplemental, outside schema version 1. |

Historical inputs read: supplied R8 last message, tip R7 and earlier harness
notes, CLEAN residual report, and overlay contrast/summary/compact captures.
CLEAN shows one school open/close followed by generic traffic failure and nine
propagated field failures. Contrast records no delivered click or visible
opening; compact later proves school opening only. None supplies a missing
observation for a new trial.

## Verification

The pinned baseline passed **286/286** CMS education tests, zero
failures/skips. The final changed-suite run below overlaps its 51 original
harness/capture cases: the unchanged 235 cases plus the final 56 cover all
**291 current tests**, without claiming a single 291-test invocation.

The final harness/capture run passed **56/56**, zero failures/skips (27 harness
tests and 29 capture cases, including nested cases). Five new harness tests
cover null/presence distinctions, identity failures, all grouped actual-reply
failures, unreadable retained JSON, and invalid raw markup. Existing fixtures
now also check missing artifacts/paths, failed/missing readbacks, raw changes,
successful empty ledgers, and teardown behavior. Four new diagnostic tests
were demonstrated red against the pinned R2 harness and green with R3; the
last invalid-raw-markup fixture also passes in the final focused run.

The offline PowerShell prepare command succeeded with `complete:false`,
`approved:false`, seven checklist rows and 56 unchanged bindings. Both changed
JavaScript files pass syntax checks; `git diff --check` passes. All collection
fixtures use fictional replies; no browser/CDP/login, live fill, paid path,
deployment, or retained passing live pack is involved.
The existing test-generated review report was restored and excluded.

```powershell
$cmsTests = @(Get-ChildItem tests/cms-education*.test.mjs -File |
  ForEach-Object { $_.FullName })
node --test --test-concurrency=3 @cmsTests
node --test --test-concurrency=2 tests/cms-education-daytime-harness.test.mjs tests/cms-education-daytime-capture.test.mjs
./scripts/run-cms-education-daytime.ps1 -OutDir ./_temp-scripts/cms-edu-daytime-harness-r3-prepare-20261024
node --check scripts/cms-education-daytime-harness.mjs
node --check tests/cms-education-daytime-harness.test.mjs
git diff --check
```

No product, schema, validator, live runner or capture-helper change; no existing
file is deleted. Never-Save; `liveSupportClaimed=false`.
