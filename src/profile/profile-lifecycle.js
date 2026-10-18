// Candidate only. Opening a page or updating code never creates/rotates an epoch.
export const PROFILE_EPOCH_KEY='resumeProfileLifecycle';
export const PROFILE_LOCK='resume-profile-lifecycle-v1';
const JOB_PREFIXES=['resumeEducationJob:','resumeBasicJob:','resumeGthDraftJob:','resumeGthDraftSave:','resumeRecentFillRequest:','resumeRecentFillResult:','resumeGthFullJob:','resumeGthSerialJob:','resumeCmsEducationJob:','resumeCmsInternshipJob:'];
const stable=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)
  ?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const read=async(storage,key)=>(await storage.get(key))[key];
const fail=reason=>{throw Error(reason);};
const validEpoch=value=>value==='legacy'||typeof value==='string'&&/^[a-f0-9-]{36}$/iu.test(value);
const validBinding=value=>value?.version===1&&validEpoch(value.epoch)&&/^[a-f0-9]{64}$/u.test(value.profileHash||'');
const epochOf=value=>value===undefined?'legacy':value?.version===1&&value.state==='ready'&&validEpoch(value.epoch)?value.epoch:fail('profile_lifecycle_invalid');
async function exclusive(work,{locks=globalThis.navigator?.locks}={}){
  if(typeof locks?.request!=='function')fail('profile_lifecycle_lock_unavailable');
  return locks.request(PROFILE_LOCK,{mode:'exclusive'},work);
}
export const withProfileLifecycleLock=(work,options={})=>exclusive(work,options);
export async function withProfileBinding(storage,binding,work,options={}){
  return exclusive(async()=>{await assertProfileBinding(storage,binding,options);return work();},options);
}
export async function canonicalProfileHash(profile,cryptoImpl=globalThis.crypto){
  const bytes=new TextEncoder().encode(stable(profile??null));
  return [...new Uint8Array(await cryptoImpl.subtle.digest('SHA-256',bytes))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
export async function captureProfileBinding(storage,{cryptoImpl=globalThis.crypto}={}){
  const before=await read(storage,PROFILE_EPOCH_KEY);
  if(before?.state==='changing')fail('profile_lifecycle_changing');
  const profile=await read(storage,'resumeProfile'),profileHash=await canonicalProfileHash(profile,cryptoImpl);
  const again=await read(storage,'resumeProfile'),after=await read(storage,PROFILE_EPOCH_KEY);
  if(stable(before)!==stable(after)||stable(profile)!==stable(again))fail('profile_lifecycle_changed');
  return {version:1,epoch:epochOf(after),profileHash};
}
export async function assertProfileBinding(storage,binding,options={}){
  if(!validBinding(binding))fail('profile_binding_required');
  const current=await captureProfileBinding(storage,options);
  if(current.epoch!==binding.epoch||current.profileHash!==binding.profileHash)fail('profile_binding_changed');
  return current;
}
export async function commitBoundJob(storage,key,job,binding,options={}){
  return exclusive(async()=>{
    await assertProfileBinding(storage,binding,options);
    if((await read(storage,key))?.requestId!==job.requestId)fail('profile_job_owner_changed');
    await storage.set({[key]:job});return job;
  },options);
}
export async function reserveBoundJob(storage,key,job,binding,expectedCurrent,options={}){
  return exclusive(async()=>{
    await assertProfileBinding(storage,binding,options);
    if(stable(await read(storage,key))!==stable(expectedCurrent))fail('profile_job_owner_changed');
    await storage.set({[key]:job});return job;
  },options);
}
export async function dispatchBoundSource(storage,binding,send,options={}){
  // The lock guards dispatch, not its long-lived response. This lets a user
  // invalidate a profile while a read-only inspect is waiting for its reply.
  const queued=await exclusive(async()=>{await assertProfileBinding(storage,binding,options);return {response:send()};},options);
  return queued.response;
}
export async function invalidateBoundJob(storage,key,job,{writeMayHaveStarted=false,...options}={}){
  return exclusive(async()=>{
    const current=await read(storage,key);
    if(current?.requestId!==job.requestId)return;
    const safe=safeAudit(job,'invalidated','import');
    await storage.set({[key]:{...safe,origin:['https://hr.gtht.com','https://wecruit.hotjob.cn'].includes(job.origin)?job.origin:'',state:writeMayHaveStarted?'unknown':'stopped_before_write',
      reason:'profile_binding_changed',writeMayHaveStarted,pendingReviewRequired:writeMayHaveStarted}});
  },options);
}
function safeAudit(record,epoch,mutation){
  const requestId=typeof record?.requestId==='string'&&/^[a-zA-Z0-9-]{1,120}$/u.test(record.requestId)?record.requestId:'unidentified';
  return {version:1,requestId,tabId:Number.isSafeInteger(record?.tabId)?record.tabId:null,
    kind:typeof record?.kind==='string'&&/^[a-z_]{2,80}$/u.test(record.kind)?record.kind:'unknown_operation',
    at:Date.now(),state:'unknown_profile_invalidated',writeMayHaveStarted:true,
    softwareClickedSave:record?.softwareClickedSave===true?true:null,saveClickCount:record?.saveClickCount===1?1:null,
    reason:mutation==='delete'?'profile_deleted':'profile_replaced',invalidatedByEpoch:epoch};
}
export async function replaceProfileLifecycle(storage,mutation,replace,{cryptoImpl=globalThis.crypto,...options}={}){
  if(!['import','delete'].includes(mutation)||typeof replace!=='function')fail('profile_mutation_invalid');
  return exclusive(async()=>{
    const epoch=cryptoImpl.randomUUID(),record={version:1,epoch,state:'changing',mutation,at:Date.now()};
    await storage.set({[PROFILE_EPOCH_KEY]:record});
    const all=await storage.get(null),remove=[],keep={},audits={};
    for(const [key,value]of Object.entries(all)){
      const pending=key==='resumePendingFillReview'||key.startsWith('resumePendingFillReview:');
      const job=JOB_PREFIXES.some(prefix=>key.startsWith(prefix));
      if(!pending&&!job)continue;
      remove.push(key);
      const actualUnknown=pending||value?.action!=='inspect'&&(['running','unknown','save_intent','awaiting_closed','reopening_for_server_readback'].includes(value?.state)
        ||value?.softwareClickedSave===true&&value?.state!=='completed');
      if(actualUnknown){
        const audit=safeAudit(value,epoch,mutation);audits[`resumeProfileInvalidatedAudit:${audit.tabId??'unknown'}:${audit.requestId}`]=audit;
        if(pending)keep[key]={...audit,origin:typeof value?.origin==='string'&&/^https:\/\/(?:hr\.gtht\.com|wecruit\.hotjob\.cn)$/u.test(value.origin)?value.origin:'',
          pendingReviewRequired:true};
      }
    }
    // Locks with potentially dispatched writes retain anonymous unknown state;
    // removing a profile is never reported as cancellation of a website write.
    if(remove.length)await storage.remove(remove);
    if(Object.keys(keep).length||Object.keys(audits).length)await storage.set({...keep,...audits});
    await storage.remove(['resumeTrustedOrigins','resumePendingQuestions','resumeRequestedSection','resumeEducationSiteFacts']);
    const result=await replace({epoch});
    await storage.set({[PROFILE_EPOCH_KEY]:{...record,state:'ready'}});
    return {result,epoch,unknownOperationsPreserved:Object.keys(audits).length};
  },{...options,cryptoImpl});
}
export function installProfileBindingBridge({api=globalThis.chrome,...options}={}){
  const listener=(message,sender,sendResponse)=>{
    if(message?.type!=='RESUME_PROFILE_BINDING_CHECK')return false;
    if(sender?.id!==api.runtime.id){sendResponse({allowed:false,reason:'wrong_sender'});return false;}
    (async()=>{
      if(sender.tab){
        let url;try{url=new URL(sender.url);}catch{throw Error('wrong_sender');}
        if(sender.frameId!==0||url.protocol!=='https:'||url.username||url.password
          ||!Number.isSafeInteger(sender.tab.id)||sender.tab.url!==sender.url)throw Error('wrong_sender');
        const tab=await api.tabs.get(sender.tab.id);if(tab?.url!==sender.url)throw Error('wrong_sender');
      }
      await assertProfileBinding(api.storage.local,message.profileBinding,options);return {allowed:true};
    })().then(sendResponse,error=>sendResponse({allowed:false,reason:/^profile_[a-z_]+$/u.test(error?.message||'')?error.message:'wrong_sender'}));return true;
  };
  api.runtime.onMessage.addListener(listener);return listener;
}
