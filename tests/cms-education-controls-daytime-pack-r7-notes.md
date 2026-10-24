# CMS education CONTROLS daytime offline pack R7

Fetched GitHub `cursor/expand-night-ats-f861`, hard-reset this workdir, and
reverified HEAD as `88a6e85ea816718ef8162fbc1d7e675362fbe264` before edits.
Branch: `codex/cms-edu-controls-daytime-pack-r7`.
Never-Save; `liveSupportClaimed=false`.

## Distinct retained-evidence gap after R6

Read the supplied PC `codex-cms-edu-controls-daytime-pack-r6-lastmsg.txt`,
tip R6/R5/R4/R3/R2/R1, residual-R4 and widget-open notes, and the named
overlay/CLEAN materials. R6's explicit-null success diagnostics and its
26 schema/CLI tests remain intact. The existing method, URL, abort-failure,
timer-counter, degree-contrast and generic-traffic checks need no repetition.

A different JSON-roundtripped witness with **81 valid suppression rows in
one ledger** passes both the legacy report verdict and the R6 offline
validator, even with seven valid probes and zero pending/unobservable timers.
The page producer independently caps `suppressedAutosave` and
`suppressedLookup` at 80 retained rows. The host's `readSuppression` and
`readLookupSuppression` also reject reads above 80. The page arrays are
append-only; the pre-cleanup and cleanup reads use the same deterministic
normalizers. `mergeObservations` takes maximum row multiplicities across
those cumulative reads, so genuine merged output still has at most 80 rows
per ledger. Repeated rows count as observations and must not be deduplicated
to make an overfull artifact pass.

R7 enforces this existing retention bound in the offline validator. It is
per ledger across trial and restore together: 80 autosave plus 80 lookup
rows remain valid. It is neither a combined 80-row limit nor a per-phase or
per-request-shape allowance. The cap limits retained observations, not the
number of attempted requests; an 80-row log does not prove there were only
80 attempts. This is malformed retained-evidence rejection, not evidence of
a live overflow or a new request exception.

The schema version, six check keys, endpoint/ownership rules and diagnostic
`reportExitCode` stay unchanged. An overfull artifact can have legacy
`reportExitCode:0` while `runner_report=false`, `complete=false` and CLI exit
status is 2. No rows are dropped, repaired or synthesized. Product code,
live runner, DOM, openers and fixtures are unchanged.

## R6 leftover mapping

| R6 leftover / daytime requirement | Tip offline coverage and R7 increment | Still requires LIVE daytime CONTROLS=1 |
| --- | --- | --- |
| Reviewed deployed bytes and clean page | R3 `reviewed_bytes` / `page_boundaries`; preflight tests in `cms-education-live.test.mjs`, `cms-education-controls-live.test.mjs`, `cms-education-widget-open-r3.test.mjs` | Actual approved deployed bytes, native hooks, absent prior API, body-click delivery and zero initial overlays. |
| Seven owned visible open/close probes | Runner `completeWidgetProbes`; controls/widget tests; R4 school/degree contrasts; R6 explicit-null reasons | All seven same-trial owned visible openings/closings, one counted opener and all three observed mouse events each, especially **degree visible opening**. |
| Bounded suppression, empty generic traffic and zero forbidden clicks | #178/#180 classifiers, ownership/invocation/late/abort/transport tests; #181 explicit ledgers/counts; R4 method shapes; R5 failure markers; R6 report reason; R7 per-ledger retained-row bound | Actual timing, same-invocation ownership and before-send abort, explicit empty `nonGet` / `saveLikePost` and zero forbidden clicks. Empty suppression logs do not prove exercised suppression. |
| Nine exact waited readbacks | Controls nine-field trial; R3 `runner_report` and wait checks | Actual fixture originals and all nine exact readbacks after sufficient wait. |
| Exact restoration and unchanged neighbors | Controls whole snapshots; R2 callback/interval/neighbor scenarios; R3 four matching digest pairs | Complete actual DOM/public-props/DTO/neighbor snapshots, preserving raw whitespace and absent-versus-empty distinctions. |
| Settled callbacks | Autosave/R2 timer tests; R3 strict counts; R4 coercion/overflow negatives; R7 full-ledger/timer cross-checks | Actual bounded settlement with pending/unobservable counts zero. Completed observed non-function timeouts may have a positive safe count. |
| Complete cleanup | Controls exact descriptor/global tests; R3 twelve-hook/API/overlay boundaries | Actual native-hook/injected-global restoration, absent API and zero overlays. Full injected-global descriptor/object-identity attestation remains outside the schema. |

