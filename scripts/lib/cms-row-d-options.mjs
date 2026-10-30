/**
 * Offline row D dictionaries and a read-only DOM ownership contract.
 *
 * This is not a fill adapter. It never opens a control, emits an event, reads
 * selected values, or grants mutation permission. The harvest contains option
 * samples rather than a complete live DOM. A passing structural check cannot
 * turn those samples into independent evidence or a live-support claim.
 */
export const ROW_D_BASE_TIP = 'ef771fc02415a9249bfe86dd9d20afca7f6c130d';
export const ROW_D_HARVEST = 'cms-row-d-open-harvest-2026-10-24-1445';
export const ROW_D_PAGE = 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';

const SAFETY = Object.freeze({
  neverSave: true,
  liveSupportClaimed: false,
  livePassClaimed: false,
  writeStarted: false,
  mutationAllowed: false,
  valuesExposed: false,
  probeOnly: true
});

// dormant-options.json records optionCount=30 but serializes only the first
// 25 labels. The remaining five labels must not be inferred from geography.
const LOCATION_SAMPLE = Object.freeze([
  '北京', '上海', '广东', '广西', '江苏', '湖北', '安徽', '山东', '陕西',
  '宁夏', '甘肃', '新疆', '福建', '浙江', '湖南', '四川', '重庆', '云南',
  '江西', '河南', '河北', '天津', '山西', '辽宁', '吉林'
]);
const WORK_NATURE = Object.freeze(['全职', '实习']);
const EXAM_RESULT = Object.freeze(['通过', '未通过']);

export const ROW_D_FIELDS = Object.freeze([
  {
    key: 'expectedWorkNature', label: '期望工作性质*', wrapperId: '13_43_0', sectionId: '13',
    controlKind: 'ant-select', options: WORK_NATURE, harvestedOptionCount: 2,
    optionsComplete: true, evidenceSource: 'dormant_no_click'
  },
  {
    key: 'firstWorkLocation', label: '意向一：期望工作地点*', wrapperId: '13_100701_0', sectionId: '13',
    controlKind: 'ant-select', options: LOCATION_SAMPLE, harvestedOptionCount: 30,
    optionsComplete: false, evidenceSource: 'dormant_no_click',
    // Earlier location opens were observed to POST /resume/info/edit. This
    // module has no operation capable of opening or blurring the control.
    openMayAutosave: true
  },
  {
    key: 'secondWorkLocation', label: '意向二：期望工作地点*', wrapperId: '13_100702_0', sectionId: '13',
    controlKind: 'ant-select', options: LOCATION_SAMPLE, harvestedOptionCount: 0, dictionaryOptionCount: 30,
    optionsComplete: false, evidenceSource: 'reused_dictionary',
    reusedFrom: '13_100701_0', independentOptionsEvidence: false
  },
  {
    key: 'locationAllocation', label: '期望工作地是否服从分配*', wrapperId: '13_102402_0', sectionId: '13',
    controlKind: 'radio-group', options: ['是', '否'], harvestedOptionCount: 2,
    optionsComplete: true, evidenceSource: 'visible'
  },
  {
    key: 'expectedAnnualSalary', label: '期望年薪*', wrapperId: '13_47_0', sectionId: '13',
    controlKind: 'ant-select',
    options: ['10万以下', '11-20万', '21-30万', '31-40万', '41-50万', '51-60万',
      '61-70万', '71-80万', '81-90万', '91-100万', '101-150万', '151万以上'],
    harvestedOptionCount: 12, optionsComplete: true, evidenceSource: 'open'
  },
  {
    key: 'availability', label: '到岗时间*', wrapperId: '13_195_0', sectionId: '13',
    controlKind: 'ant-select', options: ['一周', '两周', '三周', '一个月', '两个月', '三个月', '六个月', '随时'],
    harvestedOptionCount: 8, optionsComplete: true, evidenceSource: 'open'
  },
  {
    key: 'researchInterests', label: '如应聘研究发展中心行业研究类岗位请勾选（建议仅勾选3~5项）*',
    wrapperId: '13_102501_0', sectionId: '13', controlKind: 'checkbox',
    options: ['非研究类岗位，不涉及', '宏观', '策略', '债券', '银行', '非银行金融', '房地产',
      '量化', '基金评价', '金属及材料（有色金属）', '化工', '交通运输', '生物医药', '汽车',
      '机械', '军工', '电力设备及新能源', '建材', '食品饮料', '轻工纺服', '纺服化妆品',
      '农林牧渔', '家电', '商业（零售+社会服务）', '电子', '传媒', '通信', '计算机',
      '中小盘', '环保及公用事业', '煤炭开采', '智库研究'],
    // R7: guarded read-only capture at 8abbdc20 enumerated all 32 owned static
    // labels. Provenance: tests/fixtures/cms-row-d-research-dictionary-r7.json.
    // Runtime still requires exact order/count and current ownership; no fill.
    harvestedOptionCount: 32, optionsComplete: true, evidenceSource: 'visible'
  },
  {
    key: 'experienceWorkNature', label: '工作性质', wrapperId: '49170501_49170517_0', sectionId: '49170501',
    controlKind: 'ant-select', options: WORK_NATURE, harvestedOptionCount: 2,
    optionsComplete: true, evidenceSource: 'open'
  },
  {
    key: 'englishCertificate', label: '英语证书名称*', wrapperId: '16_63_0', sectionId: '16',
    controlKind: 'ant-select', options: ['大学英语四级考试', '大学英语六级考试', '大学生英语专业四级考试',
      '大学生英语专业八级考试', '雅思', '托福', '其他'],
    harvestedOptionCount: 7, optionsComplete: true, evidenceSource: 'open'
  },
  {
    key: 'englishResult', label: '成绩', wrapperId: '16_64_0', sectionId: '16',
    controlKind: 'ant-select', options: ['未通过', '通过', '优秀'], harvestedOptionCount: 3,
    optionsComplete: true, evidenceSource: 'open'
  },
  {
    key: 'englishExamDate', label: '获得时间*', wrapperId: '16_65_0', sectionId: '16',
    controlKind: 'ant-calendar-picker', options: [], harvestedOptionCount: 0,
    optionsComplete: false, evidenceSource: 'metadata_only'
  },
  {
    key: 'securitiesExam', label: '证券从业资格考试*', wrapperId: '49170503_49170533_0', sectionId: '49170503',
    controlKind: 'ant-select', options: EXAM_RESULT, harvestedOptionCount: 2,
    optionsComplete: true, evidenceSource: 'open'
  },
  {
    key: 'cpaExam', label: '注册会计师考试*', wrapperId: '49170503_49170539_0', sectionId: '49170503',
    controlKind: 'ant-select', options: EXAM_RESULT, harvestedOptionCount: 2,
    optionsComplete: true, evidenceSource: 'open'
  },
  {
    key: 'judicialExam', label: '国家司法考试*', wrapperId: '49170503_49170543_0', sectionId: '49170503',
    controlKind: 'ant-select', options: EXAM_RESULT, harvestedOptionCount: 2,
    optionsComplete: true, evidenceSource: 'open'
  },
  {
    key: 'frmExam', label: 'FRM*', wrapperId: '49170503_899097553_0', sectionId: '49170503',
    controlKind: 'ant-select', options: EXAM_RESULT, harvestedOptionCount: 2,
    optionsComplete: true, evidenceSource: 'open'
  },
  {
    key: 'cfaExam', label: 'CFA*', wrapperId: '49170503_899059679_0', sectionId: '49170503',
    controlKind: 'ant-select', options: EXAM_RESULT, harvestedOptionCount: 2,
    optionsComplete: true, evidenceSource: 'open'
  }
].map(field => Object.freeze({ ...field, options: Object.freeze(field.options) })));

