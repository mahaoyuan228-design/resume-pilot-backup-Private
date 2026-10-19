# 招行出生日期 · live 采包（待执行）· 2026-10-19

现状：`datepicker_hint_only`。Never Save。未宣称已支持。RankingMajor 仍 `DOM_CONTROL_MISSING`（独立，不并入本包）。

证据根：`dist/auto-runs/cmb-dob/<run-id>/`

| # | 步骤 | 产出 |
| --- | --- | --- |
| 1 | 记页面/时间/字段区；禁止保存提交下一步；若无法排除自动保存→只读观察 | `01-context.md` |
| 2 | 从「出生日期」标签定位关联控件；无则 `DOB_CONTROL_UNOBSERVED` 停交互 | `02-locator.json` |
| 3 | 形态：原生 date / 文本 / 只读 / 按钮组合；readonly/disabled/role | `03-control.png`、`03-control.html` |
| 4 | placeholder/格式说明/pattern；`DOB_HINT_*` 仅用已有枚举 | `04-hints.json` |
| 5 | **人工**打开一次入口；记弹层结构；**禁止自动点日历/选日/填值** | `05-interaction.md`、`05-popup.png` |
| 6 | 提示格式 vs 显示 vs DOM value；缺验证→`DOB_FORMAT_UNVERIFIED` | `06-format.json` |
| 7 | 安全关闭；记字段是否变化与相关请求（无请求也注明） | `07-actions.md` |
| 8 | 汇总判定；每码挂文件；缺件标未采 | `08-verdict.json` |

| 判定码 | 条件 |
| --- | --- |
| `datepicker_hint_only` | 本轮维持 hint-only，不升级支持 |
| `DOB_HINT_MISSING` / `DOB_HINT_AMBIGUOUS` | 提示证据命中 |
| `DOB_CONTROL_UNOBSERVED` | 无关联控件 |
| `DOB_FORMAT_UNVERIFIED` | 格式未验证 |

依赖 Jeremy 登录招行表单。不猜生日。
