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
// Marital / politics / ethnicity use harvested Chinese text + code tables.
// They are optional caller-supplied keys and are not added to emptyProfile.
// Id card type uses the full-dictmap IdCardType text+code table and the harvested
// select id resume_basicInfo_idCardType. Live click evidence is on file. The key is
// not added to emptyProfile. 证件号 is a separate text field and is not filled.
// Birth date is hint-only: a present value is not filled.
// Used by tests + harness. Content script mirrors the same rules.

import {
  CMB_BIRTHDATE_HINT,
  CMB_EDUCATION_LEVEL_OPTIONS,
  CMB_EDUCATION_LEVEL_LIST_ID,
  CMB_EDUCATION_LEVEL_SELECT_ID,
  CMB_RELATIONSHIP_TYPE_OPTIONS,
  CMB_RELATIONSHIP_TYPE_LIST_ID,
  CMB_RELATIONSHIP_TYPE_SELECT_ID,
  CMB_RELATIONSHIP_TYPE_ROW1_LIST_ID,
  CMB_RELATIONSHIP_TYPE_ROW1_SELECT_ID,
  CMB_AWARD_LEVEL_OPTIONS,
  CMB_AWARD_LEVEL_LIST_ID,
  CMB_AWARD_LEVEL_SELECT_ID,
  CMB_ENGLISH_LEVEL_OPTIONS,
  CMB_ENGLISH_LEVEL_LIST_ID,
  CMB_ENGLISH_LEVEL_SELECT_ID,
  CMB_CHANNEL_TYPE_OPTIONS,
  CMB_CHANNEL_TYPE_LIST_ID,
  CMB_CHANNEL_TYPE_SELECT_ID,
  CMB_INTERVIEW_CITY_OPTIONS,
  CMB_INTERVIEW_CITY_LIST_ID,
  CMB_INTERVIEW_CITY_SELECT_ID,
  CMB_ETHNICITY_OPTIONS,
  CMB_ID_CARD_TYPE_OPTIONS,
  CMB_ID_CARD_TYPE_LIST_ID,
  CMB_ID_CARD_TYPE_SELECT_ID,
  CMB_MARITAL_OPTIONS,
  CMB_POLITICS_OPTIONS,
  resolveCmbCodedOption
} from './cmb-gated-dicts.mjs';

export {
  CMB_BIRTHDATE_HINT,
  CMB_EDUCATION_LEVEL_OPTIONS,
  CMB_EDUCATION_LEVEL_LIST_ID,
  CMB_EDUCATION_LEVEL_SELECT_ID,
  CMB_RELATIONSHIP_TYPE_OPTIONS,
  CMB_RELATIONSHIP_TYPE_LIST_ID,
  CMB_RELATIONSHIP_TYPE_SELECT_ID,
  CMB_RELATIONSHIP_TYPE_ROW1_LIST_ID,
  CMB_RELATIONSHIP_TYPE_ROW1_SELECT_ID,
  CMB_AWARD_LEVEL_OPTIONS,
  CMB_AWARD_LEVEL_LIST_ID,
  CMB_AWARD_LEVEL_SELECT_ID,
  CMB_ENGLISH_LEVEL_OPTIONS,
  CMB_ENGLISH_LEVEL_LIST_ID,
  CMB_ENGLISH_LEVEL_SELECT_ID,
  CMB_CHANNEL_TYPE_OPTIONS,
  CMB_CHANNEL_TYPE_LIST_ID,
  CMB_CHANNEL_TYPE_SELECT_ID,
  CMB_INTERVIEW_CITY_OPTIONS,
  CMB_INTERVIEW_CITY_LIST_ID,
  CMB_INTERVIEW_CITY_SELECT_ID,
  CMB_ETHNICITY_OPTIONS,
  CMB_ID_CARD_TYPE_OPTIONS,
  CMB_ID_CARD_TYPE_LIST_ID,
  CMB_ID_CARD_TYPE_SELECT_ID,
  CMB_MARITAL_OPTIONS,
  CMB_POLITICS_OPTIONS,
  resolveCmbCodedOption
};

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
const CMB_MARITAL_LABEL_RE = /^婚姻状况(?:（可选）|\(可选\))?$/u;

