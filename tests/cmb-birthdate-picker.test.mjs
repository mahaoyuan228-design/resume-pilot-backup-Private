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
  assessCmbBirthDatePickerTarget,
  fillCmbBirthDatePicker,
  parseCmbBirthDate
} from '../src/content/cmb-birthdate-picker.mjs';
import { planCmbBasicFromProfile } from '../src/content/cmb-profile-map.mjs';

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
  assert.equal(parseCmbBirthDate('2000-02-29').ok, true);
  for (const raw of ['', '   ', '不是日期', '1990-1-2', '1990-02-31', '1900-02-29', '1990-01', '1990-01/02', '1990/01-02', '1990-01-02T00:00:00']) {
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

function birthProfile(birthDate = '2002-01-25') {
  return {
    fullName: '测试甲',
    phone: '13800138000',
    email: 'cmb.user@example.com',
    birthDate,
    confirmedFields: ['fullName', 'phone', 'email', 'birthDate']
  };
}

test('readiness and fill agree when the birthday picker target is unique', async () => {
  const { document, input } = page();
  installNavigatingPicker(document, input, { valueFromTitle: (title) => title.replace(/-/gu, '/') });
  const census = assessCmbBirthDatePickerTarget(document);
  const plan = planCmbBasicFromProfile(birthProfile('1990-01-02'), { count: census.count, input: census.ok === true });
  const liveDate = planCmbBasicFromProfile(birthProfile('2002-01-25'), { count: 1, input: true });
  assert.equal(census.unique, true);
  assert.equal(plan.values.birthDate, '1990-01-02');
  assert.equal(plan.birthDateReadiness.ready, true);
  assert.equal(plan.birthDateReadiness.fillVia, 'datepicker');
  assert.equal(plan.birthDateReadiness.blocker, false);
  assert.equal(plan.birthDateReadiness.reason, null);
  assert.equal(plan.blockers.some((row) => row.reason === 'datepicker_hint_only'), false);
  assert.equal(liveDate.values.birthDate, '2002-01-25');
  assert.equal(liveDate.birthDateReadiness.fillVia, 'datepicker');
  assert.equal(liveDate.blockers.some((row) => row.reason === 'datepicker_hint_only'), false);
  const result = await fillCmbBirthDatePicker(document, plan.values.birthDate);
  assert.equal(result.ok, true);
  assert.equal(result.reason, 'matched');
  assert.equal(result.saved, false);
  assert.equal(result.supported, false);
  assert.equal(result.after, '1990-01-02');
  assert.equal(input.value, '1990/01/02');
});

test('a duplicate birthday input is not fillable and is not written', async () => {
  const { document, input, counts } = page();
  const extra = document.createElement('input');
  extra.id = 'resume_basicInfo_birthday';
  extra.readOnly = true;
  extra.value = 'leave-me';
  document.body.appendChild(extra);
  let opened = 0;
  input.addEventListener('mousedown', () => { opened += 1; });
  const census = assessCmbBirthDatePickerTarget(document);
  const plan = planCmbBasicFromProfile(birthProfile(), { count: census.count, input: census.ok === true });
  const result = await fillCmbBirthDatePicker(document, '2002-01-25');
  assert.equal(census.reason, 'birthdate_target_ambiguous');
  assert.equal(plan.values.birthDate, '');
  assert.equal(plan.birthDateReadiness.reason, 'birthdate_target_ambiguous');
  assert.equal(plan.birthDateReadiness.fillVia, null);
  assert.equal(plan.birthDateReadiness.blocker, true);
  assert.equal(result.reason, plan.birthDateReadiness.reason);
  assert.equal(result.ok, false);
  assert.equal(result.writeAttempted, false);
  assert.equal(result.saved, false);
  assert.equal(opened, 0);
  assert.equal(input.value, '');
  assert.equal(extra.value, 'leave-me');
  assert.equal(counts().saveClicks, 0);
});

test('a missing birthday input fails readiness and fill the same way', async () => {
  const dom = new JSDOM('<!DOCTYPE html><body><button type="button" id="save-btn">保存</button></body>');
  const plan = planCmbBasicFromProfile(birthProfile(), { count: 0, input: false });
  const result = await fillCmbBirthDatePicker(dom.window.document, '2002-01-25');
  assert.equal(plan.birthDateReadiness.reason, 'birthdate_input_missing');
  assert.equal(result.reason, 'birthdate_input_missing');
  assert.equal(result.writeAttempted, false);
  assert.equal(result.saved, false);
  assert.equal(plan.values.birthDate, '');
});

test('an invalid birthday stays unparseable even when the picker target is unique', () => {
  const plan = planCmbBasicFromProfile(birthProfile('不是日期'), { count: 1, input: true });
  assert.equal(plan.values.birthDate, '');
  assert.equal(plan.birthDateReadiness.reason, 'birthdate_unparseable');
  assert.equal(plan.birthDateReadiness.fillVia, null);
  assert.equal(plan.blockers.some((row) => row.reason === 'datepicker_hint_only'), false);
});

test('unavailable birthday targets fail before any mouse interaction', async () => {
  for (const makeUnavailable of [
    (input) => { input.disabled = true; },
    (input) => { input.type = 'hidden'; },
    (input) => { input.type = 'reset'; },
    (input) => { input.type = 'file'; },
    (input) => { input.type = 'radio'; },
    (input) => { input.type = 'checkbox'; },
    (input) => { input.type = 'date'; },
    (input) => { input.type = 'number'; },
    (input) => { input.hidden = true; },
    (input) => { input.setAttribute('aria-disabled', 'true'); },
    (input) => { input.parentElement.hidden = true; },
    (input) => { input.parentElement.style.display = 'none'; },
    (input) => { input.parentElement.setAttribute('inert', ''); }
  ]) {
    const { document, input, counts } = page();
    makeUnavailable(input);
    let mouseEvents = 0;
    input.addEventListener('mousedown', () => { mouseEvents += 1; });
    const result = await fillCmbBirthDatePicker(document, '1990-01-02');
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'birthdate_input_missing');
    assert.equal(result.writeAttempted, false);
    assert.equal(result.liveSupportClaimed, false);
    assert.equal(mouseEvents, 0);
    assert.equal(input.value, '');
    assert.equal(counts().saveClicks, 0);
  }
});

