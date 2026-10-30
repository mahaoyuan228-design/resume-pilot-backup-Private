import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const sources = ['model', 'registry', 'native', 'vue-controls'].map(name =>
  readFileSync(new URL(`../src/content/controls/${name}.js`, import.meta.url), 'utf8'));
const vendor = ['vue/dist/vue.js', 'moment/min/moment.min.js', 'element-ui/lib/index.js', 'ant-design-vue/dist/antd.js']
  .map(name => readFileSync(require.resolve(name), 'utf8'));
const json = value => JSON.parse(JSON.stringify(value));
const writeContext = { allowWrite: true, check: async () => {} };

function boot(t, html, libraries = false) {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, {
    runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://offline.example.test/choices'
  });
  let app;
  t.after(() => { app?.$destroy(); dom.window.close(); });
  const w = dom.window;
  w.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  if (libraries) {
    w.eval(vendor[0]);
    w.Vue.config.productionTip = false; w.Vue.config.devtools = false;
    for (const source of vendor.slice(1)) w.eval(source);
    w.Vue.use(w.ELEMENT); w.Vue.use(w.antd);
  } else {
    w.ELEMENT = { version: '2.15.14' }; w.antd = { version: '1.7.8' };
  }
  for (const source of sources) w.eval(source);
  return { w, R: w.ResumeControls, get: id => w.document.getElementById(id),
    mount(template, data) {
      const root = w.document.createElement('div'); root.id = 'app'; w.document.body.append(root);
      app = new w.Vue({ el: '#app', template, data: () => data });
      return app;
    },
    component(el, name, props, parent) {
      const vm = { $el: el, $options: { name }, $props: props, $parent: parent };
      el.__vue__ = vm;
      return vm;
    } };
}

async function writeAndVerify(f, el, value, adapterName) {
  const adapter = f.R.resolve(el), plan = f.R.plan(el, { value });
  assert.equal(adapter?.name, adapterName);
  assert.equal(plan.status, 'planned', JSON.stringify({ plan, inspected: f.R.inspect(el), html: el.outerHTML }));
  assert.equal((await adapter.write(el, plan)).reason, 'shadow_mode');
  const result = await adapter.write(el, plan, writeContext);
  assert.equal(result.strategy, 'ui');
  assert.equal((await adapter.verify(el, plan, { settleMs: 0 })).status, 'success');
  assert.equal(f.R.liveSupportClaimed, false);
  return plan;
}

for (const kind of ['checkbox', 'switch']) {
  test(`native ${kind}: strict boolean fact, click, readback and family-specific preservation`, async t => {
    const f = boot(t, `<input id="target" type="checkbox"${kind === 'switch' ? ' role="switch"' : ''}>`);
    const el = f.get('target');
    let clicks = 0;
    el.addEventListener('click', () => { clicks++; });
    assert.equal(f.R.plan(el, { value: false }).status, 'success');
    assert.equal(f.R.plan(el, { value: 'true' }).status, 'unsupported');
    await writeAndVerify(f, el, true, `native-${kind}`);
    assert.equal(el.checked, true); assert.equal(clicks, 1);
    if (kind === 'checkbox') assert.equal(f.R.plan(el, { value: false }).reason, 'existing_value');
    else assert.equal(f.R.plan(el, { value: false }).status, 'planned');
    assert.equal(f.R.plan(el, { value: true }).status, 'success');
    assert.equal(clicks, 1);
  });
}

test('native radio: public plan chooses a coded option and reads the selected label', async t => {
  const f = boot(t, '<form><label><input id="target" type="radio" name="choice" value="a">Alpha</label>'
    + '<label><input id="b" type="radio" name="choice" value="b">Beta</label></form>');
  const plan = await writeAndVerify(f, f.get('target'), 'Beta', 'native-radio');
  assert.equal(plan.value, 'b');
  assert.equal(plan.domValue, 'Beta');
  assert.equal(f.get('b').checked, true);
  assert.equal(f.R.plan(f.get('target'), { value: 'Alpha' }).reason, 'existing_value');
});

const libraries = [
  { prefix: 'el', radio: 'ElRadio', radioGroup: 'ElRadioGroup', checkbox: 'ElCheckbox',
    checkboxGroup: 'ElCheckboxGroup', switch: 'ElSwitch', checkboxAdapter: 'el-checkbox' },
  { prefix: 'ant', radio: 'ARadio', radioGroup: 'ARadioGroup', checkbox: 'ACheckbox',
    checkboxGroup: 'ACheckboxGroup', switch: 'ASwitch', checkboxAdapter: 'antdv1-checkbox-group' }
];

