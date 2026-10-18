# hotjob 租户 CMS 复用 · 下一实验计划（fill-wo-save）

日期：2026-10-18（Asia/Shanghai）  
状态：**离线计划 only** — 本文件不代替 live；**未**对 Jeremy PC 跑 CDP（无 machineId）。  
前置证据：`hotjob-tenants-20261018.md` · `hotjob-tenant-verify-20261018.md`（11/11 reuse-CMS **yes**；登录后 fill **未做**）· `hotjob-feishu-tenants-fingerprint-20261018.md`（飞书扩站：南粤/Celebright 同壳；国盛 SLD→`SU6879…`）  
产品基线：招商 `SU629dbc0c0dcad452299bc0f7` 现网可填；`isCmsResumePage` = `wecruit.hotjob.cn` + `/SU*/pb/resumeOperation.html`。

---

## 1. Top 3 最像 CMS 的 SU 租户（扩站候选，不含基线）

排序依据（探针侧）：与招商同壳 SPA 跳转一致 + `login_wall` / `personal_center` / `pb/` 门户形态接近基线 + 高置信品牌。

| # | 公司 | SU | resumeOperation（登录后目标） | 为何最像 CMS |
| --- | --- | --- | --- | --- |
| **1（首选）** | **中联重科** | `SU661f37091eb8053acd6cdf3d` | https://wecruit.hotjob.cn/SU661f37091eb8053acd6cdf3d/pb/resumeOperation.html | verify：**login_wall** + **personal_center**；门户标题「中联重科校园招聘」；未登录 `resumeOp`→同 SU `/pb/index.html#/` 与基线一致；verify 文末已点名作下一登录目标 |
| **2** | **中国信通院** | `SU642fbf5fbef57c1e269fa798` | https://wecruit.hotjob.cn/SU642fbf5fbef57c1e269fa798/pb/resumeOperation.html | 门户即 **`/pb/index.html`**（与招商基线门户形态同族，非 `mc/`）；**login_wall**；标题「中国信通院招聘」 |
| **3** | **欧普照明** | `SU646ed9920dcad45af14821b4` | https://wecruit.hotjob.cn/SU646ed9920dcad45af14821b4/pb/resumeOperation.html | **personal_center_copy_visible**；校招职位列表高置信；同壳 `resumeOp` 跳转 yes |

门户入口（未登录可开）：

- 中联：https://wecruit.hotjob.cn/SU661f37091eb8053acd6cdf3d/mc/index  
- 信通院：https://wecruit.hotjob.cn/SU642fbf5fbef57c1e269fa798/pb/index.html  
- 欧普：https://wecruit.hotjob.cn/SU646ed9920dcad45af14821b4/mc/position/campus  


### 1.1 飞书扩站新增 SU（同壳已确认；排在中联后）

来源：`feishu-2027-campus-scrape-20261018.md` · 指纹：`hotjob-feishu-tenants-fingerprint-20261018.md`（box 公开 GET，无登录）。资源哈希均 `a1541cf6cc9fe092be2a`（= 招商 CMS）。

| # | 公司 | SU | 门户（未登录） | resumeOperation（登录后目标） | 备注 |
| --- | --- | --- | --- | --- | --- |
| **1b（中联后）** | **广东南粤银行** | `SU670a291d6202cc7666c744bc` | https://wecruit.hotjob.cn/SU670a291d6202cc7666c744bc/pb/school.html | https://wecruit.hotjob.cn/SU670a291d6202cc7666c744bc/pb/resumeOperation.html | `/pb/school.html`；飞书截止约 2026/11/04；resumeOp 公开 200 同壳 |
| **1c** | **Celebright 曼领** | `SU6279c916bef57c3ac0d49671` | https://wecruit.hotjob.cn/SU6279c916bef57c3ac0d49671/pb/index.html | https://wecruit.hotjob.cn/SU6279c916bef57c3ac0d49671/pb/resumeOperation.html | `/pb/index.html` 门户（同信通院族）；resumeOp 公开 200 同壳 |

**Live 序（建议）**：① 中联重科（上表 #1）→ ② 南粤银行 → ③ Celebright → 原 #2/#3 信通院/欧普仍作备选。

**国盛证券（非 wecruit 根域，旁注）**：`https://gszq.hotjob.cn/` → getSLD → SU `SU6879a7b3e57172288b60df9d`。SPA 同壳，但 `isCmsResumePage` 钉死 `wecruit.hotjob.cn`；若试填用  
`https://wecruit.hotjob.cn/SU6879a7b3e57172288b60df9d/pb/resumeOperation.html`（勿用 `gszq` host 进 harness）。排在南粤/Celebright 之后作 #4 备选。

**推荐第一个 live 租户 URL（登录后停在此页再 fill）**：  
`https://wecruit.hotjob.cn/SU661f37091eb8053acd6cdf3d/pb/resumeOperation.html`（中联重科）

