# CMS education CONTROLS=1 daytime harness R4 retention hardening

Base: `bda959d7c0cb8f50310b24bd985c522200e79043` (merged #190).
Branch: `codex/cms-edu-controls1-daytime-harness-r4`.
Never-Save; `liveSupportClaimed=false`.

## Inventory and narrow offline gap

The fetched upstream tip and reset HEAD were verified against the base above.
R1 already retains same-session before/after captures and actual
prepare/run/cleanup replies, reviewed bytes, raw markup and supplemental
identity observations. R2 binds the seven leftover rows to 56 artifact-root
fields; R3 adds fixed, value-free diagnostics for incomplete collection.
Those bindings and schema version 1 remain unchanged. No additional schema or
validator matrix is needed.
The reviewed-source pin remains `392dbe0b6bf1234be47b2d516ab37ef8ee7e353d`;
its reviewed product/runner paths are unchanged by this round.

Historical materials reviewed:

- Tip `tests/cms-education-daytime-harness-r1-notes.md`,
  `cms-education-daytime-harness-r2-notes.md` and
  `cms-education-daytime-harness-r3-notes.md`.
- Tip `tests/cms-education-controls-daytime-pack-r1-notes.md` through
  `cms-education-controls-daytime-pack-r7-notes.md`,
  `cms-education-controls-residual-r4-notes.md` and
  `cms-education-widget-open-notes.md`.
- PC `_temp-scripts/codex-cms-edu-controls1-daytime-harness-r3-lastmsg.txt`
  and `codex-cms-edu-controls-daytime-pack-r8-lastmsg.txt`.
- PC `_temp-scripts/cms-edu-widget-overlay-harvest-d22734a9/`:
  `contrast-school-vs-degree.json`, `harvest-summary.json` and
  `school-overlay-compact.json`.
- PC `_temp-scripts/cms-edu-controls-residual-r4-materials/`:
  `harvest/harvest-summary.json`, `harvest/isolated-open-summary.json` and
  `live-clean-nonget-d22734a9/cms-education-live.json`.

The contrast records school and degree down/up events without a delivered
click, expanded ARIA or visible overlay. The summary's completed activation
helper still reports `opened=false`; the compact after-reload capture proves
school opening only. CLEAN records one school open/close followed by generic
traffic failure and nine propagated field failures. The harvested queried
autosave shape is already covered by the existing owned school/degree path.
These materials justify no additional selector, opener or request exception,
and supply no missing observation for a new trial.

The distinct remaining collector gap concerns saved evidence. R3 computes
completion from in-memory replies and the returned runner report. Its
availability diagnostics can locate an unreadable retained report without
making that otherwise successful collection incomplete. The five original
capture/reply files can also disagree with the observations used for the
verdict without a retention equality gate.

Offline fictional fixtures reproduce missing or unreadable retained report
output and different saved report/capture content while the in-memory schema
and actual-reply gates still pass. This is a collector retention boundary,
not a captured live runner defect. The unchanged normal runner writes its
report and then returns that same object; the new fixtures deliberately
disturb retained output to test finalization. No live failure or changed
native-site behavior is inferred from them.

## Retained artifact gate and diagnostics

At finalization, the harness reads the six original JSON artifacts and
compares each decoded value with the JSON-persisted representation of the
actual corresponding reply or returned report. `collector-status.json` now
records `retainedArtifactsMatch` with these six boolean fields:

| Field | Original artifact | Compared with |
| --- | --- | --- |
| `before` | `snapshots-before.json` | Actual before capture |
| `after` | `snapshots-after.json` | Actual after capture |
| `prepare` | `prepare.json` | Actual prepare reply |
| `run` | `readbacks.json` | Actual run reply |
| `cleanup` | `cleanup.json` | Actual cleanup reply |
| `report` | `cms-education-live.json` | Returned runner report |

All six fields must be `true` for complete collection, alongside the existing
schema, identity, actual-reply, raw-markup and error gates. With a successful
report but failed retention, collection is incomplete and exits 2. Existing
runner failure exit classes remain intact. The comparison ignores JSON
formatting and object key order; it preserves array order and decoded value
distinctions. This is decoded JSON agreement, not exact file-byte equality.

A failed comparison adds a fixed diagnostic with
`file:"collector-status.json"`, a dotted path such as
`retainedArtifactsMatch.run`, and reason `artifact_missing`,
`artifact_unreadable` or `artifact_mismatch`. Before/after failures use the
existing `restoration_neighbors` key, prepare/run use `nine_readbacks`, and
cleanup/report use `cleanup`. Missing or unreadable checklist-bound originals
also retain their existing artifact/path availability diagnostics.
Diagnostics contain no applicant values, source JSON, parser errors,
protocol messages or machine paths.

The original files remain untouched. Missing artifacts are not synthesized,
different values are not repaired, and in-memory observations are not
replaced by disk content. The evidence pack and unchanged validator continue
to use the actual observations and returned report. This supplemental gate
does not revalidate a different retained report, authenticate provenance,
approve bytes or attest later changes after finalization. Independent review
remains required.

## Leftovers and expected fields

All seven rows remain LIVE daytime obligations. The existing 56 checklist
bindings identify expected fields; neither their presence nor the new
retention gate establishes live success.

| Leftover | Existing expected fields | Status |
| --- | --- | --- |
| Bytes; clean page | Reviewed `tipSha/files`; before `boundary` | Bound; approved deployed bytes, native hooks, absent API, delivered body click and zero overlays still need actual observations. |
| Seven visible probes | Report and actual cleanup `widgetProbes/widgetClickCount` | Bound; seven owned visible openings/closings and counted observed events remain LIVE. Visible degree opening remains unproven. |
| Suppression; traffic; clicks | Report ledgers/counts; actual cleanup ledgers; collector `suppressionExercised` | Bound; actual timing/ownership, before-send abort, empty generic traffic and zero forbidden clicks remain LIVE. Empty suppression does not prove exercised suppression. |
| Nine readbacks | Before DOM/props; actual prepare/run; report fields/wait; collector `actualTrialMatches` | Bound; actual originals and nine exact waited readbacks remain LIVE. |
| Restoration; neighbors | Both snapshots/raw DOM; restoration digests; collector raw capture/equality gates | Bound; complete raw-preserving snapshots, matching markup and unchanged neighbors remain LIVE. |
| Settled callbacks | Actual cleanup and report `timerSettle`; collector `actualTrialMatches` | Bound; actual bounded settlement with zero pending/unobservable counts remains LIVE. |
| Cleanup | After boundary/identity; actual cleanup; collector identity/observation/error gates | Bound; actual restoration remains LIVE. Full injected-global identity remains supplemental, outside schema version 1. |

The second city menu, calendar chooser panels, differing widget originals,
changed-widget writes and arbitrary future callbacks remain outside this
bounded trial. Historical artifacts are not reused as passing observations.

## Verification

The pinned baseline passed **291/291** CMS education tests, zero failures or
skips. The final harness/capture run passed **70/70**, zero failures or skips
(41 harness and 29 capture cases, including nested cases). Those runs overlap
in 56 original harness/capture cases: the unchanged 235 cases plus the final
70 cover all **305 current tests**, without claiming one 305-test invocation.

Before the implementation change, the missing, unreadable and disagreeing
retained-report regressions each demonstrated `complete:true` against the
pinned R3 collector despite successful in-memory replies. The final tests
require incomplete collection and exact exit 2, and additionally exercise all
five saved capture/reply aliases. Failure-class fixtures preserve exits 1/3.
The formatting/key-order positive control retains all six true flags.

The offline PowerShell prepare command succeeded with `complete:false`,
`approved:false`, seven checklist rows and 56 unchanged bindings. Both changed
JavaScript files pass syntax checks; `git diff --check` passes. The existing
test-generated review report was restored and excluded.

```powershell
$cmsTests = @(Get-ChildItem tests/cms-education*.test.mjs -File |
  ForEach-Object { $_.FullName })
node --test @cmsTests
node --test --test-concurrency=2 tests/cms-education-daytime-harness.test.mjs tests/cms-education-daytime-capture.test.mjs
./scripts/run-cms-education-daytime.ps1 -OutDir <new-private-directory>
node --check scripts/cms-education-daytime-harness.mjs
node --check tests/cms-education-daytime-harness.test.mjs
git diff --check
```

The added regressions use fictional replies only. They cover retained report
availability/disagreement, saved original capture/reply disagreement, safe
diagnostic locations, unchanged raw evidence and a formatting/key-order
positive control. No live browser/CDP/login, CONTROLS=1 fill, paid product
path, deployment, companion CA result or retained passing live pack is part
of this change.

Scope is harness/docs/tests only. Product code, live runner, capture helper,
PowerShell launcher, schema version and validator remain unchanged; no
existing file is deleted. Never-Save; `liveSupportClaimed=false`.
