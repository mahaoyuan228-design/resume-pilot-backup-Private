# CMS education CONTROLS=1 daytime harness R2 hardening

Base: `c66116ac5a1244436f3d121833e42b876da8f2d3` (merged #188).
Branch: `codex/cms-edu-controls1-daytime-harness-r2`.
Never-Save; `liveSupportClaimed=false`.

## Offline inventory and concrete gaps

The fetched tip and reset HEAD matched the base above. The default PowerShell
prepare command succeeded offline and emitted only an unapproved manifest,
checklist and incomplete preparation status. R1 already supplies same-session
before/after captures, lossless tagged snapshots, actual prepare/run/cleanup
replies, exact byte approval gates, raw markup comparison and supplemental
hook/global identity checks. Its collection design and schema version 1 remain
in place; another schema/validator matrix is unnecessary.

Two collector boundaries needed hardening:

- The generated checklist paired standalone artifact names with paths belonging
  to the evidence pack. For example, `reviewed-bytes.json` contains `files`, not
  `reviewedBytes.files`; the runner report contains `finalDetails.widgetProbes`,
  not `report.finalDetails.widgetProbes`. The prose R1 runbook explained these
  aliases, but the machine-readable checklist did not bind paths to files.
  The seven checklist rows now provide 56 explicit `{file, path}` bindings. Their legacy
  `files` and `fields` lists derive from those bindings. A fictional collection
  regression resolves every binding against emitted artifacts, including the
  actual cleanup probes and supplemental collector gates, and checks that
  preparation emits the same checklist.
- Capture validated ordinary object prototypes but accepted arrays before
  checking their prototype. An inherited custom array iterator could therefore
  execute in the shipped serialization reader while all retained snapshots and
  identities matched. An unrelated ancestor fiber's object-valued `id` could
  similarly execute a coercion hook after capture had skipped that candidate.
  Capture now refuses those executable inputs before calling the unchanged
  reader. Regressions require zero iterator/coercion calls and no body probe
  when rejecting an initial capture, and refusal if these inputs appear after
  the initial capture. These are explicitly fictional safety fixtures, not new
  harvested DOM or evidence of a live defect.

The R1 reviewed-source pin remains `392dbe0b6bf1234be47b2d516ab37ef8ee7e353d`:
the reviewed product/runner paths have not changed. R2 does not auto-approve
bytes, synchronize deployments, or start collection.

## R8 leftovers and expected artifact fields

All seven rows remain LIVE daytime obligations. Checklist bindings identify
where to inspect actual observations; their presence does not establish a pass.

| R8 leftover | Expected artifact fields | Still requires LIVE daytime evidence |
| --- | --- | --- |
| Bytes; clean page | `reviewed-bytes.json`: `tipSha`, `files`; `snapshots-before.json`: `boundary` | Approved deployed bytes, twelve native hooks, absent API, delivered body click and zero overlays. |
| Seven visible probes | `cms-education-live.json`: `finalDetails.widgetProbes`, `finalDetails.widgetClickCount`; actual cleanup probe/count observations | Seven owned openings/closings, one counted opener and three observed events each. Visible degree opening is still unproven. |
| Suppression; traffic; clicks | Report `suppressedAutosave`, `suppressedLookup`, `nonGet`, `saveLikePost`, `finalDetails.clickCount`, `finalDetails.bannedClick`; actual cleanup ledgers; collector `suppressionExercised` | Actual timing/ownership and abort before native send, empty generic traffic and zero forbidden clicks. An empty suppression ledger does not prove exercised suppression. |
| Nine readbacks | Before `snapshots.dom`/`snapshots.publicProps`; actual `observations.json` prepare/run replies; report `fields`/`finalDetails.waitedMs`; collector `actualTrialMatches` | Actual originals and all nine exact waited readbacks for the selected row. |
| Restoration; neighbors | Before/after `snapshots.{dom,publicProps,dto,neighbors}` and `rawDom`; pack `restoration`; collector `rawDomCaptured`/`rawDomEqual` | Complete actual snapshots and matching raw markup preserving whitespace, absence, types and neighboring values. |
| Settled callbacks | Actual `observations.json`: `cleanup.timerSettle`; report `finalDetails.timerSettle`; collector `actualTrialMatches` | Actual bounded settlement with pending/unobservable counts zero. |
| Cleanup | After `boundary`/`identity`; actual cleanup reply; report `finalDetails.cleanupOk`; collector `identity`/`observationsComplete`/`errors` | Actual restoration and same-session hook/global identity. Full injected-global identity remains supplemental, outside schema version 1. |

The supplied R8 last message, R7 notes, CLEAN residual report and overlay
contrast/summary/compact captures were read as historical inputs. CLEAN proves
one school open/close before a generic traffic failure and nine propagated
field failures. The contrast does not prove a delivered click or visible menu;
the compact later capture proves school only. No values from those materials
are copied into a new trial's evidence or used to fill a missing observation.

The second city menu, calendar chooser panels, differing widget originals,
changed-widget writes, controls outside the documented snapshot coverage and
arbitrary future callbacks remain outside this trial. No live browser, CDP,
login or CONTROLS=1 fill is performed for R2. No product or validator file is
changed, and no existing file is deleted.

## Verification

The pinned baseline passed **275/275** CMS education tests, zero failures/skips.
The final hardened harness/capture run passed **51/51**, zero failures/skips
(22 harness tests and 29 capture tests, including nested cases). The baseline
contains the previous 40 harness/capture cases, so these runs overlap; they are
not 326 unique tests. The unchanged 235 cases and final 51 cases cover all
**286 current tests**, without claiming a single 286-test invocation.

The two checklist regressions and the unsafe-input rejection cases failed
against the original implementation before the fixes. Both initial and final
PowerShell preparation checks succeeded offline with `complete:false` and an
unapproved candidate; the final focused tests also verify the current default
prepare command with network operations blocked. All four changed JavaScript
files pass syntax checks, and `git diff --check` passes. Existing module-type
and checkout newline notices remain unchanged.

The supplied CLEAN/contrast/summary/compact JSONs remain incomplete under the
unchanged validator, with report diagnostics **3 / 2 / 2 / 2**. No passing live
evidence pack is created or retained. Product files, the live runner, validator
and launcher match the pinned base. The existing test-generated review report
is restored and excluded from the change.

```powershell
$cmsTests = @(Get-ChildItem tests/cms-education*.test.mjs -File |
  ForEach-Object { $_.FullName })
node --test --test-concurrency=3 @cmsTests
# Final changed-suite verification (overlaps the baseline):
node --test --test-concurrency=2 tests/cms-education-daytime-harness.test.mjs tests/cms-education-daytime-capture.test.mjs
node --check scripts/cms-education-daytime-harness.mjs
node --check scripts/lib/cms-education-daytime-capture.mjs
node --check tests/cms-education-daytime-harness.test.mjs
node --check tests/cms-education-daytime-capture.test.mjs
git diff --check
```

No live support or release acceptance is claimed. Never-Save;
`liveSupportClaimed=false`.
