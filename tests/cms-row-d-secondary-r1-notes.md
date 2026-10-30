# CMS Row D secondary read-only preflight R1

2026-10-30. Base `575abee88fee37a3f02cf092c6a55b49dce8536d` (#224).
Branch `codex/cms-row-d-secondary-r1`; PR target
`cursor/expand-night-ats-f861`.

PRIMARY = the two location fields' owned peer-select evidence and the English
exam calendar's current MonthPicker evidence. This revision does not change
main-world selection, extend outer `__vue__` recovery, reopen root-anchor
readiness work, or change Fetch/keeper decisions.

## Evidence and limits

The supplied secondary feed, rough-search notes, READY note, parent acceptance
note, real-use report and `real-use-cms-row-d-575abee8/RESULT.json` agree on
the accepted baseline: main world pinned at context 8, 13/16 fields,
`optionsReadiness=not_needed`, one correlated blocked info/edit request, zero
non-GET responses, `commandFailed=false`, and focus cleanup complete.
The two locations fail `select_not_unique`; the calendar has structure
observed but fails `calendar_live_evidence_missing`.

The parent's later override is authoritative for accounting:
`PASS_PREFLIGHT=yes`, `bookD=yes`, booked **70**, while `ok=false` and exit 2
remain honest. The original raw JSON and historical notes retain their prior
counts. This revision updates the active runner's accounting to 70 and adds
no booking. Acceptance, field observation, and fill support are separate.

The source mismatch is directly observed: the location-structure diagnostic
expects two peer `.ant-select` hosts under `.cascader-plugins-wrap`, whereas
the old options path requires exactly one select. The diagnostic's expected
shape is not itself a new live capture. The rough-search province/city and
Vue MonthPicker suggestions remain hypotheses until current owned evidence
is observed. The #224 live diagnosis identified React anchors on this CMS;
the new calendar path therefore supports current React evidence directly.

## Implementation

Both locations retain exact wrapper, section, label, peer uniqueness and
ownership checks. The new peer path requires precisely two non-nested hosts
inside one owned cascader, validates both hosts and their distinct unique
ARIA bindings, then reads independently owned current option evidence for
the first host. It never chooses an arbitrary page-level select.

The harvested location dictionary remains incomplete: only 25 of the recorded
30 labels are known. A location observation can pass the narrower
`read_only_location_preflight` after current count and known prefix match;
it does not complete the harvested dictionary, verify a dependent city
selection, or grant mutation permission. The second location retains its
reused-harvest provenance and must supply its own current owned evidence.

Calendar structure alone remains insufficient. Additional evidence must be
bound to the exact current MonthPicker component or a uniquely owned,
already visible calendar panel. Placeholder text and arbitrary `mode=month`
metadata cannot establish MonthPicker identity. Only allowlisted primitive
format/mode/open metadata and bounded structural counts can be emitted.
Selected values, component state, input values and calendar cell text are
not read. No picker is opened and no date is selected.

The live result cleaner validates separate success reasons and typed proof
fields for these routes. A partial dictionary or structure-only calendar
cannot masquerade as the original complete-options preflight.

Every browser evaluation retains `throwOnSideEffect:true`,
`userGesture:false`, and `awaitPromise:false`. Never-Save stays enabled;
non-GET requests stay blocked. `writeStarted`, `mutationAllowed`,
`valuesExposed`, `liveSupportClaimed` and `livePassClaimed` remain false.

## Validation

The authoritative prior narrow baseline is **959 pass / 0 fail**.
New coverage adds 31 location cases, 44 calendar cases, and 9 live-result
validation cases. Native Chrome accepts the successful read-only paths with
`throwOnSideEffect:true` and rejects deliberate DOM mutation. Mounted offline
Vue 2.7.16 / Ant Design Vue 1.7.8 MonthPicker coverage separately verifies its
exact current wrapper/implementation chain; this is not captured CMS DOM.

The first full run had 1041 passes and two failures. One source-preservation
assertion compared CRLF against LF; the unchanged diagnostic source now keeps
its original LF bytes. The other negative native fixture protects all option
text with throwing accessors. The new composite path correctly reaches and
refuses that protected text, so its expected sanitized failure is now
`document_read_failed`, with no `ok` claim; the separate structure evidence
still passes. The affected 116 checks then passed. The final full narrow run
passed **1043 / 1043**, with **0 failures, 0 skipped, 0 cancelled**, in 84.46
seconds. `git diff --check` is clean.

```powershell
$env:CHROME_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'
node --test --test-concurrency=1 tests/cms-row-d-*.test.mjs
```

## Actual guarded live result

Official `scripts/live/cms-row-d-live.mjs`, existing port 9239,
`OPTIONS_WAIT_MS=5000`, default 10000ms step timeout. Recorded at
**2026-10-30 17:17:43 Asia/Shanghai** on the changes above `575abee8`.
The [sanitized full capture](fixtures/cms-row-d-secondary-r1-live.json)
includes LF-normalized SHA-256 hashes of the three executed source files,
plus the prior parent's acceptance as explicitly historical provenance.

| Signal | Recorded result |
| --- | --- |
| Exit / top-level ok / probe completed | **0 / true / true** |
| Reason | `read_only_preflight` |
| Fields | **15/16**, previously 13/16 |
| Both locations | `read_only_location_preflight`, each independently observed |
| Location topology | two owned peer hosts, one shared owned cascader |
| Location option evidence | `owned_react_props`, 30 current labels, known 25-label prefix matched |
| Location dictionary / selected path | incomplete / unverified |
| Calendar | `calendar_live_evidence_missing`, structure observed, React `month_component_unrecognized` |
| Main world | pinned, context 8 |
| Options readiness | `not_needed`, one attempt, unavailable 0→0 |
| Non-GET observed/intercepted/blocked | **1/1/1**, keeper info/edit |
| Non-GET responses | **0** |
| commandFailed / truncated | **false / false** |
| Focus emulation cleared | **true** |
| Booked / new booking | **70 / 0** |

The existing top-level calendar-only exemption permits `ok=true` while the
calendar field remains honestly false. This rule is unchanged; the result
does not mean 16/16 or calendar fill support. Neither current location options
nor the offline calendar tests establish live fill support. Never-Save safety
flags remain unchanged and no popup was opened.

A subsequent bounded diagnostic reused the official runner's guards and
pinned context. On the exact committed calendar host's ancestry, it found a
canonical date-only format but no recognized MonthPicker identity or owned
`props.calendar` element. That is insufficient month evidence, so the helper
was not relaxed. Both diagnostic runs retained 15/16, zero observed non-GET
traffic, `commandFailed=false`, and complete focus cleanup. Their sanitized
artifact remains local at `_temp-scripts/cms-row-d-calendar-current-diagnostic.json`.

Authoritative local capture:
`_temp-scripts/cms-row-d-secondary-r1-live/cms-row-d-live.json`.
Full regression log: `_temp-scripts/cms-row-d-secondary-full-tests.txt`.
