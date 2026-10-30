// Offline synthetic scaffold only. No real profile, browser, CDP or site used.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { captureProfileBinding, installProfileBindingBridge } from '../src/profile/profile-lifecycle.js';
import { RESEARCH_CHOICES } from '../src/profile/site-question-templates.js';

const PAGE='https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';
const SECTION='求职意向必填',QUESTION='期望工作性质';
const RESEARCH='如应聘研究发展中心行业研究类岗位请勾选（建议仅勾选3~5项）';
const ID='offline-row-d-product-runtime';
const sources=await Promise.all(['src/core/matcher.js','src/content/cms-checkboxes.js','src/content/engine.js'].map(file=>fs.readFile(file,'utf8')));
function profile(target='expectedWorkNature',answer=target==='expectedWorkNature'?'全职':'["宏观","策略"]') {
  const question=target==='expectedWorkNature'?QUESTION:RESEARCH;
  return {schemaVersion:1,customFacts:[{question,answer,sitePageUrl:PAGE,sectionName:SECTION,rowContext:'single'}],
    customAnswers:{[question]:answer},confirmedFields:[`customAnswers.${question}`],education:[{},{}],
    unrelated:'offline private sentinel'};
}
async function harness(t,{target='expectedWorkNature',current,raw=profile(target),url=PAGE,html,alter,ready=true}={}) {
  const research=target==='researchInterests';
  const selected=current===undefined?(research?['宏观','策略']:'全职'):current;
  const control=research?`<div class="ant-checkbox-group">${RESEARCH_CHOICES.map(text=>`<label class="ant-checkbox-wrapper"><span class="ant-checkbox"><input type="checkbox"${selected.includes(text)?' checked':''}></span><span>${text}</span></label>`).join('')}</div>`:
    `<div class="ant-select"><div class="ant-select-selection ant-select-selection--single" role="combobox"><div class="ant-select-selection-selected-value">${selected}</div><input type="text" style="display:none"></div></div>`;
  const wrapper=research?'13_102501_0':'13_43_0';
  const dom=new JSDOM(`<!doctype html><form id="fixture-form"><section class="form-cell" id="11"><div class="tit-wrap"><div class="tit">个人基本信息必填</div></div></section><section class="form-cell" id="13"><div class="tit-wrap"><div class="tit">${SECTION}</div></div><div class="form-cell-right"><div class="form-cell-inner"><div id="${wrapper}"><div class="ant-form-item"><div class="ant-form-item-label"><label>${research?RESEARCH:QUESTION}*</label></div><div class="ant-form-item-control">${html??control}</div></div></div></div></div></section><section class="form-cell" id="14"><div class="tit-wrap"><div class="tit">教育经历必填</div></div><button type="button" data-add-record="education">添加</button></section><div class="ant-form-item"><div class="ant-form-item-label"><label>离线其它字段</label></div><input id="outside" value="offline outside sentinel"><input id="outside-check" type="checkbox"><input id="outside-file" type="file"></div><button type="button" id="save">保存</button></form>`,{url,runScripts:'dangerously',pretendToBeVisual:true});
  t.after(()=>dom.window.close());
  const {window}=dom,{document}=window;
  window.Element.prototype.getClientRects=function(){return this.isConnected?[{}]:[];};
  Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});
  document.hasFocus=()=>true;
  const counts={click:0,focus:0,blur:0,input:0,change:0,submit:0,setter:0,outsideRead:0,resolveFact:0,classify:0};
  for(const type of ['click','focus','blur','input','change','submit'])document.addEventListener(type,()=>counts[type]++,true);
  for(const name of ['click','focus','blur'])window.HTMLElement.prototype[name]=()=>{counts[name]++;throw Error('writer reached');};
  const valueDescriptor=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');
  Object.defineProperty(window.HTMLInputElement.prototype,'value',{...valueDescriptor,set(value){counts.setter++;throw Error('setter reached');}});
  for(const id of ['outside','outside-check','outside-file'])for(const key of ['value','checked','files']) {
    Object.defineProperty(document.getElementById(id),key,{configurable:true,get(){counts.outsideRead++;throw Error('outside read');}});
  }
  let state={resumeProfile:structuredClone(raw),resumeProfileLifecycle:{version:1,state:ready?'ready':'changing',epoch:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'}};
  const getKeys=[],messages=[];
  let onGet=()=>{},onMessage=()=>{};
  const storage={get:async keys=>{
    getKeys.push(keys);await onGet(keys,getKeys.length,state);
    assert.ok((Array.isArray(keys)?keys:[keys]).every(key=>['resumeProfile','resumeProfileLifecycle'].includes(key)));
    return Object.fromEntries((Array.isArray(keys)?keys:[keys]).filter(key=>Object.hasOwn(state,key)).map(key=>[key,structuredClone(state[key])]));
  },set(){throw Error('storage write');},remove(){throw Error('storage remove');}};
  const binding=ready?await captureProfileBinding(storage):{version:1,epoch:state.resumeProfileLifecycle.epoch,profileHash:'a'.repeat(64)};
  getKeys.length=0;
  let bridge;
  const api={runtime:{id:ID,onMessage:{addListener:listener=>{bridge=listener;}}},storage:{local:storage},tabs:{get:async()=>({url})}};
  installProfileBindingBridge({api});
  const sender={id:ID,url,frameId:0,tab:{id:7,url}};
  const bridgeCall=(message,source=sender)=>new Promise(resolve=>{bridge(message,source,resolve);});
  const listeners=new Set();
  window.chrome={runtime:{id:ID,sendMessage:async message=>{
    messages.push(message);await onMessage(message,messages.length);
    return bridgeCall(message);
  },onMessage:{addListener:listener=>listeners.add(listener),removeListener:listener=>listeners.delete(listener),hasListener:listener=>listeners.has(listener),hasListeners:()=>!!listeners.size}}};
  window.ResumeCmsSession={check:async()=>({authenticated:true})};
  sources.forEach(source=>window.eval(source));
  const resolve=window.ResumeCmsCheckboxes.resolveFact;
  window.ResumeCmsCheckboxes={...window.ResumeCmsCheckboxes,resolveFact(...args){counts.resolveFact++;return resolve(...args);},fillCheckboxes(){throw Error('adapter writer reached');}};
  const classify=window.ResumeMatcher.classify;
  window.ResumeMatcher.classify=(...args)=>{counts.classify++;return classify(...args);};
  const invoke=(message,source={id:ID})=>new Promise(resolve=>window.__resumeQuickFillEngineListener(message,source,resolve));
  const run=(extra={})=>invoke({type:'CMS_ROW_D_PREEXISTING_TRIAL',target,profileBinding:binding,...extra});
  const safety=()=>{
    for(const key of ['click','focus','blur','input','change','submit','setter','outsideRead'])assert.equal(counts[key],0,key);
    assert.equal(window.ResumeProfileWriteContext,undefined);
    assert.equal(window.__resumeQuickFillFillState.pending,false);
  };
  alter?.(document,window);
  return {window,document,run,invoke,binding,storage,bridgeCall,messages,getKeys,counts,safety,
    setState:work=>work(state),setGetHook:hook=>{onGet=hook;},setMessageHook:hook=>{onMessage=hook;},target};
}

for(const target of ['expectedWorkNature','researchInterests'])test(`${target}: actual product parser/comparator preserves complete same value`,async t=>{
  const h=await harness(t,{target}),result=await h.run();
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.data.reason,'preexisting_same_value');
  assert.equal(result.data.adapterWriteVerified,false);assert.equal(result.data.liveSupportClaimed,false);
  assert.equal(result.data.valuesExposed,false);assert.ok(h.counts.classify>=2);
  if(target==='researchInterests')assert.ok(h.counts.resolveFact>=2);
  for(const key of ['offline private sentinel','offline outside sentinel','currentValue','customFacts',h.binding.profileHash])assert.ok(!JSON.stringify(result).includes(key));
  assert.ok(h.messages.some(message=>message.type==='RESUME_CMS_ROW_D_TRIAL_FACT'));
  h.safety();
});
for(const [target,current,reason] of [
  ['expectedWorkNature','','trial_current_empty'],['expectedWorkNature','实习','trial_current_not_equal'],
  ['researchInterests',[],'trial_current_empty'],['researchInterests',['宏观'],'trial_current_not_equal'],
  ['researchInterests',['宏观','策略','债券'],'trial_current_not_equal']
])test(`${target} preserves and rejects empty/different/partial ${JSON.stringify(current)}`,async t=>{
  const h=await harness(t,{target,current}),result=await h.run();assert.equal(result.ok,false);assert.equal(result.error,reason);h.safety();
});
for(const extra of [{profile:profile()},{answer:'全职'},{attachment:{}},{photoUploads:{}},{scope:{}},{preexistingOnly:false},{target:'expectedLocation1'},{target:'calendar'}])test(`external payload is rejected before DOM: ${Object.keys(extra)}`,async t=>{
  const h=await harness(t);h.document.querySelectorAll=()=>{throw Error('DOM read before request validation');};
  const result=await h.run(extra);assert.equal(result.error,'trial_request_invalid');assert.equal(h.messages.length,0);h.safety();
});
test('effective actual binding plus a different fixture profile cannot enter DOM',async t=>{
  const h=await harness(t);const result=await h.run({profile:profile('expectedWorkNature','实习')});
  assert.equal(result.error,'trial_request_invalid');assert.equal(h.messages.length,0);h.safety();
});
for(const mutation of [
  value=>{delete value.resumeProfile;},value=>{delete value.resumeProfileLifecycle;},
  value=>{value.resumeProfileLifecycle.epoch='legacy';},value=>{value.resumeProfileLifecycle.state='changing';},
  value=>{value.resumeProfile.schemaVersion=2;},value=>{value.resumeProfile.customFacts[0].answer='实习';},
  value=>{value.resumeProfile.customFacts.push({...value.resumeProfile.customFacts[0]});},
  value=>{value.resumeProfile.confirmedFields=[];},value=>{value.resumeProfile.customFacts[0].rowContext='multiple';}
])test('missing/notready/drifted actual profile refuses before any DOM access',async t=>{
  const h=await harness(t);h.setState(mutation);h.document.querySelectorAll=()=>{throw Error('DOM read before actual profile validation');};
  const result=await h.run();assert.equal(result.ok,false);assert.match(result.error,/^profile_/);assert.equal(h.counts.classify,0);h.safety();
});
for(const [target,answer] of [['expectedWorkNature','unknown'],['researchInterests','invalid'],['researchInterests','[]'],['researchInterests','["宏观","宏观"]'],['researchInterests','["unknown"]']])test(`${target}: existing product fact parser rejects ${answer}`,async t=>{
  const h=await harness(t,{target,raw:profile(target,answer)}),result=await h.run();assert.equal(result.ok,false);h.safety();
});
for(const change of [
  doc=>doc.getElementById('13_43_0').id='13_43_1',
  doc=>doc.getElementById('13_43_0').after(doc.getElementById('13_43_0').cloneNode(true)),
  doc=>doc.querySelector('.ant-form-item-label label').textContent='another question',
  doc=>doc.querySelector('.tit').textContent='another section',
  doc=>doc.querySelector('.form-cell-inner').after(doc.querySelector('.form-cell-inner').cloneNode(false)),
  doc=>doc.querySelector('.ant-select-selection--single').className='ant-picker',
  doc=>doc.querySelector('.ant-select input').disabled=true,
  doc=>doc.body.setAttribute('contenteditable','true'),
  doc=>{doc.body.setAttribute('contenteditable','true');doc.getElementById('13').setAttribute('contenteditable','false');},
  doc=>doc.querySelector('.ant-form-item-label label').setAttribute('contenteditable','plaintext-only'),
  doc=>doc.getElementById('13').setAttribute('contenteditable','')
])test('fixed target ownership/kind/editability cannot be widened',async t=>{
  const h=await harness(t,{alter:change}),result=await h.run();assert.equal(result.ok,false);h.safety();
});
for(const target of ['expectedWorkNature','researchInterests'])test(`${target}: binding/fact changes between checks fail without mutation`,async t=>{
  const h=await harness(t,{target});let projections=0;
  h.setMessageHook(message=>{if(message.type==='RESUME_CMS_ROW_D_TRIAL_FACT'&&++projections===2)h.setState(state=>{state.resumeProfile.customFacts[0].answer='changed';});});
  const result=await h.run();assert.equal(result.ok,false);assert.match(result.error,/^profile_/);h.safety();
});
test('late node replacement/restore and event interruption cannot verify',async t=>{
  const h=await harness(t);let checks=0;
  h.setMessageHook(message=>{if(message.type==='RESUME_PROFILE_BINDING_CHECK'&&++checks===3){
    const node=h.document.querySelector('.ant-select-selection-selected-value');node.textContent='实习';node.textContent='全职';
  }});
  const result=await h.run();assert.equal(result.ok,false);assert.equal(result.error,'trial_interrupted');h.safety();
});
for(const type of ['input','change','click','focus','blur'])test(`concurrent user ${type} invalidates preservation verdict`,async t=>{
  const h=await harness(t);let checks=0;
  h.setMessageHook(message=>{if(message.type==='RESUME_PROFILE_BINDING_CHECK'&&++checks===3)h.document.getElementById('outside').dispatchEvent(new h.window.Event(type,{bubbles:true}));});
  const result=await h.run();assert.equal(result.ok,false);assert.equal(result.error,'trial_interrupted');
  assert.equal(h.counts.setter,0);assert.equal(h.counts.outsideRead,0);assert.equal(h.window.ResumeProfileWriteContext,undefined);
});
test('one synchronous call lock also survives reinjection',async t=>{
  const h=await harness(t);let release,entered;
  const waiting=new Promise(resolve=>{entered=resolve;});
  h.setMessageHook(async(_message,index)=>{if(index===1){entered();await new Promise(resolve=>{release=resolve;});}});
  const first=h.run();await waiting;h.window.eval(sources[2]);
  assert.equal((await h.run()).error,'fill_in_progress');release();assert.equal((await first).ok,true);h.safety();
});
test('writers are forbidden even if an accidental helper asks the trial context',async t=>{
  const h=await harness(t);let checked=false;
  h.setMessageHook(async(_message,index)=>{if(index===2){await assert.rejects(h.window.ResumeProfileWriteContext.check(true),/trial_write_forbidden/);checked=true;}});
  assert.equal((await h.run()).ok,true);assert.equal(checked,true);h.safety();
});
for(const sender of [{id:'other'}, {id:ID}, {id:ID,url:PAGE,frameId:1,tab:{id:7,url:PAGE}}, {id:ID,url:'https://example.test',frameId:0,tab:{id:7,url:'https://example.test'}}])test('internal fact projection is unavailable to extension documents/foreign senders',async t=>{
  const h=await harness(t);const result=await h.bridgeCall({type:'RESUME_CMS_ROW_D_TRIAL_FACT',target:h.target,profileBinding:h.binding},sender);
  assert.equal(result.allowed,false);assert.equal(h.getKeys.length,0);h.safety();
});
test('ordinary RESUME_INSPECT continues using its normal full-form path',async t=>{
  const h=await harness(t);for(const id of ['outside','outside-check','outside-file'])for(const key of ['value','checked','files'])delete h.document.getElementById(id)[key];
  const result=await h.invoke({type:'RESUME_INSPECT',profile:profile()});assert.equal(result.ok,true);assert.ok(result.data.fields.length>1);
});

