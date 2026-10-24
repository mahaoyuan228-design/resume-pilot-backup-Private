// GTH basic auto path (mirror GTH_EDUCATION_AUTO). Default: readiness.
// Fill-without-save optional. Never clicks Save/Cancel/submit.
// Fill ok is true only after a settled verified readback. A reported
// Save/submit/delete click, a status that is not verified, or a requested
// 现居住地/照片 that is unsupported or region-unsettled fails closed.
// Those rows are failed, not a skipped success, and the job is not completed.
import {captureProfileBinding,assertProfileBinding,canonicalProfileHash,commitBoundJob,
  dispatchBoundSource,withProfileBinding,reserveBoundJob} from '../profile/profile-lifecycle.js';
import {BASIC_PAGE,BASIC_KIND,basicCandidate,basicCoverage,basicJobKey,
  planGthBasicCoverage,sealGthJobCoverage,gthRequestedFillBlocksComplete,validResponse} from './basic-task-runner.mjs';
import {evaluateGthSavePolicy,assertAutoNeverAttemptedSave} from './gth-save-policy.mjs';

const PAGE=BASIC_PAGE,ORIGIN='https://hr.gtht.com';
const TITLES=['基本信息','教育经历','求职意向','工作经验','职业技能与特长','附件简历','其他信息'];
const pendingKey=tabId=>`resumePendingFillReview:${tabId}`;
const fail=reason=>{throw Error(reason);};
const safe=error=>{const value=typeof error==='string'?error:(error?.message||'');return typeof value==='string'&&/^[a-z0-9_]{2,100}$/u.test(value)?value:'gth_basic_auto_failed';};
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const clickFlags=response=>({
  softwareClickedSave:response?.softwareClickedSave===true,
  softwareClickedSubmit:response?.softwareClickedSubmit===true,
  softwareClickedDelete:response?.softwareClickedDelete===true
});
const anySiteClick=flags=>flags.softwareClickedSave||flags.softwareClickedSubmit||flags.softwareClickedDelete;
const projectFields=rows=>Array.isArray(rows)?rows.map(({question,path,status,reason,readOnlyState})=>({question,path,status,reason,
  ...(reason==='site_readonly'?{readOnlyState}:{})})):undefined;

function probePageFunc(expectedTitles){
  const PAGE='https://hr.gtht.com/resume/edit/';
  const norm=value=>String(value||'').replace(/[\s\u00a0]+/gu,' ').trim();
  const href=location.href;
  if(href!==PAGE){
    return {ok:false,reason:'gth_wrong_page',href,readyState:document.readyState,visible:document.visibilityState,
      looksLogin:/login|sso|auth|signin|passport|oauth|cas/i.test(href)||/登录|统一认证|扫码/u.test(document.title||'')||!!document.querySelector('input[type=password],.login-form,#login')};
  }
  if(document.readyState!=='complete')return {ok:false,reason:'gth_page_loading',href,readyState:document.readyState,visible:document.visibilityState};
  const sections=[...document.querySelectorAll('.r-section')];
  const titles=sections.map(section=>{const title=section.querySelector('.title_')?.cloneNode(true);title?.querySelectorAll('button,a').forEach(node=>node.remove());return norm(title?.textContent);});
  if(JSON.stringify(titles)!==JSON.stringify(expectedTitles)){
    return {ok:false,reason:'gth_sections_changed',href,titles,readyState:document.readyState,visible:document.visibilityState,
      looksLogin:/登录|统一认证|扫码/u.test(document.body?.innerText?.slice(0,500)||'')};
  }
  const section=sections[0];
  // Only 基本信息 forms count as the basic editor. Forms left open in other
  // sections (教育经历 etc.) used to trip gth_basic_editor_ambiguous falsely —
  // same class of bug as education probe before edu-scoped harden.
  const forms=[...section.querySelectorAll('form')];
  const otherForms=sections.flatMap((node,index)=>index===0?[]:[...node.querySelectorAll('form')]);
  let editorOpen=false;
  if(forms.length>1){
    return {ok:false,reason:'gth_basic_editor_ambiguous',href,editorOpen:true,
      sectionFormCount:forms.length,otherFormCount:otherForms.length};
  }
  if(forms.length===1)editorOpen=true;
  const editLinks=[...section.querySelectorAll('a.h-e-btn')].filter(node=>{
    const style=getComputedStyle(node);
    return !!node.getClientRects().length&&style.display!=='none'&&style.visibility!=='hidden'&&norm(node.textContent)==='编辑';
  });
  return {ok:true,reason:'gth_page_ready',href,readyState:document.readyState,visible:document.visibilityState,
    titles,editorOpen,editLinkCount:editLinks.length,timeOrigin:performance.timeOrigin,
    sectionFormCount:forms.length,otherFormCount:otherForms.length,
    ...(otherForms.length?{warning:'gth_other_section_editor_open'}:{})};
}

