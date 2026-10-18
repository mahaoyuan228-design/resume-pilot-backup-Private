# GTH education path readiness (国泰海通 hr.gtht.com)

Date: 2026-10-17 (Asia/Shanghai)  
Scope: offline map + attachment-outside refresh fix + harness. **Do not Cancel/Save/submit on live GTH until Jeremy explicitly runs a one-shot.**

## Code map (fill → save → refresh)

| Stage | Module | Messages / entry |
| --- | --- | --- |
| Serial parent (exactly 2 education steps) | `src/background/gth-serial-runner.mjs` | `GTH_SERIAL_V012_START` / `STATUS` |
| One step: open/mark → fill → inspect → save → refresh | `src/background/gth-serial-step.mjs` | injects `gth-education.js` then `gth-draft-save.js` |
| Field fill (editor left open) | `src/content/gth-education.js` | `GTH_EDUCATION_FULL_TRIAL` / `STATUS` |
| Draft inspect / Save / prepareRefresh / verifySaved | `src/content/gth-draft-save.js` | `GTH_EDUCATION_DRAFT_*` |
| MAIN-world metadata (no DOM write) | `src/background/gth-draft-metadata.mjs` | `GTH_DRAFT_SAVE_METADATA_READ` |
| Post-save reload + verify orchestration | `src/background/gth-education-refresh-coordinator.mjs` | `completeSavedEducationPhase` |
| Popup batch UI | `src/popup/gth-batch-education-actions.js` | 2 explicit bindings only |
| Single-record draft job UI | `src/popup/gth-education-actions.js` | inspect / save / resume_refresh |

Page lock: `https://hr.gtht.com/resume/edit/` only. Sections titles must be exactly: 基本信息 / 教育经历 / 求职意向 / 工作经验 / 职业技能与特长 / 附件简历 / 其他信息.

## Historical failure: `draft_refresh_original_outside_mismatch`

**Symptom:** First education Save reached `server_verified_needs_refresh` with `onlyAttachmentTextChanged=true` / `refreshSafe=true`, but after `tabs.reload` verify stopped with `draft_refresh_original_outside_mismatch`. Serial step 2 never started.

**Root cause:** On Save, outside-section footprints allow attachment (index 5, 附件简历) **text-only** drift and store both `originalOutsideHash` and `postSaveOutsideHash`. `prepareRefresh` correctly uses `postSaveOutsideHash`. `verifySaved` after reload incorrectly required outside === `originalOutsideHash` only. Real site keeps the new attachment display name across reload; the offline fixture previously **reset** section 5 text on reload, masking the bug.

**Fix (this pass):** `refreshOutsideOk` in `gth-draft-save.js` accepts original hash **or** (`onlyAttachmentTextChanged` && post-save hash) on all post-reload outside checks. Fixture option `persistAttachmentAcrossReload` models the real site. Tests in `tests/gth-refresh-attachment-outside.test.mjs`.

## Why second education record never ran

`gth-serial-runner.mjs` runs bindings sequentially under one parent lease. Any throw in step 0 (including refresh verify) sets job `unknown` / stops before step 1. Fixing attachment-outside verify is the prerequisite for step 2.

## Offline readiness checklist

- [x] Map fill/save/refresh + failure mode documented (this file)
- [x] Reproduce attachment-persist mismatch offline (fixture + test)
- [x] Product verify accepts eligible post-save outside hash
- [x] Chinese explain for `draft_refresh_original_outside_mismatch` / `draft_refresh_outside_change_not_eligible`
- [x] Existing `gth-refresh-sections-ready` still PASS
- [ ] Live GTH: focused Edge, logged-in edit page, **one** controlled single-record inspect→save→refresh (no job submit) — **Jeremy only**
- [ ] Live serial: two bindings after single-record PASS
- [ ] CMS education closed-loop evidence still preferred before routine GTH Save (product ranking)

## One-shot live script for Jeremy (only when he asks)

Constraints: no Cancel/Save until this checklist is followed; no 投递/submit ever in this path.

1. Edge with unpacked build that includes patched `src/content/gth-draft-save.js` (reload extension after copy).
2. Open `https://hr.gtht.com/resume/edit/` while logged in; leave tab focused and visible; close any open editors manually first.
3. Popup → GTH education: prefer **single-record** trial first (not batch). Fill one education row → Inspect only → read Chinese status.
4. If Inspect ready: **one** Save (draft only). Expect refresh verify completed; note whether 附件简历 display name changed.
5. If success: optional second record or batch of exactly two. If `draft_refresh_original_outside_mismatch` or unknown: **stop**, do not re-Save; paste reason code to chat.
6. Escalate with「我需要帮助！」only if login/session or captcha blocks the edit page.

## Explicit non-goals this pass

- No live Cancel/Save/submit from agents.
- No WHITELIST / version bump (stay 0.1.4.9 until release decision).
- No whole-site serial (basic/intent/work/attachment still not in serial).

## Auto path (this pass) — inspect / readiness first

| Piece | Role |
| --- | --- |
| `GTH_EDUCATION_AUTO` | Background one-shot from `src/auto/gth-education-auto.html` |
| Modes | `readiness` (default, inspect-only) · `fill` (FULL trial, no Save) · `inspect` (draft preflight only) |
| Launcher | `scripts/auto-gth-education.mjs` → `dist/auto-runs/gth-*.json` |
| Save | **Never** from auto. Policy module `gth-save-policy.mjs` keeps `saveAllowedByPolicy:false` (deferred); dry-run may show `readyToSave:true` with `wouldClickSave:false` / `saveAttempted:false` |
| Login wall | `helpNeeded:true` + exact `helpUrl` → parent「我需要帮助！」 |

