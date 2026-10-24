/**
 * Offline birth-date hint gate.
 * Classifies a future DOB harvest into the five hint verdict codes.
 * Does not read the DOM, invent a selector, open a calendar, fill, or save.
 * No harvest landed: the recorded verdict stays datepicker_hint_only.
 * Every path refuses Save, including a packet that claims a save was attempted.
 * Never Save. 招行 is not supported.
 */

import { CMB_BIRTHDATE_HINT } from './cmb-gated-dicts.mjs';
import {
  CMB_BIRTHDATE_HINT_VERDICT_CODES,
  CMB_BIRTHDATE_RECORDED_VERDICT,
  DATEPICKER_HINT_ONLY,
  DOB_CONTROL_UNOBSERVED,
  DOB_FORMAT_UNVERIFIED,
  DOB_HINT_AMBIGUOUS,
  DOB_HINT_MISSING,
  isCmbBirthDateHintVerdictCode
} from './cmb-birthdate-hint-verdict.mjs';

export const CMB_BIRTHDATE_HARVEST_SCHEMA = 'cmb-birthdate-harvest/1';
export const CMB_BIRTHDATE_GATE_SCHEMA = 'cmb-birthdate-hint-gate/1';

/** Evidence names from CMB_DOB_LIVE_HARVEST_PACK. Not selectors. */
export const CMB_BIRTHDATE_EVIDENCE_FILES = Object.freeze([
  '01-context.md',
  '02-locator.json',
  '03-control.png',
  '03-control.html',
  '04-hints.json',
  '05-interaction.md',
  '05-popup.png',
  '06-format.json',
  '07-actions.md',
  '08-verdict.json'
]);

export const CMB_BIRTHDATE_FILE_KEYS = Object.freeze({
  context: '01-context.md',
  locator: '02-locator.json',
  controlImage: '03-control.png',
  controlHtml: '03-control.html',
  hints: '04-hints.json',
  interaction: '05-interaction.md',
  popup: '05-popup.png',
  format: '06-format.json',
  actions: '07-actions.md',
  verdict: '08-verdict.json'
});

const norm = (value) => String(value ?? '')
  .normalize('NFKC')
  .replace(/[\u200b-\u200d\ufeff]/gu, '')
  .replace(/[\s\u00a0]+/gu, ' ')
  .trim();

const RECORDED_HINT = Object.freeze({
  key: CMB_BIRTHDATE_HINT.key,
  label: CMB_BIRTHDATE_HINT.label,
  placeholder: CMB_BIRTHDATE_HINT.placeholder,
  readOnly: CMB_BIRTHDATE_HINT.readOnly === true,
  selectId: CMB_BIRTHDATE_HINT.selectId,
  saveAllowed: false
});

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function keyLooksLikeSelector(key) {
  return /selector|xpath|\bquery\b|css/i.test(String(key));
}

function valueLooksLikeSelector(value) {
  if (typeof value !== 'string') return false;
  return /[#.\[\]>~+]|\bxpath\b|\bcss\b/i.test(value);
}

function hasSmuggledSelector(value) {
  const pending = [value];
  const seen = new Set();
  while (pending.length > 0) {
    const current = pending.pop();
    if (current == null || typeof current !== 'object') continue;
    if (seen.has(current)) return true;
    seen.add(current);
    for (const [key, inner] of Object.entries(current)) {
      if (keyLooksLikeSelector(key)) return true;
      if (inner != null && typeof inner === 'object') pending.push(inner);
    }
  }
  return false;
}

function bareToken(value, pattern) {
  if (value == null) return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false };
  const text = norm(value);
  if (!text) return { ok: true, value: null };
  if (valueLooksLikeSelector(text) || /\s/u.test(text)) return { ok: false };
  if (!pattern.test(text)) return { ok: false };
  return { ok: true, value: text };
}

function filePresent(files, key) {
  return isPlainObject(files) && files[key] === true;
}

function blank(value) {
  return norm(value).length === 0;
}

function closed(partial) {
  return {
    field: 'birthDate',
    schema: CMB_BIRTHDATE_GATE_SCHEMA,
    harvestLanded: partial.harvestLanded === true,
    verdict: partial.verdict,
    gate: partial.gate,
    reason: partial.reason,
    supported: false,
    liveSupportClaimed: false,
    liveFillClaimed: false,
    fillAllowed: false,
    saveAllowed: false,
    saveRefused: true,
    saved: false,
    skippedSave: true,
    writeAttempted: false,
    calendarClicked: false,
    selector: null,
    query: null,
    hint: { ...RECORDED_HINT },
    observedFacts: partial.observedFacts || null
  };
}

export const CMB_BIRTHDATE_OFFLINE_GATE = Object.freeze(closed({
  harvestLanded: false,
  verdict: CMB_BIRTHDATE_RECORDED_VERDICT,
  gate: 'offline_recorded',
  reason: DATEPICKER_HINT_ONLY
}));

