# 扩站进度（EXPAND）

日期起点：2026-10-18（Asia/Shanghai）  
计划文件：`EXPAND_SITES_PLAN.md`  
探针产出：`dist/site-probes/`

**2026-10-18 晚（Asia/Shanghai）**：E4 公开指纹完成 — 字节=飞书 ATSX；美团/京东=自建 SPA；腾讯/阿里入口刷新确认；五家皆非 hotjob。详见 `dist/site-probes/probe-big5-public-20261018.md`。

图例：`[ ]` 未做 · `[~]` 进行中 · `[x]` 本阶段完成 · `-` 不适用

## 实验批次

| ID | 内容 | 状态 | 更新 |
| --- | --- | --- | --- |
| E0 | 授权版 Edge 上 CMS+GTH 不回退 | [ ] | 本任务未跑验收；勿与扩站指纹混淆 |
| E1 | 中信 + 招行站点指纹 | [x] | 2026-10-18：CDP 实页完成，见 `probe-20261018-summary.md` |
| E2 | 腾讯 + 阿里公开入口摸底 | [x] | 2026-10-18：公开页完成；**登录后简历编辑未探** |
| E3 | 抽样共用 ATS / hotjob 租户 | [x] | 2026-10-18 复用验证；**2026-10-19 南粤 CMS_BASIC fill Never Save verified=8** |
| E4 | 字节 + 美团 + 京东公开门户指纹（腾讯/阿里刷新） | [x] | 2026-10-18 晚：见 `probe-big5-public-20261018.md`；**登录后表单未探** |

## E1 明细

- [x] 中信 `careers.citics.com` 指纹（自建 Vue+Ant；非 hotjob；简历编辑页已开）
- [x] 招行 `career.cmbchina.com` 指纹（自建 SPA；非 CMS hotjob；简历页 + 登录页）
- [x] 中信字段图（CDP 只读）→ `dist/site-probes/citics-field-map-20261018.md`
- [x] 中信适配器设计（第一切片）→ `EXPAND_CITICS_ADAPTER_DESIGN.md`
- [x] 中信适配器第一切片脚手架 + CDP dry fill（fill-without-save；**未**宣称客户可填）
- [x] 中信 dry-fill **7/7 PASS**（TEST placeholders；证据 `dist/auto-runs/citics-basic-latest.json`）
- [~] 中信已接线真实 profile 字段（姓/名←fullName、证件←identityNumber、手机←phone、邮箱←email、性别←gender）；缺证/未确认 **fail-closed**；**await extension reload** 后方可实页再测
- [x] 中信 auto harness：`scripts/auto-citics-basic.mjs`（默认 MODE=fill）+ `src/auto/citics-basic-auto.*` + `CITICS_BASIC_AUTO`
- [~] 招行适配器开发（2026-10-19：设计+offline scaffold；未 live；未宣称可填）
- [ ] 任一新站「可填」客户文档收录

## E2 明细

- [x] 腾讯入口 URL + 自建判断（`join.qq.com` / `careers.tencent.com`）
- [x] 阿里入口 URL + 自建判断（`campus-talent.alibaba.com` / `talent.alibaba.com`）
- [ ] 腾讯登录后简历/投递表单指纹
- [ ] 阿里登录后申请表单指纹

## E3 明细

- [x] hotjob/wecruit 同壳租户清单（≥8）→ `dist/site-probes/hotjob-tenants-20261018.md`
- [x] 候选租户未登录路径验证 → `dist/site-probes/hotjob-tenant-verify-20261018.md`（11/11 reuse-CMS **yes**；登录后 fill 未做）
- [x] 下一实验计划（fill-wo-save + 脚本清单）→ `dist/site-probes/HOTJOB_TENANT_NEXT_EXPERIMENT.md`（首选中联 `SU661f…`；**未** live CDP）
- [x] 任一新 SU 白名单试填（fill-without-save）→ 中联 mc `hotjob-mc` 第一切片 live PASS（姓名/移动电话/电子邮箱；restore；Never Save）
- [x] **南粤** `SU670a…` pb CMS_BASIC **fill Never Save** live basic verified **8** failed=0（2026-10-19 ~09:00 Asia/Shanghai；姓名+移动电话 readback；证据 `dist/auto-runs/hotjob-tenant-670a29-cms-basic-20261019-090052.json`；验收仍 85%；勿对外写南粤可填）
- [x] 北森 / Moka / 飞书招聘抽样指纹 → `dist/site-probes/shared-ats-fingerprint-zhiye-moka-feishu-20261018.md`（4 zhiye + 1 moka + 1 feishu；皆非 hotjob）


