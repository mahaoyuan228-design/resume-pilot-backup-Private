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
  writeStarted: false,
  mutationAllowed: false,
  valuesExposed: false
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
const identity = field => field ? {
  key: field.key, wrapperId: field.wrapperId, sectionId: field.sectionId,
  controlKind: field.controlKind, evidenceSource: field.evidenceSource,
  optionsComplete: field.optionsComplete, harvestedOptionCount: field.harvestedOptionCount,
  ...(field.reusedFrom ? { reusedFrom: field.reusedFrom, independentOptionsEvidence: false,
    dictionaryOptionCount: field.dictionaryOptionCount } : {})
} : {};

/**
 * Match only literal evidenced labels after trimming the requested strings.
 * A match means a dictionary hit, including explicitly marked partial/reused
 * dictionaries. It says nothing about a current control or permission to fill.
 * The returned indexes refer to ROW_D_FIELDS options; no requested or selected
 * value, unknown wrapper ID, or caller-provided object is returned.
 */
export function resolveCmsRowDOption(wrapperId, requested) {
  const field = fieldFor(wrapperId);
  const result = (ok, reason, extra = {}) => ({ ...SAFETY, ...identity(field),
    ok, status: ok ? 'matched' : 'skipped', reason, ...extra });
  if (!field) return result(false, 'unknown_field');
  if (field.controlKind === 'ant-calendar-picker') return result(false, 'calendar_live_evidence_missing');
  const multiple = field.controlKind === 'checkbox';
  const labels = [];
  try {
    if (!multiple) {
      if (typeof requested !== 'string') return result(false, 'request_type_invalid');
      labels.push(requested.trim());
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
        labels.push(entry.value.trim());
      }
    }
  } catch { return result(false, 'request_type_invalid'); }
  if (labels.some(value => !value)) return result(false, 'request_empty');
  if (new Set(labels).size !== labels.length) return result(false, 'duplicate_option');
  const indexes = labels.map(value => field.options.indexOf(value));
  if (indexes.some(index => index < 0)) return result(false, 'option_unknown');
  const reason = field.reusedFrom ? 'dictionary_reused_unverified'
    : field.optionsComplete ? 'option_matched' : 'dictionary_sample_matched';
  return result(true, reason, multiple ? { optionIndexes: indexes } : { optionIndex: indexes[0] });
}

const normalizeText = text => String(text ?? '').replace(/\s+/gu, ' ').trim();
const listTokens = text => String(text ?? '').trim().split(/\s+/u).filter(Boolean);

/**
 * Inspect only. requests is an optional plain object keyed by exact allowlisted
 * wrapper IDs. Current list ownership must come from the current combobox's
 * aria-controls; harvested UUIDs and global dropdown fallbacks are never used.
 * A dormant hidden portal is readable without opening it. Its unique owner and
 * section/item boundaries are still required. No DOM node or option text is
 * included in a result.
 *
 * The wrapper/item, label, input association and visibility checks below are
 * conservative runtime requirements, not claims that the harvest captured
 * complete markup or input value codes. The calendar remains metadata only.
 */
