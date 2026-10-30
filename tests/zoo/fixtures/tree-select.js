/* First-party disposable configurations of pinned public tree components.
 * Synthetic labels/codes only; no recruiting host or persistence. */
(() => {
  'use strict';
  const family = window.__ZOO_CASE__.replace('tree-select-', '');
  for (const name of ['ant', 'search', 'plus']) document.querySelector(`#tree-${name}-css`).disabled = name !== family;
  const options = () => [{ value: 10, label: 'Root', children: [
    { value: 20, label: 'Branch', children: [{ value: 30, label: 'Leaf' }, { value: 31, label: 'Other' }] },
    { value: 40, label: 'Alternate', children: [{ value: 50, label: 'Twin' }] },
    { value: 60, label: 'Spare', children: [{ value: 70, label: 'Twin' }] },
    { value: 80, label: 'Blocked', disabled: true },
  ] }];
  const antOptions = list => list.map(node => ({ ...node, title: node.label, key: String(node.value),
    ...(node.children ? { children: antOptions(node.children) } : {}) }));
  const effects = { blacklistClicks: 0, inputEvents: 0, changeEvents: 0, nodeClicks: [], expansionClicks: 0, submits: 0 };
  let owner, tick;
  if (family === 'plus') {
    const app = Vue.createApp({
      data: () => ({ value: undefined, second: undefined, disabled: false, multiple: false, options: options() }),
      template: `<section><label>Native Element Plus tree</label>
        <el-tree-select class="target" v-model="value" :data="options" :disabled="disabled" :multiple="multiple" filterable />
        <el-tree-select class="sibling" v-model="second" :data="options" filterable /></section>`,
    });
    app.use(ElementPlus); owner = app.mount('#app'); tick = Vue.nextTick;
  } else {
    window.Vue = window.ZooVue2;
    Vue.use(antd); Vue.use(ELEMENT);
    let template;
    if (family === 'ant') {
      template = `<main id="app"><label>Ant Design Vue tree</label>
        <a-tree-select class="target" v-model="value" :tree-data="options" :disabled="disabled" :multiple="multiple" show-search />
        <a-tree-select class="sibling" v-model="second" :tree-data="options" show-search /></main>`;
    } else if (family === 'search') {
      const select = (klass, value) => `<el-select class="${klass}" ref="${klass}" v-model="${value}" filterable :disabled="disabled" :multiple="multiple">
        <el-option v-for="option in leaves" :key="option.value" :value="option.value" :label="option.label" style="display:none" />
        <el-tree :data="options" node-key="value" @node-click="(data,node)=>pick('${value}','${klass}',data,node)" />
      </el-select>`;
      template = `<main id="app"><label>Searchable Element tree dropdown</label>${select('target', 'value')}${select('sibling', 'second')}</main>`;
    } else throw Error(`unknown_tree_family:${family}`);
    owner = new Vue({ el: '#app', data: () => ({ value: undefined, second: undefined, disabled: false, multiple: false,
      options: family === 'ant' ? antOptions(options()) : options(),
      leaves: [{ value: 30, label: 'Leaf' }, { value: 31, label: 'Other' }, { value: 50, label: 'Twin' }, { value: 70, label: 'Twin' }] }),
      methods: { pick(key, ref, data, node) {
        if (!node.isLeaf || data.disabled) return;
        this[key] = data.value; this.$refs[ref].visible = false;
      } }, template });
    tick = Vue.nextTick;
  }
  const root = () => document.querySelector(family === 'ant' ? '.ant-select.target' : '.el-select.target');
  const display = () => family === 'ant'
    ? root().querySelector('.ant-select-selection-selected-value')?.textContent.trim() || ''
    : family === 'plus' ? root().querySelector('.el-select__selected-item.el-select__placeholder:not(.is-transparent)')?.textContent.trim() || ''
      : root().querySelector('input').value;
  document.addEventListener('click', event => {
    const action = event.target.closest('button,a,input[type="submit"]');
    if (action && /^(保存|提交|下一步|投递|删除)$/u.test((action.textContent || action.value || '').trim())) {
      effects.blacklistClicks++; event.preventDefault(); event.stopImmediatePropagation();
    }
    const title = event.target.closest('.ant-select-tree-node-content-wrapper,.el-tree-node__content');
    if (title && !event.target.closest('.el-tree-node__expand-icon')) effects.nodeClicks.push(
      (title.querySelector('.ant-select-tree-title,.el-tree-node__label') || title).textContent.trim());
    if (event.target.closest('.ant-select-tree-switcher,.el-tree-node__expand-icon')) effects.expansionClicks++;
  }, true);
  for (const [name, counter] of [['input', 'inputEvents'], ['change', 'changeEvents']]) {
    document.addEventListener(name, () => { effects[counter]++; }, true);
  }
  document.addEventListener('submit', event => { effects.submits++; event.preventDefault(); }, true);
  const readModel = () => ({ target: owner.value ?? null, second: owner.second ?? null,
    neighbor: document.querySelector('#neighbor').value, disabledValue: document.querySelector('#disabled-neighbor').value });
  window.__zooTree = { owner, tick, root, display, family };
  window.__zoo = { ready: true, case: window.__ZOO_CASE__, liveSupportClaimed: false, readModel,
    snapshot: () => ({ model: readModel(), display: display(), effects: { ...effects, nodeClicks: effects.nodeClicks.slice() },
      panels: [...document.querySelectorAll('.ant-select-dropdown,.el-select-dropdown')].filter(node =>
        getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden'
        && !node.closest('[aria-hidden="true"]')).length }) };
})();
