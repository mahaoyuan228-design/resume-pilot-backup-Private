(function(){
  'use strict';
  const skip=reason=>({status:'skipped',reason});
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
