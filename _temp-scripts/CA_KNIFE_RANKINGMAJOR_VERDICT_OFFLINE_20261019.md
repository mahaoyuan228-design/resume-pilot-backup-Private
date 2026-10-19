# CA 下一离线刀候选 · RankingMajor 判定码离线护栏 · 2026-10-19

目标：若 PR 分支已有 RankingMajor 探针/判定 helper，补离线单测断言四码
`DOM_CONTROL_PRESENT|MISSING|AMBIGUOUS|PROBE_INCONCLUSIVE` 字面量与互斥；无 helper 则只加
`tests/` 文档化常量表 + 空壳 skip，**禁止**编造 DOM / 改填取引擎。

硬约束：Never Save；不宣称已支持；RankingMajor 现状仍 `DOM_CONTROL_MISSING`；不碰 cms/gth/secrets。

成功：测试绿或明确「无 helper 可测」短注；报告 SHA。
