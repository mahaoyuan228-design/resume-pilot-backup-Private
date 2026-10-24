# CMS education CONTROLS residual R4

Fresh audit base: `e735874187e02017bb4441e82108bd5480853d4a`, fetched from
`cursor/expand-night-ats-f861`, hard-reset, and reverified before this work.
Branch: `codex/cms-edu-controls-residual-r4`.
Never-Save; `liveSupportClaimed=false`.

## Evidence and residual

The supplied material directory is outside the repository:
`_temp-scripts/cms-edu-controls-residual-r4-materials/`.

| Captured behavior | Audit at the base |
| --- | --- |
| CLEAN school open/close with one opener click, followed by generic `fuzzyMatchDic` POST and empty `suppressedLookup` | Addressed by merged #178, including the original harvest's three-parameter lookup query. Retained unchanged. |
| `harvest/harvest-summary.json` `networkPassive`: XHR POST `/wecruit/resume/info/edit/<baseline tenant>?iSaJAx=isAjax&request_locale=zh_CN` | Remaining gap: `isEducationAutosave` rejects every query string. |
| `harvest/isolated-open-summary.json` `networkPassive`: the same queried POST with label 学历 | Independent recording of the URL shape during the degree harvest. The visible menu did not open, and the per-field network slice is empty. Exact XHR-open/send timing is unproven. |
| Calendar isolated captures; city, academic degree, rank, and major captures | No additional raw request shape establishing another bounded exception. |
| CLEAN restoration/cleanup and overlay follow-up | No new ownership, restoration, or click-accounting regression beyond #178 is established. |

The CLEAN JSON is from `d22734a9`, before #178. Its nine failed fields share
the school-first failure; they do not establish nine independently failed
controls. Query redaction in that JSON cannot establish the original request
query. The raw harvest preserves the distinct queried autosave shape above.

## Change

The default queryless autosave classifier is unchanged. A separate
CONTROLS-only path recognizes exactly the two unique housekeeping parameters
above on the existing baseline POST endpoint. Unknown, duplicate, missing, or
invalid parameters, the lookup timestamp on this endpoint, alternate tenants,
origins, methods, credentials, paths, and fragments remain rejected.

Eligibility requires an armed XHR opened and sent inside the same owned school
or 学历 invocation. Each invocation has a private identity token; the same key
in a later restore invocation cannot authorize an older request. There is no
new exception for text writes, dates, academic degree, city, or rank. Requests
outside those ownership windows remain fatal, including late callbacks. This
bound is deliberately narrower than the harvest's unproven event timing.

The captured native XHR abort runs before native send. Suppression uses the
existing autosave ledger with `controlKey=school|degree`; host verification
requires CONTROLS mode, the exact endpoint/query, an allowed key, and existing
phase/transport/before-send evidence. An abort failure retains guards and
cannot pass. Fetch, beacon, and any CDP-observed non-GET remain fatal even when
the URL matches a valid page suppression. No request body, response, option,
selector, tenant, or live DOM is synthesized.

#178 lookup classification, control activation, ownership checks, click
accounting, timer settling, text writing, and exact restoration remain in
place. No browser or CDP connection, live trial, paid CITICS process/file
change, or tip/main push is part of this work.

## Offline verification

The final frozen source/test run used Node's test runner with
`--test-concurrency=3`:

- All nine `tests/cms-education*.test.mjs` files: **203/203 passed**, zero
  failures/skips.
- Twenty related CMS basic-seed, school, select, region, degree, text, document,
  section, verification, and known-partial test files: **198 passed**, zero
  failures, one existing trusted `insertText` browser-evidence skip (199 total).
- Combined: **402 tests, 401 passed, zero failures, one skip**. The two groups
  are disjoint. All 40 CMS source scripts and the changed test pass syntax
  checks; `git diff --check` passes.

The original default autosave classifier, #178 school-lookup classifier, and
timer ledger match the base after newline normalization. Generated test reports
are excluded from the change.

Fifteen new regression cases exercise the shipped runner with captured markup and explicitly
fictional callbacks: historical rejection, owned school/degree aborts,
unarmed/unowned/cross-control/late and previous-invocation rejection, other
control/text rejection, abort failure, host evidence validation, and fatal
fetch/beacon/CDP observations.

## Daytime retest evidence still needed

1. Verify the R4 commit's product/runner bytes on the authorized machine and
   begin with a clean page, native hooks, absent prior API, and zero overlays.
   Leave the daytime CDP 9242 session to its operator.
2. Run the authorized Never-Save CONTROLS=1 trial with exact fixture originals;
   record all seven complete and observed mouse sequences, exactly one opener
   click each, and owned visible open/close results. 学历 opening remains
   unproven by the supplied isolated harvest.
3. Record bounded `suppressedLookup` and, if attempted during eligible owned
   activity, queried autosave suppression with the correct `controlKey`.
   Generic/non-GET traffic must remain empty. A request arriving after its
   owned invocation still fails; capture that timing rather than widening the
   exception without evidence.
4. Require nine verified readbacks, exact DOM/public-props/DTO restoration,
   unchanged neighbors, settled callbacks, successful cleanup, zero remaining
   overlays, absent trial API, and restored native hooks afterward.

These offline tests do not establish live support or acceptance credit.
The unharvested second city menu, opened date year/month choosers, differing
widget originals, and changed-value widget writes remain outside this trial.
`liveSupportClaimed=false`.
