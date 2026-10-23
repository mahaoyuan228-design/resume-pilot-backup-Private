# CMB controls: offline Never-Save hardening

Scope: ResumeQuickFill on `career.cmbchina.com/center/resume`, using existing CMB evidence and synthetic fixtures only. This work does not establish live support or full-form completion: `liveSupportClaimed=false`, `complete=false`. Never click save, submit, next, deliver, or delete actions.

The native text fills covered by PRs #114–#123 are outside this change. Their fill implementations are not reopened or rewritten. Changes in the shared `src/content/cmb-basic.js` file concern existing control routines and its embedded birthdate picker. No CMS tenant or shared core routing is added.

## Changes

| Cluster | Result | Implementation and coverage |
| --- | --- | --- |
| Birthdate picker | Refuses unavailable or unsafe targets and action ancestors; rechecks after mouse events and rereads the current target after rerenders. Missing, duplicate, disabled, hidden, or mismatching controls fail closed. No corrective typing is used to manufacture a successful readback. | `src/content/cmb-birthdate-picker.mjs`, embedded picker in `src/content/cmb-basic.js`, `tests/cmb-birthdate-picker.test.mjs` |
| Birthdate hint gate | Preserves the recorded `datepicker_hint_only` decision. Rejected evidence cannot authorize calendar interaction, fill, or save. Selector keys nested inside arrays or deeper metadata are rejected. Support claims remain false. | `src/content/cmb-birthdate-hint-gate.mjs`, `tests/cmb-birthdate-hint-gate.test.mjs` |
| RankingMajor gate | Requires agreement between both recorded snapshots, including label/control identity, visibility, ID hits, and ranking-related labels. Incomplete or disagreeing observations are inconclusive; unassociated hints and duplicate IDs are ambiguous. The recorded page remains `DOM_CONTROL_MISSING`, with no selector or fill wiring. | `src/content/cmb-rankingmajor-gate.mjs`, `tests/cmb-rankingmajor-gate.test.mjs`, `tests/cmb-rankingmajor-snapshot-agreement.test.mjs` |
| Existing selects | A click must be accepted by the page or explicitly synthetic fixture. The engine no longer rewrites display/ARIA state to create its own proof of success. Readback checks the current control after rerenders and rejects contradictory selection state, search text, missing options, duplicate structure, unavailable controls, and unsafe action ancestors. | Control routines in `src/content/cmb-basic.js`, `tests/cmb-controls-never-save.test.mjs`, `tests/fixtures/cmb-basic-form.html` |
| Slice 2 radios | Gender and formal-work controls reject multiple checked radios, unexpected options, duplicate field items, and unsafe controls before interacting. Native radio activation supplies the change; repeated matching fills do not add clicks or fabricated input events. Existing numeric/profile edge behavior remains covered. | Radio routines in `src/content/cmb-basic.js`, `tests/cmb-controls-never-save.test.mjs`, `tests/cmb-slice2-edges.test.mjs` |
| Popup and reports | Stops off-page fill before authorization, injection, or messaging. A successful report needs the CMB resume URL and cannot contradict explicit wrong-page flags. Never-Save and support claims are checked in the body, results, blockers, and birthdate hint. Sealing retains original blocker evidence and distinct family-row blockers. Unsettled outcomes retain pending review. | `src/background/cmb-basic-auto.mjs`, `src/popup/popup.js`, `tests/cmb-popup-route.test.mjs`, `tests/cmb-basic-auto.test.mjs` |

The select coverage exercises 11 existing targets: marital status, politics, ethnicity, ID-card type, education level, family relationship row 0, family relationship row 1, award level, English level, recruitment channel, and interview city. These are 10 field families with two separate family indices. The fixture's click handler is synthetic test behavior, not harvested portal markup or a live acceptance claim. Education options remain the existing narrow fixture subset; `ED000` is not invented into that subset.

## Evidence boundary

