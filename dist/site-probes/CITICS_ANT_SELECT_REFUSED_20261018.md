# CITICS Ant Select — allowlist vs refused · 2026-10-18（Asia/Shanghai）

## Allowlist (flat Ant Design Vue 1; fill-wo-save)

| 标签 | 证据 | 状态 |
| --- | --- | --- |
| 婚姻状况 | synthetic + live PASS | done |
| 政治面貌 | synthetic + live PASS | done |
| 户口类型 | synthetic PASS（家庭户口↔集体户口） | done；live pending `/my/jl` |

## Refused / out of scope (do not expand yet)

| 标签 | 原因 |
| --- | --- |
| 籍贯 | 样本文本双段「北京 / 北京市」→ 疑似级联 |
| 现户口所在地 | 地区类 → 疑似级联/多 Select |
| 生源地 | 同上 |
| 国籍（国家或地区） | 可搜/长列表嫌疑（对照 hotjob-mc 国籍 skip） |
| 民族 | 中等列表；非本刀；neighbor-only in fixtures |
| 证件类型 | 设计稿「页上已有则跳过」；短枚举但未开刀 |

Shared helper (`selectControl` / `readSelect` / `fillSelect`) stays allowlist-only + cascader fail-closed. Never Save.
