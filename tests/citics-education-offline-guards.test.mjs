/**
 * Offline synthetic guards for CITICS 学历 vs 学位.
 * Does not harvest options or claim the site supported.
 * Education stays live_education_options_unharvested. Never Save.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CITICS_EDUCATION_RECORDED_STATUS,
  CITICS_EDU_DEGREE_NON_EQUIVALENTS,
  CITICS_EDU_GUARD_AMBIGUOUS,
  CITICS_EDU_GUARD_CONTROL_UNAVAILABLE,
  CITICS_EDU_GUARD_CROSS_FIELD,
  CITICS_EDU_GUARD_EMPTY,
  CITICS_EDU_GUARD_EXACT,
  CITICS_EDU_GUARD_REASONS,
  CITICS_EDU_GUARD_RULE_MISSING,
  CITICS_EDU_GUARD_UNKNOWN,
  CITICS_EDU_NEVER_SAVE,
  createCiticsEduSaveProbe,
  guardCiticsEduSegments,
  guardCiticsEduValue,
  runCiticsEduGuardProbe
} from '../src/content/citics-education-map-guards.mjs';

const root = resolve('.');
const moduleSource = readFileSync(resolve(root, 'src/content/citics-education-map-guards.mjs'), 'utf8');
const engineSource = readFileSync(resolve(root, 'src/content/citics-basic.js'), 'utf8');
const harness = readFileSync(resolve(root, 'scripts/auto-citics-basic.mjs'), 'utf8');
const priority = readFileSync(resolve(root, 'dist/site-probes/CITICS_NEXT_LIVE_PRIORITY_20261019.md'), 'utf8');

const DEGREE_OPTIONS = ['学士', '硕士学位'];
const EDUCATION_OPTIONS = ['本科', '研究生'];

test('education and degree labels stay mutually exclusive and do not cross-map', () => {
  assert.deepEqual(
    CITICS_EDU_DEGREE_NON_EQUIVALENTS.map((pair) => [pair.education, pair.degree]),
    [['本科', '学士'], ['研究生', '硕士学位']]
  );
  const bachelor = guardCiticsEduValue({ field: 'degree', value: '本科', options: DEGREE_OPTIONS });
  assert.equal(bachelor.ok, false);
  assert.equal(bachelor.reason, CITICS_EDU_GUARD_CROSS_FIELD);
  assert.equal(bachelor.value, '');
  assert.notEqual(bachelor.value, '学士');

  const graduate = guardCiticsEduValue({ field: 'degree', value: '研究生', options: DEGREE_OPTIONS });
  assert.equal(graduate.reason, CITICS_EDU_GUARD_CROSS_FIELD);
  assert.notEqual(graduate.value, '硕士学位');

  const degreeAsEducation = guardCiticsEduValue({ field: 'education', value: '学士', options: EDUCATION_OPTIONS });
  assert.equal(degreeAsEducation.reason, CITICS_EDU_GUARD_CROSS_FIELD);
  assert.notEqual(degreeAsEducation.value, '本科');

  const sameField = guardCiticsEduValue({ field: 'education', value: ' 本科 ', options: EDUCATION_OPTIONS });
  assert.equal(sameField.ok, true);
  assert.equal(sameField.reason, CITICS_EDU_GUARD_EXACT);
  assert.equal(sameField.value, '本科');
  assert.notEqual(sameField.value, '学士');
});

test('empty, unknown, ambiguous, and disabled values stop without a write', () => {
  for (const value of ['', '   ', null]) {
    const empty = guardCiticsEduValue({ field: 'education', value, options: EDUCATION_OPTIONS });
    assert.equal(empty.reason, CITICS_EDU_GUARD_EMPTY);
    assert.equal(empty.writeAttempted, false);
    assert.equal(empty.saved, false);
  }

  const alias = guardCiticsEduValue({ field: 'education', value: '大学本科', options: EDUCATION_OPTIONS });
  assert.equal(alias.reason, CITICS_EDU_GUARD_UNKNOWN);
  assert.equal(alias.value, '');

  const missing = guardCiticsEduValue({ field: 'education', value: '大专', options: EDUCATION_OPTIONS });
  assert.equal(missing.reason, CITICS_EDU_GUARD_UNKNOWN);

  const duplicate = guardCiticsEduValue({ field: 'education', value: '本科', options: ['本科', '本科'] });
  assert.equal(duplicate.reason, CITICS_EDU_GUARD_AMBIGUOUS);
  assert.equal(duplicate.value, '');

  const disabled = guardCiticsEduValue({ field: 'education', value: '本科', options: EDUCATION_OPTIONS, disabled: true });
  assert.equal(disabled.reason, CITICS_EDU_GUARD_CONTROL_UNAVAILABLE);
  assert.equal(disabled.writeAttempted, false);

  const segments = guardCiticsEduSegments({ segments: ['本科', '研究生'], rule: '最高学历' });
  assert.equal(segments.reason, CITICS_EDU_GUARD_RULE_MISSING);
  assert.equal(segments.value, '');
  assert.equal(new Set(CITICS_EDU_GUARD_REASONS).size, CITICS_EDU_GUARD_REASONS.length);
});

test('Never Save probe stays at zero and education remains live-blocked', () => {
  const probe = createCiticsEduSaveProbe();
  const cases = [
    { field: 'degree', value: '本科', options: DEGREE_OPTIONS },
    { field: 'education', value: '本科', options: EDUCATION_OPTIONS },
    { field: 'education', value: '', options: EDUCATION_OPTIONS },
    { segments: ['本科', '研究生'] }
  ];
  for (const input of cases) {
    const row = runCiticsEduGuardProbe(input, probe);
    assert.equal(row.saveCalls, 0);
    assert.equal(row.submitCalls, 0);
    assert.equal(row.saved, false);
    assert.equal(row.skippedSave, true);
    assert.equal(row.synthetic, true);
    assert.equal(row.liveFillClaimed, false);
    assert.equal(row.optionsHarvested, false);
    assert.equal(row.status, 'live_education_options_unharvested');
  }
  assert.equal(probe.calls.save, 0);
  assert.equal(probe.calls.submit, 0);
  assert.deepEqual(CITICS_EDU_NEVER_SAVE, { saveCalls: 0, submitCalls: 0, skippedSave: true });
  assert.equal(CITICS_EDUCATION_RECORDED_STATUS, 'live_education_options_unharvested');
  assert.match(priority, /live_education_options_unharvested/);
  assert.match(priority, /户口类型[\s\S]*证件类型[\s\S]*民族/);
  assert.doesNotMatch(moduleSource, /document|querySelector|click\(|fillSelect|保存|提交/);
  assert.doesNotMatch(engineSource, /citics-education-map-guards|CITICS_EDU_GUARD|学历|educationLevel/);
  assert.doesNotMatch(harness, /citics-education-map-guards/);
  assert.match(harness, /live_education_options_unharvested/);
});
