/** Offline contracts only: synthetic graphs/portals and installed Vue/Ant.
 * Native Blink runs in a freshly owned offline profile, never a user page.
 */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import { inspectCmsRowDCalendarEvidence } from '../scripts/lib/cms-row-d-calendar.mjs';
import { ROW_D_PAGE, inspectCmsRowDOptions, buildCmsRowDOptionsProbeExpression }
  from '../scripts/lib/cms-row-d-options.mjs';
import { connectCdp } from '../tools/live-harvest/cdp-client.mjs';

const PRIVATE = 'OFFLINE_PRIVATE_SELECTED_DATE_DO_NOT_READ';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

// Kept self-contained for reuse in the separately launched native Blink page.
function syntheticCalendar(doc, { portal = false, format = 'YYYY-MM', mode, open = false } = {}) {
  doc.body.innerHTML = '<section id="16" class="form-cell"><div id="16_65_0"><div class="ant-form-item">'
    + '<div class="ant-form-item-label"><label>获得时间*</label></div>'
    + '<span class="ant-calendar-picker"><input type="text" placeholder="请选择月份"></span>'
    + '</div></div></section>';
  const picker = doc.querySelector('.ant-calendar-picker');
  const input = doc.querySelector('input');
  const item = doc.querySelector('.ant-form-item');
  const effects = { reads: 0, writes: 0, interactions: 0 };
  const forbid = kind => function () { effects[kind] += 1; throw new Error('private_calendar_access'); };
  for (const node of [picker, input]) {
    for (const key of ['value', 'checked', 'selected', 'textContent', 'innerHTML', 'innerText', 'outerHTML']) {
      Object.defineProperty(node, key, { configurable: true, get: forbid('reads'), set: forbid('writes') });
    }
    for (const key of ['click', 'focus', 'blur', 'dispatchEvent']) node[key] = forbid('interactions');
  }
  function MonthPicker() {}
  const props = { format, mode, open, prefixCls: 'ant-calendar' };
  for (const key of ['value', 'defaultValue', 'selectedValue', 'defaultPickerValue']) {
    Object.defineProperty(props, key, { configurable: true, get: forbid('reads') });
  }
  const fiber = (tag, type, stateNode, memoizedProps = {}) => ({ tag, type, stateNode,
    memoizedProps, return: null, alternate: null, child: null, sibling: null });
  const host = fiber(5, 'span', picker);
  const component = fiber(1, MonthPicker, { props }, props);
  const outer = fiber(5, 'div', item);
  const root = fiber(3, null, {});
  root.stateNode.current = root;
  const chain = [root, outer, component, host];
  for (let index = 1; index < chain.length; index += 1) {
    chain[index].return = chain[index - 1];
    chain[index - 1].child = chain[index];
  }
  picker.__reactFiber$offlineCalendar = host;
  const targets = [];
  if (portal) {
    input.setAttribute('aria-controls', 'owned-calendar-panel');
    const target = doc.createElement('div');
    target.id = 'owned-calendar-panel';
    target.className = 'ant-calendar-picker-container';
    const grid = doc.createElement('div');
    grid.className = 'ant-calendar';
    const count = portal === 'date' ? 42 : 12;
    for (let index = 0; index < count; index += 1) {
      const cell = doc.createElement('a');
      cell.className = portal === 'date' ? 'ant-calendar-date' : 'ant-calendar-month-panel-month';
      // Cell text/date/title/selection are unnecessary for shape-only proof.
      Object.defineProperty(cell, 'textContent', { configurable: true, get: forbid('reads'), set: forbid('writes') });
      grid.appendChild(cell);
    }
    target.appendChild(grid);
    doc.body.appendChild(target);
    targets.push(target);
  }
  return { picker, input, item, props, host, component, outer, root, effects, targets };
}

