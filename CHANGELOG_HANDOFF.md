## 2026-10-17 late evening — GTH basic leftover-editor harden (Asia/Shanghai)

1. **Symptom:** Live GTH basic readiness hit `gth_basic_editor_ambiguous` from leftover other-section editor (coverage pass skipped fill).
2. **Fix:** `gth-basic-auto.mjs` probe scopes to 基本信息 forms; other-section open → warning not ambiguous. `gth-basic.js` rev**4**: section-scoped `forms()` + `clearForeignEditors` (取消 only, never Save).
3. Tests `gth-basic-editor-scope` PASS; overwrite-guard rev assert →4. `RELEASE_NOTES_0.1.4.9.md` 中文内部窄版 85%.
4. Live readiness **PASS** `212855` (pageState=ready, no ambiguous). Acceptance **stays 85%**. Never Save. Ask Jeremy? **No**. Sync PC + Edge **003753/011002**.

---

## 2026-10-17 late evening — more auto unit coverage + INSTALL/SHIP consistency (Asia/Shanghai)

1. Extended unit/smoke for **CMS_BASIC_AUTO** / **GTH_BASIC_AUTO** / **GTH_SIMPLE_AUTO** / **GTH_OTHER_AUTO** → **33/33 PASS** (fail-closed: missing/unconfirmed profile, origin, login helpNeeded, personal-field filter, Never Save).
2. Soft harden: simple/other runners expose `skillsSource` / `otherSource` for tests.
3. Docs: INSTALL productPaths **93** + **85%**; SHIP site autos; WAKE accurate. **Acceptance stays 85%**. Ask Jeremy? **No**.

## 2026-10-17 late evening — CMS_BASIC_AUTO scaffolding + live readiness (Asia/Shanghai)

1. **CMS 个人基本信息 auto** (mirror GTH_BASIC_AUTO): `CMS_BASIC_AUTO` + `src/background/cms-basic-auto.mjs` + `src/auto/cms-basic-auto.*` + `scripts/auto-cms-basic.mjs`; alias `cms-education-auto.html?mode=basic_*`. Modes: readiness (default) · fill (RESUME_FILL product path; report filters 个人基本信息必填). **Never Save**.
2. Tests `cms-basic-auto` **4/4 PASS** (box + PC). productPaths **90→93**.
3. Live 21:17: readiness **PASS** (pageState=ready, sectionPresent, itemCount=22, readyCount=0, writeAttempted=false). Fill fail-closed `missing_profile_value` (no invent customAnswers); writeAttempted=false.
4. Acceptance **stays 85%** (extra CMS evidence; HTTPS 15% still Jeremy). Sync PC + Edge **003753/011002**. Ask Jeremy? **No**.

---

## 2026-10-17 late evening — GTH editor_structure_changed fix + GTH_OTHER_AUTO (Asia/Shanghai)

1. **Root cause:** `gth-education.js` page-wide `forms()` treated leftover 基本信息/other editors as education structure change → dual MODE=fill `stopped_before_write` / `editor_structure_changed` (saveAttempted=false). Probe already edu-scoped.
2. **Fix:** edu-scoped forms + `clearForeignEditors` (取消 only, never Save) before outside fingerprint; implementationRevision **4**. Popup `other_section_editor_open`. other/simple section formsOf scoped; simple probe parity.
3. **GTH_OTHER_AUTO** scaffolding (readiness/fill-wo-save) + tests; packaging productPaths **90**.
4. Anti-resale offline edges in license gate tests + `ANTI_RESALE.md`. `WAKE_JEREMY.md` queued (domain checklist only).
5. Live dual fill-wo-save **PASS** 21:11 Asia/Shanghai：p5 row0 + p4 new completed/verified；saveAttempted=false → Acceptance **80%→85%**. Ask Jeremy? **No**. Never GTH Save.

---

## 2026-10-17 evening — GTH probe scope + dual fill attempt (Asia/Shanghai)

1. **GTH probe harden:** `gth-education-auto.mjs` scopes editor detection to 教育经历 forms only; other-section open editors → warning not `gth_editor_ambiguous`. Live readiness **PASS** (educationCount=2, no QR).
2. **Dual fill-wo-save:** popup serial skipped (saves). MODE=fill p5+p4 → `stopped_before_write` / `editor_structure_changed`; saveAttempted=false. **No** optional 5% bump.
3. Tests: `gth-education-probe-scope` PASS. Acceptance **80%** unchanged. Sync PC + Edge **003753/011002**. Ask Jeremy? **No**.

---

## 2026-10-17 evening — Jeremy license checklist + CMS empty-school no sole-create (Asia/Shanghai)

