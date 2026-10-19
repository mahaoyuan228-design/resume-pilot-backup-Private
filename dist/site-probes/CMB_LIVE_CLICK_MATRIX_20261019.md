# 招行 live 点击验收最小矩阵（2026-10-19）

Never Save。一次一字段。试填 Edge CDP **9237**。停在 `https://career.cmbchina.com/center/resume`。

未宣称招行已支持。整体进度口径由主脑报。本文不写验收百分比。

离线 Select 除 RankingMajor 外已齐。选项和 DOM id 已采。live 点击尚未证明。`node scripts/auto-cmb-basic.mjs --only <页面标签> --live` 仍在打开点击之前退出 3，原因是下表的 refuse 码。本文件不解除该拒绝，也不把离线合成当成 live 填表。

## 规则

- 一次只做一个字段。该字段读回后再换下一个。
- 只做 fill-wo-save：点开、选中、读回选中文案和 code。不点保存，不点提交。
- 不改相邻控件。证件号、学校名称、家庭姓名和电话、奖项名称、获奖时间、英语分数都不填。
- 关系类型的两行分开读回。一行的值不写到另一行。一次只动一个索引。
- RankingMajor 是 `DOM_CONTROL_MISSING`。不做，不猜 selector。

## 字段与 refuse 码

| 顺序 | 字段 | 页面标签 | 控件 | 当前 `--live` refuse |
| --- | --- | --- | --- | --- |
| 1 | 婚姻 | 婚姻状况 | `#resume_basicInfo_maritalStatus` | `live_marital_select_fill_unclaimed` |
| 2 | 政治 | 政治面貌 | `#resume_basicInfo_politicalAffinity` | `live_politics_select_fill_unclaimed` |
| 3 | 民族 | 民族 | `#resume_basicInfo_nation` | `live_ethnicity_select_fill_unclaimed` |
| 4 | 证件 | 证件类型 | `#resume_basicInfo_idCardType` | `live_id_card_type_select_fill_unclaimed` |
| 5 | 学历 | 学历 | `#resume_educationHistoryList_0_educationLevelCode` | `live_education_level_select_fill_unclaimed` |
| 6 | 关系 | 关系类型 | `#resume_familyList_0_relationship`；另有 `#resume_familyList_1_relationship` | `live_relationship_select_fill_unclaimed` |
| 7 | 获奖 | 获奖级别 | `#resume_awardList_0_awardLevel` | `live_award_level_select_fill_unclaimed` |
| 8 | 英语 | 最高英语水平 | `#resume_skill_0_englishLevel` | `live_english_level_select_fill_unclaimed` |
| 9 | 渠道 | 招聘信息来源 | `#resume_basicInfo_channelType` | `live_channel_type_select_fill_unclaimed` |
| 10 | 面试城市 | 面试期望城市 | `#resume_basicInfo_expectedInterviewCity` | `live_interview_city_select_fill_unclaimed` |

页面标签是 harness `--only` 的原词。渠道的别名是「渠道」，英语的别名是「英语等级」，关系的别名是「家庭关系」。别名不改变 refuse 码。

## 不做

RankingMajor：当前简历页无此控件。状态 `DOM_CONTROL_MISSING`。只保留字典夹具。不进入本矩阵。

## 需要 Jeremy 时

登录保持。允许助手在试填 Edge（CDP 9237）做 fill-wo-save 点击读回。不点保存。页面停在 `/center/resume`。一次一字段，按上表顺序。未宣称招行已支持。
