(function(){
  "use strict";
  async function checkProfileWrite(){const context=globalThis.ResumeProfileWriteContext;if(context)await context.check();}

  const PAGE='https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';
  const questions=new Set(['学历','学位','专业排名']),pause=ms=>new Promise(done=>setTimeout(done,ms));
  const visible=n=>!!n?.isConnected&&!!n.getClientRects().length&&getComputedStyle(n).display!=='none'&&getComputedStyle(n).visibility!=='hidden';
  // NFKC + strip spaces/zero-width so fullwidth ％ and thin spaces do not false-miss.
  const exact=v=>String(v||'').normalize('NFKC').replace(/[\u200b-\u200d\ufeff]/gu,'').replace(/\s+/gu,'').trim(),fail=reason=>{throw Error(reason);};
  // Closed synonym classes only. Match when a live menu option is in the same
  // class as the profile fact (e.g. 未排名 ↔ 无统计; 硕士 ↔ 硕士研究生). Do not
  // invent an option that is absent from the open dropdown.
  const UNRANKED=new Set(['未排名','无统计','无排名','不排名','暂无排名','暂无','无'].map(exact));
  // CMS 学历 catalog often uses 硕士研究生/博士研究生/大学本科 while profiles store short forms.
  const DEGREE_LEVELS=[
    new Set(['本科','大学本科'].map(exact)),
    new Set(['硕士','硕士研究生'].map(exact)),
    new Set(['博士','博士研究生'].map(exact)),
    new Set(['大专','专科','大学专科'].map(exact))
  ];
  const sameDegreeLevel=(left,right)=>DEGREE_LEVELS.some(set=>set.has(left)&&set.has(right));
  const optionMatch=(a,b)=>{const left=exact(a),right=exact(b);return left===right||UNRANKED.has(left)&&UNRANKED.has(right)||sameDegreeLevel(left,right);};
  const menus=()=>[...document.querySelectorAll('.ant-select-dropdown')].filter(n=>visible(n)&&!n.classList.contains('ant-select-dropdown-hidden'));
  const opened=()=>[...document.querySelectorAll('.ant-select.ant-select-open')].filter(visible);
  async function fillSelect(field,fact,binding,context){
    try{if(typeof chrome!=='undefined'&&chrome.runtime?.getManifest?.()?.background?.service_worker==='src/license/guard-worker.mjs'&&(await chrome.runtime.sendMessage({type:'RESUME_PAID_VERIFY'}))?.allowed!==true)return {status:'skipped',reason:'license_required'};}catch{return {status:'skipped',reason:'license_required'};}
    if(location.origin+location.pathname!==PAGE||!(binding?.collection==='experience'?new Set(['工作性质']):questions).has(binding?.question)||binding.confirmed!==true||!binding.rowIdentity)return {status:'skipped',reason:'education_select_binding_invalid'};
    if(typeof fact?.optionText!=='string'||!fact.optionText.trim())return {status:'skipped',reason:'explicit_option_required'};
    const href=location.href,timeOrigin=performance.timeOrigin,desired=exact(fact.optionText),form=context.form;
    const snapshotOutside=item=>JSON.stringify([...form.querySelectorAll('input,textarea,select,.ant-select-selection-selected-value,.ant-select-selection-item')].filter(n=>!item.contains(n)).map(n=>[n.tagName,n.type||'',n.value??n.textContent??'',!!n.checked]));
    const protectedValues=snapshotOutside(field.item);let ownedMenu=null,changed=false;
    const guard=()=>{if(document.visibilityState!=='visible')fail('fill_interrupted_page_hidden');if(performance.timeOrigin!==timeOrigin)fail('education_document_changed');const live=context.locate();
      if(!live||live.kind!=='select'||live.selections.length!==1||(binding.collection==='experience'?globalThis.ResumeCmsInternshipMulti:globalThis.ResumeCmsEducationMulti)?.locateRow(form,binding.rowIdentity)!==live.row||snapshotOutside(live.item)!==protectedValues)fail('education_select_or_neighbor_changed');
      const selection=live.selections[0],select=selection.closest('.ant-select');if(!select||select.classList.contains('ant-select-disabled'))fail('education_select_disabled');return {...live,selection,select};};
    const linked=()=>{const live=guard(),all=menus(),open=opened();if(all.length!==1||open.length!==1||open[0]!==live.select)return null;
      const ids=[...new Set([live.selection,...live.select.querySelectorAll('[aria-controls]')].map(n=>n.getAttribute('aria-controls')).filter(Boolean))];
      if(ids.length>1)return null;if(ids.length===1){const target=document.getElementById(ids[0]);if(!target||!all[0].contains(target))return null;}
      return {live,menu:all[0]};};
    const close=async()=>{if(!menus().length&&!opened().length)return true;const own=linked();if(!own||ownedMenu&&own.menu!==ownedMenu)return false;
      const selection=own.live.selection,select=own.live.select;selection.focus();const focused=document.activeElement,delegated=focused instanceof HTMLInputElement&&select.contains(focused)&&focused.type==='text'&&visible(focused);
      if(focused!==selection&&!delegated)return false;
      for(const surface of [selection,...[...select.querySelectorAll('input')].filter(n=>n instanceof HTMLInputElement&&n.type==='text'&&visible(n))]){const event=new KeyboardEvent('keydown',{key:'Escape',code:'Escape',keyCode:27,which:27,bubbles:true,cancelable:true});surface.dispatchEvent(event);}
      if(delegated)focused.blur();selection.blur();if(menus().length)for(const type of ['mousedown','mouseup','click'])document.body.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true}));
      for(let n=0;n<30;n++){if(!menus().length&&!opened().length)return true;await pause(40);}return false;};
    const enabledOptions=menu=>[...menu.querySelectorAll('.ant-select-dropdown-menu-item[role=option]')].filter(n=>visible(n)&&n.getAttribute('aria-disabled')!=='true'&&!n.classList.contains('ant-select-dropdown-menu-item-disabled'));
    const matchingOptions=menu=>enabledOptions(menu).filter(n=>optionMatch(n.textContent,desired));
    let result;
    try{let live=guard();const initial=live.value[0],same=optionMatch(initial,desired);if(same&&binding.replaceExisting!==true)return {status:'verified',reason:'preexisting_same_value'};
      if(initial&&binding.replaceExisting!==true)return {status:'skipped',reason:'existing_value'};
      if(menus().length||opened().length||[...document.querySelectorAll('.ant-calendar-picker-container,.ant-modal,.ant-cascader-menus')].some(visible))return {status:'skipped',reason:'control_busy'};
      await checkProfileWrite(); live.selection.click();await checkProfileWrite();let signature='',stable=0,candidate=null,softMissing=false;const started=Date.now();
      while(Date.now()-started<3200){await pause(60);const own=linked();if(!own)continue;if(!ownedMenu)ownedMenu=own.menu;if(ownedMenu!==own.menu)fail('education_select_menu_changed');
        const options=enabledOptions(own.menu),next=JSON.stringify(options.map(n=>[n.textContent,n.className,n.getAttribute('aria-disabled')])),busy=!!own.menu.querySelector('.ant-spin-spinning,[aria-busy=true]');
        stable=next===signature&&!busy?stable+1:0;signature=next;
        if(Date.now()-started<300||stable<3)continue;
        const matches=matchingOptions(own.menu);
        if(matches.length>1)fail('ambiguous_education_option');
        if(matches.length===1){candidate=matches[0];break;}
        softMissing=true;break;}
      if(softMissing){const samples=ownedMenu?enabledOptions(ownedMenu).map(n=>exact(n.textContent)).filter(Boolean).slice(0,8):[];result={status:'skipped',reason:'education_option_missing',desiredOptionText:desired,sampleOptions:samples};}
      else{
        if(!candidate)fail('education_select_menu_not_stable');const own=linked(),matches=own?matchingOptions(own.menu):[];
        if(!own||matches.length!==1||matches[0]!==candidate||candidate.tagName!=='LI')fail('education_select_candidate_changed');await checkProfileWrite(); candidate.click();await checkProfileWrite();changed=true;
        const deadline=Date.now()+2000;while(Date.now()<deadline){await pause(40);live=guard();if(optionMatch(live.value[0],desired)&&!menus().length&&!opened().length)break;}
        live=guard();result=optionMatch(live.value[0],desired)?{status:'verified',reason:same?'reapplied':'readback_matched'}:{status:'failed',reason:'education_select_readback_mismatch'};
      }
    }catch(error){ if(/^profile_[a-z_]+$/u.test(error?.message||''))throw error;result={status:'failed',reason:/^[a-z_]+$/u.test(error?.message||'')?error.message:'education_select_failed',partial:changed};}
    if(ownedMenu&&document.visibilityState==='visible'&&!await close())return {status:'failed',reason:'menu_cleanup_failed',primaryReason:result?.reason,partial:changed};
    return result||{status:'failed',reason:'education_select_outcome_unknown'};
  }
  globalThis.ResumeCmsMultiSelect=Object.freeze({implementationRevision:5,fillSelect:(field,fact,binding,context)=>fillSelect(field,fact,{...binding,collection:'education'},context)});
  globalThis.ResumeCmsInternshipSelect=Object.freeze({implementationRevision:1,fillSelect:(field,fact,binding,context)=>fillSelect(field,fact,{...binding,collection:'experience'},context)});
})();
