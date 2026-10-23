# CMB basic native text Never-Save trial

Evidence: `dist/site-probes/cmb-remaining-dom-ids-20261019.json` at base `3fd7a99d7044230f5210b8fa146dba5b67378cac`, captured on `2026-10-19T05:08:44.887Z`. The new fixture copies the observed field and neighbor metadata verbatim. Tests construct those native controls directly, without inventing Ant form wrappers. Guard mutations and caller values are synthetic test scenarios.

The existing CMB planner omits these 3 fields:

- `resume_basicInfo_idCard`: 证件号 (`input`)
- `resume_basicInfo_currentResidence`: 现居住地 (`input`)
- `resume_basicInfo_selfAssessment`: 自我评价 (`textarea`)

Inject `src/content/cmb-basic-native-text.js` into the exact probed page, `https://career.cmbchina.com/center/resume`, for a standalone trial. It exports:

```js
const api = globalThis.ResumeCmbBasicNativeText;
const id = 'resume_basicInfo_idCard';
await api.fillField(id, 'Explicit confirmed caller text', { confirmed: true });
await api.fillFields({ [id]: 'Explicit confirmed caller text' }, { confirmedFields: [id] });
await api.fillProfile({
  values: { [id]: 'Explicit confirmed caller text' },
  confirmedFields: [id]
});
```

IDs are explicit source keys; there is no conversion from the shared profile schema, inferred school/row selection, copied family record, generated prose, or inferred score. Text is retained exactly, including textarea newlines. Native single-line inputs reject newlines. Only a literally empty value receives a write. A different existing value is reported as `existing_value`; an identical value is read back without events.

All requested facts and targets are checked before the first write. Targets require the harvested ID, native tag/type, stable `ant-input` class, placeholder, and null/name/role/ARIA metadata. The observed `ant-input-status-success` class is transient validation state and is not required. Duplicate, hidden, disabled, readonly, foreign-form, replaced, and drifted controls fail closed. Each native setter call is followed by input/change/blur events and asynchronous identity, exact-value, native-validity, and neighboring-control readback. A detected side effect fails the result and stops later fields; it does not claim to undo site event handlers.

`liveSupportClaimed=false`, `supportClaimed=false`, `complete=false`, and all Save/submit/deliver/delete/next flags remain fixed. The writer makes no click, submission, or network calls. Offline tests do not establish whether the live site's event handlers autosave; live Never-Save acceptance remains pending. This additive trial changes no existing CMB, CMS, profile, manifest, or production routing files.

Validation: `node --test tests/cmb-basic-native-text.test.mjs` — 18 tests cover every observed field, confirmation, blank-only writes, preservation, exact native events, asynchronous readback failures, unchanged neighbors, duplicate/disabled/readonly/drifted targets, runtime limits, changing page identity/visibility, and concurrency. All seven new groups pass 126 tests together.
