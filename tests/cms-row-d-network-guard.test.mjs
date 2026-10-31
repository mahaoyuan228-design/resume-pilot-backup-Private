import test from 'node:test';
import assert from 'node:assert/strict';
import {createCmsDNetworkGuard,cmsDSessionRules,installCmsDNetworkGuard} from '../src/background/cms-row-d-network-guard.mjs';
import {publicGuardEvidence} from '../src/popup/cms-row-d-guard.js';
const PAGE='https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';
const clone=value=>structuredClone(value);
function chromeApi(options={}){
 const calls=[],listeners={};let rules=clone(options.rules||[]),time=100000,updates=0;
 const event=name=>({addListener(fn){listeners[name]=fn;}});
 const record=(name,task)=>async(...args)=>{calls.push({name,args:clone(args)});options.onCall?.(name,args);if(options.fail===name)throw Error('PRIVATE_FAILURE');return task(...args);};
 const api={runtime:{id:'synthetic',getURL:path=>'chrome-extension://synthetic/'+path,
   getManifest:()=>({permissions:options.permissions||['declarativeNetRequest','declarativeNetRequestFeedback','scripting']}),onMessage:event('message')},
  tabs:{query:record('tabs.query',()=>[{id:42,url:options.url||PAGE+'?resumeId=PRIVATE_RECORD',active:true}]),
   get:record('tabs.get',()=>({id:42,url:options.url||PAGE+'?resumeId=PRIVATE_RECORD',active:true})),onUpdated:event('updated'),onRemoved:event('removed')},
  scripting:{async executeScript(injection){
   calls.push({name:'scripting.executeScript',args:[{...injection,func:injection.func.toString()}]});
   options.onProbe?.(injection);
   if(options.fail==='scripting.executeScript')throw Error('PRIVATE_INJECTION_FAILURE');
   if(options.holdProbe)await new Promise(resolve=>{options.releaseProbe=resolve;});
   if(options.probeResults)return clone(options.probeResults);
   const win={};win.top=options.nestedFrame?{}:win;
   const result=new Function('window','location','args','return ('+injection.func.toString()+')(...args);')(
    win,{href:options.pageUrl||options.url||PAGE+'?resumeId=PRIVATE_RECORD'},injection.args);
   return [{frameId:0,documentId:options.documentId||'PRIVATE_DOCUMENT_A',result}];
  }},
  declarativeNetRequest:{getSessionRules:record('getSessionRules',()=>clone(options.badReadback&&updates?[]:rules)),
   getDynamicRules:record('getDynamicRules',()=>clone(options.dynamic||[])),getEnabledRulesets:record('getEnabledRulesets',()=>options.statics||[]),
   updateSessionRules:record('updateSessionRules',async update=>{
    updates++;if(options.holdUpdate)await new Promise(resolve=>{options.release=resolve;});
    rules=rules.filter(r=>!update.removeRuleIds.includes(r.id));rules.push(...clone(update.addRules));
   }),getMatchedRules:record('getMatchedRules',()=>({rulesMatchedInfo:clone(options.history||[])})),onRuleMatchedDebug:event('matched')}};
 const match=(extra={})=>listeners.matched({rule:{ruleId:620201,rulesetId:'_session'},request:{requestId:'request-'+time,tabId:42,
  method:'POST',url:'https://wecruit.hotjob.cn/wecruit/resume/info/edit/SU629dbc0c0dcad452299bc0f7?PRIVATE_QUERY',...extra}});
 return {api,calls,listeners,match,options,get rules(){return rules;},setTime(value){time=value;},now:()=>time};
}
const arm=async options=>{const f=chromeApi(options),guard=createCmsDNetworkGuard(f.api,{now:f.now});return {f,guard,result:await guard.request('arm')};};
test('production rule set includes nonGET main-frame coverage, new channels, exact save endpoint',()=>{
 const rules=cmsDSessionRules(42);assert.equal(rules.length,3);assert.ok(rules.every(r=>r.action.type==='block'&&r.condition.tabIds[0]===42));
 assert.deepEqual(rules[0].condition.excludedRequestMethods,['get']);assert.deepEqual(rules[0].condition.excludedResourceTypes,[]);
 assert.deepEqual(rules[1].condition.resourceTypes,['websocket','webtransport']);assert.throws(()=>cmsDSessionRules(-1));
});
test('factory import/install without extension API is inert and cannot discover endpoints',()=>{
 assert.equal(installCmsDNetworkGuard(null),null);assert.equal(typeof createCmsDNetworkGuard,'function');
});
test('missing manifest permission never attempts installing rules',async()=>{
 const {f,result}=await arm({permissions:['activeTab']});assert.equal(result.reason,'permission_or_api_missing');assert.equal(f.calls.length,0);
});
test('nonCMS active page is rejected without rule mutation',async()=>{
 const {f,result}=await arm({url:'https://elsewhere.invalid/'});assert.equal(result.reason,'active_cms_target_not_unique');assert.equal(f.rules.length,0);
});
test('arm makes real Chrome API calls and only reports readback after ACK and equality',async()=>{
 const {f,result}=await arm();assert.equal(result.phase,'armed_read_only');assert.equal(result.ruleReadBackVerified,true);
 const i=f.calls.findIndex(c=>c.name==='updateSessionRules');assert.ok(i>=0);assert.ok(f.calls.slice(i+1).some(c=>c.name==='getSessionRules'));
 assert.equal(result.networkEvidenceAvailable,false);assert.equal(result.interactionAllowed,false);assert.equal(result.currentDocumentEvidenceVerified,true);
 assert.equal(result.nativeCancellationAvailable,false);assert.equal(result.noTabWorkersCovered,false);assert.equal(result.existingChannelsCovered,false);
});
test('unknown update failure is unknown, never a retained-guard or cleanup success claim',async()=>{
 const {result}=await arm({fail:'updateSessionRules'});assert.equal(result.protectionState,'unknown');assert.equal(result.retentionRequested,true);
 assert.equal(result.ruleReadBackVerified,false);assert.equal(result.rulesRemovedAfterTabClosed,false);
});
test('ACK with absent readback never proves installed guard',async()=>{
 const {f,result}=await arm({badReadback:true});assert.equal(result.protectionState,'unknown');assert.equal(result.ruleReadBackVerified,false);
 assert.equal(f.calls.filter(c=>c.name==='updateSessionRules').length,1);
});
test('preexisting dynamic or static allow rules stop before install',async()=>{
 for(const options of [{dynamic:[{id:1,action:{type:'allow'}}]},{statics:['other']}]){
  const {f,result}=await arm(options);assert.equal(result.reason,'preexisting_rules_conflict');assert.equal(f.rules.length,0);
 }
});
test('worker restart detects existing session rules and cannot rearm or claim document context',async()=>{
 const {f,guard}=await arm();const restarted=createCmsDNetworkGuard(f.api,{now:f.now});
 const state=await restarted.request('status');assert.equal(state.phase,'orphaned_retained');assert.equal(state.protectionState,'orphan_rules_present');
 assert.equal(state.currentDocumentEvidenceVerified,false);assert.equal(state.interactionAllowed,false);
 await restarted.request('arm');assert.equal(f.calls.filter(c=>c.name==='updateSessionRules').length,1);
});
test('Chrome-shaped event records a bounded redacted block-rule match',async()=>{
 const {f,guard}=await arm();f.match();const state=await guard.request('status');
 assert.equal(state.debugMatchCount,1);assert.equal(state.networkEvidenceAvailable,true);assert.equal(state.records[0].category,'cms_info_edit_blocked');
 const text=JSON.stringify(state);assert.equal(text.includes('PRIVATE'),false);assert.equal(text.includes('request-'),false);assert.equal(text.includes('wecruit.hotjob.cn'),false);
 assert.equal(state.livePassClaimed,false);
});
test('unknown POST match is sticky stop while block rules remain untouched',async()=>{
 const {f,guard}=await arm();f.match({url:'https://outside.invalid/private'});const state=await guard.request('status');
 assert.equal(state.reason,'unknown_request_blocked');assert.equal(state.protectionState,'unknown');assert.equal(state.interactionAllowed,false);
 assert.equal(f.rules.length,3);assert.equal(f.calls.filter(c=>c.name==='updateSessionRules').length,1);
});
test('duplicate event request ID does not multiply actual match count',async()=>{
 const {f,guard}=await arm();f.match();f.match();assert.equal((await guard.request('status')).debugMatchCount,1);
});
test('journal limit is sticky and stops rather than emitting unbounded data',async()=>{
 const {f,guard}=await arm();for(let i=0;i<129;i++){f.setTime(100000+i);f.match();}
 const state=await guard.request('status');assert.equal(state.records.length,128);assert.equal(state.recordsTruncated,true);assert.equal(state.reason,'journal_limit');
});
test('history is retrieved from Chrome, independently counted, not hypothetical match testing',async()=>{
 const {f,guard}=await arm({history:[{rule:{ruleId:620201,rulesetId:'_session'},tabId:42,timeStamp:100001,private:'PRIVATE'}]});
 const state=await guard.request('evidence');assert.equal(state.historyMatchCount,1);assert.equal(state.debugMatchCount,0);
 assert.equal(state.networkEvidenceAvailable,true);assert.equal(f.calls.some(c=>c.name==='getMatchedRules'),true);
 assert.equal(JSON.stringify(state).includes('PRIVATE'),false);assert.equal(state.livePassClaimed,false);
});
test('history quota cache does not fake a second API request',async()=>{
 const {f,guard}=await arm();await guard.request('evidence');await guard.request('evidence');
 assert.equal(f.calls.filter(c=>c.name==='getMatchedRules').length,1);
});
test('orphan rule context can retrieve historical counts but never grants interaction',async()=>{
 const f=chromeApi({rules:cmsDSessionRules(42),history:[{rule:{ruleId:620201,rulesetId:'_session'},tabId:42,timeStamp:90000}]});
 const guard=createCmsDNetworkGuard(f.api,{now:f.now});const state=await guard.request('evidence');
 assert.equal(state.historyMatchCount,1);assert.equal(state.historyScope,'orphan_rules_context_unknown');assert.equal(state.currentDocumentEvidenceVerified,false);
});
test('navigation notification stops without removing acknowledged rules',async()=>{
 const {f,guard}=await arm();f.listeners.updated(42,{status:'loading'});const state=await guard.request('status');
 assert.equal(state.reason,'target_changed_retained');assert.equal(state.protectionState,'unknown');assert.equal(f.rules.length,3);
});
test('lease expires without automatic rule removal or renewed action authority',async()=>{
 const {f,guard}=await arm();f.setTime(160001);const state=await guard.request('status');
 assert.equal(state.reason,'lease_expired_retained');assert.equal(state.ruleReadBackVerified,false);assert.equal(f.rules.length,3);
});
test('alive target cannot be disposed by a caller claim or operation name',async()=>{
 const {f,guard}=await arm();const state=await guard.request('remove_closed');assert.equal(state.disposal,'tab_close_event_required');assert.equal(f.rules.length,3);
});
test('only actual browser tab-removed event enables subsequent owned-rule disposal',async()=>{
 const {f,guard}=await arm();f.listeners.removed(42);const state=await guard.request('remove_closed');
 assert.equal(f.rules.length,0);assert.equal(state.rulesRemovedAfterTabClosed,true);assert.equal(state.nativeCancellationAvailable,false);
 assert.equal(state.livePassClaimed,false);assert.equal(state.protectionState,'removed_after_tab_closed');
});
test('held API ACK serializes concurrent callers without a second mutation',async()=>{
 const options={holdUpdate:true},f=chromeApi(options),guard=createCmsDNetworkGuard(f.api,{now:f.now});
 const first=guard.request('arm');while(!options.release)await new Promise(resolve=>setImmediate(resolve));
 const concurrent=await guard.request('arm');assert.equal(concurrent.requestState,'busy_or_pending');options.release();
 assert.equal((await first).phase,'armed_read_only');assert.equal(f.calls.filter(c=>c.name==='updateSessionRules').length,1);
});
test('production runtime bridge rejects caller target/profile/native-coverage override',async()=>{
 const f=chromeApi();installCmsDNetworkGuard(f.api);let response;
 f.listeners.message({type:'CMS_ROW_D_NETWORK_GUARD',operation:'arm',profile:{private:'PRIVATE'},tabId:42},
  {id:'synthetic',url:f.api.runtime.getURL('src/popup/cms-row-d-guard.html')},v=>response=v);
 assert.equal(response.reason,'sender_or_request_invalid');assert.equal(f.calls.length,0);
});
test('web/content sender cannot invoke privileged network bridge',()=>{
 const f=chromeApi();installCmsDNetworkGuard(f.api);let response;
 f.listeners.message({type:'CMS_ROW_D_NETWORK_GUARD',operation:'arm'},
  {id:'synthetic',url:PAGE,tab:{id:42}},v=>response=v);
 assert.equal(response.reason,'sender_or_request_invalid');assert.equal(f.calls.length,0);
});
test('ordinary owned extension UI bridge can call production arm interface',async()=>{
 const f=chromeApi();installCmsDNetworkGuard(f.api);
 const response=await new Promise(resolve=>assert.equal(f.listeners.message({type:'CMS_ROW_D_NETWORK_GUARD',operation:'arm'},
  {id:'synthetic',url:f.api.runtime.getURL('src/popup/cms-row-d-guard.html')},resolve),true));
 assert.equal(response.ruleReadBackVerified,true);assert.equal(f.rules.length,3);
});
test('UI exports only closed redacted evidence, never raw injected fields',async()=>{
 const {result}=await arm();const projected=publicGuardEvidence({...result,url:'PRIVATE',profile:{private:'PRIVATE'}});
 assert.equal(JSON.stringify(projected).includes('PRIVATE'),false);assert.equal(projected.interactionAllowed,false);
 assert.throws(()=>publicGuardEvidence({...result,reason:'PRIVATE'}));
});

