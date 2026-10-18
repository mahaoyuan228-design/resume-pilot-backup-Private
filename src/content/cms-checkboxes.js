(function () {
  "use strict";
  async function checkProfileWrite(){const context=globalThis.ResumeProfileWriteContext;if(context)await context.check();}

  const PAGE='https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';
  const SECTION='求职意向必填';
  const QUESTION='如应聘研究发展中心行业研究类岗位请勾选（建议仅勾选3~5项）';
  const clean=value=>String(value||'').normalize('NFKC').replace(/[＊*：:\s]/gu,'');
  const exact=value=>String(value||'').normalize('NFKC').replace(/\s+/gu,'').trim();
  const visible=node=>!!node?.isConnected&&!!node.getClientRects().length
    &&!node.closest('[hidden],[aria-hidden="true"]')&&getComputedStyle(node).display!=='none'
    &&getComputedStyle(node).visibility!=='hidden';
  const pause=ms=>new Promise(done=>setTimeout(done,ms));
  const canonical=value=>JSON.stringify(value);
  const fail=reason=>{throw Error(reason);};
  const page=()=>location.origin+location.pathname;
  function scope(group) {
    if(page()!==PAGE||!(group instanceof HTMLElement)||!group.matches('.ant-checkbox-group')||!visible(group))return null;
    const item=group.closest('.ant-form-item'),section=item?.closest('.form-cell'),form=item?.closest('form');
    if(!item||!section||!form||item.querySelectorAll('.ant-checkbox-group').length!==1)return null;
    const labels=[...item.querySelectorAll('.ant-form-item-label > label')].filter(node=>node.closest('.ant-form-item')===item);
    const sectionName=clean(section.querySelector(':scope > .tit-wrap .tit')?.textContent);
    const question=labels.length===1?clean(labels[0].textContent):'';
    if(sectionName!==clean(SECTION)||question!==clean(QUESTION))return null;
    const sections=[...form.querySelectorAll('.form-cell')].filter(node=>visible(node)
      &&clean(node.querySelector(':scope > .tit-wrap .tit')?.textContent)===sectionName);
    const rows=[...section.querySelectorAll(':scope > .form-cell-right > .form-cell-inner')],row=item.closest('.form-cell-inner');
    if(sections.length!==1||sections[0]!==section||rows.length!==1||rows[0]!==row)return null;
    const peers=[...row.querySelectorAll('.ant-form-item')].filter(node=>{
      const own=[...node.querySelectorAll('.ant-form-item-label > label')].filter(label=>label.closest('.ant-form-item')===node);
      return visible(node)&&own.length===1&&clean(own[0].textContent)===question;
    });
    if(peers.length!==1||peers[0]!==item)return null;
    const inputs=[...group.querySelectorAll('input[type="checkbox"]')]
      .filter(input=>input.closest('.ant-checkbox-group')===group&&input.closest('.ant-form-item')===item);
    if(inputs.length!==32)return null;
    const options=inputs.map(input=>{
      const label=input.closest('label.ant-checkbox-wrapper'),text=String(label?.textContent||'').trim();
      if(!label||!group.contains(label)||!visible(label)||!text||text.length>160
        ||label.querySelectorAll('input[type="checkbox"]').length!==1)return null;
      return {input,label,text,disabled:input.disabled||label.classList.contains('ant-checkbox-wrapper-disabled')};
    });
    if(options.some(option=>!option)||new Set(options.map(option=>exact(option.text))).size!==32)return null;
    return {group,item,section,form,sectionName,question,rowContext:'single',options};
  }
  const checked=target=>target.options.filter(option=>option.input.checked).map(option=>exact(option.text)).sort();
  function validAnswers(answers) {
    return Array.isArray(answers)&&answers.length>0&&answers.length<=32
      &&answers.every(answer=>typeof answer==='string'&&answer.trim()&&answer.length<=160&&!/[\u0000-\u001f]/u.test(answer))
      &&new Set(answers.map(exact)).size===answers.length;
  }
  function inspectControl(group) {
    const target=scope(group);return target?{sectionName:target.sectionName,question:target.question,rowContext:target.rowContext,
      options:target.options.map(option=>({text:option.text,checked:option.input.checked,disabled:option.disabled})),
      selected:checked(target)}:null;
  }
  function sameFact(target,fact) {
    return fact?.confirmed===true&&fact.sitePageUrl===PAGE&&clean(fact.sectionName)===target.sectionName
      &&clean(fact.question)===target.question&&fact.rowContext==='single'&&validAnswers(fact.answers);
  }
  function resolveFact(profile,group) {
    const target=scope(group);if(!target)return {ok:false,reason:'control_guard'};
    const matches=(profile?.customFacts||[]).filter(row=>clean(row?.question)===target.question
      &&row.sitePageUrl===PAGE&&clean(row.sectionName)===target.sectionName&&row.rowContext==='single');
    if(matches.length!==1)return {ok:false,reason:'checkbox_fact_not_unique'};
    const saved=matches[0],path=`customAnswers.${saved.question}`;
    if(!(profile.confirmedFields||[]).includes(path)||saved.answer!==profile.customAnswers?.[saved.question])
      return {ok:false,path,reason:'checkbox_fact_unconfirmed'};
    let answers;try{answers=JSON.parse(saved.answer);}catch{return {ok:false,path,reason:'explicit_checkbox_array_required'};}
    const fact={question:saved.question,sectionName:saved.sectionName,rowContext:'single',sitePageUrl:PAGE,confirmed:true,answers};
    return sameFact(target,fact)?{ok:true,path,fact}:{ok:false,path,reason:'explicit_checkbox_array_required'};
  }
  async function fillCheckboxes(group,fact) {
    const initial=scope(group);if(!initial)return {status:'skipped',reason:'control_guard',partial:false,clickedOptions:0};
    if(!sameFact(initial,fact))return {status:'skipped',reason:'unconfirmed_checkbox_array',partial:false,clickedOptions:0};
    const desired=fact.answers.map(exact).sort(),before=checked(initial);
    if(before.some(value=>!desired.includes(value)))return {status:'skipped',reason:'existing_value',partial:false,clickedOptions:0};
    if(canonical(before)===canonical(desired))return {status:'verified',reason:'preexisting_same_value',partial:false,clickedOptions:0};
    if(desired.some(value=>initial.options.filter(option=>exact(option.text)===value&&!option.disabled).length!==1))
      return {status:'skipped',reason:'checkbox_option_missing_or_disabled',partial:false,clickedOptions:0};
    const href=location.href,timeOrigin=performance.timeOrigin;
    const outside=()=>canonical([...initial.form.querySelectorAll('input,textarea,select,.ant-select-selection-selected-value,.ant-select-selection-item')]
      .filter(node=>!initial.group.contains(node)).map(node=>[node.tagName,node.type||'',node.value??node.textContent??'',!!node.checked,node.selectedIndex??null]));
    const protectedValues=outside();let clickedOptions=0,expected=before;
    const guard=()=>{
      if(document.visibilityState!=='visible')fail('fill_interrupted_page_hidden');
      const target=scope(group);
      if(location.href!==href||performance.timeOrigin!==timeOrigin||!target||target.item!==initial.item
        ||target.form!==initial.form||outside()!==protectedValues)fail('field_or_neighbor_changed');
      return target;
    };
    try {
      for(const value of desired.filter(value=>!before.includes(value))) {
        let target=guard();if(canonical(checked(target))!==canonical(expected))fail('checkbox_selection_changed');
        const candidates=target.options.filter(option=>exact(option.text)===value&&!option.disabled&&!option.input.checked);
        if(candidates.length!==1)fail('checkbox_candidate_changed');
        await checkProfileWrite(); candidates[0].label.click();clickedOptions++;expected=[...expected,value].sort();
        let matched=false;
        for(let attempt=0;attempt<30;attempt++){
          target=guard();if(canonical(checked(target))===canonical(expected)){matched=true;break;}await pause(40);
        }
        if(!matched)fail('checkbox_readback_mismatch');
      }
      if(canonical(checked(guard()))!==canonical(desired))fail('checkbox_readback_mismatch');
      return {status:'verified',reason:'readback_matched',partial:false,clickedOptions};
    }catch(error){ if(/^profile_[a-z_]+$/u.test(error?.message||''))throw error;return {status:'failed',reason:/^[a-z_]+$/u.test(error?.message||'')?error.message:'control_error',
      partial:clickedOptions>0,clickedOptions};}
  }
  globalThis.ResumeCmsCheckboxes=Object.freeze({implementationRevision:2,inspectControl,resolveFact,fillCheckboxes});
})();
