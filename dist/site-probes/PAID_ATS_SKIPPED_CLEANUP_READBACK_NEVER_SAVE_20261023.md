# Paid ATS: skipped-field receipts after cleanup (2026-10-23)

Wave10 base: `cursor/expand-night-ats-f861` at
`a7c83f4595b5e3dbe0c23264af473be5049ad91d`.
Scope: `beisen-2022`, `feishu-atsx`, and `moka` only.
Offline fixtures; Never-Save; `liveSupportClaimed=false`.

## Evidence and distinct failure

Use the unchanged `tests/fixtures/{beisen-2022,feishu-atsx,moka}-basic-form.html`
and occupy its existing name input with `  KEEP OCCUPIED  `. The existing
email input event hides that email item's ancestor, reusing the visibility
failure exercised by the Never-Save suites. During owned phone rollback,
its input event changes the skipped name. Phone and email are restored to
their original empty values, and the untouched `years=0` neighbor survives.

At the exact base, all three adapters return `ok=false` but `restored=true`;
Moka also returns `restoreComplete=true`. The name result remains a stale
successful `skipped_existing` even though its actual value or item/input
binding changed during cleanup. This is a false complete-restoration report,
not a false successful-fill report.

Evidence lineage:

- The three `*_REBIND_NEVER_SAVE_20261023.md` notes and existing Never-Save
  suites establish the fixture visibility-failure and existing-node clone/move
  probe methods. No fixture markup or new selectors are introduced.
- `PAID_ATS_SKIPPED_READBACK_NEVER_SAVE_20261023.md` and its suite establish
  accepted occupied raw values and binding receipts. #152 checks them before
  batch cleanup; it does not check changes caused by cleanup itself.
- `PAID_ATS_NEIGHBOR_PRESERVATION_NEVER_SAVE_20261023.md` and
  `PAID_ATS_AMBIGUOUS_NEIGHBORS_NEVER_SAVE_20261023.md` establish cleanup-only
  neighbor drift probes and the aggregate restoration guard. #157/#160 exclude
  all planned controls from those neighbor snapshots, including occupied skips.

This change closes that post-cleanup reporting boundary. It does not change
occupancy decisions, write ownership, event dispatch, or rollback execution
from #116/#117/#119, and it adds no native validation from #147/#148/#149.

## Behavior

Retain the accepted skipped-result references before the existing final
readback can replace their `reason`. After cleanup, check each original
item/input binding and exact accepted raw value again. Beisen and Feishu
reuse the skip's `afterRaw`, including values populated on focus. Moka uses
its existing original raw snapshot, since its pre-write checks reject value
changes before the field's turn and on focus.

Drift invalidates the skipped result with `readback_mismatch` and prevents
aggregate `restored`/`restoreComplete` from being true. The skipped input and
any competing or replacement value are never written or added to rollback.
Per-owned-field cleanup results and Moka's `restoredCount` retain their
existing meanings. `neighborsPreserved` still describes the separate
neighbor snapshots; an unchanged `years` neighbor remains preserved.

## Local validation

Windows, Node `v24.20.0`; JSDOM only. No browser or CDP process was started.

- New suite `tests/paid-ats-skipped-cleanup-readback.test.mjs`: exact-base
  source **20 failed / 8 passed**; patched source **28 passed / 0 failed**.
- Cases cover value and exact whitespace changes, existing-input replacement,
  same-input item clone/move, a queued cleanup change, and a receipt already
  marked as mismatched before cleanup. Controls preserve complete owned
  rollback for unchanged skips and unchanged all-occupied no-write success.
  Beisen/Feishu additionally verify accepted focus-populated receipts.
- All cases assert Never-Save flags, zero click/submit/programmatic submit/
  requestSubmit, no skipped-name input/change or cleanup events, preserved
  competing values, and unchanged `years=0`. Existing occupied names receive
  no focus/blur either; focus-populated controls permit their existing
  focus/blur behavior only.
- Selected trio basic/Never-Save, paid ATS, and wiring suites:
  **218 passed / 0 failed**. This includes the existing **190** selected cases
  plus the new **28**. Nine browser harness cases are excluded by name; Node
  reports 218 selected tests and zero skips. No native-validation composition
  or hosted CI result is claimed.
- Source/test syntax checks and `git diff --check` passed.

Reproduce the new suite:

```powershell
node --test tests/paid-ats-skipped-cleanup-readback.test.mjs
```

Reproduce the selected offline suite (the explicit new path also works before
the new test is tracked; `Select-Object -Unique` avoids duplicates afterward):

```powershell
$taskTests = @(
  git ls-files 'tests/beisen-2022*.test.mjs' 'tests/feishu-atsx*.test.mjs' 'tests/moka*.test.mjs' 'tests/paid-ats*.test.mjs' 'tests/ats-basic-auto-wiring.test.mjs'
  'tests/paid-ats-skipped-cleanup-readback.test.mjs'
) | Select-Object -Unique
node --test --test-reporter=spec --test-skip-pattern='synthetic harness|synthetic readiness|ambiguous or missing .*fields fail closed' @taskTests
```

## Missing evidence and limits

- Authenticated resume-edit DOM and real tenant lifecycle/rebind timing remain
  unavailable. Beisen/Moka classes remain provisional; Feishu public-bundle
  class evidence does not establish authenticated form markup. Harvest packs
  remain collection plans, not captured controls.
- No Escape/open-option cleanup, dropdown/select/date/cascader, option-level
  skip, repeated-section/multi-row ownership, or placeholder sentinel contract.
- No new contract for hidden/disabled/readonly/multi-input/out-of-item neighbors
  or controls added after snapshots. No full-page preservation claim.
- Transient changes reverted between checks, changes after the existing
  readback window, real asynchronous validators, masks, and site error markup
  remain unproven. The queued fixture probe is local evidence only.
- Live autosave/backend behavior remains unknown. No live fill or save/submit/
  next/deliver/delete action occurred; no private keys used or existing files
  deleted. Shared browser sessions and CMB/GTH/CMS code were untouched.
