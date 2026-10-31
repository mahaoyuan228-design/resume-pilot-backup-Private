# Generic tree-select L1 writes and readback

Base: `37e8b3911d19185ea8d3ed77242ef2b848387ad3`, targeting
`cursor/expand-night-ats-f861`. `liveSupportClaimed=false`; Never-Save.

The tree-select family resolves an explicit fact against a control's loaded tree,
opens its owned dropdown, expands the required branches, clicks the confirmed
node and reads back both its scalar public model and visible label. The engine
adds no site selectors, field patches, field-ID inference or LLM calls.

| Control | Offline contract | Selection and readback |
| --- | --- | --- |
| Ant Design Vue TreeSelect | Vue 2.7.16, Ant Design Vue 1.7.8, owning `ATreeSelect`, loaded `treeData` | Click the owned tree's expansion controls and matching node; compare the public scalar value and selected-label DOM. |
| Element Plus TreeSelect | Vue 3.5.44, Element Plus 2.14.7, owning `ElTreeSelect`, loaded `data` | Use the component's owned tree popup and node; compare `modelValue` and the select's displayed label. |
| Searchable Element tree dropdown | Vue 2.7.16, Element UI 2.15.14, one owning `ElSelect` containing one `ElTree`, explicit `node-key` and string property mappings | Expand and click the loaded tree node; the page's ordinary node-click handler updates the select value and closes its dropdown. Verify the select's public value and displayed label. |
| Unknown tree or ownership | Missing component, version, data, node identity or panel relationship | Remain manual or unsupported, without ordinary text/select fallback. |

Element UI 2 has no native TreeSelect; its composition above is a separate
contract. These real pinned distributions are offline fixtures, not evidence
of a recruiting site's framework or live support.
AntD React and unreviewed library versions remain outside this contract.

The `element-plus` and aliased `vue3` dependencies are development-only offline
fixtures. The product runtime does not import or package them. `.npmrc` enables
`legacy-peer-deps` because the pinned Vue 2 and Vue 3 libraries have different
peer requirements; tests load their browser distributions separately and never
resolve Element Plus against the application's Vue 2 package.

Facts use `{ value: 'Leaf' }`, the exact primitive code such as `{ value: 30 }`,
or a complete label/code path such as `{ value: ['Root', 'Branch', 'Leaf'] }`.
The result contains a scalar `value`/`modelValue` and the leaf's `domValue` label;
the path identifies a node and does not become an array model. A label must
resolve uniquely across the loaded tree unless the full path disambiguates it.
Codes retain their primitive type. No value is invented from a field name or
from the search query. Searchable controls still require a confirmed loaded
node; typing alone cannot establish a successful selection.

Inspection and planning are passive. Writes remain default-off and require an
explicit per-effect guard. A matching existing model and display produce an
effect-free success; different existing values are preserved. Disabled nodes
and ancestors, disabled/readonly controls, missing or ambiguous nodes, unsupported
multiple/checkable modes, nonterminal targets, lazy/remote data and unconfirmed property mappings
remain unwritable. No component emit or direct model assignment substitutes
for a node click.

Executable plans retain their original MAIN-world target and owner binding.
Use the original plan object for write and verification; serializing the plan
does not authorize replay against another control. Before effects, the writer
rechecks the control, tree, options, disabled state and owned popup. Verification
checks the scalar model separately from the selected-label DOM, waits for
settling and reports `mismatch` or `reverted` for disagreement or later change.
These public readbacks do not prove persistence or server acceptance.

Inputless TreeSelect roots participate in ordinary form-item label ownership
only after MAIN confirms their adapter. Other editors in a shared row still
make that label ambiguous. Portalled tree query inputs are excluded from
ordinary field discovery in both default-off and opt-in modes; they cannot
be filled as native text or reported as a selected tree value.

`tests/l1-tree-select-controls.test.mjs` covers the offline contract and guard
boundaries. `tests/l1-tree-select-write-route.test.mjs` exercises generic candidate
grouping and the existing opt-in writer route without field-specific bindings.
`tests/zoo/tree-select.spec.mjs` mounts all three real component
configurations on a disposable loopback page. Its nine checks exercise passive
planning, the default write gate, real expansion/node clicks, model and visible
readback, repeated no-ops, replay rejection, ambiguous/disabled/multiple outcomes,
painted-label mismatch and delayed reversion. Neighbors remain unchanged.

The zoo injects exact packaged source bytes and writes evidence hashes plus a
fixture screenshot under Playwright output. All assets are fulfilled locally;
unknown requests and non-GET requests are blocked. Tests require zero save or
submit attempts, zero non-GET traffic and a passing existing Never-Save guard.
No live probe, real business save/submit or live compatibility claim is included.

Local reproduction from the repository root, with Node 24 and PowerShell:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
node --test tests/l1-tree-select-controls.test.mjs tests/l1-tree-select-write-route.test.mjs
node --test "tests/l1-*.test.mjs" tests/product-paths-whitelist.test.mjs tests/never-save-guard.test.mjs tests/guard-worker-auto-runners.test.mjs tests/pack-side-effect-import.test.mjs tests/engine-manual-controls.test.mjs
node --test tests/build-paid-rebuild.test.mjs tests/product-paths-whitelist.test.mjs
npx playwright install chromium
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-internal.ps1
npm run test:zoo -- tree-select.spec.mjs
npm run test:zoo
```

Changed files:

| Area | Files |
| --- | --- |
| L1 contracts | `src/content/controls/tree-select-controls.js`, `src/content/controls/model.js`, `src/content/controls/registry.js` |
| Ordinary route | `src/content/engine.js`, `src/background/controls-shadow.mjs`, `src/background/controls-write.mjs` |
| Offline tree tests | `tests/l1-tree-select-controls.test.mjs`, `tests/l1-tree-select-write-route.test.mjs`, `tests/fixtures/tree-select-harness.mjs` |
| Contract revision / inventory assertions | `tests/l1-extended-controls.test.mjs`, `tests/l1-select-readback.test.mjs`, `tests/l1-textarea-richtext.test.mjs`, `tests/l1-write-route.test.mjs`, `tests/product-paths-whitelist.test.mjs` |
| Zoo | `tests/zoo/tree-select.spec.mjs`, `tests/zoo/fixtures/tree-select.html`, `tests/zoo/fixtures/tree-select.js`, `tests/zoo/support.mjs`, `tests/zoo/playwright.config.mjs`, `tests/zoo/README.md` |
| Packaging / test dependencies | `scripts/build-internal.ps1`, `scripts/build-paid.ps1`, `WHITELIST.json`, `SOURCE_INVENTORY.json`, `package.json`, `package-lock.json`, `.npmrc`, `THIRD_PARTY_NOTICES.md` |
| Contract documentation | `docs/ATS_TREE_SELECT_CONTROLS.md` |
