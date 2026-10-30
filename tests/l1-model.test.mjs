import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const source = name => readFileSync(new URL(`../src/content/controls/${name}.js`, import.meta.url), 'utf8');
const moduleSources = ['model', 'registry', 'native', 'vue-controls'].map(source);
// Actual pinned distribution exports establish fixture versions. No component
// name or fabricated version is accepted as production compatibility evidence.
const vendor = ['vue/dist/vue.js', 'moment/min/moment.min.js', 'element-ui/lib/index.js', 'ant-design-vue/dist/antd.js']
  .map(name => readFileSync(require.resolve(name), 'utf8'));

function boot({ libraries = false, html = '<input id="target">' } = {}) {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  if (libraries) {
    window.eval(vendor[0]);
    window.Vue.config.productionTip = false; window.Vue.config.devtools = false;
    for (const js of vendor.slice(1)) window.eval(js);
    window.Vue.use(window.ELEMENT); window.Vue.use(window.antd);
  }
  for (const js of moduleSources) window.eval(js);
  let app;
  return { dom, window, M: window.ResumeControlModel, R: window.ResumeControls,
    get: id => window.document.getElementById(id),
    mount(template, data) {
      const root = window.document.createElement('div'); root.id = 'app'; window.document.body.append(root);
      app = new window.Vue({ el: '#app', template, data: () => data });
      return app;
    },
    close() { app?.$destroy(); window.close(); }
  };
}
const json = value => JSON.parse(JSON.stringify(value));

test('MAIN model reads real Vue2 reactive props getters without dispatching effects', async t => {
  const f = boot({ libraries: true }); t.after(() => f.close());
  f.mount('<main id="app"><el-input id="example" v-model="value"></el-input></main>', { value: '组件模型' });
  await f.window.Vue.nextTick();
  const el = f.get('example'), ref = f.M.resolve(el);
  assert.equal(ref.componentName, 'ElInput');
  assert.equal(typeof Object.getOwnPropertyDescriptor(ref.vm.$props, 'value').get, 'function');
  let events = 0;
  for (const event of ['input', 'change', 'click']) el.addEventListener(event, () => { events++; });
  const before = el.value, model = f.M.inspect(el);
  assert.equal(model.framework, 'vue2');
  assert.equal(model.lib, 'element-ui');
  assert.equal(model.version, f.window.ELEMENT.version);
  assert.equal(model.versionEvidence, 'page_library_export');
  assert.equal(model.available, true);
  assert.equal(model.value, '组件模型');
  assert.equal(f.R.resolve(el).name, 'el-input');
  assert.equal(el.value, before);
  assert.equal(events, 0);
  const exported = f.R.inspect(el);
  assert.equal(JSON.stringify(exported).includes('controlRoot'), false);
  assert.equal(JSON.stringify(exported).includes('onChange'), false);
});

test('a component name without the actual library version export remains unclaimed', async t => {
  const f = boot({ libraries: true }); t.after(() => f.close());
  f.mount('<main id="app"><el-select id="choice" v-model="value"><el-option value="code" label="选项"></el-option></el-select></main>', { value: '' });
  await f.window.Vue.nextTick();
  const el = f.get('choice');
  const adapter = f.R.resolve(el), instruction = f.R.plan(el, { value: '选项' });
  assert.equal(adapter.name, 'el-select');
  assert.equal(instruction.status, 'planned');
  delete f.window.ELEMENT;
  const model = f.M.inspect(el);
  assert.equal(model.framework, 'vue2');
  assert.equal(model.lib, 'element-ui');
  assert.equal(model.version, null);
  assert.equal(model.versionEvidence, 'version_unconfirmed');
  assert.equal(f.R.resolve(el), null);
  assert.equal(f.R.plan(el, { value: '选项' }).status, 'unsupported');
  let effects = 0;
  for (const event of ['input', 'change', 'click', 'pointerdown', 'mousedown']) el.addEventListener(event, () => { effects++; });
  const result = await adapter.write(el, instruction, { allowWrite: true, check: async () => {} });
  assert.equal(result.status, 'unsupported');
  assert.equal(result.reason, 'control_or_version_changed');
  assert.equal(result.attempts, 0);
  assert.equal(effects, 0);
});

test('real ASelect VNode options retain codes and exact display labels', async t => {
  const f = boot({ libraries: true }); t.after(() => f.close());
  f.mount('<main id="app"><a-select id="choice" v-model="value"><a-select-option value="UG">本科</a-select-option><a-select-option value="PG" disabled>硕士</a-select-option></a-select></main>', { value: undefined });
  await f.window.Vue.nextTick();
  const model = f.M.inspect(f.get('choice'));
  assert.equal(model.lib, 'ant-design-vue');
  assert.equal(model.version, f.window.antd.version);
  assert.deepEqual(json(model.options.map(o => ({ value: o.value, label: o.label, disabled: o.disabled }))), [
    { value: 'UG', label: '本科', disabled: false }, { value: 'PG', label: '硕士', disabled: true }
  ]);
  const plan = f.R.plan(f.get('choice'), { value: '本科' });
  assert.equal(plan.status, 'planned');
  assert.equal(plan.value, 'UG');
  assert.equal(plan.domValue, '本科');
  assert.equal(f.R.plan(f.get('choice'), { value: '硕士' }).status, 'unsupported');
});