function fixture(t, options) {
  const dom = new JSDOM('<!doctype html><body></body>', { url: ROW_D_PAGE,
    pretendToBeVisual: true, runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  Object.defineProperty(dom.window.document, 'readyState', { value: 'complete' });
  const f = syntheticCalendar(dom.window.document, options);
  const observer = new dom.window.MutationObserver(() => {});
  observer.observe(dom.window.document, { subtree: true, childList: true, attributes: true, characterData: true });
  t.after(() => observer.disconnect());
  const read = (expression = false) => {
    observer.takeRecords(); // Test mutations are setup, never probe effects.
    const result = expression ? dom.window.eval(buildCmsRowDOptionsProbeExpression()).fields.find(row => row.key === 'englishExamDate')
      : inspectCmsRowDOptions(dom.window.document).fields.find(row => row.key === 'englishExamDate');
    assert.equal(observer.takeRecords().length, 0);
    assert.deepEqual(f.effects, { reads: 0, writes: 0, interactions: 0 });
    assert.equal(JSON.stringify(result).includes(PRIVATE), false);
    for (const name of ['writeStarted', 'mutationAllowed', 'valuesExposed', 'liveSupportClaimed', 'livePassClaimed']) {
      assert.equal(result[name], false);
    }
    assert.equal(result.neverSave, true);
    assert.equal(result.probeOnly, true);
    return result;
  };
  return { ...f, dom, doc: dom.window.document, read,
    evidence: () => inspectCmsRowDCalendarEvidence(f.picker, f.input, f.item, dom.window.document) };
}

for (const expression of [false, true]) {
  test(`current committed React MonthPicker supplies inert month-format evidence (expression=${expression})`, t => {
    const f = fixture(t);
    const row = f.read(expression);
    assert.equal(row.ok, true);
    assert.equal(row.reason, 'read_only_calendar_preflight');
    assert.equal(row.calendarStructureObserved, true);
    assert.equal(row.calendarEvidenceSource, 'owned_react_props');
    assert.equal(row.calendarFramework, 'react');
    assert.equal(row.calendarPickerKind, 'month');
    assert.equal(row.calendarFormat, 'YYYY-MM');
    assert.equal(row.calendarMode, 'month');
    assert.equal(row.calendarOpen, false);
    assert.equal(row.optionsComplete, false, 'historical metadata is preserved');
    assert.equal(row.evidenceSource, 'metadata_only');
  });
  for (const portal of ['month', 'date']) test(`already visible owned ${portal} grid is shape evidence without date reads (expression=${expression})`, t => {
    const f = fixture(t, { portal, open: true, format: undefined });
    // An explicit undefined format models absent optional static evidence.
    delete f.props.format;
    const row = f.read(expression);
    assert.equal(row.ok, true, JSON.stringify(row));
    assert.equal(row.calendarEvidenceSource, 'aria_controls_calendar_dom');
    assert.equal(row.calendarPanelKind, portal);
    assert.equal(row.calendarCellCount, portal === 'month' ? 12 : 42);
    assert.equal(Object.hasOwn(row, 'calendarFormat'), false);
  });
}

test('a stale exact host expando authenticates only its committed alternate', t => {
  const f = fixture(t);
  const stale = { ...f.host, return: null, alternate: f.host };
  f.host.alternate = stale;
  f.picker.__reactFiber$offlineCalendar = stale;
  assert.equal(f.read().ok, true);
});

test('React bailout shared child is proved from current forward links', t => {
  const f = fixture(t);
  const staleOuter = { ...f.outer, child: null, alternate: f.outer };
  f.outer.alternate = staleOuter;
  f.component.return = staleOuter;
  assert.equal(f.read().ok, true);
});

const rejects = {
  'placeholder/structure alone': [f => { delete f.picker.__reactFiber$offlineCalendar; }, 'root_anchor_missing'],
  'foreign DatePicker with a month-looking format': [f => { f.component.type = function DatePicker() {}; }, 'month_component_unrecognized'],
  'foreign enclosing MonthPicker past another host boundary': [f => { f.component.tag = 5; }, 'month_component_unrecognized'],
  'detached committed branch': [f => { f.outer.child = null; }, 'current_chain_unverified'],
  'wrong root.current': [f => { f.root.stateNode.current = {}; }, 'current_chain_unverified'],
  'uncommitted props identity': [f => { f.component.stateNode.props = {}; }, 'current_props_unverified'],
  'ambiguous host anchors': [f => { f.picker.__reactInternalInstance$alien = f.host; }, 'current_root_unverified'],
  'format getter': [f => { Object.defineProperty(f.props, 'format', { get() { throw Error(PRIVATE); } }); }, 'calendar_data_unavailable'],
  'format function': [f => { f.props.format = () => 'YYYY-MM'; }, 'calendar_props_unsupported'],
  'format array': [f => { f.props.format = ['YYYY-MM']; }, 'calendar_props_unsupported'],
  'date format': [f => { f.props.format = 'YYYY-MM-DD'; }, 'calendar_props_unsupported'],
  'date mode': [f => { f.props.mode = 'date'; }, 'calendar_props_unsupported'],
  'malformed open': [f => { f.props.open = 'false'; }, 'calendar_props_unsupported'],
  'disabled props': [f => { f.props.disabled = true; }, 'calendar_props_unsupported'],
  'unsupported prefix': [f => { f.props.prefixCls = 'foreign-calendar'; }, 'calendar_props_unsupported'],
  'missing format without a portal': [f => { delete f.props.format; }, 'calendar_format_missing'],
  'conflicting picker/input aria references': [f => { f.picker.setAttribute('aria-controls', 'one'); f.input.setAttribute('aria-controls', 'two'); }, 'calendar_reference_ambiguous']
};
for (const [name, [change, issue]] of Object.entries(rejects)) test(`reject ${name}`, t => {
  const f = fixture(t);
  change(f);
  const row = f.read();
  assert.equal(row.ok, false);
  assert.equal(row.reason, 'calendar_live_evidence_missing');
  assert.equal(row.calendarDefinitionIssue, issue);
  assert.equal(Object.hasOwn(row, 'calendarEvidenceSource'), false);
});

const portalRejects = {
  'another field owns the same aria target': [f => { const alien = f.doc.createElement('input'); alien.setAttribute('aria-controls', 'owned-calendar-panel'); f.doc.body.appendChild(alien); }, 'calendar_portal_owner_unverified'],
  'duplicate target id': [f => { const alien = f.doc.createElement('div'); alien.id = 'owned-calendar-panel'; f.doc.body.appendChild(alien); }, 'calendar_portal_ambiguous'],
  'foreign section boundary': [f => { const section = f.doc.createElement('section'); section.className = 'form-cell'; f.doc.body.appendChild(section); section.appendChild(f.targets[0]); }, 'calendar_portal_owner_unverified'],
  'grid nested in a foreign form item': [f => { const alien = f.doc.createElement('div'); alien.className = 'ant-form-item'; const grid = f.targets[0].querySelector('.ant-calendar'); f.targets[0].appendChild(alien); alien.appendChild(grid); }, 'calendar_portal_owner_unverified'],
  'cell nested in a foreign named wrapper': [f => { const alien = f.doc.createElement('div'); alien.id = '13_100701_0'; const grid = f.targets[0].querySelector('.ant-calendar'); const cell = grid.querySelector('a'); grid.appendChild(alien); alien.appendChild(cell); }, 'calendar_panel_shape_unsupported'],
  'hidden portal': [f => { f.targets[0].style.display = 'none'; }, 'calendar_portal_hidden'],
  'content-visibility hidden portal': [f => { f.targets[0].setAttribute('style', 'content-visibility: hidden'); }, 'calendar_portal_hidden'],
  'comment-obscured display-none portal': [f => { f.targets[0].setAttribute('style', 'display:/*hidden*/none'); }, 'calendar_portal_hidden'],
  'whitespace important hidden portal': [f => { f.targets[0].setAttribute('style', 'visibility:hidden ! important'); }, 'calendar_portal_hidden'],
  'collapsed portal': [f => { f.targets[0].classList.add('ant-collapse-content-inactive'); }, 'calendar_portal_hidden'],
  'hidden cell': [f => { f.targets[0].querySelector('a').setAttribute('hidden', ''); }, 'calendar_panel_shape_unsupported'],
  'extra grid': [f => { const grid = f.doc.createElement('div'); grid.className = 'ant-calendar'; f.targets[0].appendChild(grid); }, 'calendar_portal_ambiguous'],
  'incomplete month panel': [f => { f.targets[0].querySelector('a').remove(); }, 'calendar_panel_shape_unsupported'],
  'contradicting closed current props': [f => { f.props.open = false; }, 'calendar_open_state_mismatch'],
  'foreign component even with a complete month grid': [f => { f.component.type = function DatePicker() {}; }, 'month_component_unrecognized']
};
for (const [name, [change, issue]] of Object.entries(portalRejects)) test(`reject ${name} without a static-format escape`, t => {
  const f = fixture(t, { portal: 'month', open: true });
  change(f);
  const row = f.read(true);
  assert.equal(row.ok, false);
  assert.equal(row.calendarDefinitionIssue, issue);
  assert.equal(Object.hasOwn(row, 'calendarEvidenceSource'), false);
});

test('Vue proof binds the exact current root, parent vnode and propsData using own data only', t => {
  const f = fixture(t);
  delete f.picker.__reactFiber$offlineCalendar;
  const props = { format: 'YYYY-MM', open: false };
  Object.defineProperty(props, 'value', { get() { throw Error(PRIVATE); } });
  const parent = { elm: f.picker, componentOptions: { Ctor: { options: { name: 'AMonthPicker' } }, propsData: props } };
  const component = { $el: f.picker, $vnode: parent, $options: { propsData: props }, _vnode: { elm: f.picker } };
  parent.componentInstance = component;
  f.picker.__vue__ = component;
  assert.equal(f.read(true).calendarEvidenceSource, 'owned_calendar_vnodes');
  component.$options.propsData = { format: 'YYYY-MM' };
  assert.equal(f.read().calendarDefinitionIssue, 'current_props_unverified');
});

test('Vue never searches an enclosing application root for a substitute', t => {
  const f = fixture(t);
  delete f.picker.__reactFiber$offlineCalendar;
  Object.defineProperty(f.item, '__vue__', { get() { throw Error(PRIVATE); } });
  assert.equal(f.read().calendarDefinitionIssue, 'root_anchor_missing');
});

const require = createRequire(import.meta.url);
const vueDom = new JSDOM('<!doctype html><body></body>', { url: ROW_D_PAGE, pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'Element', 'HTMLElement']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: name === 'window' ? vueDom.window : vueDom.window[name] });
}
const Vue = require('vue');
const ADatePicker = require('ant-design-vue/lib/date-picker').default;
Vue.config.productionTip = false;
Vue.config.devtools = false;
after(() => vueDom.window.close());

