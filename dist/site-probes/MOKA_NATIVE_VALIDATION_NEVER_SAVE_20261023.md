# Moka: native validation refusal, Never-Save (2026-10-23)

Follow-up to merged PR #119; baseline source head `e6e1085`. Based on `cursor/expand-night-ats-f861` at `c066007`. Offline only; `liveSupportClaimed=false`.

## Evidenced gap

The unchanged `tests/fixtures/moka-basic-form.html` already has `input[type="email"][name="email"]`. Before this change, both direct fill and a confirmed-profile/explicit batch accepted `not-an-email` and reported successful text readback, although the input's native `validity.typeMismatch` was true. Batch fill also wrote the earlier name and phone before returning that false success.

Native `setCustomValidity` refusals on those same fixture inputs were also ignored when their text still matched. Those lifecycle cases are adversarial offline probes, not a claim about tenant validation behavior. The `.moka-form-item` contract is provisional; public recruitment bundles do not confirm these form classes.

## Change

- Validate proposed values on a detached shallow clone of the existing input, using its own attributes and native validity. Check the original input's custom error as well. No new selectors, field markup, email regex, telephone rules, or attributes.
- Refuse an invalid empty field during batch preflight before any field receives focus or writes. Direct fill checks before focus and again before writing.
- Require native validity at immediate and final readback. A post-write refusal feeds the existing owned-write rollback; occupancy, binding checks, and rollback implementation are unchanged.
- Occupied values still soft-skip, including an invalid existing email. The neighbor remains untouched.
- Read `validity` only. Do not call `checkValidity`/`reportValidity`, trigger validation UI, click, submit, save, or clear the site's error state.

## Reproduction and validation

`tests/moka-native-validation.test.mjs` adds nine cases:

1. Malformed direct email refuses before focus/events/write.
2. Explicit batch with invalid email refuses every write.
3. Confirmed-profile batch with invalid email refuses every write.
4. Occupied invalid email retains its value/error and soft-skips while empty fields fill.
5. Native-valid `a@b` and an unconstrained international telephone are accepted.
6. Existing custom validity error on an empty input refuses preflight.
7. A focus handler introducing a custom error refuses the direct write.
8. An input handler rejecting unchanged text stops the batch; existing rollback restores owned values.
9. Final readback catches a later custom error on an earlier written field.

Before the fix at `e6e1085`: **7 failed, 2 passed**. Failures were false `ok=true` results, not harness errors. After the fix on Windows / Node v24.20.0:

```powershell
$env:CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
node --test tests/moka-basic.test.mjs tests/moka-never-save.test.mjs tests/moka-native-validation.test.mjs
```

**39/39 passed**, zero failed/skipped. This includes the nine new native-validation cases and three existing Chrome synthetic harness cases. New tests assert zero click/submit calls, zero invalid events, zero `checkValidity`/`reportValidity` calls, and false live support.

Additional local isolated **Chrome 156.0.8078.47** probes: **7/7 passed** for this adapter (21/21 across the trio): direct invalid email, invalid batch, focus refusal, input refusal, late refusal, occupied invalid soft-skip, and valid short-domain email. Existing HTML fixtures were served on loopback. Focus emulation was enabled in the isolated headless tab so native focus handlers actually run. Every probe recorded zero click, submit, programmatic submit/requestSubmit, invalid, checkValidity, and reportValidity actions.

Combined source validation on base `cursor/expand-night-ats-f861` at `de4ef02`, with source/test bytes hash-checked against the three PR worktrees:

```text
node --test tests/ats-basic-auto-wiring.test.mjs tests/build-paid-rebuild.test.mjs tests/guard-worker-auto-runners.test.mjs tests/product-paths-whitelist.test.mjs tests/pack-side-effect-import.test.mjs tests/paid-qa-runner.test.mjs
```

**69/69 passed**, zero failed/skipped. `git diff --check` passed. These are local checks, not hosted CI or live-site validation.

## Missing evidence

- Authenticated resume-edit DOM and tenant validation/lifecycle timing. The `.moka-form-item` contract is provisional; public recruitment bundles do not confirm these form classes.
- Select/dropdown/date/cascader surfaces and Escape dismissal, option-level soft-skips, repeated sections/multi-row ownership: no usable fixture/probe evidence in this slice.
- Placeholder-value sentinel allowlists: no evidence; nonempty values stay occupied.
- Site-specific error markup, asynchronous validators, masks, length constraints, and errors arriving after the current readback window. Native validity on programmatically assigned values does not prove every user-input constraint or business rule.
- Live autosave/backend behavior. No live fill or save/submit/next/deliver/delete action was performed.
