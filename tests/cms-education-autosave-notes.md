# CMS education Never-Save autosave handling

This change uses task option B in `scripts/live/cms-education-live.mjs`. It permits local text verification and restoration after blocking the evidenced autosave attempt. It does not save the fixture values or simulate a successful save response.

## Evidence boundary

The supplied evidence files are outside the repository, under `C:\Users\admin\Desktop\ResumeQuickFill-Dev\_temp-scripts\`:

- `real-use-9242/cms-education-live.json`: `fields` reports `education.0.major` and `education.0.majorDescription` failing with `non_get_request`; `nonGet` and `saveLikePost` identify one XHR POST to `/wecruit/resume/info/edit/<baseline tenant>`. `finalDetails` reports zero clicks, successful restoration and cleanup, and `liveSupportClaimed=false`.
- `cms-edu-autosave-materials/REAL_USE_CMS_EMPTYPREF_9242_RESULT_2026-10-23.md`: the “教育经历（cms-education-live）”, “Never-Save proof”, and “Top blockers” sections describe that blocked autosave and the remaining unsupported controls. The “个人基本信息（cms-basic-info-live）” section reports the existing basic-info pass; that runner is outside this change.

The supplied education JSON contains no DOM evidence for the seven skipped controls. It supports this narrow request-handling change only.

## Request handling

- The page guard is installed before the shipped education writer runs. Suppression is armed only for the trial and restoration phases.
- Both XHR `open` and `send` must occur while armed. Only `POST` to the exact observed endpoint qualifies. Its tenant is derived from the already-supported baseline page; credentials, query strings, fragments, other paths, origins, methods, and tenants do not qualify.
- The qualifying XHR is aborted before native `send` can run. No request body is inspected or logged. The guard records `suppressedAutosave` with `blockedBeforeSend=true` and its phase, separately from forbidden `nonGet`/`saveLikePost` attempts. It does not synthesize an HTTP response or call success handlers.
- Every other non-GET attempt remains fatal, including matching fetch/beacon requests and pretrial or unknown XHRs. Mandatory CDP interception still blocks every non-GET request; any CDP-observed non-GET is fatal even if its URL matches the autosave endpoint. A suppression record cannot excuse network traffic.
- All clicks and form submissions remain blocked. The shipped writer, DOM readback, React serialization proof, exact original-value restoration, and unchanged-other-fields checks remain required.

## Delayed work and cleanup

Page timeouts and intervals scheduled while armed are tracked. Harness waits use the captured native timeout API. Callbacks run under the request guards; nested callbacks are tracked, and cleared timers leave the ledger. The drain has a 2,000 ms bound per check and includes a quiet turn. An uncleared interval, pending callback beyond the bound, or an unwrappable string callback prevents successful cleanup. Site timers are not silently canceled.

Cleanup rechecks restoration after draining and removes the guards only after that succeeds. A failed drain or restoration retains the page guards; unsuccessful cleanup cannot report `pageLeftAsFound=true` or a successful trial. The bounded drain does not prove absence of arbitrary future work through previously captured APIs, workers, or unrelated asynchronous responses.

## Validation and claims

Offline tests use fictional fixtures and fake CDP; they are not evidence of a new live-site pass. This change has no live retest or live support claim. `liveSupportClaimed` remains `false`.

Validation: all 98 tests in `tests/cms-education*.test.mjs` pass. The additional basic-info regression suite passes 18/18 with an external, test-only loader normalizing its existing Windows URL-path conversion and CRLF-sensitive source-string assertion. The unmodified basic-info test command fails on those platform assumptions in this checkout; its test, runner, matcher, session module, and engine are unchanged. The loader changes no product code or repository file.

Only 专业名称 and 专业描述 are exercised. 学校、学历、学位、开始时间、结束时间、城市、专业排名 remain `skipped/control_not_supported`. No new control adapters or tenant support are introduced.
