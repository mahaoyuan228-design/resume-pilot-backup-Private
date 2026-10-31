/**
 * Offline source-compatibility fixture: the installed Vue 2.7.16 and Ant
 * Design Vue 1.7.8 render the select. This is not captured or invented CMS DOM.
 * Never opens/focuses/blurs a control and makes no live-support/PASS claim.
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
Vue.config.productionTip = false;
Vue.config.devtools = false;
const FIELD = ROW_D_FIELDS[0];
const PRIVATE = 'OFFLINE_PRIVATE_VALUE_DO_NOT_READ_OR_RETURN';
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
async function fixture({ labels = FIELD.options, props = {}, optionProps = {}, slots = false, group = false } = {}) {
  document.body.innerHTML = `<section class="form-cell" id="${FIELD.sectionId}"><div id="${FIELD.wrapperId}"><div class="ant-form-item"><div class="ant-form-item-label"><label></label></div><div class="ant-form-item-control"><div id="mount"></div></div></div></div></section>`;
  document.querySelector('label').textContent = FIELD.label;
  const vm = new Vue({
    data: () => ({ labels: [...labels] }),
    render(h) {
      const options = this.labels.map((label, index) =>
        h(ASelect.Option, { key: index, props: { value: `opaque_${index}`, ...optionProps } }, [label]));
      return slots || group
        ? h(ASelect, { props: { value: PRIVATE, ...props } }, group
          ? [h(ASelect.OptGroup, { props: { label: 'OFFLINE_GROUP' } }, options)] : options)
        : h(ASelect, { props: { value: PRIVATE, options: this.labels.map((label, index) =>
          ({ value: `opaque_${index}`, label, ...optionProps })), ...props } });
    }
  }).$mount('#mount');
  await Vue.nextTick();
  const select = document.querySelector('.ant-select');
  const component = componentFor(select);
  const propsData = own(own(component, '$options'), 'propsData');
  const combo = select.querySelector('[role="combobox"]');
  assert.equal(document.querySelectorAll('.ant-select-dropdown').length, 0, 'the installed control has never mounted its lazy portal');
  const read = () => inspectCmsRowDOptions(document).fields[0];
  return { vm, select, component, propsData, combo, read, close: () => vm.$destroy() };
}
function safe(row) {
  for (const [key, value] of Object.entries({ neverSave: true, probeOnly: true, mutationAllowed: false,
    writeStarted: false, valuesExposed: false, liveSupportClaimed: false, livePassClaimed: false })) assert.equal(row[key], value);
  assert.equal(JSON.stringify(row).includes(PRIVATE), false);
}
function observed(row, source = 'owned_select_vnodes', readiness = 'target_missing') {
  safe(row);
  assert.equal(row.ok, true);
  assert.equal(row.reason, 'read_only_options_preflight');
  assert.equal(row.optionsEvidenceSource, source);
  assert.equal(row.optionsReadiness, readiness);
  assert.equal(row.observedOptionCount, 2);
}
function unavailable(row, readiness = 'target_missing', issue) {
  safe(row);
  assert.equal(row.ok, false);
  assert.equal(row.reason, 'current_options_unavailable');
  assert.equal(row.optionsReadiness, readiness);
  assert.equal(Object.hasOwn(row, 'optionsEvidenceSource'), false);
  assert.equal(Object.hasOwn(row, 'observedOptionCount'), false);
  if (issue) assert.equal(row.optionsDefinitionIssue, issue);
}
function portal(fixture, labels) {
  const dropdown = document.createElement('div');
  dropdown.className = 'ant-select-dropdown';
  const list = document.createElement('ul');
  list.id = fixture.combo.getAttribute('aria-controls');
  for (const label of labels) {
    const option = document.createElement('li'); option.setAttribute('role', 'option'); option.textContent = label; list.append(option);
  }
  dropdown.append(list); document.body.append(dropdown);
  return { dropdown, list };
}

for (const slots of [false, true]) test(`installed Ant/Vue dormant ${slots ? 'slotted' : 'options-prop'} definition supplies separate current evidence`, async () => {
  const f = await fixture({ slots });
  try { observed(f.read()); } finally { f.close(); }
});

for (const filterOption of [undefined, false, true]) {
  test(`installed searchable single-select keeps full owned definitions with built-in filter=${filterOption}`, async () => {
    const f = await fixture({ props: { showSearch: true, filterOption } });
    const restore = [];
    let reads = 0;
    try {
      // Definitions do not require consulting or disclosing any current
      // search/selection state, even when searching is enabled by the app.
      for (const key of ['_inputValue', '_value', '_optionsInfo']) {
        const before = Object.getOwnPropertyDescriptor(f.component, key);
        Object.defineProperty(f.component, key, { configurable: true,
          get() { reads += 1; throw new Error(PRIVATE); } });
        restore.push(() => before ? Object.defineProperty(f.component, key, before) : delete f.component[key]);
      }
      observed(f.read());
      assert.equal(reads, 0);
      assert.equal(document.querySelectorAll('.ant-select-dropdown').length, 0);
    } finally { for (const reset of restore) reset(); f.close(); }
  });
}

test('installed custom search filters remain unavailable without invoking application callbacks', async () => {
  let calls = 0;
  const f = await fixture({ props: { showSearch: true,
    filterOption() { calls += 1; throw new Error(PRIVATE); } } });
  try { unavailable(f.read(), 'target_missing', 'search_filter_unsupported'); assert.equal(calls, 0); }
  finally { f.close(); }
});

test('installed incomplete or loading definitions cannot upgrade harvested labels into ready options', async () => {
  for (const labels of [[], FIELD.options.slice(0, 1)]) {
    const f = await fixture({ labels });
    try {
      const row = f.read(); safe(row); assert.equal(row.ok, false);
      assert.equal(row.reason, labels.length ? 'option_dictionary_mismatch' : 'current_options_unavailable');
    } finally { f.close(); }
  }
  const f = await fixture({ props: { loading: true } });
  try {
    unavailable(f.read(), 'loading');
    portal(f, FIELD.options);
    unavailable(f.read(), 'loading');
  } finally { f.close(); }
});

test('loading current props reject retained matching definitions even without a loading DOM icon', async () => {
  const f = await fixture();
  const before = Object.getOwnPropertyDescriptor(f.propsData, 'loading');
  try {
    Object.defineProperty(f.propsData, 'loading', { configurable: true, value: true });
    unavailable(f.read(), 'target_missing', 'loading');
  } finally {
    if (before) Object.defineProperty(f.propsData, 'loading', before); else delete f.propsData.loading;
    f.close();
  }
});

test('installed loading root cannot pass retained portal labels when a custom suffix icon masks the spinner', async () => {
  const f = await fixture({ props: { loading: true, suffixIcon: 'offline-static-icon' } });
  try {
    assert.equal(f.select.classList.contains('ant-select-loading'), true);
    assert.equal(f.select.querySelector('.anticon-loading'), null);
    portal(f, FIELD.options);
    unavailable(f.read(), 'loading');
  } finally { f.close(); }
});

test('missing current Vue anchor reports only a fixed rejection enum and never a dictionary substitute', async () => {
  const f = await fixture();
  const before = Object.getOwnPropertyDescriptor(f.select, '__vue__');
  try {
    delete f.select.__vue__;
    unavailable(f.read(), 'target_missing', 'root_anchor_missing');
  } finally { Object.defineProperty(f.select, '__vue__', before); f.close(); }
});

test('installed current option definition updates with the current render and never falls back to the dictionary alone', async () => {
  const f = await fixture();
  try {
    observed(f.read());
    f.vm.labels = [...FIELD.options].reverse(); await Vue.nextTick();
    const row = f.read();
    assert.equal(row.reason, 'option_dictionary_mismatch');
    assert.equal(row.optionsEvidenceSource, 'owned_select_vnodes');
    assert.equal(row.observedOptionCount, 2);
  } finally { f.close(); }
});

test('installed definition can supply evidence for an empty correctly scoped portal', async () => {
  const f = await fixture();
  try { portal(f, []); observed(f.read(), 'owned_select_vnodes', 'list_empty'); } finally { f.close(); }
});

test('highest-root anchor cannot authorize a detached stale child parent VNode', async () => {
  const f = await fixture();
  const anchor = Object.getOwnPropertyDescriptor(f.select, '__vue__');
  const parentVNode = Object.getOwnPropertyDescriptor(f.component, '$vnode');
  try {
    let highest = f.component;
    for (let depth = 0; depth < 8; depth += 1) {
      const parent = own(highest, '$parent');
      if (!parent || own(parent, '$el') !== f.select) break;
      highest = parent;
    }
    Object.defineProperty(f.select, '__vue__', { configurable: true, value: highest });
    observed(f.read());
    const current = parentVNode.value;
    const detached = Object.create(Object.getPrototypeOf(current), Object.getOwnPropertyDescriptors(current));
    Object.defineProperty(f.component, '$vnode', { ...parentVNode, value: detached });
    unavailable(f.read());
  } finally {
    Object.defineProperty(f.component, '$vnode', parentVNode);
    Object.defineProperty(f.select, '__vue__', anchor);
    f.close();
  }
});

test('populated owned portal remains authoritative over a matching component definition', async () => {
  const f = await fixture();
  try {
    portal(f, [...FIELD.options].reverse());
    const row = f.read();
    assert.equal(row.reason, 'option_dictionary_mismatch');
    assert.equal(row.optionsEvidenceSource, 'aria_controls_dom');
    assert.equal(row.optionsReadiness, 'observed');
  } finally { f.close(); }
});

for (const [name, mutate, reason] of [
  ['duplicate target', f => { portal(f, []); portal(f, []); }, 'dropdown_target_not_unique'],
  ['duplicate owner', f => { const owner = document.createElement('div'); owner.setAttribute('aria-controls', f.combo.getAttribute('aria-controls')); document.body.append(owner); }, 'dropdown_owner_not_unique'],
  ['wrong portal scope', f => { const p = portal(f, []); const wrapper = document.createElement('div'); wrapper.id = '13_999999_0'; document.body.append(wrapper); wrapper.append(p.dropdown); }, 'dropdown_scope_mismatch'],
  ['disabled DOM option', f => portal(f, FIELD.options).list.firstElementChild.setAttribute('disabled', ''), 'option_not_available'],
  ['disabled host', f => f.select.classList.add('ant-select-disabled'), 'control_not_available']
]) test(`installed matching definition cannot bypass ${name}`, async () => {
  const f = await fixture();
  try { mutate(f); const row = f.read(); assert.equal(row.reason, reason); assert.equal(Object.hasOwn(row, 'optionsEvidenceSource'), false); safe(row); } finally { f.close(); }
});

for (const [name, config] of [
  ['disabled option', { optionProps: { disabled: true } }],
  ['duplicate labels', { labels: [FIELD.options[0], FIELD.options[0]] }],
  ['empty label', { labels: ['', FIELD.options[1]] }],
  ['option group', { group: true }],
  ['custom dropdown renderer', { props: { dropdownRender: menu => menu } }]
]) test(`installed unsupported ${name} remains unavailable`, async () => {
  const f = await fixture(config);
  try { unavailable(f.read()); } finally { f.close(); }
});

for (const [name, mutate] of [
  ['foreign root', f => { Object.defineProperty(f.component, '$el', { configurable: true, value: document.createElement('div') }); }],
  ['stale parent props', f => { Object.defineProperty(own(f.component, '$options'), 'propsData', { configurable: true, value: { children: own(f.propsData, 'children') } }); }],
  ['aria binding drift', f => f.combo.setAttribute('aria-controls', 'offline-unbound-reference')],
  ['sparse child list', f => { const children = own(f.propsData, 'children'); delete children[0]; }],
  ['rich option label', f => { const child = own(own(own(f.propsData, 'children')[0], 'componentOptions'), 'children')[0]; child.tag = 'span'; }]
]) test(`installed definition rejects ${name}`, async () => {
  const f = await fixture();
  try { mutate(f); unavailable(f.read()); } finally { f.close(); }
});

for (const name of ['hidden', 'aria-hidden', 'aria-disabled', 'disabled', 'style']) {
  test(`installed definition rejects unsupported option attrs.${name}`, async () => {
    const f = await fixture();
    try {
      own(own(f.propsData, 'children')[0], 'data').attrs = { [name]: 'true' };
      unavailable(f.read());
    } finally { f.close(); }
  });
}

test('installed definition rejects current-chain cycles and missing own array entries', async () => {
  const f = await fixture();
  const before = Object.getOwnPropertyDescriptor(f.component, '$parent');
  const anchor = Object.getOwnPropertyDescriptor(f.select, '__vue__');
  const options = own(f.propsData, 'children');
  const prototype = Object.getPrototypeOf(options);
  try {
    Object.defineProperty(f.select, '__vue__', { configurable: true, value: f.component });
    Object.defineProperty(f.component, '$parent', { configurable: true, value: f.component });
    unavailable(f.read());
    Object.defineProperty(f.component, '$parent', before);
    Object.defineProperty(f.select, '__vue__', anchor);
    const first = options[0]; delete options[0];
    Object.setPrototypeOf(options, { 0: first });
    unavailable(f.read());
  } finally {
    Object.defineProperty(f.select, '__vue__', anchor);
    Object.defineProperty(f.component, '$parent', before);
    Object.setPrototypeOf(options, prototype);
    f.close();
  }
});

test('definition getters/iterators are never invoked and descriptor failures are sanitized', async () => {
  const f = await fixture();
  let reads = 0;
  const selectVue = Object.getOwnPropertyDescriptor(f.select, '__vue__');
  const options = own(f.propsData, 'children');
  const children = Object.getOwnPropertyDescriptor(f.propsData, 'children');
  try {
    Object.defineProperty(options, Symbol.iterator, { configurable: true,
      get() { reads += 1; throw new Error(PRIVATE); } });
    observed(f.read());
    Object.defineProperty(f.select, '__vue__', { configurable: true,
      get() { reads += 1; throw new Error(PRIVATE); } });
    unavailable(f.read());
    Object.defineProperty(f.select, '__vue__', selectVue);
    Object.defineProperty(f.propsData, 'children', { configurable: true,
      get() { reads += 1; throw new Error(PRIVATE); } });
    unavailable(f.read()); assert.equal(reads, 0);
    Object.defineProperty(f.propsData, 'children', { configurable: true, value: new Proxy(options, {
      getOwnPropertyDescriptor() { throw new Error(PRIVATE); }
    }) });
    unavailable(f.read());
  } finally {
    delete options[Symbol.iterator];
    Object.defineProperty(f.select, '__vue__', selectVue);
    Object.defineProperty(f.propsData, 'children', children);
    f.close();
  }
});

test('descriptor-only definition does not invoke getters or read selected/option values', async () => {
  const f = await fixture();
  let reads = 0;
  const restore = [];
  const poison = (object, key) => {
    const before = Object.getOwnPropertyDescriptor(object, key);
    Object.defineProperty(object, key, { configurable: true, get() { reads += 1; throw new Error(PRIVATE); } });
    restore.push(() => before ? Object.defineProperty(object, key, before) : delete object[key]);
  };
  try {
    poison(f.propsData, 'value');
    poison(f.component, '_optionsInfo');
    for (const option of own(f.propsData, 'children')) poison(own(option, 'componentOptions').propsData, 'value');
    for (const input of f.select.querySelectorAll('input')) poison(input, 'value');
    for (const selected of f.select.querySelectorAll('.ant-select-selection-selected-value')) poison(selected, 'textContent');
    observed(f.read()); assert.equal(reads, 0);
    const child = own(own(own(f.propsData, 'children')[0], 'componentOptions'), 'children')[0];
    poison(child, 'text'); unavailable(f.read()); assert.equal(reads, 0, 'an accessor label is rejected by descriptor without invocation');
  } finally { for (const reset of restore) reset(); f.close(); }
});

test('serialized definition branch completes with real V8 throwOnSideEffect enabled', async () => {
  const f = await fixture();
  const session = new inspector.Session(); session.connect();
  const originalChildren = Object.getOwnPropertyDescriptor(f.propsData, 'children');
  const originalLoading = Object.getOwnPropertyDescriptor(f.propsData, 'loading');
  try {
    // Jsdom DOM methods have caches and are outside this V8-only regression.
    // The installed component graph stays untouched; replace only document
    // inspection with the exact helper extracted from the built expression.
    const expression = buildCmsRowDOptionsProbeExpression();
    const start = expression.indexOf('const ownedSelectVNodeLabels =');
    const finish = expression.indexOf('\nconst resolveCmsRowDOption =', start);
    assert.ok(start > 0 && finish > start);
    globalThis.__rowDOwnedFixtureSelect = f.select;
    globalThis.__rowDOwnedFixtureReference = f.combo.getAttribute('aria-controls');
    const declarations = expression.slice(expression.indexOf('const trimProbeText ='), finish);
    const evaluate = () => new Promise((resolve, reject) => session.post('Runtime.evaluate', {
      expression: `(() => { ${declarations}\nconst diagnostic = {}; const labels = ownedSelectVNodeLabels(globalThis.__rowDOwnedFixtureSelect,globalThis.__rowDOwnedFixtureReference,diagnostic); return { count: labels ? labels.length : 0, matched: Boolean(labels && labels[0] === ${JSON.stringify(FIELD.options[0])} && labels[1] === ${JSON.stringify(FIELD.options[1])}), issue: diagnostic.optionsDefinitionIssue || null }; })()`,
      throwOnSideEffect: true, returnByValue: true, awaitPromise: false, userGesture: false
    }, (error, result) => error ? reject(error) : resolve(result)));
    const response = await evaluate();
    assert.equal(response.exceptionDetails, undefined, 'the real V8 guard accepted only data-descriptor traversal');
    assert.deepEqual(response.result.value, { count: 2, matched: true, issue: null });
    Object.defineProperty(f.propsData, 'loading', { configurable: true, value: true });
    const loading = await evaluate();
    assert.equal(loading.exceptionDetails, undefined, 'failure diagnostics write only evaluation-local metadata under the same guard');
    assert.deepEqual(loading.result.value, { count: 0, matched: false, issue: 'loading' });
    if (originalLoading) Object.defineProperty(f.propsData, 'loading', originalLoading); else delete f.propsData.loading;
    const effects = { writes: 0 };
    Object.defineProperty(f.propsData, 'children', { configurable: true, value: new Proxy(originalChildren.value, {
      getOwnPropertyDescriptor(target, key) { effects.writes += 1; return Reflect.getOwnPropertyDescriptor(target, key); }
    }) });
    const rejected = await evaluate();
    assert.equal(rejected.exceptionDetails?.exception?.className, 'EvalError', 'a Proxy trap cannot write pre-existing page state under the retained guard');
    assert.equal(effects.writes, 0);
  } finally {
    Object.defineProperty(f.propsData, 'children', originalChildren);
    if (originalLoading) Object.defineProperty(f.propsData, 'loading', originalLoading); else delete f.propsData.loading;
    delete globalThis.__rowDOwnedFixtureSelect; delete globalThis.__rowDOwnedFixtureReference;
    session.disconnect(); f.close();
  }
});
