// Independent owned UI data; integrate only with the normal profile UI/release.
import {normalizeProfile} from './store.js';
import {PAGE,ownerBindingFor,sourceSnapshot,fullDay,sourceMonth} from './cms-education-plan.mjs';
export const SITE_FACTS_KEY='resumeEducationSiteFacts',PROFILE_LIFECYCLE_KEY='resumeProfileLifecycle';
// The shared lifecycle manager owns its changing/ready transition and epoch.
// Clear these data keys through that manager; never independently delete its lock.
export const CLEAR_PROFILE_KEYS=['resumeProfile',SITE_FACTS_KEY];
const FIELDS=['academicDegree','region','startDate','endDate'];
const stable=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const empty=()=>({version:1,entries:[]});
async function currentOwner(raw,binding){if(binding?.version!==1||binding.state==='changing'||typeof binding.epoch!=='string'||typeof binding.profileHash!=='string')throw Error('education_profile_binding_required');
  const expected=await ownerBindingFor(raw,binding.epoch);if(stable(expected)!==stable(binding))throw Error('education_owner_profile_changed');return expected;}
function validValue(field,value,row){
  if(field==='region')return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')==='city,province'&&Object.values(value).every(text=>typeof text==='string'&&text.trim()&&text.length<=160&&!/[\u0000-\u001f]/u.test(text));
  if(typeof value!=='string'||!value.trim()||value.length>160||/[\u0000-\u001f]/u.test(value))return false;
  if(field==='academicDegree')return true;
  return fullDay(value)&&(!row[field]||sourceMonth(row[field])&&value.slice(0,7)===sourceMonth(row[field]));
}
export async function activeSiteFacts(raw,binding,stored){const profile=normalizeProfile(raw),ownerBinding=await currentOwner(raw,binding),entries=stored?.version===1&&Array.isArray(stored.entries)?stored.entries:[],active=[],rejected=[];
  for(const entry of entries){let reason=null;
    if(!entry||entry.sitePageUrl!==PAGE||!Number.isInteger(entry.profileIndex)||entry.profileIndex<0||entry.profileIndex>=profile.education.length||!FIELDS.includes(entry.field))reason='site_fact_scope_invalid';
    else if(stable(entry.ownerBinding)!==stable(ownerBinding))reason='site_fact_owner_changed';
    else if(entry.confirmed!==true||!['manual','resume','import'].includes(entry.origin))reason='site_fact_unconfirmed';
    else if((await sourceSnapshot(profile,entry.profileIndex)).hash!==entry.sourceSnapshotHash)reason='site_fact_record_changed';
    else if(!validValue(entry.field,entry.value,profile.education[entry.profileIndex]))reason='site_fact_value_or_month_invalid';
    if(reason)rejected.push({profileIndex:entry?.profileIndex,field:entry?.field,reason});else active.push(structuredClone(entry));
  }
  // Duplicate entries for the same record and question are never picked first.
  const duplicates=new Set(active.filter((entry,index)=>active.some((other,otherIndex)=>otherIndex!==index&&other.profileIndex===entry.profileIndex&&other.field===entry.field)).map(entry=>`${entry.profileIndex}:${entry.field}`));
  for(const entry of active.filter(entry=>duplicates.has(`${entry.profileIndex}:${entry.field}`)))rejected.push({profileIndex:entry.profileIndex,field:entry.field,reason:'site_fact_duplicate'});
  return {ownerBinding,entries:active.filter(entry=>!duplicates.has(`${entry.profileIndex}:${entry.field}`)),rejected};
}
export async function confirmRecordSiteFacts(raw,binding,profileIndex,draft,stored,{checked=false}={}){
  const profile=normalizeProfile(raw);if(!Number.isInteger(profileIndex)||!profile.education[profileIndex])return {ok:false,reason:'education_record_missing'};
  if(checked!==true)return {ok:false,reason:'education_supplement_confirmation_required'};
  if(!draft||Object.keys(draft).some(key=>!FIELDS.includes(key)))return {ok:false,reason:'education_supplement_fields_invalid'};
  const current=await activeSiteFacts(raw,binding,stored),source=await sourceSnapshot(profile,profileIndex),entries=[];
  for(const field of FIELDS){const value=draft[field];if(value===undefined||value===null||value===''||field==='region'&&value.province===''&&value.city==='')continue;
    if(['startDate','endDate'].includes(field)&&profile.education[profileIndex][field]&&!sourceMonth(profile.education[profileIndex][field]))return {ok:false,reason:'education_source_month_needs_review',field};
    if(!validValue(field,value,profile.education[profileIndex]))return {ok:false,reason:field==='startDate'||field==='endDate'?'education_full_date_must_match_source_month':'education_supplement_value_invalid',field};
    entries.push({sitePageUrl:PAGE,profileIndex,sourceSnapshotHash:source.hash,ownerBinding:current.ownerBinding,field,value:typeof value==='string'?value.trim():{province:value.province.trim(),city:value.city.trim()},confirmed:true,origin:'manual',updatedAt:new Date().toISOString()});
  }
  const dates=Object.fromEntries(entries.filter(entry=>['startDate','endDate'].includes(entry.field)).map(entry=>[entry.field,entry.value]));if(dates.startDate&&dates.endDate&&dates.startDate>dates.endDate)return {ok:false,reason:'education_date_order_invalid'};
  return {ok:true,ownerBinding:current.ownerBinding,sourceSnapshotHash:source.hash,store:{version:1,entries:[...current.entries.filter(entry=>entry.profileIndex!==profileIndex),...entries]},savedFields:entries.map(entry=>entry.field)};
}
export async function createProfileBackup(raw,binding,stored){const profile=normalizeProfile(raw),active=await activeSiteFacts(raw,binding,stored),backupOwner=await ownerBindingFor(profile,binding.epoch);
  return {format:'resumeQuickFillProfileBackup',version:2,profile,profileHash:backupOwner.profileHash,educationSiteFacts:{version:1,ownerBinding:backupOwner,entries:active.entries.map(entry=>({...entry,ownerBinding:backupOwner}))},exportedAt:new Date().toISOString()};}
