# CMS row D Never-Save probe

Baseline: `53791dfe6da2a6ae2b627b8e9b945ca0d411fefc`. Working branch: `codex/cms-row-d-live-never-save-r1`.

`cms-row-d-live.mjs` attaches to an existing CMS resume tab and runs the merged offline options resolver and read-only ownership preflight. This is a probe, not a fill adapter. It never opens a popup, clicks an option or 保存/提交, emits input events, or reads current field values. No originals require restoration because the probe performs no form interactions or value mutations.

Every result keeps `neverSave=true`, `liveSupportClaimed=false`, `writeStarted=false`, and `mutationAllowed=false`. A successful preflight does not grant mutation permission or establish live fill support. Education is outside this probe's scope.

## Run

From the repository root in PowerShell:

```powershell
node scripts/live/cms-row-d-live.mjs --help
$env:PORT = '9242'
$env:OUTDIR = Join-Path (Get-Location) '_temp-scripts\cms-row-d-live-never-save'
node scripts/live/cms-row-d-live.mjs
```

`PORT` defaults to `9242`. `OUTDIR` defaults to the repository's `_temp-scripts/cms-row-d-live-never-save` directory. Keep all request files and generated evidence under `_temp-scripts`.

Optionally set `REQUESTS_FILE` to a JSON file under `_temp-scripts`. The object maps exact allowlisted wrapper IDs to literal harvested option labels; the industry checkbox field accepts an array of those labels. For example:

```json
{
  "13_47_0": "11-20万",
  "13_102501_0": ["宏观", "策略", "债券"]
}
```

Requests only exercise dictionary resolution and ownership checks; they never request a write. Unknown labels are rejected. Do not infer additional labels or location options from geography.

## Safety and evidence

Both `Network.enable` and CDP `Fetch.enable` must succeed before the page probe runs. Requests paused by Fetch are continued only for GET; every other method is rejected. Any non-GET observation or interception failure fails the result. Evidence identifies the normalized `/resume/info/edit` endpoint and uses a safe category for other endpoints; it never reads request or response bodies or current field values. Any observed `info/edit` attempt remains visible even when blocked or when the displayed value was unchanged.

`observedNonGetCount` counts Network observations, while `blockedNonGetCount` counts acknowledged Fetch block commands. These are event counts and can refer to the same request. `requestWillBeSent` alone does not prove that a request reached the server. Interception cannot retroactively cancel requests already in flight; a late block failure during teardown also fails the result. This is no server-write isolation claim. The probe induces no form interaction. It drains known request decisions before disabling its CDP domains and closing the session; no page hooks need removal.

Evaluation also requires CDP `throwOnSideEffect=true`. A rejected evaluation stops without a less restrictive retry. This guard's behavior on the real page remains for the parent's CDP verification.

An earlier location-one open produced an `info/edit` POST while its displayed value stayed unchanged. The later harvest avoided location opens and observed no such POST. Its Escape/blur attempts did not establish popup closure. This probe therefore performs no popup opening or blur operation.

Location-one has only 25 serialized labels from a 30-option list. Location-two has no independent options evidence. The industry list is also partial, and the English calendar has metadata only. These controls remain skipped. Current dropdown ownership must come from a unique current `aria-controls` association; a global visible dropdown or a harvested UUID cannot substitute for ownership.

Exit `0` means complete preflight. Exit `2` means incomplete, blocked, or error; a completed probe can still be incomplete because of these intentional skips. Inspect the result reasons rather than treating execution alone as a pass.

No live PASS is claimed until the parent runs real CDP Never-Save verification. Offline tests and preflight results do not claim site support. Booked stays **53**; this work does not book **+12**.

## Offline validation

```powershell
node --test tests/cms-row-d-options.test.mjs tests/cms-row-d-probe-expression.test.mjs tests/cms-row-d-live.test.mjs tests/cms-row-d-live-cdp.test.mjs
node --test tests/cms-basic-info-row-c-probe.test.mjs tests/cms-basic-info-gaps.test.mjs tests/cms-basic-info-live.test.mjs
```

The first command covers resolver/serialization parity, zero field reads or interactions, guard failures and teardown, target/output confinement, redaction, and an actual HTTP/WebSocket transport against a local fake CDP server. All DOMs and CDP servers in these tests are synthetic; no real browser session is used.
