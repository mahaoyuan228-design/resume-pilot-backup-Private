import test from 'node:test';
import assert from 'node:assert/strict';
import {createCmsEducationTaskRunner,cmsEducationJobKey} from '../src/background/cms-education-task-runner.mjs';
import {FIELDS,PAGE} from '../src/profile/cms-education-plan.mjs';
import {confirmRecordSiteFacts} from '../src/profile/cms-education-site-facts.mjs';
import {captureProfileBinding} from '../src/profile/profile-lifecycle.js';

const epoch='00000000-0000-4000-8000-000000000001',tabId=7,document={href:PAGE+'?synthetic=1',timeOrigin:17,visible:true};
const locks={request:async(_name,_options,work)=>work()};
const fixture=()=>{const education=Array.from({length:2},(_,index)=>({school:`Private Synthetic School ${index}`,degree:index?'硕士研究生':'本科',major:`Private Synthetic Major ${index}`,startDate:`${2015+index*4}-09`,endDate:`${2019+index*4}-06`,gradeRank:'无统计',majorDescription:`Private Synthetic Description ${index}`}));
  return {schemaVersion:1,fullName:'Private Synthetic Customer A',education,confirmedFields:education.flatMap((row,index)=>Object.keys(row).map(key=>`education.${index}.${key}`))};};
async function harness({timeoutMs=1000,hang=false,mode=null}={}){
  const data={resumeProfile:fixture(),resumeProfileLifecycle:{version:1,epoch,state:'ready'}},clone=value=>value===undefined?undefined:structuredClone(value),stats={run:0,props:0,files:0,plan:null};
  const storage={get:async keys=>keys===null?clone(data):Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(key=>[key,clone(data[key])])),set:async values=>Object.assign(data,clone(values)),remove:async keys=>{for(const key of Array.isArray(keys)?keys:[keys])delete data[key];}};
  const binding=await captureProfileBinding(storage);let facts=null;
  for(let index=0;index<2;index++)facts=(await confirmRecordSiteFacts(data.resumeProfile,binding,index,{academicDegree:index?'硕士':'学士',region:{province:'Synthetic Province',city:'Synthetic City'},startDate:`${2015+index*4}-09-18`,endDate:`${2019+index*4}-06-28`},facts,{checked:true})).store;
  data.resumeEducationSiteFacts=facts;let runner,proof;
  const popup={id:'synthetic-extension',url:'chrome-extension://synthetic-extension/src/popup/popup.html'},content={id:popup.id,tab:{id:tabId},frameId:0,url:document.href};
  const invoke=(message,sender=popup)=>new Promise(resolve=>{runner.listener(message,sender,resolve);});
  const api={storage:{local:storage},runtime:{id:popup.id,getURL:path=>'chrome-extension://synthetic-extension/'+path,getManifest:()=>({background:{service_worker:'src/background/worker.mjs'}})},
    windows:{update:async()=>({})},
    tabs:{get:async()=>({id:tabId,url:document.href,windowId:1}),query:async()=>[{id:tabId,url:document.href}],update:async()=>({id:tabId,url:document.href,windowId:1}),sendMessage:async(_tab,message)=>{
      if(message.type==='CMS_EDUCATION_MULTI_INSPECT')return {ok:true,data:{document,rows:[{identity:'synthetic-existing-row',fields:[]}]}};
      if(message.type==='CMS_EDUCATION_MULTI_STATUS'){if(mode==='document_changed')document.timeOrigin++;return {ok:true,state:mode==='not_settled'?'running':'settled',requestId:message.requestId};}
      if(message.type!=='CMS_EDUCATION_MULTI_RUN')throw Error('unexpected_message');stats.run++;stats.plan=message.plan;
      if(hang)return new Promise(()=>{});
      const bindings=message.plan.records.map(record=>({profileIndex:record.profileIndex,identity:record.target.mode==='existing'?record.target.identity:'synthetic-new-row'}));
      const rows=message.plan.records.map((record,recordIndex)=>({identity:bindings[recordIndex].identity,fields:FIELDS.map((field,index)=>({question:field.question,oldItemId:String(index),required:!field.optional,
        serialized:field.key==='region'?'synthetic-region-code':record.facts[field.key].value,display:field.key==='region'?[record.facts[field.key].value.province,record.facts[field.key].value.city]:record.facts[field.key].optionText}))}));
      proof={ok:true,page:PAGE,timeOrigin:17,rows,serialized:{set_14:rows.map(row=>Object.fromEntries(row.fields.map(field=>['item_'+field.oldItemId,field.serialized])))}};
      assert.equal((await invoke({type:'CMS_EDUCATION_MULTI_SOURCE_CHECK',requestId:message.requestId,profileIndex:message.plan.records[0].profileIndex,sourceSnapshotHash:message.plan.records[0].sourceSnapshotHash},content)).ok,true);
      assert.equal((await invoke({type:'CMS_EDUCATION_MULTI_SOURCE_CHECK',requestId:'wrong'},content)).reason,'cms_education_wrong_owner');
      const verified=mode==='missing_main'?{ok:true,complete:true,records:message.plan.records.map((record,index)=>({profileIndex:record.profileIndex,identity:bindings[index].identity,fields:FIELDS.map(field=>({key:field.key,question:field.question,path:record.facts[field.key].path,status:'verified',reason:'synthetic',required:!field.optional}))})),serializedRecordCount:2}:await invoke({type:'CMS_EDUCATION_MULTI_VERIFY_PROPS',requestId:message.requestId,bindings},content);assert.equal(verified.complete,true);
      const fields=verified.records.flatMap(record=>record.fields.map(field=>({...field,profileIndex:record.profileIndex})));if(mode){fields[0].status='failed';fields[0].reason='menu_cleanup_failed';}if(mode==='duplicate_field')fields[1]={...fields[0]};if(mode==='duplicate_binding')bindings[1]={...bindings[0]};return {ok:mode!=='response_false',data:{ok:mode!=='result_false',complete:!mode,fields,bindings,serialization:mode==='missing_serialization'?undefined:verified.records,addClicks:1,serializedRecordCount:2,provisionalNewRecords:1,finalSubmitClicks:0,saveClicks:0,deleteClicks:0}};
    }},scripting:{executeScript:async request=>{if(request.files){stats.files++;return [];}if(request.func.name==='readCmsEducationSerialization'){stats.props++;return [{frameId:0,result:proof}];}return [{frameId:0,result:{...document,hasFocus:true}}];}}};
  runner=createCmsEducationTaskRunner({api,locks,timeoutMs,keepAliveMs:100000});
  const inspected=await invoke({type:'CMS_EDUCATION_MULTI_INSPECT_JOB',tabId});assert.equal(inspected.ok,true);
  const request={type:'CMS_EDUCATION_MULTI_START',tabId,pageUrl:PAGE,profileBinding:inspected.profileBinding,document:clone(inspected.document),records:[1,0].map((profileIndex,index)=>({...inspected.sources.find(row=>row.profileIndex===profileIndex),target:index?{mode:'new'}:{mode:'existing',identity:'synthetic-existing-row'},replaceExisting:!index}))};
  const settled=async()=>{for(let i=0;i<100;i++){const job=data[cmsEducationJobKey(tabId)];if(job&&!['queued','running'].includes(job.state))return clone(job);await new Promise(resolve=>setTimeout(resolve,5));}throw Error('fixture_timeout');};
  return {data,storage,stats,invoke,request,settled};
}

