# CMS row D keeper non-GET R7

Date: 2026-10-30. Base: `23c0ce54b759aa1fc42516ecaf7c851bd63e785c`
(#219, after #218 / `ba94d3f9`).
Branch: `codex/cms-row-d-keeper-nongget-r7`.
Target: `cursor/expand-night-ats-f861`.

`neverSave=true`, `liveSupportClaimed=false`, `livePassClaimed=false`,
`writeStarted=false`, `mutationAllowed=false`, `valuesExposed=false`,
`probeOnly=true`. Booked remains **58**, including E; D remains unbooked.
No live browser/CDP session, fill, Save/submit, dropdown or calendar interaction,
PASS_PREFLIGHT, support claim, or D+12 booking. No education, paid extension,
or GTH implementation changes. Historical evidence retains its booked=53.

## Evidence and diagnosis

Read the supplied 2026-10-30 feed, preserve diff hint, live acceptance checklist,
and the R6 pack's authoritative live JSON, RESULT, REAL_USE, TIP_SYNC, R5 notes,
original prompt, and round1 JSON. Their local copies are under the parent
workspace's `_temp-scripts`, corresponding to the supplied `/workspace/handover`
paths. The current branch was already at the requested base; no reset/rebase
or replacement of existing unrelated working-tree changes was needed.

The real probe at `723bee7b` completed 12/16 fields but ended with
`non_get_or_guard_failure`: one observed/intercepted/acknowledged-blocked
info/edit POST, zero recorded non-GET responses, no command failure or
truncation, and all keeper acknowledgments true. Inspection completed before
the final traffic check replaced its reason. The sanitized report has neither
request IDs nor raw URLs and cannot identify the exact failed ledger predicate.
The activation window does not establish which browser/page command caused
the POST. A block acknowledgment and absence of recorded response do not prove
server-write isolation.

Two code defects must be distinguished from historical-run inference:

- R5 authorized the short redaction label `/resume/info/edit` as a raw path.
  R6 already fixed this to the exact CMS tenant endpoint derived from
  `ROW_D_PAGE`. That fix is present at this revision's base, along with the
  later R8 pending-proof settlement logic.
- The current guard still permanently rejected an absent Fetch `networkId`.
  CDP defines that field as optional. This revision handles that documented
  absence without treating an explicitly unequal ID as a match. Whether the
  historical live run actually lacked `networkId` remains unknown.

The change addresses a reproducible code path, not a retrospective claim that
the supplied live result is now PASS. Equal 1/1/1 aggregate counts remain
insufficient authority, and sanitized evidence is never replayed as ledger proof.

## Change and remaining failure boundaries

When Fetch supplies `networkId`, the existing strict one-to-one ID path remains:
it must equal the valid Network request ID, with a unique valid Fetch request ID,
matching method/full canonical URL identity, eligible endpoint/lifetime, and
successful request-stage `Fetch.failRequest` acknowledgment.

Only when Fetch omits `networkId` entirely may one pause pair by identity with
one Network observation. Both must independently be eligible keeper POSTs to
the exact CMS-origin `/wecruit/resume/info/edit/<baseline tenant>` endpoint.
Their full canonical URLs, including queries, and methods must agree. The
Network ID and Fetch ID are still required. This is inference by unique
identity, not protocol-proven ID correlation. Null, empty, invalid, or explicitly
unequal supplied IDs are not treated as missing.

The fallback requires exactly one non-GET observation and one non-GET pause
across the whole lifetime. Any second non-GET permanently rejects it, even
with the same URL or after an earlier checkpoint passed. It accepts either
event order and a pending abort acknowledgment: the same provisional ledger
object is associated with the Network ID, so a later acknowledgment updates
the correct entry and retained early response evidence still attaches to it.
All non-GET pauses are aborted immediately, before waiting for a counterpart.

`traffic.keeperAssessment.correlationMode` adds only the fixed enum
`unique_identity_missing_fetch_network_id` when this path is encountered,
including on rejection. No IDs, raw URLs, URL hashes, queries, headers, bodies,
or current values are emitted. Existing aggregate records remain unchanged.

`failed()` remains the single final traffic verdict, including in `finally`.
A qualified block now leaves inspection fields/reason intact; it does not
promote fields or override cleanup failures. Unmatched observations/pauses,
duplicates, identity conflicts, any ineligible method/origin/path, unacknowledged
or failed blocks, response/redirect evidence, command failure, truncation,
outside-keeper traffic, and teardown-only traffic still hard-fail. Response
evidence remains sticky across loading failure and event reordering.

Both guards still precede keeper activation. R8's bounded shared settlement
deadline, retained focus keeper, guarded reset, monitoring windows, decision
drains, and teardown boundaries remain unchanged. `Runtime.evaluate` still
uses `throwOnSideEffect:true` with no less restrictive retry. No POST is
continued, rewritten, converted to GET, or fulfilled with a synthetic response.
The location diagnostic's fixed runner source pin is updated to the reviewed
runner's CRLF bytes, preserving its existing Dev byte convention and exact
hash verification. Its other three dependency pins, structure inspector,
schema, capture gate, and IO behavior remain unchanged. Historical tests still
compare those three dependencies byte-for-byte; the runner is now checked
against its explicit new pin because it is the authorized change in this PR.
The base-tip constant now identifies `23c0ce54`; the parent must independently
verify and re-probe the actual new tip. Runtime booked metadata is corrected
from historical 53 to the supplied current **58**, without adding D.

## Offline validation

Node **v24.20.0**. All row-D suites are run with:

```powershell
$rowDTests = Get-ChildItem tests -Filter 'cms-row-d-*.test.mjs' | ForEach-Object FullName
node --test $rowDTests
```

All **12 row-D suites: 821/821 passed**, with zero failures, skips, or
cancellations (40.5 seconds). This includes the runner and loopback suites'
**222/222** cases (176 + 46). `git diff --check` passes. Final log:
`_temp-scripts/cms-row-d-r7-all-tests-final.txt`; targeted logs stay under
`_temp-scripts/cms-row-d-r7-*`.
Workspace-local dependencies were installed with the unchanged lockfile using
`npm ci`; this resolves the unrelated parent workspace's incompatible `ws`.
The shallow checkout was completed with `git fetch --unshallow` so historical
source-invariant tests can read their actual reference commits. The existing
native Blink/V8 test's strict evaluation passed on the first full run, but
Windows profile deletion raced Chrome shutdown. Its test cleanup now closes
the owned browser and retries transient file locks for a bounded interval.

Regression cases exercise the full runner and `finally`, both event orders,
delayed abort acknowledgment, both keeper and evaluation-time traffic, the
same redacted 1/1/1 shape, and a modeled incomplete 12/16 result. The original
historical fixture is unchanged. Current code already has the separate complete
research dictionary: the modeled 12/16 case explicitly adapts its research
metadata to a nonpassing dictionary-mismatch scenario, while separate 13/16
tests use the existing hypothetical dictionary projection. Neither is a new
CMS observation or an unchanged replay of all historical field metadata.

Negative cases cover missing/invalid Network and Fetch IDs, supplied-ID
disagreement, URL/query disagreement, duplicate or second requests (including
after successful settlement), responses before/between/after correlation,
failed/missing block acknowledgments, ineligible traffic, and late teardown.
Tests assert immediate abort, GET-only continuation, safety flags, redaction,
inspection gate ordering, and retained field failures. Existing actual V8
side-effect and no-value-read/no-interaction regressions remain included.
Independent review also passed 17 direct-guard event-order/ack/response/conflict
scenarios. HTTP/WebSocket CDP servers and documents are synthetic throughout.

## GitHub/API research checked 2026-10-30

- [Official Fetch protocol](https://github.com/ChromeDevTools/devtools-protocol/blob/master/pdl/domains/Fetch.pdl):
  `Fetch.enable` patterns filter URL/resource type/stage, not method. Matching
  requests remain paused until explicitly resolved. Fetch request IDs address
  abort/continue commands; optional `networkId`, when present, corresponds to
  Network request IDs. Missing IDs cannot be recovered from sanitized counts.
- [Official Network protocol](https://github.com/ChromeDevTools/devtools-protocol/blob/master/pdl/domains/Network.pdl):
  URL blocking patterns do not supply an HTTP-method predicate. A permitted URL
  can carry POST as well as GET. Request body data may be omitted; empty or
  absent observed body data cannot establish safety.
- [Ferrum allowlist implementation](https://github.com/rubycdp/ferrum/blob/main/lib/ferrum/network.rb):
  URL matches cause continuation, without distinguishing POST from GET. It
  cannot replace the runner's method-plus-exact-URL decision.
- [Puppeteer #14897](https://github.com/puppeteer/puppeteer/pull/14897), merged
  2026-04-24: experimental URLPattern allowlisting for Chrome 149 restricts
  URL/origin; it does not authorize this CMS POST or replace per-pause aborts.
- [Puppeteer NetworkManager](https://github.com/puppeteer/puppeteer/blob/main/packages/puppeteer-core/src/cdp/NetworkManager.ts)
  explicitly handles reordered/missing Network events, multiple pauses, and
  loading failures preceding pauses. These justify retained ledgers and
  reordered-event tests, not dropping response evidence or accepting ambiguity.
- [chromedp #719 resolution](https://github.com/chromedp/chromedp/issues/719#issuecomment-789474116),
  2021-03-05: base64 POST data and content type concern request serialization,
  not safe interception, write prevention, or an allowlist exemption.

## Parent live acceptance still required

No new live probe was attempted; the feed says the machine/CDP is suspended.
After merging and verifying the actual tip, the parent must run the official
guarded Never-Save probe. Check whether the final inspection reason is
preserved, the correlation mode/rejection enums, and all hard-failure counters.
This PR alone does not establish PASS_PREFLIGHT, live PASS, fill/support,
server-write isolation, or permission to book D. Booked remains **58**.

Locations and calendar behavior remain separate evidence gaps. The already
merged research dictionary is left unchanged. No secondary field was promoted
to make the traffic-preservation test pass.
