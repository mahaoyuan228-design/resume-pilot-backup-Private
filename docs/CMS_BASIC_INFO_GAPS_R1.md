# CMS basic-info row C gaps R1

This change prepares offline checks for the 13 priority fields in CMS basic-info section `11`. It does not establish live support, add scorecard credit, or establish commercial coverage. **Never-Save; `liveSupportClaimed=false`.**

## Evidence and scope

The audited base is `640b0511ae1ae8d8fd45780a2d026c1daad09dbb` on `cursor/expand-night-ats-f861`. The supplied local evidence directory is `cms-basic-other-harvest-2026-10-24-1001/`, adjacent to the workdir. The audit used `gaps-row-C.json`, `harvest-summary.json`, `page-sections-raw.json`, and its harvest report. These private local evidence files are not copied into the repository.

The harvest records section `11`, exact labels, wrapper IDs, and control kinds. Its notes say `read_only_no_open_dropdown_no_fill`. It contains structured control summaries rather than complete element markup or an interaction recording. It does not establish select options, dropdown ownership, calendar popup structure, or a region hierarchy. Selected customer values are not reproduced here or in the new probe results.

The matrix below separates existing behavior at the pinned base from this round's evidence checks. None of the 13 priority wrapper IDs occurred in tracked source, tests, or scripts at that base. Generic adapters already existed; adding evidence checks does not turn their previous capability into new field coverage.

## Field matrix

Source line references in this table refer to the pinned base, before this change. `engine` means `src/content/engine.js`; `matcher` means `src/core/matcher.js`.

| Harvest wrapper | Label / control kind | Existing behavior at the base | R1 evidence check / remaining gate |
| --- | --- | --- | --- |
| `11_20_0` | 性别 / `radio-group` | `matcher:8` recognizes `gender`; `engine:690` groups radios and matches actual options. | Exact wrapper, label, section, and radio kind. The harvest samples 男/女 text but does not record input attributes. Live Never-Save still required. |
| `11_21_0` | 出生日期 / `ant-calendar-picker` | `matcher:9`, `engine:480`, and `cms-date-picker.js` provide the existing calendar route, with offline Never-Save tests. | Exact wrapper and readonly calendar input. The closed-control harvest does not establish popup interactions. Live Never-Save still required. |
| `11_247_0` | 身高 / `input` | `matcher:14` recognizes `height`; `engine:1595` uses the native setter. The profile editor already validates numeric centimeters. | Exact text input and harvested `（单位：cm）` placeholder. Live Never-Save still required. |
| `11_22_0` | 国籍/地区 / `ant-select` | `engine:307` lists the exact custom question; `engine:394` and `engine:543` route supported Ant v3 controls and confirmed answers. | Read-only inspection; skip `option_open_evidence_missing`. |
| `11_23_0` | 民族 / `ant-select` | `engine:302` supports the question; `engine:268` resolves confirmed custom facts. | Read-only inspection; skip `option_open_evidence_missing`. |
| `11_24_0` | 婚姻状况 / `ant-select` | `engine:307` lists the exact custom question; the existing Ant v3 adapter matches actual options. | Read-only inspection; skip `option_open_evidence_missing`. |
| `11_25_0` | 政治面貌 / `ant-select` | `engine:302` supports the question; confirmed custom facts feed the existing adapter. | Read-only inspection; skip `option_open_evidence_missing`. |
| `11_28_0` | 证件类型 / `ant-select` | `engine:302` supports the question; confirmed custom facts feed the existing adapter. | Read-only inspection; skip `option_open_evidence_missing`. |
| `11_29_0` | 证件号码 / `input` | `matcher:7` recognizes `identityNumber`; `engine:1595` uses the native setter. | Exact text input and harvested placeholder. Live Never-Save still required. |
| `11_26_0` | 现居住地 / `ant-select` | `engine:442` and `cms-region.js` provide a region route requiring a confirmed explicit province/city pair and a validated runtime cascader structure. | Read-only inspection; skip `option_open_evidence_missing`. This harvest does not prove that required region structure. |
| `11_51414234_0` | 联系地址 / `input` | No built-in matcher alias. Generic `engine:679` custom-fact fallback can already resolve an exact confirmed scoped question. | Harden the existing capability with the harvested wrapper/text-input identity, scoped custom facts, and delayed drift checks; no new generic address capability is claimed. Live Never-Save still required. |
| `11_245_0` | 籍贯 / `ant-select` | Existing region route as above, requiring explicit facts and runtime structure. | Read-only inspection; skip `option_open_evidence_missing`. This harvest does not prove the required region structure. |
| `11_1003214127_0` | 期望面试地点（供参考，实际安排将根据笔试通过名单确定） / `ant-select` | `engine:307` lists the exact long custom question; the existing Ant v3 adapter requires confirmed wording and an actual matching option. | Read-only inspection; skip `option_open_evidence_missing`. |

