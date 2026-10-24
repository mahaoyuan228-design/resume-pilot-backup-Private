/**
 * Offline Never-Save tests only. The JSON fixture is a sanitized projection of
 * recorded metadata. Every DOM below is an explicitly SYNTHETIC structural
 * simulation, not captured live HTML or evidence of live widget interaction.
 * Selects are never opened; no option labels or option lists are fabricated.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import {
  ROW_C_BASE_TIP,
  ROW_C_HARVEST,
  ROW_C_PAGE,
  ROW_C_FIELDS,
  inspectCmsBasicInfoRowC,
  buildCmsBasicInfoRowCProbeExpression
} from '../scripts/lib/cms-basic-info-row-c.mjs';
import * as liveHooks from '../scripts/live/cms-basic-info-live.mjs';

const harvest = JSON.parse(fs.readFileSync(new URL('./fixtures/cms-basic-info-row-c-harvest.json', import.meta.url), 'utf8'));
const EXPECTED_WRAPPERS = [
  '11_20_0', '11_21_0', '11_247_0', '11_22_0', '11_23_0',
  '11_24_0', '11_25_0', '11_28_0', '11_29_0', '11_26_0',
  '11_51414234_0', '11_245_0', '11_1003214127_0'
];
const SYNTHETIC_PRIVATE = 'SYNTHETIC_PRIVATE_SENTINEL_DO_NOT_READ';
const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const field = (doc, id) => doc.getElementById(id);
const formItem = (doc, id) => field(doc, id).querySelector('.ant-form-item');
const controlContainer = (doc, id) => formItem(doc, id).querySelector('.ant-form-item-control');

function syntheticControl(row) {
  if (row.controlKind === 'input') {
    return `<input type="${row.type}" placeholder="${escape(row.placeholder)}" value="${SYNTHETIC_PRIVATE}">`;
  }
  if (row.controlKind === 'ant-calendar-picker') {
    return `<span class="ant-calendar-picker"><input type="text" readonly value="${SYNTHETIC_PRIVATE}"></span>`;
  }
  if (row.controlKind === 'radio-group') {
    // One generic radio establishes the structural type, not live cardinality,
    // radio IDs, value codes, labels, or a known gender choice list.
    return `<input type="radio" value="${SYNTHETIC_PRIVATE}">`;
  }
  return `<div class="${escape(row.classes)}"><span data-synthetic-selected-text>${SYNTHETIC_PRIVATE}</span></div>`;
}

function syntheticDom({ url = `${ROW_C_PAGE}?resumeId=synthetic-private&tid=synthetic-private`, mutate } = {}) {
  // Mirrors the observed wrapper > static div > form item topology only.
  // All labels/control metadata remain the sanitized harvest projection.
  const items = harvest.fields.map(row => `<div id="${row.wrapperId}"><div style="position:static"><div class="ant-row ant-form-item"><div class="ant-form-item-label"><label>${escape(row.label)}</label></div><div class="ant-form-item-control">${syntheticControl(row)}</div></div></div></div>`).join('');
  const dom = new JSDOM(`<!doctype html><body><section id="11" class="form-cell">${items}</section><button type="submit">synthetic submit</button></body>`, {
    url, pretendToBeVisual: true, runScripts: 'outside-only'
  });
  const { window } = dom;
  window.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  Object.defineProperty(window.document, 'readyState', { configurable: true, get: () => 'complete' });
  Object.defineProperty(window.document, 'visibilityState', { configurable: true, get: () => 'visible' });
  mutate?.(window.document, window);
  return dom;
}

function assertNoValues(result) {
  const forbiddenKeys = /^(?:value|values|valueSample|options|optionsSample|selectedText|textContent|innerHTML|outerHTML|href|resumeId|tid)$/;
  const walk = data => {
    if (!data || typeof data !== 'object') return;
    for (const [key, value] of Object.entries(data)) {
      assert.equal(forbiddenKeys.test(key), false, `output key is not allowlisted metadata: ${key}`);
      walk(value);
    }
  };
  walk(result);
  const output = JSON.stringify(result);
  assert.equal(output.includes(SYNTHETIC_PRIVATE), false);
  assert.equal(output.includes('synthetic-private'), false);
  assert.equal(output.includes('resumeId='), false);
  assert.equal(output.includes('tid='), false);
  assert.equal(result.neverSave, true);
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.writeStarted, false);
  assert.equal(result.mutationAllowed, false);
  assert.equal(result.valuesExposed, false);
}

function auditedProbe(dom, expression = false) {
  const { window } = dom;
  const { document } = window;
  const before = document.documentElement.outerHTML;
  const attempted = { writes: 0, clicks: 0, submits: 0, network: 0, valueReads: 0, events: 0 };
  const forbidden = kind => () => { attempted[kind] += 1; throw new Error(`read-only probe attempted ${kind}`); };
  const observer = new window.MutationObserver(() => {});
  observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  for (const control of document.querySelectorAll('input')) {
    for (const property of ['value', 'checked']) Object.defineProperty(control, property, {
      configurable: true, get: forbidden('valueReads'), set: forbidden('writes')
    });
  }
  for (const selected of document.querySelectorAll('[data-synthetic-selected-text]')) {
    Object.defineProperty(selected, 'textContent', { configurable: true, get: forbidden('valueReads'), set: forbidden('writes') });
  }
  window.HTMLElement.prototype.click = forbidden('clicks');
  window.HTMLFormElement.prototype.submit = forbidden('submits');
  window.HTMLFormElement.prototype.requestSubmit = forbidden('submits');
  window.EventTarget.prototype.dispatchEvent = forbidden('events');
  window.fetch = forbidden('network');
  window.XMLHttpRequest = forbidden('network');
  window.WebSocket = forbidden('network');
  window.navigator.sendBeacon = forbidden('network');
  for (const name of ['appendChild', 'insertBefore', 'removeChild', 'replaceChild']) window.Node.prototype[name] = forbidden('writes');
  for (const name of ['setAttribute', 'removeAttribute', 'insertAdjacentHTML', 'remove', 'replaceWith']) window.Element.prototype[name] = forbidden('writes');
  const output = expression ? window.eval(buildCmsBasicInfoRowCProbeExpression()) : inspectCmsBasicInfoRowC(document);
  const result = JSON.parse(JSON.stringify(output));
  assert.deepEqual(attempted, { writes: 0, clicks: 0, submits: 0, network: 0, valueReads: 0, events: 0 });
  assert.equal(observer.takeRecords().length, 0);
  observer.disconnect();
  assert.equal(document.documentElement.outerHTML, before);
  assertNoValues(result);
  return result;
}

function withProbe(options, check, expression = false) {
  const dom = syntheticDom(options);
  try { check(auditedProbe(dom, expression)); } finally { dom.window.close(); }
}

function expectFieldFailure(id, reason, mutate, expression = false) {
  withProbe({ mutate }, result => {
    assert.equal(result.ok, false);
    const row = result.fields.find(item => item.wrapperId === id);
    assert.equal(row.status, 'skipped');
    assert.equal(row.reason, reason);
  }, expression);
}

test('13 priority field specifications match sanitized harvest metadata exactly', () => {
  assert.equal(harvest.harvest, ROW_C_HARVEST);
  assert.equal(harvest.baseTip, ROW_C_BASE_TIP);
  assert.equal(harvest.sectionId, '11');
  assert.equal(harvest.neverSave, true);
  assert.equal(harvest.liveSupportClaimed, false);
  assert.equal(harvest.optionOpenEvidence, false);
  assert.deepEqual(harvest.fields.map(row => row.wrapperId), EXPECTED_WRAPPERS);
  assert.deepEqual(ROW_C_FIELDS.map(row => row.wrapperId), EXPECTED_WRAPPERS);
  assert.equal(harvest.sources.length, 3);
  assert.deepEqual(harvest.sources.map(row => row.file), ['gaps-row-C.json', 'page-sections-raw.json', 'harvest-summary.json']);
  for (const source of harvest.sources) assert.match(source.sha256, /^[a-f0-9]{64}$/);
  for (const [index, actual] of ROW_C_FIELDS.entries()) {
    const observed = harvest.fields[index];
    for (const key of ['label', 'wrapperId', 'controlKind']) assert.equal(actual[key], observed[key]);
    if (observed.type) assert.equal(observed.type, 'text');
    if ('placeholder' in observed) assert.equal(actual.placeholder, observed.placeholder);
    if ('readonly' in observed) assert.equal(actual.readOnly, observed.readonly);
    const safeKeys = ['label', 'wrapperId', 'controlKind', 'type', 'placeholder', 'readonly', 'classes'];
    assert.ok(Object.keys(observed).every(key => safeKeys.includes(key)));
    assert.equal(Object.keys(actual).some(key => /option/i.test(key)), false);
    if (observed.controlKind === 'ant-select') assert.equal(observed.classes,
      ['11_26_0', '11_245_0'].includes(observed.wrapperId)
        ? 'ant-select ant-select-enabled'
        : 'ant-select ant-select-enabled ant-select-allow-clear');
  }
  assert.equal(Object.isFrozen(ROW_C_FIELDS), true);
  assert.ok(ROW_C_FIELDS.every(Object.isFrozen));
});

test('live runner re-exports the same inert read-only hooks', () => {
  assert.equal(liveHooks.ROW_C_FIELDS, ROW_C_FIELDS);
  assert.equal(liveHooks.inspectCmsBasicInfoRowC, inspectCmsBasicInfoRowC);
  assert.equal(liveHooks.buildCmsBasicInfoRowCProbeExpression, buildCmsBasicInfoRowCProbeExpression);
});

for (const expression of [false, true]) test(`SYNTHETIC descendant-item topology succeeds where closest-only is null (${expression ? 'serialized' : 'direct'})`, () => {
  withProbe({ mutate: doc => {
    for (const spec of ROW_C_FIELDS) {
      const wrapper = field(doc, spec.wrapperId);
      assert.equal(wrapper.closest('.ant-form-item'), null);
      assert.equal(wrapper.querySelectorAll('.ant-form-item').length, 1);
      assert.equal(formItem(doc, spec.wrapperId).parentElement.style.position, 'static');
    }
  } }, result => {
    assert.equal(result.ok, true);
    assert.equal(result.reason, 'read_only_preflight');
    assert.equal(result.fields.length, 13);
    assert.equal(result.fields.filter(row => row.controlKind === 'ant-select' && row.status === 'skipped' && row.reason === 'option_open_evidence_missing').length, 8);
    assert.equal(result.fields.filter(row => row.controlKind !== 'ant-select' && row.status === 'observed' && row.reason === 'live_never_save_required').length, 5);
  }, expression);
});

test('serialized browser expression is equivalent to the direct inspector', () => {
  let direct;
  withProbe({}, result => { direct = result; });
  withProbe({}, result => assert.deepEqual(result, direct), true);
});

for (const [name, options, reason] of [
  ['wrong tenant', { url: ROW_C_PAGE.replace('SU629dbc0c0dcad452299bc0f7', 'SUdifferent') }, 'wrong_page'],
  ['wrong host', { url: ROW_C_PAGE.replace('wecruit.hotjob.cn', 'example.invalid') }, 'wrong_page'],
  ['wrong path', { url: ROW_C_PAGE.replace('resumeOperation.html', 'other.html') }, 'wrong_page'],
  ['hidden page', { mutate: (_, window) => Object.defineProperty(window.document, 'visibilityState', { get: () => 'hidden' }) }, 'page_hidden'],
  ['loading page', { mutate: (_, window) => Object.defineProperty(window.document, 'readyState', { get: () => 'loading' }) }, 'page_not_ready'],
  ['missing section', { mutate: doc => field(doc, '11').removeAttribute('id') }, 'section_not_unique_or_visible'],
  ['duplicate section', { mutate: doc => doc.body.append(field(doc, '11').cloneNode(false)) }, 'section_not_unique_or_visible'],
  ['hidden section', { mutate: doc => { field(doc, '11').hidden = true; } }, 'section_not_unique_or_visible'],
  ['section class drift', { mutate: doc => { field(doc, '11').className = 'other-section'; } }, 'section_not_unique_or_visible']
]) test(`SYNTHETIC ${name} fails closed`, () => withProbe(options, result => {
  assert.equal(result.ok, false);
  assert.equal(result.reason, reason);
  assert.equal(result.fields.length, 13);
  assert.ok(result.fields.every(row => row.status === 'skipped' && row.reason === reason));
}));

const HEIGHT = '11_247_0';
for (const [name, reason, mutate] of [
  ['missing wrapper', 'wrapper_not_unique', doc => field(doc, HEIGHT).remove()],
  ['duplicate wrapper', 'wrapper_not_unique', doc => doc.body.append(field(doc, HEIGHT).cloneNode(true))],
  ['hidden wrapper', 'wrapper_scope_or_visibility_mismatch', doc => { field(doc, HEIGHT).hidden = true; }],
  ['hidden intermediate ancestor', 'wrapper_scope_or_visibility_mismatch', doc => { formItem(doc, HEIGHT).parentElement.style.display = 'none'; }],
  ['hidden descendant item', 'wrapper_scope_or_visibility_mismatch', doc => { formItem(doc, HEIGHT).hidden = true; }],
  ['zero descendant items', 'wrapper_scope_or_visibility_mismatch', doc => formItem(doc, HEIGHT).remove()],
  ['ambiguous descendant items', 'wrapper_scope_or_visibility_mismatch', doc => {
    const item = formItem(doc, HEIGHT); item.parentElement.append(item.cloneNode(true));
  }],
  ['ambiguous items including hidden wrong-label item', 'wrapper_scope_or_visibility_mismatch', doc => {
    const duplicate = formItem(doc, HEIGHT).cloneNode(true); duplicate.hidden = true;
    duplicate.querySelector('label').textContent = 'synthetic other label'; field(doc, HEIGHT).append(duplicate);
  }],
  ['wrapper moved to other section', 'wrapper_scope_or_visibility_mismatch', doc => {
    const elsewhere = doc.createElement('section'); elsewhere.className = 'form-cell'; elsewhere.id = '12';
    doc.body.append(elsewhere); elsewhere.append(field(doc, HEIGHT));
  }],
  ['descendant item in foreign nested section', 'wrapper_scope_or_visibility_mismatch', doc => {
    const item = formItem(doc, HEIGHT), elsewhere = doc.createElement('section'); elsewhere.className = 'form-cell'; elsewhere.id = '12';
    item.parentElement.append(elsewhere); elsewhere.append(item);
  }],
  ['empty wrapper with same-label neighbor', 'wrapper_scope_or_visibility_mismatch', doc => { field(doc, '11').append(formItem(doc, HEIGHT)); }],
  ['empty wrapper inside same-label ancestor item', 'wrapper_scope_or_visibility_mismatch', doc => {
    const wrapper = field(doc, HEIGHT), item = formItem(doc, HEIGHT);
    wrapper.parentElement.insertBefore(item, wrapper); item.querySelector('.ant-form-item-control').append(wrapper);
    assert.equal(wrapper.closest('.ant-form-item'), item);
  }],
  ['missing label', 'label_mismatch', doc => formItem(doc, HEIGHT).querySelector('label').remove()],
  ['hidden label', 'label_mismatch', doc => { formItem(doc, HEIGHT).querySelector('label').hidden = true; }],
  ['wrong label', 'label_mismatch', doc => { formItem(doc, HEIGHT).querySelector('label').textContent = 'synthetic wrong label'; }],
  ['duplicate label within item', 'label_mismatch', doc => {
    const label = formItem(doc, HEIGHT).querySelector('label'); label.parentElement.append(label.cloneNode(true));
  }],
  ['label in foreign nested section', 'label_mismatch', doc => {
    const labelHost = formItem(doc, HEIGHT).querySelector('.ant-form-item-label'), elsewhere = doc.createElement('section'); elsewhere.className = 'form-cell';
    labelHost.parentElement.append(elsewhere); elsewhere.append(labelHost);
  }],
  ['duplicate same question elsewhere', 'question_not_unique', doc => {
    const wrapper = field(doc, HEIGHT).cloneNode(true); wrapper.removeAttribute('id'); field(doc, '11').append(wrapper);
  }],
  ['input type drift', 'control_kind_mismatch', doc => { field(doc, HEIGHT).querySelector('input').type = 'number'; }],
  ['input placeholder drift', 'control_kind_mismatch', doc => { field(doc, HEIGHT).querySelector('input').placeholder = 'synthetic other placeholder'; }],
  ['input readonly drift', 'control_kind_mismatch', doc => { field(doc, HEIGHT).querySelector('input').readOnly = true; }],
  ['duplicate text input', 'control_kind_mismatch', doc => { const input = field(doc, HEIGHT).querySelector('input'); input.parentElement.append(input.cloneNode(true)); }],
  ['calendar widget in text item', 'control_kind_mismatch', doc => { const widget = doc.createElement('span'); widget.className = 'ant-calendar-picker'; controlContainer(doc, HEIGHT).append(widget); }],
  ['unsupported upload widget', 'control_kind_mismatch', doc => { const widget = doc.createElement('span'); widget.className = 'ant-upload'; controlContainer(doc, HEIGHT).append(widget); }],
  ['input outside matched item in same wrapper', 'control_kind_mismatch', doc => { field(doc, HEIGHT).append(field(doc, HEIGHT).querySelector('input')); }],
  ['input in foreign nested section', 'control_kind_mismatch', doc => {
    const input = field(doc, HEIGHT).querySelector('input'), elsewhere = doc.createElement('section'); elsewhere.className = 'form-cell'; elsewhere.id = '12';
    input.parentElement.append(elsewhere); elsewhere.append(input);
  }],
  ['disabled text input', 'control_not_available', doc => { field(doc, HEIGHT).querySelector('input').disabled = true; }],
  ['hidden text input', 'control_not_available', doc => { field(doc, HEIGHT).querySelector('input').style.visibility = 'hidden'; }],
  ['disabled fieldset ancestor', 'control_not_available', doc => {
    const wrapper = field(doc, HEIGHT), fieldset = doc.createElement('fieldset'); fieldset.disabled = true; wrapper.parentElement.append(fieldset); fieldset.append(wrapper);
  }]
]) test(`SYNTHETIC ${name} fails closed for height`, () => expectFieldFailure(HEIGHT, reason, mutate));

for (const expression of [false, true]) test(`SYNTHETIC controls outside the matched item are ignored (${expression ? 'serialized' : 'direct'})`, () => withProbe({ mutate: doc => {
  const unowned = doc.createElement('input'); unowned.type = 'number'; unowned.disabled = true;
  field(doc, HEIGHT).append(unowned);
} }, result => {
  assert.equal(result.ok, true);
  assert.equal(result.fields.find(row => row.wrapperId === HEIGHT).reason, 'live_never_save_required');
}, expression));

test('calendar readonly mismatch fails closed', () => expectFieldFailure('11_21_0', 'control_kind_mismatch', doc => { field(doc, '11_21_0').querySelector('input').readOnly = false; }));
test('disabled calendar input fails closed', () => expectFieldFailure('11_21_0', 'control_not_available', doc => { field(doc, '11_21_0').querySelector('input').disabled = true; }));
test('radio changed to checkbox fails closed', () => expectFieldFailure('11_20_0', 'control_kind_mismatch', doc => { field(doc, '11_20_0').querySelector('input').type = 'checkbox'; }));
test('disabled radio fails closed', () => expectFieldFailure('11_20_0', 'control_not_available', doc => { field(doc, '11_20_0').querySelector('input').disabled = true; }));
test('disabled select host fails closed', () => expectFieldFailure('11_22_0', 'control_not_available', doc => { controlContainer(doc, '11_22_0').firstElementChild.classList.add('ant-select-disabled'); }));
test('aria-disabled select host fails closed', () => expectFieldFailure('11_22_0', 'control_not_available', doc => { controlContainer(doc, '11_22_0').firstElementChild.setAttribute('aria-disabled', 'true'); }));
test('disabled select inner input fails closed', () => expectFieldFailure('11_22_0', 'control_not_available', doc => {
  const input = doc.createElement('input'); input.type = 'text'; input.disabled = true; controlContainer(doc, '11_22_0').firstElementChild.append(input);
}));
test('text input replacing select fails closed', () => expectFieldFailure('11_22_0', 'control_kind_mismatch', doc => { controlContainer(doc, '11_22_0').innerHTML = '<input type="text">'; }));
test('foreign text input beside select fails closed', () => expectFieldFailure('11_22_0', 'control_kind_mismatch', doc => { controlContainer(doc, '11_22_0').append(doc.createElement('input')); }));
test('duplicate nonregion select hosts fail closed', () => expectFieldFailure('11_22_0', 'control_not_unique', doc => {
  const host = controlContainer(doc, '11_22_0').firstElementChild; host.parentElement.append(host.cloneNode(true));
}));

for (const id of ['11_26_0', '11_245_0']) test(`SYNTHETIC multi-host region ${id} remains unopened and skipped`, () => withProbe({ mutate: doc => {
  const host = controlContainer(doc, id).firstElementChild; host.parentElement.append(host.cloneNode(true));
} }, result => {
  const row = result.fields.find(item => item.wrapperId === id);
  assert.equal(row.status, 'skipped');
  assert.equal(row.reason, 'option_open_evidence_missing');
}));

test('serialized expression also fails closed on wrapper drift', () => expectFieldFailure(HEIGHT, 'wrapper_not_unique', doc => field(doc, HEIGHT).remove(), true));

test('missing document does not grant fill permission', () => {
  const result = inspectCmsBasicInfoRowC(null);
  assertNoValues(result);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'no_document');
});
