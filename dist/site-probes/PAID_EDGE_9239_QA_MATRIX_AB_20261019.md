# 付费 Edge 9239 · CMS+GTH 客户前 QA 矩阵 · 2026-10-19

可卖仅 CMS+GTH。Never Save。未执行、未验收。依赖 Jeremy 登录。对照：`PAID_EDGE_9239_QA_CHECKLIST`、`GTH_REGRESSION_SMOKE_CHECKLIST`、`GTH_VS_PAID_QA_CROSSWALK`。证据根：`dist/auto-runs/paid-edge-9239/<run-id>/`。

| # | 步骤 | 预期 | 证据（拟定） | Never Save |
| --- | --- | --- | --- | --- |
| 1 | 核对 9239、版本、登录态 | 未登录→阻塞；**9237 不可替代** | `01-environment.txt` | 不记凭据/令牌/私钥 |
| 2 | CMS 合成简历快填 | 停在提交前；读回比对 | `02-cms.png` + 字段表 | 不触发保存/提交 |
| 3 | GTH 同简历快填 | 同上 | `03-gth.png` + 字段表 | 同上 |
| 4 | 空值/缺字段/已有值 | 跳过与覆盖规则与 checklist 一致 | `04-field-diff.csv` | 只记字段名与差异 |
| 5 | 刷新/切页再触发 | 无重复填入或跨页误填 | `05-repeat.txt` | 无意外恢复敏感输入 |
| 6 | 按 SMOKE 复跑并对 CROSSWALK | 缺证据记待测，不判通过 | `06-crosswalk.csv` | 不留表单原值 |
| 7 | Never Save 契约复核 | 退出重开无持久化 | `07-never-save.txt` | 核保存入口 |
| 8 | 会话失效/不可识别失败分支 | 记阻塞或失败，不判通过 | `08-blockers.txt` | 错误证据脱敏 |

本轮通过 = CMS 与 GTH 在 **9239** 均独立通过。不宣称已支持。