function validBasicResponse(response,educationIndex){
  // Shared with the popup runner, including an optional 现居住地 row.
  return validResponse(response,educationIndex);
}

export function createGthBasicAutoRunner({api=globalThis.chrome,verifyBeforeFill=null,timeoutMs=90000,lifecycleOptions={}}={}){
  const get=async key=>(await api.storage.local.get(key))[key];
  const autoPageUrl=()=>api.runtime.getURL('src/auto/gth-basic-auto.html');
  const popupPageUrl=()=>api.runtime.getURL('src/popup/popup.html');
  const trustedUi=sender=>{
    if(sender?.id!==api.runtime.id||typeof sender.url!=='string')return false;
    const url=sender.url.split('?')[0].split('#')[0];
    if(url===popupPageUrl())return !sender.tab;
    return url===autoPageUrl();
  };
  const bounded=(work,ms=timeoutMs)=>new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('gth_basic_auto_timeout')),ms);
    Promise.resolve().then(work).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
  });
  const license=async()=>{
    const paid=api.runtime.getManifest?.().background?.service_worker==='src/license/guard-worker.mjs';
    if(paid&&typeof verifyBeforeFill!=='function')fail('license_required');
    if(verifyBeforeFill)try{await bounded(verifyBeforeFill,15000);}catch{fail('license_required');}
  };

  async function findGthTab(excludeTabId=null,{openIfMissing=false}={}){
    const tabs=await api.tabs.query({});
    const exact=tabs.filter(tab=>tab.url===PAGE&&tab.id!==excludeTabId);
    if(exact.length===1)return {tab:exact[0],kind:'exact'};
    if(exact.length>1){
      const ranked=[...exact].sort((a,b)=>((b.lastAccessed||0)-(a.lastAccessed||0))||((b.id||0)-(a.id||0)));
      return {tab:ranked.find(tab=>tab.active)||ranked[0],kind:'exact_multi'};
    }
    const related=tabs.filter(tab=>typeof tab.url==='string'&&tab.id!==excludeTabId&&/gtht\.com/u.test(tab.url));
    if(related.length){
      const err=Error('gth_basic_login_or_wrong_page');
      err.helpUrl=related[0].url;
      err.helpReason='GTH resume/edit/ not open; related tab may need login/SSO/QR';
      throw err;
    }
    if(openIfMissing){
      const created=await api.tabs.create({url:PAGE,active:true});
      for(let i=0;i<30;i+=1){
        await sleep(500);
        const tab=await api.tabs.get(created.id);
        if(tab.url===PAGE&&tab.status==='complete')return {tab,kind:'opened'};
        if(typeof tab.url==='string'&&tab.url.includes('gtht.com')&&tab.url!==PAGE){
          const err=Error('gth_basic_login_or_wrong_page');
          err.helpUrl=tab.url;
          err.helpReason='Opened GTH URL redirected away from resume/edit/; login/SSO likely required';
          throw err;
        }
      }
      const tab=await api.tabs.get(created.id);
      if(tab.url===PAGE)return {tab,kind:'opened_partial'};
      const err=Error('gth_basic_login_or_wrong_page');
      err.helpUrl=tab.url||PAGE;
      err.helpReason='Opened GTH edit URL but page did not settle on resume/edit/';
      throw err;
    }
    fail('gth_basic_tab_missing');
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
    if(!doc)fail('gth_basic_probe_failed');
    return doc;
  }

  async function unlockIfSafe(tabId){
    const key=basicJobKey(tabId),pending=pendingKey(tabId);
    const stored=await api.storage.local.get([key,pending,'resumePendingFillReview','resumeEducationJob:'+tabId]);
    const basic=stored[key],edu=stored['resumeEducationJob:'+tabId];
    if(basic&&['queued','running'].includes(basic.state))fail('gth_basic_job_in_progress');
    if(edu&&['queued','running','unknown'].includes(edu.state))fail('gth_education_job_in_progress');
    const remove=[pending];
    if(stored.resumePendingFillReview?.tabId===tabId)remove.push('resumePendingFillReview');
    if(basic&&['unknown','unknown_profile_invalidated','stopped_before_write','completed'].includes(basic.state))remove.push(key);
    if(remove.length)await api.storage.local.remove(remove);
    return {cleared:remove,previousBasicState:basic?.state||null};
  }

  async function collectReadiness(tab,probeResult){
    const basic=await get(basicJobKey(tab.id));
    const pending=await get(pendingKey(tab.id));
    const raw=await get('resumeProfile');
    const educationCount=Array.isArray(raw?.education)?raw.education.length:0;
    const coverageReadiness=planGthBasicCoverage(raw,{fillRequested:false});
    let sources=[];
    try{
      const binding=await captureProfileBinding(api.storage.local,lifecycleOptions);
      sources=(raw?.education||[]).slice(0,30).map((_row,educationIndex)=>{
        try{
          const candidate=basicCandidate(raw,educationIndex);
          return {educationIndex,hasDegree:!!candidate.profile?.education?.[educationIndex]?.degree,
            confirmedBasics:['fullName','gender','phone','birthDate','email','workStart'].filter(key=>candidate.profile?.confirmedFields?.includes(key))};
        }catch(error){return {educationIndex,error:safe(error)};}
      });
      return {
        pageState:probeResult.ok?'ready':(probeResult.looksLogin?'login_or_wall':'not_ready'),
        page:probeResult,tabId:tab.id,pageUrl:tab.url||null,
        basicJob:basic?{requestId:basic.requestId,state:basic.state,outcome:basic.outcome||null,
          educationIndex:basic.educationIndex??null,supportedComplete:basic.supportedComplete===true,
          operableComplete:basic.operableComplete===true,fieldCount:Array.isArray(basic.fields)?basic.fields.length:0}:null,
        pending:pending?{requestId:pending.requestId,kind:pending.kind||null}:null,
        profileEducationCount:educationCount,sources,profileBinding:binding,
        saveAllowedByPolicy:evaluateGthSavePolicy({fromAutoPath:true}).saveAllowedByPolicy,
        savePolicy:evaluateGthSavePolicy({fromAutoPath:true}),
        coverageReadiness,
        note:'Auto path does not Save/submit. Unsupported or unsettled 现居住地/照片 fail closed and are not a completed fill.'
      };
    }catch(error){
      return {
        pageState:probeResult.ok?'ready':(probeResult.looksLogin?'login_or_wall':'not_ready'),
        page:probeResult,tabId:tab.id,pageUrl:tab.url||null,
        basicJob:basic?{state:basic.state,outcome:basic.outcome||null}:null,
        pending:pending?{kind:pending.kind||null}:null,
        profileEducationCount:educationCount,sources,
        profileBindingError:safe(error),
        saveAllowedByPolicy:evaluateGthSavePolicy({fromAutoPath:true}).saveAllowedByPolicy,
        savePolicy:evaluateGthSavePolicy({fromAutoPath:true}),
        coverageReadiness
      };
    }
  }

  async function runFill(tab,message,readiness){
    await license();
    const educationIndex=Number.isInteger(message.educationIndex)?message.educationIndex
      :(Number.isInteger(message.profileIndex)?message.profileIndex:5);
    const replaceExisting=message.replaceExisting!==false;
    const binding=readiness.profileBinding||await captureProfileBinding(api.storage.local,lifecycleOptions);
    await assertProfileBinding(api.storage.local,binding,lifecycleOptions);
    const raw=await get('resumeProfile');
    const candidate=basicCandidate(raw,educationIndex);
    if(await canonicalProfileHash(raw,lifecycleOptions.cryptoImpl)!==binding.profileHash)fail('profile_binding_changed');
    const trusted=await get('resumeTrustedOrigins');
    if(!Array.isArray(trusted)||!trusted.includes(ORIGIN)){
      if(message.originConfirmed!==true)fail('basic_job_origin_unconfirmed');
      await withProfileBinding(api.storage.local,binding,()=>api.storage.local.set({resumeTrustedOrigins:[...(Array.isArray(trusted)?trusted:[]),ORIGIN].slice(-100)}),lifecycleOptions);
    }
    const requestId=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const key=basicJobKey(tab.id);
    let job={tabId:tab.id,origin:ORIGIN,requestId,educationIndex,replaceExisting,kind:BASIC_KIND,
      at:Date.now(),state:'queued',complete:false,supportedComplete:false,operableComplete:false,
      coverage:basicCoverage(null,educationIndex),profileBinding:binding,auto:true};
    await reserveBoundJob(api.storage.local,key,job,binding,await get(key),lifecycleOptions);
    await withProfileBinding(api.storage.local,binding,async()=>{
      await api.storage.local.set({[pendingKey(tab.id)]:{tabId:tab.id,origin:ORIGIN,at:Date.now(),requestId,
        kind:BASIC_KIND,educationIndex,replaceExisting,profileBinding:binding,auto:true}});
    },lifecycleOptions);
    job={...job,state:'running',at:Date.now()};
    await commitBoundJob(api.storage.local,key,job,binding,lifecycleOptions);
    await bounded(()=>dispatchBoundSource(api.storage.local,binding,()=>api.scripting.executeScript({target:{tabId:tab.id},files:['src/content/gth-basic.js']}),lifecycleOptions),15000);
    const response=await bounded(()=>dispatchBoundSource(api.storage.local,binding,()=>api.tabs.sendMessage(tab.id,{type:'GTH_BASIC_TRIAL',requestId,educationIndex,replaceExisting,
      profile:candidate.profile,profileBinding:binding}),lifecycleOptions));
    await assertProfileBinding(api.storage.local,binding,lifecycleOptions);
    const status=await bounded(()=>api.tabs.sendMessage(tab.id,{type:'GTH_BASIC_TRIAL_STATUS',requestId}),15000);
    const outcome=status?.ok===true&&status.data?.requestId===requestId&&status.data.state==='settled'?status.data.outcome:'unknown';
    const coverage=basicCoverage(response,educationIndex);
    const clicks=clickFlags(response);
    // A page-script Save/submit/delete report must not be rewritten to false
    // or stored as a completed fill. Pending review stays until a human looks.
    if(anySiteClick(clicks)){
      const partialFields=projectFields(response?.fields);
      const reason=clicks.softwareClickedSave?'gth_basic_save_clicked':'gth_basic_submit_or_delete_clicked';
      job={...job,state:'unknown',reason,coverage,at:Date.now(),
        ...(partialFields?{fields:partialFields}:{}),writeStarted:response?.writeStarted===true,
        ...clicks};
      await commitBoundJob(api.storage.local,key,job,binding,lifecycleOptions);
      return {job,responseSummary:{ok:false,reason,writeStarted:response?.writeStarted===true,
        fieldCount:partialFields?.length||0,...clicks},outcome};
    }
    if(!validBasicResponse(response,educationIndex)){
      if(response?.writeStarted===false&&outcome==='failed_before_write'){
        job={...job,state:'stopped_before_write',reason:safe(response?.reason),coverage,at:Date.now(),
          writeStarted:false,...clicks};
        await commitBoundJob(api.storage.local,key,job,binding,lifecycleOptions);
        await withProfileBinding(api.storage.local,binding,()=>api.storage.local.remove(pendingKey(tab.id)),lifecycleOptions);
        return {job,responseSummary:{ok:false,writeStarted:false,reason:response?.reason||null,...clicks},outcome};
      }
      const partialFields=projectFields(response?.fields);
      job={...job,state:'unknown',reason:safe(response?.reason),coverage,at:Date.now(),
        ...(partialFields?{fields:partialFields}:{}),writeStarted:response?.writeStarted===true,
        ...clicks};
      await commitBoundJob(api.storage.local,key,job,binding,lifecycleOptions);
      return {job,responseSummary:{ok:false,reason:response?.reason||null,writeStarted:response?.writeStarted===true,
        fieldCount:partialFields?.length||0,...clicks},outcome};
    }
    const fields=projectFields(response.fields);
    // Popup basic jobs refuse to complete unless status settled on verified.
    // Auto used to mark completed for unknown / failed_before_write anyway.
    if(outcome!=='verified'&&outcome!=='verified_preexisting'){
      const beforeWrite=outcome==='failed_before_write'&&response.writeStarted!==true;
      job={...job,state:beforeWrite?'stopped_before_write':'unknown',outcome,coverage,fields,
        reason:beforeWrite?'gth_basic_fill_incomplete':'gth_basic_status_unsettled',
        supportedComplete:response.supportedComplete===true,operableComplete:response.operableComplete===true,
        writeStarted:response.writeStarted===true,complete:false,liveSupportClaimed:false,at:Date.now(),...clicks};
      await commitBoundJob(api.storage.local,key,job,binding,lifecycleOptions);
      if(beforeWrite)await withProfileBinding(api.storage.local,binding,()=>api.storage.local.remove(pendingKey(tab.id)),lifecycleOptions);
      return {job,responseSummary:{ok:false,reason:job.reason,writeStarted:response.writeStarted===true,
        fieldCount:fields.length,...clicks},outcome};
    }
    const coveragePlan=planGthBasicCoverage(raw,{fillRequested:true});
    if(gthRequestedFillBlocksComplete(coveragePlan)){
      const sealed=sealGthJobCoverage(coverage,coveragePlan);
      job={...job,state:'unknown',outcome,coverage:sealed,fields,reason:coveragePlan.reason,
        supportedComplete:response.supportedComplete===true,operableComplete:response.operableComplete===true,
        writeStarted:response.writeStarted===true,complete:false,liveSupportClaimed:false,at:Date.now(),...clicks};
      await commitBoundJob(api.storage.local,key,job,binding,lifecycleOptions);
      return {job,responseSummary:{ok:false,reason:coveragePlan.reason,writeStarted:response.writeStarted===true,
        fieldCount:fields.length,...clicks},outcome};
    }
    job={...job,state:'completed',outcome,coverage,fields,
      supportedComplete:response.supportedComplete===true,operableComplete:response.operableComplete===true,
      writeStarted:response.writeStarted===true,complete:false,at:Date.now(),
      softwareClickedSave:false,softwareClickedSubmit:false,
      counts:{newlyFilled:fields.filter(row=>row.reason==='readback_matched').length,
        reapplied:fields.filter(row=>row.reason==='readback_reapplied').length,
        originalSame:fields.filter(row=>row.reason==='preexisting_same_value').length,
        siteReadOnly:fields.filter(row=>row.reason==='site_readonly').length,
        operable:fields.filter(row=>row.reason!=='site_readonly').length,unsupported:coverage.filter(row=>row.supported===false).length}};
    await commitBoundJob(api.storage.local,key,job,binding,lifecycleOptions);
    await withProfileBinding(api.storage.local,binding,()=>api.storage.local.remove(pendingKey(tab.id)),lifecycleOptions);
    return {job,responseSummary:{ok:true,editorLeftOpen:true,fieldCount:fields.length,supportedComplete:job.supportedComplete,
      operableComplete:job.operableComplete},outcome};
  }

  async function auto(message,sender=null){
    const mode=['readiness','fill'].includes(message.mode)?message.mode:'readiness';
    const openIfMissing=message.openIfMissing!==false;
    const educationIndex=Number.isInteger(message.educationIndex)?message.educationIndex
      :(Number.isInteger(message.profileIndex)?message.profileIndex:5);
    const report={version:1,kind:'gth_basic_auto',mode,at:Date.now(),educationIndex,
      replaceExisting:message.replaceExisting!==false,steps:[],helpNeeded:false,saveAttempted:false,
      writeAttempted:false,liveSupportClaimed:false,complete:false};
    const found=await findGthTab(sender?.tab?.id,{openIfMissing});
    report.steps.push({find:found.kind,tabId:found.tab.id,url:found.tab.url||null});
    await focusTab(found.tab);
    report.steps.push('focused_gth_tab');
    let probeResult=await probe(found.tab.id);
    if(!probeResult.ok){
      for(let i=0;i<8&&!probeResult.ok;i+=1){await sleep(500);probeResult=await probe(found.tab.id);}
    }
    report.steps.push({probe:probeResult.reason,ok:probeResult.ok===true});
    if(!probeResult.ok){
      const login=probeResult.looksLogin===true||probeResult.reason==='gth_wrong_page';
      if(login){
        const err=Error('gth_basic_login_or_wrong_page');
        err.helpUrl=probeResult.href||found.tab.url||PAGE;
        err.helpReason='GTH edit page not ready; login/SSO/QR or wrong page';
        throw err;
      }
      fail(probeResult.reason||'gth_basic_probe_failed');
    }
    const unlocked=await unlockIfSafe(found.tab.id);
    report.steps.push({unlock:unlocked});
    const readiness=await collectReadiness(found.tab,probeResult);
    report.readiness={
      pageState:readiness.pageState,
      editorOpen:readiness.page?.editorOpen===true,
      editLinkCount:readiness.page?.editLinkCount??null,
      basicJob:readiness.basicJob,
      pending:readiness.pending,
      profileEducationCount:readiness.profileEducationCount,
      sources:readiness.sources,
      coverageReadiness:readiness.coverageReadiness,
      saveAllowedByPolicy:evaluateGthSavePolicy({fromAutoPath:true}).saveAllowedByPolicy,
      savePolicy:evaluateGthSavePolicy({fromAutoPath:true})
    };
    report.tabId=found.tab.id;
    report.pageUrl=found.tab.url||null;

    if(mode==='readiness'){
      report.ok=true;
      report.job=readiness.basicJob;
      report.saveAllowedByPolicy=evaluateGthSavePolicy({fromAutoPath:true}).saveAllowedByPolicy;
      assertAutoNeverAttemptedSave(report);
      await api.storage.local.set({resumeGthBasicAutoRun:report});
      return report;
    }

    // mode === fill
    const filled=await runFill(found.tab,{...message,educationIndex},readiness);
    report.writeAttempted=filled.job?.writeStarted===true||filled.responseSummary?.writeStarted===true;
    report.steps.push({fill:filled.job?.state,outcome:filled.outcome});
    const clicks=clickFlags(filled.job);
    report.softwareClickedSave=clicks.softwareClickedSave;
    report.softwareClickedSubmit=clicks.softwareClickedSubmit;
    report.softwareClickedDelete=clicks.softwareClickedDelete;
    report.job=filled.job?{state:filled.job.state,reason:filled.job.reason||null,requestId:filled.job.requestId,
      outcome:filled.job.outcome||null,educationIndex:filled.job.educationIndex,
      supportedComplete:filled.job.supportedComplete===true,operableComplete:filled.job.operableComplete===true,
      fields:filled.job.fields||[],coverage:filled.job.coverage||[],counts:filled.job.counts||null,
      writeStarted:filled.job.writeStarted===true,complete:false,liveSupportClaimed:false,...clicks}:null;
    report.fill=filled.responseSummary;
    report.saveAllowedByPolicy=evaluateGthSavePolicy({fromAutoPath:true}).saveAllowedByPolicy;
    const settled=filled.job?.state==='completed'&&(filled.outcome==='verified'||filled.outcome==='verified_preexisting');
    report.ok=settled&&!anySiteClick(clicks);
    if(!report.ok)report.reason=filled.job?.reason||filled.responseSummary?.reason||'gth_basic_fill_failed';
    try{assertAutoNeverAttemptedSave(report);}catch(error){
      report.ok=false;
      report.reason=safe(error);
    }
    await api.storage.local.set({resumeGthBasicAutoRun:report});
    return report;
  }

  const listener=(message,sender,sendResponse)=>{
    if(message?.type!=='GTH_BASIC_AUTO')return false;
    if(!trustedUi(sender)){sendResponse({ok:false,reason:'gth_basic_wrong_sender'});return false;}
    auto(message,sender).then(sendResponse,error=>{
      const reason=safe(error);
      const helpUrl=error?.helpUrl||PAGE;
      const help=reason==='gth_basic_login_or_wrong_page'||reason==='gth_basic_tab_missing'||/\/login\b/i.test(String(helpUrl));
      const payload={ok:false,reason,helpNeeded:help,helpUrl,helpReason:error?.helpReason||(help?'我需要帮助！请打开已登录的国泰海通简历编辑页 https://hr.gtht.com/resume/edit/':''),
        mode:message?.mode||'readiness',saveAttempted:false,writeAttempted:false,liveSupportClaimed:false,complete:false,at:Date.now(),version:1,kind:'gth_basic_auto'};
      api.storage.local.set({resumeGthBasicAutoRun:payload}).catch(()=>{});
      sendResponse(payload);
    });
    return true;
  };
  return {listener};
}

export function installGthBasicAutoRunner(options={}){
  const runner=createGthBasicAutoRunner(options);
  (options.api||globalThis.chrome).runtime.onMessage.addListener(runner.listener);
  return runner;
}
