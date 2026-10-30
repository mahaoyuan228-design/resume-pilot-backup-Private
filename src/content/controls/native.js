/* First-party L1 HTML controls. No ATS implementation code is incorporated.
 * Registration is passive; writes require the registry's explicit write gate.
 */
(() => {
  'use strict';
  const api = globalThis.ResumeControls;
  if (!api) throw new Error('control_registry_missing');
  if (api.list?.().some(adapter => adapter.name === 'native-text')) return;
  const { norm, equal, nativeSet, safeClick, tick } = api.helpers;
  const textTypes = new Set(['text', 'email', 'tel', 'url', 'search', 'number']);
  const frameworkClass = /(?:^|\s)(?:el|ant|ivu|ud|phoenix|atsx|am)-[^\s]+/u;
  const complexClass = /(?:^|\s)[^\s]*(?:cascader|picker|select-wrap|plugin-dialog)[^\s]*/u;

  // A class-only or unrecognised framework widget must not become native text.
  // That includes its readonly display input and its hidden search input.
  function plain(el, probe, searchable = false) {
    if (!el || !el.matches?.('input,textarea,select')) return false;
    if (probe?.lib && probe.lib !== 'native') return false;
    if (probe?.framework && probe.framework !== 'native') return false;
    for (let node = el; node && node !== document.body; node = node.parentElement) {
      const classes = typeof node.className === 'string' ? node.className : '';
      if (frameworkClass.test(classes) || complexClass.test(classes)) return false;
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
    matches: (el, probe) => plain(el, probe) && el.tagName === 'INPUT' && textTypes.has(el.type),
    readModel: (el, probe) => base(el, probe, el.value),
    async performWrite(el, instruction, ctx) {
      const reason = guards(el);
      if (reason) return noWrite(reason);
      const value = String(targetValue(instruction) ?? '');
      if (el.value && !equal(el.value, value)) return noWrite('existing_value');
      if (equal(el.value, value)) return { strategy: 'native', attempts: 0 };
      await nativeSet(el, value, ctx);
      await tick();
      return { strategy: 'native', attempts: 1 };
    }
  });
  register({ name: 'native-textarea', type: 'textarea',
    matches: (el, probe) => plain(el, probe) && el.tagName === 'TEXTAREA',
    readModel: (el, probe) => base(el, probe, el.value),
    async performWrite(el, instruction, ctx) {
      const reason = guards(el);
      if (reason) return noWrite(reason);
      const value = String(targetValue(instruction) ?? '');
      if (el.value && !equal(el.value, value)) return noWrite('existing_value');
      if (equal(el.value, value)) return { strategy: 'native', attempts: 0 };
      await nativeSet(el, value, ctx);
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
  for (const type of ['checkbox', 'switch']) register({ name: `native-${type}`, type,
    matches: (el, probe) => plain(el, probe) && el.tagName === 'INPUT' && el.type === 'checkbox'
      && (el.getAttribute('role') === 'switch') === (type === 'switch'),
    readModel: (el, probe) => base(el, probe, !!el.checked),
    async performWrite(el, instruction, ctx) {
      const reason = guards(el);
      if (reason) return noWrite(reason);
      const value = targetValue(instruction);
      if (typeof value !== 'boolean') return noWrite(`invalid_${type}_value`);
      if (el.checked && !value) return noWrite('existing_value');
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
