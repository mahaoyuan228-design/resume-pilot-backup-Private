/**
 * Installed Vue/Ant source-compatibility regressions for a missing root
 * expando. These offline fixtures are not a captured CMS topology. Controls
 * remain closed; current VNodes supply definition evidence only.
 */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import inspector from 'node:inspector';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import { ROW_D_FIELDS, ROW_D_PAGE, inspectCmsRowDOptions,
  buildCmsRowDOptionsProbeExpression } from '../scripts/lib/cms-row-d-options.mjs';

const require = createRequire(import.meta.url);
const dom = new JSDOM('<!doctype html><body></body>', { url: ROW_D_PAGE, pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'Element', 'HTMLElement']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: name === 'window' ? dom.window : dom.window[name] });
}
const Vue = require('vue');
const ASelect = require('ant-design-vue/lib/select').default;
const AFormItem = require('ant-design-vue/lib/form/FormItem').default;
Vue.config.productionTip = false;
Vue.config.devtools = false;
const FIELD = ROW_D_FIELDS[0];
const PRIVATE = 'ROOT_ANCHOR_PRIVATE_SELECTED_VALUE';
const document = dom.window.document;
Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' });
after(() => dom.window.close());

const own = (object, key) => {
  const descriptor = object && Object.getOwnPropertyDescriptor(object, key);
  return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
};
function componentFor(select) {
  for (let current = own(select, '__vue__'), depth = 0; current && depth < 8; depth += 1) {
    const component = own(own(current, '$vnode'), 'componentOptions');
    if (own(own(own(component, 'Ctor'), 'options'), 'name') === 'Select') return current;
    current = own(own(current, '_vnode'), 'componentInstance');
  }
  throw new Error('offline_fixture_missing_select_component');
}
async function fixture({ slots = false } = {}) {
  document.body.innerHTML = '<div id="mount"></div>';
  const restores = [];
  const replace = (object, key, value) => {
    const before = Object.getOwnPropertyDescriptor(object, key);
    Object.defineProperty(object, key, { configurable: true, writable: true, value });
    restores.push(() => before ? Object.defineProperty(object, key, before) : delete object[key]);
  };
  const poison = (object, key, onRead) => {
    const before = Object.getOwnPropertyDescriptor(object, key);
    Object.defineProperty(object, key, { configurable: true, get() { onRead(); throw new Error(PRIVATE); } });
    restores.push(() => before ? Object.defineProperty(object, key, before) : delete object[key]);
  };
  const OwnedControl = {
    name: 'OfflineOwnedControl', props: ['labels'],
    render(h) {
      const props = { value: PRIVATE };
      if (!slots) props.options = this.labels.map((label, index) => ({ label, value: `opaque_${index}` }));
      return h('div', { class: 'offline-owned-control' }, [h('div', { class: 'offline-current-path' }, [
        h(ASelect, { props }, slots ? this.labels.map((label, index) =>
          h(ASelect.Option, { key: index, props: { value: `opaque_${index}` } }, [label])) : undefined)
      ])]);
    }
  };
  const vm = new Vue({ data: () => ({ labels: [...FIELD.options] }), render(h) {
    return h('section', { class: 'form-cell', attrs: { id: FIELD.sectionId } }, [
      h('div', { attrs: { id: FIELD.wrapperId } }, [
        h(AFormItem, { props: { label: FIELD.label } }, [h(OwnedControl, { props: { labels: this.labels } })])
      ])
    ]);
  }}).$mount('#mount');
  await Vue.nextTick();
  const item = document.querySelector('.ant-form-item');
  const select = item.querySelector('.ant-select');
  const control = item.querySelector('.offline-owned-control');
  const anchor = own(control, '__vue__');
  const render = own(anchor, '_vnode');
  const pathVNode = own(render, 'children')[0];
  const selectVNode = own(pathVNode, 'children')[0];
  const component = componentFor(select);
  const props = own(own(component, '$options'), 'propsData');
  const combo = select.querySelector('[role="combobox"]');
  assert.equal(own(selectVNode, 'elm'), select);
  assert.equal(own(own(selectVNode, 'componentInstance'), '$vnode'), selectVNode);
  assert.equal(document.querySelectorAll('.ant-select-dropdown').length, 0);
  return { vm, item, select, control, anchor, render, pathVNode, selectVNode, component, props, combo, replace, poison,
    drop: () => replace(select, '__vue__', null),
    read: () => inspectCmsRowDOptions(document).fields[0],
    close() { for (const restore of restores.reverse()) restore(); vm.$destroy(); }
  };
}
function safe(row) {
  for (const [key, value] of Object.entries({ neverSave: true, probeOnly: true, mutationAllowed: false,
    writeStarted: false, valuesExposed: false, liveSupportClaimed: false, livePassClaimed: false })) assert.equal(row[key], value);
  assert.equal(JSON.stringify(row).includes(PRIVATE), false);
  assert.equal(document.querySelectorAll('.ant-select-dropdown').length, 0);
}
function observed(row) {
  safe(row);
  assert.equal(row.ok, true, JSON.stringify(row));
  assert.equal(row.reason, 'read_only_options_preflight');
  assert.equal(row.optionsEvidenceSource, 'owned_select_vnodes');
  assert.equal(row.optionsReadiness, 'target_missing');
  assert.equal(row.observedOptionCount, 2);
}
function unavailable(row, issue) {
  safe(row);
  assert.equal(row.ok, false);
  assert.equal(row.reason, 'current_options_unavailable');
  assert.equal(Object.hasOwn(row, 'optionsEvidenceSource'), false);
  assert.equal(Object.hasOwn(row, 'observedOptionCount'), false);
  if (issue) assert.equal(row.optionsDefinitionIssue, issue);
}

