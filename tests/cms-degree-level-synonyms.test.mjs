// Offline: closed 学历 short↔catalog synonym class (parity with UNRANKED pattern).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const exact = (v) => String(v || '').normalize('NFKC').replace(/[\u200b-\u200d\ufeff]/gu, '').replace(/\s+/gu, '').trim();
const UNRANKED = new Set(['未排名', '无统计', '无排名', '不排名', '暂无排名', '暂无', '无'].map(exact));
const DEGREE_LEVELS = [
  new Set(['本科', '大学本科'].map(exact)),
  new Set(['硕士', '硕士研究生'].map(exact)),
  new Set(['博士', '博士研究生'].map(exact)),
  new Set(['大专', '专科', '大学专科'].map(exact))
];
const sameDegreeLevel = (left, right) => DEGREE_LEVELS.some((set) => set.has(left) && set.has(right));
const optionMatch = (a, b) => {
  const left = exact(a);
  const right = exact(b);
  return left === right || (UNRANKED.has(left) && UNRANKED.has(right)) || sameDegreeLevel(left, right);
};

test('硕士 matches CMS catalog 硕士研究生 (index-4 soft-skip root cause)', () => {
  assert.equal(optionMatch('硕士', '硕士研究生'), true);
  assert.equal(optionMatch('硕士研究生', '硕士'), true);
});

test('本科 matches 大学本科; 博士 matches 博士研究生', () => {
  assert.equal(optionMatch('本科', '大学本科'), true);
  assert.equal(optionMatch('博士', '博士研究生'), true);
});

test('cross-level never matches (硕士 ≠ 本科/博士)', () => {
  assert.equal(optionMatch('硕士', '本科'), false);
  assert.equal(optionMatch('硕士', '博士研究生'), false);
  assert.equal(optionMatch('本科', '博士'), false);
});

test('unranked synonyms still match; unrelated text does not', () => {
  assert.equal(optionMatch('未排名', '无统计'), true);
  assert.equal(optionMatch('硕士', '无统计'), false);
  assert.equal(optionMatch('金融学', '经济学'), false);
});

test('content sources ship the same closed DEGREE_LEVELS sets', async () => {
  const selectSrc = await readFile(resolve('src/content/cms-education-multi-select.js'), 'utf8');
  const controllerSrc = await readFile(resolve('src/content/cms-record-controller.js'), 'utf8');
  const serialSrc = await readFile(resolve('src/content/cms-education-serialization.mjs'), 'utf8');
  for (const src of [selectSrc, controllerSrc, serialSrc]) {
    assert.match(src, /DEGREE_LEVELS/);
    assert.match(src, /\['硕士','硕士研究生'\]/);
    assert.match(src, /\['本科','大学本科'\]/);
    assert.match(src, /\['博士','博士研究生'\]/);
  }
  assert.match(selectSrc, /implementationRevision:5/);
  assert.match(controllerSrc, /implementationRevision:20/);
});

console.log(JSON.stringify({
  status: 'PASS',
  evidence: 'degree-level closed synonyms: 硕士↔硕士研究生; no cross-level'
}));