for(const revision of [7,8,10,12])test(`legacy revision ${revision} is replaced with one current listener`,async t=>{
  const h=await harness(t),events=h.window.chrome.runtime.onMessage;
  events.removeListener(h.window.__resumeQuickFillEngineListener);
  const old=()=>{};events.addListener(old);h.window.__resumeQuickFillEngineListener=old;h.window.__resumeQuickFillEngineRevision=revision;
  h.window.eval(sources[2]);assert.equal(events.hasListener(old),false);assert.equal(h.window.__resumeQuickFillEngineRevision,16);
  assert.equal((await h.run()).ok,true);h.safety();
});
for(const revision of [7,8,12])test(`pending legacy revision ${revision} keeps its listener and shared lock`,async t=>{
  const h=await harness(t),events=h.window.chrome.runtime.onMessage;
  events.removeListener(h.window.__resumeQuickFillEngineListener);
  const old=()=>{};events.addListener(old);h.window.__resumeQuickFillEngineListener=old;h.window.__resumeQuickFillEngineRevision=revision;
  h.window.__resumeQuickFillFillState.pending=true;
  assert.throws(()=>h.window.eval(sources[2]),/profile_write_context_busy/);
  assert.equal(events.hasListener(old),true);assert.equal(h.window.__resumeQuickFillFillState.pending,true);
  // Simulate only the owner completing its old task; reinjection never clears it.
  h.window.__resumeQuickFillFillState.pending=false;h.safety();
});
test('R9 reinjection is idempotent and retains its actual listener',async t=>{
  const h=await harness(t),listener=h.window.__resumeQuickFillEngineListener;
  h.window.eval(sources[2]);assert.equal(h.window.__resumeQuickFillEngineListener,listener);
  assert.equal((await h.run()).ok,true);h.safety();
});
for(const question of ['期望工作性质？','期望工作性质，','期望工作性质（必填）','期望工作性质(选填)','期望工作性质！','期望工作性质。','期望工作性质＊'])test(`projection cannot hide actual matcher ambiguity: ${question}`,async t=>{
  const value=profile();value.customFacts.push({...value.customFacts[0],question});
  const h=await harness(t,{raw:value});
  assert.equal(h.window.ResumeMatcher.normalize(question.normalize('NFKC')),h.window.ResumeMatcher.normalize(QUESTION));
  h.document.querySelectorAll=()=>{throw Error('DOM access before ambiguous fact rejected');};
  assert.equal((await h.run()).error,'profile_trial_fact_not_unique');assert.equal(h.counts.classify,0);h.safety();
});
for(const url of [`${PAGE}?x=synthetic`,`${PAGE}#synthetic`,PAGE.replace('SU629dbc0c0dcad452299bc0f7','SUwrong')])test('trial rejects query/hash/wrong tenant before any DOM/fact request',async t=>{
  const h=await harness(t,{url});h.document.querySelectorAll=()=>{throw Error('DOM on wrong page');};
  assert.equal((await h.run()).error,'trial_wrong_page');assert.equal(h.messages.length,0);h.safety();
});
for(const change of [
  doc=>{const labels=doc.querySelectorAll('.ant-checkbox-wrapper > span:last-child');labels[0].textContent='unknown';},
  doc=>{const group=doc.querySelector('.ant-checkbox-group');group.insertBefore(group.lastElementChild,group.firstElementChild);},
  doc=>doc.querySelector('.ant-checkbox-wrapper').remove(),
  doc=>{doc.querySelector('.ant-checkbox-wrapper input').disabled=true;}
])test('research requires the exact complete static dictionary and enabled ownership',async t=>{
  const h=await harness(t,{target:'researchInterests',alter:change});assert.equal((await h.run()).ok,false);h.safety();
});
test('wrong sender never acquires the trial lock or accesses DOM',async t=>{
  const h=await harness(t);h.document.querySelectorAll=()=>{throw Error('DOM on wrong sender');};
  assert.equal((await h.invoke({type:'CMS_ROW_D_PREEXISTING_TRIAL',target:h.target,profileBinding:h.binding},{id:'other'})).error,'profile_wrong_sender');
  assert.equal(h.messages.length,0);h.safety();
});
test('an ordinary fill competes for the same pending lock',async t=>{
  const h=await harness(t);let release,entered;
  const waiting=new Promise(resolve=>{entered=resolve;});
  h.setMessageHook(async(_message,index)=>{if(index===1){entered();await new Promise(resolve=>{release=resolve;});}});
  const trial=h.run();await waiting;
  assert.equal((await h.invoke({type:'RESUME_FILL',profile:profile(),profileBinding:h.binding})).error,'fill_in_progress');
  release();assert.equal((await trial).ok,true);h.safety();
});

