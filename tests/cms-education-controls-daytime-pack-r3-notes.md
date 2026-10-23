# CMS education CONTROLS daytime offline pack R3

Canonical `cursor/expand-night-ats-f861` was fetched from GitHub, the workdir
was hard-reset, and HEAD was reverified as
`f86293b319bd0e8b788bfa6a7e4dd9859a2163cb` before edits.
Branch: `codex/cms-edu-controls-daytime-pack-r3`.
Never-Save; `liveSupportClaimed=false`.

## Distinct gap after R2

The source checklist is the **Daytime evidence still required** section of
`cms-education-controls-daytime-pack-r2-notes.md`, cross-checked with the
supplied PC `codex-cms-edu-controls-daytime-pack-r2-lastmsg.txt`.
R2's three callback/neighbor scenarios already exist at this base and are
retained without duplication.

The existing runner's `evidenceExitCode()` validates probes, traffic,
suppression, fields, and restoration flags. It accepts an otherwise valid
CONTROLS report when `finalDetails.timerSettle` is missing or null, when
`pendingTimers` or `unobservableTimers` is positive, or when
`observedNonFunctionTimeouts` is negative. R2 asserts these diagnostics in its
fixture success case, but does not validate them in a retained report.
The report also has no independent retained machine-byte, before/after hook,
overlay, or restoration snapshot evidence. Its success flags alone cannot
tick the whole R2 checklist.

`scripts/validate-cms-education-controls-evidence.mjs` adds an offline JSON
completeness validator. It reuses the shipped report verdict and adds the
missing timer and retained-observation requirements. Product code, live runner,
classifiers, openers, and fixtures are unchanged. This is a separate opt-in
validator; the existing runner's verdict behavior is unchanged.

## R2 requirement mapping

| R2 daytime requirement | Coverage at the pinned tip | R3 artifact check | Still requires daytime observation |
| --- | --- | --- | --- |
| Reviewed bytes and clean page | R1/widget notes; preflight and residual-guard refusal in `cms-education-live.test.mjs`, `cms-education-controls-live.test.mjs`, and `cms-education-widget-open-r3.test.mjs` | `reviewed_bytes`; `page_boundaries` before state | Actual reviewed/deployed bytes, native hooks, absent prior API, zero initial overlays |
| Seven distinct owned visible open/close results; one counted opener and three observed events each | Runner `completeWidgetProbes`; controls fake-CDP and R3 ownership/delivery rejection tests | `runner_report` reuses those checks; total widget clicks can exceed seven because allowed outside cleanup is counted | All seven native-site results, especially visible `degree` opening; focus/ARIA/hidden options are insufficient |
| Bounded lookup/autosave suppression; empty generic traffic and zero forbidden clicks | #178/#180 classifiers and ownership/invocation/late/abort/transport regressions; #181 explicit ledgers/count validation | `runner_report` reuses the bounded suppression, explicit `nonGet=[]`, `saveLikePost=[]`, and zero click checks | Actual request timing/ownership and before-send abort; empty suppression arrays mean no recorded attempt, not exercised suppression |
| Nine exact readbacks | Nine-field controls trial and fake-CDP success checks | `runner_report` requires the existing nine canonical verified fields and finite `waitedMs >= READBACK_WAIT_MS` | Actual originals and readbacks; exact preexisting fixture widget values |
| Exact DOM/public-props/DTO restoration and unchanged neighbors | Runner snapshots; controls success; R2 neighbor drift/failure/recovery test | `restoration` requires separate equal before/after digests for all four boundaries; existing report flags remain required | Actual complete snapshots, including untouched rows/neighbors and exact whitespace/absent values |
| Settled callbacks | Autosave timer suite; R2 controls nested-callback and pending-interval tests | `timers` requires all three explicit nonnegative safe integers, with pending/unobservable equal to zero | Actual bounded callback settlement; positive `observedNonFunctionTimeouts` is allowed |
| Complete cleanup; zero overlays; absent API; restored hooks | Controls fake-CDP exact descriptors/globals/API/overlay checks and descriptor restoration test | `page_boundaries` after state, exact source/descriptor equality; report cleanup flags | Actual after-state and native hook restoration; API absence alone cannot prove clean hooks |

## Evidence pack schema and use

Run the validator against a retained JSON pack **after** an independently
authorized daytime trial:

```powershell
node scripts/validate-cms-education-controls-evidence.mjs <evidence-pack.json>
```

It only reads the named JSON file. It never attaches to a browser, runs the
trial, clicks a page, writes an artifact, or supplies missing observations.
Exit 0 means the supplied pack is structurally complete and internally
consistent; exit 2 means incomplete/invalid. Output lists six check results
and always has `liveSupportClaimed=false`. The stored report `exitCode` is
recomputed, not trusted. No applicant values or raw input are echoed.

The pack has these required properties:

- `schemaVersion: 1`, `neverSave: true`, `liveSupportClaimed: false`.
- `report`: the unchanged runner JSON, with `finalDetails.controls=true`.
  Recomputed runner success, explicit `finalDetails.neverSave=true`,
  `bannedClick=false`, sufficient readback wait, and complete timer counts
  are required. A failed report remains failed even if attachments look clean.
