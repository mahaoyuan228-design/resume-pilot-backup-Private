// First-party L1 component inspection. Load in MAIN; never transfer framework
// instances or handlers to the extension. No events, setters or network calls.
(() => {
  'use strict';
  if (globalThis.ResumeControlModel?.version === 1 && globalThis.ResumeControlModel.revision === 9) return;
  const norm = value => String(value ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
  function serial(value, depth = 0) {
    if (value == null || ['string', 'number', 'boolean'].includes(typeof value)) return value ?? null;
    if (depth > 6) return null;
    if (value instanceof Date) return Number.isNaN(+value) ? null : value.toISOString();
    if (typeof value?.format === 'function' && value?._isAMomentObject) return value.format('YYYY-MM-DD');
    if (Array.isArray(value)) return value.slice(0, 1000).map(v => serial(v, depth + 1));
    return null;
  }
  function readableValue(value, depth = 0) {
    if (value == null || ['string', 'boolean'].includes(typeof value)) return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (depth > 6) return false;
    if (value instanceof Date) return !Number.isNaN(+value);
    if (value?._isAMomentObject && typeof value.format === 'function') return true;
    return Array.isArray(value) && value.length <= 1000 && value.every(part => readableValue(part, depth + 1));
  }
  const optionValueSupported = value => value === null || ['string', 'boolean'].includes(typeof value)
    || typeof value === 'number' && Number.isFinite(value);
  function optionsOf(raw, depth = 0, cascader = null) {
    if (!Array.isArray(raw) || depth > 6) return [];
    return raw.slice(0, 1000).map(option => {
      const props = option?.componentOptions?.propsData || option?.props || option;
      if (props == null || typeof props !== 'object') return { value: serial(props), label: norm(props), disabled: false,
        valueSupported: optionValueSupported(props) };
      const slot = option?.componentOptions?.children || option?.children;
      const slotText = Array.isArray(slot) ? slot.map(child => child?.text || '').join('') : '';
      // Vue option instances proxy declared props from their prototype. A
      // readable inherited value is evidence too; undefined may use VNode key.
      const optionValue = props.value;
      const rawValue = optionValue !== undefined ? optionValue : props.key;
      return { value: serial(rawValue), valueSupported: optionValueSupported(rawValue), label: norm(props.label ?? props.title ?? (slotText || props.value)),
        disabled: props.disabled === '' || !!props.disabled, children: optionsOf(props.children, depth + 1, cascader),
        leaf: !(Array.isArray(props.children) && props.children.length)
          && (cascader?.element ? cascader.lazy ? props.leaf === true : !Array.isArray(props.children) : props.isLeaf !== false) };
    });
  }
  function modelValue(value, valueFormat) {
    if (Array.isArray(value)) return value.map(part => modelValue(part, valueFormat));
    const format = { 'YYYY-MM': 'YYYY-MM', 'yyyy-MM': 'YYYY-MM', 'YYYY-MM-DD': 'YYYY-MM-DD', 'yyyy-MM-dd': 'YYYY-MM-DD' }[valueFormat];
    if (format && value?._isAMomentObject && typeof value.format === 'function') return value.format(format);
    if (format && value instanceof Date && !Number.isNaN(+value)) {
      const date = [String(value.getFullYear()).padStart(4, '0'), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')];
      return date.slice(0, format === 'YYYY-MM' ? 2 : 3).join('-');
    }
    return serial(value);
  }
  const knownVue = /^(El(Input|Autocomplete|Select|Option|Radio(Group)?|Checkbox(Group)?|Switch|DatePicker|Cascader)|A(Input|Textarea|AutoComplete|Select|Radio(Group)?|Checkbox(Group)?|Switch|DatePicker|MonthPicker|Cascader)|iSelect|CalendarPicker)$/u;
  const knownReact = /^(Ud|Phoenix)(Select|DatePicker|Cascader)$/u;
  const valueControls = root => root?.nodeType === 1 ? [
    ...(root.matches('input:not([type="hidden"]),textarea,select') ? [root] : []),
    ...root.querySelectorAll('input:not([type="hidden"]),textarea,select')
  ] : [];
  // Model values belong to a control, never to a surrounding form. In
  // particular, a parent React/Forms component can have a value prop for a
  // different child. Containment alone does not prove that value's ownership.
  function ownsControl(root, el, multiple = false) {
    if (root?.nodeType !== 1 || root.ownerDocument !== el.ownerDocument) return false;
    if (root !== el && !root.contains(el) && !el.contains(root)) return false;
    const owned = valueControls(root), requested = valueControls(el);
    if (!multiple && owned.length > 1) return false;
    if (el !== root && el.contains(root)
      && (requested.length !== owned.length || requested.some(control => !owned.includes(control)))) return false;
    return true;
  }
  function ownsSelect(root, el, name) {
    const selector = { ElSelect: '.el-select', ASelect: '.ant-select', iSelect: '.ivu-select',
      ElAutocomplete: '.el-autocomplete', AAutoComplete: '.ant-select-auto-complete' }[name];
    if (!root?.matches?.(selector) || !ownsControl(root, el, true)) return false;
    // Search/display inputs may share one widget model. A native select or a
    // neighbouring editor in a shared form row cannot borrow that model.
    return valueControls(root).every(input => input.matches('input')
      && ['text', 'search'].includes(input.type)
      && input.closest('.el-select,.ant-select,.ivu-select,.el-autocomplete') === root);
  }
  function ownsCascader(root, el, name) {
    const selector = name === 'ElCascader' ? '.el-cascader' : '.ant-cascader-picker';
    return root?.matches?.(selector) && ownsControl(root, el, true)
      && valueControls(root).every(input => input.matches('input') && ['text', 'search'].includes(input.type)
        && input.closest('.el-cascader,.ant-cascader-picker') === root);
  }
  function fiberRoots(fiber) {
    if (fiber?.stateNode?.nodeType === 1) return [fiber.stateNode];
    const roots = [], queue = fiber?.child ? [fiber.child] : [], seen = new Set();
    for (let i = 0; i < queue.length && i < 200; i++) {
      const item = queue[i];
      if (!item || seen.has(item)) continue;
      seen.add(item);
      if (item.sibling) queue.push(item.sibling);
      if (item.stateNode?.nodeType === 1) roots.push(item.stateNode);
      else if (item.child) queue.push(item.child);
    }
    // Incomplete or cyclic trees are not evidence of an isolated owner.
    return queue.length > 200 ? [] : roots;
  }
  function monthOwner(vm) {
    // Ant's public wrapper and rendered picker share a name/root. Vue can
    // replace root.__vue__ with the inner picker during calendar navigation.
    // The outer wrapper owns the public Moment/string model and stays stable.
    let owner = vm;
    for (let parent = vm.$parent, count = 0; parent && count++ < 20; parent = parent.$parent) {
      if (parent.$el !== vm.$el) break;
      if (parent.$options?.name === 'AMonthPicker') owner = parent;
    }
    const queue = [...(owner.$children || [])];
    let displayFormat;
    for (let i = 0; i < queue.length && i < 40; i++) {
      const child = queue[i];
      if (child.$el !== owner.$el) continue;
      if (child.$options?.name === 'AMonthPicker') { displayFormat = child.$props?.format; break; }
      queue.push(...(child.$children || []));
    }
    return { vm: owner, displayFormat };
  }
  function resolve(el) {
    if (!el || el.nodeType !== 1) return {};
    const seen = new Set();
    let inputFallback, choiceFallback, frameworkFallback, reactValueFallback, reactNamedFallback, vueFallback;
    let autocompleteUnconfirmed = false;
    for (let node = el, count = 0; node && count++ < 40; node = node.parentElement) {
      let vm = node.__vue__;
      for (let level = 0; vm && level++ < 20 && !seen.has(vm); vm = vm.$parent) {
        seen.add(vm);
        const name = vm.$options?.name || vm.$options?._componentTag || '';
        const autoOwner = /autocomplete/iu.test(name) || vm.$el?.matches?.('.el-autocomplete,.ant-select-auto-complete')
          || vm.$parent?.$el === vm.$el && /autocomplete/iu.test(vm.$parent?.$options?.name || '');
        if (autoOwner) autocompleteUnconfirmed = true;
        frameworkFallback ||= { element: el, framework: 'vue2', props: {} };
        const multiple = /(?:Select|DatePicker|MonthPicker|CalendarPicker|Cascader|RadioGroup|CheckboxGroup)$/u.test(name);
        const owns = /^(?:ElSelect|ASelect|iSelect|ElAutocomplete|AAutoComplete)$/u.test(name)
          ? ownsSelect(vm.$el, el, name) : /^(?:ElCascader|ACascader)$/u.test(name)
            ? ownsCascader(vm.$el, el, name) : ownsControl(vm.$el, el, multiple);
        if (knownVue.test(name) && owns) {
          const owner = name === 'AMonthPicker' ? monthOwner(vm) : { vm };
          const found = { ...owner, props: owner.vm.$props || {}, element: owner.vm.$el, componentName: name, framework: 'vue2' };
          // Display/search inputs belong to their Select/DatePicker/Cascader.
          // Keep a plain Input only if no owning complex component is present.
          if (/^(?:ElInput|AInput|ATextarea)$/u.test(name)
            || /^(?:ElSelect|ASelect|iSelect)$/u.test(name) && autoOwner) inputFallback ||= found;
          else if (/^(?:El|A)(?:Radio|Checkbox)$/u.test(name)) choiceFallback ||= found;
          else return found;
        }
        if (!/^(?:ElSelect|ASelect|iSelect|ElAutocomplete|AAutoComplete|ElCascader|ACascader)$/u.test(name) && ownsControl(vm.$el, el)) vueFallback ||= {
          vm, props: vm.$props || {}, element: vm.$el, componentName: name, framework: 'vue2'
        };
      }
      // Vue 3 internals are read for diagnostics only. They cannot be mistaken
      // for the Vue 2 library families supported by this slice.
      const instance = node.__vueParentComponent || node.__vue_app__?._instance;
      if (instance) {
        frameworkFallback ||= { element: el, framework: 'vue3', props: {} };
        const queue = [instance], visited = new Set();
        for (let i = 0; i < queue.length && i < 200; i++) {
          const item = queue[i];
          if (!item || visited.has(item)) continue;
          visited.add(item);
          const root = item.subTree?.el;
          if (ownsControl(root, el)) return { props: item.props || {}, element: root,
            componentName: item.type?.name || '', framework: 'vue3' };
          if (item.subTree?.component) queue.push(item.subTree.component);
          for (const child of item.subTree?.children || []) if (child?.component) queue.push(child.component);
        }
      }
      const fiberKey = Object.keys(node).find(key => key.startsWith('__reactFiber$'));
      let fiber = fiberKey && node[fiberKey];
      if (fiber) frameworkFallback ||= { element: el, framework: 'react', props: {} };
      for (let level = 0; fiber && level++ < 30; fiber = fiber.return) {
        const props = fiber.memoizedProps;
        if (props && (Object.prototype.hasOwnProperty.call(props, 'value') || typeof props.onChange === 'function')) {
          const componentName = fiber.type?.displayName || fiber.type?.name || '';
          const roots = fiberRoots(fiber);
          const root = roots.length === 1 ? roots[0] : null;
          if (!root || !ownsControl(root, el)) continue;
          const found = { props, element: root, framework: 'react', componentName, componentType: fiber.type };
          // A host input's value is not its owning Select/Formily field model.
          // Prefer an explicit reviewed component identity up the same fiber.
          if (knownReact.test(componentName)) return found;
          reactValueFallback ||= found;
          if (componentName) reactNamedFallback ||= found;
        }
      }
    }
    if (autocompleteUnconfirmed) return frameworkFallback || { element: el, framework: 'vue2', props: {} };
    return choiceFallback || inputFallback || vueFallback || reactNamedFallback || reactValueFallback || frameworkFallback
      || { element: el, framework: 'native', props: {} };
  }
  function inspect(el) {
    const ref = resolve(el), { vm, props = {}, componentName = '' } = ref;
    let lib = null, version = null;
    if (ref.framework === 'vue2' && /^El/u.test(componentName)) {
      lib = 'element-ui';
      // A component name alone cannot distinguish a compatible version.
      version = typeof globalThis.ELEMENT?.version === 'string' ? globalThis.ELEMENT.version : null;
    } else if (ref.framework === 'vue2' && /^A/u.test(componentName)) {
      lib = 'ant-design-vue';
      version = typeof globalThis.antd?.version === 'string' ? globalThis.antd.version : null;
    } else if (ref.framework === 'vue2' && /^(iSelect|CalendarPicker)$/u.test(componentName)) {
      lib = 'iview';
      version = typeof globalThis.iview?.version === 'string' && !globalThis.ViewUI
        ? globalThis.iview.version : null;
    } else if (ref.framework === 'react' && knownReact.test(componentName)) {
      const expected = componentName.startsWith('Ud') ? 'ud' : 'phoenix';
      const exported = expected === 'ud' ? globalThis.UD : globalThis.Phoenix;
      const identity = ref.componentType?.library;
      lib = expected;
      // Component-owned and page-export version evidence must agree. The
      // adapters additionally require an explicit reviewed contract version.
      version = identity?.name === expected && typeof identity.version === 'string'
        && identity.version === exported?.version ? identity.version : null;
    }
    const root = ref.element || el;
    const checkedModel = /^(?:ACheckbox|ASwitch|ARadio)$/u.test(componentName);
    const valueKey = checkedModel && Object.prototype.hasOwnProperty.call(props, 'checked') ? 'checked'
      : checkedModel ? null : Object.prototype.hasOwnProperty.call(props, 'value') ? 'value'
      : Object.prototype.hasOwnProperty.call(props, 'modelValue') ? 'modelValue' : null;
    let rawOptions = props.options;
    if (!Array.isArray(rawOptions) && componentName === 'ElSelect') rawOptions = vm?.options;
    if (!Array.isArray(rawOptions) && componentName === 'ASelect') rawOptions = vm?.$slots?.default;
    if (componentName === 'ElAutocomplete') rawOptions = (vm?.suggestions || []).map(option => ({
      value: option?.[props.valueKey || 'value'], label: option?.[props.valueKey || 'value'] }));
    if (componentName === 'AAutoComplete') rawOptions = Array.isArray(props.dataSource)
      ? props.dataSource.map(option => typeof option === 'string' ? option : { value: option?.value, label: option?.text })
      : vm?.$slots?.dataSource;
    if (!Array.isArray(rawOptions) && componentName === 'iSelect') rawOptions = vm?.$slots?.default;
    // Ant v1 MonthPicker's public model defaults to Moment and its display to
    // YYYY-MM. The day serializer would erase the control's month precision.
    // Apply that default only after confirming this owning component/library.
    const antMonth = ref.framework === 'vue2' && lib === 'ant-design-vue'
      && Number(version?.split('.')[0]) === 1 && componentName === 'AMonthPicker';
    const defaultMonthFormat = antMonth && props.valueFormat == null;
    const rawValue = valueKey ? props[valueKey] : null;
    const momentMonth = defaultMonthFormat && rawValue?._isAMomentObject === true && typeof rawValue.format === 'function'
      && typeof rawValue.isValid === 'function' && rawValue.isValid();
    const monthModelConfirmed = !antMonth || rawValue == null || rawValue === ''
      || (defaultMonthFormat ? momentMonth : typeof rawValue === 'string' && /^\d{4}-\d{2}$/u.test(rawValue));
    const valueFormat = lib === 'iview' && componentName === 'CalendarPicker' ? props.format
      : defaultMonthFormat ? 'YYYY-MM' : props.valueFormat;
    const value = valueKey ? modelValue(props[valueKey], valueFormat) : null;
    const input = root?.matches?.('input,textarea,select') ? root : root?.querySelector?.('input,textarea,select');
    const cascader = /^(?:ElCascader|ACascader)$/u.test(componentName);
    const lazy = !!(props.lazy || props.loadData || props.props?.lazy);
    const config = componentName === 'ElCascader' ? props.props || {} : props.fieldNames || {};
    const customFields = ['value', 'label', 'children', 'disabled', 'leaf'].some(key => config[key] != null && config[key] !== key);
    return { framework: ref.framework || 'native', lib, version, major: version ? Number(version.split('.')[0]) : null,
      componentName, available: !!valueKey && readableValue(props[valueKey]) && monthModelConfirmed, value,
      options: optionsOf(rawOptions, 0, cascader ? { element: componentName === 'ElCascader', lazy } : null), valueFormat: valueFormat || null,
      format: antMonth ? ref.displayFormat ?? props.format ?? 'YYYY-MM' : props.format || null,
      ...(antMonth ? { valueFormatEvidence: defaultMonthFormat ? 'component_default' : 'explicit_prop',
        modelKind: defaultMonthFormat ? 'moment' : 'formatted',
        modelReason: monthModelConfirmed ? null : 'month_model_unconfirmed' } : {}),
      ...(/^(?:El|A)(?:Radio|Checkbox|Switch)$/u.test(componentName) ? {
        optionValue: serial(componentName === 'ElRadio' ? props.label : props.value),
        optionValueSupported: optionValueSupported(componentName === 'ElRadio' ? props.label : props.value),
        checkedValue: serial(componentName === 'ElSwitch' ? props.activeValue ?? true
          : componentName === 'ElCheckbox' ? props.trueLabel ?? true : true),
        uncheckedValue: serial(componentName === 'ElSwitch' ? props.inactiveValue ?? false
          : componentName === 'ElCheckbox' ? props.falseLabel ?? false : false),
        choiceValuesSupported: [componentName === 'ElSwitch' ? props.activeValue ?? true
          : componentName === 'ElCheckbox' ? props.trueLabel ?? true : true,
        componentName === 'ElSwitch' ? props.inactiveValue ?? false
          : componentName === 'ElCheckbox' ? props.falseLabel ?? false : false].every(optionValueSupported)
      } : {}),
      type: props.type || null, filterable: !!(props.filterable || props.showSearch || /Autocomplete|AutoComplete/u.test(componentName)),
      remote: !!(props.remote || (props.showSearch && props.filterOption === false)),
      lazy, disabled: !!(props.disabled || vm?.disabled || input?.disabled),
      readonly: !!props.readonly, controlRoot: root,
      multiple: !!props.multiple || ['multiple', 'tags'].includes(props.mode), separator: typeof props.separator === 'string' ? props.separator : null,
      ...(/^(?:ElSelect|ASelect)$/u.test(componentName) ? {
        creatable: props.mode === 'tags' || !!(props.allowCreate && props.filterable),
        multiUnsupported: !!(props.labelInValue || props.collapseTags || props.maxTagCount != null || props.tokenSeparators?.length),
        multipleLimit: props.multipleLimit || 0
      } : {}),
      ...(cascader ? { separator: componentName === 'ElCascader' ? props.separator ?? ' / ' : ' / ',
        showAllLevels: props.showAllLevels !== false,
        cascaderUnsupported: !!(props.multiple || config.multiple || config.emitPath === false || config.checkStrictly
          || props.changeOnSelect || props.expandTrigger === 'hover' || config.expandTrigger === 'hover'
          || props.displayRender || vm?.$scopedSlots?.displayRender || vm?.$scopedSlots?.default || customFields) } : {}),
      versionEvidence: version ? 'page_library_export' : 'version_unconfirmed' };
  }
  globalThis.ResumeControlModel = Object.freeze({ version: 1, revision: 9, inspect, resolve, serial, optionsOf });
})();