for (const slots of [false, true]) for (const missing of ['deleted', 'null']) {
  test(`installed ${slots ? 'slotted' : 'options-prop'} select recovers a ${missing} expando through its current local ancestor render`, async () => {
    const f = await fixture({ slots });
    try {
      observed(f.read());
      f.drop(); if (missing === 'deleted') delete f.select.__vue__;
      observed(f.read());
      f.vm.labels = [...FIELD.options].reverse(); await Vue.nextTick();
      f.drop();
      const row = f.read(); safe(row);
      assert.equal(row.reason, 'option_dictionary_mismatch', 'only updated current definitions are inspected');
      assert.equal(row.optionsEvidenceSource, 'owned_select_vnodes');
    } finally { f.close(); }
  });
}

test('installed Ant FormItem current Row/Col render path can be the final allowed ancestor anchor', async () => {
  const f = await fixture();
  try {
    f.drop();
    for (let node = f.select.parentElement; node !== f.item; node = node.parentElement) f.replace(node, '__vue__', null);
    assert.ok(own(f.item, '__vue__'), 'the installed FormItem owns the item root');
    observed(f.read());
  } finally { f.close(); }
});

test('section, foreign field, and descendant icon anchors do not substitute for a missing local ancestor', async () => {
  const f = await fixture();
  try {
    f.drop();
    for (let node = f.select.parentElement; node; node = node.parentElement) {
      f.replace(node, '__vue__', null); if (node === f.item) break;
    }
    assert.ok(own(document.querySelector('.form-cell'), '__vue__'));
    assert.ok([...f.select.querySelectorAll('*')].some(node => own(node, '__vue__')), 'real icon descendants have separate anchors');
    const foreign = document.createElement('div'); foreign.className = 'ant-form-item';
    Object.defineProperty(foreign, '__vue__', { value: f.anchor }); document.body.append(foreign);
    unavailable(f.read(), 'root_anchor_missing');
  } finally { f.close(); }
});

test('a malformed original select anchor remains authoritative despite a valid local ancestor', async () => {
  const f = await fixture();
  try { f.replace(f.select, '__vue__', {}); unavailable(f.read(), 'current_root_unverified'); }
  finally { f.close(); }
});

for (const [name, mutate, issue = 'current_chain_unverified'] of [
  ['foreign ancestor root', f => f.replace(f.anchor, '$el', document.createElement('div')), 'current_root_unverified'],
  ['foreign ancestor render root', f => f.replace(f.render, 'elm', document.createElement('div')), 'current_root_unverified'],
  ['stale component parent VNode', f => {
    const current = own(f.selectVNode, 'componentInstance');
    f.replace(current, '$vnode', Object.create(Object.getPrototypeOf(f.selectVNode), Object.getOwnPropertyDescriptors(f.selectVNode)));
  }],
  ['unrendered slot-only definitions', f => {
    f.replace(f.pathVNode, 'children', []);
    f.replace(f.pathVNode, 'componentOptions', { children: [f.selectVNode] });
  }],
  ['cycle', f => f.replace(f.render, 'children', [f.render])],
  ['duplicate rendered path', f => f.replace(f.render, 'children', [f.pathVNode, f.pathVNode])],
  ['sparse rendered children', f => f.replace(f.render, 'children', new Array(1))],
  ['inherited child entry', f => {
    const children = new Array(1); Object.setPrototypeOf(children, { 0: f.pathVNode });
    f.replace(f.render, 'children', children);
  }],
  ['wide rendered child list', f => f.replace(f.render, 'children', Array.from({ length: 257 }, () => ({ elm: f.control })))],
  ['deep rendered path', f => {
    let vnode = f.selectVNode;
    for (let depth = 0; depth < 34; depth += 1) vnode = { elm: f.control, children: [vnode] };
    f.replace(f.render, 'children', [vnode]);
  }],
  ['large rendered graph', f => f.replace(f.render, 'children', Array.from({ length: 256 }, () =>
    ({ elm: f.control, children: [{ elm: f.control, children: [] }] })))],
  ['aria drift', f => f.combo.setAttribute('aria-controls', 'offline-wrong-reference'), 'aria_binding_unverified']
]) test(`local recovery rejects ${name}`, async () => {
  const f = await fixture();
  try { f.drop(); mutate(f); unavailable(f.read(), issue); }
  finally { f.close(); }
});

