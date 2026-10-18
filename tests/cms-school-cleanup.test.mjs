import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile,writeFile} from 'node:fs/promises';import {join,dirname,resolve} from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
const home=dirname(fileURLToPath(import.meta.url)),path=resolve('src/content/cms-education-multi-school.js'),source=await readFile(path,'utf8');
const part=source.slice(source.indexOf('  function escape(input) {'),source.indexOf('  function candidateState('));
async function run(mode){
 let menu=true,opened=true,waits=0;const events=[],selected='虚构原学校',query='虚构待查名称';
 const ownSelect={},linked={},unrelated={};let liveSelected=selected;
 const selection={getAttribute:()=>mode==='unlinked'?'wrong':'own-list',closest:()=>ownSelect,blur:()=>events.push('selection-blur')};
 const search={value:query,dispatchEvent:event=>{events.push(event.type);assert.equal(event.type,'keydown','cleanup must not dispatch answer/search changes');assert.equal(event.keyCode,27);if(mode!=='permanent'){opened=false;menu=false;}},blur:()=>events.push('input-blur')};
 const current={selection,search},dropdown={contains:node=>node===linked};
 const context={normalizedOption:v=>v,locate:()=>mode==='wrong-record'?null:current,openMenus:()=>menu?[dropdown]:[],openSelects:()=>opened?[mode==='foreign-select'?unrelated:ownSelect]:[],otherOverlays:()=>[],selectedText:()=>liveSelected,requireVisiblePage:()=>{},checkProfileWrite:async()=>{if(mode==='changed-during-owner-check')liveSelected='虚构已变学校';},pause:async()=>{waits++;},document:{getElementById:id=>id==='own-list'?linked:null},KeyboardEvent:class{constructor(type,options){this.type=type;Object.assign(this,options);}},Object,Promise};
 const fn=vm.runInNewContext(part+';closeOwnMenu',context);const ok=await fn({});
 return {ok,events,waits,queryPreserved:search.value===query,selectedPreserved:liveSelected===selected};
}
const positive=await run('own');assert.equal(positive.ok,true);assert.deepEqual(positive.events,['keydown','input-blur','selection-blur']);assert.equal(positive.queryPreserved,true);assert.equal(positive.selectedPreserved,true);
const rejected=[];for(const mode of ['unlinked','wrong-record','foreign-select','changed-during-owner-check']){const result=await run(mode);assert.equal(result.ok,false,mode);assert.deepEqual(result.events,[],mode);assert.equal(result.queryPreserved,true);rejected.push(mode);}
const permanent=await run('permanent');assert.equal(permanent.ok,false);assert.equal(permanent.waits,30);assert.equal(permanent.queryPreserved,true);assert.equal(permanent.selectedPreserved,true);
assert.ok(!part.includes('setter.call')&&!part.includes('new Event(')&&!part.includes('document.body'),'no answer/search/body-click mutations');
const result={status:'PASS',evidence:'actual candidate cleanup functions in synthetic VM; not Edge or real site',sourceSha:createHash('sha256').update(source).digest('hex'),groups:[{name:'owned_escape_closes_without_answer_or_query_edit',passed:true},{name:'ambiguous_changed_or_permanent_menu_stops',passed:true,rejected,permanentBudget:30}],browserActions:0};await writeFile(join(home,'cleanup-test-final-result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
