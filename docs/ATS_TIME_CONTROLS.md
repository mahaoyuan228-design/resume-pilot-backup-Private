# Generic time controls: L1 write, panel selection and readback

Base: `4c5b060d6bbf10d2c2d1b36e307c25daf8cc73b2`. These first-party contracts use HTML input type, component ownership, library version and explicit time precision. They add no site URLs, resume-field mappings, field-ID inference or LLM calls. `liveSupportClaimed=false`.

| Control | Detection and planning | Write and readback |
| --- | --- | --- |
| Native time | Native-owned input whose actual and declared types both equal `time`. Facts use exact local `HH:mm` or `HH:mm:ss`; hours 00–23, minutes/seconds 00–59. HTML min/max/step constrain the target, including a range crossing midnight. Step is in seconds (default 60), based on min, initial value or midnight. Unknown constraints, disabled/readonly controls and different existing values stay manual. | Existing guarded HTML setter and input/change/blur path. Public input `value` is authoritative; the shared verifier samples it twice. The browser-owned native time popup is not automated. |
| Ant Design Vue 1 TimePicker | Confirm owning Vue 2 `ATimePicker`, library major 1 and a single value input. Display format must be `HH:mm` or `HH:mm:ss` (component default). Explicit `valueFormat` must match; absent `valueFormat` uses the component's Moment model. | Open exactly one owned time panel, click the hour/minute/(second) options, then close that owned panel with Escape. No raw input assignment or synthetic component emit fallback. Read visible text and the public Moment/string model serialized at the confirmed precision. |
| Element UI 2 TimePicker | Confirm owning Vue 2 `ElTimePicker`, library major 2 and a single time input. Formats are `HH:mm` / `HH:mm:ss` (component default); explicit `valueFormat` must match. The default model is a local Date. | Associate the panel with the component instance, click its hour/minute/(second) spinner cells and the component-local confirm button. Public Date/string model and visible text must agree. No business-form confirmation, save or submit button is clicked. |
| Unknown time surface | Time-picker hints with missing ownership/version, custom or 12-hour formats, ranges and ambiguous panels are not writable contracts. | `time-unknown` prevents ordinary text fallback. No panel or value effects occur during detection/planning. |

Time values are local wall-clock values. There is no timezone conversion, date synthesis or profile schema guessing. The ordinary route still requires the existing confirmed-profile fact resolver and explicit write opt-in. A different nonempty value is preserved. A successful readback proves only agreement of the public control model and display in the inspected page; it does not prove server acceptance or persistence.

Writers use the shared per-effect guard and recheck target ownership and configuration. Disabled options and ambiguous or already-open panels fail closed. Unknown library majors, unsupported precision and unconfirmed models remain manual. The Ant display input's library-managed `inputReadOnly` does not by itself make its panel readonly; a disabled or readonly component still cannot be written. Element initializes an empty value while opening its panel: the writer accepts that single transition only when the same owner's visible panel Date, public model and display agree, before selecting the requested time.

Executable time plans remain bound to their original MAIN-world control owner and configuration. Reuse the original plan object for write and verify; a JSON/structured-clone copy is observation data and cannot replay that authority on another control. The zoo keeps the original object in its disposable MAIN world for the later mismatch/reversion checks.

`tests/l1-time-controls.test.mjs` provides offline Node/jsdom contract checks. `tests/zoo/time.spec.mjs` adds seven browser cases on loopback: passive native/default gate, native minute/second writes and constraints, default and explicit models for each pinned Vue library, and unknown/12-hour formats. The four component cases require actual hour/minute cell clicks, closed panels, unchanged neighbors and independent public-model readback; DOM-only changes produce mismatch, and delayed changes produce reverted. Fixtures use Vue 2.7.16, Ant Design Vue 1.7.8 and Element UI 2.15.14 from the lockfile, with no captured recruiting page.

The zoo checks exact packaged source bytes and hashes, fulfills every allowed request from its local asset map, and aborts unknown requests. The existing network guard must report zero non-GET requests, zero forbidden click attempts and a passing Never-Save assessment. No live compatibility, live site run, business save/submit or UL recapture is claimed. Existing guard policy and `throwOnSideEffect` are unchanged.

Run from the repository root with Node 24:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
node --test tests/l1-time-controls.test.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-internal.ps1
npm run test:zoo -- time.spec.mjs
```

Run the broader local regressions with `node --test "tests/l1-*.test.mjs" tests/product-paths-whitelist.test.mjs tests/never-save-guard.test.mjs` and `npm run test:zoo`.