test('bounded DOM ancestry does not search beyond an excessively deep local path', async () => {
  const f = await fixture();
  const parent = f.select.parentElement;
  try {
    f.drop();
    let current = f.select;
    for (let depth = 0; depth < 17; depth += 1) {
      const wrapper = document.createElement('div'); current.replaceWith(wrapper); wrapper.append(current); current = wrapper;
    }
    unavailable(f.read(), 'root_anchor_missing');
  } finally { parent.append(f.select); f.close(); }
});

test('recovery never invokes anchor/render/child getters or selected/reactive/cache accessors', async () => {
  const f = await fixture();
  let reads = 0;
  const count = () => { reads += 1; };
  try {
    f.drop();
    for (const key of ['$children', '$refs', '$slots', '_data', '_props']) f.poison(f.anchor, key, count);
    for (const key of ['_optionsInfo', '_inputValue', '_value']) f.poison(f.component, key, count);
    f.poison(f.props, 'value', count);
    for (const option of own(f.props, 'children')) f.poison(own(option, 'componentOptions').propsData, 'value', count);
    for (const input of f.select.querySelectorAll('input')) f.poison(input, 'value', count);
    for (const selected of f.select.querySelectorAll('.ant-select-selection-selected-value')) f.poison(selected, 'textContent', count);
    f.poison(own(f.render, 'children'), Symbol.iterator, count);
    observed(f.read()); assert.equal(reads, 0);
    f.poison(f.pathVNode, 'children', count);
    unavailable(f.read()); assert.equal(reads, 0);
  } finally { f.close(); }
});

for (const [name, locate] of [
  ['original expando', f => [f.select, '__vue__']],
  ['ancestor expando', f => [f.control, '__vue__']],
  ['ancestor render', f => [f.anchor, '_vnode']],
  ['current VNode elm', f => [f.pathVNode, 'elm']]
]) test(`recovery rejects ${name} accessors without invocation`, async () => {
  const f = await fixture(); let reads = 0;
  try {
    f.drop(); const [object, key] = locate(f); f.poison(object, key, () => { reads += 1; });
    unavailable(f.read()); assert.equal(reads, 0);
  } finally { f.close(); }
});

test('serialized local recovery retains the real V8 guard against Proxy descriptor effects', async () => {
  const f = await fixture();
  const session = new inspector.Session(); session.connect();
  try {
    f.drop();
    // Jsdom native-looking accessors are JS internals with caches. Cache only
    // the already-observed DOM ancestry as own fixture data for this helper
    // test; the installed component/VNode graph stays real and unchanged.
    for (let node = f.select; node && node !== f.item;) {
      const parent = node.parentElement; f.replace(node, 'parentElement', parent); node = parent;
    }
    globalThis.__rowDRootFixture = { select: f.select, item: f.item, reference: f.combo.getAttribute('aria-controls') };
    const expression = buildCmsRowDOptionsProbeExpression();
    const start = expression.indexOf('const trimProbeText =');
    const finish = expression.indexOf('\nconst resolveCmsRowDOption =', start);
    const declarations = expression.slice(start, finish);
    const evaluate = () => new Promise((resolve, reject) => session.post('Runtime.evaluate', {
      expression: `(() => { ${declarations}\nconst fixture = globalThis.__rowDRootFixture; const diagnostic = {}; const labels = ownedSelectVNodeLabels(fixture.select, fixture.reference, diagnostic, fixture.item); return { count: labels ? labels.length : 0, issue: diagnostic.optionsDefinitionIssue || null }; })()`,
      throwOnSideEffect: true, returnByValue: true, awaitPromise: false, userGesture: false
    }, (error, result) => error ? reject(error) : resolve(result)));
    const response = await evaluate();
    assert.equal(response.exceptionDetails, undefined, JSON.stringify(response.exceptionDetails));
    assert.deepEqual(response.result.value, { count: 2, issue: null });
    const effects = { writes: 0 };
    f.replace(f.render, 'children', new Proxy(own(f.render, 'children'), {
      getOwnPropertyDescriptor(target, key) { effects.writes += 1; return Reflect.getOwnPropertyDescriptor(target, key); }
    }));
    const rejected = await evaluate();
    assert.equal(rejected.exceptionDetails?.exception?.className, 'EvalError');
    assert.equal(effects.writes, 0, 'the strict guard prevents a Proxy trap from writing fixture state');
  } finally {
    delete globalThis.__rowDRootFixture; session.disconnect(); f.close();
  }
});
