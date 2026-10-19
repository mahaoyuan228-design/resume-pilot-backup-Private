# 睡前协助清单 2026-10-18（下一会话用）

## 1. 今晚已完成（DONE，勿再问）

1. **Live PASS**：中信 marital+political（Ant Select）；中联 mc 文本三字段 + 证件号码探活 + **性别**/**证件类型** select（fill-wo-save+restore）；国籍/地区 skip。EXT `hhembhoojafdefnkonmgoejfedgloanc`。验收仍 **85%**。
2. **Offline synthetic**：CITICS **户口类型** + **证件类型** + **民族**（`FLAT_SELECT_MAX_OPTIONS` harden；民族 live 若全量≈56/可搜 → fail-closed）。PR #3 draft 累积中。
3. **ATS fixtures** + Extra fingerprints（docs only；无 live）。
4. **Shell class 11/11 complete**（verify-list）+ 南粤/Celebright/国盛键：`run-hotjob-tenant.cmd` 覆盖全部壳键。见 `HOTJOB_SHELL_CLASS_INDEX_20261018.md` · NEXT §1.7。
5. **Non-hotjob fingerprint 批 done** + 小米 mioffice = 飞书 ATSX 孪生；`feishu-atsx` host 已接线 `*.jobs.f.mioffice.cn`（仍 login-gated；无 live claim）。
6. **Plateau**：公开壳刀 + non-hotjob fingerprint 已收敛；再 expand 需 Jeremy 登录后 live / ATS DOM。
7. **2026-10-19 南粤 live PASS（partial）**：`SU670a291d6202cc7666c744bc` CMS basic，MODE=fill Never Save，`personalVerified=8` `failed=0`。**不是**全站。验收仍 **85%**。见 `dist/site-probes/HOTJOB_NANYUE_CMS_BASIC_LIVE_20261019.md` · `HOTJOB_NANYUE_REMAINING_SKIPS_20261019.md`。
8. **2026-10-19 招行**：体重 offline 已落地（同身高：`.ant-form-item` + `input.ant-input`；只写数字公斤；拒 `60kg`/`60KG`；`--live` 拒 `live_weight_text_unharvested`；套件 34/34；Never Save）。性别/身高/体重合成齐；下一刀需 live 的四字段：婚姻、政治面貌、民族、出生日期。未宣称已支持招行。验收仍 **85%**。对照草稿 `dist/site-probes/CMB_LIVE_GATED_FIELDS_DRAFT_20261019.md`：下一刀 live 采数顺序婚姻状况 → 政治面貌 → 民族 → 出生日期；不能离线合成选项。
9. **2026-10-19 招行 live gated**：四字段已采齐（`dist/site-probes/CMB_LIVE_GATED_HARVEST_20261019.md`，Never Save）。婚姻状况 / 政治面貌 / 民族已按采到的中文名+code 做离线合成 Select；出生日期只记 DatePicker kind+填法提示，未硬编假 DOM，未 live 填。未宣称已支持招行。验收仍 **85%**。
10. **2026-10-19 招行证件类型**：完整 dictmap 摘要 `dist/site-probes/CMB_DICTMAP_FULL_20261019.md`。gated 四字段已完成。IdCardType 15 项离线合成 Select。DOM 已采到 `#resume_basicInfo_idCardType`（无 show-search，`CMB_IDCARDTYPE_DOM_20261019.md`）。`--live` 仍拒 `live_id_card_type_select_fill_unclaimed`（live 点击未证明）。证件号 `#resume_basicInfo_idCard` 不填。未宣称已支持招行。验收仍 **85%**。
11. **2026-10-19 招行剩余 DOM + 学历**：`dist/site-probes/CMB_REMAINING_DOM_20261019.md`。Education 离线 Select 只接第 0 行，剔除 ED000；`--live` 拒 `live_education_level_select_fill_unclaimed`。下一刀：RelationshipType → AwardsLevel → EnglishLevel。InterviewCity / ChannelType 可延后。RankingMajor 当前页无控件。未宣称已支持招行。验收仍 **85%**。裁剪笔记 `dist/site-probes/CMB_DICT_REMAINING_TRIM_20261019.md`：顺序延到 ChannelType → InterviewCity；RankingMajor 记 `DOM_CONTROL_MISSING`。Education 不重做。
12. **2026-10-19 招行关系类型**：`_0_` 与 `_1_` 离线 Select 索引隔离。8 项 RT0001–RT0008。`--live` 拒 `live_relationship_select_fill_unclaimed`。姓名和电话不填。Never Save。未宣称已支持招行。下一刀 AwardsLevel。
13. **2026-10-19 招行获奖级别**：只接 `#resume_awardList_0_awardLevel`。5 项 AL002–AL006。不按奖项名推断。`--live` 拒 `live_award_level_select_fill_unclaimed`。Never Save。未宣称已支持招行。下一刀 EnglishLevel。
14. **2026-10-19 招行英语等级**：只接 `#resume_skill_0_englishLevel`。10 项 EL001–EL010，`其他` 保留。不换算托福/四级/分数。`--live` 拒 `live_english_level_select_fill_unclaimed`。Never Save。未宣称已支持招行。ChannelType / InterviewCity 可延后。
15. **2026-10-19 招行招聘信息来源**：只接 `#resume_basicInfo_channelType`。15 项原名原 code，不做模糊归并。`其他` 保留。`--live` 拒 `live_channel_type_select_fill_unclaimed`。Never Save。未宣称已支持招行。下一刀 InterviewCity。
16. **2026-10-19 招行面试期望城市**：只接 `#resume_basicInfo_expectedInterviewCity`。44 个完整城市名，首项北京市、末项重庆市。简称不匹配。`--live` 拒 `live_interview_city_select_fill_unclaimed`。Never Save。未宣称已支持招行。RankingMajor 仍是 `DOM_CONTROL_MISSING`。
17. **2026-10-19 招行 live 点击最小矩阵**（只文档）：全文 `dist/site-probes/CMB_LIVE_CLICK_MATRIX_20261019.md`。Never Save。一次一字段。试填 Edge CDP 9237。停在 `/center/resume`。未宣称已支持招行。整体进度口径由主脑报。
18. **2026-10-19 招行 live Select 10 字段已做**：实采表 `dist/site-probes/CMB_LIVE_SELECT_CLICK_EVIDENCE_20261019.md`。E 草稿过时，见 `CODEX_TRIM_CMB_LIVE_MATRIX_E_20261019.md`。`dist/auto-runs` 10 份 JSON 已换成试填 Edge 9237 真实证据，不是 stub。Never Save。仍未宣称已支持招行。

## 1b. 招行 live 点击验收最小矩阵（2026-10-19）

Never Save。一次一字段。试填 Edge CDP **9237**。停在 `https://career.cmbchina.com/center/resume`。未宣称招行已支持。整体进度口径由主脑报。本节不写验收百分比。点击证据 10/10 入库后，证据文件在时 `--live` 不再因下表退出 3。证据缺失时下表仍是 fallback。

| 顺序 | 字段 | 页面标签 | 当前 `--live` refuse |
| --- | --- | --- | --- |
| 1 | 婚姻 | 婚姻状况 | `live_marital_select_fill_unclaimed` |
| 2 | 政治 | 政治面貌 | `live_politics_select_fill_unclaimed` |
| 3 | 民族 | 民族 | `live_ethnicity_select_fill_unclaimed` |
| 4 | 证件 | 证件类型 | `live_id_card_type_select_fill_unclaimed` |
| 5 | 学历 | 学历 | `live_education_level_select_fill_unclaimed` |
| 6 | 关系 | 关系类型 | `live_relationship_select_fill_unclaimed` |
| 7 | 获奖 | 获奖级别 | `live_award_level_select_fill_unclaimed` |
| 8 | 英语 | 最高英语水平 | `live_english_level_select_fill_unclaimed` |
| 9 | 渠道 | 招聘信息来源 | `live_channel_type_select_fill_unclaimed` |
| 10 | 面试城市 | 面试期望城市 | `live_interview_city_select_fill_unclaimed` |

RankingMajor：`DOM_CONTROL_MISSING`。不做，不猜 selector。关系两行分开读回，不互写。不填证件号、学校名称、家庭姓名和电话、奖项名称、获奖时间、英语分数。不点保存。

需要 Jeremy 时：登录保持。允许助手在试填 Edge（CDP 9237）做 fill-wo-save 点击读回（不点保存）。页面停在 `/center/resume`。一次一字段。

## 2. 仍需 Jeremy 有空时（TODO，均可选）

1. **可选登录**（主阻塞）：Celebright / 国盛 / **caict** / **opple**（+ 备选 longi/haitian/tsmc/tclmj/horizon/yls/haguo/yunigu）→ 登录后停在猜壳页 → **一键** `scripts\run-hotjob-tenant.cmd <key>`（壳键已齐；Never Save）。南粤 basic 已有 2026-10-19 partial live（verified=8）；剩余跳过见 `HOTJOB_NANYUE_REMAINING_SKIPS_20261019.md`，不要当成全站已支持。
2. **可选 ATS DOM**：广发飞书 / **小米 ATSX** `https://xiaomi.jobs.f.mioffice.cn/newretailing/?spread=M1SXHJC`（登录后停在简历编辑页即可；host 已接线；Never Save） / 君乐宝北森 / TI(Moka) → 采真实 DOM 后再 fill-wo-save；同族备选：中科创达飞书 / 乐牛·正泰 Moka / 现代牧业·北芯北森。
3. **可选中信 live**：`careers.citics.com/my/jl` 上户口类型 + 证件类型 + 民族（synthetic 已绿；民族若全量/可搜则 skip）。
4. **付费 Edge 9239 QA**（见 `dist/site-probes/CODEX_TRIM_PAID_EDGE_QA_F_20261019.md`）：只用授权版 9239，不用试用 9237 代替。Cookie 不互通。当时 CMS/GTH 未登录，8 段 fill 停在 `blocked_login`。需要时在 9239 登录招商 `resumeOperation.html` 与国泰 `https://hr.gtht.com/resume/edit/`，再 MODE=fill，不点保存。Codex Cloud 环境发布仍可选。
5. **招行 live 10 字段已做**（试填 9237，停在 `/center/resume`，不点保存）。仍未宣称已支持。不要重做这 10 个点击。RankingMajor 仍是 `DOM_CONTROL_MISSING`，不做。这不是 9239 付费 QA。
