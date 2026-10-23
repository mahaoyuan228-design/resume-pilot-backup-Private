/**
 * Offline controller settlement checks against the unchanged fictional fixtures.
 * A deferred bridge lets native edits occur while the real props proof/verifier
 * is pending. No widget handlers, DOM structures, or live support are invented.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { integrationFixture } from './fixtures/cms-education-fixture.mjs';
import { internshipFixture } from './fixtures/cms-internship-fixture.mjs';
import { createPlan as educationPlan, ownerBindingFor, sourceSnapshot as educationSource, PAGE } from '../src/profile/cms-education-plan.mjs';
import { createPlan as internshipPlan, sourceSnapshot as internshipSource } from '../src/profile/cms-internship-plan.mjs';
import { readCmsEducationSerialization, verifyEducationSerialization } from '../src/content/cms-education-serialization.mjs';
import { readCmsInternshipSerialization, verifyInternshipSerialization } from '../src/content/cms-internship-serialization.mjs';

const controllerSource = await readFile('src/content/cms-record-controller.js', 'utf8');
const internshipAdapters = await Promise.all([
  'cms-education-multi-dates.js', 'cms-education-multi-select.js', 'cms-internship-adapters.js'
].map(file => readFile(`src/content/${file}`, 'utf8')));
const internshipRow = {
  type: 'internship', organization: 'Fixture Company', position: 'Fixture Intern',
  description: 'Fixture confirmed work', startDate: '2022-07-01', endDate: '2022-09-30'
};

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

async function fixture(t, kind, stage, { rowCount = 1 } = {}) {
  const internship = kind === 'internship';
  const html = internship ? await internshipFixture() : await integrationFixture({
    schools: Array.from({ length: rowCount }, (_, index) => `Fixture School ${index}`),
    regions: Array.from({ length: rowCount }, (_, index) => ({ province: `Fixture Province ${index}`, city: `Fixture City ${index}` }))
  });
  const dom = new JSDOM(html, {
    url: `${PAGE}?resumeId=fixture-original`, runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(window) {
      window.structuredClone = structuredClone;
      window.TextEncoder = TextEncoder;
      Object.defineProperty(window.crypto, 'subtle', { value: webcrypto.subtle });
      window.Element.prototype.getClientRects = function () { return this.isConnected ? [{}] : []; };
    }
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  Object.defineProperty(window.document, 'visibilityState', { get: () => 'visible' });
  window.document.hasFocus = () => true;
  // Only fixture preparation uses the existing Add control, before the run.
  for (let index = 1; index < rowCount; index++) window.document.querySelector('.add-more').click();
  const clicks = [];
  window.document.addEventListener('click', event => clicks.push(event.target), true);
  if (internship) window.fixtureSeed(internshipRow);
  window.eval(controllerSource);
  window.installResumeCmsRecordController(kind);
  if (internship) for (const source of internshipAdapters) window.eval(source);
  const api = window[internship ? 'ResumeCmsInternshipMulti' : 'ResumeCmsEducationMulti'];
  const inspected = api.inspect();
  assert.equal(inspected.ok, true);
  const profile = internship ? {
    experience: [internshipRow], confirmedFields: Object.keys(internshipRow).map(key => `experience.0.${key}`)
  } : {
    education: Array.from({ length: rowCount }, (_, index) => index === 0
      ? { major: 'Fixture Major', majorDescription: 'Fixture confirmed description' } : {}),
    confirmedFields: ['education.0.major', 'education.0.majorDescription']
  };
  const owner = await ownerBindingFor(profile, '00000000-0000-4000-8000-0000000000ed');
  const snapshots = await Promise.all(inspected.records.map((_, index) =>
    (internship ? internshipSource : educationSource)(profile, index)));
  const plan = await (internship ? internshipPlan : educationPlan)(profile, inspected.records.map((row, index) => ({
    profileIndex: index, sourceSnapshotHash: snapshots[index].hash,
    target: { mode: 'existing', identity: row.identity }, replaceExisting: false
  })), [], owner);
  const read = window.eval(`(${(internship ? readCmsInternshipSerialization : readCmsEducationSerialization).toString()})`);
  const verify = internship ? verifyInternshipSerialization : verifyEducationSerialization;
  const reached = deferred(), release = deferred();
  const pause = async where => {
    if (where !== stage) return;
    reached.resolve();
    await release.promise;
  };
  const services = {
    verifyBeforeWrite: async () => true,
    checkOwner: async binding => JSON.stringify(binding) === JSON.stringify(owner),
    checkSource: async (index, hash) => hash === snapshots[index]?.hash,
    readSerialization: async () => {
      const proof = read();
      assert.equal(proof.ok, true);
      await pause('readSerialization');
      return proof;
    },
    verifySerialization: async (...args) => {
      const proof = verify(...args);
      assert.equal(proof.ok, true);
      await pause('verifySerialization');
      return proof;
    },
    ...(internship ? { adapters: window.ResumeCmsInternshipMultiAdapters } : {})
  };
  const targetId = internship ? '49170501_49170514_0' : '14_53_0';
  const wrapper = window.document.getElementById(targetId);
  const target = wrapper.querySelector('input');
  const neighbor = rowCount > 1 ? window.document.getElementById('14_53_1').querySelector('input') : null;
  const outside = window.document.getElementById('unrelated');
  const set = (input, value) => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  const safety = result => {
    assert.deepEqual(clicks, []);
    assert.equal(window.fixtureCounts.adds, rowCount - 1);
    for (const key of ['saves', 'submits', 'selects']) assert.equal(window.fixtureCounts[key], 0);
    for (const key of ['addClicks', 'saveClicks', 'deleteClicks', 'finalSubmitClicks']) assert.equal(result[key], 0);
    assert.equal(window.ResumeProfileWriteContext, undefined);
  };
  return { window, api, plan, services, target, neighbor, wrapper, outside, set, reached, release, safety };
}

for (const kind of ['education', 'internship']) {
  test(`${kind} replaces revision 17 with the settlement guard and reuses revision 19`, async t => {
    const h = await fixture(t, kind);
    const name = kind === 'internship' ? 'ResumeCmsInternshipMulti' : 'ResumeCmsEducationMulti';
    const prior = { version: 3, implementationRevision: 17 };
    h.window[name] = prior;
    h.window.installResumeCmsRecordController(kind);
    const current = h.window[name];
    assert.notEqual(current, prior);
    assert.equal(current.implementationRevision, 19);
    h.window.installResumeCmsRecordController(kind);
    assert.equal(h.window[name], current);
    const result = await current.run(h.plan, h.services);
    assert.equal(result.ok, true, JSON.stringify(result));
    h.safety(result);
  });

  test(`${kind} unchanged props proof settles with matching DOM and no clicks`, async t => {
    const h = await fixture(t, kind);
    const result = await h.api.run(h.plan, h.services);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.complete, kind === 'internship');
    assert.equal(result.fields.filter(field => field.status === 'verified').length, kind === 'internship' ? 6 : 2);
    assert.equal(result.serializedRecordCount, 1);
    assert.equal(h.target.value, kind === 'internship' ? internshipRow.organization : 'Fixture Major');
    h.safety(result);
  });

  for (const stage of ['readSerialization', 'verifySerialization']) {
    for (const change of ['target', 'outside', 'rowIdentity', ...(kind === 'education' ? ['neighborRow'] : [])]) {
      test(`${kind} refuses ${change} changes while ${stage} is pending`, async t => {
        const h = await fixture(t, kind, stage, { rowCount: change === 'neighborRow' ? 2 : 1 });
        const running = h.api.run(h.plan, h.services);
        await Promise.race([h.reached.promise, running.then(result => {
          throw Error(`controller_settled_before_verification_pause:${result.reason}`);
        })]);
        if (change === 'target') h.set(h.target, 'Fixture user edit during verification');
        if (change === 'outside') h.set(h.outside, 'Fixture neighbor edit during verification');
        if (change === 'rowIdentity') h.wrapper.id = h.wrapper.id.replace(/_0$/u, '_7');
        if (change === 'neighborRow') h.set(h.neighbor, 'Fixture skipped row user edit during verification');
        h.release.resolve();
        const result = await running;
        h.safety(result);
        assert.equal(result.ok, false, JSON.stringify(result));
        assert.equal(result.complete, false);
        assert.equal(result.phase, 'verify_react_serialization');
        assert.equal(result.reason, change === 'outside' ? 'education_page_or_other_fields_changed'
          : change === 'rowIdentity' ? 'education_bound_record_set_changed'
          : 'education_records_changed_during_verification');
        if (change === 'target') assert.equal(h.target.value, 'Fixture user edit during verification');
        if (change === 'outside') assert.equal(h.outside.value, 'Fixture neighbor edit during verification');
        if (change === 'rowIdentity') assert.match(h.wrapper.id, /_7$/u);
        if (change === 'neighborRow') assert.equal(h.neighbor.value, 'Fixture skipped row user edit during verification');
      });
    }
  }
}
