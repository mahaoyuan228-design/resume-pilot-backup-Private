/**
 * CMB 出生日期 picker.
 * Scoped to #resume_basicInfo_birthday. Drives an Ant Design v4/v5 DatePicker
 * by documented class names only. Unknown structure fails closed.
 * Never assigns the input value, never types, never clicks 保存/提交/删除/投递.
 * liveFillClaimed and supported stay false. Never Save.
 */
/* CMB_BIRTHDATE_PICKER_START */
const CMB_BIRTHDATE_INPUT_ID = 'resume_basicInfo_birthday';
const CMB_BIRTHDATE_FILL_FAIL_REASONS = Object.freeze([
  'birthdate_unparseable',
  'birthdate_input_missing',
  'birthdate_panel_missing',
  'birthdate_panel_multiple',
  'birthdate_cell_missing',
  'birthdate_cell_disabled',
  'birthdate_readback_mismatch'
]);
const BIRTH_DATE_RE = /^(\d{4})[-/](\d{2})[-/](\d{2})$/u;
const MONTH_NAME_TO_NUMBER = Object.freeze({
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
});
const PICKER_STEP_LIMIT = 36;

function pickerNorm(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/gu, '')
    .replace(/[\s\u00a0]+/gu, ' ')
    .trim();
}

function parseCmbBirthDate(raw) {
  const text = pickerNorm(raw);
  const match = text.match(BIRTH_DATE_RE);
  if (!match) return { ok: false, reason: 'birthdate_unparseable', iso: '' };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 2100) return { ok: false, reason: 'birthdate_unparseable', iso: '' };
  const iso = `${match[1]}-${match[2]}-${match[3]}`;
  const stamp = new Date(Date.UTC(year, month - 1, day));
  if (stamp.getUTCFullYear() !== year || stamp.getUTCMonth() !== month - 1 || stamp.getUTCDate() !== day) {
    return { ok: false, reason: 'birthdate_unparseable', iso: '' };
  }
  return { ok: true, reason: null, iso, year, month, day };
}

function normalizeCmbBirthDateValue(raw) {
  const parsed = parseCmbBirthDate(raw);
  return parsed.ok ? parsed.iso : '';
}

function pickerView(doc) {
  return doc?.defaultView || globalThis;
}

function saveLikeText(el) {
  if (!el) return '';
  const aria = typeof el.getAttribute === 'function' ? (el.getAttribute('aria-label') || '') : '';
  const value = el.tagName === 'INPUT' || el.tagName === 'BUTTON' ? String(el.value || '') : '';
  return `${el.textContent || ''} ${value} ${aria}`.replace(/\s+/gu, '');
}

function isSaveLike(el) {
  return /保存|提交|删除|投递/u.test(saveLikeText(el));
}

function isUnsafeClick(el) {
  if (!el || isSaveLike(el)) return true;
  const button = typeof el.closest === 'function' ? el.closest('button') : null;
  if (button) {
    const type = String(button.getAttribute('type') || '').toLowerCase();
    if (type !== 'button') return true;
  }
  if (el.tagName === 'INPUT') {
    const type = String(el.getAttribute('type') || 'text').toLowerCase();
    if (type === 'submit' || type === 'image' || type === 'button') return true;
  }
  return false;
}

function dispatchMouse(doc, el, type) {
  const View = pickerView(doc);
  el.dispatchEvent(new View.MouseEvent(type, { bubbles: true, cancelable: true, button: 0 }));
}

function pressPicker(doc, el) {
  if (isUnsafeClick(el)) return false;
  dispatchMouse(doc, el, 'mousedown');
  dispatchMouse(doc, el, 'mouseup');
  if (typeof el.click === 'function') el.click();
  return true;
}

function pressEscape(doc, input) {
  const View = pickerView(doc);
  for (const type of ['keydown', 'keyup']) {
    const event = new View.KeyboardEvent(type, {
      key: 'Escape',
      code: 'Escape',
      bubbles: true,
      cancelable: true
    });
    if (input && typeof input.dispatchEvent === 'function') input.dispatchEvent(event);
    if (typeof doc.dispatchEvent === 'function') doc.dispatchEvent(event);
  }
}

