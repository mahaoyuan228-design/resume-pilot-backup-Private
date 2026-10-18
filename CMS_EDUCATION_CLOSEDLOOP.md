# CMS education closed-loop readiness（招商 wecruit.hotjob.cn）

Date: 2026-10-17 (Asia/Shanghai)  
Version: **0.1.4.9** (no bump). Edge loaded: `dist/edge-internal-v0.1.4.9-20261017-003753` (+ sync twin `011002`).

Scope: education rows only. **No** FocusEvent / React handleChange / DTO-relax. Agents do not Save/submit; Jeremy operates independently unless he sends「我需要帮助！」.



## Both-row live evidence 2026-10-17 19:52 (Asia/Shanghai)

Artifact: `dist/auto-runs/cms-education-auto-20261017-195234.json` (+ `both-rows-summary.json`).  
Launcher: `PROFILE_INDEX=5 ALSO_PROFILE_INDEXES=4 REPLACE_EXISTING=1` MODE=fill. **No website Save.**

| Profile index | Page target | region | gradeRank | school | Other verified |
| --- | --- | --- | --- | --- | --- |
| **5** 本科 Sydney | existing (replace) | **verified** reapplied | **verified** reapplied | skipped `option_not_found` | degree, academicDegree, major, start/end dates; description skipped empty |
| **4** 硕士 Sydney | existing (re-fill 19:57) / was **new** at 19:52 | **verified** | **verified** | skipped `option_not_found` | **degree verified** `readback_matched` (硕士↔硕士研究生); academicDegree/major/dates/description verified |

`serializedRecordCount=2`, `helpNeeded=false`, job `partial` / `education_records_partial` (expected with school fail-soft). Ship blocker **CMS both-row closed-loop** treated as met for narrow ship.


## School mapping status (2026-10-17 ~20:09 Asia/Shanghai)

Latest fill diagnostics (`latest.json`): desired **悉尼大学 The University of Sydney** for indices 4+5; `sampleOptions` show no Sydney/悉尼 hit; `hint=create_template_seen_but_not_sole_enabled_match`. **No uniquely safe catalog/create match** → leave fail-soft. Offline rev5 records `candidateOptions` for Jeremy `siteOptionMappings` later. Do **not** bump acceptance % until school verified live.

## Degree soft-skip fix (index 4) — 2026-10-17 evening

Root cause: profile `education.4.degree` = **硕士**; CMS catalog option = **硕士研究生** (fixture `graduate:'硕士研究生'`). Exact match failed → soft-skip `education_option_missing`. AcademicDegree (学位) already matched short **硕士**.

Fix (parity with UNRANKED): closed `DEGREE_LEVELS` synonym classes in `cms-education-multi-select.js` rev5, `cms-record-controller.js` rev11, `cms-education-serialization.mjs`. No invented options — only match when live menu text is in the same class. Optional `siteOptionMappings` still preferred for odd catalog spellings.

Offline: `tests/cms-degree-level-synonyms.test.mjs` PASS. **Live re-fill PASS** 2026-10-17 19:57 Asia/Shanghai: both-rows existing 5+4; index4 degree **verified** `readback_matched` (`cms-education-auto-20261017-195741.json` / `degree-synonym-summary.json`). School still fail-soft. **No Save.**

## Proven live

| Field | Evidence | Notes |
| --- | --- | --- |
| 专业名称 (major) | Live PASS once on focused Edge (rev7 textAdapter + page focus wait) | Requires tab/window focus; unfocused → `page_unfocused` / `text_blur_event_not_observed` (no write) |
| 专业描述 (description) | Empty optional OK | `missing_profile_value` / skip when no fact — not an error |
| School `option_not_found` | Historical e4 partial: status **skipped** | Fail-soft; no guess. Site may lack unique catalog/create option |
| Serialization path | Offline + harness | Known-partial commits; region display projection SHA `5761434e…` |

## Merged overlays — live status after Pass Q (2026-10-17 19:57)

| Overlay / change | File | Offline | Live |
| --- | --- | --- | --- |
| Region object → unique tree path display (fillType 9/15) | `cms-education-serialization.mjs` | PASS (`cms-region-object-projection`) | **verified** both rows (19:52 / 19:57) |
| Rank Escape + unranked + **degree-level** synonyms | `cms-education-multi-select.js` **rev5** | PASS (`cms-degree-level-synonyms`) | gradeRank **verified**; index4 degree **verified** `readback_matched`（硕士↔硕士研究生） |
| Region Escape typeless surfaces (parity) | `cms-education-multi-region.js` | PASS (`cms-region-escape-surfaces`) | Covered by both-row region verified (no separate Escape-only artifact) |
| Chinese reasons for option/region/rank misses | `cms-education-actions.js` | Static key test | UX only; not a ship gate |

## Remaining failure modes (file:line)

