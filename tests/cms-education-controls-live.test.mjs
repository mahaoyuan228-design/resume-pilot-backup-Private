/**
 * Offline only. Captured school/select/date markup is combined with the legacy
 * fictional two-level region widget and synthetic public React props/events.
 * Sydney is a public catalog option in field-school-open.json. No applicant
 * values, browser connection, HTTP response, or live support are represented.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { integrationFixture } from './fixtures/cms-education-fixture.mjs';
import { mountHarvestSelectFixture } from './fixtures/cms-education-harvest-selects.mjs';
import { installHarvestedDates } from './fixtures/cms-education-harvest-dates.mjs';
import { readCmsEducationSerialization } from '../src/content/cms-education-serialization.mjs';
import { validatePlan } from '../src/profile/cms-education-plan.mjs';
import * as runner from '../scripts/live/cms-education-live.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';
const AUTOSAVE = 'https://wecruit.hotjob.cn/wecruit/resume/info/edit/SU629dbc0c0dcad452299bc0f7';
const LOOKUP = 'https://wecruit.hotjob.cn/wecruit/dic/fuzzyMatchDic';
const plain = value => JSON.parse(JSON.stringify(value));
let fixture = await integrationFixture({ schools: ['悉尼大学'], regions: [{ province: '北京市', city: '北京市' }] });
// Align the legacy fictional event/props scaffold to the harvested wrappers.
for (const [before, after] of [
  ["commit(rowIndex,248,", "commit(rowIndex,51,"],
  ["commit(rowIndex,51513929,", "commit(rowIndex,52,"],
  ["oldItemId:248,name:'学校'", "oldItemId:51,name:'学校'"],
  ["oldItemId:51513929,name:'城市'", "oldItemId:52,name:'城市'"],
  ["oldItemId:52,name:'学位'", "oldItemId:248,name:'学位'"],
  ["oldItemId:51,name:'学历'", "oldItemId:53,name:'学历'"],
  ["oldItemId:53,name:'专业名称'", "oldItemId:51513929,name:'专业名称'"]
]) {
  assert.ok(fixture.includes(before), before);
  fixture = fixture.replaceAll(before, after);
}

async function setup(t, { install = true, onSchoolOpen, emptyDegree = false, controlOriginals = {}, openerMode, delayedHiddenClose = false, previousWidgetControls } = {}) {
  const dom = new JSDOM(fixture, { url: PAGE, runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(window) {
      window.structuredClone = structuredClone;
      window.TextEncoder = TextEncoder;
      Object.defineProperty(window.crypto, 'subtle', { configurable: true, value: webcrypto.subtle });
    }
  });
  t.after(() => dom.window.close());
  const { window } = dom, { document } = window;
  window.Element.prototype.getClientRects = function () {
    if (!this.isConnected) return [];
    for (let node = this; node instanceof window.Element; node = node.parentElement) {
      const style = node.style;
      if (style.display === 'none' || style.visibility === 'hidden') return [];
    }
    return [{}];
  };
  Object.defineProperty(document, 'readyState', { configurable: true, get: () => 'complete' });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  document.hasFocus = () => true;
  const schedule = window.setTimeout.bind(window);
  window.setTimeout = (callback, _delay, ...args) => schedule(callback, 0, ...args);
  let time = 0;
  window.Date.now = () => (time += 50);
  window.performance.now = () => (time += 50);
  const native = { sends: 0, fetches: 0, forbidden: 0 };
  window.fetch = async () => { native.fetches++; return { ok: true, json: async () => ({ state: 200 }) }; };
  window.XMLHttpRequest.prototype.send = function () { native.sends++; };
  function commit(id, value) { window.fixtureProps.formData[`14_${id}_1`] = value; }
  const selects = mountHarvestSelectFixture(window, { scaffold: false, onCommit: ({ wrapperId, text }) => {
    const id = wrapperId.split('_')[1];
    commit(id, id === '51' ? { code: 'school-public-catalog-code', name: text } : text);
  } });
  const originals = { '51': '悉尼大学', '53': emptyDegree ? '' : '本科', '248': '学士', '102301': '无排名', ...controlOriginals };
  delete originals.startDate; delete originals.endDate; delete originals.region;
  for (const [id, text] of Object.entries(originals)) {
    const item = document.getElementById(`14_${id}_0`);
    const selected = item.querySelector('.ant-select-selection-selected-value');
    selected.textContent = text;
    selected.title = text;
    const meta = window.fixtureProps.infoData[0].find(field => String(field.oldItemId) === id);
    meta.dataSourceMap = Object.fromEntries(['本科','硕士研究生','学士','硕士','前10%','无排名'].map(value => [value, value]));
    commit(id, id === '51' ? { code: 'school-public-catalog-code', name: text } : text);
  }
  const school = document.getElementById('14_51_0').querySelector('.ant-select-selection');
  school.addEventListener('click', () => {
    // Restore the one public option observed in the source harvest after its
    // fixture sanitization; its DOM shape and selectors are unchanged.
    for (const option of document.querySelectorAll('.ant-select-dropdown-menu-item[role="option"]')) option.textContent = '悉尼大学';
  });
  const initialDates = { startDate: controlOriginals.startDate ?? '2023-02-01', endDate: controlOriginals.endDate ?? '2024-11-01' };
  const dates = installHarvestedDates(window, { initial: initialDates,
    onCommit: (key, value) => commit(key === 'startDate' ? '49' : '50', value) });
  commit('49', initialDates.startDate); commit('50', initialDates.endDate);
  // The harvested city prefix does not contain the second dropdown. This is
  // the repository's existing fictional region fixture, explicitly retained.
  const regionOriginal = controlOriginals.region || ['北京市', '北京市'];
  window.fixtureWidgets.regions[0].setExisting(...regionOriginal);
  window.fixtureProps.dataSource.regions[0].name = regionOriginal[0];
  window.fixtureProps.dataSource.regions[0].sonDicInfos[0].name = regionOriginal[1];
  commit('52', 'city-0');
  const textInputs = { major: document.getElementById('14_51513929_0').querySelector('input'),
    description: document.getElementById('14_55_0').querySelector('textarea') };
  textInputs.major.value = '  private fictional major  ';
  textInputs.description.value = '\nprivate fictional description\n';
  for (const input of Object.values(textInputs)) input.dispatchEvent(new window.Event('input', { bubbles: true }));
  for (const label of ['Save', 'Submit', 'Next', 'Deliver', 'Delete']) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
    button.addEventListener('click', () => native.forbidden++); document.querySelector('form').append(button);
  }
  function xhr(url = AUTOSAVE, method = 'POST') {
    const request = new window.XMLHttpRequest(); request.open(method, url); request.send('private-request-body');
  }
  // Opening controls, choosing options/days, native text events, and restoration
  // all model the evidenced autosave behavior without a real HTTP transport.
  document.addEventListener('click', event => {
    if (event.target.closest('.ant-select-selection,.ant-select-dropdown-menu-item,.ant-calendar-date-panel,.ant-calendar-picker-input')) xhr();
  });
  for (const input of Object.values(textInputs)) for (const type of ['input', 'change', 'blur']) input.addEventListener(type, () => xhr());
  school.addEventListener('click', () => { xhr(LOOKUP); onSchoolOpen?.({ window, document, xhr }); });
  const probeTiming = { delayed: 0, instanceClicks: 0, mouseSequences: [], hiddenCloses: 0 };
  const openers = [...document.querySelectorAll('.form-cell[id="14"] .ant-select-selection[role="combobox"],.form-cell[id="14"] input.ant-calendar-picker-input[readonly]')];
  // The harvest retry scripts use mousePressed/mouseReleased on these exact
  // surfaces. Their React handlers were not captured. These fictional event
  // gates expose the old click-only blind spot without inventing more DOM.
  if (openerMode === 'mouse-sequence') for (const surface of openers) {
    const sequence = [];
    surface.click = () => { probeTiming.instanceClicks++; };
    for (const type of ['mousedown', 'mouseup', 'click']) surface.addEventListener(type, event => {
      sequence.push(event.type);
      if (event.type !== 'click') return;
      if (sequence.join(',') !== 'mousedown,mouseup,click') event.stopImmediatePropagation();
      else probeTiming.mouseSequences.push({ wrapper: surface.closest('[id^="14_"]').id, events: [...sequence] });
      sequence.length = 0;
    }, true);
  }
  if (openerMode === 'noop-school') school.addEventListener('click', event => event.stopImmediatePropagation(), true);
  if (['delayed-school', 'delayed-calendar'].includes(openerMode)) {
    const surface = openerMode === 'delayed-school' ? school : dates.inputFor('startDate');
    const resumed = new WeakSet();
    surface.addEventListener('click', event => {
      if (resumed.has(event)) return;
      event.stopImmediatePropagation();
      probeTiming.delayed++;
      window.setTimeout(() => window.setTimeout(() => {
        const delayed = new window.MouseEvent('click', { bubbles: true, cancelable: true });
        resumed.add(delayed); surface.dispatchEvent(delayed);
      }, 75), 75);
    }, true);
  }
  if (delayedHiddenClose) {
    const remove = window.Element.prototype.remove;
    window.Element.prototype.remove = function () {
      if (!this.matches('.ant-select-dropdown')) return remove.call(this);
      const menu = this;
      // Harvested closed dropdowns remain mounted with this hidden class. Model
      // an asynchronous close transition rather than immediate DOM removal.
      window.setTimeout(() => window.setTimeout(() => {
        menu.classList.add('ant-select-dropdown-hidden'); menu.style.display = 'none';
        probeTiming.hiddenCloses++;
      }, 75), 75);
    };
  }
  const readProof = () => plain(window.eval(`(${readCmsEducationSerialization.toString()})()`));
  if (previousWidgetControls) Object.defineProperty(window, 'ResumeCmsEducationMultiWidgetControls', previousWidgetControls);
  if (install) {
    const installed = window.eval(runner.buildPageExpression(root, 0, true));
    assert.equal(installed.ok, true, JSON.stringify(installed));
    for (const file of [...runner.LIVE_FILES, ...runner.CONTROL_FILES]) window.eval(fs.readFileSync(path.join(root, file), 'utf8'));
  }
  return { window, document, native, selects, dates, textInputs, readProof, xhr, probeTiming, api: window.__cmsEducationLive };
}

test('controls opt-in creates seven explicit fixture facts/supplements; text default stays narrow', async () => {
  assert.equal(runner.readControls({}), false);
  assert.equal(runner.readControls({ CONTROLS: '1' }), true);
  for (const CONTROLS of ['', 'true', '2', 1]) assert.throws(() => runner.readControls({ CONTROLS }), /CONTROLS/u);
  const plan = await runner.createLivePlan('["fictional-row"]', 0, true);
  assert.equal((await validatePlan(runner.fixtureProfile(0, 1, true), plan, plan.ownerBinding.epoch)).ok, true);
  assert.equal(Object.values(plan.records[0].facts).filter(fact => fact.status === 'ready').length, 9);
  assert.deepEqual(plan.records[0].facts.region.value, { province: '北京市', city: '北京市' });
  assert.equal(plan.records[0].facts.academicDegree.path, 'recordSupplement.0.academicDegree');
  assert.equal(runner.fieldSpecsForRow(1, true).length, 9);
  assert.equal(runner.fieldSpecsForRow(1).length, 2);
});

test('exact school lookup classifier rejects alternate transports, URLs, and credentials', () => {
  assert.equal(runner.isSchoolLookup({ method: 'POST', url: LOOKUP }), true);
  assert.equal(runner.isSchoolLookup({ method: 'POST', url: '/wecruit/dic/fuzzyMatchDic' }), true);
  for (const method of ['GET','HEAD','OPTIONS','PUT','DELETE','']) assert.equal(runner.isSchoolLookup({ method, url: LOOKUP }), false);
  for (const url of [`${LOOKUP}/`, `${LOOKUP}?q=private`, `${LOOKUP}#private`, LOOKUP.replace('https:', 'http:'),
    LOOKUP.replace('hotjob.cn', 'hotjob.cn.evil.invalid'), LOOKUP.replace('https://', 'https://private:secret@')]) {
    assert.equal(runner.isSchoolLookup({ method: 'POST', url }), false);
  }
});

test('nine-field trial probes captured widgets, verifies preexisting controls, and restores exact text with zero native POST/save clicks', async t => {
  const h = await setup(t), before = h.readProof();
  assert.equal(before.ok, true, JSON.stringify(before));
  const prepared = h.api.prepare(); assert.equal(prepared.ok, true, JSON.stringify(prepared));
  const result = await h.api.run(await runner.createLivePlan(plain(prepared.identities), 0, true));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.restored, true); assert.equal(result.pageLeftAsFound, true); assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.readbacks.length, 9); assert.ok(result.readbacks.every(field => field.ok));
  assert.deepEqual(h.readProof(), before, 'raw public props, DTO values, and original exact text are restored');
  assert.equal(h.api.widgetClickCount(), 8, 'seven openers and the evidenced province outside-click cleanup');
  assert.equal(h.native.sends, 0); assert.equal(h.native.forbidden, 0);
  assert.deepEqual(plain(h.api.posts()), []); assert.deepEqual(plain(h.api.clicks()), []);
  assert.ok(h.api.suppressedAutosave().some(row => row.phase === 'trial'));
  assert.ok(h.api.suppressedAutosave().some(row => row.phase === 'restore'));
  assert.ok(h.api.suppressedLookup().length > 0);
  assert.ok(h.api.suppressedLookup().every(row => row.url === LOOKUP && row.blockedBeforeSend && row.via === 'xhr'));
  assert.equal(h.window.fixtureCounts.saves, 0); assert.equal(h.window.fixtureCounts.submits, 0);
  const cleanup = await h.api.cleanup(); assert.equal(cleanup.ok, true, JSON.stringify(cleanup));
  assert.equal(h.window.ResumeCmsInternshipDates, undefined); assert.equal(h.window.ResumeCmsInternshipSelect, undefined);
  assert.equal(h.window.ResumeCmsEducationMultiWidgetControls, undefined, 'the controls-only activation helper is removed with the injected adapters');
  assert.equal(JSON.stringify({ result, cleanup }).includes('private fictional'), false);
  assert.equal(JSON.stringify({ result, cleanup }).includes('private-request-body'), false);
});

test('controls cleanup restores the previous activation-helper property descriptor', async t => {
  const previous = { retained: true }, descriptor = { value: previous, configurable: true, enumerable: false, writable: false };
  const h = await setup(t, { previousWidgetControls: descriptor });
  assert.equal(typeof h.window.ResumeCmsEducationMultiWidgetControls.activateSurface, 'function');
  assert.notEqual(h.window.ResumeCmsEducationMultiWidgetControls, previous);
  assert.equal((await h.api.cleanup()).ok, true);
  assert.deepEqual(Object.getOwnPropertyDescriptor(h.window, 'ResumeCmsEducationMultiWidgetControls'), descriptor);
});

test('activation helper stops if a captured wrapper is replaced between mouse down and mouse up', async t => {
  const h = await setup(t), wrapper = h.document.getElementById('14_51_0');
  const surface = wrapper.querySelector('.ant-select-selection'), events = [];
  for (const type of ['mousedown', 'mouseup', 'click']) surface.addEventListener(type, event => events.push(event.type), true);
  surface.addEventListener('mousedown', () => wrapper.replaceWith(wrapper.cloneNode(true)), { once: true });
  const activated = h.window.ResumeCmsEducationMultiWidgetControls.activateSurface(surface,
    () => h.document.getElementById('14_51_0').querySelector('.ant-select-selection'));
  assert.equal(activated, false); assert.deepEqual(events, ['mousedown']);
  assert.equal(h.api.widgetClickCount(), 0); assert.equal(h.native.sends, 0); assert.equal(h.native.forbidden, 0);
  assert.equal((await h.api.cleanup()).ok, true);
});

test('empty original control fails before any trial events or writes', async t => {
  const h = await setup(t, { emptyDegree: true }), before = h.readProof();
  const prepared = h.api.prepare();
  assert.equal(prepared.ok, false); assert.equal(prepared.reason, 'education_control_original_not_restorable');
  assert.equal(h.api.widgetClickCount(), 0); assert.equal(h.api.suppressedAutosave().length, 0);
  assert.deepEqual(h.readProof(), before); assert.equal((await h.api.cleanup()).ok, true);
});

for (const [label, controlOriginals] of [
  ['school', { '51': 'different fictional original school' }],
  ['degree', { '53': '硕士研究生' }],
  ['academic degree', { '248': '硕士' }],
  ['ranking', { '102301': '前10%' }],
  ['start day', { startDate: '2020-09-01' }],
  ['end day', { endDate: '2024-06-01' }],
  ['city pair', { region: ['上海市', '上海市'] }]
]) test(`differing ${label} original fails before any text write or widget opening`, async t => {
  const h = await setup(t, { controlOriginals }), before = h.readProof(), textEvents = h.window.fixtureCounts.textEvents;
  const prepared = h.api.prepare(); assert.equal(prepared.ok, false);
  assert.match(prepared.reason, /^education_(?:school_original_not_restorable|region_original_not_restorable|control_original_not_fixture)$/u);
  assert.equal(h.api.widgetClickCount(), 0); assert.equal(h.api.suppressedAutosave().length, 0);
  assert.equal(h.window.fixtureCounts.textEvents, textEvents); assert.deepEqual(h.readProof(), before);
  assert.equal((await h.api.cleanup()).ok, true);
});

test('a no-op opener cannot produce successful probe evidence', async t => {
  const h = await setup(t, { openerMode: 'noop-school' }), before = h.readProof(), prepared = h.api.prepare();
  assert.equal(prepared.ok, true);
  const result = await h.api.run(await runner.createLivePlan(plain(prepared.identities), 0, true));
  assert.equal(result.ok, false); assert.equal(result.reason, 'widget_open_failed');
  assert.deepEqual(h.readProof(), before); assert.equal(h.api.widgetClickCount(), 1, 'a dispatched opener click is an attempt, not owned-overlay evidence');
  assert.equal(h.native.sends, 0); assert.equal((await h.api.cleanup()).ok, true);
});

test('harvested select and readonly calendar openers receive a full mouse sequence even when instance click is inert', async t => {
  const h = await setup(t, { openerMode: 'mouse-sequence' }), before = h.readProof(), prepared = h.api.prepare();
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  const result = await h.api.run(await runner.createLivePlan(plain(prepared.identities), 0, true));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.liveSupportClaimed, false); assert.equal(result.restored, true); assert.equal(result.pageLeftAsFound, true);
  assert.equal(h.probeTiming.instanceClicks, 0, 'the probe dispatches on the harvested opener rather than calling a site-patched instance click');
  assert.deepEqual(h.probeTiming.mouseSequences.map(({ wrapper }) => wrapper).sort(),
    ['14_51_0', '14_53_0', '14_248_0', '14_49_0', '14_50_0', '14_52_0', '14_102301_0'].sort());
  assert.ok(h.probeTiming.mouseSequences.every(({ events }) => events.join(',') === 'mousedown,mouseup,click'));
  assert.deepEqual(h.readProof(), before); assert.equal(h.native.sends, 0); assert.equal(h.native.forbidden, 0);
  assert.equal(h.selects.counts.selections, 0); assert.equal(h.dates.snapshot().selections, 0);
  assert.deepEqual(plain(h.api.clicks()), []); assert.deepEqual(plain(h.api.posts()), []);
  assert.equal((await h.api.cleanup()).ok, true);
});

test('probe close waits for captured dropdowns to become hidden without selecting options', async t => {
  const h = await setup(t, { delayedHiddenClose: true }), before = h.readProof(), prepared = h.api.prepare();
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  const result = await h.api.run(await runner.createLivePlan(plain(prepared.identities), 0, true));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.liveSupportClaimed, false); assert.equal(result.pageLeftAsFound, true);
  assert.ok(h.probeTiming.hiddenCloses >= 4);
  assert.ok(h.document.querySelectorAll('.ant-select-dropdown.ant-select-dropdown-hidden').length >= 4);
  assert.equal(h.document.querySelectorAll('.ant-select-open,.ant-select-dropdown:not(.ant-select-dropdown-hidden),.ant-calendar-picker-container').length, 0);
  assert.equal(h.selects.counts.selections, 0); assert.equal(h.native.sends, 0); assert.equal(h.native.forbidden, 0);
  assert.deepEqual(h.readProof(), before); assert.equal((await h.api.cleanup()).ok, true);
});

test('an opened dropdown without the bound selection aria owner is never accepted as probe evidence', async t => {
  let school, originalOwner;
  const h = await setup(t, { onSchoolOpen: ({ document }) => {
    school = document.getElementById('14_51_0').querySelector('.ant-select-selection');
    originalOwner = school.getAttribute('aria-controls');
    // Rebind only captured ownership attributes to another captured selection.
    // A visible menu and open class alone cannot prove it belongs to school.
    const other = document.getElementById('14_102301_0').querySelector('.ant-select-selection');
    school.setAttribute('aria-controls', other.getAttribute('aria-controls'));
  } });
  const before = h.readProof(), prepared = h.api.prepare(); assert.equal(prepared.ok, true);
  const result = await h.api.run(await runner.createLivePlan(plain(prepared.identities), 0, true));
  assert.equal(result.ok, false); assert.equal(result.reason, 'widget_open_failed');
  assert.equal(result.liveSupportClaimed, false); assert.equal(result.pageLeftAsFound, false);
  assert.equal(h.selects.counts.selections, 0); assert.equal(h.native.sends, 0); assert.equal(h.native.forbidden, 0);
  assert.deepEqual(h.readProof(), before);
  // The test owns its fictional DOM and restores the tampered owner for final
  // teardown. The runner must fail closed rather than dismiss a foreign menu.
  school.setAttribute('aria-controls', originalOwner); h.selects.close();
  assert.equal((await h.api.cleanup()).ok, true);
});

test('an open class and hidden linked catalog options do not satisfy the visible-overlay probe', async t => {
  const h = await setup(t, { onSchoolOpen: ({ document }) => {
    const menu = document.querySelector('.ant-select-dropdown');
    menu.classList.add('ant-select-dropdown-hidden'); menu.style.display = 'none';
  } });
  const before = h.readProof(), prepared = h.api.prepare(); assert.equal(prepared.ok, true);
  const result = await h.api.run(await runner.createLivePlan(plain(prepared.identities), 0, true));
  assert.equal(result.ok, false); assert.equal(result.reason, 'widget_open_failed');
  assert.equal(result.liveSupportClaimed, false); assert.equal(result.restored, true); assert.equal(result.pageLeftAsFound, true);
  assert.equal(h.selects.counts.selections, 0); assert.equal(h.native.sends, 0); assert.equal(h.native.forbidden, 0);
  assert.deepEqual(h.readProof(), before);
  assert.equal(h.document.querySelectorAll('.ant-select-open,.ant-calendar-picker-container').length, 0);
  assert.equal((await h.api.cleanup()).ok, true);
});

for (const openerMode of ['delayed-school', 'delayed-calendar']) test(`${openerMode} waits for the owned portal and leaves no overlay behind`, async t => {
  const h = await setup(t, { openerMode }), before = h.readProof(), prepared = h.api.prepare();
  assert.equal(prepared.ok, true);
  const result = await h.api.run(await runner.createLivePlan(plain(prepared.identities), 0, true));
  assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(h.probeTiming.delayed, 1);
  assert.deepEqual(h.readProof(), before);
  assert.equal(h.document.querySelectorAll('.ant-select-dropdown,.ant-select-open,.ant-calendar-picker-container').length, 0);
  assert.equal((await h.api.cleanup()).ok, true);
});

test('fake CDP controls host reports exact restored proof and validates separate lookup suppression', async t => {
  const h = await setup(t, { install: false }), before = h.readProof();
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-education-controls-'));
  t.after(() => {
    const resolved = path.resolve(outDir), parent = path.resolve(os.tmpdir()) + path.sep;
    assert.ok(resolved.startsWith(parent)); fs.rmSync(resolved, { recursive: true, force: true });
  });
  const evidence = await runner.runCmsEducationLive({ controls: true, repoRoot: root, outDir, tipSha: runner.BASE_TIP,
    getJson: async () => [{ id: 'controls-offline', type: 'page', url: PAGE,
      webSocketDebuggerUrl: 'ws://127.0.0.1:9239/devtools/page/controls-offline' }],
    connectCdp: async () => ({ close() {}, async send(method, params) {
      if (method !== 'Runtime.evaluate') return {};
      return { result: { value: plain(await h.window.eval(params.expression)) } };
    } })
  });
  assert.equal(evidence.finalDetails.exitCode, 0, JSON.stringify(evidence));
  assert.equal(evidence.liveSupportClaimed, false); assert.equal(evidence.fields.length, 9);
  assert.equal(evidence.finalDetails.widgetClickCount, 8); assert.equal(evidence.finalDetails.clickCount, 0);
  assert.ok(evidence.suppressedLookup.length > 0); assert.deepEqual(evidence.nonGet, []);
  assert.deepEqual(h.readProof(), before); assert.equal(h.native.sends, 0); assert.equal(h.native.forbidden, 0);
  const missing = structuredClone(evidence); delete missing.suppressedLookup;
  assert.equal(runner.evidenceExitCode(missing), 2);
  const spoofed = structuredClone(evidence); spoofed.suppressedLookup[0].url += '?private';
  assert.equal(runner.evidenceExitCode(spoofed), 2);
  const count = structuredClone(evidence); delete count.finalDetails.widgetClickCount;
  assert.equal(runner.evidenceExitCode(count), 2);
});

for (const [label, action, reason] of [
  ['unknown POST', ({ xhr }) => xhr('https://wecruit.hotjob.cn/wecruit/resume/unknown'), 'non_get_request'],
  ['query-bearing school lookup', ({ xhr }) => xhr(`${LOOKUP}?q=private`), 'non_get_request'],
  ['Save/Submit/Next/Deliver/Delete', ({ document }) => {
    for (const label of ['Save','Submit','Next','Deliver','Delete']) [...document.querySelectorAll('button')].find(button => button.textContent === label).click();
  }, 'click_not_allowed'],
  ['unowned option', ({ document }) => {
    const option = document.createElement('li'); option.className = 'ant-select-dropdown-menu-item'; option.setAttribute('role', 'option');
    document.body.append(option); option.click(); option.remove();
  }, 'click_not_allowed']
]) test(`${label} remains fatal during an otherwise allowed active school opening`, async t => {
  let called = false;
  const h = await setup(t, { onSchoolOpen: context => { if (!called) { called = true; action(context); } } });
  const before = h.readProof(), prepared = h.api.prepare(); assert.equal(prepared.ok, true, JSON.stringify(prepared));
  const result = await h.api.run(await runner.createLivePlan(plain(prepared.identities), 0, true));
  assert.equal(result.ok, false); assert.equal(result.reason, reason); assert.equal(result.liveSupportClaimed, false);
  assert.equal(h.native.sends, 0); assert.equal(h.native.forbidden, 0);
  assert.deepEqual(h.readProof(), before);
  await h.api.cleanup();
});
