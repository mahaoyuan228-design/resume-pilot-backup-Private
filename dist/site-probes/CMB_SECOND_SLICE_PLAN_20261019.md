# 招行 CMB 第二拍字段计划 · 2026-10-19（Asia/Shanghai）

**状态**：离线分析草稿 — **未**宣称已支持招行；**未** live fill；**未**接线 SW/popup；**永不**点保存/提交。  
**性别补记（2026-10-19）**：offline synthetic 已落地（`cmb-basic.js` `fillGender` + `tests/fixtures/cmb-basic-form.html`）。仍是合成 fixture，**不是** live 支持。  
**输入**：`cmb-field-map-20261019.md` · `EXPAND_CMB_ADAPTER_DESIGN.md` · `CMB_NEXT.md` · `CMB_FINGERPRINT_REFRESH_20261019.md` · `_cmb-js-class-hints-20261019.txt` · 第一切片 `cmb-basic.js` / `cmb-profile-map.mjs`  
**页**：`https://career.cmbchina.com/center/resume` · 栈 React + ant-design（`main.d37c8446.js` / `main.02cda64a.css`）· **非** hotjob  
**第一切片已做**：姓名 / 手机号 / 邮箱（offline scaffold PASS；DOM 合同 CSS-confirmed，live 结构未采）

---

## 1. 第二拍建议字段（最多 6 行）

优先级对齐字段图「第二拍再考虑：性别 radio → 出生日期 → 政治面貌/民族（flat select）」；文本补身高；可选婚姻做 flat select 对照。  
**刻意排除**：证件类型/证件号（保存后锁死）、生源地/出生地/现居住地（级联嫌疑）、招聘信息来源/面试期望城市（选项未知+可能长列表）、上传、家庭/教育整块。

| 标签 | profile 路径猜测 | 控件类型 | 风险 | 是否依赖 live DOM |
| --- | --- | --- | --- | --- |
| 性别 | `gender`（值限「男」「女」） | radio（CDP bodyText「男/女」） | 中：antd Radio 节点结构未采；误点邻项风险 | **是**（synthetic 已绿；live DOM 仍要确认） |
| 出生日期 | `birthDate` | date / `ant-picker`（公开 CSS 候选） | **高**：DatePicker 面板/输入双路径；格式未知；易误触 | **是**（需 live 确认 picker 交互） |
| 政治面貌 | `political`（profile 顶层暂无 → 可能 `customFacts` / `siteOptionMappings`） | select（「请选择」；`ant-select` 公开 CSS 候选） | 中：选项表未采集；可能可搜/长列表 → 对标 CITICS `select_search_heavy` 拒填 | **是**（需 live 选项+结构） |
| 民族 | `ethnicity`（**勿**用 `nation`，避国籍碰撞；对齐 CITICS） | select（`ant-select` 公开 CSS 候选） | 中：全量民族约 56 或 showSearch 则应 skip，勿强填 | **是**（需 live 选项规模） |
| 身高 CM | `height`（已有 profile 顶层键） | text（`input.ant-input` 公开 CSS 候选） | 低：文本；注意标签带「CM」单位后缀，勿把单位写入 value | 部分（选择器公开 CSS 候选；live 标签精确串待确认） |
| 婚姻状况（可选） | `marital`（对齐 CITICS allowlist） | select（标签含「可选」；`ant-select` 公开 CSS 候选） | 低–中：flat select 若选项少可做；级联/搜索则拒 | **是**（需 live 确认 flat vs 其他） |

### 选择器候选（仅候选 · 勿当成 live 合同）

| 用途 | 候选 | 证据等级 |
| --- | --- | --- |
| 表单项容器 | `.ant-form-item` | **公开 CSS 候选**（`main.02cda64a.css` 中 `ant-form-item` 点类计数 163） |
| 标签 | `.ant-form-item-label, label` | **公开 CSS 候选**（同 CSS；第一切片已用之） |
| 文本框 | `input.ant-input`（+ text/tel/email 回退） | **公开 CSS 候选**（`ant-input` 点类 1099） |
| 下拉 | `.ant-select` / `.ant-select-selector` | **公开 CSS 候选**（`ant-select` 点类 761）；**需 live 确认** 是否挂在同 form-item 内、是否 portal 到 body |
| 日期 | `.ant-picker` / `input` 于 picker 内 | **公开 CSS 候选**（`ant-picker` 点类 801）；**需 live 确认** |
| 单选 | `.ant-radio` / `.ant-radio-wrapper` | **公开 CSS 候选**（`ant-radio` 点类 118）；**需 live 确认** 男/女 option 文本与 checked 读回 |

