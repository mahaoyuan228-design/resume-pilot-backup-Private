# 飞书 ATSX · 单站 live DOM 采包检查 · 2026-10-19

Never Save。离线门禁绿≠已支持。挂接：`FEISHU_ATSX_LIVE_DOM_HARVEST_PACK_20261019.md`；`ATS_OFFLINE_GATES_SUMMARY_20261019.md`；`ATS_LIVE_DOM_SESSION_ORDER_AE_20261019.md` §4。

证据根：`dist/auto-runs/ats-live-dom/feishu-atsx/<run-id>/`

| # | 检查项 | 要求 |
| --- | --- | --- |
| 1 | 登录隔离 | 独立会话；不跨站共享登录；需登录→`AUTH_REQUIRED` |
| 2 | DOM 合同 | `.atsx-form` / `.atsx-form-item` / `input.atsx-input` 仅 JS-confirmed、待 live；不符→`DOM_CONTRACT_MISMATCH`，不猜替代选择器 |
| 3 | Never Save | 只读采包；不保存/提交/写接口；不碰私钥 |
| 4 | 证据路径 | 上表根目录；脱敏 DOM/截图/核对结果；不含凭据 |
| 5 | 漂移与失败 | fixture 不符→`FIXTURE_DRIFT`；失败留原因+证据路径；不补造 DOM |
| 6 | 状态边界 | 飞书待 live；可售仅 CMS+GTH |

建议失败码见飞书 LIVE_DOM 包。未采证。不宣称飞书已支持。
