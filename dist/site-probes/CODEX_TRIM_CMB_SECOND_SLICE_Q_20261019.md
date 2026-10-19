# Codex Q 裁剪 · 招行第二切片下一离线刀 · 2026-10-19

- **派了什么**：招行第二切片（身高/体重/性别/是否参加过正式工作）下一离线可做 ≤5 + RankingMajor live 探针边界。
- **为何派**：省本助手写第二切片失败码/用例清单；RankingMajor 不猜 selector。
- **模型**：GPT-6.1 Sol Extra High。
- **裁剪**：
  - 保留四字段离线扩用例方向：身高/体重数值与单位；性别与「是否参加过正式工作」radio 互斥/映射。
  - 失败码均为**拟名**，入库前对齐工程既有码；不得把拟码当已实现契约。
  - RankingMajor 仍 `DOM_CONTROL_MISSING` → 只读 live 探针；不猜 selector、不凭离线解除门禁。
  - Never Save；不改 cms/gth；不宣称已支持；不输出完整插件代码。
- **草稿**：`CODEX_DRAFT_CMB_SECOND_SLICE_Q_20261019.md`