> CDP 2026-10-18：`selects: 0` → 原生 `<select>` 几乎不存在，下拉多为自定义 Ant。公开 HTML 为 SPA `#root` 壳，**无 SSR 字段**；登录后表单结构仍 **需 live 确认**。

### 本拍明确不做

- 证件类型 / 证件号（锁死字段；比中信更忌误填后保存）
- 生源地 / 出生地 / 现居住地（级联嫌疑）
- 招聘信息来源 / 面试期望城市（选项未知）
- 是否参加过正式工作（可留第三拍；radio 但业务语义弱于性别）
- 体重（fixture 邻项已占；profile 无 `weight` 顶层键 — 若要做需先扩 profile 或走 customFacts，本拍不排）
- 任何「保存」「提交」点击；真站策略仍 **fill-wo-save**

---

## 2. 五条失败模式

1. **锁死字段误填后被用户保存**  
   页文案：「姓名、证件类型和证件号，简历保存后无法再次修改」。第二拍若误扩证件* 或实现里出现保存点击，会导致不可逆脏写。对策：内容脚本/harness **永不**查询点击「保存」「提交」；证件* 继续拒绝；姓名仅 dry-fill。

2. **级联地区被当成 flat select**  
   生源地 / 出生地 / 现居住地 bodyText 带「请选择」，易与 flat Ant Select 混淆。对策：第二拍 **整类拒填**；detect cascader/多段「省/市」文案即 `cascader_refused`（对标 CITICS 籍贯/生源地 refused）。

3. **Ant Select 搜索重 / 选项爆炸**  
   政治面貌、民族、面试期望城市等可能 `showSearch` 或选项 ≫ 24。对策：沿用 CITICS 守卫 — allowlist-only + `FLAT_SELECT_MAX_OPTIONS` + `select_search_heavy` skip；**勿强填**；选项表未 live 采集前只出计划不写生产 fill。

4. **DatePicker（出生日期）双路径写败**  
   `ant-picker` 可能要开面板点日，或往内部 input 打字再 blur；格式（YYYY-MM-DD vs YYYY/MM/DD）未知。失败表现：读回空/旧值、面板残留遮挡邻项。对策：无 live 录制前不交付出生日期自动化；交付时必须有读回断言且 Never Save。

5. **Radio / 邻项串扰 + SPA 重渲染丢值**  
   性别与「是否参加过正式工作」同为是/否或男/女类控件；错误 `querySelectorAll` 可能点到错误 group。React 受控组件若只改 DOM 不派发正确事件，重渲染会清空。对策：按 `.ant-form-item` 标签精确锁定一项；fill 后读回；synthetic fixture 先绿再谈 live。

---

## 3. 回归检查清单（改招行时绝不能破坏 CMS / GTH）

1. **路径隔离**：`isCmbHost` / `isCmbResumeEditPath`（及未来 `isCmbResumeEditPage`）在 `wecruit.hotjob.cn`（招商证券 CMS）与 `hr.gtht.com`（国泰 GTH）上必须为 **false**；勿把 `career.cmbchina.com` 逻辑并入 `cms-*` / `gth-*`。
2. **文件与全局名隔离**：新增逻辑仅落 `cmb-*`（如 `cmb-basic.js`、`ResumeCmbBasic`）；`tests/cmb-basic.test.mjs` 已断言源码不含 `cms-|gth-|ResumeCitics|atsx-form` 等串 — 第二拍扩字段时此断言须继续 PASS。
3. **授权闸门不变**：招行动作不得削弱现网 fail-closed；未授权不得自动填 CMS/GTH；勿为招行临时打开 `<all_urls>`。
4. **Manifest / 注入面**：`host_permissions` 仅追加 `https://career.cmbchina.com/*`（若尚未加）；不得改 CMS/GTH content_scripts matches；SW 接线 `CMB_*` 时不得复用/改写 `CMS_BASIC_AUTO` / `GTH_*` 消息名语义。
5. **测试门禁**：改招行前/后跑 `node --test tests/cmb-basic.test.mjs`（性别 synthetic 之后期望 11/11，含原先 8 条）以及现有 CMS/GTH 相关测试（至少 `cms-basic-auto.test.mjs`、`gth-basic-auto.test.mjs` 不因招行改动变红）；**不要**为凑绿改测试断言。

