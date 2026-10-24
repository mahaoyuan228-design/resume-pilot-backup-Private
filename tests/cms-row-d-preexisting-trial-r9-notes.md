# CMS row D preexisting trial core (R9)

The general `RESUME_FILL` calls `ensureRepeatRows` before collecting the whole
form. Filtering its report cannot make it a narrow trial. R9 adds a separate
`CMS_ROW_D_PREEXISTING_TRIAL` route that verifies preservation of one already
equal field. It never enters `fillOwnedContent`, repeat creation, a writer,
photos, attachments, validation-gap or uncollected-question tail processing.
Default `RESUME_FILL` and its boolean binding API retain their existing paths.

This is an offline core capability. No real profile or current website values
were obtained. Browser policy denied an extension URL; all alternative internal
page, inert resource, bridge, loopback and profile-copy/data-file routes to those
facts were stopped. The new product-internal branch was exercised only against
in-memory synthetic storage and jsdom. It is not an approval to use another
interface to obtain the blocked facts. Actual facts await a user-provided or
otherwise compliant entry. No runtime collector/CLI/browser action is added.

## Hard contract

- Exact full URL is the fixed baseline CMS `resumeOperation.html`; query/hash,
  another tenant, frame, sender or current tab URL is rejected.
- One target per call. The closed table contains `expectedWorkNature` at
  `13_43_0` / `cms_ant_v3_select` / `customAnswers.期望工作性质`, and
  `researchInterests` at `13_102501_0` / `cms_checkbox_group` / the fixed research
  question's `customAnswers` path, both in section `13`.
- Caller keys are exactly `type`, `target`, `profileBinding`. External profile,
  answer, facts, attachment, photo, selector, scope or mode overrides are refused
  before target DOM reads. Locations/calendar and every other field stay outside
  the table; this does not change the existing 13/16 preflight.
- The existing installed profile-binding bridge gains a product-internal message
  restricted to the same extension's top-frame tab sender on this exact CMS URL.
  Extension documents cannot request it. It reads only the existing
  `resumeProfile` / `resumeProfileLifecycle` keys and returns one target projection
  over internal extension IPC. It never returns a full profile or writes storage.
- Both keys must be owned, profile schema1 valid, lifecycle READY/nonlegacy with
  the real validEpoch syntax. Capture/assert plus raw canonical profile hash bind
  the projection to the actual stored profile before/after; a valid binding with
  an unrelated fixture payload is not accepted. Actual tab URL is checked again
  after async profile work and immediately before the response.
- Duplicate equivalent single-select questions are rejected before projection
  under the same NFKC + matcher punctuation/required-marker semantics used by
  `confirmedCustomAnswer`. Projection cannot discard a competing fact and then
  make it appear unique. Research retains its existing narrower clean semantics.

## Reused product paths and zero-write boundary

`collect` accepts an optional fixed trial root. Normal calls retain document
collection. Trial scope is resolved before classification/current-value reads;
initial and final collections use the same root and identity. Existing
`cmsAntV3Answer`, `ResumeCmsCheckboxes.resolveFact` and `answerMatches` perform
the actual classification, confirmed fact resolution and equality comparison.
No separate synthetic equality checker is used for the verdict.

Only outer structural duplicate IDs, shell headings and static question labels
may be examined for the existing parser's ownership checks. Editable ancestry
(including plaintext-only/empty and outer true past an inner false), editable
descendants and designMode reject before those text reads. Other current values
are never collected. Scoped input/owner/kind/count checks reject peers, wrong
controls, disabled inputs and changed static research dictionaries. The public
32 labels use the R7 provenance; a desired fact is its complete explicit intended
nonempty subset, not a requirement to select all32.

`preexistingOnly` is a hard route property. Empty, unequal, subset, extra-member,
partial or unsupported controls fail; no fallback reaches an adapter. The route
shares the synchronous pending lock with normal fill, retains it until its own
promise settles, and uses the real binding check. Its write context throws on
`check(true)`. Passive event capture starts before its first await; click/input/
change/focus/blur/submit or scope mutation interrupts. Final classification,
facts, binding, nodes, page and equality must still agree. Only its own context,
observer and listeners are removed in cleanup; timeout is not cancellation.

The engine revision is9 so an owned old7/8 listener is replaced when idle. A
pending old task prevents replacement and keeps its lock. R9 reinjection reuses
the actual live listener and pending state.

Results contain only target/status/fixed reason and safety booleans; no profile,
answer, currentValue, URL, title, hash or lifecycle IDs. A verified result means
`preexisting_same_value`, `adapterWriteVerified:false`, `neverSave:true`; it does
not validate adapter writes/restoration, site support or real-use acceptance.
The official R8 pure DOM probe remains unchanged with `throwOnSideEffect:true`,
strict keeper/network guards and no fallback. No real trial was run. A single
candidate cannot bookD. Booked remains53, D unbooked, live support/PASS unclaimed.

## Offline verification and consumer repairs

100 new tests pass against the actual engine/parser and actual lifecycle bridge
with jsdom and in-memory storage. They cover same-value select/research,
empty/different/subset/extra/unknown facts, scope/kind/dictionary/editability,
outside-value getter traps, fixture/binding mixing, missing/legacy/changed state,
crypto-await changes, late navigation, user events before/after initial binding,
locks/writer denial, old/new reinjection and safe reports.

The existing basic-info reinjection test's revision expectation moves7→9.
One unrelated-address null stub is added to the isolated nanyue select extraction
scaffold: the original unmodified c480 test was executed with the actual c480
engine source and already failed `cmsBasicAddressBinding is not defined`.
`_temp-scripts/r9-neighbor-c480-{proof,source-proof}.txt` retain that evidence;
`r9-neighbor-final.txt` records the repaired scaffold. No education/product
behavior is changed by this test-only dependency repair.

Authoritative full validation uses a fresh local clone with `core.autocrlf=false`
of the fixed source commit, as required by `docs/OFFLINE_WINDOWS_REGRESSION.md`.
It runs `npm ci --ignore-scripts --no-audit --no-fund`, generates EXAMPLE signing
fixtures and DEV-ONLY localhost TLS inside that clone (no system cert store or
operator keys), then:

```powershell
node --test --test-concurrency=3 tests/*.test.mjs tests/import/*.test.mjs
node tests/e2e/cms-cross-world-keycode-edge.mjs
```

Step6 builds internal, a paid candidate with `RequireSignedEntitlement`, the
EXAMPLE public key and a loopback URL, and paid smoke from the same clone/source.
Paid smoke's configuration uses `requireSigned:false`; it is not described as
mandatory-signature acceptance. Generated fixtures/keys/builds are not committed.
Final full/build output is recorded outside tracked source under the fresh
clone's `_temp-scripts/r9-*` with the exact tested source SHA. Exploratory tests
in the original autocrlf worktree are not authoritative full-regression evidence.
