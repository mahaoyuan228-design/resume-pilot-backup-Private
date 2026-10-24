| 步骤 | 只读动作与判定落点 |
|---|---|
| 1．页面可达 | 记录实际 URL、时间、可达性；不可达→`PROBE_INCONCLUSIVE`。 |
| 2．标签定位 | 按探针包在实页定位目标标签，记录原文与截图；无法可靠定位→`PROBE_INCONCLUSIVE`。 |
| 3．控件检查 | 只读检查标签关联、实际候选控件及数量；不编造 DOM 或选择器。 |
| 4．四码落点 | 唯一关联→`DOM_CONTROL_PRESENT`；检查完整且无控件→`MISSING`；多候选或关联冲突→`AMBIGUOUS`；证据不足→`PROBE_INCONCLUSIVE`。全部引用现有模块原值。 |
| 5．证据路径 | 拟存 `dist/auto-runs/cmb-rankingmajor/<run-id>/`：页面截图、实际 DOM 摘要、判定码与理由；缺证据须注明。 |
| 6．会话收口 | 草稿未执行；已知 live 仍为 `DOM_CONTROL_MISSING`。Never Save；不输入、不提交，不据此宣称可填或已支持。 |