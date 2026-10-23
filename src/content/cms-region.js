(function () {
  "use strict";
  async function checkProfileWrite(){const context=globalThis.ResumeProfileWriteContext;if(context)await context.check();}

  // Standalone until real menu ownership/readback evidence supports wiring.
  // Province and city are explicit facts. This module never splits a location,
  // infers a province from a city, or replaces an existing different value.
  const ORIGIN='https://wecruit.hotjob.cn',PATH=/^\/SU[^/]+\/pb\/resumeOperation\.html$/;
  const QUESTIONS={
    '个人基本信息必填':new Set(['现居住地','籍贯']),
    '求职意向必填':new Set(['意向一期望工作地点','意向二期望工作地点']),
    '教育经历必填':new Set(['城市'])
  };
  const pause=ms=>new Promise(done=>setTimeout(done,ms));
  const clean=value=>String(value||'').normalize('NFKC').replace(/[＊*：:\s]/gu,'');
  const exact=value=>String(value||'').normalize('NFKC').replace(/\s+/gu,'').trim();
  const visible=node=>!!node?.isConnected&&!!node.getClientRects().length
    &&!node.closest('[hidden],[aria-hidden="true"]')&&getComputedStyle(node).display!=='none'
    &&getComputedStyle(node).visibility!=='hidden';
  const selected=selection=>String(selection?.querySelector(
    '.ant-select-selection-selected-value,.ant-select-selection-item')?.textContent||'').trim();
  const menus=()=>[...document.querySelectorAll('.ant-select-dropdown')].filter(node=>visible(node)
    &&!node.classList.contains('ant-select-dropdown-hidden'));
  const opened=()=>[...document.querySelectorAll('.ant-select.ant-select-open')].filter(visible);
  const fail=reason=>{throw Error(reason);};
  const canonical=value=>JSON.stringify(value);
  // Public structural diagnostics only: no applicant answers or option text.
  let lastDiagnostic=null;
  function scope(wrap) {
    if(!(wrap instanceof HTMLElement)||!wrap.matches('.cascader-plugins-wrap')||!visible(wrap))return null;
    const item=wrap.closest('.ant-form-item'),section=item?.closest('.form-cell'),form=section?.closest('form');
    if(!item||!section||!form)return null;
    const labels=[...item.querySelectorAll('.ant-form-item-label > label')]
      .filter(node=>node.closest('.ant-form-item')===item);
    const question=labels.length===1?clean(labels[0].textContent):'',
      sectionName=clean(section.querySelector(':scope > .tit-wrap .tit')?.textContent);
    if(!QUESTIONS[sectionName]?.has(question)||item.querySelectorAll('.cascader-plugins-wrap').length!==1)return null;
    const sections=[...form.querySelectorAll('.form-cell')].filter(node=>visible(node)
      &&clean(node.querySelector(':scope > .tit-wrap .tit')?.textContent)===sectionName);
    if(sections.length!==1||sections[0]!==section)return null;
    const row=item.closest('.form-cell-inner'),rows=[...section.querySelectorAll(':scope > .form-cell-right > .form-cell-inner')];
    const rowIndex=row?rows.indexOf(row):-1;
    const rowContext=row?(rows.length===1&&rowIndex===0?'single':'multiple'):'none';
    // Multiple repeated records require explicit future source/record binding.
    if(rowContext==='multiple')return null;
    const peers=[...section.querySelectorAll('.ant-form-item')].filter(node=>{
      if(!visible(node)||node.closest('.form-cell-inner')!==row)return false;
      const own=[...node.querySelectorAll('.ant-form-item-label > label')].filter(label=>label.closest('.ant-form-item')===node);
      return own.length===1&&clean(own[0].textContent)===question;
    });
    if(peers.length!==1||peers[0]!==item)return null;
    const selects=[...wrap.querySelectorAll('.ant-select')].filter(node=>node.closest('.cascader-plugins-wrap')===wrap);
    if(selects.length!==2)return null;
    const selections=selects.map(select=>{
      const own=[...select.querySelectorAll('.ant-select-selection--single')].filter(visible);
      return own.length===1?own[0]:null;
    });
    if(selections.some(node=>!node))return null;
    return {wrap,item,section,form,sectionName,question,rowContext,selects,selections};
  }
  function sameFact(target,fact) {
    return fact?.confirmed===true&&fact.sitePageUrl===location.origin+location.pathname
      &&clean(fact.sectionName)===target.sectionName&&clean(fact.question)===target.question
      &&fact.rowContext===target.rowContext&&['province','city'].every(key=>typeof fact[key]==='string'
        &&fact[key].trim()&&fact[key].length<=160&&!/[\u0000-\u001f]/u.test(fact[key]));
  }
  function inspectControl(wrap) {
    if(location.origin!==ORIGIN||!PATH.test(location.pathname))return null;
    const target=scope(wrap);return target?{sectionName:target.sectionName,question:target.question,
      rowContext:target.rowContext,province:selected(target.selections[0]),city:selected(target.selections[1])}:null;
  }
  // Optional future profile adapter proposal: strict scoped JSON pair held in
  // customFacts, shown as two normal fields by the UI, never entered as JSON by
  // a customer. This resolver is not called by the product engine yet.
  function resolveFact(profile,wrap) {
    const target=scope(wrap);if(!target)return {ok:false,reason:'control_guard'};
    const matches=(profile?.customFacts||[]).filter(row=>clean(row?.question)===target.question);
    if(matches.length!==1)return {ok:false,reason:'region_fact_not_unique'};
    const saved=matches[0],path=`customAnswers.${saved.question}`;
    if(!(profile.confirmedFields||[]).includes(path)||saved.answer!==profile.customAnswers?.[saved.question])
      return {ok:false,reason:'region_fact_unconfirmed'};
    let pair;try{pair=JSON.parse(saved.answer);}catch{return {ok:false,reason:'explicit_region_pair_required'};}
    if(!pair||Array.isArray(pair)||canonical(Object.keys(pair).sort())!==canonical(['city','province']))
      return {ok:false,reason:'explicit_region_pair_required'};
    const fact={...pair,question:saved.question,sectionName:saved.sectionName,rowContext:saved.rowContext,
      sitePageUrl:saved.sitePageUrl,confirmed:true};
    return sameFact(target,fact)?{ok:true,path,fact}:{ok:false,reason:'region_fact_scope_mismatch'};
  }
  async function fillRegion(wrap,fact) {
    if(location.origin!==ORIGIN||!PATH.test(location.pathname))return {status:'skipped',reason:'wrong_site',partial:false};
    const initial=scope(wrap);if(!initial)return {status:'skipped',reason:'control_guard',partial:false};
    if(!sameFact(initial,fact))return {status:'failed',reason:'unconfirmed_or_incomplete_region_pair',partial:false};
    const desired=[fact.province.trim(),fact.city.trim()],href=location.href,timeOrigin=performance.timeOrigin;
    const baseline={...initial,href,timeOrigin};
    const outside=(ignoreWrap=baseline.wrap)=>canonical([...baseline.form.querySelectorAll('input,textarea,select,.ant-select-selection-selected-value,.ant-select-selection-item')]
      .filter(node=>!node.closest('.cascader-plugins-wrap')||node.closest('.cascader-plugins-wrap')!==ignoreWrap)
      .map(node=>[node.tagName,node.type||'',node.value??node.textContent??'',!!node.checked,node.selectedIndex??null]));
    const protectedValues=outside();let selections=0,activeLevel=null,ownedMenu=false;
    const locate=()=>{
      if(location.href!==href||performance.timeOrigin!==timeOrigin||!baseline.form.isConnected)return null;
      const candidates=[...baseline.form.querySelectorAll('.cascader-plugins-wrap')].map(scope).filter(Boolean)
        .filter(target=>target.sectionName===baseline.sectionName&&target.question===baseline.question
          &&target.rowContext===baseline.rowContext);
      return candidates.length===1?candidates[0]:null;
    };
    const guard=()=>{
      if(document.visibilityState!=='visible')fail('fill_interrupted_page_hidden');
      const live=locate();if(!live||outside(live.wrap)!==protectedValues)fail('field_or_neighbor_changed');return live;
    };
    const values=live=>live.selections.map(selected);
    const first=values(initial);
    if(first.some((value,index)=>value&&exact(value)!==exact(desired[index])))
      return {status:'skipped',reason:'existing_value',partial:false};
    if(first.every((value,index)=>exact(value)===exact(desired[index])))
      return {status:'verified',reason:'preexisting_same_value',partial:false,selectedLevels:0};
    if(menus().length||opened().length||[...document.querySelectorAll('.ant-calendar-picker-container,.ant-cascader-menus,.ant-modal,.ant-popover')].some(visible))
      return {status:'skipped',reason:'control_busy',partial:false};
    function linkedMenu(live,index) {
      const select=live.selects[index],open=opened(),all=menus();
      if(open.length!==1||open[0]!==select||all.length!==1)return null;
      // Real Ant versions place aria-controls on selection or its input. No
      // fallback to an unrelated global menu is permitted when the link is absent.
      const ids=[...new Set([select,...select.querySelectorAll('[aria-controls]')]
        .map(node=>node.getAttribute('aria-controls')).filter(Boolean))];
      if(ids.length!==1)return null;
      const linked=document.getElementById(ids[0]);if(!linked||!visible(linked)||!all[0].contains(linked))return null;
      const lists=linked.matches('.ant-select-dropdown-menu[role="listbox"]')?[linked]
        :[...linked.querySelectorAll('.ant-select-dropdown-menu[role="listbox"]')].filter(visible);
      return lists.length===1?{menu:all[0],list:lists[0]}:null;
    }
    async function closeOwn() {
      if(!menus().length&&!opened().length)return true;
      const live=locate();if(!live||activeLevel===null||opened().length!==1||opened()[0]!==live.selects[activeLevel]
        ||menus().length!==1)return false;
      const selection=live.selections[activeLevel],ownedSelect=live.selects[activeLevel];
      // The actual Ant v3 menu ignores a heading click and blur on an
      // unfocused input. Focus its own tabindex selection, deliver Escape to
      // both owned surfaces, then blur/outside-click, without changing values.
      selection.focus();const focused=document.activeElement;
      // Ant may delegate selection focus to its own visible text input. An
      // unrelated or hidden input is not an owned cleanup surface.
      const delegated=focused!==selection&&focused instanceof HTMLInputElement
        &&focused.type==='text'&&ownedSelect.contains(focused)&&visible(focused);
      if(focused!==selection&&!delegated)return false;
      const surfaces=[...ownedSelect.querySelectorAll('input')]
        .filter(node=>node instanceof HTMLInputElement&&node.type==='text'&&visible(node));
      surfaces.push(selection);
      for(const surface of surfaces) {
        const event=new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true});
        Object.defineProperties(event,{keyCode:{get:()=>27},which:{get:()=>27}});surface.dispatchEvent(event);
      }
      if(delegated)focused.blur();selection.blur();if(menus().length)for(const type of ['mousedown','mouseup','click'])
        document.body.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true}));
      for(let i=0;i<30;i++){if(!menus().length&&!opened().length)return true;await pause(40);}return false;
    }
    async function choose(index) {
      activeLevel=index;let live=guard();
      if(exact(selected(live.selections[index]))===exact(desired[index]))return;
      for(let i=0;i<35&&live.selects[index].classList.contains('ant-select-disabled');i++){await pause(40);live=guard();}
      if(live.selects[index].classList.contains('ant-select-disabled'))fail(index?'city_not_ready':'province_disabled');
      if(selected(live.selections[index]))fail('existing_value_changed');
      await checkProfileWrite();live=guard();
      if(selected(live.selections[index]))fail('existing_value_changed');
      if(live.selects[index].classList.contains('ant-select-disabled'))fail(index?'city_not_ready':'province_disabled');
      live.selections[index].click();ownedMenu=true;
      let menu;
      for(let i=0;i<35;i++){live=guard();menu=linkedMenu(live,index);if(menu)break;await pause(40);}
      if(!menu)fail('menu_link_missing_or_ambiguous');
      let signature='',stable=0,candidate=null;const started=performance.now();
      for(let i=0;i<45;i++) {
        live=guard();menu=linkedMenu(live,index);if(!menu)fail('menu_changed');
        const options=[...menu.list.querySelectorAll('.ant-select-dropdown-menu-item[role="option"]')].filter(visible);
        const busy=!!menu.menu.querySelector('.ant-spin-spinning,[aria-busy="true"],.ant-select-dropdown-loading')
          ||/加载中|搜索中|loading/iu.test(menu.menu.textContent||'');
        const next=canonical(options.map(node=>[node.textContent,node.className,node.getAttribute('aria-disabled')]));
        stable=next===signature&&!busy?stable+1:0;signature=next;
        if(performance.now()-started>=300&&stable>=3) {
          const matches=options.filter(node=>node.getAttribute('aria-disabled')!=='true'
            &&!node.classList.contains('ant-select-dropdown-menu-item-disabled')&&exact(node.textContent)===exact(desired[index]));
          if(matches.length!==1)fail(matches.length?'ambiguous_region_option':'region_option_not_found');
          candidate=matches[0];break;
        }
        await pause(80);
      }
      if(!candidate)fail('menu_not_stable');
      live=guard();menu=linkedMenu(live,index);
      const current=menu?[...menu.list.querySelectorAll('.ant-select-dropdown-menu-item[role="option"]')]
        .filter(node=>visible(node)&&node.getAttribute('aria-disabled')!=='true'
          &&!node.classList.contains('ant-select-dropdown-menu-item-disabled')&&exact(node.textContent)===exact(desired[index])):[];
      if(current.length!==1||current[0]!==candidate||candidate.tagName!=='LI'||selected(live.selections[index]))
        fail('candidate_changed');
      await checkProfileWrite();live=guard();menu=linkedMenu(live,index);
      const fresh=menu?[...menu.list.querySelectorAll('.ant-select-dropdown-menu-item[role="option"]')]
        .filter(node=>visible(node)&&node.getAttribute('aria-disabled')!=='true'
          &&!node.classList.contains('ant-select-dropdown-menu-item-disabled')&&exact(node.textContent)===exact(desired[index])):[];
      if(fresh.length!==1||fresh[0]!==candidate||selected(live.selections[index]))fail('candidate_changed');
      candidate.click();selections++;
      for(let i=0;i<35;i++) {
        live=guard();if(exact(selected(live.selections[index]))===exact(desired[index])&&!menus().length&&!opened().length)return;
        await pause(40);
      }
      fail('region_readback_mismatch');
    }
    let result;
    try {
      guard();await choose(0);await choose(1);const final=values(guard());
      if(!final.every((value,index)=>exact(value)===exact(desired[index])))fail('final_readback_mismatch');
      result={status:'verified',reason:'readback_matched',partial:false,selectedLevels:selections};
    }catch(error) { if(/^profile_[a-z_]+$/u.test(error?.message||''))throw error;
      result={status:'failed',reason:/^[a-z_]+$/u.test(error?.message||'')?error.message:'control_error',
        primaryReason:/^[a-z_]+$/u.test(error?.message||'')?error.message:'control_error',
        activeLevel:activeLevel===0?'province':activeLevel===1?'city':null,
        partial:selections>0,selectedLevels:selections};
    }
    if(ownedMenu&&document.visibilityState==='visible'&&!await closeOwn())
      result={status:'failed',reason:'menu_cleanup_failed',primaryReason:result.primaryReason||result.reason,
        activeLevel:activeLevel===0?'province':activeLevel===1?'city':null,
        partial:selections>0,selectedLevels:selections};
    lastDiagnostic={reason:result.reason,primaryReason:result.primaryReason||result.reason,
      activeLevel:result.activeLevel??(activeLevel===0?'province':activeLevel===1?'city':null),
      sectionName:baseline.sectionName,question:baseline.question,partial:result.partial,selectedLevels:selections};
    return result;
  }
  globalThis.ResumeCmsRegion=Object.freeze({implementationRevision:4,fillRegion,resolveFact,inspectControl,diagnostics:()=>lastDiagnostic?{...lastDiagnostic}:null});
})();
