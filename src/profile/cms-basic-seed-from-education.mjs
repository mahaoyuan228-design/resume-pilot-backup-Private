// Copy ONLY confirmed education-row / education-site-fact values into CMS
// 个人基本信息 aliases. Never invent 籍贯/婚姻/居住地/面试地点/国籍.
import {
  normalizeProfile,
  isConfirmed,
  questionScopesOverlap,
  customAnswersProjection,
  preserveUniqueScopedConfirmations
} from './store.js';
import {
  CMS_QUESTION_PAGE,
  CMS_QUESTION_TEMPLATES,
  templateForFact
} from './site-question-templates.js';
import { fullDay } from './cms-education-plan.mjs';

const SECTION = '个人基本信息必填';
const PAGE = CMS_QUESTION_PAGE;

/** Aliases that MAY be seeded from confirmed education sources. */
export const CMS_BASIC_SEEDABLE = Object.freeze([
  '__cms_basic_academic_degree',
  '__cms_basic_education_level',
  '毕业院校',
  '__cms_basic_major',
  '__cms_basic_graduation_date'
]);

/** Personal facts that must never be auto-seeded or auto-confirmed here. */
export const CMS_BASIC_NEVER_SEED = Object.freeze([
  '现居住地',
  '籍贯',
  '国籍/地区',
  '婚姻状况',
  '期望面试地点（供参考，实际安排将根据笔试通过名单确定）'
]);

const BASIC_TEMPLATES = CMS_QUESTION_TEMPLATES.filter((row) => row.sectionName === SECTION);

function templateByAlias(alias) {
  return BASIC_TEMPLATES.find((row) => (row.alias || row.question) === alias) || null;
}

