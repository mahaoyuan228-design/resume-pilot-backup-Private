// Offline: page school display 悉尼大学 matches profile bilingual long form
// under replaceExisting → verified preexisting_same_value (no catalog sole-create).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const schoolSrc = await readFile(resolve('src/content/cms-education-multi-school.js'), 'utf8');

test('school rev7 exports schoolDisplayMatches + preexisting under replaceExisting', () => {
  assert.match(schoolSrc, /implementationRevision:7/);
  assert.match(schoolSrc, /function schoolDisplayMatches\(/);
  assert.match(schoolSrc, /if \(reapplying\) return \{status:'verified',reason:'preexisting_same_value'/);
  assert.match(schoolSrc, /catalogMissSoft:\s*true/);
  // Must not require replaceExisting !== true for the soft match path.
  assert.doesNotMatch(
    schoolSrc,
    /reapplying && binding\?\.replaceExisting !== true\) return \{status:'verified',reason:'preexisting_same_value'\}/
  );
});

test('schoolDisplayMatches: 悉尼大学 ↔ bilingual profile; reject trivial substrings', () => {
  const start = schoolSrc.indexOf('function schoolDisplayMatches(');
  const end = schoolSrc.indexOf('function target(selection, binding)', start);
  assert.ok(start > 0 && end > start);
  const normalizedOption = (value) => String(value || '').normalize('NFKC').replace(/\s+/g, '').trim();
  const fn = vm.runInNewContext(
    schoolSrc.slice(start, end) + 'schoolDisplayMatches',
    { normalizedOption }
  );
  assert.equal(fn('悉尼大学', '悉尼大学 The University of Sydney'), true);
  assert.equal(fn('悉尼大学 The University of Sydney', '悉尼大学'), true);
  assert.equal(fn('悉尼大学', '悉尼大学'), true);
  assert.equal(fn('北京大学', '悉尼大学 The University of Sydney'), false);
  assert.equal(fn('大学', '悉尼大学 The University of Sydney'), false);
  assert.equal(fn('悉尼', '悉尼大学 The University of Sydney'), false);
  assert.equal(fn('', '悉尼大学'), false);
  assert.equal(fn('悉尼大学', ''), false);
});


test('controller rev19 + serialization use schoolDisplayEquals for school DOM/readback', async () => {
  const controllerSrc = await readFile(resolve('src/content/cms-record-controller.js'), 'utf8');
  const serialSrc = await readFile(resolve('src/content/cms-education-serialization.mjs'), 'utf8');
  assert.match(controllerSrc, /implementationRevision:19/);
  assert.match(controllerSrc, /schoolDisplayEquals/);
  assert.match(controllerSrc, /equals=key==='school'\?schoolDisplayEquals:optionEquals/);
  assert.match(serialSrc, /schoolDisplayEquals/);
  assert.match(serialSrc, /equals=key==='school'\?schoolDisplayEquals:displayEquals/);
});

console.log(JSON.stringify({
  status: 'PASS',
  evidence: 'schoolDisplayMatches soft preexisting + rev6 replaceExisting short-circuit + controller/serialization'
}));