function visibleDropdowns(doc) {
  return [...doc.querySelectorAll('.ant-picker-dropdown')].filter((node) => {
    if (!node || !node.classList) return false;
    if (node.classList.contains('ant-picker-dropdown-hidden')) return false;
    if (typeof node.hasAttribute === 'function' && node.hasAttribute('hidden')) return false;
    if (node.style && node.style.display === 'none') return false;
    if (node.style && node.style.visibility === 'hidden') return false;
    return true;
  });
}

function singlePanel(doc) {
  const open = visibleDropdowns(doc);
  if (open.length === 0) return { ok: false, reason: 'birthdate_panel_missing' };
  if (open.length > 1) return { ok: false, reason: 'birthdate_panel_multiple' };
  return { ok: true, panel: open[0] };
}

function cellsByTitle(panel, title) {
  return [...panel.querySelectorAll('.ant-picker-cell')].filter((cell) => cell.getAttribute('title') === title);
}

function clickCell(doc, cell) {
  if (!cell) return 'missing';
  if (cell.classList.contains('ant-picker-cell-disabled')) return 'disabled';
  const inner = cell.querySelector('.ant-picker-cell-inner');
  const target = inner || cell;
  if (isUnsafeClick(target)) return 'unsafe';
  return pressPicker(doc, target) ? 'clicked' : 'unsafe';
}

function readHeaderYear(panel) {
  const button = panel.querySelector('.ant-picker-year-btn');
  if (!button) return null;
  const match = pickerNorm(button.textContent).match(/^(\d{4})(?:年)?$/u);
  if (!match) return null;
  const year = Number(match[1]);
  return year >= 1900 && year <= 2100 ? year : null;
}

function readHeaderMonth(panel) {
  const button = panel.querySelector('.ant-picker-month-btn');
  if (!button) return null;
  const text = pickerNorm(button.textContent);
  const numeric = text.match(/^(\d{1,2})\s*月$/u);
  if (numeric) {
    const month = Number(numeric[1]);
    return month >= 1 && month <= 12 ? month : null;
  }
  const key = text.slice(0, 3).toLowerCase();
  return MONTH_NAME_TO_NUMBER[key] || null;
}

function visibleYears(panel) {
  return [...panel.querySelectorAll('.ant-picker-cell')]
    .map((cell) => cell.getAttribute('title') || '')
    .filter((title) => /^\d{4}$/u.test(title))
    .map((title) => Number(title));
}

function panelMode(panel) {
  if (panel.querySelector('.ant-picker-decade-panel')) return 'decade';
  if (panel.querySelector('.ant-picker-year-panel')) return 'year';
  if (panel.querySelector('.ant-picker-month-panel')) return 'month';
  if (panel.querySelector('.ant-picker-date-panel')) return 'date';
  if (panel.querySelector('.ant-picker-year-btn') && panel.querySelector('.ant-picker-month-btn')) return 'date';
  if (panel.querySelector('.ant-picker-decade-btn')) return 'year';
  const titles = [...panel.querySelectorAll('.ant-picker-cell')].map((cell) => cell.getAttribute('title') || '');
  if (titles.some((title) => /^\d{4}-\d{2}-\d{2}$/u.test(title))) return 'date';
  if (titles.some((title) => /^\d{4}-\d{2}$/u.test(title))) return 'month';
  if (titles.some((title) => /^\d{4}$/u.test(title))) return 'year';
  return 'unknown';
}

function panelSignature(panel) {
  const titles = [...panel.querySelectorAll('.ant-picker-cell')]
    .map((cell) => cell.getAttribute('title') || '')
    .join(',');
  return [
    panelMode(panel),
    readHeaderYear(panel),
    readHeaderMonth(panel),
    titles
  ].join('|');
}

function closedPickerResult(partial) {
  return {
    ok: false,
    status: 'failed',
    saved: false,
    skippedSave: true,
    saveAllowed: false,
    supported: false,
    liveSupportClaimed: false,
    liveFillClaimed: false,
    inputId: CMB_BIRTHDATE_INPUT_ID,
    before: '',
    after: '',
    expected: '',
    writeAttempted: false,
    ...partial
  };
}

