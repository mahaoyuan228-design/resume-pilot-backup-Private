# Beisen 2022: offline rebind Never-Save coverage (2026-10-23)

PR #116; existing hardening head `3282a77`, integrated with `cursor/expand-night-ats-f861` at `398debc`. Offline only; `liveSupportClaimed=false`.

Provisional `.bs-form-item` fixture only; public portal bundles do not confirm the form classes. See [BEISEN_2022_NEXT.md](BEISEN_2022_NEXT.md) and [BEISEN_LIVE_CHECK_AI_20261019.md](BEISEN_LIVE_CHECK_AI_20261019.md).

Uses the existing `tests/fixtures/beisen-2022-basic-form.html` and its current labels/controls. Rebind mutations clone an existing item or move existing inputs; no new fixture markup, site selectors, field types, or live support claims.

An input can remain connected and retain the expected value while its field item changes. Previously this could pass focus/final readback checks or let rollback write through the rebound node. Snapshots now retain the original item, and cleanup verifies the unique label/item/input binding. Input/change event dispatch also checks that binding before sending subsequent events. If ownership changed, the value is preserved and restoration is reported incomplete; stable owned fields can still roll back.

Six added regressions, extending the existing suite without duplicating basic success cases:

| Case | Expected behavior |
| --- | --- |
| Focus replaces item but retains input | Refuse before native write; leave remaining fields unchanged |
| Input event moves phone into neighbor | Preserve occupied name and both moved inputs; stop change/blur dispatch |
| Failing phone event rebinds earlier name | Preserve reactive phone and rebound name; no cleanup write into new item |
| Email event rebinds an earlier item | Reject stale successful readback; restore only stable fields |
| Cleanup rebinds an already restored phone | Report incomplete restoration even if raw text still matches |
| Direct text change event rebinds item | Refuse stale cleanup and blur; preserve all neighbors |

The first four cases failed against the previous PR implementation before the fix. Every added case asserts zero click/submit actions and false live support. Existing occupied skips and hidden-input restoration checks remain green.

Validation on Windows, Node v24.20.0:

- `CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe` (PowerShell environment assignment).
- `node --test tests/beisen-2022-basic.test.mjs tests/beisen-2022-never-save.test.mjs`: 29/29 passed, no failures/skips (19 safety cases plus 10 existing basic cases, including 3 headless Chrome synthetic harness cases).
- Combined trio source validation: `node --test tests/ats-basic-auto-wiring.test.mjs tests/build-paid-rebuild.test.mjs tests/guard-worker-auto-runners.test.mjs tests/product-paths-whitelist.test.mjs tests/pack-side-effect-import.test.mjs tests/paid-qa-runner.test.mjs`: 69/69 passed, no failures/skips. This is local validation, not a hosted CI claim.
- `git diff --check` passed.

Missing evidence / deliberately skipped:

- Authenticated live resume-edit DOM and actual tenant rebind timing remain unavailable. Fixture mutation coverage is not a recorded live lifecycle.
- Select/dropdown/date/cascader surfaces, Escape dismissal, option-level soft-skips, and repeated sections have no usable fixture/probe evidence in this slice; no behavior or DOM invented.
- No evidenced placeholder-value sentinel allowlist; existing nonempty values remain occupied.
- No live fill, autosave/backend verification, or save/submit/next/deliver/delete action performed.
