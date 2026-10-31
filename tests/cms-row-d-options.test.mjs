/**
 * Offline Never-Save tests only. The fixture is a sanitized harvest projection.
 * Every DOM here is an explicitly SYNTHETIC topology simulation, not captured
 * live HTML, a live control test, or evidence supporting live writes.
 * The research dictionary is independently bound to the R7 static-label capture.
 * Earlier dictionaries were checked against options-merged.json and
 * radio-checkbox.json in cms-row-d-open-harvest-2026-10-24-1445. Location one's
 * recorded 30-item count includes only 25 recorded labels; the other five are
 * deliberately unknown. Location two has no independent dictionary evidence.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import {
  ROW_D_BASE_TIP, ROW_D_HARVEST, ROW_D_PAGE, ROW_D_FIELDS,
  resolveCmsRowDOption, inspectCmsRowDOptions
} from '../scripts/lib/cms-row-d-options.mjs';

const harvest = JSON.parse(fs.readFileSync(new URL('./fixtures/cms-row-d-options-harvest.json', import.meta.url), 'utf8'));
const researchHarvest = JSON.parse(fs.readFileSync(new URL('./fixtures/cms-row-d-research-dictionary-r7.json', import.meta.url), 'utf8'));
const LOCATIONS = ['北京', '上海', '广东', '广西', '江苏', '湖北', '安徽', '山东', '陕西', '宁夏', '甘肃', '新疆', '福建', '浙江', '湖南', '四川', '重庆', '云南', '江西', '河南', '河北', '天津', '山西', '辽宁', '吉林'];
const PASS = ['通过', '未通过'];
const EXPECTED = [
  ['13_43_0', '期望工作性质*', '13', 'ant-select', ['全职', '实习']],
  ['13_100701_0', '意向一：期望工作地点*', '13', 'ant-select', LOCATIONS],
  ['13_100702_0', '意向二：期望工作地点*', '13', 'ant-select', LOCATIONS],
  ['13_47_0', '期望年薪*', '13', 'ant-select', ['10万以下', '11-20万', '21-30万', '31-40万', '41-50万', '51-60万', '61-70万', '71-80万', '81-90万', '91-100万', '101-150万', '151万以上']],
  ['13_195_0', '到岗时间*', '13', 'ant-select', ['一周', '两周', '三周', '一个月', '两个月', '三个月', '六个月', '随时']],
  ['49170501_49170517_0', '工作性质', '49170501', 'ant-select', ['全职', '实习']],
  ['16_63_0', '英语证书名称*', '16', 'ant-select', ['大学英语四级考试', '大学英语六级考试', '大学生英语专业四级考试', '大学生英语专业八级考试', '雅思', '托福', '其他']],
  ['16_64_0', '成绩', '16', 'ant-select', ['未通过', '通过', '优秀']],
  ['49170503_49170533_0', '证券从业资格考试*', '49170503', 'ant-select', PASS],
  ['49170503_49170539_0', '注册会计师考试*', '49170503', 'ant-select', PASS],
  ['49170503_49170543_0', '国家司法考试*', '49170503', 'ant-select', PASS],
  ['49170503_899097553_0', 'FRM*', '49170503', 'ant-select', PASS],
  ['49170503_899059679_0', 'CFA*', '49170503', 'ant-select', PASS],
  ['13_102402_0', '期望工作地是否服从分配*', '13', 'radio-group', ['是', '否']],
  ['13_102501_0', '如应聘研究发展中心行业研究类岗位请勾选（建议仅勾选3~5项）*', '13', 'checkbox', ['非研究类岗位，不涉及', '宏观', '策略', '债券', '银行', '非银行金融', '房地产', '量化', '基金评价', '金属及材料（有色金属）', '化工', '交通运输', '生物医药', '汽车', '机械', '军工', '电力设备及新能源', '建材', '食品饮料', '轻工纺服', '纺服化妆品', '农林牧渔', '家电', '商业（零售+社会服务）', '电子', '传媒', '通信', '计算机', '中小盘', '环保及公用事业', '煤炭开采', '智库研究']]
].map(([wrapperId, label, sectionId, controlKind, options]) => ({ wrapperId, label, sectionId, controlKind, options }));
const PRIVATE = 'SYNTHETIC_PRIVATE_SENTINEL_DO_NOT_READ';
const SELECT = '13_195_0';
const RADIO = '13_102402_0';
const CHECKBOX = '13_102501_0';
const CALENDAR = '16_65_0';
const get = (doc, id) => doc.getElementById(id);
const item = (doc, id) => get(doc, id).querySelector('.ant-form-item');
const host = (doc, id) => item(doc, id).querySelector('.ant-form-item-control');
const combo = (doc, id) => get(doc, id).querySelector('[role="combobox"]');
const list = (doc, id) => get(doc, `synthetic-list-${id}`);
const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function safety(result) {
  assert.equal(result.neverSave, true);
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.livePassClaimed, false);
  assert.equal(result.writeStarted, false);
  assert.equal(result.mutationAllowed, false);
  assert.equal(result.valuesExposed, false);
  assert.equal(result.probeOnly, true);
  const walk = node => {
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      assert.doesNotMatch(key, /^(?:value|values|request|requested|selected|selectedText|textContent|innerHTML|outerHTML|options|optionsSample|optionsVisible|href|resumeId|tid)$/);
      walk(value);
    }
  };
  walk(result);
  const output = JSON.stringify(result);
  assert.equal(output.includes(PRIVATE), false);
  assert.equal(output.includes('synthetic-private'), false);
  assert.equal(output.includes('resumeId='), false);
  assert.equal(output.includes('tid='), false);
  for (const row of result.fields || []) {
    assert.equal(row.neverSave, true);
    assert.equal(row.liveSupportClaimed, false);
    assert.equal(row.livePassClaimed, false);
    assert.equal(row.writeStarted, false);
    assert.equal(row.mutationAllowed, false);
    assert.equal(row.valuesExposed, false);
    assert.equal(row.probeOnly, true);
  }
}

function syntheticControl(row) {
  if (row.controlKind === 'ant-select') return `<div class="ant-select ant-select-enabled"><div class="ant-select-selection ant-select-selection--single" role="combobox" aria-controls="synthetic-list-${row.wrapperId}" aria-expanded="false"><span class="ant-select-selection-selected-value" data-synthetic-selected-text>${PRIVATE}</span><input type="text" value="${PRIVATE}"></div></div>`;
  if (row.controlKind === 'ant-calendar-picker') return `<span class="ant-calendar-picker"><input readonly type="text" value="${PRIVATE}"></span>`;
  const type = row.controlKind === 'radio-group' ? 'radio' : 'checkbox';
  return `<div class="ant-${type}-group">${row.options.map(option => `<label class="ant-${type}-wrapper"><span class="ant-${type}"><input class="ant-${type}-input" type="${type}" value="${PRIVATE}"></span><span>${escape(option)}</span></label>`).join('')}</div>`;
}

function syntheticDom({ url = `${ROW_D_PAGE}?resumeId=synthetic-private&tid=synthetic-private`, mutate } = {}) {
  const rows = [...EXPECTED];
  const calendar = harvest.fields.find(row => row.wrapperId === CALENDAR);
  if (calendar) rows.push(calendar);
  const sections = [...new Set(rows.map(row => row.sectionId))].map(sectionId => `<section id="${sectionId}" class="form-cell">${rows.filter(row => row.sectionId === sectionId).map(row => `<div id="${row.wrapperId}"><div style="position:static"><div class="ant-row ant-form-item"><div class="ant-form-item-label"><label>${escape(row.label)}</label></div><div class="ant-form-item-control">${syntheticControl(row)}</div></div></div></div>`).join('')}</section>`).join('');
  // Portal IDs and topology are synthetic. Only the option labels are recorded.
  const portals = EXPECTED.filter(row => row.controlKind === 'ant-select').map(row => `<div class="ant-select-dropdown ant-select-dropdown-hidden" style="display:none"><ul id="synthetic-list-${row.wrapperId}" role="listbox">${row.options.map(option => `<li class="ant-select-dropdown-menu-item" role="option">${escape(option)}</li>`).join('')}</ul></div>`).join('');
  const dom = new JSDOM(`<!doctype html><body><form>${sections}<button type="submit">synthetic submit</button></form>${portals}</body>`, { url, pretendToBeVisual: true, runScripts: 'outside-only' });
  dom.window.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  Object.defineProperty(dom.window.document, 'readyState', { configurable: true, get: () => 'complete' });
  Object.defineProperty(dom.window.document, 'visibilityState', { configurable: true, get: () => 'visible' });
  mutate?.(dom.window.document, dom.window);
  return dom;
}

function auditedInspect(dom, requests = {}) {
  const { window } = dom;
  const { document } = window;
  const before = document.documentElement.outerHTML;
  const attempted = { mutations: 0, interactions: 0, events: 0, submits: 0, network: 0, currentValueReads: 0 };
  const forbidden = kind => () => { attempted[kind] += 1; throw new Error(`read-only inspector attempted ${kind}`); };
  const observer = new window.MutationObserver(() => {});
  observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  for (const control of document.querySelectorAll('input, textarea, select, option')) {
    for (const key of ['value', 'checked', 'selected', 'selectedIndex', 'selectedOptions']) Object.defineProperty(control, key, { configurable: true, get: forbidden('currentValueReads'), set: forbidden('mutations') });
    const getAttribute = control.getAttribute.bind(control);
    control.getAttribute = name => /^(?:value|checked|selected|aria-checked|aria-selected)$/i.test(name) ? forbidden('currentValueReads')() : getAttribute(name);
  }
  for (const selected of document.querySelectorAll('[data-synthetic-selected-text]')) {
    for (const key of ['textContent', 'innerText', 'innerHTML']) Object.defineProperty(selected, key, { configurable: true, get: forbidden('currentValueReads'), set: forbidden('mutations') });
  }
  const textContent = Object.getOwnPropertyDescriptor(window.Node.prototype, 'textContent');
  Object.defineProperty(window.Node.prototype, 'textContent', {
    configurable: true,
    get() {
      if (this.querySelector?.('[data-synthetic-selected-text]')) return forbidden('currentValueReads')();
      return textContent.get.call(this);
    },
    set: forbidden('mutations')
  });
  for (const key of ['click', 'blur', 'focus']) window.HTMLElement.prototype[key] = forbidden('interactions');
  window.EventTarget.prototype.dispatchEvent = forbidden('events');
  for (const key of ['submit', 'requestSubmit', 'reset']) window.HTMLFormElement.prototype[key] = forbidden('submits');
  for (const key of ['appendChild', 'insertBefore', 'removeChild', 'replaceChild']) window.Node.prototype[key] = forbidden('mutations');
  for (const key of ['setAttribute', 'setAttributeNS', 'removeAttribute', 'removeAttributeNS', 'insertAdjacentHTML', 'insertAdjacentElement', 'insertAdjacentText', 'remove', 'replaceWith', 'append', 'prepend', 'replaceChildren']) window.Element.prototype[key] = forbidden('mutations');
  for (const key of ['write', 'writeln', 'open']) document[key] = forbidden('mutations');
  window.fetch = forbidden('network');
  window.XMLHttpRequest.prototype.send = forbidden('network');
  window.XMLHttpRequest = forbidden('network');
  window.WebSocket = forbidden('network');
  window.navigator.sendBeacon = forbidden('network');
  // The imported inspector runs in Node's realm. Cover network globals there
  // as well as the simulated document window, then restore them synchronously.
  const processNetwork = new Map();
  for (const key of ['fetch', 'WebSocket', 'XMLHttpRequest']) {
    if (typeof globalThis[key] === 'function') {
      processNetwork.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      globalThis[key] = forbidden('network');
    }
  }
  let result;
  try {
    result = inspectCmsRowDOptions(document, requests);
    assert.deepEqual(attempted, { mutations: 0, interactions: 0, events: 0, submits: 0, network: 0, currentValueReads: 0 });
    assert.equal(observer.takeRecords().length, 0);
    assert.equal(document.documentElement.outerHTML, before);
    safety(result);
  } finally {
    observer.disconnect();
    for (const [key, descriptor] of processNetwork) Object.defineProperty(globalThis, key, descriptor);
  }
  return result;
}

function withInspection(options, check, requests = {}) {
  const dom = syntheticDom(options);
  try { check(auditedInspect(dom, requests)); } finally { dom.window.close(); }
}

// This is a SYNTHETIC hypothesis about Ant's search-helper topology, not a
// captured CMS element or evidence that these fields are live available.
function hiddenSearchHelper(doc, id = SELECT, type = 'text') {
  const input = host(doc, id).querySelector('input');
  const search = doc.createElement('span');
  search.className = 'ant-select-search';
  search.setAttribute('style', 'display:none');
  input.className = 'ant-select-search__field';
  input.setAttribute('type', type);
  combo(doc, id).append(search);
  search.append(input);
  return { input, search };
}

for (const style of ['display:none', 'DISPLAY : none ! important', 'display:/* hidden */none',
  'visibility:hidden', 'visibility:collapse!important', 'content-visibility:hidden']) {
  test(`SYNTHETIC inline ancestor hiding is rejected from attributes: ${style}`, () => {
    fieldFailure(SELECT, doc => get(doc, SELECT).firstElementChild.setAttribute('style', style),
      'wrapper_scope_or_visibility_mismatch');
  });
}

