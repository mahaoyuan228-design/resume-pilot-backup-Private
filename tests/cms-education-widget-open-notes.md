# CMS education widget open/close regression

## R3: complete mouse attempts with zero delivered opener clicks at #177

Base `d22734a92b130ca58fbd7c44b4ec7d1d45c41caa` was fetched, hard-reset, and
reverified before creating `codex/cms-edu-widget-open-r3`. #177's offline results
below did **not** fix the supplied live retest.

Evidence is supplied in `_temp-scripts/cms-edu-widget-open-r3-materials/`:

- `REAL_USE_CMS_EDU_CONTROLS1_d22734a9_2026-10-23.md`,
  `live/cms-education-live.controls1.json`, `live/evidence-summary-extract.json`,
  and `live/RESULT_NOTE.txt`: the school-first probe reports activation complete,
  mouse event names `mousedown/mouseup/click`, `openerClicks=0`,
  `widgetClickCount=0`, and `opened=false`. Its failure propagates to all nine
  fields. Forbidden clicks are zero; restoration/cleanup succeed. The handover
  verifies tip product bytes synced 9/9; this is not a stale #175 helper result.
- `CMS_EDU_DOM_HARVEST_2026-10-23-2030.md`, `harvest/field-school.json`, and
  `harvest/field-school-open.json`: the existing selection and visible dropdown
  link through `aria-controls` to an inner dropdown DIV. The degree mouse retry
  (`harvest/field-degree-xueli-open-mouse.json`) reports expanded ARIA and open
  class with no visible dropdown; these flags cannot prove opening. Isolated
  start/end captures establish the existing readonly calendar surfaces/portals.
- `prior-notes/cms-education-widget-open-notes-tip-d22734a9.md` and
  `prior-r2/STATUS_CODEX_CMS_EDU_WIDGET_OPEN_R2_2026-10-23.md` document #177's
  pre-mousedown replacement fix. R3 retains those binding checks.

#177 appended event names after calling an opener's overridable `dispatchEvent`.
R3 uses the owning window's `EventTarget.prototype.dispatchEvent` for the
controls probe's mouse activation and Escape/outside close signals. Each mouse
event must also reach a temporary document capture listener as the exact Event
object on the bound opener; the listener is removed in `finally`. Attempted
names and actually observed names are reported separately. This is native DOM
dispatch of synthetic events, not trusted browser input. An earlier capture
stop still fails with `event_not_observed`; no retry or toggle is attempted.

The Never-Save click guard independently counts the active probe's exact opener
click. It must receive exactly one before the open wait. Outside cleanup clicks
cannot supply this count, and host evidence requires one click and all three
observed events for each of the seven probes. Open confirmation requires one
visible, uniquely ARIA-linked dropdown; the bound root's open class may lag.
Foreign open roots, extra/foreign menus, and hidden linked menus still fail.
Close ownership, unchanged values/serialization, and closed overlays remain
required. No option/day, Save, Submit, Next, Deliver, or Delete is authorized.

`cms-education-widget-open-r3.test.mjs` compares an immutable activation helper
from the #177 blob (`58222ca8fb4d72339545d9579269c3c8a4b53312`) against R3.
A fictional inert instance `dispatchEvent` reproduces the exact supplied
complete-mouse/zero-count/unopened signature with #177, while R3 delivers one
counted activation and opens/closes all seven captured surfaces. Other cases
cover an earlier capture stop, body/duplicate click accounting, visible linked
menus before the open class, and hidden/ARIA-only negatives. Fixture event
handlers are explicitly fictional; the live JSON does not identify the site's
event interception mechanism. This regression fixes the demonstrated code gap
without claiming that mechanism is the established live root cause.

#174's timer tracking, autosave suppression, native text writer, restore/cleanup,
and `CONTROLS=0` path remain intact. No live CMS/CDP session or other workdir was
accessed. `liveSupportClaimed=false`; a separate Never-Save live retest is needed.

