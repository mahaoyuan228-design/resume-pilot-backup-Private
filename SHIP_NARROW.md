# 窄版可装可收费 — 本月定义（简历快填）

日期：2026-10-17（Asia/Shanghai）  
对象：Jeremy / parent 交接；**不**扩大站点、**不**宣称完整 DRM。

## 「窄版可装可收费」本月指什么

| 维度 | 本月目标 | 说明 |
| --- | --- | --- |
| **可装** | 内部试用包可在 Edge「加载解压缩的扩展」安装；付费包另有独立 ZIP | 内部 = `scripts/build-internal.ps1` → `dist/edge-internal-v…/extension`；付费 = `scripts/build-paid.ps1`（需自有 HTTPS） |
| **可收费（窄）** | 付费包能 **fail-closed**：未激活 / 过期 / 不可达 → 中文拦截；激活页可粘贴本地 entitlement | 授权脚手架 + Ed25519 校验已离线就绪；**尚未**接真实支付与生产域名 |
| **窄站点** | 仅 **CMS（招商 wecruit）+ GTH（国泰海通）** | `manifest` host_permissions 仅这两站 |
| **活门禁** | CMS 教育两端 live closed-loop 证据仍是产品硬门槛 | 见下方「必须过的 live gates」 |

**一句话：** 本月「可收费」= 能打出带闸门的付费包 + 中文激活路径；**不是**「已上线收款」或「防破解完成」。

## 本月纳入的站点

| 站点 | Host | 本月纳入范围 |
| --- | --- | --- |
| **CMS** 招商证券招聘 | `https://wecruit.hotjob.cn/*` | 基本信息 / 教育（多段）/ 实习等已进内部包；教育 auto + **实习 auto** + **`CMS_BASIC_AUTO`（个人基本信息，默认 readiness）** 脚手架已进；**教育两端 live 核对**为本月主门禁 |
| **GTH** 国泰海通 | `https://hr.gtht.com/*` | 教育串行 / 草稿 Save·刷新；**`GTH_BASIC_AUTO` / `GTH_SIMPLE_AUTO` / `GTH_OTHER_AUTO` / `GTH_INTENT_AUTO`**（默认 readiness，Never Save）脚手架已进；**Save 实站政策暂缓**（干跑中文澄清 ready≠会点保存） |

不在本月窄版：其它招聘站、全站 OCR/AI、自动投递。

## 必须过的 live gates（未过则不算「可收费交付」）

1. **CMS 教育闭环（两端）** — **PASS 2026-10-17 19:52 Asia/Shanghai**（indices 5+4；region/rank verified；school fail-soft）。Index4 degree soft-skip **fixed + live verified** (`DEGREE_LEVELS` 硕士↔硕士研究生；`readback_matched` 19:57). 详见 `CMS_EDUCATION_CLOSEDLOOP.md` 与 `dist/auto-runs/both-rows-summary.json`。
2. **付费包冒烟** — **离线包冒烟 PASS**（`edge-paid-v…` + activate + mock verify）。生产 HTTPS / 真支付仍缺。
3. **（可选本月）Ed25519 生产钥**  
   离线脚手架已有；生产公钥嵌入 + 私钥离线签发，需 Jeremy 选定后再做。
4. **GTH Save**  
   **政策暂缓**（CMS 教育两端证据已过）：auto 永不 Save；实站 Save 仅 Jeremy one-shot。见 `验收清单.md`。

## 如何加载：内部包 vs 付费 ZIP

### 内部试用（Jeremy 日常 / live 核对）

- 构建：`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-internal.ps1`
- 输出：`dist/edge-internal-v0.1.4.9-<UTC戳>/extension` + ZIP + `SHA256SUMS.txt`
- 白名单：`WHITELIST.json` **productPaths = 96**（含 CMS/GTH basic·simple·other·**intent** auto）；构建脚本按表计数，勿手写旧 81/93
- **当前已加载勿动：**  
  `…/ResumeQuickFill-Dev/resume-autofill-dev/dist/edge-internal-v0.1.4.9-20261017-003753/extension`  
  （同步孪生 `011002`；`service_worker` = `src/background/worker.mjs`，**无** `src/license/`）
- 加载步骤：见 `INSTALL_INTERNAL.md`（Edge → 扩展 → 加载解压缩的扩展 → 指向上述 `extension` → 修改后点「重新加载」）。

### 付费包（另树，不覆盖 003753）

- 构建（**需**自有 `https://` 校验地址，勿编造域名）：  
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-paid.ps1 -LicenseServiceUrl 'https://<你的域名>'`
- 可选：`-PublicKeyPemPath <公钥.pem> -RequireSignedEntitlement`
- 输出：`dist/edge-paid-v…`（含 `guard-worker.mjs`、中文「授权激活」页）
- **禁止**：把内部试用目录指到 `guard-worker.mjs`，或把内部 ZIP 当「授权版」发给客户。

## 本月明确不包含

| 不包含 | 原因 |
| --- | --- |
| 多招聘站 / 全站通用填写 | 窄版只 CMS+GTH |
| 完整 DRM / 内核驱动 / 硬件指纹刮取 | 见 `ANTI_RESALE.md`；只做授权闸 + 绑定草图 |
| 支付托管 / 商户密钥 / 真实下单发码 | **等 Jeremy 选定域名与支付方**；树内不发明凭证 |
| 生产 license 域名 | 付费脚本只嵌入你提供的 URL |
| 法律 ToS / 席位退款文案 | 代码范围外 |
| 把 `src/license/` 打进内部 96 文件包 | `build-internal.ps1` 白名单排除；003753 保持试用 |

## 验收清单（短）

完整表：根目录 **`验收清单.md`**（中文）。

| 类 | 内容 |
| --- | --- |
| **已举证** | CMS 两端 live；实习 fill 序列化；GTH fill-wo-save + **多段 fill-wo-save**；付费冒烟；fail-closed；`CMS_BASIC`/`GTH_*` auto 脚手架（不抬整数 % 除非另有 live）→ 窄版约 **85%** |
| **Jeremy 侧** | 生产 HTTPS/支付/签发钥；可选 GTH 登录多段（学校 filled-row preexisting 已举证） |
| **政策暂缓** | GTH Save |

窄版验收整数 % 与一行口径：`PROGRESS_2026-10-17.md` →「窄版验收 %」。

## 相关文件

- 安装一页纸：`INSTALL_INTERNAL.md`
- 授权现状：`LICENSE_STATUS.md` / `ANTI_RESALE.md`
- **Jeremy 生产 15% 必供清单：** `LICENSE_JEREMY_CHECKLIST.md`（域名/支付/钥；未完成）
- 验收清单：`验收清单.md`
- CMS live 清单：`CMS_EDUCATION_CLOSEDLOOP.md`
- 今日进度：`PROGRESS_2026-10-17.md`
- CMS 实习 auto：`src/auto/cms-internship-auto.*` / `scripts/auto-cms-internship.mjs`（默认 readiness，不写站）
