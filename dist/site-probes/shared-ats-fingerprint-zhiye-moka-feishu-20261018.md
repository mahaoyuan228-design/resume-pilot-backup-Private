# 共用 ATS 公开指纹：北森/zhiye · Moka · 飞书 ATSX（2026-10-18）

时区：Asia/Shanghai  
方法：box 上 `curl -L --compressed`（浏览器 Chrome UA）+ 路径抽样；**无登录、无 Jeremy PC / CDP**  
来源线索：飞书「2027届校招」扩站列表（zhiye / mokahr / jobs.feishu.cn）  
HTML 快照：`_raw-zhiye-moka-feishu-20261018/`

对照：hotjob/wecruit CMS 基线 = `wecruit.hotjob.cn` + `/pb/resumeOperation.html`（本轮 **无一命中**）。

---

## 汇总

| # | 公司 | 探测 URL | HTTP | Final URL | 登录墙（静态） | 栈 | 未登录可见简历表单？ | vs hotjob 复用 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 新华资产/新华保险网申 | `nci.zhiye.com/xyzp?class=2` | **200** | 同 URL（0 redirect） | 职位列表公开；**投递** `/Portal/Apply/Index` → **302→Login** | 北森 **legacy CmsPortal**（`is-old: true`） | **否** | **不可**；需独立 Beisen-legacy 适配 |
| 2 | 君乐宝 | `junlebaoruye.zhiye.com/campus/jobs` | **200** | 同 URL | SPA 壳含 `login` 页配置；HTTP 无墙 | 北森 **ux-recruitment-portal-2022**（同 chunk） | **否**（空壳 0 input） | **不可**；Beisen-2022 共享适配优先 |
| 3 | 英威腾 | `invt.zhiye.com/campus/jobs` | **200** | 同 URL | 同 #2 | 同 #2（同 chunk hash） | **否** | **不可**；与 #2/#4 同壳 |
| 4 | 金山云 | `jssoft.zhiye.com/campus/jobs` | **200** | 同 URL | 同 #2 | 同 #2（同 chunk hash） | **否** | **不可**；与 #2/#3 同壳 |
| 5 | 德州仪器 | `app.mokahr.com/campus-recruitment/ti/143986` | **200**（需 cookie；裸 follow 易环） | 同 URL | 门户公开；申请表单预期候选账号 | **Moka** `static-ats.mokahr.com` | **否**（SPA；init 无字段 DOM） | **不可**；新 Moka 适配 |
| 6 | 广发基金 | `gffunds.jobs.feishu.cn/index` | **200** | 同 URL | 门户公开；简历区在 SPA/登录后 | **飞书 ATSX** saas-career | **否**（导航有「简历」配置，无表单 DOM） | **不可**；可跟字节 ATSX 同族研究 |
| 7 | 现代牧业 | `xiandaimuye.zhiye.com/campus/jobs` | **200** | 同 URL | SPA；无 HTTP 墙 | 北森 **ux-recruitment-portal-2022**（同 chunk） | **否**（0 input） | **不可**；**reuse candidate → beisen-2022** |
| 8 | 北芯生命 | `insight-med.zhiye.com/campus/jobs` | **200** | 同 URL | 同 #7 | 同 #7（同 chunk hash） | **否** | **不可**；**reuse candidate → beisen-2022** |
| 9 | 乐牛游戏 | `app.mokahr.com/campus-recruitment/leniu/36041` | **200**（cookie jar） | 同 URL（亦 `campus_apply/...` 同壳） | 门户公开 | **Moka** `static-ats` build `20261012-1723-f0ef3` | **否**（SPA；无字段 DOM） | **不可**；**reuse candidate → moka** |
| 10 | 正泰安能 | `app.mokahr.com/campus-recruitment/chint/40745` | **200**（cookie jar） | 同 URL | 正泰集团校招门户；内含「正泰安能…」部门标签 | **Moka** 同 TI/乐牛 build | **否** | **不可**；**reuse candidate → moka**（org=`chint` 共享站） |
| 11 | 中科创达 | `thundersoft.jobs.feishu.cn/campus` | **200** | 同 URL | 门户公开 | **飞书 ATSX** saas-career（JS chunk **全同**广发） | **否** | **不可**；**reuse candidate → feishu-atsx** |

