# CMS row D Never-Save probe

Original runner baseline: `53791dfe6da2a6ae2b627b8e9b945ca0d411fefc` (`codex/cms-row-d-live-never-save-r1`).

Side-effect R2 starts at `c32f2fda429f8f32ab318e9fdf0c2fe69f52a386` on
`codex/cms-row-d-probe-side-effect-r2`. The real-page handover reported
`inspection_exception` with `probeCompleted=false`, rather than a login wall.
R2 passed isolated fixtures, but the subsequent real-page re-probe still failed.
Neither isolated checks nor a completed inspection establish a complete
preflight or live fill support.

R3 starts at `2bc7d9e289c5ba1c775decf831fc84dd6d3d40df`, after the
parent's real CMS re-probe still returned `inspection_exception`. A guarded,
read-only diagnostic narrowed that failure to the page's `String.trim` path:
even trimming a constant was rejected. The serialized helpers now trim with a
fresh whitespace RegExp per call, including option requests and ARIA tokens.
Collection snapshots use indexed reads rather than page-owned iterators; ID,
type and disabled checks use attributes rather than element IDL overrides.
See [R3 validation notes](../../tests/cms-row-d-probe-side-effect-r3-notes.md).

R4 starts at `38d19f749cff17ed311268924f63c9e9444029f8`, after the parent's
real CMS VIS evidence completed guarded evaluation but observed only 1/16
fields. Without a separate retained visibility keeper the official runner
returned `page_hidden`. The runner now owns that keeper: after enabling both
network guards it calls `Target.activateTarget`, `Page.bringToFront` and
`Emulation.setFocusEmulationEnabled(true)` on its retained CDP session. The
session and focus override remain active through guarded evaluation and the
settlement window. These commands activate the browser page; the inspector
still performs no DOM focus call or form interaction.

R5 starts at `7e8a9e9bb1ad3f54c135f6b00b64fbb51ceda7e9`. The supplied R2
live report completed inspection with 12/16 observed fields, then R4's final
traffic verdict replaced its reason after an acknowledged info/edit block.
R5 preserves the inspection verdict for the narrowly correlated keeper blocks
described below. It makes no new live observation or field-support claim.

R6 starts at `723bee7b368ce8cfab07277aedec603301c24e4c`. R5's positive
fixtures used the normalized short path as the raw request URL. Recorded CMS
traffic instead uses `/wecruit/resume/info/edit/<baseline tenant>`, so its
exact-path eligibility could never recognize that recorded endpoint. R6 derives
the exact tenant endpoint from `ROW_D_PAGE`; it does not accept the normalized
short path or arbitrary suffix matches. Full request correlation is still
mandatory. The supplied R5 report hides IDs and raw paths, so this identifies
a classifier defect without proving every cause of that particular run.
See [R6 validation notes](../../tests/cms-row-d-keeper-nongget-r6-notes.md).

R7 starts at `8abbdc20dc1b79bfb52d4378f62a4f2023943ef0`. A separately
reviewed guarded read-only capture enumerated 32 unique owned static research
labels and matched the previous 25-label prefix. The research dictionary now
uses exactly those 32 labels in order; current ownership, cardinality and order
must still match. This is dictionary/preflight work only. The earlier 12/16
live result remains historical; a hypothetical 13/16 offline result requires a
new official probe before it can be described as live evidence.
See [R7 validation notes](../../tests/cms-row-d-research-dictionary-r7-notes.md).

R8 starts at `3c5c9d08c78ce0ffc522e69398f815188bbdaaeb`. A later
parent-run location diagnostic stopped before inspection even though cleanup's
final ledger contained a fully correlated keeper block. A partial Network/Fetch
pair or pending block acknowledgment can temporarily fail a keeper checkpoint.
R8 waits only for eligible pending proof while guards and the keeper remain
active, then requires the unchanged complete correlation verdict before any
inspection. See [R8 validation notes](../../tests/cms-row-d-keeper-settlement-r8-notes.md).

Keeper non-GET R7 (2026-10-30) starts at
`23c0ce54b759aa1fc42516ecaf7c851bd63e785c`, which already includes the
research R7 and settlement R8 changes above. CDP makes Fetch `networkId`
optional; the previous guard rejected its absence permanently. This revision
allows one narrowly bounded identity-based pairing when that field is absent,
without accepting explicit ID disagreements or aggregate counts as proof.
The sanitized historical report cannot establish whether its IDs were absent.
See [keeper R7 notes](../../tests/cms-row-d-keeper-nongget-r7-notes.md).

