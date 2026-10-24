# GTH E1 — preserve the optional work salary through the normal profile UI

Base: actual merged `351d49717a045f6a41cf7cfbdf975d2aa54b26da`.
This repairs a shared profile data chain. It is not real-site acceptance,
successful Save, a salary fact collection or a booking of row E.

## Concrete gap

The shipped work writer already accepts an independently confirmed
`experience.N.salary` on its exact probe-derived monthly text control. Its
existing checks require all other work facts and exact editor ownership before
writing. The profile experience whitelist omitted salary; normalize/save/load
discarded both the value and its confirmation/source. The normal UI had no
salary input and told users it was not collected. Live harness fixtures supplied
salary directly, so those writer tests did not cover the ordinary storage chain.

## Data and review contract

The optional salary string is preserved verbatim outside the shared `text`
normalizer. There is no `trim`, truncation, number coercion, symbol removal,
currency conversion, year/month conversion, default or invented amount. An empty
string is omitted. Old schema-v1 profiles without salary retain the same output;
other fields retain their existing normalization. Non-string salary values are
not converted and are omitted as unusable inputs.

`validExperienceSalary` accepts exactly 1–10 ASCII digits. Invalid string drafts
are retained verbatim through save and reload, including leading/trailing space,
non-digits and strings longer than 4,000 characters. They do not enter
`listFilledPaths`, which consequently removes their confirmation and source
during normalization. This special rule applies only to
`experience.<index>.salary`, not similarly named custom questions or other
collections. Invalid imported confirmations cannot launder an invalid salary
into a usable fact. Valid strings keep their existing source/confirmation; saving
an unconfirmed value never promotes it.

The ordinary experience input is escaped `type=text` with no `maxlength`.
It has a monthly yuan label and can be left blank. The former contradictory hint
is removed. Before `confirmSection` normalizes the profile, it validates the raw
salary drafts. An invalid value refuses confirmation of the section and keeps
the section/menu pending even when every other fact has been reviewed. Clearing
the optional field removes it. Generic edit invalidation, whole-list deletion
invalidation, explicit review checkbox, save queue, lifecycle lock and save-error
rollback are reused without new write paths.

A native single-line HTML input cannot represent newline characters in its
displayed value. An imported draft containing a newline remains invalid in the
profile model and is refused before normalization; it is not silently confirmed
from the sanitized display. Store tests check that the original invalid string
survives. Any deliberate edit follows the ordinary invalidation/review path.

The existing work request, assessor, writer, selectors, monthly unit/10-digit
shape checks, binding checks and Never-Save flags are unchanged. No broad salary
support, import-extraction change or other ATS capability is introduced.

## Synthetic validation

The new profile tests execute the entire real options UI body against its actual
HTML and real imported modules in an owned jsdom window. Only module linking and
the terminal init/save promise observation are adapted for the harness. Inputs,
review, confirmation, draft save and row deletion use normal DOM events. Storage
and lifecycle locks are in memory; no browser, actual Chrome context, database,
profile or salary is read. The helper does not call field/confirmation handlers
directly or manufacture a post-confirmation profile.

44 new profile/UI tests cover exact strings and leading zeroes, optional/old
schema stability, invalid drafts and discarded confirmation/source, non-string
refusal, narrow path filtering, real normalize/save/load round trips, no automatic
confirmation, escaped unbounded text UI, raw invalid confirmation, edit/clear,
row shifts and save failure.

Two additional tests reuse the existing complete work editor fixture. Actual UI
input and explicit confirmation feed the real store/load result into the
unchanged `shippedGthWorkOpenFill` request, original writer and assessor. Their
synthetic profile binding is captured/asserted with the real lifecycle helpers.
All required work facts and controls remain present and checked. A confirmed
salary writes and reads back the exact leading-zero string; an unconfirmed
salary fails before any work-field write. Existing salary negatives are retained.

The exploration run corrected two harness assertions: native text inputs strip
newlines from displayed values, so an imported newline draft is tested through
its raw model; and an early refusal does not promise `editorLeftOpen`, so the new
negative chain checks actual zero-write/safety flags instead of success-only
metadata. Neither required a writer change.

Focused command (Node 24.20.0):

```text
node --test tests/gth-experience-salary-profile.test.mjs tests/gth-work-fill.test.mjs
```

## Authoritative full regression

The fixed candidate is validated in a new LF clone with `core.autocrlf=false`
according to `docs/OFFLINE_WINDOWS_REGRESSION.md`: npm ci with ignore-scripts;
disposable EXAMPLE signing fixtures; a DEV-ONLY self-signed localhost certificate
without a system trust-store change; local CHROME_PATH; all test/import files
with test concurrency 3; separate owned Edge cross-world gate; internal,
signed-entitlement paid candidate and paid smoke builds from the same source.
The paid candidate uses a loopback URL and EXAMPLE public key. The separate
smoke configuration does not require signed entitlements and is not described as
signed-entitlement enforcement proof. No paid product source is changed.

Full logs, pin, exact commands/environment, actual skips and fixed-source raw
Git-blob proofs are external to tracked source. Generated EXAMPLE fixtures,
ignored test keys/DEV TLS and test/build outputs are reported separately from
the fixed product sources. Five preexisting generated modifications in the main
worktree are neither staged nor cleaned. Candidate results do not stand in for
later actual merged-tip regression.

No actual browser/site/CDP, applicant facts, E live write/cancel/restore or D trial
is performed here. E remains the whole +5 acceptance row and stays unbooked;
book remains 53. Actual E acceptance still needs independent confirmed facts,
the authenticated exact control and Never-Save readback/restoration evidence.
D remains first priority when its independently confirmed facts arrive.
