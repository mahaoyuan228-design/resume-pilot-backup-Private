/**
 * Offline fail-closed planner for CMS 现居住地 / 籍贯.
 * Non-unique or unsettled region facts fail closed.
 * No DOM selectors, no Save/submit, no site-support claim.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CMS_QUESTION_PAGE,
  CMS_REGION_FACT_FAIL_CLOSED_REASONS,
  planCmsBasicRegionFacts,
  planCmsRegionFact
} from '../src/profile/site-question-templates.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/cms-region-fact-plan.json'), 'utf8'));
const engineSrc = fs.readFileSync(path.join(root, 'src/content/engine.js'), 'utf8');
const regionSrc = fs.readFileSync(path.join(root, 'src/content/cms-region.js'), 'utf8');

function target(question, sitePageUrl = fixture.page) {
  return {
    question,
    sectionName: fixture.sectionName,
    rowContext: fixture.rowContext,
    sitePageUrl
  };
}

function fact(question, answer, overrides = {}) {
  return {
    question,
    answer,
    sitePageUrl: fixture.page,
    sectionName: fixture.sectionName,
    rowContext: fixture.rowContext,
    ...overrides
  };
}

function profileFrom(question, rows, { confirm = true, answer } = {}) {
  const customAnswers = {};
  if (answer !== undefined) customAnswers[question] = answer;
  const confirmedFields = confirm && rows.length === 1 ? [`customAnswers.${rows[0].question}`] : [];
  return { customFacts: rows, customAnswers, confirmedFields };
}

function assertFailClosed(plan) {
  assert.equal(plan.ok, false);
  assert.equal(plan.status, 'failed');
  assert.equal(plan.supported, false);
  assert.equal(plan.liveSupportClaimed, false);
  assert.equal(plan.fillAllowed, false);
  assert.equal(plan.saveAllowed, false);
  assert.equal(plan.writeAttempted, false);
  assert.equal(plan.softwareClickedSave, false);
  assert.equal(plan.softwareClickedSubmit, false);
  assert.equal(plan.selector, null);
  assert.equal(plan.query, null);
  assert.equal(CMS_REGION_FACT_FAIL_CLOSED_REASONS.includes(plan.reason), true);
  assert.equal(JSON.stringify(plan).includes('已支持'), false);
}

function loadSettle() {
  const start = engineSrc.indexOf('function settleUnresolvedEntry');
  const end = engineSrc.indexOf('const regionLabel');
  assert.ok(start > 0 && end > start);
  return new Function(`${engineSrc.slice(start, end)}\nreturn { settleUnresolvedEntry };`)();
}

test('fixture pins the two basic region questions and the baseline page', () => {
  assert.deepEqual(fixture.questions, ['现居住地', '籍贯']);
  assert.equal(fixture.page, CMS_QUESTION_PAGE);
  assert.equal(fixture.sectionName, '个人基本信息必填');
  assert.equal(fixture.rowContext, 'single');
});

test('absent and duplicate 现居住地/籍贯 facts fail closed as region_fact_not_unique', () => {
  for (const question of fixture.questions) {
    const absent = planCmsRegionFact(profileFrom(question, []), target(question));
    assertFailClosed(absent);
    assert.equal(absent.reason, 'region_fact_not_unique');
    assert.equal(absent.matchCount, 0);

    const pair = JSON.stringify(fixture.pair);
    const other = JSON.stringify({ province: 'Synthetic Province', city: 'Synthetic City B' });
    const duplicated = planCmsRegionFact(profileFrom(question, [
      fact(question, pair),
      fact(question, other)
    ], { confirm: false }), target(question));
    assertFailClosed(duplicated);
    assert.equal(duplicated.reason, 'region_fact_not_unique');
    assert.equal(duplicated.matchCount, 2);
  }
});

test('unsettled region facts fail closed without a selector or Save', () => {
  const question = '籍贯';
  const pair = JSON.stringify(fixture.pair);
  const saved = fact(question, pair);
  const unconfirmed = planCmsRegionFact(profileFrom(question, [saved], { confirm: false, answer: pair }), target(question));
  assertFailClosed(unconfirmed);
  assert.equal(unconfirmed.reason, 'region_fact_unconfirmed');

  const malformed = planCmsRegionFact(profileFrom(question, [fact(question, 'Synthetic City')], { answer: 'Synthetic City' }), target(question));
  assertFailClosed(malformed);
  assert.equal(malformed.reason, 'explicit_region_pair_required');

  const extra = JSON.stringify({ ...fixture.pair, code: 'invented' });
  const coded = planCmsRegionFact(profileFrom(question, [fact(question, extra)], { answer: extra }), target(question));
  assertFailClosed(coded);
  assert.equal(coded.reason, 'explicit_region_pair_required');

  const mismatched = planCmsRegionFact(
    profileFrom(question, [fact(question, pair, { sitePageUrl: fixture.otherPage })], { answer: pair }),
    target(question)
  );
  assertFailClosed(mismatched);
  assert.equal(mismatched.reason, 'region_fact_scope_mismatch');
});

test('one settled region fact is ready for the existing adapter and still cannot Save', () => {
  const question = '现居住地';
  const pair = JSON.stringify(fixture.pair);
  const plan = planCmsRegionFact(profileFrom(question, [fact(question, pair)], { answer: pair }), target(question));
  assert.equal(plan.ok, true);
  assert.equal(plan.status, 'ready');
  assert.equal(plan.reason, 'region_fact_settled');
  assert.equal(plan.matchCount, 1);
  assert.equal(plan.fillAllowed, false);
  assert.equal(plan.saveAllowed, false);
  assert.equal(plan.softwareClickedSave, false);
  assert.equal(plan.softwareClickedSubmit, false);
  assert.equal(plan.selector, null);
  assert.equal(plan.supported, false);
  assert.equal(plan.liveSupportClaimed, false);
  assert.deepEqual(
    { province: plan.fact.province, city: plan.fact.city },
    fixture.pair
  );
});

test('basic region plan fails closed while either 现居住地 or 籍贯 is unsettled', () => {
  const empty = planCmsBasicRegionFacts({ customFacts: [], customAnswers: {}, confirmedFields: [] }, fixture.page);
  assert.equal(empty.ok, false);
  assert.equal(empty.reason, 'region_fact_not_unique');
  assert.equal(empty.saveAllowed, false);
  assert.equal(empty.selector, null);
  assert.equal(empty.plans.length, 2);
  assert.deepEqual(empty.plans.map(plan => plan.question), fixture.questions);
});

test('fill loop fails closed on region fact reasons and still fails duplicate_target', () => {
  const { settleUnresolvedEntry } = loadSettle();
  for (const reason of CMS_REGION_FACT_FAIL_CLOSED_REASONS) {
    assert.equal(settleUnresolvedEntry({ kind: 'cms_region' }, reason), 'failed');
  }
  assert.equal(settleUnresolvedEntry({ kind: 'cms_region' }, 'existing_value'), 'skipped');
  assert.equal(settleUnresolvedEntry({ kind: 'cms_region' }, 'control_guard'), 'skipped');
  assert.equal(settleUnresolvedEntry({ kind: 'cms_ant_v3_select' }, 'duplicate_target'), 'failed');
  assert.equal(settleUnresolvedEntry({ kind: 'cms_ant_v3_select' }, 'missing_profile_value'), 'skipped');
  assert.match(engineSrc, /result\.status = settleUnresolvedEntry\(entry, fresh\.reason\);/);
  assert.match(regionSrc, /status:'failed',reason:'unconfirmed_or_incomplete_region_pair'/);
  assert.match(regionSrc, /reason:'region_fact_not_unique'/);
  assert.equal(regionSrc.includes('已支持'), false);
  assert.equal(engineSrc.includes('softwareClickedSave:true'), false);
});
