草稿建议：**保留十个原 `liveReason`，将无条件拒绝改为逐字段证据门禁；只有证据和当前控件均核验通过，才允许单字段 fill-wo-save。**

已对照分支 `cursor/expand-night-ats-f861` 的快照 `80cca97`。该版已有 `LIVE_SELECT_EVIDENCE`、`readLiveSelectClaim()` 和 live 分流，但[十个证据 JSON 仍是 `stub:true`](https://github.com/mahaoyuan228-design/resume-pilot-backup-Private/blob/80cca97a9b55a95932187a1249d302e7d5f1063b/dist/site-probes/CMB_LIVE_SELECT_CLICK_EVIDENCE_20261019.md)。以下按你给定的真实 live 点击证据已齐起草；这些占位文件须绑定原始记录，不能仅凭 `clickClaimed:true` 放行。

最小改动清单：

1. **补强证据检查**：[现有 `readLiveSelectClaim()`](https://github.com/mahaoyuan228-design/resume-pilot-backup-Private/blob/80cca97a9b55a95932187a1249d302e7d5f1063b/scripts/auto-cmb-basic.mjs#L251) 增加非 stub、站点、字段、页面及索引核验，并验证原始点击记录与对应 text↔code 映射。缺失、损坏或不匹配，继续返回该字段原 `liveReason`。
2. **收紧 live 入口**：仅 `--only <一个字段> --live` 进入；精确校验当前页面 origin/path 和唯一目标控件。目标值必须来自明确输入，不能沿用当前的 `spec.second.text` 合成测试值。
3. **使用真实点击流程**：替换 live 路径对合成适配器的复用。[`applyCodedSelect()`](https://github.com/mahaoyuan228-design/resume-pilot-backup-Private/blob/80cca97a9b55a95932187a1249d302e7d5f1063b/src/content/cmb-basic.js#L608) 会直接改 `textContent`、`data-code`、`aria-selected`，不能作为 live 成功证据。live 应沿已证明的菜单归属点击，再从真实选中态回读。
4. **成功与失败分别记录**：只有本次选后回读一致才置 `liveSelectFillClaimed:true`；证据通过但控件、选项或回读失败，保留具体失败原因。[当前 catch](https://github.com/mahaoyuan228-design/resume-pilot-backup-Private/blob/80cca97a9b55a95932187a1249d302e7d5f1063b/scripts/auto-cmb-basic.mjs#L1267) 不应把所有异常归为 CDP 不可用，也不应在已注入后声称“未注入”。
5. **调整门禁回归**：覆盖无证据、stub、错字段/索引、民族搜索形态变化、回读失败和真实证据通过。不能把“退出码不等于 3”当作填写成功。

下表证据文件统一位于 `dist/auto-runs/`。**共同条件 G**：真实证据有效且字段身份一致；当前控件唯一、可用；菜单归属明确；目标 text↔code 精确匹配；只点击目标选项；选后真实回读一致。证据无效时沿用原 `liveReason`，运行时核验失败则报告具体原因并停止。

| 字段 | 证据文件 | 放行条件 | 仍 fail-closed 的情形 |
|---|---|---|---|
| 婚姻状况 | `cmb-live-select-marital-latest.json` | G；ID=`resume_basicInfo_maritalStatus` | 空值、占位项、未知或模糊选项 |
| 政治面貌 | `cmb-live-select-politics-latest.json` | G；ID=`resume_basicInfo_politicalAffinity`；限定本人基本信息 | “党员”等简称未精确匹配；误命中家庭同名字段 |
| 民族 | `cmb-live-select-ethnicity-latest.json` | G；ID=`resume_basicInfo_nation`；核对 **show-search**，沿已证明路径选择 | 把搜索输入当选中值；“汉”代替“汉族”；目标未加载或菜单归属不明 |
| 证件类型 | `cmb-live-select-idCardType-latest.json` | G；ID=`resume_basicInfo_idCardType` | 混淆证件类型与证件号；目标未精确匹配 |
| 学历 | `cmb-live-select-educationLevel-latest.json` | G；ID=`resume_educationHistoryList_0_educationLevelCode`；限定第 0 行；保留 live 的博士后 `ED000` | “研究生”等模糊值；其他行；用离线窄集排除真实 live 选项 |
| 招聘信息来源 | `cmb-live-select-channelType-latest.json` | G；ID=`resume_basicInfo_channelType`；原文及 code 精确匹配 | 将“微信／官网／智联”等简称自动归并；丢失原文引号 |
| 面试期望城市 | `cmb-live-select-interviewCity-latest.json` | G；ID=`resume_basicInfo_expectedInterviewCity`；完整城市名匹配 | “北京”自动映射“北京市”；目标不在已采映射中 |
| 获奖级别 | `cmb-live-select-awardLevel-latest.json` | G；ID=`resume_awardList_0_awardLevel`；限定第 0 行 | 从奖项名称推断级别；写入其他获奖行 |
| 关系类型 | `cmb-live-select-relationship-latest.json` | G；ID=`resume_familyList_0_relationship`；证据、目标和索引一致 | 仅凭“关系类型”标签选首个；串写 `_1_`；只有 row1 ID 没有 row1 点击证据却放行 |
| 最高英语水平 | `cmb-live-select-englishLevel-latest.json` | G；ID=`resume_skill_0_englishLevel`；精确等级及 code | 将“托福／四级”或分数自动换算；写入英语分数或其他行 |

`RankingMajor` 继续保持 **`DOM_CONTROL_MISSING`**：不猜 selector，不进入本次放行表。

全程 **Never Save**：不触发保存、提交、投递或表单提交；`saved:false` 不能代替动作约束。`formFillClaimed:false`，不宣称招行已支持。此次仅完成只读核对与草稿，未修改源码、未生成补丁、未执行 live 填写；`cms/gth` 不改。