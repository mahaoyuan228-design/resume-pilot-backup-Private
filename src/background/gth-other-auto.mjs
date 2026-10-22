// GTH 其他信息 auto (mirror GTH_SIMPLE_AUTO). Default: readiness.
// Fill-without-save optional. Never clicks Save/Cancel/submit. Fields: 描述/标题.
// Ready only when each question has a confirmed customAnswer and one matching
// customFact for this page. Missing values fail closed. Nothing is invented.
// liveSupportClaimed stays false. This path does not claim the site is supported.
// Fill ok is true only after a settled readback. A Save/submit/delete or
// savedOnSite/submitted claim is kept and fails closed.
import {captureProfileBinding,assertProfileBinding,canonicalProfileHash,
  dispatchBoundSource,withProfileBinding} from '../profile/profile-lifecycle.js';
import {evaluateGthSavePolicy,assertAutoNeverAttemptedSave,gthAutoSiteClaims,gthAutoSiteClaimed} from './gth-save-policy.mjs';
import {assessGthOtherFill,shippedGthOtherFill} from './gth-open-fills.mjs';

const PAGE='https://hr.gtht.com/resume/edit/',ORIGIN='https://hr.gtht.com';
const SECTION='其他信息';
const QUESTIONS=['标题','描述'];
const TITLES=['基本信息','教育经历','求职意向','工作经验','职业技能与特长','附件简历','其他信息'];
const fail=reason=>{throw Error(reason);};
const newRequestId=()=>`${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
const safe=error=>{const value=typeof error==='string'?error:(error?.message||'');return typeof value==='string'&&/^[a-z0-9_]{2,100}$/u.test(value)?value:'gth_other_auto_failed';};
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
  const section=sections[6];
  const forms=[...section.querySelectorAll('form')];
  const otherForms=sections.flatMap((node,index)=>index===6?[]:[...node.querySelectorAll('form')]);
  let editorOpen=false;
  if(forms.length>1){
    return {ok:false,reason:'gth_other_editor_ambiguous',href,editorOpen:true,
      sectionFormCount:forms.length,otherFormCount:otherForms.length};
  }
  if(forms.length===1)editorOpen=true;
  const editLinks=[...section.querySelectorAll('a.h-e-btn')].filter(node=>{
    const style=getComputedStyle(node);
    return !!node.getClientRects().length&&style.display!=='none'&&style.visibility!=='hidden'&&norm(node.textContent)==='编辑';
  });
  return {ok:true,reason:'gth_page_ready',href,readyState:document.readyState,visible:document.visibilityState,
    titles,editorOpen,editLinkCount:editLinks.length,timeOrigin:performance.timeOrigin,sectionIndex:6,sectionName:'其他信息',
    sectionFormCount:forms.length,otherFormCount:otherForms.length,
    ...(otherForms.length?{warning:'gth_other_section_editor_open'}:{})};
}

function matchingFact(profile,question,answer){
  const facts=Array.isArray(profile?.customFacts)?profile.customFacts:[];
  const matched=facts.filter(item=>item?.question===question);
  const fact=matched.length===1?matched[0]:null;
  if(!fact||fact.answer!==answer||fact.sitePageUrl!==PAGE||fact.sectionName!==SECTION||fact.rowContext!=='none')return null;
  return fact;
}
function otherSource(profile){
  const confirmed=new Set(Array.isArray(profile?.confirmedFields)?profile.confirmedFields:[]);
  const items=QUESTIONS.map(question=>{
    const value=typeof profile?.customAnswers?.[question]==='string'?profile.customAnswers[question]:'';
    const hasAnswer=!!value.trim();
    const fact=hasAnswer?matchingFact(profile,question,value):null;
    const fieldConfirmed=confirmed.has(`customAnswers.${question}`);
    return {
      question,path:`customAnswers.${question}`,hasAnswer,factOk:!!fact,confirmed:fieldConfirmed,
      ready:hasAnswer&&!!fact&&fieldConfirmed,answerLength:value.trim().length
    };
  });
  return {
    section:SECTION,
    questions:QUESTIONS,
    items,
    hasAllAnswers:items.every(item=>item.hasAnswer),
    confirmedAll:items.every(item=>item.confirmed),
    factsAll:items.every(item=>item.factOk),
    ready:items.every(item=>item.ready),
    answerLengths:Object.fromEntries(items.map(item=>[item.question,item.answerLength]))
  };
}
function otherFillProfile(profile){
  const source=otherSource(profile);
  if(!source.ready)fail(source.hasAllAnswers?'profile_fact_unconfirmed':'missing_profile_value');
  const customAnswers={};
  const customFacts=[];
  for(const question of QUESTIONS){
    const answer=profile.customAnswers[question];
    const fact=matchingFact(profile,question,answer);
    customAnswers[question]=answer;
    customFacts.push({
      question,answer:fact.answer,sitePageUrl:fact.sitePageUrl,sectionName:fact.sectionName,rowContext:fact.rowContext
    });
  }
  return {
    customAnswers,
    confirmedFields:QUESTIONS.map(question=>`customAnswers.${question}`),
    customFacts
  };
}

export function createGthOtherAutoRunner({api=globalThis.chrome,verifyBeforeFill=null,timeoutMs=90000,lifecycleOptions={}}={}){
  const get=async key=>(await api.storage.local.get(key))[key];
  const autoPageUrl=()=>api.runtime.getURL('src/auto/gth-other-auto.html');
  const trustedUi=sender=>{
    if(sender?.id!==api.runtime.id||typeof sender.url!=='string')return false;
    const url=sender.url.split('?')[0].split('#')[0];
    return url===autoPageUrl();
  };
  const bounded=(work,ms=timeoutMs)=>new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('gth_other_auto_timeout')),ms);
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
      const err=Error('gth_other_login_or_wrong_page');
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
          const err=Error('gth_other_login_or_wrong_page');
          err.helpUrl=tab.url;
          err.helpReason='Opened GTH URL redirected away from resume/edit/; login/SSO likely required';
          throw err;
        }
      }
      const tab=await api.tabs.get(created.id);
      if(tab.url===PAGE)return {tab,kind:'opened_partial'};
      const err=Error('gth_other_login_or_wrong_page');
      err.helpUrl=tab.url||PAGE;
      err.helpReason='Opened GTH edit URL but page did not settle on resume/edit/';
      throw err;
    }
    fail('gth_other_tab_missing');
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
    if(!doc)fail('gth_other_probe_failed');
    return doc;
  }

  async function collectReadiness(tab,probeResult){
    const raw=await get('resumeProfile');
    const source=otherSource(raw);
    let binding=null,bindingError=null;
    try{binding=await captureProfileBinding(api.storage.local,lifecycleOptions);}
    catch(error){bindingError=safe(error);}
    return {
      pageState:probeResult.ok?'ready':(probeResult.looksLogin?'login_or_wall':'not_ready'),
      page:probeResult,tabId:tab.id,pageUrl:tab.url||null,
      other:source,profileBinding:binding,profileBindingError:bindingError,
      saveAllowedByPolicy:evaluateGthSavePolicy({fromAutoPath:true}).saveAllowedByPolicy,
      savePolicy:evaluateGthSavePolicy({fromAutoPath:true}),
      note:'Auto path does not Save/submit and does not claim the site is supported. 标题/描述 come only from confirmed customAnswers plus one matching customFact. Missing values fail closed.'
    };
  }

  async function runFill(tab,message,readiness){
    await license();
    const binding=readiness.profileBinding||await captureProfileBinding(api.storage.local,lifecycleOptions);
    await assertProfileBinding(api.storage.local,binding,lifecycleOptions);
    const raw=await get('resumeProfile');
    if(await canonicalProfileHash(raw,lifecycleOptions.cryptoImpl)!==binding.profileHash)fail('profile_binding_changed');
    const source=otherSource(raw);
    if(!source.ready)fail(source.hasAllAnswers?'profile_fact_unconfirmed':'missing_profile_value');
    const profile=otherFillProfile(raw);
    const trusted=await get('resumeTrustedOrigins');
    if(!Array.isArray(trusted)||!trusted.includes(ORIGIN)){
      if(message.originConfirmed!==true)fail('other_job_origin_unconfirmed');
      await withProfileBinding(api.storage.local,binding,()=>api.storage.local.set({resumeTrustedOrigins:[...(Array.isArray(trusted)?trusted:[]),ORIGIN].slice(-100)}),lifecycleOptions);
    }
    const response=await bounded(()=>dispatchBoundSource(api.storage.local,binding,()=>shippedGthOtherFill({
      api,tab,requestId:newRequestId(),binding,profile,replaceExisting:false
    }),lifecycleOptions));
    await assertProfileBinding(api.storage.local,binding,lifecycleOptions);
    if(!response||typeof response!=='object')fail('gth_other_fill_no_response');
    const fields=Array.isArray(response.fields)?response.fields:[];
    const claims=gthAutoSiteClaims(response);
    const claimed=gthAutoSiteClaimed(claims);
    const assessed=assessGthOtherFill(response);
    const ok=!claimed&&assessed.ok===true;
    const job={
      state:ok?'completed':'unknown',
      reason:claimed?'gth_other_save_policy_violated':(ok?null:safe(assessed.reason||response.reason||'gth_other_fill_invalid')),
      outcome:ok?assessed.outcome:'unknown',
      section:SECTION,
      fields,
      writeStarted:response.writeStarted===true,
      editorLeftOpen:response.editorLeftOpen===true,
      liveSupportClaimed:false,
      complete:false,
      ...claims
    };
    return {job,responseSummary:{ok,writeStarted:job.writeStarted,reason:job.reason,fieldCount:fields.length,...claims},outcome:job.outcome};
  }

  async function auto(message,sender=null){
    const mode=['readiness','fill'].includes(message.mode)?message.mode:'readiness';
    const openIfMissing=message.openIfMissing!==false;
    const report={version:1,kind:'gth_other_auto',mode,at:Date.now(),section:SECTION,
      steps:[],helpNeeded:false,saveAttempted:false,writeAttempted:false,liveSupportClaimed:false,complete:false};
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
        const err=Error('gth_other_login_or_wrong_page');
        err.helpUrl=probeResult.href||found.tab.url||PAGE;
        err.helpReason='GTH edit page not ready; login/SSO/QR or wrong page';
        throw err;
      }
      fail(probeResult.reason||'gth_other_probe_failed');
    }
    const readiness=await collectReadiness(found.tab,probeResult);
    report.readiness={
      pageState:readiness.pageState,
      editorOpen:readiness.page?.editorOpen===true,
      editLinkCount:readiness.page?.editLinkCount??null,
      other:readiness.other,
      saveAllowedByPolicy:evaluateGthSavePolicy({fromAutoPath:true}).saveAllowedByPolicy,
      savePolicy:evaluateGthSavePolicy({fromAutoPath:true})
    };
    report.tabId=found.tab.id;
    report.pageUrl=found.tab.url||null;

    if(mode==='readiness'){
      report.ok=true;
      report.saveAllowedByPolicy=evaluateGthSavePolicy({fromAutoPath:true}).saveAllowedByPolicy;
      assertAutoNeverAttemptedSave(report);
      await api.storage.local.set({resumeGthOtherAutoRun:report});
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
    if(!report.ok)report.reason=filled.job?.reason||filled.responseSummary?.reason||'gth_other_fill_failed';
    try{assertAutoNeverAttemptedSave(report);}catch(error){
      report.ok=false;
      report.reason=report.reason||safe(error);
    }
    await api.storage.local.set({resumeGthOtherAutoRun:report});
    return report;
  }

  const listener=(message,sender,sendResponse)=>{
    if(message?.type!=='GTH_OTHER_AUTO')return false;
    if(!trustedUi(sender)){sendResponse({ok:false,reason:'gth_other_wrong_sender'});return false;}
    auto(message,sender).then(sendResponse,error=>{
      const reason=safe(error);
      const helpUrl=error?.helpUrl||PAGE;
      const help=reason==='gth_other_login_or_wrong_page'||reason==='gth_other_tab_missing'||/\/login\b/i.test(String(helpUrl));
      const payload={ok:false,reason,helpNeeded:help,helpUrl,helpReason:error?.helpReason||(help?'我需要帮助！请打开已登录的国泰海通简历编辑页 https://hr.gtht.com/resume/edit/':''),
        mode:message?.mode||'readiness',saveAttempted:false,writeAttempted:false,liveSupportClaimed:false,complete:false,at:Date.now(),version:1,kind:'gth_other_auto'};
      api.storage.local.set({resumeGthOtherAutoRun:payload}).catch(()=>{});
      sendResponse(payload);
    });
    return true;
  };
  return {listener,otherSource};
}

export function installGthOtherAutoRunner(options={}){
  const runner=createGthOtherAutoRunner(options);
  (options.api||globalThis.chrome).runtime.onMessage.addListener(runner.listener);
  return runner;
}
