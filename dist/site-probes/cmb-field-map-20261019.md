# 招商银行 career.cmbchina.com 字段图 · 2026-10-19（Asia/Shanghai）

**页**：`https://career.cmbchina.com/center/resume`  
**标题**：招商银行招聘  
**方法**：E1 CDP bodyText（2026-10-18）+ 2026-10-19 公开 SPA 指纹刷新；**未**点保存。  
**栈**：自建 React + ant-design（`main.d37c8446.js`）；**非** hotjob；CDP `vue:true` 为误报。

原始计数（CDP）：inputs **71** · textareas **5** · buttons **11** · selects **0**（下拉多为自定义/Ant）。

## 分区（bodyText 顺序）

个人简历/解析上传 · 个人信息 · 自我评价 · 教育经历（从高中） · 家庭情况 · 技能水平 · 实践经历 · 个人荣誉 · 社团活动 · 本人承诺

## 个人信息（标签 · 来自 CDP bodyText）

| 标签 | 控件猜测 | 备注 |
| --- | --- | --- |
| 姓名 | text | **保存后不可再改** |
| 证件类型 | select（「请选择」） | 同上；中国籍优先身份证 |
| 证件号 | text | 同上 |
| 性别 | radio 男/女 | |
| 出生日期 | date | |
| 手机号 | text | 第一切片 |
| 邮箱 | text | 第一切片 |
| 政治面貌 | select | |
| 民族 | select | |
| 体重 KG | text | |
| 身高 CM | text | |
| 生源地 | select/级联 | |
| 出生地 | select/级联 | |
| 招聘信息来源 | select | |
| 面试期望城市 | select | |
| 婚姻状况（可选） | select | |
| 现居住地 | text/级联 | |
| 是否参加过正式工作 | radio 是/否 | |

另：证件照/生活照上传（≤100KB）；PDF 简历解析（≤5M）。

## 建议最小闭环（不保存）

| # | 字段 | 理由 |
| --- | --- | --- |
| 1 | 姓名 | 必填文本；注意保存后锁死 → dry-fill only |
| 2 | 手机号 | 必填文本 |
| 3 | 邮箱 | 必填文本 |

第二拍再考虑：性别 radio → 出生日期 → 政治面貌/民族（flat select）。拒绝：生源地/出生地级联、证件类型（锁死风险高）、上传。

## 不宣称

本文件是字段图输入，**不是**「已支持招行」。JSON：`cmb-field-map-20261019.json`。
