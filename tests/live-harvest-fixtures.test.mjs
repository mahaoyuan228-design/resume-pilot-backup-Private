/**
 * 2026-10-19 live packets, classified by the existing verdict helpers.
 * Owner name, phone, and email in the GTH body sample are placeholders.
 * Never Save. No site is claimed supported. No selector is invented.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessCmbRankingMajor } from '../src/content/cmb-rankingmajor-gate.mjs';
import {
  CMB_RANKINGMAJOR_RECORDED_VERDICT,
  DOM_CONTROL_MISSING,
  PROBE_INCONCLUSIVE,
  isCmbRankingMajorVerdictCode
} from '../src/content/cmb-rankingmajor-verdict.mjs';
import { assessCmbBirthDateHint } from '../src/content/cmb-birthdate-hint-gate.mjs';
import {
  CMB_BIRTHDATE_RECORDED_VERDICT,
  DATEPICKER_HINT_ONLY
} from '../src/content/cmb-birthdate-hint-verdict.mjs';
import { CMB_BIRTHDATE_HINT } from '../src/content/cmb-gated-dicts.mjs';
import {
  READINESS_FORM_VISIBLE,
  READINESS_NEEDS_LOGIN,
  classifyReadinessPacket
} from '../tools/live-harvest/readiness.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = resolve(root, 'tests/fixtures/live-harvest/20261019');

function load(name) {
  return JSON.parse(readFileSync(resolve(fixtureDir, name), 'utf8'));
}

function assertClosed(decision) {
  assert.equal(decision.supported, false);
  assert.equal(decision.liveFillClaimed, false);
  assert.equal(decision.fillAllowed, false);
  assert.equal(decision.saveAllowed, false);
  assert.equal(decision.saveRefused, true);
  assert.equal(decision.saved, false);
  assert.equal(decision.selector, null);
  assert.equal(decision.query, null);
  assert.equal(decision.writeAttempted, false);
}

test('CMB RankingMajor live packet is DOM_CONTROL_MISSING', () => {
  const packet = load('cmb-rankingmajor.json');
  const decision = assessCmbRankingMajor(packet);
  assert.equal(decision.verdict, DOM_CONTROL_MISSING);
  assert.equal(decision.verdict, CMB_RANKINGMAJOR_RECORDED_VERDICT);
  assert.equal(decision.verdict, packet.verdict);
  assert.equal(isCmbRankingMajorVerdictCode(decision.verdict), true);
  assert.equal(decision.harvestLanded, true);
  assert.equal(decision.gate, 'live_snap');
  assert.equal(decision.observedFacts, null);
  assert.equal(decision.dictProvesControl, false);
  assertClosed(decision);
  assert.equal(JSON.stringify(decision).includes('#'), false);
  assert.equal(packet.neverSave, true);
  assert.equal(packet.snap1.labelHits.length, 0);
  assert.equal(packet.snap2.labelHits.length, 0);
  assert.equal(packet.snap1.idHits.length, 0);
  assert.equal(packet.pageContext.hasForm, true);

  const hiddenForm = structuredClone(packet);
  hiddenForm.pageContext = { ...hiddenForm.pageContext, hasForm: false };
  assert.equal(assessCmbRankingMajor(hiddenForm).verdict, PROBE_INCONCLUSIVE);

  const smuggled = structuredClone(packet);
  smuggled.selector = '#not-in-evidence';
  const rejected = assessCmbRankingMajor(smuggled);
  assert.equal(rejected.verdict, PROBE_INCONCLUSIVE);
  assert.equal(rejected.reason, 'selector_rejected');
  assert.equal(rejected.selector, null);
  assert.equal(JSON.stringify(rejected).includes('#'), false);
});

test('CMB birthDate live packet stays datepicker_hint_only', () => {
  const packet = load('cmb-birthDate-hint.json');
  const decision = assessCmbBirthDateHint(packet);
  assert.equal(decision.verdict, DATEPICKER_HINT_ONLY);
  assert.equal(decision.verdict, CMB_BIRTHDATE_RECORDED_VERDICT);
  assert.equal(decision.calendarClicked, false);
  assertClosed(decision);
  assert.equal(packet.neverSave, true);
  assert.equal(packet.field.label, CMB_BIRTHDATE_HINT.label);
  assert.equal(packet.field.kindGuess, CMB_BIRTHDATE_HINT.kind);
  assert.equal(packet.field.input.id, CMB_BIRTHDATE_HINT.selectId);
  assert.equal(packet.field.input.placeholder, CMB_BIRTHDATE_HINT.placeholder);
  assert.equal(packet.field.input.readOnly, CMB_BIRTHDATE_HINT.readOnly);
  assert.equal(packet.field.panel, null);
  assert.match(packet.field.fillHint, /hint-only/);
  assert.match(packet.field.fillHint, /Never Save/);
});

test('Nanyue needs login and CMS/GTH stay form_visible_readonly_ok', () => {
  const nanyue = load('nanyue-readiness.json');
  const cms = load('cms-readiness.json');
  const gth = load('gth-readiness.json');

  assert.equal(classifyReadinessPacket(nanyue), READINESS_NEEDS_LOGIN);
  assert.equal(nanyue.probe.readiness, 'needs_login');
  assert.equal(nanyue.ok, false);
  assert.equal(nanyue.probe.loginHints, true);
  assert.equal(nanyue.probe.inputCount, 0);

  assert.equal(classifyReadinessPacket(cms), READINESS_FORM_VISIBLE);
  assert.equal(cms.probe.readiness, 'form_visible_readonly_ok');
  assert.equal(cms.ok, true);
  assert.equal(cms.probe.loginHints, false);
  assert.ok(cms.probe.inputCount > 0);

  assert.equal(classifyReadinessPacket(gth), READINESS_FORM_VISIBLE);
  assert.equal(gth.probe.readiness, 'form_visible_readonly_ok');
  assert.equal(gth.ok, true);
  assert.equal(gth.probe.loginHints, false);
  assert.ok(gth.probe.inputCount > 0);

  for (const packet of [nanyue, cms, gth]) {
    assert.equal(packet.neverSave, true);
    assert.match(packet.note, /NOT claimed supported/);
    assert.match(packet.note, /Never-Save/);
  }
});

test('fixtures keep the harvest and replace owner contact with placeholders', () => {
  const names = [
    'cmb-rankingmajor.json',
    'cmb-birthDate-hint.json',
    'nanyue-readiness.json',
    'cms-readiness.json',
    'gth-readiness.json'
  ];
  const packets = names.map((name) => load(name));
  const decoded = packets.flatMap((packet) => collectStrings(packet)).join('\n');
  for (const packet of packets) {
    assert.equal(packet.neverSave, true);
    assert.equal(packet.runId, '2026-10-19T15-49-34-129Z');
  }
  const raw = names.map((name) => readFileSync(resolve(fixtureDir, name), 'utf8')).join('\n');
  assert.equal(raw.includes('PRIVATE KEY'), false);
  assert.equal(raw.includes('BEGIN '), false);
  const gth = packets[4];
  assert.match(gth.probe.bodySample, /实习生招聘\n测试用户\n13800000000\|test@example.com\n基本信息/);
  assert.match(gth.probe.bodySample, /手机号码\n13800000000修改/);
  assert.match(gth.probe.bodySample, /电子邮件\ntest@example.com修改/);
  const phones = decoded.match(/1[3-9]\d{9}/g) || [];
  assert.deepEqual([...new Set(phones)], ['13800000000']);
  const emails = decoded.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
  assert.deepEqual([...new Set(emails)], ['test@example.com']);
});

function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => collectStrings(item, out));
  return out;
}