---

## 4. 需 live 确认项（材料不足处 · 仍可审阅）

| # | 项 | 为何不足 | 建议 harvest |
| --- | --- | --- | --- |
| L1 | `.ant-form-item` 是否包裹第二拍全部个人信息控件 | 仅公开 CSS + CDP bodyText 标签；登录后 DOM 未采 | Jeremy 登录停在 `/center/resume`，导出各标签对应 outerHTML |
| L2 | 性别 radio 的 DOM（`ant-radio` vs 原生） | CSS 有 `ant-radio`，无 live 节点 | 采「性别」item 内 input/label |
| L3 | 出生日期是否 `ant-picker`、可键盘输入否 | CSS 有 `ant-picker`，无交互证据 | 录一次手动填写与读回值格式 |
| L4 | 政治面貌 / 民族 / 婚姻状况 选项全文与是否可搜 | bodyText 仅「请选择」 | 打开下拉截 options；若 >24 或有 search input → 标 skip |
| L5 | 身高标签精确串（「身高」「身高 CM」）与 value 是否含单位 | 字段图写「身高 CM」 | 读 label 文本与空控件 placeholder |
| L6 | 保存后姓名/证件是否变为 disabled/只读 | 文案有锁死提示，DOM 态未知 | 若已保存过的账号，确认第一切片对锁死控件应 skip 而非覆写 |

**阻塞**：无登录会话则无法完成 L1–L6；对外口径仍仅 **CMS + GTH** 可卖；招行保持 offline scaffold + 本计划草稿。

### 性别 synthetic 假设（不阻塞登录）

公开 CSS 只有类名计数（`ant-radio` 点类 118），没有登录后的 radio 树。因此用最小合成 HTML，**不**把它写成 live 合同：

1. 「性别」是单独一个 `.ant-form-item`，标签文本恰好为「性别」（避免点到邻项「是否参加过正式工作」）。
2. 选项是 `label.ant-radio-wrapper`，去掉 `.ant-radio` 后文本恰好为「男」或「女」。
3. wrapper 内有 `.ant-radio` 和原生 `input[type=radio]`。读回用 `input.checked`，不用未证实的 `.ant-radio-checked`。
4. 同一项里的 radio 共用 `name`，只为让浏览器取消另一项。Live Ant Radio.Group 可能无 name、由 React 受控 — **未核实**。
5. 结构不是「恰好两个、男+女、各自有 `.ant-radio` 与 radio input」时返回 `radio_structure_changed`，不乱点。
6. 运行：`node scripts/auto-cmb-basic.mjs --only 性别`。`--live` 直接拒绝（`live_gender_radio_unharvested`）。Never Save。

L2 仍然开放：需要登录后的「性别」item outerHTML，才能把上述假设收成 live 合同。

---

## 5. 与第一切片关系

| 项 | 第一切片 | 第二拍（本文件） |
| --- | --- | --- |
| 字段 | 姓名 / 手机号 / 邮箱 | 性别 **offline synthetic**；其余 5 行仍未实现 |
| DOM 合同 | CSS-confirmed text | 性别 fixture = 公开 CSS **候选**（非 live）；picker/select 仍只是候选 |
| SW/popup | 未接线 | **仍不接线**（本分析不写工程替装） |
| 保存 | Never Save | Never Save |
| 客户口径 | 未支持 | **仍未支持** |

---

## 6. 证据索引

- `dist/site-probes/cmb-field-map-20261019.md` / `.json`
- `dist/site-probes/CMB_FINGERPRINT_REFRESH_20261019.md`
- `dist/site-probes/_cmb-js-class-hints-20261019.txt`
- `EXPAND_CMB_ADAPTER_DESIGN.md` · `dist/site-probes/CMB_NEXT.md`
- 对照拒绝样本：`dist/site-probes/CITICS_ANT_SELECT_REFUSED_20261018.md`
