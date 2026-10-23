# GTH gender action guard: Never-Save evidence

Base: `cursor/expand-night-ats-f861` at
`a7c83f4595b5e3dbe0c23264af473be5049ad91d` (includes #162, #161 and #160).
Branch: `codex/gth-gender-never-save`.

The existing `tests/gth-basic-month.test.mjs` fixture supplies the basic
editor, its two gender radio labels, neighboring fields and the full-resume
Never-Save guard. The added cases mutate those existing nodes during
`RESUME_PROFILE_BINDING_CHECK`; they infer no new live DOM or option set.

On the unchanged base, a fill of an initially empty gender field overwrites
an applicant's selection made during the click's binding check and returns
`ok:true` with a verified gender receipt. A peer edit still permits the click
before the later readback fails. Refusing the binding check clicks nothing
but incorrectly reports `writeStarted:true`.

The radio action now checks the unchanged full snapshot after the binding
await, resolves the requested option again, and verifies both its input and
label identities and current enabled state. Swapped captions or a replacement
label cannot redirect the click. Write evidence begins immediately before the
guarded click. No intermediate radio value is authorized before that action,
including when replacement of the preflight value was explicitly requested.

This fixes the gender action boundary. The already merged name, validation,
salary, month-refusal, skills/other and category fixes remain intact.

## Validation

The six new test groups cover fifteen mutation/control variants: selections
made before empty fill or overwrite, peer edits, disabled/hidden options,
swapped captions, replacement/reparenting, binding denial, and normal empty
or explicitly authorized replacement fills. On the unchanged base, five
groups fail and the normal-fill group passes. With the fix, all six pass:

```text
node --test --test-name-pattern="gender binding|gender radio fills" tests/gth-basic-month.test.mjs
```

The unmodified base's complete offline GTH suite passes 488/488. The final
offline GTH plus packaging/worker/whitelist/import run passes **525/525** with
zero failures, cancellations or skips (178.9 seconds), on Windows / Node
v24.20.0:

```powershell
$gthTestFiles = @(Get-ChildItem tests/gth*.test.mjs | Sort-Object Name | Select-Object -ExpandProperty FullName)
node --test --test-reporter=tap --test-concurrency=2 --test-skip-pattern='smoke rejects a private-key pem' @gthTestFiles tests/build-paid-rebuild.test.mjs tests/guard-worker-auto-runners.test.mjs tests/product-paths-whitelist.test.mjs tests/pack-side-effect-import.test.mjs
```

Git for Windows `cmd` is on the process PATH. The fake private-key fixture test
is excluded before execution. No private keys are generated or read. Syntax
checks and `git diff --check` pass. The inventory changes only the touched GTH
product row and aggregate checksum; its digest matches Git's staged LF bytes.

## Missing evidence

- Authenticated live gender acceptance and event timing.
- Photo/attachment upload acceptance and readback.
- Residence city/district traversal and HK/MO/TW selection/readback.
- Uncaptured editor fields and picker options.

Checked-in photo controls, province branches and HK/MO/TW labels prove their
existence, not the missing upload or selection contracts. Those capabilities
are skipped by this change. No live trial is run. `liveSupportClaimed`,
Save/submit/delete flags and `complete` remain false. No existing file is
deleted, and no private keys are generated or read.
