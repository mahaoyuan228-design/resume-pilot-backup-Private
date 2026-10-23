/**
 * Offline retained-text checks with unchanged CMS fixtures and their shipped
 * input handlers. A source-check await exposes edits after a field verified,
 * before the props verification snapshot is captured. No widget DOM is added.
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
const scenarios = [
  { kind: 'education', tag: 'INPUT', key: 'major', profileKey: 'major', wrapper: '14_53_0', serialized: '14_53_1', fieldIndex: 3, fieldCount: 9 },
  { kind: 'education', tag: 'TEXTAREA', key: 'description', profileKey: 'majorDescription', wrapper: '14_55_0', serialized: '14_55_1', fieldIndex: 8, fieldCount: 9 },
  { kind: 'internship', tag: 'INPUT', key: 'organization', profileKey: 'organization', wrapper: '49170501_49170514_0', serialized: '49170501_49170514_1', fieldIndex: 2, fieldCount: 6 },
  { kind: 'internship', tag: 'TEXTAREA', key: 'description', profileKey: 'description', wrapper: '49170501_49170523_0', serialized: '49170501_49170523_1', fieldIndex: 5, fieldCount: 6 }
];
const textFor = scenario => scenario.tag === 'TEXTAREA'
  ? 'First  confirmed line\n\nSecond\tconfirmed line' : 'Fixture  confirmed text';
const editedFor = scenario => scenario.tag === 'TEXTAREA'
  ? 'First  confirmed line\nSecond\tconfirmed line' : 'Fixture confirmed text';
const nativeText = value => value.replace(/\r\n?/gu, '\n');

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

async function fixture(t, scenario, mode, { rowCount = 1, desired = textFor(scenario), pause = false } = {}) {
  const internship = scenario.kind === 'internship';
  const html = internship ? await internshipFixture() : await integrationFixture({
    schools: Array.from({ length: rowCount }, (_, index) => `Fixture School ${index}`),
    regions: Array.from({ length: rowCount }, (_, index) => ({ province: `Fixture Province ${index}`, city: `Fixture City ${index}` }))
  });
  const dom = new JSDOM(html, {
    url: `${PAGE}?resumeId=fixture-retained-text`, runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(window) {
      window.structuredClone = structuredClone;
      window.TextEncoder = TextEncoder;
      Object.defineProperty(window.crypto, 'subtle', { value: webcrypto.subtle });
      window.Element.prototype.getClientRects = function () { return this.isConnected ? [{}] : []; };
    }
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  window.document.hasFocus = () => true;
  // Existing fixture Add is used only to prepare preexisting bound rows.
  for (let index = 1; index < rowCount; index++) window.document.querySelector('.add-more').click();
  const target = window.document.getElementById(scenario.wrapper).querySelector('input,textarea');
  assert.equal(target.tagName, scenario.tag);
  const set = (input, value) => {
    const prototype = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value);
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  const row = internship ? {
    type: 'internship', organization: 'Fixture Company', position: 'Fixture Intern',
    description: 'Fixture confirmed work', startDate: '2022-07-01', endDate: '2022-09-30',
    [scenario.profileKey]: desired
  } : { [scenario.profileKey]: desired };
  if (internship) window.fixtureSeed(row);
  else if (mode === 'preexisting') set(target, desired);
  if (internship && mode === 'filled') set(target, '');
  const neighbors = () => [...window.document.querySelector('form').querySelectorAll('input,textarea,select,.ant-select-selection-selected-value')]
    .filter(node => node !== target).map(node => [node.id, node.value ?? node.textContent, !!node.checked]);
  const before = window.fixtureSnapshot(), beforeNeighbors = neighbors();
  const clicks = [], events = [];
  window.document.addEventListener('click', event => clicks.push(event.target), true);
  for (const type of ['focus', 'input', 'change', 'blur', 'focusout']) target.addEventListener(type, () => events.push(type));
  window.eval(controllerSource);
  window.installResumeCmsRecordController(scenario.kind);
  if (internship) for (const source of internshipAdapters) window.eval(source);
  const api = window[internship ? 'ResumeCmsInternshipMulti' : 'ResumeCmsEducationMulti'];
  const inspected = api.inspect();
  assert.equal(inspected.ok, true);
  const domain = internship ? 'experience' : 'education';
  const profile = {
    [domain]: Array.from({ length: rowCount }, (_, index) => index === 0 ? row : internship ? { type: 'internship' } : {}),
    confirmedFields: (internship ? Object.keys(row) : [scenario.profileKey]).map(key => `${domain}.0.${key}`)
  };
  const owner = await ownerBindingFor(profile, '00000000-0000-4000-8000-0000000000ed');
  const snapshots = await Promise.all(inspected.records.map((_, index) =>
    (internship ? internshipSource : educationSource)(profile, index)));
  const plan = await (internship ? internshipPlan : educationPlan)(profile, inspected.records.map((record, index) => ({
    profileIndex: index, sourceSnapshotHash: snapshots[index].hash,
    target: { mode: 'existing', identity: record.identity }, replaceExisting: false
  })), [], owner);
  const originalPlan = JSON.stringify(plan);
  const read = window.eval(`(${(internship ? readCmsInternshipSerialization : readCmsEducationSerialization).toString()})`);
  const verify = internship ? verifyInternshipSerialization : verifyEducationSerialization;
  const reached = deferred(), release = deferred();
  // Binding checks precede field checks. For two rows, pause when row 1 starts;
  // otherwise pause at the next field, or at the final source check for textarea.
  const pauseAt = rowCount > 1 ? rowCount + scenario.fieldCount + 1
    : scenario.fieldIndex + 1 < scenario.fieldCount ? rowCount + scenario.fieldIndex + 2
      : rowCount + scenario.fieldCount + 1;
  let sourceChecks = 0;
  const services = {
    verifyBeforeWrite: async () => true,
    checkOwner: async binding => JSON.stringify(binding) === JSON.stringify(owner),
    checkSource: async (index, hash) => {
      if (pause && ++sourceChecks === pauseAt) {
        reached.resolve();
        await release.promise;
      }
      return snapshots[index]?.hash === hash;
    },
    readSerialization: async () => read(),
    verifySerialization: async (...args) => verify(...args),
    ...(internship ? { adapters: window.ResumeCmsInternshipMultiAdapters } : {})
  };
  const safety = (result, edited = false) => {
    assert.deepEqual(clicks, []);
    assert.deepEqual(events, [...(mode === 'filled' ? ['focus', 'input', 'change', 'blur', 'focusout'] : []), ...(edited ? ['input'] : [])]);
    assert.deepEqual(neighbors(), beforeNeighbors);
    const after = window.fixtureSnapshot();
    assert.equal(after.records, rowCount);
    assert.equal(after.outside, before.outside);
    if (internship) assert.equal(after.education, before.education);
    assert.equal(after.counts.textEvents - before.counts.textEvents, Number(mode === 'filled') + Number(edited));
    for (const key of ['adds', 'saves', 'submits', 'selects']) assert.equal(after.counts[key], before.counts[key]);
    for (const key of ['addClicks', 'saveClicks', 'deleteClicks', 'finalSubmitClicks']) assert.equal(result[key], 0);
    assert.equal(window.ResumeProfileWriteContext, undefined);
    assert.equal(JSON.stringify(plan), originalPlan);
  };
  return { window, target, api, plan, services, set, read, reached, release, safety };
}

for (const scenario of scenarios) {
  for (const mode of ['preexisting', 'filled']) {
    for (const rowCount of [1, 2]) {
      test(`${scenario.kind} ${scenario.tag} retains ${mode} text proof after native edit, rows=${rowCount}`, async t => {
        const h = await fixture(t, scenario, mode, { rowCount, pause: true });
        const running = h.api.run(h.plan, h.services);
        await Promise.race([h.reached.promise, running.then(result => {
          throw Error(`controller_settled_before_retained_text_pause:${result.reason}`);
        })]);
        assert.equal(h.target.value, textFor(scenario));
        assert.notEqual(editedFor(scenario), textFor(scenario));
        assert.equal(editedFor(scenario).replace(/\s+/gu, ''), textFor(scenario).replace(/\s+/gu, ''));
        h.set(h.target, editedFor(scenario));
        h.release.resolve();
        const result = await running;
        h.safety(result, true);
        assert.equal(h.target.value, editedFor(scenario));
        assert.equal(h.window.fixtureProps.formData[scenario.serialized], editedFor(scenario));
        assert.equal(result.ok, true, JSON.stringify(result));
        assert.equal(result.complete, false);
        const field = result.fields.find(field => field.profileIndex === 0 && field.key === scenario.key);
        assert.equal(field.status, 'failed');
        assert.equal(field.reason, 'text_value_changed_after_verification');
        assert.equal(result.serialization.find(row => row.profileIndex === 0).fields.find(field => field.key === scenario.key).status, 'verified', 'generic serialization accepts the whitespace-equivalent edit');
        const proof = h.read();
        assert.equal(proof.ok, true);
        assert.equal(proof.rows[0].fields.find(field => field.wrapperId === scenario.wrapper).raw, editedFor(scenario));
      });
    }

    test(`${scenario.kind} ${scenario.tag} unchanged ${mode} text remains verified`, async t => {
      const h = await fixture(t, scenario, mode);
      const result = await h.api.run(h.plan, h.services);
      h.safety(result);
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(result.complete, scenario.kind === 'internship');
      const field = result.fields.find(field => field.key === scenario.key);
      assert.equal(field.status, 'verified');
      assert.equal(field.reason, mode === 'preexisting' ? 'preexisting_same_value' : 'dom_readback_matched');
      assert.equal(h.target.value, textFor(scenario));
    });

    if (scenario.tag === 'TEXTAREA') {
      test(`${scenario.kind} unchanged ${mode} CRLF textarea remains verified`, async t => {
        const desired = 'First  confirmed line\r\n\r\nSecond\tconfirmed line';
        const h = await fixture(t, scenario, mode, { desired });
        const result = await h.api.run(h.plan, h.services);
        h.safety(result);
        assert.equal(result.ok, true, JSON.stringify(result));
        assert.equal(result.complete, scenario.kind === 'internship');
        const field = result.fields.find(field => field.key === scenario.key);
        assert.equal(field.status, 'verified');
        assert.equal(h.target.value, nativeText(desired));
        assert.equal(h.plan.records[0].facts[scenario.key].value, desired);
      });
    }
  }
}
