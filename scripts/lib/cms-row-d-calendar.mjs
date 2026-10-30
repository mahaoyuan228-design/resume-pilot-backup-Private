/**
 * Inert evidence for an already-owned Row D month picker. This helper is
 * deliberately self-contained so its source can run inside debug-evaluate.
 * It neither opens the picker nor reads dates, selected values, model state,
 * text, component getters, refs, slots, or outer application Vue anchors.
 * Historical metadata and placeholders are never current calendar evidence.
 */
export function inspectCmsRowDCalendarEvidence(picker, input, item, doc) {
  const result = { ok: false };
  const reject = issue => {
    const failure = { ok: false, calendarDefinitionIssue: issue };
    if (result.calendarFramework) failure.calendarFramework = result.calendarFramework;
    return failure;
  };
  const own = (object, key) => {
    if (!object || (typeof object !== 'object' && typeof object !== 'function')) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (!descriptor) return undefined;
    if (!Object.hasOwn(descriptor, 'value')) throw new TypeError();
    return descriptor.value;
  };
  const list = collection => {
    const nodes = [];
    const length = collection.length;
    if (!Number.isSafeInteger(length) || length < 0 || length > 10000) throw new TypeError();
    for (let index = 0; index < length; index += 1) nodes.push(collection[index]);
    return nodes;
  };
  const tokens = text => (text || '').replace(/^\s+|\s+$/gu, '').split(/\s+/u).filter(Boolean);
  const monthName = name => name === 'MonthPicker' || name === 'AMonthPicker';
  try {
    // Native Blink matches/closest are not on V8's debug-evaluate allowlist.
    // Match connected nodes against evaluation-local query snapshots instead.
    const selectors = [];
    const snapshots = [];
    const matches = (node, selector) => {
      if (!node) return false;
      const index = selectors.indexOf(selector);
      if (index >= 0) return snapshots[index].includes(node);
      selectors.push(selector);
      const nodes = list(doc.querySelectorAll(selector));
      snapshots.push(nodes);
      return nodes.includes(node);
    };
    const closest = (node, selector) => {
      for (let current = node; current; current = current.parentElement) {
        if (matches(current, selector)) return current;
      }
      return null;
    };
    if (!picker || !input || !item || !doc || !picker.isConnected || !input.isConnected
      || !item.contains(picker) || !picker.contains(input)
      || closest(picker, '.ant-form-item') !== item || closest(input, '.ant-form-item') !== item) {
      return reject('calendar_owner_unverified');
    }
    const candidates = [];
    const anchors = Object.getOwnPropertyNames(picker)
      .filter(key => /^(?:__reactInternalInstance|__reactFiber)\$/u.test(key));
    if (anchors.length) {
      result.calendarFramework = 'react';
      if (anchors.length !== 1) return reject('current_root_unverified');
      const anchor = own(picker, anchors[0]);
      const alternate = own(anchor, 'alternate');
      const branches = alternate ? [anchor, alternate] : [anchor];
      const ancestry = [];
      const pending = branches.slice();
      while (pending.length) {
        const fiber = pending.pop();
        if (!fiber || ancestry.includes(fiber)) continue;
        if (ancestry.length >= 256) return reject('current_chain_unverified');
        ancestry.push(fiber);
        pending.push(own(fiber, 'return'), own(fiber, 'alternate'));
      }
      const roots = ancestry.filter(fiber => own(fiber, 'tag') === 3 && !own(fiber, 'return')
        && own(own(fiber, 'stateNode'), 'current') === fiber);
      if (roots.length !== 1) return reject('current_chain_unverified');
      const committed = [];
      const work = [{ fiber: roots[0], path: [] }];
      const visited = [];
      while (work.length) {
        const entry = work.pop();
        const fiber = entry.fiber;
        if (visited.includes(fiber) || visited.length >= 256 || entry.path.length >= 128) {
          return reject('current_chain_unverified');
        }
        visited.push(fiber);
        const path = entry.path.concat([fiber]);
        if (branches.includes(fiber)) {
          if (own(fiber, 'tag') === 5 && own(fiber, 'stateNode') === picker
            && ['span', 'div'].includes(own(fiber, 'type'))) committed.push(path.reverse());
          continue;
        }
        const siblings = [];
        for (let child = own(fiber, 'child'); child; child = own(child, 'sibling')) {
          if (siblings.includes(child) || siblings.length >= 256) return reject('current_chain_unverified');
          siblings.push(child);
          if (ancestry.includes(child)) work.push({ fiber: child, path });
        }
      }
      if (committed.length !== 1) return reject('current_chain_unverified');
      const path = committed[0];
      for (let index = 1; index < path.length && index < 16; index += 1) {
        const fiber = path[index];
        if (own(fiber, 'tag') === 5) break;
        const type = own(fiber, 'type');
        const name = own(type, 'displayName') || own(type, 'name');
        if (!monthName(name)) continue;
        const props = own(fiber, 'memoizedProps');
        if (!props || own(own(fiber, 'stateNode'), 'props') !== props) {
          return reject('current_props_unverified');
        }
        candidates.push({ props, name });
      }
    } else {
      const seen = [];
      const start = own(picker, '__vue__');
      if (start === undefined || start === null) return reject('root_anchor_missing');
      result.calendarFramework = 'vue';
      const ascended = [];
      const starts = [start];
      // Ascend only components whose current single root is this same picker.
      // There is intentionally no DOM ancestor or application-root search.
      for (let depth = 0; starts[starts.length - 1] && depth < 8; depth += 1) {
        const current = starts[starts.length - 1];
        if (ascended.includes(current) || own(current, '$el') !== picker
          || own(own(current, '_vnode'), 'elm') !== picker) return reject('current_root_unverified');
        ascended.push(current);
        const parent = own(current, '$parent');
        if (!parent || own(parent, '$el') !== picker) break;
        const render = own(parent, '_vnode');
        if (own(render, 'elm') !== picker || own(current, '$vnode') !== render
          || own(render, 'componentInstance') !== current || depth === 7) return reject('current_chain_unverified');
        starts.push(parent);
      }
      const work = [starts[starts.length - 1]];
      for (let depth = 0; work.length && depth < 8; depth += 1) {
        const current = work.pop();
        if (seen.includes(current)) return reject('current_chain_unverified');
        seen.push(current);
        const render = own(current, '_vnode');
        const parent = own(current, '$vnode');
        if (own(current, '$el') !== picker || own(render, 'elm') !== picker
          || (parent && (own(parent, 'elm') !== picker || own(parent, 'componentInstance') !== current))) {
          return reject('current_root_unverified');
        }
        const component = own(parent, 'componentOptions');
        const config = own(own(component, 'Ctor'), 'options');
        if (monthName(own(config, 'name'))) {
          const props = own(own(current, '$options'), 'propsData');
          if (!props || own(component, 'propsData') !== props) return reject('current_props_unverified');
          candidates.push({ props, name: own(config, 'name') });
        }
        const child = own(render, 'componentInstance');
        if (child) {
          if (own(child, '$vnode') !== render || depth === 7) return reject('current_chain_unverified');
          work.push(child);
        }
      }
    }
    // Installed Ant Vue wraps AMonthPicker in a same-root LocaleReceiver and
    // an AMonthPicker implementation. Both current VNode chains were proved
    // above; explicit metadata from the wrapper must agree with the leaf.
    if (!candidates.length || candidates.length > 2 || (candidates.length === 2
      && (result.calendarFramework !== 'vue' || candidates[0].name !== 'AMonthPicker'
        || candidates[1].name !== 'AMonthPicker'))) return reject('month_component_unrecognized');
    const props = candidates[candidates.length - 1].props;
    const format = own(props, 'format');
    const mode = own(props, 'mode');
    const open = own(props, 'open');
    if (candidates.length === 2) {
      const previous = candidates[0].props;
      const keys = ['format', 'mode', 'open', 'prefixCls', 'picker', 'disabled', 'showTime', 'multiple', 'range'];
      for (let index = 0; index < keys.length; index += 1) {
        const value = own(previous, keys[index]);
        if (value !== undefined && value !== own(props, keys[index])) return reject('calendar_props_unsupported');
      }
    }
    if ((format !== undefined && !['YYYY-MM', 'YYYY/MM', 'YYYY年MM月'].includes(format))
      || (mode !== undefined && mode !== 'month')
      || (open !== undefined && typeof open !== 'boolean')) return reject('calendar_props_unsupported');
    const flags = ['disabled', 'showTime', 'multiple', 'range'];
    for (let index = 0; index < flags.length; index += 1) {
      const flag = own(props, flags[index]);
      if (flag !== undefined && flag !== false) return reject('calendar_props_unsupported');
    }
    const prefix = own(props, 'prefixCls');
    const kind = own(props, 'picker');
    if ((prefix !== undefined && prefix !== 'ant-calendar' && prefix !== 'ant-picker')
      || (kind !== undefined && kind !== 'month')) return reject('calendar_props_unsupported');

    const references = [];
    const controlOwners = [picker, input];
    for (let index = 0; index < controlOwners.length; index += 1) {
      const owner = controlOwners[index];
      const names = tokens(owner.getAttribute('aria-controls'));
      if (names.length > 1) return reject('calendar_reference_ambiguous');
      if (names.length && !references.includes(names[0])) references.push(names[0]);
    }
    if (references.length > 1) return reject('calendar_reference_ambiguous');
    const panels = [];
    if (references.length) {
      const reference = references[0];
      const owners = list(doc.querySelectorAll('[aria-controls]'))
        .filter(node => tokens(node.getAttribute('aria-controls')).includes(reference));
      if (!owners.length || owners.some(node => node !== picker && node !== input)) {
        return reject('calendar_portal_owner_unverified');
      }
      const targets = list(doc.querySelectorAll('[id]')).filter(node => node.getAttribute('id') === reference);
      if (targets.length > 1) return reject('calendar_portal_ambiguous');
      if (targets.length) panels.push(targets[0]);
    }
    if (panels.length) {
      const target = panels[0];
      const wrapperFor = node => {
        for (let current = node; current; current = current.parentElement) {
          if (/^\d+_\d+_\d+$/u.test(current.getAttribute('id') || '')) return current;
        }
        return null;
      };
      const portalItem = closest(target, '.ant-form-item');
      const portalSection = closest(target, '.form-cell');
      const portalWrapper = wrapperFor(target);
      if (!target.isConnected || (portalItem && portalItem !== item)
        || (portalSection && portalSection !== closest(picker, '.form-cell'))
        || (portalWrapper && portalWrapper !== wrapperFor(picker))) return reject('calendar_portal_owner_unverified');
      const grids = matches(target, '.ant-calendar,.ant-picker-panel') ? [target]
        : list(target.querySelectorAll('.ant-calendar,.ant-picker-panel'));
      if (grids.length !== 1 || grids[0].querySelector('.ant-calendar,.ant-picker-panel')) {
        return reject('calendar_portal_ambiguous');
      }
      const grid = grids[0];
      const scopeMatches = node => closest(node, '.ant-form-item') === portalItem
        && closest(node, '.form-cell') === portalSection && wrapperFor(node) === portalWrapper;
      if (!scopeMatches(grid)) return reject('calendar_portal_owner_unverified');
      const visible = node => {
        for (let current = node; current; current = current.parentElement) {
          const style = (current.getAttribute('style') || '').replace(/\/\*[\s\S]*?\*\//gu, '');
          if (current.hasAttribute('hidden') || current.hasAttribute('inert')
            || current.getAttribute('aria-hidden') === 'true'
            || style.split(';').some(declaration => /^\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:\s*hidden)\s*(?:!\s*important\s*)?$/iu.test(declaration))
            || matches(current, '.ant-calendar-picker-container-hidden,.ant-picker-dropdown-hidden,.ant-collapse-content-inactive,details:not([open])')) return false;
        }
        return true;
      };
      if (!visible(target) || !visible(grid)) return reject('calendar_portal_hidden');
      const months = list(grid.querySelectorAll('.ant-calendar-month-panel-month'));
      const dates = list(grid.querySelectorAll('.ant-calendar-date'));
      const cells = months.length ? months : dates;
      if ((months.length && dates.length) || (months.length ? months.length !== 12
        : dates.length < 28 || dates.length > 42 || dates.length % 7 !== 0)
        || cells.some(node => !scopeMatches(node) || !visible(node) || closest(node, '.ant-calendar,.ant-picker-panel') !== grid
          || cells.some(other => other !== node && node.contains(other)))) return reject('calendar_panel_shape_unsupported');
      if (open === false) return reject('calendar_open_state_mismatch');
      result.calendarEvidenceSource = 'aria_controls_calendar_dom';
      result.calendarPanelKind = months.length ? 'month' : 'date';
      result.calendarCellCount = cells.length;
    } else {
      if (format === undefined) return reject('calendar_format_missing');
      result.calendarEvidenceSource = result.calendarFramework === 'react' ? 'owned_react_props' : 'owned_calendar_vnodes';
    }
    result.calendarPickerKind = 'month';
    result.calendarMode = 'month';
    if (format !== undefined) result.calendarFormat = format;
    if (open !== undefined) result.calendarOpen = open;
    result.ok = true;
    return result;
  } catch { return reject('calendar_data_unavailable'); }
}
