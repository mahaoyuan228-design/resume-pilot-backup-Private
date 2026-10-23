# 中信学历 Ant Select · 离线草稿（2026-10-19）

Never Save。**不宣称中信已支持/可填。**

**须 live 采选项后才能接线。**

## 仓内有什么

字段图 `citics-field-map-20261018.md` 在「其它必填抽样」里有标签「学历/学位」。同一份 JSON 的 `otherRequiredLabelSample` 也只有这个标签。没有选项全文，没有 select id，没有下拉 DOM。

`src/content/citics-basic.js` 的 `SELECT_SPECS` 没有学历。已接线的是个人信息里的婚姻状况、政治面貌、户口类型、证件类型、民族。教育经历分区不在那些刀里。

裁剪笔记 `CITICS_ANT_SELECT_NEXT_TRIM_20261019.md` 要求学历首次 live 采选项，禁止通用枚举硬填。招行 Education 的中文名和 code 不是中信选项，不搬。

## 现在怎么拒

`node scripts/auto-citics-basic.mjs --only 学历`、`--only 学历 --live`、`--only 学历/学位` 在打开浏览器之前退出 3。原因 `live_education_options_unharvested`。`writeAttempted` 为 false。不写假选项，不编 DOM。

`--only 学位` 同样在浏览器、CDP 和证据写盘之前退出 3，原因 `live_degree_options_unharvested`。默认、`--live`、`--synthetic` 模式均保持阻塞。所有学历/学位拒绝结果显式标记 `liveSupportClaimed: false`、`neverSave: true`，保存、提交、下一步、投递、删除标记均为 false。

离线纯函数护栏不接线填写：单段教育也必须提供独立的合成选项，不能从待填值自行生成选项。非字符串、未知值、跨学历/学位和重复选项停填；多段教育即使提供“最高学历”或“最近经历”规则仍停填。真实选项与行 DOM 仍待采集。

## 采到以后才做

选项全文和本页定位器都采到之后，才能做离线合成。最小回归仍是：唯一匹配成功；无匹配或歧义跳过；不串写民族；不覆盖已有值。定位器须在中信页另验，不复用招行 id。

个人信息里的政治面貌已经在 allowlist，这刀不重做。英语同样没有 live 选项，这刀不做。