function groupFixture(t, lib, type, codes = ['a', 'b']) {
  const f = boot(t, `<div id="target" class="${lib.prefix}-${type}-group">`
    + `<label id="a"><input type="${type}" name="choice" value="${codes[0]}">Alpha</label>`
    + `<label id="b"><input type="${type}" name="choice" value="${codes[1]}">Beta</label></div>`);
  const el = f.get('target'), props = { value: type === 'radio' ? '' : [] };
  const vm = f.component(el, type === 'radio' ? lib.radioGroup : lib.checkboxGroup, props);
  const inputs = [...el.querySelectorAll('input')];
  inputs.forEach((input, index) => {
    input._value = codes[index];
    f.component(input.closest('label'), type === 'radio' ? lib.radio : lib.checkbox,
      lib.prefix === 'el' ? { value: props.value, label: codes[index] }
        : { value: codes[index], checked: false }, vm);
    input.addEventListener('change', () => {
      props.value = type === 'radio' ? codes[index] : inputs.filter(node => node.checked).map(node => node._value);
    });
  });
  return { ...f, el, props, inputs };
}

for (const lib of libraries) {
  const adapterPrefix = lib.prefix === 'el' ? 'el' : 'antdv1';

  test(`${adapterPrefix} radio: child inspection belongs to group, numeric codes survive UI write`, async t => {
    const f = groupFixture(t, lib, 'radio', [1, 2]);
    assert.equal(f.R.resolve(f.inputs[0])?.name, `${adapterPrefix}-radio`);
    const plan = await writeAndVerify(f, f.inputs[0], 'Beta', `${adapterPrefix}-radio`);
    assert.equal(plan.value, 2); assert.equal(f.props.value, 2);
    assert.equal(f.inputs[1].checked, true);
  });

  test(`${adapterPrefix} radio: model type drift cannot pass planning or readback`, async t => {
    const f = groupFixture(t, lib, 'radio', [1, 2]);
    const plan = await writeAndVerify(f, f.el, 'Beta', `${adapterPrefix}-radio`);
    f.props.value = '2';
    assert.notEqual(f.R.plan(f.el, { value: 'Beta' }).status, 'success');
    assert.equal((await f.R.verify(f.el, plan, { settleMs: 0 })).status, 'mismatch');
  });

  test(`${adapterPrefix} radio: null and undefined initial models represent no selection`, async t => {
    for (const value of [null, undefined]) {
      const f = groupFixture(t, lib, 'radio');
      f.props.value = value;
      await writeAndVerify(f, f.el, 'Beta', `${adapterPrefix}-radio`);
      assert.equal(f.props.value, 'b');
    }
  });

  test(`${adapterPrefix} standalone radio: checked state and option code have separate meanings`, async t => {
    const f = boot(t, `<label id="target" class="${lib.prefix}-radio"><input type="radio" value="code">Option</label>`);
    const el = f.get('target'), input = el.querySelector('input');
    const props = lib.prefix === 'el' ? { value: '', label: 'code' } : { checked: false, value: 'code' };
    f.component(el, lib.radio, props);
    input.addEventListener('change', () => {
      if (lib.prefix === 'el') props.value = 'code'; else props.checked = input.checked;
    });
    const plan = await writeAndVerify(f, el, 'Option', `${adapterPrefix}-radio`);
    assert.equal(plan.value, 'code');
    assert.equal(plan.domValue, 'Option');
    assert.equal(input.checked, true);
  });

  test(`${adapterPrefix} checkbox group: boolean option codes retain boolean identity`, async t => {
    const f = groupFixture(t, lib, 'checkbox', [false, true]);
    const plan = await writeAndVerify(f, f.el, ['Alpha', 'Beta'], lib.checkboxAdapter);
    assert.deepEqual(json(plan.value), [false, true]);
    assert.deepEqual(f.props.value, [false, true]);
  });

  test(`${adapterPrefix} checkbox group: preserves previous checks and verifies DOM order`, async t => {
    const f = groupFixture(t, lib, 'checkbox', [1, 2]);
    f.inputs[0].checked = true; f.props.value = [1];
    const plan = await writeAndVerify(f, f.el, ['Beta'], lib.checkboxAdapter);
    assert.deepEqual(json(plan.value), [1, 2]);
    assert.deepEqual(json(plan.domValue), ['Alpha', 'Beta']);
    assert.deepEqual(f.props.value, [1, 2]);
    assert.equal(f.inputs[0].checked, true);
  });

  test(`${adapterPrefix} checkbox group: a reversed fact list keeps option-order DOM readback`, async t => {
    const f = groupFixture(t, lib, 'checkbox', [1, 2]);
    await writeAndVerify(f, f.el, ['Beta', 'Alpha'], lib.checkboxAdapter);
    assert.deepEqual(f.props.value, [1, 2]);
  });

  test(`${adapterPrefix} checkbox group: duplicate labels and disabled choices fail before clicks`, async t => {
    const f = groupFixture(t, lib, 'checkbox');
    let clicks = 0;
    f.el.addEventListener('click', () => { clicks++; });
    f.inputs[1].disabled = true;
    assert.equal(f.R.plan(f.el, { value: ['Beta'] }).status, 'unsupported');
    f.inputs[1].disabled = false;
    f.inputs[1].closest('label').lastChild.textContent = 'Alpha';
    assert.equal(f.R.plan(f.el, { value: ['Alpha'] }).status, 'unsupported');
    assert.equal(clicks, 0);
  });

  test(`${adapterPrefix} standalone checkbox: checked DOM is verified separately from model`, async t => {
    const f = boot(t, `<label id="target" class="${lib.prefix}-checkbox"><input type="checkbox">Enabled</label>`);
    const el = f.get('target'), input = el.querySelector('input');
    const props = lib.prefix === 'el' ? { value: false } : { checked: false };
    const key = lib.prefix === 'el' ? 'value' : 'checked';
    f.component(el, lib.checkbox, props);
    input.addEventListener('change', () => { props[key] = input.checked; });
    const plan = await writeAndVerify(f, el, true, `${adapterPrefix}-checkbox`);
    props[key] = false;
    assert.equal((await f.R.verify(el, plan, { settleMs: 0 })).status, 'mismatch');
    props[key] = true; input.checked = false;
    assert.equal((await f.R.verify(el, plan, { settleMs: 0 })).status, 'mismatch');
    input.checked = true;
    f.w.setTimeout(() => { props[key] = false; input.checked = false; }, 5);
    assert.equal((await f.R.verify(el, plan, { settleMs: 20 })).status, 'reverted');
  });

  test(`${adapterPrefix} switch: false is a no-op and explicit boolean facts click in both directions`, async t => {
    const isElement = lib.prefix === 'el';
    const f = boot(t, isElement
      ? '<div id="target" class="el-switch" role="switch" aria-checked="false"><input type="checkbox"></div>'
      : '<button id="target" type="button" class="ant-switch" role="switch" aria-checked="false"></button>');
    const el = f.get('target'), props = isElement ? { value: false } : { checked: false };
    const key = isElement ? 'value' : 'checked';
    f.component(el, lib.switch, props);
    let clicks = 0;
    el.addEventListener('click', () => {
      clicks++; props[key] = !props[key];
      el.setAttribute('aria-checked', String(props[key]));
      if (el.querySelector('input')) el.querySelector('input').checked = props[key];
    });
    const initial = f.R.plan(el, { value: false });
    assert.equal(initial.status, 'success');
    assert.equal((await f.R.resolve(el).write(el, initial, writeContext)).attempts, 0);
    assert.equal(clicks, 0);
    await writeAndVerify(f, el, true, `${adapterPrefix}-switch`);
    assert.equal(clicks, 1);
    await writeAndVerify(f, el, false, `${adapterPrefix}-switch`);
    assert.equal(clicks, 2);
    assert.equal(f.R.plan(el, { value: 'true' }).status, 'unsupported');
  });
}

