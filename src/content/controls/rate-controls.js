// Generic, controlled L1 ratings. Read probes and plans are passive; writes
// dispatch guarded component/ARIA UI events and never call model handlers.
(() => {
  'use strict';
  const R = globalThis.ResumeControls, M = globalThis.ResumeControlModel;
  if (!R || !M) throw Error('l1_registry_required');
  if (R.list().some(adapter => adapter.name === 'el-rate')) return;
  const H = R.helpers;
  const flags = { writeStarted: false, liveSupportClaimed: false };
  const fail = reason => ({ status: 'manual', reason, ...flags });
  const all = (root, selector) => root ? [...root.querySelectorAll(selector)] : [];
  function number(value) {
    if (!['number', 'string'].includes(typeof value) || String(value).length > 128
      || !/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(String(value))) return null;
    const result = Number(value);
    if (!Number.isFinite(result) || Math.abs(result) > Number.MAX_SAFE_INTEGER) return null;
    const parts = part => {
      const [mantissa, exponent = '0'] = String(part).toLowerCase().split('e');
      const [whole, fraction = ''] = mantissa.split('.');
      return { coefficient: BigInt(whole + fraction), exponent: Number(exponent) - fraction.length };
    };
    const a = parts(value), b = parts(result), exponent = Math.min(a.exponent, b.exponent);
    if ([a.exponent, b.exponent].some(part => Math.abs(part) > 324)) return null;
    return a.coefficient * 10n ** BigInt(a.exponent - exponent)
      === b.coefficient * 10n ** BigInt(b.exponent - exponent) ? result : null;
  }
  function shown(node) {
    if (!node?.isConnected || !node.getClientRects().length || node.closest('[hidden],[aria-hidden="true"]')) return false;
    for (let part = node; part; part = part.parentElement) {
      const style = getComputedStyle(part);
      if (style.display === 'none' || ['hidden', 'collapse'].includes(style.visibility)) return false;
    }
    return true;
  }
  const labelSafe = node => !node?.closest('label') || node.closest('label').control === node;
  const interactable = model => model.rateTargets.length > 0
    && model.rateTargets.every(node => shown(node) && H.clickAllowed(node) && labelSafe(node));
  function ariaRoot(el) {
    const root = el.closest?.('[role="slider"]');
    return root && /^(?:rating|rate|star rating)$/iu.test(H.norm(root.getAttribute('aria-roledescription')))
      && !root.closest('.el-rate,.ant-rate,.el-slider,.ant-slider') ? root : null;
  }
  function ariaText(root, max) {
    const match = /^(\d+(?:\.\d+)?) (?:of|out of) (\d+) stars$/u.exec(H.norm(root?.getAttribute('aria-valuetext')));
    return match && number(match[2]) === max ? number(match[1]) : null;
  }
  function antValue(items, max) {
    let value = 0, ended = false;
    for (let index = 0; index < items.length; index++) {
      const item = items[index], classes = ['full', 'half', 'zero'].filter(state => item.classList.contains(`ant-rate-star-${state}`));
      const radio = item.firstElementChild;
      if (classes.length !== 1 || !radio?.matches('[role="radio"]')
        || number(radio.getAttribute('aria-posinset')) !== index + 1 || number(radio.getAttribute('aria-setsize')) !== max) return null;
      const state = classes[0], checked = state !== 'zero';
      if (radio.getAttribute('aria-checked') !== String(checked) || ended && checked) return null;
      if (state === 'full') value++;
      else { if (state === 'half') value += 0.5; ended = true; }
    }
    return value;
  }
  function readModel(el, p, family) {
    const aria = family === 'aria', ant = family === 'antdv1', plus = family === 'plus';
    const ref = M.resolve(el), props = ref.props || {}, root = aria ? ariaRoot(el) : p.controlRoot;
    const max = aria ? number(root?.getAttribute('aria-valuemax')) : number((ant ? props.count : props.max) ?? 5);
    const step = aria ? 1 : props.allowHalf ? 0.5 : 1;
    const allowClear = aria ? false : ant ? props.allowClear !== false : plus && !!props.clearable;
    const rateConstraints = { min: 0, max, step, allowClear };
    const valid = Number.isInteger(max) && max >= 1 && max <= 20;
    const items = aria ? [] : all(root, ant ? '.ant-rate-star' : '.el-rate__item')
      .filter(node => node.closest('.el-rate,.ant-rate') === root);
    const clicks = ant ? items.map(item => item.firstElementChild) : items;
    const icons = aria || ant ? [] : items.map(item => [...item.children].find(node => node.classList.contains('el-rate__icon')));
    const rateTargets = root ? [root, ...clicks, ...icons].filter(Boolean) : [];
    const value = aria ? number(root?.getAttribute('aria-valuenow')) : typeof p.value === 'number' ? number(p.value) : null;
    const domValue = aria ? ariaText(root, max) : ant ? antValue(items, max) : number(root?.getAttribute('aria-valuenow'));
    const bounds = ant || !!root && number(root.getAttribute('aria-valuemin')) === 0
      && number(root.getAttribute('aria-valuemax')) === max;
    const badChildren = 'input,textarea,select,[contenteditable],.el-rate,.ant-rate,.el-slider,.ant-slider,[role="slider"],[role="combobox"],[role="listbox"],[role="tree"],[role="switch"],[role="spinbutton"],[role="textbox"],[role="checkbox"]';
    const structure = !!root && !root.querySelector(badChildren) && (aria
      ? root.tabIndex >= 0 && [null, 'horizontal'].includes(root.getAttribute('aria-orientation')) && getComputedStyle(root).direction !== 'rtl'
      : items.length === max && items.every(item => item.parentElement === root) && (ant ? root.matches('ul.ant-rate[role="radiogroup"]')
        && clicks.every(node => node?.matches('[role="radio"]')) && all(root, '[role="radio"]').length === max
        : root.matches('.el-rate[role="slider"]') && icons.every(Boolean))) && (ant || !root.querySelector('[role="radio"]'));
    const owner = aria || !!ref.vm && !ref.vm._isDestroyed && !ref.vm._isBeingDestroyed && !ref.vm.isUnmounted
      && ref.element === root && p.available;
    const antOwner = ant ? ref.vm?.$refs?.refRate || ref.vm?.$children?.find(child => child.$el === root && child.$options?.name === 'Rate') : null;
    return { ...p, ...(aria ? { framework: 'native', lib: 'aria', version: '1', componentName: 'AriaRating' } : {}),
      controlRoot: root, value, domValue, rateConstraints, rateTargets, rateInteractable: interactable({ rateTargets }),
      rateBusy: !aria && (typeof ref.vm?.hoverIndex === 'number' && ref.vm.hoverIndex !== -1
        || icons.some(icon => icon?.classList.contains('hover')) || ant && antOwner?.hoverValue !== undefined),
      readbackSource: aria ? 'aria_valuetext' : ant ? 'rendered_star_classes' : 'aria_valuenow',
      available: !!root && valid && bounds && structure && owner && value !== null,
      disabled: !!p.disabled || !!props.disabled || !!ref.vm?.rateDisabled
        || rateTargets.some(node => !!node.closest('[disabled],[aria-disabled="true"],[inert]')) || !!root?.classList.contains('ant-rate-disabled')
        || !!root?.classList.contains('is-disabled'),
      readonly: !!p.readonly || !!props.readonly || rateTargets.some(node => !!node.closest('[readonly],[aria-readonly="true"]')) };
  }
  function plan(fact, model) {
    if (model.disabled || model.readonly) return fail(model.disabled ? 'disabled' : 'readonly');
    if (!model.available) return fail('rate_contract_unconfirmed');
    if (model.rateBusy) return fail('rate_busy');
    if (!interactable(model)) return fail('rate_not_interactable');
    if (model.value !== model.domValue) return fail('rate_readback_mismatch');
    const operation = fact?.operation ?? 'set';
    if (!['set', 'click'].includes(operation)) return fail('invalid_rate_operation');
    const target = number(fact && typeof fact === 'object' ? fact.value : fact);
    if (target === null) return fail('invalid_rate_value');
    const { min, max, step } = model.rateConstraints;
    if (target < min || target > max) return fail('rate_out_of_range');
    if (!Number.isInteger(target / step)) return fail('rate_step_mismatch');
    if (model.value < min || model.value > max || !Number.isInteger(model.value / step)) return fail('rate_initial_value_unconfirmed');
    const same = model.value === target;
    if (!same && operation === 'click' && target === 0 && !model.rateConstraints.allowClear) return fail('rate_clear_unavailable');
    return { status: same ? 'success' : 'planned', reason: same ? 'preexisting_same_value' : 'ready',
      operation, value: target, modelValue: target, domValue: target, labels: [], ...flags };
  }
  function geometry(node) {
    const rect = node.getBoundingClientRect(), { left, top, width, height } = rect;
    if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) throw Error('rate_geometry_unconfirmed');
    return { left, top, width, height };
  }
  async function write(el, instruction, ctx, family) {
    const adapter = R.resolve(el), initial = adapter.readModel(el), root = initial.controlRoot;
    const { step, max } = initial.rateConstraints, target = instruction.value;
    let expected = initial.value, preview = null, attempts = 0;
    const guarded = { ...ctx, async check() {
      await ctx.check();
      const live = adapter.readModel(el);
      if (!live.available || live.disabled || live.readonly || !interactable(live)
        || live.controlRoot !== root || live.value !== expected
        || live.domValue !== expected && (preview === null || live.domValue !== preview)) throw Error('control_changed');
    } };
    const key = async (name, next) => {
      await H.check(guarded);
      root.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true,
        key: name, code: name, keyCode: { ArrowLeft: 37, ArrowRight: 39, Home: 36 }[name],
        which: { ArrowLeft: 37, ArrowRight: 39, Home: 36 }[name] }));
      attempts++;
      await H.tick();
      const after = adapter.readModel(el);
      if (after.value !== next || after.domValue !== next) throw Error('rate_readback_mismatch');
      expected = next;
      await H.check(guarded);
    };
    if (instruction.operation === 'set') {
      if (family === 'aria' && expected !== 0) await key('Home', 0);
      for (let count = 0; expected !== target && count < max / step + 1; count++) {
        const next = expected + (target > expected ? step : -step);
        await key(target > expected ? 'ArrowRight' : 'ArrowLeft', next);
      }
      if (expected !== target) throw Error('rate_step_unconfirmed');
      return { strategy: 'ui', attempts };
    }
    const aria = family === 'aria', ant = family === 'antdv1';
    const clickValue = target === 0 ? initial.value : target;
    const index = Math.ceil(clickValue) - 1;
    const item = aria ? root : all(root, ant ? '.ant-rate-star' : '.el-rate__item')[index];
    const click = aria ? root : ant ? item?.firstElementChild : item;
    const move = aria || ant ? click : [...(item?.children || [])].find(node => node.classList.contains('el-rate__icon'));
    if (!item || !click || !move) throw Error('rate_target_unconfirmed');
    const rootRect = geometry(root), itemRect = geometry(item), rect = geometry(aria || ant ? item : move);
    if (!aria && step === 0.5 && Math.abs((ant ? item : move).clientWidth - rect.width) > 1) throw Error('rate_geometry_unconfirmed');
    const fraction = aria ? (clickValue - 0.5) / max : clickValue % 1 ? 0.25 : 0.75;
    const position = { clientX: rect.left + rect.width * fraction, clientY: rect.top + rect.height / 2 };
    const effect = async (node, type) => {
      await H.check(guarded);
      // Element scales the hovered icon itself. Its owned star item and root
      // remain the stable coordinate frame throughout that normal animation.
      if (JSON.stringify(geometry(root)) !== JSON.stringify(rootRect)
        || JSON.stringify(geometry(item)) !== JSON.stringify(itemRect)) throw Error('rate_geometry_unconfirmed');
      const Type = type.startsWith('pointer') ? globalThis.PointerEvent || MouseEvent : MouseEvent;
      const event = new Type(type, { bubbles: type !== 'mouseleave', cancelable: true, button: 0,
        ...position, ...(type.startsWith('pointer') ? { pointerId: 1, pointerType: 'mouse', isPrimary: true } : {}) });
      // The reviewed Element handlers use offsetX; untrusted events do not
      // consistently derive it from the target's local geometry in every DOM.
      Object.defineProperty(event, 'offsetX', { value: rect.width * fraction });
      Object.defineProperty(event, 'pageX', { value: position.clientX + globalThis.scrollX });
      node.dispatchEvent(event);
      await H.tick();
    };
    // Hover is owned only for this sequence. The public model must stay fixed
    // until click; each event rechecks owner, constraints and the target nodes.
    if (!aria) {
      preview = clickValue;
      await effect(move, 'mousemove');
    }
    await effect(click, 'pointerdown');
    await effect(click, 'mousedown');
    await effect(click, 'pointerup');
    await effect(click, 'mouseup');
    await effect(click, 'click');
    attempts++;
    expected = target; preview = null;
    if (!aria) await effect(ant ? root : item, 'mouseleave');
    await H.check(guarded);
    return { strategy: 'ui', attempts };
  }
  for (const [family, name, lib, framework, major] of [
    ['el', 'el-rate', 'element-ui', 'vue2', 2], ['plus', 'elplus-rate', 'element-plus', 'vue3', 2],
    ['antdv1', 'antdv1-rate', 'ant-design-vue', 'vue2', 1], ['aria', 'aria-rate', 'aria', 'native', null]
  ]) R.register({ name, lib, type: 'rate', priority: 525,
    libVersionProbe: (_el, p) => family === 'aria' ? p.framework === 'native' && !p.lib ? { lib, version: '1' } : null
      : p.framework === framework && p.lib === lib && p.major === major ? { lib, version: p.version } : null,
    matches: (el, p) => family === 'aria' ? !!ariaRoot(el) : p.componentName === (family === 'antdv1' ? 'ARate' : 'ElRate'),
    readModel: (el, p) => readModel(el, p, family), plan,
    performWrite: (el, instruction, ctx) => write(el, instruction, ctx, family)
  });
})();
