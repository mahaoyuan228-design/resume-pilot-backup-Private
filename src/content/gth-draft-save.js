// Education-only product draft save. Never posts an API, writes a field,
// uploads, deletes, or submits a job application. The worker must provide the
// read-only MAIN-world metadata bridge described at the bottom of this file.
(() => {
  const old=globalThis.ResumeGthDraftSave;
  if(old?.listener)try{chrome.runtime.onMessage.removeListener(old.listener);}catch{}
  const PAGE='https://hr.gtht.com/resume/edit/',PATH='/api/resume/edit.json';
  const TITLES=['基本信息','教育经历','求职意向','工作经验','职业技能与特长','附件简历','其他信息'];
  const TEXT=[['毕业学校','school','input'],['专业名称','major','input'],
    ['在校活动/职务','campusActivities','textarea'],['在校成绩排名','gradeRank','input'],
    ['专业描述','majorDescription','textarea'],['绩点','gpa','input'],['学校所在地','schoolLocation','input']];
  const KEYS=[...TEXT.map(([,key])=>key),'unifiedAdmissions','degree','startDate','endDate','majorCategory'];
  const LABELS=[...TEXT.map(([label])=>label),'是否统招','学历','在校时间','专业类别'];
  const REQUIRED=['school','major','schoolLocation','unifiedAdmissions','degree','startDate','endDate','majorCategory'];
  const PREFIX='resumeGthDraftSave:';
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const bounded=(promise,code,ms=8000)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Stop(code)),ms);
    Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});});
  const norm=value=>String(value??'').replace(/[\s\u00a0]+/gu,' ').trim();
  const visible=node=>!!node?.getClientRects().length&&getComputedStyle(node).display!=='none'&&getComputedStyle(node).visibility!=='hidden';
  const stable=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)
    ?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
  const sha=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stable(value))))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  // After refresh, outside may still equal the pre-save hash, or — when Save
  // already proved attachment-section text-only drift — the post-save hash.
  const refreshOutsideOk=async(outsideValue,proof)=>{const current=await sha(outsideValue);return current===proof.originalOutsideHash||proof.onlyAttachmentTextChanged===true&&current===proof.postSaveOutsideHash;};
  class Stop extends Error{constructor(code){super(code);this.code=code;}}
  const stop=code=>{throw new Stop(code);};
  // Reinjection can replace a listener while its old async Save still runs.
  // Share only the small execution lock across same-document reinjections.
  const activeKey=Symbol.for('resume.gth.draft.active.v1');
  const state=globalThis[activeKey]||(globalThis[activeKey]={busy:false,requestId:null});
  // Applicant values remain only in same-document memory between Inspect/Save.
  // Persisted receipts and phase proofs contain hashes and opaque record IDs.
  const inspectionKey=Symbol.for('resume.gth.draft.inspections.v2');
  const inspections=globalThis[inspectionKey]||(globalThis[inspectionKey]=new Map());
  if(old?.onStorageChanged)try{chrome.storage.onChanged?.removeListener(old.onStorageChanged);}catch{}
  const onStorageChanged=(changes,area)=>{if(area==='local'&&(changes.resumeProfile||changes.resumeProfileLifecycle))inspections.clear();};
  chrome.storage.onChanged?.addListener(onStorageChanged);
  const key=requestId=>PREFIX+requestId;
  function request(input){if(typeof input?.requestId!=='string'||!/^[A-Za-z0-9-]{8,120}$/u.test(input.requestId)
    ||!(input.recordMarker==='new'||typeof input.recordMarker==='string'&&/^(?:[0-9]|[12][0-9])$/u.test(input.recordMarker))
    ||input.targetMode!==undefined&&input.targetMode!==(input.recordMarker==='new'?'new':'existing'))stop('draft_request_invalid');}
  function page(){
    if(location.href!==PAGE)stop('draft_wrong_page');
    if(document.readyState!=='complete'||document.wasDiscarded===true)stop('draft_page_not_ready');
    if(document.visibilityState!=='visible')stop('draft_page_hidden');
    const sections=[...document.querySelectorAll('.r-section')];
    const titles=sections.map(section=>{const node=section.querySelector('.title_')?.cloneNode(true);node?.querySelectorAll('a,button').forEach(child=>child.remove());return norm(node?.textContent);});
    if(stable(titles)!==stable(TITLES))stop('draft_sections_changed');
    return sections;
  }
  const forms=sections=>sections.flatMap(section=>[...section.querySelectorAll('form')]);
  const rows=section=>[...section.querySelectorAll('.sec-context > .sec-detail')];
  const footprint=root=>[root.textContent||'',[...root.querySelectorAll('input,select,textarea')].map(node=>[
    node.tagName,node.type||'',node.value||'',!!node.checked,node.selectedIndex??null,
    [...(node.files||[])].map(file=>[file.name,file.size,file.type])]),
    [...root.querySelectorAll('img')].map(node=>node.getAttribute('src')||''),
    [...root.querySelectorAll('[contenteditable]')].map(node=>node.textContent||'')];
  const outside=sections=>sections.filter((_,index)=>index!==1).map(footprint);
  const menus=()=>[...document.querySelectorAll('.el-select-dropdown,.el-picker-panel,.popover.plugin-dialog-wrap,.el-dialog,.el-message-box,[role=dialog]')].filter(visible);
  const label=item=>{const labels=[...item.querySelectorAll('.el-form-item__label')].filter(node=>node.closest('.el-form-item')===item);return labels.length===1?norm(labels[0].textContent):'';};
  function button(form,text){const found=[...form.querySelectorAll('button')].filter(node=>node.closest('form')===form
    &&visible(node)&&node.type==='button'&&!node.disabled&&!node.hasAttribute('formaction')&&norm(node.textContent)===text);
    if(found.length!==1)stop('draft_button_not_unique');return found[0];}
  function capture(recordMarker,{requireMarker=true,recordCount=null}={}){
    const sections=page(),all=forms(sections),form=sections[1].querySelector('form');
    if(all.length!==1||all[0]!==form||menus().length)stop('draft_editor_not_unique');
    const newEditor=recordMarker==='new',marked=form.dataset.resumeGthEducationRecordCount;
    const count=recordCount??(marked!==undefined?Number(marked):rows(sections[1]).length+(newEditor?0:1));
    if(!Number.isInteger(count)||count<0||count>30||newEditor&&count>=30
      ||rows(sections[1]).length!==count-(newEditor?0:1))stop('draft_record_count_changed');
    if(requireMarker&&form.dataset.resumeGthEducationRecordIndex!==recordMarker)stop('draft_record_marker_changed');
    const items=[...form.querySelectorAll('.el-form-item')],labels=items.map(label);
    if(labels.length!==LABELS.length||new Set(labels).size!==LABELS.length||LABELS.some(question=>!labels.includes(question)))stop('draft_questions_changed');
    const item=question=>items[labels.indexOf(question)],values={},targets=[];
    for(const [question,name,type]of TEXT){const own=item(question),controls=[...own.querySelectorAll('input,textarea,select')]
      .filter(node=>node.closest('.el-form-item')===own&&visible(node)&&!node.closest('.plugin-dialog-wrap'));
      const node=controls[0];if(controls.length!==1||type==='textarea'&&node?.tagName!=='TEXTAREA'
        ||type==='input'&&(node?.tagName!=='INPUT'||node.type!=='text')||node.disabled||node.readOnly
        ||own.querySelector('.el-select,.el-date-editor,.el-cascader,.cascader-wrap'))stop('draft_plain_shape_changed');
      values[name]=node.value;targets.push(node);
    }
    const diploma=item('学历'),degree=[...diploma.querySelectorAll('.el-select input[type=text]')].filter(visible);
    if(degree.length!==1||!degree[0].readOnly)stop('draft_degree_shape_changed');
    values.degree=degree[0].value;targets.push(degree[0]);
    const dates=[...item('在校时间').querySelectorAll('.el-date-editor')];
    if(dates.length!==2||dates.some(node=>!node.classList.contains('el-date-editor--month')))stop('draft_date_shape_changed');
    dates.forEach((date,index)=>{const controls=[...date.querySelectorAll('input[type=text]')].filter(visible);
      if(controls.length!==1||!controls[0].readOnly||controls[0].disabled)stop('draft_date_shape_changed');
      values[index?'endDate':'startDate']=controls[0].value;targets.push(controls[0]);});
    const category=[...item('专业类别').querySelectorAll('.cascader-wrap input[type=text]')].filter(node=>visible(node)&&!node.closest('.plugin-dialog-wrap'));
    if(category.length!==1||!category[0].readOnly||category[0].disabled)stop('draft_category_shape_changed');
    values.majorCategory=category[0].value;targets.push(category[0]);
    const radio=[...item('是否统招').querySelectorAll('label.el-radio')],chosen=radio.filter(node=>node.querySelector('input[type=radio]')?.checked);
    if(radio.length!==2||radio.some(node=>!visible(node)||node.querySelectorAll('input[type=radio]').length!==1)
      ||new Set(radio.map(node=>norm(node.querySelector('.el-radio__label')?.textContent))).size!==2
      ||radio.some(node=>!['是','否'].includes(norm(node.querySelector('.el-radio__label')?.textContent)))||chosen.length!==1)stop('draft_radio_shape_changed');
    values.unifiedAdmissions=norm(chosen[0].querySelector('.el-radio__label').textContent);
    if(KEYS.some(name=>typeof values[name]!=='string'||values[name].length>4000)||REQUIRED.some(name=>!values[name])
      ||!['是','否'].includes(values.unifiedAdmissions)||!/^\d{4}-(0[1-9]|1[0-2])$/u.test(values.startDate)
      ||!/^\d{4}-(0[1-9]|1[0-2])$/u.test(values.endDate)||values.startDate>values.endDate)stop('draft_required_values_missing');
    if(items.some(own=>own.classList.contains('is-error')||own.classList.contains('is-validating')
      ||[...own.querySelectorAll('.el-form-item__error')].some(node=>visible(node)&&norm(node.textContent))
      ||[...own.querySelectorAll('input,textarea,select')].some(node=>node.getAttribute('aria-invalid')==='true'||node.validity&&node.validity.valid===false)))stop('draft_site_validation_failed');
    button(form,'保存');button(form,'取消');
    return {form,sections,values,recordCount:count,degreeSiteReadOnly:degree[0].disabled===true,
      boundary:{timeOrigin:performance.timeOrigin,values,degreeSiteReadOnly:degree[0].disabled===true,
        outside:outside(sections),neighbor:rows(sections[1]).map(footprint),form:footprint(form)}};
  }
  async function verifiedSource(requestId,recordMarker,profileBinding){
    const listener=globalThis.ResumeGthEducationTextTrial?.listener;
    if(typeof listener!=='function')stop('draft_source_status_unavailable');
    const response=await bounded(new Promise((resolve,reject)=>{
      try{listener({type:'GTH_EDUCATION_FULL_TRIAL_STATUS',requestId,profileBinding},{id:chrome.runtime.id},resolve);}catch(error){reject(error);}
    }),'draft_source_status_timeout');
    const row=response?.data;
    if(response?.ok!==true||row?.requestId!==requestId||row.state!=='settled'||row.outcome!=='verified')stop('draft_source_not_verified');
    if(recordMarker==='new'&&(row.targetMode!=='new'||row.recordMarker!=='new'||row.provisionalNewRecord!==true))stop('draft_source_binding_changed');
    return row;
  }
  async function bridge(input,phase){
    const nonce=crypto.randomUUID();let result;
    try{result=await bounded(chrome.runtime.sendMessage({type:'GTH_DRAFT_SAVE_METADATA_READ',requestId:input.requestId,
      recordMarker:input.recordMarker,targetMode:input.recordMarker==='new'?'new':'existing',phase,nonce,documentTimeOrigin:performance.timeOrigin}),'draft_metadata_timeout');}catch{stop('draft_metadata_bridge_unavailable');}
    const data=result?.data;
    if(result?.ok!==true||data?.source!=='main_world_vue'||data.requestId!==input.requestId||data.nonce!==nonce
      ||data.phase!==phase||data.pageURL!==PAGE||data.documentTimeOrigin!==performance.timeOrigin
      ||!Number.isSafeInteger(data.tabId)||data.tabId<0)stop('draft_metadata_not_verified');
    const validRecords=Array.isArray(data.records)&&data.records.length<=30
      &&data.records.every((row,index)=>row.index===index&&typeof row.recordIdentity==='string'&&row.recordIdentity.length>0&&row.recordIdentity.length<=400
        &&typeof row.formDataURL==='string'&&(()=>{try{const url=new URL(row.formDataURL,PAGE);return url.origin===new URL(PAGE).origin&&!url.hash&&!url.username&&!url.password;}catch{return false;}})())
      &&new Set(data.records.map(row=>row.recordIdentity)).size===data.records.length;
    if(!validRecords)stop('draft_closed_identity_unknown');
    if(phase==='closed'){if(data.formCount!==0)stop('draft_closed_identity_unknown');return data;}
    if(data.formCount!==1||data.recordMarker!==input.recordMarker||data.tableName!=='resume_education'||data.fieldsReady!==true
      ||(phase==='before_save'&&input.recordMarker==='new'?data.recordIdentity!==null||data.provisionalNewRecord!==true
        :typeof data.recordIdentity!=='string'||!data.recordIdentity||data.recordIdentity.length>400)
      ||typeof data.formInstanceToken!=='string'||!data.formInstanceToken||data.formInstanceToken.length>100
      ||typeof data.formDataURL!=='string')stop('draft_metadata_not_verified');
    let url,read;try{url=new URL(data.saveURL,PAGE);read=new URL(data.formDataURL,PAGE);}catch{stop('draft_route_not_verified');}
    const keys=[...url.searchParams.keys()],allowed=['customId','languageId','jid','systemUserTypeId'];
    const queryValuesSafe=[...url.searchParams.values()].every(value=>value.length>0&&value.length<=300&&!/[\u0000-\u001f]/u.test(value));
    let existingRecordQuery=false;
    if(!(phase==='before_save'&&input.recordMarker==='new')&&keys.length===allowed.length+1
      &&new Set(keys).size===keys.length&&allowed.every(key=>url.searchParams.has(key))&&url.searchParams.has('id')){
      let identity;try{identity=JSON.parse(data.recordIdentity);}catch{stop('draft_route_not_verified');}
      existingRecordQuery=Array.isArray(identity)&&identity.length===2&&identity.every(value=>typeof value==='string'&&value.length>0&&value.length<=200&&!/[\u0000-\u001f]/u.test(value))
        &&new Set(read.searchParams.keys()).size===[...read.searchParams.keys()].length
        &&url.searchParams.get('id')===identity[1]&&read.searchParams.get('id')===identity[1]
        &&data.records.filter(row=>row.recordIdentity===data.recordIdentity&&new URL(row.formDataURL,PAGE).href===read.href).length===1;
    }
    const knownQuery=keys.length===0||queryValuesSafe&&(keys.length===allowed.length&&new Set(keys).size===keys.length
      &&allowed.every(key=>url.searchParams.has(key))||existingRecordQuery);
    if(url.origin!==new URL(PAGE).origin||url.pathname!==PATH||!knownQuery||url.hash||url.username||url.password
      ||read.origin!==url.origin||read.hash||read.username||read.password)stop('draft_route_not_verified');
    return {...data,saveURL:url.href,formDataURL:read.href};
  }
  async function paid(){try{if(chrome.runtime.getManifest().background?.service_worker==='src/license/guard-worker.mjs'){
    if((await chrome.runtime.sendMessage({type:'RESUME_PAID_VERIFY'}))?.allowed!==true)stop('license_required');}}
    catch{stop('license_required');}}
  async function bound(input){
    const result=await bounded(chrome.runtime.sendMessage({type:'RESUME_PROFILE_BINDING_CHECK',profileBinding:input?.profileBinding}),'profile_binding_unavailable');
    if(result?.allowed!==true){inspections.clear();stop(/^profile_[a-z_]+$/u.test(result?.reason||'')?result.reason:'profile_binding_unavailable');}
  }
  const readReceipt=async requestId=>(await chrome.storage.local.get(key(requestId)))[key(requestId)]||null;
  async function inspect(input){try{
    request(input);await paid();await bound(input);if(state.busy||await readReceipt(input.requestId))stop('draft_request_already_reserved');
    await verifiedSource(input.requestId,input.recordMarker,input.profileBinding);const current=capture(input.recordMarker),hash=await sha(current.boundary),metadata=await bridge(input,'before_save');
    if(await sha(capture(input.recordMarker).boundary)!==hash)stop('draft_snapshot_changed');
    if(metadata.records.length!==current.recordCount)stop('draft_record_count_changed');
    const expectedSnapshot={version:1,requestId:input.requestId,recordMarker:input.recordMarker,
      targetMode:input.recordMarker==='new'?'new':'existing',recordCount:current.recordCount,records:metadata.records,saveURL:metadata.saveURL,pageURL:PAGE,
      documentTimeOrigin:performance.timeOrigin,values:current.values,degreeSiteReadOnly:current.degreeSiteReadOnly,
      boundaryHash:hash,outsideHash:await sha(current.boundary.outside),neighborHash:await sha(current.boundary.neighbor),
      outsideSectionHashes:await Promise.all(current.boundary.outside.map(value=>sha(value))),
      outsideNonTextHashes:await Promise.all(current.boundary.outside.map(value=>sha(value.slice(1)))),
      recordIdentity:metadata.recordIdentity,formDataURL:metadata.formDataURL,formInstanceToken:metadata.formInstanceToken};
    expectedSnapshot.profileBinding=input.profileBinding;
    expectedSnapshot.fingerprint=await sha(expectedSnapshot);await bound(input);
    inspections.set(input.requestId,expectedSnapshot);while(inspections.size>20)inspections.delete(inspections.keys().next().value);
    return {ok:true,expectedSnapshot,readyToSave:true,softwareClickedSave:false};
  }catch(error){return {ok:false,reason:error instanceof Stop?error.code:'draft_inspect_failed',readyToSave:false,softwareClickedSave:false};}}
  async function save(input){
    let receipt=null,priorReceipt=null,reserved=false,dispatched=false,ownsBusy=false,ownPending=false,pendingName=null,pendingExpected=null,editClicks=0,cancelClicks=0;
    const write=async patch=>{await bound(input);receipt={...receipt,...patch};await chrome.storage.local.set({[key(input.requestId)]:receipt});};
    try{
      request(input);await paid();await bound(input);if(state.busy)stop('draft_request_already_reserved');
      priorReceipt=await readReceipt(input.requestId);if(state.busy||priorReceipt)stop('draft_request_already_reserved');
      if(input.draftSaveAuthorized!==true)stop('draft_save_not_authorized');
      state.busy=true;state.requestId=input.requestId;ownsBusy=true;
      const expected=input.expectedSnapshot||inspections.get(input.requestId);
      if(input.expectedFingerprint!==undefined&&expected?.fingerprint!==input.expectedFingerprint)stop('draft_expected_snapshot_invalid');
      if(!expected||expected.version!==1||expected.requestId!==input.requestId||expected.recordMarker!==input.recordMarker
        ||expected.pageURL!==PAGE||expected.documentTimeOrigin!==performance.timeOrigin
        ||!/^[a-f0-9]{64}$/u.test(expected.fingerprint||'')||await sha({...expected,fingerprint:undefined})!==expected.fingerprint)stop('draft_expected_snapshot_invalid');
      if(stable(expected.profileBinding)!==stable(input.profileBinding))stop('profile_binding_changed');
      await verifiedSource(input.requestId,input.recordMarker,input.profileBinding);
      const current=capture(input.recordMarker),hash=await sha(current.boundary);
      if(hash!==expected.boundaryHash||stable(current.values)!==stable(expected.values))stop('draft_snapshot_changed');
      const metadata=await bridge(input,'before_save');
      if(metadata.recordIdentity!==expected.recordIdentity||metadata.formDataURL!==expected.formDataURL||metadata.saveURL!==expected.saveURL
        ||metadata.formInstanceToken!==expected.formInstanceToken||stable(metadata.records)!==stable(expected.records)
        ||current.recordCount!==expected.recordCount||expected.targetMode!==(input.recordMarker==='new'?'new':'existing'))stop('draft_identity_changed');
      pendingName=`resumePendingFillReview:${metadata.tabId}`;
      const priorPending=(await chrome.storage.local.get(pendingName))[pendingName];
      if(priorPending){
        if(typeof input.lockOwnerRequestId!=='string'||!/^[A-Za-z0-9-]{8,120}$/u.test(input.lockOwnerRequestId)
          ||priorPending.requestId!==input.lockOwnerRequestId||priorPending.tabId!==metadata.tabId||priorPending.origin!==new URL(PAGE).origin)stop('draft_existing_pending_review');
        pendingExpected=priorPending;
      }else{
        if(input.lockOwnerRequestId!==undefined)stop('draft_parent_lock_missing');
        ownPending=true;pendingExpected={tabId:metadata.tabId,origin:new URL(PAGE).origin,requestId:input.requestId,
          kind:'gth_education_draft_save',recordMarker:input.recordMarker,at:Date.now()};
      }
      const again=capture(input.recordMarker);
      if(again.form!==current.form||await sha(again.boundary)!==hash)stop('draft_snapshot_changed');
      await verifiedSource(input.requestId,input.recordMarker,input.profileBinding);
      receipt={version:1,kind:'gth_education_draft_save',requestId:input.requestId,recordMarker:input.recordMarker,
        expectedFingerprint:expected.fingerprint,state:'save_intent',at:Date.now(),softwareClickedSave:false,saveClickCount:0,
        serverReadbackMatched:false,saveRequestAcknowledged:null,networkStatus:null,refreshVerified:false,pendingReviewRequired:true};
      await bound(input);
      receipt.profileBinding=input.profileBinding;
      await chrome.storage.local.set({[key(input.requestId)]:receipt,...(ownPending?{[pendingName]:pendingExpected}:{})});reserved=true;
      // There is deliberately no direct HTTP call and no retry of this click.
      const final=capture(input.recordMarker);
      if(final.form!==current.form||await sha(final.boundary)!==hash)stop('draft_snapshot_changed');
      if(stable((await chrome.storage.local.get(pendingName))[pendingName])!==stable(pendingExpected))stop('draft_pending_lock_changed');
      const immediate=capture(input.recordMarker);await verifiedSource(input.requestId,input.recordMarker,input.profileBinding);
      if(immediate.form!==final.form||stable(immediate.boundary)!==stable(final.boundary))stop('draft_snapshot_changed');
      await verifiedSource(input.requestId,input.recordMarker,input.profileBinding);
      await bound(input);const readySave=capture(input.recordMarker);
      if(readySave.form!==immediate.form||stable(readySave.boundary)!==stable(immediate.boundary))stop('draft_snapshot_changed');
      dispatched=true;button(readySave.form,'保存').click();
      await write({state:'awaiting_closed',softwareClickedSave:true,saveClickCount:1});
      const creating=expected.targetMode==='new',closedCount=expected.recordCount+(creating?1:0);
      const deadline=Date.now()+20000;let closed=null;
      do{
        await pause(100);const sections=page();
        if(performance.timeOrigin!==expected.documentTimeOrigin)stop('draft_document_changed');
        if(forms(sections).length===0&&rows(sections[1]).length===closedCount&&!menus().length){closed=sections;break;}
      }while(Date.now()<deadline);
      if(!closed)stop('draft_save_result_unknown');
      const postSaveOutsideHash=await sha(outside(closed)),outsideHashes=await Promise.all(outside(closed).map(value=>sha(value))),sectionIndexes=[0,2,3,4,5,6];
      const changedSectionIndexes=sectionIndexes.filter((_,index)=>outsideHashes[index]!==expected.outsideSectionHashes?.[index]);
      const attachmentIndex=sectionIndexes.indexOf(5),onlyAttachmentTextChanged=changedSectionIndexes.length===1&&changedSectionIndexes[0]===5
        &&await sha(outside(closed)[attachmentIndex].slice(1))===expected.outsideNonTextHashes?.[attachmentIndex];
      const mapping=await bridge(input,'closed'),oldIds=expected.records.map(row=>row.recordIdentity),newIds=mapping.records.map(row=>row.recordIdentity);
      if(mapping.records.length!==closedCount||oldIds.some(id=>!newIds.includes(id))
        ||stable(newIds.filter(id=>oldIds.includes(id)))!==stable(oldIds))stop('draft_closed_identity_unknown');
      const inserted=mapping.records.filter(row=>!oldIds.includes(row.recordIdentity));
      if(creating&&inserted.length!==1||!creating&&inserted.length!==0)stop('draft_new_identity_unknown');
      const matches=creating?inserted:mapping.records.filter(row=>row.recordIdentity===expected.recordIdentity);
      if(matches.length!==1)stop('draft_closed_identity_unknown');
      const savedIdentity=matches[0].recordIdentity,savedReadURL=matches[0].formDataURL;
      const index=matches[0].index,all=rows(closed[1]),target=all[index],neighbor=all.filter((_,row)=>row!==index).map(footprint);
      if(await sha(neighbor)!==expected.neighborHash)stop('draft_neighbor_changed');
      const edits=[...target.querySelectorAll('a')].filter(node=>visible(node)&&node.querySelector('.el-icon-edit-outline'));
      if(edits.length!==1||edits[0].getAttribute('href')&&!/^(#|javascript:(?:;|void\(0\)))$/iu.test(edits[0].getAttribute('href')))stop('draft_readback_edit_not_unique');
      const closedSerialized=stable(closed.map(footprint)),closedHash=await sha(closed.map(footprint));
      if(await sha(page().map(footprint))!==closedHash||forms(page()).length!==0)stop('draft_closed_boundary_changed');
      await write({state:'reopening_for_server_readback'});
      if(stable(page().map(footprint))!==closedSerialized||forms(page()).length!==0)stop('draft_closed_boundary_changed');
      await bound(input);if(stable(page().map(footprint))!==closedSerialized||forms(page()).length!==0)stop('draft_closed_boundary_changed');edits[0].click();editClicks=1;
      let reopened=null;const readDeadline=Date.now()+20000;
      do{await pause(100);try{reopened=capture(String(index),{requireMarker:false,recordCount:closedCount});break;}
        catch(error){if(!(error instanceof Stop)||!['draft_editor_not_unique','draft_questions_changed','draft_plain_shape_changed','draft_degree_shape_changed','draft_date_shape_changed','draft_category_shape_changed','draft_radio_shape_changed','draft_required_values_missing'].includes(error.code))throw error;}
      }while(Date.now()<readDeadline);
      if(!reopened)stop('draft_server_readback_unavailable');
      const readMetadata=await bridge(input,'after_reopen');
      if(readMetadata.recordIdentity!==savedIdentity||readMetadata.formDataURL!==savedReadURL
        ||readMetadata.formInstanceToken===expected.formInstanceToken||reopened.form===current.form)stop('draft_server_readback_identity_changed');
      if(stable(reopened.values)!==stable(expected.values)||reopened.degreeSiteReadOnly!==expected.degreeSiteReadOnly)stop('draft_server_readback_mismatch');
      if(await sha(reopened.boundary.outside)!==postSaveOutsideHash||await sha(reopened.boundary.neighbor)!==expected.neighborHash)stop('draft_neighbor_changed');
      const readHash=await sha(reopened.boundary);await pause(150);
      const stableRead=capture(String(index),{requireMarker:false,recordCount:closedCount});
      if(stableRead.form!==reopened.form||await sha(stableRead.boundary)!==readHash)stop('draft_server_readback_changed');
      // Cancel only this newly loaded, untouched readback form. The saved
      // server record is retained; no field or Vue model is assigned here.
      const cancelRead=capture(String(index),{requireMarker:false,recordCount:closedCount});
      if(cancelRead.form!==stableRead.form||stable(cancelRead.boundary)!==stable(stableRead.boundary))stop('draft_server_readback_changed');
      await bound(input);const readyCancel=capture(String(index),{requireMarker:false,recordCount:closedCount});if(readyCancel.form!==cancelRead.form||stable(readyCancel.boundary)!==stable(cancelRead.boundary))stop('draft_server_readback_changed');button(readyCancel.form,'取消').click();cancelClicks=1;
      const cancelDeadline=Date.now()+5000;let finalSections=null;
      do{await pause(100);const sections=page();if(!forms(sections).length&&rows(sections[1]).length===closedCount&&!menus().length){finalSections=sections;break;}}while(Date.now()<cancelDeadline);
      if(!finalSections||await sha(outside(finalSections))!==postSaveOutsideHash||await sha(finalSections.map(footprint))!==closedHash)stop('draft_readback_cancel_unverified');
      const finalMapping=await bridge(input,'closed'),finalTarget=finalMapping.records.filter(row=>row.recordIdentity===savedIdentity);
      if(stable(finalMapping.records)!==stable(mapping.records)||finalTarget.length!==1||await sha(rows(finalSections[1]).filter((_,row)=>row!==finalTarget[0].index).map(footprint))!==expected.neighborHash)stop('draft_neighbor_changed');
      if(stable((await chrome.storage.local.get(pendingName))[pendingName])!==stable(pendingExpected))stop('draft_pending_lock_changed');
      const phaseProof={version:1,requestId:input.requestId,pageURL:PAGE,recordMarker:input.recordMarker,targetMode:expected.targetMode,profileBinding:input.profileBinding,
        documentTimeOrigin:performance.timeOrigin,lockOwnerRequestId:input.lockOwnerRequestId??input.requestId,savedRecordIdentity:savedIdentity,savedReadURLHash:await sha(savedReadURL),recordIdentities:newIds,
        recordCountBefore:expected.recordCount,recordCountAfter:closedCount,targetValuesHash:await sha(reopened.values),degreeSiteReadOnly:reopened.degreeSiteReadOnly,
        neighborHash:expected.neighborHash,originalOutsideHash:expected.outsideHash,postSaveOutsideHash,closedBeforeRefreshHash:closedHash,
        originalOutsidePreserved:postSaveOutsideHash===expected.outsideHash,changedSectionIndexes,onlyAttachmentTextChanged,
        refreshSafe:postSaveOutsideHash===expected.outsideHash||onlyAttachmentTextChanged,matchingAtoms:12,saveClickCount:1};
      phaseProof.proofHash=await sha(phaseProof);
      await write({state:'server_verified_needs_refresh',targetMode:expected.targetMode,newRecordCreated:creating,recordCountBefore:expected.recordCount,recordCountAfter:closedCount,
        complete:false,targetSaved:true,phaseProof,serverReadbackMatched:true,serverReadbackFields:12,otherSectionsPreserved:phaseProof.originalOutsidePreserved,
        currentOtherSectionsPreserved:true,otherRecordPreserved:true,readbackEditorClosed:true,editClicks,cancelClicks,pendingReviewRequired:true,refreshVerified:false});
      inspections.delete(input.requestId);
      return {ok:true,...receipt,complete:false,savedOnSite:true,submitted:false,softwareClickedSubmit:false};
    }catch(error){
      const reason=error instanceof Stop?error.code:'draft_save_failed';
      if(reserved)try{await write({state:dispatched?'unknown':'stopped_before_write',reason,softwareClickedSave:dispatched,
        saveClickCount:dispatched?1:0,editClicks,cancelClicks,pendingReviewRequired:dispatched});}catch{}
      if(reserved&&ownPending&&!dispatched)try{if(stable((await chrome.storage.local.get(pendingName))[pendingName])===stable(pendingExpected))await chrome.storage.local.remove(pendingName);}catch{}
      const pendingReviewRequired=dispatched||priorReceipt?.pendingReviewRequired===true||!ownsBusy&&state.busy
        ||['draft_existing_pending_review','draft_pending_lock_changed'].includes(reason);
      return {ok:false,...(receipt||{}),requestId:input?.requestId,reason,state:dispatched?'unknown':'stopped_before_write',
        softwareClickedSave:dispatched,saveClickCount:dispatched?1:0,pendingReviewRequired,
        savedOnSite:null,networkStatus:null,refreshVerified:false,submitted:false,softwareClickedSubmit:false};
    }finally{if(ownsBusy){state.busy=false;state.requestId=null;}}
  }
  async function cancelUnchangedInitialBasic(input,proof){
    const sections=page(),all=forms(sections);if(!all.length)return 0;
    const form=sections[0].querySelector('form'),labels=['姓名','性别','手机号码','出生年月','电子邮件','现居住地','最高学历','照片','参加工作时间'];
    const clear=()=>{const current=page(),items=[...form.querySelectorAll('.el-form-item')];
      if(forms(current).length!==1||forms(current)[0]!==form||menus().length||items.length!==9||new Set(items.map(label)).size!==9||labels.some(question=>!items.some(item=>label(item)===question))
        ||form.contains(document.activeElement)||items.some(item=>item.classList.contains('is-error')||item.classList.contains('is-validating')||[...item.querySelectorAll('.el-form-item__error')].some(node=>visible(node)&&norm(node.textContent))))stop('draft_refresh_basic_editor_not_untouched');
      button(form,'取消');return current;};
    if(all.length!==1||all[0]!==form||performance.timeOrigin===proof.documentTimeOrigin)stop('draft_refresh_editor_or_menu_open');
    const readInitial=async()=>{const nonce=crypto.randomUUID(),result=await bounded(chrome.runtime.sendMessage({type:'GTH_DRAFT_REFRESH_BASIC_READ',requestId:input.requestId,nonce,documentTimeOrigin:performance.timeOrigin,profileBinding:input.profileBinding}),'draft_refresh_basic_metadata_timeout');
      const data=result?.data;if(result?.ok!==true)stop(result?.reason||'draft_refresh_basic_metadata_failed');
      if(data?.requestId!==input.requestId||data.nonce!==nonce||data.pageURL!==PAGE||data.documentTimeOrigin!==performance.timeOrigin||data.scalarInitialMatches!==true||data.tableName!=='resume'||data.isBaseInfoSection!==true
        ||!/^[a-f0-9]{64}$/u.test(data.initialStateHash||'')||typeof data.formInstanceToken!=='string'||!Number.isSafeInteger(data.tabId))stop('draft_refresh_basic_initial_values_unknown');return data;};
    const before=clear(),serialized=stable(before.map(footprint)),otherSix=stable(before.slice(1).map(footprint)),first=await readInitial();
    const pendingName=`resumePendingFillReview:${first.tabId}`,pending=(await chrome.storage.local.get(pendingName))[pendingName];
    if(input.lockOwnerRequestId!==proof.lockOwnerRequestId||pending?.requestId!==proof.lockOwnerRequestId||pending.tabId!==first.tabId||pending.origin!==new URL(PAGE).origin)stop('draft_pending_lock_changed');
    await pause(150);if(stable(clear().map(footprint))!==serialized)stop('draft_refresh_basic_dom_changed');const second=await readInitial();
    if(first.formInstanceToken!==second.formInstanceToken||first.initialStateHash!==second.initialStateHash)stop('draft_refresh_basic_values_changed');
    const receipt=await readReceipt(input.requestId);if(receipt?.autoBasicCancelIntent)stop('draft_refresh_basic_cancel_already_attempted');
    await bound(input);await chrome.storage.local.set({[key(input.requestId)]:{...receipt,autoBasicCancelIntent:{documentTimeOrigin:performance.timeOrigin,formInstanceToken:first.formInstanceToken,initialStateHash:first.initialStateHash}}});
    const last=await readInitial();if(stable((await chrome.storage.local.get(pendingName))[pendingName])!==stable(pending))stop('draft_pending_lock_changed');
    if(last.formInstanceToken!==first.formInstanceToken||last.initialStateHash!==first.initialStateHash||stable(clear().map(footprint))!==serialized)stop('draft_refresh_basic_dom_changed');
    // The MAIN proof and lease reads above are asynchronous. An import can
    // rotate the profile epoch while their old replies are returning.
    await bound(input);if(stable(clear().map(footprint))!==serialized)stop('draft_refresh_basic_dom_changed');
    button(form,'取消').click();
    let closed=null;const deadline=Date.now()+5000;
    do{await pause(100);const current=page();if(!forms(current).length&&!menus().length){closed=current;break;}}while(Date.now()<deadline);
    if(!closed||stable(closed.slice(1).map(footprint))!==otherSix)stop('draft_refresh_basic_cancel_protected_changed');return 1;
  }
  async function phaseContext(input,{newDocument=false,ownedState=false}={}){
    request(input);await paid();await bound(input);const receipt=await readReceipt(input.requestId),proof=input.phaseProof;
    if(!receipt||receipt.targetSaved!==true||receipt.softwareClickedSave!==true||receipt.saveClickCount!==1||receipt.serverReadbackMatched!==true||receipt.serverReadbackFields!==12
      ||!['server_verified_needs_refresh','unknown'].includes(receipt.state)||!proof||proof.version!==1||proof.requestId!==input.requestId||proof.pageURL!==PAGE
      ||proof.recordMarker!==input.recordMarker||proof.matchingAtoms!==12||proof.saveClickCount!==1||stable(proof)!==stable(receipt.phaseProof)
      ||stable(proof.profileBinding)!==stable(input.profileBinding)||!/^[a-f0-9]{64}$/u.test(proof.proofHash||'')||await sha({...proof,proofHash:undefined})!==proof.proofHash)stop('draft_saved_phase_not_verified');
    if(state.busy&&!ownedState||ownedState&&state.requestId!==input.requestId)stop('draft_request_already_reserved');
    if(newDocument?performance.timeOrigin===proof.documentTimeOrigin:performance.timeOrigin!==proof.documentTimeOrigin)stop('draft_refresh_document_not_verified');
    if(newDocument&&(!input.reloadIntent||stable(input.reloadIntent)!==stable(receipt.sourceReloadIntent)||input.reloadIntent.requestId!==input.requestId||input.reloadIntent.phaseProofHash!==proof.proofHash||input.reloadIntent.fromTimeOrigin!==proof.documentTimeOrigin))stop('draft_refresh_reload_intent_not_verified');
    const basicCancelClicks=newDocument?await cancelUnchangedInitialBasic(input,proof):0;
    const sections=page();if(forms(sections).length||menus().length||rows(sections[1]).length!==proof.recordCountAfter)stop('draft_refresh_editor_or_menu_open');
    const mapping=await bridge(input,'closed'),ids=mapping.records.map(row=>row.recordIdentity),matches=mapping.records.filter(row=>row.recordIdentity===proof.savedRecordIdentity);
    if(stable(ids)!==stable(proof.recordIdentities)||matches.length!==1||await sha(matches[0].formDataURL)!==proof.savedReadURLHash)stop('draft_refresh_target_identity_changed');
    const index=matches[0].index;if(await sha(rows(sections[1]).filter((_,row)=>row!==index).map(footprint))!==proof.neighborHash)stop('draft_refresh_neighbor_changed');
    const pendingName=`resumePendingFillReview:${mapping.tabId}`,pending=(await chrome.storage.local.get(pendingName))[pendingName];
    if(input.lockOwnerRequestId!==proof.lockOwnerRequestId||pending?.requestId!==proof.lockOwnerRequestId||pending.tabId!==mapping.tabId||pending.origin!==new URL(PAGE).origin)stop('draft_pending_lock_changed');
    return {receipt:basicCancelClicks?await readReceipt(input.requestId):receipt,proof,sections,mapping,index,pendingName,pending,basicCancelClicks};
  }
  async function prepareRefresh(input){try{
    const context=await phaseContext(input),{proof,sections}=context;
    if(proof.refreshSafe!==true)stop('draft_refresh_outside_change_not_eligible');
    if(await sha(sections.map(footprint))!==proof.closedBeforeRefreshHash||await sha(outside(sections))!==proof.postSaveOutsideHash)stop('draft_refresh_closed_boundary_changed');
    const serialized=stable(sections.map(footprint));await bound(input);if(stable(page().map(footprint))!==serialized||forms(page()).length)stop('draft_refresh_closed_boundary_changed');
    const reloadIntent=context.receipt.sourceReloadIntent||{version:1,requestId:input.requestId,phaseProofHash:proof.proofHash,fromTimeOrigin:performance.timeOrigin,nonce:crypto.randomUUID()};
    if(reloadIntent.requestId!==input.requestId||reloadIntent.phaseProofHash!==proof.proofHash||reloadIntent.fromTimeOrigin!==performance.timeOrigin)stop('draft_refresh_reload_intent_not_verified');
    await chrome.storage.local.set({[key(input.requestId)]:{...context.receipt,sourceReloadIntent:reloadIntent}});
    if(forms(page()).length||stable(page().map(footprint))!==serialized)stop('draft_refresh_closed_boundary_changed');
    return {ok:true,readyToReload:true,targetSaved:true,requestId:input.requestId,phaseProofHash:proof.proofHash,documentTimeOrigin:performance.timeOrigin,formsClosed:true,reloadIntent,softwareClickedSave:false};
  }catch(error){return {ok:false,reason:error instanceof Stop?error.code:'draft_refresh_preflight_failed',readyToReload:false,softwareClickedSave:false};}}
  async function verifySaved(input){
    let context=null,ownsBusy=false,editClicks=0,cancelClicks=0;
    try{
      if(state.busy)stop('draft_request_already_reserved');state.busy=true;state.requestId=input?.requestId;ownsBusy=true;
      context=await phaseContext(input,{newDocument:true,ownedState:true});const {proof,sections,index,mapping}=context;
      if(!(await refreshOutsideOk(outside(sections),proof)))stop('draft_refresh_original_outside_mismatch');
      const closedSerialized=stable(sections.map(footprint)),closedHash=await sha(sections.map(footprint));
      const target=rows(sections[1])[index],edits=[...target.querySelectorAll('a')].filter(node=>visible(node)&&node.querySelector('.el-icon-edit-outline'));
      if(edits.length!==1||edits[0].getAttribute('href')&&!/^(#|javascript:(?:;|void\(0\)))$/iu.test(edits[0].getAttribute('href')))stop('draft_readback_edit_not_unique');
      await bound(input);if(forms(page()).length||stable(page().map(footprint))!==closedSerialized)stop('draft_refresh_closed_boundary_changed');
      edits[0].click();editClicks=1;
      let reopened=null;const deadline=Date.now()+20000;
      do{await pause(100);try{reopened=capture(String(index),{requireMarker:false,recordCount:proof.recordCountAfter});break;}
        catch(error){if(!(error instanceof Stop)||!['draft_editor_not_unique','draft_questions_changed','draft_plain_shape_changed','draft_degree_shape_changed','draft_date_shape_changed','draft_category_shape_changed','draft_radio_shape_changed','draft_required_values_missing'].includes(error.code))throw error;}
      }while(Date.now()<deadline);
      if(!reopened)stop('draft_refresh_server_readback_unavailable');
      const metadata=await bridge(input,'after_reopen');
      if(metadata.recordIdentity!==proof.savedRecordIdentity||await sha(metadata.formDataURL)!==proof.savedReadURLHash||await sha(reopened.values)!==proof.targetValuesHash
        ||reopened.degreeSiteReadOnly!==proof.degreeSiteReadOnly||!(await refreshOutsideOk(reopened.boundary.outside,proof))||await sha(reopened.boundary.neighbor)!==proof.neighborHash)stop('draft_refresh_server_readback_mismatch');
      const readHash=await sha(reopened.boundary);await pause(150);await bound(input);
      const stableRead=capture(String(index),{requireMarker:false,recordCount:proof.recordCountAfter});
      if(stableRead.form!==reopened.form||await sha(stableRead.boundary)!==readHash)stop('draft_refresh_readback_changed');
      const readyCancel=capture(String(index),{requireMarker:false,recordCount:proof.recordCountAfter});if(readyCancel.form!==stableRead.form||stable(readyCancel.boundary)!==stable(stableRead.boundary))stop('draft_refresh_readback_changed');
      // The boundary digest above can yield after its preceding bound check.
      // Recheck after that final await; only synchronous DOM checks follow.
      await bound(input);const immediateCancel=capture(String(index),{requireMarker:false,recordCount:proof.recordCountAfter});
      if(immediateCancel.form!==readyCancel.form||stable(immediateCancel.boundary)!==stable(readyCancel.boundary))stop('draft_refresh_readback_changed');
      button(immediateCancel.form,'取消').click();cancelClicks=1;
      let final=null;const cancelDeadline=Date.now()+5000;
      do{await pause(100);const current=page();if(!forms(current).length&&!menus().length&&rows(current[1]).length===proof.recordCountAfter){final=current;break;}}while(Date.now()<cancelDeadline);
      if(!final||await sha(final.map(footprint))!==closedHash||!(await refreshOutsideOk(outside(final),proof)))stop('draft_refresh_cancel_unverified');
      const finalMapping=await bridge(input,'closed');if(stable(finalMapping.records)!==stable(mapping.records))stop('draft_refresh_target_identity_changed');
      if(stable((await chrome.storage.local.get(context.pendingName))[context.pendingName])!==stable(context.pending))stop('draft_pending_lock_changed');
      const finalSerialized=stable(final.map(footprint));await bound(input);if(forms(page()).length||stable(page().map(footprint))!==finalSerialized)stop('draft_refresh_cancel_unverified');
      const receipt={...context.receipt,state:'completed',complete:true,refreshVerified:true,refreshDocumentTimeOrigin:performance.timeOrigin,
        otherSectionsPreserved:true,originalOutsidePreservedDuringSave:proof.originalOutsidePreserved,currentOutsideMatchesOriginal:true,
        otherRecordPreserved:true,readbackEditorClosed:true,refreshBasicCancelClicks:context.basicCancelClicks,refreshEditClicks:editClicks,refreshCancelClicks:cancelClicks,pendingReviewRequired:false};
      await chrome.storage.local.set({[key(input.requestId)]:receipt});return {ok:true,...receipt,savedOnSite:true,submitted:false,softwareClickedSubmit:false};
    }catch(error){
      const reason=error instanceof Stop?error.code:'draft_refresh_verify_failed';
      if(context)try{await bound(input);await chrome.storage.local.set({[key(input.requestId)]:{...context.receipt,state:'unknown',reason,targetSaved:true,refreshVerified:false,pendingReviewRequired:true,refreshEditClicks:editClicks,refreshCancelClicks:cancelClicks}});}catch{}
      return {ok:false,requestId:input?.requestId,reason,state:'unknown',targetSaved:context?.receipt?.targetSaved===true,softwareClickedSave:false,saveClickCount:0,
        refreshVerified:false,pendingReviewRequired:true,refreshEditClicks:editClicks,refreshCancelClicks:cancelClicks};
    }finally{if(ownsBusy){state.busy=false;state.requestId=null;}}
  }
  async function status(input){try{if(typeof input?.requestId!=='string'||!/^[A-Za-z0-9-]{8,120}$/u.test(input.requestId))stop('draft_request_invalid');
    const receipt=await readReceipt(input.requestId);
    if(!receipt)return {ok:true,data:null};
    const active=state.busy&&state.requestId===input.requestId;
    return {ok:true,data:{...receipt,...(!active&&!['completed','stopped_before_write','server_verified_needs_refresh'].includes(receipt.state)
      ?{state:'unknown',pendingReviewRequired:true}:{}),active}};
  }catch{return {ok:false,reason:'draft_status_unavailable'};}}
  const listener=(message,sender,sendResponse)=>{
    if(!['GTH_EDUCATION_DRAFT_INSPECT','GTH_EDUCATION_DRAFT_SAVE','GTH_EDUCATION_DRAFT_STATUS','GTH_EDUCATION_DRAFT_PREPARE_REFRESH','GTH_EDUCATION_DRAFT_VERIFY_SAVED'].includes(message?.type))return false;
    if(sender?.id!==chrome.runtime.id||sender.tab){sendResponse({ok:false,reason:'draft_wrong_sender'});return false;}
    const action=message.type==='GTH_EDUCATION_DRAFT_INSPECT'?inspect:message.type==='GTH_EDUCATION_DRAFT_SAVE'?save:message.type==='GTH_EDUCATION_DRAFT_PREPARE_REFRESH'?prepareRefresh:message.type==='GTH_EDUCATION_DRAFT_VERIFY_SAVED'?verifySaved:status;
    action(message).then(sendResponse,()=>sendResponse({ok:false,reason:'draft_message_failed'}));return true;
  };
  globalThis.ResumeGthDraftSave=Object.freeze({version:2,inspect,save,prepareRefresh,verifySaved,status,listener,onStorageChanged});
  chrome.runtime.onMessage.addListener(listener);
  // Worker-only MAIN bridge response contract, no DOM or Vue writes:
  // {ok:true,data:{source:'main_world_vue',requestId,nonce,phase,pageURL,
  // documentTimeOrigin,formCount,recordMarker,tableName:'resume_education',
  // saveURL,formDataURL,formInstanceToken:String(actualVueUid),recordIdentity,
  // fieldsReady:true}}. Closed phase instead returns formCount:0 and exact
  // current [{index,recordIdentity}] records from the education section Vue
  // props. Identity must be derived from actual section/record IDs, not index.
})();