**同壳结论（北森 2022）**：君乐宝 / 英威腾 / 金山云 / **现代牧业** / **北芯生命** 静态 HTML 均加载  
`acdn.bstatics.com/.../ux-recruitment-portal-2022/release/dist/pc-e2be192404257687c4d1.chunk.min.js`  
+ 嵌入式站点地图（`home` / `login` / `Campus*` / `jobs`）。`/login`、`/personal/resume` 等路径亦 **200 同壳**（无服务端表单）。

**推荐适配器优先级（相对 hotjob 复用队列）**：

1. **继续 hotjob 租户 live**（中联等）— 不因本轮改序。  
2. **飞书 ATSX**（广发 + 已有字节 E4）— 跨雇主同 CDN/`atsx-throne`，优先于绿场 ATS。  
3. **北森 recruitment-portal-2022 共享适配**（君乐宝→英威腾→金山云→**现代牧业**→**北芯生命**）— 五租户同 chunk，杠杆高。  
4. **Moka**（德州仪器 `org=ti`/`143986`；**乐牛** `org=leniu`/`36041`；**正泰/安能** `org=chint`/`40745`）— 同 build。  
5. **北森 legacy CmsPortal**（新华 `CmsPortal/15006301`）— 与 2022 壳不同代，排后。

---

## 1. 新华资产（nci.zhiye.com）— 北森 legacy

| 项 | 值 |
| --- | --- |
| 探测 URL | https://nci.zhiye.com/xyzp?class=2 |
| HTTP | **200**；redirects=0 |
| Final URL | https://nci.zhiye.com/xyzp?class=2 |
| Content-Type | `text/html; charset=utf-8`；解压后 ≈137KB（响应常 gzip） |
| 响应头线索 | `Web: BeiSen`；`is-old: true`；PaaS site `web-custom-new-zhiye-com` |
| 标题 | 新华保险网申系统-- |
| 栈 | **北森/zhiye legacy CmsPortal**：`stc-cms.beisen.com/CmsPortal/15006301/` + `themes_xinhua_*` + `stc.beisen.com/.../require.js`；**非** `ux-recruitment-portal-2022` |
| 登录墙 | 校招列表页 **无** HTTP 墙；`/Portal/Apply/Index` → **302** → `/Portal/Account/Login?returnUrl=...`（登录页含 `UserName`/`Password`/手机验证码，9 inputs） |
| 未登录简历表单 | **不可见**；仅职位关键字搜索 + MvcPager |
| hotjob？ | **否** |
| 快照 | `_raw-zhiye-moka-feishu-20261018/nci-xyzp.html` · `nci-Portal-Account-Login.html` |

**判读**：老北森网申主题站；投递强依赖登录。适配器与 2022 portal **不可**混用；相对 hotjob **零复用**。

---

## 2. 君乐宝（junlebaoruye.zhiye.com）— 北森 2022 portal

| 项 | 值 |
| --- | --- |
| 探测 URL | https://junlebaoruye.zhiye.com/campus/jobs |
| HTTP | **200**；redirects=0 |
| Final URL | 同探测 URL |
| Body | ≈22KB HTML SPA 壳 |
| 标题 | 君乐宝乳业集团有限公司 |
| 栈 | **zhiye/beisen** `ux-recruitment-portal-2022`；chunk **`pc-e2be192404257687c4d1`**；CDN `acdn.bstatics.com` |
| 站点地图（嵌入 JSON） | `home` / `login`(登录注册页) / `jobs` / `Campus*` / `Social*` / `Intern*`；domain alias `junlebaoruye` |
| 登录墙 | HTTP 无；SPA 配置含 login 页 — 简历/投递预期客户端鉴权 |
| `/personal/resume` | **200** 同壳；**0** `<input>` / `<form>`（表单未 SSR） |
| 未登录简历表单 | **否** |
| hotjob？ | **否** |
| 快照 | `_raw-zhiye-moka-feishu-20261018/junlebao-campus-jobs.html` |

---

## 3. 英威腾（invt.zhiye.com）— 北森 2022 portal

