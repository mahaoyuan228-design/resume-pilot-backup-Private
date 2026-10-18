(function(){'use strict';const skip=reason=>({status:'skipped',reason});globalThis.ResumeCmsInternshipMultiAdapters=Object.freeze({
date:(field,fact,binding)=>field.input&&globalThis.ResumeCmsInternshipDates?globalThis.ResumeCmsInternshipDates.fillDate(field.input,fact.value,binding):skip('date_adapter_unavailable'),
select:(field,fact,binding,context)=>globalThis.ResumeCmsInternshipSelect?globalThis.ResumeCmsInternshipSelect.fillSelect(field,fact,binding,context):skip('select_adapter_unavailable')});})();
