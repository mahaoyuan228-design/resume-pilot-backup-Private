// First-party adapters; no ATS repository implementation is imported.
// iView is checked against its pinned upstream component contract. Ud/Phoenix
// have only a reviewed synthetic replay contract until real samples establish
// their component identities and versions; unknown live versions fail closed.
(() => {
  'use strict';
  const R = globalThis.ResumeControls;
  if (!R) throw new Error('l1_registry_required');
  if (R.list().some(adapter => adapter.name === 'ivu-select')) return;
  const H = R.helpers, M = globalThis.ResumeControlModel;
  const unsupported = reason => ({ status: 'unsupported', reason });
  const all = (node, selector) => [...node.querySelectorAll(selector)];
  const shown = node => {
    if (!node?.isConnected || !node.getClientRects().length || node.closest('[hidden],[aria-hidden="true"]')) return false;
    for (let parent = node; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.display === 'none' || ['hidden', 'collapse'].includes(style.visibility)) return false;
    }
    return true;
  };
  const inputOf = root => root.matches?.('input') ? root : root.querySelector('input:not([type="hidden"])');
  const reviewed = Object.freeze({ ud: ['fixture-contract-1'], phoenix: ['fixture-contract-1'] });

  function versionProbe(el, p) {
    if (!p.available) return null;
    if (p.lib === 'iview') return p.framework === 'vue2' && /^3\.\d+\.\d+$/u.test(p.version || '')
      && p.controlRoot?.matches('.ivu-select,.ivu-date-picker') ? { lib: p.lib, version: p.version } : null;
    return p.framework === 'react' && reviewed[p.lib]?.includes(p.version)
      ? { lib: p.lib, version: p.version } : null;
  }
  function modelFor(el, p = M.inspect(el)) {
    const root = p.controlRoot || el;
    const input = inputOf(root);
    let domValue = input?.value ?? '';
    if (p.componentName === 'iSelect') domValue = H.norm(root.querySelector('.ivu-select-selected-value')?.textContent || '');
    const readableOptions = options => options.every(option => option.valueSupported !== false
      && (!option.children?.length || readableOptions(option.children)));
    return { ...p, available: p.available && readableOptions(p.options || []), domValue };
  }
  function datePlan(fact, model) {
    if (model.type && model.type !== 'date') return unsupported('date_type_unconfirmed');
    if (!['YYYY-MM-DD', 'yyyy-MM-dd'].includes(model.valueFormat)) return unsupported('value_format_unverified');
    return H.makePlan(fact, model, { type: 'date' });
  }
  function cascaderPlan(fact, model) {
    if (model.multiple || Array.isArray(model.value) && model.value.some(Array.isArray)) return unsupported('multiple_cascader_unconfirmed');
    if (H.empty(model.value) && !H.empty(model.domValue)) return unsupported('existing_value');
    if (typeof model.separator !== 'string' || !model.separator.length) return unsupported('separator_unconfirmed');
    const plan = H.makePlan(fact, model, { type: 'cascader' });
    if (!['planned', 'success'].includes(plan.status)) return plan;
    const domValue = plan.labels.join(model.separator);
    return { ...plan, domValue, status: H.equal(model.value, plan.value) && H.equal(model.domValue, domValue) ? 'success' : 'planned' };
  }
  function selectPlan(fact, model) {
    // Object-valued and multiple-select callback conventions need separate
    // samples. Do not guess an onChange payload from a visible option label.
    if (model.multiple || Array.isArray(model.value)) return unsupported('multiple_select_unconfirmed');
    return H.makePlan(fact, model, { type: 'select' });
  }
  async function waitFor(get, ctx, turns = 50) {
    for (let i = 0; i < turns; i++) { await H.check(ctx); const value = get(); if (value) return value; await H.tick(20); }
    return null;
  }
  async function waitClosed(portal, ctx) {
    return await waitFor(() => !shown(portal), ctx) ? null : unsupported('owned_overlay_cleanup_timeout');
  }
  function ariaPortal(root) {
    const faces = [root, ...all(root, '[aria-controls]')].filter(node => node.hasAttribute('aria-controls'));
    const ids = [...new Set(faces.flatMap(node => (node.getAttribute('aria-controls') || '').split(/\s+/u).filter(Boolean)))];
    if (ids.length !== 1) return null;
    const targets = all(document, '[id]').filter(node => node.id === ids[0]);
    if (targets.length !== 1 || !targets[0].matches('[role="listbox"],[role="dialog"]')) return null;
    return targets[0];
  }
  async function openAria(el, ctx) {
    const p = M.inspect(el), root = p.controlRoot || el;
    const face = inputOf(root) || root;
    const portal = ariaPortal(root);
    if (!portal) return { error: 'overlay_ownership_unconfirmed' };
    if (shown(portal)) return { error: 'control_busy' };
    await H.safeClick(face, ctx);
    if (!await waitFor(() => shown(portal), ctx)) return { error: 'control_not_open', root, portal };
    return { root, portal };
  }
  function exactOptions(root, label) {
    return all(root, '[role="option"]').filter(node => shown(node)
      && node.getAttribute('aria-disabled') !== 'true' && !node.hasAttribute('disabled')
      && H.norm(node.textContent) === H.norm(label));
  }
  async function writeAriaSelect(el, instruction, ctx) {
    const opened = await openAria(el, ctx);
    if (opened.error) return unsupported(opened.error);
    const { portal } = opened;
    const hits = exactOptions(portal, instruction.labels[0]);
    if (hits.length !== 1) return unsupported(hits.length ? 'option_ambiguous' : 'option_not_found');
    await H.safeClick(hits[0], ctx);
    const closing = await waitClosed(portal, ctx);
    return closing || { strategy: 'ui', attempts: 1 };
  }
  async function writeAriaCascader(el, instruction, ctx) {
    const initial = M.inspect(el), root = initial.controlRoot || el, portal = ariaPortal(root);
    if (!portal) return unsupported('overlay_ownership_unconfirmed');
    const owned = { ...ctx, async check() {
      await ctx.check();
      if (ariaPortal(root) !== portal) throw Error('overlay_ownership_changed');
      const model = modelFor(el), plan = cascaderPlan({ value: instruction.value }, { ...model, value: [], domValue: '' });
      if (model.multiple || model.separator !== initial.separator || !['planned', 'success'].includes(plan.status)
        || !H.equal(plan.value, instruction.value) || !H.equal(plan.labels, instruction.labels)) throw Error('cascader_contract_changed');
      if (!H.empty(model.value) && (!Array.isArray(model.value) || model.value.length > instruction.value.length
        || model.value.some((part, i) => !H.equal(part, instruction.value[i])))) throw Error('cascader_contract_changed');
    } };
    const opened = await openAria(el, owned);
    if (opened.error) return unsupported(opened.error);
    const groups = () => all(portal, '[role="group"]').filter(group => group.closest('[role="listbox"],[role="dialog"]') === portal
      && !group.parentElement.closest('[role="group"]'));
    const selected = [];
    for (let level = 0; level < instruction.labels.length; level++) {
      const group = await waitFor(() => shown(portal) && shown(groups()[level]) && groups()[level], owned);
      if (!group) return unsupported('cascader_column_missing');
      const options = () => exactOptions(group, instruction.labels[level]).filter(option => option.closest('[role="group"]') === group);
      const hits = options();
      if (hits.length !== 1) return unsupported(hits.length ? 'option_ambiguous' : 'option_not_found');
      selected.push(group);
      await H.safeClick(hits[0], { ...owned, async check() {
        await owned.check();
        if (!shown(portal) || !shown(group) || selected.some((column, i) => groups()[i] !== column || !shown(column))
          || options().length !== 1 || options()[0] !== hits[0]) throw Error('cascader_option_changed');
      } });
    }
    const closing = await waitClosed(portal, owned);
    return closing || { strategy: 'ui', attempts: instruction.labels.length };
  }
  async function writeAriaDate(el, instruction, ctx) {
    const opened = await openAria(el, ctx);
    if (opened.error) return unsupported(opened.error);
    const { portal } = opened;
    const cells = all(portal, '[role="gridcell"]').filter(node => shown(node)
      && node.getAttribute('aria-label') === instruction.value && node.getAttribute('aria-disabled') !== 'true'
      && !node.hasAttribute('disabled'));
    if (cells.length !== 1) return unsupported(cells.length ? 'date_ambiguous' : 'date_not_visible');
    await H.safeClick(cells[0], ctx);
    const closing = await waitClosed(portal, ctx);
    return closing || { strategy: 'ui', attempts: 1 };
  }
  async function writeIvuSelect(el, instruction, ctx) {
    const p = M.inspect(el), ref = M.resolve(el), root = p.controlRoot || el;
    const face = root.querySelector('.ivu-select-selection');
    // Instance-owned dropdown refs also remain valid for transfer-to-body.
    const portal = ref.vm?.$refs?.dropdown?.$el;
    if (!face || !portal || !portal.isConnected) return unsupported('select_contract_unconfirmed');
    if (shown(portal)) return unsupported('control_busy');
    await H.safeClick(face, ctx);
    if (!await waitFor(() => shown(portal), ctx)) return unsupported('select_not_open');
    const hits = all(portal, '.ivu-select-item').filter(node => shown(node)
      && !node.classList.contains('ivu-select-item-disabled') && H.norm(node.textContent) === H.norm(instruction.labels[0]));
    if (hits.length !== 1) return unsupported(hits.length ? 'option_ambiguous' : 'option_not_found');
    await H.safeClick(hits[0], ctx);
    const closing = await waitClosed(portal, ctx);
    return closing || { strategy: 'ui', attempts: 1 };
  }
  async function writeIvuDate(el, instruction, ctx) {
    const ref = M.resolve(el), vm = ref.vm, root = ref.element || el;
    const face = inputOf(root), portal = vm?.$refs?.drop?.$el;
    if (!face || !portal || !portal.isConnected || vm?.$props?.open === true) return unsupported('date_contract_unconfirmed');
    if (shown(portal)) return unsupported('control_busy');
    await H.safeClick(face, ctx);
    if (!await waitFor(() => shown(portal), ctx)) return unsupported('calendar_not_open');
    const target = instruction.value.split('-').map(Number), wantedMonth = target[0] * 12 + target[1] - 1;
    const panel = vm.$refs.pickerPanel;
    if (!panel || panel.currentView !== 'date') return unsupported('calendar_view_unconfirmed');
    for (let count = 0; count < 120; count++) {
      await H.check(ctx);
      const current = panel.panelDate;
      if (!(current instanceof Date) || Number.isNaN(+current)) return unsupported('calendar_month_unconfirmed');
      const currentMonth = current.getFullYear() * 12 + current.getMonth();
      if (currentMonth === wantedMonth) break;
      const button = panel.$el.querySelector(currentMonth > wantedMonth
        ? '.ivu-date-picker-prev-btn-arrow:not(.ivu-date-picker-prev-btn-arrow-double)'
        : '.ivu-date-picker-next-btn-arrow:not(.ivu-date-picker-next-btn-arrow-double)');
      if (!button || !shown(button)) return unsupported('calendar_navigation_unavailable');
      await H.safeClick(button, ctx);
      if (panel.panelDate.getFullYear() * 12 + panel.panelDate.getMonth() === currentMonth) return unsupported('calendar_navigation_stalled');
    }
    const table = panel.$refs.pickerTable, cells = table?.cells;
    if (!Array.isArray(cells) || !table.$el?.isConnected) return unsupported('calendar_cells_unconfirmed');
    const matches = cells.map((cell, i) => ({ cell, i })).filter(({ cell }) => cell.date instanceof Date
      && cell.date.getFullYear() === target[0] && cell.date.getMonth() + 1 === target[1]
      && cell.date.getDate() === target[2] && !cell.disabled);
    if (matches.length !== 1) return unsupported('date_missing_or_disabled');
    const nodes = all(table.$el, '.ivu-date-picker-cells-cell');
    if (nodes.length !== cells.length || !nodes[matches[0].i] || !shown(nodes[matches[0].i])) return unsupported('calendar_cells_unconfirmed');
    await H.safeClick(nodes[matches[0].i], ctx);
    const closing = await waitClosed(portal, ctx);
    return closing || { strategy: 'ui', attempts: 1 };
  }

  const definitions = [
    ['ivu-select', 'iview', 'select', 'iSelect', writeIvuSelect],
    ['ivu-date', 'iview', 'date', 'CalendarPicker', writeIvuDate],
    ['ud-select', 'ud', 'select', 'UdSelect', writeAriaSelect],
    ['ud-date', 'ud', 'date', 'UdDatePicker', writeAriaDate],
    ['ud-cascader', 'ud', 'cascader', 'UdCascader', writeAriaCascader],
    ['phoenix-select', 'phoenix', 'select', 'PhoenixSelect', writeAriaSelect],
    ['phoenix-cascader', 'phoenix', 'cascader', 'PhoenixCascader', writeAriaCascader],
    ['phoenix-date', 'phoenix', 'date', 'PhoenixDatePicker', writeAriaDate],
  ];
  for (const [name, lib, type, componentName, performWrite] of definitions) {
    R.register({ name, lib, type, priority: type === 'cascader' ? 675 : type === 'date' ? 525 : 425,
      libVersionProbe: (el, p = M.inspect(el)) => p.lib === lib ? versionProbe(el, p) : null,
      matches: (el, p) => p.lib === lib && p.componentName === componentName && !!versionProbe(el, p),
      readModel: modelFor,
      plan: type === 'date' ? datePlan : type === 'cascader' ? cascaderPlan : selectPlan,
      async performWrite(el, instruction, ctx) {
        const initial = M.resolve(el), initialProbe = M.inspect(el);
        const guarded = { ...ctx, check: async () => {
          await ctx.check();
          const current = M.resolve(el), probe = M.inspect(el);
          if (R.resolve(el)?.name !== name || probe.version !== initialProbe.version
            || probe.controlRoot !== initialProbe.controlRoot || current.vm !== initial.vm
            || current.componentType !== initial.componentType || probe.disabled || probe.readonly)
            throw Error('control_or_version_changed');
        } };
        return performWrite(el, instruction, guarded);
      },
    });
  }
})();