test('real month controls preserve component type and value-format evidence', async t => {
  const f = boot({ libraries: true }); t.after(() => f.close());
  f.mount('<main id="app"><el-date-picker id="month" v-model="value" type="month" value-format="yyyy-MM" format="yyyy-MM" :editable="false"></el-date-picker><a-month-picker id="ant-month" v-model="antValue" value-format="YYYY-MM" format="YYYY-MM" :input-read-only="true"></a-month-picker></main>', { value: '', antValue: '' });
  await f.window.Vue.nextTick();
  for (const [id, expected] of [['month', 'el-month'], ['ant-month', 'antdv1-month']]) {
    const el = f.get(id), model = f.M.inspect(el), plan = f.R.plan(el, { value: '2024-02' });
    assert.equal(f.R.resolve(el).name, expected);
    assert.equal(model.readonly, false, 'readonly display inputs remain writable component pickers');
    assert.equal(plan.status, 'planned');
    assert.equal(f.R.plan(el, { value: '2024-02-29' }).status, 'unsupported');
    assert.equal(f.R.plan(el, { value: '2024-13' }).status, 'unsupported');
  }
});

test('real AMonthPicker preserves YYYY-MM through UI writes and parent model updates', async t => {
  const f = boot({ libraries: true }); t.after(() => f.close());
  const app = f.mount('<main id="app"><a-month-picker id="month" v-model="value" value-format="YYYY-MM" format="YYYY-MM" :input-read-only="true"></a-month-picker></main>', { value: '' });
  await f.window.Vue.nextTick();
  const el = f.get('month'), adapter = f.R.resolve(el), instruction = f.R.plan(el, { value: '2024-02' });
  assert.equal(adapter.name, 'antdv1-month');
  assert.equal(instruction.status, 'planned');
  const written = await adapter.write(el, instruction, { allowWrite: true, check: async () => {} });
  assert.equal(written.strategy, 'ui', JSON.stringify(written));
  await f.window.Vue.nextTick();
  assert.equal(app.value, '2024-02');
  assert.equal(f.M.inspect(el).value, '2024-02');
  assert.equal((await adapter.verify(el, instruction, { settleMs: 0 })).status, 'success');
  app.value = '2025-07';
  await f.window.Vue.nextTick();
  assert.equal(f.M.inspect(el).value, '2025-07');
  assert.equal(el.querySelector('input').value, '2025-07');
  assert.equal(f.R.plan(el, { value: '2025-07' }).status, 'success');
});

test('React fibers provide read-only diagnostics and cannot fall through to native writing', t => {
  const f = boot(); t.after(() => f.close());
  const el = f.get('target'); let called = 0;
  function FormilyField() {} FormilyField.displayName = 'FixtureFormilyField';
  const host = { type: 'input', stateNode: el, memoizedProps: { value: 'host-display' } };
  el.__reactFiber$fixture = host;
  host.return = {
    type: FormilyField,
    memoizedProps: { value: 'react-model', options: [{ value: 'code', label: '标签' }], onChange() { called++; } },
    child: host
  };
  const model = f.M.inspect(el);
  assert.equal(model.framework, 'react');
  assert.equal(model.componentName, 'FixtureFormilyField');
  assert.equal(model.value, 'react-model');
  assert.equal(model.lib, null);
  assert.equal(model.version, null);
  assert.equal(f.R.resolve(el), null);
  assert.equal(f.R.plan(el, { value: 'another' }).status, 'unsupported');
  assert.equal(called, 0);
});

test('React MAIN readback stays within each control root and rejects shared form values', t => {
  const f = boot({ html: '<section id="form"><label id="name-root">姓名<input id="name" value="姓名模型"></label><label id="phone-root">手机<input id="phone" type="tel"></label><label id="email-root">邮箱<input id="email" type="email"></label></section>' });
  t.after(() => f.close());
  const form = f.get('form'), name = f.get('name'), phone = f.get('phone'), email = f.get('email');
  const formHost = { stateNode: form, memoizedProps: {} };
  const shared = { memoizedProps: { value: '姓名模型' }, child: formHost };
  formHost.return = shared;
  form.__reactFiber$fixture = formHost;
  for (const input of [name, phone, email]) {
    const host = { stateNode: input, memoizedProps: {}, return: shared };
    input.__reactFiber$fixture = host;
  }
  name.__reactFiber$fixture.memoizedProps = { value: '姓名模型' };
  assert.equal(f.M.inspect(name).value, '姓名模型');
  for (const input of [phone, email]) {
    const model = f.M.inspect(input);
    assert.equal(model.framework, 'react');
    assert.equal(model.available, false);
    assert.equal(model.value, null);
    assert.equal(model.controlRoot, input);
    assert.equal(f.R.resolve(input), null, 'unknown React ownership must not fall back to native writing');
  }
  const wholeForm = f.M.inspect(form);
  assert.equal(wholeForm.available, false, 'a multi-field wrapper is not a value control');
  assert.equal(wholeForm.value, null);
  phone.__reactFiber$fixture.memoizedProps = { value: '13800000000' };
  email.__reactFiber$fixture.memoizedProps = { value: 'fixture@example.com' };
  assert.equal(f.M.inspect(phone).value, '13800000000');
  assert.equal(f.M.inspect(email).value, 'fixture@example.com');
  assert.equal(name.value, '姓名模型');
  assert.equal(phone.value, '');
  assert.equal(email.value, '');
});