test('SYNTHETIC stylesheet-only hiding remains explicitly unverified', () => {
  withInspection({ mutate: doc => {
    const style = doc.createElement('style');
    style.textContent = '[id="13_195_0"] { display:none }';
    doc.head.append(style);
  } }, result => {
    assert.equal(result.visibilityBasis, 'attributes_only');
    assert.equal(result.fields.find(row => row.wrapperId === SELECT).reason, 'read_only_options_preflight');
    assert.equal(result.ok, false);
    assert.equal(result.livePassClaimed, false);
    assert.equal(result.mutationAllowed, false);
  });
});

function fieldFailure(id, mutate, reason) {
  withInspection({ mutate }, result => {
    const row = result.fields.find(candidate => candidate.wrapperId === id);
    assert.ok(row, 'known field remains in sanitized report');
    assert.equal(row.ok, false);
    assert.equal(row.status, 'skipped');
    if (reason) assert.equal(row.reason, reason);
    if (id === CHECKBOX) assert.notEqual(row.reason, 'option_dictionary_incomplete', 'malformed control must fail before sample limitation');
  });
}

test('exact row-D namespace and frozen dictionaries match independently checked harvest labels', () => {
  assert.equal(ROW_D_BASE_TIP, 'ef771fc02415a9249bfe86dd9d20afca7f6c130d');
  assert.equal(harvest.baseTip, ROW_D_BASE_TIP);
  assert.equal(harvest.harvest, ROW_D_HARVEST);
  assert.match(ROW_D_HARVEST, /cms-row-d-open-harvest-2026-10-24-1445/);
  assert.equal(harvest.neverSave, true);
  assert.equal(harvest.liveSupportClaimed, false);
  const ids = [...EXPECTED.map(row => row.wrapperId), CALENDAR];
  assert.deepEqual(ROW_D_FIELDS.map(row => row.wrapperId).sort(), ids.sort());
  assert.deepEqual(harvest.fields.map(row => row.wrapperId).sort(), ids.sort());
  assert.equal(new Set(ROW_D_FIELDS.map(row => row.key)).size, ROW_D_FIELDS.length);
  assert.equal(Object.isFrozen(ROW_D_FIELDS), true);
  for (const expected of EXPECTED) {
    const spec = ROW_D_FIELDS.find(row => row.wrapperId === expected.wrapperId);
    const recorded = expected.wrapperId === CHECKBOX ? researchHarvest.field
      : harvest.fields.find(row => row.wrapperId === expected.wrapperId);
    for (const key of ['wrapperId', 'label', 'sectionId', 'controlKind', 'options']) {
      assert.deepEqual(spec[key], expected[key], `${expected.wrapperId} adapter ${key}`);
      assert.deepEqual(recorded[key], expected[key], `${expected.wrapperId} fixture ${key}`);
    }
    for (const key of ['harvestedOptionCount', 'dictionaryOptionCount', 'optionsComplete', 'evidenceSource', 'reusedFrom', 'independentOptionsEvidence']) {
      assert.deepEqual(spec[key], recorded[key], `${expected.wrapperId} fixture metadata ${key}`);
    }
    assert.equal(Object.isFrozen(spec), true);
    assert.equal(Object.isFrozen(spec.options), true);
    assert.equal(new Set(spec.options).size, spec.options.length);
    assert.ok(spec.evidenceSource);
    assert.ok(['13', '16', '49170501', '49170503'].includes(spec.sectionId));
  }
  assert.equal(EXPECTED.reduce((sum, row) => sum + row.options.length, 0), 128);
  assert.equal(EXPECTED.filter(row => row.controlKind === 'ant-select').length, 13);
  assert.equal(harvest.sources.length, 10);
  for (const source of harvest.sources) assert.match(source.sha256, /^[a-f0-9]{64}$/);
});


