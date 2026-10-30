// Generic, explicitly grouped date ranges. No field-name or site inference.
// Native dates use HTML events; versioned Vue calendars use owned day panels.
(() => {
  'use strict';
  const R = globalThis.ResumeControls, M = globalThis.ResumeControlModel;
  if (!R || !M) throw Error('control_registry_missing');
  if (R.list().some(adapter => adapter.name === 'native-date-range')) return;
  const H = R.helpers, groupSelector = '[data-date-range],fieldset,[role="group"]';
  const flags = { writeStarted: false, liveSupportClaimed: false };
  const manual = reason => ({ status: 'manual', reason, ...flags });
  const stop = (reason, attempts = 0) => ({ status: 'unsupported', reason, strategy: attempts ? 'ui' : 'none', attempts,
    ...flags, writeStarted: attempts > 0 });
  const all = (root, selector) => root ? [...root.querySelectorAll(selector)] : [];
  const values = root => all(root, 'input:not([type="hidden"]),textarea,select');
  const valid = value => H.validDate(value, 'date');
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const shown = node => !!node?.isConnected && !!node.getClientRects().length && !node.closest('label') && H.clickAllowed(node);
  const panelSelector = '.el-picker-panel,.ant-calendar-picker-container';
  const visiblePanels = () => all(document, panelSelector).filter(shown);
  const families = [
    { lib: 'element-ui', major: 2, rangeName: 'el-date-range', name: 'ElDatePicker', format: 'yyyy-MM-dd', root: '.el-date-editor' },
    { lib: 'ant-design-vue', major: 1, rangeName: 'antdv1-date-range', name: 'ARangePicker', format: 'YYYY-MM-DD', root: '.ant-calendar-picker' },
  ];
  function component(el, ranged) {
    const p = M.inspect(el), ref = M.resolve(el), props = ref.props || {}, root = ref.element;
    const family = families.find(item => p.framework === 'vue2' && p.lib === item.lib && p.major === item.major
      && p.componentName === (ranged ? item.name : item.major === 2 ? 'ElDatePicker' : 'ADatePicker'));
    if (!family || !root?.matches(family.root) || family.major === 2 && props.type !== (ranged ? 'daterange' : 'date') && (ranged || props.type)) return null;
    const inputs = values(root), format = props.format || family.format, valueFormat = props.valueFormat || family.format;
    const kind = props.valueFormat ? 'formatted' : family.major === 1 ? 'moment' : 'date';
    const serialize = raw => {
      if (raw == null || raw === '') return '';
      if (kind === 'formatted') return typeof raw === 'string' && valid(raw) ? raw : null;
      if (kind === 'moment' && raw._isAMomentObject === true && typeof raw.isValid === 'function' && raw.isValid()
        && typeof raw.format === 'function') { const value = raw.format('YYYY-MM-DD'); return valid(value) ? value : null; }
      if (kind === 'date' && raw instanceof Date && Number.isFinite(+raw)) {
        const value = [raw.getFullYear(), String(raw.getMonth() + 1).padStart(2, '0'), String(raw.getDate()).padStart(2, '0')].join('-');
        return valid(value) ? value : null;
      }
      return null;
    };
    const raw = props.value, count = ranged ? 2 : 1;
    const model = ranged ? raw == null || Array.isArray(raw) && raw.length === 0 ? ['', '']
      : Array.isArray(raw) && raw.length === 2 ? raw.map(serialize) : [null, null] : [serialize(raw)];
    const dom = inputs.map(input => input.value);
    const structural = inputs.length === count && inputs.every(input => input.matches('input') && input.type === 'text');
    const formatOK = format === family.format && valueFormat === family.format && !props.showTime
      && (!props.mode || Array.isArray(props.mode) && props.mode.length === 2 && props.mode.every(mode => mode === 'date'))
      && !props.dateRender && !ref.vm?.$scopedSlots?.dateRender;
    return { root, inputs, vm: ref.vm, family, ranged, model, dom, version: p.version, format, valueFormat, kind,
      constraints: [props.disabledDate, props.pickerOptions?.disabledDate],
      contract: [p.version, p.componentName, props.type, format, valueFormat, kind, props.showTime, props.mode],
      available: structural && formatOK && model.every(value => value === '' || valid(value))
        && dom.every(value => value === '' || valid(value)),
      reason: !structural ? 'date_range_structure_unconfirmed' : !formatOK ? 'date_range_format_unconfirmed' : 'date_range_readback_unconfirmed',
      disabled: !!p.disabled || inputs.some(input => input.disabled || input.matches(':disabled')),
      readonly: !!props.readonly || inputs.some(input => input.getAttribute('aria-readonly') === 'true') };
  }
  function group(el) {
    const root = el?.closest?.(groupSelector);
    return root && !root.matches('body,html,form') ? root : null;
  }
  function structure(el) {
    const root = group(el), inputs = values(root);
    if (!root || inputs.length !== 2 || inputs.some(input => input.closest(groupSelector) !== root)) return null;
    if (inputs.every(input => input.matches('input[type="date"]') && input.type === 'date'
      && M.inspect(input).framework === 'native'
      && !input.closest('.el-date-editor,.ant-calendar-picker,.ant-picker'))) return { kind: 'native', root, inputs, parts: [] };
    const parts = inputs.map(input => component(input, false));
    if (parts.every(Boolean) && parts[0].root !== parts[1].root && parts.every(part => root.contains(part.root)))
      return { kind: 'pair', root, inputs, parts };
    return null;
  }
  function modelFor(el, kind) {
    const shape = kind === 'component' ? (() => {
      const part = component(el, true);
      return part ? { kind, root: part.root, inputs: part.inputs, parts: [part] } : null;
    })() : structure(el);
    if (!shape) return { available: false, reason: 'date_range_structure_unconfirmed', controlRoot: el,
      rangeInputs: [], rangeRoots: [], rangeOwners: [], ...flags };
    const { root, inputs, parts } = shape;
    const native = shape.kind === 'native', value = native ? inputs.map(input => input.value) : parts.flatMap(part => part.model);
    const domValue = inputs.map(input => input.value);
    const constraints = native ? inputs.map(input => Object.fromEntries(['min', 'max', 'step', 'value', 'type'].map(key => [key, input.getAttribute(key)]))) : null;
    const disabled = inputs.some(input => input.disabled || input.matches(':disabled') || input.closest('[aria-disabled="true"],[inert]')) || parts.some(part => part.disabled)
      || !!root.closest('[aria-disabled="true"],[inert],[disabled]');
    const readonly = (native && inputs.some(input => input.readOnly)) || parts.some(part => part.readonly)
      || inputs.some(input => input.closest('[aria-readonly="true"]')) || !!root.closest('[aria-readonly="true"]');
    return { controlRoot: root, version: native ? 'html-date-range-v1' : parts.map(part => part.version).join('+'),
      available: inputs.length === 2 && (native || parts.every(part => part.available)), reason: parts.find(part => !part.available)?.reason,
      kind: shape.kind, value, domValue, disabled, readonly, format: 'YYYY-MM-DD', valueFormat: 'YYYY-MM-DD',
      rangeInputs: inputs, rangeRoots: parts.map(part => part.root), rangeOwners: parts.flatMap(part => [part.vm, ...part.constraints]),
      rangeContract: JSON.stringify([shape.kind, parts.map(part => part.contract), constraints,
        inputs.map(input => [input.type, input.readOnly, input.disabled, input.getAttribute('aria-readonly')])]),
      constraints, readbackSource: native ? 'html_input_pair' : 'public_date_models_and_inputs',
      detectionEvidence: native ? 'grouped_html_date_pair' : 'versioned_vue_date_range_owner', ...flags };
  }
  function plan(fact, model) {
    if (model.disabled || model.readonly) return manual(model.disabled ? 'disabled' : 'readonly');
    if (!model.available) return manual(model.reason || 'date_range_readback_unconfirmed');
    const value = fact && typeof fact === 'object' && !Array.isArray(fact) ? fact.value : fact;
    if (!Array.isArray(value) || value.length !== 2 || !value.every(valid)) return manual('invalid_date_precision');
    if (value[0] > value[1]) return manual('invalid_date_range');
    if (!same(model.value, model.domValue)) return manual('date_range_readback_mismatch');
    for (let index = 0; index < 2; index++) {
      if (model.value[index] !== '' && model.value[index] !== value[index]) return manual('existing_value');
      const constraint = model.constraints?.[index];
      if (!constraint) continue;
      const { min, max, step, value: initial } = constraint;
      if ([min, max].some(bound => bound && !valid(bound))) return manual('date_constraint_unconfirmed');
      if (min && value[index] < min || max && value[index] > max) return manual('date_out_of_range');
      if (step !== 'any') {
        const size = step == null || step === '' ? 1 : Number(step);
        if (!Number.isFinite(size) || size <= 0 || step && !/^(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(step)) return manual('date_constraint_unconfirmed');
        const count = (Date.parse(value[index]) - Date.parse(min || (valid(initial) ? initial : '1970-01-01'))) / 86400000 / size;
        if (Math.abs(count - Math.round(count)) > 1e-8) return manual('date_step_mismatch');
      }
    }
    const unchanged = same(value, model.value);
    return { status: unchanged ? 'success' : 'planned', reason: unchanged ? 'preexisting_same_value' : 'ready',
      value: value.slice(), modelValue: value.slice(), domValue: value.slice(), format: 'YYYY-MM-DD',
      readbackSource: model.readbackSource, ...flags };
  }
  function owned(part) {
    const vm = part.vm;
    if (part.family.major === 2) return { panel: vm?.picker?.$el, calendar: vm?.picker };
    const calendar = vm?.$refs?.picker?.$refs?.calendarInstance || vm?.$refs?.calendarInstance;
    const panel = vm?.popupRef?.$refs?.popupInstance?.$el || calendar?.$el?.closest('.ant-calendar-picker-container');
    return { panel, calendar };
  }
  function panes(part) {
    const { panel, calendar } = owned(part);
    if (!panel || !calendar) return [];
    const roots = part.ranged ? all(panel, part.family.major === 2
      ? '.el-date-range-picker__content.is-left,.el-date-range-picker__content.is-right'
      : '.ant-calendar-range-left,.ant-calendar-range-right') : [panel];
    const dates = part.family.major === 2 ? part.ranged ? [calendar.leftDate, calendar.rightDate] : [calendar.date]
      : part.ranged ? calendar.sValue : [calendar.sValue];
    if (roots.length !== (part.ranged ? 2 : 1) || !Array.isArray(dates) || dates.length !== roots.length) return [];
    return roots.map((root, index) => {
      const date = dates[index];
      const year = part.family.major === 2 ? date?.getFullYear?.() : date?.year?.();
      const month = part.family.major === 2 ? date?.getMonth?.() : date?.month?.();
      return { root, date, year, month, stamp: year * 12 + month };
    }).filter(pane => Number.isInteger(pane.year) && Number.isInteger(pane.month) && pane.month >= 0 && pane.month < 12);
  }
  async function write(el, instruction, ctx, kind) {
    const start = modelFor(el, kind), root = start.controlRoot;
    let expected = start.value.slice(), active = -1, allowTarget = false, panel = null, attempts = 0;
    const currentParts = () => kind === 'component' ? [component(el, true)] : structure(el)?.parts || [];
    const stable = async () => {
      await ctx.check();
      const live = modelFor(el, kind);
      if (!live.available || live.disabled || live.readonly || live.controlRoot !== root || live.rangeContract !== start.rangeContract)
        throw Error('control_changed');
      for (let index = 0; index < 2; index++) {
        const allowed = [expected[index], ...(allowTarget && active === index ? [instruction.value[index]] : [])];
        if (!allowed.includes(live.value[index]) || live.value[index] !== live.domValue[index]) throw Error('date_range_endpoint_changed');
      }
      const panels = visiblePanels();
      if (panels.length > 1 || panel && panels.some(node => node !== panel)) throw Error('overlay_ambiguous');
      if (!panel && panels.length && start.kind !== 'native') {
        const part = currentParts()[start.kind === 'component' ? 0 : active];
        if (!part || owned(part).panel !== panels[0]) throw Error('overlay_ownership_unconfirmed');
      }
    };
    const guarded = { ...ctx, check: stable };
    const verifyEndpoint = index => {
      const live = modelFor(el, kind);
      return live.available && live.value[index] === instruction.value[index] && live.domValue[index] === instruction.value[index];
    };
    if (start.kind === 'native') {
      for (let index = 0; index < 2; index++) {
        if (expected[index] === instruction.value[index]) continue;
        active = index; allowTarget = true;
        await H.nativeSet(start.rangeInputs[index], instruction.value[index], guarded);
        attempts++;
        if (!verifyEndpoint(index)) return { ...stop('endpoint_readback_mismatch', attempts), strategy: 'native' };
        expected[index] = instruction.value[index]; allowTarget = false;
        await stable();
      }
      return { strategy: 'native', attempts, liveSupportClaimed: false };
    }
    if (visiblePanels().length) return stop('control_busy');
    for (let index = 0; index < 2; index++) {
      if (start.kind !== 'component' && expected[index] === instruction.value[index]) continue;
      const partIndex = start.kind === 'component' ? 0 : index;
      let part = currentParts()[partIndex];
      if (!part) return stop('date_range_structure_unconfirmed', attempts);
      active = index; allowTarget = false;
      if (!panel || !shown(panel)) {
        panel = null;
        await H.safeClick(part.inputs[start.kind === 'component' ? index : 0], guarded);
        for (let count = 0; count < 40; count++) {
          await stable();
          const candidate = owned(part).panel, visible = visiblePanels();
          if (visible.length === 1) {
            if (candidate !== visible[0]) return stop('overlay_ownership_unconfirmed', attempts);
            panel = candidate; break;
          }
          await H.tick(20);
        }
        if (!panel) return stop('date_panel_unconfirmed', attempts);
      }
      const panelStable = async () => {
        await stable();
        part = currentParts()[partIndex];
        if (!part || owned(part).panel !== panel || !shown(panel) || visiblePanels().length !== 1) throw Error('overlay_ownership_unconfirmed');
      };
      const [year, month, day] = instruction.value[index].split('-').map(Number), targetStamp = year * 12 + month - 1;
      let pane;
      for (let count = 0; count < 240; count++) {
        await panelStable();
        const views = panes(part);
        if (views.length !== (part.ranged ? 2 : 1)) return stop('calendar_view_unconfirmed', attempts);
        const matches = views.filter(view => view.stamp === targetStamp);
        if (matches.length > 1) return stop('calendar_view_ambiguous', attempts);
        if (matches.length === 1) { pane = matches[0]; break; }
        // Unlinked calendars can surround the target month. Navigate a pane
        // toward that month rather than always advancing the right-hand pane.
        const routes = views.flatMap(edge => {
          const backwards = targetStamp < edge.stamp, distance = Math.abs(targetStamp - edge.stamp);
          return (distance >= 12 ? [true, false] : [false]).map(yearly => {
            const selector = part.family.major === 2 ? `.el-icon-${yearly ? 'd-' : ''}arrow-${backwards ? 'left' : 'right'}`
              : `.ant-calendar-${backwards ? 'prev' : 'next'}-${yearly ? 'year' : 'month'}-btn`;
            const buttons = all(edge.root, selector).filter(shown);
            return { edge, selector, buttons, distance, yearly };
          });
        }).filter(route => route.buttons.length === 1)
          .sort((a, b) => a.distance - b.distance || Number(b.yearly) - Number(a.yearly));
        if (!routes.length) return stop('calendar_navigation_unavailable', attempts);
        const { edge, selector, buttons } = routes[0];
        const before = views.map(view => view.stamp);
        await H.safeClick(buttons[0], { ...ctx, async check() {
          await panelStable();
          const current = all(edge.root, selector).filter(shown);
          if (!panel.contains(edge.root) || current.length !== 1 || current[0] !== buttons[0]
            || !same(before, panes(part).map(view => view.stamp))) throw Error('calendar_navigation_changed');
        } });
        if (same(before, panes(part).map(view => view.stamp))) return stop('calendar_navigation_stalled', attempts);
      }
      if (!pane) return stop('calendar_navigation_limit', attempts);
      const targets = () => {
        const current = panes(part).find(view => view.root === pane.root && view.stamp === targetStamp);
        if (!current) return [];
        const cells = all(pane.root, part.family.major === 2 ? 'td.available:not(.prev-month):not(.next-month)' : 'td.ant-calendar-cell:not(.ant-calendar-last-month-cell):not(.ant-calendar-next-month-btn-day)');
        return cells.filter(cell => !cell.matches('.disabled,.ant-calendar-disabled-cell,[aria-disabled="true"]')
          && Number(cell.querySelector(part.family.major === 2 ? 'span' : '.ant-calendar-date')?.textContent.trim()) === day
          && (part.family.major === 2 || typeof current.date?.clone === 'function'
            && cell.getAttribute('title') === current.date.clone().date(day).format('LL')) && shown(cell));
      };
      const cells = targets();
      if (cells.length !== 1) return stop('date_missing_ambiguous_or_disabled', attempts);
      // A range emits only after both selections; scalar pickers emit per end.
      // Permit the reviewed target transition only during the actual day click.
      allowTarget = true;
      await H.safeClick(cells[0], { ...ctx, async check() {
        await panelStable();
        if (targets().length !== 1 || targets()[0] !== cells[0]) throw Error('date_option_changed');
      } });
      attempts++;
      if (start.kind === 'component' && index === 0) {
        // Public ranges usually remain empty until the second click.
        const live = modelFor(el, kind);
        if (!same(live.value, expected)) return stop('premature_range_readback', attempts);
      } else {
        if (start.kind === 'component') {
          if (![0, 1].every(verifyEndpoint)) return stop('endpoint_readback_mismatch', attempts);
          expected = instruction.value.slice();
        } else {
          if (!verifyEndpoint(index)) return stop('endpoint_readback_mismatch', attempts);
          expected[index] = instruction.value[index];
        }
      }
      allowTarget = false;
      if (start.kind === 'component' && index === 0) continue;
      for (let count = 0; count < 60 && shown(panel); count++) { await stable(); await H.tick(20); }
      if (shown(panel)) return stop('owned_overlay_cleanup_timeout', attempts);
      panel = null;
      await stable();
    }
    return { strategy: 'ui', attempts, liveSupportClaimed: false };
  }
  for (const [name, lib, kind, matches] of [
    ['native-date-range', 'native', 'native', el => structure(el)?.kind === 'native'],
    ['el-date-range', 'element-ui', 'component', el => component(el, true)?.family.major === 2],
    ['antdv1-date-range', 'ant-design-vue', 'component', el => component(el, true)?.family.major === 1],
    ['date-range-pair', 'date-range', 'pair', el => structure(el)?.kind === 'pair'],
  ]) R.register({ name, lib, type: 'date-range', priority: 950, matches,
    libVersionProbe: () => ({ lib, version: 'date-range-v1' }), readModel: el => modelFor(el, kind), plan,
    performWrite: (el, instruction, ctx) => write(el, instruction, ctx, kind) });
  R.register({ name: 'date-range-unknown', lib: 'date-range', type: 'date-range', priority: 949,
    matches: el => !!el?.closest?.('[data-date-range],.el-date-editor--daterange,.ant-calendar-picker:has(.ant-calendar-range-picker-input),.ant-picker-range')
      || !!group(el) && values(group(el)).filter(input => input.matches('input[type="date"]') || input.closest('.el-date-editor,.ant-calendar-picker')).length >= 2,
    libVersionProbe: () => ({ lib: 'date-range', version: 'unknown' }),
    readModel: el => ({ controlRoot: el, available: false, rangeInputs: [], rangeRoots: [], rangeOwners: [], ...flags }),
    plan: () => manual('date_range_contract_unconfirmed') });
  globalThis.ResumeDateRangeControls = Object.freeze({ version: 1, liveSupportClaimed: false });
})();