test('React values without a provable owning DOM root remain unavailable', t => {
  const f = boot(); t.after(() => f.close());
  const input = f.get('target');
  input.__reactFiber$fixture = { memoizedProps: {}, return: { memoizedProps: { value: 'unowned' } } };
  const model = f.M.inspect(input);
  assert.equal(model.framework, 'react');
  assert.equal(model.available, false);
  assert.equal(model.value, null);
  assert.equal(f.R.plan(input, { value: 'replacement' }).status, 'unsupported');
  const component = { displayName: 'UdSelect', library: { name: 'ud', version: 'fixture-contract-1' } };
  f.window.UD = { version: 'fixture-contract-1' };
  input.__reactFiber$fixture = { type: component, memoizedProps: { value: 'named-but-unowned' } };
  assert.equal(f.M.inspect(input).available, false, 'a reviewed component name alone cannot prove model ownership');
  assert.equal(f.M.inspect(input).value, null);
});

test('Vue ancestor models spanning sibling text controls cannot pollute readback', t => {
  const f = boot({ html: '<section id="form"><input id="name"><input id="phone" type="tel"><input id="email" type="email"></section>' });
  t.after(() => f.close());
  const root = f.get('form');
  const shared = { type: { name: 'SharedForm' }, props: { value: '姓名模型' }, subTree: { el: root } };
  root.__vueParentComponent = shared;
  for (const id of ['phone', 'email']) {
    const model = f.M.inspect(f.get(id));
    assert.equal(model.framework, 'vue3');
    assert.equal(model.available, false);
    assert.equal(model.value, null);
    assert.equal(f.R.resolve(f.get(id)), null);
  }
  delete root.__vueParentComponent;
  root.__vue__ = { $el: root, $props: { value: '姓名模型' }, $options: { name: 'AInput' } };
  for (const id of ['phone', 'email']) {
    const model = f.M.inspect(f.get(id));
    assert.equal(model.framework, 'vue2');
    assert.equal(model.available, false);
    assert.equal(model.value, null);
    assert.equal(f.R.resolve(f.get(id)), null);
  }
});

test('Vue3 model diagnostics stay distinct from the Vue2 Element adapters', t => {
  const f = boot({ libraries: true }); t.after(() => f.close());
  const el = f.get('target');
  el.__vueParentComponent = { type: { name: 'ElInput' }, props: { modelValue: 'vue3-model' }, subTree: { el } };
  const model = f.M.inspect(el);
  assert.equal(model.framework, 'vue3');
  assert.equal(model.value, 'vue3-model');
  assert.equal(model.lib, null);
  assert.equal(model.version, null);
  assert.equal(f.R.resolve(el), null);
});

test('model option normalization handles value-only entries and bounds nested data', t => {
  const f = boot(); t.after(() => f.close());
  const options = f.M.optionsOf([{ value: 'value-only' }, { value: 'parent', label: '父', children: [{ value: 'child', label: '子' }] }]);
  assert.equal(options[0].label, 'value-only');
  assert.equal(options[1].children[0].label, '子');
  const inherited = Object.create({ value: 'inherited-code' });
  const [inheritedOption, keyedOption, nullOption, opaqueOption] = f.M.optionsOf([
    inherited, { value: undefined, key: 'vnode-code' }, { value: null, key: 'different-code' }, { value: { id: 'opaque' }, label: 'Opaque' }
  ]);
  assert.equal(inheritedOption.value, 'inherited-code');
  assert.equal(inheritedOption.valueSupported, true);
  assert.equal(keyedOption.value, 'vnode-code');
  assert.equal(keyedOption.valueSupported, true);
  assert.equal(nullOption.value, null);
  assert.equal(nullOption.valueSupported, true);
  assert.equal(opaqueOption.valueSupported, false);
  const cyclic = { value: 'loop', label: 'loop' }; cyclic.children = [cyclic];
  assert.doesNotThrow(() => JSON.stringify(f.M.optionsOf([cyclic])));
  assert.equal(f.M.optionsOf(Array.from({ length: 1005 }, (_, i) => ({ value: i }))).length, 1000);
});
