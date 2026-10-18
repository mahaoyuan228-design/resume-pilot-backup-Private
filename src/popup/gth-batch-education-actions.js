// Candidate ordinary popup: two explicitly bound education records only.
// Source preparation is read-only; the worker owns filling, Save and refresh.
import {captureProfileBinding,assertProfileBinding} from '../profile/profile-lifecycle.js';
import {loadProfile} from '../profile/store.js';
import {educationCandidate,EDUCATION_FIELDS} from '../background/education-task-runner.mjs';
import {readGthDraftMetadata} from '../background/gth-draft-metadata.mjs';
import {readRefreshDocument} from '../background/gth-education-refresh-coordinator.mjs';
const PAGE='https://hr.gtht.com/resume/edit/',ORIGIN='https://hr.gtht.com';
const JOB='resumeGthSerialJob:',PENDING='resumePendingFillReview:';
const REQUIRED=new Set(['school','major','schoolLocation','unifiedAdmissions','degree','startDate','endDate','majorCategory']);
const stop=code=>{throw Error(code);};
const text=(tag,value,className)=>{const node=document.createElement(tag);node.textContent=value;if(className)node.className=className;return node;};
const bounded=promise=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('batch_read_unavailable')),12000);Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});});
export function collectBatchEducationBindings(host,prepared){
  const bindings=[],used=new Set();
  for(const card of host.querySelectorAll('[data-batch-target]')){
    const selected=card.querySelector('[data-batch-source]').value;if(selected==='')continue;
    const profileIndex=Number(selected),source=prepared.sources.find(row=>row.profileIndex===profileIndex),target=prepared.records.find(row=>row.recordIdentity===card.dataset.batchTarget);
    if(!source||!target)stop('batch_source_required');if(used.has(profileIndex))stop('batch_duplicate_source');used.add(profileIndex);
    if(!card.querySelector('[data-batch-replace]').checked)stop('batch_replace_required');
    bindings.push({profileIndex,targetMode:'existing',recordIdentity:target.recordIdentity,replaceExisting:true});
  }
  for(const box of host.querySelectorAll('[data-batch-new]:checked')){
    const profileIndex=Number(box.dataset.batchNew),source=prepared.sources.find(row=>row.profileIndex===profileIndex);
    if(!source)stop('batch_source_required');if(used.has(profileIndex))stop('batch_duplicate_source');used.add(profileIndex);
    bindings.push({profileIndex,targetMode:'new',recordIdentity:null,replaceExisting:false});
  }
  if(bindings.length!==2)stop('batch_exactly_two_required');return bindings;
}
const explain=reason=>({locked_degree_conflict:'网站锁定的学历与所选资料不同。本次没有填写个人事实，后续教育已停止。',profile_binding_changed:'客户资料已变化，已停止旧任务。',profile_binding_required:'资料归属无法核对，已停止。',serial_existing_pending:'页面已有待核对操作，请先查看网站。',serial_active_tab_changed:'招聘页面已切换，已停止后续段落。',serial_parent_lease_changed:'页面操作状态变化，已停止后续段落。',serial_education_fill_incomplete:'本段有未完成项目，已停止后续段落。',serial_source_status_unknown:'本段填写证据尚未完整核对，已停止后续段落。',draft_refresh_basic_values_changed:'刷新后其他分区内容发生变化，已停止后续段落。',draft_refresh_original_outside_mismatch:'刷新后附件或其他分区与保存前快照不一致，已停止后续段落。请先人工核对附件名称与其他分区，不要重复保存。',draft_refresh_outside_change_not_eligible:'保存后其他分区变化超出附件文本容差，无法安全刷新核对。',profile_replaced:'客户资料已替换，旧任务没有继续执行。',profile_deleted:'客户资料已删除，旧任务没有继续执行。'}[reason]||'当前步骤未完全核对，已停止后续段落。');
function visibleRecordLabels({records,timeOrigin}){
  try{
    if(location.href!=='https://hr.gtht.com/resume/edit/'||performance.timeOrigin!==timeOrigin||document.visibilityState!=='visible')return null;
    const section=document.querySelectorAll('.r-section')[1],root=section?.parentElement,owners=[];
    let vue=root?.tagName==='DIV'&&root.classList.contains('r-block')?root.__vue__:null;
    for(let i=0;vue&&i<8;i++,vue=vue.$parent){const item=vue.curItem||vue.$props?.curItem;if(item?.name==='教育经历'&&Array.isArray(item.data)&&vue.mode==='read')owners.push(item);}
    if(owners.length!==1)return null;const item=owners[0];
    const actual=item.data.map((row,index)=>[index,JSON.stringify([String(item.id),String(row.id)]),new URL(row.editUrl,location.href).href]);
    if(JSON.stringify(actual)!==JSON.stringify(records.map(row=>[row.index,row.recordIdentity,row.formDataURL])))return null;
    const rows=[...section.querySelectorAll('.sec-context > .sec-detail')];if(rows.length!==records.length)return null;
    return rows.map(row=>{const copy=row.cloneNode(true);copy.querySelectorAll('a,button,input,select,textarea').forEach(node=>node.remove());return String(copy.textContent||'').replace(/\s+/gu,' ').trim().slice(0,180);});
  }catch{return null;}
}
export async function mountGthBatchEducation(){
  const tabs=await chrome.tabs.query({active:true,lastFocusedWindow:true}),tab=tabs.length===1?tabs[0]:null;
  if(tab?.url!==PAGE||document.getElementById('gth-batch-education'))return;
  const site=document.querySelector('.site-card');if(!site)return;
  const panel=document.createElement('section');panel.id='gth-batch-education';panel.className='gth-batch-education';
  panel.innerHTML='<h2>批量教育</h2><p>当前版本每次连续处理 2 段教育。请明确选择网站记录对应的资料；不会按顺序猜测。</p><button id="gth-batch-read" type="button" class="button secondary">读取教育记录并准备</button><div id="gth-batch-bindings"></div><button id="gth-batch-run" type="button" class="button primary" disabled>连续填写并保存已选教育草稿，不投递</button><p id="gth-batch-progress" role="status">正在读取上次批量教育结果…</p><ol id="gth-batch-results"></ol><small>仅批量处理教育。基本信息、求职意向、工作经历和附件尚未接入此流程，技能与其他信息也不在本次连续任务中。任一段结果不明会停止后续段落；关闭弹窗后后台继续。</small>';
  const single=document.getElementById('gth-education-trial');single?single.after(panel):site.append(panel);
  const ui={read:panel.querySelector('#gth-batch-read'),run:panel.querySelector('#gth-batch-run'),bindings:panel.querySelector('#gth-batch-bindings'),progress:panel.querySelector('#gth-batch-progress'),results:panel.querySelector('#gth-batch-results')};
  let prepared=null,reading=false,starting=false,blocked=false,serialOwnOperationActive=false,statusRevision=0;
  const request=message=>bounded(chrome.runtime.sendMessage({...message,tabId:tab.id}));
  const ownSerialPending=pending=>pending?.kind==='gth_serial_education_vertical'&&pending.tabId===tab.id&&pending.origin===ORIGIN;
  const validSelection=()=>{try{return !!prepared&&collectBatchEducationBindings(ui.bindings,prepared).length===2;}catch{return false;}};
  const setControls=()=>{ui.read.disabled=reading||starting||blocked;ui.run.disabled=reading||starting||blocked||!validSelection();};
  // Prevent another ordinary action from racing this parent in the same popup.
  // Profile editing remains available: import/delete is allowed to invalidate it.
  document.addEventListener('click',event=>{const button=event.target?.closest('button');if(serialOwnOperationActive&&button&&!panel.contains(button)&&button.id!=='open-profile'){event.preventDefault();event.stopImmediatePropagation();ui.progress.textContent='批量教育仍在运行或待核对，请先查看下面逐段结果。';}},true);
  function showJob(job,active,pending){
    const running=active===true&&['queued','running'].includes(job?.state),interrupted=active!==true&&['queued','running'].includes(job?.state),unknown=interrupted||['unknown','unknown_profile_invalidated'].includes(job?.state)||pending?.pendingReviewRequired===true;
    // Any pending operation blocks this batch panel. Only our own parent
    // controls outside buttons; a single-record continuation retains its own
    // existing source/phase/lease guards and must remain clickable.
    serialOwnOperationActive=job?.kind==='gth_serial_education_vertical'
      &&(running||interrupted||['unknown','unknown_profile_invalidated','blocked'].includes(job.state))
      ||ownSerialPending(pending)&&pending.pendingReviewRequired===true;
    blocked=running||unknown||job?.state==='blocked'||!!pending;setControls();ui.results.replaceChildren();
    if(!job){ui.progress.textContent=pending?'本页已有待核对操作。请先检查网站内容，软件不会重新新增或保存。':'先读取教育记录，再选择要处理的 2 段。';return;}
    if(running)ui.progress.textContent='后台正在连续填写、保存并刷新核对教育草稿。可以关闭弹窗，稍后重新打开查看。';
    else if(job.state==='completed'&&job.educationSequenceComplete===true)ui.progress.textContent='所选 2 段教育已完成可用资料填写、保存和刷新核对；没有投递岗位。';
    else if(job.state==='needs_data')ui.progress.textContent='选定教育还缺少必需的已核对资料。请先补充下面项目；本次没有编辑、新增或保存网站记录。';
    else if(unknown||job.state==='blocked')ui.progress.textContent=(interrupted?'后台是否仍在执行无法确认，已保留待核对状态。':explain(job.reason))+' 请先查看网站当前记录，不要重复新增或保存。';
    else ui.progress.textContent='本次批量教育在写入前停止。请重新读取资料和网站记录后再决定。';
    for(const [index,step]of (job.steps||[]).entries()){
      const item=document.createElement('li'),verified=step.state==='completed'&&step.refreshVerified===true&&step.saveClickCount===1&&step.serverReadbackFields===12;
      const currentUnknown=unknown&&(step.state==='running'||index===job.activeStep);
      item.append(text('strong',`第 ${index+1} 步 · 资料第 ${Number.isInteger(step.profileIndex)?step.profileIndex+1:'—'} 段 · ${step.targetMode==='new'?'新增记录':'已有记录'}`));
      const fields=Array.isArray(step.fields)?step.fields:[],written=fields.filter(field=>field.status==='verified'&&['readback_matched','readback_reapplied'].includes(field.reason)).length,missing=fields.filter(field=>field.status==='skipped'&&['missing_profile_value','profile_fact_unconfirmed'].includes(field.reason)).length,readOnly=fields.filter(field=>field.status==='skipped'&&field.reason==='site_control_disabled').length;
      item.append(text('span',verified?`已保存且刷新一致；软件本次填写或重填 ${written} 项，缺资料跳过 ${missing} 项，网站只读 ${readOnly} 项；12 个网站值快照已核对`:currentUnknown?'本段结果待核对；后续段落已停止':step.state==='queued'?'尚未开始':step.state==='running'?'正在执行':step.state==='blocked'?'网站学历锁定冲突，本段没有填写个人事实':'本段未完全核对'));
      item.append(text('span',step.saveClickCount===0?'软件保存次数：0':step.saveClickCount===1?'软件保存次数：1':'软件保存次数：未知'));
      if(fields.length){const details=document.createElement('ul');for(const field of fields){const detail=text('li',`${field.question}：${({readback_matched:'本次填写并读回一致',readback_reapplied:'本次重新填写并读回一致',preexisting_same_value:'网站原有同值，未计为本次填写',site_control_disabled:'网站锁定此项，已核对同值并保留；未计为本次填写',missing_profile_value:'缺少资料，已跳过',profile_fact_unconfirmed:'资料未确认，已跳过',existing_value:'已有不同内容，已保留'}[field.reason]||'尚未核对，请查看网站当前内容')}`);details.append(detail);}item.append(details);}
      ui.results.append(item);
    }
    if(job.state==='needs_data')for(const missing of (job.missing||[])){
      const item=document.createElement('li');item.append(text('strong',`资料第 ${missing.profileIndex+1} 段 · ${missing.question}`),text('span',missing.reason==='profile_fact_unconfirmed'?'资料尚未确认，请在资料库核对':'资料尚未填写，请在资料库补充'));ui.results.append(item);
    }
  }
  async function refreshStatus(){
    const revision=++statusRevision;
    const [response,stored]=await Promise.all([request({type:'GTH_SERIAL_V012_STATUS'}),chrome.storage.local.get([PENDING+tab.id,'resumePendingFillReview'])]);
    if(revision!==statusRevision)return;
    const pending=stored[PENDING+tab.id]||(stored.resumePendingFillReview?.tabId===tab.id?stored.resumePendingFillReview:null);
    if(response?.ok!==true){serialOwnOperationActive=ownSerialPending(pending);blocked=!!pending;setControls();ui.results.replaceChildren();ui.progress.textContent=pending?'资料或任务归属已变化，旧操作仍需核对。软件不会继续旧任务或重复保存。':'暂时无法读取批量教育状态，请重新打开扩展查看。';return;}
    if(response.data?.profileBinding)await assertProfileBinding(chrome.storage.local,response.data.profileBinding);
    showJob(response.data,response.active,pending);
  }
  const script=async(func,args,world='ISOLATED')=>{
    const results=await bounded(chrome.scripting.executeScript({target:{tabId:tab.id,frameIds:[0]},world,func,...(args===undefined?{}:{args:[args]})}));
    if(results.length!==1||results[0].frameId!==0)stop('batch_read_unavailable');return results[0].result;
  };
  ui.read.addEventListener('click',async()=>{
    if(reading||starting||blocked)return;reading=true;prepared=null;setControls();ui.bindings.replaceChildren();ui.progress.textContent='正在只读核对当前客户和网站教育记录…';
    try{
      const profileBinding=await captureProfileBinding(chrome.storage.local),profile=await loadProfile(),current=await chrome.tabs.get(tab.id);
      if(current?.url!==PAGE)stop('batch_read_unavailable');
      const sourceDocument=await script(readRefreshDocument);if(sourceDocument?.pageURL!==PAGE||!sourceDocument.ready||!sourceDocument.visible)stop('batch_read_unavailable');
      const metadata=await script(readGthDraftMetadata,{requestId:crypto.randomUUID(),recordMarker:'new',phase:'closed',nonce:crypto.randomUUID(),documentTimeOrigin:sourceDocument.timeOrigin},'MAIN');
      if(metadata?.ok!==true||metadata.data.formCount!==0)stop('batch_closed_required');
      const records=metadata.data.records;if(!Array.isArray(records)||records.length>30)stop('batch_read_unavailable');
      const labels=await script(visibleRecordLabels,{records,timeOrigin:sourceDocument.timeOrigin},'MAIN');if(!labels)stop('batch_read_unavailable');
      const sources=profile.education.map((row,profileIndex)=>{const candidate=educationCandidate(profile,profileIndex),missing=EDUCATION_FIELDS.filter(([,key])=>REQUIRED.has(key)&&(!candidate[key]||['startDate','endDate'].includes(key)&&!/^(?:19|20)\d{2}-(?:0[1-9]|1[0-2])$/u.test(candidate[key]))).map(([question])=>question);return {profileIndex,label:[row.school,row.degree,row.major].filter(Boolean).join(' · ')||'尚未填写教育资料',missing};});
      await assertProfileBinding(chrome.storage.local,profileBinding);prepared={profileBinding,records,sources};
      for(const record of records){
        const card=document.createElement('div');card.className='gth-batch-row';card.dataset.batchTarget=record.recordIdentity;
        card.append(text('strong',`网站第 ${record.index+1} 条（当前已有）`));if(labels[record.index])card.append(text('small',labels[record.index]));
        const label=text('label','使用哪段资料'),select=document.createElement('select');select.dataset.batchSource='';select.append(new Option('暂不处理这条记录',''));
        for(const source of sources){const option=new Option(`资料第 ${source.profileIndex+1} 段 · ${source.label}${source.missing.length?'（必需资料待补充）':''}`,String(source.profileIndex));select.append(option);}label.append(select);card.append(label);
        const replace=text('label','', 'remember-choice'),checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.dataset.batchReplace='';replace.append(checkbox,document.createTextNode('重新填写这条已有记录并保存草稿'));card.append(replace);ui.bindings.append(card);
      }
      ui.bindings.append(text('p','需要新增的教育（与上面已选资料不能重复）：'));
      for(const source of sources){const label=text('label','', 'remember-choice'),checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.dataset.batchNew=String(source.profileIndex);label.append(checkbox,document.createTextNode(`新增资料第 ${source.profileIndex+1} 段 · ${source.label}`));ui.bindings.append(label);if(source.missing.length)ui.bindings.append(text('small',`第 ${source.profileIndex+1} 段待补充并确认：${source.missing.join('、')}`));}
      ui.bindings.append(text('small','只选 2 段、每段资料使用一次。本批量版本处理已有记录时，须明确勾选该条的重新填写并保存；未勾选不会开始。必需资料不足会先列出清单且不操作网站；活动、排名、专业描述和绩点缺失时不会编造。'));
      ui.progress.textContent=sources.length?'请选择 2 段教育的对应关系，然后确认连续保存草稿。':'资料库没有教育经历，请先在“我的资料库”添加并核对。';
    }catch(error){prepared=null;ui.progress.textContent=error.message==='batch_closed_required'?'请先关闭网站当前编辑器，再重新读取；本次没有填写或保存。':'网站或客户资料已变化，准备未完成。请重新读取；本次没有填写或保存。';}
    finally{reading=false;setControls();}
  });
  ui.bindings.addEventListener('change',()=>{setControls();if(validSelection())ui.progress.textContent='已选择 2 段，点击按钮后可确认连续填写并保存草稿。';else if(prepared&&!blocked)ui.progress.textContent='请选满 2 段且不重复使用资料；已有记录须分别勾选重新填写并保存。';});
  ui.run.addEventListener('click',()=>{
    if(!prepared||reading||starting||blocked)return;
    let bindings;try{bindings=collectBatchEducationBindings(ui.bindings,prepared);}catch(error){ui.progress.textContent=error.message==='batch_duplicate_source'?'同一段资料不能用于两条记录，请检查选择。':error.message==='batch_exactly_two_required'?'当前版本每次只处理 2 段，请明确选择恰好 2 段。':error.message==='batch_replace_required'?'请明确勾选已有记录的重新填写并保存草稿。':'选定资料尚未齐全，请先补充并核对。';return;}
    if(document.getElementById('inspect')?.disabled){ui.progress.textContent='本页已有其他操作，请等待其完成并核对后再开始。';return;}
    if(!confirm(`将连续填写并保存已选的 2 段教育草稿，并逐条刷新核对。${bindings.some(row=>row.replaceExisting)?'勾选重填的已有记录会使用所选资料重新填写。':''}必需资料不足时会先列出待补项，不开始网站填写。任一段结果不明会停止后续段落。不会投递岗位。确认继续吗？`))return;
    starting=true;blocked=true;serialOwnOperationActive=true;setControls();ui.progress.textContent='已请求后台执行所选 2 段教育；关闭弹窗也会继续，不投递。';
    const snapshot=prepared;prepared=null;
    // Dispatch before the first await: the genuine action popup may close.
    let queued;try{queued=chrome.runtime.sendMessage({type:'GTH_SERIAL_V012_START',tabId:tab.id,pageUrl:PAGE,draftSaveAuthorized:true,profileBinding:snapshot.profileBinding,educationBindings:bindings});}catch{starting=false;blocked=false;serialOwnOperationActive=false;setControls();ui.progress.textContent='任务没有开始，请重新读取后再决定。';return;}
    Promise.resolve(queued).then(async response=>{starting=false;if(response?.accepted!==true){blocked=false;serialOwnOperationActive=false;setControls();ui.progress.textContent='批量教育未开始：资料、网站或待核对状态已变化，请重新读取。';await refreshStatus();return;}await refreshStatus();}).catch(()=>{starting=false;blocked=true;setControls();ui.progress.textContent='后台响应尚未确认。请重新打开扩展查看，暂不要重复保存。';});
  });
  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area!=='local')return;
    if(changes.resumeProfile||changes.resumeProfileLifecycle){prepared=null;ui.bindings.replaceChildren();setControls();ui.progress.textContent='客户资料已变化，请重新读取。已发出的操作仍须查看网站当前内容。';refreshStatus().catch(()=>{});return;}
    if(changes[JOB+tab.id]||changes[PENDING+tab.id]||changes.resumePendingFillReview)refreshStatus().catch(()=>{});
  });
  await refreshStatus();
}
mountGthBatchEducation().catch(()=>{});
