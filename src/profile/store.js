// Shared profile contract for the options page and the filling engine.
// Only keys listed in confirmedFields may be used for automatic filling.
import {captureProfileBinding,canonicalProfileHash} from './profile-lifecycle.js';
import {rebindAttachmentOwner} from '../import/attachment-store.js';
export const PROFILE_STORAGE_KEY = 'resumeProfile';
export const PROFILE_SCHEMA_VERSION = 1;
export const MAX_CUSTOM_FACTS = 100;

const text = (value, max = 4000) => typeof value === 'string' ? value.slice(0, max).trim() : '';
const strings = (value) => Array.isArray(value)
  ? value.filter((item) => typeof item === 'string').map((item) => text(item, 160)).filter(Boolean).slice(0, 30)
  : [];
const records = (value, keys, max = 30) => Array.isArray(value)
  ? value.slice(0, max).filter((item) => item && typeof item === 'object' && !Array.isArray(item))
      .map((item) => Object.fromEntries(keys.map((key) => [key, text(item[key])])) )
  : [];
export const validExperienceSalary = value => typeof value === 'string' && /^[0-9]{1,10}$/u.test(value);
const EXPERIENCE_KEYS = ['type', 'organization', 'position', 'startDate', 'endDate', 'description'];
const EXPERIENCE_EXTRAS = ['jobCategory', 'industry', 'workArea', 'companyIntro', 'department', 'reportTo', 'subordinateCount', 'leaveReason'];
function experienceRecords(value) {
  if (!Array.isArray(value)) return [];
  const rows = [];
  for (const item of value.slice(0, 30)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = Object.fromEntries(EXPERIENCE_KEYS.map((key) => [key, text(item[key])]));
    for (const key of EXPERIENCE_EXTRAS) {
      const extra = text(item[key]);
      if (extra) row[key] = extra;
    }
    // Keep a typed draft verbatim, including invalid text. It is not a usable
    // confirmed fact until validExperienceSalary passes; never trim or truncate.
    if (typeof item.salary === 'string' && item.salary !== '') row.salary = item.salary;
    rows.push(row);
  }
  return rows;
}

export function emptyProfile() {
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    fullName: '', identityNumber: '', gender: '', height: '',
    selfEvaluation: '', birthDate: '', email: '', phone: '', currentCity: '',
    desiredRoles: [], desiredCities: [], expectedSalary: '',
    availableDate: '', availabilityNote: '',
    education: [], experience: [], projects: [],
    familyDisclosureEnabled: false, familyMembers: [],
    customFacts: [], customAnswers: {}, siteOptionMappings: [], resumeAttachment: null,
    confirmedFields: [], sources: {}, updatedAt: ''
  };
}

