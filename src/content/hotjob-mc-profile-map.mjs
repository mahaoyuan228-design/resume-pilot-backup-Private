// Pure hotjob mc (antd-mobile H5) basic field planning from resumeProfile.
// First slice: 姓名 / 移动电话 / 电子邮箱 + select 性别/证件类型 — live labels from 中联
// SU661f… /mc/deliver/operationResumer probe 2026-10-18.
// 待真机 Never-Save，未宣称已支持。liveSupportClaimed stays false.
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

/** Same out-of-scope labels the content script refuses. 国籍/地区 stays refused. */
export const HOTJOB_MC_SELECT_OUT_OF_SCOPE = Object.freeze(['国籍/地区', '国籍', '籍贯', '出生日期', '英语等级']);

/** 待真机 Never-Save，未宣称已支持. */
export const HOTJOB_MC_NEVER_SAVE_NOTE = '待真机 Never-Save，未宣称已支持';
export const HOTJOB_MC_LIVE_SUPPORT_CLAIMED = false;
export const HOTJOB_MC_FORBIDDEN_ACTIONS = Object.freeze(['下一步', '保存', '提交', '投递', '删除']);

const OUT_OF_SCOPE_KEYS = new Set([
  'nationality', '国籍', '国籍/地区',
  'nativePlace', '籍贯',
  'birthDate', '出生日期',
  'englishLevel', '英语等级'
]);
const NEVER_SAVE_KEYS = new Set([
  'profile', 'profileBinding', 'allowExplicitValues',
  'fullName', 'mobile', 'phone', 'email',
  'gender', 'idType', '性别', '证件类型',
  'height', 'weight', '身高', '体重'
]);

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

function neverSaveStamp(partial) {
  return {
    ...partial,
    liveSupportClaimed: HOTJOB_MC_LIVE_SUPPORT_CLAIMED,
    neverSave: true,
    saved: false,
    skippedSave: true,
    supportClaimed: false,
    neverClickedNext: true,
    softwareClickedNext: false,
    softwareClickedSave: false,
    softwareClickedSubmit: false,
    softwareClickedDeliver: false,
    softwareClickedDelete: false,
    note: HOTJOB_MC_NEVER_SAVE_NOTE
  };
}

/**
 * Plan an offline Never-Save fill. Does not authorize 下一步/保存/提交/投递/删除.
 * 国籍/地区 and other uncollected controls refuse. Empty allowed values fail closed.
 * 待真机 Never-Save，未宣称已支持.
 */
