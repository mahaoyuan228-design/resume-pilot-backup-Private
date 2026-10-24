// Synthetic offline only. This test never discovers or connects to a user browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { ROW_D_PAGE, buildCmsRowDOptionsProbeExpression } from '../scripts/lib/cms-row-d-options.mjs';
import { connectCdp } from '../tools/live-harvest/cdp-client.mjs';
import { runCmsRowDLive } from '../scripts/live/cms-row-d-live.mjs';
import { inspectLocationStructure,validateStructure,buildLocationStructureExpression,runLocationStructure,
  readStructureConfig,main,SOURCE_PINS } from '../scripts/live/cms-row-d-location-structure.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const PRIVATE='SYNTHETIC_PRIVATE_STRUCTURE_SENTINEL';
const TIP='5fc48e83764a955e8ada75894baeb44a6b53c637';
const WRAPPERS=['13_100701_0','13_100702_0'];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function html(){
  const wrappers=WRAPPERS.map((id,index)=>`<div id="${id}"><div class="ant-form-item"><div class="ant-form-item-label"><label>意向${index?'二':'一'}：期望工作地点*</label></div><div class="cascader-plugins-wrap">${[0,1].map(slot=>`<div class="ant-select"><div class="ant-select-selection ant-select-selection--single" role="combobox" aria-controls="${PRIVATE}-${index}-${slot}"><span class="ant-select-selection-selected-value">${PRIVATE}</span><span class="ant-select-search"><input class="ant-select-search__field" type="text" style="display:none" value="${PRIVATE}" aria-label="${PRIVATE}" placeholder="${PRIVATE}"></span></div></div>`).join('')}</div></div></div>`).join('');
  const lists=WRAPPERS.flatMap((_id,index)=>[0,1].map(slot=>`<div class="ant-select-dropdown" style="display:none"><ul role="listbox" class="ant-select-dropdown-menu" id="${PRIVATE}-${index}-${slot}"><li role="option">${PRIVATE}</li></ul></div>`)).join('');
  return `<!doctype html><body><form><section class="form-cell" id="13">${wrappers}</section></form>${lists}</body>`;
}
function dom(t,{url=ROW_D_PAGE,mutate}={}){
  const value=new JSDOM(html(),{url,runScripts:'outside-only',pretendToBeVisual:true});
  const query=value.window.document.querySelectorAll.bind(value.window.document);
  t.after(()=>{
    delete value.window.document.querySelectorAll;
    for(const node of query('*')){
      for(const key of ['textContent','innerHTML','outerHTML','selectedText','value','checked','selected','selectedIndex','selectedOptions'])delete node[key];
      delete node.getAttribute;
    }
    value.window.close();
  });
  Object.defineProperty(value.window.document,'readyState',{get:()=> 'complete'});
  Object.defineProperty(value.window.document,'visibilityState',{get:()=> 'visible'});
  mutate?.(value.window.document);return value;
}
function trapPrivate(document){
  let reads=0;
  for(const node of document.querySelectorAll('*')){
    if(node.tagName!=='LABEL')for(const key of ['textContent','innerHTML','outerHTML','selectedText'])
      Object.defineProperty(node,key,{configurable:true,get(){reads++;throw Error(PRIVATE);}});
    for(const key of ['value','checked','selected','selectedIndex','selectedOptions'])
      Object.defineProperty(node,key,{configurable:true,get(){reads++;throw Error(PRIVATE);}});
    const get=node.getAttribute.bind(node);
    node.getAttribute=name=>{if(['value','checked','selected','aria-label','aria-selected','aria-checked','placeholder'].includes(name)){reads++;throw Error(PRIVATE);}return get(name);};
  }
  return ()=>reads;
}
function safe(value){
  const json=JSON.stringify(value);assert.ok(!json.includes(PRIVATE));
  assert.doesNotMatch(json,/"optionLabels"|selectedText|innerHTML|outerHTML|profileHash|resumeId|webSocketDebuggerUrl/);
}
function fixtureRoot(t){
  fs.mkdirSync(path.join(ROOT,'_temp-scripts'),{recursive:true});
  const root=fs.mkdtempSync(path.join(ROOT,'_temp-scripts','r10-config-test-'));
  fs.mkdirSync(path.join(root,'_temp-scripts'));
  fs.writeFileSync(path.join(root,'TIP_SHA.txt'),TIP+'\n');
  for(const file of Object.keys(SOURCE_PINS)){
    fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});
    // Model the exact existing Dev byte pins: its two scripts use CRLF and
    // the CDP/error modules use LF. No shared source file is rewritten.
    const lf=fs.readFileSync(path.join(ROOT,file),'utf8').replace(/\r\n/gu,'\n');
    fs.writeFileSync(path.join(root,file),file.startsWith('scripts/')?lf.replace(/\n/gu,'\r\n'):lf);
  }
  t.after(()=>{assert.ok(path.relative(path.join(ROOT,'_temp-scripts'),root).startsWith('r10-config-test-'));fs.rmSync(root,{recursive:true,force:true});});
  return root;
}
function fake(t,{onSend,onWait,mutateReply,mutateDom}={}){
  const value=dom(t,{mutate:mutateDom}),calls=[];let event,waits=0;
  const emit=data=>event(data);
  const dependencies={
    getTargets:async(port,pathname,options)=>{
      calls.push({method:'getTargets',port,pathname,options});
      return [{type:'page',id:'synthetic-target',url:ROW_D_PAGE,webSocketDebuggerUrl:'ws://127.0.0.1:9242/devtools/page/synthetic-target'}];
    },
    connect:async(url,options)=>{
      calls.push({method:'connect',options});event=options.onEvent;
      return {close(){calls.push({method:'close'});},async send(method,params,sendOptions){
        calls.push({method,params,sendOptions});
        const override=await onSend?.(method,params,{emit,calls});if(override!==undefined)return override;
        if(method==='Runtime.evaluate'){
          const reply={result:{value:value.window.eval(params.expression)}};
          mutateReply?.(reply);return reply;
        }return {};
      }};
    },
    wait:async ms=>{calls.push({method:'wait',ms});await onWait?.(++waits,{emit,calls});}
  };
  return {calls,value,dependencies,run:()=>runLocationStructure(dependencies)};
}
const post={method:'Network.requestWillBeSent',params:{requestId:'private-request',request:{method:'POST',url:'https://example.invalid/private'}}};
const methodNames=f=>f.calls.map(item=>item.method);

