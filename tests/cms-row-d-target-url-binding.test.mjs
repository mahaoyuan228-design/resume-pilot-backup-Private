// Own synthetic DOM/session fixtures only. No actual target discovery or facts.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { ROW_D_PAGE } from '../scripts/lib/cms-row-d-options.mjs';
import { runCmsRowDLive } from '../scripts/live/cms-row-d-live.mjs';
import { inspectLocationStructure,buildLocationStructureExpression,runLocationStructure,
  readStructureConfig,main,SOURCE_PINS } from '../scripts/live/cms-row-d-location-structure.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const BASE='eee0ad1414878ccb1d72e746d04daa55c392aaf5';
const PRIVATE='SYNTHETIC_R12_PRIVATE_URL_MUST_NOT_LEAK';
const FULL=ROW_D_PAGE+'?resumeId='+PRIVATE+'&literal=%22%5C%3B%28#'+PRIVATE;
const socket=id=>'ws://127.0.0.1:9242/devtools/page/'+id;
const target=(url=FULL,id='owned-r12')=>({type:'page',id,url,webSocketDebuggerUrl:socket(id)});
function html(){
  return '<!doctype html><body><section class="form-cell" id="13">'
    +['13_100701_0','13_100702_0'].map((id,index)=>`<div id="${id}"><div class="ant-form-item"><div class="ant-form-item-label"><label>意向${index?'二':'一'}：期望工作地点*</label></div><div class="cascader-plugins-wrap">${[0,1].map(()=>'<div class="ant-select"><div class="ant-select-selection" role="combobox"><span class="ant-select-search"><input type="text" class="ant-select-search__field" style="display:none" value="SYNTHETIC_FIELD_VALUE"></span></div></div>').join('')}</div></div></div>`).join('')+'</section></body>';
}
function fixture(t,{url=FULL,inventory=[target()],onDiscover,onConnect,onSend,onWait}={}){
  const dom=new JSDOM(html(),{url,runScripts:'outside-only',pretendToBeVisual:true});
  t.after(()=>dom.window.close());
  Object.defineProperty(dom.window.document,'readyState',{get:()=> 'complete'});
  Object.defineProperty(dom.window.document,'visibilityState',{get:()=> 'visible'});
  const calls=[];let observer,waits=0;
  const emit=event=>observer(event);
  const deps={getTargets:async(...args)=>{calls.push({method:'getTargets',args});await onDiscover?.(inventory);return inventory;},
    connect:async(url,options)=>{
      calls.push({method:'connect',url,options});observer=options.onEvent;await onConnect?.({inventory,url,options});
      return {close(){calls.push({method:'close'});},async send(method,params={},sendOptions){
        calls.push({method,params,sendOptions});const override=await onSend?.(method,params,{emit});
        if(override!==undefined)return override;
        if(method==='Runtime.enable')emit({method:'Runtime.executionContextCreated',params:{context:{id:71,auxData:{isDefault:true,frameId:'top-frame'}}}});
        if(method==='Page.getFrameTree')return {frameTree:{frame:{id:'top-frame',url:ROW_D_PAGE}}};
        return method==='Runtime.evaluate'?{result:{value:dom.window.eval(params.expression)}}:{};
      }};
    },wait:async()=>{await onWait?.(++waits,{emit});}};
  return {dom,calls,deps,inventory,run:extra=>runLocationStructure({...deps,...extra})};
}
function safe(value){assert.ok(!JSON.stringify(value).includes(PRIVATE));}
function count(f,method){return f.calls.filter(row=>row.method===method).length;}
function rootFixture(t){
  fs.mkdirSync(path.join(ROOT,'_temp-scripts'),{recursive:true});
  const root=fs.mkdtempSync(path.join(ROOT,'_temp-scripts','r12-url-test-'));
  fs.mkdirSync(path.join(root,'_temp-scripts'));fs.writeFileSync(path.join(root,'TIP_SHA.txt'),BASE+'\n');
  for(const file of Object.keys(SOURCE_PINS)){
    const dest=path.join(root,file);fs.mkdirSync(path.dirname(dest),{recursive:true});
    const lf=fs.readFileSync(path.join(ROOT,file),'utf8').replace(/\r\n/gu,'\n');
    fs.writeFileSync(dest,file.startsWith('scripts/')?lf.replace(/\n/gu,'\r\n'):lf);
  }
  t.after(()=>{assert.ok(path.relative(path.join(ROOT,'_temp-scripts'),root).startsWith('r12-url-test-'));fs.rmSync(root,{recursive:true,force:true});});
  return root;
}