test('actual command deadline leaves pending API unknown and never retries its mutation',async()=>{
 const options={holdUpdate:true},f=chromeApi(options),guard=createCmsDNetworkGuard(f.api,{now:f.now});
 const keepAlive=setTimeout(()=>{},3500);
 const first=await guard.request('arm');clearTimeout(keepAlive);
 assert.equal(first.protectionState,'unknown');assert.equal(first.reason,'command_timeout_unknown');assert.equal(first.commandPending,true);
 const busy=await guard.request('arm');assert.equal(busy.requestState,'busy_or_pending');
 options.release();await new Promise(resolve=>setImmediate(resolve));
 const after=await guard.request('status');assert.equal(after.protectionState,'unknown');assert.equal(after.ruleReadBackVerified,false);
 assert.equal(f.calls.filter(c=>c.name==='updateSessionRules').length,1);assert.equal(f.rules.length,3);
});
test('failed rule disposal ACK cannot be called removed or clean',async()=>{
 const {f,guard}=await arm();f.listeners.removed(42);f.options.fail='updateSessionRules';
 const state=await guard.request('remove_closed');assert.equal(state.protectionState,'unknown');assert.equal(state.rulesRemovedAfterTabClosed,false);
 assert.equal(f.rules.length,3);assert.equal(state.livePassClaimed,false);
});

