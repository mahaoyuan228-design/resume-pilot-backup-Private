/**
 * Offline regression coverage using the existing bounded fictional six-field
 * internship fixture and shipped controller, adapters, and read-only props proof.
 * No new employer DOM, browser connection, network, or live-support claim.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { internshipFixture } from './fixtures/cms-internship-fixture.mjs';
import { createPlan, sourceSnapshot, PAGE, FIELDS } from '../src/profile/cms-internship-plan.mjs';
import { ownerBindingFor } from '../src/profile/cms-education-plan.mjs';
import { readCmsInternshipSerialization, verifyInternshipSerialization } from '../src/content/cms-internship-serialization.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
const epoch = '00000000-0000-4000-8000-000000000077';
const files = [
  'src/content/cms-record-controller.js',
  'src/content/cms-internship-multi.js',
  'src/content/cms-education-multi-dates.js',
  'src/content/cms-education-multi-select.js',
  'src/content/cms-internship-adapters.js'
];
const sources = await Promise.all(files.map(file => readFile(file, 'utf8')));
const html = internshipFixture();
const completeRow = (index = 0) => ({
  type: 'internship', organization: `Fictional organization ${index}`,
  position: `Fictional position ${index}`, description: `Fictional description ${index}`,
  startDate: '2022-07-01', endDate: '2022-09-30'
});
const profileFor = (experience, keys = FIELDS.map(field => field.key)) => ({
  schemaVersion: 1, fullName: 'Fictional applicant', experience,
  confirmedFields: experience.flatMap((_row, index) => keys.map(key => `experience.${index}.${key}`))
});

async function harness(t, { rowCount = 1 } = {}) {
  const dom = new JSDOM(await html, {
    url: PAGE, pretendToBeVisual: true, runScripts: 'dangerously',
    beforeParse(window) {
      window.structuredClone = structuredClone;
      window.TextEncoder = TextEncoder;
      Object.defineProperty(window.crypto, 'subtle', { value: webcrypto.subtle });
      window.Element.prototype.getClientRects = function () { return this.isConnected ? [{}] : []; };
      window.fetch = () => { throw Error('offline_only'); };
      window.XMLHttpRequest.prototype.send = () => { throw Error('offline_only'); };
    }
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  Object.defineProperty(window.document, 'visibilityState', { get: () => 'visible' });
  window.document.hasFocus = () => true;
  // Add is the fixture's already-proven record surface. Never click any action
  // that can persist, advance, deliver, or remove an application.
  for (let index = 1; index < rowCount; index += 1) window.document.querySelector('.add-more').click();
  const clicks = [], prohibited = [], textEvents = [];
  window.document.addEventListener('click', event => {
    const node = event.target.closest('button,input,.ant-select-selection,.add-more,li');
    clicks.push(node?.id || node?.className || event.target.tagName);
    if (node?.matches('button') || /保存|提交|下一步|投递|删除/u.test(node?.textContent || '')) {
      prohibited.push(node?.id || node?.textContent);
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
  window.document.addEventListener('submit', event => {
    prohibited.push('submit'); event.preventDefault(); event.stopImmediatePropagation();
  }, true);
  for (const type of ['input', 'change', 'blur']) window.document.addEventListener(type,
    event => textEvents.push({ type, target: event.target }), true);
  for (const source of sources) window.eval(source);
  const api = window.ResumeCmsInternshipMulti;
  const original = plain(window.fixtureSnapshot());
  const stats = { owner: 0, source: 0, serialization: 0 };
  const services = {
    verifyBeforeWrite: async () => true,
    checkOwner: async () => { stats.owner += 1; return true; },
    checkSource: async () => { stats.source += 1; return true; },
    readSerialization: async () => {
      stats.serialization += 1;
      return plain(window.eval(`(${readCmsInternshipSerialization.toString()})()`));
    },
    verifySerialization: async (plan, bindings, proof) => verifyInternshipSerialization(plan, plain(bindings), proof),
    adapters: window.ResumeCmsInternshipMultiAdapters
  };
  const planFor = async (profile, requests = api.inspect().records.map((row, profileIndex) => ({
    profileIndex, target: { mode: 'existing', identity: row.identity }, replaceExisting: false
  }))) => {
    const owner = await ownerBindingFor(profile, epoch);
    const bound = await Promise.all(requests.map(async request => ({
      ...request, sourceSnapshotHash: (await sourceSnapshot(profile, request.profileIndex)).hash
    })));
    return createPlan(profile, bound, [], owner);
  };
  const input = (index, key) => window.document.getElementById(`49170501_${{
    organization: 49170514, position: 49170519, description: 49170523
  }[key]}_${index}`).querySelector('input,textarea');
  const assertNeverSave = result => {
    assert.deepEqual(prohibited, []);
    assert.equal(window.fixtureCounts.saves, 0);
    assert.equal(window.fixtureCounts.submits, 0);
    for (const key of ['saveClicks', 'deleteClicks', 'finalSubmitClicks']) assert.equal(result[key], 0, key);
    const snapshot = plain(window.fixtureSnapshot());
    assert.equal(snapshot.outside, original.outside);
    assert.equal(snapshot.education, original.education);
    assert.equal(window.ResumeProfileWriteContext, undefined);
  };
  return { window, api, services, stats, clicks, textEvents, planFor, input, original, assertNeverSave };
}

test('occupied internship dates, select, input and textarea are skipped without events or widget clicks', async t => {
  const h = await harness(t);
  h.window.fixtureSeed({ ...completeRow(9), startDate: '2021-07-01', endDate: '2021-09-30' });
  h.window.document.getElementById('49170501_49170517_0')
    .querySelector('.ant-select-selection-selected-value').textContent = '全职';
  h.window.fixtureProps.formData['49170501_49170517_1'] = '0/461/578';
  const before = plain(h.window.fixtureSnapshot());
  const result = await h.api.run(await h.planFor(profileFor([completeRow()])), h.services);
  assert.equal(result.ok, true);
  assert.equal(result.complete, false);
  assert.equal(result.reason, 'internship_records_partial');
  assert.equal(result.fields.length, 6);
  assert.ok(result.fields.every(field => field.status === 'skipped' && field.reason === 'existing_value'));
  assert.deepEqual(plain(h.window.fixtureSnapshot()), before);
  assert.deepEqual(h.textEvents, []);
  assert.deepEqual(h.clicks, []);
  h.assertNeverSave(result);
});

test('identical existing six-field values verify from props without refilling or opening a widget', async t => {
  const h = await harness(t), row = completeRow();
  h.window.fixtureSeed(row);
  const before = plain(h.window.fixtureSnapshot());
  const result = await h.api.run(await h.planFor(profileFor([row])), h.services);
  assert.equal(result.complete, true, JSON.stringify(result));
  assert.ok(result.fields.every(field => field.status === 'verified' && field.reason === 'preexisting_same_value'));
  assert.equal(result.serializedRecordCount, 1);
  assert.deepEqual(plain(h.window.fixtureSnapshot()), before);
  assert.deepEqual(h.textEvents, []);
  assert.deepEqual(h.clicks, []);
  h.assertNeverSave(result);
});

test('missing, unconfirmed, and imprecise facts soft-skip while confirmed text commits to the same row', async t => {
  const h = await harness(t);
  const row = { ...completeRow(), startDate: '', endDate: '2022-09' };
  const plan = await h.planFor(profileFor([row], ['organization', 'position', 'endDate']));
  const result = await h.api.run(plan, h.services);
  const fields = Object.fromEntries(result.fields.map(field => [field.key, field]));
  assert.equal(result.ok, true);
  assert.equal(result.complete, false);
  assert.equal(result.reason, 'internship_records_partial');
  assert.equal(fields.startDate.reason, 'missing_profile_value');
  assert.equal(fields.startDate.hasProfileValue, false);
  assert.equal(fields.endDate.reason, 'insufficient_date_precision');
  assert.equal(fields.endDate.fullDay, false);
  for (const key of ['type', 'description']) {
    assert.equal(fields[key].reason, 'profile_fact_unconfirmed');
    assert.equal(fields[key].confirmed, false);
    assert.equal(typeof fields[key].valuePreview, 'string');
  }
  for (const key of ['organization', 'position']) {
    assert.equal(fields[key].status, 'verified');
    assert.equal(h.input(0, key).value, row[key]);
    assert.equal(h.window.fixtureProps.formData[`49170501_${key === 'organization' ? 49170514 : 49170519}_1`], row[key]);
  }
  assert.deepEqual(h.clicks, []);
  assert.equal(h.window.fixtureCounts.adds, 0);
  assert.ok(h.textEvents.every(event => [h.input(0, 'organization'), h.input(0, 'position')].includes(event.target)));
  h.assertNeverSave(result);
});

test('zero ready facts stop before Add, binding, source checks, or serialization', async t => {
  const h = await harness(t);
  const profile = profileFor([{ ...completeRow(), startDate: '', endDate: '' }], []);
  const plan = await h.planFor(profile, [{ profileIndex: 0, target: { mode: 'new' }, replaceExisting: false }]);
  const before = plain(h.window.fixtureSnapshot());
  const result = await h.api.run(plan, h.services);
  assert.equal(result.ok, true);
  assert.equal(result.complete, false);
  assert.equal(result.reason, 'internship_record_not_ready');
  assert.equal(result.writeStarted, false);
  assert.equal(result.addClicks, 0);
  assert.equal(result.provisionalNewRecords, 0);
  assert.deepEqual(plain(result.bindings), []);
  assert.equal(result.fields.length, 6);
  assert.ok(result.fields.every(field => field.status === 'skipped'));
  assert.deepEqual(h.stats, { owner: 0, source: 0, serialization: 0 });
  assert.deepEqual(plain(h.window.fixtureSnapshot()), before);
  assert.deepEqual(h.clicks, []);
  h.assertNeverSave(result);
});

for (const readyTarget of ['existing', 'new']) {
  test(`mixed batch with a ready ${readyTarget} record refuses a zero-ready new source before any action`, async t => {
    const h = await harness(t);
    const identity = h.api.inspect().records[0].identity;
    const profile = profileFor([completeRow(), completeRow(1), completeRow(2)], []);
    const readyIndex = readyTarget === 'existing' ? 0 : 1;
    profile.confirmedFields = FIELDS.map(field => `experience.${readyIndex}.${field.key}`);
    const requests = [
      { profileIndex: 0, target: { mode: 'existing', identity }, replaceExisting: false },
      { profileIndex: 1, target: { mode: 'new' }, replaceExisting: false },
      ...(readyTarget === 'new' ? [{ profileIndex: 2, target: { mode: 'new' }, replaceExisting: false }] : [])
    ];
    const plan = await h.planFor(profile, requests);
    const result = await h.api.run(plan, h.services);
    assert.equal(result.ok, true);
    assert.equal(result.complete, false);
    assert.equal(result.reason, 'internship_record_not_ready');
    assert.equal(result.writeStarted, false);
    assert.equal(result.addClicks, 0);
    assert.equal(result.provisionalNewRecords, 0);
    assert.equal(result.fields.length, requests.length * 6);
    assert.ok(result.fields.every(field => field.status === 'skipped'));
    assert.ok(result.fields.filter(field => field.profileIndex === readyIndex)
      .every(field => field.reason === 'internship_record_not_ready'));
    assert.ok(result.fields.filter(field => field.profileIndex !== readyIndex)
      .every(field => field.reason === 'profile_fact_unconfirmed'));
    assert.deepEqual(plain(result.bindings), []);
    assert.deepEqual(h.stats, { owner: 0, source: 0, serialization: 0 });
    assert.deepEqual(plain(h.window.fixtureSnapshot()), h.original);
    assert.deepEqual(h.textEvents, []);
    assert.deepEqual(h.clicks, []);
    h.assertNeverSave(result);
  });
}

test('an unconfirmed existing record does not block a ready new record from its own row', async t => {
  const h = await harness(t);
  const identity = h.api.inspect().records[0].identity;
  const profile = profileFor([completeRow(), completeRow(1)], []);
  profile.confirmedFields = ['experience.1.organization'];
  const plan = await h.planFor(profile, [
    { profileIndex: 0, target: { mode: 'existing', identity }, replaceExisting: false },
    { profileIndex: 1, target: { mode: 'new' }, replaceExisting: false }
  ]);
  const result = await h.api.run(plan, h.services);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.complete, false);
  assert.equal(result.addClicks, 1);
  assert.equal(result.bindings.length, 2);
  assert.equal(h.input(0, 'organization').value, '');
  assert.equal(h.input(1, 'organization').value, profile.experience[1].organization);
  assert.ok(result.fields.filter(field => field.profileIndex === 0).every(field => field.status === 'skipped'));
  assert.ok(h.textEvents.every(event => event.target === h.input(1, 'organization')));
  h.assertNeverSave(result);
});

test('owner change before binding rejects an existing/new pair without Add or text events', async t => {
  const h = await harness(t);
  const identity = h.api.inspect().records[0].identity;
  const plan = await h.planFor(profileFor([completeRow(), completeRow(1)], ['organization']), [
    { profileIndex: 0, target: { mode: 'existing', identity }, replaceExisting: false },
    { profileIndex: 1, target: { mode: 'new' }, replaceExisting: false }
  ]);
  h.services.checkOwner = async () => false;
  const result = await h.api.run(plan, h.services);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'education_owner_profile_changed');
  assert.equal(result.writeStarted, false);
  assert.equal(result.addClicks, 0);
  assert.deepEqual(h.textEvents, []);
  assert.deepEqual(h.clicks, []);
  h.assertNeverSave(result);
});

test('owner change on first input aborts before change, blur, the next fact, or serialization', async t => {
  const h = await harness(t);
  const plan = await h.planFor(profileFor([completeRow()], ['organization', 'position']));
  let owned = true;
  h.services.checkOwner = async () => owned;
  h.input(0, 'organization').addEventListener('input', () => { owned = false; });
  const result = await h.api.run(plan, h.services);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'profile_binding_changed');
  assert.equal(result.writeStarted, true);
  assert.equal(h.input(0, 'position').value, '');
  assert.deepEqual(h.textEvents.map(event => event.type), ['input']);
  assert.equal(h.stats.serialization, 0);
  assert.deepEqual(h.clicks, []);
  h.assertNeverSave(result);
});

test('source snapshot change before filling stops with the original record untouched', async t => {
  const h = await harness(t);
  const plan = await h.planFor(profileFor([completeRow()], ['organization']));
  let checks = 0;
  h.services.checkSource = async () => ++checks === 1;
  const result = await h.api.run(plan, h.services);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'education_source_snapshot_changed');
  assert.equal(result.writeStarted, false);
  assert.equal(checks, 2);
  assert.deepEqual(h.textEvents, []);
  assert.deepEqual(plain(h.window.fixtureSnapshot()), h.original);
  h.assertNeverSave(result);
});

test('two existing rows keep profile bindings when request order is reversed and one record is unconfirmed', async t => {
  const h = await harness(t, { rowCount: 2 });
  const profile = profileFor([completeRow(), completeRow(1)], ['organization']);
  profile.confirmedFields = ['experience.1.organization'];
  const rows = h.api.inspect().records;
  const plan = await h.planFor(profile, [1, 0].map(profileIndex => ({
    profileIndex, target: { mode: 'existing', identity: rows[profileIndex].identity }, replaceExisting: false
  })));
  const result = await h.api.run(plan, h.services);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.complete, false);
  assert.equal(result.fields.filter(field => field.status === 'verified').length, 1);
  assert.equal(h.input(0, 'organization').value, '');
  assert.equal(h.input(1, 'organization').value, profile.experience[1].organization);
  assert.equal(result.serializedRecordCount, 2);
  assert.deepEqual(plain(result.bindings.map(binding => [binding.profileIndex, binding.identity])),
    [1, 0].map(index => [index, rows[index].identity]));
  assert.ok(h.textEvents.every(event => event.target === h.input(1, 'organization')));
  assert.deepEqual(h.clicks, []);
  h.assertNeverSave(result);
});

test('settled partial retry reuses its added row and does not Add or rewrite text again', async t => {
  const h = await harness(t);
  const identity = h.api.inspect().records[0].identity;
  const plan = await h.planFor(profileFor([completeRow(), completeRow(1)], ['organization']), [
    { profileIndex: 0, target: { mode: 'existing', identity }, replaceExisting: false },
    { profileIndex: 1, target: { mode: 'new' }, replaceExisting: false }
  ]);
  const first = await h.api.run(plan, h.services);
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal(first.complete, false);
  assert.equal(first.addClicks, 1);
  const before = plain(h.window.fixtureSnapshot()), events = h.textEvents.length, clicks = h.clicks.length;
  const second = await h.api.run(plan, h.services);
  assert.equal(second.ok, true, JSON.stringify(second));
  assert.equal(second.complete, false);
  assert.equal(second.addClicks, 0);
  assert.deepEqual(plain(second.bindings), plain(first.bindings));
  assert.deepEqual(plain(h.window.fixtureSnapshot()), before);
  assert.equal(h.textEvents.length, events);
  assert.equal(h.clicks.length, clicks);
  h.assertNeverSave(first);
  h.assertNeverSave(second);
});

test('cached binding identity drift stops a partial retry before Add or retargeting', async t => {
  const h = await harness(t);
  const plan = await h.planFor(profileFor([completeRow()], ['organization']));
  const first = await h.api.run(plan, h.services);
  assert.equal(first.ok, true);
  // Change one existing wrapper ID; do not invent another employer surface.
  h.window.document.getElementById('49170501_49170514_0').id = '49170501_49170514_7';
  const before = plain(h.window.fixtureSnapshot()), events = h.textEvents.length;
  const result = await h.api.run(plan, h.services);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'education_cached_binding_changed');
  assert.equal(result.writeStarted, false);
  assert.equal(result.addClicks, 0);
  assert.deepEqual(plain(h.window.fixtureSnapshot()), before);
  assert.equal(h.textEvents.length, events);
  assert.deepEqual(h.clicks, []);
  h.assertNeverSave(result);
});

test('an unbound existing row cannot be silently ignored or overwritten', async t => {
  const h = await harness(t, { rowCount: 2 });
  const plan = await h.planFor(profileFor([completeRow()], ['organization']), [{
    profileIndex: 0, target: { mode: 'existing', identity: h.api.inspect().records[0].identity }, replaceExisting: false
  }]);
  const result = await h.api.run(plan, h.services);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'education_unbound_existing_row');
  assert.equal(result.writeStarted, false);
  assert.deepEqual(plain(h.window.fixtureSnapshot()), h.original);
  assert.deepEqual(h.textEvents, []);
  assert.deepEqual(h.clicks, []);
  h.assertNeverSave(result);
});

test('matching text DOM cannot pass when the actual props serialization did not commit', async t => {
  const h = await harness(t);
  const plan = await h.planFor(profileFor([completeRow()], ['organization']));
  h.input(0, 'organization').addEventListener('change', () => {
    h.window.fixtureProps.formData['49170501_49170514_1'] = 'Fictional stale parent value';
  });
  const result = await h.api.run(plan, h.services);
  const field = result.fields.find(field => field.key === 'organization');
  assert.equal(h.input(0, 'organization').value, completeRow().organization);
  assert.equal(result.ok, true);
  assert.equal(result.complete, false);
  assert.equal(field.domStatus, 'verified');
  assert.equal(field.status, 'failed');
  assert.equal(field.reason, 'react_serialization_mismatch');
  assert.equal(h.stats.serialization, 1);
  assert.deepEqual(h.clicks, []);
  h.assertNeverSave(result);
});

test('revision 16 internship controller is rebound once; a busy write context preserves it', async t => {
  const h = await harness(t), prior = { version: 3, implementationRevision: 16 };
  h.window.ResumeCmsInternshipMulti = prior;
  h.window.ResumeProfileWriteContext = { check: async () => {} };
  assert.throws(() => h.window.installResumeCmsRecordController('internship'), /profile_write_context_busy/u);
  assert.equal(h.window.ResumeCmsInternshipMulti, prior);
  h.window.ResumeProfileWriteContext = undefined;
  h.window.installResumeCmsRecordController('internship');
  const current = h.window.ResumeCmsInternshipMulti;
  assert.notEqual(current, prior);
  assert.equal(current.implementationRevision, 17);
  h.window.installResumeCmsRecordController('internship');
  assert.equal(h.window.ResumeCmsInternshipMulti, current);
  assert.deepEqual(plain(h.window.fixtureSnapshot()), h.original);
  assert.deepEqual(h.clicks, []);
  assert.deepEqual(h.textEvents, []);
});
