# 南粤 CMS_BASIC · remaining skips（offline note · 2026-10-19）

时区：Asia/Shanghai  
证据：`dist/auto-runs/hotjob-tenant-670a29-cms-basic-20261019-090052.json` · `HOTJOB_NANYUE_CMS_BASIC_LIVE_20261019.md`  
口径：Offline only · Never Save · 验收仍 **85%** · **不**宣称南粤客户可卖/全量支持 · CloudAgent `bc-d7c6ac75` 已推 prior patches — **本笔记不另开 PR / 不重复其改动**。

Core live：`personalVerified=8` `failed=0`（姓名+移动电话等）已 PASS。以下为**仍 skip**的根因假设与下一刀。

## Binding fact（读码，非猜 DOM）

| 常量 / 层 | 绑定 | 南粤 live URL |
| --- | --- | --- |
| `CMS_PHOTO_PAGE` / `CMS_QUESTION_PAGE` | `…/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html`（**招商** baseline） | `…/SU670a291d6202cc7666c744bc/pb/resumeOperation.html` |
| `confirmedCustomAnswer` | `saved.sitePageUrl === location.origin+pathname` 且 section+rowContext 一致，否则 **`question_scope_mismatch`** | 招商-scoped fact → 南粤页必 mismatch（fail-closed） |
| `cms-region` `sameFact` | 同上 URL 精确相等，否则 **`region_fact_scope_mismatch`** | 同 |
| `cmsAntV3Control` hostname+`/SU…/pb/resumeOperation.html` | 控件层已放行同壳 tenant | 答案层仍要 tenant-scoped customFacts |
| Templates / seed (`site-question-templates.js`, `cms-basic-seed-from-education.mjs`) | 草稿 `sitePageUrl` **硬绑招商 PAGE** | 不会自动长出南粤行 |

对照：同跑里 **民族 / 证件类型** 已 `preexisting_same_value`（多半是 `LEGACY_STABLE_CUSTOM_QUESTIONS` 无 scope，或本页已有同值）；**不**证明招商-scoped 答案可跨 tenant 复用。

---

## Skip list（本切片关心的剩余项）

| # | 标签 | reason | hypothesized layer | 根因假设（offline） | proposed next knife |
| --- | --- | --- | --- | --- | --- |
| 1 | 国籍/地区* | `question_scope_mismatch` | `confirmedCustomAnswer` ← `cmsExactCustomAnswer` / `CMS_CUSTOM_SINGLE_SELECT` | Profile 有 `customAnswers.国籍/地区`，但 `sitePageUrl`（或 section/row）≠ 南粤 `origin+pathname`；典型为 **招商模板/seed 行**。引擎 fail-closed 正确。 | **needs Jeremy customScopedAnswers**（南粤 `sitePageUrl` + `个人基本信息必填` + `single` + confirmed）。**无** login-free 安全码补丁（放宽 URL → 跨租户串答）。 |
| 2 | 婚姻状况* | `question_scope_mismatch` | 同上 | 同上 | 同上 |
| 3 | 毕业院校* | `question_scope_mismatch` | 同上；另：`cmsSchoolSearchControl` **仍钉** `CMS_PHOTO_PAGE` | 答案先被 scope 挡下；即便解开 scope，南粤毕业院校搜索 helper 也不会走招商-only school search。 | **needs Jeremy customScopedAnswers**（南粤页）。学校搜索放行属 **招商专属** 行为，扩 tenant **需 live 证据**，非本 offline 刀；**勿**盲扩 `CMS_PHOTO_PAGE`。 |
| 4 | 政治面貌* | `ambiguous_profile_fact` | `cmsAntV3Answer` → `confirmedCustomAnswer`（JSON 带 `path=customAnswers.政治面貌`，故非「零条」早退） | `LEGACY_STABLE` 含本题，但本跑是 **歧义**而非 scope mismatch：多半 `customFacts` 多条「政治面貌」且 identity/同页 scoped 过滤得不到唯一一行，或 `repeatedCustomQuestion`（DOM 多实例）。Fail-closed 正确。 | **needs Jeremy** 去重/只留一条 **南粤-scoped** confirmed fact（或清掉冲突行）。**无**「取第一条」引擎补丁。 |
| 5 | 籍贯* | `region_fact_scope_mismatch` | `cms-region.js` `resolveFact` → `sameFact` | 唯一 `籍贯` fact 已 confirmed，但 `sitePageUrl` ≠ 南粤页（招商-bound JSON province/city 对）。Region adapter PATH 已允许任意 `SU…/pb/…`，**卡在 fact 作用域**。 | **needs Jeremy customScopedAnswers**（南粤 `sitePageUrl` + region JSON `{province,city}`）。**无** offline 放宽 sameFact。 |
| 6 | 学历*（教育经历必填） | `option_not_found` | `cmsDecision` education context → `profileValue(education.0.degree)` → fill 精确选项匹配 | 答案路径已绑 `education.0.degree`；站点下拉 **无**与 profile/映射文案 **精确**一致的选项（或缺本 tenant 的 `siteOptionMappings`）。 | **needs Jeremy option mapping**（`siteUrlPrefix`=`…/SU670a29…/`，`fieldPath=education.0.degree`，`optionText`=站点原文）。**勿**离线编造选项文案。 |

---

## 同跑其它 skip（非本刀；仅索引）

| reason | 例 | 备注 |
| --- | --- | --- |
| `unknown_question` ×12 | 接受调剂、身高、紧急联系人、微信… | 无 profile key；要 customFacts / 明确不填 |
| `section_requires_mapping` ×3 | 毕业时间?、专业*、联系电话* | `cmsDecision` 已故意挡 basic 专业/毕业时间；联系电话让位移动电话 |
| `custom_control_not_supported` ×3 | 学历*/学位*（section 空） | `cmsScopedAcademicSelectSpec` 等钉 `CMS_PHOTO_PAGE`；tenant 上学术别名 select **未**接好 — 扩 gate 需 scoped facts + live，**属 bc-d7c6ac75 范围外 / 勿重复盲扩** |

---

## Safe offline patch?

| 问 | 答 |
| --- | --- |
| 是否存在 **login-free、可安全合入** 的引擎小补丁以清掉上表 1–6？ | **否。** 根因是 **招商 `sitePageUrl` 绑定 vs 南粤 tenant**、多事实歧义、或 **缺 tenant option mapping**。放宽 scope / 猜选项 / 自动复制招商行到南粤 URL 都会破坏 fail-closed。 |
| 下一动作 | Jeremy：为南粤页补 **customScopedAnswers**（国籍/婚姻/毕业院校/籍贯/政治面貌唯一行）+ 教育 **学历** `siteOptionMappings`；再 Never Save live 复验。代码侧等 CloudAgent 既有 PR，**本笔记不改码、不开 PR**。 |

## 口径提醒

- 可卖仍仅 **招商 CMS + 国泰 GTH**。  
- 南粤 = same-shell **试验**；verified=8 不抬验收、不写「客户可填」。

---

## Codex I 对照（2026-10-19 · GPT-6.1 Sol Extra High · 主脑裁剪）

结论不变：**1–6 无 login-free 引擎补丁**。离线可写的只是拒绝用例/契约草稿；国籍等仍要 Jeremy `customScopedAnswers`（南粤 sitePageUrl）；政治面貌要唯一事实。不要做：放宽 scope、猜映射、跨 HOTJOB 兜底、宣称已支持。草稿：`_temp-scripts/CODEX_DRAFT_NANYUE_NEXT_I_20261019.md` · trim：`CODEX_TRIM_NANYUE_NEXT_I_20261019.md`。
