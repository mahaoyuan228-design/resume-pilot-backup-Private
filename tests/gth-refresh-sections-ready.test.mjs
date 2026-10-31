import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,REQUEST} from './fixtures/gth-phase-fixture.mjs';

async function inspectedFixture(){
 const f=await fixture({newRecord:true,attachmentTextChanged:true});
 const input={...REQUEST,recordMarker:'new',targetMode:'new',profileBinding:f.binding};
 const inspected=await f.api.inspect(input);
 assert.equal(inspected.ok,true);
 return {f,input:{...input,expectedFingerprint:inspected.expectedSnapshot.fingerprint}};
}

test('readiness never substitutes for explicit Save authorization',async()=>{
 const {f,input}=await inspectedFixture();
 const saved=await f.api.save(input);
 assert.equal(saved.reason,'draft_save_not_authorized');
 assert.equal(saved.saveClickCount,0);
 assert.equal(f.model.saves,0);
 assert.equal(f.model.edits,0);
 assert.equal(f.model.reloads||0,0);
});

test('manual-entry hint cannot produce a verified refresh phase or trigger another fill',async()=>{
 const {f,input}=await inspectedFixture();
 let fills=0,verifies=0;
 const send=f.chrome.tabs.sendMessage;
 f.chrome.tabs.sendMessage=async(tab,message)=>{
  if(message.type==='GTH_EDUCATION_FULL_TRIAL')fills++;
  if(message.type==='GTH_EDUCATION_DRAFT_VERIFY_SAVED')verifies++;
  return send(tab,message);
 };
 const saved=await f.api.save({...input,draftSaveAuthorized:true});
 assert.equal(saved.state,'unknown');
 assert.equal(saved.reason,'entry_activation_manual');
 assert.equal(saved.pendingReviewRequired,true);
 assert.equal(saved.refreshVerified,false);
 assert.equal(saved.phaseProof,undefined);
 assert.equal(f.model.saves,1);
 assert.equal(f.model.edits,0);
 assert.equal(f.model.reloads||0,0);
 assert.equal(fills,0);
 assert.equal(verifies,0);
 assert.ok(f.store.has('resumePendingFillReview:77'));
});

test('retrying a manually pending record cannot save or reopen it again',async()=>{
 const {f,input}=await inspectedFixture();
 const saved=await f.api.save({...input,draftSaveAuthorized:true});
 assert.equal(saved.reason,'entry_activation_manual');
 const retry=await f.api.save({...input,draftSaveAuthorized:true});
 assert.equal(retry.reason,'draft_request_already_reserved');
 assert.equal(retry.pendingReviewRequired,true);
 assert.equal(f.model.saves,1);
 assert.equal(f.model.edits,0);
 assert.equal(f.model.reloads||0,0);
 assert.ok(f.store.has('resumePendingFillReview:77'));
});
