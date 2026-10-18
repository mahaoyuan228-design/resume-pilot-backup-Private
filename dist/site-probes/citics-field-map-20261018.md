# 中信证券 careers.citics.com 字段图 · 2026-10-18（Asia/Shanghai）

**页**：`https://careers.citics.com/my/jl?resumeType=0&type=edit&name=xiaozhao-cn`  
**标题**：完善简历-总部校园招聘  
**方法**：试用 Edge CDP `9237` · `Runtime.evaluate` 只读；**未**点保存/提交。  
**栈**：自建 Vue + Ant Design Vue（`ant-form-item`）；**非** hotjob/wecruit。易盾脚本在页。

原始计数：inputs 157 · textareas 10 · ant-form-item ≈159 · `label.ant-form-item-required` ≈109。

## 分区（页内顺序）

个人信息 · 联系方式 · 教育经历 · 工作/实习经历 · 证书/技能 · 语言 · 家庭信息 · 其他信息 · 其他个人情况 · 个人声明 · 公司声明

## 个人信息（标签 / 必填 / 控件）

| 标签 | 必填 | 控件 |
| --- | --- | --- |
| 姓 | 是 | text |
| 名 | 是 | text |
| 姓（拼音） | 是 | text |
| 名（拼音） | 是 | text |
| 国籍（国家或地区） | 是 | ant-select |
| 证件类型 | 是 | ant-select |
| 证件号码 | 是 | text |
| 性别 | 是 | ant-radio |
| 出生日期 | 是 | ant-date |
| 民族 | 是 | ant-select |
| 婚姻状况 | 是 | ant-select |
| 政治面貌 | 是 | ant-select |
| 籍贯 | 是 | ant-select |
| 联系地址 | 是 | text |
| 邮编 | 是 | text |
| 现户口所在地 | 是 | ant-select |
| 生源地 | 是 | ant-select |
| 户口类型 | 是 | ant-select |
| 是否同意部门/岗位调配 | 是 | ant-radio |

## 联系方式

| 标签 | 必填 | 控件 |
| --- | --- | --- |
| 手机 | 是 | text |
| 电子邮箱 | 是 | text |
| 确认邮箱 | 是 | text |
| 微信 | 否 | text |
| 紧急联系人 | 是 | text |
| 紧急联系人手机 | 是 | text |

## 建议最小闭环（个人信息 5～8 项，不保存）

| # | 字段 | 控件 | 理由 |
| --- | --- | --- | --- |
| 1 | 姓 | text | 必填纯文本，最易读回 |
| 2 | 名 | text | 必填纯文本 |
| 3 | 证件号码 | text | 必填纯文本；证件类型可先沿用页上已选 |
| 4 | 手机 | text | 联系方式必填文本 |
| 5 | 电子邮箱 | text | 必填文本 |
| 6 | 确认邮箱 | text | 必填；与邮箱同值即可验证写后读回 |
| 7 | 性别 | ant-radio | 第一个非文本控件，验证 Ant Radio 路径 |
| 8 | 出生日期 | ant-date | 可选第 8 项；日期控件单独适配 |

**硬约束**：不点保存/提交；不碰易盾；不上传附件；不改教育及以后分区。成功标准 = 写后 DOM 读回一致 + CMS/GTH 未回归。

**推荐切片**：先做前 6 项纯文本（姓/名/证件号码/手机/电子邮箱/确认邮箱），再加性别 radio，日期作可选第 8 项。

## 其它必填抽样（后续分区，非本切片）

学历/学位、学校名称、院系（中文）、专业类型、培养方式、学制、开始时间、取得毕业证时间、平均学分成绩（GPA）、单位名称、是否是中信证券实习、部门、岗位、有无通过的证券从业资格考试、TOEFL、IELTS、四级、六级、是否有亲属在本公司任职。

## 不宣称

- 本文件是字段图与设计输入，**不是**「已支持中信」。
- JSON：同目录 `citics-field-map-20261018.json`。
