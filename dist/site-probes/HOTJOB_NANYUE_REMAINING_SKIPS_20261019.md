# 广东南粤银行 · 仍跳过 / 未宣称 · 2026-10-19

对照：`HOTJOB_NANYUE_CMS_BASIC_LIVE_20261019.md`。  
`personalVerified=8` `failed=0` 只覆盖那次 basic fill-without-save。验收仍 **85%**。**不是**全站支持。Never Save。

本仓库没有那份 evidence JSON 的逐项副本。下面只记已证实的缺口，不补未见到的题面。

## 故意不绑（避免 duplicate / 错段）

| 题 | 处理 |
| --- | --- |
| `家庭关系必填` 的姓名 | `section_requires_mapping`。不再当 `fullName` |
| `个人基本信息必填` 的联系电话 | 同区已有 `移动电话` 时不绑 `phone`。单独只有联系电话时仍可绑 |
| `个人基本信息必填` 的专业 / 专业名称 | `section_requires_mapping`。不拿教育经历 major 去填 |

## 这次没有宣称做过

- 教育经历整段、实习、照片。这些路径仍钉在招商基线页，没有在南粤上跑。
- 求职意向、英语、资格考试等其它分区。没有从 evidence JSON 抄一份跳过清单。
- Celebright、国盛，以及 verify 表里其余壳猜。没有 live fill。
- 客户可卖名单。仍只招商 CMS + 国泰 GTH。

较早一轮里姓名和联系电话是 `duplicate_target`。~09:00 那轮在开门后读回了姓名和移动电话，`failed=0`。联系电话在两号并存时仍是上面的故意跳过，不是失败。

## Codex 对照（2026-10-19）

Never Save。不宣称南粤已支持。本刀只记对照，不改 CMS 核心。

1. 确认 1–6 无 login-free 引擎补丁。国籍/地区、婚姻状况、毕业院校、政治面貌、籍贯、教育经历内学历仍不能凭 reason code 放宽 CMS 守卫。
2. 下一刀优先「国籍/地区」单条 customScopedAnswer（证据齐全时）；否则本轮只采 DOM。
3. 政治面貌等事实歧义等 Jeremy 澄清唯一事实后再配答案。歧义未消除持续跳过，不推断。
