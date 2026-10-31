# ATS repeated record binding

Task: `ats-engine-repeat-group-bind-r1`.
Parent: `c35ac70f29a02a4e1d3fc5ac70c8e7d2b5787d4c` (PR #269).
Target branch: `cursor/expand-night-ats-f861`.

The ordinary engine now binds mapped education, work, internship and project
questions to existing record positions. A single empty record can consume source
index zero even when the profile has more records or the page exposes only one
recognized question. Multiple records require independent containers, unique
questions within each record, and a shared question establishing list order.
Missing questions do not shift subsequent record indices.

Both inferred containers and explicit `data-repeat-kind` records retain private
DOM identity and order proofs. The engine checks them before writes, after
awaited profile checks, between native events, during replacement control
binding, and after the final awaited check. Reordering, insertion, deletion or
replacement of a record stops subsequent writes and invalidates its readback.
Hidden records retain their indices. Unknown-only rows, conflicting labels,
unrelated partial fragments and independent unmarked sections remain manual.
Work/internship source type checks and per-field confirmation still apply;
mixed source types are not guessed or reordered.

The basic question “最高学历” resolves to `degree` using the actual confirmed
`education.0.degree` path when there is exactly one education source record.
Missing, unconfirmed or multiple sources remain manual. This basic question and
the education record's degree question may share the fact; duplicate questions
within either target still collide. No top-level profile field is added.

The automatic repeat-row creation path was removed. Filling scans the current
document and never activates edit, new-resume, add-row, save or submit buttons.
Readiness remains advisory, login controls remain unwritable, prompts remain
ineligible labels, and PR #269's education label attachment is retained.
`liveSupportClaimed` stays `false`. No site-specific rules or model-based field
recognition were added.

Changed files in this task:

| Files | Purpose |
| --- | --- |
| `src/content/engine.js` | Record discovery, stable binding, final verification, no automatic add-row action; revision 28 |
| `src/core/matcher.js` | Basic highest-education synonym and confirmed source binding |
| `tests/engine-repeat-group-bind.test.mjs` | 32 synthetic record, mutation, section-boundary, hidden-row and Never-Save cases |
| `tests/matcher-basic-degree.test.mjs` | 7 highest-education mapping, confirmation and collision cases |
| `tests/engine-edu-select-label.test.mjs` | Expanded record cases; real Element/Ant unmarked selects with model and DOM readback |
| `tests/engine-label-resolve.test.mjs` | Single existing education/internship record regression |
| `tests/cms-basic-info-gaps.test.mjs`, `tests/l1-write-route.test.mjs` | Revision reinjection assertions |
| `docs/ATS_ENGINE_REPEAT_GROUP_BIND.md` | Scope, validation commands and limitations |

Validation on the final product source:

```powershell
$env:CHROME_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'

# Related unit, readiness, login, labeling, source and packaging contracts: 486/486
node --test "tests/engine-*.test.mjs" tests/matcher-basic-degree.test.mjs tests/matcher.test.mjs tests/l2-semantics-memory.test.mjs tests/l3-ats-profiles.test.mjs tests/ats-content-advisory.test.mjs tests/auto-form-readiness.test.mjs tests/form-readiness.test.mjs tests/resume-form-flow.test.mjs tests/cms-basic-info-gaps.test.mjs tests/basic-task-readiness.test.mjs tests/ats-basic-auto-wiring.test.mjs tests/product-paths-whitelist.test.mjs tests/guard-worker-auto-runners.test.mjs

# L1 and batch/readback guards: 932/932
node --test "tests/l1-*.test.mjs" "tests/paid-ats-*.test.mjs"

# Internal build: passed, 155 files
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-internal.ps1

# Point explicitly at the build made from these product bytes.
$env:ZOO_EXTENSION=Join-Path (Get-Location) 'dist\edge-internal-v0.1.4.9-20261031-015149\extension'
npm run test:zoo
```

Full zoo result: **131/131 passed**, no skips.
Internal ZIP SHA-256:
`0800e9f239b880c102432db6fa118d30f32b5733e8da1ed96d6e3b43a34a532e`.

All new fixtures contain synthetic placeholders. The record/degree fixtures
assert zero network requests, zero storage writes and zero save/submit/edit/new
button actions. The real-library tests retain independent model and displayed
value verification through the production write/readback bridge.

These are local engineering results. The two externally run Dev acceptance
checks (school AND degree AND major each read back after a write, key-field
readback above 3/12, non-GET zero) remain for Dev to perform. No live acceptance
pass is claimed, and no real page was operated during this task.