| 项 | 值 |
| --- | --- |
| 探测 URL | https://invt.zhiye.com/campus/jobs |
| HTTP | **200**；redirects=0 |
| Final URL | 同探测 URL |
| Body | ≈14KB |
| 标题 | 深圳市英威腾电气股份有限公司 |
| 栈 | **与君乐宝同壳**（同 `pc-e2be192404257687c4d1.chunk.min.js` + 同站点地图结构）；domain `invt` |
| 登录墙 / 简历表单 | 同 #2：SPA；未登录无表单 DOM |
| hotjob？ | **否** |
| 快照 | `_raw-zhiye-moka-feishu-20261018/invt-campus-jobs.html` |

---

## 4. 金山云（jssoft.zhiye.com）— 北森 2022 portal

| 项 | 值 |
| --- | --- |
| 探测 URL | https://jssoft.zhiye.com/campus/jobs |
| HTTP | **200**；redirects=0 |
| Final URL | 同探测 URL |
| Body | ≈45KB（嵌入配置更大） |
| 标题 | 金山云 |
| 栈 | **同 #2/#3** chunk；domain `jssoft`；Alias「北京金山云网络技术有限公司」 |
| 登录墙 / 简历表单 | 同 #2 |
| hotjob？ | **否** |
| 快照 | `_raw-zhiye-moka-feishu-20261018/jssoft-campus-jobs.html` |

---

## 5. 德州仪器（app.mokahr.com）— Moka

| 项 | 值 |
| --- | --- |
| 探测 URL | https://app.mokahr.com/campus-recruitment/ti/143986 |
| HTTP | **200**（先 302 写 `acw_tc` / `connect.sid` / `moka-apply` 等 cookie 后回到同 path；无 cookie 时 curl 易 redirect loop） |
| Final URL | https://app.mokahr.com/campus-recruitment/ti/143986 |
| Body | ≈163KB |
| 标题 | 德州仪器招聘 |
| 栈 | **Moka ATS**：`static-ats.mokahr.com/recruitment-web-client/*`（build `20261012-1723-f0ef3-release`）；`Server: Tengine` |
| init-data | `org.id=ti`；`siteId=143986`；`mode=campus`；`type=camp`；**jobs=15**；`useApplyForm=true`；`hideWebsiteOnlineResume=false`；`candidateSecurityConfig.maxLoginTimeLimit=0` |
| 登录墙 | 门户 HTML **无**强制登录文案；申请/在线简历走 SPA（子路径 `/apply` 等裸 path **404**，路由在客户端） |
| 未登录简历表单 | **否**（仅 hidden `init-data`；无字段 input） |
| hotjob？ | **否** |
| 快照 | `_raw-zhiye-moka-feishu-20261018/moka-ti-campus.html` · `moka-ti-init-summary.json` |

---

## 6. 广发基金（gffunds.jobs.feishu.cn）— 飞书 ATSX

| 项 | 值 |
| --- | --- |
| 探测 URL | https://gffunds.jobs.feishu.cn/index |
| HTTP | **200**；redirects=0 |
| Final URL | 同探测 URL |
| Body | ≈174KB |
| 标题 | 广发基金招聘 |
| 栈 | **飞书招聘 ATSX** `saas-career`：`lf-package-cn.feishucdn.com/obj/atsx-throne/hire-fe-prod/portal/saas-career/...`（与字节 E4 同族）；`bytescm.com` tinycolor |
| 登录墙 | 静态门户无登录表单；`/login` `/resume` 裸 path **404**（客户端路由） |
| 未登录简历表单 | **否**；配置里有导航「简历」「简历附件」文案，无 `<form>`/`<input>` |
| hotjob？ | **否**（文中 `FeatureDailyExamUseBeisen` 仅为功能开关名，**非**北森壳） |
| 快照 | `_raw-zhiye-moka-feishu-20261018/feishu-gffunds-index.html` |

**判读**：与 `jobs.bytedance.com` 同 ATSX 产品线 → 适配器研究应 **挂在飞书 ATSX 族**，而不是 hotjob 复用。

---

---

## Extra batch · §4.2–4.4 余下雇主（2026-10-18 21:40 CST）

