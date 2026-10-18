// Isolated CMS education candidate. No canonical product files are changed.
import {educationCandidate} from '../background/education-task-runner.mjs';
import {normalizeProfile} from './store.js';
export const PAGE='https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';
export const FIELDS=Object.freeze([
  {key:'school',question:'学校',sourceKey:'school',kind:'school'},
  {key:'degree',question:'学历',sourceKey:'degree',kind:'select'},
  {key:'academicDegree',question:'学位',kind:'select'},
  {key:'major',question:'专业名称',sourceKey:'major',kind:'text'},
  {key:'startDate',question:'开始时间',sourceKey:'startDate',kind:'date'},
  {key:'endDate',question:'结束时间',sourceKey:'endDate',kind:'date'},
  {key:'region',question:'城市',kind:'region'},
  {key:'gradeRank',question:'专业排名',sourceKey:'gradeRank',kind:'select'},
  {key:'description',question:'专业描述',sourceKey:'majorDescription',kind:'text',optional:true}
]);
const stable=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
export const hash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stable(value))))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
const fail=reason=>{throw Error(reason);};
export async function ownerBindingFor(raw,epoch){if(epoch!=='legacy'&&(typeof epoch!=='string'||!/^[a-f0-9-]{36}$/iu.test(epoch)))fail('education_owner_epoch_invalid');if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('education_owner_profile_invalid');return {version:1,epoch,profileHash:await hash(raw)};}
export function fullDay(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/u.test(value))return false;
  const [year,month,day]=value.split('-').map(Number),date=new Date(Date.UTC(year,month-1,day));return year>=1900&&year<=2100&&date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;}
export function sourceMonth(value){if(typeof value!=='string')return null;if(fullDay(value))return value.slice(0,7);if(!/^\d{4}-\d{2}$/u.test(value))return null;const [year,month]=value.split('-').map(Number);return year>=1900&&year<=2100&&month>=1&&month<=12?value:null;}
function relevantMappings(profile,index){return profile.siteOptionMappings.filter(row=>row.fieldPath.startsWith(`education.${index}.`)&&row.siteUrlPrefix===PAGE);}
export async function sourceSnapshot(profile,index){const p=normalizeProfile(profile),candidate=educationCandidate(p,index);
  const mappingRows=relevantMappings(p,index).map(row=>({row,confirmed:p.siteOptionMappings.some((other,mappingIndex)=>other===row&&p.confirmedFields.includes(`siteOptionMappings.${mappingIndex}.optionText`))}));
  return {profileIndex:index,candidate,hash:await hash({profileIndex:index,row:p.education[index],confirmed:p.confirmedFields.filter(path=>path.startsWith(`education.${index}.`)).sort(),mappings:mappingRows})};}
function mappedOption(profile,sourcePath,sourceValue){const matches=profile.siteOptionMappings.map((row,index)=>({row,index})).filter(({row,index})=>row.siteUrlPrefix===PAGE&&row.fieldPath===sourcePath&&row.sourceValue===sourceValue&&profile.confirmedFields.includes(`siteOptionMappings.${index}.optionText`));
  return matches.length===1?{text:matches[0].row.optionText,path:`siteOptionMappings.${matches[0].index}.optionText`}:matches.length>1?{error:'ambiguous_site_option_mapping'}:null;}
