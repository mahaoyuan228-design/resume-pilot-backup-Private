# Generic HAR recording and offline replay

The HAR scaffold captures a first-party control fixture with Playwright `recordHar`, then replays the captured HTML and generic control modules with `routeFromHAR({ update: false, notFound: 'abort' })`. Replay starts a fresh browser context with offline mode enabled and no fixture server. `liveSupportClaimed=false` throughout.

This is a control-type engineering fixture. It adds no tenant routing, resume-field mapping, LLM identification or production adapter changes. Native controls run the captured source modules directly in the page; this does not establish extension packaging, isolated-world bridging or live ATS compatibility. Existing Never-Save guards and `throwOnSideEffect` remain unchanged. No real saving or submitting is part of recording or replay.

## Record and replay

From the repository root, use Node 24 and the pinned Playwright dependencies:

```powershell
npm ci
npx playwright install chromium
node scripts/zoo-har.mjs record --har dist/zoo-runs/har/example.har
node scripts/zoo-har.mjs replay --har dist/zoo-runs/har/example.har
```

The npm equivalents are:

```powershell
npm run zoo:har -- record --har dist/zoo-runs/har/example.har
npm run zoo:har -- replay --har dist/zoo-runs/har/example.har
```

Recording starts a disposable HTTP server on `127.0.0.1` with an ephemeral port. Its explicit asset map serves the synthetic HTML fixture and exact checkout bytes of the generic model, registry, upload, native and date-control modules. The context permits only GET requests to that origin. Closing the context flushes a standalone HAR with `mode: 'minimal'` and `content: 'embed'`; the command then closes the server. An existing output path is refused. Choose a new path to make another recording.

Replay reads the successful HTML entry's original URL, including its captured port. Do not replace that URL with a new server address: HAR matching depends on the recorded URL. The command starts no HTTP server, loads every resource from the archive and checks generic control plans and the default-off writer gate without editing control values. Its output includes the archive SHA-256, traffic evidence and `liveSupportClaimed: false`. Replay must leave the HAR bytes unchanged.

Generated HAR files belong under ignored `dist/zoo-runs/` or Playwright's ignored output directory. No hand-written HAR fixture is needed. After a fixture or control-module change, record to a new path explicitly; an older archive intentionally continues to replay its captured bytes.

## Run the zoo checks

```powershell
npm run test:zoo -- har.spec.mjs
```

These three checks need Chromium and the Node dependencies, but no extension build. They record actual local HTTP responses, close the recording context, stop the server and replay in a separate offline context. Checks cover unchanged controls and neighboring values, generic native planning and the default-off writer gate, absent-resource and missing-archive failure, blocked non-GET and second-origin recording requests, and an unchanged archive. The full `npm run test:zoo` suite also includes existing extension checks and requires the internal build described in [the zoo README](../tests/zoo/README.md).

## Reuse the scaffold

`tests/zoo/har-support.mjs` exports:

| API | Purpose |
| --- | --- |
| `startHarFixture()` | Start the explicit synthetic asset server; returns `url`, `origin`, `traffic` and an async `close()`. |
| `openHarContext(browser, { mode: 'record', harPath, origin })` | Create a recorder for one explicit `http://127.0.0.1:<port>` origin. |
| `openHarContext(browser, { mode: 'replay', harPath })` | Create a read-only HAR router with offline mode enabled. |
| `readHar(harPath)` | Read an embedded HAR and find its successful HTML entry URL. |

The context wrapper returns `context`, `traffic` and an async `close()`. Always await the recording wrapper's `close()` before reading or replaying its output. Close contexts before closing the browser, and close the fixture server even when a scenario fails. New scenarios should use synthetic controls, explicit assets and passive detection/planning/readback assertions.

Replay installs the HAR route first and the request-method guard last. Playwright invokes matching routes in reverse registration order, so allowed GETs use `route.fallback()` to reach the HAR router. Replacing that call with `route.continue()` bypasses HAR routing. Keep `update: false`, `notFound: 'abort'` and offline mode enabled; missing requests must never fall through to a server.

Both modes block service workers and close WebSocket attempts without connecting upstream. HAR is an HTTP archive, not a replay of service-worker caches, WebSocket streams, application persistence or authenticated sessions. The helper's traffic counters describe its own routing; they do not replace existing production safety evidence. No site-specific behavior or commercial support claim follows from a green fixture.

Use synthetic data only. Minimal HAR mode still stores URLs, headers and embedded response bodies, which can contain sensitive data in other contexts. This scaffold provides no production recording or authentication workflow; keep credentials and customer content out of archives and source control.

Playwright documents the capture options under [Browser.newContext recordHar](https://playwright.dev/docs/api/class-browser#browser-new-context-option-record-har) and the replay behavior under [BrowserContext.routeFromHAR](https://playwright.dev/docs/api/class-browsercontext#browser-context-route-from-har).
