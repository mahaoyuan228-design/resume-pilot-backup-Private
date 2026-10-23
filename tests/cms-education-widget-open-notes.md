# CMS education widget open/close regression

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
