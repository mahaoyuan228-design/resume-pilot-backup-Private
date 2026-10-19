/**
 * Offline RankingMajor evidence gate.
 * Classifies a future harvest packet into the four recorded verdict codes.
 * Does not read the DOM, invent a selector, fill, or save.
 * No harvest landed: the recorded verdict stays DOM_CONTROL_MISSING.
 * Dictionary rows are contrast only and do not prove a control.
 * A present control is still not support and is not a fill.
 * Never Save. 招行 is not supported.
 */

import {
  CMB_RANKINGMAJOR_RECORDED_VERDICT,
  CMB_RANKINGMAJOR_VERDICT_CODES,
  DOM_CONTROL_AMBIGUOUS,
  DOM_CONTROL_MISSING,
  DOM_CONTROL_PRESENT,
  PROBE_INCONCLUSIVE,
  isCmbRankingMajorVerdictCode
} from './cmb-rankingmajor-verdict.mjs';

export const CMB_RANKINGMAJOR_HARVEST_SCHEMA = 'cmb-rankingmajor-harvest/1';
export const CMB_RANKINGMAJOR_GATE_SCHEMA = 'cmb-rankingmajor-gate/1';

/** Evidence names from CMB_RANKINGMAJOR_PROBE_PACK. Not selectors. */
export const CMB_RANKINGMAJOR_EVIDENCE_FILES = Object.freeze([
  'context.json',
  'dom-01.txt',
  'dom-02.txt',
  'field.png',
  'verdict.json'
]);

export const CMB_RANKINGMAJOR_FILE_KEYS = Object.freeze({
  context: 'context.json',
  dom01: 'dom-01.txt',
  dom02: 'dom-02.txt',
  fieldImage: 'field.png',
  verdict: 'verdict.json'
});

/**
 * RankingMajor rows in the dict map. Contrast only.
 * These names are not a control, not a selector, and not a fill value.
 */
export const CMB_RANKINGMAJOR_DICT_CONTRAST = Object.freeze([
  Object.freeze({ text: '前20%', code: 'RM002' }),
  Object.freeze({ text: '中等', code: 'RM003' }),
  Object.freeze({ text: '中下等', code: 'RM004' })
]);

const FILE_KEYS = Object.freeze(Object.keys(CMB_RANKINGMAJOR_FILE_KEYS));

const norm = (value) => String(value ?? '')
  .normalize('NFKC')
  .replace(/[\u200b-\u200d\ufeff]/gu, '')
  .replace(/[\s\u00a0]+/gu, ' ')
  .trim();

function closed(partial) {
  return {
    field: 'RankingMajor',
    schema: CMB_RANKINGMAJOR_GATE_SCHEMA,
    harvestLanded: partial.harvestLanded === true,
    verdict: partial.verdict,
    gate: partial.gate,
    reason: partial.reason,
    supported: false,
    liveFillClaimed: false,
    fillAllowed: false,
    wireAllowed: false,
    saveAllowed: false,
    saveRefused: true,
    saved: false,
    skippedSave: true,
    writeAttempted: false,
    selector: null,
    query: null,
    dictProvesControl: false,
    interactionEvidence: false,
    observedFacts: partial.observedFacts || null
  };
}

export const CMB_RANKINGMAJOR_OFFLINE_GATE = Object.freeze(closed({
  harvestLanded: false,
  verdict: CMB_RANKINGMAJOR_RECORDED_VERDICT,
  gate: 'offline_recorded',
  reason: DOM_CONTROL_MISSING
}));

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

function hasSmuggledSelector(value, depth = 0) {
  if (depth > 4 || !isPlainObject(value)) return false;
  for (const [key, inner] of Object.entries(value)) {
    if (keyLooksLikeSelector(key)) return true;
    if (isPlainObject(inner) && hasSmuggledSelector(inner, depth + 1)) return true;
  }
  return false;
}

function bareToken(value) {
  if (value == null) return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false };
  const text = norm(value);
  if (!text) return { ok: true, value: null };
  if (valueLooksLikeSelector(text) || /\s/u.test(text)) return { ok: false };
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/u.test(text)) return { ok: false };
  return { ok: true, value: text };
}

function bareTag(value) {
  if (value == null || value === '') return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false };
  const text = norm(value).toUpperCase();
  if (!/^[A-Z][A-Z0-9]*$/u.test(text)) return { ok: false };
  return { ok: true, value: text };
}

function filesComplete(files) {
  if (!isPlainObject(files)) return false;
  return FILE_KEYS.every((key) => files[key] === true);
}

function snapshotsAgree(snapshots) {
  if (!isPlainObject(snapshots)) return false;
  return snapshots.first === true && snapshots.second === true && snapshots.agree === true;
}

