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
const json = value => JSON.parse(JSON.stringify(value));
const options = [{ value: 'a', label: 'Alpha' }, { value: 2, label: 'Beta' }, { value: 'keep', label: 'Keep' }];

function boot(t, html = '<div id="app"></div>', libraries = false) {
  const dom = new JSDOM(`<!doctype html><body><form>${html}<input id="neighbor" value="KEEP">
    <button type="submit">Save</button></form></body>`,
  { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://offline.invalid/form' });
  const w = dom.window, effects = [], requests = [], apps = [];
  t.after(() => { for (const app of apps) app.$destroy(); dom.window.close(); });
  w.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  w.fetch = (...args) => { requests.push(args); throw Error('network_forbidden'); };
  w.XMLHttpRequest.prototype.open = (...args) => { requests.push(args); throw Error('network_forbidden'); };
  if (libraries) {
    for (const source of vendors) w.eval(source);
    w.Vue.config.productionTip = false; w.Vue.config.devtools = false;
    w.Vue.use(w.ELEMENT); w.Vue.use(w.antd);
  } else { w.ELEMENT = { version: '2.15.14' }; w.antd = { version: '1.7.8' }; }
  for (const source of sources) w.eval(source);
  for (const type of ['input', 'change', 'blur', 'click', 'submit', 'keydown'])
    w.document.addEventListener(type, event => effects.push({ type, target: event.target, key: event.key }), true);
  return { w, R: w.ResumeControls, effects, requests, apps, get: id => w.document.getElementById(id) };
}

function safe(f) {
  assert.equal(f.get('neighbor').value, 'KEEP');
  assert.equal(f.effects.some(event => event.type === 'submit' || event.target.id === 'neighbor'
    || event.target.closest('button[type="submit"],.el-tag__close,.ant-select-selection__choice__remove')), false);
  assert.deepEqual(f.requests, []); assert.equal(f.R.liveSupportClaimed, false);
}

const realCases = [
  ['Element multiple', 'el-select-multiple', '.el-select',
    '<el-select v-model="value" multiple><el-option label="Alpha" value="a"/><el-option label="Beta" :value="2"/><el-option label="Keep" value="keep"/></el-select>', ['Alpha', 'Beta'], ['keep', 'a', 2]],
  ['Element allow-create tags', 'el-select-multiple', '.el-select',
    '<el-select v-model="value" multiple filterable allow-create><el-option label="Keep" value="keep"/><el-option label="Alpha" value="a"/></el-select>', ['New tag', 'Alpha'], ['keep', 'New tag', 'a']],
  ['Ant multiple', 'antdv1-select-multiple', '.ant-select',
    '<a-select v-model="value" mode="multiple"><a-select-option value="a">Alpha</a-select-option><a-select-option :value="2">Beta</a-select-option><a-select-option value="keep">Keep</a-select-option></a-select>', ['Alpha', 'Beta'], ['keep', 'a', 2]],
  ['Ant tags', 'antdv1-select-multiple', '.ant-select',
    '<a-select v-model="value" mode="tags"><a-select-option value="keep">Keep</a-select-option><a-select-option value="a">Alpha</a-select-option></a-select>', ['New tag', 'Alpha'], ['keep', 'New tag', 'a']],
];

for (const [name, expected, selector, template, fact, codes] of realCases) {
  test(`real ${name}: additive multi-value panel clicks and separate chip/model readback`, async t => {
    const f = boot(t, undefined, true);
    const app = new f.w.Vue({ el: '#app', data: () => ({ value: ['keep'] }), template: `<main>${template}</main>` });
    f.apps.push(app);
    await f.w.Vue.nextTick();
    const root = f.w.document.querySelector(selector), input = root.querySelector('input');
    const adapter = f.R.resolve(input), plan = f.R.plan(input, { value: fact });
    assert.equal(adapter?.name, expected);
    assert.equal(plan.type, 'multi-select'); assert.equal(plan.status, 'planned', JSON.stringify(plan));
    assert.deepEqual(json(plan.value), codes);
    assert.equal((await adapter.write(input, plan)).reason, 'shadow_mode');
    assert.equal(f.effects.length, 0);
    const wrote = await adapter.write(input, plan, ctx);
    assert.equal(wrote.strategy, 'ui', JSON.stringify(wrote));
    assert.deepEqual(json(app.value), codes);
    assert.deepEqual(f.effects.filter(event => event.type === 'click' && event.target.closest(
      '.el-select-dropdown__item,.ant-select-dropdown-menu-item')).map(event => event.target.textContent.trim()), fact);
    const verified = await adapter.verify(input, plan, { settleMs: 0 });
    assert.equal(verified.status, 'success', JSON.stringify(verified));
    assert.deepEqual(json(verified.modelReadback), codes);
    assert.deepEqual(json(verified.domReadback), ['Keep', ...fact]);
    assert.equal(f.R.plan(input, { value: fact }).status, 'success');
    const count = f.effects.length;
    assert.equal((await adapter.write(input, plan, ctx)).attempts, 0);
    assert.equal(f.effects.length, count);
    safe(f);
  });
}

function replay(t, { ant = false, tags = false, selected = [], commit = true, paint = true } = {}) {
  const f = boot(t, `<div id="control" class="${ant ? 'ant-select' : 'el-select'}">
    <div class="${ant ? 'ant-select-selection' : 'el-select__tags'}"><input role="combobox" aria-controls="owned" aria-expanded="false"></div></div>
    <div id="owned" role="listbox" class="${ant ? 'ant-select-dropdown' : 'el-select-dropdown'}" hidden></div>`);
  const root = f.get('control'), input = root.querySelector('input'), menu = f.get('owned');
  const props = { value: [...selected], options: json(options), multiple: !ant, mode: ant ? tags ? 'tags' : 'multiple' : undefined,
    filterable: tags && !ant, allowCreate: tags && !ant };
  const vm = { $el: root, $options: { name: ant ? 'ASelect' : 'ElSelect' }, $props: props,
    $refs: { popper: { $el: menu } }, $slots: { default: [] } };
  root.__vue__ = vm;
  let clicks = 0;
  const chips = () => {
    root.querySelectorAll('.el-tag,.ant-select-selection__choice').forEach(node => node.remove());
    for (const value of props.value || []) {
      const chip = f.w.document.createElement('span'); chip.className = ant ? 'ant-select-selection__choice' : 'el-tag';
      const text = f.w.document.createElement('span'); text.className = ant ? 'ant-select-selection__choice__content' : 'el-select__tags-text';
      text.textContent = props.options.find(option => option.value === value)?.label ?? value;
      chip.append(text); input.before(chip);
    }
  };
  const render = () => {
    menu.innerHTML = '';
    const query = input.value;
    const list = [...props.options];
    if (tags && query && !list.some(option => option.label === query || option.value === query)) list.unshift({ value: query, label: query });
    for (const item of list) {
      const node = f.w.document.createElement('li'); node.className = ant ? 'ant-select-dropdown-menu-item' : 'el-select-dropdown__item';
      node.setAttribute('role', 'option'); node.textContent = item.label;
      if (item.disabled) { node.classList.add(ant ? 'ant-select-dropdown-menu-item-disabled' : 'is-disabled'); node.setAttribute('aria-disabled', 'true'); }
      if (item.hidden) node.hidden = true;
      node.addEventListener('click', () => {
        clicks++;
        if (commit && !(props.value || []).includes(item.value)) props.value = [...props.value || [], item.value];
        if (!props.options.includes(item)) props.options.push(item);
        if (paint) chips();
        input.value = '';
      });
      menu.append(node);
    }
  };
  const open = () => { menu.hidden = false; input.setAttribute('aria-expanded', 'true'); render(); };
  (ant ? input.parentElement : input).addEventListener('click', open);
  input.addEventListener('input', render);
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' || event.keyCode === 27) { menu.hidden = true; input.setAttribute('aria-expanded', 'false'); }
  });
  chips(); render();
  return { ...f, root, input, menu, props, vm, chips, render, clicks: () => clicks };
}

