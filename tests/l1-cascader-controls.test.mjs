import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const vendor = ['vue/dist/vue.js', 'moment/min/moment.min.js', 'element-ui/lib/index.js', 'ant-design-vue/dist/antd.js']
  .map(name => readFileSync(require.resolve(name), 'utf8'));
const sources = ['model', 'registry', 'native', 'vue-controls'].map(name =>
  readFileSync(new URL(`../src/content/controls/${name}.js`, import.meta.url), 'utf8'));
const copy = value => JSON.parse(JSON.stringify(value));
const labels = ['浙江省', '杭州市', '西湖区'], codes = [10, 20, 30];
const options = () => [{ value: 10, label: labels[0], children: [{ value: 20, label: labels[1], children: [
  { value: 30, label: labels[2] }, { value: 31, label: '余杭区' },
] }] }];
const ctx = { allowWrite: true, check: async () => {} };

// Pinned, real Vue2 distributions in a disposable document. No browser, HTTP
// client, business form, save action or live support claim is involved.
async function boot(lib, config = {}) {
  const dom = new JSDOM('<!doctype html><body><div id="app"></div><input id="neighbor" value="KEEP"></body>',
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://offline.invalid/cascader' });
  const w = dom.window, effects = [], clicks = [];
  w.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  for (const source of vendor) w.eval(source);
  w.Vue.config.productionTip = false; w.Vue.config.devtools = false;
  w.Vue.use(w.ELEMENT); w.Vue.use(w.antd);
  for (const source of sources) w.eval(source);
  const attrs = lib === 'el' ? ':props="pickerProps" :show-all-levels="showAllLevels" :separator="separator"'
    : `${config.customDisplay ? ':display-render="renderDisplay"' : ''} ${config.lazy ? ':load-data="loadData"' : ''}`;
  const tag = lib === 'el' ? 'el-cascader' : 'a-cascader';
  const app = new w.Vue({ el: '#app', data: () => ({ value: config.value ?? [], second: [],
    options: config.options || options(), disabled: !!config.disabled, pickerProps: config.pickerProps || {},
    showAllLevels: config.showAllLevels !== false, separator: config.separator ?? ' / ', renderDisplay: () => 'CUSTOM', loadData() {} }),
    template: `<main><${tag} class="first" v-model="value" :options="options" :disabled="disabled" ${attrs}></${tag}>
      <${tag} class="second" v-model="second" :options="options"></${tag}></main>` });
  await w.Vue.nextTick();
  for (const type of ['input', 'change', 'click', 'submit']) w.document.addEventListener(type, event => {
    effects.push(type);
    if (type === 'click') {
      const item = event.target.closest?.('.el-cascader-node,.ant-cascader-menu-item');
      if (item) clicks.push((item.querySelector('.el-cascader-node__label')?.textContent || item.textContent).trim());
    }
  }, true);
  const root = w.document.querySelector('.first'), sibling = w.document.querySelector('.second');
  return { dom, w, app, root, sibling, effects, clicks, R: w.ResumeControls,
    input: root.querySelector('input'), tick: () => w.Vue.nextTick(),
    paint(value) {
      if (lib === 'ant') root.querySelector('.ant-cascader-picker-label').textContent = value;
      else root.querySelector('input').value = value;
    },
    close() { app.$destroy(); dom.window.close(); } };
}

for (const lib of ['el', 'ant']) {
  test(`${lib} real cascader clicks every level, maps labels to numeric codes and verifies both readbacks`, async t => {
    const f = await boot(lib); t.after(() => f.close());
    const adapter = f.R.resolve(f.root), plan = f.R.plan(f.root, { value: labels });
    assert.equal(adapter?.name, lib === 'el' ? 'el-cascader' : 'antdv1-cascader');
    assert.equal(plan.status, 'planned');
    assert.deepEqual(copy(plan.value), codes);
    assert.deepEqual(copy(plan.labels), labels);
    assert.equal((await adapter.write(f.root, plan)).reason, 'shadow_mode');
    await assert.rejects(adapter.write(f.root, plan, { allowWrite: true, check: async () => { throw Error('guard'); } }), /guard/u);
    assert.deepEqual(f.effects, []);
    const result = await adapter.write(f.root, plan, ctx);
    assert.equal(result.strategy, 'ui', JSON.stringify(result));
    assert.deepEqual(f.clicks, labels);
    assert.deepEqual(copy(f.app.value), codes);
    assert.equal((await adapter.verify(f.root, plan, { settleMs: 0 })).status, 'success');
    const panels = [...f.w.document.querySelectorAll(lib === 'el' ? '.el-cascader__dropdown' : '.ant-cascader-menus')];
    assert.ok(panels.every(node => !node.isConnected || f.w.getComputedStyle(node).display === 'none'
      || !!node.closest('[aria-hidden="true"]')), 'owned panel closes after the leaf');
    assert.equal(f.R.plan(f.root, { value: labels }).status, 'success');
    const count = f.effects.length;
    assert.equal((await adapter.write(f.root, plan, ctx)).reason, 'preexisting_same_value');
    assert.equal(f.effects.length, count);
    f.paint('painted wrong');
    assert.equal((await adapter.verify(f.root, plan, { settleMs: 0 })).status, 'mismatch');
    f.paint(labels.join(' / '));
    f.app.value = [10, 20, 31]; await f.tick();
    f.paint(labels.join(' / '));
    assert.equal((await adapter.verify(f.root, plan, { settleMs: 0 })).status, 'mismatch');
    assert.equal((await adapter.verify(f.root, plan, { settleMs: 0, previousSuccess: true })).status, 'reverted');
    f.app.value = codes.slice(); await f.tick();
    f.w.setTimeout(() => { f.app.value = [10, 20, 31]; }, 5);
    assert.equal((await adapter.verify(f.root, plan, { settleMs: 20 })).status, 'reverted');
    assert.equal(f.w.document.querySelector('#neighbor').value, 'KEEP');
    assert.deepEqual(copy(f.app.second), []);
    assert.equal(f.effects.includes('submit'), false);
    assert.equal(f.R.liveSupportClaimed, false);
  });

  test(`${lib} cascader rejects sibling and serialized plans before effects`, async t => {
    const f = await boot(lib); t.after(() => f.close());
    const adapter = f.R.resolve(f.root), plan = f.R.plan(f.root, { value: labels });
    for (const [target, instruction] of [[f.sibling, plan], [f.root, copy(plan)]]) {
      const written = await adapter.write(target, instruction, ctx);
      assert.equal(written.status, 'unsupported'); assert.equal(written.attempts, 0);
      assert.equal((await adapter.verify(target, instruction, { settleMs: 0 })).status, 'unsupported');
    }
    assert.deepEqual(f.effects, []);
    assert.deepEqual(copy(f.app.value), []); assert.deepEqual(copy(f.app.second), []);
  });

  test(`${lib} cascader requires a complete unambiguous enabled leaf and preserves existing data`, async t => {
    const f = await boot(lib); t.after(() => f.close());
    const fails = value => assert.ok(!['planned', 'success'].includes(f.R.plan(f.root, { value }).status));
    for (const value of [labels.slice(0, 2), ['浙江省', '未知', '西湖区'], '浙江省 / 杭州市 / 西湖区', []]) fails(value);
    f.app.options[0].children[0].children[0].disabled = true; await f.tick(); fails(labels);
    f.app.options = options(); f.app.options.push(copy(f.app.options[0])); await f.tick(); fails(labels);
    f.app.options = options(); f.app.disabled = true; await f.tick(); fails(labels);
    f.app.disabled = false; f.app.value = [10, 20, 31]; await f.tick(); fails(labels);
    assert.deepEqual(copy(f.app.value), [10, 20, 31]);
    assert.deepEqual(f.effects, []);
  });
}

test('Element leaf-only and custom separators use the actual display contract', async t => {
  for (const config of [{ showAllLevels: false }, { separator: ' > ' }]) {
    const f = await boot('el', config); t.after(() => f.close());
    const adapter = f.R.resolve(f.root), plan = f.R.plan(f.root, { value: labels });
    assert.equal(plan.status, 'planned');
    assert.equal((await adapter.write(f.root, plan, ctx)).strategy, 'ui');
    assert.equal(f.input.value, config.showAllLevels === false ? labels.at(-1) : labels.join(' > '));
    assert.equal((await adapter.verify(f.root, plan, { settleMs: 0 })).status, 'success');
  }
});

test('unreviewed cascader model and display shapes remain manual without effects', async t => {
  for (const [lib, config] of [['el', { pickerProps: { multiple: true } }],
    ['el', { pickerProps: { emitPath: false } }], ['ant', { customDisplay: true }]]) {
    const f = await boot(lib, config); t.after(() => f.close());
    assert.ok(!['planned', 'success'].includes(f.R.plan(f.root, { value: labels }).status));
    assert.deepEqual(f.effects, []);
  }
  const lazy = options(); delete lazy[0].children; lazy[0].isLeaf = false;
  const f = await boot('el', { options: lazy, pickerProps: { lazy: true, lazyLoad() {} } }); t.after(() => f.close());
  assert.ok(!['planned', 'success'].includes(f.R.plan(f.root, { value: labels }).status));
  assert.deepEqual(copy(f.app.value), []); assert.deepEqual(f.effects, []);
});

test('single-segment paths require a confirmed terminal node under each library contract', async t => {
  for (const [lib, node, config] of [
    ['el', { leaf: false }, { pickerProps: { lazy: true, lazyLoad() {} } }],
    ['el', {}, { pickerProps: { lazy: true, lazyLoad() {} } }],
    ['el', { children: [] }, {}],
    ['ant', { isLeaf: false }, { lazy: true }],
  ]) {
    const f = await boot(lib, { ...config, options: [{ value: 10, label: labels[0], ...node }] }); t.after(() => f.close());
    assert.ok(!['planned', 'success'].includes(f.R.plan(f.root, { value: labels.slice(0, 1) }).status), `${lib}: ${JSON.stringify(node)}`);
    assert.deepEqual(copy(f.app.value), []); assert.deepEqual(f.effects, []);
  }
});

test('real cascaders recheck disabled state, option labels, version and panel ownership between levels', async t => {
  for (const lib of ['el', 'ant']) for (const mutation of ['disabled', 'labels', 'version', 'panel']) {
    const f = await boot(lib); t.after(() => f.close());
    const adapter = f.R.resolve(f.root), plan = f.R.plan(f.root, { value: labels });
    let changed = false;
    const result = await adapter.write(f.root, plan, { allowWrite: true, check: async () => {
      if (changed || f.clicks.length !== 1) return;
      changed = true;
      if (mutation === 'disabled') f.app.disabled = true;
      else if (mutation === 'labels') f.app.options[0].children[0].label = 'changed';
      else if (mutation === 'version') {
        const exported = lib === 'el' ? 'ELEMENT' : 'antd';
        f.w[exported] = { ...f.w[exported], version: lib === 'el' ? '2.15.99' : '1.7.99' };
      }
      else {
        const panel = [...f.w.document.querySelectorAll(lib === 'el' ? '.el-cascader__dropdown' : '.ant-cascader-menus')]
          .find(node => f.w.getComputedStyle(node).display !== 'none');
        panel.replaceWith(panel.cloneNode(true));
      }
      await f.tick();
    } }).catch(error => ({ status: 'unsupported', reason: error.message }));
    assert.equal(changed, true, `${lib}: ${mutation}`);
    assert.equal(result.status, 'unsupported', `${lib}: ${mutation}: ${JSON.stringify(result)}`);
    assert.match(result.reason, /control_|overlay_/u);
    assert.deepEqual(f.clicks, labels.slice(0, 1));
    assert.deepEqual(copy(f.app.value), []);
    assert.equal(f.w.document.querySelector('#neighbor').value, 'KEEP');
    assert.equal(f.effects.includes('submit'), false);
  }
});

test('cascaders reject earlier columns hidden or reordered during the next pointerdown', async t => {
  for (const lib of ['el', 'ant']) for (const mutation of ['hidden', 'reordered']) {
    const f = await boot(lib); t.after(() => f.close());
    const adapter = f.R.resolve(f.root), plan = f.R.plan(f.root, { value: labels });
    let changed = false;
    f.w.document.addEventListener('pointerdown', event => {
      if (changed || f.clicks.length !== 1 || !event.target.matches('.el-cascader-node,.ant-cascader-menu-item')) return;
      const panel = event.target.closest('.el-cascader__dropdown,.ant-cascader-menus');
      const columns = [...panel.querySelectorAll(lib === 'el' ? '.el-cascader-menu__list' : '.ant-cascader-menu')];
      if (!columns[1]?.contains(event.target)) return;
      changed = true;
      if (mutation === 'hidden') columns[0].hidden = true;
      else columns[1].after(columns[0]);
    }, true);
    const result = await adapter.write(f.root, plan, ctx).catch(error => ({ status: 'unsupported', reason: error.message }));
    assert.equal(changed, true, `${lib}: ${mutation}`);
    assert.equal(result.status, 'unsupported', `${lib}: ${mutation}`);
    assert.match(result.reason, /control_|overlay_/u);
    assert.deepEqual(f.clicks, labels.slice(0, 1));
    assert.deepEqual(copy(f.app.value), []);
  }
});
