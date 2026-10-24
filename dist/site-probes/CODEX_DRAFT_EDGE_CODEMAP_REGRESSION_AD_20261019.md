# Codex AD draft

https://chatgpt.com/local/01a15342-db11-7306-81d7-24e497af90c8

GPT-6.1 Sol Extra High

env: resume-pilot-backup-Private

可裁剪草稿（据 [CMB_EDGE_CODEMAP](https://github.com/mahaoyuan228-design/resume-pilot-backup-Private/blob/bb8cd29437051b02a5f086c9d2fb2f64f55f61b9/dist/site-probes/CMB_EDGE_CODEMAP_20261019.md)；测文件统一为 `tests/cmb-slice2-edges.test.mjs`；未执行回归、未改引擎）。

- 四字段空/空白，plan → 无错误码、省略该计划项 → `empty omitted`。
- 四字段直接 fill 空串 → `invalid_profile_value` → `synthetic DOM edges`。
- 身高/体重非数字或带单位，plan/直接 fill → `invalid_profile_value` → `height/weight edges`、合成 DOM。
- 身高/体重非法值，显式 fillBasic → `invalid_height` / `invalid_weight` → `explicitHeight/explicitWeight`。
- 性别/正式工作未映射选项，plan/直接 radio fill → `invalid_profile_value` → `gender/formalWork edges`。
- 性别/正式工作未映射，显式 fillBasic → `invalid_gender` / `invalid_formal_work` → `explicitGender/explicitFormal`。
- 两类 radio 标签非恰好一对 → `radio_structure_changed` → 合成 DOM 结构变异断言。
- 两类 radio 多项勾选 → `radio_readback_ambiguous` → 合成 DOM 勾选/回读断言。
- 合法小数、失败隔离 → 小数无 blocker；失败码沿用上述，各例验邻字段不变、Never Save → `decimal kept`、`isolate neighbors`、`saveClicks=0`。