for(const url of [ROW_D_PAGE,FULL,ROW_D_PAGE+'?literal=%2f#same',ROW_D_PAGE+'?a=1&b=2#same',
  ROW_D_PAGE+'?quote=\";globalThis.syntheticInjected=true;//#'+PRIVATE])
test('exact same-discovery full URL is used only by the combined strict expression',async t=>{
  const canonical=new URL(url).href,f=fixture(t,{url:canonical,inventory:[target(canonical)]}),result=await f.run();
  assert.equal(result.captured,true);assert.equal(result.stopCause,'none');safe(result);
  assert.equal(f.dom.window.syntheticInjected,undefined);
  assert.equal(count(f,'getTargets'),1);assert.equal(count(f,'connect'),1);assert.equal(count(f,'Runtime.evaluate'),1);
  const evaluation=f.calls.find(row=>row.method==='Runtime.evaluate');
  assert.equal(evaluation.params.throwOnSideEffect,true);assert.equal(evaluation.params.awaitPromise,false);
  assert.equal(evaluation.params.userGesture,false);assert.equal(evaluation.params.returnByValue,true);
  assert.deepEqual(f.calls.find(row=>row.method==='getTargets').args,[9242,'/json/list',{timeoutMs:10000,step:'target_discovery'}]);
  assert.equal(f.calls.find(row=>row.method==='connect').url,socket('owned-r12'));
  assert.deepEqual(f.calls.find(row=>row.method==='Target.activateTarget').params,{targetId:'owned-r12'});
  assert.equal(f.calls.at(-1).method,'close');
});
for(const [selected,current] of [[FULL,ROW_D_PAGE],[FULL,FULL.replace('literal=','changed=')],
  [FULL,FULL.replace('#'+PRIVATE,'#different')],[ROW_D_PAGE+'?a=1&b=2',ROW_D_PAGE+'?b=2&a=1'],
  [ROW_D_PAGE+'?literal=%2f',ROW_D_PAGE+'?literal=%2F'],[ROW_D_PAGE+'#anchor',ROW_D_PAGE]])
