# Paid ATS: unowned text-neighbor readback (2026-10-23)

Wave7 base: `cursor/expand-night-ats-f861` at
`9125d5f13ae56e7394d7596cd0cee9e6bda7859e`. Scope: `beisen-2022`,
`feishu-atsx`, and `moka`. Offline only; `liveSupportClaimed=false`.

## Evidence and distinct gap

The unchanged `tests/fixtures/{beisen-2022,feishu-atsx,moka}-basic-form.html`
each contains an unowned text neighbor, `years=0`. The probes attach focus/input/
change/blur handlers to the existing planned fields to alter that neighbor while
the target text still matches. All three adapters previously returned successful
readback for those mutations. Direct fill could also overlook changes to an
existing phone control, which is unowned by a direct name fill.

Sources: the three `*_REBIND_NEVER_SAVE_20261023.md` notes,
[occupied soft-skip readback evidence](PAID_ATS_SKIPPED_READBACK_NEVER_SAVE_20261023.md),
the unchanged basic fixtures, and `tests/paid-ats-neighbor-preservation.test.mjs`.
This covers unowned neighbors outside the current operation. It does not
reimplement #152's planned occupied-field readback, the merged ownership/
rebind/rollback work (#116/#117/#119), or open native-validation PRs #147/#148/#149.

The 39-case suite failed **33/39** on the exact base: **27 false successes**
and **6 cleanup-drift reporting failures**; six unchanged controls passed.
Cases cover direct focus and input/change/blur, batch phone focus and late
microtasks, exact whitespace drift (`0` to ` 0 `), same-input item replacement,
replacement inputs retaining `0`, cleanup-only drift after ordinary target
failure, and another basic field as a direct-call neighbor. Replacement probes
clone existing fixture nodes; no fixture markup or selector contract changes.

## Behavior and scope

Before focus, snapshot the exact raw value and original item/input binding of
uniquely labelled, visible, editable text controls using the adapter's existing
item/input selectors and classifier. Exclude the direct target or all three
batch targets. Private batch calls share the initial neighbor snapshots, so
future planned fields retain their existing occupancy rules.

Read neighbors after focus, target readback, final batch readback, and cleanup.
Drift returns `ok=false`, `reason=neighbor_changed`. Existing rollback still
writes only owned targets; neighbors never enter rollback. `neighborsPreserved`
describes final preservation of the snapshotted controls, and `neighbors` records
`label`, `beforeRaw`, `afterRaw` (the uniquely resolved current value, or null),
`originalAfterRaw`, `preserved`, and a value/binding-change reason. Overall
`restored`/`restoreComplete` cannot be true while a neighbor remains changed;
per-owned-field rollback reports/counts retain their existing meanings.

This is a read-only check over the existing unique-text-control contract, not
a claim to monitor every page control. It adds no observers, selectors, field
types, validator rules, or neighbor writes. Every new case asserts exact raw
neighbor state, zero neighbor focus/input/change/blur events, zero clicks,
zero submits/programmatic submits, and false live support.

## Local validation

Windows, Node `v24.20.0`; `CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe`.

- Final trio `*-basic.test.mjs` / `*-never-save.test.mjs`, skipped-readback, and
  neighbor-preservation suites: **151/151 passed**, no failures/skips, including
  nine existing isolated Chrome synthetic harness cases.
- `ats-basic-auto-wiring`, `build-paid-rebuild`, `guard-worker-auto-runners`,
  `product-paths-whitelist`, `pack-side-effect-import`, and `paid-qa-runner`:
  **69/69 passed**. QA runner cases use mock drivers; no live/shared CDP lane.
- Independent integration worktree: exact base plus native-validation heads
  `e95bd941c6d346347b891f9791a9c2480e1a50e3` (#147),
  `6a0753b91b271763b4d17bd08464ccfe00cb6317` (#148), and
  `c8a227afbfcba728fcabd861a8d398a0d4c65d81` (#149). Overlapping focus/readback
  blocks required manual local composition to retain both native validity
  and neighbor checks; this was not a clean merge. The trio basic/Never-Save/
  native-validation plus skipped-readback and final neighbor suites passed
  **178/178**, no failures/skips. Native PR branches were not modified.
- Independent isolated **Chrome 156.0.8078.47** fixture probes: **24/24** expected
  outcomes before and after, eight scenarios per adapter. Before: **15 false
  successes**, three ordinary cleanup failures, six unchanged/occupied controls.
  After: **zero false successes**, with correct refusal/cleanup reporting and
  preserved controls. Fresh local profile/random CDP port; no neighbor events,
  click, submit, or programmatic submit calls.
- `git diff --check` passed. These are local results, not hosted CI or live
  tenant evidence. No save, submit, next, deliver, or delete action occurred.

## Missing evidence

- Authenticated resume-edit DOM and actual tenant lifecycle timing. Beisen/Moka
  form classes remain provisional; Feishu classes are public-bundle-confirmed
  but authenticated form markup remains unproven.
- Neighbors outside the existing unique visible/editable text-control contract:
  ambiguous labels, hidden/disabled/readonly controls, new controls introduced
  after the snapshot, selects/dropdowns/dates/cascaders, and repeated sections.
  `neighborsPreserved` does not claim full-page preservation.
- Placeholder-value sentinel allowlists, option-level skips, and Escape behavior.
- Transient changes reverted between checks, changes arriving after the existing
  readback window, real asynchronous validators/masks, and site-specific errors.
  Fixture events establish local detection only, not live lifecycle guarantees.
- Autosave/backend behavior. No live fill or shared CMB/GTH/CMS session was used;
  no existing repository files were deleted.