async function waitForPanelChange(doc, previousSig, wait) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const located = singlePanel(doc);
    if (!located.ok) return located;
    if (panelSignature(located.panel) !== previousSig) return { ok: true, panel: located.panel };
    if (typeof wait === 'function') await wait();
  }
  return { ok: false, reason: 'birthdate_panel_missing' };
}

async function openBirthDatePanel(doc, input, wait) {
  if (visibleDropdowns(doc).length > 0) return { ok: false, reason: 'birthdate_panel_multiple' };
  if (!pressPicker(doc, input)) return { ok: false, reason: 'birthdate_input_missing' };
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const located = singlePanel(doc);
    if (located.ok) return located;
    if (located.reason === 'birthdate_panel_multiple') return located;
    if (attempt < 7 && typeof wait === 'function') await wait();
  }
  return { ok: false, reason: 'birthdate_panel_missing' };
}

async function driveBirthDatePanel(doc, parsed, wait) {
  let previousSig = '';
  for (let step = 0; step < PICKER_STEP_LIMIT; step += 1) {
    const located = singlePanel(doc);
    if (!located.ok) return located;
    const panel = located.panel;
    const signature = panelSignature(panel);
    if (signature === previousSig) return { ok: false, reason: 'birthdate_panel_missing' };
    previousSig = signature;
    const mode = panelMode(panel);
    if (mode === 'unknown' || mode === 'decade') return { ok: false, reason: 'birthdate_panel_missing' };

    if (mode === 'date') {
      const dateCells = cellsByTitle(panel, parsed.iso);
      if (dateCells.length > 1) return { ok: false, reason: 'birthdate_panel_missing' };
      if (dateCells.length === 1) {
        const clicked = clickCell(doc, dateCells[0]);
        if (clicked === 'disabled') return { ok: false, reason: 'birthdate_cell_disabled' };
        if (clicked !== 'clicked') return { ok: false, reason: 'birthdate_panel_missing' };
        return { ok: true, picked: true };
      }
      const year = readHeaderYear(panel);
      const month = readHeaderMonth(panel);
      if (year == null || month == null) return { ok: false, reason: 'birthdate_panel_missing' };
      if (year !== parsed.year) {
        const button = panel.querySelector('.ant-picker-year-btn');
        if (!button || !pressPicker(doc, button)) return { ok: false, reason: 'birthdate_panel_missing' };
        const changed = await waitForPanelChange(doc, signature, wait);
        if (!changed.ok) return changed;
        continue;
      }
      if (month !== parsed.month) {
        const button = panel.querySelector('.ant-picker-month-btn');
        if (!button || !pressPicker(doc, button)) return { ok: false, reason: 'birthdate_panel_missing' };
        const changed = await waitForPanelChange(doc, signature, wait);
        if (!changed.ok) return changed;
        continue;
      }
      return { ok: false, reason: 'birthdate_cell_missing' };
    }

    if (mode === 'year') {
      const years = visibleYears(panel);
      if (!years.length) return { ok: false, reason: 'birthdate_panel_missing' };
      if (years.includes(parsed.year)) {
        const cells = cellsByTitle(panel, String(parsed.year));
        if (cells.length !== 1) return { ok: false, reason: 'birthdate_panel_missing' };
        const clicked = clickCell(doc, cells[0]);
        if (clicked === 'disabled') return { ok: false, reason: 'birthdate_cell_disabled' };
        if (clicked !== 'clicked') return { ok: false, reason: 'birthdate_panel_missing' };
        const changed = await waitForPanelChange(doc, signature, wait);
        if (!changed.ok) return changed;
        continue;
      }
      const button = parsed.year < Math.min(...years)
        ? panel.querySelector('.ant-picker-header-super-prev-btn')
        : panel.querySelector('.ant-picker-header-super-next-btn');
      if (!button || !pressPicker(doc, button)) return { ok: false, reason: 'birthdate_panel_missing' };
      const changed = await waitForPanelChange(doc, signature, wait);
      if (!changed.ok) return changed;
      continue;
    }

    const monthTitle = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
    const monthCells = cellsByTitle(panel, monthTitle);
    if (monthCells.length > 1) return { ok: false, reason: 'birthdate_panel_missing' };
    if (monthCells.length === 1) {
      const clicked = clickCell(doc, monthCells[0]);
      if (clicked === 'disabled') return { ok: false, reason: 'birthdate_cell_disabled' };
      if (clicked !== 'clicked') return { ok: false, reason: 'birthdate_panel_missing' };
      const changed = await waitForPanelChange(doc, signature, wait);
      if (!changed.ok) return changed;
      continue;
    }
    const headerYear = readHeaderYear(panel);
    const yearButton = panel.querySelector('.ant-picker-year-btn');
    if (yearButton && headerYear != null && headerYear !== parsed.year) {
      if (!pressPicker(doc, yearButton)) return { ok: false, reason: 'birthdate_panel_missing' };
      const changed = await waitForPanelChange(doc, signature, wait);
      if (!changed.ok) return changed;
      continue;
    }
    return { ok: false, reason: 'birthdate_cell_missing' };
  }
  return { ok: false, reason: 'birthdate_panel_missing' };
}

