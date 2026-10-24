# Codex AB draft

https://chatgpt.com/local/01a1533b-7b8d-76a7-b6dc-f580ab5d20df

GPT-6.1 Sol Extra High

env: resume-pilot-backup-Private

付费 Edge 9239｜仅 CMS+GTH 客户前 QA **草稿**。未取得 `GTH_REGRESSION_SMOKE`、`GTH_VS_PAID_QA_CROSSWALK` 原文，以下待对照；未执行、未验收。登录态步骤均依赖 **Jeremy 登录**；`E/` 为拟定证据路径，Never Save 精确定义待原文核对。

| 步骤 | 预期（待验证） | 证据路径（占位） | Never Save |
| --- | --- | --- | --- |
| 1. 核对 Edge 9239、测试版本及 Jeremy 登录态 | 环境可辨认；未登录则记阻塞 | `E/01-environment.txt` | 不记录凭据、令牌；不触碰私钥 |
| 2. CMS 使用合成简历走快填 | 字段与样本一致；停在提交前 | `E/02-cms.png` | 检查填写是否触发保存 |
| 3. GTH 使用同一合成简历走快填 | 字段与样本一致；停在提交前 | `E/03-gth.png` | 检查填写是否触发保存 |
| 4. 两站检查空值、缺字段及人工已有值 | 跳过、覆盖规则逐项待材料确认 | `E/04-field-diff.csv` | 证据仅记字段名与差异 |
| 5. 两站刷新、切页后重复触发 | 无重复填入或跨页误填 | `E/05-repeat.txt` | 检查是否意外恢复输入 |
| 6. 按 SMOKE 逐项复跑，并对照 CROSSWALK | 每项关联实际结果；缺证据记待测 | `E/06-crosswalk.csv` | 不留表单原值 |
| 7. 两站触发 Never Save，退出后重开检查 | 指定对象不被持久保存；对象范围待确认 | `E/07-never-save.txt` | 核对保存入口及持久化结果 |
| 8. 检查会话失效、字段不可识别等失败分支 | 明确记失败或阻塞，不判通过 | `E/08-blockers.txt` | 错误证据不含敏感输入 |
