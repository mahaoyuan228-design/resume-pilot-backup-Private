# GTH live preflight

Before the Never-Save work-editor trial, run:

```powershell
node scripts/probe-gth-live-preflight.mjs 9239
```

This read-only probe selects exactly one existing `https://hr.gtht.com/resume/edit/` target on that port. It never opens a website or reads profile/form values.

On 2026-10-21, the page's main world reported `visible` through leftover own-property getters while the native document and the actual extension isolated world reported `hidden`. The writer correctly stopped with `page_hidden` before a write.

The probe reads the prototype visibility getters and rejects own-property overrides, conflicting reported/native states, hidden pages, unavailable native getters, wrong URLs, and incomplete documents. Run it again immediately before dispatching the writer. The writer keeps its own page checks throughout the trial.

Remove known test overrides and bring the actual selected browser window to the foreground. Do not redefine visibility/focus or disable the writer's checks to force a trial. A preflight pass does not validate the end month; the trial still needs matching start/end readback, no save/submit actions or save requests, and a successful cancel with the work-card count unchanged.
