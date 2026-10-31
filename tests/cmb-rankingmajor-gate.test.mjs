/**
 * Offline RankingMajor evidence gate.
 * No DOM lookup, no fill, no selector, no support claim.
 * Recorded verdict stays DOM_CONTROL_MISSING until a harvest packet lands.
 * Never Save.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CMB_RANKINGMAJOR_DICT_CONTRAST,
  CMB_RANKINGMAJOR_EVIDENCE_FILES,
  CMB_RANKINGMAJOR_FILE_KEYS,
  CMB_RANKINGMAJOR_GATE_SCHEMA,
  CMB_RANKINGMAJOR_HARVEST_SCHEMA,
  CMB_RANKINGMAJOR_OFFLINE_GATE,
  assessCmbRankingMajor,
  createCmbRankingMajorSaveProbe,
  isCmbRankingMajorDictContrast,
  rankingMajorGateAllowsSave,
  rankingMajorObservedFacts,
  runCmbRankingMajorGate
} from '../src/content/cmb-rankingmajor-gate.mjs';
import {
  CMB_RANKINGMAJOR_RECORDED_VERDICT,
  CMB_RANKINGMAJOR_VERDICT_CODES,
  DOM_CONTROL_AMBIGUOUS,
  DOM_CONTROL_MISSING,
  DOM_CONTROL_PRESENT,
  PROBE_INCONCLUSIVE
} from '../src/content/cmb-rankingmajor-verdict.mjs';

const root = resolve('.');
const fixtureDir = resolve(root, 'tests/fixtures/cmb-rankingmajor-gate');
const moduleSource = readFileSync(resolve(root, 'src/content/cmb-rankingmajor-gate.mjs'), 'utf8');
const engineSource = readFileSync(resolve(root, 'src/content/cmb-basic.js'), 'utf8');
const harness = readFileSync(resolve(root, 'scripts/auto-cmb-basic.mjs'), 'utf8');
const probePack = readFileSync(resolve(root, 'dist/site-probes/CMB_RANKINGMAJOR_PROBE_PACK_20261019.md'), 'utf8');
const steps = readFileSync(resolve(root, 'dist/site-probes/CMB_RANKINGMAJOR_STEPS_AM_20261019.md'), 'utf8');

function load(name) {
  return JSON.parse(readFileSync(resolve(fixtureDir, name), 'utf8'));
}

function withoutNote(row) {
  const copy = { ...row };
  delete copy.note;
  return copy;
}

function assertFailClosed(decision) {
  assert.equal(decision.schema, CMB_RANKINGMAJOR_GATE_SCHEMA);
  assert.equal(decision.field, 'RankingMajor');
  assert.equal(decision.supported, false);
  assert.equal(decision.liveSupportClaimed, false);
  assert.equal(decision.liveFillClaimed, false);
  assert.equal(decision.fillAllowed, false);
  assert.equal(decision.wireAllowed, false);
  assert.equal(decision.saveAllowed, false);
  assert.equal(decision.saveRefused, true);
  assert.equal(decision.saved, false);
  assert.equal(decision.skippedSave, true);
  assert.equal(decision.writeAttempted, false);
  assert.equal(decision.selector, null);
  assert.equal(decision.query, null);
  assert.equal(decision.dictProvesControl, false);
  assert.equal(decision.interactionEvidence, false);
  assert.equal(JSON.stringify(decision).includes('#'), false);
  assert.equal(rankingMajorGateAllowsSave(), false);
}

test('offline fixture documents the recorded DOM_CONTROL_MISSING gate', () => {
  const recorded = withoutNote(load('offline.json'));
  const decision = assessCmbRankingMajor(null);
  assert.deepEqual(decision, { ...recorded, liveSupportClaimed: false });
  assert.deepEqual(decision, { ...CMB_RANKINGMAJOR_OFFLINE_GATE });
  assert.equal(decision.verdict, CMB_RANKINGMAJOR_RECORDED_VERDICT);
  assert.equal(decision.verdict, DOM_CONTROL_MISSING);
  assert.equal(decision.gate, 'offline_recorded');
  assert.equal(decision.harvestLanded, false);
  assert.equal(decision.observedFacts, null);
  assert.equal(rankingMajorObservedFacts(decision), null);
  assertFailClosed(decision);
  assert.match(probePack, /状态：`DOM_CONTROL_MISSING`/);
  assert.match(steps, /live 仍 `DOM_CONTROL_MISSING`/);
  assert.deepEqual(
    Object.values(CMB_RANKINGMAJOR_FILE_KEYS),
    [...CMB_RANKINGMAJOR_EVIDENCE_FILES]
  );
  for (const name of CMB_RANKINGMAJOR_EVIDENCE_FILES) {
    assert.match(probePack, new RegExp(name.replace('.', '\\.')));
  }
});

test('dictionary contrast matches the dict map and does not prove a control', () => {
  const full = JSON.parse(readFileSync(resolve(root, 'dist/site-probes/cmb-dictmap-full-20261019.json'), 'utf8'));
  const rows = full.dicts.RankingMajor.map((row) => ({ text: row.name, code: row.code }));
  assert.deepEqual([...CMB_RANKINGMAJOR_DICT_CONTRAST], rows);
  assert.equal(isCmbRankingMajorDictContrast('前20%'), true);
  assert.equal(isCmbRankingMajorDictContrast(' RM003 '), true);
  assert.equal(isCmbRankingMajorDictContrast('中下等'), true);
  assert.equal(isCmbRankingMajorDictContrast('前20'), false);
  assert.equal(isCmbRankingMajorDictContrast('请选择'), false);
  assert.equal(isCmbRankingMajorDictContrast(''), false);

  const dictOnly = assessCmbRankingMajor(load('harvest-dict-only.json'));
  assert.equal(dictOnly.verdict, DOM_CONTROL_MISSING);
  assert.equal(dictOnly.reason, 'dict_is_not_a_control');
  assert.equal(dictOnly.harvestLanded, false);
  assert.equal(dictOnly.gate, 'offline_recorded');
  assert.equal(dictOnly.observedFacts, null);
  assert.equal(dictOnly.selector, null);
  assert.equal(JSON.stringify(dictOnly).includes('fixtureRankingNode'), false);
  assert.equal(JSON.stringify(dictOnly).includes('.ant-select'), false);
  assertFailClosed(dictOnly);
});

test('harvest packets classify without inventing a selector', () => {
  const missing = assessCmbRankingMajor(load('harvest-missing.json'));
  assert.equal(missing.verdict, DOM_CONTROL_MISSING);
  assert.equal(missing.gate, 'harvest_intake');
  assert.equal(missing.harvestLanded, true);
  assert.equal(missing.observedFacts, null);
  assertFailClosed(missing);

  const present = assessCmbRankingMajor(load('harvest-present.json'));
  assert.equal(present.verdict, DOM_CONTROL_PRESENT);
  assert.equal(present.reason, 'presence_is_not_support');
  assert.equal(present.observedFacts.observedId, 'fixtureRankingNode');
  assert.equal(present.observedFacts.nodeName, 'SELECT');
  assert.equal(present.observedFacts.role, 'combobox');
  assert.equal(present.observedFacts.visible, true);
  assert.equal(present.observedFacts.disabled, false);
  assert.equal(present.observedFacts.candidateCount, 1);
  assert.equal(present.value, undefined);
  assert.equal(present.observedFacts.text, undefined);
  assert.equal(present.observedFacts.code, undefined);
  const wired = rankingMajorObservedFacts(present);
  assert.equal(wired.observedId, 'fixtureRankingNode');
  assert.equal(wired.selector, null);
  assert.equal(wired.fillAllowed, false);
  assert.equal(wired.saveAllowed, false);
  assert.equal(wired.supported, false);
  assert.equal(wired.liveSupportClaimed, false);
  assert.equal(wired.wireAllowed, false);
  assert.equal(wired.requiresInteractionKnife, true);
  assert.equal(String(wired.observedId).startsWith('#'), false);
  assertFailClosed(present);

  const hidden = assessCmbRankingMajor(load('harvest-hidden.json'));
  assert.equal(hidden.verdict, DOM_CONTROL_PRESENT);
  assert.equal(hidden.observedFacts.visible, false);
  assert.equal(hidden.observedFacts.disabled, true);
  assert.equal(hidden.observedFacts.observedId, null);
  assert.equal(hidden.observedFacts.nodeName, 'SELECT');
  assert.notEqual(hidden.verdict, DOM_CONTROL_MISSING);
  assert.equal(JSON.stringify(hidden).includes('resume_'), false);
  assertFailClosed(hidden);

  const ambiguous = assessCmbRankingMajor(load('harvest-ambiguous.json'));
  assert.equal(ambiguous.verdict, DOM_CONTROL_AMBIGUOUS);
  assert.equal(ambiguous.observedFacts, null);
  assert.equal(rankingMajorObservedFacts(ambiguous), null);
  assertFailClosed(ambiguous);

  const inconclusive = assessCmbRankingMajor(load('harvest-inconclusive.json'));
  assert.equal(inconclusive.verdict, PROBE_INCONCLUSIVE);
  assert.equal(inconclusive.reason, 'evidence_incomplete');
  assert.notEqual(inconclusive.verdict, DOM_CONTROL_MISSING);
  assertFailClosed(inconclusive);

  const smuggled = assessCmbRankingMajor(load('harvest-selector.json'));
  assert.equal(smuggled.verdict, PROBE_INCONCLUSIVE);
  assert.equal(smuggled.reason, 'selector_rejected');
  assert.equal(smuggled.selector, null);
  assert.equal(smuggled.observedFacts, null);
  assert.equal(JSON.stringify(smuggled).includes('fixtureRankingNode'), false);
  assert.equal(JSON.stringify(smuggled).includes('#'), false);
  assertFailClosed(smuggled);
});

test('incomplete, conflicting, and unrecognized packets stay fail-closed', () => {
  const base = load('harvest-missing.json');
  const disagree = assessCmbRankingMajor({
    ...base,
    snapshots: { first: true, second: true, agree: false }
  });
  assert.equal(disagree.verdict, PROBE_INCONCLUSIVE);

  const fractional = assessCmbRankingMajor({ ...base, candidateCount: 1.5 });
  assert.equal(fractional.verdict, PROBE_INCONCLUSIVE);

  const negative = assessCmbRankingMajor({ ...base, candidateCount: -1 });
  assert.equal(negative.verdict, PROBE_INCONCLUSIVE);

  const stringCount = assessCmbRankingMajor({ ...base, candidateCount: '0' });
  assert.equal(stringCount.verdict, PROBE_INCONCLUSIVE);

  const unreadableScope = assessCmbRankingMajor({ ...base, scopeReadable: false, candidateCount: 0 });
  assert.equal(unreadableScope.verdict, PROBE_INCONCLUSIVE);
  assert.notEqual(unreadableScope.reason, DOM_CONTROL_MISSING);

  const conflict = assessCmbRankingMajor({
    ...base,
    candidateCount: 0,
    control: {
      observedId: 'fixtureRankingNode',
      nodeName: 'select',
      role: null,
      visible: true,
      disabled: false
    }
  });
  assert.equal(conflict.verdict, DOM_CONTROL_AMBIGUOUS);
  assert.equal(conflict.observedFacts, null);

  const unreadableControl = assessCmbRankingMajor({
    ...load('harvest-present.json'),
    control: {
      observedId: '#not-an-id',
      nodeName: 'select',
      role: 'combobox',
      visible: true,
      disabled: false
    }
  });
  assert.equal(unreadableControl.verdict, PROBE_INCONCLUSIVE);
  assert.equal(unreadableControl.selector, null);

  const missingControlFacts = assessCmbRankingMajor({
    ...load('harvest-present.json'),
    control: null
  });
  assert.equal(missingControlFacts.verdict, PROBE_INCONCLUSIVE);

  const unknown = assessCmbRankingMajor({ schema: 'other', candidateCount: 1 });
  assert.equal(unknown.verdict, PROBE_INCONCLUSIVE);
  assert.equal(unknown.reason, 'schema_unrecognized');
  assert.equal(unknown.harvestLanded, false);

  assert.equal(assessCmbRankingMajor([]).reason, 'schema_unrecognized');
  assert.equal(assessCmbRankingMajor('DOM_CONTROL_PRESENT').verdict, PROBE_INCONCLUSIVE);
  assert.equal(assessCmbRankingMajor(undefined).verdict, DOM_CONTROL_MISSING);
  assert.equal(CMB_RANKINGMAJOR_HARVEST_SCHEMA, 'cmb-rankingmajor-harvest/1');
  for (const code of CMB_RANKINGMAJOR_VERDICT_CODES) {
    assert.equal(typeof code, 'string');
  }
});

test('save, submit, and fill probes stay at zero for every fixture', () => {
  const names = readdirSync(fixtureDir).filter((name) => name.endsWith('.json')).sort();
  assert.ok(names.includes('offline.json'));
  assert.ok(names.length >= 8);
  const probe = createCmbRankingMajorSaveProbe();
  for (const name of names) {
    const input = name === 'offline.json' ? null : load(name);
    const decision = runCmbRankingMajorGate(input, probe);
    assertFailClosed(decision);
    assert.equal(decision.saveCalls, 0);
    assert.equal(decision.submitCalls, 0);
    assert.equal(decision.fillCalls, 0);
    assert.equal(probe.calls.save, 0);
    assert.equal(probe.calls.submit, 0);
    assert.equal(probe.calls.fill, 0);
  }
  assert.equal(probe.save(), 1);
  assert.equal(probe.submit(), 1);
  assert.equal(probe.fill(), 1);
  const again = runCmbRankingMajorGate(load('harvest-present.json'), probe);
  assert.equal(again.saveCalls, 1);
  assert.equal(again.submitCalls, 1);
  assert.equal(again.fillCalls, 1);
  assert.equal(again.verdict, DOM_CONTROL_PRESENT);
  assert.equal(again.saveAllowed, false);
});

test('gate module stays off the fill engine and the harness refusal does not open a selector', () => {
  assert.doesNotMatch(moduleSource, /document|querySelector|click\(|ant-picker|ant-calendar|日历|保存|提交|投递/);
  assert.match(moduleSource, /Never Save/);
  assert.doesNotMatch(engineSource, /cmb-rankingmajor-gate|assessCmbRankingMajor/);
  assert.doesNotMatch(engineSource, /RankingMajor|rankingMajor/);
  assert.match(harness, /RankingMajor is DOM_CONTROL_MISSING/);
  assert.doesNotMatch(harness, /resume_[A-Za-z0-9_]*[Rr]anking/);
  for (const name of readdirSync(fixtureDir)) {
    const text = readFileSync(resolve(fixtureDir, name), 'utf8');
    assert.equal(text.includes('PRIVATE KEY'), false);
    assert.equal(text.includes('BEGIN '), false);
    assert.equal(/resume_[A-Za-z0-9_]*[Rr]anking/.test(text), false);
  }

  for (const args of [
    ['--only', 'RankingMajor'],
    ['--only', '专业排名'],
    ['--only', 'RankingMajor', '--live']
  ]) {
    const run = spawnSync(process.execPath, ['scripts/auto-cmb-basic.mjs', ...args], {
      cwd: root,
      encoding: 'utf8',
      timeout: 20000
    });
    assert.equal(run.status, 3, run.stderr || run.stdout);
    const payload = JSON.parse(run.stdout);
    assert.equal(payload.reason, 'DOM_CONTROL_MISSING');
    assert.equal(payload.ok, false);
    assert.equal(payload.saved, false);
    assert.equal(payload.skippedSave, true);
    assert.equal(payload.saveAllowed, false);
    assert.equal(payload.selector, null);
    assert.equal(payload.formFillClaimed, false);
    assert.equal(payload.liveFillClaimed, false);
    assert.equal(payload.supported, false);
    assert.equal(payload.writeAttempted, false);
    assert.equal(payload.wireAllowed, false);
    assert.equal(JSON.stringify(payload).includes('#'), false);
  }
});