export function normalizeProfile(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const profile = emptyProfile();
  for (const key of ['fullName', 'identityNumber', 'gender', 'height', 'selfEvaluation', 'birthDate', 'email', 'phone', 'currentCity', 'expectedSalary', 'availableDate', 'availabilityNote']) {
    profile[key] = text(source[key], key === 'selfEvaluation' ? 4000 : key === 'availabilityNote' ? 500 : 200);
  }
  // Optional confirmed month fact used by GTH 参加工作时间. Preserve imported
  // explicit data without deriving it from any education or experience dates.
  const workStart = text(source.workStart, 200);
  if (workStart) profile.workStart = workStart;
  profile.desiredRoles = strings(source.desiredRoles);
  profile.desiredCities = strings(source.desiredCities);
  profile.education = records(source.education, [
    'school', 'degree', 'major', 'startDate', 'endDate',
    'majorCategory', 'unifiedAdmissions', 'campusActivities',
    'gradeRank', 'majorDescription', 'gpa', 'schoolLocation'
  ]);
  // This new yes/no fact must never become a confirmed arbitrary string when
  // an older or hand-edited JSON backup is loaded.
  for (const row of profile.education) {
    if (row.unifiedAdmissions !== '是' && row.unifiedAdmissions !== '否') {
      row.unifiedAdmissions = '';
    }
  }
  profile.experience = experienceRecords(source.experience);
  profile.projects = records(source.projects, ['name', 'role', 'description']);
  profile.familyDisclosureEnabled = source.familyDisclosureEnabled === true;
  profile.familyMembers = records(source.familyMembers, ['relation', 'occupation', 'employer']);
  const importedAnswers = source.customAnswers && typeof source.customAnswers === 'object' && !Array.isArray(source.customAnswers)
    ? Object.entries(source.customAnswers).slice(0, MAX_CUSTOM_FACTS).map(([question, answer]) => ({ question: text(question, 200), answer: text(answer) }))
    : [];
  profile.customFacts = records(Array.isArray(source.customFacts) && source.customFacts.length ? source.customFacts : importedAnswers,
    ['question', 'answer', 'sitePageUrl', 'sectionName', 'rowContext'], MAX_CUSTOM_FACTS);
  profile.customAnswers = customAnswersProjection(profile.customFacts, source.customAnswers);
  profile.siteOptionMappings = records(source.siteOptionMappings,
    ['siteUrlPrefix', 'fieldPath', 'sourceValue', 'optionText']);
  for(const mapping of profile.siteOptionMappings){if(!mapping.fieldPath.startsWith('customScopedAnswers.'))continue;const matches=profile.customFacts.filter(row=>scopedAnswerPath(row)===mapping.fieldPath&&row.answer===mapping.sourceValue&&questionRows(profile.customFacts,row.question).length===1);if(matches.length===1)mapping.fieldPath=`customAnswers.${matches[0].question}`;}
  if (source.resumeAttachment && typeof source.resumeAttachment === 'object') {
    profile.resumeAttachment = {
      name: text(source.resumeAttachment.name, 260),
      size: Number.isFinite(source.resumeAttachment.size) ? Math.max(0, source.resumeAttachment.size) : 0,
      type: text(source.resumeAttachment.type, 100),
      source: text(source.resumeAttachment.source, 30) || 'local-selection'
    };
  }
  const confirmed = Array.isArray(source.confirmedFields) ? source.confirmedFields : [];
  // When removing the other scope, retain this exact row's known confirmation
  // under its compatible unique-question path. Never infer a row from a global
  // flag while multiple scope rows already exist in an imported backup.
  const remapped=confirmed.map(path=>{if(typeof path!=='string'||!path.startsWith('customScopedAnswers.'))return path;const rows=profile.customFacts.filter(row=>scopedAnswerPath(row)===path);return rows.length===1&&questionRows(profile.customFacts,rows[0].question).length===1?`customAnswers.${rows[0].question}`:path;});
  const validPaths = new Set(listFilledPaths(profile));
  profile.confirmedFields = [...new Set(remapped.filter((path) => typeof path === 'string' && validPaths.has(path) && (profile.familyDisclosureEnabled || !path.startsWith('familyMembers.'))))];
  const rawSources = source.sources && typeof source.sources === 'object' && !Array.isArray(source.sources) ? source.sources : {};
  profile.sources = {};
  for (const path of validPaths) {
    const unique=path.startsWith('customAnswers.')?questionRows(profile.customFacts,path.slice('customAnswers.'.length)):[];
    const origin = rawSources[path]??(unique.length===1?rawSources[scopedAnswerPath(unique[0])]:undefined);
    if (origin === 'manual' || origin === 'resume' || origin === 'import') profile.sources[path] = origin;
  }
  const updatedAt = text(source.updatedAt, 40);
  profile.updatedAt = updatedAt && !Number.isNaN(Date.parse(updatedAt)) ? updatedAt : '';
  return profile;
}

// Dotted paths for nonempty facts; array members use their current index.
export function listFilledPaths(profile) {
  const result = [];
  for (const key of ['fullName', 'identityNumber', 'gender', 'height', 'selfEvaluation', 'birthDate', 'email', 'phone', 'currentCity', 'expectedSalary', 'availableDate', 'availabilityNote', 'workStart']) {
    if (profile[key]) result.push(key);
  }
  for (const key of ['desiredRoles', 'desiredCities']) {
    (profile[key] || []).forEach((value, index) => { if (value) result.push(`${key}.${index}`); });
  }
  for (const key of ['education', 'experience', 'projects', 'familyMembers']) {
    (profile[key] || []).forEach((row, index) => {
      for (const [field, value] of Object.entries(row)) {
        if (value && (key !== 'experience' || field !== 'salary' || validExperienceSalary(value))) result.push(`${key}.${index}.${field}`);
      }
    });
  }
  for(const row of profile.customFacts||[]){const path=customAnswerPath(row,profile.customFacts);if(row.question&&row.answer&&path)result.push(path);}
  // A website-specific choice is useful only when its complete context is present.
  // Confirmation belongs to the option text, and an edited context must revoke it.
  (profile.siteOptionMappings || []).forEach((row, index) => {
    if (row.siteUrlPrefix && row.fieldPath && row.sourceValue && row.optionText) {
      result.push(`siteOptionMappings.${index}.optionText`);
    }
  });
  if (profile.resumeAttachment?.name) result.push('resumeAttachment.name');
  return result;
}

