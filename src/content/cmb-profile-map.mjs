// Pure CMB (招商银行 career.cmbchina.com) basic field planning.
// First slice: 姓名 / 手机号 / 邮箱 (labels from CDP bodyText 2026-10-18 resume page).
// Gender (性别) is optional and offline-synthetic only: values 男 / 女.
// Height (身高) is optional and offline-synthetic text only: numeric centimeters.
// The page label may include a CM suffix. That unit is never part of the value.
// Weight (体重) is optional and offline-synthetic text only: numeric kilograms.
// The page label may include a KG suffix. That unit is never part of the value.
// `weight` is read only when the caller supplies it. emptyProfile is unchanged.
// Formal work (是否参加过正式工作) is optional and offline-synthetic radio only.
// Allowlist is 是 / 否 from the field map. `formalWork` is read only when the
// caller supplies it. emptyProfile is unchanged. Live radio DOM is not harvested.
// Live radio DOM and the live height/weight label/value are not harvested.
// Used by tests + harness. Content script mirrors the same rules.

export const CMB_SITE_ID = 'cmb';

/** CDP bodyText labels on https://career.cmbchina.com/center/resume (个人信息). */
export const CMB_TEXT_LABELS = Object.freeze(['姓名', '手机号', '邮箱']);

/** Optional radio. Allowlist only. Not a live DOM contract. */
export const CMB_GENDER_LABEL = '性别';
export const CMB_GENDER_VALUES = Object.freeze(['男', '女']);

/**
 * Optional text. Canonical profile label is 身高.
 * Live label may be 身高 or 身高 plus a CM suffix (field map writes 身高 CM). Not a live DOM contract.
 */
export const CMB_HEIGHT_LABEL = '身高';
/** Digits only. A CM suffix is invalid — the unit stays on the label. */
export const CMB_HEIGHT_VALUE_RE = /^\d+(?:\.\d+)?$/u;
const CMB_HEIGHT_LABEL_RE = /^身高(?:\s*(?:[（(]\s*)?cm(?:\s*[）)])?)?$/iu;

/**
 * Optional text. Canonical profile label is 体重.
 * Live label may be 体重 or 体重 plus a KG suffix (field map writes 体重 KG). Not a live DOM contract.
 * Planner key is `weight` when the caller passes it. Not an emptyProfile field.
 */
export const CMB_WEIGHT_LABEL = '体重';
/** Digits only. A KG suffix is invalid — the unit stays on the label. */
export const CMB_WEIGHT_VALUE_RE = /^\d+(?:\.\d+)?$/u;
const CMB_WEIGHT_LABEL_RE = /^体重(?:\s*(?:[（(]\s*)?kg(?:\s*[）)])?)?$/iu;

/**
 * Optional radio. Canonical label is 是否参加过正式工作.
 * Allowlist is 是 / 否 from the field map, not a harvested live option list.
 * `formalWork` is read only when the caller supplies it. emptyProfile is unchanged.
 * Not a live DOM contract. Scope is one label-matched .ant-form-item.
 */
export const CMB_FORMAL_WORK_LABEL = '是否参加过正式工作';
export const CMB_FORMAL_WORK_VALUES = Object.freeze(['是', '否']);

const norm = (value) => String(value ?? '').replace(/[\s\u00a0]+/gu, ' ').trim();

function normMeasure(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/gu, '')
    .replace(/[\s\u00a0]+/gu, ' ')
    .trim();
}

