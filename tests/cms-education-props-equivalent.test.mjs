// Independent synthetic reader checks. Zero browser/network/private data.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import vm from 'node:vm';
const home=dirname(fileURLToPath(import.meta.url)),target=resolve('src/content/cms-education-serialization.mjs');
// Git may check JavaScript out with CRLF on Windows. Pin the logical source.
const sourceSHA=createHash('sha256').update((await readFile(target,'utf8')).replace(/\r\n/gu,'\n')).digest('hex');
assert.equal(sourceSHA,'63262cde73ca31e38774718540a0ed3c0972dcbc212ecf461f5de2e69d1c9e87');
globalThis.fetch=()=>{throw Error('offline_only');};
const {readCmsEducationSerialization:reader}=await import(pathToFileURL(target));
const {readCmsEducationSerialization:oldReader}=await import(pathToFileURL(resolve('tests/fixtures/cms-education-serialization-v0146.mjs')));
function props(){
 const names=['学校','学历','学位','专业名称','开始时间','结束时间','城市','专业排名','专业描述'];
 const infoData=[names.map((name,index)=>({itemId:'f'+(index+1),oldItemId:index+1,name,fillType:index===0?1:[1,2,7].includes(index)?4:index===6?15:index===8?6:1,isNeed:index===8?1:0,customDataSource:index===0?'school':'',dataSource:index===6?'cities':'',dataSourceMap:{}}))];
 const cities=[{name:'虚构省甲',code:'province-1',children:[{name:'虚构城甲',code:'city-1'},{name:'虚构城乙',code:'city-2'}]}];
 return {id:'14',infoData,formData:{f1:{code:'school-1',name:'虚构大学甲'},f2:'20',f3:'a',f4:'虚构金融专业',f5:'2020-01-01',f6:'2024-06-01',f7:'city-1',f8:'rank-1',f9:''},isMutiRecord:true,dataSourceRelevantMap:{f2:{'20':'硕士研究生'},f3:{a:'硕士'},f8:{'rank-1':'无统计'}},dataSourceRelevant:{f7:structuredClone(cities)},dataSource:{cities:structuredClone(cities)}};
}
function reverseKeys(value){if(Array.isArray(value))return value.map(reverseKeys);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).reverse().map(key=>[key,reverseKeys(value[key])]));return value;}
function fixture(candidates){
 const wrappers=Array.from({length:9},(_,i)=>({id:`14_${i+1}_0`}));
 const row={getClientRects:()=>[{}],querySelectorAll:selector=>{assert.equal(selector,':scope > div[id]');return wrappers;}};
 const section={id:'14',getClientRects:()=>[{}],querySelector:selector=>{assert.equal(selector,':scope > .tit-wrap .tit');return {textContent:'教育经历必填'};},querySelectorAll:selector=>{assert.equal(selector,':scope > .form-cell-right > .form-cell-inner');return [row];}};
 section.__reactFiber$synthetic={memoizedProps:candidates[0],return:null};
 if(candidates.length>1)row.__reactFiber$synthetic={memoizedProps:candidates[1],return:null};
 return {document:{querySelectorAll:selector=>{assert.equal(selector,'form .form-cell');return [section];}},location:{origin:'https://wecruit.hotjob.cn',pathname:'/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html'},performance:{timeOrigin:12345},getComputedStyle:()=>({display:'block',visibility:'visible'})};
}
function run(fn,candidates){return JSON.parse(JSON.stringify(vm.runInNewContext(`(${fn.toString()})()`,fixture(candidates),{timeout:1000})));}
const original=props(),reordered=reverseKeys(structuredClone(original));
assert.notEqual(original,reordered);assert.deepEqual(Object.keys(original).sort(),['id','infoData','formData','isMutiRecord','dataSourceRelevantMap','dataSourceRelevant','dataSource'].sort());
const single=run(oldReader,[original]);assert.equal(single.ok,true);assert.equal(single.rows[0].fields.length,9);assert.equal(single.serialized.set_14.length,1);
assert.deepEqual(run(oldReader,[original,reordered]),{ok:false,reason:'education_public_props_not_unique'});
const equivalent=run(reader,[original,reordered]);assert.deepEqual(equivalent,single);
const mutations=[
 ['formData',other=>{other.formData.f1.code='different-school';}],
 ['map',other=>{other.dataSourceRelevantMap.f2['20']='不同学历';}],
 ['template',other=>{other.infoData[0][0].name='不同问题';}],
 ['templateArrayOrder',other=>{other.infoData[0].reverse();}],
 ['relevantTreeArrayOrder',other=>{other.dataSourceRelevant.f7[0].children.reverse();}],
 ['dataSourceTreeArrayOrder',other=>{other.dataSource.cities[0].children.reverse();}],
 ['scalarType',other=>{other.isMutiRecord=1;}],
 ['idScalarType',other=>{other.id=14;}]
];
const rejected=[];for(const [name,mutate]of mutations){const other=structuredClone(original);mutate(other);const result=run(reader,[original,other]);assert.deepEqual(result,{ok:false,reason:'education_public_props_not_unique'},name);rejected.push(name);}
const result={status:'PASS',sourceSHA256:sourceSHA,evidence:'offline synthetic DOM and React props; no real user data',groups:[{name:'distinct_references_all_seven_inputs_equivalent_key_order_ignored',passed:true,oldSingleReferenceFields:9,oldMultiReferenceRejected:true,newOutputEqualsOldSingleReference:true},{name:'any_projection_conflict_remains_not_unique',passed:true,rejected,arrayOrderPreserved:true,scalarTypesPreserved:true}],browserConnections:0,networkRequests:0,productChanges:0};
await writeFile(join(home,'review-tests-result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
