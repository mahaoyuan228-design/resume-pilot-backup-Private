# CMS education CONTROLS daytime offline pack R1

Base `cursor/expand-night-ats-f861` was fetched, the clean workdir was
hard-reset, and HEAD was reverified as
`f6d18bac9819da126539b46982971a66b9eca191` before this work.
Branch: `codex/cms-edu-controls-daytime-pack-r1`.
Never-Save; `liveSupportClaimed=false`.

## Distinct offline evidence gap

The supplied CLEAN `d22734a9` report explicitly records one generic non-GET
in both `nonGet` and `saveLikePost`, zero forbidden clicks, and a successful
school open/close. Its failure propagates to all nine fields; it does not
establish nine independently failing controls. The raw harvest's lookup and
queried autosave URL shapes are already addressed by #178 and #180.

An independent offline reproduction found a separate report-validation gap:
`evidenceExitCode` could return success for a CONTROLS report with missing,
null, or object-valued generic traffic ledgers, or a missing/negative/nonfinite
forbidden-click count. The failed CLEAN report establishes why these explicit
proof fields matter; it does not show that a live run emitted a malformed
report. This change fixes completeness validation, not a new live mechanism.

CONTROLS success now requires explicit empty arrays for both generic traffic
ledgers and a safe integer `clickCount` equal to zero. Existing nonempty traffic
and forbidden-click failures retain their priority. The default text-only
verdict and the #178/#180 classifiers, XHR ownership, suppression, timer,
restoration, and product control paths are unchanged.

The existing fake-CDP success trial supplies the regression evidence using
captured school/select/date shapes and its already documented fictional
events/public props and region scaffold. Mutations remove or corrupt its
traffic/count proof and must fail. The successful path also checks native-hook
descriptors after cleanup, absent trial globals, zero overlays, seven complete
owned probes, nine exact verified fields, and exact serialization restoration.
No DOM, option, response, or site event implementation is added.

## Validation

The baseline audit run, started before edits, passed all nine
`tests/cms-education*.test.mjs` files: **203/203**, zero failures/skips, with
`--test-concurrency=3`.

On the frozen runner/test source, 35 selected host regressions passed with
zero failures/skips, including default text-only success, interception failure,
fatal generic traffic, #178/#180 evidence validation, and the strengthened
controls success case:

```powershell
node --test --test-concurrency=3 --test-name-pattern='fake CDP|host suppression|cleanup cannot erase|missing suppression|failed suppression|cannot produce successful host|cleanup must|malformed cleanup' tests/cms-education-live.test.mjs tests/cms-education-autosave.test.mjs tests/cms-education-controls-live.test.mjs
```

The strengthened controls success case also passed independently (1/1; this
overlaps the 35). It checks 17 malformed-report mutations in that one trial.
All 18 CMS content scripts, the runner, and the changed test pass syntax checks;
`git diff --check` passes. The test runner's existing module-type warning is
unchanged. Generated reports are excluded from the change.

## Daytime evidence still required

1. Verify the reviewed runner/product bytes on the authorized machine. Begin
   with a clean page, native hooks, absent prior trial API, and zero overlays.
2. Run the authorized Never-Save CONTROLS=1 trial with exact fixture originals.
   Capture seven distinct owned visible open/close probes, each with one
   counted opener and observed `mousedown`, `mouseup`, `click`. The supplied
   isolated degree harvest still does not prove a visible degree menu opened.
3. Require bounded #178 lookup suppression and, if attempted inside the
   eligible same owned school/degree invocation, #180 queried-autosave abort
   before native send with the correct control key. Any generic non-GET or
   out-of-window request remains fatal; both generic ledgers must be explicit
   empty arrays and forbidden `clickCount` must be zero.
4. Require nine verified readbacks, exact DOM/public-props/DTO restoration,
   unchanged neighbors, settled callbacks, successful cleanup, zero overlays,
   absent trial API, and restored native hooks.

The unharvested second city menu, opened calendar year/month chooser panels,
differing widget originals, and changed-value widget writes remain outside
this bounded trial. Offline success does not establish native-site support.
No browser/CDP connection, login, paid-path change, tip/main push, CA
substitute, or release acceptance credit is part of this pack.
`liveSupportClaimed=false`.