function installSingleDatePanel(document, input, transform = () => {}) {
  input.addEventListener('mousedown', () => {
    const dropdown = document.createElement('div');
    dropdown.className = 'ant-picker-dropdown';
    dropdown.innerHTML = markup({ mode: 'date', year: 1990, month: 1 });
    transform(dropdown);
    document.body.appendChild(dropdown);
  });
}

test('picker cells cannot route through forbidden or navigational ancestors', async () => {
  for (const label of ['保存', '提交', '删除', '投递', '下一步', 'Save', 'Submit', 'Delete', 'Deliver', 'Next']) {
    const { document, input } = page();
    let unsafeClicks = 0;
    installSingleDatePanel(document, input, (dropdown) => {
      const cell = dropdown.querySelector('.ant-picker-cell-inner');
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', label);
      cell.replaceWith(button);
      button.appendChild(cell);
      button.addEventListener('click', () => { unsafeClicks += 1; });
    });
    const result = await fillCmbBirthDatePicker(document, '1990-01-02');
    assert.equal(result.ok, false, label);
    assert.equal(result.reason, 'birthdate_panel_missing', label);
    assert.equal(unsafeClicks, 0, label);
    assert.equal(input.value, '', label);
  }

  const { document, input } = page();
  let navigations = 0;
  installSingleDatePanel(document, input, (dropdown) => {
    const cell = dropdown.querySelector('.ant-picker-cell-inner');
    const link = document.createElement('a');
    link.href = '#unexpected';
    cell.replaceWith(link);
    link.appendChild(cell);
    link.addEventListener('click', () => { navigations += 1; });
  });
  const result = await fillCmbBirthDatePicker(document, '1990-01-02');
  assert.equal(result.ok, false);
  assert.equal(navigations, 0);
});

