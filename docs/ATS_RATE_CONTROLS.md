# Generic rating/star L1 writes and readback

Base: `88309c6e0ffbb0e90337ff63ee2a171651453ac7`, targeting
`cursor/expand-night-ats-f861`. `liveSupportClaimed=false`; Never-Save.

The rate family accepts an explicit numeric destination with
`{ value: 4, operation: 'set' }` or `{ value: 2.5, operation: 'click' }`.
`set` is the default. Exact numeric strings are accepted. No field name, ID,
site selector, model inference or LLM is used to derive the destination.

| Control | Confirmed offline contract | Independent readback |
| --- | --- | --- |
| Element UI | Vue 2.7.16, Element UI 2.15.14, owning `ElRate`; adapter `el-rate` | Public numeric `value` and root `aria-valuenow` |
| Element Plus | Vue 3.5.44, Element Plus 2.14.7, owning `ElRate`; adapter `elplus-rate` | Public numeric `modelValue` and root `aria-valuenow` |
| Ant Design Vue | Vue 2.7.16, ant-design-vue 1.7.8, owning `ARate`; adapter `antdv1-rate` | Public numeric `value` and contiguous rendered full/half/empty stars with checked-state evidence |
| Explicit ARIA rating slider | `role="slider"`, explicit rating `aria-roledescription`, numeric bounds/current value; adapter `aria-rate` | Numeric `aria-valuenow` and independently parsed `aria-valuetext` such as `2 of 5 stars` |

Real pinned library distributions are used only on disposable offline fixtures.
Their versions establish no recruiting-site compatibility. Unconfirmed versions,
ordinary sliders and ambiguous component ownership remain manual.

Supported scales start at zero, have an integer maximum from 1 to 20, and use whole
stars or the reviewed library's `allowHalf` mode. ARIA ratings use whole steps.
Planning rejects malformed values, out-of-range values, off-grid fractions and
unknown operations. A matching existing value succeeds without events. Rating
values are absolute destinations, so another valid existing score may change.

Set operations use bounded standard keyboard events; click operations use
owned star UI interactions. No Vue property
assignment, component emit or handler call substitutes for user interaction.
Half-star clicks target the appropriate half of the owned star. Resetting a
rating to zero uses bounded keyboard interaction. ARIA set uses its standard
slider keys; positive clicks use the confirmed horizontal LTR rating geometry.
The ARIA key contract follows the
[W3C rating slider example](https://www.w3.org/WAI/ARIA/apg/patterns/slider/examples/slider-rating/).
An explicit zero-valued click requires the library's confirmed clear option;
otherwise it remains manual. A zero-valued set uses the keyboard path.

Inspection and planning are passive. The ordinary engine discovers one owned
target per rating, takes facts through existing confirmed-profile matching and
uses the default-off L1 write bridge. It retains verification under the profile
lifecycle lock. Standard Element/Ant form labels work only when their question
owns one editor; shared rows remain ambiguous. Unknown compositions have no
native text-writer fallback.

Executable plans bind the original MAIN-world target, component instance,
version, star nodes, constraints, operation and initial readback. Copied plans,
replaced owners/stars, changed constraints and stale values cannot authorize a
write. Each effect rechecks the existing guard, visibility, enabled/readonly
state and ownership. Hidden, disabled, readonly, nested editors, unsafe action
ancestors, labels that activate another control, frames and challenges remain
unwritable. Verification reads model and rendered state again, waits for
settling and distinguishes mismatch/reversion. Readback does not claim server
persistence.

`tests/l1-rate-controls.test.mjs` covers deterministic guard races, negative
contracts and actual pinned library mounts. `tests/l1-rate-write-route.test.mjs`
covers passive candidate discovery, ordinary opt-in fill, default-off and
unconfirmed facts, retained readback, labels/ambiguous rows and fallback refusal.
`tests/zoo/rate.spec.mjs` exercises all four families using exact packaged bytes,
including set, click, zero reset, half stars, repeated no-ops, bad facts,
guard/copied-plan refusal, mismatch and delayed reversion.

All zoo assets are fulfilled locally. Unknown URLs and non-GET requests are
blocked. Evidence requires zero save/submit attempts, zero non-GET traffic,
passing Never-Save checks and `liveSupportClaimed=false`. No live probe or
business form save/submit is performed.

Local reproduction (Node 24 and PowerShell, repository root):

```powershell
npm ci --ignore-scripts --no-audit --no-fund
node --test tests/l1-rate-controls.test.mjs tests/l1-rate-write-route.test.mjs
node --test "tests/l1-*.test.mjs" tests/engine-manual-controls.test.mjs tests/product-paths-whitelist.test.mjs tests/never-save-guard.test.mjs tests/guard-worker-auto-runners.test.mjs tests/pack-side-effect-import.test.mjs tests/cms-row-d-network-guard.test.mjs tests/build-paid-rebuild.test.mjs
npx playwright install chromium
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-internal.ps1
npm run test:zoo -- rate.spec.mjs
npm run test:zoo
```

Local results: focused control tests 77/77; ordinary write-route tests 28/28;
the combined L1/whitelist/guard command 848/848; full zoo 119/119, including all
four rating cases. `build-internal` produced 153 product files. Each final
rating evidence record reports zero non-GET traffic, zero forbidden click
attempts, a passing Never-Save verdict and `liveSupportClaimed=false`.

Changed files:

| Area | Files |
| --- | --- |
| L1 | `src/content/controls/rate-controls.js`, `src/content/controls/model.js`, `src/content/controls/registry.js` |
| Ordinary route | `src/background/controls-shadow.mjs`, `src/background/controls-write.mjs`, `src/content/engine.js` |
| Offline rating tests | `tests/fixtures/rate-harness.mjs`, `tests/l1-rate-controls.test.mjs`, `tests/l1-rate-write-route.test.mjs` |
| Reinjection regression expectations | `tests/l1-extended-controls.test.mjs`, `tests/l1-select-readback.test.mjs`, `tests/l1-textarea-richtext.test.mjs`, `tests/l1-write-route.test.mjs` |
| Packaging | `WHITELIST.json`, `SOURCE_INVENTORY.json`, `scripts/build-internal.ps1`, `scripts/build-paid.ps1`, `tests/product-paths-whitelist.test.mjs` |
| Zoo | `tests/zoo/fixtures/rate.html`, `tests/zoo/fixtures/rate.js`, `tests/zoo/rate.spec.mjs`, `tests/zoo/support.mjs`, `tests/zoo/playwright.config.mjs`, `tests/zoo/README.md` |
| Contract and reproduction | `docs/ATS_RATE_CONTROLS.md` |
