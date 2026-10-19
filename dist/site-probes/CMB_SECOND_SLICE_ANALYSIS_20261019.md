# 招行第二拍字段优先级分析 · 2026-10-19（Asia/Shanghai）

**状态**：离线分析草稿。招行 **没有** 已支持。没有 live 填写。SW / popup **没有** 接线。**永不** 点保存或提交。  
**2026-10-19 补记**：体重 offline 已落地。是否参加过正式工作 offline radio 已落地（对齐性别：`.ant-form-item` 标签作用域；字段图 是/否；`--live` 拒 `live_formal_work_radio_unharvested`；未改 emptyProfile；Never Save；套件 37/37）。婚姻、政治面貌、民族、出生日期仍缺 live 选项，不在本刀。未宣称已支持招行。验收仍 **85%**。下文「本拍不填是否参加过正式工作」是落地前的分析，以本句为准。  
**本文件不写** 扩展替装，不改 `cmb-basic.js`，不把招行逻辑塞进 CMS / GTH。  
**输入**（只读仓库已有材料）：

- `dist/site-probes/cmb-field-map-20261019.md` / `.json`（CDP bodyText 标签；未点保存）
- `dist/site-probes/CMB_SECOND_SLICE_PLAN_20261019.md`（第二拍计划；性别、身高 synthetic 补记）
- `dist/site-probes/CMB_NEXT.md` · `CMB_FINGERPRINT_REFRESH_20261019.md` · `_cmb-js-class-hints-20261019.txt`
- `dist/site-probes/_raw-cmb-20261019/main.02cda64a.css`（公开样式；用来核对类名在不在，**不是** 登录后的表单 DOM）
- `src/content/cmb-basic.js` · `src/content/cmb-profile-map.mjs` · `src/profile/store.js` 的 `emptyProfile`
- 对照：`src/content/citics-basic.js` 的 allowlist 与 `FLAT_SELECT_MAX_OPTIONS=24`。中信选项 **不是** 招行选项。

**页**：`https://career.cmbchina.com/center/resume`  
**栈**：自建 React + ant-design（`main.d37c8446.js` / `main.02cda64a.css`）。**不是** hotjob。公开 HTML 是 `#root` 空壳，没有服务端渲染出的字段。

---

## 0. 现在代码里有什么

| 标签 | 代码现状 | 还缺什么 |
| --- | --- | --- |
| 姓名 / 手机号 / 邮箱 | 第一切片 offline scaffold | live 结构未采 |
| 性别 | `fillGender` + 合成 fixture 已在本分支 | live radio DOM 未采；`--live` 拒绝（`live_gender_radio_unharvested`） |
| 身高 | `fillHeight` + 同一 fixture 已在本分支 | live 标签精确串未采；`--live` 拒绝（`live_height_text_unharvested`） |
| 体重 | `fillWeight` + 同一 fixture 已在本分支。只写数字公斤 | live 标签精确串未采；`--live` 拒绝（`live_weight_text_unharvested`）。未宣称已支持招行 |
| 是否参加过正式工作 | `fillFormalWork` + 同一 fixture。字段图 是/否。`formalWork` 仅调用方传入 | live radio DOM 未采；`--live` 拒绝（`live_formal_work_radio_unharvested`）。未宣称已支持招行 |
| 出生日期 / 政治面貌 / 民族 / 婚姻状况 | **没有** 实现。`cmb-basic.js` 源码不含这些标签 | 仍需 live 采这四字段。选项或日期格式都没采到 |

合成 fixture 标了 `synthetic-public-css-candidate`。它证明「按公开 CSS 类名搭的最小 HTML 能读回」，**不** 证明登录后的页面长这样。

---

## 1. 第二拍优先级（6 行）

顺序是「下一刀有多安全」，不是页面从上到下。性别、身高、体重，以及是否参加过正式工作，已经有合成填法，仍不要说成 live 完成。婚姻、政治面貌、民族、出生日期仍要 live，选项不在仓库里。  
三个下拉的选项正文，仓库里只有「请选择」。表里的 profile 路径是 **猜测**。`emptyProfile` 顶层只有 `gender` / `birthDate` / `height` 这一类键，**没有** `political` / `ethnicity` / `marital`。本分析不建议加键。

