// First-party ordered L1 registry. Shadow inspection only calls plan/read.
// The separate default-OFF write bridge supplies an explicit per-effect guard.
// No implementation source from the ATS research repos is used.
(() => {
  'use strict';
  // Rebuild old registries so reinjection installs current select readback
  // contracts as well as the current model resolver.
  if (globalThis.ResumeControls?.version === 1 && globalThis.ResumeControls.revision === 7) return;
  const adapters = new Map();
  const norm = value => String(value ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
  const equal = (a, b) => Array.isArray(a) || Array.isArray(b)
    ? Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => equal(v, b[i]))
    : typeof a === 'boolean' || typeof b === 'boolean' ? a === b : norm(a) === norm(b);
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
      let options = model.options || [], path = [], pathLabels = [];
      for (const part of value) {
        const hits = options.filter(o => !o.disabled && (equal(o.value, part) || equal(o.label, part)));
        if (hits.length !== 1) return { status: 'unsupported', reason: model.lazy ? 'lazy_options_pending' : 'path_unconfirmed' };
        if (hits[0].valueSupported === false) return { status: 'unsupported', reason: 'option_value_unavailable' };
        path.push(hits[0].value); pathLabels.push(hits[0].label); options = hits[0].children || [];
      }
      target = path; labels = pathLabels; domValue = pathLabels;
    }
    // A checkbox group only adds; every other control preserves existing data.
    if (type === 'checkbox' && typeof target === 'boolean' && typeof model.value === 'boolean') {
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
  async function nativeSet(node, value, ctx) {
    await check(ctx);
    if (!node?.isConnected || !clickAllowed(node) || node.readOnly || node.getAttribute('aria-readonly') === 'true' || !node.matches('input,textarea,select') || node.type === 'file') throw new Error('control_not_writable');
    const prototype = node.tagName === 'SELECT' ? HTMLSelectElement.prototype : node.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (!setter) throw new Error('native_setter_missing');
    setter.call(node, value);
    for (const type of ['input', 'change', 'blur']) { await check(ctx); node.dispatchEvent(new Event(type, { bubbles: true })); }
    await tick();
  }
  function clean(value, depth = 0) {
    if (depth > 8) return null;
    if (value == null || ['string', 'number', 'boolean'].includes(typeof value)) return value ?? null;
    if (Array.isArray(value)) return value.slice(0, 1000).map(v => clean(v, depth + 1));
    if (typeof value !== 'object' || value.nodeType || value instanceof Map) return null;
    const out = {};
    for (const [key, val] of Object.entries(value)) if (!['controlRoot', 'vm', 'props'].includes(key) && typeof val !== 'function') out[key] = clean(val, depth + 1);
    return out;
  }
  function createAdapter(spec) {
    const readModel = spec.readModel || ((el, probe) => ({ ...probe }));
    const adapter = { ...spec,
      libVersionProbe: spec.libVersionProbe || ((el, probe = globalThis.ResumeControlModel.inspect(el)) =>
        probe.lib === spec.lib && probe.version ? { lib: probe.lib, version: probe.version } : null),
      readModel(el, probe = globalThis.ResumeControlModel.inspect(el)) { return readModel(el, probe); },
      readOptions(el, probe) { return spec.readOptions ? spec.readOptions(el, probe) : adapter.readModel(el, probe).options || []; },
      plan(fact, model, ctx) { return { adapter: spec.name, lib: spec.lib, type: spec.type,
        ...(spec.plan ? spec.plan(fact, model, ctx) : makePlan(fact, model, { type: spec.type })) }; },
      async write(el, instruction, ctx) {
        if (ctx?.allowWrite !== true || typeof ctx?.check !== 'function') return { status: 'unsupported', reason: 'shadow_mode', strategy: 'none', attempts: 0 };
        if (!['planned', 'success'].includes(instruction?.status) || instruction.adapter !== spec.name) return { status: 'unsupported', reason: 'invalid_instruction', strategy: 'none', attempts: 0 };
        const reason = manualReason(el);
        if (reason) return { status: 'unsupported', reason, strategy: 'none', attempts: 0 };
        await check(ctx);
        if (resolve(el)?.name !== spec.name) return { status: 'unsupported', reason: 'control_or_version_changed', strategy: 'none', attempts: 0 };
        const model = adapter.readModel(el);
        const current = adapter.plan({ value: instruction.value }, model);
        if (!['planned', 'success'].includes(current.status)) return { status: 'unsupported', reason: current.reason, strategy: 'none', attempts: 0 };
        if (!equal(current.value, instruction.value) || !equal(current.domValue, instruction.domValue)) return { status: 'unsupported', reason: 'instruction_stale', strategy: 'none', attempts: 0 };
        if (current.status === 'success') return { status: 'success', reason: 'preexisting_same_value', strategy: 'none', attempts: 0 };
        if (!spec.performWrite) return { status: 'unsupported', reason: 'writer_unavailable', strategy: 'none', attempts: 0 };
        return spec.performWrite(el, instruction, ctx);
      },
      async verify(el, instruction, ctx = {}) {
        if (instruction?.adapter !== spec.name || !['planned', 'success'].includes(instruction.status)) return { status: 'unsupported', reason: 'invalid_instruction' };
        const sample = () => {
          if (!el?.isConnected) return { ok: false, unsupported: true, reason: 'target_detached' };
          const model = adapter.readModel(el);
          return { ok: model.available && equal(model.value, instruction.modelValue ?? instruction.value) && equal(model.domValue, instruction.domValue ?? instruction.value),
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
  const helpers = Object.freeze({ norm, equal, empty, tick, makePlan, safeClick, nativeSet, check, clickAllowed, clean, validDate });
  globalThis.ResumeControls = Object.freeze({ version: 1, revision: 7, mode: 'shadow', liveSupportClaimed: false,
    register, createAdapter, resolve, inspect, plan, helpers, list: () => ordered().map(a => ({ name: a.name, lib: a.lib, type: a.type, priority: a.priority || 0 })),
    verify: (el, instruction, ctx) => resolve(el)?.verify(el, instruction, ctx) || Promise.resolve({ status: 'unsupported', reason: 'control_or_version_unconfirmed' }) });
})();
