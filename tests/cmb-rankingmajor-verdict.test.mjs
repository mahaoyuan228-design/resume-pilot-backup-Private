/**
 * Offline guard for RankingMajor verdict literals.
 * Does not probe DOM, fill, or click. Does not claim the site supported.
 * Recorded verdict stays DOM_CONTROL_MISSING. Never Save.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CMB_RANKINGMAJOR_RECORDED_VERDICT,
  CMB_RANKINGMAJOR_VERDICT_CODES,
  DOM_CONTROL_AMBIGUOUS,
  DOM_CONTROL_MISSING,
  DOM_CONTROL_PRESENT,
  PROBE_INCONCLUSIVE,
  isCmbRankingMajorVerdictCode
} from '../src/content/cmb-rankingmajor-verdict.mjs';

const EXPECTED = [
  'DOM_CONTROL_PRESENT',
  'DOM_CONTROL_MISSING',
  'DOM_CONTROL_AMBIGUOUS',
  'PROBE_INCONCLUSIVE'
];

const root = resolve('.');
const moduleSource = readFileSync(resolve(root, 'src/content/cmb-rankingmajor-verdict.mjs'), 'utf8');
const engineSource = readFileSync(resolve(root, 'src/content/cmb-basic.js'), 'utf8');
const harness = readFileSync(resolve(root, 'scripts/auto-cmb-basic.mjs'), 'utf8');
const probePack = readFileSync(resolve(root, 'dist/site-probes/CMB_RANKINGMAJOR_PROBE_PACK_20261019.md'), 'utf8');

test('RankingMajor verdict codes are exactly the four mutually exclusive literals', () => {
  assert.deepEqual([...CMB_RANKINGMAJOR_VERDICT_CODES], EXPECTED);
  assert.deepEqual(
    [DOM_CONTROL_PRESENT, DOM_CONTROL_MISSING, DOM_CONTROL_AMBIGUOUS, PROBE_INCONCLUSIVE],
    EXPECTED
  );
  assert.equal(new Set(CMB_RANKINGMAJOR_VERDICT_CODES).size, EXPECTED.length);
  assert.equal(Object.isFrozen(CMB_RANKINGMAJOR_VERDICT_CODES), true);
  for (const code of CMB_RANKINGMAJOR_VERDICT_CODES) {
    assert.equal(typeof code, 'string');
    assert.equal(code, code.trim());
    assert.equal(isCmbRankingMajorVerdictCode(code), true);
  }
  for (let i = 0; i < EXPECTED.length; i += 1) {
    for (let j = i + 1; j < EXPECTED.length; j += 1) {
      assert.notEqual(EXPECTED[i], EXPECTED[j]);
    }
  }
  for (const outsider of ['CONTROL_FOUND', 'LABEL_ONLY', 'AMBIGUOUS', 'PRESENT', 'MISSING', '', 'DOM_CONTROL_MISSING ']) {
    assert.equal(isCmbRankingMajorVerdictCode(outsider), false);
  }
});

test('recorded RankingMajor verdict stays DOM_CONTROL_MISSING', () => {
  assert.equal(CMB_RANKINGMAJOR_RECORDED_VERDICT, 'DOM_CONTROL_MISSING');
  assert.equal(CMB_RANKINGMAJOR_RECORDED_VERDICT, DOM_CONTROL_MISSING);
  assert.equal(isCmbRankingMajorVerdictCode(CMB_RANKINGMAJOR_RECORDED_VERDICT), true);
  assert.match(probePack, /状态：`DOM_CONTROL_MISSING`/);
  assert.match(harness, /RankingMajor is DOM_CONTROL_MISSING/);
  for (const code of EXPECTED) {
    assert.match(probePack, new RegExp('`' + code + '`'));
  }
});

test('verdict module is constants only and is not wired into fill', () => {
  assert.doesNotMatch(moduleSource, /document|querySelector|click\(|fillBasic|ant-picker|日历|保存|提交|投递/);
  assert.doesNotMatch(engineSource, /cmb-rankingmajor-verdict|CMB_RANKINGMAJOR_VERDICT|RankingMajor|rankingMajor/);
  assert.match(moduleSource, /Never Save/);
});
