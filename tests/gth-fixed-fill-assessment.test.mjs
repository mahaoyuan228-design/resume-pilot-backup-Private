import test from 'node:test';
import assert from 'node:assert/strict';
import { assessGthSkillsFill, assessGthOtherFill } from '../src/background/gth-open-fills.mjs';

// Response-only variants of the shipped fixed-field writer contract exercised
// in gth-open-sections.test.mjs. No new page or control shapes are introduced.
const sections = [
  {
    name: 'skills',
    section: '职业技能与特长',
    scope: 'gth_skills_one',
    questions: ['职业技能与特长'],
    assess: assessGthSkillsFill,
    invalidReason: 'gth_skills_fill_invalid',
  },
  {
    name: 'other',
    section: '其他信息',
    scope: 'gth_other_two',
    questions: ['标题', '描述'],
    assess: assessGthOtherFill,
    invalidReason: 'gth_other_fill_invalid',
  },
];

function verifiedResponse(spec, reason = 'preexisting_same_value') {
  const writeStarted = reason !== 'preexisting_same_value';
  return {
    ok: true,
    complete: false,
    scope: spec.scope,
    section: spec.section,
    supportedComplete: true,
    operableComplete: true,
    writeStarted,
    editorLeftOpen: true,
    savedOnSite: null,
    submitted: null,
    softwareClickedSave: false,
    softwareClickedSubmit: false,
    softwareClickedDelete: false,
    liveSupportClaimed: false,
    reason: null,
    fields: spec.questions.map((question) => ({
      id: `gth:${spec.section}:${question}`,
      question,
      labels: [question],
      path: `customAnswers.${question}`,
      status: 'verified',
      reason,
      supported: true,
    })),
  };
}

function assertNeverSaveAssessment(result) {
  assert.equal(result.complete, false);
  assert.equal(result.softwareClickedSave, false);
  assert.equal(result.softwareClickedSubmit, false);
  assert.equal(result.softwareClickedDelete, false);
  assert.equal(result.savedOnSite, false);
  assert.equal(result.submitted, false);
}

for (const spec of sections) {
  for (const reason of ['preexisting_same_value', 'readback_matched', 'readback_reapplied']) {
    test(`GTH ${spec.name} assessment accepts consistent ${reason} without Save`, () => {
      const response = verifiedResponse(spec, reason);
      const result = spec.assess(response);
      assert.equal(result.ok, true);
      assert.equal(result.reason, null);
      assert.equal(result.supportedComplete, true);
      assert.equal(result.operableComplete, true);
      assert.equal(result.writeStarted, response.writeStarted);
      assert.equal(result.outcome, response.writeStarted ? 'verified' : 'verified_preexisting');
      assert.equal(response.liveSupportClaimed, false);
      assertNeverSaveAssessment(result);
    });
  }

  test(`GTH ${spec.name} assessment rejects an explicitly unsupported verified row`, () => {
    const response = verifiedResponse(spec);
    response.fields[0].supported = false;
    const result = spec.assess(response);
    assert.equal(result.ok, false);
    assert.equal(result.reason, spec.invalidReason);
    assert.equal(result.supportedComplete, false);
    assert.equal(result.operableComplete, false);
    assert.equal(result.outcome, 'failed_before_write');
    assertNeverSaveAssessment(result);
  });

  test(`GTH ${spec.name} assessment rejects a response for the other fixed section`, () => {
    const response = verifiedResponse(spec);
    response.section = sections.find((item) => item.name !== spec.name).section;
    const result = spec.assess(response);
    assert.equal(result.ok, false);
    assert.equal(result.reason, spec.invalidReason);
    assert.equal(result.supportedComplete, false);
    assert.equal(result.operableComplete, false);
    assertNeverSaveAssessment(result);
  });

  for (const [key, reason] of [['reason', 'readback_mismatch'], ['error', 'fill_failed']]) {
    test(`GTH ${spec.name} assessment rejects explicit ${key} with verified rows`, () => {
      const response = verifiedResponse(spec);
      response[key] = reason;
      const result = spec.assess(response);
      assert.equal(result.ok, false);
      assert.equal(result.reason, reason);
      assert.equal(result.supportedComplete, false);
      assert.equal(result.operableComplete, false);
      assertNeverSaveAssessment(result);
    });
  }
}
