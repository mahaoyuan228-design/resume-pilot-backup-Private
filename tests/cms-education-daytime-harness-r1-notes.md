# CMS education CONTROLS=1 daytime evidence harness R1

Base: `392dbe0b6bf1234be47b2d516ab37ef8ee7e353d`.
Branch: `codex/cms-edu-controls1-daytime-harness-r1`.
Never-Save; `liveSupportClaimed=false`.

## Inventory and distinct collection gap

R8's supplied PC last message stopped honestly: no additional material
offline schema gap beyond #186/#187, and all seven leftover rows still
require live daytime observations. Its 235 passing tests are the pinned
base's result, not a live trial result.

The shipped `scripts/live/cms-education-live.mjs` already performs the
bounded opt-in CONTROLS=1 trial and writes `cms-education-live.json`.
`scripts/validate-cms-education-controls-evidence.mjs` already checks a
retained schema-version-1 pack, including seven probes, nine readbacks,
traffic/click restrictions, timer counters, reviewed bytes, page boundaries
and restoration digest pairs. R1-R7 notes and tests retain those checks;
R7 explicitly supplies no browser capture helper. The runner alone does
not collect the independent before/after attachments needed by that
validator. Earlier harvest scripts produce partial captures from other
sessions and do not form a complete same-trial collector.

This harness fills that collection gap: an offline prepare command and a
daytime one-command wrapper around the unchanged runner, with before/after
observations on its existing CDP session. The existing report and validator
are reused unchanged. No new schema matrix, product writer, DOM opener,
selector, login path or browser launcher is introduced.

The supplied school/degree contrast records down/up delivery but no click,
visible overlay or expanded ARIA for either widget. The summary's helper
can return successfully while `opened=false`; the compact capture only
shows later school opening. Visible degree opening remains unproven.
The CLEAN report records one successful school opening/closing followed
by `non_get_request` and nine propagated field failures. Those materials
guide the checklist; they supply no passing observations for a new run.

## Prepare offline, then run once during daytime

Run from the repository root with Node available. Preparation performs
local Git/file operations only and does not contact CDP:

```powershell
./scripts/run-cms-education-daytime.ps1 `
  -OutDir ./_temp-scripts/cms-daytime-review-r1
```

The equivalent Node command is:

```powershell
node scripts/cms-education-daytime-harness.mjs --prepare `
  --reviewed-ref 392dbe0b6bf1234be47b2d516ab37ef8ee7e353d `
  --out ./_temp-scripts/cms-daytime-review-r1
```

Preparation creates `checklist.json`, a non-collected
`collector-status.json`, and `reviewed-manifest.candidate.json`. The candidate
has `schemaVersion:1`, `approved:false`, `tipSha`,
`source:"review-checkout-exact-bytes"`, `neverSave:true`,
`liveSupportClaimed:false`, and `files` rows containing `path`,
`reviewedSha256`, and supplemental `reviewedBlobSha256`.

Prepare first verifies that the reviewed checkout's listed files match the
pinned Git ref, then hashes their exact on-disk bytes for `reviewedSha256`.
`reviewedBlobSha256` separately retains the Git-blob hash. The two hashes
can differ with a Windows CRLF checkout; collection never normalizes
newlines to make byte mismatches pass. Run preparation in the separately
reviewed source checkout, not on an unreviewed deployment to approve itself.
A Git ref and its hashes do not themselves establish review approval.
Independently review the expected source bytes and collector, retain the
review, copy the candidate to a separate private
`reviewed-manifest.approved.json`, and mark that copy `approved:true` only
after review. The harness never approves it or copies files into the
deployed machine root. This R1 collection is pinned to the base SHA above.

During an independently authorized daytime window, the operator supplies
an already-open, logged-in baseline CMS resume tab on the real machine.
Its widget originals must equal the shipped fixture values. One collect
invocation runs the existing CONTROLS=1 Never-Save trial and collects its
attachments:

```powershell
./scripts/run-cms-education-daytime.ps1 -Collect -NeverSave `
  -ApprovedManifest ./_temp-scripts/reviewed-manifest.approved.json `
  -MachineRoot 'C:\path\to\reviewed-deployed-repo' `
  -OutDir ./_temp-scripts/cms-daytime-run-r1 `
  -Port 9242 -RowIndex 0
