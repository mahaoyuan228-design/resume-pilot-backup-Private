# 招行 RankingMajor · 只读探针会话步骤 · 2026-10-19

Never Save。只读。不宣称可填/已支持。工程四码常量已落地；**live 仍 `DOM_CONTROL_MISSING`**（未改此结论）。

挂接：`CMB_RANKINGMAJOR_PROBE_PACK_20261019.md`；`src/content/cmb-rankingmajor-verdict.mjs`。

证据根：`dist/auto-runs/cmb-rankingmajor/<run-id>/`

| # | 步骤 | 判定落点 |
| --- | --- | --- |
| 1 | 页面可达 | 记 URL/时间；不可达→`PROBE_INCONCLUSIVE` |
| 2 | 标签定位 | 实页定位目标标签+截图；不可靠→`PROBE_INCONCLUSIVE` |
| 3 | 控件检查 | 只读：关联、候选控件及数量；不编造 DOM/选择器 |
| 4 | 四码落点 | 唯一关联→`DOM_CONTROL_PRESENT`；完整检查无控件→`DOM_CONTROL_MISSING`；多候选/冲突→`DOM_CONTROL_AMBIGUOUS`；证据不足→`PROBE_INCONCLUSIVE` |
| 5 | 证据路径 | 截图、DOM 摘要、判定码与理由；缺证据注明 |
| 6 | 会话收口 | 不输入不提交；本草稿未执行 |

可售仅 CMS+GTH。
