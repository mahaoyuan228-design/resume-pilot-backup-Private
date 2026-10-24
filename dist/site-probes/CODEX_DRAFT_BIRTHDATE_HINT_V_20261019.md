# Codex V draft

URL: https://chatgpt.com/local/01a15322-7852-729c-a712-6a5ed3f8c0eb
Model: GPT-6.1 Sol Extra High

招行出生日期现状：datepicker_hint_only。以下为可裁剪候选草稿，共 5 项；未实施，失败码均为拟名。

## 离线

| 下一可做 | 草稿范围 | 验收／拟名 |
| --- | --- | --- |
| 1. 可补合成 hint 用例 | 覆盖提示明确、提示缺失、提示冲突、只读日期框等候选场景；合成结构不作为真实控件证据 | 仅输出 hint，不点击、不填值；缺失拟名 DOB_HINT_MISSING，冲突拟名 DOB_HINT_AMBIGUOUS |
| 2. 补动作边界回归 | 复用第二切片身高、体重、性别、正式工作已有合成作为回归基线 | 出生日期保持 hint-only；验证无日历操作、无字段写入，并保持 Never Save |

## 需 live

| 下一可做 | 采集内容 | 未获证据时拟名 |
| --- | --- | --- |
| 3. 采出生日期控件形态 | 脱敏记录 label、placeholder、输入类型、readonly/disabled、日历入口及关联 DOM／可访问性结构 | DOB_CONTROL_UNOBSERVED |
| 4. 采日期交互与格式 | 人工展开后采年月日选择层级、可选范围、确认方式；记录已有日期展示格式与校验文案，不试填随机生日 | DOB_FORMAT_UNVERIFIED；采集完成仍需单独评估，不能直接判定已支持 |

## 不要做

| 禁止项 | 边界 |
| --- | --- |
| 5. 禁止自动点日历乱填及越界扩展 | 不猜生日、不自动选日、不保存或提交，遵守 Never Save；不改 cms/gth；RankingMajor 缺控件，保留待证，不据此推定支持；不输出完整插件代码，不宣称出生日期已支持 |