test('a date cell that becomes a forbidden action on mousedown is never clicked', async () => {
  const { document, input } = page();
  let clicks = 0;
  installSingleDatePanel(document, input, (dropdown) => {
    const cell = dropdown.querySelector('.ant-picker-cell-inner');
    cell.addEventListener('mousedown', () => { cell.setAttribute('aria-label', '下一步'); });
    cell.addEventListener('click', () => { clicks += 1; });
  });
  const result = await fillCmbBirthDatePicker(document, '1990-01-02');
  assert.equal(result.ok, false);
  assert.equal(clicks, 0);
  assert.equal(input.value, '');
});

test('a picker cell cannot activate a label-associated action control', async () => {
  for (const external of [false, true]) {
    const { document, input } = page();
    let actionClicks = 0;
    installSingleDatePanel(document, input, (dropdown) => {
      const cell = dropdown.querySelector('.ant-picker-cell-inner');
      const label = document.createElement('label');
      const button = document.createElement('button');
      button.id = 'unexpected-picker-action';
      button.type = 'button';
      button.setAttribute('aria-label', '保存');
      button.addEventListener('click', () => { actionClicks += 1; });
      cell.replaceWith(label);
      label.appendChild(cell);
      if (external) {
        label.htmlFor = button.id;
        document.body.appendChild(button);
      } else {
        label.prepend(button);
      }
    });
    const result = await fillCmbBirthDatePicker(document, '1990-01-02');
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'birthdate_panel_missing');
    assert.equal(actionClicks, 0);
    assert.equal(input.value, '');
  }
});

test('hidden stale dropdowns do not make the visible birthday panel ambiguous', async () => {
  const { document, input } = page();
  const hidden = document.createElement('div');
  hidden.hidden = true;
  hidden.innerHTML = '<div class="ant-picker-dropdown"></div>';
  document.body.appendChild(hidden);
  installSingleDatePanel(document, input);
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.ant-picker-cell[title="1990-01-02"]')) return;
    input.value = '1990-01-02';
    event.target.closest('.ant-picker-dropdown').remove();
  });
  const result = await fillCmbBirthDatePicker(document, '1990-01-02');
  assert.equal(result.ok, true);
  assert.equal(result.liveSupportClaimed, false);
});

test('a target duplicated during picker navigation aborts before a day is clicked', async () => {
  const { document, input } = page();
  installNavigatingPicker(document, input);
  let dateClicks = 0;
  document.addEventListener('click', (event) => {
    if (event.target.closest('.ant-picker-year-btn')) {
      document.body.appendChild(input.cloneNode());
    }
    if (event.target.closest('.ant-picker-cell[title="1990-01-02"]')) dateClicks += 1;
  });
  const result = await fillCmbBirthDatePicker(document, '1990-01-02');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'birthdate_target_ambiguous');
  assert.equal(dateClicks, 0);
  assert.equal(input.value, '');
});

test('post-pick verification reads the current unique target after a rerender', async () => {
  for (const replacementValue of ['', '1990/01/02']) {
    const { document, input } = page();
    installNavigatingPicker(document, input);
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.ant-picker-cell[title="1990-01-02"]')) return;
      const replacement = input.cloneNode();
      replacement.value = replacementValue;
      input.replaceWith(replacement);
    });
    const result = await fillCmbBirthDatePicker(document, '1990-01-02');
    assert.equal(result.ok, replacementValue !== '');
    assert.equal(result.reason, replacementValue ? 'matched' : 'birthdate_readback_mismatch');
    assert.equal(result.saved, false);
    assert.equal(result.liveSupportClaimed, false);
    assert.equal(input.value, '1990-01-02');
    assert.equal(document.getElementById(input.id).value, replacementValue);
  }
});

