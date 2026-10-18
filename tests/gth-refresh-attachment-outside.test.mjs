import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,REQUEST} from './fixtures/gth-phase-fixture.mjs';
import {completeSavedEducationPhase} from '../src/background/gth-education-refresh-coordinator.mjs';

async function runThroughRefresh(options){
  const f=await fixture({newRecord:true,attachmentTextChanged:true,...options});
  const input={...REQUEST,recordMarker:'new',targetMode:'new',profileBinding:f.binding};
  const inspected=await f.api.inspect(input);
  assert.equal(inspected.ok,true);
  const saved=await f.api.save({...input,expectedFingerprint:inspected.expectedSnapshot.fingerprint,draftSaveAuthorized:true});
  assert.equal(saved.state,'server_verified_needs_refresh');
  assert.equal(saved.phaseProof.onlyAttachmentTextChanged,true);
  assert.equal(saved.phaseProof.refreshSafe,true);
  assert.equal(saved.phaseProof.originalOutsidePreserved,false);
  const lease=f.store.get('resumePendingFillReview:77');
  const result=await completeSavedEducationPhase({
    api:f.chrome,tabId:77,requestId:REQUEST.requestId,profileBinding:f.binding,
    phaseProof:saved.phaseProof,lease,lifecycleOptions:f.lifecycleOptions,pollMs:1,maxPolls:20,
    persist:async()=>{}
  });
  return {f,saved,result};
}

test('attachment text-only drift that resets on reload still completes (legacy fixture default)',async()=>{
  const {result,f}=await runThroughRefresh({});
  assert.equal(result.state,'completed');
  assert.equal(result.refreshVerified,true);
  assert.equal(f.model.saves,1);
  assert.equal(f.model.reloads,1);
});

test('attachment text-only drift that persists across reload completes with eligible post-save outside hash',async()=>{
  // Models real hr.gtht.com: attachment display name often changes after education Save and survives page reload.
  // Historical fail: draft_refresh_original_outside_mismatch compared only originalOutsideHash → serial step 2 never ran.
  const {result,saved,f}=await runThroughRefresh({persistAttachmentAcrossReload:true});
  assert.equal(result.state,'completed');
  assert.equal(result.refreshVerified,true);
  assert.equal(result.originalOutsidePreservedDuringSave,false);
  assert.notEqual(saved.phaseProof.originalOutsideHash,saved.phaseProof.postSaveOutsideHash);
  assert.equal(f.model.saves,1);
  assert.equal(f.model.reloads,1);
  assert.equal(f.model.edits>=1,true);
});

test('non-attachment outside drift remains ineligible / fails verify when forced permanent',async()=>{
  const f=await fixture({newRecord:true,outsideChanged:true,permanentOutside:true});
  const input={...REQUEST,recordMarker:'new',targetMode:'new',profileBinding:f.binding};
  const inspected=await f.api.inspect(input);
  assert.equal(inspected.ok,true);
  const saved=await f.api.save({...input,expectedFingerprint:inspected.expectedSnapshot.fingerprint,draftSaveAuthorized:true});
  assert.equal(saved.state,'server_verified_needs_refresh');
  assert.equal(saved.phaseProof.refreshSafe,false);
  assert.equal(saved.phaseProof.onlyAttachmentTextChanged,false);
  const lease=f.store.get('resumePendingFillReview:77');
  await assert.rejects(
    ()=>completeSavedEducationPhase({
      api:f.chrome,tabId:77,requestId:REQUEST.requestId,profileBinding:f.binding,
      phaseProof:saved.phaseProof,lease,lifecycleOptions:f.lifecycleOptions,pollMs:1,maxPolls:20,
      persist:async()=>{}
    }),
    /draft_refresh_outside_change_not_eligible/u
  );
  assert.equal(f.model.reloads||0,0);
});