test('installed Vue 2.7.16 / Ant 1.7.8 MonthPicker supplies current evidence without opening', async () => {
  const doc = vueDom.window.document;
  doc.body.innerHTML = '<div class="ant-form-item"><div id="month-mount"></div></div>';
  const vm = new Vue({ render(h) { return h(ADatePicker.MonthPicker, { props: { format: 'YYYY-MM', open: false } }); } }).$mount('#month-mount');
  try {
    await Vue.nextTick();
    const picker = doc.querySelector('.ant-calendar-picker');
    const evidence = inspectCmsRowDCalendarEvidence(picker, picker.querySelector('input'), doc.querySelector('.ant-form-item'), doc);
    assert.equal(doc.querySelector('.ant-calendar-picker-container'), null);
    assert.equal(evidence.ok, true, JSON.stringify(evidence));
    assert.equal(evidence.calendarEvidenceSource, 'owned_calendar_vnodes');
    const own = (object, key) => Object.getOwnPropertyDescriptor(object || {}, key)?.value;
    const definitions = [];
    for (let component = own(picker, '__vue__'), depth = 0; component && depth < 8; depth += 1) {
      const options = own(own(component, '$vnode'), 'componentOptions');
      if (own(own(own(options, 'Ctor'), 'options'), 'name') === 'AMonthPicker') {
        const props = own(own(component, '$options'), 'propsData');
        definitions.push(props);
        Object.defineProperty(props, 'value', { configurable: true, get() { throw Error(PRIVATE); } });
      }
      component = own(own(component, '_vnode'), 'componentInstance');
    }
    assert.equal(definitions.length, 2, 'the actual installed current wrapper/implementation chain is bound');
    assert.equal(inspectCmsRowDCalendarEvidence(picker, picker.querySelector('input'), doc.querySelector('.ant-form-item'), doc).ok, true);
    definitions[0].format = 'YYYY/MM';
    assert.equal(inspectCmsRowDCalendarEvidence(picker, picker.querySelector('input'), doc.querySelector('.ant-form-item'), doc).calendarDefinitionIssue, 'calendar_props_unsupported');
  } finally { vm.$destroy(); }
});