## E4 明细

- [x] 字节 `jobs.bytedance.com` 公开指纹（**飞书 ATSX**；非 hotjob；简历需登录）
- [x] 美团 `zhaopin.meituan.com` 公开指纹（自建 React SPA；`campus.meituan.com`→同壳）
- [x] 京东 `campus.jd.com` 公开指纹（自建 umi/`public.wechat.resume`；社招 `zhaopin.jd.com` 另壳）
- [x] 腾讯 / 阿里公开入口刷新（与 E2 一致：自建 CDN / CPO）
- [ ] 字节/美团/京东 **登录后**简历或投递表单指纹
- [x] 飞书 ATSX 是否可复用到其它雇主（抽样）→ 广发 `gffunds.jobs.feishu.cn` = 同 ATSX saas-career（见 shared-ats 指纹）
- [x] 飞书 ATSX 第一切片脚手架（offline；`feishu-atsx`；见 `FEISHU_ATSX_NEXT.md`）

## 系统族看板

| 系统族 | 已指纹 | 开发中 | 可填（对外可写） |
| --- | --- | --- | --- |
| hotjob/wecruit（招商 CMS） | [x] + 11 候选租户（路径复用 yes） | [~] 待登录后试填 | [x] **仅**招商证券 CMS |
| 国泰自建 GTH | [x] | - | [x] 国泰海通 |
| 中信自建 | [x] 指纹+字段图+设计+第一切片+dry-fill PASS | [~] profile 接线已写；**await reload** 再实测 | [ ] **对外仍不可写** |
| 招行自建 | [x] 2026-10-18；刷新 2026-10-19（React+antd） | [~] offline scaffold | [ ] |
| 腾讯自建 | [x] 门户（E2+E4 刷新） | [ ] | [ ] |
| 阿里 CPO 自建 | [x] 门户（E2+E4 刷新） | [ ] | [ ] |
| 飞书招聘 ATSX（字节校招壳） | [x] 公开门户 2026-10-18 晚 | [~] 第一切片 offline scaffold | [ ] |
| 美团自建 zhaopin | [x] 公开门户 2026-10-18 晚 | [ ] | [ ] |
| 京东校招 campus.jd | [x] 公开门户 2026-10-18 晚 | [ ] | [ ] |
| 北森 / Moka / 其它飞书招聘租户 | [x] 公开抽样 2026-10-18 晚（zhiye×4 / moka×1 / feishu×1） | [ ] | [ ] |

## 本轮产出路径

| 文件 | 位置 |
| --- | --- |
| hotjob 租户候选 | `dist/site-probes/hotjob-tenants-20261018.md` (+ `.json`) |
| hotjob 复用验证 | `dist/site-probes/hotjob-tenant-verify-20261018.md` (+ `.json`) |
| hotjob 租户下一实验 | `dist/site-probes/HOTJOB_TENANT_NEXT_EXPERIMENT.md` |
| 中信字段图 | `dist/site-probes/citics-field-map-20261018.md` (+ `.json`) |
| 中信适配设计 | `EXPAND_CITICS_ADAPTER_DESIGN.md` |
| 中信内容脚本 | `src/content/citics-basic.js`（+ popup 分支 + manifest host） |
| 中信 profile 映射 | `src/content/citics-profile-map.mjs`（+ `tests/citics-profile-map.test.mjs`） |
| 中信 auto | `scripts/auto-citics-basic.mjs` · `src/auto/citics-basic-auto.*` · `src/background/citics-basic-auto.mjs` |
| 中信 dry-fill 读回 | `dist/auto-runs/citics-basic-*.json`（历史 TEST placeholders；实 profile 待 reload） |
| 本进度 | `EXPAND_PROGRESS.md` |

## 阻塞 / 待 Jeremy

