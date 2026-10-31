# CMS education CONTROLS daytime offline pack R2

Canonical GitHub `cursor/expand-night-ats-f861` was fetched, the workdir was
hard-reset, and HEAD was reverified as
`0e93313afe0261e45755e9f028c2094dc972b867` before this work.
Branch: `codex/cms-edu-controls-daytime-pack-r2`.
Never-Save; `liveSupportClaimed=false`.

## Checklist audit and distinct coverage

The source checklist is the supplied PC
`_temp-scripts/codex-cms-edu-controls-residual-r5-lastmsg.txt`.
The supplied CLEAN report, R4 harvest, and
`cms-edu-widget-overlay-harvest-d22734a9/contrast-school-vs-degree.json`
remain evidence of the earlier bounded failures. They do not establish a new
opener, a native event implementation, or a successful visible degree opening.

R1 already documents every R5 checklist bullet. Most assertions also exist at
the pinned tip. The remaining test gap is the interaction of CONTROLS mode
with callback settlement and neighboring values: the comprehensive timer and
other-row tests exercise text-only mode, while the controls success case checks
education serialization and hook cleanup without explicit timer diagnostics or
the existing outside input. CONTROLS mode has its own protected-value and
overlay exclusions and settles callbacks while a control invocation is owned.

R2 adds regression assertions to that existing controls fixture. It does not
demonstrate or fix a product/runtime defect. No product or runner code changes.
The existing fictional public props and region scaffold remain explicitly
fictional. The three new scenarios schedule fictional callbacks or mutate an
existing fixture input. They add no DOM, selector, opener, option, response, or
claim about the site's handler implementation.

| R5 daytime checklist item | Pinned-tip offline coverage | R2 addition / daytime pass condition |
| --- | --- | --- |
| Reviewed bytes; clean native hooks; absent trial API; zero initial overlays | R1 notes, widget-open notes, residual-guard refusal in `cms-education-controls-live.test.mjs` and `cms-education-widget-open-r3.test.mjs`; existing preflight failures in `cms-education-live.test.mjs` | No new preflight mechanism. Verify reviewed runner/product bytes and the actual clean machine/page before daytime activity. Old harvest hashes do not verify R2 bytes. |
| Seven distinct owned visible open/close probes; one counted opener and three observed mouse events per key | Controls fake-CDP success and probe rejection cases; R3 delivery/ownership tests; `completeWidgetProbes` in the runner | Retain existing checks. Daytime must supply all seven native-site results, especially `degree`; focus, hidden options, or zero overlays do not prove opening. |
| Bounded suppression with correct ownership and before-send abort | Controls #178 lookup and #180 queried-autosave classifier, invocation, abort-failure, transport, and late-request cases | Existing bounds retained. New fictional nested callbacks exercise settlement under the existing controls path; no exception is widened. Daytime still needs actual request timing and ownership. |
| Explicit empty generic traffic ledgers; zero forbidden clicks | R1 fake-CDP success, malformed-ledger/count rejection, fatal generic traffic/click cases | Retain explicit `nonGet=[]`, `saveLikePost=[]`, and `clickCount=0`; never infer these from absent proof. |
| Nine verified readbacks; exact DOM/public-props/DTO restoration | Controls nine-field trial and fake-CDP success compare exact readbacks and whole `readProof()` snapshots | Recheck exact education restoration after asynchronous callbacks and failed interval/neighbor trials. Daytime must verify its actual originals and readbacks. |
| Unchanged neighbors | Text-only two-row success/drift cases in `cms-education-live.test.mjs`; shared runner outside/protected snapshots | Exercise the CONTROLS branch with the fixture's existing `#unrelated` input. A changed neighbor must fail and cannot be overwritten to manufacture restoration. |
| Settled callbacks | Text-only function/non-function timeout, nested callback, interval, opaque-delay, late mutation, and guard-retention tests in `cms-education-autosave.test.mjs`; delayed controls open/close cases | Assert zero pending/unobservable timers on controls success. A school-created unresolved interval must fail run/cleanup and retain guards until the test cancels its own interval. |
| Complete cleanup; zero overlays; absent API; restored native hooks | R1 controls success checks exact hook descriptors, injected globals, API absence, and overlays; helper descriptor restoration case | Verify those boundaries after the added callback/neighbor failures and explicit test-owned recovery. Daytime must independently observe native-site cleanup. |

The failed-neighbor and interval fixtures deliberately fail. Their reported
failure and retained guards are required results, not successful trial evidence.
Only the test restores its own neighbor mutation or cancels its own interval
before retrying cleanup. Callback scheduling is a falsifiable offline scenario,
not a claim about the private site's event timing.

## Validation

The pre-edit baseline passed all nine `tests/cms-education*.test.mjs` files:
**203/203**, zero failures/skips, with `--test-concurrency=3`.

The three new regression cases passed independently (**3/3**, zero
failures/skips). The selected run including the strengthened fake-CDP success
case also passed (**4/4**). These runs overlap and are not additive.

The complete frozen-source run passed all nine CMS education test files:
**206/206**, zero failures/skips, with `--test-concurrency=3`. This includes
the three added regression cases and the strengthened fake-CDP success case.
The changed test passes `node --check`; `git diff --check` passes. The existing
module-type warning is unchanged. All product and runner files match the pinned
base.

```powershell
$cmsTests = @(Get-ChildItem tests/cms-education*.test.mjs -File | ForEach-Object { $_.FullName })
node --test --test-concurrency=3 @cmsTests
node --check tests/cms-education-controls-live.test.mjs
git diff --check
```

Generated reports are excluded from the change.

## Daytime evidence still required

Run only the authorized Never-Save CONTROLS=1 trial after reviewed-byte and
clean-page checks. Record all seven owned visible open/close results, exact
counted/observed activations, bounded suppression and empty generic traffic,
nine exact readbacks, unchanged neighbors, callback settlement, and complete
restoration/cleanup. `pendingTimers` and `unobservableTimers` must be zero;
`observedNonFunctionTimeouts` is a nonnegative count, not required to be zero.
Retain and inspect actual before/after native hook evidence and absent trial
API/overlays. A bare success flag cannot substitute for those observations.

Degree visible opening remains unproven live. The second city menu, opened
calendar year/month chooser panels, differing widget originals, and
changed-value widget writes remain outside this bounded trial. Previously
captured APIs, workers, future responses, and arbitrary future callbacks are
outside the runner's bounded timer observation.

No live browser/CDP session, login, paid-path change, or release acceptance
credit is part of this pack. `liveSupportClaimed=false`.
