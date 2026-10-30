# GET-safe section entry and read-only navigation plans

Base: `e44a466175a732d2459b0149984c9414a50214f0` on
`cursor/expand-night-ats-f861`. Offline evidence only;
`liveSupportClaimed=false`; Never-Save.

`ResumeFormFlow.navigation.inspect()` discovers generic navigation controls in
`nav`, `aside`, ARIA navigation/tab lists and explicit `data-wizard` /
`data-stepper` groups, plus ARIA tabs and controls with `aria-controls`.
`plan(element)` rechecks a particular live control. Ordinary `RESUME_INSPECT`
includes the observation as `data.navigation` and summary entry inspection as
`data.entry`. The fill/entry flow does not traverse sections or execute plans.

Plans are ordered by same-document fragments (`hash` / `anchor`), `query`, `tab`,
then manual controls. These are observed route relationships, not a claim that
activating the page is safe:

| Strategy | Required relationship |
| --- | --- |
| hash | Same origin, path and query; decoded fragment names one existing element ID. |
| anchor | Same origin, path and query; decoded fragment names one existing `a[name]`. ID/name collisions and duplicate targets are manual; a single element with both matching ID and name is counted once. |
| query | Same origin, path and hash; only one of `step`, `section`, `tab` changes to a single nonempty letter/number/underscore/hyphen value (up to 80 characters); other query values stay unchanged. |
| tab | Tab belongs to an ARIA tab list; unique tab ID and `aria-controls` identify one `tabpanel` whose `aria-labelledby` points back only to that tab; no other tab shares it. |

URLs respect the document's base URL. Cross-origin/path links, downloads, ping,
new windows, submit/default buttons, save/next/continue actions, busy/disabled or
hidden controls, missing/ambiguous targets and unknown relationships remain
manual. An unsafe link cannot fall back to the tab strategy. Hidden mounted tab
panels may establish a relationship; their contents are not filled or revealed.
Returned indices identify the observation order, not durable selectors or field
IDs. Replanning reads current DOM ownership rather than trusting a cached plan.

Explicit non-GET metadata on the control or its ancestors is manual before route
classification: `method`, `formmethod`, `data-method`, `data-turbo-method`,
`data-http-method`, and `hx-post` / `hx-put` / `hx-patch` / `hx-delete` (including
their `data-hx-*` forms). Empty or unknown method declarations also fail closed.
GET metadata does not authorize activation or prove a handler is read-only.

## Summary to editor boundary

`ResumeFormFlow.inspect()` returns an `entryPlan` for a unique visible existing
create/enter/edit caption, using the same generic planner as section navigation.
`ensure({ ready, allowEntry: true, check })` rechecks the binding and exact live
candidate, then returns `manual` with that plan instead of clicking it. A route
relationship yields `entry_activation_manual`; explicit non-GET metadata yields
`navigation_non_get_manual`; unknown button handlers remain manual. Ambiguous
entries remain `entry_ambiguous`. No route, field ID or site selector is guessed.

This intentionally removes automatic create/edit clicks from the shared entry
flow, including existing adapter callers. A reciprocal tab, native-looking link,
or hash/query relationship cannot prove that a click, hashchange or unload handler
will not POST/PUT or autosave. There is no execution-level GET-only capability in
this API, so activation remains manual for all plans. Open the editor manually
and inspect/fill again; a successful plan alone is never writable readiness.

An already open editor or independently hydrated editor can still become ready:
`ready()` must settle across tasks. URL (including hash/query), visibility and
profile binding are revalidated after asynchronous checks and final readiness.
Every result leaves `entryAttempted:false` and `transitions:[]`. This slice does
not add a navigation executor or relax any network guard.

Every result carries `readOnly: true`, `activation: 'manual'`,
`navigationAttempted: false`, `writeStarted: false`, `writeAttempted: false`,
`saved: false`, `skippedSave: true`, and `liveSupportClaimed: false`. A `planned`
result describes a route only. This API never clicks, dispatches events, changes
URL/history, reveals panels, saves, submits, writes storage or makes requests.
Actual page activation stays manual: even a tab handler or hashchange listener
can autosave. Existing Never-Save/network/click guards and L1 writer gates are
unchanged. There are no tenant rules, site selectors, field maps, model calls or
live compatibility claims.

## Reproduce locally

Use Node 24 and PowerShell at the repository root:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
node --test tests/resume-navigation.test.mjs tests/resume-form-flow.test.mjs tests/engine-manual-controls.test.mjs "tests/l1-*.test.mjs" tests/product-paths-whitelist.test.mjs tests/guard-worker-auto-runners.test.mjs tests/never-save-guard.test.mjs tests/cms-row-d-network-guard.test.mjs tests/cms-basic-info-gaps.test.mjs tests/cms-row-d-preexisting-trial.test.mjs tests/pack-side-effect-import.test.mjs tests/build-paid-rebuild.test.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-internal.ps1
npm run test:zoo
```

Install the pinned Chromium with `npx playwright install chromium` if absent.
The unit contract traps events, native value setters, network, form, history and
storage effects and verifies unchanged DOM/URL/neighbor values. The L1 section
entry suite covers the four route types, POST/PUT handlers left uncalled,
declarative non-GET actions, query/anchor ambiguity, binding/ownership drift and
final asynchronous readiness drift. Batch B zoo verifies unknown create/edit
entries stay manual and synthetic navigation in both MAIN and ISOLATED worlds
using exact built bytes and the unchanged network guard. Evidence requires zero
handler/event calls, zero non-GET traffic and unchanged page/model/neighbor state.
No recruiting server is contacted. Product allowlists remain at 148 files.

Local validation: 680 unit/L1/whitelist/guard checks passed; all 82 zoo cases
passed; `build-internal.ps1` produced and verified the 148-file package.
