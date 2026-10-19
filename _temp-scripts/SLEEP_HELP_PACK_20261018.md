# 睡前协助清单 2026-10-18（下一会话用）

## 1. 今晚已完成（DONE，勿再问）

1. **Live PASS**：中信 marital+political（Ant Select）；中联 mc 文本三字段 + 证件号码探活 + **性别**/**证件类型** select（fill-wo-save+restore）；国籍/地区 skip。EXT `hhembhoojafdefnkonmgoejfedgloanc`。验收仍 **85%**。
2. **Offline synthetic**：CITICS **户口类型** + **证件类型** + **民族**（`FLAT_SELECT_MAX_OPTIONS` harden；民族 live 若全量≈56/可搜 → fail-closed）。PR #3 draft 累积中。
3. **ATS fixtures** + Extra fingerprints（docs only；无 live）。
4. **Shell class 11/11 complete**（verify-list）+ 南粤/Celebright/国盛键：`run-hotjob-tenant.cmd` 覆盖全部壳键。见 `HOTJOB_SHELL_CLASS_INDEX_20261018.md` · NEXT §1.7。
5. **Non-hotjob fingerprint 批 done** + 小米 mioffice = 飞书 ATSX 孪生；`feishu-atsx` host 已接线 `*.jobs.f.mioffice.cn`（仍 login-gated；无 live claim）。
6. **Plateau**：公开壳刀 + non-hotjob fingerprint 已收敛；再 expand 需 Jeremy 登录后 live / ATS DOM。

7. **Live PASS（2026-10-19 ~09:00 Asia/Shanghai）**：广东南粤银行 `SU670a…` pb `resumeOperation` — CMS_BASIC **MODE=fill Never Save**；`personalVerified=8` `failed=0`（姓名+移动电话 readback；出生日期/证件号码/电子邮箱/性别/民族/证件类型 preexisting_same）。EXT `hhembhoojafdefnkonmgoejfedgloanc`；Trial Edge CDP **9237**；证据 `dist/auto-runs/hotjob-tenant-670a29-cms-basic-20261019-090052.json`。剩余 skip（非 blocker）：question_scope_mismatch 国籍/婚姻/毕业院校；ambiguous 政治面貌；region；教育专业 mapping。验收仍 **85%**。勿对外写南粤客户可填。

## 2. 仍需 Jeremy 有空时（TODO，均可选）

1. **可选登录**（主阻塞）：**Celebright** → 国盛 / **caict** / **opple**（+ 备选 longi/haitian/tsmc/tclmj/horizon/yls/haguo/yunigu）→ 登录后停在猜壳页 → **一键** `scripts\run-hotjob-tenant.cmd <key>`（壳键已齐；Never Save）。**南粤已 live PASS**（见 §1.7）。
2. **可选 ATS DOM**：广发飞书 / **小米 ATSX** `https://xiaomi.jobs.f.mioffice.cn/newretailing/?spread=M1SXHJC`（登录后停在简历编辑页即可；host 已接线；Never Save） / 君乐宝北森 / TI(Moka) → 采真实 DOM 后再 fill-wo-save；同族备选：中科创达飞书 / 乐牛·正泰 Moka / 现代牧业·北芯北森。
3. **可选中信 live**：`careers.citics.com/my/jl` 上户口类型 + 证件类型 + 民族（synthetic 已绿；民族若全量/可搜则 skip）。
4. **可选**：付费 Edge **9239**；Codex Cloud 环境发布。
5. **付费 Edge 9239 预客户 QA（Codex F 裁剪·2026-10-19）**：授权有效 + CDP=9239；CMS+GTH Never Save 试填读回；与试填 9237 结果隔离；失败记环境契约；不碰私钥。详 `dist/site-probes/PAID_EDGE_9239_QA_CHECKLIST_20261019.md`（Codex N 裁剪）。
6. **招行 live Select（2026-10-19 已做）**：试填 9237 上 10 字段点击证据已齐；仍 **未宣称招行已支持**。详见 `CMB_LIVE_SELECT_CLICK_EVIDENCE_20261019.md`。
7. **中信 `/my/jl` 学历采选项（离线包已备·2026-10-19）**：登录 careers.citics.com → 打开 `/my/jl`；按 `dist/site-probes/CITICS_EDUCATION_HARVEST_PACK_20261019.md` 仅展开学历 Ant Select、滚虚拟列表、dump text+value；学位另轮；Never Save；不宣称支持。当前 `live_education_options_unharvested`。

8. **飞书/小米 ATSX 登录后 DOM（离线包已备·2026-10-19）**：登录后停简历编辑页；按 `dist/site-probes/FEISHU_ATSX_LIVE_DOM_HARVEST_PACK_20261019.md` 一次一变量采姓名→手机→邮箱；Never Save；不宣称支持。

9. **北森 Beisen-2022 登录后 DOM（离线包已备·2026-10-19）**：登录后停简历编辑；按 `BEISEN_2022_LIVE_DOM_HARVEST_PACK_20261019.md` 采姓名→手机→邮箱；Never Save；排除 legacy CmsPortal。

10. **Moka/TI 登录后 DOM（离线包已备·2026-10-19）**：登录后停简历编辑；按 `MOKA_LIVE_DOM_HARVEST_PACK_20261019.md` 采姓名→手机→邮箱；Never Save；不升格 hashed sd-*。

11. **中信下一 live（户口/证件/民族·2026-10-19）**：学历仍阻塞；优先按 `CITICS_NEXT_LIVE_PRIORITY_20261019.md` 采三项证据；Never Save。

12. **Celebright/国盛一键试填准备包（2026-10-19）**：登录后停简历编辑；按 `dist/site-probes/HOTJOB_CELEBRIGHT_TRIAL_PACK_20261019.md`；键名先核对；Never Save；南粤 PASS 不代替。

13. **GTH/CMS 回归冒烟（离线清单已备·2026-10-19）**：有空时按 `dist/site-probes/GTH_REGRESSION_SMOKE_CHECKLIST_20261019.md` 分入口（9237/9239）并列复测 CMS+GTH；Never Save；不替代 `PAID_EDGE_9239_QA_CHECKLIST`；不宣称已支持。
