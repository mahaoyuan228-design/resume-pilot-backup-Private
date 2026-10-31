import {appendAutoAdvisory as recordAutoAdvisory} from './auto-form-readiness.mjs';
// GTH 职业技能与特长 auto (mirror GTH_BASIC_AUTO). Default: readiness.
// Fill-without-save optional. Never clicks Save/Cancel/submit.
// Ready only with a confirmed customAnswer and one matching customFact for
// this page. Missing values fail closed. Nothing is invented.
// liveSupportClaimed stays false. This path does not claim the site is supported.
// Fill ok is true only after a settled readback. A Save/submit/delete or
// savedOnSite/submitted claim is kept and fails closed.
import {captureProfileBinding,assertProfileBinding,canonicalProfileHash,
  dispatchBoundSource,withProfileBinding} from '../profile/profile-lifecycle.js';
import {evaluateGthSavePolicy,assertAutoNeverAttemptedSave,gthAutoSiteClaims,gthAutoSiteClaimed} from './gth-save-policy.mjs';
import {assessGthSkillsFill,shippedGthSkillsFill} from './gth-open-fills.mjs';

const PAGE='https://hr.gtht.com/resume/edit/',ORIGIN='https://hr.gtht.com';
const SECTION='职业技能与特长';
const TITLES=['基本信息','教育经历','求职意向','工作经验','职业技能与特长','附件简历','其他信息'];
const fail=reason=>{throw Error(reason);};
const newRequestId=()=>`${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
const safe=error=>{const value=typeof error==='string'?error:(error?.message||'');return typeof value==='string'&&/^[a-z0-9_]{2,100}$/u.test(value)?value:'gth_simple_auto_failed';};
const sleep=ms=>new Promise(done=>setTimeout(done,ms));

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
  const section=sections[4];
  // Scope to 职业技能 section only — other-section leftover forms must not ambiguous.
  const forms=[...section.querySelectorAll('form')];
  const otherForms=sections.flatMap((node,index)=>index===4?[]:[...node.querySelectorAll('form')]);
  let editorOpen=false;
  if(forms.length>1){
    return {ok:false,reason:'gth_simple_editor_ambiguous',href,editorOpen:true,
      sectionFormCount:forms.length,otherFormCount:otherForms.length};
  }
  if(forms.length===1)editorOpen=true;
  const editLinks=[...section.querySelectorAll('a.h-e-btn')].filter(node=>{
    const style=getComputedStyle(node);
    return !!node.getClientRects().length&&style.display!=='none'&&style.visibility!=='hidden'&&norm(node.textContent)==='编辑';
  });
  return {ok:true,reason:'gth_page_ready',href,readyState:document.readyState,visible:document.visibilityState,
    titles,editorOpen,editLinkCount:editLinks.length,timeOrigin:performance.timeOrigin,sectionIndex:4,sectionName:'职业技能与特长',
    sectionFormCount:forms.length,otherFormCount:otherForms.length,
    ...(otherForms.length?{warning:'gth_other_section_editor_open'}:{})};
}

function matchingFact(profile,answer){
  const facts=Array.isArray(profile?.customFacts)?profile.customFacts:[];
  const matched=facts.filter(item=>item?.question===SECTION);
  const fact=matched.length===1?matched[0]:null;
  if(!fact||fact.answer!==answer||fact.sitePageUrl!==PAGE||fact.sectionName!==SECTION||fact.rowContext!=='none')return null;
  return fact;
}
function skillsSource(profile){
  const answer=typeof profile?.customAnswers?.[SECTION]==='string'?profile.customAnswers[SECTION]:'';
  const hasAnswer=!!answer.trim();
  const fact=hasAnswer?matchingFact(profile,answer):null;
  const confirmed=Array.isArray(profile?.confirmedFields)&&profile.confirmedFields.includes(`customAnswers.${SECTION}`);
  return {
    section:SECTION,
    path:`customAnswers.${SECTION}`,
    hasAnswer,
    answerLength:answer.trim().length,
    factOk:!!fact,
    confirmed:confirmed===true,
    ready:hasAnswer&&!!fact&&confirmed===true
  };
}
function skillsFillProfile(profile){
  const source=skillsSource(profile);
  if(!source.ready)fail(source.hasAnswer?'profile_fact_unconfirmed':'missing_profile_value');
  const answer=profile.customAnswers[SECTION];
  const fact=matchingFact(profile,answer);
  return {
    customAnswers:{[SECTION]:answer},
    confirmedFields:[`customAnswers.${SECTION}`],
    customFacts:[{
      question:SECTION,answer:fact.answer,sitePageUrl:fact.sitePageUrl,sectionName:fact.sectionName,rowContext:fact.rowContext
    }]
  };
}

export function createGthSimpleAutoRunner({api=globalThis.chrome,verifyBeforeFill=null,timeoutMs=90000,lifecycleOptions={}}={}){
  const get=async key=>(await api.storage.local.get(key))[key];
  const autoPageUrl=()=>api.runtime.getURL('src/auto/gth-simple-auto.html');
  const trustedUi=sender=>{
    if(sender?.id!==api.runtime.id||typeof sender.url!=='string')return false;
    const url=sender.url.split('?')[0].split('#')[0];
    return url===autoPageUrl();
  };
  const bounded=(work,ms=timeoutMs)=>new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('gth_simple_auto_timeout')),ms);
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
    if (!tab) fail('gth_simple_tab_missing');
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
    return doc || {ok:false,reason:'gth_simple_probe_failed'};
  }

  async function collectReadiness(tab,probeResult){
    const raw=await get('resumeProfile');
    const source=skillsSource(raw);
    let binding=null,bindingError=null;
    try{binding=await captureProfileBinding(api.storage.local,lifecycleOptions);}
    catch(error){bindingError=safe(error);}
    return {
      pageState:probeResult.ok?'ready':(probeResult.looksLogin?'login_or_wall':'not_ready'),
      page:probeResult,tabId:tab.id,pageUrl:tab.url||null,
      skills:source,profileBinding:binding,profileBindingError:bindingError,
      saveAllowedByPolicy:evaluateGthSavePolicy({fromAutoPath:true}).saveAllowedByPolicy,
      savePolicy:evaluateGthSavePolicy({fromAutoPath:true}),
      note:'Auto path does not Save/submit and does not claim the site is supported. 职业技能与特长 comes only from a confirmed customAnswer plus one matching customFact. Missing values fail closed.'
    };
  }

  async function runFill(tab,message,readiness){
    await license();
    const binding=readiness.profileBinding||await captureProfileBinding(api.storage.local,lifecycleOptions);
    await assertProfileBinding(api.storage.local,binding,lifecycleOptions);
    const raw=await get('resumeProfile');
    if(await canonicalProfileHash(raw,lifecycleOptions.cryptoImpl)!==binding.profileHash)fail('profile_binding_changed');
    const source=skillsSource(raw);
    if(!source.ready)fail(source.hasAnswer?'profile_fact_unconfirmed':'missing_profile_value');
    const profile=skillsFillProfile(raw);
    const trusted=await get('resumeTrustedOrigins');
    if(!Array.isArray(trusted)||!trusted.includes(ORIGIN)){
      if(message.originConfirmed!==true)fail('simple_job_origin_unconfirmed');
      await withProfileBinding(api.storage.local,binding,()=>api.storage.local.set({resumeTrustedOrigins:[...(Array.isArray(trusted)?trusted:[]),ORIGIN].slice(-100)}),lifecycleOptions);
    }
    let response=null,failureReason=null,dispatched=false,dispatchClosed=false;
    try{
      response=await bounded(()=>dispatchBoundSource(api.storage.local,binding,()=>{
        // A timed-out lock wait must not dispatch a fill later.
        if(dispatchClosed)fail('gth_simple_auto_timeout');
        return shippedGthSkillsFill({api,tab,requestId:newRequestId(),binding,profile,replaceExisting:false,
          beforeSend:()=>{
            if(dispatchClosed)fail('gth_simple_auto_timeout');
            dispatched=true;
          }});
      },lifecycleOptions));
      await assertProfileBinding(api.storage.local,binding,lifecycleOptions);
      if(!response||typeof response!=='object')fail('gth_simple_fill_no_response');
    }catch(error){
      dispatchClosed=true;
      if(!dispatched)throw error;
      // Binding invalidation cannot erase an already received write/policy claim.
      // A missing reply after dispatch proves neither a write nor a no-write.
      failureReason=safe(error);
    }
    const claims=gthAutoSiteClaims(response);
    const claimed=gthAutoSiteClaimed(claims);
    const assessed=assessGthSkillsFill(response);
    const ok=!failureReason&&!claimed&&assessed.ok===true;
    const fields=!failureReason&&Array.isArray(response?.fields)?response.fields:[];
    const field=fields.length===1?fields[0]:null;
    const job={
      state:ok?'completed':'unknown',
      reason:claimed?'gth_simple_save_policy_violated':(failureReason||(ok?null:safe(assessed.reason||response?.reason||'gth_simple_fill_invalid'))),
      ...(failureReason?{failureReason}:{}),
      outcome:ok?assessed.outcome:'unknown',
      section:SECTION,
      fields,
      writeStarted:response?.writeStarted===true,
      writeMayHaveStarted:response?.writeStarted===true||(dispatched&&response?.writeStarted!==false),
      editorLeftOpen:response?.editorLeftOpen===true,
      liveSupportClaimed:false,
      complete:false,
      ...claims
    };
    return {job,responseSummary:{ok,writeStarted:job.writeStarted,reason:job.reason,field,...claims},outcome:job.outcome};
  }

  async function auto(message,sender=null){
    const mode=['readiness','fill'].includes(message.mode)?message.mode:'readiness';
    const openIfMissing=message.openIfMissing!==false;
    const report={version:1,kind:'gth_simple_auto',mode,at:Date.now(),section:SECTION,
      steps:[],helpNeeded:false,saveAttempted:false,writeAttempted:false,liveSupportClaimed:false,complete:false};
    report.advisoryHints = [];
    const found=await findGthTab(sender?.tab?.id,{openIfMissing});
    report.steps.push({find:found.kind,tabId:found.tab.id,url:found.tab.url||null});
    await focusTab(found.tab);
    report.steps.push('focused_gth_tab');
    const probeResult=await probe(found.tab.id);
    report.steps.push({probe:probeResult.reason,ok:probeResult.ok===true});
    recordAutoAdvisory(report, probeResult);
    const readiness=await collectReadiness(found.tab,probeResult);
    readiness.advisoryHints = report.advisoryHints;
    report.readiness={
      pageState:readiness.pageState,
      editorOpen:readiness.page?.editorOpen===true,
      editLinkCount:readiness.page?.editLinkCount??null,
      skills:readiness.skills,
      saveAllowedByPolicy:evaluateGthSavePolicy({fromAutoPath:true}).saveAllowedByPolicy,
      savePolicy:evaluateGthSavePolicy({fromAutoPath:true})
    };
    report.tabId=found.tab.id;
    report.pageUrl=found.tab.url||null;

    if(mode==='readiness'){
      report.ok=true;
      report.saveAllowedByPolicy=evaluateGthSavePolicy({fromAutoPath:true}).saveAllowedByPolicy;
      assertAutoNeverAttemptedSave(report);
      await api.storage.local.set({resumeGthSimpleAutoRun:report});
      return report;
    }

    const filled=await runFill(found.tab,message,readiness);
    report.writeMayHaveStarted=filled.job?.writeMayHaveStarted===true;
    report.writeAttempted=filled.job?.writeStarted===true?true:(report.writeMayHaveStarted?null:false);
    report.steps.push({fill:filled.job?.state,outcome:filled.outcome});
    report.job=filled.job;
    report.fill=filled.responseSummary;
    report.saveAllowedByPolicy=evaluateGthSavePolicy({fromAutoPath:true}).saveAllowedByPolicy;
    const claims=gthAutoSiteClaims(filled.job);
    Object.assign(report,claims);
    const settled=filled.job?.state==='completed'&&filled.responseSummary?.ok===true&&!gthAutoSiteClaimed(claims);
    report.ok=settled;
    if(!report.ok)report.reason=filled.job?.reason||filled.responseSummary?.reason||'gth_simple_fill_failed';
    try{assertAutoNeverAttemptedSave(report);}catch(error){
      report.ok=false;
      report.reason=report.reason||safe(error);
    }
    await api.storage.local.set({resumeGthSimpleAutoRun:report});
    return report;
  }

  const listener=(message,sender,sendResponse)=>{
    if(message?.type!=='GTH_SIMPLE_AUTO')return false;
    if(!trustedUi(sender)){sendResponse({ok:false,reason:'gth_simple_wrong_sender'});return false;}
    auto(message,sender).then(sendResponse,error=>{
      const reason=safe(error);
      const helpUrl=error?.helpUrl||PAGE;
      const help=reason==='gth_simple_login_or_wrong_page'||reason==='gth_simple_tab_missing'||/\/login\b/i.test(String(helpUrl));
      const payload={ok:false,reason,helpNeeded:help,helpUrl,helpReason:error?.helpReason||(help?'我需要帮助！请打开已登录的国泰海通简历编辑页 https://hr.gtht.com/resume/edit/':''),
        mode:message?.mode||'readiness',saveAttempted:false,saveAllowedByPolicy:false,writeAttempted:false,writeMayHaveStarted:false,liveSupportClaimed:false,complete:false,at:Date.now(),version:1,kind:'gth_simple_auto'};
      api.storage.local.set({resumeGthSimpleAutoRun:payload}).catch(()=>{});
      sendResponse(payload);
    });
    return true;
  };
  return {listener,skillsSource};
}

export function installGthSimpleAutoRunner(options={}){
  const runner=createGthSimpleAutoRunner(options);
  (options.api||globalThis.chrome).runtime.onMessage.addListener(runner.listener);
  return runner;
}