- **试用扩展需手动 reload** 后，`CITICS_BASIC_AUTO` / 新 `citics-basic.js` 才会进 SW；此前 live retest 会报 `extension_reload_required` 或跑旧逻辑。
- 实 profile 再测前确认 options 里 `fullName` / `identityNumber` / `phone` / `email`（及可选 `gender`）已勾选确认。
- **hotjob 新租户 fill-wo-save**：需在试用 Edge(9237) 登录目标 SU 并停在 `resumeOperation.html`（首选中联）；见 `dist/site-probes/HOTJOB_TENANT_NEXT_EXPERIMENT.md`。

## 2026-10-18 晚 · 飞书 ATSX 第一切片脚手架（Asia/Shanghai）

- [x] `siteId=feishu-atsx` offline scaffold：`src/content/feishu-atsx-basic.js` + `feishu-atsx-profile-map.mjs`；字段仅 **姓名/手机号码/邮箱**（广发 schema）；harness `scripts/auto-feishu-atsx-basic.mjs`（MODE=readiness|fill，CDP_PORT=9237，永不 Save）；fixture+`tests/feishu-atsx-basic.test.mjs`；说明 `dist/site-probes/FEISHU_ATSX_NEXT.md`。**Live fill 未做**（登录墙）；勿对外写已支持。
- [ ] Live：Jeremy 登录广发 `gffunds.jobs.feishu.cn`（或字节 ATSX）简历编辑页 → 采真实 DOM 类名 → 再 fill-wo-save。

## 销售口径（勿改）

- 现在能卖：**招商 CMS + 国泰 GTH**；Windows+Edge；授权绑定。  
- **不要**说「大厂/大品牌大多能填」或「已支持中信/hotjob 其它公司」。  
- 扩站进度用本文件勾选，窄版验收 % 不因实验上调。

## 2026-10-18 晚 · Feishu scrape（Asia/Shanghai）

- [x] 飞书「2027届校招/实习②」公开可读 scrape → `dist/site-probes/feishu-2027-campus-scrape-20261018.md`（9755 行；优先列 **投递方式**）。
- [x] 新 hotjob 租户入队：南粤银行 `SU670a291d6202cc7666c744bc`、Celebright `SU6279c916bef57c3ac0d49671`、国盛 `gszq.hotjob.cn`；另 zhiye/mokahr/jobs.feishu.cn 批写入 `FEISHU_EXPAND_SOURCE.md` §8。
- [ ] 下一 live 实验仍：**中联重科** `SU661f…` **或** 上述新 SU — 待试用 Edge **9237** 就绪（fill-wo-save；见 `HOTJOB_TENANT_NEXT_EXPERIMENT.md`）。
- [x] 2026-10-18 19:19 CST：共用 ATS 公开指纹完成（北森 zhiye×4：新华=legacy CmsPortal；君乐宝/英威腾/金山云=portal-2022 同 chunk；Moka 德州仪器；飞书广发=ATSX）→ `dist/site-probes/shared-ats-fingerprint-zhiye-moka-feishu-20261018.md`；**皆不可** hotjob 复用。
- [x] 2026-10-18 19:19 CST：适配优先级建议 — hotjob live 不改序；其次飞书 ATSX（广发≈字节）；再次北森-2022 共享壳；然后 Moka；新华 legacy 殿后。
- [x] 2026-10-18 19:55 CST：hotjob 租户 harness 补口 — `auto-cms-basic.mjs` 支持 `CMS_PAGE`/`CMS_SU`（只收 `wecruit.hotjob.cn/SU*/pb/resumeOperation.html`，否则 exit 3）；SW `CMS_BASIC_AUTO` 接受 `cmsPage`（basic only，租户信任按 SU 作用域；照片/教育/实习仍钉招商）；证据带 `tenantSu` 并自动另存 `dist/auto-runs/hotjob-tenant-<6>-cms-basic-<stamp>.json`；新增 `scripts/run-hotjob-tenant.cmd`（readiness→fill-wo-save，永不 Save）；`tests/hotjob-tenant-cms-target.test.mjs` 12/12 + `cms-basic-auto` 10/10 绿。
- [ ] 租户 live 仍待 Jeremy 登录（9237）后跑 `scripts\run-hotjob-tenant.cmd zhonglian`；注意：画像 customFacts 绑招商 `sitePageUrl`，租户页预计 `question_scope_mismatch` 跳过多数 CMS 自定义题，仅通用字段可填 — 不放宽（数据作用域安全设计）。

## 2026-10-18 晚 · 北森 Beisen-2022 第一切片脚手架（Asia/Shanghai）

