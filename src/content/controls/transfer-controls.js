// Generic owned dual-list transfers. Public keys identify rows; only checkbox
// and direction-button UI actions write. No component setter/emit or persistence.
(() => {
  'use strict';
  const R = globalThis.ResumeControls, M = globalThis.ResumeControlModel;
  if (!R || !M) throw Error('control_registry_missing');
  if (R.list().some(adapter => adapter.name === 'el-transfer')) return;
  const H = R.helpers, n = H.norm, selector = '.el-transfer,.ant-transfer';
  const all = (root, css) => root ? [...root.querySelectorAll(css)] : [];
  const flags = { writeStarted: false, liveSupportClaimed: false };
  const manual = reason => ({ status: 'manual', reason, ...flags });
  const same = (a, b) => typeof a === typeof b && a === b;
  const has = (list, key) => list.some(value => same(value, key));
  const setEqual = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every(value => has(b, value));
  const primitive = value => typeof value === 'string' && !!n(value) || typeof value === 'number' && Number.isFinite(value);
  const visible = node => !!node?.isConnected && node.ownerDocument === document && node.getRootNode() === document
    && !!node.getClientRects().length && !node.closest('[hidden],[aria-hidden="true"],[inert]')
    && (() => { for (let el = node; el; el = el.parentElement) {
      const style = getComputedStyle(el);
      if (style.display === 'none' || ['hidden', 'collapse'].includes(style.visibility)) return false;
    } return true; })();
  function owns(vm, owner) {
    for (let count = 0; vm && count++ < 40; vm = vm.$parent) if (vm === owner) return true;
    return false;
  }
  function reference(el) {
    const root = el?.closest?.(selector);
    if (!root) return null;
    const family = root.matches('.el-transfer') ? 'el' : 'ant', name = family === 'el' ? 'ElTransfer' : 'ATransfer';
    for (let owner = root.__vue__, count = 0; owner && count++ < 30; owner = owner.$parent) {
      if (owner.$options?.name === name && owner.$el === root) return { root, owner, family, props: owner.$props || {},
        version: family === 'el' ? globalThis.ELEMENT?.version : globalThis.antd?.version };
    }
    return { root, family, props: {}, owner: null };
  }
  const supported = ref => !!ref?.owner && (ref.family === 'el' ? ref.version === '2.15.14' : ref.version === '1.7.8');
  function optionsFor(ref) {
    const p = ref.props, config = p.props || {}, field = ref.family === 'el'
      ? { key: config.key || 'key', label: config.label || 'label', disabled: config.disabled || 'disabled' }
      : { key: 'key', label: 'title', disabled: 'disabled' };
    const raw = ref.family === 'el' ? p.data : p.dataSource;
    let valid = Array.isArray(raw) && raw.length <= 1000 && Object.values(field).every(key => typeof key === 'string' && !!key)
      && !p.rowKey && !p.pagination && !p.oneWay && !ref.owner?.$scopedSlots?.default;
    const options = valid ? raw.map(item => {
      const value = item?.[field.key], text = item?.[field.label] ?? (ref.family === 'el' ? value : undefined);
      if (!primitive(value) || !primitive(text)) valid = false;
      return { value, label: primitive(text) ? n(text) : '', disabled: !!item?.[field.disabled] };
    }) : [];
    if (new Set(options.map(option => String(option.value))).size !== options.length) valid = false;
    return { options, valid, field };
  }
  function layout(ref) {
    const { root, family } = ref;
    const panels = [...root.children].filter(node => node.matches(family === 'el' ? '.el-transfer-panel' : '.ant-transfer-list'));
    const groups = [...root.children].filter(node => node.matches(family === 'el' ? '.el-transfer__buttons' : '.ant-transfer-operation'));
    const buttons = groups.length === 1 ? [...groups[0].children].filter(node => node.matches('button[type="button"]')) : [];
    const rows = panels.map(panel => all(panel, family === 'el' ? '.el-transfer-panel__item' : '.ant-transfer-list-content-item'));
    const valid = panels.length === 2 && groups.length === 1 && buttons.length === 2
      && all(root, selector).length === 0 && panels.every(visible)
      && all(root, 'button').length === 2 && buttons.every(button => visible(button) && button.type === 'button'
        && !button.closest('label') && !button.querySelector('a,input,select,textarea,button,[contenteditable]'));
    return { panels, rows, buttons, valid, left: family === 'el' ? buttons[0] : buttons[1], right: family === 'el' ? buttons[1] : buttons[0] };
  }
  function rowInfo(row, ref) {
    const vm = row.__vue__, p = vm?.$props || {}, ant = ref.family === 'ant';
    const input = row.querySelector('input[type="checkbox"]'), label = row.querySelector(ant ? '.ant-transfer-list-content-item-text' : '.el-checkbox__label');
    const value = ant ? p.item?.key : p.label;
    const unsafe = all(label, 'button,a,input,select,textarea,[role="button"],[contenteditable]').length;
    return { row, vm, input, label: n(label?.textContent), value,
      valid: !!vm && owns(vm, ref.owner) && vm.$options?.name === (ant ? 'ListItem' : 'ElCheckbox')
        && !!input && all(row, 'input').length === 1 && !!label && !unsafe && visible(row)
        && (ant ? !row.closest('label') : row.tagName === 'LABEL' && row.control === input && !row.htmlFor)
        && !row.closest('button,a[href],[role="button"]'),
      disabled: !!input?.disabled || !!p.disabled || !!p.item?.disabled, checked: !!input?.checked };
  }
  function modelFor(el) {
    const ref = reference(el);
    if (!ref) return { available: false, reason: 'transfer_owner_unconfirmed', controlRoot: el, transferOwners: [], ...flags };
    const { root, owner, props, family } = ref, data = optionsFor(ref), ui = layout(ref);
    const value = family === 'el' ? props.value : props.targetKeys;
    const rows = ui.rows.map(list => list.map(row => rowInfo(row, ref)));
    const validValue = Array.isArray(value) && value.length <= 1000 && value.every(primitive)
      && new Set(value.map(String)).size === value.length && value.every(key => data.options.some(option => same(option.value, key)));
    const structure = ui.valid && rows.flat().every(row => row.valid)
      && rows.flat().length === data.options.length
      && new Set(rows.flat().map(row => String(row.value))).size === data.options.length
      && rows.flat().every(row => data.options.some(option => same(option.value, row.value) && option.disabled === row.disabled));
    const consistent = validValue && structure && rows.every((list, side) => list.every(row =>
      has(value, row.value) === (side === 1) && data.options.some(option => same(option.value, row.value) && option.label === row.label)));
    const disabled = !!props.disabled || !!root.closest('[disabled],[aria-disabled="true"]');
    const readonly = !!props.readonly || !!root.closest('[readonly],[aria-readonly="true"]')
      || !!root.querySelector('[readonly],[aria-readonly="true"]');
    const shell = !!root.closest('label,button,a[href],[role="button"]') || !visible(root);
    const filtered = all(root, 'input:not([type="checkbox"])').some(input => !['text', 'search'].includes(input.type) || !!input.value);
    const busy = rows.flat().some(row => row.checked) || all(root, '.el-transfer-panel__header input:checked,.ant-transfer-list-header input:checked').length > 0;
    return { available: supported(ref) && data.valid && validValue && structure && !shell && !filtered,
      reason: !supported(ref) ? 'transfer_version_unconfirmed' : shell || !structure ? 'transfer_structure_unconfirmed'
        : filtered ? 'transfer_filter_active' : 'transfer_data_unconfirmed',
      controlRoot: root, transferOwners: owner ? [owner] : [], framework: 'vue2', version: ref.version, family,
      value: validValue ? value.slice() : value, domValue: rows[1]?.map(row => row.label) || [], options: data.options,
      disabled, readonly, transferConsistent: consistent, transferBusy: busy,
      transferContract: JSON.stringify([family, ref.version, data.field, data.options, props.targetOrder, !!props.rowKey,
        props.renderContent?.toString(), props.render?.toString(), props.selectedKeys]),
      readbackSource: 'owned_transfer_model_and_target_rows', ...flags };
  }
  function plan(fact, model, ctx) {
    if (model.disabled || model.readonly) return manual(model.disabled ? 'disabled' : 'readonly');
    if (!model.available) return manual(model.reason || 'transfer_data_unconfirmed');
    if (!model.transferConsistent) return manual('transfer_readback_mismatch');
    if (model.transferBusy) return manual('transfer_busy');
    const object = fact && typeof fact === 'object' && !Array.isArray(fact), requested = object ? fact.value : fact;
    const operation = object ? fact.operation ?? 'set' : 'set';
    if (!['set', 'add', 'remove'].includes(operation) || !Array.isArray(requested) || requested.length > 1000 || !requested.every(primitive))
      return manual('explicit_transfer_values_required');
    const keys = [];
    for (const part of requested) {
      const hits = model.options.filter(option => same(part, option.value) || !ctx?.modelValue && typeof part === 'string' && n(part) === option.label);
      if (hits.length !== 1) return manual(hits.length ? 'transfer_option_ambiguous' : 'transfer_option_missing');
      if (has(keys, hits[0].value)) return manual('transfer_option_duplicate');
      keys.push(hits[0].value);
    }
    const target = operation === 'set' ? keys : operation === 'add' ? [...model.value, ...keys.filter(key => !has(model.value, key))]
      : model.value.filter(key => !has(keys, key));
    if (model.options.some(option => option.disabled && has(model.value, option.value) !== has(target, option.value))) return manual('transfer_option_disabled');
    const labels = target.map(key => model.options.find(option => same(option.value, key)).label), unchanged = setEqual(model.value, target);
    return { status: unchanged ? 'success' : 'planned', reason: unchanged ? 'preexisting_same_value' : 'ready', operation: 'set',
      value: target, modelValue: target.slice(), domValue: labels, labels: labels.slice(), readbackSource: model.readbackSource, ...flags };
  }
  async function write(el, instruction, ctx) {
    const start = modelFor(el), initial = reference(el), root = start.controlRoot;
    let attempts = 0, expected = start.value.slice(), selected = [], moving = null;
    const stop = reason => ({ status: 'unsupported', reason, strategy: attempts ? 'ui' : 'none', attempts, ...flags, writeStarted: attempts > 0 });
    const stable = async () => {
      await ctx.check();
      const live = modelFor(el), ref = reference(el), ui = layout(ref);
      if (!live.available || live.disabled || live.readonly || !live.transferConsistent || live.controlRoot !== root
        || ref.owner !== initial.owner || live.transferContract !== start.transferContract) throw Error('control_changed');
      const complete = moving && setEqual(live.value, moving);
      if (!setEqual(live.value, expected) && !complete) throw Error('control_value_changed');
      const checked = ui.rows.flat().map(row => rowInfo(row, ref)).filter(row => row.checked);
      if (!complete && (checked.length !== selected.length || checked.some(row => !selected.includes(row.row)))) throw Error('transfer_selection_changed');
      if (ui.panels.some((panel, side) => {
        const header = panel.querySelector(ref.family === 'el' ? '.el-transfer-panel__header input' : '.ant-transfer-list-header input');
        const enabled = ui.rows[side].map(row => rowInfo(row, ref)).filter(row => !row.disabled);
        return header?.checked && (!enabled.length || enabled.some(row => !row.checked));
      })) throw Error('transfer_selection_changed');
    };
    for (const side of [1, 0]) {
      const keys = side ? expected.filter(key => !has(instruction.value, key)) : instruction.value.filter(key => !has(expected, key));
      if (!keys.length) continue;
      selected = []; moving = null;
      for (const key of keys) {
        await stable();
        const ref = reference(el), ui = layout(ref), hits = ui.rows[side].map(row => rowInfo(row, ref)).filter(row => same(row.value, key));
        if (hits.length !== 1 || !hits[0].valid || hits[0].disabled || hits[0].checked) return stop('transfer_row_unconfirmed');
        const entry = hits[0], target = ref.family === 'el' ? entry.input : entry.row;
        // Permit this checkbox's native label only when it exclusively owns the
        // intended input. An external label can activate a submit control.
        await H.safeClick(target, { ...ctx, async check() {
          await stable();
          const row = rowInfo(entry.row, reference(el));
          if (row.vm !== entry.vm || !row.valid || row.disabled || row.input !== entry.input || !same(row.value, key)
            || !layout(reference(el)).rows[side].includes(entry.row)) throw Error('transfer_row_changed');
        } });
        attempts++; selected.push(entry.row);
      }
      await stable();
      const ref = reference(el), ui = layout(ref), button = side ? ui.left : ui.right;
      moving = side ? expected.filter(key => !has(keys, key)) : [...expected, ...keys];
      await H.safeClick(button, { ...ctx, async check() {
        await stable();
        const liveUI = layout(reference(el));
        if ((side ? liveUI.left : liveUI.right) !== button || button.type !== 'button'
          || button.closest(selector) !== root || button.closest('label') || !visible(button)) throw Error('transfer_button_changed');
      } });
      attempts++;
      for (let count = 0; count < 30 && !setEqual(modelFor(el).value, moving); count++) { await stable(); await H.tick(20); }
      await stable();
      if (!setEqual(modelFor(el).value, moving) || modelFor(el).transferBusy) return stop('transfer_move_unconfirmed');
      expected = moving; moving = null; selected = [];
    }
    return { strategy: 'ui', attempts, writeStarted: attempts > 0, liveSupportClaimed: false };
  }
  for (const [family, name, lib] of [['el', 'el-transfer', 'element-ui'], ['ant', 'ant-transfer', 'ant-design-vue']]) {
    R.register({ name, lib, type: 'transfer', priority: 850,
      matches: el => reference(el)?.family === family,
      libVersionProbe(el) { const ref = reference(el); return ref?.family === family ? { lib, version: ref.version || null, reviewed: supported(ref) } : null; },
      readModel: modelFor, plan, performWrite: write });
  }
})();