for (const ant of [false, true]) {
  test(`${ant ? 'Ant' : 'Element'} multi-select preserves preselection, numeric codes and deduplicates facts`, async t => {
    const f = replay(t, { ant, selected: ['keep'] }), adapter = f.R.resolve(f.input);
    const plan = f.R.plan(f.input, { value: ['Alpha', 2, 'Alpha'] });
    assert.equal(plan.status, 'planned'); assert.deepEqual(json(plan.value), ['keep', 'a', 2]);
    assert.deepEqual(json(plan.domValue), ['Keep', 'Alpha', 'Beta']);
    assert.equal((await adapter.write(f.input, plan, ctx)).strategy, 'ui');
    assert.equal(f.clicks(), 2); assert.equal(f.menu.hidden, true);
    assert.equal((await adapter.verify(f.input, plan, { settleMs: 0 })).status, 'success');
    assert.deepEqual(f.props.value, ['keep', 'a', 2]); safe(f);
  });
}

test('multi-select rejects scalar/objects, missing/disabled/ambiguous options and unsupported chip contracts without effects', t => {
  const cases = [
    [f => {}, 'Alpha'], [f => {}, [{ value: 'a', label: 'Alpha' }]], [f => {}, ['Unknown']],
    [f => { f.props.options[0].disabled = true; }, ['Alpha']],
    [f => { f.props.options.push({ value: 'other', label: 'Alpha' }); }, ['Alpha']],
    [f => { f.props.labelInValue = true; }, ['Alpha']], [f => { f.props.collapseTags = true; }, ['Alpha']],
    [f => { f.props.disabled = true; }, ['Alpha']], [f => { f.props.readonly = true; }, ['Alpha']],
    [f => { f.props.value = [{ value: 'a' }]; }, ['Alpha']],
  ];
  for (const [mutate, value] of cases) {
    const f = replay(t); mutate(f);
    assert.ok(['manual', 'unsupported'].includes(f.R.plan(f.input, { value }).status));
    assert.equal(f.effects.length, 0); safe(f);
  }
});