test('native Blink accepts static and visible-portal React calendar proof with throwOnSideEffect=true', { timeout: 30000 }, async t => {
  const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  assert.ok(fs.existsSync(chrome), 'dedicated offline Chrome binary is installed');
  const prefix = 'cms-row-d-calendar-blink-';
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  let child, session;
  try {
    child = spawn(chrome, ['--headless=new', '--disable-gpu', '--disable-background-networking',
      '--no-first-run', '--no-default-browser-check', '--no-proxy-server',
      '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost',
      '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
    { windowsHide: true, stdio: 'ignore' });
    let port;
    for (let round = 0; round < 100 && !port; round += 1) {
      try { port = Number(fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split(/\r?\n/u)[0]); } catch {}
      if (!port) await pause(60);
    }
    assert.ok(Number.isInteger(port) && port > 0);
    assert.ok(![9237, 9239, 9241, 9242].includes(port));
    const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(reply => reply.json());
    const pages = targets.filter(row => row.type === 'page' && row.url === 'about:blank');
    assert.equal(pages.length, 1);
    session = await connectCdp(pages[0].webSocketDebuggerUrl, { timeoutMs: 5000 });
    await session.send('Page.enable');
    const strict = { returnByValue: true, throwOnSideEffect: true, awaitPromise: false, userGesture: false, timeout: 5000 };
    for (const options of [{}, { portal: 'month', open: true }, { portal: 'date', open: true }]) {
      const setup = await session.send('Runtime.evaluate', { returnByValue: true,
        expression: `(() => { globalThis.__calendarFixture = (${syntheticCalendar.toString()})(document, ${JSON.stringify(options)}); return true; })()` });
      assert.equal(setup.exceptionDetails, undefined, JSON.stringify(setup.exceptionDetails));
      const reply = await session.send('Runtime.evaluate', { ...strict,
        expression: `(${inspectCmsRowDCalendarEvidence.toString()})(document.querySelector('.ant-calendar-picker'),document.querySelector('input'),document.querySelector('.ant-form-item'),document)` });
      assert.equal(reply.exceptionDetails, undefined, JSON.stringify(reply.exceptionDetails));
      assert.equal(reply.result.value.ok, true, JSON.stringify(reply.result.value));
      assert.equal(reply.result.value.calendarEvidenceSource, options.portal ? 'aria_controls_calendar_dom' : 'owned_react_props');
      const after = await session.send('Runtime.evaluate', { returnByValue: true, expression: 'globalThis.__calendarFixture.effects' });
      assert.deepEqual(after.result.value, { reads: 0, writes: 0, interactions: 0 });
    }
    const refused = await session.send('Runtime.evaluate', { ...strict, expression: "document.body.setAttribute('data-calendar-forbidden', 'write')" });
    assert.ok(refused.exceptionDetails, 'strict native evaluation rejects a deliberate write');
    t.diagnostic('owned offline native Blink: static/month/date proof accepted; no reads, writes or interactions; deliberate write rejected');
  } finally {
    try { await session?.send('Browser.close'); } catch {}
    session?.close();
    if (child && child.exitCode === null && child.signalCode === null) {
      await Promise.race([new Promise(resolve => child.once('exit', resolve)), pause(1500)]);
    }
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill();
      await Promise.race([new Promise(resolve => child.once('exit', resolve)), pause(1500)]);
    }
    const relative = path.relative(fs.realpathSync(os.tmpdir()), fs.realpathSync(profile));
    assert.ok(relative.startsWith(prefix) && !path.isAbsolute(relative) && !relative.includes(path.sep));
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
  }
});
