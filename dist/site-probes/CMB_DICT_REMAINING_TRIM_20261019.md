# 招行剩余 dict 字段 · 裁剪笔记（2026-10-19）

来源：Codex Cloud GPT-6.1 Sol Extra High（已裁剪验收）· Never Save · **不宣称招行已支持**。验收仍 **85%**。

id 清单与教育经历邻居不在这里重复。见 [`CMB_REMAINING_DOM_20261019.md`](CMB_REMAINING_DOM_20261019.md)。排期见 [`CMB_NEXT.md`](CMB_NEXT.md)。选项 text+code 见 [`CMB_DICTMAP_FULL_20261019.md`](CMB_DICTMAP_FULL_20261019.md)。

## DOM（live 已采）

| Dict | DOM | 状态 |
|---|---|---|
| Education | `#resume_educationHistoryList_0_educationLevelCode` | 已离线接线。剔除占位 `ED000`（博士后）。`--live` 拒 `live_education_level_select_fill_unclaimed`。学校名称等同行控件不填。 |
| EnglishLevel | `#resume_skill_0_englishLevel` | 已离线接线。只接技能第 0 行。不自行换算等级。`--live` 拒 `live_english_level_select_fill_unclaimed`。 |
| RelationshipType | `#resume_familyList_0_relationship`（另有 `_1_`） | 已离线接线。两行索引隔离。`--live` 拒 `live_relationship_select_fill_unclaimed`。姓名和电话不填。 |
| AwardsLevel | `#resume_awardList_0_awardLevel` | 已离线接线。只接第 0 行。不按奖项名推断级别。`--live` 拒 `live_award_level_select_fill_unclaimed`。 |
| InterviewCity | `#resume_basicInfo_expectedInterviewCity` | 未接线，可延后 |
| ChannelType | `#resume_basicInfo_channelType` | 未接线，可延后 |
| RankingMajor | 当前简历页无此控件 | `DOM_CONTROL_MISSING`。只保留字典夹具，不猜 selector。 |

## 接线原则（验收后保留）

- 均可离线合成 dict code/name 候选；`--live` 统一拒至有 live 点击证据（建议码 `live_*_select_fill_unclaimed` 或 `LIVE_DISABLED_NEVER_SAVE`）。
- 剔除占位项（如 Education `ED000`）。
- 家庭 `_0_` / `_1_` 索引隔离，禁止串行。
- 不按奖项名推断 AwardsLevel；不把虚拟列表可见项数当字典总数。
- RankingMajor：只保留字典夹具，不猜 selector。状态码 `DOM_CONTROL_MISSING`。

## 下一刀顺序

ChannelType → InterviewCity

Education、RelationshipType、AwardsLevel、EnglishLevel 已离线落地，不重做。ChannelType 与 InterviewCity 可延后。RankingMajor 停在 `DOM_CONTROL_MISSING`。Never Save。未宣称已支持招行。
