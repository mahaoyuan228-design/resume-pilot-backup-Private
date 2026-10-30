# Read-only wizard and sidebar navigation plans

`ResumeFormFlow.navigation.inspect()` discovers generic navigation controls in
`nav`, `aside`, ARIA navigation/tab lists and explicit `data-wizard` /
`data-stepper` groups, plus ARIA tabs and controls with `aria-controls`.
`plan(element)` rechecks a particular live control. Ordinary `RESUME_INSPECT`
includes the observation as `data.navigation`; the existing fill/entry flow does
not traverse sections or execute these plans.

Plans are ordered by `hash`, `query`, `tab`, then manual controls. These are
observed route relationships, not a claim that activating the page is safe:

| Strategy | Required relationship |
| --- | --- |
| hash | Same origin, path and query; decoded fragment names one existing element. |
| query | Same origin, path and hash; only one of `step`, `section`, `tab` changes to a single nonempty letter/number/underscore/hyphen value (up to 80 characters); other query values stay unchanged. |
| tab | Tab belongs to an ARIA tab list; unique tab ID and `aria-controls` identify one `tabpanel` whose `aria-labelledby` points back only to that tab; no other tab shares it. |

URLs respect the document's base URL. Cross-origin/path links, downloads, ping,
new windows, submit/default buttons, save/next/continue actions, busy/disabled or
hidden controls, missing/ambiguous targets and unknown relationships remain
manual. An unsafe link cannot fall back to the tab strategy. Hidden mounted tab
panels may establish a relationship; their contents are not filled or revealed.
Returned indices identify the observation order, not durable selectors or field
IDs. Replanning reads current DOM ownership rather than trusting a cached plan.

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
node --test tests/resume-navigation.test.mjs tests/resume-form-flow.test.mjs tests/engine-manual-controls.test.mjs "tests/l1-*.test.mjs" tests/product-paths-whitelist.test.mjs tests/cms-basic-info-gaps.test.mjs tests/cms-row-d-preexisting-trial.test.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-internal.ps1
npm run test:zoo
```

Install the pinned Chromium with `npx playwright install chromium` if absent.
The unit contract traps events, native value setters, network, form, history and
storage effects and verifies unchanged DOM/URL/neighbor values. The existing
Batch B zoo adds two synthetic navigation cases in both MAIN and ISOLATED worlds
using exact built bytes and the unchanged network guard. Evidence requires zero
handler/event calls, zero non-GET traffic and unchanged page/model/neighbor state.
No recruiting server is contacted. Product allowlists remain at 148 files.
