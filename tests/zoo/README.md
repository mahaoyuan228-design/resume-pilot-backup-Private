# Offline ATS control zoo (PR-1)

This suite records existing adapter behavior at base `f07879e1caa24e6f7f09bf6c59e30b7098d89b6b` (#226). It implements only the zoo slice of the 2026-10-30 handover. It does not implement the L1 registry, L2 semantics, L3 profiles or the live batch runner.

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
| CMS `englishExamDate` | Ant Design Vue 1.7.8 `AMonthPicker` | Synthetic read-only characterization. No shipped month writer exists at this base; the baseline records this limitation. #226's live panel observation does not establish the production component's MonthPicker identity. |
| CMS school search | Actual Ant select with delayed search options | Existing `cms-school-search.js` layout; school names and results are synthetic. |
| Hotjob dual select | Actual Ant selects in the existing paired-container structure | Repository region probes and existing adapters supply the DOM contract; options are synthetic. |
| GTH employment month range | Two actual Element month controls | Existing work-editor contract and `gth-open-fill.js`; both model and visible dates are checked. |
| GTH plugin-dialog picker | Minimal custom DOM replay | Repository census and existing picker contract; synthetic category path. This is a GTH-specific replay, not a generic cascader. |

Vue 2.7.16 and Ant Design Vue 1.7.8 match the handover. Element UI 2.15.14 is a selected offline fixture version; GTH's live version remains unverified. iView, antd-mobile, Moka and Feishu require further samples and are outside these five cases. Exact dependency versions and integrity hashes are in `package-lock.json`; copyright notices and upstream commits are in `THIRD_PARTY_NOTICES.md`.

The checked-in legacy baseline is an expectation, not a support matrix. A green suite means the existing result, visible DOM, MAIN-world fixture model, neighboring fields and safety evidence match that expectation. Known unsupported or fail-closed behavior must remain explicit. Future adapter work must explain each intentional baseline change instead of silently accepting new output.

## Never-Save boundary

The harness reuses `createRowDNetworkGuard` without changing its policy. CDP Fetch interception starts before navigation and blocks every non-GET. Local routing independently refuses non-GET and unknown URLs. Tests require zero non-GET responses and zero blacklist click attempts in ordinary scenarios. An injected autosave POST must be observed, blocked and assessed as a failed safety verdict even though no response reaches the page. The click journal blocks and counts attempts on 保存 / 提交 / 下一步 / 投递 / 删除.

Fixture data is disposable: there are no credentials, customer facts, saving, submitting or live probes. Existing guards, `throwOnSideEffect` behavior and visibility checks stay unchanged. `liveSupportClaimed=false`; booked remains 70 (engineering work adds 0). No LLM calls or third-party ATS implementation code are included.
