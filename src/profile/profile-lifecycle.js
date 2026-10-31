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

// Product-internal, top-frame CMS trial projection. Never exposed to extension
// documents or accepted from a caller-supplied profile/answer. No storage writes.
const CMS_ROW_D_PAGE='https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';
const CMS_ROW_D_QUESTIONS=Object.freeze({expectedWorkNature:'期望工作性质',
  researchInterests:'如应聘研究发展中心行业研究类岗位请勾选（建议仅勾选3~5项）'});
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value)
  &&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const readyTrialPair=record=>plain(record)&&own(record,'resumeProfile')&&own(record,PROFILE_EPOCH_KEY)
  &&plain(record.resumeProfile)&&record.resumeProfile.schemaVersion===1
  &&plain(record[PROFILE_EPOCH_KEY])&&record[PROFILE_EPOCH_KEY].version===1
  &&record[PROFILE_EPOCH_KEY].state==='ready'&&record[PROFILE_EPOCH_KEY].epoch!=='legacy'
  &&validEpoch(record[PROFILE_EPOCH_KEY].epoch);
async function boundCmsRowDProjection(storage,binding,target,options){
  if(!own(CMS_ROW_D_QUESTIONS,target)||!validBinding(binding)||binding.epoch==='legacy')fail('profile_trial_request_invalid');
  const pair=await storage.get(['resumeProfile',PROFILE_EPOCH_KEY]);
  if(!readyTrialPair(pair))fail('profile_trial_not_ready');
  await assertProfileBinding(storage,binding,options);
  if(pair[PROFILE_EPOCH_KEY].epoch!==binding.epoch
    ||await canonicalProfileHash(pair.resumeProfile,options.cryptoImpl)!==binding.profileHash)fail('profile_binding_changed');
  const profile=pair.resumeProfile,question=CMS_ROW_D_QUESTIONS[target],path=`customAnswers.${question}`;
  if(!Array.isArray(profile.customFacts)||profile.customFacts.length>100
    ||!plain(profile.customAnswers)||!Array.isArray(profile.confirmedFields)||profile.confirmedFields.length>1000)
    fail('profile_trial_fact_invalid');
  // Match confirmedCustomAnswer's NFKC + ResumeMatcher.normalize equivalence
  // before reducing the full profile; otherwise projection could hide ambiguity.
  const normal=value=>typeof value!=='string'?'':target==='expectedWorkNature'
    ?value.normalize('NFKC').replace(/\(必填\)|（必填）|\(选填\)|（选填）/g,'')
      .replace(/[＊*：:！!？?，,。\.\s\u00a0]/g,'').trim().toLocaleLowerCase()
    :value.normalize('NFKC').replace(/[＊*：:\s]/gu,'');
  const facts=profile.customFacts.filter(fact=>normal(fact?.question)===normal(question));
  if(facts.length!==1)fail('profile_trial_fact_not_unique');
  const saved=facts[0];
  if(saved.question!==question||saved.sitePageUrl!==CMS_ROW_D_PAGE||normal(saved.sectionName)!==normal('求职意向必填')
    ||saved.rowContext!=='single'||!profile.confirmedFields.includes(path)
    ||typeof saved.answer!=='string'||!saved.answer.trim()||saved.answer.length>4000
    ||!own(profile.customAnswers,question)||saved.answer!==profile.customAnswers[question])fail('profile_trial_fact_invalid');
  // Existing engine resolvers validate the answer format/option semantics later.
  // Only this one confirmed fact enters collect; no full profile crosses IPC.
  const projection={schemaVersion:1,customFacts:[{question,answer:saved.answer,sitePageUrl:CMS_ROW_D_PAGE,
    sectionName:saved.sectionName,rowContext:'single'}],customAnswers:{[question]:saved.answer},confirmedFields:[path]};
  await assertProfileBinding(storage,binding,options);
  const after=await storage.get(['resumeProfile',PROFILE_EPOCH_KEY]);
  if(!readyTrialPair(after)||after[PROFILE_EPOCH_KEY].epoch!==binding.epoch
    ||await canonicalProfileHash(after.resumeProfile,options.cryptoImpl)!==binding.profileHash)fail('profile_binding_changed');
  return projection;
}

export function installProfileBindingBridge({api=globalThis.chrome,...options}={}){
  const listener=(message,sender,sendResponse)=>{
    const trial=message?.type==='RESUME_CMS_ROW_D_TRIAL_FACT';
    if(!trial&&message?.type!=='RESUME_PROFILE_BINDING_CHECK')return false;
    if(sender?.id!==api.runtime.id){sendResponse({allowed:false,reason:'wrong_sender'});return false;}
    (async()=>{
      if(trial&&(!sender.tab||Object.keys(message).sort().join('|')!=='profileBinding|target|type'))throw Error('profile_trial_request_invalid');
      if(sender.tab){
        let url;try{url=new URL(sender.url);}catch{throw Error('wrong_sender');}
        if(sender.frameId!==0||url.protocol!=='https:'||url.username||url.password
          ||!Number.isSafeInteger(sender.tab.id)||sender.tab.url!==sender.url)throw Error('wrong_sender');
        const tab=await api.tabs.get(sender.tab.id);if(tab?.url!==sender.url)throw Error('wrong_sender');
        if(trial&&sender.url!==CMS_ROW_D_PAGE)throw Error('wrong_sender');
      }
      if(trial){
        const projection=await boundCmsRowDProjection(api.storage.local,message.profileBinding,message.target,options);
        const current=await api.tabs.get(sender.tab.id);
        if(current?.url!==CMS_ROW_D_PAGE||sender.url!==current.url)throw Error('wrong_sender');
        await assertProfileBinding(api.storage.local,message.profileBinding,options);
        if((await api.tabs.get(sender.tab.id))?.url!==CMS_ROW_D_PAGE)throw Error('wrong_sender');
        return {allowed:true,projection};
      }
      await assertProfileBinding(api.storage.local,message.profileBinding,options);return {allowed:true};
    })().then(sendResponse,error=>sendResponse({allowed:false,reason:/^profile_[a-z_]+$/u.test(error?.message||'')?error.message:'wrong_sender'}));return true;
  };
  api.runtime.onMessage.addListener(listener);return listener;
}
