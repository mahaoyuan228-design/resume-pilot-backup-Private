// GTH 求职意向 auto (mirror GTH_SIMPLE_AUTO). Default: readiness.
// Fill sends GTH_INTENT_FILL to the shipped content script. It does not use the
// removed test hook. Never clicks Save/submit. ok is true only when every
// requested field verified. Unsupported or unsettled intent fields fail closed
// and are not a completed fill. A Save/submit/delete or savedOnSite/submitted
// claim is kept and fails closed.
import {captureProfileBinding,assertProfileBinding,canonicalProfileHash,
  dispatchBoundSource,withProfileBinding} from '../profile/profile-lifecycle.js';
import {evaluateGthSavePolicy,assertAutoNeverAttemptedSave,gthAutoSiteClaims,gthAutoSiteClaimed} from './gth-save-policy.mjs';

const PAGE='https://hr.gtht.com/resume/edit/',ORIGIN='https://hr.gtht.com';
const SECTION='求职意向';
const SECTION_INDEX=2;
const QUESTIONS=['期望从事职位类别','期望薪资','现从事行业','现从事职位类别','现薪资'];
const OPTIONAL_QUESTIONS=['期望工作地区','到岗日期'];
const PICKER_QUESTIONS=['期望从事职位类别','现从事行业','现从事职位类别','期望工作地区'];
export const GTH_INTENT_ARRIVAL_OPTIONS=Object.freeze(['一周内','一个月内','一个月以上','即时','面议']);
export const GTH_INTENT_FILL_TYPE='GTH_INTENT_FILL';
export const GTH_INTENT_FAIL_CLOSED_REASONS=Object.freeze([
  'control_not_supported','missing_profile_value','profile_fact_unconfirmed','invalid_profile_value',
  'existing_value','blocked_by_unsettled_field','intent_target_not_unique','intent_target_not_plain_text',
  'intent_readback_mismatch','intent_other_values_changed','intent_site_validation_failed','intent_value_too_long',
  'picker_label_ambiguous','picker_structure_changed','picker_panel_not_unique','picker_panel_already_open',
  'picker_level1_missing','picker_level1_ambiguous','picker_level2_missing','picker_level2_menu_missing','picker_level2_ambiguous',
  'picker_level2_checkbox_missing','picker_counter_unknown','picker_selection_limit',
  'picker_existing_selection_conflict','picker_chip_unknown','picker_confirm_not_unique','picker_cancel_not_unique',
  'picker_readback_mismatch','picker_replace_unverified','picker_selection_not_applied','select_label_ambiguous','select_structure_changed',
  'select_menu_not_unique','select_option_missing','select_option_ambiguous'
]);
export function intentPickerAnswer(value){
  const text=typeof value==='string'?value:'';
  const parts=text.split('||');
  if(parts.length!==2||text.length>80||/[\r\n\u0000-\u001f]/u.test(text))return null;
  if(parts.some(part=>!part||part!==part.trim()))return null;
  return {l1:parts[0],l2:parts[1]};
}
export function intentValueShape(question,answer){
  if(typeof answer!=='string'||!answer.trim()||answer.length>80||/[\r\n\u0000-\u001f]/u.test(answer))return false;
  if(question==='期望薪资'||question==='现薪资')return /^\d{1,10}$/u.test(answer.trim());
  if(question==='到岗日期')return GTH_INTENT_ARRIVAL_OPTIONS.includes(answer);
  if(PICKER_QUESTIONS.includes(question))return !!intentPickerAnswer(answer);
  return false;
}
const VERIFIED_REASONS=['readback_matched','readback_reapplied','preexisting_same_value'];
const TITLES=['基本信息','教育经历','求职意向','工作经验','职业技能与特长','附件简历','其他信息'];
const fail=reason=>{throw Error(reason);};
const safe=error=>{const value=typeof error==='string'?error:(error?.message||'');return typeof value==='string'&&/^[a-z0-9_]{2,100}$/u.test(value)?value:'gth_intent_auto_failed';};
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const newRequestId=()=>`${Date.now()}-${Math.random().toString(36).slice(2,10)}`;

