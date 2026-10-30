/** Offline CDP lifecycle contracts only. These fakes never attach to a browser,
 * expose selected dates, establish live support, or authorize a new booking.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCmsRowDCalendarPanelExpression,
  observeCmsRowDCalendarPanel
} from '../scripts/live/cms-row-d-calendar-observation.mjs';

const PRIVATE = 'OFFLINE_PRIVATE_CALENDAR_VALUE_DO_NOT_EXPOSE';
const ACTIONS = ['evidence', 'open', 'month_header', 'close_focus', 'close_blank'];
const expressions = new Map(ACTIONS.map(action => [buildCmsRowDCalendarPanelExpression(action), action]));
const nodes = { open: 10, month_header: 20, close_focus: 30, close_blank: 40 };
const actionFor = node => Object.keys(nodes).find(action => nodes[action] === node);
const backend = node => 1000 + node;
const center = node => ({ x: node * 2 + 10, y: 55 });
const closed = () => ({ ok: false, calendarFramework: 'react',
  calendarDefinitionIssue: 'calendar_portal_hidden', calendarPanelState: 'closed' });

function fixture(options = {}) {
  const state = { panel: options.initialPanel || 'closed', traffic: 0,
    context: options.context !== false, guard: true, reads: [], commands: [],
    clicks: [], waits: [], inspectionReads: 0, targets: new Map(), releases: [],
    pressedNode: null, lastBoxNode: null, commandFailures: [] };
  const candidate = { syntheticInspection: true, fields: [{ key: 'englishExamDate',
    calendarPickerKind: 'unverified', calendarPanelKind: 'month', calendarCellCount: 12 }] };
  const finalInspection = { syntheticInspection: true, fields: [{ key: 'englishExamDate',
    calendarDefinitionIssue: 'calendar_portal_hidden' }] };
  const counts = new Map();
  const snapshot = () => state.panel === 'closed' ? closed()
    : state.panel === 'date' ? { ok: false, calendarPanelOwned: true,
      calendarPanelState: 'date', calendarDefinitionIssue: 'calendar_panel_shape_unsupported' }
      : { ok: true, calendarPanelOwned: true, calendarPanelState: 'month',
        calendarPickerKind: 'unverified', calendarPanelKind: 'month', calendarCellCount: 12 };
  const read = async (expression, byValue) => {
    const action = expressions.get(expression);
    assert.ok(action, 'the controller reads only the fixed authenticated expressions');
    assert.equal(byValue, action === 'evidence');
    const count = (counts.get(action) || 0) + 1;
    counts.set(action, count);
    state.reads.push({ action, byValue, panel: state.panel });
    const override = options.onRead?.({ action, count, state });
    if (override !== undefined) return override;
    if (action === 'evidence') return { result: { value: snapshot() } };
    if (options.refuseAction === action) return { result: { subtype: 'null', value: null } };
    const appropriate = action === 'open' ? state.panel === 'closed'
      : action === 'month_header' ? state.panel === 'date' : state.panel !== 'closed';
    assert.ok(appropriate, `${action} must match the current fake panel lifecycle`);
    const objectId = `offline-calendar-${action}-${count}`;
    const node = options.replaceAction === action && count > 1 ? nodes[action] + 1 : nodes[action];
    state.targets.set(objectId, node);
    return { result: { subtype: 'node', objectId } };
  };
  const session = { async send(method, params = {}) {
    state.commands.push({ method, params: structuredClone(params) });
    switch (method) {
      case 'DOM.getDocument':
        assert.deepEqual(params, { depth: 0 });
        return { root: { nodeId: 1 } };
      case 'DOM.disable':
        if (options.disableThrows) throw Error(PRIVATE);
        return {};
      case 'DOM.requestNode':
        assert.ok(state.targets.has(params.objectId));
        return { nodeId: state.targets.get(params.objectId) };
      case 'Runtime.releaseObject':
        assert.ok(state.targets.has(params.objectId));
        state.releases.push(params.objectId);
        return {};
      case 'DOM.scrollIntoViewIfNeeded':
        assert.ok(actionFor(params.nodeId));
        return {};
      case 'DOM.getBoxModel': {
        assert.ok(actionFor(params.nodeId));
        state.lastBoxNode = params.nodeId;
        const point = center(params.nodeId);
        return { model: { content: options.badQuad ? [NaN] : [point.x - 5, 50,
          point.x + 5, 50, point.x + 5, 60, point.x - 5, 60] } };
      }
      case 'Page.getLayoutMetrics':
        return { cssVisualViewport: { pageX: 7, pageY: 900,
          clientWidth: 800, clientHeight: 600, scale: options.scale || 1 } };
      case 'DOM.getNodeForLocation': {
        const point = center(state.lastBoxNode);
        assert.deepEqual(params, { x: point.x + 7, y: point.y + 900 },
          'hit testing receives document coordinates, including scroll offsets');
        const overlay = options.overlayAction === actionFor(state.lastBoxNode);
        return { backendNodeId: overlay ? 9999 : backend(state.lastBoxNode), frameId: 'offline-frame' };
      }
      case 'DOM.describeNode':
        assert.equal(params.depth, 0);
        return { node: { backendNodeId: backend(params.nodeId) } };
      case 'DOM.focus':
        assert.equal(params.nodeId, nodes.close_focus);
        if (options.focusThrows) throw Error(PRIVATE);
        return {};
      case 'Input.dispatchMouseEvent': {
        const node = params.type === 'mousePressed' ? state.lastBoxNode : state.pressedNode;
        const action = actionFor(node);
        assert.ok(['open', 'month_header', 'close_blank'].includes(action),
          'a month/day cell or arbitrary node can never receive a click');
        assert.deepEqual({ x: params.x, y: params.y }, center(node),
          'mouse input keeps viewport coordinates');
        assert.equal(params.button, 'left');
        assert.equal(params.clickCount, 1);
        if (params.type === 'mousePressed') {
          assert.equal(state.pressedNode, null);
          state.pressedNode = node;
          if (options.lostPressAction === action) throw Error(PRIVATE);
          return {};
        }
        assert.equal(params.type, 'mouseReleased');
        state.pressedNode = null;
        state.clicks.push(action);
        if (action === 'open') state.panel = options.openPanel || 'date';
        else if (action === 'month_header') state.panel = 'month';
        else if (!options.blankDoesNotClose) state.panel = 'closed';
        if (options.trafficAction === action) state.traffic += 1;
        if (options.invalidateAction === action) state.context = false;
        if (options.blockGuardAction === action) state.guard = false;
        return {};
      }
      case 'Input.dispatchKeyEvent':
        assert.ok(['rawKeyDown', 'keyUp'].includes(params.type));
        assert.equal(params.key, 'Escape');
        assert.equal(params.code, 'Escape');
        assert.equal(params.windowsVirtualKeyCode, 27);
        assert.equal(params.nativeVirtualKeyCode, 27);
        if (params.type === 'rawKeyDown' && options.lostEscapeAck) throw Error(PRIVATE);
        if (params.type === 'keyUp' && options.escapeCloses !== false) state.panel = 'closed';
        return {};
      default:
        assert.fail(`unexpected command ${method}: no evaluation, setters, text insertion, or save`);
    }
  } };
  const run = () => observeCmsRowDCalendarPanel({ session, read,
    readInspection: async () => {
      state.inspectionReads += 1;
      options.onInspection?.(state);
      assert.equal(state.panel, state.inspectionReads === 1 ? 'month' : 'closed',
        'capture and final fresh inspection occur in their respective panel states');
      return state.inspectionReads === 1 ? candidate : finalInspection;
    }, contextReady: () => state.context, guardReady: () => state.guard,
    nonGetCount: () => state.traffic,
    commandFailure(method) { state.commandFailures.push(method); state.guard = false; },
    wait: async ms => {
      state.waits.push(ms);
      options.onWait?.(ms, state);
    } });
  return { state, candidate, finalInspection, run };
}

function assertNoCandidate(result) {
  assert.equal(Object.hasOwn(result, 'inspection'), false);
  assert.equal(Object.hasOwn(result, 'finalInspection'), false);
  assert.equal(JSON.stringify(result).includes(PRIVATE), false);
}

test('fixed expression builder refuses arbitrary actions and contains no page interaction', () => {
  assert.equal(expressions.size, ACTIONS.length);
  for (const action of ACTIONS) {
    const expression = buildCmsRowDCalendarPanelExpression(action);
    assert.ok(expression.includes('return inspect(picker, input, item, doc,'));
    assert.doesNotMatch(expression, /\.(?:click|focus|blur|dispatchEvent|setAttribute|remove|appendChild)\s*\(/u);
    assert.doesNotMatch(expression, /\.(?:checked|selectedValue|textContent|innerHTML|innerText)\b/u);
    assert.doesNotMatch(expression, /\b(?:picker|input|node|cell)\.value\b/u);
  }
  for (const action of ['select_month', 'save', 'value', '', null, {}, ['open']]) {
    assert.throws(() => buildCmsRowDCalendarPanelExpression(action), /calendar_action_invalid/u);
  }
});

test('owned date panel switches through its header, captures month proof, and closes with Escape', async () => {
  const f = fixture();
  const result = await f.run();
  assert.equal(result.inspection, f.candidate);
  assert.equal(result.finalInspection, f.finalInspection);
  assert.equal(result.observation.status, 'observed');
  assert.equal(result.observation.triggerClicked, true);
  assert.equal(result.observation.monthHeaderClicked, true);
  assert.equal(result.observation.escapeSent, true);
  assert.equal(result.observation.staticLabelClicked, false);
  assert.equal(result.observation.panelClosed, true);
  assert.deepEqual(f.state.clicks, ['open', 'month_header']);
  assert.equal(f.state.inspectionReads, 2);
  assert.equal(f.state.panel, 'closed');
  assert.equal(f.state.pressedNode, null);
  assert.deepEqual(new Set(f.state.releases), new Set(f.state.targets.keys()));
  assert.deepEqual(f.state.commandFailures, []);
  assert.equal(f.state.commands.filter(row => row.method === 'DOM.getDocument').length, 1);
  assert.equal(f.state.commands.at(-1).method, 'DOM.disable');
});

test('a directly opened month panel requires no date-header interaction', async () => {
  const f = fixture({ openPanel: 'month' });
  const result = await f.run();
  assert.equal(result.observation.status, 'observed');
  assert.equal(result.observation.monthHeaderClicked, false);
  assert.deepEqual(f.state.clicks, ['open']);
  assert.equal(f.state.reads.some(row => row.action === 'month_header'), false);
  assert.equal(result.inspection, f.candidate);
});

for (const focusThrows of [false, true]) test(`static label closes when Escape leaves the popup open (focus rejects=${focusThrows})`, async () => {
  const f = fixture({ escapeCloses: false, focusThrows });
  const result = await f.run();
  assert.equal(result.observation.status, focusThrows ? 'guard_blocked' : 'observed');
  assert.equal(result.observation.staticLabelClicked, true);
  assert.equal(result.observation.panelClosed, true);
  assert.deepEqual(f.state.clicks, ['open', 'month_header', 'close_blank']);
  if (focusThrows) {
    assertNoCandidate(result);
    assert.equal(result.observation.escapeSent, false);
    assert.deepEqual(f.state.commandFailures, ['DOM.focus']);
  } else assert.equal(result.inspection, f.candidate);
});

test('delayed Escape closure refuses the stale static label and passes only after a fresh closed snapshot', async () => {
  const f = fixture({ escapeCloses: false, onRead({ action, state }) {
    if (action === 'close_blank') {
      // Escape takes effect after its first settled read, before fallback target authentication.
      state.panel = 'closed';
      return { result: { subtype: 'null', value: null } };
    }
  } });
  const result = await f.run();
  assert.equal(result.observation.status, 'observed');
  assert.equal(result.observation.escapeSent, true);
  assert.equal(result.observation.staticLabelClicked, false);
  assert.equal(result.observation.panelClosed, true);
  assert.deepEqual(f.state.clicks, ['open', 'month_header']);
  const fallbackIndex = f.state.reads.findIndex(row => row.action === 'close_blank');
  assert.ok(fallbackIndex >= 0);
  assert.deepEqual(f.state.reads[fallbackIndex + 1], { action: 'evidence', byValue: true, panel: 'closed' });
  assert.equal(f.state.inspectionReads, 2);
  assert.equal(result.inspection, f.candidate);
  assert.equal(result.finalInspection, f.finalInspection);
  assert.deepEqual(f.state.commandFailures, []);
});

for (const action of ['open', 'month_header']) test(`non-GET traffic after ${action} withholds proof but keeps cleanup guarded`, async () => {
  const f = fixture({ trafficAction: action });
  const result = await f.run();
  assert.equal(result.observation.status, 'guard_blocked');
  assert.equal(result.observation.panelClosed, true);
  assert.equal(f.state.inspectionReads, 0);
  assert.deepEqual(f.state.clicks, action === 'open' ? ['open'] : ['open', 'month_header']);
  assert.equal(f.state.panel, 'closed');
  assertNoCandidate(result);
});

test('a pending guard failure stops observations while still allowing owned close cleanup', async () => {
  const f = fixture({ blockGuardAction: 'open', escapeCloses: false });
  const result = await f.run();
  assert.equal(result.observation.status, 'guard_blocked');
  assert.equal(result.observation.panelClosed, true);
  assert.deepEqual(f.state.clicks, ['open', 'close_blank']);
  assert.equal(f.state.inspectionReads, 0);
  assertNoCandidate(result);
});

test('traffic during the full inspection invalidates even an already captured candidate', async () => {
  const f = fixture({ onInspection(state) { state.traffic += 1; } });
  const result = await f.run();
  assert.equal(f.state.inspectionReads, 1);
  assert.equal(result.observation.status, 'guard_blocked');
  assert.equal(result.observation.panelClosed, true);
  assertNoCandidate(result);
});

test('a rejected final fresh inspection cannot reuse the earlier successful panel snapshot', async () => {
  const f = fixture({ onInspection(state) {
    if (state.inspectionReads === 2) throw Error(PRIVATE);
  } });
  const result = await f.run();
  assert.equal(f.state.inspectionReads, 2);
  assert.equal(result.observation.status, 'strict_read_failed');
  assert.equal(result.observation.panelClosed, true);
  assert.equal(f.state.commands.at(-1).method, 'DOM.disable');
  assertNoCandidate(result);
});

test('traffic during final fresh inspection invalidates both returned snapshots', async () => {
  const f = fixture({ onInspection(state) {
    if (state.inspectionReads === 2) state.traffic += 1;
  } });
  const result = await f.run();
  assert.equal(f.state.inspectionReads, 2);
  assert.equal(result.observation.status, 'guard_blocked');
  assert.equal(result.observation.panelClosed, true);
  assertNoCandidate(result);
});

test('late traffic in the cleanup monitoring window invalidates month proof', async () => {
  const f = fixture({ onWait(ms, state) { if (ms === 250) state.traffic += 1; } });
  const result = await f.run();
  assert.equal(result.observation.status, 'guard_blocked');
  assert.equal(result.observation.panelClosed, true);
  assertNoCandidate(result);
});

for (const action of ['open', 'month_header']) test(`context invalidation after ${action} prevents further input through the old context`, async () => {
  const f = fixture({ invalidateAction: action });
  const result = await f.run();
  assert.equal(result.observation.status, 'cleanup_failed');
  assert.equal(result.observation.panelClosed, false);
  assert.equal(f.state.commands.some(row => row.method === 'Input.dispatchKeyEvent'), false);
  assert.deepEqual(f.state.clicks, action === 'open' ? ['open'] : ['open', 'month_header']);
  assertNoCandidate(result);
});

test('an invalid context at entry refuses even the initial read and all input', async () => {
  const f = fixture({ context: false });
  const result = await f.run();
  assert.equal(result.observation.status, 'guard_blocked');
  assert.equal(f.state.reads.length, 0);
  assert.equal(f.state.commands.length, 0);
  assertNoCandidate(result);
});

test('strict evaluation rejection at entry causes no interaction or permissive retry', async () => {
  const f = fixture({ onRead() { return { exceptionDetails: { text: PRIVATE } }; } });
  const result = await f.run();
  assert.equal(result.observation.status, 'strict_read_failed');
  assert.equal(result.observation.interactionStarted, false);
  assert.equal(f.state.reads.length, 1);
  assert.equal(f.state.commands.length, 0);
  assertNoCandidate(result);
});

test('a failed strict read after opening still closes without collecting full field proof', async () => {
  const f = fixture({ onRead({ action, count }) {
    if (action === 'evidence' && count === 2) return { exceptionDetails: { text: PRIVATE } };
  } });
  const result = await f.run();
  assert.equal(result.observation.status, 'strict_read_failed');
  assert.equal(result.observation.panelClosed, true);
  assert.deepEqual(f.state.clicks, ['open']);
  assert.equal(f.state.inspectionReads, 0);
  assertNoCandidate(result);
});

for (const action of ['open', 'month_header']) test(`a covering element at ${action} prevents dispatch to that point`, async () => {
  const f = fixture({ overlayAction: action });
  const result = await f.run();
  assert.equal(result.observation.status, 'action_refused');
  assert.deepEqual(f.state.clicks, action === 'open' ? [] : ['open']);
  assert.equal(f.state.inspectionReads, 0);
  assert.equal(result.observation.interactionStarted, action !== 'open');
  assertNoCandidate(result);
});

test('a target replaced during scroll cannot receive a click', async () => {
  const f = fixture({ replaceAction: 'open' });
  const result = await f.run();
  assert.equal(result.observation.status, 'action_refused');
  assert.equal(f.state.clicks.length, 0);
  assert.equal(f.state.commands.some(row => row.method === 'Input.dispatchMouseEvent'), false);
  assertNoCandidate(result);
});

for (const options of [{ badQuad: true }, { scale: 2 }, { refuseAction: 'open' }]) {
  test(`invalid or refused click geometry stays inert (${JSON.stringify(options)})`, async () => {
    const f = fixture(options);
    const result = await f.run();
    assert.equal(result.observation.status, 'action_refused');
    assert.equal(result.observation.interactionStarted, false);
    assert.equal(f.state.clicks.length, 0);
    assertNoCandidate(result);
  });
}

test('failed popup cleanup withholds otherwise complete month evidence', async () => {
  const f = fixture({ escapeCloses: false, blankDoesNotClose: true });
  const result = await f.run();
  assert.equal(f.state.inspectionReads, 1);
  assert.equal(result.observation.status, 'cleanup_failed');
  assert.equal(result.observation.panelClosed, false);
  assert.deepEqual(f.state.clicks, ['open', 'month_header', 'close_blank']);
  assertNoCandidate(result);
});

test('a covered static label is never clicked and failed cleanup cannot pass', async () => {
  const f = fixture({ escapeCloses: false, overlayAction: 'close_blank' });
  const result = await f.run();
  assert.equal(result.observation.status, 'cleanup_failed');
  assert.equal(result.observation.staticLabelClicked, false);
  assert.deepEqual(f.state.clicks, ['open', 'month_header']);
  assertNoCandidate(result);
});

test('an unverified focus target receives no Escape and uses only the authenticated static label', async () => {
  const f = fixture({ refuseAction: 'close_focus', escapeCloses: false });
  const result = await f.run();
  assert.equal(result.observation.status, 'observed');
  assert.equal(result.observation.escapeSent, false);
  assert.equal(result.observation.staticLabelClicked, true);
  assert.equal(f.state.commands.some(row => row.method === 'Input.dispatchKeyEvent'), false);
  assert.deepEqual(f.state.clicks, ['open', 'month_header', 'close_blank']);
  assert.equal(result.inspection, f.candidate);
});

test('failure to disable the requested DOM domain is reported and withholds complete proof', async () => {
  const f = fixture({ disableThrows: true });
  const result = await f.run();
  assert.equal(f.state.inspectionReads, 2);
  assert.equal(result.observation.status, 'command_failed');
  assert.equal(result.observation.panelClosed, true);
  assert.deepEqual(f.state.commandFailures, ['DOM.disable']);
  assertNoCandidate(result);
});

test('lost mouse press acknowledgment always releases the button and closes the resulting popup', async () => {
  const f = fixture({ lostPressAction: 'open' });
  const result = await f.run();
  const mouse = f.state.commands.filter(row => row.method === 'Input.dispatchMouseEvent');
  assert.deepEqual(mouse.map(row => row.params.type), ['mousePressed', 'mouseReleased']);
  assert.equal(f.state.pressedNode, null);
  assert.equal(result.observation.interactionStarted, true);
  assert.equal(result.observation.triggerClicked, false);
  assert.equal(result.observation.panelClosed, true);
  assert.equal(result.observation.status, 'guard_blocked');
  assert.deepEqual(f.state.commandFailures, ['Input.dispatchMouseEvent']);
  assertNoCandidate(result);
});

test('lost Escape acknowledgment still releases the key and cannot authorize evidence', async () => {
  const f = fixture({ lostEscapeAck: true, escapeCloses: false });
  const result = await f.run();
  assert.deepEqual(f.state.commands.filter(row => row.method === 'Input.dispatchKeyEvent')
    .map(row => row.params.type), ['rawKeyDown', 'keyUp']);
  assert.equal(result.observation.status, 'cleanup_failed');
  assertNoCandidate(result);
});

for (const panel of ['date', 'month']) test(`a pre-existing ${panel} popup receives no input or cleanup`, async () => {
  const f = fixture({ initialPanel: panel });
  const result = await f.run();
  assert.equal(result.observation.status, 'preexisting_or_unverified_panel');
  assert.equal(result.observation.interactionStarted, false);
  assert.deepEqual(f.state.reads.map(row => row.action), ['evidence']);
  assert.equal(f.state.commands.length, 0);
  assert.equal(f.state.panel, panel);
  assertNoCandidate(result);
});

test('an unverified closed-panel result cannot authorize an open', async () => {
  const f = fixture({ onRead() { return { result: { value: { ok: false,
    calendarPanelState: 'closed', calendarDefinitionIssue: 'calendar_portal_owner_unverified' } } }; } });
  const result = await f.run();
  assert.equal(result.observation.status, 'preexisting_or_unverified_panel');
  assert.equal(f.state.commands.length, 0);
  assertNoCandidate(result);
});
