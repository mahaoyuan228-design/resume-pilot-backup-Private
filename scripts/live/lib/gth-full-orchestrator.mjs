/** Sequential, discard-only orchestration; transport-independent for jsdom tests. */
import { SECTIONS, buildFieldRows } from './gth-full-sections.mjs';
import { isAllowedRequest } from './gth-full-page.mjs';

const failure = (reason, detail) => Object.assign(new Error(detail || reason), { reason });
const errorReason = (error) => error?.reason || 'section_failed';
const formsRemain = (state) => !state || state.formCount !== 0 || state.editorFormCount !== 0;

export async function ensureVisible(driver) {
  let state = await driver.state();
  if (state?.visible !== true) {
    try { await driver.bringToFront(); } catch { /* retry the visibility read once */ }
    state = await driver.state();
    if (state?.visible !== true) throw failure('page_hidden');
  }
  return state;
}

function failedFields(section, reason) {
  return section.questions.map((q) => ({ q, status: 'failed', reason, value: null }));
}

/** A failed trial never skips recording a later section. Cancel, then
 * physically remove a hidden editor, before the next section binds its writer. */
export async function runSections(driver, { sections = SECTIONS } = {}) {
  const runs = [];
  for (const section of sections) {
    const run = {
      id: section.id, section: section.section, status: 'failed', reason: null,
      fields: failedFields(section, 'not_run'), open: null, fills: [], read: null,
      cancel: null, clicks: [], requests: []
    };
    runs.push(run);
    let before = { clicks: [], requests: [] };
    let attemptedOpen = false;
    try {
      before = await driver.evidence();
      const state = await ensureVisible(driver);
      if (formsRemain(state) && !(section.id === 'basic' && runs.length === 1 && state.basicInitialEditor === true)) {
        throw failure('previous_editor_still_open');
      }
      // Re-install the shipped writers after a previous abort. Education owns
      // its row opening through fullTrial; work/skills/other use open-fill.
      // A failed earlier section must not leave a later writer uninstalled.
      if (typeof driver.bindWriters === 'function') await driver.bindWriters(section);
      attemptedOpen = true;
      run.open = await driver.open(section);
      if (run.open?.reason === 'page_hidden') {
        await ensureVisible(driver);
        run.open = await driver.open(section);
      }
      if (run.open?.ok !== true) throw failure(run.open?.reason || 'editor_not_opened');
      run.fills = await driver.fill(section);
      run.read = await driver.read(section);
      run.fields = buildFieldRows(section, run.fills, run.read);
      if (run.fills.some((entry) => {
        const fill = entry?.fill || entry;
        return fill?.liveSupportClaimed === true || fill?.softwareClickedSave === true
          || fill?.softwareClickedSubmit === true || fill?.softwareClickedDelete === true;
      })) run.reason = 'writer_policy_violation';
      const failedTrial = run.fills.map(entry => entry?.fill || entry).find(fill => fill?.ok === false);
      if (failedTrial) run.reason ||= failedTrial.reason || 'writer_failed';
    } catch (error) {
      run.reason = errorReason(error);
      run.detail = String(error?.message || error).slice(0, 300);
      run.fields = failedFields(section, run.reason);
    } finally {
      // An open() timeout can leave a partial form behind. Always attempt its
      // discard, even when open() did not return successfully.
      if (attemptedOpen) {
        try {
          await ensureVisible(driver);
          try { run.cancel = await driver.cancel(section); }
          catch (error) {
            run.cancel = { ok: false, closed: false, reason: errorReason(error) };
          }
          let after = await driver.state();
          const stuck = run.cancel?.ok !== true || run.cancel?.closed !== true || formsRemain(after);
          if (stuck && typeof driver.forceClose === 'function') {
            await driver.forceClose(section);
            after = await driver.state();
            if (!formsRemain(after)) {
              run.cancel = { ...(run.cancel || {}), ok: true, closed: true, forced: true, reason: null };
            }
          }
          if (run.cancel?.ok !== true || run.cancel?.closed !== true || formsRemain(after)) {
            run.cancel = { ...(run.cancel || {}), ok: false, closed: false,
              reason: run.cancel?.reason || 'editor_still_open' };
            run.reason ||= run.cancel.reason;
          }
          // Disconnecting a stuck basic editor permits later sections, but
          // does not prove that the site processed Cancel and restored the
          // work-start month. Keep that distinction in the section verdict.
          if (section.id === 'basic' && run.cancel?.forced === true) {
            run.cancel.restorationVerified = false;
            run.reason ||= 'cancel_not_verified';
          }
        } catch (error) {
          run.cancel = { ...(run.cancel || {}), ok: false, closed: false, reason: errorReason(error) };
          run.reason ||= run.cancel.reason;
        }
      } else {
        run.cancel = { ok: false, closed: false, reason: 'editor_not_owned' };
      }
      try {
        const after = await driver.evidence();
        run.clicks = (after.clicks || []).slice((before.clicks || []).length);
        run.requests = (after.requests || []).slice((before.requests || []).length);
        if (run.clicks.some((row) => row.allowed !== true)) run.reason = 'refusing_forbidden_click';
        if (run.requests.some((row) => row.allowed === false || !isAllowedRequest(row.method, row.url))) run.reason = 'non_get_request';
      } catch (error) {
        run.reason ||= errorReason(error);
      }
    }
    if (!run.reason) run.reason = run.fields.find((row) => row.status !== 'verified')?.reason || null;
    run.status = !run.reason && run.fields.length > 0 && run.cancel?.closed === true ? 'verified' : 'failed';
  }
  return runs;
}