const fieldFor = wrapperId => ROW_D_FIELDS.find(field => field.wrapperId === wrapperId);
// V8 debug-evaluate rejects object spread/assign's CopyDataProperties path,
// even when both objects were created by this evaluation. Copy own metadata
// explicitly into a fresh evaluation-local result instead.
const mergeProbeData = (...sources) => {
  const result = {};
  for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
    const source = sources[sourceIndex];
    const keys = Object.keys(source);
    for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
      const key = keys[keyIndex];
      result[key] = source[key];
    }
  }
  return result;
};
const identity = field => field ? mergeProbeData({
  key: field.key, wrapperId: field.wrapperId, sectionId: field.sectionId,
  controlKind: field.controlKind, evidenceSource: field.evidenceSource,
  optionsComplete: field.optionsComplete, harvestedOptionCount: field.harvestedOptionCount,
}, field.reusedFrom ? { reusedFrom: field.reusedFrom, independentOptionsEvidence: false,
  dictionaryOptionCount: field.dictionaryOptionCount } : {}) : {};

// The real CMS main-world String.trim path is rejected by debug-evaluate.
// A page shim can close over a pre-existing RegExp whose state V8 protects.
// Create the whitespace RegExp inside each call, during this evaluation.
const trimProbeText = text => text.replace(/^\s+|\s+$/gu, '');

/**
 * Match only literal evidenced labels after trimming the requested strings.
 * A match means a dictionary hit, including explicitly marked partial/reused
 * dictionaries. It says nothing about a current control or permission to fill.
 * The returned indexes refer to ROW_D_FIELDS options; no requested or selected
 * value, unknown wrapper ID, or caller-provided object is returned.
 */
export function resolveCmsRowDOption(wrapperId, requested) {
  const field = fieldFor(wrapperId);
  const result = (ok, reason, extra = {}) => mergeProbeData(SAFETY, identity(field),
    { ok, status: ok ? 'matched' : 'skipped', reason }, extra);
  if (!field) return result(false, 'unknown_field');
  if (field.controlKind === 'ant-calendar-picker') return result(false, 'calendar_live_evidence_missing');
  const multiple = field.controlKind === 'checkbox';
  const labels = [];
  try {
    if (!multiple) {
      if (typeof requested !== 'string') return result(false, 'request_type_invalid');
      labels.push(trimProbeText(requested));
    } else {
      if (!Array.isArray(requested)) return result(false, 'request_type_invalid');
      const length = Object.getOwnPropertyDescriptor(requested, 'length');
      if (!length || !Object.hasOwn(length, 'value') || !Number.isSafeInteger(length.value)
        || length.value < 0 || length.value > field.options.length) return result(false, 'request_type_invalid');
      if (!length.value) return result(false, 'request_empty');
      // Require dense own data strings. Never invoke caller array methods,
      // inherited indexes, element getters, or its iterator. Proxy traps can
      // throw, but their messages and values are never serialized.
      for (let index = 0; index < length.value; index += 1) {
        const entry = Object.getOwnPropertyDescriptor(requested, String(index));
        if (!entry || !Object.hasOwn(entry, 'value') || typeof entry.value !== 'string') {
          return result(false, 'request_type_invalid');
        }
        labels.push(trimProbeText(entry.value));
      }
    }
  } catch { return result(false, 'request_type_invalid'); }
  if (labels.some(value => !value)) return result(false, 'request_empty');
  if (labels.some((label, index) => labels.indexOf(label) !== index)) return result(false, 'duplicate_option');
  const indexes = labels.map(value => field.options.indexOf(value));
  if (indexes.some(index => index < 0)) return result(false, 'option_unknown');
  const reason = field.reusedFrom ? 'dictionary_reused_unverified'
    : field.optionsComplete ? 'option_matched' : 'dictionary_sample_matched';
  return result(true, reason, multiple ? { optionIndexes: indexes } : { optionIndex: indexes[0] });
}

const normalizeText = text => trimProbeText(String(text ?? '').replace(/\s+/gu, ' '));
const listTokens = text => trimProbeText(String(text ?? '')).split(/\s+/u).filter(Boolean);

// Vue's reactive instance/prop accessors are not a read-only contract. Read
// only exact own data descriptors; do not call getters, iterators, render
// methods, or option value/selected-state properties. A hostile Proxy can
// reject a descriptor read; the live throwOnSideEffect boundary remains on.
const ownProbeData = (object, key) => {
  if (!object || !['object', 'function'].includes(typeof object)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor) return undefined;
  if (!Object.hasOwn(descriptor, 'value')) throw new TypeError();
  return descriptor.value;
};
const denseProbeArray = (object, maximum) => {
  if (!Array.isArray(object)) throw new TypeError();
  const length = ownProbeData(object, 'length');
  if (!Number.isSafeInteger(length) || length < 1 || length > maximum) throw new TypeError();
  const result = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(object, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw new TypeError();
    result.push(descriptor.value);
  }
  return result;
};