The options-readiness revision starts at `0ca0acc2`. The supplied official
probe completed with 2/16 fields, eleven `current_options_unavailable` skips,
and zero observed/intercepted/blocked non-GET requests. That evidence points
to absent current lists rather than another keeper-correlation failure. The
runner now permits bounded passive re-inspection, and the inspector can use
separately identified current Select option definitions when their ownership
is proven. Installed Ant Design Vue 1.7.8 source and mounted offline components
show lazy menu creation; this does not establish the real CMS component shape
or prove that waiting alone can populate a dormant portal.

`cms-row-d-live.mjs` attaches to an existing CMS resume tab and runs the merged offline options resolver and read-only ownership preflight. This is a probe, not a fill adapter. It never opens a popup, clicks an option or 保存/提交, emits input events, or reads current field values. No originals require restoration because the probe performs no form interactions or value mutations.

Every result keeps `neverSave=true`, `liveSupportClaimed=false`, `livePassClaimed=false`, `writeStarted=false`, `mutationAllowed=false`, `valuesExposed=false`, and `probeOnly=true`. A successful preflight does not grant mutation permission or establish live fill support. Education is outside this probe's scope.

The commandFailed / Fetch revision starts at `05d54285` (#221). Inspection
timeouts now retain the guarded session for bounded focus cleanup; they remain
inspection failures, and late replies cannot authorize another sample. Fetch
decisions are deduplicated by interception ID without relaxing correlation or
non-GET blocking. Searchable single-select definitions use the same verified
read-only ownership path; loading stays unavailable. Fixed diagnostics separate
inspection, command and option-proof failures without exposing private data.
See [evidence and validation notes](../../tests/cms-row-d-commandfailed-fetch-r1-notes.md).

The root-anchor revision starts at `c149f940` (#222). Its supplied real probe
has eleven `root_anchor_missing` selects and an inspection retry timeout,
with no non-GET traffic or command failure. PRIMARY is options ownership and
inspection readiness. If a select's own Vue anchor is absent, the inspector
can recover its exact current component through a verified ancestor render
tree inside the same form item. It still requires current root/component/ARIA
and option-definition links; ancestor caches, slots and harvested labels alone
cannot establish current options. No popup is opened. Passive retries reserve
enough time for a complete strict sample; an exhausted readiness budget keeps
the latest incomplete snapshot, while actual command failures remain failures.
See [root-anchor notes](../../tests/cms-row-d-options-root-anchor-r1-notes.md).

## Run

From the repository root in PowerShell:

```powershell
node scripts/live/cms-row-d-live.mjs --help
$env:PORT = '9242'
$env:OUTDIR = Join-Path (Get-Location) '_temp-scripts\cms-row-d-live-never-save'
node scripts/live/cms-row-d-live.mjs
```

`PORT` defaults to `9242`. `OUTDIR` defaults to the repository's `_temp-scripts/cms-row-d-live-never-save` directory. Keep all request files and generated evidence under `_temp-scripts`.

`STEP_TIMEOUT_MS` defaults to `10000` (`1000..30000`). `OPTIONS_WAIT_MS`
defaults to `2000` (`0..5000`), and `OPTIONS_POLL_MS` defaults to `100`
(`25..500`). Setting the wait budget to `0` retains one inspection. Waiting
repeats the same guarded expression on the host; it installs no page timer,
observer, promise, event handler or control interaction.

Optionally set `REQUESTS_FILE` to a JSON file under `_temp-scripts`. The object maps exact allowlisted wrapper IDs to literal harvested option labels; the industry checkbox field accepts an array of those labels. For example:

```json
{
  "13_47_0": "11-20万",
  "13_102501_0": ["宏观", "策略", "债券"]
}
```

Requests only exercise dictionary resolution and ownership checks; they never request a write. Unknown labels are rejected. Do not infer additional labels or location options from geography.

## Safety and evidence

Both `Network.enable` and CDP `Fetch.enable` must succeed before the page probe runs. Requests paused by Fetch are continued only for GET; every other method is rejected. Evidence identifies the normalized `/resume/info/edit` endpoint and uses a safe category for other endpoints; it never reads request or response bodies or current field values. Every observed attempt remains recorded even when blocked.

Only a POST to the exact CMS-origin `/wecruit/resume/info/edit/<baseline tenant>`
path derived from `ROW_D_PAGE` can preserve the inspection verdict: its Network
observation and request-stage Fetch pause must both occur
during the fully guarded keeper lifetime and have an acknowledged
`Fetch.failRequest`. If Fetch supplies `networkId`, it must match the valid
`Network.requestId` one-to-one, alongside a unique valid `Fetch.requestId`.
If Fetch omits `networkId`, exactly one Network non-GET observation and one
Fetch non-GET pause across the entire lifetime may pair by matching method
and full URL identity. This is identity inference by exclusion, not CDP-ID
proof. Both observations must independently qualify for the exact endpoint
and keeper lifetime. A second non-GET permanently rejects this fallback,
even if its URL matches or the first checkpoint already passed. An absent
Network observation/ID, invalid or unequal supplied IDs, missing Fetch ID,
or unmatched identity still fails. Method and URL identity must agree; a
URL hash stays internal and is never emitted. Timing describes observation
during the keeper; it does not prove which command caused the request.
Missing, duplicate or conflicting correlation, unblocked non-GET, other
methods/origins/paths, response evidence, guard command failure or truncated
tracking still hard-fails with `non_get_or_guard_failure`. Equal aggregate
observed/blocked counts are insufficient. The normalized `/resume/info/edit`
label is only a redaction category; it cannot authorize a request. Other tenants,
path prefixes/suffixes, encoding/case variants, credentials and fragments are
ineligible. Query identity must agree across both observations; query values are
never emitted.

`traffic.keeperAssessment` records a fixed status (`no_non_get`,
`correlated_keeper_blocks`, or `rejected`) and fixed rejection reason enums.
These diagnose endpoint, lifetime, identity, matching, block-acknowledgment,
response or guard failures without exposing request IDs, raw URLs, query values,
bodies or hashes. Optional-ID pairing additionally emits the fixed
`correlationMode=unique_identity_missing_fetch_network_id`, including on
rejection, so it is distinguishable from ID-proven correlation. The assessment
is descriptive and supplies no authority to
bypass the ledger. A correlated block preserves an incomplete inspection; it
cannot upgrade fields, prove server-write isolation or book D.

The guards also cover browser activation and focus emulation. After each keeper command, and again immediately before inspection, the runner
rejects permanent failures and may settle only valid, eligible missing pairs or
pending guard decisions. Optional-ID pairing may settle in either event order;
the abort is immediate and its acknowledgment follows the same ledger entry.
One 250 ms authorization deadline is shared across all
these checkpoints; events never renew it. At most ten timer ticks and 200 event
wakeups are allowed. A Fetch pause is aborted immediately, without waiting for
its Network counterpart. The original terminal `failed()` predicate must be
false and all decision replies settled before inspection begins. Invalid IDs
(as distinct from the narrowly allowed absent Fetch `networkId`),
duplicate/conflicting identities, other endpoints/methods/origins, outside-keeper
traffic, responses/redirects, command failure and truncation cannot wait their
way into eligibility. Unmatched or unacknowledged traffic at expiry stops.

`inspectionGate` retains fixed checkpoint/status/pending enums, initial/final
redacted assessments, and bounded wait/wakeup counts. Expiry is sticky; a later
complete cleanup ledger cannot reopen inspection. The final keeper assessment
can therefore be correlated while the early gate remains blocked. Timer
scheduling delays do not extend the authorization deadline. This is a budget
for pending-proof settlement, not a 250 ms bound on the whole probe: CDP command
timeouts and existing cleanup/drain waits remain separate. The keeper lifetime
includes evaluation and settlement. The override is cleared in `finally` while the guards remain active,
then a bounded 250 ms monitoring window covers delayed focus/blur handlers and
pending request decisions are drained before disabling Fetch and Network and
closing the session. This window also runs after an early stop or rejected
reset; a failed monitoring wait still fails cleanup and permits guard teardown.
The exception closes before guard teardown starts. A non-GET first appearing
during either disable command fails even if subsequently blocked.
It does not isolate arbitrary page activity after the session ends. Keeper setup or cleanup failures fail the
result without exposing remote exception strings. `visibilityKeeper` records
only boolean command acknowledgments; an enabled acknowledgment describes the
inspection window, while `focusEmulationCleared` records teardown. Neither proves
rendered control visibility or a complete preflight. An external keeper session
is no longer required by the runner.

Optional row diagnostics retain only bounded counts, booleans and fixed reason
enums: hidden internal-search inputs, observed option count and sample-prefix
agreement, calendar structure, and availability/control-kind issues. The runner
validates their field kind and reason before copying them into evidence. Counts
and matching samples do not make a partial dictionary complete. A sample-match
boolean must include a count, and a matching prefix requires at least the known
sample size. Observed
calendar structure does not establish calendar behavior. Arbitrary Runtime
metadata and current values are discarded.

Per-select `optionsReadiness` distinguishes `target_missing`, `list_empty`,
and `observed` DOM option nodes. After current labels have been enumerated,
`optionsEvidenceSource` records either `aria_controls_dom` or
`owned_select_vnodes`. The latter is a separate evidence source: a missing or
empty DOM list remains recorded even when current component definitions match
the dictionary. Neither source exposes labels or current selected values.

The component path accepts only a bounded, exact-root Ant Select render chain
whose current SelectTrigger matches the unique current `aria-controls`
reference. It reads own data descriptors from current option VNodes, rejecting
accessors, unsupported modes, custom/rich labels, disabled options, incomplete
links and retained selected-option caches. It never calls Vue render methods
or reactive getters. Exact current label order/cardinality and the existing
dictionary-completeness rules still apply. An unknown component shape remains
`current_options_unavailable`; no offline dictionary substitutes for current
owned option evidence.

The host retries only a loading same-page document or sanitized
`current_options_unavailable` select rows. Each sample retains
`throwOnSideEffect=true`, `awaitPromise=false`, and `userGesture=false`, with
the remaining monotonic budget bounding both evaluation and transport timeout.
One deadline and a finite round cap apply across the wait; neither traffic nor
a new sample renews them. The deadline is checked after waiting and after a
reply. Every clean sample replaces the entire previous inspection, so earlier
passing rows cannot conceal later drift. Navigation, hidden-page results, new
label/control/ownership/availability failures and evaluation errors stop
further reads. Known location/calendar gaps do not become option-readiness
failures, and an exhausted wait retains the latest actual incomplete rows.

Top-level `optionsReadiness` contains only a fixed status and host counts:
`attempts`, `waitRounds`, `initialUnavailableCount`, and
`finalUnavailableCount`. Statuses are `not_reached`, `not_needed`, `ready`,
`timed_out`, `stopped`, `guard_blocked`, or `inspection_failed`; `ready`
describes the readiness wait and does not promote the overall preflight.
Unresolved traffic or any pending guard command stops additional reads
immediately. The existing final strict traffic ledger still determines whether
a later acknowledged qualifying keeper block preserves the latest inspection;
unsafe or unresolved traffic, responses and command failures still override it.
Readiness introduces no keeper-settlement renewal or non-GET exception.

Availability distinguishes the select host/combobox from one disabled-checked
internal `.ant-select-search__field` inside its owned `.ant-select-search`.
That specific helper may be hidden while the host remains attribute-visible;
generic hidden inputs, hidden hosts, disabled/inert controls and explicit
collapsed ancestors still fail. This is a synthetic regression of a plausible
VIS failure mode, not a claim that descendant markup was captured on CMS.
Location kind mismatches now identify conflicting pickers, extra interactive
controls, or input kind/ownership issues without whitelisting an unevidenced
hybrid. Research now requires all 32 captured labels in exact order and reports
only the observed count. Sample-prefix metadata is reserved for dictionaries
that remain partial. The calendar must pass
section, wrapper, label, control and availability checks before reporting its
structure; it remains `calendar_live_evidence_missing`.

`observedNonGetCount` counts Network observations, while `blockedNonGetCount` counts acknowledged Fetch block commands. These can refer to the same request. `requestWillBeSent` alone does not prove that a request reached the server. Response evidence (including redirects, extra response metadata, received data and successful completion) is retained even if it precedes request correlation or follows `loadingFailed`. It records at most one response-evidence count per tracked non-GET; a later redirected GET response is not counted against the prior POST. Any `responseToNonGetCount>0` hard-fails. Interception cannot retroactively cancel requests already in flight; a late block failure during teardown also fails the result. This is no server-write isolation claim. The probe induces no form interaction. It drains known request decisions before disabling its CDP domains and closing the session; no page hooks need removal.

Evaluation also requires CDP `throwOnSideEffect=true`. A rejected evaluation stops without a less restrictive retry. This guard's behavior on the real page remains for the parent's CDP verification.

The page expression avoids URL construction, `Element.matches`,
`Element.closest`, computed style and geometry calls. Exact page identity uses
the browser-normalized location string with its query/fragment removed, so
credentials, a different tenant, host, port or path are still rejected. Selector
membership uses `querySelectorAll` snapshots, and ancestor ownership uses
`parentElement`. Result metadata is copied into fresh local objects without
object spread or `Object.assign`, which V8's debug evaluator can also reject.
The option-label collection is a constant local array: reassigning a binding
captured by callbacks also caused V8 to reject the inspector's bytecode before
even an early return could complete.

`visibilityBasis=attributes_only` is retained in the evidence. Hidden/inert/ARIA
attributes and explicit inline hiding are checked on ancestors. Stylesheet-only
hiding, CSS escapes/variables, clipping and layout visibility are unverified.
An observed row is a structural dictionary/ownership observation; it does not
prove that a control is visibly available for interaction.

An earlier location-one open produced an `info/edit` POST while its displayed value stayed unchanged. The later harvest avoided location opens and observed no such POST. Its Escape/blur attempts did not establish popup closure. This probe therefore performs no popup opening or blur operation.

Location-one has only 25 serialized labels from a 30-option list. Location-two has no independent options evidence. The industry dictionary now has a complete 32-label guarded capture; English calendar behavior remains unevidenced. Both locations and the calendar remain skipped. Current option ownership must come from a unique current `aria-controls` association and either its verified DOM list or the exact-root component definitions described above; a global visible dropdown or a harvested UUID cannot substitute for ownership.

After the parent re-runs guarded CDP, the page may still return
`row_d_preflight_incomplete`, including `control_not_available`,
`control_kind_mismatch`, incomplete dictionaries and missing calendar evidence.
R4 improves structural observation and includes its visibility keeper; full
16/16 preflight is not required. No preflight PASS or live PASS is claimed.

One R4 guarded structural diagnostic on 9242 stopped before evaluation when the
page attempted a POST to `/resume/info/edit` during keeper setup. It observed,
intercepted and acknowledged blocking one request, with no non-GET response
observed. The exact triggering command was not recorded. No further live
diagnosis was attempted; this is not zero-traffic evidence or an official R4
field result. See [R4 notes](../../tests/cms-row-d-preflight-r4-notes.md).

Exit `0` means complete preflight. Exit `2` means incomplete, blocked, or error; a completed probe can still be incomplete because of these intentional skips. Inspect the result reasons rather than treating execution alone as a pass.

No live PASS, live fill/support, or site support is claimed by this probe. The parent must re-probe 9242 with the new tip. Booked stays **58** (E included, D unbooked); this work does not book **+12**. Historical reports above retain their original booked count of 53.

## Offline validation

```powershell
node --test tests/cms-row-d-options.test.mjs tests/cms-row-d-probe-expression.test.mjs tests/cms-row-d-debug-evaluate.test.mjs tests/cms-row-d-live.test.mjs tests/cms-row-d-live-cdp.test.mjs
node --test tests/cms-basic-info-row-c-probe.test.mjs tests/cms-basic-info-gaps.test.mjs tests/cms-basic-info-live.test.mjs
```

The first command covers resolver/serialization parity, zero current-value reads or form interactions, guard failures and teardown, target/output confinement, redaction, and an actual HTTP/WebSocket transport against a local fake CDP server. R5 adds request-level keeper block correlation, event ordering, response and redirect rejection, and teardown boundaries while preserving the modeled incomplete 12/16 inspection. See [R5 notes](../../tests/cms-row-d-keeper-nongget-r5-notes.md). It also runs the serialized expression through `node:inspector` with V8's real `throwOnSideEffect=true`, using a synthetic tree with pure selector reads. The V8 test does not substitute for Blink's DOM API checks or a real-page re-run. All DOMs and CDP servers in these tests are synthetic; no live browser session is used. See [R2 validation notes](../../tests/cms-row-d-probe-side-effect-r2-notes.md) for the isolated Edge fixture check.

R3 adds shared-RegExp trim shims, stateful NodeList/Array iterators and element
IDL accessor regressions. Each hostile fixture first proves that V8 rejects the
reference operation, then requires the serialized inspection to complete.
Offline green does not establish a live PASS: the parent must re-run the official
guarded probe on visible CMS at CDP 9242, and preflight may still be incomplete.

API rationale: Blink's [Element IDL](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/core/dom/element.idl)
does not annotate `matches`, `closest`, or `getClientRects` with `Affects=Nothing`;
[ParentNode IDL](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/core/dom/parent_node.idl)
does annotate selector queries. CDP's [Runtime.evaluate contract](https://chromedevtools.github.io/devtools-protocol/v8/Runtime/#method-evaluate)
rejects evaluation when side effects cannot be ruled out.
