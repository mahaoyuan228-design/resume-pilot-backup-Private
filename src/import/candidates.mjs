import { normalizeProfile } from '../profile/store.js';
import { detectWorkRecords, mergeWorkRecord } from './work-records.mjs';
import '../core/matcher.js';

const EDU_KEYS=['school','degree','major','startDate','endDate','majorDescription'];
const EDU_ID=['school','degree','major','startDate','endDate'];
const eduNorm=value=>String(value??'').normalize('NFKC').replace(/[\s\u00a0]+/gu,' ').trim();
const month=value=>{const match=/^((?:19|20)\d{2})[-./年](\d{1,2})月?$/u.exec(eduNorm(value));return match&&Number(match[2])>=1&&Number(match[2])<=12?`${match[1]}-${match[2].padStart(2,'0')}`:null;};
const eduHeading=/^(?:教育经历|教育背景|学习经历|Education)(?:\s*(?:第?\s*[一二三四五六七八九十\d]+\s*(?:段|条)?))?\s*[:：]?$/iu;
const nextSection=/^(?:工作经历|工作经验|工作与实习经历|工作与实习|正式工作经历|实习经历|实习经验|项目经历|项目经验|研究经历|求职意向|职业技能与特长|职业技能|技能|语言能力|证书|获奖经历|获奖情况|荣誉奖项|自我评价|家庭成员|Experience|Projects|Skills)(?=\s|[:：()（）\d一二三四五六七八九十]|$)/iu;
const eduField=/^(学校|毕业院校|就读学校|学历|学位|专业|所学专业|就读专业|开始年月|入学年月|开始时间|入学时间|结束年月|毕业年月|结束时间|毕业时间|离校时间|在校时间|起止年月|就读状态|毕业状态|就读情况)\s*[:：]\s*(.+)$/u;
const splitLabels=/(?:\s+|\s*[;；|｜]\s*)(?=(?:学校|毕业院校|就读学校|学历|学位|专业|所学专业|就读专业|开始年月|入学年月|开始时间|入学时间|结束年月|毕业年月|结束时间|毕业时间|离校时间|在校时间|起止年月|就读状态|毕业状态|就读情况)\s*[:：])/u;
const fieldKey=label=>/学校|院校/u.test(label)?'school':label==='学历'?'degree':/专业/u.test(label)?'major':/开始|入学/u.test(label)?'startDate':/结束|毕业年月|毕业时间|离校/u.test(label)?'endDate':/在校时间|起止年月/u.test(label)?'range':/就读状态|毕业状态|就读情况/u.test(label)?'status':null;
const rangePattern=/^((?:19|20)\d{2}[-./年]\d{1,2}月?)\s*(?:至|到|~|～|—|–|-)\s*((?:19|20)\d{2}[-./年]\d{1,2}月?)$/u;