test('ordinary popup dispatch persists two explicit source bindings and verifies React DTO without saving private values',async()=>{
  const h=await harness(),accepted=await h.invoke(h.request);assert.equal(accepted.accepted,true);const job=await h.settled();
  assert.equal(job.state,'completed');assert.equal(job.serializedRecordCount,2);assert.equal(job.addClicks,1);assert.equal(job.websiteSaved,false);assert.equal(h.stats.props,1);
  assert.deepEqual(job.records.map(row=>row.profileIndex),[1,0]);assert.equal(h.data['resumePendingFillReview:'+tabId],undefined);
  assert.equal(/Private Synthetic|Synthetic Province|Synthetic City/u.test(JSON.stringify(job)),false);assert.ok(h.stats.plan.records[0].facts.school.value.includes('Private Synthetic School 1'));
});
test('an inspected customer cannot start after a direct profile replacement with identical education',async()=>{
  const h=await harness();h.data.resumeProfile.fullName='Private Synthetic Customer B';const rejected=await h.invoke(h.request);
  assert.equal(rejected.ok,false);assert.equal(rejected.reason,'profile_binding_changed');assert.equal(h.stats.run,0);assert.equal(h.data[cmsEducationJobKey(tabId)],undefined);assert.equal(h.data['resumePendingFillReview:'+tabId],undefined);
});
test('a timeout retains unknown pending and another customer sees no prior source or result facts',async()=>{
  const h=await harness({timeoutMs:30,hang:true});assert.equal((await h.invoke(h.request)).accepted,true);const job=await h.settled();
  assert.equal(job.state,'unknown');assert.equal(job.reason,'cms_education_job_timeout');assert.ok(h.data['resumePendingFillReview:'+tabId]);
  h.data.resumeProfile.fullName='Private Synthetic Customer B';const status=await h.invoke({type:'CMS_EDUCATION_MULTI_JOB_STATUS',tabId});
  assert.equal(status.data.state,'unknown_profile_invalidated');assert.deepEqual(status.data.fields,[]);assert.equal(status.data.records,undefined);assert.equal(/Private Synthetic/u.test(JSON.stringify(status)),false);
});

test('known incomplete result commits partial, retains failures/Add identity and permits fresh ordinary INSPECT',async()=>{const h=await harness({mode:'partial'});assert.equal((await h.invoke(h.request)).accepted,true);const job=await h.settled();for(let i=0;i<100&&h.data['resumePendingFillReview:'+tabId];i++)await new Promise(r=>setTimeout(r,2));assert.equal(job.state,'partial');assert.equal(job.complete,false);assert.equal(job.reason,'cms_education_requires_review');assert.equal(job.fields.filter(f=>f.status==='failed').length,1);assert.equal(job.addClicks,1);assert.equal(job.bindings.length,2);assert.equal(h.data['resumePendingFillReview:'+tabId],undefined);assert.equal((await h.invoke({type:'CMS_EDUCATION_MULTI_INSPECT_JOB',tabId})).ok,true);assert.equal(h.stats.run,1);});

test('unverified outcome never becomes known partial or clears pending',async()=>{for(const mode of ['missing_main','response_false','result_false','not_settled','duplicate_field','duplicate_binding','missing_serialization','document_changed']){const previous=document.timeOrigin;const h=await harness({mode});assert.equal((await h.invoke(h.request)).accepted,true);const job=await h.settled();assert.equal(job.state,'unknown',mode);assert.ok(h.data['resumePendingFillReview:'+tabId],mode);document.timeOrigin=previous;}});