test('UI can export an actual journal-shaped redacted record including its timestamp',async()=>{
 const {f,guard}=await arm();f.match();const state=publicGuardEvidence(await guard.request('status'));
 assert.equal(state.records.length,1);assert.equal(state.records[0].observedAtUtc,'1970-01-01T00:01:40.000Z');
 assert.equal(JSON.stringify(state).includes('PRIVATE'),false);
});
test('normal guard UI button traverses its runtime bridge into production rule-install code',async()=>{
 const {JSDOM}=await import('jsdom'),{readFile}=await import('node:fs/promises');
 const html=await readFile(new URL('../src/popup/cms-row-d-guard.html',import.meta.url),'utf8');
 const dom=new JSDOM(html,{url:'chrome-extension://synthetic/src/popup/cms-row-d-guard.html'}),f=chromeApi();
 installCmsDNetworkGuard(f.api);const messages=[];
 f.api.runtime.sendMessage=message=>new Promise(resolve=>{messages.push(clone(message));f.listeners.message(message,
  {id:'synthetic',url:f.api.runtime.getURL('src/popup/cms-row-d-guard.html')},resolve);});
 const oldDocument=globalThis.document,oldChrome=globalThis.chrome;
 try{
  globalThis.document=dom.window.document;globalThis.chrome=f.api;
  await import(new URL('../src/popup/cms-row-d-guard.js?synthetic-owned-ui',import.meta.url));
  dom.window.document.getElementById('arm').click();
  for(let i=0;i<100&&!dom.window.document.getElementById('result').textContent;i++)await new Promise(resolve=>setImmediate(resolve));
  const shown=JSON.parse(dom.window.document.getElementById('result').textContent);
  assert.equal(shown.ruleReadBackVerified,true);assert.equal(shown.interactionAllowed,false);assert.equal(shown.networkEvidenceAvailable,false);
  assert.equal(f.rules.length,3);assert.deepEqual(messages,[{type:'CMS_ROW_D_NETWORK_GUARD',operation:'arm'}]);
  assert.equal(dom.window.document.getElementById('result').textContent.includes('PRIVATE'),false);
 }finally{if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;
  if(oldChrome===undefined)delete globalThis.chrome;else globalThis.chrome=oldChrome;dom.window.close();}
});

