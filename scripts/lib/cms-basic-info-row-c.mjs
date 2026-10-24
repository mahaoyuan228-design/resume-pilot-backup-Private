/**
 * Read-only row C preflight. Metadata comes from the 2026-10-24 10:01
 * harvest, not an interaction recording. In particular, no select options,
 * dropdown ownership, or calendar popup structure were harvested.
 * This module performs no writes and grants no permission to fill.
 */
export const ROW_C_BASE_TIP = '640b0511ae1ae8d8fd45780a2d026c1daad09dbb';
export const ROW_C_HARVEST = 'cms-basic-other-harvest-2026-10-24-1001';
export const ROW_C_PAGE = 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';

export const ROW_C_FIELDS = Object.freeze([
  { key: 'gender', label: '性别*', wrapperId: '11_20_0', controlKind: 'radio-group' },
  { key: 'birthDate', label: '出生日期*', wrapperId: '11_21_0', controlKind: 'ant-calendar-picker', readOnly: true },
  { key: 'height', label: '身高*?', wrapperId: '11_247_0', controlKind: 'input', placeholder: '（单位：cm）' },
  { key: 'nationality', label: '国籍/地区*', wrapperId: '11_22_0', controlKind: 'ant-select' },
  { key: 'ethnicity', label: '民族*', wrapperId: '11_23_0', controlKind: 'ant-select' },
  { key: 'maritalStatus', label: '婚姻状况*', wrapperId: '11_24_0', controlKind: 'ant-select' },
  { key: 'politicalStatus', label: '政治面貌*', wrapperId: '11_25_0', controlKind: 'ant-select' },
  { key: 'identityType', label: '证件类型*', wrapperId: '11_28_0', controlKind: 'ant-select' },
  { key: 'identityNumber', label: '证件号码*', wrapperId: '11_29_0', controlKind: 'input', placeholder: '请填写证件号码' },
  { key: 'residence', label: '现居住地*', wrapperId: '11_26_0', controlKind: 'ant-select' },
  { key: 'contactAddress', label: '联系地址*', wrapperId: '11_51414234_0', controlKind: 'input', placeholder: '请填写联系地址' },
  { key: 'nativePlace', label: '籍贯*', wrapperId: '11_245_0', controlKind: 'ant-select' },
  { key: 'interviewLocation', label: '期望面试地点（供参考，实际安排将根据笔试通过名单确定）*', wrapperId: '11_1003214127_0', controlKind: 'ant-select' }
].map(row => Object.freeze(row)));

/** Serializable so an explicitly invoked future live probe can reuse it.
 * Only metadata is read. No input values, selected text, or option lists leave
 * the page. Existing save/network guards need no restoration by this probe.
 */
