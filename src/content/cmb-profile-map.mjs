// Pure CMB (招商银行 career.cmbchina.com) basic field planning.
// First slice: 姓名 / 手机号 / 邮箱 (labels from CDP bodyText 2026-10-18 resume page).
// Used by tests + harness. Content script mirrors the same rules.

export const CMB_SITE_ID = 'cmb';

/** CDP bodyText labels on https://career.cmbchina.com/center/resume (个人信息). */
export const CMB_TEXT_LABELS = Object.freeze(['姓名', '手机号', '邮箱']);

const norm = (value) => String(value ?? '').replace(/[\s\u00a0]+/gu, ' ').trim();

/**
 * Build fill plan from profile. Fail-closed: no invented TEST placeholders.
 * Core three text fields require confirmed fullName / phone / email.
 */
export function planCmbBasicFromProfile(profile) {
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
    { label: '手机号', path: 'phone', value: mobile },
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
export function normalizeCmbLabelText(raw) {
  return norm(raw).replace(/^\*\s*/u, '').replace(/\s*\*$/u, '').replace(/[：:]\s*$/u, '').trim();
}

/** Host match for 招商银行自建招聘 SPA (not 招商证券 hotjob CMS). */
export function isCmbHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'career.cmbchina.com';
}

/** Resume edit path from CDP Probe 2026-10-18. */
export function isCmbResumeEditPath(pathname) {
  const path = String(pathname || '');
  return path === '/center/resume' || path.startsWith('/center/resume/');
}
