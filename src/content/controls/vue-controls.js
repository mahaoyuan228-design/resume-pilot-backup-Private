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
  const autocomplete = p => /^(?:ElAutocomplete|AAutoComplete)$/u.test(p.componentName);
  const unsupported = reason => ({ status: 'unsupported', reason });
  const choiceName = /^(?:El|A)(?:Radio|Checkbox|Switch)(?:Group)?$/u;
  const primitive = value => ['string', 'boolean'].includes(typeof value) || typeof value === 'number' && Number.isFinite(value);
  const sameValue = (a, b) => typeof a === typeof b && a === b;
  const sameChoices = (a, b) => Array.isArray(a) && Array.isArray(b)
    ? a.length === b.length && a.every((value, index) => sameValue(value, b[index])) : sameValue(a, b);
  function choiceOptions(root, p) {
    const type = /Radio/u.test(p.componentName) ? 'radio' : 'checkbox';
    const inputs = [...(root.matches?.(`input[type="${type}"]`) ? [root] : []), ...all(root, `input[type="${type}"]`)];
    return inputs.map(input => {
      const label = input.labels?.[0] || input.closest('label');
      const value = /Group$/u.test(p.componentName) ? input._value ?? input.value : p.optionValue;
      return { input, click: label || input, value, valueSupported: primitive(value), owned: resolve(input).element === root,
        label: n(input.getAttribute('aria-label') || label?.textContent || input.value),
        disabled: !!input.disabled || input.matches(':disabled') || !!input.closest('[aria-disabled="true"]') };
    });
  }
  function choiceModel(el, p) {
    const root = rootOf(el, p), group = /Group$/u.test(p.componentName), radio = /Radio/u.test(p.componentName);
    const toggle = /Switch$/u.test(p.componentName), records = choiceOptions(root, p);
    const { vm } = resolve(el);
    const disabled = !!(vm?.disabled || vm?.$props?.disabled || root.matches?.(':disabled')
      || root.closest('[aria-disabled="true"],[inert]')) || (!group && !!records[0]?.disabled);
    const readonly = p.readonly || root.getAttribute('aria-readonly') === 'true'
      || records.some(record => (!toggle && record.input.readOnly) || record.input.getAttribute('aria-readonly') === 'true');
    if (toggle || !group && !radio) {
      const role = root.matches?.('[role="switch"]') ? root : root.querySelector('[role="switch"]');
      const aria = role?.getAttribute('aria-checked');
      const checked = toggle && role ? aria === 'true' ? true : aria === 'false' ? false
        : aria == null && p.lib === 'ant-design-vue' && role.matches('button.ant-switch')
          ? role.classList.contains('ant-switch-checked')
          : aria == null && p.lib === 'element-ui' && records.length === 1 && records[0].owned
            ? records[0].input.checked : null : records[0]?.input.checked;
      const active = p.checkedValue, inactive = p.uncheckedValue;
      return { ...p, disabled, readonly, domValue: checked, choiceKind: 'boolean',
        available: p.available && p.choiceValuesSupported && !sameValue(active, inactive)
          && typeof checked === 'boolean' && (toggle || records.length === 1)
          && (sameValue(p.value, active) || sameValue(p.value, inactive)),
        choiceConsistent: checked === sameValue(p.value, active) };
    }
    const options = records.map(({ input, click, ...option }) => option), selected = records.filter(record => record.input.checked);
    const raw = p.componentName === 'ARadio' ? p.value ? p.optionValue : '' : radio ? p.value ?? '' : p.value;
    const known = group && !radio ? Array.isArray(raw) && raw.every(value => options.some(option => sameValue(option.value, value))) : true;
    const value = group && !radio && known ? options.filter(option => raw.some(value => sameValue(value, option.value))).map(option => option.value) : raw;
    const domModel = radio ? selected[0]?.value ?? '' : selected.map(option => option.value);
    return { ...p, disabled, readonly, options, value, choiceKind: group ? 'group' : 'radio',
      domValue: radio ? selected[0]?.label || '' : selected.map(option => option.label),
      available: p.available && known && records.length > 0 && options.every(option => option.valueSupported && option.owned)
        && (group || records.length === 1) && (!radio || selected.length <= 1)
        && !options.some((option, index) => options.slice(0, index).some(previous => sameValue(previous.value, option.value))),
      choiceConsistent: sameChoices(value, domModel) };
  }

  function modelFor(el, probe) {
    if (choiceName.test(probe.componentName)) return choiceModel(el, probe);
    const root = rootOf(el, probe);
    if (probe.multiple && /^(?:ElSelect|ASelect)$/u.test(probe.componentName)) {
      const selector = probe.lib === 'element-ui' ? '.el-select__tags-text' : '.ant-select-selection__choice__content';
      const chips = all(root, selector).filter(node => shown(node) && node.closest('.el-select,.ant-select') === root);
      const inputs = all(root, 'input:not([type="hidden"])');
      return { ...probe, value: probe.value ?? [], domValue: chips.map(node => n(node.textContent)),
        available: probe.available && !probe.multiUnsupported && (probe.value == null || Array.isArray(probe.value) && probe.value.every(primitive)),
        disabled: probe.disabled || inputs.some(input => input.disabled || input.matches(':disabled'))
          || !!root.closest('[aria-disabled="true"],[inert]'),
        readonly: probe.readonly || root.getAttribute('aria-readonly') === 'true'
          || inputs.some(input => input.getAttribute('aria-readonly') === 'true') };
    }
    let domValue;
    let options = probe.options;
    if (probe.componentName === 'ACascader') {
      domValue = valueInput(root)?.value || n(root.querySelector('.ant-cascader-picker-label')?.textContent);
    } else if (probe.lib === 'ant-design-vue' && /Select/u.test(probe.componentName)) {
      const selected = all(root, '.ant-select-selection-selected-value,.ant-select-selection__choice__content');
      domValue = selected.length ? selected.map(node => n(node.textContent)).join(' | ') : '';
    } else {
      const input = valueInput(root);
      domValue = input ? input.value : n(root.textContent);
    }
    const monthInputs = probe.lib === 'ant-design-vue' && probe.componentName === 'AMonthPicker'
      ? all(root, 'input:not([type="hidden"])') : null;
    const textarea = probe.componentName === 'ATextarea' || probe.componentName === 'ElInput' && probe.type === 'textarea';
    const input = textarea ? valueInput(root) : null;
    return { ...probe, options, domValue,
      ...(textarea ? { available: probe.available && input?.tagName === 'TEXTAREA',
        disabled: probe.disabled || !!input?.disabled || !!input?.matches(':disabled')
          || !!input?.closest('[aria-disabled="true"],[inert]'),
        readonly: probe.readonly || !!input?.readOnly || !!input?.closest('[aria-readonly="true"]'),
        maxLength: input?.maxLength ?? -1 } : {}),
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
    const probe = inspect(el), root = rootOf(el, probe), input = valueInput(root);
    if (!input || input.readOnly || input.disabled) return unsupported('control_guard');
    if (probe.componentName === 'ATextarea' || probe.componentName === 'ElInput' && probe.type === 'textarea') {
      if (input.tagName !== 'TEXTAREA' || typeof instruction.value !== 'string') return unsupported('invalid_textarea_value');
      const value = H.prose(instruction.value), initial = modelFor(el, probe), owner = resolve(el).vm;
      if (!initial.available || initial.disabled || initial.readonly) return unsupported('control_guard');
      if ((!empty(initial.value) && !H.proseEqual(initial.value, value))
        || (!empty(initial.domValue) && !H.proseEqual(initial.domValue, value))) return unsupported('existing_value');
      if (initial.maxLength >= 0 && value.length > initial.maxLength) return unsupported('value_too_long');
      const same = (a, b) => a === b || H.proseEqual(a, b);
      const guarded = { ...ctx, async check() {
        await ctx.check();
        const current = modelFor(el, inspect(el));
        if (!input.isConnected || resolve(el).vm !== owner || current.controlRoot !== root
          || valueInput(root) !== input || current.version !== probe.version
          || !current.available || current.disabled || current.readonly
          || current.maxLength >= 0 && value.length > current.maxLength) throw Error('control_changed');
        if ((!same(current.value, initial.value) && !H.proseEqual(current.value, value))
          || (!same(current.domValue, initial.domValue) && !H.proseEqual(current.domValue, value))) throw Error('existing_value');
      } };
      await H.nativeSet(input, value, guarded);
      return { strategy: 'native', attempts: 1 };
    }
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

  async function writeSearch(el, instruction, ctx) {
    const p = inspect(el), root = rootOf(el, p), owner = resolve(el).vm;
    const menuSelector = '.el-select-dropdown,.el-autocomplete-suggestion,.ant-select-dropdown';
    const menus = () => all(document, menuSelector).filter(shown);
    if (menus().length) return unsupported('control_busy');
    const inputs = all(root, 'input:not([type="hidden"])');
    if (inputs.length !== 1 || inputs[0].disabled) return unsupported('search_input_unavailable');
    const search = inputs[0], desired = n(instruction.labels?.[0] ?? instruction.value);
    let menu, menuRefs, filtering = false, selecting = false, selectedValue;
    const componentRefs = () => [owner?.$refs?.popper?.$el, owner?.$refs?.suggestions?.$el].filter(Boolean);
    const ownsMenu = candidate => {
      const refs = componentRefs();
      if (refs.some(ref => ref !== candidate && !candidate.contains(ref))
        || menuRefs && (refs.length !== menuRefs.length || refs.some((ref, index) => ref !== menuRefs[index]))) return false;
      for (const node of [root, ...all(root, '[aria-controls],[aria-owns]')]) {
        for (const id of `${node.getAttribute('aria-controls') || ''} ${node.getAttribute('aria-owns') || ''}`.trim().split(/\s+/u).filter(Boolean)) {
          const targets = all(document, '[id]').filter(target => target.id === id);
          if (targets.length > 1) return false;
          if (targets.length === 1) {
            if (targets[0] !== candidate && !candidate.contains(targets[0])) return false;
            const peers = all(document, '[aria-controls],[aria-owns]').filter(peer => peer !== root && !root.contains(peer)
              && ['aria-controls', 'aria-owns'].some(name => (peer.getAttribute(name) || '').split(/\s+/u).includes(id)));
            if (peers.length) return false;
            refs.push(targets[0]);
          }
        }
      }
      return refs.some(ref => ref === candidate || candidate.contains(ref));
    };
    const searchCtx = { ...ctx, async check() {
      await ctx.check();
      const current = inspect(el);
      const currentInputs = all(root, 'input:not([type="hidden"])');
      if (!el.isConnected || resolve(el).vm !== owner || current.controlRoot !== root
        || current.version !== p.version || !current.available || current.disabled || current.readonly
        || currentInputs.length !== 1 || currentInputs[0] !== search || !search.isConnected
        || search.disabled || filtering && (search.readOnly || search.getAttribute('aria-readonly') === 'true')
        || !shown(root)) throw Error('control_changed');
      if (!sameValue(current.value, p.value) && !(empty(current.value) && empty(p.value))
        && !(autocomplete(p) && H.equal(current.value, desired))
        && !(selecting && sameValue(current.value, selectedValue))) throw Error('existing_value');
      const visible = menus();
      if (visible.length > 1 || visible.some(candidate => menu ? candidate !== menu : !ownsMenu(candidate))) throw Error('overlay_ambiguous');
    } };
    const face = p.lib === 'ant-design-vue' ? root.querySelector('.ant-select-selection') : search;
    if (!face) return unsupported('control_guard');
    await H.safeClick(face, searchCtx);
    // Filtering must not dispatch change/blur: autocomplete commits and closes
    // on those events even though no catalog option has been selected.
    await H.nativeSet(search, desired, searchCtx, ['input']);
    filtering = true;
    const optionSelector = p.lib === 'element-ui'
      ? autocomplete(p) ? '[role="option"]' : '.el-select-dropdown__item' : '.ant-select-dropdown-menu-item';
    const exactOptions = () => all(menu, optionSelector).filter(node => shown(node)
      && !node.matches('.is-disabled,.ant-select-dropdown-menu-item-disabled,[aria-disabled="true"],:disabled')
      && !node.closest('[aria-disabled="true"]') && n(node.textContent) === desired);
    const busy = () => owner?.loading || menu.matches('.is-loading,[aria-busy="true"]')
      || menu.querySelector('[aria-busy="true"],.ant-spin-spinning,.el-loading-mask');
    for (let count = 0; count < 80; count++) {
      await H.check(searchCtx);
      const visible = menus();
      if (visible.length > 1) return unsupported('overlay_ambiguous');
      if (visible.length === 1) {
        if (menu && menu !== visible[0] || !ownsMenu(visible[0])) return unsupported('overlay_unowned');
        menu = visible[0]; menuRefs ||= componentRefs();
        const matches = exactOptions();
        if (matches.length > 1) return unsupported('option_ambiguous');
        if (!busy() && matches.length === 1) {
          const model = modelFor(el, inspect(el));
          const options = model.options.filter(option => !option.disabled && n(option.label) === desired);
          if (options.length !== 1 || options[0].valueSupported === false) return unsupported('option_unconfirmed');
          if (!instruction.requiresOptionResolution && !H.equal(options[0].value, instruction.value)) return unsupported('instruction_stale');
          const optionCtx = { ...searchCtx, async check() {
            await searchCtx.check();
            const current = exactOptions();
            const live = modelFor(el, inspect(el)).options.filter(option => !option.disabled && n(option.label) === desired);
            if (!shown(menu) || busy() || current.length !== 1 || current[0] !== matches[0] || !ownsMenu(menu)
              || live.length !== 1 || !sameValue(live[0].value, options[0].value)
              || live[0].valueSupported === false) throw Error('option_changed');
          } };
          selecting = true; selectedValue = options[0].value;
          await H.safeClick(matches[0], optionCtx);
          filtering = false;
          H.confirmSearchOption(instruction, model, options[0]);
          const closing = await waitOwnedClosed(el, menu, menuSelector, searchCtx);
          return closing || { strategy: 'ui', interaction: 'search', attempts: 1 };
        }
      }
      await pause(20);
    }
    return unsupported('option_not_found');
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
    if (model.multiple) return unsupported('multiple_select_manual');
    if (!primitive(fact.value)) return unsupported('explicit_option_required');
    if (typeof fact.value === 'string' && (!n(fact.value) || fact.value.length > 160))
      return unsupported('explicit_option_required');
    const hits = (model.options || []).filter(option => H.equal(option.value, fact.value) || H.equal(option.label, fact.value));
    if (hits.length) {
      const plan = H.makePlan(fact, model, { type: 'select' });
      return autocomplete(model) && ['planned', 'success'].includes(plan.status)
        ? { ...plan, status: 'planned', requiresOptionClick: true } : plan;
    }
    if (typeof fact.value !== 'string') return unsupported('explicit_option_required');
    const existing = H.makePlan(fact, { ...model, options: [] }, { type: 'text' });
    if (existing.status !== 'planned' && !(autocomplete(model) && existing.status === 'success')) return existing;
    return { status: 'planned', reason: 'search_options_deferred', value: fact.value,
      labels: [fact.value], domValue: fact.value, strategy: 'ui', interaction: 'search', requiresOptionResolution: true };
  }

  function multiPlan(fact, model) {
    if (model.disabled || model.readonly) return unsupported(model.disabled ? 'disabled' : 'readonly');
    if (!model.available || !model.multiple) return unsupported('multi_select_contract_unconfirmed');
    const requested = fact?.value;
    if (!Array.isArray(requested) || !requested.length || requested.length > 30
      || !requested.every(value => primitive(value) && (typeof value !== 'string' || n(value) && value.length <= 160)))
      return unsupported('explicit_values_required');
    const options = model.options || [], values = [...model.value], labels = [];
    for (const value of values) {
      const hits = options.filter(option => sameValue(option.value, value));
      if (hits.length > 1 || hits[0]?.valueSupported === false || !hits.length && !(model.creatable && typeof value === 'string'))
        return unsupported('selected_option_unconfirmed');
      labels.push(hits[0]?.label ?? n(value));
    }
    if (values.some((value, index) => values.slice(0, index).some(previous => sameValue(previous, value)))
      || !H.equal(model.domValue, labels)) return unsupported('selected_chips_mismatch');
    for (const part of requested) {
      const hits = options.filter(option => sameValue(option.value, part) || typeof part === 'string' && n(option.label) === n(part));
      if (hits.length > 1) return unsupported('option_ambiguous');
      const option = hits[0];
      if (option && (option.disabled || option.valueSupported === false || !primitive(option.value))) return unsupported('option_unavailable');
      if (!option && !(model.creatable && typeof part === 'string' && part === n(part))) return unsupported('option_missing');
      const value = option ? option.value : part, label = option ? option.label : part;
      if (!values.some(previous => sameValue(previous, value))) { values.push(value); labels.push(label); }
    }
    if (values.length > 30 || model.multipleLimit > 0 && values.length > model.multipleLimit) return unsupported('multiple_limit');
    const same = sameChoices(model.value, values) && H.equal(model.domValue, labels);
    return { status: same ? 'success' : 'planned', reason: same ? 'preexisting_same_value' : 'ready',
      value: values, modelValue: values, domValue: labels, labels, writeStarted: false, liveSupportClaimed: false };
  }

  async function writeMulti(el, instruction, ctx) {
    const initial = inspect(el), root = initial.controlRoot, owner = resolve(el).vm;
    const menuSelector = '.el-select-dropdown,.ant-select-dropdown';
    const menus = () => all(document, menuSelector).filter(shown);
    const inputs = all(root, 'input:not([type="hidden"])');
    const search = inputs.find(input => !input.readOnly) || inputs[0];
    const face = initial.lib === 'element-ui' ? search : root.querySelector('.ant-select-selection');
    if (!face || !search || search.value || menus().length) return unsupported('control_busy');
    let baseline = modelFor(el, initial);
    let menu;
    const ownsMenu = candidate => {
      const refs = [owner?.$refs?.popper?.$el].filter(Boolean);
      for (const node of [root, ...all(root, '[aria-controls],[aria-owns]')]) {
        for (const id of `${node.getAttribute('aria-controls') || ''} ${node.getAttribute('aria-owns') || ''}`.split(/\s+/u).filter(Boolean)) {
          const targets = all(document, '[id]').filter(target => target.id === id);
          if (targets.length !== 1) return false;
          if (all(document, '[aria-controls],[aria-owns]').some(peer => peer !== root && !root.contains(peer)
            && ['aria-controls', 'aria-owns'].some(name => (peer.getAttribute(name) || '').split(/\s+/u).includes(id)))) return false;
          refs.push(targets[0]);
        }
      }
      return refs.length > 0 && refs.every(ref => ref === candidate || candidate.contains(ref));
    };
    const guarded = { ...ctx, async check() {
      await ctx.check();
      const p = inspect(el), live = modelFor(el, p), plan = multiPlan({ value: instruction.value }, live);
      if (resolve(el).vm !== owner || p.controlRoot !== root || p.version !== initial.version
        || p.creatable !== initial.creatable || p.multipleLimit !== initial.multipleLimit
        || inputs.some(input => !root.contains(input)) || !root.contains(face)
        || !sameChoices(live.value, baseline.value) || !H.equal(live.domValue, baseline.domValue)
        || !['planned', 'success'].includes(plan.status) || !sameChoices(plan.value, instruction.value)
        || !H.equal(plan.labels, instruction.labels)) throw Error('multi_select_contract_changed');
      if (menu && (!ownsMenu(menu) || menus().some(node => node !== menu))) throw Error('overlay_ownership_changed');
    } };
    await H.safeClick(face, guarded);
    for (let turn = 0; turn < 40; turn++) {
      await H.check(guarded);
      const visible = menus();
      if (visible.length > 1) return unsupported('overlay_ambiguous');
      if (visible.length === 1) { menu = visible[0]; break; }
      await pause(20);
    }
    if (!menu || !ownsMenu(menu)) return unsupported('overlay_ownership_unconfirmed');
    let attempts = 0;
    try {
      for (let index = initial.value?.length || 0; index < instruction.value.length; index++) {
        await H.check(guarded);
        const label = instruction.labels[index];
        // In tags mode typing a known label can create a second option whose
        // string value differs from the known code. Click existing options as
        // displayed; type only an explicit new tag (or an ordinary filter).
        const known = inspect(el).options.some(option => sameValue(option.value, instruction.value[index]));
        if (initial.creatable ? !known : initial.filterable) await H.nativeSet(search, label, guarded, ['input']);
        const selector = initial.lib === 'element-ui' ? '.el-select-dropdown__item' : '.ant-select-dropdown-menu-item';
        const hits = () => all(menu, selector).filter(node => shown(node) && n(node.textContent) === n(label)
          && !node.closest('[disabled],[aria-disabled="true"],.is-disabled,.ant-select-dropdown-menu-item-disabled'));
        const busy = () => menu.matches('[aria-busy="true"]') || !!menu.querySelector('[aria-busy="true"],.ant-spin-spinning,.el-loading-mask');
        let target;
        for (let turn = 0; turn < 80; turn++) {
          await H.check(guarded);
          if (!shown(menu)) return unsupported('control_changed');
          const matches = hits();
          if (matches.length > 1) return unsupported('option_ambiguous');
          if (!busy() && matches.length === 1) { target = matches[0]; break; }
          await pause(20);
        }
        if (!target) return unsupported('option_not_found');
        await H.safeClick(target, { ...guarded, async check() {
          await guarded.check();
          if (!shown(menu) || busy() || hits().length !== 1 || hits()[0] !== target) throw Error('option_changed');
        } });
        attempts++;
        // A query or a painted chip is insufficient: each click must commit
        // exactly the next typed model value and its independent visible label.
        const live = modelFor(el, inspect(el));
        if (!sameChoices(live.value, instruction.value.slice(0, index + 1))
          || !H.equal(live.domValue, instruction.labels.slice(0, index + 1))) return unsupported('selection_not_committed');
        baseline = live;
      }
      return { strategy: 'ui', interaction: 'multiple', attempts };
    } finally {
      if (shown(menu)) {
        await H.check(guarded);
        search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true }));
        const closing = await waitOwnedClosed(el, menu, menuSelector, guarded);
        if (closing) return closing;
      }
    }
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

  function choicePlan(fact, model, type, ctx) {
    const value = fact && typeof fact === 'object' && !Array.isArray(fact) ? fact.value : fact;
    if (model.disabled || model.readonly) return { status: 'manual', reason: model.disabled ? 'disabled' : 'readonly' };
    if (!model.available) return unsupported('model_unavailable');
    if (!model.choiceConsistent) return unsupported('choice_readback_mismatch');
    if (model.choiceKind === 'boolean') {
      if (value == null || value === '' && !ctx?.modelValue) return unsupported('no_fact');
      const target = !ctx?.modelValue && typeof value === 'boolean' ? value ? model.checkedValue : model.uncheckedValue : value;
      if (!sameValue(target, model.checkedValue) && !sameValue(target, model.uncheckedValue)) return unsupported(`invalid_${type}_value`);
      const checked = sameValue(target, model.checkedValue);
      if (model.domValue && !checked) return unsupported('existing_value');
      const same = sameValue(model.value, target) && model.domValue === checked;
      return { status: same ? 'success' : 'planned', reason: same ? 'preexisting_same_value' : 'ready',
        value: target, modelValue: target, domValue: checked, labels: [] };
    }
    if (type === 'checkbox') {
      if (!Array.isArray(value)) return unsupported('invalid_checkbox_value');
      if (!value.length) return unsupported('no_fact');
      const target = [...model.value];
      for (const choice of value) {
        const hits = model.options.filter(option => (!option.disabled || target.some(v => sameValue(v, option.value)))
          && (H.equal(option.value, choice) || H.equal(option.label, choice)));
        if (hits.length !== 1) return unsupported('option_missing_or_ambiguous');
        if (!target.some(v => sameValue(v, hits[0].value))) target.push(hits[0].value);
      }
      const selected = model.options.filter(option => target.some(value => sameValue(value, option.value)));
      const ordered = selected.map(option => option.value), labels = selected.map(option => option.label);
      const same = H.equal(model.value, ordered) && H.equal(model.domValue, labels);
      return { status: same ? 'success' : 'planned', reason: same ? 'preexisting_same_value' : 'ready',
        value: ordered, modelValue: ordered, domValue: labels, labels };
    }
    return H.makePlan(fact, model, { type });
  }
  async function writeChoice(el, instruction, ctx) {
    const p = inspect(el), root = rootOf(el, p), owner = resolve(el).vm;
    const records = choiceOptions(root, p);
    let baseline, attempts = 0;
    const guarded = { ...ctx, async check() {
      await ctx.check();
      const live = inspect(el), model = modelFor(el, live), current = choiceOptions(root, live);
      if (rootOf(el, live) !== root || resolve(el).vm !== owner || owner?._isDestroyed || live.version !== p.version
        || !sameValue(live.checkedValue, p.checkedValue) || !sameValue(live.uncheckedValue, p.uncheckedValue)
        || !model.available || model.disabled || model.readonly || !model.choiceConsistent
        || current.length !== records.length || current.some((record, index) => record.input !== records[index].input || record.click !== records[index].click
          || !sameValue(record.value, records[index].value) || record.label !== records[index].label
          || record.disabled !== records[index].disabled)
        || baseline && (!sameChoices(model.value, baseline.value) || !H.equal(model.domValue, baseline.domValue))) throw Error('control_changed');
    } };
    const model = modelFor(el, p);
    const targets = model.choiceKind === 'boolean' ? [{ click: root.matches?.('[role="switch"]') ? root : records[0]?.click }]
      : (Array.isArray(instruction.value) ? instruction.value : [instruction.value]).map(value =>
        records.find(record => sameValue(record.value, value)));
    if (targets.some(record => !record?.click)) return unsupported('option_missing');
    for (const target of targets) {
      baseline = modelFor(el, inspect(el));
      if (model.choiceKind === 'boolean' ? baseline.domValue === instruction.domValue : target.input.checked) continue;
      await H.safeClick(target.click, guarded);
      attempts++;
      baseline = null;
      await H.tick();
      const after = modelFor(el, inspect(el));
      if (!after.choiceConsistent || (model.choiceKind === 'boolean' ? after.domValue !== instruction.domValue : !target.input.checked))
        return { ...unsupported('choice_readback_mismatch'), strategy: 'ui', attempts };
    }
    return { strategy: 'ui', attempts };
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
    ['el-select-search', 'element-ui', 'select-search', 450, ['ElSelect'], writeSearch],
    ['el-select-multiple', 'element-ui', 'multi-select', 475, ['ElSelect'], writeMulti],
    ['el-autocomplete', 'element-ui', 'select-search', 475, ['ElAutocomplete'], writeSearch],
    ['el-radio', 'element-ui', 'radio', 300, ['ElRadioGroup', 'ElRadio'], writeChoice],
    ['el-checkbox', 'element-ui', 'checkbox', 300, ['ElCheckboxGroup', 'ElCheckbox'], writeChoice],
    ['el-switch', 'element-ui', 'switch', 300, ['ElSwitch'], writeChoice],
    ['el-date', 'element-ui', 'date', 500, ['ElDatePicker'], writeDate],
    ['el-month', 'element-ui', 'month', 600, ['ElDatePicker'], writeDate],
    ['el-cascader', 'element-ui', 'cascader', 650, ['ElCascader'], writeCascader],
    ['antdv1-input', 'ant-design-vue', 'text', 150, ['AInput'], writeInput],
    ['antdv1-textarea', 'ant-design-vue', 'textarea', 175, ['ATextarea'], writeInput],
    ['antdv1-select', 'ant-design-vue', 'select', 400, ['ASelect'], writeSelect],
    ['antdv1-select-search', 'ant-design-vue', 'select-search', 450, ['ASelect'], writeSearch],
    ['antdv1-select-multiple', 'ant-design-vue', 'multi-select', 475, ['ASelect'], writeMulti],
    ['antdv1-autocomplete', 'ant-design-vue', 'select-search', 475, ['AAutoComplete'], writeSearch],
    ['antdv1-radio', 'ant-design-vue', 'radio', 300, ['ARadioGroup', 'ARadio'], writeChoice],
    ['antdv1-checkbox-group', 'ant-design-vue', 'checkbox', 300, ['ACheckboxGroup'], writeChoice],
    ['antdv1-checkbox', 'ant-design-vue', 'checkbox', 300, ['ACheckbox'], writeChoice],
    ['antdv1-switch', 'ant-design-vue', 'switch', 300, ['ASwitch'], writeChoice],
    ['antdv1-date', 'ant-design-vue', 'date', 500, ['ADatePicker'], writeDate],
    ['antdv1-month', 'ant-design-vue', 'month', 600, ['AMonthPicker'], writeDate],
    ['antdv1-cascader', 'ant-design-vue', 'cascader', 650, ['ACascader'], writeCascader],
  ];

  for (const [name, lib, type, priority, names, performWrite] of definitions) {
    const major = lib === 'element-ui' ? 2 : 1;
    R.register({ name, lib, type, priority,
      matches(el, p) {
        if (!librarySpec(lib, major, names)(el, p)) return false;
        if (type === 'multi-select') return p.multiple;
        if (/Select/u.test(p.componentName) && p.multiple) return false;
        if (name === 'el-textarea') return p.type === 'textarea';
        if (name === 'el-input') return p.type !== 'textarea';
        if (name === 'el-month') return p.type === 'month';
        if (name === 'el-date') return p.type === 'date' || !p.type;
        if (name === 'el-select-search') return !!(p.filterable || p.remote);
        if (name === 'el-select') return !(p.filterable || p.remote);
        if (name === 'antdv1-select-search') return !!(p.filterable || p.remote || p.showSearch);
        if (name === 'antdv1-select') return !(p.filterable || p.remote || p.showSearch);
        return true;
      },
      readModel: modelFor,
      ...(type === 'month' || type === 'date' ? { plan: (fact, model) => datePlan(fact, model, type) }
        : type === 'select-search' ? { plan: searchPlan }
          : type === 'multi-select' ? { plan: multiPlan }
          : type === 'cascader' ? { plan: cascaderPlan }
            : ['radio', 'checkbox', 'switch'].includes(type) ? { plan: (fact, model, ctx) => choicePlan(fact, model, type, ctx) } : {}),
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