// A whole education record is one selectable candidate. A missing/conflicting
// field is never borrowed from another school or from a global education.0.
export function detectEducationRecords(text){
 const candidates=[],warnings=[],blocks=[];let inside=false,current=null,seenSection=false;
 const close=()=>{if(current){blocks.push(current);current=null;}};
 for(const raw of String(text||'').replace(/\r\n?/gu,'\n').split('\n')){
  const line=eduNorm(raw);if(!line)continue;
  if(eduHeading.test(line)){close();inside=true;seenSection=true;continue;}
  if(nextSection.test(line)){close();inside=false;continue;}
  if(!inside)continue;
  if(/^(?:第\s*[一二三四五六七八九十\d]+\s*段|[一二三四五六七八九十\d]+[.、])$/u.test(line)){close();continue;}
  for(const fragment of line.split(splitLabels)){
   const match=fragment.match(eduField);if(!match)continue;const label=match[1],value=eduNorm(match[2]),key=fieldKey(label);
   if(key==='school'){close();current={fields:{school:[value]},evidence:[],status:[],ambiguous:false};}
   if(!current){warnings.push('教育字段出现在明确学校之前，未与后续学校拼接；请手动核对。');continue;}
   current.evidence.push(fragment);
   if(/未毕业|未完成|肄业|转学/u.test(fragment))current.status.push(fragment);
   if(!key){current.ambiguous=true;continue;}
   if(key==='status'){current.status.push(fragment);continue;}
   if(key==='school')continue;
   if(key==='range'){
    const range=value.match(rangePattern);if(!range){current.ambiguous=true;continue;}
    for(const [field,v]of [['startDate',month(range[1])],['endDate',month(range[2])]]){if(!v)current.ambiguous=true;else(current.fields[field]||=[]).push(v);}continue;
   }
   const parsed=['startDate','endDate'].includes(key)?month(value):value;
   if(!parsed||/[：:]/u.test(parsed)){current.ambiguous=true;continue;}(current.fields[key]||=[]).push(parsed);
  }
 }
 close();const signatures=new Set();
 for(const [index,block]of blocks.entries()){
  const number=index+1,values=Object.fromEntries(Object.entries(block.fields).map(([key,list])=>[key,[...new Set(list)]]));
  const reason=block.ambiguous?'存在未识别或不明确的字段/年月':EDU_ID.some(key=>values[key]?.length!==1)?'必需的学校、学历、专业或起止年月缺失/冲突':null;
  if(reason){warnings.push(`教育第${number}段${values.school?.[0]?`（${values.school[0]}）`:''}${reason}，未自动组成教育记录。`);continue;}
  const row=Object.fromEntries(EDU_ID.map(key=>[key,values[key][0]])),status=[...new Set(block.status)];
  if(row.startDate>row.endDate){warnings.push(`教育第${number}段开始年月晚于结束年月，未导入候选。`);continue;}
  const incomplete=status.some(value=>/未毕业|未完成|肄业/u.test(value));
  if(status.some(value=>/转学/u.test(value))&&!incomplete){warnings.push(`教育第${number}段提到转学但毕业状态不明确，未推断取得学历；请手动登记。`);continue;}
  const degreeText=row.degree;
  if(incomplete){row.degree='';row.majorDescription=`简历明确状态原文：${status.join('；')}`;warnings.push(`教育第${number}段明确未毕业/未完成，候选保留就读记录和原文状态，学历留空待核对。`);}
  if(row.school.length>100||row.major.length>100||degreeText.length>40||row.majorDescription?.length>2000){warnings.push(`教育第${number}段字段超过可导入长度，已留给手动核对。`);continue;}
  const signature=JSON.stringify(EDU_ID.map(key=>eduNorm(row[key])));if(signatures.has(signature)){warnings.push(`教育第${number}段与前段完全相同，未生成重复候选。`);continue;}signatures.add(signature);
  const context=`第${number}段 · ${row.school} · ${degreeText} · ${row.startDate}—${row.endDate}`;
  candidates.push({path:'educationRecord',label:`教育经历${context}${incomplete?'（未毕业，学历留空）':''}`,value:`${row.school} · ${incomplete?'未毕业/未完成，学历待核对':row.degree} · ${row.major} · ${row.startDate}—${row.endDate}`,educationRecord:row,evidence:block.evidence.join('；').slice(0,500),basis:'同一明确教育段内的学校、学历、专业和起止年月标签'});
 }
 if(!seenSection){
  const beforeOther=String(text||'').replace(/\r\n?/gu,'\n').split('\n').map(eduNorm).filter(Boolean);let stopAt=beforeOther.findIndex(line=>nextSection.test(line)&&!/^求职意向\s*[:：]\s*\S/u.test(line));if(stopAt<0)stopAt=beforeOther.length;
  const lines=beforeOther.slice(0,stopAt),matches={school:[],degree:[],major:[]};
  for(const line of lines)for(const fragment of line.split(splitLabels)){const match=/^(学校|毕业院校|就读学校|学历|最高学历|专业|所学专业|就读专业)\s*[:：]\s*(.+)$/u.exec(fragment);if(!match)continue;const key=/学校|院校/u.test(match[1])?'school':/学历/u.test(match[1])?'degree':'major';matches[key].push(eduNorm(match[2]));}
  const ambiguous=matches.school.length!==1||Object.values(matches).some(values=>new Set(values).size>1)||lines.some(line=>/未毕业|未完成|肄业|转学/u.test(line));
  if(matches.school.length&&!ambiguous){const row={school:matches.school[0],degree:matches.degree[0]||'',major:matches.major[0]||'',startDate:'',endDate:''};
   if(row.school.length<=100&&row.degree.length<=40&&row.major.length<=100&&!Object.values(row).some(value=>/[：:]/u.test(value))){candidates.push({path:'educationRecord',label:`教育经历第1段 · ${row.school} · ${row.degree||'学历待补充'}（唯一标签，日期待补充）`,value:[row.school,row.degree,row.major].filter(Boolean).join(' · '),educationRecord:row,legacySingleLabels:true,evidence:lines.filter(line=>/学校|院校|学历|专业/u.test(line)).join('；').slice(0,500),basis:'无教育分区但仅一所明确学校的原单段标签格式'});warnings.push('保留唯一学校的单段标签提取；没有起止年月，日期仍为空并需核对。');}
  }else if(matches.school.length)warnings.push('无明确教育分区且学校重复、字段冲突或毕业状态不明，未全局拼接教育经历；请手动登记。');
 }
 return {candidates,warnings};
}
const normalizedRecord=row=>Object.fromEntries(EDU_ID.map(key=>[key,eduNorm(row?.[key])]));
const dateCompatible=(a,b)=>!a||!b||!/^\d{4}[-./]\d{2}/u.test(a)||!/^\d{4}[-./]\d{2}/u.test(b)||a.slice(0,7).replace(/[./]/gu,'-')===b.slice(0,7).replace(/[./]/gu,'-');
function validEducationCandidate(candidate){
 const row=candidate?.educationRecord;if(!row||Array.isArray(row)||Object.keys(row).some(key=>!EDU_KEYS.includes(key))||EDU_ID.some(key=>typeof row[key]!=='string')||Object.values(row).some(value=>typeof value!=='string'||/[\u0000-\u001f]/u.test(value)))return false;
 if(candidate.legacySingleLabels===true)return !!row.school.trim()&&row.school.length<=100&&row.major.length<=100&&row.degree.length<=40&&row.startDate===''&&row.endDate===''&&!row.majorDescription&&!/未毕业|未完成|肄业|转学/u.test(Object.values(row).join(' '));
 if(!row.school.trim()||!row.major.trim()||row.school.length>100||row.major.length>100||row.degree.length>40||!month(row.startDate)||!month(row.endDate)||row.startDate>row.endDate||row.majorDescription?.length>2000)return false;
 if(row.degree&&/未毕业|未完成|肄业|转学/u.test(row.degree+' '+(row.majorDescription||'')))return false;
 // Only an explicit original incomplete status can justify a blank degree.
 if(!row.degree.trim()&&!(typeof row.majorDescription==='string'&&/^简历明确状态原文：/u.test(row.majorDescription)&&/未毕业|未完成|肄业/u.test(row.majorDescription)))return false;
 return true;
}
function mergeEducationRecord(profile,candidate,added,conflicts){
 const conflict=reason=>conflicts.push({path:'educationRecord',label:candidate?.label||'教育经历',current:'已有教育保持原样',incoming:typeof candidate?.value==='string'?candidate.value.slice(0,200):'',reason});
 if(!validEducationCandidate(candidate)){conflict('education_candidate_invalid');return;}
 const incoming=Object.fromEntries(Object.entries(candidate.educationRecord).map(([key,value])=>[key,eduNorm(value)])),identity=normalizedRecord(incoming);
 if(profile.education.some(row=>EDU_ID.every(key=>normalizedRecord(row)[key]===identity[key])))return;
 const possible=profile.education.some(row=>{const old=normalizedRecord(row);return old.school&&old.school===identity.school&&(!old.degree||!identity.degree||old.degree===identity.degree)&&dateCompatible(old.startDate,identity.startDate)&&dateCompatible(old.endDate,identity.endDate);});
 if(possible){conflict('education_existing_record_ambiguous');return;}
 if(profile.education.length>=30){conflict('education_record_limit');return;}
 const index=profile.education.length;profile.education.push(incoming);
 for(const [key,value]of Object.entries(incoming)){if(!value)continue;const path=`education.${index}.${key}`;profile.confirmedFields=profile.confirmedFields.filter(field=>field!==path);profile.sources[path]='resume';added.push(path);}
}

