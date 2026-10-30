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
  function plain(el, probe) {
    if (!el || !el.matches?.('input,textarea,select')) return false;
    if (probe?.lib && probe.lib !== 'native') return false;
    if (probe?.framework && probe.framework !== 'native') return false;
    for (let node = el; node && node !== document.body; node = node.parentElement) {
      const classes = typeof node.className === 'string' ? node.className : '';
      if (frameworkClass.test(classes) || complexClass.test(classes)) return false;
      if (node !== el && node.matches?.('[role="combobox"],[role="listbox"],[role="tree"]')) return false;
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
  function radios(el) {
    if (!el.name) return [el];
    const scope = el.form || el.getRootNode();
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
    readModel(el, probe) {
      const option = el.selectedOptions[0];
      return base(el, probe, el.value, option ? norm(option.textContent) : '',
        [...el.options].map(node => ({ value: node.value, label: norm(node.textContent),
          disabled: node.disabled || !!node.closest('optgroup[disabled]') })));
    },
    async performWrite(el, instruction, ctx) {
      const reason = guards(el);
      if (reason) return noWrite(reason);
      const value = String(targetValue(instruction) ?? '');
      const options = [...el.options].filter(node => node.value === value && !node.disabled && !node.closest('optgroup[disabled]'));
      if (options.length !== 1) return noWrite(options.length ? 'ambiguous_option' : 'option_missing');
      if (el.value && !equal(el.value, value)) return noWrite('existing_value');
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
      const value = String(targetValue(instruction) ?? '');
      const group = radios(el), selected = group.filter(node => node.checked);
      const targets = group.filter(node => node.value === value && !disabled(node));
      if (targets.length !== 1) return noWrite(targets.length ? 'ambiguous_option' : 'option_missing');
      if (selected.length > 1) return noWrite('ambiguous_radio_group');
      if (selected.length && selected[0] !== targets[0]) return noWrite('existing_value');
      if (targets[0].checked) return { strategy: 'ui', attempts: 0 };
      if (!targets[0].isConnected) return noWrite('target_detached');
      await safeClick(targets[0], ctx);
      await tick();
      return { strategy: 'ui', attempts: 1 };
    }
  });
  register({ name: 'native-checkbox', type: 'checkbox',
    matches: (el, probe) => plain(el, probe) && el.tagName === 'INPUT' && el.type === 'checkbox',
    readModel: (el, probe) => base(el, probe, !!el.checked),
    async performWrite(el, instruction, ctx) {
      const reason = guards(el);
      if (reason) return noWrite(reason);
      const value = targetValue(instruction);
      if (typeof value !== 'boolean') return noWrite('invalid_checkbox_value');
      if (el.checked && !value) return noWrite('existing_value');
      if (el.checked === value) return { strategy: 'ui', attempts: 0 };
      await safeClick(el, ctx);
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