All 13 fields still require a successful LIVE Never-Save trial before any live coverage claim. All eight select fields require option-open evidence; current residence and native place also require evidence of the actual region shape. No option lists are inferred from selected labels or general knowledge. A structural observation is not a fill/readback/restore result.

## Probe hooks and address hardening

`scripts/lib/cms-basic-info-row-c.mjs` exports `ROW_C_FIELDS`, `inspectCmsBasicInfoRowC`, and `buildCmsBasicInfoRowCProbeExpression`. The existing `scripts/live/cms-basic-info-live.mjs` re-exports these hooks for an explicitly invoked future probe. Inspection checks the expected page, visible section `11`, unique wrappers and questions, labels, availability, and evidenced control kinds. It fails closed when those checks do not hold.

The probe uses conservative item/wrapper relationships from the existing inspection conventions. Because full markup was not captured, an unrecorded relationship can be skipped even when a human recognizes the same field. Its logical field keys are inventory identifiers, not new general profile aliases.

The probe reads metadata only. It performs no input events, clicks, fills, save/submit/delete actions, network interception, or other page mutations, and returns no input values, selected text, or option lists. Its result explicitly reports `writeStarted=false`, `mutationAllowed=false`, `valuesExposed=false`, `neverSave=true`, and `liveSupportClaimed=false`. Observed text, radio, and calendar controls retain the reason `live_never_save_required`; select controls retain `option_open_evidence_missing`. The probe does not grant permission to use the older generic adapters.

The baseline live runner remains limited to name, phone, and email, using its existing production `RESUME_FILL` path, network/click checks, restoration, and final readback checks. Row C inspection is not added to that runner's three-field write list.

The contact-address change hardens an existing generic custom-fact path. An invalid wrapper, duplicate question, wrong control kind, unconfirmed or mismatched scope, or target drift must not fall through to a less specific label-only match. Candidate recognition includes harvested label and placeholder hints, so combined wrapper and label drift cannot bypass the guard through an accessibility label or a general profile alias. Delayed checks protect target identity, full page URL, form scope, source confirmation, availability, and native edits after every asynchronous profile-ownership check. Engine revision `7` replaces an idle revision `6` listener and refuses replacement during a pending fill. The tests use synthetic behavior where the harvest did not record event or framework behavior; they are offline evidence only.

## Earlier three-field evidence

The requested exact filename `cms-basic-info-live-PASS-2026-10-22.json` was not found in the inspected workdir, adjacent directory, or repository-root top level. A local equivalent, `../cms-basic-info-live.json`, was available and inspected without reproducing its customer values.

That file names tip `e78cf7f` and reports name, phone, and email as `verified` with `readback_matched`. It records `neverSave=true`, `liveSupportClaimed=false`, zero non-GET requests, zero save-like requests, zero clicks, no banned click, successful restoration, `pageLeftAsFound=true`, no changed neighbors, no unexpected writes, and exit code `0`. This is historical evidence for those three fields only; it is not a new run or evidence for any row C gap.

## Validation

Final offline regression: **342/342 passed across 16 files**, with zero failures or skips. This comprises 49 address-hardening tests, 47 read-only probe tests, and 246 existing regression checks. The existing basic-info runner test now uses `fileURLToPath` and normalizes CRLF when inspecting source, allowing its original three-field fill/restore checks to run correctly on Windows.

```powershell
node --test tests/cms-basic-info-gaps.test.mjs tests/cms-basic-info-row-c-probe.test.mjs tests/cms-basic-info-live.test.mjs tests/cms-basic-auto.test.mjs tests/cms-basic-seed-from-education.test.mjs tests/cms-text-blur-commit.test.mjs tests/cms-text-edit-preserve-never-save.test.mjs tests/cms-text-retained-readback-never-save.test.mjs tests/cms-document-ownership-never-save.test.mjs tests/cms-document-rebind.test.mjs tests/cms-birth-date-never-save.test.mjs tests/cms-select-native-edit-never-save.test.mjs tests/cms-select-escape-surfaces.test.mjs tests/cms-region-escape-surfaces.test.mjs tests/cms-region-fact-plan.test.mjs tests/cms-region-object-projection.test.mjs
```

Independent review reproduced the combined-drift fallback before the fix and confirmed `skipped/field_changed` with zero writes and events after the fix. A separate 96/96 address/probe run passed. `git diff --check` passed. The tracked report generated by an existing regression was restored rather than included in this change.

No live CDP login/session, select opening, paid product path, education CONTROLS harness, or commercial burn is part of this offline change. Save, submit, and delete remain prohibited. **Never-Save; `liveSupportClaimed=false`.**
