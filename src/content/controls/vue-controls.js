// First-party L1 controls. No implementation is copied from ATS research repos.
// Production entry points only request shadow plans; writers require the registry's
// explicit per-effect check and are exercised against disposable offline fixtures.
(() => {
  'use strict';
  const R = globalThis.ResumeControls;
  if (!R) throw new Error('l1_registry_required');
  if (R.list().some(adapter => adapter.name === 'el-input')) return;
  const H = R.helpers;
  const n = H.norm;
  const inspect = el => globalThis.ResumeControlModel.inspect(el);
  const resolve = el => globalThis.ResumeControlModel.resolve(el);
  const shown = el => {
    if (!el?.isConnected || !el.getClientRects().length || el.closest('[hidden],[aria-hidden="true"]')) return false;
    for (let node = el; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || ['hidden', 'collapse'].includes(style.visibility)) return false;
    }
    return true;
  };
  const all = (root, selector) => [...root.querySelectorAll(selector)];
  const pause = ms => new Promise(done => setTimeout(done, ms));
  const rootOf = (el, probe) => probe.controlRoot || el;
  const valueInput = root => root.matches?.('input,textarea') ? root : root.querySelector('input,textarea');
  const supported = (probe, lib, major) => probe.available === true && probe.framework === 'vue2'
    && probe.lib === lib && Number(probe.major ?? String(probe.version || '').split('.')[0]) === major;
  const named = (probe, names) => names.includes(probe.componentName);
  const empty = value => value == null || value === '' || (Array.isArray(value) && value.every(empty));
  const unsupported = reason => ({ status: 'unsupported', reason });

  function modelFor(el, probe) {
    const root = rootOf(el, probe);
    let domValue;
    let options = probe.options;
    if (probe.componentName === 'ACascader') {
      domValue = valueInput(root)?.value || n(root.querySelector('.ant-cascader-picker-label')?.textContent);
    } else if (probe.lib === 'ant-design-vue' && /Select/u.test(probe.componentName)) {
      const selected = all(root, '.ant-select-selection-selected-value,.ant-select-selection__choice__content');
      domValue = selected.length ? selected.map(node => n(node.textContent)).join(' | ') : '';
    } else if (/RadioGroup|CheckboxGroup/u.test(probe.componentName)) {
      options = all(root, 'input[type="radio"],input[type="checkbox"]').map(input => ({
        value: input._value ?? input.value, label: n(input.closest('label')?.textContent || input.value), disabled: !!input.disabled,
      }));
      const selected = all(root, 'input:checked').map(input => n(input.closest('label')?.textContent || input.value));
      domValue = /Radio/u.test(probe.componentName) ? selected[0] || '' : selected;
    } else {
      const input = valueInput(root);
      domValue = input ? input.value : n(root.textContent);
    }
    const monthInputs = probe.lib === 'ant-design-vue' && probe.componentName === 'AMonthPicker'
      ? all(root, 'input:not([type="hidden"])') : null;
    return { ...probe, options, domValue,
      ...(monthInputs && monthInputs.length !== 1 ? { available: false, modelReason: 'month_ownership_unconfirmed' } : {}) };
  }

  function librarySpec(lib, major, names) {
    return (el, p) => supported(p, lib, major) && named(p, names);
  }

  async function checkedEmit(el, instruction, ctx, event, value) {
    const { vm } = resolve(el);
    if (!vm || typeof vm.$emit !== 'function') return unsupported('component_api_unavailable');
    await H.check(ctx);
    if (!el.isConnected || vm._isDestroyed || vm.disabled || vm.$props?.disabled)
      return unsupported('control_changed');
    vm.$emit(event, value);
    await H.tick();
    return { strategy: 'emit', attempts: 1 };
  }

  async function writeInput(el, instruction, ctx) {
    const input = valueInput(rootOf(el, inspect(el)));
    if (!input || input.readOnly || input.disabled) return unsupported('control_guard');
    await H.nativeSet(input, String(instruction.value), ctx);
    return { strategy: 'native', attempts: 1 };
  }

  function visibleMenus(lib) {
    const selector = lib === 'element-ui' ? '.el-select-dropdown' : '.ant-select-dropdown';
    return all(document, selector).filter(shown);
  }

  async function waitOwnedClosed(target, owned, selector, ctx) {
    // Vue transitions keep a closing portal painted for a short time. Wait for
    // this action's portal; never conceal it or dismiss another control's UI.
    for (let count = 0; count < 60; count++) {
      await H.check(ctx);
      if (!target.isConnected) return unsupported('control_changed');
      const visible = all(document, selector).filter(shown);
      if (visible.some(node => node !== owned)) return unsupported('overlay_ambiguous');
      if (!shown(owned)) return null;
      await pause(20);
    }
    return unsupported('owned_overlay_cleanup_timeout');
  }

  function selectRoot(el, p) {
    const root = rootOf(el, p);
    if (root.matches?.('.el-select,.ant-select')) return root;
    return root.closest?.('.el-select,.ant-select') || root;
  }

  // Opening is allowed only with no pre-existing menu. A portal is accepted only
  // when this action produces exactly one visible menu of the expected library.
  async function writeSelect(el, instruction, ctx) {
    const p = inspect(el), root = selectRoot(el, p);
    if (visibleMenus(p.lib).length) return unsupported('control_busy');
    const face = p.lib === 'element-ui' ? root.querySelector('input')
      : root.querySelector('.ant-select-selection');
    if (!face || face.disabled) return unsupported('control_guard');
    await H.safeClick(face, ctx);
    let menu;
    for (let i = 0; i < 40; i++) {
      const menus = visibleMenus(p.lib);
      if (menus.length > 1) return unsupported('overlay_ambiguous');
      if (menus.length === 1) { menu = menus[0]; break; }
      await pause(20);
    }
    if (!menu) return unsupported('select_not_open');
    const desired = n(instruction.labels?.[0] ?? instruction.domValue ?? instruction.value);
    if (p.filterable || p.remote || p.showSearch) {
      const search = root.querySelector('input:not([readonly])');
      if (!search || search.disabled) return unsupported('search_input_unavailable');
      await H.nativeSet(search, desired, ctx);
    }
    const optionSelector = p.lib === 'element-ui' ? '.el-select-dropdown__item'
      : '.ant-select-dropdown-menu-item';
    for (let i = 0; i < 80; i++) {
      await H.check(ctx);
      if (!el.isConnected || visibleMenus(p.lib).length !== 1 || !shown(menu))
        return unsupported('control_changed');
      const busy = menu.querySelector('[aria-busy="true"],.ant-spin-spinning,.el-loading-mask');
      const matches = all(menu, optionSelector).filter(node => shown(node)
        && !node.matches('.is-disabled,.ant-select-dropdown-menu-item-disabled,[aria-disabled="true"]')
        && n(node.textContent) === desired);
      if (matches.length > 1) return unsupported('option_ambiguous');
      if (!busy && matches.length === 1) {
        // Exact visible text is the only selector for an option. No guessed IDs
        // or internal onChange are used for flat/search selects.
        await H.safeClick(matches[0], ctx);
        await H.tick();
        const closing = await waitOwnedClosed(el, menu,
          p.lib === 'element-ui' ? '.el-select-dropdown' : '.ant-select-dropdown', ctx);
        if (closing) return closing;
        return { strategy: 'ui', interaction: p.filterable || p.remote || p.showSearch ? 'search' : 'flat', attempts: 1 };
      }
      await pause(20);
    }
    return unsupported('option_not_found');
  }

  function searchPlan(fact, model) {
    const existing = H.makePlan(fact, { ...model, options: [] }, { type: 'text' });
    if (existing.status !== 'planned') return existing;
    if (typeof fact.value !== 'string' || !n(fact.value) || fact.value.length > 160)
      return unsupported('explicit_option_required');
    if ((model.options || []).length) return H.makePlan(fact, model, { type: 'select' });
    return { status: 'planned', reason: 'search_options_deferred', value: fact.value,
      labels: [fact.value], domValue: fact.value, strategy: 'ui', interaction: 'search', requiresOptionResolution: true };
  }

  function datePlan(fact, model, type) {
    const value = fact.value;
    const month = type === 'month';
    const antMonth = month && model.lib === 'ant-design-vue' && model.componentName === 'AMonthPicker';
    if (antMonth && model.format !== 'YYYY-MM') return { status: 'manual', reason: 'display_format_unverified' };
    if (antMonth && model.valueFormat !== 'YYYY-MM') return { status: 'manual', reason: 'value_format_unverified' };
    const expectedFormat = month ? /^(?:YYYY-MM|yyyy-MM)$/u : /^(?:YYYY-MM-DD|yyyy-MM-dd)$/u;
    if (!expectedFormat.test(model.valueFormat || '')) return unsupported('value_format_unverified');
    if (typeof value !== 'string' || !(month ? /^\d{4}-\d{2}$/u : /^\d{4}-\d{2}-\d{2}$/u).test(value))
      return unsupported('date_precision_mismatch');
    const [year, m, d = 1] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, m - 1, d));
    if (year < 1900 || year > 2100 || date.getUTCFullYear() !== year
      || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return unsupported('invalid_date');
    if (antMonth && !empty(model.domValue) && !H.equal(model.domValue, value)) return unsupported('existing_value');
    return H.makePlan(fact, model, { type });
  }

  async function writeMonthUi(el, instruction, ctx) {
    const p = inspect(el), root = rootOf(el, p), input = valueInput(root);
    const owner = resolve(el);
    const selector = p.lib === 'element-ui' ? '.el-picker-panel' : '.ant-calendar-picker-container';
    if (all(document, selector).some(shown)) return unsupported('control_busy');
    if (!input) return unsupported('control_guard');
    await H.safeClick(input, ctx);
    let panel;
    for (let i = 0; i < 40; i++) {
      const panels = all(document, selector).filter(shown);
      if (panels.length > 1) return unsupported('overlay_ambiguous');
      if (panels.length === 1) { panel = panels[0]; break; }
      await pause(20);
    }
    if (!panel) return unsupported('calendar_not_open');
    const owned = () => {
      const current = modelFor(el, inspect(el)), currentOwner = resolve(el);
      const panels = all(document, selector).filter(shown);
      return el.isConnected && rootOf(el, current) === root && currentOwner.vm === owner.vm
        && current.componentName === p.componentName && current.version === p.version
        && current.available && !current.disabled && !current.readonly
        && current.format === p.format && current.valueFormat === p.valueFormat
        && (empty(current.value) || H.equal(current.value, instruction.value))
        && (empty(current.domValue) || H.equal(current.domValue, instruction.domValue ?? instruction.value))
        && panels.length === 1 && panels[0] === panel;
    };
    const ownedCtx = { ...ctx, check: async () => {
      await ctx.check();
      if (!owned()) throw Error('control_changed');
    } };
    const [year, month] = instruction.value.split('-').map(Number);
    const yearText = () => {
      const nodes = all(panel, p.lib === 'element-ui' ? '.el-date-picker__header-label'
        : '.ant-calendar-month-panel-year-select-content').filter(shown);
      if (nodes.length !== 1) return null;
      const found = n(nodes[0].textContent).match(/^(\d{4})(?:\s*年)?$/u);
      return found ? Number(found[1]) : null;
    };
    for (let count = 0; count < 32; count++) {
      await H.check(ctx);
      if (!owned()) return unsupported('control_changed');
      const current = yearText();
      if (current == null) return unsupported('calendar_year_unverified');
      if (current === year) break;
      const selector = p.lib === 'element-ui'
        ? current > year ? '.el-date-picker__prev-btn.el-icon-d-arrow-left' : '.el-date-picker__next-btn.el-icon-d-arrow-right'
        : current > year ? '.ant-calendar-month-panel-prev-year-btn' : '.ant-calendar-month-panel-next-year-btn';
      const buttons = all(panel, selector).filter(shown);
      if (buttons.length !== 1) return unsupported('calendar_navigation_unavailable');
      await H.safeClick(buttons[0], ownedCtx);
      await H.tick();
      if (!owned()) return unsupported('control_changed');
      if (yearText() === current) return unsupported('calendar_navigation_stalled');
    }
    await H.check(ctx);
    if (!owned()) return unsupported('control_changed');
    if (yearText() !== year) return unsupported('calendar_year_limit');
    const cells = p.lib === 'element-ui' ? all(panel, '.el-month-table td')
      : all(panel, 'td.ant-calendar-month-panel-cell');
    if (cells.length !== 12) return unsupported('calendar_month_structure');
    const target = cells[month - 1];
    if (!target || target.matches('.disabled,.ant-calendar-month-panel-cell-disabled,[aria-disabled="true"]')
      || target.querySelector('[aria-disabled="true"],button:disabled'))
      return unsupported('date_disabled');
    await H.safeClick(target.querySelector('a') || target, ownedCtx);
    await H.tick();
    const closing = await waitOwnedClosed(el, panel, selector, ctx);
    if (closing) return closing;
    return { strategy: 'ui', attempts: 1 };
  }

  async function writeDate(el, instruction, ctx) {
    const p = inspect(el), type = instruction.type === 'month' || /MonthPicker/u.test(p.componentName)
      || p.type === 'month' ? 'month' : 'date';
    const checked = datePlan({ value: instruction.value }, modelFor(el, p), type);
    if (checked.status !== 'planned' && checked.status !== 'success') return checked;
    if (type === 'month') {
      const ui = await writeMonthUi(el, instruction, ctx);
      // MonthPicker without valueFormat consumes a Moment, never a string.
      // Its calendar is also the only reviewed way to respect disabledDate.
      if (p.componentName === 'AMonthPicker') return ui;
      if (ui.strategy || ['control_busy', 'overlay_ambiguous', 'date_disabled', 'owned_overlay_cleanup_timeout', 'control_changed'].includes(ui.reason)) return ui;
      // A partially opened UI must not survive an internal fallback. Element's
      // picker has a documented instance lifecycle; other shapes fail closed.
      const { vm } = resolve(el);
      if (p.lib === 'element-ui' && typeof vm?.handleClose === 'function') {
        await H.check(ctx); vm.handleClose(); await H.tick();
      } else if (all(document, '.ant-calendar-picker-container').some(shown)) return ui;
    }
    // Day panels and unrendered month panels use the explicit value-format
    // component interface, never input.value (which would only paint a date).
    const ref = resolve(el);
    if (typeof ref.props?.disabledDate === 'function' || typeof ref.vm?.disabledDate === 'function')
      return unsupported('date_constraint_requires_ui');
    return checkedEmit(el, instruction, ctx, p.lib === 'element-ui' ? 'input' : 'change', instruction.value);
  }

  async function writeChoice(el, instruction, ctx) {
    const p = inspect(el), root = rootOf(el, p);
    const desired = instruction.labels || [instruction.domValue ?? instruction.value];
    const many = instruction.type === 'checkbox';
    const labels = all(root, 'label');
    for (const label of desired) {
      const matches = labels.filter(node => n(node.textContent) === n(label));
      if (matches.length !== 1) return unsupported('option_ambiguous');
      const input = matches[0].querySelector('input');
      if (!input || input.disabled || matches[0].getAttribute('aria-disabled') === 'true')
        return unsupported('control_guard');
      // Checkboxes only add. Existing checks are never toggled off.
      if (!input.checked) await H.safeClick(matches[0], ctx);
      if (!many) break;
    }
    await H.tick();
    return { strategy: 'ui', attempts: 1 };
  }

  function cascaderPlan(fact, model) {
    const path = Array.isArray(fact?.value) ? fact.value : Array.isArray(fact) ? fact : null;
    if (!path || !path.length || path.some(value => !(typeof value === 'string' && n(value)) && !(typeof value === 'number' && Number.isFinite(value))))
      return unsupported('explicit_path_required');
    if (model.cascaderUnsupported || typeof model.separator !== 'string') return unsupported('cascader_contract_unconfirmed');
    const plan = H.makePlan({ value: path }, model, { type: 'cascader' });
    if (!['planned', 'success'].includes(plan.status)) return plan;
    const domValue = (model.showAllLevels ? plan.labels : plan.labels.slice(-1)).join(model.separator);
    if (empty(model.value) && !empty(model.domValue)) return unsupported('existing_value');
    return { ...plan, domValue, status: H.equal(model.value, plan.value) && H.equal(model.domValue, domValue) ? 'success' : 'planned' };
  }

  async function writeCascader(el, instruction, ctx) {
    const p = inspect(el), { vm } = resolve(el), root = rootOf(el, p);
    if (!Array.isArray(instruction.value)) return unsupported('explicit_path_required');
    const containerSelector = p.lib === 'element-ui' ? '.el-cascader__dropdown' : '.ant-cascader-menus';
    const menus = () => all(document, containerSelector).filter(shown);
    const instancePanel = () => p.lib === 'element-ui' ? vm?.$refs?.popper
      : vm?.popupRef?.$refs?.popupInstance?.$el?.closest(containerSelector);
    const stable = () => {
      const current = modelFor(el, inspect(el));
      const plan = cascaderPlan({ value: instruction.value }, current);
      return resolve(el).vm === vm && rootOf(el, current) === root && current.version === p.version
        && ['planned', 'success'].includes(plan.status) && H.equal(plan.value, instruction.value)
        && H.equal(plan.domValue, instruction.domValue);
    };
    const guarded = test => ({ ...ctx, async check() {
      await ctx.check();
      if (!stable() || !test()) throw Error('control_changed');
    } });
    if (menus().length) return unsupported('control_busy');
    const face = valueInput(root) || root;
    await H.safeClick(face, guarded(() => !menus().length));
    let owned;
    for (let count = 0; count < 40; count++) {
      await H.check(ctx);
      if (!stable()) return unsupported('control_changed');
      const visible = menus();
      if (visible.length > 1) return unsupported('overlay_ambiguous');
      if (visible.length === 1) {
        if (instancePanel() !== visible[0]) return unsupported('overlay_ownership_unconfirmed');
        owned = visible[0]; break;
      }
      await pause(20);
    }
    if (owned) {
      const columnSelector = p.lib === 'element-ui' ? '.el-cascader-menu__list' : '.ant-cascader-menu';
      const itemSelector = p.lib === 'element-ui' ? '.el-cascader-node' : '.ant-cascader-menu-item';
      const columns = () => all(owned, columnSelector), selected = [];
      for (let level = 0; level < instruction.value.length; level++) {
        let column;
        for (let count = 0; count < 60; count++) {
          await H.check(ctx);
          if (!stable() || instancePanel() !== owned || menus().length !== 1 || menus()[0] !== owned) return unsupported('control_changed');
          if (selected.some((column, i) => columns()[i] !== column || !shown(column))) return unsupported('control_changed');
          column = columns()[level];
          if (column && !shown(column)) return unsupported('cascader_column_hidden');
          if (column) break;
          await pause(20);
        }
        if (!column) return unsupported(p.lazy ? 'lazy_options_pending' : 'cascader_column_missing');
        const text = n(instruction.labels?.[level] ?? instruction.value[level]);
        const matches = () => all(column, itemSelector).filter(item => shown(item)
          && !item.matches('.is-disabled,.ant-cascader-menu-item-disabled,[aria-disabled="true"]')
          && n(item.querySelector('.el-cascader-node__label')?.textContent || item.textContent) === text);
        const hits = matches();
        if (hits.length !== 1) return unsupported(hits.length ? 'option_ambiguous' : 'option_not_found');
        selected.push(column);
        await H.safeClick(hits[0], guarded(() => instancePanel() === owned && menus().length === 1 && menus()[0] === owned
          && selected.every((column, i) => columns()[i] === column && shown(column)) && matches().length === 1 && matches()[0] === hits[0]));
        await H.tick();
      }
      const closing = await waitOwnedClosed(el, owned, containerSelector, guarded(() => instancePanel() === owned));
      return closing || { strategy: 'ui', attempts: instruction.value.length };
    }
    return unsupported(p.lazy ? 'lazy_options_pending' : 'cascader_not_open');
  }

  const definitions = [
    ['el-input', 'element-ui', 'text', 150, ['ElInput'], writeInput],
    ['el-textarea', 'element-ui', 'textarea', 175, ['ElInput'], writeInput],
    ['el-select', 'element-ui', 'select', 400, ['ElSelect'], writeSelect],
    ['el-radio', 'element-ui', 'radio', 300, ['ElRadioGroup'], writeChoice],
    ['el-checkbox', 'element-ui', 'checkbox', 300, ['ElCheckboxGroup'], writeChoice],
    ['el-date', 'element-ui', 'date', 500, ['ElDatePicker'], writeDate],
    ['el-month', 'element-ui', 'month', 600, ['ElDatePicker'], writeDate],
    ['el-cascader', 'element-ui', 'cascader', 650, ['ElCascader'], writeCascader],
    ['antdv1-input', 'ant-design-vue', 'text', 150, ['AInput'], writeInput],
    ['antdv1-textarea', 'ant-design-vue', 'textarea', 175, ['ATextarea'], writeInput],
    ['antdv1-select', 'ant-design-vue', 'select', 400, ['ASelect'], writeSelect],
    ['antdv1-select-search', 'ant-design-vue', 'select-search', 450, ['ASelect'], writeSelect],
    ['antdv1-radio', 'ant-design-vue', 'radio', 300, ['ARadioGroup'], writeChoice],
    ['antdv1-checkbox-group', 'ant-design-vue', 'checkbox', 300, ['ACheckboxGroup'], writeChoice],
    ['antdv1-date', 'ant-design-vue', 'date', 500, ['ADatePicker'], writeDate],
    ['antdv1-month', 'ant-design-vue', 'month', 600, ['AMonthPicker'], writeDate],
    ['antdv1-cascader', 'ant-design-vue', 'cascader', 650, ['ACascader'], writeCascader],
  ];

  for (const [name, lib, type, priority, names, performWrite] of definitions) {
    const major = lib === 'element-ui' ? 2 : 1;
    R.register({ name, lib, type, priority,
      matches(el, p) {
        if (!librarySpec(lib, major, names)(el, p)) return false;
        if (name === 'el-textarea') return p.type === 'textarea';
        if (name === 'el-input') return p.type !== 'textarea';
        if (name === 'el-month') return p.type === 'month';
        if (name === 'el-date') return p.type === 'date' || !p.type;
        if (name === 'antdv1-select-search') return !!(p.filterable || p.remote || p.showSearch);
        if (name === 'antdv1-select') return !(p.filterable || p.remote || p.showSearch);
        return true;
      },
      readModel: modelFor,
      ...(type === 'month' || type === 'date' ? { plan: (fact, model) => datePlan(fact, model, type) }
        : type === 'select-search' ? { plan: searchPlan }
          : type === 'cascader' ? { plan: cascaderPlan } : {}),
      performWrite,
    });
  }

  function pairElements(el) {
    return el.matches?.('.cascader-plugins-wrap') ? all(el, '.ant-select') : [];
  }
  function rangeElements(el) {
    return el.matches?.('.el-form-item,.el-date-editor--monthrange')
      ? all(el, '.el-date-editor--month') : [];
  }
  function aggregate(el, children, lib, type) {
    const parts = children.map(child => modelFor(child, inspect(child)));
    return { framework: 'vue2', lib, major: lib === 'element-ui' ? 2 : 1,
      version: parts[0]?.version, componentName: type, available: parts.length === 2 && parts.every(p => p.available),
      value: parts.map(p => p.value), domValue: parts.map(p => p.domValue),
      // The paired city select is intentionally disabled until province exists.
      // That dependency is resolved after the first selection, not site readonly.
      disabled: type === 'hotjob-pair-cascader' ? !!parts[0]?.disabled : parts.some(p => p.disabled), readonly: false, controlRoot: el,
      options: parts.map(p => p.options || []), valueFormat: parts.map(p => p.valueFormat), parts,
      lazy: type === 'hotjob-pair-cascader' };
  }
  function pairPlan(fact, model) {
    if (!Array.isArray(fact.value) || fact.value.length !== 2 || fact.value.some(v => typeof v !== 'string' || !n(v)))
      return unsupported('explicit_path_required');
    const existing = H.makePlan(fact, { ...model, options: [] }, { type: 'text' });
    if (existing.status !== 'planned') return existing;
    const first = model.parts?.[0], second = model.parts?.[1];
    if (!first || !second) return unsupported('pair_structure_changed');
    const candidates = (first.options || []).filter(option => !option.disabled
      && (n(option.label) === n(fact.value[0]) || H.equal(option.value, fact.value[0])));
    if (candidates.length !== 1) return unsupported(candidates.length ? 'option_ambiguous' : 'option_not_found');
    const secondCandidates = (second.options || []).filter(option => !option.disabled
      && (n(option.label) === n(fact.value[1]) || H.equal(option.value, fact.value[1])));
    if (secondCandidates.length > 1) return unsupported('option_ambiguous');
    return { status: 'planned', reason: 'dependent_options_deferred', value: [candidates[0].value, secondCandidates[0]?.value ?? fact.value[1]],
      labels: [candidates[0].label, secondCandidates[0]?.label ?? fact.value[1]],
      domValue: [candidates[0].label, secondCandidates[0]?.label ?? fact.value[1]], lazy: true,
      requiresOptionResolution: secondCandidates.length === 0 };
  }

  R.register({ name: 'hotjob-pair-cascader', lib: 'ant-design-vue', type: 'cascader', priority: 900,
    libVersionProbe(el) {
      const parts = pairElements(el).map(inspect);
      return parts.length === 2 && parts.every(p => supported(p, 'ant-design-vue', 1))
        ? { lib: 'ant-design-vue', version: parts[0].version } : null;
    },
    matches(el) {
      const parts = pairElements(el).map(inspect);
      return parts.length === 2 && parts.every(p => supported(p, 'ant-design-vue', 1) && p.componentName === 'ASelect');
    },
    readModel(el) { return aggregate(el, pairElements(el), 'ant-design-vue', 'hotjob-pair-cascader'); },
    plan: pairPlan,
    async performWrite(el, instruction, ctx) {
      const children = pairElements(el);
      if (children.length !== 2) return unsupported('pair_structure_changed');
      for (let i = 0; i < 2; i++) {
        const p = modelFor(children[i], inspect(children[i]));
        if (!empty(p.value) && !H.equal(p.value, instruction.value[i])) return unsupported('existing_value');
        if (H.equal(p.value, instruction.value[i])) continue;
        const wrote = await writeSelect(children[i], { value: instruction.value[i], labels: [instruction.labels[i]] }, ctx);
        if (!wrote.strategy) return wrote;
      }
      return { strategy: 'ui', attempts: 2 };
    },
  });

  R.register({ name: 'el-month-range', lib: 'element-ui', type: 'month-range', priority: 850,
    libVersionProbe(el) {
      const parts = rangeElements(el).map(inspect);
      return parts.length === 2 && parts.every(p => supported(p, 'element-ui', 2))
        ? { lib: 'element-ui', version: parts[0].version } : null;
    },
    matches(el) {
      const parts = rangeElements(el).map(inspect);
      return parts.length === 2 && parts.every(p => supported(p, 'element-ui', 2) && p.componentName === 'ElDatePicker' && p.type === 'month');
    },
    readModel(el) { return aggregate(el, rangeElements(el), 'element-ui', 'el-month-range'); },
    plan(fact, model) {
      if (!Array.isArray(fact.value) || fact.value.length !== 2) return unsupported('explicit_month_range_required');
      const plans = model.parts.map((part, i) => datePlan({ value: fact.value[i] }, part, 'month'));
      const rejected = plans.find(plan => !['planned', 'success'].includes(plan.status));
      if (rejected) return rejected;
      if (fact.value[0] > fact.value[1]) return unsupported('invalid_month_range');
      if (plans.every(plan => plan.status === 'success')) return { status: 'success', reason: 'preexisting_same_value',
        value: fact.value.slice(), labels: fact.value.slice(), domValue: fact.value.slice() };
      return { status: 'planned', reason: 'month_range', value: fact.value.slice(), labels: fact.value.slice(), domValue: fact.value.slice() };
    },
    async performWrite(el, instruction, ctx) {
      const children = rangeElements(el);
      if (children.length !== 2) return unsupported('range_structure_changed');
      const writes = [];
      for (let i = 0; i < 2; i++) {
        if (H.equal(inspect(children[i]).value, instruction.value[i])) continue;
        const wrote = await writeDate(children[i], { ...instruction, type: 'month', value: instruction.value[i] }, ctx);
        if (!wrote.strategy) return wrote;
        writes.push(wrote);
        const readback = modelFor(children[i], inspect(children[i]));
        if (!H.equal(readback.value, instruction.value[i]) || !H.equal(readback.domValue, instruction.labels[i]))
          return { status: 'mismatch', reason: 'endpoint_readback_mismatch',
            strategy: wrote.strategy, attempts: writes.reduce((sum, write) => sum + write.attempts, 0) };
        // A second month editor must not start while the first calendar remains.
        if (all(document, '.el-picker-panel').some(shown)) return unsupported('calendar_cleanup_pending');
      }
      return { strategy: [...new Set(writes.map(write => write.strategy))].join('+') || 'none',
        attempts: writes.reduce((sum, write) => sum + write.attempts, 0) };
    },
  });
})();
