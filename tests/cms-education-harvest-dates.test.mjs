import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { harvestedDates, installHarvestedDates } from './fixtures/cms-education-harvest-dates.mjs';
import { integrationFixture } from './fixtures/cms-education-fixture.mjs';

const source = fs.readFileSync(new URL('../src/content/cms-education-multi-dates.js', import.meta.url), 'utf8');
const PAGE = 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';
const plain = value => JSON.parse(JSON.stringify(value));

function harness(t, setup) {
  const dom = new JSDOM('<form><input id="outside" value="fictional outside"><section class="form-cell" id="14"><div class="tit-wrap"><div class="tit">教育经历必填</div></div><div class="form-cell-right"><div class="form-cell-inner"><div id="14_49_0"></div><div id="14_50_0"></div></div></div></section></form>', {
    url: PAGE, pretendToBeVisual: true, runScripts: 'dangerously',
    beforeParse(window) {
      window.Element.prototype.getClientRects = function () { return this.isConnected ? [{ width: 10, height: 10 }] : []; };
    }
  });
  const { window } = dom;
  Object.defineProperty(window.document, 'visibilityState', { configurable: true, get: () => 'visible' });
  const widget = installHarvestedDates(window);
  const row = window.document.querySelector('.form-cell-inner');
  window.ResumeCmsEducationMulti = { locateRow: (_form, identity) => identity === 'harvest-row-0' ? row : null };
  window.eval(source);
  const clicks = [];
  window.document.addEventListener('click', event => clicks.push(event.target), true);
  const fill = (key, value, extra = {}) => window.ResumeCmsMultiEducationDates.fillEducationDate(widget.inputFor(key), value, {
    confirmed: true, key, profileIndex: 0, rowIdentity: 'harvest-row-0', sourcePath: `education.0.${key}`, replaceExisting: true, ...extra
  });
  setup?.(window, widget);
  t.after(() => {
    try {
      assert.equal(window.document.getElementById('outside').value, 'fictional outside');
      assert.equal(widget.snapshot().headerSelections, 0, 'unharvested selector panels are never opened');
      assert.equal(clicks.some(node => /保存|提交|下一步|投递|删除|Save|Submit|Next|Deliver|Delete/u.test(node.textContent || '')), false);
    } finally { dom.window.close(); }
  });
  return { window, widget, fill, clicks };
}

test('date fixtures cite raw harvest and preserve real readonly input and full Chinese td dates', () => {
  assert.equal(harvestedDates.liveSupportClaimed, false);
  assert.ok(harvestedDates.sources.includes('field-start-time-open-isolated.json'));
  assert.ok(harvestedDates.sources.includes('field-end-time-open-isolated.json'));
  for (const [key, id] of [['startDate', '14_49_0'], ['endDate', '14_50_0']]) {
    const field = harvestedDates.fields[key];
    assert.equal(field.wrapperId, id);
    assert.match(field.itemHTML, /<input readonly=""/u);
    assert.match(field.cellsHTML[0], /<td role="gridcell" title="\d{4}年\d{1,2}月\d{1,2}日"/u);
    assert.doesNotMatch(field.panelHTML, /ant-calendar-year-panel|ant-calendar-month-panel/u);
  }
});

for (const [key, target] of [['startDate', '2023-02-02'], ['endDate', '2024-11-02']]) {
  test(`${key}: harvested day cells write and restore the exact original date`, async t => {
    const { fill, widget } = harness(t);
    const original = widget.inputFor(key).value;
    const before = widget.snapshot().values;
    assert.deepEqual(plain(await fill(key, target)), { status: 'verified', reason: 'readback_matched' });
    assert.equal(widget.inputFor(key).value, target);
    assert.deepEqual(plain(await fill(key, original)), { status: 'verified', reason: 'readback_matched' });
    assert.deepEqual(widget.snapshot().values, before);
    assert.equal(widget.snapshot().portalOpen, false);
    assert.equal(widget.snapshot().selections, 2);
    assert.deepEqual(widget.snapshot().navigation, []);
  });
}

test('education navigates only harvested year/month links and can restore across years', async t => {
  const { fill, widget } = harness(t);
  const original = widget.inputFor('startDate').value;
  assert.equal((await fill('startDate', '2025-04-15')).status, 'verified');
  assert.equal((await fill('startDate', original)).status, 'verified');
  assert.equal(widget.inputFor('startDate').value, original);
  assert.ok(widget.snapshot().navigation.includes('next-year'));
  assert.ok(widget.snapshot().navigation.includes('next-month'));
  assert.ok(widget.snapshot().navigation.includes('prev-year'));
  assert.ok(widget.snapshot().navigation.includes('prev-month'));
});

