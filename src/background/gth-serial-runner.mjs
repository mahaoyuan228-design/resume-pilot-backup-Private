// Unregistered product prototype: one parent job/lease, exactly two education
// steps. No nested education/draft worker STARTs and no whole-site claim.
import {captureProfileBinding,canonicalProfileHash,assertProfileBinding,dispatchBoundSource,reserveBoundJob,commitBoundJob,withProfileBinding,invalidateBoundJob} from '../profile/profile-lifecycle.js';
import {createSerialEducationExecutor,SERIAL_EDUCATION_REQUIRED} from './gth-serial-step.mjs';
import {EDUCATION_FIELDS,educationCandidate} from './education-task-runner.mjs';
const PAGE='https://hr.gtht.com/resume/edit/',ORIGIN='https://hr.gtht.com',fail=code=>{throw Error(code);};
const stable=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item),same=(a,b)=>stable(a)===stable(b);
const pendingKey=tab=>`resumePendingFillReview:${tab}`,jobKey=tab=>`resumeGthSerialJob:${tab}`;
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;};
export function createGthSerialPrototype({api=globalThis.chrome,verifyBeforeFill=null,lifecycleOptions={},timeoutMs=90000}={}){
 const running=new Map(),get=async key=>(await api.storage.local.get(key))[key];
 const bounded=(work,ms=timeoutMs)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('serial_operation_timeout')),ms);Promise.resolve().then(work).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});});
 async function execute(message,requestId,ack){
  const {tabId,profileBinding}=message,key=jobKey(tabId);let lease=null,reserved=false,started=false,jobReserved=false;
  let job={kind:'gth_serial_education_vertical',requestId,tabId,origin:ORIGIN,profileBinding,state:'queued',complete:false,educationSequenceComplete:false,wholeSiteComplete:false,steps:[],at:Date.now()};
  const alive=setInterval(()=>{api.storage.local.get(key).catch(()=>{});},15000);
  const write=async patch=>{job={...job,...patch};await commitBoundJob(api.storage.local,key,job,profileBinding,lifecycleOptions);};
  const paid=async()=>{if(api.runtime.getManifest?.().background?.service_worker==='src/license/guard-worker.mjs'&&!verifyBeforeFill)fail('license_required');if(verifyBeforeFill)await bounded(verifyBeforeFill,15000);};
  const guard=async()=>{await paid();await assertProfileBinding(api.storage.local,profileBinding,lifecycleOptions);const tab=await api.tabs.get(tabId),active=await api.tabs.query({active:true,lastFocusedWindow:true});if(tab?.url!==PAGE||active.length!==1||active[0].id!==tabId||active[0].url!==PAGE)fail('serial_active_tab_changed');if(reserved&&!same(await get(pendingKey(tabId)),lease))fail('serial_parent_lease_changed');};
  const dispatch=async work=>{await guard();return bounded(()=>dispatchBoundSource(api.storage.local,profileBinding,work,lifecycleOptions));};
  try{
   const previous=await get(key);if(previous&&['queued','running','unknown'].includes(previous.state)||await get(pendingKey(tabId))||(await get('resumePendingFillReview'))?.tabId===tabId)fail('serial_existing_pending');
   await guard();if(!same(await captureProfileBinding(api.storage.local,lifecycleOptions),profileBinding))fail('profile_binding_changed');
   const profile=freeze(structuredClone(await get('resumeProfile'))),bindings=freeze(structuredClone(message.educationBindings));
   if(await canonicalProfileHash(profile,lifecycleOptions.cryptoImpl)!==profileBinding.profileHash)fail('profile_binding_changed');
   if(bindings.length!==2||new Set(bindings.map(row=>row.profileIndex)).size!==2)fail('serial_two_explicit_sources_required');const targets=new Set();
   for(const row of bindings){if(!Number.isInteger(row.profileIndex)||!profile.education?.[row.profileIndex]||!['new','existing'].includes(row.targetMode)||typeof row.replaceExisting!=='boolean'||row.targetMode==='new'&&(row.recordIdentity!==null||row.replaceExisting!==false)||row.targetMode==='existing'&&(row.replaceExisting!==true||typeof row.recordIdentity!=='string'||!row.recordIdentity||targets.has(row.recordIdentity)))fail('serial_binding_invalid');if(row.targetMode==='existing')targets.add(row.recordIdentity);}
   job.steps=bindings.map((row,index)=>({index,profileIndex:row.profileIndex,targetMode:row.targetMode,state:'queued',saveClickCount:0,refreshVerified:false}));
   const missing=bindings.flatMap(row=>{const candidate=educationCandidate(profile,row.profileIndex);return SERIAL_EDUCATION_REQUIRED.filter(key=>!candidate[key]).map(key=>({profileIndex:row.profileIndex,path:`education.${row.profileIndex}.${key}`,question:EDUCATION_FIELDS.find(field=>field[1]===key)[0],status:'skipped',reason:typeof profile.education[row.profileIndex][key]==='string'&&profile.education[row.profileIndex][key].trim()?'profile_fact_unconfirmed':'missing_profile_value'}));});
   if(missing.length){job={...job,state:'needs_data',reason:'serial_required_facts_missing',missing};await reserveBoundJob(api.storage.local,key,job,profileBinding,previous,lifecycleOptions);jobReserved=true;ack({ok:false,error:job.reason,state:'needs_data',requestId,missing});return;}
   await reserveBoundJob(api.storage.local,key,job,profileBinding,previous,lifecycleOptions);jobReserved=true;
   lease={tabId,origin:ORIGIN,requestId,kind:'gth_serial_education_vertical',profileBinding,at:Date.now()};
   await withProfileBinding(api.storage.local,profileBinding,async()=>{if(await get(pendingKey(tabId)))fail('serial_existing_pending');await api.storage.local.set({[pendingKey(tabId)]:lease});},lifecycleOptions);reserved=true;
   ack({ok:true,accepted:true,requestId});
   const runStep=createSerialEducationExecutor({api,dispatch,guard,bounded,lifecycleOptions});
   for(const [index,step]of bindings.entries()){
    await guard();started=true;job.steps[index]={...job.steps[index],state:'running'};await write({state:'running',activeStep:index});
    const persist=async patch=>{job.steps[index]={...job.steps[index],...patch};await write({state:'running'});};
    const result=await runStep(step,{tabId,parentRequestId:requestId,stepRequestId:`${requestId}-e${index}`,profile,profileBinding,lease,persist});
    await guard();job.steps[index]={index,...result};await write({activeStep:null});
   }
   await guard();await write({state:'completed',educationSequenceComplete:true,complete:false,wholeSiteComplete:false,pendingReviewRequired:false,
    sections:{basic:'not_implemented_in_serial',education:'two_bound_records_completed',intent:'not_implemented_in_serial',work:'unsupported',skills:'adapter_exists_serial_not_enabled',attachment:'not_implemented_in_serial',other:'adapter_exists_serial_not_enabled'}});
   await withProfileBinding(api.storage.local,profileBinding,async()=>{if(!same(await get(pendingKey(tabId)),lease))fail('serial_parent_lease_changed');await api.storage.local.remove(pendingKey(tabId));},lifecycleOptions);
  }catch(error){const reason=/^[a-z_]{2,100}$/u.test(error?.message||'')?error.message:'serial_unknown';
   if(jobReserved)try{const knownBlocked=reason==='locked_degree_conflict'&&job.steps[job.activeStep]?.sourceWriteStarted===false&&!job.steps[job.activeStep]?.saveAttempted;await write({state:knownBlocked?'blocked':started?'unknown':'stopped_before_write',reason,pendingReviewRequired:started});}catch{await invalidateBoundJob(api.storage.local,key,job,{...lifecycleOptions,writeMayHaveStarted:started});}
   if(reserved&&!started)await withProfileBinding(api.storage.local,profileBinding,async()=>{if(same(await get(pendingKey(tabId)),lease))await api.storage.local.remove(pendingKey(tabId));},lifecycleOptions).catch(()=>{});
   ack({ok:false,error:reason,requestId});
  }finally{clearInterval(alive);running.delete(tabId);}
 }
 const listener=(message,sender,respond)=>{
  if(!['GTH_SERIAL_V012_START','GTH_SERIAL_V012_STATUS'].includes(message?.type))return false;
  if(sender?.id!==api.runtime.id||sender.url!==api.runtime.getURL('src/popup/popup.html')||sender.tab||!Number.isSafeInteger(message.tabId)){respond({ok:false,error:'serial_wrong_sender'});return false;}
  if(message.type==='GTH_SERIAL_V012_STATUS'){get(jobKey(message.tabId)).then(async job=>{if(job)await assertProfileBinding(api.storage.local,job.profileBinding,lifecycleOptions);const active=running.has(message.tabId),data=job&&!active&&['queued','running'].includes(job.state)?{...job,state:'unknown',reason:'serial_worker_restarted',pendingReviewRequired:true}:job;respond({ok:true,active,data:data||null});},()=>respond({ok:false,error:'serial_status_unavailable'})).catch(()=>respond({ok:false,error:'profile_binding_changed'}));return true;}
  if(message.pageUrl!==PAGE||message.draftSaveAuthorized!==true||!Array.isArray(message.educationBindings)||message.educationBindings.length!==2||running.has(message.tabId)){respond({ok:false,error:'serial_request_invalid'});return false;}
  const requestId=crypto.randomUUID(),slot={promise:null};running.set(message.tabId,slot);let sent=false;const ack=value=>{if(!sent){sent=true;try{respond(value);}catch{}}};slot.promise=execute(message,requestId,ack).catch(()=>ack({ok:false,error:'serial_unknown'}));return true;
 };
 return {listener,waitForIdle:()=>Promise.all([...running.values()].map(slot=>slot.promise))};
}
export function registerGthSerialPrototype(options={}){const runner=createGthSerialPrototype(options);(options.api||globalThis.chrome).runtime.onMessage.addListener(runner.listener);return runner;}
