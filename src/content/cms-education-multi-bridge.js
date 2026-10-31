(function(){
  'use strict';
  const nativeMessages=chrome.runtime.onMessage,priorListener=globalThis.__resumeCmsMultiBridgeListener;
  if(nativeMessages.hasListeners?.()===false)globalThis.__resumeNativeListenersResetObserved=true;
  if(priorListener&&nativeMessages.hasListener?.(priorListener)===true){
    if(globalThis.__resumeCmsMultiBridgeRevision===4)return;
    if(globalThis.ResumeProfileWriteContext)throw Error('profile_write_context_busy');nativeMessages.removeListener(priorListener);
  }else if(globalThis.__resumeCmsMultiBridgeInstalled&&!priorListener&&nativeMessages.hasListeners?.()===true&&!globalThis.__resumeNativeListenersResetObserved)throw Error('extension_reload_required');
  globalThis.__resumeCmsMultiBridgeInstalled=true;
  const PAGE='https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html',jobs=new Map();
  const fail=reason=>{throw Error(reason);};
  const resumeKey=href=>{try{const url=new URL(href);return url.origin+url.pathname===PAGE?url.searchParams.get('resumeId')||'':null;}catch{return null;}};
  // Same document load (timeOrigin) on resumeOperation; tolerate SPA query churn.
  const sameDoc=doc=>{
    if(!doc||location.origin+location.pathname!==PAGE||performance.timeOrigin!==doc.timeOrigin)return false;
    const a=resumeKey(doc.href),b=resumeKey(location.href);
    return a!==null&&b!==null&&a===b;
  };
  const bridgeListener=(message,sender,sendResponse)=>{
    if(!['CMS_EDUCATION_MULTI_INSPECT','CMS_EDUCATION_MULTI_RUN','CMS_EDUCATION_MULTI_STATUS'].includes(message?.type))return false;
    if(sender?.id!==chrome.runtime.id||location.origin+location.pathname!==PAGE){sendResponse({ok:false,reason:'cms_education_wrong_sender_or_site'});return false;}
    if(message.type==='CMS_EDUCATION_MULTI_STATUS'){const job=jobs.get(message.requestId);sendResponse(job?{ok:true,requestId:message.requestId,state:job.state}:{ok:false,reason:'cms_education_request_unknown'});return false;}
    if(!sameDoc(message.document)){sendResponse({ok:false,reason:'cms_education_document_changed'});return false;}
    if(message.type==='CMS_EDUCATION_MULTI_INSPECT'){const view=globalThis.ResumeCmsEducationMulti?.inspect();sendResponse(view?.ok?{ok:true,data:{document:message.document,rows:view.records.map(({identity,fields})=>({identity,fields}))}}:{ok:false,reason:view?.reason||'cms_education_module_unavailable'});return false;}
    if(jobs.has(message.requestId)||[...jobs.values()].some(job=>job.state==='running')){sendResponse({ok:false,reason:'cms_education_content_job_in_progress'});return false;}
    jobs.set(message.requestId,{state:'running'});
    (async()=>{
      const sourceCheck=async(profileIndex,sourceSnapshotHash)=>{if(!sameDoc(message.document))return false;const result=await chrome.runtime.sendMessage({type:'CMS_EDUCATION_MULTI_SOURCE_CHECK',requestId:message.requestId,profileIndex,sourceSnapshotHash});return sameDoc(message.document)&&result?.ok===true;};
      const session=await globalThis.ResumeCmsSession?.check();if(!sameDoc(message.document))return {ok:false,complete:false,reason:'cms_education_document_changed',writeStarted:false,addClicks:0,saveClicks:0,deleteClicks:0,finalSubmitClicks:0};if(session?.ok!==true)return {ok:false,complete:false,reason:session?.reason||'session_check_unavailable',writeStarted:false,addClicks:0,saveClicks:0,deleteClicks:0,finalSubmitClicks:0};
      const result=await globalThis.ResumeCmsEducationMulti.run(message.plan,{verifyBeforeWrite:()=>sourceCheck(),checkOwner:()=>sourceCheck(),checkSource:sourceCheck,
        readSerialization:bindings=>chrome.runtime.sendMessage({type:'CMS_EDUCATION_MULTI_VERIFY_PROPS',requestId:message.requestId,bindings}),verifySerialization:async(_plan,_bindings,proof)=>proof,adapters:globalThis.ResumeCmsEducationMultiAdapters});
      return result;
    })().then(data=>{jobs.set(message.requestId,{state:'settled',writeStarted:data.writeStarted});sendResponse({ok:data.ok===true,data});},error=>{jobs.set(message.requestId,{state:'settled',writeStarted:true});sendResponse({ok:false,data:{ok:false,complete:false,reason:/^[a-z0-9_]+$/u.test(error?.message||'')?error.message:'cms_education_content_failed',writeStarted:true,saveClicks:0,deleteClicks:0,finalSubmitClicks:0}});});return true;
  };nativeMessages.addListener(bridgeListener);globalThis.__resumeCmsMultiBridgeListener=bridgeListener;globalThis.__resumeCmsMultiBridgeRevision=4;
})();
