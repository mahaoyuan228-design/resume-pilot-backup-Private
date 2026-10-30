# Generic upload and attachment controls

Base: `34f46c7d951129a60224671271197498c2d22e3d` (#231). This slice adds a first-party, read-only control engine in `src/content/controls/upload.js`. It uses control structure and ownership rather than site names, field labels or LLM field identification. UL is a phenomenon reference only; no site implementation or site-specific selector is incorporated. `liveSupportClaimed=false`.

## Detect contract

`ResumeUploadControls` exposes `version: 1`, `inspect(element)`, `preview(element)`, `discover(root = document)` and `plan(element, { action })`. Results are serializable observations with `writeStarted:false` and `liveSupportClaimed:false`. Nothing is persisted.

Native `input[type=file]` elements are identifiable even when hidden behind an upload surface. A bounded generic upload/drop-zone/attachment container with one owned file input can be reported as input-backed. Multiple inputs in a shared container are ambiguous. Class or data-attribute hints without proven input ownership remain manual. Plain text mentioning an upload is not sufficient evidence. Discovery deduplicates owned roots and does not cross frames or shadow trees.

Inspection reports the control kind, ownership, number of file inputs, selected-file metadata, existing preview metadata and counts of preview, clear, skip and later affordances. Selected-file metadata contains name, type and size; it does not read file contents. Preview metadata contains image/link/text kinds and bounded labels, without copying URLs or data contents. These observations do not establish backend acceptance or permission to act.

Detached, foreign-document or shadow-root targets, ambiguous or unconfirmed ownership, disabled controls and busy surfaces stay manual. Generic upload surfaces take priority over ordinary input adapters, so an upload's inner text display cannot become an automatic text target. Unrelated native fields remain eligible for their existing adapters.

## Preview, clear and skip contracts

Every upload plan remains `status: manual` with `skip:true`, `writeStarted:false` and `liveSupportClaimed:false`. `skip` describes the engine's policy; it does not mean that the page's skip button was clicked.

| Requested action | Plan reason | Meaning |
| --- | --- | --- |
| Absent or `upload` | `upload_manual` | Actual file selection and upload require manual handling. |
| `preview` | `attachment_preview_readonly` | Report already-rendered preview metadata only. |
| `clear` | `attachment_clear_manual` | Report observed removal/reset affordances; preserve attachments. |
| `skip` | `upload_skipped`, disposition `skipped` | Explicit engine skip without a page action. |
| `later` | `upload_deferred`, disposition `deferred` | Explicit engine deferral without a page action. |
| Unknown action | `attachment_action_unknown` | Manual outcome. |

Ownership and availability failures take precedence over requested actions. An unknown or disabled surface cannot be reported as successfully skipped or deferred. `preview()` observes the existing rendered state; it never opens a file, follows a link, generates a thumbnail or activates a preview dialog. Clear/remove controls, navigational links, implicit-submit buttons, and skip/later buttons are counted as observations only and are never clicked.

## Integration and Never-Save boundary

The module is part of the packaged `CONTROL_FILES` inventory shared by L1 diagnostics and the opt-in control bridge. The existing native `upload` entry retains its default `manual / upload_manual` result and delegates richer observations when the module is present. The new upload-surface adapter prevents ordinary writers from claiming attachment surfaces.

The production opt-in candidate collector continues to exclude file inputs. No upload writer is added. No code in this engine assigns `files`, creates `File` or `DataTransfer` objects, reads file bytes, emits input/change/drag/drop events, invokes application handlers, clicks controls, saves or submits. Preview, clear, skip and later are read-only contracts. Existing Never-Save guards, `throwOnSideEffect`, host permissions and visibility policy are unchanged.

## Offline evidence

`tests/l1-upload-controls.test.mjs` exercises the API and registry outcomes on disposable DOM fixtures. `tests/zoo/upload.spec.mjs` uses synthetic upload pages on loopback and the exact packaged module bytes in separate browser worlds. Fixtures contain no customer data, file selection or live upload. Tests require unchanged attachment and neighboring state, zero interaction attempts, and the existing network guard's zero non-GET and forbidden-click evidence.

Run the related checks after building the internal extension:

```powershell
node --test tests/l1-upload-controls.test.mjs tests/l1-native-controls.test.mjs tests/l1-registry.test.mjs tests/l1-shadow-bridge.test.mjs tests/l1-write-route.test.mjs tests/product-paths-whitelist.test.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-internal.ps1
npm run test:zoo
```

Green offline fixtures establish detection and inert planning behavior only. They do not establish live ATS support, a successful upload, a successful save, or a change to commercial records.
