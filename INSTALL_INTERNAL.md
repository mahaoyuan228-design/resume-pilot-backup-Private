# 内部包安装一页纸（Edge · 003753）

日期：2026-10-17（Asia/Shanghai）  
版本：**0.1.4.9** 试用 · `worker.mjs`（授权闸 **关**）

## 1. 加载 / 重新加载解压缩扩展

1. 打开 Microsoft Edge → 地址栏 `edge://extensions/` → 打开「开发人员模式」。
2. 若尚未加载：点「加载解压缩的扩展」，选中：

   ```text
   C:\Users\admin\Desktop\ResumeQuickFill-Dev\resume-autofill-dev\dist\edge-internal-v0.1.4.9-20261017-003753\extension
   ```

3. 若已加载该目录：源码同步进 **003753/extension** 后，在扩展卡片点 **「重新加载」**（不要另开新目录，除非刻意换包）。
4. 核对卡片：名称含「试用」、版本 `0.1.4.9`。不要加载 `edge-paid-…` 或含 `guard-worker.mjs` 的目录做日常 live。
5. 孪生目录 `…-011002\extension` 仅作备份/对照；日常 live 以 **003753** 为准。

## 1b. Auto 脚手架（默认 readiness，永不 Save）

| Auto | 用途 | 备注 |
| --- | --- | --- |
| `CMS_BASIC_AUTO` / `cms-basic-auto.html` | 个人基本信息必填 | 亦可 `cms-education-auto.html?mode=basic_*`；fill 需已确认 customAnswers |
| `CMS_INTERNSHIP_AUTO` / `CMS` 教育 auto | 实习 / 完整教育 | 见专区文档 |
| `GTH_BASIC_AUTO` / `GTH_SIMPLE_AUTO` / `GTH_OTHER_AUTO` / `GTH_INTENT_AUTO` | 基本信息 / 技能 / 其他信息 / **求职意向** | 默认 readiness；fill-wo-save；Never Save |

## 2. CMS 教育：顶部「填写并读回」vs「完整教育经历」

| 入口 | 在哪 | 会做什么 | 何时用 |
| --- | --- | --- | --- |
| **填写并读回**（顶部主按钮） | 弹窗上方「当前网站」区 | 通用字段识别与填写；**不会**填教育专业等教育多段字段 | 基本信息等非「完整教育」路径 |
| **完整教育经历**（下方专区） | 同页滚动到 `<h2>完整教育经历`（由 `cms-education-actions.js` 注入） | 按资料库每段教育绑定网站行并填写+核对 | **CMS 教育闭环 / both-row live** |

两入口互不替代：测教育两端时必须走「完整教育经历」，不要只点顶部「填写并读回」。

## 3. CMS 教育完整点击（both-row live）

前置：已登录招商简历页（`…/pb/resumeOperation.html`）；**Edge 窗口与该标签保持前台焦点**（否则易出现 `page_unfocused`，专业等文字不写）。

1. 打开扩展弹窗 → 确认「当前网站」为招商 CMS。
2. 滚到 **「完整教育经历」**。
3. 点 **「读取教育记录」** → 等待绑定区出现网站行。
4. 为 **两端**（或实际存在的每一行）选择资料库来源；**不要**勾「重新填写这条已有记录」，除非你有意覆盖。
5. 点 **「填写全部选定教育并核对」** 一次。  
   - **不要**点网站保存 / 投递。  
   - 可关弹窗；后台会继续，再开弹窗看进度与字段结果。
6. 读中文结果（两端都要看）：
   - 专业：聚焦时应 verified。
   - 城市 / 排名：verified **或** 明确 `region_*` / `education_option_missing` 等（非空白沉默）。
   - 学校：verified **或** skipped `option_not_found`（可接受）。
   - 描述空：skipped OK。
7. 若 `page_unfocused` / 待核对锁：点回简历标签 → **「我已看过网站，解除锁定」** → 再「读取教育记录」；仍不点网站 Save。

