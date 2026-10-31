import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { acceptGthMonthInPage } from '../src/background/gth-open-fills.mjs';

// Offline popup fixtures only. Live Never-Save acceptance remains pending.
function popupFixture(start, end, { outsideParent = false, shownYear, pickerYear, depth = 1 } = {}) {
  const year = Number(end.slice(0, 4));
  const dom = new JSDOM(`<!doctype html><body>
    <form id="work"><div class="el-form-item">
      <div class="el-date-editor el-date-editor--month"><input value="${start}" readonly></div>
      <div class="el-date-editor el-date-editor--month"><input id="end" value="" readonly
        data-gth-month-role="input" data-gth-month-answer="${end}"></div>
    </div></form>
    <div class="el-picker-panel el-date-picker el-popper" data-gth-month-role="panel">
      <span class="el-date-picker__header-label">${shownYear ?? year} 年</span>
      <table class="el-month-table"><tbody><tr>${Array.from({ length: 12 }, (_, index) => `<td>${index + 1}月</td>`).join('')}</tr></tbody></table>
    </div>
  </body>`, { url: 'https://hr.gtht.com/resume/edit/', pretendToBeVisual: true, runScripts: 'outside-only' });
  const { document } = dom.window;
  const input = document.getElementById('end');
  const panel = document.querySelector('.el-picker-panel');
  const table = panel.querySelector('.el-month-table');
  const calls = [];
  const picker = {
    $el: outsideParent ? document.getElementById('work') : panel,
    selectionMode: 'month',
    year: pickerYear ?? year,
    $children: [],
    handleMonthPick(monthIndex) {
      calls.push(monthIndex);
      input.value = `${this.year}-${String(monthIndex + 1).padStart(2, '0')}`;
    },
  };
  let child = picker;
  for (let index = 0; index < depth; index += 1) child = { $el: table, $parent: child, $children: [] };
  panel.__vue__ = child;
  const accept = () => dom.window.eval(`(${acceptGthMonthInPage.toString()})(${JSON.stringify({ answer: end })})`);
  return { dom, document, input, panel, picker, calls, accept };
}

for (const [start, end] of [['2023-01', '2024-06'], ['2022-03', '2023-12']]) {
  test(`month popup accepts ${start} | ${end} through its nested Vue parent`, () => {
    const f = popupFixture(start, end);
    try {
      const result = f.accept();
      assert.equal(result.result, 'picked');
      assert.equal(result.ok, true);
      assert.deepEqual(f.calls, [Number(end.slice(5)) - 1]);
      assert.equal(`${f.document.querySelector('#work input').value} | ${f.input.value}`, `${start} | ${end}`);
    } finally { f.dom.window.close(); }
  });
}

test('month popup does not invoke a picker parent rooted outside the bound panel', () => {
  const f = popupFixture('2023-01', '2024-06', { outsideParent: true });
  try {
    const result = f.accept();
    assert.equal(result.result, 'no-vue');
    assert.equal(result.ok, false);
    assert.deepEqual(f.calls, []);
    assert.equal(f.input.value, '');
  } finally { f.dom.window.close(); }
});

test('month popup parent lookup remains bounded', () => {
  const f = popupFixture('2023-01', '2024-06', { depth: 7 });
  try {
    const result = f.accept();
    assert.equal(result.result, 'no-vue');
    assert.deepEqual(f.calls, []);
  } finally { f.dom.window.close(); }
});

test('month popup rejects a wrong header year before invoking its parent picker', () => {
  const f = popupFixture('2023-01', '2024-06', { shownYear: 2023 });
  try {
    const result = f.accept();
    assert.equal(result.result, 'bad-year');
    assert.equal(result.ok, false);
    assert.deepEqual(f.calls, []);
    assert.equal(f.input.value, '');
  } finally { f.dom.window.close(); }
});

test('month popup does not pick through a parent whose model year disagrees', () => {
  const f = popupFixture('2023-01', '2024-06', { pickerYear: 2023 });
  try {
    const result = f.accept();
    assert.equal(result.ok, false);
    assert.deepEqual(f.calls, []);
    assert.equal(f.input.value, '');
  } finally { f.dom.window.close(); }
});

test('month popup rejects two genuinely active month panels before parent lookup', () => {
  const f = popupFixture('2023-01', '2024-06');
  try {
    const other = f.panel.cloneNode(true);
    other.removeAttribute('data-gth-month-role');
    f.document.body.appendChild(other);
    const result = f.accept();
    assert.equal(result.result, 'dual');
    assert.equal(result.ok, false);
    assert.deepEqual(f.calls, []);
    assert.equal(f.input.value, '');
  } finally { f.dom.window.close(); }
});

test('month popup preserves an explicit refusal when its parent picker throws', () => {
  const f = popupFixture('2023-01', '2024-06');
  try {
    f.picker.handleMonthPick = () => { throw new Error('model refused'); };
    const result = f.accept();
    assert.equal(result.result, 'threw');
    assert.equal(result.ok, false);
    assert.equal(f.input.value, '');
  } finally { f.dom.window.close(); }
});
