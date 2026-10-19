# 南粤剩余 skip · Jeremy 回场操作提纲 · 2026-10-19

试验站。Never Save。**无** login-free 引擎补丁。不宣称南粤可卖。挂接：`HOTJOB_NANYUE_SKIPS_NEXT_Y_20261019.md`。

| # | Jeremy 做什么 | 对应 skip | 禁止 |
| --- | --- | --- | --- |
| 1 | 登录南粤本站表单（独立会话） | 会话前提 | 不复用招商登录态 |
| 2 | 对「国籍/婚姻/毕业院校」确认题干属南粤页后，只写南粤-scoped `customScopedAnswers` | question_scope_mismatch | 不复制招商 `sitePageUrl` 行 |
| 3 | Never Save 复验：识别与匹配是否命中南粤答案 | 同上复验 | 不点保存/提交 |
| 4 | 政治面貌：只留一条南粤-scoped confirmed fact；验证唯一匹配 | ambiguous | 不猜个人属性 |
| 5 | 籍贯：南粤 `sitePageUrl` + region JSON；验证联动回显 | region | 不用招商-bound 编码顶替 |
| 6 | 教育专业/学历：有本租户 mapping 才填；缺证保留 skip | 教育 mapping | 不离线编造选项文案 |
| 7 | 记本轮 skip/命中与证据路径后收口 | 汇总 | 不放宽 scope |
| 8 | （可选）关多余标签 | 桌面整洁 | — |

1–6 仍 **needs Jeremy**。可售仅 CMS+GTH。
