// Import is inert. The worker explicitly installs this real Chrome API bridge.
// No debugger/CDP, profile access, navigation, field action, or native-cancel claim.
const PAGE='https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';
const RULE_IDS=[620201,620202,620203];
const METHODS=new Set(['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS','CONNECT']);
const OPS=new Set(['arm','status','evidence','remove_closed','identity']);
const IDENTITY_FILES=['manifest.json','src/background/worker.mjs','src/background/cms-row-d-network-guard.mjs','src/popup/cms-row-d-guard.html','src/popup/cms-row-d-guard.js'];
const LEASE_MS=60000,COMMAND_MS=3000,CAP=128;
export function cmsDSessionRules(tabId){
  if(!Number.isInteger(tabId)||tabId<0)throw Error('target_invalid');
  return [
    {id:RULE_IDS[0],priority:1000000,action:{type:'block'},condition:{tabIds:[tabId],excludedRequestMethods:['get'],excludedResourceTypes:[]}},
    {id:RULE_IDS[1],priority:1000000,action:{type:'block'},condition:{tabIds:[tabId],resourceTypes:['websocket','webtransport']}},
    {id:RULE_IDS[2],priority:1000000,action:{type:'block'},condition:{tabIds:[tabId],regexFilter:'^https://wecruit\\.hotjob\\.cn/wecruit/resume/info/edit/SU629dbc0c0dcad452299bc0f7([?]|$)',excludedResourceTypes:[]}}
  ];
}
const canonical=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)
  ?Object.keys(v).sort().reduce((out,key)=>(out[key]=v[key],out),{}):v);
const sameRules=(a,b)=>Array.isArray(a)&&a.length===b.length
  &&canonical(a.slice().sort((x,y)=>x.id-y.id))===canonical(b.slice().sort((x,y)=>x.id-y.id));
const isPage=url=>{try{const v=new URL(url);return !v.username&&!v.password&&v.origin+v.pathname===PAGE;}catch{return false;}};

