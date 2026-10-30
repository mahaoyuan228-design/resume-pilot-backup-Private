# Generic input masks (L1)

`native.js` registers `native-input-mask`, `el-input-mask` and
`antdv1-input-mask` ahead of ordinary text adapters. They own one text/tel
input with explicit `mask` / `format` / `data-mask` / `data-format` evidence,
or isolated Element UI 2 / Ant Design Vue 1 Input props. Existing date,
time and other complex owners retain their own adapters.

Deterministic input metadata (type, autocomplete, name, id, associated labels)
must identify phone, identity or bank/card number. Supported fixed masks use
one digit token (`#`, `9` or `0`) with spaces, hyphens or parentheses. Phone
masks have 7–15 slots, bank masks 12–19, identity masks 15 or 18. An explicit
terminal `X` identity slot accepts a digit or checksum X. A leading phone `+`
is preserved; country codes and digits are never inferred.

Facts must be strings. NFKC normalization and removal of declared separators
produce the raw write value, preserving leading zeros and uppercasing checksum
X. Model and visible DOM values are canonicalized independently; both must
match, including the existing delayed and final batch readbacks. Existing
different values, partial/redacted values and ambiguous contracts stay manual.
Function formatters/parsers, optional masks and unknown framework ownership
are outside this contract; page formatting functions are never called directly.

Plans bind the original input, framework owner, mask contract and instruction.
The existing default-off ATS write flag, confirmed-profile lock and per-effect
guards apply. Unsupported explicit masks also claim the opt-in L1 route so
they cannot fall through to the ordinary text writer. Reinjection refreshes
the registry and engine revisions.

Reproduce locally with Node 24 after `npm ci --ignore-scripts`:

```powershell
node --test tests/l1-input-mask-controls.test.mjs tests/l1-write-route.test.mjs
node --test "tests/l1-*.test.mjs" tests/engine-manual-controls.test.mjs tests/product-paths-whitelist.test.mjs tests/never-save-guard.test.mjs tests/guard-worker-auto-runners.test.mjs tests/pack-side-effect-import.test.mjs tests/cms-row-d-network-guard.test.mjs tests/build-paid-rebuild.test.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-internal.ps1
npm run test:zoo
```

The three mask zoo cases use exact packaged bytes on disposable loopback
fixtures, native inputs and real Element UI 2.15.14 / ant-design-vue 1.7.8
Inputs with first-party fixture formatting listeners. Evidence includes raw
event payloads, readbacks, source hashes, screenshots and the existing
Never-Save guard: zero save/submit clicks and zero non-GET traffic, unchanged
neighbors. These are offline contracts only; `liveSupportClaimed=false`.

Validated on base `c5c7ee0fb99b919c5d720d4e753ac5132cfa16f3`: 18/18
mask unit checks (included in 893/893 L1 and related regressions), 129/129
full zoo checks (including three mask cases), and 154-file internal build
with allowlist and ZIP hash verification.
