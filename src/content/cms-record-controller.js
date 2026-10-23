globalThis.installResumeCmsRecordController=function(recordKind){
  if(!['education','internship'].includes(recordKind))throw Error('record_scope_invalid');
  const internship=recordKind==='internship',controllerName=internship?'ResumeCmsInternshipMulti':'ResumeCmsEducationMulti';
  const setId=internship?'49170501':'14',sectionName=internship?'实习经历':'教育经历必填',rowIdPattern=internship?/^49170501_\d+_\d+$/u:/^14_\d+_\d+$/u;
  'use strict';
  if(globalThis[controllerName]?.version===3&&globalThis[controllerName].implementationRevision===17)return;
  if(globalThis.ResumeProfileWriteContext)throw Error('profile_write_context_busy');
  async function checkProfileWrite(){const context=globalThis.ResumeProfileWriteContext;if(context)await context.check();}
  const PAGE='https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';
  const FIELDS=internship?[["startDate","开始时间","date"],["endDate","结束时间","date"],["organization","企业名称","text"],["type","工作性质","select"],["position","职位名称","text"],["description","工作描述","text"]]:[['school','学校','school'],['degree','学历','select'],['academicDegree','学位','select'],['major','专业名称','text'],['startDate','开始时间','date'],['endDate','结束时间','date'],['region','城市','region'],['gradeRank','专业排名','select'],['description','专业描述','text']];
  const clean=value=>String(value||'').normalize('NFKC').replace(/[＊*：:!?！？\s]/gu,'');
  const option=value=>String(value||'').normalize('NFKC').replace(/[\u200b-\u200d\ufeff]/gu,'').replace(/\s+/gu,'').trim();
  // Closed synonym classes (parity with cms-education-multi-select.js).
  const UNRANKED=new Set(['未排名','无统计','无排名','不排名','暂无排名','暂无','无'].map(option));
  const DEGREE_LEVELS=[
    new Set(['本科','大学本科'].map(option)),
    new Set(['硕士','硕士研究生'].map(option)),
    new Set(['博士','博士研究生'].map(option)),
    new Set(['大专','专科','大学专科'].map(option))
  ];
  const sameDegreeLevel=(left,right)=>DEGREE_LEVELS.some(set=>set.has(left)&&set.has(right));
  const optionEquals=(a,b)=>{const left=option(a),right=option(b);return left===right||UNRANKED.has(left)&&UNRANKED.has(right)||sameDegreeLevel(left,right);};
  // School: page short Chinese name may match bilingual profile optionText
  // (悉尼大学 vs 悉尼大学 The University of Sydney). Used for DOM readback only.
  const schoolDisplayEquals=(a,b)=>{const left=option(a),right=option(b);if(!left||!right)return false;if(left===right)return true;const shorter=left.length<=right.length?left:right,longer=left.length<=right.length?right:left;return shorter.length>=4&&longer.includes(shorter);};
  const stable=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
  const hash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stable(value))))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  const pause=ms=>new Promise(done=>setTimeout(done,ms)),fail=reason=>{throw Error(reason);};
  const executions=new Map();
  const visible=node=>!!node?.isConnected&&!!node.getClientRects().length&&!node.closest('[hidden],[aria-hidden=true]')&&getComputedStyle(node).display!=='none'&&getComputedStyle(node).visibility!=='hidden';
  function requirePage(){if(location.origin+location.pathname!==PAGE)fail('wrong_site');if(document.visibilityState!=='visible')fail('fill_interrupted_page_hidden');}
  function sectionOf(form){const found=[...(form||document).querySelectorAll('.form-cell')].filter(node=>visible(node)&&node.id===setId&&clean(node.querySelector(':scope > .tit-wrap .tit')?.textContent)===sectionName);return found.length===1?found[0]:null;}
  function rowIdentity(row){const ids=[...row.querySelectorAll(':scope > div[id]')].filter(node=>rowIdPattern.test(node.id)).map(node=>node.id).sort();return ids.length&&new Set(ids).size===ids.length?JSON.stringify(ids):null;}
  function locateRow(form,identity){const section=sectionOf(form),found=[...(section?.querySelectorAll(':scope > .form-cell-right > .form-cell-inner')||[])].filter(row=>rowIdentity(row)===identity);return found.length===1?found[0]:null;}
  function locateField(form,identity,question){const row=locateRow(form,identity);if(!row)return null;
    const items=[...row.querySelectorAll('.ant-form-item')].filter(item=>visible(item)&&item.closest('.form-cell-inner')===row&&[...item.querySelectorAll('.ant-form-item-label>label')].filter(label=>label.closest('.ant-form-item')===item&&visible(label)&&clean(label.textContent)===clean(question)).length===1);
    if(items.length!==1)return null;const item=items[0],own=selector=>[...item.querySelectorAll(selector)].filter(node=>node.closest('.ant-form-item')===item),selections=own('.ant-select-selection').filter(visible);
    const input=own('input,textarea').filter(node=>visible(node)&&!node.closest('.ant-select')&&!['hidden','file','radio','checkbox','button','submit'].includes(node.type||''));
    const kind=selections.length===2?'region':selections.length===1?'select':input.length===1&&input[0].closest('.ant-calendar-picker')?'date':input.length===1?'text':'unknown';
    const value=selections.length?selections.map(node=>[...node.querySelectorAll('.ant-select-selection-selected-value,.ant-select-selection-item')].filter(visible).map(selected=>selected.textContent.trim()).join('|')):input.length===1?input[0].value:null;
    return {row,item,kind,value,selections,input:input.length===1?input[0]:null};
  }
  function sectionNodes(){return [...document.querySelectorAll('.form-cell')].filter(node=>visible(node)&&node.id===setId&&clean(node.querySelector(':scope > .tit-wrap .tit')?.textContent)===sectionName);}
  function pickEducationForm(){
    // Prefer a unique connected form that owns the section. Do not require the
    // <form> itself to have client rects — Ant Design wrappers can be size-0
    // while the section cells inside remain visible (live education_form_not_unique).
    const connected=[...document.querySelectorAll('form')].filter(form=>form.isConnected&&sectionOf(form));
    if(connected.length===1)return {form:connected[0],via:'connected_form_with_section',formCount:connected.length,sectionCount:sectionNodes().length};
    const visibleForms=connected.filter(visible);
    if(visibleForms.length===1)return {form:visibleForms[0],via:'visible_form_with_section',formCount:connected.length,sectionCount:sectionNodes().length};
    const sections=sectionNodes();
    if(sections.length===1){
      const form=sections[0].closest('form');
      if(form?.isConnected)return {form,via:'section_closest_form',formCount:connected.length,sectionCount:1};
    }
    return {form:null,via:'none',formCount:connected.length,sectionCount:sections.length};
  }
  function inspect(){const picked=pickEducationForm();if(!picked.form)return {ok:false,reason:'education_form_not_unique',diagnostics:{formCount:picked.formCount,sectionCount:picked.sectionCount,via:picked.via}};
    const form=picked.form,section=sectionOf(form);if(!section)return {ok:false,reason:'education_form_not_unique',diagnostics:{formCount:picked.formCount,sectionCount:picked.sectionCount,via:picked.via,sectionMissing:true}};
    const rows=[...section.querySelectorAll(':scope > .form-cell-right > .form-cell-inner')],identities=rows.map(rowIdentity);
    if(identities.some(identity=>!identity)||new Set(identities).size!==identities.length)return {ok:false,reason:'education_row_identity_invalid_or_duplicate'};
    const records=identities.map(identity=>({identity,fields:FIELDS.flatMap(([key,question])=>{const field=locateField(form,identity,question);return field?[{key,question,kind:field.kind,value:field.value}]:[];})}));
    const add=[...section.querySelectorAll(':scope > .add-more,:scope > .form-cell-right > .add-more')].filter(visible);
    return {ok:true,form,section,href:location.href,timeOrigin:performance.timeOrigin,records,add:add.length===1?add[0]:null,addCount:add.length,formPick:picked.via};
  }
  function outsideEducation(form){const section=sectionOf(form);return stable([...form.querySelectorAll('input,textarea,select,.ant-select-selection-selected-value,.ant-select-selection-item')].filter(node=>!section.contains(node)).map(node=>[node.tagName,node.type||'',node.value??node.textContent??'',!!node.checked]));}
  function overlayOpen(){return [...document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden),.ant-calendar-picker-container,.ant-modal,.ant-cascader-menus')].some(visible);}
  async function textAdapter(field,fact,binding){const input=field.input;if(!input||!['INPUT','TEXTAREA'].includes(input.tagName)||input.disabled||input.readOnly)return {status:'skipped',reason:'control_not_supported'};
    const same=input.value===fact.value;if(same&&!binding.replaceExisting)return {status:'verified',reason:'preexisting_same_value'};
    if(input.value&&!binding.replaceExisting)return {status:'skipped',reason:'existing_value'};
    const setter=Object.getOwnPropertyDescriptor(input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value')?.set;if(!setter)return {status:'skipped',reason:'native_setter_unavailable'};
    requirePage();await checkProfileWrite();if(overlayOpen())return {status:'skipped',reason:'control_busy'};
    if(typeof document.hasFocus==='function'&&!document.hasFocus()){
      try{window.focus();}catch{}
      await pause(80);
      if(!document.hasFocus()){try{window.focus();}catch{}await pause(80);}
      if(!document.hasFocus())return {status:'failed',reason:'page_unfocused'};
    }
    let blurEventSeen=false,focusoutEventSeen=false;
    const onBlur=()=>{blurEventSeen=true;},onFocusOut=()=>{focusoutEventSeen=true;};
    input.addEventListener('blur',onBlur,true);input.addEventListener('focusout',onFocusOut,true);
    try{
      input.focus({preventScroll:true});if(document.activeElement!==input)return {status:'failed',reason:'text_focus_not_observed'};await checkProfileWrite();
      setter.call(input,fact.value);await checkProfileWrite();
      input.dispatchEvent(new Event('input',{bubbles:true}));await checkProfileWrite();
      input.dispatchEvent(new Event('change',{bubbles:true}));requirePage();await checkProfileWrite();
      input.blur();await checkProfileWrite();await pause(40);
      if(document.activeElement===input)return {status:'failed',reason:'text_blur_not_observed'};
      if(!blurEventSeen&&!focusoutEventSeen)return {status:'failed',reason:'text_blur_event_not_observed'};
      return input.isConnected&&input.value===fact.value?{status:'verified',reason:same?'reapplied':'dom_readback_matched'}:{status:'failed',reason:'text_readback_mismatch'};
    }finally{input.removeEventListener('blur',onBlur,true);input.removeEventListener('focusout',onFocusOut,true);}
  }
  // The owned normal-popup worker supplies source validation and the read-only
  // MAIN props serialization bridge. Missing bridges stop before Add or writing.
  // Unsupported widget adapters are reported as skipped, never claimed filled.
  async function run(plan,services={}){
    let addClicks=0,writeStarted=false,registered=false,bindings=[],rows=[],profileContext=null,phase='authorization';const publicFields=[];
    try{
      if(typeof chrome!=='undefined'&&chrome.runtime?.getManifest?.()?.background?.service_worker==='src/license/guard-worker.mjs'){
        let allowed=false;try{allowed=(await chrome.runtime.sendMessage({type:'RESUME_PAID_VERIFY'}))?.allowed===true;}catch{}
        if(!allowed)return {ok:false,reason:'license_required',writeStarted:false,addClicks:0,saveClicks:0,deleteClicks:0,finalSubmitClicks:0};
      }
      if(typeof services.verifyBeforeWrite!=='function'||await services.verifyBeforeWrite()!==true)return {ok:false,reason:'license_or_authorization_required',writeStarted:false,addClicks:0,saveClicks:0,deleteClicks:0,finalSubmitClicks:0};
      if(typeof services.checkSource!=='function'||typeof services.readSerialization!=='function'||typeof services.verifySerialization!=='function')fail('education_owned_bridges_required');
      if(plan?.version!==1||plan.page!==PAGE||await hash({...plan,fingerprint:undefined})!==plan.fingerprint)fail('education_plan_changed');
      if(internship&&plan.recordKind!=='internship')fail('internship_plan_scope_invalid');
      // The owned worker requires one bound DOM row for every planned source.
      // Refuse a batch containing a zero-ready new record before any Add/fill;
      // skipping its binding would break that proof, while adding it creates an
      // empty row. Existing zero-ready rows can still soft-skip in-loop.
      if(internship){
        const recordReady=record=>FIELDS.some(([key])=>record.facts[key]?.status==='ready');
        const anyReady=plan.records.some(recordReady),emptyNew=plan.records.some(record=>record.target.mode==='new'&&!recordReady(record));
        if(!anyReady||emptyNew){
          const fields=plan.records.flatMap(record=>FIELDS.map(([key,question])=>{
            const fact=record.facts[key];
            return {profileIndex:record.profileIndex,key,question,path:fact?.path||null,status:'skipped',
              reason:fact?.status==='ready'?'internship_record_not_ready':fact?.reason||'missing_profile_value',
              ...(typeof fact?.hasProfileValue==='boolean'?{hasProfileValue:fact.hasProfileValue}:{}),
              ...(typeof fact?.confirmed==='boolean'?{confirmed:fact.confirmed}:{}),
              ...(typeof fact?.valuePreview==='string'?{valuePreview:fact.valuePreview}:{}),
              ...(typeof fact?.fullDay==='boolean'?{fullDay:fact.fullDay}:{})};
          }));
          return {ok:true,complete:false,reason:'internship_record_not_ready',writeStarted:false,addClicks:0,bindings:[],fields,serializedRecordCount:0,provisionalNewRecords:0,saveClicks:0,deleteClicks:0,finalSubmitClicks:0};
        }
      }
      if(plan.ownerBinding&&(typeof services.checkOwner!=='function'||await services.checkOwner(plan.ownerBinding)!==true))fail('education_owner_profile_changed');
      if(globalThis.ResumeProfileWriteContext)fail('profile_write_context_busy');
      profileContext={async check(){if(globalThis.ResumeProfileWriteContext!==profileContext||!plan.ownerBinding||await services.checkOwner(plan.ownerBinding)!==true)fail('profile_binding_changed');}};
      globalThis.ResumeProfileWriteContext=profileContext;
      const sourceIndices=plan.records.map(record=>record.profileIndex);if(!sourceIndices.length||new Set(sourceIndices).size!==sourceIndices.length)fail('education_source_binding_invalid');
      const checkSource=async record=>{if(plan.ownerBinding&&await services.checkOwner(plan.ownerBinding)!==true)fail('education_owner_profile_changed');if(await services.checkSource(record.profileIndex,record.sourceSnapshotHash)!==true)fail('education_source_snapshot_changed');};
      requirePage();phase='bind_existing';const initial=inspect();if(!initial.ok)fail(initial.reason);const {form,href,timeOrigin}=initial,protectedValues=outsideEducation(form);let prior=executions.get(plan.fingerprint);
      // running = in-flight; unknown = prior abort (e.g. document_changed) — clear so retry can proceed.
      if(prior&&prior.state==='running')fail('education_candidate_pending_review');
      if(prior&&prior.state==='unknown'){executions.delete(plan.fingerprint);prior=null;}
      if(prior&&prior.state!=='settled')fail('education_candidate_pending_review');
      if(prior&&(prior.timeOrigin!==timeOrigin||prior.bindings.length!==plan.records.length||prior.bindings.some(bound=>initial.records.filter(row=>row.identity===bound.identity).length!==1)))fail('education_cached_binding_changed');
      const targetFor=record=>prior?{mode:'existing',identity:prior.bindings.find(bound=>bound.profileIndex===record.profileIndex)?.identity}:record.target;
      const guard=()=>{requirePage();if(performance.timeOrigin!==timeOrigin||!form.isConnected||outsideEducation(form)!==protectedValues)fail('education_page_or_other_fields_changed');const state=inspect();if(!state.ok)fail(state.reason);
        if(bindings.length===plan.records.length&&(state.records.length!==bindings.length||state.records.some(row=>bindings.filter(binding=>binding.identity===row.identity).length!==1)))fail('education_bound_record_set_changed');return state;};
      const requestedExisting=plan.records.filter(record=>targetFor(record)?.mode==='existing').map(record=>targetFor(record).identity);
      if(new Set(requestedExisting).size!==requestedExisting.length||requestedExisting.some(identity=>initial.records.filter(row=>row.identity===identity).length!==1))fail('education_existing_binding_missing_or_duplicate');
      if(initial.records.some(row=>!requestedExisting.includes(row.identity)))fail('education_unbound_existing_row');
      executions.set(plan.fingerprint,{state:'running',href,timeOrigin,bindings});
      registered=true;
      for(const record of plan.records){await checkSource(record);const target=targetFor(record);if(target.mode==='existing'){bindings.push({profileIndex:record.profileIndex,identity:target.identity});continue;}
        if(target.mode!=='new')fail('education_target_mode_invalid');phase='add_record';const before=guard();if(before.addCount!==1||!before.add||overlayOpen())fail('education_add_control_not_unique_or_busy');
        writeStarted=true;await checkProfileWrite(); before.add.click();addClicks++;await checkProfileWrite();const deadline=Date.now()+2000;let after;
        while(Date.now()<deadline){await pause(40);after=guard();if(after.records.length===before.records.length+1)break;}
        if(!after||after.records.length!==before.records.length+1)fail('education_add_did_not_create_one_row');
        if(before.records.some(old=>after.records.filter(row=>row.identity===old.identity).length!==1||stable(after.records.find(row=>row.identity===old.identity).fields)!==stable(old.fields)))fail('education_add_changed_existing_record');
        const added=after.records.filter(row=>!before.records.some(old=>old.identity===row.identity));if(added.length!==1)fail('education_added_identity_not_unique');
        bindings.push({profileIndex:record.profileIndex,identity:added[0].identity});
      }
      if(new Set(bindings.map(row=>row.identity)).size!==bindings.length)fail('education_target_identity_duplicate');
      phase='fill_bound_records';
      for(const record of plan.records){const identity=bindings.find(row=>row.profileIndex===record.profileIndex)?.identity;if(!identity)fail('education_target_binding_missing');
        for(const [key,question,kind] of FIELDS){await checkSource(record);guard();const fact=record.facts[key],field=locateField(form,identity,question),base={profileIndex:record.profileIndex,key,question,path:fact?.path||null};
          if(fact?.status!=='ready'){publicFields.push({...base,status:'skipped',reason:fact?.reason||'missing_profile_value',...(typeof fact?.hasProfileValue==='boolean'?{hasProfileValue:fact.hasProfileValue}:{}),...(typeof fact?.confirmed==='boolean'?{confirmed:fact.confirmed}:{}),...(typeof fact?.valuePreview==='string'?{valuePreview:fact.valuePreview}:{}),...(typeof fact?.fullDay==='boolean'?{fullDay:fact.fullDay}:{})});continue;}
          if(!field){publicFields.push({...base,status:'skipped',reason:'question_not_present_or_ambiguous'});continue;}
          const adapter=kind==='text'?textAdapter:services.adapters?.[kind];if(typeof adapter!=='function'){publicFields.push({...base,status:'skipped',reason:'control_not_supported'});continue;}
          const binding={profileIndex:record.profileIndex,sourceSnapshotHash:record.sourceSnapshotHash,rowIdentity:identity,sectionName,key,question,sourcePath:fact.path,confirmed:true,replaceExisting:record.replaceExisting};
          const oldOtherRows=stable(guard().records.filter(row=>row.identity!==identity));writeStarted=true;
          const outcome=await adapter(field,fact,binding,{form,locate:()=>locateField(form,identity,question)});guard();
          if(stable(guard().records.filter(row=>row.identity!==identity))!==oldOtherRows)fail('education_other_record_changed');
          const live=locateField(form,identity,question),desired=key==='region'?[fact.value.province,fact.value.city]:fact.optionText;
          const equals=key==='school'?schoolDisplayEquals:optionEquals;
          const actual=live?.value,domMatch=Array.isArray(desired)?Array.isArray(actual)&&actual.length===desired.length&&desired.every((value,index)=>equals(value,actual[index])):Array.isArray(actual)?actual.length===1&&equals(actual[0],desired):equals(actual,desired);
          publicFields.push({...base,status:outcome?.status==='verified'&&domMatch?'verified':outcome?.status==='skipped'?'skipped':'failed',reason:outcome?.status==='verified'&&!domMatch?'dom_readback_mismatch':outcome?.reason||'widget_outcome_unknown',...(typeof outcome?.primaryReason==='string'&&/^[a-z0-9_]+$/u.test(outcome.primaryReason)?{primaryReason:outcome.primaryReason}:{}),...(typeof outcome?.selectionAttempted==='boolean'?{selectionAttempted:outcome.selectionAttempted}:{}),...(typeof outcome?.selectionReadbackMatched==='boolean'?{selectionReadbackMatched:outcome.selectionReadbackMatched}:{}),...(typeof outcome?.searchText==='string'?{searchText:outcome.searchText.slice(0,160)}:{}),...(typeof outcome?.desiredOptionText==='string'?{desiredOptionText:outcome.desiredOptionText.slice(0,160)}:{}),...(typeof outcome?.visibleOptionCount==='number'?{visibleOptionCount:outcome.visibleOptionCount}:{}),...(typeof outcome?.createTemplatePresent==='boolean'?{createTemplatePresent:outcome.createTemplatePresent}:{}),...(Array.isArray(outcome?.sampleOptions)?{sampleOptions:outcome.sampleOptions.slice(0,5).map(v=>String(v).slice(0,80))}:{}),...(Array.isArray(outcome?.candidateOptions)?{candidateOptions:outcome.candidateOptions.slice(0,12).map(v=>String(v).slice(0,80))}:{}),...(typeof outcome?.hint==='string'?{hint:outcome.hint.slice(0,120)}:{}),...(typeof outcome?.rowWasEmpty==='boolean'?{rowWasEmpty:outcome.rowWasEmpty}:{})});
        }
      }
      phase='verify_react_serialization';for(const record of plan.records)await checkSource(record);guard();
      const proof=await services.readSerialization(bindings),verification=await services.verifySerialization(plan,bindings,proof);
      if(!verification?.ok)fail(verification?.reason||'education_serialization_unavailable');
      rows=verification.records;
      for(const field of publicFields){const serialized=rows.find(row=>row.profileIndex===field.profileIndex)?.fields.find(item=>item.key===field.key);if(field.status==='verified'&&serialized?.status==='failed'){field.domStatus='verified';field.status='failed';field.reason=serialized.reason;}}
      const requiredDomComplete=rows.every(row=>row.fields.every(field=>!field.required||publicFields.find(item=>item.profileIndex===row.profileIndex&&item.key===field.key)?.status==='verified'));
      const failed=publicFields.some(field=>field.status==='failed'),complete=verification.complete===true&&requiredDomComplete&&!failed;
      executions.set(plan.fingerprint,{state:'settled',href,timeOrigin,bindings});
      const anyVerified=publicFields.some(field=>field.status==='verified');
      const anyReadyMissing=internship&&plan.records.some(record=>FIELDS.some(([key])=>record.facts[key]?.status!=='ready'));
      const reason=complete?(internship?'internship_bound_records_serialized':'education_bound_records_serialized')
        :internship&&!anyVerified&&anyReadyMissing?'internship_record_not_ready'
        :internship?'internship_records_partial':'education_records_partial';
      return {ok:true,complete,reason,writeStarted,addClicks,bindings,fields:publicFields,serialization:rows,serializedRecordCount:verification.serializedRecordCount,provisionalNewRecords:addClicks,saveClicks:0,deleteClicks:0,finalSubmitClicks:0};
    }catch(error){if(registered){if(writeStarted&&executions.has(plan?.fingerprint))executions.get(plan.fingerprint).state='unknown';else executions.delete(plan.fingerprint);}return {ok:false,complete:false,reason:/^[a-z0-9_]+$/u.test(error?.message||'')?error.message:'education_candidate_failed',phase,writeStarted,addClicks,bindings,fields:publicFields,provisionalNewRecords:addClicks,saveClicks:0,deleteClicks:0,finalSubmitClicks:0};}finally{if(profileContext&&globalThis.ResumeProfileWriteContext===profileContext)delete globalThis.ResumeProfileWriteContext;}
  }
  globalThis[controllerName]=Object.freeze({version:3,implementationRevision:17,inspect,locateRow,locateField,rowIdentity,run});
};
