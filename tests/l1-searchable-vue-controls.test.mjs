import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const sources = ['model', 'registry', 'native', 'vue-controls'].map(name =>
  readFileSync(new URL(`../src/content/controls/${name}.js`, import.meta.url), 'utf8'));
const vendors = ['vue/dist/vue.js', 'element-ui/lib/index.js', 'ant-design-vue/dist/antd.js']
  .map(name => readFileSync(require.resolve(name), 'utf8'));
const ctx = { allowWrite: true, check: async () => {} };
const label = 'Alpha Institute';

function boot(html = '<div id="app"></div>', libraries = false) {
  const dom = new JSDOM(`<!doctype html><body><form>${html}<input id="neighbor" value="KEEP">
    <button type="submit">Save</button></form></body>`,
  { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://offline.invalid/form' });
  const { window: w } = dom, effects = [];
  w.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  if (libraries) {
    for (const source of vendors) w.eval(source);
    w.Vue.config.productionTip = false; w.Vue.config.devtools = false;
    w.Vue.use(w.ELEMENT); w.Vue.use(w.antd);
  } else {
    w.ELEMENT = { version: '2.15.14' }; w.antd = { version: '1.7.8' };
  }
  for (const source of sources) w.eval(source);
  for (const type of ['input', 'change', 'blur', 'click', 'submit']) {
    w.document.addEventListener(type, event => effects.push({ type, target: event.target }), true);
  }
  return { dom, w, R: w.ResumeControls, M: w.ResumeControlModel, effects,
    get: id => w.document.getElementById(id) };
}

function safe(f) {
  assert.equal(f.get('neighbor').value, 'KEEP');
  assert.equal(f.effects.some(event => event.type === 'submit' || event.target.id === 'neighbor'
    || event.target.matches('button[type="submit"]')), false);
  assert.equal(f.R.liveSupportClaimed, false);
}

const realCases = [
  { name: 'Element autocomplete', adapter: 'el-autocomplete', selector: '.el-autocomplete', model: label,
    template: '<el-autocomplete v-model="value" :fetch-suggestions="suggest" :debounce="0" :trigger-on-focus="false"/>',
    option: '.el-autocomplete-suggestion li' },
  { name: 'Ant autocomplete', adapter: 'antdv1-autocomplete', selector: '.ant-select', model: label,
    template: '<a-auto-complete v-model="value" :data-source="choices" @search="search"/>',
    option: '.ant-select-dropdown-menu-item' },
  { name: 'Element filterable remote select', adapter: 'el-select-search', selector: '.el-select', model: 'alpha-code',
    template: '<el-select v-model="value" filterable remote :remote-method="search"><el-option v-for="choice in choices" :key="choice.value" :value="choice.value" :label="choice.label"/></el-select>',
    option: '.el-select-dropdown__item' },
  { name: 'Element local filterable select', adapter: 'el-select-search', selector: '.el-select', model: 'alpha-code',
    template: '<el-select v-model="value" filterable><el-option label="Alpha Institute" value="alpha-code"/><el-option label="Beta Institute" value="beta-code"/></el-select>',
    option: '.el-select-dropdown__item' },
  { name: 'Ant filterable select', adapter: 'antdv1-select-search', selector: '.ant-select', model: 'alpha-code',
    template: '<a-select v-model="value" show-search option-filter-prop="children"><a-select-option value="alpha-code">Alpha Institute</a-select-option><a-select-option value="beta-code">Beta Institute</a-select-option></a-select>',
    option: '.ant-select-dropdown-menu-item' },
];

for (const spec of realCases) {
  test(`real ${spec.name} filters by input, clicks an option and reads model plus display`, async t => {
    const f = boot(undefined, true), queries = [], clicks = [];
    const app = new f.w.Vue({ el: '#app', data: () => ({ value: undefined, choices: [] }),
      methods: {
        suggest(query, callback) {
          queries.push(query);
          f.w.setTimeout(() => callback([{ value: label }, { value: 'Beta Institute' }]
            .filter(option => option.value.includes(query))), 15);
        },
        search(query) {
          queries.push(query);
          f.w.setTimeout(() => { this.choices = spec.model === label ? [label]
            : [{ value: spec.model, label }]; }, 15);
        },
      }, template: `<main>${spec.template}</main>` });
    t.after(() => { app.$destroy(); f.dom.window.close(); });
    await f.w.Vue.nextTick();
    const root = f.w.document.querySelector(spec.selector), input = root.querySelector('input');
    const adapter = f.R.resolve(input), plan = f.R.plan(input, { value: label });
    assert.equal(adapter?.name, spec.adapter);
    assert.equal(plan.status, 'planned');
    assert.equal(f.M.inspect(input).controlRoot, root);
    assert.equal((await adapter.write(input, plan)).reason, 'shadow_mode');
    assert.equal(f.effects.length, 0);
    if (spec.model === label) {
      app.value = label; await f.w.Vue.nextTick(); input.value = label;
      assert.notEqual((await adapter.verify(input, plan, { settleMs: 0 })).status, 'success',
        'autocomplete text and query model alone do not prove an option was selected');
      app.value = undefined; await f.w.Vue.nextTick(); input.value = '';
    }
    f.w.document.addEventListener('click', event => {
      if (event.target.closest(spec.option)) clicks.push(event.target.closest(spec.option).textContent.trim());
    }, true);
    const wrote = await adapter.write(input, plan, ctx);
    assert.equal(wrote.strategy, 'ui', JSON.stringify(wrote));
    assert.deepEqual(clicks, [label]);
    assert.equal(app.value, spec.model);
    if (!spec.name.includes('Ant filterable') && !spec.name.includes('local filterable')) assert.ok(queries.includes(label));
    const beforePick = f.effects.slice(0, f.effects.findIndex(event =>
      event.type === 'click' && event.target.closest(spec.option)));
    assert.equal(beforePick.some(event => event.target === input
      && ['change', 'blur'].includes(event.type)), false, 'filtering must not blur or commit the query');
    const verified = await adapter.verify(input, plan, { settleMs: 0 });
    assert.equal(verified.status, 'success', JSON.stringify(verified));
    assert.equal(verified.modelReadback, spec.model);
    assert.equal(verified.domReadback, label);
    const selected = root.querySelector('.ant-select-selection-selected-value');
    if (selected) selected.textContent = 'Painted only'; else input.value = 'Painted only';
    assert.notEqual((await adapter.verify(input, plan, { settleMs: 0 })).status, 'success');
    safe(f);
  });
}

function replay({ kind = 'ElSelect', duplicate = false, disabled = false, hidden = false,
  modelCommit = true, code = 'alpha-code' } = {}) {
  const ant = kind.startsWith('A'), autocomplete = /Auto/iu.test(kind);
  const rootClass = ant ? `ant-select${autocomplete ? ' ant-select-auto-complete' : ''}` : autocomplete ? 'el-autocomplete' : 'el-select';
  const menuClass = ant ? 'ant-select-dropdown' : autocomplete ? 'el-autocomplete-suggestion' : 'el-select-dropdown';
  const optionClass = ant ? 'ant-select-dropdown-menu-item' : autocomplete ? '' : 'el-select-dropdown__item';
  const f = boot(`<div id="control" class="${rootClass}"><div class="ant-select-selection">
      <input role="combobox" aria-controls="owned" aria-expanded="false"></div></div>
    <div id="owned" role="listbox" class="${menuClass}" hidden></div>`);
  const root = f.get('control'), input = root.querySelector('input'), menu = f.get('owned');
  const props = { value: '', filterable: !ant, showSearch: ant, remote: true, options: [], dataSource: [] };
  const vm = { $el: root, $options: { name: kind }, $props: props,
    $refs: { popper: { $el: menu }, suggestions: { $el: menu } }, $slots: { default: [] }, suggestions: [] };
  root.__vue__ = vm;
  let selections = 0;
  input.addEventListener('click', () => { menu.hidden = false; input.setAttribute('aria-expanded', 'true'); });
  root.querySelector('.ant-select-selection').addEventListener('click', () => {
    menu.hidden = false; input.setAttribute('aria-expanded', 'true');
  });
  input.addEventListener('input', () => {
    if (autocomplete) props.value = input.value;
    f.w.setTimeout(() => {
      props.options = [{ value: autocomplete ? label : code, label }];
      props.dataSource = [label]; vm.suggestions = [{ value: label }];
      menu.innerHTML = '';
      for (let index = 0; index < (duplicate ? 2 : 1); index++) {
        const option = f.w.document.createElement('li');
        option.className = optionClass; option.setAttribute('role', 'option'); option.textContent = label;
        if (disabled) { option.classList.add(ant ? 'ant-select-dropdown-menu-item-disabled' : 'is-disabled'); option.setAttribute('aria-disabled', 'true'); }
        if (hidden) option.hidden = true;
        option.addEventListener('click', () => {
          selections++;
          if (modelCommit) props.value = autocomplete ? label : code;
          input.value = label;
          if (ant && !autocomplete) {
            const selected = f.w.document.createElement('span'); selected.className = 'ant-select-selection-selected-value';
            selected.textContent = label; root.append(selected);
          }
          menu.hidden = true; input.setAttribute('aria-expanded', 'false');
        });
        menu.append(option);
      }
    }, 10);
  });
  return { ...f, root, input, menu, props, vm, selections: () => selections };
}

test('search options cannot succeed on a painted query or an uncommitted selection', async t => {
  const f = replay({ modelCommit: false }); t.after(() => f.dom.window.close());
  const adapter = f.R.resolve(f.input), plan = f.R.plan(f.input, { value: label });
  assert.equal(plan.status, 'planned');
  f.input.value = label;
  assert.equal((await adapter.verify(f.input, plan, { settleMs: 0 })).status, 'mismatch');
  f.input.value = '';
  assert.equal((await adapter.write(f.input, plan, ctx)).strategy, 'ui');
  assert.equal(f.selections(), 1);
  assert.notEqual((await adapter.verify(f.input, plan, { settleMs: 0 })).status, 'success');
  safe(f);
});

test('filtering excludes hidden, disabled and duplicate exact options', async t => {
  for (const options of [{ duplicate: true }, { disabled: true }, { hidden: true }]) {
    const f = replay(options); t.after(() => f.dom.window.close());
    const adapter = f.R.resolve(f.input), plan = f.R.plan(f.input, { value: label });
    assert.equal(plan.status, 'planned');
    const wrote = await adapter.write(f.input, plan, ctx);
    assert.equal(wrote.status, 'unsupported');
    assert.equal(f.selections(), 0);
    assert.equal(f.props.value, '');
    assert.notEqual((await adapter.verify(f.input, plan, { settleMs: 0 })).status, 'success');
    safe(f);
  }
});

test('search never clicks an option through a conflicting owner or a second visible portal', async t => {
  for (const conflict of ['owner', 'portal', 'peer']) {
    const f = replay(); t.after(() => f.dom.window.close());
    const foreign = f.w.document.createElement('div');
    foreign.id = 'foreign'; foreign.setAttribute('role', 'listbox');
    foreign.className = 'el-select-dropdown'; foreign.hidden = true; f.w.document.body.append(foreign);
    if (conflict === 'owner') f.input.setAttribute('aria-controls', 'foreign');
    else if (conflict === 'portal') f.input.addEventListener('input', () => { foreign.hidden = false; });
    else {
      const peer = f.w.document.createElement('input'); peer.setAttribute('role', 'combobox');
      peer.setAttribute('aria-controls', 'owned'); f.w.document.body.append(peer);
    }
    const adapter = f.R.resolve(f.input), plan = f.R.plan(f.input, { value: label });
    assert.equal(plan.status, 'planned');
    const wrote = await adapter.write(f.input, plan, ctx).catch(error => ({ status: 'unsupported', reason: error.message }));
    assert.equal(wrote.status, 'unsupported');
    assert.equal(f.selections(), 0);
    assert.equal(f.props.value, '');
    safe(f);
  }
});

test('option metadata and search writability are rechecked after pointerdown before click', async t => {
  const mutations = {
    code: f => { f.props.options[0].value = 'changed-code'; },
    label: f => { f.props.options[0].label = 'Changed label'; },
    disabled: f => { f.props.options[0].disabled = true; },
    readonly: f => { f.input.readOnly = true; },
    ariaReadonly: f => { f.input.setAttribute('aria-readonly', 'true'); },
    loading: f => { f.vm.loading = true; },
    busy: f => { f.menu.setAttribute('aria-busy', 'true'); },
    extraInput: f => { f.root.append(f.w.document.createElement('input')); },
    replacedInput: f => { f.input.replaceWith(f.input.cloneNode(true)); },
    changedPopper: f => { f.vm.$refs.popper.$el = f.get('neighbor'); },
    removedPopper: f => { delete f.vm.$refs.popper; },
  };
  for (const [name, mutate] of Object.entries(mutations)) {
    const f = replay(); t.after(() => f.dom.window.close());
    const adapter = f.R.resolve(f.input), plan = f.R.plan(f.input, { value: label });
    assert.equal(plan.status, 'planned');
    let pointerdowns = 0;
    f.w.document.addEventListener('pointerdown', event => {
      if (event.target.matches('[role="option"]')) { pointerdowns++; mutate(f); }
    }, true);
    const wrote = await adapter.write(f.input, plan, ctx).catch(error => ({ status: 'unsupported', reason: error.message }));
    assert.equal(wrote.status, 'unsupported', name);
    assert.equal(pointerdowns, 1, name);
    assert.equal(f.selections(), 0, name);
    assert.equal(f.props.value, '', name);
    assert.equal(f.effects.some(event => event.type === 'click' && event.target.matches('[role="option"]')), false, name);
    safe(f);
  }
});

test('a value entered by another actor during filtering is preserved before option click', async t => {
  const f = replay(); t.after(() => f.dom.window.close());
  const adapter = f.R.resolve(f.input), plan = f.R.plan(f.input, { value: label });
  f.input.addEventListener('input', () => { f.props.value = 'KEEP'; });
  const wrote = await adapter.write(f.input, plan, ctx).catch(error => ({ status: 'unsupported', reason: error.message }));
  assert.equal(wrote.status, 'unsupported'); assert.equal(f.selections(), 0);
  assert.equal(f.props.value, 'KEEP'); safe(f);
});

test('deferred searches read back an observed numeric code without string conversion', async t => {
  const f = replay({ code: 17 }); t.after(() => f.dom.window.close());
  const adapter = f.R.resolve(f.input), plan = f.R.plan(f.input, { value: label });
  assert.equal(plan.status, 'planned'); assert.equal(plan.requiresOptionResolution, true);
  assert.equal((await adapter.write(f.input, plan, ctx)).strategy, 'ui');
  const verified = await adapter.verify(f.input, plan, { settleMs: 0 });
  assert.equal(verified.status, 'success');
  assert.equal(verified.modelReadback, 17); assert.equal(verified.domReadback, label);
  safe(f);
});

test('search plans preserve existing data and recheck component ownership before every effect', async t => {
  for (const kind of ['ElAutocomplete', 'AAutoComplete', 'ElSelect', 'ASelect']) {
    const f = replay({ kind }); t.after(() => f.dom.window.close());
    const adapter = f.R.resolve(f.input), plan = f.R.plan(f.input, { value: label });
    assert.ok(adapter, kind);
    for (const flag of ['disabled', 'readonly']) {
      f.props[flag] = true;
      assert.equal(f.R.plan(f.input, { value: label }).status, 'manual', `${kind}: ${flag}`);
      assert.equal((await adapter.write(f.input, plan, ctx)).status, 'unsupported');
      f.props[flag] = false;
    }
    f.props.value = 'KEEP'; f.input.value = 'KEEP';
    assert.equal(f.R.plan(f.input, { value: label }).reason, 'existing_value');
    assert.equal((await adapter.write(f.input, plan, ctx)).reason, 'existing_value');
    f.props.value = ''; f.input.value = '';
    const detachedPlan = f.R.plan(f.input, { value: label });
    let checks = 0;
    const wrote = await adapter.write(f.input, detachedPlan, { allowWrite: true, check: async () => {
      if (++checks === 2) f.root.__vue__ = { ...f.vm, $props: { ...f.props } };
    } }).catch(error => ({ reason: error.message }));
    assert.equal(wrote.status === 'unsupported' || /changed/u.test(wrote.reason), true, JSON.stringify(wrote));
    assert.equal(f.selections(), 0);
    assert.equal(f.effects.length, 0);
    safe(f);
  }
});

test('unconfirmed autocomplete versions cannot fall through to their nested plain inputs', t => {
  for (const kind of ['ElAutocomplete', 'AAutoComplete']) {
    const f = replay({ kind }); t.after(() => f.dom.window.close());
    const inputVm = { $el: f.input.parentElement, $options: { name: kind.startsWith('El') ? 'ElInput' : 'AInput' },
      $props: { value: '' }, $parent: f.vm };
    f.input.parentElement.__vue__ = inputVm;
    const exported = kind.startsWith('El') ? f.w.ELEMENT : f.w.antd;
    exported.version = '99.0.0';
    assert.equal(f.R.resolve(f.input), null);
    assert.equal(f.R.plan(f.input, { value: label }).status, 'manual');
    assert.equal(f.effects.length, 0);
    safe(f);
  }
});

test('unknown or malformed outer autocomplete cannot borrow its nested Ant Select contract', t => {
  for (const [outerName, classes] of [
    ['UnknownAutocomplete', 'ant-select'],
    ['Mystery', 'ant-select ant-select-auto-complete'],
    ['AAutoComplete', 'ant-select'],
  ]) {
    const f = replay({ kind: 'AAutoComplete' }); t.after(() => f.dom.window.close());
    f.root.className = classes; f.vm.$options.name = outerName;
    f.root.__vue__ = { $el: f.root, $options: { name: 'ASelect' },
      $props: { value: '', options: [{ value: label, label }] }, $parent: f.vm };
    assert.equal(f.R.resolve(f.input), null, outerName);
    assert.equal(f.R.plan(f.input, { value: label }).status, 'manual');
    assert.equal(f.effects.length, 0); safe(f);
  }
});

test('editing public search flags cannot turn an autocomplete query into selected readback', async t => {
  for (const kind of ['ElAutocomplete', 'AAutoComplete']) {
    const f = replay({ kind }); t.after(() => f.dom.window.close());
    const adapter = f.R.resolve(f.input);
    for (const edit of ['delete', 'replace']) {
      const plan = f.R.plan(f.input, { value: label });
      assert.equal(plan.status, 'planned');
      assert.equal(!!(plan.requiresOptionClick || plan.requiresOptionResolution), true);
      if (edit === 'delete') { delete plan.requiresOptionClick; delete plan.requiresOptionResolution; }
      else { plan.requiresOptionClick = false; plan.requiresOptionResolution = false; }
      f.props.value = label; f.input.value = label;
      assert.notEqual((await adapter.verify(f.input, plan, { settleMs: 0 })).status, 'success', `${kind}: ${edit}`);
      f.props.value = ''; f.input.value = '';
    }
    assert.equal(f.effects.length, 0); safe(f);
  }
});

test('search readback observes later model reversion and library version changes', async t => {
  const f = replay(); t.after(() => f.dom.window.close());
  const adapter = f.R.resolve(f.input), plan = f.R.plan(f.input, { value: label });
  assert.equal(plan.status, 'planned');
  await adapter.write(f.input, plan, ctx);
  assert.equal((await adapter.verify(f.input, plan, { settleMs: 0 })).status, 'success');
  f.w.setTimeout(() => { f.props.value = ''; }, 5);
  assert.equal((await adapter.verify(f.input, plan, { settleMs: 20 })).status, 'reverted');
  f.props.value = 'alpha-code'; f.w.ELEMENT.version = '3.0.0';
  assert.notEqual((await adapter.verify(f.input, plan, { settleMs: 0 })).status, 'success');
  assert.equal(f.R.resolve(f.input), null);
  safe(f);
});
