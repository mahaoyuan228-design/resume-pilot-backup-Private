# CMB full getCommonDictMap summary (2026-10-19)

Never Save. Text and code only. This is not a live fill contract. 招行 is not supported. Acceptance stays **85%**.

Source: GET `/api/socialRecruitmentWebsite/common/getCommonDictMap` on `https://career.cmbchina.com/center/resume`. harvestedAt `2026-10-19T04:35:24.371Z`. httpStatus 200. returnCode `SUC0000`. Cookie value is not stored.

Canonical text+code dump: `dist/site-probes/cmb-dictmap-full-20261019.json`.

Birth date is not in this map. It stays the harvested DatePicker hint (`resume_basicInfo_birthday`, readonly, placeholder 请选择日期). No synthetic datepicker DOM.

## Keys

| key | count | 请选择 | wiring |
| --- | ---: | ---: | --- |
| Nation | 57 | 0 | ethnicity select (offline; harvested DOM id resume_basicInfo_nation) |
| MaritalStatus | 5 | 1 | marital select (offline; 请选择 dropped; harvested DOM id resume_basicInfo_maritalStatus) |
| EnglishLevel | 10 | 0 | unwired |
| Education | 8 | 0 | offline select on row 0; ED000 dropped; `--live` refuses `live_education_level_select_fill_unclaimed` |
| RelationshipType | 8 | 0 | offline select on family rows 0 and 1; indexes stay isolated; `--live` refuses `live_relationship_select_fill_unclaimed` |
| InterviewCity | 44 | 0 | unwired |
| AwardsLevel | 5 | 0 | unwired |
| PoliticalAffinity | 13 | 0 | politics select (offline; harvested DOM id resume_basicInfo_politicalAffinity) |
| IdCardType | 15 | 0 | offline select; harvested DOM id `resume_basicInfo_idCardType` (no show-search); `--live` still refuses `live_id_card_type_select_fill_unclaimed` |
| RankingMajor | 3 | 0 | unwired |
| ChannelType | 15 | 0 | unwired |

## IdCardType (15, no 请选择)

Options used by the offline select. Match is exact Chinese name or exact code. Abbreviations such as 护照 or 签证 do not match. The select id `resume_basicInfo_idCardType` and list id `resume_basicInfo_idCardType_list` were harvested on 2026-10-19. Live selectClass has no show-search. Option-row markup stays a synthetic stand-in, and `--live` still refuses `live_id_card_type_select_fill_unclaimed` until a live click is proven. 证件号 `#resume_basicInfo_idCard` was seen on the same page and is not filled. 招行 is not supported. Acceptance stays **85%**.

- 身份证 (`ID001`)
- 非公务赴台证 (`ID0010`)
- 台胞证 (`ID0011`)
- 签证 1 (`ID0012`)
- 签证 2 (`ID0013`)
- 签证 3 (`ID0014`)
- 其他证件 (`ID0015`)
- 暂住证 (`ID002`)
- 人才居住证 (`ID003`)
- 因公护照 (`ID004`)
- 因私护照 (`ID005`)
- 公务赴港澳长证(多次) (`ID006`)
- 非公务赴港澳长证 (`ID007`)
- 临时赴港澳证 (`ID008`)
- 公务赴台证 (`ID009`)

## Unwired keys

These keys are in the dict map and are not wired. Do not invent their DOM ids.

### EnglishLevel (10)

- TOEFL (`EL001`)
- GRE (`EL002`)
- GMAT (`EL003`)
- IELTS (`EL004`)
- CET-4 (`EL005`)
- CET-6 (`EL006`)
- TEM-4 (`EL007`)
- TEM-8 (`EL008`)
- 海外高中成绩 (`EL009`)
- 其他 (`EL010`)

### Education (8)

- 博士后 (`ED000`)
- 博士研究生 (`ED001`)
- MBA (`ED002`)
- 硕士研究生 (`ED003`)
- 本科 (`ED004`)
- 大专 (`ED005`)
- 中技（中专/技校/职高） (`ED006`)
- 高中 (`ED007`)

### RelationshipType (8)

- 配偶 (`RT0001`)
- 父亲 (`RT0002`)
- 母亲 (`RT0003`)
- 子女 (`RT0004`)
- 紧急联络人 (`RT0005`)
- 兄弟 (`RT0006`)
- 姐妹 (`RT0007`)
- 其他相关人员 (`RT0008`)

### InterviewCity (44)

- 北京市 (`P00271`)
- 长春市 (`C0035`)
- 长沙市 (`C00164`)
- 成都市 (`C00216`)
- 大连市 (`C10002`)
- 东莞市 (`C00194`)
- 佛山市 (`C00182`)
- 福州市 (`C0097`)
- 广州市 (`C00178`)
- 贵阳市 (`C00237`)
- 哈尔滨市 (`C0044`)
- 海口市 (`C00213`)
- 杭州市 (`C0070`)
- 合肥市 (`C0081`)
- 呼和浩特市 (`C0023`)
- 济南市 (`C00117`)
- 昆明市 (`C00246`)
- 兰州市 (`C00279`)
- 南昌市 (`C00106`)
- 南京市 (`C0057`)
- 南宁市 (`C00199`)
- 南通市 (`C0062`)
- 宁波市 (`C0071`)
- 青岛市 (`C00118`)
- 泉州市 (`C0099`)
- 上海市 (`P00281`)
- 深圳市 (`C00179`)
- 沈阳市 (`C10001`)
- 石家庄市 (`C001`)
- 苏州市 (`C0061`)
- 太原市 (`C0012`)
- 唐山市 (`C002`)
- 天津市 (`P00301`)
- 温州市 (`C0072`)
- 乌鲁木齐市 (`C00306`)
- 无锡市 (`C0058`)
- 武汉市 (`C00151`)
- 西安市 (`C00269`)
- 西宁市 (`C00293`)
- 厦门市 (`C00100`)
- 烟台市 (`C00122`)
- 银川市 (`C00301`)
- 郑州市 (`C00134`)
- 重庆市 (`P00291`)

### AwardsLevel (5)

- 院校级 (`AL002`)
- 县市级 (`AL003`)
- 省区级 (`AL004`)
- 国家级 (`AL005`)
- 国际级 (`AL006`)

### RankingMajor (3)

- 前20% (`RM002`)
- 中等 (`RM003`)
- 中下等 (`RM004`)

### ChannelType (15)

- 招商银行官网 (`CT0014`)
- "招商银行招聘"微信公众号 (`CT002`)
- 招商银行员工推荐 (`CT0015`)
- 院校老师推荐 (`CT007`)
- 校园宣讲会 (`CT0012`)
- 学校就业网站 (`CT0010`)
- 校友/朋友推荐 (`CT008`)
- 智联招聘 (`CT0017`)
- 牛客网 (`CT0011`)
- 刺猬实习 (`CT0019`)
- 51job/应届生网 (`CT005`)
- qq群/微信群消息 (`CT009`)
- 猎头 (`CT0013`)
- 一网通 (`CT001`)
- 其他 (`CT0016`)