test('external shell metadata must be static before the reused parser reads it',async t=>{
  const h=await harness(t);const heading=h.document.querySelector('[id="11"] .tit');
  heading.setAttribute('contenteditable','plaintext-only');
  Object.defineProperty(heading,'textContent',{get(){throw Error('editable text read');}});
  assert.equal((await h.run()).error,'trial_scope_changed');h.safety();
});
test('user input during the initial binding await stops before any target read',async t=>{
  const h=await harness(t);
  h.setMessageHook((_message,index)=>{if(index===1)h.document.getElementById('outside').dispatchEvent(new h.window.Event('input',{bubbles:true}));});
  h.document.querySelectorAll=()=>{throw Error('target read after initial interruption');};
  assert.equal((await h.run()).error,'trial_interrupted');assert.equal(h.counts.classify,0);
  assert.equal(h.counts.setter,0);assert.equal(h.window.ResumeProfileWriteContext,undefined);
});

for(const shape of ['aria-editable','aria-current-display','outside-ant-editable','legend-editable','outside-ant-current-display'])test(`global parser metadata cannot read a non-target live label: ${shape}`,async t=>{
  const h=await harness(t),container=h.document.createElement('div');
  if(shape.startsWith('aria'))container.innerHTML='<span id="outside-live"></span><input aria-labelledby="outside-live">';
  else if(shape.startsWith('outside-ant'))container.innerHTML='<div class="ant-form-item"><div class="ant-form-item-label"><label><span id="outside-live"></span></label></div><input></div>';
  else container.innerHTML='<fieldset><legend id="outside-live"></legend><input type="radio" name="outside-radio"></fieldset>';
  h.document.body.append(container);
  const live=h.document.getElementById('outside-live');
  if(shape.includes('editable'))live.setAttribute('contenteditable','plaintext-only');
  else live.className='ant-select-selection-selected-value';
  let reads=0;Object.defineProperty(live,'textContent',{get(){reads++;throw Error('non-target live text read');}});
  // Parent textContent also traverses the same live descendant in real DOM.
  if(shape.startsWith('outside-ant'))Object.defineProperty(live.parentElement,'textContent',{get(){reads++;throw Error('non-target Ant label read');}});
  assert.equal((await h.run()).error,'trial_scope_changed');assert.equal(reads,0);assert.equal(h.counts.classify,0);h.safety();
});

