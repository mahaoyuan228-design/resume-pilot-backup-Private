// One page's transient File/candidate selection belongs to one profile.
// No facts or file bytes are persisted by this controller.
import {captureProfileBinding,assertProfileBinding,canonicalProfileHash,withProfileBinding,dispatchBoundSource} from '../profile/profile-lifecycle.js';
export function createSelectionOwner({storage=chrome.storage.local,onInvalidate=()=>{},lifecycleOptions={}}={}){
  let revision=0,binding=null,committing=0;
  const fail=()=>{throw Error('profile_selection_changed');};
  const invalidate=()=>{revision++;binding=null;onInvalidate();};
  const valid=token=>token?.revision===revision&&binding;
  const assert=async token=>{if(!valid(token))fail();try{await assertProfileBinding(storage,binding,lifecycleOptions);}catch(error){invalidate();throw error;}if(!valid(token))fail();return binding;};
  const ensure=async()=>{if(binding){const token={revision};try{await assert(token);return token;}catch{}}
    const at=revision,next=await captureProfileBinding(storage,lifecycleOptions);if(at!==revision)fail();binding=next;return {revision};};
  const replace=async()=>{invalidate();return ensure();};
  const changed=async()=>{if(committing||!binding)return;try{await assert({revision});}catch{/* invalidate already removed transient values. */}};
  const run=async(token,work)=>{
    const before=await assert(token);let expectedHash=before.profileHash;committing++;
    try{return await withProfileBinding(storage,before,async()=>{
      await assert(token);const result=await work({binding:before,assert:()=>assert(token),
        ownProfile:async profile=>{expectedHash=await canonicalProfileHash(profile,lifecycleOptions.cryptoImpl);return profile;}});
      const after=await captureProfileBinding(storage,lifecycleOptions);
      if(!valid(token)||after.epoch!==before.epoch||after.profileHash!==expectedHash)fail();binding=after;return result;
    },lifecycleOptions);}finally{committing--;await changed();}
  };
  const parse=async(token,file,extract)=>{await assert(token);const result=await extract(file);await assert(token);return result;};
  const dispatch=async(token,send)=>{const current=await assert(token);return dispatchBoundSource(storage,current,send,lifecycleOptions);};
  return {ensure,replace,assert,run,parse,dispatch,invalidate,changed};
}
