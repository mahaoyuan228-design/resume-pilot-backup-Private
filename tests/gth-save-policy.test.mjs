/**
 * GTH Save policy scaffolding:
 * - deferred → saveAllowedByPolicy always false
 * - dry-run may report readyToSave=true without clicking Save
 * - auto reports must never claim Save
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateGthSavePolicy,
  gthSaveDryRunStatus,
  gthSaveDryRunZhSummary,
  gthSaveDryRunUiHint,
  assertAutoNeverAttemptedSave,
  GTH_SAVE_DEFERRED_REASON,
} from '../src/background/gth-save-policy.mjs';

test('evaluateGthSavePolicy is deferred fail-closed even when all signals green', () => {
  const policy = evaluateGthSavePolicy({
    cmsEducationClosedLoopEvidence: true,
    draftReadyToSave: true,
    softwareClickedSave: false,
    jeremyOneShotExplicitOk: true,
    fromAutoPath: false,
  });
  assert.equal(policy.saveAllowedByPolicy, false);
  assert.equal(policy.deferred, true);
  assert.equal(policy.reason, GTH_SAVE_DEFERRED_REASON);
  assert.equal(policy.conditions.draftReadyToSave, true);
});

test('auto path reports saveAllowedByPolicy false', () => {
  const policy = evaluateGthSavePolicy({ fromAutoPath: true, draftReadyToSave: true });
  assert.equal(policy.saveAllowedByPolicy, false);
});

test('dry-run keeps readyToSave true while wouldClickSave stays false', () => {
  const dry = gthSaveDryRunStatus({
    readyToSave: true,
    softwareClickedSave: false,
    saveAttempted: false,
    fromAutoPath: true,
  });
  assert.equal(dry.readyToSave, true);
  assert.equal(dry.saveAllowedByPolicy, false);
  assert.equal(dry.wouldClickSave, false);
  assert.equal(dry.saveAttempted, false);
  assert.equal(dry.policy.reason, GTH_SAVE_DEFERRED_REASON);
});

test('assertAutoNeverAttemptedSave accepts clean auto report', () => {
  const report = {
    saveAttempted: false,
    saveAllowedByPolicy: false,
    draft: { readyToSave: true, softwareClickedSave: false, saveAttempted: false },
  };
  assert.equal(assertAutoNeverAttemptedSave(report), report);
});

test('assertAutoNeverAttemptedSave rejects saveAttempted / policy true', () => {
  assert.throws(
    () => assertAutoNeverAttemptedSave({ saveAttempted: true }),
    /gth_auto_save_attempted_forbidden/,
  );
  assert.throws(
    () => assertAutoNeverAttemptedSave({ saveAttempted: false, saveAllowedByPolicy: true }),
    /gth_auto_save_policy_true_forbidden_while_deferred/,
  );
  assert.throws(
    () => assertAutoNeverAttemptedSave({
      saveAttempted: false,
      saveAllowedByPolicy: false,
      draft: { softwareClickedSave: true },
    }),
    /gth_auto_draft_clicked_save_forbidden/,
  );
});

test('dry-run zhSummary / uiHint clarify ready ≠ wouldClickSave while deferred', () => {
  const dry = gthSaveDryRunStatus({
    readyToSave: true,
    softwareClickedSave: false,
    saveAttempted: false,
    fromAutoPath: true,
  });
  assert.equal(dry.wouldClickSave, false);
  assert.equal(dry.deferred, true);
  assert.match(dry.zhSummary, /草稿检查已通过|暂缓/);
  assert.match(dry.zhSummary, /不会点保存|手动保存/);
  assert.match(dry.uiHint, /暂缓|不会自动点保存|手动保存/);
  assert.equal(gthSaveDryRunZhSummary({ readyToSave: false }).includes('尚未通过'), true);
  assert.match(gthSaveDryRunUiHint({ readyToSave: true, deferred: true }), /暂缓/);
});