方法同文件头：`curl -L --compressed` + Chrome UA；无登录 / 无 Edge / 无 CDP / 无 Save。  
线索：飞书 scrape §4.2–4.4 中尚未入本表的五家。

### 汇总（本批）

| # | 公司 | URL | HTTP | 壳族 | same-chunk-as | reuse candidate | 快照 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 7 | 现代牧业 | https://xiandaimuye.zhiye.com/campus/jobs | 200 | Beisen-2022 | 君乐宝 `pc-e2be192404257687c4d1` | **beisen-2022** | `xiandaimuye-campus-jobs.html` |
| 8 | 北芯生命 | https://insight-med.zhiye.com/campus/jobs | 200 | Beisen-2022 | 同上 | **beisen-2022** | `beixin-insight-med-campus-jobs.html` |
| 9 | 乐牛游戏 | https://app.mokahr.com/campus-recruitment/leniu/36041 | 200 | Moka static-ats | TI build `20261012-1723-f0ef3-release` | **moka** | `moka-leniu-36041.html` |
| 10 | 正泰安能 | https://app.mokahr.com/campus-recruitment/chint/40745 | 200 | Moka static-ats | 同上 | **moka** | `moka-chint-anneng-40745.html` |
| 11 | 中科创达 | https://thundersoft.jobs.feishu.cn/campus | 200 | Feishu ATSX | 广发 saas-career JS **7/7 同 hash** | **feishu-atsx** | `feishu-thundersoft-campus.html` |

**未发明表单选择器；未宣称 live。**

---

### 7. 现代牧业（xiandaimuye.zhiye.com）— 北森 2022 portal

| 项 | 值 |
| --- | --- |
| 探测 URL | https://xiandaimuye.zhiye.com/campus/jobs |
| HTTP | **200**；redirects=0 |
| Final URL | 同探测 URL |
| Body | ≈38KB HTML SPA 壳 |
| 标题 | 现代牧业 |
| Domain / Alias | `xiandaimuye` / 「现代牧业（集团）有限公司」 |
| 栈 | **ux-recruitment-portal-2022**；chunk **`pc-e2be192404257687c4d1`**；CDN `acdn.bstatics.com` |
| same-chunk-as | 君乐宝 / 英威腾 / 金山云 |
| 登录墙 / 简历表单 | HTTP 无墙；**<input>/<form> = 0**（表单未 SSR） |
| hotjob？ | **否** |
| reuse candidate | **beisen-2022**（已有 offline scaffold；勿宣称 live） |
| 快照 | `_raw-zhiye-moka-feishu-20261018/xiandaimuye-campus-jobs.html` |

---

### 8. 北芯生命（insight-med.zhiye.com）— 北森 2022 portal

| 项 | 值 |
| --- | --- |
| 探测 URL | https://insight-med.zhiye.com/campus/jobs |
| HTTP | **200**；redirects=0 |
| Final URL | 同探测 URL |
| Body | ≈22KB |
| 标题 | 北芯生命 |
| Domain / Alias | `insight-med` / 「深圳北芯生命科技股份有限公司」 |
| 栈 | **与 #7 / 君乐宝同壳**（同 `pc-e2be192404257687c4d1`） |
| 登录墙 / 简历表单 | 同 #7：SPA；未登录无表单 DOM |
| hotjob？ | **否** |
| reuse candidate | **beisen-2022** |
| 快照 | `_raw-zhiye-moka-feishu-20261018/beixin-insight-med-campus-jobs.html` |

---

### 9. 乐牛游戏（app.mokahr.com · org=leniu）— Moka

| 项 | 值 |
| --- | --- |
| 探测 URL | https://app.mokahr.com/campus-recruitment/leniu/36041 |
| 等价路径 | `campus_apply/leniu/36041` → 同壳 200 |
| HTTP | **200**（cookie jar；裸 follow 可能环） |
| Final URL | 同探测 URL |
| Body | ≈39KB |
| 标题 | 广州乐牛游戏 - 校园招聘 |
| 栈 | **Moka ATS** `static-ats.mokahr.com/recruitment-web-client/*`；build **`20261012-1723-f0ef3-release`**（与德州仪器同） |
| init | `org.id=leniu`；`siteId=36041`；`mode=campus`；siteName「系统默认校园招聘门户」 |
| 登录墙 / 简历表单 | 门户公开；仅 SPA/hidden init；**无字段级简历 DOM** |
| hotjob？ | **否** |
| reuse candidate | **moka** |
| 快照 | `_raw-zhiye-moka-feishu-20261018/moka-leniu-36041.html` |