export function planHotjobMcNeverSave(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return neverSaveStamp({
      ok: false,
      reason: 'profile_missing',
      values: null,
      fields: [],
      blockers: [{ reason: 'profile_missing' }]
    });
  }
  const keys = Object.keys(input);
  const scoped = keys.filter((key) => OUT_OF_SCOPE_KEYS.has(key) || HOTJOB_MC_SELECT_OUT_OF_SCOPE.includes(normalizeHotjobMcLabelText(key)));
  if (scoped.length) {
    return neverSaveStamp({
      ok: false,
      reason: 'select_out_of_scope_search_or_cascader',
      denied: scoped,
      values: null,
      fields: [],
      blockers: scoped.map((key) => ({ key, reason: 'select_out_of_scope_search_or_cascader' }))
    });
  }
  const unknown = keys.filter((key) => !NEVER_SAVE_KEYS.has(key));
  if (unknown.length) {
    return neverSaveStamp({
      ok: false,
      reason: 'field_not_allowed',
      denied: unknown,
      values: null,
      fields: [],
      blockers: unknown.map((key) => ({ key, reason: 'field_not_allowed' }))
    });
  }

  let textPlan;
  if (input.allowExplicitValues === true) {
    const fullName = norm(input.fullName || '');
    const mobile = norm(input.mobile || input.phone || '');
    const email = norm(input.email || '');
    const fields = [
      { label: '姓名', path: 'fullName', value: fullName },
      { label: '移动电话', path: 'phone', value: mobile },
      { label: '电子邮箱', path: 'email', value: email }
    ].map((row) => ({ ...row, ready: Boolean(row.value), reason: row.value ? null : 'empty_value' }));
    if (fields.some((row) => !row.ready)) {
      return neverSaveStamp({
        ok: false,
        reason: 'empty_value',
        values: null,
        fields,
        blockers: fields.filter((row) => !row.ready)
      });
    }
    textPlan = {
      ok: true,
      reason: 'explicit_ready',
      values: { fullName, mobile, email },
      fields,
      blockers: []
    };
  } else {
    textPlan = planHotjobMcBasicFromProfile(input.profile);
    if (!textPlan.ok) return neverSaveStamp(textPlan);
  }

  const optionalTextFields = [];
  for (const spec of [
    { label: '身高', path: 'height' },
    { label: '体重', path: 'weight' }
  ]) {
    const present = [spec.path, spec.label].filter((key) => Object.prototype.hasOwnProperty.call(input, key));
    const fromProfile = !present.length && input.profile
      && Object.prototype.hasOwnProperty.call(input.profile, spec.path);
    if (!present.length && !fromProfile) continue;
    const normalizeValue = (value) => String(value ?? '').normalize('NFKC')
      .replace(/[\u200b-\u200d\ufeff]/gu, '').replace(/[\s\u00a0]+/gu, ' ').trim();
    const values = fromProfile ? [normalizeValue(input.profile[spec.path])] : present.map((key) => normalizeValue(input[key]));
    const value = values[0];
    const reason = new Set(values).size !== 1 ? 'field_ambiguous'
      : !value ? 'missing_profile_value'
        : fromProfile && (!Array.isArray(input.profile.confirmedFields) || !input.profile.confirmedFields.includes(spec.path)) ? 'profile_fact_unconfirmed'
          : null;
    optionalTextFields.push({ ...spec, value, ready: reason === null, reason });
  }
  const optionalBlockers = optionalTextFields.filter((row) => !row.ready);
  if (optionalBlockers.length) return neverSaveStamp({
    ok: false, reason: optionalBlockers[0].reason, values: null,
    fields: [...textPlan.fields, ...optionalTextFields], blockers: optionalBlockers
  });

  const selectFields = [];
  const selectRequests = [
    { keys: ['gender', '性别'], label: '性别', path: 'gender' },
    { keys: ['idType', '证件类型'], label: '证件类型', path: 'idType' }
  ];
  for (const spec of selectRequests) {
    const present = spec.keys.filter((key) => Object.prototype.hasOwnProperty.call(input, key));
    if (!present.length) continue;
    const presentValues = present.map((key) => norm(input[key]));
    let reason = null;
    let value = presentValues[0] || '';
    if (new Set(presentValues).size !== 1) reason = 'field_ambiguous';
    else if (!value) reason = 'empty_value';
    else if (!HOTJOB_MC_SELECT_SPECS[spec.label].alternates.includes(value)) reason = 'select_option_not_allowed';
    if (reason === 'field_ambiguous') value = '';
    selectFields.push({
      label: spec.label,
      path: spec.path,
      value,
      ready: reason === null,
      reason
    });
  }
  const blockers = selectFields.filter((row) => !row.ready);
  if (blockers.length) {
    return neverSaveStamp({
      ok: false,
      reason: blockers[0].reason,
      values: null,
      fields: [...textPlan.fields, ...optionalTextFields, ...selectFields],
      blockers
    });
  }
  return neverSaveStamp({
    ok: true,
    reason: 'never_save_plan_ready',
    values: {
      ...textPlan.values,
      ...Object.fromEntries(optionalTextFields.map((row) => [row.path, row.value])),
      gender: selectFields.find((row) => row.label === '性别')?.value ?? null,
      idType: selectFields.find((row) => row.label === '证件类型')?.value ?? null
    },
    fields: [...textPlan.fields, ...optionalTextFields, ...selectFields],
    blockers: []
  });
}
