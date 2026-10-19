# CMB remaining DOM ids (2026-10-19)

Never Save. This records ids seen on `https://career.cmbchina.com/center/resume`. It is not a live fill. 招行 is not supported. Acceptance stays **85%**.

Source: `dist/site-probes/cmb-remaining-dom-ids-20261019.json`. harvestedAt `2026-10-19T05:08:44.887Z`. fieldCount 68. resume_* id count 67. No cookie or token is stored.

Option text and codes stay in `cmb-dictmap-full-20261019.json`. This file does not invent option lists.

## Dict key to DOM

| Dict | Label seen | DOM id | List id | This knife |
| --- | --- | --- | --- | --- |
| Education | 学历 | `#resume_educationHistoryList_0_educationLevelCode` | `resume_educationHistoryList_0_educationLevelCode_list` | offline select wired. Only history row 0. `ED000`（博士后）dropped as a placeholder. `中技（中专/技校/职高）` matches its halfwidth-paren form. `--live` refuses `live_education_level_select_fill_unclaimed` |
| EnglishLevel | 最高英语水平 | `#resume_skill_0_englishLevel` | `resume_skill_0_englishLevel_list` | not wired |
| RelationshipType | 关系类型 | `#resume_familyList_0_relationship` and `#resume_familyList_1_relationship` | `…_list` on each | offline select wired on each index. A row-0 value is not written to row 1. No placeholder dropped. `--live` refuses `live_relationship_select_fill_unclaimed`. Name and phone are not filled |
| AwardsLevel | 获奖级别 | `#resume_awardList_0_awardLevel` | `resume_awardList_0_awardLevel_list` | offline select wired on award row 0. Level is not inferred from 奖项名称. No placeholder row in the dict. `--live` refuses `live_award_level_select_fill_unclaimed` |
| InterviewCity | 面试期望城市 | `#resume_basicInfo_expectedInterviewCity` | `resume_basicInfo_expectedInterviewCity_list` | not wired; defer |
| ChannelType | 招聘信息来源 | `#resume_basicInfo_channelType` | `resume_basicInfo_channelType_list` | not wired; defer |
| RankingMajor | — | absent on this resume page | — | `DOM_CONTROL_MISSING`. Keep the dict fixture. Do not guess a selector. |

Each mapped select above is an `input.ant-select-selection-search-input` with `role=combobox` and `type=search`. The select root class was not captured in this harvest, so the Education fixture does not add `ant-select-show-search`. It uses the same non-search stand-in as 婚姻状况 / 证件类型: the harvested id sits on `.ant-select`, and the list id sits on the listbox. Option-row markup is synthetic. A live click is not claimed.

RelationshipType and AwardsLevel are wired offline. Suggested next offline order: EnglishLevel → ChannelType → InterviewCity. InterviewCity and ChannelType can wait. RankingMajor is `DOM_CONTROL_MISSING` and stays out of that order. The trimmed note is `CMB_DICT_REMAINING_TRIM_20261019.md`. Never Save. 招行 is not supported.

## Education neighbors that are not filled

These ids were on the same education row and are not filled:

- `resume_educationHistoryList_0_collegeName` (学校名称, text, placeholder 请输入高中学校名称)
- `resume_educationHistoryList_0_startDate`
- `resume_educationHistoryList_0_endDate`
- `resume_educationHistoryList_0_fullEducation`

No `resume_educationHistoryList_1_*` id was present.

## Other resume_* ids (not wired)

Counts from the harvest list. The full id list is in the JSON.

| Group | Count | Examples |
| --- | ---: | --- |
| basicInfo | 27 | name, idCard, gender, birthday, mobile, email, height, weight, channelType, expectedInterviewCity, maritalStatus, currentResidence, hasFormalWork, selfAssessment, plus a few `*_list` nodes |
| education | 5 | educationLevelCode plus the four neighbors above |
| family | 14 | relationship/name/phone on rows 0 and 1 |
| skill | 4 | englishLevel, englishScore, computerSkill, otherSituation |
| internship | 8 | companyName, city, dates, formal, practiceContent |
| award | 4 | awardType, awardName, awardLevel, awardDate |
| club | 4 | communityName, schoolOfficeName, startDate, schoolOfficeDescription |
| other | 1 | `resume_resumeId` |