function probePageFunc(expectedTitles,sectionIndex,sectionName){
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
  const section=sections[sectionIndex];
  // Scope to 求职意向 only — leftover editors elsewhere must not ambiguous this section.
  const forms=[...section.querySelectorAll('form')];
  const otherForms=sections.flatMap((node,index)=>index===sectionIndex?[]:[...node.querySelectorAll('form')]);
  let editorOpen=false;
  if(forms.length>1){
    return {ok:false,reason:'gth_intent_editor_ambiguous',href,editorOpen:true,
      sectionFormCount:forms.length,otherFormCount:otherForms.length};
  }
  if(forms.length===1)editorOpen=true;
  const editLinks=[...section.querySelectorAll('a.h-e-btn')].filter(node=>{
    const style=getComputedStyle(node);
    return !!node.getClientRects().length&&style.display!=='none'&&style.visibility!=='hidden'&&norm(node.textContent)==='编辑';
  });
  return {ok:true,reason:'gth_page_ready',href,readyState:document.readyState,visible:document.visibilityState,
    titles,editorOpen,editLinkCount:editLinks.length,timeOrigin:performance.timeOrigin,sectionIndex,sectionName,
    sectionFormCount:forms.length,otherFormCount:otherForms.length,
    ...(otherForms.length?{warning:'gth_other_section_editor_open'}:{})};
}

/**
 * Readiness for the five GTH intent questions (customAnswers + customFacts + confirmedFields).
 * Exported for unit tests; never invents answers.
 */
export function intentSource(profile){
  const confirmed=new Set(Array.isArray(profile?.confirmedFields)?profile.confirmedFields:[]);
  const facts=Array.isArray(profile?.customFacts)?profile.customFacts:[];
  const items=QUESTIONS.map(question=>{
    const answer=typeof profile?.customAnswers?.[question]==='string'?profile.customAnswers[question]:'';
    const trimmed=answer.trim();
    const matched=facts.filter(item=>item?.question===question);
    const fact=matched.length===1?matched[0]:null;
    const hasAnswer=intentValueShape(question,answer);
    const factOk=!!fact&&fact.answer===trimmed&&fact.sitePageUrl===PAGE
      &&fact.sectionName===SECTION&&fact.rowContext==='none';
    const fieldConfirmed=confirmed.has(`customAnswers.${question}`);
    return {
      question,
      hasAnswer,
      factOk,
      confirmed:fieldConfirmed,
      ready:hasAnswer&&factOk&&fieldConfirmed
    };
  });
  const missing=items.filter(item=>!item.hasAnswer).map(item=>item.question);
  const unconfirmed=items.filter(item=>item.hasAnswer&&(!item.factOk||!item.confirmed)).map(item=>item.question);
  const optional=OPTIONAL_QUESTIONS.map(question=>{
    const answer=typeof profile?.customAnswers?.[question]==='string'?profile.customAnswers[question]:'';
    if(!answer.trim())return {question,include:false,ready:true};
    const matched=facts.filter(item=>item?.question===question);
    const fact=matched.length===1?matched[0]:null;
    const shape=intentValueShape(question,answer);
    const factOk=!!fact&&fact.answer===answer&&fact.sitePageUrl===PAGE&&fact.sectionName===SECTION&&fact.rowContext==='none';
    const fieldConfirmed=confirmed.has(`customAnswers.${question}`);
    return {question,include:true,ready:shape&&factOk&&fieldConfirmed,shape,factOk,confirmed:fieldConfirmed};
  });
  if(optional.some(item=>item.include&&!item.shape))missing.push(...optional.filter(item=>item.include&&!item.shape).map(item=>item.question));
  if(optional.some(item=>item.include&&item.shape&&!item.ready))unconfirmed.push(...optional.filter(item=>item.include&&item.shape&&!item.ready).map(item=>item.question));
  return {
    section:SECTION,
    questions:[...QUESTIONS],
    items,
    optional,
    readyCount:items.filter(item=>item.ready).length,
    requiredCount:QUESTIONS.length,
    ready:items.every(item=>item.ready)&&optional.every(item=>item.ready),
    missing,
    unconfirmed
  };
}

export function intentFillPayload(profile){
  const source=intentSource(profile);
  if(!source.ready){
    const error=Error(source.missing.length?'missing_profile_value':'profile_fact_unconfirmed');
    error.missing=source.missing;
    error.unconfirmed=source.unconfirmed;
    throw error;
  }
  const optional=source.optional.filter(item=>item.include&&item.ready).map(item=>item.question);
  const questions=[...QUESTIONS,...optional];
  const answers=Object.fromEntries(questions.map(question=>[question,profile.customAnswers[question]]));
  return {
    answers,
    profile:{
      customAnswers:{...answers},
      confirmedFields:questions.map(question=>`customAnswers.${question}`),
      customFacts:questions.map(question=>({
        question,answer:answers[question],sitePageUrl:PAGE,sectionName:SECTION,rowContext:'none'
      }))
    }
  };
}

