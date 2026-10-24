# Celebright / 国盛 · 试填前检查 · 2026-10-19

试验站。Never Save。键已 prep（见 `HOTJOB_CELEBRIGHT_TRIAL_PACK_20261019.md`）。南粤 PASS 不代替本租户。不宣称已支持。

证据根：`dist/auto-runs/hotjob-celebright/<run-id>/` 与 `dist/auto-runs/hotjob-guosheng/<run-id>/`（分租户，勿混）。

| # | 检查项 | 停/过 |
| --- | --- | --- |
| 1 | 范围：仅 `celebright` / `guosheng` 键；HOTJOB 试验定位 | 错键即停 |
| 2 | 登录：人工登录对应该租户；核对 SU；不碰私钥 | 账号/租户不符即停 |
| 3 | 页面：域名/SU/`resumeOperation` 表单与 P 包一致 | 不符即停 |
| 4 | Never Save：配置与行为已确认（无持久化请求） | 未确认即停 |
| 5 | 证据路径可写（上表两根目录） | 不可写即停 |
| 6 | 留证：脱敏前后截图、字段结果、时间；**停在提交前** | — |
| 7 | 回报：仅观察与缺口；禁止写「已支持」 | — |

命令：`scripts\\run-hotjob-tenant.cmd celebright` 或 `guosheng`；默认 CDP 9237。
