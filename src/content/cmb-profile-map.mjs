// Pure CMB (招商银行 career.cmbchina.com) basic field planning.
// First slice: 姓名 / 手机号 / 邮箱 (labels from CDP bodyText 2026-10-18 resume page).
// Gender (性别) is optional and offline-synthetic only: values 男 / 女.
// Live radio DOM is not harvested. Used by tests + harness. Content script mirrors the same rules.

export const CMB_SITE_ID = 'cmb';

/** CDP bodyText labels on https://career.cmbchina.com/center/resume (个人信息). */
export const CMB_TEXT_LABELS = Object.freeze(['姓名', '手机号', '邮箱']);

/** Optional radio. Allowlist only. Not a live DOM contract. */
export const CMB_GENDER_LABEL = '性别';
export const CMB_GENDER_VALUES = Object.freeze(['男', '女']);

const norm = (value) => String(value ?? '').replace(/[\s\u00a0]+/gu, ' ').trim();

/**
 * Build fill plan from profile. Fail-closed: no invented TEST placeholders.
 * Core three text fields require confirmed fullName / phone / email.
 * Gender is optional: absent stays out of the plan; confirmed 男/女 is included;
 * unconfirmed or any other value is a blocker and is not filled.
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
  const genderRaw = norm(profile.gender || '');

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

  const genderFields = [];
  if (genderRaw) {
    let reason = null;
    if (!confirmed.has('gender')) reason = 'profile_fact_unconfirmed';
    else if (!CMB_GENDER_VALUES.includes(genderRaw)) reason = 'invalid_profile_value';
    genderFields.push({
      label: CMB_GENDER_LABEL,
      path: 'gender',
      value: genderRaw,
      ready: reason === null,
      reason
    });
  }

  const fields = [...core, ...genderFields];
  const coreBlockers = core.filter((row) => !row.ready);
  const genderBlockers = genderFields.filter((row) => !row.ready);
  if (coreBlockers.length) {
    return {
      ok: false,
      reason: 'profile_fields_unavailable',
      values: null,
      fields,
      blockers: [...coreBlockers, ...genderBlockers]
    };
  }

  const gender = genderFields.find((row) => row.ready)?.value || '';
  return {
    ok: true,
    reason: 'profile_ready',
    values: { fullName, mobile, email, gender },
    fields,
    blockers: genderBlockers
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