test('document probe uses only exact bound URL and Chrome top-frame metadata without exporting either',async()=>{
 const {f,result}=await arm();const probes=f.calls.filter(c=>c.name==='scripting.executeScript');assert.ok(probes.length>4);
 for(const probe of probes){const p=probe.args[0];assert.deepEqual(p.target,{tabId:42,frameIds:[0]});assert.equal(p.world,'ISOLATED');
  assert.equal(p.injectImmediately,true);assert.deepEqual(p.args,[PAGE+'?resumeId=PRIVATE_RECORD']);
  assert.equal(/textContent|\.value|checked|querySelector|fetch|KeyboardEvent|storage/.test(p.func),false);}
 assert.equal(result.currentDocumentEvidenceVerified,true);assert.equal(result.documentIdentityScope,'last_top_frame_probe_only');
 assert.equal(JSON.stringify(publicGuardEvidence(result)).includes('PRIVATE'),false);assert.equal(result.interactionAllowed,false);
});

test('scripting permission/API absence is a stop, with no weaker URL-only fallback',async()=>{
 for(const mode of ['permission','api']){
  const f=chromeApi(mode==='permission'?{permissions:['declarativeNetRequest','declarativeNetRequestFeedback']}:{});
  if(mode==='api')delete f.api.scripting;const result=await createCmsDNetworkGuard(f.api).request('arm');
  assert.equal(result.reason,'permission_or_api_missing');assert.equal(f.calls.length,0);assert.equal(result.currentDocumentEvidenceVerified,false);
 }
});

test('invalid or nonunique browser frame/document metadata never installs rules',async()=>{
 for(const probeResults of [[],[{frameId:1,documentId:'doc',result:{topFrame:true,urlMatches:true}}],
  [{frameId:0,result:{topFrame:true,urlMatches:true}}],[{frameId:0,documentId:'',result:{topFrame:true,urlMatches:true}}],
  [{frameId:0,documentId:'x'.repeat(129),result:{topFrame:true,urlMatches:true}}],
  [{frameId:0,documentId:'doc',result:{topFrame:true,urlMatches:true,private:'PRIVATE'}}],
  [{frameId:0,documentId:'A',result:{topFrame:true,urlMatches:true}},{frameId:0,documentId:'B',result:{topFrame:true,urlMatches:true}}]]){
  const {f,result}=await arm({probeResults});assert.equal(result.reason,'document_probe_invalid');assert.equal(f.rules.length,0);
  assert.equal(result.currentDocumentEvidenceVerified,false);assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
 }
});

test('isolated injected function rejects different full URL and non-top window without reading fields',async()=>{
 for(const options of [{pageUrl:PAGE+'?resumeId=DIFFERENT'},{nestedFrame:true}]){
  const {f,result}=await arm(options);assert.equal(result.reason,'document_probe_invalid');assert.equal(f.rules.length,0);
 }
});

test('same-URL document replacement during each preinstall rule read stops before mutation',async()=>{
 for(const name of ['getSessionRules','getDynamicRules','getEnabledRulesets']){
  const options={};let seen=0;options.onCall=method=>{if(method===name&&++seen===(name==='getSessionRules'?2:1))options.documentId='PRIVATE_DOCUMENT_B';};
  const {f,result}=await arm(options);assert.equal(result.reason,'document_changed_retained',name);assert.equal(f.rules.length,0,name);
  assert.equal(result.currentDocumentEvidenceVerified,false);assert.equal(f.calls.some(c=>c.name==='updateSessionRules'),false);
 }
});

