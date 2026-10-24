// Pure Moka ATS basic field planning from the shared resumeProfile store.
// First slice: 姓名 / 手机号码 / 邮箱 only (provisional — live form DOM login-walled).
// Used by tests + harness. Content script mirrors the same rules.
// Family: app.mokahr.com tenants (sample: TI org=ti siteId=143986) share static-ats.mokahr.com recruitment-web-client.

export const MOKA_SITE_ID = 'moka';

/** Highest-confidence text labels for Moka first slice (provisional until live DOM). */
export const MOKA_TEXT_LABELS = Object.freeze(['姓名', '手机号码', '邮箱']);

const norm = (value) => String(value ?? '').replace(/[\s\u00a0]+/gu, ' ').trim();

/**
 * Build fill plan from profile. Fail-closed: no invented TEST placeholders.
 * Core three text fields require confirmed fullName / phone / email.
 */
export function planMokaBasicFromProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    return {
      ok: false,
      reason: 'profile_missing',
      values: null,
      fields: [],
      blockers: [{ reason: 'profile_missing' }]
    };
  }
  if (!Array.isArray(profile.confirmedFields)) {
    return {
      ok: false,
      reason: 'profile_missing',
      values: null,
      fields: [],
      blockers: [{ reason: 'confirmed_fields_missing' }]
    };
  }

  const confirmed = new Set(profile.confirmedFields.filter((path) => typeof path === 'string'));
  const fullName = norm(profile.fullName || '');
  const mobile = norm(profile.phone || '');
  const email = norm(profile.email || '');

  const core = [
    { label: '姓名', path: 'fullName', value: fullName },
    { label: '手机号码', path: 'phone', value: mobile },
    { label: '邮箱', path: 'email', value: email }
  ].map((row) => {
    let reason = null;
    if (!row.value) reason = 'missing_profile_value';
    else if (!confirmed.has(row.path)) reason = 'profile_fact_unconfirmed';
    return { ...row, ready: reason === null, reason };
  });

  const blockers = core.filter((row) => !row.ready);
  if (blockers.length) {
    return {
      ok: false,
      reason: 'profile_fields_unavailable',
      values: null,
      fields: core,
      blockers
    };
  }

  return {
    ok: true,
    reason: 'profile_ready',
    values: { fullName, mobile, email },
    fields: core,
    blockers: []
  };
}

/** Normalize form-item label text (mirrors content script). */
export function normalizeMokaLabelText(raw) {
  return norm(raw).replace(/^\*\s*/u, '').replace(/\s*\*$/u, '').replace(/[：:]\s*$/u, '').trim();
}

/**
 * Host match for Moka ATS family (*.mokahr.com).
 * Documented sample: app.mokahr.com/campus-recruitment/ti/143986 (德州仪器).
 * CDN siblings: static-ats.mokahr.com, public-cdn.mokahr.com (fingerprint only).
 */
export function isMokaHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (!host) return false;
  if (host === 'mokahr.com' || host.endsWith('.mokahr.com')) return true;
  return false;
}
