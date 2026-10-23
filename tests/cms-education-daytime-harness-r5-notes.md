# CMS education CONTROLS=1 daytime harness R5 agreement hardening

Base: `da0b5dd799a2c11039556538cf9f114e70444af6` (merged #191).
Branch: `codex/cms-edu-controls1-daytime-harness-r5`.
Never-Save; `liveSupportClaimed=false`.

## Inventory and distinct offline gap

Upstream was fetched, the dedicated workdir hard-reset, and HEAD verified at
the base above. R1 already retains same-session before/after captures, actual
prepare/run/cleanup replies, reviewed bytes, raw markup and supplemental
identity observations. R2 supplies seven checklist rows with 56 artifact-root
bindings. R3 adds fixed, value-free diagnostics. R4 requires all six saved
originals to match their corresponding captured replies or returned report.
Those bindings, schema version 1 and the validator remain unchanged.
The reviewed product/runner source pin remains
`392dbe0b6bf1234be47b2d516ab37ef8ee7e353d`.

Reviewed historical inputs include the tip harness R1-R4 notes, daytime pack
R1-R7 notes, residual R4 and widget-open notes, the supplied PC harness R4 and
pack R8 last messages, overlay contrast/summary/compact captures, and the
residual harvest summaries and CLEAN report. The contrast records school and
degree down/up without a click, expanded ARIA or visible overlay. The helper
summary still has `opened:false`; compact after-reload evidence proves school
opening only. CLEAN records one school opening/closing, then generic traffic
failure and nine propagated field failures. Queried request shapes are already
covered. None justifies a new DOM selector, opener, request exception or passing
observation for a new trial.

The distinct collector gap is agreement between independently retained actual
replies and the validated report. A fictional passing report could accompany
missing or contradictory actual cleanup probes/counts or suppression ledgers
while `actualTrialMatches:true` and all six R4 retention flags remained true.
Deleting actual cleanup probes even produced a missing-path diagnostic beside
`complete:true`. Actual replies and a report could also independently describe
different valid rows or different completed readback waits.

The unchanged shipped runner directly copies cleanup probes/counts, copies the
actual selected row and wait, and normalizes/merges suppression observations.
These fixtures deliberately separate those sources to test the collector's
supplemental agreement boundary. They establish no defect in a live runner or
native employer page. No schema/validator matrix or prep pack R9 is added.

## Supplemental agreement checks

The existing `actualTrialMatches` gate additionally requires:

- The report's selected row equals the requested/actual row, and its waited
  duration equals the actual run's already bounded numeric duration.
- Actual cleanup `widgetProbes` and `widgetClickCount` equal their report
  counterparts. Decoded object key order is immaterial; array order is retained.
- Both actual cleanup suppression ledgers are arrays of at most 80 rows, using
  the existing exported bounded request classifiers. Methods must be strings;
  transport, phase and before-send observations must agree with the existing
  guards; contradictory or malformed abort-failure flags cannot disappear in
  normalization.
- Every normalized cleanup suppression row, including its multiplicity, occurs
  in the corresponding report ledger. The runner's uppercase methods, absolute
  URLs, fixed-field projection and queried-autosave control key are respected.
  Report extras from earlier reads are allowed, matching the runner's merge
  behavior; an empty actual ledger does not erase earlier report observations.

New failures use the existing seven checklist keys and fixed
`observations.json` paths: `cleanup.widgetProbes`, `cleanup.widgetClickCount`,
`cleanup.suppressedAutosave` and `cleanup.suppressedLookup`. Row/wait failures
use the existing prepare/run diagnostics. No applicant values, endpoint values,
parser errors or machine paths enter diagnostics. The actual replies and saved
originals remain unchanged; the R4 retention gate still checks all six files.
A passing report with failed supplemental agreement is incomplete and exits 2;
existing runner failure exit classes remain authoritative.

## Leftovers and expected fields

All seven rows remain LIVE daytime obligations. Existing bindings identify
where observations belong; offline agreement checks do not supply them.

| Leftover | Existing expected fields | Status |
| --- | --- | --- |
| Bytes; clean page | Reviewed `tipSha/files`; before `boundary` | Bound; approved deployed bytes, native hooks, absent API, body-click delivery and zero overlays remain LIVE. |
| Seven visible probes | Report and actual cleanup `widgetProbes/widgetClickCount` | Bound; actual/report agreement hardened. Seven owned visible openings/closings remain LIVE; degree opening is still unproven. |
| Suppression; traffic; clicks | Report ledgers/counts; actual cleanup ledgers; collector `suppressionExercised` | Bound; cleanup/report retention and agreement hardened. Actual ownership/timing, before-send abort, empty generic traffic and zero forbidden clicks remain LIVE. Empty ledgers do not prove exercised suppression. |
| Nine readbacks | Before DOM/props; actual prepare/run; report fields/wait; collector `actualTrialMatches` | Bound; row/wait agreement hardened. Actual originals and nine exact waited readbacks remain LIVE. |
| Restoration; neighbors | Both snapshots/raw DOM; restoration digests; raw capture/equality gates | Bound; complete actual snapshots, matching raw markup and unchanged neighbors remain LIVE. |
| Settled callbacks | Actual cleanup/report `timerSettle`; collector `actualTrialMatches` | Bound; actual bounded settlement with zero pending/unobservable counts remains LIVE. |
| Cleanup | After boundary/identity; actual cleanup; collector identity/observation/error gates | Bound; actual restoration remains LIVE. Full injected-global identity remains supplemental, outside schema version 1. |

Second city menus, calendar chooser panels, differing widget originals,
changed-widget writes and arbitrary future callbacks remain outside the bounded
trial. The collector does not authenticate report provenance or replace
independent review. This round does not extend capture's trust in standard
JavaScript prototypes or change its reader; a separate fictional audit found
that a getter added to the standard object prototype can be read through an
inherited metadata property. That independent capture boundary remains open;
no supplied harvest establishes such a condition on the live page.

## Verification

The pinned baseline passed **305/305** CMS education tests, zero failures or
skips. The final harness/capture run passed **115/115**, zero failures or skips
(86 harness and 29 capture cases, including nested cases). The runs overlap in
70 original harness/capture cases: the unchanged 235 cases plus the final 115
cover all **350 current cases**, without claiming a single 350-test invocation.

Before implementation, the targeted 45-case regression run against R4 passed
its two positive controls and failed 39 negative subcases plus their four
parent groups. Every negative subcase exposed `actualTrialMatches:true` despite
the disagreement. All 45 added cases pass with R5. They retain original cleanup
replies, all six true retention flags and the independent schema verdict while
requiring incomplete collection, exit 2 and fixed private-safe diagnostics.
Positive controls cover key order, lowercase methods, relative URLs, permitted
field projection, earlier report rows, repeated attempts, the inclusive 80-row
boundary and a matching wait above the minimum. Existing failure-class tests
continue to preserve exits 1/3.

Default PowerShell preparation succeeded before and after the change with
`complete:false`, `approved:false`, seven checklist rows and 56 bindings. Both
changed JavaScript files pass syntax checks; `git diff --check` passes. The
existing test-generated review report was restored and excluded. Independent
read-only review confirmed the helper's projection and multiset behavior
against the unchanged runner source.

```powershell
$cmsTests = @(Get-ChildItem tests/cms-education*.test.mjs -File |
  ForEach-Object { $_.FullName })
node --test --test-concurrency=3 @cmsTests
node --test --test-name-pattern='actual cleanup|actual trial binding' tests/cms-education-daytime-harness.test.mjs
node --test --test-concurrency=2 tests/cms-education-daytime-harness.test.mjs tests/cms-education-daytime-capture.test.mjs
./scripts/run-cms-education-daytime.ps1 -OutDir <new-private-directory>
node --check scripts/cms-education-daytime-harness.mjs
node --check tests/cms-education-daytime-harness.test.mjs
git diff --check
```

Scope is harness/docs/tests only. No product, live runner, capture helper,
PowerShell launcher, reviewed-source pin, schema or validator change. No live
browser/CDP/login, CONTROLS=1 fill, deployment, paid-path change, companion CA
result, retained passing live pack or existing-file deletion is part of R5.
Never-Save; `liveSupportClaimed=false`.
