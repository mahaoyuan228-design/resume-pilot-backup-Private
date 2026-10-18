// Candidate-only coordinator. No nested worker/lease and never dispatches Save.
import {assertProfileBinding,dispatchBoundSource,canonicalProfileHash} from '../profile/profile-lifecycle.js';
const PAGE='https://hr.gtht.com/resume/edit/',ORIGIN='https://hr.gtht.com';
const stable=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const fail=reason=>{throw Error(reason);},hash=value=>/^[a-f0-9]{64}$/u.test(value||'');
export async function validSavedPhase(proof,{requestId,profileBinding}){
 if(!proof||proof.version!==1||proof.requestId!==requestId||proof.pageURL!==PAGE||!['new','existing'].includes(proof.targetMode)
   ||(proof.targetMode==='new'?proof.recordMarker!=='new':typeof proof.recordMarker!=='string'||!/^(?:[0-9]|[12][0-9])$/u.test(proof.recordMarker))||stable(proof.profileBinding)!==stable(profileBinding)
   ||typeof proof.savedRecordIdentity!=='string'||!proof.savedRecordIdentity||proof.savedRecordIdentity.length>500||!Array.isArray(proof.recordIdentities)
   ||proof.recordIdentities.some(id=>typeof id!=='string'||!id||id.length>500)||new Set(proof.recordIdentities).size!==proof.recordIdentities.length
   ||!proof.recordIdentities.includes(proof.savedRecordIdentity)||!Number.isInteger(proof.recordCountBefore)||proof.recordCountBefore<0||proof.recordCountBefore>30
   ||proof.recordCountAfter!==proof.recordCountBefore+(proof.targetMode==='new'?1:0)||proof.recordCountAfter!==proof.recordIdentities.length||proof.recordCountAfter>30
   ||!Number.isFinite(proof.documentTimeOrigin)||typeof proof.lockOwnerRequestId!=='string'||proof.matchingAtoms!==12||proof.saveClickCount!==1
   ||!['savedReadURLHash','targetValuesHash','neighborHash','originalOutsideHash','postSaveOutsideHash','closedBeforeRefreshHash','proofHash'].every(key=>hash(proof[key])))return false;
 return await canonicalProfileHash({...proof,proofHash:undefined})===proof.proofHash;
}
export function readRefreshDocument(){
 const expected=['基本信息','教育经历','求职意向','工作经验','职业技能与特长','附件简历','其他信息'];
 const sectionTitles=[...document.querySelectorAll('.r-section')].map(section=>{
  const heading=section.querySelector('.title_')?.cloneNode(true);
  heading?.querySelectorAll('a,button').forEach(node=>node.remove());
  return String(heading?.textContent??'').replace(/[\s\u00a0]+/gu,' ').trim();
 });
 return {pageURL:location.href,timeOrigin:performance.timeOrigin,ready:document.readyState==='complete',visible:document.visibilityState==='visible',
  sectionTitles,sectionsReady:sectionTitles.length===expected.length&&sectionTitles.every((title,index)=>title===expected[index])};
}
export async function completeSavedEducationPhase({api,tabId,requestId,profileBinding,phaseProof,lease,reloadIntent=null,
 persist,guard=async()=>{},bounded=operation=>operation(),lifecycleOptions={},pollMs=100,maxPolls=250}){
 if(!await validSavedPhase(phaseProof,{requestId,profileBinding})||phaseProof.lockOwnerRequestId!==lease?.requestId)fail('draft_saved_phase_not_verified');
 const pendingKey=`resumePendingFillReview:${tabId}`;
 const check=async()=>{await guard();await assertProfileBinding(api.storage.local,profileBinding,lifecycleOptions);
  const tab=await api.tabs.get(tabId),active=await api.tabs.query({active:true,lastFocusedWindow:true}),pending=(await api.storage.local.get(pendingKey))[pendingKey];
  if(tab?.url!==PAGE||active.length!==1||active[0].id!==tabId||active[0].url!==PAGE)fail('draft_job_tab_changed');
  if(lease.tabId!==tabId||lease.origin!==ORIGIN||stable(pending)!==stable(lease))fail('draft_pending_lock_changed');};
 const dispatch=async operation=>{await check();return bounded(()=>dispatchBoundSource(api.storage.local,profileBinding,operation,lifecycleOptions));};
 const source=type=>dispatch(()=>api.tabs.sendMessage(tabId,{type,requestId,recordMarker:phaseProof.recordMarker,targetMode:phaseProof.targetMode,
  phaseProof,profileBinding,reloadIntent,lockOwnerRequestId:lease.requestId}));
 const probe=async()=>{const rows=await dispatch(()=>api.scripting.executeScript({target:{tabId,frameIds:[0]},func:readRefreshDocument}));
  if(rows.length!==1||rows[0].frameId!==0||rows[0].result?.pageURL!==PAGE)fail('draft_refresh_document_unavailable');return rows[0].result;};
 await check();let document=await probe();
 if(!reloadIntent){
  if(document.timeOrigin!==phaseProof.documentTimeOrigin)fail('draft_refresh_without_reload_intent');
  const preparation=await source('GTH_EDUCATION_DRAFT_PREPARE_REFRESH');
  if(preparation?.ok!==true||preparation.readyToReload!==true||preparation.phaseProofHash!==phaseProof.proofHash||preparation.documentTimeOrigin!==phaseProof.documentTimeOrigin||preparation.formsClosed!==true)fail(preparation?.reason||'draft_refresh_preflight_failed');
  reloadIntent=preparation.reloadIntent;
  if(reloadIntent?.version!==1||reloadIntent.requestId!==requestId||reloadIntent.phaseProofHash!==phaseProof.proofHash||reloadIntent.fromTimeOrigin!==document.timeOrigin||!/^[a-f0-9-]{36}$/iu.test(reloadIntent.nonce||''))fail('draft_refresh_reload_intent_not_verified');
  await persist({state:'refreshing_saved_record',targetSaved:true,phaseProof,reloadIntent,refreshVerified:false,pendingReviewRequired:true});
  await dispatch(()=>api.tabs.reload(tabId,{bypassCache:true}));
 }else if(reloadIntent.version!==1||reloadIntent.requestId!==requestId||reloadIntent.phaseProofHash!==phaseProof.proofHash||reloadIntent.fromTimeOrigin!==phaseProof.documentTimeOrigin)fail('draft_refresh_reload_intent_changed');
 let fresh=null,sawFreshReadyDocument=false,stableReadiness=null,stableReadinessCount=0;
 for(let index=0;index<maxPolls;index++){
  try{document=await probe();}catch(error){
   // MV3 can remove frame 0 between tabs.reload and this read-only probe.
   // Retry only this observed navigation transition under the same owned
   // reload intent. A retry never sends Save, reload, or a DOM write.
   if(error?.message!=='Frame with ID 0 was removed.')throw error;
   stableReadiness=null;stableReadinessCount=0;
   await check();await new Promise(resolve=>setTimeout(resolve,pollMs));continue;
  }
  if(document.timeOrigin!==phaseProof.documentTimeOrigin&&document.ready&&document.visible){
   sawFreshReadyDocument=true;
   if(document.sectionsReady===true){
    const readiness=stable([document.timeOrigin,document.sectionTitles]);
    if(readiness===stableReadiness)stableReadinessCount++;else{stableReadiness=readiness;stableReadinessCount=1;}
    if(stableReadinessCount>=3){fresh=document;break;}
   }else{stableReadiness=null;stableReadinessCount=0;}
  }else{stableReadiness=null;stableReadinessCount=0;}
  await new Promise(resolve=>setTimeout(resolve,pollMs));
 }
 if(!fresh)fail(sawFreshReadyDocument?'draft_refresh_sections_not_ready':'draft_refresh_new_document_unavailable');
 await persist({state:'verifying_saved_after_refresh',targetSaved:true,phaseProof,reloadIntent,refreshDocumentTimeOrigin:fresh.timeOrigin,refreshVerified:false,pendingReviewRequired:true});
 // Only the reader/saver module is injected. Education's fill API is never
 // injected or called after reload, so source facts cannot be re-filled here.
 await dispatch(()=>api.scripting.executeScript({target:{tabId,frameIds:[0]},files:['src/content/gth-draft-save.js']}));
 const result=await source('GTH_EDUCATION_DRAFT_VERIFY_SAVED'),status=await source('GTH_EDUCATION_DRAFT_STATUS'),receipt=status?.data;
 await check();
 if(result?.ok!==true||result.state!=='completed'||result.refreshVerified!==true||result.serverReadbackMatched!==true||result.serverReadbackFields!==12
   ||result.currentOutsideMatchesOriginal!==true||result.otherRecordPreserved!==true||result.readbackEditorClosed!==true
   ||receipt?.requestId!==requestId||receipt.state!=='completed'||receipt.refreshVerified!==true||receipt.saveClickCount!==1
   ||receipt.phaseProof?.proofHash!==phaseProof.proofHash||receipt.pendingReviewRequired!==false)fail(result?.reason||'draft_refresh_server_readback_not_verified');
 return {ok:true,state:'completed',complete:true,targetSaved:true,phaseProof,reloadIntent,refreshVerified:true,refreshDocumentTimeOrigin:fresh.timeOrigin,
  saveClickCount:1,serverReadbackMatched:true,serverReadbackFields:12,otherSectionsPreserved:true,
  originalOutsidePreservedDuringSave:phaseProof.originalOutsidePreserved,currentOutsideMatchesOriginal:true,otherRecordPreserved:true,
  readbackEditorClosed:true,pendingReviewRequired:false,networkStatus:null,softwareClickedSubmit:false};
}
