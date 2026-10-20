// CMS 个人基本信息 auto (mirror GTH_BASIC_AUTO). Default: readiness.
// Fill uses product RESUME_FILL; report filters to 个人基本信息必填. Never Save/submit.
// Legacy RESUME_FILL replies without an explicit completion contract fail closed.
import {captureProfileBinding,assertProfileBinding,canonicalProfileHash,
  dispatchBoundSource,withProfileBinding} from '../profile/profile-lifecycle.js';
import {awaitCmsPageDocumentFocus} from './cms-page-focus.mjs';
import {CMS_QUESTION_TEMPLATES,CMS_QUESTION_PAGE} from '../profile/site-question-templates.js';
import {seedCmsBasicFromEducation,CMS_BASIC_NEVER_SEED,CMS_BASIC_SEEDABLE} from '../profile/cms-basic-seed-from-education.mjs';
import {SITE_FACTS_KEY} from '../profile/cms-education-site-facts.mjs';

const PAGE=CMS_QUESTION_PAGE;
const ORIGIN=new URL(PAGE).origin;
const SECTION='个人基本信息必填';
const SIGNATURE=['个人基本信息必填','自我评价必填','教育经历必填'];
// Same-shell tenants (南粤 live 2026-10-19) omit 自我评价必填. Baseline 招商 keeps SIGNATURE.
const TENANT_SIGNATURE=['个人基本信息必填'];
const BASIC_TEMPLATES=CMS_QUESTION_TEMPLATES.filter(row=>row.sectionName===SECTION);
const pendingKey=tabId=>`resumePendingFillReview:${tabId}`;
const fail=reason=>{throw Error(reason);};
const safe=error=>{const value=typeof error==='string'?error:(error?.message||'');return typeof value==='string'&&/^[a-z0-9_]{2,100}$/u.test(value)?value:'cms_basic_auto_failed';};
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const base=url=>{try{const parsed=new URL(url);return parsed.origin+parsed.pathname;}catch{return '';}};
const norm=value=>String(value||'').replace(/[\s\u00a0＊*？?]+/gu,' ').trim();
const verifiedReasons=['readback_matched','readback_reapplied','preexisting_same_value'];
const wroteField=field=>['readback_matched','readback_reapplied'].includes(field?.reason);
const saveClaim=(...reports)=>({
  softwareClickedSave:reports.some(report=>report?.softwareClickedSave===true),
  softwareClickedSubmit:reports.some(report=>report?.softwareClickedSubmit===true),
  softwareClickedDelete:reports.some(report=>report?.softwareClickedDelete===true),
  savedOnSite:reports.some(report=>report?.savedOnSite===true),
  submitted:reports.some(report=>report?.submitted===true)
});
const anySaveClaim=flags=>flags.softwareClickedSave||flags.softwareClickedSubmit||flags.softwareClickedDelete
  ||flags.savedOnSite||flags.submitted;
// Basic-fill target page. Default 招商 baseline; a hotjob same-shell tenant may be passed as message.cmsPage.
// Only https://wecruit.hotjob.cn/SU<id>/pb/resumeOperation.html (no query/hash) is accepted. Photo/education/
// internship paths remain pinned to the 招商 baseline in their own modules (engine CMS_PHOTO_PAGE etc.).
const CMS_TENANT_PAGE_RE=/^https:\/\/wecruit\.hotjob\.cn\/(SU[0-9A-Za-z]{8,64})\/pb\/resumeOperation\.html$/u;
export function resolveCmsBasicTarget(cmsPage){
  if(cmsPage===undefined||cmsPage===null||cmsPage==='')return {page:PAGE,su:CMS_TENANT_PAGE_RE.exec(PAGE)[1],baseline:true,trustScope:ORIGIN};
  if(typeof cmsPage!=='string'||cmsPage.length>200)fail('cms_basic_page_invalid');
  const match=CMS_TENANT_PAGE_RE.exec(cmsPage);
  if(!match)fail('cms_basic_page_invalid');
  if(cmsPage===PAGE)return {page:PAGE,su:match[1],baseline:true,trustScope:ORIGIN};
  // Tenant trust is scoped per SU, matching popup authorizationScope().
  return {page:cmsPage,su:match[1],baseline:false,trustScope:`${ORIGIN}/${match[1]}/`};
}