test('same-URL replacement while install ACK is pending stops with installed rules untouched',async()=>{
 const options={holdUpdate:true},f=chromeApi(options),guard=createCmsDNetworkGuard(f.api,{now:f.now});
 const first=guard.request('arm');while(!options.release)await new Promise(resolve=>setImmediate(resolve));
 options.documentId='PRIVATE_DOCUMENT_B';options.release();const state=await first;
 assert.equal(state.reason,'document_changed_retained');assert.equal(state.currentDocumentEvidenceVerified,false);
 assert.equal(state.ruleReadBackVerified,false);assert.equal(f.rules.length,3);assert.equal(state.protectionState,'unknown');
 assert.equal(f.calls.filter(c=>c.name==='updateSessionRules').length,1);
});

test('same-URL replacement during postinstall rule verification cannot become ready',async()=>{
 const options={};let installed=false;options.onCall=name=>{
  if(name==='updateSessionRules')installed=true;else if(installed&&name==='getSessionRules')options.documentId='PRIVATE_DOCUMENT_B';
 };
 const {f,result}=await arm(options);assert.equal(result.reason,'document_changed_retained');assert.equal(f.rules.length,3);
 assert.equal(result.ruleReadBackVerified,false);assert.equal(result.currentDocumentEvidenceVerified,false);
});

test('status detects same-URL new document without relying on tabs.onUpdated',async()=>{
 const {f,guard}=await arm();f.options.documentId='PRIVATE_DOCUMENT_B';
 const state=await guard.request('status');assert.equal(state.reason,'document_changed_retained');assert.equal(f.rules.length,3);
 assert.equal(state.currentDocumentEvidenceVerified,false);assert.equal(state.ruleReadBackVerified,false);
 const after=await guard.request('arm');assert.equal(after.reason,'document_changed_retained');assert.equal(f.calls.filter(c=>c.name==='updateSessionRules').length,1);
});

test('evidence detects document change during Chrome history query without promoting its result',async()=>{
 const {f,guard}=await arm({history:[{rule:{ruleId:620201,rulesetId:'_session'},tabId:42,timeStamp:100001}]});
 f.options.onCall=name=>{if(name==='getMatchedRules')f.options.documentId='PRIVATE_DOCUMENT_B';};
 const state=await guard.request('evidence');assert.equal(state.reason,'document_changed_retained');
 assert.equal(state.historyMatchCount,0);assert.equal(state.currentDocumentEvidenceVerified,false);assert.equal(f.rules.length,3);
});

test('cached evidence still rechecks the document before returning cached history',async()=>{
 const {f,guard}=await arm();await guard.request('evidence');f.options.documentId='PRIVATE_DOCUMENT_B';
 const state=await guard.request('evidence');assert.equal(state.reason,'document_changed_retained');assert.equal(state.currentDocumentEvidenceVerified,false);
 assert.equal(f.calls.filter(c=>c.name==='getMatchedRules').length,1);
});

test('ordinary rule calls are bracketed by actual executeScript probes',async()=>{
 const {f}=await arm();const first=f.calls.findIndex(c=>c.name==='scripting.executeScript');
 const named=new Set(['getSessionRules','getDynamicRules','getEnabledRulesets','updateSessionRules']);
 for(let i=first+1;i<f.calls.length;i++)if(named.has(f.calls[i].name)){
  assert.equal(f.calls.slice(first,i).some(c=>c.name==='scripting.executeScript'),true);
  assert.equal(f.calls.slice(i+1).find(c=>c.name==='scripting.executeScript'||named.has(c.name))?.name,'scripting.executeScript');
 }
});

test('failed probe never returns a current document claim and never mutates rules',async()=>{
 const {f,result}=await arm({fail:'scripting.executeScript'});assert.equal(result.protectionState,'unknown');
 assert.equal(result.currentDocumentEvidenceVerified,false);assert.equal(f.rules.length,0);assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
});

test('probe timeout remains pending, and a late result cannot create a document binding or rearm',async()=>{
 const options={holdProbe:true},f=chromeApi(options),guard=createCmsDNetworkGuard(f.api,{now:f.now});
 const keepAlive=setTimeout(()=>{},3500);const state=await guard.request('arm');clearTimeout(keepAlive);
 assert.equal(state.reason,'command_timeout_unknown');assert.equal(state.commandPending,true);assert.equal(state.currentDocumentEvidenceVerified,false);
 assert.equal((await guard.request('arm')).requestState,'busy_or_pending');
 options.releaseProbe();await new Promise(resolve=>setImmediate(resolve));
 const after=await guard.request('status');assert.equal(after.currentDocumentEvidenceVerified,false);assert.equal(after.protectionState,'unknown');
 assert.equal(f.calls.some(c=>c.name==='updateSessionRules'),false);
});

