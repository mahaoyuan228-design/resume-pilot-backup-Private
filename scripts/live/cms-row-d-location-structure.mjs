#!/usr/bin/env node
// Inert on import. This tool adds structure evidence, never field support.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ROW_D_PAGE, buildCmsRowDOptionsProbeExpression } from '../lib/cms-row-d-options.mjs';
import { runCmsRowDLive, readRowDProbeConfig, rowDTemporaryPath } from './cms-row-d-live.mjs';
import { connectCdp } from '../../tools/live-harvest/cdp-client.mjs';

export const SOURCE_PINS = Object.freeze({
  'scripts/live/cms-row-d-live.mjs':'5945aeef1cdcdc3c4ebadb2d23f6518313303214f8d09349fd52fcfa68114873',
  'scripts/lib/cms-row-d-options.mjs':'3e64c59fc7524a10a9f13188f83e68eaa7587d00e735a7adf0e92c3866921d83',
  'tools/live-harvest/cdp-client.mjs':'5c3edacafd540b6f41bcdef4c221a5f8bf9d5e44a7442418b87784c2620b0d8e',
  'tools/live-harvest/errors.mjs':'528cefd73f5dcc3a0ecec732a09aac394a7bfd1e75196d514517fa32d46d3e9c'
});
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const SAFETY=Object.freeze({neverSave:true,liveSupportClaimed:false,livePassClaimed:false,
  writeStarted:false,mutationAllowed:false,valuesExposed:false,probeOnly:true});

