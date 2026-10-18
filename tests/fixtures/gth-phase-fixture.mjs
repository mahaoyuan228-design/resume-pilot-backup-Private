import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import {createGthDraftMetadataBridge} from '../../src/background/gth-draft-metadata.mjs';
import {captureProfileBinding,assertProfileBinding} from '../../src/profile/profile-lifecycle.js';
import {createGthRefreshBasicMetadataBridge} from '../../src/background/gth-refresh-basic-metadata.mjs';
const SOURCE=await readFile('src/content/gth-draft-save.js','utf8');
const PAGE='https://hr.gtht.com/resume/edit/';
const TITLES=['基本信息','教育经历','求职意向','工作经验','职业技能与特长','附件简历','其他信息'];
export const REQUEST={requestId:'fictional-draft-request',recordMarker:'0'};

// Deliberately small offline DOM/Vue fixture. It models the source-proven
// component lifecycle and guards, not a real site's network or persistence.
export async function fixture(options={}){
  const store=new Map(),model={open:true,uid:10,saves:0,edits:0,cancels:0,mainReads:0,hidden:false,sourceOutcome:'verified',newEditor:options.newRecord===true};
  const data={school:'虚构测试学校',major:'虚构专业',campusActivities:'虚构活动',gradeRank:'无统计',majorDescription:'虚构专业描述',
    gpa:'3.20',schoolLocation:'虚构学校城市',unifiedAdmissions:'是',degree:'硕士研究生',startDate:'2020-09',endDate:'2022-06',majorCategory:'经济学'};
  data.school=`虚构客户${options.client||"A"}学校`;data.major=`虚构客户${options.client||"A"}专业`;const initial={...data};let form,context,basicForm=null,basicOpen=false;
  const el=(tag='DIV',extra={})=>({tagName:tag,type:'',value:'',textContent:'',disabled:false,readOnly:false,checked:false,selectedIndex:-1,
    files:[],dataset:{},validity:{valid:true},selectors:{},classList:{contains:()=>false},getClientRects:()=>[{}],
    getAttribute(name){return this.attributes?.[name]??null;},hasAttribute(name){return this.attributes?.[name]!==undefined;},
    closest(selector){return selector==='.el-form-item'?this.item||null:selector==='form'?this.form||null:null;},
    contains(node){return node===this||node?.form===this;},
    querySelectorAll(selector){return this.selectors[selector]||[];},querySelector(selector){return this.querySelectorAll(selector)[0]||null;},...extra});
  const oldCount=options.existingCount??2;
  const sectionOwner={curItem:{id:55,name:'教育经历',addUrl:'/api/resume/resumeeditinfo.json?customId=fictional&languageId=1&systemusertypeid=1&jid=fictional',
    data:Array.from({length:oldCount},(_,index)=>({id:index===0?'fictional-a':'fictional-'+index,editUrl:'/fixture/education?record='+index}))},
    mode:'edit',isEditFlag:!model.newEditor,expandFormId:model.newEditor?undefined:'fictional-a'};
  const originalIds=sectionOwner.curItem.data.map(row=>row.id);
  let selectedId=model.newEditor?null:'fictional-a';
  const neighbor=el('DIV',{textContent:'另一个虚构教育记录'});
  const oldNodes=Array.from({length:oldCount},(_,index)=>index===0?el('DIV',{textContent:'原有第一段虚构教育'}):index===1?neighbor:el('DIV',{textContent:'原有其他虚构教育'+index}));
  const target=el('DIV',{textContent:'目标虚构教育记录'});
  const edit=el('A',{attributes:{href:'javascript:;'},click(){model.edits++;model.open=true;model.uid++;
    model.newEditor=false;sectionOwner.mode='edit';sectionOwner.isEditFlag=true;sectionOwner.expandFormId=selectedId;build(options.failedSave?{...initial,school:'保存未成功的旧学校'}:data);}});
  edit.selectors['.el-icon-edit-outline']=[el()];target.selectors.a=[edit];if(!options.newRecord)oldNodes[0].selectors.a=[edit];
  const recordNodes=()=>sectionOwner.curItem.data.map(row=>{const oldIndex=originalIds.indexOf(row.id);return oldIndex>=0?oldNodes[oldIndex]:target;});
  const sections=TITLES.map((title,index)=>{const node=el('DIV',{textContent:title});
    const heading=el('DIV',{textContent:title,cloneNode(){return el('DIV',{textContent:title});}});
    node.querySelector=selector=>selector==='.title_'?heading:selector==='form'&&index===1&&model.open?form:selector==='form'&&index===0&&basicOpen?basicForm:null;
    node.querySelectorAll=selector=>selector==='form'?index===1&&model.open?[form]:index===0&&basicOpen?[basicForm]:[]:
      ['input,select,textarea','input,textarea,select'].includes(selector)&&index===0&&basicOpen?basicForm.selectors['input,select,textarea']:
      selector==='.sec-context > .sec-detail'&&index===1?recordNodes().filter((_node,row)=>!model.open||model.newEditor||sectionOwner.curItem.data[row].id!==selectedId):[];
    return node;});
  sections[1].parentElement=el('DIV',{classList:{contains:value=>value==='r-block'},__vue__:sectionOwner});
  assert.equal(sections[1].__vue__,undefined);
  model.changeOutside=()=>{sections[0].textContent='外区虚构变化';};
  function openInitialBasic(){
    basicOpen=true;sections[0].textContent=TITLES[0]+'自动编辑';const owner={mode:'edit',curItem:{name:TITLES[0],multi:false,data:[{id:'fictional-basic',editUrl:'/fixture/basic'}]}};
    sections[0].parentElement=el('DIV',{classList:{contains:value=>value==='r-block'},__vue__:owner});basicForm=el('FORM',{textContent:'基本信息自动打开',selectors:{}});
    const labels=['姓名','性别','手机号码','出生年月','电子邮件','现居住地','最高学历','照片','参加工作时间'],config=[],formData={},items=[],controls=[];
    for(const [index,label]of labels.entries()){const name='basic_'+index,value='fictional-initial-'+index,item=el(),control=el('INPUT',{type:'text',value,form:basicForm,item});config.push({label,name,value});formData[name]=value;item.selectors['.el-form-item__label']=[el('LABEL',{textContent:label,item})];item.selectors['input,textarea,select']=[control];items.push(item);controls.push(control);}
    if(options.changedBasicInitial){formData.basic_0='fictional-user-edit';controls[0].value='fictional-user-edit';}if(options.nonScalarBasic){formData.basic_0=config[0].value={label:'not-provable'};}
    basicForm.__vue__={_uid:99,$parent:owner,$props:{formdataurl:'/fixture/basic'},$data:{tableName:'resume',isBaseInfoSection:true,formConfig:config,formData}};
    model.restoreBasicInitial=()=>{for(const [index,row]of config.entries()){formData[row.name]=row.value;controls[index].value=row.value;}};
    basicForm.selectors['.el-form-item']=items;basicForm.selectors['input,select,textarea']=controls;
    basicForm.selectors.button=[el('BUTTON',{type:'button',form:basicForm,textContent:'取消',click(){model.basicCancels=(model.basicCancels||0)+1;basicOpen=false;owner.mode='read';sections[0].textContent=TITLES[0];}})];
  }
  function build(values){
    form=el('FORM',{textContent:'虚构教育编辑器',dataset:model.uid===10?{resumeGthEducationRecordIndex:options.newRecord?'new':'0',
      resumeGthEducationRecordCount:String(oldCount),...(options.newRecord?{resumeGthEducationTargetMode:'new',resumeGthEducationRequestId:REQUEST.requestId}:{})}:{}});
    const items=[],controls=[],byKey={};
    const add=(question,nodes)=>{const item=el('DIV'),label=el('LABEL',{textContent:question,item});
      nodes.forEach(node=>{node.item=item;node.form=form;});
      item.selectors['.el-form-item__label']=[label];item.selectors['input,textarea,select']=nodes;
      item.selectors['input,select,textarea']=nodes;items.push(item);controls.push(...nodes);return item;};
    for(const [question,key,tag]of [['毕业学校','school','INPUT'],['专业名称','major','INPUT'],['在校活动/职务','campusActivities','TEXTAREA'],
      ['在校成绩排名','gradeRank','INPUT'],['专业描述','majorDescription','TEXTAREA'],['绩点','gpa','INPUT'],['学校所在地','schoolLocation','INPUT']]){
      const node=el(tag,{type:tag==='INPUT'?'text':'textarea',value:values[key]});add(question,[node]);byKey[key]=node;
    }
    const degree=el('INPUT',{type:'text',value:values.degree,readOnly:true,disabled:options.degreeDisabled===true});
    add('学历',[degree]).selectors['.el-select input[type=text]']=[degree];byKey.degree=degree;
    const dates=['startDate','endDate'].map(key=>el('INPUT',{type:'text',value:values[key],readOnly:true}));
    const datesItem=add('在校时间',dates);datesItem.selectors['.el-date-editor']=dates.map(node=>{
      const wrapper=el('DIV',{classList:{contains:value=>value==='el-date-editor--month'}});wrapper.selectors['input[type=text]']=[node];return wrapper;});
    const category=el('INPUT',{type:'text',value:values.majorCategory,readOnly:true});add('专业类别',[category]).selectors['.cascader-wrap input[type=text]']=[category];
    const radios=['是','否'].map(value=>el('INPUT',{type:'radio',checked:value===values.unifiedAdmissions}));
    const radioItem=add('是否统招',radios);radioItem.selectors['label.el-radio']=radios.map((node,index)=>{
      const label=el('LABEL');label.selectors['input[type=radio]']=[node];label.selectors['.el-radio__label']=[el('SPAN',{textContent:index?'否':'是'})];return label;});
    const save=el('BUTTON',{type:'button',textContent:'保存',form,click(){model.saves++;model.open=false;sectionOwner.mode='read';
      sectionOwner.expandFormId=undefined;if(model.newEditor){
        const number=options.zeroAddedIds?0:options.multipleAddedIds?2:1;
        for(let index=0;index<number;index++)sectionOwner.curItem.data.push({id:'fictional-new-'+index,editUrl:'/fixture/education?new='+index});
        selectedId='fictional-new-0';
      }if(options.outsideChanged)sections[0].textContent='外区发生虚构变化';if(options.attachmentTextChanged)sections[5].textContent+='简历';}});
    const cancel=el('BUTTON',{type:'button',textContent:'取消',form,click(){model.cancels++;model.open=false;sectionOwner.mode='read';sectionOwner.expandFormId=undefined;}});
    form.selectors['.el-form-item']=items;form.selectors['input,select,textarea']=controls;form.selectors.button=[save,cancel];
    form.__vue__={_uid:model.uid,$parent:sectionOwner,$props:{formdataurl:model.newEditor?sectionOwner.curItem.addUrl:sectionOwner.curItem.data.find(row=>row.id===selectedId).editUrl},$data:{
      isEduInfoSection:true,tableName:'resume_education',saveURL:options.saveURL||(options.newRecord?'/api/resume/edit.json?customId=fictional&languageId=1&jid=fictional&systemUserTypeId=1':'/api/resume/edit.json'),
      formConfig:items.map(item=>({label:item.selectors['.el-form-item__label'][0].textContent}))}};
    model.controls=byKey;
  }
  build(data);
  const listeners=[];
  let lockChain=Promise.resolve();const lifecycleOptions={locks:{request(_name,_mode,work){const result=lockChain.then(work);lockChain=result.catch(()=>{});return result;}}};
  const api={runtime:{id:'fictional-extension',getURL:path=>'chrome-extension://fictional-extension/'+path,getManifest:()=>({}),onMessage:{addListener:value=>listeners.push(value),removeListener:value=>{const i=listeners.indexOf(value);if(i>=0)listeners.splice(i,1);}}},
    storage:{local:{async get(name){return {[name]:store.has(name)?structuredClone(store.get(name)):undefined};},async set(values){for(const [key,value]of Object.entries(values))store.set(key,structuredClone(value));},async remove(name){store.delete(name);}}},
    tabs:{async get(id){return {id,url:PAGE};},async query(){return [{id:77,url:PAGE}];},async reload(){model.reload();},sendMessage(_tab,message){return new Promise(resolve=>{let handled=false;for(const listener of [...listeners]){if(listener(message,{id:api.runtime.id},result=>{if(options.changeProfileAfterPhase&&message.type==='GTH_EDUCATION_DRAFT_SAVE'&&result?.targetSaved)store.set('resumeProfile',{fullName:'different-customer',education:[]});resolve(result);})===true)handled=true;}if(!handled)resolve(undefined);});}},
    scripting:{async executeScript(operation){assert.equal(operation.target.tabId,77);if(operation.files){assert.deepEqual(operation.files,['src/content/gth-draft-save.js']);vm.runInContext(SOURCE,context);return [{frameId:0}];}assert.deepEqual(operation.target,{tabId:77,frameIds:[0]});if(operation.world==='MAIN')model.mainReads++;
      const fn=vm.runInContext(`(${operation.func.toString()})`,context),result=await fn(operation.args?.[0]);
      if(options.identityChanged&&operation.args?.[0]?.phase==='after_reopen'&&result.ok)result.data.recordIdentity='different-record';
      return [{frameId:0,result}];}}};
  const bridge=createGthDraftMetadataBridge({api});
  const basicBridge=createGthRefreshBasicMetadataBridge({api,lifecycleOptions});
  api.runtime.sendMessage=message=>new Promise(resolve=>{if(message.type==='RESUME_PROFILE_BINDING_CHECK'){assertProfileBinding(api.storage.local,message.profileBinding).then(()=>resolve({allowed:true}),error=>resolve({allowed:false,reason:error.message}));return;}if(options.noBridge){resolve(undefined);return;}
    (message.type==='GTH_DRAFT_REFRESH_BASIC_READ'?basicBridge:bridge).listener(message,{id:api.runtime.id,tab:{id:77,url:PAGE},url:PAGE,frameId:0},resolve);});
  store.set("resumeProfile",{education:[data],fullName:`虚构客户${options.client||"A"}`});const binding=await captureProfileBinding(api.storage.local);
  class FastDate extends Date{static now(){return Date.now()*100;}}
  context=vm.createContext({chrome:api,crypto:webcrypto,TextEncoder,URL,structuredClone,Date:FastDate,console,
    setTimeout:(callback,ms)=>setTimeout(callback,ms>=8000?ms:1),clearTimeout,
    location:{href:PAGE},performance:{timeOrigin:123456},getComputedStyle:()=>({display:'block',visibility:'visible'}),
    document:{readyState:'complete',wasDiscarded:false,get visibilityState(){return model.hidden?'hidden':'visible';},querySelectorAll:selector=>selector==='.r-section'?sections:[]},
    ResumeGthEducationTextTrial:{listener(message,_sender,respond){respond({ok:true,data:{requestId:message.requestId,state:'settled',outcome:model.sourceOutcome,...(options.newRecord?{targetMode:'new',recordMarker:'new',provisionalNewRecord:true}:{})}});}}});
  model.reload=()=>{context.performance.timeOrigin+=100;model.reloads=(model.reloads||0)+1;if(!options.permanentOutside){sections[0].textContent=TITLES[0];if(!options.persistAttachmentAcrossReload)sections[5].textContent=TITLES[5];}if(options.autoBasic)openInitialBasic();delete context.ResumeGthEducationTextTrial;delete context[Symbol.for("resume.gth.draft.active.v1")];delete context[Symbol.for("resume.gth.draft.inspections.v2")];vm.runInContext(SOURCE,context);};
  vm.runInContext(SOURCE,context);return {api:context.ResumeGthDraftSave,chrome:api,model,store,context,binding,lifecycleOptions};
}