test('lease expiration during probe cannot return current-document readiness',async()=>{
 const options={},f=chromeApi(options),guard=createCmsDNetworkGuard(f.api,{now:f.now});
 options.onProbe=()=>f.setTime(160001);const state=await guard.request('arm');
 assert.equal(state.reason,'lease_expired_retained');assert.equal(state.currentDocumentEvidenceVerified,false);assert.equal(f.rules.length,0);
});
test('repeated arm verifies the bound document without installing again or renewing the lease',async()=>{
 const {f,guard}=await arm();f.options.documentId='PRIVATE_DOCUMENT_B';
 const state=await guard.request('arm');assert.equal(state.reason,'document_changed_retained');
 assert.equal(state.currentDocumentEvidenceVerified,false);assert.equal(f.calls.filter(c=>c.name==='updateSessionRules').length,1);
});

test('pending install cannot export a stale pre-command document verification',async()=>{
 const options={holdUpdate:true},f=chromeApi(options),guard=createCmsDNetworkGuard(f.api,{now:f.now});
 const first=guard.request('arm');while(!options.release)await new Promise(resolve=>setImmediate(resolve));
 const pending=await guard.request('status');assert.equal(pending.commandPending,true);assert.equal(pending.currentDocumentEvidenceVerified,false);
 options.release();assert.equal((await first).currentDocumentEvidenceVerified,true);
});

test('UI rejects contradictory current-document claims and exports no document ID or URL',async()=>{
 const {result}=await arm();
 for(const override of [{phase:'orphaned_retained'},{commandPending:true},{ruleReadBackVerified:false},{protectionState:'unknown'}]){
  assert.throws(()=>publicGuardEvidence({...result,...override}));
 }
 const shown=publicGuardEvidence({...result,documentId:'PRIVATE',url:'PRIVATE'});
 assert.equal(shown.currentDocumentEvidenceVerified,true);assert.equal(JSON.stringify(shown).includes('PRIVATE'),false);
});
const IDENTITY_PATHS=['manifest.json','src/background/worker.mjs','src/background/cms-row-d-network-guard.mjs','src/popup/cms-row-d-guard.html','src/popup/cms-row-d-guard.js'];
async function identityFixture(options,run){
 const f=chromeApi(options),id='abcdefghijklmnopabcdefghijklmnop';f.api.runtime.id=id;
 f.api.runtime.getURL=path=>'chrome-extension://'+f.api.runtime.id+'/'+path;
 const original=f.api.runtime.getManifest;
 f.api.runtime.getManifest=()=>({...original(),name:'Synthetic Extension',version:options.version||'0.1.4.9',manifest_version:3,
  background:{service_worker:'src/background/worker.mjs',type:'module'},...options.manifest});
 const oldFetch=Object.getOwnPropertyDescriptor(globalThis,'fetch'),oldLocation=Object.getOwnPropertyDescriptor(globalThis,'location');
 const bytes=new Map(IDENTITY_PATHS.map(path=>[path,new Uint8Array([0,239,187,191,13,10,...new TextEncoder().encode(path)])]));
 const fetched=[];let count=0;
 Object.defineProperty(globalThis,'location',{configurable:true,writable:true,value:{href:options.workerUrl||f.api.runtime.getURL('src/background/worker.mjs')}});
 Object.defineProperty(globalThis,'fetch',{configurable:true,writable:true,value:async(url,init)=>{
  const path=new URL(url).pathname.slice(1);fetched.push({url,init});options.onFetch?.(path,++count,f);
  if(options.holdFetch)await new Promise(resolve=>{options.releaseFetch=resolve;});
  if(options.fetchError)throw Error('PRIVATE_FETCH_ERROR_URL');
  const response=new Response(options.largeBytes?new Uint8Array(options.largeBytes):bytes.get(path),{status:options.status||200});
  Object.defineProperty(response,'url',{value:options.responseUrl||url});
  if(options.redirected)Object.defineProperty(response,'redirected',{value:true});return response;
 }});
 f.api.storage=new Proxy({},{get(){throw Error('PRIVATE_STORAGE_MUST_NOT_BE_READ');}});
 const controller=installCmsDNetworkGuard(f.api),sender={id,url:f.api.runtime.getURL('src/popup/cms-row-d-guard.html')};
 const request=operation=>new Promise(resolve=>{assert.equal(f.listeners.message({type:'CMS_ROW_D_NETWORK_GUARD',operation},sender,resolve),true);});
 try{return await run({f,controller,sender,request,bytes,fetched});}
 finally{if(oldFetch)Object.defineProperty(globalThis,'fetch',oldFetch);else delete globalThis.fetch;
  if(oldLocation)Object.defineProperty(globalThis,'location',oldLocation);else delete globalThis.location;}
}