1. **Docs:** `LICENSE_JEREMY_CHECKLIST.md` — clear Chinese checklist of domain / payment+issuance / Ed25519 production keys for the remaining ~15%. Linked from `LICENSE_STATUS.md`, `验收清单.md`, `INSTALL_INTERNAL.md`, `SHIP_NARROW.md`. **Not done** — no fake HTTPS domain.
2. **Product:** `cms-education-multi-school.js` rev**7** refuses sole-create (`sole_create_refused_by_policy`); empty-row hint `empty_row_create_template_not_used` + `rowWasEmpty`; controller rev**16** + task-runner forward; popup Chinese empty-row / Sydney guidance. **No** sole-create.
3. **GTH multi:** popup serial path saves drafts → skipped this pass (Never Save). No Jeremy QR ask.
4. Acceptance **stays 80%**. Sync PC + Edge **003753/011002**. Version 0.1.4.9. Ask Jeremy? **No**.

---

## 2026-10-17 evening — CMS school preexisting display match → 80% (Asia/Shanghai)

1. **Bug**: filled education rows already show `悉尼大学` but profile optionText is bilingual `悉尼大学 The University of Sydney`; under `replaceExisting` exact match failed → catalog search → `option_not_found` (and first fix attempt demoted to `dom_readback_mismatch`).
2. **Fix**: `cms-education-multi-school.js` rev**6** `schoolDisplayMatches` (contains, shorter≥4) → verified `preexisting_same_value` even under replaceExisting; controller rev**15** + serialization `schoolDisplayEquals` for DOM/React readback. **No** siteOptionMappings / **no** sole-create.
3. Live MODE=fill 20:54: index **5** school **verified** `preexisting_same_value`; index **4** empty-row still fail-soft `option_not_found`. Artifact `dist/auto-runs/cms-education-auto-20261017-205420.json` / `latest.json`. **Never Save**.
4. Acceptance **75% → 80%**. Offline tests: school-preexisting + option-outcomes + degree-synonyms + props/region SHA. Synced PC `resume-autofill-dev` + Edge **003753** + **011002**. Ask Jeremy? **No**.

## 2026-10-17 evening — CMS internship Fiber props uniqueness → complete (Asia/Shanghai)

1. **Harden**: `cms-internship-serialization.mjs` accepts multiple Fiber public-props refs when the five serializer inputs are equivalent (parity with education); real projection conflicts still `internship_public_props_not_unique`.
2. **Offline**: `cms-internship-props-equivalent` PASS; fixture `cms-internship-serialization-strict-props.mjs`; related internship tests green.
3. **Live MODE=fill** (RELOAD=1): state **completed** / reason `internship_bound_records_serialized` / `complete:true` / 6/6 verified / serializedRecordCount 1；**Never Save**. Artifact `dist/auto-runs/internship-latest.json`.
4. **Acceptance**: **75%** (was 65%; internship 10% moved from Jeremy-owned to evidenced). Updated `验收清单.md` / PROGRESS Q.
5. Synced PC `resume-autofill-dev` + Edge **003753** + **011002**. Version 0.1.4.9. Ask Jeremy? **No**.

## 2026-10-17 evening — experience date pad UX (Asia/Shanghai)

1. **Root cause confirmed:** `confirmSection` rejects unpadded dates (`2022-9-1` / `2022-12-1`); `isCalendarDate` + YYYY-MM gates require zero-padded month/day. Toast matched Jeremy screenshot; confirm never wrote `experience.*` into `confirmedFields` → UI stayed 待核对.
2. **UX fix in** `src/profile/options.js` (v0.1.4.9, no bump): `padLooseDate` / `applyLooseExperienceDates` — blur + confirm auto-normalize `2022-9-1`→`2022-09-01` (and `2022-9`→`2022-09`); labels/hint state 须补零; residual invalid toast names 第N段开始/结束日期.
3. Synced PC `resume-autofill-dev/src` + Edge **003753** + **011002** `extension/src/profile/options.js`. Internship fill **not** re-run (separate). Ask Jeremy? **Reload Edge extension**, then on 工作与实习 click 确认本页资料 (auto-pad runs first). Do **not** re-ask date rewrite.

---

## 2026-10-17 evening — CMS school Sydney catalog probe (Asia/Shanghai)

1. Priority divert: live CDP probe on CMS education **学校** (Edge debug 9237, resumeId tab). Queries: 悉尼大学 / The University of Sydney / University of Sydney / Sydney / 悉尼 / 悉尼大.
2. **Catalog LI hits containing 悉尼/Sydney: none** (empty row → sole create-template only; row0 with selected 悉尼大学 → ~101 unrelated Chinese unis + create template).
3. Site row0 **already selected** display text: **`悉尼大学`**. Create templates seen e.g. `使用“悉尼大学”作为我的学校`, `使用“Sydney”作为我的学校` (English spaces stripped in create label).
4. **Did not** add `siteOptionMappings`; **did not** sole-create; **did not** MODE=fill school verify (mapping to 悉尼大学 on empty row would sole-create). Acceptance **65% unchanged**. Artifacts: `dist/auto-runs/cms-school-catalog-probe.json`, `cms-school-sydney-summary.json`. Ask Jeremy? **No** (not login wall; catalog search gap).