- [x] `siteId=beisen-2022` offline scaffold：`src/content/beisen-2022-basic.js` + `beisen-2022-profile-map.mjs`；字段仅 **姓名/手机号码/邮箱**（provisional DOM；样例君乐宝）；harness `scripts/auto-beisen-2022-basic.mjs`（MODE=readiness|fill，CDP_PORT=9237，永不 Save）；fixture+`tests/beisen-2022-basic.test.mjs`；说明 `dist/site-probes/BEISEN_2022_NEXT.md`；manifest `https://*.zhiye.com/*`。**Live fill 未做**（登录墙）；勿对外写已支持。
- [ ] Live：Jeremy 登录君乐宝 `junlebaoruye.zhiye.com`（或英威腾/金山云同壳）简历编辑页 → 采真实 DOM 类名 → 再 fill-wo-save。

## 2026-10-18 晚 · Moka 第一切片脚手架（Asia/Shanghai）

- [x] `siteId=moka` offline scaffold：`src/content/moka-basic.js` + `moka-profile-map.mjs`；字段仅 **姓名/手机号码/邮箱**（provisional DOM；样例德州仪器 TI `app.mokahr.com/campus-recruitment/ti/143986`）；harness `scripts/auto-moka-basic.mjs`（MODE=readiness|fill，CDP_PORT=9237，永不 Save）；fixture+`tests/moka-basic.test.mjs`；说明 `dist/site-probes/MOKA_NEXT.md`；manifest `https://*.mokahr.com/*`。**Live fill 未做**（登录墙）；勿对外写已支持。
- [ ] Live：Jeremy 登录德州仪器 `app.mokahr.com/campus-recruitment/ti/143986` 简历编辑页 → 采真实 DOM 类名 → 再 fill-wo-save。

## 2026-10-18 晚 · CITICS Ant Select 下一刀：政治面貌（offline/synthetic）

- [x] 政治面貌 Ant Design Vue 1 select：`SELECT_SPECS` allowlist（婚姻状况+政治面貌）；fixtures + `tests/citics-political-select.test.mjs`；synthetic fill-wo-save PASS（群众→共青团员→restore；`dist/auto-runs/citics-ant-select-政治面貌-latest.json` 仍为 synthetic）。**Live** 证据在 `/workspace/evidence/citics-ant-select-政治面貌-latest.json`（liveEdge=true+restore；同 婚姻状况）；dist latest 未覆盖 — 以 evidence 为准。勿对外写已支持。

- [x] 2026-10-18 19:56 CST：飞书/北森-2022/Moka 第一切片 **extension wired**（SW `FEISHU_ATSX_BASIC_AUTO` / `BEISEN_2022_BASIC_AUTO` / `MOKA_BASIC_AUTO` + auto HTML；programmatic inject；never Save；host fail-closed；`tests/ats-basic-auto-wiring.test.mjs` 7/7）。**未宣称 live 可填**。
- [ ] Live：仍需 Jeremy 登录各站简历编辑页 + DOM harvest 后再 fill-wo-save；harness `--extension` 可触发，`--synthetic` 不变。

## 2026-10-18 晚 · hotjob-mc 第一切片（中联 antd-mobile）（Asia/Shanghai）

- [x] Path B thin adapter `siteId=hotjob-mc`：内容脚本只填 **姓名/移动电话/电子邮箱**（live `.my-list-item` / `.header-title` / `.am-input-control`）；harness `scripts/auto-hotjob-mc-basic.mjs`（MODE=readiness|fill，CDP 9237，self-inject，Never Save，默认 restore）；fixture + `tests/hotjob-mc-basic.test.mjs` 10/10；`run-hotjob-tenant.cmd zhonglian` 改走 mc harness。
- [x] Live 中联 `SU661f…/mc/deliver/operationResumer` resumeId `6ad4bbb3…`：readiness **PASS** → fill-wo-save+restore **PASS**（证据 `dist/auto-runs/hotjob-mc-basic-*-latest.json`）。未点「下一步」。
- [x] SW `HOTJOB_MC_BASIC_AUTO` 已接线（见下条）。下一刀仍：mc select（性别/国籍等）或其它 pb 租户 live。
- 说明：`dist/site-probes/HOTJOB_MC_OPERATIONRESUMER_20261018.md` §6。