test('research R7 provenance binds the 32 static owned labels without upgrading historical capture results', () => {
  assert.equal(researchHarvest.tip, '8abbdc20dc1b79bfb52d4378f62a4f2023943ef0');
  assert.equal(researchHarvest.sources.find(row => row.file === 'diagnostics.json').sha256,
    '6fba18afae9b2b97a64c411a0b71d63bda33a6e0505f6e4d9b85c8e7a2b3ddf9');
  assert.equal(researchHarvest.sources.find(row => row.file === 'collect-reviewed.mjs').sha256,
    '9518bac6c4d99512504803ce27baac005bff7d5f992f66bcf2490c39acfcb43b');
  for (const source of researchHarvest.sources) assert.match(source.sha256, /^[a-f0-9]{64}$/u);
  assert.equal(researchHarvest.official.fieldsOk, 12);
  assert.equal(researchHarvest.official.reason, 'row_d_preflight_incomplete');
  assert.equal(researchHarvest.official.keeperAssessment, 'correlated_keeper_blocks');
  assert.equal(researchHarvest.official.responseToNonGetCount, 0);
  assert.equal(researchHarvest.ownedOptionCount, 32);
  assert.equal(researchHarvest.ownedInputCount, 32);
  for (const key of ['optionOwnershipVerified', 'staticTextSpanShapeVerified', 'knownPrefixMatched', 'labelsUnique']) assert.equal(researchHarvest[key], true);
  for (const key of ['itemScoped', 'labelMatched', 'questionUnique', 'allControlsOwned']) assert.equal(researchHarvest.scope[key], true);
  const historical = harvest.fields.find(row => row.wrapperId === CHECKBOX);
  assert.equal(historical.options.length, 25);
  assert.equal(historical.optionsComplete, false);
  assert.deepEqual(researchHarvest.field.options.slice(0, 25), historical.options);
  assert.deepEqual(researchHarvest.field.options.slice(25), ['传媒', '通信', '计算机', '中小盘', '环保及公用事业', '煤炭开采', '智库研究']);
  assert.equal(researchHarvest.booked, 53);
  assert.equal(researchHarvest.bookD, false);
  assert.equal(researchHarvest.liveSupportClaimed, false);
});

test('location count and independent-evidence gaps are explicit; missing five labels are never fabricated', () => {
  const first = ROW_D_FIELDS.find(row => row.wrapperId === '13_100701_0');
  const second = ROW_D_FIELDS.find(row => row.wrapperId === '13_100702_0');
  assert.equal(first.harvestedOptionCount, 30);
  assert.equal(first.options.length, 25);
  assert.equal(first.optionsComplete, false);
  assert.equal(second.reusedFrom, first.wrapperId);
  assert.equal(second.independentOptionsEvidence, false);
  assert.equal(second.optionsComplete, false);
  assert.equal(second.harvestedOptionCount, 0);
  assert.equal(second.dictionaryOptionCount, 30);
  const checkbox = ROW_D_FIELDS.find(row => row.wrapperId === CHECKBOX);
  assert.equal(checkbox.optionsComplete, true);
  assert.equal(checkbox.harvestedOptionCount, 32);
  assert.equal(checkbox.options.length, 32);
  for (const id of [first.wrapperId, second.wrapperId]) {
    const result = resolveCmsRowDOption(id, PRIVATE);
    safety(result);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'option_unknown');
    assert.equal('optionIndex' in result, false);
  }
});

for (const expected of EXPECTED) test(`all ${expected.options.length} recorded options resolve by index for ${expected.wrapperId}`, () => {
  for (const [index, option] of expected.options.entries()) {
    const result = resolveCmsRowDOption(expected.wrapperId, expected.controlKind === 'checkbox' ? [option] : option);
    safety(result);
    assert.equal(JSON.stringify(result).includes(option), false, 'matched label is not echoed');
    assert.equal(result.ok, true);
    assert.equal(result.status, 'matched');
    assert.equal(result.wrapperId, expected.wrapperId);
    assert.equal(result.reason, expected.wrapperId === '13_100701_0' ? 'dictionary_sample_matched' : expected.wrapperId === '13_100702_0' ? 'dictionary_reused_unverified' : 'option_matched');
    if (expected.controlKind === 'checkbox') assert.deepEqual(result.optionIndexes, [index]);
    else assert.equal(result.optionIndex, index);
  }
});

test('checkbox returns only indexes in requested order without enforcing recommendation as a cardinality rule', () => {
  const options = EXPECTED.find(row => row.wrapperId === CHECKBOX).options;
  for (const request of [[options[24], options[0], options[8]], options]) {
    const result = resolveCmsRowDOption(CHECKBOX, request);
    safety(result);
    assert.equal(result.ok, true);
    assert.deepEqual(result.optionIndexes, request.map(option => options.indexOf(option)));
  }
});

