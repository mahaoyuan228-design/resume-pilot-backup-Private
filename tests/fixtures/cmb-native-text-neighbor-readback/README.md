# CMB native text neighbor readback evidence

`live-try-20261023.json` extracts the existing Never-Save TRY captures from:

`C:\Users\admin\Desktop\_temp-scripts\cmb-live-398debc7\`

| Source artifact | PR | Target that reported `neighbor_changed` |
| --- | --- | --- |
| `cmb-basic_self-TRY-20261023-151637.json` | #114 | `resume_basicInfo_selfAssessment` |
| `cmb-internship_content-TRY-20261023-151803.json` | #121 | `resume_internshipExperienceList_0_practiceContent` |
| `cmb-clubs-TRY-20261023-151801.json` | #123 | `resume_clubActivityList_0_schoolOfficeDescription` |

Each capture stores its original filename and the SHA-256 of the original file bytes. The selected source keys and their nested values are copied verbatim: tip, section, PR, CDP port, page URL, safety flags, non-GET observations, target visibility metadata, fill result, post-readback, and summary. Only the aggregate wrapper and provenance keys are new. Original captures identify tip `398debc7ade609d5e11ecbe78b250c0c0f6b13cd`, CDP 9237, and `https://career.cmbchina.com/center/resume`.

All three API results report `neighbor_changed` while the separate post-readback contains the exact requested textarea text and reports it visible. Clubs name and title were verified before its description failed. All three captures have no observed non-GET requests and all prohibited software click flags are false.

These captures contain no before/after neighbor snapshots. The changed neighbor, the nature of its change, and whether it was benign are unknown. They do not establish an autosize or measurement textarea, and this fixture invents no DOM. The existing harvested native control metadata remains in the separate `cmb-*-native-text-probe-dom.json` fixtures. Any guard mutations in regression tests are synthetic scenarios, not recorded live neighbor behavior.

The regression fixes target reporting without suppressing isolation failures. After detecting `neighbor_changed`, each of the three writers stops dispatching events and writing fields, waits 40 ms, then reads the active target again. A target whose identity, structure, visibility, editability, exact text and validity still pass is reported as `status: "verified", reason: "readback_matched"`, with its `before` and `after` values. A target rejection remains failed and takes precedence in the operation's reason. An unwritten target cannot recover this way.

The operation still returns `ok: false` and `neighborCheck.ok: false`; callers must use the operation's `ok`, rather than derive success from field statuses. `neighborCheck` records the first detected phase and control descriptors for state changes, additions, removals and reordering. It records changed property names, never neighboring control values, text or file metadata. Later fields stay `not_run`. No hidden/anonymous control is exempted from the neighbor guard. The exact source of live churn remains a skip until the diagnostics provide evidence.

Skipped: a new live browser run, a Save/persistence check, and diagnosis of the specific changed neighbor. This work uses the existing captures and offline tests. `complete`, `liveSupportClaimed`, and `supportClaimed` remain false in the captured fill results; no new live support claim follows from these fixtures. Awards #122, family #118, and skills #120 are outside this change and remain untouched.
