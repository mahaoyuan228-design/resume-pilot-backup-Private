import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
export const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
export const ctx = { allowWrite: true, check: async () => {} };
export const adapterNames = { el: 'el-transfer', ant: 'ant-transfer' };
export const labels = ['Alpha', 'Beta'];
export const options = () => [
  { key: 'a', label: 'Alpha', title: 'Alpha' }, { key: 'b', label: 'Beta', title: 'Beta' },
  { key: 'keep', label: 'Keep', title: 'Keep' }, { key: 'twin1', label: 'Twin', title: 'Twin' },
  { key: 'twin2', label: 'Twin', title: 'Twin' }, { key: 'blocked', label: 'Blocked', title: 'Blocked', disabled: true },
];

// Real pinned public components in a disposable document. No service is reachable.
export async function boot(lib, config = {}) {
  const dom = new JSDOM('<!doctype html><body><form><div id="app"></div><input id="neighbor" value="KEEP">'
    + '<button type="submit" id="save">Save</button></form></body>',
  { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://offline.invalid/transfer' });
  const w = dom.window, effects = [], forbidden = [];
  w.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  w.fetch = () => { forbidden.push('network'); throw Error('network_forbidden'); };
  w.XMLHttpRequest.prototype.open = () => { forbidden.push('network'); throw Error('network_forbidden'); };
  for (const name of ['vue/dist/vue.js', lib === 'el' ? 'element-ui/lib/index.js' : 'ant-design-vue/dist/antd.js'])
    w.eval(readFileSync(require.resolve(name), 'utf8'));
  w.Vue.config.productionTip = false; w.Vue.config.devtools = false;
  w.Vue.use(lib === 'el' ? w.ELEMENT : w.antd);
  const transfer = lib === 'el'
    ? '<el-transfer class="first" :id="targetId" v-model="value" :data="options" :disabled="disabled" v-bind="transferProps" />'
      + '<el-transfer class="second" v-model="second" :data="options" />'
    : '<a-transfer class="first" :id="targetId" :target-keys="value" :data-source="options" :disabled="disabled" :lazy="false"'
      + ' :render="render" @change="changed" v-bind="transferProps" />'
      + '<a-transfer class="second" :target-keys="second" :data-source="options" :render="render" :lazy="false" @change="keys=>second=keys" />';
  const app = new w.Vue({ el: '#app',
    data: () => ({ value: copy(config.value ?? ['keep']), second: [], options: copy(config.options || options()),
      targetId: config.id, disabled: !!config.disabled, transferProps: config.props || {} }),
    methods: { render(item) { return item.title; }, changed(keys) { if (config.commit !== false) this.value = keys; } },
    template: `<main>${transfer}</main>`,
  });
  await w.Vue.nextTick();
  for (const name of ['model', 'registry', 'native', 'vue-controls', 'transfer-controls'])
    w.eval(readFileSync(new URL(`../../src/content/controls/${name}.js`, import.meta.url), 'utf8'));
  const root = w.document.querySelector(lib === 'el' ? '.el-transfer.first' : '.ant-transfer.first');
  const sibling = w.document.querySelector(lib === 'el' ? '.el-transfer.second' : '.ant-transfer.second');
  for (const type of ['focus', 'pointerdown', 'mousedown', 'mouseup', 'click', 'input', 'change', 'blur', 'submit'])
    w.document.addEventListener(type, event => effects.push({ type, target: event.target }), true);
  w.document.querySelector('form').addEventListener('submit', event => { forbidden.push('submit'); event.preventDefault(); });
  w.document.querySelector('#save').addEventListener('click', () => forbidden.push('save'));
  const right = () => root.querySelectorAll(lib === 'el' ? '.el-transfer-panel' : '.ant-transfer-list')[1];
  const rightLabels = () => [...right().querySelectorAll(lib === 'el' ? '.el-transfer-panel__item' : '.ant-transfer-list-content-item')]
    .map(row => (row.querySelector(lib === 'el' ? '.el-checkbox__label' : '.ant-transfer-list-content-item-text') || row).textContent.trim());
  return { dom, w, app, owner: app, root, el: root, sibling, effects, events: effects, forbidden, R: w.ResumeControls,
    tick: () => w.Vue.nextTick(), right, rightLabels,
    close() { app.$destroy(); dom.window.close(); } };
}
