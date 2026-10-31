import {createRowDNetworkGuard, selectRowDTarget} from './cms-row-d-live.mjs';
import {ROW_D_PAGE} from '../lib/cms-row-d-options.mjs';
import {connectCdp, getJson} from '../../tools/live-harvest/cdp-client.mjs';

export const INSTALLED_EXTENSION_ID='ahpmjplhpoipppjdakbhpaoijnmhncpo';
const TARGET='13_100701_0';
const flags=()=>({neverSave:true,liveSupportClaimed:false,livePassClaimed:false,booked:53,
  writeStarted:false,mutationAllowed:false,interactionAllowed:false,allTrafficCovered:false});

// Runs only in the selected document. The remote object retains identity and
// target values internally; neither values nor DOM objects are returned by value.
export function captureDTarget(expectedFullUrl) {
  const doc=document,href=location.href,timeOrigin=performance.timeOrigin;
  const fail=()=>{throw Error('d_target_unverified');};
  if(href!==expectedFullUrl||doc.designMode.toLowerCase()==='on')fail();
  const all=(root,selector,cap=128)=>{const nodes=root.querySelectorAll(selector);if(nodes.length>cap)fail();return nodes;};
  const cls=(node,name)=>(' '+(node.getAttribute('class')||'').replace(/\s+/gu,' ')+' ').includes(' '+name+' ');
  const within=(node,parent)=>{for(let i=0;node&&i<64;i++,node=node.parentElement)if(node===parent)return true;return false;};
  const nearest=(node,name)=>{for(let i=0;node&&i<64;i++,node=node.parentElement)if(cls(node,name))return node;return null;};
  const namedWrapper=node=>{for(let i=0;node&&i<64;i++,node=node.parentElement)if(/^\d+_\d+_\d+$/u.test(node.getAttribute('id')||''))return node;return null;};
  const editable=node=>{for(let i=0;node&&i<64;i++,node=node.parentElement){const value=node.getAttribute('contenteditable');
    if(value!==null&&['','true','plaintext-only'].includes(value.toLowerCase()))return true;}return !!node;};
  const unique=(root,selector)=>{const nodes=all(root,selector);if(nodes.length!==1)fail();return nodes[0];};
  const section=unique(doc,'[id="13"]'),wrapper=unique(doc,'[id="13_100701_0"]');
  const item=nearest(wrapper,'ant-form-item'),cascader=cls(wrapper,'cascader-plugins-wrap')?wrapper:unique(wrapper,'.cascader-plugins-wrap');
  const owned=node=>namedWrapper(node)===wrapper&&nearest(node,'ant-form-item')===item;
  const safeDisplay=node=>{
    if(!owned(node)||editable(node)||all(node,'input,textarea,[contenteditable]').length)return false;
    const children=all(node,'*');for(let i=0;i<children.length;i++)if(!owned(children[i])||editable(children[i]))return false;
    return true;
  };
  if(!item||nearest(item,'form-cell')!==section||!within(cascader,wrapper)||!owned(cascader))fail();
  const hosts=all(cascader,'.ant-select');if(hosts.length!==2)fail();
  const selections=[],inputs=[],displays=[],original=[];
  for(let i=0;i<2;i++){
    const host=hosts[i],selection=unique(host,'.ant-select-selection--single'),input=unique(host,'input');
    if(!owned(host)||!owned(selection)||!owned(input)||nearest(host,'cascader-plugins-wrap')!==cascader||selection.getAttribute('role')!=='combobox'
      ||!within(input,selection)||(input.getAttribute('type')||'text').toLowerCase()!=='text'
      ||!cls(input,'ant-select-search__field')||editable(selection)||editable(input))fail();
    const list=all(host,'.ant-select-selection-selected-value,.ant-select-selection-item');if(list.length>1)fail();
    const display=list.length?list[0]:null;
    if(display&&(!within(display,selection)||!safeDisplay(display)))fail();
    const value=display?display.textContent:'';if(typeof value!=='string'||value.length>512)fail();
    selections.push(selection);inputs.push(input);displays.push(display);original.push(value);
  }
  const hidden=node=>node.hasAttribute('hidden')||node.getAttribute('aria-hidden')==='true'
    ||cls(node,'ant-select-dropdown-hidden')||/display\s*:\s*none/u.test(node.getAttribute('style')||'');
  function sample(){
    if(document!==doc||location.href!==href||performance.timeOrigin!==timeOrigin||!section.isConnected||!wrapper.isConnected||!cascader.isConnected
      ||nearest(item,'form-cell')!==section||nearest(wrapper,'ant-form-item')!==item)fail();
    if(unique(doc,'[id="13"]')!==section||unique(doc,'[id="13_100701_0"]')!==wrapper)fail();
    if(!owned(cascader)||!within(cascader,wrapper)||(cls(wrapper,'cascader-plugins-wrap')?wrapper:unique(wrapper,'.cascader-plugins-wrap'))!==cascader)fail();
    const current=all(cascader,'.ant-select');if(current.length!==2)fail();
    let same=true,closed=true;
    for(let i=0;i<2;i++){
      if(!owned(hosts[i])||nearest(hosts[i],'cascader-plugins-wrap')!==cascader||!owned(selections[i])||!owned(inputs[i])||current[i]!==hosts[i]||unique(hosts[i],'.ant-select-selection--single')!==selections[i]
        ||unique(hosts[i],'input')!==inputs[i]||!within(inputs[i],selections[i]))fail();
      const list=all(hosts[i],'.ant-select-selection-selected-value,.ant-select-selection-item');
      if(list.length!==(displays[i]?1:0)||list.length&&list[0]!==displays[i])fail();
      if(displays[i]&&!safeDisplay(displays[i]))fail();
      const value=displays[i]?displays[i].textContent:'';
      if(typeof value!=='string'||value.length>512)fail();
      if(value!==original[i])same=false;
      if(cls(hosts[i],'ant-select-open')||selections[i].getAttribute('aria-expanded')==='true')closed=false;
    }
    const panels=all(doc,'.ant-select-dropdown,.ant-calendar-picker-container,.ant-picker-dropdown,.ant-cascader-menus');
    for(let i=0;i<panels.length;i++)if(!hidden(panels[i]))closed=false;
    return {identity:true,valuesUnchanged:same,closed,baselineAllBlank:original[0]===''&&original[1]==='',
      targetCount:2,scope:'first_location_pair'};
  }
  const initial=sample();if(!initial.closed)fail();
  return {sample};
}

