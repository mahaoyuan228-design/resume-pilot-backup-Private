# Paid ATS: duplicate-label neighbor readback (2026-10-23)

Wave8 base: `cursor/expand-night-ats-f861` at
`6afc461c9a686312bb984945d75a43704b45fa78` (includes #157).
Scope: `beisen-2022`, `feishu-atsx`, and `moka` only.
Offline fixtures; `liveSupportClaimed=false`.

## Evidence and distinct gap

Each unchanged `tests/fixtures/{beisen-2022,feishu-atsx,moka}-basic-ambiguous.html`
already contains two separate items labelled 姓名 (`fullName-a=KEEP-A` and
`fullName-b=KEEP-B`) plus one unique 手机号码 input. Clear only that existing
phone value, then attach a focus/input/change/blur handler that changes one
name. A direct phone fill previously returned success and
`neighborsPreserved=true` because #157's unique-label neighbor classifier
excluded both names.

This is the duplicate-label boundary explicitly left outside #157. It does
not redo planned occupied-field readback (#152), native validation
(#147/#148/#149), or write ownership/rebind/rollback (#116/#117/#119).
The three `*_REBIND_NEVER_SAVE_20261023.md` notes supply the existing
node-clone/move probe method. Rebind cases clone existing items/inputs or
swap the two existing inputs; no fixture markup, selectors, labels, or
control types are added.

At the exact base, `tests/paid-ats-ambiguous-neighbors.test.mjs` failed
**27/39** cases: **24 false successes** and **3 cleanup-only neighbor-drift
reporting failures**. Twelve controls passed. Cases cover raw whitespace
drift, either duplicate, a queued microtask, equal-value input replacement,
same-input item replacement, swapping existing equal-value inputs, and
neighbor changes during ordinary target-failure cleanup.

## Behavior and limits

For a duplicate label, snapshot each existing item's single visible,
editable text control by item/input identity and exact raw value. Re-read
that same item and label; never resolve it through another item with the
same caption. Existing unique-label snapshots retain their classifier.

The existing focus, immediate/final readback, and cleanup checks consume
these read-only snapshots. Drift returns `neighbor_changed`; only the
owned target enters existing rollback. A changed neighbor prevents a full
restoration claim even if the owned phone is restored. Duplicate name
targets and the incomplete batch fixture remain blocked. Unchanged
duplicates permit the unique phone fill or its occupied skip.

This adds no neighbor writes, new selector, validation rule, event
dispatcher, or rollback path. It does not authorize filling repeated
sections. Every regression checks zero neighbor focus/input/change/blur,
zero click/submit/programmatic submit/requestSubmit, and Never-Save flags.

## Local validation

Windows; Node `v24.20.0`; `CHROME_PATH=C:Program FilesGoogleChromeApplicationchrome.exe`.

- New duplicate-neighbor suite: **39/39 passed**, no failures/skips.
- Trio basic/Never-Save suites plus skipped-readback, #157 neighbor
  preservation, and the new suite: **190/190 passed**, no failures/skips,
  including nine existing isolated Chrome synthetic harness cases.
- `tests/ats-basic-auto-wiring.test.mjs`: **9/9 passed**.
- Separate local integration at the exact base, using the native-validation
  composition already recorded in `afc3317` for heads
  `e95bd941c6d346347b891f9791a9c2480e1a50e3` (#147),
  `6a0753b91b271763b4d17bd08464ccfe00cb6317` (#148), and
  `c8a227afbfcba728fcabd861a8d398a0d4c65d81` (#149).
  The Wave8 source patch applied to that composition without conflicts.
  The above trio suites plus all three native-validation suites passed
  **217/217**, no failures/skips. This reuses a previously manual native/#157
  composition; it is not a claim that the original native PRs now merge
  cleanly. Native branches and the shared integration worktree were untouched.
- Independent Chrome **156.0.8078.47** probes loaded the unchanged ambiguous
  fixtures with exact-base and patched source: **48/48 expected outcomes**,
  eight scenarios per adapter per revision. Before: **15 false successes**,
  three ordinary cleanup failures, six unchanged/occupied controls. After:
  **zero false successes**, all 18 drift/cleanup cases refused correctly.
  Fresh temporary profile and random local CDP port; no shared/live CDP.
  Local artifacts: `_temp-scripts/wave8-ambiguous-browser-probe.mjs`
  and `_temp-scripts/wave8-ambiguous-browser-results.json`.
- Source syntax checks and `git diff --check` passed.
  These are local results, not hosted CI or authenticated tenant evidence.

Reproduce the new regression suite from the repository root:

```powershell
node --test tests/paid-ats-ambiguous-neighbors.test.mjs
```

## Missing evidence

- Authenticated resume-edit DOM and tenant rebind/validation timing.
  Beisen/Moka form classes remain provisional; Feishu's public-bundle
  classes do not establish authenticated form markup.
- Escape dismissal, dropdown/select/date/cascader surfaces, option-level
  soft-skip cleanup, and actual repeated-section/multi-row ownership.
  Duplicate labels in the existing synthetic fixture do not prove those
  site contracts.
- Placeholder-value sentinel allowlists. Nonempty prompt-looking values
  remain occupied.
- Neighbor contracts for hidden/disabled/readonly controls, multiple
  eligible inputs inside one item, new controls after the snapshot, and
  controls outside the existing item selectors. No full-page preservation
  claim.
- Transient changes reverted between checks, real asynchronous validators,
  masks/business rules, site error markup, and changes after the current
  readback window.
- Live autosave/backend behavior. No live fill or save/submit/next/deliver/
  delete action; no private keys used and no existing repository files deleted.