```

The equivalent Node command is:

```powershell
node scripts/cms-education-daytime-harness.mjs --collect --never-save `
  --approved-manifest ./_temp-scripts/reviewed-manifest.approved.json `
  --machine-root 'C:\path\to\reviewed-deployed-repo' `
  --out ./_temp-scripts/cms-daytime-run-r1 --port 9242 --row-index 0
```

Use a new output directory for every invocation. Existing artifacts are
not overwritten, repaired or deleted. `-MachineRoot` supplies the actual
deployed source bytes to compare against the independently approved
digests. Approval, the pinned ref, reviewed paths, exact machine-byte
matches and matching reviewed-file bytes in the host running the collector
are checked before browser attachment. A mismatch stops collection;
the harness does not synchronize files. No automatic login, launch, reload,
retry or follow-up fill occurs. The standalone runner's environment examples
are not the collection entry point for these attachments.
The approval and source-byte checks run again after the trial; changed or
unavailable bytes or invalidated approval force incomplete collection.

## Artifacts and R8 leftover mapping

`checklist.json` retains the same seven requirements in machine-readable
form. Every report field below is read from the unchanged
`cms-education-live.json` or its identical `evidence-pack.json.report`.
`evidence-pack.json` retains `schemaVersion:1`, `neverSave:true` and
`liveSupportClaimed:false`. `validation.json` is the existing validator's
six-check result; it does not authenticate the observations.

`collector-start.json` records the actual collector/capture-helper hashes,
start time, approved tip and `snapshotEncoding:"cms-daytime-tagged-v1"`.
`prepare.json`, `readbacks.json` and `cleanup.json` immediately retain the
actual prepare, run and cleanup replies; `observations.json` retains those
same observations, before/after captures, step metadata and capture errors.

| R8 leftover | Retained files and expected fields | Pass/fail predicate and live limitation |
| --- | --- | --- |
| Bytes; clean page | `reviewed-bytes.json` and `evidence-pack.json.reviewedBytes`: `tipSha`, one `{path, reviewedSha256, machineSha256}` per existing `REVIEWED_FILES` path. `snapshots-before.json.boundary` and `evidence-pack.json.boundaries.before`: `hasCmsLive`, `overlays`, `bodyClickReached`, twelve `hooks` entries. | Approved expected digests must equal separately read actual bytes. Before boundary requires absent trial API, zero visible overlays, delivered body click and native-form hook sources with captured owning descriptor attributes. Review approval and the real clean/native page remain operator observations. |
| Seven visible probes | Report `finalDetails.widgetProbes` and `widgetClickCount`; actual `observations.json` run/cleanup results. Keys: `school`, **`degree`**, `academicDegree`, `startDate`, `endDate`, `region`, `gradeRank`. | Exactly one result per key: `opened:true`, `closed:true`, `openerClicks:1`, `reason:null`; activation `stage:"complete"`, `reason:null`, and both `events`/`observedEvents` exactly `["mousedown","mouseup","click"]`. Total widget clicks may include allowed outside cleanup. Focus, helper success or hidden options cannot replace a visible owned degree opening. |
| Suppression; traffic; clicks | Report `suppressedAutosave`, `suppressedLookup`, `nonGet`, `saveLikePost`; `finalDetails.clickCount`, `bannedClick`; actual run/cleanup ledgers in `observations.json`. | Existing endpoint/method/phase/ownership/before-send predicates must pass; retained suppression logs are capped at 80 rows each. Explicit `nonGet:[]`, `saveLikePost:[]`, `clickCount:0`, `bannedClick:false` are required. Empty suppression arrays mean no retained attempt, not proof of exercised suppression. Actual scheduling/ownership and abort delivery still need live inspection. |
| Nine readbacks | Report `fields`, `finalDetails.waitedMs`; `observations.json` prepare/run results; `snapshots-before.json.snapshots` for raw originals; `collector-status.json.actualTrialMatches`. Fields are `major`, `description` and the seven controls above, with row-adjusted shipped paths. | All nine report rows must be exact shipped-fixture values with `status:"verified"` and `reason:"readback_matched"`; actual run readbacks independently require the same nine paths, exact values, `ok:true`, `reason:"readback_matched"`, and at least `READBACK_WAIT_MS` (500 ms). Prepare identity/counts and actual run row/count/restoration flags must match. Controls preflight requires exact fixture originals and does not establish changed-widget writes. A prior CLEAN failure supplies no independent successful readbacks. |
| Restoration; neighbors | `snapshots-before.json.snapshots` and `snapshots-after.json.snapshots`: separate `dom`, `publicProps`, `dto`, `neighbors`; supplemental before/after `rawDom.educationOuterHTML` and `rawDom.neighborOuterHTML`; `evidence-pack.json.restoration.before/after`: `domSha256`, `publicPropsSha256`, `dtoSha256`, `neighborsSha256`; `collector-status.json.rawDomCaptured/rawDomEqual`. Report `restored`, `pageLeftAsFound`, `otherChanged`. | Independently collected before/after defined form-state snapshots must produce equal digest pairs; report requires `restored:true`, `pageLeftAsFound:true`, `otherChanged:false`. Snapshot encoding preserves raw types, whitespace, absent/undefined, empty values and array holes. Both raw-markup captures must also be present and exactly equal, including transient attributes outside those digests. Hashes of readbacks or success flags are insufficient. Actual snapshot coverage and source values need inspection. |
| Settled callbacks | Report `finalDetails.timerSettle`; actual run/cleanup `timerSettle` in `observations.json`; `collector-status.json.actualTrialMatches`. | Explicit nonnegative safe integers for `pendingTimers`, `unobservableTimers`, `observedNonFunctionTimeouts`; first two must be zero. Captured cleanup counts must also equal the report counts. Positive completed observed non-function timeouts are allowed. This is bounded settlement, not evidence about arbitrary future callbacks. |
| Cleanup | `snapshots-after.json.boundary`, `evidence-pack.json.boundaries.after`; supplemental after `identity` observations and `collector-status.json`; actual cleanup result in `observations.json`; report `cleanupOk`. | Cleanup must succeed, API must be absent, visible overlays zero, body click delivered, and all twelve native-hook source/owner/descriptor values match before. Same-session supplemental identity checks must also show restored hook and injected-global descriptors/values. Those identity checks remain outside schema version 1; missing capture or failed equality prevents a complete collector verdict. |

