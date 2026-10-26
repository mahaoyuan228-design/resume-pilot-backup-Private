# CMS D extension network guard — not deployed / not a D PASS

Base actual a13c353072487a8eb265dedcfcbb0ea3b76b1878. This change adds a real
Chrome extension API route for gap2, not another simulated guard model. It does
not close a live gap. Native cancellation remains unavailable; no selector or
Escape behavior is invented. Interaction, fill, live support and booking remain
false/53. No browser, endpoint, site field, profile or extension storage is used
by the offline tests; their Chrome API stubs prove call ordering/contract only.

The production path is normal popup link -> cms-row-d-guard.html -> runtime
message -> worker boot -> createCmsDNetworkGuard -> Chrome DNR session APIs.
Only that same-extension popup URL with no sender tab may call the exact two-key
message. No caller URL/tab/profile/coverage/native-recovery flag is accepted.
The worker obtains the current active CMS tab itself, binds its exact full URL
in memory, checks it after awaits, and never prints or stores it. No profile key
is read. No debugger/CDP, network proxy, alternate surface or new host permission
is introduced. The original readonly runner/strict evaluator/guard is unchanged.

Required NEW manifest permissions are declarativeNetRequest and
 declarativeNetRequestFeedback. Plain DNR is deliberate: its block rules have
implicit host access; WithHostAccess would limit unknown cross-origin requests
to the existing host grants. This is a permission expansion that must be
explained and approved at actual installation/update time. Nothing here alters
the installed old133 package or its permissions. New runtime product count136
requires a newly built complete package and new identity evidence; version
0.1.4.9 alone is not identity. Internal-builder change is only its three-file
allowlist; hash logic and original Utility bootstrap are unchanged. WHITELIST
adds the same three files. The merged5631 inventory has136 frozen-product rows
(the prior metadata correction added only the three new paths); its28 historical
stale rows remain. This document-binding change does not regenerate inventory
hashes; changing the guard module and UI projection adds two stale rows. Exact
Git/raw/build manifests, not this historical inventory, establish source identity.

Rules are single-tab SESSION rules, never dynamic/global rules: all nonGET
network-stack requests including main_frame (explicit empty exclusion list),
new WebSocket/WebTransport requests, and every method to the exact known CMS
info/edit endpoint. Install must ACK and getSessionRules must return the full
exact rule set, with no conflicting dynamic/static rules. Unknown ACK/timeouts
or rule/target changes stop and never automatically remove rules. The command
budget is3s; timeout is not cancellation: its outstanding promise remains in the
pending set, prevents a second mutation, and a late ACK cannot make the result
clean. The60s lease never renews and never automatically removes browser rules.
protectionState reports unknown when no active protection can be proved;
retentionRequested is only intent. In merged5631, tab/URL checks did not prove
document identity and currentDocumentEvidenceVerified was always false. The
document-binding change below replaces that limitation with bounded actual
Chrome InjectionResult.documentId observations, without granting interaction.

Actual network evidence is only Chrome onRuleMatchedDebug or getMatchedRules,
not testMatchOutcome, a locally generated request, a rule-install ACK or UI
'auto-save succeeded'. Feedback is for unpacked extensions and subject to Chrome
API permission/quota/history limits. Debug journal/dedup/history are capped128;
manual history refresh is at least31s apart. Export includes only fixed enums,
counts and local observation timestamps, no IDs/URL/query/body/header/profile or
selected values. Debug and history counts are separate, never summed as though
independent requests. Worker restart defaults STOP/orphaned, reads exact owned
session rules, may retrieve rule-history counts, but cannot resume a document,
action lease or live claim. Historical/orphan evidence is not current-document
proof. Browser restart/extension update clears session rules; reinstalling is
not protection continuity.

This network-only entry performs no native action. It cannot prove coverage of
requests sent before arm, already-established channels, no-tab worker traffic or
arbitrary GET side effects. All corresponding coverage fields stay false and
interactionAllowed remains false. The pending next source/real gates are actual
actual installed-instance provenance, allowed native action binding and coverage.
The documentId source implementation still requires its own real-browser proof.

There is no automatic tab close, navigation, rule rollback, value restoration
or native cancel. remove_closed only disposes exact owned rules AFTER this
worker receives the real browser tabs.onRemoved event for the bound tab and all
commands settle; it does not call tabs.remove. A live tab cannot self-certify
cancel/restoration or request disposal. An orphan with no observed close event
stays stopped. This cleanup is not native cancellation or D restoration proof.
Root must approve the real deployment/cleanup procedure before any execution.

Offline validation: direct production API implementation with supplied Chrome
API contract stubs, no request-matching engine or browser. First27-case log is
preserved; fake match notifications do NOT constitute captured site requests.
The production manifest/background wiring is shared runtime code: authoritative
full tests+import, independent crossworld and package/import closure checks are
required before deployment, in fresh LF checkout with the existing documented
EXAMPLE/TLS isolation. Narrow guard tests alone are not that gate. No build or
full suite is claimed in this first source-review candidate.

Official references (source review only):
https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest
https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle


## Document binding, actual5631 base (offline candidate)

The existing scripting/host permissions are sufficient. No permission, worker
boot, product allowlist, builder, engine, field adapter or native action changes.
The real production route uses chrome.scripting.executeScript with frameIds:[0],
world:ISOLATED and injectImmediately:true. Its serialized function only compares
window/top and exact full location.href against the worker's internally bound
URL. It returns two booleans. Chrome's InjectionResult.frameId/documentId, not a
page-supplied/caller profile or returned fake ID, provides the document identity.
Missing/multiple/non-top/invalid metadata or inaccessible scripting stops. No
URL-only or older-browser fallback exists. The raw full URL/documentId stays in
memory and is never added to popup evidence, errors, storage, pins or journals.
The module does not read document text, values, selections or profile data.

