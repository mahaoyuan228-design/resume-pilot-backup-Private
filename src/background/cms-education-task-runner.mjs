// Persistent normal-popup CMS education job. Applicant facts stay in transient
// owned messages only; stored jobs contain source references and public outcomes.
import {captureProfileBinding,assertProfileBinding,withProfileBinding,dispatchBoundSource,reserveBoundJob,commitBoundJob,invalidateBoundJob} from '../profile/profile-lifecycle.js';
import {createPlan as createEducationPlan,sourceSnapshot as educationSnapshot,hash,PAGE} from '../profile/cms-education-plan.mjs';
import {createPlan as createInternshipPlan,sourceSnapshot as internshipSnapshot} from '../profile/cms-internship-plan.mjs';
import {readCmsInternshipSerialization,verifyInternshipSerialization} from '../content/cms-internship-serialization.mjs';
import {activeSiteFacts,SITE_FACTS_KEY} from '../profile/cms-education-site-facts.mjs';
import {readCmsEducationSerialization,verifyEducationSerialization} from '../content/cms-education-serialization.mjs';
import {awaitCmsPageDocumentFocus} from './cms-page-focus.mjs';
export const cmsEducationJobKey=tabId=>`resumeCmsEducationJob:${tabId}`;
const origin=new URL(PAGE).origin,pendingKey=tabId=>`resumePendingFillReview:${tabId}`;
const EDUCATION_FILES=['src/content/cms-session.js','src/content/cms-record-controller.js','src/content/cms-education-multi.js','src/content/cms-education-multi-school.js','src/content/cms-education-multi-dates.js','src/content/cms-education-multi-region.js','src/content/cms-education-multi-select.js','src/content/cms-education-multi-adapters.js','src/content/cms-education-multi-bridge.js'];
const stable=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const base=value=>{try{const u=new URL(value);return u.origin+u.pathname;}catch{return null;}};
const fail=reason=>{throw Error(reason);},safe=error=>/^[a-z0-9_]{2,100}$/u.test(error?.message||'')?error.message:'cms_education_job_failed';
const descriptor=records=>records.map(({profileIndex,sourceSnapshotHash,supplementRefHash,target,replaceExisting})=>({profileIndex,sourceSnapshotHash,supplementRefHash,target,replaceExisting}));
export function createCmsEducationTaskRunner({api=globalThis.chrome,verifyBeforeFill=null,recordKind='education',timeoutMs=150000,keepAliveMs=15000,...bindingOptions}={}){
  if(!['education','internship'].includes(recordKind))throw Error('cms_record_kind_invalid');
  const internship=recordKind==='internship',collection=internship?'experience':'education',kind=internship?'cms_internship_multi':'cms_education_multi';
  const sourceSnapshot=internship?internshipSnapshot:educationSnapshot,createPlan=internship?createInternshipPlan:createEducationPlan;
  const readSerialization=internship?readCmsInternshipSerialization:readCmsEducationSerialization,verifySerialization=internship?verifyInternshipSerialization:verifyEducationSerialization;
  const messageType=suffix=>(internship?'CMS_INTERNSHIP_MULTI_':'CMS_EDUCATION_MULTI_')+suffix;
  const jobKey=tabId=>internship?`resumeCmsInternshipJob:${tabId}`:cmsEducationJobKey(tabId);
  const FILES=internship?['src/content/cms-session.js','src/content/cms-record-controller.js','src/content/cms-internship-multi.js','src/content/cms-education-multi-dates.js','src/content/cms-education-multi-select.js','src/content/cms-internship-adapters.js','src/content/cms-internship-bridge.js']:EDUCATION_FILES;
  const running=new Map(),get=async key=>(await api.storage.local.get(key))[key],paid=()=>api.runtime.getManifest?.().background?.service_worker==='src/license/guard-worker.mjs';
  const bounded=(work,ms=timeoutMs)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('cms_education_job_timeout')),ms);Promise.resolve().then(work).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});});
  const license=async()=>{if(paid()&&typeof verifyBeforeFill!=='function')fail('license_required');if(verifyBeforeFill)try{await bounded(verifyBeforeFill,15000);}catch{fail('license_required');}};
  // Document identity = same PAGE load (timeOrigin) on same resumeId.
  // SPA query churn must not abort; brief visibility flakes are retried.
  // True reload (timeOrigin change) may rebind once before RUN when allowRebind.
  const resumeKey=href=>{try{return new URL(href).searchParams.get('resumeId')||'';}catch{return '';}};
  const sameResumeDocument=(expected,live)=>{
    if(!expected||!live||base(live.href)!==PAGE||!Number.isFinite(live.timeOrigin))return false;
    if(Number(live.timeOrigin)!==Number(expected.timeOrigin))return false;
    const a=resumeKey(expected.href),b=resumeKey(live.href);
    if(a&&b&&a!==b)return false;
    return true;
  };
  const mainFrameResult=rows=>rows?.length===1&&(rows[0].frameId===0||rows[0].frameId==null)?rows[0].result:null;
  const probeDocument=async tabId=>{
    const results=await api.scripting.executeScript({target:{tabId},world:'MAIN',func:()=>({href:location.href,timeOrigin:performance.timeOrigin,visible:document.visibilityState==='visible'})});
    return mainFrameResult(results);
  };
  const sleepBrief=ms=>new Promise(done=>setTimeout(done,ms));
  const exactTab=async(tabId,expected=null,{allowRebind=false}={})=>{
    const ensureActive=async()=>{
      const tab=await api.tabs.get(tabId);
      if(tab?.id!==tabId||base(tab.url)!==PAGE)fail('cms_education_active_tab_changed');
      await api.tabs.update(tabId,{active:true});
      if(Number.isSafeInteger(tab.windowId)&&api.windows?.update){
        try{await api.windows.update(tab.windowId,{focused:true});}catch{/* OS may deny */}
      }
      const active=await api.tabs.query({active:true,lastFocusedWindow:true});
      if(active.length!==1||active[0].id!==tabId)fail('cms_education_active_tab_changed');
      return tab;
    };
    await ensureActive();
    let doc=await probeDocument(tabId);
    // Window blur / helper-tab steal often flips visibility without a real reload.
    // Refocus and retry before classifying as document_changed.
    if(doc&&base(doc.href)===PAGE&&Number.isFinite(doc.timeOrigin)&&!doc.visible){
      for(let i=0;i<50&&doc&&!doc.visible;i+=1){
        await ensureActive();
        await sleepBrief(100);
        doc=await probeDocument(tabId);
      }
    }
    if(!doc||base(doc.href)!==PAGE||!Number.isFinite(doc.timeOrigin))fail('cms_education_document_changed');
    if(!doc.visible)fail('page_unfocused');
    if(!expected)return doc;
    if(sameResumeDocument(expected,doc)){
      if(typeof expected==='object'&&doc.href!==expected.href)expected.href=doc.href;
      return doc;
    }
    if(allowRebind){
      const a=resumeKey(expected.href),b=resumeKey(doc.href);
      if(!a||!b||a===b)return {...doc,rebound:true};
    }
    fail('cms_education_document_changed');
  };
  const matchingPending=async tabId=>{const all=await api.storage.local.get([pendingKey(tabId),'resumePendingFillReview']);return all[pendingKey(tabId)]||all.resumePendingFillReview?.tabId===tabId&&all.resumePendingFillReview?.origin===origin;};
  const clearOwnPending=async(tabId,requestId)=>{const value=await get(pendingKey(tabId));if(value?.requestId===requestId&&value.tabId===tabId)await api.storage.local.remove(pendingKey(tabId));};
  const refs=async(raw,binding)=>{const facts=internship?{entries:[]}:await activeSiteFacts(raw,binding,await get(SITE_FACTS_KEY));return {facts:facts.entries,bySource:await Promise.all((raw[collection]||[]).map(async(row,profileIndex)=>({profileIndex,sourceSnapshotHash:(await sourceSnapshot(raw,profileIndex)).hash,supplementRefHash:await hash(facts.entries.filter(entry=>entry.profileIndex===profileIndex)),eligible:!internship||row.type==='internship'})))};};
  async function checkSlot(slot){await assertProfileBinding(api.storage.local,slot.binding,bindingOptions);await exactTab(slot.tabId,slot.document);
    const raw=await get('resumeProfile'),current=await refs(raw,slot.binding);for(const record of slot.records){const found=current.bySource.find(row=>row.profileIndex===record.profileIndex);if(!found||found.sourceSnapshotHash!==record.sourceSnapshotHash||found.supplementRefHash!==record.supplementRefHash)fail('cms_education_source_or_supplement_changed');}await assertProfileBinding(api.storage.local,slot.binding,bindingOptions);return {raw,current};}
  function assertKnownPartial(slot,result){
    const verification=slot.serializationVerification,bindings=result.bindings,fields=result.fields;
    if(result.ok!==true||result.complete!==false||result.saveClicks!==0||result.deleteClicks!==0||result.finalSubmitClicks!==0||!verification?.ok||!Array.isArray(bindings)||bindings.length!==slot.plan.records.length||new Set(bindings.map(row=>row.identity)).size!==bindings.length||new Set(bindings.map(row=>row.profileIndex)).size!==bindings.length||stable(bindings)!==stable(slot.serializationBindings)||stable(result.serialization)!==stable(verification.records)||result.serializedRecordCount!==verification.serializedRecordCount||result.serializedRecordCount!==bindings.length||!Number.isSafeInteger(result.addClicks)||result.addClicks<0||result.addClicks>slot.plan.records.filter(row=>row.target.mode==='new').length||result.provisionalNewRecords!==result.addClicks)fail('cms_education_partial_proof_incomplete');
    if(!Array.isArray(fields)||fields.length!==slot.plan.records.reduce((sum,row)=>sum+Object.keys(row.facts).length,0)||!fields.some(field=>field.status==='failed')||new Set(fields.map(field=>field.profileIndex+':'+field.key)).size!==fields.length)fail('cms_education_partial_fields_incomplete');
    if(!Array.isArray(verification.records)||verification.records.length!==bindings.length||new Set(verification.records.map(row=>row.profileIndex)).size!==bindings.length)fail('cms_education_partial_proof_incomplete');
    for(const record of slot.plan.records){const bound=bindings.filter(row=>row.profileIndex===record.profileIndex),rows=verification.records.filter(row=>row.profileIndex===record.profileIndex);if(bound.length!==1||rows.length!==1||typeof bound[0].identity!=='string'||!bound[0].identity||rows[0].identity!==bound[0].identity||record.target.mode==='existing'&&record.target.identity!==bound[0].identity||rows[0].fields.length!==Object.keys(record.facts).length||new Set(rows[0].fields.map(field=>field.key)).size!==rows[0].fields.length)fail('cms_education_partial_binding_incomplete');
      for(const [key,fact]of Object.entries(record.facts)){const matched=fields.filter(field=>field.profileIndex===record.profileIndex&&field.key===key),serial=rows[0].fields.filter(field=>field.key===key);if(matched.length!==1||serial.length!==1||matched[0].question!==serial[0].question||matched[0].path!==fact.path||serial[0].path!==fact.path||!['verified','failed','skipped'].includes(matched[0].status)||!['verified','failed','skipped'].includes(serial[0].status)||typeof serial[0].required!=='boolean'||typeof matched[0].reason!=='string'||matched[0].status==='verified'&&serial[0].status!=='verified')fail('cms_education_partial_fields_incomplete');}
    }
  }
  async function commitKnownPartial(slot,key,job){await checkSlot(slot);await withProfileBinding(api.storage.local,slot.binding,async()=>{await checkSlot(slot);const current=await get(key),pending=await get(pendingKey(slot.tabId));if(current?.requestId!==slot.requestId||pending?.requestId!==slot.requestId||pending.tabId!==slot.tabId||pending.origin!==origin||stable(pending.profileBinding)!==stable(slot.binding))fail('cms_education_partial_owner_changed');await api.storage.local.set({[key]:job});await assertProfileBinding(api.storage.local,slot.binding,bindingOptions);if(stable(await get(key))!==stable(job)||stable(await get(pendingKey(slot.tabId)))!==stable(pending))fail('cms_education_partial_owner_changed');await api.storage.local.remove(pendingKey(slot.tabId));},bindingOptions);}
  async function inspect(message){const tabId=message.tabId;if(await matchingPending(tabId))fail('cms_education_pending_review');const binding=await captureProfileBinding(api.storage.local,bindingOptions),document=await exactTab(tabId),raw=await get('resumeProfile'),source=await refs(raw,binding);
    await api.scripting.executeScript({target:{tabId},files:FILES});await assertProfileBinding(api.storage.local,binding,bindingOptions);await exactTab(tabId,document);
    const reply=await dispatchBoundSource(api.storage.local,binding,()=>api.tabs.sendMessage(tabId,{type:messageType('INSPECT'),document}),bindingOptions);await assertProfileBinding(api.storage.local,binding,bindingOptions);
    if(!reply?.ok||reply.data?.document?.timeOrigin!==document.timeOrigin||base(reply.data?.document?.href)!==PAGE)fail(reply?.reason||'cms_education_inspect_failed');
    if(reply.data.document.href!==document.href)document.href=reply.data.document.href;
    return {ok:true,profileBinding:binding,document,rows:reply.data.rows,sources:source.bySource.filter(row=>row.eligible).map(row=>({...row,label:(internship?[raw.experience[row.profileIndex]?.organization,raw.experience[row.profileIndex]?.position,raw.experience[row.profileIndex]?.startDate,raw.experience[row.profileIndex]?.endDate]:[raw.education[row.profileIndex]?.school,raw.education[row.profileIndex]?.degree,raw.education[row.profileIndex]?.startDate,raw.education[row.profileIndex]?.endDate]).filter(Boolean).join(' · ')}))};}
  function validRequest(message){return message?.pageUrl===PAGE&&Number.isSafeInteger(message.tabId)&&message.tabId>=0&&message.profileBinding?.version===1&&message.document&&typeof message.document.href==='string'&&Number.isFinite(message.document.timeOrigin)&&Array.isArray(message.records)&&message.records.length>0&&message.records.length<=30
    &&new Set(message.records.map(row=>row?.profileIndex)).size===message.records.length&&message.records.every(row=>Number.isInteger(row?.profileIndex)&&row.profileIndex>=0&&row.profileIndex<=29&&/^[a-f0-9]{64}$/u.test(row.sourceSnapshotHash||'')&&/^[a-f0-9]{64}$/u.test(row.supplementRefHash||'')&&typeof row.replaceExisting==='boolean'&&['existing','new'].includes(row.target?.mode)&&(row.target.mode==='new'?!Object.hasOwn(row.target,'identity'):typeof row.target.identity==='string'&&row.target.identity.length>0&&row.target.identity.length<5000));}
  async function execute(message,requestId,respond){const tabId=message.tabId,key=jobKey(tabId),binding=message.profileBinding;let reserved=false,dispatched=false,job={version:1,tabId,origin,requestId,kind,action:'fill',at:Date.now(),state:'queued',profileBinding:binding,records:descriptor(message.records),document:message.document,complete:false};
    const timer=setInterval(()=>api.storage.local.get(key).catch(()=>{}),keepAliveMs);let slot;
    try{await license();await assertProfileBinding(api.storage.local,binding,bindingOptions);if(await matchingPending(tabId))fail('cms_education_pending_review');const previous=await get(key);if(previous&&['queued','running','unknown'].includes(previous.state))fail('cms_education_pending_review');
      slot={tabId,requestId,binding,document:message.document,records:descriptor(message.records),plan:null};running.set(tabId,slot);await checkSlot(slot);const {raw,current}=await checkSlot(slot);
      slot.plan=await createPlan(raw,slot.records,current.facts,binding);await reserveBoundJob(api.storage.local,key,job,binding,previous,bindingOptions);reserved=true;
      await withProfileBinding(api.storage.local,binding,async()=>{if((await get(key))?.requestId!==requestId)fail('profile_job_owner_changed');if(await matchingPending(tabId))fail('cms_record_other_job_pending');await api.storage.local.set({[pendingKey(tabId)]:{requestId,tabId,origin,kind,at:Date.now(),state:'queued',profileBinding:binding}});},bindingOptions);respond({ok:true,accepted:true,requestId});
      await api.scripting.executeScript({target:{tabId},files:FILES});await checkSlot(slot);job={...job,state:'running',at:Date.now()};await commitBoundJob(api.storage.local,key,job,binding,bindingOptions);
      await awaitCmsPageDocumentFocus(api,tabId,{timeoutMs:Number.isFinite(message.focusTimeoutMs)?message.focusTimeoutMs:(message.auto?10000:2000),intervalMs:100});
      let liveDoc=await exactTab(tabId,slot.document,{allowRebind:true});
      if(liveDoc?.rebound){
        slot.document={href:liveDoc.href,timeOrigin:liveDoc.timeOrigin,visible:true};
        job={...job,document:slot.document,documentRebound:true,at:Date.now()};
        await commitBoundJob(api.storage.local,key,job,binding,bindingOptions);
        await api.scripting.executeScript({target:{tabId},files:FILES});
        await exactTab(tabId,slot.document);
      }
      dispatched=true;const response=await bounded(()=>dispatchBoundSource(api.storage.local,binding,()=>api.tabs.sendMessage(tabId,{type:messageType('RUN'),requestId,document:slot.document,plan:slot.plan,profileBinding:binding}),bindingOptions));
      await assertProfileBinding(api.storage.local,binding,bindingOptions);const status=await api.tabs.sendMessage(tabId,{type:messageType('STATUS'),requestId});
      if(status?.ok!==true||status.state!=='settled'||status.requestId!==requestId)fail('cms_education_content_outcome_unknown');
      const result=response?.data;if(!response?.ok||!result||result.finalSubmitClicks!==0||result.saveClicks!==0||result.deleteClicks!==0){if(result?.writeStarted===false){job={...job,state:'stopped_before_write',reason:result.reason||response?.reason||'cms_education_stopped',complete:false,fields:Array.isArray(result.fields)?result.fields:[],bindings:Array.isArray(result.bindings)?result.bindings:[]};await commitBoundJob(api.storage.local,key,job,binding,bindingOptions);await clearOwnPending(tabId,requestId);return;}
        // Preserve precise content/serialization reasons + any fields instead of opaque unknown.
        if(result&&typeof result.reason==='string'&&/^[a-z0-9_]+$/u.test(result.reason)&&result.reason!=='cms_education_document_changed'){
          const fields=Array.isArray(result.fields)?result.fields:[],wrote=result.writeStarted===true;
          const state=wrote?(fields.some(f=>f.status==='verified')?'partial':'unknown'):'stopped_before_write';
          job={...job,state,reason:result.reason,complete:false,fields,bindings:Array.isArray(result.bindings)?result.bindings:[],writeStarted:wrote,phase:result.phase||null,at:Date.now()};
          await commitBoundJob(api.storage.local,key,job,binding,bindingOptions);
          if(!wrote)await clearOwnPending(tabId,requestId);
          return;
        }
        fail(result?.reason||response?.reason||'cms_education_content_outcome_unknown');}
      const fields=(result.fields||[]).map(({profileIndex,key,question,path,status,reason,primaryReason,selectionAttempted,selectionReadbackMatched,hasProfileValue,confirmed,valuePreview,fullDay,searchText,desiredOptionText,visibleOptionCount,createTemplatePresent,sampleOptions,candidateOptions,hint,rowWasEmpty,allowCategoryOverwrite,existingDisplay,intendedDisplay,liveDisplay,selectorStep,stopCode})=>({profileIndex,key,question,path,status,reason,...(typeof primaryReason==='string'&&/^[a-z0-9_]+$/u.test(primaryReason)?{primaryReason}:{}),...(typeof selectionAttempted==='boolean'?{selectionAttempted}:{}),...(typeof selectionReadbackMatched==='boolean'?{selectionReadbackMatched}:{}),...(typeof hasProfileValue==='boolean'?{hasProfileValue}:{}),...(typeof confirmed==='boolean'?{confirmed}:{}),...(typeof valuePreview==='string'?{valuePreview:valuePreview.slice(0,80)}:{}),...(typeof fullDay==='boolean'?{fullDay}:{}),...(typeof searchText==='string'?{searchText:searchText.slice(0,160)}:{}),...(typeof desiredOptionText==='string'?{desiredOptionText:desiredOptionText.slice(0,160)}:{}),...(typeof visibleOptionCount==='number'?{visibleOptionCount}:{}),...(typeof createTemplatePresent==='boolean'?{createTemplatePresent}:{}),...(Array.isArray(sampleOptions)?{sampleOptions:sampleOptions.slice(0,5).map(v=>String(v).slice(0,80))}:{}),...(Array.isArray(candidateOptions)?{candidateOptions:candidateOptions.slice(0,12).map(v=>String(v).slice(0,80))}:{}),...(typeof hint==='string'?{hint:hint.slice(0,120)}:{}),...(typeof rowWasEmpty==='boolean'?{rowWasEmpty}:{}),...(typeof allowCategoryOverwrite==='boolean'?{allowCategoryOverwrite}:{}),...(typeof existingDisplay==='string'?{existingDisplay}:{}),...(typeof intendedDisplay==='string'?{intendedDisplay}:{}),...(typeof liveDisplay==='string'?{liveDisplay}:{}),...(typeof selectorStep==='string'?{selectorStep}:{}),...(typeof stopCode==='string'?{stopCode}:{})})),unverified=fields.some(field=>field.status==='failed');
      if(unverified)assertKnownPartial(slot,result);
      job={...job,state:unverified?'partial':result.complete?'completed':'partial',complete:result.complete===true&&!unverified,fields,bindings:result.bindings,addClicks:result.addClicks,serializedRecordCount:result.serializedRecordCount,provisionalNewRecords:result.provisionalNewRecords,
        reason:unverified?'cms_education_requires_review':result.reason,websiteSaved:false,finalSubmitClicks:0,at:Date.now()};if(unverified)await commitKnownPartial(slot,key,job);else{await commitBoundJob(api.storage.local,key,job,binding,bindingOptions);await clearOwnPending(tabId,requestId);}
    }catch(error){const reason=safe(error);if(reserved){try{await assertProfileBinding(api.storage.local,binding,bindingOptions);
        let documentDiag=null;
        if(reason==='cms_education_document_changed'||reason==='page_unfocused'){
          try{
            const live=await probeDocument(tabId);
            documentDiag={expectedHref:slot?.document?.href||null,expectedTimeOrigin:slot?.document?.timeOrigin??null,liveHref:live?.href||null,liveTimeOrigin:live?.timeOrigin??null,liveVisible:live?.visible??null,sameResume:!!(slot?.document&&live&&sameResumeDocument(slot.document,live))};
          }catch{documentDiag={probeFailed:true};}
        }
        job={...job,state:dispatched?'unknown':'stopped_before_write',reason,complete:false,at:Date.now(),...(documentDiag?{documentDiag}:{})};await commitBoundJob(api.storage.local,key,job,binding,bindingOptions);if(!dispatched)await clearOwnPending(tabId,requestId);}catch{await invalidateBoundJob(api.storage.local,key,job,{writeMayHaveStarted:dispatched,...bindingOptions}).catch(()=>{});}}
      respond({ok:false,reason,requestId,writeMayHaveStarted:dispatched});
    }finally{clearInterval(timer);if(slot)slot.plan=null;if(running.get(tabId)?.requestId===requestId)running.delete(tabId);}}

  const autoPageUrl=()=>api.runtime.getURL(internship?'src/auto/cms-internship-auto.html':'src/auto/cms-education-auto.html');
  // CANONICAL internship auto UI: cms-education-auto.html?mode=internship_* .
  // cms-internship-auto.html redirects here (Edge historically silent on that module).
  const educationAutoPageUrl=()=>api.runtime.getURL('src/auto/cms-education-auto.html');
  const popupPageUrl=()=>api.runtime.getURL('src/popup/popup.html');
  const autoStorageKey=internship?'resumeCmsInternshipAutoRun':'resumeCmsEducationAutoRun';
  const autoKind=internship?'cms_internship_auto':'cms_education_auto';
  const autoType=internship?'CMS_INTERNSHIP_AUTO':'CMS_EDUCATION_AUTO_FILL';
  const trustedUi=sender=>{
    if(sender?.id!==api.runtime.id||typeof sender.url!=='string')return false;
    const url=sender.url.split('?')[0].split('#')[0];
    if(url===popupPageUrl())return !sender.tab;
    if(url===autoPageUrl())return true;
    return internship&&url===educationAutoPageUrl();
  };
  const sleep=ms=>new Promise(done=>setTimeout(done,ms));
  const fieldText=(row,key)=>{
    const hit=(row.fields||[]).find(field=>field.key===key||field.question===key);
    const value=hit?.value;
    if(Array.isArray(value))return value.filter(Boolean).join(' ');
    return value==null?'':String(value);
  };
  const normalize=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/\s+/gu,'');
  async function unlockIfSafe(tabId){
    const key=jobKey(tabId),pending=pendingKey(tabId);
    const stored=await api.storage.local.get([key,pending,'resumePendingFillReview']);
    const job=stored[key];
    if(job&&['queued','running'].includes(job.state))fail('cms_education_job_in_progress');
    const remove=[pending];
    if(stored.resumePendingFillReview?.tabId===tabId)remove.push('resumePendingFillReview');
    if(job&&['unknown','unknown_profile_invalidated','partial','stopped_before_write','completed'].includes(job.state))remove.push(key);
    if(remove.length)await api.storage.local.remove(remove);
    return {cleared:remove,previousState:job?.state||null};
  }
  async function findCmsTab(excludeTabId=null){
    const tabs=await api.tabs.query({});
    let cms=tabs.filter(tab=>base(tab.url)===PAGE&&tab.id!==excludeTabId);
    if(cms.length===1)return cms[0];
    if(cms.length>1){
      const ranked=[...cms].sort((a,b)=>{
        const access=(b.lastAccessed||0)-(a.lastAccessed||0);
        if(access)return access;
        return (b.id||0)-(a.id||0);
      });
      const activePreferred=ranked.find(tab=>tab.active===true);
      return activePreferred||ranked[0];
    }
    const related=tabs.filter(tab=>typeof tab.url==='string'&&tab.id!==excludeTabId&&(/hotjob\.cn/u.test(tab.url)||/wecruit/u.test(tab.url)));
    if(related.length){
      const err=Error('cms_education_login_or_wrong_page');
      err.helpUrl=related[0].url;
      err.helpReason='CMS resumeOperation.html not open; related tab may need login/SSO';
      throw err;
    }
    fail('cms_education_tab_missing');
  }
  function normalizeAlsoIndexes(message,primary){
    const raw=message?.alsoProfileIndexes??message?.alsoProfileIndex??[];
    const list=Array.isArray(raw)?raw:(Number.isInteger(raw)?[raw]:String(raw||'').split(/[,\s]+/).filter(Boolean).map(v=>Number.parseInt(v,10)));
    const out=[];
    for(const value of list){
      if(!Number.isInteger(value)||value<0||value>29||value===primary||out.includes(value))continue;
      out.push(value);
    }
    return out;
  }
  function bindRecords(inspected,profileIndex,replaceExisting,alsoProfileIndexes=[]){
    const source=inspected.sources.find(row=>row.profileIndex===profileIndex);
    if(!source)fail('cms_education_auto_source_missing');
    const rows=inspected.rows||[];
    if(!rows.length){
      const records=[{...source,target:{mode:'new'},replaceExisting:false}];
      for(const index of alsoProfileIndexes){
        const extra=inspected.sources.find(row=>row.profileIndex===index);
        if(!extra)fail('cms_education_auto_also_source_missing');
        records.push({profileIndex:extra.profileIndex,sourceSnapshotHash:extra.sourceSnapshotHash,supplementRefHash:extra.supplementRefHash,target:{mode:'new'},replaceExisting:false});
      }
      return records;
    }
    const label=normalize(source.label||'');
    const scored=rows.map(row=>{
      const school=normalize(fieldText(row,'school')||fieldText(row,'学校'));
      const organization=normalize(fieldText(row,'organization')||fieldText(row,'企业名称')||fieldText(row,'公司'));
      const position=normalize(fieldText(row,'position')||fieldText(row,'职位名称'));
      const start=normalize(fieldText(row,'startDate')||fieldText(row,'开始时间'));
      const end=normalize(fieldText(row,'endDate')||fieldText(row,'结束时间'));
      let score=0;
      if(internship){
        if(organization&&label.includes(organization.slice(0,Math.min(6,organization.length))))score+=5;
        if(organization&&label.includes(organization))score+=8;
        if(position&&label.includes(position.slice(0,Math.min(4,position.length))))score+=3;
        if(position&&label.includes(position))score+=4;
      }else{
        if(school&&label.includes(school.slice(0,Math.min(6,school.length))))score+=5;
        if(school&&(school.includes('sydney')||school.includes('悉尼')||label.includes(school)))score+=8;
      }
      if(start&&label.includes(start.slice(0,7)))score+=2;
      if(end&&label.includes(end.slice(0,7)))score+=2;
      if(!internship){
        if(label.includes('2023-02')&&start.includes('2023-02'))score+=3;
        if(label.includes('2024-11')&&end.includes('2024-11'))score+=3;
      }
      return {row,score};
    }).sort((a,b)=>b.score-a.score);
    let primary=scored[0]?.row;
    if(rows.length===1)primary=rows[0];
    else if(!primary||scored[0].score<=0){
      // Prefer empty-ish row for replace when scores tie at zero.
      const empty=rows.find(row=>(row.fields||[]).every(field=>!field.value||Array.isArray(field.value)&&field.value.every(value=>!value)));
      if(empty&&rows.length===1)primary=empty;
      else if(scored[0]?.score>0)primary=scored[0].row;
      else fail('cms_education_auto_row_unmatched');
    }
    const used=new Set([profileIndex]);
    const records=[{profileIndex:source.profileIndex,sourceSnapshotHash:source.sourceSnapshotHash,supplementRefHash:source.supplementRefHash,target:{mode:'existing',identity:primary.identity},replaceExisting:!!replaceExisting}];
    const leftover=rows.filter(row=>row.identity!==primary.identity);
    const freeSources=inspected.sources.filter(row=>!used.has(row.profileIndex));
    for(const row of leftover){
      const school=normalize(fieldText(row,'school')||fieldText(row,'学校'));
      const organization=normalize(fieldText(row,'organization')||fieldText(row,'企业名称')||fieldText(row,'公司'));
      const needle=internship?organization:school;
      const matches=freeSources.filter(src=>needle&&normalize(src.label||'').includes(needle.slice(0,Math.min(4,needle.length)))||needle&&normalize(src.label||'').includes(needle));
      // Prefer explicit alsoProfileIndexes when school/org needle is empty (e.g. both
      // CMS rows soft-skipped school) so dual-row re-fill does not bind_ambiguous.
      const alsoCandidates=alsoProfileIndexes.map(index=>freeSources.find(src=>src.profileIndex===index)).filter(Boolean);
      const pick=matches.length===1?matches[0]
        :(alsoCandidates.length===1?alsoCandidates[0]
        :(freeSources.length===1&&leftover.length===1?freeSources[0]:null));
      if(!pick)fail('cms_education_auto_bind_ambiguous');
      used.add(pick.profileIndex);
      freeSources.splice(freeSources.indexOf(pick),1);
      const alsoReplace=alsoProfileIndexes.includes(pick.profileIndex)&&!!replaceExisting;
      records.push({profileIndex:pick.profileIndex,sourceSnapshotHash:pick.sourceSnapshotHash,supplementRefHash:pick.supplementRefHash,target:{mode:'existing',identity:row.identity},replaceExisting:alsoReplace});
    }
    for(const index of alsoProfileIndexes){
      if(used.has(index))continue;
      const extra=inspected.sources.find(row=>row.profileIndex===index);
      if(!extra)fail('cms_education_auto_also_source_missing');
      used.add(index);
      records.push({profileIndex:extra.profileIndex,sourceSnapshotHash:extra.sourceSnapshotHash,supplementRefHash:extra.supplementRefHash,target:{mode:'new'},replaceExisting:false});
    }
    return records;
  }
  async function waitJob(tabId,requestId,ms){
    const terminal=new Set(['completed','partial','stopped_before_write','unknown','unknown_profile_invalidated']);
    const deadline=Date.now()+ms;
    while(Date.now()<deadline){
      const data=await get(jobKey(tabId));
      if(data?.requestId===requestId&&terminal.has(data.state))return data;
      if(!running.has(tabId)){
        const again=await get(jobKey(tabId));
        if(again?.requestId===requestId)return again;
      }
      await sleep(400);
    }
    fail('cms_education_job_timeout');
  }
  async function autoFill(message,sender=null){
    const profileIndex=Number.isInteger(message.profileIndex)?message.profileIndex:(internship?0:5);
    const alsoProfileIndexes=normalizeAlsoIndexes(message,profileIndex);
    const replaceExisting=message.replaceExisting!==false;
    const mode=internship?(['readiness','fill'].includes(message.mode)?message.mode:'readiness'):'fill';
    const report={version:1,kind:autoKind,mode,at:Date.now(),profileIndex,alsoProfileIndexes,replaceExisting,steps:[],helpNeeded:false};
    const tab=await findCmsTab(sender?.tab?.id);
    report.tabId=tab.id;report.pageUrl=tab.url||null;
    await api.tabs.update(tab.id,{active:true});
    if(Number.isSafeInteger(tab.windowId)&&api.windows?.update){
      try{await api.windows.update(tab.windowId,{focused:true});}catch{report.steps.push('windows_focus_denied');}
    }
    await sleep(250);
    report.steps.push('focused_cms_tab');
    try{
      await awaitCmsPageDocumentFocus(api,tab.id,{timeoutMs:Number.isFinite(message.focusTimeoutMs)?message.focusTimeoutMs:10000,intervalMs:100});
      report.steps.push('cms_page_has_focus');
    }catch(error){
      report.steps.push({cms_page_focus:safe(error)});
      // Continue to inspect; exactTab will refocus / surface page_unfocused precisely.
    }
    const unlocked=await unlockIfSafe(tab.id);
    report.steps.push({unlock:unlocked});
    let inspected;
    try{
      inspected=await inspect({tabId:tab.id});
    }catch(error){
      const reason=safe(error);
      if(['page_unfocused','cms_education_document_changed'].includes(reason)&&message?.documentRebindAttempted!==true){
        report.steps.push({inspectFocusRetry:true,reason});
        try{await awaitCmsPageDocumentFocus(api,tab.id,{timeoutMs:10000,intervalMs:100});}catch{}
        await api.storage.local.set({[autoStorageKey]:{...report,ok:false,reason,writeAttempted:false}});
        const retry=await autoFill({...message,documentRebindAttempted:true},sender);
        retry.priorAttempt={reason,phase:'inspect'};
        return retry;
      }
      throw error;
    }
    report.steps.push({inspectRows:inspected.rows?.length||0,sources:inspected.sources?.map(row=>row.profileIndex)||[]});
    report.readiness={
      rowCount:inspected.rows?.length||0,
      sourceIndexes:inspected.sources?.map(row=>row.profileIndex)||[],
      labels:inspected.sources?.map(row=>({profileIndex:row.profileIndex,label:row.label||''}))||[],
      documentHref:inspected.document?.href||null
    };
    if(mode==='readiness'){
      try{
        const preview=bindRecords(inspected,profileIndex,replaceExisting,alsoProfileIndexes);
        report.records=preview.map(row=>({profileIndex:row.profileIndex,target:row.target,replaceExisting:row.replaceExisting}));
        report.bindOk=true;
      }catch(error){
        report.bindOk=false;
        report.bindReason=safe(error);
        report.records=[];
      }
      report.ok=true;
      report.writeAttempted=false;
      await api.storage.local.set({[autoStorageKey]:report});
      return report;
    }
    const records=bindRecords(inspected,profileIndex,replaceExisting,alsoProfileIndexes);
    report.records=records.map(row=>({profileIndex:row.profileIndex,target:row.target,replaceExisting:row.replaceExisting}));
    const startMessage={type:messageType('START'),pageUrl:PAGE,tabId:tab.id,profileBinding:inspected.profileBinding,document:inspected.document,records,auto:true,focusTimeoutMs:10000};
    if(!validRequest(startMessage)||running.has(tab.id))fail(running.has(tab.id)?'cms_education_job_in_progress':'cms_education_request_invalid');
    const requestId=crypto.randomUUID();
    let accepted=null;
    const accept=value=>{accepted=value;};
    running.set(tab.id,{requestId,preparing:true});
    const execPromise=execute(startMessage,requestId,accept);
    for(let i=0;i<50&&accepted==null;i+=1)await sleep(100);
    if(!accepted?.accepted){
      await execPromise.catch(()=>{});
      fail(accepted?.reason||'cms_education_auto_start_rejected');
    }
    report.steps.push({accepted:true,requestId});
    const job=await waitJob(tab.id,requestId,timeoutMs+20000);
    await execPromise.catch(()=>{});
    report.job={state:job?.state||null,reason:job?.reason||null,complete:job?.complete===true,requestId:job?.requestId||requestId,fields:job?.fields||[],bindings:job?.bindings||[],serializedRecordCount:job?.serializedRecordCount??null,documentRebound:job?.documentRebound===true,...(job?.documentDiag?{documentDiag:job.documentDiag}:{})};
    report.ok=true;
    report.writeAttempted=true;
    report.helpNeeded=false;
    // Opaque document_changed often means focus/reload mid-RUN. Rebind once at auto level.
    if(['cms_education_document_changed','page_unfocused'].includes(job?.reason)&&message?.documentRebindAttempted!==true){
      report.steps.push({documentRebindRetry:true,previousReason:job.reason,previousState:job.state});
      await api.storage.local.set({[autoStorageKey]:report});
      const retry=await autoFill({...message,documentRebindAttempted:true},sender);
      retry.priorAttempt={reason:job.reason,state:job.state,requestId,documentRebound:job?.documentRebound===true};
      return retry;
    }
    await api.storage.local.set({[autoStorageKey]:report});
    return report;
  }
  const listener=(message,sender,sendResponse)=>{
    const bridge=[messageType('SOURCE_CHECK'),messageType('VERIFY_PROPS')].includes(message?.type);
    if(bridge){const tabId=sender?.tab?.id,slot=running.get(tabId),own=sender?.id===api.runtime.id&&sender.frameId===0&&base(sender.url)===PAGE;
      if(!own||!slot||slot.requestId!==message.requestId){sendResponse({ok:false,reason:'cms_education_wrong_owner'});return false;}
      (async()=>{await checkSlot(slot);if(message.type===messageType('SOURCE_CHECK')){await license();if(message.profileIndex!==undefined&&!slot.records.some(row=>row.profileIndex===message.profileIndex&&row.sourceSnapshotHash===message.sourceSnapshotHash))fail('cms_education_source_snapshot_changed');return {ok:true};}
        if(!Array.isArray(message.bindings)||message.bindings.length!==slot.records.length)fail('cms_education_serialized_binding_missing');
        const rows=await api.scripting.executeScript({target:{tabId},world:'MAIN',func:readSerialization});const proof=mainFrameResult(rows);if(!proof)fail('cms_education_serialization_unavailable');
        // Do not mislabel a failed props read (no timeOrigin) as document_changed.
        if(proof.ok!==true)fail(typeof proof.reason==='string'&&/^[a-z0-9_]+$/u.test(proof.reason)?proof.reason:'cms_education_serialization_unavailable');
        if(!Number.isFinite(proof.timeOrigin)||Number(proof.timeOrigin)!==Number(slot.document.timeOrigin))fail('cms_education_document_changed');await checkSlot(slot);const verification=verifySerialization(slot.plan,message.bindings,proof);slot.serializationVerification=verification?.ok===true?structuredClone(verification):null;slot.serializationBindings=verification?.ok===true?structuredClone(message.bindings):null;return verification;
      })().then(sendResponse,error=>sendResponse({ok:false,complete:false,reason:safe(error)}));return true;
    }
    if(![messageType('INSPECT_JOB'),messageType('START'),messageType('JOB_STATUS'),autoType].includes(message?.type))return false;
    if(!trustedUi(sender)){sendResponse({ok:false,reason:'cms_education_wrong_sender'});return false;}
    if(message.type===autoType){
      autoFill(message,sender).then(sendResponse,error=>{
        const reason=safe(error);
        const help=reason==='cms_education_login_or_wrong_page'||reason==='cms_education_tab_missing';
        const payload={ok:false,reason,helpNeeded:help,helpUrl:error?.helpUrl||null,helpReason:error?.helpReason||(help?'我需要帮助！请打开已登录的招商简历页':''),mode:message?.mode||(internship?'readiness':'fill'),writeAttempted:false,at:Date.now(),version:1,kind:autoKind};
        api.storage.local.set({[autoStorageKey]:payload}).catch(()=>{});
        sendResponse(payload);
      });
      return true;
    }
    if(!Number.isSafeInteger(message.tabId)){sendResponse({ok:false,reason:'cms_education_wrong_sender'});return false;}
    if(message.type===messageType('INSPECT_JOB')){inspect(message).then(sendResponse,error=>sendResponse({ok:false,reason:safe(error)}));return true;}
    if(message.type===messageType('JOB_STATUS')){(async()=>{const data=await get(jobKey(message.tabId));if(!data){const pending=await get(pendingKey(message.tabId));return pending?.state==='unknown_profile_invalidated'?{requestId:pending.requestId,state:'unknown_profile_invalidated',reason:'profile_binding_changed',fields:[],complete:false}:null;}
        try{await assertProfileBinding(api.storage.local,data.profileBinding,bindingOptions);return data;}catch{return ['queued','running','unknown','unknown_profile_invalidated'].includes(data.state)?{requestId:data.requestId,state:'unknown_profile_invalidated',reason:'profile_binding_changed',fields:[],complete:false}:null;}
      })().then(data=>sendResponse({ok:true,data}),()=>sendResponse({ok:false,reason:'cms_education_status_unavailable'}));return true;}
    if(!validRequest(message)||running.has(message.tabId)){sendResponse({ok:false,reason:running.has(message.tabId)?'cms_education_job_in_progress':'cms_education_request_invalid'});return false;}
    const requestId=crypto.randomUUID();let sent=false;const respond=value=>{if(!sent){sent=true;try{sendResponse(value);}catch{}}};
    // Reserve the in-memory slot immediately, before the first await.
    running.set(message.tabId,{requestId,preparing:true});execute(message,requestId,respond).catch(()=>respond({ok:false,reason:'cms_education_job_failed'}));return true;
  };
  return {listener,running};
}
export function installCmsEducationTaskRunner(options={}){const runner=createCmsEducationTaskRunner(options);(options.api||globalThis.chrome).runtime.onMessage.addListener(runner.listener);return runner;}
