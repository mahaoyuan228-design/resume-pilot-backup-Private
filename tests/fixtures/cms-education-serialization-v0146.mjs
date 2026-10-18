// Execute this read-only function in MAIN through the owned extension broker.
// Only public component props are read. No internal handler or formatter is
// invoked; applicant values returned here must stay in private proof/storage.
export function readCmsEducationSerialization(){
  const PAGE='https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';
  if(location.origin+location.pathname!==PAGE)return {ok:false,reason:'wrong_site'};
  const clean=v=>String(v||'').normalize('NFKC').replace(/[＊*：:!?！？\s]/gu,'');
  const visible=n=>!!n?.getClientRects().length&&getComputedStyle(n).display!=='none'&&getComputedStyle(n).visibility!=='hidden';
  const sections=[...document.querySelectorAll('form .form-cell')].filter(n=>visible(n)&&n.id==='14'&&clean(n.querySelector(':scope > .tit-wrap .tit')?.textContent)==='教育经历必填');
  if(sections.length!==1)return {ok:false,reason:'education_section_not_unique'};const section=sections[0],propsSet=new Set();
  for(const node of [section,...section.querySelectorAll(':scope > .form-cell-right > .form-cell-inner')]){const expando=Object.keys(node).find(k=>/^__(?:reactInternalInstance|reactFiber)\$/u.test(k));let fiber=expando?node[expando]:null;
    for(let i=0;fiber&&i<30;i++,fiber=fiber.return){const props=fiber.memoizedProps;if(props&&String(props.id)==='14'&&Array.isArray(props.infoData)&&props.formData&&typeof props.formData==='object')propsSet.add(props);}}
  if(propsSet.size!==1)return {ok:false,reason:'education_public_props_not_unique'};const props=[...propsSet][0],rows=[...section.querySelectorAll(':scope > .form-cell-right > .form-cell-inner')];
  if(rows.length!==props.infoData.length)return {ok:false,reason:'education_dom_template_row_mismatch'};
  const treePaths=(nodes,wanted,path=[])=>{const found=[];for(const node of Array.isArray(nodes)?nodes:[]){const next=[...path,String(node.name||node.nameCh||node.nameEn||'')];if(String(node.code)===wanted)found.push(next);found.push(...treePaths(node.sonDicInfos||node.children,wanted,next));}return found;};
  const view=[];const dto=[];
  for(let index=0;index<rows.length;index++){
    const template=props.infoData[index];if(!Array.isArray(template))return {ok:false,reason:'education_template_record_invalid'};
    const wrappers=[...rows[index].querySelectorAll(':scope > div[id]')].filter(n=>/^14_\d+_\d+$/u.test(n.id));
    const ids=wrappers.map(n=>n.id).sort();if(!ids.length||new Set(ids).size!==ids.length)return {ok:false,reason:'education_wrapper_identity_invalid'};
    const identity=JSON.stringify(ids),fields=[],record={};
    for(const item of template){if(!item||typeof item!=='object'||!item.itemId||item.oldItemId===undefined)return {ok:false,reason:'education_item_metadata_invalid'};
      const wrapperId=`14_${item.oldItemId}_${index}`;if(wrappers.filter(n=>n.id===wrapperId).length!==1)return {ok:false,reason:'education_item_wrapper_not_unique'};
      let fieldName=props.isMutiRecord?item.itemId:item.itemId+'_'+(index+1);if(fieldName.split('_').length>3)fieldName=item.itemId;
      const raw=props.formData[fieldName];let serialized=raw;
      if(['school','subject'].includes(item.customDataSource))serialized=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw.code||raw.name:raw;
      else if(raw&&typeof raw==='object'&&!Array.isArray(raw))serialized=raw.code||raw.fileId;
      if(serialized)record['item_'+item.oldItemId]=serialized;
      const map=props.dataSourceRelevantMap?.[fieldName]||item.dataSourceMap||{};let display=raw;
      if(raw&&typeof raw==='object'&&!Array.isArray(raw))display=raw.name||map[raw.code]||raw.code||'';
      else if(item.fillType===4)display=map[raw]||'';
      else if(item.fillType===9||item.fillType===15){const paths=treePaths(props.dataSourceRelevant?.[fieldName]||props.dataSource?.[item.dataSource],String(raw?.code||raw||''));display=paths.length===1?paths[0].slice(-2):null;}
      fields.push({question:clean(item.name),oldItemId:String(item.oldItemId),fieldName,wrapperId,fillType:item.fillType,required:item.isNeed===0,customDataSource:item.customDataSource||'',raw:raw??null,serialized:serialized??null,display:display??null});
    }
    view.push({identity,fields});dto.push(record);
  }
  if(new Set(view.map(row=>row.identity)).size!==view.length)return {ok:false,reason:'education_record_identity_duplicate'};
  return {ok:true,page:PAGE,timeOrigin:performance.timeOrigin,rows:view,serialized:{set_14:dto}};
}

