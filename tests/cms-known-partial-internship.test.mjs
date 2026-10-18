import test from 'node:test';
import assert from 'node:assert/strict';
import {createCmsEducationTaskRunner} from '../src/background/cms-education-task-runner.mjs';
import {FIELDS,PAGE} from '../src/profile/cms-internship-plan.mjs';
const cmsEducationJobKey=tabId=>'resumeCmsInternshipJob:'+tabId;
import {confirmRecordSiteFacts} from '../src/profile/cms-education-site-facts.mjs';
import {captureProfileBinding} from '../src/profile/profile-lifecycle.js';

const epoch='00000000-0000-4000-8000-000000000001',tabId=7,document={href:PAGE+'?synthetic=1',timeOrigin:17,visible:true};
const locks={request:async(_name,_options,work)=>work()};
const fixture=()=>{const experience=Array.from({length:2},(_,i)=>({type:'internship',organization:'Synthetic Company '+i,position:'Synthetic Role '+i,description:'Synthetic Work '+i,startDate:'2020-01-02',endDate:'2020-06-03'}));return {schemaVersion:1,fullName:'Synthetic Customer A',experience,confirmedFields:experience.flatMap((row,index)=>Object.keys(row).map(key=>'experience.'+index+'.'+key))};};
async function harness({timeoutMs=1000,hang=false,mode=null}={}){
  const data={resumeProfile:fixture(),resumeProfileLifecycle:{version:1,epoch,state:'ready'}},clone=value=>value===undefined?undefined:structuredClone(value),stats={run:0,props:0,files:0,plan:null};
  const storage={get:async keys=>keys===null?clone(data):Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(key=>[key,clone(data[key])])),set:async values=>Object.assign(data,clone(values)),remove:async keys=>{for(const key of Array.isArray(keys)?keys:[keys])delete data[key];}};
  let runner,proof;
  const popup={id:'synthetic-extension',url:'chrome-extension://synthetic-extension/src/popup/popup.html'},content={id:popup.id,tab:{id:tabId},frameId:0,url:document.href};
  const invoke=(message,sender=popup)=>new Promise(resolve=>{runner.listener(message,sender,resolve);});
  const api={storage:{local:storage},runtime:{id:popup.id,getURL:path=>'chrome-extension://synthetic-extension/'+path,getManifest:()=>({background:{service_worker:'src/background/worker.mjs'}})},
    windows:{update:async()=>({})},
    tabs:{get:async()=>({id:tabId,url:document.href,windowId:1}),query:async()=>[{id:tabId,url:document.href}],update:async()=>({id:tabId,url:document.href,windowId:1}),sendMessage:async(_tab,message)=>{
      if(message.type==='CMS_INTERNSHIP_MULTI_INSPECT')return {ok:true,data:{document,rows:[{identity:'synthetic-existing-row',fields:[]}]}};
      if(message.type==='CMS_INTERNSHIP_MULTI_STATUS'){if(mode==='document_changed')document.timeOrigin++;return {ok:true,state:mode==='not_settled'?'running':'settled',requestId:message.requestId};}
      if(message.type!=='CMS_INTERNSHIP_MULTI_RUN')throw Error('unexpected_message');stats.run++;stats.plan=message.plan;
      if(hang)return new Promise(()=>{});
      const bindings=message.plan.records.map(record=>({profileIndex:record.profileIndex,identity:record.target.mode==='existing'?record.target.identity:'synthetic-new-row'}));
      const rows=message.plan.records.map((record,recordIndex)=>({identity:bindings[recordIndex].identity,fields:FIELDS.map((field,index)=>({question:field.question,oldItemId:String(index),required:!field.optional,
        serialized:field.key==='region'?'synthetic-region-code':record.facts[field.key].value,display:field.key==='region'?[record.facts[field.key].value.province,record.facts[field.key].value.city]:record.facts[field.key].optionText}))}));
      proof={ok:true,page:PAGE,timeOrigin:17,rows,serialized:{set_49170501:rows.map(row=>Object.fromEntries(row.fields.map(field=>['item_'+field.oldItemId,field.serialized])))}};
      assert.equal((await invoke({type:'CMS_INTERNSHIP_MULTI_SOURCE_CHECK',requestId:message.requestId,profileIndex:message.plan.records[0].profileIndex,sourceSnapshotHash:message.plan.records[0].sourceSnapshotHash},content)).ok,true);
      assert.equal((await invoke({type:'CMS_INTERNSHIP_MULTI_SOURCE_CHECK',requestId:'wrong'},content)).reason,'cms_education_wrong_owner');
      const verified=mode==='missing_main'?{ok:true,complete:true,records:message.plan.records.map((record,index)=>({profileIndex:record.profileIndex,identity:bindings[index].identity,fields:FIELDS.map(field=>({key:field.key,question:field.question,path:record.facts[field.key].path,status:'verified',reason:'synthetic',required:!field.optional}))})),serializedRecordCount:2}:await invoke({type:'CMS_INTERNSHIP_MULTI_VERIFY_PROPS',requestId:message.requestId,bindings},content);assert.equal(verified.complete,true);
      const fields=verified.records.flatMap(record=>record.fields.map(field=>({...field,profileIndex:record.profileIndex})));if(mode){fields[0].status='failed';fields[0].reason='menu_cleanup_failed';}if(mode==='duplicate_field')fields[1]={...fields[0]};if(mode==='duplicate_binding')bindings[1]={...bindings[0]};return {ok:mode!=='response_false',data:{ok:mode!=='result_false',complete:!mode,fields,bindings,serialization:mode==='missing_serialization'?undefined:verified.records,addClicks:1,serializedRecordCount:2,provisionalNewRecords:1,finalSubmitClicks:0,saveClicks:0,deleteClicks:0}};
    }},scripting:{executeScript:async request=>{if(request.files){stats.files++;return [];}if(request.func.name==='readCmsInternshipSerialization'){stats.props++;return [{frameId:0,result:proof}];}return [{frameId:0,result:{...document,hasFocus:true}}];}}};
  runner=createCmsEducationTaskRunner({api,locks,timeoutMs,keepAliveMs:100000,recordKind:'internship'});
  const inspected=await invoke({type:'CMS_INTERNSHIP_MULTI_INSPECT_JOB',tabId});assert.equal(inspected.ok,true);
  const request={type:'CMS_INTERNSHIP_MULTI_START',tabId,pageUrl:PAGE,profileBinding:inspected.profileBinding,document:clone(inspected.document),records:[1,0].map((profileIndex,index)=>({...inspected.sources.find(row=>row.profileIndex===profileIndex),target:index?{mode:'new'}:{mode:'existing',identity:'synthetic-existing-row'},replaceExisting:!index}))};
  const settled=async()=>{for(let i=0;i<100;i++){const job=data[cmsEducationJobKey(tabId)];if(job&&!['queued','running'].includes(job.state))return clone(job);await new Promise(resolve=>setTimeout(resolve,5));}throw Error('fixture_timeout');};
  return {data,storage,stats,invoke,request,settled};
}


test('actual six-key internship plan known failure clears only own pending and permits fresh INSPECT',async()=>{const h=await harness({mode:'partial'});assert.equal((await h.invoke(h.request)).accepted,true);const job=await h.settled();for(let i=0;i<100&&h.data['resumePendingFillReview:'+tabId];i++)await new Promise(r=>setTimeout(r,2));assert.equal(job.state,'partial');assert.equal(job.fields.length,12);assert.equal(job.complete,false);assert.equal(job.fields.filter(f=>f.status==='failed').length,1);assert.equal(h.data['resumePendingFillReview:'+tabId],undefined);assert.equal((await h.invoke({type:'CMS_INTERNSHIP_MULTI_INSPECT_JOB',tabId})).ok,true);assert.equal(h.stats.run,1);});
