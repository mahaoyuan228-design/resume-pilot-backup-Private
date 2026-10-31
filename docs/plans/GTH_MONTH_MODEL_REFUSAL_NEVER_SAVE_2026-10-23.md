# GTH month-model refusal: Never-Save evidence

Base: `cursor/expand-night-ats-f861` at `9125d5f13ae56e7394d7596cd0cee9e6bda7859e`.

The existing work month fixture in `tests/gth-work-fill.test.mjs` paints the
chosen month from its cell handler and keeps that text after the panel closes.
Its existing `bridgeStop` hook can return the page-world bridge's documented
`bad-answer`, `rejected`, or `threw` verdict. The full-work guard fixture uses
the same month control structure and allows cancellation of the open editor.
These are offline scheduling/error scenarios; no additional live DOM is claimed.

Before the fix, a refusal for either work-tenure endpoint still returned
`ok: true`: `acceptMonthInPage` reduced these explicit failures to the fallback
`no` result, and the surviving DOM text passed later readback. Both new
regression tests failed against the unchanged writer on the first `bad-answer`
case because the writer returned success.

The shared month writer now treats `bad-answer`, `rejected`, and `threw` as
stops, alongside its existing `dual`, `bad-year`, and `mismatch` stops. It uses
the existing `readback_mismatch` outcome, dismisses the month surfaces, and
leaves later fields unrun. The full-work regression verifies that the editor
can then be cancelled without a forbidden click or network request.

The two new tests cover all three refusal codes at both the start and end
endpoint. They assert that later work fields remain untouched, bridge markers
are removed, and `liveSupportClaimed`, `softwareClickedSave`,
`softwareClickedSubmit`, and `softwareClickedDelete` remain false.

## Fallback boundary and missing evidence

`no-vue`, a missing response, and `unavailable` keep the established fallback
behavior. Existing fixtures include both a month-table click that commits
without a Vue bridge and a painted/typed month that is rolled back on close.
An unavailable bridge is a transport/capability result rather than the three
explicit refusal/error verdicts fixed here. The simple retained-value fixture
can still pass with `unavailable`; the rollback fixture fails readback. A live
Never-Save trace distinguishing those cases is missing, so this change does
not generalize a new fallback policy or claim live support.

No new photo-upload, residence city/district traversal, or HK/MO/TW L1-only
behavior is implemented. There is no additional evidence for those controls
in this change. `liveSupportClaimed=false` remains the boundary.

## Rebase inventory check

The only rebase conflict was `SOURCE_INVENTORY.json`'s aggregate checksum.
The changed month writer's two hash fields match its committed Git blob:
`f90610d30557aaa2fc20a3b9dbf3d5d6b50c037326bbfe4bad5c4d87f99d6fe1`.
All other 156 inventory rows are preserved from the latest base, including
the merged skills/other entries. Recomputing the sorted frozen-product
checksum lines gives the resolved aggregate:
`4a95357063aadcfb401007b7dc97a443ff495dd5094e461375b09a33177cbf0b`.
No existing files are deleted.

## Offline validation

Regression command (red before the fix, green after it):

```text
node --test --test-name-pattern="explicit month-model refusal" tests/gth-work-fill.test.mjs tests/gth-full-work-fill-guard.test.mjs
```

Full GTH regression and packaging checks after the rebase (PowerShell):

```powershell
$gthTestFiles = @(Get-ChildItem tests/gth*.test.mjs | Sort-Object Name | Select-Object -ExpandProperty FullName)
node --test --test-concurrency=2 --test-skip-pattern='smoke rejects a private-key pem' @gthTestFiles tests/build-paid-rebuild.test.mjs tests/guard-worker-auto-runners.test.mjs tests/product-paths-whitelist.test.mjs tests/pack-side-effect-import.test.mjs
```

Windows / Node v24.20.0 result: **506 passed, 0 failed, 0 cancelled, 0 skipped**
in 177.5 seconds across all 39 GTH test files and the four packaging, worker
wiring, whitelist, and side-effect-import files. The private-key fixture case
is excluded by the explicit name pattern before execution; no private keys
are generated or read. Both refusal regressions are included in this run,
covering all three refusal codes at both endpoints with Never-Save flags,
later-field refusal, marker cleanup, and safe discard checks.

The original focused regressions were red against the unchanged writer before
the fix. Syntax checks for the changed writer and both test files, plus
`git diff --check`, pass after the rebase. The product inventory update is
limited to `src/content/gth-open-fill.js` and the aggregate checksum, using
the committed LF source bytes. These are offline results; no live trial or
support claim is made.
