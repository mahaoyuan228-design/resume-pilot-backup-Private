// In-memory fake storage/tab metadata only; no actual Chrome API or profile.
import test from 'node:test';
import assert from 'node:assert/strict';
import {captureProfileBinding,installProfileBindingBridge} from '../src/profile/profile-lifecycle.js';
const PAGE='https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';
const ID='synthetic-internal-runtime',QUESTION='期望工作性质';
async function bridgeFixture(){
  const state={resumeProfile:{schemaVersion:1,customFacts:[{question:QUESTION,answer:'全职',sitePageUrl:PAGE,sectionName:'求职意向必填',rowContext:'single'}],
    customAnswers:{[QUESTION]:'全职'},confirmedFields:[`customAnswers.${QUESTION}`],unrelated:'synthetic private sentinel'},
    resumeProfileLifecycle:{version:1,state:'ready',epoch:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'}};
  let digestCount=0,tabsCount=0,getCount=0,onDigest=()=>{},onTabs=()=>{},onGet=()=>{};
  const cryptoImpl={subtle:{digest:async(...args)=>{
    const result=await globalThis.crypto.subtle.digest(...args);await onDigest(++digestCount);return result;
  }}};
  const keys=[];
  const storage={get:async wanted=>{
    keys.push(wanted);await onGet(++getCount);
    const list=Array.isArray(wanted)?wanted:[wanted];
    assert.ok(list.every(key=>['resumeProfile','resumeProfileLifecycle'].includes(key)));
    return Object.fromEntries(list.filter(key=>Object.hasOwn(state,key)).map(key=>[key,structuredClone(state[key])]));
  },set(){throw Error('unexpected write');},remove(){throw Error('unexpected remove');}};
  const binding=await captureProfileBinding(storage,{cryptoImpl});
  digestCount=tabsCount=getCount=0;keys.length=0;
  let listener,url=PAGE;
  const api={runtime:{id:ID,onMessage:{addListener:value=>{listener=value;}}},storage:{local:storage},tabs:{get:async id=>{
    assert.equal(id,7);await onTabs(++tabsCount);return {url};
  }}};
  installProfileBindingBridge({api,cryptoImpl});
  const sender={id:ID,url:PAGE,frameId:0,tab:{id:7,url:PAGE}};
  const call=(extra={},from=sender)=>new Promise(resolve=>{listener({type:'RESUME_CMS_ROW_D_TRIAL_FACT',target:'expectedWorkNature',profileBinding:binding,...extra},from,resolve);});
  return {state,binding,keys,call,sender,setUrl:value=>{url=value;},onDigest:hook=>{onDigest=hook;},onTabs:hook=>{onTabs=hook;},onGet:hook=>{onGet=hook;}};
}
test('internal projection binds to actual raw storage hash and returns one target only',async()=>{
  const h=await bridgeFixture(),reply=await h.call();assert.equal(reply.allowed,true);
  assert.deepEqual(Object.keys(reply.projection).sort(),['confirmedFields','customAnswers','customFacts','schemaVersion']);
  assert.equal(reply.projection.customFacts.length,1);assert.equal(reply.projection.customFacts[0].answer,'全职');
  assert.equal(JSON.stringify(reply).includes('synthetic private sentinel'),false);
  assert.equal(JSON.stringify(reply).includes(h.binding.profileHash),false);
  assert.ok(h.keys.filter(Array.isArray).length>=2);
});
for(const extra of [{profile:{}},{answer:'实习'},{facts:[]},{projection:{}},{target:'__proto__'},{target:'expectedLocation1'},{profileBinding:{version:1,epoch:'legacy',profileHash:'a'.repeat(64)}}])test('caller-supplied fact/profile or invalid target/binding never returns a projection',async()=>{
  const h=await bridgeFixture(),reply=await h.call(extra);assert.equal(reply.allowed,false);assert.equal(reply.projection,undefined);assert.equal(h.keys.length,0);
});
for(const key of ['resumeProfile','resumeProfileLifecycle'])test(`own ${key} is mandatory despite legacy helper defaults`,async()=>{
  const h=await bridgeFixture();delete h.state[key];assert.equal((await h.call()).allowed,false);
});
for(const index of [1,2,3,4,5])test(`profile mutation during crypto await ${index} is rejected`,async()=>{
  const h=await bridgeFixture();h.onDigest(count=>{if(count===index)h.state.resumeProfile.customFacts[0].answer='实习';});
  const reply=await h.call();assert.equal(reply.allowed,false);assert.equal(reply.projection,undefined);
});
test('READY lifecycle changing during final snapshot digest is rejected',async()=>{
  const h=await bridgeFixture();h.onDigest(count=>{if(count===4)h.state.resumeProfileLifecycle.state='changing';});
  assert.equal((await h.call()).allowed,false);
});
for(const index of [2,3])test(`actual tab navigation after await checkpoint ${index} rejects projection`,async()=>{
  const h=await bridgeFixture();h.onTabs(count=>{if(count===index)h.setUrl('https://example.test/');});
  const reply=await h.call();assert.equal(reply.allowed,false);assert.equal(reply.projection,undefined);
});
for(const url of [`${PAGE}?synthetic=1`,`${PAGE}#synthetic`])test('sender full URL query/hash cannot enter the internal projection',async()=>{
  const h=await bridgeFixture(),sender={...h.sender,url,tab:{id:7,url}};
  assert.equal((await h.call({},sender)).allowed,false);assert.equal(h.keys.length,0);
});
test('ordinary boolean binding API behavior is unchanged',async()=>{
  const h=await bridgeFixture();assert.deepEqual(await h.call({type:'RESUME_PROFILE_BINDING_CHECK'}),{allowed:true});
});