- `reviewedBytes: {tipSha, files}`. `tipSha` is a full 40-digit Git SHA
  matching the report. Each file is `{path, reviewedSha256, machineSha256}`;
  the two 64-digit SHA-256 digests must match. Exactly one entry is required
  for each exported `REVIEWED_FILES` path: the live runner, serialization
  reader, three `LIVE_FILES`, and five `CONTROL_FILES`. Review the expected
  digests separately, then record actual deployed bytes; do not derive both
  columns from the same unreviewed machine. Hash exact file bytes, without
  newline normalization. This manifest covers those ten runner/injected
  sources; it does not attest every transitive host dependency or the extension
  package. The runner's historical `finalDetails.baseTip` is not deployed-byte
  proof.
- `boundaries: {before, after}`. Each boundary requires `hasCmsLive:false`,
  `overlays:0`, `bodyClickReached:true`, and `hooks`. Preserve actual observations;
  do not turn an API absence or a cleanup flag into an invented hook result.
  `hooks` has exactly the twelve exported `HOOK_NAMES`: `fetch`, `click`,
  `submit`, `requestSubmit`, `XHR.open`, `XHR.send`, `XHR.abort`, `setTimeout`,
  `clearTimeout`, `setInterval`, `clearInterval`, `sendBeacon`. Each value is
  `{source, ownerDepth, configurable, enumerable, writable}`, retaining the complete
  function source and three boolean data-descriptor attributes of its owning
  property. `ownerDepth` is a nonnegative safe integer: zero means an own
  property, one its immediate prototype, and so on. Record the resolved callable
  and its first owning property; do not skip an own shadow to inspect a prototype.
  Sources must have native-function form, and each source/owner/descriptor
  must match before/after. These strings are evidence to inspect, not proof of
  function identity or absence of every unknown listener. Boundary snapshots
  and body-click delivery must be obtained through the separately reviewed
  daytime observation procedure; this script provides no page probe.
- `restoration: {before, after}`. Both contain `domSha256`,
  `publicPropsSha256`, `dtoSha256`, `neighborsSha256`. Each pair must be explicit
  matching SHA-256 digests. Retain the actual complete snapshots separately;
  compute before/after with the same reviewed, deterministic snapshot encoding.
  Preserve raw values, untouched rows, whitespace, and absent-versus-empty
  distinctions. Do not hash just the nine fixture readbacks or a success flag.
  The validator compares digests; it cannot authenticate what was hashed.

There is deliberately no generated passing pack or default-filled capture
template. Unit-test witnesses are schema examples, not live evidence. A real
operator must retain and inspect all source observations from the same trial.
Structural completeness cannot authenticate capture provenance, reviewed-byte
approval, request scheduling, or native-site behavior.
The boundary schema checks the trial API, twelve hooks, body-click delivery,
and overlays. It does not independently attest every injected product-global
descriptor; retain and review those cleanup observations separately, as the
existing fake-CDP success test does. Complete native-site cleanup still requires
the daytime operator's inspection.

## Supplied materials and boundaries

The PC overlay harvest's `contrast-school-vs-degree.json` records no visible
overlay and no observed click for either key under residual hooks. Its
`harvest-summary.json` and `school-overlay-compact.json` show why activation
success, unchanged values, zero final overlays, or later school opening do not
prove seven owned openings. The R4 materials' CLEAN report records a school
open/close followed by fatal generic traffic and nine propagated failures.
Its `pre-trial-hooks.json`, `post-residual-hooks.json`, and
`post-run-dom-check.json` are useful separate observations, but do not provide
this complete R3 pack. Their older tip/hash records cannot attest R3 deployed
bytes. No private captures or applicant data are copied into the repository.

Degree visible opening remains unproven live. The second city menu, opened
calendar year/month chooser panels, differing widget originals, and changed
widget writes remain outside the trial. Previously captured APIs, workers,
future responses, and arbitrary future callbacks remain outside its bounded
timer observation. No live browser/CDP session, login, paid-path change,
companion CA result, or release acceptance credit is part of this pack.
`liveSupportClaimed=false`.

## Validation

The nine preexisting `tests/cms-education*.test.mjs` files were enumerated
before the additive R3 files were created and passed **206/206**, zero
failures/skips, with `--test-concurrency=3`. Those tests and all code they
exercise remained unchanged throughout the run.

The new offline schema/CLI file passed **15/15**, zero failures/skips, after
review fixes. The two disjoint groups cover all ten CMS education test files:
**221/221** passed in total. This is a combined count from the two runs, not
a claim of a separate single 221-test run. The new cases include legacy timer
and array-like-field acceptance witnesses, malformed classifier inputs,
byte-manifest mismatches, hook ownership/descriptor drift, incomplete
restoration, input immutability, and CLI pass/fail/privacy behavior. No R2
callback/neighbor runtime scenario was duplicated.

Direct offline checks against the supplied CLEAN report and all three named
overlay JSONs rejected each as a complete pack. The CLEAN report retained
computed report exit 3; each overlay artifact had computed report exit 2.
No observation attachment was synthesized to make them pass.

The validator and new test pass `node --check`; staged `git diff --check`
passes. The existing module-type warning is unchanged. The test-generated
tracked review report was restored and is excluded from this change. The
product, live runner, existing tests, and all paid paths match the pinned base.

```powershell
$existingCmsTests = @(Get-ChildItem tests/cms-education*.test.mjs -File |
  Where-Object { $_.Name -ne 'cms-education-controls-daytime-evidence.test.mjs' } |
  ForEach-Object { $_.FullName })
node --test --test-concurrency=3 @existingCmsTests
node --test tests/cms-education-controls-daytime-evidence.test.mjs
node --check scripts/validate-cms-education-controls-evidence.mjs
node --check tests/cms-education-controls-daytime-evidence.test.mjs
git diff --cached --check
```
