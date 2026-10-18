// Read-only MAIN-world bridge for the education-only draft saver. Public
// section.vue proves curItem.id/data[].id/editUrl and expandFormId; form.vue
// proves its formdataurl prop and tableName/saveURL/formConfig data. Never
// assigns a Vue/DOM value, calls a site method, or sends an HTTP request.
export const GTH_DRAFT_METADATA_MESSAGE='GTH_DRAFT_SAVE_METADATA_READ';
const PAGE='https://hr.gtht.com/resume/edit/';

// Self-contained because chrome.scripting serializes this function into MAIN.
export function readGthDraftMetadata(input){
  const PAGE='https://hr.gtht.com/resume/edit/';
  const TITLES=['基本信息','教育经历','求职意向','工作经验','职业技能与特长','附件简历','其他信息'];
  const LABELS=['学历','在校时间','毕业学校','专业类别','专业名称','是否统招','在校活动/职务','在校成绩排名','专业描述','绩点','学校所在地'];
  const fail=reason=>({ok:false,reason});
  const norm=value=>String(value??'').replace(/[\s\u00a0]+/gu,' ').trim();
  const validId=value=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0
    ||typeof value==='string'&&value.length>0&&value.length<=200&&!/[\u0000-\u001f]/u.test(value);
  const identity=(section,record)=>JSON.stringify([String(section),String(record)]);
  try{
    if(location.href!==PAGE||document.readyState!=='complete'||document.visibilityState!=='visible'
      ||document.wasDiscarded===true||performance.timeOrigin!==input.documentTimeOrigin)return fail('draft_main_page_changed');
    const sections=[...document.querySelectorAll('.r-section')],titles=sections.map(section=>{
      const node=section.querySelector('.title_')?.cloneNode(true);node?.querySelectorAll('a,button').forEach(child=>child.remove());return norm(node?.textContent);});
    if(JSON.stringify(titles)!==JSON.stringify(TITLES))return fail('draft_main_sections_changed');
    const section=sections[1],forms=sections.flatMap(node=>[...node.querySelectorAll('form')]);
    // Real MAIN-world inspection located the business section component on
    // the direct DIV.r-block parent. The inner .r-section has no __vue__;
    // nested ElLink instances are not owners of the resume section.
    const root=section.parentElement;
    if(root?.tagName!=='DIV'||!root.classList.contains('r-block')||!root.__vue__)return fail('draft_main_section_owner_unknown');
    const sectionOwners=[],seen=new Set();let candidate=root.__vue__;
    for(let i=0;candidate&&i<8;i++,candidate=candidate.$parent){
      if(seen.has(candidate))break;seen.add(candidate);
      const item=candidate.curItem||candidate.$props?.curItem;
      if(item?.name==='教育经历'&&validId(item.id)&&Array.isArray(item.data)
        &&['read','edit'].includes(candidate.mode))sectionOwners.push({owner:candidate,item});
    }
    if(sectionOwners.length!==1)return fail('draft_main_section_owner_unknown');
    const {owner:sectionOwner,item}=sectionOwners[0];
    if(item.data.length>30||item.data.some(row=>!validId(row?.id))
      ||new Set(item.data.map(row=>String(row.id))).size!==item.data.length)return fail('draft_main_record_identity_unknown');
    const urlSafe=value=>{const url=new URL(value,PAGE);return url.origin===new URL(PAGE).origin&&!url.hash&&!url.username&&!url.password?url:null;};
    const recordList=item.data.map((row,index)=>({index,recordIdentity:identity(item.id,row.id),formDataURL:typeof row.editUrl==='string'?urlSafe(row.editUrl)?.href:null}));
    if(recordList.some(row=>!row.formDataURL))return fail('draft_main_record_route_unknown');
    const newEditor=input.phase==='before_save'&&input.recordMarker==='new';
    const common={source:'main_world_vue',requestId:input.requestId,nonce:input.nonce,phase:input.phase,
      pageURL:PAGE,documentTimeOrigin:performance.timeOrigin,formCount:forms.length};
    if(input.phase==='closed'){
      if(forms.length!==0||sectionOwner.mode!=='read'||section.querySelectorAll('.sec-context > .sec-detail').length!==item.data.length)
        return fail('draft_main_not_closed');
      return {ok:true,data:{...common,records:recordList}};
    }
    const form=section.querySelector('form');
    if(forms.length!==1||forms[0]!==form||sectionOwner.mode!=='edit'
      ||(newEditor?(sectionOwner.isEditFlag===true||sectionOwner.expandFormId!=null
          ||section.querySelectorAll('.sec-context > .sec-detail').length!==item.data.length)
        :(sectionOwner.isEditFlag!==true||!validId(sectionOwner.expandFormId)
          ||section.querySelectorAll('.sec-context > .sec-detail').length!==item.data.length-1)))
      return fail(newEditor?'draft_main_not_new_editor':'draft_main_not_existing_editor');
    if(input.phase==='before_save'&&form.dataset.resumeGthEducationRecordIndex!==input.recordMarker)
      return fail('draft_main_record_marker_changed');
    if(newEditor&&(form.dataset.resumeGthEducationRequestId!==input.requestId
      ||form.dataset.resumeGthEducationTargetMode!=='new'))return fail('draft_main_new_request_changed');
    const records=newEditor?[]:item.data.filter(row=>String(row.id)===String(sectionOwner.expandFormId));
    if(!newEditor&&(records.length!==1||typeof records[0].editUrl!=='string'))return fail('draft_main_record_identity_unknown');
    const owners=[];candidate=form.__vue__;
    for(let i=0;candidate&&i<8;i++,candidate=candidate.$parent){const data=candidate.$data||candidate;
      if(data.isEduInfoSection===true&&data.tableName==='resume_education'&&typeof data.saveURL==='string')owners.push(candidate);}
    if(owners.length!==1)return fail('draft_main_form_owner_unknown');
    const owner=owners[0],data=owner.$data||owner,formDataURL=owner.$props?.formdataurl??owner.formdataurl;
    if(typeof formDataURL!=='string'||!Number.isSafeInteger(owner._uid)||owner._uid<0)return fail('draft_main_form_identity_unknown');
    const save=new URL(data.saveURL,PAGE),read=new URL(formDataURL,PAGE),expectedRead=new URL(newEditor?item.addUrl:records[0].editUrl,PAGE);
    const saveKeys=[...save.searchParams.keys()],allowedKeys=['customId','languageId','jid','systemUserTypeId'];
    const queryValuesSafe=[...save.searchParams.values()].every(value=>value.length>0&&value.length<=300&&!/[\u0000-\u001f]/u.test(value));
    // Existing record configuration adds one owned id. New editor saves must
    // retain the original 0/4-key contract and may never supply a record id.
    const existingRecordQuery=!newEditor&&saveKeys.length===allowedKeys.length+1
      &&new Set(saveKeys).size===saveKeys.length&&allowedKeys.every(key=>save.searchParams.has(key))&&save.searchParams.has('id')
      &&new Set(read.searchParams.keys()).size===[...read.searchParams.keys()].length
      &&save.searchParams.get('id')===String(records[0].id)&&read.searchParams.get('id')===String(records[0].id);
    const knownQuery=saveKeys.length===0||queryValuesSafe&&(saveKeys.length===allowedKeys.length&&new Set(saveKeys).size===saveKeys.length
      &&allowedKeys.every(key=>save.searchParams.has(key))||existingRecordQuery);
    if(save.origin!==new URL(PAGE).origin||save.pathname!=='/api/resume/edit.json'||!knownQuery||save.hash||save.username||save.password
      ||read.origin!==save.origin||read.hash||read.username||read.password||read.href!==expectedRead.href)return fail('draft_main_route_not_verified');
    const config=data.formConfig,labels=Array.isArray(config)?config.map(row=>norm(row?.label)):[];
    const fieldsReady=labels.length===LABELS.length&&new Set(labels).size===LABELS.length&&LABELS.every(question=>labels.includes(question))
      &&[...form.querySelectorAll('.el-form-item')].length===LABELS.length;
    if(!fieldsReady)return fail('draft_main_fields_not_loaded');
    return {ok:true,data:{...common,recordMarker:input.recordMarker,tableName:data.tableName,
      saveURL:save.href,formDataURL:read.href,formInstanceToken:String(owner._uid),
      recordIdentity:newEditor?null:identity(item.id,records[0].id),records:recordList,provisionalNewRecord:newEditor,fieldsReady:true}};
  }catch{return fail('draft_main_read_failed');}
}

