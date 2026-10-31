# Non-hotjob 公开 HTTP 指纹批 · 2026-10-18（Asia/Shanghai）

**范围**：华为 / 小米 / 快手 / 拼多多 / 腾讯音乐 / 网易 / 兴业银行 / 民生银行 校招公开页。  
**方法**：box `curl -sL`（短超时）+ HTML/入口 JS 关键字；**无登录、无 Edge、无凭据**。  
**原始**：`dist/site-probes/_raw-nonhotjob-20261018/<slug>/`  
**跳过**：Big5 + 招行（已在 `probe-big5-public-20261018.md` / `probe-20261018-summary.md`）；duomian / RedseaPlatform / wjx — scrape 无具体 https，未发明 URL。  
**原则**：不宣称客户可填；验收仍 **85%**；可卖仍 CMS+GTH。

---

## 紧凑表

| 公司 | final URL | ATS/family 猜测 | 简历公开? | difficulty | 一行备注 |
| --- | --- | --- | --- | --- | --- |
| **小米** | `https://xiaomi.jobs.f.mioffice.cn/newretailing/?spread=M1SXHJC`（根域同壳） | **飞书招聘 ATSX saas-career**（`atsx-throne` / feishucdn；`pc.4481de59.js`=`FEISHU_ATSX` 同哈希） | 否 | **reuse-existing-adapter**（`feishu-atsx` 族） | **高杠杆**：与广发/thundersoft 同 `saas-career` 包；非 hotjob；登录后才有表单 |
| **华为** | `https://career.huawei.com/cn/campus-recruitment` | **华为自建** HWP/Sitecore 风（`htemplate` / require+jquery；`X-HWP-TraceId`） | 否 | **new-adapter** / login-gated-defer | 旧 portal5 路径 301→`/cn`；公开 0 input；无 hotjob/beisen/moka |
| **快手** | `https://campus.kuaishou.cn/`（社招 `zhaopin.kuaishou.cn`） | **快手自建** React+antd（`careers-campus` @ kwimgs） | 否 | **new-adapter** / login-gated-defer | `/recruit` 404；main.js 有 `edit-resume`/`getMyResume` API 线索，需登录；非共用 ATS |
| **拼多多** | `https://careers.pddglobalhr.com/campus/grad?t=6I3i5acZmE` | **PDD 自建** Next.js（`x-powered-by: Next.js`；`_recruit-campus-web`） | 否 | **new-adapter** / login-gated-defer | 公开页仅岗位筛选 checkbox；无简历编辑 DOM；非 hotjob |
| **腾讯音乐** | `https://join.tencentmusic.com/campus/post/?type=40` | **TME 自建** Nuxt + Element-UI | 否 | **new-adapter** / login-gated-defer | SSR 岗位列表；`/login` `/resume` 链存在但未登录无表单；与 join.qq 不同壳 |
| **网易** | `https://campus.163.com/`（`…/app/job/position?id=103` 同壳） | **网易自建 EHR**（`ehr-web.netease.com` + CRA `main.*.js`；易盾） | 否 | **new-adapter** / login-gated-defer | `#login-box` 空挂载；公开 0 input；非 hotjob |
| **兴业银行** | `https://job.cib.com.cn/portal/`（根 301→portal） | **银行自建** ant-design-vue SPA（`/portal/static/js/ant-design-vue.*.js`） | 否 | **new-adapter** / login-gated-defer | 公告验证 URL；公开 HTML 无简历 input；非 CMB/hotjob |
| **民生银行** | `https://career.cmbc.com.cn/` | **银行自建「求贤」qiuxian** Angular 门户（`qiuxian_portal.js`；无 beisen/moka/hotjob 串） | 否 | **new-adapter** / login-gated-defer | 壳 ~2KB + 3MB portal JS；登录墙；与招行 `career.cmbchina.com` 不同源 |

---

## 分类摘要

| 桶 | 公司 | 扩站含义 |
| --- | --- | --- |
| **shared-ATS（可复用族）** | **小米 → 飞书 ATSX saas-career** | 与既有 `feishu-atsx` scaffold **同 JS 哈希**；登录后可试 reuse，**勿**塞 CMS 白名单 |
| **self-built** | 华为 / 快手 / PDD / TME / 网易 / 兴业 / 民生 | 各一家一套；公开侧无简历表单 |
| **aggregation** | （本批无） | — |
| **login-only wall** | 上表全体（公开侧） | 简历 DOM 一律 defer 到 Jeremy 登录后 |

---

## 高杠杆发现（写入 NEXT）

**小米 `*.jobs.f.mioffice.cn` = 飞书 ATSX saas-career 孪生**（同 `pc.4481de59.js` / `8825.0e3d5ab8.js`）。  
→ 已在 `HOTJOB_TENANT_NEXT_EXPERIMENT.md` 追加 §Feishu ATSX twin（小米）。其余七家 **无** 新共用族，不抬 hotjob 队列。

---

## Skip 说明

| 项 | 原因 |
| --- | --- |
| Big5 / 招行 | 已覆盖 |
| duomian / RedseaPlatform / wjx | feishu scrape 仅平台名，**无具体 https**；未发明 URL |
| careers.kuaishou.com | TLS/连不通（http=000） |

---

## 原始路径

`dist/site-probes/_raw-nonhotjob-20261018/{huawei,xiaomi,kuaishou,pdd,tencentmusic,netease,cib,cmbc}/`

*探针时刻：约 2026-10-18 22:03–22:05 Asia/Shanghai。勿对外说「已支持」。*
