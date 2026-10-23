/**
 * Read-only observations for the existing Never-Save daytime trial.
 * The recorder lives in a retained CDP remote object, never on window.
 * Nothing in this module connects to a browser or starts a trial on import.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function buildDaytimeCaptureExpression(root = repoRoot) {
  const serialization = fs.readFileSync(path.join(root, 'src/content/cms-education-serialization.mjs'), 'utf8')
    .replace(/^export /gmu, '');
  return `(() => {\n${serialization}\nreturn (${createDaytimeCapture.toString()})(globalThis, readCmsEducationSerialization);\n})()`;
}

// Self-contained because buildDaytimeCaptureExpression serializes this function.
export function createDaytimeCapture(view, readSerialization) {
  const fail = reason => { throw new Error(reason); };
  const doc = view.document;
  const initialHref = view.location.href;
  const initialTimeOrigin = view.performance.timeOrigin;
  const toSource = view.Function.prototype.toString;
  const nativeSource = /^function\b[^{}]*\{\s*\[native code\]\s*\}$/u;
  const source = value => typeof value === 'function' ? toSource.call(value) : '';
  const globalNames = ['__cmsEducationLive', 'ResumeProfileWriteContext', 'ResumeCmsSession',
    'installResumeCmsRecordController', 'ResumeCmsEducationMulti', 'ResumeCmsMultiSchoolSearch',
    'ResumeCmsMultiEducationDates', 'ResumeCmsInternshipDates', 'ResumeCmsMultiSelect',
    'ResumeCmsInternshipSelect', 'ResumeCmsMultiRegion', 'ResumeCmsEducationMultiAdapters',
    'ResumeCmsEducationMultiWidgetControls'];
  const publicKeys = ['id', 'infoData', 'formData', 'isMutiRecord', 'dataSourceRelevantMap',
    'dataSourceRelevant', 'dataSource'];
  const controlsSelector = 'input,textarea,select,.ant-select-selection-selected-value,.ant-select-selection-item';
  const overlaySelector = '.ant-select-dropdown:not(.ant-select-dropdown-hidden),.ant-select.ant-select-open,.ant-calendar-picker-container';

  function property(object, key) {
    let owner = object, ownerDepth = 0;
    while (owner !== null) {
      const descriptor = Object.getOwnPropertyDescriptor(owner, key);
      if (descriptor) return { owner, ownerDepth, descriptor };
      owner = Object.getPrototypeOf(owner); ownerDepth++;
    }
    return null;
  }
  function data(object, key) {
    const found = property(object, key);
    if (found && !Object.hasOwn(found.descriptor, 'value')) fail('daytime_capture_accessor_unreadable');
    return found;
  }
  function ownValue(object, key) {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('daytime_capture_public_props_unreadable');
    return descriptor.value;
  }
  function sameDescriptor(left, right) {
    if (!left || !right) return left === right;
    return ['configurable', 'enumerable', 'writable', 'value', 'get', 'set']
      .every(key => Object.hasOwn(left, key) === Object.hasOwn(right, key) && left[key] === right[key]);
  }
  function sameProperty(left, right) {
    return left === null || right === null ? left === right
      : left.owner === right.owner && left.ownerDepth === right.ownerDepth
        && sameDescriptor(left.descriptor, right.descriptor);
  }

  // Tagged data preserves every own string key, holes, undefined, null, raw
  // whitespace, non-finite numbers and negative zero. Accessors, symbols,
  // non-data objects and cycles fail closed rather than execute applicant code.
  function encode(value, ancestors = new Set()) {
    if (value === null) return ['null'];
    const type = typeof value;
    if (type === 'undefined') return ['undefined'];
    if (type === 'string' || type === 'boolean') return [type, value];
    if (type === 'number') return [type, Object.is(value, -0) ? '-0' : String(value)];
    if (type === 'bigint') return [type, String(value)];
    if (type !== 'object' || ancestors.has(value) || Object.getOwnPropertySymbols(value).length)
      fail('daytime_capture_non_data_value');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    if (array ? prototype !== view.Array.prototype
      : prototype !== view.Object.prototype && prototype !== null) fail('daytime_capture_non_data_value');
    const next = new Set(ancestors); next.add(value);
    const names = Object.getOwnPropertyNames(value).sort();
    const entries = names.map(key => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('daytime_capture_accessor_unreadable');
      return [key, { configurable: descriptor.configurable, enumerable: descriptor.enumerable,
        writable: descriptor.writable, value: encode(descriptor.value, next) }];
    });
    if (array) return ['array', entries];
    return ['object', prototype === null ? 'null_prototype' : 'object_prototype', entries];
  }
  function encodedPublicProps(props) {
    return publicKeys.map(key => {
      const found = data(props, key);
      return [key, found ? ['present', found.ownerDepth, encode(found.descriptor.value)] : ['absent']];
    });
  }
  const hookTargets = () => [
    ['fetch', view, 'fetch'], ['click', view.HTMLElement.prototype, 'click'],
    ['submit', view.HTMLFormElement.prototype, 'submit'], ['requestSubmit', view.HTMLFormElement.prototype, 'requestSubmit'],
    ...['open', 'send', 'abort'].map(key => [`XHR.${key}`, view.XMLHttpRequest.prototype, key]),
    ...['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'].map(key => [key, view, key]),
    ['sendBeacon', view.navigator, 'sendBeacon']
  ];
  function hooks() {
    return hookTargets().map(([name, object, key]) => {
      const found = data(object, key);
      if (!found || typeof found.descriptor.value !== 'function') fail('daytime_capture_hook_unreadable');
      const descriptor = found.descriptor;
      return { name, found, observation: { source: source(descriptor.value), ownerDepth: found.ownerDepth,
        configurable: descriptor.configurable, enumerable: descriptor.enumerable, writable: descriptor.writable } };
    });
  }
  const globals = () => globalNames.map(key => [key, Object.getOwnPropertyDescriptor(view, key)]);
  const unchangedContext = () => view.document === doc && view.location.href === initialHref
    && view.performance.timeOrigin === initialTimeOrigin;
  const visible = node => !!node.getClientRects().length && view.getComputedStyle(node).display !== 'none'
    && view.getComputedStyle(node).visibility !== 'hidden';

  function boundaryParts() {
    const observedHooks = hooks();
    return { observedHooks, boundary: {
      hasCmsLive: property(view, '__cmsEducationLive') !== null,
      overlays: [...doc.querySelectorAll(overlaySelector)].filter(visible).length,
      bodyClickReached: false,
      hooks: Object.fromEntries(observedHooks.map(row => [row.name, row.observation]))
    } };
  }
  function cleanBoundary(boundary) {
    return !boundary.hasCmsLive && boundary.overlays === 0
      && Object.values(boundary.hooks).every(hook => nativeSource.test(hook.source))
      && unchangedContext() && doc.readyState === 'complete' && doc.visibilityState === 'visible';
  }

  // A document capture listener stops a body-targeted synthetic event before
  // it reaches the body or bubbles into site handlers. Use the native dispatch
  // primitive, never HTMLElement.click(), an opener, a handler or a form action.
  function bodyProbe() {
    if (!doc.body) fail('daytime_capture_body_unavailable');
    const eventPrototype = view.EventTarget.prototype;
    const add = data(eventPrototype, 'addEventListener')?.descriptor.value;
    const remove = data(eventPrototype, 'removeEventListener')?.descriptor.value;
    const dispatch = data(eventPrototype, 'dispatchEvent')?.descriptor.value;
    const stop = data(view.Event.prototype, 'stopImmediatePropagation')?.descriptor.value;
    const prevent = data(view.Event.prototype, 'preventDefault')?.descriptor.value;
    if (![add, remove, dispatch, stop, prevent, view.MouseEvent].every(fn => nativeSource.test(source(fn))))
      fail('daytime_capture_probe_primitive_not_native');
    let reached = false;
    const event = new view.MouseEvent('click', { bubbles: true, cancelable: true, view });
    const listener = observed => {
      if (observed !== event || observed.target !== doc.body) return;
      reached = true;
      prevent.call(observed); stop.call(observed);
    };
    add.call(doc, 'click', listener, true);
    try { dispatch.call(doc.body, event); }
    finally { remove.call(doc, 'click', listener, true); }
    return reached;
  }

  function propsAndSection() {
    // These are the shipped reader's exact section and public-props boundaries.
    const clean = value => String(value || '').normalize('NFKC').replace(/[＊*：:!?！？\s]/gu, '');
    const sections = [...doc.querySelectorAll('form .form-cell')].filter(node => visible(node) && node.id === '14'
      && clean(node.querySelector(':scope > .tit-wrap .tit')?.textContent) === '教育经历必填');
    if (sections.length !== 1) fail('daytime_capture_section_not_unique');
    const section = sections[0], candidates = new Set();
    for (const node of [section, ...section.querySelectorAll(':scope > .form-cell-right > .form-cell-inner')]) {
      const expando = Object.keys(node).find(key => /^__(?:reactInternalInstance|reactFiber)\$/u.test(key));
      let fiber = expando ? ownValue(node, expando) : null;
      for (let index = 0; fiber && index < 30; index++, fiber = ownValue(fiber, 'return')) {
        const props = ownValue(fiber, 'memoizedProps');
        if (!props || typeof props !== 'object') continue;
        const id = data(props, 'id')?.descriptor.value;
        // The shipped reader stringifies every ancestor id, including props
        // that do not identify this section. Reject executable coercion first.
        if (id !== null && ['object', 'function'].includes(typeof id)) fail('daytime_capture_non_data_value');
        if (!['number', 'string'].includes(typeof id) || String(id) !== '14') continue;
        const info = data(props, 'infoData')?.descriptor.value, form = data(props, 'formData')?.descriptor.value;
        if (Array.isArray(info) && form && typeof form === 'object') candidates.add(props);
      }
    }
    const available = [...candidates];
    if (!available.length) fail('daytime_capture_public_props_not_unique');
    const signatures = available.map(props => JSON.stringify(encodedPublicProps(props)));
    if (signatures.some(value => value !== signatures[0])) fail('daytime_capture_public_props_not_unique');
    return { section, props: available[0] };
  }
  function attributes(node) {
    // Focus, open-state ARIA and animation classes/styles are transient. Raw
    // value, ownership and control metadata remain explicit in this snapshot.
    return [...node.attributes].filter(attribute => !['class', 'style', 'tabindex', 'aria-expanded', 'aria-activedescendant'].includes(attribute.name))
      .map(attribute => [attribute.name, attribute.value]).sort(([left], [right]) => left.localeCompare(right));
  }
  function control(node) {
    return { tag: node.tagName, attributes: attributes(node), type: node.type ?? null,
      value: 'value' in node ? node.value : undefined, text: node.textContent,
      checked: 'checked' in node ? node.checked : undefined,
      defaultValue: 'defaultValue' in node ? node.defaultValue : undefined,
      defaultChecked: 'defaultChecked' in node ? node.defaultChecked : undefined,
      selectedIndex: 'selectedIndex' in node ? node.selectedIndex : undefined,
      disabled: 'disabled' in node ? node.disabled : undefined,
      readOnly: 'readOnly' in node ? node.readOnly : undefined,
      options: node.tagName === 'SELECT' ? [...node.options].map(option => ({ attributes: attributes(option),
        value: option.value, text: option.textContent, selected: option.selected, defaultSelected: option.defaultSelected,
        disabled: option.disabled })) : undefined };
  }
  function snapshots() {
    if (!unchangedContext()) fail('daytime_capture_context_changed');
    const { section, props } = propsAndSection();
    // Validate and encode raw props before the shipped reader can access them.
    const publicProps = encodedPublicProps(props);
    const proof = readSerialization();
    if (!proof?.ok || proof.timeOrigin !== initialTimeOrigin) fail('daytime_capture_serialization_unavailable');
    const rows = [...section.querySelectorAll(':scope > .form-cell-right > .form-cell-inner')];
    if (rows.length !== proof.rows.length) fail('daytime_capture_rows_changed');
    const dom = proof.rows.map((row, index) => ({ identity: row.identity, fields: row.fields.map(field => {
      const wrappers = [...rows[index].querySelectorAll(':scope > div[id]')].filter(node => node.id === field.wrapperId);
      if (wrappers.length !== 1) fail('daytime_capture_wrapper_not_unique');
      return { question: field.question, oldItemId: field.oldItemId, fieldName: field.fieldName,
        wrapperId: field.wrapperId, fillType: field.fillType, required: field.required,
        customDataSource: field.customDataSource, controls: [...wrappers[0].querySelectorAll(controlsSelector)].map(control) };
    }) }));
    const neighborNodes = [...doc.querySelectorAll(controlsSelector)].filter(node => !section.contains(node));
    return {
      snapshots: { dom: encode(dom), publicProps, dto: encode(proof.serialized), neighbors: encode(neighborNodes.map(control)) },
      // Retain complete raw markup for inspection alongside the defined form-
      // state hashes. Class/style/open-ARIA distinctions remain visible here;
      // current values not reflected by HTML attributes are retained above.
      rawDom: { educationOuterHTML: section.outerHTML, neighborOuterHTML: neighborNodes.map(node => node.outerHTML) }
    };
  }
  function observe(initial = false) {
    const parts = boundaryParts();
    const clean = cleanBoundary(parts.boundary);
    if (initial && !clean) fail('daytime_capture_page_not_clean');
    const beforeProbe = snapshots();
    if (clean) {
      const globalsBeforeProbe = globals();
      parts.boundary.bodyClickReached = bodyProbe();
      if (JSON.stringify(beforeProbe) !== JSON.stringify(snapshots())) fail('daytime_capture_body_probe_changed_state');
      const afterProbe = boundaryParts(), globalsAfterProbe = globals();
      if (parts.boundary.hasCmsLive !== afterProbe.boundary.hasCmsLive
        || parts.boundary.overlays !== afterProbe.boundary.overlays
        || !parts.observedHooks.every((hook, index) => sameProperty(hook.found, afterProbe.observedHooks[index]?.found || null))
        || !globalsBeforeProbe.every(([key, descriptor], index) => globalsAfterProbe[index]?.[0] === key
          && sameDescriptor(descriptor, globalsAfterProbe[index]?.[1]))) fail('daytime_capture_body_probe_changed_boundary');
      if (initial && !parts.boundary.bodyClickReached) fail('daytime_capture_body_click_blocked');
    }
    return { ...parts, snapshots: beforeProbe.snapshots, rawDom: beforeProbe.rawDom };
  }

  const initialGlobals = globals();
  const first = observe(true);
  const before = { boundary: first.boundary, snapshots: first.snapshots, rawDom: first.rawDom,
    context: { timeOrigin: initialTimeOrigin } };
  return {
    before,
    finish() {
      const last = observe();
      const finalGlobals = globals();
      return { boundary: last.boundary, snapshots: last.snapshots, rawDom: last.rawDom,
        context: { timeOrigin: view.performance.timeOrigin },
        identity: {
          hooksRestored: first.observedHooks.every((hook, index) => hook.name === last.observedHooks[index]?.name
            && sameProperty(hook.found, last.observedHooks[index]?.found || null)),
          globalsRestored: initialGlobals.every(([key, descriptor], index) => finalGlobals[index]?.[0] === key
            && sameDescriptor(descriptor, finalGlobals[index]?.[1])),
          contextUnchanged: unchangedContext()
        } };
    }
  };
}
