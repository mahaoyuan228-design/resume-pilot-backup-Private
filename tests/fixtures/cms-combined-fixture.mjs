// Compose existing independent widgets, with separate closures/IDs. No employer JS or React runtime.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {integrationFixture} from './cms-education-fixture.mjs';
import {internshipFixture} from './cms-internship-fixture.mjs';
const script=html=>{const found=[...html.matchAll(/<script>([\s\S]*?)<\/script>/gu)];assert.equal(found.length,1);return found[0][1];};
const section=(html,id)=>{const found=html.match(new RegExp('<section id="'+id+'"[\\s\\S]*?<\\/section>','u'));assert.ok(found);return found[0];};
export async function combinedFixture(catalog){
 const education=await integrationFixture(catalog),internship=await internshipFixture(),native=await readFile('tests/fixtures/cms-ant-form-synthetic.html','utf8');
 const nativeSections=[...native.matchAll(/<section class="form-cell">[\s\S]*?<\/section>/gu)].map(match=>match[0]);
 const basic=nativeSections.find(html=>html.includes('个人基本信息必填')),evaluation=nativeSections.find(html=>html.includes('自我评价必填'));assert.ok(basic&&evaluation);
 const eduScript=script(education);
 let workScript=script(internship).replaceAll('fixtureProps','internshipProps').replaceAll('fixtureCounts','internshipCounts').replaceAll('fixtureDates','internshipDates').replaceAll('fixtureSeed','internshipSeed').replaceAll('fixtureSnapshot','internshipSnapshot');
 workScript=workScript.replaceAll("'date-start-'","'intern-date-start-'").replaceAll("'date-end-'","'intern-date-end-'").replaceAll("host.id='date-'","host.id='intern-date-'");
 workScript=workScript.split('\n').filter(line=>!line.startsWith('window.internshipSeed=')&&!line.startsWith('window.internshipSnapshot=')).join('\n');
 const ordinary=`(()=>{
  const keep=new Set(['basic-name','basic-phone','basic-email']);
  const basic=[...document.querySelectorAll('.form-cell')].find(n=>n.querySelector('.tit')?.textContent==='个人基本信息必填');
  for(const item of [...basic.querySelectorAll('.ant-form-item')])if(![...item.querySelectorAll('input')].some(n=>keep.has(n.id)))item.remove();
  window.ordinaryFields={fullName:'basic-name',phone:'basic-phone',email:'basic-email',selfEvaluation:'self-evaluation'};window.ordinaryDto={};window.ordinaryCounts={};
  for(const[key,id]of Object.entries(ordinaryFields)){const n=document.getElementById(id);ordinaryCounts[key]=0;for(const type of ['input','change'])n.addEventListener(type,()=>{ordinaryCounts[key]++;ordinaryDto[key]=n.value;});}
  window.combinedEvents={education:0,internship:0};for(const[type,id]of [['education','14'],['internship','49170501']])for(const event of ['input','change','click'])document.getElementById(id).addEventListener(event,()=>combinedEvents[type]++,true);
  window.ordinarySnapshot=()=>({values:Object.fromEntries(Object.entries(ordinaryFields).map(([key,id])=>[key,document.getElementById(id).value])),dto:structuredClone(ordinaryDto),counts:{...ordinaryCounts}});
 })();`;
 const tail=`window.combinedSnapshot=()=>({ordinary:ordinarySnapshot(),education:{records:fixtureProps.infoData.length,formData:structuredClone(fixtureProps.formData),counts:{...fixtureCounts}},internship:{records:internshipProps.infoData.length,formData:structuredClone(internshipProps.formData),counts:{...internshipCounts}},events:{...combinedEvents}});`;
 const allScript=ordinary+'\n(()=>{'+eduScript+'})();\n(()=>{'+workScript+'})();\n'+tail;
 new vm.Script(allScript); // Syntax/namespace preflight, no DOM execution or assertion relaxation.
 const style=education.match(/<style>([\s\S]*?)<\/style>/u)[1];
 return `<!doctype html><meta charset="utf-8"><title>Fictional combined CMS blank form</title><style>${style}</style><form id="fixture-form" class="ant-form">${basic}${evaluation}<input id="unrelated" value="" readonly>${section(education,'14')}${section(internship,'49170501')}<button id="save" type="button">保存</button><button type="submit">最终申请</button></form><script>${allScript}</script>`;
}
