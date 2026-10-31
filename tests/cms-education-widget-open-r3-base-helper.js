// Immutable offline comparison helper from d22734a92b130ca58fbd7c44b4ec7d1d45c41caa.
// src/content/cms-education-multi-adapters.js, activation IIFE only. No live claim.
// Source Git blob: 58222ca8fb4d72339545d9579269c3c8a4b53312.
(function(){
  'use strict';
  const skip=reason=>({status:'skipped',reason});
  // CMS_EDU_DOM_HARVEST_2026-10-23-2030.md and the isolated-open retry
  // scripts identify these exact opener surfaces. A native mouse activation
  // includes down/up as well as click; HTMLElement.click() alone omits the
  // former and can also be replaced on an element. The caller still owns the
  // row/value guards and must observe a visible linked overlay after this one
  // activation. Expanded ARIA or a hidden captured menu is never proof of open.
  function activateSurface(surface,validate,report=()=>{}){
    const view=surface?.ownerDocument?.defaultView;
    const events=[];
    const note=(stage,reason=null)=>report({stage,reason,events:events.slice()});
    if(!view||typeof validate!=='function'){note('preflight','surface_unavailable');return false;}
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
      surface.dispatchEvent(new view.MouseEvent(type,{bubbles:true,cancelable:true,view,
        button:0,buttons:type==='mousedown'?1:0,detail:1,clientX,clientY}));
      events.push(type);
    }
    return current('complete');
  }
  globalThis.ResumeCmsEducationMultiWidgetControls=Object.freeze({activateSurface});
})();
