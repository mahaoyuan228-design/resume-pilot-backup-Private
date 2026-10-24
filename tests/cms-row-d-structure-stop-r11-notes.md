# CMS row D structural stop observability (R11)

Base: actual merged `2d2bb79298aed283a30e99991ae2ad20d703dad4` (R10/PR206).
The parent ran its reviewed collector once. The preserved official result is
completed13/16/preflight-incomplete with four allowed checkpoints and a clean
correlated keeper block. There is no structure sidecar. The original stdout
contains only `captured:false/capture_stopped`; the parent pin says sources
were stable. That historical STOP and all its evidence remain unchanged.

Offline evaluation of the exact merged module against that saved official JSON
returns `cleanCaptureAllowed=true`. The current actual DevTIP/four raw source
pins also verify. This rules out the official retention predicate as the
observed rejection in the saved result; it does not reconstruct the discarded
diagnostic or prove the main catch's precise historical exception.

The demonstrable source defect is lost observability: the diagnostic already
returns three fixed refusals, but R10 passes them to its success validator,
then catches every rejection as `structure=undefined`. Run/main collapse that
and other outer failures into the same generic stdout. Offline the three
refusals all reproduce that loss. There is no retained payload permitting a
choice between wrong-page, unavailable document, bounds/exception, schema or
outer IO paths. In particular, the original URL predicates differ, but that
does not prove an actual query/hash or authorize changing those predicates.

## Minimal change

Only Node-side refusal classification and fixed failure status are added to
the existing tool, with a new pure test file and these notes. There are no new
DOM reads, selectors, value/text reads, queries, interactions, limits, schema
relaxations, URL normalization, protocol retries or guard changes.

The DOM function, composite expression builder, successful `validateStructure`
and final `cleanCaptureAllowed` predicate are byte-identical to2d2. The four
shared dependencies and their version pins are unchanged. The parent can
retain R10's synthetic native Blink/V8 proof for those same expression bytes;
R11 has not rerun a browser or attempted a real capture.

`classifyStructureReply` accepts only an exact own-data
`{captured:false,reason:<fixed enum>}` refusal. The only inner refusal enums are
`wrong_page`, `document_unavailable`, and `structure_limit_or_exception`.
Unknown reasons, extra keys/data, inherited properties, invalid types and
accessor/proxy failures become fixed `schema_invalid`. No original payload or
exception text is spread, printed or saved. The success validator remains the
same; a recognized refusal never becomes a valid structure.

After the actual runner's complete finally, its safety verdict takes priority.
Any unsafe/early/strict/protocol/late/cleanup stop suppresses both structure and
inner refusal as `official_stop`. Original official fields/reason and CDP error
semantics remain unchanged. There is no cached inspection recovery or second
evaluation. A refused capture still writes no structure sidecar.

Failure stdout retains the previous flags/reason and adds only `stopStage` and
`stopCause`. The six code-owned stages are `configuration`, `official_run`,
`official_evidence_write`, `source_recheck`, `capture_gate`, `sidecar_write`.
`not_reached` is the initial cause sentinel; `none` means no inner refusal
(for example a later IO failure). Neither is a capture/support verdict. All
other causes are the three refusals, `schema_invalid`, or `official_stop`.
Caller-provided stage/reason strings and error message/stack/URL/IDs/tokens are
never used. Successful stdout and successful sidecar contents are unchanged.

## Offline evidence

Node v24.20.0 ran only:

```text
node --test tests/cms-row-d-structure-stop-diagnostics.test.mjs
```

32/32 passed,0 failed,0 skipped. The full log is
`_temp-scripts/r11-stop-pure-final.txt`. These are new pure own-memory/jsdom and
fake-session cases: no browser, socket, real CDP, real site or profile access.
They cover exact refusals, malicious getters/proxies/extra private payloads,
original strict/protocol behavior, unsafe official priority, no sidecar,
source/IO stages, exact stdout keys and unchanged successful serialization.
They also compare the four protected source chunks and four dependencies to
the actual2d2 Git blobs. The preexisting five generated artifacts are untouched
and excluded from the commit.

These32 cases supplement the original475 R10 cases; they do not relabel a new
475/507 run as performed. A later parent-authorized candidate/postmerge narrow
run can combine the six original files with this new file. No full3337 matrix,
build, native browser or live retry was run for this change. No cause is filled
back into the old STOP. Booked53, D unbooked; actual facts/R9 trial and calendar
behavior remain outside this work.
