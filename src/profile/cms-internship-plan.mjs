import {normalizeProfile} from './store.js';
import {hash,ownerBindingFor,fullDay,PAGE} from './cms-education-plan.mjs';
export {hash,PAGE};
export const FIELDS=Object.freeze([
  {key:'startDate',question:'开始时间',kind:'date'}, {key:'endDate',question:'结束时间',kind:'date'},
  {key:'organization',question:'企业名称',kind:'text'}, {key:'type',question:'工作性质',kind:'select'},
  {key:'position',question:'职位名称',kind:'text'}, {key:'description',question:'工作描述',kind:'text'}
]);
const stable=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const fail=reason=>{throw Error(reason);};
export async function sourceSnapshot(raw,index){const profile=normalizeProfile(raw),row=profile.experience[index];
  return {profileIndex:index,hash:await hash({domain:'experience',profileIndex:index,row,confirmed:profile.confirmedFields.filter(path=>path.startsWith(`experience.${index}.`)).sort()})};}
export async function createPlan(raw,requests,_supplements=[],ownerBinding=null){
  const profile=normalizeProfile(raw);if(!Array.isArray(requests)||!requests.length||requests.length>30)fail('internship_requests_invalid');
  if(!ownerBinding||stable(await ownerBindingFor(raw,ownerBinding.epoch))!==stable(ownerBinding))fail('internship_owner_profile_changed');
  const indices=new Set(),targets=new Set(),records=[];
  for(const request of requests){const index=request?.profileIndex;
    if(!Number.isInteger(index)||index<0||index>29||indices.has(index)||!profile.experience[index])fail('internship_source_index_invalid_or_duplicate');indices.add(index);
    const target=request.target;if(!target||!['existing','new'].includes(target.mode)||target.mode==='existing'&&(typeof target.identity!=='string'||!target.identity||targets.has(target.identity))||target.mode==='new'&&Object.hasOwn(target,'identity'))fail('internship_target_binding_invalid');
    if(target.mode==='existing')targets.add(target.identity);if(typeof request.replaceExisting!=='boolean')fail('internship_replace_policy_required');
    const source=await sourceSnapshot(raw,index);if(source.hash!==request.sourceSnapshotHash)fail('internship_source_snapshot_changed');
    const row=profile.experience[index],confirmed=new Set(profile.confirmedFields),facts={};
    for(const field of FIELDS){const path=`experience.${index}.${field.key}`,value=row[field.key];
      const hasValue=typeof value==='string'?value.trim().length>0:!!value;
      const isConfirmed=confirmed.has(path);
      let reason=!hasValue?'missing_profile_value':!isConfirmed?'profile_fact_unconfirmed':null;
      if(!reason&&field.kind==='date'&&!fullDay(value))reason='insufficient_date_precision';
      if(!reason&&field.key==='type'&&value!=='internship')reason='internship_type_required';
      if(!reason&&typeof value==='string'&&/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value))reason='invalid_profile_value';
      if(reason){
        const skip={status:'skipped',path,reason,hasProfileValue:hasValue,confirmed:isConfirmed};
        if(hasValue&&typeof value==='string')skip.valuePreview=value.slice(0,80);
        if(hasValue&&field.kind==='date')skip.fullDay=!!fullDay(value);
        facts[field.key]=skip;
      }else facts[field.key]={status:'ready',path,value,optionText:field.key==='type'?'实习':value,confirmed:true};
    }
    if(facts.startDate.status==='ready'&&facts.endDate.status==='ready'&&facts.startDate.value>facts.endDate.value)for(const key of ['startDate','endDate'])facts[key]={status:'skipped',path:facts[key].path,reason:'internship_date_order_invalid'};
    records.push({profileIndex:index,sourceSnapshotHash:source.hash,target:{...target},replaceExisting:request.replaceExisting,facts});
  }
  const plan={version:1,page:PAGE,recordKind:'internship',ownerBinding,records};return {...plan,fingerprint:await hash(plan)};
}