## 2026-10-18 晚 · hotjob-mc SW wiring（Asia/Shanghai）

- [x] 2026-10-18 20:50 CST：`HOTJOB_MC_BASIC_AUTO` wired like feishu/beisen/moka — `src/background/hotjob-mc-basic-auto.mjs` + `src/auto/hotjob-mc-basic-auto.{html,js}` + `worker.mjs` install；programmatic inject；Never Save；fail-closed host+`/SU*/mc/deliver/operationResumer`；harness `--extension` optional. Offline `tests/ats-basic-auto-wiring.test.mjs` + `hotjob-mc-basic.test.mjs` **19/19**.
- [x] Live optional extra text（中联仍登录）：**证件号码** fill-wo-save+restore **PASS**（CDP one-shot；未扩永久 TEXT_LABELS；下一步未点）。Tabs：1 page（mc）。

## 2026-10-18 晚 · hotjob-mc select 第一刀：性别（Asia/Shanghai）

- [x] 2026-10-18 21:00 CST：中联 mc **性别** `.select-am-list-extra` + `.am-modal.mc-select-popup`（选项 男/女；确定/取消）；`fillSelect` allowlist-only；fixture+`tests/hotjob-mc-basic.test.mjs` **13/13**；harness `--only 性别`；offline synthetic 男→女→restore PASS；**live** fill-wo-save+restore **PASS**（证据 `dist/auto-runs/hotjob-mc-select-性别-latest.json`；未点下一步；tabs≤3）。

## 2026-10-18 晚 · hotjob 南粤/Celebright/国盛 公开壳分类（Asia/Shanghai）

- [x] 2026-10-18 21:05 CST：box 公开 HTTP 壳分类（无登录、无 PC 多标签）。三租户均为 **双壳 200**（pb `resumeOperation` hash `a1541…` = 招商；mc `operationResumer` hash `352df1…`）；**非** login-wall-only。门户偏好 → 主猜 **pb**。`run-hotjob-tenant` 键 **`nanyue` / `celebright` / `guosheng` ready（CMS_BASIC）**；若 live 落 mc → hotjob-mc reuse candidate。证据：`dist/site-probes/HOTJOB_SHELL_CLASS_南粤Celebright国盛_20261018.md`；已回写 `HOTJOB_TENANT_NEXT_EXPERIMENT.md` §1.2。

## 2026-10-18 晚 · hotjob 信通院/欧普 公开壳分类（Asia/Shanghai）

- [x] 2026-10-18 21:34 CST：box 公开 HTTP 壳分类（无登录、无 Edge）。信通院+欧普均为 **双壳 200**（pb `a1541…` / mc `352df1…`；body md5 同招商批）；**非** login-wall-only。门户偏好 → 信通院 **pb**（`caict`→CMS_BASIC）、欧普 **mc**（`opple`→hotjob-mc）。排在南粤队列后；**未** live。证据：`dist/site-probes/HOTJOB_SHELL_CLASS_信通院欧普_20261018.md`；已回写 `HOTJOB_TENANT_NEXT_EXPERIMENT.md` §1.3。

## 2026-10-18 晚 · hotjob 隆基/海天 公开壳分类（Asia/Shanghai）

- [x] 2026-10-18 21:47 CST：box 公开 HTTP 壳分类（无登录、无 Edge）。隆基+海天均为 **双壳 200**（pb `a1541…` / mc `352df1…`；body md5 同招商批）；**非** login-wall-only。门户均 `/mc/position/campus` → 主猜 **mc**（`longi`/`haitian`→hotjob-mc Path B，同欧普）。备选同批；**未** live。证据：`dist/site-probes/HOTJOB_SHELL_CLASS_隆基海天_20261018.md`；已回写 `HOTJOB_TENANT_NEXT_EXPERIMENT.md` §1.4；`run-hotjob-tenant.cmd` 键已加。



## 2026-10-18 晚 · hotjob 台积电/TCL茂佳/地平线 公开壳分类（Asia/Shanghai）

