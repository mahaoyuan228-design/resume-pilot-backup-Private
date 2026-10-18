/**
 * Pass U follow-up: GTH basic overwrite mid-select/month must allow empty /
 * existing / intended on the active field (parity with education categoryOverwrite).
 * Same-value under replaceExisting verifies without reopening widgets.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/content/gth-basic.js'), 'utf8');

const norm = (value) => String(value || '').replace(/[\s\u00a0]+/gu, ' ').trim();

/** Mirrors product mid-overwrite progress check for basic select/month. */
function basicOverwriteProgressOk(readVal, existing, answer) {
  return readVal === '' || readVal === existing
    || norm(readVal) === norm(answer);
}

test('mid-select progress allows empty after Element UI clear', () => {
  assert.equal(basicOverwriteProgressOk('', '本科', '硕士'), true);
});

test('mid-select progress allows existing while overwrite in flight', () => {
  assert.equal(basicOverwriteProgressOk('本科', '本科', '硕士'), true);
});

test('mid-select progress allows intended answer', () => {
  assert.equal(basicOverwriteProgressOk('硕士', '本科', '硕士'), true);
});

test('mid-select progress rejects unrelated foreign value', () => {
  assert.equal(basicOverwriteProgressOk('博士', '本科', '硕士'), false);
});

test('gth-basic.js keeps allowOwnIntermediate overwrite contract', () => {
  assert.match(source, /allowOwnIntermediate/);
  assert.match(source, /midGuard/);
  assert.match(source, /implementationRevision:4/);
  assert.match(source, /basic_other_values_changed/);
  // Empty / existing / intended must be accepted during overwrite mid-select.
  assert.match(source, /readVal===''\|\|readVal===existing\|\|norm\(readVal\)===norm\(answerVal\)/);
  // Same-value short-circuit avoids reopening select under replaceExisting.
  assert.match(source, /preexisting_same_value/);
  assert.match(source, /Same-value under replaceExisting/);
});

test('degree and month mid-flight guards use midGuard not raw allBefore', () => {
  assert.match(source, /step\('degree_open'\)[\s\S]*?midGuard\(\)/);
  assert.match(source, /step\('month_open'\)[\s\S]*?midGuard\(\)/);
  // Raw guard(field,allBefore) must not appear inside degree option matching.
  const degreeBlock = source.slice(source.indexOf("step('degree_open')"), source.indexOf("step('degree_close')"));
  assert.equal(/guard\(field,allBefore\)/.test(degreeBlock), false);
  assert.match(degreeBlock, /midGuard\(\)/);
});
