// GTH basic candidates. Account-owned contacts may be site-read-only.
// Preparation and writing belong to the worker. The content trial can attempt
// 现居住地 through its evidenced province-branch eo-cascader path. The planner
// permits that trial only for a unique confirmed plain label; city/district
// pairs and 照片 remain unsupported. It does not look up DOM, fill, Save, or
// submit, and it does not claim site support.
import {normalizeProfile} from '../profile/store.js';
import {assertProfileBinding,canonicalProfileHash,commitBoundJob,reserveBoundJob,dispatchBoundSource,withProfileBinding,invalidateBoundJob} from '../profile/profile-lifecycle.js';
import {beginRecentRequest,saveRecentResult} from '../popup/recent-result.js';
import {requireAutoFormReady,autoFormReadinessFailure} from './auto-form-readiness.mjs';

export const BASIC_PAGE='https://hr.gtht.com/resume/edit/';
export const BASIC_KIND='gth_basic_trial';
export const BASIC_FIELDS=[['姓名','fullName'],['性别','gender'],['手机号码','phone'],
  ['出生年月','birthDate'],['电子邮件','email'],['最高学历','degree'],['参加工作时间','workStart']];
export const BASIC_COVERAGE=[...BASIC_FIELDS.slice(0,5),['现居住地','currentCity'],BASIC_FIELDS[5],
  ['照片','photo'],['参加工作时间','workStart']];
export const basicJobKey=tabId=>`resumeBasicJob:${tabId}`;
const pendingKey=tabId=>`resumePendingFillReview:${tabId}`;
const origin=new URL(BASIC_PAGE).origin;
const verified=['readback_matched','readback_reapplied','preexisting_same_value'];
const skipped=['missing_profile_value','profile_fact_unconfirmed','invalid_profile_value','existing_value'];
const readOnlyStates=['same','different','empty','source_unavailable'];
const isReadOnly=(row,key)=>['phone','email'].includes(key)&&row?.status==='skipped'
  &&row.reason==='site_readonly'&&readOnlyStates.includes(row.readOnlyState);
const validRow=(row,key)=>row&&(row.status==='verified'?verified.includes(row.reason)
  :row.status==='skipped'&&skipped.includes(row.reason)||isReadOnly(row,key));
const stable=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)
  ?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const fail=reason=>{throw Error(reason);};
const safeCode=value=>typeof value==='string'&&/^[a-z_]{2,80}$/u.test(value)?value:'basic_job_failed';
const pathFor=(key,index)=>key==='degree'?`education.${index}.degree`:key==='photo'?null:key;

export function basicCandidate(input,educationIndex) {
  const profile=normalizeProfile(input),row=profile.education[educationIndex];
  if(!Number.isInteger(educationIndex)||educationIndex<0||educationIndex>29||!row)fail('basic_education_source_required');
  const confirmed=new Set(profile.confirmedFields),degreePath=`education.${educationIndex}.degree`;
  if(!row.degree||!confirmed.has(degreePath))fail('basic_education_source_unconfirmed');
  const facts={fullName:'',gender:'',phone:'',birthDate:'',email:'',workStart:'',currentCity:'',education:Array.from({length:educationIndex+1},()=>({})),confirmedFields:[]};
  for(const key of ['fullName','gender','phone','birthDate','email','workStart'])if(profile[key]&&confirmed.has(key)){
    facts[key]=profile[key];facts.confirmedFields.push(key);
  }
  const residence=planGthResidence(profile,BASIC_PAGE);
  if(residence.fillAllowed===true){
    facts.currentCity=residence.fact.province;facts.confirmedFields.push('currentCity');
  }
  facts.education[educationIndex].degree=row.degree;facts.confirmedFields.push(degreePath);
  if([facts.fullName,facts.gender,facts.phone,facts.birthDate,facts.email,facts.workStart,facts.currentCity,row.degree].some(value=>/[\u0000-\u001f]/u.test(value)))fail('basic_source_invalid');
  return {educationIndex,profile:facts};
}
const residenceAccepted=row=>row&&(row.status==='verified'&&verified.includes(row.reason)
  ||row.status==='skipped'&&skipped.includes(row.reason));
