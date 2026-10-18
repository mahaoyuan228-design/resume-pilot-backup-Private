import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyProfile, listFilledPaths, normalizeProfile } from '../src/profile/store.js';

const mapping = {
  siteUrlPrefix: 'https://career.example.invalid/company-one/',
  fieldPath: 'education.0.degree',
  sourceValue: '硕士',
  optionText: '硕士研究生'
};

test('schema v1 profiles gain an empty independent mapping list', () => {
  const old = normalizeProfile({
    schemaVersion: 1,
    education: [{ school: '示例大学', degree: '硕士' }],
    confirmedFields: ['education.0.degree']
  });
  assert.deepEqual(old.siteOptionMappings, []);
  assert.deepEqual(old.confirmedFields, ['education.0.degree']);
  assert.equal(old.schemaVersion, 1);
  assert.deepEqual(emptyProfile().siteOptionMappings, []);
});

test('complete mapping has its own confirmation path and never enters custom answers', () => {
  const profile = normalizeProfile({
    education: [{ degree: '硕士' }],
    customFacts: [{ question: '是否接受岗位调剂', answer: '否' }],
    siteOptionMappings: [mapping],
    confirmedFields: [
      'education.0.degree', 'customAnswers.是否接受岗位调剂',
      'siteOptionMappings.0.optionText'
    ],
    sources: { 'siteOptionMappings.0.optionText': 'manual' }
  });
  assert.deepEqual(profile.siteOptionMappings, [mapping]);
  assert.equal(profile.customAnswers['是否接受岗位调剂'], '否');
  assert.equal(profile.customAnswers['education.0.degree'], undefined);
  assert.equal(listFilledPaths(profile).filter((path) => path.startsWith('siteOptionMappings.')).length, 1);
  assert.ok(profile.confirmedFields.includes('siteOptionMappings.0.optionText'));
  assert.equal(profile.sources['siteOptionMappings.0.optionText'], 'manual');
  assert.deepEqual(normalizeProfile(JSON.parse(JSON.stringify(profile))).siteOptionMappings, [mapping]);
});

test('incomplete or deleted mapping cannot retain a confirmation', () => {
  const draft = normalizeProfile({
    siteOptionMappings: [{ ...mapping, sourceValue: '' }],
    confirmedFields: ['siteOptionMappings.0.optionText']
  });
  assert.equal(listFilledPaths(draft).includes('siteOptionMappings.0.optionText'), false);
  assert.deepEqual(draft.confirmedFields, []);
  const deleted = normalizeProfile({ ...draft, siteOptionMappings: [] });
  assert.deepEqual(deleted.confirmedFields, []);
});

test('import can keep mapping data while requiring fresh review', () => {
  const backup = normalizeProfile({
    siteOptionMappings: [mapping],
    confirmedFields: ['siteOptionMappings.0.optionText'],
    sources: { 'siteOptionMappings.0.optionText': 'manual' }
  });
  const imported = normalizeProfile({
    ...backup,
    confirmedFields: [],
    sources: Object.fromEntries(listFilledPaths(backup).map((path) => [path, 'import']))
  });
  assert.deepEqual(imported.siteOptionMappings, [mapping]);
  assert.deepEqual(imported.confirmedFields, []);
  assert.equal(imported.sources['siteOptionMappings.0.optionText'], 'import');
});