For each hook, the retained boundary records
`{source, ownerDepth, configurable, enumerable, writable}` at the first
owning property. The twelve names remain the existing `HOOK_NAMES`:
`fetch`, `click`, `submit`, `requestSubmit`, `XHR.open`, `XHR.send`,
`XHR.abort`, `setTimeout`, `clearTimeout`, `setInterval`, `clearInterval`,
`sendBeacon`. The supplemental identity comparison keeps original object
references in a CDP-held closure for the same session; it adds no page
global. Function-source strings alone do not establish identity.

The DOM digest covers all value-bearing controls in every education row
and field recognized by the shipped serialization reader. Other education
rows are retained there and in public props/DTO; `neighbors` additionally
captures value-bearing controls outside the education section. Each DOM
control retains its raw value/text, stable attributes and applicable
checked/default/selected/disabled/read-only/option state. Transient class,
style, tab index and open-state ARIA attributes are excluded explicitly
from the deterministic value-state hashes; overlay state has its own
boundary observation. The supplemental `rawDom` retains the complete
education section `outerHTML` and every outside neighbor control's
`outerHTML`, including those omitted attributes. The collector additionally
requires those captured strings/arrays to match exactly before/after;
reviewers can inspect the complete retained markup. Current values that HTML
attributes do not reflect remain explicit
in the typed control snapshots. The four hashes compare defined form state;
they do not claim full-document markup equality. Public props retain all
seven inputs used by the shipped serialization reader, without invoking
its component handlers. Unsupported accessors, symbols, cycles or non-data
objects fail capture instead of being silently omitted.

`bodyClickReached` records a synthetic body-targeted event reaching a
temporary document capture listener using checked native event primitives.
The listener prevents default and stops propagation before body/site
handlers. It is bounded guard-delivery evidence, not a trusted mouse click
or evidence that an application handler executed. Snapshot equality is
checked across that probe; a changed value or blocked event fails capture.

Collection arms the runner's Network/Fetch protection before the before
snapshot and before `install_live`. Prepare, run and cleanup replies are
retained as actual observations with step metadata. After observations
are captured immediately after cleanup on that session, while the runner
still owns its protection. A missing or failed observation remains missing
or failed; no passing value is synthesized.

