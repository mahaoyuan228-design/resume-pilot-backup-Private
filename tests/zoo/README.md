# Offline ATS control zoo (legacy baseline and L1 shadow)

R2 adds eight per-adapter checks in `extended.spec.mjs` and the ordinary production message route in `write-route.spec.mjs`; see [the R2 contract](../../docs/ATS_ENGINE_R2.md). The original legacy baseline and five shadow comparisons remain intact. iView uses actual pinned 3.5.4 components. Ud/phoenix use explicitly synthetic contract replays, with production versions still pending samples. `liveSupportClaimed=false`.

The legacy suite records existing adapter behavior at base `f07879e1caa24e6f7f09bf6c59e30b7098d89b6b` (#226). PR-2 starts from `8dcd68619cdad860f1402e56196fc61aefd881f0` (#227) and adds L1 shadow planning and disposable offline writer checks. It does not implement L2 semantics, L3 profiles or the live batch runner.

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

The suite loads the unchanged built extension and executes its shipped adapter files through `chrome.scripting.executeScript`. Exact CMS/GTH HTTPS URLs preserve production host and page checks. Every web request is fulfilled from a fixed local asset map or aborted; there is no network fallback to a recruiting server.

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

Additional checks prove MAIN/ISOLATED separation, unknown-version rejection, existing-value preservation, disabled/readonly/upload manual outcomes and a default write gate that refuses effects. Separate offline writer checks execute the new adapters against actual Ant Design Vue school search, paired selects and month controls, plus the Element month range. They require UI strategy and agreement between visible DOM and fixture model. Changing only the month DOM produces mismatch, and a later change produces reverted. Native text, textarea, select, radio and additive checkbox writers run only against disposable controls in the offline page. No customer entry point is routed to these writers.

## Never-Save boundary

The harness reuses `createRowDNetworkGuard` without changing its policy. CDP Fetch interception starts before navigation and blocks every non-GET. Local routing independently refuses non-GET and unknown URLs. Tests require zero non-GET responses and zero blacklist click attempts in ordinary scenarios. An injected autosave POST must be observed, blocked and assessed as a failed safety verdict even though no response reaches the page. The click journal blocks and counts attempts on 保存 / 提交 / 下一步 / 投递 / 删除.

Fixture data is disposable: there are no credentials, customer facts, saving, submitting or live probes. Existing guards, `throwOnSideEffect` behavior and visibility checks stay unchanged. `liveSupportClaimed=false`; booked remains 70 (engineering work adds 0). No LLM calls or third-party ATS implementation code are included.
