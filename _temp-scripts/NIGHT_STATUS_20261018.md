# 夜间状态板 · 2026-10-18（Asia/Shanghai）· wrap

验收仍 **85%**；对外可卖仅 **招商 CMS + 国泰 GTH**。Never Save。扩站 live 只记叙事，**不抬**窄版 %。无新适配器；无 Edge；无 live 新宣称。

## 1. 今晚 live PASS（已发生；勿重跑求证）
- **中信** Ant Select：婚姻状况 + 政治面貌（liveEdge；evidence 目录为准）。对外仍不可写「已支持中信」。
- **中联** hotjob-mc（未点下一步）：文本姓名/电话/邮箱 + 证件号码探活；**性别**、**证件类型** mc-select fill-wo-save+restore；**国籍/地区** search-heavy → skip。
- Trial EXT：`hhembhoojafdefnkonmgoejfedgloanc`。

## 2. 离线刀（synthetic / fixture；未宣称 live）
- CITICS **户口类型** + **证件类型**（idType）Ant Select：synthetic PASS；`FLAT_SELECT_MAX_OPTIONS` harden 入 `fillSelect`。**Live 未做**（需 `/my/jl`）。
- PR #3 draft：含上述 CITICS select 刀。https://github.com/mahaoyuan228-design/resume-pilot-backup-Private/pull/3
- ATS：feishu JS 包确认 `.atsx-form-*`；beisen/moka provisional 选择器保留（公开 JS 未命中表单类名）。wiring 在；**无 live**。
- ATS Extra reuse candidates（docs only）：现代牧业/北芯→beisen-2022；乐牛/正泰→moka；中科创达→feishu-atsx；hosts 已通配；**无行为变更、无 live**。

## 3. Shell class（公开 HTTP；无登录）
- 南粤 / Celebright / 国盛：双壳 200；主猜 **pb** → CMS_BASIC 键 ready。
- **信通院 caict=pb**、**欧普 opple=mc**：双壳 200；`run-hotjob-tenant.cmd` 键 ready。排在南粤队列后。**无 live**。

## 4. 明确拒绝 / skip
- 中联国籍/地区（~199 + search）；中信级联籍贯/现户口所在地/生源地；国籍 search 嫌疑；民族未开刀。

## 5. 卡在 Jeremy（均可选）
- 登录：南粤 / Celebright / 国盛 / caict / opple
- ATS DOM：广发飞书 / 君乐宝 / TI(Moka)
- 中信 `/my/jl`：户口类型 + 证件类型 live
- 付费 Edge 9239；Codex cloud publish；生产 HTTPS/支付/钥（约 15%）

## 6. 验收 %
- **85%**（不变）。详见 `_temp-scripts/ACCEPTANCE_DELTA_20261018.md` · `FINAL_ACCEPTANCE_CHECKLIST.md`

证据索引：`EXPAND_PROGRESS.md` · hotjob-mc-select 性别/证件类型 · citics-ant-select 户口/证件类型 synthetic · `HOTJOB_SHELL_CLASS_*`