更细的门禁与失败码：`CMS_EDUCATION_CLOSEDLOOP.md`。

## 4. 改代码后如何重建内部包

在 **PC** 开发树根目录（与 `manifest.json` 同级）执行：

```powershell
cd C:\Users\admin\Desktop\ResumeQuickFill-Dev\resume-autofill-dev
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-internal.ps1
```

- 脚本存在且健康：严格 **96** 文件白名单（`WHITELIST.json` `productPaths` 现行计数），与 `WHITELIST.json` `productPaths` / `build-internal.ps1` 一致；**排除**全部 `src/license/`。
- 每次构建新建 `dist/edge-internal-v0.1.4.9-<UTC戳>/`，**不覆盖**旧目录（含 003753）。
- 产物：`extension\`、`resume-autofill-edge-v0.1.4.9.zip`、`SHA256SUMS.txt`。
- 若要让 Edge 用上新构建：要么改「加载解压缩」路径到新 `extension`，要么把变更文件同步进已加载的 **003753\extension** 后点「重新加载」。日常策略：产品改动先进 `resume-autofill-dev\src`，再按需 sync 进 003753；**不要**在未决策时把 license 打进 003753。

付费包（另树）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-paid.ps1 -LicenseServiceUrl 'https://<自有域名>'
```

## 5. 相关

- 窄版定义：`SHIP_NARROW.md`
- 最近 CMS 任务字符串导出（尽力）：`scripts/export-last-cms-job.ps1`

## 6. 付费包 vs 内部包（速查）

| | 内部试用（日常 live） | 付费 ZIP |
| --- | --- | --- |
| 构建 | `scripts/build-internal.ps1` | `scripts/build-paid.ps1 -LicenseServiceUrl 'https://…'` |
| 输出 | `dist/edge-internal-v0.1.4.9-…/extension` | `dist/edge-paid-v…/extension` |
| service_worker | `src/background/worker.mjs` | `src/license/guard-worker.mjs` |
| `src/license/` | **排除** | 含闸门 + 中文激活页 |
| Jeremy 003753/011002 | **只用内部** | 勿把内部目录改指 guard-worker |
| 宣称 | 试用 / 开发 | 未激活则中文拦截；**不是**完整 DRM |

改产品码后：同步进已加载的 `…-003753/extension` → Edge「重新加载」。版本保持 **0.1.4.9** 除非发布决策另定。

## 7. 你会撞到的验收缺口（非软件代办）

窄版已举证约 **85%**（见 `验收清单.md` / `PROGRESS_2026-10-17.md`）。下列项需你本机补齐，**代理不会编造**：

| 缺口 | 你在 UI 上会看到 | 你需要做什么 |
| --- | --- | --- |
| **实习日期 + 已核对** | `internship_record_not_ready`：缺完整 YYYY-MM-DD，或公司/岗位/描述等未勾「已核对」 | 在资料库补全起止日期并勾选已核对；软件**不会**填空日期 |
| **CMS 学校映射（空行）** | 空行 skipped；中文提示「故意不点创建 / no sole-create」；已有行 preexisting 可 verified | 空行可选「网站选项对应」短名；**勿**指望软件 sole-create |
| **GTH 登录（可选多段）** | auto 遇 login wall；多段靠弹窗串行 | 需要时自行扫码登录；不主动要 QR |
| **生产 HTTPS / 支付 / 签发钥**（约 15%） | 付费包需自有校验域；内部试用无激活页 | **填 `LICENSE_JEREMY_CHECKLIST.md`**；选定后再 `build-paid.ps1`；日常仍用 **003753** |
| **GTH Save** | 政策暂缓；auto **永不**点网站 Save | 实站 Save 仅你按文档 one-shot；不要当 bug |

付费包中文激活：弹窗「授权激活」或扩展页 `src/license/activate.html`（**仅** `edge-paid-…`）。未激活 → 填写 fail-closed。