test('identity normal bridge returns actual runtime metadata and five raw WebCrypto hashes without arming',async()=>{
 await identityFixture({},async({f,request,bytes,fetched})=>{
  const state=publicGuardEvidence(await request('identity')),value=state.runtimeIdentity;assert.equal(value.partial,true);
  assert.equal(value.extensionId,f.api.runtime.id);assert.equal(value.extensionVersion,'0.1.4.9');assert.equal(value.workerType,'module');
  assert.equal(value.cmsTabId,42);assert.equal(value.guardBinding,'unarmed');assert.equal(state.phase,'idle');
  const {createHash}=await import('node:crypto');
  for(const row of value.files){assert.equal(row.bytes,bytes.get(row.path).length);assert.equal(row.sha256,createHash('sha256').update(bytes.get(row.path)).digest('hex'));}
  assert.deepEqual(fetched.map(r=>new URL(r.url).pathname.slice(1)),IDENTITY_PATHS);
  assert.ok(fetched.every(r=>r.url.startsWith('chrome-extension://'+f.api.runtime.id+'/')&&r.init.redirect==='error'&&r.init.cache==='no-store'&&r.init.credentials==='omit'));
  assert.equal(f.calls.some(c=>c.name==='updateSessionRules'),false);assert.equal(f.calls.some(c=>c.name==='scripting.executeScript'),false);
  const text=JSON.stringify(state);assert.equal(/PRIVATE|resumeId|sourceSha|sameInstance|debugger/.test(text),false);
  assert.equal(value.loadedModuleBytesVerified,false);assert.equal(value.fullPackageFingerprint,false);assert.equal(value.sourceCommitVerified,false);
  assert.equal(value.installationPathVerified,false);assert.equal(state.interactionAllowed,false);
 });
});

test('identity refuses caller path/tab/hash overrides before own-resource fetch',async()=>{
 await identityFixture({},async({f,sender,fetched})=>{
  for(const extra of [{path:'private'},{tabId:42},{url:'https://private.invalid'},{hash:'PRIVATE'},{coverage:true}]){
   let result;f.listeners.message({type:'CMS_ROW_D_NETWORK_GUARD',operation:'identity',...extra},sender,v=>result=v);
   assert.equal(result.reason,'sender_or_request_invalid');
  }
  assert.equal(fetched.length,0);assert.equal(f.calls.length,0);
 });
});

test('identity refuses a worker-context URL or manifest mismatch without weaker fallback',async()=>{
 for(const options of [{workerUrl:'chrome-extension://other/worker.mjs'},{manifest:{version:'PRIVATE'}},
  {manifest:{background:{service_worker:'src/license/guard-worker.mjs',type:'module'}}}]){
  await identityFixture(options,async({request,fetched,f})=>{
   const state=await request('identity');assert.equal(state.reason,'identity_metadata_invalid');assert.equal(state.runtimeIdentity,undefined);
   assert.equal(fetched.length,0);assert.equal(f.rules.length,0);
  });
 }
});

test('identity own-resource destination must be the exact same extension and fixed path',async()=>{
 await identityFixture({},async({f,request,fetched})=>{
  const ordinary=f.api.runtime.getURL;f.api.runtime.getURL=path=>path==='manifest.json'?'https://elsewhere.invalid/manifest.json':ordinary(path);
  const result=await request('identity');assert.equal(result.reason,'identity_metadata_invalid');assert.equal(fetched.length,0);
 });
});

test('identity rejects missing, redirected or differently addressed resource responses without partial export',async()=>{
 for(const options of [{status:404},{redirected:true},{responseUrl:'chrome-extension://other/private'}]){
  await identityFixture(options,async({request})=>{
   const state=await request('identity');assert.equal(state.reason,'identity_resource_unavailable');assert.equal(state.runtimeIdentity,undefined);
   assert.equal(JSON.stringify(publicGuardEvidence(state)).includes('private'),false);
  });
 }
});

test('identity limits per-file and whole-receipt raw bytes',async()=>{
 for(const largeBytes of [262145,200000]){
  await identityFixture({largeBytes},async({request,fetched})=>{
   const state=await request('identity');assert.equal(state.reason,'identity_resource_limit');assert.equal(state.runtimeIdentity,undefined);
   assert.ok(fetched.length<=3);assert.equal(state.interactionAllowed,false);
  });
 }
});

test('identity detects a changed full CMS URL while fingerprinting and discards every partial row',async()=>{
 const options={onFetch(_path,count,f){if(count===1)f.options.url=PAGE+'?resumeId=OTHER_PRIVATE';}};
 await identityFixture(options,async({request,fetched})=>{
  const state=await request('identity');assert.equal(state.reason,'identity_target_changed');assert.equal(state.runtimeIdentity,undefined);
  assert.equal(fetched.length,1);assert.equal(JSON.stringify(state).includes('PRIVATE'),false);
 });
});

test('identity checks an armed document again after fingerprints and cannot rebind a new document',async()=>{
 const options={};await identityFixture(options,async({request,f})=>{
  assert.equal((await request('arm')).ruleReadBackVerified,true);
  options.onFetch=()=>{options.documentId='PRIVATE_NEW_DOCUMENT';};
  const result=await request('identity');assert.equal(result.reason,'document_changed_retained');assert.equal(result.runtimeIdentity,undefined);
  assert.equal(result.currentDocumentEvidenceVerified,false);assert.equal(f.rules.length,3);
  assert.equal(f.calls.filter(c=>c.name==='updateSessionRules').length,1);
 });
});

test('identity never grants authority from a terminal guard or existing orphan rules',async()=>{
 await identityFixture({rules:cmsDSessionRules(42)},async({request,fetched})=>{
  assert.equal((await request('status')).phase,'orphaned_retained');
  const result=await request('identity');assert.equal(result.runtimeIdentity,undefined);assert.equal(fetched.length,0);
  assert.equal(result.interactionAllowed,false);
 });
});

