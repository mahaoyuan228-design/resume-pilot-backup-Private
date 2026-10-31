# CA 离线刀 · 招行出生日期 hint 判定码常量 · 2026-10-19

对齐 RankingMajor 常量刀（6b5319f）：无 DOM helper 时加 constants + 离线测。

拟码（与 CMB_BIRTHDATE_HINT_NEXT 一致，不进 fill）：
- datepicker_hint_only（现状，已有测 482ded7）
- DOB_HINT_MISSING / DOB_HINT_AMBIGUOUS（合成 hint）
- DOB_CONTROL_UNOBSERVED / DOB_FORMAT_UNVERIFIED（须 live，仅文档常量）

硬约束：Never Save；不点日历；不改 fill；不宣称已支持；不碰 cms/gth/secrets。
成功：常量模块 + 测绿；或明确「已有导出可复用」。
