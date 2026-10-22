# Full GTH Never-Save live trial

From the repository root with Node.js 20+ and an existing logged-in Edge CDP tab at `https://hr.gtht.com/resume/edit/`:

```powershell
$env:PORT='9239'; $env:OUTDIR='.'; node scripts/live/gth-full-resume-live.mjs
```

Install dependencies with `npm install` first. `PORT` defaults to `9239`, `OUTDIR` to the current directory, and `STEP_TIMEOUT_MS` to `30000`. The runner writes one `gth-full-resume-live.json`, including failures to attach. It does not create or navigate tabs. The existing standalone runners remain available.

The same session runs 基本信息, 教育经历, 工作经验, 职业技能与特长, 其他信息, then 求职意向. Education reuses the current standalone runner's `ResumeGthEducationTextTrial.fullTrial` request and page readback/cancel helper. Its shipped writer opens the existing row through `.el-icon-edit-outline`; it does not require a title 编辑 link. Work reuses the section probe's record-first opener: the first `.sec-context > .sec-detail` record's edit anchor, with title 编辑 as a fallback only for one record without a record edit. An empty work card may use its existing title 编辑 or 添加/新增 control. Hidden, ambiguous, disabled, navigating, delete, and submit controls are refused before clicking. The `title_add` path passes the newly opened empty form to the same `ResumeGthWorkOpen.trial` request used for an existing record; no product writer is replaced. It uses the existing harness fixture with 任职时间 `2020-03` through `2024-08` and 下属人数 `5`. 薪资 remains unsupported and is not counted as verified. Each section records product results, field readback, attempted clicks, requests, and cancellation. Intent reuses the standalone runner's three independent field trials.

基本信息 出生年月 and 参加工作时间 reuse the same existing Element month anchor/TD path and page-world month-model acceptance bridge as the open-fill writers. They verify year navigation, dismiss with Escape/blur, and check that the selected month remains. The work-start trial uses the explicitly confirmed `2022-01` input from the user's 2026-10-22 probe, which reported 取消 restoring the original `2022.09` display. Its evidenced editor is `.el-date-editor.el-date-editor--month.input-l` with a readonly `input.el-input__inner`; no new click sequence is introduced. 姓名 and 性别 use their existing controls. 现居住地 and 照片 retain unsupported coverage.

Allowed clicks are classified by role: the section 编辑 link, the current education writer's row edit or 添加/新增 control, the selected work record edit or empty-card add control, a type-button 取消, the known 性别/是否统招 radio groups, option/checkbox/radio rows inside an already visible picker panel (including empty-label nodes that sit in those rows), date-header month/year arrows and month or day cells, the date-editor icon and select/cascader triggers the shipped writers already click, and a visible 确定 inside `.pop-foot` or `.el-picker-panel__footer`. 保存, 提交, 投递, 删除, type=submit, and unknown actions stay blocked. For 期望工作地区 in intent and 职位类别/公司所属行业 in work, a native level-2 checkbox without a rendered box may use its visible label and leaf row inside the active form’s sole visible census-shaped picker. Work picker abort cleanup also permits the unique `a.cancel.pop-btn` in that owned open picker’s hidden footer. The work month writer’s outside dismissal is admitted only as a one-use Escape from one of the exact two 任职时间 month inputs followed by root mousedown/up/click; an unrelated or repeated root click is refused. Foreign, detached, hidden-panel, ambiguous, and disabled controls remain blocked. A bare empty click outside an open panel stays blocked. The no-layout checkbox regression is an offline scenario using the existing census structure; the reported empty-label audit does not identify its live target. A live rerun is still required.

Every request method other than GET fails except POST to `https://hr.gtht.com/interface/js/type/getsalaryunit.json` or `https://hr.gtht.com/interface/photo/type/getPhotoSize.json`, ignoring the query and requiring that exact path. HEAD and OPTIONS are failures too. Save and submit endpoints stay blocked. CDP Fetch interception and page fetch/XHR/beacon hooks prevent disallowed requests; observed and blocked requests both appear in the evidence. Form submission is blocked separately.

After 编辑 the harness waits for `.el-form-item`; education delegates its open/wait to the shipped fullTrial. The initially open basic form is accepted only if it is the sole form, has no 编辑 link, and has one visible type-button 取消. Every attempted section ends with cancellation and an independent connected-form check. If the form only hides, or a picker panel stays behind, the harness disconnects that section's editor and panels before the next section runs. Each section re-injects the shipped writers. The education helper's extra taps are restored immediately so the shared full-run click/request policy remains in charge. Later sections still receive their own trials after an earlier failure. A hidden tab is brought to the front and checked again. If it remains hidden, the runner sends CDP `Page.setWebLifecycleState({state:"active"})`, checks again, then enables focus emulation only if needed. Enabled focus emulation is disabled during cleanup. A trial that loses visibility is retried once; persistent hidden state reports `page_hidden`. The page visibility read remains authoritative.

Forced basic editor removal proves closure only. It records `restorationVerified:false` and fails that section with `cancel_not_verified` unless an earlier failure already explains it; later sections still run. The normal cancellation regression checks the original work-start display is restored. Offline checks do not prove live restoration.

`neverSave` is always true and `liveSupportClaimed` is always false. Exit codes: `0` all fields and cancellations verified; `1` setup, evidence or cleanup failure; `2` section/field/cancel failure; `3` a forbidden click or request attempt. Unsupported product fields are reported rather than counted as verified, so a complete evidence file can correctly have a nonzero exit code. No real Edge trial is implied by the jsdom tests.

Run the offline GTH regressions with `node --test tests/gth-*.test.mjs`. These include the actual basic writer under the shared guard/month bridge, current education writer integration, record-first work opening and cancellation, empty-card title_add through the actual work writer with blank cascaders and months, hidden-footer abort cleanup, one-use month dismissal and forbidden-control regressions, CDP lifecycle/focus recovery, the shipped intent writer under the checkbox guard, allowed lookup transports, and section cleanup after failures. They do not establish live support.

## Repository dependency closure

`RUNTIME_FILES` in the runner lists its own entrypoint, all direct/transitive repository ESM imports, and the product sources evaluated in the page. Node built-ins and the installed `ws` package are excluded:

```text
scripts/live/gth-full-resume-live.mjs
scripts/live/lib/gth-full-orchestrator.mjs
scripts/live/lib/gth-full-page.mjs
scripts/live/lib/gth-full-sections.mjs
scripts/live/gth-education-live.mjs
scripts/live/lib/gth-education-page.mjs
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
src/content/gth-education.js
src/content/gth-work-fill.js
src/content/gth-skills.js
src/content/gth-other.js
src/content/gth-intent.js
```

The runner reads the current section sources and the education page helper as-is. The education category nested-owners readback is unchanged. It does not modify the intent cascader, CMS runners, site lists, or signing material.
