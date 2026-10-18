// Ordinary action-popup entry; selected sources and target rows are visible.
// The background job outlives this popup and persists only public outcomes.
const PAGE='https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';
const base=href=>{try{const u=new URL(href);return u.origin+u.pathname;}catch{return null;}};
const escape=value=>String(value??'').replace(/&/gu,'&amp;').replace(/</gu,'&lt;').replace(/>/gu,'&gt;').replace(/"/gu,'&quot;');
const reasons={profile_fact_unconfirmed:'本段资料还未核对',missing_profile_value:'本段缺少答案',insufficient_date_precision:'需要明确的完整日期',record_owner_binding_missing_or_stale:'补充资料需要重新核对',record_supplement_unconfirmed_or_stale:'本段补充资料已变化',record_supplement_invalid:'本段补充资料格式需检查',supplement_month_mismatch:'完整日期与本段年月不一致',existing_value:'已有不同内容，已保留',control_not_supported:'该控件暂未支持',react_serialization_mismatch:'网站实际接收值与资料不一致',react_props_and_serialization_matched:'网站实际接收值已核对',readback_matched:'本次填写并读回一致',dom_readback_matched:'本次填写并读回一致',preexisting_same_value:'已有同值，已保留',page_unfocused:'浏览器窗口未在前台，请点回网页后再填',text_blur_event_not_observed:'焦点未真正离开输入框，父表单可能未保存',text_focus_not_observed:'未能点入输入框',text_blur_not_observed:'未能离开输入框',text_readback_mismatch:'填写后读回不一致',fill_interrupted_page_hidden:'网页被切到后台，填写已中断'};
Object.assign(reasons,{reapplied:'本次重新填写并读回一致',education_source_month_needs_review:'请先在本段资料中核对基础年月',supplement_conflicts_with_confirmed_date:'完整日期与已核对日期冲突',education_date_order_invalid:'入学日期不能晚于毕业日期',
  cms_education_pending_review:'上次填写还在待核对锁定中，请先点下方「我已看过网站，解除锁定」',
  cms_education_active_tab_changed:'请先点回招商简历网页标签，再读取（不要停在别的标签）',
  cms_education_document_changed:'网页已刷新或切到后台，请点回简历页后再读取',
  cms_education_inspect_failed:'网页教育记录读取失败，请刷新简历页后重试',
  cms_education_job_failed:'读取失败，请关闭扩展面板后重开再试',
  profile_binding_changed:'客户资料已变化，请重新打开扩展再读取',
  license_required:'授权核验未通过（授权版需先在「授权激活」页粘贴令牌；内部试用包不应出现此提示）',
  inspect_failed:'读取失败',education_owner_profile_invalid:'资料库为空或损坏，请先打开资料库恢复/导入客户资料',education_owner_epoch_invalid:'资料生命周期异常，请重开资料库',education_owner_profile_changed:'资料已变化，请重新读取',
  option_not_found:'网站没有与已确认学校完全一致的选项（未猜选，本项已跳过）。请到资料库「网站选项对应」手工填写网站原文后再填；软件不会猜校名，也不会在非唯一时点「创建」。',
  ambiguous_option:'网站有多个同名学校选项，未猜选',
  region_option_not_found:'网站省市列表没有与资料完全一致的选项（请核对省市原文）',
  ambiguous_region_option:'网站省市有多个同名选项，未猜选',
  region_readback_mismatch:'省市选择后读回不一致',
  final_readback_mismatch:'省市最终读回不一致',
  unconfirmed_or_incomplete_region_pair:'省市资料未核对或不完整',
  education_option_missing:'网站学历/学位/专业排名下拉没有对应选项（短写如「硕士」会与「硕士研究生」等同义词核对）',
  ambiguous_education_option:'网站下拉有多个同名选项，未猜选',
  education_select_readback_mismatch:'下拉选择后读回不一致',
  menu_cleanup_failed:'下拉菜单未能安全关闭，请先手动关掉菜单再重试',
  control_busy:'页面已有打开的菜单或控件忙碌，本项未写',
  school_adapter_unavailable:'学校填写模块未加载',
  region_adapter_unavailable:'城市填写模块未加载',
  select_adapter_unavailable:'下拉填写模块未加载',
  menu_not_stable:'选项列表未稳定，未猜选',
  menu_link_missing_or_ambiguous:'无法唯一关联下拉菜单',
  city_not_ready:'城市下拉尚未就绪',
  province_disabled:'省份下拉不可用',
  search_not_open:'学校搜索框未打开',
  trusted_search_unavailable:'无法可靠输入学校搜索词',
  explicit_option_required:'缺少已确认的网站选项原文',
  control_guard:'控件结构不符合已验证范围',
  wrong_site:'当前不是招商银行招聘简历页'});
export async function mountCmsEducationActions(){const tabs=await chrome.tabs.query({active:true,lastFocusedWindow:true}),tab=tabs.length===1?tabs[0]:null;if(!tab||base(tab.url)!==PAGE)return;
  const host=document.querySelector('.site-card');if(!host||document.getElementById('cms-education-multi'))return;
  const section=document.createElement('section');section.id='cms-education-multi';section.className='cms-photo-choices';section.innerHTML=`<h2>完整教育经历</h2><p>按资料库中的每段教育分别填写（上方「填写并读回」不会填写教育专业等字段）。新增记录由软件操作；缺少学位、完整日期或省市时，会列出需要补充的答案。填写前请保持招商简历标签在前台。</p><button id="cms-education-read" type="button" class="button secondary">读取教育记录</button><button id="cms-education-unlock" type="button" class="text-button">我已看过网站，解除锁定</button><button id="cms-education-profile" type="button" class="text-button">补充本段资料 ↗</button><div id="cms-education-bindings"></div><button id="cms-education-run" type="button" class="button primary" disabled>填写全部选定教育并核对</button><p id="cms-education-progress" role="status">正在读取上次操作结果…</p><div id="cms-education-outcomes"></div><small>此按钮不点击网站保存或最终投递。填写结果会核对网站实际接收的数据；关闭弹窗后后台继续。</small>`;host.append(section);
  const ui={read:section.querySelector('#cms-education-read'),unlock:section.querySelector('#cms-education-unlock'),run:section.querySelector('#cms-education-run'),bindings:section.querySelector('#cms-education-bindings'),progress:section.querySelector('#cms-education-progress'),outcomes:section.querySelector('#cms-education-outcomes')};let inspected=null;
  const request=message=>chrome.runtime.sendMessage({...message,tabId:tab.id});
  const explain=(reason,field)=>{
    let base=reasons[reason]||'此项尚未核对，请查看网站当前内容';
    if(reason==='option_not_found'){
      const n=typeof field?.visibleOptionCount==='number'?`约 ${field.visibleOptionCount} 条搜索结果`:'多条搜索结果';
      const candidates=Array.isArray(field?.candidateOptions)?field.candidateOptions.filter(Boolean).slice(0,8):[];
      const samples=candidates.length?candidates:(Array.isArray(field?.sampleOptions)?field.sampleOptions.filter(Boolean).slice(0,5):[]);
      const emptyRow=field?.rowWasEmpty===true||field?.hint==='empty_row_create_template_not_used'||field?.hint==='sole_create_refused_by_policy';
      if(field?.hint==='sole_create_refused_by_policy'){
        base+=`；${emptyRow?'这是空行/新增：':''}网站出现唯一「创建校名」模板，但窄版政策禁止软件点创建（仍 no sole-create）。`;
      }else if(field?.hint==='empty_row_create_template_not_used'){
        base+=`；空行/新增：目录无与资料一致的学校（如悉尼双语长名），虽见「创建」模板但软件故意不点创建（${n}）。`;
      }else if(field?.hint==='create_template_seen_but_not_sole_enabled_match'){
        base+=`；检测到网站「创建」模板但非唯一可点匹配（${n}），软件不会擅自创建校名。`;
      }else if(field?.hint==='no_catalog_or_create_match'){
        base+=`；目录与创建模板均无唯一匹配（${n}）。`;
      }else if(emptyRow){
        base+=`；空行/新增上的学校未选中（${n}）。`;
      }
      if(emptyRow){
        base+=' 建议：①已有行若页显短名已匹配会自动 preexisting 核对；②空行请到资料库「网站选项对应」填网站短名原文，或先在网站手选学校后再填；软件不会猜校名、不会 sole-create。';
        if(samples.length) base+=` 目录候选（未选用）：${samples.slice(0,5).join('、')}。`;
      }else if(samples.length){
        base+=` 供人工对照的候选（未选用）：${samples.join('、')}。完整列表见本次填写结果中的 candidateOptions，可据此在「网站选项对应」填写。`;
      }else{
        base+=' 本次未录到可对照候选；请在网站学校下拉中查看原文后，到「网站选项对应」手工映射。';
      }
    }
    return base;
  };
  function showJob(job){if(!job){ui.progress.textContent='先读取网站教育记录，再选择各段资料。';return;}
    const busy=['queued','running'].includes(job.state),unknown=['unknown','unknown_profile_invalidated'].includes(job.state);ui.read.disabled=busy;ui.run.disabled=busy||unknown||!inspected;if(ui.unlock)ui.unlock.disabled=busy;
    if(busy){ui.progress.textContent='后台正在逐段填写和核对。可以关闭弹窗，稍后重新打开查看结果。';const fill=document.getElementById('fill');if(fill)fill.disabled=true;}
    else if(job.state==='completed')ui.progress.textContent=`${job.serializedRecordCount||job.records?.length||0} 段教育已逐项核对；网站保存还未验收。`;
    else if(job.state==='partial'){const unfocused=(job.fields||[]).some(field=>field.reason==='page_unfocused');ui.progress.textContent=unfocused?'网页未获得焦点，专业等文字未写入。请点回招商简历标签后再点填写。':'已完成能准确填写的项目；请补齐下面缺少的资料，再继续。';}
    else if(unknown)ui.progress.textContent='本次网站写入尚未完全核对。为避免重复新增，请先查看网站记录和下面结果。';
    else if(job.reason==='page_unfocused')ui.progress.textContent='浏览器窗口未在前台，教育填写未开始。请点回招商简历网页后再填。';
    else if(job.state==='stopped_before_write')ui.progress.textContent=`本次填写在写入前已停止（${explain(job.reason)}）。请重新读取后再继续。`;
    else ui.progress.textContent='本次操作已停止；请重新读取网站和资料后再继续。';
    ui.outcomes.innerHTML=(job.fields||[]).map(field=>`<div class="field"><span class="field-main"><strong class="field-name">资料第 ${field.profileIndex+1} 段 · ${escape(field.question)}</strong><small class="field-detail">${escape(explain(field.reason,field))}</small></span><span class="field-status ${field.status==='verified'?'verified':''}">${field.status==='verified'?'已核对':field.status==='failed'?'未核对':'待处理'}</span></div>`).join('');}
  async function refreshJob(){const response=await request({type:'CMS_EDUCATION_MULTI_JOB_STATUS'});if(response?.ok)showJob(response.data);}
  ui.read.addEventListener('click',async()=>{ui.read.disabled=true;ui.run.disabled=true;ui.progress.textContent='正在读取网站教育记录…';try{const result=await request({type:'CMS_EDUCATION_MULTI_INSPECT_JOB'});if(!result?.ok)throw Error(result?.reason||'inspect_failed');inspected=result;
      if(!result.sources.length){ui.bindings.textContent='资料库还没有教育经历，请先在“我的资料库”添加。';ui.progress.textContent='没有可使用的教育资料。';return;}
      const sourceOptions=result.sources.map(row=>`<option value="${row.profileIndex}">第 ${row.profileIndex+1} 段 · ${escape(row.label||'教育资料')}</option>`).join('');
      const cards=result.rows.map((row,index)=>`<div class="cms-education-binding" data-row-identity="${escape(row.identity)}"><label class="file-choice">网站第 ${index+1} 段使用哪段资料<select data-cms-existing-source><option value="">请选择资料</option>${sourceOptions}</select></label><label class="remember-choice"><input data-cms-replace type="checkbox">重新填写这条已有记录</label></div>`).join('');
      const additions=result.sources.map(row=>`<label class="remember-choice"><input type="checkbox" data-cms-new-source="${row.profileIndex}">新增：第 ${row.profileIndex+1} 段 · ${escape(row.label||'教育资料')}</label>`).join('');
      ui.bindings.innerHTML=`${cards}<p>其余需要新增的教育：</p>${additions}<small>每段资料只能选择一次。网站已有记录必须明确对应资料；不会按位置猜来源。</small>`;
      // Only an empty single site row and a single source are unambiguous.
      if(result.rows.length===1&&result.sources.length===1&&result.rows[0].fields.every(field=>!field.value||Array.isArray(field.value)&&field.value.every(value=>!value)))ui.bindings.querySelector('[data-cms-existing-source]').value=String(result.sources[0].profileIndex);
      ui.run.disabled=false;ui.progress.textContent='请选择已有记录的资料来源，以及需要新增的教育。';
    }catch(error){inspected=null;const code=String(error?.message||'');ui.progress.textContent=reasons[code]||(`读取失败：${code||'未知原因'}。可点「我已看过网站，解除锁定」后再读取。`);}finally{ui.read.disabled=false;}});
  ui.run.addEventListener('click',async()=>{if(!inspected)return;const records=[],used=new Set();try{
      for(const card of ui.bindings.querySelectorAll('[data-row-identity]')){const value=card.querySelector('[data-cms-existing-source]').value;if(value==='')throw Error('source_required');const profileIndex=Number(value),source=inspected.sources.find(row=>row.profileIndex===profileIndex);if(!source||used.has(profileIndex))throw Error('duplicate_source');used.add(profileIndex);records.push({...source,target:{mode:'existing',identity:card.dataset.rowIdentity},replaceExisting:card.querySelector('[data-cms-replace]').checked});}
      for(const input of ui.bindings.querySelectorAll('[data-cms-new-source]:checked')){const profileIndex=Number(input.dataset.cmsNewSource),source=inspected.sources.find(row=>row.profileIndex===profileIndex);if(!source||used.has(profileIndex))throw Error('duplicate_source');used.add(profileIndex);records.push({...source,target:{mode:'new'},replaceExisting:false});}
      if(!records.length)throw Error('source_required');const ok=confirm(`将填写 ${records.length} 段教育经历。资料缺失时会留空并说明；不会点击网站保存或最终投递。`);if(!ok)return;
      ui.run.disabled=true;ui.read.disabled=true;const response=await request({type:'CMS_EDUCATION_MULTI_START',pageUrl:PAGE,profileBinding:inspected.profileBinding,document:inspected.document,records:records.map(({profileIndex,sourceSnapshotHash,supplementRefHash,target,replaceExisting})=>({profileIndex,sourceSnapshotHash,supplementRefHash,target,replaceExisting}))});
      if(!response?.accepted){ui.progress.textContent='未开始填写：网站、资料或授权状态已变化，请重新读取。';ui.read.disabled=false;}else{inspected=null;ui.progress.textContent='后台已开始逐段填写，请稍后查看结果。';await refreshJob();window.close();}
    }catch(error){ui.progress.textContent=error.message==='duplicate_source'?'同一段资料不能同时用于两条记录，请检查选择。':'请为每条已有记录选择资料来源。';ui.run.disabled=false;ui.read.disabled=false;}});
  ui.unlock.addEventListener('click',async()=>{const jobKey=`resumeCmsEducationJob:${tab.id}`,pendingKey=`resumePendingFillReview:${tab.id}`;
    const stored=await chrome.storage.local.get([jobKey,pendingKey,'resumePendingFillReview']);
    const job=stored[jobKey];
    if(job&&['queued','running'].includes(job.state)){ui.progress.textContent='后台仍在填写，请稍后再解除锁定。';return;}
    if(!confirm('请确认你已查看过网站上的教育经历。确定后将清除卡住的待核对锁定，以便重新读取。'))return;
    const remove=[pendingKey];
    if(stored.resumePendingFillReview?.tabId===tab.id)remove.push('resumePendingFillReview');
    if(job&&['unknown','unknown_profile_invalidated','partial','stopped_before_write','completed'].includes(job.state))remove.push(jobKey);
    await chrome.storage.local.remove(remove);
    inspected=null;ui.run.disabled=true;ui.bindings.replaceChildren();
    ui.progress.textContent='锁定已清除。请再点「读取教育记录」。';
    await refreshJob();
  });
  section.querySelector('#cms-education-profile').addEventListener('click',async()=>{await chrome.storage.local.set({resumeRequestedSection:'education'});await chrome.runtime.openOptionsPage();});
  chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local')return;if(changes.resumeProfile||changes.resumeProfileLifecycle){inspected=null;ui.run.disabled=true;ui.bindings.textContent='资料已变化，请重新读取当前客户与网站记录。';refreshJob().catch(()=>{});return;}if(changes[`resumeCmsEducationJob:${tab.id}`])refreshJob().catch(()=>{});});await refreshJob();
}
mountCmsEducationActions().catch(()=>{});
