# CITICS Ant Select — allowlist vs refused · 2026-10-18（Asia/Shanghai）

## Allowlist (flat Ant Design Vue 1; fill-wo-save)

| 标签 | 证据 | 状态 |
| --- | --- | --- |
| 婚姻状况 | synthetic + live PASS | done |
| 政治面貌 | synthetic + live PASS | done |
| 户口类型 | synthetic PASS（家庭户口↔集体户口） | done；live pending `/my/jl` |
| 证件类型 | synthetic PASS（身份证↔中国护照） | done；live pending `/my/jl`；勿对外宣称已支持 |
| 民族 | synthetic PASS（汉族↔回族；fixture 6 options） | done；live pending `/my/jl`；勿对外宣称已支持 |

## Refused / out of scope (do not expand yet)

| 标签 | 原因 |
| --- | --- |
| 籍贯 | 样本文本双段「北京 / 北京市」→ 疑似级联 |
| 现户口所在地 | 地区类 → 疑似级联/多 Select |
| 生源地 | 同上 |
| 国籍（国家或地区） | 可搜/长列表嫌疑（对照 hotjob-mc 国籍 skip） |

### 民族 notes（synthetic vs live)
- Profile / SELECT_SPECS key: `ethnicity`（**not** `nation` — avoid 国籍 collision）.
- Synthetic fixture: flat Ant Select, **6** options（汉族/回族/满族/蒙古族/藏族/维吾尔族）≪ `FLAT_SELECT_MAX_OPTIONS=24`, no search input → not `select_search_heavy`.
- Live `/my/jl`: if careers lists full ~56 民族 or enables showSearch, existing guard returns `select_search_heavy` and skips — **do not force**. Live pending login.

Shared helper (`selectControl` / `readSelect` / `fillSelect`) stays allowlist-only + cascader fail-closed + flat-select max-options/search-heavy skip (`select_search_heavy`). Never Save.

下一刀裁剪见 [`CITICS_ANT_SELECT_NEXT_TRIM_20261019.md`](CITICS_ANT_SELECT_NEXT_TRIM_20261019.md)（Never Save，不宣称中信已支持）。

学历须 live 采选项后才能接线，见 [`CITICS_EDUCATION_SELECT_DRAFT_20261019.md`](CITICS_EDUCATION_SELECT_DRAFT_20261019.md)。`--only 学历 --live` 拒 `live_education_options_unharvested`。不编造选项。