test('same origin/path with a changed full suffix is refused before diagnostic tree access',t=>{
  let reads=0;const doc={defaultView:{location:{href:current}},querySelectorAll(){reads++;throw Error(PRIVATE);}};
  assert.deepEqual(inspectLocationStructure(doc,selected),{captured:false,reason:'wrong_page'});assert.equal(reads,0);
});
test('full URL drift after structural reads drops every partial row',t=>{
  const f=fixture(t);let hrefReads=0,queries=0;
  const doc={defaultView:{location:{get href(){return ++hrefReads===1?FULL:FULL+'changed';}}},
    visibilityState:'visible',readyState:'complete',querySelectorAll(selector){queries++;return f.dom.window.document.querySelectorAll(selector);}};
  const result=inspectLocationStructure(doc,FULL);
  assert.deepEqual(result,{captured:false,reason:'wrong_page'});assert.equal(hrefReads,2);assert.ok(queries>0);safe(result);
});
test('raw target URL is not canonicalized to make a serialized href match',async t=>{
  const raw=ROW_D_PAGE.replace('https://','HTTPS://')+'?marker='+PRIVATE;
  const f=fixture(t,{url:raw,inventory:[target(raw)]}),result=await f.run();
  assert.equal(result.captured,false);assert.equal(result.stopCause,'wrong_page');
  assert.equal(result.official.probeCompleted,true);safe(result);
});
test('mismatch keeps the original official verdict and never selects a replacement',async t=>{
  const f=fixture(t,{url:FULL+'changed'}),result=await f.run();
  assert.equal(result.captured,false);assert.equal(result.structure,undefined);assert.equal(result.stopCause,'wrong_page');
  assert.equal(result.official.reason,'row_d_preflight_incomplete');assert.equal(result.official.probeCompleted,true);
  assert.equal(count(f,'getTargets'),1);assert.equal(count(f,'Runtime.evaluate'),1);safe(result);
});
test('successful selection freezes only ordinary inventory records and preserves all entries and fields',async t=>{
  const nested={private:PRIVATE},extra={type:'service_worker',url:'https://example.invalid/'+PRIVATE,metadata:nested};
  const inventory=[extra,target(),null,7,false,'ignored'],before=JSON.stringify(inventory);
  const f=fixture(t,{inventory,onConnect({inventory,url}){
    assert.equal(Object.isFrozen(inventory),true);for(const row of [extra,inventory[1]])assert.equal(Object.isFrozen(row),true);
    assert.equal(Object.isFrozen(nested),false);assert.equal(JSON.stringify(inventory),before);
    assert.equal(Reflect.set(inventory[1],'url',FULL+'changed'),false);
    assert.equal(Reflect.set(inventory[1],'webSocketDebuggerUrl',socket('replacement')),false);
    assert.equal(Reflect.set(inventory,1,target(FULL,'replacement')),false);assert.equal(url,socket('owned-r12'));
  }}),result=await f.run();
  assert.equal(result.captured,true);assert.equal(count(f,'connect'),1);safe(result);
});
for(const kind of ['date','custom-prototype','array-record','function-entry','record-proxy','array-proxy','accessor'])
test('non-JSON inventory is stopped without freezing arbitrary objects: '+kind,async t=>{
  let frozenAttempts=0,getterReads=0;const base=target();let other,inventory;
  if(kind==='date')other=new Date(0);
  if(kind==='custom-prototype')other=Object.assign(Object.create({}),{type:'other'});
  if(kind==='array-record')other=[];
  if(kind==='function-entry')other=()=>{};
  if(kind==='record-proxy')other=new Proxy({type:'other'},{preventExtensions(){frozenAttempts++;throw Error(PRIVATE);}});
  if(kind==='accessor'){other={type:'other'};Object.defineProperty(other,'private',{get(){getterReads++;throw Error(PRIVATE);}});}
  inventory=kind==='array-proxy'?new Proxy([base],{preventExtensions(){frozenAttempts++;throw Error(PRIVATE);}}):[base,other];
  const f=fixture(t,{inventory}),result=await f.run();
  assert.equal(result.official.reason,'target_discovery_failed');assert.equal(result.stopCause,'official_stop');
  assert.equal(result.captured,false);assert.equal(count(f,'connect'),0);assert.equal(count(f,'Runtime.evaluate'),0);
  assert.equal(Object.isFrozen(base),false);assert.equal(frozenAttempts,0);assert.equal(getterReads,0);safe(result);
});
for(const inventory of [null,{},[],[target(ROW_D_PAGE+'/extra')],
  [target(FULL,'one'),target(FULL+'changed','two')],
  [target(FULL.replace('https://','https://user:secret@'))],
  [{...target(),webSocketDebuggerUrl:socket('wrong-id')}],
  [{...target(),webSocketDebuggerUrl:'ws://example.invalid:9242/devtools/page/owned-r12'}]])