function readControl(control) {
  if (!isPlainObject(control) || hasSmuggledSelector(control)) return null;
  const observedId = bareToken(control.observedId, /^[A-Za-z][A-Za-z0-9_-]*$/u);
  const inputType = bareToken(
    typeof control.inputType === 'string' ? control.inputType.toLowerCase() : control.inputType,
    /^[a-z][a-z0-9-]*$/u
  );
  const role = bareToken(control.role, /^[A-Za-z][A-Za-z0-9_-]*$/u);
  if (!observedId.ok || !inputType.ok || !role.ok) return null;
  if (typeof control.readOnly !== 'boolean' || typeof control.disabled !== 'boolean') return null;
  if (control.placeholder != null && typeof control.placeholder !== 'string') return null;
  if (control.calendarEntryObserved != null && typeof control.calendarEntryObserved !== 'boolean') return null;
  if (observedId.value == null && inputType.value == null) return null;
  return {
    observedId: observedId.value,
    inputType: inputType.value,
    role: role.value,
    readOnly: control.readOnly,
    disabled: control.disabled,
    placeholder: control.placeholder == null ? null : norm(control.placeholder),
    calendarEntryObserved: control.calendarEntryObserved === true
  };
}

function hintState(harvest, control) {
  if (!filePresent(harvest.files, 'hints')) return 'absent';
  const hint = harvest.hint;
  if (hint == null) return 'missing';
  if (!isPlainObject(hint)) return 'missing';
  if (hint.conflicting === true) return 'ambiguous';
  const notes = [hint.placeholder, hint.formatNote, hint.pattern].map((item) => norm(item)).filter(Boolean);
  if (notes.length > 1) {
    const unique = new Set(notes);
    if (unique.size > 1) return 'ambiguous';
  }
  if (control && control.placeholder && notes.length === 1 && notes[0] !== control.placeholder && hint.placeholder) {
    return 'ambiguous';
  }
  if (notes.length === 0) return 'missing';
  return 'present';
}

function classify(harvest) {
  if (hasSmuggledSelector(harvest)) {
    return closed({
      harvestLanded: true,
      verdict: DATEPICKER_HINT_ONLY,
      gate: 'harvest_intake',
      reason: 'selector_rejected'
    });
  }
  const interaction = isPlainObject(harvest.interaction) ? harvest.interaction : {};
  if (interaction.autoClicked === true || interaction.daySelected === true) {
    return closed({
      harvestLanded: true,
      verdict: DATEPICKER_HINT_ONLY,
      gate: 'harvest_intake',
      reason: 'interaction_forbidden'
    });
  }
  const actions = isPlainObject(harvest.actions) ? harvest.actions : {};
  if (['saveAttempted', 'submitAttempted', 'nextAttempted', 'deliverAttempted', 'deleteAttempted']
    .some((key) => actions[key] === true)) {
    return closed({
      harvestLanded: true,
      verdict: DATEPICKER_HINT_ONLY,
      gate: 'harvest_intake',
      reason: 'save_forbidden'
    });
  }
  if (harvest.autoSaveExcluded !== true) {
    return closed({
      harvestLanded: true,
      verdict: DATEPICKER_HINT_ONLY,
      gate: 'harvest_intake',
      reason: 'autosave_not_excluded'
    });
  }

  const looked = filePresent(harvest.files, 'locator');
  const labelText = norm(harvest.labelText);
  const labelMatches = harvest.labelLocated === true && labelText === RECORDED_HINT.label;
  const control = harvest.controlObserved === true ? readControl(harvest.control) : null;

  if (!looked) {
    return closed({
      harvestLanded: true,
      verdict: DATEPICKER_HINT_ONLY,
      gate: 'harvest_intake',
      reason: 'control_not_collected'
    });
  }
  if (!labelMatches || control == null) {
    return closed({
      harvestLanded: true,
      verdict: DOB_CONTROL_UNOBSERVED,
      gate: 'harvest_intake',
      reason: DOB_CONTROL_UNOBSERVED
    });
  }

  const hints = hintState(harvest, control);
  if (hints === 'ambiguous') {
    return closed({
      harvestLanded: true,
      verdict: DOB_HINT_AMBIGUOUS,
      gate: 'harvest_intake',
      reason: DOB_HINT_AMBIGUOUS,
      observedFacts: control
    });
  }
  if (hints === 'missing') {
    return closed({
      harvestLanded: true,
      verdict: DOB_HINT_MISSING,
      gate: 'harvest_intake',
      reason: DOB_HINT_MISSING,
      observedFacts: control
    });
  }
  if (hints === 'absent' || !filePresent(harvest.files, 'format') || harvest.format?.verified !== true) {
    return closed({
      harvestLanded: true,
      verdict: DOB_FORMAT_UNVERIFIED,
      gate: 'harvest_intake',
      reason: DOB_FORMAT_UNVERIFIED,
      observedFacts: control
    });
  }

  return closed({
    harvestLanded: true,
    verdict: DATEPICKER_HINT_ONLY,
    gate: 'harvest_intake',
    reason: 'observed_still_hint_only',
    observedFacts: control
  });
}