---

## 2026-10-17 evening — GTH basic overwrite + GTH_SIMPLE_AUTO (Asia/Shanghai)

1. **Root-cause/fix** GTH basic `replaceExisting=1` flake on 最高学历 (`basic_other_values_changed`): mid-select guard now allows intermediate empty/existing/intended (parity education categoryOverwrite); same-value short-circuit; `gth-basic.js` rev3.
2. Live MODE=fill replaceExisting=1 **PASS** (`gth-basic-auto-20261017-202228` / overwrite stamp): degree `readback_reapplied`; saveAttempted=false.
3. **Next slice:** `GTH_SIMPLE_AUTO` + `src/background/gth-simple-auto.mjs` + `src/auto/gth-simple-auto.*` + `scripts/auto-gth-simple.mjs` (readiness default; fill-wo-save; never Save).
4. Tests: overwrite-guard + simple-auto **10/10** (with basic-auto). productPaths **87**. Acceptance **65% unchanged**. Sync PC + Edge **003753/011002**. Ask Jeremy? **No**.

---

## 2026-10-17 evening — GTH_BASIC_AUTO scaffolding + live fill-wo-save (Asia/Shanghai)

1. **Chose next slice beyond education:** GTH 基本信息 auto (popup/basic-task-runner already existed; no auto helper).
2. Added `GTH_BASIC_AUTO` + `src/background/gth-basic-auto.mjs` + `src/auto/gth-basic-auto.{html,js}` + `scripts/auto-gth-basic.mjs`. Modes: `readiness` (default) · `fill` (no Save). Login wall → `helpNeeded`.
3. Unit smoke `tests/gth-basic-auto.test.mjs` **4/4 PASS** (box + PC).
4. Packaging: WHITELIST productPaths **84** (+3); build-internal/paid; worker install; SOURCE_INVENTORY regen.
5. **Live**: readiness PASS; fill `replaceExisting=0` → completed / operableComplete / 6 field outcomes / **saveAttempted=false** (`dist/auto-runs/gth-basic-*.json`). Degree mid-select flaky under replaceExisting=1 (`basic_other_values_changed`) — leave for later harden if needed.
6. Acceptance **65% unchanged**. Sync PC + Edge **003753/011002**. Ask Jeremy? **No**.

---

## 2026-10-17 evening — CMS school no unique match; candidateOptions offline (Asia/Shanghai)

1. Latest CMS education auto-run: school `option_not_found` for profile **4+5** (`悉尼大学 The University of Sydney`). Samples are unrelated Chinese unis; create template present but not sole → **no** mapping / **no** sole-create.
2. Offline: school **rev5** records `candidateOptions` top-N (diagnostics only); controller **rev12** + task-runner persist; popup Chinese skip lists candidates and points to「网站选项对应」.
3. `验收清单.md`: school **5% stays open**. Acceptance **65%** unchanged. Version **0.1.4.9**.
4. Sync PC `resume-autofill-dev` + Edge **003753/011002** `extension/`. Ask Jeremy? **No**.

---

## 2026-10-17 evening — paid UX / entitlement edge cases + INSTALL 验收 gaps (Asia/Shanghai)

1. **No CMS school sole-create**: latest auto-runs still `createTemplatePresent=true` with ~101 fuzzy → not uniquely safe; fail-soft retained; popup now surfaces create-not-sole hint.
2. **Entitlement edge cases**: gate maps `status=expired` → LICENSE_EXPIRED; installId/profileHash mismatch → BINDING_MISMATCH; Chinese copy + activate detailMap polished; popup「在线核验」→「授权核验」+ activate tip.
3. **INSTALL_INTERNAL.md §7**: table of Jeremy-facing 验收 gaps (internship dates, school mapping, GTH login, HTTPS/pay, GTH Save deferred).
4. Tests: license **51/51**. Acceptance % **stays 65%**. Sync PC + Edge popup. Ask Jeremy? **No**.

---

## 2026-10-17 evening — 验收清单 + narrow acceptance 65% (Asia/Shanghai)

1. Added `验收清单.md` (已举证 / Jeremy blockers / GTH Save 政策暂缓).
2. `SHIP_NARROW.md` short checklist section; GTH Save wording → policy-deferred.
3. Narrow-ship acceptance **65%** in `PROGRESS_2026-10-17.md` (rubric one-liner).
4. Pass Q doc gap: `CMS_EDUCATION_CLOSEDLOOP.md` region/rank/degree marked live verified.
5. Docs-only; Ask Jeremy? **No**.

## 2026-10-17 evening — CMS degree synonym (硕士↔硕士研究生) + GTH multi N/A (Asia/Shanghai)

