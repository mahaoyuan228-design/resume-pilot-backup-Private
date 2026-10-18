// MAIN-world, read-only public-props proof. No formatter/handler/state setter.
// The closed six-field employer template and actual wrapper IDs both must match.
export function readCmsInternshipSerialization(){
  const PAGE='https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';
  if(location.origin+location.pathname!==PAGE)return {ok:false,reason:'wrong_site'};
  const definitions=[[49170508,'开始时间',2],[49170510,'结束时间',2],[49170514,'企业名称',1],[49170517,'工作性质',4],[49170519,'职位名称',1],[49170523,'工作描述',6]];
  const clean=v=>String(v||'').normalize('NFKC').replace(/[＊*：:!?！？\s]/gu,'');
  const visible=n=>!!n?.getClientRects().length&&getComputedStyle(n).display!=='none'&&getComputedStyle(n).visibility!=='hidden';
  const sections=[...document.querySelectorAll('form .form-cell')].filter(n=>visible(n)&&n.id==='49170501'&&clean(n.querySelector(':scope > .tit-wrap .tit')?.textContent)==='实习经历');
  if(sections.length!==1)return {ok:false,reason:'internship_section_not_unique'};const section=sections[0],propsSet=new Set();
  for(const node of [section,...section.querySelectorAll(':scope > .form-cell-right > .form-cell-inner')]){const key=Object.keys(node).find(k=>/^__(?:reactInternalInstance|reactFiber)\$/u.test(k));let fiber=key?node[key]:null;
    for(let i=0;fiber&&i<30;i++,fiber=fiber.return){const props=fiber.memoizedProps;if(props&&String(props.id)==='49170501'&&Array.isArray(props.infoData)&&props.formData&&typeof props.formData==='object')propsSet.add(props);}}
  if(propsSet.size!==1)return {ok:false,reason:'internship_public_props_not_unique'};const props=[...propsSet][0],rows=[...section.querySelectorAll(':scope > .form-cell-right > .form-cell-inner')];
  if(rows.length!==props.infoData.length)return {ok:false,reason:'internship_dom_template_row_mismatch'};
  const view=[],dto=[];
  for(let index=0;index<rows.length;index++){
    const template=props.infoData[index];if(!Array.isArray(template)||template.length!==6)return {ok:false,reason:'internship_template_record_invalid'};
    const wrappers=[...rows[index].querySelectorAll(':scope > div[id]')],ids=wrappers.map(n=>n.id).sort();
    if(ids.length!==6||new Set(ids).size!==6||ids.some(id=>!/^49170501_\d+_\d+$/u.test(id)))return {ok:false,reason:'internship_wrapper_identity_invalid'};
    const identity=JSON.stringify(ids),fields=[],record={};
    for(const [oldId,question,fillType] of definitions){const matches=template.filter(item=>String(item?.oldItemId)===String(oldId)&&clean(item.name)===question&&item.fillType===fillType);
      if(matches.length!==1)return {ok:false,reason:'internship_item_metadata_invalid'};const item=matches[0],wrapperId=`49170501_${oldId}_${index}`;
      if(wrappers.filter(n=>n.id===wrapperId).length!==1||item.itemId!==`49170501_${oldId}`&&item.itemId!==`49170501_${oldId}_${index+1}`)return {ok:false,reason:'internship_item_wrapper_not_unique'};
      let fieldName=props.isMutiRecord?item.itemId:item.itemId+'_'+(index+1);if(fieldName.split('_').length>3)fieldName=item.itemId;
      const raw=props.formData[fieldName],serialized=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw.code||raw.fileId:raw;
      if(serialized)record['item_'+oldId]=serialized;
      const map=props.dataSourceRelevantMap?.[fieldName]||item.dataSourceMap||{},display=fillType===4?map[typeof raw==='object'?raw?.code:raw]||'':raw;
      fields.push({question,oldItemId:String(oldId),fieldName,wrapperId,raw:raw??null,serialized:serialized??null,display:display??null});
    }
    view.push({identity,fields});dto.push(record);
  }
  return {ok:true,page:PAGE,timeOrigin:performance.timeOrigin,rows:view,serialized:{set_49170501:dto}};
}
const clean=value=>String(value??'').normalize('NFKC').replace(/\s+/gu,'').trim();
export function verifyInternshipSerialization(plan,bindings,proof){
  if(!proof?.ok||proof.page!==plan?.page||plan.recordKind!=='internship'||proof.rows?.length!==proof.serialized?.set_49170501?.length||bindings.length!==plan.records.length||proof.rows.length!==bindings.length||new Set(bindings.map(row=>row.identity)).size!==bindings.length||proof.rows.some(row=>bindings.filter(binding=>binding.identity===row.identity).length!==1))return {ok:false,complete:false,reason:'internship_unbound_serialized_record'};
  const definitions={startDate:'开始时间',endDate:'结束时间',organization:'企业名称',type:'工作性质',position:'职位名称',description:'工作描述'},records=[];
  for(const record of plan.records){const bound=bindings.filter(row=>row.profileIndex===record.profileIndex),targets=bound.length===1?proof.rows.filter(row=>row.identity===bound[0].identity):[];
    if(targets.length!==1)return {ok:false,complete:false,reason:'internship_serialized_binding_missing'};const row=targets[0],fields=[];
    for(const [key,question]of Object.entries(definitions)){const fact=record.facts[key],found=row.fields.filter(field=>field.question===question),field=found[0],dto=proof.serialized.set_49170501[proof.rows.indexOf(row)];
      const matched=found.length===1&&fact?.status==='ready'&&clean(field.display)===clean(fact.optionText)&&dto?.['item_'+field.oldItemId]!==undefined&&JSON.stringify(dto['item_'+field.oldItemId])===JSON.stringify(field.serialized);
      fields.push({key,question,path:fact?.path,required:true,status:matched?'verified':fact?.status!=='ready'?'skipped':'failed',reason:matched?'react_props_and_serialization_matched':fact?.reason||'react_serialization_mismatch'});
    }
    records.push({profileIndex:record.profileIndex,identity:row.identity,fields,complete:fields.every(field=>field.status==='verified')});
  }
  return {ok:true,complete:records.every(row=>row.complete),records,serializedRecordCount:proof.rows.length};
}