function cleanSample(reply){
  if(reply?.exceptionDetails||reply?.error)throw Error('strict_observation_failed');
  const v=reply?.result?.value;
  if(!v||Object.keys(v).sort().join('|')!=='baselineAllBlank|closed|identity|scope|targetCount|valuesUnchanged'
    ||v.identity!==true||v.targetCount!==2||v.scope!=='first_location_pair'
    ||['valuesUnchanged','closed','baselineAllBlank'].some(key=>typeof v[key]!=='boolean'))throw Error('observation_invalid');
  return v;
}

/** Explicit call only: import never discovers/attaches. No FIELD action/fill.
 * Explicit execution does activate the target and change browser focus state.
 * Dependencies support protocol tests; no caller flag can authorize interaction.
 * A nonterminal restoration stop exposes bounded resampling supervision.
 * No native action is synthesized; the missing official action interface stops.
 */
export async function runCmsRowDControlledEntry({port=9242,timeoutMs=3000,leaseMs=15000,
  getTargets=getJson,connect=connectCdp,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
  const evidence={...flags(),target:TARGET,stages:[],reason:'not_started',guardEnabled:false,
    keeperClosed:false,recoveryVerified:false,guardRetentionRequested:false,protectionState:'not_started',cleanupComplete:false,
    initialStop:null,failureHistory:[],recoveryAttempts:0,cancelRequests:0,nativeActionInterface:'unavailable',nativeCancellationVerified:false};
  let session,remoteId,fetchEnabled=false,fetchAttempted=false,networkEnabled=false,focus=false,fatal=null,timer,recoveryAttempts=0;
  let pendingRestoration=null,recoveryFlight=null,cancelFlight=null,supervisorBusy=false;
  const remember=reason=>{if(evidence.failureHistory.length<4&&!evidence.failureHistory.includes(reason))evidence.failureHistory.push(reason);};
  const latch=reason=>{fatal??=reason;remember(reason);if(['lease_expired','document_or_channel_changed'].includes(reason))evidence.protectionState='unknown';};
  const guard=createRowDNetworkGuard((method,params)=>session.send(method,params));
  const stage=name=>evidence.stages.push(name);
  const snapshot=()=>({...evidence,stages:evidence.stages.slice(),failureHistory:evidence.failureHistory.slice(),
    recoveryAvailable:!!pendingRestoration&&!fatal&&!guard.failed()&&fetchEnabled&&!!remoteId&&recoveryAttempts<2,
    reason:fatal||(guard.failed()?'non_get_or_guard_failure':pendingRestoration||evidence.reason),traffic:{...guard.traffic,records:guard.traffic.records.slice()},
    assessment:guard.assessment()});
  const healthy=()=>{if(guard.failed()){evidence.protectionState='unknown';latch('non_get_or_guard_failure');}return !fatal;};
  const sample=async()=>{
    if(!remoteId)throw Error('target_baseline_missing');
    return cleanSample(await session.send('Runtime.callFunctionOn',{objectId:remoteId,
      functionDeclaration:'function(){return this.sample();}',returnByValue:true,generatePreview:false,
      awaitPromise:false,userGesture:false,throwOnSideEffect:true}));
  };
  const restorationPending=observed=>{
    const reason=!observed.valuesUnchanged?'target_values_not_restored':'panel_not_closed';
    pendingRestoration=reason;evidence.initialStop??=reason;remember(reason);
    evidence.guardRetentionRequested=true;evidence.recoveryVerified=false;return snapshot();
  };
  const assessRecovery=async()=>{
    if(!healthy()||!fetchEnabled||!remoteId){evidence.guardRetentionRequested=fetchEnabled;return snapshot();}
    if(++recoveryAttempts>2){latch('recovery_limit');return snapshot();}
    evidence.recoveryAttempts=recoveryAttempts;
    stage('cancel_recovery');
    try{
      if(!healthy()){evidence.guardRetentionRequested=fetchEnabled;return snapshot();}
      const before=await sample();
      if(!healthy()){evidence.guardRetentionRequested=true;return snapshot();}
      if(!before.closed||!before.valuesUnchanged)return restorationPending(before);
      await guard.drain();
      if(!healthy()){evidence.guardRetentionRequested=true;return snapshot();}
      await wait(250);
      if(!healthy()){evidence.guardRetentionRequested=true;return snapshot();}
      const after=await sample();
      if(!healthy()){evidence.guardRetentionRequested=true;return snapshot();}
      if(!after.closed||!after.valuesUnchanged)return restorationPending(after);
      if(focus){await session.send('Emulation.setFocusEmulationEnabled',{enabled:false});focus=false;await wait(250);}
      await guard.drain();
      if(!healthy()){evidence.guardRetentionRequested=true;return snapshot();}
      const final=await sample();
      if(!healthy()){evidence.guardRetentionRequested=true;return snapshot();}
      if(!final.closed||!final.valuesUnchanged)return restorationPending(final);
      await guard.drain();
      if(!healthy()){evidence.guardRetentionRequested=true;return snapshot();}
      pendingRestoration=null;evidence.recoveryVerified=true;stage('cleanup');
      if(evidence.initialStop)evidence.reason='restored_after_prior_stop_not_a_live_pass';
      // End of the protection window. ALL DOM observations and drains above
      // occur while Fetch is enabled. Later ACKs cannot prove continued coverage.
      evidence.protectionEndRequested=true;
      evidence.protectionState='end_requested';
      if(fetchEnabled){await session.send('Fetch.disable');fetchEnabled=false;}
      evidence.protectionState='ended_acknowledged';evidence.guardRetentionRequested=false;
      if(!healthy())throw Error('cleanup_boundary_failed');
      if(networkEnabled){await session.send('Network.disable');networkEnabled=false;}
      if(!healthy())throw Error('cleanup_boundary_failed');
      await session.send('Page.disable');
      if(!healthy())throw Error('cleanup_boundary_failed');
      await session.send('Runtime.releaseObject',{objectId:remoteId});remoteId=null;
      if(!healthy())throw Error('cleanup_boundary_failed');
      session.close();clearTimeout(timer);evidence.cleanupComplete=true;evidence.guardRetentionRequested=false;
    }catch{latch('cleanup_or_recovery_failed');evidence.guardRetentionRequested=fetchEnabled;evidence.protectionState='unknown';evidence.cleanupComplete=false;evidence.recoveryVerified=false;}
    return snapshot();
  };
  const recover=()=>{
    if(recoveryFlight)return recoveryFlight;
    if(supervisorBusy)return Promise.resolve({...snapshot(),supervisorOutcome:'supervisor_busy'});
    supervisorBusy=true;
    recoveryFlight=assessRecovery().finally(()=>{recoveryFlight=null;supervisorBusy=false;});return recoveryFlight;
  };
  const cancel=()=>{
    if(cancelFlight)return cancelFlight;
    if(supervisorBusy)return Promise.resolve({...snapshot(),cancelOutcome:'supervisor_busy'});
    if(evidence.cancelRequests>=1)return Promise.resolve({...snapshot(),cancelOutcome:'cancel_request_limit'});
    evidence.cancelRequests=1;supervisorBusy=true;
    cancelFlight=(async()=>{
      if(!healthy()||!fetchEnabled||!remoteId)return {...snapshot(),cancelOutcome:'terminal_stop'};
      try{
        // This is a real strict target recheck, not a caller-provided assertion.
        const observed=await sample();
        if(!healthy())return {...snapshot(),cancelOutcome:'terminal_stop'};
        if(observed.closed&&observed.valuesUnchanged)return {...snapshot(),cancelOutcome:'already_restored_use_recover'};
        restorationPending(observed);
        // No verified native tool adapter is available in this Node interface.
        // Never replace it with Input.dispatch*, click(), a caller callback or
        // nativeRecovery/coverage=true. An allowed external native operation may
        // subsequently be followed by recover(), whose samples decide recovery.
        return {...snapshot(),cancelOutcome:'native_action_unavailable'};
      }catch{
        latch('cancel_observation_failed');evidence.protectionState='unknown';
        return {...snapshot(),cancelOutcome:'terminal_stop'};
      }
    })().finally(()=>{cancelFlight=null;supervisorBusy=false;});return cancelFlight;
  };
  try{
    if(port!==9242||!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>10000
      ||!Number.isInteger(leaseMs)||leaseMs<1000||leaseMs>30000)throw Error('config_invalid');
    stage('same_instance_metadata');
    const targets=await getTargets(port,'/json/list',{timeoutMs,step:'d_entry_target'});
    const extension=Array.isArray(targets)&&targets.some(t=>t?.type==='service_worker'
      &&t.url===`chrome-extension://${INSTALLED_EXTENSION_ID}/src/background/worker.mjs`);
    if(!extension){evidence.reason='installed_instance_unverified';return {evidence:snapshot(),cancel:null,recover:null};}
    const choice=selectRowDTarget(targets,port);
    if(!choice.ok){evidence.reason=choice.reason;return {evidence:snapshot(),cancel:null,recover:null};}
    const fullUrl=choice.target.url;
    // This check retains the original complete selected URL; never serialize it.
    if(new URL(fullUrl).origin+new URL(fullUrl).pathname!==ROW_D_PAGE)throw Error('target_invalid');
    session=await connect(choice.target.webSocketDebuggerUrl,{timeoutMs,step:'d_entry_connect',onEvent(message){
      guard.onEvent(message);
      if(['Page.frameNavigated','Page.frameDetached','Page.navigatedWithinDocument','Inspector.detached',
        'Target.detachedFromTarget','Network.webSocketCreated'].includes(message?.method))latch('document_or_channel_changed');
    }});
    timer=setTimeout(()=>latch('lease_expired'),leaseMs);
    timer.unref?.();
    stage('guard_enable_ack');
    await session.send('Page.enable');
    await session.send('Network.enable');networkEnabled=true;
    if(fatal)throw Error('guard_enable_failed');
    fetchAttempted=true;
    evidence.protectionState='enable_requested';
    await session.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});fetchEnabled=true;
    evidence.protectionState='enabled_acknowledged';
    await guard.drain();if(guard.failed()||fatal)throw Error('guard_enable_failed');
    evidence.guardEnabled=true;stage('keeper');guard.setKeeperActive(true);
    for(const [method,params] of [['Target.activateTarget',{targetId:choice.target.id}],['Page.bringToFront',{}],
      ['Emulation.setFocusEmulationEnabled',{enabled:true}]]){
      if(method==='Emulation.setFocusEmulationEnabled')focus=true;
      await session.send(method,params);
      const settled=await guard.settleKeeper();if(!settled.ready||fatal)throw Error('keeper_failed');
    }
    const captured=await session.send('Runtime.evaluate',{expression:`(${captureDTarget.toString()})(${JSON.stringify(fullUrl)})`,
      returnByValue:false,generatePreview:false,awaitPromise:false,userGesture:false,throwOnSideEffect:true});
    if(captured?.exceptionDetails||captured?.error||typeof captured?.result?.objectId!=='string')throw Error('strict_target_capture_failed');
    remoteId=captured.result.objectId;
    const initial=await sample();if(!initial.closed||!initial.valuesUnchanged)throw Error('baseline_unverified');
    const settled=await guard.settleKeeper();if(!settled.ready||fatal)throw Error('keeper_failed');
    await guard.drain();guard.setKeeperActive(false);evidence.keeperClosed=true;
    stage('interaction_precondition');
    // No supported interface has proved existing worker/WebSocket coverage or
    // native cancellation. This cannot be enabled by caller data or a fake ACK.
    evidence.reason='interaction_precondition_stop_channels_and_native_recovery_unverified';
    if(guard.failed()||fatal)throw Error('interaction_guard_failed');
    await recover();
  }catch{
    latch('entry_or_guard_failed');
    // Unknown browser outcome is not permission to disable interception.
    evidence.protectionState='unknown';
    if(session&&fetchAttempted){evidence.guardRetentionRequested=true;if(remoteId&&fetchEnabled)await recover();}
    else if(session){try{session.close();}catch{}clearTimeout(timer);}
  }
  if(guard.failed())latch('non_get_or_guard_failure');
  const canSupervise=!!pendingRestoration&&healthy()&&fetchEnabled&&!!remoteId&&recoveryAttempts<2;
  return {evidence:snapshot(),cancel:canSupervise?cancel:null,recover:canSupervise?recover:null};
}
