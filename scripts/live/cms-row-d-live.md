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

`cms-row-d-live.mjs` attaches to an existing CMS resume tab and runs the merged offline options resolver and read-only ownership preflight. This is a probe, not a fill adapter. It never opens a popup, clicks an option or 保存/提交, emits input events, or reads current field values. No originals require restoration because the probe performs no form interactions or value mutations.

Every result keeps `neverSave=true`, `liveSupportClaimed=false`, `livePassClaimed=false`, `writeStarted=false`, `mutationAllowed=false`, `valuesExposed=false`, and `probeOnly=true`. A successful preflight does not grant mutation permission or establish live fill support. Education is outside this probe's scope.

## Run

From the repository root in PowerShell:

```powershell
node scripts/live/cms-row-d-live.mjs --help
$env:PORT = '9242'
$env:OUTDIR = Join-Path (Get-Location) '_temp-scripts\cms-row-d-live-never-save'
node scripts/live/cms-row-d-live.mjs
```

`PORT` defaults to `9242`. `OUTDIR` defaults to the repository's `_temp-scripts/cms-row-d-live-never-save` directory. Keep all request files and generated evidence under `_temp-scripts`.

Optionally set `REQUESTS_FILE` to a JSON file under `_temp-scripts`. The object maps exact allowlisted wrapper IDs to literal harvested option labels; the industry checkbox field accepts an array of those labels. For example:

```json
{
  "13_47_0": "11-20万",
  "13_102501_0": ["宏观", "策略", "债券"]
}
```

Requests only exercise dictionary resolution and ownership checks; they never request a write. Unknown labels are rejected. Do not infer additional labels or location options from geography.

## Safety and evidence

Both `Network.enable` and CDP `Fetch.enable` must succeed before the page probe runs. Requests paused by Fetch are continued only for GET; every other method is rejected. Any non-GET observation or interception failure fails the result. Evidence identifies the normalized `/resume/info/edit` endpoint and uses a safe category for other endpoints; it never reads request or response bodies or current field values. Any observed `info/edit` attempt remains visible even when blocked or when the displayed value was unchanged.

`observedNonGetCount` counts Network observations, while `blockedNonGetCount` counts acknowledged Fetch block commands. These are event counts and can refer to the same request. `requestWillBeSent` alone does not prove that a request reached the server. Interception cannot retroactively cancel requests already in flight; a late block failure during teardown also fails the result. This is no server-write isolation claim. The probe induces no form interaction. It drains known request decisions before disabling its CDP domains and closing the session; no page hooks need removal.

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

Location-one has only 25 serialized labels from a 30-option list. Location-two has no independent options evidence. The industry list is also partial, and the English calendar has metadata only. These controls remain skipped. Current dropdown ownership must come from a unique current `aria-controls` association; a global visible dropdown or a harvested UUID cannot substitute for ownership.

After the parent re-runs guarded CDP, the page may still return
`row_d_preflight_incomplete`, including `control_not_available`,
`control_kind_mismatch`, incomplete dictionaries and missing calendar evidence.
Completing the inspection without `exceptionDetails` is this revision's target;
no preflight PASS or live PASS is claimed.

Exit `0` means complete preflight. Exit `2` means incomplete, blocked, or error; a completed probe can still be incomplete because of these intentional skips. Inspect the result reasons rather than treating execution alone as a pass.

No live PASS is claimed until the parent runs real CDP Never-Save verification. Offline tests and preflight results do not claim site support. Booked stays **53**; this work does not book **+12**.

## Offline validation

```powershell
node --test tests/cms-row-d-options.test.mjs tests/cms-row-d-probe-expression.test.mjs tests/cms-row-d-debug-evaluate.test.mjs tests/cms-row-d-live.test.mjs tests/cms-row-d-live-cdp.test.mjs
node --test tests/cms-basic-info-row-c-probe.test.mjs tests/cms-basic-info-gaps.test.mjs tests/cms-basic-info-live.test.mjs
```

The first command covers resolver/serialization parity, zero current-value reads or interactions, guard failures and teardown, target/output confinement, redaction, and an actual HTTP/WebSocket transport against a local fake CDP server. It also runs the serialized expression through `node:inspector` with V8's real `throwOnSideEffect=true`, using a synthetic tree with pure selector reads. The V8 test does not substitute for Blink's DOM API checks or a real-page re-run. All DOMs and CDP servers in these tests are synthetic; no live browser session is used. See [R2 validation notes](../../tests/cms-row-d-probe-side-effect-r2-notes.md) for the isolated Edge fixture check.

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