**中联之后队列（飞书新增，exact）**：  
1. 南粤：`https://wecruit.hotjob.cn/SU670a291d6202cc7666c744bc/pb/resumeOperation.html`  
2. Celebright：`https://wecruit.hotjob.cn/SU6279c916bef57c3ac0d49671/pb/resumeOperation.html`  
3. （可选）国盛 via wecruit：`https://wecruit.hotjob.cn/SU6879a7b3e57172288b60df9d/pb/resumeOperation.html`

备选同批（非 Top3，仍 reuse yes）：隆基 `SU649d…`、海天 `SU6322…`、台积电南京 `SU6107…`、TCL茂佳 `SU6491…`、哈锅 `SU65f3…`、地平线 `SU62d9…`、宇量昇 `SU6384…`；社招中科云谷 `SU60a6…` **medium**，勿与中联校招 SU 混用。

---

## 2. Edge CDP 9237（试用扩展）· 精确 live 步骤

**环境矩阵（勿混）**

| 项 | 值 |
| --- | --- |
| Edge CDP | **9237**（试用 / internal；见 `PAID_HANDOFF_QA_BLOCKER_20261018.md`） |
| 扩展 | 试用 id 默认 `hdekmacbpblppkbpamgocbanjafigfej`（`RESUME_EXT_ID`） |
| 授权 9239 | **本实验不用** — 租户摸底用试用；交客户前另在授权会话复测 |

**步骤（fill-wo-save / dry）**

1. **Jeremy**：在 9237 试用 Edge 打开目标租户门户 → 完成登录/SSO → 打开并**停留**在  
   `…/SU…/pb/resumeOperation.html`（URL 须仍匹配 `isCmsResumePage`；若被踢回 `#/` 则未登录成功）。  
2. **扩展 reload（若 SW 缺 `CMS_BASIC_AUTO`）**：`RELOAD=1` 或打开  
   `chrome-extension://<EXT_ID>/src/auto/cms-basic-auto.html?mode=reload&reportPort=<port>`。  
3. **Harness**（在 Jeremy 已登录的机器上；box 无 machineId 时由父代理/本机执行）：  
   ```bash
   # 勿让脚本误开招商基线：OPEN_CMS_PAGE=0（脚本内 CMS_PAGE 现硬编码招商 SU）
   # 先 MODE=readiness / dry，再 MODE=fill
   OPEN_CMS_PAGE=0 OPEN_IF_MISSING=0 MODE=readiness node scripts/auto-cms-basic.mjs
   OPEN_CMS_PAGE=0 OPEN_IF_MISSING=0 MODE=fill      node scripts/auto-cms-basic.mjs
   ```  
   - `MODE=fill` = **fill-without-save**（产品 `RESUME_FILL`；auto **永不**点站点 Save）。  
   - `dryRun=1`（auto HTML qs）或先 `MODE=readiness` = 只探就绪、不写。  
4. **证据路径**（写入后复制/核对）：  
   - 时间戳：`dist/auto-runs/cms-basic-auto-<YYYYMMDD-HHMMSS>.json`  
   - 指针：`dist/auto-runs/cms-basic-latest.json` · `dist/auto-runs/latest-cms-basic.json`  
   - 租户实验建议另存副本：`dist/auto-runs/hotjob-tenant-<SU短码>-cms-basic-<stamp>.json`（手工 copy，避免与招商基线 latest 混淆）  
5. **照片 / 教育多段**：`isCmsPhotoResumePage` **钉死招商 SU** — 本实验**禁止**对未验证租户开照片/教育 multi 上传路径；只做 basic `CMS_BASIC_AUTO`。

**脚本清单（复用，不新写也可跑）**

| 用途 | 路径 |
| --- | --- |
| one-shot harness | `scripts/auto-cms-basic.mjs` |
| auto 页 | `src/auto/cms-basic-auto.html` + `src/auto/cms-basic-auto.js` |
| SW 任务 | `src/background/cms-basic-auto.mjs`（`CMS_BASIC_AUTO`；`softwareClickedSave` fail-closed） |
| 页聚焦 | `src/background/cms-page-focus.mjs` |
| 教育/实习 harness | `scripts/auto-cms-education.mjs` · `scripts/auto-cms-internship.mjs` — **本轮不做**（基线钉死招商 PAGE） |
| ~~已知缺口~~ 已补（2026-10-18 19:5x CST） | harness 支持 `CMS_PAGE`/`CMS_SU`（校验 `wecruit.hotjob.cn/SU*/pb/resumeOperation.html`）→ auto 页 `cmsPage` → SW `CMS_BASIC_AUTO` 按该 SU 找 tab/probe（原先 SW 钉死招商，仅 `OPEN_CMS_PAGE=0` 也会 `cms_basic_login_or_wrong_page`）；一键 `scripts\run-hotjob-tenant.cmd <zhonglian\|nanyue\|celebright\|guosheng>`；证据自动另存 `hotjob-tenant-<6>-cms-basic-<stamp>.json`，不覆盖招商 latest |

