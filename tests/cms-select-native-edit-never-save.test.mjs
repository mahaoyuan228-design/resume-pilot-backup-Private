/**
 * Offline native-choice races on the unchanged fictional CMS select fixtures.
 * Existing option handlers provide every display/props update and menu close.
 * No employer page, invented DOM, or Save/submit action is used.
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
const selectSource = await readFile('src/content/cms-education-multi-select.js', 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const scenarios = [
  { kind: 'education', key: 'degree', oldItemId: 51, wrapper: '14_51_0', serialized: '14_51_1', desiredCode: 'undergraduate', userCode: 'graduate' },
  { kind: 'internship', key: 'type', oldItemId: 49170517, wrapper: '49170501_49170517_0', serialized: '49170501_49170517_1', desiredCode: '0/461/580', userCode: '0/461/578' }
];

async function fixture(t, scenario) {
  const internship = scenario.kind === 'internship';
  const html = internship ? await internshipFixture() : await integrationFixture({
    schools: ['Fixture School'], regions: [{ province: 'Fixture Province', city: 'Fixture City' }]
  });
  const dom = new JSDOM(html, {
    url: `${PAGE}?resumeId=fixture-native-choice`, runScripts: 'dangerously', pretendToBeVisual: true,
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
  window.eval(controllerSource);
  window.installResumeCmsRecordController(scenario.kind);
  window.eval(selectSource);
  const api = window[internship ? 'ResumeCmsInternshipMulti' : 'ResumeCmsEducationMulti'];
  const adapter = window[internship ? 'ResumeCmsInternshipSelect' : 'ResumeCmsMultiSelect'].fillSelect;
  const inspected = api.inspect();
  assert.equal(inspected.ok, true);
  const { form } = inspected;
  const identity = inspected.records[0].identity;
  const question = inspected.records[0].fields.find(field => field.key === scenario.key).question;
  const locate = () => api.locateField(form, identity, question);
  const meta = window.fixtureProps.infoData[0].find(field => field.oldItemId === scenario.oldItemId);
  const desired = meta.dataSourceMap[scenario.desiredCode];
  const user = meta.dataSourceMap[scenario.userCode];
  const clicks = [];
  const nativeClick = window.HTMLElement.prototype.click;
  window.HTMLElement.prototype.click = function () {
    assert.ok(!this.matches('#save,button[type="submit"]'), 'Never-Save controls must never receive a click');
    clicks.push({ node: this, connected: this.isConnected });
    return nativeClick.call(this);
  };
  function choose(text, open = true) {
    if (open) locate().selections[0].click();
    const options = [...window.document.querySelectorAll('.ant-select-dropdown-menu-item')].filter(option => option.textContent === text);
    assert.equal(options.length, 1, 'use an existing unique fixture option');
    options[0].click();
    return options[0];
  }
  function observe() {
    clicks.length = 0;
    const before = plain(window.fixtureSnapshot());
    return (code, selections) => {
      const after = plain(window.fixtureSnapshot());
      for (const key of ['adds', 'saves', 'submits', 'textEvents']) assert.equal(after.counts[key], before.counts[key], key);
      assert.equal(after.counts.selects - before.counts.selects, selections);
      assert.equal(after.records, before.records);
      assert.equal(after.outside, before.outside);
      if (internship) assert.equal(after.education, before.education);
      const expectedData = { ...before.formData };
      if (code !== undefined) expectedData[scenario.serialized] = code;
      assert.deepEqual(after.formData, expectedData, 'only the native fixture option may update its own props');
      assert.equal(window.document.querySelectorAll('.ant-select-dropdown,.ant-select-open').length, 0);
      assert.ok(clicks.every(click => click.connected), 'never invoke a detached selection or option');
    };
  }
  const run = replaceExisting => adapter(locate(), { optionText: desired }, {
    question, confirmed: true, rowIdentity: identity, replaceExisting
  }, { form, locate });
  return { window, api, adapter, desired, user, choose, locate, clicks, observe, run, identity, internship };
}

for (const scenario of scenarios) {
  for (const replaceExisting of [false, true]) {
    for (const stage of ['beforeOpen', 'beforeCandidate']) {
      test(`${scenario.kind} preserves a native choice ${stage} with replaceExisting=${replaceExisting}`, async t => {
        const h = await fixture(t, scenario);
        if (replaceExisting) h.choose(h.desired);
        const safety = h.observe();
        let checks = 0;
        h.window.ResumeProfileWriteContext = { async check() {
          if (++checks === (stage === 'beforeOpen' ? 1 : 3)) h.choose(h.user, stage === 'beforeOpen');
        } };
        const result = await h.run(replaceExisting);
        assert.equal(result.status, 'failed', JSON.stringify(result));
        assert.equal(result.reason, 'education_select_value_changed');
        assert.notEqual(result.partial, true);
        assert.deepEqual(plain(h.locate().value), [h.user]);
        assert.equal(h.clicks.length, 2, 'one menu open and one native option click; the adapter must stop before another click');
        safety(scenario.userCode, 1);
      });
    }

    test(`${scenario.kind} still fills an unchanged ${replaceExisting ? 'reapplied' : 'blank'} select`, async t => {
      const h = await fixture(t, scenario);
      if (replaceExisting) h.choose(h.desired);
      const safety = h.observe();
      h.window.ResumeProfileWriteContext = { async check() {} };
      const result = await h.run(replaceExisting);
      assert.equal(result.status, 'verified', JSON.stringify(result));
      assert.equal(result.reason, replaceExisting ? 'reapplied' : 'readback_matched');
      assert.deepEqual(plain(h.locate().value), [h.desired]);
      assert.equal(h.clicks.length, 2);
      safety(scenario.desiredCode, 1);
    });
  }

  test(`${scenario.kind} rejects a consumed candidate even when the native choice keeps the initial display`, async t => {
    const h = await fixture(t, scenario);
    h.choose(h.user);
    const safety = h.observe();
    let checks = 0;
    h.window.ResumeProfileWriteContext = { async check() {
      if (++checks === 3) h.choose(h.user, false);
    } };
    const result = await h.run(true);
    assert.equal(result.status, 'failed', JSON.stringify(result));
    assert.equal(result.reason, 'education_select_candidate_changed');
    assert.notEqual(result.partial, true);
    assert.deepEqual(plain(h.locate().value), [h.user]);
    assert.equal(h.clicks.length, 2);
    safety(scenario.userCode, 1);
  });

  for (const same of [false, true]) {
    test(`${scenario.kind} ${same ? 'verifies the same' : 'soft-skips a different'} occupied select without interaction`, async t => {
      const h = await fixture(t, scenario);
      h.choose(same ? h.desired : h.user);
      const safety = h.observe();
      let checks = 0;
      h.window.ResumeProfileWriteContext = { async check() { checks++; } };
      const result = await h.run(false);
      assert.equal(result.status, same ? 'verified' : 'skipped');
      assert.equal(result.reason, same ? 'preexisting_same_value' : 'existing_value');
      assert.equal(checks, 0);
      assert.deepEqual(h.clicks, []);
      safety(undefined, 0);
    });
  }

  for (const replaceExisting of [false, true]) {
    test(`${scenario.kind} controller retains the native option and reports failed DOM/props verification (${replaceExisting ? 'replace' : 'blank'})`, async t => {
      const h = await fixture(t, scenario);
      if (replaceExisting) h.choose(h.desired);
      const safety = h.observe();
      const domain = h.internship ? 'experience' : 'education';
      const profile = {
        [domain]: [{ [scenario.key]: h.internship ? 'internship' : h.desired }],
        confirmedFields: [`${domain}.0.${scenario.key}`]
      };
      const owner = await ownerBindingFor(profile, '00000000-0000-4000-8000-0000000000ed');
      const source = await (h.internship ? internshipSource : educationSource)(profile, 0);
      const plan = await (h.internship ? internshipPlan : educationPlan)(profile, [{
        profileIndex: 0, sourceSnapshotHash: source.hash,
        target: { mode: 'existing', identity: h.identity }, replaceExisting
      }], [], owner);
      const read = h.window.eval(`(${(h.internship ? readCmsInternshipSerialization : readCmsEducationSerialization).toString()})`);
      const verify = h.internship ? verifyInternshipSerialization : verifyEducationSerialization;
      let menuChecks = 0;
      const result = await h.api.run(plan, {
        verifyBeforeWrite: async () => true,
        checkOwner: async binding => {
          if (h.window.document.querySelector('.ant-select-dropdown') && ++menuChecks === 2) h.choose(h.user, false);
          return JSON.stringify(binding) === JSON.stringify(owner);
        },
        checkSource: async (index, hash) => index === 0 && hash === source.hash,
        readSerialization: async () => read(),
        verifySerialization: async (...args) => verify(...args),
        adapters: { select: h.adapter }
      });
      assert.equal(menuChecks, 2, 'race occurs during the real adapter candidate ownership check');
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(result.complete, false);
      const field = result.fields.find(field => field.key === scenario.key);
      assert.equal(field.status, 'failed');
      assert.equal(field.reason, 'education_select_value_changed');
      const serialized = result.serialization[0].fields.find(field => field.key === scenario.key);
      assert.equal(serialized.status, 'failed', 'native user choice must not be serialized as the profile fact');
      for (const key of ['addClicks', 'saveClicks', 'deleteClicks', 'finalSubmitClicks']) assert.equal(result[key], 0);
      assert.equal(h.window.ResumeProfileWriteContext, undefined);
      assert.deepEqual(plain(h.locate().value), [h.user]);
      assert.equal(h.clicks.length, 2);
      safety(scenario.userCode, 1);
    });
  }
}
