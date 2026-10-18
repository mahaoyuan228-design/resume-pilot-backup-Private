import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixture,REQUEST} from './fixtures/gth-phase-fixture.mjs';

// Load the exact one-file overlay. Only its unchanged relative lifecycle import
// is resolved to the existing canonical dependency for this offline test.
const url=new URL('../src/background/gth-education-refresh-coordinator.mjs',import.meta.url);
const source=await readFile(url,'utf8');
const lifecycle=new URL('../src/profile/profile-lifecycle.js',import.meta.url).href;
const anchor="'../profile/profile-lifecycle.js'";
assert.equal(source.split(anchor).length,2);
const {completeSavedEducationPhase}=await import('data:text/javascript,'+encodeURIComponent(source.replace(anchor,JSON.stringify(lifecycle))));

async function savedFixture(mode){
 const f=await fixture({newRecord:true,attachmentTextChanged:true});
 const input={...REQUEST,recordMarker:'new',targetMode:'new',profileBinding:f.binding};
 const inspected=await f.api.inspect(input);assert.equal(inspected.ok,true);
 const saved=await f.api.save({...input,expectedFingerprint:inspected.expectedSnapshot.fingerprint,draftSaveAuthorized:true});
 assert.equal(saved.state,'server_verified_needs_refresh');assert.equal(f.model.saves,1);
 const lease=f.store.get('resumePendingFillReview:77'),originalQuery=f.context.document.querySelectorAll;
 const execute=f.chrome.scripting.executeScript,send=f.chrome.tabs.sendMessage;
 let readyProbes=0,verifyCalls=0,fillCalls=0,latestReady=false;
 const observations=[];
 f.chrome.scripting.executeScript=async operation=>{
  if(f.model.reloads===1&&operation.func?.name==='readRefreshDocument'){
   readyProbes++;
   f.context.document.querySelectorAll=selector=>{
    if(selector!=='.r-section')return originalQuery(selector);
    const nodes=originalQuery(selector);
    if(mode==='delayed'&&readyProbes<4)return [];
    if(mode==='flicker'&&readyProbes===2)return [];
    if(mode==='wrong')return nodes.map((node,index)=>index!==6?node:{querySelector(){return {cloneNode(){return {textContent:'错误标题',querySelectorAll(){return [];}};}};}});
    return nodes;
   };
  }
  const result=await execute(operation);
  if(operation.func?.name==='readRefreshDocument'&&f.model.reloads===1){latestReady=result[0].result.sectionsReady;observations.push(latestReady);}
  return result;
 };
 f.chrome.tabs.sendMessage=async(tab,message)=>{
  if(message.type==='GTH_EDUCATION_FULL_TRIAL')fillCalls++;
  if(message.type==='GTH_EDUCATION_DRAFT_VERIFY_SAVED'){
   verifyCalls++;assert.equal(latestReady,true);
   assert.deepEqual(observations.slice(-3),[true,true,true]);
   f.context.document.querySelectorAll=originalQuery;
  }
  return send(tab,message);
 };
 const persisted=[];
 const run=()=>completeSavedEducationPhase({api:f.chrome,tabId:77,requestId:REQUEST.requestId,profileBinding:f.binding,
  phaseProof:saved.phaseProof,lease,lifecycleOptions:f.lifecycleOptions,pollMs:1,maxPolls:10,persist:async patch=>persisted.push(patch)});
 return {...f,run,persisted,counts:()=>({readyProbes,verifyCalls,fillCalls,observations})};
}

test('delayed Vue seven-section mount: waits for three stable reads before actual source verify; Save1/reload1',async()=>{
 const f=await savedFixture('delayed'),result=await f.run();
 assert.equal(result.state,'completed');assert.equal(result.refreshVerified,true);
 assert.equal(f.counts().readyProbes,6);assert.equal(f.counts().verifyCalls,1);assert.equal(f.counts().fillCalls,0);
 assert.equal(f.model.saves,1);assert.equal(f.model.reloads,1);
});
test('permanent wrong section title: bounded unknown, no source verify or additional Save/reload/fill',async()=>{
 const f=await savedFixture('wrong');
 await assert.rejects(f.run(),/draft_refresh_sections_not_ready/u);
 assert.equal(f.counts().readyProbes,10);assert.equal(f.counts().verifyCalls,0);assert.equal(f.counts().fillCalls,0);
 assert.equal(f.model.saves,1);assert.equal(f.model.reloads,1);assert.ok(f.store.has('resumePendingFillReview:77'));
 assert.equal(f.persisted.some(patch=>patch.state==='verifying_saved_after_refresh'),false);
});
test('a transient good title sample cannot pass after mount becomes incomplete again',async()=>{
 const f=await savedFixture('flicker'),result=await f.run();
 assert.equal(result.state,'completed');assert.deepEqual(f.counts().observations.slice(0,5),[true,false,true,true,true]);
 assert.equal(f.counts().verifyCalls,1);assert.equal(f.model.saves,1);assert.equal(f.model.reloads,1);
});