export async function loadProfile() {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const record = await chrome.storage.local.get(PROFILE_STORAGE_KEY);
    return normalizeProfile(record[PROFILE_STORAGE_KEY]);
  }
  // Allows a plain browser preview without giving it extension privileges.
  try { return normalizeProfile(JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || 'null')); }
  catch { return emptyProfile(); }
}

export async function saveProfile(input) {
  const profile = normalizeProfile({ ...input, updatedAt: new Date().toISOString() });
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const lifecycle=(await chrome.storage.local.get('resumeProfileLifecycle')).resumeProfileLifecycle;
    const before=lifecycle?.state==='changing'?null:await captureProfileBinding(chrome.storage.local);
    await chrome.storage.local.set({ [PROFILE_STORAGE_KEY]: profile });
    if(before){const after=await captureProfileBinding(chrome.storage.local);
      if(after.profileHash!==await canonicalProfileHash(profile))throw Error('profile_binding_changed');
      if(profile.resumeAttachment?.source==='stored-local')await rebindAttachmentOwner(before,after);
    }
  } else {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  }
  return profile;
}

export async function clearProfile() {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.remove(PROFILE_STORAGE_KEY);
  } else {
    localStorage.removeItem(PROFILE_STORAGE_KEY);
  }
}

export function isConfirmed(profile, path) {
  return Array.isArray(profile?.confirmedFields) && profile.confirmedFields.includes(path);
}

// Compare question wording without turning similar but distinct questions into
// the same fact. Keep the displayed wording when creating a draft, because the
// filling engine matches the website's actual label rather than a paraphrase.
export function normalizeQuestionKey(value) {
  return typeof value === 'string' ? value.normalize('NFKC').replace(/[\s\u00a0]+/gu, ' ').trim() : '';
}

// Same conservative wording normalization as the current content matcher.
export function normalizeScopedQuestion(value){return normalizeQuestionKey(value).replace(/\(必填\)|（必填）|\(选填\)|（选填）/g,'').replace(/[＊*：:！!？?，,。\.\s\u00a0]/g,'').trim().toLocaleLowerCase();}
export function questionRows(facts,question){const key=normalizeScopedQuestion(question);return key?(facts||[]).filter(row=>normalizeScopedQuestion(row?.question)===key):[];}
export function questionIdentity(row){const page=sitePageUrl(row?.sitePageUrl),section=normalizeScopedQuestion(row?.sectionName),question=normalizeScopedQuestion(row?.question);return page&&page===row.sitePageUrl&&section&&question&&['none','single'].includes(row.rowContext)?JSON.stringify([page,section,row.rowContext,question]):'';}
export function scopedAnswerPath(row){const identity=questionIdentity(row);return identity?'customScopedAnswers.'+encodeURIComponent(identity):'';}
export function customAnswerPath(row,facts){return questionRows(facts,row?.question).length===1?`customAnswers.${row.question}`:scopedAnswerPath(row);}
export function questionScopesOverlap(a,b){if(normalizeScopedQuestion(a?.question)!==normalizeScopedQuestion(b?.question))return false;const ai=questionIdentity(a),bi=questionIdentity(b);if(!ai||!bi)return true;const [ap,as]=JSON.parse(ai),[bp,bs]=JSON.parse(bi);return ap===bp&&as===bs;}
export function customAnswersProjection(facts,previous={}){const result={};for(const row of facts||[]){if(!row.question||!row.answer)continue;const peers=questionRows(facts,row.question);if(peers.length===1)result[row.question]=row.answer;else if(typeof previous?.[row.question]==='string'&&previous[row.question])result[row.question]=previous[row.question];}return result;}
// Called only immediately BEFORE an explicit ordinary UI edit/append. The
// uniquely owned old answer may retain its confirmation when B is added; B's
// new answer never inherits the old question-wide flag.
export function preserveUniqueScopedConfirmations(profile,nextFacts){for(const row of profile.customFacts||[]){const old=`customAnswers.${row.question}`,path=scopedAnswerPath(row);if(path&&row.answer&&questionRows(profile.customFacts,row.question).length===1&&questionRows(nextFacts||profile.customFacts,row.question).length>1&&profile.confirmedFields.includes(old)&&profile.customAnswers?.[row.question]===row.answer){if(!profile.confirmedFields.includes(path))profile.confirmedFields.push(path);if(profile.sources?.[old])profile.sources[path]=profile.sources[old];for(const mapping of profile.siteOptionMappings||[])if(mapping.fieldPath===old&&mapping.sourceValue===row.answer)mapping.fieldPath=path;}}}

