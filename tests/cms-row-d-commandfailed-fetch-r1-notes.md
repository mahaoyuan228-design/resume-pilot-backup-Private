# CMS Row D commandFailed / Fetch R1

2026-10-30. Base: `05d54285df95c57c8eda5fc3692c429429fcf432`
(merged #221; historical embedded base remains `23c0ce54`).
Branch: `codex/cms-row-d-commandfailed-fetch-r1`.
PR target: `cursor/expand-night-ats-f861`.

**PRIMARY = commandFailed / Fetch and cleanup.** This also advances read-only
options; it does not change `failed()` eligibility or exempt unsafe ledgers.
Never-Save and `throwOnSideEffect:true` remain mandatory. Booked stays **58**,
D unbooked. No new real CMS probe, PASS_PREFLIGHT, live support, fill/save,
dropdown/calendar interaction, or booking is claimed. No Astra was used.

## Evidence versus inference

Read the actual UTF-8 Windows files under the parent `_temp-scripts`: the
AFTER_05d54285 feed, REAL_USE report, `RESULT.json`, `cms-row-d-live.json`,
rough-search hints, R7 acceptance checklist, previous 0ca0acc2 feed/report,
R7 preserve hint, r6 pack, and tip-sync sources. `/workspace/handover` is a
handover reference, not this PC's cwd.

The 05d54285 live result has 2/16 fields, one observed/paused/acknowledged
info/edit POST, zero non-GET responses, `commandFailed=true`, and
`focusEmulationCleared=false`. All inspection checkpoints are clean; options
readiness ends `inspection_failed` after three samples. There is no
`block_failed` record or recorded second POST pause. The previous 0ca0acc2
run also had 2/16, with zero non-GET traffic and no command failure. The r6
12/16 blocked-only result had `commandFailed=false`; its correlation wash
differs from this failure.

**Inference, not a proven live cause:** an inspection timeout closes the shared
CDP socket, then focus reset and Fetch/Network teardown fail, and finally the
guard overwrites the inspection failure. The preexisting actual-WebSocket
timeout regression reproduced this cascade. A POST double pause is a separate
robustness hypothesis, not established by the sanitized live evidence.

## Primary changes

- One normal decision per Fetch interception ID, including while its ACK is
  pending. Distinct interception IDs sharing a Network ID each get aborted.
  Duplicate/conflicting ledger evidence still rejects preservation. A reused
  GET ID followed by POST gets one safety abort; no POST is continued.
- Locally classified `Invalid InterceptionId` is redacted and never retried.
  It cannot supply a block ACK: an unacknowledged non-GET still hard-fails
  through the unchanged ledger. Ordinary command errors remain commandFailed.
- An error-stage GET pause is failed, contributing no non-GET block count.
  Non-GET response-stage pauses are rejected and aborted. All server response
  and redirect evidence remains disqualifying.
- Only strict synchronous inspection uses `closeOnTimeout:false`. Browser
  and host deadlines remain bounded. Timeout stops inspection, records failure,
  retains the last actual incomplete snapshot, and permits guarded focus reset
  and drain. Late replies cannot authorize a sample. Default transport callers
  and guard commands still close on timeout.
- Actual reset, disable, socket, command and identity failures remain failures.
  Focus is marked cleared only after reset ACK. Fixed `failure` metadata and
  bounded `traffic.commandFailures` contain no raw exceptions, URLs or IDs.

The [Fetch protocol](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/Fetch.pdl)
requires resolution even for response-error pauses; dropping all such pauses
would strand requests. Retain wildcard **Request-stage only** patterns:
RequestPattern has no HTTP-method filter, and restricting URL/resource types
would lose arbitrary non-GET coverage. No POST is released to fix commandFailed.

## Same-package options progress and limits

Pinned Ant Design Vue 1.7.8 forwards current option definitions separately from
the filtered menu. The ownership-verified VNode path now accepts built-in
searchable single selects with boolean filter settings. Custom callbacks and
rendering, unverified roots/links, private caches, selected/search values,
groups, disabled and partial/mismatching definitions remain excluded.
No getter or framework method is invoked; no dropdown is opened.

In this pinned source, the hidden single-select search helper appears only in
searchable mode. All eleven supplied unavailable fields report a hidden search
input, supporting the old searchable-mode rejection as a plausible cause.
The real CMS component version and object graph remain unproven. Installed
Vue/Ant, V8 and native Blink fixtures establish compatibility, not a live gain.

Loading DOM/props remain unavailable even with a retained populated portal.
Fixed `optionsDefinitionIssue` reports failed ownership/definition stages;
`optionsReadiness` can explicitly say `loading`. The runner accepts these only
on unavailable selects without observed count or successful provenance. The
harvest dictionary never supplies proof of current options. Definition evidence
is separate from visible filtered menu evidence.

Location `select_not_unique` and calendar `calendar_live_evidence_missing`
remain honest secondary gaps. Captured location structure has two peer selects
in one cascader, so label/form-item scope alone cannot choose safely.

## Validation and handoff

Windows / Node **v24.20.0**: **18 suites / 912 tests passed**, zero failures,
skips or cancellations; `git diff --check` passed. Ignored final log:
`_temp-scripts/cms-row-d-commandfailed-fetch-r1-final.log`.
Tests cover retained/default transport deadlines,
pending abort ACK after timeout, ignored late replies, actual abort failure,
repeated/distinct interception IDs, response errors, redaction, searchable
definitions, loading and no interaction. Includes all 14 `cms-row-d-*` suites,
`cdp-client-timeout`, and the three `live-harvest-*` regression suites.

Sync runner, options library, **CDP client**, and location diagnostic together.
The location tool remains single-shot with strict source verification; only
the three reviewed dependency pins change. Its deployed script pins use CRLF,
CDP/error pins LF, as before. Historical evidence and embedded base are intact.

After merge/sync, the parent runs the official Never-Save probe at the actual
merged tip. Inspect fixed command/failure and options-proof diagnostics, all
field reasons, and `focusEmulationCleared`. Any non-GET must remain blocked-only
with zero responses. Unmatched aborts, actual command failures, responses,
truncation and identity conflicts still reject. Inspection timeout remains an
incomplete/error result even with successful cleanup. Until new evidence meets
the live checklist: **no PASS_PREFLIGHT, no book D; booked remains 58**.
