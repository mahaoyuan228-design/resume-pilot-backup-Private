# L1 control registry: PR-2 shadow boundary

This document records #229's original boundary. [R2](ATS_ENGINE_R2.md) adds the deferred adapter entries, section vocabulary, confirmed domain memory and a default-OFF production writer. `inspectControls` itself remains read-only.

Base: `8dcd68619cdad860f1402e56196fc61aefd881f0` (#227). This slice adds the L1 registry and an explicit diagnostic bridge. Existing CMS/GTH writers and production message routes remain unchanged. There is no automatic cutover to a new writer.

## Contract

`src/content/controls/registry.js` registers adapters by descending priority, preserving registration order for ties. The first matching, version-confirmed adapter wins. Each adapter exposes `name`, `lib`, `type`, `libVersionProbe`, `matches`, `readModel`, `readOptions`, `plan`, `write`, and `verify`. The registry builds these methods from each module's specification; native and Vue modules share the planner, effect guards and verifier.

Plans use `planned`, `success` (only a matching existing DOM and model), `unsupported`, or `manual`. A planned target is not a successful write. Verification separately returns `success`, `mismatch`, `reverted`, or `unsupported`; both the component value and visible value must match. A second sample detects reversion. Existing different values are preserved. Checkbox selections only increase.

`src/background/controls-shadow.mjs` exports `inspectControls(api, tabId, requests)`. It requires an active HTTP(S) tab, injects the packaged control modules into `world: 'MAIN'`, `frameIds: [0]`, and checks the URL and visibility before reading. Requests contain an explicit unique selector, field identifier and fact value. Missing or ambiguous selectors fail closed. The returned plans contain serializable observations; Vue instances, React fibers and handlers remain in the page. No runtime message handler invokes this bridge and it never calls `write`.

The MAIN inspector reads Vue 2 reactive props normally, including getters, and prioritizes the owning Select/DatePicker/Cascader over internal Input components. Moment/Date values retain the explicitly observed `valueFormat` precision. React fiber and Vue 3 observations are diagnostic only; neither can fall through to a native writer. Existing CDP default-context selection, `throwOnSideEffect`, network guards and production visibility checks are untouched.

## Implemented adapter entries

| Family | Entries | Evidence boundary |
| --- | --- | --- |
| HTML | text, textarea, select, radio, checkbox; upload always manual | Native value/checked is the HTML control model; select/radio codes are separate from display labels. |
| Element UI 2 | input, textarea, select, radio, checkbox, date, month, two-editor month range, cascader | Requires Vue 2 component identity and an observed library version export. Zoo uses 2.15.14; the live GTH version is unverified. |
| ant-design-vue 1 | input, textarea, flat select, search select, radio, checkbox group, date, month, cascader | Requires Vue 2 component identity and an observed library version export. Zoo uses 1.7.8. |
| hotjob pair | Two dependent ant-design-vue selects | Each child is independently probed. The second select's initial dependency-disabled state is distinguished from a site-disabled field. |
| GTH plugin-dialog | No generic claim | Retained in the unchanged legacy writer; its site contract belongs to L3. |
| iView/ViewUI, ud/Formily, phoenix, antd-mobile | Pending samples; no claimed adapter | No selectors, versions, or internal handlers are guessed. AntD React v4 is a later slice. |

Version exports can be absent in real bundled sites. Those controls return `unsupported` even if their classes look familiar. Element Plus, ant-design-vue 3/4 and unknown versions are not accepted by these Vue 2 adapters.

Search and dependent-select plans explicitly mark unresolved options. A requested label is never reported as an observed backend ID. UI execution must find a unique enabled exact option, and final component/DOM verification still applies. Unsupported date formats, invalid precision, ambiguous options, different existing values and unavailable models fail closed. Dates currently accept explicit `YYYY-MM`/`yyyy-MM` or `YYYY-MM-DD`/`yyyy-MM-dd` value formats. Display formats with different text require further evidence. Internal date fallback refuses custom `disabledDate` constraints when they cannot be checked through the UI.

## Effect boundary

Adapter writers are present for disposable offline fixtures, with no connection to production fill entry points. Calling `write` without both `allowWrite: true` and a per-effect `check()` returns `unsupported / shadow_mode`, with zero attempts. At execution they recheck component identity/version, existing values and the planned option labels. UI effects recheck visibility, disabled state and action restrictions. Date/month controls use the panel when its structure is known; only restricted date fallbacks can emit component events. Select and cascader writers do not call internal `onChange` or `$emit`.

Single-path Element UI / ant-design-vue cascaders require an observed complete leaf path and an instance-owned panel. Each level rechecks its column and exact label; verification compares model codes with the actual display text (including Element's separator and leaf-only display). ARIA cascaders retain their reviewed synthetic contracts and recheck `aria-controls` ownership. Unknown lazy leaves, multiple paths, custom field mappings and custom renderers remain unsupported. Plans cannot be replayed on another widget or from serialized diagnostics. `liveSupportClaimed=false`; these checks establish offline support only.

The shared click sequence uses pointerdown, mousedown, focus, mouseup and click. It rejects save/submit/next/apply/delete actions, navigation links and implicit submit buttons. Uploads, explicit iframe/captcha targets, shadow-root targets, disabled and site-readonly controls are manual. A readonly date/select display input is a normal widget contract. The bridge does not traverse frames or inaccessible shadow trees, bypass challenges, open editors, save, submit, or restore live pages.

## Offline comparison and limits

`tests/zoo/legacy-baseline.json` is preserved. Legacy implementations have no common plan API, so this PR compares L1 shadow targets against actual legacy executions and their accepted DOM/MAIN fixture readbacks. It does not invent old plans or claim a live zero-difference comparison.

| Fixture | Expected comparison |
| --- | --- |
| CMS school search | L1 target equals actual legacy DOM/model acceptance. |
| hotjob pair | Both L1 targets equal actual legacy DOM/model acceptance; dependent options remain explicitly deferred before UI execution. |
| GTH employment month range | Both L1 targets equal actual legacy DOM/model acceptance. |
| CMS `englishExamDate` | Explicit difference: L1 can plan/write the synthetic month component; the legacy day writer rejects month-only precision. This does not establish the live component's identity or acceptance. |
| GTH plugin-dialog | Explicit difference: legacy fills the fixture; generic L1 leaves the site-specific control unsupported. |

Every shadow call must leave model snapshots, neighboring controls and overlays unchanged. New L1 writers are exercised separately against locally routed synthetic components with both readbacks and Never-Save evidence. The original POST-injection test still requires a failed safety verdict with the request blocked. Recruitment servers and existing browser profiles are never used by the zoo.

Run Node 24 `node --test --test-concurrency=1`, `node scripts/build-paid-smoke.mjs`, regenerate the inventory, build the internal extension and run `npm run test:zoo`. The zoo checks every packaged product file against the checkout before injecting. The full Windows suite also needs the existing ignored EXAMPLE license PEM fixtures, `OPENSSL_BIN`, and installed test browser paths; these local fixtures are not product files.

No live probes or commercial-score changes are included. `liveSupportClaimed=false`; booked stays 70 (+0). L2 vocabulary, domain memory, LLM, L3 migration and the 20-site runner are outside this PR. All new implementation is first-party; no research-repository code or MPL-2.0/AGPL/proprietary/unlicensed source is imported.
