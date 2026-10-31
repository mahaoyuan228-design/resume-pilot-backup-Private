(function(){
  'use strict';
  const skip=reason=>({status:'skipped',reason});
  // CMS_EDU_DOM_HARVEST_2026-10-23-2030.md and the isolated-open retry
  // scripts identify these exact opener surfaces. A complete DOM mouse sequence
  // includes down/up as well as click; HTMLElement.click() alone omits the
  // former and can also be replaced on an element. The caller still owns the
  // row/value guards and must observe a visible linked overlay after this one
  // activation. Expanded ARIA or a hidden captured menu is never proof of open.
  function activateSurface(surface,validate,report=()=>{}){
    const view=surface?.ownerDocument?.defaultView;
    const events=[],observedEvents=[];
    const note=(stage,reason=null)=>report({stage,reason,events:events.slice(),observedEvents:observedEvents.slice()});
    if(!view||typeof validate!=='function'){note('preflight','surface_unavailable');return false;}
    const eventTarget=view.EventTarget?.prototype,doc=surface.ownerDocument;
    const dispatch=eventTarget?.dispatchEvent,listen=eventTarget?.addEventListener,unlisten=eventTarget?.removeEventListener;
    if(typeof dispatch!=='function'||typeof listen!=='function'||typeof unlisten!=='function'){
      note('preflight','event_dispatch_unavailable');return false;
    }
    const wrapper=surface.closest('[id^="14_"]'),section=surface.closest('.form-cell[id="14"]');
    const isSelect=surface.matches('.ant-select-selection[role="combobox"]'),owner=surface.getAttribute('aria-controls');
    const current=(stage,rebind=false)=>{
      note(stage);
      const candidate=validate();
      const refuse=reason=>{note(stage,reason);return false;};
      if(!candidate)return refuse('validation_rejected');
      if(candidate!==surface&&!rebind)return refuse('surface_changed');
      if(!wrapper||!section||candidate.ownerDocument!==surface.ownerDocument
        ||candidate.closest('[id^="14_"]')!==wrapper||candidate.closest('.form-cell[id="14"]')!==section
        ||candidate.getAttribute('aria-controls')!==owner)return refuse('binding_changed');
      if(!candidate.isConnected||!candidate.getClientRects().length||candidate.closest('[hidden],[aria-hidden="true"]')
        ||view.getComputedStyle(candidate).display==='none'||view.getComputedStyle(candidate).visibility==='hidden')return refuse('surface_hidden');
      if(isSelect){
        const select=candidate.closest('.ant-select');
        if(!candidate.matches('.ant-select-selection[role="combobox"]')||!select
          ||select.classList.contains('ant-select-disabled')||candidate.getAttribute('aria-disabled')==='true')return refuse('surface_disabled');
      }else if(!candidate.matches('input.ant-calendar-picker-input[readonly]')
        ||!candidate.readOnly||candidate.disabled||!candidate.closest('.ant-calendar-picker')){
        return refuse('surface_disabled');
      }
      surface=candidate;
      return true;
    };
    if(!current('preflight'))return false;
    surface.scrollIntoView?.({block:'center',inline:'nearest',behavior:'instant'});
    // Scroll/focus can synchronously replace the opener. Before any mouse
    // event, reacquire only the caller-validated surface in the same captured
    // wrapper/section with the same aria owner. Never retarget a partial press.
    if(!current('scroll',true))return false;
    surface.focus({preventScroll:true});
    if(!current('focus',true))return false;
    const rect=surface.getBoundingClientRect(),clientX=Number.isFinite(rect.left+rect.width/2)?rect.left+rect.width/2:0,
      clientY=Number.isFinite(rect.top+rect.height/2)?rect.top+rect.height/2:0;
    for(const type of ['mousedown','mouseup','click']){
      if(!current(type))return false;
      const event=new view.MouseEvent(type,{bubbles:true,cancelable:true,view,
        button:0,buttons:type==='mousedown'?1:0,detail:1,clientX,clientY});
      let observed=false;
      const receipt=received=>{if(received===event&&received.target===surface)observed=true;};
      // #177 logged method calls as complete even when no event reached the
      // document click guard. Bypass an opener's shadowed dispatchEvent and
      // require receipt on the real DOM path. Do not infer receipt from the
      // dispatch return value: preventDefault on a mouse press can be normal.
      listen.call(doc,type,receipt,true);
      try{dispatch.call(surface,event);events.push(type);}
      finally{unlisten.call(doc,type,receipt,true);}
      if(!observed){note(type,'event_not_observed');return false;}
      observedEvents.push(type);
    }
    return current('complete');
  }
  globalThis.ResumeCmsEducationMultiWidgetControls=Object.freeze({activateSurface});
  globalThis.ResumeCmsEducationMultiAdapters=Object.freeze({
    // Search the same text we must select (mapped catalog optionText, else
    // profile school). Searching a different profile spelling while matching
    // mapped optionText left create-school templates unreachable.
    school:(field,fact,binding)=>field.selections.length===1&&globalThis.ResumeCmsMultiSchoolSearch
      ?globalThis.ResumeCmsMultiSchoolSearch.fillSchool(field.selections[0],fact.optionText,fact.optionText,binding):skip('school_adapter_unavailable'),
    date:(field,fact,binding)=>field.input&&globalThis.ResumeCmsMultiEducationDates
      ?globalThis.ResumeCmsMultiEducationDates.fillEducationDate(field.input,fact.value,binding):skip('date_adapter_unavailable'),
    select:(field,fact,binding,context)=>globalThis.ResumeCmsMultiSelect
      ?globalThis.ResumeCmsMultiSelect.fillSelect(field,fact,binding,context):skip('select_adapter_unavailable'),
    region:(field,fact,binding)=>{
      const wraps=[...field.item.querySelectorAll('.cascader-plugins-wrap')].filter(wrap=>wrap.closest('.ant-form-item')===field.item);
      if(wraps.length!==1||!globalThis.ResumeCmsMultiRegion)return skip('region_adapter_unavailable');
      const count=globalThis.ResumeCmsEducationMulti.inspect().records?.length;
      return globalThis.ResumeCmsMultiRegion.fillRegion(wraps[0],{...fact.value,confirmed:true,sitePageUrl:location.origin+location.pathname,
        sectionName:binding.sectionName,question:binding.question,rowContext:count===1?'single':'multiple',rowIdentity:binding.rowIdentity,profileIndex:binding.profileIndex,sourceSnapshotHash:binding.sourceSnapshotHash},binding);
    }
  });
})();