After initial top-frame capture, each normal rule read/install and history query
is bracketed by new top-frame probes. Status, cached evidence and repeated arm
also recheck the document. A different documentId under the same URL stops with
rules untouched; no lease renewal, automatic rebind or removal occurs. Probe
failure/timeout/late completion preserves unknown outcome and pending semantics.
Worker restart remains orphan/STOP; it cannot reacquire action authority. Closed-
tab disposal and terminal/orphan history retrieval cannot claim a current doc.

currentDocumentEvidenceVerified means only the successful last bounded probe,
with documentIdentityScope=last_top_frame_probe_only. It is false while a command
is pending or after any terminal latch. It does not establish continuous identity
between samples, eliminate same-document/BFCache ABA, prove the final response's
instantaneous page state, or prove the installed source SHA. Complete external
Git/raw/package delivery remains the source-version authority. All existing
coverage gaps and native-cancel unavailability remain; interactionAllowed=false,
gap2/gap3 are not closed, no real-site PASS or booking is claimed.

Offline tests execute the same serialized read-only function against synthetic
window/location objects and supply Chrome API-shaped results, exercising actual
production API call ordering, same-URL replacement at awaits, invalid metadata,
pending timeouts/late results, cached history, restart and redacted UI projection.
They do not call a browser, endpoint, profile, website control or real DNR API.
Existing full/build gates must be separately selected and run for the fixed
candidate; the predecessor's real-browser document evidence is not inferred.

Official API source (read during implementation):
https://developer.chrome.com/docs/extensions/reference/api/scripting
InjectionResult.documentId and InjectionTarget.documentIds are Chrome106+;
frameId is Chrome90+, ISOLATED world Chrome95+, injectImmediately Chrome102+.
Only top frameIds:[0] is used here; no arbitrary documentIds/caller target input.


## Partial runtime identity, actualaaab base (offline candidate)

Base aaabdb39418b64e3f0723b8cd465ead98adf0239. The dedicated guard page has
an explicit identity button using the existing exact two-key runtime bridge.
No new permissions, dependency, worker boot, main popup, engine, rule definition,
builder, field action or package-file count changes. The handler/page themselves
read no profile, storage, resume field or website resource and never arm rules.
They do not open another page, discover a port, or bypass a refused UI surface.

The response supplies actual runtime.id, allowlisted getManifest metadata and
manifest-declared guard-permission booleans, the exact sender's same-extension
guard-page relationship, and the unique active CMS tab ID with allowed-page and
full-URL-equality booleans. The full URL/query and documentId remain in memory.
An armed guard is checked before and after resource reads, with the final
document probe after the final independent tab read. A terminal/orphan guard
cannot obtain a new identity receipt or regain authority. An unarmed receipt
claims only sampled tab/URL metadata, not a verified document or session.

Exactly five fixed own resources are fetched through runtime.getURL:
manifest.json, src/background/worker.mjs,
src/background/cms-row-d-network-guard.mjs,
src/popup/cms-row-d-guard.html and src/popup/cms-row-d-guard.js.
Fetch rejects redirects and uses no-store/omit credentials. The exact returned
extension URL, status, streamed byte caps (262144 each / 524288 total), command
timeout and operation budget are checked. WebCrypto hashes the raw bytes, not
decoded or normalized text. Failure emits only a fixed enum and discards all
partial rows. No requested path, tab, URL, expected hash or coverage input is
accepted. The UI uses a bounded explicit projection of the receipt.

This is PARTIAL current-resource-response evidence for external comparison.
It does not establish already-loaded module bytes, all136 package files, Git
source SHA, absolute installation path, debugger target, controlled session or
same-instance provenance. Fetching a current resource cannot prove an existing
worker loaded those bytes. No sameInstanceVerified or self-certified source SHA
is returned. Version0.1.4.9 alone is insufficient. The external verified package
manifest supplies expected hashes; the response must be compared independently.
All coverage/native-cancel flags and interactionAllowed remain false. Nothing
here closes a live gap, installs a package, proves a D field write, or changes53.

Entry privacy limitation: the existing ordinary popup starts RESUME_INSPECT
(popup.js:2399-2400), and its normal CMS send path loads the profile (:965).
Those pre-existing paths are unchanged. The no-profile statement above applies
to this handler and dedicated guard page, not to opening the whole old popup or
all transitive worker imports. Future execution must use a permitted normal UI;
no internal-URL/raw-CDP/loopback or alternate-surface workaround is authorized.

Offline tests use Chrome API-shaped stubs, real Response streams/WebCrypto and
JSDOM normal button events. Independent node:crypto hashes check raw bytes with
NUL/BOM/CRLF sentinels. Tests cover caller overrides, worker/resource identity,
caps/redirects/errors, full-URL/document/runtime drift, pending timeout and UI
claim rejection. The final-tab-read race has a separate negative: change the
same-URL document in the last tabs.get and require the subsequent actual probe
to discard the receipt. These are not real Chrome/DNR/installed-instance tests.
The first60-case result remains separately preserved; final fixed-source
validation is reported outside this historical note. Three runtime files change
within the existing136 set; the other133 remain raw-identical to actualaaab.
SOURCE_INVENTORY is deliberately not regenerated and is not MATCH authority;
Git raw/OID and newly built package manifests supply that proof.

Official primary sources consulted for this implementation:
https://developer.chrome.com/docs/extensions/reference/api/runtime
https://developer.chrome.com/docs/extensions/develop/concepts/network-requests
