学历继续以 `live_education_options_unharvested` 单独阻塞；采包已写不等于选项全文已采。以下仅是采证优先级，不代表已支持。失败码为建议名。

| 优先字段 | 为何优先 | 要采的 live 证据 | 失败码 | 与 allowlist 的关系 |
|---|---|---|---|---|
| 1. 户口类型 | 已有 synthetic 基础，优先补真实页面证据 | 字段标签与控件对应、展开后的完整选项；确认是否触发级联 | `live_hukou_type_evidence_incomplete` | 本项 synthetic PASS、live pending；婚姻/政治可作采证格式对照 |
| 2. 证件类型 | 已有 synthetic 基础，需核实真实选项及切换影响 | 完整类型选项；若已有切换证据，记录相关字段显隐或校验变化，不采证件号码 | `live_id_type_evidence_incomplete` | 本项 synthetic PASS、live pending；不能沿用婚姻/政治的 live 结论 |
| 3. 民族 | 已有 synthetic 基础，补齐真实选项覆盖 | 字段与控件对应、选项全文；有滚动或搜索时记录覆盖范围及遗漏 | `live_ethnicity_evidence_incomplete` | 本项 synthetic PASS、live pending；其他字段 PASS 不构成本项证据 |

**需 Jeremy**

提供登录后上述三项的脱敏原始证据，标明页面、时间、采集范围及缺口。遇到级联先记录触发条件并停扩；仅拿到选项，也不能直接判定填充 live PASS。

**不要做**

- 不把学历缺口并入其他字段成功结论，不推测学历选项。
- 不扩籍贯等疑似级联字段；婚姻/政治保留已知 live PASS，作为对照。
- Never Save；不改 cms/gth，不编造 DOM、选项或成功状态，不输出完整插件代码。