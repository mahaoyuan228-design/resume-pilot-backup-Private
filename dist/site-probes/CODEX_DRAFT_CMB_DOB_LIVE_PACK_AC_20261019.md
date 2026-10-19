# Codex AC draft

https://chatgpt.com/local/01a15340-f3c9-773b-8a46-be438518d0c5

GPT-6.1 Sol Extra High

env: resume-pilot-backup-Private

可裁剪草稿：**待执行，未采证；当前仍为 `datepicker_hint_only`。** 工作区未检出 `CMB_BIRTHDATE_HINT_NEXT` 正文，以下据题面整理。

拟采证据目录：`work/evidence/cmb-dob/<run-id>/`，下列文件名均相对此目录。

1. **确认边界**：记录页面、时间及出生日期字段所在区域。全程 **Never Save**，不触发保存、提交、下一步；若无法排除自动保存，限于只读观察。→ `01-context.md`
2. **定位关联控件**：从“出生日期”标签确认对应节点，记录 iframe／Shadow DOM 可达性；未观察到关联控件则记 `DOB_CONTROL_UNOBSERVED`，停止交互。→ `02-locator.json`
3. **记录控件形态**：采局部截图与最小 DOM 片段，区分原生 `input[type=date]`、文本框、只读输入框、按钮或组合控件；记录 `readonly/disabled/role`。→ `03-control.png`、`03-control.html`
4. **提取提示证据**：逐字记录 placeholder、格式说明、`pattern/inputmode` 及其来源；`DOB_HINT_*` 具体码仅沿用原材料枚举，不自行扩展。→ `04-hints.json`
5. **观察交互入口**：仅在确认无写入风险后，由人工打开一次已定位的入口；记录弹层、年月日结构及关联关系。禁止自动点击日历、选择日期或填值。→ `05-interaction.md`、`05-popup.png`
6. **分列格式事实**：分别记录提示格式、现有显示格式与 DOM value 结构。占位符或日历外观不能证明输入接受格式；缺少验证链路则记 `DOB_FORMAT_UNVERIFIED`。→ `06-format.json`
7. **记录交互收尾**：仅使用已确认安全的关闭方式；记录实际动作、字段是否变化及已观察到的相关请求。无请求证据也须注明，不能据此推断不会写入。→ `07-actions.md`
8. **汇总判定**：按“控件形态→交互→格式→未观察项”索引证据；每个判定码关联具体文件，缺件明确标记未采。→ `08-verdict.json`

| 判定码 | 使用条件 |
| --- | --- |
| `datepicker_hint_only` | 本轮仍维持 hint-only，不升级支持结论 |
| `DOB_HINT_*` | 提示证据命中原材料已有具体码；未对照前仅保留提示原文 |
| `DOB_CONTROL_UNOBSERVED` | 未观察到与出生日期关联的控件，注明观察范围与原因 |
| `DOB_FORMAT_UNVERIFIED` | 接受格式或显示／内部值转换缺少验证证据 |

`RankingMajor` 仍为 `DOM_CONTROL_MISSING`，独立保留，不并入出生日期判定。本稿不构成“出生日期已支持”的结论。