function probePageFunc(expectedSignature,pageUrl){
  const normLocal=value=>String(value||'').replace(/[\s\u00a0＊*？?]+/gu,' ').trim();
  const href=location.href;
  const page=location.origin+location.pathname;
  if(page!==pageUrl){
    return {ok:false,reason:'cms_wrong_page',href,page,readyState:document.readyState,visible:document.visibilityState,
      looksLogin:/login|sso|auth|signin|passport|oauth|cas/i.test(href)||/登录|统一认证|扫码/u.test(document.title||'')||!!document.querySelector('input[type=password],.login-form,#login')};
  }
  if(document.readyState!=='complete')return {ok:false,reason:'cms_page_loading',href,readyState:document.readyState,visible:document.visibilityState};
  const headings=[...document.querySelectorAll('.form-cell > .tit-wrap .tit')].map(node=>normLocal(node.textContent));
  if(!expectedSignature.every(name=>headings.includes(name))){
    return {ok:false,reason:'cms_basic_sections_changed',href,headings,readyState:document.readyState,visible:document.visibilityState,
      looksLogin:/登录|统一认证|扫码/u.test(document.body?.innerText?.slice(0,800)||'')};
  }
  const section=[...document.querySelectorAll('.form-cell')].find(cell=>{
    const tit=cell.querySelector(':scope > .tit-wrap .tit');
    return normLocal(tit?.textContent)==='个人基本信息必填';
  });
  const items=section?[...section.querySelectorAll('.ant-form-item')].filter(item=>{
    const style=getComputedStyle(item);
    return !!item.getClientRects().length&&style.display!=='none'&&style.visibility!=='hidden';
  }):[];
  return {ok:true,reason:'cms_page_ready',href,readyState:document.readyState,visible:document.visibilityState,
    headings,sectionPresent:!!section,itemCount:items.length,timeOrigin:performance.timeOrigin,
    sectionName:'个人基本信息必填'};
}

function basicSource(profile){
  const confirmed=Array.isArray(profile?.confirmedFields)?profile.confirmedFields:[];
  const custom=profile?.customAnswers&&typeof profile.customAnswers==='object'?profile.customAnswers:{};
  const rows=BASIC_TEMPLATES.map(template=>{
    const alias=template.alias||template.question;
    const path=`customAnswers.${alias}`;
    const value=typeof custom[alias]==='string'?custom[alias]
      :(typeof custom[template.question]==='string'?custom[template.question]:'');
    const hasValue=!!String(value||'').trim()||(template.kind==='region'&&!!(custom[alias]||custom[template.question]));
    // Region facts may live in customFacts; treat confirmed path or question alias as ready signal.
    const isConfirmed=confirmed.includes(path)||confirmed.includes(`customAnswers.${template.question}`)
      ||(Array.isArray(profile?.customFacts)&&profile.customFacts.some(fact=>
        (fact?.question===alias||fact?.question===template.question)&&fact?.sectionName===SECTION));
    return {
      question:template.question,
      alias,
      path,
      kind:template.kind,
      hasValue:hasValue===true,
      confirmed:isConfirmed===true,
      ready:hasValue===true&&isConfirmed===true
    };
  });
  const readyCount=rows.filter(row=>row.ready).length;
  return {
    section:SECTION,
    questionCount:rows.length,
    readyCount,
    confirmedCount:rows.filter(row=>row.confirmed).length,
    hasValueCount:rows.filter(row=>row.hasValue).length,
    ready:readyCount>0,
    allReady:readyCount===rows.length,
    questions:rows
  };
}

