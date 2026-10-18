// The popup only queues. A draft Save is sent once; loss of its reply keeps
// the tab locked until its persisted result is inspected, never auto-retried.
import {assertProfileBinding,commitBoundJob,reserveBoundJob,dispatchBoundSource,
  withProfileBinding,invalidateBoundJob} from '../profile/profile-lifecycle.js';
import {completeSavedEducationPhase,validSavedPhase} from './gth-education-refresh-coordinator.mjs';
const PAGE='https://hr.gtht.com/resume/edit/',ORIGIN='https://hr.gtht.com';
export const draftJobKey=tabId=>`resumeGthDraftJob:${tabId}`;
const pendingKey=tabId=>`resumePendingFillReview:${tabId}`;
const sourceKey=tabId=>`resumeEducationJob:${tabId}`;
const safe=value=>typeof value==='string'&&/^[a-z_]{2,100}$/u.test(value)?value:'draft_job_failed';
const fail=code=>{throw Error(code);};
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)
  ?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const same=(a,b)=>canonical(a)===canonical(b);
export function createGthDraftTaskRunner({api=globalThis.chrome,verifyBeforeFill=null,timeoutMs=75000,keepAliveMs=15000,lifecycleOptions={}}={}){
  const running=new Map(),get=async key=>(await api.storage.local.get(key))[key];
  const bounded=(fn,ms=timeoutMs)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('draft_job_timeout')),ms);
    Promise.resolve().then(fn).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});});
  const exactTab=async tabId=>{const tab=await api.tabs.get(tabId),active=await api.tabs.query({active:true,lastFocusedWindow:true});
    if(tab?.url!==PAGE||active.length!==1||active[0].id!==tabId||active[0].url!==PAGE)fail('draft_job_tab_changed');return tab;};
  const clearExact=async(tabId,expected)=>{if(!same(await get(pendingKey(tabId)),expected))return false;await api.storage.local.remove(pendingKey(tabId));return !await get(pendingKey(tabId));};
  async function execute(message,ack){
    const {tabId,requestId,action}=message,key=draftJobKey(tabId);
    let sent=false,reserved=false,started=false,created=false,binding=null,ownedLock=null,job={kind:'gth_education_draft_save',tabId,origin:ORIGIN,requestId,
      action,state:'queued',at:Date.now(),softwareClickedSave:false,softwareClickedSubmit:false,refreshVerified:false};
    const write=async patch=>{job={...job,...patch};await commitBoundJob(api.storage.local,key,job,binding,lifecycleOptions);};
    const alive=setInterval(()=>{api.storage.local.get(key).catch(()=>{});},keepAliveMs);
    try{
      const prior=await get(key);
      if(action!=='resume_refresh'&&prior&&(['queued','running','unknown','server_verified_needs_refresh','refreshing_saved_record','verifying_saved_after_refresh'].includes(prior.state)
        ||prior.state==='completed'&&prior.requestId===requestId))fail('draft_job_already_reserved');
      const source=await get(sourceKey(tabId)),pending=await get(pendingKey(tabId)),basic=await get(`resumeBasicJob:${tabId}`);
      const legacy=await get('resumePendingFillReview');
      if(source?.requestId!==requestId||source.state!=='completed'||source.outcome!=='verified'
        ||source.origin!==ORIGIN||!Array.isArray(source.fields)||source.fields.length!==12)fail('draft_job_source_not_verified');
      if(action==='resume_refresh'&&(!prior||prior.requestId!==requestId||prior.targetSaved!==true||!prior.phaseProof
        ||!['server_verified_needs_refresh','refreshing_saved_record','verifying_saved_after_refresh','unknown'].includes(prior.state)||prior.phaseProof.proofHash!==message.phaseProofHash))fail('draft_saved_phase_not_verified');
      if(action!=='resume_refresh'&&pending||legacy?.tabId===tabId&&legacy.origin===ORIGIN
        ||basic&&['queued','running','unknown'].includes(basic.state))fail('draft_job_pending_review');
      if(action==='save'&&(!prior||prior.state!=='ready'||prior.requestId!==requestId
        ||prior.expectedFingerprint!==message.fingerprint))fail('draft_job_preflight_required');
      const paid=api.runtime.getManifest?.().background?.service_worker==='src/license/guard-worker.mjs';
      if(paid&&typeof verifyBeforeFill!=='function')fail('license_required');
      if(typeof verifyBeforeFill==='function')await bounded(verifyBeforeFill,15000);
      binding=source.profileBinding;await assertProfileBinding(api.storage.local,binding,lifecycleOptions);
      if(action!=='inspect'&&!same(prior.profileBinding,binding))fail('profile_binding_changed');
      job=action==='resume_refresh'?{...prior,action,profileBinding:binding}:{...job,profileBinding:binding,...(action==='save'?{recordMarker:prior.recordMarker,targetMode:prior.targetMode,expectedFingerprint:prior.expectedFingerprint}:{})};
      await reserveBoundJob(api.storage.local,key,job,binding,prior,lifecycleOptions);started=true;created=true;
      ack({ok:true,accepted:true,requestId,tabId});
      await exactTab(tabId);
      const refresh=async proof=>{
        const result=await completeSavedEducationPhase({api,tabId,requestId,profileBinding:binding,phaseProof:proof,lease:ownedLock,reloadIntent:job.reloadIntent,
          lifecycleOptions,bounded,persist:write,guard:async()=>{await exactTab(tabId);if(typeof verifyBeforeFill==='function')await bounded(verifyBeforeFill,15000);}});
        await write({...result,expectedFingerprint:undefined,readyToSave:false});
        if(!await withProfileBinding(api.storage.local,binding,()=>clearExact(tabId,ownedLock),lifecycleOptions))fail('draft_pending_lock_changed');
      };
      if(action==='resume_refresh'){
        ownedLock=pending;reserved=true;sent=true;
        if(ownedLock?.requestId!==requestId||ownedLock.tabId!==tabId||ownedLock.origin!==ORIGIN||!await validSavedPhase(job.phaseProof,{requestId,profileBinding:binding}))fail('draft_saved_phase_not_verified');
        await refresh(job.phaseProof);return;
      }
      const targetMode=source.targetMode==='new'?'new':'existing';
      const recordMarker=targetMode==='new'?'new':String(source.rowIndex);
      if(targetMode==='existing'&&(!Number.isInteger(source.rowIndex)||source.rowIndex<0||source.rowIndex>29))fail('draft_job_target_invalid');
      if((await get(sourceKey(tabId)))?.requestId!==requestId||await get(pendingKey(tabId)))fail('draft_job_source_changed');
      // Deliberately inject only the saver. Reinjecting education would erase
      // the verified content STATUS that the saver independently requires.
      if(action==='inspect'){
        await bounded(()=>dispatchBoundSource(api.storage.local,binding,()=>api.scripting.executeScript({target:{tabId},files:['src/content/gth-draft-save.js']}),lifecycleOptions),15000);
        await exactTab(tabId);
        const result=await bounded(()=>dispatchBoundSource(api.storage.local,binding,()=>api.tabs.sendMessage(tabId,{type:'GTH_EDUCATION_DRAFT_INSPECT',requestId,recordMarker,targetMode,profileBinding:binding}),lifecycleOptions),20000);
        if(result?.ok!==true||result.readyToSave!==true||result.softwareClickedSave!==false
          ||result.expectedSnapshot?.requestId!==requestId||result.expectedSnapshot.recordMarker!==recordMarker
          ||!/^[a-f0-9]{64}$/u.test(result.expectedSnapshot.fingerprint||''))fail(safe(result?.reason)||'draft_job_preflight_failed');
        await write({state:'ready',recordMarker,targetMode,expectedFingerprint:result.expectedSnapshot.fingerprint,readyToSave:true});return;
      }
      ownedLock={tabId,origin:ORIGIN,requestId,kind:'gth_education_draft_save',recordMarker,at:Date.now(),profileBinding:binding};
      await withProfileBinding(api.storage.local,binding,()=>api.storage.local.set({[pendingKey(tabId)]:ownedLock}),lifecycleOptions);reserved=true;
      await write({state:'running',recordMarker,targetMode,readyToSave:false});
      await exactTab(tabId);
      if(!same(await get(pendingKey(tabId)),ownedLock)||(await get(sourceKey(tabId)))?.requestId!==requestId)fail('draft_job_source_changed');
      sent=true;
      const result=await bounded(()=>dispatchBoundSource(api.storage.local,binding,()=>api.tabs.sendMessage(tabId,{type:'GTH_EDUCATION_DRAFT_SAVE',requestId,recordMarker,targetMode,
        expectedFingerprint:job.expectedFingerprint,draftSaveAuthorized:true,lockOwnerRequestId:requestId,profileBinding:binding}),lifecycleOptions));
      await assertProfileBinding(api.storage.local,binding,lifecycleOptions);
      const status=await bounded(()=>api.tabs.sendMessage(tabId,{type:'GTH_EDUCATION_DRAFT_STATUS',requestId}),15000);
      const receipt=status?.ok===true?status.data:null;
      const verified=result?.ok===true&&result.state==='server_verified_needs_refresh'&&result.softwareClickedSave===true&&result.saveClickCount===1
        &&result.targetSaved===true&&result.serverReadbackMatched===true&&result.serverReadbackFields===12
        &&result.otherRecordPreserved===true&&result.readbackEditorClosed===true&&result.softwareClickedSubmit===false
        &&receipt?.requestId===requestId&&receipt.state==='server_verified_needs_refresh'&&receipt.serverReadbackMatched===true
        &&receipt.softwareClickedSave===true&&receipt.saveClickCount===1&&receipt.serverReadbackFields===12
        &&receipt.pendingReviewRequired===true&&same(receipt.phaseProof,result.phaseProof)&&await validSavedPhase(result.phaseProof,{requestId,profileBinding:binding});
      if(verified){
        await write({state:'server_verified_needs_refresh',expectedFingerprint:undefined,softwareClickedSave:true,saveClickCount:1,
          targetSaved:true,phaseProof:result.phaseProof,serverReadbackMatched:true,serverReadbackFields:12,otherSectionsPreserved:result.otherSectionsPreserved===true,otherRecordPreserved:true,
          readbackEditorClosed:true,readyToSave:false,refreshVerified:false,networkStatus:null,
          ...(result.newRecordCreated===true?{newRecordCreated:true,recordCountBefore:result.recordCountBefore,recordCountAfter:result.recordCountAfter}:{}),
          pendingReviewRequired:true});
        await refresh(result.phaseProof);return;
      }
      if(result?.softwareClickedSave===false&&result.state==='stopped_before_write'&&result.pendingReviewRequired===false){
        await write({state:'stopped_before_write',expectedFingerprint:undefined,reason:safe(result.reason),readyToSave:false});
        await clearExact(tabId,ownedLock);return;
      }
      await write({state:'unknown',expectedFingerprint:undefined,reason:safe(result?.reason),readyToSave:false,
        softwareClickedSave:result?.softwareClickedSave===true,saveClickCount:result?.saveClickCount===1?1:null,pendingReviewRequired:true});
    }catch(error){
      if(String(error?.message).startsWith('profile_')){
        await invalidateBoundJob(api.storage.local,key,job,{...lifecycleOptions,writeMayHaveStarted:sent});
        ack({ok:false,error:safe(error?.message),requestId,writeStarted:sent});return;
      }
      if(reserved&&!sent)await clearExact(tabId,ownedLock);
      if(started&&(await get(key))?.requestId===requestId)await write({state:sent?'unknown':'stopped_before_write',
        expectedFingerprint:undefined,reason:safe(error?.code||error?.message),pendingReviewRequired:sent,readyToSave:false});
      ack({ok:false,error:safe(error?.code||error?.message),requestId,writeStarted:sent});
    }finally{clearInterval(alive);running.delete(tabId);}
  }
  const listener=(message,sender,sendResponse)=>{
    if(!['GTH_EDUCATION_DRAFT_JOB_START','GTH_EDUCATION_DRAFT_JOB_STATUS'].includes(message?.type))return false;
    if(sender?.id!==api.runtime.id||sender.url!==api.runtime.getURL('src/popup/popup.html')||sender.tab){sendResponse({ok:false,error:'wrong_sender'});return false;}
    if(!Number.isSafeInteger(message.tabId)||message.tabId<0){sendResponse({ok:false,error:'draft_job_invalid'});return false;}
    if(message.type==='GTH_EDUCATION_DRAFT_JOB_STATUS'){
      get(draftJobKey(message.tabId)).then(async data=>{
        if(data)try{await assertProfileBinding(api.storage.local,data.profileBinding,lifecycleOptions);}
        catch{await invalidateBoundJob(api.storage.local,draftJobKey(message.tabId),data,{...lifecycleOptions,writeMayHaveStarted:data.action==='save'&&['running','unknown','completed'].includes(data.state)});
          return sendResponse({ok:true,data:await get(draftJobKey(message.tabId))});}
        return sendResponse({ok:true,data:data&&!running.has(message.tabId)
        &&['queued','running','refreshing_saved_record','verifying_saved_after_refresh'].includes(data.state)?{...data,state:'unknown',pendingReviewRequired:true}:data||null});},
        ()=>sendResponse({ok:false,error:'draft_job_status_failed'}));return true;
    }
    if(message.pageUrl!==PAGE||!['inspect','save','resume_refresh'].includes(message.action)||typeof message.requestId!=='string'
      ||!/^[A-Za-z0-9-]{8,120}$/u.test(message.requestId)||message.action==='save'&&
      (message.draftSaveAuthorized!==true||!/^[a-f0-9]{64}$/u.test(message.fingerprint||''))||message.action==='resume_refresh'&&!/^[a-f0-9]{64}$/u.test(message.phaseProofHash||'')){sendResponse({ok:false,error:'draft_job_invalid'});return false;}
    if(running.has(message.tabId)){sendResponse({ok:false,error:'draft_job_in_progress'});return false;}
    let replied=false;const ack=value=>{if(!replied){replied=true;try{sendResponse(value);}catch{/* Sender closed. */}}};
    const slot={promise:null};running.set(message.tabId,slot);
    slot.promise=execute(message,ack).catch(()=>{running.delete(message.tabId);ack({ok:false,error:'draft_job_failed'});});return true;
  };
  return {listener,waitForIdle:async()=>{await Promise.all([...running.values()].map(slot=>slot.promise));}};
}
export function installGthDraftTaskRunner(options={}){
  const runner=createGthDraftTaskRunner(options);(options.api||globalThis.chrome).runtime.onMessage.addListener(runner.listener);return runner;
}
