// Read-only initialization proof. No form changes, Cancel, Save, or API writes.
import {assertProfileBinding,dispatchBoundSource} from '../profile/profile-lifecycle.js';
const PAGE='https://hr.gtht.com/resume/edit/';
// This function executes in MAIN; every dependency must remain inside it.
export async function readGthRefreshBasicMetadata(input){
 const PAGE='https://hr.gtht.com/resume/edit/',labels=['姓名','性别','手机号码','出生年月','电子邮件','现居住地','最高学历','照片','参加工作时间'];
 const norm=value=>String(value??'').replace(/[\s\u00a0]+/gu,' ').trim(),stop=reason=>({ok:false,reason});
 const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
 const scalar=value=>value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value);
 const visible=node=>!!node?.getClientRects().length&&getComputedStyle(node).display!=='none'&&getComputedStyle(node).visibility!=='hidden';
 try{
  const capture=()=>{
   if(location.href!==PAGE||document.readyState!=='complete'||document.visibilityState!=='visible'||performance.timeOrigin!==input.documentTimeOrigin)throw Error('draft_refresh_basic_page_changed');
   const sections=[...document.querySelectorAll('.r-section')],root=sections[0]?.parentElement,all=sections.flatMap(section=>[...section.querySelectorAll('form')]),form=sections[0]?.querySelector('form');
   if(sections.length!==7||all.length!==1||all[0]!==form||root?.tagName!=='DIV'||!root.classList.contains('r-block')||!root.__vue__||form.contains(document.activeElement))throw Error('draft_refresh_basic_editor_not_unique');
   if([...document.querySelectorAll('.el-select-dropdown,.el-picker-panel,.plugin-dialog-wrap,.el-dialog,.el-message-box')].some(visible))throw Error('draft_refresh_basic_editor_not_unique');
   const business=[],seen=new Set();let vue=root.__vue__;
   for(let i=0;vue&&i<8;i++,vue=vue.$parent){if(seen.has(vue))break;seen.add(vue);const item=vue.curItem||vue.$props?.curItem;if(item?.name==='基本信息'&&vue.mode==='edit'&&!item.multi&&Array.isArray(item.data))business.push({vue,item});}
   if(business.length!==1)throw Error('draft_refresh_basic_owner_unknown');
   const owners=[];seen.clear();vue=form.__vue__;
   for(let i=0;vue&&i<8;i++,vue=vue.$parent){if(seen.has(vue))break;seen.add(vue);const data=vue.$data||vue;if(data.isBaseInfoSection===true&&data.tableName==='resume'&&Array.isArray(data.formConfig)&&data.formData&&typeof data.formData==='object')owners.push(vue);}
   if(owners.length!==1)throw Error('draft_refresh_basic_form_owner_unknown');
   const owner=owners[0],data=owner.$data||owner,config=data.formConfig,keys=Object.keys(data.formData);
   if(config.length!==9||new Set(config.map(row=>row.name)).size!==9||new Set(config.map(row=>norm(row.label))).size!==9||labels.some(label=>!config.some(row=>norm(row.label)===label)))throw Error('draft_refresh_basic_labels_changed');
   if(keys.length!==9||config.some(row=>typeof row.name!=='string'||!keys.includes(row.name)||!scalar(data.formData[row.name])))throw Error('draft_refresh_basic_initial_values_unknown');
   if([...form.querySelectorAll('input[type=file]')].some(node=>node.files?.length)||[...form.querySelectorAll('.el-form-item')].some(node=>node.classList.contains('is-error')||node.classList.contains('is-validating'))||[...form.querySelectorAll('.el-form-item__error')].some(visible))throw Error('draft_refresh_basic_editor_not_untouched');
   const configured=business[0].item.data[0]?.editUrl||business[0].item.addUrl;let read;
   try{read=new URL(owner.$props?.formdataurl??owner.formdataurl,PAGE);}catch{throw Error('draft_refresh_basic_read_route_unknown');}
   if(typeof configured!=='string'||read.href!==new URL(configured,PAGE).href||read.origin!==new URL(PAGE).origin||read.hash||read.username||read.password||!Number.isSafeInteger(owner._uid))throw Error('draft_refresh_basic_read_route_unknown');
   const footprint=node=>[node.outerHTML,[...node.querySelectorAll('input,textarea,select')].map(control=>[control.tagName,control.type,control.value,!!control.checked,control.selectedIndex??null,[...(control.files||[])].map(file=>[file.name,file.size,file.type])])];
   return {owner,business:business[0].vue,form,data,config,read,proof:{pageURL:location.href,timeOrigin:performance.timeOrigin,formUID:owner._uid,businessUID:business[0].vue._uid??null,mode:business[0].vue.mode,isEditFlag:business[0].vue.isEditFlag??null,expandFormId:business[0].vue.expandFormId??null,sectionId:business[0].item.id??null,records:business[0].item.data.map(row=>({id:row.id??null,editUrl:row.editUrl??null})),readURL:read.href,saveURL:data.saveURL??null,config:config.map(row=>({name:row.name,label:norm(row.label),type:row.type??null,gCustomTypeId:row.addinfo?.gCustomTypeId??null,hasValue:Object.hasOwn(row,'value'),...(Object.hasOwn(row,'value')?{value:row.value}:{})})),values:Object.fromEntries(config.map(row=>[row.name,data.formData[row.name]])),sections:sections.map(footprint)}};
  };
  const before=capture(),baseline=canonical(before.proof),hasValues=before.config.every(row=>Object.hasOwn(row,'value'));
  let baselineSource,initial;
  if(hasValues){
   if(before.config.some(row=>!scalar(row.value)))return stop('draft_refresh_basic_initial_values_unknown');
   if(before.config.some(row=>row.value!==before.data.formData[row.name]))return stop('draft_refresh_basic_values_changed');
   baselineSource='config_value';initial=before.config.map(row=>[row.name,row.value]);
  }else{
   if(before.config.some(row=>Object.hasOwn(row,'value'))||before.config.some(row=>typeof before.data.formData[row.name]!=='string')||before.proof.records.length!==1||!Number.isSafeInteger(before.business._uid))return stop('draft_refresh_basic_initial_values_unknown');
   const titles=[...document.querySelectorAll('.r-section')].map(section=>{const title=section.querySelector('.title_')?.cloneNode(true);title?.querySelectorAll('a,button').forEach(node=>node.remove());return norm(title?.textContent);});
   if(canonical(titles)!==canonical(['基本信息','教育经历','求职意向','工作经验','职业技能与特长','附件简历','其他信息']))return stop('draft_refresh_basic_labels_changed');
   const read=before.read;
   if(read.pathname!=='/api/resume/resumeeditinfo.json'||read.searchParams.has('ver')||new Set(read.searchParams.keys()).size!==[...read.searchParams.keys()].length)return stop('draft_refresh_basic_read_route_unknown');
   let save;try{save=new URL(before.data.saveURL,PAGE);}catch{return stop('draft_refresh_basic_read_route_unknown');}
   if(typeof before.data.saveURL!=='string'||save.origin!==read.origin||save.hash||save.username||save.password)return stop('draft_refresh_basic_read_route_unknown');
   const expectedRead=read.href+(read.search?'&':'?')+'ver='+Math.floor(Math.random()*1000000),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);let response,payload;
   try{response=await fetch(expectedRead,{method:'GET',credentials:'same-origin',redirect:'error',cache:'no-store',signal:controller.signal});if(response.status!==200)return stop('draft_refresh_basic_read_http_not_200');payload=await response.json();}catch{return stop('draft_refresh_basic_read_unavailable');}finally{clearTimeout(timer);}
   const after=capture();if(after.owner!==before.owner||after.business!==before.business||after.form!==before.form||canonical(after.proof)!==baseline)return stop('draft_refresh_basic_snapshot_changed');
   if(!payload||![200,'200'].includes(payload.errno)||payload.data?.tableName!=='resume'||!payload.data.value||typeof payload.data.value!=='object')return stop('draft_refresh_basic_server_payload_unknown');
   let serverSave;try{serverSave=new URL(payload.data.saveUrl,PAGE).href;}catch{return stop('draft_refresh_basic_server_payload_unknown');}
   if(typeof payload.data.saveUrl!=='string'||serverSave!==save.href)return stop('draft_refresh_basic_server_owner_changed');
   const fields=Object.values(payload.data.value),types={'1':'inputField','2':'radioField','3':'textareaField','4':'checkboxField','5':'selectField','6':'fileField','7':'monthRangeField','8':'yearMonthField','9':'industrySignalField','10':'industryField','11':'jobCateSignalField','12':'jobCateField','13':'localeSignalField','14':'localeField','15':'pictureField','16':'dateField','17':'majorSignalField','18':'majorField','19':'monthRangeField','20':'uploadFileField','21':'educationSignalField','22':'jobQualificationSignalField','23':'majorSkillSignalField','24':'intendedPositionField','25':'intendedRankField','26':'localeSecondarySignalField','27':'localeSecondaryField'};
   if(fields.length!==9||new Set(fields.map(field=>field?.columnName)).size!==9)return stop('draft_refresh_basic_server_fields_not_unique');
   const values={};for(const field of fields){
    const matches=before.proof.config.filter(row=>row.name===field?.columnName);if(matches.length!==1||norm(field.name)!==matches[0].label)return stop('draft_refresh_basic_server_owner_changed');
    let type=types[String(field.gCustomTypeId)];if(!type)return stop('draft_refresh_basic_server_type_unknown');
    const value=['dateField','monthRangeField','yearMonthField'].includes(type)?field.valueShow:field.value;
    if(field.columnName==='resume_email'||field.columnName==='resume_mobile')type='directField';else if(field.columnName==='resume_gender')type='genderField';
    if(type!==matches[0].type||String(field.gCustomTypeId)!==String(matches[0].gCustomTypeId)||typeof value!=='string')return stop('draft_refresh_basic_server_initialization_unknown');
    if(value!==before.proof.values[field.columnName])return stop('draft_refresh_basic_values_changed');values[field.columnName]=value;
   }
   if(Object.keys(before.proof.values).some(key=>!Object.hasOwn(values,key)))return stop('draft_refresh_basic_server_owner_changed');
   baselineSource='owned_server_get';initial=before.config.map(row=>[row.name,values[row.name]]);
  }
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(initial))),last=capture();
  if(last.owner!==before.owner||last.business!==before.business||last.form!==before.form||canonical(last.proof)!==baseline)return stop('draft_refresh_basic_snapshot_changed');
  return {ok:true,data:{requestId:input.requestId,nonce:input.nonce,pageURL:PAGE,documentTimeOrigin:performance.timeOrigin,tableName:'resume',isBaseInfoSection:true,labels:before.config.map(row=>norm(row.label)),scalarInitialMatches:true,formInstanceToken:String(before.owner._uid),initialStateHash:[...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,'0')).join(''),baselineSource}};
 }catch(error){return stop(typeof error?.message==='string'&&error.message.startsWith('draft_refresh_basic_')?error.message:'draft_refresh_basic_metadata_failed');}
}
export function createGthRefreshBasicMetadataBridge({api=globalThis.chrome,lifecycleOptions={}}={}){
 const listener=(message,sender,sendResponse)=>{
  if(message?.type!=='GTH_DRAFT_REFRESH_BASIC_READ')return false;
  if(sender?.id!==api.runtime.id||sender.url!==PAGE||sender.tab?.url!==PAGE||sender.frameId!==0||!Number.isSafeInteger(sender.tab.id)||typeof message.requestId!=='string'||!/^[A-Za-z0-9-]{8,120}$/u.test(message.requestId)||!/^[a-f0-9-]{36}$/iu.test(message.nonce||'')){sendResponse({ok:false,reason:'draft_refresh_basic_wrong_sender'});return false;}
  (async()=>{
   await assertProfileBinding(api.storage.local,message.profileBinding,lifecycleOptions);const tab=await api.tabs.get(sender.tab.id),active=await api.tabs.query({active:true,lastFocusedWindow:true});
   if(tab?.url!==PAGE||active.length!==1||active[0].id!==sender.tab.id||active[0].url!==PAGE)return {ok:false,reason:'draft_refresh_basic_tab_changed'};
   const rows=await dispatchBoundSource(api.storage.local,message.profileBinding,()=>api.scripting.executeScript({target:{tabId:sender.tab.id,frameIds:[0]},world:'MAIN',func:readGthRefreshBasicMetadata,args:[message]}),lifecycleOptions);
   await assertProfileBinding(api.storage.local,message.profileBinding,lifecycleOptions);
   const finalTab=await api.tabs.get(sender.tab.id),finalActive=await api.tabs.query({active:true,lastFocusedWindow:true});
   if(finalTab?.url!==PAGE||finalActive.length!==1||finalActive[0].id!==sender.tab.id||finalActive[0].url!==PAGE)return {ok:false,reason:'draft_refresh_basic_tab_changed'};
   if(rows.length!==1||rows[0].frameId!==0||rows[0].result?.ok!==true)return {ok:false,reason:rows[0]?.result?.reason||'draft_refresh_basic_metadata_failed'};
   return {ok:true,data:{...rows[0].result.data,tabId:sender.tab.id}};
  })().then(sendResponse,()=>sendResponse({ok:false,reason:'draft_refresh_basic_metadata_failed'}));return true;
 };
 return {listener};
}
export function registerGthRefreshBasicMetadataBridge(options={}){const bridge=createGthRefreshBasicMetadataBridge(options);(options.api||globalThis.chrome).runtime.onMessage.addListener(bridge.listener);return bridge;}
