# CMS / hotjob-pb

Captured **2026-10-30 19:11:36.026–19:11:54.577 Asia/Shanghai**
(`2026-10-30T11:11:36.026Z`–`2026-10-30T11:11:54.577Z`).
Source: the already logged-in 招商证券 CMS resume editor on
`wecruit.hotjob.cn`, read through CDP `127.0.0.1:9239` from base
`f07879e1caa24e6f7f09bf6c59e30b7098d89b6b`. The source URL in
[manifest.json](manifest.json) omits its candidate query string.

**0 non-GET responses.** During this accepted capture window, observed,
intercepted, and blocked non-GET requests were also all 0. The existing guard
was retained and a separate request-stage guard blocked every method except
GET. No clicks, typing, dropdown/calendar opens, activation, navigation, login,
save, or submit occurred. All runtime reads used the pinned MAIN-world context
and `throwOnSideEffect=true`. Counts describe this bounded window only.

A later read-only retry encountered a background `POST /resume/info/edit`.
The guard intercepted and blocked it; **non-GET responses remained 0**. That
retry was rejected and did not replace the accepted snapshot. Its sanitized
diagnostic is [discarded-retry.json](discarded-retry.json). Further work used
only the local files.

| File | Contents |
| --- | --- |
| `outerHTML.html` | Captured `document.documentElement.outerHTML`, sanitized and made inert for offline use |
| `index.html` | Same sanitized DOM, with stylesheet references rewritten to local assets |
| `infoItemList.json` | 93 template items across 15 sections, read from committed React `resumeTpl[].infoItemList`; schema keys only |
| `controls.json` | 63 keyed rendered fields, labels, kinds, required metadata, and available option definitions |
| `dictionaries.json` | 28 referenced dictionaries read from current MAIN-world component props |
| `assets.json`, `assets/` | 12 assets obtained by HTTPS GET, including 2 CSS and 2 JS bundles plus CSS dependencies; 0 missing |
| `manifest.json` | Capture window, traffic counters, safety flags, provenance, and transformations |
| `offline-verification.json` | Playwright replay evidence for both HTML entry points |

The DOM contains 71 `.ant-form-item` rows: 63 keyed fields plus 8 unlabeled
section action rows. The 15-section template also describes fields that are
not currently rendered. `required` is derived from `isNeed === 0`, following
the production bundle's `required: !isNeed` rule. Option provenance distinguishes
committed React option elements, rendered radio/checkbox labels, and template
dictionaries. A dictionary is not evidence that a dropdown was opened or that
all dependent/lazy options were loaded. No calendar panel was opened; date
controls provide trigger structure only.

Personal names, phone numbers, email addresses, identity numbers, and resume
identifiers were removed before the capture files were written. All input and
textarea values, selected labels/state indicators, candidate photos, attachment
URLs, inline script bodies, event handlers, form actions, and outbound links
are cleared. Full component state, cookies, storage, credentials, request bodies,
and raw network URLs/headers were never saved. An additional local sanitation
pass is timestamped in the manifest. Binary assets are public static fonts and
images obtained without browser credentials.

CSS imports and resource URLs point to local files. Downloaded JS is archived
but never executed; inline scripts are empty and typed `application/x-zoo-inert`.
Both HTML files include a restrictive CSP. This preserves rendered DOM/CSS for
offline inspection without hydration or backend calls. Asset byte counts and
SHA-256 hashes describe the final sanitized files; they are checked during
replay. This is a frozen structural fixture, not a working live application.

Verify from the repository root with `npm run test:zoo`. Replay checks the
captured field IDs/labels, local resource loading, CSS effects, asset integrity,
and zero external/non-GET traffic. `neverSave=true`, `liveSupportClaimed=false`,
`livePassClaimed=false`; no commercial score or live support claim is added.
