# GTH name action guards: Never-Save evidence

Base: `cursor/expand-night-ats-f861` at
`e115910f3f7bfd9f9cd8fd43ad283571e4ddca3b` (includes #159 and #158).

The existing `tests/gth-basic-month.test.mjs` fixture contains the basic
editor, its name input, neighboring fields, and the shipped full-resume
Never-Save guard. The new cases change those existing nodes during the
`RESUME_PROFILE_BINDING_CHECK` await. No new site DOM or options are inferred.

On the unchanged tip, filling an initially empty name with
`replaceExisting:false` overwrote an applicant edit made during the second
binding check. The result still returned `ok:true`, `writeStarted:true` and a
verified name receipt. The setter and subsequent input/change actions checked
only that their original node remained connected after the binding await.

The basic native-text path now rechecks the current target, exact expected
value, neighboring controls, outside sections, and input length limit inside
each bound action. An edit during the setter check stops before writing; an
edit after the setter stops before the next synthetic event. Write evidence
starts only when the guarded setter actually runs. Existing replacement
authorization applies to the value observed before the action; a later edit
requires another fill attempt.

This is separate from #144's matching-value validation, edit-link guard and
final readback changes. The select/month/category writers and the excluded
salary, skills/other, residence and region capabilities are unchanged.

## Validation

The seven new test groups cover thirteen mutation/control variants. Against
the unchanged tip, six groups failed and the happy-path group passed. After
the fix, the focused command passes 7/7:

```text
node --test --test-name-pattern="name binding|name native fills" tests/gth-basic-month.test.mjs
```

An independent run of the full changed test file passes 20/20 with no failures
or skips. Syntax checks for the changed source and test, and `git diff --check`,
also pass. The inventory changes only the touched product row and the aggregate
checksum, using the LF source bytes that Git commits.

Full offline GTH plus packaging/worker/whitelist/import checks on Windows /
Node v24.20.0 pass **519/519**, with zero failures, cancellations or skips
(178.7 seconds):

```powershell
$gthTestFiles = @(Get-ChildItem tests/gth*.test.mjs | Sort-Object Name | Select-Object -ExpandProperty FullName)
node --test --test-concurrency=2 --test-skip-pattern='smoke rejects a private-key pem' @gthTestFiles tests/build-paid-rebuild.test.mjs tests/guard-worker-auto-runners.test.mjs tests/product-paths-whitelist.test.mjs tests/pack-side-effect-import.test.mjs
```

The fake private-key fixture test is explicitly excluded before execution.
No private keys are generated or read, and no browser or live site is used.

## Missing evidence

- Authenticated live acceptance and event timing for the changed name path.
- Photo/attachment upload acceptance and readback.
- Residence city/district traversal and HK/MO/TW L1-only selection/readback.
- Uncaptured editor fields and picker options.

The existing residence fixture supplies province branches, not the missing
traversal/upload contracts. Those capabilities remain unimplemented/unclaimed.
No live trial is run; `liveSupportClaimed`, Save/submit/delete flags and
`complete` remain false. No existing file is deleted.