test('identity detects runtime-version drift during own-resource reads',async()=>{
 const options={onFetch(_path,count){if(count===3)options.version='0.1.4.10';}};
 await identityFixture(options,async({request})=>{
  const result=await request('identity');assert.equal(result.reason,'identity_metadata_invalid');assert.equal(result.runtimeIdentity,undefined);
 });
});

test('identity fetch errors are fixed enums and never expose their URL or exception payload',async()=>{
 await identityFixture({fetchError:true},async({request})=>{
  const result=await request('identity');assert.equal(result.reason,'identity_resource_unavailable');
  assert.equal(result.runtimeIdentity,undefined);assert.equal(JSON.stringify(publicGuardEvidence(result)).includes('PRIVATE'),false);
 });
});

test('pending identity fetch serializes arm and a late timeout result cannot create an identity receipt',async()=>{
 const options={holdFetch:true};await identityFixture(options,async({request,controller,f})=>{
  const keepAlive=setTimeout(()=>{},3500);const first=request('identity');
  while(!options.releaseFetch)await new Promise(resolve=>setImmediate(resolve));
  assert.equal((await controller.request('arm')).requestState,'busy_or_pending');
  const stopped=await first;clearTimeout(keepAlive);
  assert.equal(stopped.reason,'command_timeout_unknown');assert.equal(stopped.runtimeIdentity,undefined);assert.equal(stopped.commandPending,true);
  options.releaseFetch();await new Promise(resolve=>setImmediate(resolve));
  assert.equal((await controller.request('status')).runtimeIdentity,undefined);assert.equal(f.rules.length,0);
 });
});

test('identity projection refuses full-package/path/loaded-code claims and malformed fingerprint rows',async()=>{
 await identityFixture({},async({request})=>{
  const state=await request('identity');
  for(const field of ['partial','externalComparisonRequired'])assert.throws(()=>publicGuardEvidence({...state,runtimeIdentity:{...state.runtimeIdentity,[field]:false}}));
  for(const field of ['loadedModuleBytesVerified','fullPackageFingerprint','sourceCommitVerified','installationPathVerified','interactionAllowed']){
   assert.throws(()=>publicGuardEvidence({...state,runtimeIdentity:{...state.runtimeIdentity,[field]:true}}));
  }
  const bad=clone(state);bad.runtimeIdentity.files[0].path='https://private.invalid';assert.throws(()=>publicGuardEvidence(bad));
  const more=clone(state);more.runtimeIdentity.files.push(more.runtimeIdentity.files[0]);assert.throws(()=>publicGuardEvidence(more));
 });
});

test('ordinary dedicated identity UI button calls the exact existing runtime bridge and displays only partial receipt',async()=>{
 await identityFixture({},async({f})=>{
  const {JSDOM}=await import('jsdom'),{readFile}=await import('node:fs/promises');
  const dom=new JSDOM(await readFile(new URL('../src/popup/cms-row-d-guard.html',import.meta.url),'utf8'),{url:f.api.runtime.getURL('src/popup/cms-row-d-guard.html')});
  const previousDocument=globalThis.document,previousChrome=globalThis.chrome,messages=[];
  f.api.runtime.sendMessage=message=>new Promise(resolve=>{messages.push(clone(message));f.listeners.message(message,
   {id:f.api.runtime.id,url:f.api.runtime.getURL('src/popup/cms-row-d-guard.html')},resolve);});
  try{
   globalThis.document=dom.window.document;globalThis.chrome=f.api;
   await import(new URL('../src/popup/cms-row-d-guard.js?identity-ui-contract',import.meta.url));
   dom.window.document.getElementById('identity').click();
   for(let i=0;i<1000&&!dom.window.document.getElementById('result').textContent;i++)await new Promise(resolve=>setImmediate(resolve));
   const shown=JSON.parse(dom.window.document.getElementById('result').textContent);
   assert.equal(shown.runtimeIdentity.partial,true);assert.equal(shown.runtimeIdentity.files.length,5);assert.equal(shown.interactionAllowed,false);
   assert.deepEqual(messages,[{type:'CMS_ROW_D_NETWORK_GUARD',operation:'identity'}]);assert.equal(JSON.stringify(shown).includes('PRIVATE'),false);
  }finally{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
   if(previousChrome===undefined)delete globalThis.chrome;else globalThis.chrome=previousChrome;dom.window.close();}
 });
});
test('identity final tab-read window cannot return an old armed document receipt',async()=>{
 let getCount=0;
 await identityFixture({},async({request,f})=>{
  await request('arm');f.options.onCall=name=>{if(name==='tabs.get')getCount++;};
  assert.ok((await request('identity')).runtimeIdentity);
 });
 assert.ok(getCount>0);
 const options={};await identityFixture(options,async({request,f})=>{
  await request('arm');let count=0;
  options.onCall=name=>{if(name==='tabs.get'&&++count===getCount)options.documentId='PRIVATE_FINAL_DOCUMENT';};
  const result=await request('identity');assert.equal(count,getCount);
  assert.equal(result.reason,'document_changed_retained');assert.equal(result.runtimeIdentity,undefined);
  assert.equal(result.currentDocumentEvidenceVerified,false);assert.equal(f.rules.length,3);
 });
});
