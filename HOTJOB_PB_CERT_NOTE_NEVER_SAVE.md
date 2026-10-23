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

Only one unambiguous visible textarea.ant-input with the observed label and placeholder is accepted. Only literally empty controls (value === '') receive the supplied text after NFKC, zero-width removal, and edge trim; internal spaces and newlines remain. Existing values are preserved. After events, the current live control is located again and its raw text must match. Confirmation is required for profile-derived values. No description, passed subject, score, or qualification is inferred.

This additive trial does not alter the production manifest, planner, CMS, profile schema, or existing certificate module (including PR 109). liveSupportClaimed=false, supportClaimed=false, neverSave=true, and saved=false remain fixed. No code clicks a control or a button; cancellation sends Escape only.

Validation: node --test tests/hotjob-pb-cert-note.test.mjs. Tests cover explicit empty fill, existing-value preservation, strict readback, replaced controls, focus-time population/navigation/visibility changes, unchanged neighbors, duplicate/disabled/readonly controls, placeholder drift, wrong page, hidden page, busy menus, Escape cleanup, profile confirmation, and Never-Save flags. Offline tests do not claim live site support.
