import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,REQUEST} from './fixtures/gth-phase-fixture.mjs';

// The former refresh flow reopened a saved record by clicking its edit icon.
// Every outside-state variant now stops for manual activation after the same
// explicitly authorized synthetic Save; it cannot start an automatic readback.
for (const [name, options] of [
  ['attachment text resets on refresh', {}],
  ['attachment text persists on refresh', {persistAttachmentAcrossReload:true}],
  ['non-attachment outside state changes', {outsideChanged:true,permanentOutside:true}],
]) {
 test(name + ': saved record is never automatically reopened', async()=>{
  const f=await fixture({newRecord:true,attachmentTextChanged:true,...options});
  const input={...REQUEST,recordMarker:'new',targetMode:'new',profileBinding:f.binding};
  const inspected=await f.api.inspect(input);
  assert.equal(inspected.ok,true);
  const saved=await f.api.save({...input,expectedFingerprint:inspected.expectedSnapshot.fingerprint,draftSaveAuthorized:true});
  assert.equal(saved.ok,false);
  assert.equal(saved.state,'unknown');
  assert.equal(saved.reason,'entry_activation_manual');
  assert.equal(saved.pendingReviewRequired,true);
  assert.equal(saved.refreshVerified,false);
  assert.equal(saved.phaseProof,undefined);
  assert.equal(f.model.saves,1);
  assert.equal(f.model.edits,0);
  assert.equal(f.model.reloads||0,0);
  assert.ok(f.store.has('resumePendingFillReview:77'));
 });
}