for (const [name, request] of [
  ['single sparse slot', new Array(1)],
  ['mixed sparse slots', Object.assign(new Array(3), { 0: '宏观', 2: '电子' })],
  ['too many selections', Array(33).fill('宏观')]
]) test(`checkbox rejects ${name} without a partial index result`, () => {
  const result = resolveCmsRowDOption(CHECKBOX, request);
  safety(result);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'request_type_invalid');
  assert.equal('optionIndexes' in result, false);
});

test('checkbox rejects accessor elements without running caller getters', () => {
  let reads = 0;
  const request = Object.defineProperty(new Array(1), '0', { get() { reads += 1; throw new Error(PRIVATE); } });
  const result = resolveCmsRowDOption(CHECKBOX, request);
  safety(result);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'request_type_invalid');
  assert.equal(reads, 0);
});

test('checkbox rejects an inherited array index without reading it', () => {
  let reads = 0;
  const prototype = Object.create(Array.prototype, { 0: { get() { reads += 1; throw new Error(PRIVATE); } } });
  const request = Object.setPrototypeOf(new Array(1), prototype);
  const result = resolveCmsRowDOption(CHECKBOX, request);
  safety(result);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'request_type_invalid');
  assert.equal(reads, 0);
});

test('checkbox does not execute array subclass methods or a caller iterator', () => {
  let calls = 0;
  const forbidden = () => { calls += 1; throw new Error(PRIVATE); };
  class Requested extends Array { some() { return forbidden(); } map() { return forbidden(); } [Symbol.iterator]() { return forbidden(); } }
  const request = new Requested('电子', '宏观');
  request.filter = forbidden;
  const result = resolveCmsRowDOption(CHECKBOX, request);
  safety(result);
  assert.equal(calls, 0);
  if (result.ok) assert.deepEqual(result.optionIndexes, [24, 1]);
  else assert.equal(result.reason, 'request_type_invalid');
});

for (const [name, makeRequest] of [
  ['throwing descriptor proxy', () => new Proxy(['宏观'], { getOwnPropertyDescriptor() { throw new Error(PRIVATE); } })],
  ['revoked proxy', () => { const { proxy, revoke } = Proxy.revocable(['宏观'], {}); revoke(); return proxy; }]
]) test(`checkbox returns a sanitized failure for a ${name}`, () => {
  const result = resolveCmsRowDOption(CHECKBOX, makeRequest());
  safety(result);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'request_type_invalid');
  assert.equal('optionIndexes' in result, false);
});

for (const [name, id, request, reason] of [
  ['unknown namespace', '14_28_0', PRIVATE, 'unknown_field'],
  ['unknown wrapper', PRIVATE, PRIVATE, 'unknown_field'],
  ['key is not wrapper id', 'salary', PRIVATE, 'unknown_field'],
  ['missing wrapper', undefined, PRIVATE, 'unknown_field'],
  ['object wrapper', { toString() { throw new Error('must not coerce wrapper'); } }, PRIVATE, 'unknown_field'],
  ['missing scalar', SELECT, undefined, 'request_type_invalid'],
  ['null scalar', SELECT, null, 'request_type_invalid'],
  ['numeric scalar', SELECT, 0, 'request_type_invalid'],
  ['object scalar', SELECT, { toString() { throw new Error('must not coerce request'); } }, 'request_type_invalid'],
  ['array scalar', SELECT, ['一周'], 'request_type_invalid'],
  ['empty scalar', SELECT, '', 'request_empty'],
  ['blank scalar', SELECT, ' \n\t ', 'request_empty'],
  ['unknown scalar', SELECT, PRIVATE, 'option_unknown'],
  ['unknown radio', RADIO, PRIVATE, 'option_unknown'],
  ['checkbox scalar', CHECKBOX, '宏观', 'request_type_invalid'],
  ['checkbox null', CHECKBOX, null, 'request_type_invalid'],
  ['empty checkbox', CHECKBOX, [], 'request_empty'],
  ['invalid checkbox item', CHECKBOX, ['宏观', null], 'request_type_invalid'],
  ['blank checkbox item', CHECKBOX, ['宏观', ' '], 'request_empty'],
  ['unknown checkbox item', CHECKBOX, ['宏观', PRIVATE], 'option_unknown'],
  ['repeated checkbox item', CHECKBOX, ['宏观', '宏观'], 'duplicate_option'],
  ['trim-equal checkbox item', CHECKBOX, ['宏观', ' 宏观 '], 'duplicate_option']
]) test(`resolver fails closed without echo: ${name}`, () => {
  const result = resolveCmsRowDOption(id, request);
  safety(result);
  assert.equal(result.ok, false);
  assert.equal(result.status, 'skipped');
  assert.equal(result.reason, reason);
  assert.equal('optionIndex' in result, false);
  assert.equal('optionIndexes' in result, false);
});

test('exact option matching allows outer whitespace but no substring, alias, case or punctuation guessing', () => {
  assert.equal(resolveCmsRowDOption(SELECT, ' \n一周\t ').optionIndex, 0);
  for (const [id, request] of [[SELECT, '一'], [SELECT, '1周'], ['16_63_0', 'CET4'], ['13_47_0', '11–20万'], ['13_100701_0', '北京市']]) {
    const result = resolveCmsRowDOption(id, request);
    safety(result);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'option_unknown');
  }
});

test('calendar remains an explicit skip without live support or a date result', () => {
  const spec = ROW_D_FIELDS.find(row => row.wrapperId === CALENDAR);
  assert.equal(spec.controlKind, 'ant-calendar-picker');
  assert.equal(spec.label, '获得时间*');
  const result = resolveCmsRowDOption(CALENDAR, PRIVATE);
  safety(result);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'calendar_live_evidence_missing');
  assert.equal('optionIndex' in result, false);
});

test('SYNTHETIC descendant-item structure and hidden dormant portal lists inspect with zero interactions', () => {
  withInspection({ mutate: doc => {
    for (const expected of EXPECTED) {
      assert.equal(get(doc, expected.wrapperId).closest('.ant-form-item'), null);
      assert.equal(get(doc, expected.wrapperId).querySelectorAll('.ant-form-item').length, 1);
    }
  } }, result => {
    assert.equal(result.fields.length, ROW_D_FIELDS.length);
    for (const expected of EXPECTED) {
      const row = result.fields.find(candidate => candidate.wrapperId === expected.wrapperId);
      if (['13_100701_0', '13_100702_0'].includes(expected.wrapperId)) {
        assert.equal(row.ok, false);
        assert.equal(row.reason, 'option_dictionary_mismatch');
      } else {
        assert.equal(row.ok, true, `${expected.wrapperId}: ${row.reason}`);
        assert.equal(row.reason, 'read_only_options_preflight');
      }
    }
    const calendar = result.fields.find(row => row.wrapperId === CALENDAR);
    assert.equal(calendar.status, 'skipped');
    assert.equal(calendar.reason, 'calendar_live_evidence_missing');
  });
});

for (const type of ['text', 'search']) {
  test(`SYNTHETIC hypothesis: a uniquely owned hidden Ant ${type} search helper does not hide the select`, () => {
    withInspection({ mutate: doc => hiddenSearchHelper(doc, SELECT, type) }, result => {
      const row = result.fields.find(candidate => candidate.wrapperId === SELECT);
      assert.equal(row.ok, true);
      assert.equal(row.reason, 'read_only_options_preflight');
      assert.equal(row.hiddenSearchInputCount, 1);
      assert.equal('availabilityIssue' in row, false);
    });
  });
}

