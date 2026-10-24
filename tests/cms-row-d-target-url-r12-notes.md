# CMS row D full target URL binding — R12

Base: actual merged `eee0ad1414878ccb1d72e746d04daa55c392aaf5`.
This changes the independent location structure tool, its offline tests and notes.
There are no product, adapter, engine, permission or field support changes.

## Preserved evidence and scope

The parent's single R11 run reported `capture_gate / wrong_page` while the
official inspection completed with 13/16 fields and clean final guards. That
fixed refusal does not reveal the active URL or which component differed. The
old R10 stop has no recoverable cause and remains unknown. Neither saved result
is modified or retrospectively promoted.

The original target selector permits the fixed CMS origin/path with a full
query/fragment. The added diagnostic previously compared href with a static
base URL. R12 binds its exact comparison to the full URL selected from the
same discovery result. It never strips, appends, reparses or canonicalizes that
URL to make a match succeed.

## Same-discovery provenance

The tool wraps the runner's existing, single `getTargets` dependency. Its
arguments, timeout options and errors pass through. It reuses the exported
`selectRowDTarget`, including the existing origin/path, credential, ambiguity,
target ID and loopback socket checks. A failed selection returns the original
inventory unchanged so the runner retains its original failure reason.

After a successful selection, only the freshly parsed ordinary JSON array and
its ordinary top-level records are frozen. Every entry, field and ordering is
retained. There is no recursive freeze; nested metadata remains untouched.
Accessors, proxies, custom prototypes and non-record object entries fail closed
before any record is frozen. No target is filtered, reordered or substituted.

The chosen raw full URL, target ID and socket remain inside this invocation's
Node closure. The decorated connection must use exactly that socket. There is
no caller/CLI `expectedURL`, rediscovery, alternative target, new network call,
navigation or retry. The existing exported expression builder takes an explicit
string for internal serialization and synthetic tests; `runLocationStructure`
obtains it exclusively from the captured target, without a base-URL fallback.

## Evaluation and privacy

The expression is constructed immediately before the runner's one
`Runtime.evaluate`, after the original strict contract is verified. It retains
`throwOnSideEffect:true`, `awaitPromise:false`, `userGesture:false` and the
original timeout. The original inspector runs first and its returned inspection
is handed unchanged to the original cleaning logic. Protocol errors, strict
exceptions and invalid envelopes retain their original failure semantics.

The diagnostic checks `location.href === expectedFullUrl` before any structural
queries and again immediately before successful return. A mismatch returns only
the existing `wrong_page` refusal and discards all partial rows. Besides that
second href read, its structural selectors, reads, bounds and output schema are
unchanged. The four shared dependencies, success validator, final capture gate,
R11 closed stop-cause classifier and CLI output/IO contract stay byte identical.

The full URL exists only in Node memory and the same CDP expression sent to the
already selected target. It is absent from stdout, pins, official evidence,
structure JSON and errors. No URL hash is emitted either. Synthetic sentinels
exercise success, refusal and unsafe official paths. This does not expose a
profile or fact-reading interface.

Two exact href checks bind observations to that target's current full URL; they
do not prove document identity across a same-URL reload or an unobserved ABA
navigation. A later `wrong_page` is only that invocation's refusal. R10's
historical cause and R11's concrete differing URL remain unknown.

## Offline validation

Node 24.20.0: **40 new own-memory tests passed, 0 failed, 0 skipped**.
These fixtures cover exact full URL binding, changed
query/fragment/order/encoding, raw URL non-normalization, end-of-read drift,
immutable same-inventory selection, nonrecursive ordinary-record freezing,
unchanged selection failures, discovery errors, ignored external URL overrides,
serialized original verdict equality, strict/protocol/final-guard rejection and
no URL sentinel in any output. The initial cross-realm object comparison in one
test was corrected to compare the serialized official result, its actual
evidence contract; no product change was needed.

The existing native strict test now serves an owned synthetic query-bearing URL
entirely through local Fetch fulfillment in an exclusively owned temporary
Chrome profile. No original/user browser or real-site network is involved. Its
deliberate mutation must still be rejected; no loose evaluation fallback exists.

The fixed candidate's narrow run includes the previous seven files plus the
new URL-binding file:

```text
node --test tests/cms-row-d-location-structure.test.mjs tests/cms-row-d-options.test.mjs tests/cms-row-d-probe-expression.test.mjs tests/cms-row-d-debug-evaluate.test.mjs tests/cms-row-d-live.test.mjs tests/cms-row-d-live-cdp.test.mjs tests/cms-row-d-structure-stop-diagnostics.test.mjs tests/cms-row-d-target-url-binding.test.mjs
```

The fixed-commit pin/log/source proof are external offline evidence. The R11
protected-source test is narrowed only for the two explicitly authorized R12
changes (href continuity read and expected URL expression); the new test proves
the rest of the DOM function is unchanged and independently preserves R11's
classifier/schema/guard/CLI and all four shared dependencies.

No actual site/browser/CDP, facts, R9 trial, save or score change is performed by
this implementation task. Captured structure still cannot establish geographic
semantics, complete dictionaries or calendar behavior. Book remains 53; row D
is unbooked, both locations and calendar remain unsupported by this evidence.
