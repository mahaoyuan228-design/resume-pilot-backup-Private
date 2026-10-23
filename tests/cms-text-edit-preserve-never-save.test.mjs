/**
 * Offline text preservation checks against the unchanged CMS fixtures, actual
 * planners, controller, and props serialization. An owner-check await gives a
 * native edit time to reach the fixture's shipped input handler before filling.
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
const scenarios = [
  { kind: 'education', tag: 'INPUT', key: 'major', profileKey: 'major', wrapper: '14_53_0', serialized: '14_53_1', firstTextCheck: 7 },
  { kind: 'education', tag: 'TEXTAREA', key: 'description', profileKey: 'majorDescription', wrapper: '14_55_0', serialized: '14_55_1', firstTextCheck: 12 },
  { kind: 'internship', tag: 'INPUT', key: 'organization', profileKey: 'organization', wrapper: '49170501_49170514_0', serialized: '49170501_49170514_1', firstTextCheck: 6 },
  { kind: 'internship', tag: 'TEXTAREA', key: 'description', profileKey: 'description', wrapper: '49170501_49170523_0', serialized: '49170501_49170523_1', firstTextCheck: 9 }
];
const desired = 'Fixture confirmed profile text';
const edited = 'Fixture native user edit';

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

async function fixture(t, scenario, replaceExisting, stage) {
  const internship = scenario.kind === 'internship';
  const html = internship ? await internshipFixture() : await integrationFixture({
    schools: ['Fixture School'], regions: [{ province: 'Fixture Province', city: 'Fixture City' }]
  });
  const dom = new JSDOM(html, {
    url: `${PAGE}?resumeId=fixture-text-edit`, runScripts: 'dangerously', pretendToBeVisual: true,
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
  const target = window.document.getElementById(scenario.wrapper).querySelector('input,textarea');
  assert.equal(target.tagName, scenario.tag);
  const set = value => {
    const prototype = scenario.tag === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(target, value);
    target.dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  if (replaceExisting) set('Fixture original text');
  const before = window.fixtureSnapshot();
  const clicks = [];
  window.document.addEventListener('click', event => clicks.push(event.target), true);
  window.eval(source);
  window.installResumeCmsRecordController(scenario.kind);
  const api = window[internship ? 'ResumeCmsInternshipMulti' : 'ResumeCmsEducationMulti'];
  const inspected = api.inspect();
  assert.equal(inspected.ok, true);
  const row = { ...(internship ? { type: 'internship' } : {}), [scenario.profileKey]: desired };
  const domain = internship ? 'experience' : 'education';
  const profile = { [domain]: [row], confirmedFields: [`${domain}.0.${scenario.profileKey}`] };
  const owner = await ownerBindingFor(profile, '00000000-0000-4000-8000-0000000000ed');
  const snapshot = await (internship ? internshipSource : educationSource)(profile, 0);
  const plan = await (internship ? internshipPlan : educationPlan)(profile, [{
    profileIndex: 0, sourceSnapshotHash: snapshot.hash,
    target: { mode: 'existing', identity: inspected.records[0].identity }, replaceExisting
  }], [], owner);
  const read = window.eval(`(${(internship ? readCmsInternshipSerialization : readCmsEducationSerialization).toString()})`);
  const verify = internship ? verifyInternshipSerialization : verifyEducationSerialization;
  const reached = deferred(), release = deferred();
  let ownerChecks = 0;
  // Count real owner service calls through binding, preceding skipped facts, and
  // the text adapter. No extra adapter, DOM node, or widget handler is installed.
  const pauseAt = stage === 'beforeFocus' ? scenario.firstTextCheck
    : stage === 'afterFocus' ? scenario.firstTextCheck + 1 : -1;
  const services = {
    verifyBeforeWrite: async () => true,
    checkOwner: async binding => {
      if (++ownerChecks === pauseAt) {
        reached.resolve();
        await release.promise;
      }
      return JSON.stringify(binding) === JSON.stringify(owner);
    },
    checkSource: async (index, hash) => index === 0 && hash === snapshot.hash,
    readSerialization: async () => read(),
    verifySerialization: async (...args) => verify(...args)
  };
  const safety = (result, expectedTextEvents) => {
    assert.deepEqual(clicks, []);
    const after = window.fixtureSnapshot();
    assert.equal(after.records, 1);
    assert.equal(after.outside, before.outside);
    if (internship) assert.equal(after.education, before.education);
    assert.equal(after.counts.textEvents - before.counts.textEvents, expectedTextEvents);
    for (const key of ['adds', 'saves', 'submits', 'selects']) assert.equal(after.counts[key], 0);
    for (const key of ['addClicks', 'saveClicks', 'deleteClicks', 'finalSubmitClicks']) assert.equal(result[key], 0);
    assert.equal(window.ResumeProfileWriteContext, undefined);
  };
  return { window, target, api, plan, services, set, reached, release, read, safety };
}

for (const scenario of scenarios) {
  for (const replaceExisting of [false, true]) {
    for (const stage of ['beforeFocus', 'afterFocus']) {
      test(`${scenario.kind} ${scenario.tag} preserves native edits ${stage}, replaceExisting=${replaceExisting}`, async t => {
        const h = await fixture(t, scenario, replaceExisting, stage);
        const running = h.api.run(h.plan, h.services);
        await Promise.race([h.reached.promise, running.then(result => {
          throw Error(`controller_settled_before_text_pause:${result.reason}`);
        })]);
        assert.equal(h.window.document.activeElement === h.target, stage === 'afterFocus');
        h.set(edited);
        h.release.resolve();
        const result = await running;
        assert.equal(h.target.value, edited);
        assert.equal(h.window.fixtureProps.formData[scenario.serialized], edited);
        assert.equal(result.ok, true, JSON.stringify(result));
        assert.equal(result.complete, false);
        const field = result.fields.find(field => field.key === scenario.key);
        assert.equal(field.status, 'failed');
        assert.equal(field.reason, 'text_value_changed');
        const proof = h.read();
        assert.equal(proof.ok, true);
        assert.equal(proof.rows[0].fields.find(field => field.wrapperId === scenario.wrapper).raw, edited);
        h.safety(result, 1);
      });
    }

    test(`${scenario.kind} ${scenario.tag} unchanged control still commits, replaceExisting=${replaceExisting}`, async t => {
      const h = await fixture(t, scenario, replaceExisting);
      const result = await h.api.run(h.plan, h.services);
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(h.target.value, desired);
      assert.equal(h.window.fixtureProps.formData[scenario.serialized], desired);
      const field = result.fields.find(field => field.key === scenario.key);
      assert.equal(field.status, 'verified');
      assert.equal(field.reason, 'dom_readback_matched');
      assert.equal(result.serialization[0].fields.find(field => field.key === scenario.key).status, 'verified');
      h.safety(result, 1);
    });
  }
}
