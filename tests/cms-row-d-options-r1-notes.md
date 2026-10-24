# CMS row D options adapter R1 — offline Never-Save

Base: `ef771fc02415a9249bfe86dd9d20afca7f6c130d` on
`cursor/expand-night-ats-f861`. Source harvest:
`cms-row-d-open-harvest-2026-10-24-1445`.

The adapter resolves recorded option labels and checks a document against a
strict ownership contract. It grants no permission to interact with the page.
Every result keeps `neverSave=true`, `liveSupportClaimed=false`,
`writeStarted=false`, `mutationAllowed=false`, and `valuesExposed=false`.
The exported module is deliberately separate from live runners and content
fill entry points. No row D live PASS or +12 booking is established; parent
booked percentage remains 53 pending tip integration, real-use Never-Save
evidence, and explicit booking.

## Evidence limits

- Twelve captured ant-select dictionaries, two radio labels, and 25 checkbox
  labels are projected into the sanitized JSON fixture. Its source hashes bind
  the projection to the supplied artifacts without retaining personal values,
  resume URLs, or volatile popup IDs.
- Location one reports 30 options, but every retained source truncates labels
  to the same first 25. Only those 25 are accepted. The missing five are not
  supplied by a geographic dictionary or inferred from general knowledge.
- Location two has no independent option list. Its user-authorized reuse of
  location one's sample is marked unverified and cannot pass a live ownership
  or filling gate.
- Checkbox extraction stops at 25. The total is unknown and the dictionary is
  incomplete. The collector's `optionsVisible` property is a source name; it
  does not prove computed visibility or input-to-label associations.
- The optional English certificate calendar is metadata only and is skipped.
  No popup, date navigation, value code, or certificate-dependent score rule
  is inferred.
- Constructed test documents are explicitly synthetic. The harvest establishes
  section/question IDs and selector associations, not full captured HTML or
  every intermediary tag. The inspector's strict descendant-item and popup
  ownership checks are a runtime contract, not a claim about unrecorded DOM.

## Location autosave countermeasure

The harvest Markdown records an earlier location open that triggered
`POST .../resume/info/edit` while the displayed value stayed unchanged. The v4
collector avoided location clicks; its zero-POST result does not prove opening
or blurring is safe.

This adapter uses only recorded dictionaries and read-only DOM inspection. It
never opens a select, clicks an option or page button, focuses or blurs a
control, dispatches an event, invokes a framework callback, writes a value, or
starts a network request. Missing dormant options fail closed; there is no
global visible-dropdown fallback or attempt to materialize a list. A popup
must be uniquely linked to its current combobox through `aria-controls`.

No probe fill occurs, so original values remain unchanged and no restoration
write is necessary. Any future live probe is outside this change and must
guard non-GET requests before interaction, document any
`POST .../resume/info/edit`, retain Never-Save, and restore original values
after a probe fill. An unchanged displayed value alone is insufficient proof.

## Offline validation

`tests/cms-row-d-options.test.mjs` checks recorded option hits and explicit
partial/reused dictionaries. Synthetic topology cases exercise ambiguous IDs,
section/question/control ownership, dormant popup association, and refusals.
Interaction, mutation, current-value reads, and network tripwires verify that
inspection leaves the document unchanged. These checks do not establish live
support.

Validation on Windows / Node 24.20.0:

- New row D suite: 140 passed, zero failed.
- Adjacent row C probe, basic-info gaps, and basic-info runner suites:
  126 passed, zero failed.
- The unchanged self-evaluation suite: 7 passed, 6 failed. Its existing
  `new URL(import.meta.url).pathname` root calculation produces `C:\C:\...`
  paths on Windows (`tests/cms-self-eval-live.test.mjs:46`), causing missing
  source files and related fake-run/help failures. Neither that test nor its
  runner is changed by this PR.

Education, paid product paths, and live CDP sessions are outside this change.
