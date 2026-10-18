// Education FULL only. Popup lifetime does not own preparation or writing.
import {normalizeProfile} from '../profile/store.js';
import {beginRecentRequest,saveRecentResult} from '../popup/recent-result.js';
import {captureProfileBinding,assertProfileBinding,canonicalProfileHash,commitBoundJob,
  dispatchBoundSource,withProfileBinding,invalidateBoundJob,reserveBoundJob} from '../profile/profile-lifecycle.js';

export const EDUCATION_PAGE='https://hr.gtht.com/resume/edit/';
export const EDUCATION_FIELDS=[['毕业学校','school'],['专业名称','major'],['在校活动/职务','campusActivities'],
  ['在校成绩排名','gradeRank'],['专业描述','majorDescription'],['绩点','gpa'],['学校所在地','schoolLocation'],
  ['是否统招','unifiedAdmissions'],['学历','degree'],['在校时间（开始）','startDate'],
  ['在校时间（结束）','endDate'],['专业类别','majorCategory']];
export const educationJobKey=tabId=>`resumeEducationJob:${tabId}`;
const pendingKey=tabId=>`resumePendingFillReview:${tabId}`;
const origin=new URL(EDUCATION_PAGE).origin;
const stable=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)
  ?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const code=reason=>{throw Error(reason);};
const safeCode=value=>typeof value==='string'&&/^[a-z_]{2,80}$/u.test(value)?value:'education_job_failed';
export function educationCandidate(input,profileIndex) {
  if(!Number.isInteger(profileIndex)||profileIndex<0||profileIndex>29)code('education_source_index_invalid');
  const profile=normalizeProfile(input),row=profile.education[profileIndex],confirmed=new Set(profile.confirmedFields);
  if(!row)code('education_source_record_missing');
  const candidate={profileIndex,school:'',major:'',confirmedPaths:[]};
  for(const [,key] of EDUCATION_FIELDS) {
    const path=`education.${profileIndex}.${key}`;
    if(!confirmed.has(path)||typeof row[key]!=='string'||!row[key].trim())continue;
    if(/[\u0000-\u001f]/u.test(row[key])&&!['campusActivities','majorDescription'].includes(key))code('education_source_invalid');
    candidate[key]=row[key];if(!candidate.confirmedPaths.includes(path))candidate.confirmedPaths.push(path);
  }
  return candidate;
}
function validFields(response,profileIndex) {
  return response?.ok===true&&response.editorLeftOpen===true&&response.savedOnSite===null&&response.submitted===null
    &&response.softwareClickedSave===false&&response.softwareClickedSubmit===false&&response.softwareClickedDelete===false
    &&Array.isArray(response.fields)&&response.fields.length===12&&EDUCATION_FIELDS.every(([question,key])=>{
      const matches=response.fields.filter(field=>field.question===question&&field.path===`education.${profileIndex}.${key}`);
      return matches.length===1&&(matches[0].status==='verified'
        ?['readback_matched','readback_reapplied','preexisting_same_value'].includes(matches[0].reason)
        :matches[0].status==='skipped'&&(['missing_profile_value','profile_fact_unconfirmed','control_not_supported','existing_value'].includes(matches[0].reason)
          ||['startDate','endDate'].includes(key)&&matches[0].reason==='incomplete_date_pair'
          ||key==='degree'&&matches[0].reason==='site_control_disabled'
          ||key==='majorCategory'&&['education_category_structure_changed','education_category_existing_selection_unknown','education_category_overwrite_guard'].includes(matches[0].reason)));
    });
}
function diagnostics(response) {
  return {reason:safeCode(response?.reason),
    activeField:EDUCATION_FIELDS.some(([,key])=>key===response?.activeField)?response.activeField:null,
    selectorStep:typeof response?.selectorStep==='string'&&/^(?:category|month|degree|field|request|target|row|editor|text|radio|page)_[a-z_]{2,40}$/u.test(response.selectorStep)
      ?response.selectorStep:null};
}