function integerCount(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function readControl(control) {
  if (!isPlainObject(control)) return null;
  if (hasSmuggledSelector(control)) return null;
  const observedId = bareToken(control.observedId);
  const nodeName = bareTag(control.nodeName);
  const role = bareToken(control.role);
  if (!observedId.ok || !nodeName.ok || !role.ok) return null;
  if (typeof control.visible !== 'boolean' || typeof control.disabled !== 'boolean') return null;
  if (observedId.value == null && nodeName.value == null) return null;
  return {
    observedId: observedId.value,
    nodeName: nodeName.value,
    role: role.value,
    visible: control.visible,
    disabled: control.disabled
  };
}

export function isCmbRankingMajorDictContrast(value) {
  const text = norm(value);
  if (!text) return false;
  return CMB_RANKINGMAJOR_DICT_CONTRAST.some((row) => row.text === text || row.code === text);
}

function classify(harvest) {
  if (harvest.dictOnly === true) {
    return closed({
      harvestLanded: false,
      verdict: DOM_CONTROL_MISSING,
      gate: 'offline_recorded',
      reason: 'dict_is_not_a_control'
    });
  }
  if (hasSmuggledSelector(harvest)) {
    return closed({
      harvestLanded: true,
      verdict: PROBE_INCONCLUSIVE,
      gate: 'harvest_intake',
      reason: 'selector_rejected'
    });
  }

  const labelText = norm(harvest.labelText);
  const evidenceReady = harvest.reachable === true
    && harvest.scopeReadable === true
    && harvest.labelLocated === true
    && labelText.length > 0
    && filesComplete(harvest.files)
    && snapshotsAgree(harvest.snapshots)
    && integerCount(harvest.candidateCount)
    && (harvest.association === 'clear' || harvest.association === 'unclear' || harvest.association === 'unobserved');

  if (!evidenceReady || harvest.association === 'unobserved') {
    return closed({
      harvestLanded: true,
      verdict: PROBE_INCONCLUSIVE,
      gate: 'harvest_intake',
      reason: 'evidence_incomplete'
    });
  }

  const count = harvest.candidateCount;
  const control = harvest.control == null ? null : readControl(harvest.control);
  if (count === 1 && harvest.association === 'clear' && harvest.control != null && control == null) {
    return closed({
      harvestLanded: true,
      verdict: PROBE_INCONCLUSIVE,
      gate: 'harvest_intake',
      reason: 'evidence_incomplete'
    });
  }
  const conflict = count === 0 && harvest.control != null;

  if (harvest.association === 'unclear' || count > 1 || conflict) {
    return closed({
      harvestLanded: true,
      verdict: DOM_CONTROL_AMBIGUOUS,
      gate: 'harvest_intake',
      reason: DOM_CONTROL_AMBIGUOUS
    });
  }

  if (count === 0 && control == null) {
    return closed({
      harvestLanded: true,
      verdict: DOM_CONTROL_MISSING,
      gate: 'harvest_intake',
      reason: DOM_CONTROL_MISSING
    });
  }

  if (count === 1 && harvest.association === 'clear' && control) {
    return closed({
      harvestLanded: true,
      verdict: DOM_CONTROL_PRESENT,
      gate: 'harvest_intake',
      reason: 'presence_is_not_support',
      observedFacts: {
        labelText,
        candidateCount: 1,
        observedId: control.observedId,
        nodeName: control.nodeName,
        role: control.role,
        visible: control.visible,
        disabled: control.disabled
      }
    });
  }

  return closed({
    harvestLanded: true,
    verdict: PROBE_INCONCLUSIVE,
    gate: 'harvest_intake',
    reason: PROBE_INCONCLUSIVE
  });
}

/**
 * Classify harvest evidence. `null` is the offline recorded gate.
 * Observed facts are copied only for a unique control. No selector is built.
 */
export function assessCmbRankingMajor(harvest = null) {
  if (harvest == null) {
    return { ...CMB_RANKINGMAJOR_OFFLINE_GATE, observedFacts: null };
  }
  if (!isPlainObject(harvest) || harvest.schema !== CMB_RANKINGMAJOR_HARVEST_SCHEMA) {
    return closed({
      harvestLanded: false,
      verdict: PROBE_INCONCLUSIVE,
      gate: 'harvest_intake',
      reason: 'schema_unrecognized'
    });
  }
  const decision = classify(harvest);
  if (!isCmbRankingMajorVerdictCode(decision.verdict)) {
    return closed({
      harvestLanded: true,
      verdict: PROBE_INCONCLUSIVE,
      gate: 'harvest_intake',
      reason: PROBE_INCONCLUSIVE
    });
  }
  return decision;
}

/** Facts a later knife may read. Presence does not authorize fill or save. */
export function rankingMajorObservedFacts(decision) {
  if (!decision || decision.verdict !== DOM_CONTROL_PRESENT || !decision.observedFacts) return null;
  return {
    ...decision.observedFacts,
    selector: null,
    fillAllowed: false,
    saveAllowed: false,
    supported: false,
    liveFillClaimed: false,
    wireAllowed: false,
    requiresInteractionKnife: true
  };
}

export function createCmbRankingMajorSaveProbe() {
  const calls = { save: 0, submit: 0, fill: 0 };
  return {
    calls,
    save() { calls.save += 1; return calls.save; },
    submit() { calls.submit += 1; return calls.submit; },
    fill() { calls.fill += 1; return calls.fill; }
  };
}

/** Run the gate and do not call save, submit, or fill. */
export function runCmbRankingMajorGate(harvest = null, probe = createCmbRankingMajorSaveProbe()) {
  const decision = assessCmbRankingMajor(harvest);
  return {
    ...decision,
    saveCalls: probe.calls.save,
    submitCalls: probe.calls.submit,
    fillCalls: probe.calls.fill
  };
}

export function rankingMajorGateAllowsSave() {
  return false;
}

export { CMB_RANKINGMAJOR_VERDICT_CODES };
