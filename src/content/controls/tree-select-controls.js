// Generic single-node TreeSelect contracts. Values come only from owned public
// component data. Expand ancestors, click the real leaf, then read model + label.
(() => {
  'use strict';
  const R = globalThis.ResumeControls, M = globalThis.ResumeControlModel;
  if (!R || !M) throw Error('control_registry_missing');
  if (R.list().some(adapter => adapter.name === 'antdv1-tree-select')) return;
  const H = R.helpers, n = H.norm, all = (root, selector) => root ? [...root.querySelectorAll(selector)] : [];
  const flags = { writeStarted: false, liveSupportClaimed: false };
  const manual = reason => ({ status: 'manual', reason, ...flags });
  const stop = (reason, attempts = 0) => ({ status: 'unsupported', reason, strategy: attempts ? 'ui' : 'none', attempts,
    ...flags, writeStarted: attempts > 0 });
  const primitive = value => typeof value === 'string' && !!n(value) || typeof value === 'number' && Number.isFinite(value);
  const empty = value => value == null || value === '';
  const same = (a, b) => typeof a === typeof b && a === b;
  const shown = node => !!node?.isConnected && !!node.getClientRects().length && !node.closest('label') && H.clickAllowed(node);
  const panelSelector = '.ant-select-tree-dropdown,.el-select-dropdown';
  const panels = () => all(document, panelSelector).filter(shown);
  const name3 = vm => vm?.type?.name || vm?.type?.__name;
  function parentOwns(vm, owner, plus) {
    for (let count = 0; vm && count++ < 60; vm = plus ? vm.parent : vm.$parent) if (vm === owner) return true;
    return false;
  }
  function vueChildren(owner, plus) {
    const found = [], queue = [owner], visited = new Set();
    for (let index = 0; index < queue.length && index < 3000; index++) {
      const item = queue[index];
      if (!item || typeof item !== 'object' || visited.has(item)) continue;
      visited.add(item);
      if (!plus) { found.push(item); queue.push(...(item.$children || [])); continue; }
      if (item.type && item.subTree) { found.push(item); queue.push(item.subTree); }
      if (item.component) queue.push(item.component);
      if (Array.isArray(item.children)) queue.push(...item.children);
      if (Array.isArray(item.dynamicChildren)) queue.push(...item.dynamicChildren);
      if (item.ssContent) queue.push(item.ssContent);
    }
    return found;
  }
  function ownsRoot(root, el) {
    if (!root?.matches?.('.el-select,.ant-select') || root.ownerDocument !== document || !root.isConnected
      || root !== el && !root.contains(el)) return false;
    return all(root, 'input:not([type="hidden"]),textarea,select').every(input => input.matches('input')
      && ['text', 'search'].includes(input.type) && input.closest('.el-select,.ant-select') === root);
  }
  function plusRef(el) {
    for (let node = el, count = 0; node && count++ < 40; node = node.parentElement) {
      for (let vm = node.__vueParentComponent, level = 0; vm && level++ < 60; vm = vm.parent) {
        if (name3(vm) !== 'ElTreeSelect') continue;
        const root = vm.subTree?.el;
        if (ownsRoot(root, el)) return { owner: vm, root, props: vm.props || {}, plus: true, family: 'plus',
          version: globalThis.ElementPlus?.version };
      }
    }
    return null;
  }
  function reference(el) {
    const plus = plusRef(el);
    if (plus) return plus;
    const p = M.inspect(el), ref = M.resolve(el), owner = ref.vm;
    if (p.framework !== 'vue2' || !owner || !ownsRoot(ref.element, el)) return null;
    if (p.componentName === 'ATreeSelect') return { owner, root: ref.element, props: ref.props, family: 'ant', plus: false,
      version: p.version };
    if (p.componentName !== 'ElSelect') return null;
    const trees = vueChildren(owner, false).filter(vm => vm.$options?.name === 'ElTree');
    // A tree dropdown owns a distinct ElTree instance inside this select's popper.
    if (!trees.length) return null;
    return { owner, root: ref.element, props: ref.props, family: 'el', plus: false, version: p.version,
      tree: trees.length === 1 ? trees[0] : null };
  }
  function supported(ref) {
    return ref?.family === 'ant' ? ref.version === '1.7.8' : ref?.family === 'el' ? ref.version === '2.15.14'
      : ref?.family === 'plus' && ref.version === '2.14.7';
  }
  function treeOf(ref) {
    if (ref.family === 'el') return ref.tree;
    const trees = vueChildren(ref.owner, ref.plus).filter(vm => (ref.plus ? name3(vm) === 'ElTree' : vm.$options?.name === 'Tree'));
    return trees.length === 1 ? trees[0] : null;
  }
  function linkedPanel(ref) {
    if (ref.family === 'el') {
      const panel = ref.owner.$refs?.popper?.$el, tree = treeOf(ref);
      return panel?.matches?.('.el-select-dropdown') && tree?.$el && panel.contains(tree.$el) ? panel : null;
    }
    const inputs = ref.family === 'ant' ? [ref.root] : all(ref.root, 'input[role="combobox"]');
    if (inputs.length !== 1) return null;
    const id = inputs[0].getAttribute('aria-controls');
    if (!id || /\s/u.test(id)) return null;
    const linked = all(document, '[id]').filter(node => node.id === id);
    if (linked.length !== 1) return null;
    const panel = linked[0].closest(ref.family === 'ant' ? '.ant-select-tree-dropdown' : '.el-select-dropdown');
    const trees = all(panel, '[role="tree"]');
    if (trees.length !== 1) return null;
    const vm = ref.plus ? trees[0].__vueParentComponent : trees[0].__vue__;
    return parentOwns(vm, ref.owner, ref.plus) ? panel : null;
  }
  function optionsFor(ref) {
    const props = ref.props, treeProps = ref.family === 'el' ? ref.tree?.$props : props;
    const config = treeProps?.props || {}, raw = ref.family === 'ant' ? props.treeData : treeProps?.data;
    const field = ref.family === 'ant' ? { value: 'value', label: 'title', children: 'children', disabled: 'disabled', isLeaf: 'isLeaf' }
      : { value: treeProps?.nodeKey || props.valueKey || 'value', label: config.label || 'label', children: config.children || 'children', disabled: config.disabled || 'disabled', isLeaf: config.isLeaf || 'isLeaf' };
    const unsupported = !Object.values(field).every(key => typeof key === 'string' && key)
      || ref.family === 'ant' && (props.treeDataSimpleMode || props.replaceFields && Object.keys(props.replaceFields).length
        || props.treeNodeLabelProp && props.treeNodeLabelProp !== 'title')
      || ref.family === 'el' && (!ref.tree || !treeProps.nodeKey);
    let valid = !unsupported && Array.isArray(raw) && raw.length > 0, count = 0;
    const visited = new Set();
    const parse = (nodes, parents = [], blocked = false, depth = 0) => {
      if (!Array.isArray(nodes) || depth > 20 || nodes.length > 1000) { valid = false; return []; }
      return nodes.map(node => {
        if (!node || typeof node !== 'object' || visited.has(node) || ++count > 2000) { valid = false; return null; }
        visited.add(node);
        const value = node[field.value], rawLabel = node[field.label], children = node[field.children];
        const label = typeof rawLabel === 'string' || typeof rawLabel === 'number' ? n(rawLabel) : '';
        if (!primitive(value) || !label || children != null && !Array.isArray(children)) valid = false;
        const disabled = blocked || node[field.disabled] === '' || !!node[field.disabled] || node.selectable === false;
        const option = { value, label, disabled, key: node.key, path: [...parents, value], children: [],
          terminal: node[field.isLeaf] !== false && node.isLeaf !== false && node.leaf !== false };
        if (Array.isArray(children) && children.length) option.children = parse(children, option.path, disabled, depth + 1);
        return option;
      }).filter(Boolean);
    };
    const options = valid ? parse(raw) : [];
    const flat = nodes => nodes.flatMap(node => [node, ...flat(node.children)]), list = flat(options);
    // These library versions index some nodes by stringified keys. A numeric
    // code and an identically spelled string cannot identify distinct nodes.
    if (new Set(list.map(node => String(node.value))).size !== list.length) valid = false;
    if (ref.family === 'ant') {
      const keys = list.filter(node => node.key != null).map(node => node.key);
      if (keys.some(key => !primitive(key)) || new Set(keys.map(String)).size !== keys.length) valid = false;
    }
    return { options, list, valid, field, treeProps };
  }
  function modelFor(el) {
    const ref = reference(el);
    if (!ref) return { available: false, reason: 'tree_owner_unconfirmed', controlRoot: el, treeOwners: [], ...flags };
    const { root, props, owner, family } = ref, tree = optionsFor(ref), tp = tree.treeProps || {};
    const value = (family === 'plus' ? props.modelValue : props.value) ?? null;
    let domValue;
    if (family === 'ant') domValue = n(root.querySelector('.ant-select-selection-selected-value')?.textContent);
    else if (family === 'plus') {
      const label = root.querySelector('.el-select__selected-item.el-select__placeholder');
      domValue = label && !label.classList.contains('is-transparent') ? n(label.textContent) : '';
    } else domValue = n(root.querySelector('input')?.value);
    const mode = !!(props.multiple || props.treeCheckable || props.treeCheckStrictly || props.labelInValue || props.loadData
      || props.remote || props.allowCreate || props.lazy || props.load || tp.lazy || tp.load || tp.showCheckbox || props.showCheckbox
      || props.checkStrictly || tp.checkOnClickNode || props.renderContent || tp.renderContent
      || family === 'ant' && owner.$scopedSlots?.title || family === 'el' && ref.tree?.$scopedSlots?.default
      || family === 'plus' && owner.slots?.default);
    const disabled = !!props.disabled || !!root.closest('[disabled],[aria-disabled="true"],[inert]')
      || all(root, 'input').some(input => input.disabled || input.matches(':disabled'));
    const readonly = !!props.readonly || !!root.closest('[aria-readonly="true"]');
    // Clicking a non-interactive descendant of a label can activate its
    // externally associated submit control, independently of the tree widget.
    const unsafeShell = !!root.closest('label,button,a[href],[role="button"]');
    const contract = JSON.stringify([family, ref.version, tree.field, tree.options, mode,
      props.filterable, props.showSearch, props.filterTreeNode, props.treeNodeFilterProp,
      props.treeNodeLabelProp, props.valueKey]);
    return { available: supported(ref) && tree.valid && !mode && !unsafeShell && (empty(value) || primitive(value)),
      reason: !supported(ref) ? 'tree_version_unconfirmed' : mode ? 'tree_mode_unconfirmed'
        : unsafeShell ? 'tree_structure_unconfirmed' : 'tree_data_unconfirmed',
      controlRoot: root, framework: ref.plus ? 'vue3' : 'vue2', version: ref.version, family,
      options: tree.options, value, domValue, disabled, readonly, treeOwners: [owner, ...(family === 'el' ? [ref.tree] : [])],
      treeContract: contract, readbackSource: 'owned_tree_model_and_selected_label', ...flags };
  }
  function plan(fact, model) {
    if (!model.available) return manual(model.reason || 'tree_data_unconfirmed');
    if (model.disabled || model.readonly) return manual(model.disabled ? 'disabled' : 'readonly');
    const requested = fact && typeof fact === 'object' && !Array.isArray(fact) ? fact.value : fact;
    const flat = (nodes, parents = []) => nodes.flatMap(node => [{ ...node, labels: [...parents, node.label] }, ...flat(node.children, [...parents, node.label])]);
    const candidates = flat(model.options);
    let hits;
    if (Array.isArray(requested)) {
      if (!requested.length || !requested.every(primitive)) return manual('explicit_tree_node_required');
      hits = candidates.filter(node => node.path.length === requested.length
        && requested.every((part, index) => same(part, node.path[index]) || typeof part === 'string' && n(part) === node.labels[index]));
    } else {
      if (!primitive(requested)) return manual('explicit_tree_node_required');
      hits = candidates.filter(node => same(requested, node.value) || typeof requested === 'string' && n(requested) === node.label);
    }
    if (hits.length !== 1) return manual(hits.length ? 'tree_node_ambiguous' : 'tree_node_missing');
    const node = hits[0];
    if (node.disabled || node.children.length || !node.terminal) return manual(node.disabled ? 'tree_node_disabled' : 'tree_nonterminal_unconfirmed');
    if (!empty(model.value) && !same(model.value, node.value) || empty(model.value) && !!model.domValue) return manual('existing_value');
    if (!empty(model.value) && model.domValue !== node.label) return manual('tree_readback_mismatch');
    const unchanged = same(model.value, node.value) && model.domValue === node.label;
    return { status: unchanged ? 'success' : 'planned', reason: unchanged ? 'preexisting_same_value' : 'ready',
      value: node.value, modelValue: node.value, domValue: node.label, path: node.path.slice(), labels: node.labels.slice(),
      readbackSource: model.readbackSource, ...flags };
  }
  function treeRoot(ref, panel) {
    const roots = all(panel, '[role="tree"]');
    if (roots.length !== 1) return null;
    const vm = ref.plus ? roots[0].__vueParentComponent : roots[0].__vue__;
    return parentOwns(vm, ref.owner, ref.plus) ? roots[0] : null;
  }
  function rowsIn(container, family) {
    return all(container, '[role="treeitem"]').filter(row => {
      const parent = row.parentElement?.closest('[role="treeitem"]');
      return container.matches('[role="treeitem"]') ? parent === container : !parent;
    });
  }
  function rowInfo(row, ref) {
    let vm = ref.plus ? row.__vueParentComponent : row.__vue__;
    for (let count = 0; vm && count++ < 10; vm = ref.plus ? vm.parent : vm.$parent) {
      const name = ref.plus ? name3(vm) : vm.$options?.name;
      if ((ref.family === 'ant' && name === 'ATreeNode' || ref.family !== 'ant' && name === 'ElTreeNode')
        && parentOwns(vm, ref.owner, ref.plus)) {
        const props = ref.plus ? vm.props : vm.$props;
        const treeProps = ref.family === 'el' ? ref.tree.$props : ref.props;
        const valueKey = treeProps.nodeKey || ref.props.valueKey || 'value';
        return { vm, value: ref.family === 'ant' ? props.value : props.node?.data?.[valueKey],
          disabled: ref.family === 'ant' ? !!props.disabled : !!props.node?.disabled };
      }
    }
    return null;
  }
  function rowLabel(row, family) {
    const content = row.querySelector(family === 'ant' ? '.ant-select-tree-node-content-wrapper' : '.el-tree-node__content');
    const label = content?.querySelector(family === 'ant' ? '.ant-select-tree-title' : '.el-tree-node__label,[role="option"] span');
    return { content, label: n(label?.textContent) };
  }
  async function write(el, instruction, ctx) {
    const start = modelFor(el), initial = reference(el), root = start.controlRoot;
    let panel = null, attempts = 0, selecting = false;
    const stable = async () => {
      await ctx.check();
      const live = modelFor(el), next = reference(el);
      if (!live.available || live.disabled || live.readonly || live.controlRoot !== root || live.treeContract !== start.treeContract
        || !next || next.owner !== initial.owner) throw Error('control_changed');
      if (!(same(live.value, start.value) && live.domValue === start.domValue
        || selecting && same(live.value, instruction.value) && live.domValue === instruction.domValue)) throw Error('control_value_changed');
      const visible = panels();
      if (visible.length > 1 || visible.length === 1 && panel && visible[0] !== panel) throw Error('overlay_ambiguous');
      const completed = selecting && same(live.value, instruction.value) && live.domValue === instruction.domValue;
      if (panel && linkedPanel(next) !== panel && !completed) throw Error('overlay_ownership_unconfirmed');
      if (!panel && visible.length && linkedPanel(next) !== visible[0]) throw Error('overlay_ownership_unconfirmed');
    };
    const guarded = { ...ctx, check: stable };
    if (panels().length) return stop('control_busy');
    await H.safeClick(initial.family === 'ant' ? root.querySelector('.ant-select-selection') : root.querySelector('input[role="combobox"],input'), guarded);
    for (let count = 0; count < 60; count++) {
      await stable();
      const next = reference(el), candidate = linkedPanel(next);
      if (candidate && shown(candidate) && panels().length === 1 && panels()[0] === candidate) { panel = candidate; break; }
      await H.tick(20);
    }
    if (!panel) return stop('tree_panel_unconfirmed');
    const selected = [], ownedTree = treeRoot(reference(el), panel);
    const ownedTreeVm = initial.plus ? ownedTree?.__vueParentComponent : ownedTree?.__vue__;
    const assertRows = () => {
      const ref = reference(el), tree = treeRoot(ref, panel);
      if (!tree || tree !== ownedTree || (ref.plus ? tree.__vueParentComponent : tree.__vue__) !== ownedTreeVm) return false;
      return selected.every((entry, index) => entry.row.isConnected && shown(entry.row)
        && (index ? selected[index - 1].row.contains(entry.row) : tree.contains(entry.row))
        && rowInfo(entry.row, ref)?.vm === entry.vm && same(rowInfo(entry.row, ref)?.value, instruction.path[index])
        && rowLabel(entry.row, ref.family).label === instruction.labels[index]);
    };
    const panelStable = async () => {
      await stable();
      if (!shown(panel) || panels().length !== 1 || panels()[0] !== panel || !assertRows()) throw Error('overlay_tree_changed');
    };
    for (let index = 0; index < instruction.path.length; index++) {
      await panelStable();
      const ref = reference(el), tree = treeRoot(ref, panel), container = index ? selected[index - 1].row : tree;
      const matches = () => rowsIn(container, ref.family).filter(row => {
        const info = rowInfo(row, ref), label = rowLabel(row, ref.family);
        return shown(row) && info && !info.disabled && same(info.value, instruction.path[index]) && label.label === instruction.labels[index];
      });
      const hits = matches();
      if (hits.length !== 1) return stop('tree_node_missing_ambiguous_or_disabled', attempts);
      const row = hits[0], info = rowInfo(row, ref), content = rowLabel(row, ref.family).content;
      selected.push({ row, vm: info.vm });
      const leaf = index === instruction.path.length - 1;
      const expanded = ref.family === 'ant' ? row.classList.contains('ant-select-tree-treenode-switcher-open') : row.getAttribute('aria-expanded') === 'true';
      if (!leaf && expanded) continue;
      const button = leaf ? content : row.querySelector(ref.family === 'ant' ? '.ant-select-tree-switcher' : '.el-tree-node__expand-icon');
      const actionSafe = () => !!button && shown(button)
        && !button.matches('button,a,input,textarea,select,[role="button"],[contenteditable]')
        && !button.querySelector('button,a,input,textarea,select,[role="button"],[contenteditable]');
      if (!actionSafe()) return stop('tree_node_action_unconfirmed', attempts);
      selecting = leaf;
      await H.safeClick(button, { ...ctx, async check() {
        await panelStable();
        if (!actionSafe() || matches().length !== 1 || matches()[0] !== row || !row.contains(button)
          || (leaf ? rowLabel(row, ref.family).content !== button : row.querySelector(ref.family === 'ant' ? '.ant-select-tree-switcher' : '.el-tree-node__expand-icon') !== button)) throw Error('control_tree_node_changed');
      } });
      attempts++;
      if (!leaf) {
        let loaded = false;
        for (let count = 0; count < 60; count++) {
          await panelStable();
          if (rowsIn(row, ref.family).some(shown)) { loaded = true; break; }
          await H.tick(20);
        }
        if (!loaded) return stop('tree_children_unconfirmed', attempts);
      }
    }
    // A typed search query is never a selection. Only this completed leaf click
    // can authorize verification of the public model and visible selected label.
    for (let count = 0; count < 60; count++) {
      await stable();
      const live = modelFor(el);
      if (same(live.value, instruction.value) && live.domValue === instruction.domValue && !shown(panel)) {
        H.confirmTreeNode(instruction, live);
        return { strategy: 'ui', attempts, writeStarted: true, liveSupportClaimed: false };
      }
      await H.tick(20);
    }
    return stop('tree_readback_or_cleanup_unconfirmed', attempts);
  }
  for (const [family, name, lib] of [['ant', 'antdv1-tree-select', 'ant-design-vue'], ['el', 'el-search-tree-select', 'element-ui'], ['plus', 'el-tree-select', 'element-plus']]) {
    R.register({ name, lib, type: 'tree-select', priority: 800,
      matches(el) { return reference(el)?.family === family; },
      // Keep the whole recognized tree family reserved even when its version or
      // mode is unreviewed; a nested plain Select must not borrow its model.
      libVersionProbe(el) { const ref = reference(el); return ref?.family === family ? { lib, version: ref.version || null, reviewed: supported(ref) } : null; },
      readModel: modelFor, plan, performWrite: write });
  }
})();
