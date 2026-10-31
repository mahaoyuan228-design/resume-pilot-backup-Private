// Prototype only: direct adapters under the caller's single parent lease.
import {educationCandidate,EDUCATION_FIELDS} from './education-task-runner.mjs';
import {readGthDraftMetadata} from './gth-draft-metadata.mjs';
import {completeSavedEducationPhase,validSavedPhase,readRefreshDocument} from './gth-education-refresh-coordinator.mjs';
const PAGE='https://hr.gtht.com/resume/edit/',fail=code=>{throw Error(code);};
export const SERIAL_EDUCATION_REQUIRED=['school','major','schoolLocation','unifiedAdmissions','degree','startDate','endDate','majorCategory'];
const OPTIONAL=new Set(['campusActivities','gradeRank','majorDescription','gpa']);
function validFilledFields(response,profileIndex){
 return response?.ok===true&&response.editorLeftOpen===true&&response.savedOnSite===null&&response.submitted===null
  &&response.softwareClickedSave===false&&response.softwareClickedSubmit===false&&response.softwareClickedDelete===false
  &&Array.isArray(response.fields)&&response.fields.length===12&&EDUCATION_FIELDS.every(([question,key])=>{
   const fields=response.fields.filter(field=>field.question===question&&field.path===`education.${profileIndex}.${key}`);
   return fields.length===1&&(fields[0].status==='verified'
    ?['readback_matched','readback_reapplied','preexisting_same_value'].includes(fields[0].reason)
    :fields[0].status==='skipped'&&(OPTIONAL.has(key)&&['missing_profile_value','profile_fact_unconfirmed'].includes(fields[0].reason)
      ||key==='degree'&&fields[0].reason==='site_control_disabled'&&fields[0].lockedValueState==='same_as_profile'));
  });
}
// The ID is checked in the actual business Vue before opening or marking the
// exact existing record. Only bookkeeping attributes are assigned, no facts.
export function existingEducationControl({action,recordIdentity,expectedRecords,index}){
 const stop=reason=>({ok:false,reason}),visible=node=>!!node?.getClientRects().length&&getComputedStyle(node).visibility!=='hidden';
 try{
  if(location.href!=='https://hr.gtht.com/resume/edit/'||document.readyState!=='complete'||document.visibilityState!=='visible')return stop('serial_education_page_unavailable');
  const sections=[...document.querySelectorAll('.r-section')],section=sections[1],root=section?.parentElement,owners=[];let vue=root?.tagName==='DIV'&&root.classList.contains('r-block')?root.__vue__:null;
  for(let i=0;vue&&i<8;i++,vue=vue.$parent){const item=vue.curItem||vue.$props?.curItem;if(item?.name==='教育经历'&&Array.isArray(item.data)&&['read','edit'].includes(vue.mode))owners.push({vue,item});}
  if(owners.length!==1)return stop('serial_education_owner_unknown');const {vue:owner,item}=owners[0],records=item.data.map((row,index)=>({index,recordIdentity:JSON.stringify([String(item.id),String(row.id)]),formDataURL:new URL(row.editUrl,location.href).href}));
  const projection=rows=>rows.map(row=>[row.index,row.recordIdentity,row.formDataURL]);
  if(JSON.stringify(projection(records))!==JSON.stringify(projection(expectedRecords))||records[index]?.recordIdentity!==recordIdentity)return stop('serial_education_target_changed');
  const all=sections.flatMap(section=>[...section.querySelectorAll('form')]);
  if(action==='open')return {ok:false,status:'manual',reason:'manual_open_editor_required',clicked:false};
  const form=section.querySelector('form'),expectedID=JSON.parse(recordIdentity)[1];
  if(action!=='mark'||all.length!==1||all[0]!==form||owner.mode!=='edit'||owner.isEditFlag!==true||String(owner.expandFormId)!==expectedID)return stop('serial_education_target_not_loaded');
  const formOwners=[];vue=form.__vue__;for(let i=0;vue&&i<8;i++,vue=vue.$parent){const data=vue.$data||vue;if(data.tableName==='resume_education'&&data.isEduInfoSection===true)formOwners.push(vue);}
  if(formOwners.length!==1||new URL(formOwners[0].$props?.formdataurl??formOwners[0].formdataurl,location.href).href!==records[index].formDataURL||form.querySelectorAll('.el-form-item').length!==11)return stop('serial_education_target_not_loaded');
  form.dataset.resumeGthEducationRecordIndex=String(index);form.dataset.resumeGthEducationRecordCount=String(records.length);return {ok:true};
 }catch{return stop('serial_education_owner_unknown');}
}
export function createSerialEducationExecutor({api,dispatch,guard,bounded,lifecycleOptions={}}){
 const script=async(tabId,func,args,world='ISOLATED')=>{const rows=await dispatch(()=>api.scripting.executeScript({target:{tabId,frameIds:[0]},world,func,...(args===undefined?{}:{args:[args]})}));if(rows.length!==1||rows[0].frameId!==0)fail('serial_frame_changed');return rows[0].result;};
 const send=(tabId,message)=>dispatch(()=>api.tabs.sendMessage(tabId,message));
 return async(step,{tabId,parentRequestId,stepRequestId,profile,profileBinding,lease,persist})=>{
  const document=await script(tabId,readRefreshDocument);if(document?.pageURL!==PAGE||!document.ready||!document.visible)fail('serial_document_unavailable');
  const metadata=await script(tabId,readGthDraftMetadata,{requestId:stepRequestId,recordMarker:'new',phase:'closed',nonce:crypto.randomUUID(),documentTimeOrigin:document.timeOrigin},'MAIN');
  if(metadata?.ok!==true||metadata.data.formCount!==0)fail(metadata?.reason||'serial_closed_metadata_unknown');const records=metadata.data.records;
  let rowIndex=null;
  if(step.targetMode==='existing'){
   const matches=records.filter(row=>row.recordIdentity===step.recordIdentity);if(matches.length!==1)fail('serial_existing_identity_missing');rowIndex=matches[0].index;
   const args={recordIdentity:step.recordIdentity,expectedRecords:records,index:rowIndex};
   const opened=await script(tabId,existingEducationControl,{...args,action:'open'},'MAIN');if(opened?.ok!==true)fail(opened?.reason||'serial_existing_open_unknown');
   let marked=false;for(let i=0;i<60;i++){await new Promise(resolve=>setTimeout(resolve,100));const result=await script(tabId,existingEducationControl,{...args,action:'mark'},'MAIN');if(result?.ok){marked=true;break;}if(result?.reason!=='serial_education_target_not_loaded')fail(result?.reason||'serial_existing_mark_unknown');}if(!marked)fail('serial_existing_editor_timeout');
  }
  await dispatch(()=>api.scripting.executeScript({target:{tabId,frameIds:[0]},files:['src/content/gth-education.js']}));
  const candidate=educationCandidate(profile,step.profileIndex),recordMarker=step.targetMode==='new'?'new':String(rowIndex);
  const filled=await send(tabId,{type:'GTH_EDUCATION_FULL_TRIAL',requestId:stepRequestId,targetMode:step.targetMode,rowIndex,profileIndex:step.profileIndex,replaceExisting:step.replaceExisting,educationCandidates:[candidate],profileBinding});
  const reportedFields=Array.isArray(filled?.fields)?filled.fields.flatMap(field=>EDUCATION_FIELDS.some(([question,key])=>field.question===question&&field.path===`education.${step.profileIndex}.${key}`)&&['verified','skipped','failed'].includes(field.status)
   ?[{question:field.question,path:field.path,status:field.status,reason:/^[a-z_]{2,80}$/u.test(field.reason||'')?field.reason:'serial_field_reason_unknown'}]:[]):[];
  await persist({fields:reportedFields,verifiedFields:reportedFields.filter(field=>field.status==='verified').length,skippedFields:reportedFields.filter(field=>field.status==='skipped').length,siteReadOnlyFields:reportedFields.filter(field=>field.reason==='site_control_disabled').length,sourceWriteStarted:filled?.writeStarted===true});
  if(!validFilledFields(filled,step.profileIndex))fail(filled?.reason||'serial_education_fill_incomplete');
  const status=await send(tabId,{type:'GTH_EDUCATION_FULL_TRIAL_STATUS',requestId:stepRequestId,profileBinding});if(status?.ok!==true||status.data?.state!=='settled'||status.data.outcome!=='verified')fail('serial_source_status_unknown');
  await dispatch(()=>api.scripting.executeScript({target:{tabId,frameIds:[0]},files:['src/content/gth-draft-save.js']}));
  const input={requestId:stepRequestId,recordMarker,targetMode:step.targetMode,profileBinding},inspected=await send(tabId,{type:'GTH_EDUCATION_DRAFT_INSPECT',...input});
  if(inspected?.ok!==true||inspected.readyToSave!==true||step.targetMode==='existing'&&inspected.expectedSnapshot?.recordIdentity!==step.recordIdentity||step.targetMode==='new'&&inspected.expectedSnapshot?.recordIdentity!==null||!/^[a-f0-9]{64}$/u.test(inspected.expectedSnapshot?.fingerprint||''))fail(inspected?.reason||'serial_inspect_unknown');
  if(filled.fields.some(field=>field.path===`education.${step.profileIndex}.degree`&&field.reason==='site_control_disabled')){
   const norm=value=>String(value??'').replace(/[\s\u00a0]+/gu,' ').trim();
   if(inspected.expectedSnapshot.degreeSiteReadOnly!==true||norm(inspected.expectedSnapshot.values?.degree)!==norm(candidate.degree))fail('locked_degree_conflict');
  }
  // Persist only the fingerprint, never the inspected applicant values.
  await persist({phase:'inspected',expectedFingerprint:inspected.expectedSnapshot.fingerprint});
  await persist({saveAttempted:true,saveClickCount:null,softwareClickedSave:null});
  const saved=await send(tabId,{type:'GTH_EDUCATION_DRAFT_SAVE',...input,expectedFingerprint:inspected.expectedSnapshot.fingerprint,draftSaveAuthorized:true,lockOwnerRequestId:parentRequestId});
  await persist({saveClickCount:[0,1].includes(saved?.saveClickCount)?saved.saveClickCount:null,softwareClickedSave:typeof saved?.softwareClickedSave==='boolean'?saved.softwareClickedSave:null});
  if(saved?.ok!==true||saved.state!=='server_verified_needs_refresh'||saved.saveClickCount!==1||saved.serverReadbackMatched!==true||saved.serverReadbackFields!==12||!await validSavedPhase(saved.phaseProof,{requestId:stepRequestId,profileBinding})||saved.phaseProof.lockOwnerRequestId!==parentRequestId)fail(saved?.reason||'serial_save_unknown');
  if(step.targetMode==='existing'&&saved.phaseProof.savedRecordIdentity!==step.recordIdentity)fail('serial_saved_target_changed');
  await persist({phase:'server_verified_needs_refresh',expectedFingerprint:undefined,phaseProof:saved.phaseProof,saveClickCount:1});
  const verified=await completeSavedEducationPhase({api,tabId,requestId:stepRequestId,profileBinding,phaseProof:saved.phaseProof,lease,lifecycleOptions,bounded,guard,
   persist:patch=>persist({phase:patch.state,phaseProof:patch.phaseProof,reloadIntent:patch.reloadIntent,refreshVerified:patch.refreshVerified})});
  if(verified.state!=='completed'||verified.refreshVerified!==true)fail('serial_refresh_unknown');
  return {state:'completed',profileIndex:step.profileIndex,targetMode:step.targetMode,recordIdentity:saved.phaseProof.savedRecordIdentity,fields:reportedFields,verifiedFields:reportedFields.filter(field=>field.status==='verified').length,skippedFields:reportedFields.filter(field=>field.status==='skipped').length,siteReadOnlyFields:reportedFields.filter(field=>field.reason==='site_control_disabled').length,saveAttempted:true,softwareClickedSave:true,saveClickCount:1,refreshVerified:true,serverReadbackFields:12,newRecordCreated:step.targetMode==='new',phaseProofHash:saved.phaseProof.proofHash};
 };
}