| Mode | Status | Where | Risk |
| --- | --- | --- | --- |
| `option_not_found` / `ambiguous_option` | **skipped** (fail-soft) | `cms-education-multi-school.js` rev4 | No unique catalog/create; diagnostics include `searchText`/`sampleOptions`/`createTemplatePresent`. Prefer `siteOptionMappings` for school catalog spelling. Create quotes: curly/ASCII/「」 |
| `region_option_not_found` / `ambiguous_region_option` | **failed** | `cms-education-multi-region.js:178` | Profile province/city text ≠ site option; or partial province then city miss (`partial:selections>0`) |
| `region_readback_mismatch` / `final_readback_mismatch` | **failed** | `cms-education-multi-region.js:195,200` | Selection clicked but display not matching |
| `menu_cleanup_failed` (region) | **failed** | `cms-education-multi-region.js:208-211` | Escape/blur did not close owned menu |
| `education_option_missing` / `ambiguous_education_option` | **skipped** (fail-soft) / **failed** if ambiguous | `cms-education-multi-select.js` **rev5** | Unranked 未排名↔无统计; **学历** 硕士↔硕士研究生 / 本科↔大学本科 / 博士↔博士研究生 / 大专↔专科; true miss soft-skips (+ sampleOptions) |
| `menu_cleanup_failed` (rank) | **failed** | `cms-education-multi-select.js:47` | Often wraps primary miss; Escape surfaces now typeless |
| `control_busy` cascade | **skipped** | school/region/select early guards | One open menu blocks peers (historical source4) |
| `page_unfocused` / blur not observed | **failed/stop** | `cms-record-controller.js` textAdapter + `cms-page-focus.mjs` | Major safe-fail when Edge not focused |
| `react_serialization_mismatch` | **failed** | `cms-education-serialization.mjs:74` | Display/DTO ≠ desired after fill |
| License gate | **skipped**/stop | adapters if `guard-worker.mjs` present | Internal 0.1.4.9 uses ordinary worker — gate inert |

## Offline checklist (this box)

```bash
cd /workspace/resume-autofill
node --test tests/cms-region-escape-surfaces.test.mjs tests/cms-education-option-outcomes.test.mjs \
  tests/cms-region-object-projection.test.mjs tests/cms-select-escape-surfaces.test.mjs \
  tests/cms-known-partial.test.mjs tests/cms-page-focus.test.mjs
node tests/cms-school-cleanup.test.mjs
node tests/cms-text-blur-commit.test.mjs
```

## One-shot live checklist for Jeremy (both education rows)

Only when parent needs a live pass; escalate「我需要帮助！」only for login/captcha/session.

1. Edge load unpacked `…/dist/edge-internal-v0.1.4.9-20261017-003753/extension` (reload extension after any sync). Stay on 0.1.4.9.
2. Open CMS `…/pb/resumeOperation.html` logged in; **keep that tab selected and the Edge window focused** (no other OS window stealing focus).
3. Popup →「完整教育经历」→「读取教育记录」→ bind **both** existing rows to the two profile sources (or one existing + one new if that is the real layout). Do **not** check「重新填写」unless you intend replace.
4. 「填写全部选定教育并核对」once. Do **not** click website Save / 投递.
5. Read per-field Chinese outcomes for **both** rows:
   - Expect major verified when focused.
   - Region (城市): verified **or** clear `region_option_not_found` / readback reason (not silent null display).
   - Rank (专业排名): verified **or** `education_option_missing` / cleanup reason (menu should not stay open).
   - School: verified **or** skipped `option_not_found` (acceptable).
   - Description empty: skipped OK.
6. If any `page_unfocused` / unknown / pending lock: focus Edge,「我已看过网站，解除锁定」, re-read; do not Save.
7. Optional later: one controlled draft Save + refresh **only** after both rows have explainable outcomes (separate decision; not part of this closed-loop prep).

## Explicit non-goals

- No inventing FocusEvent / React internals / DTO relax.
- No agent Save/submit; no WHITELIST bump until release decision.
- GTH Save still ranked after CMS education closed-loop evidence.

## 实习字段待 Jeremy 核对（非本 pass 代勾）

Live auto fill profileIndex 0（中信证券 · 实习生）当前：

| 字段 path | 状态 | 说明 |
| --- | --- | --- |
| `experience.0.startDate` / `endDate` | **缺值** | 须完整 `YYYY-MM-DD`；软件**不会**编造日期 |
| `experience.0.organization` | 有预览「中信证券股份有限公司」但未核对 | 资料库勾选已核对 |
| `experience.0.type` | 有预览 `internship` 但未核对 | 须为实习并已核对 |
| `experience.0.position` | 有预览「实习生」但未核对 | 勾选已核对 |
| `experience.0.description` | 有预览但未核对 | 勾选已核对 |

零 ready 字段时控制器返回 `internship_record_not_ready`（不新增空行）。部分 ready 时可 soft-skip 其余。Agent **不**静默写入 `confirmedFields`。

### Sydney catalog re-probe (2026-10-17 ~20:33 Asia/Shanghai)

Live searches (悉尼大学 / The University of Sydney / University of Sydney / Sydney / 悉尼 / 悉尼大) on education 学校: **no catalog option text** containing 悉尼/Sydney. Empty row → create-template only; row0 already shows selected **`悉尼大学`**. **No** mapping / **no** sole-create / **no** fill-verify. See `dist/auto-runs/cms-school-sydney-summary.json`.

## School preexisting soft-match (2026-10-17 20:54 Asia/Shanghai)

| Profile | Page school display | Outcome |
| --- | --- | --- |
| **5** bachelor (existing/replace) | **悉尼大学** (contains match vs bilingual profile) | **verified** `preexisting_same_value` |
| **4** master | empty / no catalog Sydney LI | skipped `option_not_found` (fail-soft; no sole-create) |

School rev6 + controller rev15 + serialization soft equals. Catalog still has no Sydney LI; do not map/sole-create empty rows.

