import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const vendors = {
  ant: ['vue/dist/vue.js', 'moment/min/moment.min.js', 'ant-design-vue/dist/antd.js'],
  el: ['vue/dist/vue.js', 'element-ui/lib/index.js'],
  plus: ['vue3/dist/vue.global.js', 'element-plus/dist/index.full.js'],
};
const vendorSources = Object.fromEntries(Object.entries(vendors).map(([key, names]) =>
  [key, names.map(name => readFileSync(require.resolve(name), 'utf8'))]));
const sources = ['model', 'registry', 'native', 'vue-controls', 'tree-select-controls'].map(name =>
  readFileSync(new URL(`../../src/content/controls/${name}.js`, import.meta.url), 'utf8'));
export const labels = ['浙江省', '杭州市', '西湖区'];
export const options = () => [{ value: 10, key: 10, label: labels[0], title: labels[0], children: [
  { value: 20, key: 20, label: labels[1], title: labels[1], children: [
    { value: 30, key: 30, label: labels[2], title: labels[2] },
    { value: 31, key: 31, label: '余杭区', title: '余杭区' },
  ] },
] }];
export const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
export const ctx = { allowWrite: true, check: async () => {} };
export const adapterNames = { ant: 'antdv1-tree-select', el: 'el-search-tree-select', plus: 'el-tree-select' };

// These pinned distributions run in disposable jsdom documents. Every selectable
// node is handled by the real library/app event handler, never a model setter in
// the adapter. There is no network client or business save action in this test.
export async function boot(lib, config = {}) {
  const dom = new JSDOM('<!doctype html><body><form><div id="app"></div><input id="neighbor" value="KEEP">'
    + '<button type="submit">提交</button><button type="button">保存</button></form></body>',
  { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://offline.invalid/tree-select' });
  const w = dom.window, effects = [], clicks = [], expansions = [], forbidden = [];
  w.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  for (const source of vendorSources[lib]) w.eval(source);
  let app, instance;
  const component = {
    data: () => ({ value: config.value, second: undefined, options: config.options || options(), targetId: config.id,
      disabled: !!config.disabled, pickerProps: config.props || {},
      treeProps: config.treeProps || { label: 'label', children: 'children', disabled: 'disabled' } }),
    computed: { flatOptions() {
      const flatten = nodes => nodes.flatMap(node => [node, ...flatten(node.children || [])]);
      return flatten(this.options);
    } },
    methods: {
      pick(node) { this.value = node.value; this.$refs.firstSelect.blur(); },
      secondPick(node) { this.second = node.value; this.$refs.secondSelect.blur(); },
      filter(query) { this.$refs.firstTree.filter(query); },
      filterNode(query, node) { return !query || node.label.includes(query); },
    },
  };
  if (lib === 'plus') {
    component.template = '<main><el-tree-select class="first" :id="targetId" v-model="value" :data="options" :disabled="disabled" '
      + 'filterable v-bind="pickerProps"></el-tree-select><el-tree-select class="second" v-model="second" :data="options" filterable></el-tree-select></main>';
    app = w.Vue.createApp(component); app.use(w.ElementPlus); instance = app.mount('#app');
  } else {
    w.Vue.config.productionTip = false; w.Vue.config.devtools = false;
    if (lib === 'ant') {
      w.Vue.use(w.antd);
      component.template = '<main><a-tree-select class="first" :id="targetId" v-model="value" :tree-data="options" :disabled="disabled" '
        + 'show-search v-bind="pickerProps"></a-tree-select><a-tree-select class="second" v-model="second" :tree-data="options" show-search></a-tree-select></main>';
    } else {
      w.Vue.use(w.ELEMENT);
      const select = (name, value, handler, tree) => `<el-select class="${name}" ref="${name}Select" v-model="${value}" filterable :disabled="${name === 'first' ? 'disabled' : 'false'}" ${name === 'first' ? ':id="targetId" :filter-method="filter" v-bind="pickerProps"' : ''}>
        <el-option v-for="node in flatOptions" :key="node.value" :value="node.value" :label="node.label" style="display:none"></el-option>
        <el-tree ref="${tree}" :data="options" :props="treeProps" node-key="value" :filter-node-method="filterNode" @node-click="${handler}"></el-tree></el-select>`;
      component.template = `<main>${select('first', 'value', 'pick', 'firstTree')}${select('second', 'second', 'secondPick', 'secondTree')}</main>`;
    }
    app = new w.Vue({ el: '#app', ...component }); instance = app;
  }
  await w.Vue.nextTick();
  for (const source of sources) w.eval(source);
  const root = w.document.querySelector(lib === 'ant' ? '.ant-select.first' : '.el-select.first');
  const sibling = w.document.querySelector(lib === 'ant' ? '.ant-select.second' : '.el-select.second');
  for (const type of ['focus', 'pointerdown', 'mousedown', 'mouseup', 'click', 'input', 'change', 'blur', 'submit']) {
    w.document.addEventListener(type, event => {
      effects.push({ type, target: event.target });
      if (type !== 'click') return;
      const item = event.target.closest?.('.ant-select-tree-node-content-wrapper,.el-tree-node__content');
      const expand = event.target.closest?.('.ant-select-tree-switcher,.el-tree-node__expand-icon');
      if (expand) expansions.push(expand);
      else if (item) clicks.push((item.querySelector('.ant-select-tree-title,.el-tree-node__label,[role="option"] span')?.textContent || item.textContent).trim());
    }, true);
  }
  w.document.querySelector('form').addEventListener('submit', event => { forbidden.push('submit'); event.preventDefault(); });
  for (const button of w.document.querySelectorAll('button')) button.addEventListener('click', () => forbidden.push('business-button'));
  return { dom, w, app: instance, root, sibling, effects, clicks, expansions, forbidden, R: w.ResumeControls,
    input: root.querySelector('input'), tick: () => w.Vue.nextTick(),
    paint(value) {
      if (lib === 'ant') root.querySelector('.ant-select-selection-selected-value').textContent = value;
      else if (lib === 'plus') root.querySelector('.el-select__placeholder span').textContent = value;
      else root.querySelector('input').value = value;
    },
    close() { if (lib === 'plus') app.unmount(); else app.$destroy(); dom.window.close(); } };
}
