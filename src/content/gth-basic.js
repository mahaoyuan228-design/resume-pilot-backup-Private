// GTH basic facts. Account-owned phone/email are read-only; never follow their account links.
// 现居住地 follows the 2026-10-23 probe: cascader-wrap, plugin-dialog, eo-cascader-menu.
// Province branch click plus 确定 is pending live Never-Save acceptance.
// liveSupportClaimed stays false. Photo stays unsupported and a requested
// photo fill is failed, not a skipped success. Never save, submit, deliver, or delete.
// Highest qualification uses an explicitly selected education.N.degree fact;
// the profile has no top-level highest-qualification field to infer from.
(() => {
  const previous = globalThis.ResumeGthBasic;
  if (previous?.listener) try {chrome.runtime.onMessage.removeListener(previous.listener);} catch {}
  const PAGE = 'https://hr.gtht.com/resume/edit/';
  const TITLES = ['基本信息','教育经历','求职意向','工作经验','职业技能与特长','附件简历','其他信息'];
  const FIELDS = [{key:'fullName',question:'姓名',kind:'text'},
    {key:'gender',question:'性别',kind:'radio'},
    {key:'phone',question:'手机号码',kind:'text'},
    {key:'birthDate',question:'出生年月',kind:'month'},
    {key:'email',question:'电子邮件',kind:'text'},
    {key:'currentCity',question:'现居住地',kind:'eoCascader'},
    {key:'degree',question:'最高学历',kind:'select'},
    {key:'workStart',question:'参加工作时间',kind:'month'}];
  const COVERAGE = [FIELDS[0],FIELDS[1],FIELDS[2],FIELDS[3],FIELDS[4],
    FIELDS[5],FIELDS[6],
    {key:'photo',question:'照片',kind:'unsupported'},
    FIELDS[7]];
  const norm = value => String(value ?? '').replace(/[\s\u00a0]+/gu,' ').trim();
  const pause = ms => new Promise(resolve => setTimeout(resolve,ms));
  const visible = node => !!node?.getClientRects().length
    && getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden';
  const enabled = node => !node.disabled && !node.classList.contains('is-disabled')
    && !node.classList.contains('disabled')
    && node.getAttribute('aria-disabled') !== 'true';
  const state = {busy:false,last:null,progress:null};
  class Stop extends Error {constructor(code){super(code);this.code=code;}}
  const stop = code => {throw new Stop(code);};
  let activeBinding=null,lastBinding=null;
  async function checkBinding(binding=activeBinding) {
    if(binding?.version!==1||typeof binding.epoch!=='string'||!(/^[a-f0-9]{64}$/u.test(binding.profileHash||'')))stop('profile_binding_required');
    let response;try{response=await chrome.runtime.sendMessage({type:'RESUME_PROFILE_BINDING_CHECK',profileBinding:binding});}catch{}
    if(response?.allowed!==true)stop('profile_binding_changed');
  }
  async function boundAction(action){await checkBinding();if(location.href!==PAGE||document.visibilityState!=='visible')stop('profile_action_page_changed');return action();}

  const step = value => {if(state.progress)state.progress.selectorStep=value;};
  const diagnostics = (reason=null) => ({reason,
    activeField:state.progress?.activeField || null,
    selectorStep:state.progress?.selectorStep || 'not_started',
    completedFields:(state.progress?.completedFields || []).map(field=>({...field}))});
  const valueRows = root => [...root.querySelectorAll('input,select,textarea')].map(node=>[
    node.tagName,node.type || '',node.value || '',!!node.checked,node.selectedIndex ?? null,
    [...(node.files || [])].map(file=>[file.name,file.size,file.type])]);
  const snapshot = root => JSON.stringify([root.textContent || '',valueRows(root),
    [...root.querySelectorAll('[contenteditable]')].map(node=>node.textContent || '')]);
  const outside = sections => JSON.stringify(sections.slice(1).map(snapshot));
  // Basic editor identity is scoped to 基本信息 only. Other-section forms
  // (教育经历 leftover etc.) used to trip basic_editor_not_unique / probe
  // gth_basic_editor_ambiguous falsely — parity education/simple/other.
  const forms = sections => [...sections[0].querySelectorAll('form')];
  const otherSectionForms = sections => sections.flatMap((section, index) =>
    index === 0 ? [] : [...section.querySelectorAll('form')]);
  const cancelButtons = form => [...form.querySelectorAll('button')].filter(node =>
    visible(node) && node.type === 'button' && norm(node.textContent) === '取消'
    && !node.disabled && !node.hasAttribute('formaction'));
  const valuesExcept = (form,excluded=[]) => JSON.stringify(
    [...form.querySelectorAll('input,select,textarea')].filter(node=>!excluded.includes(node))
      .map(node=>[node.tagName,node.type || '',node.value || '',!!node.checked,node.selectedIndex ?? null,
        [...(node.files || [])].map(file=>[file.name,file.size,file.type])]));
  const menus = () => [...document.querySelectorAll('.el-select-dropdown,.el-picker-panel,.popover.plugin-dialog-wrap')].filter(visible);
  function page(){
    if(location.href!==PAGE)stop('wrong_page');
    if(document.readyState!=='complete')stop('page_not_ready');
    if(document.visibilityState!=='visible')stop('page_hidden');
    const sections=[...document.querySelectorAll('.r-section')];
    const titles=sections.map(section=>{const node=section.querySelector('.title_')?.cloneNode(true);
      node?.querySelectorAll('a,button').forEach(child=>child.remove());return norm(node?.textContent);});
    if(JSON.stringify(titles)!==JSON.stringify(TITLES))stop('section_structure_changed');
    return sections;
  }
  async function dismissCancelOnly(form){
    const cancel=cancelButtons(form);
    if(cancel.length!==1)return false;
    await boundAction(()=>{if(!(cancel[0])?.isConnected)stop('profile_action_target_changed');return cancel[0].click();});
    return true;
  }
  // Close foreign editors before basic fill. Never clicks 保存/提交/删除.
  async function clearForeignEditors(){
    let sections=page();
    for(const form of otherSectionForms(sections)){
      if(!(await dismissCancelOnly(form)))stop('other_section_editor_open');
    }
    let deadline=Date.now()+4000;
    do{
      await pause(80);
      sections=page();
      if(!otherSectionForms(sections).length)break;
    }while(Date.now()<deadline);
    if(otherSectionForms(sections).length)stop('other_section_editor_open');
    return page();
  }
  function ownLabel(item){const labels=[...item.querySelectorAll('.el-form-item__label')]
    .filter(node=>node.closest('.el-form-item')===item);return labels.length===1?norm(labels[0].textContent):'';}
  // Probe DOM, not an Element cascader widget: content root is cascader-wrap,
  // the trigger is .input-l.pointer, and the menu opens in plugin-dialog.
  // A drifted shell fails closed. Province options are li.branch.has-child > span[uid].
  function residenceTarget(item){
    const wraps=[...item.querySelectorAll(':scope > .el-form-item__content.cascader-wrap')];
    if(wraps.length!==1)stop('basic_residence_structure_changed');
    const wrap=wraps[0];
    const labels=[...item.querySelectorAll('.el-form-item__label')].filter(node=>node.closest('.el-form-item')===item);
    const labelFor=labels.length===1?labels[0].getAttribute('for'):'';
    if(labelFor&&labelFor!=='resume_residence_area')stop('basic_residence_structure_changed');
    if(wrap.querySelector('.el-select,.el-date-editor'))stop('basic_residence_structure_changed');
    const triggers=[...wrap.querySelectorAll(':scope > .input-l.pointer')].filter(visible);
    const popovers=[...wrap.querySelectorAll(':scope > .dialog-wrap.plugin-dialog-wrap.popover')];
    if(triggers.length!==1||popovers.length!==1||!popovers[0].classList.contains('blue'))
      stop('basic_residence_structure_changed');
    const trigger=triggers[0],popover=popovers[0];
    const inputs=[...trigger.querySelectorAll('input.el-input__inner')]
      .filter(node=>!popover.contains(node)&&visible(node));
    const search=[...popover.querySelectorAll('input.search-input')];
    const panels=[...popover.querySelectorAll(':scope > .eo-cascader-panel')];
    const menus=[...popover.querySelectorAll(':scope > .eo-cascader-panel > .eo-cascader-menu.simple-tree-outer')];
    const selectedLists=[...popover.querySelectorAll('.selected-view-data')];
    const confirms=[...popover.querySelectorAll('a.confirm.pop-btn, a.pop-btn.confirm')]
      .filter(node=>norm(node.textContent)==='确定');
    const cancels=[...popover.querySelectorAll('a.cancel.pop-btn, a.pop-btn.cancel')]
      .filter(node=>norm(node.textContent)==='取消');
    if(inputs.length!==1||!(inputs[0] instanceof HTMLInputElement)||inputs[0].type!=='text'
      ||!inputs[0].readOnly||inputs[0].disabled||!trigger.contains(inputs[0])
      ||search.length!==1||search[0].getAttribute('placeholder')!=='请输入关键字'
      ||panels.length!==1||menus.length<1||menus.length>2||selectedLists.length!==1
      ||confirms.length!==1||cancels.length!==1)
      stop('basic_residence_structure_changed');
    return {item,controls:[inputs[0]],control:inputs[0],trigger,popover,read:()=>inputs[0].value};
  }
  function target(form,field){
    const items=[...form.querySelectorAll('.el-form-item')].filter(item=>ownLabel(item)===field.question);
    if(items.length!==1)stop('basic_target_not_unique');
    const item=items[0];
    if(['phone','email'].includes(field.key)&&item.classList.contains('custom-direct-form-item')){
      const rows=[...item.querySelectorAll('.e-direct-row')],row=rows[0];
      const spans=row?[...row.children].filter(node=>node.tagName==='SPAN'):[];
      const controls=[...item.querySelectorAll('input,textarea,select')];
      const control=controls[0],links=[...item.querySelectorAll('a')],link=links[0];
      let route;try{route=new URL(link?.getAttribute('href')||'',location.href);}catch{}
      if(rows.length!==1||!visible(row)||row.children.length!==3||spans.length!==1||!visible(spans[0])
        ||controls.length!==1||!(control instanceof HTMLInputElement)||control.type!=='text'||visible(control)
        ||!control.closest('.el-input')||getComputedStyle(control.closest('.el-input')).display!=='none'
        ||row.children[0]!==spans[0]||row.children[1]!==control.closest('.el-input')||row.children[2]!==link
        ||links.length!==1||!row.contains(link)||!visible(link)||!link.matches('.el-link.def-link')
        ||norm(link.textContent)!=='修改'||route?.origin!==new URL(PAGE).origin
        ||route.pathname!=='/user/account'||route.search||route.hash)
        stop('basic_account_contact_structure_changed');
      const display=spans[0];
      if(norm(display.textContent)!==norm(control.value))stop('basic_account_contact_value_mismatch');
      return {item,controls,control,display,link,siteReadOnly:true,read:()=>norm(display.textContent)};
    }
    if(field.kind==='radio'){
      const controls=[...item.querySelectorAll('input[type="radio"]')]
        .filter(node=>node.closest('.el-form-item')===item);
      const options=controls.map(control=>{const label=control.closest('label.el-radio');
        const text=norm(label?.querySelector('.el-radio__label')?.textContent);
        if(!label||!item.contains(label)||!visible(label)
          ||label.querySelectorAll('input[type="radio"]').length!==1||!['男','女'].includes(text))
          stop('basic_gender_structure_changed');
        return {control,label,text};});
      const group=controls[0]?.closest('.el-radio-group');
      const nativeGroup=!!controls[0]?.name&&new Set(controls.map(node=>node.name)).size===1;
      const componentGroup=!!group&&item.contains(group)&&controls.every(node=>node.closest('.el-radio-group')===group);
      if(options.length!==2||new Set(options.map(option=>option.text)).size!==2||!nativeGroup&&!componentGroup)
        stop('basic_gender_structure_changed');
        return {item,controls,options,read(){const checked=options.filter(option=>option.control.checked);
        if(checked.length>1)stop('basic_gender_structure_changed');return checked[0]?.text || '';}};
    }
    if(field.kind==='eoCascader')return residenceTarget(item);
    const controls=[...item.querySelectorAll('input,textarea,select')]
      .filter(node=>node.closest('.el-form-item')===item&&visible(node));
    const control=controls[0];
    if(controls.length!==1||!(control instanceof HTMLInputElement)||control.type!=='text'||control.disabled)
      stop('basic_input_structure_changed');
    if(field.kind==='text'&&(control.readOnly||item.querySelector('.el-select,.el-date-editor,.cascader-wrap')))
      stop('basic_plain_field_not_text');
    if(field.kind==='select'&&(item.querySelectorAll('.el-select').length!==1
      ||!control.closest('.el-select')||!control.readOnly))stop('basic_degree_structure_changed');
    let trigger;
    if(field.kind==='month'){
      const editors=[...item.querySelectorAll('.el-date-editor')];
      if(editors.length!==1||!editors[0].classList.contains('el-date-editor--month')
        ||!editors[0].contains(control)||!control.readOnly)stop('basic_month_structure_changed');
      const icons=[...editors[0].querySelectorAll('.el-input__prefix .el-input__icon.el-icon-date')]
        .filter(node=>visible(node)&&enabled(node));
      if(icons.length!==1)stop('basic_month_trigger_not_unique');
      trigger=icons[0];
    }
    return {item,controls,control,trigger,read:()=>control.value};
  }
  const sameTarget = (left,right) => left.item===right.item&&left.controls.length===right.controls.length
    &&left.controls.every((node,index)=>node===right.controls[index])&&left.trigger===right.trigger
    &&left.siteReadOnly===right.siteReadOnly&&left.display===right.display&&left.link===right.link;
  function siteValid(target){return !target.item.classList.contains('is-error')
    &&!target.item.classList.contains('is-validating')
    &&![...target.item.querySelectorAll('.el-form-item__error')].some(node=>visible(node)&&norm(node.textContent))
    &&target.controls.every(node=>node.getAttribute('aria-invalid')!=='true'&&(!node.validity||node.validity.valid));}
  async function waitFor(read,timeout=5000){const deadline=Date.now()+timeout;do{const found=read();if(found)return found;await pause(70);}while(Date.now()<deadline);stop('basic_widget_timeout');}
  function birthMonth(value){
    const match=String(value).match(/^(\d{4})-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?$/u);
    if(!match)return null;
    const year=Number(match[1]),month=Number(match[2]),day=match[3]===undefined?null:Number(match[3]);
    if(year<1900||year>new Date().getFullYear()||day!==null&&day>new Date(Date.UTC(year,month,0)).getUTCDate())return null;
    return `${match[1]}-${match[2]}`;
  }
  function facts(request){
    const profile=request.profile;
    if(!profile||typeof profile!=='object'||Array.isArray(profile)||!Array.isArray(profile.confirmedFields))
      stop('basic_profile_invalid');
    const confirmed=new Set(profile.confirmedFields.filter(path=>typeof path==='string'));
    const index=request.educationIndex;
    if(index!==undefined&&(!Number.isInteger(index)||index<0||index>29||!Array.isArray(profile.education)
      ||!profile.education[index]||typeof profile.education[index]!=='object'))stop('basic_education_source_invalid');
    return Object.fromEntries(FIELDS.map(field=>{
      const path=field.key==='degree'?(index===undefined?null:`education.${index}.degree`):field.key;
      const raw=field.key==='degree'?(index===undefined?'':profile.education[index].degree):profile[field.key];
      if(raw!==undefined&&typeof raw!=='string'||typeof raw==='string'&&(raw.length>200||/[\u0000-\u001f]/u.test(raw)))
        stop('basic_profile_invalid');
      const original=typeof raw==='string'?raw:'';
      // A work-start source is an explicit month, matching education/work
      // month facts. Only birthDate accepts a full calendar date.
      const value=field.kind==='month'&&original?(field.key==='birthDate'?birthMonth(original)||''
        :/^(19|20)\d{2}-(0[1-9]|1[0-2])$/u.test(original)?original:''):original;
      return [field.key,{path,value,reason:!path?'education_source_required':!original?'missing_profile_value'
        :!confirmed.has(path)?'profile_fact_unconfirmed':field.kind==='month'&&!value?'invalid_profile_value':field.key==='gender'&&!['男','女'].includes(value)
          ?'invalid_profile_value':null}];
    }));
  }
  const inertHref=node=>{const href=node?.getAttribute('href');
    return !href||/^(#|javascript:(?:;|void\(0\)))$/iu.test(href);};
  function residenceChips(popup){
    const lists=[...popup.querySelectorAll('.selected-view-data')].filter(node=>popup.contains(node));
    if(lists.length!==1)stop('basic_residence_structure_changed');
    return [...lists[0].querySelectorAll(':scope > li')].map(li=>{
      const textNode=[...li.children].find(node=>node.tagName==='P');
      return {li,uid:li.getAttribute('uid')||'',text:norm(textNode?textNode.textContent:li.textContent)};
    });
  }
  function residenceColumns(popup){
    return [...popup.querySelectorAll(':scope > .eo-cascader-panel > .eo-cascader-menu.simple-tree-outer')]
      .filter(node=>visible(node)&&!node.closest('.search-leaves-outer,.dialog-search-wrap'));
  }
  async function closeResidence(selected,popup){
    if(!popup||!visible(popup)||location.href!==PAGE||document.visibilityState!=='visible')return;
    const cancels=[...popup.querySelectorAll('a.cancel.pop-btn, a.pop-btn.cancel')]
      .filter(node=>visible(node)&&popup.contains(node)&&norm(node.textContent)==='取消'&&inertHref(node)&&enabled(node));
    if(cancels.length===1)await boundAction(()=>{if(!cancels[0].isConnected||!popup.contains(cancels[0]))stop('profile_action_target_changed');
      return cancels[0].click();});
    else{
      await boundAction(()=>{if(!selected.control?.isConnected)stop('profile_action_target_changed');
        return selected.control.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',keyCode:27,which:27,bubbles:true}));});
      await boundAction(()=>{if(!selected.control?.isConnected)stop('profile_action_target_changed');return selected.control.blur();});
    }
    await pause(80);
  }
  // Click one province branch (span[uid]), bind the selected-view uid, then 确定.
  // A foreign or ambiguous chip never confirms. Dismissal is popover 取消 or Escape.
  async function fillResidence(selected,answer,midGuard,markWrite){
    let popup,chosen=false;
    try{
      step('residence_open');
      if(menus().length)stop('basic_other_menu_open');
      midGuard();
      await boundAction(()=>{if(!selected.trigger?.isConnected)stop('profile_action_target_changed');return selected.trigger.click();});
      popup=await waitFor(()=>{midGuard();const open=menus();if(open.length>1)stop('basic_menu_not_unique');
        if(!open.length)return null;
        if(open[0]!==selected.popover||!selected.item.contains(open[0]))stop('basic_residence_structure_changed');
        return open[0];});
      step('residence_option_lookup');midGuard();
      const columns=residenceColumns(popup);
      if(columns.length<1||columns.length>2)stop('basic_residence_structure_changed');
      const wanted=norm(answer.value);
      const rows=[...columns[0].querySelectorAll(':scope > .simple-tree-wrapper > li.branch.has-child')].filter(visible);
      const matches=rows.filter(row=>{const span=row.querySelector(':scope > span[uid]');
        return !!span&&norm(span.textContent)===wanted&&span.getAttribute('uid');});
      if(matches.length!==1)stop(matches.length?'basic_residence_option_ambiguous':'basic_residence_option_missing');
      const choice=matches[0],span=choice.querySelector(':scope > span[uid]');
      const uid=span.getAttribute('uid'),text=norm(span.textContent);
      if(!uid||!text||!enabled(choice)||!enabled(span))stop('basic_residence_option_disabled');
      const matchedChip=()=>{const chips=residenceChips(popup);
        if(chips.length>1)stop('basic_residence_selection_unknown');
        return chips.length===1&&chips[0].uid===uid&&chips[0].text===text?chips[0]:null;};
      if(!matchedChip()){
        step('residence_option_click');midGuard();markWrite();
        await boundAction(()=>{if(!span.isConnected||!popup.contains(span))stop('profile_action_target_changed');return span.click();});
        await waitFor(()=>{midGuard();const chips=residenceChips(popup);
          if(chips.length>1)stop('basic_residence_selection_unknown');
          if(chips.length===1&&chips[0].text===text&&chips[0].uid&&chips[0].uid!==uid)
            stop('basic_residence_selection_unknown');
          return chips.length===1&&chips[0].uid===uid&&chips[0].text===text?chips[0]:null;});
      }
      step('residence_confirm');midGuard();
      if(!matchedChip())stop('basic_residence_selection_unknown');
      const confirms=[...popup.querySelectorAll('a.confirm.pop-btn, a.pop-btn.confirm')]
        .filter(node=>visible(node)&&popup.contains(node)&&norm(node.textContent)==='确定'&&inertHref(node)&&enabled(node));
      if(confirms.length!==1)stop('basic_residence_confirm_unknown');
      markWrite();
      await boundAction(()=>{if(!confirms[0].isConnected||!popup.contains(confirms[0])||!visible(popup))
        stop('profile_action_target_changed');return confirms[0].click();});
      step('residence_close');
      await waitFor(()=>!visible(popup));
      chosen=true;
    }finally{
      if(!chosen)await closeResidence(selected,popup);
    }
  }
  async function trial(request){
    // This module is shared by the internal trial and the paid package. The
    // paid manifest is already bound to the same online worker as education.
    // Keep this gate inside the shared implementation: globals and messages
    // must both verify before inspecting customer facts or webpage controls.
    try{
      const manifest=chrome.runtime.getManifest();
      if(manifest.background?.service_worker==='src/license/guard-worker.mjs'){
        const verdict=await chrome.runtime.sendMessage({type:'RESUME_PAID_VERIFY'});
        if(verdict?.allowed!==true)throw new Error('license_required');
      }
    }catch{
      const info={reason:'license_required',activeField:null,selectorStep:'license_check',completedFields:[],writeStarted:false};
      if(!state.busy)state.last={requestId:request?.requestId,outcome:'failed_before_write',info};
      return {ok:false,...info};
    }
    const result={fields:[],coverage:COVERAGE.map(field=>({key:field.key,question:field.question,
      path:field.key==='degree'?(Number.isInteger(request?.educationIndex)?`education.${request.educationIndex}.degree`:null)
        :field.key==='photo'?null:field.key,
      supported:field.kind!=='unsupported',status:field.kind==='unsupported'?'failed':'skipped',reason:field.kind==='unsupported'?'control_not_supported':'not_run'})),
      complete:false,supportedComplete:false,operableComplete:false,writeStarted:false,editorLeftOpen:false,savedOnSite:null,submitted:null,
      softwareClickedSave:false,softwareClickedSubmit:false,softwareClickedDelete:false,liveSupportClaimed:false,scope:'gth_basic_six'};
    if(state.busy)return {ok:false,reason:'fill_in_progress',...result};
    state.busy=true;activeBinding=request?.profileBinding;lastBinding=activeBinding;state.progress={requestId:request?.requestId,activeField:null,selectorStep:'request_validation',completedFields:[],writeStarted:false};
    const markWrite=()=>{result.writeStarted=true;state.progress.writeStarted=true;};
    const record=(key,row)=>{result.fields.push(row);Object.assign(result.coverage.find(field=>field.key===key),row);
      state.progress.completedFields.push({key,status:row.status,reason:row.reason});};
    let form,openedByUs=false;
    try{
      await checkBinding();
      if(typeof request?.requestId!=='string'||request.requestId.length<8||request.requestId.length>120
        ||request.replaceExisting!==undefined&&typeof request.replaceExisting!=='boolean')stop('basic_request_invalid');
      const answers=facts(request);step('page_preflight');
      // Capture outside fingerprint only after foreign editors are closed.
      let sections=await clearForeignEditors();const origin=performance.timeOrigin;const otherBefore=outside(sections);
      let editors=forms(sections);
      if(editors.length>1)stop('basic_editor_not_unique');
      if(otherSectionForms(sections).length)stop('other_section_editor_open');
      if(menus().length)stop('basic_other_menu_open');
      if(!editors.length){
        const links=[...sections[0].querySelectorAll('a.h-e-btn')].filter(node=>visible(node)&&norm(node.textContent)==='编辑');
        if(links.length!==1||!enabled(links[0])||links[0].closest('.title_')!==sections[0].querySelector('.title_')
          ||links[0].closest('[disabled],[aria-disabled="true"],.is-disabled,.disabled,[formaction]')
          ||links[0].getAttribute('href')&&!/^(#|javascript:(?:;|void\(0\)))$/iu.test(links[0].getAttribute('href')))
          stop('basic_edit_not_unique');
        const edit=links[0],editTitle=edit.closest('.title_'),editHref=edit.getAttribute('href');
        step('editor_open');await boundAction(()=>{
          const live=page(),current=[...live[0].querySelectorAll('a.h-e-btn')].filter(node=>visible(node)&&norm(node.textContent)==='编辑');
          if(!edit.isConnected||live[0]!==sections[0]||current.length!==1||current[0]!==edit
            ||!enabled(edit)||edit.closest('.title_')!==editTitle||editTitle!==live[0].querySelector('.title_')
            ||edit.closest('[disabled],[aria-disabled="true"],.is-disabled,.disabled,[formaction]')
            ||edit.getAttribute('href')!==editHref||forms(live).length||otherSectionForms(live).length||menus().length)
            stop('basic_edit_not_unique');
          return edit.click();
        });openedByUs=true;
        form=await waitFor(()=>{sections=page();const all=forms(sections);
          if(all.length>1)stop('basic_editor_not_unique');
          if(otherSectionForms(sections).length)stop('other_section_editor_open');
          return all.length===1&&all[0].querySelector('.el-form-item')?all[0]:null;});
      }else form=editors[0];
      result.editorLeftOpen=true;
      if(outside(page())!==otherBefore||performance.timeOrigin!==origin)stop('basic_other_values_changed');
      const questionRows=()=>[...form.querySelectorAll('.el-form-item')].map(ownLabel);
      if(JSON.stringify(questionRows())!==JSON.stringify(COVERAGE.map(field=>field.question)))stop('basic_questions_changed');
      const targets=Object.fromEntries(FIELDS.map(field=>{state.progress.activeField=field.key;step('target_preflight');return [field.key,target(form,field)];}));
      let allBefore=valuesExcept(form);const verifiedReads=new Map();
      const readonlySnapshot=()=>JSON.stringify(FIELDS.filter(field=>targets[field.key].siteReadOnly)
        .map(field=>{const current=target(form,field);if(!sameTarget(targets[field.key],current))stop('basic_other_values_changed');
          return snapshot(current.item);}));
      const readonlyBefore=readonlySnapshot();
      // Overwrite mid-select/month: Element UI may clear the active control before
      // commit. Mirror education categoryOverwrite — allow '' / existing / intended
      // on the active field while other controls stay untouched.
      const guard=(field,expectedAll,{allowOwnIntermediate=false,existing='',untouched=null}={})=>{
        const live=page();
        const selected=targets[field.key];
        const answerVal=answers[field.key]?.value||'';
        let valuesOk;
        if(allowOwnIntermediate===true&&untouched!=null){
          const readVal=selected.read();
          const progressOk=readVal===''||readVal===existing||norm(readVal)===norm(answerVal);
          valuesOk=valuesExcept(form,selected.controls)===untouched&&progressOk;
        }else{
          valuesOk=valuesExcept(form)===expectedAll;
        }
        if(performance.timeOrigin!==origin
          ||outside(live)!==otherBefore||forms(live).length!==1||forms(live)[0]!==form
          ||JSON.stringify(questionRows())!==JSON.stringify(COVERAGE.map(field=>field.question))
          ||!sameTarget(targets[field.key],target(form,field))||!valuesOk||readonlySnapshot()!==readonlyBefore)
            stop('basic_other_values_changed');};
      for(const field of FIELDS){
        state.progress.activeField=field.key;step('field_decision');
        const answer=answers[field.key],selected=targets[field.key],existing=selected.read();
        if(selected.siteReadOnly){record(field.key,{question:field.question,path:answer.path,status:'skipped',reason:'site_readonly',
          readOnlyState:!existing?'empty':!answer.value?'source_unavailable':norm(existing)===norm(answer.value)?'same':'different'});continue;}
        if(answer.reason){record(field.key,{question:field.question,path:answer.path,status:'skipped',reason:answer.reason});continue;}
        // Same-value under replaceExisting: verify without reopening select/month
        // (reopen clears control mid-flight → basic_other_values_changed).
        if(existing!==''&&norm(existing)===norm(answer.value)){
          if(!siteValid(selected))stop('basic_site_validation_failed');
          record(field.key,{question:field.question,path:answer.path,status:'verified',reason:'preexisting_same_value'});
          verifiedReads.set(field.key,existing);continue;
        }
        if(existing!==''&&request.replaceExisting!==true){
          record(field.key,{question:field.question,path:answer.path,status:'skipped',reason:'existing_value'});
          continue;
        }
        step('field_guard');guard(field,allBefore);
        const untouched=valuesExcept(form,selected.controls);
        const midGuard=()=>guard(field,allBefore,{allowOwnIntermediate:request.replaceExisting===true,existing,untouched});
        if(field.kind==='text'){
          if(selected.control.maxLength>=0&&answer.value.length>selected.control.maxLength)stop('basic_value_too_long');
          const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
          if(!setter)stop('native_setter_missing');step('text_input_events');markWrite();
          await boundAction(()=>{if(!(selected.control)?.isConnected)stop('profile_action_target_changed');return setter.call(selected.control,answer.value);});await boundAction(()=>{if(!(selected.control)?.isConnected)stop('profile_action_target_changed');return selected.control.dispatchEvent(new Event('input',{bubbles:true}));});
          await boundAction(()=>{if(!(selected.control)?.isConnected)stop('profile_action_target_changed');return selected.control.dispatchEvent(new Event('change',{bubbles:true}));});
        }else if(field.kind==='radio'){
          const option=selected.options.find(option=>option.text===answer.value);
          if(!option||!enabled(option.control)||!enabled(option.label))stop('basic_gender_option_disabled');
          step('gender_option_click');markWrite();await boundAction(()=>{if(!(option.label)?.isConnected)stop('profile_action_target_changed');return option.label.click();});
        }else if(field.kind==='month'){
          let popup,chosen=false;step('month_open');await boundAction(()=>{if(!(selected.trigger)?.isConnected)stop('profile_action_target_changed');return selected.trigger.click();});
          try{
            popup=await waitFor(()=>{midGuard();const open=menus();if(open.length>1)stop('basic_menu_not_unique');return open[0]||null;});
            if(!popup.matches('.el-picker-panel'))stop('basic_wrong_menu');
            const year=Number(answer.value.slice(0,4)),month=Number(answer.value.slice(5));
            const readYear=()=>{const years=[...popup.querySelectorAll('.el-date-picker__header-label')].filter(visible)
              .map(node=>norm(node.textContent).match(/^(\d{4})\s*年$/u)).filter(Boolean);
              if(years.length!==1)stop('basic_month_year_unknown');return Number(years[0][1]);};
            step('month_year_read');
            for(let count=0;readYear()!==year;count++){
              step('month_year_navigation');if(count>=150)stop('basic_month_year_too_far');midGuard();
              const previous=readYear()>year,buttons=[...popup.querySelectorAll(previous?'.el-icon-d-arrow-left':'.el-icon-d-arrow-right')]
                .filter(node=>visible(node)&&enabled(node));
              if(buttons.length!==1)stop('basic_month_navigation_unknown');
              const old=readYear();await boundAction(()=>{if(!(buttons[0])?.isConnected)stop('profile_action_target_changed');return buttons[0].click();});
              await waitFor(()=>{const next=readYear();if(next!==old&&next!==old+(previous?-1:1))stop('basic_month_navigation_unknown');
                return next===old+(previous?-1:1);},1500);
            }
            step('month_option_lookup');midGuard();
            const tables=[...popup.querySelectorAll('.el-month-table')].filter(visible);
            if(tables.length!==1)stop('basic_month_table_unknown');
            const cells=[...tables[0].querySelectorAll('td')].filter(visible);
            const names=['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
            const choices=cells.filter(node=>norm(node.textContent).replace(/\s/gu,'')===names[month-1]
              ||norm(node.textContent).replace(/\s/gu,'')===`${month}月`);
            if(cells.length!==12||choices.length!==1)stop('basic_month_option_unknown');
            if(!enabled(choices[0]))stop('basic_month_option_disabled');
            const anchors=[...choices[0].querySelectorAll('a.cell')].filter(node=>visible(node));
            if(anchors.length!==1)stop('basic_month_option_unknown');
            if(!enabled(anchors[0]))stop('basic_month_option_disabled');
            // Use the same Element-UI month path as education/work: the anchor
            // handles the normal click; a still-connected TD retries a table
            // handler that ignores an A target. DOM paint alone is not model
            // acceptance, so ask the existing MAIN-world bridge before close.
            step('month_option_click');midGuard();markWrite();
            await boundAction(()=>{if(!anchors[0].isConnected)stop('profile_action_target_changed');return anchors[0].click();});
            await pause(80);
            if(selected.read()===''&&choices[0].isConnected&&popup.isConnected&&visible(popup)){
              await boundAction(()=>{if(!choices[0].isConnected)stop('profile_action_target_changed');return choices[0].click();});
              await pause(80);
            }
            if(menus().some(node=>node!==popup))stop('basic_menu_not_unique');
            guard(field,allBefore,{allowOwnIntermediate:true,existing,untouched});
            step('month_model_accept');
            let accepted;
            try{
              await boundAction(()=>{
                if(!selected.control.isConnected)stop('profile_action_target_changed');
                selected.control.setAttribute('data-gth-month-role','input');
                selected.control.setAttribute('data-gth-month-answer',answer.value);
                selected.control.setAttribute('data-gth-month-result','pending');
                if(popup.isConnected)popup.setAttribute('data-gth-month-role','panel');
              });
              try{accepted=await chrome.runtime.sendMessage({type:'GTH_MONTH_MODEL_ACCEPT',answer:answer.value});}catch{}
            }finally{
              selected.control.removeAttribute('data-gth-month-role');
              selected.control.removeAttribute('data-gth-month-answer');
              selected.control.removeAttribute('data-gth-month-result');
              popup.removeAttribute('data-gth-month-role');
            }
            if(['dual','bad-year','mismatch'].includes(accepted?.result))stop('basic_readback_mismatch');
            // A removed popup needs explicit picker/editor acceptance; its
            // painted value cannot establish that the Vue model retained it.
            if(!popup.isConnected&&!['picked','emitted'].includes(accepted?.result))stop('basic_readback_mismatch');
            step('month_close');
            await boundAction(()=>{if(!selected.control.isConnected)stop('profile_action_target_changed');
              selected.control.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',keyCode:27,which:27,bubbles:true}));
              selected.control.blur();});
            await waitFor(()=>!popup.isConnected||!visible(popup));
            if(selected.read()!==answer.value)stop('basic_readback_mismatch');
            chosen=true;
          }finally{
            if(!chosen&&popup&&visible(popup)&&location.href===PAGE&&document.visibilityState==='visible'
              &&menus().length===1&&menus()[0]===popup){await boundAction(()=>{if(!(selected.control)?.isConnected)stop('profile_action_target_changed');return selected.control.dispatchEvent(new KeyboardEvent('keydown',
                {key:'Escape',code:'Escape',keyCode:27,which:27,bubbles:true}));});await boundAction(()=>{if(!(selected.control)?.isConnected)stop('profile_action_target_changed');return selected.control.blur();});await pause(650);}
          }
        }else if(field.kind==='eoCascader'){
          await fillResidence(selected,answer,midGuard,markWrite);
        }else{
          let popup,chosen=false;step('degree_open');await boundAction(()=>{if(!(selected.control)?.isConnected)stop('profile_action_target_changed');return selected.control.click();});
          try{
            popup=await waitFor(()=>{midGuard();const open=menus();if(open.length>1)stop('basic_menu_not_unique');return open[0]||null;});
            if(!popup.matches('.el-select-dropdown'))stop('basic_wrong_menu');
            step('degree_option_lookup');
            const matches=()=>{midGuard();const rows=[...popup.querySelectorAll('.el-select-dropdown__item')]
              .filter(node=>visible(node)&&norm(node.textContent)===norm(answer.value));
              if(rows.length>1)stop('basic_degree_option_ambiguous');return rows;};
            const first=await waitFor(()=>{const rows=matches();return rows.length===1?rows[0]:null;});
            await pause(120);if(matches()[0]!==first)stop('basic_degree_option_changed');
            if(!enabled(first))stop('basic_degree_option_disabled');
            step('degree_option_click');markWrite();await boundAction(()=>{if(!(first)?.isConnected)stop('profile_action_target_changed');return first.click();});
            step('degree_close');await waitFor(()=>!visible(popup));chosen=true;
          }finally{
            if(!chosen&&popup&&visible(popup)&&location.href===PAGE&&document.visibilityState==='visible'
              &&menus().length===1&&menus()[0]===popup){await boundAction(()=>{if(!(selected.control)?.isConnected)stop('profile_action_target_changed');return selected.control.click();});await pause(650);}
          }
        }
        step('field_readback');await pause(250);
        const live=page();
        if(performance.timeOrigin!==origin||outside(live)!==otherBefore||forms(live).length!==1||forms(live)[0]!==form
          ||JSON.stringify(questionRows())!==JSON.stringify(COVERAGE.map(field=>field.question))
          ||!sameTarget(selected,target(form,field))||valuesExcept(form,selected.controls)!==untouched||readonlySnapshot()!==readonlyBefore)
          stop('basic_other_values_changed');
        if(selected.read()!==answer.value)stop('basic_readback_mismatch');
        if(!siteValid(selected))stop('basic_site_validation_failed');
        allBefore=valuesExcept(form);verifiedReads.set(field.key,selected.read());
        record(field.key,{question:field.question,path:answer.path,status:'verified',reason:existing===''?'readback_matched':'readback_reapplied'});
      }
      result.supportedComplete=result.fields.length===FIELDS.length&&result.fields.every(field=>field.status==='verified');
      result.operableComplete=result.fields.length===FIELDS.length&&result.fields.every(field=>field.status==='verified'||field.reason==='site_readonly');
      result.complete=false;
      state.progress.activeField=null;step('final_readback');
      const outcome=result.fields.some(field=>['readback_matched','readback_reapplied'].includes(field.reason))?'verified'
        :result.fields.some(field=>field.status==='verified')&&result.fields.every(field=>field.status==='verified'
          &&field.reason==='preexisting_same_value'||field.reason==='site_readonly')?'verified_preexisting':'failed_before_write';
      const currentCheck=()=>{try{
        const live=page();return performance.timeOrigin===origin&&outside(live)===otherBefore&&forms(live).length===1
          &&otherSectionForms(live).length===0
          &&JSON.stringify(questionRows())===JSON.stringify(COVERAGE.map(field=>field.question))
          &&forms(live)[0]===form&&valuesExcept(form)===allBefore&&readonlySnapshot()===readonlyBefore&&result.fields.every(row=>row.status!=='verified'
            ||(()=>{const field=FIELDS.find(field=>field.question===row.question),current=target(form,field);
              return sameTarget(targets[field.key],current)&&current.read()===verifiedReads.get(field.key)&&siteValid(current);})());
      }catch{return false;}};
      await checkBinding();
      if(!currentCheck())stop('basic_other_values_changed');
      step('complete');
      const info={...diagnostics(),writeStarted:result.writeStarted,supportedComplete:result.supportedComplete,operableComplete:result.operableComplete,complete:false};
      state.last={requestId:request.requestId,outcome,info,currentCheck};
      return {ok:true,...result,...info};
    }catch(error){
      const reason=error instanceof Stop?error.code:'basic_trial_failed';
      // A failed final check invalidates the earlier field receipts as well as
      // the overall result. Do not expose stale verified coverage after an await.
      if(state.progress?.selectorStep==='final_readback'){
        const staleReason=reason==='basic_other_values_changed'?'final_readback_changed':reason;
        for(const row of result.fields)if(row.status==='verified'){
          Object.assign(row,{status:'failed',reason:staleReason});
          Object.assign(result.coverage.find(field=>field.question===row.question),row);
        }
        for(const row of state.progress.completedFields)if(row.status==='verified')
          Object.assign(row,{status:'failed',reason:staleReason});
        result.supportedComplete=false;result.operableComplete=false;
      }
      const info={...diagnostics(reason),writeStarted:result.writeStarted};
      if(openedByUs&&!result.writeStarted&&form?.isConnected){const cancel=[...form.querySelectorAll('button')]
        .filter(node=>visible(node)&&node.type==='button'&&!node.disabled&&!node.hasAttribute('formaction')&&norm(node.textContent)==='取消');
        if(cancel.length===1){try{await boundAction(()=>{if(!(cancel[0])?.isConnected)stop('profile_action_target_changed');return cancel[0].click();});result.editorLeftOpen=false;}catch{}}}
      state.last={requestId:request?.requestId,outcome:result.writeStarted?'unknown':'failed_before_write',info};
      return {ok:false,...result,...info};
    }finally{state.busy=false;activeBinding=null;}
  }
  const listener=(message,_sender,sendResponse)=>{
    if(message?.type==='GTH_BASIC_TRIAL_STATUS'){
      (async()=>{if(message.profileBinding)await checkBinding(message.profileBinding);await checkBinding(lastBinding||activeBinding);
      const running=state.busy&&state.progress?.requestId===message.requestId;
      const last=state.last?.requestId===message.requestId?state.last:null;
      const outcome=last?.currentCheck?(last.currentCheck()?last.outcome:'unknown'):last?.outcome||'unknown';
      sendResponse({ok:true,data:{requestId:message.requestId,state:running?'running':'settled',outcome,
        ...(running?{...diagnostics(),writeStarted:state.progress.writeStarted}
          :last?.info||{reason:null,activeField:null,selectorStep:'not_started',completedFields:[],writeStarted:false})}});
      })().catch(()=>sendResponse({ok:false,error:'profile_binding_changed',data:{requestId:message.requestId,state:'settled',outcome:'unknown'}}));return true;
    }
    if(message?.type!=='GTH_BASIC_TRIAL')return;
    trial(message).then(sendResponse,()=>sendResponse({ok:false,reason:'basic_trial_failed'}));return true;
  };
  globalThis.ResumeGthBasic=Object.freeze({implementationRevision:4,installed:true,trial,listener});
  chrome.runtime.onMessage.addListener(listener);
})();
