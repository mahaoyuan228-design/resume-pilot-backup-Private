/* First-party L1 HTML and numeric controls. No ATS implementation code is incorporated.
 * Registration is passive; writes require the registry's explicit write gate.
 */
(() => {
  'use strict';
  const api = globalThis.ResumeControls;
  if (!api) throw new Error('control_registry_missing');
  if (api.list?.().some(adapter => adapter.name === 'native-text')) return;
  const { norm, equal, prose, proseEqual, richtextValue, nativeSet, safeClick, tick } = api.helpers;
  const textTypes = new Set(['text', 'email', 'tel', 'url', 'search']);
  const frameworkClass = /(?:^|\s)(?:el|ant|ivu|ud|phoenix|atsx|am)-[^\s]+/u;
  const complexClass = /(?:^|\s)[^\s]*(?:cascader|picker|select-wrap|plugin-dialog)[^\s]*/u;

  // A class-only or unrecognised framework widget must not become native text.
  // That includes its readonly display input and its hidden search input.
  function plain(el, probe, searchable = false, switchRole = false) {
    if (!el || !el.matches?.('input,textarea,select,[contenteditable]') && !(switchRole && el.matches?.('[role="switch"]'))) return false;
    if (probe?.lib && probe.lib !== 'native') return false;
    if (probe?.framework && probe.framework !== 'native') return false;
    for (let node = el; node && node !== document.body; node = node.parentElement) {
      const classes = typeof node.className === 'string' ? node.className : '';
      if (frameworkClass.test(classes) || complexClass.test(classes)) return false;
      // Custom dropdown text inputs are search queries, even when the page
      // omits ARIA. Only the separately owned combobox route may claim one.
      // An actual HTML select retains its native option/value contract.
      if (!searchable && el.tagName !== 'SELECT' && (node.classList.contains('dropdown')
        || [...node.classList].some(token => /(?:^|[-_])Dropdown-container(?:[-_]|$)/iu.test(token)))) return false;
      // My97 owns these text inputs even when its script/configuration cannot
      // be confirmed. Never silently downgrade an unknown calendar to text.
      if (/(?:^|\s)Wdate(?:\s|$)/iu.test(classes)
        || ['onfocus', 'onclick'].some(name => /\bWdatePicker\b/u.test(node.getAttribute(name) || ''))) return false;
      if ((node !== el || !searchable) && node.matches?.('[role="combobox"],[role="listbox"],[role="tree"]')) return false;
    }
    return true;
  }
  function label(el) {
    const labelledBy = (el.getAttribute('aria-labelledby') || '').split(/\s+/u).filter(Boolean)
      .map(id => document.getElementById(id)?.textContent || '').join(' ');
    return norm(el.getAttribute('aria-label') || labelledBy ||
      (el.labels ? [...el.labels].map(node => node.textContent).join(' ') : '') || el.value);
  }
  function disabled(el) {
    return !!el.disabled || el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true';
  }
  function base(el, probe, value, domValue = value, options = []) {
    return { ...probe, framework: 'native', lib: 'native', version: 'html', major: null,
      componentName: el.tagName.toLowerCase(), available: true, value, domValue, options,
      disabled: disabled(el), readonly: !!el.readOnly || el.getAttribute('aria-readonly') === 'true',
      controlRoot: el };
  }
  function datePartPlaceholder(option) {
    if (!option) return false;
    // Require a date-part option family, so a real "Month" frequency choice
    // or an unknown mixed option list cannot be mistaken for an empty prompt.
    const token = norm(option.textContent).toLowerCase();
    const part = /^(?:年|year|yyyy|-{2,})$/u.test(token) ? 'year' : /^(?:月|month|mm)$/u.test(token) ? 'month'
      : /^(?:日|day|dd)$/u.test(token) ? 'day' : null;
    if (!part || !['', '-1', '0', token].includes(norm(option.value).toLowerCase())) return false;
    const choices = [...(option.closest('select')?.options || [])].filter(node => node !== option
      && !node.disabled && !node.closest('optgroup[disabled]'));
    const pattern = part === 'year' ? /^\d{4}$/u : /^\d{1,2}$/u;
    const display = part === 'year' ? /^(\d{4})年?$/u : part === 'month' ? /^(\d{1,2})月?$/u : /^(\d{1,2})日?$/u;
    return choices.length > 0 && choices.every(node => {
      const value = norm(node.value), label = norm(node.textContent).match(display), number = Number(value);
      return pattern.test(value) && label && Number(label[1]) === number
        && number >= (part === 'year' ? 1900 : 1) && number <= (part === 'year' ? 2100 : part === 'month' ? 12 : 31);
    });
  }
  function selectModel(el, probe) {
    const option = el.selectedOptions[0], placeholder = datePartPlaceholder(option);
    return base(el, probe, placeholder ? '' : el.value, placeholder ? '' : option ? norm(option.textContent) : '',
      [...el.options].map(node => ({ value: node.value, label: norm(node.textContent),
        disabled: node.disabled || !!node.closest('optgroup[disabled]') || datePartPlaceholder(node) })));
  }
  function radios(el) {
    if (!el.name) return [el];
    // A form-associated radio may sit outside the form's DOM subtree.
    const scope = el.getRootNode();
    return [...scope.querySelectorAll('input[type="radio"]')].filter(node =>
      node.name === el.name && node.form === el.form);
  }
  const noWrite = reason => ({ status: 'unsupported', reason, strategy: 'native', attempts: 0 });
  const targetValue = instruction => instruction.modelValue ?? instruction.value;
  function guards(el) {
    if (!el.isConnected) return 'target_detached';
    if (disabled(el)) return 'disabled';
    if (el.readOnly || el.getAttribute('aria-readonly') === 'true') return 'readonly';
    return null;
  }
  function register(spec) {
    api.register({ lib: 'native', priority: 10,
      libVersionProbe: () => ({ lib: 'native', version: 'html' }), ...spec });
  }

  // Explicit, fixed digit masks only. Never execute a page formatter/parser or
  // infer a country code. Keep identifiers as strings (including leading zero).
  const maskFlags = { writeStarted: false, liveSupportClaimed: false };
  const maskAttributes = ['mask', 'format', 'data-mask', 'data-format', 'data-inputmask'];
  function maskEvidence(el, probe) {
    const root = probe.controlRoot || el;
    const ref = globalThis.ResumeControlModel?.resolve(el);
    const props = ref?.props || {};
    const evidence = [...new Set([el, root])].flatMap(node => maskAttributes
      .filter(key => node.hasAttribute?.(key)).map(key => [key, node.getAttribute(key)]));
    for (const key of ['mask', 'format']) if (props[key] != null) evidence.push([`prop:${key}`, props[key]]);
    return { root, props, evidence };
  }
  function maskHint(el, probe) {
    return el.matches?.('input') && ['text', 'tel'].includes(el.type)
      && !/Picker|Select|Cascader|Autocomplete|AutoComplete|InputNumber/u.test(probe.componentName || '')
      && !el.matches('.Wdate') && !['onfocus', 'onclick'].some(key => /\bWdatePicker\b/u.test(el.getAttribute(key) || ''))
      && maskEvidence(el, probe).evidence.length > 0;
  }
  function maskModel(el, probe, kind) {
    const { root, props, evidence } = maskEvidence(el, probe);
    const inputs = root?.matches?.('input') ? [root] : [...(root?.querySelectorAll('input:not([type="hidden"])') || [])];
    const hints = [el.type, el.autocomplete, el.name, el.id, el.getAttribute('aria-label'),
      ...[...(el.labels || [])].map(node => node.textContent)].join(' ').normalize('NFKC').toLowerCase();
    const semantic = /cc-number|bank|card.?number|银行卡/u.test(hints) ? 'bank'
      : /id.?card|identity|national.?id|身份证|证件/u.test(hints) ? 'identity'
        : /phone|mobile|tel|手机|电话/u.test(hints) ? 'phone' : null;
    const masks = evidence.map(([, value]) => typeof value === 'string' ? value.normalize('NFKC').trim() : null);
    const mask = masks[0];
    const tokens = typeof mask === 'string' ? mask.match(/[#90X]/gu) || [] : [];
    const digitTokens = new Set(tokens.filter(token => token !== 'X'));
    const count = tokens.length;
    const plus = mask?.startsWith('+');
    const checksum = tokens.at(-1) === 'X';
    const valid = masks.length > 0 && masks.every(value => value === mask) && typeof mask === 'string'
      && mask.length <= 80 && /^\+?[#90X() -]+$/u.test(mask) && digitTokens.size === 1
      && tokens.filter(token => token === 'X').length === (checksum ? 1 : 0)
      && (!checksum || semantic === 'identity') && (!plus || semantic === 'phone')
      && (semantic === 'phone' ? count >= 7 && count <= 15 : semantic === 'bank' ? count >= 12 && count <= 19
        : semantic === 'identity' && [15, 18].includes(count));
    const canonical = value => {
      if (value == null || value === '') return '';
      if (typeof value !== 'string' || !valid || value.length > 128) return null;
      let text = value.normalize('NFKC').trim();
      for (const separator of [' ', '-', '(', ')']) if (mask.includes(separator)) text = text.split(separator).join('');
      if (plus && text.startsWith('+')) text = text.slice(1);
      const pattern = checksum ? new RegExp(`^\\d{${count - 1}}[\\dXx]$`, 'u') : new RegExp(`^\\d{${count}}$`, 'u');
      return pattern.test(text) ? (plus ? '+' : '') + text.toUpperCase() : null;
    };
    const value = canonical(kind === 'vue' ? probe.value : el.value), domValue = canonical(el.value);
    return { ...probe, ...(kind === 'native' ? { framework: 'native', lib: 'native', version: 'html' } : {}),
      controlRoot: root, maskInput: el, maskContract: JSON.stringify([evidence, semantic, el.type, el.maxLength]),
      mask, maskKind: semantic, value, domValue, canonical,
      available: valid && inputs.length === 1 && inputs[0] === el && ['text', 'tel'].includes(el.type)
        && !el.hasAttribute('role') && (kind !== 'vue' || probe.available) && value !== null && domValue !== null
        && !props.formatter && !props.parser && !props.multiple,
      disabled: !!probe.disabled || disabled(el) || !!el.closest('[aria-disabled="true"],[inert]'),
      readonly: !!probe.readonly || el.readOnly || !!el.closest('[aria-readonly="true"]') };
  }
  function maskPlan(fact, model) {
    const fail = reason => ({ status: 'manual', reason, ...maskFlags });
    if (model.disabled || model.readonly) return fail(model.disabled ? 'disabled' : 'readonly');
    if (!model.available) return fail('input_mask_contract_unconfirmed');
    const value = model.canonical(fact && typeof fact === 'object' ? fact.value : fact);
    if (!value) return fail('invalid_input_mask_value');
    if (model.maskInput.maxLength >= 0 && value.length > model.maskInput.maxLength) return fail('value_too_long');
    if ([model.value, model.domValue].some(current => current !== '' && current !== value)) return fail('existing_value');
    const same = model.value === value && model.domValue === value;
    return { status: same ? 'success' : 'planned', reason: same ? 'preexisting_same_value' : 'ready',
      value, modelValue: value, domValue: value, ...maskFlags };
  }
  for (const [name, lib, kind, component, major] of [
    ['native-input-mask', 'native', 'native'], ['el-input-mask', 'element-ui', 'vue', 'ElInput', 2],
    ['antdv1-input-mask', 'ant-design-vue', 'vue', 'AInput', 1]
  ]) api.register({ name, lib, type: 'input-mask', priority: 510,
    matches: (el, probe) => maskHint(el, probe) && (kind === 'native' ? plain(el, probe)
      : probe.framework === 'vue2' && probe.componentName === component),
    libVersionProbe: (_el, probe) => kind === 'native' ? { lib, version: 'html' }
      : probe.lib === lib && probe.major === major ? { lib, version: probe.version } : null,
    readModel: (el, probe) => maskModel(el, probe, kind), plan: maskPlan,
    async performWrite(el, instruction, ctx) {
      const adapter = api.resolve(el);
      await nativeSet(el, instruction.value, { ...ctx, async check() {
        await ctx.check();
        const live = adapter.readModel(el);
        if (!live.available || live.disabled || live.readonly) throw Error('control_changed');
        if ([live.value, live.domValue].some(value => value !== '' && value !== instruction.value)) throw Error('control_changed');
      } });
      return { strategy: 'native', attempts: 1 };
    }
  });
  api.register({ name: 'input-mask-unknown', lib: 'input-mask', type: 'input-mask', priority: 505,
    matches: maskHint, libVersionProbe: () => ({ lib: 'input-mask', version: 'unknown' }),
    readModel: (el, probe) => ({ ...probe, available: false, controlRoot: el }),
    plan: () => ({ status: 'manual', reason: 'input_mask_contract_unconfirmed', ...maskFlags }) });

  // One numeric contract for HTML, reviewed Vue 2 InputNumbers and explicit
  // editable ARIA spinbuttons. CSS hints alone only prevent a text downgrade.
  const numberFlags = { writeStarted: false, liveSupportClaimed: false };
  const decimalPattern = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/u;
  function decimal(value) {
    const [mantissa, exponent = '0'] = String(value).toLowerCase().split('e');
    const [whole, fraction = ''] = mantissa.split('.');
    return { coefficient: BigInt(whole + fraction), exponent: Number(exponent) - fraction.length };
  }
  function scaled(value, exponent) {
    const part = decimal(value);
    return part.coefficient * 10n ** BigInt(part.exponent - exponent);
  }
  function numberValue(value) {
    if (!['number', 'string'].includes(typeof value) || String(value).length > 128 || !decimalPattern.test(String(value))) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || Math.abs(parsed) > Number.MAX_SAFE_INTEGER) return null;
    if (Math.abs(decimal(value).exponent) > 324) return null;
    // Do not silently round supplied decimal strings or underflow them to zero.
    const exponent = Math.min(decimal(value).exponent, decimal(parsed).exponent);
    return scaled(value, exponent) === scaled(parsed, exponent) ? parsed : null;
  }
  function aligned(value, step, base = 0) {
    const exponent = Math.min(...[value, step, base].map(part => decimal(part).exponent));
    return (scaled(value, exponent) - scaled(base, exponent)) % scaled(step, exponent) === 0n;
  }
  function numberHint(el) {
    for (let node = el; node && !node.matches('body,html,form'); node = node.parentElement) {
      if (node.matches('[role="spinbutton"],input[type="number"]')
        || [...node.classList].some(token => /(?:^|-)(?:input-number|stepper|spinbutton)(?:-|$)/iu.test(token))) return true;
    }
    return false;
  }
  function numberModel(el, probe, kind) {
    const root = kind === 'vue' ? probe.controlRoot : el;
    const inputs = root ? [...(root.matches('input') ? [root] : []), ...root.querySelectorAll('input:not([type="hidden"])')] : [];
    const input = inputs.length === 1 ? inputs[0] : null;
    const props = kind === 'vue' ? globalThis.ResumeControlModel.resolve(el).props : {};
    const bound = (value, fallback = null) => value == null || value === '' ? fallback : numberValue(value);
    const rawMin = kind === 'vue' ? props.min === -Infinity ? null : props.min : input?.getAttribute(kind === 'aria' ? 'aria-valuemin' : 'min');
    const rawMax = kind === 'vue' ? props.max === Infinity ? null : props.max : input?.getAttribute(kind === 'aria' ? 'aria-valuemax' : 'max');
    const rawStep = kind === 'vue' ? props.step : input?.getAttribute('step');
    const min = bound(rawMin), max = bound(rawMax), step = rawStep === 'any' && kind !== 'vue' ? 'any' : bound(rawStep, 1);
    const initial = kind === 'native' ? numberValue(input?.getAttribute('value')) : null;
    const precision = kind === 'vue' ? props.precision ?? null : null;
    const constraints = { min, max, step, base: kind === 'vue' ? 0 : min ?? initial ?? 0, precision,
      strict: kind !== 'vue' || !!props.stepStrictly };
    const invalid = rawMin != null && rawMin !== '' && min === null || rawMax != null && rawMax !== '' && max === null
      || min != null && max != null && min > max || step !== 'any' && (step === null || step <= 0)
      || precision !== null && (!Number.isInteger(precision) || precision < 0 || precision > 15)
      || !!(props.formatter || props.parser || props.stringMode || props.decimalSeparator || props.cyclic || props.wrap);
    const rawValue = kind === 'vue' ? probe.value : kind === 'aria' ? input?.getAttribute('aria-valuenow') : input?.value;
    const value = rawValue == null || rawValue === '' ? null : numberValue(rawValue);
    const domValue = input?.value === '' ? null : numberValue(input?.value);
    return { ...probe, ...(kind === 'vue' ? {} : { framework: 'native', lib: kind === 'aria' ? 'aria' : 'native', version: 'html' }),
      controlRoot: root, numberInput: input, value, domValue, numberConstraints: constraints,
      available: !!input && ['text', 'number'].includes(input.type) && !invalid
        && (kind !== 'vue' || probe.available && (probe.value == null || typeof probe.value === 'number'))
        && (kind !== 'aria' || input.hasAttribute('aria-valuenow'))
        && (rawValue == null || rawValue === '' || value !== null) && (input.value === '' || domValue !== null)
        && !input.validity.badInput,
      disabled: !!probe.disabled || !!input?.disabled || !!input?.matches(':disabled') || !!input?.closest('[aria-disabled="true"],[inert]'),
      readonly: !!probe.readonly || !!input?.readOnly || !!input?.closest('[aria-readonly="true"]') };
  }
  function numberPlan(fact, model) {
    const fail = reason => ({ status: 'manual', reason, ...numberFlags });
    if (model.disabled || model.readonly) return fail(model.disabled ? 'disabled' : 'readonly');
    if (!model.available) return fail('number_contract_unconfirmed');
    const operation = fact?.operation ?? 'set';
    if (!['set', 'inc', 'dec'].includes(operation) || operation !== 'set' && fact.value !== undefined) return fail('invalid_number_operation');
    const { min, max, step, base, precision, strict } = model.numberConstraints;
    const violation = value => min !== null && value < min || max !== null && value > max ? 'number_out_of_range'
      : precision !== null && !aligned(value, 10 ** -precision) ? 'number_precision_mismatch'
        : strict && step !== 'any' && !aligned(value, step, base) ? 'number_step_mismatch' : null;
    let target = numberValue(fact && typeof fact === 'object' ? fact.value : fact);
    if (operation !== 'set') {
      if (model.value === null || model.domValue !== model.value) return fail('number_initial_value_unconfirmed');
      if (step === 'any') return fail('number_step_unconfirmed');
      if (violation(model.value)) return fail(violation(model.value));
      const exponent = Math.min(decimal(model.value).exponent, decimal(step).exponent);
      target = numberValue(`${scaled(model.value, exponent) + (operation === 'inc' ? 1n : -1n) * scaled(step, exponent)}e${exponent}`);
    }
    if (target === null) return fail('invalid_number_value');
    if (violation(target)) return fail(violation(target));
    if (operation === 'set' && [model.value, model.domValue].some(value => value !== null && value !== target)) return fail('existing_value');
    const same = model.value === target && model.domValue === target;
    return { status: same ? 'success' : 'planned', reason: same ? 'preexisting_same_value' : 'ready',
      operation, value: target, modelValue: target, domValue: target, ...numberFlags };
  }
  async function writeNumber(el, instruction, ctx, kind) {
    const adapter = api.resolve(el), initial = adapter.readModel(el), root = initial.controlRoot;
    const input = root.matches('input') ? root : root.querySelector('input:not([type="hidden"])');
    const keyboard = kind === 'vue' && instruction.operation !== 'set';
    let stepped = false;
    const owned = { ...ctx, async check() {
      await ctx.check();
      const live = adapter.readModel(el);
      if (!input.isConnected || live.numberInput !== input || live.disabled || live.readonly || !live.available || !api.helpers.clickAllowed(input)
        || keyboard && !stepped && (live.value !== initial.value || live.domValue !== initial.domValue)
        || ![initial.value, instruction.value].includes(live.value)
        || ![initial.domValue, instruction.value].includes(live.domValue)) throw Error('control_changed');
    } };
    if (keyboard) {
      // Keyboard stepping avoids InputNumber's pointer long-press timers.
      const key = instruction.operation === 'inc' ? 'ArrowUp' : 'ArrowDown', keyCode = key === 'ArrowUp' ? 38 : 40;
      await api.helpers.check(owned);
      stepped = true;
      input.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, keyCode, which: keyCode, bubbles: true, cancelable: true }));
      await api.helpers.check(owned);
      input.dispatchEvent(new KeyboardEvent('keyup', { key, code: key, keyCode, which: keyCode, bubbles: true, cancelable: true }));
    } else await nativeSet(input, String(instruction.value), owned);
    await tick();
    return { strategy: keyboard ? 'keyboard' : 'native', attempts: 1 };
  }
  for (const [name, lib, kind, componentName, major] of [
    ['native-number', 'native', 'native'], ['aria-number', 'aria', 'aria'],
    ['el-number', 'element-ui', 'vue', 'ElInputNumber', 2], ['antdv1-number', 'ant-design-vue', 'vue', 'AInputNumber', 1]
  ]) api.register({ name, lib, type: 'number', priority: 500,
    libVersionProbe: (_el, probe) => kind !== 'vue' ? { lib, version: 'html' }
      : probe.lib === lib && probe.major === major ? { lib, version: probe.version } : null,
    matches: (el, probe) => kind === 'vue' ? probe.framework === 'vue2' && probe.componentName === componentName
      : plain(el, probe) && el.matches(kind === 'native' ? 'input[type="number"]:not([role]),input[type="number"][role="spinbutton"]' : 'input[type="text"][role="spinbutton"],input:not([type])[role="spinbutton"]'),
    readModel: (el, probe) => numberModel(el, probe, kind), plan: numberPlan,
    performWrite: (el, instruction, ctx) => writeNumber(el, instruction, ctx, kind)
  });
  api.register({ name: 'number-unknown', lib: 'number', type: 'number', priority: 18,
    matches: el => numberHint(el), libVersionProbe: () => ({ lib: 'number', version: 'unknown' }),
    readModel: (el, probe) => ({ ...probe, available: false, controlRoot: el }),
    plan: () => ({ status: 'manual', reason: 'number_contract_unconfirmed', ...numberFlags }) });

  const shown = node => {
    if (!node?.isConnected || !node.getClientRects().length || node.closest('[hidden],[aria-hidden="true"]')) return false;
    for (let parent = node; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.display === 'none' || ['hidden', 'collapse'].includes(style.visibility)) return false;
    }
    return true;
  };
  const ariaTokens = node => ['aria-controls', 'aria-owns'].flatMap(name =>
    (node.getAttribute(name) || '').split(/\s+/u).filter(Boolean));
  function comboPortal(el) {
    if (!el?.isConnected || el.ownerDocument !== document || el.getRootNode() !== document
      || !plain(el, globalThis.ResumeControlModel?.inspect(el), true)
      || !el.matches('input[role="combobox"]') || !['text', 'search'].includes(el.type)
      || !['list', 'both'].includes(el.getAttribute('aria-autocomplete'))
      || !['true', 'false'].includes(el.getAttribute('aria-expanded'))) return null;
    const ids = [...new Set(ariaTokens(el))];
    if (ids.length !== 1) return null;
    const lists = [...document.querySelectorAll('[id]')].filter(node => node.id === ids[0]);
    if (lists.length !== 1 || !lists[0].matches('[role="listbox"]')
      || lists[0].getRootNode() !== document || lists[0].querySelector('input,textarea,select,[role="listbox"]')) return null;
    const owners = [...document.querySelectorAll('[aria-controls],[aria-owns]')]
      .filter(node => ariaTokens(node).includes(ids[0]));
    return owners.length === 1 && owners[0] === el ? lists[0] : null;
  }
  const comboOptions = portal => [...portal.querySelectorAll('[role="option"]')]
    .filter(node => node.closest('[role="listbox"]') === portal
      && !node.parentElement.closest('[role="option"]'));
  const optionEnabled = node => !node.disabled && !node.matches(':disabled')
    && !node.closest('[disabled],[aria-disabled="true"],[inert]');
  const comboBusy = (el, portal) => !!(el.closest('[aria-busy="true"]')
    || portal.matches('[aria-busy="true"]') || portal.querySelector('[aria-busy="true"]'));
  function comboModel(el, probe) {
    const portal = comboPortal(el), options = portal ? comboOptions(portal) : [];
    const selected = options.filter(node => node.getAttribute('aria-selected') === 'true');
    const committed = !!portal && !shown(portal) && el.getAttribute('aria-expanded') === 'false'
      && !comboBusy(el, portal) && selected.length === 1 && optionEnabled(selected[0])
      && equal(norm(selected[0].textContent), el.value);
    return { ...base(el, probe, el.value, committed ? norm(el.value) : '', options.map(node => ({
      value: norm(node.textContent), label: norm(node.textContent), disabled: !optionEnabled(node)
    }))), available: !!portal, selectionCommitted: committed };
  }
  register({ name: 'native-combobox-search', type: 'select-search', priority: 450,
    matches: (el, probe) => plain(el, probe, true) && !!comboPortal(el),
    readModel: comboModel,
    plan(fact, model) {
      const value = fact?.value;
      if (typeof value !== 'string' || !norm(value) || value.length > 160)
        return { status: 'unsupported', reason: 'explicit_option_required' };
      const plan = api.helpers.makePlan(fact, model, { type: 'text' });
      return { ...plan, strategy: 'ui', interaction: 'search', requiresOptionClick: plan.status === 'planned',
        writeStarted: false, liveSupportClaimed: false };
    },
    async performWrite(el, instruction, ctx) {
      const portal = comboPortal(el), reason = guards(el);
      if (reason || !portal) return noWrite(reason || 'overlay_ownership_unconfirmed');
      const desired = norm(instruction.domValue ?? instruction.value);
      if (el.value && !equal(el.value, desired)) return noWrite('existing_value');
      if (shown(portal) || [...document.querySelectorAll('[role="listbox"]')].some(shown)) return noWrite('control_busy');
      if (comboBusy(el, portal)) return noWrite('control_busy');
      const binding = ['aria-controls', 'aria-owns', 'aria-autocomplete'].map(name => el.getAttribute(name));
      const dialogs = new Set([...document.querySelectorAll('[role="dialog"]')].filter(shown));
      const owned = { ...ctx, async check() {
        await ctx.check();
        if (guards(el) || comboPortal(el) !== portal
          || binding.some((value, i) => el.getAttribute(['aria-controls', 'aria-owns', 'aria-autocomplete'][i]) !== value)
          || el.value && !equal(el.value, desired)) throw Error('control_changed');
        if ([...document.querySelectorAll('[role="listbox"]')].some(node => node !== portal && shown(node))
          || [...document.querySelectorAll('[role="dialog"]')].some(node => shown(node) && !dialogs.has(node)))
          throw Error('overlay_ambiguous');
      } };
      await safeClick(el, owned);
      for (let i = 0; i < 40 && !shown(portal); i++) { await api.helpers.check(owned); await tick(20); }
      if (!shown(portal) || el.getAttribute('aria-expanded') !== 'true') return noWrite('select_not_open');
      await nativeSet(el, desired, owned, ['input']);
      for (let i = 0; i < 80; i++) {
        await api.helpers.check(owned);
        if (!shown(portal) || el.getAttribute('aria-expanded') !== 'true') return noWrite('control_changed');
        const hits = comboOptions(portal).filter(node => shown(node) && optionEnabled(node)
          && norm(node.textContent) === desired);
        if (hits.length > 1) return noWrite('option_ambiguous');
        if (!comboBusy(el, portal) && hits.length === 1) {
          const target = hits[0];
          const observed = { ...comboModel(el), options: comboOptions(portal).filter(shown).map(node => ({
            value: norm(node.textContent), label: norm(node.textContent), disabled: !optionEnabled(node)
          })) };
          const selected = observed.options.find(option => !option.disabled && option.label === desired);
          await safeClick(target, { ...owned, async check() {
            await owned.check();
            const live = comboOptions(portal).filter(node => shown(node) && optionEnabled(node)
              && norm(node.textContent) === desired);
            if (!shown(portal) || comboBusy(el, portal) || live.length !== 1 || live[0] !== target)
              throw Error('option_changed');
          } });
          api.helpers.confirmSearchOption(instruction, observed, selected);
          for (let count = 0; count < 60; count++) {
            await api.helpers.check(owned);
            if (!shown(portal) && el.getAttribute('aria-expanded') === 'false')
              return { strategy: 'ui', interaction: 'search', attempts: 1 };
            await tick(20);
          }
          return noWrite('owned_overlay_cleanup_timeout');
        }
        await tick(20);
      }
      return noWrite('option_not_found');
    }
  });

  function dateModel(el, probe, type) {
    return { ...base(el, probe, el.value), valueFormat: type === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD',
      datePrecision: type, detectionEvidence: 'html_input_type', readbackSource: 'html_input_value',
      dateConstraints: { min: el.getAttribute('min'), max: el.getAttribute('max'),
        step: el.getAttribute('step'), initialValue: el.getAttribute('value') } };
  }
  function dateNumber(value, type) {
    const [year, month, day = 1] = value.split('-').map(Number);
    return type === 'month' ? (year - 1970) * 12 + month - 1 : Date.UTC(year, month - 1, day) / 86400000;
  }
  function datePlan(fact, model, type) {
    const value = fact && typeof fact === 'object' ? fact.value : fact;
    const manual = reason => ({ status: 'manual', reason, writeStarted: false, liveSupportClaimed: false });
    if (model.disabled || model.readonly) return manual(model.disabled ? 'disabled' : 'readonly');
    if (value == null || value === '') return { status: 'unsupported', reason: 'no_fact' };
    if (!api.helpers.validDate(value, type)) return manual('invalid_date_precision');
    const { min, max, step, initialValue } = model.dateConstraints;
    if ([min, max].some(bound => bound != null && bound !== '' && !api.helpers.validDate(bound, type))
      || min && max && min > max) return manual('date_constraint_unconfirmed');
    if (min && value < min || max && value > max) return manual('date_out_of_range');
    if (step !== 'any') {
      // HTML date steps use days; month steps use months. The initial value
      // attribute is a step base only when no minimum is present.
      const size = step == null || step === '' ? 1 : Number(step);
      if (!Number.isFinite(size) || size <= 0 || step != null && step !== '' && !/^(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(step))
        return manual('date_constraint_unconfirmed');
      const baseValue = min || (api.helpers.validDate(initialValue, type) ? initialValue : type === 'month' ? '1970-01' : '1970-01-01');
      const steps = (dateNumber(value, type) - dateNumber(baseValue, type)) / size;
      if (!Number.isFinite(steps) || Math.abs(steps - Math.round(steps)) > 1e-8) return manual('date_step_mismatch');
    }
    return api.helpers.makePlan(fact, model, { type });
  }
  for (const type of ['date', 'month']) register({ name: `native-${type}`, type, priority: 20,
    matches: (el, probe) => plain(el, probe) && el.tagName === 'INPUT' && el.type === type
      && el.getAttribute('type')?.toLowerCase() === type,
    readModel: (el, probe) => dateModel(el, probe, type),
    plan: (fact, model) => datePlan(fact, model, type),
    async performWrite(el, instruction, ctx) {
      const reason = guards(el);
      if (reason) return noWrite(reason);
      const checked = datePlan({ value: targetValue(instruction) }, dateModel(el, {}, type), type);
      if (!['planned', 'success'].includes(checked.status)) return { ...noWrite(checked.reason), status: checked.status };
      if (checked.status === 'success') return { strategy: 'native', attempts: 0 };
      await nativeSet(el, checked.value, ctx);
      await tick();
      return { strategy: 'native', attempts: 1 };
    }
  });

  register({ name: 'native-text', type: 'text',
    matches: (el, probe) => plain(el, probe) && !numberHint(el) && el.tagName === 'INPUT' && textTypes.has(el.type),
    readModel: (el, probe) => ({ ...base(el, probe, el.value), available: plain(el, probe) }),
    async performWrite(el, instruction, ctx) {
      const reason = guards(el);
      if (reason) return noWrite(reason);
      if (!plain(el)) return noWrite('control_or_version_changed');
      const value = String(targetValue(instruction) ?? '');
      if (el.value && !equal(el.value, value)) return noWrite('existing_value');
      if (equal(el.value, value)) return { strategy: 'native', attempts: 0 };
      await nativeSet(el, value, { ...ctx, async check() {
        await ctx.check();
        if (!plain(el)) throw Error('control_or_version_changed');
      } });
      await tick();
      return { strategy: 'native', attempts: 1 };
    }
  });
  register({ name: 'native-textarea', type: 'textarea',
    matches: (el, probe) => plain(el, probe) && el.tagName === 'TEXTAREA',
    readModel: (el, probe) => ({ ...base(el, probe, el.value), maxLength: el.maxLength,
      disabled: disabled(el) || !!el.closest('[aria-disabled="true"],[inert]'),
      readonly: !!el.readOnly || !!el.closest('[aria-readonly="true"]') }),
    async performWrite(el, instruction, ctx) {
      const reason = guards(el);
      if (reason) return noWrite(reason);
      if (el.closest('[aria-disabled="true"],[inert]')) return noWrite('disabled');
      if (el.closest('[aria-readonly="true"]')) return noWrite('readonly');
      if (typeof targetValue(instruction) !== 'string') return noWrite('invalid_text_value');
      const value = prose(targetValue(instruction));
      if (el.maxLength >= 0 && value.length > el.maxLength) return noWrite('value_too_long');
      if (el.value && !proseEqual(el.value, value)) return noWrite('existing_value');
      if (proseEqual(el.value, value)) return { strategy: 'native', attempts: 0 };
      await nativeSet(el, value, { ...ctx, async check() {
        await ctx.check();
        const reason = guards(el);
        if (reason) throw Error(reason);
        if (el.closest('[aria-disabled="true"],[inert]')) throw Error('disabled');
        if (el.closest('[aria-readonly="true"]')) throw Error('readonly');
        if (el.maxLength >= 0 && value.length > el.maxLength) throw Error('value_too_long');
        if (el.value && !proseEqual(el.value, value)) throw Error('existing_value');
      } });
      await tick();
      return { strategy: 'native', attempts: 1 };
    }
  });

  function richtextRoot(el, probe) {
    const editable = el?.getAttribute?.('contenteditable')?.toLowerCase();
    if (!['', 'true', 'plaintext-only'].includes(editable)
      || !el.matches('div,p,span,pre,blockquote,section,article') || !plain(el, probe)) return false;
    // Only an explicit editing host owns this value. Nested editors and unknown
    // runtime models stay manual; a role or CSS class alone grants no writer.
    for (let parent = el.parentElement; parent; parent = parent.parentElement) {
      const value = parent.getAttribute('contenteditable')?.toLowerCase();
      if (['', 'true', 'plaintext-only'].includes(value)) return false;
      if (value === 'false') break;
    }
    return true;
  }
  function richtextModel(el, probe) {
    const nodes = [el, ...el.querySelectorAll('*')];
    const safeTags = /^(?:DIV|P|SPAN|BR|B|STRONG|I|EM|U|S|STRIKE|UL|OL|LI|BLOCKQUOTE|PRE|CODE|H[1-6]|SECTION|ARTICLE)$/u;
    const block = /^(?:DIV|P|LI|UL|OL|BLOCKQUOTE|PRE|H[1-6]|SECTION|ARTICLE)$/u;
    const available = richtextRoot(el, probe) && nodes.every(node => {
      const style = getComputedStyle(node);
      const displays = node === el ? ['', 'block', 'inline', 'inline-block', 'flow-root', 'list-item']
        : block.test(node.tagName) ? ['', 'block', 'list-item', 'flow-root'] : ['', 'inline'];
      return safeTags.test(node.tagName) && (node === el || !node.hasAttribute('contenteditable'))
        && !node.matches('[hidden],[aria-hidden="true"],[inert]') && style.display !== 'none'
        && !['hidden', 'collapse'].includes(style.visibility) && displays.includes(style.display);
    });
    const value = richtextValue(el);
    return { ...base(el, probe, value), available,
      disabled: !!el.closest('[aria-disabled="true"],[inert]'),
      readonly: !!el.closest('[aria-readonly="true"]'), readbackSource: 'editable_plain_text' };
  }
  register({ name: 'native-richtext', type: 'richtext', priority: 15,
    matches: richtextRoot, readModel: richtextModel,
    async performWrite(el, instruction, ctx) {
      if (typeof targetValue(instruction) !== 'string') return noWrite('invalid_text_value');
      const value = prose(targetValue(instruction));
      const owned = { ...ctx, async check() {
        await ctx.check();
        const model = richtextModel(el, globalThis.ResumeControlModel.inspect(el));
        if (!model.available || model.disabled || model.readonly || !api.helpers.clickAllowed(el)) throw Error('control_not_writable');
        if (model.value !== '' && !proseEqual(model.value, value)) throw Error('existing_value');
      } };
      await api.helpers.check(owned);
      if (proseEqual(richtextValue(el), value)) return { strategy: 'native', attempts: 0 };
      // Plain text only: never parse profile text as HTML or invoke editor APIs.
      const fragment = document.createDocumentFragment();
      value.split('\n').forEach((line, index) => {
        if (index) fragment.append(document.createElement('br'));
        fragment.append(document.createTextNode(line));
      });
      el.replaceChildren(fragment);
      for (const type of ['input', 'change', 'blur']) {
        await api.helpers.check(owned);
        const EventType = type === 'input' ? InputEvent : Event;
        el.dispatchEvent(new EventType(type, { bubbles: true,
          ...(type === 'input' ? { inputType: 'insertText', data: value } : {}) }));
      }
      await tick();
      return { strategy: 'native', attempts: 1 };
    }
  });
  register({ name: 'native-select', type: 'select',
    matches: (el, probe) => plain(el, probe) && el.tagName === 'SELECT' && !el.multiple,
    readModel: selectModel,
    plan(fact, model) {
      const planned = api.helpers.makePlan(fact, model, { type: 'select' });
      return { ...planned, ...(planned.status === 'unsupported' ? { status: 'manual' } : {}),
        writeStarted: false, liveSupportClaimed: false };
    },
    async performWrite(el, instruction, ctx) {
      const reason = guards(el);
      if (reason) return noWrite(reason);
      const value = String(targetValue(instruction) ?? '');
      const options = [...el.options].filter(node => node.value === value && !node.disabled
        && !node.closest('optgroup[disabled]') && !datePartPlaceholder(node));
      if (options.length !== 1) return noWrite(options.length ? 'ambiguous_option' : 'option_missing');
      const current = selectModel(el).value;
      if (current && !equal(current, value)) return noWrite('existing_value');
      if (el.value === value) return { strategy: 'native', attempts: 0 };
      await nativeSet(el, value, ctx);
      await tick();
      return { strategy: 'native', attempts: 1 };
    }
  });
  register({ name: 'native-radio', type: 'radio',
    matches: (el, probe) => plain(el, probe) && el.tagName === 'INPUT' && el.type === 'radio',
    readModel(el, probe) {
      const group = radios(el), selected = group.filter(node => node.checked);
      const model = base(el, probe, selected.length === 1 ? selected[0].value : '',
        selected.length === 1 ? label(selected[0]) : '',
        group.map(node => ({ value: node.value, label: label(node), disabled: disabled(node) })));
      if (selected.length > 1) { model.available = false; model.reason = 'ambiguous_radio_group'; }
      return model;
    },
    async performWrite(el, instruction, ctx) {
      const reason = guards(el);
      if (reason) return noWrite(reason);
      const value = String(targetValue(instruction) ?? '');
      const group = radios(el), selected = group.filter(node => node.checked);
      const targets = group.filter(node => node.value === value && !disabled(node));
      if (targets.length !== 1) return noWrite(targets.length ? 'ambiguous_option' : 'option_missing');
      if (selected.length > 1) return noWrite('ambiguous_radio_group');
      if (selected.length && selected[0] !== targets[0]) return noWrite('existing_value');
      const target = targets[0], targetReason = guards(target);
      if (targetReason) return noWrite(targetReason);
      if (targets[0].checked) return { strategy: 'ui', attempts: 0 };
      const ownership = { name: el.name, form: el.form, tree: el.getRootNode() };
      const snapshot = group.map(node => ({ node, value: node.value, label: label(node),
        checked: node.checked, disabled: disabled(node), readonly: node.readOnly || node.getAttribute('aria-readonly') === 'true' }));
      await safeClick(target, { ...ctx, async check() {
        await ctx.check();
        const current = radios(el);
        if (guards(el) || guards(target) || !plain(el) || !plain(target) || el.type !== 'radio' || target.type !== 'radio'
          || el.name !== ownership.name || el.form !== ownership.form || el.getRootNode() !== ownership.tree
          || current.length !== snapshot.length || snapshot.some((part, i) => current[i] !== part.node
            || part.node.value !== part.value || label(part.node) !== part.label || part.node.checked !== part.checked
            || disabled(part.node) !== part.disabled
            || (part.node.readOnly || part.node.getAttribute('aria-readonly') === 'true') !== part.readonly))
          throw Error('control_changed');
      } });
      await tick();
      return { strategy: 'ui', attempts: 1 };
    }
  });
  function switchModel(el, probe, aria = false) {
    const state = el.getAttribute('aria-checked'), checked = aria ? state === 'true' ? true : state === 'false' ? false : null : el.checked;
    return { ...base(el, probe, checked), ...(aria ? { lib: 'aria' } : {}),
      checkedValue: true, uncheckedValue: false, switchTarget: el, switchInput: aria ? null : el,
      available: typeof checked === 'boolean' && (aria ? !el.querySelector('input,textarea,select,button,a[href],[role="switch"],[role="button"],[contenteditable]') : !el.indeterminate),
      choiceConsistent: aria || state == null || state === String(checked),
      disabled: disabled(el) || !!el.closest('[aria-disabled="true"],[inert]'),
      readonly: !!el.readOnly || !!el.closest('[aria-readonly="true"]') };
  }
  for (const type of ['checkbox', 'switch']) register({ name: `native-${type}`, type,
    matches: (el, probe) => plain(el, probe) && el.tagName === 'INPUT' && el.type === 'checkbox'
      && (el.getAttribute('role') === 'switch') === (type === 'switch'),
    readModel: (el, probe) => type === 'switch' ? switchModel(el, probe) : base(el, probe, !!el.checked),
    async performWrite(el, instruction, ctx) {
      const reason = guards(el);
      if (reason) return noWrite(reason);
      const value = targetValue(instruction);
      if (typeof value !== 'boolean') return noWrite(`invalid_${type}_value`);
      if (type === 'checkbox' && el.checked && !value) return noWrite('existing_value');
      if (el.checked === value) return { strategy: 'ui', attempts: 0 };
      const checked = el.checked, role = el.getAttribute('role');
      await safeClick(el, { ...ctx, async check() {
        await ctx.check();
        if (guards(el) || !plain(el) || el.type !== 'checkbox' || el.getAttribute('role') !== role || el.checked !== checked)
          throw Error('control_changed');
      } });
      await tick();
      return { strategy: 'ui', attempts: 1 };
    }
  });
  register({ name: 'aria-switch', lib: 'aria', type: 'switch',
    libVersionProbe: () => ({ lib: 'aria', version: 'html' }),
    matches: (el, probe) => plain(el, probe, false, true) && el.matches('[role="switch"]')
      && !el.matches('input,textarea,select,a,[contenteditable]'),
    readModel: (el, probe) => switchModel(el, probe, true),
    async performWrite(el, instruction, ctx) {
      const adapter = api.resolve(el), initial = adapter?.readModel(el);
      if (!initial?.available || !api.helpers.clickAllowed(el)) return noWrite('switch_contract_unconfirmed');
      await safeClick(el, { ...ctx, async check() {
        await ctx.check();
        const live = adapter.readModel(el);
        if (!live.available || live.disabled || live.readonly || live.value !== initial.value || guards(el)) throw Error('control_changed');
      } });
      return { strategy: 'ui', attempts: 1 };
    }
  });
  register({ name: 'upload', type: 'upload', priority: 1000,
    matches: el => el?.tagName === 'INPUT' && el.type === 'file',
    readModel: (el, probe) => ({ ...base(el, probe, ''), manual: true, manualReason: 'upload_manual',
      ...(globalThis.ResumeUploadControls?.inspect(el) || {}) }),
    plan: (_fact, model) => ({ status: 'manual', skip: true,
      reason: model.status === 'manual' ? model.reason : 'upload_manual',
      writeStarted: false, liveSupportClaimed: false }),
    performWrite: () => noWrite('upload_manual')
  });
})();
