/* Disposable pinned public transfers; synthetic values and local assets only. */
(() => {
  'use strict';
  const family = window.__ZOO_CASE__.replace('transfer-', '');
  for (const name of ['ant', 'element']) document.querySelector(`#transfer-${name}-css`).disabled = name !== family;
  Vue.use(antd); Vue.use(ELEMENT);
  const options = [
    { key: 'a', label: 'Alpha', title: 'Alpha' }, { key: 'b', label: 'Beta', title: 'Beta' },
    { key: 'keep', label: 'Keep', title: 'Keep' }, { key: 'blocked', label: 'Blocked', title: 'Blocked', disabled: true },
    { key: 'twin1', label: 'Twin', title: 'Twin' }, { key: 'twin2', label: 'Twin', title: 'Twin' },
  ];
  const markup = (name, key, attributes = '') => `<div class="transfer-row" ${name === 'hidden' ? 'hidden' : ''}>
    <label>${family} ${name} transfer</label>${family === 'ant'
      ? `<a-transfer id="transfer-${name}" :data-source="options" :target-keys="${key}" :render="item => item.title" :lazy="false"
          @change="keys => ${key} = keys" ${attributes} />`
      : `<el-transfer id="transfer-${name}" :data="options" v-model="${key}" ${attributes} />`}</div>`;
  const owner = new Vue({ el: '#app', data: () => ({ options, value: ['keep'], second: ['keep'],
    disabled: ['keep'], readonly: ['keep'], hidden: ['keep'] }),
    template: `<section>${markup('target', 'value')}${markup('second', 'second')}
      ${markup('disabled', 'disabled', 'disabled')}${markup('readonly', 'readonly', 'aria-readonly="true"')}
      ${markup('hidden', 'hidden')}</section>` });
  const root = (name = 'target') => document.getElementById(`transfer-${name}`);
  const panels = () => [...root().querySelectorAll(family === 'ant' ? '.ant-transfer-list' : '.el-transfer-panel')];
  const labelSelector = family === 'ant' ? '.ant-transfer-list-content-item-text' : '.el-checkbox__label';
  const display = () => [...panels()[1].querySelectorAll(family === 'ant' ? '.ant-transfer-list-content-item' : '.el-transfer-panel__item')]
    .map(row => row.querySelector(labelSelector)?.textContent.trim() || '');
  const effects = { blacklistClicks: 0, submits: 0, rowClicks: 0, moveClicks: 0 };
  document.addEventListener('click', event => {
    const action = event.target.closest('button,a,[role="button"],input[type="submit"]');
    if (action && /^(保存|提交|下一步|投递|删除)$/u.test((action.textContent || action.value || '').trim())) {
      effects.blacklistClicks++; event.preventDefault(); event.stopImmediatePropagation();
    }
    if (!root().contains(event.target)) return;
    if (event.target.closest('.el-transfer-panel__item,.ant-transfer-list-content-item')) effects.rowClicks++;
    if (event.target.closest('.el-transfer__buttons button,.ant-transfer-operation button')) effects.moveClicks++;
  }, true);
  document.addEventListener('submit', event => { effects.submits++; event.preventDefault(); }, true);
  const readModel = () => ({ target: [...owner.value], second: [...owner.second], disabled: [...owner.disabled],
    readonly: [...owner.readonly], hidden: [...owner.hidden], neighbor: document.getElementById('neighbor').value,
    disabledValue: document.getElementById('disabled-neighbor').value });
  window.__zooTransfer = { owner, root, display, panels, labelSelector, family, tick: Vue.nextTick };
  window.__zoo = { ready: true, case: window.__ZOO_CASE__, liveSupportClaimed: false, readModel,
    snapshot: () => ({ model: readModel(), display: display(), effects: { ...effects } }) };
})();
