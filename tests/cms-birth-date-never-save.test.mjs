import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const fixture = fs.readFileSync(new URL('./fixtures/cms-ant-v3-date-synthetic.html', import.meta.url), 'utf8');
const source = fs.readFileSync(new URL('../src/content/cms-date-picker.js', import.meta.url), 'utf8');
const target = '2002-04-15';
const plain = value => JSON.parse(JSON.stringify(value));
const birthInput = window => window.document.querySelector('#birth-host input');

function harness(t, setup) {
  const dom = new JSDOM(fixture, {
    url: 'https://wecruit.hotjob.cn/SUfictional/pb/resumeOperation.html',
    runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(window) {
      window.Element.prototype.getClientRects = function () {
        return this.isConnected ? [{ width: 10, height: 10 }] : [];
      };
    }
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  Object.defineProperty(window.document, 'visibilityState', { configurable: true, get: () => 'visible' });
  window.syntheticCmsDate.setCloseDelay(0);
  window.syntheticCmsDate.setOpenDelay(0);
  window.syntheticCmsDate.setExisting('start', '2019-09-01');
  window.syntheticCmsDate.setExisting('end', '2023-07-01');
  const clicked = [];
  window.document.addEventListener('click', event => clicked.push(event.target), true);
  window.eval(source);
  setup?.(window);
  t.after(() => {
    const snapshot = window.syntheticCmsDate.snapshot();
    assert.equal(snapshot.saves, 0);
    assert.equal(snapshot.submits, 0);
    assert.equal(clicked.some(node => node.closest?.('#site-save,#site-submit')), false);
  });
  return { window, api: window.ResumeCmsDatePicker, clicked };
}

function ownerAt(window, wanted, action) {
  let checks = 0;
  window.ResumeProfileWriteContext = { async check() {
    checks += 1;
    await Promise.resolve();
    if (checks === wanted) action(window);
  } };
  return () => checks;
}

function untouched(window, { birth = '', start = '2019-09-01', end = '2023-07-01', portal = false } = {}) {
  const snapshot = plain(window.syntheticCmsDate.snapshot());
  assert.deepEqual(snapshot.values, { birth, start, end });
  assert.deepEqual(snapshot.selections, { birth: 0, start: 0, end: 0 });
  assert.equal(snapshot.portalOpen, portal);
  return snapshot;
}

test('late occupied birth input is preserved before its first click', async t => {
  const { window, api } = harness(t);
  ownerAt(window, 1, window => { birthInput(window).value = '1999-11-23'; });
  const result = await api.fillBirthDate(birthInput(window), target);
  assert.deepEqual(plain(result), { status: 'skipped', reason: 'existing_value' });
  assert.equal(birthInput(window).value, '1999-11-23');
  assert.equal(untouched(window).opens.birth, 0);
});

test('preselection birth rerender never clicks the detached input', async t => {
  const { window, api } = harness(t);
  ownerAt(window, 1, window => window.syntheticCmsDate.setExisting('birth', ''));
  const result = await api.fillBirthDate(birthInput(window), target);
  assert.equal(result.status, 'failed');
  assert.equal(untouched(window).opens.birth, 0);
});

test('late day title drift never selects a different date', async t => {
  const { window, api } = harness(t);
  ownerAt(window, 7, window => {
    window.document.querySelector('.ant-calendar-date[title="2002-04-15"]').title = '2002-04-16';
  });
  const result = await api.fillBirthDate(birthInput(window), target);
  assert.equal(result.status, 'failed');
  untouched(window);
});

test('owner rejection closes the opened birth portal and preserves the error', async t => {
  const { window, api } = harness(t);
  ownerAt(window, 2, () => { throw new Error('profile_owner_changed'); });
  await assert.rejects(api.fillBirthDate(birthInput(window), target), /profile_owner_changed/u);
  untouched(window);
});

const stages = [
  { name: 'birth opener', check: 1, selector: '#birth-host input' },
  { name: 'year header', check: 2, selector: '.ant-calendar-year-select' },
  { name: 'first decade navigation', check: 3, selector: '.ant-calendar-year-panel-prev-decade-btn' },
  { name: 'second decade navigation', check: 4, selector: '.ant-calendar-year-panel-prev-decade-btn' },
  { name: 'year choice', check: 5, selector: '.ant-calendar-year-panel-year[title="2002"]' },
  { name: 'month choice', check: 6, selector: '.ant-calendar-month-panel-month[title="2002-04"]' },
  { name: 'day choice', check: 7, selector: '.ant-calendar-date[title="2002-04-15"]' }
];

for (const stage of stages) {
  test(`${stage.name}: a value entered during owner verification is skipped`, async t => {
    const { window, api, clicked } = harness(t);
    let before;
    ownerAt(window, stage.check, window => {
      birthInput(window).value = '1998-06-12';
      before = clicked.length;
    });
    const result = await api.fillBirthDate(birthInput(window), target);
    assert.deepEqual(plain(result), { status: 'skipped', reason: 'existing_value' });
    assert.equal(birthInput(window).value, '1998-06-12');
    assert.equal(clicked.slice(before).every(node => node === window.document.body), true);
    untouched(window);
  });

  test(`${stage.name}: disabling the captured candidate cancels its click`, async t => {
    const { window, api, clicked } = harness(t);
    let before;
    ownerAt(window, stage.check, window => {
      window.document.querySelector(stage.selector).disabled = true;
      before = clicked.length;
    });
    const result = await api.fillBirthDate(birthInput(window), target);
    assert.equal(result.status, 'failed');
    assert.equal(clicked.slice(before).every(node => node === window.document.body), true);
    untouched(window);
  });
}

for (const [name, mutate] of [
  ['birth rerender', window => window.syntheticCmsDate.setExisting('birth', '')],
  ['birth occupied rerender', window => window.syntheticCmsDate.setExisting('birth', '1997-02-03')],
  ['birth no longer readonly', window => { birthInput(window).readOnly = false; }],
  ['birth question duplicated', window => window.syntheticCmsDate.duplicateBirthQuestion()],
  ['birth question hidden', window => { window.document.getElementById('birth-question').hidden = true; }],
  ['neighbor start value changed', window => { window.document.querySelector('#education-start-host input').value = '2020-01-01'; }],
  ['neighbor end rerendered', window => window.syntheticCmsDate.setExisting('end', '2024-07-01')]
]) {
  test(`day guard refuses ${name} while preserving neighboring calendar values`, async t => {
    const { window, api, clicked } = harness(t);
    let before;
    ownerAt(window, 7, window => { mutate(window); before = clicked.length; });
    const result = await api.fillBirthDate(birthInput(window), target);
    assert.equal(result.status, 'failed');
    assert.equal(clicked.slice(before).every(node => node === window.document.body), true);
    untouched(window, {
      birth: name === 'birth occupied rerender' ? '1997-02-03' : '',
      end: name === 'neighbor end rerendered' ? '2024-07-01' : '2023-07-01'
    });
    assert.equal(window.document.querySelector('#education-start-host input').value,
      name === 'neighbor start value changed' ? '2020-01-01' : '2019-09-01');
  });
}

for (const [name, stage, mutate] of [
  ['removed year header', stages[1], element => element.remove()],
  ['hidden year header', stages[1], element => { element.hidden = true; }],
  ['duplicate year header', stages[1], element => element.after(element.cloneNode(true))],
  ['changed decade year range', stages[2], element => {
    const year = element.closest('.ant-calendar-year-panel').querySelector('.ant-calendar-year-panel-year');
    year.title = '1990'; year.textContent = '1990';
  }],
  ['removed year choice', stages[4], element => element.remove()],
  ['conflicting year title', stages[4], element => { element.title = '2003'; }],
  ['duplicate year choice', stages[4], element => element.after(element.cloneNode(true))],
  ['changed month title', stages[5], element => { element.title = '2002-05'; }],
  ['duplicate month choice', stages[5], element => element.after(element.cloneNode(true))],
  ['removed day choice', stages[6], element => element.remove()],
  ['disabled outer day cell', stages[6], element => element.closest('.ant-calendar-cell').classList.add('ant-calendar-disabled-cell')],
  ['conflicting outer day date', stages[6], element => { element.closest('.ant-calendar-cell').title = '2002-04-16'; }],
  ['duplicate day choice', stages[6], element => element.closest('.ant-calendar-cell').after(element.closest('.ant-calendar-cell').cloneNode(true))]
]) {
  test(`owner check invalidates ${name} without clicking stale UI`, async t => {
    const { window, api, clicked } = harness(t);
    let before;
    ownerAt(window, stage.check, window => {
      const element = window.document.querySelector(stage.selector);
      assert.ok(element, stage.name);
      mutate(element);
      before = clicked.length;
    });
    const result = await api.fillBirthDate(birthInput(window), target);
    assert.equal(result.status, 'failed');
    assert.equal(clicked.slice(before).every(node => node === window.document.body), true);
    untouched(window);
  });
}

test('hidden-page interruption after async ownership check closes the birth portal', async t => {
  const { window, api } = harness(t);
  ownerAt(window, 7, window => {
    Object.defineProperty(window.document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  });
  await assert.rejects(api.fillBirthDate(birthInput(window), target), /fill_interrupted_page_hidden/u);
  untouched(window);
});

test('hidden-page interruption before popup mount cancels only its own pending opener', async t => {
  const { window, api } = harness(t, window => window.syntheticCmsDate.setOpenDelay(100));
  window.ResumeProfileWriteContext = { async check() {
    window.setTimeout(() => {
      Object.defineProperty(window.document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    }, 0);
  } };
  await assert.rejects(api.fillBirthDate(birthInput(window), target), /fill_interrupted_page_hidden/u);
  await new Promise(resolve => window.setTimeout(resolve, 150));
  const snapshot = untouched(window);
  assert.equal(snapshot.opens.birth, 1);
});

test('late month header change is guarded when the year selection returns to days', async t => {
  const { window, api, clicked } = harness(t, window => window.syntheticCmsDate.setYearReturnsDay(true));
  let before;
  ownerAt(window, 6, window => {
    window.document.querySelector('.ant-calendar-month-select').hidden = true;
    before = clicked.length;
  });
  const result = await api.fillBirthDate(birthInput(window), target);
  assert.equal(result.status, 'failed');
  assert.equal(clicked.slice(before).every(node => node === window.document.body), true);
  untouched(window);
});

for (const kind of ['disabled', 'duplicate', 'conflicting']) {
  test(`preexisting ${kind} target day is refused and its portal closes`, async t => {
    const { window, api } = harness(t, window => {
      const settings = { disabled: 'setDisabledTarget', duplicate: 'setDuplicateTarget', conflicting: 'setConflictingDateTitles' };
      window.syntheticCmsDate[settings[kind]](true);
    });
    const result = await api.fillBirthDate(birthInput(window), target);
    assert.equal(result.status, 'skipped');
    assert.equal(result.reason, { disabled: 'disabled_day', duplicate: 'ambiguous_day', conflicting: 'day_not_found' }[kind]);
    untouched(window);
  });
}

for (const existing of ['1996-08-13', target]) {
  test(`initial occupied birth (${existing === target ? 'matching' : 'different'}) never opens its calendar`, async t => {
    const { window, api } = harness(t, window => window.syntheticCmsDate.setExisting('birth', existing));
    const result = await api.fillBirthDate(birthInput(window), target);
    assert.equal(result.status, existing === target ? 'verified' : 'skipped');
    assert.equal(untouched(window, { birth: existing }).opens.birth, 0);
  });
}

test('an already open neighboring calendar is skipped without Escape or date clicks', async t => {
  const { window, api } = harness(t);
  window.document.querySelector('#education-start-host input').click();
  await new Promise(resolve => window.setTimeout(resolve, 10));
  const result = await api.fillBirthDate(birthInput(window), target);
  assert.deepEqual(plain(result), { status: 'skipped', reason: 'control_error' });
  assert.equal(untouched(window, { portal: true }).opens.birth, 0);
});

test('a neighboring calendar opened during the first owner check is left alone', async t => {
  const { window, api } = harness(t);
  window.ResumeProfileWriteContext = { async check() {
    window.document.querySelector('#education-start-host input').click();
    await new Promise(resolve => window.setTimeout(resolve, 10));
  } };
  const result = await api.fillBirthDate(birthInput(window), target);
  assert.equal(result.status, 'failed');
  assert.equal(untouched(window, { portal: true }).opens.birth, 0);
});

test('a neighboring calendar opened while the birth portal mounts is never claimed as birth', async t => {
  const { window, api } = harness(t);
  window.ResumeProfileWriteContext = { async check() {
    window.setTimeout(() => window.document.querySelector('#education-start-host input').click(), 0);
  } };
  const result = await api.fillBirthDate(birthInput(window), target);
  assert.equal(result.status, 'failed');
  const snapshot = untouched(window, { portal: true });
  assert.equal(snapshot.opens.birth, 1);
  assert.equal(snapshot.opens.start, 1);
});

test('a delayed neighboring opener keeps its pending timer without Escape or body cleanup', async t => {
  const { window, api } = harness(t, window => window.syntheticCmsDate.setOpenDelay(2000));
  const closeSignals = [];
  window.document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeSignals.push(event);
  }, true);
  window.document.body.addEventListener('mousedown', event => {
    if (event.target === window.document.body) closeSignals.push(event);
  }, true);
  window.ResumeProfileWriteContext = { async check() {
    window.setTimeout(() => window.document.querySelector('#education-start-host input').click(), 0);
  } };
  const result = await api.fillBirthDate(birthInput(window), target);
  assert.equal(result.status, 'failed');
  assert.equal(closeSignals.length, 0);
  untouched(window);
  await new Promise(resolve => window.setTimeout(resolve, 2010));
  assert.equal(closeSignals.length, 0);
  assert.equal(untouched(window, { portal: true }).opens.start, 1);
});

test('Escape-resistant refusal uses the fixture body-close fallback', async t => {
  const { window, api } = harness(t, window => {
    window.syntheticCmsDate.setDisabledTarget(true);
    window.syntheticCmsDate.setEscapeIgnored(true);
  });
  const result = await api.fillBirthDate(birthInput(window), target);
  assert.deepEqual(plain(result), { status: 'skipped', reason: 'disabled_day' });
  untouched(window);
});

test('a portal refusing Escape and body close is reported as an unclosed control', async t => {
  const { window, api } = harness(t, window => {
    window.syntheticCmsDate.setDisabledTarget(true);
    window.syntheticCmsDate.setEscapeIgnored(true);
    window.syntheticCmsDate.setBodyCloseIgnored(true);
  });
  const result = await api.fillBirthDate(birthInput(window), target);
  assert.deepEqual(plain(result), { status: 'failed', reason: 'portal_not_closed' });
  untouched(window, { portal: true });
});

test('selection cleared by the fixture rerender is reported without retrying a day click', async t => {
  const { window, api } = harness(t, window => window.syntheticCmsDate.setClearAfterSelection(true));
  const result = await api.fillBirthDate(birthInput(window), target);
  assert.deepEqual(plain(result), { status: 'failed', reason: 'readback_mismatch' });
  const snapshot = plain(window.syntheticCmsDate.snapshot());
  assert.deepEqual(snapshot.values, { birth: '', start: '2019-09-01', end: '2023-07-01' });
  assert.deepEqual(snapshot.selections, { birth: 1, start: 0, end: 0 });
  assert.equal(snapshot.rerenders, 1);
  assert.equal(snapshot.portalOpen, false);
});

test('birth selection allows the fixture same-slot rerender and preserves existing neighbors', async t => {
  const { window, api } = harness(t);
  const original = birthInput(window);
  const result = await api.fillBirthDate(original, target);
  assert.deepEqual(plain(result), { status: 'verified', reason: 'readback_matched' });
  assert.notEqual(birthInput(window), original);
  const snapshot = plain(window.syntheticCmsDate.snapshot());
  assert.deepEqual(snapshot.values, { birth: target, start: '2019-09-01', end: '2023-07-01' });
  assert.deepEqual(snapshot.selections, { birth: 1, start: 0, end: 0 });
  assert.equal(snapshot.rerenders, 1);
  assert.equal(snapshot.portalOpen, false);
});
