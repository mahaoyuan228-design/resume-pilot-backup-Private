// Ordinary action-popup entry; selected sources and target rows are visible.
// The background job outlives this popup and persists only public outcomes.
const PAGE='https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';
const base=href=>{try{const u=new URL(href);return u.origin+u.pathname;}catch{return null;}};
const escape=value=>String(value??'').replace(/&/gu,'&amp;').replace(/</gu,'&lt;').replace(/>/gu,'&gt;').replace(/"/gu,'&quot;');
const reasons={profile_fact_unconfirmed:'本段资料还未核对',missing_profile_value:'本段缺少答案',insufficient_date_precision:'需要明确的完整日期',record_owner_binding_missing_or_stale:'补充资料需要重新核对',record_supplement_unconfirmed_or_stale:'本段补充资料已变化',record_supplement_invalid:'本段补充资料格式需检查',supplement_month_mismatch:'完整日期与本段年月不一致',existing_value:'已有不同内容，已保留',control_not_supported:'该控件暂未支持',react_serialization_mismatch:'网站实际接收值与资料不一致',react_props_and_serialization_matched:'网站实际接收值已核对',readback_matched:'本次填写并读回一致',dom_readback_matched:'本次填写并读回一致',preexisting_same_value:'已有同值，已保留',page_unfocused:'浏览器窗口未在前台，请点回网页后再填',text_blur_event_not_observed:'焦点未真正离开输入框，父表单可能未保存',text_focus_not_observed:'未能点入输入框',text_blur_not_observed:'未能离开输入框',text_readback_mismatch:'填写后读回不一致',fill_interrupted_page_hidden:'网页被切到后台，填写已中断',
  education_option_missing:'网站下拉没有对应选项',
  ambiguous_education_option:'网站下拉有多个同名选项，未猜选',
  menu_cleanup_failed:'下拉菜单未能安全关闭，请先手动关掉菜单再重试',
  control_busy:'页面已有打开的菜单或控件忙碌，本项未写',
  option_not_found:'网站没有对应选项（未猜选）',
  internship_record_not_ready:'本段实习尚无可填写的已核对资料（缺完整日期或字段未在资料库勾选已核对）',
  internship_records_partial:'部分实习字段已填写；其余需在资料库补日期并勾选已核对',
  internship_type_required:'工作性质须为「实习」',
  internship_date_order_invalid:'开始日期不能晚于结束日期'};
Object.assign(reasons,{reapplied:'本次重新填写并读回一致',education_source_month_needs_review:'请先在本段资料中核对基础年月',supplement_conflicts_with_confirmed_date:'完整日期与已核对日期冲突',education_date_order_invalid:'入学日期不能晚于毕业日期'});
export async function mountCmsInternshipActions(){const tabs=await chrome.tabs.query({active:true,lastFocusedWindow:true}),tab=tabs.length===1?tabs[0]:null;if(!tab||base(tab.url)!==PAGE)return;
  const host=document.querySelector('.site-card');if(!host||document.getElementById('cms-internship-multi'))return;
  const section=document.createElement('section');section.id='cms-internship-multi';section.className='cms-photo-choices';section.innerHTML=`<h2>完整实习经历</h2><p>按资料库中的每段实习分别填写。新增记录由软件操作；缺少公司、岗位、完整日期或描述时，会列出需要补充的答案。</p><button id="cms-internship-read" type="button" class="button secondary">读取实习记录</button><button id="cms-internship-profile" type="button" class="text-button">补充本段资料 ↗</button><div id="cms-internship-bindings"></div><button id="cms-internship-run" type="button" class="button primary" disabled>填写全部选定实习并核对</button><p id="cms-internship-progress" role="status">正在读取上次操作结果…</p><div id="cms-internship-outcomes"></div><small>此按钮不点击网站保存或最终投递。填写结果会核对网站实际接收的数据；关闭弹窗后后台继续。</small>`;host.append(section);
  const ui={read:section.querySelector('#cms-internship-read'),run:section.querySelector('#cms-internship-run'),bindings:section.querySelector('#cms-internship-bindings'),progress:section.querySelector('#cms-internship-progress'),outcomes:section.querySelector('#cms-internship-outcomes')};let inspected=null;
  const request=message=>chrome.runtime.sendMessage({...message,tabId:tab.id});
  const explain=reason=>reasons[reason]||'此项尚未核对，请查看网站当前内容';
  function showJob(job){if(!job){ui.progress.textContent='先读取网站实习记录，再选择各段资料。';return;}
    const busy=['queued','running'].includes(job.state),unknown=['unknown','unknown_profile_invalidated'].includes(job.state);ui.read.disabled=busy||unknown;ui.run.disabled=busy||unknown||!inspected;
    if(busy){ui.progress.textContent='后台正在逐段填写和核对。可以关闭弹窗，稍后重新打开查看结果。';const fill=document.getElementById('fill');if(fill)fill.disabled=true;}
    else if(job.state==='completed')ui.progress.textContent=`${job.serializedRecordCount||job.records?.length||0} 段实习已逐项核对；网站保存还未验收。`;
    else if(job.state==='partial'&&job.reason==='internship_record_not_ready')ui.progress.textContent='未写入网站：本段实习还没有已核对且可填的字段。请在资料库填写完整起止日期，并对公司/岗位/描述等勾选「已核对」后再试（软件不会编造日期）。';
    else if(job.state==='partial')ui.progress.textContent=job.reason==='internship_records_partial'?'部分实习字段已填写；请按下列提示补齐日期并在资料库勾选已核对。':'已完成能准确填写的项目；请补齐下面缺少的资料，再继续。';
    else if(unknown)ui.progress.textContent='本次网站写入尚未完全核对。为避免重复新增，请先查看网站记录和下面结果。';
    else ui.progress.textContent='本次操作已停止；请重新读取网站和资料后再继续。';
    ui.outcomes.innerHTML=(job.fields||[]).map(field=>{const tip=[explain(field.reason)];if(field.reason==='profile_fact_unconfirmed'&&field.valuePreview)tip.push('资料库已有预览：'+field.valuePreview+'（需勾选已核对）');if(field.reason==='missing_profile_value'&&(field.key==='startDate'||field.key==='endDate'||/日期|时间/.test(field.question||'')))tip.push('请填写完整 YYYY-MM-DD，勿留空');return `<div class="field"><span class="field-main"><strong class="field-name">资料第 ${field.profileIndex+1} 段 · ${escape(field.question)}</strong><small class="field-detail">${escape(tip.join(' · '))}</small></span><span class="field-status ${field.status==='verified'?'verified':''}">${field.status==='verified'?'已核对':field.status==='failed'?'未核对':'待处理'}</span></div>`;}).join('');}
  async function refreshJob(){const response=await request({type:'CMS_INTERNSHIP_MULTI_JOB_STATUS'});if(response?.ok)showJob(response.data);}
  ui.read.addEventListener('click',async()=>{ui.read.disabled=true;ui.run.disabled=true;ui.progress.textContent='正在读取网站实习记录…';try{const result=await request({type:'CMS_INTERNSHIP_MULTI_INSPECT_JOB'});if(!result?.ok)throw Error(result?.reason||'inspect_failed');inspected=result;
      if(!result.sources.length){ui.bindings.textContent='资料库还没有实习经历，请先在“我的资料库”添加。';ui.progress.textContent='没有可使用的实习资料。';return;}
      const sourceOptions=result.sources.map(row=>`<option value="${row.profileIndex}">第 ${row.profileIndex+1} 段 · ${escape(row.label||'实习资料')}</option>`).join('');
      const cards=result.rows.map((row,index)=>`<div class="cms-internship-binding" data-row-identity="${escape(row.identity)}"><label class="file-choice">网站第 ${index+1} 段使用哪段资料<select data-cms-internship-existing-source><option value="">请选择资料</option>${sourceOptions}</select></label><label class="remember-choice"><input data-cms-internship-replace type="checkbox">重新填写这条已有记录</label></div>`).join('');
      const additions=result.sources.map(row=>`<label class="remember-choice"><input type="checkbox" data-cms-internship-new-source="${row.profileIndex}">新增：第 ${row.profileIndex+1} 段 · ${escape(row.label||'实习资料')}</label>`).join('');
      ui.bindings.innerHTML=`${cards}<p>其余需要新增的实习：</p>${additions}<small>每段资料只能选择一次。网站已有记录必须明确对应资料；不会按位置猜来源。</small>`;
      // Only an empty single site row and a single source are unambiguous.
      if(result.rows.length===1&&result.sources.length===1&&result.rows[0].fields.every(field=>!field.value||Array.isArray(field.value)&&field.value.every(value=>!value)))ui.bindings.querySelector('[data-cms-internship-existing-source]').value=String(result.sources[0].profileIndex);
      ui.run.disabled=false;ui.progress.textContent='请选择已有记录的资料来源，以及需要新增的实习。';
    }catch(error){inspected=null;const code=String(error?.message||'');ui.progress.textContent=reasons[code]||(`读取失败：${code||'未知原因'}`);}finally{ui.read.disabled=false;}});
  ui.run.addEventListener('click',async()=>{if(!inspected)return;const records=[],used=new Set();try{
      for(const card of ui.bindings.querySelectorAll('[data-row-identity]')){const value=card.querySelector('[data-cms-internship-existing-source]').value;if(value==='')throw Error('source_required');const profileIndex=Number(value),source=inspected.sources.find(row=>row.profileIndex===profileIndex);if(!source||used.has(profileIndex))throw Error('duplicate_source');used.add(profileIndex);records.push({...source,target:{mode:'existing',identity:card.dataset.rowIdentity},replaceExisting:card.querySelector('[data-cms-internship-replace]').checked});}
      for(const input of ui.bindings.querySelectorAll('[data-cms-internship-new-source]:checked')){const profileIndex=Number(input.dataset.cmsInternshipNewSource),source=inspected.sources.find(row=>row.profileIndex===profileIndex);if(!source||used.has(profileIndex))throw Error('duplicate_source');used.add(profileIndex);records.push({...source,target:{mode:'new'},replaceExisting:false});}
      if(!records.length)throw Error('source_required');const ok=confirm(`将填写 ${records.length} 段实习经历。资料缺失时会留空并说明；不会点击网站保存或最终投递。`);if(!ok)return;
      ui.run.disabled=true;ui.read.disabled=true;const response=await request({type:'CMS_INTERNSHIP_MULTI_START',pageUrl:PAGE,profileBinding:inspected.profileBinding,document:inspected.document,records:records.map(({profileIndex,sourceSnapshotHash,supplementRefHash,target,replaceExisting})=>({profileIndex,sourceSnapshotHash,supplementRefHash,target,replaceExisting}))});
      if(!response?.accepted){ui.progress.textContent='未开始填写：网站、资料或授权状态已变化，请重新读取。';ui.read.disabled=false;}else{inspected=null;ui.progress.textContent='后台已开始逐段填写，请稍后查看结果。';await refreshJob();window.close();}
    }catch(error){ui.progress.textContent=error.message==='duplicate_source'?'同一段资料不能同时用于两条记录，请检查选择。':'请为每条已有记录选择资料来源。';ui.run.disabled=false;ui.read.disabled=false;}});
  section.querySelector('#cms-internship-profile').addEventListener('click',async()=>{await chrome.storage.local.set({resumeRequestedSection:'experience'});await chrome.runtime.openOptionsPage();});
  chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local')return;if(changes.resumeProfile||changes.resumeProfileLifecycle){inspected=null;ui.run.disabled=true;ui.bindings.textContent='资料已变化，请重新读取当前客户与网站记录。';refreshJob().catch(()=>{});return;}if(changes[`resumeCmsInternshipJob:${tab.id}`])refreshJob().catch(()=>{});});await refreshJob();
}
mountCmsInternshipActions().catch(()=>{});
