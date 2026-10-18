// Pure Beisen recruitment-portal-2022 basic field planning from the shared resumeProfile store.
// First slice: 姓名 / 手机号码 / 邮箱 only (provisional — live form DOM login-walled).
// Used by tests + harness. Content script mirrors the same rules.
// Family: junlebaoruye / invt / jssoft (*.zhiye.com) share ux-recruitment-portal-2022 chunk.

export const BEISEN_2022_SITE_ID = 'beisen-2022';

/** Highest-confidence text labels for Beisen-2022 first slice (provisional until live DOM). */
export const BEISEN_2022_TEXT_LABELS = Object.freeze(['姓名', '手机号码', '邮箱']);

const norm = (value) => String(value ?? '').replace(/[\s\u00a0]+/gu, ' ').trim();

/**
 * Build fill plan from profile. Fail-closed: no invented TEST placeholders.
 * Core three text fields require confirmed fullName / phone / email.
 */
export function planBeisen2022BasicFromProfile(profile) {
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
export function normalizeBeisen2022LabelText(raw) {
  return norm(raw).replace(/^\*\s*/u, '').replace(/\s*\*$/u, '').replace(/[：:]\s*$/u, '').trim();
}

/**
 * Host match for Beisen zhiye recruitment-portal-2022 family.
 * Documented samples: junlebaoruye.zhiye.com, invt.zhiye.com, jssoft.zhiye.com.
 * Excludes legacy CmsPortal tenants that may also use *.zhiye.com (fingerprint in content probe).
 */
export function isBeisen2022Host(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (!host) return false;
  if (host === 'zhiye.com' || host.endsWith('.zhiye.com')) return true;
  return false;
}
