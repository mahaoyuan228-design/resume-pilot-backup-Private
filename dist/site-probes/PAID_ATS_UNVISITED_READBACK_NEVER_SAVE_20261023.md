# Paid ATS: unvisited fields after an early failure (2026-10-23)

Wave11 base: `cursor/expand-night-ats-f861` at
`0c2f2fa68cfcb7aa783fccfcda2a61e682675364` (includes #165).
Scope: `beisen-2022`, `feishu-atsx`, and `moka` only.
Offline fixtures; Never-Save; `liveSupportClaimed=false`.

## Evidence and distinct failure

Use the unchanged `tests/fixtures/{beisen-2022,feishu-atsx,moka}-basic-form.html`.
The existing name input event hides its own item, reusing the Never-Save
visibility-failure probe. Its write or cleanup event changes the existing
occupied phone, which the batch never reaches after that failure. The owned
name returns to its original empty value, and the separate `years=0` neighbor
survives. Nevertheless, all three adapters previously returned `restored=true`;
Moka also returned `restoreComplete=true`.

The final 27-case regression suite, loaded against exact-base source, produced
**24 failures / 3 passes**. Every failure reached the assertion that aggregate
restoration must be false; the three unchanged controls passed. Cases cover
write-time and cleanup-time value drift, exact raw whitespace, queued cleanup
drift, equal-value replacement input, same-input item replacement, and an empty
unvisited email populated during cleanup. A second-field failure also proves
that later name rollback can change the sole unvisited email after phone cleanup.

Evidence lineage is the existing basic fixtures, their Never-Save suites, the
three `*_REBIND_NEVER_SAVE_20261023.md` notes, and the paid ATS neighbor/skip
readback suites. Rebind probes only clone existing nodes; no fixture markup,
selector, field type, or tenant lifecycle is invented.

This is the **never-visited planned field** boundary. #152 and #165 observe
accepted `skipped_existing` receipts; these fields have no accepted receipt.
#157 and #160 exclude all planned targets from neighbor snapshots. The original
occupancy, event, ownership, and rollback paths from #116/#117/#119 stay intact.
No native validation from #147/#148/#149 is introduced.

## Behavior and limits

After cleanup, reuse the existing read-only neighbor reader to compare the
original item/input identity and exact preflight raw value of never-visited
planned fields. Beisen/Feishu select their existing failure-skip rows; Moka
selects the remaining snapshots after its stopped loop. Beisen now retains that
initial raw value; Feishu and Moka already have it.

`unvisitedPreserved` and `unvisited` expose this separate observation, using
the existing neighbor readback record schema. Aggregate `restored` and Moka's
`restoreComplete` require preservation. Original failure reasons, result-list
shape, accepted-skip behavior, `neighborsPreserved`, per-owned-field rollback,
and `restoredCount` retain their existing meanings. Unvisited controls receive
no focus, input, change, blur, or cleanup write; competing values are preserved.

A field whose turn was reached and explicitly refused before writing is not
classified as unvisited. Existing replacement-before-turn and reactive-
occupation refusal tests retain their original ownership-only restoration
expectations. This patch does not claim that every unattempted field is covered.
It is an observation after early failure, not a new write or rollback path.

## Local validation

Windows, Node `v24.20.0`; JSDOM only. No browser or CDP process was started.

- `tests/paid-ats-unvisited-readback.test.mjs`: exact-base source **24 failed /
  3 passed**; patched source **27 passed / 0 failed**.
- Selected trio basic/Never-Save, paid ATS readback/neighbor, and wiring suites:
  **245 passed / 0 failed**, including the existing 218 selected tests. The nine
  browser harness cases were excluded by name; Node reports zero skipped tests
  among the 245 selected cases. Existing tests were not edited.
- All new cases assert zero click/submit/programmatic-submit/requestSubmit,
  unchanged `years=0`, zero events on unvisited controls, successful rollback
  of owned fields, and false live support.
- Source/test syntax checks and `git diff --check` passed.
- Local logs: `_temp-scripts/wave11-unvisited-baseline.log` (final suite loaded
  in memory with source read by `git show` from the exact base) and
  `_temp-scripts/wave11-unvisited-selected-tests.log`. No hosted CI or native-
  validation composition is claimed.

```powershell
node --test --test-reporter=spec tests/paid-ats-unvisited-readback.test.mjs

$taskTests = @(
  git ls-files 'tests/beisen-2022*.test.mjs' 'tests/feishu-atsx*.test.mjs' 'tests/moka*.test.mjs' 'tests/paid-ats*.test.mjs' 'tests/ats-basic-auto-wiring.test.mjs'
  'tests/paid-ats-unvisited-readback.test.mjs'
) | Select-Object -Unique
node --test --test-reporter=spec --test-skip-pattern='synthetic harness|synthetic readiness|ambiguous or missing .*fields fail closed' @taskTests
```

## Missing evidence

- Authenticated resume-edit DOM and actual tenant lifecycle/rebind timing.
  Beisen/Moka classes remain provisional; Feishu public-bundle classes do not
  establish authenticated form markup. Harvest packs remain collection plans.
- Escape/open-option cleanup, dropdown/select/date/cascader behavior,
  option-level skips, repeated rows, and placeholder-value sentinel contracts.
- Neighbor contracts for initially hidden/disabled/readonly/multi-input,
  out-of-item, or newly introduced controls. No full-page preservation claim.
- Transient changes reverted between reads, changes after the existing readback
  window, real asynchronous validation, masks, and site error markup.
- Live autosave/backend behavior. No live fill or save/submit/next/deliver/delete
  action occurred. Shared CMB/GTH/CMS sessions and code were untouched; no
  private keys were used or existing repository files deleted.
