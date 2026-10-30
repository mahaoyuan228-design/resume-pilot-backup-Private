// First-party ordered L1 registry. Shadow inspection only calls plan/read.
// The separate default-OFF write bridge supplies an explicit per-effect guard.
// No implementation source from the ATS research repos is used.
(() => {
  'use strict';
  // Rebuild old registries so reinjection installs current dropdown readback
  // contracts as well as the current model resolver.
  if (globalThis.ResumeControls?.version === 1 && globalThis.ResumeControls.revision === 12) return;
  const adapters = new Map();
  // Executable dropdown/choice plans stay bound to their original widget in MAIN.
  // Serialized shadow observations carry no authority to write another root.
  const selectBindings = new WeakMap();
  const choiceBindings = new WeakMap();
  const searchSelections = new WeakMap();
  const norm = value => String(value ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
  // Prose keeps line breaks, spacing and Unicode; HTML only normalises CR/LF.
  const prose = value => String(value ?? '').replace(/\r\n?/gu, '\n');
  const proseEqual = (a, b) => typeof a === 'string' && typeof b === 'string' && prose(a) === prose(b);
  function richtextValue(root) {
    const block = /^(?:DIV|P|LI|UL|OL|BLOCKQUOTE|PRE|H[1-6]|SECTION|ARTICLE)$/u;
    const read = node => {
      if (node.nodeType === 3) return node.data;
      if (node.nodeName === 'BR') return '\n';
      const children = [...node.childNodes].filter(child => child.nodeType === 1 || child.nodeType === 3);
      if ((node === root || block.test(node.nodeName)) && children.length === 1 && children[0].nodeName === 'BR') return '';
      let text = '', previous = null;
      for (const child of children) {
        const value = read(child), isBlock = block.test(child.nodeName);
        if (!isBlock && value === '') continue;
        if (previous && (previous.block || isBlock)) text += '\n';
        text += value; previous = { block: isBlock };
      }
      return text;
    };
    return prose(read(root));
  }
  const equal = (a, b) => Array.isArray(a) || Array.isArray(b)
    ? Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => equal(v, b[i]))
    : typeof a === 'boolean' || typeof b === 'boolean' ? a === b : norm(a) === norm(b);
  const choiceEqual = (a, b) => Array.isArray(a) || Array.isArray(b)
    ? Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => choiceEqual(value, b[index]))
    : typeof a === typeof b && a === b;
  const empty = value => value == null || value === '' || (Array.isArray(value) && value.every(empty));
  const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));
  const manual = reason => ({ status: 'manual', reason, writeStarted: false, liveSupportClaimed: false });
  const manualSelector = 'iframe,[data-captcha],[class*="captcha" i],[id*="captcha" i],[name*="captcha" i],input[autocomplete="one-time-code"]';
  const manualReason = el => {
    if (!el?.isConnected) return 'target_detached';
    if (el.ownerDocument !== document || el.getRootNode?.() !== document) return 'shadow_or_frame_manual';
    // Inspect only the frame element, never its document/window or descendants.
    if (el.closest?.(manualSelector)) return 'iframe_or_captcha_manual';
    return null;
  };
  function validDate(value, type) {
    const month = type === 'month' || type === 'month-range';
    if (typeof value !== 'string' || !(month ? /^\d{4}-\d{2}$/u : /^\d{4}-\d{2}-\d{2}$/u).test(value)) return false;
    const [year, mon, day = 1] = value.split('-').map(Number), date = new Date(Date.UTC(year, mon - 1, day));
    return year >= 1900 && year <= 2100 && date.getUTCFullYear() === year && date.getUTCMonth() + 1 === mon && date.getUTCDate() === day;
  }
  function makePlan(fact, model, { type = 'text' } = {}) {
    const value = fact && typeof fact === 'object' && !Array.isArray(fact) ? fact.value : fact;
    if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return { status: 'unsupported', reason: 'no_fact' };
    if (model.disabled || model.readonly) return { status: 'manual', reason: model.disabled ? 'disabled' : 'readonly' };
    if (!model.available) return { status: 'unsupported', reason: 'model_unavailable' };
    if (['textarea', 'richtext'].includes(type)) {
      if (typeof value !== 'string') return manual('invalid_text_value');
      if (typeof model.value !== 'string' || typeof model.domValue !== 'string') return manual('text_model_unconfirmed');
      const target = prose(value);
      if (Number.isInteger(model.maxLength) && model.maxLength >= 0 && target.length > model.maxLength) return manual('value_too_long');
      if ([model.value, model.domValue].some(current => current !== '' && !proseEqual(current, target))) return manual('existing_value');
      const same = proseEqual(model.value, target) && proseEqual(model.domValue, target);
      return { status: same ? 'success' : 'planned', reason: same ? 'preexisting_same_value' : 'ready',
        value: target, modelValue: target, domValue: target, labels: [], writeStarted: false, liveSupportClaimed: false };
    }
    if (['checkbox', 'switch'].includes(type) && !Array.isArray(value) && typeof value !== 'boolean')
      return { status: 'unsupported', reason: `invalid_${type}_value` };
    if (type === 'checkbox' && Array.isArray(value) && !Array.isArray(model.value))
      return { status: 'unsupported', reason: 'invalid_checkbox_value' };
    let target = value, labels = Array.isArray(value) ? value.map(norm) : [norm(value)], domValue = value;
    if (['date', 'month', 'month-range'].includes(type)) {
      const values = Array.isArray(value) ? value : [value];
      if ((type === 'month-range' && values.length !== 2) || !values.every(v => validDate(v, type))) return { status: 'unsupported', reason: 'invalid_date_precision' };
      if (type === 'month-range' && values[0] > values[1]) return { status: 'unsupported', reason: 'invalid_date_range' };
      if (!['YYYY-MM', 'yyyy-MM', 'YYYY-MM-DD', 'yyyy-MM-dd'].includes(model.valueFormat)) return { status: 'unsupported', reason: 'value_format_unconfirmed' };
    }
    if (['select', 'select-search', 'radio'].includes(type)) {
      const hits = (model.options || []).filter(option => !option.disabled && (equal(option.value, value) || equal(option.label, value)));
      if (hits.length !== 1) {
        if (type === 'select-search' && model.remote && hits.length === 0 && !empty(model.value) && !equal(model.value, value)) return { status: 'unsupported', reason: 'existing_value' };
        if (type === 'select-search' && model.remote && hits.length === 0) return { status: 'planned', reason: 'remote_options_pending',
          value, modelValue: value, labels, domValue: norm(value), requiresSearch: true };
        return { status: 'unsupported', reason: hits.length > 1 ? 'option_ambiguous' : 'option_missing' };
      }
      if (hits[0].valueSupported === false) return { status: 'unsupported', reason: 'option_value_unavailable' };
      target = hits[0].value; labels = [hits[0].label]; domValue = hits[0].label;
    }
    if (['checkbox', 'checkbox-group'].includes(type) && Array.isArray(value)) {
      const previous = Array.isArray(model.value) ? model.value : [];
      target = [...previous]; labels = [];
      for (const choice of value) {
        const hits = (model.options || []).filter(o => !o.disabled && (equal(o.value, choice) || equal(o.label, choice)));
        if (hits.length !== 1) return { status: 'unsupported', reason: 'option_missing_or_ambiguous' };
        if (hits[0].valueSupported === false) return { status: 'unsupported', reason: 'option_value_unavailable' };
        if (!target.some(v => equal(v, hits[0].value))) target.push(hits[0].value);
      }
      labels = target.map(v => (model.options || []).find(o => equal(o.value, v))?.label || norm(v));
      domValue = labels;
    }
    if (['cascader', 'pair-cascader'].includes(type)) {
      if (!Array.isArray(value) || !value.length) return { status: 'unsupported', reason: 'path_required' };
      let options = model.options || [], path = [], pathLabels = [], leaf;
      for (const part of value) {
        const hits = options.filter(o => !o.disabled && (equal(o.value, part) || equal(o.label, part)));
        if (hits.length !== 1) return { status: 'unsupported', reason: model.lazy ? 'lazy_options_pending' : 'path_unconfirmed' };
        if (hits[0].valueSupported === false) return { status: 'unsupported', reason: 'option_value_unavailable' };
        leaf = hits[0];
        path.push(leaf.value); pathLabels.push(leaf.label); options = leaf.children || [];
      }
      if (options.length || leaf?.leaf === false) return { status: 'unsupported', reason: model.lazy ? 'lazy_options_pending' : 'path_incomplete' };
      target = path; labels = pathLabels; domValue = pathLabels;
    }
    // A checkbox group only adds; every other control preserves existing data.
    if (['checkbox', 'switch'].includes(type) && typeof target === 'boolean' && typeof model.value === 'boolean') {
      if (model.value && !target) return { status: 'unsupported', reason: 'existing_value' };
    } else if (!empty(model.value) && !equal(model.value, target) && !(Array.isArray(target) && ['checkbox', 'checkbox-group'].includes(type))) {
      return { status: 'unsupported', reason: 'existing_value' };
    }
    const same = equal(model.value, target) && equal(model.domValue, domValue);
    return { status: same ? 'success' : 'planned', reason: same ? 'preexisting_same_value' : 'ready',
      value: target, modelValue: target, labels, domValue };
  }
  async function check(ctx) {
    if (ctx?.allowWrite !== true || typeof ctx?.check !== 'function') throw new Error('shadow_mode');
    if (document.visibilityState !== 'visible') throw new Error('fill_interrupted_page_hidden');
    await ctx.check();
  }
  function clickAllowed(node) {
    if (!node?.isConnected || node.ownerDocument !== document || node.disabled || node.matches?.(':disabled') || node.closest?.('[aria-disabled="true"],[inert],[hidden],[aria-hidden="true"]')) return false;
    if (node.getRootNode?.() !== document) return false;
    for (let parent = node; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    }
    const action = node.closest?.('button,a,[role="button"],input[type="button"],input[type="submit"],input[type="image"]');
    if (action) {
      const text = norm(action.textContent || action.value || action.getAttribute('aria-label'));
      if (/(保存|提交|下一步|投递|删除|申请|确认提交|save|submit|next|apply|delete)/iu.test(text)) return false;
      if (action.matches('a[href],input[type="submit"],input[type="image"]')) return false;
      if (action.tagName === 'BUTTON' && action.type === 'submit') return false;
    }
    return !manualReason(node);
  }
  async function safeClick(node, ctx) {
    await check(ctx);
    if (!clickAllowed(node)) throw new Error('forbidden_click');
    for (const type of ['pointerdown', 'mousedown']) {
      await check(ctx);
      if (!clickAllowed(node)) throw new Error('forbidden_click');
      const EventType = type === 'pointerdown' ? (globalThis.PointerEvent || MouseEvent) : MouseEvent;
      node.dispatchEvent(new EventType(type, { bubbles: true, cancelable: true, button: 0 }));
    }
    await check(ctx); node.focus?.();
    await check(ctx); if (!clickAllowed(node)) throw new Error('forbidden_click');
    node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }));
    await check(ctx); if (!clickAllowed(node)) throw new Error('forbidden_click');
    node.click();
    await tick();
  }
  async function nativeSet(node, value, ctx, events = ['input', 'change', 'blur']) {
    await check(ctx);
    if (!node?.isConnected || !clickAllowed(node) || node.readOnly || node.getAttribute('aria-readonly') === 'true' || !node.matches('input,textarea,select') || node.type === 'file') throw new Error('control_not_writable');
    const prototype = node.tagName === 'SELECT' ? HTMLSelectElement.prototype : node.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (!setter) throw new Error('native_setter_missing');
    setter.call(node, value);
    for (const type of events) { await check(ctx); node.dispatchEvent(new Event(type, { bubbles: true })); }
    await tick();
  }
  function confirmSearchOption(instruction, model, option) {
    // Resolve a deferred code only from this widget's observed options after
    // its exact option was clicked. A typed query grants no readback authority.
    const search = searchSelections.get(instruction);
    if (!search || instruction.type !== 'select-search' || selectBindings.get(instruction) !== model.controlRoot
      || !equal(search.domValue, option?.label) || option.disabled
      || !search.deferred && !choiceEqual(search.value, option.value)
      || option.valueSupported === false || !model.options?.includes(option)) throw Error('option_unconfirmed');
    const hits = model.options.filter(item => !item.disabled && equal(item.label, option.label));
    if (hits.length !== 1) throw Error('option_ambiguous');
    search.selection = { value: option.value, domValue: option.label };
  }
  function clean(value, depth = 0) {
    if (depth > 8) return null;
    if (value == null || ['string', 'number', 'boolean'].includes(typeof value)) return value ?? null;
    if (Array.isArray(value)) return value.slice(0, 1000).map(v => clean(v, depth + 1));
    if (typeof value !== 'object' || value.nodeType || value instanceof Map) return null;
    const out = {};
    for (const [key, val] of Object.entries(value)) if (!['controlRoot', 'vm', 'props'].includes(key) && typeof val !== 'function') out[key] = clean(val, depth + 1);
    if (selectBindings.has(value)) selectBindings.set(out, selectBindings.get(value));
    if (choiceBindings.has(value)) choiceBindings.set(out, choiceBindings.get(value));
    if (searchSelections.has(value)) searchSelections.set(out, searchSelections.get(value));
    return out;
  }
  function createAdapter(spec) {
    const readModel = spec.readModel || ((el, probe) => ({ ...probe }));
    const multiline = ['textarea', 'richtext'].includes(spec.type);
    const boundControl = multiline || ['select', 'select-search', 'cascader', 'radio', 'checkbox', 'checkbox-group', 'switch'].includes(spec.type);
    const choice = ['radio', 'checkbox', 'checkbox-group', 'switch'].includes(spec.type);
    const ownerBound = multiline || choice || spec.type === 'select-search';
    const valueEqual = multiline ? proseEqual : ownerBound ? choiceEqual : equal;
    const domEqual = multiline ? proseEqual : equal;
    const validInstruction = instruction => ['planned', 'success'].includes(instruction?.status) && instruction.adapter === spec.name
      && (!multiline || instruction.type === spec.type && proseEqual(instruction.value, instruction.modelValue)
        && proseEqual(instruction.value, instruction.domValue));
    const sameOwner = (el, instruction, model) => {
      if (!ownerBound) return true;
      const owner = choiceBindings.get(instruction), ref = globalThis.ResumeControlModel.resolve(el);
      return !!owner && owner.root === model.controlRoot && owner.vm === ref.vm && owner.version === model.version
        && (!multiline || owner.framework === ref.framework && owner.componentType === ref.componentType);
    };
    const adapter = { ...spec,
      libVersionProbe: spec.libVersionProbe || ((el, probe = globalThis.ResumeControlModel.inspect(el)) =>
        probe.lib === spec.lib && probe.version ? { lib: probe.lib, version: probe.version } : null),
      readModel(el, probe = globalThis.ResumeControlModel.inspect(el)) { return readModel(el, probe); },
      readOptions(el, probe) { return spec.readOptions ? spec.readOptions(el, probe) : adapter.readModel(el, probe).options || []; },
      plan(fact, model, ctx) {
        const plan = { adapter: spec.name, lib: spec.lib, type: spec.type,
          ...(spec.plan ? spec.plan(fact, model, ctx) : makePlan(fact, model, { type: spec.type })),
          ...(multiline ? { writeStarted: false, liveSupportClaimed: false } : {}) };
        if (boundControl && model.controlRoot) selectBindings.set(plan, model.controlRoot);
        if (ownerBound && model.controlRoot) {
          const ref = globalThis.ResumeControlModel.resolve(model.controlRoot);
          choiceBindings.set(plan, { root: model.controlRoot, vm: ref.vm, framework: ref.framework,
            componentType: ref.componentType, version: model.version });
        }
        if (spec.type === 'select-search') searchSelections.set(plan, {
          required: !!(plan.requiresOptionResolution || plan.requiresOptionClick), deferred: !!plan.requiresOptionResolution,
          value: plan.modelValue ?? plan.value, domValue: plan.domValue ?? plan.value, selection: null });
        return plan;
      },
      async write(el, instruction, ctx) {
        if (ctx?.allowWrite !== true || typeof ctx?.check !== 'function') return { status: 'unsupported', reason: 'shadow_mode', strategy: 'none', attempts: 0 };
        if (!validInstruction(instruction)) return { status: 'unsupported', reason: 'invalid_instruction', strategy: 'none', attempts: 0 };
        const reason = manualReason(el);
        if (reason) return { status: 'unsupported', reason, strategy: 'none', attempts: 0 };
        await check(ctx);
        if (resolve(el)?.name !== spec.name) return { status: 'unsupported', reason: 'control_or_version_changed', strategy: 'none', attempts: 0 };
        const model = adapter.readModel(el);
        if (boundControl && (!model.controlRoot || selectBindings.get(instruction) !== model.controlRoot || !sameOwner(el, instruction, model))) return { status: 'unsupported', reason: 'control_target_changed', strategy: 'none', attempts: 0 };
        const current = adapter.plan({ value: instruction.value }, model, { modelValue: true });
        if (!['planned', 'success'].includes(current.status)) return { status: 'unsupported', reason: current.reason, strategy: 'none', attempts: 0 };
        if (!valueEqual(current.value, instruction.value) || !domEqual(current.domValue, instruction.domValue)) return { status: 'unsupported', reason: 'instruction_stale', strategy: 'none', attempts: 0 };
        if (current.status === 'success') return { status: 'success', reason: 'preexisting_same_value', strategy: 'none', attempts: 0 };
        if (!spec.performWrite) return { status: 'unsupported', reason: 'writer_unavailable', strategy: 'none', attempts: 0 };
        const ownedCtx = !boundControl ? ctx : { ...ctx, async check() {
          await ctx.check();
          if (resolve(el)?.name !== spec.name) throw Error('control_or_version_changed');
          const live = adapter.readModel(el);
          if (live.controlRoot !== selectBindings.get(instruction) || !sameOwner(el, instruction, live)) throw Error('control_target_changed');
        } };
        return spec.performWrite(el, instruction, ownedCtx);
      },
      async verify(el, instruction, ctx = {}) {
        if (!validInstruction(instruction)) return { status: 'unsupported', reason: 'invalid_instruction' };
        const sample = () => {
          if (!el?.isConnected) return { ok: false, unsupported: true, reason: 'target_detached' };
          const model = adapter.readModel(el);
          if (multiline && (model.disabled || model.readonly)) return { ok: false, unsupported: true, reason: 'control_not_writable' };
          if (boundControl && (resolve(el)?.name !== spec.name || !model.controlRoot
            || selectBindings.get(instruction) !== model.controlRoot || !sameOwner(el, instruction, model))) return { ok: false, unsupported: true, reason: 'control_target_changed' };
          const search = searchSelections.get(instruction), selection = search?.selection;
          const clicked = !search?.required || !!selection;
          return { ok: model.available && clicked && valueEqual(model.value, selection ? selection.value : search ? search.value : instruction.modelValue ?? instruction.value)
              && domEqual(model.domValue, selection ? selection.domValue : search ? search.domValue : instruction.domValue ?? instruction.value),
            unsupported: !model.available, domReadback: clean(model.domValue), modelReadback: clean(model.value) };
        };
        const first = sample();
        if (first.unsupported) return { status: 'unsupported', ...first };
        if (!first.ok) return { status: ctx.previousSuccess ? 'reverted' : 'mismatch', ...first };
        await tick(Math.min(Math.max(ctx.settleMs ?? 60, 0), 1000));
        const second = sample();
        return { status: second.ok ? 'success' : 'reverted', ...second };
      }
    };
    return Object.freeze(adapter);
  }
  function register(spec) {
    const adapter = createAdapter(spec);
    if (!adapter.name || typeof adapter.matches !== 'function') throw new Error('adapter_contract_invalid');
    if (adapters.has(adapter.name)) throw new Error('adapter_duplicate');
    adapters.set(adapter.name, adapter);
    return adapter;
  }
  const ordered = () => [...adapters.values()].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  function findAdapter(el, probe) {
    return ordered().find(adapter => adapter.matches(el, probe) && adapter.libVersionProbe(el, probe)) || null;
  }
  function resolve(el) {
    try {
      if (manualReason(el)) return null;
      return findAdapter(el, globalThis.ResumeControlModel.inspect(el));
    } catch { return null; }
  }
  function plan(el, fact) {
    try {
      const reason = manualReason(el);
      if (reason) return manual(reason);
      const probe = globalThis.ResumeControlModel.inspect(el), adapter = findAdapter(el, probe);
      if (!adapter) return manual('control_or_version_unconfirmed');
      return clean(adapter.plan(fact, adapter.readModel(el, probe)));
    } catch { return manual('component_probe_failed'); }
  }
  function inspect(el) {
    try {
      const reason = manualReason(el);
      if (reason) return { ...manual(reason), adapter: null };
      const probe = globalThis.ResumeControlModel.inspect(el), adapter = findAdapter(el, probe);
      return clean({ ...(!adapter ? manual('control_or_version_unconfirmed') : {}),
        probe, adapter: adapter?.name || null, model: adapter ? adapter.readModel(el, probe) : probe });
    } catch { return { ...manual('component_probe_failed'), adapter: null }; }
  }
  const helpers = Object.freeze({ norm, equal, prose, proseEqual, richtextValue, empty, tick, makePlan, safeClick, nativeSet, confirmSearchOption, check, clickAllowed, clean, validDate });
  globalThis.ResumeControls = Object.freeze({ version: 1, revision: 12, mode: 'shadow', liveSupportClaimed: false,
    register, createAdapter, resolve, inspect, plan, helpers, list: () => ordered().map(a => ({ name: a.name, lib: a.lib, type: a.type, priority: a.priority || 0 })),
    verify: (el, instruction, ctx) => resolve(el)?.verify(el, instruction, ctx) || Promise.resolve({ status: 'unsupported', reason: 'control_or_version_unconfirmed' }) });
})();
