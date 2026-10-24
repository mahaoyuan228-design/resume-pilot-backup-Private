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
import { harvestSelects, mountHarvestSelectFixture } from './fixtures/cms-education-harvest-selects.mjs';
import { installHarvestedDates } from './fixtures/cms-education-harvest-dates.mjs';
import { readCmsEducationSerialization } from '../src/content/cms-education-serialization.mjs';
import { validatePlan } from '../src/profile/cms-education-plan.mjs';
import * as runner from '../scripts/live/cms-education-live.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';
const AUTOSAVE = 'https://wecruit.hotjob.cn/wecruit/resume/info/edit/SU629dbc0c0dcad452299bc0f7';
const HOUSEKEEPING_AUTOSAVE = `${AUTOSAVE}?iSaJAx=isAjax&request_locale=zh_CN`;
const LOOKUP = 'https://wecruit.hotjob.cn/wecruit/dic/fuzzyMatchDic';
const HOUSEKEEPING_LOOKUP = `${LOOKUP}?iSaJAx=isAjax&request_locale=zh_CN&t=1792759070926`;
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

async function setup(t, { install = true, beforeInstall, schoolLookup, lookupClassifier, controlAutosaveClassifier, onSchoolOpen, emptyDegree = false, controlOriginals = {}, openerMode, delayedHiddenClose = false, previousWidgetControls } = {}) {
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
  school.addEventListener('click', () => {
    if (schoolLookup) schoolLookup({ window, document, xhr });
    else xhr(LOOKUP);
    onSchoolOpen?.({ window, document, xhr });
  });
  const probeTiming = { delayed: 0, instanceClicks: 0, mouseSequences: [], hiddenCloses: 0,
    focusReplacements: 0, detachedMouseEvents: [], replacementMouseEvents: [] };
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
  if (openerMode === 'focus-replace-school') {
    for (const type of ['mousedown', 'mouseup', 'click']) school.addEventListener(type,
      event => probeTiming.detachedMouseEvents.push(event.type), true);
    school.addEventListener('focus', () => {
      // A deliberately fictional focus handler models a pre-dispatch render.
      // Only the already captured selection is cloned inside its existing
      // wrapper; the school owner, value, and harvested markup stay identical.
      // The live count=0 evidence does not establish this as the site's cause.
      const replacement = school.cloneNode(true);
      school.replaceWith(replacement); probeTiming.focusReplacements++;
      replacement.click = () => { probeTiming.instanceClicks++; };
      for (const type of ['mousedown', 'mouseup', 'click']) replacement.addEventListener(type,
        event => probeTiming.replacementMouseEvents.push(event.type), true);
      let menu;
      replacement.addEventListener('click', () => {
        // Rebind fictional behavior to the new node using the existing exact
        // captured menu template; cloning DOM cannot preserve event listeners.
        replacement.closest('.ant-select').classList.add('ant-select-open');
        replacement.setAttribute('aria-expanded', 'true');
        const searchWrap = replacement.querySelector('.ant-select-search');
        if (searchWrap) searchWrap.style.display = 'block';
        const template = document.createElement('template');
        template.innerHTML = harvestSelects.menus['学校'].html;
        menu = template.content.firstElementChild;
        menu.classList.remove('ant-select-dropdown-hidden'); menu.style.display = 'block';
        document.body.append(menu); selects.counts.opens++;
        xhr(LOOKUP);
      });
      replacement.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        menu?.remove(); replacement.closest('.ant-select').classList.remove('ant-select-open');
        replacement.setAttribute('aria-expanded', 'false');
        const searchWrap = replacement.querySelector('.ant-select-search');
        if (searchWrap) searchWrap.style.display = 'none';
      });
    }, { once: true });
  }
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
  beforeInstall?.({ window, document, native });
  if (install) {
    let expression = runner.buildPageExpression(root, 0, true);
    if (lookupClassifier) {
      const declaration = `const isSchoolLookup = ${runner.isSchoolLookup.toString()};`;
      assert.equal(expression.split(declaration).length, 2);
      expression = expression.replace(declaration, `const isSchoolLookup = ${lookupClassifier.toString()};`);
    }
    if (controlAutosaveClassifier) {
      const declaration = `const isEducationControlAutosave = ${runner.isEducationControlAutosave.toString()};`;
      assert.equal(expression.split(declaration).length, 2);
      expression = expression.replace(declaration, `const isEducationControlAutosave = ${controlAutosaveClassifier.toString()};`);
    }
    const installed = window.eval(expression);
    assert.equal(installed.ok, true, JSON.stringify(installed));
    for (const file of [...runner.LIVE_FILES, ...runner.CONTROL_FILES]) window.eval(fs.readFileSync(path.join(root, file), 'utf8'));
  }
  return { window, document, native, selects, dates, textInputs, readProof, xhr, probeTiming, api: window.__cmsEducationLive };
}

function captureTrialHooks(window) {
  return [
    ['fetch', window, 'fetch'], ['click', window.HTMLElement.prototype, 'click'],
    ['submit', window.HTMLFormElement.prototype, 'submit'], ['requestSubmit', window.HTMLFormElement.prototype, 'requestSubmit'],
    ...['open', 'send', 'abort'].map(key => [`XHR.${key}`, window.XMLHttpRequest.prototype, key]),
    ...['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'].map(key => [key, window, key])
  ].map(([label, object, key]) => ({ label, object, key, descriptor: Object.getOwnPropertyDescriptor(object, key) }));
}

function assertTrialHooks(hooks, message) {
  for (const { label, object, key, descriptor } of hooks) {
    assert.deepEqual(Object.getOwnPropertyDescriptor(object, key), descriptor, `${label}: ${message}`);
  }
}