test('a query is never chip readback; model-only/DOM-only writes mismatch and settled changes revert', async t => {
  for (const ant of [false, true]) {
    const f = replay(t, { ant }), adapter = f.R.resolve(f.input), plan = f.R.plan(f.input, { value: ['Alpha', 'Beta'] });
    f.input.value = 'Alpha, Beta';
    assert.equal((await adapter.verify(f.input, plan, { settleMs: 0 })).status, 'mismatch');
    f.input.value = ''; f.props.value = ['a', 2];
    assert.equal((await adapter.verify(f.input, plan, { settleMs: 0 })).status, 'mismatch');
    f.chips(); assert.equal((await adapter.verify(f.input, plan, { settleMs: 0 })).status, 'success');
    f.props.value = []; assert.equal((await adapter.verify(f.input, plan, { settleMs: 0 })).status, 'mismatch');
    f.props.value = ['a', 2];
    f.w.setTimeout(() => { f.props.value = ['a', '2']; }, 1);
    assert.equal((await adapter.verify(f.input, plan, { settleMs: 20 })).status, 'reverted');
    assert.equal((await adapter.verify(f.input, plan, { settleMs: 0, previousSuccess: true })).status, 'reverted');
    safe(f);
  }
});

test('plans remain bound to original root/owner and unknown versions do not downgrade to text', async t => {
  const f = replay(t), other = replay(t), adapter = f.R.resolve(f.input), plan = f.R.plan(f.input, { value: ['Alpha'] });
  assert.equal((await other.R.resolve(other.input).write(other.input, plan, ctx)).status, 'unsupported');
  f.root.__vue__ = { ...f.vm, $props: { ...f.props } };
  assert.equal((await adapter.write(f.input, plan, ctx)).status, 'unsupported');
  f.w.ELEMENT.version = '99.0.0'; assert.equal(f.R.resolve(f.input), null);
  assert.equal(f.R.plan(f.input, { value: ['Alpha'] }).status, 'manual');
  assert.equal(f.effects.length, 0); assert.equal(other.effects.length, 0); safe(f); safe(other);
});

