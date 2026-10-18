// Fictional employer document. Reuse the existing isolated Ant-shaped widget
// fixtures, but mount independent instances in real multi-record row wrappers.
// This is not the employer site or an implementation of its React component.
import {readFile} from 'node:fs/promises';
const script=html=>html.match(/<script>([\s\S]*?)<\/script>/u)[1].trim().replace(/\r\n/gu,'\n');
const replace=(source,before,after)=>{if(source.split(before).length!==2)throw Error('fixture_anchor_not_unique');return source.replace(before,after);};
export async function integrationFixture(catalog){
  let school=script(await readFile('tests/fixtures/cms-school-search-synthetic.html','utf8'));
  school=school.replace(/^\(\(\) => \{/u,'function installSchool(rowIndex) {');school=school.replace(/\}\)\(\);$/u,'}');
  school=replace(school,"const answer = '虚构学院甲';","const answer = window.fixtureCatalog.schools[rowIndex];");
  school=replace(school,"document.getElementById('school-host')","document.getElementById('school-host-'+rowIndex)");
  school=school.replaceAll("'school-options'","'school-options-'+rowIndex").replaceAll("'fictional-form'","'fixture-form'");
  school=replace(school,"let mode = 'unique';","let mode = 'create';");
  school=replace(school,"            close();\n            renderControl();","            commit(rowIndex,248,{name:value});\n            close();\n            renderControl();");
  school=replace(school,'window.syntheticSchool = {','window.fixtureWidgets.schools[rowIndex] = {');

  let date=script(await readFile('tests/fixtures/cms-ant-v3-date-synthetic.html','utf8'));
  date=date.replace(/^\(\(\) => \{/u,'function installDate(rowIndex) {');date=date.replace(/\}\)\(\);$/u,'}');
  date=date.replace(/const hosts = \{[\s\S]*?\n    \};/u,"const hosts = {start:document.getElementById('date-start-'+rowIndex),end:document.getElementById('date-end-'+rowIndex)};");
  date=date.replaceAll('state[current].value = date;','state[current].value = date; commit(rowIndex,current===\'start\'?49:50,date);');
  date=date.replaceAll("'fictional-resume-form'","'fixture-form'").replaceAll("'site-save'","'save'");
  date=replace(date,'window.syntheticCmsDate = {','window.fixtureWidgets.dates[rowIndex] = {');

  let region=script(await readFile('tests/fixtures/cms-cascader-synthetic.html','utf8'));
  region=region.replace(/^\(\(\) => \{/u,'function installRegion(rowIndex) {');region=region.replace(/\}\)\(\);$/u,'}');
  region=replace(region,"document.getElementById('cascader-host')","document.getElementById('region-host-'+rowIndex)");
  region=region.replaceAll("provinceOptions: ['虚构省甲', '虚构省乙'], cityOptions: ['虚构市甲', '虚构市乙']","provinceOptions:[window.fixtureCatalog.regions[rowIndex].province],cityOptions:[window.fixtureCatalog.regions[rowIndex].city]");
  region=replace(region,'function closeMenu() { menu?.remove(); menu = null; }',"function closeMenu(){menu?.remove();menu=null;host.querySelectorAll('.ant-select-open').forEach(n=>n.classList.remove('ant-select-open'));}");
  region=replace(region,'state.opens[level] += 1;','state.opens[level] += 1; selection.parentElement.classList.add(\'ant-select-open\');');
  region=replace(region,"selection.setAttribute('role', 'combobox');","selection.setAttribute('role','combobox');selection.tabIndex=0;");
  region=replace(region,"'menu-' + level + '-' + generation","'menu-'+rowIndex+'-' + level + '-' + generation");
  region=replace(region,'state[level] = text;',"state[level] = text;commit(rowIndex,51513929,level==='province'?'province-'+rowIndex:'city-'+rowIndex);");
  region=region.replaceAll("'fictional-resume-form'","'fixture-form'");
  region=replace(region,'window.syntheticCmsCascader = {','window.fixtureWidgets.regions[rowIndex] = {');

  return `<!doctype html><meta charset="utf-8"><title>Isolated fictional CMS education</title><style>
body{font:15px sans-serif;margin:20px}.form-cell{border:1px solid;padding:10px}.form-cell-inner{border-bottom:1px solid #aaa;padding:6px}.ant-form-item{display:flex;margin:8px;gap:15px}.ant-form-item-label{width:140px}.ant-select-selection{display:inline-block;min-width:130px;min-height:24px;border:1px solid}.ant-select{display:inline-block;margin-right:10px}.ant-select-dropdown{background:white;border:1px solid;position:relative;z-index:20}.ant-calendar-picker-container{position:fixed;top:30px;left:240px;background:white;border:1px solid;z-index:40;padding:8px}.ant-calendar-body{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}.ant-calendar-header{display:flex}.ant-calendar-year-panel .ant-calendar-body,.ant-calendar-month-panel .ant-calendar-body{grid-template-columns:repeat(4,1fr)}.add-more{padding:12px;cursor:pointer}</style>
<form id="fixture-form"><input id="unrelated" value="fictional outside preserved"><section id="14" class="form-cell"><div class="tit-wrap"><div class="tit">教育经历必填</div></div><div class="form-cell-right"></div></section><button id="save" type="button">保存</button><button type="submit">提交申请</button></form><script>
window.fixtureCatalog=${JSON.stringify(catalog)};window.fixtureWidgets={schools:[],dates:[],regions:[]};window.fixtureCounts={adds:0,saves:0,submits:0,textEvents:0,selects:0};
const definitions=[{oldItemId:49,name:'开始时间',fillType:2},{oldItemId:50,name:'结束时间',fillType:2},{oldItemId:248,name:'学校',fillType:1,customDataSource:'school'},{oldItemId:51513929,name:'城市',fillType:9,dataSource:'regions'},{oldItemId:52,name:'学位',fillType:4,dataSourceMap:{bachelor:'学士',master:'硕士'}},{oldItemId:51,name:'学历',fillType:4,dataSourceMap:{undergraduate:'本科',graduate:'硕士研究生'}},{oldItemId:53,name:'专业名称',fillType:1},{oldItemId:55,name:'专业描述',fillType:6,isNeed:1},{oldItemId:102301,name:'专业排名',fillType:4,dataSourceMap:{unranked:'无统计'}}];
window.fixtureProps={id:14,infoData:[],isMutiRecord:null,rowSize:10000,formData:{},dataSource:{regions:window.fixtureCatalog.regions.map((r,i)=>({code:'province-'+i,name:r.province,sonDicInfos:[{code:'city-'+i,name:r.city}]}))}};
const section=document.getElementById('14');section.__reactFiber$offline={memoizedProps:window.fixtureProps,return:null};
function commit(row,id,value){window.fixtureProps.formData['14_'+id+'_'+(row+1)]=value;}
${school}
${date}
${region}
function mountSelect(item,meta,index){const select=document.createElement('div');select.className='ant-select';const selection=document.createElement('div');selection.className='ant-select-selection ant-select-selection--single';selection.tabIndex=0;selection.setAttribute('role','combobox');selection.setAttribute('aria-controls','options-'+index+'-'+meta.oldItemId);const display=document.createElement('span');display.className='ant-select-selection-selected-value';selection.append(display);select.append(selection);item.append(select);selection.addEventListener('click',()=>{select.classList.add('ant-select-open');const menu=document.createElement('div');menu.className='ant-select-dropdown';const list=document.createElement('ul');list.className='ant-select-dropdown-menu';list.id=selection.getAttribute('aria-controls');list.setAttribute('role','listbox');for(const [code,text]of Object.entries(meta.dataSourceMap)){const li=document.createElement('li');li.className='ant-select-dropdown-menu-item';li.setAttribute('role','option');li.textContent=text;li.addEventListener('click',()=>{window.fixtureCounts.selects++;display.textContent=text;commit(index,meta.oldItemId,code);menu.remove();select.classList.remove('ant-select-open');});list.append(li);}menu.append(list);document.body.append(menu);});}
function addRow(){const index=window.fixtureProps.infoData.length,row=document.createElement('div');row.className='form-cell-inner';window.fixtureProps.infoData.push(definitions.map(meta=>({...meta,isNeed:meta.isNeed??0,itemId:'14_'+meta.oldItemId,uniqueId:'row-'+index+'-'+meta.oldItemId})));for(const meta of definitions){const wrap=document.createElement('div');wrap.id='14_'+meta.oldItemId+'_'+index;const item=document.createElement('div');item.className='ant-form-item';wrap.append(item);const label=document.createElement('div');label.className='ant-form-item-label';label.innerHTML='<label>'+meta.name+(meta.isNeed===1?'':'*')+'</label>';item.append(label);row.append(wrap);if(meta.customDataSource==='school'){const host=document.createElement('div');host.id='school-host-'+index;item.append(host);}else if(meta.fillType===2){const host=document.createElement('div');host.id='date-'+(meta.oldItemId===49?'start':'end')+'-'+index;item.append(host);}else if(meta.fillType===9){const host=document.createElement('div');host.className='cascader-plugins-wrap';host.id='region-host-'+index;item.append(host);}else if(meta.fillType===4)mountSelect(item,meta,index);else{const input=document.createElement(meta.fillType===6?'textarea':'input');input.addEventListener('input',()=>{window.fixtureCounts.textEvents++;commit(index,meta.oldItemId,input.value)});input.addEventListener('change',()=>commit(index,meta.oldItemId,input.value));item.append(input);}}const right=section.querySelector('.form-cell-right');right.insertBefore(row,right.querySelector('.add-more'));installSchool(index);installDate(index);installRegion(index);}
const add=document.createElement('div');add.className='add-more';add.textContent='添加新的教育经历';add.addEventListener('click',()=>{window.fixtureCounts.adds++;addRow()});section.querySelector('.form-cell-right').append(add);addRow();document.getElementById('save').addEventListener('click',()=>window.fixtureCounts.saves++);document.querySelector('form').addEventListener('submit',e=>{e.preventDefault();window.fixtureCounts.submits++});
window.fixtureSnapshot=()=>({counts:{...window.fixtureCounts},records:window.fixtureProps.infoData.length,formData:structuredClone(window.fixtureProps.formData),schools:window.fixtureWidgets.schools.map(x=>x.snapshot()),dates:window.fixtureWidgets.dates.map(x=>x.snapshot()),regions:window.fixtureWidgets.regions.map(x=>x.snapshot()),outside:document.getElementById('unrelated').value});
</script>`;
}
