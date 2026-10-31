/** Synthetic graph/DOM contracts only. No captured CMS DOM or live page. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { JSDOM } from 'jsdom';
import { inspectCmsRowDCalendarPanel } from '../scripts/lib/cms-row-d-calendar-panel.mjs';
import { ROW_D_FIELDS, ROW_D_PAGE, inspectCmsRowDOptions, buildCmsRowDOptionsProbeExpression }
  from '../scripts/lib/cms-row-d-options.mjs';
import { connectCdp } from '../tools/live-harvest/cdp-client.mjs';

// Self-contained to reuse in a separate, offline Blink process.
function syntheticPortal(doc, kind = 'month') {
  doc.body.innerHTML = '<section id="16" class="form-cell"><div id="16_65_0"><div class="ant-form-item"><div class="ant-form-item-label"><label for="offline-linked-input">Offline label</label></div>'
    + '<span class="ant-calendar-picker"><input id="offline-linked-input" type="text"></span></div></div></section>';
  const item = doc.querySelector('.ant-form-item'), picker = doc.querySelector('.ant-calendar-picker');
  const input = picker.querySelector('input');
  const effects = { reads: 0, writes: 0, interactions: 0 };
  const forbid = kind => function () { effects[kind] += 1; throw new Error('private_date_access'); };
  const protect = node => {
    for (const key of ['value', 'checked', 'selected', 'textContent', 'innerHTML', 'innerText', 'outerHTML']) {
      Object.defineProperty(node, key, { configurable: true, get: forbid('reads'), set: forbid('writes') });
    }
    for (const key of ['click', 'focus', 'blur', 'dispatchEvent']) node[key] = forbid('interactions');
  };
  protect(picker); protect(input);
  const fiber = (tag, type, stateNode) => ({ tag, type, stateNode, return: null, alternate: null, child: null, sibling: null });
  const root = fiber(3, null, {});
  root.stateNode.current = root;
  const outer = fiber(5, 'div', item), trigger = fiber(5, 'span', picker);
  const component = fiber(1, function x() {}, {});
  Object.defineProperty(component.stateNode, 'props', { get: forbid('reads') });
  const chain = [root, outer, component, trigger];
  for (let index = 1; index < chain.length; index += 1) {
    chain[index].return = chain[index - 1]; chain[index - 1].child = chain[index];
  }
  picker.__reactFiber$offline = trigger;
  let container, target, portal, panelHost, grid, panel;
  if (kind !== 'absent') {
    container = doc.createElement('div');
    target = doc.createElement('div'); target.className = 'ant-calendar-picker-container';
    grid = doc.createElement('div'); grid.className = 'ant-calendar';
    const datePanel = doc.createElement('div'); datePanel.className = 'ant-calendar-date-panel';
    const header = doc.createElement('a'); header.className = 'ant-calendar-month-select'; header.setAttribute('role', 'button');
    datePanel.appendChild(header);
    for (let index = 0; index < 42; index += 1) {
      const cell = doc.createElement('a'); cell.className = 'ant-calendar-date'; datePanel.appendChild(cell); protect(cell);
    }
    grid.appendChild(datePanel);
    if (kind === 'month') {
      panel = doc.createElement('div'); panel.className = 'ant-calendar-month-panel';
      for (let index = 0; index < 12; index += 1) {
        const cell = doc.createElement('a'); cell.className = 'ant-calendar-month-panel-month'; panel.appendChild(cell); protect(cell);
      }
      grid.appendChild(panel);
    }
    target.appendChild(grid); container.appendChild(target); doc.body.appendChild(container);
    portal = fiber(4, null, { containerInfo: container });
    panelHost = fiber(5, 'div', target);
    trigger.child = portal; portal.return = trigger; portal.child = panelHost; panelHost.return = portal;
    target.__reactFiber$offline = panelHost;
  }
  return { picker, input, item, root, outer, component, trigger, container, target, portal, panelHost, grid, panel, effects };
}

function fixture(t, kind = 'month') {
  const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const doc = dom.window.document, f = syntheticPortal(doc, kind);
  const observer = new dom.window.MutationObserver(() => {});
  observer.observe(doc, { subtree: true, attributes: true, childList: true, characterData: true });
  t.after(() => observer.disconnect());
  const read = (action = 'evidence') => {
    observer.takeRecords();
    const result = inspectCmsRowDCalendarPanel(f.picker, f.input, f.item, doc, action);
    assert.deepEqual(observer.takeRecords(), []);
    assert.deepEqual(f.effects, { reads: 0, writes: 0, interactions: 0 });
    return result;
  };
  return { ...f, doc, read };
}

test('committed React portal supplies month-panel shape without MonthPicker identity or value reads', t => {
  const f = fixture(t), result = f.read();
  assert.equal(f.grid.querySelectorAll('.ant-calendar-date').length, 42, 'date grid remains underneath the month panel');
  assert.deepEqual(result, { ok: true, calendarFramework: 'react', calendarEvidenceSource: 'owned_react_portal',
    calendarPickerKind: 'unverified', calendarMode: 'month', calendarPanelKind: 'month', calendarCellCount: 12,
    calendarPanelOwned: true, calendarPanelState: 'month' });
});

test('no popup remains an honest closed state after authenticating the trigger', t => {
  const result = fixture(t, 'absent').read();
  assert.equal(result.ok, false);
  assert.equal(result.calendarDefinitionIssue, 'calendar_portal_hidden');
  assert.equal(result.calendarPanelState, 'closed');
  assert.equal(Object.hasOwn(result, 'calendarPanelOwned'), false);
});

test('owned date panel enables bounded header routing but never supplies month evidence', t => {
  const result = fixture(t, 'date').read();
  assert.equal(result.ok, false);
  assert.equal(result.calendarDefinitionIssue, 'calendar_panel_shape_unsupported');
  assert.equal(result.calendarPanelState, 'date');
  assert.equal(result.calendarPanelOwned, true);
  assert.equal(Object.hasOwn(result, 'calendarPickerKind'), false);
});

test('stale host expandos resolve their committed alternates for both trigger and popup', t => {
  const f = fixture(t);
  for (const [node, current] of [[f.picker, f.trigger], [f.target, f.panelHost]]) {
    const stale = { ...current, return: null, child: null, alternate: current };
    current.alternate = stale; node.__reactFiber$offline = stale;
  }
  assert.equal(f.read().ok, true);
});

test('current forward links authenticate a bailout with stale return links', t => {
  const f = fixture(t);
  const stale = { ...f.trigger, child: null, alternate: f.trigger };
  f.trigger.alternate = stale; f.portal.return = stale;
  assert.equal(f.read().ok, true);
});

const rejects = {
  'duplicate wrapper': [f => { const alien = f.doc.createElement('div'); alien.id = '16_65_0'; f.doc.body.appendChild(alien); }, 'calendar_owner_unverified'],
  'wrong section': [f => { f.doc.querySelector('section').id = '17'; }, 'calendar_owner_unverified'],
  'foreign input': [f => { f.item.appendChild(f.doc.createElement('input')); }, 'calendar_owner_unverified'],
  'missing trigger anchor': [f => { delete f.picker.__reactFiber$offline; }, 'current_chain_unverified'],
  'ambiguous trigger anchor': [f => { f.picker.__reactInternalInstance$alien = f.trigger; }, 'current_chain_unverified'],
  'uncommitted trigger': [f => { f.component.child = null; }, 'current_chain_unverified'],
  'incorrect root current': [f => { f.root.stateNode.current = {}; }, 'current_chain_unverified'],
  'cyclic sibling links': [f => { f.outer.sibling = f.outer; }, 'current_chain_unverified'],
  'uncommitted popup': [f => { f.portal.child = null; }, 'calendar_portal_owner_unverified'],
  'missing popup anchor': [f => { delete f.target.__reactFiber$offline; }, 'calendar_portal_owner_unverified'],
  'popup host stateNode mismatch': [f => { f.panelHost.stateNode = f.grid; }, 'calendar_portal_owner_unverified'],
  'portal missing from committed descendant path': [f => { f.portal.tag = 1; }, 'calendar_portal_owner_unverified'],
  'foreign portal container': [f => { f.portal.stateNode.containerInfo = f.doc.createElement('div'); }, 'calendar_portal_owner_unverified'],
  'popup sibling of trigger': [f => { f.component.child = f.portal; f.portal.sibling = f.trigger; f.trigger.child = null; f.portal.return = f.component; }, 'calendar_portal_owner_unverified'],
  'another visible popup': [f => { const alien = f.doc.createElement('div'); alien.className = 'ant-calendar-picker-container'; f.doc.body.appendChild(alien); }, 'calendar_portal_ambiguous'],
  'another grid': [f => { const alien = f.doc.createElement('div'); alien.className = 'ant-calendar'; f.target.appendChild(alien); }, 'calendar_portal_ambiguous'],
  'another month panel': [f => { const alien = f.doc.createElement('div'); alien.className = 'ant-calendar-month-panel'; f.grid.appendChild(alien); }, 'calendar_portal_ambiguous'],
  'eleven month cells': [f => { f.panel.querySelector('a').remove(); }, 'calendar_panel_shape_unsupported'],
  'thirteen month cells': [f => { const alien = f.doc.createElement('a'); alien.className = 'ant-calendar-month-panel-month'; f.panel.appendChild(alien); }, 'calendar_panel_shape_unsupported'],
  'hidden month cell': [f => { f.panel.querySelector('a').setAttribute('hidden', ''); }, 'calendar_panel_shape_unsupported'],
  'month cell under foreign form item': [f => { const alien = f.doc.createElement('div'); alien.className = 'ant-form-item'; f.panel.appendChild(alien); alien.appendChild(f.panel.querySelector('a')); }, 'calendar_panel_shape_unsupported'],
  'month cell under foreign named wrapper': [f => { const alien = f.doc.createElement('div'); alien.id = '13_43_0'; f.panel.appendChild(alien); alien.appendChild(f.panel.querySelector('a')); }, 'calendar_panel_shape_unsupported'],
  'portal under foreign form item': [f => { const alien = f.doc.createElement('div'); alien.className = 'ant-form-item'; f.doc.body.appendChild(alien); alien.appendChild(f.container); }, 'calendar_portal_owner_unverified'],
  'anchor getter': [f => { Object.defineProperty(f.picker, '__reactFiber$offline', { get() { throw Error('private'); } }); }, 'calendar_data_unavailable'],
  'containerInfo getter': [f => { Object.defineProperty(f.portal.stateNode, 'containerInfo', { get() { throw Error('private'); } }); }, 'calendar_data_unavailable']
};
for (const [name, [change, issue]] of Object.entries(rejects)) test(`reject ${name}`, t => {
  const f = fixture(t); change(f);
  const result = f.read();
  assert.equal(result.ok, false);
  assert.equal(result.calendarDefinitionIssue, issue);
  assert.equal(Object.hasOwn(result, 'calendarEvidenceSource'), false);
});

for (const hide of ['display:none', 'visibility:hidden ! important', 'content-visibility:hidden']) {
  test(`owned hidden portal is closed (${hide})`, t => {
    const f = fixture(t); f.container.setAttribute('style', hide);
    const result = f.read();
    assert.equal(result.calendarDefinitionIssue, 'calendar_portal_hidden');
    assert.equal(result.calendarPanelOwned, true);
    assert.equal(result.calendarPanelState, 'closed');
  });
}

test('a hidden foreign popup does not substitute for the committed visible portal', t => {
  const f = fixture(t);
  const alien = f.doc.createElement('div'); alien.className = 'ant-calendar-picker-container'; alien.setAttribute('hidden', '');
  f.doc.body.appendChild(alien);
  assert.equal(f.read().ok, true);
});

test('a visible foreign popup blocks routing even when the owned popup is hidden', t => {
  const f = fixture(t);
  f.target.setAttribute('hidden', '');
  const alien = f.doc.createElement('div'); alien.className = 'ant-calendar-picker-container'; f.doc.body.appendChild(alien);
  assert.equal(f.read().calendarDefinitionIssue, 'calendar_portal_owner_unverified');
});

test('date routing rejects foreign field boundaries inside the owned portal', t => {
  const f = fixture(t, 'date');
  const alien = f.doc.createElement('div'); alien.id = '13_43_0'; f.grid.appendChild(alien);
  alien.appendChild(f.grid.querySelector('.ant-calendar-date'));
  const result = f.read();
  assert.equal(result.ok, false);
  assert.equal(result.calendarDefinitionIssue, 'calendar_panel_shape_unsupported');
  assert.equal(Object.hasOwn(result, 'calendarPanelOwned'), false);
});

test('open action returns only the authenticated exact input with no visible popup', t => {
  const f = fixture(t, 'absent');
  assert.equal(f.read('open'), f.input);
  const alien = f.doc.createElement('div'); alien.className = 'ant-calendar-picker-container'; f.doc.body.appendChild(alien);
  assert.equal(f.read('open'), null);
  alien.remove();
  f.input.setAttribute('disabled', '');
  assert.equal(f.read('open'), null);
});

test('open action cannot bypass committed-trigger authentication', t => {
  const f = fixture(t, 'absent'); delete f.picker.__reactFiber$offline;
  assert.equal(f.read('open'), null);
});

test('month header action binds only a unique visible owned date-panel header', t => {
  const f = fixture(t, 'date');
  const header = f.grid.querySelector('.ant-calendar-month-select');
  assert.equal(f.read('month_header'), header);
  const alien = f.doc.createElement('a'); alien.className = 'ant-calendar-month-select'; alien.setAttribute('role', 'button');
  f.grid.appendChild(alien);
  assert.equal(f.read('month_header'), null);
  alien.remove(); header.setAttribute('hidden', '');
  assert.equal(f.read('month_header'), null);
});

test('month header cannot route from a month panel or foreign portal', t => {
  const f = fixture(t);
  assert.equal(f.read('month_header'), null);
  f.trigger.child = null;
  assert.equal(f.read('close_focus'), null);
  assert.equal(f.read('close_blank'), null);
});

test('close actions authenticate their targets before month-shape validation', t => {
  const f = fixture(t); f.panel.querySelector('a').remove();
  assert.equal(f.read('close_focus'), f.grid);
  const label = f.item.querySelector('.ant-form-item-label');
  assert.equal(f.read('close_blank'), label);
  f.target.setAttribute('hidden', '');
  assert.equal(f.read('close_focus'), null);
  assert.equal(f.read('close_blank'), null);
});

test('close-blank returns the exact static DIV rather than its linked label descendant', t => {
  const f = fixture(t);
  const label = f.item.querySelector('label'); label.setAttribute('for', 'private-input');
  const target = f.read('close_blank');
  assert.equal(target, f.item.querySelector('div.ant-form-item-label'));
  assert.notEqual(target, label);
  assert.equal(target.tagName, 'DIV');
  target.setAttribute('for', 'private-input');
  assert.equal(f.read('close_blank'), null, 'the target itself cannot carry for');
  target.removeAttribute('for');
  const button = f.doc.createElement('button'); label.appendChild(button);
  assert.equal(f.read('close_blank'), null);
});

test('close-blank refuses link descendants and a label element used as the target root', t => {
  const f = fixture(t);
  const target = f.item.querySelector('.ant-form-item-label');
  const link = f.doc.createElement('a'); target.appendChild(link);
  assert.equal(f.read('close_blank'), null, 'a link descendant is never an action target');
  link.remove();
  target.className = '';
  const label = f.item.querySelector('label'); label.className = 'ant-form-item-label'; label.setAttribute('for', 'private-input');
  assert.equal(f.read('close_blank'), null, 'only the static DIV can be returned');
});

test('unknown actions return null without interpreting arbitrary selectors', t => {
  const f = fixture(t);
  assert.equal(f.read('month_cell'), null);
});

function integrationFixture(t, kind) {
  const dom = new JSDOM('<!doctype html><body></body>', { url: ROW_D_PAGE,
    pretendToBeVisual: true, runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const doc = dom.window.document, f = syntheticPortal(doc, kind);
  doc.querySelector('label').textContent = ROW_D_FIELDS.find(field => field.key === 'englishExamDate').label;
  Object.defineProperty(doc, 'readyState', { value: 'complete' });
  const observer = new dom.window.MutationObserver(() => {});
  observer.observe(doc, { subtree: true, attributes: true, childList: true, characterData: true });
  t.after(() => observer.disconnect());
  const read = expression => {
    observer.takeRecords();
    const result = expression ? dom.window.eval(buildCmsRowDOptionsProbeExpression()) : inspectCmsRowDOptions(doc);
    assert.deepEqual(observer.takeRecords(), []);
    assert.deepEqual(f.effects, { reads: 0, writes: 0, interactions: 0 });
    const row = result.fields.find(field => field.key === 'englishExamDate');
    for (const flag of ['writeStarted', 'mutationAllowed', 'valuesExposed', 'liveSupportClaimed', 'livePassClaimed']) {
      assert.equal(row[flag], false);
    }
    assert.equal(row.neverSave, true);
    assert.equal(row.probeOnly, true);
    return row;
  };
  return { ...f, doc, read };
}

for (const expression of [false, true]) {
  test(`options integrates authenticated month portal without relabeling the picker (expression=${expression})`, t => {
    const f = integrationFixture(t, 'month'), row = f.read(expression);
    assert.equal(row.ok, true, JSON.stringify(row));
    assert.equal(row.reason, 'read_only_calendar_preflight');
    assert.equal(row.calendarStructureObserved, true);
    assert.equal(row.calendarFramework, 'react');
    assert.equal(row.calendarEvidenceSource, 'owned_react_portal');
    assert.equal(row.calendarPickerKind, 'unverified');
    assert.equal(row.calendarMode, 'month');
    assert.equal(row.calendarPanelKind, 'month');
    assert.equal(row.calendarCellCount, 12);
    for (const key of ['calendarFormat', 'calendarOpen', 'calendarDefinitionIssue', 'calendarPanelOwned', 'calendarPanelState']) {
      assert.equal(Object.hasOwn(row, key), false, key);
    }
    assert.equal(row.evidenceSource, 'metadata_only');
    assert.equal(row.optionsComplete, false);
  });

  for (const [name, kind, change] of [
    ['detached popup', 'month', f => { f.container.remove(); }],
    ['foreign portal', 'month', f => { f.trigger.child = null; }],
    ['date panel only', 'date', () => {}],
    ['date-only definition with no panel', 'absent', f => {
      f.component.type = function DatePicker() {};
      f.component.memoizedProps = { format: 'YYYY-MM-DD', picker: 'date' };
    }]
  ]) {
    test(`options rejects ${name} as month evidence (expression=${expression})`, t => {
      const f = integrationFixture(t, kind); change(f);
      const row = f.read(expression);
      assert.equal(row.ok, false);
      assert.equal(row.reason, 'calendar_live_evidence_missing');
      assert.equal(row.calendarStructureObserved, true);
      assert.equal(row.calendarFramework, 'react');
      assert.equal(Object.hasOwn(row, 'calendarEvidenceSource'), false);
      assert.equal(Object.hasOwn(row, 'calendarPickerKind'), false);
    });
  }
}

test('native Blink accepts current portal proof with throwOnSideEffect enabled', { timeout: 30000 }, async () => {
  const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  assert.ok(fs.existsSync(chrome), 'dedicated offline Chrome binary is installed');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-row-d-panel-blink-'));
  let child, session;
  try {
    child = spawn(chrome, ['--headless=new', '--disable-gpu', '--disable-background-networking', '--no-first-run',
      '--no-default-browser-check', '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost',
      '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    let port;
    for (let round = 0; round < 100 && !port; round += 1) {
      try { port = Number(fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split(/\r?\n/u)[0]); } catch {}
      if (!port) await new Promise(resolve => setTimeout(resolve, 60));
    }
    assert.ok(Number.isInteger(port) && port > 0 && ![9237, 9239, 9241, 9242].includes(port));
    const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(reply => reply.json());
    const pages = targets.filter(row => row.type === 'page' && row.url === 'about:blank');
    assert.equal(pages.length, 1);
    session = await connectCdp(pages[0].webSocketDebuggerUrl, { timeoutMs: 5000 });
    for (const kind of ['month', 'date', 'absent']) {
      await session.send('Runtime.evaluate', { expression: `globalThis.__panelFixture=(${syntheticPortal.toString()})(document,${JSON.stringify(kind)})` });
      await session.send('DOM.getDocument');
      const reply = await session.send('Runtime.evaluate', { expression: `(${inspectCmsRowDCalendarPanel.toString()})(document.querySelector('.ant-calendar-picker'),document.querySelector('input'),document.querySelector('.ant-form-item'),document)`,
        returnByValue: true, throwOnSideEffect: true, awaitPromise: false, userGesture: false, timeout: 5000 });
      assert.equal(reply.exceptionDetails, undefined, JSON.stringify(reply.exceptionDetails));
      assert.equal(reply.result.value.ok, kind === 'month', JSON.stringify(reply.result.value));
      assert.equal(reply.result.value.calendarPanelState, kind === 'absent' ? 'closed' : kind);
      const effects = await session.send('Runtime.evaluate', { expression: 'globalThis.__panelFixture.effects', returnByValue: true });
      assert.deepEqual(effects.result.value, { reads: 0, writes: 0, interactions: 0 });
      const actions = kind === 'absent' ? ['open'] : kind === 'date' ? ['month_header', 'close_blank'] : ['close_focus', 'close_blank'];
      for (const action of actions) {
        const actionReply = await session.send('Runtime.evaluate', { expression: `(${inspectCmsRowDCalendarPanel.toString()})(document.querySelector('.ant-calendar-picker'),document.querySelector('input'),document.querySelector('.ant-form-item'),document,${JSON.stringify(action)})`,
          returnByValue: false, throwOnSideEffect: true, awaitPromise: false, userGesture: false, timeout: 5000 });
        assert.equal(actionReply.exceptionDetails, undefined, JSON.stringify(actionReply.exceptionDetails));
        assert.equal(actionReply.result.subtype, 'node');
        const nodeReply = await session.send('DOM.requestNode', { objectId: actionReply.result.objectId });
        assert.ok(Number.isInteger(nodeReply.nodeId) && nodeReply.nodeId > 0);
      }
    }
    const refused = await session.send('Runtime.evaluate', { expression: "document.body.setAttribute('data-forbidden','write')", throwOnSideEffect: true });
    assert.ok(refused.exceptionDetails);
  } finally {
    try { await session?.send('Browser.close'); } catch {}
    session?.close();
    if (child && child.exitCode === null) child.kill();
    // Verify the exact created temp directory before recursive cleanup.
    const resolved = path.resolve(profile);
    if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('cms-row-d-panel-blink-')) {
      try { fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 }); } catch {}
    }
  }
});
