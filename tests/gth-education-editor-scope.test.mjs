// Offline: education fill scopes forms to 教育经历 + dismisses foreign editors (never Save).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const edu = await readFile(resolve('src/content/gth-education.js'), 'utf8');
const probe = await readFile(resolve('src/background/gth-education-auto.mjs'), 'utf8');
const other = await readFile(resolve('src/content/gth-other-section.js'), 'utf8');
const simple = await readFile(resolve('src/content/gth-simple-section.js'), 'utf8');

test('gth-education forms() is education-section scoped', () => {
  assert.match(edu, /const forms = sections => \[\.\.\.sections\[1\]\.querySelectorAll\('form'\)\]/);
  assert.match(edu, /const otherSectionForms = sections =>/);
  assert.match(edu, /async function clearForeignEditors/);
  assert.match(edu, /other_section_editor_open/);
  assert.match(edu, /norm\(node\.textContent\) === '取消'/);
  assert.doesNotMatch(edu, /const forms = sections => sections\.flatMap\(section => \[\.\.\.section\.querySelectorAll\('form'\)\]\)/);
  assert.match(edu, /implementationRevision:4/);
});

test('gth-education never clicks Save while clearing foreign editors', () => {
  const dismissStart = edu.indexOf('async function dismissCancelOnly');
  const trialStart = edu.indexOf('async function trial(');
  const body = edu.slice(dismissStart, trialStart);
  assert.ok(dismissStart > 0 && trialStart > dismissStart);
  assert.match(body, /cancelButtons|取消/);
  assert.match(body, /dismissCancelOnly/);
  assert.match(body, /clearForeignEditors/);
  // Cancel path only — no Save/submit click strings inside dismiss helpers.
  assert.doesNotMatch(body, /textContent\) === '保存'/);
  assert.doesNotMatch(body, /'提交'|投递/);
});

test('probe still scopes eduForms; other sections warn', () => {
  assert.match(probe, /const eduForms=\[\.\.\.section\.querySelectorAll\('form'\)\]/);
  assert.match(probe, /warning:'gth_other_section_editor_open'/);
});

test('gth-other / gth-simple formsOf are section-scoped', () => {
  assert.match(other, /const formsOf = sections => \[\.\.\.sections\[6\]\.querySelectorAll\('form'\)\]/);
  assert.match(simple, /const formsOf = sections => \[\.\.\.sections\[4\]\.querySelectorAll\('form'\)\]/);
  assert.match(other, /ResumeGthOtherSectionRevision=4/);
  assert.match(simple, /ResumeGthSimpleSectionRevision=4/);
});

console.log(JSON.stringify({
  status: 'PASS',
  evidence: 'edu forms scoped + clearForeignEditors cancel-only; other/simple section scope'
}));
