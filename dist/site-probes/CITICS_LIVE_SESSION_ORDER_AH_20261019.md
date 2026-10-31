# 中信 · Jeremy 回场单次会话顺序 · 2026-10-19

Never Save。不宣称已支持。学历仍 `live_education_options_unharvested`（AA 离线 guards ≠ live 选项）。

挂接：`CITICS_NEXT_LIVE_PRIORITY_20261019.md`；`CITICS_EDUCATION_HARVEST_PACK_20261019.md`；SLEEP_HELP §2。

证据根：`dist/auto-runs/citics/<run-id>/`

| # | 步骤 | 边界 | 证据文件 |
| --- | --- | --- | --- |
| 1 | 登录 | `careers.citics.com` 本站登录；禁止跨站复用登录态 | `01-login.json` |
| 2 | 户口 | 只记可观察控件/选项/依赖 | `02-hukou.json` |
| 3 | 证件 | 类型选项；不采证件号；不猜 DOM | `03-document.json` |
| 4 | 民族 | 选项全文；保留原文 | `04-ethnicity.json` |
| 5 | 学历闸门 | 若仍 unharvested：**停在学历前**，不展开不选，只记缺口 | `05-education-gap.json` |
| 6 | 落盘 | 01→05 核验；记停止原因与缺失 | `06-manifest.json` |

`CITICS_EDUCATION_HARVEST_PACK` 与 AA synthetic 不得替代 live 学历选项。
