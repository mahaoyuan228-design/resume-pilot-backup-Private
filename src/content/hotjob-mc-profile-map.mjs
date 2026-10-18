// Pure hotjob-mc basic field planning from the shared resumeProfile store.
// First slice: 姓名 / 移动电话 / 电子邮箱 on the antd-mobile operationResumer shell.
// Live sample: 中联重科 SU661f37091eb8053acd6cdf3d /mc/operationResumer.
// Used by tests + harness. Content script mirrors the same rules.

export const HOTJOB_MC_SITE_ID = 'hotjob-mc';

export const HOTJOB_MC_TEXT_LABELS = Object.freeze(['姓名', '移动电话', '电子邮箱']);

export const HOTJOB_MC_HOST = 'wecruit.hotjob.cn';

export const HOTJOB_MC_RESUME_PATH_RE = /^\/(SU[0-9A-Za-z]{8,64})\/mc\/operationResumer$/u;

const norm = (value) => String(value ?? '').replace(/[\s\u00a0]+/gu, ' ').trim();

/**
 * Build fill plan from profile. Fail-closed: no invented placeholders.
 * The three text fields require confirmed fullName / phone / email.
 */
export function planHotjobMcBasicFromProfile(profile) {
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
    { label: '移动电话', path: 'phone', value: mobile },
    { label: '电子邮箱', path: 'email', value: email }
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

export function normalizeHotjobMcLabelText(raw) {
  return norm(raw).replace(/^\*\s*/u, '').replace(/\s*\*$/u, '').replace(/[：:]\s*$/u, '').trim();
}

/** True only for the mc operationResumer path. pb/resumeOperation.html is a different shell. */
export function isHotjobMcResumeUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:'
      && url.hostname === HOTJOB_MC_HOST
      && HOTJOB_MC_RESUME_PATH_RE.test(url.pathname);
  } catch {
    return false;
  }
}
