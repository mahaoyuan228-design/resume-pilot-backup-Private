/**
 * Shape-only evidence for Row D's current React calendar portal. Unlike the
 * MonthPicker definition inspector, this proves only an observed month panel;
 * it does not identify the trigger as a MonthPicker or inspect selected dates.
 * Self-contained for strict debug-evaluate. No opens, events or value reads.
 * Optional fixed actions return an authenticated DOM target (or null) only;
 * the guarded live controller owns any actual browser input and cleanup.
 */
export function inspectCmsRowDCalendarPanel(picker, input, item, doc, action = 'evidence') {
  const reject = (issue, extra) => {
    if (action !== 'evidence') return null;
    const result = { ok: false, calendarFramework: 'react', calendarDefinitionIssue: issue };
    if (extra) {
      if (extra.calendarPanelOwned === true) result.calendarPanelOwned = true;
      if (extra.calendarPanelState) result.calendarPanelState = extra.calendarPanelState;
    }
    return result;
  };
  if (!['evidence', 'open', 'month_header', 'close_focus', 'close_blank'].includes(action)) return null;
  const own = (object, key) => {
    if (!object || (typeof object !== 'object' && typeof object !== 'function')) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (!descriptor) return undefined;
    if (!Object.hasOwn(descriptor, 'value')) throw new TypeError();
    return descriptor.value;
  };
  const list = collection => {
    const result = [];
    if (!Number.isSafeInteger(collection.length) || collection.length < 0 || collection.length > 10000) throw new TypeError();
    for (let index = 0; index < collection.length; index += 1) result.push(collection[index]);
    return result;
  };
  try {
    const selectors = [], snapshots = [];
    const matches = (node, selector) => {
      let index = selectors.indexOf(selector);
      if (index < 0) {
        index = selectors.length;
        selectors.push(selector);
        snapshots.push(list(doc.querySelectorAll(selector)));
      }
      return snapshots[index].includes(node);
    };
    const closest = (node, selector) => {
      const seen = [];
      for (let current = node; current; current = current.parentElement) {
        if (seen.includes(current) || seen.length >= 128) throw new TypeError();
        seen.push(current);
        if (matches(current, selector)) return current;
      }
      return null;
    };
    const wrapperFor = node => closest(node, '[id="16_65_0"]');
    const namedWrapperFor = node => {
      const seen = [];
      for (let current = node; current; current = current.parentElement) {
        if (seen.includes(current) || seen.length >= 128) throw new TypeError();
        seen.push(current);
        if (/^\d+_\d+_\d+$/u.test(current.getAttribute('id') || '')) return current;
      }
      return null;
    };
    const visible = node => {
      const seen = [];
      for (let current = node; current; current = current.parentElement) {
        if (seen.includes(current) || seen.length >= 128) throw new TypeError();
        seen.push(current);
        const style = (current.getAttribute('style') || '').replace(/\/\*[\s\S]*?\*\//gu, '');
        if (current.hasAttribute('hidden') || current.hasAttribute('inert')
          || current.getAttribute('aria-hidden') === 'true'
          || style.split(';').some(declaration => /^\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:\s*hidden)\s*(?:!\s*important\s*)?$/iu.test(declaration))
          || matches(current, '.ant-calendar-picker-container-hidden,.ant-picker-dropdown-hidden,.ant-collapse-content-inactive,details:not([open])')) return false;
      }
      return true;
    };
    if (!picker || !input || !item || !doc || !picker.isConnected || !input.isConnected
      || !item.contains(picker) || !picker.contains(input)) return reject('calendar_owner_unverified');
    const wrappers = list(doc.querySelectorAll('[id="16_65_0"]'));
    const sections = list(doc.querySelectorAll('[id="16"]'));
    const wrapper = wrappers[0], section = sections[0];
    if (wrappers.length !== 1 || sections.length !== 1 || !matches(section, '.form-cell')
      || !wrapper.contains(item) || closest(wrapper, '.form-cell') !== section
      || closest(item, '.form-cell') !== section || closest(picker, '.ant-form-item') !== item
      || closest(input, '.ant-form-item') !== item || wrapperFor(picker) !== wrapper
      || namedWrapperFor(picker) !== wrapper || namedWrapperFor(input) !== wrapper
      || list(wrapper.querySelectorAll('.ant-form-item')).length !== 1
      || list(item.querySelectorAll('.ant-calendar-picker,.ant-picker')).length !== 1
      || !matches(picker, '.ant-calendar-picker,.ant-picker')
      || list(item.querySelectorAll('input')).length !== 1
      || !matches(input, 'input') || !visible(picker) || !visible(input)
      || closest(input, '[disabled],[aria-disabled="true"],fieldset[disabled],[inert],.ant-calendar-picker-disabled,.ant-picker-disabled')) return reject('calendar_owner_unverified');

    // Resolve the exact DOM host through the current root's forward links.
    // Return links alone can point at a stale alternate after React bailouts.
    const committedPath = node => {
      const keys = Object.getOwnPropertyNames(node)
        .filter(key => /^(?:__reactInternalInstance|__reactFiber)\$/u.test(key));
      if (keys.length !== 1) return null;
      const anchor = own(node, keys[0]);
      const alternate = own(anchor, 'alternate');
      const branches = alternate ? [anchor, alternate] : [anchor];
      const ancestry = [], pending = branches.slice();
      while (pending.length) {
        const fiber = pending.pop();
        if (!fiber || ancestry.includes(fiber)) continue;
        if (ancestry.length >= 256) return null;
        ancestry.push(fiber);
        pending.push(own(fiber, 'return'), own(fiber, 'alternate'));
      }
      const roots = ancestry.filter(fiber => own(fiber, 'tag') === 3 && !own(fiber, 'return')
        && own(own(fiber, 'stateNode'), 'current') === fiber);
      if (roots.length !== 1) return null;
      const paths = [], visited = [], work = [{ fiber: roots[0], path: [] }];
      while (work.length) {
        const entry = work.pop(), fiber = entry.fiber;
        if (visited.includes(fiber) || visited.length >= 256 || entry.path.length >= 128) return null;
        visited.push(fiber);
        const path = entry.path.concat([fiber]);
        if (branches.includes(fiber)) {
          if (own(fiber, 'tag') === 5 && own(fiber, 'stateNode') === node
            && ['span', 'div'].includes(own(fiber, 'type'))) paths.push(path);
          continue;
        }
        const siblings = [];
        for (let child = own(fiber, 'child'); child; child = own(child, 'sibling')) {
          if (siblings.includes(child) || siblings.length >= 256) return null;
          siblings.push(child);
          if (ancestry.includes(child)) work.push({ fiber: child, path });
        }
      }
      return paths.length === 1 ? paths[0] : null;
    };
    const triggerPath = committedPath(picker);
    if (!triggerPath) return reject('current_chain_unverified');
    const triggerFiber = triggerPath[triggerPath.length - 1];
    const targets = list(doc.querySelectorAll('.ant-calendar-picker-container,.ant-picker-dropdown'));
    if (targets.length > 16) return reject('calendar_portal_ambiguous');
    // This also makes any controller's later unique visible-target query safe:
    // no foreign visible popup can be silently selected after this proof.
    const visibleTargets = targets.filter(visible);
    if (visibleTargets.length > 1) return reject('calendar_portal_ambiguous');
    if (action === 'open') return visibleTargets.length === 0 ? input : null;
    if (!targets.length) return reject('calendar_portal_hidden', { calendarPanelState: 'closed' });
    const owned = [];
    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index];
      if (!target.isConnected) continue;
      const path = committedPath(target);
      if (!path || path[0] !== triggerPath[0]) continue;
      const triggerIndex = path.indexOf(triggerFiber);
      if (triggerIndex < 0 || triggerIndex >= path.length - 1) continue;
      const portals = path.slice(triggerIndex + 1).filter(fiber => own(fiber, 'tag') === 4);
      if (portals.length !== 1) continue;
      const container = own(own(portals[0], 'stateNode'), 'containerInfo');
      if (!container || !container.isConnected || !container.contains(target)) continue;
      owned.push(target);
    }
    if (!owned.length) return reject('calendar_portal_owner_unverified');
    if (owned.length !== 1) return reject('calendar_portal_ambiguous');
    const target = owned[0];
    if (visibleTargets.length && visibleTargets[0] !== target) return reject('calendar_portal_owner_unverified');
    const state = { calendarPanelOwned: true, calendarPanelState: 'closed' };
    if (!visible(target)) return reject('calendar_portal_hidden', state);
    const targetItem = closest(target, '.ant-form-item');
    const targetSection = closest(target, '.form-cell');
    const targetWrapper = namedWrapperFor(target);
    if ((targetItem && targetItem !== item) || (targetSection && targetSection !== section)
      || (targetWrapper && targetWrapper !== wrapper)) {
      return reject('calendar_portal_owner_unverified');
    }
    // The static DIV is an explicit close fallback, never a selectable calendar
    // cell. A child label may carry `for`: the controller must hit-test this
    // exact DIV, so a label descendant cannot receive the click.
    if (action === 'close_blank') {
      const labels = list(item.querySelectorAll('.ant-form-item-label')).filter(visible);
      if (labels.length !== 1 || !matches(labels[0], 'div.ant-form-item-label')
        || closest(labels[0], '.ant-form-item') !== item
        || namedWrapperFor(labels[0]) !== wrapper
        || matches(labels[0], 'input,button,a,select,textarea,[role="button"],[for]')
        || labels[0].querySelector('input,button,a,select,textarea,[role="button"]')) return null;
      return labels[0];
    }
    const grids = matches(target, '.ant-calendar,.ant-picker-panel') ? [target]
      : list(target.querySelectorAll('.ant-calendar,.ant-picker-panel'));
    if (grids.length !== 1 || grids[0].querySelector('.ant-calendar,.ant-picker-panel')) return reject('calendar_portal_ambiguous');
    const grid = grids[0];
    const scopeMatches = node => closest(node, '.ant-form-item') === targetItem
      && closest(node, '.form-cell') === targetSection && namedWrapperFor(node) === targetWrapper;
    if (!scopeMatches(grid)) return reject('calendar_portal_owner_unverified');
    if (!visible(grid)) return reject('calendar_portal_hidden', state);
    if (action === 'close_focus') return grid;
    const panels = list(grid.querySelectorAll('.ant-calendar-month-panel'));
    if (panels.length > 1) return reject('calendar_portal_ambiguous');
    if (!panels.length) {
      const dates = list(grid.querySelectorAll('.ant-calendar-date'));
      if (grid.querySelector('.ant-calendar-month-panel-month')
        || ![28, 35, 42].includes(dates.length) || dates.some(node => !visible(node) || !scopeMatches(node)
        || closest(node, '.ant-calendar,.ant-picker-panel') !== grid)) return reject('calendar_panel_shape_unsupported');
      if (action === 'month_header') {
        const headers = list(grid.querySelectorAll('.ant-calendar-month-select[role="button"]')).filter(visible);
        if (headers.length !== 1 || !scopeMatches(headers[0])
          || closest(headers[0], '.ant-calendar,.ant-picker-panel') !== grid) return null;
        return headers[0];
      }
      return reject('calendar_panel_shape_unsupported', { calendarPanelOwned: true, calendarPanelState: 'date' });
    }
    const panel = panels[0];
    if (!visible(panel)) return reject('calendar_portal_hidden', state);
    const months = list(panel.querySelectorAll('.ant-calendar-month-panel-month'));
    if (months.length !== 12 || list(grid.querySelectorAll('.ant-calendar-month-panel-month')).length !== 12
      || months.some(node => !visible(node) || !scopeMatches(node) || closest(node, '.ant-calendar-month-panel') !== panel
        || closest(node, '.ant-calendar,.ant-picker-panel') !== grid
        || closest(node, '.ant-form-item') !== targetItem || closest(node, '.form-cell') !== targetSection
        || months.some(other => other !== node && node.contains(other)))) return reject('calendar_panel_shape_unsupported');
    if (action !== 'evidence') return null;
    return { ok: true, calendarFramework: 'react', calendarEvidenceSource: 'owned_react_portal',
      calendarPickerKind: 'unverified', calendarMode: 'month', calendarPanelKind: 'month', calendarCellCount: 12,
      calendarPanelOwned: true, calendarPanelState: 'month' };
  } catch { return reject('calendar_data_unavailable'); }
}
