import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const files = ['model.js', 'registry.js', 'native.js', 'vue-controls.js', 'extended-controls.js'].map(name =>
  fs.readFileSync(new URL(`../src/content/controls/${name}`, import.meta.url), 'utf8'));
const contracts = [
  ['ivu-select', 'iview', 'iSelect', '本科'], ['ivu-date', 'iview', 'CalendarPicker', '2023-01-02'],
  ['ud-select', 'ud', 'UdSelect', '本科'], ['ud-date', 'ud', 'UdDatePicker', '2023-01-02'],
  ['ud-cascader', 'ud', 'UdCascader', ['中国', '北京']],
  ['phoenix-select', 'phoenix', 'PhoenixSelect', '本科'],
  ['phoenix-cascader', 'phoenix', 'PhoenixCascader', ['中国', '北京']],
  ['phoenix-date', 'phoenix', 'PhoenixDatePicker', '2023-01-02'],
];
const copy = value => JSON.parse(JSON.stringify(value));
function boot([name, lib, componentName, fact], { legacy = false } = {}) {
  const dom = new JSDOM('<div id="control"><input readonly role="combobox" aria-controls="owned"></div><div id="owned" hidden></div><input id="neighbor" value="KEEP">',
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://offline.invalid/form' });
  const w = dom.window, el = w.document.querySelector('#control'), input = el.querySelector('input'), portal = w.document.querySelector('#owned');
  w.Element.prototype.getClientRects = () => [{ width: 8, height: 8 }];
  Object.defineProperty(w.document, 'visibilityState', { configurable: true, get: () => 'visible' });
  const type = name.split('-')[1];
  const props = { value: type === 'cascader' ? [] : '', options: type === 'cascader'
    ? [{ value: 'cn', label: '中国', children: [{ value: 'bj', label: '北京' }] }]
    : [{ value: 'UG', label: '本科' }, { value: 'keep', label: '原值' }],
    valueFormat: 'YYYY-MM-DD', format: 'yyyy-MM-dd', type: type === 'date' ? 'date' : undefined, separator: ' / ' };
  const effects = [];
  const update = value => {
    effects.push(copy(value)); props.value = value;
    input.value = type === 'select' ? props.options.find(option => option.value === value)?.label || value
      : type === 'cascader' ? (() => {
        let options = props.options;
        return value.map(code => { const option = options.find(item => item.value === code); options = option.children || []; return option.label; }).join(props.separator);
      })() : value;
    portal.hidden = true;
  };
  if (lib === 'iview') {
    w.iview = { version: '3.5.4' };
    el.className = type === 'select' ? 'ivu-select' : 'ivu-date-picker';
    el.__vue__ = { $el: el, $options: { name: componentName }, $props: props };
  } else {
    w[lib === 'ud' ? 'UD' : 'Phoenix'] = { version: 'fixture-contract-1' };
    props.onChange = update;
    const component = { displayName: componentName, library: { name: lib, version: 'fixture-contract-1' } };
    const host = { type: 'div', stateNode: el, memoizedProps: {}, return: null };
    el.__reactFiber$fixture = { type: component, memoizedProps: props, child: host, return: null };
    host.return = el.__reactFiber$fixture;
    portal.setAttribute('role', type === 'date' ? 'dialog' : 'listbox');
    input.addEventListener('click', () => { portal.hidden = false; });
    const choice = (text, action) => {
      const node = w.document.createElement('div'); node.setAttribute('role', 'option'); node.textContent = text;
      node.addEventListener('click', action); return node;
    };
    if (type === 'date') {
      const cell = w.document.createElement('button'); cell.type = 'button'; cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', '2023-01-02'); cell.addEventListener('click', () => update('2023-01-02')); portal.append(cell);
    } else if (type === 'cascader') {
      const column = (options, path = []) => {
        const group = w.document.createElement('div'); group.setAttribute('role', 'group');
        for (const option of options) group.append(choice(option.label, () => {
          const next = [...path, option.value];
          if (option.children?.length) column(option.children, next); else update(next);
        }));
        portal.append(group);
      };
      column(props.options);
    } else portal.append(choice('本科', () => update('UG')));
  }
  if (legacy) {
    const revision = typeof legacy === 'number' ? legacy : undefined;
    w.ResumeControlModel = Object.freeze({ version: 1, revision, inspect() { throw Error('old_model_retained'); } });
    w.ResumeControls = Object.freeze({ version: 1, revision, mode: 'shadow', list: () => [{ name: 'old_adapter' }] });
  }
  for (const source of files) w.eval(source);
  return { dom, w, el, input, portal, props, effects, R: w.ResumeControls, fact: { value: fact } };
}

for (const contract of contracts) {
  test(`${contract[0]} claims only its confirmed component/version and preserves manual/existing outcomes`, t => {
    const f = boot(contract); t.after(() => f.dom.window.close());
    const { R, el, props, fact, w } = f;
    assert.equal(R.resolve(el)?.name, contract[0]);
    assert.equal(R.plan(el, fact).status, 'planned');
    props.disabled = true; assert.equal(R.plan(el, fact).status, 'manual'); props.disabled = false;
    props.readonly = true; assert.equal(R.plan(el, fact).status, 'manual'); props.readonly = false;
    props.value = 'keep'; assert.equal(R.plan(el, fact).reason, 'existing_value'); props.value = contract[0].endsWith('cascader') ? [] : '';
    const exported = w[contract[1] === 'iview' ? 'iview' : contract[1] === 'ud' ? 'UD' : 'Phoenix'];
    exported.version = '99.0.0';
    assert.equal(R.resolve(el), null);
    assert.equal(R.plan(el, fact).status, 'manual');
    assert.equal(R.resolve(el.querySelector('input')), null, 'unconfirmed widget never falls through to native');
    assert.deepEqual(f.effects, []);
  });
}

for (const contract of contracts.filter(row => row[1] !== 'iview')) {
  test(`${contract[0]} UI writes need both readbacks and detect model reversion`, async t => {
    const f = boot(contract); t.after(() => f.dom.window.close());
    const { R, el, fact, props, input, portal } = f;
    const plan = R.plan(el, fact), adapter = R.resolve(el);
    assert.equal((await adapter.write(el, plan)).reason, 'shadow_mode');
    await assert.rejects(adapter.write(el, plan, { allowWrite: true, check: async () => { throw Error('binding_changed'); } }), /binding_changed/u);
    assert.equal(f.effects.length, 0);
    const result = await adapter.write(el, plan, { allowWrite: true, check: async () => {} });
    assert.equal(result.strategy, 'ui'); assert.equal(portal.hidden, true);
    assert.equal((await R.verify(el, plan, { settleMs: 0 })).status, 'success');
    assert.equal(wValue(f, '#neighbor'), 'KEEP');
    assert.equal(R.plan(el, fact).status, 'success');
    const previous = props.value; props.value = 'wrong';
    assert.equal((await R.verify(el, plan, { settleMs: 0 })).status, 'mismatch');
    assert.equal((await R.verify(el, plan, { settleMs: 0, previousSuccess: true })).status, 'reverted');
    props.value = previous; input.value = 'painted wrong';
    assert.equal((await R.verify(el, plan, { settleMs: 0 })).status, 'mismatch');
    el.remove();
    assert.equal((await adapter.verify(el, plan, { settleMs: 0 })).status, 'unsupported');
  });
}
function wValue(f, selector) { return f.w.document.querySelector(selector).value; }

test('unknown ud/phoenix contract versions stay manual even if page and component agree', t => {
  for (const contract of contracts.filter(row => row[1] !== 'iview')) {
    const f = boot(contract); t.after(() => f.dom.window.close());
    f.el.__reactFiber$fixture.type.library.version = 'unreviewed-2';
    f.w[contract[1] === 'ud' ? 'UD' : 'Phoenix'].version = 'unreviewed-2';
    assert.equal(f.R.plan(f.el, f.fact).status, 'manual');
  }
});

test('owning React component wins over a nested host value; foreign portals are never clicked', async t => {
  const f = boot(contracts[2]); t.after(() => f.dom.window.close());
  f.input.__reactFiber$host = { type: 'input', stateNode: f.input,
    memoizedProps: { value: 'host display' }, return: f.el.__reactFiber$fixture };
  assert.equal(f.R.resolve(f.input)?.name, 'ud-select');
  f.input.removeAttribute('aria-controls');
  const plan = f.R.plan(f.el, f.fact);
  assert.equal((await f.R.resolve(f.el).write(f.el, plan, { allowWrite: true, check: async () => {} })).reason, 'overlay_ownership_unconfirmed');
  assert.equal(f.portal.hidden, true); assert.equal(f.effects.length, 0);
});

test('ViewUI, imprecise dates, object/multiple selects and ambiguous options fail closed', t => {
  const a = boot(contracts[0]), b = boot(contracts[3]);
  t.after(() => { a.dom.window.close(); b.dom.window.close(); });
  a.w.ViewUI = { version: '4.0.0' }; assert.equal(a.R.plan(a.el, a.fact).status, 'manual');
  assert.equal(b.R.plan(b.el, { value: '2023-01' }).reason, 'invalid_date_precision');
  b.props.valueFormat = null; assert.equal(b.R.plan(b.el, b.fact).reason, 'value_format_unverified');
  const c = boot(contracts[2]); t.after(() => c.dom.window.close());
  c.props.multiple = true; assert.equal(c.R.plan(c.el, c.fact).reason, 'multiple_select_unconfirmed');
  c.props.multiple = false; c.props.options.push({ value: 'other', label: '本科' });
  assert.equal(c.R.plan(c.el, c.fact).reason, 'option_ambiguous');
});

test('unknown Vue and React component identities cannot fall through to native writers', t => {
  const a = boot(contracts[0]), b = boot(contracts[2]);
  t.after(() => { a.dom.window.close(); b.dom.window.close(); });
  a.el.className = '';
  a.el.__vue__.$options.name = 'UnreviewedPicker';
  a.input.removeAttribute('readonly');
  assert.equal(a.R.inspect(a.input).probe.framework, 'vue2');
  assert.equal(a.R.resolve(a.input), null);
  b.el.__reactFiber$fixture.type = { displayName: 'UnknownWidget' };
  b.el.__reactFiber$fixture.memoizedProps = {};
  b.input.removeAttribute('readonly');
  assert.equal(b.R.inspect(b.input).probe.framework, 'react');
  assert.equal(b.R.resolve(b.input), null);
});

test('component version changes or disabling while opening stop before the option click', async t => {
  for (const change of ['version', 'disabled']) {
    const f = boot(contracts[2]); t.after(() => f.dom.window.close());
    const plan = f.R.plan(f.el, f.fact), adapter = f.R.resolve(f.el);
    f.input.addEventListener('click', () => {
      if (change === 'disabled') f.props.disabled = true;
      else f.w.UD.version = 'unreviewed-2';
    });
    await assert.rejects(adapter.write(f.el, plan, { allowWrite: true, check: async () => {} }), /control_or_version_changed/u);
    assert.equal(f.effects.length, 0);
  }
});

test('ARIA cascaders traverse three exact levels and read model codes separately from display labels', async t => {
  for (const contract of [contracts[4], contracts[6]]) {
    const f = boot(contract); t.after(() => f.dom.window.close());
    f.props.options[0].children[0].children = [{ value: 'school', label: '离线学校' }];
    const fact = { value: ['中国', '北京', '离线学校'] }, plan = f.R.plan(f.el, fact);
    assert.deepEqual(copy(plan.value), ['cn', 'bj', 'school']);
    assert.equal(plan.domValue, '中国 / 北京 / 离线学校');
    const clicked = [];
    f.portal.addEventListener('click', event => clicked.push(event.target.textContent));
    const result = await f.R.resolve(f.el).write(f.el, plan, { allowWrite: true, check: async () => {} });
    assert.equal(result.attempts, 3);
    assert.deepEqual(clicked, ['中国', '北京', '离线学校']);
    assert.deepEqual(copy((await f.R.verify(f.el, plan, { settleMs: 0 })).modelReadback), ['cn', 'bj', 'school']);
    assert.equal(f.portal.hidden, true);
    assert.equal(f.R.liveSupportClaimed, false);
    assert.equal(wValue(f, '#neighbor'), 'KEEP');
  }
});

test('ARIA cascader plans preserve pending display and decline multiple paths', t => {
  const f = boot(contracts[4]); t.after(() => f.dom.window.close());
  f.input.value = '尚未确认的选择';
  assert.equal(f.R.plan(f.el, f.fact).reason, 'existing_value');
  f.input.value = ''; f.props.multiple = true;
  assert.equal(f.R.plan(f.el, f.fact).reason, 'multiple_cascader_unconfirmed');
  assert.deepEqual(f.effects, []);
});

test('ARIA cascaders recheck portal, column and exact option before each pointer effect', async t => {
  for (const mutation of ['owner', 'hidden-column', 'reordered-column', 'label', 'duplicate', 'disabled', 'model-option', 'multiple']) {
    const f = boot(contracts[4]); t.after(() => f.dom.window.close());
    const plan = f.R.plan(f.el, f.fact), adapter = f.R.resolve(f.el);
    let clicks = 0, pointerdowns = 0;
    const option = f.portal.querySelector('[role="option"]');
    option.addEventListener('click', () => { clicks++; });
    option.addEventListener('pointerdown', () => {
      pointerdowns++;
      if (mutation === 'owner') f.input.setAttribute('aria-controls', 'missing');
      if (mutation === 'hidden-column') option.parentElement.style.display = 'none';
      if (mutation === 'reordered-column') {
        const column = f.w.document.createElement('div'); column.setAttribute('role', 'group'); f.portal.prepend(column);
      }
      if (mutation === 'label') option.textContent = '其他';
      if (mutation === 'duplicate') option.parentElement.append(option.cloneNode(true));
      if (mutation === 'disabled') f.props.disabled = true;
      if (mutation === 'model-option') f.props.options[0].children[0].value = 'foreign';
      if (mutation === 'multiple') f.props.multiple = true;
    });
    await assert.rejects(adapter.write(f.el, plan, { allowWrite: true, check: async () => {} }),
      /overlay_ownership_changed|cascader_option_changed|cascader_contract_changed|control_or_version_changed/u, mutation);
    assert.equal(pointerdowns, 1, mutation);
    assert.equal(clicks, 0, mutation);
    assert.deepEqual(f.effects, [], mutation);
    assert.equal(wValue(f, '#neighbor'), 'KEEP');
  }
});

test('ARIA cascader plans cannot be copied or replayed on another matching widget', async t => {
  const f = boot(contracts[4]); t.after(() => f.dom.window.close());
  const plan = f.R.plan(f.el, f.fact), adapter = f.R.resolve(f.el);
  assert.equal((await adapter.write(f.el, copy(plan), { allowWrite: true, check: async () => {} })).reason, 'control_target_changed');
  const sibling = f.el.cloneNode(true); sibling.id = 'sibling';
  const source = f.el.__reactFiber$fixture, host = { type: 'div', stateNode: sibling, memoizedProps: {} };
  sibling.__reactFiber$fixture = { type: source.type, memoizedProps: { ...f.props }, child: host, return: null };
  host.return = sibling.__reactFiber$fixture;
  f.w.document.body.append(sibling);
  assert.equal((await adapter.write(sibling, plan, { allowWrite: true, check: async () => {} })).reason, 'control_target_changed');
  assert.equal((await adapter.verify(sibling, plan, { settleMs: 0 })).status, 'unsupported');
  assert.deepEqual(f.effects, []);
  assert.equal(f.portal.hidden, true);
});

test('ARIA cascaders stop if an earlier column is hidden during the next pointerdown', async t => {
  const f = boot(contracts[4]); t.after(() => f.dom.window.close());
  const plan = f.R.plan(f.el, f.fact), adapter = f.R.resolve(f.el);
  let clicks = 0, hidden = false;
  f.portal.addEventListener('click', () => { clicks++; });
  f.portal.addEventListener('pointerdown', () => {
    if (clicks !== 1) return;
    f.portal.querySelector('[role="group"]').hidden = true;
    hidden = true;
  });
  await assert.rejects(adapter.write(f.el, plan, { allowWrite: true, check: async () => {} }), /cascader_option_changed/u);
  assert.equal(hidden, true); assert.equal(clicks, 1);
  assert.deepEqual(f.effects, []);
  assert.equal(wValue(f, '#neighbor'), 'KEEP');
});

test('object-valued models and option codes cannot be flattened into empty values or authorize overwrites', async t => {
  for (const contract of contracts.filter(row => row[1] !== 'iview')) {
    const f = boot(contract); t.after(() => f.dom.window.close());
    const original = { id: 'existing-code' };
    f.props.value = original;
    const plan = f.R.plan(f.el, f.fact);
    assert.equal(plan.status, 'manual', contract[0]);
    assert.equal(f.R.inspect(f.el).probe.available, false);
    assert.equal(f.props.value, original);
    assert.equal(f.effects.length, 0);
  }
  const select = boot(contracts[2]); t.after(() => select.dom.window.close());
  select.props.options[0].value = { id: 'opaque-code' };
  assert.equal(select.R.plan(select.el, select.fact).reason, 'model_unavailable');
  assert.equal(select.R.helpers.makePlan(select.fact, select.R.inspect(select.el).probe, { type: 'select' }).reason, 'option_value_unavailable');
  assert.equal(select.effects.length, 0);
  const cascader = boot(contracts[4]); t.after(() => cascader.dom.window.close());
  cascader.props.options[0].children[0].value = { id: 'opaque-leaf-code' };
  assert.equal(cascader.R.plan(cascader.el, cascader.fact).reason, 'model_unavailable');
  assert.equal(cascader.R.helpers.makePlan(cascader.fact, cascader.R.inspect(cascader.el).probe, { type: 'cascader' }).reason, 'option_value_unavailable');
  assert.deepEqual(copy(cascader.props.value), []);
  assert.equal(cascader.effects.length, 0);
});

test('reinjection upgrades an old v1 MAIN model/registry and restores every adapter family', t => {
  const f = boot(contracts[2], { legacy: true }); t.after(() => f.dom.window.close());
  assert.equal(f.w.ResumeControlModel.version, 1);
  assert.equal(f.w.ResumeControlModel.revision, 11);
  assert.equal(f.R.version, 1);
  assert.equal(f.R.revision, 15);
  const names = new Set(f.R.list().map(adapter => adapter.name));
  for (const name of ['native-text', 'native-select', 'native-date', 'native-month', 'el-select', 'antdv1-month', ...contracts.map(row => row[0])]) {
    assert.equal(names.has(name), true, name);
  }
  assert.equal(names.has('old_adapter'), false);
  assert.equal(f.R.plan(f.el, f.fact).adapter, 'ud-select');
  f.props.value = { id: 'opaque-existing-value' };
  assert.equal(f.R.plan(f.el, f.fact).status, 'manual', 'upgraded model keeps the opaque-value protection');
});

test('revision 2 reinjection replaces captured models and adapters before a guarded UI write', async t => {
  const f = boot(contracts[2], { legacy: 2 }); t.after(() => f.dom.window.close());
  assert.equal(f.w.ResumeControlModel.revision, 11);
  assert.equal(f.R.revision, 15);
  assert.equal(f.R.list().some(adapter => adapter.name === 'old_adapter'), false);
  for (const name of ['native-text', 'el-select', 'antdv1-month', ...contracts.map(row => row[0])]) {
    assert.equal(f.R.list().some(adapter => adapter.name === name), true, name);
  }
  const plan = f.R.plan(f.el, f.fact), adapter = f.R.resolve(f.el);
  assert.equal(plan.adapter, 'ud-select');
  assert.equal((await adapter.write(f.el, plan)).reason, 'shadow_mode');
  assert.equal(f.effects.length, 0, 'upgrade must preserve the default write gate');
  const result = await adapter.write(f.el, plan, { allowWrite: true, check: async () => {} });
  assert.equal(result.strategy, 'ui', 'writer closures must use the replacement model');
  assert.equal((await f.R.verify(f.el, plan, { settleMs: 0 })).status, 'success');
  assert.equal(f.props.value, 'UG');
  assert.equal(f.input.value, '本科');
});

test('reinjection of the current revision is inert and preserves registered adapters', t => {
  const f = boot(contracts[2]); t.after(() => f.dom.window.close());
  const model = f.w.ResumeControlModel, registry = f.R;
  registry.register({ name: 'reinjection-sentinel', lib: 'native', type: 'text', matches: () => false });
  const names = copy(registry.list());
  for (const source of files) f.w.eval(source);
  assert.equal(f.w.ResumeControlModel, model);
  assert.equal(f.w.ResumeControls, registry);
  assert.deepEqual(copy(registry.list()), names);
});
