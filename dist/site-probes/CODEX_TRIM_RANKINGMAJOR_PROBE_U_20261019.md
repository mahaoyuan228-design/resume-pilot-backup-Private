# Codex U 裁剪 · RankingMajor 只读探针步骤 · 2026-10-19

- **派了什么**：RankingMajor 只读 live ≤8 步 + 四判定码。
- **为何派**：省本助手重写探针步骤；对照已有 `CMB_RANKINGMAJOR_PROBE_PACK`。
- **模型**：GPT-6.1 Sol Extra High。
- **裁剪**：采纳 6 步只读流程与 Never Save。判定码**以工程包为准**：`DOM_CONTROL_PRESENT` / `DOM_CONTROL_MISSING` / `DOM_CONTROL_AMBIGUOUS` / `PROBE_INCONCLUSIVE`（Codex 的 CONTROL_FOUND≈PRESENT；LABEL_ONLY 并入 AMBIGUOUS 或单独记证据，不新增引擎码）。不猜 selector；不改状态仅凭草稿；不宣称已支持。详 `CMB_RANKINGMAJOR_PROBE_PACK_20261019.md`。
