# CMB Wave8b primary residuals: Never-Save audit

Base verified locally: `6afc461c9a686312bb984945d75a43704b45fa78` on a clean detached HEAD before creating the work branch. Scope is CMB on `career.cmbchina.com` only. `liveSupportClaimed=false`; no live form interaction or acceptance upgrade is part of this change.

## Evidence and addressed controls

The exact control IDs and their `aria-controls` list IDs come from `cmb-remaining-dom-ids-20261019.json` in this directory. Dictionary values come from `src/content/cmb-gated-dicts.mjs` and the recorded CMB dictionary probes. `tests/fixtures/cmb-basic-form.html` supplies the existing **synthetic** option markup and accepting click handler. Neither a negative test mutation nor that handler establishes live portal DOM.

The primary select writers and profile keys already exist. Wave8b hardens their readback: an accepted target click must not conceal a change to another primary residual select. Readback checks neighbors immediately and after settlement, reports the actual target state, preserves the changed neighbor, reports an isolation failure, and stops later planned writes. Navigation away from the allowed page during settlement also fails and stops later writes. Diagnostics expose changed control IDs only. Accepted current-target rerenders and absent neighboring controls retain their existing behavior.

| Primary control ID | Existing list ID | Profile key |
| --- | --- | --- |
| `resume_basicInfo_channelType` | `resume_basicInfo_channelType_list` | `channelType` |
| `resume_basicInfo_expectedInterviewCity` | `resume_basicInfo_expectedInterviewCity_list` | `interviewCity` |
| `resume_educationHistoryList_0_educationLevelCode` | `resume_educationHistoryList_0_educationLevelCode_list` | `educationLevel` |
| `resume_familyList_0_relationship` | `resume_familyList_0_relationship_list` | `relationshipType` |
| `resume_familyList_1_relationship` | `resume_familyList_1_relationship_list` | `relationshipTypeRow1` |
| `resume_skill_0_englishLevel` | `resume_skill_0_englishLevel_list` | `englishLevel` |
| `resume_awardList_0_awardLevel` | `resume_awardList_0_awardLevel_list` | `awardLevel` |

This is an offline guard change to those residual writers. It does not add dictionary rows, selectors, field rows, or live support claims. Historical select-click notes are context and do not constitute fresh Wave8b acceptance.

## Native residual audit

The following exact controls already have census-verbatim fixture metadata, standalone confirmed-field APIs, empty-only writes, native input events, and settled readback. No source change is justified for them by this audit:

- `resume_internshipExperienceList_0_companyName`
- `resume_internshipExperienceList_0_city`
- `resume_internshipExperienceList_0_jobResponsibility`
- `resume_internshipExperienceList_0_hrContact`
- `resume_internshipExperienceList_0_hrPhone`
- `resume_familyList_1_name`
- `resume_familyList_1_position`
- `resume_familyList_1_phone`

Their evidence fixtures remain `tests/fixtures/cmb-internship-native-text-probe-dom.json` and `tests/fixtures/cmb-family-native-text-probe-dom.json`. Fresh live Never-Save acceptance for these residuals is still missing. Runtime manifest/background changes would exceed this dispatch's file scope. Existing live PASS fields and the native-text neighbor-readback implementation are not retargeted.

## Missing evidence for secondary controls

| Exact census IDs | Evidence still needed before implementing fill |
| --- | --- |
| `resume_educationHistoryList_0_startDate`, `resume_educationHistoryList_0_endDate`, `resume_internshipExperienceList_0_startDate`, `resume_clubActivityList_0_startDate`, `resume_awardList_0_awardDate` | The inputs and time placeholders are recorded; associated picker DOM, ownership, date/month precision and format, range behavior, commit action, and settled readback are missing. |
| `resume_educationHistoryList_0_fullEducation` | Hidden input only. Visible controller, semantics, and accepted values are missing. |
| `resume_awardList_0_awardType`, `resume_awardList_0_awardType_list` | Combobox/list association exists. Award-type dictionary, option contract, click behavior, and readback evidence are missing; `AwardsLevel` is a different dictionary. |
| `resume_familyList_0_socialCreditCode`, `resume_familyList_1_socialCreditCode` | Native metadata exists. Label/purpose, conditional visibility, and confirmed profile mapping are missing. |
| `resume_familyList_0_checked`, `resume_familyList_1_checked` | Checkbox metadata exists. Semantics, association, and action contract are missing. |
| `resume_familyList_0_workInMerchantsGroup`, `resume_familyList_1_workInMerchantsGroup` | Radio-group containers are recorded. Child values, group/form ownership, click targets, and checked-state readback are missing. |

Full live dropdown portal/option DOM and fresh settled Never-Save acceptance also remain missing for the primary selects. Offline success does not close that evidence gap.

## Windows validation

Baseline: all CMB tests plus `tests/auto-cmb-extension-cdp.test.mjs` passed **396/396**, with no failures or skips, on Windows using Node and installed Chrome. `CHROME_PATH` points to the installed Chrome binary and `CDP_PORT=0` prevents legacy refusal checks from attaching to a live trial session. Headless synthetic harnesses and mock CDP servers use their own loopback ports.

The original untouched source failed all seven initial side-effect regressions: each target accepted its selection, a neighboring primary selection changed, and the writer still returned `ok:true`. The accompanying census check passed. No shared source revert was used for that reproduction.

Final results on Windows / Node `v24.20.0`:

- All `tests/cmb*.test.mjs` plus `tests/auto-cmb-extension-cdp.test.mjs`: **426/426 passed**, zero failures/skips. This includes the 30 new primary select regressions and the existing native audit coverage.
- Focused primary select plus existing Never-Save controls: **78/78 passed** (30 new + 48 existing), independently rerun during review.
- Family, internship, and existing native-text neighbor-readback audit: **102/102 passed**; included in the full CMB run.
- Recorded harvest fixtures, readonly runner, and timeout checks: **9/9 passed**, zero failures/skips.
- `git diff --check`: clean.

Full CMB Windows command (with `CHROME_PATH` and `CDP_PORT` set as above):

```powershell
$cmbTests = @(Get-ChildItem tests -Filter 'cmb*.test.mjs' -File | Select-Object -ExpandProperty FullName)
$cmbTests += (Resolve-Path tests/auto-cmb-extension-cdp.test.mjs).Path
node --test @cmbTests
```

All validation is offline. Live PASS native fields, unrelated site code, and existing files outside CMB scope are unchanged. No existing file is deleted.
