# INVESTIGATE_MAJOR — CMS「专业名称」父 formData 未提交

Date: 2026-10-16 (Asia/Shanghai)  
Tree: `/workspace/resume-autofill/` (region+rank overlays merged; **major NOT patched**)  
Constraint: no FocusEvent / React-internal / DTO-relax product patches applied.

## 1. Symptom (real site, retained)

| Layer | Observed |
| --- | --- |
| DOM `input.value` | new ~42-char source major |
| Input component local state | new 42-char |
| Parent `formData` / DTO | still old ~10-char |
| Controller field status | DOM path `verified`, then serialization flips to `failed` / `react_serialization_mismatch` |
| Latest CMS task | `e4b5e871-…` partial; source5 major mismatch among other failures |

Post-fill AHZ readonly (`resume-cms-major-event-v0149-AHZOdI/private.json`, SHA `60f4c64ee65de6ca4cf314412cd0589b8847b90cb5fd2f4533fb84ebe1c20b35`): page `visible=false` / `hasFocus=false`; major input connected; `onBlur` / `onChange` present. That snapshot is **after** fill, not a during-fill proof by itself.

## 2. Relevant product code (unchanged)

`src/content/cms-record-controller.js` `textAdapter` (impl revision 4):

1. `requirePage()` — **only** `visibilityState==='visible'` (+ correct URL); **does not** check `document.hasFocus()`
2. `input.focus({preventScroll:true})` then require `activeElement===input`
3. Native value setter + synthetic `input` / `change`
4. `input.blur()` then require `activeElement!==input`
5. Return `verified` if DOM value matches — **no check that blur/focusout events fired**, **no parent/DTO read**

Later `verify_react_serialization` (`cms-education-serialization.mjs`) reads public `formData` and fails major when display/serialized ≠ desired.

Public employer Input (`loaded-1.js`): `onBlur` synchronously reads `event.target.value`, `formatCheck`, then `props.handleChange` → parent. Local updates on change; **parent commits on blur**.

## 3. Root-cause hypotheses (ranked by evidence)

### H1 — Strong (mechanism proven offline; during-fill on real Edge still to confirm)

**When `document.hasFocus()===false` but the tab can still be `visibilityState==='visible'`, Chromium `HTMLElement.focus()` / `blur()` mutate `activeElement` without dispatching `focus` / `blur` / `focusout`.**

Consequences matching the bug:

- Synthetic `input`/`change` still run → local state + DOM update (42 chars)
- No blur/focusout → public `onBlur` never runs → parent `formData` stays old (10 chars)
- `textAdapter` still returns DOM `verified` (it only watches `activeElement`)
- Serialization correctly reports `react_serialization_mismatch`

**Offline proof (this box, Chrome 155, no job site):**

| Probe | Result file | SHA256 |
| --- | --- | --- |
| Xvfb headed, other window focused, site stays `visible` | `investigations/major-hasfocus/result-xvfb-unfocused-visible.json` | `af0d8cba0b7b9bd9054b84011260bf08ce2d9c6b97a259dc4448d22dc6886f57` |
| Headless tab backgrounded (`visible=hidden`) | `investigations/major-hasfocus/result-hidden-silent-ae.json` | `c7324af77df1c5297404d37a2496f465fe8505be72f098fe16c184a2d534ba7d` |

Decisive Xvfb case `B_thief_activated` / `C_thief_clicked`:

- `before.hasFocus===false`, `before.visible==='visible'` (**fill-legal** for `requirePage`)
- Events: only untrusted `input`/`change` — **no** `focus`/`blur`/`focusout`
- `adapterWouldPassDom===true`, `parentCommitted===false`, parent remains `old10chars`, local/DOM = new

Prior Edge headless focus probes (`overlays/cms-text-focus-events/`) never achieved `hasFocus=false` while testing; they therefore **could not** falsify H1.

### H2 — Strong supporting (commit path)

Parent formData updates only via Input `onBlur` → `handleChange`. Proven from public JS + isolation blur-commit tests. Explains *where* commit must happen; H1 explains *why* it can be skipped while DOM looks fine.

### H3 — Excluded: stale / wrong React props instance

Three fiber prop surfaces + parent `owner.state.values` consistent; swapping which props to read cannot fix. Region was a separate reader-order bug (already overlaid).

### H4 — Excluded: length / format rejection

Major template: no `inputCheckFormat` / min/max length; DOM `maxLength=-1`; errors 0.

### H5 — Excluded: missing handlers

AHZ: `onBlur` / `onChange` present on connected major input.

### H6 — Weak: async / batching delay after blur

Public `onBlur` path is synchronous (no Promise / delayed read / `isTrusted` gate in cited offsets). Unlikely if blur actually fired.

### H7 — Weak: employer build ≠ public `loaded-1.js`

Always possible; would still need an alternate commit path. Do not patch React internals to “call handleChange”.

## 4. Why no product fix in this pass

User gate: implement only if a **safe narrow fix is already proven**; else document only.

- Mechanism H1 is proven on **Chrome + Xvfb**, not yet on **real Edge during an education fill**.
- AHZ `hasFocus=false` was **post-fill**; we do not yet have a during-fill Edge recording of `hasFocus` at `textAdapter` entry for major.
- Forbidden: synthetic `FocusEvent`, React-internal handler calls, relaxing DTO verify.
- A correct product change is therefore still gated on Edge confirmation + choosing a non-forbidden remediation.

**Candidate remediations (NOT applied — for later review only):**

