/**
 * Offline expression tests only. All DOM topology is SYNTHETIC. Recorded row D
 * labels establish dictionary identity, not evidence of live widget support.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  ROW_D_FIELDS, ROW_D_PAGE, inspectCmsRowDOptions,
  buildCmsRowDOptionsProbeExpression
} from '../scripts/lib/cms-row-d-options.mjs';

const PRIVATE = 'SYNTHETIC_PRIVATE_SENTINEL_DO_NOT_READ';
const ERROR = 'cms_row_d_probe_requests_invalid';
const SELECT = '13_195_0';
const RADIO = '13_102402_0';
const CHECKBOX = '13_102501_0';
const CALENDAR = '16_65_0';
const spec = id => ROW_D_FIELDS.find(row => row.wrapperId === id);
const escape = value => String(value).replace(/[&<>"']/g,
  char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function syntheticControl(field) {
  if (field.controlKind === 'ant-select') return `<div class="ant-select"><div class="ant-select-selection" role="combobox" aria-controls="synthetic-${field.wrapperId}"><span data-private-selected>${PRIVATE}</span><input type="text" value="${PRIVATE}"></div></div>`;
  if (field.controlKind === 'ant-calendar-picker') return `<span class="ant-calendar-picker"><input readonly value="${PRIVATE}"></span>`;
  const kind = field.controlKind === 'radio-group' ? 'radio' : 'checkbox';
  return `<div class="ant-${kind}-group">${field.options.map(label => `<label class="ant-${kind}-wrapper"><input type="${kind}" value="${PRIVATE}"><span>${escape(label)}</span></label>`).join('')}</div>`;
}

function syntheticDom(url = `${ROW_D_PAGE}?resumeId=synthetic-private#synthetic-private`) {
  const sections = [...new Set(ROW_D_FIELDS.map(field => field.sectionId))].map(id =>
    `<section class="form-cell" id="${id}">${ROW_D_FIELDS.filter(field => field.sectionId === id).map(field =>
      `<div id="${field.wrapperId}"><div style="position:static"><div class="ant-form-item"><div class="ant-form-item-label"><label>${escape(field.label)}</label></div><div class="ant-form-item-control">${syntheticControl(field)}</div></div></div></div>`).join('')}</section>`).join('');
  // A 25-label location list deliberately cannot satisfy the harvested count
  // of 30. Its five missing labels are never invented to make this test pass.
  const portals = ROW_D_FIELDS.filter(field => field.controlKind === 'ant-select').map(field =>
    `<div class="ant-select-dropdown" style="display:none"><ul id="synthetic-${field.wrapperId}">${field.options.map(label => `<li role="option">${escape(label)}</li>`).join('')}</ul></div>`).join('');
  const dom = new JSDOM(`<!doctype html><body><form>${sections}<button type="submit">synthetic submit</button></form>${portals}</body>`,
    { url, pretendToBeVisual: true, runScripts: 'outside-only' });
  const { window } = dom;
  window.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  Object.defineProperty(window.document, 'readyState', { get: () => 'complete' });
  Object.defineProperty(window.document, 'visibilityState', { get: () => 'visible' });
  return dom;
}

function assertSafety(output) {
  for (const result of [output, ...output.fields, ...output.fields.flatMap(row => row.resolution ? [row.resolution] : [])]) {
    assert.equal(result.neverSave, true);
    assert.equal(result.liveSupportClaimed, false);
    assert.equal(result.livePassClaimed, false);
    assert.equal(result.writeStarted, false);
    assert.equal(result.mutationAllowed, false);
    assert.equal(result.valuesExposed, false);
    assert.equal(result.probeOnly, true);
  }
  assert.equal(output.visibilityBasis, 'attributes_only');
  const serialized = JSON.stringify(output);
  assert.equal(serialized.includes(PRIVATE), false);
  assert.equal(serialized.includes('synthetic-private'), false);
  assert.equal(serialized.includes('resumeId='), false);
}

function auditedResults(requests = {}, url, mutate) {
  const dom = syntheticDom(url);
  const { window } = dom;
  const { document } = window;
  try {
    mutate?.(document, window);
    const before = document.documentElement.outerHTML;
    const attempts = { reads: 0, writes: 0, interactions: 0, events: 0, network: 0, submits: 0 };
    const forbidden = kind => () => { attempts[kind] += 1; throw new Error(PRIVATE); };
    for (const input of document.querySelectorAll('input')) {
      for (const key of ['value', 'checked', 'selected', 'selectedIndex', 'selectedOptions']) {
        Object.defineProperty(input, key, { get: forbidden('reads'), set: forbidden('writes') });
      }
      const getAttribute = input.getAttribute.bind(input);
      input.getAttribute = name => /^(?:value|checked|selected|aria-checked|aria-selected)$/i.test(name)
        ? forbidden('reads')() : getAttribute(name);
    }
    const nativeMatches = window.Element.prototype.matches;
    const text = Object.getOwnPropertyDescriptor(window.Node.prototype, 'textContent');
    Object.defineProperty(window.Node.prototype, 'textContent', {
      configurable: true,
      get() {
        if ((this.nodeType === 1 && nativeMatches.call(this, '[data-private-selected]'))
          || this.querySelector?.('[data-private-selected]')) return forbidden('reads')();
        return text.get.call(this);
      },
      set: forbidden('writes')
    });
    for (const name of ['click', 'focus', 'blur']) window.HTMLElement.prototype[name] = forbidden('interactions');
    window.EventTarget.prototype.dispatchEvent = forbidden('events');
    for (const name of ['submit', 'requestSubmit', 'reset']) window.HTMLFormElement.prototype[name] = forbidden('submits');
    for (const name of ['appendChild', 'removeChild', 'replaceChild', 'insertBefore']) window.Node.prototype[name] = forbidden('writes');
    for (const name of ['setAttribute', 'removeAttribute', 'append', 'prepend', 'remove', 'replaceWith', 'replaceChildren', 'insertAdjacentHTML']) window.Element.prototype[name] = forbidden('writes');
    for (const name of ['write', 'writeln', 'open']) document[name] = forbidden('writes');
    window.fetch = forbidden('network');
    window.XMLHttpRequest.prototype.send = forbidden('network');
    window.XMLHttpRequest = forbidden('network');
    window.WebSocket = forbidden('network');
    window.navigator.sendBeacon = forbidden('network');
    // These apparently read-only APIs are deliberately unavailable. In Blink,
    // URL construction, closest/matches and getClientRects are rejected by
    // throwOnSideEffect; computed style/geometry also exceed our stated scope.
    for (const name of ['matches', 'closest', 'getClientRects', 'getBoundingClientRect']) {
      window.Element.prototype[name] = forbidden('reads');
    }
    window.getComputedStyle = forbidden('reads');
    window.URL = forbidden('reads');
    const observer = new window.MutationObserver(() => {});
    observer.observe(document, { subtree: true, attributes: true, childList: true, characterData: true });
    const direct = inspectCmsRowDOptions(document, requests);
    const serialized = JSON.parse(JSON.stringify(window.eval(buildCmsRowDOptionsProbeExpression(requests))));
    assert.deepEqual(serialized, direct);
    assert.deepEqual(attempts, { reads: 0, writes: 0, interactions: 0, events: 0, network: 0, submits: 0 });
    assert.equal(observer.takeRecords().length, 0);
    observer.disconnect();
    assert.equal(document.documentElement.outerHTML, before);
    assertSafety(serialized);
    return serialized;
  } finally { window.close(); }
}

test('serialized row D probe matches the direct inspector without interaction or current-value reads', () => {
  const result = auditedResults();
  assert.equal(result.reason, 'row_d_preflight_incomplete');
  assert.equal(result.fields.find(row => row.wrapperId === SELECT).reason, 'read_only_options_preflight');
  assert.equal(result.fields.find(row => row.wrapperId === CHECKBOX).reason, 'read_only_options_preflight');
  assert.equal(result.fields.find(row => row.wrapperId === '16_65_0').reason, 'calendar_live_evidence_missing');
  assert.equal(result.fields.find(row => row.wrapperId === SELECT).optionsReadiness, 'observed');
});

for (const [name, mutate, readiness] of [
  ['unmounted target', doc => doc.getElementById(`synthetic-${SELECT}`).remove(), 'target_missing'],
  ['empty target', doc => doc.getElementById(`synthetic-${SELECT}`).replaceChildren(), 'list_empty']
]) test(`serialized SYNTHETIC options readiness diagnoses ${name} without interaction`, () => {
  const result = auditedResults({}, undefined, mutate);
  const row = result.fields.find(candidate => candidate.wrapperId === SELECT);
  assert.equal(row.ok, false);
  assert.equal(row.reason, 'current_options_unavailable');
  assert.equal(row.optionsReadiness, readiness);
  assert.equal(Object.hasOwn(row, 'observedOptionCount'), false);
});

const host = (doc, id = SELECT) => doc.getElementById(id).querySelector('.ant-form-item-control');
const combo = (doc, id = SELECT) => host(doc, id).querySelector('[role="combobox"]');

// SYNTHETIC hypothesis only: no captured real CMS markup is represented here.
function hiddenSearchHelper(doc) {
  const input = host(doc).querySelector('input');
  const search = doc.createElement('span');
  search.className = 'ant-select-search';
  search.setAttribute('style', 'display:none');
  input.className = 'ant-select-search__field';
  combo(doc).append(search);
  search.append(input);
  return { search, input };
}

test('serialized SYNTHETIC hidden-search hypothesis is read only and matches the direct helper exception', () => {
  const result = auditedResults({}, undefined, doc => hiddenSearchHelper(doc));
  const row = result.fields.find(candidate => candidate.wrapperId === SELECT);
  assert.equal(row.reason, 'read_only_options_preflight');
  assert.equal(row.hiddenSearchInputCount, 1);
  assert.equal(row.ok, true);
});

for (const [name, mutate, issue] of [
  ['hidden generic input', doc => { host(doc).querySelector('input').hidden = true; }, 'hidden_non_search_input'],
  ['hidden combobox despite a search helper', doc => { hiddenSearchHelper(doc); combo(doc).hidden = true; }, 'hidden_control'],
  ['disabled search helper', doc => { hiddenSearchHelper(doc).input.setAttribute('disabled', ''); }, 'disabled_attribute_or_class'],
  ['inert helper container', doc => { hiddenSearchHelper(doc).search.setAttribute('inert', ''); }, 'disabled_attribute_or_class'],
  ['inactive Ant collapse ancestor', doc => { host(doc).classList.add('ant-collapse-content-inactive'); }, 'collapsed_ancestor'],
  ['closed details ancestor', doc => {
    const details = doc.createElement('details'); host(doc).append(details);
    details.append(host(doc).querySelector('.ant-select'));
  }, 'collapsed_ancestor']
]) test(`serialized SYNTHETIC availability diagnosis rejects ${name} under the no-interaction audit`, () => {
  const result = auditedResults({}, undefined, mutate);
  const row = result.fields.find(candidate => candidate.wrapperId === SELECT);
  assert.equal(row.ok, false);
  assert.equal(row.reason, 'control_not_available');
  assert.equal(row.availabilityIssue, issue);
});

test('serialized SYNTHETIC location hybrid is diagnosed instead of being declared supported', () => {
  const result = auditedResults({}, undefined, doc => {
    const picker = doc.createElement('span'); picker.className = 'ant-picker';
    host(doc, '13_100701_0').append(picker);
  });
  const row = result.fields.find(candidate => candidate.wrapperId === '13_100701_0');
  assert.equal(row.ok, false);
  assert.equal(row.reason, 'control_kind_mismatch');
  assert.equal(row.controlKindIssue, 'conflicting_picker');
  assert.equal(row.optionsComplete, false);
});

test('serialized SYNTHETIC research observation requires all 32 captured labels', () => {
  const result = auditedResults();
  const row = result.fields.find(candidate => candidate.wrapperId === CHECKBOX);
  assert.equal(row.ok, true);
  assert.equal(row.reason, 'read_only_options_preflight');
  assert.equal(row.optionsComplete, true);
  assert.equal(row.observedOptionCount, 32);
  assert.equal(Object.hasOwn(row, 'samplePrefixMatched'), false);
});

test('serialized SYNTHETIC research prefix drift is counted without exposing the label', () => {
  const result = auditedResults({}, undefined, doc => {
    doc.getElementById(CHECKBOX).querySelector('.ant-checkbox-wrapper > span').textContent = PRIVATE;
  });
  const row = result.fields.find(candidate => candidate.wrapperId === CHECKBOX);
  assert.equal(row.reason, 'option_dictionary_mismatch');
  assert.equal(row.observedOptionCount, 32);
  assert.equal(Object.hasOwn(row, 'samplePrefixMatched'), false);
});


for (const [name, mutate, reason] of [
  ['unknown final label', doc => { doc.getElementById(CHECKBOX).querySelectorAll('.ant-checkbox-wrapper > span:last-child')[31].textContent = PRIVATE; }, 'option_dictionary_mismatch'],
  ['missing final label', doc => { doc.getElementById(CHECKBOX).querySelectorAll('.ant-checkbox-wrapper')[31].remove(); }, 'option_dictionary_mismatch'],
  ['reordered final labels', doc => { const options = doc.getElementById(CHECKBOX).querySelectorAll('.ant-checkbox-wrapper'); options[30].parentElement.insertBefore(options[31], options[30]); }, 'option_dictionary_mismatch'],
  ['duplicate final label', doc => { const labels = doc.getElementById(CHECKBOX).querySelectorAll('.ant-checkbox-wrapper > span:last-child'); labels[31].textContent = labels[30].textContent; }, 'option_list_ambiguous'],
  ['option outside its group', doc => { const option = doc.getElementById(CHECKBOX).querySelector('.ant-checkbox-wrapper'); option.parentElement.parentElement.append(option); }, 'control_ownership_mismatch']
]) test(`serialized SYNTHETIC complete research rejects ${name} under the no-read/no-interaction audit`, () => {
  const result = auditedResults({}, undefined, mutate);
  const row = result.fields.find(candidate => candidate.wrapperId === CHECKBOX);
  assert.equal(row.ok, false);
  assert.equal(row.reason, reason);
  assert.equal(row.optionsComplete, true);
});

test('serialized SYNTHETIC owned calendar reports only structure and retains missing live evidence', () => {
  const result = auditedResults();
  const row = result.fields.find(candidate => candidate.wrapperId === CALENDAR);
  assert.equal(row.ok, false);
  assert.equal(row.reason, 'calendar_live_evidence_missing');
  assert.equal(row.calendarStructureObserved, true);
});

for (const [name, mutate, reason] of [
  ['missing wrapper', doc => doc.getElementById(CALENDAR).remove(), 'wrapper_not_unique'],
  ['duplicate picker', doc => { const picker = host(doc, CALENDAR).querySelector('.ant-calendar-picker'); host(doc, CALENDAR).append(picker.cloneNode(true)); }, 'control_kind_mismatch'],
  ['foreign named wrapper', doc => {
    const foreign = doc.createElement('div'); foreign.id = '16_999999_0';
    host(doc, CALENDAR).append(foreign); foreign.append(host(doc, CALENDAR).querySelector('.ant-calendar-picker'));
  }, 'control_ownership_mismatch'],
  ['disabled input', doc => host(doc, CALENDAR).querySelector('input').setAttribute('disabled', ''), 'control_not_available']
]) test(`serialized SYNTHETIC calendar rejects ${name} before reporting observed structure`, () => {
  const result = auditedResults({}, undefined, mutate);
  const row = result.fields.find(candidate => candidate.wrapperId === CALENDAR);
  assert.equal(row.ok, false);
  assert.equal(row.reason, reason);
  assert.notEqual(row.calendarStructureObserved, true);
});

test('valid requests serialize canonical harvested labels and preserve dictionary limitations', () => {
  const requests = Object.assign(Object.create(null), {
    [SELECT]: `  ${spec(SELECT).options[1]}  `,
    [RADIO]: spec(RADIO).options[0],
    [CHECKBOX]: [spec(CHECKBOX).options[0], spec(CHECKBOX).options[24]],
    '13_100701_0': spec('13_100701_0').options[0],
    '13_100702_0': spec('13_100702_0').options[24]
  });
  const result = auditedResults(requests);
  assert.equal(result.fields.find(row => row.wrapperId === SELECT).resolution.optionIndex, 1);
  assert.deepEqual(result.fields.find(row => row.wrapperId === CHECKBOX).resolution.optionIndexes, [0, 24]);
  assert.equal(result.fields.find(row => row.wrapperId === '13_100702_0').resolution.reason, 'dictionary_reused_unverified');
  assert.equal(result.fields.find(row => row.wrapperId === '13_100702_0').ok, false);
});

test('serialized probe enforces the same exact tenant restriction', () => {
  const result = auditedResults({}, ROW_D_PAGE.replace('SU629dbc0c0dcad452299bc0f7', 'SUdifferent'));
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'wrong_page');
});

for (const [name, url] of [
  ['credentials', ROW_D_PAGE.replace('https://', 'https://user:secret@')],
  ['nondefault port', ROW_D_PAGE.replace('wecruit.hotjob.cn', 'wecruit.hotjob.cn:8443')],
  ['path suffix', `${ROW_D_PAGE}/extra`],
  ['HTTP', ROW_D_PAGE.replace('https:', 'http:')]
]) test(`serialized attribute-only probe rejects ${name} without constructing a URL`, () => {
  assert.equal(auditedResults({}, url).reason, 'wrong_page');
});

function rejectsSanitized(requests) {
  assert.throws(() => buildCmsRowDOptionsProbeExpression(requests), error => {
    assert.equal(error instanceof TypeError, true);
    assert.equal(error.message, ERROR);
    assert.equal(String(error).includes(PRIVATE), false);
    return true;
  });
}

for (const [name, make] of [
  ['null', () => null],
  ['array', () => []],
  ['function', () => () => {}],
  ['custom prototype', () => Object.create({ [SELECT]: spec(SELECT).options[0] })],
  ['unknown wrapper', () => ({ [PRIVATE]: spec(SELECT).options[0] })],
  ['symbol key', () => ({ [Symbol(PRIVATE)]: 'anything' })],
  ['calendar request', () => ({ '16_65_0': '2026-10-24' })],
  ['unknown select label', () => ({ [SELECT]: PRIVATE })],
  ['injection label', () => ({ [SELECT]: `');globalThis.__injected=${JSON.stringify(PRIVATE)};//` })],
  ['nonstring select', () => ({ [SELECT]: 1 })],
  ['empty checkbox', () => ({ [CHECKBOX]: [] })],
  ['duplicate checkbox', () => ({ [CHECKBOX]: [spec(CHECKBOX).options[0], spec(CHECKBOX).options[0]] })],
  ['sparse checkbox', () => ({ [CHECKBOX]: new Array(1) })],
  ['throwing prototype proxy', () => new Proxy({}, { getPrototypeOf() { throw new Error(PRIVATE); } })],
  ['throwing ownKeys proxy', () => new Proxy({}, { ownKeys() { throw new Error(PRIVATE); } })],
  ['throwing descriptor proxy', () => new Proxy({ [SELECT]: spec(SELECT).options[0] }, { getOwnPropertyDescriptor() { throw new Error(PRIVATE); } })],
  ['throwing checkbox proxy', () => ({ [CHECKBOX]: new Proxy([spec(CHECKBOX).options[0]], { getOwnPropertyDescriptor() { throw new Error(PRIVATE); } }) })],
  ['revoked proxy', () => { const { proxy, revoke } = Proxy.revocable({}, {}); revoke(); return proxy; }]
]) test(`builder rejects ${name} with one sanitized error`, () => rejectsSanitized(make()));

test('builder rejects request and checkbox getters without invoking them', () => {
  let calls = 0;
  const requests = Object.defineProperty({}, SELECT, { get() { calls += 1; throw new Error(PRIVATE); } });
  rejectsSanitized(requests);
  const options = Object.defineProperty([], '0', { get() { calls += 1; throw new Error(PRIVATE); } });
  rejectsSanitized({ [CHECKBOX]: options });
  assert.equal(calls, 0);
});

test('builder does not invoke caller array methods, iterators, or toJSON', () => {
  let calls = 0;
  const options = [spec(CHECKBOX).options[0]];
  for (const name of ['map', 'slice', 'toJSON']) options[name] = () => { calls += 1; throw new Error(PRIVATE); };
  options[Symbol.iterator] = () => { calls += 1; throw new Error(PRIVATE); };
  const requests = { [CHECKBOX]: options };
  assert.equal(typeof buildCmsRowDOptionsProbeExpression(requests), 'string');
  assert.equal(calls, 0);
  Object.defineProperty(requests, 'toJSON', { get() { calls += 1; throw new Error(PRIVATE); } });
  rejectsSanitized(requests);
  assert.equal(calls, 0);
});
