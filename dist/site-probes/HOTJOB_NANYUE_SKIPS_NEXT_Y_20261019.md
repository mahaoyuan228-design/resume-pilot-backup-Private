# 南粤剩余 skip · Y 定稿分流 · 2026-10-19

对照 `HOTJOB_NANYUE_REMAINING_SKIPS_20261019.md`。Never Save。试验站。**无** login-free 引擎补丁。不宣称南粤客户可填。

| 剩余 skip | 离线可澄清 | 须 live / Jeremy |
| --- | --- | --- |
| question_scope_mismatch：国籍/婚姻/毕业院校 | 有脱敏快照时核对题干/标签/分组；确认仍是招商 `sitePageUrl` 绑南粤页 | 南粤-scoped `customScopedAnswers`；Never Save 复验识别与匹配 |
| ambiguous：政治面貌 | 核对选项/别名歧义；不推断个人属性 | 只留一条南粤-scoped confirmed fact；验证唯一匹配 |
| region（籍贯） | 核对层级/名称/编码证据是否招商-bound | 南粤 `sitePageUrl` + region JSON；验证联动回显 |
| 教育专业 / 学历 mapping | 核对原值与词典依据；缺证保留 skip | tenant `siteOptionMappings`（勿离线编造选项文案） |

**结论**：1–6 仍 **needs Jeremy**；禁止放宽 scope / 猜选项 / 复制招商行到南粤 URL。
