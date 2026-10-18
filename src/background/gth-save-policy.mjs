// GTH draft Save policy gate (narrow ship).
// Auto / agent paths must never click Save until this returns allowed:true
// AND product one-shot rules in GTH_EDUCATION_READINESS.md say OK.
// Currently deferred: always deny. CMS education closed-loop evidence ranks first.

export const GTH_SAVE_POLICY_VERSION = 1;
export const GTH_SAVE_DEFERRED_REASON = 'gth_save_deferred_until_cms_closed_loop_and_jeremy_oneshot';

/**
 * Conditions that must ALL be true before Save is allowed by policy.
 * Documented for dry-run / inspect; evaluateGthSavePolicy currently forces deny.
 */
export const GTH_SAVE_REQUIRED_CONDITIONS = Object.freeze([
  'cms_education_closed_loop_evidence',
  'draft_ready_to_save',
  'software_has_not_clicked_save',
  'jeremy_oneshot_explicit_ok',
  'not_auto_path_unless_policy_flipped',
]);

/**
 * Evaluate whether GTH draft Save is allowed.
 * Fail-closed: any missing/false signal → deny. Auto path always deny today.
 *
 * @param {object} [context]
 * @param {boolean} [context.cmsEducationClosedLoopEvidence]
 * @param {boolean} [context.draftReadyToSave]
 * @param {boolean} [context.softwareClickedSave]
 * @param {boolean} [context.jeremyOneShotExplicitOk]
 * @param {boolean} [context.fromAutoPath] default true for auto runners
 * @returns {{saveAllowedByPolicy:boolean,reason:string,conditions:object,version:number}}
 */
export function evaluateGthSavePolicy(context = {}) {
  const conditions = {
    cmsEducationClosedLoopEvidence: context.cmsEducationClosedLoopEvidence === true,
    draftReadyToSave: context.draftReadyToSave === true,
    softwareHasNotClickedSave: context.softwareClickedSave !== true,
    jeremyOneShotExplicitOk: context.jeremyOneShotExplicitOk === true,
    // Auto path is never Save-authorized while policy is deferred.
    notAutoPathUnlessPolicyFlipped: context.fromAutoPath !== true,
  };
  // Deferred hard gate: never allow until product flips this constant after
  // CMS closed-loop + Jeremy one-shot. Keeps readyToSave inspect usable.
  const deferred = true;
  if (deferred) {
    return {
      version: GTH_SAVE_POLICY_VERSION,
      saveAllowedByPolicy: false,
      reason: GTH_SAVE_DEFERRED_REASON,
      deferred: true,
      conditions,
      required: [...GTH_SAVE_REQUIRED_CONDITIONS],
      note: 'Draft inspect may still set readyToSave=true; Save click stays blocked.',
    };
  }
  const missing = Object.entries(conditions)
    .filter(([, ok]) => ok !== true)
    .map(([key]) => key);
  if (missing.length) {
    return {
      version: GTH_SAVE_POLICY_VERSION,
      saveAllowedByPolicy: false,
      reason: 'gth_save_policy_conditions_unmet',
      deferred: false,
      missing,
      conditions,
      required: [...GTH_SAVE_REQUIRED_CONDITIONS],
    };
  }
  return {
    version: GTH_SAVE_POLICY_VERSION,
    saveAllowedByPolicy: true,
    reason: 'gth_save_policy_ok',
    deferred: false,
    conditions,
    required: [...GTH_SAVE_REQUIRED_CONDITIONS],
  };
}

/**
 * Dry-run view: draft may be readyToSave while policy still denies Save.
 * Used by auto inspect / fill-without-save reports.
 */
export function gthSaveDryRunStatus({
  readyToSave = false,
  softwareClickedSave = false,
  saveAttempted = false,
  fromAutoPath = true,
  cmsEducationClosedLoopEvidence = false,
  jeremyOneShotExplicitOk = false,
} = {}) {
  const policy = evaluateGthSavePolicy({
    draftReadyToSave: readyToSave === true,
    softwareClickedSave: softwareClickedSave === true,
    fromAutoPath,
    cmsEducationClosedLoopEvidence,
    jeremyOneShotExplicitOk,
  });
  const dry = {
    readyToSave: readyToSave === true,
    softwareClickedSave: softwareClickedSave === true,
    saveAttempted: saveAttempted === true,
    saveAllowedByPolicy: policy.saveAllowedByPolicy,
    wouldClickSave: false, // auto never clicks; even when policy flips, one-shot is manual
    deferred: policy.deferred === true,
    policy,
  };
  dry.zhSummary = gthSaveDryRunZhSummary(dry);
  dry.uiHint = gthSaveDryRunUiHint(dry);
  return dry;
}

/**
 * One-line Chinese clarity for popup / auto JSON:
 * readyToSave ≠ wouldClickSave ≠ Jeremy one-shot Save.
 */
export function gthSaveDryRunZhSummary(dry = {}) {
  const ready = dry.readyToSave === true;
  const deferred = dry.deferred === true || dry.policy?.deferred === true;
  const would = dry.wouldClickSave === true;
  const allowed = dry.saveAllowedByPolicy === true;
  if (would || dry.saveAttempted === true || dry.softwareClickedSave === true) {
    return '异常：干跑报告声称已点或将点保存（政策禁止）。';
  }
  if (ready && deferred) {
    return '草稿检查已通过，但保存仍暂缓：自动路径不会点保存；实站仅你醒后显式确认后再手动保存一次。';
  }
  if (ready && !allowed) {
    return '草稿检查已通过，但当前策略不允许软件点击保存。';
  }
  if (ready && allowed && !would) {
    return '草稿检查已通过且策略允许，但仍须人工 one-shot 点击保存（自动路径不会点）。';
  }
  if (!ready) {
    return '草稿尚未通过保存前检查（readyToSave=false）；不会点击保存。';
  }
  return '保存干跑：未点击保存。';
}

/** Short popup-facing hint when draft job.state === ready. */
export function gthSaveDryRunUiHint(dry = {}) {
  if (dry.readyToSave === true && (dry.deferred === true || dry.policy?.deferred === true)) {
    return '检查已通过。当前保存仍暂缓：软件不会自动点保存；醒后按教育草稿就绪说明再决定是否手动保存一次。不会投递。';
  }
  if (dry.readyToSave === true) {
    return '检查已通过。点击保存后，软件只保存一次，再刷新核对这条教育草稿；不会投递岗位。';
  }
  return '教育填写完成后，先检查草稿，再决定是否保存；不会最终投递。';
}

/**
 * Assert an auto report never claimed a Save click.
 * Throws Error with safe snake_case code when violated.
 */
export function assertAutoNeverAttemptedSave(report) {
  if (!report || typeof report !== 'object') return report;
  if (report.saveAttempted === true) throw Error('gth_auto_save_attempted_forbidden');
  if (report.softwareClickedSave === true) throw Error('gth_auto_software_clicked_save_forbidden');
  if (report.draft?.softwareClickedSave === true) throw Error('gth_auto_draft_clicked_save_forbidden');
  if (report.draft?.saveAttempted === true) throw Error('gth_auto_draft_save_attempted_forbidden');
  if (report.saveAllowedByPolicy === true) throw Error('gth_auto_save_policy_true_forbidden_while_deferred');
  return report;
}