async function fillCmbBirthDatePicker(doc, rawDate, options = {}) {
  const parsed = parseCmbBirthDate(rawDate);
  if (!doc || typeof doc.getElementById !== 'function') {
    return closedPickerResult({ reason: 'birthdate_input_missing', expected: parsed.ok ? parsed.iso : '' });
  }
  if (!parsed.ok) return closedPickerResult({ reason: 'birthdate_unparseable' });
  const input = doc.getElementById(CMB_BIRTHDATE_INPUT_ID);
  if (!input || input.tagName !== 'INPUT') {
    return closedPickerResult({ reason: 'birthdate_input_missing', expected: parsed.iso });
  }
  const before = normalizeCmbBirthDateValue(input.value);
  if (before === parsed.iso) {
    return {
      ok: true,
      status: 'verified',
      reason: 'preexisting_same_value',
      saved: false,
      skippedSave: true,
      saveAllowed: false,
      supported: false,
      liveSupportClaimed: false,
      liveFillClaimed: false,
      inputId: CMB_BIRTHDATE_INPUT_ID,
      before,
      after: before,
      expected: parsed.iso,
      writeAttempted: false
    };
  }
  const wait = typeof options.wait === 'function' ? options.wait : async () => {};
  const opened = await openBirthDatePanel(doc, input, wait);
  if (!opened.ok) {
    pressEscape(doc, input);
    return closedPickerResult({
      reason: opened.reason,
      expected: parsed.iso,
      before,
      after: pickerNorm(input.value),
      writeAttempted: false
    });
  }
  const driven = await driveBirthDatePanel(doc, parsed, wait);
  if (!driven.ok) {
    pressEscape(doc, input);
    return closedPickerResult({
      reason: driven.reason,
      expected: parsed.iso,
      before,
      after: pickerNorm(input.value),
      writeAttempted: true
    });
  }
  await wait();
  const afterPick = normalizeCmbBirthDateValue(input.value);
  if (afterPick !== parsed.iso) {
    pressEscape(doc, input);
    return closedPickerResult({
      reason: 'birthdate_readback_mismatch',
      expected: parsed.iso,
      before,
      after: pickerNorm(input.value),
      writeAttempted: true
    });
  }
  const stillOpen = singlePanel(doc);
  if (stillOpen.ok) pressEscape(doc, input);
  const after = normalizeCmbBirthDateValue(input.value);
  if (after !== parsed.iso) {
    return closedPickerResult({
      reason: 'birthdate_readback_mismatch',
      expected: parsed.iso,
      before,
      after: pickerNorm(input.value),
      writeAttempted: true
    });
  }
  return {
    ok: true,
    status: 'verified',
    reason: 'matched',
    saved: false,
    skippedSave: true,
    saveAllowed: false,
    supported: false,
    liveSupportClaimed: false,
    liveFillClaimed: false,
    inputId: CMB_BIRTHDATE_INPUT_ID,
    before,
    after,
    expected: parsed.iso,
    writeAttempted: true
  };
}
/* CMB_BIRTHDATE_PICKER_END */

export {
  CMB_BIRTHDATE_INPUT_ID,
  CMB_BIRTHDATE_FILL_FAIL_REASONS,
  parseCmbBirthDate,
  normalizeCmbBirthDateValue,
  fillCmbBirthDatePicker
};
