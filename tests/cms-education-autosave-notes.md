# CMS education Never-Save autosave handling

This documents the v2 text-only settle/suppression fix on `f3f32545eaf32ee23a9b7d75c335acef86e700bf`, which already includes PR #172. The separate `CONTROLS=1` probes, harvested adapters, and exact-original preflight remain documented in [cms-education-harvest-notes.md](cms-education-harvest-notes.md); this fix adds no widget behavior.

The default trial uses `scripts/live/cms-education-live.mjs` to verify and restore two text fields after blocking the evidenced autosave attempt. It does not save fixture values or simulate a successful save response.

## Evidence boundary

The v2 evidence is outside the repository, under `C:\Users\admin\Desktop\ResumeQuickFill-Dev\_temp-scripts\real-use-9242-edu-retest-3b51254e\`, mirrored in `cms-edu-autosave-v2-materials\` under the same parent:

- `REAL_USE_CMS_EDU_RETEST_3b51254e_2026-10-23.md`, “字段结果表”, “Never-Save proof”, and “对 #172 的读法”: the #172 retest failed with `autosave_callbacks_unverifiable`, not the earlier `non_get_request`. It did not establish a successful suppression path.
- `cms-education-live.json`: both `fields` text entries fail with `autosave_callbacks_unverifiable`; `suppressedAutosave`, `nonGet`, and `saveLikePost` are empty. `finalDetails` records exit 2, zero clicks, and unsuccessful restore/cleanup/page-left-as-found checks.
- `cms-edu-retest-summary.json`: `neverSave.pagePostsSeenAfterFail` reports the exact info/edit POST on the XHR abort path; `neverSave.postFailManualRestore` reports the later manual restoration. The report states native send was not released. Empty suppression evidence must not be presented as an observed suppression success.
- `postfail-cleanup.json`: `before.posts` contains that XHR; `before.suppressed` is empty, `cleanupResult.result.reason` is `autosave_callbacks_unverifiable`, and the major still contains the fixture value after cleanup.
- `restore-major-after-fail.json`: `restore.actions` confirms later manual restoration; `restore.clickedSave=false` and `blockedNonGet=[]`.

These files do not identify the actual timer argument or prove why that XHR appeared only in `posts()`. In source, any non-function callback permanently set `untrackedTimer`, even after cancellation. Also, an exception from `this.abort()` diverted a qualifying autosave into the generic forbidden log before suppression was recorded. The regressions model these mechanisms without claiming either synthetic timing or an abort exception was observed live.

The earlier #172 baseline used these separate files under the same `_temp-scripts\` parent:

- `real-use-9242/cms-education-live.json`: `fields` reports `education.0.major` and `education.0.majorDescription` failing with `non_get_request`; `nonGet` and `saveLikePost` identify one XHR POST to `/wecruit/resume/info/edit/<baseline tenant>`. `finalDetails` reports zero clicks, successful restoration and cleanup, and `liveSupportClaimed=false`.
- `cms-edu-autosave-materials/REAL_USE_CMS_EMPTYPREF_9242_RESULT_2026-10-23.md`: the “教育经历（cms-education-live）”, “Never-Save proof”, and “Top blockers” sections describe that blocked autosave and the remaining unsupported controls. The “个人基本信息（cms-basic-info-live）” section reports the existing basic-info pass; that runner is outside this change.

The supplied education JSON contains no DOM evidence for the seven skipped controls. It supports this narrow request-handling change only.

## Request handling

- The page guard is installed before the shipped education writer runs. Suppression is armed only for the trial and restoration phases.
- Both XHR `open` and `send` must occur while armed. Only `POST` to the exact observed endpoint qualifies. Its tenant is derived from the already-supported baseline page; credentials, query strings, fragments, other paths, origins, methods, and tenants do not qualify.
- The qualifying XHR is aborted through the captured prototype method before native `send` can run. No request body is inspected or logged. A `finally` records `suppressedAutosave` with `blockedBeforeSend=true` and the captured phase even if abort throws. A throw adds `abortFailed=true`, fails the trial as `autosave_abort_failed`, and retains the guards. This records a blocked send, not a successful abort or save. Host evidence preserves the failure marker and cannot pass with it.
- Every other non-GET attempt remains fatal, including matching fetch/beacon requests and pretrial or unknown XHRs. Mandatory CDP interception still blocks every non-GET request; any CDP-observed non-GET is fatal even if its URL matches the autosave endpoint. A suppression record cannot excuse network traffic.
- All clicks and form submissions remain blocked. The shipped writer, DOM readback, React serialization proof, exact original-value restoration, and unchanged-other-fields checks remain required.

## Delayed work and cleanup

Page timeouts and intervals scheduled while armed are tracked by handle and generation. Function callbacks leave the ledger in `finally` only if the handle still belongs to that invocation. For a non-function timeout on the guarded window with a numeric or omitted delay, the original callback still goes directly to the captured native scheduler. A second native timeout at the same delay observes completion, preserving native global scope, string conversion, and CSP handling without evaluating or rewriting site code. This relies on the same-global, same-delay ordering in the [HTML timer algorithm](https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#run-steps-after-a-timeout). Native CSP rejection returning zero creates no tracked timer. Nested callbacks and promise continuations run under the request guards and enter the ledger through the patched APIs.

Both clear APIs convert the native timer ID once and remove the matching timer and its observer; the harness never silently cancels site work. Generation tokens protect newly reused IDs from old callback completion. A site clear-all loop that directly cancels an observer makes its parent unobservable; its stale ID cannot later cancel unrelated site work. Intervals remain pending until explicitly cleared. Non-function callbacks with nonnumeric delays stay pending until cancelled: the harness does not repeat object coercion or guess when they completed. The 2,000 ms drain then stops with `autosave_timer_unobservable`. Other callbacks beyond the budget stop with `autosave_callbacks_pending`. Scheduling through a borrowed foreign-window receiver stops before scheduling with `autosave_timer_receiver_unobservable`; foreign clears cannot change the local ledger. These stops retain guards and attempt exact native restoration before reporting failure.

`timerSettle()` and the result/cleanup snapshots expose only `pendingTimers`, `unobservableTimers`, and `observedNonFunctionTimeouts` counts. The host copies these counts to `finalDetails.timerSettle`; no callback source, delay, original field value, or request body enters evidence.

Cleanup rechecks restoration after draining and removes the guards only after that succeeds. A failed drain or restoration retains the page guards; unsuccessful cleanup cannot report `pageLeftAsFound=true` or a successful trial. The bounded drain does not prove absence of arbitrary future work through previously captured APIs, workers, or unrelated asynchronous responses.

## Validation and claims

Offline tests use fictional fixtures and fake CDP; they are not evidence of a new live-site pass. This change has no live retest or live support claim. `liveSupportClaimed` remains `false`.

Validation for v2: **159/159 offline tests pass** in `tests/cms-education*.test.mjs` on Windows with Node 24.20.0 (54 autosave tests). Coverage includes the shipped text writer with non-function/nested timers, cancelled and unresolved work, timer ID reuse and foreign receivers, exact restoration, abort-error evidence, and fatal unrelated non-GET attempts. Fake CDP checks the final evidence and seven skips. No live retest is represented by these tests.

In the default text-only mode, only 专业名称 and 专业描述 are exercised. 学校、学历、学位、开始时间、结束时间、城市、专业排名 remain `skipped/control_not_supported`. PR #172 introduced no new control adapters or tenant support.
