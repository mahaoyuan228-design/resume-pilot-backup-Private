# CMS education CONTROLS=1 daytime harness R6 hardening

Base: `97e76cffa239b6286f9d669dcd3017e0d87e01d2` (merged #192).
Branch: `codex/cms-edu-controls1-daytime-harness-r6`.
Never-Save; `liveSupportClaimed=false`.

## Inventory and two incremental offline gaps

Upstream was fetched, the dedicated workdir hard-reset, and HEAD verified at
the base above. R1 collects same-session before/after observations, actual
prepare/run/cleanup replies, reviewed bytes, raw markup and supplemental
identity observations. R2 already supplies seven checklist rows with 56
artifact-root bindings. R3 locates failures without exposing captured values.
R4 checks all six retained originals against the captured replies/returned
report. R5 binds actual cleanup probes/counts/suppression to that report and
requires selected-row and waited-duration agreement. These gates remain.

Inputs reviewed include harness R1-R5 notes, daytime pack R1-R7 notes,
residual R4 and widget-open notes, the supplied PC harness R5 and pack R8 last
messages, overlay summary/contrast/compact captures, and residual harvest
summaries and the CLEAN report. School/degree contrast has down/up without a
delivered click or visible overlay; the helper summary still has
`opened:false`. Compact after-reload evidence proves school opening only.
CLEAN has one school opening/closing before generic traffic failure and nine
propagated field failures. Existing code already covers the harvested queried
request shapes. These materials justify no new DOM selector, opener, request
exception or successful observation for a new trial. R8's schema early-stop
remains valid; no prep pack R9 or schema/validator change is needed.

Two distinct collector gaps remain at the R5 base:

1. R5 explicitly documents that a getter added to the standard object
   prototype can execute through an inherited metadata property. Own-data
   encoding does not inspect the prototypes' own accessor descriptors before
   the unchanged serialization reader reaches a missing metadata key.
2. A fictional passing report can accompany actual prepare identities such
   as `identity:null, identities:[null]`, empty/nonstring identities, or
   duplicate identities, with all six R4 retention flags true and
   `actualTrialMatches:true`. Null even produces a `value_null` diagnostic
   beside `complete:true`. The existing plan producer requires nonempty,
   unique string identities for every existing row; mere selected-value
   equality does not establish that contract.

These are offline collector witnesses, not evidence that the real page or
unchanged runner emitted these conditions. Historical captures are not reused
as observations for a new trial.

## Capture refusal before inherited getters execute

The capture helper now checks the standard object/array prototype chain and
inspects all their own string and symbol descriptors before observation and
before each snapshot. Added accessors fail with the existing fixed
`daytime_capture_accessor_unreadable` reason; an extended chain fails with
`daytime_capture_non_data_value`. The standard object `__proto__` accessor is
allowed only with native-form getter and setter source witnesses. No rejected
property or prototype is repaired, removed or invoked.

The preflight itself uses indexed loops and direct descriptor checks. It does
not fetch an array iterator or array method while inspecting those very
descriptors. Serialization module initializers are deferred until the reader
is called after preflight; the initial global-descriptor capture is also
preceded by preflight. After the stopped body probe, the second snapshot and
its preflight run before either snapshot is JSON-stringified. An earlier
capture listener therefore cannot insert an inherited `toJSON` getter into
the comparison's left operand before it is checked.

Fictional initial/final tests require zero getter reads and no additional
body probes for metadata, symbol, array iterator/method, initializer-method,
JSON and replaced legacy accessors. Additional fixtures cover an extended
array prototype chain and accessors introduced by a body-probe listener.
The unchanged positive tests retain exact raw/tagged snapshots, normal
prototype support and original hook/global identity comparisons.

This is deliberately accessor/chain refusal, not hostile-realm authentication.
Ordinary intrinsic methods and data-valued prototype properties remain a
trust boundary. In particular, an inherited data-valued `toJSON` function can
still execute; this round does not claim to close that separate boundary,
arbitrary coercion hooks, proxies or replaced native intrinsics. No supplied
harvest establishes any such condition on the live page. The conservative
accessor refusal can also stop a page with a benign prototype accessor;
retain the failure for review rather than bypass it.

## Actual prepare identity agreement

The existing `actualTrialMatches` prepare predicate additionally requires
every identity to be a nonempty string and all identities to be unique.
Iteration includes sparse positions. This matches the existing
`src/profile/cms-education-plan.mjs` existing-target contract; no identity JSON
format, length bound, trimming or new product rule is introduced. Distinct
whitespace strings remain accepted by this narrow contract.

Failure uses the existing `nine_readbacks` diagnostic at
`observations.json:prepare` with reason `prepare_mismatch`. Actual originals
remain unchanged, the six retention flags remain independently computed,
and the schema verdict remains independent. A successful report with failed
actual identity agreement is incomplete and exits 2; existing failure-class
coverage still preserves exits 1/3. No captured identity value enters a
diagnostic.

## Leftovers and expected fields

All seven rows remain LIVE daytime obligations. All 56 existing bindings are
unchanged; presence or offline refusal supplies no live observation.

| Leftover | Existing expected fields | Status |
| --- | --- | --- |
| Bytes; clean page | Reviewed `tipSha/files`; before `boundary` | Bound; approved deployed bytes, native hooks, absent API, body-click delivery and zero overlays remain LIVE. |
| Seven visible probes | Report/cleanup `widgetProbes/widgetClickCount` | Bound with R5 agreement; seven owned visible openings/closings remain LIVE. Visible degree opening is still unproven. |
| Suppression; traffic; clicks | Report/cleanup ledgers/counts; collector `suppressionExercised` | Bound with R5 agreement; actual ownership/timing, before-send abort, empty generic traffic and zero forbidden clicks remain LIVE. Empty suppression is not exercised suppression. |
| Nine readbacks | Before DOM/props; actual prepare/run; report fields/wait; collector `actualTrialMatches` | Bound; actual identity contract hardened. Actual originals and nine exact waited readbacks remain LIVE. |
| Restoration; neighbors | Both snapshots/raw DOM; restoration digests; raw capture/equality gates | Bound; inherited-accessor refusal hardened. Complete actual snapshots, matching raw markup and unchanged neighbors remain LIVE. |
| Settled callbacks | Actual cleanup/report `timerSettle`; collector `actualTrialMatches` | Bound with R5 agreement; actual bounded settlement and zero pending/unobservable counts remain LIVE. |
| Cleanup | After boundary/identity; actual cleanup; collector identity/observation/error gates | Bound; actual restoration remains LIVE. Full injected-global identity stays supplemental, outside schema v1. |

The second city menu, calendar chooser panels, differing widget originals,
changed-widget writes and arbitrary future callbacks remain outside the
bounded trial. The collector does not authenticate provenance or replace
independent review. Reviewed product/runner source remains pinned at
`392dbe0b6bf1234be47b2d516ab37ef8ee7e353d` because those files are unchanged.

## Verification

The original ten capture rejection subcases plus their two parent groups
failed against R5 before implementation. The initial identity regression run
passed its two positive controls plus parent, and failed all eleven negative
subcases plus parent (3 passed / 12 failed). After implementation, the focused
identity run passed 15/15. Independent final review passed all 44 targeted
capture/identity cases, including zero getter reads, and found no remaining
defect in these scoped changes.

Default PowerShell preparation succeeds with `complete:false`,
`collected:false`, `approved:false`, seven rows and 56 bindings. Changed
JavaScript syntax and `git diff --check` pass. The final single invocation of
all twelve `tests/cms-education*.test.mjs` files passes **394/394**, zero
failures or skips, including all 44 additions and the existing 350 cases.
The earlier whole-suite run and focused runs overlap this final invocation;
their counts are not added. The generated review report is restored and
excluded. Product/live-runner/schema/validator/launcher files match the base,
and no tracked file is deleted.

```powershell
$cmsTests = @(Get-ChildItem tests/cms-education*.test.mjs -File |
  ForEach-Object { $_.FullName })
node --test --test-reporter=spec --test-concurrency=3 @cmsTests
node --test --test-concurrency=2 tests/cms-education-daytime-harness.test.mjs tests/cms-education-daytime-capture.test.mjs
./scripts/run-cms-education-daytime.ps1 -OutDir <new-private-directory>
node --check scripts/cms-education-daytime-harness.mjs
node --check scripts/lib/cms-education-daytime-capture.mjs
node --check tests/cms-education-daytime-harness.test.mjs
node --check tests/cms-education-daytime-capture.test.mjs
git diff --check
```

Scope is harness/capture/docs/tests only. No product, live runner, PowerShell
launcher, reviewed-source pin, schema or validator change. No live browser,
CDP, login, CONTROLS=1 fill, deployment, paid-path change, companion CA result,
passing live evidence pack or existing-file deletion is part of this work.
Never-Save; `liveSupportClaimed=false`.