test('both wrappers and all four hosts are structural only; no text/state/ARIA content reads',t=>{
  const value=dom(t),reads=trapPrivate(value.window.document),result=inspectLocationStructure(value.window.document,ROW_D_PAGE);
  assert.equal(result.captured,true);validateStructure(result);assert.equal(reads(),0);safe(result);
  for(const row of result.locations){
    assert.equal(row.hostCount,2);assert.equal(row.cascaderOwnsBoth,true);assert.equal(row.hostsNearestCascaderSame,true);
    assert.deepEqual(row.hosts.map(host=>host.hostSlot),[0,1]);
    for(const host of row.hosts){assert.equal(host.reason,'linked_structure_observed');assert.equal(host.levelHint,'unknown');assert.equal(host.dictionaryComplete,false);}
  }
});
for(const url of ['https://example.invalid/',ROW_D_PAGE+'?private=1',ROW_D_PAGE+'#private',ROW_D_PAGE+'/extra'])test('inner exact page check refuses navigation and aliases before tree access',t=>{
  const value=dom(t,{url});value.window.document.querySelectorAll=()=>{throw Error('tree reached');};
  assert.deepEqual(inspectLocationStructure(value.window.document,ROW_D_PAGE),{captured:false,reason:'wrong_page'});
});
for(const [name,change,reason] of [
  ['unmounted',doc=>doc.querySelector('ul').remove(),'current_list_missing_or_ambiguous'],
  ['duplicate ID',doc=>doc.querySelector('ul').after(doc.querySelector('ul').cloneNode()),'current_list_missing_or_ambiguous'],
  ['foreign owner',doc=>{const node=doc.createElement('i');node.setAttribute('aria-controls',doc.querySelector('[role=combobox]').getAttribute('aria-controls'));doc.body.append(node);},'aria_owner_not_unique'],
  ['shared peer token',doc=>{const combos=doc.querySelectorAll('[role=combobox]');combos[1].setAttribute('aria-controls',combos[0].getAttribute('aria-controls'));},'aria_owner_not_unique'],
  ['missing ARIA',doc=>doc.querySelector('[role=combobox]').removeAttribute('aria-controls'),'aria_reference_missing_or_ambiguous'],
  ['same token repeated',doc=>{const combo=doc.querySelector('[role=combobox]');combo.setAttribute('aria-controls',combo.getAttribute('aria-controls')+' '+combo.getAttribute('aria-controls'));},'aria_reference_missing_or_ambiguous'],
  ['CSS-looking token',doc=>doc.querySelector('[role=combobox]').setAttribute('aria-controls','a"]#private'),'current_list_missing_or_ambiguous'],
  ['wrong list role',doc=>doc.querySelector('ul').setAttribute('role','status'),'list_or_portal_unverified'],
  ['foreign portal',doc=>{const other=doc.createElement('div');other.id='13_999_0';doc.getElementById('13').append(other);other.append(doc.querySelector('.ant-select-dropdown'));},'list_or_portal_unverified']
])test(`missing evidence never guesses or reads linked contents: ${name}`,t=>{
  const value=dom(t,{mutate:change}),reads=trapPrivate(value.window.document);
  const result=inspectLocationStructure(value.window.document,ROW_D_PAGE);validateStructure(result);
  assert.equal(result.locations[0].hosts[0].reason,reason);
  assert.equal(result.locations[0].hosts.length,2);assert.equal(result.locations[1].hosts.length,2);
  assert.equal(reads(),0);safe(result);
});
for(const [name,change] of [
  ['token length',doc=>doc.querySelector('[role=combobox]').setAttribute('aria-controls','x'.repeat(2049))],
  ['many tokens',doc=>doc.querySelector('[role=combobox]').setAttribute('aria-controls',Array.from({length:9},(_,i)=>'x'+i).join(' '))],
  ['local nodes',doc=>{const host=doc.querySelector('.ant-select');for(let i=0;i<257;i++)host.append(doc.createElement('input'));}],
  ['global ID nodes',doc=>{for(let i=0;i<10001;i++){const node=doc.createElement('i');node.id='private'+i;doc.body.append(node);}}]
])test(`structural bounds fail closed: ${name}`,t=>{
  const value=dom(t,{mutate:change}),result=inspectLocationStructure(value.window.document,ROW_D_PAGE);
  assert.deepEqual(result,{captured:false,reason:'structure_limit_or_exception'});safe(result);
});
for(const area of ['wrapper','input','foreign-owner','list','portal','cycle'])test(`every ancestor path has the common fixed depth limit: ${area}`,t=>{
  const value=dom(t),doc=value.window.document;
  let node=area==='wrapper'||area==='cycle'?doc.getElementById(WRAPPERS[0]):area==='input'?doc.querySelector('input')
    :area==='list'?doc.querySelector('ul'):area==='portal'?doc.querySelector('.ant-select-dropdown'):null;
  if(area==='foreign-owner'){
    node=doc.createElement('i');node.setAttribute('aria-controls',doc.querySelector('[role=combobox]').getAttribute('aria-controls'));doc.body.append(node);
  }
  if(area==='cycle')Object.defineProperty(node,'parentElement',{configurable:true,get:()=>node});
  else for(let i=0;i<130;i++){const parent=doc.createElement('div');node.before(parent);parent.append(node);}
  const result=inspectLocationStructure(doc,ROW_D_PAGE);
  assert.deepEqual(result,{captured:false,reason:'structure_limit_or_exception'});safe(result);
  if(area==='cycle')delete node.parentElement;
});
test('cascader absent is an observation, never inferred from peer counts',t=>{
  const value=dom(t,{mutate:doc=>doc.querySelector('.cascader-plugins-wrap').className='unknown'});
  const row=inspectLocationStructure(value.window.document,ROW_D_PAGE).locations[0];
  assert.equal(row.hostCount,2);assert.equal(row.cascaderCount,0);assert.equal(row.cascaderOwnsBoth,false);assert.equal(row.dictionaryComplete,false);
});
test('exact schema refuses raw tokens, upgraded semantics, wrong slots and oversized counts',t=>{
  const result=inspectLocationStructure(dom(t).window.document,ROW_D_PAGE);
  for(const change of [r=>r.rawToken=PRIVATE,r=>r.locations[0].levelHint='province',r=>r.locations[0].dictionaryComplete=true,
    r=>r.locations[0].hostCount=257,r=>r.locations[0].hosts.pop(),r=>r.locations[0].hosts[1].hostSlot=0,
    r=>r.locations[0].hosts[0].ariaOwnerCount=-1,r=>r.locations[0].hosts[0].raw=PRIVATE]){
    const copy=structuredClone(result);change(copy);assert.throws(()=>validateStructure(copy),/diagnostic_invalid/);
  }
});
test('decorator preserves original inspection exactly and runs one strict evaluation after keeper',async t=>{
  const f=fake(t),expected=await runCmsRowDLive(fake(t).dependencies),result=await f.run();
  assert.equal(result.captured,true);assert.deepEqual(JSON.parse(JSON.stringify(result.official.fields)),JSON.parse(JSON.stringify(expected.fields)));
  assert.equal(result.official.reason,expected.reason);assert.equal(result.official.ok,expected.ok);safe(result.structure);
  const calls=f.calls.filter(call=>call.method==='Runtime.evaluate');assert.equal(calls.length,1);
  assert.equal(calls[0].params.throwOnSideEffect,true);assert.equal(calls[0].params.awaitPromise,false);
  assert.equal(calls[0].params.userGesture,false);assert.equal(calls[0].params.returnByValue,true);
  assert.ok(methodNames(f).indexOf('Fetch.enable')<methodNames(f).indexOf('Target.activateTarget'));
  assert.ok(methodNames(f).indexOf('Emulation.setFocusEmulationEnabled')<methodNames(f).indexOf('Runtime.evaluate'));
  assert.equal(methodNames(f).at(-1),'close');
});
test('a strict evaluation exception remains the original official exception with no fallback',async t=>{
  const f=fake(t,{onSend(method){if(method==='Runtime.evaluate')return {exceptionDetails:{text:PRIVATE},result:{value:{inspection:{ok:true},structure:{}}}};}});
  const result=await f.run();assert.equal(result.captured,false);assert.equal(result.official.reason,'inspection_exception');
  assert.deepEqual(result.official.fields,[]);assert.equal(f.calls.filter(call=>call.method==='Runtime.evaluate').length,1);safe(result);
});
for(const errorKind of ['protocol','remote-object'])test(`CDP error semantics cannot be unwrapped into success: ${errorKind}`,async t=>{
  const f=fake(t,{mutateReply(reply){if(errorKind==='protocol')reply.error={message:PRIVATE};else reply.result.subtype='error';}});
  const result=await f.run();assert.equal(result.captured,false);assert.equal(result.official.reason,'inspection_failed');
  assert.deepEqual(result.official.fields,[]);assert.equal(f.calls.filter(call=>call.method==='Runtime.evaluate').length,1);safe(result);
});
for(const invalid of ['extra envelope','invalid structure'])test(`invalid diagnostic cannot manufacture a successful verdict: ${invalid}`,async t=>{
  const f=fake(t,{mutateReply(reply){if(invalid==='extra envelope')reply.result.value.private=PRIVATE;else reply.result.value.structure.private=PRIVATE;}});
  const result=await f.run();assert.equal(result.captured,false);assert.equal(result.structure,undefined);
  assert.equal(result.official.reason,invalid==='extra envelope'?'inspection_failed':'row_d_preflight_incomplete');safe(result);
});
for(const stage of ['activation','settlement','cleanup'])test(`guard/final cleanup rejection discards previously computed structure: ${stage}`,async t=>{
  const f=fake(t,{onSend(method,params,{emit}){
    if(stage==='activation'&&method==='Target.activateTarget')emit(post);
    if(stage==='cleanup'&&method==='Emulation.setFocusEmulationEnabled'&&params.enabled===false)throw Error(PRIVATE);
  },onWait(index,{emit}){if(stage==='settlement'&&index===1)emit(post);}});
  const result=await f.run();assert.equal(result.captured,false);assert.equal(result.structure,undefined);
  assert.equal(result.official.reason,stage==='cleanup'?'visibility_keeper_cleanup_failed':'non_get_or_guard_failure');
  assert.equal(f.calls.filter(call=>call.method==='Runtime.evaluate').length,stage==='activation'?0:1);safe(result);
});
test('actual correlated keeper events qualify only after immediate blocking and all checkpoints',async t=>{
  const url=ROW_D_PAGE.replace('/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html','/wecruit/resume/info/edit/SU629dbc0c0dcad452299bc0f7');
  const f=fake(t,{onSend(method,_params,{emit}){if(method==='Target.activateTarget'){
    const request={method:'POST',url};emit({method:'Network.requestWillBeSent',params:{requestId:'offline-network',request}});
    emit({method:'Fetch.requestPaused',params:{requestId:'offline-fetch',networkId:'offline-network',request}});
  }}});
  const result=await f.run();assert.equal(result.captured,true);
  assert.equal(result.official.traffic.keeperAssessment.status,'correlated_keeper_blocks');
  assert.ok(methodNames(f).indexOf('Fetch.failRequest')<methodNames(f).indexOf('Runtime.evaluate'));
  assert.equal(result.official.inspectionGate.checkpoints.length,4);safe(result.structure);
});
test('teardown-only paired evidence cannot qualify structure captured earlier',async t=>{
  const url=ROW_D_PAGE.replace('/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html','/wecruit/resume/info/edit/SU629dbc0c0dcad452299bc0f7');
  const f=fake(t,{onSend(method,_params,{emit}){if(method==='Fetch.disable'){
    const request={method:'POST',url};emit({method:'Network.requestWillBeSent',params:{requestId:'late-network',request}});
    emit({method:'Fetch.requestPaused',params:{requestId:'late-fetch',networkId:'late-network',request}});
  }}});
  const result=await f.run();assert.equal(result.official.probeCompleted,true);assert.equal(result.captured,false);
  assert.equal(result.structure,undefined);assert.equal(result.official.reason,'non_get_or_guard_failure');
});
test('an early keeper stop preserves official evidence without a diagnostic file',async t=>{
  const root=fixtureRoot(t),out=path.join(root,'_temp-scripts','cms-row-d-location-structure-early'),
    f=fake(t,{onSend(method,_params,{emit}){if(method==='Target.activateTarget')emit(post);}});
  await main(['--tip',TIP,'--outdir',out],{},{root,run:()=>f.run(),stdout:{write(){}}});
  const official=JSON.parse(fs.readFileSync(path.join(out,'cms-row-d-live.json'),'utf8'));
  assert.equal(official.probeCompleted,false);assert.deepEqual(official.fields,[]);assert.equal(official.reason,'non_get_or_guard_failure');
  assert.equal(fs.existsSync(path.join(out,'structure.json')),false);safe(official);
});
test('each exact four-source/TIP mismatch and reused output stops before connection',async t=>{
  const root=fixtureRoot(t),out=path.join(root,'_temp-scripts','cms-row-d-location-structure-unit');
  readStructureConfig(['--tip',TIP,'--outdir',out],{},root);
  assert.throws(()=>readStructureConfig(['--tip','a'.repeat(40),'--outdir',out],{},root));
  for(const file of Object.keys(SOURCE_PINS)){
    const original=fs.readFileSync(path.join(root,file));fs.appendFileSync(path.join(root,file),'\n');
    assert.throws(()=>readStructureConfig(['--tip',TIP,'--outdir',out],{},root));fs.writeFileSync(path.join(root,file),original);
  }
  assert.throws(()=>readStructureConfig(['--tip',TIP,'--outdir',out],{REQUESTS_FILE:PRIVATE},root));
  assert.throws(()=>readStructureConfig(['--tip',TIP,'--outdir',path.join(root,'..','escaped')],{},root));
  fs.mkdirSync(out);let runs=0,stdout='';
  assert.equal(await main(['--tip',TIP,'--outdir',out],{},{root,run:async()=>{runs++;},stdout:{write:value=>{stdout+=value;}}}),2);
  assert.equal(runs,0);assert.equal(JSON.parse(stdout).captured,false);safe(JSON.parse(stdout));
});
for(const changePin of [false,true])test(`sidecar follows complete official final guard and stable external pin (change=${changePin})`,async t=>{
  const root=fixtureRoot(t),out=path.join(root,'_temp-scripts','cms-row-d-location-structure-result'),f=fake(t);let stdout='';
  const run=async()=>{const result=await f.run();if(changePin)fs.writeFileSync(path.join(root,'TIP_SHA.txt'),'b'.repeat(40));return result;};
  assert.equal(await main(['--tip',TIP,'--outdir',out],{},{root,run,stdout:{write:value=>{stdout+=value;}}}),2);
  assert.equal(fs.existsSync(path.join(out,'cms-row-d-live.json')),true);
  assert.equal(fs.existsSync(path.join(out,'structure.json')),!changePin);
  assert.equal(JSON.parse(stdout).captured,!changePin);
  if(!changePin){const report=JSON.parse(fs.readFileSync(path.join(out,'structure.json'),'utf8'));
    assert.equal(report.optionLabelsExposed,false);assert.equal(report.dictionaryComplete,false);assert.equal(report.bookD,false);safe(report);}
});
test('new diagnostic has no text/state/content/interaction or page iterator access',()=>{
  const source=inspectLocationStructure.toString();
  assert.doesNotMatch(source,/\.(?:textContent|innerHTML|outerHTML|value|checked|selectedText|selectedIndex|selectedOptions|matches|closest|contains|trim|getClientRects|getComputedStyle|click|focus|blur|dispatchEvent)\b/);
  assert.doesNotMatch(source,/getAttribute\(['"](?:value|checked|selected|aria-label|aria-selected|aria-checked|placeholder)['"]\)/);
  assert.doesNotMatch(source,/for\s*\([^)]*\bof\b|\.\.\./);
});

test('native Blink/V8 strict combined evaluation on an exclusively owned synthetic browser', {timeout:30000},async t=>{
  const chrome=process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';assert.ok(fs.existsSync(chrome));
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'r10-owned-strict-'));let child,session;
  const requests=[];
  try{
    child=spawn(chrome,['--headless=new','--disable-gpu','--disable-background-networking','--no-first-run',
      '--no-default-browser-check','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost',
      '--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
    let port;for(let i=0;i<100&&!port;i++){try{port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/u)[0]);}catch{}if(!port)await pause(80);}
    assert.ok(port);assert.ok(![9237,9239,9241,9242].includes(port));
    const targets=await fetch(`http://127.0.0.1:${port}/json/list`).then(reply=>reply.json());
    const pages=targets.filter(row=>row.type==='page'&&row.url==='about:blank');assert.equal(pages.length,1);
    let loaded;const ready=new Promise(resolve=>{loaded=resolve;});
    const fixture=html()+`<script>for(const node of document.querySelectorAll('*')){if(node.tagName!=='LABEL')for(const key of ['textContent','innerHTML','outerHTML','selectedText'])Object.defineProperty(node,key,{get(){throw Error('synthetic_forbidden_read')}});for(const key of ['value','checked','selectedIndex','selectedOptions'])Object.defineProperty(node,key,{get(){throw Error('synthetic_forbidden_read')}});}</script>`;
    session=await connectCdp(pages[0].webSocketDebuggerUrl,{timeoutMs:5000,onEvent:event=>{
      if(event.method==='Page.loadEventFired')loaded();
      if(event.method==='Fetch.requestPaused'){
        requests.push(event.params.request.url);
        const params=event.params,correct=params.request.url===ROW_D_PAGE&&params.request.method==='GET';
        const command=correct?session.send('Fetch.fulfillRequest',{requestId:params.requestId,responseCode:200,
          responseHeaders:[{name:'Content-Type',value:'text/html; charset=utf-8'}],body:Buffer.from(fixture).toString('base64')})
          :session.send('Fetch.failRequest',{requestId:params.requestId,errorReason:'BlockedByClient'});
        command.catch(()=>{});
      }
    }});
    await session.send('Page.enable');await session.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
    await session.send('Page.navigate',{url:ROW_D_PAGE});await ready;
    const params={expression:buildLocationStructureExpression(),returnByValue:true,awaitPromise:false,userGesture:false,throwOnSideEffect:true,timeout:5000};
    const reply=await session.send('Runtime.evaluate',params);assert.equal(reply.exceptionDetails,undefined,JSON.stringify(reply.exceptionDetails));
    const envelope=reply.result.value;assert.equal(envelope.inspection.reason,'row_d_preflight_incomplete');
    validateStructure(envelope.structure);assert.equal(envelope.structure.locations[0].hosts[0].reason,'linked_structure_observed');safe(envelope.structure);
    const refused=await session.send('Runtime.evaluate',{...params,expression:"document.body.setAttribute('data-r10-side-effect','forbidden')"});
    assert.ok(refused.exceptionDetails,'V8 must reject a deliberate mutation; never retry loosely');
    assert.ok(requests.includes(ROW_D_PAGE)); // Every navigation request was fulfilled locally before network.
    t.diagnostic('owned synthetic browser only; local Fetch fulfillment; real-site network requests=0; strict combined evaluation accepted; deliberate write rejected');
  }finally{
    session?.close();child?.kill();
    if(child&&child.exitCode===null)await Promise.race([new Promise(resolve=>child.once('exit',resolve)),pause(2000)]);
    const relative=path.relative(os.tmpdir(),profile);assert.ok(relative.startsWith('r10-owned-strict-')&&!path.isAbsolute(relative));
    fs.rmSync(profile,{recursive:true,force:true});
  }
});
