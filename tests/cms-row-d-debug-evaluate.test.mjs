/**
 * Offline V8 debug-evaluate regression only. The tree and selector results are
 * synthetic; jsdom builds them before evaluation. This exercises V8's real
 * throwOnSideEffect boundary, not Blink's native DOM API allowlist or live CMS.
 * neverSave=true, liveSupportClaimed=false, livePassClaimed=false,
 * writeStarted=false, mutationAllowed=false, valuesExposed=false, probeOnly=true.
 * booked=53. No live PASS, fill/support claim, or D+12 follows from this test.
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
function pureDocumentSetup({ mutate, visibilityState = 'visible', readyState = 'complete', url } = {}) {
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
    const nodes = rows.map(row => ({ id: row.id, type: row.type,
      tagName: row.tagName, isConnected: row.isConnected, disabled: row.disabled,
      textContent: row.text, _attributes: row.attributes, _selectors: row.selectors,
      querySelectorAll(selector) {
        const entry = this._selectors[selector];
        if (!entry) throw new Error('synthetic_unknown_selector');
        return entry.all.map(index => nodes[index]);
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
    const document = nodes[0];
    document.visibilityState = ${JSON.stringify(visibilityState)};
    document.readyState = ${JSON.stringify(readyState)};
    document.defaultView = {
      location: ${JSON.stringify({ href: location.href, origin: location.origin, pathname: location.pathname })},
      getComputedStyle() { throw new Error('synthetic_layout_read_forbidden'); }
    };
    globalThis.document = document;
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
  assert.equal(evidence.booked, 53);
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
    [CHECKBOX]: [ROW_D_FIELDS.find(field => field.wrapperId === CHECKBOX).options[0]]
  };
  const result = valueFrom(await debugEvaluate(buildCmsRowDOptionsProbeExpression(requests)));
  safety(result);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'row_d_preflight_incomplete');
  assert.equal(result.fields.length, ROW_D_FIELDS.length);
  const field = id => result.fields.find(row => row.wrapperId === id);
  assert.equal(field(SELECT).reason, 'read_only_options_preflight');
  assert.equal(field(RADIO).reason, 'read_only_options_preflight');
  assert.equal(field(CHECKBOX).reason, 'option_dictionary_incomplete');
  assert.equal(field('16_65_0').reason, 'calendar_live_evidence_missing');
  assert.equal(field('13_100701_0').reason, 'option_dictionary_mismatch');
  assert.equal(field('13_100702_0').reason, 'option_dictionary_mismatch');
  assert.equal(field(SELECT).resolution.optionIndex, 0);
  assert.deepEqual(field(CHECKBOX).resolution.optionIndexes, [0]);
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
