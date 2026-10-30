# CMS row D main world and field-bound dictionaries R1

2026-10-30. Base `df3c1fc2d1262518f5ccb7f23682009db9795f77` (#223).
Branch `codex/cms-row-d-mainworld-dict-r1b`; PR target `cursor/expand-night-ats-f861`.

PRIMARY = explicit CDP main-world context + former L314 empty-shape
classification + field-bound current option definitions. This revision does
not extend the #223 Vue ancestor recovery or change Fetch decisions,
keeper correlation, timeout cleanup or preservation rules.

## Evidence versus hypothesis

The supplied df3c1fc2 handover, root-anchor diagnosis, real-use JSON,
GitHub rough-search notes, acceptance checklist and narrow regression report
agree: synchronized tip, 2/16 fields, eleven `target_missing` plus
`root_anchor_missing` results, one acknowledged keeper info/edit block,
zero non-GET responses, `commandFailed=false`, and focus cleanup complete.
The authoritative prior narrow count is **931**, not 942.

The proposed isolated-world explanation was a hypothesis. A new guarded CDP
micro-inspection selected `auxData.isDefault=true` on the top frame at port
9239, execution context 8. In that main world, the failing select and its
five-node select-to-item path have no own `__vue__` descriptor; there is no
`#app` node. Those nodes instead have React instance/event-handler anchors.
Thus a real framework mismatch is observed; a wrong world in the old run is
not proven. Extending Vue ancestry would continue to look for the wrong root.

The read-only React metadata shows the exact host, Trigger, SelectTrigger and
Select chain, primitive option children, `isSelectOption=true`, and the
SelectTrigger's current ARIA ID. The DOM anchor can retain an old alternate;
some shared bailout children also retain a return link to an alternate parent.
The implementation therefore authenticates forward membership from
`root.current` rather than treating a return chain as committed evidence.

The public page's vendor bundle contains Select's identity default
`dropdownRender`. The probe checks the function's identity against that
component type's default and never executes it. Custom renderers remain
unsupported. The upstream [React host-node implementation](https://github.com/facebook/react/blob/v16.14.0/packages/react-dom/src/client/ReactDOMComponentTree.js)
and [Ant Design Select wrapper](https://github.com/ant-design/ant-design/blob/3.26.20/components/select/index.tsx)
provide source context, not proof of an exact installed CMS version.

## Implementation and boundaries

`Runtime.enable` events and `Page.getFrameTree` must identify exactly one
default context for the top frame at the expected page. Each inspection carries
that `contextId`. Missing/ambiguous contexts, a wrong frame URL, destroyed or
cleared contexts, and replacement of the pinned context stop inspection.
There is no unpinned retry or side-effect-enabled fallback. Runtime cleanup
uses the same guarded session as focus cleanup.

Fallback diagnostics expose only Vue descriptor shapes and bounded counts on
the already verified select-to-item path, including `#app` presence/shape.
They never invoke getters or serialize anchor names, DOM text or instances.

For a React-owned select, collect only its bounded possible ancestry, then
follow forward child/sibling membership from the single committed root back
to the exact host. Limits: 256 ancestry/visited nodes, 128 path levels,
256 sibling links per parent, and 16 local component levels. Sibling links
are used only to prove membership; sibling props, state and labels are unread.
Before the next outer host, require one Select and one SelectTrigger with
current instance/props identity and `ariaId === aria-controls`.

Only that Select's current option children supply labels. This is the
field-bound form-definition route, identified as `owned_react_props`, not an
arbitrary global dictionary or a mounted/filtered menu. Wrapper, section,
label, uniqueness, visibility, availability and exact dictionary order/count
checks still apply. Options with accessors, disabled/styled/rich labels,
unsupported modes or custom renderers fail closed. A malformed React anchor
cannot fall through to Vue or borrow another field's definitions.

No selected props, component state, input values, retained Trigger options,
form values or option values are read. No root `$children` search, arbitrary
store scan or speculative XHR/body ingestion is needed: the observed React
definitions already provide the current field binding. The absence of the
lazy portal remains `target_missing`; no popup is opened and no
`getPopupContainer` function is called. The prior Vue path remains available
for independently supported Vue fixtures, without another ancestor expansion.

The location diagnostic's two dependency hashes are refreshed for deployed
CRLF bytes; its schema, exact URL binding, guard checks and IO rules are
unchanged. Its composition forwards the pinned `contextId` unchanged.

## Actual guarded live result

Official runner: `scripts/live/cms-row-d-live.mjs`, port 9239,
`OPTIONS_WAIT_MS=5000`, default 10000ms step timeout.
Recorded at **2026-10-30 15:57:02 Asia/Shanghai** on the uncommitted changes
above df3c1fc2. The [sanitized full result](fixtures/cms-row-d-mainworld-dict-r1-live.json)
includes LF-normalized SHA-256 hashes of the two executed sources so the
result is bound to the implementation, not misattributed to the base commit.

| Signal | Recorded result |
| --- | --- |
| Exit / ok / completed | **2 / false / true** |
| Reason | `row_d_preflight_incomplete` |
| Fields | **13/16**, previously 2/16 |
| Recovered selects | **11**, all `owned_react_props` |
| Options unavailable / root missing | **0 / 0**, previously 11 / 11 |
| Main world | `pinned`, contextId **8** |
| Options readiness | `not_needed`, attempts 1, waitRounds 0, unavailable 0→0 |
| Non-GET observed/intercepted/blocked | **1/1/1**, exact keeper info/edit |
| Non-GET responses | **0** |
| commandFailed / truncated | **false / false** |
| Keeper verdict | `correlated_keeper_blocks` |
| Focus emulation cleared | **true** |

Both locations remain `control_kind_mismatch` / `select_not_unique`.
The English calendar remains `calendar_live_evidence_missing` with structure
observed. These are SECONDARY; no field or top-level `ok` was inflated.

`neverSave=true`, `probeOnly=true`; `writeStarted`, `mutationAllowed`,
`valuesExposed`, `liveSupportClaimed` and `livePassClaimed` remain false.
Every evaluation retains `throwOnSideEffect:true`, `userGesture:false` and
`awaitPromise:false`. No fill, save, submit or popup interaction was performed.
**D remains unbooked; booked stays 58.** The parent retains the acceptance and
booking decision; this result is not a fill-support or live-PASS claim.

Local authoritative artifacts are under
`_temp-scripts/cms-row-d-mainworld-dict-r1b-final/` (`cms-row-d-live.json` and
`RESULT.json`). Diagnostic scratch scripts and downloaded public bundles stay
outside the committed changes.

## Validation

Node **24.20.0**, Windows, dedicated headless Chrome for offline browser tests.

```powershell
$env:CHROME_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'
node --test --test-concurrency=1 tests/cms-row-d-*.test.mjs
```

New synthetic React cases cover private-value/getter tripwires, serialized
expression parity, committed alternates and shared bailout children, detached
graphs, cycles, foreign ARIA IDs, props drift, custom renderers, loading,
disabled/rich/styled/sparse options, ambiguous anchors and dictionary drift.
Runner cases reject missing/utility/subframe/duplicate contexts, wrong frame
URLs, and invalidation during evaluation. The dedicated native Chrome fixture
proves identical DOM but different Vue expando visibility across main/isolated
worlds under strict evaluation, and still rejects a deliberate DOM write.
That fixture is explicitly offline; the live JSON above is separately real.

Actual full narrow result: **959 pass / 0 fail / 0 skipped / 0 cancelled**,
71.18 seconds. This is the prior 931 baseline plus 21 React cases and 7
main-world runner cases. Existing native Chrome coverage also checks the
main/isolated-world distinction. `git diff --check` is clean.
Full local log: `_temp-scripts/row-d-verified-tests.txt`.
