// Pure own-memory/session fixtures only: no browser, network or actual CDP.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import { ROW_D_PAGE } from '../scripts/lib/cms-row-d-options.mjs';
import { classifyStructureReply,runLocationStructure,main,SOURCE_PINS } from '../scripts/live/cms-row-d-location-structure.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const BASE='2d2bb79298aed283a30e99991ae2ad20d703dad4';
const PRIVATE='SYNTHETIC_PRIVATE_REASON_MUST_NOT_LEAK';
const REFUSALS=['wrong_page','document_unavailable','structure_limit_or_exception'];
const FLAGS={neverSave:true,liveSupportClaimed:false,livePassClaimed:false,
  writeStarted:false,mutationAllowed:false,valuesExposed:false,probeOnly:true};
const FAILURE_KEYS=['captured','reason','stopStage','stopCause',...Object.keys(FLAGS),'booked','bookD'].sort();
const STAGES=['configuration','official_run','official_evidence_write','source_recheck','capture_gate','sidecar_write'];
const CAUSES=['none','not_reached','official_stop','schema_invalid',...REFUSALS];
function safe(report){
  assert.ok(!JSON.stringify(report).includes(PRIVATE));
  assert.doesNotMatch(JSON.stringify(report),/stack|exceptionDetails|rawReason|profileHash|resumeId|webSocketDebuggerUrl/);
}
function fake(t,{structure,onSend,onWait,errorKind}={}){
  const dom=new JSDOM('',{url:ROW_D_PAGE,runScripts:'outside-only',pretendToBeVisual:true});
  t.after(()=>dom.window.close());
  Object.defineProperty(dom.window.document,'readyState',{get:()=> 'complete'});
  Object.defineProperty(dom.window.document,'visibilityState',{get:()=> 'visible'});
  const calls=[];let observer,waits=0;
  const emit=event=>observer(event);
  const deps={port:1,getTargets:async()=>[{type:'page',id:'own-memory',url:ROW_D_PAGE,
    webSocketDebuggerUrl:'ws://127.0.0.1:1/devtools/page/own-memory'}],
    connect:async(_url,options)=>{
      observer=options.onEvent;
      return {close(){calls.push('close');},async send(method,params){
        calls.push(method);const value=await onSend?.(method,params,{emit});if(value!==undefined)return value;
        if(method!=='Runtime.evaluate')return {};
        assert.equal(params.throwOnSideEffect,true);assert.equal(params.awaitPromise,false);assert.equal(params.userGesture,false);
        const reply={result:{value:dom.window.eval(params.expression)}};
        if(structure!==undefined)reply.result.value.structure=structure;
        if(errorKind==='strict')reply.exceptionDetails={text:PRIVATE};
        if(errorKind==='protocol')reply.error={message:PRIVATE};
        if(errorKind==='remote-object')reply.result.subtype='error';
        if(errorKind==='structure-getter')Object.defineProperty(reply.result.value,'structure',{get(){throw Error(PRIVATE);}});
        return reply;
      }};
    },wait:async()=>{await onWait?.(++waits,{emit});}};
  return {calls,run:()=>runLocationStructure(deps)};
}
function rootFixture(t){
  fs.mkdirSync(path.join(ROOT,'_temp-scripts'),{recursive:true});
  const root=fs.mkdtempSync(path.join(ROOT,'_temp-scripts','r11-stop-test-'));
  fs.mkdirSync(path.join(root,'_temp-scripts'));fs.writeFileSync(path.join(root,'TIP_SHA.txt'),BASE+'\n');
  for(const file of Object.keys(SOURCE_PINS)){
    const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});
    const text=fs.readFileSync(path.join(ROOT,file),'utf8').replace(/\r\n/gu,'\n');
    fs.writeFileSync(target,file.startsWith('scripts/')?text.replace(/\n/gu,'\r\n'):text);
  }
  t.after(()=>{assert.ok(path.relative(path.join(ROOT,'_temp-scripts'),root).startsWith('r11-stop-test-'));fs.rmSync(root,{recursive:true,force:true});});
  return root;
}
async function cli(t,f,{changePin=false,failWrite=false}={}){
  const root=rootFixture(t),out=path.join(root,'_temp-scripts','cms-row-d-location-structure-stop');let printed='';
  const exit=await main(['--tip',BASE,'--outdir',out],{},{root,run:async()=>{
    const result=await f.run();
    if(changePin)fs.writeFileSync(path.join(root,'TIP_SHA.txt'),PRIVATE);
    if(failWrite)fs.mkdirSync(path.join(out,'cms-row-d-live.json'));
    return result;
  },stdout:{write:text=>{printed+=text;}}});
  assert.equal(exit,2);const status=JSON.parse(printed);safe(status);
  if(!status.captured){assert.deepEqual(Object.keys(status).sort(),FAILURE_KEYS);assert.ok(STAGES.includes(status.stopStage));assert.ok(CAUSES.includes(status.stopCause));}
  return {root,out,status};
}

