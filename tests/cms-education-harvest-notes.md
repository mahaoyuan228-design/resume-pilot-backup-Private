# CMS education controls: 2026-10-23 harvest boundary

This work starts at `3b51254e38268a69b3d478b1432ee6315fcbf37b`, including PR #172. It expands the school/calendar adapters, offline coverage, and an opt-in Never-Save control trial for the existing CMS education page. `liveSupportClaimed=false`. No live retest or live support claim is made.

## Supplied evidence

The source directory is outside the repository:

`C:\Users\admin\Desktop\ResumeQuickFill-Dev\_temp-scripts\cms-edu-controls-materials\`

Read these paths relative to that directory:

- `CMS_EDU_DOM_HARVEST_2026-10-23-2030.md`, `harvest-summary.json`, and `matched-fields-index.json`: scope, wrapper identities, options, and the unchanged-display/zero-save harvest report.
- `edu-section-static.json`: row wrappers and duplicate hidden school input. The visible school select and hidden manual input share `14_51_0`; the hidden input must never become a second write target.
- `field-school.json`, `field-school-open.json`: `.ant-select-selection[role=combobox]`, inline search, `aria-controls` linked dropdown, and an existing school catalog option.
- `field-degree-xueli.json`, `field-degree-xueli-options-extract.json`, `field-xuewei.json`, `field-xuewei-open.json`, `field-major-rank.json`, `field-major-rank-open.json`: the three ordinary selects and real option samples.
- `field-start-time.json`, `field-start-time-open-isolated.json`, `field-end-time.json`, `field-end-time-open-isolated.json`: readonly calendar inputs, day panels, full date titles, and header navigation. The harvest does not include opened year/month chooser panels.
- `field-city.json`, `field-city-open.json`: two selects in `.cascader-plugins-wrap`. The summary names the first `ant-select`, but the item HTML and two search inputs establish the province/city pair. Only the first menu was harvested; a second-level option list must be observed at runtime before selecting it.
- `field-major-name.json`, `field-major-name-autosave-clue.json`, `field-major-desc.json`, `field-major-desc-autosave-clue.json`: the two existing text controls and their autosave risk.
- `REAL_USE_CMS_EMPTYPREF_9242_RESULT_2026-10-23.md`: prior trial outcome and seven `control_not_supported` fields.

The fixture files retain structural evidence and use fictional applicant/school values where needed. Widget event handlers and public-props metadata in offline tests are synthetic test behavior, not harvested React implementation or new DOM evidence.

| Question | Harvest wrapper | Adapter path |
| --- | --- | --- |
| 学校 | `14_51_0` | school search / exact existing catalog option |
| 学历 | `14_53_0` | ordinary select |
| 学位 | `14_248_0` | ordinary select |
| 开始时间 | `14_49_0` | readonly day calendar |
| 结束时间 | `14_50_0` | readonly day calendar |
| 城市 | `14_52_0` | explicit province/city pair |
| 专业排名 | `14_102301_0` | ordinary select |

The section remains `.form-cell[id="14"]`, with labels read through `.ant-form-item-label label`. Identity and question ownership are resolved from the current DOM; historical synthetic fixtures use different item IDs and are not a site mapping.

## Safety and limits

- #172's armed, exact-endpoint XHR abort runs before native `send`. Opening a menu/calendar needs the same protection as text changes and restoration. The separately evidenced school `POST /wecruit/dic/fuzzyMatchDic` lookup is also aborted before send only during an active school probe, with its own suppression ledger. No request body or fake successful response is used. Matching fetch/beacon traffic, other endpoints/methods/tenants, and any CDP-observed non-GET remain failures.
- No Save, Submit, Next, Deliver, Delete, Add, or final submission is authorized by the trial. It permits only the active bound opener and owned outside-click cleanup. Option, day, navigation, clear, and confirmation clicks remain blocked, as do all form submissions.
- Private originals stay in the page. A successful trial requires exact DOM, public-props/DTO restoration, unchanged neighboring values, and settled callbacks. A failed restoration or pending callback retains interception and cannot report the page left as found.
- `CONTROLS=1` requires every widget original to equal its exact captured fixture value before any write. It probes owned open/close surfaces and then verifies preexisting values without replacing them. The city probe opens only the harvested first menu. Differing, empty, and unsupported originals fail preflight; widget replacement is exercised offline only. This avoids losing an original school after an aborted lookup, select synonym/code changes, or a province change that clears an unharvested city choice.
- Dates require a confirmed full `YYYY-MM-DD`; month-only facts are skipped. The harvested calendar path uses exact full-date cells and bounded header navigation. Missing, duplicate, disabled, unstable, or out-of-range targets are not guessed.
- School creation stays refused. Absent/ambiguous catalog matches and unavailable trusted search remain skips/failures with diagnostics. Blocking a fuzzy-school lookup cannot create a missing option or prove support.
- City requires an explicit province and city and an owned menu for each level. No province is inferred from a city, and missing second-level evidence/options remain a limit.
- Offline success proves behavior against the captured structures and fictional handlers only. No new CMS tenant, release acceptance percentage, or live-support status is introduced.

## Offline validation and optional trial usage

The focused regression command is:

```powershell
node --test tests/cms-education*.test.mjs
```

The broader CMS regression selection used for this change is:

```powershell
$cmsTests = Get-ChildItem tests -File | Where-Object {
  $_.Name -match '^cms-(education|school|select|region|degree|text|document|section|verification).*\.test\.mjs$' -or
  $_.Name -eq 'cms-known-partial.test.mjs'
} | Sort-Object Name | ForEach-Object { $_.FullName }
node --test @cmsTests
```

Final result: 26 files, 327 tests, 326 passed, zero failures, one existing skipped test. The skip is `cms-school-never-save.test.mjs`'s trusted-search/candidate race: jsdom cannot provide browser-trusted `insertText` events. The new harvest and controls tests all pass. Source syntax checks and `git diff --check` also pass.

The new tests are `cms-education-harvest-selects.test.mjs`, `cms-education-harvest-dates.test.mjs`, and `cms-education-controls-live.test.mjs`. The latter combines captured school/select/calendar markup with explicitly fictional public props, event handlers, and the existing fictional two-level region fixture. It tests the guarded trial through its actual controller/adapter entry points and fake CDP, without contacting a site.

The runner keeps its existing default text-only behavior. An optional future trial can use the already-open baseline CMS tab by setting `CONTROLS=1`, `PORT`, `ROW_INDEX`, and `OUTDIR`, then running `node scripts/live/cms-education-live.mjs`. `--help` describes the restrictions. This task did not attach to or run against a live CMS tab. The opt-in rejects a row if any of the seven widget displays differs from its captured fixture, so it must not be used as a general applicant replacement workflow.
