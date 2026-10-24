// Entire real options UI, own jsdom DOM and in-memory Chrome storage only.
// Imports are bound to real modules; only the terminal init promise is observed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import * as store from '../../src/profile/store.js';

const optionsUrl=new URL('../../src/profile/options.js',import.meta.url);
const original=fs.readFileSync(optionsUrl,'utf8');
const imports=[...original.matchAll(/^import \{([^\n]+)\} from '([^']+)';$/gmu)];
assert.equal(imports.length,8);
const modules=Object.fromEntries(await Promise.all(imports.map(async match=>[match[2],await import(new URL(match[2],optionsUrl))])));
const source=original.replace(/^import \{([^\n]+)\} from '([^']+)';$/gmu,
  (_all,names,from)=>`const {${names}}=globalThis.__profileModules[${JSON.stringify(from)}];`)
  .replace(/\binit\(\);\s*$/u,'globalThis.__salaryUi={ready:init(),settled:()=>saveQueue,draft:()=>structuredClone(profile)};');
const markup=fs.readFileSync(new URL('../../src/profile/options.html',import.meta.url),'utf8');
const clone=value=>structuredClone(value);

export function installSyntheticStore(t,input){
  const data={resumeProfile:store.normalizeProfile(input),resumeProfileLifecycle:{version:1,
    epoch:'00000000-0000-4000-8000-000000000001',state:'ready'}};
  const state={writes:0,lockCalls:0,failProfileSet:false,data};
  const local={async get(keys){
    const names=keys===null?Object.keys(data):Array.isArray(keys)?keys:typeof keys==='string'?[keys]:Object.keys(keys);
    return Object.fromEntries(names.filter(key=>Object.hasOwn(data,key)).map(key=>[key,clone(data[key])]));
  },async set(values){
    if(Object.hasOwn(values,'resumeProfile')&&state.failProfileSet)throw Error('synthetic_storage_failure');
    state.writes++;for(const [key,value]of Object.entries(values))data[key]=clone(value);
  },async remove(keys){for(const key of Array.isArray(keys)?keys:[keys])delete data[key];}};
  const descriptors=Object.fromEntries(['chrome','navigator'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const chrome={storage:{local,onChanged:{addListener(){}}}};
  Object.defineProperty(globalThis,'chrome',{configurable:true,value:chrome});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{async request(name,options,work){
    assert.equal(name,'resume-profile-lifecycle-v1');assert.equal(options.mode,'exclusive');state.lockCalls++;return work();
  }}}});
  t.after(()=>{for(const [key,descriptor]of Object.entries(descriptors)){
    if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
  }});
  return {...state,state,local,chrome,read:()=>clone(data.resumeProfile)};
}
export async function openSalaryProfileUi(t,input){
  const memory=installSyntheticStore(t,input);let dom;
  const start=async()=>{
    dom=new JSDOM(markup,{url:'https://synthetic-options.invalid/',runScripts:'outside-only',pretendToBeVisual:true});
    const w=dom.window;w.__profileModules=modules;w.chrome=memory.chrome;w.structuredClone=clone;
    w.confirm=()=>true;w.console.error=()=>{};
    w.eval('"use strict";\n'+source);await w.__salaryUi.ready;
  };
  await start();t.after(()=>dom.window.close());
  const settle=async()=>{await Promise.resolve();await dom.window.__salaryUi.settled();await Promise.resolve();};
  const click=async selector=>{const node=dom.window.document.querySelector(selector);assert.ok(node,selector);node.click();await settle();};
  const experience=async()=>{await click('[data-section="experience"]');assert.equal(dom.window.document.getElementById('section-title').textContent,'工作与实习');};
  await experience();
  return {memory,get window(){return dom.window;},get document(){return dom.window.document;},click,settle,
    async edit(value,index=0){const node=dom.window.document.querySelector(`[data-list="experience"][data-index="${index}"][data-field="salary"]`);assert.ok(node);
      node.value=value;node.dispatchEvent(new dom.window.Event('input',{bubbles:true}));node.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await settle();},
    async confirm(){if(!dom.window.document.getElementById('review-check').checked)await click('#review-check');await click('#confirm-button');},
    async flush(){await click('#save-draft-button');},draft:()=>dom.window.__salaryUi.draft(),
    async reload(){dom.window.close();await start();await experience();}};
}
