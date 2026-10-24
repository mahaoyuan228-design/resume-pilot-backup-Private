# CMS education CONTROLS daytime offline pack R4

Fetched GitHub `cursor/expand-night-ats-f861`, hard-reset the workdir, and
reverified HEAD as `a4fd3348ea2776e72110d5c0397521bf18b5a05f` before edits.
Branch: `codex/cms-edu-controls-daytime-pack-r4`.
Never-Save; `liveSupportClaimed=false`.

## New gap beyond R3

Read the supplied PC `codex-cms-edu-controls-daytime-pack-r3-lastmsg.txt`,
R3/R2/R1 notes, residual-R4 notes, widget-open notes, and the supplied overlay
and CLEAN materials. The endpoint/query, opener, callback, neighbor, and
restoration mechanisms already have tip coverage. Those mechanisms remain
unchanged; R2's three callback/neighbor tests and R3's fifteen schema tests
remain in place.

An independent JSON-roundtrip witness found a retained-evidence gap:
`method: ["POST"]` in an otherwise valid suppression row passes the legacy
classifiers and R3's complete-pack validator. Nested single-element arrays
coerce the same way. This affects queryless autosave, captured queried autosave
for school/degree, and school lookup. The host reads these rows with
`method.toUpperCase()`, so an array cannot be an unchanged successful emitted
row. This is malformed retained evidence, not a captured live defect.

The opt-in offline validator now requires both suppression ledgers to contain
object rows with string methods before accepting `runner_report`. Existing
runner checks still decide endpoint/query, allowed control key, transport,
phase, before-send abort, and failure status. The schema version, six check
keys, CLI contract, and diagnostic `reportExitCode` remain unchanged. In
particular, that legacy diagnostic can be zero while `runner_report=false`
and `complete=false`; CLI exit status is still 2 for an incomplete pack.

New adversarial tests extend the existing schema suite. They do not add DOM,
openers, site handlers, responses, or a passing live-evidence pack. Empty
suppression arrays remain valid evidence of no recorded suppression attempt;
they cannot demonstrate that suppression was exercised.

## Materials and R3 leftover mapping

| R3 leftover / daytime requirement | Tip coverage retained | R4 addition and remaining live observation |
| --- | --- | --- |
| Reviewed deployed bytes and clean initial page | R3 `reviewed_bytes` and `page_boundaries`; preflight tests in `cms-education-live.test.mjs`, `cms-education-controls-live.test.mjs`, `cms-education-widget-open-r3.test.mjs` | No new capture mechanism. Actual reviewed machine bytes, native hooks, API absence, body-click delivery, and zero initial overlays still require observation. |
| Seven owned visible open/close probes with counted and observed activations | Runner `completeWidgetProbes`, controls and widget-open regression tests, R3 `runner_report` | Adversarial retained-report combinations distinguish helper/event success and school opening from degree opening. All seven actual visible results, especially **degree**, remain live-only. |
| Bounded suppression, explicit empty generic ledgers, zero forbidden clicks | #178/#180 classifiers and invocation/late/abort/transport tests; #181 ledger/count requirements; R3 report reuse | Reject coercible array methods; test malformed ledger shapes and fatal generic traffic alongside valid suppression. Actual timing, same-invocation ownership, and abort before send remain live-only. |
| Nine exact readbacks with sufficient wait | Controls nine-field trial and R3 report checks | No new write mechanism. Actual fixture originals and all nine readbacks remain required. |
| Exact DOM/public-props/DTO restoration and unchanged neighbors | R2 callback/neighbor tests; R3 four restoration digest pairs | No duplicated runtime scenario. Actual complete snapshots with raw whitespace and absent/empty distinctions remain required. |
| Settled callbacks | Autosave timer tests, R2 controls callback/interval cases, R3 strict timer counters | Additional adversarial counter/container inputs must fail; positive safe observed non-function counts remain allowed. Actual bounded settlement still requires observation. |
| Complete cleanup | Controls exact descriptors/globals tests; helper-descriptor restoration test; R3 twelve-hook/API/overlay boundaries | Retain actual native-hook and injected-global cleanup observations. R3's boundary schema still does not independently attest every injected product-global descriptor or object identity. |

The PC contrast harvest records down/up but no observed click, closed ARIA,
no open class, and zero overlays for both school and degree. The summary
records helper success/complete activation while `opened=false`; unchanged
values and zero final overlays cannot establish opening. The compact
after-reload capture records later school opening, with no corresponding
visible degree proof.

The supplied CLEAN report records one school open/close, then generic traffic
and nine propagated failures. Its restoration/cleanup flags cannot rescue
failed controls or establish nine independently failed widgets. The raw R4
harvest provides only the lookup and queried-autosave shapes already covered
by #178/#180. No new request exception or opener is justified. No applicant
values or private captures are copied into the repository.

## Daytime boundaries

An authorized daytime Never-Save CONTROLS=1 trial still needs all observations
in the table from the same trial. Structural validation does not authenticate
provenance, a native-site opening, the snapshot encoding, request ownership,
or byte approval. Follow R3's retained artifact instructions; this pack adds
no browser capture helper or defaults for missing observations.

The second city menu, opened calendar year/month chooser panels, differing
widget originals, and changed-value widget writes remain outside the bounded
trial. Previously captured APIs, workers, future responses, and arbitrary
future callbacks remain outside bounded timer observation. No live session,
login, companion CA result, release acceptance credit, or paid path is part
of R4. `liveSupportClaimed=false`.

## Validation

The pre-edit full invocation passed all ten `tests/cms-education*.test.mjs`
files: **221/221**, zero failures/skips, with `--test-concurrency=3`.
The final extended schema/CLI suite passed **21/21**, zero failures/skips:
the fifteen retained R3 tests plus six new tests. These two invocations overlap
in those fifteen schema tests; they are not additive. They cover **227 unique
tests** in the resulting suite: 206 unchanged runtime tests plus 21 final
schema tests. No separate single 227-test run is claimed. All files exercised
by the unchanged runtime group still match the pinned base.

The malformed-method regression checks five supported ledger/query shapes in
both trial and restore phases with three array nesting variants (30 negative
combinations). Each explicitly demonstrates a legacy-success report that the
offline pack validator rejects. The matching string-method reports pass.
Other additions cover school-success/degree-failure contrasts with otherwise
clean boundaries/restoration, generic traffic alongside valid suppression,
empty suppression scope, timer coercions/overflow, and nested valid-JSON CLI
privacy. No R2 callback/neighbor scenario is repeated.

Direct offline checks rejected the supplied CLEAN report and all three named
overlay artifacts without adding observation attachments. The CLEAN report's
computed legacy diagnostic remained 3; each overlay artifact's remained 2.
The validator/test syntax and `git diff --check` pass. The existing Node
module-type warning is unchanged. The generated tracked review report is
restored and excluded. Only the offline validator, its schema test file, and
these R4 notes are changed.

```powershell
$cmsTests = @(Get-ChildItem tests/cms-education*.test.mjs -File |
  ForEach-Object { $_.FullName })
node --test --test-concurrency=3 @cmsTests # pre-edit baseline: 221
node --test tests/cms-education-controls-daytime-evidence.test.mjs # final: 21
node --check scripts/validate-cms-education-controls-evidence.mjs
node --check tests/cms-education-controls-daytime-evidence.test.mjs
git diff --check
```