for(const type of ['radio','checkbox','file','hidden','number','date','password','search'])test(`single-select rejects native input type before collection: ${type}`,async t=>{
  const h=await harness(t),input=h.document.querySelector('.ant-select input');input.type=type;input.style.display='block';
  let reads=0;for(const key of ['value','checked','files'])Object.defineProperty(input,key,{get(){reads++;throw Error('invalid native input read');}});
  assert.equal((await h.run()).error,'trial_scope_changed');assert.equal(reads,0);assert.equal(h.counts.classify,0);h.safety();
});
for(const shape of ['visible-text','outside-selection','nested-selection','second-host'])test(`single-select requires its closed hidden search owner: ${shape}`,async t=>{
  const h=await harness(t),input=h.document.querySelector('.ant-select input'),selection=h.document.querySelector('.ant-select-selection--single');
  if(shape==='visible-text')input.style.display='block';
  else if(shape==='outside-selection')selection.after(input);
  else {const nested=h.document.createElement('div');nested.className=shape==='second-host'?'ant-select':'ant-select-selection';selection.append(nested);nested.append(input);}
  let reads=0;Object.defineProperty(input,'value',{get(){reads++;throw Error('invalid search input read');}});
  assert.equal((await h.run()).error,'trial_scope_changed');assert.equal(reads,0);assert.equal(h.counts.classify,0);h.safety();
});
test('target named radio cannot reach an external fieldset legend or peer value',async t=>{
  const h=await harness(t),section=h.document.getElementById('13'),fieldset=h.document.createElement('fieldset');
  fieldset.innerHTML='<legend id="external-legend">offline</legend><div class="ant-form-item"><div class="ant-form-item-label"><label>offline peer</label></div><input type="radio" name="trial-external-peer"></div>';
  section.before(fieldset);fieldset.append(section);
  const input=h.document.querySelector('.ant-select input');input.type='radio';input.name='trial-external-peer';input.style.display='block';
  let reads=0;Object.defineProperty(fieldset.querySelector('legend'),'textContent',{get(){reads++;throw Error('external legend read');}});
  for(const peer of fieldset.querySelectorAll('input'))for(const key of ['value','checked'])Object.defineProperty(peer,key,{get(){reads++;throw Error('external radio value read');}});
  assert.equal((await h.run()).error,'trial_scope_changed');assert.equal(reads,0);assert.equal(h.counts.classify,0);h.safety();
});
test('research native inputs cannot become radio controls before collection',async t=>{
  const h=await harness(t,{target:'researchInterests'}),input=h.document.querySelector('.ant-checkbox input');input.type='radio';input.name='outside-group';
  let reads=0;Object.defineProperty(input,'checked',{get(){reads++;throw Error('invalid research input read');}});
  assert.equal((await h.run()).error,'trial_scope_changed');assert.equal(reads,0);assert.equal(h.counts.classify,0);h.safety();
});
