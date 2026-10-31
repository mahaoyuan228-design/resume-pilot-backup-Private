# 招行出生日期 · datepicker_hint_only 下一刀 · 2026-10-19

现状：`datepicker_hint_only`。未宣称已支持。Never Save。失败码拟名待对齐。

## 离线
1. 合成 hint 用例：提示明确 / 缺失 / 冲突 / 只读日期框；只输出 hint，不点击不填值。拟：`DOB_HINT_MISSING` / `DOB_HINT_AMBIGUOUS`。
2. 动作边界回归：复用第二切片身高/体重/性别/正式工作合成基线；出生日期保持 hint-only；无日历操作、无写入、Never Save。

## 需 live（Jeremy）
3. 采控件形态：label、placeholder、type、readonly/disabled、日历入口、a11y 结构。未获：`DOB_CONTROL_UNOBSERVED`。
4. 采日期交互与格式：人工展开后记年月日层级、可选范围、确认方式、展示格式与校验文案；**不试填随机生日**。未获：`DOB_FORMAT_UNVERIFIED`。采集完成仍须单独评估，不能直接判定已支持。

## 不要做
5. 禁止自动点日历乱填；不猜生日；不保存/提交；不改 cms/gth；RankingMajor 仍 `DOM_CONTROL_MISSING`，不推定支持。
