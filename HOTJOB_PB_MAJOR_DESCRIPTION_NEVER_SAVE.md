# hotjob pb 专业描述 Never-Save trial

The base contains the real label, textarea tag, ant-input class, and exact placeholder in both tests/fixtures/hotjob-pb-contact-eval-probe-dom.json (neighbors.majorNote) and tests/fixtures/hotjob-pb-certs-probe-dom.json (neighbors.majorNote). Existing content allowlists omit this field. The new fixture copies those observed tokens; all caller prose and neighbor sentinels in tests are synthetic. No new DOM was harvested or invented.

Inject src/content/hotjob-pb-major-description.js into the probed HTTPS pb/resumeOperation page for this standalone trial. It exports the same explicit caller API shape as the existing pb trial modules:

```js
const api = globalThis.ResumeHotjobPbMajorDescription;
api.inspect();
await api.fillField("专业描述", explicitCallerText);
await api.fillProfile(profile, educationIndex); // confirmed education.<index>.majorDescription
await api.cancelField("专业描述");
```

Only one unambiguous visible textarea.ant-input with the observed label and placeholder inside the single `.resume-operation-wrap` is accepted. The wrapper is checked again after focus and events; a row moved outside it cannot be written after focus or verified after events. Only literally empty controls (value === '') receive the supplied text after NFKC, zero-width removal, and edge trim; internal spaces and newlines remain, with CRLF/CR normalized to the textarea's LF representation. Existing values are preserved and verify only when their full multiline value matches the expected text. After events, the current live control is located again and its raw text must match. Confirmation is required for profile-derived values. No description, passed subject, score, or qualification is inferred.

This additive trial does not alter the production manifest, planner, CMS, profile schema, or existing certificate module (including PR 109). liveSupportClaimed=false, supportClaimed=false, neverSave=true, and saved=false remain fixed. No code clicks a control or a button; cancellation sends Escape only.

Validation: `node --test tests/hotjob-pb-major-description.test.mjs` — 50 passed. Tests cover explicit empty fill, existing-value preservation, exact multiline equality, CRLF normalization, wrapper containment before/after focus and each event, strict readback, replaced controls, focus-time population/navigation/visibility changes, unchanged neighbors, duplicate/disabled/readonly controls, placeholder drift, wrong page, hidden page, busy menus, Escape cleanup, profile confirmation, and Never-Save flags. Offline tests do not claim live site support.

Missing evidence remains for readonly calendar interactions, both upload flows, per-exam associations for repeated qualification notes, expanded/add-row controls, and unharvested select options or deeper cascader paths. No such DOM or choices are invented by this change.
