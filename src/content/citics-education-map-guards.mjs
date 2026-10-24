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
  neverSave: true,
  leftUnsaved: true,
  saved: false,
  softwareClickedSave: false,
  softwareClickedSubmit: false,
  softwareClickedNext: false,
  softwareClickedDeliver: false,
  softwareClickedDelete: false,
  saveCalls: 0,
  submitCalls: 0,
  nextCalls: 0,
  deliverCalls: 0,
  deleteCalls: 0,
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
    ...CITICS_EDU_NEVER_SAVE,
    synthetic: true,
    liveEdge: false,
    formFillClaimed: false,
    supportClaimed: false,
    liveFillClaimed: false,
    liveSupportClaimed: false,
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
export function guardCiticsEduValue(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return stop(CITICS_EDU_GUARD_UNKNOWN);
  const { field, value, options, disabled } = input;
  if (field !== 'education' && field !== 'degree') return stop(CITICS_EDU_GUARD_UNKNOWN);
  if (disabled === true) return stop(CITICS_EDU_GUARD_CONTROL_UNAVAILABLE);
  if (disabled !== undefined && typeof disabled !== 'boolean') return stop(CITICS_EDU_GUARD_UNKNOWN);
  if (value !== undefined && value !== null && typeof value !== 'string') return stop(CITICS_EDU_GUARD_UNKNOWN);
  const text = norm(value);
  if (!text) return stop(CITICS_EDU_GUARD_EMPTY);
  // A caller-supplied list cannot authorize a label belonging to the other field.
  if (isOtherFieldLabel(field, text)) return stop(CITICS_EDU_GUARD_CROSS_FIELD);
  if (!Array.isArray(options)) return stop(CITICS_EDU_GUARD_UNKNOWN);
  const list = [];
  for (const option of options) {
    if (typeof option !== 'string' || !norm(option)) return stop(CITICS_EDU_GUARD_UNKNOWN);
    list.push(norm(option));
  }
  const hits = list.filter((option) => option === text);
  if (hits.length > 1) return stop(CITICS_EDU_GUARD_AMBIGUOUS);
  if (hits.length === 1) return result(true, CITICS_EDU_GUARD_EXACT, hits[0]);
  return stop(CITICS_EDU_GUARD_UNKNOWN);
}

/** Independent synthetic options are required; do not pick 最高 or 最近 among rows. */
export function guardCiticsEduSegments(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return stop(CITICS_EDU_GUARD_UNKNOWN);
  const { segments, options, disabled } = input;
  if (segments === undefined) return stop(CITICS_EDU_GUARD_EMPTY);
  if (!Array.isArray(segments)) return stop(CITICS_EDU_GUARD_UNKNOWN);
  const rows = segments;
  if (rows.length === 0) return stop(CITICS_EDU_GUARD_EMPTY);
  if (rows.length > 1) return stop(CITICS_EDU_GUARD_RULE_MISSING);
  if (typeof rows[0] !== 'string') return stop(CITICS_EDU_GUARD_UNKNOWN);
  return guardCiticsEduValue({ field: 'education', value: rows[0], options, disabled });
}

/** Harness stub. Guard runs must not call save or submit. */
export function createCiticsEduSaveProbe() {
  const calls = { save: 0, submit: 0, next: 0, deliver: 0, delete: 0 };
  return {
    calls,
    save() { calls.save += 1; return calls.save; },
    submit() { calls.submit += 1; return calls.submit; },
    next() { calls.next += 1; return calls.next; },
    deliver() { calls.deliver += 1; return calls.deliver; },
    delete() { calls.delete += 1; return calls.delete; }
  };
}

export function runCiticsEduGuardProbe(input, probe = createCiticsEduSaveProbe()) {
  const decision = input && Object.prototype.hasOwnProperty.call(input, 'segments')
    ? guardCiticsEduSegments(input)
    : guardCiticsEduValue(input);
  return {
    ...decision,
    saveCalls: probe.calls.save,
    submitCalls: probe.calls.submit,
    nextCalls: probe.calls.next,
    deliverCalls: probe.calls.deliver,
    deleteCalls: probe.calls.delete
  };
}
