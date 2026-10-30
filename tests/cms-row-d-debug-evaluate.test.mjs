/**
 * Offline V8 debug-evaluate regression only. The tree and selector results are
 * synthetic; jsdom builds them before evaluation. This exercises V8's real
 * throwOnSideEffect boundary, not Blink's native DOM API allowlist or live CMS.
 * neverSave=true, liveSupportClaimed=false, livePassClaimed=false,
 * writeStarted=false, mutationAllowed=false, valuesExposed=false, probeOnly=true.
 * booked=58 (not D). No live PASS, fill/support claim, or D+12 follows from this test.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import inspector from 'node:inspector';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import {
  ROW_D_FIELDS, ROW_D_PAGE, buildCmsRowDOptionsProbeExpression
} from '../scripts/lib/cms-row-d-options.mjs';
import { rowDProbeEvidence } from '../scripts/live/cms-row-d-live.mjs';

const PRIVATE = 'SYNTHETIC_DEBUG_EVALUATE_PRIVATE_DO_NOT_READ';
const SELECT = '13_195_0';
const RADIO = '13_102402_0';
const CHECKBOX = '13_102501_0';
const escape = text => String(text).replace(/[&<>"']/g,
  char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function topology() {
  const control = field => {
    if (field.controlKind === 'ant-select') return `<div class="ant-select"><div class="ant-select-selection" role="combobox" aria-controls="synthetic-${field.wrapperId}"><span data-private-selected>${PRIVATE}</span><input type="text" value="${PRIVATE}"></div></div>`;
    if (field.controlKind === 'ant-calendar-picker') return `<span class="ant-calendar-picker"><input readonly value="${PRIVATE}"></span>`;
    const kind = field.controlKind === 'radio-group' ? 'radio' : 'checkbox';
    return `<div class="ant-${kind}-group">${field.options.map(label => `<label class="ant-${kind}-wrapper"><input type="${kind}" value="${PRIVATE}"><span>${escape(label)}</span></label>`).join('')}</div>`;
  };
  const sections = [...new Set(ROW_D_FIELDS.map(field => field.sectionId))].map(id =>
    `<section id="${id}" class="form-cell">${ROW_D_FIELDS.filter(field => field.sectionId === id).map(field =>
      `<div id="${field.wrapperId}"><div class="ant-form-item"><div class="ant-form-item-label"><label>${escape(field.label)}</label></div><div class="ant-form-item-control">${control(field)}</div></div></div>`).join('')}</section>`).join('');
  // The missing five location labels remain unknown; these lists retain only
  // recorded samples and therefore deliberately fail the dictionary count.
  const portals = ROW_D_FIELDS.filter(field => field.controlKind === 'ant-select').map(field =>
    `<div class="ant-select-dropdown ant-select-dropdown-hidden" style="display:none"><ul id="synthetic-${field.wrapperId}">${field.options.map(label => `<li role="option">${escape(label)}</li>`).join('')}</ul></div>`).join('');
  return new JSDOM(`<!doctype html><body><form>${sections}<button>${PRIVATE}</button></form>${portals}</body>`,
    { url: `${ROW_D_PAGE}?resumeId=${PRIVATE}&tid=${PRIVATE}`, pretendToBeVisual: true });
}

// Selector evaluation belongs to fixture preparation. During debug-evaluate,
// methods only read precomputed own data, so jsdom's lazy caches cannot obscure
// the actual expression's JS compatibility with V8's side-effect checker.
function pureDocumentSetup({ mutate, visibilityState = 'visible', readyState = 'complete', url,
  hostileCollections = false, hostileProperties = false, hostileArrayIterator = false, hostileTrim = null } = {}) {
  const dom = topology();
  const { document } = dom.window;
  mutate?.(document);
  const expression = buildCmsRowDOptionsProbeExpression();
  const selectors = new Set([...expression.matchAll(/(?:querySelectorAll|querySelector|query|closest|matches|owned)\((?:[^,()\n]+,\s*)?(['"])(.*?)\1\)/g)].map(match => match[2]));
  for (const selector of [
    '.ant-radio-group', '.ant-checkbox-group', '.ant-radio-wrapper', '.ant-checkbox-wrapper',
    '.ant-select,.ant-checkbox-group,input[type="checkbox"]',
    '.ant-select,.ant-radio-group,input[type="radio"]',
    'input[type="radio"]', 'input[type="checkbox"]'
  ]) selectors.add(selector);
  const originals = [document, ...document.querySelectorAll('*')];
  const indexes = new Map(originals.map((node, index) => [node, index]));
  const rows = originals.map(node => ({
    id: node.id || '', type: node.type || '', tagName: node.tagName || '',
    isConnected: true, disabled: Boolean(node.disabled),
    parent: indexes.get(node.parentElement) ?? null,
    text: node.textContent || '',
    // Values/selection are intentionally absent from the projected attributes.
    attributes: Object.fromEntries([...(node.attributes || [])]
      .filter(attribute => !/^(?:value|checked|selected|aria-checked|aria-selected)$/i.test(attribute.name))
      .map(attribute => [attribute.name, attribute.value])),
    selectors: Object.fromEntries([...selectors].map(selector => [selector, {
      all: [...node.querySelectorAll(selector)].map(found => indexes.get(found)),
      closest: node.closest ? indexes.get(node.closest(selector)) ?? null : null,
      matches: node.matches ? node.matches(selector) : false
    }]))
  }));
  const location = new URL(url ?? `${ROW_D_PAGE}?resumeId=${PRIVATE}&tid=${PRIVATE}`);
  dom.window.close();
  return `(() => {
    const rows = ${JSON.stringify(rows)};
    const hostEffects = { iteratorReads: 0, propertyReads: 0 };
    const nodes = rows.map(row => ({ id: row.id, type: row.type,
      tagName: row.tagName, isConnected: row.isConnected, disabled: row.disabled,
      textContent: row.text, _attributes: row.attributes, _selectors: row.selectors,
      querySelectorAll(selector) {
        const entry = this._selectors[selector];
        if (!entry) throw new Error('synthetic_unknown_selector');
        return entry.collection || entry.all.map(index => nodes[index]);
      },
      querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; },
      closest(selector) {
        const entry = this._selectors[selector];
        if (!entry) throw new Error('synthetic_unknown_selector');
        return entry.closest === null ? null : nodes[entry.closest];
      },
      matches(selector) {
        const entry = this._selectors[selector];
        if (!entry) throw new Error('synthetic_unknown_selector');
        return entry.matches;
      },
      getAttribute(name) {
        if (/^(?:value|checked|selected|aria-checked|aria-selected)$/i.test(name))
          throw new Error('synthetic_current_value_read');
        return this._attributes[name] ?? null;
      },
      hasAttribute(name) { return Object.hasOwn(this._attributes, name); },
      contains(node) {
        for (let current = node; current; current = current.parentElement)
          if (current === this) return true;
        return false;
      }
    }));
    for (let index = 0; index < nodes.length; index += 1) {
      nodes[index].parentElement = rows[index].parent === null ? null : nodes[rows[index].parent];
      for (const property of ['value', 'checked', 'selected', 'selectedIndex', 'selectedOptions'])
        Object.defineProperty(nodes[index], property, {
          get() { throw new Error('synthetic_current_value_read'); },
          set() { throw new Error('synthetic_current_value_write'); }
        });
      for (const method of ['click', 'focus', 'blur', 'dispatchEvent', 'setAttribute',
        'removeAttribute', 'appendChild', 'submit', 'requestSubmit'])
        nodes[index][method] = () => { throw new Error('synthetic_interaction_forbidden'); };
      if (rows[index].text.includes(${JSON.stringify(PRIVATE)}))
        Object.defineProperty(nodes[index], 'textContent', {
          get() { throw new Error('synthetic_current_value_read'); }
        });
    }
    if (${JSON.stringify(hostileCollections)}) {
      // App-installed iterator accessors can write pre-existing closure state.
      // Match a native NodeList's indexed/length surface without making its
      // iterator safe merely because a fixture returned a plain array.
      for (const node of nodes) for (const entry of Object.values(node._selectors)) {
        const collection = { length: entry.all.length };
        for (let index = 0; index < entry.all.length; index += 1)
          collection[index] = nodes[entry.all[index]];
        Object.defineProperty(collection, Symbol.iterator, {
          get() { hostEffects.iteratorReads += 1; return Array.prototype.values; }
        });
        entry.collection = collection;
      }
    }
    if (${JSON.stringify(hostileProperties)}) {
      for (const node of nodes) for (const property of ['id', 'type', 'disabled']) {
        const original = node[property];
        Object.defineProperty(node, property, {
          get() { hostEffects.propertyReads += 1; return original; }
        });
      }
    }
    const document = nodes[0];
    document.visibilityState = ${JSON.stringify(visibilityState)};
    document.readyState = ${JSON.stringify(readyState)};
    document.defaultView = {
      location: ${JSON.stringify({ href: location.href, origin: location.origin, pathname: location.pathname })},
      getComputedStyle() { throw new Error('synthetic_layout_read_forbidden'); }
    };
    globalThis.document = document;
    if (${JSON.stringify(hostileTrim)}) {
      // A library-style trim shim closes over RegExps made before evaluation.
      // Native replace can touch that shared RegExp state even without an
      // explicit write or a DOM read in the shim itself.
      const flags = ${JSON.stringify(hostileTrim)} === 'global' ? 'g' : '';
      const whitespace = String.fromCharCode(92) + 's+';
      const leading = new RegExp('^' + whitespace, flags);
      const trailing = new RegExp(whitespace + '$', flags);
      Object.defineProperty(String.prototype, 'trim', {
        configurable: true, writable: true,
        value() { return String(this).replace(leading, '').replace(trailing, ''); }
      });
    }
    if (${JSON.stringify(hostileArrayIterator)}) {
      Object.defineProperty(Array.prototype, Symbol.iterator, {
        configurable: true,
        get() { hostEffects.iteratorReads += 1; return Array.prototype.values; }
      });
    }
  })()`;
}

async function debugEvaluate(expression, setup) {
  const session = new inspector.Session();
  session.connect();
  const post = (method, params = {}) => new Promise((resolve, reject) =>
    session.post(method, params, (error, response) => error ? reject(error) : resolve(response)));
  let contextId;
  const name = `cms-row-d-debug-evaluate-${Math.random()}`;
  session.on('Runtime.executionContextCreated', ({ params }) => {
    if (params.context.name === name) contextId = params.context.id;
  });
  try {
    await post('Runtime.enable');
    const context = vm.createContext({ URL }, { name });
    vm.runInContext(setup ?? pureDocumentSetup(), context);
    assert.ok(contextId, 'the named synthetic execution context is discovered');
    return await post('Runtime.evaluate', {
      contextId, expression, returnByValue: true, awaitPromise: false,
      userGesture: false, throwOnSideEffect: true
    });
  } finally { session.disconnect(); }
}

function valueFrom(response) {
  assert.equal(response.exceptionDetails, undefined,
    response.exceptionDetails?.exception?.description || 'debug-evaluate completed without an exception');
  assert.ok(response.result && Object.hasOwn(response.result, 'value'));
  return response.result.value;
}

function safety(result) {
  const flags = { neverSave: true, liveSupportClaimed: false, livePassClaimed: false,
    writeStarted: false, mutationAllowed: false, valuesExposed: false, probeOnly: true };
  for (const row of [result, ...(result.fields || []),
    ...(result.fields || []).flatMap(field => field.resolution ? [field.resolution] : [])])
    for (const [key, expected] of Object.entries(flags)) assert.equal(row[key], expected, key);
  const evidence = { ...rowDProbeEvidence(result.reason), fields: result.fields };
  assert.equal(evidence.livePassClaimed, false);
  assert.equal(evidence.probeOnly, true);
  assert.equal(evidence.booked, 58);
  assert.equal(evidence.probeCompleted, false, 'offline inspector results do not claim live completion');
  assert.equal(result.visibilityBasis, 'attributes_only');
  const output = JSON.stringify(evidence);
  assert.equal(output.includes(PRIVATE), false);
  assert.doesNotMatch(output, /resumeId=|tid=|synthetic_current_value|synthetic_interaction|synthetic_layout/);
}

test('real V8 debug-evaluate rejects writes to the existing synthetic document', async () => {
  const response = await debugEvaluate('globalThis.document.readyState = "loading"');
  assert.equal(response.exceptionDetails?.exception?.className, 'EvalError');
  assert.match(response.exceptionDetails.exception.description, /Possible side-effect in debug-evaluate/);
});

test('serialized row D no-document result completes under real V8 debug-evaluate', async () => {
  const result = valueFrom(await debugEvaluate(buildCmsRowDOptionsProbeExpression(), '0'));
  safety(result);
  assert.equal(result.reason, 'no_document');
  assert.equal(result.fields.length, ROW_D_FIELDS.length);
});

test('serialized row D probe reaches select, radio, checkbox and calendar branches under real V8 debug-evaluate', async () => {
  const requests = {
    [SELECT]: ROW_D_FIELDS.find(field => field.wrapperId === SELECT).options[0],
    [RADIO]: ROW_D_FIELDS.find(field => field.wrapperId === RADIO).options[0],
    [CHECKBOX]: [ROW_D_FIELDS.find(field => field.wrapperId === CHECKBOX).options[0],
      ROW_D_FIELDS.find(field => field.wrapperId === CHECKBOX).options[31]]
  };
  const result = valueFrom(await debugEvaluate(buildCmsRowDOptionsProbeExpression(requests)));
  safety(result);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'row_d_preflight_incomplete');
  assert.equal(result.fields.length, ROW_D_FIELDS.length);
  const field = id => result.fields.find(row => row.wrapperId === id);
  assert.equal(field(SELECT).reason, 'read_only_options_preflight');
  assert.equal(field(RADIO).reason, 'read_only_options_preflight');
  assert.equal(field(CHECKBOX).reason, 'read_only_options_preflight');
  assert.equal(field('16_65_0').reason, 'calendar_live_evidence_missing');
  assert.equal(field('13_100701_0').reason, 'option_dictionary_mismatch');
  assert.equal(field('13_100702_0').reason, 'option_dictionary_mismatch');
  assert.equal(field(SELECT).resolution.optionIndex, 0);
  assert.deepEqual(field(CHECKBOX).resolution.optionIndexes, [0, 31]);
});

for (const [name, options, reason] of [
  ['wrong URL', { url: `https://example.invalid/${PRIVATE}` }, 'wrong_page'],
  ['hidden page', { visibilityState: 'hidden' }, 'page_hidden'],
  ['loading page', { readyState: 'loading' }, 'page_not_ready']
]) test(`serialized row D probe rejects ${name} without a V8 side-effect exception`, async () => {
  const result = valueFrom(await debugEvaluate(buildCmsRowDOptionsProbeExpression(), pureDocumentSetup(options)));
  safety(result);
  assert.equal(result.reason, reason);
  assert.equal(result.fields.length, ROW_D_FIELDS.length);
});

test('disabled and hidden synthetic controls fail closed after a complete debug-evaluate', async () => {
  const setup = pureDocumentSetup({ mutate(document) {
    document.getElementById(SELECT).querySelector('input').disabled = true;
    document.getElementById(RADIO).hidden = true;
  } });
  const result = valueFrom(await debugEvaluate(buildCmsRowDOptionsProbeExpression(), setup));
  safety(result);
  assert.equal(result.reason, 'row_d_preflight_incomplete');
  assert.equal(result.fields.find(field => field.wrapperId === SELECT).reason, 'control_not_available');
  assert.equal(result.fields.find(field => field.wrapperId === RADIO).reason, 'wrapper_scope_or_visibility_mismatch');
});

test('SYNTHETIC hidden Ant search helpers complete under the real V8 guard without upgrading evidence gaps', async () => {
  const setup = pureDocumentSetup({ hostileCollections: true, hostileProperties: true, hostileTrim: 'global', mutate(document) {
    // This models a possible cause of VIS control_not_available. The supplied
    // harvest did not capture this descendant shape; it is not live CMS HTML.
    for (const input of document.querySelectorAll('.ant-select input')) {
      const search = document.createElement('span');
      search.className = 'ant-select-search';
      search.style.display = 'none';
      input.className = 'ant-select-search__field';
      input.parentElement.append(search);
      search.append(input);
    }
  } });
  const result = valueFrom(await debugEvaluate(buildCmsRowDOptionsProbeExpression(), setup));
  safety(result);
  const field = id => result.fields.find(row => row.wrapperId === id);
  assert.equal(result.reason, 'row_d_preflight_incomplete');
  assert.equal(result.fields.filter(row => row.ok).length, 13);
  assert.equal(field(SELECT).hiddenSearchInputCount, 1);
  assert.equal(field(SELECT).observedOptionCount, 8);
  assert.equal(field(CHECKBOX).observedOptionCount, 32);
  assert.equal(Object.hasOwn(field(CHECKBOX), 'samplePrefixMatched'), false);
  assert.equal(field(CHECKBOX).optionsComplete, true);
  assert.equal(field('16_65_0').calendarStructureObserved, true);
  assert.equal(field('16_65_0').ok, false);
});

test('SYNTHETIC location kind and collapsed/disabled helper diagnostics remain guarded skips', async () => {
  const setup = pureDocumentSetup({ mutate(document) {
    const first = document.getElementById('13_100701_0').querySelector('.ant-select');
    const picker = document.createElement('span');
    picker.className = 'ant-calendar-picker';
    first.append(picker);
    document.getElementById('13_100702_0').querySelector('input').type = 'hidden';
    const wrapper = document.getElementById(SELECT);
    const collapsed = document.createElement('div');
    collapsed.className = 'ant-collapse-content-inactive';
    wrapper.parentElement.append(collapsed);
    collapsed.append(wrapper);
    document.getElementById('16_64_0').querySelector('input').disabled = true;
    document.getElementById('16_65_0').querySelector('.ant-calendar-picker').classList.add('ant-calendar-picker-disabled');
  } });
  const result = valueFrom(await debugEvaluate(buildCmsRowDOptionsProbeExpression(), setup));
  safety(result);
  const field = id => result.fields.find(row => row.wrapperId === id);
  assert.equal(result.reason, 'row_d_preflight_incomplete');
  assert.equal(field('13_100701_0').controlKindIssue, 'conflicting_picker');
  assert.equal(field('13_100702_0').controlKindIssue, 'unexpected_input_kind');
  assert.equal(field(SELECT).availabilityIssue, 'collapsed_ancestor');
  assert.equal(field('16_64_0').availabilityIssue, 'disabled_attribute_or_class');
  assert.equal(field('16_65_0').availabilityIssue, 'disabled_attribute_or_class');
  assert.equal(field('16_65_0').calendarStructureObserved, undefined);
  for (const id of ['13_100701_0', '13_100702_0', SELECT, '16_64_0']) assert.equal(field(id).ok, false);
});

for (const [name, fixture, reference] of [
  ['page-owned NodeList iterator', { hostileCollections: true },
    '[...document.querySelectorAll("[id]")].length'],
  ['page-owned DOM property accessors', { hostileProperties: true },
    'document.querySelectorAll("[id]")[0].id'],
  ['page-owned Array iterator', { hostileArrayIterator: true },
    '[...[1, 2]].length']
]) test(`serialized row D avoids ${name} under real V8 debug-evaluate`, async () => {
  const setup = pureDocumentSetup(fixture);
  const rejected = await debugEvaluate(reference, setup);
  assert.equal(rejected.exceptionDetails?.exception?.className, 'EvalError',
    'the reference read must actually reach an app-owned side effect');
  assert.match(rejected.exceptionDetails.exception.description, /Possible side-effect in debug-evaluate/);
  const result = valueFrom(await debugEvaluate(buildCmsRowDOptionsProbeExpression(), setup));
  safety(result);
  assert.equal(result.reason, 'row_d_preflight_incomplete');
  assert.equal(result.fields.length, ROW_D_FIELDS.length);
  assert.equal(result.fields.find(field => field.wrapperId === SELECT).reason, 'read_only_options_preflight');
  assert.equal(result.fields.find(field => field.wrapperId === RADIO).reason, 'read_only_options_preflight');
});

for (const [name, type] of [
  ['missing', null], ['empty', ''], ['invalid', 'synthetic-invalid-input-type'], ['uppercase', 'SEARCH']
]) test(`serialized row D preserves native ${name} input-type behavior from attributes`, async () => {
  const setup = pureDocumentSetup({ mutate(document) {
    const input = document.getElementById(SELECT).querySelector('input');
    if (type === null) input.removeAttribute('type');
    else input.setAttribute('type', type);
  } });
  const result = valueFrom(await debugEvaluate(buildCmsRowDOptionsProbeExpression(), setup));
  safety(result);
  assert.equal(result.reason, 'row_d_preflight_incomplete');
  assert.equal(result.fields.find(field => field.wrapperId === SELECT).reason, 'read_only_options_preflight');
});

for (const flags of ['global', 'non-global']) {
  test(`serialized row D avoids a shared ${flags} RegExp trim shim under real V8 debug-evaluate`, async () => {
    const setup = pureDocumentSetup({ hostileTrim: flags });
    const rejected = await debugEvaluate("' cms '.trim() === 'cms'", setup);
    assert.equal(rejected.exceptionDetails?.exception?.className, 'EvalError',
      'a page trim shim with shared RegExps must reproduce the side-effect boundary');
    assert.match(rejected.exceptionDetails.exception.description, /Possible side-effect in debug-evaluate/);
    const requests = {
      [SELECT]: ROW_D_FIELDS.find(field => field.wrapperId === SELECT).options[0],
      [RADIO]: ROW_D_FIELDS.find(field => field.wrapperId === RADIO).options[0],
      [CHECKBOX]: [ROW_D_FIELDS.find(field => field.wrapperId === CHECKBOX).options[0]]
    };
    for (const requested of [false, true]) {
      const expression = buildCmsRowDOptionsProbeExpression(requested ? requests : {});
      const result = valueFrom(await debugEvaluate(expression, setup));
      safety(result);
      assert.equal(result.reason, 'row_d_preflight_incomplete');
      assert.equal(result.fields.length, ROW_D_FIELDS.length);
      const field = id => result.fields.find(row => row.wrapperId === id);
      assert.equal(field(SELECT).reason, 'read_only_options_preflight');
      assert.equal(field(RADIO).reason, 'read_only_options_preflight');
      assert.equal(field(CHECKBOX).reason, 'read_only_options_preflight');
      if (requested) {
        assert.equal(field(SELECT).resolution.optionIndex, 0, 'single-value resolver completed');
        assert.equal(field(RADIO).resolution.optionIndex, 0, 'radio resolver completed');
        assert.deepEqual(field(CHECKBOX).resolution.optionIndexes, [0], 'array resolver completed');
      } else {
        for (const row of result.fields) assert.equal(row.resolution, undefined);
      }
    }
  });
}
