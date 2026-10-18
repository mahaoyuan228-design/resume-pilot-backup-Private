// Pure hotjob mc (antd-mobile H5) basic field planning from resumeProfile.
// First slice: 姓名 / 移动电话 / 电子邮箱 + select 性别/证件类型 — live labels from 中联
// SU661f… /mc/deliver/operationResumer probe 2026-10-18.
// Used by tests + harness. Content script mirrors the same rules.

export const HOTJOB_MC_SITE_ID = 'hotjob-mc';

/** Live header-title labels on mc 基本信息 (verified CDP; not invented). */
export const HOTJOB_MC_TEXT_LABELS = Object.freeze(['姓名', '移动电话', '电子邮箱']);

/** Flat mc-select allowlist. Live: .select-am-list-extra + .am-modal.mc-select-popup (no search).
 *  性别 · 证件类型 share one fillSelect path (2026-10-18).
 *  Out of scope: 国籍/地区 (same popup + 搜索 + ~199 opts → search-heavy); 籍贯/出生日期 cascader|date. */
export const HOTJOB_MC_SELECT_SPECS = Object.freeze({
  性别: Object.freeze({ key: 'gender', alternates: Object.freeze(['男', '女']) }),
  证件类型: Object.freeze({
    key: 'idType',
    alternates: Object.freeze([
      '居民身份证',
      '中国护照',
      '外国护照',
      '港澳居民来往内地通行证',
      '港澳居民居住证',
      '台湾居民居住证',
      '台湾居民来往大陆通行证'
    ])
  })
});
export const HOTJOB_MC_SELECT_LABELS = Object.freeze(Object.keys(HOTJOB_MC_SELECT_SPECS));

const norm = (value) => String(value ?? '').replace(/[\s\u00a0]+/gu, ' ').trim();

/**
 * Build fill plan from profile. Fail-closed: no invented TEST placeholders.
 * Core three text fields require confirmed fullName / phone / email.
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

/** Normalize .header-title text (strip bitian icon glyph leftovers / colon / star). */
export function normalizeHotjobMcLabelText(raw) {
  return norm(raw).replace(/^\*\s*/u, '').replace(/\s*\*$/u, '').replace(/[：:]\s*$/u, '').trim();
}

/** Host match for hotjob wecruit mc family. */
export function isHotjobMcHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (!host) return false;
  return host === 'wecruit.hotjob.cn' || host === 'hotjob.cn' || host.endsWith('.hotjob.cn');
}

/** Path must be /SU{id}/mc/deliver/operationResumer */
export function isHotjobMcPath(pathname) {
  return /^\/SU[0-9A-Za-z]{8,64}\/mc\/deliver\/operationResumer$/u.test(String(pathname || ''));
}
