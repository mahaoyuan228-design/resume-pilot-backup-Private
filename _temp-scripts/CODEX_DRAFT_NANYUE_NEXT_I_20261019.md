裁剪草稿：现有“1–6 无免登录引擎补丁”结论不变。离线仅准备规则契约、门禁和合成用例；完成≠已支持。以下失败码均为建议。

### ① 离线下一刀表

| 优先级／字段 | 为何可离线、可交付什么 | 建议失败码／门禁 | 与 HOTJOB_NANYUE 隔离点 |
|---|---|---|---|
| 1 国籍 | 起草**单条 customScopedAnswer** 契约与合成用例；缺真实值时保留空缺 | `fact_missing`／`scope_unverified`；事实、题域未确认则拒绝作答 | 仅绑定 CMS_BASIC 国籍题域，不复用 HOTJOB 规则 |
| 2 地区（备选） | 离线定义国家、省、市等层级校验；不与国籍同时扩刀 | `region_level_mismatch`；层级不明则 skip | 单独命名空间，不继承 HOTJOB 地区值映射 |
| 3 婚姻 | 为现有 scope mismatch 起草拒绝用例 | `question_scope_mismatch`；不允许跨题域回退 | 不引入 HOTJOB 字段别名兜底 |
| 4 毕业院校 | 定义教育记录绑定及错绑拒绝用例 | `education_record_ambiguous`；记录不唯一则 skip | 不复用 HOTJOB 教育记录匹配规则 |
| 5 教育专业 | 定义精确映射契约及未知值用例；不补猜测映射 | `mapping_unverified`；无已核实映射则 skip | CMS_BASIC 映射独立，不共用 HOTJOB 词典 |

### ② 需 Jeremy 表

| 项目 | 需要什么 |
|---|---|
| 政治面貌 | Jeremy 提供唯一事实；不得从简历其他信息推断 |
| 上述字段实际适配与验收 | Jeremy 登录后取得真实题域、选项及必要 DOM 证据，再做 Never Save 验证；离线契约不能替代 live PASS |

### ③ 不要做

- 不改 `cms/gth` 核心，不写完整扩展替装或补丁代码文件。
- 不编造 DOM、选项、个人事实或专业映射。
- 不把国籍、地区、籍贯、户籍互相代填。
- 不扩大到 HOTJOB_NANYUE，不跨站共享兜底规则。
- 不保存、不提交；不把草稿、合成测试或局部 PASS 宣称为“已支持”。