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
      if(options.holdAt===callCount)await new Promise(resolve=>{options.release=resolve;});
      if(options.timeoutAt===callCount)throw Error('PRIVATE_TIMEOUT');
      if(options.postAt===callCount)pair();
      if(options.changedAt===callCount)d.window.document.querySelector('.ant-select-selection-selected-value').textContent='PRIVATE_VALUE';
      if(options.openAt===callCount)d.window.document.querySelector('.ant-select').classList.add('ant-select-open');
      if(options.navigationAt===callCount)event({method:'Page.frameNavigated',params:{}});
      return {result:{value:remote.sample()}};
    }
    return {};
  },close(){closed=true;calls.push({method:'session.close'});}};
  return {d,calls,targets,pair,options,emit:message=>event(message),get samples(){return callCount;},
    restoreFixtureTarget(){for(const n of d.window.document.querySelectorAll('.ant-select'))n.classList.remove('ant-select-open');
      for(const n of d.window.document.querySelectorAll('.ant-select-selection-selected-value'))n.textContent='';},
    get closed(){return closed;},dependencies:{getTargets:async()=>targets,
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
test('nonterminal panel stop exposes a real bounded resampling supervisor',async()=>{
  const f=protocol({openAt:2}),out=await runCmsRowDControlledEntry(f.dependencies);
  assert.equal(typeof out.recover,'function');assert.equal(typeof out.cancel,'function');assert.equal(out.evidence.cleanupComplete,false);
  assert.equal(f.calls.some(x=>x.method==='Fetch.disable'),false);
  const before=f.samples;f.restoreFixtureTarget();const recovered=await out.recover();
  assert.ok(f.samples>=before+3);assert.equal(recovered.cleanupComplete,true);assert.equal(recovered.recoveryVerified,true);
  assert.equal(recovered.initialStop,'panel_not_closed');assert.ok(recovered.failureHistory.includes('panel_not_closed'));
  assert.equal(recovered.reason,'restored_after_prior_stop_not_a_live_pass');assert.equal(recovered.livePassClaimed,false);
  assert.equal(recovered.interactionAllowed,false);assert.equal(recovered.nativeCancellationVerified,false);f.dispose();
});
test('one cancellation request rechecks the target but absent native API never triggers UI',async()=>{
  const f=protocol({openAt:2}),out=await runCmsRowDControlledEntry(f.dependencies);const before=f.samples;
  const cancel=await out.cancel();assert.equal(f.samples,before+1);assert.equal(cancel.cancelOutcome,'native_action_unavailable');
  const again=await out.cancel();assert.equal(again.cancelOutcome,'cancel_request_limit');assert.equal(f.samples,before+1);
  assert.equal(again.cancelRequests,1);assert.equal(again.nativeCancellationVerified,false);
  assert.equal(f.calls.some(x=>x.method.startsWith('Input.')),false);assert.equal(f.closed,false);f.dispose();
});
test('a caller-provided nativeRecovery/coverage callback cannot grant action authority',async()=>{
  const f=protocol({openAt:2});let actions=0;
  const out=await runCmsRowDControlledEntry({...f.dependencies,nativeRecovery:true,coverage:true,nativeCancel:()=>{actions++;}});
  const result=await out.cancel();assert.equal(actions,0);assert.equal(result.nativeActionInterface,'unavailable');
  assert.equal(result.cancelOutcome,'native_action_unavailable');f.dispose();
});
test('unchanged open panel is sampled again but cannot be declared restored',async()=>{
  const f=protocol({openAt:2}),out=await runCmsRowDControlledEntry(f.dependencies),before=f.samples;
  const result=await out.recover();assert.equal(f.samples,before+1);assert.equal(result.cleanupComplete,false);
  assert.equal(result.recoveryVerified,false);assert.equal(f.calls.some(x=>x.method==='Fetch.disable'),false);
  const exhausted=await out.recover();assert.equal(f.samples,before+1);assert.equal(exhausted.reason,'recovery_limit');f.dispose();
});
test('closed panel with changed target values does not authorize cleanup',async()=>{
  const f=protocol({changedAt:2}),out=await runCmsRowDControlledEntry(f.dependencies);
  const result=await out.recover();assert.equal(result.reason,'target_values_not_restored');
  assert.equal(result.cleanupComplete,false);assert.equal(f.calls.some(x=>x.method==='Fetch.disable'),false);f.dispose();
});
test('owner replacement during pending recovery is terminal and never disables Fetch',async()=>{
  const f=protocol({openAt:2}),out=await runCmsRowDControlledEntry(f.dependencies);
  const n=f.d.window.document.querySelector('.cascader-plugins-wrap');n.replaceWith(n.cloneNode(true));
  const result=await out.recover();assert.equal(result.protectionState,'unknown');assert.equal(result.cleanupComplete,false);
  assert.equal(result.recoveryAvailable,false);assert.equal(f.calls.some(x=>x.method==='Fetch.disable'),false);f.dispose();
});
test('concurrent recovery calls share one protocol sequence',async()=>{
  const options={openAt:2,holdAt:3},f=protocol(options),out=await runCmsRowDControlledEntry(f.dependencies);
  f.restoreFixtureTarget();const first=out.recover(),second=out.recover();
  assert.equal(first,second);assert.equal(f.samples,3);options.release();
  const [a,b]=await Promise.all([first,second]);assert.equal(a.cleanupComplete,true);assert.deepEqual(a,b);
  assert.equal(f.calls.filter(x=>x.method==='Fetch.disable').length,1);f.dispose();
});
test('cancel cannot race a pending recovery ACK with another sample',async()=>{
  const options={openAt:2,holdAt:3},f=protocol(options),out=await runCmsRowDControlledEntry(f.dependencies);
  f.restoreFixtureTarget();const recovery=out.recover(),cancel=await out.cancel();
  assert.equal(cancel.cancelOutcome,'supervisor_busy');assert.equal(f.samples,3);options.release();
  assert.equal((await recovery).cleanupComplete,true);f.dispose();
});
test('navigation while waiting for allowed native cancellation forbids recovery sampling',async()=>{
  const f=protocol({openAt:2}),out=await runCmsRowDControlledEntry(f.dependencies),before=f.samples;
  f.emit({method:'Page.frameNavigated',params:{}});f.restoreFixtureTarget();const result=await out.recover();
  assert.equal(result.reason,'document_or_channel_changed');assert.equal(f.samples,before);
  assert.equal(result.cleanupComplete,false);assert.equal(result.protectionState,'unknown');f.dispose();
});
test('guard POST after a nonterminal stop becomes terminal despite later restored DOM',async()=>{
  const f=protocol({openAt:2}),out=await runCmsRowDControlledEntry(f.dependencies),before=f.samples;
  f.pair();f.restoreFixtureTarget();const result=await out.recover();
  assert.equal(result.reason,'non_get_or_guard_failure');assert.equal(f.samples,before);
  assert.equal(result.cleanupComplete,false);assert.equal(result.protectionState,'unknown');f.dispose();
});
test('unknown recovery send or disconnect cannot earn clean or keep an active claim',async()=>{
  const f=protocol({openAt:2,timeoutAt:3}),out=await runCmsRowDControlledEntry(f.dependencies);
  f.restoreFixtureTarget();const result=await out.recover();assert.equal(result.protectionState,'unknown');
  assert.equal(result.cleanupComplete,false);assert.equal(result.recoveryAvailable,false);
  const before=f.samples;await out.recover();assert.equal(f.samples,before);f.dispose();
});
test('the original lease still expires while the supervisor awaits external cancellation',async()=>{
  const f=protocol({openAt:2}),out=await runCmsRowDControlledEntry({...f.dependencies,leaseMs:1000});
  const before=f.samples;await new Promise(resolve=>setTimeout(resolve,1050));f.restoreFixtureTarget();
  const result=await out.recover();assert.equal(result.reason,'lease_expired');assert.equal(f.samples,before);
  assert.equal(result.cleanupComplete,false);assert.equal(result.protectionState,'unknown');f.dispose();
});

test('disconnect during the recovery ACK window makes the held sample terminal',async()=>{
  const options={openAt:2,holdAt:3},f=protocol(options),out=await runCmsRowDControlledEntry(f.dependencies);
  f.restoreFixtureTarget();const recovery=out.recover();
  f.emit({method:'Inspector.detached',params:{}});options.release();const result=await recovery;
  assert.equal(result.reason,'document_or_channel_changed');assert.equal(result.protectionState,'unknown');
  assert.equal(result.cleanupComplete,false);assert.equal(result.recoveryAvailable,false);
  assert.equal(f.calls.some(x=>x.method==='Fetch.disable'),false);
  const before=f.samples;await out.recover();assert.equal(f.samples,before);f.dispose();
});
