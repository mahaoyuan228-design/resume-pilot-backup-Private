# 招行 CMB 第一切片 · NEXT（2026-10-19）

时区：Asia/Shanghai  
状态：**offline scaffold only** — 未宣称客户可填；未 live fill  
对齐：`EXPAND_CMB_ADAPTER_DESIGN.md` · `cmb-field-map-20261019.md` · `CMB_FINGERPRINT_REFRESH_20261019.md`

## 1. Fingerprint

| 项 | 值 |
| --- | --- |
| `siteId` | **`cmb`** |
| 简历 URL | https://career.cmbchina.com/center/resume |
| 栈 | React + ant-design（`main.d37c8446.js`）；非 hotjob；非 Vue |
| vs 招商证券 | **不同源**（证券=`wecruit.hotjob.cn`） |

## 2. First-slice fields

| 页标签 | Profile | 状态 |
| --- | --- | --- |
| 姓名 | fullName | scaffold + offline synthetic |
| 手机号 | phone | scaffold + offline synthetic |
| 邮箱 | email | scaffold + offline synthetic |
| 性别 | gender（男/女） | **offline synthetic only**。公开 CSS 候选 fixture；**live radio DOM 仍未采** |
| 身高 | height（数字厘米；标签可带 CM） | **offline synthetic only**。公开 CSS 候选 `input.ant-input`；value **不含** CM。**live 标签精确串仍未采** |
| 体重 | weight（数字公斤；调用方传入。标签可带 KG。未写入 emptyProfile） | **offline synthetic only**。公开 CSS 候选 `input.ant-input`；value **不含** KG。**live 标签精确串仍未采** |
| 是否参加过正式工作 | formalWork（是/否；调用方传入。未写入 emptyProfile） | **offline synthetic only**。标签作用域 `.ant-form-item`；选项来自字段图，**不是** live 合同 |

DOM 合同：**CSS-confirmed** `.ant-form-item` / `input.ant-input`（`main.02cda64a.css`）。Live 结构未采。

性别单选 **不是** live 合同。Fixture 只用公开 CSS 候选 `.ant-form-item` / `.ant-radio-wrapper` / `.ant-radio`，并标明 synthetic。读回只在该 fixture 上断言「男」或「女」。`--only 性别` 拒绝 live fill（`live_gender_radio_unharvested`）。**未**宣称已支持招行。

身高文本 **不是** live 合同。同一 fixture 上复用 `.ant-form-item` + `input.ant-input`（公开 CSS 候选）。标签可以是「身高」或带 CM 后缀（字段图写「身高 CM」）。读回只有数字，**不**把 CM 写入 value。`--only 身高 --live` 拒绝（`live_height_text_unharvested`）。**未**宣称已支持招行。

体重文本 **不是** live 合同。同一 fixture 上复用 `.ant-form-item` + `input.ant-input`（公开 CSS 候选）。标签可以是「体重」或带 KG 后缀（字段图写「体重 KG」）。读回只有数字公斤，**不**把 KG 写入 value（`60kg` / `60KG` 拒填）。`--only 体重 --live` 拒绝（`live_weight_text_unharvested`）。**未**宣称已支持招行。

是否参加过正式工作 **不是** live 合同。同一 fixture 上按标签锁一个 `.ant-form-item`，选项只有字段图里的「是 / 否」。读回是 `input.checked`。`--only 是否参加过正式工作 --live` 拒绝（`live_formal_work_radio_unharvested`）。**未**宣称已支持招行。

## 3. How to run

```bash
MODE=readiness node scripts/auto-cmb-basic.mjs --synthetic
MODE=fill node scripts/auto-cmb-basic.mjs --synthetic
node scripts/auto-cmb-basic.mjs --only 性别
node scripts/auto-cmb-basic.mjs --only 身高
node scripts/auto-cmb-basic.mjs --only 体重
node scripts/auto-cmb-basic.mjs --only 是否参加过正式工作
node scripts/auto-cmb-basic.mjs --only 婚姻状况
node scripts/auto-cmb-basic.mjs --only 政治面貌
node scripts/auto-cmb-basic.mjs --only 民族
node scripts/auto-cmb-basic.mjs --only 证件类型
node scripts/auto-cmb-basic.mjs --only 学历
node scripts/auto-cmb-basic.mjs --only 出生日期
node --test tests/cmb-basic.test.mjs
```

