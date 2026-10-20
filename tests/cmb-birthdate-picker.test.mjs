/**
 * jsdom coverage for the CMB 出生日期 Ant DatePicker fill.
 * Scoped to #resume_basicInfo_birthday. Never Save.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import {
  fillCmbBirthDatePicker,
  parseCmbBirthDate
} from '../src/content/cmb-birthdate-picker.mjs';

const root = resolve('.');

function pickerBlock(source) {
  const start = source.indexOf('/* CMB_BIRTHDATE_PICKER_START */');
  const end = source.indexOf('/* CMB_BIRTHDATE_PICKER_END */');
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end);
}

test('content script keeps the same picker implementation', () => {
  const engine = readFileSync(resolve(root, 'src/content/cmb-basic.js'), 'utf8');
  const moduleSource = readFileSync(resolve(root, 'src/content/cmb-birthdate-picker.mjs'), 'utf8');
  const dedented = pickerBlock(engine).split('\n').map((line) => (line.startsWith('  ') ? line.slice(2) : line)).join('\n');
  assert.equal(dedented, pickerBlock(moduleSource));
  assert.match(engine, /resume_basicInfo_birthday/);
  assert.match(engine, /function fillBirthDate\(/);
  assert.doesNotMatch(engine, /click\(.*保存|保存.*\.click/);
  assert.equal(engine.includes('liveSupportClaimed: true'), false);
  assert.equal(engine.includes('supported: true'), false);
});

function page() {
  const dom = new JSDOM(`<!DOCTYPE html><body>
    <button type="button" id="save-btn">保存</button>
    <button type="submit" id="submit-btn">提交</button>
    <button type="button" id="delete-btn">删除</button>
    <div class="ant-picker ant-picker-status-success">
      <div class="ant-picker-input">
        <input id="resume_basicInfo_birthday" readonly placeholder="请选择日期" value="">
      </div>
    </div>
    <div class="ant-picker"><input id="other-date" readonly value="untouched"></div>
  </body>`);
  const { document } = dom.window;
  const input = document.getElementById('resume_basicInfo_birthday');
  let saveClicks = 0;
  let escapes = 0;
  document.addEventListener('click', (event) => {
    const el = event.target.closest && event.target.closest('button,a,input');
    if (el && /保存|提交|删除|投递/u.test(`${el.textContent || ''} ${el.value || ''}`)) saveClicks += 1;
  }, true);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') escapes += 1;
  });
  return {
    document,
    input,
    counts: () => ({ saveClicks, escapes, other: document.getElementById('other-date').value })
  };
}

function markup(state) {
  if (state.mode === 'year') {
    const cells = [];
    for (let year = state.decadeStart; year < state.decadeStart + 10; year += 1) {
      cells.push(`<td title="${year}" class="ant-picker-cell"><div class="ant-picker-cell-inner">${year}</div></td>`);
    }
    return `<div class="ant-picker-panel"><div class="ant-picker-year-panel"><div class="ant-picker-header"><button type="button" class="ant-picker-header-super-prev-btn"></button><button type="button" class="ant-picker-decade-btn">${state.decadeStart}-${state.decadeStart + 9}</button><button type="button" class="ant-picker-header-super-next-btn"></button></div><table><tbody><tr>${cells.join('')}</tr></tbody></table></div></div>`;
  }
  if (state.mode === 'month') {
    const cells = [];
    for (let month = 1; month <= 12; month += 1) {
      const title = `${state.year}-${String(month).padStart(2, '0')}`;
      cells.push(`<td title="${title}" class="ant-picker-cell"><div class="ant-picker-cell-inner">${month}月</div></td>`);
    }
    return `<div class="ant-picker-panel"><div class="ant-picker-month-panel"><div class="ant-picker-header"><button type="button" class="ant-picker-year-btn">${state.year}</button></div><table><tbody><tr>${cells.join('')}</tr></tbody></table></div></div>`;
  }
  const dayTitle = `${state.year}-${String(state.month).padStart(2, '0')}-${state.year === 1990 && state.month === 1 ? '02' : '01'}`;
  return `<div class="ant-picker-panel"><div class="ant-picker-date-panel"><div class="ant-picker-header"><button type="button" class="ant-picker-header-super-prev-btn"></button><div class="ant-picker-header-view"><button type="button" class="ant-picker-year-btn">${state.year}</button><button type="button" class="ant-picker-month-btn">${state.month}月</button></div><button type="button" class="ant-picker-header-super-next-btn"></button></div><table><tbody><tr><td title="${dayTitle}" class="ant-picker-cell ant-picker-cell-in-view"><div class="ant-picker-cell-inner">${dayTitle.slice(-2)}</div></td></tr></tbody></table></div></div>`;
}