export function inspectCmsRowDOptions(doc, requests = {}) {
  const fields = [];
  const finish = (ok, reason) => ({ ...SAFETY, ok, reason, fields });
  const row = (field, ok, reason, extra = {}) => ({ ...SAFETY, ...identity(field),
    ok, status: ok ? 'observed' : 'skipped', reason, ...extra });
  const stop = reason => {
    fields.push(...ROW_D_FIELDS.map(field => row(field, false, reason)));
    return finish(false, reason);
  };
  try {
    const view = doc?.defaultView;
    if (!doc || !view) return stop('no_document');
    let url;
    try { url = new URL(view.location.href); } catch { return stop('wrong_page'); }
    if (`${url.origin}${url.pathname}` !== ROW_D_PAGE || url.username || url.password) return stop('wrong_page');
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
    const visible = node => {
      if (!node?.isConnected || node.closest('[hidden],[aria-hidden="true"],[inert]')) return false;
      for (let parent = node; parent; parent = parent.parentElement) {
        const style = view.getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
      }
      return node.getClientRects().length > 0;
    };
    const available = node => visible(node) && !node.disabled
      && !node.matches('[disabled],[aria-disabled="true"],.ant-select-disabled,.ant-radio-disabled,.ant-checkbox-disabled')
      && !node.closest('fieldset[disabled],[inert],[aria-disabled="true"],.ant-select-disabled,.ant-radio-disabled,.ant-checkbox-disabled');
    const allIds = [...doc.querySelectorAll('[id]')];
    const exactIds = id => allIds.filter(node => node.id === id);
    const namedWrapper = /^\d+_\d+_\d+$/u;
    const nearestNamedWrapper = node => {
      for (let current = node; current; current = current.parentElement) {
        if (namedWrapper.test(current.id || '')) return current;
      }
      return null;
    };
    const ownedByWrapper = (node, wrapper) => {
      for (let current = node; current && current !== wrapper; current = current.parentElement) {
        if (namedWrapper.test(current.id || '')) return false;
      }
      return wrapper.contains(node);
    };
    for (const field of ROW_D_FIELDS) {
      const hasRequest = Object.hasOwn(requests, field.wrapperId);
      const resolution = hasRequest ? resolveCmsRowDOption(field.wrapperId, requests[field.wrapperId]) : undefined;
      const push = (ok, reason, extra = {}) => fields.push(row(field, ok, reason,
        { ...(resolution ? { resolution } : {}), ...extra }));
      if (field.controlKind === 'ant-calendar-picker') {
        push(false, 'calendar_live_evidence_missing');
        continue;
      }
      const sections = exactIds(field.sectionId);
      if (sections.length !== 1 || !sections[0].matches('.form-cell') || !visible(sections[0])) {
        push(false, 'section_not_unique_or_visible'); continue;
      }
      const section = sections[0];
      const wrappers = exactIds(field.wrapperId);
      if (wrappers.length !== 1) { push(false, 'wrapper_not_unique'); continue; }
      const wrapper = wrappers[0];
      const candidates = [...wrapper.querySelectorAll('.ant-form-item')];
      const item = candidates.length === 1 ? candidates[0] : null;
      // Captured scripts resolve a descendant item from the outer wrapper.
      // There is deliberately no ancestor, wrapper-as-item or label fallback.
      if (!item || wrapper.matches('.ant-form-item') || wrapper.closest('.form-cell') !== section
        || item.closest('.form-cell') !== section || wrapper.querySelector('.form-cell')
        || !ownedByWrapper(item, wrapper) || !visible(wrapper) || !visible(item)) {
        push(false, 'wrapper_scope_or_visibility_mismatch'); continue;
      }
      const owns = node => node.closest('.ant-form-item') === item
        && node.closest('.form-cell') === section && ownedByWrapper(node, wrapper);
      const owned = selector => [...item.querySelectorAll(selector)].filter(owns);
      const labelsFor = candidate => [...candidate.querySelectorAll('.ant-form-item-label > label')]
        .filter(label => label.closest('.ant-form-item') === candidate && label.closest('.form-cell') === section);
      const labels = labelsFor(item);
      if (labels.length !== 1 || !owns(labels[0]) || !visible(labels[0])
        || normalizeText(labels[0].textContent) !== field.label) {
        push(false, 'label_mismatch'); continue;
      }
      const peers = [...section.querySelectorAll('.ant-form-item')]
        .filter(candidate => candidate.closest('.form-cell') === section
          && labelsFor(candidate).some(label => normalizeText(label.textContent) === field.label));
      if (peers.length !== 1 || peers[0] !== item) { push(false, 'question_not_unique'); continue; }
      const controls = [...item.querySelectorAll('.ant-select,.ant-calendar-picker,.ant-picker,.ant-radio-group,.ant-checkbox-group,input,button,textarea,select,[contenteditable="true"],.el-select,.el-date-editor,.ant-upload')];
      if (controls.some(node => !owns(node))) { push(false, 'control_ownership_mismatch'); continue; }
      if (owned('.ant-calendar-picker,.ant-picker,button,textarea,select,[contenteditable="true"],.el-select,.el-date-editor,.ant-upload,input[type="file"]').length) {
        push(false, 'control_kind_mismatch'); continue;
      }
      let optionLabels;
      if (field.controlKind === 'ant-select') {
        const selects = owned('.ant-select');
        if (selects.length !== 1 || owned('.ant-radio-group,.ant-checkbox-group,input[type="radio"],input[type="checkbox"]').length
          || owned('input').some(node => !selects[0]?.contains(node) || !['text', 'search'].includes(node.type))) {
          push(false, 'control_kind_mismatch'); continue;
        }
        const select = selects[0];
        const combos = [...select.querySelectorAll('[role="combobox"]')].filter(owns);
        if (combos.length !== 1 || !combos[0].matches('.ant-select-selection')) {
          push(false, 'control_not_unique'); continue;
        }
        const combo = combos[0];
        if (![select, combo, ...owned('input')].every(available)) { push(false, 'control_not_available'); continue; }
        const references = listTokens(combo.getAttribute('aria-controls'));
        if (references.length !== 1) { push(false, 'dropdown_reference_missing_or_ambiguous'); continue; }
        const reference = references[0];
        const owners = [...doc.querySelectorAll('[aria-controls]')]
          .filter(node => listTokens(node.getAttribute('aria-controls')).includes(reference));
        if (owners.length !== 1 || owners[0] !== combo) { push(false, 'dropdown_owner_not_unique'); continue; }
        const targets = exactIds(reference);
        if (!targets.length) { push(false, 'current_options_unavailable'); continue; }
        if (targets.length !== 1) { push(false, 'dropdown_target_not_unique'); continue; }
        const list = targets[0];
        const dropdown = list.closest('.ant-select-dropdown');
        const listItem = list.closest('.ant-form-item');
        const listSection = list.closest('.form-cell');
        const listWrapper = nearestNamedWrapper(list);
        const dropdownWrapper = nearestNamedWrapper(dropdown);
        if (!list.isConnected || !dropdown || dropdown.parentElement?.closest('.ant-select-dropdown')
          || list.querySelector('.ant-select-dropdown') || (listItem && listItem !== item)
          || (listSection && listSection !== section)
          || (listWrapper && listWrapper !== wrapper) || (dropdownWrapper && dropdownWrapper !== wrapper)
          || (dropdown.closest('.ant-form-item') && dropdown.closest('.ant-form-item') !== item)
          || (dropdown.closest('.form-cell') && dropdown.closest('.form-cell') !== section)) {
          push(false, 'dropdown_scope_mismatch'); continue;
        }
        const optionNodes = [...list.querySelectorAll('.ant-select-dropdown-menu-item,.ant-select-item-option,li[role="option"],.ant-select-item,li')];
        if (!optionNodes.length) { push(false, 'current_options_unavailable'); continue; }
        if (optionNodes.some(node => node.closest('.ant-select-dropdown') !== dropdown
          || node.closest('.ant-form-item') !== listItem || node.closest('.form-cell') !== listSection
          || nearestNamedWrapper(node) !== listWrapper
          || optionNodes.some(other => other !== node && node.contains(other)))) {
          push(false, 'option_ownership_mismatch'); continue;
        }
        // A dormant dropdown may be hidden. No visibility action is performed.
        if (optionNodes.some(node => node.matches('[disabled],[aria-disabled="true"],.ant-select-dropdown-menu-item-disabled,.ant-select-item-option-disabled'))) {
          push(false, 'option_not_available'); continue;
        }
        optionLabels = optionNodes.map(node => normalizeText(node.textContent));
      } else {
        const radio = field.controlKind === 'radio-group';
        const kind = radio ? 'radio' : 'checkbox';
        const opposite = radio ? 'checkbox' : 'radio';
        const groups = owned(radio ? '.ant-radio-group' : '.ant-checkbox-group');
        const optionWrappers = owned(radio ? '.ant-radio-wrapper' : '.ant-checkbox-wrapper');
        const inputs = owned('input');
        if (owned(`.ant-select,.ant-${opposite}-group,input[type="${opposite}"]`).length
          || groups.length > 1 || !optionWrappers.length || inputs.length !== optionWrappers.length
          || inputs.some(node => node.type !== kind)) {
          push(false, 'control_kind_mismatch'); continue;
        }
        if (groups.length && optionWrappers.some(node => !groups[0].contains(node))) {
          push(false, 'control_ownership_mismatch'); continue;
        }
        if (optionWrappers.some(option => !option.matches('label')
          || option.querySelectorAll(`input[type="${kind}"]`).length !== 1
          || optionWrappers.some(other => other !== option && option.contains(other)))
          || inputs.some(input => !optionWrappers.some(option => option.contains(input)))) {
          push(false, 'option_ownership_mismatch'); continue;
        }
        if (![...groups, ...optionWrappers, ...inputs].every(available)) {
          push(false, 'control_not_available'); continue;
        }
        optionLabels = optionWrappers.map(option => normalizeText(option.textContent));
      }
      if (optionLabels.some(label => !label) || new Set(optionLabels).size !== optionLabels.length) {
        push(false, 'option_list_ambiguous'); continue;
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
