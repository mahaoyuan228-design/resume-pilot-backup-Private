# CMS Row D calendar observation R1

2026-10-30. Base `66c9d6f2472dec78588be0157d12fd0c6452098d` (#225).
Branch `codex/cms-row-d-calendar-r1`; PR base `cursor/expand-night-ats-f861`.
PRIMARY is only `englishExamDate` calendar evidence. Booked stays **70**;
**bookD=false**, no new booking, no live support/PASS/fill claim.

## Evidence and inference

The supplied next-knife feed section 8, calendar rough-search note, READY note,
real-use JSON, 1043-test baseline and 19/19 tip-sync report agree: 15/16 fields,
both locations already observed, and one calendar residual:
`calendar_live_evidence_missing`, React `month_component_unrecognized`.
The `/workspace/handover/` references resolve to the supplied Windows
`_temp-scripts/` directory; the checkout's HEAD matched the full base SHA.

A bounded strict live diagnostic found minified function names `o`, `n` and
`l`, with a canonical date-only format on one current component. These names
do not distinguish DatePicker from MonthPicker. The definition allowlist was
therefore **not widened**, and date-only format was **not relabeled as month**.
The existing definition helper is unchanged.

The guarded panel diagnostic actually observed these transitions:

| Phase | Observation |
| --- | --- |
| Closed | Exact trigger, no calendar popup |
| Trigger opened | 42 date cells; no `aria-controls` on picker/input; popup has no ID |
| Month header clicked | 12 month cells in one month-panel overlay; 42 background dates remain mounted |
| Cleanup | Popup confirmed absent by a fresh strict read |

The actual popup is a committed React HostPortal descendant of the exact
trigger host. This current-tree relation supplies ownership independently of
ARIA. A globally unique popup or a raw fiber `return` chain is insufficient.

Upstream explains the observed shape but is not substituted for live evidence:
[AntD 3 constructs separate DatePicker and MonthPicker calendars](https://raw.githubusercontent.com/ant-design/ant-design/3.26.20/components/date-picker/index.tsx),
[the month header changes the panel without selecting a value](https://raw.githubusercontent.com/react-component/calendar/9.x/src/calendar/CalendarHeader.jsx),
and [rc-util uses a React portal](https://raw.githubusercontent.com/react-component/util/v4.16.1/src/Portal.js).
The shared/minified wrapper identity was a hypothesis until inspected locally.

## Implementation and boundaries

The new inert helper verifies the exact wrapper/section/item/input, resolves
current fibers through the committed root's forward links and alternatives,
and proves a unique HostPortal/container relationship below that trigger.
It validates one visible month-panel boundary with exactly 12 cells. Background
date cells are allowed only outside that boundary. It never reads dates,
selected values, cell text, component state, getters or outer application roots.

The existing options inspector can consume this already-open panel proof.
It reports `calendarEvidenceSource=owned_react_portal` and
`calendarPickerKind=unverified`. This is panel evidence, not MonthPicker
identity, format support, a fill adapter or permission to mutate values.

`CALENDAR_PANEL_READONLY=1` explicitly enables the official runner's bounded
popup cycle; the default remains inert. CDP input targets are returned by the
same ownership helper. Every target is re-authenticated after scrolling, and
an exact backend-node hit test rejects overlays or replacements. Hit testing
uses document coordinates; mouse dispatch uses viewport coordinates.
Only trigger input, month header and an exact static label-container target
can be clicked. Month/date cells are never action targets.

Cleanup focuses the owned calendar and sends Escape. If needed, it rechecks
the owned static label-container fallback. Escape may close asynchronously
between the snapshot and fallback lookup; a refused stale target is accepted
only after a fresh strict snapshot independently proves closure. No unverified
close earns calendar proof. Protocol failures still reach the network guard's
hard-failure ledger. All evaluations retain `throwOnSideEffect:true`,
`userGesture:false`, `awaitPromise:false`; there is no permissive retry.
New non-GET traffic during the cycle blocks retention of its calendar proof.

After cleanup the entire inspector runs again. Other fields use that final
snapshot, so earlier successes cannot hide later drift. The calendar proof is
retained only when the final closed-trigger envelope matches the initial one,
with `calendarEvidenceTiming=observed_then_closed`. This explicitly describes
an earlier observation; equal envelopes do not assert unchanged DOM identity
or a currently open panel. `calendarObservation.panelClosed=true` records
cleanup without writing or restoring selected values.

No location peer/cascader logic, main-world selection, Fetch policy, outer
`__vue__` recovery or options readiness behavior was changed. The location
sidecar only received required exact dependency hash updates, including both
new imported calendar modules. Its source/schema/DOM/guard preservation
checks remain in place. Five pre-existing unrelated line-ending changes were
left outside this PR.

## Actual guarded live result

Official runner on port 9239, `OPTIONS_WAIT_MS=0`,
`CALENDAR_PANEL_READONLY=1`, default 10000ms step timeout. Captured at
**2026-10-30 18:30:13 Asia/Shanghai**, before commit on the implementation
above the base. [Sanitized capture and source hashes](fixtures/cms-row-d-calendar-r1-live.json)
record the exact executed source with LF-normalized SHA-256 provenance.

| Signal | Result |
| --- | --- |
| Exit / ok / probe completed | **0 / true / true** |
| Reason | `read_only_preflight` |
| Fields | **16/16**, previously 15/16 |
| Calendar | `read_only_calendar_preflight`; owned React portal; month panel, 12 cells |
| Component identity | `unverified`, not claimed MonthPicker |
| Evidence timing / popup closed | `observed_then_closed` / **true** |
| Both locations | still `read_only_location_preflight` |
| Main world | pinned, context **8** |
| Options readiness | `not_needed`, one attempt, unavailable **0→0** |
| Non-GET observed/intercepted/blocked | **0/0/0** |
| Non-GET responses / commandFailed / truncated | **0 / false / false** |
| Focus emulation cleared | **true** |
| Never-Save / probe-only | **true / true** |
| Write/mutation/value/support/PASS flags | all **false** |
| Booked / new booking / book D | **70 / 0 / false** |

This is the current branch's guarded observation. Post-merge tip sync and
parent acceptance remain separate. It makes no claim that dates can be filled
or saved, and it does not book D or promote live support.

Authoritative local evidence:
`_temp-scripts/cms-row-d-calendar-r1-live-final/{cms-row-d-live.json,RESULT.json}`.

## Validation

The supplied baseline is **1043 passed / 0 failed**. New contracts cover
current React portal ownership and alternatives, the genuine mixed month/date
overlay, direct/serialized inspector parity, strict native Blink execution,
typed evidence cleaning, overlays and stale targets, traffic/context failures,
lost command acknowledgments, asynchronous closure, and fresh final-field drift.

The first full run correctly rejected stale diagnostic dependency hashes;
the exact reviewed pins were updated, without changing location logic.
Final full narrow result: **1144 passed / 0 failed**, **0 skipped / 0
cancelled**, in 91.53 seconds on Node **v24.20.0**. This is the supplied
1043 baseline plus 55 portal tests, 33 observation tests and 13 additional
runner tests. `git diff --check` is clean.

```powershell
node --test --test-concurrency=1 tests/cms-row-d-*.test.mjs
```

Log: `_temp-scripts/cms-row-d-calendar-r1-full-final-tests.txt`.
