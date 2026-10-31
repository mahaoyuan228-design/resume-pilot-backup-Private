// Host permission is required; page readiness is a read-only advisory.
const stopped = (status, reason) => ({ status, reason, readOnly: true,
  neverSave: true, fillNotStarted: true, saveAttempted: false, writeStarted: false,
  writeAttempted: false, saved: false, skippedSave: true, liveSupportClaimed: false });

function hostTarget(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
      || url.hostname.includes('*')) return null;
    // Host match patterns cover all ports; retain the actual origin for reports.
    return { origin: url.origin, originPattern: `${url.protocol}//${url.hostname}/*` };
  } catch { return null; }
}

export async function inspectHostPermissions(api, tabId) {
  let grantedOrigins = [], target = {};
  const result = (status, reason, hasHostPermission = false) => ({
    ...stopped(status, reason), ...target, grantedOrigins, hasHostPermission });
  if (!api?.permissions?.getAll || !api.permissions.contains || !api.tabs?.get)
    return result('manual', 'host_permission_api_unavailable');
  try {
    const granted = await api.permissions.getAll();
    if (!granted || typeof granted !== 'object' || Array.isArray(granted)
      || (granted.origins !== undefined && (!Array.isArray(granted.origins)
      || !granted.origins.every(value => typeof value === 'string'))))
      return result('manual', 'host_permission_probe_unavailable');
    grantedOrigins = [...new Set(granted?.origins || [])];
    const tab = await api.tabs.get(tabId);
    target = hostTarget(tab?.url);
    if (!target) { target = {}; return result('manual', 'tab_origin_unavailable'); }
    if (tab.pendingUrl && hostTarget(tab.pendingUrl)?.origin !== target.origin)
      return result('manual', 'tab_navigation_pending');
    const allowed = await api.permissions.contains({ origins: [target.originPattern] });
    if (typeof allowed !== 'boolean') return result('manual', 'host_permission_probe_unavailable');
    return result(allowed ? 'granted' : 'no_permission',
      allowed ? 'host_permission_granted' : 'host_permission_missing', allowed);
  } catch { return result('manual', 'host_permission_probe_unavailable'); }
}

// Optional scaffold only: call directly inside an explicit extension UI gesture,
// with its captured tab URL. No auto runner, probe or message listener requests.
// Call request before awaiting anything so Chrome can enforce the user gesture.
export async function requestHostPermission(api, tabUrl, { userGesture = false } = {}) {
  const target = hostTarget(tabUrl);
  const result = (status, reason, requestAttempted = false, hasHostPermission = false) => ({
    ...stopped(status, reason), ...target, requestAttempted, hasHostPermission });
  if (!target) return result('manual', 'tab_origin_unavailable');
  if (userGesture !== true) return result('manual', 'host_permission_user_gesture_required');
  if (!api?.permissions?.request) return result('manual', 'host_permission_request_unavailable');
  try {
    const granted = await api.permissions.request({ origins: [target.originPattern] });
    return result(granted === true ? 'granted' : 'no_permission',
      granted === true ? 'host_permission_granted' : 'host_permission_request_denied', true, granted === true);
  } catch { return result('manual', 'host_permission_request_failed', true); }
}

export async function requireHostPermission(api, tabId) {
  const hostPermission = await inspectHostPermissions(api, tabId);
  if (!hostPermission.hasHostPermission) {
    const formReadiness = { ...hostPermission, hostPermission };
    throw Object.assign(Error(hostPermission.reason), autoFormReadinessFailure({ formReadiness }));
  }
  return hostPermission;
}

export async function requireAutoFormReady(api, tabId) {
  await requireHostPermission(api, tabId);
  return requirePageFormReady(api, tabId);
}

export function appendAutoAdvisory(report, diagnosis) {
  if (!diagnosis) return;
  const hints = diagnosis.advisoryHints || (diagnosis.status === 'ready' || diagnosis.ok === true ? [] : [diagnosis]);
  report.advisoryHints ||= [];
  for (const hint of hints) {
    if (!report.advisoryHints.some(row => row.status === hint.status && row.reason === hint.reason))
      report.advisoryHints.push({ ...hint, advisory: true, blocking: false });
  }
  return diagnosis;
}

// Also used by the read-only direct-CDP harness, which has no extension context.
export async function requirePageFormReady(api, tabId) {
  let formReadiness;
  try {
    await api.scripting.executeScript({ target: { tabId }, files: ['src/content/controls/resume-form.js'] });
    const replies = await api.scripting.executeScript({ target: { tabId },
      func: () => globalThis.ResumeFormFlow?.readiness?.inspect() });
    formReadiness = replies?.[0]?.result;
  } catch { /* Missing page evidence is advisory too; field guards still apply. */ }
  if (typeof formReadiness?.status !== 'string') {
    formReadiness = { status: 'manual', reason: 'form_readiness_unavailable',
      readOnly: true, neverSave: true, saveAttempted: false, writeStarted: false,
      writeAttempted: false, saved: false, skippedSave: true, liveSupportClaimed: false };
  }
  const advisory = formReadiness.status !== 'ready';
  return { ...formReadiness, advisory, blocking: false,
    advisoryHints: advisory ? [{ ...formReadiness, advisory: true, blocking: false }] : [] };
}

export function autoFormReadinessFailure(error) {
  return error?.formReadiness ? { status: error.formReadiness.status, reason: error.formReadiness.reason,
    formReadiness: error.formReadiness, fillNotStarted: true, writeStarted: false,
    writeAttempted: false, saveAttempted: false, liveSupportClaimed: false } : {};
}