- Select IDs, list IDs, and exact text/code dictionaries come from `src/content/cmb-gated-dicts.mjs`, `dist/site-probes/cmb-live-gated-harvest-20261019.json`, and `dist/site-probes/cmb-dictmap-full-20261019.json`. Existing recorded click provenance is described in `dist/site-probes/CMB_LIVE_SELECT_CLICK_EVIDENCE_20261019.md` and `dist/site-probes/CMB_LIVE_CLICK_MATRIX_20261019.md`. Those records do not make synthetic option markup a live portal contract.
- The existing birthdate input/hint observation is in `tests/fixtures/live-harvest/20261019/cmb-birthDate-hint.json`. The required follow-up evidence is specified by `dist/site-probes/CMB_DOB_LIVE_HARVEST_PACK_20261019.md`. Synthetic picker navigation does not replace that pack.
- RankingMajor's recorded observation is `tests/fixtures/live-harvest/20261019/cmb-rankingmajor.json`. Its four verdicts and two-snapshot requirements come from `dist/site-probes/CMB_RANKINGMAJOR_PROBE_PACK_20261019.md` and `dist/site-probes/CMB_RANKINGMAJOR_STEPS_AM_20261019.md`. Positive control tokens used in regression tests come from the existing synthetic gate fixtures, not a newly claimed live DOM.

## Missing evidence

- Birthdate: the popup HTML, screenshot, interaction record, and verified display/value-format pack are still pending. The existing readonly input and placeholder are insufficient to upgrade the recorded hint-only status.
- RankingMajor: an actual page control, a unique label/control association, and independent interaction evidence are missing. Dictionary rows do not establish a control.
- Selects: full live dropdown option/portal DOM is absent or truncated despite the recorded IDs, dictionaries, and coded click evidence. The synthetic list/option structure and fixture event handler do not close this gap.

## Validation

Run the focused offline control and route checks:

```powershell
node --test tests/cmb-controls-never-save.test.mjs tests/cmb-slice2-edges.test.mjs tests/cmb-popup-route.test.mjs tests/cmb-basic-auto.test.mjs
```

Run picker and evidence-gate checks:

```powershell
node --test tests/cmb-birthdate-picker.test.mjs tests/cmb-birthdate-hint.test.mjs tests/cmb-birthdate-hint-gate.test.mjs tests/cmb-birthdate-hint-verdict.test.mjs tests/cmb-rankingmajor-gate.test.mjs tests/cmb-rankingmajor-snapshot-agreement.test.mjs tests/cmb-rankingmajor-verdict.test.mjs
```

Check compatibility with the recorded harvest packets and readonly harvest runner:

```powershell
node --test tests/live-harvest-fixtures.test.mjs tests/live-harvest-readonly.test.mjs tests/live-harvest-timeout.test.mjs
```

Final verification on Windows/Node 24 with the installed Chrome binary:

- `node --test tests/cmb*.test.mjs tests/auto-cmb-extension-cdp.test.mjs`: **193 passed, 0 failed, 0 skipped**. Includes 46 control regressions, picker mirror parity, headless synthetic harnesses, popup/auto reports, transport timeouts, and both evidence gates.
- `node --test tests/build-paid-rebuild.test.mjs tests/guard-worker-auto-runners.test.mjs tests/product-paths-whitelist.test.mjs tests/pack-side-effect-import.test.mjs tests/paid-qa-runner.test.mjs`: **60 passed, 0 failed, 0 skipped**.
- `node --test tests/live-harvest-fixtures.test.mjs tests/live-harvest-readonly.test.mjs tests/live-harvest-timeout.test.mjs`: **9 passed, 0 failed, 0 skipped**.
- `git diff --check`: clean. Only the four changed product hashes and their inventory sum are refreshed in `SOURCE_INVENTORY.json`.

No live form interaction is performed by this offline validation. Existing fixture behavior that changes a confirmed select or radio value is retained; this change does not add a fill-empty-only policy. Other unobserved date controls still lack picker-panel contracts, and live radio value/grouping contracts remain unharvested.
