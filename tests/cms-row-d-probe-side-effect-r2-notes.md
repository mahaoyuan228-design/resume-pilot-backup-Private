# CMS row D probe side-effect R2 — offline validation

Date: 2026-10-24. Base: `c32f2fda429f8f32ab318e9fdf0c2fe69f52a386`.
Branch: `codex/cms-row-d-probe-side-effect-r2`.

`neverSave=true`, `liveSupportClaimed=false`, `livePassClaimed=false`,
`writeStarted=false`, `mutationAllowed=false`, `valuesExposed=false`,
`probeOnly=true`. Booked remains **53**. No D+12 is booked. No clicks, fills,
dropdown opens, Save/submit, or current-value reads were performed.

## Input evidence and scope

Read `REAL_USE_CMS_ROW_D_PROBE_c32f2fda_2026-10-24.md` and the mirrored
`cms-row-d-live.json` / `diag-throwOnSideEffect.txt` in the local
`_temp-scripts/cms-row-d-probe-side-effect-r2-pack` handover. The real-page
baseline had `reason=inspection_exception`, `probeCompleted=false`, logged-in
UI, and zero non-GET observations. The diagnostic unguarded inspection was
incomplete, with unavailable/kind-mismatched controls and dictionary/calendar
gaps. It was diagnostic only, never an official PASS.

This revision keeps the official guard and has no unguarded retry. It replaces
Blink APIs rejected by debug-evaluate, removes object-copy operations rejected
by V8, and removes captured-binding reassignment that caused V8's static
side-effect check to reject the whole inspector. `visibilityBasis=attributes_only`
is retained by the runner; stylesheet and layout visibility remain unverified.

## Repeatable narrow tests

```powershell
node --test tests/cms-row-d-options.test.mjs tests/cms-row-d-probe-expression.test.mjs tests/cms-row-d-debug-evaluate.test.mjs tests/cms-row-d-live.test.mjs tests/cms-row-d-live-cdp.test.mjs
```

Result: **235 tests passed**, zero failures/skips. The V8 regression executes
the serialized expression with actual `node:inspector` `throwOnSideEffect=true`,
checks the full synthetic field path and safe stops, and separately proves that
an attempted write is rejected. Synthetic DOM audits forbid current-value reads,
interactions, mutation, network, URL construction, `matches`/`closest` and layout
calls. The runner tests retain redaction, non-GET blocking, output confinement,
guard teardown and rejection of forged visibility metadata.

## Isolated native DOM checks

The temporary harness launched new headless profiles, blocked external DNS, and
fulfilled requests locally with synthetic HTML. It never attached to the live
CMS session or port 9242. The exact CMS page identity was synthetic; no request
was sent to the CMS server.

| Browser | V8 | Guarded expression / official runner result |
|---|---|---|
| Edge 155.0.4283.62 | 15.5.9.7 | Default and requested paths complete; no `exceptionDetails` |
| Chrome 156.0.8078.47 | 15.6.75.19 | Default and requested paths complete; no `exceptionDetails` |

Both official-runner fixture checks report `probeCompleted=true`, `ok=false`,
`reason=row_d_preflight_incomplete`, 16 fields, and zero non-GET/guard-failure
counters. Each browser fixture locally fulfilled two GETs; non-GET count was
zero. The field counts are 12 structural observations, two sampled-location
dictionary mismatches, one incomplete industry dictionary and one missing
calendar-evidence skip. These are synthetic outcomes, not live-page results.

Local ignored evidence remains under this workdir's `_temp-scripts`:

- `cms-row-d-r2-tests.txt`
- `cms-row-d-offline-cdp-final-runner-edge-1792828066218/`
- `cms-row-d-offline-cdp-final-runner-chrome-1792828103948/`

Each browser directory includes `summary.json`, `runner-default.json`, and
`runner-requested.json`. No profile or raw page data is committed.

The parent must re-run guarded CDP on the real CMS page. Preflight may still be
incomplete with `control_not_available`, `control_kind_mismatch`, incomplete
dictionaries and missing calendar evidence. No preflight PASS, live PASS,
live fill/support, or site-support claim follows from these offline checks.
