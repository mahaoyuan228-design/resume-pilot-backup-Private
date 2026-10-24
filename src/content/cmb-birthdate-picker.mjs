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
  'birthdate_target_ambiguous',
  'birthdate_panel_missing',
  'birthdate_panel_multiple',
  'birthdate_cell_missing',
  'birthdate_cell_disabled',
  'birthdate_readback_mismatch'
]);
const BIRTH_DATE_RE = /^(\d{4})([-/])(\d{2})\2(\d{2})$/u;
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
  const month = Number(match[3]);
  const day = Number(match[4]);
  if (year < 1900 || year > 2100) return { ok: false, reason: 'birthdate_unparseable', iso: '' };
  const iso = `${match[1]}-${match[3]}-${match[4]}`;
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
  return pickerNorm(`${el.textContent || ''} ${value} ${aria}`);
}

function isSaveLike(el) {
  const text = saveLikeText(el);
  if (/保存|提交|删除|投递|下一步|下一页|\b(?:save|submit|delete|deliver)\b/iu.test(text)) return true;
  return [el?.textContent, el?.getAttribute?.('aria-label'), el?.value]
    .some((value) => /^next(?:step|page)?$/iu.test(pickerNorm(value).replace(/\s+/gu, '')));
}

function pickerNodeUnavailable(el) {
  if (!el || el.isConnected === false) return true;
  for (let node = el; node; node = node.parentElement) {
    if (node.disabled === true || node.getAttribute?.('aria-disabled') === 'true') return true;
    if (node.hasAttribute?.('hidden') || node.hasAttribute?.('inert') || node.getAttribute?.('aria-hidden') === 'true') return true;
    const style = node.ownerDocument?.defaultView?.getComputedStyle?.(node) || node.style;
    if (style?.display === 'none' || style?.visibility === 'hidden' || style?.visibility === 'collapse') return true;
  }
  return false;
}

function isUnsafeClick(el) {
  if (pickerNodeUnavailable(el) || isSaveLike(el)) return true;
  for (let node = el; node; node = node.parentElement) {
    if (node.tagName === 'A' && node.hasAttribute('href')) return true;
    if (node.tagName === 'LABEL' && node.control) {
      const control = node.control;
      const type = String(control.getAttribute('type') || '').toLowerCase();
      if (!node.contains(control) || control.tagName === 'BUTTON'
          || ['submit', 'image', 'button', 'reset', 'file'].includes(type)
          || pickerNodeUnavailable(control) || isSaveLike(control)) return true;
      // A label can activate its associated control after a descendant click.
      // Only a direct control click or the validated radio wrapper may do so.
      if (node !== el && control !== el && !control.contains(el)) return true;
    }
    if (node.tagName === 'BUTTON') {
      const type = String(node.getAttribute('type') || '').toLowerCase();
      if (type !== 'button' || isSaveLike(node)) return true;
    }
    if (node.getAttribute?.('role') === 'button' && isSaveLike(node)) return true;
  }
  if (el.tagName === 'INPUT') {
    const type = String(el.getAttribute('type') || 'text').toLowerCase();
    if (['submit', 'image', 'button', 'reset', 'file', 'hidden'].includes(type)) return true;
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
  if (isUnsafeClick(el)) return false;
  dispatchMouse(doc, el, 'mouseup');
  if (isUnsafeClick(el)) return false;
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
    return !pickerNodeUnavailable(node);
  });
}

function singlePanel(doc) {
  const open = visibleDropdowns(doc);
  if (open.length === 0) return { ok: false, reason: 'birthdate_panel_missing' };
  if (open.length > 1) return { ok: false, reason: 'birthdate_panel_multiple' };
  const panels = pickerNodes(open[0], '.ant-picker-panel');
  if (panels.length > 1) return { ok: false, reason: 'birthdate_panel_multiple' };
  const panel = panels[0] || open[0];
  const modes = pickerNodes(panel, '.ant-picker-decade-panel, .ant-picker-year-panel, .ant-picker-month-panel, .ant-picker-date-panel');
  if (modes.length > 1) return { ok: false, reason: 'birthdate_panel_multiple' };
  return { ok: true, panel: modes[0] || panel };
}

function pickerNodes(panel, selector) {
  return [...panel.querySelectorAll(selector)].filter((node) => !pickerNodeUnavailable(node));
}

function singlePickerNode(panel, selector) {
  const nodes = pickerNodes(panel, selector);
  return nodes.length === 1 ? nodes[0] : null;
}

function cellsByTitle(panel, title) {
  return pickerNodes(panel, '.ant-picker-cell').filter((cell) => cell.getAttribute('title') === title);
}

function clickCell(doc, cell) {
  if (!cell) return 'missing';
  if (cell.classList.contains('ant-picker-cell-disabled')) return 'disabled';
  const inners = pickerNodes(cell, '.ant-picker-cell-inner');
  if (inners.length > 1) return 'unsafe';
  const inner = inners[0];
  const target = inner || cell;
  if (isUnsafeClick(target)) return 'unsafe';
  return pressPicker(doc, target) ? 'clicked' : 'unsafe';
}

function readHeaderYear(panel) {
  const button = singlePickerNode(panel, '.ant-picker-year-btn');
  if (!button) return null;
  const match = pickerNorm(button.textContent).match(/^(\d{4})(?:年)?$/u);
  if (!match) return null;
  const year = Number(match[1]);
  return year >= 1900 && year <= 2100 ? year : null;
}