证据：`dist/auto-runs/cmb-basic-{readiness|fill}-latest.json`  
**Never Save**。SW/popup **未**接线（`--extension` → refused）。

## 4. Live blockers

Jeremy 登录招行招聘账号并停在 `/center/resume` 后，才能 harvest live DOM 再 fill-wo-save。

## 5. Safety

- Never 保存/提交（姓名/证件保存后锁死）。  
- Fail-closed profile。  
- 不改 cms/gth/citics。  
- 对外仍仅 CMS + GTH 可卖。

## 6. Second-slice plan

离线分析草稿（SW/popup 未接线；未宣称已支持招行；Never Save）：`dist/site-probes/CMB_SECOND_SLICE_PLAN_20261019.md`。

其中 **性别**、**身高**、**体重** 与 **是否参加过正式工作** 已有 offline synthetic。婚姻状况 / 政治面貌 / 民族另有采到的中文名+code 离线 Select；出生日期只记 DatePicker 提示。这些合成 **不是** live 支持。

体重 offline 已落地（同身高：`.ant-form-item` + `input.ant-input`；只写数字公斤；拒 `60kg`/`60KG`；`--live` 拒 `live_weight_text_unharvested`；套件 34/34；Never Save）。是否参加过正式工作 offline radio 已落地（对齐性别：标签作用域 `.ant-form-item`；字段图 是/否；`--live` 拒 `live_formal_work_radio_unharvested`；未改 emptyProfile；Never Save；套件 37/37）。未宣称已支持招行。验收仍 **85%**。

下一刀 live 采数顺序见 `CMB_LIVE_GATED_FIELDS_DRAFT_20261019.md`：婚姻状况 → 政治面貌 → 民族 → 出生日期。这四字段的真实选项不能离线合成。未宣称已支持招行。验收仍 **85%**。

2026-10-19 live gated 四字段已采齐（`CMB_LIVE_GATED_HARVEST_20261019.md`，Never Save）。婚姻状况 / 政治面貌 / 民族已按采到的中文名+code 做离线合成 Select；出生日期只记 DatePicker kind+填法提示，未硬编假 DOM，未 live 填。未宣称已支持招行。验收仍 **85%**。

完整 getCommonDictMap 摘要见 `CMB_DICTMAP_FULL_20261019.md`（Never Save）。gated 四字段已完成。证件类型 IdCardType 已按 15 项中文名+code 做离线合成 Select。DOM 已采到：`#resume_basicInfo_idCardType` / `resume_basicInfo_idCardType_list`，selectClass 无 show-search（见 `CMB_IDCARDTYPE_DOM_20261019.md`）。选项和 DOM 都已采到，但 live 点击尚未证明，所以 `--live` 仍拒 `live_id_card_type_select_fill_unclaimed`，与婚姻状况同一惯例。同页证件号 `#resume_basicInfo_idCard` 是文本，本刀不填。未宣称已支持招行。验收仍 **85%**。

剩余字典 DOM 见 `CMB_REMAINING_DOM_20261019.md`（Never Save，67 个 resume_* id）。学历 Education 已按字典中文名+code 做离线合成 Select，只接教育经历第 0 行 `#resume_educationHistoryList_0_educationLevelCode`；剔除占位 `ED000`（博士后）。`--live` 仍拒 `live_education_level_select_fill_unclaimed`。学校名称等同行控件不填。下一刀顺序建议：RelationshipType → AwardsLevel → EnglishLevel。InterviewCity / ChannelType 可延后。RankingMajor 当前简历页无控件。未宣称已支持招行。验收仍 **85%**。

裁剪笔记 `CMB_DICT_REMAINING_TRIM_20261019.md`（Never Save）与上面交叉。下一刀从 RelationshipType 起，顺序 RelationshipType → AwardsLevel → EnglishLevel → ChannelType → InterviewCity。RankingMajor 记 `DOM_CONTROL_MISSING`，不猜 selector。Education 已落地，不重做。未宣称已支持招行。验收仍 **85%**。

