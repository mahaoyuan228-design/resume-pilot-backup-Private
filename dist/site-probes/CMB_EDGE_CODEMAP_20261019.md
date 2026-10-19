# 招行第二切片拟码 → 工程码对照 · 2026-10-19

来源：CA `d6c021a` + Codex X。拟码不进引擎；对外/断言只用工程码。Never Save。未宣称已支持。

| 拟码 | 工程处理／码 | 场景 |
| --- | --- | --- |
| VALUE_EMPTY | （无错误码）省略 | plan：空/空白不生成该字段计划项 |
| VALUE_EMPTY | `invalid_profile_value` | 直接 fill 空串 |
| NUMBER / UNIT | `invalid_profile_value` | plan：含单位/非数字等 |
| NUMBER / UNIT | `invalid_height` / `invalid_weight` | fillBasic 显式身高/体重 |
| OPTION | `invalid_profile_value` | plan 或直接 radio 未映射 |
| OPTION | `invalid_gender` / `invalid_formal_work` | fillBasic 显式 |
| RADIO_AMBIGUOUS | `radio_structure_changed` | 允许标签结构非恰好一对 |
| RADIO_AMBIGUOUS | `radio_readback_ambiguous` | 多于一个 radio 勾选 |

小数匹配 `/^\d+(?:\.\d+)?$/` 仍视为有效数值。RankingMajor 仍 `DOM_CONTROL_MISSING`。
