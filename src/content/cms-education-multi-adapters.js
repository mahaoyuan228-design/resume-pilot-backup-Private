(function(){
  'use strict';
  const skip=reason=>({status:'skipped',reason});
  // CMS_EDU_DOM_HARVEST_2026-10-23-2030.md and the isolated-open retry
  // scripts identify these exact opener surfaces. A native mouse activation
  // includes down/up as well as click; HTMLElement.click() alone omits the
  // former and can also be replaced on an element. The caller still owns the
  // row/value guards and must observe a visible linked overlay after this one
  // activation. Expanded ARIA or a hidden captured menu is never proof of open.
  function activateSurface(surface,validate){
    const view=surface?.ownerDocument?.defaultView;
    if(!view||typeof validate!=='function')return false;
    const wrapper=surface.closest('[id^="14_"]'),section=surface.closest('.form-cell[id="14"]');
    const current=()=>{
      if(validate()!==surface||!surface.isConnected||!wrapper||!section
        ||surface.closest('[id^="14_"]')!==wrapper||surface.closest('.form-cell[id="14"]')!==section
        ||!surface.getClientRects().length||surface.closest('[hidden],[aria-hidden="true"]')
        ||view.getComputedStyle(surface).display==='none'||view.getComputedStyle(surface).visibility==='hidden')return false;
      if(surface.matches('.ant-select-selection[role="combobox"]')){
        const select=surface.closest('.ant-select');
        return !!select&&!select.classList.contains('ant-select-disabled')&&surface.getAttribute('aria-disabled')!=='true';
      }
      return surface.matches('input.ant-calendar-picker-input[readonly]')
        &&surface.readOnly&&!surface.disabled&&!!surface.closest('.ant-calendar-picker');
    };
    if(!current())return false;
    surface.scrollIntoView?.({block:'center',inline:'nearest',behavior:'instant'});
    if(!current())return false;
    surface.focus({preventScroll:true});
    if(!current())return false;
    const rect=surface.getBoundingClientRect(),clientX=Number.isFinite(rect.left+rect.width/2)?rect.left+rect.width/2:0,
      clientY=Number.isFinite(rect.top+rect.height/2)?rect.top+rect.height/2:0;
    for(const type of ['mousedown','mouseup','click']){
      if(!current())return false;
      surface.dispatchEvent(new view.MouseEvent(type,{bubbles:true,cancelable:true,view,
        button:0,buttons:type==='mousedown'?1:0,detail:1,clientX,clientY}));
    }
    return current();
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