function isPersonalField(field){
  if(!field||typeof field!=='object')return false;
  const section=norm(field.scope?.sectionName||field.sectionName||'');
  const path=String(field.path||'');
  // Education/internship rows stay out of the 个人基本信息 summary even when
  // their label aliases a basic question (专业名称, 学历, 学位, 毕业院校).
  if(section==='教育经历必填'||section==='实习经历')return false;
  if(/^education\.\d+\./u.test(path)||path.includes('__cms_education_'))return false;
  if(section===SECTION)return true;
  if(/^customAnswers\.(?:__cms_basic_|毕业院校|国籍\/地区|婚姻状况|期望面试地点|现居住地|籍贯)/u.test(path))return true;
  if(path.includes('__cms_basic_'))return true;
  const labels=Array.isArray(field.labels)?field.labels.map(norm):[];
  const questions=new Set(BASIC_TEMPLATES.map(row=>norm(row.question)));
  if(labels.some(label=>questions.has(label)||questions.has(label.replace(/［.*?］/gu,'').trim())))return true;
  const id=String(field.id||'');
  return id.startsWith('cms-photo-basic')||id.startsWith('cms-academic-__cms_basic')||id.startsWith('cms-scoped-input-__cms_basic');
}

function summarizeFields(fields){
  const personal=(Array.isArray(fields)?fields:[]).filter(isPersonalField).map(field=>({
    id:field.id||null,
    labels:Array.isArray(field.labels)?field.labels.slice(0,2):[],
    path:field.path||null,
    status:field.status||null,
    reason:field.reason||null,
    kind:field.kind||null,
    sectionName:field.scope?.sectionName||field.sectionName||null
  }));
  return {
    personal,
    personalCount:personal.length,
    verified:personal.filter(row=>row.status==='verified').length,
    skipped:personal.filter(row=>row.status==='skipped').length,
    failed:personal.filter(row=>row.status==='failed').length,
    totalReturned:Array.isArray(fields)?fields.length:0
  };
}