/** Serialized pure reads only. Referenced list children/content are not read. */
export function inspectLocationStructure(doc, expectedPage) {
  try {
    if(!doc?.defaultView||doc.defaultView.location.href!==expectedPage)
      return {captured:false,reason:'wrong_page'};
    if(doc.visibilityState!=='visible'||doc.readyState!=='complete')
      return {captured:false,reason:'document_unavailable'};
    const snap=(collection,limit=256)=>{
      if(collection.length>limit)throw 0;
      const nodes=[];for(let i=0;i<collection.length;i++)nodes.push(collection[i]);return nodes;
    };
    const selectors=[],cache=[];
    const ancestors=node=>{
      const chain=[];
      for(let current=node;current;current=current.parentElement){
        if(chain.length>=128)throw 0;
        chain.push(current);
      }
      return chain;
    };
    const matches=(node,selector)=>{
      if(!node)return false;
      const index=selectors.indexOf(selector);
      if(index!==-1)return cache[index].includes(node);
      const nodes=snap(doc.querySelectorAll(selector),10000);
      selectors.push(selector);cache.push(nodes);return nodes.includes(node);
    };
    const nearest=(node,selector)=>{
      const chain=ancestors(node);
      for(let i=0;i<chain.length;i++)if(matches(chain[i],selector))return chain[i];
      return null;
    };
    const within=(node,parent)=>{
      const chain=ancestors(node);
      for(let i=0;i<chain.length;i++)if(chain[i]===parent)return true;
      return false;
    };
    const named=/^\d+_\d+_\d+$/u;
    const nearestWrapper=node=>{
      const chain=ancestors(node);
      for(let i=0;i<chain.length;i++)if(named.test(chain[i].getAttribute('id')||''))return chain[i];
      return null;
    };
    const hidden=node=>{
      const chain=ancestors(node);
      for(let i=0;i<chain.length;i++){
        const current=chain[i];
        if(matches(current,'[hidden],[aria-hidden="true"],[inert]'))return true;
        const style=current.getAttribute('style')||'';if(style.length>2048)throw 0;
        if(style.split(';').some(value=>/^\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse))\s*(?:!\s*important\s*)?$/iu.test(value)))return true;
      }return false;
    };
    const ids=snap(doc.querySelectorAll('[id]'),10000);
    const exactIds=id=>snap(ids.filter(node=>node.getAttribute('id')===id));
    const tokens=node=>{
      const raw=node.getAttribute('aria-controls')||'';if(raw.length>2048)throw 0;
      const result=raw.split(/\s+/u).filter(value=>value.length>0);if(result.length>8)throw 0;return result;
    };
    const ariaNodes=snap(doc.querySelectorAll('[aria-controls]'),10000);
    const locations=[];
    const wrapperIds=['13_100701_0','13_100702_0'];
    for(let wrapperIndex=0;wrapperIndex<2;wrapperIndex++){
      const wrapperId=wrapperIds[wrapperIndex];
      const sections=exactIds('13'),wrappers=exactIds(wrapperId);
      const row={wrapperId,sectionId:'13',levelHint:'unknown',dictionaryComplete:false,
        reason:'scope_unverified',sectionCount:sections.length,wrapperCount:wrappers.length,
        itemCount:0,hostCount:0,cascaderCount:0,hostsArePeers:false,hostsShareParent:false,
        cascaderOwnsBoth:false,hostsNearestCascaderSame:false,hosts:[]};
      locations.push(row);
      if(sections.length!==1||wrappers.length!==1||!matches(sections[0],'.form-cell')
        ||nearest(wrappers[0],'.form-cell')!==sections[0]||!wrappers[0].isConnected)continue;
      const section=sections[0],wrapper=wrappers[0],items=snap(wrapper.querySelectorAll('.ant-form-item'));
      row.itemCount=items.length;
      if(items.length!==1||matches(wrapper,'.ant-form-item')||nearest(items[0],'.form-cell')!==section
        ||nearestWrapper(items[0])!==wrapper)continue;
      const item=items[0],owned=node=>nearest(node,'.ant-form-item')===item
        &&nearest(node,'.form-cell')===section&&nearestWrapper(node)===wrapper;
      const hosts=snap(item.querySelectorAll('.ant-select')),
        cascaders=snap(item.querySelectorAll('.cascader-plugins-wrap'));
      row.hostCount=hosts.length;row.cascaderCount=cascaders.length;
      if(hosts.length!==2){row.reason='host_count_changed';continue;}
      if(!hosts.every(owned)||!cascaders.every(owned)){row.reason='ownership_unverified';continue;}
      row.hostsArePeers=!within(hosts[0],hosts[1])&&!within(hosts[1],hosts[0]);
      row.hostsShareParent=hosts[0].parentElement===hosts[1].parentElement;
      row.cascaderOwnsBoth=cascaders.length===1&&hosts.every(node=>within(node,cascaders[0]));
      row.hostsNearestCascaderSame=row.cascaderOwnsBoth&&hosts.every(node=>nearest(node,'.cascader-plugins-wrap')===cascaders[0]);
      row.reason='peer_hosts_checked';
      for(let hostSlot=0;hostSlot<2;hostSlot++){
        const host=hosts[hostSlot],combos=snap(host.querySelectorAll('[role="combobox"]')),
          selections=snap(host.querySelectorAll('.ant-select-selection--single')),
          inputs=snap(host.querySelectorAll('input'));
        const output={hostSlot,levelHint:'unknown',dictionaryComplete:false,reason:'host_structure_unverified',
          comboboxCount:combos.length,selectionCount:selections.length,inputCount:inputs.length,
          comboOwned:false,selectionIsCombo:false,inputOwned:false,inputWithinCombo:false,
          inputText:false,inputHiddenByAttributes:false,inputSearchClass:false,
          hostReferenceCount:0,comboReferenceCount:0,inputReferenceCount:0,distinctReferenceCount:0,
          ariaOwnerCount:0,ariaOwnerOutsideHost:false,ariaOwnerIsCombo:false,ariaOwnerIsInput:false,
          listIdMatchCount:0,listConnected:false,listRoleMatched:false,listClassMatched:false,
          portalAncestorCount:0,listForeignScope:false,portalForeignScope:false};
        row.hosts.push(output);
        if(combos.length!==1||selections.length!==1||inputs.length!==1)continue;
        const combo=combos[0],input=inputs[0];
        output.comboOwned=owned(combo)&&nearest(combo,'.ant-select')===host;
        output.selectionIsCombo=selections[0]===combo&&matches(combo,'.ant-select-selection');
        output.inputOwned=owned(input)&&nearest(input,'.ant-select')===host;
        output.inputWithinCombo=within(input,combo);
        const type=input.getAttribute('type');output.inputText=type===null||type.toLowerCase()==='text';
        output.inputHiddenByAttributes=hidden(input);
        output.inputSearchClass=matches(input,'.ant-select-search__field');
        if(!row.hostsArePeers||!output.comboOwned||!output.selectionIsCombo||!output.inputOwned
          ||!output.inputWithinCombo||!output.inputText||!output.inputHiddenByAttributes){continue;}
        const surfaces=[host,combo,input],refs=[];
        const referenceCounts=[];
        for(let i=0;i<surfaces.length;i++){
          const values=tokens(surfaces[i]);referenceCounts.push(values.length);
          for(let j=0;j<values.length;j++)if(!refs.includes(values[j]))refs.push(values[j]);
        }
        output.hostReferenceCount=referenceCounts[0];output.comboReferenceCount=referenceCounts[1];
        output.inputReferenceCount=referenceCounts[2];output.distinctReferenceCount=refs.length;
        if(refs.length!==1||referenceCounts.some(value=>value>1)){output.reason='aria_reference_missing_or_ambiguous';continue;}
        const owners=snap(ariaNodes.filter(node=>tokens(node).includes(refs[0])));
        output.ariaOwnerCount=owners.length;
        output.ariaOwnerOutsideHost=owners.some(node=>!within(node,host));
        output.ariaOwnerIsCombo=owners.length===1&&owners[0]===combo;
        output.ariaOwnerIsInput=owners.length===1&&owners[0]===input;
        if(owners.length!==1||output.ariaOwnerOutsideHost){output.reason='aria_owner_not_unique';continue;}
        const lists=exactIds(refs[0]);output.listIdMatchCount=lists.length;
        if(lists.length!==1){output.reason='current_list_missing_or_ambiguous';continue;}
        const list=lists[0];output.listConnected=Boolean(list.isConnected);
        output.listRoleMatched=list.getAttribute('role')==='listbox';
        output.listClassMatched=matches(list,'.ant-select-dropdown-menu');
        const foreign=node=>Boolean((nearest(node,'.ant-form-item')&&nearest(node,'.ant-form-item')!==item)
          ||(nearest(node,'.form-cell')&&nearest(node,'.form-cell')!==section)
          ||(nearestWrapper(node)&&nearestWrapper(node)!==wrapper));
        output.listForeignScope=foreign(list);
        const portals=[],chain=ancestors(list);
        for(let i=0;i<chain.length;i++)if(matches(chain[i],'.ant-select-dropdown'))portals.push(chain[i]);
        output.portalAncestorCount=portals.length;
        output.portalForeignScope=portals.some(foreign);
        output.reason=output.listConnected&&output.listRoleMatched&&output.listClassMatched
          &&portals.length===1&&!output.listForeignScope&&!output.portalForeignScope
          ?'linked_structure_observed':'list_or_portal_unverified';
      }
    }
    return {captured:true,reason:'read_only_structure',locations};
  }catch{return {captured:false,reason:'structure_limit_or_exception'};}
}

