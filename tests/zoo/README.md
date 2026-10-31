# Offline ATS control zoo

R2 adds eight per-adapter checks in `extended.spec.mjs` and the ordinary production message route in `write-route.spec.mjs`; see [the R2 contract](../../docs/ATS_ENGINE_R2.md). The original legacy baseline and five shadow comparisons remain intact. iView uses actual pinned 3.5.4 components. Ud/phoenix use explicitly synthetic contract replays, with production versions still pending samples. `liveSupportClaimed=false`.

The combined suite contains 126 tests: eight legacy checks, eighteen L1 checks (including the generic manual boundary), eight extended-adapter checks, eighteen ordinary-route checks, fifteen Batch B control-pattern checks, seven generic upload checks, seven generic date checks, seven generic time checks, ten generic date-range checks, nine generic tree-select checks, three generic switch checks, three generic slider checks, four generic rating checks, six generic transfer checks and three generic HAR checks; see [the upload contract](../../docs/ATS_UPLOAD_CONTROLS.md), [date detect/plan/readback contracts](../../docs/ATS_DATE_CONTROLS.md), [time write/panel/readback contracts](../../docs/ATS_TIME_CONTROLS.md), [date-range endpoint contracts](../../docs/ATS_DATE_RANGE_CONTROLS.md), [tree-select contract](../../docs/ATS_TREE_SELECT_CONTROLS.md), [switch contract](../../docs/ATS_L1_SHADOW.md#switch-and-toggle-controls), [slider contract](../../docs/ATS_SLIDER_CONTROLS.md), [transfer contract](../../docs/ATS_TRANSFER_CONTROLS.md), [section navigation plans](../../docs/ATS_SECTION_NAVIGATION.md) and [HAR scaffold guide](../../docs/ATS_HAR_OFFLINE.md). The manual-boundary check locally fulfills a cross-origin iframe and requires iframe/captcha/unknown/broken controls to remain manual with zero effects or frame reads. The ordinary-route checks exercise the flag-absent legacy path plus explicit opt-in native and synthetic Ud-select writers. `resumeAtsEngineWriteEnabled` remains absent by default; no UI turns it on automatically.

The legacy suite records existing adapter behavior at base `f07879e1caa24e6f7f09bf6c59e30b7098d89b6b` (#226). PR-2 started from `8dcd68619cdad860f1402e56196fc61aefd881f0` (#227) and added L1 shadow planning and disposable offline writer checks. That original slice did not implement L2 semantics, L3 profiles or the live batch runner; R2's L2 and opt-in route are documented separately.

## Run

Use Node 24 and PowerShell from the repository root:

```powershell
npm ci
npx playwright install chromium
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-internal.ps1
npm run test:zoo
```

The runner selects the newest internal build under `dist`; set `ZOO_EXTENSION` to an explicit unpacked `extension` directory to select another build. The adapter bytes must match the checkout. `ZOO_HEADED=1` opens a dedicated test browser; it never attaches to an existing Edge session. Temporary browser profiles are isolated and removed after each case. Generated Playwright output stays outside the source inventory.

## Fixtures and interpretation

The legacy, L1, extended and ordinary-route suites load the built extension and execute its shipped adapter files through `chrome.scripting.executeScript`. Exact CMS/GTH HTTPS URLs preserve production host and page checks; the ordinary-route fixture uses an offline synthetic host. Batch B and the upload suite use loopback and separate browser worlds as described below. Every web request is fulfilled from a fixed local asset map or aborted; there is no network fallback to a recruiting server.

| Required scenario | Fixture | Evidence and limits |
| --- | --- | --- |
| CMS `englishExamDate` | Ant Design Vue 1.7.8 `AMonthPicker` | Legacy characterization remains unsupported for month-only input. L1 adds a shadow plan and a separate offline component writer check. #226's live panel observation does not establish the production component's MonthPicker identity. |
| CMS school search | Actual Ant select with delayed search options | Existing `cms-school-search.js` layout; school names and results are synthetic. |
| Hotjob dual select | Actual Ant selects in the existing paired-container structure | Repository region probes and existing adapters supply the DOM contract; options are synthetic. |
| GTH employment month range | Two actual Element month controls | Existing work-editor contract and `gth-open-fill.js`; both model and visible dates are checked. |
| GTH plugin-dialog picker | Minimal custom DOM replay | Repository census and existing picker contract; synthetic category path. This is a GTH-specific replay, not a generic cascader. |

Vue 2.7.16 and Ant Design Vue 1.7.8 match the handover. Element UI 2.15.14 is a selected offline fixture version; GTH's live version remains unverified. The original five cases exclude iView, antd-mobile, Moka and Feishu. R2 adds actual iView 3.5.4 and synthetic ud/phoenix cases; their live samples remain pending. Exact dependency versions and integrity hashes are in `package-lock.json`; copyright notices and upstream commits are in `THIRD_PARTY_NOTICES.md`.

The checked-in legacy baseline is an expectation, not a support matrix. A green suite means the existing result, visible DOM, MAIN-world fixture model, neighboring fields and safety evidence match that expectation. Known unsupported or fail-closed behavior must remain explicit. Future adapter work must explain each intentional baseline change instead of silently accepting new output.

## L1 checks and comparison limits

`l1.spec.mjs` imports the built `src/background/controls-shadow.mjs` from a script-free extension document, then calls its real `chrome.scripting.executeScript` MAIN-world path. MV3 service workers disallow dynamic imports, so the harness uses this isolated extension document without adding a product test hook. Module requests are fulfilled only from this loaded extension's product allowlist and built bytes. Every used bridge and adapter is checked against the checkout and hashed in the evidence.

The five shadow cases require the fixture model, effects, application DOM and closed overlays to remain unchanged. The tests then invoke actual legacy writers on the same unchanged fixtures. Old adapters have no shared plan API: this compares the new target facts with accepted legacy DOM and MAIN-model readback, not two independent plans. `l1-shadow-expectations.json` records the scope and both expected differences:

| Scenario | Offline comparison |
| --- | --- |
| CMS school search | Shadow target equals accepted legacy display and model. |
| Hotjob paired selects | Both shadow path values equal accepted legacy display and model. |
| GTH month range | Both shadow month values equal accepted legacy display and model. |
| CMS month | Intentional difference: L1 plans the synthetic month component; the old birthdate writer still rejects month-only precision. |
| GTH plugin-dialog picker | Intentional difference: L1 returns unsupported; the existing GTH-specific writer remains available to its old flow. This picker belongs in L3. |

Additional checks prove MAIN/ISOLATED separation, unknown-version rejection, existing-value preservation, disabled/readonly/upload manual outcomes and a default write gate that refuses effects. Separate offline writer checks execute the new adapters against actual Ant Design Vue school search, paired selects and month controls, plus the Element month range. They require UI strategy and agreement between visible DOM and fixture model. Changing only the month DOM produces mismatch, and a later change produces reverted. Native text, textarea, select, radio and additive checkbox checks use disposable controls in the offline page. The original shadow entry remains read-only; R2's ordinary route is checked separately with its default-off opt-in flag.

## Batch B control patterns

`batchb.spec.mjs` uses a first-party synthetic page on loopback, with no recruiting URL. It exercises the same built source bytes and the existing network guard. Because production permissions intentionally exclude loopback, this subset loads the byte-checked built files through CDP into disposable MAIN or isolated browser contexts. It does not change extension permissions. The older suites retain their `chrome.scripting.executeScript` path.

The cases keep Hotjob and Beisen create/edit entry controls passive, report missing fields as manual, reject submit and ambiguous entry controls, and check Moka-shaped React/Vue3 model ownership. Feishu hydration checks preserve unavailable controls, while an incomplete shell records a readiness hint and fills its existing recognized field. Generic wizard/sidebar navigation and readiness inspection stay read-only in MAIN and ISOLATED worlds. Navigation plans prioritize hash/query/tab relationships without activating controls or changing the URL; unknown and save/next controls stay manual. Each case checks unchanged neighboring values, zero forbidden clicks, zero non-GET traffic and `liveSupportClaimed=false`. Delayed hydration checks also require zero input events before readiness. React and Vue3 internals are diagnostic synthetic fixtures; they do not establish live framework versions or Moka selector support.

## Generic upload and attachment controls

`upload.spec.mjs` uses first-party synthetic attachment pages on loopback. It loads exact packaged control bytes without adding host permissions or connecting to a live site. Native file inputs, input-backed drop zones, existing previews, clear/remove affordances, and explicit skip/later outcomes are read-only observations. Unknown or shared ownership remains manual. Preview does not open links or dialogs; clear preserves attachments; skip/later never click page controls. The existing native upload entry remains manual, and attachment display inputs cannot fall through to ordinary writers.

The fixtures never select a file, assign a FileList, create a File/DataTransfer, upload, save or submit. Checks require unchanged attachment and neighbor state, zero click/input/change/drag/drop attempts, zero non-GET traffic, and `liveSupportClaimed=false`. [The detect/preview/skip contract](../../docs/ATS_UPLOAD_CONTROLS.md) records the API, result reasons and evidence limits. UL is a phenomenon reference only; this suite contains no site-specific patch.

## Generic switch and toggle controls

`switch.spec.mjs` mounts disposable native checkbox-as-switch and binary ARIA switches alongside real Element UI 2.15.14 `ElSwitch` and ant-design-vue 1.7.8 `ASwitch` components. It checks absolute true/false writes, explicit toggle in both directions, exact click counts, default-off writes, no-op repetition, model plus DOM readback, mismatch/reversion, and disabled/readonly/mixed-state guards. Ordinary checkboxes remain add-only. AntD React and unknown framework versions are outside this contract.

After building, use `npm run test:zoo -- switch.spec.mjs` for this family. Each case exports `switch-evidence.json` and a fixture screenshot under Playwright output, requires zero save/submit/non-GET effects, and keeps the original fixture model unchanged. `liveSupportClaimed=false`.

## Generic sliders

`slider.spec.mjs` mounts disposable native range inputs alongside real Element UI 2.15.14 `ElSlider` and ant-design-vue 1.7.8 `ASlider` components on loopback. Its three checks cover passive planning, default-off absolute writes, owned rail clicks and thumb drags, repeated no-ops, public numeric model plus thumb-position/ARIA readback, copied-plan and guard rejection, disabled/readonly/range modes, invalid numeric targets, display/model disagreement and delayed reversion. AntD React and unknown framework versions are outside this contract.

After building, run `npm run test:zoo -- slider.spec.mjs`. Each case exports `slider-evidence.json` with packaged source hashes and a fixture screenshot under Playwright output. Neighbors remain unchanged; zero save/submit/non-GET effects and a passing existing Never-Save guard are required. `liveSupportClaimed=false`; see [the slider contract](../../docs/ATS_SLIDER_CONTROLS.md).

## Generic ratings and stars

`rate.spec.mjs` mounts real Element UI 2.15.14 `ElRate`, Element Plus 2.14.7 `ElRate` on Vue 3.5.44, and ant-design-vue 1.7.8 `ARate`, plus an explicit ARIA slider whose role description identifies a rating and whose numeric value text independently confirms the star value. Ordinary sliders remain outside the ARIA rating contract. Its four checks cover passive plans, default-off writes, absolute keyboard writes including zero, owned star clicks, half stars on the three supporting Vue components, repeated no-ops, public numeric model plus DOM readback, copied-plan and guard rejection, invalid/disabled/readonly/hidden controls, disagreement and delayed reversion.

After building, run `npm run test:zoo -- rate.spec.mjs`. Every fixture uses disposable loopback pages and exact packaged bytes, preserves neighboring values, and requires zero save/submit/non-GET effects under the existing Never-Save guard. Each case exports `rate-evidence.json` with source hashes and a fixture screenshot. `liveSupportClaimed=false`; see [the rating contract](../../docs/ATS_RATE_CONTROLS.md).

## Generic date ranges

`date-range.spec.mjs` mounts a native date pair, actual Ant Design Vue 1.7.8 `ARangePicker`, Element UI 2.15.14 `ElDatePicker` with `type="daterange"`, and paired single-date calendars. It checks passive planning, default-off writes, exact date precision and order, owned-panel endpoint selection, independent public-model and DOM endpoint readback, mismatch/reversion, and unchanged neighbors. Both default Date/Moment models and explicit string formats are exercised. Native browser calendar popups remain outside automation.

After building, use `npm run test:zoo -- date-range.spec.mjs`. These cases use only disposable loopback fixtures, exact packaged bytes and the existing Never-Save guard. No recruiting page or business save/submit is involved; `liveSupportClaimed=false`. See [the date-range contract](../../docs/ATS_DATE_RANGE_CONTROLS.md) for grouping, ownership and readback boundaries.

## Generic tree selects

`tree-select.spec.mjs` mounts actual Ant Design Vue 1.7.8 `ATreeSelect`, Element Plus 2.14.7 `ElTreeSelect` on Vue 3.5.44, and an Element UI 2.15.14 `ElSelect`/`ElTree` searchable composition on Vue 2.7.16. Element UI 2 has no native TreeSelect. The nine cases check passive plans, default-off writes, owned branch expansion and node clicks, scalar public-model plus visible-label readback, effect-free repeated writes, target/plan binding, ambiguous/disabled/multiple boundaries, mismatch and delayed reversion.

After building, run `npm run test:zoo -- tree-select.spec.mjs`. These disposable loopback fixtures use exact packaged bytes and locally fulfilled pinned library assets, preserve neighboring controls, and require zero save/submit/non-GET effects under the existing Never-Save guard. Evidence includes hashes and a fixture screenshot. `liveSupportClaimed=false`; see [the tree-select contract](../../docs/ATS_TREE_SELECT_CONTROLS.md) for the supported shapes and evidence limits.

## Never-Save boundary

The harness reuses `createRowDNetworkGuard` without changing its policy. CDP Fetch interception starts before navigation and blocks every non-GET. Local routing independently refuses non-GET and unknown URLs. Tests require zero non-GET responses and zero blacklist click attempts in ordinary scenarios. An injected autosave POST must be observed, blocked and assessed as a failed safety verdict even though no response reaches the page. The click journal blocks and counts attempts on 保存 / 提交 / 下一步 / 投递 / 删除.

Never-Save applies to the whole batch: a save, submit, autosave or other non-GET business write attempted by any site makes the entire batch **FAIL**, including when interception succeeds and no response reaches the page. Other sites passing cannot offset that failure. The conservative GET-only boundary also blocks HEAD, OPTIONS, CONNECT, TRACE and unknown methods, in addition to POST, PUT, PATCH and DELETE; it does not depend on a URL containing a save keyword. `assessNeverSaveBatch` in `scripts/lib/never-save-guard.mjs` checks every site's non-GET evidence and guard verdict. A historical keeper verdict accepting proof of an intercepted request never grants a Never-Save batch pass.

Run `node --test tests/never-save-guard.test.mjs` from the repository root for the generic offline regression. It feeds synthetic CDP events (including `.invalid` hosts and an existing keeper exception) into the existing guard with a command spy; no HTTP request is sent. Coverage includes GET-only success, non-GET interception and redacted records, one writing site failing a multi-site batch, incomplete observation/interception evidence, block-command failure and response evidence. These checks establish an offline safety contract only; `liveSupportClaimed=false`.

Fixture data is disposable: there are no credentials, customer facts, saving, submitting or live probes. Existing guards, `throwOnSideEffect` behavior and visibility checks stay unchanged. `liveSupportClaimed=false`; booked remains 70 (engineering work adds 0). No LLM calls or third-party ATS implementation code are included.

## Generic HAR recording and offline replay

The separate `har.spec.mjs` suite records real HTTP GET responses from a synthetic loopback control fixture with Playwright `recordHar`, closes that context and server, then replays in a fresh offline context with `routeFromHAR({ update: false, notFound: 'abort' })`. It checks passive generic control planning, the default-off writer gate, missing requests, blocked non-GET requests and unchanged archive bytes. This path captures checkout source modules directly and needs no extension build; existing extension and CDP guard paths remain unchanged. `liveSupportClaimed=false`.

Run `npm run test:zoo -- har.spec.mjs` for the focused checks. To keep an archive, run `node scripts/zoo-har.mjs record --har dist/zoo-runs/har/example.har`, followed by `node scripts/zoo-har.mjs replay --har dist/zoo-runs/har/example.har`. See [the HAR scaffold guide](../../docs/ATS_HAR_OFFLINE.md) for setup, helper reuse, recording boundaries and replay limits.
