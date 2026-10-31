# CMS education CONTROLS daytime offline pack R6

Fetched GitHub `cursor/expand-night-ats-f861`, hard-reset this workdir, and
reverified HEAD as `a814acf2f2da3cafe1b3feedadd7b7838d7b6bdf` before edits.
Branch: `codex/cms-edu-controls-daytime-pack-r6`.
Never-Save; `liveSupportClaimed=false`.

## New retained-evidence gap after R5

Read the supplied PC `codex-cms-edu-controls-daytime-pack-r5-lastmsg.txt`,
the R5/R4/R3/R2/R1, residual-R4, and widget-open notes, and the supplied
overlay/CLEAN materials. R5's shared suppression-row check already rejects
malformed autosave failure flags as well as lookup flags. Existing explicit
generic ledgers, strict click/timer counters, and school/degree contrasts
also reject the additional coercion candidates inspected during this audit.
Those checks do not need another implementation or a copied R5 matrix.

A distinct JSON-roundtripped witness still passed both the legacy report
verdict and the R5 offline validator when `finalDetails.reason` or a widget
probe's `reason` was omitted or replaced with `false`, `0`, or `""`.
The legacy predicates use truthiness for these two diagnostics. In contrast,
the shipped runner initializes the host reason and every probe reason to
`null`, retains those properties in successful output, and sets failure
reasons to strings. The existing controls success test already asserts
`probe.reason === null`; activation reasons also require explicit `null`.
R3's evidence contract requires the unchanged runner JSON.

R6 requires explicit `null` for the successful report reason and every
successful probe reason in the offline validator. This closes acceptance
of malformed retained diagnostics, without establishing a native-site failure
or changing the live runner. Genuine successful output remains compatible.
The schema version, six check keys, endpoint/ownership rules, and diagnostic
`reportExitCode` remain unchanged. The legacy diagnostic can still be 0 for
these artifacts while `runner_report=false`, `complete=false`, and CLI exit
status is 2. Missing diagnostics are rejected rather than filled in.

## R5 leftover mapping

| R5 leftover / daytime requirement | Tip offline coverage and R6 increment | Still requires LIVE daytime CONTROLS=1 |
| --- | --- | --- |
| Reviewed deployed bytes and clean page | R3 validator `reviewed_bytes` / `page_boundaries`; preflight and residual-guard tests in `cms-education-live.test.mjs`, `cms-education-controls-live.test.mjs`, and `cms-education-widget-open-r3.test.mjs` | Actual approved deployed bytes, native hooks, absent prior API, body-click delivery, and zero initial overlays. |
| Seven owned visible open/close probes | Runner `completeWidgetProbes`, controls/widget-open tests, R4 school/degree contrasts; R6 explicit no-failure diagnostic for each of the seven probes | Seven same-trial owned visible openings/closings, one counted opener and all three observed mouse events each, especially **degree visible opening**. |
| Bounded suppression, empty generic traffic, zero forbidden clicks | #178/#180 ownership/invocation/late/abort/transport tests; #181 explicit ledgers/counts; R4 method shapes; R5 shared failure-marker rejection; R6 explicit report no-failure diagnostic | Actual timing, same-invocation ownership, before-send abort, explicit empty `nonGet` / `saveLikePost`, and zero forbidden clicks. Empty suppression logs do not establish exercised suppression. |
| Nine exact waited readbacks | Controls nine-field trial and R3 `runner_report` checks; R6 does not change writes or fixtures | Actual fixture originals and all nine exact readbacks after sufficient wait. |
| Exact restoration and unchanged neighbors | Controls whole snapshots, R2 callback/interval/neighbor cases, R3 four equal digest pairs | Complete actual DOM/public-props/DTO/neighbor snapshots preserving raw whitespace and absent-versus-empty distinctions. |
| Settled callbacks | Autosave timer tests, R2 controls scenarios, R3 strict counts, R4 coercion/overflow negatives; clean timer proof cannot rescue malformed R6 diagnostics | Actual bounded settlement with pending/unobservable counts zero. Completed observed non-function timeouts may have a positive safe count. |
| Complete cleanup | Controls exact descriptors/globals tests; R3 twelve-hook/API/overlay boundaries; clean attachments cannot rescue malformed R6 diagnostics | Actual native-hook/injected-global restoration, absent API, and zero overlays. Full injected-global descriptor/object-identity attestation remains outside the schema. |