test('Element custom active/inactive values map boolean facts without losing model types', async t => {
  const f = boot(t, '<div id="target" class="el-switch" role="switch" aria-checked="false"><input type="checkbox"></div>');
  const el = f.get('target'), props = { value: 0, activeValue: 7, inactiveValue: 0 };
  f.component(el, 'ElSwitch', props);
  el.addEventListener('click', () => {
    props.value = 7; el.setAttribute('aria-checked', 'true'); el.querySelector('input').checked = true;
  });
  const plan = await writeAndVerify(f, el, true, 'el-switch');
  assert.equal(plan.value, 7);
  assert.equal(plan.domValue, true);
  assert.equal(f.R.plan(el, { value: 0 }).status, 'unsupported');
  const off = f.R.plan(el, { value: false });
  assert.equal(off.status, 'planned'); assert.equal(off.value, 0); assert.equal(off.domValue, false);
});

test('Element checkbox custom true/false labels map boolean facts to exact model codes', async t => {
  const f = boot(t, '<label id="target" class="el-checkbox"><input type="checkbox">Enabled</label>');
  const el = f.get('target'), input = el.querySelector('input');
  const props = { value: 'off', trueLabel: 'on', falseLabel: 'off' };
  f.component(el, 'ElCheckbox', props);
  input.addEventListener('change', () => { props.value = input.checked ? 'on' : 'off'; });
  const plan = await writeAndVerify(f, el, true, 'el-checkbox');
  assert.equal(plan.value, 'on'); assert.equal(plan.domValue, true);
  assert.equal(f.R.plan(el, { value: 'off' }).reason, 'existing_value');
});