function draftFor(alias) {
  const template = templateByAlias(alias);
  if (!template) return null;
  return {
    question: template.alias || template.question,
    answer: '',
    sitePageUrl: PAGE,
    sectionName: SECTION,
    rowContext: 'single'
  };
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function degreeRank(degree) {
  const value = text(degree);
  if (/博士/.test(value)) return 4;
  if (/硕士/.test(value)) return 3;
  if (/本科|学士/.test(value)) return 2;
  if (/大专|专科/.test(value)) return 1;
  if (/高中|中学/.test(value)) return 0;
  return -1;
}

function confirmedSiteFactsForIndex(entries, index) {
  return (Array.isArray(entries) ? entries : []).filter(
    (entry) =>
      entry
      && entry.confirmed === true
      && entry.profileIndex === index
      && entry.sitePageUrl === PAGE
      && ['manual', 'resume', 'import'].includes(entry.origin)
  );
}

function mappedEducationLevel(profile, index, degree) {
  const sourcePath = `education.${index}.degree`;
  const matches = (profile.siteOptionMappings || [])
    .map((row, mappingIndex) => ({ row, mappingIndex }))
    .filter(
      ({ row, mappingIndex }) =>
        row.fieldPath === sourcePath
        && row.sourceValue === degree
        && text(row.optionText)
        && isConfirmed(profile, `siteOptionMappings.${mappingIndex}.optionText`)
    );
  if (matches.length === 1) return text(matches[0].row.optionText);
  return degree;
}

/**
 * Prefer an explicit index; else the confirmed school+degree+major row with the
 * strongest degree signal and, when tied, the one that also has a full-day
 * graduation site fact or YYYY-MM-DD endDate.
 */
export function pickEducationIndexForCmsBasic(profile, siteFactEntries = [], preferredIndex = null) {
  const rows = Array.isArray(profile?.education) ? profile.education : [];
  if (Number.isInteger(preferredIndex) && preferredIndex >= 0 && preferredIndex < rows.length) {
    return preferredIndex;
  }
  const candidates = [];
  for (let index = 0; index < rows.length; index += 1) {
    const schoolOk = isConfirmed(profile, `education.${index}.school`) && text(rows[index]?.school);
    const degreeOk = isConfirmed(profile, `education.${index}.degree`) && text(rows[index]?.degree);
    const majorOk = isConfirmed(profile, `education.${index}.major`) && text(rows[index]?.major);
    if (!schoolOk || !degreeOk || !majorOk) continue;
    const facts = confirmedSiteFactsForIndex(siteFactEntries, index);
    const hasGradDay = facts.some((entry) => entry.field === 'endDate' && fullDay(entry.value))
      || fullDay(rows[index]?.endDate);
    const hasAcademic = facts.some((entry) => entry.field === 'academicDegree' && text(entry.value));
    candidates.push({
      index,
      rank: degreeRank(rows[index].degree),
      hasGradDay: hasGradDay ? 1 : 0,
      hasAcademic: hasAcademic ? 1 : 0
    });
  }
  if (!candidates.length) return null;
  candidates.sort(
    (a, b) =>
      b.rank - a.rank
      || b.hasGradDay - a.hasGradDay
      || b.hasAcademic - a.hasAcademic
      || a.index - b.index
  );
  return candidates[0].index;
}

function collectSeedPlan(profile, index, siteFactEntries) {
  const row = profile.education[index];
  const facts = confirmedSiteFactsForIndex(siteFactEntries, index);
  const plan = [];

  if (isConfirmed(profile, `education.${index}.school`) && text(row.school)) {
    plan.push({ alias: '毕业院校', value: text(row.school), from: `education.${index}.school` });
  }
  if (isConfirmed(profile, `education.${index}.degree`) && text(row.degree)) {
    plan.push({
      alias: '__cms_basic_education_level',
      value: mappedEducationLevel(profile, index, text(row.degree)),
      from: `education.${index}.degree`
    });
  }
  if (isConfirmed(profile, `education.${index}.major`) && text(row.major)) {
    plan.push({ alias: '__cms_basic_major', value: text(row.major), from: `education.${index}.major` });
  }

  const academic = facts.find((entry) => entry.field === 'academicDegree' && text(entry.value));
  if (academic) {
    plan.push({
      alias: '__cms_basic_academic_degree',
      value: text(academic.value),
      from: `educationSiteFacts.${index}.academicDegree`
    });
  }

  const siteEnd = facts.find((entry) => entry.field === 'endDate' && fullDay(entry.value));
  if (siteEnd) {
    plan.push({
      alias: '__cms_basic_graduation_date',
      value: text(siteEnd.value),
      from: `educationSiteFacts.${index}.endDate`
    });
  } else if (isConfirmed(profile, `education.${index}.endDate`) && fullDay(row.endDate)) {
    plan.push({
      alias: '__cms_basic_graduation_date',
      value: text(row.endDate),
      from: `education.${index}.endDate`
    });
  }

  return plan;
}

function findOverlappingFactIndex(facts, alias) {
  const draft = draftFor(alias);
  if (!draft) return -1;
  return (facts || []).findIndex((row) => {
    if (templateForFact(row)?.alias === alias || (row?.question === alias)) return true;
    return questionScopesOverlap(row, draft);
  });
}

function upsertSeedFact(profile, alias, value) {
  const template = templateByAlias(alias);
  if (!template || CMS_BASIC_NEVER_SEED.includes(alias)) {
    return { status: 'skipped', reason: 'alias_forbidden_or_unknown', alias };
  }
  const answer = text(value);
  if (!answer) return { status: 'skipped', reason: 'empty_value', alias };

  const path = `customAnswers.${alias}`;
  const facts = profile.customFacts || [];
  const index = findOverlappingFactIndex(facts, alias);
  const existingAnswer = index >= 0 ? text(facts[index].answer) : '';
  const existingPath = index >= 0
    ? (facts[index].question === alias
      ? `customAnswers.${alias}`
      : `customAnswers.${facts[index].question}`)
    : null;
  const alreadyConfirmed = isConfirmed(profile, path)
    || (existingPath && isConfirmed(profile, existingPath));

  if (alreadyConfirmed && existingAnswer && existingAnswer !== answer) {
    return {
      status: 'conflict',
      reason: 'confirmed_value_differs',
      alias,
      path,
      existing: existingAnswer,
      attempted: answer
    };
  }
  if (alreadyConfirmed && existingAnswer === answer && facts[index]?.question === alias) {
    return { status: 'unchanged', alias, path, value: answer };
  }

  if (index >= 0) {
    // Canonicalize asterisk / wording variants onto the template alias so
    // readiness (which keys by alias) can see the seeded fact.
    facts[index] = {
      ...facts[index],
      question: alias,
      answer,
      sitePageUrl: PAGE,
      sectionName: SECTION,
      rowContext: 'single'
    };
  } else {
    if (facts.length >= 100) {
      return { status: 'skipped', reason: 'custom_facts_capacity', alias };
    }
    facts.push({
      question: alias,
      answer,
      sitePageUrl: PAGE,
      sectionName: SECTION,
      rowContext: 'single'
    });
  }

  profile.customFacts = facts;
  profile.customAnswers = customAnswersProjection(profile.customFacts, profile.customAnswers);
  if (!profile.confirmedFields.includes(path)) profile.confirmedFields.push(path);
  // Drop stale confirmations on asterisk/overlap keys for this alias scope.
  profile.confirmedFields = profile.confirmedFields.filter((item) => {
    if (item === path) return true;
    if (!item.startsWith('customAnswers.')) return true;
    const question = item.slice('customAnswers.'.length);
    if (question === alias) return true;
    return !questionScopesOverlap(
      { question, sitePageUrl: PAGE, sectionName: SECTION, rowContext: 'single' },
      draftFor(alias)
    );
  });
  profile.sources = { ...(profile.sources || {}), [path]: 'manual' };
  return { status: 'seeded', alias, path, value: answer };
}

/**
 * Pure-ish mutate of a profile clone: seed seedable CMS basic aliases from one
 * confirmed education row (+ optional confirmed education site facts).
 *
 * @param {object} rawProfile
 * @param {{ profileIndex?: number|null, siteFactEntries?: array, dryRun?: boolean }} [options]
 * @returns {{ ok: boolean, reason?: string, profile: object, profileIndex: number|null,
 *   seeded: array, skipped: array, conflicts: array, neverSeeded: string[], dryRun: boolean }}
 */
export function seedCmsBasicFromEducation(rawProfile, options = {}) {
  const dryRun = options.dryRun === true;
  const siteFactEntries = Array.isArray(options.siteFactEntries) ? options.siteFactEntries : [];
  const base = normalizeProfile(rawProfile);
  const profileIndex = pickEducationIndexForCmsBasic(base, siteFactEntries, options.profileIndex ?? null);
  const neverSeeded = [...CMS_BASIC_NEVER_SEED];

  if (profileIndex == null) {
    return {
      ok: false,
      reason: 'education_row_not_ready',
      profile: base,
      profileIndex: null,
      seeded: [],
      skipped: [{ reason: 'need_confirmed_school_degree_major' }],
      conflicts: [],
      neverSeeded,
      dryRun
    };
  }

  const plan = collectSeedPlan(base, profileIndex, siteFactEntries);
  if (!plan.length) {
    return {
      ok: false,
      reason: 'nothing_to_seed',
      profile: base,
      profileIndex,
      seeded: [],
      skipped: [{ reason: 'no_confirmed_mappable_fields' }],
      conflicts: [],
      neverSeeded,
      dryRun
    };
  }

  if (dryRun) {
    return {
      ok: true,
      reason: 'dry_run',
      profile: base,
      profileIndex,
      seeded: plan.map((row) => ({ status: 'would_seed', ...row })),
      skipped: [],
      conflicts: [],
      neverSeeded,
      dryRun: true
    };
  }

  const working = structuredClone(base);
  // Ensure capacity drafts do not block alias upsert via overlap with empty *.
  preserveUniqueScopedConfirmations(working, working.customFacts);

  const seeded = [];
  const skipped = [];
  const conflicts = [];
  for (const row of plan) {
    const result = upsertSeedFact(working, row.alias, row.value);
    const detail = { ...result, from: row.from };
    if (result.status === 'seeded' || result.status === 'unchanged') seeded.push(detail);
    else if (result.status === 'conflict') conflicts.push(detail);
    else skipped.push(detail);
  }

  const normalized = normalizeProfile(working);
  // Re-apply confirmations that normalizeProfile keeps only for filled paths.
  for (const row of seeded) {
    if (row.path && !normalized.confirmedFields.includes(row.path) && normalized.customAnswers?.[row.alias]) {
      normalized.confirmedFields.push(row.path);
    }
  }
  normalized.confirmedFields = [...new Set(normalized.confirmedFields)];

  return {
    ok: conflicts.length === 0 && seeded.some((row) => row.status === 'seeded' || row.status === 'unchanged'),
    reason: conflicts.length ? 'partial_conflicts' : (seeded.length ? 'seeded' : 'nothing_applied'),
    profile: normalized,
    profileIndex,
    seeded,
    skipped,
    conflicts,
    neverSeeded,
    dryRun: false
  };
}

export function describeCmsBasicSeedHelp(result) {
  const seededAliases = (result?.seeded || []).map((row) => row.alias);
  const stillNeed = CMS_BASIC_SEEDABLE.filter((alias) => !seededAliases.includes(alias))
    .concat([...CMS_BASIC_NEVER_SEED]);
  return {
    autoSeedableWhenEducationConfirmed: [...CMS_BASIC_SEEDABLE],
    neverAutoSeed: [...CMS_BASIC_NEVER_SEED],
    seededAliases,
    stillNeedJeremy: [...new Set(stillNeed)]
  };
}