---

## 3. 成功标准（读回计数）与 fail-closed（禁止 Save）

对照招商 live：`FINAL_ACCEPTANCE_CHECKLIST.md` · `dist/auto-runs/cms-basic-fill-latest.json`（`MODE=fill`，`verified_partial`，`saveAttempted=false`）。

**PASS（租户实验最小闭环）**

| 检查 | 标准 |
| --- | --- |
| 页态 | `readiness.pageState === "ready"`；`sectionPresent`；`个人基本信息必填` 有 `questionCount ≥ 1` |
| 写入意图 | `MODE=fill` 时 `writeAttempted === true`（readiness/dry 可为 false） |
| 读回 | `job.summary.verified ≥ 1`（理想：基本信息必填题多数 verified / preexisting_same_value / readback_*）；记录 `verified` / `skipped` / `failed` |
| Save 政策 | `saveAttempted === false`；`job.softwareClickedSave === false`；`softwareClickedSubmit === false`；`savedOnSite` 非 true |
| 扩展 | 非 `extension_reload_required` / `extension_reload_failed` |
| 路径 | 填充时 tab URL 仍为该租户 `…/pb/resumeOperation.html`（非 `#/` 登录墙） |

**FAIL-CLOSED（任一即停，不宣称可填）**

- 任何 **Save / 提交** 点击或 `cms_basic_save_policy_violated`  
- 未登录 / SSO 墙：`helpNeeded` + resumeOp 跳走  
- `license_required`（若误用付费闸逻辑）/ `profile_fact_unconfirmed` / `missing_profile_value`  
- 把 Big5 或非 `wecruit.hotjob.cn/SU*` 页硬塞进 CMS harness  
- 对非招商 SU 启用照片上传或教育/实习 multi（未验证）

**不宣称**：即使 PASS，也只记「该 SU 路径可复用 CMS basic fill-wo-save」；**不**写入客户已支持列表，直至回归 CMS/GTH 且文档收录。

---

## 4. 无 Jeremy 则阻塞的项

| 阻塞 | 说明 |
| --- | --- |
| **租户登录** | 新 SU 的 `resumeOperation.html` 未登录会落到同 SU `/pb/index.html#/`（与基线一致）；agent **不能**代填验证码/SSO |
| **试用扩展 reload** | SW 未加载 `CMS_BASIC_AUTO` → `extension_reload_required`；需 Jeremy 在 9237 点 reload 或跑 `mode=reload` |
| **确认停在编辑页** | 登录后须保持目标 SU 的 resumeOperation 标签页；通知父代理再跑 MODE=fill |
| **本 box** | **无 machineId** → 不能对 Jeremy PC 开 CDP；本文件仅计划 |

喊话模板：「请在试用 Edge(9237) 登录中联重科并打开  
`https://wecruit.hotjob.cn/SU661f37091eb8053acd6cdf3d/pb/resumeOperation.html`，扩展 reload 后回复，再跑 `OPEN_CMS_PAGE=0 MODE=fill`。」

---

## 5. Big5 ≠ hotjob（禁止 CMS 复用强塞）

来源：`probe-big5-public-20261018.md` · `EXPAND_PROGRESS.md` E4。

| 公司 | 公开指纹 | 与 hotjob |
| --- | --- | --- |
| 字节 | **飞书招聘 ATSX**（`atsx-throne` / feishucdn） | **非** hotjob |
| 美团 | **美团自建** React（`zhaopin.meituan.com`） | **非** hotjob |
| 京东 | **京东自建** umi / `public.wechat.resume`（校招 `campus.jd.com`） | **非** hotjob |
| 腾讯 / 阿里 | 自建门户（E2+E4） | **非** hotjob |

**明确**：Big5（字节飞书 ATSX / 美团自建 / 京东自建，及腾讯·阿里）**不是** hotjob 租户实验对象；**不要**把 CMS 白名单或 `CMS_BASIC_AUTO` 强加到这些域。大厂下一刀是**登录后表单指纹**（另线），不是本文件的 SU 复用。

---

## 6. 完成后回写

- 勾选 `EXPAND_PROGRESS.md` E3：「任一新 SU 白名单试填（fill-without-save）」  
- 证据 JSON 路径写入进度表；窄版验收 **85% 不抬**  
- 销售口径不变：对外仍仅 **招商 CMS + 国泰 GTH**

*本文件：`dist/site-probes/HOTJOB_TENANT_NEXT_EXPERIMENT.md`*