test('SYNTHETIC ordinary visible select reports zero hidden search helpers', () => {
  withInspection({}, result => {
    const row = result.fields.find(candidate => candidate.wrapperId === SELECT);
    assert.equal(row.ok, true);
    assert.equal(row.hiddenSearchInputCount, 0);
  });
});

for (const [name, mutate, issue] of [
  ['generic hidden text input', doc => { host(doc, SELECT).querySelector('input').hidden = true; }, 'hidden_non_search_input'],
  ['helper missing its search-field class', doc => { hiddenSearchHelper(doc).input.className = 'synthetic-generic-input'; }, 'hidden_non_search_input'],
  ['helper missing its search container', doc => { const { input, search } = hiddenSearchHelper(doc); combo(doc, SELECT).append(input); search.remove(); input.hidden = true; }, 'hidden_non_search_input'],
  ['helper outside its combobox', doc => { const { search } = hiddenSearchHelper(doc); host(doc, SELECT).querySelector('.ant-select').append(search); }, 'hidden_non_search_input'],
  ['hidden whole combobox', doc => { hiddenSearchHelper(doc); combo(doc, SELECT).hidden = true; }, 'hidden_control'],
  ['hidden whole select', doc => { hiddenSearchHelper(doc); host(doc, SELECT).querySelector('.ant-select').hidden = true; }, 'hidden_control'],
  ['disabled helper input', doc => { hiddenSearchHelper(doc).input.setAttribute('disabled', ''); }, 'disabled_attribute_or_class'],
  ['aria-disabled helper container', doc => { hiddenSearchHelper(doc).search.setAttribute('aria-disabled', 'true'); }, 'disabled_attribute_or_class'],
  ['disabled select ancestor', doc => { hiddenSearchHelper(doc); host(doc, SELECT).querySelector('.ant-select').classList.add('ant-select-disabled'); }, 'disabled_attribute_or_class'],
  ['inert helper container', doc => { hiddenSearchHelper(doc).search.setAttribute('inert', ''); }, 'disabled_attribute_or_class'],
  ['inert whole select', doc => { hiddenSearchHelper(doc); host(doc, SELECT).querySelector('.ant-select').setAttribute('inert', ''); }, 'disabled_attribute_or_class']
]) test(`SYNTHETIC hypothesis still rejects ${name}`, () => {
  withInspection({ mutate }, result => {
    const row = result.fields.find(candidate => candidate.wrapperId === SELECT);
    assert.equal(row.ok, false);
    assert.equal(row.reason, 'control_not_available');
    assert.equal(row.availabilityIssue, issue);
  });
});

test('SYNTHETIC hypothesis rejects two hidden Ant search helpers in one combobox', () => {
  withInspection({ mutate: doc => {
    const { search, input } = hiddenSearchHelper(doc);
    search.append(input.cloneNode(true));
  } }, result => {
    const row = result.fields.find(candidate => candidate.wrapperId === SELECT);
    assert.equal(row.ok, false);
    assert.equal(row.reason, 'control_not_available');
  });
});

for (const [name, mutate] of [
  ['inactive Ant collapse content', doc => { host(doc, SELECT).classList.add('ant-collapse-content-inactive'); }],
  ['closed details ancestor', doc => {
    const details = doc.createElement('details');
    host(doc, SELECT).append(details);
    details.append(host(doc, SELECT).querySelector('.ant-select'));
  }]
]) test(`SYNTHETIC ${name} is reported without expanding it`, () => {
  withInspection({ mutate }, result => {
    const row = result.fields.find(candidate => candidate.wrapperId === SELECT);
    assert.equal(row.ok, false);
    assert.equal(row.reason, 'control_not_available');
    assert.equal(row.availabilityIssue, 'collapsed_ancestor');
  });
});

test('SYNTHETIC open details ancestor does not imply a collapsed control', () => {
  withInspection({ mutate: doc => {
    const details = doc.createElement('details');
    details.setAttribute('open', '');
    host(doc, SELECT).append(details);
    details.append(host(doc, SELECT).querySelector('.ant-select'));
  } }, result => {
    assert.equal(result.fields.find(candidate => candidate.wrapperId === SELECT).reason, 'read_only_options_preflight');
  });
});

for (const [name, mutate, issue] of [
  ['an Ant picker beside the select', doc => { const picker = doc.createElement('span'); picker.className = 'ant-picker'; host(doc, SELECT).append(picker); }, 'conflicting_picker'],
  ['a button in the field', doc => { host(doc, SELECT).append(doc.createElement('button')); }, 'unexpected_interactive_control'],
  ['a missing select', doc => { host(doc, SELECT).querySelector('.ant-select').remove(); }, 'select_not_unique'],
  ['two selects', doc => { host(doc, SELECT).append(host(doc, SELECT).querySelector('.ant-select').cloneNode(true)); }, 'select_not_unique'],
  ['a radio beside the select', doc => { const input = doc.createElement('input'); input.type = 'radio'; host(doc, SELECT).append(input); }, 'mixed_choice_controls'],
  ['a text input outside the select', doc => { host(doc, SELECT).append(host(doc, SELECT).querySelector('input').cloneNode(true)); }, 'input_outside_select'],
  ['a password input inside the select', doc => { host(doc, SELECT).querySelector('input').type = 'password'; }, 'unexpected_input_kind']
]) test(`SYNTHETIC control-kind diagnosis rejects ${name} without whitelisting the hybrid`, () => {
  withInspection({ mutate }, result => {
    const row = result.fields.find(candidate => candidate.wrapperId === SELECT);
    assert.equal(row.ok, false);
    assert.equal(row.reason, 'control_kind_mismatch');
    assert.equal(row.controlKindIssue, issue);
  });
});

for (const id of ['13_100701_0', '13_100702_0']) {
  test(`SYNTHETIC location ${id} picker/select hybrid stays incomplete with a fixed diagnosis`, () => {
    withInspection({ mutate: doc => {
      const picker = doc.createElement('span'); picker.className = 'ant-calendar-picker';
      host(doc, id).append(picker);
    } }, result => {
      const row = result.fields.find(candidate => candidate.wrapperId === id);
      assert.equal(row.ok, false);
      assert.equal(row.reason, 'control_kind_mismatch');
      assert.equal(row.controlKindIssue, 'conflicting_picker');
      assert.equal(row.optionsComplete, false);
    });
  });
}


test('SYNTHETIC research upgrade keeps both evidenced peer-select locations and calendar skipped', () => {
  withInspection({ mutate: doc => {
    for (const id of ['13_100701_0', '13_100702_0']) {
      const select = host(doc, id).querySelector('.ant-select');
      host(doc, id).append(select.cloneNode(true));
    }
  } }, result => {
    assert.equal(result.reason, 'row_d_preflight_incomplete');
    assert.equal(result.ok, false);
    assert.equal(result.fields.filter(row => row.ok).length, 13, 'synthetic hypothesis only');
    assert.equal(result.fields.find(row => row.wrapperId === CHECKBOX).reason, 'read_only_options_preflight');
    for (const id of ['13_100701_0', '13_100702_0']) {
      const row = result.fields.find(row => row.wrapperId === id);
      assert.equal(row.reason, 'control_kind_mismatch');
      assert.equal(row.controlKindIssue, 'select_not_unique');
      assert.equal(row.optionsComplete, false);
    }
    assert.equal(result.fields.find(row => row.wrapperId === CALENDAR).reason, 'calendar_live_evidence_missing');
  });
});