const clean=value=>String(value||'').normalize('NFKC').replace(/\s+/gu,'').trim();
export function verifyEducationSerialization(plan,bindings,proof){
  if(!proof?.ok||proof.page!==plan?.page||!Array.isArray(proof.rows)||proof.rows.length!==proof.serialized?.set_14?.length)return {ok:false,reason:'education_serialization_unavailable',complete:false};
  if(bindings.length!==plan.records.length||proof.rows.length!==bindings.length||new Set(bindings.map(row=>row.identity)).size!==bindings.length||proof.rows.some(row=>bindings.filter(binding=>binding.identity===row.identity).length!==1))return {ok:false,reason:'education_unbound_serialized_record',complete:false};
  const definitions={school:'学校',degree:'学历',academicDegree:'学位',major:'专业名称',startDate:'开始时间',endDate:'结束时间',region:'城市',gradeRank:'专业排名',description:'专业描述'},records=[];
  for(const record of plan.records){const bound=bindings.filter(row=>row.profileIndex===record.profileIndex),targets=bound.length===1?proof.rows.filter(row=>row.identity===bound[0].identity):[];
    if(targets.length!==1)return {ok:false,reason:'education_serialized_binding_missing',complete:false};const row=targets[0],fields=[];
    for(const [key,question] of Object.entries(definitions)){const fact=record.facts[key],found=row.fields.filter(field=>field.question===question),field=found[0];
      if(found.length!==1){fields.push({key,question,path:fact?.path,status:'skipped',reason:found.length?'ambiguous_question':'question_not_present',required:key!=='description'});continue;}
      if(fact?.status!=='ready'){fields.push({key,question,path:fact?.path,status:'skipped',reason:fact?.reason||'missing_profile_value',required:field.required});continue;}
      const desired=key==='region'?[fact.value.province,fact.value.city]:fact.optionText;
      const matched=Array.isArray(desired)?Array.isArray(field.display)&&field.display.length===2&&desired.every((value,index)=>clean(value)===clean(field.display[index])):clean(field.display)===clean(desired);
      const inDto=proof.serialized.set_14[proof.rows.indexOf(row)]?.['item_'+field.oldItemId];
      const serializedMatched=JSON.stringify(inDto)===JSON.stringify(field.serialized)&&inDto!==undefined&&inDto!==null&&inDto!=='';
      fields.push({key,question,path:fact.path,status:matched&&serializedMatched?'verified':'failed',reason:matched&&serializedMatched?'react_props_and_serialization_matched':'react_serialization_mismatch',required:field.required});
    }
    records.push({profileIndex:record.profileIndex,identity:row.identity,fields,complete:fields.every(field=>!field.required||field.status==='verified')});
  }
  return {ok:true,complete:records.every(row=>row.complete),records,serializedRecordCount:proof.rows.length};
}
