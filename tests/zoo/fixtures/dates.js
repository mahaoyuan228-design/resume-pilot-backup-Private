/* First-party synthetic date phenomena, without tenant or resume-field IDs.
 * My97 is an editable-input contract replay; Ant uses the pinned library.
 * No captured page, real save/submit, or claim of live compatibility. */
(() => {
  'use strict';
  const name = window.__ZOO_CASE__, app = document.querySelector('#app');
  const effects = { blacklistClicks: 0, pickerCalls: 0, inputEvents: 0, changeEvents: 0, submits: 0 };
  const values = {};
  let ant = null;
  // A detector may inspect the function's existence. Calling it opens UI and
  // is deliberately forbidden in this editable-input replay.
  window.WdatePicker = function () { effects.pickerCalls++; throw Error('offline_picker_call_forbidden'); };
  const my97 = (id, format, extra = '') => `<label>${id}<input id="${id}" class="Wdate" onfocus="WdatePicker({dateFmt:'${format}'})" ${extra}></label>`;
  if (name === 'dates-native') {
    app.innerHTML = `<form>
      <label>Date<input id="target" type="date"></label><label>Month<input id="month" type="month"></label>
      <input id="limits" type="date" min="2024-02-01" max="2024-02-29" step="2">
      <input id="month-limits" type="month" min="2024-01" max="2024-12" step="2">
      <input id="readonly" type="date" readonly><input id="disabled" type="date" disabled>
      <input id="existing" type="date" value="2023-01-01">
    </form>`;
  } else if (name === 'dates-my97') {
    app.innerHTML = `<form>${my97('target', 'yyyy-MM-dd')}${my97('datetime', 'yyyy-MM-dd HH:mm:ss')}
      ${my97('existing', 'yyyy-MM-dd', 'value="2023-01-01"')}</form>`;
  } else if (name === 'dates-my97-manual') {
    app.innerHTML = `<form>${my97('readonly', 'yyyy-MM-dd', 'readonly')}${my97('disabled', 'yyyy-MM-dd', 'disabled')}
      ${my97('format', 'dd/MM/yyyy')}
      <input id="dynamic" class="Wdate" onfocus="WdatePicker({dateFmt:window.dateFormat})">
      <input id="callback" class="Wdate" onfocus="WdatePicker({dateFmt:'yyyy-MM-dd',onpicked:window.onpicked})">
      <input id="cross-target" class="Wdate" onfocus="WdatePicker({dateFmt:'yyyy-MM-dd',el:'neighbor'})">
      <input id="constraint" class="Wdate" onfocus="WdatePicker({dateFmt:'yyyy-MM-dd',minDate:'2024-01-01'})">
      <input id="unknown" class="Wdate"><input id="custom" class="custom-date-picker" readonly>
    </form>`;
  } else if (['dates-ant-default', 'dates-ant-explicit', 'dates-ant-format'].includes(name)) {
    app.innerHTML = '<div id="ant-mount"></div>';
    Vue.use(antd);
    ant = new Vue({
      el: '#ant-mount', data: { value: name === 'dates-ant-explicit' ? '' : null },
      template: `<div><label>Generic month</label><a-month-picker id="target" v-model="value" :input-read-only="true" ${
        name === 'dates-ant-explicit' ? 'format="YYYY-MM" value-format="YYYY-MM"'
          : name === 'dates-ant-format' ? 'format="YYYY/MM"' : ''} /></div>`,
    });
  } else throw Error(`unknown_date_case:${name}`);
  for (const input of app.querySelectorAll('input')) values[input.id] = input.value;
  document.addEventListener('click', event => {
    const action = event.target.closest('button,a,input[type="submit"]');
    if (action && /^(保存|提交|下一步|投递|删除)$/u.test((action.textContent || action.value || '').trim())) {
      effects.blacklistClicks++; event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
  for (const [eventName, counter] of [['input', 'inputEvents'], ['change', 'changeEvents']]) {
    document.addEventListener(eventName, event => {
      effects[counter]++;
      if (!ant && event.target instanceof HTMLInputElement && app.contains(event.target)) values[event.target.id] = event.target.value;
    }, true);
  }
  document.addEventListener('submit', event => { effects.submits++; event.preventDefault(); }, true);
  const readModel = () => ({ ...values,
    ...(ant ? { target: ant.value?._isAMomentObject ? ant.value.format('YYYY-MM') : ant.value,
      momentBacked: !!ant.value?._isAMomentObject } : {}),
    neighbor: document.querySelector('#neighbor').value,
    disabledValue: document.querySelector('#disabled-neighbor').value });
  window.__zoo = { ready: true, case: name, liveSupportClaimed: false, readModel,
    snapshot: () => ({ model: readModel(), effects: { ...effects },
      values: [...app.querySelectorAll('input')].map(input => ({ id: input.id, value: input.value })),
      calendars: [...document.querySelectorAll('.ant-calendar-picker-container')].filter(node =>
        getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden').length }) };
})();