- [x] 2026-10-18 21:50 CST：box 公开 HTTP 壳分类（无登录、无 Edge）。台积电+TCL茂佳+地平线均为 **双壳 200**（pb `a1541…` / mc `352df1…`；body md5 同招商批）；**非** login-wall-only。门户均 `/mc/position/campus` → 主猜 **mc**（`tsmc`/`tclmj`|`tcl`/`horizon`→hotjob-mc Path B，同欧普/隆基/海天）。备选同批；**未** live。证据：`dist/site-probes/HOTJOB_SHELL_CLASS_台积电TCL地平线_20261018.md`；已回写 `HOTJOB_TENANT_NEXT_EXPERIMENT.md` §1.5；`run-hotjob-tenant.cmd` 键已加。


## 2026-10-18 晚 · hotjob 宇量昇/哈锅/云谷 公开壳分类（Asia/Shanghai）

- [x] 2026-10-18 21:56 CST：box 公开 HTTP 壳分类（无登录、无 Edge）。宇量昇+哈锅+云谷均为 **双壳 200**（pb `a1541…` / mc `352df1…`；body md5 同招商批）；**非** login-wall-only。门户 → 宇量昇/哈锅 **mc**（`yls`/`haguo`→hotjob-mc）、云谷 **pb**（`yunigu`→CMS_BASIC，`/pb/social.html`）。**verify-list 11/11 shell-class keys complete**。备选同批；**未** live。证据：`dist/site-probes/HOTJOB_SHELL_CLASS_宇量昇哈锅云谷_20261018.md`；已回写 `HOTJOB_TENANT_NEXT_EXPERIMENT.md` §1.6–1.7；`run-hotjob-tenant.cmd` 键已加。



## 2026-10-18 晚 · hotjob-mc select 第二刀：证件类型（Asia/Shanghai）

- [x] 2026-10-18 21:10 CST：中联 mc **证件类型** `.select-am-list-extra` + `.am-modal.mc-select-popup`（7 选项：居民身份证/中国护照/…）；`SELECT_SPECS` allowlist；fixture+`tests/hotjob-mc-basic.test.mjs` **14/14**；harness `--only 证件类型`；offline synthetic 居民身份证→中国护照→restore PASS；**live** seed+alternate+restore PASS 后 Page.reload discard（原为空占位；证据 `dist/auto-runs/hotjob-mc-select-证件类型-latest.json`；未点下一步；tabs≤3）。
- [x] 2026-10-18 21:10 CST：睡前清单收敛 → `_temp-scripts/SLEEP_HELP_PACK_20261018.md`（DONE：中信 marital+political；中联 mc texts+性别+证件类型；EXT hhem…｜TODO 可选：南粤/Celebright/国盛/caict/opple；广发/君乐宝/TI ATS DOM；中信 /my/jl hukou+idType；付费 Edge 9239 + Codex cloud）。**21:36 CST wrap refresh**：同文件 + `NIGHT_STATUS_20261018.md` 已含 证件类型 synthetic、信通院/欧普壳、PR #3、85%。

## 2026-10-18 晚 · hotjob-mc select：国籍/地区 skip + shared select harden（Asia/Shanghai）

- [x] 2026-10-18 21:15 CST：中联 mc live 仍登录；probe **国籍/地区** 同 `.am-modal.mc-select-popup` 但 **搜索+~199 选项** → **skip fill**；harden 共用 `fillSelect`（`popupSearchHeavy`/`SELECT_OUT_OF_SCOPE`/`select_search_heavy`；性别+证件类型已共用无重复路径）；docs §9；offline **14/14**；未点下一步；tarball `hotjob-mc-20261018.tgz` 刷新。

## 2026-10-18 晚 · CITICS Ant Select 下一刀：户口类型（offline/synthetic）

- [x] 2026-10-18 21:19 CST：CITICS **户口类型** Ant Design Vue 1 flat select（家庭户口↔集体户口）；`SELECT_SPECS` allowlist（婚姻状况+政治面貌+户口类型）；fixtures + `tests/citics-hukou-type-select.test.mjs`；harness `--only 户口类型`；synthetic fill-wo-save+restore **PASS**（`dist/auto-runs/citics-ant-select-户口类型-latest.json`）。**Live 未做**（Edge 9237 无 careers.citics.com/my/jl；仅中联 mc 页）。仍拒绝：籍贯/现户口所在地/生源地（级联）、国籍（search-heavy 嫌疑）、民族（中等列表未开刀）、证件类型（页上已有则跳过）。勿对外写已支持。Acceptance % 仍 85%。

## 2026-10-18 晚 · CITICS Ant Select 下一刀：证件类型（offline/synthetic）

