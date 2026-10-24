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
      '农林牧渔', '家电', '商业（零售+社会服务）', '电子'],
    // The extractor caps optionsVisible at 25 and does not record the total.
    // Its property name does not establish computed visibility of each label.
    harvestedOptionCount: null, optionsComplete: false, evidenceSource: 'visible'
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

/**
 * Inspect only. requests is an optional plain object keyed by exact allowlisted
 * wrapper IDs. Current list ownership must come from the current combobox's
 * aria-controls; harvested UUIDs and global dropdown fallbacks are never used.
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
        const references = listTokens(combo.getAttribute('aria-controls'));
        if (references.length !== 1) { push(false, 'dropdown_reference_missing_or_ambiguous'); continue; }
        const reference = references[0];
        const owners = snapshot(doc.querySelectorAll('[aria-controls]'))
          .filter(node => listTokens(node.getAttribute('aria-controls')).includes(reference));
        if (owners.length !== 1 || owners[0] !== combo) { push(false, 'dropdown_owner_not_unique'); continue; }
        const targets = exactIds(reference);
        if (!targets.length) { push(false, 'current_options_unavailable'); continue; }
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
        if (!optionNodes.length) { push(false, 'current_options_unavailable'); continue; }
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
    `const resolveCmsRowDOption = ${resolveCmsRowDOption.toString()};`,
    `const inspectCmsRowDOptions = ${inspectCmsRowDOptions.toString()};`,
    `return inspectCmsRowDOptions(globalThis.document, ${JSON.stringify(canonical)});`,
    '})()'
  ].join('\n');
}
