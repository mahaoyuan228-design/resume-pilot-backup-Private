# CMS education CONTROLS daytime offline pack R5

Fetched GitHub `cursor/expand-night-ats-f861`, hard-reset this workdir, and
reverified HEAD as `16ca73edc990da016bbc911563524feb35e0dd6a` before edits.
Branch: `codex/cms-edu-controls-daytime-pack-r5`.
Never-Save; `liveSupportClaimed=false`.

## Distinct retained-evidence gap after R4

Read the supplied PC `codex-cms-edu-controls-daytime-pack-r4-lastmsg.txt`,
the tip R4/R3/R2/R1, residual-R4, and widget-open notes, and the supplied
overlay/CLEAN materials. R4's six additions and all 21 schema tests are
retained. The existing endpoint, opener, callback, timer-counter, neighbor,
restoration, and school-versus-degree checks are not repeated.

A JSON-roundtripped schema witness with a valid `suppressedLookup` row and
`abortFailed:true` passes both the legacy `evidenceExitCode()` and the R4
offline validator. Malformed values such as `"false"`, `null`, arrays, and
objects also pass. Clean generic ledgers, zero timer counters, and matching
boundary/restoration evidence do not remove this contradiction.

The lookup XHR branch calls the captured abort before recording suppression.
If abort throws, it records fatal generic traffic and throws instead of
recording a successful lookup row. The host normalizer retains only method,
URL, transport, before-send, and phase for lookup rows. A failure flag is not
emitted on a successful lookup row. R4's claim that the runner checks failure
status was incomplete for a retained lookup failure flag: the legacy lookup
predicate ignores that property, unlike its autosave predicate.

The offline validator now accepts a suppression row's optional `abortFailed`
only when absent or literally `false`. This shared check rejects explicit
failure and malformed flags in either ledger. Genuine successful host output
continues to pass. No endpoint, ownership, query, transport, before-send,
phase, live-runner, or product behavior is changed. This fixes contradictory
retained evidence; it does not establish a captured live abort defect.

The schema version, six check keys, and diagnostic `reportExitCode` stay the
same. A contradictory lookup can still have legacy `reportExitCode:0` while
`runner_report=false`, `complete=false`, and CLI exit status is 2. The new CLI
case also retains a private marker nested across the suppression row, report,
byte manifest, hook boundary, and restoration attachments; neither the marker
nor the input path is echoed.

## R4 leftover mapping

| R4 leftover / daytime requirement | Tip offline coverage retained, with R5 increment | Still requires LIVE daytime CONTROLS=1 |
| --- | --- | --- |
| Reviewed deployed bytes and clean page | R3 validator `reviewed_bytes` / `page_boundaries`; preflight cases in `cms-education-live.test.mjs`, `cms-education-controls-live.test.mjs`, and `cms-education-widget-open-r3.test.mjs` | Actual approved deployed bytes, native hooks, absent prior API, body-click delivery, and zero initial overlays. |
| Seven owned visible open/close probes | Runner `completeWidgetProbes`, controls/widget-open regressions, and R4 school/degree contrast cases in `cms-education-controls-daytime-evidence.test.mjs` | All seven same-trial owned visible openings/closings with one counted opener and all three observed mouse events each, especially **degree visible opening**. |
| Bounded suppression; empty generic traffic; zero forbidden clicks | #178/#180 classifiers and ownership/invocation/late/abort/transport cases; #181 explicit ledgers/counts; R3 report reuse; R4 method-shape negatives; R5 contradictory lookup failure-marker negatives | Actual request timing, same-invocation ownership, abort before native send, explicit empty `nonGet` / `saveLikePost`, and zero forbidden clicks. |
| Nine exact readbacks | Controls nine-field trial and R3 `runner_report` checks, including the readback wait | Actual fixture originals and all nine exact readbacks after sufficient wait. |
| Exact restoration and unchanged neighbors | Controls whole snapshots; R2 callback/interval/neighbor cases; R3 four equal digest pairs | Complete actual DOM/public-props/DTO/neighbor snapshots with raw whitespace and absent-versus-empty distinctions. |
| Settled callbacks | Autosave timers, R2 controls scenarios, R3 strict counts, and R4 coercion/overflow negatives; R5 asserts clean timer proof cannot rescue a failed suppression row | Actual bounded settlement with pending/unobservable counts zero. Observed completed non-function timeouts may have a positive safe count. |
| Complete cleanup | Controls exact hook/global/descriptor cases; R3 twelve-hook/API/overlay boundary checks | Actual restored native hooks and injected globals, absent trial API, and zero overlays. Full injected-global descriptor/object-identity attestation remains outside the schema. |