const LABELS = [
  { key: 'fullName', path: 'fullName', label: '姓名', valid: (v) => /^(?:[\p{Script=Han}·]{2,12}|[A-Za-z][A-Za-z .'-]{1,59})$/u.test(v) },
  { key: 'desiredRoles', path: 'desiredRoles.0', label: '求职岗位', valid: (v) => v.length <= 80 && !/[、,，;；/]/.test(v) },
  { key: 'desiredCities', path: 'desiredCities.0', label: '期望城市', valid: (v) => v.length <= 40 && !/[、,，;；/]/.test(v) }
];

// Keep the two historical import labels; all other aliases and field meanings
// come from the engine's shared resolver, without a hostname or inferred ID.
const IMPORT_LABELS = new Map([['name', '姓名'], ['求职意向', '期望岗位']]);
const matcher = globalThis.ResumeMatcher;
const inlineLabels = [...Object.values(matcher.definitions).flat(), ...IMPORT_LABELS.keys(), 'Email'];
const inlineFields = new RegExp(`\\s+(?=(?:${inlineLabels.map(label => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s*[:：])`, 'i');

function cleanValue(value) {
  return value.replace(/[\s\u00a0]+/g, ' ').replace(/[。；;，,]+$/, '').trim();
}

function uniqueMatches(text, pattern) {
  return [...new Set((text.match(pattern) || []).map((value) => value.trim()))];
}

export function detectResumeCandidates(text) {
  const candidates = [];
  const warnings = [];
  // Split explicit inline labels before resolving so contacts stay separate
  // and conflicting aliases on one line cannot silently hide each other.
  let section = '';
  const fields = String(text || '').replace(/\r\n?/g, '\n').split('\n').flatMap((raw) => {
    const line = raw.trim(), heading = line.replace(/[:：]\s*$/u, '');
    if (!/[:：]/u.test(heading) && (matcher.sectionKind(heading) || eduHeading.test(heading) || nextSection.test(heading))) {
      section = heading;
      return [];
    }
    return line.split(inlineFields).flatMap((fragment) => {
      const match = fragment.trim().match(/^([^:：]+)\s*[:：]\s*(.+)$/u);
      if (!match) return [];
      const label = IMPORT_LABELS.get(matcher.normalize(match[1])) || match[1];
      return [{ mapped: matcher.resolveField({ labels: [label], section }), value: cleanValue(match[2]), evidence: fragment.slice(0, 180) }];
    });
  });
  for (const rule of LABELS) {
    const matches = fields.flatMap(({ mapped, value, evidence }) => {
      if (mapped.status !== 'mapped' || mapped.profileKey !== rule.key) return [];
      return rule.valid(value) ? [{ value, evidence }] : [];
    });
    const unique = [...new Set(matches.map((match) => match.value))];
    if (unique.length === 1) {
      candidates.push({ path: rule.path, label: rule.label, value: unique[0], evidence: matches[0].evidence, basis: '简历中的明确字段标签' });
    } else if (unique.length > 1) {
      warnings.push(`“${rule.label}”在简历中出现多个不同值，已留给你手动核对。`);
    }
  }

  const emails = uniqueMatches(String(text || ''), /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi);
  if (emails.length === 1) {
    candidates.push({ path: 'email', label: '邮箱', value: emails[0], evidence: emails[0], basis: '全文唯一邮箱地址' });
  } else if (emails.length > 1) warnings.push('发现多个邮箱地址；请手动选择用于投递的邮箱。');

  const phoneMatches = [...String(text || '').matchAll(/(?<!\d)1[3-9]\d(?:[\s-]?\d){8}(?!\d)/g)];
  const phones = [...new Set(phoneMatches.map((match) => match[0].replace(/[\s-]/g, '')))];
  if (phones.length === 1) {
    candidates.push({ path: 'phone', label: '手机号', value: phones[0], evidence: phoneMatches[0][0], basis: '全文唯一中国大陆手机号' });
  } else if (phones.length > 1) warnings.push('发现多个手机号；请手动选择用于投递的号码。');

  const education = detectEducationRecords(text);
  candidates.push(...education.candidates);warnings.push(...education.warnings);
  const work = detectWorkRecords(text); candidates.push(...work.candidates); warnings.push(...work.warnings);
  return { candidates, warnings };
}

const ALLOWED_PATHS = new Set(['fullName', 'email', 'phone', 'desiredRoles.0', 'desiredCities.0', 'education.0.school', 'education.0.degree', 'education.0.major']);

function getPath(profile, path) {
  const [first, second, third] = path.split('.');
  if (second === undefined) return profile[first];
  if (third === undefined) return profile[first]?.[Number(second)];
  return profile[first]?.[Number(second)]?.[third];
}

function setPath(profile, path, value) {
  const [first, second, third] = path.split('.');
  if (second === undefined) profile[first] = value;
  else if (third === undefined) profile[first][Number(second)] = value;
  else {
    profile[first][Number(second)] ||= {};
    profile[first][Number(second)][third] = value;
  }
}

// Import only into empty fields. Even after a user selects a candidate, it remains
// unconfirmed and cannot be used by the fill engine until reviewed in the profile.
export function mergeResumeCandidates(profileInput, selectedCandidates) {
  const profile = normalizeProfile(profileInput);
  const added = [];
  const conflicts = [];
  // Compatibility for the old internal scalar-call contract only. The normal
  // detector now emits atomic records. An old caller can create an empty first
  // record when its same selection includes one explicit school; it cannot
  // attach a new major/degree to an existing person's education by index.
  const initiallyEmptyEducation=profile.education.length===0;
  let legacyOwnsNewRow=false;
  const legacySchools=[...new Set((selectedCandidates||[]).filter(row=>row?.path==='education.0.school'&&typeof row.value==='string'&&row.value.trim()&&row.value.trim().length<=100&&!/[\u0000-\u001f]/u.test(row.value)).map(row=>row.value.trim()))];
  for (const candidate of selectedCandidates || []) {
    if(candidate?.path==='experienceRecord'){mergeWorkRecord(profile,candidate,added,conflicts);continue;}
    if(candidate?.path==='educationRecord'){mergeEducationRecord(profile,candidate,added,conflicts);continue;}
    const path = candidate?.path;
    const value = typeof candidate?.value === 'string' ? candidate.value.trim() : '';
    if (!ALLOWED_PATHS.has(path) || !value || value.length > 200) continue;
    if(path.startsWith('education.')){
      const key=path.split('.')[2],limit=key==='degree'?40:100;
      if(value.length>limit||/[\u0000-\u001f]/u.test(value))continue;
      if(initiallyEmptyEducation&&legacySchools.length===1&&!legacyOwnsNewRow&&profile.education.length===0){profile.education.push({});legacyOwnsNewRow=true;}
      if(!legacyOwnsNewRow){
        if(getPath(profile,path)===value)continue;
        conflicts.push({path,label:candidate.label||path,current:getPath(profile,path)||'',incoming:value,reason:'education_existing_record_ambiguous'});continue;
      }
    }
    const current = getPath(profile, path);
    if (current && current !== value) {
      conflicts.push({ path, label: candidate.label || path, current, incoming: value });
      continue;
    }
    if (current === value) continue;
    setPath(profile, path, value);
    profile.confirmedFields = profile.confirmedFields.filter((field) => field !== path);
    profile.sources[path] = 'resume';
    added.push(path);
  }
  return { profile: normalizeProfile(profile), added, conflicts };
}