test('mixed date separators cannot open the picker or pass the date readback', async () => {
  for (const raw of ['1990-01/02', '1990/01-02']) {
    const { document, input, counts } = page();
    let opened = 0;
    input.addEventListener('mousedown', () => { opened += 1; });
    const result = await fillCmbBirthDatePicker(document, raw);
    const plan = planCmbBasicFromProfile(birthProfile(raw), { count: 1, input: true });
    assert.equal(result.reason, 'birthdate_unparseable');
    assert.equal(result.writeAttempted, false);
    assert.equal(plan.birthDateReadiness.reason, 'birthdate_unparseable');
    assert.equal(opened, 0);
    assert.equal(counts().saveClicks, 0);
  }

  const { document, input, counts } = page();
  installNavigatingPicker(document, input, { valueFromTitle: () => '1990-01/02' });
  const result = await fillCmbBirthDatePicker(document, '1990-01-02');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'birthdate_readback_mismatch');
  assert.equal(input.value, '1990-01/02');
  assert.equal(counts().saveClicks, 0);
});

test('one dropdown with multiple visible panels or modes refuses all picker cells', async () => {
  for (const addPanel of [
    (dropdown) => { dropdown.insertAdjacentHTML('beforeend', markup({ mode: 'month', year: 1990 })); },
    (dropdown) => {
      const extra = dropdown.ownerDocument.createElement('div');
      extra.className = 'ant-picker-month-panel';
      dropdown.querySelector('.ant-picker-panel').appendChild(extra);
    }
  ]) {
    const { document, input, counts } = page();
    let cellClicks = 0;
    installSingleDatePanel(document, input, (dropdown) => {
      addPanel(dropdown);
      dropdown.addEventListener('click', () => { cellClicks += 1; });
    });
    const result = await fillCmbBirthDatePicker(document, '1990-01-02');
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'birthdate_panel_multiple');
    assert.equal(result.writeAttempted, false);
    assert.equal(cellClicks, 0);
    assert.equal(input.value, '');
    assert.equal(counts().saveClicks, 0);
  }
});

test('date cell lookup stays inside the one visible panel and ignores stale hidden panels', async () => {
  const { document, input, counts } = page();
  let staleClicks = 0;
  let activeClicks = 0;
  installSingleDatePanel(document, input, (dropdown) => {
    const active = dropdown.querySelector('.ant-picker-panel');
    const stale = document.createElement('div');
    stale.hidden = true;
    stale.innerHTML = markup({ mode: 'date', year: 1990, month: 1 });
    stale.addEventListener('click', () => { staleClicks += 1; });
    dropdown.prepend(stale);
    const foreign = document.createElement('div');
    foreign.className = 'ant-picker-cell';
    foreign.title = '1990-01-02';
    foreign.innerHTML = '<div class="ant-picker-cell-inner">2</div>';
    foreign.addEventListener('click', () => { staleClicks += 1; });
    dropdown.appendChild(foreign);
    active.addEventListener('click', (event) => {
      if (!event.target.closest('.ant-picker-cell')) return;
      activeClicks += 1;
      input.value = '1990/01/02';
      dropdown.remove();
    });
  });
  const result = await fillCmbBirthDatePicker(document, '1990-01-02');
  assert.equal(result.ok, true);
  assert.equal(result.after, '1990-01-02');
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(activeClicks, 1);
  assert.equal(staleClicks, 0);
  assert.equal(counts().other, 'untouched');
  assert.equal(counts().saveClicks, 0);
});

test('ambiguous year navigation controls fail before any header action', async () => {
  const { document, input, counts } = page();
  let headerClicks = 0;
  installSingleDatePanel(document, input, (dropdown) => {
    dropdown.innerHTML = markup({ mode: 'date', year: 2026, month: 10 });
    const year = dropdown.querySelector('.ant-picker-year-btn');
    year.after(year.cloneNode(true));
    dropdown.addEventListener('click', () => { headerClicks += 1; });
  });
  const result = await fillCmbBirthDatePicker(document, '1990-01-02');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'birthdate_panel_missing');
  assert.equal(headerClicks, 0);
  assert.equal(input.value, '');
  assert.equal(counts().saveClicks, 0);
});