export function inspectCmsBasicInfoRowC(doc, specs = ROW_C_FIELDS, page = ROW_C_PAGE) {
  const view = doc?.defaultView;
  const norm = value => String(value ?? '').replace(/[＊*：:！!？?，,。.\s\u00a0]/gu, '').toLocaleLowerCase();
  const result = {
    neverSave: true, liveSupportClaimed: false, writeStarted: false,
    mutationAllowed: false, valuesExposed: false, sectionId: '11', fields: []
  };
  const skipped = (spec, reason) => ({ key: spec.key, wrapperId: spec.wrapperId,
    controlKind: spec.controlKind, status: 'skipped', reason });
  const stop = reason => ({ ...result, ok: false, reason,
    fields: specs.map(spec => skipped(spec, reason)) });
  if (!doc || !view) return stop('no_document');
  let url;
  try { url = new URL(view.location.href); } catch { return stop('wrong_page'); }
  if (`${url.origin}${url.pathname}` !== page || url.username || url.password) return stop('wrong_page');
  if (doc.visibilityState !== 'visible') return stop('page_hidden');
  if (doc.readyState !== 'complete') return stop('page_not_ready');
  const visible = node => {
    if (!node?.isConnected || node.closest('[hidden],[aria-hidden="true"],[inert]')) return false;
    for (let parent = node; parent; parent = parent.parentElement) {
      const style = view.getComputedStyle(parent);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    }
    return node.getClientRects().length > 0;
  };
  const allIds = [...doc.querySelectorAll('[id]')];
  const sections = allIds.filter(node => node.id === '11');
  if (sections.length !== 1 || !sections[0].classList.contains('form-cell') || !visible(sections[0])) {
    return stop('section_not_unique_or_visible');
  }
  const section = sections[0];
  const labelsFor = item => [...item.querySelectorAll('.ant-form-item-label > label')]
    .filter(node => node.closest('.ant-form-item') === item);
  const items = [...section.querySelectorAll('.ant-form-item')]
    .filter(item => item.closest('.form-cell') === section);
  for (const spec of specs) {
    const fail = reason => result.fields.push(skipped(spec, reason));
    const wrappers = allIds.filter(node => node.id === spec.wrapperId);
    if (wrappers.length !== 1) { fail('wrapper_not_unique'); continue; }
    const wrapper = wrappers[0];
    const item = wrapper.closest('.ant-form-item');
    if (!item || wrapper.closest('.form-cell') !== section || !visible(wrapper) || !visible(item)) {
      fail('wrapper_scope_or_visibility_mismatch'); continue;
    }
    const labels = labelsFor(item);
    if (labels.length !== 1 || !visible(labels[0]) || norm(labels[0].textContent) !== norm(spec.label)) {
      fail('label_mismatch'); continue;
    }
    const peers = items.filter(candidate => labelsFor(candidate).some(label => norm(label.textContent) === norm(spec.label)));
    if (peers.length !== 1 || peers[0] !== item) { fail('question_not_unique'); continue; }
    // Scope to the evidenced wrapper. Never fall back to a same-label neighbor.
    const owned = selector => [ ...(wrapper.matches(selector) ? [wrapper] : []),
      ...wrapper.querySelectorAll(selector) ].filter(node => node.closest('.ant-form-item') === item);
    const selects = owned('.ant-select');
    const calendars = owned('.ant-calendar-picker');
    const radios = owned('input[type="radio"]');
    const widgets = owned('.ant-picker,.el-select,.el-date-editor,input[type="file"],.ant-upload,textarea,select,[contenteditable="true"]');
    const inputs = owned('input');
    let controls = [];
    if (widgets.length) { fail('control_kind_mismatch'); continue; }
    if (spec.controlKind === 'ant-select') {
      if (!selects.length || calendars.length || radios.length
        || inputs.some(node => !node.closest('.ant-select'))) { fail('control_kind_mismatch'); continue; }
      // A region wrapper may contain a pair; this harvest did not establish
      // their hierarchy. Neither case grants permission to interact.
      if (!['residence', 'nativePlace'].includes(spec.key) && selects.length !== 1) {
        fail('control_not_unique'); continue;
      }
      if (inputs.some(node => node.disabled)) { fail('control_not_available'); continue; }
      controls = selects;
    } else if (spec.controlKind === 'ant-calendar-picker') {
      if (calendars.length !== 1 || selects.length || radios.length || inputs.length !== 1
        || inputs[0].type !== 'text' || !calendars[0].contains(inputs[0])
        || inputs[0].readOnly !== spec.readOnly) { fail('control_kind_mismatch'); continue; }
      controls = [calendars[0], inputs[0]];
    } else if (spec.controlKind === 'radio-group') {
      if (!radios.length || selects.length || calendars.length || inputs.length !== radios.length) {
        fail('control_kind_mismatch'); continue;
      }
      controls = radios;
    } else {
      if (selects.length || calendars.length || radios.length || inputs.length !== 1
        || inputs[0].type !== 'text' || inputs[0].readOnly
        || inputs[0].getAttribute('placeholder') !== spec.placeholder) { fail('control_kind_mismatch'); continue; }
      controls = inputs;
    }
    if (controls.some(node => !visible(node) || node.disabled || node.matches('.ant-select-disabled,[aria-disabled="true"]')
      || node.closest('fieldset[disabled]'))) { fail('control_not_available'); continue; }
    result.fields.push({ key: spec.key, wrapperId: spec.wrapperId, controlKind: spec.controlKind,
      status: spec.controlKind === 'ant-select' ? 'skipped' : 'observed',
      reason: spec.controlKind === 'ant-select' ? 'option_open_evidence_missing' : 'live_never_save_required' });
  }
  const ok = result.fields.every(row => ['live_never_save_required', 'option_open_evidence_missing'].includes(row.reason));
  return { ...result, ok, reason: ok ? 'read_only_preflight' : 'row_c_structure_mismatch' };
}

export function buildCmsBasicInfoRowCProbeExpression() {
  return `(${inspectCmsBasicInfoRowC.toString()})(globalThis.document,${JSON.stringify(ROW_C_FIELDS)},${JSON.stringify(ROW_C_PAGE)})`;
}