| 标签 | profile 路径猜测 | 控件类型 | 失败模式 | 选择器候选（公开 CSS 或需 live） | 是否依赖登录 |
| --- | --- | --- | --- | --- | --- |
| 性别 | `gender`。顶层已有。值只允许 CDP bodyText 里的「男」「女」 | radio | 点到旁边的「是否参加过正式工作」（是/否）。公开 CSS 有两套单选类，合成 fixture 只盖了其中一套。React 受控重绘会把值清掉 | `.ant-form-item`、`.ant-radio-wrapper`、`.ant-radio`：**公开 CSS 候选**。`.ant-radio-button-wrapper` 也在同一份 CSS，选择器出现次数更多（24 对 8）。男/女到底挂在哪一套：**需 live 确认**。读回沿用合成约定 `input.checked`。`.ant-radio-checked` 只说明 CSS 里有这个类，不当 live 合同 | **是** |
| 身高 | `height`。顶层已有。只存数字厘米，单位留在标签上 | text | 把「CM」写进 value。和「体重 KG」串项。live 标签可能不是 fixture 里的「身高 CM」 | `input.ant-input`：**公开 CSS 候选**（与姓名同一条）。标签是「身高」还是「身高 CM」：**需 live 确认** | **是** |
| 婚姻状况 | 顶层没有这个键。猜测以后走 `customFacts`（问题文本「婚姻状况」）或 `siteOptionMappings`。**不要** 抄中信的「未婚/已婚/离异/丧偶」 | select。bodyText 只有「请选择」，标签带「（可选）」 | 选项没采到就填，等于编选项。可搜索或选项很多就该拒。它也可能不是短的 flat select | `.ant-select`、`.ant-select-selector`：**公开 CSS 候选**。这个字段是否用它们、下拉是否挂到 `body`、有没有搜索框：**需 live 确认** | **是** |
| 政治面貌 | 顶层没有。猜测 `customFacts` 问题「政治面貌」。中信填表键 `political` 只是别的站点的对照，不是招行档案合同 | select。bodyText 只有「请选择」 | 同上：选项未知。搜索重或选项超过 24 应跳过，不要强填 | 同上，`.ant-select` / `.ant-select-selector` 是 **公开 CSS 候选**。绑到「政治面貌」：**需 live 确认** | **是** |
| 民族 | 顶层没有。若以后要做，键名用 `ethnicity`，不用 `nation`（避开国籍）。现在只是猜测，不加 schema | select。bodyText 只有「请选择」 | 全量民族大约 56 项，或打开即可搜，就应拒填。中信合成 fixture 里的 6 个民族 **不是** 招行选项 | 同上。选项规模：**需 live 确认** | **是** |
| 出生日期 | `birthDate`。顶层已有。档案页的 `YYYY-MM-DD` 只是档案校验格式，**不是** 招行页面格式 | 字段图猜 date。公开 CSS 有 picker，**没有** 证据证明这一格用它 | 开面板点日期，和往输入框打字，是两条路。格式未知。面板留下会挡住旁边的格子。读回可能是空的或旧值 | `.ant-picker`、`.ant-picker-input`：**公开 CSS 候选**。这一格用不用、能不能键盘输入：**需 live 确认**。这份 CSS **没有** `.ant-calendar`，不要拿旧日历类来猜 | **是** |

六行都依赖登录：公开页没有表单。标签来自 2026-10-18 已登录 CDP 的 bodyText，节点 HTML 没有存下来。没有会话就做不了下一刀核对。

### 选择器计数（避免把「CSS 里有类」写成「这一格就是这个 DOM」）

提示文件 `_cmb-js-class-hints-20261019.txt` 的 `css_dot_count` 是子串次数（`ant-radio` = 118，与下面「类选择器合计」一致）。  
下面「类选择器次数」是在同一份 `main.02cda64a.css` 里数 `.类名`，短名不会把更长的类吃进去。

| 类名 | 类选择器次数 | 怎么用 |
| --- | --- | --- |
| `.ant-form-item` | 17（子串 163，其余在 `-label` / `-control`） | 公开 CSS 候选。第一切片和性别/身高 fixture 已用。是不是包住第二拍每一格：需 live |
| `.ant-input` | 边界 103（提示文件子串 1099） | 公开 CSS 候选。身高文本走这条 |
| `.ant-select` / `.ant-select-selector` | 61 / 92 | 公开 CSS 候选。三个「请选择」是否用它：需 live |
| `.ant-select-dropdown` | 7 | 公开 CSS 候选。下拉层是否离开 form-item、挂到 `body`：需 live |
| `.ant-select-selection-search` | 12 | 公开 CSS 里有搜索样式。某一格是不是可搜：需 live。不能凭这个类就拒，也不能凭这个类就填 |
| `.ant-radio` / `.ant-radio-wrapper` | 7 / 8 | 公开 CSS 候选。性别 fixture 用的是这一套 |
| `.ant-radio-button-wrapper` | 24 | 公开 CSS 候选，次数比 wrapper 多。性别会不会是按钮式单选：需 live |
| `.ant-radio-group` | 4 | 公开 CSS 候选。live 是否包住性别：需 live |
| `.ant-picker` / `.ant-picker-input` | 合计 picker 类 801；其中 `.ant-picker-input` 31 | 公开 CSS 候选。出生日期是否用：需 live |
| `.ant-cascader-picker` | 18（cascader 相关类合计 120） | 公开 CSS 有级联样式。没有任何个人信息标签被证明是级联。生源地 / 出生地 / 现居住地继续整类不做 |
| `.ant-calendar` | 0 | 这份 CSS 没有。不要当候选 |

