# 招行第二切片 · 码表离线回归清单 · 2026-10-19

对照 `CMB_EDGE_CODEMAP_20261019.md`；测文件 `tests/cmb-slice2-edges.test.mjs`（d6c021a）。Never Save。未改引擎。

| # | 用例类 | 期望工程码 / 行为 | 测侧重 |
| --- | --- | --- | --- |
| 1 | 四字段空/空白 · plan | 省略（无错误码） | empty omitted |
| 2 | 四字段直接 fill 空串 | `invalid_profile_value` | synthetic DOM edges |
| 3 | 身高/体重非数字或带单位 | `invalid_profile_value` | height/weight edges |
| 4 | 身高/体重非法 · fillBasic | `invalid_height` / `invalid_weight` | explicitHeight/Weight |
| 5 | 性别/正式工作未映射 · plan/radio | `invalid_profile_value` | gender/formalWork edges |
| 6 | 性别/正式工作未映射 · fillBasic | `invalid_gender` / `invalid_formal_work` | explicitGender/Formal |
| 7 | radio 标签非恰好一对 | `radio_structure_changed` | 结构变异 |
| 8 | radio 多项勾选 | `radio_readback_ambiguous` | 勾选/回读 |
| 9 | 合法小数 | 无 blocker | decimal kept |
| 10 | 失败隔离 + Never Save | 邻字段不变；`saveClicks=0` | isolate neighbors |

不宣称已支持。RankingMajor / DOB 不在本清单。