export function createEducationTaskRunner({api=globalThis.chrome,verifyBeforeFill=null,timeoutMs=45000,keepAliveMs=15000,lifecycleOptions={}}={}) {
  const running=new Map();
  const bounded=(operation,ms=timeoutMs)=>new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('education_job_timeout')),ms);
    Promise.resolve().then(operation).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
  });
  const get=async key=>(await api.storage.local.get(key))[key];
  const matchingPending=async tabId=>{
    const current=await get(pendingKey(tabId)),legacy=await get('resumePendingFillReview');
    return current||legacy?.tabId===tabId&&legacy.origin===origin?current||legacy:null;
  };
  const clearExact=async(tabId,requestId)=>{
    const current=await get(pendingKey(tabId));
    if(current?.requestId===requestId&&current.tabId===tabId&&current.origin===origin)
      await api.storage.local.remove(pendingKey(tabId));
  };
  const exactTab=async tabId=>{
    const tab=await api.tabs.get(tabId),active=await api.tabs.query({active:true,lastFocusedWindow:true});
    if(tab?.id!==tabId||tab.url!==EDUCATION_PAGE||active.length!==1||active[0].id!==tabId||active[0].url!==EDUCATION_PAGE)
      code('education_job_tab_changed');return tab;
  };
  async function execute(message,requestId,sendAccepted) {
    const {tabId,rowIndex,profileIndex,replaceExisting}=message,targetMode=message.targetMode??'existing',key=educationJobKey(tabId);
    let sent=false,reserved=false,licenseCode=null,binding=message.profileBinding,jobReserved=false,priorJob,job={tabId,origin,requestId,rowIndex:targetMode==='new'?null:rowIndex,profileIndex,replaceExisting,targetMode,
      kind:'gth_education_full_trial',at:Date.now(),state:'queued',complete:false};
    // Extension API activity keeps an in-flight job alive when the popup's
    // response port disappears. A browser/worker crash remains pending/unknown.
    const keepAlive=setInterval(()=>{api.storage.local.get(key).catch(()=>{});},keepAliveMs);
    const save=async patch=>{job={...job,...patch,profileBinding:binding};
      if(jobReserved)await commitBoundJob(api.storage.local,key,job,binding,lifecycleOptions);
      else {await reserveBoundJob(api.storage.local,key,job,binding,priorJob,lifecycleOptions);jobReserved=true;}};
    try {
      await assertProfileBinding(api.storage.local,binding,lifecycleOptions);
      if(await matchingPending(tabId))code('education_job_pending_review');
      const prior=priorJob=await get(key);
      const basicJob=await get(`resumeBasicJob:${tabId}`);
      if([prior,basicJob].some(record=>record&&['queued','running','unknown'].includes(record.state)))code('education_job_pending_review');
      await save({});sendAccepted({ok:true,accepted:true,requestId});
      const paid=api.runtime.getManifest?.().background?.service_worker==='src/license/guard-worker.mjs';
      if(paid&&typeof verifyBeforeFill!=='function')code('license_required');
      if(typeof verifyBeforeFill==='function') {
        try {await bounded(verifyBeforeFill,15000);} catch(error) {
          if(['NOT_ACTIVATED','LICENSE_REVOKED','LICENSE_EXPIRED','DEVICE_REVOKED','SERVER_UNAVAILABLE'].includes(error?.code))licenseCode=error.code;
          code('license_required');
        }
      }
      const tab=await exactTab(tabId),raw=await get('resumeProfile'),candidate=educationCandidate(raw,profileIndex);
      await assertProfileBinding(api.storage.local,binding,lifecycleOptions);
      if(await canonicalProfileHash(raw,lifecycleOptions.cryptoImpl)!==binding.profileHash)code('profile_binding_changed');
      job.profileBinding=binding;
      if(stable(candidate)!==stable(message.candidateSnapshot))code('education_job_profile_changed');
      const trusted=await get('resumeTrustedOrigins');
      if(!Array.isArray(trusted)||!trusted.includes(origin)) {
        if(message.originConfirmed!==true)code('education_job_origin_unconfirmed');
        await withProfileBinding(api.storage.local,binding,()=>api.storage.local.set({resumeTrustedOrigins:[...(Array.isArray(trusted)?trusted:[]),origin].slice(-100)}),lifecycleOptions);
      }
      if(await matchingPending(tabId))code('education_job_pending_review');
      await withProfileBinding(api.storage.local,binding,async()=>{
        await api.storage.local.set({[pendingKey(tabId)]:{tabId,origin,at:Date.now(),requestId,
          kind:'gth_education_full_trial',rowIndex:targetMode==='new'?null:rowIndex,targetMode,profileBinding:binding}});
        await beginRecentRequest(tab,requestId);
      },lifecycleOptions);reserved=true;await save({state:'running'});
      await bounded(()=>dispatchBoundSource(api.storage.local,binding,()=>api.scripting.executeScript({target:{tabId},files:['src/content/gth-education.js']}),lifecycleOptions),15000);
      await exactTab(tabId);
      if(stable(educationCandidate(await get('resumeProfile'),profileIndex))!==stable(candidate))code('education_job_profile_changed');
      if((await get(pendingKey(tabId)))?.requestId!==requestId)code('education_job_pending_changed');
      sent=true;
      const response=await bounded(()=>dispatchBoundSource(api.storage.local,binding,()=>api.tabs.sendMessage(tabId,{type:'GTH_EDUCATION_FULL_TRIAL',requestId,rowIndex:targetMode==='new'?null:rowIndex,targetMode,
        profileIndex,replaceExisting,educationCandidates:[candidate],profileBinding:binding}),lifecycleOptions));
      await assertProfileBinding(api.storage.local,binding,lifecycleOptions);
      const status=await bounded(()=>api.tabs.sendMessage(tabId,{type:'GTH_EDUCATION_FULL_TRIAL_STATUS',requestId}),15000);
      const outcome=status?.ok===true&&status.data?.requestId===requestId&&status.data.state==='settled'
        ?status.data.outcome:'unknown';
      if(!validFields(response,profileIndex)||(response.targetMode??'existing')!==targetMode
        ||targetMode==='new'&&(response.provisionalNewRecord!==true||response.rowIndex!==null
          ||response.addClickCount!==1||status?.data?.recordMarker!=='new'||status?.data?.profileIndex!==profileIndex)) {
        if(response?.writeStarted===false&&outcome==='failed_before_write') {
          await save({state:'stopped_before_write',...diagnostics(response)});
          await withProfileBinding(api.storage.local,binding,()=>saveRecentResult(tab,requestId,'gth_education_full_trial',[],'stopped_before_write'),lifecycleOptions);
          await withProfileBinding(api.storage.local,binding,()=>clearExact(tabId,requestId),lifecycleOptions);return;
        }
        await save({state:'unknown',...diagnostics(response)});return;
      }
      // Only public question/path/status/reason are persisted, never answers,
      // applicant values or the profile snapshot passed in the start message.
      const fields=response.fields.map(({question,path,status,reason})=>({question,path,status,reason}));
      if(!['verified','verified_preexisting','failed_before_write'].includes(outcome)) {
        await save({state:'unknown',...diagnostics(status?.data),fields});return;
      }
      if(outcome==='failed_before_write'&&response.writeStarted!==false) {
        await save({state:'unknown',reason:'education_job_status_inconsistent',fields});return;
      }
      const complete=response.complete===true&&fields.every(field=>field.status==='verified');
      await withProfileBinding(api.storage.local,binding,()=>saveRecentResult(tab,requestId,'gth_education_full_trial',outcome==='failed_before_write'?[]:fields,
        outcome==='failed_before_write'?'stopped_before_write':'readback_complete'),lifecycleOptions);
      await save({state:outcome==='failed_before_write'?'stopped_before_write':'completed',complete,fields,
        outcome,recordMarker:targetMode==='new'?'new':String(rowIndex),provisionalNewRecord:targetMode==='new',counts:{newlyFilled:fields.filter(field=>field.reason==='readback_matched').length,
          reapplied:fields.filter(field=>field.reason==='readback_reapplied').length,
          originalSame:fields.filter(field=>field.reason==='preexisting_same_value').length}});
      await withProfileBinding(api.storage.local,binding,()=>clearExact(tabId,requestId),lifecycleOptions);
    } catch(error) {
      const reason=safeCode(error?.message);
      if(binding&&reason.startsWith('profile_')){
        await invalidateBoundJob(api.storage.local,key,job,{...lifecycleOptions,writeMayHaveStarted:sent});
        sendAccepted({ok:false,error:reason,requestId,writeStarted:sent});return;
      }
      if(!sent&&reserved)await clearExact(tabId,requestId);
      // Do not replace an older unknown job or someone else's pending lock.
      if((await get(key))?.requestId===requestId)await save({state:sent?'unknown':'stopped_before_write',reason,...(licenseCode?{licenseCode}:{})});
      sendAccepted({ok:false,error:reason,requestId,writeStarted:sent});
    } finally {clearInterval(keepAlive);running.delete(tabId);}
  }
  const listener=(message,sender,sendResponse)=>{
    if(!['GTH_EDUCATION_FULL_JOB_START','GTH_EDUCATION_FULL_JOB_STATUS'].includes(message?.type))return false;
    const own=sender?.id===api.runtime.id&&sender.url===api.runtime.getURL('src/popup/popup.html')&&!sender.tab;
    if(!own){sendResponse({ok:false,error:'wrong_sender'});return false;}
    if(!Number.isSafeInteger(message.tabId)||message.tabId<0){sendResponse({ok:false,error:'education_job_invalid'});return false;}
    if(message.type==='GTH_EDUCATION_FULL_JOB_STATUS') {
      get(educationJobKey(message.tabId)).then(async data=>{if(data?.profileBinding)await assertProfileBinding(api.storage.local,data.profileBinding,lifecycleOptions);else if(data)throw Error('profile_binding_required');sendResponse({ok:true,data:data||null});}).catch(()=>sendResponse({ok:false,error:'profile_binding_changed'}));return true;
    }
    const targetMode=message.targetMode??'existing';
    if(message.pageUrl!==EDUCATION_PAGE||!['existing','new'].includes(targetMode)
      ||targetMode==='new'&&message.rowIndex!=null
      ||targetMode==='existing'&&(!Number.isInteger(message.rowIndex)||message.rowIndex<0||message.rowIndex>29)||!Number.isInteger(message.profileIndex)
      ||message.profileIndex<0||message.profileIndex>29||typeof message.replaceExisting!=='boolean'
      ||!message.candidateSnapshot||stable(message.candidateSnapshot).length>20000) {
      sendResponse({ok:false,error:'education_job_invalid'});return false;
    }
    if(running.has(message.tabId)){sendResponse({ok:false,error:'education_job_in_progress',requestId:running.get(message.tabId).requestId});return false;}
    const requestId=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const slot={requestId,promise:null};running.set(message.tabId,slot);
    let responded=false;const respond=value=>{if(!responded){responded=true;try{sendResponse(value);}catch{/* Popup closed. */}}};
    slot.promise=execute(message,requestId,respond).catch(()=>{running.delete(message.tabId);respond({ok:false,error:'education_job_failed',requestId});});
    return true;
  };
  return {listener,waitForIdle:async()=>{await Promise.all([...running.values()].map(slot=>slot.promise));}};
}
export function installEducationTaskRunner(options={}) {
  const runner=createEducationTaskRunner(options);(options.api||globalThis.chrome).runtime.onMessage.addListener(runner.listener);return runner;
}
