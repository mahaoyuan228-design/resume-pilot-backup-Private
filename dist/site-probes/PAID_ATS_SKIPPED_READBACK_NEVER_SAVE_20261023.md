# Paid ATS: occupied soft-skip final readback (2026-10-23)

Wave6 base: `cursor/expand-night-ats-f861` at
`e4f1b6c3ab05b2ce1287903d77c07d5a0f737107`. Offline only;
`liveSupportClaimed=false`. Production changes are limited to `beisen-2022`
and `feishu-atsx`; existing `moka` behavior supplies the comparison control.

## Evidence and failure

The existing basic fixtures contain name, phone, email, and the untouched
`years=0` neighbor. Their Never-Save suites already exercise occupied skips,
late field events, and same-input item rebinds. Sources:

- [Beisen rebind evidence](BEISEN_2022_REBIND_NEVER_SAVE_20261023.md)
- [Feishu rebind evidence](FEISHU_ATSX_REBIND_NEVER_SAVE_20261023.md)
- [Moka rebind evidence](MOKA_REBIND_NEVER_SAVE_20261023.md)
- `tests/fixtures/{beisen-2022,feishu-atsx,moka}-basic-form.html`
- `tests/paid-ats-skipped-readback.test.mjs`

Reproduction: occupy the existing name input with `  KEEP OCCUPIED  `, then
let the email input event change that name or rebind its existing item.
Beisen and Feishu previously returned `ok=true`, `reason=readback_matched`,
and a stale successful `skipped_existing` name result. Their final checks
only covered written fields. Moka already rejected this state and rolled
back its own phone/email writes.

The new suite uses only existing fixture nodes or clones of those nodes.
It adds no selectors, markup contracts, field types, or native validators.
Before the fix, **10/21 cases failed** (five false successes per affected
adapter); the other 11 controls passed. The failures cover changed values,
raw whitespace changes hidden by normalization, same-input item rebinds,
replacement inputs, and a focus-populated skip changed by a later microtask.
Unchanged occupied values and values populated before their turn/on focus
remain successful soft-skips where already supported.

## Behavior

Both affected adapters retain the exact raw value when a soft-skip is
accepted, including after focus. Final batch readback verifies that value
and the original unique item/input binding. Drift produces
`readback_mismatch`; the existing cleanup restores only owned writes.
Skipped controls, competing values, and rebound/replacement inputs never
become rollback writes. The unchanged `years=0` neighbor and zero
click/submit/programmatic-submit actions are asserted throughout.

This extends skipped-field readback; it does not replace the merged Wave4
ownership/rollback code or duplicate Wave5b native validation.

## Windows validation

Node `v24.20.0`; `CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe`.

- `node --test tests/paid-ats-skipped-readback.test.mjs`: **21/21 passed**.
- The three adapters' `*-basic.test.mjs` and `*-never-save.test.mjs`, plus
  the new suite: **112/112 passed**, no failures/skips, including nine
  existing isolated Chrome synthetic harness cases.
- `ats-basic-auto-wiring`, `build-paid-rebuild`, `guard-worker-auto-runners`,
  `product-paths-whitelist`, `pack-side-effect-import`, and `paid-qa-runner`:
  **69/69 passed**, no failures/skips. QA runner cases use mock drivers;
  no live CMB/GTH/CMS session or shared CDP port was used.
- Separate integration worktree: apply #147 (`e95bd94`), #148 (`6a0753b`),
  and #149 (`c8a227a`) to the pinned base, then apply this source patch.
  Both adapters merge cleanly. Run the trio basic/Never-Save/native-validation
  suites and new suite: **139/139 passed**, no failures/skips. No changes
  were pushed to those PR branches.
- `git diff --check` passed. These are local results, not hosted CI or live
  tenant evidence.

## Missing evidence

- Authenticated resume-edit DOM, tenant field identity/lifecycle, and real
  rebind timing. Beisen/Moka form classes remain provisional; Feishu classes
  are public-bundle-confirmed but authenticated form markup remains unproven.
- Select/dropdown/date/cascader surfaces, Escape dismissal, and option-level
  soft-skips. Harvest packs describe collection plans, not captured controls.
- Repeated sections/multi-row ownership and their neighboring controls.
- Placeholder-value sentinel allowlists. Nonempty prompt-looking text stays
  occupied; a placeholder attribute is not an input value.
- Site-specific error markup, asynchronous tenant validators, masks/business
  rules, and changes arriving after the existing readback window. The microtask
  probe above proves local state detection, not live validator timing.
- Autosave/backend behavior. No live fill, save, submit, next, deliver, or
  delete action was performed; no existing repository files were deleted.