1. **CMS degree soft-skip root cause**: profileIndex 4 `degree=硕士` vs CMS catalog `硕士研究生` → `education_option_missing`. Closed `DEGREE_LEVELS` synonym classes (parity with UNRANKED) in `cms-education-multi-select.js` **rev5**, `cms-record-controller.js` **rev11**, `cms-education-serialization.mjs`. Soft-miss diagnostics: `desiredOptionText`/`sampleOptions`.
2. Tests: `cms-degree-level-synonyms` + option-outcomes + SHA pins (`f4d1f679…` select / `14b24527…` serialization) — PASS.
3. **GTH alsoProfileIndexes**: documented N/A in `GTH_EDUCATION_READINESS.md` — auto is single-editor; popup serial/batch already does exactly 2; live multi blocked on login wall (no Jeremy ask).
4. Live both-rows re-fill **PASS** 19:57: index4 degree **verified** `readback_matched`. Leftover bind prefers `alsoProfileIndexes` when school empty.
5. Sync PC `resume-autofill-dev` + Edge **003753/011002** `extension/`. Version 0.1.4.9. Ask Jeremy? **No**.

---

## 2026-10-17 evening — CMS both-row live + paid offline smoke (Asia/Shanghai)

1. **CMS education both-row live closed-loop**: `alsoProfileIndexes` → fill profile **5** (existing replace) + **4** (new). Artifacts: `dist/auto-runs/cms-education-auto-20261017-195234.json`, `both-rows-summary.json`.
2. Both rows: **region** + **gradeRank** verified; school fail-soft `option_not_found`. Index4 degree soft-skipped `education_option_missing`. **No website Save**.
3. **Paid offline smoke**: `build-paid.ps1` + `build-paid-smoke.mjs` → `dist/edge-paid-v0.1.4.9-*` with guard-worker, activate UI, popup「授权激活」, EXAMPLE public key; mock `/v1/verify` tests pass. DEV URL `https://127.0.0.1:8787` only.
4. Synced PC `resume-autofill-dev` + Edge **003753/011002**. Docs: PROGRESS P, CMS_EDUCATION_CLOSEDLOOP, LICENSE_STATUS, SHIP_NARROW. Version 0.1.4.9. Ask Jeremy? **No**.

---

## 2026-10-17 evening — GTH Save policy + overwrite/internship tests (Asia/Shanghai)


1. **B**: `src/background/gth-save-policy.mjs` — deferred `saveAllowedByPolicy:false`; dry-run keeps `readyToSave` without Save; auto asserts never Save. Wired into `gth-education-auto.mjs`.
2. **E**: Unit tests for pass-N category overwrite mid-search contract + internship soft-skip diagnostics (dates missing / unconfirmed valuePreview) — **15/15**.
3. **A-lite**: Internship popup Chinese for `internship_record_not_ready` + valuePreview hints; Jeremy must confirm dates+facts later (no invent / no silent confirm).
4. Docs: `GTH_EDUCATION_READINESS.md`, `INSTALL_INTERNAL.md` paid-vs-internal checklist, PROGRESS O. Synced PC + Edge **003753/011002**. Version 0.1.4.9. Ask Jeremy? **No**.

---

## 2026-10-17 evening — CMS_INTERNSHIP_AUTO scaffolding (Asia/Shanghai)

1. Added `CMS_INTERNSHIP_AUTO` in shared `cms-education-task-runner.mjs` (`recordKind:'internship'`): default **readiness** (inspect+bind preview, no RUN); `mode=fill` optional.
2. Helper `src/auto/cms-internship-auto.{html,js}` + launcher `scripts/auto-cms-internship.mjs`; WHITELIST + build-internal/paid.
3. Unit smoke `tests/cms-internship-auto.test.mjs` **3/3 pass**. No live internship fill this pass.
4. Synced PC src + Edge **003753** + **011002**. Ask Jeremy? **No** (GTH wait remains parent’s).

---

## 2026-10-17 evening — GTH_EDUCATION_AUTO readiness (inspect-first) (Asia/Shanghai)

1. Added `GTH_EDUCATION_AUTO` + `src/auto/gth-education-auto.*` + `scripts/auto-gth-education.mjs` (CMS-style; default readiness; fill-without-save optional; **never Save**).
2. Live run: Edge opened `hr.gtht.com/resume/edit/` → redirected to login → artifact `helpNeeded:true` / `helpUrl=https://hr.gtht.com/login/?from=%2Fresume%2Fedit%2F`.
3. Synced to PC src + 003753 + 011002. Ask Jeremy? **Yes — QR/login only** (parent「我需要帮助！」).

---

## 2026-10-17 evening — DEV mock license + internship focus parity (offline) (Asia/Shanghai)

