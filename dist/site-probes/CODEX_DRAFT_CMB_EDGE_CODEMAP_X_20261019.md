# Codex X draft

https://chatgpt.com/local/01a1532e-ec96-70c3-80e6-7165651de0fc

GPT-6.1 Sol Extra High

| 拟码 | 工程处理／码 | 场景草稿（plan vs fillBasic，供主脑核对） |
| --- | --- | --- |
| VALUE_EMPTY | 省略（无错误码） | plan：空值不生成计划项 |
| VALUE_EMPTY | invalid_profile_value | 空值按无效值处理；材料未明确 plan / fillBasic 归属及与省略的分界 |
| NUMBER | invalid_profile_value | plan：数值无效 |
| NUMBER | invalid_height | fillBasic：身高数值无效 |
| NUMBER | invalid_weight | fillBasic：体重数值无效 |
| UNIT | invalid_profile_value | plan：单位无效 |
| UNIT | invalid_height | fillBasic：身高单位无效 |
| UNIT | invalid_weight | fillBasic：体重单位无效 |
| OPTION | invalid_profile_value | plan：选项值无效 |
| OPTION | invalid_gender | fillBasic：性别选项无效 |
| OPTION | invalid_formal_work | fillBasic：formal_work 选项无效 |
| RADIO_AMBIGUOUS | radio_structure_changed | fillBasic：单选结构变化 |
| RADIO_AMBIGUOUS | radio_readback_ambiguous | fillBasic：单选回读存在歧义 |
