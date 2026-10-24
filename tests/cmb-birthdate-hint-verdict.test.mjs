/**
 * Offline guard for birth-date hint verdict literals.
 * Does not probe DOM, fill, or open a calendar. Does not claim the site supported.
 * Recorded verdict stays datepicker_hint_only. RankingMajor stays DOM_CONTROL_MISSING.
 * Never Save.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CMB_BIRTHDATE_HINT_VERDICT_CODES,
  CMB_BIRTHDATE_RECORDED_VERDICT,
  DATEPICKER_HINT_ONLY,
  DOB_CONTROL_UNOBSERVED,
  DOB_FORMAT_UNVERIFIED,
  DOB_HINT_AMBIGUOUS,
  DOB_HINT_MISSING,
  isCmbBirthDateHintVerdictCode
} from '../src/content/cmb-birthdate-hint-verdict.mjs';
import { CMB_RANKINGMAJOR_RECORDED_VERDICT } from '../src/content/cmb-rankingmajor-verdict.mjs';

const EXPECTED = [
  'datepicker_hint_only',
  'DOB_HINT_MISSING',
  'DOB_HINT_AMBIGUOUS',
  'DOB_CONTROL_UNOBSERVED',
  'DOB_FORMAT_UNVERIFIED'
];

const root = resolve('.');
const moduleSource = readFileSync(resolve(root, 'src/content/cmb-birthdate-hint-verdict.mjs'), 'utf8');
const engineSource = readFileSync(resolve(root, 'src/content/cmb-basic.js'), 'utf8');
const harness = readFileSync(resolve(root, 'scripts/auto-cmb-basic.mjs'), 'utf8');
const hintNext = readFileSync(resolve(root, 'dist/site-probes/CMB_BIRTHDATE_HINT_NEXT_20261019.md'), 'utf8');

test('birthDate hint verdict codes are exactly the five mutually exclusive literals', () => {
  assert.deepEqual([...CMB_BIRTHDATE_HINT_VERDICT_CODES], EXPECTED);
  assert.deepEqual(
    [DATEPICKER_HINT_ONLY, DOB_HINT_MISSING, DOB_HINT_AMBIGUOUS, DOB_CONTROL_UNOBSERVED, DOB_FORMAT_UNVERIFIED],
    EXPECTED
  );
  assert.equal(new Set(CMB_BIRTHDATE_HINT_VERDICT_CODES).size, EXPECTED.length);
  assert.equal(Object.isFrozen(CMB_BIRTHDATE_HINT_VERDICT_CODES), true);
  for (const code of CMB_BIRTHDATE_HINT_VERDICT_CODES) {
    assert.equal(typeof code, 'string');
    assert.equal(code, code.trim());
    assert.equal(isCmbBirthDateHintVerdictCode(code), true);
  }
  for (let i = 0; i < EXPECTED.length; i += 1) {
    for (let j = i + 1; j < EXPECTED.length; j += 1) {
      assert.notEqual(EXPECTED[i], EXPECTED[j]);
    }
  }
  for (const outsider of ['profile_fact_unconfirmed', 'CONTROL_FOUND', 'DOM_CONTROL_MISSING', '', 'datepicker_hint_only ', 'DOB_HINT_MISSING ']) {
    assert.equal(isCmbBirthDateHintVerdictCode(outsider), false);
  }
});

test('recorded birthDate verdict stays datepicker_hint_only', () => {
  assert.equal(CMB_BIRTHDATE_RECORDED_VERDICT, 'datepicker_hint_only');
  assert.equal(CMB_BIRTHDATE_RECORDED_VERDICT, DATEPICKER_HINT_ONLY);
  assert.equal(isCmbBirthDateHintVerdictCode(CMB_BIRTHDATE_RECORDED_VERDICT), true);
  assert.match(hintNext, /现状：`datepicker_hint_only`/);
  assert.match(engineSource, /datepicker_hint_only/);
  assert.match(harness, /datepicker_hint_only/);
  for (const code of EXPECTED) {
    assert.match(hintNext, new RegExp('`' + code + '`'));
  }
});

test('verdict module is constants only and the fill path does not import it for calendar clicks', () => {
  assert.doesNotMatch(moduleSource, /document|querySelector|click\(|fillBasic|ant-picker|ant-calendar|日历|保存|提交|投递/);
  assert.match(moduleSource, /Never Save/);
  assert.doesNotMatch(engineSource, /cmb-birthdate-hint-verdict|CMB_BIRTHDATE_HINT_VERDICT|CMB_BIRTHDATE_RECORDED_VERDICT/);
  assert.doesNotMatch(engineSource, /DOB_HINT_|DOB_CONTROL_|DOB_FORMAT_/);
  assert.match(engineSource, /function fillBirthDate\(/);
  assert.match(engineSource, /#resume_basicInfo_birthday|resume_basicInfo_birthday/);
  assert.match(engineSource, /ant-picker-dropdown/);
  assert.doesNotMatch(engineSource, /click\(.*保存|保存.*\.click/);
  assert.doesNotMatch(harness, /cmb-birthdate-hint-verdict/);
  assert.equal(CMB_RANKINGMAJOR_RECORDED_VERDICT, 'DOM_CONTROL_MISSING');
});
