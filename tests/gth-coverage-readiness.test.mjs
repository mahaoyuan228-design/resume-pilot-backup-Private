/**
 * Offline province-trial planner for GTH 现居住地 / 照片.
 * A confirmed plain province can reach the evidenced writer. Unsupported photo
 * and richer residence shapes stay incomplete without claiming live support.
 * No DOM selectors, no Save/submit, no site-support claim.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BASIC_PAGE,
  basicCandidate,
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

  const duplicated = planGthBasicCoverage({
    customFacts: [fact(pair), fact(JSON.stringify({ province: 'Synthetic Province', city: 'Synthetic City B' }))],
    customAnswers: { 现居住地: pair },
    confirmedFields: ['customAnswers.现居住地'],
  }, { fillRequested: true });
  assertNeverFill(duplicated);
  assert.equal(duplicated.fields[0].reason, 'region_fact_not_unique');
  assert.equal(duplicated.fields[0].matchCount, 2);

  const malformed = planGthBasicCoverage({
    customFacts: [fact('北京/朝阳区')],
    customAnswers: { 现居住地: '北京/朝阳区' },
    confirmedFields: ['customAnswers.现居住地'],
  }, { fillRequested: true });
  assertNeverFill(malformed);
  assert.equal(malformed.reason, 'control_not_supported');

  const mismatched = planGthBasicCoverage({
    customFacts: [fact(pair, { sitePageUrl: 'https://hr.gtht.com/other' })],
    customAnswers: { 现居住地: pair },
    confirmedFields: ['customAnswers.现居住地'],
  }, { fillRequested: true });
  assertNeverFill(mismatched);
  assert.equal(mismatched.reason, 'region_fact_scope_mismatch');
});

test('a confirmed province is trial-ready while photo keeps overall coverage incomplete', () => {
  const plan = planGthBasicCoverage({ currentCity: '上海', confirmedFields: ['currentCity'] }, { fillRequested: true });
  const residence = plan.fields.find(row => row.key === 'currentCity');
  assert.equal(residence.status, 'ready');
  assert.equal(residence.supported, true);
  assert.equal(residence.fillAllowed, true);
  assert.equal(residence.reason, 'residence_trial_ready');
  assert.equal(residence.sourcePath, 'currentCity');
  assert.deepEqual(residence.fact, { province: '上海', confirmed: true });
  assert.equal(residence.liveSupportClaimed, false);
  assert.equal(residence.saveAllowed, false);
  assert.equal(residence.writeAttempted, false);
  assert.equal(residence.softwareClickedSave, false);
  assert.equal(residence.softwareClickedSubmit, false);
  assert.equal(residence.softwareClickedDelete, false);
  assert.equal(residence.selector, null);
  assert.equal(residence.query, null);
  assert.equal(plan.reason, 'control_not_supported');
  assert.equal(plan.complete, false);
  assert.equal(plan.fillAllowed, false);
  assert.equal(plan.blocked, true);
  assert.equal(gthRequestedFillBlocksComplete(plan), true);
});

test('candidate and planner use the same exact scoped province fact', () => {
  const profile = {
    education: [{ degree: '硕士' }],
    customFacts: [fact('上海')], customAnswers: { 现居住地: '上海' },
    confirmedFields: ['education.0.degree', 'customAnswers.现居住地'],
  };
  const plan = planGthBasicCoverage(profile);
  assert.equal(plan.fields[0].sourcePath, 'customAnswers.现居住地');
  assert.equal(plan.fields[0].fillAllowed, true);
  const candidate = basicCandidate(profile, 0);
  assert.equal(candidate.profile.currentCity, '上海');
  assert.ok(candidate.profile.confirmedFields.includes('currentCity'));
  assert.equal(candidate.profile.customFacts, undefined, 'candidate carries the selected label only');

  for (const patch of [
    { confirmedFields: ['education.0.degree'] },
    { customFacts: [fact('上海', { sectionName: '求职意向' })] },
    { customFacts: [fact('上海', { sitePageUrl: BASIC_PAGE + '?other' })] },
    { customFacts: [fact('上海', { rowContext: 'row:1' })] },
    { customFacts: [fact('上海'), fact('北京')] },
    { currentCity: '北京', confirmedFields: [...profile.confirmedFields, 'currentCity'] },
  ]) {
    const blocked = { ...profile, ...patch };
    assert.equal(planGthBasicCoverage(blocked).fields[0].fillAllowed, false);
    const projected = basicCandidate(blocked, 0).profile;
    assert.equal(projected.currentCity, '', JSON.stringify(patch));
    assert.ok(!projected.confirmedFields.includes('currentCity'));
  }
});

test('unsupported residence paths and JSON pairs never become a province candidate', () => {
  for (const value of [pair, '北京/朝阳区', '北京||朝阳区', '北京\\朝阳区', '北京>朝阳区']) {
    const profile = { currentCity: value, education: [{ degree: '本科' }], confirmedFields: ['currentCity', 'education.0.degree'] };
    assert.equal(planGthBasicCoverage(profile).fields[0].fillAllowed, false, value);
    assert.equal(basicCandidate(profile, 0).profile.currentCity, '', value);
  }
  const wrongPage = planGthBasicCoverage({ currentCity: '上海', confirmedFields: ['currentCity'] }, { sitePageUrl: 'https://hr.gtht.com/other' });
  assert.equal(wrongPage.fields[0].reason, 'region_fact_scope_mismatch');
  assert.equal(wrongPage.fields[0].fillAllowed, false);
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