Every row still requires live observations. Structural completeness cannot
authenticate capture provenance, byte approval, event delivery, request
scheduling, snapshot encoding, function identity or native-site behavior.
Retain and inspect actual same-trial observations using the
[R3 artifact instructions](cms-education-controls-daytime-pack-r3-notes.md#evidence-pack-schema-and-use).
R7 supplies no browser capture helper, passing evidence pack or defaults.

## Materials and exclusions

The contrast harvest records school and degree down/up events without an
observed click, expanded ARIA, open class or visible overlay. The summary's
completed activation helper still has `opened=false`; the compact capture
records later school opening only. Visible degree opening remains unproven.
R4 already covers these distinctions; no new DOM or opener is justified.

The supplied CLEAN report has one successful school open/close followed by
fatal generic traffic and nine propagated field failures. Restoration and
cleanup cannot rescue it or establish nine independent widget failures.
The supplied raw harvest's lookup and queried-autosave shapes are already
covered by #178/#180.
No private captures or applicant values are copied into the repository.

The second city menu, opened calendar year/month chooser panels, differing
widget originals and changed-value widget writes remain outside this trial.
Previously captured APIs, workers, future responses and arbitrary future
callbacks remain outside bounded timer observation. No live browser/CDP,
Jeremy login or Edge session, paid-path change, companion CA result or
release acceptance credit is part of R7. `liveSupportClaimed=false`.

## Validation

The pre-edit invocation passed all ten `tests/cms-education*.test.mjs`
files: **232/232**, zero failures/skips, with `--test-concurrency=3`.
Its 26 schema/CLI cases loaded and completed before the R7 edits; none of
the other test files imports the offline validator. The 206 runtime tests
and every source file they exercise remain unchanged from the pinned base.

The new direct-overflow and CLI-overflow tests both failed before the fix:
an 81-row ledger incorrectly completed, and the CLI incorrectly exited 0.
The capacity/timer control passed before the fix. After the fix, the final
schema/CLI suite passed **29/29**, zero failures/skips, retaining all 26 R6
tests. The overlapping runs cover **235 unique tests**: 206 unchanged runtime
tests plus 29 final schema tests. No single 235-test run is claimed.

The three additions cover independent 80+80 capacity, positive completed
non-function timeout counts, pending/unobservable timer failures alongside
full valid ledgers, six 81-row negatives (both ledgers; repeated trial,
repeated restore and mixed captured shapes/phases), input immutability and
two CLI overflow/privacy cases. Private markers nested in the excess row
and timer observations, and private input filenames, are not echoed. The
combinations are assertions within the three tests, not extra test counts.
No passing evidence pack is retained.

Direct offline checks still reject the supplied CLEAN report and all three
named overlay JSONs without adding observation attachments. Their legacy
diagnostics remain 3 / 2 / 2 / 2. Validator/test syntax and diff checks pass;
the existing Node module-type warning is unchanged. The generated tracked
review report is restored and excluded. Only the offline validator, its
schema test and these notes change; no existing file is deleted.

```powershell
$cmsTests = @(Get-ChildItem tests/cms-education*.test.mjs -File |
  ForEach-Object { $_.FullName })
node --test --test-concurrency=3 @cmsTests # pre-edit invocation: 232
node --test tests/cms-education-controls-daytime-evidence.test.mjs # final: 29
node --check scripts/validate-cms-education-controls-evidence.mjs
node --check tests/cms-education-controls-daytime-evidence.test.mjs
git diff --check
```
