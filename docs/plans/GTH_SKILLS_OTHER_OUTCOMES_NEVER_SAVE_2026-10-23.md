# GTH skills/other outcomes: Never-Save evidence

Base: `cursor/expand-night-ats-f861` at `e4f1b6c3ab05b2ce1287903d77c07d5a0f737107`.

The existing `gth-other-auto.test.mjs` and `gth-simple-auto.test.mjs` harnesses
already supply confirmed, page-scoped skills/other facts, a shipped content
response, profile lifecycle storage, script injection, and message transport.
No new DOM, selector, option dictionary, or live-site behavior is inferred.

The old runners received a fill reply and then asserted the profile binding
before extracting write or policy evidence. Changing the epoch in the existing
message callback reproduced an executed fill being reported and stored with
`writeAttempted:false`; received positive Save/submit/delete claims disappeared.
The new regressions failed against the unchanged runner. The binding assertion
remains mandatory: invalidated replies now stay unknown, stale field details
are omitted, and only received action flags and safe failure codes survive.

A rejected transport or timeout after the fill message is sent cannot establish
that no write occurred. Those reports now use `writeAttempted:null` and
`writeMayHaveStarted:true`. A received explicit `writeStarted` remains evidence.
Timeouts before sending retain the known no-write report. Both queued lifecycle
locks and delayed script injections are checked before a late fill can be sent.
An already-sent content operation cannot be cancelled by this worker timeout;
a late reply cannot upgrade the stored failed report. The two existing CLI
summaries preserve this uncertainty instead of converting it back to false.

The fixed skills/other assessor also accepted contradictory replies: a verified
row marked `supported:false`, a different section, or an explicit failure reason
or error. Eight new response-contract regressions failed before the fix. These
replies now fail closed while consistent preexisting/fill/overwrite replies
remain accepted. The existing record assessor is unchanged.

`saveAttempted`, `saveAllowedByPolicy`, `complete`, and `liveSupportClaimed`
remain false. Simulated positive policy claims are preserved as failure evidence;
the worker does not execute Save/submit/delete. The source change is confined to
the GTH workers, their CLI summaries, and fixed-response dispatch/assessment helper. Existing editor,
education, intent, basic, and occupied-peer behavior is outside this change.

## Validation

Focused Windows run: 48 passed, 0 failed:

```text
node --test tests/gth-other-auto.test.mjs tests/gth-simple-auto.test.mjs tests/gth-fixed-fill-assessment.test.mjs
```

The initial combined regression-first run had 16 new failing cases and 30 passing
controls. Review then reproduced and covered the additional delayed-injection
timeout case for each runner. Existing help-command coverage needs the already
documented `fileURLToPath` Windows cwd correction; that test-only correction is
included here to run the full GTH suite on Windows.

Final combined command uses all `tests/gth*.test.mjs` and
`build-paid-rebuild`, `guard-worker-auto-runners`, `product-paths-whitelist`,
and `pack-side-effect-import`: **504 passed, 0 failed**. It uses
`--test-skip-pattern='smoke rejects a private-key pem'`. The fake private-key
fixture test is intentionally excluded. No private keys or live trial are used.
The inventory update changes only the three touched product rows and aggregate,
using LF product bytes that match the committed files.

## Missing evidence

- Authenticated skills/other live acceptance and validation timing.
- Model/readback traces that distinguish a committed month from surviving paint
  when the page-world month bridge is unavailable.
- Photo/attachment upload acceptance and readback.
- Residence city/district traversal and HK/MO/TW L1-only selection/readback.
- Additional unobserved editor fields, options, and transport recovery behavior.

These remain unimplemented/unclaimed; no live support is asserted.