test('SYNTHETIC complete recorded research dictionary passes read-only observation', () => {
  withInspection({}, result => {
    const row = result.fields.find(candidate => candidate.wrapperId === CHECKBOX);
    assert.equal(row.ok, true);
    assert.equal(row.reason, 'read_only_options_preflight');
    assert.equal(row.optionsComplete, true);
    assert.equal(row.observedOptionCount, 32);
    assert.equal(Object.hasOwn(row, 'samplePrefixMatched'), false);
  });
});

for (const [name, mutate, reason, count] of [
  ['unknown last label', doc => { get(doc, CHECKBOX).querySelectorAll('.ant-checkbox-wrapper > span:last-child')[31].textContent = PRIVATE; }, 'option_dictionary_mismatch', 32],
  ['missing final label', doc => { get(doc, CHECKBOX).querySelectorAll('.ant-checkbox-wrapper')[31].remove(); }, 'option_dictionary_mismatch', 31],
  ['old 25-label sample', doc => { const options = get(doc, CHECKBOX).querySelectorAll('.ant-checkbox-wrapper'); for (let index = 25; index < options.length; index += 1) options[index].remove(); }, 'option_dictionary_mismatch', 25],
  ['reordered final labels', doc => { const options = get(doc, CHECKBOX).querySelectorAll('.ant-checkbox-wrapper'); options[30].parentElement.insertBefore(options[31], options[30]); }, 'option_dictionary_mismatch', 32],
  ['duplicate final label', doc => { const labels = get(doc, CHECKBOX).querySelectorAll('.ant-checkbox-wrapper > span:last-child'); labels[31].textContent = labels[30].textContent; }, 'option_list_ambiguous', undefined],
  ['additional unknown label', doc => { const option = get(doc, CHECKBOX).querySelector('.ant-checkbox-wrapper').cloneNode(true); option.querySelector('span:last-child').textContent = PRIVATE; get(doc, CHECKBOX).querySelector('.ant-checkbox-group').append(option); }, 'option_dictionary_mismatch', 33],
  ['option outside owned group', doc => { host(doc, CHECKBOX).append(get(doc, CHECKBOX).querySelector('.ant-checkbox-wrapper')); }, 'control_ownership_mismatch', undefined],
  ['foreign named wrapper', doc => { const foreign = doc.createElement('div'); foreign.id = '13_999999_0'; const group = get(doc, CHECKBOX).querySelector('.ant-checkbox-group'); group.parentElement.append(foreign); foreign.append(group); }, 'control_ownership_mismatch', undefined]
]) test(`SYNTHETIC research rejects ${name} without echoing option text`, () => {
  withInspection({ mutate }, result => {
    const row = result.fields.find(candidate => candidate.wrapperId === CHECKBOX);
    assert.equal(row.ok, false);
    assert.equal(row.reason, reason);
    assert.equal(row.optionsComplete, true);
    assert.equal(row.observedOptionCount, count);
    assert.equal(Object.hasOwn(row, 'samplePrefixMatched'), false);
  });
});

for (const pickerClass of ['ant-calendar-picker', 'ant-picker']) {
  test(`SYNTHETIC owned ${pickerClass} structure is observed without establishing live calendar evidence`, () => {
    withInspection({ mutate: doc => { host(doc, CALENDAR).querySelector('.ant-calendar-picker').className = pickerClass; } }, result => {
      const row = result.fields.find(candidate => candidate.wrapperId === CALENDAR);
      assert.equal(row.ok, false);
      assert.equal(row.status, 'skipped');
      assert.equal(row.reason, 'calendar_live_evidence_missing');
      assert.equal(row.calendarStructureObserved, true);
      assert.equal('optionIndex' in row, false);
    });
  });
}

for (const [name, mutate, reason] of [
  ['missing section', doc => get(doc, '16').removeAttribute('id'), 'section_not_unique_or_visible'],
  ['missing wrapper', doc => get(doc, CALENDAR).remove(), 'wrapper_not_unique'],
  ['wrong label', doc => { item(doc, CALENDAR).querySelector('.ant-form-item-label > label').textContent = PRIVATE; }, 'label_mismatch'],
  ['missing picker', doc => host(doc, CALENDAR).querySelector('.ant-calendar-picker').remove(), 'control_kind_mismatch'],
  ['duplicate picker', doc => host(doc, CALENDAR).append(host(doc, CALENDAR).querySelector('.ant-calendar-picker').cloneNode(true)), 'control_kind_mismatch'],
  ['missing calendar input', doc => host(doc, CALENDAR).querySelector('input').remove(), 'control_kind_mismatch'],
  ['extra calendar input', doc => host(doc, CALENDAR).querySelector('.ant-calendar-picker').append(host(doc, CALENDAR).querySelector('input').cloneNode(true)), 'control_kind_mismatch'],
  ['date input instead of text', doc => { host(doc, CALENDAR).querySelector('input').type = 'date'; }, 'control_kind_mismatch'],
  ['calendar input outside picker', doc => host(doc, CALENDAR).append(host(doc, CALENDAR).querySelector('input')), 'control_kind_mismatch'],
  ['unexpected calendar button', doc => host(doc, CALENDAR).append(doc.createElement('button')), 'control_kind_mismatch'],
  ['foreign nested picker', doc => {
    const foreign = doc.createElement('div'); foreign.id = '16_999999_0';
    host(doc, CALENDAR).append(foreign); foreign.append(host(doc, CALENDAR).querySelector('.ant-calendar-picker'));
  }, 'control_ownership_mismatch'],
  ['disabled calendar input', doc => host(doc, CALENDAR).querySelector('input').setAttribute('disabled', ''), 'control_not_available'],
  ...['ant-calendar-picker-disabled', 'ant-picker-disabled'].map(className => [`disabled calendar class ${className}`, doc => {
    host(doc, CALENDAR).querySelector('.ant-calendar-picker').classList.add(className);
  }, 'control_not_available']),
  ['hidden calendar picker', doc => { host(doc, CALENDAR).querySelector('.ant-calendar-picker').hidden = true; }, 'control_not_available']
]) test(`SYNTHETIC calendar ownership and availability reject ${name} before live-evidence skip`, () => {
  withInspection({ mutate }, result => {
    const row = result.fields.find(candidate => candidate.wrapperId === CALENDAR);
    assert.equal(row.ok, false);
    assert.equal(row.reason, reason);
    assert.notEqual(row.calendarStructureObserved, true);
  });
});

test('SYNTHETIC null-prototype requests produce sanitized indexes', () => {
  const requests = Object.create(null);
  requests[SELECT] = '一周';
  requests[CHECKBOX] = ['电子', '宏观'];
  withInspection({}, result => {
    assert.equal(result.fields.find(row => row.wrapperId === SELECT).resolution.optionIndex, 0);
    assert.deepEqual(result.fields.find(row => row.wrapperId === CHECKBOX).resolution.optionIndexes, [24, 1]);
    assert.equal('resolution' in result.fields.find(row => row.wrapperId === RADIO), false);
  }, requests);
});

