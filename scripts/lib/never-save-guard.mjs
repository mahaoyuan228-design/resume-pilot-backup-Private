// Assess cumulative CDP guard ledgers after drain(); no transport or site policy.
const COUNTERS = ['observedNonGetCount', 'interceptedNonGetCount',
  'blockedNonGetCount', 'responseToNonGetCount'];

export function assessNeverSaveBatch(guards) {
  if (!Array.isArray(guards)) throw new TypeError('batch_guards_invalid');
  const sites = Array.from(guards, (guard, site) => {
    const counts = Object.fromEntries(COUNTERS.map(key => [key,
      Number.isSafeInteger(guard?.traffic?.[key]) && guard.traffic[key] >= 0
        ? guard.traffic[key] : null]));
    const valid = Object.values(counts).every(value => value !== null)
      && typeof guard?.failed === 'function' && typeof guard?.hasPendingCommands === 'function';
    const reason = !valid ? 'guard_evidence_invalid'
      : Object.values(counts).some(value => value > 0) ? 'non_get_attempted'
        : guard.failed() || guard.hasPendingCommands() ? 'network_guard_failed' : 'get_only';
    return { site, status: reason === 'get_only' ? 'PASS' : 'FAIL', reason, ...counts };
  });
  return { status: sites.length > 0 && sites.every(site => site.status === 'PASS') ? 'PASS' : 'FAIL',
    neverSave: true, liveSupportClaimed: false, sites };
}
