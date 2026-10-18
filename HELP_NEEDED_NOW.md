# HELP_NEEDED_NOW — after CMS basic seed-from-education

Date: 2026-10-17 evening (Asia/Shanghai)  
Acceptance stays **85%** (no fake bump).

## What software can auto-seed (no Jeremy invent)

From **confirmed** education row + confirmed education site facts only  
(`seedCmsBasicFromEducation` / options button / `CMS_BASIC_AUTO?mode=seed_from_education`):

| CMS 个人基本信息 | Alias | Source (Jeremy backup dry-run → edu index 4) |
|---|---|---|
| 学位 | `__cms_basic_academic_degree` | educationSiteFacts academicDegree = 硕士 |
| 学历 | `__cms_basic_education_level` | education.4.degree = 硕士 |
| 毕业院校 | `毕业院校` | education.4.school = 悉尼大学 The University of Sydney |
| 专业名称 | `__cms_basic_major` | education.4.major = Finance |
| 毕业时间 | `__cms_basic_graduation_date` | educationSiteFacts endDate = 2026-07-01 |

**One-click (options UI):** 网站补充问题 →「从已核对教育经历填充个人基本信息」  
**Auto page:** `cms-basic-auto.html?mode=seed_from_education` (optional `dryRun=1`)

Never auto-seeds / never auto-confirms: **现居住地、籍贯、国籍/地区、婚姻状况、期望面试地点**.

## Still NEED Jeremy (CMS 个人基本信息 — 5)

Exact question strings (template aliases = question text for these five):

1. **现居住地**
2. **籍贯**
3. **国籍/地区**
4. **婚姻状况**
5. **期望面试地点（供参考，实际安排将根据笔试通过名单确定）**

Notes (no invent):

- Backup has `国籍/地区*` = 中国 and `婚姻状况*` = 未婚 (asterisk keys). CMS readiness keys **without** `*`. Please confirm the canonical questions above in profile (do not rely on agents copying asterisk drafts).
- Education site-fact region (北京市) is for **教育经历·城市**, not for 籍贯/现居住地.

## GTH 求职意向 — still NEED Jeremy (4 of 5)

Live readiness: **1/5** ready (`期望薪资` only). Exact **4 missing** question strings for help card:

1. **期望从事职位类别**
2. **现从事行业**
3. **现从事职位类别**
4. **现薪资**

Never Save on GTH auto path.

## Explicit non-asks

- No QR / domain invent / sole-create school  
- No acceptance % bump without live rubric evidence  