for (const [name, requests, reason] of [
  ['null map', null, 'requests_type_invalid'],
  ['array map', [], 'requests_type_invalid'],
  ['numeric map', 7, 'requests_type_invalid'],
  ['string map', PRIVATE, 'requests_type_invalid'],
  ['custom prototype map', Object.create({ [RADIO]: PRIVATE }), 'requests_type_invalid'],
  ['unknown wrapper key', { [PRIVATE]: PRIVATE }, 'unknown_request_field'],
  ['non-wrapper key', { availability: PRIVATE }, 'unknown_request_field'],
  ['symbol key', { [Symbol(PRIVATE)]: PRIVATE }, 'unknown_request_field']
]) test(`SYNTHETIC ${name} request container is rejected without echo`, () => withInspection({}, result => {
  assert.equal(result.ok, false);
  assert.equal(result.reason, reason);
  assert.equal(result.fields.length, ROW_D_FIELDS.length);
  assert.ok(result.fields.every(row => row.reason === reason && row.status === 'skipped'));
}, requests));

test('SYNTHETIC accessor requests are rejected without evaluating their getter', () => {
  let reads = 0;
  const requests = Object.defineProperty({}, SELECT, { enumerable: true, get() { reads += 1; throw new Error(PRIVATE); } });
  withInspection({}, result => {
    assert.equal(result.reason, 'requests_type_invalid');
    assert.equal(reads, 0);
  }, requests);
});

test('missing document returns only a sanitized failed preflight', () => {
  const result = inspectCmsRowDOptions(null, { [SELECT]: PRIVATE });
  safety(result);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'no_document');
  assert.equal(result.fields.length, ROW_D_FIELDS.length);
});

test('SYNTHETIC invalid known option request is reflected only as a sanitized resolution failure', () => {
  withInspection({}, result => {
    const row = result.fields.find(candidate => candidate.wrapperId === SELECT);
    assert.equal(row.ok, false);
    assert.equal(row.reason, 'option_unknown');
    assert.equal(row.resolution.reason, 'option_unknown');
    assert.equal('optionIndex' in row.resolution, false);
  }, { [SELECT]: PRIVATE });
});

test('SYNTHETIC unrelated visible dropdowns cannot replace a missing owned dormant list', () => {
  withInspection({ mutate: doc => {
    list(doc, SELECT).remove();
    for (const id of ['13_43_0', '13_47_0']) {
      const unrelated = list(doc, id).parentElement;
      unrelated.style.display = 'block';
      unrelated.classList.remove('ant-select-dropdown-hidden');
    }
  } }, result => {
    const row = result.fields.find(candidate => candidate.wrapperId === SELECT);
    assert.equal(row.ok, false);
    assert.equal(row.reason, 'current_options_unavailable');
    assert.equal(row.optionsReadiness, 'target_missing');
    assert.equal(Object.hasOwn(row, 'observedOptionCount'), false);
  });
});

test('SYNTHETIC linked empty list is distinguished from an unmounted ARIA target', () => {
  withInspection({ mutate: doc => list(doc, SELECT).replaceChildren() }, result => {
    const row = result.fields.find(candidate => candidate.wrapperId === SELECT);
    assert.equal(row.ok, false);
    assert.equal(row.reason, 'current_options_unavailable');
    assert.equal(row.optionsReadiness, 'list_empty');
    assert.equal(Object.hasOwn(row, 'observedOptionCount'), false);
  });
});

test('SYNTHETIC unrelated dropdowns and foreign sections cannot alter an owned dormant list result', () => {
  withInspection({ mutate: doc => {
    for (const id of ['13_43_0', '13_47_0']) {
      const unrelated = list(doc, id).parentElement;
      unrelated.style.display = 'block';
      unrelated.classList.remove('ant-select-dropdown-hidden');
    }
    const foreign = doc.createElement('section'); foreign.className = 'form-cell'; foreign.id = 'synthetic-foreign-section';
    foreign.innerHTML = `<div class="ant-select-dropdown"><ul><li role="option">${PRIVATE}</li></ul></div>`;
    doc.body.append(foreign);
    Object.defineProperty(foreign.querySelector('li'), 'textContent', { get() { throw new Error('unowned option text must not be read'); } });
  } }, result => {
    const row = result.fields.find(candidate => candidate.wrapperId === SELECT);
    assert.equal(row.ok, true);
    assert.equal(row.reason, 'read_only_options_preflight');
    assert.equal(row.optionsReadiness, 'observed');
  });
});

for (const [name, options] of [
  ['wrong host', { url: 'https://example.invalid/resumeOperation.html' }],
  ['wrong tenant', { url: ROW_D_PAGE.replace('SU629dbc0c0dcad452299bc0f7', 'SUother') }],
  ['wrong path', { url: ROW_D_PAGE.replace('resumeOperation.html', 'other.html') }],
  ['hidden page', { mutate: doc => Object.defineProperty(doc, 'visibilityState', { get: () => 'hidden' }) }],
  ['loading page', { mutate: doc => Object.defineProperty(doc, 'readyState', { get: () => 'loading' }) }]
]) test(`SYNTHETIC ${name} fails before field inspection`, () => withInspection(options, result => {
  assert.equal(result.ok, false);
  assert.ok(result.fields.every(row => row.status === 'skipped'));
}));

for (const [name, mutate] of [
  ['missing section', doc => get(doc, '13').removeAttribute('id')],
  ['duplicate section', doc => doc.body.append(get(doc, '13').cloneNode(false))],
  ['hidden section', doc => { get(doc, '13').hidden = true; }],
  ['section class drift', doc => { get(doc, '13').className = 'synthetic-other-section'; }],
  ['missing wrapper', doc => get(doc, SELECT).remove()],
  ['duplicate wrapper', doc => doc.body.append(get(doc, SELECT).cloneNode(true))],
  ['hidden wrapper', doc => { get(doc, SELECT).hidden = true; }],
  ['hidden intermediate ancestor', doc => { item(doc, SELECT).parentElement.style.display = 'none'; }],
  ['hidden descendant item', doc => { item(doc, SELECT).hidden = true; }],
  ['zero descendant items', doc => item(doc, SELECT).remove()],
  ['ambiguous descendant items', doc => get(doc, SELECT).append(item(doc, SELECT).cloneNode(true))],
  ['foreign section wrapper', doc => get(doc, '16').append(get(doc, SELECT))],
  ['foreign nested section item', doc => {
    const nested = doc.createElement('section'); nested.className = 'form-cell'; nested.id = 'synthetic-foreign';
    get(doc, SELECT).append(nested); nested.append(item(doc, SELECT));
  }],
  ['item moved into neighboring wrapper', doc => get(doc, '13_47_0').append(item(doc, SELECT))],
  ['missing label', doc => item(doc, SELECT).querySelector('.ant-form-item-label > label').remove()],
  ['hidden label', doc => { item(doc, SELECT).querySelector('.ant-form-item-label > label').hidden = true; }],
  ['wrong label', doc => { item(doc, SELECT).querySelector('.ant-form-item-label > label').textContent = PRIVATE; }],
  ['duplicate label', doc => {
    const label = item(doc, SELECT).querySelector('.ant-form-item-label > label'); label.parentElement.append(label.cloneNode(true));
  }],
  ['same question elsewhere in section', doc => {
    const duplicate = get(doc, SELECT).cloneNode(true); duplicate.removeAttribute('id'); get(doc, '13').append(duplicate);
  }],
  ['label in nested foreign section', doc => {
    const label = item(doc, SELECT).querySelector('.ant-form-item-label > label');
    const nested = doc.createElement('section'); nested.className = 'form-cell'; label.parentElement.append(nested); nested.append(label);
  }],
  ['missing select', doc => host(doc, SELECT).querySelector('.ant-select').remove()],
  ['duplicate select', doc => host(doc, SELECT).append(host(doc, SELECT).querySelector('.ant-select').cloneNode(true))],
  ['select moved outside matched item', doc => get(doc, SELECT).append(host(doc, SELECT).querySelector('.ant-select'))],
  ['select in nested foreign section', doc => {
    const control = host(doc, SELECT).querySelector('.ant-select'); const nested = doc.createElement('section'); nested.className = 'form-cell';
    host(doc, SELECT).append(nested); nested.append(control);
  }],
  ['hidden select', doc => { host(doc, SELECT).querySelector('.ant-select').hidden = true; }],
  ['disabled select class', doc => host(doc, SELECT).querySelector('.ant-select').classList.add('ant-select-disabled')],
  ['aria-disabled select', doc => host(doc, SELECT).querySelector('.ant-select').setAttribute('aria-disabled', 'true')],
  ['disabled select input', doc => { host(doc, SELECT).querySelector('input').disabled = true; }],
  ...['submit', 'button', 'password', 'number', 'file', 'hidden'].map(type => [`select input type changed to ${type}`, doc => { host(doc, SELECT).querySelector('input').type = type; }]),
  ['button inserted into select item', doc => { const button = doc.createElement('button'); host(doc, SELECT).append(button); }],
  ['disabled fieldset ancestor', doc => {
    const fieldset = doc.createElement('fieldset'); fieldset.disabled = true; get(doc, SELECT).parentElement.append(fieldset); fieldset.append(get(doc, SELECT));
  }],
  ['combobox role drift', doc => combo(doc, SELECT).removeAttribute('role')],
  ['duplicate combobox', doc => host(doc, SELECT).querySelector('.ant-select').append(combo(doc, SELECT).cloneNode(true))],
  ['radio inserted into select', doc => { const input = doc.createElement('input'); input.type = 'radio'; host(doc, SELECT).append(input); }],
  ['upload inserted into select', doc => { const upload = doc.createElement('span'); upload.className = 'ant-upload'; host(doc, SELECT).append(upload); }]
]) test(`SYNTHETIC ${name} fails closed`, () => fieldFailure(SELECT, mutate));

