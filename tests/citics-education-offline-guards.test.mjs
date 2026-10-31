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

function assertNeverSave(row) {
  for (const key of ['saveCalls', 'submitCalls', 'nextCalls', 'deliverCalls', 'deleteCalls']) {
    assert.equal(row[key], 0, key);
  }
  for (const key of ['saved', 'writeAttempted', 'liveEdge', 'formFillClaimed', 'liveFillClaimed', 'liveSupportClaimed', 'supportClaimed',
    'softwareClickedSave', 'softwareClickedSubmit', 'softwareClickedNext', 'softwareClickedDeliver', 'softwareClickedDelete', 'optionsHarvested']) {
    assert.equal(row[key], false, key);
  }
  assert.equal(row.skippedSave, true);
  assert.equal(row.neverSave, true);
  assert.equal(row.leftUnsaved, true);
  assert.equal(row.synthetic, true);
  assert.equal(row.status, 'live_education_options_unharvested');
}

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

test('wrong-field labels remain refused even when caller options contain them', () => {
  for (const [field, value] of [
    ['degree', '本科'],
    ['degree', '研究生'],
    ['education', '学士'],
    ['education', '硕士学位']
  ]) {
    for (const options of [[value], [value, value]]) {
      const row = guardCiticsEduValue({ field, value: ` ${value} `, options });
      assert.equal(row.ok, false);
      assert.equal(row.reason, CITICS_EDU_GUARD_CROSS_FIELD);
      assert.equal(row.value, '');
      assertNeverSave(row);
    }
  }
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

test('single education row requires independent synthetic options and preserves input', () => {
  const input = Object.freeze({
    segments: Object.freeze([' 本科 ']),
    options: Object.freeze(['本科', '研究生']),
    neighbor: Object.freeze({ degree: '学士', school: 'untouched' })
  });
  const before = JSON.stringify(input);
  const exact = guardCiticsEduSegments(input);
  assert.equal(exact.ok, true);
  assert.equal(exact.reason, CITICS_EDU_GUARD_EXACT);
  assert.equal(exact.value, '本科');
  assert.equal(JSON.stringify(input), before);
  assertNeverSave(exact);

  for (const request of [
    { segments: ['本科'] },
    { segments: ['大学本科'] },
    { segments: ['大学本科'], options: EDUCATION_OPTIONS },
    { segments: ['大专'], options: EDUCATION_OPTIONS }
  ]) {
    const row = guardCiticsEduSegments(request);
    assert.equal(row.ok, false);
    assert.equal(row.reason, CITICS_EDU_GUARD_UNKNOWN);
    assert.equal(row.value, '');
    assertNeverSave(row);
  }

  for (const options of [EDUCATION_OPTIONS, ['学士']]) {
    const row = guardCiticsEduSegments({ segments: ['学士'], options });
    assert.equal(row.reason, CITICS_EDU_GUARD_CROSS_FIELD);
    assertNeverSave(row);
  }
  const empty = guardCiticsEduSegments({ segments: [' '], options: EDUCATION_OPTIONS });
  assert.equal(empty.reason, CITICS_EDU_GUARD_EMPTY);
  assertNeverSave(empty);
  const duplicate = guardCiticsEduSegments({ segments: ['本科'], options: ['本科', ' 本科 '] });
  assert.equal(duplicate.reason, CITICS_EDU_GUARD_AMBIGUOUS);
  assertNeverSave(duplicate);
  const disabled = guardCiticsEduSegments({ segments: ['本科'], options: EDUCATION_OPTIONS, disabled: true });
  assert.equal(disabled.reason, CITICS_EDU_GUARD_CONTROL_UNAVAILABLE);
  assertNeverSave(disabled);
});

test('malformed values, options, and education rows fail closed without coercion', () => {
  const hostile = { toString() { throw new Error('must not coerce malformed facts'); } };
  for (const value of [42, true, {}, ['本科'], hostile]) {
    const row = guardCiticsEduValue({ field: 'education', value, options: ['本科', '42', 'true', '[object Object]'] });
    assert.equal(row.reason, CITICS_EDU_GUARD_UNKNOWN);
    assert.equal(row.value, '');
    assertNeverSave(row);
  }
  for (const options of [undefined, null, '本科', {}, [42], ['本科', null], ['本科', {}], ['本科', ''], ['本科', ,]]) {
    const row = guardCiticsEduValue({ field: 'education', value: '本科', options });
    assert.equal(row.reason, CITICS_EDU_GUARD_UNKNOWN);
    assertNeverSave(row);
  }
  for (const segments of [null, '本科', {}, [null], [undefined], [42], [{}], [['本科']], [hostile], new Array(1)]) {
    const row = runCiticsEduGuardProbe({ segments, options: EDUCATION_OPTIONS });
    assert.equal(row.reason, CITICS_EDU_GUARD_UNKNOWN);
    assert.equal(row.value, '');
    assertNeverSave(row);
  }
  for (const input of [null, [], '本科', 42]) {
    for (const guard of [guardCiticsEduValue, guardCiticsEduSegments]) {
      const row = guard(input);
      assert.equal(row.reason, CITICS_EDU_GUARD_UNKNOWN);
      assertNeverSave(row);
    }
  }
});

test('multiple education rows never infer highest or latest from a supplied rule', () => {
  for (const rule of [undefined, '最高学历', '最近经历', { index: 0 }]) {
    const row = guardCiticsEduSegments({ segments: ['本科', '研究生'], options: EDUCATION_OPTIONS, rule });
    assert.equal(row.reason, CITICS_EDU_GUARD_RULE_MISSING);
    assert.equal(row.value, '');
    assertNeverSave(row);
  }
});

test('Never Save probe stays at zero and education remains live-blocked', () => {
  const probe = createCiticsEduSaveProbe();
  const cases = [
    { field: 'degree', value: '本科', options: DEGREE_OPTIONS },
    { field: 'education', value: '本科', options: EDUCATION_OPTIONS },
    { field: 'education', value: '', options: EDUCATION_OPTIONS },
    { segments: ['本科', '研究生'] },
    { segments: ['本科'], options: EDUCATION_OPTIONS },
    { segments: ['学士'], options: ['学士'] },
    { segments: [{}], options: EDUCATION_OPTIONS }
  ];
  for (const input of cases) {
    const row = runCiticsEduGuardProbe(input, probe);
    assertNeverSave(row);
  }
  assert.deepEqual(probe.calls, { save: 0, submit: 0, next: 0, deliver: 0, delete: 0 });
  assert.deepEqual(CITICS_EDU_NEVER_SAVE, {
    neverSave: true, leftUnsaved: true, saved: false,
    softwareClickedSave: false, softwareClickedSubmit: false, softwareClickedNext: false,
    softwareClickedDeliver: false, softwareClickedDelete: false,
    saveCalls: 0, submitCalls: 0, nextCalls: 0, deliverCalls: 0, deleteCalls: 0, skippedSave: true
  });
  assert.equal(CITICS_EDUCATION_RECORDED_STATUS, 'live_education_options_unharvested');
  assert.match(priority, /live_education_options_unharvested/);
  assert.match(priority, /户口类型[\s\S]*证件类型[\s\S]*民族/);
  assert.doesNotMatch(moduleSource, /document|querySelector|click\(|fillSelect|保存|提交/);
  assert.doesNotMatch(engineSource, /citics-education-map-guards|CITICS_EDU_GUARD|学历|educationLevel/);
  assert.doesNotMatch(harness, /citics-education-map-guards/);
  assert.match(harness, /live_education_options_unharvested/);
});