test('original target selection failure is returned unchanged without freezing or attaching',async t=>{
  const expected=await runCmsRowDLive({getTargets:async()=>inventory,connect:async()=>{throw Error('must not attach');}});
  const f=fixture(t,{inventory}),result=await f.run();
  assert.deepEqual(result.official,expected);assert.equal(result.stopCause,'official_stop');assert.equal(count(f,'connect'),0);
  if(inventory&&typeof inventory==='object')assert.equal(Object.isFrozen(inventory),false);
  if(Array.isArray(inventory))for(const row of inventory)assert.equal(Object.isFrozen(row),false);safe(result);
});
test('getTargets rejection keeps its original stage with no private exception output',async t=>{
  const f=fixture(t,{onDiscover(){throw Error(PRIVATE);}}),result=await f.run();
  assert.equal(result.official.reason,'target_discovery_failed');assert.equal(result.stopCause,'official_stop');
  assert.equal(count(f,'getTargets'),1);assert.equal(count(f,'connect'),0);safe(result);
});
test('caller expected URL is ignored and cannot replace discovery provenance',async t=>{
  const f=fixture(t),result=await f.run({expectedFullUrl:ROW_D_PAGE,expectedPage:ROW_D_PAGE});
  assert.equal(result.captured,true);safe(result);
  assert.throws(()=>buildLocationStructureExpression(),/target_binding_invalid/);
  assert.throws(()=>readStructureConfig(['--tip',BASE,'--outdir','ignored','--expected-url',FULL]),/config_invalid/);
});
test('combined official output is identical to the original runner on the same fixture',async t=>{
  const original=await runCmsRowDLive(fixture(t).deps),combined=await fixture(t).run();
  assert.equal(JSON.stringify(combined.official),JSON.stringify(original));safe(combined);
});
for(const mode of ['strict','protocol','late-guard'])test('full URL binding never rescues an unsafe original result: '+mode,async t=>{
  const f=fixture(t,{onSend(method){if(method==='Runtime.evaluate'&&mode!=='late-guard')return mode==='strict'
    ?{exceptionDetails:{text:PRIVATE}}:{error:{message:PRIVATE}};},onWait(index,{emit}){
    if(mode==='late-guard'&&index===1)emit({method:'Network.requestWillBeSent',params:{requestId:PRIVATE,
      request:{method:'POST',url:'https://example.invalid/'+PRIVATE}}});
  }}),result=await f.run();
  assert.equal(result.captured,false);assert.equal(result.structure,undefined);assert.equal(result.stopCause,'official_stop');
  assert.equal(result.official.reason,mode==='strict'?'inspection_exception':mode==='protocol'?'inspection_failed':'non_get_or_guard_failure');
  assert.equal(count(f,'Runtime.evaluate'),1);safe(result);
});
for(const mode of ['success','wrong-page','unsafe'])test('URL sentinels never reach stdout or any JSON evidence: '+mode,async t=>{
  const root=rootFixture(t),out=path.join(root,'_temp-scripts','cms-row-d-location-structure-r12');let printed='';
  const f=fixture(t,{url:mode==='wrong-page'?FULL+'changed':FULL,onSend(method){
    if(mode==='unsafe'&&method==='Runtime.evaluate')return {exceptionDetails:{text:PRIVATE}};
  }});
  const exit=await main(['--tip',BASE,'--outdir',out],{},{root,run:f.run,stdout:{write:text=>{printed+=text;}}});
  assert.equal(exit,2);safe(printed);const status=JSON.parse(printed);safe(status);
  assert.equal(status.captured,mode==='success');
  if(mode!=='success')assert.equal(status.stopCause,mode==='wrong-page'?'wrong_page':'official_stop');
  assert.equal(fs.existsSync(path.join(out,'structure.json')),mode==='success');
  for(const file of fs.readdirSync(out))safe(fs.readFileSync(path.join(out,file),'utf8'));
});
test('only the second exact-href check changes DOM reads; R11/schema/guard/IO and reviewed dependency pins stay exact',()=>{
  const file='scripts/live/cms-row-d-location-structure.mjs';
  const old=execFileSync('git',['show',BASE+':'+file],{cwd:ROOT,encoding:'utf8'}).replace(/\r\n/gu,'\n');
  const now=fs.readFileSync(path.join(ROOT,file),'utf8').replace(/\r\n/gu,'\n');
  const block=(s,start,end)=>s.slice(s.indexOf(start),s.indexOf(end));
  const added="    if(doc.defaultView.location.href!==expectedPage)return {captured:false,reason:'wrong_page'};\n";
  assert.equal(block(now,'export function inspectLocationStructure','\nconst ROW_REASONS').replace(added,''),
    block(old,'export function inspectLocationStructure','\nconst ROW_REASONS'));
  for(const [start,end] of [['const ROW_REASONS','export function buildLocationStructureExpression'],
    ['export function verifySources','\nif(process.argv[1]']])assert.equal(block(now,start,end),block(old,start,end));
  assert.equal(block(now,'export function cleanCaptureAllowed','\n// getJson owns'),block(old,'export function cleanCaptureAllowed','\nexport async function runLocationStructure'));
  for(const file of Object.keys(SOURCE_PINS)){
    const current=fs.readFileSync(path.join(ROOT,file),'utf8').replace(/\r\n/gu,'\n');
    if(file==='scripts/live/cms-row-d-live.mjs'||file==='scripts/lib/cms-row-d-options.mjs'
      ||file==='scripts/lib/cms-row-d-calendar.mjs'){
      // Keep the reviewed options/runner dependencies' deployed CRLF bytes pinned.
      assert.equal(createHash('sha256').update(current.replace(/\n/gu,'\r\n')).digest('hex'),SOURCE_PINS[file]);
      continue;
    }
    if(file==='tools/live-harvest/cdp-client.mjs'){
      // The reviewed timeout cleanup change uses the actual deployed LF bytes.
      const bytes=fs.readFileSync(path.join(ROOT,file));
      assert.equal(bytes.toString('utf8'),current);
      assert.equal(createHash('sha256').update(bytes).digest('hex'),SOURCE_PINS[file]);
      continue;
    }
    assert.equal(current,execFileSync('git',['show',BASE+':'+file],{cwd:ROOT,encoding:'utf8'}).replace(/\r\n/gu,'\n'));
  }
});
