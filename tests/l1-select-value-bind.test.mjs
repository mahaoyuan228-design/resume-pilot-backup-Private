import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const sources = ['model', 'registry', 'native', 'vue-controls'].map(name =>
  readFileSync(new URL(`../src/content/controls/${name}.js`, import.meta.url), 'utf8'));
const vendor = ['vue/dist/vue.js', 'element-ui/lib/index.js'].map(name => readFileSync(require.resolve(name), 'utf8'));
const ctx = { allowWrite: true, check: async () => {} };

function boot(html = '', libraries = false) {
  const dom = new JSDOM(`<!doctype html><body>${html}<input id="neighbor" value="KEEP"></body>`,
    { runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom, effects = [];
  window.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  if (libraries) {
    for (const source of vendor) window.eval(source);
    window.Vue.config.productionTip = false; window.Vue.config.devtools = false;
    window.Vue.use(window.ELEMENT);
  }
  for (const source of sources) window.eval(source);
  for (const type of ['input', 'change', 'blur', 'click', 'submit']) {
    window.document.addEventListener(type, event => effects.push([type, event.target.id]), true);
  }
  return { dom, window, M: window.ResumeControlModel, R: window.ResumeControls, effects,
    get: id => window.document.getElementById(id) };
}

test('known Vue select names cannot bind sibling controls through a shared field root', t => {
  for (const name of ['ElSelect', 'ASelect', 'iSelect']) {
    for (const [value, type] of [['+86', 'tel'], ['----', 'date']]) {
      const f = boot(`<div id="shared"><select id="part"><option>${value}</option></select><input id="body" type="${type}"></div>`);
      t.after(() => f.dom.window.close());
      const root = f.get('shared');
      root.__vue__ = { $el: root, $props: { value, options: [{ value, label: value }] }, $options: { name } };
      for (const id of ['part', 'body', 'shared']) {
        const model = f.M.inspect(f.get(id));
        assert.equal(model.available, false, `${name}: ${type}: ${id}`);
        assert.equal(model.value, null);
        assert.equal(f.R.resolve(f.get(id)), null);
      }
      assert.equal(f.R.plan(f.get('body'), { value: '13900000000' }).status, 'manual');
      assert.equal(f.get('part').value, value);
      assert.equal(f.get('body').value, '');
      assert.equal(f.get('neighbor').value, 'KEEP');
      assert.deepEqual(f.effects, []);
    }
  }
});

test('a native select plan cannot write or verify a sibling with identical options', async t => {
  const options = '<option value="">Choose</option><option value="+86">China (+86)</option>';
  const f = boot(`<select id="first">${options}</select><select id="second">${options}</select>`);
  t.after(() => f.dom.window.close());
  const first = f.get('first'), second = f.get('second'), adapter = f.R.resolve(first);
  const plan = f.R.plan(first, { value: '+86' });
  assert.equal(plan.status, 'planned');
  const diagnostic = JSON.parse(JSON.stringify(plan));
  const copied = await adapter.write(first, diagnostic, ctx);
  assert.equal(copied.status, 'unsupported');
  assert.equal(copied.attempts, 0);
  assert.equal(first.value, '');
  const rejected = await adapter.write(second, plan, ctx);
  assert.equal(rejected.status, 'unsupported');
  assert.equal(rejected.attempts, 0);
  assert.equal(second.value, '');
  assert.deepEqual(f.effects, []);
  await adapter.write(first, plan, ctx);
  assert.equal((await adapter.verify(first, plan, { settleMs: 0 })).status, 'success');
  const direct = adapter.plan({ value: '+86' }, adapter.readModel(first));
  assert.equal((await adapter.verify(first, direct, { settleMs: 0 })).status, 'success');
  assert.equal((await adapter.verify(first, diagnostic, { settleMs: 0 })).status, 'unsupported');
  second.value = '+86';
  assert.equal((await adapter.verify(second, plan, { settleMs: 0 })).status, 'unsupported');
  assert.equal(f.get('neighbor').value, 'KEEP');
  assert.equal(f.R.liveSupportClaimed, false);
});

test('select-shaped roots cannot bind native editors or nested widget children', t => {
  for (const editors of [
    '<select id="part"><option value="+86">China (+86)</option></select><input id="body" type="tel">',
    '<input id="part" value="China (+86)"><div class="ant-select"><input id="body"></div>',
  ]) {
    const f = boot(`<div id="shared" class="el-select">${editors}</div>`);
    t.after(() => f.dom.window.close());
    const root = f.get('shared');
    root.__vue__ = { $el: root, $props: { value: '+86', options: [{ value: '+86', label: 'China (+86)' }] },
      $options: { name: 'ElSelect' } };
    for (const id of ['shared', 'part', 'body']) {
      assert.equal(f.M.inspect(f.get(id)).available, false, id);
      assert.equal(f.M.inspect(f.get(id)).value, null, id);
      assert.equal(f.R.resolve(f.get(id)), null, id);
      assert.equal(f.R.plan(f.get(id), { value: '+86' }).status, 'manual', id);
    }
    assert.equal(f.get('body').value, '');
    assert.equal(f.get('neighbor').value, 'KEEP');
    assert.deepEqual(f.effects, []);
  }
});

test('a Vue select plan stays bound when a sibling has the same model and visible value', async t => {
  const f = boot('<div id="app"></div>', true);
  const app = new f.window.Vue({ el: '#app', data: () => ({ first: '+86', second: '+86' }),
    template: `<main><el-select id="first" v-model="first"><el-option value="+86" label="China (+86)"></el-option></el-select>
      <el-select id="second" v-model="second"><el-option value="+86" label="China (+86)"></el-option></el-select></main>` });
  t.after(() => { app.$destroy(); f.dom.window.close(); });
  await f.window.Vue.nextTick();
  const first = f.get('first'), second = f.get('second'), adapter = f.R.resolve(first);
  const plan = f.R.plan(first, { value: '+86' });
  assert.equal(adapter.name, 'el-select');
  assert.equal(plan.status, 'success');
  assert.equal((await adapter.verify(first, plan, { settleMs: 0 })).status, 'success');
  assert.equal((await adapter.verify(first.closest('.el-select'), plan, { settleMs: 0 })).status, 'success');
  const rejected = await adapter.write(second, plan, ctx);
  assert.equal(rejected.status, 'unsupported');
  assert.equal(rejected.attempts, 0);
  assert.equal((await adapter.verify(second, plan, { settleMs: 0 })).status, 'unsupported');
  const siblingRoot = second.closest('.el-select');
  f.window.setTimeout(() => siblingRoot.append(first.closest('.el-input')), 5);
  assert.notEqual((await adapter.verify(first, plan, { settleMs: 20 })).status, 'success');
  assert.equal(app.first, '+86'); assert.equal(app.second, '+86');
  assert.equal(f.get('neighbor').value, 'KEEP');
  assert.deepEqual(f.effects, []);
});

test('Vue select writes recheck ownership before each UI effect', async t => {
  const f = boot('<div id="app"></div>', true);
  const app = new f.window.Vue({ el: '#app', data: () => ({ first: '', second: '' }),
    template: `<main><el-select id="first" v-model="first"><el-option value="+86" label="China (+86)"></el-option></el-select>
      <el-select id="second" v-model="second"><el-option value="+86" label="China (+86)"></el-option></el-select></main>` });
  t.after(() => { app.$destroy(); f.dom.window.close(); });
  await f.window.Vue.nextTick();
  const first = f.get('first'), siblingRoot = f.get('second').closest('.el-select');
  const adapter = f.R.resolve(first), plan = f.R.plan(first, { value: '+86' });
  let checks = 0;
  const result = await adapter.write(first, plan, { allowWrite: true, check: async () => {
    if (++checks === 2) siblingRoot.append(first.closest('.el-input'));
  } }).catch(error => ({ reason: error.message }));
  assert.equal(result.reason, 'control_target_changed');
  assert.equal(app.first, ''); assert.equal(app.second, '');
  assert.equal(f.get('neighbor').value, 'KEEP');
  assert.deepEqual(f.effects, []);
});

test('real Element select internal inputs and date ranges retain their owning component', async t => {
  const f = boot('<div id="app"></div>', true);
  const app = new f.window.Vue({ el: '#app', data: () => ({ values: ['+86'], range: ['2025-01-02', '2025-02-03'] }),
    template: `<main><el-select v-model="values" multiple filterable><el-option value="+86" label="China (+86)"></el-option></el-select>
      <el-date-picker v-model="range" type="daterange" value-format="yyyy-MM-dd"></el-date-picker></main>` });
  t.after(() => { app.$destroy(); f.dom.window.close(); });
  await f.window.Vue.nextTick();
  for (const [selector, name, value] of [['.el-select', 'ElSelect', ['+86']],
    ['.el-date-editor', 'ElDatePicker', ['2025-01-02', '2025-02-03']]]) {
    const root = f.window.document.querySelector(selector), inputs = [...root.querySelectorAll('input')];
    assert.equal(inputs.length, 2, selector);
    for (const input of inputs) {
      const model = f.M.inspect(input);
      assert.equal(model.componentName, name); assert.equal(model.available, true);
      assert.equal(model.controlRoot, root);
      assert.deepEqual(JSON.parse(JSON.stringify(model.value)), value);
    }
  }
  assert.deepEqual(f.effects, []);
});
