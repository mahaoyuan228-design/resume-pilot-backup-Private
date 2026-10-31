# Codex Q draft https://chatgpt.com/local/01a15311-050f-7423-ab06-7184822700e5 · GPT-6.1 Sol Extra High

可裁剪草稿；离线项失败码均为拟名，待主工程对齐，不代表已支持。

| 离线下一刀：字段 | 为何可离线 | 失败码（拟） | 禁止项 |
|---|---|---|---|
| 身高 | 现有合成刀补空值、非法数值、单位用例 | `VALUE_EMPTY` / `NUMBER_INVALID` / `UNIT_UNMAPPED` | 猜真实范围、自动补值 |
| 体重 | 现有合成刀补小数、单位、非法文本用例 | `NUMBER_INVALID` / `UNIT_UNMAPPED` | 猜单位、擅自换算 |
| 性别 | 合成 radio 可测明确映射、唯一命中与互斥 | `OPTION_UNMAPPED` / `RADIO_AMBIGUOUS` | 默认性别、按位置强选 |
| 是否参加过正式工作 | 合成 radio 可测明确输入、互斥及重复执行 | `OPTION_UNMAPPED` / `RADIO_AMBIGUOUS` | 从年龄或经历推断答案 |

| 需 live | 当前失败码 | 下一探针 | 禁止项 |
|---|---|---|---|
| `RankingMajor` | `DOM_CONTROL_MISSING` | 只读确认真实控件、关联标签及交互入口 | 不猜 selector，不凭离线结果解除门禁 |

| 不要做 | 约束 |
|---|---|
| 保存、提交 | **Never Save** |
| 改动 `cms/gth` | 不进入本切片范围 |
| 扩张既有结论 | 第一切片及 dict Select 10 字段沿用已有证据与门禁 |
| 接管工程或对外定调 | 不接管仓库、不宣称已支持、不输出完整插件代码 |