for (const [name, mutate] of [
  ['missing aria-controls', doc => combo(doc, SELECT).removeAttribute('aria-controls')],
  ['empty aria-controls', doc => combo(doc, SELECT).setAttribute('aria-controls', ' ')],
  ['multiple aria-controls IDs', doc => combo(doc, SELECT).setAttribute('aria-controls', `synthetic-list-${SELECT} other-id`)],
  ['missing current target', doc => list(doc, SELECT).remove()],
  ['duplicate target id', doc => doc.body.append(list(doc, SELECT).cloneNode(true))],
  ['target outside dropdown', doc => doc.body.append(list(doc, SELECT))],
  ['target in foreign field item', doc => item(doc, '13_47_0').append(list(doc, SELECT).parentElement)],
  ['target in foreign section', doc => get(doc, '16').append(list(doc, SELECT).parentElement)],
  ['target under foreign named wrapper in same section', doc => {
    const foreign = doc.createElement('div'); foreign.id = '13_999999_0';
    get(doc, '13').append(foreign); foreign.append(list(doc, SELECT).parentElement);
  }],
  ['target inside another dropdown', doc => list(doc, SELECT).append(list(doc, '13_47_0').parentElement)],
  ['many controls sharing target', doc => combo(doc, '13_47_0').setAttribute('aria-controls', combo(doc, SELECT).getAttribute('aria-controls'))],
  ['foreign hidden owner sharing target', doc => {
    const foreign = doc.createElement('div'); foreign.hidden = true; foreign.setAttribute('role', 'combobox'); foreign.setAttribute('aria-controls', combo(doc, SELECT).getAttribute('aria-controls')); doc.body.append(foreign);
  }],
  ['current option count drift', doc => list(doc, SELECT).lastElementChild.remove()],
  ['current option label drift', doc => { list(doc, SELECT).firstElementChild.textContent = PRIVATE; }],
  ['duplicate current option', doc => { list(doc, SELECT).lastElementChild.textContent = list(doc, SELECT).firstElementChild.textContent; }],
  ['foreign nested option', doc => {
    const nested = doc.createElement('div'); nested.className = 'ant-select-dropdown'; list(doc, SELECT).append(nested); nested.append(list(doc, SELECT).firstElementChild);
  }],
  ['option under foreign named wrapper', doc => {
    const foreign = doc.createElement('div'); foreign.id = '13_999999_0';
    list(doc, SELECT).append(foreign); foreign.append(list(doc, SELECT).firstElementChild);
  }],
  ['disabled current option', doc => list(doc, SELECT).firstElementChild.classList.add('ant-select-dropdown-menu-item-disabled')],
  ['aria-disabled current option', doc => list(doc, SELECT).firstElementChild.setAttribute('aria-disabled', 'true')]
]) test(`SYNTHETIC dropdown ownership rejects ${name} without opening it`, () => fieldFailure(SELECT, mutate));

for (const [id, name, mutate] of [
  [RADIO, 'radio changed to checkbox', doc => { get(doc, RADIO).querySelector('input').type = 'checkbox'; }],
  [RADIO, 'disabled radio', doc => { get(doc, RADIO).querySelector('input').disabled = true; }],
  [RADIO, 'hidden radio', doc => { get(doc, RADIO).querySelector('input').hidden = true; }],
  [RADIO, 'radio option missing', doc => get(doc, RADIO).querySelector('.ant-radio-wrapper').remove()],
  [RADIO, 'radio option drift', doc => { get(doc, RADIO).querySelector('.ant-radio-wrapper > span:last-child').textContent = PRIVATE; }],
  [CHECKBOX, 'checkbox changed to radio', doc => { get(doc, CHECKBOX).querySelector('input').type = 'radio'; }],
  [CHECKBOX, 'disabled checkbox', doc => { get(doc, CHECKBOX).querySelector('input').disabled = true; }],
  [CHECKBOX, 'hidden checkbox label', doc => { get(doc, CHECKBOX).querySelector('.ant-checkbox-wrapper').hidden = true; }],
  [CHECKBOX, 'duplicate checkbox option', doc => {
    const labels = get(doc, CHECKBOX).querySelectorAll('.ant-checkbox-wrapper > span:last-child'); labels[1].textContent = labels[0].textContent;
  }],
  [CHECKBOX, 'checkbox in foreign nested section', doc => {
    const input = get(doc, CHECKBOX).querySelector('input'); const nested = doc.createElement('section'); nested.className = 'form-cell'; input.parentElement.append(nested); nested.append(input);
  }]
]) test(`SYNTHETIC ${name} fails closed`, () => fieldFailure(id, mutate));

test('historical location autosave-on-open risk is countered by zero click/focus/blur/event/network attempts', () => {
  // The source report records a historical location open causing info/edit POST.
  // This fixture simulates an already dormant list; auditedInspect forbids every
  // interaction and network entrypoint even when a requested dictionary matches.
  withInspection({}, result => {
    const first = result.fields.find(row => row.wrapperId === '13_100701_0');
    const second = result.fields.find(row => row.wrapperId === '13_100702_0');
    assert.equal(first.resolution.optionIndex, 0);
    assert.equal(second.resolution.optionIndex, 24);
    assert.equal(first.resolution.reason, 'dictionary_sample_matched');
    assert.equal(second.resolution.reason, 'dictionary_reused_unverified');
  }, { '13_100701_0': '北京', '13_100702_0': '吉林' });
});
