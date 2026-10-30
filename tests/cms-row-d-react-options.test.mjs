/** Synthetic React graph contracts, not a captured CMS DOM or support claim. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { ROW_D_FIELDS, ROW_D_PAGE, inspectCmsRowDOptions,
  buildCmsRowDOptionsProbeExpression } from '../scripts/lib/cms-row-d-options.mjs';

const field = ROW_D_FIELDS[0];
const PRIVATE = 'PRIVATE_SELECTED_OPTION_VALUE';
const forbidden = () => { throw Error('private_access_or_mutation'); };

function fixture(t) {
  const dom = new JSDOM(`<!doctype html><body><section id="13" class="form-cell">
    <div id="13_43_0"><div class="ant-form-item"><div class="ant-form-item-label"><label>${field.label}</label></div>
    <span><div class="ant-select"><div class="ant-select-selection" role="combobox" aria-controls="synthetic-reference">
    <span class="ant-select-search" style="display:none"><input class="ant-select-search__field" type="text"></span>
    </div></div></span></div></div></section>`,
  { url: ROW_D_PAGE, pretendToBeVisual: true, runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const doc = dom.window.document;
  Object.defineProperty(doc, 'readyState', { value: 'complete' });
  const host = doc.querySelector('.ant-select');
  const item = doc.querySelector('.ant-form-item');
  for (const node of [host, doc.querySelector('input')]) {
    for (const name of ['value', 'checked', 'selected', 'innerHTML', 'textContent']) {
      Object.defineProperty(node, name, { configurable: true, get: forbidden, set: forbidden });
    }
  }
  function Option() {}
  Option.isSelectOption = true;
  const options = field.options.map(children => {
    const props = { children };
    Object.defineProperty(props, 'value', { get: forbidden });
    return { type: Option, ref: null, props };
  });
  const defaultRender = forbidden; // Must be recognized by identity, never run.
  function Select() {}
  Select.defaultProps = { dropdownRender: defaultRender };
  function SelectTrigger() {}
  function Trigger() {}
  const props = { prefixCls: 'ant-select', optionLabelProp: 'children',
    dropdownRender: defaultRender, children: options };
  Object.defineProperty(props, 'value', { get: forbidden });
  const triggerProps = { prefixCls: 'ant-select', ariaId: 'synthetic-reference', dropdownRender: defaultRender };
  const fiber = (tag, type, stateNode, memoizedProps = {}) => ({ tag, type, stateNode,
    memoizedProps, child: null, sibling: null, return: null, alternate: null });
  const hostFiber = fiber(5, 'div', host);
  const trigger = fiber(1, Trigger, {});
  const selectTrigger = fiber(1, SelectTrigger, { props: triggerProps }, triggerProps);
  const select = fiber(1, Select, { props }, props);
  const outer = fiber(5, 'div', item);
  const root = fiber(3, null, {});
  root.stateNode.current = root;
  const chain = [root, outer, select, selectTrigger, trigger, hostFiber];
  for (let index = 1; index < chain.length; index += 1) {
    chain[index].return = chain[index - 1];
    chain[index - 1].child = chain[index];
  }
  host.__reactInternalInstance$synthetic = hostFiber;
  const observer = new dom.window.MutationObserver(forbidden);
  observer.observe(doc, { subtree: true, childList: true, attributes: true, characterData: true });
  const read = (expression = false) => {
    const result = expression ? dom.window.eval(buildCmsRowDOptionsProbeExpression()) : inspectCmsRowDOptions(doc);
    assert.equal(observer.takeRecords().length, 0);
    assert.equal(JSON.stringify(result).includes(PRIVATE), false);
    for (const key of ['writeStarted', 'mutationAllowed', 'valuesExposed', 'liveSupportClaimed', 'livePassClaimed']) {
      assert.equal(result[key], false);
    }
    return result.fields[0];
  };
  t.after(() => observer.disconnect());
  return { doc, host, hostFiber, trigger, selectTrigger, select, outer, root, props, triggerProps, options, read };
}

for (const expression of [false, true]) test(`owned React definitions pass without selected-value reads (expression=${expression})`, t => {
  const f = fixture(t);
  const row = f.read(expression);
  assert.equal(row.ok, true);
  assert.equal(row.observedOptionCount, 2);
  assert.equal(row.optionsEvidenceSource, 'owned_react_props');
  assert.equal(row.optionsFramework, 'react');
  assert.equal(row.optionsReadiness, 'target_missing');
  assert.equal(row.optionsRootDiagnostic.selectVue, 'absent');
  assert.equal(row.optionsRootDiagnostic.appVue, 'node_absent');
});

test('stale DOM anchor resolves only to its committed alternate', t => {
  const f = fixture(t);
  const stale = { ...f.hostFiber, return: null, alternate: f.hostFiber };
  f.hostFiber.alternate = stale;
  f.host.__reactInternalInstance$synthetic = stale;
  assert.equal(f.read().ok, true);
});

test('shared bailout child with stale return authenticates through current forward links', t => {
  const f = fixture(t);
  const staleOuter = { ...f.outer, child: null, alternate: f.outer };
  f.outer.alternate = staleOuter;
  f.select.return = staleOuter;
  assert.equal(f.read().ok, true);
});

const rejects = {
  'detached current host': f => { f.trigger.child = null; },
  'wrong current root': f => { f.root.stateNode.current = {}; },
  'cyclic siblings': f => { const alien = { sibling: null }; alien.sibling = alien; f.trigger.child = alien; },
  'foreign aria binding': f => { f.triggerProps.ariaId = 'other-field'; },
  'uncommitted Select props': f => { f.select.stateNode.props = {}; },
  'custom dropdown renderer': f => { f.props.dropdownRender = () => null; },
  'multiple mode': f => { f.props.multiple = true; },
  'loading definitions': f => { f.props.loading = true; },
  'disabled option': f => { f.options[0].props.disabled = true; },
  'styled option': f => { f.options[0].props.style = {}; },
  'rich label': f => { f.options[0].props.children = { type: 'span', props: { children: field.options[0] } }; },
  'label getter': f => { Object.defineProperty(f.options[0].props, 'children', { get: forbidden }); },
  'sparse definitions': f => { delete f.options[0]; },
  'ambiguous anchor': f => { f.host.__reactFiber$another = f.hostFiber; },
  'absent Select component': f => { f.select.type = function Unknown() {}; }
};
for (const [name, change] of Object.entries(rejects)) test(`reject ${name} without borrowing another dictionary`, t => {
  const f = fixture(t);
  change(f);
  const row = f.read();
  assert.equal(row.ok, false);
  assert.equal(row.reason, 'current_options_unavailable');
  assert.equal(Object.hasOwn(row, 'observedOptionCount'), false);
  assert.equal(Object.hasOwn(row, 'optionsEvidenceSource'), false);
});

test('owned definitions still require exact live dictionary order and cardinality', t => {
  const f = fixture(t);
  f.options[0].props.children = PRIVATE;
  const row = f.read();
  assert.equal(row.ok, false);
  assert.equal(row.reason, 'option_dictionary_mismatch');
});

test('Vue getter-only path is classified without invoking the getter', t => {
  const f = fixture(t);
  Object.defineProperty(f.host, '__vue__', { get: forbidden });
  const row = f.read();
  assert.equal(row.ok, true);
  assert.equal(row.optionsRootDiagnostic.selectVue, 'accessor');
  assert.equal(row.optionsRootDiagnostic.pathAccessor, 1);
});
