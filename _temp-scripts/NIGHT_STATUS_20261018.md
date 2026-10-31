# 夜间状态板 · 2026-10-18（Asia/Shanghai）· wrap / plateau · **night close**

验收仍 **85%**；对外可卖仅 **招商 CMS + 国泰 GTH**。Never Save。扩站 live 只记叙事，**不抬**窄版 %。无新适配器；无 Edge；无 live 新宣称。

## 1. 今晚 live PASS（已发生；勿重跑求证）
- **中信** Ant Select：婚姻状况 + 政治面貌（liveEdge）。对外仍不可写「已支持中信」。
- **中联** hotjob-mc（未点下一步）：文本姓名/电话/邮箱 + 证件号码探活；**性别**、**证件类型** mc-select fill-wo-save+restore；国籍/地区 skip。
- Trial EXT：`hhembhoojafdefnkonmgoejfedgloanc`。

## 2. 离线刀（synthetic / fixture；未宣称 live）
- **招行 2026-10-19**：体重 offline 已落地（同身高：`.ant-form-item` + `input.ant-input`；只写数字公斤；拒 `60kg`/`60KG`；`--live` 拒 `live_weight_text_unharvested`；套件 34/34；Never Save）。性别/身高/体重合成齐；下一刀需 live 的四字段：婚姻、政治面貌、民族、出生日期。未宣称已支持招行。验收仍 **85%**。
- CITICS **户口类型** + **证件类型** + **民族** synthetic PASS；`FLAT_SELECT_MAX_OPTIONS` harden。**Live 未做**（民族 live 若全量≈56/可搜 → `select_search_heavy` fail-closed）。
- PR #3 draft 累积中。https://github.com/mahaoyuan228-design/resume-pilot-backup-Private/pull/3
- ATS fixtures + Extra fingerprints（docs only；无 live）。Family docs 已归档。

## 3. Shell class — verify-list **11/11 complete** + 飞书扩站键
- Verify 11/11 键 ready：zhonglian(mc live) · longi · opple · haitian · caict · tsmc · tclmj/tcl · yls · haguo · horizon · yunigu。
- 另键：nanyue / celebright / guosheng（主猜 pb）。**除中联 earlier 外无 live**。
- 索引：`dist/site-probes/HOTJOB_SHELL_CLASS_INDEX_20261018.md` · NEXT §1.7。

## 4. Plateau / next offline
- **Non-hotjob 公开 fingerprint 批已完成**（2026-10-18 22:05 CST）：`NON_HOTJOB_FINGERPRINT_20261018.md` + `.json` + raw `_raw-nonhotjob-20261018/`。
  - **高杠杆**：小米 `*.jobs.f.mioffice.cn` = **飞书 ATSX saas-career 孪生**（同 `pc.4481de59.js`）→ reuse `feishu-atsx` 候选（登录后；旁路 hotjob 队列）。
  - 其余（华为/快手/PDD/TME/网易/兴业/民生）= 自建 new-adapter / login-gated。
- **Done offline**: `feishu-atsx` host matcher + manifest now include `*.jobs.f.mioffice.cn` (Xiaomi twin); still login-gated; no live claim; acceptance unchanged 85%.
- **mioffice twin scan** (2026-10-18 ~22:23 CST): only Xiaomi in current scrape; twin note `FEISHU_ATSX_MIOFFICE_TWINS_20261018.md`; host wired + twin scan done; acceptance **85%**.
- 进一步 expand：**可选登录** → 一键 `run-hotjob-tenant.cmd <key>`（壳键已齐）；**或** 小米/广发 ATSX 登录后 DOM（需 Jeremy）。
- 本夜公开 HTTP / shell-class / non-hotjob fingerprint 已收敛；CITICS **民族** Ant Select offline knife 已合；**无新适配器、不开 Edge 扩 live**。
- **验收仍 85%**；**可卖仍 CMS+GTH**；live 仍需 Jeremy 登录。

## 5. 明确拒绝 / skip
- 中联国籍/地区；中信级联籍贯/现户口所在地/生源地；国籍 search；民族 synthetic 已开（live pending）。
- duomian / Redsea / wjx：scrape 无具体 URL，本批 skip。

## 6. 卡在 Jeremy（均可选）
- 登录：南粤 / Celebright / 国盛 / caict / opple（+ 备选 longi/haitian/tsmc/…）
- ATS DOM：广发飞书 / **小米 mioffice ATSX** / 君乐宝 / TI(Moka)；中信 `/my/jl` 户口+证件+民族 live
- 付费 Edge 9239；Codex cloud；生产 HTTPS/支付/钥（约 15%）

## 7. 验收 %
- **85%**（不变）。`ACCEPTANCE_DELTA_20261018.md` · `FINAL_ACCEPTANCE_CHECKLIST.md`

## 8. Final night close · 2026-10-18 ~22:28 CST（Asia/Shanghai）

Honest board refresh; **no code adapters; no live claims; acceptance stays 85%**.

| Bucket | Status |
| --- | --- |
| **Done tonight (offline)** | hotjob shell-class **11/11**; non-hotjob fingerprints; Xiaomi `*.jobs.f.mioffice.cn` host wired into `feishu-atsx`; CITICS **民族** synthetic; PR #3 accumulating |
| **Live tonight** | **中信** partial（婚姻状况+政治面貌）+ **中联** mc only（文本+性别+证件类型；国籍/地区 skip） |
| **Sellable** | still **招商 CMS + 国泰 GTH** only |
| **Acceptance** | **85%**（unchanged；不抬窄版 %） |
| **Plateau** | further live needs Jeremy logins — see `_temp-scripts/SLEEP_HELP_PACK_20261018.md` §2（南粤/Celebright/国盛/caict/opple + 备选壳；广发/小米 ATSX / 君乐宝 / TI；中信 `/my/jl` 户口+证件+民族；付费 Edge 9239 / Codex cloud） |

证据：`EXPAND_PROGRESS.md` · hotjob-mc-select · citics synthetic · `HOTJOB_SHELL_CLASS_*` · INDEX · `NON_HOTJOB_FINGERPRINT_20261018.md` · `CITICS_ANT_SELECT_REFUSED_20261018.md` · `FEISHU_ATSX_MIOFFICE_TWINS_20261018.md`
