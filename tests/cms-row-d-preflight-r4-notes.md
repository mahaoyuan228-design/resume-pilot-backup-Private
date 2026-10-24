# CMS row D preflight R4

Date: 2026-10-24. Base: `38d19f749cff17ed311268924f63c9e9444029f8` (after #199).
Branch: `codex/cms-row-d-preflight-r4`.
Target: `cursor/expand-night-ats-f861`.

`neverSave=true`, `liveSupportClaimed=false`, `livePassClaimed=false`,
`writeStarted=false`, `mutationAllowed=false`, `valuesExposed=false`,
`probeOnly=true`. Booked stays **53**. No D+12, live fill, live PASS, or site
support is claimed. No education changes. No clicks, fills, dropdown opens,
Save/submit, selected-value reads, or page-value mutations were performed.

## Evidence and limits

The supplied `REAL_USE_CMS_ROW_D_PROBE_38d19f74_VIS_2026-10-24.md` and
`cms-row-d-live.json` establish that #199's expression completes on real CMS
with `throwOnSideEffect=true` while an external keeper retains activation and
focus emulation. Its result is **incomplete**, with only locationAllocation
observed: 11 `control_not_available`, two location `control_kind_mismatch`,
one `option_dictionary_incomplete`, and one `calendar_live_evidence_missing`.
The supplied result has zero traffic counters. Without the retained keeper,
the official runner still reports `page_hidden`.

The earlier `cms-row-d-open-harvest-2026-10-24-1445/page-sections-raw.json`
records all 13 selects as enabled with an ARIA dropdown reference. Its collector
prioritizes any `.ant-select` before calendar classification, and does not
capture descendant input/button attributes or HTML. A hidden internal search
input is therefore a plausible failure mechanism, not a confirmed live root
cause. The same evidence does not prove a location picker/select hybrid.

One additional bounded, guarded structural diagnostic attached to 9242. It
enabled Network and Fetch guards before activation/focus setup and stopped
**before Runtime.evaluate** after a page-initiated `/resume/info/edit` POST:

- `observedNonGetCount=1`, `interceptedNonGetCount=1`, `blockedNonGetCount=1`.
- `infoEditObservedCount=1`, `infoEditBlockedCount=1`.
- `responseToNonGetCount=0`, `commandFailed=false`, `truncated=false`.

These counts concern one request; they are not three separate writes. The
exact triggering keeper command was not recorded. No field structure or values
were returned, no further live diagnostic was attempted, and no official R4
live field result was produced. A block acknowledgment and lack of an observed
response do not establish server-write isolation. In particular, this R4
diagnostic is **not zero-traffic evidence** and measures no increase above the
supplied real 1/16 observation.

## Changes

- The official runner enables both guards before `Target.activateTarget`,
  `Page.bringToFront`, and `Emulation.setFocusEmulationEnabled(true)`. It keeps
  that session through guarded evaluation and settlement, checks for non-GET
  failure after each keeper command, and clears focus emulation while guarded.
  A further bounded 250 ms window covers delayed cleanup requests before
  guard teardown, including early-stop and failed-reset paths. It cannot
  isolate arbitrary later page activity.
  Boolean acknowledgments localize keeper progress without exposing target IDs.
- Select availability separates the host/combobox from at most one enabled
  text/search `.ant-select-search__field` inside its owned `.ant-select-search`.
  Only that hidden helper shape is exempted. Disabled/inert ancestors, hidden
  primary controls, generic hidden inputs, foreign ownership, duplicate helpers
  and explicit collapsed ancestors remain rejected. Attribute-only visibility
  still makes no stylesheet/layout or interaction-availability claim.
- Location and other kind failures retain strict rejection and now carry a
  fixed cause: conflicting picker, unexpected interactive control, nonunique
  select, mixed choice kinds, input outside the select, or unexpected input
  kind. No unevidenced hybrid is treated as supported.
- Current owned option enumeration reports only `observedOptionCount` and
  `samplePrefixMatched`. Research still has a capped 25-label harvest with no
  proven total. Location one still lacks five labels from the recorded 30;
  location two still has no independent dictionary. Counts do not establish
  complete dictionaries or fabricate the missing labels.
- Calendar inspection now performs section, wrapper, label, control ownership,
  uniqueness and availability checks before reporting
  `calendarStructureObserved=true`. Disabled picker classes are checked too.
  Date/popup behavior remains unevidenced: the row stays skipped with
  `calendar_live_evidence_missing`.
- The official evidence sanitizer validates optional counts, booleans and
  fixed diagnostics by field kind and reason, preserves static completeness,
  and discards arbitrary metadata. The official evaluation still always uses
  `throwOnSideEffect=true`; there is no fallback evaluation or interaction.

## Offline verification and handoff

The required narrow command is:

```powershell
node --test tests/cms-row-d-options.test.mjs tests/cms-row-d-probe-expression.test.mjs tests/cms-row-d-debug-evaluate.test.mjs tests/cms-row-d-live.test.mjs tests/cms-row-d-live-cdp.test.mjs
```

Final result: **326/326 passed**, zero failures, cancellations or skips, at
Node **v24.20.0**. `git diff --check` also passes. Log:
`_temp-scripts/cms-row-d-r4-tests-final.txt`. All DOM topologies and transport
servers in these suites are synthetic. The actual V8 debug evaluator checks
both positive helper traversal and negative kind/collapse/disabled paths while
retaining the earlier trim/iterator/accessor regressions. A modeled closed
select fixture observes 12/16 rows and preserves the research, location and
calendar gaps. **That synthetic count is not a new real-CMS count.** The tests
also assert zero selected-value reads, DOM mutations, interactions, emitted
events and network attempts by the inspector, plus privacy and strict evidence
sanitization.

Ignored diagnostic script/evidence:
`_temp-scripts/cms-row-d-r4-structure.mjs` and
`_temp-scripts/cms-row-d-r4-structure.json`. They contain only bounded structural
diagnostic code, fixed metadata and redacted traffic records; no captured live
DOM or selected values are committed.

**Parent must re-probe 9242 with the new tip.** No separate keeper session is
required by the revised runner. It may honestly stop for a guarded non-GET,
disabled/hidden/collapsed control, location kind issue, unavailable or mismatched
owned list, incomplete/reused dictionary, or missing calendar behavior.
Full 16/16 preflight is not required for this ticket. Offline green does not
establish live preflight PASS, live fill/support, or permission to book D+12.
Booked remains **53**.