const ROW_REASONS=['scope_unverified','host_count_changed','ownership_unverified','peer_hosts_checked'];
const HOST_REASONS=['host_structure_unverified','aria_reference_missing_or_ambiguous','aria_owner_not_unique',
  'current_list_missing_or_ambiguous','list_or_portal_unverified','linked_structure_observed'];
const COUNT_KEYS=['comboboxCount','selectionCount','inputCount','hostReferenceCount','comboReferenceCount',
  'inputReferenceCount','distinctReferenceCount','ariaOwnerCount','listIdMatchCount','portalAncestorCount'];
const BOOL_KEYS=['comboOwned','selectionIsCombo','inputOwned','inputWithinCombo','inputText',
  'inputHiddenByAttributes','inputSearchClass','ariaOwnerOutsideHost','ariaOwnerIsCombo','ariaOwnerIsInput',
  'listConnected','listRoleMatched','listClassMatched','listForeignScope','portalForeignScope'];
function keys(value,names){return value&&typeof value==='object'&&!Array.isArray(value)
  &&Object.keys(value).sort().join('|')===names.sort().join('|');}
const count=value=>Number.isInteger(value)&&value>=0&&value<=256;
export function validateStructure(value){
  if(!keys(value,['captured','reason','locations'])||value.captured!==true||value.reason!=='read_only_structure'
    ||!Array.isArray(value.locations)||value.locations.length!==2)throw Error('diagnostic_invalid');
  for(let i=0;i<2;i++){
    const row=value.locations[i];
    if(!keys(row,['wrapperId','sectionId','levelHint','dictionaryComplete','reason','sectionCount','wrapperCount',
      'itemCount','hostCount','cascaderCount','hostsArePeers','hostsShareParent','cascaderOwnsBoth','hostsNearestCascaderSame','hosts'])
      ||row.wrapperId!==['13_100701_0','13_100702_0'][i]||row.sectionId!=='13'||row.levelHint!=='unknown'
      ||row.dictionaryComplete!==false||!ROW_REASONS.includes(row.reason)
      ||!['sectionCount','wrapperCount','itemCount','hostCount','cascaderCount'].every(key=>count(row[key]))
      ||!['hostsArePeers','hostsShareParent','cascaderOwnsBoth','hostsNearestCascaderSame'].every(key=>typeof row[key]==='boolean')
      ||!Array.isArray(row.hosts)||row.hosts.length!==(row.reason==='peer_hosts_checked'?2:0))throw Error('diagnostic_invalid');
    if(row.reason==='peer_hosts_checked'&&(row.sectionCount!==1||row.wrapperCount!==1||row.itemCount!==1||row.hostCount!==2))throw Error('diagnostic_invalid');
    for(let slot=0;slot<row.hosts.length;slot++){
      const host=row.hosts[slot];
      if(!keys(host,['hostSlot','levelHint','dictionaryComplete','reason',...COUNT_KEYS,...BOOL_KEYS])
        ||host.hostSlot!==slot||host.levelHint!=='unknown'||host.dictionaryComplete!==false||!HOST_REASONS.includes(host.reason)
        ||!COUNT_KEYS.every(key=>count(host[key]))||!BOOL_KEYS.every(key=>typeof host[key]==='boolean'))throw Error('diagnostic_invalid');
      if(host.reason==='linked_structure_observed'&&(!row.hostsArePeers||host.ariaOwnerCount!==1
        ||host.comboboxCount!==1||host.selectionCount!==1||host.inputCount!==1||host.distinctReferenceCount!==1
        ||[host.hostReferenceCount,host.comboReferenceCount,host.inputReferenceCount].reduce((a,b)=>a+b,0)!==1
        ||host.listIdMatchCount!==1||host.portalAncestorCount!==1||host.ariaOwnerOutsideHost||host.listForeignScope
        ||host.portalForeignScope||!['comboOwned','selectionIsCombo','inputOwned','inputWithinCombo','inputText',
          'inputHiddenByAttributes','listConnected','listRoleMatched','listClassMatched'].every(key=>host[key]===true)))throw Error('diagnostic_invalid');
    }
  }
  return JSON.parse(JSON.stringify(value));
}
export function buildLocationStructureExpression(){
  const original=buildCmsRowDOptionsProbeExpression(),line='return inspectCmsRowDOptions(globalThis.document, {});';
  if(original.split(line).length!==2)throw Error('expression_shape_changed');
  return original.replace(line,`const inspection = inspectCmsRowDOptions(globalThis.document, {});\n`
    +`const structure = (${inspectLocationStructure.toString()})(globalThis.document, ${JSON.stringify(ROW_D_PAGE)});\n`
    +'return { inspection, structure };');
}
export function cleanCaptureAllowed(official){
  return official?.probeCompleted===true&&official.inspectionGate?.status==='allowed'
    &&Array.isArray(official.inspectionGate.checkpoints)&&official.inspectionGate.checkpoints.length===4
    &&official.inspectionGate.checkpoints.every((row,index)=>row.checkpoint===['target_activation','bring_to_front','focus_emulation','before_inspection'][index]
      &&row.ready===true&&['already_complete','settled'].includes(row.status))
    &&['row_d_preflight_incomplete','read_only_preflight'].includes(official.reason)
    &&Object.entries(SAFETY).every(([key,value])=>official[key]===value)
    &&['targetActivated','pageBroughtToFront','focusEmulationEnabled','focusEmulationCleared'].every(key=>official.visibilityKeeper?.[key]===true)
    &&['no_non_get','correlated_keeper_blocks'].includes(official.traffic?.keeperAssessment?.status)
    &&official.traffic.keeperAssessment.reasons.length===0&&official.traffic.responseToNonGetCount===0
    &&official.traffic.commandFailed===false&&official.traffic.truncated===false;
}
export async function runLocationStructure({port=9242,timeoutMs=10000,getTargets,connect=connectCdp,wait}={}){
  let structure,evaluations=0;
  const originalExpression=buildCmsRowDOptionsProbeExpression(),expression=buildLocationStructureExpression();
  const decorate=async(url,options)=>{
    const session=await connect(url,options);
    return {close:()=>session.close(),async send(method,params={},sendOptions){
      if(method!=='Runtime.evaluate')return session.send(method,params,sendOptions);
      evaluations++;
      if(evaluations!==1||params.expression!==originalExpression||params.throwOnSideEffect!==true
        ||params.awaitPromise!==false||params.userGesture!==false||params.returnByValue!==true)throw Error('evaluation_contract_invalid');
      const reply=await session.send(method,{...params,expression},sendOptions);
      if(reply?.exceptionDetails||(reply&&Object.hasOwn(reply,'error'))||reply?.result?.subtype==='error')return reply;
      const envelope=reply?.result?.value;
      if(!keys(envelope,['inspection','structure']))throw Error('evaluation_envelope_invalid');
      try{structure=validateStructure(envelope.structure);}catch{structure=undefined;}
      return {...reply,result:{...reply.result,value:envelope.inspection}};
    }};
  };
  const official=await runCmsRowDLive({port,timeoutMs,connect:decorate,
    ...(getTargets?{getTargets}:{}),...(wait?{wait}:{})});
  const captured=evaluations===1&&Boolean(structure)&&cleanCaptureAllowed(official);
  return {official,structure:captured?structure:undefined,captured,
    reason:captured?'structure_captured':'capture_stopped'};
}
export function verifySources(root,tip){
  if(!/^[0-9a-f]{40}$/u.test(tip)||fs.readFileSync(path.join(root,'TIP_SHA.txt'),'utf8').trim()!==tip)throw Error('source_pin_invalid');
  for(const [file,hash] of Object.entries(SOURCE_PINS))
    if(createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')!==hash)throw Error('source_pin_invalid');
}
export function readStructureConfig(args,env=process.env,root=ROOT){
  if(args.length!==4||args[0]!=='--tip'||args[2]!=='--outdir'||env.REQUESTS_FILE)throw Error('config_invalid');
  const tip=args[1];verifySources(root,tip);
  const config=readRowDProbeConfig({PORT:env.PORT||'9242',STEP_TIMEOUT_MS:env.STEP_TIMEOUT_MS||'10000',OUTDIR:args[3]},root,root);
  if(path.dirname(config.outDir)!==path.join(fs.realpathSync(root),'_temp-scripts')
    ||!/^cms-row-d-location-structure-[a-z0-9-]{1,64}$/u.test(path.basename(config.outDir))
    ||fs.existsSync(config.outDir))throw Error('output_not_exclusive');
  return {...config,tip};
}
export async function main(args=process.argv.slice(2),env=process.env,{root=ROOT,run=runLocationStructure,stdout=process.stdout}={}){
  let config;
  try{
    config=readStructureConfig(args,env,root);
    fs.mkdirSync(config.outDir); // Atomic reservation. Never reuse or overwrite.
    const ownedDirectory=fs.realpathSync(config.outDir),out=file=>{
      if(fs.realpathSync(config.outDir)!==ownedDirectory)throw Error('output_changed');
      return rowDTemporaryPath(path.join(config.outDir,file),root,root);
    };
    const result=await run({port:config.port,timeoutMs:config.timeoutMs});
    fs.writeFileSync(out('cms-row-d-live.json'),JSON.stringify(result.official,null,2)+'\n',{flag:'wx'});
    verifySources(root,config.tip);
    if(!result.captured||!cleanCaptureAllowed(result.official))throw Error('capture_stopped');
    const structure=validateStructure(result.structure);
    const sidecar={version:1,kind:'cms_row_d_location_structure',...SAFETY,actualDevTip:config.tip,
      sourcePinsVerified:true,booked:53,bookD:false,optionLabelsExposed:false,dictionaryComplete:false,
      officialReason:result.official.reason,diagnostics:structure};
    const json=JSON.stringify(sidecar,null,2)+'\n';if(Buffer.byteLength(json)>32768)throw Error('diagnostic_invalid');
    fs.writeFileSync(out('structure.json'),json,{flag:'wx'});
    stdout.write(JSON.stringify({captured:true,reason:'structure_captured',...SAFETY,booked:53,bookD:false})+'\n');
  }catch{
    stdout.write(JSON.stringify({captured:false,reason:'capture_stopped',...SAFETY,booked:53,bookD:false})+'\n');
  }
  return 2; // Evidence preparation never becomes a fill/live PASS.
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))process.exitCode=await main();
