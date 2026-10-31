// UI preparation may await storage. A click must dispatch its immutable source
// snapshot synchronously; the worker owns every subsequent asynchronous step.
import {loadProfile} from '../profile/store.js';
import {captureProfileBinding,assertProfileBinding} from '../profile/profile-lifecycle.js';
import {BASIC_PAGE,BASIC_KIND,basicCandidate,basicCoverage,basicJobKey,GTH_COVERAGE_FAIL_CLOSED_REASONS} from '../background/basic-task-runner.mjs';
export const GTH_BASIC_PAGE=BASIC_PAGE;
export const GTH_BASIC_PENDING_KIND=BASIC_KIND;
export const confirmedGthBasicProfile=(profile,index)=>basicCandidate(profile,index).profile;
export function gthBasicEducationSources(profile) {
  const confirmed=new Set(profile?.confirmedFields||[]);
  return (profile?.education||[]).flatMap((row,index)=>row?.degree&&confirmed.has(`education.${index}.degree`)
    ?[{educationIndex:index,degree:row.degree}]:[]);
}
const failure=(reason,index)=>({ok:false,reason,complete:false,supportedComplete:false,
  coverage:basicCoverage(null,index),message:reason==='basic_education_source_required'
    ?'请等待资料加载并明确选择最高学历的资料来源。':'后台任务未开始；本页可能已有运行或待核对结果。'});