test('Element switch inverted boolean model codes do not invert again during write revalidation', async t => {
  const f = boot(t, '<div id="target" class="el-switch" role="switch" aria-checked="false"><input type="checkbox"></div>');
  const el = f.get('target'), props = { value: true, activeValue: false, inactiveValue: true };
  f.component(el, 'ElSwitch', props);
  el.addEventListener('click', () => {
    props.value = false; el.setAttribute('aria-checked', 'true'); el.querySelector('input').checked = true;
  });
  const plan = await writeAndVerify(f, el, true, 'el-switch');
  assert.equal(plan.value, false); assert.equal(plan.domValue, true);
  assert.equal(props.value, false);
  const off = f.R.plan(el, { value: false });
  assert.equal(off.status, 'planned'); assert.equal(off.value, true); assert.equal(off.domValue, false);
});

test('choice instructions cannot be replayed on another owning root', async t => {
  const f = boot(t, '<label id="target" class="el-checkbox"><input type="checkbox">One</label>'
    + '<label id="other" class="el-checkbox"><input type="checkbox">Two</label>');
  const el = f.get('target'), other = f.get('other');
  f.component(el, 'ElCheckbox', { value: false });
  f.component(other, 'ElCheckbox', { value: false });
  const plan = f.R.plan(el, { value: true });
  const result = await f.R.resolve(other).write(other, plan, writeContext);
  assert.equal(result.status, 'unsupported');
  assert.equal(result.reason, 'control_target_changed');
  assert.equal(other.querySelector('input').checked, false);
  assert.equal((await f.R.verify(other, plan, { settleMs: 0 })).status, 'unsupported');
});

test('an explicit invalid switch ARIA state cannot use the checked-class fallback', t => {
  const f = boot(t, '<button id="target" type="button" role="switch" aria-checked="mixed" class="ant-switch ant-switch-checked"></button>');
  const el = f.get('target');
  f.component(el, 'ASwitch', { checked: true });
  assert.equal(f.R.plan(el, { value: true }).status, 'unsupported');
});

test('choice guards stop a pointer sequence after its model becomes readonly', async t => {
  const f = groupFixture(t, libraries[0], 'radio');
  const plan = f.R.plan(f.el, { value: 'Beta' });
  let clicks = 0;
  f.inputs[1].closest('label').addEventListener('pointerdown', () => { f.props.readonly = true; });
  f.el.addEventListener('click', () => { clicks++; });
  let failed = false;
  try {
    const result = await f.R.resolve(f.el).write(f.el, plan, writeContext);
    failed = result.status === 'unsupported' || result.status === 'manual';
  } catch { failed = true; }
  assert.equal(failed, true);
  assert.equal(clicks, 0);
  assert.equal(f.inputs[1].checked, false);
});

test('unsupported library versions and readonly choices stay manual without UI effects', t => {
  const f = groupFixture(t, libraries[1], 'checkbox');
  f.props.readonly = true;
  assert.equal(f.R.plan(f.el, { value: ['Alpha'] }).status, 'manual');
  f.props.readonly = false; f.w.antd.version = '4.0.0';
  assert.equal(f.R.plan(f.el, { value: ['Alpha'] }).status, 'manual');
  assert.equal(f.inputs[0].checked, false);
});

