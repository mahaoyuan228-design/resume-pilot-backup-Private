# hotjob pb 说明（通过科目） Never-Save trial

The base contains the real label, textarea tag, ant-input class, and exact placeholder in both tests/fixtures/hotjob-pb-contact-eval-probe-dom.json (neighbors.certNote) and tests/fixtures/hotjob-pb-certs-probe-dom.json (neighbors.certNote). Existing content allowlists omit this field. The new fixture copies those observed tokens; all caller prose and neighbor sentinels in tests are synthetic. No new DOM was harvested or invented.

Inject src/content/hotjob-pb-cert-note.js into the probed HTTPS pb/resumeOperation page for this standalone trial. It exports the same explicit caller API shape as the existing pb trial modules:

```js
const api = globalThis.ResumeHotjobPbCertNote;
api.inspect();
await api.fillField("说明（通过科目）", explicitCallerText);
await api.fillProfile(profile); // confirmed customAnswers.说明（通过科目）
await api.cancelField("说明（通过科目）");
```

Only one observed .resume-operation-wrap and one unambiguous visible textarea.ant-input inside it with the observed label and placeholder are accepted. External rows and controls moved outside the root during focus or input events fail closed; later events are not sent to an unowned control. Only literally empty controls (value === '') receive the supplied text after NFKC, zero-width removal, CRLF/CR-to-LF normalization, and edge trim; internal spaces and line breaks remain. Existing values are preserved and only an exact textarea value is verified as already matching. After events, the current live control is located again and its raw text must match. Confirmation is required for profile-derived values. No description, passed subject, score, or qualification is inferred.

The fixtures do not establish how repeated 说明（通过科目） notes map to individual exams. Multiple matching rows are refused; this trial accepts only a singleton note with an explicitly supplied primitive value. Per-exam mapping remains unsupported until that DOM evidence exists.

This additive trial does not alter the production manifest, planner, CMS, profile schema, or existing certificate module (including PR 109). liveSupportClaimed=false, supportClaimed=false, neverSave=true, and saved=false remain fixed. No code clicks a control or a button; cancellation sends Escape only.

Validation: node --test tests/hotjob-pb-cert-note.test.mjs. Tests cover explicit empty fill, exact existing-value comparisons, caller line-ending normalization, strict readback, external rows, multiple roots, focus/input reparenting, replaced controls, focus-time population/navigation/visibility changes, unchanged neighbors, duplicate/disabled/readonly controls, placeholder drift, wrong page, hidden page, busy menus, Escape cleanup, profile confirmation, and Never-Save flags. Offline tests do not claim live site support.
