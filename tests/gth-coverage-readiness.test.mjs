/**
 * Offline fail-closed planner for GTH 现居住地 / 照片.
 * Unsupported controls and unsettled region facts are failed, not a completed skip.
 * No DOM selectors, no Save/submit, no site-support claim.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BASIC_PAGE,
  GTH_COVERAGE_FAIL_CLOSED_REASONS,
  gthRequestedFillBlocksComplete,
  planGthBasicCoverage,
  sealGthJobCoverage,
} from '../src/background/basic-task-runner.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const basicSrc = fs.readFileSync(path.join(root, 'src/content/gth-basic.js'), 'utf8');
const autoSrc = fs.readFileSync(path.join(root, 'src/background/gth-basic-auto.mjs'), 'utf8');
const runnerSrc = fs.readFileSync(path.join(root, 'src/background/basic-task-runner.mjs'), 'utf8');
const popupSrc = fs.readFileSync(path.join(root, 'src/popup/gth-basic-actions.js'), 'utf8');

const pair = JSON.stringify({ province: 'Synthetic Province', city: 'Synthetic City' });

function fact(answer, overrides = {}) {
  return {
    question: '现居住地',
    answer,
    sitePageUrl: BASIC_PAGE,
    sectionName: '基本信息',
    rowContext: 'single',
    ...overrides,
  };
}

function assertNeverFill(plan) {
  assert.equal(plan.ok, false);
  assert.equal(plan.complete, false);
  assert.equal(plan.blocked, true);
  assert.equal(plan.fillAllowed, false);
  assert.equal(plan.saveAllowed, false);
  assert.equal(plan.writeAttempted, false);
  assert.equal(plan.liveSupportClaimed, false);
  assert.equal(plan.softwareClickedSave, false);
  assert.equal(plan.softwareClickedSubmit, false);
  assert.equal(plan.softwareClickedDelete, false);
  assert.equal(plan.selector, null);
  assert.equal(plan.query, null);
  assert.equal(GTH_COVERAGE_FAIL_CLOSED_REASONS.includes(plan.reason), true);
  assert.equal(JSON.stringify(plan).includes('已支持'), false);
  for (const field of plan.fields) {
    assert.equal(field.status, 'failed');
    assert.equal(field.supported, false);
    assert.equal(field.selector, null);
    assert.equal(field.fillAllowed, false);
    assert.equal(field.saveAllowed, false);
  }
}

test('absent 现居住地 stays control_not_supported and blocks a requested fill', () => {
  const plan = planGthBasicCoverage({ currentCity: '', confirmedFields: [], customFacts: [] }, { fillRequested: true });
  assertNeverFill(plan);
  assert.equal(plan.reason, 'control_not_supported');
  assert.equal(plan.fields.find((row) => row.key === 'currentCity').factSettled, false);
  assert.equal(plan.fields.find((row) => row.key === 'photo').reason, 'control_not_supported');
  assert.equal(plan.fields.some((row) => row.key === 'workStart'), false);
  assert.equal(gthRequestedFillBlocksComplete(plan), true);
  assert.equal(gthRequestedFillBlocksComplete({ ...plan, fillRequested: false }), false);
});

test('unsupported-control planning cannot overwrite verified workStart month evidence', () => {
  const row = { key: 'workStart', question: '参加工作时间', path: 'workStart', supported: true,
    status: 'verified', reason: 'readback_matched' };
  const plan = planGthBasicCoverage({ workStart: '2022-01', confirmedFields: ['workStart'] }, { fillRequested: true });
  assertNeverFill(plan);
  assert.deepEqual(plan.fields.map(field => field.key), ['currentCity', 'photo']);
  assert.deepEqual(sealGthJobCoverage([row], plan), [row]);
});

test('unsettled 现居住地 facts fail closed without a selector', () => {
  const unconfirmed = planGthBasicCoverage({
    currentCity: '上海',
    confirmedFields: [],
    customFacts: [],
  }, { fillRequested: true });
  assertNeverFill(unconfirmed);
  assert.equal(unconfirmed.reason, 'region_fact_unconfirmed');

  const plain = planGthBasicCoverage({
    currentCity: '上海',
    confirmedFields: ['currentCity'],
    customFacts: [],
  }, { fillRequested: true });
  assertNeverFill(plain);
  assert.equal(plain.reason, 'explicit_region_pair_required');

  const duplicated = planGthBasicCoverage({
    customFacts: [fact(pair), fact(JSON.stringify({ province: 'Synthetic Province', city: 'Synthetic City B' }))],
    customAnswers: { 现居住地: pair },
    confirmedFields: ['customAnswers.现居住地'],
  }, { fillRequested: true });
  assertNeverFill(duplicated);
  assert.equal(duplicated.fields[0].reason, 'region_fact_not_unique');
  assert.equal(duplicated.fields[0].matchCount, 2);

  const malformed = planGthBasicCoverage({
    customFacts: [fact('上海')],
    customAnswers: { 现居住地: '上海' },
    confirmedFields: ['customAnswers.现居住地'],
  }, { fillRequested: true });
  assertNeverFill(malformed);
  assert.equal(malformed.reason, 'explicit_region_pair_required');

  const mismatched = planGthBasicCoverage({
    customFacts: [fact(pair, { sitePageUrl: 'https://hr.gtht.com/other' })],
    customAnswers: { 现居住地: pair },
    confirmedFields: ['customAnswers.现居住地'],
  }, { fillRequested: true });
  assertNeverFill(mismatched);
  assert.equal(mismatched.reason, 'region_fact_scope_mismatch');
});

test('a settled region pair still cannot fill or complete', () => {
  const profile = {
    customFacts: [fact(pair)],
    customAnswers: { 现居住地: pair },
    confirmedFields: ['customAnswers.现居住地'],
  };
  const plan = planGthBasicCoverage(profile, { fillRequested: true, sitePageUrl: BASIC_PAGE });
  assertNeverFill(plan);
  assert.equal(plan.fields[0].factSettled, true);
  assert.equal(plan.fields[0].reason, 'control_not_supported');
  assert.deepEqual(plan.fields[0].fact, { province: 'Synthetic Province', city: 'Synthetic City', confirmed: true });
  assert.equal(gthRequestedFillBlocksComplete(plan), true);
  assert.equal(plan.fields[0].selector, null);
});

test('page coverage and both runners record unsupported rows as failed', () => {
  assert.match(basicSrc, /status:field\.kind==='unsupported'\?'failed':'skipped'/);
  assert.doesNotMatch(basicSrc, /el-cascader|cascader-plugins-wrap/);
  assert.equal(basicSrc.includes('已支持'), false);
  assert.match(autoSrc, /gthRequestedFillBlocksComplete/);
  assert.match(runnerSrc, /gthRequestedFillBlocksComplete\(coveragePlan\)/);
  assert.match(popupSrc, /本次不记为完成，未保存、未提交/);
  assert.equal(popupSrc.includes('已支持'), false);
  assert.equal(autoSrc.includes('已支持'), false);
});