// The real CMS main world uses React, not Vue. Authenticate the committed
// host branch before reading field-local Select definitions. DOM expandos can
// retain the alternate from a previous render; neither that branch nor cached
// Trigger.options/current values are dictionary evidence.
const ownedReactSelectLabels = (select, reference, diagnostic) => {
  const reject = issue => { diagnostic.optionsDefinitionIssue = issue; return null; };
  try {
    const keys = Object.getOwnPropertyNames(select);
    const anchors = keys.filter(key => /^(?:__reactInternalInstance|__reactFiber)\$/u.test(key));
    if (!anchors.length) return undefined; // A different framework may own it.
    diagnostic.optionsFramework = 'react';
    if (anchors.length !== 1) return reject('current_root_unverified');
    const anchorKey = anchors[0];
    const anchor = ownProbeData(select, anchorKey);
    const alternate = ownProbeData(anchor, 'alternate');
    const branches = alternate ? [anchor, alternate] : [anchor];
    // React bailout subtrees can share children whose return still names the
    // alternate parent. Collect only this host's possible ancestry, then prove
    // its path DOWN from root.current through committed child/sibling links.
    const ancestry = [];
    const pending = branches.slice();
    while (pending.length) {
      const fiber = pending.pop();
      if (!fiber || ancestry.includes(fiber)) continue;
      if (ancestry.length >= 256) return reject('current_chain_unverified');
      ancestry.push(fiber);
      pending.push(ownProbeData(fiber, 'return'), ownProbeData(fiber, 'alternate'));
    }
    const roots = ancestry.filter(fiber => ownProbeData(fiber, 'tag') === 3
      && !ownProbeData(fiber, 'return') && ownProbeData(ownProbeData(fiber, 'stateNode'), 'current') === fiber);
    if (roots.length !== 1) return reject('current_chain_unverified');
    const committed = [];
    const work = [{ fiber: roots[0], path: [] }];
    const visited = [];
    while (work.length) {
      const entry = work.pop();
      const fiber = entry.fiber;
      if (visited.includes(fiber) || visited.length >= 256 || entry.path.length >= 128) return reject('current_chain_unverified');
      visited.push(fiber);
      const path = entry.path.concat([fiber]);
      if (branches.includes(fiber)) {
        if (ownProbeData(fiber, 'tag') === 5 && ownProbeData(fiber, 'stateNode') === select
          && ownProbeData(fiber, 'type') === 'div') committed.push(path.reverse());
        continue;
      }
      const siblings = [];
      for (let child = ownProbeData(fiber, 'child'); child; child = ownProbeData(child, 'sibling')) {
        if (siblings.includes(child) || siblings.length >= 256) return reject('current_chain_unverified');
        siblings.push(child);
        if (ancestry.includes(child)) work.push({ fiber: child, path });
      }
    }
    if (committed.length !== 1) return reject('current_chain_unverified');
    const path = committed[0];
    const candidates = [];
    const triggers = [];
    // Stop at the next host ancestor: no form model, sibling field, application
    // store, or selected-state scan can substitute for this exact control.
    for (let index = 1; index < path.length && index < 16; index += 1) {
      const fiber = path[index];
      if (ownProbeData(fiber, 'tag') === 5) break;
      const type = ownProbeData(fiber, 'type');
      const name = ownProbeData(type, 'displayName') || ownProbeData(type, 'name');
      if (name === 'Select') candidates.push(fiber);
      if (name === 'SelectTrigger') triggers.push(fiber);
    }
    if (candidates.length !== 1 || triggers.length !== 1
      || path.indexOf(triggers[0]) >= path.indexOf(candidates[0])) return reject('select_component_unrecognized');
    const props = ownProbeData(candidates[0], 'memoizedProps');
    const triggerProps = ownProbeData(triggers[0], 'memoizedProps');
    if (!props || !triggerProps
      || ownProbeData(ownProbeData(candidates[0], 'stateNode'), 'props') !== props
      || ownProbeData(ownProbeData(triggers[0], 'stateNode'), 'props') !== triggerProps) return reject('current_props_unverified');
    if (ownProbeData(triggerProps, 'ariaId') !== reference
      || ownProbeData(props, 'prefixCls') !== 'ant-select'
      || ownProbeData(triggerProps, 'prefixCls') !== 'ant-select') return reject('aria_binding_unverified');
    const loading = ownProbeData(props, 'loading');
    if (loading !== undefined && loading !== false) return reject('loading');
    const flags = ['multiple', 'tags', 'combobox', 'disabled', 'labelInValue'];
    for (let index = 0; index < flags.length; index += 1) {
      const flag = ownProbeData(props, flags[index]);
      if (flag !== undefined && flag !== false) return reject('select_mode_unsupported');
    }
    const dropdownRender = ownProbeData(props, 'dropdownRender');
    const defaultRender = ownProbeData(ownProbeData(ownProbeData(candidates[0], 'type'), 'defaultProps'), 'dropdownRender');
    if (ownProbeData(props, 'optionLabelProp') !== 'children'
      || (dropdownRender !== undefined && (typeof defaultRender !== 'function' || dropdownRender !== defaultRender))
      || ownProbeData(triggerProps, 'dropdownRender') !== dropdownRender) return reject('option_render_unsupported');
    const options = denseProbeArray(ownProbeData(props, 'children'), 10000);
    const labels = [];
    for (let index = 0; index < options.length; index += 1) {
      const option = options[index];
      const type = ownProbeData(option, 'type');
      const optionProps = ownProbeData(option, 'props');
      if (typeof type !== 'function' || ownProbeData(type, 'isSelectOption') !== true
        || !optionProps || ownProbeData(option, 'ref') != null) return reject('option_shape_unsupported');
      const names = Object.getOwnPropertyNames(optionProps);
      if (names.some(name => !['children', 'value', 'disabled', 'title'].includes(name))) return reject('option_shape_unsupported');
      const disabled = ownProbeData(optionProps, 'disabled');
      if (disabled !== undefined && disabled !== false) return reject('option_shape_unsupported');
      // Never read option values, component state, selected props or input text.
      const text = ownProbeData(optionProps, 'children');
      if (typeof text !== 'string' || text.length > 2000) return reject('option_text_unsupported');
      const label = normalizeText(text);
      if (!label || labels.includes(label)) return reject('option_text_ambiguous');
      labels.push(label);
    }
    diagnostic.optionsEvidenceSource = 'owned_react_props';
    return labels;
  } catch { return reject('definition_data_unavailable'); }
};

// Classify the former L314 gate without invoking Vue accessors. Counts and
// enums only; no component, property suffix, node content or page value escapes.
const classifyOptionRoot = (select, item, doc) => {
  const shape = node => {
    if (!node) return 'node_absent';
    const descriptor = Object.getOwnPropertyDescriptor(node, '__vue__');
    return !descriptor ? 'absent' : !Object.hasOwn(descriptor, 'value') ? 'accessor'
      : descriptor.value == null ? 'nullish' : 'data';
  };
  const result = { selectVue: shape(select), appVue: shape(doc.querySelector('#app')),
    pathData: 0, pathAccessor: 0, pathAbsent: 0, pathNullish: 0 };
  for (let node = select, depth = 0; node && depth < 32; node = node.parentElement, depth += 1) {
    const kind = shape(node);
    if (kind === 'data') result.pathData += 1;
    if (kind === 'accessor') result.pathAccessor += 1;
    if (kind === 'absent') result.pathAbsent += 1;
    if (kind === 'nullish') result.pathNullish += 1;
    if (node === item) break;
  }
  return result;
};

