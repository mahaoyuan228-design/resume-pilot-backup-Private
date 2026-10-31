// Harvested markup with fictional offline event handlers. This fixture proves
// adapter behavior against the captured DOM; it makes no live support claim.
import fs from 'node:fs';

export const harvestedDates = JSON.parse(fs.readFileSync(new URL('./cms-education-harvest-dates.json', import.meta.url), 'utf8'));

export function installHarvestedDates(window, { rowIndex = 0, initial = {}, onCommit = () => {} } = {}) {
  const { document } = window;
  const state = { values: {}, opens: 0, selections: 0, navigation: [], headerSelections: 0 };
  let portal = null;
  let current = null;
  let monthNumber = null;
  let initialMonth = null;
  const inputFor = key => document.getElementById(harvestedDates.fields[key].wrapperId.replace(/_0$/u, `_${rowIndex}`)).querySelector('input.ant-calendar-picker-input');
  const close = () => { portal?.remove(); portal = null; current = null; };
  const canonical = date => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  function bindDays() {
    for (const day of portal.querySelectorAll('.ant-calendar-cell > .ant-calendar-date')) day.addEventListener('click', () => {
      if (day.getAttribute('aria-disabled') === 'true' || day.closest('.ant-calendar-disabled-cell')) return;
      const title = day.closest('.ant-calendar-cell').getAttribute('title');
      const match = /^(\d{4})年(\d{1,2})月(\d{1,2})日$/u.exec(title || '');
      if (!match) return;
      const value = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
      const key = current;
      state.values[key] = value;
      inputFor(key).value = value;
      state.selections += 1;
      onCommit(key, value);
      close();
    });
  }
  function render() {
    const field = harvestedDates.fields[current];
    portal.innerHTML = field.panelHTML.replace(/^<div[^>]*>/u, '').replace(/<\/div>\s*$/u, '');
    const panel = portal.querySelector('.ant-calendar-date-panel');
    const year = Math.floor(monthNumber / 12);
    const month = monthNumber % 12 + 1;
    panel.querySelector('.ant-calendar-year-select').textContent = `${year}年`;
    panel.querySelector('.ant-calendar-month-select').textContent = `${month}月`;
    const tbody = panel.querySelector('.ant-calendar-tbody');
    if (monthNumber === initialMonth) tbody.innerHTML = `<tr>${field.cellsHTML.join('')}</tr>`;
    else {
      // Fictional navigation generates dates with the same harvested td/div
      // structure. No year/month selector panel is manufactured or exercised.
      const first = new Date(Date.UTC(year, month - 1, 1));
      const offset = (first.getUTCDay() + 6) % 7;
      const cells = [];
      for (let index = 0; index < 42; index += 1) {
        const date = new Date(Date.UTC(year, month - 1, index - offset + 1));
        const title = `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
        cells.push(`<td role="gridcell" title="${title}" class="ant-calendar-cell"><div class="ant-calendar-date" aria-selected="${canonical(date) === state.values[current]}" aria-disabled="false">${date.getUTCDate()}</div></td>`);
      }
      tbody.innerHTML = Array.from({ length: 6 }, (_, index) => `<tr role="row">${cells.slice(index * 7, index * 7 + 7).join('')}</tr>`).join('');
    }
    for (const direction of ['prev', 'next']) for (const unit of ['year', 'month']) {
      const control = panel.querySelector(`.ant-calendar-${direction}-${unit}-btn`);
      control.addEventListener('click', () => {
        state.navigation.push(`${direction}-${unit}`);
        monthNumber += (direction === 'prev' ? -1 : 1) * (unit === 'year' ? 12 : 1);
        render();
      });
    }
    for (const selector of ['.ant-calendar-year-select', '.ant-calendar-month-select']) panel.querySelector(selector).addEventListener('click', () => { state.headerSelections += 1; });
    bindDays();
  }
  for (const [key, field] of Object.entries(harvestedDates.fields)) {
    const wrapper = document.getElementById(field.wrapperId.replace(/_0$/u, `_${rowIndex}`));
    if (!wrapper) throw new Error(`harvest_fixture_wrapper_missing:${key}`);
    wrapper.innerHTML = field.itemHTML;
    state.values[key] = initial[key] ?? field.originalValue;
    const input = inputFor(key);
    input.value = state.values[key];
    input.addEventListener('click', () => {
      close();
      current = key;
      state.opens += 1;
      const original = state.values[key] || field.originalValue;
      initialMonth = Number(field.originalValue.slice(0, 4)) * 12 + Number(field.originalValue.slice(5, 7)) - 1;
      monthNumber = Number(original.slice(0, 4)) * 12 + Number(original.slice(5, 7)) - 1;
      portal = document.createElement('div');
      portal.className = field.panelClass;
      document.body.append(portal);
      render();
    });
  }
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  document.body.addEventListener('mousedown', event => { if (event.target === document.body) close(); });
  return { inputFor, close, snapshot: () => ({ ...state, values: { ...state.values }, navigation: [...state.navigation], portalOpen: !!portal }) };
}