export function createGthDraftMetadataBridge({api=globalThis.chrome}={}){
  const listener=(message,sender,sendResponse)=>{
    if(message?.type!==GTH_DRAFT_METADATA_MESSAGE)return false;
    const valid=sender?.id===api.runtime.id&&Number.isSafeInteger(sender.tab?.id)&&sender.tab.id>=0
      &&sender.url===PAGE&&sender.tab.url===PAGE&&sender.frameId===0
      &&typeof message.requestId==='string'&&/^[A-Za-z0-9-]{8,120}$/u.test(message.requestId)
      &&(message.recordMarker==='new'||typeof message.recordMarker==='string'&&/^(?:[0-9]|[12][0-9])$/u.test(message.recordMarker))&&['before_save','closed','after_reopen'].includes(message.phase)
      &&typeof message.nonce==='string'&&/^[a-f0-9-]{36}$/iu.test(message.nonce)&&Number.isFinite(message.documentTimeOrigin);
    if(!valid){sendResponse({ok:false,reason:'draft_metadata_wrong_sender_or_request'});return false;}
    (async()=>{
      const tab=await api.tabs.get(sender.tab.id),active=await api.tabs.query({active:true,lastFocusedWindow:true});
      if(tab?.url!==PAGE||active.length!==1||active[0].id!==tab.id||active[0].url!==PAGE)return {ok:false,reason:'draft_metadata_tab_changed'};
      const result=await api.scripting.executeScript({target:{tabId:tab.id,frameIds:[0]},world:'MAIN',func:readGthDraftMetadata,
        args:[{requestId:message.requestId,recordMarker:message.recordMarker,phase:message.phase,nonce:message.nonce,documentTimeOrigin:message.documentTimeOrigin}]});
      if(result.length!==1||result[0].frameId!==0)return {ok:false,reason:'draft_metadata_frame_changed'};
      return result[0].result?.ok===true?{ok:true,data:{...result[0].result.data,tabId:tab.id}}
        :{ok:false,reason:result[0].result?.reason||'draft_metadata_unavailable'};
    })().then(sendResponse,()=>sendResponse({ok:false,reason:'draft_metadata_unavailable'}));return true;
  };
  return {listener};
}
export function registerGthDraftMetadataBridge(options={}){
  const bridge=createGthDraftMetadataBridge(options);(options.api||globalThis.chrome).runtime.onMessage.addListener(bridge.listener);return bridge;
}
