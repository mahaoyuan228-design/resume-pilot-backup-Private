# CITICS local fixture assets E2

The five synthetic CITICS happy fixtures previously fetched three public UNPKG resources. They now request the same package versions and exact file bytes from the fixture server's loopback origin. This removes a known public-network variable from these tests. It does not establish why either earlier E1 postmerge matrix timed out or claim that their specific root cause was fixed.

Only package.json/package-lock.json, the test harness, fifteen resource URLs in five happy HTML fixtures, this note, and one new contract test change. No product source, writer, selector, build/permission allowlist, paid/education code, original test assertion, skip or timeout changes. The original browser-launch helper, 20-second load gate, four-case ordering, evaluate/inject/fill/restore helpers and assertions remain unchanged. New test exports expose existing helpers to the offline contract without changing their bodies.

## Package and file provenance

Both direct dev dependencies are exact versions: vue 2.7.16 and ant-design-vue 1.7.8. The original 40 lock entries remain present; all 39 non-root objects are unchanged, and the root's existing dependencies and dev dependency remain unchanged. Sixty necessary entries are added, including the actual vue-template-compiler 2.7.16 peer paired with Vue 2.7.16. No force/legacy-peer mode or unrelated dependency upgrade is used.

Official metadata: [Vue 2.7.16](https://registry.npmjs.org/vue/2.7.16), [Ant Design Vue 1.7.8](https://registry.npmjs.org/ant-design-vue/1.7.8). The registry is explicitly https://registry.npmjs.org. Lock tuples match the official version, tarball URL and SHA-512 integrity. An additional, read-only check derived only the two exact npm content-cache paths from those known integrity values; whole tarball bytes independently match their official SHA-512 values (Vue 1,179,179 bytes; Ant 8,588,504 bytes). No cache scanning, browser-cache access or extra download was used for that check.

The original installation command is recorded as reported actual tool-invocation evidence, not a separately timestamp-pinned or independently audited installation runner. It was `npm install --save-dev --save-exact --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org vue@2.7.16 ant-design-vue@1.7.8`, exit 0. Final fixed-head validation must separately pin its fresh-checkout npm-ci command and runner.

UNPKG [documents package-version/file URLs and its metadata API](https://unpkg.com/#metadata-api). The exact [Vue file metadata](https://unpkg.com/vue@2.7.16/dist/?meta) and [Ant file metadata](https://unpkg.com/ant-design-vue@1.7.8/dist/?meta) supply these byte lengths and SHA-256 SRI values, matched against the installed file bodies:

| Package file | Bytes | SHA-256 SRI |
| --- | ---: | --- |
| vue/dist/vue.js | 434871 | sha256-NrENO0kgWSpOwmwGTEKemj37RokjX9/JHhc2toHHZ4Y= |
| ant-design-vue/dist/antd.min.js | 1478243 | sha256-sNYD2f64gxJnB1zDymg4tebiJiE9cu1dcCFZu12i/+8= |
| ant-design-vue/dist/antd.min.css | 468534 | sha256-qmgRsNEN3Vze7Yad4+kDnTdst3Cmpy9BnaWWo72E9Rc= |

The full Vue compiler build is deliberate; the package's runtime-only main is not substituted. The minified Ant files are served unchanged. Registry metadata declares MIT for both packages; their package LICENSE files and all installed package/third-party notices remain intact. This is not a claim that all bundled third-party licensing has been independently audited. Assets stay in ignored node_modules; no vendor files are copied into product source.

## Fail-closed local serving and network contract

Fixture-server startup validates installed package/compiler versions, official lock tuples, and all three file sizes/SRI before opening the server or reaching the existing Chrome launch. Missing, changed or wrong-version files fail; there is no CDN fallback. Only three fixed raw request targets serve assets, using GET/HEAD, JavaScript/CSS MIME types and their verified in-memory bytes. Query variants, encoded aliases, traversal and arbitrary proxy targets cannot obtain assets; unsupported asset methods are refused. Existing fixture handling remains after this isolated route block.

The native contract launches a fresh, exclusively owned Chrome profile, authenticates its DevToolsActivePort/browser UUID and exact page-target socket, and installs request-stage Fetch interception before the first navigation. It permits only the fixed loopback fixture/asset paths, the existing local favicon request, and image data URLs. The first other request is aborted and makes the guard permanently fail; later allowed requests cannot erase that failure. No user browser, real site, extension, profile facts or stored salary is accessed.

All five real Vue/Ant components must report the exact runtime versions and render an actual Ant select. The contract calls the original injected writer for all twenty happy/negative cases, verifies restoration and no commit clicks, and retains the original five test files unchanged. Static CSS inspection finds no @import and one data URL. JavaScript documentation URLs, XML namespaces and optional resource-related code are not themselves evidence of a network request; the native request guard checks the exercised fixture behavior. Any newly attempted external subresource must stop validation, rather than acquire a new exception.

## Focused evidence and remaining gates

New contract: 25 tests passed, zero failures/skips. Original five select files: 15 tests passed, zero failures/skips. The first exploratory contract run had 24/25 passes because its new test-only DNS rule failed to exclude 127.0.0.1; the local navigation returned ERR_NAME_NOT_RESOLVED. Adding that loopback exclusion made the new contract pass. Original harness timeouts, launch flags, assertions and components were not changed. Both exploratory and final logs are preserved.

The main worktree's five older generated files were backed up by exact bytes before the original select tests. Only the two known latest synthetic outputs were restored from verified original backups; their newly produced evidence remains separately archived. The other three generated files and all 177 protected source/build/allowlist files remain unchanged and are excluded from the commit. The earlier R1/R2/diagnostic clone evidence remains preserved.

Full final-SHA tests/import, independent cross-world and internal/paid-candidate/paid-smoke validation follow in a fresh LF checkout with npm-ci ignore-scripts, disposable EXAMPLE signing and DEV-only localhost TLS. Results belong in external pinned logs/proofs; this note does not claim those later gates have passed. Explicit product pack allowlists must keep all test scripts/fixtures, package metadata, node_modules and these dev assets outside every extension pack; product bytes must remain equal to the actual E1 base.

E1 R1 and R2 each remain recorded as 3498 tests, 3496 passed, one failed and one existing skip. The single political narrow run and two-label diagnostic batch do not replace those failures or establish their cause. This test-maintenance change grants no live support, save, acceptance, score or booking; booked remains 53.