export function createCmsBasicAutoRunner({api=globalThis.chrome,verifyBeforeFill=null,timeoutMs=120000,lifecycleOptions={}}={}){
  const get=async key=>(await api.storage.local.get(key))[key];
  const autoPageUrl=()=>api.runtime.getURL('src/auto/cms-basic-auto.html');
  const educationAutoPageUrl=()=>api.runtime.getURL('src/auto/cms-education-auto.html');
  const trustedUi=sender=>{
    if(sender?.id!==api.runtime.id||typeof sender.url!=='string')return false;
    const url=sender.url.split('?')[0].split('#')[0];
    return url===autoPageUrl()||url===educationAutoPageUrl();
  };
  const bounded=(work,ms=timeoutMs)=>new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('cms_basic_auto_timeout')),ms);
    Promise.resolve().then(work).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
  });
  const license=async()=>{
    const paid=api.runtime.getManifest?.().background?.service_worker==='src/license/guard-worker.mjs';
    if(paid&&typeof verifyBeforeFill!=='function')fail('license_required');
    if(verifyBeforeFill)try{await bounded(verifyBeforeFill,15000);}catch{fail('license_required');}
  };

  async function findCmsTab(excludeTabId=null,{openIfMissing=false,page=PAGE}={}){
    const PAGE=page;
    const tabs=await api.tabs.query({});
    const exact=tabs.filter(tab=>base(tab.url)===PAGE&&tab.id!==excludeTabId);
    if(exact.length===1)return {tab:exact[0],kind:'exact'};
    if(exact.length>1){
      const ranked=[...exact].sort((a,b)=>((b.lastAccessed||0)-(a.lastAccessed||0))||((b.id||0)-(a.id||0)));
      return {tab:ranked.find(tab=>tab.active)||ranked[0],kind:'exact_multi'};
    }
    const related=tabs.filter(tab=>typeof tab.url==='string'&&tab.id!==excludeTabId&&(/hotjob\.cn/u.test(tab.url)||/wecruit/u.test(tab.url)));
    if(related.length){
      const err=Error('cms_basic_login_or_wrong_page');
      err.helpUrl=related[0].url;
      err.helpReason='CMS resumeOperation.html not open; related tab may need login/SSO';
      throw err;
    }
    if(openIfMissing){
      const created=await api.tabs.create({url:PAGE,active:true});
      for(let i=0;i<30;i+=1){
        await sleep(500);
        const tab=await api.tabs.get(created.id);
        if(base(tab.url)===PAGE&&tab.status==='complete')return {tab,kind:'opened'};
        if(typeof tab.url==='string'&&(/hotjob\.cn|wecruit/u.test(tab.url))&&base(tab.url)!==PAGE){
          const err=Error('cms_basic_login_or_wrong_page');
          err.helpUrl=tab.url;
          err.helpReason='Opened CMS URL redirected away from resumeOperation.html; login/SSO likely required';
          throw err;
        }
      }
      const tab=await api.tabs.get(created.id);
      if(base(tab.url)===PAGE)return {tab,kind:'opened_partial'};
      const err=Error('cms_basic_login_or_wrong_page');
      err.helpUrl=tab.url||PAGE;
      err.helpReason='Opened CMS resume URL but page did not settle on resumeOperation.html';
      throw err;
    }
    fail('cms_basic_tab_missing');
  }

  async function focusTab(tab){
    await api.tabs.update(tab.id,{active:true});
    if(Number.isSafeInteger(tab.windowId)&&api.windows?.update){
      try{await api.windows.update(tab.windowId,{focused:true});}catch{/* ignore */}
    }
    await sleep(250);
  }

  async function probe(tabId,PAGE,signature=SIGNATURE){
    const rows=await api.scripting.executeScript({target:{tabId},world:'MAIN',func:probePageFunc,args:[signature,PAGE]});
    const doc=rows?.length===1&&rows[0].frameId===0?rows[0].result:null;
    if(!doc)fail('cms_basic_probe_failed');
    return doc;
  }

  async function unlockIfSafe(tabId){
    const pending=pendingKey(tabId);
    const stored=await api.storage.local.get([pending,'resumePendingFillReview','resumeCmsEducationJob:'+tabId,'resumeCmsInternshipJob:'+tabId]);
    const edu=stored['resumeCmsEducationJob:'+tabId];
    const intern=stored['resumeCmsInternshipJob:'+tabId];
    if(edu&&['queued','running'].includes(edu.state))fail('cms_education_job_in_progress');
    if(intern&&['queued','running'].includes(intern.state))fail('cms_internship_job_in_progress');
    const remove=[pending];
    if(stored.resumePendingFillReview?.tabId===tabId)remove.push('resumePendingFillReview');
    if(remove.length)await api.storage.local.remove(remove);
    return {cleared:remove};
  }

  async function collectReadiness(tab,probeResult){
    const raw=await get('resumeProfile');
    const source=basicSource(raw);
    let binding=null,bindingError=null;
    try{binding=await captureProfileBinding(api.storage.local,lifecycleOptions);}
    catch(error){bindingError=safe(error);}
    return {
      pageState:probeResult.ok?'ready':(probeResult.looksLogin?'login_or_wall':'not_ready'),
      page:probeResult,tabId:tab.id,pageUrl:tab.url||null,
      basic:source,profileBinding:binding,profileBindingError:bindingError,
      saveAttempted:false,
      note:'Auto path does not Save/submit; RESUME_FILL product path; report filters 个人基本信息必填; education/internship dedicated rows stay unbound'
    };
  }

  async function runFill(tab,message,readiness,target){
    await license();
    const binding=readiness.profileBinding||await captureProfileBinding(api.storage.local,lifecycleOptions);
    await assertProfileBinding(api.storage.local,binding,lifecycleOptions);
    const raw=await get('resumeProfile');
    if(await canonicalProfileHash(raw,lifecycleOptions.cryptoImpl)!==binding.profileHash)fail('profile_binding_changed');
    const source=basicSource(raw);
    if(!source.ready)fail(source.hasValueCount?'profile_fact_unconfirmed':'missing_profile_value');
    const trusted=await get('resumeTrustedOrigins');
    const scope=target.trustScope;
    if(!Array.isArray(trusted)||!trusted.includes(scope)){
      if(message.originConfirmed!==true)fail('cms_basic_origin_unconfirmed');
      await withProfileBinding(api.storage.local,binding,()=>api.storage.local.set({resumeTrustedOrigins:[...(Array.isArray(trusted)?trusted:[]),scope].slice(-100)}),lifecycleOptions);
    }
    const requestId=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await withProfileBinding(api.storage.local,binding,async()=>{
      await api.storage.local.set({[pendingKey(tab.id)]:{tabId:tab.id,origin:ORIGIN,at:Date.now(),requestId,
        kind:'cms_basic_auto',profileBinding:binding,auto:true}});
    },lifecycleOptions);
    const files=['src/core/matcher.js','src/content/cms-date-picker.js','src/content/cms-validation-gaps.js',
      'src/content/cms-session.js','src/content/cms-school-search.js','src/content/cms-region.js',
      'src/content/cms-education-dates.js','src/content/cms-checkboxes.js','src/content/engine.js'];
    await bounded(()=>dispatchBoundSource(api.storage.local,binding,()=>api.scripting.executeScript({target:{tabId:tab.id},files}),lifecycleOptions),20000);
    let response;
    try{
      response=await bounded(()=>dispatchBoundSource(api.storage.local,binding,()=>api.tabs.sendMessage(tab.id,{
        type:'RESUME_FILL',profile:raw,attachment:null,photoUploads:null,profileBinding:binding
      }),lifecycleOptions),timeoutMs);
    }catch(error){
      await withProfileBinding(api.storage.local,binding,()=>api.storage.local.remove(pendingKey(tab.id)),lifecycleOptions).catch(()=>{});
      throw error;
    }
    const data=response?.data||{};
    // Inspect both envelopes before handling errors or pre-write claims. A trial
    // must never erase a reported click by also reporting ok:false/writeStarted:false.
    const clicks=saveClaim(response,data);
    const summary=summarizeFields(data.fields);
    const fieldWrite=Array.isArray(data.fields)&&data.fields.some(wroteField);
    const writeStarted=data.writeStarted===true||response?.writeStarted===true||fieldWrite?true
      :typeof data.writeStarted==='boolean'?data.writeStarted
      :typeof response?.writeStarted==='boolean'?response.writeStarted:null;
    let bindingError=null;
    try{await assertProfileBinding(api.storage.local,binding,lifecycleOptions);}
    catch(error){bindingError=safe(error);}
    const hasContract=['writeStarted','supportedComplete','operableComplete'].every(key=>typeof data[key]==='boolean');
    const expectedOutcome=fieldWrite?'verified':'verified_preexisting';
    const verified=summary.personalCount>0&&summary.personal.every(row=>row.status==='verified'&&verifiedReasons.includes(row.reason))
      &&[data.status,data.outcome].every(status=>status===undefined||status===expectedOutcome);
    const validContract=hasContract&&data.supportedComplete===true&&data.operableComplete===true
      &&data.writeStarted===fieldWrite&&response?.fillNotStarted!==true
      &&(response?.writeStarted===undefined||response.writeStarted===data.writeStarted);
    const fillFailed=response?.ok!==true||data.ok===false;
    const beforeWrite=fillFailed&&writeStarted!==true
      &&(response?.fillNotStarted===true||response?.writeStarted===false||data.writeStarted===false);
    const reason=anySaveClaim(clicks)?'cms_basic_save_policy_violated':bindingError
      ||(fillFailed?safe(response?.error||response?.reason||data.reason||'cms_basic_fill_failed')
        :!verified?'cms_basic_status_unsettled'
        :!validContract?'cms_basic_response_incomplete':null);
    const state=reason?(beforeWrite&&!anySaveClaim(clicks)&&!bindingError?'stopped_before_write':'unknown'):'completed';
    const outcome=state==='completed'?(fieldWrite?'verified':'verified_preexisting')
      :state==='stopped_before_write'?'failed_before_write':'unknown';
    const job={
      state,reason,requestId,outcome,writeStarted,complete:false,at:Date.now(),...clicks,
      supportedComplete:typeof data.supportedComplete==='boolean'?data.supportedComplete:null,
      operableComplete:typeof data.operableComplete==='boolean'?data.operableComplete:null,
      savedOnSite:clicks.savedOnSite?true:(data.savedOnSite??response?.savedOnSite??null),
      submitted:clicks.submitted?true:(data.submitted??response?.submitted??null),
      fields:summary.personal,summary,source
    };
    // Unknown outcomes retain pending review. Only a verified fill or an
    // explicit, consistent pre-write failure can release this request.
    if(state!=='unknown')await withProfileBinding(api.storage.local,binding,()=>api.storage.local.remove(pendingKey(tab.id)),lifecycleOptions);
    return {job,responseSummary:{ok:state==='completed',reason,writeStarted,...clicks,
      supportedComplete:job.supportedComplete,operableComplete:job.operableComplete,
      fieldCount:summary.personalCount,verified:summary.verified,
      skipped:summary.skipped,failed:summary.failed,totalReturned:summary.totalReturned,
      savedOnSite:job.savedOnSite,submitted:job.submitted},outcome};
  }

  async function runSeedFromEducation(message){
    const dryRun=message.dryRun===true;
    const raw=await get('resumeProfile');
    const storedFacts=(await get(SITE_FACTS_KEY))||null;
    const siteFactEntries=storedFacts?.version===1&&Array.isArray(storedFacts.entries)?storedFacts.entries:[];
    const preferred=Number.isInteger(message.profileIndex)?message.profileIndex:null;
    const result=seedCmsBasicFromEducation(raw,{
      profileIndex:preferred,
      siteFactEntries,
      dryRun
    });
    if(!dryRun&&result.ok&&result.reason!=='dry_run'){
      let binding=null;
      try{binding=await captureProfileBinding(api.storage.local,lifecycleOptions);}
      catch{binding=null;}
      if(binding){
        await withProfileBinding(api.storage.local,binding,()=>api.storage.local.set({resumeProfile:result.profile}),lifecycleOptions);
      }else{
        await api.storage.local.set({resumeProfile:result.profile});
      }
    }
    const source=basicSource(result.profile);
    return {
      version:1,kind:'cms_basic_auto',mode:'seed_from_education',at:Date.now(),
      ok:result.ok===true,dryRun,helpNeeded:false,saveAttempted:false,writeAttempted:false,
      seed:{
        reason:result.reason||null,
        profileIndex:result.profileIndex,
        seeded:result.seeded,
        skipped:result.skipped,
        conflicts:result.conflicts,
        neverSeeded:result.neverSeeded||[...CMS_BASIC_NEVER_SEED],
        seedable: [...CMS_BASIC_SEEDABLE]
      },
      readiness:{basic:source,note:'seed_from_education copies only confirmed education→CMS basic aliases; never 籍贯/婚姻/居住地/面试地点/国籍'},
      job:null
    };
  }

  async function auto(message,sender=null){
    const mode=['readiness','fill','seed_from_education'].includes(message.mode)?message.mode:'readiness';
    if(mode==='seed_from_education'){
      const report=await runSeedFromEducation(message);
      await api.storage.local.set({resumeCmsBasicAutoRun:report});
      return report;
    }
    const openIfMissing=message.openIfMissing===true;
    const target=resolveCmsBasicTarget(message.cmsPage);
    const report={version:1,kind:'cms_basic_auto',mode,at:Date.now(),steps:[],helpNeeded:false,
      saveAttempted:false,writeAttempted:false,cmsPage:target.page,tenantSu:target.su,baselineSu:target.baseline};
    const found=await findCmsTab(sender?.tab?.id,{openIfMissing,page:target.page});
    report.steps.push({find:found.kind,tabId:found.tab.id,url:found.tab.url||null});
    await focusTab(found.tab);
    report.steps.push('focused_cms_tab');
    try{
      await awaitCmsPageDocumentFocus(api,found.tab.id,{timeoutMs:Number.isFinite(message.focusTimeoutMs)?message.focusTimeoutMs:10000,intervalMs:100});
      report.steps.push('cms_page_has_focus');
    }catch(error){
      report.steps.push({cms_page_focus:safe(error)});
    }
    const signatureMode=target.baseline?'baseline':'tenant';
    const signature=target.baseline?SIGNATURE:TENANT_SIGNATURE;
    report.steps.push({signatureMode,signature});
    let probeResult=await probe(found.tab.id,target.page,signature);
    if(!probeResult.ok){
      for(let i=0;i<8&&!probeResult.ok;i+=1){await sleep(500);probeResult=await probe(found.tab.id,target.page,signature);}
    }
    report.steps.push({probe:probeResult.reason,ok:probeResult.ok===true,itemCount:probeResult.itemCount??null});
    if(!probeResult.ok){
      const login=probeResult.looksLogin===true||probeResult.reason==='cms_wrong_page';
      if(login){
        const err=Error('cms_basic_login_or_wrong_page');
        err.helpUrl=probeResult.href||found.tab.url||target.page;
        err.helpReason='CMS resume page not ready; login/SSO or wrong page';
        throw err;
      }
      fail(probeResult.reason||'cms_basic_probe_failed');
    }
    const unlocked=await unlockIfSafe(found.tab.id);
    report.steps.push({unlock:unlocked});
    const readiness=await collectReadiness(found.tab,probeResult);
    report.readiness={
      pageState:readiness.pageState,
      sectionPresent:readiness.page?.sectionPresent===true,
      itemCount:readiness.page?.itemCount??null,
      basic:readiness.basic,
      note:readiness.note
    };
    report.tabId=found.tab.id;
    report.pageUrl=found.tab.url||null;

    if(mode==='readiness'){
      report.ok=true;
      report.job=null;
      await api.storage.local.set({resumeCmsBasicAutoRun:report});
      return report;
    }

    const filled=await runFill(found.tab,message,readiness,target);
    report.writeAttempted=filled.job?.writeStarted===true;
    report.steps.push({fill:filled.job?.state,outcome:filled.outcome});
    const clicks=saveClaim(filled.job,filled.responseSummary);
    Object.assign(report,clicks);
    report.savedOnSite=filled.job?.savedOnSite??null;
    report.submitted=filled.job?.submitted??null;
    report.job=filled.job?{state:filled.job.state,reason:filled.job.reason||null,requestId:filled.job.requestId,
      outcome:filled.job.outcome||null,writeStarted:filled.job.writeStarted,complete:false,
      supportedComplete:filled.job.supportedComplete,operableComplete:filled.job.operableComplete,
      ...clicks,savedOnSite:filled.job.savedOnSite??null,submitted:filled.job.submitted??null,
      fields:filled.job.fields||[],summary:filled.job.summary||null,source:filled.job.source||null}:null;
    report.fill=filled.responseSummary;
    report.saveAttempted=false;
    report.ok=filled.job?.state==='completed'&&['verified','verified_preexisting'].includes(filled.outcome)
      &&filled.responseSummary?.ok===true&&!anySaveClaim(clicks);
    if(!report.ok)report.reason=filled.job?.reason||filled.responseSummary?.reason||'cms_basic_fill_failed';
    await api.storage.local.set({resumeCmsBasicAutoRun:report});
    return report;
  }

  const listener=(message,sender,sendResponse)=>{
    if(message?.type!=='CMS_BASIC_AUTO')return false;
    if(!trustedUi(sender)){sendResponse({ok:false,reason:'cms_basic_wrong_sender'});return false;}
    auto(message,sender).then(sendResponse,error=>{
      const reason=safe(error);
      let target=null;try{target=resolveCmsBasicTarget(message?.cmsPage);}catch{target=null;}
      const helpUrl=error?.helpUrl||target?.page||PAGE;
      const help=reason==='cms_basic_login_or_wrong_page'||reason==='cms_basic_tab_missing'||/login|sso|auth/i.test(String(helpUrl));
      const payload={ok:false,reason,helpNeeded:help,helpUrl,helpReason:error?.helpReason||(help?(target&&!target.baseline?`我需要帮助！请打开已登录的 hotjob 租户 ${target.su} 简历页`:'我需要帮助！请打开已登录的招商证券/CMS 简历页'):''),
        cmsPage:target?.page||null,tenantSu:target?.su||null,
        mode:message?.mode||'readiness',saveAttempted:false,writeAttempted:false,at:Date.now(),version:1,kind:'cms_basic_auto'};
      api.storage.local.set({resumeCmsBasicAutoRun:payload}).catch(()=>{});
      sendResponse(payload);
    });
    return true;
  };
  return {listener,resolveCmsBasicTarget,basicSource,isPersonalField,summarizeFields,runSeedFromEducation,seedCmsBasicFromEducation};
}

export function installCmsBasicAutoRunner(options={}){
  const runner=createCmsBasicAutoRunner(options);
  (options.api||globalThis.chrome).runtime.onMessage.addListener(runner.listener);
  return runner;
}
