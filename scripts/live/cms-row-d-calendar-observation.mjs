/** Explicit opt-in popup observation. All page reads stay strict; only the
 * authenticated trigger, month header and static label can receive clicks.
 * No month/date cell, selected value, input write or save is involved.
 */
import { inspectCmsRowDCalendarPanel } from '../lib/cms-row-d-calendar-panel.mjs';

export function buildCmsRowDCalendarPanelExpression(action = 'evidence') {
  if (!['evidence', 'open', 'month_header', 'close_focus', 'close_blank'].includes(action)) {
    throw new TypeError('calendar_action_invalid');
  }
  return `(() => {
    const inspect = ${inspectCmsRowDCalendarPanel.toString()};
    const doc = globalThis.document;
    const wrapper = doc.querySelector('[id="16_65_0"]');
    const item = wrapper && wrapper.querySelector('.ant-form-item');
    const picker = item && item.querySelector('.ant-calendar-picker,.ant-picker');
    const input = picker && picker.querySelector('input');
    return inspect(picker, input, item, doc, ${JSON.stringify(action)});
  })()`;
}

export async function observeCmsRowDCalendarPanel({ session, read, readInspection,
  contextReady, guardReady, nonGetCount, wait, commandFailure = () => {} }) {
  const observation = { enabled: true, status: 'not_started', interactionStarted: false,
    triggerClicked: false, monthHeaderClicked: false, escapeSent: false,
    staticLabelClicked: false, panelClosed: false };
  const initialTraffic = nonGetCount();
  let candidate;
  let finalInspection;
  let documentRequested = false;
  const send = async (method, params) => {
    try { return await session.send(method, params); }
    catch (error) { commandFailure(method, error); throw error; }
  };
  const available = cleanup => contextReady() && (cleanup || (guardReady() && nonGetCount() === initialTraffic));
  const ensure = cleanup => { if (!available(cleanup)) throw new Error('calendar_guard_blocked'); };
  const evaluate = async (action, byValue = true, cleanup = false) => {
    ensure(cleanup);
    const reply = await read(buildCmsRowDCalendarPanelExpression(action), byValue);
    if (reply?.exceptionDetails || !reply?.result) throw new Error('calendar_strict_read_failed');
    ensure(cleanup);
    return reply.result;
  };
  const snapshot = async (cleanup = false) => {
    const result = (await evaluate('evidence', true, cleanup)).value;
    if (!result || typeof result.ok !== 'boolean') throw new Error('calendar_strict_read_failed');
    return result;
  };
  const withTarget = async (action, callback, cleanup = false) => {
    const result = await evaluate(action, false, cleanup);
    if (result.subtype !== 'node' || typeof result.objectId !== 'string') throw new Error('calendar_action_refused');
    try {
      // Repeating getDocument invalidates previously issued frontend node IDs.
      if (!documentRequested) {
        await send('DOM.getDocument', { depth: 0 });
        documentRequested = true;
      }
      const { nodeId } = await send('DOM.requestNode', { objectId: result.objectId });
      if (!Number.isInteger(nodeId) || nodeId <= 0) throw new Error('calendar_action_refused');
      ensure(cleanup);
      return await callback(nodeId);
    } finally {
      await send('Runtime.releaseObject', { objectId: result.objectId });
    }
  };
  const click = async (action, cleanup = false) => withTarget(action, async nodeId => {
    await send('DOM.scrollIntoViewIfNeeded', { nodeId });
    // Re-authenticate after scrolling; do not click a detached or replaced host.
    await withTarget(action, async currentId => {
      if (currentId !== nodeId) throw new Error('calendar_action_refused');
      const { model } = await send('DOM.getBoxModel', { nodeId });
      const quad = model?.content;
      if (!Array.isArray(quad) || quad.length !== 8 || !quad.every(Number.isFinite)) throw new Error('calendar_action_refused');
      const x = (quad[0] + quad[2] + quad[4] + quad[6]) / 4;
      const y = (quad[1] + quad[3] + quad[5] + quad[7]) / 4;
      const metrics = await send('Page.getLayoutMetrics');
      const viewport = metrics?.cssVisualViewport;
      if (!viewport || ![viewport.pageX, viewport.pageY, viewport.clientWidth, viewport.clientHeight].every(Number.isFinite)
        || viewport.scale !== 1 || x < 0 || y < 0 || x >= viewport.clientWidth || y >= viewport.clientHeight) {
        throw new Error('calendar_action_refused');
      }
      // Blink hit testing uses document CSS coordinates; Input uses viewport
      // CSS coordinates. A covering element must never receive this click.
      const hit = await send('DOM.getNodeForLocation', {
        x: Math.round(x + viewport.pageX), y: Math.round(y + viewport.pageY) });
      const { node } = await send('DOM.describeNode', { nodeId, depth: 0 });
      if (!Number.isInteger(node?.backendNodeId) || hit?.backendNodeId !== node.backendNodeId) {
        throw new Error('calendar_action_refused');
      }
      ensure(cleanup);
      observation.interactionStarted = true;
      try {
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      } finally {
        // Release even if the press acknowledgement is lost.
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
      }
    }, cleanup);
  }, cleanup);
  const settledSnapshot = async cleanup => { await wait(150); return snapshot(cleanup); };
  try {
    let current = await snapshot();
    // Leave a pre-existing popup alone; this run only owns its own lifecycle.
    if (current.calendarPanelState !== 'closed' || current.calendarDefinitionIssue !== 'calendar_portal_hidden') {
      observation.status = 'preexisting_or_unverified_panel';
      return { observation };
    }
    await click('open');
    observation.triggerClicked = true;
    current = await settledSnapshot(false);
    if (current.calendarPanelOwned !== true) throw new Error('calendar_action_refused');
    if (current.calendarPanelState === 'date') {
      await click('month_header');
      observation.monthHeaderClicked = true;
      current = await settledSnapshot(false);
    }
    if (!current.ok || current.calendarPanelState !== 'month') throw new Error('calendar_action_refused');
    ensure(false);
    candidate = await readInspection();
    ensure(false);
    observation.status = 'observed';
  } catch (error) {
    observation.status = ['calendar_guard_blocked', 'calendar_strict_read_failed', 'calendar_action_refused'].includes(error?.message)
      ? error.message.slice('calendar_'.length) : 'command_failed';
  } finally {
    if (observation.interactionStarted) {
      try {
        let current = await snapshot(true);
        if (current.calendarPanelState !== 'closed') {
          // Focus the owned calendar root so Escape reaches its key handler.
          let focused = false;
          try {
            await withTarget('close_focus', nodeId => send('DOM.focus', { nodeId }), true);
            focused = true;
          } catch { /* A separately authenticated static-label fallback remains possible. */ }
          if (focused) {
            ensure(true);
            try {
              await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape',
                windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
            } finally {
              await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape',
                windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
            }
            observation.escapeSent = true;
          }
          current = await settledSnapshot(true);
          if (current.calendarPanelState !== 'closed') {
            await click('close_blank', true);
            observation.staticLabelClicked = true;
            current = await settledSnapshot(true);
          }
        }
        observation.panelClosed = current.calendarPanelState === 'closed'
          && current.calendarDefinitionIssue === 'calendar_portal_hidden';
      } catch {
        // Scrolling to a close target can itself dismiss rc-trigger. A stale
        // action is still refused; only a fresh strict read can confirm close.
        try {
          const current = await snapshot(true);
          observation.panelClosed = current.calendarPanelState === 'closed'
            && current.calendarDefinitionIssue === 'calendar_portal_hidden';
        } catch { observation.panelClosed = false; }
      }
      await wait(250);
      if (!observation.panelClosed) observation.status = 'cleanup_failed';
      else if (!available(false)) observation.status = 'guard_blocked';
      else if (observation.status === 'observed') {
        try { finalInspection = await readInspection(); }
        catch { observation.status = 'strict_read_failed'; }
        if (!available(false)) observation.status = 'guard_blocked';
      }
    }
    if (documentRequested) {
      try { await send('DOM.disable'); }
      catch { observation.status = 'command_failed'; }
    }
  }
  return { observation, ...(observation.status === 'observed' && observation.panelClosed
    ? { inspection: candidate, finalInspection } : {}) };
}
