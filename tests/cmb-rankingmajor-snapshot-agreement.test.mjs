/**
 * Offline mutations of the recorded packet test evidence handling, not new DOM.
 * The only positive control token comes from the existing synthetic fixture.
 * Never Save. No interaction or live support is claimed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assessCmbRankingMajor,
  createCmbRankingMajorSaveProbe,
  runCmbRankingMajorGate
} from '../src/content/cmb-rankingmajor-gate.mjs';
import {
  DOM_CONTROL_AMBIGUOUS,
  DOM_CONTROL_MISSING,
  DOM_CONTROL_PRESENT,
  PROBE_INCONCLUSIVE
} from '../src/content/cmb-rankingmajor-verdict.mjs';

const recorded = JSON.parse(readFileSync(new URL('./fixtures/live-harvest/20261019/cmb-rankingmajor.json', import.meta.url), 'utf8'));
const synthetic = JSON.parse(readFileSync(new URL('./fixtures/cmb-rankingmajor-gate/harvest-present.json', import.meta.url), 'utf8'));
const label = {
  labelText: synthetic.labelText,
  hasInput: true,
  inputId: synthetic.control.observedId,
  visible: synthetic.control.visible
};

function presentPacket() {
  const packet = structuredClone(recorded);
  for (const snap of [packet.snap1, packet.snap2]) {
    snap.labelHits = [{ ...label }];
    snap.idHits = [label.inputId];
    snap.rankingishLabels = [label.labelText];
  }
  return packet;
}

function assertClosed(packet, verdict, reason) {
  const probe = createCmbRankingMajorSaveProbe();
  const decision = runCmbRankingMajorGate(packet, probe);
  assert.equal(decision.verdict, verdict);
  if (reason) assert.equal(decision.reason, reason);
  for (const flag of ['supported', 'liveSupportClaimed', 'liveFillClaimed', 'fillAllowed', 'wireAllowed', 'saveAllowed', 'saved', 'writeAttempted']) {
    assert.equal(decision[flag], false, flag);
  }
  assert.equal(decision.selector, null);
  assert.equal(decision.query, null);
  assert.equal(decision.saveRefused, true);
  assert.equal(decision.observedFacts, null);
  assert.deepEqual(probe.calls, { save: 0, submit: 0, fill: 0 });
  return decision;
}

test('recorded missing verdict remains stable with two complete empty snapshots', () => {
  assertClosed(recorded, DOM_CONTROL_MISSING);
  assertClosed(presentPacket(), DOM_CONTROL_PRESENT, 'presence_is_not_support');
});

test('second snapshot evidence cannot be ignored when claiming missing', () => {
  for (const key of ['idHits', 'rankingishLabels']) {
    const packet = structuredClone(recorded);
    packet.snap2[key] = [key === 'idHits' ? label.inputId : label.labelText];
    assertClosed(packet, PROBE_INCONCLUSIVE, 'snapshots_disagree');
  }
  const packet = structuredClone(recorded);
  packet.snap2.labelHits = [{ ...label }];
  assertClosed(packet, PROBE_INCONCLUSIVE, 'snapshots_disagree');
});

test('equal label counts cannot hide a changed association or missing control', () => {
  for (const mutate of [
    (row) => { row.hasInput = false; row.inputId = null; },
    (row) => { row.inputId = null; },
    (row) => { row.labelText = '中等'; },
    (row) => { row.visible = false; }
  ]) {
    const packet = presentPacket();
    mutate(packet.snap2.labelHits[0]);
    assertClosed(packet, PROBE_INCONCLUSIVE, 'snapshots_disagree');
  }
  const hidden = presentPacket();
  hidden.snap1.labelHits[0].visible = false;
  hidden.snap2.labelHits[0].visible = false;
  assertClosed(hidden, DOM_CONTROL_PRESENT, 'presence_is_not_support');
});

test('unassociated recorded hints remain ambiguous rather than missing', () => {
  for (const key of ['idHits', 'rankingishLabels']) {
    const packet = structuredClone(recorded);
    const hint = key === 'idHits' ? label.inputId : label.labelText;
    packet.snap1[key] = [hint];
    packet.snap2[key] = [hint];
    assertClosed(packet, DOM_CONTROL_AMBIGUOUS);
  }
  const named = structuredClone(recorded);
  named.snap1.nameHits = [label.inputId];
  assertClosed(named, DOM_CONTROL_AMBIGUOUS);

  const multiple = presentPacket();
  multiple.snap1.labelHits.push({ ...label });
  multiple.snap2.labelHits.push({ ...label });
  assertClosed(multiple, DOM_CONTROL_AMBIGUOUS);

  const duplicateIds = presentPacket();
  duplicateIds.snap1.idHits.push(label.inputId);
  duplicateIds.snap2.idHits.push(label.inputId);
  assertClosed(duplicateIds, DOM_CONTROL_AMBIGUOUS);
});

test('failed, incomplete, and malformed snapshots are inconclusive', () => {
  for (const mutate of [
    (packet) => { packet.ok = false; },
    (packet) => { packet.pageContext.loginHints = true; },
    (packet) => { delete packet.snap2.idHits; },
    (packet) => { delete packet.snap1.rankingishLabels; },
    (packet) => { delete packet.snap1.nameHits; },
    (packet) => { delete packet.snap1.allLabelCount; },
    (packet) => { packet.snap1.allLabelCount = 0; },
    (packet) => { packet.snap1.nameHits = 'not-an-array'; },
    (packet) => { packet.snap2.idHits = [null]; },
    (packet) => { packet.snap2.labelHits = [{ ...label, hasInput: 'true' }]; },
    (packet) => { packet.snap1.labelHits = [null]; }
  ]) {
    const packet = structuredClone(recorded);
    mutate(packet);
    assertClosed(packet, PROBE_INCONCLUSIVE);
  }
});

test('selector keys inside arrays and deeper metadata are rejected', () => {
  for (const packet of [structuredClone(recorded), structuredClone(synthetic)]) {
    packet.metadata = [{ nested: [{ next: { next: { next: { next: { query: label.inputId } } } } }] }];
    const decision = assessCmbRankingMajor(packet);
    assert.equal(decision.verdict, PROBE_INCONCLUSIVE);
    assert.equal(decision.reason, 'selector_rejected');
    assert.equal(decision.selector, null);
    assert.equal(decision.liveSupportClaimed, false);
  }
});
