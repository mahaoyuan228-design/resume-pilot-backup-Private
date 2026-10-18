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
| E3 | 抽样共用 ATS / hotjob 租户 | [x] | 2026-10-18：候选清单 + **租户路径复用验证** |
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
- [ ] 招行适配器开发
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
| 招行自建 | [x] 2026-10-18 | [ ] | [ ] |
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
