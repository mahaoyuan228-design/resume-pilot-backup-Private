// First-party component configuration: native inputs and pinned Vue libraries.
// Disposable local values only; no live page, field IDs or persistence.
(() => {
  'use strict';
  const name = window.__ZOO_CASE__, app = document.querySelector('#app');
  const effects = { blacklistClicks: 0, inputEvents: 0, changeEvents: 0, panelClicks: 0, submits: 0 };
  const values = {};
  let owner = null;
  if (name === 'time-native') {
    app.innerHTML = `<form>
      <label>Minute<input id="target" type="time"></label><input id="seconds" type="time" step="1">
      <input id="limits" type="time" min="09:00" max="17:00" step="900">
      <input id="readonly" type="time" readonly><input id="disabled" type="time" disabled>
      <input id="existing" type="time" value="08:15">
    </form>`;
  } else if (/^time-(?:ant|el)-(?:default|explicit|format)$/u.test(name)) {
    const ant = name.startsWith('time-ant-'), explicit = name.endsWith('-explicit');
    const format = name.endsWith('-format') ? 'hh:mm A' : 'HH:mm';
    Vue.use(ant ? antd : ELEMENT);
    app.innerHTML = '<div id="mount"></div>';
    owner = new Vue({
      el: '#mount', data: { value: explicit ? '' : null },
      template: ant
        ? `<div><label>Generic time</label><a-time-picker id="target" v-model="value" format="${format}" ${explicit ? 'value-format="HH:mm"' : ''} /></div>`
        : `<div><label>Generic time</label><el-time-picker id="target" v-model="value" format="${format}" ${explicit ? 'value-format="HH:mm"' : ''} /></div>`,
    });
  } else if (name === 'time-unknown') {
    app.innerHTML = '<div class="custom-time-picker"><input id="target"></div>';
  } else throw Error(`unknown_time_case:${name}`);
  for (const input of app.querySelectorAll('input[id]')) values[input.id] = input.value;
  document.addEventListener('click', event => {
    if (event.target.closest('.ant-time-picker-panel-select li,.el-time-spinner__item')) effects.panelClicks++;
    const action = event.target.closest('button,a,input[type="submit"]');
    if (action && /^(保存|提交|下一步|投递|删除)$/u.test((action.textContent || action.value || '').trim())) {
      effects.blacklistClicks++; event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
  for (const [eventName, counter] of [['input', 'inputEvents'], ['change', 'changeEvents']]) {
    document.addEventListener(eventName, event => {
      effects[counter]++;
      if (!owner && event.target instanceof HTMLInputElement && app.contains(event.target)) values[event.target.id] = event.target.value;
    }, true);
  }
  document.addEventListener('submit', event => { effects.submits++; event.preventDefault(); }, true);
  const canonical = value => value?._isAMomentObject ? value.format('HH:mm')
    : value instanceof Date ? `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}` : value;
  const readModel = () => ({ ...values,
    ...(owner ? { target: canonical(owner.value), modelKind: owner.value?._isAMomentObject ? 'moment'
      : owner.value instanceof Date ? 'date' : typeof owner.value } : {}),
    neighbor: document.querySelector('#neighbor').value,
    disabledValue: document.querySelector('#disabled-neighbor').value });
  window.__zoo = { ready: true, case: name, liveSupportClaimed: false, readModel,
    snapshot: () => ({ model: readModel(), effects: { ...effects },
      values: [...app.querySelectorAll('input')].map(input => ({ id: input.id, value: input.value })),
      panels: [...document.querySelectorAll('.ant-time-picker-panel,.el-time-panel')].filter(node =>
        getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden').length }) };
})();