- [x] 2026-10-18 21:31 CST：CITICS **证件类型** Ant Design Vue 1 flat select（身份证↔中国护照；港澳/台湾通行证在 allowlist）；`SELECT_SPECS` + `idType`；fixtures + `tests/citics-id-type-select.test.mjs`；harness `--only 证件类型`；synthetic fill-wo-save+restore **PASS**（`dist/auto-runs/citics-ant-select-证件类型-latest.json`）。共用 `fillSelect` 加固 `FLAT_SELECT_MAX_OPTIONS=24` + search-input → `select_search_heavy`（不发明选项；未开民族）。**Live 未做**。仍拒绝：籍贯/现户口所在地/生源地（级联）、国籍（search-heavy 嫌疑）、民族。勿对外写已支持。Acceptance % 仍 85%。

## 2026-10-18 晚 · Feishu ATSX fixture realism（Asia/Shanghai）

- [x] 2026-10-18 21:22 CST：飞书 ATSX fixture realism — 公开 `gffunds.jobs.feishu.cn/index` curl+JS 包确认 `.atsx-form-item`/`.atsx-form-item-label`/`.atsx-input`（非发明）；fixture 加 `#bd`/topbar/footer chrome；简历表单仍登录墙仅文档缺口；offline `tests/feishu-atsx-basic.test.mjs` 刷新；**未宣称 live**。

## 2026-10-18 晚 · Beisen-2022 / Moka fixture realism（Asia/Shanghai）

- [x] 2026-10-18 21:28 CST：北森-2022 + Moka 公开页 curl+JS/CSS 包对照 provisional 选择器 — **均未命中** `.bs-form-item` / `.moka-form-item`（未改名）；fixture 加门户 chrome；login-wall 缺口写入 `BEISEN_2022_NEXT.md` / `MOKA_NEXT.md` + `_beisen-2022-js-class-hints-20261018.txt` / `_moka-js-class-hints-20261018.txt`；offline tests 刷新；**未宣称 live**（不发明表单 DOM）。

- [x] 2026-10-18 21:40 CST：共用 ATS 公开指纹 **Extra §4.2–4.4**（现代牧业/北芯生命=beisen-2022 同 chunk；乐牛/正泰安能=moka 同 TI build；中科创达=feishu-atsx 同广发 JS）→ `dist/site-probes/shared-ats-fingerprint-zhiye-moka-feishu-20261018.md` Extra；reuse candidate 仅标注、**未** live、验收 % 不变。


## 2026-10-18 夜 · night close / plateau（Asia/Shanghai ~22:28 CST）

- [x] **Night close board**：hotjob shell-class **11/11** complete；non-hotjob 公开 fingerprint 批完成（小米=`feishu-atsx` ATSX 孪生；其余自建）；小米 `*.jobs.f.mioffice.cn` host 已接线 feishu-atsx（login-gated；**无 live claim**）；CITICS **民族** Ant Select synthetic PASS（live pending；全量/可搜 → fail-closed）；PR #3 draft 累积中。
- **Live tonight only**：中信 partial（婚姻状况+政治面貌）+ 中联 mc（文本+性别+证件类型）。**Sellable** 仍仅 CMS+GTH。**Acceptance 仍 85%**（不抬）。
- **Plateau**：再 expand live 需 Jeremy 登录 — 见 `_temp-scripts/SLEEP_HELP_PACK_20261018.md` §2。状态板：`_temp-scripts/NIGHT_STATUS_20261018.md` §8。无新适配器；Never Save。


## 2026-10-19 晨 · 南粤 CMS_BASIC live fill Never Save（Asia/Shanghai ~09:00）