/** Shipped page fill. Injects the intent content script and sends GTH_INTENT_FILL. */
export function shippedGthIntentFill({api,tab,requestId,binding,answers,profile,replaceExisting}){
  return api.scripting.executeScript({
    target:{tabId:tab.id},files:['src/content/gth-intent.js']
  }).then(()=>api.tabs.sendMessage(tab.id,{
    type:GTH_INTENT_FILL_TYPE,requestId,profileBinding:binding,answers,profile,
    replaceExisting:replaceExisting===true
  }));
}

/**
 * Fail closed unless every requested field is verified and the completion flags
 * agree. A skipped row is not a success. A save/submit claim is kept.
 */
export function assessGthIntentFill(response){
  const claims=gthAutoSiteClaims(response);
  const claimed=gthAutoSiteClaimed(claims);
  const fields=Array.isArray(response?.fields)?response.fields:[];
  const tail=fields.slice(QUESTIONS.length);
  let optionalCursor=0;
  const tailOk=tail.every(row=>{
    const at=OPTIONAL_QUESTIONS.indexOf(row?.question,optionalCursor);
    if(at<0||row.path!==`customAnswers.${row.question}`)return false;
    if(!Array.isArray(row.labels)||row.labels.length!==1||row.labels[0]!==row.question)return false;
    optionalCursor=at+1;
    return true;
  });
  const aligned=fields.length>=QUESTIONS.length&&fields.length<=QUESTIONS.length+OPTIONAL_QUESTIONS.length
    &&QUESTIONS.every((question,index)=>fields[index]?.question===question
    &&fields[index]?.path===`customAnswers.${question}`&&Array.isArray(fields[index]?.labels)
    &&fields[index].labels.length===1&&fields[index].labels[0]===question)&&tailOk;
  const verified=row=>row?.status==='verified'&&VERIFIED_REASONS.includes(row.reason);
  const allVerified=aligned&&fields.every(verified);
  const wrote=fields.some(row=>row?.reason==='readback_matched'||row?.reason==='readback_reapplied');
  const writeStarted=response?.writeStarted===true;
  const supportedComplete=response?.supportedComplete===true&&allVerified;
  const operableComplete=response?.operableComplete===true&&allVerified;
  const flagsOk=response?.complete===false&&response?.scope==='gth_intent_five'
    &&response?.savedOnSite==null&&response?.submitted==null
    &&response?.softwareClickedSave===false&&response?.softwareClickedSubmit===false
    &&response?.softwareClickedDelete!==true&&response?.editorLeftOpen===true
    &&response?.liveSupportClaimed!==true;
  const unmet=row=>row&&row.status!=='verified'&&row.reason!=='not_run';
  const failed=fields.find(row=>unmet(row)&&GTH_INTENT_FAIL_CLOSED_REASONS.includes(row.reason))
    ||fields.find(unmet);
  const writeAgrees=writeStarted===wrote;
  let reason=null;
  if(claimed)reason='gth_intent_save_policy_violated';
  else if(!aligned||!writeAgrees||response?.ok!==allVerified||!flagsOk&&allVerified)reason=safe(response?.reason||response?.error||'gth_intent_fill_invalid');
  else if(!allVerified||!supportedComplete||!operableComplete)reason=safe(failed?.reason||response?.reason||response?.error||'gth_intent_fill_invalid');
  const ok=reason==null&&allVerified&&supportedComplete&&operableComplete&&response?.ok===true;
  const state=ok?'completed':(writeStarted?'unknown':'stopped_before_write');
  const outcome=ok?(wrote?'verified':'verified_preexisting'):(writeStarted?'unknown':'failed_before_write');
  return {ok,state,reason,outcome,fields,writeStarted,supportedComplete:ok&&supportedComplete,operableComplete:ok&&operableComplete,
    complete:false,...claims};
}