function installNavigatingPicker(document, input, { valueFromTitle = (title) => title } = {}) {
  const state = { mode: 'date', year: 2026, month: 10, decadeStart: 2020 };
  const render = () => {
    document.querySelectorAll('.ant-picker-dropdown').forEach((node) => {
      if (!node.classList.contains('ant-picker-dropdown-hidden')) node.remove();
    });
    const dropdown = document.createElement('div');
    dropdown.className = 'ant-picker-dropdown';
    dropdown.innerHTML = markup(state);
    document.body.appendChild(dropdown);
  };
  input.addEventListener('mousedown', () => {
    if (![...document.querySelectorAll('.ant-picker-dropdown')].some((node) => !node.classList.contains('ant-picker-dropdown-hidden'))) {
      render();
    }
  });
  document.addEventListener('click', (event) => {
    const dropdown = event.target.closest && event.target.closest('.ant-picker-dropdown');
    if (!dropdown || dropdown.classList.contains('ant-picker-dropdown-hidden')) return;
    if (event.target.closest('.ant-picker-year-btn') && state.mode === 'date') {
      state.mode = 'year';
      render();
      return;
    }
    if (event.target.closest('.ant-picker-month-btn') && state.mode === 'date') {
      state.mode = 'month';
      render();
      return;
    }
    if (event.target.closest('.ant-picker-header-super-prev-btn') && state.mode === 'year') {
      state.decadeStart -= 10;
      render();
      return;
    }
    if (event.target.closest('.ant-picker-header-super-next-btn') && state.mode === 'year') {
      state.decadeStart += 10;
      render();
      return;
    }
    const cell = event.target.closest('.ant-picker-cell');
    if (!cell) return;
    const title = cell.getAttribute('title') || '';
    if (state.mode === 'year') {
      state.year = Number(title);
      state.mode = 'month';
      render();
      return;
    }
    if (state.mode === 'month') {
      state.year = Number(title.slice(0, 4));
      state.month = Number(title.slice(5, 7));
      state.mode = 'date';
      render();
      return;
    }
    input.value = valueFromTitle(title);
    dropdown.remove();
  });
}

test('parse accepts YYYY-MM-DD and YYYY/MM/DD only', () => {
  assert.equal(parseCmbBirthDate('1990-01-02').iso, '1990-01-02');
  assert.equal(parseCmbBirthDate(' 1990/01/02 ').iso, '1990-01-02');
  for (const raw of ['', '   ', '不是日期', '1990-1-2', '1990-02-31', '1990-01', '1990-01-02T00:00:00']) {
    assert.equal(parseCmbBirthDate(raw).ok, false);
    assert.equal(parseCmbBirthDate(raw).reason, 'birthdate_unparseable');
  }
});

