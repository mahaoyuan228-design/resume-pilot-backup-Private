/* Disposable generic controls with pinned Vue libraries and synthetic facts.
 * No captured site markup, network fallback or live compatibility claim. */
(() => {
  'use strict';
  const name = window.__ZOO_CASE__, app = document.querySelector('#app');
  const effects = { blacklistClicks: 0, inputEvents: 0, changeEvents: 0, dayClicks: 0, navigationClicks: 0, submits: 0 };
  let owner = null;
  const native = (id, attributes = '') => `<fieldset id="${id}" data-date-range><legend>${id}</legend><input type="date" ${attributes}><input type="date" ${attributes}></fieldset>`;
  if (name === 'date-range-native') {
    app.innerHTML = `<form>${native('target')}${native('limits', 'min="2024-02-01" max="2024-02-29" step="2"')}
      ${native('readonly', 'readonly')}${native('disabled', 'disabled')}${native('existing')}
      <fieldset id="ambiguous" data-date-range><input type="date"><input type="date"><input type="date"></fieldset>
      <fieldset id="partial" data-date-range><input type="date" value="2024-02-10"><input type="date"></fieldset>
    </form>`;
    document.querySelector('#existing input').value = '2023-01-01';
  } else {
    Vue.use(antd);
    const ant = name.startsWith('date-range-ant-'), pair = name.startsWith('date-range-pair-');
    let template;
    if (pair) {
      const part = name.endsWith('-ant')
        ? `<a-date-picker v-model="value[INDEX]" format="YYYY-MM-DD" value-format="YYYY-MM-DD" :input-read-only="true" :default-picker-value="antDefault"/>`
        : `<el-date-picker v-model="value[INDEX]" type="date" format="yyyy-MM-dd" value-format="yyyy-MM-dd" :editable="false" :default-value="elDefault"/>`;
      template = `<fieldset id="target" data-date-range><legend>Start and end calendars</legend>${part.replace('INDEX', '0')}${part.replace('INDEX', '1')}</fieldset>`;
    } else if (ant) {
      const props = name.endsWith('-explicit') ? 'format="YYYY-MM-DD" value-format="YYYY-MM-DD"'
        : name.endsWith('-format') ? 'format="YYYY/MM/DD"' : '';
      template = `<div id="target"><a-range-picker v-model="value" :input-read-only="true" :default-picker-value="antDefaults" ${props}/></div>`;
    } else {
      const props = name.endsWith('-explicit') ? 'format="yyyy-MM-dd" value-format="yyyy-MM-dd" :unlink-panels="true"'
        : name.endsWith('-format') ? 'format="yyyy/MM/dd"' : '';
      template = `<div id="target"><el-date-picker v-model="value" type="daterange" :editable="false" :default-value="elDefault" ${props}/></div>`;
    }
    owner = new Vue({ el: '#app',
      data: { value: pair ? ['', ''] : null, antDefault: moment('2023-12-01'),
        antDefaults: name.endsWith('-explicit') ? [moment('2024-01-01'), moment('2024-04-01')]
          : [moment('2024-02-01'), moment('2024-03-01')],
        elDefault: name.endsWith('-explicit') ? [new Date(2024, 0, 1), new Date(2024, 3, 1)]
          : pair ? new Date(2023, 11, 1) : new Date(2024, 1, 1) },
      template: `<main id="app">${template}</main>`,
    });
  }
  document.addEventListener('click', event => {
    const action = event.target.closest('button,a,input[type="submit"]');
    if (action && /^(保存|提交|下一步|投递|删除)$/u.test((action.textContent || action.value || '').trim())) {
      effects.blacklistClicks++; event.preventDefault(); event.stopImmediatePropagation();
    }
    if (event.target.closest('.ant-calendar-cell,.el-date-table td')) effects.dayClicks++;
    if (event.target.closest('.ant-calendar-prev-month-btn,.ant-calendar-next-month-btn,.ant-calendar-prev-year-btn,.ant-calendar-next-year-btn,.el-picker-panel__icon-btn,.el-date-picker__prev-btn,.el-date-picker__next-btn')) effects.navigationClicks++;
  }, true);
  for (const [event, key] of [['input', 'inputEvents'], ['change', 'changeEvents']]) {
    document.addEventListener(event, () => { effects[key]++; }, true);
  }
  document.addEventListener('submit', event => { effects.submits++; event.preventDefault(); }, true);
  const canonical = value => value?._isAMomentObject ? value.format('YYYY-MM-DD')
    : value instanceof Date ? [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-')
      : value ?? '';
  const inputs = () => [...document.querySelectorAll('#target input')];
  const readModel = () => ({ target: owner ? Array.isArray(owner.value) ? owner.value.map(canonical) : owner.value : inputs().map(input => input.value),
    modelKinds: owner && Array.isArray(owner.value) ? owner.value.map(value => value?._isAMomentObject ? 'moment' : value instanceof Date ? 'date' : typeof value) : [],
    neighbor: document.querySelector('#neighbor').value, disabledValue: document.querySelector('#disabled-neighbor').value });
  window.__zoo = { ready: true, case: name, liveSupportClaimed: false, readModel,
    snapshot: () => ({ model: readModel(), effects: { ...effects }, values: inputs().map(input => input.value),
      calendars: [...document.querySelectorAll('.ant-calendar-picker-container,.el-picker-panel')].filter(node =>
        getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden').length }) };
})();