R3 offline validation: `node --test --test-concurrency=3` across every
`tests/cms-education*.test.mjs` passed **177/177**, zero failures/skips (including
**29/29** controls and **8/8** new R3 regressions; counts overlap). All five
changed/new JavaScript files pass `node --check`; `git diff --check` passes.
The immutable #177 comparison helper matches the base activation source.
Protected #174 blocks and autosave files match the exact base after newline
normalization. The existing props test's generated report was restored unchanged.

## R2 follow-up: zero counted opener clicks at #175

R2 starts at `2ffb6f6b3e55fbe3864a3d5fd8f32d3f6a17f62b`, fetched and
hard-reset before creating `codex/cms-edu-widget-open-r2`. The #175 notes below
are historical offline results, not proof that the live failure was fixed.

Evidence supplied in `_temp-scripts/cms-edu-widget-open-r2-materials/`:

- `REAL_USE_CMS_EDU_CONTROLS1_2ffb6f6b_2026-10-23.md`,
  `live/cms-education-live.controls1.json`, and
  `live/evidence-summary-extract.json` report `widget_open_failed` for all nine
  planned fields, `widgetClickCount=0`, forbidden clicks zero, empty non-GET and
  suppression logs, and successful restoration/cleanup. The handover verifies
  9/9 synced tip files, including the live runner and activation helper. Its
  documented Dev HEAD explains the JSON's different `tipSha` value.
- The controller visits school first. One aborted probe propagates its failure
  to all nine planned fields; these are not nine independent failed openings.
- `CMS_EDU_DOM_HARVEST_2026-10-23-2030.md`,
  `harvest/field-school.json`, `harvest/field-school-open.json`, and
  `harvest/field-degree-xueli-open-mouse.json` establish the existing opener and
  ownership selectors. The degree retry still reports `opened=false`; expanded
  ARIA and its hidden linked options remain insufficient proof.
- `prior-notes/cms-education-widget-open-notes.md` and
  `prior-notes/STATUS_CODEX_CMS_EDU_WIDGET_OPEN_2026-10-23.md` describe #175's
  offline tests, which did not model opener replacement during scroll/focus.

#175 pins the initial Element across preparatory scroll/focus. R2 permits a
fresh caller-validated opener only before the first mouse event, in the same
original wrapper, section, document, opener kind, and ARIA owner. Changed values
or serialization fail the probe. Once mousedown begins, replacement still
aborts; there is no retry, toggle, or retargeting of a partial press. The product
adapter receives the freshly located field after successful close.

The new fictional focus-render handler clones only the already harvested school
selection within its wrapper and rebinds test behavior using the existing
captured menu template. With the actual #175 helper injected in memory, this
regression fails with `widget_open_failed`, `widgetClickCount=0`, and successful
restoration. With R2 it passes: no mouse events reach the detached opener, the
replacement receives down/up/click, and all seven owned overlays open and close
without selecting any option/day or changing values. This reproduces and fixes
an uncovered zero-click mechanism; supplied live JSON does not identify the
exact rejected #175 guard or prove a live focus replacement occurred.

CONTROLS evidence now retains per-field activation stage/reason/event names,
opener click counts measured before close, owned-open/close booleans, and a reason
code, including unsuccessful cleanup.
These contain no DOM, applicant values, or request bodies. Both host verification
and exit classification require all seven complete, counted probes. A complete
mouse sequence without an owned visible overlay still fails. Existing linked
select ownership, calendar portal checks, and Never-Save click restrictions are
preserved; no new DOM selector or tenant was added.

The #174 timer tracking, autosave suppression, text writer, and `CONTROLS=0`
behavior are unchanged. No live CMS/CDP session was accessed for R2.
`liveSupportClaimed=false`; a separate Never-Save live retest is still required.

R2 offline validation:

- CMS education suite: **169/169 passed**, zero failures/skips.
- Controls suite: **29/29 passed**. After the final per-opener count requirement,
  the focus-replacement and fake-CDP host tests passed again (**2/2**), including
  rejection of a zero per-opener count despite other widget/cleanup clicks.
- Actual #175 helper substituted in memory: the new focus-replacement test
  intentionally fails with the zero-click signature described above. No source
  files were replaced for this comparison.
