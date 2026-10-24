# 招行 DOB 采包 · 核对表（对照 AC 包）· 2026-10-19

Never Save。现状仍 `datepicker_hint_only`。不升级支持。挂接：`CMB_DOB_LIVE_HARVEST_PACK_20261019.md`。

证据根：`dist/auto-runs/cmb-dob/<run-id>/`

| # | 步骤（与 AC 包对齐） | 产出 | 判定码 |
| --- | --- | --- | --- |
| 1 | 记页面/时间；禁保存提交；自动保存风险→只读 | `01-context.md` | — |
| 2 | 「出生日期」标签定位关联控件 | `02-locator.json` | 无→`DOB_CONTROL_UNOBSERVED` |
| 3 | 形态：原生 date/文本/只读/按钮；readonly/disabled/role | `03-control.png`、`03-control.html` | — |
| 4 | placeholder/格式说明/pattern | `04-hints.json` | `DOB_HINT_*` |
| 5 | **人工**只开一次入口；禁自动点日历/选日 | `05-interaction.md`、`05-popup.png` | — |
| 6 | 提示格式 vs 显示 vs DOM value | `06-format.json` | 缺→`DOB_FORMAT_UNVERIFIED` |
| 7 | 安全关闭；记字段变化与请求 | `07-actions.md` | — |
| 8 | 汇总；每码挂文件 | `08-verdict.json` | 维持 `datepicker_hint_only` |

未采证。可售仅 CMS+GTH。
