/**
 * Offline birth-date hint gate.
 * Hint-only cannot Save. A future harvest is classified without a new selector.
 * Recorded verdict stays datepicker_hint_only. Never Save.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CMB_BIRTHDATE_EVIDENCE_FILES,
  CMB_BIRTHDATE_FILE_KEYS,
  CMB_BIRTHDATE_GATE_SCHEMA,
  CMB_BIRTHDATE_OFFLINE_GATE,
  assessCmbBirthDateHint,
  attemptCmbBirthDateSave,
  birthDateHintAllowsSave,
  birthDateObservedFacts,
  createCmbBirthDateSaveProbe,
  runCmbBirthDateHintGate
} from '../src/content/cmb-birthdate-hint-gate.mjs';
import {
  CMB_BIRTHDATE_RECORDED_VERDICT,
  DATEPICKER_HINT_ONLY,
  DOB_CONTROL_UNOBSERVED,
  DOB_FORMAT_UNVERIFIED,
  DOB_HINT_AMBIGUOUS,
  DOB_HINT_MISSING
} from '../src/content/cmb-birthdate-hint-verdict.mjs';
import { CMB_BIRTHDATE_HINT, planCmbBasicFromProfile } from '../src/content/cmb-profile-map.mjs';
import { CMB_RANKINGMAJOR_RECORDED_VERDICT } from '../src/content/cmb-rankingmajor-verdict.mjs';

const root = resolve('.');
const fixtureDir = resolve(root, 'tests/fixtures/cmb-birthdate-hint-gate');
const moduleSource = readFileSync(resolve(root, 'src/content/cmb-birthdate-hint-gate.mjs'), 'utf8');
const engineSource = readFileSync(resolve(root, 'src/content/cmb-basic.js'), 'utf8');
const harness = readFileSync(resolve(root, 'scripts/auto-cmb-basic.mjs'), 'utf8');
const hintNext = readFileSync(resolve(root, 'dist/site-probes/CMB_BIRTHDATE_HINT_NEXT_20261019.md'), 'utf8');
const livePack = readFileSync(resolve(root, 'dist/site-probes/CMB_DOB_LIVE_HARVEST_PACK_20261019.md'), 'utf8');
const priorHarvest = JSON.parse(readFileSync(resolve(root, 'dist/site-probes/cmb-harvest-birthDate.json'), 'utf8'));

const CORE = {
  fullName: '测试甲',
  phone: '13800138000',
  email: 'cmb.user@example.com',
  confirmedFields: ['fullName', 'phone', 'email']
};

function plan(extra = {}, confirmed = []) {
  return planCmbBasicFromProfile({
    ...CORE,
    ...extra,
    confirmedFields: [...CORE.confirmedFields, ...confirmed]
  });
}

function load(name) {
  return JSON.parse(readFileSync(resolve(fixtureDir, name), 'utf8'));
}

function withoutNote(row) {
  const copy = { ...row };
  delete copy.note;
  return copy;
}

function assertCannotSave(decision) {
  assert.equal(decision.schema, CMB_BIRTHDATE_GATE_SCHEMA);
  assert.equal(decision.field, 'birthDate');
  assert.equal(decision.supported, false);
  assert.equal(decision.liveSupportClaimed, false);
  assert.equal(decision.liveFillClaimed, false);
  assert.equal(decision.fillAllowed, false);
  assert.equal(decision.saveAllowed, false);
  assert.equal(decision.saveRefused, true);
  assert.equal(decision.saved, false);
  assert.equal(decision.skippedSave, true);
  assert.equal(decision.writeAttempted, false);
  assert.equal(decision.calendarClicked, false);
  assert.equal(decision.selector, null);
  assert.equal(decision.query, null);
  assert.equal(decision.hint.saveAllowed, false);
  assert.equal(decision.hint.key, 'birthDate');
  assert.equal(decision.hint.label, '出生日期');
  assert.equal(decision.hint.selectId, CMB_BIRTHDATE_HINT.selectId);
  assert.equal(birthDateHintAllowsSave(), false);
  const packed = JSON.stringify(decision);
  assert.equal(packed.includes('#'), false);
  assert.equal(packed.includes('type=date'), false);
  assert.equal(packed.includes('input[type'), false);
}

test('offline fixture keeps datepicker_hint_only and cannot Save', () => {
  const recorded = withoutNote(load('offline.json'));
  const decision = assessCmbBirthDateHint(null);
  assert.deepEqual(decision, { ...recorded, liveSupportClaimed: false });
  assert.deepEqual(decision, {
    ...CMB_BIRTHDATE_OFFLINE_GATE,
    hint: { ...CMB_BIRTHDATE_OFFLINE_GATE.hint }
  });
  assert.equal(decision.verdict, CMB_BIRTHDATE_RECORDED_VERDICT);
  assert.equal(decision.verdict, DATEPICKER_HINT_ONLY);
  assert.equal(decision.harvestLanded, false);
  assert.equal(decision.observedFacts, null);
  assert.equal(birthDateObservedFacts(decision), null);
  assertCannotSave(decision);
  assert.equal(CMB_BIRTHDATE_HINT.saveAllowed, false);
  assert.match(hintNext, /现状：`datepicker_hint_only`/);
  assert.match(hintNext, /RankingMajor 仍 `DOM_CONTROL_MISSING`/);
  assert.equal(CMB_RANKINGMAJOR_RECORDED_VERDICT, 'DOM_CONTROL_MISSING');
  assert.deepEqual(Object.values(CMB_BIRTHDATE_FILE_KEYS), [...CMB_BIRTHDATE_EVIDENCE_FILES]);
  for (const name of CMB_BIRTHDATE_EVIDENCE_FILES) {
    assert.match(livePack, new RegExp(name.replace('.', '\\.')));
  }
});

test('harvest packets map onto the five hint codes and never a selector', () => {
  const unobserved = assessCmbBirthDateHint(load('control-unobserved.json'));
  assert.equal(unobserved.verdict, DOB_CONTROL_UNOBSERVED);
  assert.equal(unobserved.observedFacts, null);
  assertCannotSave(unobserved);

  const missing = assessCmbBirthDateHint(load('hint-missing.json'));
  assert.equal(missing.verdict, DOB_HINT_MISSING);
  assert.equal(missing.observedFacts.observedId, 'fixtureDobNode');
  assert.equal(missing.observedFacts.inputType, 'text');
  assert.equal(missing.observedFacts.readOnly, true);
  const missingFacts = birthDateObservedFacts(missing);
  assert.equal(missingFacts.selector, null);
  assert.equal(missingFacts.saveAllowed, false);
  assert.equal(String(missingFacts.observedId).includes('#'), false);
  assertCannotSave(missing);

  const ambiguous = assessCmbBirthDateHint(load('hint-ambiguous.json'));
  assert.equal(ambiguous.verdict, DOB_HINT_AMBIGUOUS);
  assert.equal(ambiguous.calendarClicked, false);
  assert.equal(ambiguous.observedFacts.calendarEntryObserved, true);
  assertCannotSave(ambiguous);

  const unverified = assessCmbBirthDateHint(load('format-unverified.json'));
  assert.equal(unverified.verdict, DOB_FORMAT_UNVERIFIED);
  assert.equal(unverified.calendarClicked, false);
  assert.equal(unverified.observedFacts.placeholder, '请选择日期');
  assertCannotSave(unverified);

  const still = assessCmbBirthDateHint(load('still-hint-only.json'));
  assert.equal(still.verdict, DATEPICKER_HINT_ONLY);
  assert.equal(still.reason, 'observed_still_hint_only');
  assert.equal(still.supported, false);
  assert.equal(JSON.stringify(still).includes('1990-01-02'), false);
  assertCannotSave(still);

  const smuggled = assessCmbBirthDateHint(load('selector-smuggled.json'));
  assert.equal(smuggled.verdict, DATEPICKER_HINT_ONLY);
  assert.equal(smuggled.reason, 'selector_rejected');
  assert.equal(smuggled.observedFacts, null);
  assert.equal(JSON.stringify(smuggled).includes('#resume_basicInfo_birthday'), false);
  assert.equal(JSON.stringify(smuggled).includes('type=date'), false);
  assertCannotSave(smuggled);

  const saved = assessCmbBirthDateHint(load('save-attempted.json'));
  assert.equal(saved.reason, 'save_forbidden');
  assert.equal(saved.verdict, DATEPICKER_HINT_ONLY);
  assertCannotSave(saved);

  const clicked = assessCmbBirthDateHint(load('autoclick.json'));
  assert.equal(clicked.reason, 'interaction_forbidden');
  assert.equal(clicked.calendarClicked, false);
  assert.equal(clicked.observedFacts, null);
  assertCannotSave(clicked);
});

test('partial packets and the earlier birthday hint file do not upgrade support', () => {
  const base = load('format-unverified.json');
  const wrongLabel = assessCmbBirthDateHint({ ...base, labelText: '出生年月' });
  assert.equal(wrongLabel.verdict, DOB_CONTROL_UNOBSERVED);

  const autosave = assessCmbBirthDateHint({ ...base, autoSaveExcluded: false });
  assert.equal(autosave.verdict, DATEPICKER_HINT_ONLY);
  assert.equal(autosave.reason, 'autosave_not_excluded');
  assert.equal(autosave.saveAllowed, false);

  const notCollected = assessCmbBirthDateHint({
    ...base,
    files: { ...base.files, locator: false }
  });
  assert.equal(notCollected.verdict, DATEPICKER_HINT_ONLY);
  assert.equal(notCollected.reason, 'control_not_collected');

  const mismatch = assessCmbBirthDateHint({
    ...base,
    hint: { placeholder: 'YYYY-MM-DD', formatNote: '', pattern: '', conflicting: false }
  });
  assert.equal(mismatch.verdict, DOB_HINT_AMBIGUOUS);

  const prior = assessCmbBirthDateHint(priorHarvest);
  assert.equal(prior.verdict, DATEPICKER_HINT_ONLY);
  assert.equal(prior.reason, 'schema_unrecognized');
  assert.equal(prior.harvestLanded, false);
  assert.equal(prior.supported, false);
  assert.equal(prior.saveAllowed, false);
  assert.equal(prior.selector, null);
  assert.equal(prior.observedFacts, null);
  assert.equal(priorHarvest.field.selectId, 'resume_basicInfo_birthday');
  assert.notEqual(prior.reason, 'observed_still_hint_only');

  assert.equal(assessCmbBirthDateHint(undefined).verdict, DATEPICKER_HINT_ONLY);
  assert.equal(assessCmbBirthDateHint([]).reason, 'schema_unrecognized');
});

test('nested selector evidence and every forbidden action remain intake refusals', () => {
  const base = load('still-hint-only.json');
  for (const actions of [
    { saveAttempted: true },
    { submitAttempted: true },
    { nextAttempted: true },
    { deliverAttempted: true },
    { deleteAttempted: true }
  ]) {
    const decision = assessCmbBirthDateHint({ ...base, actions });
    assert.equal(decision.reason, 'save_forbidden');
    assert.equal(decision.observedFacts, null);
    assertCannotSave(decision);
  }
  for (const extra of [
    { evidence: [{ selector: '#unexpected' }] },
    { evidence: { a: { b: { c: { d: { e: { xpath: '//unexpected' } } } } } } }
  ]) {
    const decision = assessCmbBirthDateHint({ ...base, ...extra });
    assert.equal(decision.reason, 'selector_rejected');
    assert.equal(decision.observedFacts, null);
    assertCannotSave(decision);
  }
  const cyclic = { ...base };
  cyclic.evidence = cyclic;
  assert.equal(assessCmbBirthDateHint(cyclic).reason, 'selector_rejected');
});

test('hint-only plans cannot Save and do not keep a birthDate value', () => {
  const probe = createCmbBirthDateSaveProbe();
  const ready = plan({ birthDate: '1990-01-02' }, ['birthDate']);
  assert.equal(ready.values.birthDate, '1990-01-02');
  assert.equal(ready.blockers.find((row) => row.path === 'birthDate'), undefined);
  assert.equal(ready.birthDateHint.saveAllowed, false);
  assert.equal(ready.birthDateHint.liveFillClaimed, false);
  const hinted = plan({ birthDate: '不是日期' }, ['birthDate']);
  assert.equal(hinted.values.birthDate, '');
  assert.equal(hinted.blockers.find((row) => row.path === 'birthDate')?.reason, 'birthdate_unparseable');
  assert.equal(hinted.blockers.find((row) => row.path === 'birthDate')?.saveAllowed, false);
  assert.equal(hinted.birthDateHint.saveAllowed, false);

  const locked = attemptCmbBirthDateSave(hinted, probe);
  assert.equal(locked.hintOnly, false);
  assert.equal(locked.birthDateReason, 'birthdate_unparseable');
  assert.equal(locked.saveAllowed, false);
  assert.equal(locked.saved, false);
  assert.equal(locked.liveSupportClaimed, false);
  assert.equal(locked.skippedSave, true);
  assert.equal(locked.writeAttempted, false);
  assert.equal(locked.calendarClicked, false);
  assert.equal(locked.selector, null);
  assert.equal(locked.values.fullName, '测试甲');
  assert.equal(locked.values.birthDate, undefined);
  assert.equal(locked.saveCalls, 0);
  assert.equal(probe.calls.save, 0);
  assert.equal(probe.calls.submit, 0);
  assert.equal(probe.calls.calendar, 0);
  assert.equal(probe.calls.fill, 0);

  const tampered = plan({
    birthDate: '1990-01-02',
    gender: '女',
    height: '175',
    weight: '58',
    formalWork: '是'
  }, ['birthDate', 'gender', 'height', 'weight', 'formalWork']);
  tampered.values.birthDate = '1990-01-02';
  const stripped = attemptCmbBirthDateSave(tampered, probe);
  assert.equal(stripped.values.birthDate, undefined);
  assert.equal(stripped.values.gender, '女');
  assert.equal(stripped.values.height, '175');
  assert.equal(stripped.values.weight, '58');
  assert.equal(stripped.values.formalWork, '是');
  assert.equal(tampered.values.birthDate, '1990-01-02');
  assert.equal(probe.calls.save, 0);

  const unconfirmed = attemptCmbBirthDateSave(plan({ birthDate: '1990-01-02' }), probe);
  assert.equal(unconfirmed.hintOnly, false);
  assert.equal(unconfirmed.birthDateReason, 'profile_fact_unconfirmed');
  assert.equal(unconfirmed.saveAllowed, false);
  assert.equal(unconfirmed.values.birthDate, undefined);

  const absent = attemptCmbBirthDateSave(plan({ birthDate: '   ' }), probe);
  assert.equal(absent.birthDateReason, null);
  assert.equal(absent.hintOnly, false);
  assert.equal(absent.saveAllowed, false);
  assert.equal(absent.values.birthDate, undefined);

  assert.equal(probe.save(), 1);
  assert.equal(probe.calendar(), 1);
  const after = attemptCmbBirthDateSave(hinted, probe);
  assert.equal(after.saveCalls, 1);
  assert.equal(after.calendarCalls, 1);
  assert.equal(probe.calls.save, 1);
  assert.equal(probe.calls.calendar, 1);
});

test('save probes stay at zero across hint fixtures and the fill path refuses Save', () => {
  const names = readdirSync(fixtureDir).filter((name) => name.endsWith('.json')).sort();
  assert.ok(names.length >= 9);
  const probe = createCmbBirthDateSaveProbe();
  for (const name of names) {
    const input = name === 'offline.json' ? null : load(name);
    const decision = runCmbBirthDateHintGate(input, probe);
    assertCannotSave(decision);
    assert.equal(decision.saveCalls, 0);
    assert.equal(decision.submitCalls, 0);
    assert.equal(decision.calendarCalls, 0);
    assert.equal(decision.fillCalls, 0);
  }
  assert.equal(probe.calls.save, 0);
  assert.equal(probe.calls.calendar, 0);

  assert.doesNotMatch(moduleSource, /document|querySelector|click\(|ant-picker|ant-calendar|日历|保存|提交|投递/);
  assert.match(moduleSource, /Never Save/);
  assert.doesNotMatch(engineSource, /cmb-birthdate-hint-gate|DOB_HINT_|DOB_CONTROL_|DOB_FORMAT_/);
  assert.match(engineSource, /function fillBirthDate\(/);
  assert.match(engineSource, /function refuseHintSave\(/);
  assert.match(engineSource, /saveAllowed:\s*false/);
  assert.match(engineSource, /saveRefused:\s*true/);
  assert.doesNotMatch(engineSource, /bag\.save\s*\(/);
  assert.doesNotMatch(engineSource, /bag\.onSave\s*\(/);
  assert.doesNotMatch(engineSource, /bag\.submit\s*\(/);
  const hintFn = engineSource.slice(
    engineSource.indexOf('function birthDateHint'),
    engineSource.indexOf('async function fillText')
  );
  assert.match(hintFn, /refuseHintSave\(null\)/);
  assert.match(hintFn, /datepicker_hint_only/);
  const explicit = engineSource.slice(
    engineSource.indexOf('const birthRawExplicit'),
    engineSource.indexOf("reason: 'invalid_gender'")
  );
  assert.match(explicit, /refuseHintSave\(options\)/);
  assert.match(explicit, /birthdate_unparseable/);
  assert.doesNotMatch(explicit, /\.save\(|\.submit\(|click\(/);

  for (const name of names) {
    const text = readFileSync(resolve(fixtureDir, name), 'utf8');
    assert.equal(text.includes('PRIVATE KEY'), false);
    assert.equal(text.includes('BEGIN '), false);
  }

  const run = spawnSync(process.execPath, ['scripts/auto-cmb-basic.mjs', '--only', '出生日期'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 20000
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const payload = JSON.parse(run.stdout);
  assert.equal(payload.reason, 'synthetic_birthdate_picker_pass');
  assert.equal(payload.saveAllowed, false);
  assert.equal(payload.saveRefused, true);
  assert.equal(payload.saved, false);
  assert.equal(payload.skippedSave, true);
  assert.equal(payload.supported, false);
  assert.equal(payload.selector, null);
  assert.equal(payload.formFillClaimed, false);
  assert.equal(payload.liveFillClaimed, false);
  assert.equal(payload.saveClicks, 0);
});
