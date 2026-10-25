# 内部试用包安装与本地资料核对

更新：2026-10-25（Asia/Shanghai）；历史功能说明日期2026-10-17。
版本：**0.1.4.9** 试用 · `worker.mjs`（授权闸 **关**）

## 1. 选择完整且身份已核的内部包

只使用本次交付清单指定的完整内部目录，常见形式如下；占位符表示你实际收到的目录，不是终端命令：

```text
<完整交付目录>/internal-extension/
<完整内部ZIP的解压目录>/
```

选择的这一层必须直接包含 `manifest.json`，并同时有清单中的全部 `src/` 文件；不要选 ZIP、源码根、交付上一级或不完整的旧开发目录。内部包和付费包不混用。

本次已核批次是 Git `4597bdb34481f4c3204ceb17ca370f880d7fceaa`，对应内部包 **133文件**。这个计数只适用于该批次，不是未来版本的固定文件数。对应原内部 ZIP SHA256：

```text
6bdde47b88ee0b8b803d5dd3df168675690d39d7cd5f15d5350b95b9eabc79c8
```

交付者应先核外层 `handover-manifest.json` 的来源提交、`internalFiles` 精确路径/字节/hash集合、`internalFileManifestSha256` 和 `internalZip`，再比实际软件目录/ZIP；不靠“有几个文件”代替完整核对。名称「简历快填 · 试用版」和版本 `0.1.4.9` 只是辅助核对，旧包也用该版本，不能单独证明装对。133文件清单 SHA256 为 `00db49afaeafd32fe1cd92d90ea424673af2835a8ea91a7c7fb17e39849b37c6`。

旧 **003753 / 011002** 是历史包，不是本批次入口；旧开发镜像或 `TIP_SHA.txt` 也不能证明它已完整更新。不要往已加载旧包复制几个文件后重载。新构建应以完整新产物及其独立身份核验交付，保留旧包作历史记录。

### 正常安装界面

1. 使用允许的正常 Edge 扩展管理界面。由电脑工具代操作时，在具体安装动作前完成工具要求的**当时确认**；不把它扩大为对已授权合成测试的新审批。
2. Edge → `edge://extensions/` →「开发人员模式」→「加载解压缩的扩展」，选上面身份已核的完整目录。安装前须能排除覆盖旧实例；不能证明就停止。
3. 核对精确加载路径、新扩展ID/独立资料命名空间，并保证本次只有该新实例可动作。换目录本身不证明隔离，不读取、导入、删除或清空旧实例资料。
4. 从该新实例点「我的资料库」，必须为空。出现原资料或来源不明的记录就停止，不以覆盖或清空来继续。

### 本地资料核对与招聘网站保存不同

在空测试资料库中，经「我的资料库」→「工作与实习」→「＋ 添加工作／实习经历」，逐项输入独立预冻结的虚构测试资料；不从招聘网页现值反造答案。勾选「我已逐项核对本页内容，确认可以用于招聘表格」→「确认本页资料」，等「草稿已保存在本机」，关闭后从同一新实例重开，核对内容及已核对状态仍保留。保存失败/冲突就停；只存草稿不自动成为已核对。

本批次薪资链测试使用虚构 `13791` 元/月；即使UI标签写“可不填”，该次测试缺失工资就不能验证工资链，其它工作必需项也不能省略。此金额不是任何人的真实工资。原弹窗仍保留“薪资控件尚未支持”的历史文案，不能据此判断包版本或验收成功。

上述保存只发生在新扩展的本机资料库，**不等于招聘网站保存或网站功能验收**。当前本批次尚未安装/真用，网站新增/试填仍待允许工具、唯一目标与完整单记录守卫的技术门；不要按历史auto或全表脚本直接试填。当前网址核验停止不能用其它surface或raw CDP绕过。

后续受控试验仍须 Never-Save：不覆盖不同值、不勾重新填写；整条目标全空或完全同值前检独立通过，未知非GET请求先阻断后停止。结束时在守卫下使用该记录的原生「取消」，核对编辑器/面板闭合、记录结构恢复及请求/ACK清洁；取消不闭合就留失败，不能删DOM、刷新或强制关闭伪造恢复。不得点击网站保存、提交、投递或删除。

软件交付或本地验证成功均 +0；本批次没有新增CMS/GTH支持宣称，`liveSupportClaimed=false`。下面保留的是历史入口/许可说明，不是本批次的网站执行清单。

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
Set-Location '<完整且已核提交的 Git 工作目录>'
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-internal.ps1
```

- 从已核提交的完整Git工作目录构建。文件集合以该提交的 `WHITELIST.json` `productPaths`、构建脚本及本次产物清单精确核对；不要沿用历史96文件或把本批次133当作永久常量。内部包仍**排除**全部 `src/license/`。
- 每次构建新建 `dist/edge-internal-v0.1.4.9-<UTC戳>/`，**不覆盖**旧目录（含 003753）。
- 产物：`extension\`、`resume-autofill-edge-v0.1.4.9.zip`、`SHA256SUMS.txt`。
- 用完整新 `extension` 目录及本次清单重新核身份后，按第1节安装；不把零散变更同步到旧003753再重载，也不把源码目录当作运行包。

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
| 历史003753/011002 | 留存对照，不是本批次入口 | 勿把内部目录改指 guard-worker |
| 宣称 | 试用 / 开发 | 未激活则中文拦截；**不是**完整 DRM |

改产品码后须完整构建、按精确清单/hash核验并交付新目录；同为 **0.1.4.9** 不证明源版本相同，不推荐旧目录增量拷贝重载。

## 7. 你会撞到的验收缺口（非软件代办）

以下 **85%** 来自2026-10-17历史记录（见 `验收清单.md` / `PROGRESS_2026-10-17.md`），不是当前商业分数或本批次真用结论。保留历史缺口与许可资料，**代理不会编造**：

| 缺口 | 你在 UI 上会看到 | 你需要做什么 |
| --- | --- | --- |
| **实习日期 + 已核对** | `internship_record_not_ready`：缺完整 YYYY-MM-DD，或公司/岗位/描述等未勾「已核对」 | 在资料库补全起止日期并勾选已核对；软件**不会**填空日期 |
| **CMS 学校映射（空行）** | 空行 skipped；中文提示「故意不点创建 / no sole-create」；已有行 preexisting 可 verified | 空行可选「网站选项对应」短名；**勿**指望软件 sole-create |
| **GTH 登录（可选多段）** | auto 遇 login wall；多段靠弹窗串行 | 需要时自行扫码登录；不主动要 QR |
| **生产 HTTPS / 支付 / 签发钥**（约 15%） | 付费包需自有校验域；内部试用无激活页 | **填 `LICENSE_JEREMY_CHECKLIST.md`**；选定后再 `build-paid.ps1`；内部试用按第1节选完整包 |
| **GTH Save** | 政策暂缓；auto **永不**点网站 Save | 实站 Save 仅你按文档 one-shot；不要当 bug |

付费包中文激活：弹窗「授权激活」或扩展页 `src/license/activate.html`（**仅** `edge-paid-…`）。未激活 → 填写 fail-closed。

