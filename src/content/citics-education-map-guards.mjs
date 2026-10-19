/**
 * Synthetic CITICS education/degree guards.
 * No live option harvest, no DOM, no fill. Not imported by citics-basic.js.
 * Recorded status stays live_education_options_unharvested.
 * Stop reasons are guard literals, not engine codes.
 * Never Save. 中信 is not supported.
 */

export const CITICS_EDUCATION_RECORDED_STATUS = 'live_education_options_unharvested';

export const CITICS_EDU_GUARD_EMPTY = 'edu_guard_empty';
export const CITICS_EDU_GUARD_UNKNOWN = 'edu_guard_unknown';
export const CITICS_EDU_GUARD_AMBIGUOUS = 'edu_guard_ambiguous';
export const CITICS_EDU_GUARD_CROSS_FIELD = 'edu_guard_cross_field';
export const CITICS_EDU_GUARD_RULE_MISSING = 'edu_guard_rule_missing';
export const CITICS_EDU_GUARD_CONTROL_UNAVAILABLE = 'edu_guard_control_unavailable';
export const CITICS_EDU_GUARD_EXACT = 'edu_guard_exact';

export const CITICS_EDU_GUARD_REASONS = Object.freeze([
  CITICS_EDU_GUARD_EMPTY,
  CITICS_EDU_GUARD_UNKNOWN,
  CITICS_EDU_GUARD_AMBIGUOUS,
  CITICS_EDU_GUARD_CROSS_FIELD,
  CITICS_EDU_GUARD_RULE_MISSING,
  CITICS_EDU_GUARD_CONTROL_UNAVAILABLE,
  CITICS_EDU_GUARD_EXACT
]);

/** Labels that must not substitute for each other. Not a live option list. */
export const CITICS_EDU_DEGREE_NON_EQUIVALENTS = Object.freeze([
  Object.freeze({ education: '本科', degree: '学士' }),
  Object.freeze({ education: '研究生', degree: '硕士学位' })
]);

export const CITICS_EDU_NEVER_SAVE = Object.freeze({
  saveCalls: 0,
  submitCalls: 0,
  skippedSave: true
});

const norm = (value) => String(value ?? '')
  .normalize('NFKC')
  .replace(/[\u200b-\u200d\ufeff]/gu, '')
  .replace(/[\s\u00a0]+/gu, ' ')
  .trim();

function result(ok, reason, value) {
  return {
    ok,
    reason,
    value,
    writeAttempted: false,
    saved: false,
    skippedSave: true,
    saveCalls: CITICS_EDU_NEVER_SAVE.saveCalls,
    submitCalls: CITICS_EDU_NEVER_SAVE.submitCalls,
    synthetic: true,
    liveFillClaimed: false,
    optionsHarvested: false,
    status: CITICS_EDUCATION_RECORDED_STATUS
  };
}

function stop(reason) {
  return result(false, reason, '');
}

function isOtherFieldLabel(field, text) {
  const other = field === 'education' ? 'degree' : 'education';
  return CITICS_EDU_DEGREE_NON_EQUIVALENTS.some((pair) => pair[other] === text);
}

/**
 * Exact same-field match only. A 学历 label is never rewritten as its 学位 pair.
 * `options` is a caller-supplied synthetic list, not a harvested live allowlist.
 */
export function guardCiticsEduValue({ field, value, options, disabled } = {}) {
  if (field !== 'education' && field !== 'degree') return stop(CITICS_EDU_GUARD_UNKNOWN);
  if (disabled === true) return stop(CITICS_EDU_GUARD_CONTROL_UNAVAILABLE);
  const text = norm(value);
  if (!text) return stop(CITICS_EDU_GUARD_EMPTY);
  const list = Array.isArray(options) ? options.map(norm).filter(Boolean) : [];
  const hits = list.filter((option) => option === text);
  if (hits.length > 1) return stop(CITICS_EDU_GUARD_AMBIGUOUS);
  if (hits.length === 1) return result(true, CITICS_EDU_GUARD_EXACT, hits[0]);
  if (isOtherFieldLabel(field, text)) return stop(CITICS_EDU_GUARD_CROSS_FIELD);
  return stop(CITICS_EDU_GUARD_UNKNOWN);
}

/** More than one education row has no offline selection rule. Do not pick 最高 or 最近. */
export function guardCiticsEduSegments({ segments, rule } = {}) {
  const rows = Array.isArray(segments) ? segments : [];
  if (rows.length === 0) return stop(CITICS_EDU_GUARD_EMPTY);
  if (rows.length > 1) {
    void rule;
    return stop(CITICS_EDU_GUARD_RULE_MISSING);
  }
  return guardCiticsEduValue({ field: 'education', value: rows[0], options: [norm(rows[0])] });
}

/** Harness stub. Guard runs must not call save or submit. */
export function createCiticsEduSaveProbe() {
  const calls = { save: 0, submit: 0 };
  return {
    calls,
    save() { calls.save += 1; return calls.save; },
    submit() { calls.submit += 1; return calls.submit; }
  };
}

export function runCiticsEduGuardProbe(input, probe = createCiticsEduSaveProbe()) {
  const decision = input && Array.isArray(input.segments)
    ? guardCiticsEduSegments(input)
    : guardCiticsEduValue(input);
  return {
    ...decision,
    saveCalls: probe.calls.save,
    submitCalls: probe.calls.submit
  };
}