- [x] 广东南粤银行 `SU670a291d6202cc7666c744bc` `/pb/resumeOperation.html`：Trial Edge CDP **9237** · EXT `hhembhoojafdefnkonmgoejfedgloanc` · load `edge-internal-v0.1.0-20261013-130219`。
- [x] MODE=**fill** · **Never Save** · outcome `verified_partial` · **personalVerified=8** · **failed=0** · `softwareClickedSave=false`。
- [x] DOM：姓名=马颢原；移动电话=15811077639；另 birthDate / identityNumber / email / gender / 民族 / 证件类型 verified（多为 preexisting_same）。
- [x] 证据 JSON：`dist/auto-runs/hotjob-tenant-670a29-cms-basic-20261019-090052.json`；摘要 `dist/site-probes/HOTJOB_NANYUE_CMS_BASIC_LIVE_20261019.md`。
- [x] Patches（box）：`cms-basic-auto.mjs` TENANT_SIGNATURE；`engine.js` cmsSection tenantMin；`engine.js` cmsDecision（fullName only 个人基本信息；phone prefer 移动电话；basic 专业 `section_requires_mapping`）。CloudAgent `bc-d7c6ac75` 推码 — **未**另开 PR。
- 剩余 skip（非 blocker）：`question_scope_mismatch` 国籍/婚姻/毕业院校；`ambiguous_profile_fact` 政治面貌；region；教育专业仍可能需 work。
- **Acceptance 仍 85%**（不抬）。销售口径不变：对外仍仅招商 CMS + 国泰 GTH。下一可选 live：**Celebright** → 国盛 / caict / opple。


## 2026-10-19 晨 · 招行 CMB offline scaffold（Asia/Shanghai）

- [x] 公开指纹刷新：`career.cmbchina.com` SPA shell 同 `main.d37c8446.js`；**更正** CDP `vue:true` → **React+antd**；证据 `dist/site-probes/CMB_FINGERPRINT_REFRESH_20261019.md` + `_raw-cmb-20261019/`。
- [x] 字段图：`dist/site-probes/cmb-field-map-20261019.md`（+`.json`）；第一切片 **姓名/手机号/邮箱**；强调保存后姓名/证件锁死 → **Never Save**。
- [x] 设计：`EXPAND_CMB_ADAPTER_DESIGN.md`；说明 `dist/site-probes/CMB_NEXT.md`。
- [x] Offline scaffold：`siteId=cmb` · `src/content/cmb-basic.js` + `cmb-profile-map.mjs` · fixture · `scripts/auto-cmb-basic.mjs` · `tests/cmb-basic.test.mjs`；manifest host `https://career.cmbchina.com/*`。**SW/popup 未接线**。
- [ ] Live：Jeremy 登录 `/center/resume` → DOM harvest → fill-wo-save。
- [x] 第二拍字段计划（offline draft；SW/popup 未接线；未宣称已支持招行）：`dist/site-probes/CMB_SECOND_SLICE_PLAN_20261019.md`。
- 体重 offline 已落地（同身高：`.ant-form-item` + `input.ant-input`；只写数字公斤；拒 `60kg`/`60KG`；`--live` 拒 `live_weight_text_unharvested`；套件 34/34；Never Save）。性别/身高/体重合成齐；下一刀需 live 的四字段：婚姻、政治面貌、民族、出生日期。未宣称已支持招行。验收仍 **85%**。
- 下一刀 live 采数顺序见 `dist/site-probes/CMB_LIVE_GATED_FIELDS_DRAFT_20261019.md`：婚姻状况 → 政治面貌 → 民族 → 出生日期。这四字段的真实选项不能离线合成。未宣称已支持招行。验收仍 **85%**。
- 2026-10-19 live gated 四字段已采齐（`dist/site-probes/CMB_LIVE_GATED_HARVEST_20261019.md`，Never Save）。婚姻状况 / 政治面貌 / 民族已按采到的中文名+code 做离线合成 Select；出生日期只记 DatePicker kind+填法提示，未硬编假 DOM，未 live 填。未宣称已支持招行。验收仍 **85%**。
- 2026-10-19 完整 getCommonDictMap 摘要：`dist/site-probes/CMB_DICTMAP_FULL_20261019.md`（Never Save）。gated 四字段已完成。证件类型 IdCardType 15 项已离线合成 Select（中文名+code）。随后 DOM 已采到 `#resume_basicInfo_idCardType`（无 show-search）；`--live` 仍拒 `live_id_card_type_select_fill_unclaimed`（选项+DOM 已采、live 点击未证明，同婚姻状况）。证件号 `#resume_basicInfo_idCard` 不填。未接线键：EnglishLevel / Education / RelationshipType / InterviewCity / AwardsLevel / RankingMajor / ChannelType。未宣称已支持招行。验收仍 **85%**。
- **Acceptance 仍 85%**。勿对外写已支持招行。与南粤 live / Celebright 登录队列并行、不插队打断 Jeremy。
