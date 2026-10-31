# CMS row D options root anchor R1

Date: 2026-10-30. Base: `c149f9405ed94e2e37cf681b0b45d572a65352fe`
(#222). Branch: `codex/cms-row-d-options-root-anchor-r1`.
PR target: `cursor/expand-night-ats-f861`.

PRIMARY = **options / root_anchor_missing / inspection**. Fetch,
`commandFailed`, keeper preservation and network correlation are not the main
change and their implementation is unchanged. Never-Save and strict
`throwOnSideEffect:true` remain mandatory. `neverSave`/`probeOnly` stay true;
`writeStarted`, `mutationAllowed`, `valuesExposed`, `liveSupportClaimed` and
`livePassClaimed` stay false. Booked remains **58**, D unbooked.

## Evidence and limits

Read the supplied UTF-8 Windows handover files in the parent `_temp-scripts`
directory, including AFTER_c149f940, its REAL_USE report and both JSON files,
the GitHub rough-search directions, acceptance checklist, and the prior
05d54285/0ca0acc2 reports and keeper R6/R7 materials. Their
`/workspace/handover` paths are references to the other environment.

The supplied c149f940 probe completed with **2/16** fields, eleven
`current_options_unavailable` selects with `target_missing` and
`optionsDefinitionIssue=root_anchor_missing`, and unchanged unavailable
counts through three attempts. Its final reason was `inspection_failed`,
stage `inspection`, reason `timeout`. Traffic was **0/0/0**, keeper
`no_non_get`, `commandFailed=false`, and focus emulation was cleared.
This is evidence for the failing entry point and readiness behavior. It
does not establish the CMS framework version, exact DOM/component topology,
or dictionary XHR timing.

Compared with 05d54285, commandFailed and cleanup improved while the same
2/16 fields remained. Compared with 0ca0acc2, the zero-traffic 2/16 shape
persisted, with more precise root-anchor diagnostics. The older 723bee7b
12/16 run had a separate keeper verdict failure. None is a new live result
of this revision.

Installed Vue 2.7.16 source clears/reassigns `__vue__` during component
updates and destruction. Installed Ant Design Vue 1.7.8 FormItem components
provide local ancestor anchors and current render trees. This supports a
conservative recovery path, but attributing the real CMS failure to an
inner shell, update timing or moved anchor remains an **inference**.

## Current evidence recovery

Keep the uniquely owned `.ant-select`, combobox and form-item checks.
An existing malformed select anchor cannot be bypassed. When that anchor
is missing, search only its DOM ancestors up to the already verified form
item. The nearest non-null anchor must verify; a malformed anchor is terminal.
Require the ancestor instance's `$el` and current `_vnode.elm` to match
that ancestor and follow bounded, verified current rendered VNode links to
the exact select (16 DOM ancestors, 32 VNode levels, 256 children per array,
512 queued/visited nodes). Never scan the document, another field, `$children`,
`$refs`, cached options or unrendered slot definitions for substitutes.

The existing select-chain, current props identity, SelectTrigger ARIA
binding, loading/mode/render exclusions and exact dictionary checks remain
required. Current `propsData.children` definitions can be read with no
mounted portal; `:options` is supported only through the installed Ant
rendered definitions, not an unchecked arbitrary prop array. Own data
descriptors avoid invoking getters, framework methods, selected/search state
or `_optionsInfo`. Populated DOM option evidence remains authoritative.

No dictionary XHR/body observer is added: the supplied evidence has no XHR
timing or field-to-response binding, and dictionary JSON cannot replace
current owned definitions. Both location fields retain `select_not_unique`
and the calendar retains `calendar_live_evidence_missing` when unevidenced.

## Inspection readiness

Reserve `max(25ms, 2 × slowest completed strict sample)` for another full sample
within the one host-side options deadline, checked before and after polling.
Do not dispatch an evaluation
with only a doomed tail of the remaining budget. Exhaustion preserves the
latest whole incomplete snapshot with readiness `timed_out`; it does not
upgrade fields or claim readiness. Every dispatched sample still uses the
same strict side-effect and host/browser timeout boundaries. Actual command
timeouts, side-effect exceptions, malformed evidence, later ownership drift,
unsafe traffic and cleanup failures still fail honestly.

## Validation and handoff

Windows / **Node v24.20.0**: **19 test files / 942 tests passed**, zero
failures, cancellations or skips (41.36 seconds). This includes all 15
`cms-row-d-*` test files, `cdp-client-timeout`, and all three `live-harvest-*`
files. `git diff --check` passed. Final ignored log:
`_temp-scripts/cms-row-d-options-root-anchor-r1-final.log`.

```powershell
$rowDTests = @(Get-ChildItem tests -Filter 'cms-row-d-*.test.mjs' -File |
  Sort-Object Name | Select-Object -ExpandProperty FullName)
$relatedTests = @('tests/cdp-client-timeout.test.mjs',
  'tests/live-harvest-readonly.test.mjs', 'tests/live-harvest-fixtures.test.mjs',
  'tests/live-harvest-timeout.test.mjs')
node --test --test-reporter=spec $rowDTests $relatedTests
```

The 26 new root-anchor cases exercise installed FormItem/Row/Col topology,
both options-prop and slotted definitions, missing/null expandos, current
render updates, stale/foreign/ambiguous links, unrendered slot-only data,
all graph bounds, accessor/privacy tripwires, ARIA drift and real V8 Proxy
side-effect refusal. Four timing regressions cover the reserve, changing
sample cost, delayed polling and actual loopback transport cleanup; a late
reply test uses an injected monotonic clock to avoid wall-clock races.
Existing real omitted-reply timeouts and guard failures remain covered.
Independent review found no blocking issue. Fixtures are offline and do not
establish a new live field count.

The native Blink regression first reproduced `root_anchor_missing` after
removing only the select expando from a locally installed component fixture
whose local ancestor and render tree remained intact. The full inspector
must recover that fixture under real `throwOnSideEffect:true`, with no
mounted portal and no value reads, writes, interactions or network attempts.
This manipulated fixture is explicitly a regression scenario, not captured
CMS DOM.

The location diagnostic's two reviewed dependency pins were refreshed after
the final code changes; its source gates and CDP/error pins are unchanged.
Deployed CRLF script bytes:

| Dependency | SHA-256 |
|---|---|
| `scripts/live/cms-row-d-live.mjs` | `430dabbbd724ebfbd93cee34a883810180397ab43f8d68e36a102dcff60c8231` |
| `scripts/lib/cms-row-d-options.mjs` | `0a69c4064ba98e72c21b2302207652d8c494d6b0282bf0b51816a1f193efa622` |

The historical embedded runner base `23c0ce54` remains provenance, not the
actual tip for a new run. Descendant/icon-only anchors stay unsupported;
sudden browser delays can still cause an honest inspection timeout.

After merge, sync the options library, official runner and location diagnostic
together, retaining the existing CDP/error dependencies. The parent must run
the official Never-Save probe at the actual merged tip and report field
reasons, unavailable/root-anchor counts, evidence provenance, readiness,
traffic and focus cleanup. No live CMS probe or PASS_PREFLIGHT is claimed
here. Without new acceptance evidence: **no book D, booked remains 58**.
