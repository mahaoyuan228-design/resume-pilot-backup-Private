# CMS Row D options preflight R1

Date: 2026-10-30. Base: `0ca0acc2df32d1e53e8f376cabbb050b2183514f`
(keeper R7, #220; embedded runner base `23c0ce54`).
Branch: `codex/cms-row-d-options-preflight-r1`.
PR target: `cursor/expand-night-ats-f861`.

PRIMARY is `current_options_unavailable`. This revision does not change
keeper preservation, `failed()`, request correlation, or the network ledger.
`neverSave=true`, `probeOnly=true`; `writeStarted`, `mutationAllowed`,
`valuesExposed`, `liveSupportClaimed`, and `livePassClaimed` remain false.
Booked remains **58**, D unbooked. No live CMS probe, PASS_PREFLIGHT, support,
fill, save, dropdown/calendar interaction, or D+12 booking is claimed.

## Supplied evidence

The Windows handover files were read from the parent `_temp-scripts`
directory, using UTF-8, rather than treating their `/workspace/handover`
references as local paths:

- `CMS_ROW_D_NEXT_KNIFE_CODEX_FEED_2026-10-30.md`.
- `REAL_USE_CMS_ROW_D_PROBE_0ca0acc2_2026-10-30.md` and
  `real-use-cms-row-d-0ca0acc2/{RESULT.json,cms-row-d-live.json}`.
- `CMS_ROW_D_R7_LIVE_ACCEPTANCE_CHECKLIST_2026-10-30.md` and
  `GITHUB_ROUGH_CMS_ROW_D_OPTIONS_2026-10-30.md`.
- The historical `cms-row-d-keeper-nongget-r6-pack` report and JSON.

At `0ca0acc2`, the real probe completed but passed only **2/16** fields:
`locationAllocation` and `researchInterests`. Eleven selects reported
`current_options_unavailable`, both locations reported `select_not_unique`,
and the English date reported `calendar_live_evidence_missing`. Non-GET and
info/edit counters were all zero. This establishes missing current options,
not an XHR timing diagnosis or a keeper preservation regression.

The historical `723bee7b` result instead retained 12 observed fields and
then ended with `non_get_or_guard_failure`, with one observed/paused/blocked
info/edit POST and no non-GET response. Its historical booked=53 is unchanged.
R7's already-merged keeper work is therefore not this revision's main change.

## Source evidence and inference

The installed, pinned Ant Design Vue **1.7.8** `vc-select/Select` initializes
`_options` empty and only renders filter options while open. A passive wait
cannot force a never-mounted dropdown into existence. This is library source
evidence; the supplied live JSON does not establish the CMS page's component
version, exact component object graph, or whether its lists eventually mount.

The implementation therefore retains the current ARIA-owned DOM list as the
first source, and only attempts a narrowly recognized, currently owned Select
option-definition path when that exact target is absent or its scoped list
is empty. The runtime checks this path; compatible installed-library fixtures
do not substitute for the missing live CMS observation. Unsupported component
shapes continue to report unavailable options.

The component path uses own data descriptors, current element/VNode/component
ownership links, and bounded option text definitions. It invokes no framework
method or getter and does not read current selection, input values, option
encoded values, Vue reactive state, or the potentially stale `_optionsInfo`
cache. Harvest dictionaries are still checked for exact order/cardinality;
their completeness/reuse limits are unchanged.

`evidenceSource` continues to describe historical harvest provenance.
`optionsEvidenceSource` separately identifies current DOM options
(`aria_controls_dom`) or owned component definitions (`owned_select_vnodes`).
Missing-target and empty-list diagnostics remain explicit; observing component
definitions does not claim that a popup is mounted, visible, or safe to open.
Populated malformed, foreign, duplicate, disabled, or mismatching DOM evidence
cannot be bypassed through the component path.

## Passive readiness

The official runner re-evaluates the same expression when the document is
still loading or current select options are unavailable. All samples retain
`throwOnSideEffect:true`, `awaitPromise:false`, and `userGesture:false`.
Waiting happens on the host, with one monotonic deadline and an attempt cap;
no page observer, promise, timer, GET request, dropdown open, focus/blur, or
event is installed to obtain options. The network guards and visibility keeper
remain active throughout. The original traffic guard and cleanup verdicts
remain authoritative.

The location structure tool keeps its existing single-evaluation contract by
passing a zero readiness wait. Its runner/options byte pins are refreshed for
the reviewed dependencies; source verification and the CDP/error pins remain
unchanged.

`OPTIONS_WAIT_MS` defaults to 2000 and is bounded to 0..5000;
`OPTIONS_POLL_MS` defaults to 100 and is bounded to 25..500. A zero wait gives
a single inspection. The host records only fixed readiness enums and bounded
counts. Each successful evaluation replaces the whole inspection snapshot;
earlier passing fields are never merged with later evidence. A deadline cannot
be renewed by progress or traffic, and expiry does not upgrade unavailable
fields. Side-effect exceptions and malformed replies never trigger a weaker
evaluation.

Location peer-select ambiguity and missing live calendar behavior remain
SECONDARY gaps. No label guessing, province/city semantics, invented location
labels, or calendar interaction is introduced.

## Verification and handoff

Baseline on Windows / Node **v24.20.0**: all **821** existing `cms-row-d-*`
tests passed before implementation. All test DOMs, locally mounted components,
loopback transports, and exclusively owned browser profiles are offline
fixtures; none is a new live CMS count.

Final validation on Windows / Node **v24.20.0**: all **14 row-D suites /
880 tests passed**, zero failures, cancellations, or skips (41.37 seconds).
`git diff --check` passed. Reproduce from the repository root:

```powershell
$rowDTests = @(Get-ChildItem tests -Filter 'cms-row-d-*.test.mjs' -File |
  Sort-Object Name | Select-Object -ExpandProperty FullName)
node --test --test-reporter=spec $rowDTests
```

Coverage includes real installed Vue/Ant prop/slot definitions, current render
updates, both missing and empty lists, authoritative populated DOM drift,
unsupported/disabled/rich options, duplicate ownership, sparse/accessor/Proxy
rejection, stale parent links, and private-value tripwires. The full unmodified
serialized inspector also passes native Blink/V8 `throwOnSideEffect:true` in
an exclusively owned offline Chrome profile, with zero mounted dropdowns or
option DOM, two current option definitions, zero value reads/interactions/
writes/network attempts, and a deliberate native DOM mutation rejected.
The fixture HTML and installed assets are fulfilled locally; no user browser
or CMS network is used.

Runner tests cover passive delayed target/list population, exhausted/no-op
waits, whole-snapshot drift, pending guard acknowledgments and failed commands,
new unsafe traffic, strict exceptions, redaction, and actual loopback transport
timeouts bounded by the remaining readiness budget. Existing keeper, trial,
document/URL identity, structure, and network regression suites remain green.
Final review added an exact inverse render-child VNode identity check; its
regression reproduced acceptance of a detached stale link before the fix.

The final ignored log is
`_temp-scripts/cms-row-d-options-preflight-r1-final.log`. Runtime CRLF source
pins retained by the location diagnostic are:

| Dependency | SHA-256 |
|---|---|
| `scripts/live/cms-row-d-live.mjs` | `5c0d9201b4f9c87fde70a55f309bbb39331dea195d9a504ad29acb441e8bca19` |
| `scripts/lib/cms-row-d-options.mjs` | `f4d817279d4d63b60917f3db0806cbe5314a05ed7c1a00106661b9ca30bea0de` |

The parent must merge/sync the actual PR tip and re-run the official Never-Save
probe. Report the new field reasons, current evidence source/readiness, and
traffic. In particular, confirm whether the eleven unavailable selects gain
real evidence. Without that new live evidence, **PASS_PREFLIGHT is not claimed,
D stays unbooked, and booked stays 58**. Any non-GET response, guard/identity
failure, or weakened side-effect boundary remains disqualifying.

Sync the official runner and `scripts/lib/cms-row-d-options.mjs` together; the
supplied narrow `tip-sync-0ca0acc2` bundle omitted the library and is not a
complete source for this revision. Record the actual merged git tip in the
new evidence, independently of the historical embedded base-tip constant.
