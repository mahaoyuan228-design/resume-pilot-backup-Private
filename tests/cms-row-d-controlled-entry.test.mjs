import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {captureDTarget,runCmsRowDControlledEntry,INSTALLED_EXTENSION_ID} from '../scripts/live/cms-row-d-controlled-entry.mjs';
import {ROW_D_PAGE} from '../scripts/lib/cms-row-d-options.mjs';

function dom(){
  const d=new JSDOM(`<form><section id="13" class="form-cell"><div class="ant-form-item"><div id="13_100701_0">
  <div class="cascader-plugins-wrap">${[0,1].map(()=>`<div class="ant-select"><div class="ant-select-selection--single" role="combobox">
  <span class="ant-select-selection-selected-value"></span><input type="text" class="ant-select-search__field" aria-hidden="true"></div></div>`).join('')}
  </div></div></div></section></form>`,{url:ROW_D_PAGE,runScripts:'outside-only'});
  // jsdom has no designMode IDL; represent the documented inert browser state.
  Object.defineProperty(d.window.document,'designMode',{value:'off',configurable:true});return d;
}
function protocol(options={}){
  const d=dom(),calls=[];let event,callCount=0,remote,closed=false;
  const targets=[{type:'page',id:'owned',url:ROW_D_PAGE,webSocketDebuggerUrl:'ws://127.0.0.1:9242/devtools/page/owned'},
    {type:'service_worker',url:`chrome-extension://${INSTALLED_EXTENSION_ID}/src/background/worker.mjs`}];
  const pair=()=>{
    const request={method:'POST',url:'https://wecruit.hotjob.cn/wecruit/resume/info/edit/SU629dbc0c0dcad452299bc0f7'};
    event({method:'Network.requestWillBeSent',params:{requestId:'N',request}});
    event({method:'Fetch.requestPaused',params:{requestId:'F',networkId:'N',request}});
  };
  const session={async send(method,params){
    calls.push({method,params});
    if(options.failed===method)throw Error('PRIVATE_ERROR');
    if(method==='Page.bringToFront'&&options.keeperPost)pair();
    if(method==='Emulation.setFocusEmulationEnabled'&&params.enabled===false&&options.focusPost)pair();
    if(method==='Fetch.disable'&&options.disablePost){await Promise.resolve();pair();}
    if(method==='Fetch.enable'&&options.delayFetch)await new Promise(resolve=>setTimeout(resolve,options.delayFetch));
    if(method==='Runtime.evaluate'){
      if(options.captureFailure)return {exceptionDetails:{text:'PRIVATE_ERROR'}};
      remote=d.window.eval(params.expression);return {result:{objectId:'internal-target'}};
    }
    if(method==='Runtime.callFunctionOn'){
      callCount++;
      if(options.postAt===callCount)pair();
      if(options.changedAt===callCount)d.window.document.querySelector('.ant-select-selection-selected-value').textContent='PRIVATE_VALUE';
      if(options.openAt===callCount)d.window.document.querySelector('.ant-select').classList.add('ant-select-open');
      if(options.navigationAt===callCount)event({method:'Page.frameNavigated',params:{}});
      return {result:{value:remote.sample()}};
    }
    return {};
  },close(){closed=true;calls.push({method:'session.close'});}};
  return {d,calls,targets,pair,get closed(){return closed;},dependencies:{getTargets:async()=>targets,
    connect:async(_socket,args)=>{event=args.onEvent;return session;},wait:async()=>{}},dispose(){d.window.close();}};
}
test('import provides no automatic connector or UI action',()=>{
  assert.equal(typeof runCmsRowDControlledEntry,'function');
  assert.equal(captureDTarget.toString().includes('.click('),false);
});
test('real target observer keeps original target values inside its closure',()=>{
  const d=dom();d.window.document.querySelector('.ant-select-selection-selected-value').textContent='PRIVATE_VALUE';
  const saved=d.window.eval(`(${captureDTarget.toString()})(${JSON.stringify(ROW_D_PAGE)})`);
  assert.equal(saved.sample().valuesUnchanged,true);assert.equal(saved.sample().baselineAllBlank,false);
  d.window.document.querySelector('.ant-select-selection-selected-value').textContent='OTHER';
  assert.equal(saved.sample().valuesUnchanged,false);assert.equal(JSON.stringify(saved.sample()).includes('PRIVATE_VALUE'),false);d.window.close();
});
test('wrong URL and duplicate wrapper reject before exposing target data',()=>{
  const d=dom();assert.throws(()=>d.window.eval(`(${captureDTarget.toString()})("https://wrong.invalid")`));
  d.window.document.body.append(d.window.document.querySelector('[id="13_100701_0"]').cloneNode(true));
  assert.throws(()=>d.window.eval(`(${captureDTarget.toString()})(${JSON.stringify(ROW_D_PAGE)})`));d.window.close();
});
test('same-document node replacement and editable ancestry cannot be accepted',()=>{
  const d=dom(),saved=d.window.eval(`(${captureDTarget.toString()})(${JSON.stringify(ROW_D_PAGE)})`);
  const n=d.window.document.querySelector('.ant-select-selection-selected-value');n.replaceWith(n.cloneNode(true));assert.throws(()=>saved.sample());
  d.window.document.body.setAttribute('contenteditable','plaintext-only');assert.throws(()=>d.window.eval(`(${captureDTarget.toString()})(${JSON.stringify(ROW_D_PAGE)})`));d.window.close();
});
test('same port must also contain the exact installed extension worker metadata',async()=>{
  let connected=false;const out=await runCmsRowDControlledEntry({getTargets:async()=>[],connect:async()=>{connected=true;}});
  assert.equal(connected,false);assert.equal(out.evidence.reason,'installed_instance_unverified');
});
test('standard protocol path enables before keeper, closes keeper and never authorizes UI',async()=>{
  const f=protocol({keeperPost:true}),out=await runCmsRowDControlledEntry(f.dependencies);
  assert.equal(out.evidence.guardEnabled,true);assert.equal(out.evidence.keeperClosed,true);
  assert.equal(out.evidence.cleanupComplete,true);assert.equal(out.evidence.interactionAllowed,false);
  assert.equal(out.evidence.reason,'interaction_precondition_stop_channels_and_native_recovery_unverified');
  assert.equal(out.evidence.assessment.status,'correlated_keeper_blocks');
  assert.ok(f.calls.findIndex(x=>x.method==='Fetch.enable')<f.calls.findIndex(x=>x.method==='Target.activateTarget'));
  assert.equal(f.calls.some(x=>x.params?.expression?.includes('RESUME_FILL')),false);assert.equal(f.closed,true);f.dispose();
});
test('after keeper closes, even exact info/edit POST is blocked and permanently fails',async()=>{
  const f=protocol({postAt:2}),out=await runCmsRowDControlledEntry(f.dependencies);
  assert.ok(f.calls.some(x=>x.method==='Fetch.failRequest'));assert.equal(out.evidence.reason,'non_get_or_guard_failure');
  assert.ok(out.evidence.assessment.reasons.includes('outside_keeper'));assert.equal(out.evidence.interactionAllowed,false);f.dispose();
});
for(const options of [{changedAt:2},{openAt:2},{captureFailure:true}])test(`unproven recovery retains guard: ${JSON.stringify(options)}`,async()=>{
  const f=protocol(options),out=await runCmsRowDControlledEntry(f.dependencies);
  assert.equal(out.evidence.guardRetentionRequested,true);assert.equal(out.evidence.cleanupComplete,false);
  assert.equal(f.calls.some(x=>x.method==='Fetch.disable'),false);assert.equal(f.closed,false);f.dispose();
});
test('unknown enable outcome cannot be closed or called clean',async()=>{
  const f=protocol({failed:'Fetch.enable'}),out=await runCmsRowDControlledEntry(f.dependencies);
  assert.equal(out.evidence.guardRetentionRequested,true);assert.equal(out.evidence.protectionState,'unknown');assert.equal(out.evidence.cleanupComplete,false);assert.equal(f.closed,false);f.dispose();
});
test('navigation is sticky even when target comparison still happens to match',async()=>{
  const f=protocol({navigationAt:1}),out=await runCmsRowDControlledEntry(f.dependencies);
  assert.equal(out.evidence.reason,'document_or_channel_changed');assert.equal(out.evidence.interactionAllowed,false);f.dispose();
});
test('private raw errors and values never enter evidence',async()=>{
  const f=protocol({changedAt:2}),out=await runCmsRowDControlledEntry(f.dependencies);
  assert.equal(JSON.stringify(out.evidence).includes('PRIVATE'),false);assert.equal(JSON.stringify(out.evidence).includes(ROW_D_PAGE),false);f.dispose();
});
test('detached old cascader with preserved subtree is rejected',()=>{
  const d=dom(),saved=d.window.eval(`(${captureDTarget.toString()})(${JSON.stringify(ROW_D_PAGE)})`);
  const n=d.window.document.querySelector('.cascader-plugins-wrap');n.replaceWith(n.cloneNode(true));
  assert.throws(()=>saved.sample());d.window.close();
});
test('nested different wrapper refuses before any selected text getter',()=>{
  const d=dom(),wrap=d.window.document.querySelector('[id="13_100701_0"]'),c=d.window.document.querySelector('.cascader-plugins-wrap');
  const foreign=d.window.document.createElement('div');foreign.id='13_999_0';wrap.append(foreign);foreign.append(c);
  let reads=0;for(const n of c.querySelectorAll('.ant-select-selection-selected-value'))Object.defineProperty(n,'textContent',{get(){reads++;throw Error('private');}});
  assert.throws(()=>d.window.eval(`(${captureDTarget.toString()})(${JSON.stringify(ROW_D_PAGE)})`));assert.equal(reads,0);d.window.close();
});
test('a display containing a nested different wrapper is rejected before text read',()=>{
  const d=dom(),n=d.window.document.querySelector('.ant-select-selection-selected-value');
  n.innerHTML='<span id="13_999_0">PRIVATE</span>';let reads=0;
  Object.defineProperty(n,'textContent',{get(){reads++;throw Error('private');}});
  assert.throws(()=>d.window.eval(`(${captureDTarget.toString()})(${JSON.stringify(ROW_D_PAGE)})`));assert.equal(reads,0);d.window.close();
});
test('original hosts moved under a new nested cascader fail resampling before value read',()=>{
  const d=dom(),wrap=d.window.document.querySelector('[id="13_100701_0"]'),old=d.window.document.querySelector('.cascader-plugins-wrap');
  wrap.classList.add('cascader-plugins-wrap');old.classList.remove('cascader-plugins-wrap');
  const saved=d.window.eval(`(${captureDTarget.toString()})(${JSON.stringify(ROW_D_PAGE)})`);
  const nested=d.window.document.createElement('div');nested.className='cascader-plugins-wrap';old.append(nested);
  for(const n of [...old.querySelectorAll('.ant-select')])nested.append(n);
  let reads=0;for(const n of nested.querySelectorAll('.ant-select-selection-selected-value'))Object.defineProperty(n,'textContent',{get(){reads++;throw Error('private');}});
  assert.throws(()=>saved.sample());assert.equal(reads,0);d.window.close();
});
test('focus cleanup POST fails under active guard and prevents Fetch disable',async()=>{
  const f=protocol({focusPost:true}),out=await runCmsRowDControlledEntry(f.dependencies);
  assert.equal(out.evidence.cleanupComplete,false);assert.equal(out.evidence.recoveryVerified,false);
  assert.equal(f.calls.some(x=>x.method==='Fetch.disable'),false);assert.equal(f.closed,false);f.dispose();
});
test('fatal navigation never earns recovery or disables interception',async()=>{
  const f=protocol({navigationAt:1}),out=await runCmsRowDControlledEntry(f.dependencies);
  assert.equal(out.evidence.recoveryVerified,false);assert.equal(f.calls.some(x=>x.method==='Fetch.disable'),false);f.dispose();
});
test('protection end has no later DOM samples; an interleaved POST cannot be clean',async()=>{
  const f=protocol({disablePost:true}),out=await runCmsRowDControlledEntry(f.dependencies);
  const end=f.calls.findIndex(x=>x.method==='Fetch.disable');assert.ok(end>=0);
  assert.equal(f.calls.slice(end+1).some(x=>x.method==='Runtime.callFunctionOn'),false);
  assert.equal(out.evidence.cleanupComplete,false);assert.equal(out.evidence.recoveryVerified,false);
  assert.equal(out.evidence.protectionState,'unknown');assert.equal(f.closed,false);f.dispose();
});
test('failed disable ACK is unknown, not a proven retained live guard',async()=>{
  const f=protocol({failed:'Fetch.disable'}),out=await runCmsRowDControlledEntry(f.dependencies);
  assert.equal(out.evidence.protectionState,'unknown');assert.equal(out.evidence.cleanupComplete,false);
  assert.equal('guardRetained' in out.evidence,false);f.dispose();
});
test('all target observations complete before protection-end command',async()=>{
  const f=protocol(),out=await runCmsRowDControlledEntry(f.dependencies);
  const end=f.calls.findIndex(x=>x.method==='Fetch.disable');assert.ok(end>=0);
  assert.equal(f.calls.slice(end+1).some(x=>x.method==='Runtime.callFunctionOn'),false);
  assert.equal(out.evidence.cleanupComplete,true);assert.equal(out.evidence.protectionState,'ended_acknowledged');f.dispose();
});
test('drain command failure is sticky and cannot be swallowed into cleanup',async()=>{
  const f=protocol({focusPost:true,failed:'Fetch.failRequest'}),out=await runCmsRowDControlledEntry(f.dependencies);
  assert.equal(out.evidence.traffic.commandFailed,true);assert.equal(out.evidence.cleanupComplete,false);
  assert.equal(out.evidence.protectionState,'unknown');
  assert.equal(f.calls.some(x=>x.method==='Fetch.disable'),false);f.dispose();
});
test('total lease expiry during an enable ACK never authorizes another action',async()=>{
  const f=protocol({delayFetch:1050}),out=await runCmsRowDControlledEntry({...f.dependencies,leaseMs:1000});
  assert.equal(out.evidence.reason,'lease_expired');assert.equal(out.evidence.interactionAllowed,false);
  assert.equal(out.evidence.cleanupComplete,false);assert.equal(f.calls.some(x=>x.method==='Target.activateTarget'),false);f.dispose();
});
test('failed retention has no public recovery command or clean-teardown promise',async()=>{
  const f=protocol({openAt:2}),out=await runCmsRowDControlledEntry(f.dependencies);
  assert.equal(out.recover,null);assert.equal(out.evidence.cleanupComplete,false);
  assert.equal(f.calls.some(x=>x.method==='Fetch.disable'),false);assert.equal(f.closed,false);f.dispose();
});
