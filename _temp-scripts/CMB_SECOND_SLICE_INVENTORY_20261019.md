# CMB second-slice offline inventory · 2026-10-19 (Asia/Shanghai)

Quiet box inventory for trimming **Codex Q** (CMB second-slice next offline knives) when harvest returns.  
**Not** a site-support claim. **Never Save.** Do not change remotes / push.

Sources: `/workspace/resume-autofill` (docs + first-slice source), `dist/site-probes/*CMB*`, `_temp-scripts/*CMB*`, remote PR#3 branch `cursor/expand-night-ats-f861` (read-only via GitHub API). Local tree has **no** `.git`.

---

## 0. Checkout status

| Surface | State |
| --- | --- |
| `/workspace/resume-autofill` | **No `.git`**. `src/content/cmb-*.js|mjs` + local fixture/tests = **first-slice only** (姓名/手机号/邮箱). 体重 in fixture is neighbor baseline (must stay untouched by first-slice fill). |
| Local `cursor/expand-night-ats-f861` | **No local checkout** of PR#3 branch. |
| Remote PR#3 | https://github.com/mahaoyuan228-design/resume-pilot-backup-Private/pull/3 · draft · head **`21555eaac5`** (2026-10-19 15:27 Asia/Shanghai) — latest tip is Celebright prep docs, not CMB. |
| CMB offline knives on remote branch (SHAs) | first-slice `b7d7f4b2c2` / `912fd1ccee` · gender `7fa6977692` · height `161b953e44` · weight `1432e2d51d` · formalWork `9af0de3199` · RankingMajor missing note `0a18323542` · 10 Select click gate through `18e96b2124` / `a7456ae9a1` (probe pack). |

---

## 1. Wired offline (synthetic / planner) — on PR branch; **not** in local `src/`

Treat these as already landed for Codex Q “已有合成刀” — next knives = edge-case tests / fail codes, **not** re-implement fill.

### First slice (text)
| Field | Profile path | Notes |
| --- | --- | --- |
| 姓名 | `fullName` | dry-fill; save-locks after persist |
| 手机号 | `phone` | |
| 邮箱 | `email` | |

### Second-slice text / radio (offline synthetic; live radio DOM **not** harvested as contract)
| Field | Profile path | Control (synthetic) | Live DOM id (harvested ids only) | Land commit |
| --- | --- | --- | --- | --- |
| 性别 | `gender` | radio 男/女 | `resume_basicInfo_gender` (ant-radio-group) | `7fa6977692` |
| 身高 | `height` | text digits-only; unit on label (CM) | `resume_basicInfo_height` | `161b953e44` |
| 体重 | `weight` | text digits-only; unit on label (KG) | `resume_basicInfo_weight` | `1432e2d51d` |
| 是否参加过正式工作 | `formalWork` | radio 是/否 | `resume_basicInfo_hasFormalWork` | `9af0de3199` |

### Dict Select (offline wired + live click evidence / gate on branch)
10 fields with evidence under `dist/auto-runs/cmb-live-select-*-latest.json` and `CMB_LIVE_SELECT_CLICK_EVIDENCE_20261019.md`:  
婚姻状况 · 政治面貌 · 民族 · 证件类型 · 学历 · 招聘信息来源 · 面试期望城市 · 获奖级别 · 关系类型 · 最高英语水平.  
Harness: evidence gate / unclaim rules (Codex H). **Still Never Save; still not “site supported”.**

---

## 2. Remaining offline candidates (≤5 for Codex Q trim)

Per `CODEX_DRAFT_CMB_SECOND_SLICE_Q_20261019.md` / prompt Q — expand **cases** on already-wired second-slice fields (proposed fail codes are **namesakes**, align before landing):

