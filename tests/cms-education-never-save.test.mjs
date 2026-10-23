/**
 * Offline only. DOM comes from cms-education-fixture.mjs, which composes the
 * repository's existing school/calendar/cascader fixtures. Error paths use
 * their existing controls and fault switches; no employer DOM is inferred.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { integrationFixture } from './fixtures/cms-education-fixture.mjs';
import { FIELDS, PAGE, hash } from '../src/profile/cms-education-plan.mjs';
import { readCmsEducationSerialization, verifyEducationSerialization } from '../src/content/cms-education-serialization.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
const catalog = {
  schools: ['Fictional School Alpha', 'Fictional School Beta'],
  regions: [
    { province: 'Fictional Province Alpha', city: 'Fictional City Alpha' },
    { province: 'Fictional Province Beta', city: 'Fictional City Beta' }
  ]
};
const html = await integrationFixture(catalog);
const runtime = await Promise.all([
  'cms-record-controller.js', 'cms-education-multi.js',
  'cms-education-multi-school.js', 'cms-education-multi-dates.js',
  'cms-education-multi-select.js', 'cms-education-multi-adapters.js'
].map(file => readFile(`src/content/${file}`, 'utf8')));

async function fixture(t, rowCount = 2) {
  const dom = new JSDOM(html, {
    url: PAGE, pretendToBeVisual: true, runScripts: 'dangerously',
    beforeParse(window) {
      window.structuredClone = structuredClone;
      window.TextEncoder = TextEncoder;
      Object.defineProperty(window.crypto, 'subtle', { value: webcrypto.subtle });
      window.Element.prototype.getClientRects = function () { return this.isConnected ? [{}] : []; };
    }
  });
  const { window } = dom;
  const forbidden = [];
  Object.defineProperty(window.document, 'visibilityState', { configurable: true, value: 'visible' });
  window.document.hasFocus = () => true;
  // These are passive traps. Tests never probe a forbidden action by clicking it.
  window.document.addEventListener('click', event => {
    if (event.target.closest('#save,button[type="submit"]')) forbidden.push('click');
  }, true);
  window.document.addEventListener('submit', () => forbidden.push('submit'), true);
  window.fetch = () => { forbidden.push('network'); throw new Error('offline_only'); };
  for (let index = 1; index < rowCount; index += 1) window.document.querySelector('.add-more').click();
  for (const source of runtime) window.eval(source);
  const controller = window.ResumeCmsEducationMulti;
  const identities = controller.inspect().records.map(row => row.identity);
  const field = (key, index = 1) => controller.locateField(window.document.querySelector('form'), identities[index], FIELDS.find(item => item.key === key).question);
  const binding = (key, index = 1, replaceExisting = false) => ({
    profileIndex: index, rowIdentity: identities[index], key,
    question: FIELDS.find(item => item.key === key).question,
    sourcePath: `education.${index}.${key}`, confirmed: true, replaceExisting
  });
  const snapshot = () => plain(window.fixtureSnapshot());
  const adapters = window.ResumeCmsEducationMultiAdapters;
  const fill = (key, value, index = 1, replaceExisting = false) => {
    const current = field(key, index);
    return adapters[FIELDS.find(item => item.key === key).kind](current, { value, optionText: value }, binding(key, index, replaceExisting), {
      form: window.document.querySelector('form'), locate: () => field(key, index)
    });
  };
  t.after(() => {
    assert.deepEqual(forbidden, [], 'no Save, submit, or network action');
    assert.equal(window.fixtureCounts.saves, 0);
    assert.equal(window.fixtureCounts.submits, 0);
    dom.window.close();
  });
  return { window, controller, identities, field, binding, snapshot, fill };
}

function untouchedRows(before, after) {
  // The reused school/cascader widgets report the document-wide menu count.
  // A target row opening/closing its menu is not a change to its neighbor.
  const local = ({ menuCount, ...state }) => state;
  for (const key of ['schools', 'dates', 'regions']) assert.deepEqual(local(after[key][0]), local(before[key][0]), `other row ${key}`);
  assert.equal(after.outside, before.outside);
  const firstRowData = value => Object.fromEntries(Object.entries(value.formData).filter(([key]) => key.endsWith('_1')));
  assert.deepEqual(firstRowData(after), firstRowData(before), 'other row serialized values');
}

for (const same of [false, true]) {
  test(`occupied education widgets ${same ? 'verify an identical value' : 'skip a different value'} without opening`, async t => {
    const h = await fixture(t);
    const existingSchool = catalog.schools[1];
    h.window.fixtureWidgets.schools[1].setValue(existingSchool);
    h.window.fixtureWidgets.dates[1].setExisting('start', '2002-04-15');
    const display = h.field('degree').selections[0].querySelector('.ant-select-selection-selected-value');
    display.textContent = '本科';
    const before = h.snapshot(), clicks = [];
    h.window.document.addEventListener('click', event => clicks.push(event.target), true);
    for (const [key, value] of [
      ['school', same ? existingSchool : catalog.schools[0]],
      ['startDate', same ? '2002-04-15' : '2003-04-15'],
      ['degree', same ? '本科' : '硕士']
    ]) {
      const result = await h.fill(key, value);
      assert.equal(result.status, same ? 'verified' : 'skipped', key);
      assert.equal(result.reason, same ? 'preexisting_same_value' : 'existing_value', key);
    }
    assert.deepEqual(clicks, []);
    assert.deepEqual(h.snapshot(), before);
  });
}

test('an open owned school menu closes before the occupied skip without editing its answer', async t => {
  const h = await fixture(t);
  h.window.fixtureWidgets.schools[1].setValue(catalog.schools[1]);
  h.field('school').selections[0].click();
  const before = h.snapshot();
  const events = [];
  h.window.document.addEventListener('keydown', event => events.push([event.key, event.keyCode]), true);
  const result = await h.fill('school', catalog.schools[0]);
  assert.equal(result.reason, 'existing_value');
  const after = h.snapshot();
  assert.equal(after.schools[1].selected, before.schools[1].selected);
  assert.equal(after.schools[1].selections, before.schools[1].selections);
  assert.equal(after.schools[1].searches, before.schools[1].searches);
  assert.equal(after.schools[1].opened, false);
  assert.equal(after.schools[1].menuCount, 0);
  assert.deepEqual(events, [['Escape', 27]]);
  untouchedRows(before, after);
});

test('school rejects unavailable trusted search and cleans its owned menu without selecting', async t => {
  const h = await fixture(t);
  // jsdom cannot supply a trusted browser insertText event. Exercise that real
  // platform-failure branch rather than manufacturing isTrusted evidence.
  let attempts = 0;
  h.window.document.execCommand = () => { attempts += 1; return false; };
  const before = h.snapshot();
  const result = await h.fill('school', catalog.schools[1]);
  assert.equal(result.status, 'failed');
  assert.equal(result.reason, 'trusted_search_unavailable');
  assert.equal(attempts, 1);
  const after = h.snapshot();
  assert.equal(after.schools[1].selected, '');
  assert.equal(after.schools[1].selections, 0);
  assert.equal(after.schools[1].searches, 0);
  assert.equal(after.schools[1].menuCount, 0);
  assert.equal(after.schools[1].opened, false);
  assert.deepEqual(after.formData, before.formData);
  untouchedRows(before, after);
});

test('a school menu belonging to another bound row is left untouched', async t => {
  const h = await fixture(t);
  h.field('school', 0).selections[0].click();
  const before = h.snapshot(), events = [];
  h.window.document.addEventListener('keydown', event => events.push(event.target), true);
  const result = await h.fill('school', catalog.schools[1]);
  assert.equal(result.status, 'skipped');
  assert.equal(result.reason, 'control_busy');
  assert.deepEqual(events, []);
  assert.deepEqual(h.snapshot(), before);
});

for (const value of ['2002-04', '2002-02-30', '1899-04-15']) {
  test(`education date refuses unproven day ${value} before opening`, async t => {
    const h = await fixture(t), before = h.snapshot();
    assert.deepEqual(plain(await h.fill('startDate', value)), { status: 'skipped', reason: 'insufficient_precision' });
    assert.deepEqual(h.snapshot(), before);
  });
}

for (const [fault, reason, selections] of [
  ['setDisabledTarget', 'disabled_day', 0],
  ['setDuplicateTarget', 'ambiguous_day', 0],
  ['setConflictingDateTitles', 'day_not_found', 0],
  ['setClearAfterSelection', 'readback_mismatch', 1]
]) {
  test(`education date ${fault} preserves the other row and closes the portal`, async t => {
    const h = await fixture(t);
    h.window.fixtureWidgets.dates[1][fault](true);
    h.window.fixtureWidgets.dates[1].setCloseDelay(0);
    const before = h.snapshot();
    const result = await h.fill('startDate', '2002-04-15');
    assert.equal(result.status, selections ? 'failed' : 'skipped');
    assert.equal(result.reason, reason);
    // The calendar rerenders after selection; give the existing fixture timer
    // time to settle before asserting it never silently retries the day click.
    await new Promise(resolve => setTimeout(resolve, 70));
    const after = h.snapshot();
    assert.equal(after.dates[1].selections.start, selections);
    assert.equal(after.dates[1].values.start, '');
    assert.equal(after.dates[1].portalOpen, false);
    assert.equal(after.dates[1].coveredDayClicks, 0);
    assert.equal(after.dates[1].coveredHeaderClicks, 0);
    untouchedRows(before, after);
  });
}

async function planFor(h, ready = {}, targets = h.identities.map(identity => ({ mode: 'existing', identity }))) {
  const plan = {
    version: 1, page: PAGE, ownerBinding: { fixtureOwner: true },
    records: targets.map((target, profileIndex) => ({
      profileIndex, sourceSnapshotHash: `fixture-source-${profileIndex}`, target, replaceExisting: false,
      facts: Object.fromEntries(FIELDS.map(({ key }) => [key, Object.hasOwn(ready[profileIndex] || {}, key)
        ? { status: 'ready', path: `education.${profileIndex}.${key}`, value: ready[profileIndex][key], optionText: ready[profileIndex][key] }
        : { status: 'skipped', reason: 'missing_profile_value', path: `education.${profileIndex}.${key}` }]))
    }))
  };
  return { ...plan, fingerprint: await hash(plan) };
}

function services(h) {
  return {
    verifyBeforeWrite: async () => true, checkOwner: async () => true, checkSource: async () => true,
    adapters: h.window.ResumeCmsEducationMultiAdapters,
    readSerialization: async () => h.window.eval(`(${readCmsEducationSerialization.toString()})()`),
    verifySerialization: async (plan, bindings, proof) => verifyEducationSerialization(plan, bindings, plain(proof))
  };
}

test('select catalog miss reports cleanup failure and the following text field soft-skips busy', async t => {
  const h = await fixture(t), before = h.snapshot();
  // The original select fixture has no Escape handler. Its permanent owned
  // dropdown proves the cleanup-failure branch without inventing a surface.
  const plan = await planFor(h, { 1: { degree: 'not-in-the-fixture-catalog', major: 'Fictional major' } });
  const result = await h.controller.run(plan, services(h));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.complete, false);
  const degree = result.fields.find(field => field.profileIndex === 1 && field.key === 'degree');
  assert.equal(degree.status, 'failed');
  assert.equal(degree.reason, 'menu_cleanup_failed');
  assert.equal(degree.primaryReason, 'education_option_missing');
  const major = result.fields.find(field => field.profileIndex === 1 && field.key === 'major');
  assert.equal(major.status, 'skipped');
  assert.equal(major.reason, 'control_busy');
  assert.equal(h.field('major').input.value, '');
  assert.equal(h.snapshot().counts.selects, 0);
  assert.equal(h.snapshot().counts.textEvents, 0);
  assert.deepEqual(h.snapshot().formData, before.formData);
  untouchedRows(before, h.snapshot());
  for (const key of ['addClicks', 'saveClicks', 'deleteClicks', 'finalSubmitClicks']) assert.equal(result[key], 0);
});

test('settled multi-row retry rebinds the added identity and never adds a duplicate', async t => {
  const h = await fixture(t, 1);
  const plan = await planFor(h, { 0: { major: 'Fictional major' }, 1: { major: 'Another fictional major' } }, [
    { mode: 'existing', identity: h.identities[0] }, { mode: 'new' }
  ]);
  const first = await h.controller.run(plan, services(h));
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal(first.addClicks, 1);
  assert.equal(first.bindings.length, 2);
  const afterFirst = h.snapshot();
  assert.equal(afterFirst.records, 2);
  const second = await h.controller.run(plan, services(h));
  assert.equal(second.ok, true, JSON.stringify(second));
  assert.equal(second.addClicks, 0);
  assert.deepEqual(plain(second.bindings), plain(first.bindings));
  assert.deepEqual(h.snapshot(), afterFirst);
  for (const result of [first, second]) {
    assert.equal(result.complete, false);
    assert.equal(result.saveClicks, 0);
    assert.equal(result.deleteClicks, 0);
    assert.equal(result.finalSubmitClicks, 0);
  }
});

test('cached multi-row retry refuses identity drift before another Add or field event', async t => {
  const h = await fixture(t, 1);
  const plan = await planFor(h, { 1: { major: 'Fictional new-row major' } }, [{ mode: 'existing', identity: h.identities[0] }, { mode: 'new' }]);
  const first = await h.controller.run(plan, services(h));
  assert.equal(first.ok, true);
  // Error mutation of an existing wrapper ID, preserving the fixture structure.
  h.window.document.getElementById('14_53_1').id = '14_53_9';
  const before = h.snapshot();
  const second = await h.controller.run(plan, services(h));
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'education_cached_binding_changed');
  assert.equal(second.writeStarted, false);
  assert.equal(second.addClicks, 0);
  assert.deepEqual(h.snapshot(), before);
});
