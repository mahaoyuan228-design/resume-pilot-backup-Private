# Generic date ranges: L1 write, panel selection and endpoint readback

Base: `ecbb90e58134ad6dd4dc8fc9ceb8807badbdbf42`. These first-party contracts use the control structure, HTML input types, component ownership and pinned library versions. They add no site selectors, resume-field mappings, field-ID inference or LLM calls. `liveSupportClaimed=false`.

Facts use `{ value: ['2024-02-01', '2024-02-29'] }`: two exact local `YYYY-MM-DD` dates, years 1900–2100, in ascending order. A same-day range is valid. Month-only values, times, reversed ranges, impossible dates and partial endpoints are not writable facts. The dates are local calendar values with no timezone conversion.

| Control | Contract | Write and readback |
| --- | --- | --- |
| Native date pair | An explicit `fieldset`, `[data-date-range]` or `[role="group"]` range containing exactly two native-owned inputs whose actual and declared types equal `date`. Group order defines start and end. | Use the existing guarded HTML setter and input/change/blur events. Read both public input values; the browser-owned native calendar popup is not automated. |
| Ant Design Vue RangePicker | Owning Vue 2 `ARangePicker`, Ant Design Vue major 1, and two confirmed date inputs. | Use the component's owned range calendar and select both endpoints. Read the public Moment pair, or the explicit formatted string pair, independently from both displayed inputs. |
| Element UI RangePicker | Owning Vue 2 `ElDatePicker` with `type="daterange"`, Element UI major 2, and two confirmed date inputs. | Use the component's owned range panel and select both endpoints. Read the public local Date pair, or the explicit formatted string pair, independently from both displayed inputs. |
| Start/end calendars | An explicit range group with exactly two independent supported Element/Ant single-date components. | Select the start and end in their respective owned calendars. Verify each endpoint before continuing and verify the complete pair afterwards. |
| Unconfirmed range | Missing ownership/version/format evidence, ambiguous grouping, incompatible precision or unowned panels. | Stay manual; the range contract prevents ordinary text fallback and causes no effects during inspection or planning. |

Element display/value formats must be `yyyy-MM-dd`; Ant formats must be `YYYY-MM-DD`. An absent `valueFormat` retains the library's Date/Moment model. Native endpoint `min`, `max` and `step` apply independently; unsupported constraint syntax remains manual. A matching existing endpoint can be retained while the empty peer is filled. The generic candidate broker exposes a confirmed range once at its shared root, without guessing a resume field or inventing range facts.

The shared writer remains default-off and requires an explicit per-effect guard. Plans preserve existing different values, including a conflicting single endpoint, and reject disabled or readonly controls. Writers recheck ownership, structure, configuration and endpoint state before effects. Panel selection uses only a confirmed component-owned overlay and never a business-form save or submit action. There is no raw component emit or model-assignment fallback.

Executable range plans retain their MAIN-world owner binding. Write and verify with the original plan object; a serialized observation does not authorize replay against another control. Verification checks both model endpoints and both DOM endpoints, waits for settling, and reports mismatch or reverted when either endpoint disagrees or changes later. Agreement proves only the public control state in the inspected page, not server acceptance or persistence.

`tests/l1-date-range-controls.test.mjs` exercises the offline contracts and guard boundaries. `tests/zoo/date-range.spec.mjs` uses disposable loopback fixtures with actual Vue 2.7.16, Ant Design Vue 1.7.8 and Element UI 2.15.14 from the lockfile. The zoo loads exact built source bytes, requires real calendar-cell clicks for component cases, checks independent public models and unchanged neighbors, and rejects unknown requests. Its existing network guard requires zero non-GET requests and a passing Never-Save assessment. No live compatibility, live-site validation or business save/submit is claimed.

Run from the repository root with Node 24:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
node --test tests/l1-date-range-controls.test.mjs
node --test "tests/l1-*.test.mjs" tests/product-paths-whitelist.test.mjs tests/never-save-guard.test.mjs tests/guard-worker-auto-runners.test.mjs tests/pack-side-effect-import.test.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-internal.ps1
npm run test:zoo -- date-range.spec.mjs
npm run test:zoo
```
