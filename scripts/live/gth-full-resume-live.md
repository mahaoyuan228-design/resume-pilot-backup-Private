# Full GTH Never-Save live trial

From the repository root with Node.js 20+ and an existing logged-in Edge CDP tab at `https://hr.gtht.com/resume/edit/`:

```powershell
$env:PORT='9239'; $env:OUTDIR='C:/Users/admin/Desktop/ResumeQuickFill-Dev/_temp-scripts'; node scripts/live/gth-full-resume-live.mjs
```

Install dependencies with `npm install` first. `PORT` defaults to `9239`, `OUTDIR` to the current directory, and `STEP_TIMEOUT_MS` to `30000`. The runner writes one `gth-full-resume-live.json`, including failures to attach. It does not create or navigate tabs. The existing standalone runners remain available.

The same session runs 基本信息, 教育经历, 工作经验, 职业技能与特长, 其他信息, then 求职意向. Work uses the existing harness fixture with 任职时间 `2020-03` through `2024-08` and 下属人数 `5`. Each section records product results, field readback, attempted clicks, requests, and cancellation. Intent reuses the standalone runner's three independent field trials. The real shipped month-model acceptance bridge is included.

Allowed clicks are classified by role: the section 编辑 link, a type-button 取消, option/checkbox/radio rows inside an already visible picker panel (including empty-label nodes that sit in those rows), date-panel month/year arrows and month or day cells, the date-editor icon and select/cascader triggers the shipped writers already click, and a visible 确定 inside `.pop-foot` or `.el-picker-panel__footer`. 保存, 提交, 投递, 删除, and type=submit stay blocked. A bare empty click outside an open panel stays blocked. The runner does not claim those trials passed.

Every request method other than GET fails except POST to `https://hr.gtht.com/interface/js/type/getsalaryunit.json` or `https://hr.gtht.com/interface/photo/type/getPhotoSize.json`, ignoring the query and requiring that exact path. HEAD and OPTIONS are failures too. Save and submit endpoints stay blocked. CDP Fetch interception and page fetch/XHR/beacon hooks prevent disallowed requests; observed and blocked requests both appear in the evidence. Form submission is blocked separately.

After 编辑 the harness waits for `.el-form-item`. The initially open basic form is accepted only if it is the sole form, has no 编辑 link, and has one visible type-button 取消. Every attempted section ends with cancellation. If the form only hides, or a picker panel stays behind, the harness disconnects that section's editor before the next section runs. Each section re-injects the shipped writers, including education and work, the same way skills and other are bound. Later sections still receive their own trials after an earlier failure. A hidden tab is brought to the front and checked again; a trial that loses visibility is retried once. Persistent hidden state reports `page_hidden`.

`neverSave` is always true and `liveSupportClaimed` is always false. Exit codes: `0` all fields and cancellations verified; `1` setup, evidence or cleanup failure; `2` section/field/cancel failure; `3` a forbidden click or request attempt. Unsupported product fields are reported rather than counted as verified, so a complete evidence file can correctly have a nonzero exit code. No real Edge trial is implied by the jsdom tests.

## Repository dependency closure

`RUNTIME_FILES` in the runner lists its own entrypoint, all direct/transitive repository ESM imports, and the product sources evaluated in the page. Node built-ins and the installed `ws` package are excluded:

```text
scripts/live/gth-full-resume-live.mjs
scripts/live/lib/gth-full-orchestrator.mjs
scripts/live/lib/gth-full-page.mjs
scripts/live/lib/gth-full-sections.mjs
scripts/live/gth-other-skills-live.mjs
scripts/live/gth-intent-live.mjs
scripts/probe-gth-section.mjs
scripts/probe-gth-intent.mjs
scripts/gth-option-reader.mjs
tools/live-harvest/cdp-client.mjs
tools/live-harvest/errors.mjs
src/background/gth-open-fills.mjs
src/background/gth-save-policy.mjs
src/content/gth-open-fill.js
src/content/gth-basic.js
src/content/gth-education-fill.js
src/content/gth-work-fill.js
src/content/gth-skills.js
src/content/gth-other.js
src/content/gth-intent.js
```

The runner reads `src/content/gth-intent.js` as-is. It does not modify the intent cascader, CMS runners, site lists, or signing material.
