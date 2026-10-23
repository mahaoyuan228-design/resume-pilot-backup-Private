/**
 * Offline RankingMajor evidence gate.
 * Classifies a future harvest packet into the four recorded verdict codes.
 * Does not read the DOM, invent a selector, fill, or save.
 * Null stays the recorded DOM_CONTROL_MISSING gate.
 * A live snap packet is classified from its recorded facts only.
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
    liveSupportClaimed: false,
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

function hasSmuggledSelector(value) {
  const pending = [value];
  const seen = new WeakSet();
  while (pending.length) {
    const current = pending.pop();
    if (current == null || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);
    for (const [key, inner] of Object.entries(current)) {
      if (keyLooksLikeSelector(key)) return true;
      if (inner != null && typeof inner === 'object') pending.push(inner);
    }
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

function isLiveRankingSnap(harvest) {
  if (!isPlainObject(harvest)) return false;
  if (harvest.schema === CMB_RANKINGMAJOR_HARVEST_SCHEMA) return false;
  if (harvest.site !== 'CMB') return false;
  if (!isPlainObject(harvest.pageContext)) return false;
  if (!isPlainObject(harvest.snap1) || !isPlainObject(harvest.snap2)) return false;
  if (!Array.isArray(harvest.snap1.labelHits) || !Array.isArray(harvest.snap2.labelHits)) return false;
  return true;
}

function recordedStrings(value) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !norm(item))) return null;
  return value.map(norm).sort();
}

/** Only compare facts collected by both existing read-only snap expressions. */
function readLiveSnap(snap, first = false) {
  const ids = recordedStrings(snap.idHits);
  const rankingish = recordedStrings(snap.rankingishLabels);
  const names = !first && snap.nameHits === undefined ? [] : recordedStrings(snap.nameHits);
  if (!ids || !rankingish || !names || !Array.isArray(snap.labelHits)) return null;
  if (first && (!integerCount(snap.allLabelCount) || snap.allLabelCount === 0
      || snap.allLabelCount < snap.labelHits.length)) return null;
  const labels = [];
  for (const row of snap.labelHits) {
    if (!isPlainObject(row) || typeof row.labelText !== 'string' || !norm(row.labelText)
        || typeof row.hasInput !== 'boolean' || typeof row.visible !== 'boolean'
        || !(row.inputId === null || typeof row.inputId === 'string')) return null;
    labels.push({
      labelText: norm(row.labelText),
      hasInput: row.hasInput,
      inputId: row.inputId === null ? null : norm(row.inputId),
      visible: row.visible
    });
  }
  labels.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return { labels, ids, rankingish, names };
}

/**
 * Overnight live snaps are not the harvest schema.
 * Both recorded snapshots must agree. Ids are not turned into selectors.
 */
function classifyLiveSnap(harvest) {
  if (hasSmuggledSelector(harvest)) {
    return closed({
      harvestLanded: true,
      verdict: PROBE_INCONCLUSIVE,
      gate: 'live_snap',
      reason: 'selector_rejected'
    });
  }
  if (harvest.pageContext.hasForm !== true || harvest.pageContext.loginHints === true) {
    return closed({
      harvestLanded: true,
      verdict: PROBE_INCONCLUSIVE,
      gate: 'live_snap',
      reason: 'form_not_visible'
    });
  }
  const first = readLiveSnap(harvest.snap1, true);
  const second = readLiveSnap(harvest.snap2);
  if (harvest.ok === false || !first || !second) {
    return closed({
      harvestLanded: true,
      verdict: PROBE_INCONCLUSIVE,
      gate: 'live_snap',
      reason: 'evidence_incomplete'
    });
  }
  // Snap 2 does not collect nameHits. Compare the facts shared by both probes.
  if (['labels', 'ids', 'rankingish'].some((key) => JSON.stringify(first[key]) !== JSON.stringify(second[key]))) {
    return closed({
      harvestLanded: true,
      verdict: PROBE_INCONCLUSIVE,
      gate: 'live_snap',
      reason: 'snapshots_disagree'
    });
  }
  if (first.labels.length === 0 && first.ids.length === 0 && first.rankingish.length === 0
      && first.names.length === 0 && second.names.length === 0) {
    return closed({
      harvestLanded: true,
      verdict: DOM_CONTROL_MISSING,
      gate: 'live_snap',
      reason: DOM_CONTROL_MISSING
    });
  }
  const unique = first.labels.length === 1 ? first.labels[0] : null;
  // hasInput alone does not establish which recorded control belongs to the label.
  const identity = unique ? bareToken(unique.inputId) : null;
  const uniqueAssociation = identity?.ok === true && identity.value != null
    && first.ids.length === 1 && first.ids[0] === identity.value;
  const extraLabels = unique && first.rankingish.some((text) => text !== unique.labelText);
  const nameConflict = unique && first.names.length > 0
    && (first.names.length > 1 || typeof harvest.snap1.labelHits[0].inputName !== 'string'
      || first.names.some((name) => name !== norm(harvest.snap1.labelHits[0].inputName)));
  if (unique?.hasInput === true && uniqueAssociation && !extraLabels && !nameConflict && second.names.length === 0) {
    return closed({
      harvestLanded: true,
      verdict: DOM_CONTROL_PRESENT,
      gate: 'live_snap',
      reason: 'presence_is_not_support'
    });
  }
  return closed({
    harvestLanded: true,
    verdict: DOM_CONTROL_AMBIGUOUS,
    gate: 'live_snap',
    reason: DOM_CONTROL_AMBIGUOUS
  });
}

/**
 * Classify harvest evidence. `null` is the offline recorded gate.
 * Observed facts are copied only for a unique control. No selector is built.
 * Live overnight snaps use the same four verdict codes and still refuse Save.
 */
export function assessCmbRankingMajor(harvest = null) {
  if (harvest == null) {
    return { ...CMB_RANKINGMAJOR_OFFLINE_GATE, observedFacts: null };
  }
  if (isLiveRankingSnap(harvest)) {
    const decision = classifyLiveSnap(harvest);
    if (!isCmbRankingMajorVerdictCode(decision.verdict)) {
      return closed({
        harvestLanded: true,
        verdict: PROBE_INCONCLUSIVE,
        gate: 'live_snap',
        reason: PROBE_INCONCLUSIVE
      });
    }
    return decision;
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
    liveSupportClaimed: false,
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