export function createCmsDNetworkGuard(api=globalThis.chrome,{now=Date.now}={}){
  let phase='idle',reason='not_armed',binding=null,expected=null,readBack=false,attempted=false,removed=false;
  let inflight=false,leaseEnd=0,lastHistory=0,closedByEvent=false,terminal=false,protectionState='not_requested';
  let debugCount=0,historyCount=0,truncated=false,ordinal=0,documentVerified=false;
  const pending=new Set(),seen=new Set(),records=[];
  const dnr=api?.declarativeNetRequest;
  const latch=code=>{if(!terminal)reason=code;terminal=true;phase='stopped_retained';readBack=false;documentVerified=false;protectionState='unknown';};
  const expire=()=>{if(leaseEnd&&now()>=leaseEnd&&!removed)latch('lease_expired_retained');};
  function snapshot(extra={}){
    expire();return {kind:'cms_d_network_guard_v1',phase,reason,ruleReadBackVerified:readBack,
      installAttempted:attempted,protectionState,retentionRequested:attempted&&!removed,rulesRemovedAfterTabClosed:removed,tabClosedByBrowserEvent:closedByEvent,
      commandPending:pending.size>0,recordsTruncated:truncated,debugMatchCount:debugCount,historyMatchCount:historyCount,
      networkEvidenceAvailable:debugCount>0||historyCount>0,records:records.map(row=>({...row})),
      coverage:'target_tab_network_stack_only',existingChannelsCovered:false,noTabWorkersCovered:false,
      beforeArmRequestsCovered:false,getSideEffectsCovered:false,nativeCancellationAvailable:false,
      currentDocumentEvidenceVerified:documentVerified&&!terminal&&pending.size===0,documentIdentityScope:'last_top_frame_probe_only',historyScope:binding?.url?'bound_guard_window':'orphan_rules_context_unknown',
      interactionAllowed:false,writeStarted:false,liveSupportClaimed:false,livePassClaimed:false,booked:53,...extra};
  }
  async function call(task){
    const promise=Promise.resolve().then(task);pending.add(promise);
    promise.then(()=>pending.delete(promise),()=>pending.delete(promise));
    let timer;
    try{return await Promise.race([promise,new Promise((_resolve,reject)=>{
      timer=setTimeout(()=>{latch('command_timeout_unknown');reject(Error('command_timeout'));},COMMAND_MS);timer.unref?.();
    })]);}finally{clearTimeout(timer);}
  }
  const available=()=>{
    const p=api?.runtime?.getManifest?.().permissions||[];
    return p.includes('declarativeNetRequest')&&p.includes('declarativeNetRequestFeedback')&&p.includes('scripting')
      &&typeof api?.scripting?.executeScript==='function'
      &&['getSessionRules','updateSessionRules','getDynamicRules','getEnabledRulesets','getMatchedRules'].every(k=>typeof dnr?.[k]==='function')
      &&typeof dnr?.onRuleMatchedDebug?.addListener==='function';
  };
  async function targetStable(capture=false){
    documentVerified=false;expire();if(terminal||!binding||closedByEvent)return false;
    const tab=await call(()=>api.tabs.get(binding.id));
    expire();if(terminal||tab.id!==binding.id||tab.url!==binding.url||!tab.active){latch('target_changed_retained');return false;}
    // Chrome supplies documentId/frameId outside the injected result. The
    // isolated function reads no fields and returns only exact-URL/top booleans.
    const results=await call(()=>api.scripting.executeScript({target:{tabId:binding.id,frameIds:[0]},
      world:'ISOLATED',injectImmediately:true,args:[binding.url],func:function(expectedFullUrl){
        return {topFrame:window===window.top,urlMatches:location.href===expectedFullUrl};
      }}));
    expire();if(terminal)return false;
    const row=Array.isArray(results)&&results.length===1?results[0]:null;
    if(!row||row.frameId!==0||typeof row.documentId!=='string'||row.documentId.length<1||row.documentId.length>128
      ||/[\x00-\x20\x7f]/.test(row.documentId)||!row.result||Object.keys(row.result).sort().join('|')!=='topFrame|urlMatches'
      ||row.result.topFrame!==true||row.result.urlMatches!==true){latch('document_probe_invalid');return false;}
    if(capture&&binding.documentId===null)binding.documentId=row.documentId;
    else if(row.documentId!==binding.documentId){latch('document_changed_retained');return false;}
    documentVerified=true;return true;
  }
  async function boundCall(task){
    if(!await targetStable())return null;
    const value=await call(task);
    if(!await targetStable())return null;
    return {value};
  }
  async function verify(){
    const observed=binding?.url?await boundCall(()=>dnr.getSessionRules()):{value:await call(()=>dnr.getSessionRules())};
    if(!observed)return false;
    const rules=observed.value;
    if(!binding){
      if(rules.some(rule=>RULE_IDS.includes(rule.id))){
        const ids=rules.find(rule=>rule.id===RULE_IDS[0])?.condition?.tabIds;
        if(Array.isArray(ids)&&ids.length===1&&Number.isInteger(ids[0])&&ids[0]>=0&&sameRules(rules,cmsDSessionRules(ids[0]))){
          binding={id:ids[0],url:null,documentId:null};expected=cmsDSessionRules(ids[0]);attempted=true;
          phase='orphaned_retained';reason='worker_context_lost_rules_retained';terminal=true;protectionState='orphan_rules_present';
        }else latch('orphan_rules_unknown');
      }
      return false;
    }
    if(!sameRules(rules,expected)){latch('rules_changed_or_unknown');return false;}
    const dynamic=await boundCall(()=>dnr.getDynamicRules());if(!dynamic)return false;
    const statics=await boundCall(()=>dnr.getEnabledRulesets());if(!statics)return false;
    if(dynamic.value.length||statics.value.length){latch('preexisting_rules_conflict');return false;}
    readBack=true;protectionState='readback_verified';return true;
  }
  function match(info){
    if(!binding||!info?.rule||!RULE_IDS.includes(info.rule.ruleId)||info.rule.rulesetId!=='_session')return;
    const request=info.request;if(!request||request.tabId!==binding.id){latch('match_owner_conflict');return;}
    if(typeof request.requestId!=='string'||request.requestId.length>256||typeof request.url!=='string'||request.url.length>8192){latch('match_schema_invalid');return;}
    if(seen.has(request.requestId))return;
    if(seen.size>=CAP||records.length>=CAP){truncated=true;latch('journal_limit');return;}
    seen.add(request.requestId);debugCount++;
    const method=METHODS.has(request.method)?request.method:'OTHER';let category='other_non_get';
    if(info.rule.ruleId===RULE_IDS[1])category='new_channel_blocked';
    else try{const url=new URL(request.url);if(url.origin==='https://wecruit.hotjob.cn'
      &&url.pathname==='/wecruit/resume/info/edit/SU629dbc0c0dcad452299bc0f7')category='cms_info_edit_blocked';}catch{}
    records.push({sequence:++ordinal,observedAtUtc:new Date(now()).toISOString(),source:'rule_match_debug',method,category,action:'block'});
    if(category!=='cms_info_edit_blocked')latch(category==='new_channel_blocked'?'new_channel_blocked':'unknown_request_blocked');
  }
  dnr?.onRuleMatchedDebug?.addListener?.(match);
  api?.tabs?.onUpdated?.addListener?.((id,change)=>{
    if(binding&&id===binding.id&&(change.status==='loading'||typeof change.url==='string'&&change.url!==binding.url))latch('target_changed_retained');
  });
  api?.tabs?.onRemoved?.addListener?.(id=>{if(binding&&id===binding.id){closedByEvent=true;latch('target_closed_rules_retained');}});

  async function arm(){
    if(phase!=='idle'||binding||attempted){
      if(binding?.url&&!terminal)await verify();
      return snapshot({operation:'arm'});
    }
    if(!available()){reason='permission_or_api_missing';return snapshot({operation:'arm'});}
    await verify();if(terminal)return snapshot({operation:'arm'});
    const tabs=await call(()=>api.tabs.query({active:true,currentWindow:true}));
    if(!Array.isArray(tabs)||tabs.length!==1||!Number.isInteger(tabs[0].id)||!isPage(tabs[0].url)){
      reason='active_cms_target_not_unique';return snapshot({operation:'arm'});
    }
    binding={id:tabs[0].id,url:tabs[0].url,documentId:null};expected=cmsDSessionRules(binding.id);phase='arming';leaseEnd=now()+LEASE_MS;
    if(!await targetStable(true))return snapshot({operation:'arm'});
    const sessions=await boundCall(()=>dnr.getSessionRules());if(!sessions)return snapshot();
    const dynamic=await boundCall(()=>dnr.getDynamicRules());if(!dynamic)return snapshot();
    const statics=await boundCall(()=>dnr.getEnabledRulesets());if(!statics)return snapshot();
    if(sessions.value.length||dynamic.value.length||statics.value.length){latch('preexisting_rules_conflict');return snapshot();}
    if(!await targetStable())return snapshot();
    attempted=true;protectionState='installation_requested';
    await call(()=>dnr.updateSessionRules({addRules:expected,removeRuleIds:[]}));
    if(!await targetStable())return snapshot();
    if(!terminal)protectionState='installation_acknowledged';
    if(!await verify())return snapshot();
    phase='armed_read_only';reason='rules_installed_no_live_pass';return snapshot({operation:'arm'});
  }
  async function evidence(){
    if(!binding)await verify();
    if(!binding||!expected)return snapshot({operation:'evidence'});
    if(!terminal&&!await verify())return snapshot({operation:'evidence'});
    // Terminal/orphan retrieval remains historical only; it cannot rebind a
    // document, restore a lease, or regain current-document/action authority.
    const read=task=>terminal?call(task).then(value=>({value})):boundCall(task);
    const current=await read(()=>dnr.getSessionRules());if(!current)return snapshot({operation:'evidence'});
    if(!sameRules(current.value,expected)){latch('rules_changed_or_unknown');return snapshot({operation:'evidence'});}
    if(lastHistory&&now()-lastHistory<31000)return snapshot({operation:'evidence',historyRefresh:'cached_rate_limit'});
    lastHistory=now();
    const observed=await read(()=>dnr.getMatchedRules({tabId:binding.id,minTimeStamp:leaseEnd?leaseEnd-LEASE_MS:0}));
    if(!observed)return snapshot({operation:'evidence'});
    const after=await read(()=>dnr.getSessionRules());if(!after)return snapshot({operation:'evidence'});
    if(!sameRules(after.value,expected)){latch('rules_changed_or_unknown');return snapshot();}
    const result=observed.value;
    if(!Array.isArray(result?.rulesMatchedInfo)||result.rulesMatchedInfo.length>CAP){truncated=true;latch('history_schema_or_limit');return snapshot();}
    let count=0;
    for(const row of result.rulesMatchedInfo){
      if(row.tabId===binding.id&&row.rule?.rulesetId==='_session'&&RULE_IDS.includes(row.rule.ruleId)
        &&Number.isFinite(row.timeStamp)&&row.timeStamp>=(leaseEnd?leaseEnd-LEASE_MS:0))count++;
    }
    historyCount=count;return snapshot({operation:'evidence',historyRefresh:'chrome_matched_rules'});
  }
  async function identity(sender){
    // This receipt is partial metadata/resource evidence for external comparison,
    // never a loaded-code, installation-path, complete-package or session proof.
    const stopped=()=>snapshot({operation:'identity'});
    if(terminal)return stopped();
    const id=api?.runtime?.id,manifest=api?.runtime?.getManifest?.();
    const ui=api?.runtime?.getURL?.('src/popup/cms-row-d-guard.html');
    const worker=api?.runtime?.getURL?.('src/background/worker.mjs');
    if(!/^[a-p]{32}$/.test(id||'')||sender?.id!==id||sender?.url!==ui||sender.tab
      ||manifest?.manifest_version!==3||!/^\d{1,5}(?:\.\d{1,5}){0,3}$/.test(manifest?.version||'')
      ||typeof manifest.name!=='string'||!manifest.name.length||manifest.name.length>128||/[\x00-\x1f\x7f]/.test(manifest.name)
      ||manifest?.background?.service_worker!=='src/background/worker.mjs'||manifest.background.type!=='module'||globalThis.location?.href!==worker
      ||typeof globalThis.fetch!=='function'||typeof globalThis.crypto?.subtle?.digest!=='function'){
      latch('identity_metadata_invalid');return stopped();
    }
    const deadline=now()+10000;let total=0;
    const alive=()=>{expire();if(!terminal&&now()>deadline)latch('identity_budget_exceeded');return !terminal;};
    if(binding&&!await verify())return stopped();
    const tabs=await call(()=>api.tabs.query({active:true,currentWindow:true}));
    if(!alive())return stopped();
    if(!Array.isArray(tabs)||tabs.length!==1||!Number.isInteger(tabs[0].id)||tabs[0].id<0||tabs[0].id>2147483647||!isPage(tabs[0].url)){
      latch('identity_target_changed');return stopped();
    }
    const target={id:tabs[0].id,url:tabs[0].url};
    const stable=async()=>{
      const tab=await call(()=>api.tabs.get(target.id));
      if(!alive())return false;
      if(tab.id!==target.id||!tab.active||tab.url!==target.url||!isPage(tab.url)
        ||binding&&(binding.id!==target.id||binding.url!==target.url)){
        latch('identity_target_changed');return false;
      }
      return true;
    };
    if(!await stable())return stopped();
    const files=[];
    for(const path of IDENTITY_FILES){
      if(!alive()||!await stable())return stopped();
      const url=api.runtime.getURL(path),parsed=new URL(url);let limit=false;
      if(parsed.protocol!=='chrome-extension:'||parsed.hostname!==id||parsed.pathname!=='/'+path
        ||parsed.username||parsed.password||parsed.search||parsed.hash){latch('identity_metadata_invalid');return stopped();}
      try{
        const row=await call(async()=>{
          const response=await globalThis.fetch(url,{redirect:'error',cache:'no-store',credentials:'omit'});
          if(response.status!==200||!response.ok||response.redirected||response.url!==url||!response.body?.getReader)throw Error('resource_unavailable');
          const reader=response.body.getReader(),chunks=[];let bytes=0;
          try{while(true){const next=await reader.read();if(next.done)break;
            if(!(next.value instanceof Uint8Array))throw Error('resource_unavailable');
            bytes+=next.value.byteLength;
            if(bytes>262144||total+bytes>524288){limit=true;await reader.cancel();throw Error('resource_limit');}
            chunks.push(next.value);
          }}finally{reader.releaseLock();}
          const raw=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){raw.set(chunk,offset);offset+=chunk.byteLength;}
          const digest=await globalThis.crypto.subtle.digest('SHA-256',raw);
          return {path,bytes,sha256:Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('')};
        });
        if(!alive())return stopped();total+=row.bytes;files.push(row);
      }catch{latch(limit?'identity_resource_limit':'identity_resource_unavailable');return stopped();}
      if(!await stable())return stopped();
    }
    if(!await stable()||!alive())return stopped();
    if(binding&&!await verify())return stopped();
    if(!alive())return stopped();
    if(api.runtime.id!==id||api.runtime.getManifest().version!==manifest.version||globalThis.location?.href!==worker){
      latch('identity_metadata_invalid');return stopped();
    }
    return snapshot({operation:'identity',runtimeIdentity:{kind:'cms_d_partial_runtime_identity_v1',extensionId:id,
      extensionVersion:manifest.version,extensionName:manifest.name,manifestVersion:3,workerEntry:'src/background/worker.mjs',workerType:'module',
      declaredGuardPermissions:{scripting:manifest.permissions?.includes('scripting')===true,declarativeNetRequest:manifest.permissions?.includes('declarativeNetRequest')===true,declarativeNetRequestFeedback:manifest.permissions?.includes('declarativeNetRequestFeedback')===true},
      workerContextUrlMatchesManifest:true,senderSameExtensionGuardUi:true,cmsTabId:target.id,cmsAllowedPage:true,
      cmsFullUrlSameAtSamples:true,guardBinding:binding?'matches_current_guard':'unarmed',
      fingerprintScope:'five_fixed_current_extension_resource_responses',partial:true,files,
      loadedModuleBytesVerified:false,fullPackageFingerprint:false,sourceCommitVerified:false,installationPathVerified:false,
      externalComparisonRequired:true,interactionAllowed:false,nativeCancellationAvailable:false}});
  }
  async function removeClosed(){
    // This is network-rule disposal after the browser confirms the tab is gone.
    // It is NOT native cancellation, value restoration, or a clean D outcome.
    if(!binding||!attempted||!closedByEvent||pending.size)return snapshot({operation:'remove_closed',disposal:'tab_close_event_required'});
    const rules=await call(()=>dnr.getSessionRules());
    if(!sameRules(rules,expected)){latch('rules_changed_or_unknown');return snapshot();}
    await call(()=>dnr.updateSessionRules({removeRuleIds:RULE_IDS,addRules:[]}));
    const after=await call(()=>dnr.getSessionRules());
    if(after.some(rule=>RULE_IDS.includes(rule.id))){latch('remove_not_verified');return snapshot();}
    removed=true;readBack=false;protectionState='removed_after_tab_closed';phase='closed_tab_rules_removed';return snapshot({operation:'remove_closed',disposal:'not_native_cancel_or_live_pass'});
  }
  return {async request(operation,sender){
    if(!OPS.has(operation)){documentVerified=false;return snapshot({reason:'operation_invalid'});}
    if(inflight||pending.size)return snapshot({operation,requestState:'busy_or_pending'});
    documentVerified=false;inflight=true;
    try{
      if(operation==='identity')return await identity(sender);
      if(operation==='arm')return await arm();
      if(operation==='remove_closed')return await removeClosed();
      if(!available())return snapshot({reason:'permission_or_api_missing',operation});
      if(operation==='evidence')return await evidence();
      if(binding&&!terminal)await verify();else if(!binding)await verify();
      return snapshot({operation});
    }catch{latch('api_outcome_unknown_retained');return snapshot({operation});}
    finally{inflight=false;}
  }};
}

export function installCmsDNetworkGuard(api=globalThis.chrome){
  if(!api?.runtime?.onMessage?.addListener)return null;
  const controller=createCmsDNetworkGuard(api);
  api.runtime.onMessage.addListener((message,sender,respond)=>{
    if(message?.type!=='CMS_ROW_D_NETWORK_GUARD')return;
    const props=Object.getOwnPropertyDescriptors(message),keys=Object.keys(props).sort().join('|');
    const valid=keys==='operation|type'&&props.type&&'value' in props.type&&props.operation&&'value' in props.operation
      &&OPS.has(props.operation.value)&&sender?.id===api.runtime.id&&!sender.tab
      &&sender.url===api.runtime.getURL('src/popup/cms-row-d-guard.html');
    if(!valid){respond({kind:'cms_d_network_guard_rejected',reason:'sender_or_request_invalid'});return;}
    controller.request(props.operation.value,sender).then(respond,()=>respond({kind:'cms_d_network_guard_rejected',reason:'operation_failed'}));return true;
  });
  return controller;
}
