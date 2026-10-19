未取得三份原文，以下为**待对照草稿**，未执行；原用例编号待回填，证据名均为建议。证据根：`dist/auto-runs/gth-smoke/<run-id>/`。

| 必跑断言 | 证据名 | Never Save |
|---|---|---|
| 付费验收实例确为 **9239**，记录版本与 run-id | `env-9239.json` | 禁保存、禁提交 |
| **9237 试填结果不得抵付费验收** | `trial-paid-separation.json` | 禁保存、禁提交 |
| REGRESSION 原必跑项逐项复跑；漏跑不得判通过 | `gth-regression.json` | 禁保存、禁提交 |
| CROSSWALK 中 GTH 对应项保留原断言及证据映射 | `gth-crosswalk.json` | 禁保存、禁提交 |
| MATRIX_AB 中映射到 GTH 的付费项按原 A/B 定义在 9239 验证 | `paid-ab-9239.json` | 禁保存、禁提交 |
| 按原清单核对预期与实际读回；未观察项标待验，不补造 DOM | `gth-readback.json` | 禁保存、禁提交 |
| 全程保存、提交触发数为 0；结论仅覆盖本轮 GTH 回归项 | `never-save-audit.json` | 必须为 0 |