1. `scripts/dev-mock-license-server.mjs`: DEV-ONLY HTTPS `/v1/verify` compatible with `client.mjs`; allow/deny/expired/…; self-signed localhost certs under `scripts/dev-mock-license-certs/` (gitignored).
2. Smoke: `tests/license-mock-server-smoke.test.mjs` (allow/deny/expired/503 + mock never in build allowlists).
3. Internship focus audit: same `awaitCmsPageDocumentFocus` call in shared runner — **no product runner change**. Regression: `tests/cms-internship-page-focus.test.mjs`.
4. Packaging fix: add `src/background/cms-page-focus.mjs` to WHITELIST + `build-internal.ps1` + `build-paid.ps1` (file already in loaded 003753/011002).
5. Docs: `LICENSE_STATUS.md` mock + `build-paid` against `https://127.0.0.1:8787`. Sync PC `resume-autofill-dev` only; **no** Edge re-inject.

Ask Jeremy? **No**.

---

## 2026-10-17 evening — commercial license scaffolding (offline) (Asia/Shanghai)

Toward chargeable narrow ship; **internal 0.1.4.9 gate stays OFF**.

1. `src/license/` fail-closed gate + binding sketch + `guard-worker.mjs` (not in `build-internal.ps1`).
2. `scripts/build-paid.ps1` → separate `dist/edge-paid-v…` with generated `paid-config.mjs` (HTTPS URL only; no payment secrets).
3. Tests: `tests/license-gate-fail-closed.test.mjs`.
4. Docs: `LICENSE_STATUS.md` updated, `ANTI_RESALE.md`, `src/license/README.md`.
5. Root `manifest.json` unchanged (`worker.mjs`). Jeremy 003753 workflow intact.

Ask Jeremy? **No** — domain/payment/first paid recipients only later.

---

## 2026-10-17 evening — paid activate UI + entitlement helpers (offline) (Asia/Shanghai)

1. `src/license/entitlement.mjs` (`isFillAllowed`, local token activate, Chinese status copy).
2. Paid-only `activate.{html,css,js}`; `build-paid.ps1` packages them + popup「授权激活」on paid copy only.
3. `guard-worker.mjs` uses `isFillAllowed` for `RESUME_PAID_VERIFY`; open-activate message added.
4. Tests: `license-entitlement-helpers.test.mjs` — combined license suites **29/29**.
5. Synced to PC `ResumeQuickFill-Dev/resume-autofill-dev`; **003753/011002 not injected**.
6. See `PROGRESS_2026-10-17.md` + `LICENSE_STATUS.md`. Ask Jeremy? **No**.

## 2026-10-17 evening — CMS education region/rank/school closed-loop prep (offline) (Asia/Shanghai)

After GTH draft_refresh_original_outside_mismatch fix:

1. Audited multi adapters vs INVESTIGATE/CHANGELOG/tests; failure modes listed in `CMS_EDUCATION_CLOSEDLOOP.md` with file:line.
2. **Region Escape typeless parity** with rank overlay: `cms-education-multi-region.js` SHA `fba1009b…` (was attribute `input[type=text]` only).
3. Chinese reasons for `option_not_found` / `region_option_not_found` / `education_option_missing` / cleanup/busy in `cms-education-actions.js` (+ shared select keys in internship popup).
4. Tests: `cms-region-escape-surfaces.test.mjs`, `cms-education-option-outcomes.test.mjs` (school skip vs region/rank fail contracts).
5. Docs: `CMS_EDUCATION_CLOSEDLOOP.md`, `LICENSE_STATUS.md` (license hooks present; paid worker/server/payment missing from internal 72).
6. Sync product deltas to PC src + Edge `003753` + `011002`. Version stays **0.1.4.9**.

Ask Jeremy? **No** — live both-row retest only when he wants the one-shot in `CMS_EDUCATION_CLOSEDLOOP.md`.

---

## 2026-10-17 evening — GTH education path readiness (attachment outside) (Asia/Shanghai)

Priority after CMS major live PASS + serialization/region/rank harness harden:

1. ~~Serialization verify reliability~~ (prior)
2. CMS remaining education live closed-loop (still open; not this pass)
3. **GTH education path readiness** (this pass) — offline

### Root cause pinned

- Historical `draft_refresh_original_outside_mismatch`: Save allows 附件简历 text-only drift (`onlyAttachmentTextChanged` / `refreshSafe`), but post-reload `verifySaved` compared only `originalOutsideHash`. Real site keeps attachment display name across reload → verify fails → serial step 2 never runs.
- Offline fixture previously reset section-5 text on reload, masking the bug. New option `persistAttachmentAcrossReload`.

### Done now (no Jeremy login required)

- Product: `src/content/gth-draft-save.js` `refreshOutsideOk` accepts original **or** eligible post-save outside hash after refresh.
- Popup: Chinese explain for `draft_refresh_original_outside_mismatch` / `draft_refresh_outside_change_not_eligible` in batch panel.
- Tests: `tests/gth-refresh-attachment-outside.test.mjs` (3) + existing sections-ready (3) → **6/6 PASS**.
- Doc: `GTH_EDUCATION_READINESS.md` (code map, failure mode, offline checklist, one-shot live script for Jeremy).
- Version stays **0.1.4.9**; no WHITELIST bump.