---

### 10. 正泰安能（app.mokahr.com · org=chint）— Moka

| 项 | 值 |
| --- | --- |
| 探测 URL | https://app.mokahr.com/campus-recruitment/chint/40745 |
| HTTP | **200**（cookie jar） |
| Final URL | 同探测 URL（`/campus-recruitment/chint` 亦 302→40745） |
| Body | ≈160KB |
| 标题 | 正泰 - 校园招聘 |
| 说明 | **正泰集团**统一校招门户；init 部门标签含「**正泰安能数字能源（浙江）股份有限公司**」（jobCount 线索约 86）。独立 `chintanneng` org slug **未解析到**有效站（空壳 1639B）。 |
| 栈 | **Moka** 同 #5/#9 build `20261012-1723-f0ef3-release` |
| init | `org.id=chint`；`siteId=40745`；`mode=campus` |
| 登录墙 / 简历表单 | 同 Moka 批：无未登录字段 DOM |
| hotjob？ | **否** |
| reuse candidate | **moka**（与 TI/乐牛同壳；org 不同） |
| 快照 | `_raw-zhiye-moka-feishu-20261018/moka-chint-anneng-40745.html` |
| Blocker | 无独立安能子域；适配时注意集团多部门共享站 |

---

### 11. 中科创达（thundersoft.jobs.feishu.cn）— 飞书 ATSX

| 项 | 值 |
| --- | --- |
| 探测 URL | https://thundersoft.jobs.feishu.cn/campus |
| 亦 200 | `/` · `/index`（社招/综合壳；本批以 campus 为准） |
| HTTP | **200**；redirects=0 |
| Final URL | 同探测 URL |
| Body | ≈174KB |
| 标题 | 中科创达校园招聘 |
| 栈 | **飞书招聘 ATSX** `saas-career`：`lf-package-cn.feishucdn.com/obj/atsx-throne/hire-fe-prod/portal/saas-career/...` |
| same-chunk-as | 广发 `gffunds`：**saas-career/static/js/* 七个 chunk hash 全同** |
| 登录墙 / 简历表单 | 静态门户无登录表单；**0** `<input>`/`<form>` |
| hotjob？ | **否**（文中偶发 beisen 功能名 ≠ 北森壳） |
| reuse candidate | **feishu-atsx** |
| 快照 | `_raw-zhiye-moka-feishu-20261018/feishu-thundersoft-campus.html` |

---

### Extra batch · Blockers

| 项 | 说明 |
| --- | --- |
| URL 解析 | 五家均在 2–3 次猜测/检索内命中；**无**「URL not resolved」 |
| 正泰安能 | 挂在集团 `chint/40745`，非独立 mokahr org |
| 表单 DOM | 全部登录墙/SPA；**未**采选择器、**未** live |
| 验收 % | **不**上调 |


## Blockers / 未做

| 项 | 说明 |
| --- | --- |
| 无登录 / 无 CDP | 未渲染 SPA 登录 UI；未验证投递/简历字段 DOM；未 fill |
| 北森 2022 | `/personal/resume` 仅同壳；真实表单需登录后客户端路由 |
| Moka | cookie 门禁对自动化有影响；申请页 path 需从 SPA 路由表再探 |
| 飞书 | 广发与字节同族，登录后表单是否同组件待对照 |
| hotjob | 本文件十一站 **全部** 非 wecruit；不插入中联 live 队列 |
| Extra §4.2–4.4 | 现代牧业/北芯/乐牛/正泰安能/中科创达 已入表；皆 reuse candidate（beisen-2022 / moka / feishu-atsx）；**未** live |

*本文件：`dist/site-probes/shared-ats-fingerprint-zhiye-moka-feishu-20261018.md`*