test('null/undefined models start empty; limits and disabled/readonly controls refuse all effects', async t => {
  for (const value of [null, undefined]) {
    const f = replay(t); f.props.value = value;
    const adapter = f.R.resolve(f.input), plan = f.R.plan(f.input, { value: ['Alpha'] });
    assert.equal(plan.status, 'planned', JSON.stringify(plan));
    assert.equal((await adapter.write(f.input, plan, ctx)).strategy, 'ui');
    assert.equal((await adapter.verify(f.input, plan, { settleMs: 0 })).status, 'success'); safe(f);
  }
  for (const flag of ['multipleLimit', 'disabled', 'readonly']) {
    const f = replay(t), adapter = f.R.resolve(f.input), plan = f.R.plan(f.input, { value: ['Alpha', 'Beta'] });
    f.props[flag] = flag === 'multipleLimit' ? 1 : true;
    assert.ok(['manual', 'unsupported'].includes(f.R.plan(f.input, { value: ['Alpha', 'Beta'] }).status));
    assert.equal((await adapter.write(f.input, plan, ctx)).status, 'unsupported');
    assert.equal(f.effects.length, 0); safe(f);
  }
});

test('unknown chip comboboxes stay manual; reinjection retains exactly one multi-select adapter per library', t => {
  const f = boot(t, '<div role="combobox" class="chips"><span class="chip">Keep</span><input id="query"></div>');
  assert.equal(f.R.resolve(f.get('query')), null);
  assert.equal(f.R.plan(f.get('query'), { value: ['Alpha'] }).status, 'manual');
  const previous = f.R;
  for (const source of sources) f.w.eval(source);
  assert.equal(f.w.ResumeControls, previous);
  assert.deepEqual(json(f.R.list().filter(adapter => adapter.type === 'multi-select').map(adapter => adapter.name)).sort(),
    ['antdv1-select-multiple', 'el-select-multiple']);
  assert.equal(f.effects.length, 0); safe(f);
});

test('multi-select stops before option click on owner/panel/metadata changes or a foreign overlay', async t => {
  const mutations = {
    owner: f => { f.root.__vue__ = { ...f.vm }; },
    code: f => { f.props.options[0].value = 'changed'; },
    disabled: f => { f.props.options[0].disabled = true; },
    readonly: f => { f.props.readonly = true; },
    popper: f => { f.vm.$refs.popper.$el = f.get('neighbor'); },
    overlay: f => { const node = f.w.document.createElement('div'); node.className = 'ant-select-dropdown'; f.w.document.body.append(node); },
  };
  for (const [name, mutate] of Object.entries(mutations)) {
    const f = replay(t), adapter = f.R.resolve(f.input), plan = f.R.plan(f.input, { value: ['Alpha', 'Beta'] });
    f.menu.addEventListener('pointerdown', () => mutate(f), { once: true });
    const wrote = await adapter.write(f.input, plan, ctx).catch(error => ({ status: 'unsupported', reason: error.message }));
    assert.equal(wrote.status, 'unsupported', name); assert.equal(f.clicks(), 0, name);
    assert.deepEqual(f.props.value, [], name); safe(f);
  }
});

test('a concurrent actor selecting the next target before click is preserved, never toggled off', async t => {
  const f = boot(t, undefined, true);
  const app = new f.w.Vue({ el: '#app', data: () => ({ value: [] }), template: `<main>${realCases[2][3]}</main>` });
  f.apps.push(app); await f.w.Vue.nextTick();
  const input = f.w.document.querySelector('.ant-select input'), adapter = f.R.resolve(input);
  const plan = f.R.plan(input, { value: ['Alpha', 'Beta'] });
  let changed = false;
  f.w.document.addEventListener('pointerdown', event => {
    if (!changed && event.target.closest('.ant-select-dropdown-menu-item')) {
      changed = true; app.value = ['a'];
    }
  }, true);
  const wrote = await adapter.write(input, plan, ctx).catch(error => ({ status: 'unsupported', reason: error.message }));
  assert.equal(wrote.status, 'unsupported'); assert.equal(changed, true);
  assert.deepEqual(json(app.value), ['a']);
  assert.equal(f.effects.some(event => event.type === 'click' && event.target.closest('.ant-select-dropdown-menu-item')), false);
  safe(f);
});
