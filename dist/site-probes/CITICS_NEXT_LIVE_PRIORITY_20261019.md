# 中信下一 live 优先（学历仍阻塞 · 2026-10-19）

学历：`live_education_options_unharvested`（采包已写 ≠ 选项已采）。Never Save。未宣称已支持。

| 优先 | 字段 | live 证据 | 建议失败码 |
| --- | --- | --- | --- |
| 1 | 户口类型 | 标签/控件、完整选项、是否级联 | `live_hukou_type_evidence_incomplete` |
| 2 | 证件类型 | 完整类型选项；切换显隐（不采证件号） | `live_id_type_evidence_incomplete` |
| 3 | 民族 | 选项全文；滚动/搜索覆盖 | `live_ethnicity_evidence_incomplete` |

婚姻/政治已 live PASS 仅作采证格式对照。籍贯等疑似级联不扩。