CDP 计数：`selects: 0`。原生 `<select>` 基本不存在。下拉若存在，更像自定义 Ant，但登录后的节点仍要现场看。

### 这 6 行故意不收的字段

- 证件类型 / 证件号：页文案写保存后不能再改。误填再被人保存，不可逆。
- 生源地 / 出生地 / 现居住地：bodyText 也是「请选择」，和 flat select 长得像。级联嫌疑。整类不做。
- 招聘信息来源 / 面试期望城市：选项未知，可能很长。
- 是否参加过正式工作：也是 radio。落地前只当性别邻项对照；2026-10-19 起 offline synthetic 可填字段图「是/否」，live DOM 仍未采。
- 体重：offline synthetic 已落地（同身高，只写数字公斤）。见文首补记。仍非 live，未宣称已支持招行。
- 上传、家庭、教育：不在这 6 行里。

---

## 2. 失败模式（对应上表，不另起实现）

1. **锁死字段被误保存**  
   文案：「姓名、证件类型和证件号，简历保存后无法再次修改」。第二拍这 6 行本身不是证件号，但任何实现只要出现保存点击，就会连姓名一起锁死。内容脚本和 harness 继续不查询、不点击「保存」「提交」。

2. **级联被当成普通下拉**  
   生源地 / 出生地 / 现居住地不在上表。见到级联或多段省/市，应拒绝，对标中信籍贯那类 `cascader_refused`。公开 CSS 里有 `.ant-cascader-picker`，只说明样式打包了，不说明这三格就是级联。

3. **下拉可搜或选项太多**  
   政治面貌、民族、婚姻状况都还没有选项全文。中信的守卫是 allowlist + 最多 24 项 + 有搜索框就 `select_search_heavy` 跳过。招行选项表没采到之前，不写填法。民族若接近 56 项，直接跳过。

4. **出生日期两条写路径**  
   可能要点开面板，也可能往 picker 里的 input 打字。格式未知。档案里的 `YYYY-MM-DD` 不能套到页面上。没有一次只读的手动填写记录之前，不交付这个字段的自动化。

5. **单选点错组，或只改 DOM 被 React 清掉**  
   性别旁边是「是否参加过正式工作」。公开 CSS 同时有 `.ant-radio-wrapper` 和 `.ant-radio-button-wrapper`。合成 fixture 假设的是 wrapper + 原生 radio + 共用 `name`。Live 的 Radio.Group 可能没有 `name`，由 React 管选中。对不上就停，返回结构变化，不要改选择器去凑，也不要点第二个组。

---

## 3. 下一刀：只做「性别」

**落地前结论，已被文首补记取代。** 当时只选性别做登录后只读核对。现在性别/身高/体重合成已齐；下一刀需 live 的四字段是婚姻、政治面貌、民族、出生日期。未宣称已支持招行。下面理由保留作当时记录。

理由：

1. 六个里，只有性别的选项文字来自 CDP bodyText（男 / 女），而且本分支已经有合成读回。下一刀是证伪或坐实这套假设，不是从零猜。
2. 同一份公开 CSS 里，`.ant-radio-button-wrapper`（24）比性别 fixture 用的 `.ant-radio-wrapper`（8）更多。不看登录后的那一块 HTML，无法知道该用哪一套。这是上表里最具体、也最容易点错邻项的缺口。
3. 身高的合成填法刚落地，风险主要是单位被写进 value，代码里已经拒了带 CM 的值。它的 live 标签仍然要采，但排在性别核对之后，不在这一刀。
4. 婚姻状况、政治面貌、民族的选项正文不在仓库里。现在写 fill，就会把中信的选项表当成招行的 DOM。出生日期连页面格式都没有。这四格本刀不动。

这一刀若有人登录并停在 `/center/resume`，只导出「性别」那一个表单项的 HTML。不点保存，不点提交，不打开别的下拉。对得上合成假设再谈以后的 live 读回；对不上就停。本分析不实现这一步。

---

## 4. 和计划文档的差别

`CMB_SECOND_SLICE_PLAN_20261019.md` 把出生日期排在性别后面。本分析把它放到六行的最后：失败模式是日期面板，格式未知，无录制不交付。  
婚姻状况仍是可选对照，排在两个必填感更强的下拉前面，只因为标签写了「（可选）」、且字段图拿它当 flat select 对照。它 **不是** 下一刀。选项没采到之前同样不写代码。

客户口径不变：能说的仍是招商 CMS + 国泰 GTH。招行保持 offline scaffold + 这份草稿。
