/**
 * Offline native-textarea checks using the unchanged CMS fixtures, planners,
 * input handlers, and public-props serialization. No widget DOM is added.
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

const source = await readFile('src/content/cms-record-controller.js', 'utf8');
const adapters = await Promise.all([
  'cms-education-multi-dates.js', 'cms-education-multi-select.js', 'cms-internship-adapters.js'
].map(file => readFile(`src/content/${file}`, 'utf8')));
const plain = 'First  confirmed line\nSecond\tconfirmed line';
const texts = [
  { name: 'LF', desired: plain, expected: plain },
  { name: 'CRLF', desired: 'First  confirmed line\r\nSecond\tconfirmed line', expected: plain },
  { name: 'CR', desired: 'First  confirmed line\rSecond\tconfirmed line', expected: plain },
  { name: 'mixed', desired: 'First  confirmed line\r\n\rSecond\tconfirmed line\nThird line', expected: 'First  confirmed line\n\nSecond\tconfirmed line\nThird line' }
];

async function fixture(t, kind, desired, { initial = '', replaceExisting = false, completeInternship = false } = {}) {
  const internship = kind === 'internship';
  const dom = new JSDOM(internship ? await internshipFixture() : await integrationFixture({
    schools: ['Fixture School'], regions: [{ province: 'Fixture Province', city: 'Fixture City' }]
  }), {
    url: `${PAGE}?resumeId=fixture-textarea-line-endings`, runScripts: 'dangerously', pretendToBeVisual: true,
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
  const wrapper = internship ? '49170501_49170523_0' : '14_55_0';
  const serialized = internship ? '49170501_49170523_1' : '14_55_1';
  const target = window.document.getElementById(wrapper).querySelector('textarea');
  assert.equal(target.tagName, 'TEXTAREA');
  const row = completeInternship ? {
    type: 'internship', organization: 'Fixture Company', position: 'Fixture Intern',
    startDate: '2022-07-01', endDate: '2022-09-30', description: desired
  } : { ...(internship ? { type: 'internship' } : {}), [internship ? 'description' : 'majorDescription']: desired };
  if (completeInternship) window.fixtureSeed({ ...row, description: initial });
  else if (initial) {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(target, initial);
    target.dispatchEvent(new window.Event('input', { bubbles: true }));
  }
  const before = window.fixtureSnapshot();
  const neighbors = () => [...window.document.querySelector('form').querySelectorAll('input,textarea,select,.ant-select-selection-selected-value')]
    .filter(node => node !== target).map(node => [node.id, node.value ?? node.textContent, !!node.checked]);
  const beforeNeighbors = neighbors();
  const clicks = [], events = [];
  window.document.addEventListener('click', event => clicks.push(event.target), true);
  for (const type of ['focus', 'input', 'change', 'blur', 'focusout']) target.addEventListener(type, () => events.push(type));
  window.eval(source);
  window.installResumeCmsRecordController(kind);
  if (completeInternship) for (const adapter of adapters) window.eval(adapter);
  const api = window[internship ? 'ResumeCmsInternshipMulti' : 'ResumeCmsEducationMulti'];
  const domain = internship ? 'experience' : 'education';
  const profile = {
    [domain]: [row],
    confirmedFields: completeInternship ? Object.keys(row).map(key => `${domain}.0.${key}`)
      : [`${domain}.0.${internship ? 'description' : 'majorDescription'}`]
  };
  const owner = await ownerBindingFor(profile, '00000000-0000-4000-8000-0000000000ed');
  const snapshot = await (internship ? internshipSource : educationSource)(profile, 0);
  const plan = await (internship ? internshipPlan : educationPlan)(profile, [{
    profileIndex: 0, sourceSnapshotHash: snapshot.hash,
    target: { mode: 'existing', identity: api.inspect().records[0].identity }, replaceExisting
  }], [], owner);
  const originalPlan = JSON.stringify(plan);
  assert.equal(plan.records[0].facts.description.value, desired);
  const read = window.eval(`(${(internship ? readCmsInternshipSerialization : readCmsEducationSerialization).toString()})`);
  const verify = internship ? verifyInternshipSerialization : verifyEducationSerialization;
  const services = {
    verifyBeforeWrite: async () => true,
    checkOwner: async binding => JSON.stringify(binding) === JSON.stringify(owner),
    checkSource: async (index, hash) => index === 0 && hash === snapshot.hash,
    readSerialization: async () => read(),
    verifySerialization: async (...args) => verify(...args),
    ...(completeInternship ? { adapters: window.ResumeCmsInternshipMultiAdapters } : {})
  };
  const safety = (result, expectedEvents) => {
    assert.deepEqual(clicks, []);
    assert.deepEqual(neighbors(), beforeNeighbors);
    assert.deepEqual(events, expectedEvents ? ['focus', 'input', 'change', 'blur', 'focusout'] : []);
    const after = window.fixtureSnapshot();
    assert.equal(after.records, 1);
    assert.equal(after.outside, before.outside);
    if (internship) assert.equal(after.education, before.education);
    assert.equal(after.counts.textEvents - before.counts.textEvents, expectedEvents);
    for (const key of ['adds', 'saves', 'submits', 'selects']) assert.equal(after.counts[key], 0);
    for (const key of ['addClicks', 'saveClicks', 'deleteClicks', 'finalSubmitClicks']) assert.equal(result[key], 0);
    assert.equal(window.ResumeProfileWriteContext, undefined);
    assert.equal(JSON.stringify(plan), originalPlan, 'raw source facts and plan fingerprint stay unchanged');
  };
  return { window, target, serialized, api, plan, services, read, safety };
}

function verified(h, result, expected, reason) {
  assert.equal(result.ok, true, JSON.stringify(result));
  const field = result.fields.find(field => field.key === 'description');
  assert.equal(field.status, 'verified');
  assert.equal(field.reason, reason);
  assert.equal(h.target.value, expected);
  assert.equal(h.window.fixtureProps.formData[h.serialized], expected);
  assert.equal(result.serialization[0].fields.find(field => field.key === 'description').status, 'verified');
  assert.equal(h.read().rows[0].fields.find(field => field.wrapperId === h.target.closest('[id]').id).raw, expected);
}

for (const kind of ['education', 'internship']) {
  for (const text of texts) {
    for (const replaceExisting of [false, true]) {
      test(`${kind} commits ${text.name} textarea with replaceExisting=${replaceExisting}`, async t => {
        const h = await fixture(t, kind, text.desired, { replaceExisting, initial: replaceExisting ? 'Fixture previous text' : '' });
        const result = await h.api.run(h.plan, h.services);
        verified(h, result, text.expected, 'dom_readback_matched');
        h.safety(result, 1);
      });
    }

    test(`${kind} recognizes preexisting native ${text.name} textarea without events`, async t => {
      const h = await fixture(t, kind, text.desired, { initial: text.expected });
      const result = await h.api.run(h.plan, h.services);
      verified(h, result, text.expected, 'preexisting_same_value');
      h.safety(result, 0);
    });
  }

  for (const [name, initial] of [
    ['different content', 'Other confirmed line\nSecond\tconfirmed line'],
    ['extra blank line', 'First  confirmed line\n\nSecond\tconfirmed line'],
    ['removed newline', 'First  confirmed lineSecond\tconfirmed line'],
    ['different spaces', 'First confirmed line\nSecond\tconfirmed line']
  ]) {
    test(`${kind} preserves occupied textarea with ${name}`, async t => {
      const h = await fixture(t, kind, texts[1].desired, { initial });
      const result = await h.api.run(h.plan, h.services);
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(result.complete, false);
      assert.equal(result.fields.find(field => field.key === 'description').status, 'skipped');
      assert.equal(result.fields.find(field => field.key === 'description').reason, 'existing_value');
      assert.equal(h.target.value, initial);
      assert.equal(h.window.fixtureProps.formData[h.serialized], initial);
      h.safety(result, 0);
    });
  }

  test(`${kind} retry recognizes the prior native CRLF commit without another write`, async t => {
    const h = await fixture(t, kind, texts[1].desired);
    verified(h, await h.api.run(h.plan, h.services), plain, 'dom_readback_matched');
    const result = await h.api.run(h.plan, h.services);
    verified(h, result, plain, 'preexisting_same_value');
    h.safety(result, 1);
  });
}

for (const text of texts.slice(1, 3)) {
  test(`internship ${text.name} textarea can complete the existing six-field record`, async t => {
    const h = await fixture(t, 'internship', text.desired, { completeInternship: true });
    const result = await h.api.run(h.plan, h.services);
    verified(h, result, text.expected, 'dom_readback_matched');
    assert.equal(result.complete, true);
    assert.equal(result.reason, 'internship_bound_records_serialized');
    h.safety(result, 1);
  });
}