关系类型 RelationshipType 已离线接线。`#resume_familyList_0_relationship` 与 `#resume_familyList_1_relationship` 各自绑定，索引隔离，不把一行的值写到另一行。选项是字典 8 项（RT0001–RT0008），无占位可剔。简称「父」「其他」拒填。家庭姓名和电话不填。`--only 关系类型 --live` 拒 `live_relationship_select_fill_unclaimed`。Never Save。未宣称已支持招行。下一刀 AwardsLevel。

获奖级别 AwardsLevel 已离线接线，只接第 0 行 `#resume_awardList_0_awardLevel`。选项是字典 5 项（院校级 AL002、县市级 AL003、省区级 AL004、国家级 AL005、国际级 AL006）。字典里没有「请选择」或 AL000/AL001，没有可剔的占位。级别不从奖项名称推断；「国家级奖学金」「国家」拒填。奖项名称和获奖时间不填。`--only 获奖级别 --live` 拒 `live_award_level_select_fill_unclaimed`。Never Save。未宣称已支持招行。下一刀 EnglishLevel。

最高英语水平 EnglishLevel 已离线接线，只接技能第 0 行 `#resume_skill_0_englishLevel`。选项是字典 10 项（TOEFL EL001 至其他 EL010）。字典里没有「请选择」或 EL000；`其他` 是真实项，保留。不把托福、雅思、四级或分数换算成考试名。分数控件不填。`--only 最高英语水平 --live` 拒 `live_english_level_select_fill_unclaimed`。Never Save。未宣称已支持招行。ChannelType / InterviewCity 仍可延后。RankingMajor 仍是 `DOM_CONTROL_MISSING`。

招聘信息来源 ChannelType 已离线接线，控件 `#resume_basicInfo_channelType`。选项是字典 15 项，名称和 code 保持原样，不做模糊归并。字典里没有「请选择」或 CT000；`其他`（CT0016）是真实项，保留。带引号的 `"招商银行招聘"微信公众号`（CT002）按原文匹配；「微信」「官网」「智联」拒填。`--only 招聘信息来源 --live` 拒 `live_channel_type_select_fill_unclaimed`。Never Save。未宣称已支持招行。下一刀 InterviewCity。RankingMajor 仍是 `DOM_CONTROL_MISSING`。

面试期望城市 InterviewCity 已离线接线，控件 `#resume_basicInfo_expectedInterviewCity`。选项是字典 44 个完整城市名，从北京市（P00271）到重庆市（P00291）。没有「请选择」。简称「北京」「上海」「重庆」不匹配带「市」的全称。`--only 面试期望城市 --live` 拒 `live_interview_city_select_fill_unclaimed`。Never Save。未宣称已支持招行。RankingMajor 仍是 `DOM_CONTROL_MISSING`，本刀不做。

剩余 dict 离线 Select 除 RankingMajor（`DOM_CONTROL_MISSING`）外已齐。下一阻塞是 live 点击证据。已接线的 Select 各自仍拒：`live_marital_select_fill_unclaimed`、`live_politics_select_fill_unclaimed`、`live_ethnicity_select_fill_unclaimed`、`live_id_card_type_select_fill_unclaimed`、`live_education_level_select_fill_unclaimed`、`live_relationship_select_fill_unclaimed`、`live_award_level_select_fill_unclaimed`、`live_english_level_select_fill_unclaimed`、`live_channel_type_select_fill_unclaimed`、`live_interview_city_select_fill_unclaimed`。Never Save。未宣称已支持招行。

live 点击证据 10/10 已入库：`CMB_LIVE_SELECT_CLICK_EVIDENCE_20261019.md`。关系 id 为 `resume_familyList_0_relationship` 与 `resume_familyList_1_relationship`。英语 id 为 `resume_skill_0_englishLevel`。获奖 id 为 `resume_awardList_0_awardLevel`。民族 `showSearch: true`。学历保留 live「博士后」。证据在时，这 10 个字段的 `--live` 不再因 `live_*_select_fill_unclaimed` 退出，改为在已打开的 `/center/resume` 上做 CDP inject fill-wo-save，不点保存。没有试填 Edge 时原因是 `live_cdp_unavailable`。`formFillClaimed` 仍为 false。Never Save。未宣称已支持招行。RankingMajor 仍是 `DOM_CONTROL_MISSING`。