test('navigates the Ant picker and verifies a normalized date without saving', async () => {
  const { document, input, counts } = page();
  const hidden = document.createElement('div');
  hidden.className = 'ant-picker-dropdown ant-picker-dropdown-hidden';
  document.body.appendChild(hidden);
  installNavigatingPicker(document, input, { valueFromTitle: (title) => title.replace(/-/gu, '/') });
  const result = await fillCmbBirthDatePicker(document, '1990/01/02');
  assert.equal(result.ok, true);
  assert.equal(result.status, 'verified');
  assert.equal(result.reason, 'matched');
  assert.equal(result.after, '1990-01-02');
  assert.equal(result.expected, '1990-01-02');
  assert.equal(result.inputId, 'resume_basicInfo_birthday');
  assert.equal(result.saved, false);
  assert.equal(result.supported, false);
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.liveFillClaimed, false);
  assert.equal(input.value, '1990/01/02');
  const countsAfter = counts();
  assert.equal(countsAfter.saveClicks, 0);
  assert.equal(countsAfter.other, 'untouched');
  assert.equal(document.querySelector('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)'), null);
});

test('missing panel fails closed, presses Escape, and does not save', async () => {
  const { document, input, counts } = page();
  const result = await fillCmbBirthDatePicker(document, '1990-01-02');
  assert.equal(result.ok, false);
  assert.equal(result.status, 'failed');
  assert.equal(result.reason, 'birthdate_panel_missing');
  assert.equal(result.writeAttempted, false);
  assert.equal(input.value, '');
  const countsAfter = counts();
  assert.equal(countsAfter.saveClicks, 0);
  assert.equal(countsAfter.escapes > 0, true);
  assert.equal(countsAfter.other, 'untouched');
});

test('a wrong date after the cell click fails closed and does not type a correction', async () => {
  const { document, input, counts } = page();
  installNavigatingPicker(document, input, { valueFromTitle: () => '1980-05-05' });
  const result = await fillCmbBirthDatePicker(document, '1990-01-02');
  assert.equal(result.ok, false);
  assert.equal(result.status, 'failed');
  assert.equal(result.reason, 'birthdate_readback_mismatch');
  assert.equal(result.writeAttempted, true);
  assert.equal(input.value, '1980-05-05');
  assert.notEqual(input.value, '1990-01-02');
  const countsAfter = counts();
  assert.equal(countsAfter.saveClicks, 0);
  assert.equal(countsAfter.escapes > 0, true);
  assert.equal(countsAfter.other, 'untouched');
});

test('an unparseable profile date does not open the picker or click save', async () => {
  const { document, input, counts } = page();
  let opened = 0;
  input.addEventListener('mousedown', () => { opened += 1; });
  const result = await fillCmbBirthDatePicker(document, '不是日期');
  assert.equal(result.ok, false);
  assert.equal(result.status, 'failed');
  assert.equal(result.reason, 'birthdate_unparseable');
  assert.equal(result.writeAttempted, false);
  assert.equal(opened, 0);
  assert.equal(input.value, '');
  const countsAfter = counts();
  assert.equal(countsAfter.saveClicks, 0);
  assert.equal(countsAfter.escapes, 0);
});

test('multiple open dropdowns fail closed before a date cell is clicked', async () => {
  const { document, input, counts } = page();
  let cellClicks = 0;
  input.addEventListener('mousedown', () => {
    for (let index = 0; index < 2; index += 1) {
      const dropdown = document.createElement('div');
      dropdown.className = 'ant-picker-dropdown';
      dropdown.innerHTML = '<td title="1990-01-02" class="ant-picker-cell"><div class="ant-picker-cell-inner">2</div></td>';
      dropdown.addEventListener('click', () => { cellClicks += 1; });
      document.body.appendChild(dropdown);
    }
  });
  const result = await fillCmbBirthDatePicker(document, '1990-01-02');
  assert.equal(result.ok, false);
  assert.equal(result.status, 'failed');
  assert.equal(result.reason, 'birthdate_panel_multiple');
  assert.equal(cellClicks, 0);
  assert.equal(input.value, '');
  const countsAfter = counts();
  assert.equal(countsAfter.saveClicks, 0);
  assert.equal(countsAfter.escapes > 0, true);
});
