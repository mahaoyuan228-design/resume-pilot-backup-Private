import {appendAutoAdvisory as recordAutoAdvisory} from './auto-form-readiness.mjs';
// GTH education auto path (mirror CMS_EDUCATION_AUTO). Default: readiness / inspect.
// Fill-without-save optional. Never clicks Save/Cancel/submit from this module.
// Fill ok is true only after a settled verified or verified_preexisting readback.
// A Save/submit/delete or savedOnSite/submitted claim is kept and fails closed.
import {captureProfileBinding,assertProfileBinding,canonicalProfileHash,commitBoundJob,
  dispatchBoundSource,withProfileBinding,reserveBoundJob} from '../profile/profile-lifecycle.js';
import {EDUCATION_PAGE,EDUCATION_FIELDS,educationCandidate,educationJobKey} from './education-task-runner.mjs';
import {draftJobKey} from './gth-draft-task-runner.mjs';
import {evaluateGthSavePolicy,gthSaveDryRunStatus,assertAutoNeverAttemptedSave,gthAutoSiteClaims,gthAutoSiteClaimed} from './gth-save-policy.mjs';
import {assessGthEducationOpenFill,shippedGthEducationOpenFill} from './gth-open-fills.mjs';

const PAGE=EDUCATION_PAGE,ORIGIN='https://hr.gtht.com';
const TITLES=['基本信息','教育经历','求职意向','工作经验','职业技能与特长','附件简历','其他信息'];
const pendingKey=tabId=>`resumePendingFillReview:${tabId}`;
const fail=reason=>{throw Error(reason);};
const safe=error=>{const value=typeof error==='string'?error:(error?.message||'');return typeof value==='string'&&/^[a-z0-9_]{2,100}$/u.test(value)?value:'gth_education_auto_failed';};
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const newRequestId=()=>`${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
const stable=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)
  ?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);

function probePageFunc(expectedTitles){
  const PAGE='https://hr.gtht.com/resume/edit/';
  const norm=value=>String(value||'').replace(/[\s\u00a0]+/gu,' ').trim();
  const href=location.href;
  const titlesExpected=expectedTitles;
  if(href!==PAGE){
    return {ok:false,reason:'gth_wrong_page',href,readyState:document.readyState,visible:document.visibilityState,
      looksLogin:/login|sso|auth|signin|passport|oauth|cas/i.test(href)||/登录|统一认证|扫码/u.test(document.title||'')||!!document.querySelector('input[type=password],.login-form,#login')};
  }
  if(document.readyState!=='complete')return {ok:false,reason:'gth_page_loading',href,readyState:document.readyState,visible:document.visibilityState};
  const sections=[...document.querySelectorAll('.r-section')];
  const titles=sections.map(section=>{const title=section.querySelector('.title_')?.cloneNode(true);title?.querySelectorAll('button,a').forEach(node=>node.remove());return norm(title?.textContent);});
  if(JSON.stringify(titles)!==JSON.stringify(titlesExpected)){
    return {ok:false,reason:'gth_sections_changed',href,titles,readyState:document.readyState,visible:document.visibilityState,
      looksLogin:/登录|统一认证|扫码/u.test(document.body?.innerText?.slice(0,500)||'')};
  }
  const section=sections[1];
  // Only education-section forms count as the education editor. Forms left open in
  // other sections (基本信息 etc.) used to trip gth_editor_ambiguous falsely.
  const eduForms=[...section.querySelectorAll('form')];
  const otherForms=sections.flatMap((node,index)=>index===1?[]:[...node.querySelectorAll('form')]);
  let count=section.querySelectorAll('.sec-context > .sec-detail').length;
  let editorOpen=false,editorMarker=null;
  if(eduForms.length>1){
    return {ok:false,reason:'gth_editor_ambiguous',href,count,editorOpen:true,
      eduFormCount:eduForms.length,otherFormCount:otherForms.length};
  }
  if(eduForms.length===1){
    const form=eduForms[0];
    const marker=form?.dataset.resumeGthEducationRecordIndex;
    editorOpen=true;editorMarker=marker||null;
    if(marker&&marker!=='new')count+=1;
  }
  return {ok:true,reason:'gth_page_ready',href,readyState:document.readyState,visible:document.visibilityState,
    titles,educationCount:count,editorOpen,editorMarker,timeOrigin:performance.timeOrigin,
    eduFormCount:eduForms.length,otherFormCount:otherForms.length,
    ...(otherForms.length?{warning:'gth_other_section_editor_open'}:{})};
}

export function createGthEducationAutoRunner({api=globalThis.chrome,verifyBeforeFill=null,timeoutMs=90000,lifecycleOptions={}}={}){
  const get=async key=>(await api.storage.local.get(key))[key];
  const autoPageUrl=()=>api.runtime.getURL('src/auto/gth-education-auto.html');
  const popupPageUrl=()=>api.runtime.getURL('src/popup/popup.html');
  const trustedUi=sender=>{
    if(sender?.id!==api.runtime.id||typeof sender.url!=='string')return false;
    const url=sender.url.split('?')[0].split('#')[0];
    if(url===popupPageUrl())return !sender.tab;
    return url===autoPageUrl();
  };
  const bounded=(work,ms=timeoutMs)=>new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('gth_education_auto_timeout')),ms);
    Promise.resolve().then(work).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
  });
  const license=async()=>{
    const paid=api.runtime.getManifest?.().background?.service_worker==='src/license/guard-worker.mjs';
    if(paid&&typeof verifyBeforeFill!=='function')fail('license_required');
    if(verifyBeforeFill)try{await bounded(verifyBeforeFill,15000);}catch{fail('license_required');}
  };

  async function findGthTab(excludeTabId = null) {
    // The user opens the editor. Never navigate to an edit/new-resume page.
    const tabs = await api.tabs.query({});
    const candidates = tabs.filter(tab => tab.id !== excludeTabId && typeof tab.url==='string' && tab.url.startsWith(`${ORIGIN}/`));
    const ranked = [...candidates].sort((a, b) => ((b.lastAccessed || 0) - (a.lastAccessed || 0)) || ((b.id || 0) - (a.id || 0)));
    const tab = ranked.find(row => row.active) || ranked[0];
    if (!tab) fail('gth_education_tab_missing');
    return { tab, kind: candidates.length > 1 ? 'exact_multi' : 'exact' };
  }

  async function focusTab(tab){
    await api.tabs.update(tab.id,{active:true});
    if(Number.isSafeInteger(tab.windowId)&&api.windows?.update){
      try{await api.windows.update(tab.windowId,{focused:true});}catch{/* ignore */}
    }
    await sleep(250);
  }

  async function probe(tabId){
    const rows=await api.scripting.executeScript({target:{tabId},world:'MAIN',func:probePageFunc,args:[TITLES]});
    const doc=rows?.length===1&&rows[0].frameId===0?rows[0].result:null;
    return doc || {ok:false,reason:'gth_education_probe_failed'};
  }

  async function unlockIfSafe(tabId){
    const eduKey=educationJobKey(tabId),draftKey=draftJobKey(tabId),pending=pendingKey(tabId);
    const stored=await api.storage.local.get([eduKey,draftKey,pending,'resumePendingFillReview']);
    const edu=stored[eduKey],draft=stored[draftKey];
    if(edu&&['queued','running'].includes(edu.state))fail('gth_education_job_in_progress');
    if(draft&&['queued','running','refreshing_saved_record','verifying_saved_after_refresh'].includes(draft.state))fail('gth_draft_job_in_progress');
    const remove=[pending];
    if(stored.resumePendingFillReview?.tabId===tabId)remove.push('resumePendingFillReview');
    if(edu&&['unknown','unknown_profile_invalidated','stopped_before_write','completed'].includes(edu.state))remove.push(eduKey);
    // Never clear a draft that already saved / needs refresh — leave for Jeremy.
    if(draft&&['ready','stopped_before_write'].includes(draft.state)&&draft.targetSaved!==true)remove.push(draftKey);
    if(remove.length)await api.storage.local.remove(remove);
    return {cleared:remove,previousEducationState:edu?.state||null,previousDraftState:draft?.state||null};
  }

  async function collectReadiness(tab,probeResult){
    const edu=await get(educationJobKey(tab.id));
    const draft=await get(draftJobKey(tab.id));
    const pending=await get(pendingKey(tab.id));
    const raw=await get('resumeProfile');
    const educationCount=Array.isArray(raw?.education)?raw.education.length:0;
    let sources=[];
    try{
      const binding=await captureProfileBinding(api.storage.local,lifecycleOptions);
      sources=(raw?.education||[]).slice(0,30).map((_row,profileIndex)=>{
        try{
          const candidate=educationCandidate(raw,profileIndex);
          return {profileIndex,confirmedFieldCount:candidate.confirmedPaths.length,hasSchool:!!candidate.school,hasMajor:!!candidate.major};
        }catch{return {profileIndex,error:'education_source_unavailable'};}
      });
      return {
        pageState:probeResult.ok?'ready':(probeResult.looksLogin?'login_or_wall':'not_ready'),
        page:probeResult,
        tabId:tab.id,
        pageUrl:tab.url||null,
        educationJob:edu?{requestId:edu.requestId,state:edu.state,outcome:edu.outcome||null,complete:edu.complete===true,profileIndex:edu.profileIndex??null,rowIndex:edu.rowIndex??null,recordMarker:edu.recordMarker||null,fieldCount:Array.isArray(edu.fields)?edu.fields.length:0}:null,
        draftJob:draft?{requestId:draft.requestId,state:draft.state,readyToSave:draft.readyToSave===true,targetSaved:draft.targetSaved===true,refreshVerified:draft.refreshVerified===true,action:draft.action||null}:null,
        pending:pending?{requestId:pending.requestId,kind:pending.kind||null}:null,
        profileEducationCount:educationCount,
        sources,
        profileBinding:binding,
        saveAllowedByPolicy:evaluateGthSavePolicy({fromAutoPath:true}).saveAllowedByPolicy,
        savePolicy:evaluateGthSavePolicy({fromAutoPath:true}),
        note:'Auto path does not Save/submit; draft inspect only when source fill verified'
      };
    }catch(error){
      return {
        pageState:probeResult.ok?'ready':(probeResult.looksLogin?'login_or_wall':'not_ready'),
        page:probeResult,tabId:tab.id,pageUrl:tab.url||null,
        educationJob:edu?{state:edu.state,outcome:edu.outcome||null}:null,
        draftJob:draft?{state:draft.state,readyToSave:draft.readyToSave===true}:null,
        pending:pending?{kind:pending.kind||null}:null,
        profileEducationCount:educationCount,sources,
        profileBindingError:safe(error),
        saveAllowedByPolicy:evaluateGthSavePolicy({fromAutoPath:true}).saveAllowedByPolicy,
        savePolicy:evaluateGthSavePolicy({fromAutoPath:true})
      };
    }
  }

  function publicField(field){
    const out={question:field.question,path:field.path,status:field.status,reason:field.reason};
    if(field.selectorStep!=null)out.selectorStep=field.selectorStep;
    if(field.allowCategoryOverwrite!=null)out.allowCategoryOverwrite=field.allowCategoryOverwrite;
    if(field.existingDisplay!=null)out.existingDisplay=field.existingDisplay;
    return out;
  }
  function validFields(response,profileIndex){
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

  async function runOpenFill(tab,message,readiness){
    await license();
    const binding=readiness.profileBinding||await captureProfileBinding(api.storage.local,lifecycleOptions);
    await assertProfileBinding(api.storage.local,binding,lifecycleOptions);
    const raw=await get('resumeProfile');
    if(await canonicalProfileHash(raw,lifecycleOptions.cryptoImpl)!==binding.profileHash)fail('profile_binding_changed');
    const profileIndex=message.profileIndex;
    if(!Number.isInteger(profileIndex)||profileIndex<0||profileIndex>29)fail('education_profile_index_invalid');
    const trusted=await get('resumeTrustedOrigins');
    if(!Array.isArray(trusted)||!trusted.includes(ORIGIN)){
      if(message.originConfirmed!==true)fail('education_job_origin_unconfirmed');
      await withProfileBinding(api.storage.local,binding,()=>api.storage.local.set({resumeTrustedOrigins:[...(Array.isArray(trusted)?trusted:[]),ORIGIN].slice(-100)}),lifecycleOptions);
    }
    const response=await bounded(()=>dispatchBoundSource(api.storage.local,binding,()=>shippedGthEducationOpenFill({
      api,tab,requestId:newRequestId(),binding,profile:raw,profileIndex,replaceExisting:message.replaceExisting===true
    }),lifecycleOptions));
    await assertProfileBinding(api.storage.local,binding,lifecycleOptions);
    if(!response||typeof response!=='object')fail('gth_education_open_fill_no_response');
    const claims=gthAutoSiteClaims(response);
    const claimed=gthAutoSiteClaimed(claims);
    const assessed=assessGthEducationOpenFill(response);
    const ok=!claimed&&assessed.ok===true;
    const job={
      state:ok?'completed':'unknown',
      reason:claimed?'gth_education_open_save_policy_violated':(ok?null:safe(assessed.reason||response.reason||'gth_education_open_fill_invalid')),
      outcome:ok?assessed.outcome:'unknown',
      section:'教育经历',
      profileIndex,
      fields:response.fields||[],
      writeStarted:response.writeStarted===true,
      editorLeftOpen:response.editorLeftOpen===true,
      ...claims
    };
    return {job,responseSummary:{ok,writeStarted:job.writeStarted,reason:job.reason,...claims},outcome:job.outcome};
  }

  async function runFill(tab,message,readiness){
    await license();
    const profileIndex=Number.isInteger(message.profileIndex)?message.profileIndex:5;
    const replaceExisting=message.replaceExisting!==false;
    let rowIndex=message.rowIndex;
    let targetMode='existing';
    if(rowIndex==='new'||rowIndex===null&&readiness.page?.educationCount===0){
      targetMode='new';rowIndex=null;
    }else if(rowIndex==null){
      // Prefer open editor marker, else first existing row index 0 when count>0.
      if(readiness.page?.editorOpen&&readiness.page?.editorMarker&&readiness.page.editorMarker!=='new'){
        rowIndex=Number(readiness.page.editorMarker);
      }else if(readiness.page?.editorOpen&&readiness.page?.editorMarker==='new'){
        targetMode='new';rowIndex=null;
      }else if((readiness.page?.educationCount||0)>0){
        rowIndex=0;
      }else{
        targetMode='new';rowIndex=null;
      }
    }
    if(targetMode==='existing'&&(!Number.isInteger(rowIndex)||rowIndex<0||rowIndex>29))fail('gth_education_auto_row_invalid');
    const binding=readiness.profileBinding||await captureProfileBinding(api.storage.local,lifecycleOptions);
    await assertProfileBinding(api.storage.local,binding,lifecycleOptions);
    const raw=await get('resumeProfile');
    const candidate=educationCandidate(raw,profileIndex);
    if(await canonicalProfileHash(raw,lifecycleOptions.cryptoImpl)!==binding.profileHash)fail('profile_binding_changed');
    const trusted=await get('resumeTrustedOrigins');
    if(!Array.isArray(trusted)||!trusted.includes(ORIGIN)){
      if(message.originConfirmed!==true)fail('education_job_origin_unconfirmed');
      await withProfileBinding(api.storage.local,binding,()=>api.storage.local.set({resumeTrustedOrigins:[...(Array.isArray(trusted)?trusted:[]),ORIGIN].slice(-100)}),lifecycleOptions);
    }
    const requestId=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const key=educationJobKey(tab.id);
    let job={tabId:tab.id,origin:ORIGIN,requestId,rowIndex,profileIndex,replaceExisting,targetMode,
      kind:'gth_education_full_trial',at:Date.now(),state:'queued',complete:false,profileBinding:binding,auto:true};
    await reserveBoundJob(api.storage.local,key,job,binding,await get(key),lifecycleOptions);
    await withProfileBinding(api.storage.local,binding,async()=>{
      await api.storage.local.set({[pendingKey(tab.id)]:{tabId:tab.id,origin:ORIGIN,at:Date.now(),requestId,
        kind:'gth_education_full_trial',rowIndex,targetMode,profileBinding:binding,auto:true}});
    },lifecycleOptions);
    job={...job,state:'running',at:Date.now()};
    await commitBoundJob(api.storage.local,key,job,binding,lifecycleOptions);
    await bounded(()=>dispatchBoundSource(api.storage.local,binding,()=>api.scripting.executeScript({target:{tabId:tab.id},files:['src/content/gth-education.js']}),lifecycleOptions),15000);
    const response=await bounded(()=>dispatchBoundSource(api.storage.local,binding,()=>api.tabs.sendMessage(tab.id,{type:'GTH_EDUCATION_FULL_TRIAL',requestId,rowIndex,targetMode,
      profileIndex,replaceExisting,educationCandidates:[candidate],profileBinding:binding}),lifecycleOptions));
    await assertProfileBinding(api.storage.local,binding,lifecycleOptions);
    const status=await bounded(()=>api.tabs.sendMessage(tab.id,{type:'GTH_EDUCATION_FULL_TRIAL_STATUS',requestId}),15000);
    const outcome=status?.ok===true&&status.data?.requestId===requestId&&status.data.state==='settled'?status.data.outcome:'unknown';
    const claims=gthAutoSiteClaims(response);
    const claimed=gthAutoSiteClaimed(claims);
    if(!validFields(response,profileIndex)||(response?.targetMode??'existing')!==targetMode||claimed){
      const beforeWrite=!claimed&&response?.writeStarted===false&&outcome==='failed_before_write';
      if(beforeWrite){
        job={...job,state:'stopped_before_write',reason:safe(response?.reason),at:Date.now(),writeStarted:false,...claims};
        await commitBoundJob(api.storage.local,key,job,binding,lifecycleOptions);
        await withProfileBinding(api.storage.local,binding,()=>api.storage.local.remove(pendingKey(tab.id)),lifecycleOptions);
        return {job,responseSummary:{ok:false,writeStarted:false,reason:response?.reason||null,...claims},outcome};
      }
      const partialFields=Array.isArray(response?.fields)?response.fields.map(publicField):undefined;
      job={...job,state:'unknown',reason:claimed?'gth_education_save_policy_violated':safe(response?.reason),at:Date.now(),
        ...(partialFields?{fields:partialFields}:{}),
        writeStarted:response?.writeStarted===true,...claims};
      await commitBoundJob(api.storage.local,key,job,binding,lifecycleOptions);
      return {job,responseSummary:{ok:false,reason:job.reason,writeStarted:response?.writeStarted===true,
        fieldCount:partialFields?.length||0,...claims},outcome};
    }
    const fields=response.fields.map(publicField);
    const complete=response.complete===true&&fields.every(field=>field.status==='verified');
    const settled=outcome==='verified'||outcome==='verified_preexisting';
    if(!settled){
      const beforeWrite=outcome==='failed_before_write'&&response.writeStarted!==true;
      job={...job,state:beforeWrite?'stopped_before_write':'unknown',outcome,complete:false,fields,
        reason:beforeWrite?'gth_education_fill_incomplete':'gth_education_status_unsettled',
        writeStarted:response.writeStarted===true,at:Date.now(),...claims};
      await commitBoundJob(api.storage.local,key,job,binding,lifecycleOptions);
      if(beforeWrite)await withProfileBinding(api.storage.local,binding,()=>api.storage.local.remove(pendingKey(tab.id)),lifecycleOptions);
      return {job,responseSummary:{ok:false,reason:job.reason,writeStarted:job.writeStarted,
        fieldCount:fields.length,...claims},outcome};
    }
    job={...job,state:'completed',complete,fields,outcome,
      recordMarker:targetMode==='new'?'new':String(rowIndex),provisionalNewRecord:targetMode==='new',at:Date.now(),
      softwareClickedSave:false,softwareClickedSubmit:false,softwareClickedDelete:false,savedOnSite:false,submitted:false};
    await commitBoundJob(api.storage.local,key,job,binding,lifecycleOptions);
    await withProfileBinding(api.storage.local,binding,()=>api.storage.local.remove(pendingKey(tab.id)),lifecycleOptions);
    return {job,responseSummary:{ok:true,editorLeftOpen:true,fieldCount:fields.length,complete,...gthAutoSiteClaims(job)},outcome};
  }

  async function runDraftInspect(tab,eduJob){
    if(eduJob?.state!=='completed'||eduJob.outcome!=='verified'||!eduJob.profileBinding)fail('draft_job_source_not_verified');
    if(!Array.isArray(eduJob.fields)||eduJob.fields.length!==12)fail('draft_job_source_not_verified');
    const binding=eduJob.profileBinding;
    await assertProfileBinding(api.storage.local,binding,lifecycleOptions);
    const requestId=eduJob.requestId;
    const targetMode=eduJob.targetMode==='new'?'new':'existing';
    const recordMarker=targetMode==='new'?'new':String(eduJob.rowIndex);
    const key=draftJobKey(tab.id);
    let job={kind:'gth_education_draft_save',tabId:tab.id,origin:ORIGIN,requestId,action:'inspect',state:'queued',
      at:Date.now(),softwareClickedSave:false,softwareClickedSubmit:false,refreshVerified:false,profileBinding:binding,auto:true};
    await reserveBoundJob(api.storage.local,key,job,binding,await get(key),lifecycleOptions);
    await bounded(()=>dispatchBoundSource(api.storage.local,binding,()=>api.scripting.executeScript({target:{tabId:tab.id},files:['src/content/gth-draft-save.js']}),lifecycleOptions),15000);
    const result=await bounded(()=>dispatchBoundSource(api.storage.local,binding,()=>api.tabs.sendMessage(tab.id,{type:'GTH_EDUCATION_DRAFT_INSPECT',requestId,recordMarker,targetMode,profileBinding:binding}),lifecycleOptions),20000);
    if(result?.ok!==true||result.readyToSave!==true||result.softwareClickedSave!==false
      ||result.expectedSnapshot?.requestId!==requestId||result.expectedSnapshot.recordMarker!==recordMarker
      ||!/^[a-f0-9]{64}$/u.test(result.expectedSnapshot.fingerprint||'')){
      job={...job,state:'stopped_before_write',reason:safe(result?.reason)||'draft_job_preflight_failed',readyToSave:false,at:Date.now()};
      await commitBoundJob(api.storage.local,key,job,binding,lifecycleOptions);
      return {ok:false,job,inspect:result||null};
    }
    job={...job,state:'ready',recordMarker,targetMode,expectedFingerprint:result.expectedSnapshot.fingerprint,readyToSave:true,at:Date.now()};
    await commitBoundJob(api.storage.local,key,job,binding,lifecycleOptions);
    return {ok:true,job,inspect:{readyToSave:true,fingerprint:result.expectedSnapshot.fingerprint,softwareClickedSave:false}};
  }

  async function auto(message,sender=null){
    const mode=['readiness','fill','inspect','open_fill'].includes(message.mode)?message.mode:'readiness';
    const openIfMissing=message.openIfMissing!==false;
    const report={version:1,kind:'gth_education_auto',mode,at:Date.now(),profileIndex:message.profileIndex??5,
      replaceExisting:message.replaceExisting!==false,steps:[],helpNeeded:false,saveAttempted:false};
    report.advisoryHints = [];
    const found=await findGthTab(sender?.tab?.id,{openIfMissing:mode==='readiness'?openIfMissing:openIfMissing});
    report.steps.push({find:found.kind,tabId:found.tab.id,url:found.tab.url||null});
    await focusTab(found.tab);
    report.steps.push('focused_gth_tab');
    const probeResult=await probe(found.tab.id);
    report.steps.push({probe:probeResult.reason,ok:probeResult.ok===true});
    recordAutoAdvisory(report, probeResult);
    const unlocked=await unlockIfSafe(found.tab.id);
    report.steps.push({unlock:unlocked});
    let readiness=await collectReadiness(found.tab,probeResult);
    readiness.advisoryHints = report.advisoryHints;
    report.readiness={
      pageState:readiness.pageState,
      educationCount:readiness.page?.educationCount??null,
      editorOpen:readiness.page?.editorOpen===true,
      editorMarker:readiness.page?.editorMarker||null,
      educationJob:readiness.educationJob,
      draftJob:readiness.draftJob,
      pending:readiness.pending,
      profileEducationCount:readiness.profileEducationCount,
      sources:readiness.sources,
      saveAllowedByPolicy:evaluateGthSavePolicy({fromAutoPath:true}).saveAllowedByPolicy,
      savePolicy:evaluateGthSavePolicy({fromAutoPath:true})
    };
    report.tabId=found.tab.id;
    report.pageUrl=found.tab.url||null;

    if(mode==='readiness'){
      report.ok=true;
      report.job=readiness.educationJob;
      report.draft=readiness.draftJob;
      report.saveAllowedByPolicy=evaluateGthSavePolicy({fromAutoPath:true}).saveAllowedByPolicy;
      assertAutoNeverAttemptedSave(report);
      await api.storage.local.set({resumeGthEducationAutoRun:report});
      return report;
    }

    if(mode==='open_fill'){
      const filled=await runOpenFill(found.tab,message,readiness);
      report.writeAttempted=filled.job?.writeStarted===true;
      report.steps.push({openFill:filled.job?.state,outcome:filled.outcome});
      report.job=filled.job;
      report.fill=filled.responseSummary;
      report.saveAllowedByPolicy=evaluateGthSavePolicy({fromAutoPath:true}).saveAllowedByPolicy;
      const claims=gthAutoSiteClaims(filled.job);
      Object.assign(report,claims);
      const settled=filled.job?.state==='completed'&&filled.responseSummary?.ok===true&&!gthAutoSiteClaimed(claims);
      report.ok=settled;
      if(!report.ok)report.reason=filled.job?.reason||filled.responseSummary?.reason||'gth_education_open_fill_failed';
      try{assertAutoNeverAttemptedSave(report);}catch(error){
        report.ok=false;
        report.reason=report.reason||safe(error);
      }
      await api.storage.local.set({resumeGthEducationAutoRun:report});
      return report;
    }

    if(mode==='fill'){
      const filled=await runFill(found.tab,message,readiness);
      report.steps.push({fill:filled.job?.state,outcome:filled.outcome});
      report.job=filled.job?{state:filled.job.state,reason:filled.job.reason||null,complete:filled.job.complete===true,
        requestId:filled.job.requestId,outcome:filled.job.outcome||null,fields:filled.job.fields||[],
        recordMarker:filled.job.recordMarker||null,profileIndex:filled.job.profileIndex,rowIndex:filled.job.rowIndex??null}:null;
      report.fill=filled.responseSummary;
      if(message.inspectAfterFill!==false&&filled.job?.state==='completed'&&filled.job.outcome==='verified'){
        const inspected=await runDraftInspect(found.tab,filled.job);
        report.steps.push({draftInspect:inspected.ok,state:inspected.job?.state});
        report.draft={state:inspected.job?.state||null,readyToSave:inspected.job?.readyToSave===true,
          fingerprint:inspected.inspect?.fingerprint||inspected.job?.expectedFingerprint||null,
          softwareClickedSave:false,saveAttempted:false,
          saveDryRun:gthSaveDryRunStatus({
            readyToSave:inspected.job?.readyToSave===true,
            softwareClickedSave:false,
            saveAttempted:false,
            fromAutoPath:true
          })};
      }
      report.saveAllowedByPolicy=evaluateGthSavePolicy({fromAutoPath:true}).saveAllowedByPolicy;
      const claims=gthAutoSiteClaims(filled.job);
      Object.assign(report,claims);
      if(report.job)Object.assign(report.job,claims);
      const settled=filled.job?.state==='completed'&&(filled.outcome==='verified'||filled.outcome==='verified_preexisting')
        &&filled.responseSummary?.ok===true&&!gthAutoSiteClaimed(claims);
      report.ok=settled;
      if(!report.ok)report.reason=filled.job?.reason||filled.responseSummary?.reason||'gth_education_fill_failed';
      try{assertAutoNeverAttemptedSave(report);}catch(error){
        report.ok=false;
        report.reason=report.reason||safe(error);
      }
      await api.storage.local.set({resumeGthEducationAutoRun:report});
      return report;
    }

    // mode === inspect
    readiness=await collectReadiness(found.tab,probeResult);
    const edu=await get(educationJobKey(found.tab.id));
    const inspected=await runDraftInspect(found.tab,edu);
    report.steps.push({draftInspect:inspected.ok,state:inspected.job?.state});
    report.job=edu?{state:edu.state,outcome:edu.outcome||null,requestId:edu.requestId,complete:edu.complete===true}:null;
    report.draft={state:inspected.job?.state||null,readyToSave:inspected.job?.readyToSave===true,
      fingerprint:inspected.inspect?.fingerprint||inspected.job?.expectedFingerprint||null,
      softwareClickedSave:false,saveAttempted:false,
      saveDryRun:gthSaveDryRunStatus({
        readyToSave:inspected.job?.readyToSave===true,
        softwareClickedSave:false,
        saveAttempted:false,
        fromAutoPath:true
      })};
    report.saveAllowedByPolicy=evaluateGthSavePolicy({fromAutoPath:true}).saveAllowedByPolicy;
    assertAutoNeverAttemptedSave(report);
    report.ok=inspected.ok===true;
    if(!inspected.ok)report.reason=inspected.job?.reason||'draft_job_preflight_failed';
    await api.storage.local.set({resumeGthEducationAutoRun:report});
    return report;
  }

  const listener=(message,sender,sendResponse)=>{
    if(message?.type!=='GTH_EDUCATION_AUTO')return false;
    if(!trustedUi(sender)){sendResponse({ok:false,reason:'gth_education_wrong_sender'});return false;}
    auto(message,sender).then(sendResponse,error=>{
      const reason=safe(error);
      const helpUrl=error?.helpUrl||PAGE;
      const help=reason==='gth_education_login_or_wrong_page'||reason==='gth_education_tab_missing'||/\/login\b/i.test(String(helpUrl));
      const payload={ok:false,reason,helpNeeded:help,helpUrl,helpReason:error?.helpReason||(help?'我需要帮助！请打开已登录的国泰海通简历编辑页 https://hr.gtht.com/resume/edit/':''),
        mode:message?.mode||'readiness',saveAttempted:false,at:Date.now(),version:1,kind:'gth_education_auto'};
      api.storage.local.set({resumeGthEducationAutoRun:payload}).catch(()=>{});
      sendResponse(payload);
    });
    return true;
  };
  return {listener};
}

export function installGthEducationAutoRunner(options={}){
  const runner=createGthEducationAutoRunner(options);
  (options.api||globalThis.chrome).runtime.onMessage.addListener(runner.listener);
  return runner;
}
