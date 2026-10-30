# Generic slider L1 writes and readback

Base: `17d83da3f64f1b190b369fe9caf3b70cc5ffc179`, targeting
`cursor/expand-night-ats-f861`. `liveSupportClaimed=false`; Never-Save.

The slider family accepts an explicit numeric target, writes a single value or
performs an owned rail click/thumb drag, then verifies the resulting value.
It adds no site selectors, field patches, field-ID inference or LLM calls.

| Control | Offline contract | Adapter and readback |
| --- | --- | --- |
| Native range | `<input type="range">`, one numeric value | `native-slider`; native numeric value and DOM readback. |
| Element UI slider | Vue 2.7.16, Element UI 2.15.14, owning `ElSlider`, one thumb | `el-slider`; public numeric `value` and the thumb's percentage position, converted through the confirmed bounds, must agree. |
| Ant Design Vue slider | Vue 2.7.16, ant-design-vue 1.7.8, owning `ASlider`, one thumb | `antdv1-slider`; public numeric `value` and owned handle `aria-valuenow` must agree. |
| Unknown ownership or mode | Unconfirmed component/version, multiple handles or unreadable value | Remain manual or unsupported. |

The real pinned distributions are disposable offline fixtures. They do not
establish the framework version or compatibility of any recruiting site.
AntD React and unreviewed versions remain outside this contract.

Facts use `{ value: 75 }` or an exact decimal string such as `{ value: '12.5' }`.
The optional `operation` is `set` (the default), `click` or `drag`. Every operation
uses the same explicit numeric destination and the same bounds/step validation;
pixel positions and percentages are not inferred from a field name. Native
omitted bounds use the platform defaults: minimum 0, maximum 100 and step 1.
Native step alignment uses an explicit valid `min`, otherwise the `value`
attribute, otherwise 0; Vue slider step alignment uses its confirmed minimum.

Vue `set` and `click` use the component's owned rail interaction; `drag` uses
its thumb and reviewed mouse/pointer sequence. Native `set` uses the native
value setter plus input/change events. Native click/drag also dispatch the
owned gesture sequence, then use that setter because untrusted events do not
execute the browser's built-in range default action. No direct Vue model
assignment or component emit substitutes for a component interaction.

Inspection and planning are passive. Writes remain default-off and require an
explicit per-effect guard. An already matching value produces effect-free
success. Sliders are absolute controls, so a different existing value can move
to the requested valid value. Disabled/readonly controls, range/multiple-thumb
modes, malformed numeric facts, unsupported operations, invalid bounds and
targets outside the bounds or step grid remain unwritable. Element `show-input`
compositions also remain manual in this slice. No ordinary text
writer can fill a slider thumb, rail or auxiliary number input as a fallback.

Executable plans retain their original MAIN-world target and owner binding.
Use the original plan object for write and verification; serializing a plan
does not authorize replay. Writers recheck ownership, mode, bounds, step and
enabled state before effects. Click and drag operate on the owned rail/thumb,
not a neighboring control. Verification reads the public component model
independently from the displayed thumb value, waits for settling and reports
`mismatch` or `reverted` when those reads disagree or later change. These values
do not prove persistence or server acceptance.
An interrupted gesture removes its owned listeners without a trailing
mouseup/change event or private dragging-state assignment. A component left
busy remains manual until the page or control is recreated or it recovers.

`tests/l1-slider-controls.test.mjs` covers the generic offline contracts and
failure boundaries. `tests/l1-slider-write-route.test.mjs` checks ordinary
candidate discovery, default-off writes, confirmed profile facts, retained
readback under the profile lock, single-slider form labels and ambiguous rows.
`tests/zoo/slider.spec.mjs` mounts native range plus actual
pinned `ElSlider` and `ASlider` controls on a disposable loopback page. Its three
checks cover passive planning, default-off writes, value writes, rail clicks,
thumb drags, repeated no-ops, public-model and DOM readback, copied-plan rejection,
guard failure, disabled/readonly/range outcomes, invalid facts, painted-thumb
mismatch and delayed model reversion. Neighboring values remain unchanged.

The zoo injects exact packaged bytes and exports evidence hashes plus a fixture
screenshot under Playwright output. All assets are fulfilled locally; unknown
URLs and non-GET requests are blocked. Tests require zero save/submit attempts,
zero non-GET traffic and a passing existing Never-Save guard. No live probe or
real business save/submit is involved. `liveSupportClaimed=false`.

Local reproduction from the repository root, with Node 24 and PowerShell:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
node --test tests/l1-slider-controls.test.mjs tests/l1-slider-write-route.test.mjs
node --test "tests/l1-*.test.mjs" tests/engine-manual-controls.test.mjs tests/product-paths-whitelist.test.mjs tests/never-save-guard.test.mjs tests/guard-worker-auto-runners.test.mjs tests/pack-side-effect-import.test.mjs tests/cms-row-d-network-guard.test.mjs tests/build-paid-rebuild.test.mjs
npx playwright install chromium
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-internal.ps1
npm run test:zoo -- slider.spec.mjs
npm run test:zoo
```

Local results: the combined Node command passed 743/743 checks, the focused
slider zoo passed 3/3, and the full zoo passed 115/115. `build-internal` produced
152 product files. The three slider evidence records each report zero non-GET
traffic and forbidden clicks, a passing Never-Save guard, and
`liveSupportClaimed=false`.

The slider zoo files are `tests/zoo/fixtures/slider.html`,
`tests/zoo/fixtures/slider.js`, `tests/zoo/slider.spec.mjs`, plus the fixed local
asset/case map in `tests/zoo/support.mjs` and test registration in
`tests/zoo/playwright.config.mjs`. The existing Never-Save policy is unchanged.
