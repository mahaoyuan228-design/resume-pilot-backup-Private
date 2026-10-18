/**
 * Pass N contract: majorCategory overwrite mid-search must allow empty /
 * existing / intended answers when allowCategoryOverwrite is set; same-value
 * page display verifies without reopening cascader.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/content/gth-education.js'), 'utf8');

const norm = (value) => String(value || '').replace(/[\s\u00a0]+/gu, ' ').trim();

/** Mirrors product mid-search progress check (pass N). */
function categoryOverwriteProgressOk(readVal, existing, answer) {
  const pathParts = String(answer).split('/').map(norm);
  return readVal === '' || readVal === existing
    || norm(readVal) === norm(answer)
    || norm(readVal) === pathParts.at(-1)
    || pathParts.length === 1
      && norm(readVal).split('/').at(-1) === pathParts[0];
}

function categoryAlreadyMatches(existing, answer) {
  const pathParts = String(answer).split('/').map(norm);
  return norm(existing) === norm(answer)
    || norm(existing) === pathParts.at(-1)
    || pathParts.length === 1
      && norm(existing).split('/').at(-1) === pathParts[0];
}

test('mid-search progress allows empty after clearForeignSelection', () => {
  assert.equal(categoryOverwriteProgressOk('', '金融学', '经济学'), true);
});

test('mid-search progress allows intended leaf and full path', () => {
  assert.equal(categoryOverwriteProgressOk('经济学', '金融学', '经济学'), true);
  assert.equal(categoryOverwriteProgressOk('经济学', '金融学', '本科/经济学'), true);
  assert.equal(categoryOverwriteProgressOk('本科/经济学', '金融学', '本科/经济学'), true);
});

test('mid-search progress allows previous existing while overwrite in flight', () => {
  assert.equal(categoryOverwriteProgressOk('金融学', '金融学', '经济学'), true);
});

test('mid-search progress rejects unrelated foreign value', () => {
  assert.equal(categoryOverwriteProgressOk('会计学', '金融学', '经济学'), false);
});

test('preexisting_same_value when page already shows intended category', () => {
  assert.equal(categoryAlreadyMatches('金融学', '金融学'), true);
  assert.equal(categoryAlreadyMatches('金融学', '本科/金融学'), true);
  assert.equal(categoryAlreadyMatches('金融学', '经济学'), false);
});

test('gth-education.js keeps allowCategoryOverwrite own-intermediate contract', () => {
  assert.match(source, /allowCategoryOverwrite/);
  assert.match(source, /categoryOverwrite/);
  assert.match(source, /education_category_overwrite_guard/);
  assert.match(source, /preexisting_same_value/);
  // Empty string must be accepted during overwrite (post-clear mid-search).
  assert.match(source, /readVal === '' \|\| readVal === existing/);
  // Guard invocation without own-intermediate true still uses categoryOverwrite.
  assert.match(source, /const categoryOverwrite = selectedTarget\.kind === 'category'/);
});