function summary(job) {
  const counts=job?.counts||{},state=job?.state;
  return {ok:state==='completed'||state==='stopped_before_write',job,complete:false,
    supportedComplete:state==='completed'&&job.supportedComplete===true,
    operableComplete:state==='completed'&&job.operableComplete===true,
    coverage:job?.coverage||basicCoverage(null,job?.educationIndex),
    fields:job?.fields||[],counts,reason:job?.reason||null,activeField:job?.activeField||null,
    selectorStep:job?.selectorStep||null,completedFields:job?.completedFields||[],writeStarted:job?.writeStarted===true,
    pending:['queued','running','unknown'].includes(state),message:state==='completed'
      ?`基本信息共9题：可填写 ${counts.operable??7} 题，账户只读 ${counts.siteReadOnly||0} 题，2题尚未实现。软件新填 ${counts.newlyFilled||0}，已执行重填 ${counts.reapplied||0}，原有同值 ${counts.originalSame||0}。保存和刷新尚未验收。`
      :state==='stopped_before_write'?'基本信息后台任务已在写入前停止。'
        :state==='unknown'&&GTH_COVERAGE_FAIL_CLOSED_REASONS.includes(job?.reason)
          ?'现居住地或照片未能填写（控件尚未支持，或地区资料未定）。本次不记为完成，未保存、未提交。'
          :state==='unknown'?'基本信息结果仍不明确，本页保留待核对状态，未重复填写。'
          :'基本信息已交给后台继续执行，关闭弹窗也不会中断；不保存、不投递。'};
}
export function createGthBasicActions(deps) {
  const required=['getTab','getBusy','setBusy','getUncertain','setUncertain','pendingReviewFor'];
  if(!deps||required.some(key=>typeof deps[key]!=='function'))throw TypeError('basic_popup_dependencies_missing');
  let prepared=null;
  async function prepare(input={}) {
    prepared=null;
    const profileBinding=await captureProfileBinding(chrome.storage.local);
    const tab=input.tab||await deps.getTab(),profile=await loadProfile();
    if(tab?.url!==BASIC_PAGE)return null;
    const trusted=input.trusted===undefined
      ?((await chrome.storage.local.get('resumeTrustedOrigins')).resumeTrustedOrigins||[]).includes(new URL(BASIC_PAGE).origin)
      :input.trusted===true;
    const candidates=gthBasicEducationSources(profile).map(({educationIndex})=>basicCandidate(profile,educationIndex));
    await assertProfileBinding(chrome.storage.local,profileBinding);
    prepared={tab:{id:tab.id,url:tab.url},trusted,candidates,profileBinding};
    return {tab:prepared.tab,educationSources:gthBasicEducationSources(profile),trusted};
  }
  function run(options) {
    if(deps.getBusy()||deps.getUncertain())return Promise.resolve(failure('basic_pending',options?.educationIndex));
    const educationIndex=options?.educationIndex,replaceExisting=options?.replaceExisting===true;
    const snapshot=prepared,candidate=snapshot?.candidates.find(row=>row.educationIndex===educationIndex);
    if(!candidate||options.replaceExisting!==undefined&&typeof options.replaceExisting!=='boolean')
      return Promise.resolve(failure('basic_education_source_required',educationIndex));
    const current=typeof deps.peekTab==='function'?deps.peekTab():snapshot.tab;
    if(current?.id!==snapshot.tab.id||current?.url!==BASIC_PAGE)return Promise.resolve(failure('basic_wrong_tab',educationIndex));
    let originConfirmed=snapshot.trusted;
    if(!originConfirmed){
      originConfirmed=typeof deps.confirmOrigin==='function'&&deps.confirmOrigin({origin:new URL(BASIC_PAGE).origin,replaceExisting})===true;
      if(!originConfirmed)return Promise.resolve(failure('basic_origin_untrusted',educationIndex));
    }
    deps.setBusy(true);
    let queued;
    try{
      // Before the first await or continuation. Do not move storage, tab queries,
      // licensing, script injection or DOM work back into this popup handler.
      queued=chrome.runtime.sendMessage({type:'GTH_BASIC_JOB_START',tabId:snapshot.tab.id,pageUrl:BASIC_PAGE,
        educationIndex,replaceExisting,candidateSnapshot:structuredClone(candidate),originConfirmed,profileBinding:snapshot.profileBinding});
    }catch{deps.setBusy(false);return Promise.resolve(failure('basic_queue_failed',educationIndex));}
    return Promise.resolve(queued).then(accepted=>{
      if(accepted?.ok!==true||accepted.accepted!==true)return {...failure(accepted?.error||'basic_queue_failed',educationIndex),requestId:accepted?.requestId};
      snapshot.trusted=true;deps.setUncertain(true);
      return {ok:true,accepted:true,requestId:accepted.requestId,tabId:snapshot.tab.id,complete:false,supportedComplete:false,
        coverage:basicCoverage(null,educationIndex),message:'基本信息任务已交给后台；关闭弹窗也不会中断，不保存、不投递。'};
    },()=>failure('basic_queue_unknown',educationIndex)).finally(()=>deps.setBusy(false));
  }
  async function review(tab) {
    tab=tab||await deps.getTab();
    if(tab?.url!==BASIC_PAGE)return failure('basic_wrong_tab');
    let response;
    try{response=await chrome.runtime.sendMessage({type:'GTH_BASIC_JOB_STATUS',tabId:tab.id});}
    catch{return failure('basic_status_unknown');}
    if(!response?.ok||!response.data)return failure('basic_status_unknown');
    const result=summary(response.data),pending=await deps.pendingReviewFor(tab);
    deps.setUncertain(!!pending||result.pending);return {...result,pending:!!pending||result.pending};
  }
  async function waitForResult(requestId,tabId=prepared?.tab.id,timeoutMs=80000) {
    const end=Date.now()+timeoutMs,key=basicJobKey(tabId);
    do{
      const job=(await chrome.storage.local.get(key))[key];
      if(job?.requestId===requestId&&['completed','unknown','stopped_before_write'].includes(job.state)){
        await assertProfileBinding(chrome.storage.local,job.profileBinding);
        const tab={id:tabId,url:BASIC_PAGE},pending=await deps.pendingReviewFor(tab);
        const result=summary(job);deps.setUncertain(!!pending||result.pending);return {...result,pending:!!pending||result.pending};
      }
      await new Promise(resolve=>setTimeout(resolve,200));
    }while(Date.now()<end);
    return failure('basic_status_unknown');
  }
  return Object.freeze({prepare,run,review,waitForResult,invalidate:()=>{prepared=null;},
    educationSources:async()=>gthBasicEducationSources(await loadProfile())});
}