// The query and fragment may contain session tokens. The page path includes
// the recruiting tenant on shared hosts such as wecruit.hotjob.cn.
export function sitePageUrl(value) {
  try {
    const url = new URL(value);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
      || url.username || url.password) return '';
    return `${url.origin}${url.pathname}`;
  } catch { return ''; }
}

const contextDependentQuestion = (question) => /^(?:获得时间|成绩)[＊*？?]?$/u
  .test(normalizeQuestionKey(question));

export function collectScopedQuestionDrafts(fields, profile, pageUrl) {
  const page = sitePageUrl(pageUrl);
  if (!page) return [];
  const blank=(Array.isArray(fields)?fields:[]).filter(field=>Array.isArray(field?.labels)&&field.labels.length===1&&typeof field.labels[0]==='string'&&field.labels[0].trim().length<=200&&['input','textarea','select','radio','cms_ant_v3_select','cmb_ant_v4_select'].includes(field.kind)&&!field.hasExistingValue&&!String(field.currentValue??'').trim()&&['unknown_question','missing_profile_value','question_scope_mismatch'].includes(field.reason)&&(!field.path||field.path.startsWith('customAnswers.')||field.path.startsWith('customScopedAnswers.')));
  const counts=new Map();for(const field of Array.isArray(fields)?fields:[]){const key=normalizeScopedQuestion(field?.labels?.[0]);if(key)counts.set(key,(counts.get(key)||0)+1);}
  const identities=new Set();
  return blank.flatMap((field) => {
    const question = typeof field?.labels?.[0] === 'string'
      ? field.labels[0].replace(/[\s\u00a0]+/gu, ' ').trim() : '';
    const sectionName = text(field?.scope?.sectionName, 160);
    const rowContext = text(field?.scope?.rowContext, 80);
    const row={question,sitePageUrl:page,sectionName,rowContext},identity=questionIdentity(row);
    if (!identity||identities.has(identity)||counts.get(normalizeScopedQuestion(question))!==1 || !sectionName
      || !['none', 'single'].includes(rowContext) || contextDependentQuestion(question)) return [];
    if((profile?.customFacts||[]).some(existing=>questionScopesOverlap(existing,row)))return [];
    identities.add(identity);return [row];
  });
}

export function collectUnansweredQuestions(fields, profile) {
  const entries = Array.isArray(fields) ? fields : [];
  const existing = new Set((profile?.customFacts || []).map((row) => normalizeQuestionKey(row.question)).filter(Boolean));
  const counts = new Map();
  const labelFor = (field) => {
    if (!Array.isArray(field?.labels)) return null;
    const labels = field.labels.filter((label) => typeof label === 'string' && label.trim());
    const keys = [...new Set(labels.map(normalizeQuestionKey))].filter(Boolean);
    if (keys.length !== 1) return null;
    const question = labels[0].replace(/[\s\u00a0]+/gu, ' ').trim();
    return question.length <= 200 ? { question, key: keys[0] } : null;
  };
  // Count every visible occurrence, including fields we cannot fill. A repeated
  // label can refer to a different education/work row and must not be staged.
  for (const field of entries) {
    const label = labelFor(field);
    if (label) counts.set(label.key, (counts.get(label.key) || 0) + 1);
  }
  const supported = new Set(['input', 'textarea', 'select', 'radio',
    'cms_ant_v3_select', 'cmb_ant_v4_select']);
  return entries.flatMap((field) => {
    const label = labelFor(field);
    if (!label || counts.get(label.key) !== 1 || existing.has(label.key)
      || !supported.has(field.kind) || field.hasExistingValue === true
      || String(field.currentValue ?? '').trim()
      || !['unknown_question', 'missing_profile_value'].includes(field.reason)
      || (field.path && !field.path.startsWith('customAnswers.'))) return [];
    return [label.question];
  });
}
