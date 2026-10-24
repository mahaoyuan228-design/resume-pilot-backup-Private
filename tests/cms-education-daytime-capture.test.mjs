/**
 * Offline observations over the repository's fictional React/data scaffold.
 * JSDOM functions use explicit fictional native-source witnesses below; these
 * tests do not authenticate browser natives, contact CDP, or run a live trial.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { integrationFixture } from './fixtures/cms-education-fixture.mjs';
import { buildDaytimeCaptureExpression } from '../scripts/lib/cms-education-daytime-capture.mjs';
import { HOOK_NAMES } from '../scripts/validate-cms-education-controls-evidence.mjs';

const PAGE = 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';
const fixture = await integrationFixture({ schools: ['悉尼大学', '虚构邻校'],
  regions: [{ province: '北京市', city: '北京市' }, { province: '虚构省', city: '虚构市' }] });
const plain = value => JSON.parse(JSON.stringify(value));
const expression = buildDaytimeCaptureExpression();

function setup(t, { twoRows = false } = {}) {
  // Mount the second fictional row during scaffold construction, with no Add
  // control click or new site action in the observation procedure.
  const source = twoRows ? fixture.replace("addRow();document.getElementById('save')", "addRow();addRow();document.getElementById('save')") : fixture;
  const dom = new JSDOM(source, { url: PAGE, runScripts: 'dangerously', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const { window } = dom, { document } = window;
  Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  window.Element.prototype.getClientRects = function () {
    if (!this.isConnected) return [];
    for (let node = this; node instanceof window.Element; node = node.parentElement) {
      if (node.style.display === 'none' || node.style.visibility === 'hidden') return [];
    }
    return [{}];
  };
  window.fetch = function fetch() {};
  Object.defineProperty(window.navigator, 'sendBeacon', { configurable: true, enumerable: true,
    writable: true, value: function sendBeacon() {} });
  const originalToString = window.Function.prototype.toString;
  const fictionalSources = new WeakMap();
  const witness = (fn, explicit) => {
    fictionalSources.set(fn, explicit || `function ${fn.name || 'anonymous'}() { [native code] }`);
    return fn;
  };
  for (const fn of [window.fetch, window.HTMLElement.prototype.click,
    window.HTMLFormElement.prototype.submit, window.HTMLFormElement.prototype.requestSubmit,
    ...['open', 'send', 'abort'].map(key => window.XMLHttpRequest.prototype[key]),
    ...['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'].map(key => window[key]),
    window.navigator.sendBeacon, ...['addEventListener', 'removeEventListener', 'dispatchEvent'].map(key => window.EventTarget.prototype[key]),
    window.Event.prototype.stopImmediatePropagation, window.Event.prototype.preventDefault, window.MouseEvent]) witness(fn);
  window.Function.prototype.toString = function () {
    return fictionalSources.get(this) || originalToString.call(this);
  };
  let probes = 0;
  window.addEventListener('click', event => { if (event.target === document.body) probes++; }, true);
  return { window, document, witness, capture: () => window.eval(expression), probes: () => probes };
}

test('capture stays in its remote closure and observes lossless matching snapshots without site body actions', t => {
  const h = setup(t);
  let siteActions = 0;
  h.document.body.addEventListener('click', () => siteActions++);
  h.document.addEventListener('click', () => siteActions++);
  const ownKeys = Object.getOwnPropertyNames(h.window).sort();
  const recorder = h.capture(), after = recorder.finish();
  assert.deepEqual(Object.getOwnPropertyNames(h.window).sort(), ownKeys, 'no recorder global is injected');
  assert.deepEqual(Object.keys(recorder).sort(), ['before', 'finish']);
  assert.deepEqual(plain(after.snapshots), plain(recorder.before.snapshots));
  assert.deepEqual(plain(after.rawDom), plain(recorder.before.rawDom));
  assert.equal(after.rawDom.educationOuterHTML, h.document.getElementById('14').outerHTML);
  assert.ok(after.rawDom.neighborOuterHTML.some(html => html.includes('id="unrelated"')));
  assert.deepEqual(plain(after.identity), { hooksRestored: true, globalsRestored: true, contextUnchanged: true });
  for (const observed of [recorder.before, after]) {
    assert.deepEqual(Object.keys(observed.snapshots).sort(), ['dom', 'dto', 'neighbors', 'publicProps']);
    assert.equal(observed.boundary.hasCmsLive, false);
    assert.equal(observed.boundary.overlays, 0);
    assert.equal(observed.boundary.bodyClickReached, true);
    assert.deepEqual(Object.keys(observed.boundary.hooks), HOOK_NAMES);
    assert.ok(Object.values(observed.boundary.hooks).every(hook => typeof hook.ownerDepth === 'number'
      && typeof hook.source === 'string' && typeof hook.configurable === 'boolean'
      && typeof hook.enumerable === 'boolean' && typeof hook.writable === 'boolean'));
  }
  assert.equal(h.probes(), 2, 'one safely stopped delivery probe at each boundary');
  assert.equal(siteActions, 0, 'neither body handlers nor document bubbling handlers are called');
  assert.deepEqual(plain(h.window.fixtureCounts), { adds: 0, saves: 0, submits: 0, textEvents: 0, selects: 0 });
});

test('public props distinguish absent, undefined, null, empty, whitespace, holes, and negative zero', t => {
  const h = setup(t), recorder = h.capture();
  const snapshots = [JSON.stringify(recorder.before.snapshots.publicProps)];
  for (const expression of ['undefined', 'null', "''", "'  \\n  '", '[,]', '[undefined]', '-0', '0']) {
    h.window.eval(`fixtureProps.formData.unconsumedRawEvidence = ${expression}`);
    snapshots.push(JSON.stringify(recorder.finish().snapshots.publicProps));
  }
  assert.equal(new Set(snapshots).size, snapshots.length, 'no raw distinction is normalized or omitted');
  h.window.eval('delete fixtureProps.formData.unconsumedRawEvidence');
  assert.equal(JSON.stringify(recorder.finish().snapshots.publicProps), snapshots[0]);
  const optionalBefore = JSON.stringify(recorder.finish().snapshots.publicProps);
  h.window.eval('fixtureProps.dataSourceRelevant = undefined');
  assert.notEqual(JSON.stringify(recorder.finish().snapshots.publicProps), optionalBefore,
    'the absence of one of the seven consumed properties is retained');
});

test('all education rows and exact neighboring control values are retained independently', t => {
  const h = setup(t, { twoRows: true }), recorder = h.capture();
  assert.equal(h.window.fixtureProps.infoData.length, 2);
  const before = plain(recorder.before.snapshots);
  h.document.getElementById('unrelated').value = '  changed neighbor\n';
  let after = plain(recorder.finish().snapshots);
  assert.deepEqual(after.dom, before.dom);
  assert.deepEqual(after.publicProps, before.publicProps);
  assert.notDeepEqual(after.neighbors, before.neighbors);
  h.document.getElementById('unrelated').value = 'fictional outside preserved';
  h.document.querySelector('[id="14_53_0"] input').value = '  raw field whitespace  ';
  after = plain(recorder.finish().snapshots);
  assert.notDeepEqual(after.dom, before.dom);
  assert.deepEqual(after.neighbors, before.neighbors);
  assert.deepEqual(after.publicProps, before.publicProps, 'DOM and props are separate observations');
  h.document.querySelector('[id="14_53_0"] input').value = '';
  h.document.querySelector('[id="14_53_1"] input').value = '  untouched neighboring education row  ';
  after = plain(recorder.finish().snapshots);
  assert.notDeepEqual(after.dom, before.dom, 'the other existing education row is included too');
  assert.deepEqual(after.neighbors, before.neighbors);
  assert.equal(h.window.fixtureCounts.adds, 0);
});

test('same-source native-form hooks and same-data globals still require original object identity', t => {
  const h = setup(t);
  const previous = { retained: true };
  Object.defineProperty(h.window, 'ResumeCmsEducationMulti', { configurable: true, enumerable: false,
    writable: false, value: previous });
  const recorder = h.capture();
  const oldFetchSource = recorder.before.boundary.hooks.fetch.source;
  h.window.fetch = h.witness(function fetch() {}, oldFetchSource);
  Object.defineProperty(h.window, 'ResumeCmsEducationMulti', { configurable: true, enumerable: false,
    writable: false, value: { retained: true } });
  const after = recorder.finish();
  assert.deepEqual(plain(after.boundary.hooks.fetch), plain(recorder.before.boundary.hooks.fetch));
  assert.equal(after.boundary.bodyClickReached, true);
  assert.deepEqual(plain(after.identity), { hooksRestored: false, globalsRestored: false, contextUnchanged: true });
});

test('raw markup supplement retains class, style, and ARIA distinctions outside semantic hashes', t => {
  const h = setup(t), recorder = h.capture();
  const node = h.document.querySelector('[id="14_53_0"] input');
  node.className = 'fictional-after-focus'; node.style.width = '123px'; node.setAttribute('aria-expanded', 'false');
  const neighbor = h.document.getElementById('unrelated'); neighbor.className = 'neighbor-after-focus';
  const after = recorder.finish();
  assert.deepEqual(plain(after.snapshots), plain(recorder.before.snapshots));
  assert.notEqual(after.rawDom.educationOuterHTML, recorder.before.rawDom.educationOuterHTML);
  assert.notDeepEqual(plain(after.rawDom.neighborOuterHTML), plain(recorder.before.rawDom.neighborOuterHTML));
  assert.ok(after.rawDom.educationOuterHTML.includes('aria-expanded="false"'));
  assert.ok(after.rawDom.educationOuterHTML.includes('width: 123px'));
});

test('global accessor descriptors are compared by identity without invoking getters', t => {
  const h = setup(t);
  let reads = 0;
  const getter = () => { reads++; throw new Error('private getter must not run'); };
  Object.defineProperty(h.window, 'ResumeCmsSession', { configurable: true, enumerable: false, get: getter });
  const recorder = h.capture();
  assert.equal(recorder.finish().identity.globalsRestored, true);
  Object.defineProperty(h.window, 'ResumeCmsSession', { configurable: true, enumerable: false,
    get: () => { reads++; throw new Error('replacement getter must not run'); } });
  assert.equal(recorder.finish().identity.globalsRestored, false);
  assert.equal(reads, 0);
});

test('initial dirty pages and unreadable hook accessors stop before any body probe', async t => {
  for (const [label, mutate, reason] of [
    ['prior API', h => { h.window.__cmsEducationLive = {}; }, 'daytime_capture_page_not_clean'],
    ['patched hook', h => { h.window.fetch = function patched() {}; }, 'daytime_capture_page_not_clean'],
    ['visible overlay', h => { const overlay = h.document.createElement('div'); overlay.className = 'ant-select-dropdown';
      h.document.body.append(overlay); }, 'daytime_capture_page_not_clean'],
    ['hook getter', h => { Object.defineProperty(h.window, 'fetch', { configurable: true,
      get() { throw new Error('private getter'); } }); }, 'daytime_capture_accessor_unreadable']
  ]) await t.test(label, tt => {
    const h = setup(tt); mutate(h);
    assert.throws(h.capture, error => error.message === reason);
    assert.equal(h.probes(), 0);
  });
});

test('dirty cleanup is observed without attempting a body click or claiming restored identity', t => {
  const h = setup(t), recorder = h.capture();
  h.window.__cmsEducationLive = { retainedGuard: true };
  h.window.fetch = function retainedGuard() {};
  const after = recorder.finish();
  assert.equal(after.boundary.hasCmsLive, true);
  assert.equal(after.boundary.bodyClickReached, false);
  assert.equal(after.identity.hooksRestored, false);
  assert.equal(after.identity.globalsRestored, false);
  assert.equal(h.probes(), 1);
  assert.deepEqual(plain(after.snapshots), plain(recorder.before.snapshots));
});

test('raw props with accessors, cycles, or unsupported values fail closed without evaluating getters', async t => {
  for (const value of ['getter', 'cycle', 'symbol', 'function']) await t.test(value, tt => {
    const h = setup(tt);
    let reads = 0;
    if (value === 'getter') Object.defineProperty(h.window.fixtureProps.formData, 'privateRaw', {
      enumerable: true, get() { reads++; throw new Error('private getter'); } });
    else if (value === 'cycle') h.window.eval('fixtureProps.formData.privateRaw = fixtureProps.formData');
    else if (value === 'symbol') h.window.eval('fixtureProps.formData.privateRaw = Symbol("private")');
    else h.window.eval('fixtureProps.formData.privateRaw = function privateHandler() {}');
    assert.throws(h.capture, error => /^daytime_capture_(?:accessor_unreadable|non_data_value)$/u.test(error.message));
    assert.equal(h.probes(), 0); assert.equal(reads, 0);
  });
});

test('standard data-prototype accessors fail closed before inherited metadata getters or body probes execute', async t => {
  for (const phase of ['initial', 'finish']) for (const [kind, prototypeName, key] of [
    ['object metadata', 'Object', 'dataSourceMap'],
    ['array metadata', 'Array', 'dataSourceMap'],
    ['object symbol', 'Object', Symbol('fictional accessor')],
    ['array iterator', 'Array', Symbol.iterator],
    ['array method', 'Array', 'every'],
    ['module initializer method', 'Array', 'map'],
    ['object JSON accessor', 'Object', 'toJSON'],
    ['array JSON accessor', 'Array', 'toJSON'],
    ['replaced legacy accessor', 'Object', '__proto__']
  ]) await t.test(`${phase} ${kind}`, tt => {
    const h = setup(tt), recorder = phase === 'finish' ? h.capture() : null;
    const prototype = h.window[prototypeName].prototype;
    const previous = Object.getOwnPropertyDescriptor(prototype, key);
    let reads = 0;
    const getter = () => { reads++; return undefined; };
    Object.defineProperty(prototype, key, { configurable: true, enumerable: false,
      get: getter });
    try {
      assert.throws(() => recorder ? recorder.finish() : h.capture(),
        error => error.message === 'daytime_capture_accessor_unreadable');
      assert.equal(reads, 0, 'descriptor inspection must not evaluate the inherited getter');
      assert.equal(h.probes(), phase === 'finish' ? 1 : 0, 'rejection precedes a new body probe');
      for (const key of ['adds', 'saves', 'submits', 'textEvents', 'selects']) assert.equal(h.window.fixtureCounts[key], 0);
      assert.equal(Object.getOwnPropertyDescriptor(prototype, key).get, getter,
        'capture must leave the rejected accessor installed');
    } finally {
      if (previous) Object.defineProperty(prototype, key, previous);
      else Reflect.deleteProperty(prototype, key);
    }
  });
});

test('extended standard data-prototype chains fail closed without traversing inherited metadata getters', async t => {
  for (const phase of ['initial', 'finish']) {
    await t.test(phase, tt => {
      const h = setup(tt), recorder = phase === 'finish' ? h.capture() : null;
      const prototype = h.window.Array.prototype, previous = Object.getPrototypeOf(prototype);
      const extension = h.window.Object.create(previous);
      let reads = 0;
      Object.defineProperty(extension, 'dataSourceMap', { get() { reads++; return undefined; } });
      Object.setPrototypeOf(prototype, extension);
      try {
        assert.throws(() => recorder ? recorder.finish() : h.capture(),
          error => error.message === 'daytime_capture_non_data_value');
        assert.equal(reads, 0);
        assert.equal(h.probes(), phase === 'finish' ? 1 : 0);
      } finally {
        Object.setPrototypeOf(prototype, previous);
      }
    });
  }
});

test('a body-probe listener cannot introduce an inherited getter before the second snapshot', async t => {
  for (const [kind, prototypeName, key] of [
    ['metadata', 'Object', 'dataSourceMap'], ['iterator', 'Array', Symbol.iterator],
    ['method', 'Array', 'every'], ['module initializer method', 'Array', 'map'],
    ['object JSON accessor', 'Object', 'toJSON'], ['array JSON accessor', 'Array', 'toJSON']
  ]) await t.test(kind, tt => {
    const h = setup(tt), prototype = h.window[prototypeName].prototype;
    const previous = Object.getOwnPropertyDescriptor(prototype, key);
    let reads = 0;
    const getter = () => { reads++; return undefined; };
    h.document.addEventListener('click', event => {
      if (event.target === h.document.body) Object.defineProperty(prototype, key, {
        configurable: true, get: getter });
    }, true);
    try {
      assert.throws(h.capture, error => error.message === 'daytime_capture_accessor_unreadable');
      assert.equal(reads, 0);
      assert.equal(h.probes(), 1, 'only the already-delivered probe ran');
      assert.equal(Object.getOwnPropertyDescriptor(prototype, key).get, getter);
    } finally {
      if (previous) Object.defineProperty(prototype, key, previous);
      else Reflect.deleteProperty(prototype, key);
    }
  });
});

test('custom array prototypes fail closed before inherited iterators or body probes execute', async t => {
  for (const phase of ['initial', 'finish']) await t.test(phase, tt => {
    const h = setup(tt), recorder = phase === 'finish' ? h.capture() : null;
    h.window.eval(`
      window.captureIteratorCalls = 0;
      const customArrayPrototype = Object.create(Array.prototype);
      customArrayPrototype[Symbol.iterator] = function () {
        window.captureIteratorCalls++;
        return Array.prototype[Symbol.iterator].call(this);
      };
      Object.setPrototypeOf(fixtureProps.infoData[0], customArrayPrototype);
    `);
    assert.throws(() => recorder ? recorder.finish() : h.capture(),
      error => error.message === 'daytime_capture_non_data_value');
    assert.equal(h.window.captureIteratorCalls, 0);
    assert.equal(h.probes(), phase === 'finish' ? 1 : 0);
  });
});

test('nonprimitive ancestor ids fail closed before coercion or body probes execute', async t => {
  for (const phase of ['initial', 'finish']) for (const kind of ['object', 'function']) {
    await t.test(`${phase} ${kind}`, tt => {
      const h = setup(tt), recorder = phase === 'finish' ? h.capture() : null;
      h.window.eval(`
        window.captureIdCoercions = { toString: 0, valueOf: 0 };
        const unsafeId = ${kind === 'object' ? '{}' : 'function unsafeId() {}'};
        unsafeId.toString = function () { window.captureIdCoercions.toString++; return {}; };
        unsafeId.valueOf = function () { window.captureIdCoercions.valueOf++; return 'unrelated'; };
        document.getElementById('14').__reactFiber$offline.return = {
          memoizedProps: { id: unsafeId }, return: null
        };
      `);
      assert.throws(() => recorder ? recorder.finish() : h.capture(),
        error => error.message === 'daytime_capture_non_data_value');
      assert.deepEqual(plain(h.window.captureIdCoercions), { toString: 0, valueOf: 0 });
      assert.equal(h.probes(), phase === 'finish' ? 1 : 0);
    });
  }
});

test('unrelated ancestor props allow absent ids and safe primitive ids', t => {
  const h = setup(t);
  h.window.eval(`
    let ancestor = { memoizedProps: {}, return: null };
    for (const id of [undefined, null, false, 0, 1n, Symbol('unrelated'), 'unrelated']) {
      ancestor = { memoizedProps: { id }, return: ancestor };
    }
    document.getElementById('14').__reactFiber$offline.return = ancestor;
  `);
  const recorder = h.capture(), after = recorder.finish();
  assert.deepEqual(plain(after.snapshots), plain(recorder.before.snapshots));
  assert.deepEqual(plain(after.identity), { hooksRestored: true, globalsRestored: true, contextUnchanged: true });
  assert.equal(h.probes(), 2);
});

test('equivalent public-props candidates are accepted and conflicting candidates are rejected', t => {
  const h = setup(t);
  h.window.eval(`document.querySelector('.form-cell-inner').__reactFiber$equivalent = {
    memoizedProps: JSON.parse(JSON.stringify(fixtureProps)), return: null
  }`);
  const recorder = h.capture();
  assert.equal(recorder.finish().identity.contextUnchanged, true);
  h.window.eval("document.querySelector('.form-cell-inner').__reactFiber$equivalent.memoizedProps.formData.privateRaw = 'different'");
  assert.throws(h.capture, error => error.message === 'daytime_capture_public_props_not_unique');
});

test('blocked delivery and changed document context cannot be presented as a successful capture', t => {
  const h = setup(t), recorder = h.capture();
  const stop = event => { if (event.target === h.document.body) event.stopImmediatePropagation(); };
  h.document.addEventListener('click', stop, true);
  assert.equal(recorder.finish().boundary.bodyClickReached, false);
  assert.throws(h.capture, error => error.message === 'daytime_capture_body_click_blocked');
  h.document.removeEventListener('click', stop, true);
  h.window.location.hash = 'context-changed';
  assert.throws(() => recorder.finish(), error => error.message === 'daytime_capture_context_changed');
});

test('an earlier capture listener cannot silently replace a hook during the body probe', t => {
  const h = setup(t);
  const previous = h.window.fetch;
  const replacement = h.witness(function fetch() {}, h.window.Function.prototype.toString.call(previous));
  h.document.addEventListener('click', event => {
    if (event.target === h.document.body) h.window.fetch = replacement;
  }, true);
  assert.throws(h.capture, error => error.message === 'daytime_capture_body_probe_changed_boundary');
  assert.equal(h.probes(), 1);
});