// Per-record supplements are explicit confirmed answers supplied by the owned
// preparation UI. They are tied to this exact source snapshot; they do not come
// from global customAnswers aliases and cannot be reused for another record.
function supplementFor(input,index,sourceHash,key,ownerBinding){const rows=(input||[]).filter(row=>row?.profileIndex===index&&row.field===key);
  if(rows.length>1)return {error:'duplicate_record_supplement'};if(!rows.length)return null;const row=rows[0];
  if(!ownerBinding||stable(row.ownerBinding)!==stable(ownerBinding))return {error:'record_owner_binding_missing_or_stale'};
  if(row.confirmed!==true||row.sitePageUrl!==PAGE||row.sourceSnapshotHash!==sourceHash||!['manual','resume','import'].includes(row.origin))return {error:'record_supplement_unconfirmed_or_stale'};
  const value=key==='region'&&row.value&&typeof row.value==='object'&&!Array.isArray(row.value)?{province:row.value.province,city:row.value.city}:row.value;
  if(key==='region'?Object.keys(row.value||{}).sort().join(',')!=='city,province'||Object.values(value).some(v=>typeof v!=='string'||!v.trim()||v.length>160):typeof value!=='string'||!value.trim()||value.length>4000)return {error:'record_supplement_invalid'};
  return {value:typeof value==='string'?value.trim():value,path:`recordSupplement.${index}.${key}`,origin:row.origin};
}
export async function createPlan(raw,requests,supplements=[],ownerBinding=null){
  const profile=normalizeProfile(raw);if(!Array.isArray(requests)||!requests.length||requests.length>30)fail('education_requests_invalid');
  if(ownerBinding&&stable(await ownerBindingFor(raw,ownerBinding.epoch))!==stable(ownerBinding))fail('education_owner_profile_changed');
  const indices=new Set(),targets=new Set(),records=[];
  for(const request of requests){const index=request?.profileIndex;if(!Number.isInteger(index)||index<0||index>29||indices.has(index))fail('education_source_index_invalid_or_duplicate');indices.add(index);
    const target=request.target;if(!target||!['existing','new'].includes(target.mode)||target.mode==='existing'&&(typeof target.identity!=='string'||!target.identity||targets.has(target.identity))||target.mode==='new'&&Object.hasOwn(target,'identity'))fail('education_target_binding_invalid');
    if(target.mode==='existing')targets.add(target.identity);if(typeof request.replaceExisting!=='boolean')fail('education_replace_policy_required');
    const source=await sourceSnapshot(profile,index);if(request.sourceSnapshotHash!==source.hash)fail('education_source_snapshot_changed');const facts={};
    for(const field of FIELDS){const supplement=supplementFor(supplements,index,source.hash,field.key,ownerBinding),sourcePath=field.sourceKey?`education.${index}.${field.sourceKey}`:null;
      const rawValue=field.sourceKey?profile.education[index]?.[field.sourceKey]:null,sourceValue=field.sourceKey?source.candidate[field.sourceKey]:null;
      if(supplement?.error){facts[field.key]={status:'skipped',reason:supplement.error,path:sourcePath||`recordSupplement.${index}.${field.key}`};continue;}
      // Site supplements can provide exact day precision for a month-only date,
      // and independent academicDegree / region. They never override another
      // confirmed school, degree, major or ranking fact.
      if(supplement&&!['academicDegree','region','startDate','endDate'].includes(field.key))fail('education_supplement_override_forbidden');
      let value=supplement?.value??sourceValue,path=supplement?.path??sourcePath;
      if(!value){facts[field.key]={status:'skipped',reason:rawValue?'profile_fact_unconfirmed':'missing_profile_value',path};continue;}
      if(field.kind==='date'&&!fullDay(value)){facts[field.key]={status:'skipped',reason:'insufficient_date_precision',path};continue;}
      if(field.kind==='date'&&supplement&&rawValue&&!sourceMonth(rawValue)){facts[field.key]={status:'skipped',reason:'education_source_month_needs_review',path};continue;}
      if(field.kind==='date'&&supplement&&rawValue&&!value.startsWith(sourceMonth(rawValue)+'-')){facts[field.key]={status:'skipped',reason:'supplement_month_mismatch',path};continue;}
      if(field.kind==='date'&&supplement&&fullDay(sourceValue)&&sourceValue!==value){facts[field.key]={status:'skipped',reason:'supplement_conflicts_with_confirmed_date',path};continue;}
      // School uses the same confirmed siteOptionMappings path as selects so a
      // catalog spelling that differs from the profile school name can match
      // without guessing. Unmapped school still searches the profile value.
      const mapping=(field.kind==='select'||field.kind==='school')&&sourcePath?mappedOption(profile,sourcePath,value):null;
      facts[field.key]=mapping?.error?{status:'skipped',reason:mapping.error,path}:{status:'ready',path,value,optionText:mapping?.text??value,optionPath:mapping?.path??null,confirmed:true};
    }
    if(facts.startDate.status==='ready'&&facts.endDate.status==='ready'&&facts.startDate.value>facts.endDate.value){for(const key of ['startDate','endDate'])facts[key]={status:'skipped',reason:'education_date_order_invalid',path:facts[key].path};}
    records.push({profileIndex:index,sourceSnapshotHash:source.hash,target:{...target},replaceExisting:request.replaceExisting,facts});
  }
  const plan={version:1,page:PAGE,ownerBinding,records};return {...plan,fingerprint:await hash(plan)};
}
export async function validatePlan(raw,plan,currentEpoch=null){if(plan?.version!==1||plan.page!==PAGE||await hash({...plan,fingerprint:undefined})!==plan.fingerprint)return {ok:false,reason:'education_plan_changed'};
  if(plan.ownerBinding&&(currentEpoch!==plan.ownerBinding.epoch||stable(await ownerBindingFor(raw,currentEpoch))!==stable(plan.ownerBinding)))return {ok:false,reason:'education_owner_profile_changed'};
  for(const record of plan.records)if((await sourceSnapshot(raw,record.profileIndex)).hash!==record.sourceSnapshotHash)return {ok:false,reason:'education_source_snapshot_changed'};
  return {ok:true};}