const ownedSelectDefinitionLabels = (select, reference, diagnostic, item, doc) => {
  diagnostic.optionsRootDiagnostic = classifyOptionRoot(select, item, doc);
  const react = ownedReactSelectLabels(select, reference, diagnostic);
  return react === undefined ? ownedSelectVNodeLabels(select, reference, diagnostic, item) : react;
};

/**
 * Conservative Ant Design Vue 1.7.8 / Vue 2 option-definition evidence.
 * vc-select/Select.js initializes _options=[] and renders that menu only while
 * open. Its current propsData.children, however, already contains the option
 * VNodes created by select/index.js. Reading those current definitions can
 * avoid opening a dormant portal. This is not mounted-list DOM evidence.
 *
 * Bind every step to this exact current root and current render/parent VNodes.
 * Never inspect _optionsInfo: the component retains old selected entries in
 * that cache. Reject unsupported groups, custom render/filter modes, rich
 * labels, disabled options, accessors, cycles, and incomplete component links.
 * Labels remain evaluation-local and still face the exact harvested dictionary
 * checks. Source compatibility is not proof of the real CMS component shape.
 */
const ownedSelectVNodeLabels = (select, reference, diagnostic = {}, item = null) => {
  const reject = issue => { diagnostic.optionsDefinitionIssue = issue; return null; };
  try {
    const seen = [];
    const candidates = [];
    let current = ownProbeData(select, '__vue__');
    if (current === undefined || current === null) {
      // Vue can clear an old root's expando while an enclosing component's
      // current render still owns that exact element. Inspect only the nearest
      // anchored DOM ancestor inside this already-verified form item. Never
      // search another field, a wrapper/section root, $children, refs, slots,
      // retained option caches, or application state for a substitute.
      const path = [select];
      for (let node = item && select.parentElement, depth = 0; node && depth < 16; depth += 1) {
        path.push(node);
        if (node === item) break;
        node = node.parentElement;
      }
      if (item && path[path.length - 1] === item) {
        for (let pathIndex = 1; pathIndex < path.length; pathIndex += 1) {
          const root = path[pathIndex];
          const anchor = ownProbeData(root, '__vue__');
          if (anchor === undefined || anchor === null) continue;
          const render = ownProbeData(anchor, '_vnode');
          if (ownProbeData(anchor, '$el') !== root || ownProbeData(render, 'elm') !== root) {
            return reject('current_root_unverified');
          }
          const pending = [{ vnode: render, depth: 0 }];
          const visited = [];
          const roots = [];
          while (pending.length) {
            const entry = pending.pop();
            const vnode = entry.vnode;
            if (!vnode || visited.includes(vnode) || visited.length >= 512 || entry.depth > 32) {
              return reject('current_chain_unverified');
            }
            visited.push(vnode);
            const element = ownProbeData(vnode, 'elm');
            // Identity against this exact ancestor path avoids reading sibling
            // content, selected text, DOM snapshots, or any component getters.
            if (!path.includes(element)) continue;
            const child = ownProbeData(vnode, 'componentInstance');
            if (child !== undefined && child !== null) {
              const childRender = ownProbeData(child, '_vnode');
              if (ownProbeData(child, '$vnode') !== vnode || ownProbeData(child, '$el') !== element
                || ownProbeData(childRender, 'elm') !== element) return reject('current_chain_unverified');
              if (element === select) roots.push(child);
              else pending.push({ vnode: childRender, depth: entry.depth + 1 });
            } else {
              if (element === select) return reject('current_chain_unverified');
              const children = ownProbeData(vnode, 'children');
              if (children === undefined || children === null) continue;
              if (!Array.isArray(children)) return reject('current_chain_unverified');
              const length = ownProbeData(children, 'length');
              if (!Number.isSafeInteger(length) || length < 0 || length > 256
                || visited.length + pending.length + length > 512) return reject('current_chain_unverified');
              for (let index = 0; index < length; index += 1) {
                const childVNode = Object.getOwnPropertyDescriptor(children, String(index));
                if (!childVNode || !Object.hasOwn(childVNode, 'value')) return reject('current_chain_unverified');
                pending.push({ vnode: childVNode.value, depth: entry.depth + 1 });
              }
            }
          }
          if (roots.length !== 1) return reject('current_chain_unverified');
          current = roots[0];
          break;
        }
      }
      if (current === undefined || current === null) return reject('root_anchor_missing');
    }
    // Vue may move __vue__ to a lower component sharing this root after an
    // update. Ascend only the exact current single-root render chain first.
    const ascended = [];
    for (let depth = 0; current && depth < 8; depth += 1) {
      if (ascended.includes(current) || ownProbeData(current, '$el') !== select
        || ownProbeData(ownProbeData(current, '_vnode'), 'elm') !== select) return reject('current_root_unverified');
      ascended.push(current);
      const parent = ownProbeData(current, '$parent');
      if (!parent || ownProbeData(parent, '$el') !== select) break;
      const render = ownProbeData(parent, '_vnode');
      if (ownProbeData(render, 'elm') !== select || ownProbeData(current, '$vnode') !== render
        || ownProbeData(render, 'componentInstance') !== current || depth === 7) return reject('current_chain_unverified');
      current = parent;
    }
    for (let depth = 0; current && depth < 8; depth += 1) {
      if (seen.includes(current)) return reject('current_chain_unverified');
      seen.push(current);
      const render = ownProbeData(current, '_vnode');
      if (ownProbeData(current, '$el') !== select || ownProbeData(render, 'elm') !== select) return reject('current_root_unverified');
      const parent = ownProbeData(current, '$vnode');
      const component = ownProbeData(parent, 'componentOptions');
      const config = ownProbeData(ownProbeData(component, 'Ctor'), 'options');
      if (ownProbeData(config, 'name') === 'Select') {
        if (ownProbeData(parent, 'componentInstance') !== current || ownProbeData(parent, 'elm') !== select) return reject('current_chain_unverified');
        candidates.push(current);
      }
      const child = ownProbeData(render, 'componentInstance');
      if (child && ownProbeData(child, '$vnode') !== render) return reject('current_chain_unverified');
      current = child;
    }
    if (current || candidates.length !== 1) return reject('select_component_unrecognized');
    const candidate = candidates[0];
    const parent = ownProbeData(candidate, '$vnode');
    const props = ownProbeData(ownProbeData(candidate, '$options'), 'propsData');
    if (!props || ownProbeData(ownProbeData(parent, 'componentOptions'), 'propsData') !== props) return reject('current_props_unverified');
    // select/index.js forwards loading to this current propsData. Matching
    // labels retained during a refresh do not establish ready options.
    const loading = ownProbeData(props, 'loading');
    if (loading !== undefined && loading !== false) return reject('loading');
    const flags = ['multiple', 'tags', 'combobox', 'disabled'];
    for (let flagIndex = 0; flagIndex < flags.length; flagIndex += 1) {
      const flag = ownProbeData(props, flags[flagIndex]);
      if (flag !== undefined && flag !== false) return reject('select_mode_unsupported');
    }
    // Ant 1.7.8 keeps the full current children definition for searchable
    // single selects too. renderFilterOptionsFromChildren filters a separate
    // menu using _inputValue; never read that private search/selected state.
    // This source remains definition evidence, not a filtered/visible menu.
    const searchable = ownProbeData(props, 'showSearch');
    const filter = ownProbeData(props, 'filterOption');
    if ((searchable !== undefined && searchable !== false && searchable !== true)
      || (filter !== undefined && filter !== false && filter !== true)) return reject('search_filter_unsupported');
    if (ownProbeData(props, 'optionLabelProp') !== 'children'
      || ownProbeData(props, 'dropdownRender') !== undefined) return reject('option_render_unsupported');
    const render = ownProbeData(candidate, '_vnode');
    const trigger = ownProbeData(render, 'componentOptions');
    const triggerConfig = ownProbeData(ownProbeData(trigger, 'Ctor'), 'options');
    const triggerInstance = ownProbeData(render, 'componentInstance');
    if (ownProbeData(triggerConfig, 'name') !== 'SelectTrigger'
      || ownProbeData(ownProbeData(trigger, 'propsData'), 'ariaId') !== reference
      || ownProbeData(triggerInstance, '$vnode') !== render) return reject('aria_binding_unverified');
    const options = denseProbeArray(ownProbeData(props, 'children'), 10000);
    const labels = [];
    for (let index = 0; index < options.length; index += 1) {
      const option = options[index];
      const component = ownProbeData(option, 'componentOptions');
      const config = ownProbeData(ownProbeData(component, 'Ctor'), 'options');
      const data = ownProbeData(option, 'data');
      const attrs = ownProbeData(data, 'attrs');
      const disabled = ownProbeData(ownProbeData(component, 'propsData'), 'disabled');
      if (ownProbeData(config, 'isSelectOption') !== true || !data
        || ownProbeData(data, 'slot') !== undefined
        || ownProbeData(data, 'style') !== undefined || ownProbeData(data, 'staticStyle') !== undefined
        || ownProbeData(data, 'class') !== undefined || ownProbeData(data, 'staticClass') !== undefined
        || ownProbeData(data, 'scopedSlots') !== undefined
        || (attrs !== undefined && (!attrs || Reflect.ownKeys(attrs).length !== 0))
        || (disabled !== undefined && disabled !== false)) return reject('option_shape_unsupported');
      const children = denseProbeArray(ownProbeData(component, 'children'), 64);
      const text = [];
      for (let childIndex = 0; childIndex < children.length; childIndex += 1) {
        const child = children[childIndex];
        const label = ownProbeData(child, 'text');
        if (typeof label !== 'string' || label.length > 2000
          || ownProbeData(child, 'tag') !== undefined || ownProbeData(child, 'data') !== undefined
          || ownProbeData(child, 'componentOptions') !== undefined
          || ownProbeData(child, 'isComment') !== false) return reject('option_text_unsupported');
        text.push(label);
      }
      const label = normalizeText(text.join(''));
      if (!label || labels.includes(label)) return reject('option_text_ambiguous');
      labels.push(label);
    }
    return labels;
  } catch { return reject('definition_data_unavailable'); }
};

