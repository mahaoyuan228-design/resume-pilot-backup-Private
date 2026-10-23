// Independent synthetic reader checks. Zero browser/network/private data.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import vm from 'node:vm';
const home=dirname(fileURLToPath(import.meta.url)),target=resolve('src/content/cms-internship-serialization.mjs');
const sourceSHA=createHash('sha256').update((await readFile(target,'utf8')).replace(/\r\n/gu,'\n')).digest('hex');
assert.equal(sourceSHA,'58cf396276f4e5a649f392fc50d98990cd03862e3b2c834a5d72539f7453378f');
globalThis.fetch=()=>{throw Error('offline_only');};
const {readCmsInternshipSerialization:reader}=await import(pathToFileURL(target));
const {readCmsInternshipSerialization:oldReader}=await import(pathToFileURL(resolve('tests/fixtures/cms-internship-serialization-strict-props.mjs')));
function props(){
  const defs=[[49170508,'开始时间',2],[49170510,'结束时间',2],[49170514,'企业名称',1],[49170517,'工作性质',4],[49170519,'职位名称',1],[49170523,'工作描述',6]];
  const infoData=[defs.map(([oldItemId,name,fillType])=>({itemId:`49170501_${oldItemId}`,oldItemId,name,fillType,dataSourceMap:{}}))];
  return {id:'49170501',infoData,formData:{
    '49170501_49170508':'2022-09-01','49170501_49170510':'2022-12-01','49170501_49170514':'中信证券股份有限公司',
    '49170501_49170517':'2','49170501_49170519':'实习生','49170501_49170523':'合成工作描述'
  },isMutiRecord:true,dataSourceRelevantMap:{'49170501_49170517':{'2':'实习'}}};
}
function reverseKeys(value){if(Array.isArray(value))return value.map(reverseKeys);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).reverse().map(key=>[key,reverseKeys(value[key])]));return value;}
function fixture(candidates){
  const wrappers=[[49170508,49170510,49170514,49170517,49170519,49170523].map(id=>({id:`49170501_${id}_0`}))].flat();
  const row={getClientRects:()=>[{}],querySelectorAll:selector=>{assert.equal(selector,':scope > div[id]');return wrappers;}};
  const section={id:'49170501',getClientRects:()=>[{}],querySelector:selector=>{assert.equal(selector,':scope > .tit-wrap .tit');return {textContent:'实习经历'};},querySelectorAll:selector=>{assert.equal(selector,':scope > .form-cell-right > .form-cell-inner');return [row];}};
  section.__reactFiber$synthetic={memoizedProps:candidates[0],return:null};
  if(candidates.length>1)row.__reactFiber$synthetic={memoizedProps:candidates[1],return:null};
  return {document:{querySelectorAll:selector=>{assert.equal(selector,'form .form-cell');return [section];}},location:{origin:'https://wecruit.hotjob.cn',pathname:'/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html'},performance:{timeOrigin:12345},getComputedStyle:()=>({display:'block',visibility:'visible'})};
}
function run(fn,candidates){return JSON.parse(JSON.stringify(vm.runInNewContext(`(${fn.toString()})()`,fixture(candidates),{timeout:1000})));}
const original=props(),reordered=reverseKeys(structuredClone(original));
assert.notEqual(original,reordered);assert.deepEqual(Object.keys(original).sort(),['id','infoData','formData','isMutiRecord','dataSourceRelevantMap'].sort());
const single=run(oldReader,[original]);assert.equal(single.ok,true);assert.equal(single.rows[0].fields.length,6);assert.equal(single.serialized.set_49170501.length,1);
assert.deepEqual(run(oldReader,[original,reordered]),{ok:false,reason:'internship_public_props_not_unique'});
const equivalent=run(reader,[original,reordered]);assert.deepEqual(equivalent,single);
const mutations=[
  ['formData',other=>{other.formData['49170501_49170514']='不同企业';}],
  ['map',other=>{other.dataSourceRelevantMap['49170501_49170517']['2']='不同性质';}],
  ['template',other=>{other.infoData[0][0].name='不同问题';}],
  ['templateArrayOrder',other=>{other.infoData[0].reverse();}],
  ['scalarType',other=>{other.isMutiRecord=1;}],
  ['idScalarType',other=>{other.id=49170501;}]
];
const rejected=[];for(const [name,mutate]of mutations){const other=structuredClone(original);mutate(other);const result=run(reader,[original,other]);assert.deepEqual(result,{ok:false,reason:'internship_public_props_not_unique'},name);rejected.push(name);}
const result={status:'PASS',sourceSHA256:sourceSHA,evidence:'offline synthetic DOM and React props; no real user data',groups:[{name:'distinct_references_all_five_inputs_equivalent_key_order_ignored',passed:true,oldSingleReferenceFields:6,oldMultiReferenceRejected:true,newOutputEqualsOldSingleReference:true},{name:'any_projection_conflict_remains_not_unique',passed:true,rejected,arrayOrderPreserved:true,scalarTypesPreserved:true}],browserConnections:0,networkRequests:0,productChanges:0};
await writeFile(join(home,'internship-props-equivalent-result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
