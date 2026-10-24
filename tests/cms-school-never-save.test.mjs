// Existing fictional Ant v3 school fixture; no employer DOM, browser, or network proof.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const fixture = await readFile(new URL('./fixtures/cms-school-search-synthetic.html', import.meta.url), 'utf8');
const source = await readFile(new URL('../src/content/cms-school-search.js', import.meta.url), 'utf8');
const PAGE = 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';

function setup(t) {
  const dom = new JSDOM(fixture, { url: PAGE, pretendToBeVisual: true, runScripts: 'dangerously' });
  const { window } = dom;
  t.after(() => window.close());
  window.Element.prototype.getClientRects = function () {
    return window.getComputedStyle(this).display === 'none' ? [] : [{ width: 8, height: 8 }];
  };
  let visibility = 'visible';
  Object.defineProperty(window.document, 'visibilityState', { get: () => visibility });
  const schedule = window.setTimeout.bind(window);
  window.setTimeout = (callback) => schedule(callback, 0);
  const clicks = [];
  const click = window.HTMLElement.prototype.click;
  window.HTMLElement.prototype.click = function () {
    assert.ok(!this.matches('#save,button[type="submit"]'), 'Never-Save guard must never be invoked');
    clicks.push({ connected: this.isConnected, className: this.className });
    return click.call(this);
  };
  // Expose existing private routines only in this offline test, without changing its DOM or event model.
  const instrumented = source.replace('implementationRevision:', 'testTarget: target, testCloseOwnMenu: closeOwnMenu, implementationRevision:');
  assert.notEqual(instrumented, source);
  window.eval(instrumented);
  const selection = window.document.querySelector('.ant-select-selection--single');
  return { window, selection, clicks, hide: () => { visibility = 'hidden'; } };
}

function assertNeverSaved(window) {
  const snapshot = window.syntheticSchool.snapshot();
  assert.equal(snapshot.saves, 0);
  assert.equal(snapshot.submits, 0);
  assert.equal(snapshot.unrelated, '保留');
  return snapshot;
}

test('school occupied during asynchronous ownership check remains closed and unclicked', async (t) => {
  const { window, selection, clicks } = setup(t);
  window.ResumeProfileWriteContext = { async check() { window.syntheticSchool.setValue('occupied-user-school'); } };
  const result = await window.ResumeCmsSchoolSearch.fillSchool(selection, window.syntheticSchool.answer);
  assert.deepEqual(clicks, []);
  assert.equal(result.status, 'skipped');
  assert.equal(result.reason, 'existing_value');
  const snapshot = assertNeverSaved(window);
  assert.equal(snapshot.selected, 'occupied-user-school');
  assert.equal(snapshot.opened, false);
  assert.equal(snapshot.menuCount, 0);
});

test('school rerender during asynchronous ownership check never clicks the disconnected owner', async (t) => {
  const { window, selection, clicks } = setup(t);
  window.ResumeProfileWriteContext = { async check() { window.syntheticSchool.setValue(''); } };
  const result = await window.ResumeCmsSchoolSearch.fillSchool(selection, window.syntheticSchool.answer);
  assert.deepEqual(clicks, []);
  assert.equal(result.status, 'failed');
  assert.equal(result.reason, 'field_changed');
  assert.equal(assertNeverSaved(window).menuCount, 0);
});

test('search occupied during asynchronous ownership check is preserved without opening', async (t) => {
  const { window, selection, clicks } = setup(t);
  const search = selection.querySelector('input');
  window.ResumeProfileWriteContext = { async check() { search.value = 'user-pending-query'; } };
  const result = await window.ResumeCmsSchoolSearch.fillSchool(selection, window.syntheticSchool.answer);
  assert.deepEqual(clicks, []);
  assert.equal(result.status, 'skipped');
  assert.equal(result.reason, 'control_busy');
  assert.equal(search.value, 'user-pending-query');
  assert.equal(assertNeverSaved(window).menuCount, 0);
});

