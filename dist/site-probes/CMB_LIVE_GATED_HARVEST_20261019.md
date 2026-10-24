# 招行 live 门控四字段采数（2026-10-19）

**Never Save。** 未宣称招行已支持。未做 live 填表。验收仍 **85%**。

Jeremy 已在试填 Edge 登录 `https://career.cmbchina.com/center/resume`。本次只读采数，没有点保存。

| 文件 | 内容 |
| --- | --- |
| `cmb-live-gated-harvest-20261019.json` | 合并证据（主材料） |
| `cmb-dictmap-live-20261019.json` | `GET /api/socialRecruitmentWebsite/common/getCommonDictMap` 摘取 |
| `cmb-harvest-maritalStatus.json` | 婚姻状况 |
| `cmb-harvest-politics.json` | 政治面貌 |
| `cmb-harvest-ethnicity.json` | 民族 |
| `cmb-harvest-birthDate.json` | 出生日期 |

接口需要登录 cookie。选项已过滤「请选择」。

| 字段 | DOM | 采到 |
| --- | --- | --- |
| 婚姻状况 | `#resume_basicInfo_maritalStatus` ant Select | 未婚 MS001、已婚 MS002、离异 MS004、已育 MS007 |
| 政治面貌 | `#resume_basicInfo_politicalAffinity` ant Select | 13 项 PA* |
| 民族 | `#resume_basicInfo_nation` ant Select，show-search | 57 项 NA*（含「其他」） |
| 出生日期 | `#resume_basicInfo_birthday` ant DatePicker，readonly，placeholder 请选择日期 | 只记 kind + 填法提示，未编假 DOM |

离线刀用的是这份采到的中文名和 code，不是离线编造的选项。Select 的选项行标记是合成读回支架，不是 live 下拉合同。`--live` 仍拒绝。出生日期不写入。
