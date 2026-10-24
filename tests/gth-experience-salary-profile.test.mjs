// Synthetic profile/UI/storage only. No actual user profile or site is read.
import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProfile,saveProfile,loadProfile,listFilledPaths,validExperienceSalary} from '../src/profile/store.js';
import {installSyntheticStore,openSalaryProfileUi} from './fixtures/profile-salary-ui.mjs';
const path=index=>`experience.${index}.salary`;
const row={type:'fulltime',organization:'SYNTHETIC ORG',position:'SYNTHETIC ROLE',description:'SYNTHETIC WORK',startDate:'2020-01',endDate:'2021-02'};
const input=(salary,extra={})=>({experience:[{...row,...(salary===undefined?{}:{salary})}],...extra});

for(const value of ['0','0000012345','1234567890'])test('salary is an exact optional ASCII digit string',()=>{
  const raw=input(value,{confirmedFields:[path(0)],sources:{[path(0)]:'manual'}}),before=structuredClone(raw),profile=normalizeProfile(raw);
  assert.equal(validExperienceSalary(value),true);assert.equal(profile.experience[0].salary,value);
  assert.deepEqual(profile.confirmedFields,[path(0)]);assert.equal(profile.sources[path(0)],'manual');
  assert.deepEqual(normalizeProfile(profile),profile);assert.deepEqual(raw,before);
});
test('old schema/absent and empty optional salary retain identical profile output',()=>{
  const old=normalizeProfile(input(undefined));assert.equal(Object.hasOwn(old.experience[0],'salary'),false);
  assert.deepEqual(normalizeProfile(input('')),old);assert.equal(old.schemaVersion,1);
});
const invalid=[' 12000','12000 ','\t12000','12000\n','   ','12,000','12000.0','12000元/月','-1','１２３','12345678901','9'.repeat(4001)];
for(const value of invalid)test('invalid text survives verbatim as a draft without confirmation/source',()=>{
  const profile=normalizeProfile(input(value,{confirmedFields:[path(0)],sources:{[path(0)]:'import'}}));
  assert.equal(validExperienceSalary(value),false);assert.equal(profile.experience[0].salary,value);
  assert.deepEqual(profile.confirmedFields,[]);assert.equal(Object.hasOwn(profile.sources,path(0)),false);
  assert.equal(listFilledPaths(profile).includes(path(0)),false);assert.deepEqual(normalizeProfile(profile),profile);
});
for(const value of [12000,0,null,true,[],{}])test('non-string salary is never coerced into a confirmed value',()=>{
  const profile=normalizeProfile(input(value,{confirmedFields:[path(0)],sources:{[path(0)]:'manual'}}));
  assert.equal(Object.hasOwn(profile.experience[0],'salary'),false);assert.deepEqual(profile.confirmedFields,[]);assert.deepEqual(profile.sources,{});
});
test('the special path filter affects only experience salary',()=>{
  const profile=normalizeProfile({...input('bad'),projects:[{name:'SYNTHETIC'}],customFacts:[{question:'salary',answer:'free text'}],
    confirmedFields:['customAnswers.salary','projects.0.name']});
  assert.ok(listFilledPaths(profile).includes('customAnswers.salary'));assert.deepEqual(profile.confirmedFields,['customAnswers.salary','projects.0.name']);
});
for(const confirmed of [false,true])test('real save/load preserves salary, source and its existing confirmation only',async t=>{
  const memory=installSyntheticStore(t,{}),profile=normalizeProfile(input('0000012345',{sources:{[path(0)]:'manual'},confirmedFields:confirmed?[path(0)]:[]}));
  const saved=await saveProfile(profile),loaded=await loadProfile();
  assert.equal(saved.experience[0].salary,'0000012345');assert.deepEqual(loaded,saved);assert.deepEqual(memory.read(),saved);
  assert.equal(loaded.sources[path(0)],'manual');assert.equal(loaded.confirmedFields.includes(path(0)),confirmed);
});
test('invalid draft save/load never launders a string or restores its discarded confirmation',async t=>{
  installSyntheticStore(t,{});const value=' '+('9'.repeat(4001));
  const saved=await saveProfile(input(value,{confirmedFields:[path(0)],sources:{[path(0)]:'manual'}})),loaded=await loadProfile();
  assert.equal(loaded.experience[0].salary,value);assert.deepEqual(loaded,saved);assert.deepEqual(loaded.confirmedFields,[]);assert.deepEqual(loaded.sources,{});
});
test('actual UI renders escaped ordinary text without a truncating maxlength',async t=>{
  const ui=await openSalaryProfileUi(t,input('<synthetic>'));
  const field=ui.document.querySelector('[data-field="salary"]');assert.equal(field.type,'text');assert.equal(field.hasAttribute('maxlength'),false);
  assert.equal(field.value,'<synthetic>');assert.equal(ui.document.querySelector('synthetic'),null);
  assert.equal(ui.document.body.textContent.includes('薪资控件尚未支持，这里不采集'),false);
});
test('normal UI input/review/confirmation saves and reloads exact salary with manual source',async t=>{
  const ui=await openSalaryProfileUi(t,input(undefined));await ui.edit('0000012345');await ui.flush();
  let loaded=await loadProfile();assert.equal(loaded.experience[0].salary,'0000012345');assert.equal(loaded.confirmedFields.includes(path(0)),false);
  await ui.confirm();loaded=await loadProfile();assert.equal(loaded.sources[path(0)],'manual');assert.ok(loaded.confirmedFields.includes(path(0)));
  assert.ok(ui.memory.state.lockCalls>0);await ui.reload();assert.equal(ui.document.querySelector('[data-field="salary"]').value,'0000012345');
  assert.equal(ui.document.getElementById('review-check').checked,true);
});
for(const value of invalid.filter(value=>!value.includes('\n')))test('raw UI invalid salary refuses section confirmation before normalize',async t=>{
  const ui=await openSalaryProfileUi(t,input(undefined));await ui.edit(value);await ui.confirm();
  assert.match(ui.document.getElementById('toast').textContent,/薪资请填写1–10位数字/);
  assert.equal(ui.draft().experience[0].salary,value);assert.equal(ui.draft().confirmedFields.length,0);
  await ui.flush();const loaded=await loadProfile();assert.equal(loaded.experience[0].salary,value);
  assert.equal(loaded.confirmedFields.length,0);assert.equal(Object.hasOwn(loaded.sources,path(0)),false);
  await ui.reload();assert.equal(ui.document.querySelector('[data-field="salary"]').value,value);
});
test('an imported newline draft stays invalid even though native single-line display strips newlines',async t=>{
  const ui=await openSalaryProfileUi(t,input('12000\n',{confirmedFields:[path(0)],sources:{[path(0)]:'import'}}));
  assert.equal(ui.draft().experience[0].salary,'12000\n');await ui.confirm();
  assert.match(ui.document.getElementById('toast').textContent,/薪资请填写1–10位数字/);
  await ui.flush();assert.equal((await loadProfile()).experience[0].salary,'12000\n');
  assert.equal((await loadProfile()).confirmedFields.includes(path(0)),false);
});
test('editing and clearing revoke the old confirmation; no same-value save invents review',async t=>{
  const ui=await openSalaryProfileUi(t,input('12345',{confirmedFields:[path(0)],sources:{[path(0)]:'import'}}));
  await ui.edit('12346');assert.equal(ui.document.getElementById('review-check').checked,false);assert.equal(ui.draft().confirmedFields.includes(path(0)),false);
  await ui.flush();assert.equal((await loadProfile()).confirmedFields.includes(path(0)),false);
  await ui.confirm();assert.ok((await loadProfile()).confirmedFields.includes(path(0)));
  await ui.edit('');await ui.flush();const loaded=await loadProfile();assert.equal(Object.hasOwn(loaded.experience[0],'salary'),false);
  assert.equal(loaded.confirmedFields.includes(path(0)),false);assert.equal(Object.hasOwn(loaded.sources,path(0)),false);
});
test('an invalid optional draft keeps the section and menu pending even when all other facts are confirmed',async t=>{
  const ui=await openSalaryProfileUi(t,input('11bad',{confirmedFields:Object.keys(row).map(key=>'experience.0.'+key)}));
  assert.equal(ui.document.getElementById('section-state').textContent,'待核对');
  assert.equal(ui.document.getElementById('review-check').checked,false);
  assert.equal(ui.document.querySelector('[data-section="experience"] small').textContent,'待核对');
  await ui.edit('bad22');assert.equal(ui.document.getElementById('section-state').textContent,'待核对');
  await ui.confirm();assert.match(ui.document.getElementById('toast').textContent,/薪资请填写/);
});
test('deleting a preceding row cannot move its confirmation onto another salary',async t=>{
  const ui=await openSalaryProfileUi(t,{experience:[{...row,salary:'111'},{...row,salary:'222'}],confirmedFields:[path(0),path(1)],sources:{[path(0)]:'manual',[path(1)]:'import'}});
  await ui.click('[data-remove="experience"][data-index="0"]');await ui.flush();const loaded=await loadProfile();
  assert.equal(loaded.experience.length,1);assert.equal(loaded.experience[0].salary,'222');assert.equal(loaded.confirmedFields.some(p=>p.startsWith('experience.')),false);
});
test('failed normal UI confirmation save leaves stored confirmation unchanged and rolls back the draft',async t=>{
  const ui=await openSalaryProfileUi(t,input('111'));await ui.edit('222');await ui.flush();ui.memory.state.failProfileSet=true;
  await ui.confirm();assert.equal(ui.draft().confirmedFields.includes(path(0)),false);
  assert.equal(ui.memory.read().confirmedFields.includes(path(0)),false);assert.equal(ui.memory.read().experience[0].salary,'222');
  assert.match(ui.document.getElementById('save-state').textContent,/保存失败/);
  ui.memory.state.failProfileSet=false;
});