1. **Detect, don’t spoof:** before/after `blur`, require a capturing listener saw trusted `blur` or `focusout` on the input; else `failed` / `text_blur_event_not_observed` (stops false DOM verified). Still does not fill when unfocused.
2. **Gate on `document.hasFocus()`:** if false at text write, `skipped`/`failed` with explicit reason (fill-legal visible alone is insufficient). Same: detection, not fill.
3. **Ensure document focus without FocusEvent synthesis:** e.g. extension/page path that focuses the site window/tab before text adapters (may need user-visible focus; must not touch user Edge profile or job site from this box). Then re-run existing focus→set→blur.
4. **Do not** dispatch synthetic `FocusEvent`, call fiber `handleChange`, or loosen `verifyEducationSerialization`.

## 5. Smallest next experiment (real Edge)

**Goal:** prove/disprove H1 *during* a real education `textAdapter` major write on Edge.

**Setup (user machine / parent-owned Edge session — not this box):**

1. Fresh or existing MV3 load of current patched tree (region+rank only); **no** major patch.
2. CMS education page: tab **selected**, window **visible**, but **another OS window focused** so site `document.hasFocus()===false` and `visibilityState==='visible'`.
3. Inject temporary listeners (MAIN, capture) on the major input for `focus`/`blur`/`focusout` + log `hasFocus`/`visible`/`activeElement` around one isolated `textAdapter` call (or one owned education run stopping after major).
4. Record: pre-hasFocus, events trusted?, DOM, local (if readable), parent `formData` field for major wrappers `14_51513929_0` / `14_51513929_1` (save names `…_1` / `…_2`).
5. Contrast control: same page with site window focused (`hasFocus===true`) — expect trusted blur + parent update (as prior probes).

**Pass criteria for H1 on Edge:** unfocused-visible run shows no blur/focusout, adapter DOM verified, parent stale; focused run commits parent.

**Offline re-run on this box:**

```bash
xvfb-run -a node --experimental-websocket \
  investigations/major-hasfocus/probe-xvfb-unfocused-visible.mjs
# expect achievedTarget:true, silentUnderTarget non-empty, parentCommitted:false
```

## 6. Explicit non-actions this pass

- No edits to `cms-record-controller.js` / serialization / DTO verify
- No job-site access; no user Edge profile changes
- Region + rank overlays left as previously merged; major still open

## 7. Evidence index

| Item | Path / SHA |
| --- | --- |
| Stop: major open, hasFocus hypothesis unproven on Edge | `../resume-autofill-incoming/overlays/docs/basic-driver-stop.md`, `structured-stop.md` |
| Prior Edge probes (always hasFocus true) | `../resume-autofill-incoming/overlays/cms-text-focus-events/result*.json` |
| Xvfb decisive probe script | `investigations/major-hasfocus/probe-xvfb-unfocused-visible.mjs` SHA `bb083c5d86511e7a2b5681cc3ade314b31cf83a85d52f9c83b834fdfaa1b175f` |
| Xvfb result | `…/result-xvfb-unfocused-visible.json` SHA `af0d8cba0b7b9bd9054b84011260bf08ce2d9c6b97a259dc4448d22dc6886f57` |
| Hidden-tab silent AE | `…/result-hidden-silent-ae.json` SHA `c7324af77df1c5297404d37a2496f465fe8505be72f098fe16c184a2d534ba7d` |

## 8. 2026-10-17 morning update (Asia/Shanghai)

- Installed Node LTS on Jeremy PC for tooling; probe HTML at `ResumeQuickFill-Dev\_temp-scripts\major-edge-probe\probe.html`.
- Auto Edge CDP / window-focus automation blocked by safety review; waiting on Jeremy manual probe.json from that HTML (unfocused + focused).
- **Product detection gate drafted and unit-tested (revision 5)** in `cms-record-controller.js` `textAdapter`:
  1. `document.hasFocus()===false` → `failed` / `page_unfocused` (no write)
  2. After `blur()`, require capturing listener saw `blur` or `focusout` → else `failed` / `text_blur_event_not_observed`
- Still **no** FocusEvent synthesis / React handleChange / DTO relax.
- Offline test: `tests/cms-text-blur-commit.test.mjs` PASS including new unfocused + silentBlur cases.
- Live CMS education fill on Edge still pending Jeremy availability + login.

## 9. 2026-10-17 Edge probe CONFIRMED (Asia/Shanghai)

Jeremy ran `probe.html` on real Edge:

| Case | hasFocus | blur/focusout | adapterWouldPassDom | parentCommitted |
| --- | --- | --- | --- | --- |
| unfocused | false, visible | none | true | false (stale old10chars) |
| focused | true, visible | trusted blur+focusout | true | true (NEW42) |

**H1 confirmed on Edge.** Detection gate in build `edge-internal-v0.1.4.9-20261017-001845` is justified.

## 10. 2026-10-17 live CMS page_unfocused false positive (Asia/Shanghai)

Live Edge education fill from the **action popup**: major was empty so `textAdapter` had to write; `document.hasFocus()===false` while the popup held focus → `page_unfocused`. Other fields hit `preexisting_same_value` / `existing_value` and never reached the gate.

**Fix (gate retained — no FocusEvent / React handleChange / DTO relax):**

1. Popup closes after `CMS_*_MULTI_START` is accepted (`window.close()`), so focus can return to the page.
2. Task runner focuses the CMS tab + window (`tabs.update` + `windows.update`) before dispatching RUN; brief pause then re-check; `windows.update` failure still proceeds.
3. Controller revision **6**: optional one-shot `window.focus()` then re-check `hasFocus`; if still false → `page_unfocused`. Blur/focusout listener gate unchanged.
