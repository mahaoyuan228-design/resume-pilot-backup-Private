# L1 radio / checkbox / switch

This change is offline-only evidence. `liveSupportClaimed=false`; Never-Save.
The existing write opt-in and per-effect guard remain required.

Supported contracts:

- Native radio groups follow tree, name and form ownership, including external
  `form=` inputs. Native checkbox and checkbox-backed `role="switch"` use boolean facts.
- Vue 2 Element UI 2 Radio/Checkbox groups, standalone Radio/Checkbox, and Switch.
- Vue 2 Ant Design Vue 1 Radio/Checkbox groups, standalone Radio/Checkbox, and Switch.
  Component identity and the page library version must be confirmed.
- Radio facts resolve one observed option code or label. Checkbox groups add
  observed choices while preserving existing checks. Standalone checkbox/switch
  facts use booleans or exact custom model codes where the component supports them.
- Selected radio values and checked toggles are preserved. Nothing toggles an
  existing selection off. Ambiguous, disabled, readonly or inconsistent state stops.

Model values keep their primitive types. Group checkbox readback follows DOM option
order so request/model array order does not cause a false mismatch. DOM checked
state and the owning Vue model must agree; verification samples again after settling
to detect reversion. Switch readback uses the pinned component's native checked
input or checked class when that component omits ARIA state; explicit invalid ARIA
state is rejected.

Executable choice plans stay bound in MAIN to the original root, component instance
and version. Each pointer/click effect rechecks ownership, option identity, state and
guards. No engine/site selectors or profile-to-field matching changes are included.

Local reproduction from the repository root (PowerShell):

```powershell
npm ci --ignore-scripts
node --test tests/l1-choice-controls.test.mjs tests/l1-native-controls.test.mjs
node --test "tests/l1-*.test.mjs" tests/product-paths-whitelist.test.mjs tests/guard-worker-auto-runners.test.mjs tests/pack-side-effect-import.test.mjs tests/never-save-guard.test.mjs tests/cms-row-d-network-guard.test.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-internal.ps1
# Use the extension directory printed by the build above:
$env:ZOO_EXTENSION = '<build directory>\extension'
npm run test:zoo
```

The unit suite includes real pinned Vue/library components in JSDOM. The packaged
Chromium zoo additionally covers external form radio activation and native switch
write/readback. Zoo web resources are served locally and unknown requests abort;
positive write cases retain zero non-GET traffic and zero blacklisted clicks.
The native unit fixture documents JSDOM's external-form radio activation limitation;
Chromium checks preservation of the checked unowned neighbor.

Validated locally: 304/304 L1/whitelist/guard tests, 73/73 zoo tests, internal
build with 148 product files. The new choice test file contains 37 tests.

Changed files:

- `src/content/controls/model.js`: choice ownership and typed component model metadata.
- `src/content/controls/native.js`: radio form ownership, switch and per-effect guards.
- `src/content/controls/registry.js`: choice plan binding and strict typed verification.
- `src/content/controls/vue-controls.js`: generic choice models, plans and guarded clicks.
- `tests/l1-choice-controls.test.mjs`: synthetic and real Vue/library offline regressions.
- `tests/l1-native-controls.test.mjs`: native form, switch and event-guard regressions.
- `tests/l1-extended-controls.test.mjs`, `tests/l1-select-readback.test.mjs`,
  `tests/l1-upload-controls.test.mjs`: model/registry reinjection revision assertions.
- `tests/zoo/l1.spec.mjs`: packaged native switch and external-form radio checks.
- `docs/ATS_CHOICE_CONTROLS.md`: contract scope and reproduction commands.