/**
 * Classify DOB harvest evidence. `null` stays datepicker_hint_only.
 * The recorded select id is copied from the existing hint. No new selector is built.
 */
export function assessCmbBirthDateHint(harvest = null) {
  if (harvest == null) {
    return { ...CMB_BIRTHDATE_OFFLINE_GATE, hint: { ...RECORDED_HINT }, observedFacts: null };
  }
  if (!isPlainObject(harvest) || harvest.schema !== CMB_BIRTHDATE_HARVEST_SCHEMA) {
    return closed({
      harvestLanded: false,
      verdict: DATEPICKER_HINT_ONLY,
      gate: 'harvest_intake',
      reason: 'schema_unrecognized'
    });
  }
  const decision = classify(harvest);
  if (!isCmbBirthDateHintVerdictCode(decision.verdict)) {
    return closed({
      harvestLanded: true,
      verdict: DATEPICKER_HINT_ONLY,
      gate: 'harvest_intake',
      reason: DATEPICKER_HINT_ONLY
    });
  }
  return decision;
}

/** Copy observed control facts. Does not prefix an id and does not allow save. */
export function birthDateObservedFacts(decision) {
  if (!decision || !decision.observedFacts) return null;
  const facts = decision.observedFacts;
  return {
    observedId: facts.observedId ?? null,
    inputType: facts.inputType ?? null,
    role: facts.role ?? null,
    readOnly: facts.readOnly === true,
    disabled: facts.disabled === true,
    placeholder: facts.placeholder ?? null,
    calendarEntryObserved: facts.calendarEntryObserved === true,
    selector: null,
    fillAllowed: false,
    saveAllowed: false,
    supported: false,
    liveSupportClaimed: false,
    liveFillClaimed: false
  };
}

export function createCmbBirthDateSaveProbe() {
  const calls = { save: 0, submit: 0, calendar: 0, fill: 0 };
  return {
    calls,
    save() { calls.save += 1; return calls.save; },
    submit() { calls.submit += 1; return calls.submit; },
    calendar() { calls.calendar += 1; return calls.calendar; },
    fill() { calls.fill += 1; return calls.fill; }
  };
}

/** Run the hint gate and do not call save, submit, calendar, or fill. */
export function runCmbBirthDateHintGate(harvest = null, probe = createCmbBirthDateSaveProbe()) {
  const decision = assessCmbBirthDateHint(harvest);
  return {
    ...decision,
    saveCalls: probe.calls.save,
    submitCalls: probe.calls.submit,
    calendarCalls: probe.calls.calendar,
    fillCalls: probe.calls.fill
  };
}

function birthBlocker(plan) {
  const blockers = Array.isArray(plan?.blockers) ? plan.blockers : [];
  return blockers.find((row) => row && row.path === 'birthDate') || null;
}

/**
 * Hint-only (and any birthDate blocker) cannot Save.
 * A birthDate value copied onto plan.values is omitted from the returned values.
 * Save, submit, calendar, and fill hooks are not called.
 */
export function lockCmbBirthDateHintPlan(plan, probe = createCmbBirthDateSaveProbe()) {
  const row = birthBlocker(plan);
  const values = plan?.values && typeof plan.values === 'object' && !Array.isArray(plan.values)
    ? { ...plan.values }
    : null;
  if (values && Object.hasOwn(values, 'birthDate')) delete values.birthDate;
  return {
    refused: true,
    saveAllowed: false,
    saveRefused: true,
    saved: false,
    skippedSave: true,
    writeAttempted: false,
    calendarClicked: false,
    supported: false,
    liveSupportClaimed: false,
    liveFillClaimed: false,
    selector: null,
    hintOnly: row?.reason === DATEPICKER_HINT_ONLY,
    birthDateReason: row?.reason || null,
    values,
    planOk: plan?.ok === true,
    saveCalls: probe.calls.save,
    submitCalls: probe.calls.submit,
    calendarCalls: probe.calls.calendar,
    fillCalls: probe.calls.fill
  };
}

/** Save attempt on the hint path. The probe counters do not move. */
export function attemptCmbBirthDateSave(plan, probe = createCmbBirthDateSaveProbe()) {
  return lockCmbBirthDateHintPlan(plan, probe);
}

export function birthDateHintAllowsSave() {
  return false;
}

export { CMB_BIRTHDATE_HINT_VERDICT_CODES };