Every row retains live observations. Schema completeness cannot authenticate
capture provenance, byte approval, event delivery, request scheduling,
snapshot encoding, function identity, or native-site behavior. Retain and
inspect actual same-trial observations using R3's artifact instructions.
No browser capture helper, passing evidence pack, or observation default is
provided by R6.

## Materials and boundaries

The contrast harvest records school and degree down/up events without an
observed click, expanded ARIA, open class, or visible overlay. The harvest
summary's completed activation helper still has `opened=false`; the compact
capture records later school opening only. Visible degree opening remains
unproven. R4 already covers those contrasts; R6 adds no DOM or opener.

The supplied CLEAN report has one successful school open/close followed by
fatal generic traffic and nine propagated field failures. Its school probe
explicitly retains `reason:null`; its report reason is `non_get_request`.
Restoration/cleanup cannot rescue this report or establish nine independent
widget failures. Its raw lookup and queried-autosave shapes are already
covered by #178/#180. No private captures or applicant values are copied here.

The second city menu, opened calendar year/month chooser panels, differing
widget originals, and changed-value widget writes remain outside the trial.
Previously captured APIs, workers, future responses, and arbitrary future
callbacks remain outside bounded timer observation. No live browser/CDP,
Jeremy login or Edge session, paid-path change, companion CA result, or
release acceptance credit is part of R6. `liveSupportClaimed=false`.

## Validation

The baseline invocation began before R6 edits and passed all ten
`tests/cms-education*.test.mjs` files: **229/229**, zero failures/skips, with
`--test-concurrency=3`. Its 23 schema/CLI cases completed before edits to
either executable file. The remaining 206 runtime cases exercise unchanged
base sources; no other test imports the offline validator.

All three new tests failed before the fix: missing report/probe reasons
incorrectly completed the artifact and the CLI incorrectly exited 0. An
independent in-memory JSON-roundtrip audit also confirmed that all **32**
malformed combinations were accepted by R5: four missing/falsy variants at
the report and seven probe locations. These are assertions within tests,
not additional test counts. No passing evidence pack is written.

After the fix the complete schema/CLI suite passed **26/26**, zero
failures/skips, retaining all 23 base tests. New cases include populated
valid suppression, explicit-null success controls, clean timer/byte/boundary/
restoration attachments, input immutability, and two CLI rejection cases
with private filenames and nested probe/readback observations. The baseline
and final schema runs overlap in 23 tests and cover **232 unique tests**:
206 unchanged runtime tests plus 26 final schema tests. No separate single
232-test run is claimed.

Direct offline checks still reject the supplied CLEAN report and all three
named overlay JSONs without supplying observation attachments. Their legacy
diagnostics remain 3 / 2 / 2 / 2. Validator/test syntax and diff checks pass;
the existing Node module-type warning is unchanged. The generated tracked
review report is restored and excluded. Only the offline validator, its
schema test, and these notes are changed; no existing file is deleted.

```powershell
$cmsTests = @(Get-ChildItem tests/cms-education*.test.mjs -File |
  ForEach-Object { $_.FullName })
node --test --test-concurrency=3 @cmsTests # base invocation: 229
node --test tests/cms-education-controls-daytime-evidence.test.mjs # final: 26
node --check scripts/validate-cms-education-controls-evidence.mjs
node --check tests/cms-education-controls-daytime-evidence.test.mjs
git diff --check
```
