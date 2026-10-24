# CMS row D keeper settlement R8

Date: 2026-10-24. Base: `3c5c9d08c78ce0ffc522e69398f815188bbdaaeb` (#203).
Branch: `codex/cms-row-d-keeper-settlement-r8`.
Target: `cursor/expand-night-ats-f861`.

`neverSave=true`, `liveSupportClaimed=false`, `livePassClaimed=false`,
`writeStarted=false`, `mutationAllowed=false`, `valuesExposed=false`,
`probeOnly=true`. Booked remains **53**, D unbooked. No browser/live CDP,
collector rerun, fill, Save/submit, dropdown or calendar interaction was used
by this implementation worker. No education, paid or other ATS files changed.

## Real failure and diagnosis

Read the original parent-run files under
`Dev/_temp-scripts/cms-row-d-location-evidence-3c5c9d08/`:
`cms-row-d-live.json` and `capture-stdout.txt`.

The collector stopped: `probeCompleted=false`, `fields=[]`,
`reason=non_get_or_guard_failure`; no diagnostic sidecar was produced. All four
keeper acknowledgments were true. The final guard nevertheless reported one
observed -> paused -> blocked info/edit POST, zero response evidence, no
command failure/truncation and `correlated_keeper_blocks` with empty reasons.
This is an early inspection gate stop, not completed field evidence overwritten
later. The parent separately reported an earlier R7 official 13/16 result.

At the base, each keeper command was followed by `guard.drain()` and an immediate
`guard.failed()` check. Drain only waits for already-known decision promises;
it cannot wait for a not-yet-arrived Network/Fetch counterpart. The unchanged
terminal predicate correctly rejects an incomplete pair or unacknowledged
block at that instant. The runner returns before inspection, while its guarded
cleanup may later receive the missing evidence and make the final ledger
complete. The real JSON is consistent with that sequence, particularly the
final keeper checkpoint, but does not reveal whether the earlier gap was a
missing observation, missing pause or pending ACK. No unique CDP ordering or
page-event cause is claimed from aggregate records.

## Change

The strict terminal `failed()` predicate is unchanged. A separate fatal view
rejects command failure, truncation, identity/correlation defects, response
proof or any ineligible entry immediately. The existing exact tenant POST,
valid Network/Fetch IDs, unique Fetch ID, full method/URL identity,
request-stage pause, acknowledged block and keeper-lifetime rules are unchanged.
Fetch pauses are still rejected immediately; waiting for their Network peer
never delays `Fetch.failRequest`.

After each keeper command and once immediately before inspection, only
nonfatal pending proof may settle. A single authorization deadline starts at
the first pending checkpoint: **250 ms total for this guard**, shared by every
subsequent checkpoint and never reset by new events. Up to ten timer ticks and
200 event/ACK wakeups are allowed. Events wake the gate promptly so permanent
failures do not wait for the next timer tick. Inspection starts only when the
unchanged strict predicate is false and no guard decision reply remains pending.

Expiry/event-budget exhaustion is sticky in the settlement view. Later full
correlation cannot restart inspection, including during cleanup. The original
final ledger is still reported honestly, so `keeperAssessment` may be correlated
while the earlier `inspectionGate` is blocked with zero fields.

`inspectionGate` adds only fixed checkpoint/status/pending enums, initial/final
redacted guard assessments, booleans, and bounded timer/event counts. Its allowed
status grants read-only inspection only; it is not a preflight/fill/support PASS.
No request IDs, URL/query values, URL hashes, bodies, field values or exception
strings are exposed. `ROW_D_LIVE_BASE_TIP` now names the actual R8 base above.

The 250 ms limit governs authorization to wait for pending proof. It is not an
end-to-end runtime guarantee: scheduler lateness fails authorization, and CDP
command timeouts plus existing initial/cleanup drains remain separate. R8 does
not call the old ACK drain inside that deadline. Cleanup still drains known
commands using their existing bounded CDP timeout and retains both original
250 ms monitoring windows before Fetch/Network teardown. No cleanup success
retroactively authorizes inspection or proves server-write isolation.

## Offline validation

```powershell
node --test tests/cms-row-d-options.test.mjs tests/cms-row-d-probe-expression.test.mjs tests/cms-row-d-debug-evaluate.test.mjs tests/cms-row-d-live.test.mjs tests/cms-row-d-live-cdp.test.mjs
```

Node **v24.20.0**: **432/432 passed**, zero failures, cancellations or skips.
Log: `_temp-scripts/cms-row-d-r8-tests-final.txt`. `git diff --check` passes.

Actual loopback HTTP/WebSocket tests deliver a keeper command reply before a
35 ms delayed Network/Fetch counterpart or a 45 ms block ACK. The fake server
asserts that Runtime.evaluate cannot arrive until both observations and the
ACK are complete. Read-only inspection then retains the modeled incomplete
13/16 result. No real browser is contacted.

Negative loopback cases include never-paired/unblocked traffic, equal counts
with unmatched IDs, a block ACK after expiry, and a partner arriving only on
cleanup or guard teardown. Cleanup-only completion reproduces the supplied
shape: final correlated block, response zero, no guard command failure, yet
zero inspected fields and a sticky deadline stop. Response, conflicting or
duplicate identities, invalid IDs, redirect metadata and block command failure
during waiting all stop without inspection. Separate tests prove the total
deadline cannot renew across checkpoints and later complete correlation cannot
revive it; permanent/outside-keeper failures perform zero settlement waits.
Existing guard, side-effect, redaction, research and ownership suites stay green.

## Remaining scope

No field dictionary, ownership selector or fill adapter changed. Research's
32-label R7 contract remains intact; both locations and the calendar remain
skipped. Existing product fill paths are outside this revision. Parent review,
merge, merged-tip regression, Dev source-byte sync and official guarded re-probe
are still required. A collector pinned to the old runner hash must not be
re-run without a separately reviewed pin update. No new live result, support
claim or booking follows from offline green; booked remains **53**.
