// First-party, single-thumb L1 sliders. Plans are passive; every UI effect is
// guarded and model/DOM readback stays independent. No site selectors or save.
(() => {
  'use strict';
  const R = globalThis.ResumeControls, M = globalThis.ResumeControlModel;
  if (!R || !M) throw Error('l1_registry_required');
  if (R.list().some(adapter => adapter.name === 'native-slider')) return;
  const H = R.helpers;
  const flags = { writeStarted: false, liveSupportClaimed: false };
  const fail = reason => ({ status: 'manual', reason, ...flags });
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
  function number(value) {
    if (!['number', 'string'].includes(typeof value) || String(value).length > 128 || !decimalPattern.test(String(value))) return null;
    const result = Number(value);
    if (!Number.isFinite(result) || Math.abs(result) > Number.MAX_SAFE_INTEGER || Math.abs(decimal(value).exponent) > 324) return null;
    const exponent = Math.min(decimal(value).exponent, decimal(result).exponent);
    return scaled(value, exponent) === scaled(result, exponent) ? result : null;
  }
  function aligned(value, step, base) {
    const exponent = Math.min(...[value, step, base].map(part => decimal(part).exponent));
    return (scaled(value, exponent) - scaled(base, exponent)) % scaled(step, exponent) === 0n;
  }
  function shown(node) {
    if (!node?.isConnected || !node.getClientRects().length || node.closest('[hidden],[aria-hidden="true"]')) return false;
    for (let part = node; part; part = part.parentElement) {
      const style = getComputedStyle(part);
      if (style.display === 'none' || ['hidden', 'collapse'].includes(style.visibility)) return false;
    }
    return true;
  }
  function plain(el, p) {
    if (!el.matches?.('input[type="range"]') || p.framework !== 'native' || p.lib) return false;
    for (let part = el; part && !part.matches('body,html'); part = part.parentElement) {
      if ([...part.classList].some(token => /^(?:el|ant|ivu|ud|phoenix|atsx|am)-/u.test(token))
        || part.matches('[role="combobox"],[role="listbox"],[role="tree"]')) return false;
    }
    return true;
  }
  const labelSafe = node => !node?.closest('label') || node.closest('label').control === node;
  const all = (root, selector) => [...root.querySelectorAll(selector)];
  function readModel(el, p, family) {
    const native = family === 'native', element = family === 'el';
    const ref = M.resolve(el), root = native ? el : p.controlRoot;
    const props = native ? {} : ref.props || {};
    const selector = element ? '.el-slider__button-wrapper' : '.ant-slider-handle';
    const thumbs = native ? [root] : root ? all(root, selector).filter(node => node.closest('.el-slider,.ant-slider') === root) : [];
    const tracks = native || !element ? [root] : root ? all(root, '.el-slider__runway').filter(node => node.closest('.el-slider') === root) : [];
    const thumb = thumbs.length === 1 ? thumbs[0] : null, track = tracks.length === 1 ? tracks[0] : null;
    const bound = (value, fallback) => value === undefined || native && (value === null || value === '') ? fallback : number(value);
    const rawMin = native ? root?.getAttribute('min') : props.min;
    const min = bound(rawMin, 0);
    const max = bound(native ? root?.getAttribute('max') : props.max, 100);
    const rawStep = native ? root?.getAttribute('step') : props.step;
    const step = native && rawStep === 'any' ? 'any' : bound(rawStep, 1);
    const vertical = native ? root?.getAttribute('orient') === 'vertical'
      || /^(?:vertical|sideways)-/u.test(getComputedStyle(root).writingMode || '')
      || getComputedStyle(root).appearance === 'slider-vertical' : !!props.vertical;
    const reverse = !native && !element && !!props.reverse;
    // HTML step base uses a valid explicit min, then the initial value
    // attribute, then zero; the effective range minimum still defaults to 0.
    const stepBase = native ? number(rawMin) ?? number(root?.getAttribute('value')) ?? 0 : min;
    const constraints = { min, max, step, stepBase, vertical, reverse };
    const valid = min !== null && max !== null && min < max && (step === 'any' || step !== null && step > 0);
    const value = native ? number(root?.value) : typeof p.value === 'number' ? number(p.value) : null;
    let domValue = native ? value : null;
    if (!native && thumb && valid) {
      if (element) {
        // Element 2's aria-valuetext is mounted once and becomes stale. The
        // rendered thumb position is the independently updated DOM contract.
        const raw = thumb.style[vertical ? 'bottom' : 'left'];
        const percent = /^-?(?:\d+(?:\.\d+)?|\.\d+)%$/u.test(raw) ? number(raw.slice(0, -1)) : null;
        if (percent !== null && percent >= 0 && percent <= 100 && step !== 'any') {
          const count = Math.round((max - min) * percent / 100 / step);
          const exponent = Math.min(decimal(min).exponent, decimal(step).exponent);
          const candidate = Number.isSafeInteger(count)
            ? number(`${scaled(min, exponent) + BigInt(count) * scaled(step, exponent)}e${exponent}`) : null;
          if (candidate !== null && Math.abs((candidate - min) / (max - min) * 100 - percent) <= 1e-8) domValue = candidate;
        }
        if (root.hasAttribute('aria-valuenow') && number(root.getAttribute('aria-valuenow')) !== domValue) domValue = null;
      } else domValue = number(thumb.getAttribute('aria-valuenow'));
    }
    const aria = native ? root : element ? root : thumb;
    const ariaBounds = native || !!aria && number(aria.getAttribute('aria-valuemin')) === min && number(aria.getAttribute('aria-valuemax')) === max;
    const roles = root ? all(root, '[role="slider"]') : [];
    const owned = native || root && !root.querySelector('input,textarea,select,[contenteditable],.el-slider,.ant-slider')
      && (element ? roles.length === 0 : roles.length === 1 && roles[0] === thumb)
      && M.resolve(thumb || root).vm === ref.vm;
    const orientation = native ? !vertical && getComputedStyle(root).direction !== 'rtl' : !element || !props.reverse;
    return { ...p, ...(native ? { framework: 'native', lib: 'native', version: 'html' } : {}),
      controlRoot: root, sliderInput: native ? root : null, sliderThumb: thumb, sliderTrack: track,
      value, domValue, sliderConstraints: constraints,
      sliderBusy: !native && !!(ref.vm?.dragging || ref.vm?.$refs?.button1?.dragging || ref.vm?.$refs?.sliderRef?.dragging),
      readbackSource: native ? 'input_value' : element ? 'rendered_thumb_position' : 'aria_valuenow',
      available: !!root && !!track && !!thumb && valid && ariaBounds && owned && orientation
        && !props.range && !props.multiple && !Array.isArray(p.value) && !props.showInput
        && (native || p.available && !!ref.vm && !ref.vm._isDestroyed && !ref.vm._isBeingDestroyed) && value !== null,
      disabled: !!p.disabled || !!props.disabled || !!ref.vm?.sliderDisabled
        || !!root?.matches(':disabled') || !!root?.closest('[disabled],[aria-disabled="true"],[inert]')
        || !!thumb?.closest('[disabled],[aria-disabled="true"],[inert]'),
      readonly: !!p.readonly || !!props.readonly || !!root?.readOnly
        || !!root?.closest('[readonly],[aria-readonly="true"]') || !!thumb?.closest('[readonly],[aria-readonly="true"]') };
  }
  function interactable(model) {
    return [model.controlRoot, model.sliderTrack, model.sliderThumb].every(node => shown(node) && H.clickAllowed(node) && labelSafe(node));
  }
  function plan(fact, model) {
    if (model.disabled || model.readonly) return fail(model.disabled ? 'disabled' : 'readonly');
    if (!model.available) return fail('slider_contract_unconfirmed');
    if (model.sliderBusy) return fail('slider_busy');
    if (!interactable(model)) return fail('slider_not_interactable');
    if (model.value !== model.domValue) return fail('slider_readback_mismatch');
    const operation = fact?.operation ?? 'set';
    if (!['set', 'click', 'drag'].includes(operation)) return fail('invalid_slider_operation');
    const target = number(fact && typeof fact === 'object' ? fact.value : fact);
    if (target === null) return fail('invalid_slider_value');
    const { min, max, step, stepBase } = model.sliderConstraints;
    if (target < min || target > max) return fail('slider_out_of_range');
    if (step !== 'any' && !aligned(target, step, stepBase)) return fail('slider_step_mismatch');
    if (model.value < min || model.value > max || step !== 'any' && !aligned(model.value, step, stepBase)) return fail('slider_initial_value_unconfirmed');
    const same = model.value === target;
    return { status: same ? 'success' : 'planned', reason: same ? 'preexisting_same_value' : 'ready',
      operation, value: target, modelValue: target, domValue: target, labels: [], ...flags };
  }
  function geometry(model) {
    const rect = model.sliderTrack.getBoundingClientRect();
    const { left, top, width, height } = rect;
    if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) throw Error('slider_geometry_unconfirmed');
    // Element's handler divides by clientWidth/Height rather than DOMRect.
    // Refuse transforms or borders that make the two coordinate systems differ.
    const { vertical } = model.sliderConstraints;
    if (model.lib === 'element-ui' && Math.abs((vertical ? model.sliderTrack.clientHeight : model.sliderTrack.clientWidth)
      - (vertical ? height : width)) > 1) throw Error('slider_geometry_unconfirmed');
    return { left, top, width, height };
  }
  function point(model, value, rect) {
    const { min, max, vertical, reverse } = model.sliderConstraints;
    const fraction = (value - min) / (max - min), ratio = reverse ? 1 - fraction : fraction;
    return vertical ? { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height * (1 - ratio) }
      : { clientX: rect.left + rect.width * ratio, clientY: rect.top + rect.height / 2 };
  }
  // Cancellation only removes owned gesture listeners. It dispatches no
  // trailing event and never completes a partially interrupted value change.
  function cleanup(ref, model) {
    if (model.lib === 'element-ui') {
      const button = ref.vm?.$refs?.button1;
      if (button?.$el !== model.sliderThumb) return;
      for (const type of ['mousemove', 'touchmove']) if (typeof button.onDragging === 'function') globalThis.removeEventListener(type, button.onDragging);
      for (const type of ['mouseup', 'touchend', 'contextmenu']) if (typeof button.onDragEnd === 'function') globalThis.removeEventListener(type, button.onDragEnd);
    } else if (model.lib === 'ant-design-vue') {
      const slider = ref.vm?.$refs?.sliderRef;
      if (slider?.$el !== model.controlRoot) return;
      for (const key of ['onTouchMoveListener', 'onTouchUpListener', 'onMouseMoveListener', 'onMouseUpListener']) slider[key]?.remove?.();
    }
  }
  async function write(el, instruction, ctx, family) {
    const adapter = R.resolve(el), initial = adapter.readModel(el), rect = geometry(initial), ref = M.resolve(el);
    const origin = [initial.value, initial.domValue], target = instruction.value;
    let started = false, complete = false;
    const owned = { ...ctx, async check() {
      await ctx.check();
      const live = adapter.readModel(el);
      if (!live.available || live.disabled || live.readonly || !interactable(live)
        || JSON.stringify(geometry(live)) !== JSON.stringify(rect)
        || ![origin[0], target].includes(live.value) || ![origin[1], target].includes(live.domValue)
        || !started && (live.value !== origin[0] || live.domValue !== origin[1])) throw Error('control_changed');
    } };
    const effect = async (node, type, position, buttons = 0) => {
      await H.check(owned);
      const Type = type.startsWith('pointer') ? globalThis.PointerEvent || MouseEvent : MouseEvent;
      node.dispatchEvent(new Type(type, { bubbles: true, cancelable: true, button: 0, buttons,
        ...position, ...(type.startsWith('pointer') ? { pointerId: 1, pointerType: 'mouse', isPrimary: true } : {}) }));
      await H.tick();
    };
    try {
      if (family === 'native' && instruction.operation === 'set') {
        await H.check(owned); started = true;
        await H.nativeSet(initial.sliderInput, String(target), owned);
        complete = true;
        return { strategy: 'native', attempts: 1 };
      }
      const drag = instruction.operation === 'drag';
      const node = drag ? initial.sliderThumb : initial.sliderTrack;
      const end = point(initial, target, rect), begin = drag ? point(initial, initial.value, rect) : end;
      await effect(node, 'pointerdown', begin, 1);
      await H.check(owned); started = true;
      await effect(node, 'mousedown', begin, 1);
      if (drag) {
        await effect(document, 'pointermove', end, 1);
        await effect(document, 'mousemove', end, 1);
      }
      await effect(node, 'pointerup', end);
      // Release on the original target: the event bubbles through document
      // and window to each reviewed component's own drag-end handlers.
      await effect(node, 'mouseup', end);
      if (!drag) await effect(node, 'click', end);
      if (family === 'native') {
        // Untrusted range events do not execute the browser's native thumb
        // default action. Use the standard setter and input/change readback.
        await H.nativeSet(initial.sliderInput, String(target), owned);
      }
      await H.check(owned); complete = true;
      return { strategy: 'ui', attempts: 1 };
    } finally {
      if (started && !complete) cleanup(ref, initial);
    }
  }
  for (const [family, name, lib, componentName, major] of [
    ['native', 'native-slider', 'native'], ['el', 'el-slider', 'element-ui', 'ElSlider', 2],
    ['antdv1', 'antdv1-slider', 'ant-design-vue', 'ASlider', 1]
  ]) R.register({ name, lib, type: 'slider', priority: 510,
    libVersionProbe: (_el, p) => family === 'native' ? { lib, version: 'html' }
      : p.framework === 'vue2' && p.lib === lib && p.major === major ? { lib, version: p.version } : null,
    matches: (el, p) => family === 'native' ? plain(el, p) : p.componentName === componentName,
    readModel: (el, p) => readModel(el, p, family), plan,
    performWrite: (el, instruction, ctx) => write(el, instruction, ctx, family)
  });
})();