for(const reason of REFUSALS)test(`exact refusal is retained as a fixed enum: ${reason}`,()=>{
  const result=classifyStructureReply({captured:false,reason});
  assert.deepEqual(result,{stopCause:reason});assert.equal(result.structure,undefined);safe(result);
});
for(const payload of [null,[],{captured:false,reason:PRIVATE},{captured:false,reason:{private:PRIVATE}},
  {captured:false,reason:'wrong_page',locations:[]},{captured:false,reason:'wrong_page',secret:PRIVATE},
  {captured:0,reason:'wrong_page'},Object.assign(Object.create({captured:false}),{reason:'wrong_page'})])
test('unknown, injected, extra or inherited refusal payload is schema_invalid',()=>{
  assert.deepEqual(classifyStructureReply(payload),{stopCause:'schema_invalid'});
});
for(const key of ['captured','reason'])test(`refusal accessors are rejected without invoking the ${key} getter`,()=>{
  let reads=0;const value={captured:false,reason:'wrong_page'};
  Object.defineProperty(value,key,{enumerable:true,get(){reads++;throw Error(PRIVATE);}});
  assert.deepEqual(classifyStructureReply(value),{stopCause:'schema_invalid'});assert.equal(reads,0);
});
test('throwing descriptor/ownKeys proxies produce only schema_invalid',()=>{
  for(const proxy of [new Proxy({}, {getOwnPropertyDescriptor(){throw Error(PRIVATE);}}),
    new Proxy({captured:false,reason:'wrong_page'}, {ownKeys(){throw Error(PRIVATE);}})])
    assert.deepEqual(classifyStructureReply(proxy),{stopCause:'schema_invalid'});
});
for(const reason of REFUSALS)test(`safe official verdict preserves ${reason} without a structure file`,async t=>{
  const result=await cli(t,fake(t,{structure:{captured:false,reason}}));
  assert.equal(result.status.captured,false);assert.equal(result.status.stopStage,'capture_gate');assert.equal(result.status.stopCause,reason);
  const official=JSON.parse(fs.readFileSync(path.join(result.out,'cms-row-d-live.json'),'utf8'));
  assert.equal(official.probeCompleted,true);assert.equal(official.reason,'row_d_preflight_incomplete');
  assert.equal(fs.existsSync(path.join(result.out,'structure.json')),false);
});
test('unknown inner reason never reaches CLI stdout',async t=>{
  const result=await cli(t,fake(t,{structure:{captured:false,reason:PRIVATE}}));
  assert.equal(result.status.stopCause,'schema_invalid');assert.equal(fs.existsSync(path.join(result.out,'structure.json')),false);
});
for(const errorKind of ['strict','protocol','remote-object','structure-getter'])test(`official ${errorKind} rejection wins and preserves its original semantics`,async t=>{
  const f=fake(t,{structure:{captured:false,reason:'wrong_page'},errorKind}),result=await cli(t,f);
  assert.equal(result.status.stopCause,'official_stop');assert.equal(result.status.stopStage,'capture_gate');
  const official=JSON.parse(fs.readFileSync(path.join(result.out,'cms-row-d-live.json'),'utf8'));
  assert.equal(official.reason,errorKind==='strict'?'inspection_exception':'inspection_failed');
  assert.equal(official.probeCompleted,false);assert.deepEqual(official.fields,[]);
  assert.equal(f.calls.filter(name=>name==='Runtime.evaluate').length,1);
  assert.equal(fs.existsSync(path.join(result.out,'structure.json')),false);safe(official);
});
const post={method:'Network.requestWillBeSent',params:{requestId:'own-memory',request:{method:'POST',url:'https://example.invalid/'+PRIVATE}}};
for(const when of ['early','late','cleanup'])test(`unsafe ${when} official stop suppresses all inner reasons/structures`,async t=>{
  const f=fake(t,{structure:{captured:false,reason:'wrong_page'},onSend(method,params,{emit}){
    if(when==='early'&&method==='Target.activateTarget')emit(post);
    if(when==='cleanup'&&method==='Emulation.setFocusEmulationEnabled'&&params.enabled===false)throw Error(PRIVATE);
  },onWait(index,{emit}){if(when==='late'&&index===1)emit(post);}}),result=await cli(t,f);
  assert.equal(result.status.stopCause,'official_stop');assert.equal(fs.existsSync(path.join(result.out,'structure.json')),false);
  const official=JSON.parse(fs.readFileSync(path.join(result.out,'cms-row-d-live.json'),'utf8'));
  assert.equal(official.reason,when==='cleanup'?'visibility_keeper_cleanup_failed':'non_get_or_guard_failure');safe(official);
});
test('valid earlier structure is also suppressed by a late unsafe official result',async t=>{
  const f=fake(t,{onWait(index,{emit}){if(index===1)emit(post);}}),result=await f.run();
  assert.equal(result.captured,false);assert.equal(result.structure,undefined);assert.equal(result.stopCause,'official_stop');
});
for(const mode of ['source-change','evidence-IO'])test(`source/IO failure reports only a fixed outer stage: ${mode}`,async t=>{
  const result=await cli(t,fake(t),{changePin:mode==='source-change',failWrite:mode==='evidence-IO'});
  assert.equal(result.status.captured,false);assert.equal(result.status.stopStage,mode==='source-change'?'source_recheck':'official_evidence_write');
  assert.equal(fs.existsSync(path.join(result.out,'structure.json')),false);
});
test('initial source/config rejection stays fixed and cannot connect',async t=>{
  const root=rootFixture(t);fs.writeFileSync(path.join(root,'TIP_SHA.txt'),PRIVATE);let runs=0,printed='';
  await main(['--tip',BASE,'--outdir',path.join(root,'_temp-scripts','cms-row-d-location-structure-stop')],{},
    {root,run:async()=>{runs++;},stdout:{write:text=>{printed+=text;}}});
  const status=JSON.parse(printed);assert.equal(runs,0);assert.equal(status.stopStage,'configuration');assert.equal(status.stopCause,'not_reached');safe(status);
});
test('caller-injected cause/stage metadata cannot escape the closed stdout contract',async t=>{
  const root=rootFixture(t),out=path.join(root,'_temp-scripts','cms-row-d-location-structure-injected'),f=fake(t);let printed='';
  await main(['--tip',BASE,'--outdir',out],{},{root,run:async()=>({...await f.run(),captured:false,structure:undefined,stopCause:PRIVATE,stopStage:PRIVATE}),stdout:{write:text=>{printed+=text;}}});
  const status=JSON.parse(printed);assert.equal(status.stopCause,'schema_invalid');assert.equal(status.stopStage,'capture_gate');
  assert.deepEqual(Object.keys(status).sort(),FAILURE_KEYS);assert.equal(fs.existsSync(path.join(out,'structure.json')),false);safe(status);
});
test('successful official verdict and retained structure stay identical to R10',async t=>{
  const f=fake(t),result=await f.run(),written=await cli(t,fake(t));
  assert.equal(result.captured,true);assert.equal(result.stopCause,'none');assert.equal(written.status.captured,true);
  assert.equal(fs.readFileSync(path.join(written.out,'cms-row-d-live.json'),'utf8'),JSON.stringify(result.official,null,2)+'\n');
  const sidecar=JSON.parse(fs.readFileSync(path.join(written.out,'structure.json'),'utf8'));
  assert.deepEqual(sidecar.diagnostics,result.structure);assert.equal(sidecar.dictionaryComplete,false);assert.equal(sidecar.bookD,false);
});
test('DOM function, expression, success schema, final guard and four shared dependencies are byte unchanged',()=>{
  const file='scripts/live/cms-row-d-location-structure.mjs',old=execFileSync('git',['show',BASE+':'+file],{cwd:ROOT,encoding:'utf8'}),now=fs.readFileSync(path.join(ROOT,file),'utf8');
  for(const [start,end] of [['export function inspectLocationStructure','\nconst ROW_REASONS'],
    ['export function validateStructure','\nexport function buildLocationStructureExpression'],
    ['export function buildLocationStructureExpression','\nexport function cleanCaptureAllowed'],
    ['export function cleanCaptureAllowed','\nexport async function runLocationStructure']]){
    assert.equal(now.slice(now.indexOf(start),now.indexOf(end)),old.slice(old.indexOf(start),old.indexOf(end)));
  }
  for(const file of Object.keys(SOURCE_PINS)){
    const base=execFileSync('git',['show',BASE+':'+file],{cwd:ROOT,encoding:'utf8'}).replace(/\r\n/gu,'\n');
    assert.equal(fs.readFileSync(path.join(ROOT,file),'utf8').replace(/\r\n/gu,'\n'),base);
  }
});
