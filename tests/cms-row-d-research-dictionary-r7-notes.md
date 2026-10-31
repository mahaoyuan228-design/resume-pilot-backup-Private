# CMS row D research dictionary R7

Date: 2026-10-24. Base: `8abbdc20dc1b79bfb52d4378f62a4f2023943ef0` (#202).
Branch: `codex/cms-row-d-research-dictionary-r7`.
Target: `cursor/expand-night-ats-f861`.

`neverSave=true`, `liveSupportClaimed=false`, `livePassClaimed=false`,
`writeStarted=false`, `mutationAllowed=false`, `valuesExposed=false`,
`probeOnly=true`. Booked remains **53**; D is unbooked. This revision uses no
live browser/CDP session and performs no fill, Save/submit, dropdown/calendar
interaction or booking. No education, paid or other ATS files changed.

## Evidence

Read the R7 handover prompt, `diagnostics.json`, `official-RESULT.json`,
`official-cms-row-d-live.json`, `guarded-diagnostic-live.json`, and
`REAL_USE_CMS_ROW_D_NEXT_EVIDENCE_8abbdc20_2026-10-24.md`. Verified the
collector/diagnostic/guarded-result SHA256 values against `SHA256SUMS.txt`.
The reviewed collector's editable ancestry/designMode protection and static
leaf-span restriction were already reviewed before the parent captured evidence.
This implementation worker did not re-run the collector or contact CDP.

The 20:48 guarded diagnostic captures exactly 32 unique research option labels
from the fixed `13_102501_0` wrapper and section `13`. Wrapper, item, question
and control ownership are verified; one checkbox group has 32 owned options
and 32 owned checkbox inputs. The first 25 labels match the historical sample.
The remaining seven labels, in captured order, are:

`传媒`, `通信`, `计算机`, `中小盘`, `环保及公用事业`, `煤炭开采`, `智库研究`.

Both the earlier official result and the guarded diagnostic's official runner
result are still **12/16**, `ok=false`, `row_d_preflight_incomplete`, with a
completed probe, correlated keeper blocks, zero response evidence and no guard
failure or truncation. Those historical outcomes are not rewritten as R7 results.

## Change and boundaries

Production changes are limited to the research dictionary: append exactly the
seven captured labels, set `harvestedOptionCount=32` and `optionsComplete=true`,
and document the new field-level provenance. No DOM selectors, ownership rules,
control logic, page interactions, network guards or evaluation flags changed.

The existing complete-dictionary path requires exact current label cardinality
and order as well as section/item/wrapper/question/control ownership and
availability. Unknown, missing, additional or reordered labels still fail with
`option_dictionary_mismatch`; duplicate labels fail with `option_list_ambiguous`;
foreign/nested ownership or an option outside its group still fails. Dictionary
matching returns indexes only; inspection output does not expose option labels
or current values. The official evaluation retains `throwOnSideEffect:true`,
with no less restrictive fallback.

`tests/fixtures/cms-row-d-research-dictionary-r7.json` is a sanitized projection
of this new capture. It includes the full 32-label list, fixed ownership facts,
source filenames and SHA256 values, the actual historical 12/16 result, and
safety flags. The old 25-label harvest fixture and R6 12/16 fixture remain
unchanged. The dictionary contract test uses the independent R7 fixture for
research and the old fixture for other fields. `ROW_D_BASE_TIP`/`ROW_D_HARVEST`
still identify the original harvest for those unchanged fields. The inherited
`ROW_D_LIVE_BASE_TIP` constant remains unchanged; the parent must verify the
actual merged tip and its Dev bytes separately.

Locations continue to fail closed. The new diagnostic proves two owned peer
selects per location wrapper, not their geographic levels, ARIA list mapping,
complete independent dictionaries or safe behavior. No first-select fallback,
host filtering, geographic labels or location support was added. Calendar still
has only a unique readonly text input/picker structure; date behavior remains
unevidenced and `calendar_live_evidence_missing` remains a skip.

## Offline validation

```powershell
node --test tests/cms-row-d-options.test.mjs tests/cms-row-d-probe-expression.test.mjs tests/cms-row-d-debug-evaluate.test.mjs tests/cms-row-d-live.test.mjs tests/cms-row-d-live-cdp.test.mjs
```

Node **v24.20.0**: **409/409 passed**, zero failures, cancellations or skips.
Log: `_temp-scripts/cms-row-d-r7-tests-final.txt`. `git diff --check` passes.

Coverage includes every recorded label resolving by index; complete 32-label
observation; unknown/missing/reordered/duplicate/additional final labels; old
25-label truncation; group and named-wrapper ownership; and actual V8 guarded
serialization reaching a newly captured option at index 31. Existing zero
current-value-read, zero interaction, hostile iterator/trim/property, network
correlation, response/redirect and teardown regressions remain green.

Synthetic DOM tests model **13/16** while explicitly preserving both two-peer
location skips and the calendar skip. Loopback CDP tests model the same projected
research upgrade with blocked tenant traffic; mismatched IDs, responses and late
traffic still hard-fail. A separate test rejects stale partial-research Runtime
metadata, while keeping the historical 12/16 fixture unchanged. This prediction
is not a new real-page observation or a live result.

Adjacent-scope import search found row-D options consumed only by its own live
runner and the five row-D test suites. No shared utility or adjacent production
module changed; unrelated ATS, education and paid suites were not broadened.

The parent owns review, PR/merge, merged-tip regressions, Dev hash sync and the
next official guarded live probe. A possible 13/16 remains a hypothesis until
that re-probe. No preflight/fill/support PASS, server-write-isolation proof or
permission to book D follows from this dictionary change. Booked remains **53**.
