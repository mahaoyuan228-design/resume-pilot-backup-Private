import {educationCandidate} from '../background/education-task-runner.mjs';
export const GTH_EDUCATION_PAGE='https://hr.gtht.com/resume/edit/';
const PHASES=['server_verified_needs_refresh','refreshing_saved_record','verifying_saved_after_refresh'];
const fingerprint=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
const sameBinding=(a,b)=>a?.version===1&&b?.version===1&&a.epoch===b.epoch&&a.profileHash===b.profileHash;
export function fullEducationCandidates(profile){return (profile.education||[]).slice(0,30).map((_row,index)=>educationCandidate(profile,index));}
export function canResumeGthDraft(job,source){return source?.state==='completed'&&source.outcome==='verified'&&source.requestId===job?.requestId
 &&job.targetSaved===true&&fingerprint(job.phaseProof?.proofHash)&&sameBinding(job.profileBinding,source.profileBinding)&&[...PHASES,'unknown'].includes(job.state);}
export function gthDraftMessage(job){
 if(job?.state==='ready'){
  // Policy currently deferred: clarify readyToSave ≠ software will Save (future one-shot).
  return '草稿检查已通过。当前保存仍暂缓：软件不会自动点保存；醒后请按教育草稿就绪说明再决定是否手动保存一次并刷新核对。不会投递岗位。';
 }
 if(job?.state==='server_verified_needs_refresh')return '已找到保存后的教育记录并核对12项，正在准备刷新复核。';
 if(job?.state==='refreshing_saved_record')return '正在刷新网页，核对草稿是否保留。不会再次点击保存。';
 if(job?.state==='verifying_saved_after_refresh')return '正在核对刷新后的同一条教育记录与其他分区。';
 if(job?.state==='completed')return job.refreshVerified===true?'本条教育草稿已保存，刷新后的12项和其他记录已核对。未投递岗位。':'已重新读回12项，完整刷新核对尚未完成。';
 if(job?.state==='unknown')return job.targetSaved===true?'已找到保存记录，但后续核对未完成。可以点击“继续核对已保存草稿”；不会重复保存。':'保存结果尚未确认，已暂停并保留现场。请检查网页，不要重复保存。';
 if(job?.state==='stopped_before_write')return '保存前检查未通过，本次没有再次保存。请检查网页和资料。';
 return '教育填写完成后，先检查草稿，再决定是否保存；不会最终投递。';
}
// Read only; counting rows never installs/resets the education filler.
export function readEducationTargets(){
 const PAGE='https://hr.gtht.com/resume/edit/',titles=['基本信息','教育经历','求职意向','工作经验','职业技能与特长','附件简历','其他信息'];
 const norm=value=>String(value||'').replace(/[\s\u00a0]+/gu,' ').trim();
 if(location.href!==PAGE||document.readyState!=='complete'||document.visibilityState!=='visible')return {ok:false,reason:'education_target_page_unavailable'};
 const sections=[...document.querySelectorAll('.r-section')];
 if(JSON.stringify(sections.map(section=>{const title=section.querySelector('.title_')?.cloneNode(true);title?.querySelectorAll('button,a').forEach(node=>node.remove());return norm(title?.textContent);}))!==JSON.stringify(titles))return {ok:false,reason:'education_target_sections_changed'};
 const section=sections[1],forms=sections.flatMap(node=>[...node.querySelectorAll('form')]);let count=section.querySelectorAll('.sec-context > .sec-detail').length;
 if(forms.length){const form=section.querySelector('form'),marker=form?.dataset.resumeGthEducationRecordIndex;
  if(forms.length!==1||forms[0]!==form||!(/^(?:[0-9]|[12][0-9]|new)$/u.test(marker||'')))return {ok:false,reason:'education_target_editor_unbound'};if(marker!=='new')count+=1;}
 if(!Number.isInteger(count)||count<0||count>30)return {ok:false,reason:'education_target_count_unsupported'};return {ok:true,count,editorOpen:forms.length===1};
}
export function createGthEducationDraftActions({api=globalThis.chrome,peekTab,onUpdate=()=>{}}={}){
 let source=null,job=null;const remember=value=>{job=value;onUpdate(job);return value;};
 return {
  async prepare(tab){
   if(tab?.url!==GTH_EDUCATION_PAGE){source=null;return remember(null);}
   source=(await api.storage.local.get(`resumeEducationJob:${tab.id}`))[`resumeEducationJob:${tab.id}`]||null;
   const result=await api.runtime.sendMessage({type:'GTH_EDUCATION_DRAFT_JOB_STATUS',tabId:tab.id}),current=result?.ok?result.data:null;
   return remember(current&&(current.requestId===source?.requestId||['queued','running','unknown',...PHASES].includes(current.state))?current:null);
  },
  get source(){return source;},get job(){return job;},get canResume(){return canResumeGthDraft(job,source);},
  run(action){
   const tab=peekTab();if(tab?.url!==GTH_EDUCATION_PAGE||source?.tabId!==tab.id||source.state!=='completed'||source.outcome!=='verified')return Promise.resolve({ok:false,error:'draft_job_source_not_verified'});
   const requestId=source.requestId;
   if(action==='save'&&(job?.state!=='ready'||job.requestId!==requestId||!fingerprint(job.expectedFingerprint)))return Promise.resolve({ok:false,error:'draft_job_preflight_required'});
   if(action==='resume_refresh'&&!canResumeGthDraft(job,source))return Promise.resolve({ok:false,error:'draft_saved_phase_not_verified'});
   if(!['inspect','save','resume_refresh'].includes(action))return Promise.resolve({ok:false,error:'draft_job_invalid'});
   return api.runtime.sendMessage({type:'GTH_EDUCATION_DRAFT_JOB_START',tabId:tab.id,pageUrl:GTH_EDUCATION_PAGE,requestId,action,
    ...(action==='save'?{fingerprint:job.expectedFingerprint,draftSaveAuthorized:true}:action==='resume_refresh'?{phaseProofHash:job.phaseProof.proofHash}:{})});
  },
  async wait(requestId,tabId){
   for(let n=0;n<900;n++){const result=await api.runtime.sendMessage({type:'GTH_EDUCATION_DRAFT_JOB_STATUS',tabId});
    if(result?.ok&&result.data?.requestId===requestId){const current=remember(result.data);if(['ready','completed','unknown','stopped_before_write'].includes(current.state))return current;}
    await new Promise(resolve=>setTimeout(resolve,200));}
   return remember({requestId,state:'unknown',reason:'draft_job_wait_timeout',pendingReviewRequired:true});
  }
 };
}