test('school page hidden during ownership check stops before opening', async (t) => {
  const { window, selection, clicks, hide } = setup(t);
  window.ResumeProfileWriteContext = { async check() { hide(); } };
  await assert.rejects(window.ResumeCmsSchoolSearch.fillSchool(selection, window.syntheticSchool.answer), /fill_interrupted_page_hidden/u);
  assert.deepEqual(clicks, []);
  assert.equal(assertNeverSaved(window).menuCount, 0);
});

test('school rerender during the search ownership check stops before insertText', async (t) => {
  const { window, selection, clicks } = setup(t);
  let checks = 0, commands = 0;
  window.ResumeProfileWriteContext = { async check() {
    if (++checks === 2) window.syntheticSchool.setValue('');
  } };
  // A negative write sentinel only: no input event or trusted-search emulation.
  window.document.execCommand = () => { commands += 1; return false; };
  const result = await window.ResumeCmsSchoolSearch.fillSchool(selection, window.syntheticSchool.answer);
  assert.equal(checks, 2);
  assert.equal(commands, 0, 'a stale search must never receive insertText');
  assert.equal(clicks.length, 1);
  assert.equal(clicks[0].connected, true);
  assert.equal(result.status, 'failed');
  assert.equal(result.reason, 'field_changed');
  const snapshot = assertNeverSaved(window);
  assert.equal(snapshot.searches, 0);
  assert.equal(snapshot.selections, 0);
  assert.equal(snapshot.menuCount, 0);
});

async function openedSchool(t) {
  const state = setup(t);
  const { window, selection } = state;
  selection.click();
  const search = selection.querySelector('input');
  search.value = window.syntheticSchool.answer;
  search.dispatchEvent(new window.Event('input', { bubbles: true }));
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  const baseline = {
    ...window.ResumeCmsSchoolSearch.testTarget(selection), href: window.location.href,
    timeOrigin: window.performance.timeOrigin
  };
  const events = [];
  for (const type of ['input', 'change', 'keydown']) search.addEventListener(type, (event) => events.push({ type, keyCode: event.keyCode }));
  return { ...state, search, baseline, events };
}

test('owned school cleanup uses Escape without an input/change mutation or answer selection', async (t) => {
  const { window, baseline, events } = await openedSchool(t);
  assert.equal(await window.ResumeCmsSchoolSearch.testCloseOwnMenu(baseline), true);
  assert.deepEqual(events, [{ type: 'keydown', keyCode: 27 }]);
  const snapshot = assertNeverSaved(window);
  assert.equal(snapshot.searches, 1, 'cleanup must not schedule another search');
  assert.equal(snapshot.selections, 0);
  assert.equal(snapshot.menuCount, 0);
  assert.equal(snapshot.opened, false);
});

test('cleanup rejects a school whose ownership changes during the asynchronous check', async (t) => {
  const { window, baseline, events } = await openedSchool(t);
  window.ResumeProfileWriteContext = { async check() { window.syntheticSchool.setValue('occupied-user-school'); } };
  assert.equal(await window.ResumeCmsSchoolSearch.testCloseOwnMenu(baseline), false);
  assert.deepEqual(events, []);
  const snapshot = assertNeverSaved(window);
  assert.equal(snapshot.selected, 'occupied-user-school');
  assert.equal(snapshot.searches, 1);
  assert.equal(snapshot.selections, 0);
});

test('cleanup leaves a dropdown with no proven aria-controls owner untouched', async (t) => {
  const { window, selection, baseline, events, search } = await openedSchool(t);
  selection.removeAttribute('aria-controls');
  const query = search.value;
  assert.equal(await window.ResumeCmsSchoolSearch.testCloseOwnMenu(baseline), false);
  assert.deepEqual(events, []);
  assert.equal(search.value, query);
  const snapshot = assertNeverSaved(window);
  assert.equal(snapshot.menuCount, 1);
  assert.equal(snapshot.searches, 1);
  assert.equal(snapshot.selections, 0);
});

test.skip('trusted catalog search/candidate race needs isolated-browser insertText evidence; jsdom execCommand cannot provide it', () => {});