export function createGthIntentAutoRunner({api=globalThis.chrome,verifyBeforeFill=null,timeoutMs=90000,lifecycleOptions={},fillIntent=null}={}){
  const get=async key=>(await api.storage.local.get(key))[key];
  const autoPageUrl=()=>api.runtime.getURL('src/auto/gth-intent-auto.html');
  const trustedUi=sender=>{
    if(sender?.id!==api.runtime.id||typeof sender.url!=='string')return false;
    const url=sender.url.split('?')[0].split('#')[0];
    return url===autoPageUrl();
  };
  const bounded=(work,ms=timeoutMs)=>new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('gth_intent_auto_timeout')),ms);
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
      const err=Error('gth_intent_login_or_wrong_page');
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
          const err=Error('gth_intent_login_or_wrong_page');
          err.helpUrl=tab.url;
          err.helpReason='Opened GTH URL redirected away from resume/edit/; login/SSO likely required';
          throw err;
        }
      }
      const tab=await api.tabs.get(created.id);
      if(tab.url===PAGE)return {tab,kind:'opened_partial'};
      const err=Error('gth_intent_login_or_wrong_page');
      err.helpUrl=tab.url||PAGE;
      err.helpReason='Opened GTH edit URL but page did not settle on resume/edit/';
      throw err;
    }
    fail('gth_intent_tab_missing');
  }

  async function focusTab(tab){
    await api.tabs.update(tab.id,{active:true});
    if(Number.isSafeInteger(tab.windowId)&&api.windows?.update){
      try{await api.windows.update(tab.windowId,{focused:true});}catch{/* ignore */}
    }
    await sleep(250);
  }

  async function probe(tabId){
    const rows=await api.scripting.executeScript({
      target:{tabId},world:'MAIN',func:probePageFunc,args:[TITLES,SECTION_INDEX,SECTION]
    });
    const doc=rows?.length===1&&rows[0].frameId===0?rows[0].result:null;
    if(!doc)fail('gth_intent_probe_failed');
    return doc;
  }

  async function collectReadiness(tab,probeResult){
    const raw=await get('resumeProfile');
    const source=intentSource(raw);
    let binding=null,bindingError=null;
    try{binding=await captureProfileBinding(api.storage.local,lifecycleOptions);}
    catch(error){bindingError=safe(error);}
    return {
      pageState:probeResult.ok?'ready':(probeResult.looksLogin?'login_or_wall':'not_ready'),
      page:probeResult,tabId:tab.id,pageUrl:tab.url||null,
      intent:source,profileBinding:binding,profileBindingError:bindingError,
      saveAllowedByPolicy:evaluateGthSavePolicy({fromAutoPath:true}).saveAllowedByPolicy,
      savePolicy:evaluateGthSavePolicy({fromAutoPath:true}),
      note:'Auto path does not Save/submit. GTH_INTENT_FILL runs only after readiness. Unsupported or unsettled intent fields fail closed and are not a completed fill.'
    };
  }

  async function runFill(tab,message,readiness){
    await license();
    const binding=readiness.profileBinding||await captureProfileBinding(api.storage.local,lifecycleOptions);
    await assertProfileBinding(api.storage.local,binding,lifecycleOptions);
    const raw=await get('resumeProfile');
    if(await canonicalProfileHash(raw,lifecycleOptions.cryptoImpl)!==binding.profileHash)fail('profile_binding_changed');
    const source=intentSource(raw);
    if(!source.ready){
      if(source.missing.length)fail('missing_profile_value');
      fail('profile_fact_unconfirmed');
    }
    const payload=intentFillPayload(raw);
    const replaceExisting=message.replaceExisting===true;
    const trusted=await get('resumeTrustedOrigins');
    if(!Array.isArray(trusted)||!trusted.includes(ORIGIN)){
      if(message.originConfirmed!==true)fail('intent_job_origin_unconfirmed');
      await withProfileBinding(api.storage.local,binding,()=>api.storage.local.set({resumeTrustedOrigins:[...(Array.isArray(trusted)?trusted:[]),ORIGIN].slice(-100)}),lifecycleOptions);
    }
    const fill=typeof fillIntent==='function'?fillIntent:shippedGthIntentFill;
    const requestId=typeof message.requestId==='string'&&/^[A-Za-z0-9-]{10,100}$/u.test(message.requestId)
      ?message.requestId:newRequestId();
    const response=await bounded(()=>dispatchBoundSource(api.storage.local,binding,()=>fill({
      api,tab,requestId,binding,answers:payload.answers,profile:payload.profile,replaceExisting
    }),lifecycleOptions));
    await assertProfileBinding(api.storage.local,binding,lifecycleOptions);
    if(!response||typeof response!=='object')fail('gth_intent_fill_no_response');
    const assessed=assessGthIntentFill(response);
    const job={
      state:assessed.state,
      reason:assessed.reason,
      outcome:assessed.outcome,
      section:SECTION,
      fields:assessed.fields,
      writeStarted:assessed.writeStarted,
      supportedComplete:assessed.supportedComplete===true,
      operableComplete:assessed.operableComplete===true,
      complete:false,
      editorLeftOpen:response.editorLeftOpen===true,
      liveSupportClaimed:false,
      softwareClickedSave:assessed.softwareClickedSave===true,
      softwareClickedSubmit:assessed.softwareClickedSubmit===true,
      softwareClickedDelete:assessed.softwareClickedDelete===true,
      savedOnSite:assessed.savedOnSite===true,
      submitted:assessed.submitted===true,
      requestId
    };
    return {job,responseSummary:{ok:assessed.ok,writeStarted:job.writeStarted,reason:job.reason,
      supportedComplete:job.supportedComplete,operableComplete:job.operableComplete,fieldCount:assessed.fields.length,
      softwareClickedSave:job.softwareClickedSave,softwareClickedSubmit:job.softwareClickedSubmit,
      softwareClickedDelete:job.softwareClickedDelete,savedOnSite:job.savedOnSite,submitted:job.submitted},outcome:job.outcome};
  }

  async function auto(message,sender=null){
    const mode=['readiness','fill'].includes(message.mode)?message.mode:'readiness';
    const openIfMissing=message.openIfMissing!==false;
    const report={version:1,kind:'gth_intent_auto',mode,at:Date.now(),section:SECTION,
      steps:[],helpNeeded:false,saveAttempted:false,writeAttempted:false};
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
        const err=Error('gth_intent_login_or_wrong_page');
        err.helpUrl=probeResult.href||found.tab.url||PAGE;
        err.helpReason='GTH edit page not ready; login/SSO/QR or wrong page';
        throw err;
      }
      fail(probeResult.reason||'gth_intent_probe_failed');
    }
    const readiness=await collectReadiness(found.tab,probeResult);
    report.readiness={
      pageState:readiness.pageState,
      editorOpen:readiness.page?.editorOpen===true,
      editLinkCount:readiness.page?.editLinkCount??null,
      intent:readiness.intent,
      saveAllowedByPolicy:evaluateGthSavePolicy({fromAutoPath:true}).saveAllowedByPolicy,
      savePolicy:evaluateGthSavePolicy({fromAutoPath:true})
    };
    report.tabId=found.tab.id;
    report.pageUrl=found.tab.url||null;

    if(mode==='readiness'){
      report.ok=true;
      report.saveAllowedByPolicy=evaluateGthSavePolicy({fromAutoPath:true}).saveAllowedByPolicy;
      assertAutoNeverAttemptedSave(report);
      await api.storage.local.set({resumeGthIntentAutoRun:report});
      return report;
    }

    const filled=await runFill(found.tab,message,readiness);
    report.writeAttempted=filled.job?.writeStarted===true;
    report.steps.push({fill:filled.job?.state,outcome:filled.outcome});
    report.job=filled.job;
    report.fill=filled.responseSummary;
    report.saveAllowedByPolicy=evaluateGthSavePolicy({fromAutoPath:true}).saveAllowedByPolicy;
    const claims=gthAutoSiteClaims(filled.job);
    Object.assign(report,claims);
    const settled=filled.job?.state==='completed'&&filled.responseSummary?.ok===true&&!gthAutoSiteClaimed(claims);
    report.ok=settled;
    if(!report.ok)report.reason=filled.job?.reason||filled.responseSummary?.reason||'gth_intent_fill_failed';
    try{assertAutoNeverAttemptedSave(report);}catch(error){
      report.ok=false;
      report.reason=report.reason||safe(error);
    }
    await api.storage.local.set({resumeGthIntentAutoRun:report});
    return report;
  }

  const listener=(message,sender,sendResponse)=>{
    if(message?.type!=='GTH_INTENT_AUTO')return false;
    if(!trustedUi(sender)){sendResponse({ok:false,reason:'gth_intent_wrong_sender'});return false;}
    auto(message,sender).then(sendResponse,error=>{
      const reason=safe(error);
      const helpUrl=error?.helpUrl||PAGE;
      const help=reason==='gth_intent_login_or_wrong_page'||reason==='gth_intent_tab_missing'||/\/login\b/i.test(String(helpUrl));
      const payload={ok:false,reason,helpNeeded:help,helpUrl,helpReason:error?.helpReason||(help?'我需要帮助！请打开已登录的国泰海通简历编辑页 https://hr.gtht.com/resume/edit/':''),
        mode:message?.mode||'readiness',saveAttempted:false,writeAttempted:false,at:Date.now(),version:1,kind:'gth_intent_auto'};
      api.storage.local.set({resumeGthIntentAutoRun:payload}).catch(()=>{});
      sendResponse(payload);
    });
    return true;
  };
  return {listener,intentSource};
}

export function installGthIntentAutoRunner(options={}){
  const runner=createGthIntentAutoRunner(options);
  (options.api||globalThis.chrome).runtime.onMessage.addListener(runner.listener);
  return runner;
}
