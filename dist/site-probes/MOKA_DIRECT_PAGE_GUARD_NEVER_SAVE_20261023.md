# Moka direct text entrypoint: offline page guard (2026-10-23)

Base: `2ffb6f6b3e55fbe3864a3d5fd8f32d3f6a17f62b`.
Scope: Moka's public `fillText` entrypoint only. Never-Save;
`liveSupportClaimed=false`. No live browser or CDP session was used.

## Existing evidence and distinct failure

Reuse the unchanged `tests/fixtures/moka-basic-form.html`. Its provisional
`.moka-form-item` controls already support direct text-fill probes in
`tests/moka-never-save.test.mjs`; that suite also loads the same fixture at
`https://example.com/moka-basic-form.html` to verify the batch wrong-page guard.
See `MOKA_REBIND_NEVER_SAVE_20261023.md` and `MOKA_NEXT.md` for the fixture and
live-support limits.

The batch entrypoint already called `pageAllowed`, but public `fillText` did
not. Against the exact base, direct filling the existing name control at
`https://example.com/fixture` returned `ok=true`, `reason=matched`, and
`writeAttempted=true`, changed its value, and dispatched an input event. The
equivalent Beisen and Feishu fixture calls returned `wrong_page` with no write.
This is an entrypoint host-guard omission, separate from occupancy, rebind,
neighbor preservation, skipped receipts, and unvisited-field readback.

The new 11-case regression suite ran before the source change: **8 failed /
3 passed**. All eight refusal cases reached the assertion that `ok` must be
false; the existing known-host and explicit loopback fixture paths passed.
Local transcript: `_temp-scripts/paid-moka-direct-page-guard-before.log`.

## Change and checks

`fillText(label, value, options = {})` now applies the existing `pageAllowed`
policy before classifying controls or reading neighbor snapshots. Unsupported
hosts/protocols return `wrong_page`, `writeAttempted=false`, and the existing
Never-Save flags. The existing policy permits synthetic fixtures only when
`synthetic === true` and the host is `localhost` or `127.0.0.1`.

Three existing direct localhost calls now pass `{ synthetic: true }` explicitly
so their original empty-value, neighbor-label, and cleanup assertions continue
to exercise the intended paths. No fixture markup or selector changed.

Patched source: **31 passed / 0 failed / 0 skipped** across
`tests/moka-direct-page-guard.test.mjs` and `tests/moka-never-save.test.mjs`.
The new cases cover unrelated and other-ATS hosts, a hostname suffix spoof,
an unsupported protocol, missing/disabled synthetic opt-in, the known Moka
host, and explicit localhost/loopback fixtures. Refusals assert zero form
queries, zero focus/input/change/blur events, unchanged named controls, zero
click/submit/programmatic-submit/requestSubmit, and false live support.
Allowed-path controls retain matching readback and unchanged neighbors.
`git diff --check` passed.

```powershell
node --test --test-reporter=spec tests/moka-direct-page-guard.test.mjs tests/moka-never-save.test.mjs
```

## Limits

The known-host positive case is the existing offline fixture under a JSDOM URL;
it is not a live form or authenticated lifecycle claim. Actual Moka resume DOM
remains login-walled and the form classes remain provisional. No live fill,
autosave/backend verification, or save/submit/next/deliver/delete occurred.
The existing hostname policy, batch behavior, native write/events, and rollback
implementation are unchanged. This patch does not add evidence for dropdowns,
dates, repeated sections, hidden neighbors, or asynchronous live behavior.