### Remaining GTH blockers (live)

- Controlled single-record inspect→save→refresh on focused logged-in Edge (agent must not click Cancel/Save).
- Then serial two-record run.
- Prefer CMS education closed-loop evidence before routine GTH Save (ranking).

### Ask Jeremy now?

**No** — unless he wants to run the one-shot live script in `GTH_EDUCATION_READINESS.md`.

---

## 2026-10-17 evening — serialization verify reliability + focus-gate harness (Asia/Shanghai)

Ranked next after major live PASS (rev7 / Edge 003753):

1. **Serialization verify reliability** (this pass) — done offline.
2. **CMS remaining education fields live closed-loop** — region/rank retest on focused Edge; school `option_not_found` fail-soft; description optional empty OK.
3. **GTH education path readiness** — attachment outside-name mismatch / serial second record; no Save until CMS education closed-loop evidence.

### Done now (no Jeremy / no live site)

- Root cause of broken `cms-known-partial` after focus wait: harness lacked `tabs.update` / `windows.update` and `executeScript` probe omitted `hasFocus` → `awaitCmsPageDocumentFocus` threw `page_unfocused` → job `stopped_before_write` before RUN/serialization. Fixed education + internship harnesses.
- New `tests/cms-region-object-projection.test.mjs`: `{code,name}` → unique tree path display (not `raw.name`); 0/dup paths → null; scalar code OK; `verifyEducationSerialization` region pair verified; optional description skipped.
- `tests/cms-education-props-equivalent.test.mjs` SHA pin → `5761434e…` (post region overlay).
- New `tests/cms-select-escape-surfaces.test.mjs`: static contract for typeless text Escape surfaces (`f61d11de…`).
- Offline suite: known-partial 6/6, internship partial, region 4/4, props PASS, select Escape PASS, blur-commit PASS, page-focus PASS.
- Product `src/` bytes unchanged this pass (tests + handoff only). No version bump; stay 0.1.4.9.

### Still open for CMS full education closed-loop

- Live retest region display + rank Escape + major (already PASS once) on focused Edge for both education rows; school may remain `option_not_found` if site has no unique option.
- One controlled draft Save + refresh only after explainable per-field outcomes (no final apply submit).
- GTH unknown/attachment name diff still reserved; do not replay old Cancel/Save.


## 2026-10-17 evening — page focus wait before CMS education RUN (Asia/Shanghai)

- New `src/background/cms-page-focus.mjs`: poll `tabs.update` + `windows.update` until content `document.hasFocus()===true` (default 2s); else `page_unfocused` before RUN (no write).
- `cms-education-task-runner.mjs` uses that wait; controller `textAdapter` rev **7** adds short `window.focus` retries + pause (still no FocusEvent / React handleChange / DTO relax).
- Popup: `#fill` on CMS labeled「填写并读回（教育请用下方）」; multi panel surfaces `page_unfocused` in Chinese; intro clarifies top fill does not write education major.
- Tests: `tests/cms-page-focus.test.mjs` PASS; `tests/cms-text-blur-commit.test.mjs` PASS (rev7).
- Deploy: copy into Edge unpacked `.../dist/edge-internal-v0.1.4.9-20261017-003753/extension` (loaded) and `...-011002/extension`.

# CHANGELOG_HANDOFF — patched 0.1.4.9 (two narrow overlays)

Date: 2026-10-16 (Asia/Shanghai)

## Version

- **Kept `0.1.4.9`** in `manifest.json` and `WHITELIST.json`.
- Did **not** bump to `0.1.5.0`: the two reviewed candidates declare `baseVersion: 0.1.4.9` and are unmarked for release; a separate `cms-region-select-v0150` tree exists but was out of scope for this merge. WHITELIST/build scripts stay on 0.1.4.9.

## Merged overlays (product files only)

| Overlay | Target | SHA256 after merge |
| --- | --- | --- |
| `cms-region-object-projection` | `src/content/cms-education-serialization.mjs` | `5761434e0b6523c7cf99af25ea1fc829a310c9dd080667b58d6bd89b33f98c65` |
| `cms-select-default-input` | `src/content/cms-education-multi-select.js` | `f61d11de82212ad61da2809aaf304756a1b6ca429b562a68a27309550196894e` |

### 1. Region display projection (`cms-education-serialization.mjs`)

For `fillType` 9/15, unique tree-path projection runs **before** the generic `{code,name} → raw.name` branch. Zero or multiple tree paths still yield `null`. DTO / serializer path unchanged (`serializationAlgorithmChanged: false`).

### 2. Rank/menu Escape surfaces (`cms-education-multi-select.js`)

Close-menu Escape enumeration: `input[type=text]` → `input` nodes filtered by `instanceof HTMLInputElement && .type === 'text' && visible(...)`, so search inputs with no `type` attribute still receive native keyCode 27.

