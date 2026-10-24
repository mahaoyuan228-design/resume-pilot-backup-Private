# CMS row D keeper non-GET R5

Date: 2026-10-24. Base: `7e8a9e9bb1ad3f54c135f6b00b64fbb51ceda7e9` (#200).
Branch: `codex/cms-row-d-keeper-nongget-r5`.
Target: `cursor/expand-night-ats-f861`.

`neverSave=true`, `liveSupportClaimed=false`, `livePassClaimed=false`,
`writeStarted=false`, `mutationAllowed=false`, `valuesExposed=false`,
`probeOnly=true`. Booked stays **53**. No live fill, Save/submit, dropdown
interaction, PASS_PREFLIGHT, support claim or D+12 booking. No education or
paid files changed. No live browser session was used for this revision.

## Evidence and change

Read the parent-supplied `cms-row-d-keeper-nongget-r5-pack`: REAL_USE and
TIP_SYNC notes, authoritative R2 `cms-row-d-live.json`, and `round1` JSON.
Sync was 10/10 at the base. R2 completed 12/16 fields, then returned
`non_get_or_guard_failure`; R1 stopped during keeper setup. Each recorded
one observed/intercepted/acknowledged-blocked info/edit POST, no non-GET
response, no guard command failure or truncation. Keeper acknowledgments
were all true. The sanitized reports lack request IDs and exact event timing,
so they cannot retrospectively prove the new correlation rule or an R5 PASS.

R5 preserves the inspection verdict only for an exact CMS-origin
`/resume/info/edit` POST whose Network observation and request-stage Fetch
pause both occur within the fully guarded keeper lifetime. Network request ID
must match Fetch network ID, Fetch request ID must be unique, method and URL
identity must agree, and `Fetch.failRequest` must succeed. Internal IDs and
URL hashes are never emitted. Aggregate counts alone cannot qualify.

Both guards still precede activation; every non-GET is still blocked. Keeper
activation/focus behavior, guarded reset, and both bounded monitoring windows
remain. The exception ends before Fetch/Network teardown. Unblocked,
unmatched, duplicate, conflicting, ineligible or late traffic, any guard
command failure, and truncation still hard-fail. Response evidence (including
redirects and reordered response events) hard-fails even after a block ack or
loading failure. Official evaluation always uses `throwOnSideEffect:true`,
without fallback. An exempt block preserves an incomplete field result;
it never promotes fields or proves server-write isolation. Keeper timing
does not identify which command caused a page-initiated request.

## Still unevidenced

- Locations: live `select_not_unique` does not distinguish zero from multiple
  hosts or prove their topology. No host filtering or hybrid support added.
- Research: 32 observed options and a matching 25-label prefix do not supply
  the remaining seven labels or prove dictionary completeness.
- Calendar: `calendarStructureObserved=true` proves only the existing
  structural checks; date/popup behavior remains unevidenced and skipped.

## Offline validation

```powershell
node --test tests/cms-row-d-options.test.mjs tests/cms-row-d-probe-expression.test.mjs tests/cms-row-d-debug-evaluate.test.mjs tests/cms-row-d-live.test.mjs tests/cms-row-d-live-cdp.test.mjs
```

Node **v24.20.0**: **379/379 passed**, no failures, cancellations or skips.
`git diff --check` passes. Log: `_temp-scripts/cms-row-d-r5-tests-final.txt`.
Tests cover preserved modeled 12/16 evidence, reversed event order and pending
acks, misleading equal counts, missing/duplicate/conflicting identities,
other endpoints/methods, response/redirect evidence, guard failures and late
teardown traffic. DOMs and loopback CDP transport are synthetic; the modeled
count is not a new live CMS observation. Existing zero-value-read,
zero-interaction and actual V8 side-effect tests remain green.

Parent must re-probe the new tip. Missing correlation can still stop early;
the four field skips remain. Offline green does not establish live preflight
PASS, fill/support, server-write isolation or permission to book D.