function readHeaderMonth(panel) {
  const button = singlePickerNode(panel, '.ant-picker-month-btn');
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
  return pickerNodes(panel, '.ant-picker-cell')
    .map((cell) => cell.getAttribute('title') || '')
    .filter((title) => /^\d{4}$/u.test(title))
    .map((title) => Number(title));
}

function panelMode(panel) {
  if (panel.matches('.ant-picker-decade-panel')) return 'decade';
  if (panel.matches('.ant-picker-year-panel')) return 'year';
  if (panel.matches('.ant-picker-month-panel')) return 'month';
  if (panel.matches('.ant-picker-date-panel')) return 'date';
  if (singlePickerNode(panel, '.ant-picker-year-btn') && singlePickerNode(panel, '.ant-picker-month-btn')) return 'date';
  if (singlePickerNode(panel, '.ant-picker-decade-btn')) return 'year';
  const titles = pickerNodes(panel, '.ant-picker-cell').map((cell) => cell.getAttribute('title') || '');
  if (titles.some((title) => /^\d{4}-\d{2}-\d{2}$/u.test(title))) return 'date';
  if (titles.some((title) => /^\d{4}-\d{2}$/u.test(title))) return 'month';
  if (titles.some((title) => /^\d{4}$/u.test(title))) return 'year';
  return 'unknown';
}

function panelSignature(panel) {
  const titles = pickerNodes(panel, '.ant-picker-cell')
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
    const target = assessCmbBirthDatePickerTarget(doc);
    if (!target.ok) return { ok: false, reason: target.reason };
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
        const button = singlePickerNode(panel, '.ant-picker-year-btn');
        if (!button || !pressPicker(doc, button)) return { ok: false, reason: 'birthdate_panel_missing' };
        const changed = await waitForPanelChange(doc, signature, wait);
        if (!changed.ok) return changed;
        continue;
      }
      if (month !== parsed.month) {
        const button = singlePickerNode(panel, '.ant-picker-month-btn');
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
        ? singlePickerNode(panel, '.ant-picker-header-super-prev-btn')
        : singlePickerNode(panel, '.ant-picker-header-super-next-btn');
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
    const yearButton = singlePickerNode(panel, '.ant-picker-year-btn');
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

function classifyCmbBirthDatePickerTarget(snapshot) {
  const count = Number(snapshot?.count);
  const oneInput = count === 1 && snapshot?.input === true;
  if (oneInput) return { count: 1, unique: true, reason: null };
  if (Number.isFinite(count) && count > 1) {
    return { count, unique: false, reason: 'birthdate_target_ambiguous' };
  }
  return { count: 0, unique: false, reason: 'birthdate_input_missing' };
}

function assessCmbBirthDatePickerTarget(doc) {
  if (!doc || typeof doc.querySelectorAll !== 'function') {
    return { ...classifyCmbBirthDatePickerTarget({ count: 0, input: false }), ok: false, node: null };
  }
  const nodes = [...doc.querySelectorAll(`[id="${CMB_BIRTHDATE_INPUT_ID}"]`)];
  const input = nodes.length === 1 && nodes[0].tagName === 'INPUT'
    && nodes[0].type === 'text' && !isUnsafeClick(nodes[0]);
  const classified = classifyCmbBirthDatePickerTarget({ count: nodes.length, input });
  return {
    ...classified,
    ok: classified.unique === true,
    node: classified.unique === true ? nodes[0] : null
  };
}

async function fillCmbBirthDatePicker(doc, rawDate, options = {}) {
  const parsed = parseCmbBirthDate(rawDate);
  if (!parsed.ok) return closedPickerResult({ reason: 'birthdate_unparseable' });
  const target = assessCmbBirthDatePickerTarget(doc);
  if (!target.ok) {
    return closedPickerResult({ reason: target.reason, expected: parsed.iso });
  }
  const input = target.node;
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
  const pickedTarget = assessCmbBirthDatePickerTarget(doc);
  if (!pickedTarget.ok) {
    pressEscape(doc, input);
    return closedPickerResult({
      reason: pickedTarget.reason,
      expected: parsed.iso,
      before,
      writeAttempted: true
    });
  }
  const pickedInput = pickedTarget.node;
  const afterPick = normalizeCmbBirthDateValue(pickedInput.value);
  if (afterPick !== parsed.iso) {
    pressEscape(doc, input);
    return closedPickerResult({
      reason: 'birthdate_readback_mismatch',
      expected: parsed.iso,
      before,
      after: pickerNorm(pickedInput.value),
      writeAttempted: true
    });
  }
  const stillOpen = singlePanel(doc);
  if (stillOpen.ok) pressEscape(doc, pickedInput);
  const verifiedTarget = assessCmbBirthDatePickerTarget(doc);
  if (!verifiedTarget.ok) {
    return closedPickerResult({
      reason: verifiedTarget.reason,
      expected: parsed.iso,
      before,
      writeAttempted: true
    });
  }
  const after = normalizeCmbBirthDateValue(verifiedTarget.node.value);
  if (after !== parsed.iso) {
    return closedPickerResult({
      reason: 'birthdate_readback_mismatch',
      expected: parsed.iso,
      before,
      after: pickerNorm(verifiedTarget.node.value),
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
  classifyCmbBirthDatePickerTarget,
  assessCmbBirthDatePickerTarget,
  fillCmbBirthDatePicker
};