Snapshot digests use the same deterministic typed JSON encoding on the
independently collected before and after `snapshots` values. Boundary
metadata, timestamps, hook source text and supplemental identity diagnostics
are not folded into the four restoration digests. Supplemental `rawDom` is
also outside those four hashes, with its own exact-equality gate. Review its
before/after markup directly alongside the encoded value state. Missing
markup or any raw difference makes collection incomplete even if
`schemaComplete:true`. A benign transient class/style/ARIA difference can
therefore stop this conservative collector; retain and inspect it. There
is no normalization, repair, dropped difference or override to force a pass.
Raw capture files are retained so a reviewer can inspect what each check covers.

`collector-status.json` records the exit status, schema completeness,
capture availability/errors, `actualTrialMatches`, `rawDomCaptured`,
`rawDomEqual` and supplemental cleanup identity result.
It always requires review (`reviewRequired:true`); `suppressionExercised`
only reports whether each retained ledger is nonempty and does not attest
request timing. Inspect it
alongside `validation.json`: a schema-complete pack alone does not establish
complete collection. A failed run retains the failure and available artifacts;
it receives no automatic recovery trial. The default private location is
the ignored `_temp-scripts` directory. Raw snapshots and run replies may
contain applicant values: keep them private, do not commit them, and use
the collector's status summary rather than dumping raw JSON to the console.
Collection exit 0 requires the existing validator, all five captures,
same-context hook/global identity equality, `actualTrialMatches:true`,
`rawDomCaptured:true`, `rawDomEqual:true` and
no collector errors, including repeated approval/byte checks. The actual
cleanup must succeed with explicit empty posts/clicks and timer counts
matching the report; schema-complete summary flags cannot supply missing
run observations. Exit 1
or 3 preserves those existing runner failure classes; other incomplete
collection exits 2. Prepare exit 0 means preparation only, with
`collected:false` and `complete:false`.

## Scope and verification

No live CONTROLS=1 collection is performed for this offline R1 delivery.
All seven rows remain live daytime obligations until an authorized real
trial produces and independently reviews the actual observations. The
second city menu, opened calendar year/month chooser panels, differing
widget originals, changed-widget writes, previously captured APIs, workers,
future responses and arbitrary future callbacks remain outside this trial.
No paid CITICS, beisen, feishu or moka product path, companion CA, or release
acceptance claim is part of this harness. Never-Save;
`liveSupportClaimed=false`.

The ten unchanged CMS education test files passed **235/235**, zero
failures/skips, with `--test-concurrency=3`. The two added offline harness
and capture test files then passed **40/40**, zero failures/skips. These
are disjoint runs covering **275 unique tests**, not a claim of one combined
275-test invocation. Product code, the live runner and the schema validator
remained unchanged throughout the runs.

The added tests cover approval and independent-byte refusals, default
offline execution, no overwrite, typed raw distinctions, full markup,
same-source identity replacements, actual readback failures, same-session
ordering, and shipped-runner teardown through fake CDP. The default
PowerShell preparation entry point also ran successfully offline and left
only an unapproved candidate. The supplied CLEAN report and three overlay
JSONs still fail completeness without any observation attachments; their
report diagnostics remain **3 / 2 / 2 / 2**. JavaScript syntax, PowerShell
parser and staged diff checks pass. The existing Node module-type warning
is unchanged. No passing live evidence pack is retained or claimed.

```powershell
$existingCmsTests = @(Get-ChildItem tests/cms-education*.test.mjs -File |
  Where-Object { $_.Name -notmatch 'daytime-harness|daytime-capture' } |
  ForEach-Object { $_.FullName })
node --test --test-concurrency=3 @existingCmsTests
node --test --test-concurrency=2 tests/cms-education-daytime-harness.test.mjs tests/cms-education-daytime-capture.test.mjs
node --check scripts/cms-education-daytime-harness.mjs
node --check scripts/lib/cms-education-daytime-capture.mjs
node --check tests/cms-education-daytime-harness.test.mjs
node --check tests/cms-education-daytime-capture.test.mjs
git diff --cached --check
```

Only the six additive harness, capture, launcher, test and runbook files
belong to this change. The existing test-generated review report was
restored and excluded; no existing file is deleted.