test('custom checked-value changes during pointerdown stop before the control is clicked', async t => {
  for (const kind of ['switch', 'checkbox']) {
    const f = boot(t, kind === 'switch'
      ? '<div id="target" class="el-switch" role="switch" aria-checked="false"><input type="checkbox"></div>'
      : '<label id="target" class="el-checkbox"><input type="checkbox">Enabled</label>');
    const el = f.get('target'), input = el.querySelector('input');
    const checkedKey = kind === 'switch' ? 'activeValue' : 'trueLabel';
    const uncheckedKey = kind === 'switch' ? 'inactiveValue' : 'falseLabel';
    const props = { value: 0, [checkedKey]: 7, [uncheckedKey]: 0 };
    f.component(el, kind === 'switch' ? 'ElSwitch' : 'ElCheckbox', props);
    let clicks = 0;
    el.addEventListener('pointerdown', () => { props[checkedKey] = 8; });
    el.addEventListener('click', () => {
      clicks++; props.value = props[checkedKey]; input.checked = true;
      if (kind === 'switch') el.setAttribute('aria-checked', 'true');
    });
    const plan = f.R.plan(el, { value: true });
    assert.equal(plan.value, 7);
    let refused = false;
    try {
      const result = await f.R.resolve(el).write(el, plan, writeContext);
      refused = result.status === 'unsupported' || result.status === 'manual';
    } catch { refused = true; }
    assert.equal(refused, true, kind);
    assert.equal(clicks, 0, kind);
    assert.equal(props.value, 0, kind);
    assert.equal(input.checked, false, kind);
  }
});

for (const lib of libraries) {
  const adapterPrefix = lib.prefix === 'el' ? 'el' : 'antdv1';
  const tag = lib.prefix === 'el' ? 'el' : 'a';
  const optionProp = lib.prefix === 'el' ? 'label' : 'value';

  for (const kind of ['radio', 'checkbox', 'switch']) test(`real ${adapterPrefix} ${kind}: ownership and UI readback`, async t => {
    const f = boot(t, '', true);
    const app = f.mount(`<main>
      <${tag}-radio-group id="radio" v-model="radio">
        <${tag}-radio :${optionProp}="1">Alpha</${tag}-radio>
        <${tag}-radio :${optionProp}="2">Beta</${tag}-radio>
      </${tag}-radio-group>
      <${tag}-checkbox-group id="many" v-model="many">
        <${tag}-checkbox :${optionProp}="1">Alpha</${tag}-checkbox>
        <${tag}-checkbox :${optionProp}="2">Beta</${tag}-checkbox>
      </${tag}-checkbox-group>
      <${tag}-checkbox id="check" v-model="check">Enabled</${tag}-checkbox>
      <${tag}-switch id="switch" v-model="on"></${tag}-switch>
    </main>`, { radio: '', many: [], check: false, on: false });
    await f.w.Vue.nextTick();
    if (kind === 'radio') {
      const input = f.get('radio').querySelector('input');
      assert.equal(f.R.resolve(input)?.name, `${adapterPrefix}-radio`);
      await writeAndVerify(f, input, 'Beta', `${adapterPrefix}-radio`);
      assert.equal(app.radio, 2);
    } else if (kind === 'checkbox') {
      const input = f.get('many').querySelector('input');
      assert.equal(f.R.resolve(input)?.name, lib.checkboxAdapter);
      await writeAndVerify(f, input, ['Beta', 'Alpha'], lib.checkboxAdapter);
      assert.deepEqual(json(app.many).sort(), [1, 2]);
      await writeAndVerify(f, f.get('check'), true, `${adapterPrefix}-checkbox`);
      assert.equal(app.check, true);
    } else {
      const el = f.get('switch');
      if (lib.prefix === 'el') assert.equal(f.w.ResumeControlModel.inspect(el).controlRoot, el.closest('.el-switch'),
        'the library places id on its internal input; the switch remains the owner');
      await writeAndVerify(f, el, true, `${adapterPrefix}-switch`);
      assert.equal(app.on, true);
      app.on = false;
      await f.w.Vue.nextTick();
      assert.equal(f.R.plan(f.get('switch'), { value: false }).status, 'success');
    }
  });
}
