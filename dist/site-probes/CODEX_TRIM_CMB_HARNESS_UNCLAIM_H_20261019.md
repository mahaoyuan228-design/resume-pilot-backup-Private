# Codex H 裁剪 · 招行 harness 去硬拒对照 · 2026-10-19

- **派了什么**：对照 80cca97 后，把「无条件 live 硬拒」改成「逐字段证据门禁」的最小改动清单 + 10 字段表。
- **为何派**：省本助手对照 harness / 证据门禁细节的起草时间；主脑已做 live 10/10 点击与 80cca97 开门禁。
- **模型与强度**：GPT-6.1 Sol Extra High。
- **自己裁剪验了什么**：
  1. **已落地可忽略**：草稿仍写「十个 JSON 是 stub」——以主脑 box 真实 JSON 为准；CloudAgent 正用附件覆盖 stub。80cca97 已有 `LIVE_SELECT_EVIDENCE` / `readLiveSelectClaim()` / live 分流。
  2. **仍值得下一刀（按优先级）**：
     - `readLiveSelectClaim()` 拒 stub / 错站点 / 错字段 / 错索引；
     - live 仅 `--only <单字段>` + 真实菜单点击回读（勿把 `applyCodedSelect` 合成改 DOM 当 live 成功）；
     - catch 勿一律 `live_cdp_unavailable`；
     - RankingMajor 继续 `DOM_CONTROL_MISSING`，不进放行表。
  3. 10 行 ID 表与实测一致（关系/英语/获奖 id、民族 show-search、学历保留博士后）——可作回归对照。
- **硬约束**：Never Save；`formFillClaimed:false`；不宣称招行已支持；不改 cms/gth。
