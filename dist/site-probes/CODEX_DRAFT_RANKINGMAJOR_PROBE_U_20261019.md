# Codex U draft

URL: https://chatgpt.com/local/01a1531e-7d85-7519-806e-2db0936300e0
Model: GPT-6.1 Sol Extra High

只读 live 探针草稿（未执行；不据此变更 RankingMajor 状态）：

1. 进入目标简历页，等待页面稳定。
2. 只读检查当前 live DOM、可访问性树，寻找专业排名相关标签及真实表单控件。
3. 根据现场实际属性、label-for、aria-labelledby 等证据核验字段身份与关联；禁止猜 selector，不能仅凭文字相邻认定。
4. 记录标签、控件类型、实际 id（没有则记“未采到”）、候选数量及 DOM 已有选项。字典“前20%／中等／中下等”仅作对照，不证明控件存在。
5. 按下表输出唯一判定码，并附最小证据与检查范围；检查不足或关联不清时判 AMBIGUOUS。
6. 立即停止。禁止 fill、选值、提交或主动触发表单事件。Never Save。

| 判定码 | 条件 |
| --- | --- |
| CONTROL_FOUND | 发现真实控件或控件组，字段身份可确认，且唯一对应 RankingMajor。 |
| DOM_CONTROL_MISSING | 当前页检查充分，未发现对应控件、相关标签或待确认候选。 |
| LABEL_ONLY | 发现明确相关标签或文本，但未发现对应真实控件，也无待确认候选。 |
| AMBIGUOUS | 多候选、字段身份或标签关联不清，或检查范围不足以判定。 |
