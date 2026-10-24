# CMS row D keeper non-GET R6

Date: 2026-10-24. Base: `723bee7b368ce8cfab07277aedec603301c24e4c` (#201).
Branch: `codex/cms-row-d-keeper-nongget-r6`.
Target: `cursor/expand-night-ats-f861`.

`neverSave=true`, `liveSupportClaimed=false`, `livePassClaimed=false`,
`writeStarted=false`, `mutationAllowed=false`, `valuesExposed=false`,
`probeOnly=true`. Booked stays **53**. No live browser/CDP session, fill,
Save/submit, dropdown or calendar interaction, PASS_PREFLIGHT, support claim,
or D+12 booking. No education or paid files changed.

## Why R5 missed the recorded endpoint

Read all six core R6-pack evidence files, including the authoritative R5 report
and the pre-R5 round1 JSON. Both completed 12/16 fields and reported one
observed/intercepted/blocked info/edit POST, with no response, guard command
failure or truncation. R5 still returned `non_get_or_guard_failure`.

R5's `trafficIdentity` redacted any matching info/edit URL to
`/resume/info/edit`. Its separate eligibility check and all positive keeper
fixtures then incorrectly required that short label as the raw pathname.
The real CMS endpoint already documented in the repository is
`/wecruit/resume/info/edit/<baseline tenant>`:

- `tests/cms-education-autosave-notes.md`, Evidence boundary, cites the earlier
  real `nonGet` and `saveLikePost` records for that endpoint.
- `tests/cms-education-controls-residual-r4-notes.md` cites the two raw harvest
  records, with the known housekeeping query.
- Read-only verification of the external
  `_temp-scripts/cms-edu-controls-residual-r4-materials/harvest/harvest-summary.json`
  and `isolated-open-summary.json` confirms the exact CMS origin and baseline
  tenant pathname. No request/response body or current field value was read.

This establishes a classifier defect: a fully correlated block to that
recorded endpoint could never qualify under R5. The supplied row-D reports
hide raw paths, IDs and precise timing, so they cannot establish whether this
was the sole cause of that run. R6 makes no retrospective correlation claim.

## Change

The qualifying path is now derived from fixed `ROW_D_PAGE` as
`/wecruit/resume/info/edit/<baseline tenant>` on its exact origin. Only POST
qualifies. The short redacted path, arbitrary suffix matches, other tenants,
tenant prefixes/suffixes, extra/trailing path segments, encoding/case variants,
other origins/ports, credentials and URL fragments do not qualify.
Endpoint and identity comparisons retain WHATWG URL parsing semantics for
`origin`, `pathname` and `href`; dot segments, backslashes and default ports
are compared after normalization, not as raw URL bytes. This does not claim
rejection of every raw spelling of an equivalent URL.

The ledger still requires one Network observation and one request-stage Fetch
pause with matching Network/Fetch network IDs, a unique Fetch request ID,
matching method and full URL identity, and successful `Fetch.failRequest`.
Both events must occur inside the fully guarded keeper lifetime. Aggregate
counts never substitute for correlation. Guards still precede keeper
activation; evaluation uses only `throwOnSideEffect:true`, without fallback.
Keeper reset, both bounded monitoring windows and teardown order are unchanged.

Unmatched, duplicate or conflicting identities; an unacknowledged block;
unblocked/other non-GET; late or teardown-only traffic; guard command failure;
truncated tracking; and server/redirect evidence still hard-fail. Fetch redirect
metadata and response headers/status text now explicitly reject a pause even
if no response status code accompanies them. No response is synthesized.

`traffic.keeperAssessment` adds fixed status/rejection enums for safe parent
re-probes. It distinguishes endpoint/lifetime/identity/matching/block/response
and guard failures without emitting IDs, raw URLs, query values, bodies or
hashes. It is diagnostic only. `ROW_D_LIVE_BASE_TIP` now identifies this
revision's base `723bee7b`; the parent must still verify and re-probe the actual
new tip SHA separately.

## Offline validation

First changed positive fixtures to the recorded tenant endpoint and rejected
the short path: the unchanged R5 implementation failed **14/135** targeted
runner/loopback cases. The path fix made those cases green.

```powershell
node --test tests/cms-row-d-options.test.mjs tests/cms-row-d-probe-expression.test.mjs tests/cms-row-d-debug-evaluate.test.mjs tests/cms-row-d-live.test.mjs tests/cms-row-d-live-cdp.test.mjs
```

Node **v24.20.0**: **396/396 passed**, zero failures, cancellations or skips.
`git diff --check` passes. Final log:
`_temp-scripts/cms-row-d-r6-tests-final.txt`.

The new sanitized fixture copies the supplied live report's actual per-field
metadata and traffic projection. Its pre-traffic inspection reason is explicitly
modeled as `row_d_preflight_incomplete`, because the recorded top-level reason
was already overwritten. Loopback HTTP/WebSocket CDP tests combine those fields
with synthetic IDs and the recorded raw endpoint shape. They reproduce the
same 1/1/1 counts and observed -> paused -> blocked phases, keep exactly 12/16
fields and the four reported skips, and return the incomplete inspection
reason. The same fields with equal counts but mismatched IDs, response evidence
or teardown traffic remain hard failures. No IDs from the live run are invented
or reconstructed. Existing reversed-order/pending-ack/duplicate/conflict/query/
response/late-window tests now exercise the tenant endpoint. Existing actual V8
side-effect and zero-value-read/zero-interaction checks remain green.

## Remaining evidence and safe next capture

The four field skips remain unchanged:

- Locations: `select_not_unique` does not distinguish no matching host from
  multiple hosts or establish cascading control ownership. A later guarded
  read-only diagnostic can capture bounded wrapper/section/select/control
  counts and fixed ownership/visibility predicates for only the two allowlisted
  wrappers. Do not capture selected text, input values or arbitrary HTML.
- Research: count 32 and a matching 25-label prefix do not supply seven missing
  labels. Capture only the fixed wrapper's owned option-label text, bounded
  count and ownership checks without reading checked state or toggling options;
  require a complete independently reviewed label list before changing its
  dictionary. No missing labels are guessed in this revision.
- Calendar: the observed structure does not prove date behavior. Attributes and
  bounded ownership counts can refine the structural diagnosis; without
  authorized independent behavioral evidence it remains skipped. Do not open
  the calendar or read its current input value.

First the parent must sync and run the official guarded runner at the actual
new tip. The diagnostic enums can confirm eligibility/correlation without raw
IDs. Offline green is not a live PASS, fill/support, server-write-isolation
proof or permission to book D. Even a later preflight PASS requires separate
real-use evidence before booking; booked remains **53**.