function assertSettledControlsTimers(timers) {
  assert.deepEqual(plain(timers), { pendingTimers: 0, unobservableTimers: 0, observedNonFunctionTimeouts: 0 });
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

test('controls school callbacks settle nested function timers and promise work through nine readbacks and cleanup', async t => {
  let nativeHooks, callbackSuppression;
  const completed = [];
  const h = await setup(t, { beforeInstall: ({ window }) => { nativeHooks = captureTrialHooks(window); },
    onSchoolOpen: ({ window, xhr }) => {
      // Fictional callbacks exercise the existing harvested opener and timer
      // guards; neither the handlers nor their timing are a live-site claim.
      window.setTimeout(() => {
        completed.push('outer');
        window.Promise.resolve().then(() => {
          completed.push('promise');
          window.setTimeout(() => {
            const count = window.__cmsEducationLive.suppressedAutosave().length;
            xhr();
            callbackSuppression = plain(window.__cmsEducationLive.suppressedAutosave().slice(count));
            completed.push('inner');
          }, 650);
        });
      }, 650);
    }
  }), before = h.readProof(), outside = h.document.getElementById('unrelated').value;
  const prepared = h.api.prepare(); assert.equal(prepared.ok, true);
  const result = await h.api.run(await runner.createLivePlan(plain(prepared.identities), 0, true));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(completed, ['outer', 'promise', 'inner']);
  assert.deepEqual(callbackSuppression, [{ method: 'POST', url: AUTOSAVE, via: 'xhr', blockedBeforeSend: true, phase: 'trial' }]);
  assert.equal(result.readbacks.length, 9); assert.ok(result.readbacks.every(field => field.ok && field.reason === 'readback_matched'));
  assertSettledControlsTimers(result.timerSettle); assertSettledControlsTimers(h.api.timerSettle());
  assert.equal(result.restored, true); assert.equal(result.pageLeftAsFound, true); assert.equal(result.otherChanged, false);
  assert.equal(result.liveSupportClaimed, false); assert.deepEqual(h.readProof(), before);
  assert.equal(h.document.getElementById('unrelated').value, outside);
  assert.equal(h.native.sends, 0); assert.equal(h.native.forbidden, 0);
  assert.deepEqual(plain(h.api.posts()), []); assert.deepEqual(plain(h.api.clicks()), []);
  const cleanup = await h.api.cleanup(); assert.equal(cleanup.ok, true, JSON.stringify(cleanup));
  assertSettledControlsTimers(cleanup.timerSettle); assert.deepEqual(completed, ['outer', 'promise', 'inner']);
  assert.deepEqual(h.readProof(), before); assert.equal(h.window.__cmsEducationLive, undefined);
  assert.equal(h.document.querySelectorAll('.ant-select-open,.ant-select-dropdown:not(.ant-select-dropdown-hidden),.ant-calendar-picker-container').length, 0);
  assertTrialHooks(nativeHooks, 'restored after settled controls callbacks');
});

test('controls school interval keeps cleanup guards until the fictional interval is explicitly cleared', async t => {
  let nativeHooks, interval;
  const h = await setup(t, { beforeInstall: ({ window }) => { nativeHooks = captureTrialHooks(window); },
    // Use the existing fixture opener, without adding a site handler or DOM.
    onSchoolOpen: ({ window, xhr }) => { interval = window.setInterval(() => xhr(), 60000); }
  }), before = h.readProof(), guardedHooks = captureTrialHooks(h.window);
  const prepared = h.api.prepare(); assert.equal(prepared.ok, true);
  const result = await h.api.run(await runner.createLivePlan(plain(prepared.identities), 0, true));
  assert.equal(result.ok, false); assert.equal(result.reason, 'autosave_callbacks_pending');
  assert.equal(result.pageLeftAsFound, false); assert.equal(result.liveSupportClaimed, false);
  assert.ok(result.timerSettle.pendingTimers > 0); assert.equal(result.timerSettle.unobservableTimers, 0);
  assert.equal(h.api.widgetProbes()[0].key, 'school'); assert.equal(h.api.widgetProbes()[0].reason, 'autosave_callbacks_pending');
  const unresolved = await h.api.cleanup();
  assert.equal(unresolved.ok, false); assert.equal(unresolved.reason, 'autosave_callbacks_pending');
  assert.ok(unresolved.timerSettle.pendingTimers > 0); assert.equal(h.window.__cmsEducationLive, h.api);
  assertTrialHooks(guardedHooks, 'retained while controls callbacks remain pending');
  assert.deepEqual(h.readProof(), before); assert.equal(h.native.sends, 0); assert.equal(h.native.forbidden, 0);
  assert.deepEqual(plain(h.api.posts()), []); assert.deepEqual(plain(h.api.clicks()), []);
  h.window.clearInterval(interval);
  assertSettledControlsTimers(h.api.timerSettle());
  const cleanup = await h.api.cleanup(); assert.equal(cleanup.ok, true, JSON.stringify(cleanup));
  assertSettledControlsTimers(cleanup.timerSettle); assert.deepEqual(h.readProof(), before);
  assert.equal(h.window.__cmsEducationLive, undefined);
  assert.equal(h.document.querySelectorAll('.ant-select-open,.ant-select-dropdown:not(.ant-select-dropdown-hidden),.ant-calendar-picker-container').length, 0);
  assertTrialHooks(nativeHooks, 'restored after the controls interval is cleared');
});

test('controls opening detects a changed existing neighbor and retains guards without overwriting it', async t => {
  let nativeHooks;
  const changed = 'fictional neighboring mutation';
  const h = await setup(t, { beforeInstall: ({ window }) => { nativeHooks = captureTrialHooks(window); },
    onSchoolOpen: ({ document }) => { document.getElementById('unrelated').value = changed; }
  }), before = h.readProof(), outside = h.document.getElementById('unrelated'), original = outside.value,
    guardedHooks = captureTrialHooks(h.window);
  const prepared = h.api.prepare(); assert.equal(prepared.ok, true);
  const result = await h.api.run(await runner.createLivePlan(plain(prepared.identities), 0, true));
  assert.equal(result.ok, false); assert.equal(result.otherChanged, true); assert.equal(result.pageLeftAsFound, false);
  assert.equal(result.liveSupportClaimed, false); assert.equal(outside.value, changed);
  assert.deepEqual(h.readProof(), before); assert.equal(h.native.sends, 0); assert.equal(h.native.forbidden, 0);
  assert.deepEqual(plain(h.api.posts()), []); assert.deepEqual(plain(h.api.clicks()), []);
  const unresolved = await h.api.cleanup(); assert.equal(unresolved.ok, false); assert.equal(unresolved.reason, 'restore_failed');
  assert.equal(outside.value, changed); assert.equal(h.window.__cmsEducationLive, h.api);
  assertTrialHooks(guardedHooks, 'retained while the existing neighbor differs');
  // The test owns this mutation; the runner may restore only its authorized
  // fields. Restore the existing fixture neighbor before final teardown.
  outside.value = original;
  const cleanup = await h.api.cleanup(); assert.equal(cleanup.ok, true, JSON.stringify(cleanup));
  assertSettledControlsTimers(cleanup.timerSettle); assert.deepEqual(h.readProof(), before);
  assert.equal(h.window.__cmsEducationLive, undefined);
  assert.equal(h.document.querySelectorAll('.ant-select-open,.ant-select-dropdown:not(.ant-select-dropdown-hidden),.ant-calendar-picker-container').length, 0);
  assertTrialHooks(nativeHooks, 'restored after the fixture neighbor is restored');
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

test('activation diagnostics expose a validate rejection before any counted opener click', async t => {
  const h = await setup(t), surface = h.document.getElementById('14_51_0').querySelector('.ant-select-selection');
  const events = [], reports = [];
  for (const type of ['mousedown', 'mouseup', 'click']) surface.addEventListener(type, event => events.push(event.type), true);
  const activated = h.window.ResumeCmsEducationMultiWidgetControls.activateSurface(surface, () => null,
    report => reports.push(plain(report)));
  assert.equal(activated, false); assert.deepEqual(events, []);
  assert.deepEqual(reports.at(-1), { stage: 'preflight', reason: 'validation_rejected', events: [], observedEvents: [] });
  assert.equal(h.api.widgetClickCount(), 0); assert.deepEqual(plain(h.api.clicks()), []);
  assert.equal(h.native.sends, 0); assert.equal(h.native.forbidden, 0);
  assert.equal((await h.api.cleanup()).ok, true);
});

for (const replacementKind of ['aria-owner', 'wrapper']) test(`focus replacement with a changed ${replacementKind} fails before mouse dispatch`, async t => {
  const h = await setup(t), wrapper = h.document.getElementById('14_51_0');
  const surface = wrapper.querySelector('.ant-select-selection'), events = [], reports = [];
  for (const type of ['mousedown', 'mouseup', 'click']) h.document.addEventListener(type, event => events.push(event.type), true);
  surface.addEventListener('focus', () => {
    if (replacementKind === 'wrapper') wrapper.replaceWith(wrapper.cloneNode(true));
    else {
      const replacement = surface.cloneNode(true);
      replacement.setAttribute('aria-controls', h.document.getElementById('14_102301_0')
        .querySelector('.ant-select-selection').getAttribute('aria-controls'));
      surface.replaceWith(replacement);
    }
  }, { once: true });
  const activated = h.window.ResumeCmsEducationMultiWidgetControls.activateSurface(surface,
    () => h.document.getElementById('14_51_0').querySelector('.ant-select-selection'),
    report => reports.push(plain(report)));
  assert.equal(activated, false); assert.deepEqual(events, []);
  assert.deepEqual(reports.at(-1), { stage: 'focus', reason: 'binding_changed', events: [], observedEvents: [] });
  assert.equal(h.api.widgetClickCount(), 0); assert.deepEqual(plain(h.api.clicks()), []);
  assert.equal(h.native.sends, 0); assert.equal(h.native.forbidden, 0);
  assert.equal((await h.api.cleanup()).ok, true);
});

test('a same-owner school render on focus rebinds before mousedown and produces owned open/close proof', async t => {
  // #175 pinned the initial Element through focus. This models an uncovered
  // pre-dispatch failure that can produce widgetClickCount=0, unlike its existing
  // click-sequence fixtures. It is an offline regression, not a live diagnosis.
  const h = await setup(t, { openerMode: 'focus-replace-school' }), before = h.readProof();
  const prepared = h.api.prepare(); assert.equal(prepared.ok, true, JSON.stringify(prepared));
  const result = await h.api.run(await runner.createLivePlan(plain(prepared.identities), 0, true));
  assert.equal(result.ok, true, JSON.stringify({ result, widgetClickCount: h.api.widgetClickCount() }));
  assert.equal(h.probeTiming.focusReplacements, 1);
  assert.deepEqual(h.probeTiming.detachedMouseEvents, [], 'a detached opener receives no mouse events');
  assert.deepEqual(h.probeTiming.replacementMouseEvents, ['mousedown', 'mouseup', 'click']);
  assert.equal(h.probeTiming.instanceClicks, 0); assert.equal(h.api.widgetClickCount(), 8);
  const probes = plain(h.api.widgetProbes());
  assert.equal(probes.length, 7); assert.equal(probes[0].key, 'school');
  assert.ok(probes.every(probe => probe.opened && probe.closed));
  assert.ok(probes.every(probe => probe.openerClicks >= 1), 'each activation is counted before any outside-click cleanup');
  assert.deepEqual(probes[0].activation, { stage: 'complete', reason: null, events: ['mousedown', 'mouseup', 'click'],
    observedEvents: ['mousedown', 'mouseup', 'click'] });
  assert.equal(result.liveSupportClaimed, false); assert.equal(result.restored, true); assert.equal(result.pageLeftAsFound, true);
  assert.deepEqual(h.readProof(), before); assert.equal(h.selects.counts.selections, 0); assert.equal(h.dates.snapshot().selections, 0);
  assert.equal(h.document.querySelectorAll('.ant-select-dropdown,.ant-select-open,.ant-calendar-picker-container').length, 0);
  assert.equal(h.native.sends, 0); assert.equal(h.native.forbidden, 0);
  assert.deepEqual(plain(h.api.clicks()), []); assert.deepEqual(plain(h.api.posts()), []);
  const cleanup = await h.api.cleanup(); assert.equal(cleanup.ok, true, JSON.stringify(cleanup));
  assert.deepEqual(plain(cleanup.widgetProbes), probes, 'cleanup retains bounded activation and overlay diagnostics');
  assert.equal(JSON.stringify({ result, cleanup }).includes('private fictional'), false);
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

test('fake CDP refuses orphaned prior guards before injection or activation and reports reload required', async t => {
  // residual-hooks.json records these exact wrappers with no live API. Do not
  // wrap that contaminated baseline and misreport another widget_open_failed.
  const h = await setup(t), before = h.readProof(), oldApi = h.api;
  const methods = () => [h.window.HTMLElement.prototype.click, h.window.fetch,
    h.window.XMLHttpRequest.prototype.open, h.window.XMLHttpRequest.prototype.send];
  const guarded = methods();
  delete h.window.__cmsEducationLive;
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-education-residual-'));
  t.after(() => {
    const resolved = path.resolve(outDir), parent = path.resolve(os.tmpdir()) + path.sep;
    assert.ok(resolved.startsWith(parent)); fs.rmSync(resolved, { recursive: true, force: true });
  });
  const evidence = await runner.runCmsEducationLive({ controls: true, repoRoot: root, outDir, tipSha: '7e2318f',
    getJson: async () => [{ id: 'residual-offline', type: 'page', url: PAGE,
      webSocketDebuggerUrl: 'ws://127.0.0.1:9239/devtools/page/residual-offline' }],
    connectCdp: async () => ({ close() {}, async send(method, params) {
      if (method !== 'Runtime.evaluate') return {};
      return { result: { value: plain(await h.window.eval(params.expression)) } };
    } })
  });
  assert.equal(evidence.finalDetails.reason, 'stale_live_guard_reload_required');
  assert.equal(evidence.finalDetails.exitCode, 2); assert.equal(evidence.liveSupportClaimed, false);
  assert.equal(evidence.finalDetails.cleanupOk, false, 'the host cannot claim it removed orphaned prior guards');
  assert.equal(evidence.finalDetails.pageLeftAsFound, false);
  assert.ok(evidence.fields.every(field => field.reason === 'stale_live_guard_reload_required'));
  assert.ok(!evidence.finalDetails.steps.some(step => /^inject_|^education_|^cleanup$/u.test(step)));
  assert.deepEqual(evidence.finalDetails.widgetProbes, []); assert.equal(evidence.finalDetails.widgetClickCount, 0);
  assert.deepEqual(evidence.nonGet, []); assert.deepEqual(evidence.saveLikePost, []);
  assert.deepEqual(methods(), guarded); assert.equal(h.window.__cmsEducationLive, undefined);
  assert.deepEqual(h.readProof(), before); assert.equal(h.selects.counts.opens, 0);
  assert.equal(h.native.sends, 0); assert.equal(h.native.forbidden, 0);
  assert.equal((await oldApi.cleanup()).ok, true, 'only the retained original owner can release its known hooks');
  assert.deepEqual(runner.inspectControlsTrialGuards(h.window), { ok: true });
});

test('fake CDP controls host reports exact restored proof and validates separate lookup suppression', async t => {
  let hooks, trialReadbacks;
  const h = await setup(t, { install: false, beforeInstall: ({ window, native }) => {
    native.beacons = 0;
    Object.defineProperty(window.navigator, 'sendBeacon', {
      configurable: true, enumerable: false, writable: false,
      value: () => { native.beacons++; return true; }
    });
    hooks = [
      ['fetch', window, 'fetch'],
      ['click', window.HTMLElement.prototype, 'click'],
      ['submit', window.HTMLFormElement.prototype, 'submit'],
      ['requestSubmit', window.HTMLFormElement.prototype, 'requestSubmit'],
      ...['open', 'send', 'abort'].map(key => [`XHR.${key}`, window.XMLHttpRequest.prototype, key]),
      ...['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'].map(key => [key, window, key]),
      ['sendBeacon', window.navigator, 'sendBeacon']
    ].map(([label, object, key]) => ({ label, object, key, descriptor: Object.getOwnPropertyDescriptor(object, key) }));
  }, onSchoolOpen: ({ xhr }) => {
    xhr(HOUSEKEEPING_LOOKUP); xhr(HOUSEKEEPING_AUTOSAVE);
  } }), before = h.readProof();
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-education-controls-'));
  t.after(() => {
    const resolved = path.resolve(outDir), parent = path.resolve(os.tmpdir()) + path.sep;
    assert.ok(resolved.startsWith(parent)); fs.rmSync(resolved, { recursive: true, force: true });
  });
  const evidence = await runner.runCmsEducationLive({ controls: true, repoRoot: root, outDir, tipSha: runner.BASE_TIP,
    getJson: async () => [{ id: 'controls-offline', type: 'page', url: PAGE,
      webSocketDebuggerUrl: 'ws://127.0.0.1:9239/devtools/page/controls-offline' }],
    connectCdp: async () => ({ close() {}, async send(method, params, options) {
      if (method !== 'Runtime.evaluate') return {};
      const value = plain(await h.window.eval(params.expression));
      if (options.step === 'education_run') trialReadbacks = value.readbacks;
      return { result: { value } };
    } })
  });
  assert.equal(evidence.finalDetails.exitCode, 0, JSON.stringify(evidence));
  assert.equal(evidence.liveSupportClaimed, false); assert.equal(evidence.fields.length, 9);
  const specs = runner.fieldSpecsForRow(0, true);
  assert.deepEqual(evidence.fields, specs.map(spec => ({ q: spec.q, path: spec.path,
    status: 'verified', reason: 'readback_matched', value: spec.fixture })));
  assert.deepEqual(trialReadbacks, specs.map(spec => ({ path: spec.path,
    ok: true, reason: 'readback_matched', value: spec.fixture })));
  const probes = evidence.finalDetails.widgetProbes;
  assert.deepEqual(probes.map(probe => probe.key).sort(), runner.CONTROL_SPECS.map(spec => spec.key).sort());
  for (const probe of probes) {
    assert.equal(probe.openerClicks, 1, probe.key);
    assert.equal(probe.opened, true, probe.key); assert.equal(probe.closed, true, probe.key);
    assert.equal(probe.reason, null, probe.key);
    assert.deepEqual(probe.activation, { stage: 'complete', reason: null,
      events: ['mousedown', 'mouseup', 'click'], observedEvents: ['mousedown', 'mouseup', 'click'] }, probe.key);
  }
  assert.equal(evidence.finalDetails.widgetClickCount, 8); assert.equal(evidence.finalDetails.clickCount, 0);
  assertSettledControlsTimers(evidence.finalDetails.timerSettle);
  assert.ok(evidence.suppressedLookup.length > 0); assert.deepEqual(evidence.nonGet, []); assert.deepEqual(evidence.saveLikePost, []);
  for (const key of ['nonGet', 'saveLikePost']) for (const [label, value] of [
    ['missing', undefined], ['null', null], ['object', {}], ['zero', 0], ['empty string', '']
  ]) {
    const invalid = structuredClone(evidence);
    if (value === undefined) delete invalid[key]; else invalid[key] = value;
    assert.equal(runner.evidenceExitCode(invalid), 2, `${key} ${label} cannot prove empty generic traffic`);
  }
  for (const [label, value] of [
    ['missing', undefined], ['null', null], ['negative', -1], ['fractional', 0.5],
    ['NaN', NaN], ['infinite', Infinity], ['string zero', '0']
  ]) {
    const invalid = structuredClone(evidence);
    if (value === undefined) delete invalid.finalDetails.clickCount; else invalid.finalDetails.clickCount = value;
    assert.notEqual(runner.evidenceExitCode(invalid), 0, `${label} clickCount cannot prove zero forbidden clicks`);
  }
  assert.ok(evidence.suppressedLookup.some(row => row.url === HOUSEKEEPING_LOOKUP), 'host validation preserves the bounded harvested housekeeping query');
  const controlAutosave = evidence.suppressedAutosave.find(row => row.url === HOUSEKEEPING_AUTOSAVE);
  assert.deepEqual(controlAutosave, { method: 'POST', url: HOUSEKEEPING_AUTOSAVE, via: 'xhr',
    blockedBeforeSend: true, phase: 'trial', controlKey: 'school' });
  for (const controlKey of [undefined, 'major', 'academicDegree']) {
    const invalid = structuredClone(evidence);
    invalid.suppressedAutosave.find(row => row.url === HOUSEKEEPING_AUTOSAVE).controlKey = controlKey;
    assert.equal(runner.evidenceExitCode(invalid), 2, 'queried suppression requires an evidenced owned control');
  }
  const invalidAutosave = structuredClone(evidence);
  invalidAutosave.suppressedAutosave.find(row => row.url === HOUSEKEEPING_AUTOSAVE).url += '&private=1';
  assert.equal(runner.evidenceExitCode(invalidAutosave), 2);
  assert.deepEqual(h.readProof(), before); assert.equal(h.native.sends, 0); assert.equal(h.native.forbidden, 0); assert.equal(h.native.beacons, 0);
  for (const { label, object, key, descriptor } of hooks) {
    assert.deepEqual(Object.getOwnPropertyDescriptor(object, key), descriptor, `${label} descriptor is restored after controls cleanup`);
  }
  for (const key of ['__cmsEducationLive', 'ResumeCmsSession', 'installResumeCmsRecordController', 'ResumeCmsEducationMulti',
    'ResumeCmsMultiSchoolSearch', 'ResumeCmsMultiEducationDates', 'ResumeCmsInternshipDates', 'ResumeCmsMultiSelect',
    'ResumeCmsInternshipSelect', 'ResumeCmsMultiRegion', 'ResumeCmsEducationMultiAdapters', 'ResumeCmsEducationMultiWidgetControls']) {
    assert.equal(Object.hasOwn(h.window, key), false, `${key} is removed after controls cleanup`);
  }
  assert.equal(h.document.querySelectorAll('.ant-select-open,.ant-select-dropdown:not(.ant-select-dropdown-hidden),.ant-calendar-picker-container').length, 0);
  const missing = structuredClone(evidence); delete missing.suppressedLookup;
  assert.equal(runner.evidenceExitCode(missing), 2);
  const spoofed = structuredClone(evidence); spoofed.suppressedLookup[0].url += '?private';
  assert.equal(runner.evidenceExitCode(spoofed), 2);
  const spoofedQuery = structuredClone(evidence);
  spoofedQuery.suppressedLookup.find(row => row.url === HOUSEKEEPING_LOOKUP).url += '&private=1';
  assert.equal(runner.evidenceExitCode(spoofedQuery), 2);
  const count = structuredClone(evidence); delete count.finalDetails.widgetClickCount;
  assert.equal(runner.evidenceExitCode(count), 2);
  const noAttempts = structuredClone(evidence); noAttempts.finalDetails.widgetClickCount = 0;
  assert.equal(runner.evidenceExitCode(noAttempts), 2, 'the live zero-click symptom cannot become successful evidence');
  const noProbes = structuredClone(evidence); delete noProbes.finalDetails.widgetProbes;
  assert.equal(runner.evidenceExitCode(noProbes), 2);
  const unopened = structuredClone(evidence); unopened.finalDetails.widgetProbes[0].opened = false;
  assert.equal(runner.evidenceExitCode(unopened), 2, 'a complete activation is not visible owned-overlay proof');
  const noActivation = structuredClone(evidence); noActivation.finalDetails.widgetProbes[0].activation.events = [];
  assert.equal(runner.evidenceExitCode(noActivation), 2, 'probe reports cannot bypass the counted mouse sequence');
  const uncountedOpener = structuredClone(evidence); uncountedOpener.finalDetails.widgetProbes[0].openerClicks = 0;
  assert.equal(runner.evidenceExitCode(uncountedOpener), 2, 'other opener and outside cleanup clicks cannot excuse an uncounted activation');
  const duplicateOpener = structuredClone(evidence); duplicateOpener.finalDetails.widgetProbes[0].openerClicks = 2;
  assert.equal(runner.evidenceExitCode(duplicateOpener), 2, 'one probe authorizes exactly one opener activation');
  const noReceipt = structuredClone(evidence); delete noReceipt.finalDetails.widgetProbes[0].activation.observedEvents;
  assert.equal(runner.evidenceExitCode(noReceipt), 2, 'attempted event names alone cannot prove DOM delivery');
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

// REAL_USE_CMS_EDU_CONTROLS1_d22734a9_CLEAN_2026-10-23.md and
// live-clean-nonget-d22734a9/cms-education-live.controls1.json show a clean
// counted school open/close followed by fuzzyMatchDic generic nonGet with no
// lookup suppression. harvest/harvest-summary.json networkPassive preserves
// its three housekeeping parameters; note()/redactUrl removes queries from the
// failure JSON. Fictional adapter callbacks below emit that captured URL after
// probe close while school remains active. No absent site handler is invented.
function lookupAfterSchoolProbe(h, afterSchool) {
  const adapters = h.window.ResumeCmsEducationMultiAdapters;
  h.window.ResumeCmsEducationMultiAdapters = Object.freeze({ ...adapters,
    school: async (...args) => {
      const result = await adapters.school(...args);
      afterSchool();
      return result;
    }
  });
}

function assertClosedSchoolProbe(h) {
  const probe = plain(h.api.widgetProbes())[0];
  assert.equal(probe.key, 'school'); assert.equal(probe.openerClicks, 1);
  assert.equal(probe.activation.stage, 'complete');
  assert.equal(probe.opened, true); assert.equal(probe.closed, true);
  assert.equal(probe.reason, null);
}

function assertLookupNeverSave(h, before, result) {
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(h.native.sends, 0); assert.equal(h.native.fetches, 1, 'only the required session GET reaches fixture fetch');
  assert.equal(h.native.forbidden, 0);
  assert.equal(h.window.fixtureCounts.saves, 0); assert.equal(h.window.fixtureCounts.submits, 0);
  assert.equal(h.selects.counts.selections, 0); assert.equal(h.dates.snapshot().selections, 0);
  assert.deepEqual(plain(h.api.clicks()), []);
  assert.deepEqual(h.readProof(), before);
}

test('school lookup classifier accepts only the harvested housekeeping query shape', () => {
  for (const url of [HOUSEKEEPING_LOOKUP, `${LOOKUP}?t=1792759070926&request_locale=zh_CN&iSaJAx=isAjax`,
    '/wecruit/dic/fuzzyMatchDic?request_locale=zh_CN&iSaJAx=isAjax&t=1792759070926']) {
    assert.equal(runner.isSchoolLookup({ method: 'POST', url }), true, url);
  }
  for (const query of [
    'iSaJAx=isAjax&request_locale=zh_CN', 'iSaJAx=isAjax&t=1792759070926', 'request_locale=zh_CN&t=1792759070926',
    'iSaJAx=isAjax&request_locale=zh_CN&t=1792759070926&t=1792759070926',
    'iSaJAx=isAjax&request_locale=zh_CN&t=1792759070926&private=1',
    'iSaJAx=wrong&request_locale=zh_CN&t=1792759070926', 'iSaJAx=isAjax&request_locale=en_US&t=1792759070926',
    'iSaJAx=isAjax&request_locale=zh_CN&t=179275907092', 'iSaJAx=isAjax&request_locale=zh_CN&t=17927590709260',
    'iSaJAx=isAjax&request_locale=zh_CN&t=179275907092x'
  ]) assert.equal(runner.isSchoolLookup({ method: 'POST', url: `${LOOKUP}?${query}` }), false, query);
  for (const method of ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']) {
    assert.equal(runner.isSchoolLookup({ method, url: HOUSEKEEPING_LOOKUP }), false, method);
  }
  for (const url of [`${HOUSEKEEPING_LOOKUP}#private`, HOUSEKEEPING_LOOKUP.replace('https://', 'https://user:secret@'),
    HOUSEKEEPING_LOOKUP.replace('hotjob.cn', 'hotjob.cn.evil.invalid')]) {
    assert.equal(runner.isSchoolLookup({ method: 'POST', url }), false, url);
  }
});

test('historical queryless classifier reproduces CLEAN counted school open/close followed by generic nonGet', async t => {
  // In-memory comparison to the pre-R3 no-query classifier; installed source,
  // adapters, DOM, and all transport guards otherwise remain current.
  function querylessSchoolLookup(request, page) {
    if (String(request?.method ?? '').toUpperCase() !== 'POST' || typeof request?.url !== 'string') return false;
    try {
      const baseline = new URL(page), url = new URL(request.url, baseline);
      return url.origin === baseline.origin && !url.username && !url.password && !url.search && !url.hash
        && url.pathname === '/wecruit/dic/fuzzyMatchDic';
    } catch { return false; }
  }
  const h = await setup(t, { lookupClassifier: querylessSchoolLookup, schoolLookup: () => {} });
  const before = h.readProof(), prepared = h.api.prepare(); assert.equal(prepared.ok, true);
  lookupAfterSchoolProbe(h, () => h.xhr(HOUSEKEEPING_LOOKUP));
  const result = await h.api.run(await runner.createLivePlan(plain(prepared.identities), 0, true));
  assertClosedSchoolProbe(h);
  assert.equal(h.api.widgetClickCount(), 1); assert.equal(h.api.widgetProbes().length, 1);
  assert.equal(result.ok, false); assert.equal(result.reason, 'non_get_request');
  assert.deepEqual(plain(h.api.posts()), [{ method: 'POST', url: LOOKUP, via: 'xhr' }], 'the generic failure log redacts the original query');
  assert.deepEqual(plain(h.api.suppressedLookup()), []);
  assertLookupNeverSave(h, before, result);
  assert.equal(result.restored, true); assert.equal(result.pageLeftAsFound, true);
  assert.equal((await h.api.cleanup()).ok, true);
});

for (const timing of ['before-install', 'before-arm', 'armed-outside-school', 'sent-after-school']) {
  test(`queried lookup opened ${timing} remains generic nonGet despite successful school open/close`, async t => {
    let request;
    const openLookup = window => { request = new window.XMLHttpRequest(); request.open('POST', HOUSEKEEPING_LOOKUP); };
    const h = await setup(t, { schoolLookup: ({ window }) => {
      if (timing === 'sent-after-school') openLookup(window);
    }, beforeInstall: ({ window }) => {
      if (timing === 'before-install') openLookup(window);
    } });
    if (timing === 'before-arm') openLookup(h.window);
    const before = h.readProof(), prepared = h.api.prepare(); assert.equal(prepared.ok, true);
    if (timing === 'armed-outside-school') {
      const controller = h.window.ResumeCmsEducationMulti;
      h.window.ResumeCmsEducationMulti = Object.freeze({ ...controller, run(...args) {
        openLookup(h.window);
        return controller.run(...args);
      } });
    }
    if (timing === 'sent-after-school') {
      const controller = h.window.ResumeCmsEducationMulti;
      h.window.ResumeCmsEducationMulti = Object.freeze({ ...controller, run(plan, services) {
        return controller.run(plan, { ...services, adapters: { ...services.adapters, school: async (...args) => {
          const result = await services.adapters.school(...args);
          // Outside widgetAdapter's finally: the current school gate is gone.
          request.send('private-late-lookup-body');
          return result;
        } } });
      } });
    } else lookupAfterSchoolProbe(h, () => request.send('private-unarmed-lookup-body'));
    const result = await h.api.run(await runner.createLivePlan(plain(prepared.identities), 0, true));
    assertClosedSchoolProbe(h);
    assert.equal(result.ok, false); assert.equal(result.reason, 'non_get_request');
    assert.equal(h.api.posts().length, 1); assert.deepEqual(plain(h.api.suppressedLookup()), []);
    assertLookupNeverSave(h, before, result);
    assert.equal(result.restored, true); assert.equal(result.pageLeftAsFound, true);
    assert.equal((await h.api.cleanup()).ok, true);
  });
}

test('queried lookup after school probe uses captured native abort and preserves exact suppression evidence', async t => {
  let request, overrideCalls = 0;
  const aborted = [];
  const h = await setup(t, {
    beforeInstall: ({ window }) => {
      const abort = window.XMLHttpRequest.prototype.abort;
      window.XMLHttpRequest.prototype.abort = function () { aborted.push(this); return abort.call(this); };
    },
    schoolLookup: () => {}
  });
  const before = h.readProof(), prepared = h.api.prepare(); assert.equal(prepared.ok, true);
  lookupAfterSchoolProbe(h, () => {
    request = new h.window.XMLHttpRequest(); request.open('POST', HOUSEKEEPING_LOOKUP);
    request.abort = () => { overrideCalls++; };
    request.send('private-lookup-body');
  });
  const result = await h.api.run(await runner.createLivePlan(plain(prepared.identities), 0, true));
  assert.equal(result.ok, true, JSON.stringify(result)); assertClosedSchoolProbe(h);
  assert.equal(overrideCalls, 0); assert.equal(aborted.filter(item => item === request).length, 1);
  assert.deepEqual(plain(h.api.suppressedLookup()), [
    { method: 'POST', url: HOUSEKEEPING_LOOKUP, via: 'xhr', blockedBeforeSend: true, phase: 'trial' }
  ]);
  assert.deepEqual(plain(h.api.posts()), []);
  assert.equal(result.restored, true); assert.equal(result.pageLeftAsFound, true);
  assertLookupNeverSave(h, before, result);
  assert.equal((await h.api.cleanup()).ok, true);
});

test('queried lookup captured native abort failure is fatal and never reaches native send', async t => {
  let request, lookupAborts = 0, caught;
  const h = await setup(t, { schoolLookup: () => {}, beforeInstall: ({ window }) => {
    const abort = window.XMLHttpRequest.prototype.abort;
    window.XMLHttpRequest.prototype.abort = function () {
      if (this === request) { lookupAborts++; throw new Error('fixture_native_abort_failed'); }
      return abort.call(this);
    };
  } });
  const before = h.readProof(), prepared = h.api.prepare(); assert.equal(prepared.ok, true);
  lookupAfterSchoolProbe(h, () => {
    request = new h.window.XMLHttpRequest(); request.open('POST', HOUSEKEEPING_LOOKUP);
    try { request.send('private-lookup-body'); } catch (error) { caught = error; }
  });
  const result = await h.api.run(await runner.createLivePlan(plain(prepared.identities), 0, true));
  assertClosedSchoolProbe(h);
  assert.equal(lookupAborts, 1); assert.equal(caught?.message, 'fixture_native_abort_failed');
  assert.equal(result.ok, false); assert.equal(result.reason, 'non_get_request');
  assert.deepEqual(plain(h.api.suppressedLookup()), []);
  assert.deepEqual(plain(h.api.posts()), [{ method: 'POST', url: LOOKUP, via: 'xhr' }]);
  assertLookupNeverSave(h, before, result);
  assert.equal((await h.api.cleanup()).ok, true);
});

// R4 evidence: harvest-summary.json networkPassive records this exact queried
// info/edit URL as XHR; isolated-open-summary.json repeats it with label 学历.
// The isolated menu did not open and its per-field network slice is empty.
// These fictional callbacks test ownership boundaries, not live event timing.
function controlSurface(h, key) {
  const spec = runner.CONTROL_SPECS.find(spec => spec.key === key);
  return h.document.getElementById(`14_${spec.wrapper}_0`)
    .querySelector(spec.kind === 'date' ? 'input.ant-calendar-picker-input' : '.ant-select-selection');
}

function afterDegreeProbe(h, callback) {
  const adapters = h.window.ResumeCmsEducationMultiAdapters;
  h.window.ResumeCmsEducationMultiAdapters = Object.freeze({ ...adapters, select: async (...args) => {
    const result = await adapters.select(...args);
    if (args[2].key === 'degree') callback();
    return result;
  } });
}

test('control autosave classifier accepts only the separately harvested two-parameter endpoint', () => {
  for (const url of [HOUSEKEEPING_AUTOSAVE, `${AUTOSAVE}?request_locale=zh_CN&iSaJAx=isAjax`,
    '/wecruit/resume/info/edit/SU629dbc0c0dcad452299bc0f7?iSaJAx=isAjax&request_locale=zh_CN']) {
    assert.equal(runner.isEducationControlAutosave({ method: 'POST', url }), true, url);
    assert.equal(runner.isEducationAutosave({ method: 'POST', url }), false, 'default text classifier stays queryless');
  }
  for (const query of ['', 'iSaJAx=isAjax', 'request_locale=zh_CN',
    'iSaJAx=isAjax&request_locale=zh_CN&iSaJAx=isAjax', 'iSaJAx=isAjax&request_locale=zh_CN&private=1',
    'iSaJAx=isAjax&request_locale=zh_CN&t=1792759070926',
    'iSaJAx=wrong&request_locale=zh_CN', 'iSaJAx=isAjax&request_locale=en_US']) {
    assert.equal(runner.isEducationControlAutosave({ method: 'POST', url: `${AUTOSAVE}?${query}` }), false, query);
  }
  for (const url of [HOUSEKEEPING_AUTOSAVE.replace('SU629dbc0c0dcad452299bc0f7', 'other-tenant'),
    HOUSEKEEPING_AUTOSAVE.replace('https:', 'http:'), HOUSEKEEPING_AUTOSAVE.replace('hotjob.cn', 'fixture.invalid'),
    HOUSEKEEPING_AUTOSAVE.replace('https://', 'https://user:secret@'), `${HOUSEKEEPING_AUTOSAVE}#private`,
    HOUSEKEEPING_AUTOSAVE.replace('/info/edit/', '/info/delete/')]) {
    assert.equal(runner.isEducationControlAutosave({ method: 'POST', url }), false, url);
  }
  for (const method of ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE', '']) {
    assert.equal(runner.isEducationControlAutosave({ method, url: HOUSEKEEPING_AUTOSAVE }), false, method);
  }
});

test('tip queryless behavior reproduces a fatal queried autosave during degree activity', async t => {
  const h = await setup(t, { controlAutosaveClassifier: () => false }), before = h.readProof();
  controlSurface(h, 'degree').addEventListener('click', () => h.xhr(HOUSEKEEPING_AUTOSAVE), { once: true });
  const prepared = h.api.prepare(); assert.equal(prepared.ok, true);
  const result = await h.api.run(await runner.createLivePlan(plain(prepared.identities), 0, true));
  assertClosedSchoolProbe(h);
  assert.equal(result.ok, false); assert.equal(result.reason, 'non_get_request');
  assert.deepEqual(plain(h.api.posts()), [{ method: 'POST', url: AUTOSAVE, via: 'xhr' }]);
  assert.ok(h.api.suppressedAutosave().every(row => row.url !== HOUSEKEEPING_AUTOSAVE));
  assertLookupNeverSave(h, before, result);
  assert.equal(result.restored, true); assert.equal((await h.api.cleanup()).ok, true);
});

for (const key of ['school', 'degree']) test(`owned ${key} queried autosave aborts before send with exact evidence and restoration`, async t => {
  let request, overrideCalls = 0;
  const aborted = [];
  const h = await setup(t, { beforeInstall: ({ window }) => {
    const abort = window.XMLHttpRequest.prototype.abort;
    window.XMLHttpRequest.prototype.abort = function () { aborted.push(this); return abort.call(this); };
  } }), before = h.readProof();
  controlSurface(h, key).addEventListener('click', () => {
    request = new h.window.XMLHttpRequest(); request.open('POST', HOUSEKEEPING_AUTOSAVE);
    request.abort = () => overrideCalls++;
    request.send('private-control-autosave-body');
  }, { once: true });
  const prepared = h.api.prepare(); assert.equal(prepared.ok, true);
  const result = await h.api.run(await runner.createLivePlan(plain(prepared.identities), 0, true));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(overrideCalls, 0); assert.equal(aborted.filter(item => item === request).length, 1);
  assert.deepEqual(plain(h.api.suppressedAutosave()).filter(row => row.url === HOUSEKEEPING_AUTOSAVE), [
    { method: 'POST', url: HOUSEKEEPING_AUTOSAVE, via: 'xhr', blockedBeforeSend: true, phase: 'trial', controlKey: key }
  ]);
  assert.deepEqual(plain(h.api.posts()), []); assertLookupNeverSave(h, before, result);
  assert.equal(result.restored, true); assert.equal(result.pageLeftAsFound, true);
  assert.equal((await h.api.cleanup()).ok, true);
  assert.equal(JSON.stringify(result).includes('private-control-autosave-body'), false);
});

for (const timing of ['before-install', 'before-arm', 'armed-outside-control', 'different-control', 'sent-after-control']) {
  test(`queried autosave ${timing} remains fatal despite a matching endpoint`, async t => {
    let request;
    const open = window => { request = new window.XMLHttpRequest(); request.open('POST', HOUSEKEEPING_AUTOSAVE); };
    const h = await setup(t, { beforeInstall: ({ window }) => { if (timing === 'before-install') open(window); } });
    if (timing === 'before-arm') open(h.window);
    if (timing === 'different-control') controlSurface(h, 'school').addEventListener('click', () => open(h.window), { once: true });
    if (timing === 'sent-after-control') controlSurface(h, 'degree').addEventListener('click', () => open(h.window), { once: true });
    const before = h.readProof(), prepared = h.api.prepare(); assert.equal(prepared.ok, true);
    if (timing === 'armed-outside-control' || timing === 'sent-after-control') {
      const controller = h.window.ResumeCmsEducationMulti;
      h.window.ResumeCmsEducationMulti = Object.freeze({ ...controller, run(plan, services) {
        if (timing === 'armed-outside-control') open(h.window);
        return controller.run(plan, { ...services, adapters: { ...services.adapters, select: async (...args) => {
          const result = await services.adapters.select(...args);
          if (timing === 'sent-after-control' && args[2].key === 'degree') request.send('private-late-autosave-body');
          return result;
        } } });
      } });
    }
    if (timing !== 'sent-after-control') afterDegreeProbe(h, () => request.send('private-unowned-autosave-body'));
    const result = await h.api.run(await runner.createLivePlan(plain(prepared.identities), 0, true));
    assertClosedSchoolProbe(h);
    assert.equal(result.ok, false); assert.equal(result.reason, 'non_get_request');
    assert.ok(h.api.suppressedAutosave().every(row => row.url !== HOUSEKEEPING_AUTOSAVE));
    assert.deepEqual(plain(h.api.posts()), [timing === 'before-install'
      ? { method: 'UNKNOWN', url: 'https://wecruit.hotjob.cn/', via: 'xhr' }
      : { method: 'POST', url: AUTOSAVE, via: 'xhr' }]);
    assertLookupNeverSave(h, before, result); assert.equal(result.restored, true);
    assert.equal((await h.api.cleanup()).ok, true);
  });
}

test('queried autosave is not authorized by other captured control kinds or text mode', async t => {
  for (const key of ['academicDegree', 'startDate', 'endDate', 'region', 'gradeRank', 'major']) {
    const h = await setup(t, { install: key !== 'major' }), before = h.readProof();
    if (key === 'major') {
      h.window.eval(runner.buildPageExpression(root));
      for (const file of runner.LIVE_FILES) h.window.eval(fs.readFileSync(path.join(root, file), 'utf8'));
      h.api = h.window.__cmsEducationLive;
      h.textInputs.major.addEventListener('input', () => h.xhr(HOUSEKEEPING_AUTOSAVE), { once: true });
    } else controlSurface(h, key).addEventListener('click', () => h.xhr(HOUSEKEEPING_AUTOSAVE), { once: true });
    const prepared = h.api.prepare(); assert.equal(prepared.ok, true, key);
    const result = await h.api.run(await runner.createLivePlan(plain(prepared.identities), 0, key !== 'major'));
    assert.equal(result.ok, false, key); assert.equal(result.reason, 'non_get_request', key);
    assert.ok(h.api.suppressedAutosave().every(row => row.url !== HOUSEKEEPING_AUTOSAVE), key);
    assertLookupNeverSave(h, before, result); assert.equal(result.restored, true, key);
    assert.equal((await h.api.cleanup()).ok, true, key);
  }
});

test('owned queried autosave native abort failure retains guards and cannot report success', async t => {
  let request, aborts = 0;
  const h = await setup(t, { beforeInstall: ({ window }) => {
    const abort = window.XMLHttpRequest.prototype.abort;
    window.XMLHttpRequest.prototype.abort = function () {
      if (this === request) { aborts++; throw new Error('fixture_native_abort_failed'); }
      return abort.call(this);
    };
  } }), before = h.readProof();
  controlSurface(h, 'degree').addEventListener('click', () => {
    request = new h.window.XMLHttpRequest(); request.open('POST', HOUSEKEEPING_AUTOSAVE); request.send('private-abort-body');
  }, { once: true });
  const prepared = h.api.prepare(); assert.equal(prepared.ok, true);
  const result = await h.api.run(await runner.createLivePlan(plain(prepared.identities), 0, true));
  assert.equal(result.ok, false); assert.equal(result.reason, 'autosave_abort_failed');
  assert.equal(aborts, 1);
  assert.deepEqual(plain(h.api.suppressedAutosave()).filter(row => row.url === HOUSEKEEPING_AUTOSAVE), [
    { method: 'POST', url: HOUSEKEEPING_AUTOSAVE, via: 'xhr', blockedBeforeSend: true, phase: 'trial', controlKey: 'degree', abortFailed: true }
  ]);
  assertLookupNeverSave(h, before, result);
  const cleanup = await h.api.cleanup(); assert.equal(cleanup.ok, false);
  assert.equal(h.window.__cmsEducationLive, h.api, 'failed abort retains the owned page guards');
  assert.equal(h.native.sends, 0);
});

test('trial-opened queried autosave cannot gain authorization in a later restore invocation of the same control', async t => {
  let request, restoreSends = 0;
  const h = await setup(t), before = h.readProof(), degree = controlSurface(h, 'degree');
  degree.addEventListener('click', () => {
    request = new h.window.XMLHttpRequest(); request.open('POST', HOUSEKEEPING_AUTOSAVE);
  }, { once: true });
  degree.addEventListener('keydown', event => {
    if (event.key === 'Escape' && request) { restoreSends++; request.send('private-prior-invocation-body'); }
  }, { once: true });
  const controls = h.window.ResumeCmsEducationMultiWidgetControls;
  h.window.ResumeCmsEducationMultiWidgetControls = Object.freeze({ ...controls, activateSurface(surface, ...args) {
    const activated = controls.activateSurface(surface, ...args);
    // Leave this test's owned menu open so the trial must enter restore-close.
    if (surface === degree && activated) throw new Error('fixture_stop_after_degree_open');
    return activated;
  } });
  const prepared = h.api.prepare(); assert.equal(prepared.ok, true);
  const result = await h.api.run(await runner.createLivePlan(plain(prepared.identities), 0, true));
  assert.equal(restoreSends, 1); assert.equal(result.ok, false); assert.equal(result.reason, 'non_get_request');
  assert.ok(h.api.suppressedAutosave().every(row => row.url !== HOUSEKEEPING_AUTOSAVE));
  assert.deepEqual(plain(h.api.posts()), [{ method: 'POST', url: AUTOSAVE, via: 'xhr' }]);
  assertLookupNeverSave(h, before, result); assert.equal(result.restored, true);
  assert.equal((await h.api.cleanup()).ok, true);
});

for (const via of ['fetch', 'beacon']) test(`matching queried autosave via ${via} remains fatal during owned degree activity`, async t => {
  const h = await setup(t, { beforeInstall: ({ window }) => { window.navigator.sendBeacon = () => { throw new Error('native_beacon_called'); }; } });
  const before = h.readProof();
  afterDegreeProbe(h, () => {
    if (via === 'fetch') h.window.fetch(HOUSEKEEPING_AUTOSAVE, { method: 'POST', body: 'private-fetch-body' }).catch(() => {});
    else h.window.navigator.sendBeacon(HOUSEKEEPING_AUTOSAVE, 'private-beacon-body');
  });
  const prepared = h.api.prepare(); assert.equal(prepared.ok, true);
  const result = await h.api.run(await runner.createLivePlan(plain(prepared.identities), 0, true));
  assert.equal(result.ok, false); assert.equal(result.reason, 'non_get_request');
  assert.deepEqual(plain(h.api.posts()), [{ method: 'POST', url: AUTOSAVE, via }]);
  assertLookupNeverSave(h, before, result); assert.equal(result.restored, true);
  assert.equal((await h.api.cleanup()).ok, true);
});

test('fake CDP-observed queried autosave remains fatal even alongside a valid page suppression', async t => {
  let emit;
  const h = await setup(t, { install: false }), before = h.readProof(), blocked = [];
  controlSurface(h, 'degree').addEventListener('click', () => {
    h.xhr(HOUSEKEEPING_AUTOSAVE);
    emit({ method: 'Fetch.requestPaused', params: { requestId: 'escaped-offline-request',
      request: { method: 'POST', url: HOUSEKEEPING_AUTOSAVE } } });
  }, { once: true });
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-education-control-autosave-'));
  t.after(() => {
    assert.ok(path.resolve(outDir).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(outDir, { recursive: true, force: true });
  });
  const evidence = await runner.runCmsEducationLive({ controls: true, repoRoot: root, outDir, tipSha: runner.BASE_TIP,
    getJson: async () => [{ id: 'control-autosave-offline', type: 'page', url: PAGE,
      webSocketDebuggerUrl: 'ws://127.0.0.1:9239/devtools/page/control-autosave-offline' }],
    connectCdp: async (_url, options) => {
      emit = options.onEvent;
      return { close() {}, async send(method, params) {
        if (method === 'Fetch.failRequest') blocked.push(params.requestId);
        if (method !== 'Runtime.evaluate') return {};
        return { result: { value: plain(await h.window.eval(params.expression)) } };
      } };
    }
  });
  assert.equal(evidence.finalDetails.exitCode, 3); assert.equal(evidence.finalDetails.reason, 'non_get_request');
  assert.deepEqual(blocked, ['escaped-offline-request']);
  assert.ok(evidence.suppressedAutosave.some(row => row.url === HOUSEKEEPING_AUTOSAVE && row.controlKey === 'degree'));
  assert.equal(evidence.nonGet.length, 1); assert.equal(evidence.liveSupportClaimed, false);
  assert.deepEqual(h.readProof(), before); assert.equal(h.native.sends, 0); assert.equal(h.native.forbidden, 0);
});
