# Tip narrow regression — ef771fc0 — 2026-10-24

Regression only. No product code changed. Education R9 and paid areas were not run.

**Never-Save. `liveSupportClaimed=false`.**

## Tip

| Item | Value |
| --- | --- |
| Branch | `cursor/expand-night-ats-f861` |
| SHA tested | `ef771fc02415a9249bfe86dd9d20afca7f6c130d` |
| HEAD subject | CMS basic info: fix row C wrapper-to-item probe topology (#195) |
| Node | v22.23.4 |
| Verdict | **GREEN** |

`ef771fc02415a9249bfe86dd9d20afca7f6c130d` is tip HEAD. Dependencies for the offline tests came from `npm ci --ignore-scripts` (`jsdom`, `ws`). `node_modules/` was not committed.

## Command set

`handover/` did not exist on this tip (remote contents API 404). No prior post-#194 narrow command list was found there. No CMS basic-info / row-C pack or smoke script exists under `scripts/`, and `package.json` has no similarly named test script. Existing `package.json` scripts are `test:paid-qa`, `test:paid-rebuild`, and `test:live-harvest`; those were not run. `scripts/auto-cms-basic.mjs` is the older basic-auto runner, not a row-C pack/smoke, and was not executed.

PR #194's own offline note in `docs/CMS_BASIC_INFO_GAPS_R1.md` lists a 16-file command. That is not a handover pack/smoke script and was not re-run.

## 1) Narrow node tests

```text
node --test tests/cms-basic-info-row-c-probe.test.mjs tests/cms-basic-info-gaps.test.mjs tests/cms-basic-info-live.test.mjs
```

Exit code: **0**

```text
ℹ tests 126
ℹ suites 0
ℹ pass 126
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10323.536884
```

Reporter was `spec` for the same file list. Pass 126 / fail 0. This matches the #195 pre-merge count (126 passed, 0 failed).

Supplemental sequential reruns of the same three files (not an extra suite):

| File | Exit | Pass | Fail | Skipped |
| --- | ---: | ---: | ---: | ---: |
| `tests/cms-basic-info-row-c-probe.test.mjs` | 0 | 59 | 0 | 0 |
| `tests/cms-basic-info-gaps.test.mjs` | 0 | 49 | 0 | 0 |
| `tests/cms-basic-info-live.test.mjs` | 0 | 18 | 0 | 0 |
| Sum |  | 126 | 0 | 0 |

## 2) Pack / smoke

Not run. No matching CMS basic-info / row-C pack or smoke command was present.

## Result

**GREEN.** 126 passed, 0 failed, 0 skipped on the required narrow command. No fix and no pull request.
