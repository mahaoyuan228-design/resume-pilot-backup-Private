# Generic transfer / shuttle L1

Base: `36eea45461f7a0211c65ed070ff51ec000b63cd0`, targeting
`cursor/expand-night-ats-f861`. Never-Save; `liveSupportClaimed=false`.

The family uses owned public component data to resolve explicit keys or unique
labels. It writes by selecting real rows and clicking the appropriate direction
button. It never sets a component property, calls a component handler/emit, or
activates a business save/submit action. No site-specific selector, field/ID
inference, live probe or model service is involved.

| Adapter | Reviewed offline component | Model / independent visible readback |
| --- | --- | --- |
| `el-transfer` | Element UI 2.15.14, Vue 2.7.16 `ElTransfer` | Public `value` keys / right-panel row labels |
| `ant-transfer` | Ant Design Vue 1.7.8, Vue 2.7.16 `ATransfer` | Public `targetKeys` / right-list row labels |

These pinned disposable fixtures establish an L1 contract, without claiming
public live support or compatibility with other React/Vue versions. Unknown
owners, versions and incomplete/custom dual lists remain manual. Both lists
must expose all public options, with each checkbox row owned by this transfer.
Element `props` key/label/disabled mapping is supported. Ant row-key functions,
pagination, nested interactive item content and incomplete lazy rows are not
confirmed. Search-enabled lists work with an empty query.

```js
ResumeControls.plan(root, { value: ['Alpha', 'Beta'] }); // exact right-side set
ResumeControls.plan(root, { operation: 'add', value: ['Alpha'] });
ResumeControls.plan(root, { operation: 'remove', value: ['Beta'] });
ResumeControls.plan(root, { value: [] }); // explicit clear
```

Plans normalize operations to the final right-side key set. Model and DOM
readbacks compare sets, independent of library sorting. Numeric keys remain
numeric. Unknown/ambiguous/duplicate facts, changes to disabled items, active
searches, existing checked rows, hidden/readonly/disabled controls and unsafe
labels/actions fail closed. A matching set succeeds without events.

Plans bind the original root, owner, data contract, payload and starting
readback. Serialized/copied plans and stale values cannot authorize effects.
Each effect rechecks the existing write guard, ownership, visibility and row or
button identity. Verification reads model and visible rows separately and
checks again after settling, distinguishing mismatch and reversion.

The ordinary engine discovers one target per transfer, excludes internal
checkbox/search inputs from native filling, retains array facts through the
existing confirmed-profile path, and uses the default-off L1 write bridge and
profile lock. Batch verification retains the original plan and never replays a
failed or reverted write. Only the direct control API offers add/remove/clear;
ordinary filling consumes the confirmed profile value as the exact target set.

Reproduce from the repository root with Node 24 and PowerShell:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
node --test tests/l1-transfer-controls.test.mjs tests/l1-transfer-write-route.test.mjs
node --test "tests/l1-*.test.mjs" tests/engine-manual-controls.test.mjs tests/product-paths-whitelist.test.mjs tests/never-save-guard.test.mjs tests/guard-worker-auto-runners.test.mjs tests/pack-side-effect-import.test.mjs tests/cms-row-d-network-guard.test.mjs tests/build-paid-rebuild.test.mjs
npx playwright install chromium
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-internal.ps1
npm run test:zoo
```

The zoo uses exact packaged bytes on disposable loopback fixtures. All assets
are local; unknown requests and non-GET traffic are blocked. Each transfer
evidence record requires zero forbidden clicks/submits, zero non-GET traffic,
passing Never-Save checks and `liveSupportClaimed=false`.

Local results: transfer unit + ordinary route 23/23; combined L1/batch-readback,
packaging and guard regression command 871/871; full zoo 126/126 (including six
transfer cases). The internal build contains 154 product files. Its ZIP SHA-256
is `8c4bcc91f0f79e1d5a2cd25b814574f2acd40106c50360cc98800d417d003e1d`.
All six final transfer evidence records pass Never-Save with zero forbidden
clicks/submits and zero non-GET traffic.

Changed files:

| Area | Files |
| --- | --- |
| L1 family / binding | `src/content/controls/transfer-controls.js`, `src/content/controls/registry.js` |
| Ordinary write path | `src/background/controls-shadow.mjs`, `src/background/controls-write.mjs`, `src/content/engine.js` |
| Transfer unit / route tests | `tests/fixtures/transfer-harness.mjs`, `tests/l1-transfer-controls.test.mjs`, `tests/l1-transfer-write-route.test.mjs` |
| Reinjection assertions | `tests/l1-extended-controls.test.mjs`, `tests/l1-select-readback.test.mjs`, `tests/l1-textarea-richtext.test.mjs`, `tests/l1-write-route.test.mjs` |
| Zoo | `tests/zoo/fixtures/transfer.html`, `tests/zoo/fixtures/transfer.js`, `tests/zoo/transfer.spec.mjs`, `tests/zoo/support.mjs`, `tests/zoo/playwright.config.mjs`, `tests/zoo/README.md` |
| Packaging | `scripts/build-internal.ps1`, `scripts/build-paid.ps1`, `WHITELIST.json`, `SOURCE_INVENTORY.json`, `tests/product-paths-whitelist.test.mjs` |
| Contract / reproduction | `docs/ATS_TRANSFER_CONTROLS.md` |
