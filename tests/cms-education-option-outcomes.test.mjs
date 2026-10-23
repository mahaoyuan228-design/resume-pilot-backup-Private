// Offline contracts: school option miss is fail-soft skipped; region miss fails;
// rank/select: unranked synonyms + miss is fail-soft skipped; ambiguous still fails;
// CMS education popup maps those reason codes to Chinese (not generic fallback).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const schoolSrc = await readFile(resolve('src/content/cms-education-multi-school.js'), 'utf8');
const regionSrc = await readFile(resolve('src/content/cms-education-multi-region.js'), 'utf8');
const selectSrc = await readFile(resolve('src/content/cms-education-multi-select.js'), 'utf8');
const popupSrc = await readFile(resolve('src/popup/cms-education-actions.js'), 'utf8');

test('school marks option_not_found as skipped (fail-soft)', () => {
  assert.match(schoolSrc, /status:\s*"skipped"/);
  assert.match(schoolSrc, /reason:\s*state\.exact\.length\s*\?\s*"ambiguous_option"\s*:\s*"option_not_found"/);
  assert.match(schoolSrc, /createTemplatePresent/);
  assert.match(schoolSrc, /empty_row_create_template_not_used/);
  assert.match(schoolSrc, /create_template_seen_but_not_sole_enabled_match/);
});

test('region throws region_option_not_found / ambiguous_region_option (failed path)', () => {
  assert.match(regionSrc, /fail\(matches\.length\?'ambiguous_region_option':'region_option_not_found'\)/);
});

test('rank/select soft-skips education_option_missing; ambiguous still fails', () => {
  assert.match(selectSrc, /fail\('ambiguous_education_option'\)/);
  assert.match(selectSrc, /status:'skipped',reason:'education_option_missing'/);
  assert.match(selectSrc, /UNRANKED=new Set\(\['未排名','无统计'/);
  assert.match(selectSrc, /optionMatch/);
  assert.match(selectSrc, /DEGREE_LEVELS/);
  assert.match(selectSrc, /硕士.*硕士研究生|硕士研究生.*硕士/);
  assert.match(selectSrc, /implementationRevision:6/);
});

test('degree-level closed synonyms cover short↔catalog CMS 学历 forms', () => {
  for (const pair of ['本科','大学本科','硕士','硕士研究生','博士','博士研究生','大专','专科','大学专科']) {
    assert.match(selectSrc, new RegExp(pair));
  }
  assert.match(selectSrc, /sameDegreeLevel/);
  // Soft-miss carries diagnostics for live evidence.
  assert.match(selectSrc, /desiredOptionText:desired/);
  assert.match(selectSrc, /sampleOptions:samples/);
});

test('school create-option templates accept curly/ASCII/corner quotes', () => {
  assert.match(schoolSrc, /使用“\$\{desiredText\}”作为我的学校/);
  assert.match(schoolSrc, /使用"\$\{desiredText\}"作为我的学校/);
  assert.match(schoolSrc, /使用「\$\{desiredText\}」作为我的学校/);
  assert.match(schoolSrc, /candidateKind:create\.length\?'explicit_create_school':'exact_catalog_option'/);
  assert.match(schoolSrc, /createLabels/);
});

test('CMS education popup explains option/region/rank miss reasons in Chinese', () => {
  const required = {
    option_not_found: '学校',
    region_option_not_found: '省市',
    education_option_missing: '学历',
    ambiguous_region_option: '同名',
    menu_cleanup_failed: '菜单',
    control_busy: '忙碌'
  };
  for (const [code, hint] of Object.entries(required)) {
    assert.match(popupSrc, new RegExp(`${code}:'[^']*${hint}`), code);
  }
  // Field-aware explain: create-not-sole + candidateOptions for Jeremy mapping.
  assert.match(popupSrc, /const explain=\(reason,field\)=>/);
  assert.match(popupSrc, /candidateOptions/);
  assert.match(popupSrc, /网站选项对应/);
});

test('school option_not_found records candidateOptions top-N (diagnostics only)', () => {
  assert.match(schoolSrc, /candidateOptions/);
  assert.match(schoolSrc, /candidateOptions\.length >= 12/);
  assert.match(schoolSrc, /candidateOptions: state\.candidateOptions/);
  assert.match(schoolSrc, /implementationRevision:8/);
});

console.log(JSON.stringify({
  status: 'PASS',
  evidence: 'static contracts for school/rank skip vs region fail + unranked synonyms + Chinese reason keys'
}));

test('school rev8 refuses sole-create + empty-row create hint', () => {
  assert.match(schoolSrc, /sole_create_refused_by_policy/);
  assert.match(schoolSrc, /empty_row_create_template_not_used/);
  assert.match(schoolSrc, /rowWasEmpty: !existing/);
  assert.match(schoolSrc, /explicit_create_school/);
});

test('popup explains empty-row Sydney create refuse in Chinese', () => {
  assert.match(popupSrc, /sole_create_refused_by_policy/);
  assert.match(popupSrc, /empty_row_create_template_not_used/);
  assert.match(popupSrc, /不会 sole-create/);
  assert.match(popupSrc, /空行\/新增/);
});
