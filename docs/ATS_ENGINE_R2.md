# ATS engine R2: offline adapters, L2 and an opt-in writer

Base: `8290721c44c755054269263430eae6eab80adb93` (#229). This completes the deferred adapter entries and connects the existing planner to the ordinary `RESUME_FILL` path behind `chrome.storage.local.resumeAtsEngineWriteEnabled === true`. The key is absent by default. No UI turns it on automatically. Shadow inspection remains read-only regardless of the key.

## Adapter evidence

`extended-controls.js` registers eight entries through the existing registry and four-state verifier. Writers preserve different existing values, check each effect and require agreement between visible DOM and the MAIN-world component model. Unknown versions and identities are rejected. Framework controls cannot fall through to a native writer.

| Adapter | Zoo fixture | Evidence boundary |
| --- | --- | --- |
| `ivu-select` | Actual iView 3.5.4 Select | Component identity, library export and instance-owned dropdown. ViewUI is a different family. |
| `ivu-date` | Actual iView 3.5.4 DatePicker | Explicit day precision, component-owned calendar and enabled date cells; native input assignment is not a date strategy. |
| `ud-select` | Synthetic React props and owned ARIA portal | `fixture-contract-1` only; live component/version pending samples. |
| `ud-date` | Synthetic React props and owned date dialog | Same pending-sample boundary. |
| `ud-cascader` | Synthetic React props and level groups | Same pending-sample boundary; exact enabled path required. |
| `phoenix-select` | Synthetic React props and owned ARIA portal | `fixture-contract-1` only; live component/version pending samples. |
| `phoenix-cascader` | Synthetic React props and level groups | Same pending-sample boundary; exact enabled path required. |
| `phoenix-date` | Synthetic React props and owned date dialog | Same pending-sample boundary. |

The ud/phoenix reviewed version list deliberately contains no guessed production version. Both the component's library identity/version and page export must match the reviewed contract. Classes alone never establish compatibility. Synthetic fixtures prove implementation behavior and do not establish any recruitment site's DOM or backend acceptance.

Production discovery currently admits visible input/textarea-backed widgets. Div-only comboboxes and iView flat selects without a visible input remain pending route samples; direct adapter zoo checks do not imply those layouts enter the production collector.

## Production write route

When the flag is false or absent, the existing fill route remains active. When true, collected, confirmed facts use the background `controls-write.mjs` bridge, MAIN-world registry planning, guarded writing and dual verification. A rejected L1 result never falls back to a second write through the old adapter. Repeat-row creation, uploads and other unrelated effects are not part of this opt-in path.

The bridge validates the extension sender, top frame, active tab, URL, document time origin and unique target. It re-reads the confirmed profile fact under the existing profile lifecycle lock and checks the binding before and after MAIN execution. MAIN effects check visibility and the same attached target/scope. An interrupted or partially started write remains reviewable rather than being reported as an untouched skip. Paid builds also retain their license gate. Existing CMS session checks and the general GTH read-only boundary remain in force.

The packaged zoo invokes the actual ordinary `RESUME_FILL` message with the flag absent and true on a locally fulfilled HTTPS fixture. Opt-in cases require `native-text` and a readonly/search `ud-select` display to reach successful L1 verification. A separate read-only MAIN discovery step admits complex display inputs only when the registry has confirmed their writable component identity and version. It does not call a test-only production hook.

## L2 and human-confirmed domain memory

`matcher.resolveField` resolves exact normalized aliases by section. Education, work, internship and project fields require an explicit repeated-row index. Unknown sections, labels, conflicting aliases and schema gaps return `manual`; certificate answers remain manual because the current profile schema has no corresponding collection. The existing `classify(labels)` API remains available to legacy callers. No LLM is called.

`domain-memory.js` stores only validated field metadata and a whitelisted profile path: exact domain, SHA-256 of the page path, normalized labels/options, section, row index and control kind. Query strings, fragments, resume values, selectors, handler objects and arbitrary profile data are not stored. Reads do not create entries, and successful fills do not train memory.

The popup offers a blank schema-path choice followed by an explicit confirmation button for unmapped fields. Confirmation re-reads the active page and field signature, and accepts only a currently confirmed profile path. Re-identification applies the mapping on the same domain, page fingerprint and field signature. The mapped answer is still subject to the normal confirmed-fact and write checks.

## Manual control boundary

Registry `plan` and `inspect` return `manual` with `writeStarted=false` for iframe/captcha surfaces, foreign documents, shadow roots, unrecognized controls/versions and failed component probes. They never read a frame's `contentDocument` or `contentWindow`. Captcha markers (`data-captcha`, captcha class/id/name tokens) and one-time-code inputs are excluded from resolution and effect helpers, including when a previously planned control becomes a challenge. Candidate discovery skips manual observations and continues with other controls.

The ordinary inspector also reports visible top-level iframe and input-free challenge placeholders. Challenge controls bypass semantic classification and domain-memory mapping, and ordinary fill skips them with or without the experimental write flag. Every generic legacy effect rechecks the challenge boundary after asynchronous binding checks; if a marker appears after an earlier assignment, further effects stop and `failed / writeStarted=true` retains the partial result for review. Unknown labels retain `semanticStatus=manual`. No automatic synonym learning is added: only the existing explicit user-confirmation path may persist mappings.

The packaged zoo verifies browser-enforced cross-origin isolation using a locally fulfilled child document, then makes frame access throw during detect/plan. It requires manual results, unchanged DOM/values, zero control events and zero frame reads. The generic L1 no-adapter outcome changes from `unsupported` to `manual`; the legacy baseline and accepted writer behavior are unchanged. `liveSupportClaimed=false`.

## Verification and limits

Run Node 24 `node --test --test-concurrency=1`, `node scripts/build-paid-smoke.mjs`, regenerate `SOURCE_INVENTORY.json`, build the internal extension and run `npm run test:zoo`. Local Windows tests require their documented EXAMPLE PEM fixtures, `OPENSSL_BIN` and browser executable paths. Historical immutable-source hash checks require the repository's original LF working-copy bytes. Zoo loads exact packaged bytes, uses a temporary browser profile and fulfills all page assets locally; unknown requests are aborted.

Never-Save guard policy, `throwOnSideEffect`, existing live probes and commercial records are unchanged. No recruitment server filling, saving, submitting or live-machine run is part of this work. `liveSupportClaimed=false`. All new implementation is first-party; MPL-2.0, AGPL, proprietary and unlicensed implementations were not copied. The added iView dependency is test-only, pinned and accompanied by its complete package license in `THIRD_PARTY_NOTICES.md`.