// Import always establishes a new owned epoch. It never combines the prior
// customer's store with the imported one. The caller atomically replaces the
// profile+epoch+siteFacts keys after preview/confirmation and reports omissions.
export async function restoreProfileBackup(input,newEpoch){
  if(input?.format&&input.format!=='resumeQuickFillProfileBackup'||input?.format==='resumeQuickFillProfileBackup'&&input.version!==2)return {ok:false,reason:'backup_version_or_format_unsupported'};
  if(input?.format!=='resumeQuickFillProfileBackup'){if(!input||typeof input!=='object'||Array.isArray(input)||input.schemaVersion!==1&&!Array.isArray(input.education))return {ok:false,reason:'backup_profile_invalid'};
    const profile=normalizeProfile(input);await ownerBindingFor(profile,newEpoch);return {ok:true,profile,epoch:newEpoch,store:empty(),restoredSiteFacts:0,siteFactsMissing:true,notice:'旧版备份不含招聘网站补充资料，请按需重新填写。'};}
  const profile=normalizeProfile(input.profile),inputOwner=await ownerBindingFor(input.profile,newEpoch),owner=await ownerBindingFor(profile,newEpoch);if(input.profileHash!==inputOwner.profileHash)return {ok:false,reason:'backup_profile_fingerprint_mismatch'};
  const old=input.educationSiteFacts?.ownerBinding;if(!old?.epoch)return {ok:false,reason:'backup_site_fact_owner_missing'};
  const active=await activeSiteFacts(input.profile,await ownerBindingFor(input.profile,old.epoch),input.educationSiteFacts);if(active.ownerBinding.profileHash!==input.profileHash)return {ok:false,reason:'backup_site_fact_owner_mismatch'};
  return {ok:true,profile,epoch:newEpoch,store:{version:1,entries:active.entries.map(entry=>({...entry,ownerBinding:owner}))},restoredSiteFacts:active.entries.length,droppedSiteFacts:active.rejected.length,siteFactsMissing:active.entries.length===0,
    notice:active.rejected.length?'部分补充资料与本次导入的资料不符，已作废，需重新核对。':'本次备份中的已核对补充资料已恢复。'};
}