## Explicitly not applied

- `cms-text-focus-events` / major focus patches — left out per audit.
- No Edge job-site or user-machine profile changes.
- Major (专业名称) H1 confirmed on Edge 2026-10-17; detection gate in rev5 (page_unfocused / text_blur_event_not_observed). Live CMS closed-loop still pending. Region fix is readback projection only; rank fix improves menu cleanup on miss.

## Offline tests (this box)

```
node --test tests/cms-known-partial.test.mjs tests/cms-known-partial-internship.test.mjs
→ 6 pass / 0 fail

node tests/cms-text-blur-commit.test.mjs
→ PASS

node tests/cms-school-cleanup.test.mjs
→ PASS
```

Overlay review harnesses were **not** re-run here: `review-tests.mjs` needs Windows private capture paths; `default-input-cross-world.mjs` needs Edge CDP. Prior PASS evidence remains in the overlay folders.

## Still open

- Major / 专业名称 React verify failure.
- Real-site retest of region display + rank Escape after merge.
- Any 0.1.5.0 packaging / WHITELIST promote (separate decision).

## 2026-10-17 (Asia/Shanghai) — major detection gate

- Edge local probe confirmed H1: unfocused-visible → no blur/focusout, DOM looks filled, parent stale; focused → parent commits.
- `cms-record-controller.js` textAdapter → implementationRevision **5**:
  - `page_unfocused` if `document.hasFocus()===false`
  - `text_blur_event_not_observed` if blur/focusout not seen after `blur()`
- No FocusEvent synthesis / React handleChange / DTO relax.
- Build: `dist/edge-internal-v0.1.4.9-20261017-001845` (SHA256 zip `a8a982b2fb0d3fccf2b66486191e6b7c8635702eded493eb6ee015e562338244`)
- Still pending: live CMS education closed-loop with focused Edge; GTH; license/anti-resale.


## 2026-10-17 evening — CMS education FULL auto path (no popup) (Asia/Shanghai)

1. `CMS_EDUCATION_AUTO_FILL` in `cms-education-task-runner.mjs` (+ trusted sender for `src/auto/cms-education-auto.html`).
2. Helper page `src/auto/cms-education-auto.{html,js}`; launcher `scripts/auto-cms-education.mjs` (self-reload SW then fill); `scripts/RELOAD-AND-RUN.cmd`.
3. Live run on DESKTOP-UBHDGV5: profileIndex **5**, replaceExisting **true**, tab focused, pending unlocked; result `dist/auto-runs/latest.json`.
4. Outcomes: major/region/dates/degree **verified**; school **skipped** `option_not_found`; gradeRank **failed** `education_option_missing`; description skipped empty. **No** `page_unfocused`. No Jeremy login ask.

Ask Jeremy? **No** (unless he wants to fix site rank/school catalog options manually).


## 2026-10-17 evening — gradeRank unranked synonym + soft-skip (Asia/Shanghai)

1. Root cause: profile `education[5].gradeRank` = `未排名` (confirmed); no `siteOptionMappings` for rank; site option is `无统计` → exact miss → opaque `education_option_missing` failed.
2. Fix (no FocusEvent/React/DTO-relax): closed UNRANKED synonym class in `cms-education-multi-select.js` (rev4), controller rev8 DOM readback, serialization displayEquals; true miss → **skipped** `education_option_missing` (Chinese reason kept).
3. Live auto re-run: gradeRank **verified** `reapplied`; school skipped `option_not_found`; description skipped empty; job `education_records_partial` (not `requires_review`).
4. Synced PC src + Edge **003753** + **011002**. Version 0.1.4.9.

Ask Jeremy? **No**.

## 2026-10-17 evening — GTH category cascader preflight + soft-skip (Asia/Shanghai)

1. Root cause: `src/content/gth-education.js` category preflight `.professional-category` vs live `.cascader-wrap` (draft-save already cascader) → `education_category_structure_changed` / `stopped_before_write` before writes.
2. Fix: cascader-wrap preflight + soft-skip structure / existing_selection_unknown; auto/task-runner/popup accept those skip reasons.
3. Live fill profileIndex 5: completed/verified; majorCategory skipped; draft readyToSave; no Save.

## 2026-10-17 evening — GTH majorCategory overwrite + CMS school fail-soft (Asia/Shanghai)

1. **GTH majorCategory**: with `replaceExisting`/new, clear one foreign cascader selected-view row (`category_clear_foreign`) before search/path, then fill. Soft-skip `education_category_existing_selection_unknown` only when overwrite not allowed, multi-selected, or clear cannot empty. Prefer fill-without-save; **never Save**.
2. **CMS school**: `siteOptionMappings` now apply to school (catalog spelling ≠ profile); adapter searches `optionText`; create-school templates accept curly/ASCII/「」quotes; `option_not_found` stays skipped with `searchText`/`sampleOptions`/`createTemplatePresent`/`hint` diagnostics; Chinese hint points to 网站选项对应. Multi-school rev **4**.
3. Live re-runs: see `dist/auto-runs/gth-latest.json` / `latest.json` after MODE=fill.
4. Synced PC src + Edge **003753** + **011002**. Version 0.1.4.9. Ask Jeremy? **No**.

