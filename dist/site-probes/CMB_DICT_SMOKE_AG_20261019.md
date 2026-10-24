# 招行 dict Select · 冒烟复跑清单 · 2026-10-19

Never Save。不宣称已支持。RankingMajor 仍 `DOM_CONTROL_MISSING`；DOB 仍 `datepicker_hint_only`——**勿混入本表**。

挂接：`CMB_LIVE_SELECT_CLICK_EVIDENCE_20261019.md`（试填 Edge 10/10）；`tests/cmb-slice2-edges.test.mjs` / `CMB_SLICE2_EDGE_REGRESSION_AD_20261019.md`。

| # | 字段或断言 | 复跑路径 | 期望 | 勿重开 |
| --- | --- | --- | --- | --- |
| 1 | 婚姻 | `cmb-harvest-maritalStatus`（及 live 点击证据） | Never Save | 既有门控；不扩项 |
| 2 | 政治面貌 | `cmb-harvest-politics` | Never Save | 同上 |
| 3 | 民族 | `cmb-harvest-ethnicity` | Never Save | 同上 |
| 4 | 证件类型 | `cmb-harvest-idCardType` | Never Save | 同上 |
| 5 | 已采 dict Select 点击回归 | Edge live Select 10/10 证据包 | 10/10 Never Save | 不新增 DOM 假设 |
| 6 | dict 相关非法值断言 | 第二切片 `invalid_profile_value` 等离线测 | Never Save | 不重做既有边界映射 |

可售仍仅招商 CMS + 国泰 GTH。