| # | Field | Why still offline-able | Proposed fail codes (draft) | Do not |
| --- | --- | --- | --- | --- |
| 1 | 身高 | empty / non-numeric / unit-in-value cases | `VALUE_EMPTY` · `NUMBER_INVALID` · `UNIT_UNMAPPED` | invent live range; auto-pad |
| 2 | 体重 | decimal / unit / garbage text | `NUMBER_INVALID` · `UNIT_UNMAPPED` | unit conversion |
| 3 | 性别 | mapping / unique hit / mutual exclusion | `OPTION_UNMAPPED` · `RADIO_AMBIGUOUS` | default gender; pick by index |
| 4 | 是否参加过正式工作 | same radio rules; no infer from age/work | `OPTION_UNMAPPED` · `RADIO_AMBIGUOUS` | infer from internship/age |
| 5 | (optional) neighbor isolation | 身高/体重/性别/正式工作 must not clobber each other or first-slice | fixture assertions | touch 证件* / cascades |

**Not** offline candidates for Q: re-wiring the 10 Selects; RankingMajor selector invent; birthDate DatePicker automation; cms/gth edits.

---

## 3. Live-only / blocked

| Item | Status | Evidence |
| --- | --- | --- |
| **RankingMajor** | **`DOM_CONTROL_MISSING`** | Dict has 3 rows (前20%/中等/中下等) in `cmb-dictmap-*-20261019.json`; **no** matching control in `cmb-remaining-dom-ids-20261019.json` / resumeIds. Probe pack: `dist/site-probes/CMB_RANKINGMAJOR_PROBE_PACK_20261019.md`. **Do not guess selector.** |
| 出生日期 | live / hint-only | planner `datepicker_hint_only`; harvest `cmb-harvest-birthDate.json` |
| Live gender / formalWork radio contract | unclaimed as live | synthetic CSS candidates only; live ids known but interaction not claimed |
| 生源地/出生地/现居住地 | refuse (cascade) | field map + second-slice plan |
| 证件号 | never fill | lock risk with 证件类型 |

---

## 4. Docs / tests / probes touched (box)

**Tests/docs mentioning height·weight·gender·formal·RankingMajor·second slice**
- Plans: `dist/site-probes/CMB_SECOND_SLICE_PLAN_20261019.md`, `cmb-field-map-20261019.md|.json`, `EXPAND_CMB_ADAPTER_DESIGN.md`
- Codex Q: `_temp-scripts/CODEX_PROMPT_Q_CMB_SECOND_SLICE_20261019.md`, `dist/site-probes/CODEX_DRAFT_CMB_SECOND_SLICE_Q_20261019.md`, `CODEX_TRIM_CMB_SECOND_SLICE_Q_20261019.md`
- RankingMajor: `CMB_RANKINGMAJOR_PROBE_PACK_20261019.md`, `CODEX_*_CMB_RANKING_M_*`, `CMB_DICT_REMAINING_TRIM_20261019.md`
- Live gated: `_temp-scripts/CMB_LIVE_GATED_FIELDS_DRAFT_20261019.md` (notes Private branch has gender/height/weight synthetics)
- Local tests: `tests/cmb-basic.test.mjs` — **first-slice only** on box; PR branch tests cover synthetics (e.g. formalWork 37/37 note in `b98acd106c`)

**site-probes packs with RankingMajor / second slice**
- Present: `CMB_SECOND_SLICE_PLAN_20261019.md`, `CODEX_DRAFT_CMB_SECOND_SLICE_Q_20261019.md`, `CMB_RANKINGMAJOR_PROBE_PACK_20261019.md`, `CODEX_TRIM_CMB_RANKING_M_20261019.md`, `CODEX_TRIM_CMB_SECOND_SLICE_Q_20261019.md`, dict/live evidence md+json under `dist/site-probes/` and `_temp-scripts/cmb-*`

---

## 5. Never Save reminder

- Content/harness: **never** click 保存 / 提交. Fill-wo-save only.  
- Page warns 姓名/证件类型/证件号 lock after save.  
- RankingMajor existence probe: read-only snapshots; no expand/fill/save.  
- Customer sellable surface remains **CMS + GTH only** — CMB stays offline/scaffold + gated experiments, **not** “已支持”.

---

## 6. Trim hint for Codex Q (when harvest returns)

Keep Q output to: (a) ≤5 offline **edge knives** on 身高/体重/性别/正式工作; (b) RankingMajor live-only `DOM_CONTROL_MISSING` row; (c) 不要做 = Never Save / no cms-gth / no selector guess / no re-claim of 10 Selects. Align proposed fail codes to engine before merge. Sync local box `src/` from PR branch before running those tests here.