export function basicCoverage(response,educationIndex) {
  return BASIC_COVERAGE.map(([question,key])=>{
    const supported=BASIC_FIELDS.some(([,fieldKey])=>fieldKey===key);
    const row=response?.coverage?.find(row=>row?.question===question&&row.key===key)
      ||response?.fields?.find(row=>row?.question===question&&row.path===pathFor(key,educationIndex))
      ||response?.completedFields?.find(row=>row?.key===key);
    // A settled province trial may retain its readback without a live support
    // claim. Unsupported photo coverage still prevents whole-basic completion.
    if(key==='currentCity'){
      const accepted=residenceAccepted(row);
      return {key,question,path:pathFor(key,educationIndex),supported:accepted,
        status:accepted?row.status:'failed',reason:accepted?row.reason:'control_not_supported'};
    }
    const valid=validRow(row,key)||row?.status==='skipped'&&row.reason==='not_run';
    return {key,question,path:pathFor(key,educationIndex),supported,
      status:supported?(valid?row.status:'skipped'):'failed',
      reason:!supported?'control_not_supported':valid?row.reason:'not_run',
      ...(supported&&isReadOnly(row,key)?{readOnlyState:row.readOnlyState}:{})};
  });
}
// Same closed set as CMS region facts, plus the unsupported-control skip that
// GTH basic used to store as status skipped. None of these may count as complete.
export const GTH_COVERAGE_FAIL_CLOSED_REASONS=Object.freeze([
  'control_not_supported',
  'region_fact_not_unique',
  'region_fact_unconfirmed',
  'region_fact_scope_mismatch',
  'explicit_region_pair_required'
]);
const GTH_BASIC_SECTION='基本信息';
const regionClean=value=>String(value??'').normalize('NFKC').replace(/[＊*：:\s]/gu,'');
// The evidenced writer selects one exact first-column province label. Do not
// collapse a JSON province/city pair or a path into an invented leaf selection.
const residenceProvince=value=>typeof value==='string'&&value.trim()&&value.length<=200
  &&!/[\u0000-\u001f{}\[\]"/\\|>]/u.test(value)?value.trim():null;
function explicitRegionPair(answer){
  let pair;
  try{pair=JSON.parse(answer);}catch{return null;}
  if(!pair||typeof pair!=='object'||Array.isArray(pair))return null;
  if(Object.keys(pair).sort().join('|')!=='city|province')return null;
  if(!['province','city'].every(key=>typeof pair[key]==='string'&&pair[key].trim()
    &&pair[key].length<=160&&!/[\u0000-\u001f]/u.test(pair[key])))return null;
  return {province:pair.province,city:pair.city};
}
const coverageClosed=(extra)=>({
  supported:false,liveSupportClaimed:false,fillAllowed:false,saveAllowed:false,
  writeAttempted:false,softwareClickedSave:false,softwareClickedSubmit:false,
  softwareClickedDelete:false,selector:null,query:null,status:'failed',ok:false,
  ...extra
});
function planUnsupportedControl(key,question,path){
  return coverageClosed({key,question,path,reason:'control_not_supported',factSettled:false,matchCount:0});
}
function residenceReady(value,sourcePath){
  return {...coverageClosed({key:'currentCity',question:'现居住地',path:'currentCity'}),
    supported:true,ok:true,status:'ready',reason:'residence_trial_ready',fillAllowed:true,
    factSettled:true,matchCount:1,sourcePath,fact:{province:value,confirmed:true}};
}
function unsupportedResidence(closed,value){
  const pair=explicitRegionPair(value);
  return {...closed,reason:'control_not_supported',factSettled:!!pair,matchCount:1,
    ...(pair?{fact:{province:pair.province,city:pair.city,confirmed:true}}:{})};
}
function planCurrentCityFact(profile){
  const closed=coverageClosed({key:'currentCity',question:'现居住地',path:'currentCity'});
  const value=typeof profile?.currentCity==='string'?profile.currentCity.trim():'';
  if(!value)return {...closed,reason:'control_not_supported',factSettled:false,matchCount:0};
  if(!(profile?.confirmedFields||[]).includes('currentCity'))
    return {...closed,reason:'region_fact_unconfirmed',factSettled:false,matchCount:1};
  const province=residenceProvince(value);
  return province?residenceReady(province,'currentCity'):unsupportedResidence(closed,value);
}
function planGthResidence(profile,sitePageUrl){
  if(sitePageUrl!==BASIC_PAGE)return coverageClosed({key:'currentCity',question:'现居住地',path:'currentCity',
    reason:'region_fact_scope_mismatch',factSettled:false,matchCount:0});
  const matches=(profile?.customFacts||[]).filter(row=>regionClean(row?.question)==='现居住地');
  if(matches.length>1)return coverageClosed({key:'currentCity',question:'现居住地',path:'currentCity',
    reason:'region_fact_not_unique',factSettled:false,matchCount:matches.length});
  if(matches.length!==1)return planCurrentCityFact(profile);
  const saved=matches[0];
  const path=`customAnswers.${saved.question}`;
  const closed=coverageClosed({key:'currentCity',question:'现居住地',path,matchCount:1,factSettled:false});
  if(!(profile?.confirmedFields||[]).includes(path)||saved.answer!==profile?.customAnswers?.[saved.question])
    return {...closed,reason:'region_fact_unconfirmed'};
  const page=typeof sitePageUrl==='string'&&sitePageUrl?sitePageUrl:BASIC_PAGE;
  const settled=saved.sitePageUrl===page
    &&regionClean(saved.sectionName)===GTH_BASIC_SECTION
    &&regionClean(saved.question)==='现居住地'
    &&(saved.rowContext==='single'||saved.rowContext==='none');
  if(!settled)return {...closed,reason:'region_fact_scope_mismatch'};
  const province=residenceProvince(saved.answer);
  if(!province)return unsupportedResidence(closed,saved.answer);
  const current=typeof profile?.currentCity==='string'?profile.currentCity.trim():'';
  if(current&&(profile?.confirmedFields||[]).includes('currentCity')&&current!==province)
    return {...closed,reason:'region_fact_not_unique'};
  return residenceReady(province,path);
}
export function planGthBasicCoverage(profile,{sitePageUrl=BASIC_PAGE,fillRequested=false}={}){
  const fields=[
    planGthResidence(profile,sitePageUrl),
    planUnsupportedControl('photo','照片',null)
  ];
  const region=fields.find(field=>field.status==='failed'&&field.reason!=='control_not_supported');
  const blocked=fields.some(field=>field.status==='failed'&&GTH_COVERAGE_FAIL_CLOSED_REASONS.includes(field.reason));
  return {
    ok:false,complete:false,blocked,fillRequested:fillRequested===true,
    fillAllowed:false,saveAllowed:false,writeAttempted:false,liveSupportClaimed:false,
    softwareClickedSave:false,softwareClickedSubmit:false,softwareClickedDelete:false,
    selector:null,query:null,
    reason:region?.reason||'control_not_supported',
    fields
  };
}
export function sealGthJobCoverage(coverage,plan){
  const byKey=new Map((plan?.fields||[]).filter(field=>field?.status==='failed'
    &&GTH_COVERAGE_FAIL_CLOSED_REASONS.includes(field.reason)).map(field=>[field.key,field]));
  return (Array.isArray(coverage)?coverage:[]).map(row=>{
    const planned=byKey.get(row?.key);
    if(!planned)return row;
    return {...row,supported:false,status:'failed',reason:planned.reason};
  });
}
export function gthRequestedFillBlocksComplete(plan){
  return plan?.fillRequested===true&&plan.blocked===true&&Array.isArray(plan.fields)
    &&plan.fields.some(field=>field?.status==='failed'&&GTH_COVERAGE_FAIL_CLOSED_REASONS.includes(field.reason));
}
function splitTrialRows(rows){
  const list=Array.isArray(rows)?rows:[];
  const city=list.filter(row=>row?.path==='currentCity'||row?.question==='现居住地');
  return {city,core:list.filter(row=>!city.includes(row))};
}
export function validResponse(response,index) {
  const rows=response?.fields;
  const {city,core}=splitTrialRows(rows);
  // BASIC_FIELDS stays the seven-field contract. 现居住地 may ride along as one
  // extra row; a missing or rejected residence row does not count as support.
  return response?.ok===true&&response.scope==='gth_basic_six'&&response.complete===false
    &&response.editorLeftOpen===true&&response.savedOnSite===null&&response.submitted===null
    &&response.softwareClickedSave===false&&response.softwareClickedSubmit===false&&response.softwareClickedDelete===false
    &&response.liveSupportClaimed!==true
    &&city.length<=1&&(city.length===0||city[0].question==='现居住地'&&city[0].path==='currentCity'&&residenceAccepted(city[0]))
    &&core.length===BASIC_FIELDS.length&&BASIC_FIELDS.every(([question,key])=>{
      const matches=core.filter(row=>row?.question===question&&row.path===pathFor(key,index));
      return matches.length===1&&validRow(matches[0],key);
    })&&response.supportedComplete===rows.every(row=>row.status==='verified')
    &&response.operableComplete===rows.every(row=>row.status==='verified'
      ||isReadOnly(row,BASIC_FIELDS.find(([question])=>question===row.question)?.[1]))
    &&response.writeStarted===rows.some(row=>['readback_matched','readback_reapplied'].includes(row.reason))
    &&Array.isArray(response.coverage)&&stable(response.coverage)===stable(basicCoverage(response,index));
}
function diagnostics(response) {
  return {reason:response?.reason?safeCode(response.reason):null,
    activeField:BASIC_FIELDS.some(([,key])=>key===response?.activeField)||response?.activeField==='currentCity'?response.activeField:null,
    selectorStep:typeof response?.selectorStep==='string'&&/^[a-z_]{2,80}$/u.test(response.selectorStep)?response.selectorStep:null,
    writeStarted:response?.writeStarted===true,
    completedFields:(response?.completedFields||[]).filter(row=>(BASIC_FIELDS.some(([,key])=>key===row?.key)||row?.key==='currentCity')
      &&(row.status==='verified'?verified.includes(row.reason):row.status==='skipped'&&(skipped.includes(row.reason)
        ||['phone','email'].includes(row.key)&&row.reason==='site_readonly')))
      .map(({key,status,reason})=>({key,status,reason}))};
}

export function createBasicTaskRunner({api=globalThis.chrome,verifyBeforeFill=null,timeoutMs=45000,
  keepAliveMs=15000,saveReceipt=saveRecentResult,lifecycleOptions={}}={}) {
  const running=new Map(),get=async key=>(await api.storage.local.get(key))[key];
  const bounded=(operation,ms=timeoutMs)=>new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('basic_job_timeout')),ms);
    Promise.resolve().then(operation).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
  });
  const pending=async tabId=>{
    const scoped=await get(pendingKey(tabId)),legacy=await get('resumePendingFillReview');
    return scoped||(legacy?.tabId===tabId&&legacy.origin===origin?legacy:null);
  };
  const clearExact=async(tabId,requestId)=>{const record=await get(pendingKey(tabId));
    if(record?.tabId===tabId&&record.origin===origin&&record.requestId===requestId)await api.storage.local.remove(pendingKey(tabId));};
  const exactTab=async tabId=>{const tab=await api.tabs.get(tabId),active=await api.tabs.query({active:true,lastFocusedWindow:true});
    if(tab?.id!==tabId||tab.url!==BASIC_PAGE||active.length!==1||active[0].id!==tabId||active[0].url!==BASIC_PAGE)fail('basic_job_tab_changed');return tab;};
  async function execute(message,requestId,respond) {
    const {tabId,educationIndex,replaceExisting}=message,key=basicJobKey(tabId);
    let sent=false,reserved=false,licenseCode=null,binding=message.profileBinding,jobReserved=false,priorJob,job={tabId,origin,requestId,educationIndex,replaceExisting,kind:BASIC_KIND,
      at:Date.now(),state:'queued',complete:false,supportedComplete:false,operableComplete:false,coverage:basicCoverage(null,educationIndex)};
    const keepAlive=setInterval(()=>{api.storage.local.get(key).catch(()=>{});},keepAliveMs);
    const save=async patch=>{job={...job,...patch,profileBinding:binding};
      if(jobReserved)await commitBoundJob(api.storage.local,key,job,binding,lifecycleOptions);
      else {await reserveBoundJob(api.storage.local,key,job,binding,priorJob,lifecycleOptions);jobReserved=true;}};
    try{
      await assertProfileBinding(api.storage.local,binding,lifecycleOptions);
      const prior=priorJob=await get(key),educationJob=await get(`resumeEducationJob:${tabId}`);
      if(await pending(tabId)||[prior,educationJob].some(record=>record&&['queued','running','unknown'].includes(record.state)))fail('basic_job_pending_review');
      await save({});respond({ok:true,accepted:true,requestId});
      const paid=api.runtime.getManifest?.().background?.service_worker==='src/license/guard-worker.mjs';
      if(paid&&typeof verifyBeforeFill!=='function')fail('license_required');
      if(typeof verifyBeforeFill==='function')try{await bounded(verifyBeforeFill,15000);}catch(error){
        if(['NOT_ACTIVATED','LICENSE_REVOKED','LICENSE_EXPIRED','DEVICE_REVOKED','SERVER_UNAVAILABLE'].includes(error?.code))licenseCode=error.code;
        fail('license_required');
      }
      const tab=await exactTab(tabId),raw=await get('resumeProfile'),candidate=basicCandidate(raw,educationIndex);
      if(await canonicalProfileHash(raw,lifecycleOptions.cryptoImpl)!==binding.profileHash)fail('profile_binding_changed');
      if(stable(candidate)!==stable(message.candidateSnapshot))fail('basic_job_profile_changed');
      const trusted=await get('resumeTrustedOrigins');
      if(!Array.isArray(trusted)||!trusted.includes(origin)){
        if(message.originConfirmed!==true)fail('basic_job_origin_unconfirmed');
        await withProfileBinding(api.storage.local,binding,()=>api.storage.local.set({resumeTrustedOrigins:[...(Array.isArray(trusted)?trusted:[]),origin].slice(-100)}),lifecycleOptions);
      }
      if(await pending(tabId))fail('basic_job_pending_review');
      await withProfileBinding(api.storage.local,binding,()=>api.storage.local.set({[pendingKey(tabId)]:{tabId,origin,requestId,at:Date.now(),kind:BASIC_KIND,educationIndex,replaceExisting,profileBinding:binding}}),lifecycleOptions);reserved=true;
      await withProfileBinding(api.storage.local,binding,()=>beginRecentRequest(tab,requestId),lifecycleOptions);await save({state:'running'});
      await bounded(()=>dispatchBoundSource(api.storage.local,binding,()=>api.scripting.executeScript({target:{tabId},files:['src/content/gth-basic.js']}),lifecycleOptions),15000);
      await exactTab(tabId);
      if(stable(basicCandidate(await get('resumeProfile'),educationIndex))!==stable(candidate))fail('basic_job_profile_changed');
      if((await get(pendingKey(tabId)))?.requestId!==requestId)fail('basic_job_pending_changed');
      await requireAutoFormReady(api,tabId);
      sent=true;
      const response=await bounded(()=>dispatchBoundSource(api.storage.local,binding,()=>api.tabs.sendMessage(tabId,{type:'GTH_BASIC_TRIAL',requestId,educationIndex,replaceExisting,profile:candidate.profile,profileBinding:binding}),lifecycleOptions));
      await assertProfileBinding(api.storage.local,binding,lifecycleOptions);
      const status=await bounded(()=>dispatchBoundSource(api.storage.local,binding,()=>api.tabs.sendMessage(tabId,{type:'GTH_BASIC_TRIAL_STATUS',requestId}),lifecycleOptions),15000);
      const outcome=status?.ok===true&&status.data?.requestId===requestId&&status.data.state==='settled'?status.data.outcome:'unknown';
      const coverage=basicCoverage(response,educationIndex),info=diagnostics(response);
      if(!validResponse(response,educationIndex)){
        if(response?.writeStarted===false&&outcome==='failed_before_write'){
          const receipt=await withProfileBinding(api.storage.local,binding,()=>saveReceipt(tab,requestId,BASIC_KIND,[],'stopped_before_write'),lifecycleOptions);
          if(!receipt)fail('basic_job_receipt_unavailable');
          await save({state:'stopped_before_write',...info,coverage});await withProfileBinding(api.storage.local,binding,()=>clearExact(tabId,requestId),lifecycleOptions);return;
        }
        await save({state:'unknown',...info,coverage});return;
      }
      const fields=response.fields.map(({question,path,status,reason,readOnlyState})=>({question,path,status,reason,
        ...(reason==='site_readonly'?{readOnlyState}:{})}));
      if(!['verified','verified_preexisting','failed_before_write'].includes(outcome)
        ||outcome==='failed_before_write'&&response.writeStarted!==false){
        await save({state:'unknown',...diagnostics(status?.data),coverage,fields});return;
      }
      const coveragePlan=planGthBasicCoverage(raw,{fillRequested:true});
      if(outcome!=='failed_before_write'&&gthRequestedFillBlocksComplete(coveragePlan)){
        const sealed=sealGthJobCoverage(coverage,coveragePlan);
        await save({state:'unknown',outcome,...info,reason:coveragePlan.reason,coverage:sealed,fields,
          supportedComplete:response.supportedComplete===true,operableComplete:response.operableComplete===true,
          complete:false,liveSupportClaimed:false});
        return;
      }
      const receipt=await withProfileBinding(api.storage.local,binding,()=>saveReceipt(tab,requestId,BASIC_KIND,outcome==='failed_before_write'?[]:coverage,
        outcome==='failed_before_write'?'stopped_before_write':'readback_complete'),lifecycleOptions);
      if(!receipt)fail('basic_job_receipt_unavailable');
      await save({state:outcome==='failed_before_write'?'stopped_before_write':'completed',outcome,...info,coverage,fields,
        supportedComplete:response.supportedComplete===true,operableComplete:response.operableComplete===true,
        counts:{newlyFilled:fields.filter(row=>row.reason==='readback_matched').length,
          reapplied:fields.filter(row=>row.reason==='readback_reapplied').length,originalSame:fields.filter(row=>row.reason==='preexisting_same_value').length,
          supportedRemaining:fields.filter(row=>row.status!=='verified'&&row.reason!=='site_readonly').length,
          siteReadOnly:fields.filter(row=>row.reason==='site_readonly').length,
          operable:fields.filter(row=>row.reason!=='site_readonly').length,
          unsupported:coverage.filter(row=>row.supported===false).length,remaining:coverage.filter(row=>row.status!=='verified').length}});
      await withProfileBinding(api.storage.local,binding,()=>clearExact(tabId,requestId),lifecycleOptions);
    }catch(error){
      const reason=safeCode(error?.message);
      if(binding&&reason.startsWith('profile_')){await invalidateBoundJob(api.storage.local,key,job,{...lifecycleOptions,writeMayHaveStarted:sent});respond({ok:false,error:reason,requestId,writeStarted:sent});return;}
      if(!sent&&reserved)await withProfileBinding(api.storage.local,binding,()=>clearExact(tabId,requestId),lifecycleOptions);
      if((await get(key))?.requestId===requestId)await save({state:sent?'unknown':'stopped_before_write',reason,
        writeStarted:sent,liveSupportClaimed:false,...autoFormReadinessFailure(error),...(licenseCode?{licenseCode}:{})});
      respond({ok:false,error:reason,requestId,writeStarted:sent,liveSupportClaimed:false,...autoFormReadinessFailure(error)});
    }finally{clearInterval(keepAlive);running.delete(tabId);}
  }
  const listener=(message,sender,sendResponse)=>{
    if(!['GTH_BASIC_JOB_START','GTH_BASIC_JOB_STATUS'].includes(message?.type))return false;
    if(sender?.id!==api.runtime.id||sender.url!==api.runtime.getURL('src/popup/popup.html')||sender.tab){sendResponse({ok:false,error:'wrong_sender'});return false;}
    if(!Number.isSafeInteger(message.tabId)||message.tabId<0){sendResponse({ok:false,error:'basic_job_invalid'});return false;}
    if(message.type==='GTH_BASIC_JOB_STATUS'){
      get(basicJobKey(message.tabId)).then(async data=>{if(data?.profileBinding)await assertProfileBinding(api.storage.local,data.profileBinding,lifecycleOptions);else if(data)throw Error('profile_binding_required');sendResponse({ok:true,data:data||null});}).catch(()=>sendResponse({ok:false,error:'profile_binding_changed'}));return true;
    }
    if(message.pageUrl!==BASIC_PAGE||!Number.isInteger(message.educationIndex)||message.educationIndex<0||message.educationIndex>29
      ||typeof message.replaceExisting!=='boolean'||!message.candidateSnapshot||stable(message.candidateSnapshot).length>10000){
      sendResponse({ok:false,error:'basic_job_invalid'});return false;
    }
    if(running.has(message.tabId)){sendResponse({ok:false,error:'basic_job_in_progress',requestId:running.get(message.tabId).requestId});return false;}
    const requestId=`${Date.now()}-${Math.random().toString(36).slice(2)}`,slot={requestId,promise:null};running.set(message.tabId,slot);
    let responded=false;const respond=value=>{if(!responded){responded=true;try{sendResponse(value);}catch{/* Popup closed; worker retains the task. */}}};
    slot.promise=execute(message,requestId,respond).catch(()=>{running.delete(message.tabId);respond({ok:false,error:'basic_job_failed',requestId});});return true;
  };
  return {listener,waitForIdle:async()=>{await Promise.all([...running.values()].map(slot=>slot.promise));}};
}
export function installBasicTaskRunner(options={}) {
  const runner=createBasicTaskRunner(options);(options.api||globalThis.chrome).runtime.onMessage.addListener(runner.listener);return runner;
}
