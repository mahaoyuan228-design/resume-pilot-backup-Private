# CA 离线刀 · 中信学历合成 fixture（AA 定稿）· 2026-10-19

目标：按 CITICS_EDU_OFFLINE_NEXT_AA 做**最小可测**离线护栏，不编造 live DOM。

优先实现：
1. 学历≠学位映射负例（本科≠学士等）——若已有 citics profile-map / education helper，补测；否则只加常量+测。
2. Never Save 哨兵：合成路径不得调用 save/submit（若无填路径则文档+空壳断言模块导出标志）。
3. 明标 synthetic；不外推站点可用。

硬约束：Never Save；不宣称已支持；不碰 cms/gth/secrets；学历 live 仍阻塞。
成功：测绿或明确「无 helper 可测」短注 + SHA。
