# 夜间状态板 · 2026-10-18（Asia/Shanghai）· wrap

验收仍 **85%**；对外可卖仅 **招商 CMS + 国泰 GTH**。Never Save。扩站 live 只记叙事，**不抬**窄版 %。

## 1. 今晚 live PASS
- **中信** Ant Select：婚姻状况 + 政治面貌（liveEdge；证据 `/workspace/evidence/citics-ant-select-*-latest.json`）。勿用 dist latest 单独宣称 live。对外仍不可写「已支持中信」。
- **中联** hotjob-mc（未点下一步）：
  - 文本：姓名 / 移动电话 / 电子邮箱（+ 证件号码探活）fill-wo-save + restore
  - **性别**、**证件类型** mc-select fill-wo-save + restore（`dist/auto-runs/hotjob-mc-select-*-latest.json`）
- **仍不宣称**：feishu / beisen / moka / 其它 ATS 客户可填；窄版可卖仍仅 CMS+GTH。

## 2. 离线刀（待登录采 DOM；未宣称 live）
- feishu-atsx（广发）· beisen-2022（君乐宝）· moka（TI）已 wiring
- 中信 **户口类型** Ant Select：仅 synthetic PASS（`citics-ant-select-户口类型-latest.json`）；**live 未做**
- 中信 **证件类型** Ant Select：仅 synthetic PASS（`citics-ant-select-证件类型-latest.json`；身份证↔中国护照）；**live 未做**；flat-select max-options harden 已入 `fillSelect`

## 3. 明确拒绝 / skip
- 中联 **国籍/地区**：search-heavy（~199 选项）→ skip fill
- 中信级联：籍贯 / 现户口所在地 / 生源地 → 拒；国籍（search 嫌疑）拒；民族未开刀（证件类型已移入 allowlist synthetic）

## 4. 卡在 Jeremy（均可选）
- 付费 QA 9239：CMS/GTH 未登录 → fill blocked
- 登录采 DOM：广发飞书 / 君乐宝北森 / TI Moka
- 南粤 / Celebright / 国盛：pb 概率高 → CMS_BASIC 租户 live
- 生产 HTTPS / 支付 / 钥（约 15%）：见 `LICENSE_JEREMY_CHECKLIST.md`；不勾不抬 %

## 5. 试用扩展 / PR
- Trial EXT id：`hhembhoojafdefnkonmgoejfedgloanc`
- PR #3：https://github.com/mahaoyuan228-design/resume-pilot-backup-Private/pull/3

## 6. 验收 %
- **85%**（不变）。详见 `_temp-scripts/ACCEPTANCE_DELTA_20261018.md`

证据：`EXPAND_PROGRESS.md` · hotjob-mc-select 性别/证件类型 · evidence/citics-ant-select · `FINAL_ACCEPTANCE_CHECKLIST.md`