/**
 * Inspect only. requests is an optional plain object keyed by exact allowlisted
 * wrapper IDs. Current list ownership must come from the current combobox's
 * aria-controls; harvested UUIDs and global dropdown fallbacks are never used.
 * If that exact list is missing/empty, a narrowly bound current Select VNode
 * definition can supply separately labeled evidence without opening anything.
 * A dormant hidden portal is readable without opening it. Its unique owner and
 * section/item boundaries are still required. No DOM node or option text is
 * included in a result.
 *
 * Visibility here only rejects explicit attribute/inline-style hiding. It
 * cannot verify stylesheet visibility, layout, clipping or on-screen geometry.
 * The result labels this limit; structural observation grants no write/support
 * permission. Calendar structure is inspected, but date/popup behavior remains
 * unevidenced and cannot pass this preflight.
 */
export function inspectCmsRowDOptions(doc, requests = {}) {
  const fields = [];
  const finish = (ok, reason) => mergeProbeData(SAFETY,
    { visibilityBasis: 'attributes_only', ok, reason, fields });
  const row = (field, ok, reason, extra = {}) => mergeProbeData(SAFETY, identity(field),
    { ok, status: ok ? 'observed' : 'skipped', reason }, extra);
  const stop = reason => {
    for (let index = 0; index < ROW_D_FIELDS.length; index += 1) {
      fields.push(row(ROW_D_FIELDS[index], false, reason));
    }
    return finish(false, reason);
  };
  try {
    const view = doc?.defaultView;
    if (!doc || !view) return stop('no_document');
    // Location.href is already browser-normalized. Compare the complete base
    // URL (including any authority credentials) without invoking a URL
    // constructor, which Blink rejects during throwOnSideEffect evaluation.
    if (view.location.href.split(/[?#]/u, 1)[0] !== ROW_D_PAGE) return stop('wrong_page');
    if (doc.visibilityState !== 'visible') return stop('page_hidden');
    if (doc.readyState !== 'complete') return stop('page_not_ready');
    if (!requests || (Object.getPrototypeOf(requests) !== Object.prototype && Object.getPrototypeOf(requests) !== null)) {
      return stop('requests_type_invalid');
    }
    const requestKeys = Reflect.ownKeys(requests);
    if (requestKeys.some(key => typeof key !== 'string' || !fieldFor(key))) return stop('unknown_request_field');
    if (requestKeys.some(key => !Object.hasOwn(Object.getOwnPropertyDescriptor(requests, key), 'value'))) {
      return stop('requests_type_invalid');
    }
    // Blink does not mark Element.matches/closest as Affects=Nothing. Use
    // querySelectorAll (which is marked) and tree reads instead. Cache only
    // evaluation-local snapshots; the inspector never changes the DOM.
    // CMS scripts can install stateful collection iterator shims. Consuming
    // even a freshly returned NodeList through spread/for-of can then write
    // page-owned shim state, which V8 rejects before our catch can run. Read
    // only length/indexes and keep the cache in evaluation-local arrays.
    const snapshot = collection => {
      const result = [];
      for (let index = 0; index < collection.length; index += 1) result.push(collection[index]);
      return result;
    };
    const cachedSelectors = [];
    const cachedMatches = [];
    const matches = (node, selector) => {
      if (!node) return false;
      const index = cachedSelectors.indexOf(selector);
      if (index !== -1) return cachedMatches[index].includes(node);
      const nodes = snapshot(doc.querySelectorAll(selector));
      cachedSelectors.push(selector);
      cachedMatches.push(nodes);
      return nodes.includes(node);
    };
    const closest = (node, selector) => {
      for (let parent = node; parent; parent = parent.parentElement) {
        if (matches(parent, selector)) return parent;
      }
      return null;
    };
    const collapsed = node => Boolean(closest(node, '.ant-collapse-content-inactive,details:not([open])'));
    const visible = node => {
      if (!node?.isConnected || closest(node, '[hidden],[aria-hidden="true"],[inert]') || collapsed(node)) return false;
      for (let parent = node; parent; parent = parent.parentElement) {
        // No computed style or geometry calls: those may force layout and
        // getClientRects is rejected by Blink's debug-evaluate guard.
        const style = (parent.getAttribute('style') || '').replace(/\/\*[\s\S]*?\*\//gu, '');
        if (style.split(';').some(declaration => /^\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:\s*hidden)\s*(?:!\s*important\s*)?$/iu.test(declaration))) return false;
      }
      return true;
    };
    const enabled = node => Boolean(node)
      && !matches(node, '[disabled],[aria-disabled="true"],.ant-select-disabled,.ant-radio-disabled,.ant-checkbox-disabled,.ant-calendar-picker-disabled,.ant-picker-disabled,.ant-cascader-picker-disabled')
      && !closest(node, 'fieldset[disabled],[inert],[aria-disabled="true"],.ant-select-disabled,.ant-radio-disabled,.ant-checkbox-disabled,.ant-calendar-picker-disabled,.ant-picker-disabled,.ant-cascader-picker-disabled');
    const available = node => visible(node) && enabled(node);
    const allIds = snapshot(doc.querySelectorAll('[id]'));
    const exactIds = id => allIds.filter(node => node.getAttribute('id') === id);
    // Do not consult application-defined IDL accessors on individual elements.
    // Type's missing/invalid-value default is text, just like HTMLInputElement.
    const inputType = node => {
      const type = (node.getAttribute('type') || '').toLowerCase();
      return ['hidden', 'text', 'search', 'tel', 'url', 'email', 'password', 'date',
        'month', 'week', 'time', 'datetime-local', 'number', 'range', 'color',
        'checkbox', 'radio', 'file', 'submit', 'image', 'reset', 'button'].includes(type) ? type : 'text';
    };
    const namedWrapper = /^\d+_\d+_\d+$/u;
    const nearestNamedWrapper = node => {
      for (let current = node; current; current = current.parentElement) {
        if (namedWrapper.test(current.getAttribute('id') || '')) return current;
      }
      return null;
    };
    const ownedByWrapper = (node, wrapper) => {
      for (let current = node; current && current !== wrapper; current = current.parentElement) {
        if (namedWrapper.test(current.getAttribute('id') || '')) return false;
      }
      return wrapper.contains(node);
    };
    for (let fieldIndex = 0; fieldIndex < ROW_D_FIELDS.length; fieldIndex += 1) {
      const field = ROW_D_FIELDS[fieldIndex];
      const hasRequest = Object.hasOwn(requests, field.wrapperId);
      const resolution = hasRequest ? resolveCmsRowDOption(field.wrapperId, requests[field.wrapperId]) : undefined;
      const observation = {};
      const push = (ok, reason, extra = {}) => fields.push(row(field, ok, reason,
        mergeProbeData(resolution ? { resolution } : {}, observation, extra)));
      const sections = exactIds(field.sectionId);
      if (sections.length === 1 && collapsed(sections[0])) {
        push(false, 'control_not_available', { availabilityIssue: 'collapsed_ancestor' }); continue;
      }
      if (sections.length !== 1 || !matches(sections[0], '.form-cell') || !visible(sections[0])) {
        push(false, 'section_not_unique_or_visible'); continue;
      }
      const section = sections[0];
      const wrappers = exactIds(field.wrapperId);
      if (wrappers.length !== 1) { push(false, 'wrapper_not_unique'); continue; }
      const wrapper = wrappers[0];
      const candidates = snapshot(wrapper.querySelectorAll('.ant-form-item'));
      const item = candidates.length === 1 ? candidates[0] : null;
      if (collapsed(wrapper) || (item && collapsed(item))) {
        push(false, 'control_not_available', { availabilityIssue: 'collapsed_ancestor' }); continue;
      }
      // Captured scripts resolve a descendant item from the outer wrapper.
      // There is deliberately no ancestor, wrapper-as-item or label fallback.
      if (!item || matches(wrapper, '.ant-form-item') || closest(wrapper, '.form-cell') !== section
        || closest(item, '.form-cell') !== section || wrapper.querySelector('.form-cell')
        || !ownedByWrapper(item, wrapper) || !visible(wrapper) || !visible(item)) {
        push(false, 'wrapper_scope_or_visibility_mismatch'); continue;
      }
      const owns = node => closest(node, '.ant-form-item') === item
        && closest(node, '.form-cell') === section && ownedByWrapper(node, wrapper);
      const owned = selector => snapshot(item.querySelectorAll(selector)).filter(owns);
      const labelsFor = candidate => snapshot(candidate.querySelectorAll('.ant-form-item-label > label'))
        .filter(label => closest(label, '.ant-form-item') === candidate && closest(label, '.form-cell') === section);
      const labels = labelsFor(item);
      if (labels.length !== 1 || !owns(labels[0]) || !visible(labels[0])
        || normalizeText(labels[0].textContent) !== field.label) {
        push(false, 'label_mismatch'); continue;
      }
      const peers = snapshot(section.querySelectorAll('.ant-form-item'))
        .filter(candidate => closest(candidate, '.form-cell') === section
          && labelsFor(candidate).some(label => normalizeText(label.textContent) === field.label));
      if (peers.length !== 1 || peers[0] !== item) { push(false, 'question_not_unique'); continue; }
      const controls = snapshot(item.querySelectorAll('.ant-select,.ant-calendar-picker,.ant-picker,.ant-cascader-picker,.ant-radio-group,.ant-checkbox-group,input,button,textarea,select,[contenteditable="true"],.el-select,.el-date-editor,.ant-upload'));
      if (controls.some(node => !owns(node))) { push(false, 'control_ownership_mismatch'); continue; }
      if (owned('button,textarea,select,[contenteditable="true"],.el-select,.el-date-editor,.ant-upload,input[type="file"]').length) {
        push(false, 'control_kind_mismatch', { controlKindIssue: 'unexpected_interactive_control' }); continue;
      }
      if (field.controlKind === 'ant-calendar-picker') {
        const pickers = owned('.ant-calendar-picker,.ant-picker');
        const inputs = owned('input');
        if (pickers.length !== 1 || inputs.length !== 1 || !pickers[0].contains(inputs[0])
          || owned('.ant-select,.ant-cascader-picker,.ant-radio-group,.ant-checkbox-group').length) {
          push(false, 'control_kind_mismatch'); continue;
        }
        if (inputType(inputs[0]) !== 'text') {
          push(false, 'control_kind_mismatch', { controlKindIssue: 'unexpected_input_kind' }); continue;
        }
        if (!available(pickers[0]) || !available(inputs[0])) {
          push(false, 'control_not_available', { availabilityIssue: !enabled(pickers[0]) || !enabled(inputs[0])
            ? 'disabled_attribute_or_class' : 'hidden_control' }); continue;
        }
        // This establishes a uniquely owned, attribute-available text picker,
        // without reading its value or assuming calendar/date semantics.
        push(false, 'calendar_live_evidence_missing', { calendarStructureObserved: true }); continue;
      }
      if (owned('.ant-calendar-picker,.ant-picker,.ant-cascader-picker').length) {
        // The recorded location classifier prioritized any .ant-select and
        // captured no helper markup. Do not silently whitelist a hybrid.
        push(false, 'control_kind_mismatch', { controlKindIssue: 'conflicting_picker' }); continue;
      }
      // A reassigned binding captured by later callbacks emits a context-slot
      // store that V8 rejects even on early-return paths. Keep a const local
      // array and append only to this evaluation-created collection instead.
      const optionLabels = [];
      if (field.controlKind === 'ant-select') {
        const selects = owned('.ant-select');
        if (selects.length !== 1) {
          push(false, 'control_kind_mismatch', { controlKindIssue: 'select_not_unique' }); continue;
        }
        if (owned('.ant-radio-group,.ant-checkbox-group,input[type="radio"],input[type="checkbox"]').length) {
          push(false, 'control_kind_mismatch', { controlKindIssue: 'mixed_choice_controls' }); continue;
        }
        const select = selects[0];
        const inputs = owned('input');
        if (inputs.some(node => !select.contains(node))) {
          push(false, 'control_kind_mismatch', { controlKindIssue: 'input_outside_select' }); continue;
        }
        if (inputs.some(node => !['text', 'search'].includes(inputType(node)))) {
          push(false, 'control_kind_mismatch', { controlKindIssue: 'unexpected_input_kind' }); continue;
        }
        const combos = snapshot(select.querySelectorAll('[role="combobox"]')).filter(owns);
        if (combos.length !== 1 || !matches(combos[0], '.ant-select-selection')) {
          push(false, 'control_not_unique'); continue;
        }
        const combo = combos[0];
        if (collapsed(select) || collapsed(combo)) {
          push(false, 'control_not_available', { availabilityIssue: 'collapsed_ancestor' }); continue;
        }
        if (!enabled(select) || !enabled(combo) || !inputs.every(enabled)) {
          push(false, 'control_not_available', { availabilityIssue: 'disabled_attribute_or_class' }); continue;
        }
        if (!visible(select) || !visible(combo)) {
          push(false, 'control_not_available', { availabilityIssue: 'hidden_control' }); continue;
        }
        // Ant single-selects may retain a hidden search input when closed.
        // It is not the visible control. Exempt only its exact owned helper
        // shape; generic/foreign/disabled inputs and hidden hosts still fail.
        const hiddenInputs = inputs.filter(node => !visible(node));
        if (hiddenInputs.length > 1 || hiddenInputs.some(node => {
          const search = closest(node, '.ant-select-search');
          return !matches(node, '.ant-select-search__field') || !search
            || !combo.contains(search) || !combo.contains(node) || collapsed(node)
            || closest(node, '.ant-select') !== select || !owns(search);
        })) {
          push(false, 'control_not_available', { availabilityIssue: 'hidden_non_search_input' }); continue;
        }
        observation.hiddenSearchInputCount = hiddenInputs.length;
        if (select.getAttribute('aria-busy') === 'true' || combo.getAttribute('aria-busy') === 'true'
          || matches(select, '.ant-select-loading') || owned('.ant-select-arrow .anticon-loading').length) {
          observation.optionsReadiness = 'loading';
          push(false, 'current_options_unavailable'); continue;
        }
        const references = listTokens(combo.getAttribute('aria-controls'));
        if (references.length !== 1) { push(false, 'dropdown_reference_missing_or_ambiguous'); continue; }
        const reference = references[0];
        const owners = snapshot(doc.querySelectorAll('[aria-controls]'))
          .filter(node => listTokens(node.getAttribute('aria-controls')).includes(reference));
        if (owners.length !== 1 || owners[0] !== combo) { push(false, 'dropdown_owner_not_unique'); continue; }
        const targets = exactIds(reference);
        if (!targets.length) {
          observation.optionsReadiness = 'target_missing';
          const fallback = ownedSelectDefinitionLabels(select, reference, observation, item, doc);
          if (!fallback) { push(false, 'current_options_unavailable'); continue; }
          for (let index = 0; index < fallback.length; index += 1) optionLabels.push(fallback[index]);
        } else {
          if (targets.length !== 1) { push(false, 'dropdown_target_not_unique'); continue; }
          const list = targets[0];
          const dropdown = closest(list, '.ant-select-dropdown');
          const listItem = closest(list, '.ant-form-item');
          const listSection = closest(list, '.form-cell');
          const listWrapper = nearestNamedWrapper(list);
          const dropdownWrapper = nearestNamedWrapper(dropdown);
          if (!list.isConnected || !dropdown || closest(dropdown.parentElement, '.ant-select-dropdown')
            || list.querySelector('.ant-select-dropdown') || (listItem && listItem !== item)
            || (listSection && listSection !== section)
            || (listWrapper && listWrapper !== wrapper) || (dropdownWrapper && dropdownWrapper !== wrapper)
            || (closest(dropdown, '.ant-form-item') && closest(dropdown, '.ant-form-item') !== item)
            || (closest(dropdown, '.form-cell') && closest(dropdown, '.form-cell') !== section)) {
            push(false, 'dropdown_scope_mismatch'); continue;
          }
          const optionNodes = snapshot(list.querySelectorAll('.ant-select-dropdown-menu-item,.ant-select-item-option,li[role="option"],.ant-select-item,li'));
          if (!optionNodes.length) {
            observation.optionsReadiness = 'list_empty';
            const fallback = ownedSelectDefinitionLabels(select, reference, observation, item, doc);
            if (!fallback) { push(false, 'current_options_unavailable'); continue; }
            for (let index = 0; index < fallback.length; index += 1) optionLabels.push(fallback[index]);
          } else {
            observation.optionsReadiness = 'observed';
            if (optionNodes.some(node => closest(node, '.ant-select-dropdown') !== dropdown
              || closest(node, '.ant-form-item') !== listItem || closest(node, '.form-cell') !== listSection
              || nearestNamedWrapper(node) !== listWrapper
              || optionNodes.some(other => other !== node && node.contains(other)))) {
              push(false, 'option_ownership_mismatch'); continue;
            }
            // A dormant dropdown may be hidden. No visibility action is performed.
            if (optionNodes.some(node => matches(node, '[disabled],[aria-disabled="true"],.ant-select-dropdown-menu-item-disabled,.ant-select-item-option-disabled'))) {
              push(false, 'option_not_available'); continue;
            }
            for (let index = 0; index < optionNodes.length; index += 1) {
              optionLabels.push(normalizeText(optionNodes[index].textContent));
            }
          }
        }
      } else {
        const radio = field.controlKind === 'radio-group';
        const kind = radio ? 'radio' : 'checkbox';
        const opposite = radio ? 'checkbox' : 'radio';
        const groups = owned(radio ? '.ant-radio-group' : '.ant-checkbox-group');
        const optionWrappers = owned(radio ? '.ant-radio-wrapper' : '.ant-checkbox-wrapper');
        const inputs = owned('input');
        if (owned(`.ant-select,.ant-${opposite}-group,input[type="${opposite}"]`).length
          || groups.length > 1 || !optionWrappers.length || inputs.length !== optionWrappers.length
          || inputs.some(node => inputType(node) !== kind)) {
          push(false, 'control_kind_mismatch'); continue;
        }
        if (groups.length && optionWrappers.some(node => !groups[0].contains(node))) {
          push(false, 'control_ownership_mismatch'); continue;
        }
        if (optionWrappers.some(option => !matches(option, 'label')
          || option.querySelectorAll(`input[type="${kind}"]`).length !== 1
          || optionWrappers.some(other => other !== option && option.contains(other)))
          || inputs.some(input => !optionWrappers.some(option => option.contains(input)))) {
          push(false, 'option_ownership_mismatch'); continue;
        }
        if (!groups.every(available) || !optionWrappers.every(available) || !inputs.every(available)) {
          push(false, 'control_not_available'); continue;
        }
        for (let index = 0; index < optionWrappers.length; index += 1) {
          optionLabels.push(normalizeText(optionWrappers[index].textContent));
        }
      }
      if (optionLabels.some((label, index) => !label || optionLabels.indexOf(label) !== index)) {
        push(false, 'option_list_ambiguous'); continue;
      }
      observation.observedOptionCount = optionLabels.length;
      if (field.controlKind === 'ant-select' && !observation.optionsEvidenceSource) observation.optionsEvidenceSource = observation.optionsReadiness === 'observed'
        ? 'aria_controls_dom' : 'owned_select_vnodes';
      if (!field.optionsComplete) {
        // A fully enumerated current DOM is not an independently complete
        // dictionary. Preserve the 25-label/reused evidence limits explicitly.
        observation.samplePrefixMatched = optionLabels.length >= field.options.length
          && field.options.every((label, index) => optionLabels[index] === label);
      }
      // Complete dictionaries require exact order and cardinality. A sample
      // requires its evidenced prefix, but never establishes completeness.
      const expectedCount = field.dictionaryOptionCount ?? field.harvestedOptionCount;
      if (field.options.some((label, index) => optionLabels[index] !== label)
        || (field.optionsComplete && optionLabels.length !== field.options.length)
        || (expectedCount !== null && optionLabels.length !== expectedCount)
        || optionLabels.length < field.options.length) {
        push(false, 'option_dictionary_mismatch'); continue;
      }
      if (resolution && !resolution.ok) { push(false, resolution.reason); continue; }
      if (field.reusedFrom) { push(false, 'reused_dictionary_unverified'); continue; }
      if (!field.optionsComplete) { push(false, 'option_dictionary_incomplete'); continue; }
      push(true, 'read_only_options_preflight');
    }
    const ok = fields.every(field => field.ok || (field.reason === 'calendar_live_evidence_missing' && !field.resolution));
    return finish(ok, ok ? 'read_only_preflight' : 'row_d_preflight_incomplete');
  } catch {
    // Never serialize DOM exceptions, which can contain page/request values.
    return finish(false, 'document_read_failed');
  }
}

/**
 * Build the same inert inspector for an explicitly invoked browser probe.
 * Validate own data without invoking accessors or caller array methods, then
 * serialize only canonical harvested labels selected by resolver indexes.
 * Invalid caller objects and thrown proxy traps share one sanitized error.
 */
export function buildCmsRowDOptionsProbeExpression(requests = {}) {
  const canonical = Object.create(null);
  try {
    if (!requests || (Object.getPrototypeOf(requests) !== Object.prototype
      && Object.getPrototypeOf(requests) !== null)) throw new TypeError();
    for (const key of Reflect.ownKeys(requests)) {
      if (typeof key !== 'string') throw new TypeError();
      const field = fieldFor(key);
      const descriptor = Object.getOwnPropertyDescriptor(requests, key);
      if (!field || field.controlKind === 'ant-calendar-picker' || !descriptor
        || !Object.hasOwn(descriptor, 'value')) throw new TypeError();
      const resolved = resolveCmsRowDOption(key, descriptor.value);
      if (!resolved.ok) throw new TypeError();
      canonical[key] = field.controlKind === 'checkbox'
        ? resolved.optionIndexes.map(index => field.options[index])
        : field.options[resolved.optionIndex];
    }
  } catch {
    throw new TypeError('cms_row_d_probe_requests_invalid');
  }
  return [
    '(() => {',
    `const ROW_D_PAGE = ${JSON.stringify(ROW_D_PAGE)};`,
    `const ROW_D_FIELDS = ${JSON.stringify(ROW_D_FIELDS)};`,
    `const SAFETY = ${JSON.stringify(SAFETY)};`,
    `const fieldFor = ${fieldFor.toString()};`,
    `const mergeProbeData = ${mergeProbeData.toString()};`,
    `const identity = ${identity.toString()};`,
    `const trimProbeText = ${trimProbeText.toString()};`,
    `const normalizeText = ${normalizeText.toString()};`,
    `const listTokens = ${listTokens.toString()};`,
    `const ownProbeData = ${ownProbeData.toString()};`,
    `const denseProbeArray = ${denseProbeArray.toString()};`,
    `const ownedReactSelectLabels = ${ownedReactSelectLabels.toString()};`,
    `const classifyOptionRoot = ${classifyOptionRoot.toString()};`,
    `const ownedSelectDefinitionLabels = ${ownedSelectDefinitionLabels.toString()};`,
    `const ownedSelectVNodeLabels = ${ownedSelectVNodeLabels.toString()};`,
    `const resolveCmsRowDOption = ${resolveCmsRowDOption.toString()};`,
    `const inspectCmsRowDOptions = ${inspectCmsRowDOptions.toString()};`,
    `return inspectCmsRowDOptions(globalThis.document, ${JSON.stringify(canonical)});`,
    '})()'
  ].join('\n');
}