/**
 * Build fill plan from profile. Fail-closed: no invented TEST placeholders.
 * Core three text fields require confirmed fullName / phone / email.
 * Gender is optional: absent stays out of the plan; confirmed 男/女 is included;
 * unconfirmed or any other value is a blocker and is not filled.
 * Height is optional text: absent stays out of the plan; a confirmed numeric
 * centimeter value is included. Unconfirmed, or any value that is not digits
 * (including a CM suffix), is a blocker and is not filled.
 * Weight is optional text on the same rule: absent stays out of the plan; a
 * confirmed numeric kilogram value is included. Unconfirmed, or any value that
 * is not digits (including a KG suffix such as 60kg / 60KG), is a blocker and
 * is not filled. This does not add `weight` to emptyProfile.
 * Formal work is optional radio on the gender rule: absent stays out of the plan;
 * a confirmed 是 or 否 is included. Unconfirmed, or any other value, is a blocker
 * and is not filled. This does not add `formalWork` to emptyProfile.
 * Options are the field-map pair 是/否, not a harvested live list.
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
  const heightRaw = normMeasure(profile.height || '');
  const weightRaw = normMeasure(profile.weight || '');
  const formalWorkRaw = norm(profile.formalWork || '');

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

  const heightFields = [];
  if (heightRaw) {
    let reason = null;
    if (!confirmed.has('height')) reason = 'profile_fact_unconfirmed';
    else if (!CMB_HEIGHT_VALUE_RE.test(heightRaw)) reason = 'invalid_profile_value';
    heightFields.push({
      label: CMB_HEIGHT_LABEL,
      path: 'height',
      value: heightRaw,
      ready: reason === null,
      reason
    });
  }

  const weightFields = [];
  if (weightRaw) {
    let reason = null;
    if (!confirmed.has('weight')) reason = 'profile_fact_unconfirmed';
    else if (!CMB_WEIGHT_VALUE_RE.test(weightRaw)) reason = 'invalid_profile_value';
    weightFields.push({
      label: CMB_WEIGHT_LABEL,
      path: 'weight',
      value: weightRaw,
      ready: reason === null,
      reason
    });
  }

  const formalWorkFields = [];
  if (formalWorkRaw) {
    let reason = null;
    if (!confirmed.has('formalWork')) reason = 'profile_fact_unconfirmed';
    else if (!CMB_FORMAL_WORK_VALUES.includes(formalWorkRaw)) reason = 'invalid_profile_value';
    formalWorkFields.push({
      label: CMB_FORMAL_WORK_LABEL,
      path: 'formalWork',
      value: formalWorkRaw,
      ready: reason === null,
      reason
    });
  }

  const fields = [...core, ...genderFields, ...heightFields, ...weightFields, ...formalWorkFields];
  const coreBlockers = core.filter((row) => !row.ready);
  const genderBlockers = genderFields.filter((row) => !row.ready);
  const heightBlockers = heightFields.filter((row) => !row.ready);
  const weightBlockers = weightFields.filter((row) => !row.ready);
  const formalWorkBlockers = formalWorkFields.filter((row) => !row.ready);
  if (coreBlockers.length) {
    return {
      ok: false,
      reason: 'profile_fields_unavailable',
      values: null,
      fields,
      blockers: [...coreBlockers, ...genderBlockers, ...heightBlockers, ...weightBlockers, ...formalWorkBlockers]
    };
  }

  const gender = genderFields.find((row) => row.ready)?.value || '';
  const height = heightFields.find((row) => row.ready)?.value || '';
  const weight = weightFields.find((row) => row.ready)?.value || '';
  const formalWork = formalWorkFields.find((row) => row.ready)?.value || '';
  return {
    ok: true,
    reason: 'profile_ready',
    values: { fullName, mobile, email, gender, height, weight, formalWork },
    fields,
    blockers: [...genderBlockers, ...heightBlockers, ...weightBlockers, ...formalWorkBlockers]
  };
}

/** Normalize form-item label text (mirrors content script). */
export function normalizeCmbLabelText(raw) {
  return norm(raw).replace(/^\*\s*/u, '').replace(/\s*\*$/u, '').replace(/[：:]\s*$/u, '').trim();
}

/**
 * True when the label is 身高, optionally with a CM unit suffix.
 * 体重 and other items do not match. Not proof of the live label string.
 */
export function isCmbHeightLabel(raw) {
  return CMB_HEIGHT_LABEL_RE.test(normalizeCmbLabelText(normMeasure(raw)));
}

/** Numeric centimeter string, or '' when empty or when a unit/other text is present. */
export function numericCmbHeight(raw) {
  const text = normMeasure(raw);
  return CMB_HEIGHT_VALUE_RE.test(text) ? text : '';
}

/**
 * True when the label is 体重, optionally with a KG unit suffix.
 * 身高 and other items do not match. Not proof of the live label string.
 */
export function isCmbWeightLabel(raw) {
  return CMB_WEIGHT_LABEL_RE.test(normalizeCmbLabelText(normMeasure(raw)));
}

/** Numeric kilogram string, or '' when empty or when a unit/other text is present. */
export function numericCmbWeight(raw) {
  const text = normMeasure(raw);
  return CMB_WEIGHT_VALUE_RE.test(text) ? text : '';
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
