/**
 * Internship soft-skip diagnostics (pass N):
 * - missing dates → missing_profile_value (no invented dates)
 * - present but unconfirmed → profile_fact_unconfirmed + valuePreview
 * - confirmed ready facts stay ready
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlan, sourceSnapshot } from '../src/profile/cms-internship-plan.mjs';
import { ownerBindingFor } from '../src/profile/cms-education-plan.mjs';

const baseRow = {
  type: 'internship',
  organization: '中信证券股份有限公司',
  position: '实习生',
  description: '围绕房地产金融政策做专题研究',
  startDate: '',
  endDate: '',
};

async function planFor(row, confirmedKeys) {
  const profile = {
    schemaVersion: 1,
    fullName: 'Synthetic',
    experience: [row],
    confirmedFields: confirmedKeys.map((key) => `experience.0.${key}`),
  };
  const ownerBinding = await ownerBindingFor(profile, '00000000-0000-4000-8000-000000000099');
  const source = await sourceSnapshot(profile, 0);
  return createPlan(profile, [{
    profileIndex: 0,
    sourceSnapshotHash: source.hash,
    target: { mode: 'new' },
    replaceExisting: false,
  }], [], ownerBinding);
}

test('empty dates soft-skip as missing_profile_value without inventing', async () => {
  const plan = await planFor(baseRow, ['organization', 'type', 'position', 'description']);
  const facts = plan.records[0].facts;
  assert.equal(facts.startDate.status, 'skipped');
  assert.equal(facts.startDate.reason, 'missing_profile_value');
  assert.equal(facts.startDate.hasProfileValue, false);
  assert.equal(facts.endDate.reason, 'missing_profile_value');
  assert.equal(facts.organization.status, 'ready');
});

test('unconfirmed present facts include valuePreview and confirmed:false', async () => {
  const plan = await planFor(baseRow, []); // nothing confirmed
  const facts = plan.records[0].facts;
  for (const key of ['organization', 'type', 'position', 'description']) {
    assert.equal(facts[key].status, 'skipped');
    assert.equal(facts[key].reason, 'profile_fact_unconfirmed');
    assert.equal(facts[key].hasProfileValue, true);
    assert.equal(facts[key].confirmed, false);
    assert.equal(typeof facts[key].valuePreview, 'string');
    assert.ok(facts[key].valuePreview.length > 0);
  }
  assert.match(facts.organization.valuePreview, /中信证券/);
  assert.equal(facts.type.valuePreview, 'internship');
});

test('zero ready facts → all skipped (controller will abort before add)', async () => {
  const plan = await planFor(baseRow, []);
  const ready = Object.values(plan.records[0].facts).filter((f) => f.status === 'ready');
  assert.equal(ready.length, 0);
});

test('confirmed full-day dates become ready', async () => {
  const plan = await planFor({
    ...baseRow,
    startDate: '2022-07-01',
    endDate: '2022-09-30',
  }, ['startDate', 'endDate', 'organization', 'type', 'position', 'description']);
  const facts = plan.records[0].facts;
  assert.equal(facts.startDate.status, 'ready');
  assert.equal(facts.endDate.status, 'ready');
  assert.equal(facts.organization.status, 'ready');
});