## 2026-10-17 evening — sync path note (Asia/Shanghai)

Loaded Edge packages use `dist/edge-internal-…-{003753,011002}/extension/` (not the sibling mirror `…/src/`). Product syncs must target `extension/src/…`.

## 2026-10-17 evening — GTH majorCategory overwrite guard + CMS school + internship HTML (Asia/Shanghai)

1. **GTH majorCategory**: replaceExisting clears foreign cascader selection then fill; live soft-skip `education_category_overwrite_guard` (selectorStep `category_search`, existingDisplay 金融…) — justified; never Save. Sync must target `dist/.../extension/`.
2. **CMS school**: siteOptionMappings for school; search optionText; create quote variants; option_not_found diagnostics (rev4). Live CMS re-run blocked (form_not_unique / timeout); prior soft-skip evidence retained.
3. **CMS internship auto**: HTML on disk but module never posted events after SW reload; launcher now reloads via education-auto; boot beacon added; need full unpacked Reload/Load for new auto HTML if still silent.

## 2026-10-17 evening — internship auto via education page (Asia/Shanghai)

1. Root cause silence: `cms-education-auto.js` template `${a || b ?? "?"}` is a SyntaxError — broke education+internship auto pages after delegate edit; fixed by hoisting `stateLabel`.
2. Internship launcher uses `cms-education-auto.html?mode=internship_readiness|internship_fill`; task-runner trusts that sender for `CMS_INTERNSHIP_AUTO`.
3. Direct `cms-internship-auto.html` still preferred long-term after full unpacked Load; boot beacon kept.
4. Task-runner trusts `cms-education-auto.html` as sender for `CMS_INTERNSHIP_AUTO`. Live readiness: ok, bindOk, writeAttempted false, rowCount 0→new.

## 2026-10-17 evening — majorCategory verified-when-match + form pick + internship fill path (Asia/Shanghai)

1. **GTH majorCategory**: when page `existingDisplay` already matches intended profile category, record **verified** `preexisting_same_value` (skip cascader reopen that caused `education_category_overwrite_guard`). Live: profileIndex **4** verified (金融学); profileIndex **5** still soft-skip overwrite_guard because page 金融学 ≠ profile 经济学. Never Save.
2. **CMS education**: controller rev9 `pickEducationForm` (connected form / section closest form + diagnostics). Live fill exercised school path; school remains fail-soft `option_not_found`.
3. **Internship**: lock **cms-education-auto.html?mode=internship_*** as canonical; internship-auto HTML/JS redirects. Live MODE=fill returns `internship_record_not_ready` (profile dates empty / unconfirmed) without Save — fill scaffolding usable.
4. Synced PC `resume-autofill-dev` + Edge **003753** + **011002** `extension/`. Version 0.1.4.9. Ask Jeremy? **No**.

## 2026-10-17 evening — GTH overwrite mid-search fix + internship/school diagnostics (Asia/Shanghai)

1. **GTH majorCategory**: `allowCategoryOverwrite` own-intermediate for entire category write (empty after clear + intended answer). Live profileIndex **5**: verified `readback_reapplied`; **never Save**.
2. **Internship**: soft-skip diagnostics (`hasProfileValue`/`confirmed`/`valuePreview`); zero-ready abort before add. Live: dates empty; org/type/position/description unconfirmed — justified skips.
3. **CMS school**: job fields now carry option_not_found diagnostics; create template present but not sole among fuzzy catalog — fail-soft retained.
4. Synced PC + Edge **003753** + **011002** `extension/`. Version 0.1.4.9. Ask Jeremy? **No**.

## 2026-10-17 evening — CMS internship document_changed false positive (Asia/Shanghai)

1. **Root cause**: opaque `cms_education_document_changed` after confirmed internship dates was mostly a **mislabeled React props proof failure** (`internship_public_props_not_unique`) plus strict href/visibility identity. `documentDiag` showed live==expected (`sameResume:true`) while job still said document_changed.
2. **Fix**: same-resume doc identity (timeOrigin+resumeId); bridge revision 3; record-controller 14 (clear unknown executions); exactTab refocus; VERIFY_PROPS keeps real proof reason; auto rebind once; default skip SW reload (`RELOAD=1` to force).
3. **Live MODE=fill**: 6/6 internship fields **verified** (reapplied); state `partial`; reason `internship_public_props_not_unique` (precise); **Never Save**. Follow-up: harden internship Fiber props uniqueness (separate from document identity).

