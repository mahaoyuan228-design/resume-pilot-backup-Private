# 国泰 GTH · 回归冒烟行（付费 9239）· 2026-10-19

未执行。Never Save。挂接：`GTH_REGRESSION_SMOKE_CHECKLIST`；`GTH_VS_PAID_QA_CROSSWALK`；`PAID_EDGE_9239_QA_MATRIX_AB_20261019.md`；`PAID_VS_TRIAL_EDGE_AN_20261019.md`。

证据根：`dist/auto-runs/gth-smoke/<run-id>/`

| # | 必跑断言 | 证据名 |
| --- | --- | --- |
| 1 | 实例确为 **9239**，记版本与 run-id | `env-9239.json` |
| 2 | 9237 试填结果不得抵付费验收 | `trial-paid-separation.json` |
| 3 | REGRESSION 必跑项逐项复跑；漏跑不判通过 | `gth-regression.json` |
| 4 | CROSSWALK GTH 项保留原断言与证据映射 | `gth-crosswalk.json` |
| 5 | MATRIX_AB 中 GTH 付费项在 9239 验证 | `paid-ab-9239.json` |
| 6 | 预期 vs 读回；未观察标待验 | `gth-readback.json` |
| 7 | 保存/提交触发数 = 0 | `never-save-audit.json` |
