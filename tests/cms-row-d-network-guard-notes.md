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
adds the same three files. SOURCE_INVENTORY is untouched: its base133 rows already
contain26 stale hashes after prior source changes, so a broad regeneration would
silently mix unrelated metadata edits. Exact Git/raw/build manifests remain the
verification source for this candidate.

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
retentionRequested is only intent. No tab/URL check is presented as documentId
binding: currentDocumentEvidenceVerified is always false. Same-URL reload or an
arm-time document race is not proven by tabs.onUpdated.

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
documentId/instance provenance, allowed native action binding and coverage.

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
