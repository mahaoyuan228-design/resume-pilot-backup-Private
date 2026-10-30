// Shared read-only gate for auto runners. No host or field-specific decisions.
export async function requireAutoFormReady(api, tabId) {
  let formReadiness;
  try {
    await api.scripting.executeScript({ target: { tabId }, files: ['src/content/controls/resume-form.js'] });
    const replies = await api.scripting.executeScript({ target: { tabId },
      func: () => globalThis.ResumeFormFlow?.readiness?.inspect() });
    formReadiness = replies?.[0]?.result;
  } catch { /* Unavailable page evidence must never permit a write. */ }
  if (!['ready', 'login_required', 'form_not_ready', 'manual'].includes(formReadiness?.status)) {
    formReadiness = { status: 'manual', reason: 'form_readiness_unavailable',
      readOnly: true, neverSave: true, saveAttempted: false, writeStarted: false,
      writeAttempted: false, saved: false, skippedSave: true, liveSupportClaimed: false };
  }
  if (formReadiness.status !== 'ready') {
    throw Object.assign(Error(formReadiness.reason || formReadiness.status), { formReadiness });
  }
  return formReadiness;
}

export function autoFormReadinessFailure(error) {
  return error?.formReadiness ? { status: error.formReadiness.status,
    formReadiness: error.formReadiness, fillNotStarted: true, writeStarted: false,
    writeAttempted: false, saveAttempted: false, liveSupportClaimed: false } : {};
}