test('month-only facts and occupied fields without replacement authorization never open the picker', async t => {
  const { fill, widget } = harness(t);
  assert.equal((await fill('startDate', '2023-02')).reason, 'insufficient_precision');
  assert.equal((await fill('startDate', '2023-02-02', { replaceExisting: false })).reason, 'existing_value');
  assert.equal(widget.snapshot().opens, 0);
});

for (const mode of ['disabled', 'duplicate', 'day-only', 'conflicting', 'missing-navigation', 'unrecognized-header']) {
  test(`${mode}: conservative skip closes the portal without selecting or changing values`, async t => {
    const { window, widget, fill } = harness(t);
    const before = widget.snapshot().values;
    const input = widget.inputFor('startDate');
    window.document.addEventListener('click', event => {
      if (event.target !== input) return;
      const cell = window.document.querySelector('.ant-calendar-cell[title="2023年2月2日"]');
      if (mode === 'disabled') cell.classList.add('ant-calendar-disabled-cell');
      if (mode === 'duplicate') cell.after(cell.cloneNode(true));
      if (mode === 'day-only') cell.removeAttribute('title');
      if (mode === 'conflicting') cell.querySelector('.ant-calendar-date').title = '2023-02-03';
      if (mode === 'missing-navigation') window.document.querySelector('.ant-calendar-next-year-btn').remove();
      if (mode === 'unrecognized-header') window.document.querySelector('.ant-calendar-year-select').textContent = '未知年';
    });
    const result = await fill('startDate', ['missing-navigation', 'unrecognized-header'].includes(mode) ? '2025-04-15' : '2023-02-02');
    assert.equal(result.status, 'skipped', JSON.stringify(result));
    assert.deepEqual(widget.snapshot().values, before);
    assert.equal(widget.snapshot().selections, 0);
    assert.equal(widget.snapshot().portalOpen, false);
  });
}

test('a full-date cell that drifts during profile verification is never clicked', async t => {
  const { window, widget, fill } = harness(t);
  let checks = 0;
  window.ResumeProfileWriteContext = { async check() {
    checks += 1;
    if (checks === 3) window.document.querySelector('.ant-calendar-cell[title="2023年2月2日"]').title = '2023年2月3日';
  } };
  assert.equal((await fill('startDate', '2023-02-02')).reason, 'field_changed');
  assert.equal(widget.snapshot().selections, 0);
  assert.equal(widget.snapshot().portalOpen, false);
});

test('a duplicate full-date cell added during profile verification is never clicked', async t => {
  const { window, widget, fill } = harness(t);
  let checks = 0;
  window.ResumeProfileWriteContext = { async check() {
    checks += 1;
    if (checks === 3) {
      const cell = window.document.querySelector('.ant-calendar-cell[title="2023年2月2日"]');
      cell.after(cell.cloneNode(true));
    }
  } };
  assert.equal((await fill('startDate', '2023-02-02')).reason, 'field_changed');
  assert.equal(widget.snapshot().selections, 0);
  assert.equal(widget.snapshot().portalOpen, false);
});

test('existing fictional button-header date fixtures retain their cross-year panel path', async t => {
  const dom = new JSDOM(await integrationFixture({ schools: ['虚构学院'], regions: [{ province: '虚构省', city: '虚构市' }] }), {
    url: PAGE, pretendToBeVisual: true, runScripts: 'dangerously',
    beforeParse(window) {
      window.structuredClone = structuredClone;
      window.Element.prototype.getClientRects = function () { return this.isConnected ? [{ width: 10, height: 10 }] : []; };
    }
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  Object.defineProperty(window.document, 'visibilityState', { configurable: true, get: () => 'visible' });
  const row = window.document.querySelector('.form-cell-inner');
  window.ResumeCmsEducationMulti = { locateRow: () => row };
  window.fixtureWidgets.dates[0].setCloseDelay(0);
  window.fixtureWidgets.dates[0].setOpenDelay(0);
  window.eval(source);
  const input = window.document.querySelector('#date-start-0 input');
  const result = await window.ResumeCmsMultiEducationDates.fillEducationDate(input, '2002-04-15', {
    confirmed: true, key: 'startDate', profileIndex: 0, rowIdentity: 'old-fictional-row', sourcePath: 'education.0.startDate'
  });
  assert.deepEqual(plain(result), { status: 'verified', reason: 'readback_matched' });
  const snapshot = window.fixtureSnapshot();
  assert.equal(snapshot.dates[0].values.start, '2002-04-15');
  assert.equal(snapshot.dates[0].values.end, '');
  assert.equal(snapshot.counts.saves, 0);
  assert.equal(snapshot.counts.submits, 0);
});
