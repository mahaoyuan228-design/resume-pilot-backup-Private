# 招行 RankingMajor · 只读存在性探针包（2026-10-19）

状态：`DOM_CONTROL_MISSING` · Never Save · 不进 live 放行表 · 未宣称已支持

## 步骤
1. 记录 URL、表单区段、登录/加载状态；不完整则停。
2. 从现场文案+真实 DOM 关联确认 RankingMajor；记标签、节点、role、可见/禁用、候选数。**不猜 selector**，不套其他 Select。
3. 两次无交互快照复核。不点击、展开、填值、保存。

## 证据目录
`dist/auto-runs/cmb-rankingmajor/<run-id>/`：`context.json` · `dom-01.txt` · `dom-02.txt` · `field.png` · `verdict.json`

## 判定码
| 码 | 含义 |
| --- | --- |
| `DOM_CONTROL_PRESENT` | 关联明确、唯一真实控件；另记可见/禁用 |
| `DOM_CONTROL_MISSING` | 范围可读且无对应控件 |
| `DOM_CONTROL_AMBIGUOUS` | 多候选或关联不明 |
| `PROBE_INCONCLUSIVE` | 加载未完/范围不可读/证据不足 |

隐藏/禁用 ≠ 缺失。存在性通过 ≠ 已支持；接线须另开刀+独立交互证据。
