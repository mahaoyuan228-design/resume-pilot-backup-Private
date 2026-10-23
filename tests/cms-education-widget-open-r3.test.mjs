/**
 * Offline regressions for the d22734a9 Never-Save failure. Supplied evidence:
 * cms-edu-widget-open-r3-materials/live/evidence-summary-extract.json reports
 * complete mousedown/mouseup/click, openerClicks=0, widgetClickCount=0, and no
 * owned open overlay. The handlers below are deliberately fictional models of
 * those observable boundaries; the evidence does not identify the site's cause.
 * DOM uses the existing captured select/date fixture prefixes. No CDP, HTTP,
 * extra opener selector, applicant data, or live support is represented here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { integrationFixture } from './fixtures/cms-education-fixture.mjs';
import { mountHarvestSelectFixture } from './fixtures/cms-education-harvest-selects.mjs';
import { installHarvestedDates } from './fixtures/cms-education-harvest-dates.mjs';
import { readCmsEducationSerialization } from '../src/content/cms-education-serialization.mjs';
import * as runner from '../scripts/live/cms-education-live.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';
const plain = value => JSON.parse(JSON.stringify(value));
let fixture = await integrationFixture({ schools: ['悉尼大学'], regions: [{ province: '北京市', city: '北京市' }] });
for (const [before, after] of [
  ['commit(rowIndex,248,', 'commit(rowIndex,51,'],
  ['commit(rowIndex,51513929,', 'commit(rowIndex,52,'],
  ["oldItemId:248,name:'学校'", "oldItemId:51,name:'学校'"],
  ["oldItemId:51513929,name:'城市'", "oldItemId:52,name:'城市'"],
  ["oldItemId:52,name:'学位'", "oldItemId:248,name:'学位'"],
  ["oldItemId:51,name:'学历'", "oldItemId:53,name:'学历'"],
  ["oldItemId:53,name:'专业名称'", "oldItemId:51513929,name:'专业名称'"]
]) {
  assert.ok(fixture.includes(before), before);
  fixture = fixture.replaceAll(before, after);
}

async function setup(t, { beforeInstall = () => {}, onSchoolOpen = () => {}, historicalHelper = false } = {}) {
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
      if (node.style.display === 'none' || node.style.visibility === 'hidden') return [];
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
  const native = { sends: 0, forbidden: 0 };
  window.fetch = async () => ({ ok: true, json: async () => ({ state: 200 }) });
  window.XMLHttpRequest.prototype.send = function () { native.sends++; };
  const commit = (id, value) => { window.fixtureProps.formData[`14_${id}_1`] = value; };
  const selects = mountHarvestSelectFixture(window, { scaffold: false,
    onCommit: ({ wrapperId, text }) => commit(wrapperId.split('_')[1], text) });
  for (const [id, text] of Object.entries({ 51: '悉尼大学', 53: '本科', 248: '学士', 102301: '无排名' })) {
    const selected = document.getElementById(`14_${id}_0`).querySelector('.ant-select-selection-selected-value');
    selected.textContent = text; selected.title = text;
    const meta = window.fixtureProps.infoData[0].find(field => String(field.oldItemId) === id);
    meta.dataSourceMap = Object.fromEntries(['本科', '硕士研究生', '学士', '硕士', '前10%', '无排名'].map(value => [value, value]));
    commit(id, id === '51' ? { code: 'school-public-catalog-code', name: text } : text);
  }
  const school = document.getElementById('14_51_0').querySelector('.ant-select-selection');
  school.addEventListener('click', () => {
    for (const option of document.querySelectorAll('.ant-select-dropdown-menu-item[role="option"]')) option.textContent = '悉尼大学';
    onSchoolOpen({ window, document, school });
  });
  const dates = installHarvestedDates(window, { initial: { startDate: '2023-02-01', endDate: '2024-11-01' },
    onCommit: (key, value) => commit(key === 'startDate' ? '49' : '50', value) });
  commit('49', '2023-02-01'); commit('50', '2024-11-01');
  // Existing synthetic region scaffold; no second-level harvest is asserted.
  window.fixtureWidgets.regions[0].setExisting('北京市', '北京市');
  commit('52', 'city-0');
  for (const [id, value] of [['51513929', '  fictional original major  '], ['55', '\nfictional original description\n']]) {
    const input = document.getElementById(`14_${id}_0`).querySelector('input,textarea');
    input.value = value; input.dispatchEvent(new window.Event('input', { bubbles: true }));
  }
  for (const label of ['Save', 'Submit', 'Next', 'Deliver', 'Delete']) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
    button.addEventListener('click', () => native.forbidden++); document.querySelector('form').append(button);
  }
  beforeInstall({ window, document, school });
  assert.equal(window.eval(runner.buildPageExpression(root, 0, true)).ok, true);
  for (const file of [...runner.LIVE_FILES, ...runner.CONTROL_FILES]) window.eval(fs.readFileSync(path.join(root, file), 'utf8'));
  if (historicalHelper) window.eval(fs.readFileSync(path.join(root, 'tests/cms-education-widget-open-r3-base-helper.js'), 'utf8'));
  const api = window.__cmsEducationLive;
  const readProof = () => plain(window.eval(`(${readCmsEducationSerialization.toString()})()`));
  const before = readProof(), prepared = api.prepare();
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  const run = () => runner.createLivePlan(plain(prepared.identities), 0, true).then(plan => api.run(plan));
  return { window, document, school, selects, dates, native, api, before, readProof, run };
}

function assertNeverSave(h) {
  assert.equal(h.native.sends, 0);
  assert.equal(h.native.forbidden, 0);
  assert.equal(h.window.fixtureCounts.saves, 0);
  assert.equal(h.window.fixtureCounts.submits, 0);
  assert.equal(h.selects.counts.selections, 0);
  assert.equal(h.dates.snapshot().selections, 0);
  assert.deepEqual(plain(h.api.posts()), []);
  assert.deepEqual(plain(h.api.clicks()), []);
  assert.deepEqual(h.readProof(), h.before);
}

function interceptInstanceDispatch({ window, document }) {
  const intercepted = [];
  const observed = [];
  // Synthetic instance interception models a full attempted sequence that
  // never reaches document capture. It is one falsifiable explanation for the
  // supplied signature, not a claim about the private site's implementation.
  for (const surface of document.querySelectorAll('.form-cell[id="14"] .ant-select-selection[role="combobox"],.form-cell[id="14"] input.ant-calendar-picker-input[readonly]')) {
    surface.dispatchEvent = event => { intercepted.push(event.type); return true; };
    for (const type of ['mousedown', 'mouseup', 'click']) surface.addEventListener(type, event => {
      observed.push({ wrapper: surface.closest('[id^="14_"]').id, type: event.type });
    }, true);
  }
  return { intercepted, observed };
}

test('immutable #177 helper reproduces complete mouse attempts with no opener receipt and no owned overlay', async t => {
  let delivery;
  const h = await setup(t, { historicalHelper: true,
    beforeInstall: context => { delivery = interceptInstanceDispatch(context); } });
  const result = await h.run();
  assert.equal(result.ok, false); assert.equal(result.reason, 'widget_open_failed');
  assert.deepEqual(delivery.intercepted, ['mousedown', 'mouseup', 'click']);
  assert.deepEqual(delivery.observed, []);
  const probe = plain(h.api.widgetProbes())[0];
  assert.equal(probe.activation.stage, 'complete');
  assert.deepEqual(probe.activation.events, ['mousedown', 'mouseup', 'click']);
  assert.equal(probe.openerClicks, 0); assert.equal(h.api.widgetClickCount(), 0);
  assert.equal(probe.opened, false); assert.equal(probe.closed, false);
  assert.equal(result.liveSupportClaimed, false); assert.equal(result.pageLeftAsFound, true);
  assertNeverSave(h);
  assert.equal((await h.api.cleanup()).ok, true);
});

test('R3 delivers and counts each harvested opener despite inert instance dispatchEvent and closes all seven owned overlays', async t => {
  let delivery;
  const h = await setup(t, { beforeInstall: context => { delivery = interceptInstanceDispatch(context); } });
  const result = await h.run();
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.liveSupportClaimed, false); assert.equal(result.restored, true);
  assert.equal(result.pageLeftAsFound, true);
  assert.deepEqual(delivery.intercepted, [], 'native dispatch bypasses the fictional inert instance override');
  const probes = plain(h.api.widgetProbes());
  assert.equal(probes.length, 7);
  assert.ok(probes.every(probe => probe.activation.stage === 'complete' && probe.openerClicks === 1 && probe.opened && probe.closed));
  assert.ok(probes.every(probe => probe.activation.events.join(',') === 'mousedown,mouseup,click'
    && probe.activation.observedEvents.join(',') === 'mousedown,mouseup,click'));
  const wrappers = [...new Set(delivery.observed.map(event => event.wrapper))].sort();
  assert.deepEqual(wrappers, ['14_51_0', '14_53_0', '14_248_0', '14_49_0', '14_50_0', '14_52_0', '14_102301_0'].sort());
  for (const wrapper of wrappers) assert.deepEqual(delivery.observed.filter(event => event.wrapper === wrapper).map(event => event.type), ['mousedown', 'mouseup', 'click']);
  assert.equal(h.api.widgetClickCount(), 8, 'seven distinct opener receipts plus the existing province outside cleanup');
  assertNeverSave(h);
  assert.equal(h.document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden),.ant-select-open,.ant-calendar-picker-container').length, 0);
  assert.equal((await h.api.cleanup()).ok, true);
});

test('a preexisting capture stop cannot manufacture a counted activation or retry an unobserved click', async t => {
  const intercepted = [];
  const h = await setup(t, { beforeInstall: ({ window, school }) => {
    // A capture listener installed before the trial is a second fictional
    // delivery boundary. Native dispatch cannot override its propagation stop.
    window.addEventListener('click', event => {
      if (event.target !== school) return;
      intercepted.push(event.type); event.stopImmediatePropagation();
    }, true);
  } });
  const result = await h.run();
  assert.equal(result.ok, false); assert.equal(result.reason, 'widget_open_failed');
  assert.deepEqual(intercepted, ['click'], 'an unobserved activation is not retried');
  const probe = plain(h.api.widgetProbes())[0];
  assert.notEqual(probe.activation.stage, 'complete');
  assert.equal(probe.activation.reason, 'event_not_observed');
  assert.deepEqual(probe.activation.events, ['mousedown', 'mouseup', 'click']);
  assert.deepEqual(probe.activation.observedEvents, ['mousedown', 'mouseup']);
  assert.equal(probe.openerClicks, 0); assert.equal(h.api.widgetClickCount(), 0);
  assert.equal(probe.opened, false); assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.pageLeftAsFound, true);
  assertNeverSave(h);
  assert.equal((await h.api.cleanup()).ok, true);
});

for (const [target, attempts, expectedOpenerClicks] of [['body', 1, 0], ['opener', 2, 2]]) {
  test(`claimed complete activation with ${attempts} ${target} click(s) cannot pass exact opener accounting`, async t => {
    const h = await setup(t);
    h.window.ResumeCmsEducationMultiWidgetControls = Object.freeze({
      activateSurface(surface, validate, report) {
        assert.equal(validate(), surface);
        for (let attempt = 0; attempt < attempts; attempt++) {
          const node = target === 'body' ? h.document.body : surface;
          h.window.EventTarget.prototype.dispatchEvent.call(node,
            new h.window.MouseEvent('click', { bubbles: true, cancelable: true }));
        }
        // Intentionally dishonest diagnostic claims: only receipts from the
        // trial's guard may authorize the single bound opener activation.
        report({ stage: 'complete', reason: null, events: ['mousedown', 'mouseup', 'click'],
          observedEvents: ['mousedown', 'mouseup', 'click'] });
        return true;
      }
    });
    const result = await h.run();
    assert.equal(result.ok, false); assert.equal(result.reason, 'widget_open_failed');
    const probe = plain(h.api.widgetProbes())[0];
    assert.equal(probe.activation.stage, 'complete');
    assert.equal(probe.openerClicks, expectedOpenerClicks);
    assert.equal(h.api.widgetClickCount(), attempts);
    assert.equal(probe.opened, false, 'receipt count is checked before accepting an overlay');
    assert.equal(result.liveSupportClaimed, false); assert.equal(result.restored, true);
    assert.equal(result.pageLeftAsFound, true);
    assertNeverSave(h);
    assert.equal(h.document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden),.ant-select-open,.ant-calendar-picker-container').length, 0);
    assert.equal((await h.api.cleanup()).ok, true);
  });
}

test('a visible menu linked to the captured opener owns the probe before the select open class renders', async t => {
  const h = await setup(t, { onSchoolOpen: ({ school }) => {
    // Fictional render ordering. Only remove the captured class; keep the
    // exact harvested visible portal and aria-controls-to-inner-DIV linkage.
    school.closest('.ant-select').classList.remove('ant-select-open');
  } });
  const result = await h.run();
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.liveSupportClaimed, false);
  const probe = plain(h.api.widgetProbes())[0];
  assert.equal(probe.opened, true); assert.equal(probe.closed, true);
  assert.equal(probe.openerClicks, 1);
  assertNeverSave(h);
  assert.equal(h.document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden),.ant-select-open,.ant-calendar-picker-container').length, 0);
  assert.equal((await h.api.cleanup()).ok, true);
});

test('a linked visible school menu cannot authorize a foreign open select when its own open class is absent', async t => {
  let foreign;
  const h = await setup(t, { onSchoolOpen: ({ document, school }) => {
    school.closest('.ant-select').classList.remove('ant-select-open');
    foreign = document.getElementById('14_53_0').querySelector('.ant-select');
    foreign.classList.add('ant-select-open');
  } });
  const result = await h.run();
  assert.equal(result.ok, false); assert.equal(result.reason, 'widget_open_failed');
  const probe = plain(h.api.widgetProbes())[0];
  assert.equal(probe.openerClicks, 1); assert.equal(probe.opened, false);
  assert.equal(result.liveSupportClaimed, false); assert.equal(result.pageLeftAsFound, false);
  assert.ok(foreign.classList.contains('ant-select-open'), 'the trial must not dismiss a foreign select');
  assertNeverSave(h);
  // The test owns this deliberate mutation. Remove it before asking the trial
  // to release guards; production cleanup must retain guards while it exists.
  foreign.classList.remove('ant-select-open'); h.selects.close();
  assert.equal((await h.api.cleanup()).ok, true);
});

test('expanded ARIA and a hidden linked harvested menu remain a failed open with clean close', async t => {
  const h = await setup(t, { onSchoolOpen: ({ document }) => {
    const menu = document.querySelector('.ant-select-dropdown');
    menu.classList.add('ant-select-dropdown-hidden'); menu.style.display = 'none';
  } });
  const result = await h.run();
  assert.equal(result.ok, false); assert.equal(result.reason, 'widget_open_failed');
  assert.equal(result.liveSupportClaimed, false); assert.equal(result.restored, true);
  assert.equal(result.pageLeftAsFound, true);
  const probe = plain(h.api.widgetProbes())[0];
  assert.equal(probe.opened, false); assert.equal(probe.openerClicks, 1);
  assertNeverSave(h);
  assert.equal((await h.api.cleanup()).ok, true);
});

test('orphaned Never-Save hooks require reload before a second controls trial; known-owner cleanup restores the same opener', async t => {
  // CMS_EDU_WIDGET_OVERLAY_HARVEST_d22734a9_2026-10-23.md and
  // overlay-harvest-d22734a9/residual-hooks.json establish an absent live API
  // with the old click/fetch/XHR wrappers and document capture stop remaining.
  // after-reload-open.json supplies the clean-page contrast. This fixture
  // retains a genuine trial's hooks after removing only its public API; no new
  // DOM, guessed site handler, navigation, reload, or saved value is needed.
  let cleanMethods;
  const methods = window => ({ click: window.HTMLElement.prototype.click, fetch: window.fetch,
    xhrOpen: window.XMLHttpRequest.prototype.open, xhrSend: window.XMLHttpRequest.prototype.send });
  const h = await setup(t, { beforeInstall: ({ window }) => { cleanMethods = methods(window); } });
  const firstApi = h.api;
  assert.equal(delete h.window.__cmsEducationLive, true);
  assert.equal(h.window.__cmsEducationLive, undefined);
  const residualMethods = methods(h.window);
  for (const key of Object.keys(cleanMethods)) assert.notEqual(residualMethods[key], cleanMethods[key]);
  assert.match(String(residualMethods.click), /allowedWidgetClick/u);
  assert.match(String(residualMethods.fetch), /isNonGetMethod/u);
  assert.match(String(residualMethods.xhrOpen), /openedDuringTrial/u);
  assert.match(String(residualMethods.xhrSend), /suppressedAutosave/u);

  let targetClicks = 0;
  h.school.addEventListener('click', () => targetClicks++);
  h.school.click();
  assert.equal(targetClicks, 0, 'the measured orphan prototype click wrapper is inert outside its trial');
  const blockedReports = [];
  const activated = h.window.ResumeCmsEducationMultiWidgetControls.activateSurface(h.school, () => h.school,
    report => blockedReports.push(plain(report)));
  assert.equal(activated, false, 'native EventTarget dispatch cannot bypass the older document capture stop');
  assert.equal(blockedReports.at(-1).reason, 'event_not_observed');
  assert.deepEqual(blockedReports.at(-1).events, ['mousedown', 'mouseup', 'click']);
  assert.deepEqual(blockedReports.at(-1).observedEvents, ['mousedown', 'mouseup']);
  assert.equal(targetClicks, 0); assert.equal(h.selects.counts.opens, 0);
  assert.equal(firstApi.widgetClickCount(), 0);
  const refusalCount = firstApi.clicks().length;
  assert.equal(refusalCount, 2, 'the stale guard refused .click() and the dispatched opener click');
  const controllerBefore = h.window.ResumeCmsEducationMulti;
  const helperBefore = h.window.ResumeCmsEducationMultiWidgetControls;
  const second = plain(h.window.eval(runner.buildPageExpression(root, 0, true)));
  assert.deepEqual(second, { ok: false, reason: 'stale_live_guard_reload_required', reloadRequired: true,
    residualGuards: { click: true, fetch: true, xhrOpen: true, xhrSend: true } });
  assert.equal(h.window.__cmsEducationLive, undefined, 'the refused install must not add a second trial API');
  assert.deepEqual(methods(h.window), residualMethods, 'preflight must not stack or replace stale hooks');
  assert.equal(h.window.ResumeCmsEducationMulti, controllerBefore);
  assert.equal(h.window.ResumeCmsEducationMultiWidgetControls, helperBefore);
  assert.equal(firstApi.clicks().length, refusalCount, 'preflight must not try another activation');
  assert.equal(targetClicks, 0); assert.equal(h.selects.counts.opens, 0);
  assert.deepEqual(h.readProof(), h.before, 'preflight must preserve the current unsaved values');

  // Only the retained first API owns the removers. A second installer cannot
  // safely infer which capture listeners to remove from a missing API.
  assert.equal((await firstApi.cleanup()).ok, true);
  assert.deepEqual(methods(h.window), cleanMethods);
  assert.equal(h.window.__cmsEducationLive, undefined);
  h.window.eval(fs.readFileSync(path.join(root, 'src/content/cms-education-multi-adapters.js'), 'utf8'));
  const cleanReports = [];
  assert.equal(h.window.ResumeCmsEducationMultiWidgetControls.activateSurface(h.school, () => h.school,
    report => cleanReports.push(plain(report))), true);
  assert.equal(cleanReports.at(-1).stage, 'complete');
  assert.deepEqual(cleanReports.at(-1).observedEvents, ['mousedown', 'mouseup', 'click']);
  assert.equal(targetClicks, 1); assert.equal(h.selects.counts.opens, 1);
  const linked = h.document.getElementById(h.school.getAttribute('aria-controls'));
  const ownedMenu = linked?.closest('.ant-select-dropdown');
  assert.ok(ownedMenu && ownedMenu.contains(linked));
  assert.ok(ownedMenu.getClientRects().length > 0);
  assert.equal(ownedMenu.classList.contains('ant-select-dropdown-hidden'), false);
  assert.notEqual(h.window.getComputedStyle(ownedMenu).display, 'none');
  h.window.EventTarget.prototype.dispatchEvent.call(h.school,
    new h.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  assert.equal(h.document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden),.ant-select-open,.ant-calendar-picker-container').length, 0);
  assert.deepEqual(h.readProof(), h.before);
  assert.equal(h.native.sends, 0); assert.equal(h.native.forbidden, 0);
  assert.equal(h.window.fixtureCounts.saves, 0); assert.equal(h.window.fixtureCounts.submits, 0);
  assert.equal(h.selects.counts.selections, 0); assert.equal(h.dates.snapshot().selections, 0);
  assert.deepEqual(plain(firstApi.posts()), []);
});

test('an existing controls API remains busy before stale-hook preflight and does not replace its own guards', async t => {
  const h = await setup(t);
  const before = { click: h.window.HTMLElement.prototype.click, fetch: h.window.fetch,
    xhrOpen: h.window.XMLHttpRequest.prototype.open, xhrSend: h.window.XMLHttpRequest.prototype.send };
  assert.deepEqual(plain(h.window.eval(runner.buildPageExpression(root, 0, true))),
    { ok: false, reason: 'profile_write_context_busy' });
  assert.equal(h.window.__cmsEducationLive, h.api);
  assert.deepEqual({ click: h.window.HTMLElement.prototype.click, fetch: h.window.fetch,
    xhrOpen: h.window.XMLHttpRequest.prototype.open, xhrSend: h.window.XMLHttpRequest.prototype.send }, before);
  assertNeverSave(h);
  assert.equal((await h.api.cleanup()).ok, true);
});