```bash
# On Jeremy PC (Edge profile with loaded 003753):
cd .../resume-autofill-dev
node scripts/auto-gth-education.mjs
# MODE=fill PROFILE_INDEX=5 node scripts/auto-gth-education.mjs   # fill-without-save + draft inspect
```

Offline checklist addendum:
- [x] Auto HTML/JS + background runner + launcher
- [x] WHITELIST / build-internal include GTH auto files
- [ ] Live readiness JSON from logged-in `hr.gtht.com/resume/edit/`
- [x] Live fill-without-save (optional) still no Save until Jeremy one-shot — 2026-10-17 evening completed/verified; majorCategory soft-skipped then overwrite-clear path added for replaceExisting; draft readyToSave

## Save policy scaffolding (offline, 2026-10-17)

| Piece | Role |
| --- | --- |
| `src/background/gth-save-policy.mjs` | `evaluateGthSavePolicy` — currently **deferred hard deny**; lists future conditions (CMS closed-loop evidence, draft ready, Jeremy one-shot, not auto) |
| `gthSaveDryRunStatus` | Inspect/fill-without-save: `readyToSave` may be true; `wouldClickSave` always false on auto |
| `assertAutoNeverAttemptedSave` | Auto report guard — throws if `saveAttempted` / `softwareClickedSave` / policy true while deferred |
| Product ranking | Do **not** flip deferred until CMS education closed-loop evidence + Jeremy explicit one-shot (this file checklist) |

Tests: `tests/gth-save-policy.test.mjs`.

## Multi-row / alsoProfileIndexes parity (2026-10-17 evening)

| Question | Answer |
| --- | --- |
| Does GTH auto accept `alsoProfileIndexes` like CMS? | **No** — intentional. GTH fill opens **one** editor at a time (`GTH_EDUCATION_FULL_TRIAL`); CMS education runs a multi-record plan in one controller pass. |
| Equivalent multi-row path | Popup **serial/batch** (`gth-serial-runner` + `gth-batch-education-actions`) already binds **exactly two** education steps. Auto stays single `profileIndex` + optional `rowIndex`. |
| Live multi evidence this pass | **PASS 2026-10-17 21:11**：edu-scope fix；p5 row0 + p4 new fill-wo-save completed/verified；saveAttempted=false. Popup serial still saves → not used. No QR ask. |
| Save | Still never from auto; `gth-save-policy` deferred. |

Evidence note: single-index fill evidence already in `dist/auto-runs/gth-latest.json`. Dual fill previously failed `editor_structure_changed` (fixed offline late evening); re-prove live with ROW_INDEX 0+1 fill-wo-save. Save ranking unchanged.


## Basic auto path (2026-10-17 evening) — beyond education

| Piece | Role |
| --- | --- |
| `GTH_BASIC_AUTO` | Background one-shot from `src/auto/gth-basic-auto.html` |
| Modes | `readiness` (default) · `fill` (GTH_BASIC_TRIAL, no Save) |
| Launcher | `scripts/auto-gth-basic.mjs` → `dist/auto-runs/gth-basic-*.json` |
| Scope | Six operable fields (姓名/性别/手机/出生年月/邮箱/最高学历); city/photo/workStart unsupported |
| Save | **Never** from auto; `saveAllowedByPolicy:false` |
| Login wall | `helpNeeded:true` + helpUrl — Ask Jeremy QR/login only |

```bash
# On Jeremy PC (Edge profile with loaded 003753):
cd .../resume-autofill-dev
node scripts/auto-gth-basic.mjs
# MODE=fill EDUCATION_INDEX=5 node scripts/auto-gth-basic.mjs
```

## Editor scope harden (2026-10-17 late evening)

| Piece | Role |
| --- | --- |
| Content `forms()` | Education-section only (parity with probe `eduForms`) |
| `clearForeignEditors` | Dismiss other-section + wrong-row editors via **取消** only before fill; never Save |
| Dual fill-wo-save | Use `ROW_INDEX=0` then `ROW_INDEX=1` with PROFILE_INDEX 5 then 4; popup serial still saves → skip |
| Live multi 5% | Re-run after Edge reload; bump only with verified fields + saveAttempted=false |



## Intent auto path (2026-10-17 late evening)

| Piece | Role |
| --- | --- |
| `GTH_INTENT_AUTO` | Background one-shot from `src/auto/gth-intent-auto.html` |
| Modes | `readiness` (default) · `fill` (`GTH_INTENT_TEST`, no Save) |
| Launcher | `scripts/auto-gth-intent.mjs` → `dist/auto-runs/gth-intent-*.json` |
| Scope | Five questions（期望从事职位类别/期望薪资/现从事行业/现从事职位类别/现薪资）via product engine route |
| Save | **Never** from auto; dry-run UI clarifies readyToSave ≠ wouldClickSave while deferred |
| Login wall | `helpNeeded:true` + helpUrl — Ask Jeremy QR/login only |

```bash
# On Jeremy PC (Edge profile with loaded 003753):
cd .../resume-autofill-dev
node scripts/auto-gth-intent.mjs
# MODE=fill node scripts/auto-gth-intent.mjs   # requires five confirmed site facts
```

### Live evidence (Asia/Shanghai)

| When | Result |
| --- | --- |
| Live readiness 2026-10-17 21:37 | **PASS** pageState=ready; writeAttempted=false; saveAttempted=false; intent readyCount **1/5** (期望薪资 only); fill **not run** (no invent) |
| Artifact | `dist/auto-runs/gth-intent-auto-20261017-213754.json` |
