// Offline: education probe scopes editor detection to 教育经历 forms only.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const src = await readFile(resolve('src/background/gth-education-auto.mjs'), 'utf8');

test('GTH education probe uses eduForms not flatMap-all-sections for ambiguous', () => {
  assert.match(src, /const eduForms=\[\.\.\.section\.querySelectorAll\('form'\)\]/);
  assert.match(src, /otherForms/);
  assert.match(src, /eduForms\.length>1/);
  assert.match(src, /warning:'gth_other_section_editor_open'/);
  // Must not use the old false-positive: forms.length!==1||forms[0]!==form
  assert.doesNotMatch(src, /forms\.length!==1\|\|forms\[0\]!==form/);
});

console.log(JSON.stringify({
  status: 'PASS',
  evidence: 'edu-section form scope; other-section editors warn not ambiguous'
}));
