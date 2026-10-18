// Offline: basic fill scopes forms to 基本信息 + dismisses foreign editors (never Save).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const basic = await readFile(resolve('src/content/gth-basic.js'), 'utf8');
const probe = await readFile(resolve('src/background/gth-basic-auto.mjs'), 'utf8');

test('gth-basic forms() is basic-section scoped', () => {
  assert.match(basic, /const forms = sections => \[\.\.\.sections\[0\]\.querySelectorAll\('form'\)\]/);
  assert.match(basic, /const otherSectionForms = sections =>/);
  assert.match(basic, /async function clearForeignEditors/);
  assert.match(basic, /other_section_editor_open/);
  assert.match(basic, /norm\(node\.textContent\) === '取消'/);
  assert.doesNotMatch(basic, /const forms = sections => sections\.flatMap\(section=>\[\.\.\.section\.querySelectorAll\('form'\)\]\)/);
  assert.match(basic, /implementationRevision:4/);
});

test('gth-basic never clicks Save while clearing foreign editors', () => {
  const dismissStart = basic.indexOf('async function dismissCancelOnly');
  const trialStart = basic.indexOf('async function trial(');
  const body = basic.slice(dismissStart, trialStart > dismissStart ? trialStart : dismissStart + 2000);
  assert.ok(dismissStart > 0);
  assert.match(body, /cancelButtons|取消/);
  assert.match(body, /dismissCancelOnly/);
  assert.match(body, /clearForeignEditors/);
  assert.doesNotMatch(body, /textContent\) === '保存'/);
  assert.doesNotMatch(body, /'提交'|投递/);
});

test('probe scopes basic forms; other sections warn', () => {
  assert.match(probe, /const forms=\[\.\.\.section\.querySelectorAll\('form'\)\]/);
  assert.match(probe, /warning:'gth_other_section_editor_open'/);
  assert.match(probe, /Only 基本信息 forms count/);
  // Ambiguous only when >1 form inside 基本信息, not leftover other-section forms.
  assert.match(probe, /if\(forms\.length>1\)/);
  assert.doesNotMatch(probe, /forms\.length!==1\|\|forms\[0\]!==form/);
});

console.log(JSON.stringify({
  status: 'PASS',
  evidence: 'basic forms scoped + clearForeignEditors cancel-only; probe other-section warn'
}));