- Source/test syntax checks and `git diff --check` pass. #174 timer/XHR guards,
  restoration, and execution/text blocks match the base after newline
  normalization; the record controller and autosave test retain their base blobs.

The test counts overlap; they are not additive. No live result is claimed.

## Original #175 offline notes

Base: `13df12e56075e69bdb7d92403028da30620ed257`, including #173 and #174.
`liveSupportClaimed=false`. This change is offline tested; no live site support is claimed.

## Evidence boundary

The supplied evidence is outside the repository at
`C:\Users\admin\Desktop\ResumeQuickFill-Dev\_temp-scripts\cms-edu-widget-open-materials\`.

- `REAL_USE_CMS_EDU_RETEST_f3f32545_2026-10-23.md` and `STATUS_AFTER_EDU_RETEST_f3f32545_2026-10-23.md` describe the controls retest failure.
- `live/cms-education-live.json` and `live/cms-education-live.controls1.json` report nine failed fields with `widget_open_failed`, zero forbidden clicks and non-GET transmissions, and successful restoration/cleanup. A failed probe is not evidence that all nine widgets independently failed.
- `CMS_EDU_DOM_HARVEST_2026-10-23-2030.md` and `harvest/field-*.json` establish section `14`, the field wrappers, `.ant-select-selection[role=combobox]`, linked dropdowns, readonly calendar inputs, and calendar portals. No additional control markup is assumed.
- `harvest/retry-degree-mouse.mjs` and `harvest/retry-dates-degree.mjs` use mouse press/release on those captured surfaces. The mouse retry does not establish the site's React implementation or prove one exclusive cause for the retest timeout.

The 学历 opening captures, including `harvest/field-学历-open-mouse.json`, still report `opened=false`; `harvest/field-学历-options-extract.json` recovers options from a hidden linked dropdown. Neither those hidden options nor an open class/`aria-expanded=true` alone establish a successful live opening.

## Probe and regression coverage

The opt-in controls probe sends a mouse down/up/click sequence directly to the bound harvested opener, then requires an owned, visible overlay. It does not accept a click attempt as proof of opening, and it does not choose an option, calendar day, navigation action, clear control, or confirmation. Closing uses Escape/blur and the existing outside-click cleanup, waits for closure, and checks that the original DOM and serialization values remain unchanged. Hidden mounted dropdowns are compatible with a cleanly closed probe. If opening leaves only the bound select's open flag and its hidden linked dropdown, close-only ownership permits dismissing that residue; the opening result remains `widget_open_failed`.

`cms-education-controls-live.test.mjs` keeps its captured markup and explicitly fictional handlers. New event gates require a complete mouse sequence on the seven existing opener surfaces while each instance `.click()` is inert. Delayed opening, a no-op opener, asynchronous hiding of captured dropdowns, and a visible dropdown with a mismatched `aria-controls` owner cover the probe's success and failure boundaries. The city probe still uses only the first, harvested province menu; its legacy second-level fixture is not new harvest evidence.

Every successful fixture trial must retain exact values and serialization, avoid option/day replacement, block native POSTs and Save/Submit/Next/Deliver/Delete clicks, and report `liveSupportClaimed=false`. A foreign owner remains a failure and cannot authorize cleanup of an unrelated menu.

The #174 text autosave settle/suppression implementation and text-only test paths are unchanged. `CONTROLS=0` remains the existing narrow text path.

## Offline validation

The CMS education suite passed 162 tests with zero failures, including the
unchanged #174 autosave coverage. The final controls regression run passed all
25 tests with zero failures or skips. Source syntax checks and `git diff --check`
also pass. These are overlapping runs, not a combined unique-test count.

```powershell
$cmsTests = @(Get-ChildItem tests/cms-education*.test.mjs | ForEach-Object { $_.FullName })
node --test @cmsTests
node --test tests/cms-education-controls-live.test.mjs
node --check scripts/live/cms-education-live.mjs
node --check src/content/cms-education-multi-adapters.js
git diff --check
```

No live CMS tab was accessed for this change. A new Never-Save live retest is
still needed to establish live behavior; `liveSupportClaimed=false`.
