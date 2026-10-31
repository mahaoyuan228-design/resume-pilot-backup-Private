// Generic, local-time L1 contracts. Detection is passive; UI writers only use
// confirmed component-owned hour/minute(/second) panels. Never saves a form.
(() => {
  'use strict';
  const R = globalThis.ResumeControls;
  if (!R) throw Error('control_registry_missing');
  if (R.list().some(adapter => adapter.name === 'native-time')) return;
  const H = R.helpers, M = globalThis.ResumeControlModel;
  const flags = { writeStarted: false, liveSupportClaimed: false };
  const manual = reason => ({ status: 'manual', reason, ...flags });
  const stop = reason => ({ status: 'unsupported', reason, strategy: 'none', attempts: 0 });
  const all = (root, selector) => [...root.querySelectorAll(selector)];
  const formats = ['HH:mm', 'HH:mm:ss'];
  const dateTime = (date, format) => [date.getHours(), date.getMinutes(), ...(format === 'HH:mm:ss' ? [date.getSeconds()] : [])]
    .map(part => String(part).padStart(2, '0')).join(':');
  function valid(value, format) {
    if (typeof value !== 'string') return false;
    const match = value.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/u);
    return !!match && Number(match[1]) < 24 && Number(match[2]) < 60
      && (match[3] == null || Number(match[3]) < 60)
      && (!format || (format === 'HH:mm') === (match[3] == null));
  }
  const seconds = value => value.split(':').reduce((sum, part, index) => sum + Number(part) * [3600, 60, 1][index], 0);
  const shown = el => !!el?.isConnected && !!el.getClientRects().length
    && !el.closest('[hidden],[aria-hidden="true"]') && (() => {
      for (let node = el; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.display === 'none' || ['hidden', 'collapse'].includes(style.visibility)) return false;
      }
      return true;
    })();
  function hint(el) {
    if (el?.matches?.('input[type="time"],[data-time-picker],[data-time-format]')) return true;
    for (let node = el; node && !node.matches('body,html,form'); node = node.parentElement) {
      if (node.matches('[data-time-picker],[data-time-format]')) return true;
      if ([...node.classList].some(token => /(?:^|-)(?:time-?picker|time-?panel|time-?spinner|date-editor--time)(?:$|-)/iu.test(token))) return true;
    }
    return false;
  }
  function native(el, p) {
    if (p.framework !== 'native' || !el.matches('input[type="time"]') || el.type !== 'time') return false;
    for (let node = el; node && !node.matches('body,html,form'); node = node.parentElement) {
      if ([...node.classList].some(token => /^(?:el|ant|ivu|ud|phoenix|atsx|am)-/u.test(token))) return false;
    }
    return true;
  }
  function nativeModel(el, p) {
    return { ...p, controlRoot: el, available: native(el, p) && (el.value === '' || valid(el.value)),
      value: el.value, domValue: el.value, format: 'HH:mm[:ss]', valueFormat: 'HH:mm[:ss]', modelKind: 'html',
      version: 'html-time-v1', disabled: el.disabled || el.matches(':disabled') || !!el.closest('[aria-disabled="true"],[inert]'),
      readonly: el.readOnly || !!el.closest('[aria-readonly="true"]'),
      timeConstraints: Object.fromEntries(['min', 'max', 'step', 'value'].map(key => [key, el.getAttribute(key)])),
      detectionEvidence: 'html_input_type', readbackSource: 'html_input_value', ...flags };
  }
  function plan(fact, model) {
    if (model.disabled || model.readonly) return manual(model.disabled ? 'disabled' : 'readonly');
    if (!model.available) return manual(model.reason || 'time_readback_unconfirmed');
    const value = fact && typeof fact === 'object' ? fact.value : fact;
    if (value == null || value === '') return { status: 'unsupported', reason: 'no_fact', ...flags };
    if (!valid(value, model.modelKind === 'html' ? null : model.format)) return manual('invalid_time_precision');
    if (model.timeConstraints) {
      const { min, max, step, value: initial } = model.timeConstraints;
      if ([min, max].some(bound => bound != null && bound !== '' && !valid(bound))) return manual('time_constraint_unconfirmed');
      const n = seconds(value), lo = min ? seconds(min) : null, hi = max ? seconds(max) : null;
      if (lo != null && hi != null && lo > hi ? n < lo && n > hi : lo != null && n < lo || hi != null && n > hi)
        return manual('time_out_of_range');
      if (step !== 'any') {
        const size = step == null || step === '' ? 60 : Number(step);
        if (!Number.isFinite(size) || size <= 0 || step != null && step !== '' && !/^(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(step))
          return manual('time_constraint_unconfirmed');
        const count = (n - (lo ?? (valid(initial) ? seconds(initial) : 0))) / size;
        if (!Number.isFinite(count) || Math.abs(count - Math.round(count)) > 1e-8) return manual('time_step_mismatch');
      }
    }
    if ([model.value, model.domValue].some(current => current !== '' && current !== value)) return manual('existing_value');
    const same = model.value === value && model.domValue === value;
    return { status: same ? 'success' : 'planned', reason: same ? 'preexisting_same_value' : 'ready',
      value, modelValue: value, domValue: value, format: model.format, valueFormat: model.valueFormat,
      readbackSource: model.readbackSource, strategy: model.modelKind === 'html' ? 'native' : 'ui', ...flags };
  }
  R.register({ name: 'native-time', lib: 'native', type: 'time', priority: 25,
    matches: native, libVersionProbe: () => ({ lib: 'native', version: 'html-time-v1' }), readModel: nativeModel, plan,
    async performWrite(el, instruction, ctx) {
      const guarded = { ...ctx, async check() {
        await ctx.check();
        const current = plan({ value: instruction.value }, nativeModel(el, M.inspect(el)));
        if (!['planned', 'success'].includes(current.status)) throw Error(current.reason);
      } };
      await H.nativeSet(el, instruction.value, guarded);
      return { strategy: 'native', attempts: 1 };
    } });

  const families = [
    { name: 'antdv1-time', component: 'ATimePicker', lib: 'ant-design-vue', major: 1, root: '.ant-time-picker',
      panel: '.ant-time-picker-panel', columns: '.ant-time-picker-panel-select', disabled: '.ant-time-picker-panel-select-option-disabled' },
    { name: 'el-time', component: 'ElTimePicker', lib: 'element-ui', major: 2, root: '.el-date-editor--time',
      panel: '.el-time-panel', columns: '.el-time-spinner__wrapper', disabled: '.disabled' },
  ];
  const confirmed = (p, family) => p.framework === 'vue2' && p.componentName === family.component
    && p.lib === family.lib && p.major === family.major;
  function componentModel(el, p, family) {
    const ref = M.resolve(el), props = ref.props || {}, root = ref.element, inputs = root ? all(root, 'input:not([type="hidden"])') : [];
    const input = inputs[0], format = props.format || 'HH:mm:ss', valueFormat = props.valueFormat || format;
    const modelKind = props.valueFormat ? 'formatted' : family.major === 1 ? 'moment' : 'date';
    const raw = props.value;
    let value = '', readable = raw == null || raw === '';
    if (!readable && modelKind === 'formatted') { value = raw; readable = valid(raw, format); }
    if (!readable && modelKind === 'moment' && raw?._isAMomentObject === true && typeof raw.format === 'function'
      && typeof raw.isValid === 'function' && raw.isValid()) { value = raw.format(format); readable = valid(value, format); }
    if (!readable && modelKind === 'date' && raw instanceof Date && Number.isFinite(+raw)) {
      value = dateTime(raw, format); readable = valid(value, format);
    }
    const structural = confirmed(p, family) && root?.matches(family.root) && inputs.length === 1
      && input.type === 'text' && !props.isRange && !props.use12Hours && !props.arrowControl;
    const formatConfirmed = formats.includes(format) && valueFormat === format;
    return { ...p, controlRoot: root, format, valueFormat, modelKind, value, domValue: input?.value ?? '',
      available: !!structural && formatConfirmed && readable && (input.value === '' || valid(input.value, format)),
      reason: !structural ? 'time_ownership_unconfirmed' : !formatConfirmed ? 'time_format_unconfirmed' : 'time_readback_unconfirmed',
      disabled: p.disabled || !!input?.disabled || !!input?.matches(':disabled') || !!root?.closest('[aria-disabled="true"],[inert]'),
      // A readonly display face is normal for panel-only pickers. Component and
      // ARIA readonly still forbid interaction; no HTML setter is used here.
      readonly: !!props.readonly || !!root?.closest('[aria-readonly="true"]') || input?.getAttribute('aria-readonly') === 'true',
      detectionEvidence: 'versioned_vue_time_owner', readbackSource: 'public_time_model_and_input', ...flags };
  }
  function ownedPanel(vm, family) {
    const node = family.major === 1 ? vm?.$refs?.timePicker?.$refs?.panel?.$el : vm?.picker?.$el;
    return node?.matches?.(family.panel) ? node : node?.closest?.(family.panel);
  }
  async function writePanel(el, instruction, ctx, family) {
    const original = componentModel(el, M.inspect(el), family), owner = M.resolve(el), root = original.controlRoot;
    const input = root?.querySelector('input'), selector = families.map(item => item.panel).join(',');
    if (!input || all(document, selector).some(shown)) return stop('control_busy');
    let expected = [original.value, original.domValue], panel = null, opening = true;
    const stable = async () => {
      await ctx.check();
      const ref = M.resolve(el), live = componentModel(el, M.inspect(el), family);
      // Element initializes an empty public model while its panel opens. Accept
      // that one transition only from this visible, instance-owned panel date.
      const initialDate = owner.vm?.picker?.date, initialPanel = ownedPanel(owner.vm, family);
      if (opening && family.major === 2 && expected.every(value => value === '')
        && ref.vm === owner.vm && initialDate instanceof Date && Number.isFinite(+initialDate)
        && shown(initialPanel) && live.value === dateTime(initialDate, original.format) && live.domValue === live.value)
        expected = [live.value, live.domValue];
      if (ref.vm !== owner.vm || owner.vm?._isDestroyed || owner.vm?._isBeingDestroyed
        || live.controlRoot !== root || live.version !== original.version || !live.available
        || live.disabled || live.readonly || live.format !== original.format || live.valueFormat !== original.valueFormat
        || live.modelKind !== original.modelKind || live.value !== expected[0] || live.domValue !== expected[1]) throw Error('control_changed');
      const visible = all(document, selector).filter(shown);
      if (visible.length > 1 || panel && (visible.length !== 1 || visible[0] !== panel || ownedPanel(owner.vm, family) !== panel))
        throw Error('overlay_ambiguous');
    };
    const guarded = { ...ctx, check: stable };
    await H.safeClick(input, guarded);
    for (let i = 0; i < 40; i++) {
      await stable();
      const visible = all(document, family.panel).filter(shown), candidate = ownedPanel(owner.vm, family);
      if (visible.length === 1 && candidate === visible[0]) { panel = candidate; break; }
      await H.tick(20);
    }
    if (!panel) return stop('time_panel_unconfirmed');
    opening = false;
    const parts = instruction.value.split(':').map(Number);
    const columns = () => all(panel, family.columns).filter(shown);
    let lastTarget;
    for (let index = 0; index < parts.length; index++) {
      await stable();
      const groups = columns();
      if (groups.length !== parts.length || groups.some(group => group.classList.contains('is-arrow'))) return stop('time_panel_structure');
      const targetOptions = () => all(groups[index], 'ul > li').filter(node => /^\d{1,2}$/u.test(node.textContent.trim())
        && Number(node.textContent.trim()) === parts[index] && !node.matches(`${family.disabled},[disabled],[aria-disabled="true"]`));
      const targets = targetOptions();
      if (targets.length !== 1) return stop('time_option_missing_or_disabled');
      lastTarget = targets[0];
      await H.safeClick(lastTarget, { ...guarded, async check() {
        await stable();
        if (columns()[index] !== groups[index] || !lastTarget.isConnected || targetOptions().length !== 1
          || targetOptions()[0] !== lastTarget) throw Error('time_option_changed');
      } });
      const live = componentModel(el, M.inspect(el), family);
      expected = [live.value, live.domValue];
    }
    await stable();
    if (family.major === 2) {
      const selector = 'button.el-time-panel__btn.confirm[type="button"]', confirm = all(panel, selector);
      if (confirm.length !== 1) return stop('time_confirm_unconfirmed');
      await H.safeClick(confirm[0], { ...guarded, async check() {
        await stable();
        const current = all(panel, selector);
        if (current.length !== 1 || current[0] !== confirm[0]) throw Error('time_confirm_changed');
      } });
    } else {
      await H.check(guarded);
      if (!panel.contains(lastTarget) || !H.clickAllowed(lastTarget)) return stop('time_option_changed');
      lastTarget.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true }));
    }
    for (let i = 0; i < 60; i++) {
      await H.check(ctx);
      if (all(document, selector).some(node => shown(node) && node !== panel)) return stop('overlay_ambiguous');
      if (!shown(panel)) return { strategy: 'ui', attempts: 1 };
      await H.tick(20);
    }
    return stop('owned_overlay_cleanup_timeout');
  }
  for (const family of families) R.register({ name: family.name, lib: family.lib, type: 'time', priority: 800,
    matches: (_el, p) => confirmed(p, family), readModel: (el, p) => componentModel(el, p, family), plan,
    performWrite: (el, instruction, ctx) => writePanel(el, instruction, ctx, family) });
  R.register({ name: 'time-unknown', lib: 'time', type: 'time', priority: 799,
    // Unknown complex widgets must also outrank their nested ElInput/AInput.
    matches: (el, p) => hint(el) && !native(el, p) && !families.some(family => confirmed(p, family)),
    libVersionProbe: () => ({ lib: 'time', version: 'unknown' }),
    readModel: (el, p) => ({ ...p, controlRoot: el, available: false, ...flags }),
    plan: () => manual('time_contract_unconfirmed') });
  globalThis.ResumeTimeControls = Object.freeze({ version: 1, valid, liveSupportClaimed: false });
})();
