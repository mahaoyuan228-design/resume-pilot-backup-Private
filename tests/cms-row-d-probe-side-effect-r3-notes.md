# CMS row D probe side-effect R3

Date: 2026-10-24. Base: `2bc7d9e289c5ba1c775decf831fc84dd6d3d40df`.
Branch: `codex/cms-row-d-probe-side-effect-r3`.

`neverSave=true`, `liveSupportClaimed=false`, `livePassClaimed=false`,
`writeStarted=false`, `mutationAllowed=false`, `valuesExposed=false`,
`probeOnly=true`. Booked remains **53**. No D+12 is booked. No clicks, fills,
dropdown opens, Save/submit, current-value reads, or live-page mutations were performed.

## Real-page evidence and diagnosis

The supplied R3 pack reports the official guarded runner returning
`inspection_exception`, `probeCompleted=false`, 16 fields only in an unguarded
diagnostic, logged-in UI and zero recorded traffic counters. This is not a login
block. The unguarded diagnostic was incomplete and is not a PASS.

The pack has no stack or script snapshot that identifies the failing operation.
After offline reproduction work, a separate, explicitly read-only diagnostic
used the user's permitted exception for CDP 9242. It issued only GET `/json/list`
and `Runtime.evaluate` with `throwOnSideEffect=true`, `returnByValue=true`,
`awaitPromise=false`, `userGesture=false`. It did not enable domains, activate
targets, navigate, install hooks, or invoke the official runner. Output was
restricted to static names/reasons, booleans, counts and sanitized stack positions.
It did not monitor network traffic and makes no live traffic isolation claim.

The original expression and initial iterator/accessor hardening both still
guard-rejected. Primitive iterator, Map/Set, ID/disabled, String constructor and
fresh-RegExp replace checks completed. Staged returns narrowed rejection to the
first label's normalization. Label ownership, visibility and text type completed;
normalizing even the canonical constant label rejected. The standalone primitive
`" cms ".trim() === "cms"` also returned the side-effect EvalError.

The CMS tab became hidden externally during diagnosis. Its state was left alone.
The exact inspector then correctly returned `page_hidden`. Later temporary
boolean trace expressions skipped only the visibility early-stop to diagnose
traversal, retaining `throwOnSideEffect=true`. These were labeled
`diagnosticVisibilityBypass=true`; they are not official probe results or a
committed fallback. After the trim fix, both label normalization checks and the
checkpoint after the entire field traversal completed without exceptionDetails.
A final trace evaluated the entire inspector, including its result construction,
and returned only a boolean confirming `reason=row_d_preflight_incomplete`,
`fields.length=16`, and `ok=false`. That boolean was true without exceptionDetails.
Its visibility bypass remains diagnostic only; the official runner was not run.

The observed rejection is the page's trim path. A shared-RegExp trim shim is an
offline reproduction of that mechanism, not a claim that its exact source was
captured from CMS. Such a shim refers to a pre-existing RegExp protected by V8's
debug evaluator; a fresh RegExp created during evaluation completes.

## Changes

- Serialize `trimProbeText` with a fresh whitespace RegExp per call. Remove
  `.trim()` from label normalization, ARIA tokenization, and both single and
  checkbox option resolution paths.
- Snapshot NodeLists through length/indexes, remove Array iterator consumption
  and Map/Set dependencies from serialized helpers, and cache selector membership
  in evaluation-local arrays.
- Read IDs and input types from attributes and disabled state from existing
  attribute/class/ancestor checks. Preserve native missing/invalid input type
  defaults and case normalization.
- Keep the official runner's `throwOnSideEffect=true`, exact page/visibility/
  readiness checks, redaction, ownership boundaries and Never-Save flags.

## Verification and handoff

The narrow command is:

```powershell
node --test tests/cms-row-d-options.test.mjs tests/cms-row-d-probe-expression.test.mjs tests/cms-row-d-debug-evaluate.test.mjs tests/cms-row-d-live.test.mjs tests/cms-row-d-live-cdp.test.mjs
```

Result: **244/244 passed**, zero failures/skips, at Node **v24.20.0**. Log:
`_temp-scripts/cms-row-d-r3-tests-final.txt`.

The V8 regressions prove that shared global and non-global RegExp trim shims
reject before running both default and requested inspections through the actual
guard. Requested paths verify single/radio indexes and checkbox indexes; all
results retain the Never-Save flags and exclude private sentinels. Additional
regressions cover stateful NodeList/Array iterators, element IDL accessors, and
missing/empty/invalid/uppercase input types.

Isolated Edge **155.0.4283.62 / V8 15.5.9.7** and Chrome
**156.0.8078.47 / V8 15.6.75.19** each ran both shared-RegExp shim variants.
All four fixtures reproduce the rejected literal trim and original R2 expression.
The revised default/requested expressions complete with combined iterator,
accessor and trim hazards. Each official fixture runner returns
`probeCompleted=true`, `ok=false`, `reason=row_d_preflight_incomplete`, 16 fields,
and zero non-GET/guard-failure counters.

All browser fixtures use fresh profiles, disabled external DNS and locally
fulfilled synthetic HTML; they never attach to 9242. Their runner results are
offline fixture outcomes, not live preflight or support evidence. Local evidence:

- `_temp-scripts/cms-row-d-offline-cdp-r3-trim-global-edge-1792830077784/`
- `_temp-scripts/cms-row-d-offline-cdp-r3-trim-global-chrome-1792830077785/`
- `_temp-scripts/cms-row-d-offline-cdp-r3-trim-nonglobal-edge-1792830077805/`
- `_temp-scripts/cms-row-d-offline-cdp-r3-trim-nonglobal-chrome-1792830077803/`

Each directory contains `summary.json`, `runner-default.json`, and
`runner-requested.json`.

Ignored diagnostic evidence stays under this workdir's `_temp-scripts`, including
`cms-row-d-r3-trim-primitives.json`, `cms-row-d-r3-label-components.json`, and
`cms-row-d-r3-trim-fixed-hidden-stages.json`, plus the final boolean result in
`cms-row-d-r3-final-hidden-traversal.json`. No raw page text, selected values,
queries, credentials, browser profile, or full page capture is committed.

**Offline green ≠ live until parent re-probes 9242.** Parent must re-run the
official guarded runner on the visible logged-in CMS page after merge. It may
still return `row_d_preflight_incomplete`, including `control_not_available`,
`control_kind_mismatch`, incomplete dictionaries and missing calendar evidence.
No live PASS, live fill/support, site-support claim, or booked increase follows
from these checks. Booked stays **53**.