All seven rows retain live requirements. Structural completeness does not
authenticate capture provenance, byte approval, request scheduling, snapshot
encoding, function identity, or native-site behavior. Retain and inspect the
actual observations from the same authorized trial using R3's artifact
instructions. This pack supplies no browser capture helper, passing evidence
pack, or defaults for missing observations.

## Supplied materials and bounded exclusions

The PC contrast records school and degree down/up events but no observed
click, closed ARIA, no open class, and zero overlays. The summary's complete
activation helper still has `opened=false`. The compact after-reload capture
shows later school opening only. None establishes visible degree opening.
R4 already tests that contrast; no new opener or DOM is justified.

The CLEAN report records one school open/close followed by fatal generic
traffic and nine propagated field failures. Restoration and cleanup flags
cannot rescue it or establish nine independently failed controls. The raw
harvest's lookup and queried-autosave shapes are already covered by #178/#180.
No applicant values or private captures are copied into the repository.

The second city menu, opened calendar year/month chooser panels, differing
widget originals, and changed-value widget writes remain outside the trial.
Previously captured APIs, workers, future responses, and arbitrary future
callbacks remain outside bounded timer observation. No live browser/CDP
session, login, paid-path change, companion CA result, or release acceptance
credit is part of R5. `liveSupportClaimed=false`.

## Validation

The two new tests failed before the fix: the direct witness was incorrectly
complete and the CLI incorrectly exited 0. After the fix, the schema/CLI
suite passed **23/23**, zero failures/skips. Its two additions cover two
lookup shapes and two phases with eleven invalid flag values (**44 negative
combinations**) plus omission/false controls (**8 positive combinations**),
and the CLI privacy case. These combinations are assertions within tests,
not additional test counts. No R2 callback or R4 method/schema test is copied.

The pre-edit full invocation passed all ten `tests/cms-education*.test.mjs`
files: **227/227**, zero failures/skips, with `--test-concurrency=3`.
The final schema run above includes the 21 schema tests from that invocation
plus two new tests. These overlapping runs cover **229 unique tests** in the
resulting suite: 206 unchanged runtime tests plus 23 final schema tests.
No separate single 229-test run is claimed. Every runtime test and the code
it exercises still match the pinned base.

Direct offline checks rejected the supplied CLEAN report and all three named
overlay JSON artifacts without adding missing attachments. The CLEAN legacy
diagnostic stayed 3; the three overlay diagnostics stayed 2. Validator/test
syntax checks and `git diff --check` pass. The existing Node module-type
warning is unchanged. The generated tracked review report is restored and
excluded. Only the offline validator, its schema test, and these R5 notes
are changed; no existing file is deleted.

```powershell
$cmsTests = @(Get-ChildItem tests/cms-education*.test.mjs -File |
  ForEach-Object { $_.FullName })
node --test --test-concurrency=3 @cmsTests # pre-edit baseline: 227
node --test tests/cms-education-controls-daytime-evidence.test.mjs # final: 23
node --check scripts/validate-cms-education-controls-evidence.mjs
node --check tests/cms-education-controls-daytime-evidence.test.mjs
git diff --check
```
