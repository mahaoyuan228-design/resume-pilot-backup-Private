import test from 'node:test';
import assert from 'node:assert/strict';
import {detectResumeCandidates,mergeResumeCandidates} from '../../src/import/candidates.mjs';

test('legacy single education survives a labelled job preference preamble',()=>{
 const input='姓名：虚构用户\n求职意向：分析师\n学校：示例大学\n学历：本科\n专业：金融学';
 const found=detectResumeCandidates(input),education=found.candidates.filter(c=>c.path==='educationRecord');
 assert.equal(education.length,1);assert.equal(education[0].educationRecord.school,'示例大学');
 assert.equal(education[0].educationRecord.startDate,'');assert.equal(education[0].educationRecord.endDate,'');
 assert.equal(found.candidates.find(c=>c.path==='desiredRoles.0').value,'分析师');
 const imported=mergeResumeCandidates({},education);assert.equal(imported.profile.education.length,1);
 assert.deepEqual(imported.profile.confirmedFields,[]);
});

test('legacy compatibility does not cross a work section or pair two schools',()=>{
 for(const input of ['求职意向：分析师\n工作经历\n学校：某客户学校\n学历：本科\n专业：项目资料','求职意向：分析师\n学校：甲学校\n学校：乙学校\n学历：本科\n专业：金融学']){
  assert.equal(detectResumeCandidates(input).candidates.filter(c=>c.path==='educationRecord').length,0);
 }
});

test('two schools and two companies remain independent selected records',()=>{
 const input='教育经历\n学校：示例甲大学\n学历：本科\n专业：金融\n在校时间：2020-09至2024-06\n学校：示例乙大学\n学历：硕士研究生\n专业：经济\n在校时间：2024-09至2026-06\n实习经历\n公司：示例甲证券\n岗位：研究实习生\n实习时间：2024-07至2024-08\n职责：整理公开报告\n公司：示例乙证券\n岗位：投行实习生\n实习时间：2025-07至2025-09\n职责：核对虚构样本';
 const found=detectResumeCandidates(input).candidates;assert.equal(found.filter(c=>c.path==='educationRecord').length,2);assert.equal(found.filter(c=>c.path==='experienceRecord').length,2);
 const selected=found.filter(c=>c.path==='educationRecord'||c.experienceRecord?.organization==='示例乙证券');
 const imported=mergeResumeCandidates({},selected);assert.equal(imported.profile.education.length,2);assert.equal(imported.profile.experience.length,1);
 assert.equal(imported.profile.experience[0].organization,'示例乙证券');assert.equal(imported.profile.experience[0].position,'投行实习生');
 assert.deepEqual(imported.profile.confirmedFields,[]);assert.equal(mergeResumeCandidates(imported.profile,selected).added.length,0);
});

test('all supported work headings end education and never become a second school',()=>{
 for(const heading of ['工作与实习','工作与实习经历','正式工作经历']){
  const work=`${heading}\n公司：示例培训单位\n学校：客户学校\n学历：本科\n专业：培训专业\n在校时间：2024-09至2025-06`;
  const education='教育经历\n学校：示例原大学\n学历：本科\n专业：金融\n在校时间：2020-09至2024-06\n';
  const found=detectResumeCandidates(education+work).candidates.filter(c=>c.path==='educationRecord');
  assert.equal(found.length,1);assert.equal(found[0].educationRecord.school,'示例原大学');
  assert.equal(detectResumeCandidates(work).candidates.filter(c=>c.path==='educationRecord').length,0);
 }
});