export const CMB_MARITAL_LABEL = '婚姻状况';
export const CMB_POLITICS_LABEL = '政治面貌';
export const CMB_ETHNICITY_LABEL = '民族';
export const CMB_ID_CARD_TYPE_LABEL = '证件类型';
export const CMB_EDUCATION_LEVEL_LABEL = '学历';
export const CMB_RELATIONSHIP_TYPE_LABEL = '关系类型';
export const CMB_AWARD_LEVEL_LABEL = '获奖级别';
export const CMB_ENGLISH_LEVEL_LABEL = '最高英语水平';
export const CMB_CHANNEL_TYPE_LABEL = '招聘信息来源';
export const CMB_INTERVIEW_CITY_LABEL = '面试期望城市';

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
 * Marital status, politics, ethnicity, and id card type follow the same optional rule.
 * A value must be an exact harvested Chinese name or exact code.
 * Id card type is caller-supplied (`idCardType`). It is not an emptyProfile field.
 * The select id is the harvested resume_basicInfo_idCardType. Live click evidence is on file.
 * 证件号 (resume_basicInfo_idCard) is not planned or filled.
 * Education level is caller-supplied (`educationLevel`). It is not an emptyProfile field.
 * The allowlist keeps live 博士后 (ED000). The select id is the harvested row-0 id.
 * The synthetic fixture may omit that row and is not the live full set.
 * School name and the other education-row controls are not planned or filled.
 * Relationship type is caller-supplied and is not an emptyProfile field.
 * `relationshipType` writes only family row 0. `relationshipTypeRow1` writes only
 * family row 1. One index is never copied onto the other. Family name and phone
 * are not planned or filled. The allowlist is the eight RelationshipType rows.
 * Award level is caller-supplied (`awardLevel`). It is not an emptyProfile field.
 * The allowlist is the five AwardsLevel rows. An award name does not select a level.
 * Award name, honor type, and award date are not planned or filled. Only row 0.
 * English level is caller-supplied (`englishLevel`). It is not an emptyProfile field.
 * The allowlist is the ten EnglishLevel rows, including 其他 (EL010).
 * 托福, 雅思, 四级, and a score are not converted into an exam name.
 * The score control is not planned or filled. Only skill row 0.
 * Channel type is caller-supplied (`channelType`). It is not an emptyProfile field.
 * The allowlist is the fifteen ChannelType rows, including 其他 (CT0016).
 * Names stay exact. A shorter name is not merged into a longer one.
 * The select id is the harvested resume_basicInfo_channelType. Live click evidence is on file.
 * Interview city is caller-supplied (`interviewCity`). It is not an emptyProfile field.
 * The allowlist is the forty-four InterviewCity names. A shorter name does not match.
 * The select id is the harvested resume_basicInfo_expectedInterviewCity.
 * Live click evidence is on file. RankingMajor is not planned here.
 * Birth date is never filled here. A present birthDate is a blocker with
 * reason datepicker_hint_only (confirmed) and is not written.
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
  const maritalRaw = normMeasure(profile.maritalStatus || '');
  const politicsRaw = normMeasure(profile.politics || '');
  const ethnicityRaw = normMeasure(profile.ethnicity || '');
  const idCardTypeRaw = normMeasure(profile.idCardType || '');
  const educationLevelRaw = normMeasure(profile.educationLevel || '');
  const relationshipTypeRaw = normMeasure(profile.relationshipType || '');
  const relationshipTypeRow1Raw = normMeasure(profile.relationshipTypeRow1 || '');
  const awardLevelRaw = normMeasure(profile.awardLevel || '');
  const englishLevelRaw = normMeasure(profile.englishLevel || '');
  const channelTypeRaw = normMeasure(profile.channelType || '');
  const interviewCityRaw = normMeasure(profile.interviewCity || '');
  const birthRaw = normMeasure(profile.birthDate || '');

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

  const codedFields = (raw, path, label, options) => {
    if (!raw) return [];
    const resolved = resolveCmbCodedOption(options, raw);
    let reason = null;
    if (!confirmed.has(path)) reason = 'profile_fact_unconfirmed';
    else if (!resolved) reason = 'invalid_profile_value';
    return [{
      label,
      path,
      value: resolved?.text || raw,
      code: resolved?.code || '',
      ready: reason === null,
      reason
    }];
  };
  const maritalFields = codedFields(maritalRaw, 'maritalStatus', CMB_MARITAL_LABEL, CMB_MARITAL_OPTIONS);
  const politicsFields = codedFields(politicsRaw, 'politics', CMB_POLITICS_LABEL, CMB_POLITICS_OPTIONS);
  const ethnicityFields = codedFields(ethnicityRaw, 'ethnicity', CMB_ETHNICITY_LABEL, CMB_ETHNICITY_OPTIONS);
  const idCardTypeFields = codedFields(idCardTypeRaw, 'idCardType', CMB_ID_CARD_TYPE_LABEL, CMB_ID_CARD_TYPE_OPTIONS);
  const educationLevelFields = codedFields(educationLevelRaw, 'educationLevel', CMB_EDUCATION_LEVEL_LABEL, CMB_EDUCATION_LEVEL_OPTIONS);
  const relationshipTypeFields = codedFields(relationshipTypeRaw, 'relationshipType', CMB_RELATIONSHIP_TYPE_LABEL, CMB_RELATIONSHIP_TYPE_OPTIONS);
  const relationshipTypeRow1Fields = codedFields(relationshipTypeRow1Raw, 'relationshipTypeRow1', CMB_RELATIONSHIP_TYPE_LABEL, CMB_RELATIONSHIP_TYPE_OPTIONS);
  const awardLevelFields = codedFields(awardLevelRaw, 'awardLevel', CMB_AWARD_LEVEL_LABEL, CMB_AWARD_LEVEL_OPTIONS);
  const englishLevelFields = codedFields(englishLevelRaw, 'englishLevel', CMB_ENGLISH_LEVEL_LABEL, CMB_ENGLISH_LEVEL_OPTIONS);
  const channelTypeFields = codedFields(channelTypeRaw, 'channelType', CMB_CHANNEL_TYPE_LABEL, CMB_CHANNEL_TYPE_OPTIONS);
  const interviewCityFields = codedFields(interviewCityRaw, 'interviewCity', CMB_INTERVIEW_CITY_LABEL, CMB_INTERVIEW_CITY_OPTIONS);
  const birthFields = [];
  if (birthRaw) {
    birthFields.push({
      label: CMB_BIRTHDATE_HINT.label,
      path: 'birthDate',
      value: '',
      ready: false,
      reason: confirmed.has('birthDate') ? 'datepicker_hint_only' : 'profile_fact_unconfirmed',
      kind: CMB_BIRTHDATE_HINT.kind,
      fillHint: CMB_BIRTHDATE_HINT.fillHint
    });
  }

  const fields = [
    ...core,
    ...genderFields,
    ...heightFields,
    ...weightFields,
    ...formalWorkFields,
    ...maritalFields,
    ...politicsFields,
    ...ethnicityFields,
    ...idCardTypeFields,
    ...educationLevelFields,
    ...relationshipTypeFields,
    ...relationshipTypeRow1Fields,
    ...awardLevelFields,
    ...englishLevelFields,
    ...channelTypeFields,
    ...interviewCityFields,
    ...birthFields
  ];
  const coreBlockers = core.filter((row) => !row.ready);
  const genderBlockers = genderFields.filter((row) => !row.ready);
  const heightBlockers = heightFields.filter((row) => !row.ready);
  const weightBlockers = weightFields.filter((row) => !row.ready);
  const formalWorkBlockers = formalWorkFields.filter((row) => !row.ready);
  const maritalBlockers = maritalFields.filter((row) => !row.ready);
  const politicsBlockers = politicsFields.filter((row) => !row.ready);
  const ethnicityBlockers = ethnicityFields.filter((row) => !row.ready);
  const idCardTypeBlockers = idCardTypeFields.filter((row) => !row.ready);
  const educationLevelBlockers = educationLevelFields.filter((row) => !row.ready);
  const relationshipTypeBlockers = relationshipTypeFields.filter((row) => !row.ready);
  const relationshipTypeRow1Blockers = relationshipTypeRow1Fields.filter((row) => !row.ready);
  const awardLevelBlockers = awardLevelFields.filter((row) => !row.ready);
  const englishLevelBlockers = englishLevelFields.filter((row) => !row.ready);
  const channelTypeBlockers = channelTypeFields.filter((row) => !row.ready);
  const interviewCityBlockers = interviewCityFields.filter((row) => !row.ready);
  const birthBlockers = birthFields.filter((row) => !row.ready);
  const optionalBlockers = [
    ...genderBlockers,
    ...heightBlockers,
    ...weightBlockers,
    ...formalWorkBlockers,
    ...maritalBlockers,
    ...politicsBlockers,
    ...ethnicityBlockers,
    ...idCardTypeBlockers,
    ...educationLevelBlockers,
    ...relationshipTypeBlockers,
    ...relationshipTypeRow1Blockers,
    ...awardLevelBlockers,
    ...englishLevelBlockers,
    ...channelTypeBlockers,
    ...interviewCityBlockers,
    ...birthBlockers
  ];
  if (coreBlockers.length) {
    return {
      ok: false,
      reason: 'profile_fields_unavailable',
      values: null,
      fields,
      blockers: [...coreBlockers, ...optionalBlockers]
    };
  }

  const gender = genderFields.find((row) => row.ready)?.value || '';
  const height = heightFields.find((row) => row.ready)?.value || '';
  const weight = weightFields.find((row) => row.ready)?.value || '';
  const formalWork = formalWorkFields.find((row) => row.ready)?.value || '';
  const maritalStatus = maritalFields.find((row) => row.ready)?.value || '';
  const politics = politicsFields.find((row) => row.ready)?.value || '';
  const ethnicity = ethnicityFields.find((row) => row.ready)?.value || '';
  const idCardType = idCardTypeFields.find((row) => row.ready)?.value || '';
  const educationLevel = educationLevelFields.find((row) => row.ready)?.value || '';
  const relationshipType = relationshipTypeFields.find((row) => row.ready)?.value || '';
  const relationshipTypeRow1 = relationshipTypeRow1Fields.find((row) => row.ready)?.value || '';
  const awardLevel = awardLevelFields.find((row) => row.ready)?.value || '';
  const englishLevel = englishLevelFields.find((row) => row.ready)?.value || '';
  const channelType = channelTypeFields.find((row) => row.ready)?.value || '';
  const interviewCity = interviewCityFields.find((row) => row.ready)?.value || '';
  return {
    ok: true,
    reason: 'profile_ready',
    values: { fullName, mobile, email, gender, height, weight, formalWork, maritalStatus, politics, ethnicity, idCardType, educationLevel, relationshipType, relationshipTypeRow1, awardLevel, englishLevel, channelType, interviewCity },
    fields,
    blockers: optionalBlockers,
    birthDateHint: CMB_BIRTHDATE_HINT
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

/** 婚姻状况, optionally with the harvested （可选） suffix. */
export function isCmbMaritalLabel(raw) {
  return CMB_MARITAL_LABEL_RE.test(normalizeCmbLabelText(normMeasure(raw)));
}

export function isCmbPoliticsLabel(raw) {
  return normalizeCmbLabelText(normMeasure(raw)) === CMB_POLITICS_LABEL;
}

export function isCmbEthnicityLabel(raw) {
  return normalizeCmbLabelText(normMeasure(raw)) === CMB_ETHNICITY_LABEL;
}

export function isCmbIdCardTypeLabel(raw) {
  return normalizeCmbLabelText(normMeasure(raw)) === CMB_ID_CARD_TYPE_LABEL;
}

export function isCmbEducationLevelLabel(raw) {
  return normalizeCmbLabelText(normMeasure(raw)) === CMB_EDUCATION_LEVEL_LABEL;
}

/** Exact 关系类型. 姓名 and 家庭关系 do not match. */
export function isCmbRelationshipLabel(raw) {
  return normalizeCmbLabelText(normMeasure(raw)) === CMB_RELATIONSHIP_TYPE_LABEL;
}

/** Exact 获奖级别. 奖项名称 does not match. */
export function isCmbAwardLevelLabel(raw) {
  return normalizeCmbLabelText(normMeasure(raw)) === CMB_AWARD_LEVEL_LABEL;
}

/** Exact 最高英语水平. 分数 and 英语等级 do not match. */
export function isCmbEnglishLevelLabel(raw) {
  return normalizeCmbLabelText(normMeasure(raw)) === CMB_ENGLISH_LEVEL_LABEL;
}

/** Exact 招聘信息来源. 渠道 does not match. */
export function isCmbChannelTypeLabel(raw) {
  return normalizeCmbLabelText(normMeasure(raw)) === CMB_CHANNEL_TYPE_LABEL;
}

/** Exact 面试期望城市. 北京 and 城市 do not match. */
export function isCmbInterviewCityLabel(raw) {
  return normalizeCmbLabelText(normMeasure(raw)) === CMB_INTERVIEW_CITY_LABEL;
}

export function isCmbBirthDateLabel(raw) {
  return normalizeCmbLabelText(normMeasure(raw)) === CMB_BIRTHDATE_HINT.label;
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
