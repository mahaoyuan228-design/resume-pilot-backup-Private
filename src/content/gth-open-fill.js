// Shipped GTH open-editor fill engine for 职业技能与特长 / 其他信息 / 教育经历 / 工作经验.
// The caller opens the editor. This engine never opens or closes one, and never
// clicks 保存 / 提交 / 投递 / 删除 / 取消 / 编辑 or a.eduexp-opt-icon / .el-icon-delete.
// Exact el-form-item labels. Writes dispatch input and change. Readback is per field.
// liveSupportClaimed stays false: a writer is not a claim the live site is supported.
(() => {
  const previous = globalThis.ResumeGthOpenFill;
  const priorApis = previous?.registry instanceof Map
    ? [...previous.registry.values()]
    : (Array.isArray(previous?.registry) ? previous.registry : []);
  for (const api of priorApis) {
    if (!api?.listener) continue;
    try { chrome.runtime.onMessage.removeListener(api.listener); } catch { /* reload */ }
  }
  const installed = new Map();
  const PAGE = 'https://hr.gtht.com/resume/edit/';
  const TITLES = ['基本信息', '教育经历', '求职意向', '工作经验', '职业技能与特长', '附件简历', '其他信息'];
  const FORBIDDEN = new Set(['保存', '提交', '投递', '删除', '取消', '编辑']);
  const norm = value => String(value ?? '').replace(/[\s\u00a0]+/gu, ' ').trim();
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const visible = node => !!node?.getClientRects().length
    && getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden';
  function shown(node) {
    if (!node || node.nodeType !== 1 || !node.isConnected) return false;
    let cur = node;
    while (cur && cur.nodeType === 1) {
      if (cur.hasAttribute('hidden')) return false;
      const style = getComputedStyle(cur);
      if (!style || style.display === 'none' || style.visibility === 'hidden') return false;
      cur = cur.parentElement;
    }
    return !!node.getClientRects().length;
  }
  class Stop extends Error { constructor(code) { super(code); this.code = code; } }
  const stop = code => { throw new Stop(code); };
  function inPickerPanel(node) {
    return !!node?.closest?.('.plugin-dialog-wrap, .dialog-wrap.plugin-dialog-wrap, .popover');
  }
  function clickAllowed(node) {
    if (!node || node.nodeType !== 1) return false;
    const text = norm(node.textContent);
    const panelCancel = node.matches?.('a.cancel.pop-btn') && text === '取消' && inPickerPanel(node);
    const panelConfirm = node.matches?.('a.confirm.pop-btn') && text === '确定' && inPickerPanel(node);
    if (!panelCancel && !panelConfirm && FORBIDDEN.has(text)) return false;
    if (node.matches?.('a.eduexp-opt-icon, .el-icon-delete') || node.closest?.('a.eduexp-opt-icon, .el-icon-delete')) return false;
    const pickerButton = !!node.closest?.('.el-picker-panel')
      && (node.matches?.('button.el-picker-panel__icon-btn, .el-icon-d-arrow-left, .el-icon-d-arrow-right')
        || !!node.closest?.('button.el-picker-panel__icon-btn'));
    if (!pickerButton && (node.matches?.('button') || node.closest?.('button'))) return false;
    return true;
  }
  async function guardedClick(node, boundAction) {
    if (!clickAllowed(node)) stop('forbidden_click');
    await boundAction(() => {
      if (!node.isConnected || !clickAllowed(node)) stop('forbidden_click');
      return node.click();
    });
  }
  function ownLabel(item) {
    const labels = [...item.querySelectorAll('.el-form-item__label')].filter(node => node.closest('.el-form-item') === item);
    return labels.length === 1 ? norm(labels[0].textContent) : '';
  }
  function itemsFor(form, question) {
    return [...form.querySelectorAll('.el-form-item')].filter(item => item.closest('form') === form && ownLabel(item) === question);
  }
  function requireItem(form, question) {
    const items = itemsFor(form, question);
    if (items.length === 0) stop('label_missing');
    if (items.length !== 1) stop('label_ambiguous');
    return items[0];
  }
  function siteValid(item, control) {
    return !item.classList.contains('is-error') && !item.classList.contains('is-validating')
      && control.getAttribute('aria-invalid') !== 'true'
      && ![...item.querySelectorAll('.el-form-item__error')].some(node => visible(node) && norm(node.textContent))
      && (!control.validity || control.validity.valid);
  }
  function overwriteProgressOk(readVal, existing, answer) {
    return readVal === '' || readVal === existing || norm(readVal) === norm(answer);
  }
  async function waitUntil(read, timeout = 1200) {
    const deadline = Date.now() + timeout;
    do {
      const found = read();
      if (found) return found;
      await pause(40);
    } while (Date.now() < deadline);
    return null;
  }
  function plainControl(item, kind) {
    const controls = [...item.querySelectorAll('input,select,textarea')]
      .filter(node => node.closest('.el-form-item') === item && !node.closest('.el-select, .el-date-editor, .el-cascader, .cascader-wrap, .input-l.pointer'));
    const exposed = controls.filter(visible);
    const input = exposed[0];
    const right = kind === 'textarea'
      ? input instanceof HTMLTextAreaElement
      : input instanceof HTMLInputElement && input.type === 'text';
    if (controls.length !== 1 || exposed.length !== 1 || !right || input.readOnly || input.disabled || !visible(input))
      stop(kind === 'textarea' ? 'target_not_plain_textarea' : 'target_not_plain_text');
    return { item, input, controls };
  }
  function selectTarget(form, field) {
    const item = requireItem(form, field.question);
    const widgets = [...item.querySelectorAll('.el-select.select-l')].filter(node => node.closest('.el-form-item') === item);
    if (widgets.length !== 1) stop('select_structure_changed');
    const widget = widgets[0];
    const dropdowns = [...widget.querySelectorAll('.el-select-dropdown.el-popper')].filter(node => widget.contains(node));
    if (dropdowns.length > 1) stop('select_structure_changed');
    const inputs = [...widget.querySelectorAll('input.el-input__inner')].filter(node => !dropdowns.some(menu => menu.contains(node)));
    if (inputs.length !== 1 || !(inputs[0] instanceof HTMLInputElement) || inputs[0].type !== 'text'
      || !inputs[0].readOnly || inputs[0].disabled || !shown(inputs[0]))
      stop('select_structure_changed');
    return { item, widget, input: inputs[0], controls: inputs };
  }
  function optionTexts(menu) {
    if (!menu) return null;
    return [...menu.querySelectorAll('li.el-select-dropdown__item')].map(node => norm(node.textContent));
  }
  function optionsMatch(menu, list) {
    const texts = optionTexts(menu);
    if (!texts || texts.length !== list.length || list.some(text => !texts.includes(text)) || new Set(texts).size !== texts.length) return null;
    return [...menu.querySelectorAll('li.el-select-dropdown__item')];
  }
  function resolveSelectMenu(widget, list) {
    const inWidget = [...widget.querySelectorAll('.el-select-dropdown.el-popper')].filter(node => widget.contains(node));
    const body = [...document.body.children].filter(node => node.matches?.('.el-select-dropdown.el-popper'));
    const inOk = inWidget.filter(menu => optionsMatch(menu, list));
    const bodyOk = body.filter(menu => optionsMatch(menu, list));
    if (bodyOk.length > 1 || inOk.length > 1 || (inOk.length > 0 && bodyOk.length > 0)) return { bad: 'select_structure_changed' };
    if (inOk.length === 1) return { menu: inOk[0], options: optionsMatch(inOk[0], list) };
    if (bodyOk.length === 1) return { menu: bodyOk[0], options: optionsMatch(bodyOk[0], list) };
    if (inWidget.length || body.length) return { bad: 'select_structure_changed' };
    return { menu: null, options: null };
  }
  function radioTarget(form, field) {
    const item = requireItem(form, field.question);
    const radios = [...item.querySelectorAll('input[type="radio"]')].filter(node => node.closest('.el-form-item') === item);
    const options = radios.map(control => {
      const label = control.closest('label.el-radio');
      const own = label?.querySelector('.el-radio__label');
      const text = norm(own?.textContent || '');
      if (!label || !item.contains(label) || !shown(label)
        || label.querySelectorAll('input[type="radio"]').length !== 1
        || !field.answers.includes(text)) stop('radio_structure_changed');
      return { control, label, text };
    });
    const texts = options.map(option => option.text);
    if (options.length !== field.answers.length || field.answers.some(text => !texts.includes(text)) || new Set(texts).size !== texts.length)
      stop('radio_structure_changed');
    return {
      item, kind: 'radio', controls: radios, options,
      read() {
        const selected = options.filter(option => option.control.checked);
        if (selected.length > 1) stop('radio_structure_changed');
        return selected[0]?.text || '';
      }
    };
  }
  function unsupportedTarget(form, field) {
    const item = requireItem(form, field.question);
    if (field.shape === 'salary') return unknownControl(item, 'control_not_supported');
    if (field.shape === 'month') {
      const editors = [...item.querySelectorAll('.el-date-editor')].filter(node => node.closest('.el-form-item') === item);
      if (editors.length !== 2) stop('control_structure_changed');
      return { item, controls: [], unsupported: true, step: 'control_not_supported' };
    }
    if (field.shape === 'category') {
      const triggers = [...item.querySelectorAll('.input-l.pointer')].filter(node => node.closest('.el-form-item') === item);
      const inputs = triggers.flatMap(trigger => [...trigger.querySelectorAll('input')]);
      if (triggers.length !== 1 || inputs.length !== 1 || !(inputs[0] instanceof HTMLInputElement) || !inputs[0].readOnly)
        stop('control_structure_changed');
      return { item, controls: inputs, unsupported: true, step: 'control_not_supported' };
    }
    stop('control_not_supported');
  }
  function unknownControl(item, step) {
    return { item, controls: [], inputs: [], triggers: [], input: null, trigger: null, panel: null, unsupported: true, step };
  }
  function monthRangeTarget(form, field) {
    const item = requireItem(form, field.question);
    const editors = [...item.querySelectorAll('.el-date-editor')].filter(node => node.closest('.el-form-item') === item && !node.closest('.el-picker-panel'));
    if (editors.length !== 2 || editors.some(node => !node.classList.contains('el-date-editor--month')))
      return unknownControl(item, 'month_range_structure_unknown');
    const inputs = [];
    const triggers = [];
    for (const editor of editors) {
      const found = [...editor.querySelectorAll('input')].filter(node => !node.closest('.el-picker-panel'));
      if (found.length !== 1 || !(found[0] instanceof HTMLInputElement) || found[0].type !== 'text'
        || !found[0].readOnly || found[0].disabled || !shown(found[0]))
        return unknownControl(item, 'month_range_structure_unknown');
      const icons = [...editor.querySelectorAll('.el-input__prefix .el-input__icon.el-icon-date')].filter(shown);
      if (icons.length !== 1) return unknownControl(item, 'month_range_trigger_unknown');
      inputs.push(found[0]);
      triggers.push(icons[0]);
    }
    return { item, editors, inputs, triggers, controls: inputs, unsupported: false,
      read: () => inputs.map(node => norm(node.value)).join(' | ') };
  }
  function pickerTriggerNode(node, item) {
    if (!node?.classList?.contains('input-l') || !node.classList.contains('pointer')) return false;
    if (node.closest('.el-form-item') !== item) return false;
    if (node.closest('.plugin-dialog-wrap, .el-select, .el-cascader, .el-date-editor, .el-upload')) return false;
    if (node.tagName === 'INPUT') {
      const type = (node.getAttribute('type') || 'text').toLowerCase();
      return type === 'text' && (node.readOnly || node.hasAttribute('readonly')) && !node.disabled;
    }
    if (node.tagName !== 'DIV') return false;
    const typed = [...node.querySelectorAll('input')].filter(input => {
      if (input.closest('.plugin-dialog-wrap')) return false;
      const type = (input.getAttribute('type') || 'text').toLowerCase();
      return !['hidden', 'radio', 'checkbox', 'file', 'password', 'button', 'submit'].includes(type);
    });
    return typed.length === 1 && (typed[0].readOnly || typed[0].hasAttribute('readonly')) && !typed[0].disabled;
  }
  function pickerTarget(form, field) {
    const item = requireItem(form, field.question);
    const candidates = [...item.querySelectorAll('input.input-l.pointer, div.input-l.pointer')].filter(node => pickerTriggerNode(node, item));
    const triggers = candidates.filter(node => !candidates.some(other => other !== node && other.contains(node)));
    if (triggers.length !== 1) return unknownControl(item, 'picker_trigger_structure_unknown');
    const trigger = triggers[0];
    const input = trigger.tagName === 'INPUT'
      ? trigger
      : [...trigger.querySelectorAll('input')].find(node => !node.closest('.plugin-dialog-wrap') && (node.readOnly || node.hasAttribute('readonly')));
    if (!(input instanceof HTMLInputElement) || input.disabled || !shown(input))
      return unknownControl(item, 'picker_trigger_structure_unknown');
    const panels = [...item.querySelectorAll('.dialog-wrap.plugin-dialog-wrap, .plugin-dialog-wrap')]
      .filter(node => node.closest('.el-form-item') === item && node.querySelector('.eo-cascader-panel'));
    if (panels.length > 1) return unknownControl(item, 'picker_trigger_structure_unknown');
    return { item, trigger, input, panel: panels[0] || null, controls: [input], unsupported: false };
  }
  function cascaderTarget(form, field) {
    const item = requireItem(form, field.question);
    const fail = () => unknownControl(item, 'cascader_structure_unknown');
    const wraps = [...item.querySelectorAll('.el-form-item__content.cascader-wrap')].filter(node => node.closest('.el-form-item') === item);
    if (wraps.length !== 1) return fail();
    const wrap = wraps[0];
    const triggers = [...wrap.querySelectorAll(':scope > div.input-l.pointer')].filter(shown);
    const panels = [...wrap.querySelectorAll(':scope > div.dialog-wrap.plugin-dialog-wrap.popover.blue')];
    if (triggers.length !== 1 || panels.length !== 1) return fail();
    const panel = panels[0];
    const inputs = [...triggers[0].querySelectorAll('input.el-input__inner')].filter(node => !panel.contains(node));
    const search = [...panel.querySelectorAll('input.search-input')];
    const menus = [...panel.querySelectorAll(':scope > div.eo-cascader-panel > div.eo-cascader-menu.simple-tree-outer')];
    if (inputs.length !== 1 || !(inputs[0] instanceof HTMLInputElement) || inputs[0].type !== 'text'
      || !inputs[0].readOnly || inputs[0].disabled || !shown(inputs[0])
      || search.length !== 1 || search[0].getAttribute('placeholder') !== '请输入关键字'
      || menus.length < 1 || menus.length > 2
      || panel.querySelectorAll('.selected-view-data').length !== 1
      || panel.querySelectorAll('.selected-counter').length !== 1
      || panel.querySelectorAll('.pop-foot a.confirm.pop-btn').length !== 1
      || panel.querySelectorAll('.pop-foot a.cancel.pop-btn').length !== 1)
      return fail();
    return {
      item, wrap, panel, trigger: triggers[0], input: inputs[0], controls: inputs, unsupported: false,
      read: () => norm(inputs[0].value)
    };
  }
  function targetOf(form, field) {
    if (field.kind === 'monthRange') return monthRangeTarget(form, field);
    if (field.kind === 'picker') return pickerTarget(form, field);
    if (field.kind === 'cascader') return cascaderTarget(form, field);
    if (field.kind === 'unsupported') return unsupportedTarget(form, field);
    if (field.kind === 'select') return selectTarget(form, field);
    if (field.kind === 'radio') return radioTarget(form, field);
    const target = plainControl(requireItem(form, field.question), field.kind);
    if (field.placeholder && target.input.getAttribute('placeholder') !== field.placeholder) stop('rank_placeholder_changed');
    return target;
  }
  function shapeOk(field, answer) {
    if (typeof answer !== 'string') return false;
    if (field.kind === 'unsupported') return answer.trim() !== '';
    if (!answer.trim()) return false;
    if (answer.length > field.max) return false;
    const controls = field.kind === 'textarea' ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u : /[\u0000-\u001f]/u;
    if (controls.test(answer)) return false;
    if (field.kind === 'select') return field.answers.includes(answer);
    if (field.kind === 'radio') return field.answers.includes(answer);
    return true;
  }
  const MONTH_VALUE = /^(19|20)\d{2}-(0[1-9]|1[0-2])$/u;
  function collectionName(spec) {
    if (spec?.fact === 'experience') return 'experience';
    if (spec?.fact === 'education') return 'education';
    return '';
  }
  function recordRow(spec, request) {
    const name = collectionName(spec);
    if (!name) return null;
    const row = request?.profile?.[name]?.[request.profileIndex];
    return row && typeof row === 'object' ? row : null;
  }
  function confirmedPaths(request) {
    const profile = request?.profile;
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return null;
    return new Set(Array.isArray(profile.confirmedFields) ? profile.confirmedFields : []);
  }
  function categoryParts(answer) {
    const text = String(answer ?? '');
    if (!text.trim() || /[\u0000-\u001f]/u.test(text)) return null;
    if (!text.includes('||')) {
      if (text !== text.trim() || text.includes('|')) return null;
      return { mode: 'single', l1: '', l2: '', leaf: text };
    }
    const parts = text.split('||');
    if (parts.length !== 2) return null;
    const [l1, l2] = parts;
    if (!l1 || !l2 || l1 !== l1.trim() || l2 !== l2.trim() || l1.includes('|') || l2.includes('|')) return null;
    return { mode: 'path', l1, l2, leaf: l2 };
  }
  function monthFact(spec, request, field) {
    const row = recordRow(spec, request);
    const start = typeof row?.startDate === 'string' ? row.startDate : '';
    const end = typeof row?.endDate === 'string' ? row.endDate : '';
    const blank = { value: '', start: '', end: '', leaf: '', parts: null };
    if (!start.trim() && !end.trim()) {
      if (field.required) return { ...blank, reason: 'missing_profile_value', skip: false };
      return { ...blank, reason: null, skip: true };
    }
    if (!MONTH_VALUE.test(start) || !MONTH_VALUE.test(end) || start > end || start.length > field.max || end.length > field.max)
      return { ...blank, value: `${start}|${end}`, start, end, reason: 'invalid_profile_value', skip: false };
    const confirmed = confirmedPaths(request);
    const index = request.profileIndex;
    const prefix = collectionName(spec);
    if (!confirmed || !confirmed.has(`${prefix}.${index}.startDate`) || !confirmed.has(`${prefix}.${index}.endDate`))
      return { ...blank, value: `${start} | ${end}`, start, end, reason: 'profile_fact_unconfirmed', skip: false };
    return { ...blank, value: `${start} | ${end}`, start, end, reason: null, skip: false };
  }
  function pickerFact(spec, request, field) {
    const answer = readAnswer(spec, request, field);
    const blank = { value: answer, start: '', end: '', leaf: '', parts: null };
    if (!answer.trim()) {
      if (field.required) return { ...blank, value: '', reason: 'missing_profile_value', skip: false };
      return { ...blank, value: '', reason: null, skip: true };
    }
    const parts = categoryParts(answer);
    if (!parts || answer.length > field.max) return { ...blank, reason: 'invalid_profile_value', skip: false };
    if (!factConfirmed(spec, request, field, answer)) return { ...blank, ...parts, reason: 'profile_fact_unconfirmed', skip: false };
    return { ...blank, ...parts, reason: null, skip: false };
  }
  function factRow(spec, request, field) {
    if (field.kind === 'monthRange') return monthFact(spec, request, field);
    if (field.kind === 'picker' || field.kind === 'cascader') return pickerFact(spec, request, field);
    if (field.kind === 'unsupported') {
      const present = unsupportedAnswer(spec, request, field);
      if (!present) return { value: '', reason: null, skip: true };
      return { value: present, reason: 'control_not_supported', skip: false };
    }
    const answer = readAnswer(spec, request, field);
    if (typeof answer !== 'string' || !answer.trim()) {
      if (!field.required) return { value: '', reason: null, skip: true };
      return { value: '', reason: 'missing_profile_value', skip: false };
    }
    if (answer.length > field.max) return { value: answer, reason: 'value_too_long', skip: false };
    if (!shapeOk(field, answer)) return { value: answer, reason: 'invalid_profile_value', skip: false };
    if (!factConfirmed(spec, request, field, answer)) return { value: answer, reason: 'profile_fact_unconfirmed', skip: false };
    return { value: answer, reason: null, skip: false };
  }
  function readAnswer(spec, request, field) {
    if (spec.fact === 'education' || spec.fact === 'experience') {
      const raw = recordRow(spec, request)?.[field.key];
      return typeof raw === 'string' ? raw : '';
    }
    const profile = request?.profile;
    const raw = profile && typeof profile === 'object' && !Array.isArray(profile)
      ? profile.customAnswers?.[field.question]
      : request?.answers?.[field.question];
    return typeof raw === 'string' ? raw : '';
  }
  function unsupportedAnswer(spec, request, field) {
    if (spec.fact !== 'education' && spec.fact !== 'experience') return '';
    const row = recordRow(spec, request);
    const keys = field.keys || [field.key];
    const values = keys.map(key => (typeof row?.[key] === 'string' ? row[key].trim() : '')).filter(Boolean);
    return values.join('|');
  }
  function factConfirmed(spec, request, field, answer) {
    const profile = request?.profile;
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return false;
    const confirmed = new Set(Array.isArray(profile.confirmedFields) ? profile.confirmedFields : []);
    const prefix = collectionName(spec);
    if (prefix) return confirmed.has(`${prefix}.${request.profileIndex}.${field.key}`);
    const facts = (Array.isArray(profile.customFacts) ? profile.customFacts : []).filter(item => item?.question === field.question);
    const fact = facts.length === 1 ? facts[0] : null;
    return !!fact && fact.answer === answer && fact.sitePageUrl === PAGE
      && fact.sectionName === spec.section && fact.rowContext === 'none'
      && confirmed.has(`customAnswers.${field.question}`);
  }
  function fieldRow(spec, field, status, reason, index) {
    const prefix = collectionName(spec);
    const path = prefix
      ? `${prefix}.${index}.${field.key}`
      : `customAnswers.${field.question}`;
    return {
      id: `gth:${spec.section}:${field.question}`, question: field.question, labels: [field.question],
      path, status, reason, supported: field.kind !== 'unsupported'
    };
  }
  function valueRows(root) {
    return [...root.querySelectorAll('input,select,textarea')].map(node => [
      node.tagName, node.type || '', node.value || '', !!node.checked, node.selectedIndex ?? null,
      [...(node.files || [])].map(file => [file.name, file.size, file.type])]);
  }
  const snapshot = root => JSON.stringify([root.textContent || '', valueRows(root)]);
  function page(spec) {
    if (location.href !== PAGE) stop('wrong_page');
    if (document.readyState !== 'complete') stop('page_not_ready');
    if (document.visibilityState !== 'visible') stop('page_hidden');
    const sections = [...document.querySelectorAll('.r-section')];
    const titles = sections.map(section => {
      const node = section.querySelector('.title_')?.cloneNode(true);
      node?.querySelectorAll('a,button').forEach(child => child.remove());
      return norm(node?.textContent);
    });
    if (JSON.stringify(titles) !== JSON.stringify(TITLES)) stop('section_structure_changed');
    if (!sections[spec.sectionIndex]) stop('section_structure_changed');
    return sections;
  }
  function openForm(sections, spec) {
    const section = sections[spec.sectionIndex];
    const forms = [...section.querySelectorAll('form.el-form.sec-form')];
    const any = [...section.querySelectorAll('form')];
    if (forms.length !== 1 || any.length !== 1 || any[0] !== forms[0]) stop(forms.length > 1 || any.length > 1 ? 'editor_not_unique' : 'editor_not_open');
    const titleEdits = [...section.querySelectorAll('.title_ a.h-e-btn')].filter(node => norm(node.textContent) === '编辑');
    if (titleEdits.length) stop('editor_structure_changed');
    const buttons = [...forms[0].querySelectorAll('button')].filter(visible);
    const names = buttons.map(node => norm(node.textContent));
    if (buttons.length !== 2 || new Set(names).size !== 2 || !names.includes('取消') || !names.includes('保存'))
      stop('editor_structure_changed');
    return forms[0];
  }
  function otherForms(sections, spec) {
    return sections.flatMap((section, index) => index === spec.sectionIndex ? [] : [...section.querySelectorAll('form')]);
  }
  const outside = (sections, spec) => JSON.stringify(sections.filter((_, index) => index !== spec.sectionIndex).map(snapshot));
  const valuesExcept = (form, excluded) => JSON.stringify(
    [...form.querySelectorAll('input,select,textarea')].filter(node => !excluded.includes(node)).map(node => [
      node.tagName, node.type || '', node.value || '', !!node.checked, node.selectedIndex ?? null]));

  function install(spec) {
    const prior = installed.get(spec.messageType);
    if (prior?.listener) {
      try { chrome.runtime.onMessage.removeListener(prior.listener); } catch { /* reload */ }
    }
    const state = { busy: false, last: null, progress: null };
    let activeBinding = null, lastBinding = null;
    async function checkBinding(binding = activeBinding) {
      if (binding?.version !== 1 || typeof binding.epoch !== 'string' || !(/^[a-f0-9]{64}$/u.test(binding.profileHash || ''))) stop('profile_binding_required');
      let response;
      try { response = await chrome.runtime.sendMessage({ type: 'RESUME_PROFILE_BINDING_CHECK', profileBinding: binding }); } catch { /* unavailable */ }
      if (response?.allowed !== true) stop('profile_binding_changed');
    }
    async function boundAction(action) {
      await checkBinding();
      if (location.href !== PAGE || document.visibilityState !== 'visible') stop('profile_action_page_changed');
      return action();
    }
    const step = value => { if (state.progress) state.progress.selectorStep = value; };
    async function fillSelect(target, field, answer, replaceExisting, markWrite, guard) {
      const { input, widget } = target;
      const existing = input.value;
      if (norm(existing) === answer) return { status: 'verified', reason: 'preexisting_same_value' };
      if (existing !== '' && replaceExisting !== true) return { status: 'failed', reason: 'existing_value' };
      const openMenus = () => [...document.querySelectorAll('.el-select-dropdown.el-popper')].filter(shown);
      if (openMenus().length) stop('select_menu_not_unique');
      step('select_open');
      guard();
      await guardedClick(input, boundAction);
      const closeMenu = async () => {
        if (openMenus().length) {
          try { await guardedClick(input, boundAction); } catch { /* keep the select reason */ }
        }
      };
      const opened = await waitUntil(() => {
        const open = openMenus();
        if (open.length > 1) return { bad: 'select_menu_not_unique' };
        const resolved = resolveSelectMenu(widget, field.options);
        if (resolved.bad) return resolved;
        if (!resolved.menu || !shown(resolved.menu)) return null;
        if (open.length !== 1 || open[0] !== resolved.menu) return { bad: 'select_menu_not_unique' };
        const options = (resolved.options || []).filter(shown);
        if (!optionsMatch(resolved.menu, field.options) || options.length !== field.options.length) return { bad: 'select_structure_changed' };
        return { menu: resolved.menu, options };
      });
      if (!opened || opened.bad) { await closeMenu(); stop(opened?.bad || 'select_menu_not_unique'); }
      const matches = opened.options.filter(node => norm(node.textContent) === answer);
      if (matches.length !== 1) { await closeMenu(); stop(matches.length ? 'select_option_ambiguous' : 'select_option_missing'); }
      step('select_option');
      guard();
      markWrite();
      await guardedClick(matches[0], boundAction);
      const matched = await waitUntil(() => norm(input.value) === answer && !shown(opened.menu) ? true : null);
      if (!matched || !siteValid(target.item, input)) { await closeMenu(); stop('readback_mismatch'); }
      guard();
      return { status: 'verified', reason: existing === '' ? 'readback_matched' : 'readback_reapplied' };
    }
    async function fillRadio(target, answer, replaceExisting, markWrite, guard) {
      const existing = target.read();
      if (existing === answer) return { status: 'verified', reason: 'preexisting_same_value' };
      if (existing && replaceExisting !== true) return { status: 'failed', reason: 'existing_value' };
      const choice = target.options.find(option => option.text === answer);
      if (!choice) stop('radio_structure_changed');
      step('radio_label');
      guard();
      markWrite();
      await guardedClick(choice.label, boundAction);
      const matched = await waitUntil(() => target.read() === answer ? true : null);
      if (!matched || !siteValid(target.item, choice.control)) stop('radio_readback_mismatch');
      guard();
      return { status: 'verified', reason: existing ? 'readback_reapplied' : 'readback_matched' };
    }
    const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
    // Live work 任职时间 shares this writer with education 在校时间. Element-UI
    // teleports .el-picker-panel onto document.body, so the panel is not a child
    // of the .el-date-editor that opened it. Bind the panel that this click makes
    // pending or shown — never via closest(.el-date-editor).
    // A quiet-only purge is not enough. Live still reached month_option and then
    // readback_mismatch (the end input stayed empty), not control_not_supported:
    // settle had left the one quiet husk it keeps for a shared panel, the purge
    // detached that husk and believed the body was clear, and the end open put a
    // panel back. a.cell does not commit once a second panel has coexisted during
    // that open, even if the extra node is removed before the click.
    // Two date editors are a dual-editor session from the start, so settle never
    // keeps a husk. After start commits, dismiss and detach until zero
    // .el-picker-panel nodes are connected; if any remain, fail closed and do not
    // click end. If a quiet panel sits beside the pending end panel, do not click
    // a.cell — dismiss, return to zero panels, and reopen (capped). Education
    // reuses one panel; a fresh end open may show that node again after a full
    // detach. Start-then-end stays the order. A click while el-zoom-in-top-enter*
    // is applied does not commit.
    function monthPanelNodes() {
      return [...document.querySelectorAll('.el-picker-panel')].filter(node => node.isConnected);
    }
    function monthPanelAnimating(node) {
      if (!node?.classList) return false;
      for (const name of node.classList) {
        if (name.startsWith('el-zoom-in-top-enter') || name.startsWith('el-zoom-in-top-leave')) return true;
      }
      return false;
    }
    function monthPanelPending(node) {
      return !!node?.isConnected && (shown(node) || monthPanelAnimating(node));
    }
    function monthPanelReady(node) {
      return shown(node) && !monthPanelAnimating(node);
    }
    function openMonthPanels() {
      return monthPanelNodes().filter(monthPanelPending);
    }
    function monthPanelSnapshot() {
      return monthPanelNodes().map(panel => ({
        panel,
        pending: monthPanelPending(panel),
        shown: shown(panel),
      }));
    }
    // The panel this open click revealed. Fail closed when none or more than one
    // unrelated panel is pending — do not use DOM parent under .el-date-editor.
    function panelOpenedByClick(before) {
      const pending = openMonthPanels();
      if (pending.length > 1) return { bad: 'dual' };
      const prior = new Map(before.map(row => [row.panel, row]));
      const opened = monthPanelNodes().filter(panel => {
        const was = prior.get(panel);
        const nowShown = shown(panel);
        const becamePending = monthPanelPending(panel) && !was?.pending;
        const becameShown = nowShown && !was?.shown;
        const popperShown = panel.classList.contains('el-popper') && nowShown && !was?.shown;
        return becamePending || becameShown || popperShown;
      });
      if (pending.some(panel => !opened.includes(panel))) return { bad: 'dual' };
      if (opened.length > 1) return { bad: 'dual' };
      if (opened.length !== 1) return null;
      const panel = opened[0];
      if (pending.length === 1 && pending[0] !== panel) return { bad: 'dual' };
      if (!monthPanelReady(panel)) return null;
      return { panel };
    }
    async function dismissMonthInput(input) {
      try {
        await boundAction(() => {
          if (!input?.isConnected) return null;
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true }));
          input.blur();
          return null;
        });
      } catch { /* keep the month reason */ }
    }
    async function dismissMonthOutside() {
      try {
        await boundAction(() => {
          const root = document.documentElement;
          if (!root?.isConnected) return null;
          root.dispatchEvent(new Event('mousedown', { bubbles: true, cancelable: true }));
          root.dispatchEvent(new Event('mouseup', { bubbles: true, cancelable: true }));
          root.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
          return null;
        });
      } catch { /* keep the month reason */ }
    }
    async function dismissMonthSurfaces(inputs) {
      for (const input of inputs) await dismissMonthInput(input);
      await dismissMonthOutside();
    }
    function detachQuietMonthHusks(keep) {
      for (const node of monthPanelNodes()) {
        if (keep && node === keep) continue;
        if (monthPanelPending(node)) continue;
        if (node.parentNode) node.parentNode.removeChild(node);
      }
    }
    function quietMonthHusks() {
      return monthPanelNodes().filter(node => !monthPanelPending(node));
    }
    async function closeMonthPanel(input) {
      await dismissMonthInput(input);
    }
    function monthPanelSession(target) {
      const editors = target?.editors || [];
      const distinctPanels = editors.length === 2 && !!editors[0] && editors[0] !== editors[1];
      return { distinctPanels, seen: new Set() };
    }
    // Dismiss, then detach every non-pending panel. A husk removed in this turn
    // can be put back on the next tick, so retry a few times with a short pause.
    // Success is zero connected .el-picker-panel nodes, not merely zero quiet ones.
    async function clearConnectedMonthPanels(inputs) {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        if (monthPanelNodes().length === 0) return true;
        await dismissMonthSurfaces(inputs);
        detachQuietMonthHusks(null);
        await pause(40);
      }
      return monthPanelNodes().length === 0;
    }
    // A reused single panel may stay while it is the only node. Two date editors
    // set distinctPanels up front so this never intentionally keeps that husk.
    async function settleMonthPanels(inputs, session) {
      if (session?.distinctPanels) {
        const cleared = await clearConnectedMonthPanels(inputs);
        if (!cleared) {
          step('month_panel_structure_unknown');
          stop('control_not_supported');
        }
        return;
      }
      for (let attempt = 0; attempt < 4; attempt += 1) {
        if (openMonthPanels().length === 0 && monthPanelNodes().length === 0) return;
        await dismissMonthSurfaces(inputs);
        const quiet = quietMonthHusks();
        if (openMonthPanels().length === 0 && quiet.length > 1) detachQuietMonthHusks(null);
        await pause(0);
        if (openMonthPanels().length === 0 && monthPanelNodes().length === 0) return;
        if (openMonthPanels().length === 0 && monthPanelNodes().length <= 1) return;
        await pause(40);
      }
      if (openMonthPanels().length || monthPanelNodes().length > 1) {
        step('month_panel_structure_unknown');
        stop('control_not_supported');
      }
    }
    // One open attempt. A quiet sibling means this open is poisoned: the caller
    // must clear to zero panels and open again, and must not click a.cell on it.
    // A second pending panel is ambiguous and fails closed.
    async function bindOpenedMonthPanel(trigger, company, session) {
      if (session?.distinctPanels) {
        const cleared = await clearConnectedMonthPanels(company);
        if (!cleared) {
          step('month_panel_structure_unknown');
          stop('control_not_supported');
        }
      } else {
        await settleMonthPanels(company, session);
      }
      const beforeOpen = monthPanelSnapshot();
      await guardedClick(trigger, boundAction);
      const opened = await waitUntil(() => {
        const found = panelOpenedByClick(beforeOpen);
        if (found?.bad) return found;
        if (quietMonthHusks().length) return { quiet: true };
        return found;
      }, 1600);
      if (opened?.quiet) return { quiet: true };
      if (!opened || opened.bad) {
        step('month_panel_structure_unknown');
        await dismissMonthSurfaces(company);
        stop('control_not_supported');
      }
      const panel = opened.panel;
      session.seen.add(panel);
      if (session.seen.size > 1) session.distinctPanels = true;
      const siblings = monthPanelNodes().filter(node => node !== panel);
      const otherAtOpen = beforeOpen.filter(row => row.panel !== panel);
      if (siblings.some(monthPanelPending) || otherAtOpen.some(row => row.pending)) {
        step('month_panel_structure_unknown');
        await dismissMonthSurfaces(company);
        stop('control_not_supported');
      }
      if (otherAtOpen.length || siblings.length || quietMonthHusks().length) return { quiet: true, panel };
      if (!monthPanelReady(panel) || !panel.isConnected) {
        step('month_panel_structure_unknown');
        await dismissMonthSurfaces(company);
        stop('control_not_supported');
      }
      if (session?.distinctPanels && monthPanelNodes().length !== 1) return { quiet: true, panel };
      return { panel };
    }
    async function dispatchInputChange(input) {
      await boundAction(() => {
        if (!input?.isConnected) stop('profile_action_target_changed');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return null;
      });
    }
    function monthCellDisabled(cell) {
      if (!cell?.classList) return true;
      if (cell.classList.contains('disabled')) return true;
      return [...cell.querySelectorAll('a')].some(node => node.classList.contains('disabled'));
    }
    function monthClickTarget(cell, panel) {
      const anchors = [...cell.querySelectorAll('a.cell')].filter(node => panel.contains(node) && shown(node));
      return anchors.length === 1 ? anchors[0] : null;
    }
    async function fillOneMonth(item, input, trigger, answer, markWrite, guard, peers = [], session = monthPanelSession()) {
      const company = [input, ...peers].filter(Boolean);
      if (norm(input.value) === answer) {
        if (openMonthPanels().length) await settleMonthPanels(company, session);
        return;
      }
      const peerBefore = peers.map(peer => norm(peer.value));
      const drifted = () => peers.some((peer, index) => norm(peer.value) !== peerBefore[index]);
      const retryQuiet = async () => {
        const cleared = await clearConnectedMonthPanels(company);
        if (!cleared) {
          step('month_panel_structure_unknown');
          stop('control_not_supported');
        }
      };
      for (let openAttempt = 0; openAttempt < 4; openAttempt += 1) {
        step('month_open');
        guard();
        const opened = await bindOpenedMonthPanel(trigger, company, session);
        if (opened?.quiet) {
          await retryQuiet();
          continue;
        }
        const panel = opened.panel;
        const failStructure = async () => {
          step('month_panel_structure_unknown');
          await dismissMonthSurfaces(company);
          stop('control_not_supported');
        };
        const siblingPanel = () => monthPanelNodes().some(node => node !== panel);
        const quietBeside = () => quietMonthHusks().length > 0 || siblingPanel();
        let poisoned = false;
        const noteQuiet = () => { if (quietBeside()) poisoned = true; };
        try {
          await pause(40);
          noteQuiet();
          if (poisoned) {
            await retryQuiet();
            continue;
          }
          if (!monthPanelReady(panel)) await failStructure();
          const year = Number(answer.slice(0, 4));
          const month = Number(answer.slice(5));
          const readYear = () => {
            if (!panel.isConnected || siblingPanel()) return null;
            const years = [...panel.querySelectorAll('.el-date-picker__header-label')].filter(shown)
              .map(node => norm(node.textContent).match(/^(\d{4})\s*年$/u)).filter(Boolean);
            if (years.length !== 1) return null;
            return Number(years[0][1]);
          };
          if (quietBeside()) {
            await retryQuiet();
            continue;
          }
          if (readYear() == null || drifted()) await failStructure();
          for (let count = 0; readYear() !== year; count += 1) {
            noteQuiet();
            if (poisoned) break;
            if (count >= 100 || readYear() == null || drifted()) await failStructure();
            guard();
            const current = readYear();
            const previous = current > year;
            const buttons = [...panel.querySelectorAll(previous ? '.el-icon-d-arrow-left' : '.el-icon-d-arrow-right')].filter(node => panel.contains(node) && shown(node));
            if (buttons.length !== 1) await failStructure();
            await guardedClick(buttons[0], boundAction);
            const moved = await waitUntil(() => {
              if (quietBeside()) return { quiet: true };
              if (drifted()) return { drift: true };
              const next = readYear();
              if (next == null) return null;
              const delta = next - current;
              const expect = previous ? -1 : 1;
              if (delta === expect) return { ok: true };
              if (delta !== 0) return { drift: true };
              return null;
            }, 1500);
            if (moved?.quiet) {
              poisoned = true;
              break;
            }
            if (!moved || moved.drift) await failStructure();
          }
          if (poisoned || quietBeside()) {
            await retryQuiet();
            continue;
          }
          if (readYear() !== year || drifted()) await failStructure();
          const tables = [...panel.querySelectorAll('.el-month-table')].filter(node => panel.contains(node) && shown(node));
          if (tables.length !== 1) await failStructure();
          const cells = [...tables[0].querySelectorAll('td')].filter(node => panel.contains(node) && shown(node));
          const choices = cells.filter(node => {
            const text = norm(node.textContent).replace(/\s/gu, '');
            return text === MONTH_NAMES[month - 1] || text === `${month}月`;
          });
          if (cells.length !== 12 || choices.length !== 1 || monthCellDisabled(choices[0])) await failStructure();
          const clickTarget = monthClickTarget(choices[0], panel);
          if (!clickTarget || !panel.contains(clickTarget) || clickTarget.tagName !== 'A') await failStructure();
          // A quiet sibling during this open poisons a.cell. Do not detach it
          // and click anyway — dismiss, return to zero panels, and reopen.
          if (quietBeside() || !panel.isConnected || !monthPanelReady(panel)) {
            if (quietBeside()) {
              await retryQuiet();
              continue;
            }
            await failStructure();
          }
          step('month_option');
          guard();
          markWrite();
          await guardedClick(clickTarget, boundAction);
          const matched = await waitUntil(() => {
            if (siblingPanel() || drifted()) return { bad: 'dual' };
            const current = norm(input.value);
            if (current && current !== answer) return { bad: 'mismatch' };
            if (!current) return null;
            if (current === answer && !monthPanelPending(panel)) return { ok: true };
            return null;
          });
          if (!matched || matched.bad || norm(input.value) !== answer) {
            await dismissMonthSurfaces(company);
            stop(matched?.bad === 'dual' ? 'control_not_supported' : 'readback_mismatch');
          }
          await dispatchInputChange(input);
          if (norm(input.value) !== answer || monthPanelPending(panel) || siblingPanel() || drifted() || !siteValid(item, input))
            stop('readback_mismatch');
          guard();
          return;
        } catch (error) {
          if (monthPanelPending(panel)) await closeMonthPanel(input);
          throw error;
        }
      }
      step('month_panel_structure_unknown');
      await dismissMonthSurfaces(company);
      stop('control_not_supported');
    }
    // Start has committed. Require zero connected picker panels before the first
    // end-editor click. Quiet-only was the live miss: the purge reported no quiet
    // husk, then end a.cell still left the input empty (readback_mismatch).
    async function purgeQuietMonthHusksBeforeEnd(inputs, session) {
      if (session) session.distinctPanels = true;
      const cleared = await clearConnectedMonthPanels(inputs);
      if (!cleared || monthPanelNodes().length !== 0) {
        step('month_panel_structure_unknown');
        await dismissMonthSurfaces(inputs);
        stop('control_not_supported');
      }
    }
    async function fillMonthRange(target, fact, markWrite, guard) {
      const before = target.inputs.map(node => norm(node.value));
      const session = monthPanelSession(target);
      const inputs = [target.inputs[0], target.inputs[1]];
      await fillOneMonth(target.item, target.inputs[0], target.triggers[0], fact.start, markWrite, guard, [target.inputs[1]], session);
      if (norm(target.inputs[0].value) !== fact.start || norm(target.inputs[1].value) !== before[1])
        stop('readback_mismatch');
      if (norm(target.inputs[1].value) !== fact.end)
        await purgeQuietMonthHusksBeforeEnd(inputs, session);
      await fillOneMonth(target.item, target.inputs[1], target.triggers[1], fact.end, markWrite, guard, [target.inputs[0]], session);
      const read = `${norm(target.inputs[0].value)} | ${norm(target.inputs[1].value)}`;
      if (read !== `${fact.start} | ${fact.end}`) stop('readback_mismatch');
      return { status: 'verified', reason: before.some(value => value !== '') ? 'readback_reapplied' : 'readback_matched' };
    }
    function pickerPanels(item) {
      return [...item.querySelectorAll('.dialog-wrap.plugin-dialog-wrap, .plugin-dialog-wrap')]
        .filter(node => node.closest('.el-form-item') === item && node.querySelector('.eo-cascader-panel'));
    }
    function cascaderMenus(panel) {
      const roots = [...panel.querySelectorAll('.eo-cascader-panel')].filter(node => panel.contains(node));
      if (roots.length !== 1) return null;
      return [...roots[0].querySelectorAll(':scope > .eo-cascader-menu.simple-tree-outer')];
    }
    function menuBranches(menu) {
      if (!menu) return [];
      const lists = [...menu.children].filter(node => node.tagName === 'UL' && node.classList.contains('simple-tree-wrapper'));
      const rows = [];
      for (const list of lists) {
        for (const li of list.children) {
          if (li.tagName === 'LI' && li.classList.contains('branch')) rows.push(li);
        }
      }
      return rows;
    }
    function branchSpan(row) {
      return [...row.children].find(node => node.tagName === 'SPAN') || null;
    }
    function branchLabel(row) {
      return [...row.children].find(node => node.tagName === 'LABEL') || null;
    }
    function branchText(row) {
      const label = branchLabel(row);
      if (label) return norm(label.textContent);
      const span = branchSpan(row);
      return norm(span ? span.textContent : row.textContent);
    }
    function pickerCounter(panel) {
      const nodes = [...panel.querySelectorAll('.selected-counter > p')];
      if (nodes.length !== 1) return null;
      const match = norm(nodes[0].textContent).match(/^[（(](\d+)\/(\d+)[）)]$/u);
      if (!match) return null;
      const current = Number(match[1]);
      const max = Number(match[2]);
      if (!Number.isInteger(current) || !Number.isInteger(max) || max < 1 || current < 0) return null;
      return { current, max };
    }
    function pickerChips(panel) {
      const lists = [...panel.querySelectorAll('.selected-view-data')].filter(node => panel.contains(node));
      if (!lists.length) return [];
      if (lists.length !== 1) return null;
      const entries = [];
      for (const li of lists[0].querySelectorAll(':scope > li')) {
        const texts = [...li.children].filter(node => node.tagName === 'P');
        const icons = [...li.children].filter(node => node.tagName === 'I');
        if (texts.length !== 1 || icons.length !== 1 || li.querySelectorAll('i').length !== 1) return null;
        entries.push({ li, text: norm(texts[0].textContent), remove: icons[0] });
      }
      return entries;
    }
    function footHidden(panel) {
      const feet = [...panel.querySelectorAll(':scope > .pop-foot, .pop-foot')].filter(node => panel.contains(node));
      return feet.length === 1 && !shown(feet[0]);
    }
    function visibleConfirms(panel) {
      return [...panel.querySelectorAll('a.confirm.pop-btn')].filter(node => panel.contains(node) && shown(node) && norm(node.textContent) === '确定');
    }
    async function clickPickerCancel(panel) {
      const nodes = [...panel.querySelectorAll('a.cancel.pop-btn')].filter(node => panel.contains(node) && norm(node.textContent) === '取消');
      if (nodes.length !== 1 || !nodes[0].isConnected) stop('control_not_supported');
      await guardedClick(nodes[0], boundAction);
    }
    async function fillPicker(target, fact, replaceExisting, markWrite, guard) {
      const { item, trigger, input } = target;
      const leaf = fact.leaf;
      let opened = false;
      let panel = target.panel;
      const abort = async code => {
        if (opened && panel) {
          opened = false;
          try { await clickPickerCancel(panel); } catch { /* keep the picker reason */ }
        }
        stop(code);
      };
      step('picker_open');
      const already = pickerPanels(item).filter(shown);
      if (already.length) await abort('control_not_supported');
      guard();
      await guardedClick(trigger, boundAction);
      opened = true;
      const found = await waitUntil(() => {
        const open = pickerPanels(item).filter(shown);
        if (open.length > 1) return { bad: 'picker_panel_not_unique' };
        if (open.length === 1) return { panel: open[0] };
        return null;
      });
      if (!found) {
        step('picker_trigger_structure_unknown');
        opened = false;
        stop('control_not_supported');
      }
      if (found.bad) await abort('control_not_supported');
      panel = found.panel;
      if (!cascaderMenus(panel)) {
        step('picker_trigger_structure_unknown');
        await abort('control_not_supported');
      }
      guard();
      const singleSelect = () => footHidden(panel) || pickerCounter(panel)?.max === 1 || visibleConfirms(panel).length === 0;
      let chips = pickerChips(panel);
      if (chips === null) {
        step('picker_trigger_structure_unknown');
        await abort('control_not_supported');
      }
      if (norm(input.value) === leaf && (chips.length === 0 || (chips.length === 1 && chips[0].text === leaf))) {
        await clickPickerCancel(panel);
        opened = false;
        if (norm(input.value) !== leaf || shown(panel)) stop('readback_mismatch');
        return { status: 'verified', reason: 'preexisting_same_value' };
      }
      const occupied = chips.length > 0 || norm(input.value) !== '';
      if (occupied && replaceExisting !== true) await abort('existing_value');
      if (occupied && replaceExisting === true && chips.some(entry => entry.text !== leaf) && !singleSelect()) {
        while (chips.some(entry => entry.text !== leaf)) {
          const entry = chips.find(row => row.text !== leaf);
          if (!entry?.remove?.isConnected) await abort('control_not_supported');
          const beforeCount = chips.length;
          guard();
          markWrite();
          await guardedClick(entry.remove, boundAction);
          const next = await waitUntil(() => {
            const now = pickerChips(panel);
            if (now === null) return { bad: true };
            return now.length === beforeCount - 1 ? now : null;
          });
          if (!next || next.bad) await abort('control_not_supported');
          chips = next;
        }
      }
      if (fact.mode === 'path') {
        step('picker_level1');
        const menus = cascaderMenus(panel);
        const level1 = menuBranches(menus?.[0]).filter(row => shown(row) && row.classList.contains('has-child'));
        const matches = level1.filter(row => norm(branchSpan(row)?.textContent) === fact.l1);
        if (matches.length !== 1) await abort(matches.length ? 'picker_level1_ambiguous' : 'picker_level1_missing');
        const span = branchSpan(matches[0]);
        if (!span || norm(span.textContent) !== fact.l1) await abort('picker_level1_missing');
        guard();
        await guardedClick(span, boundAction);
        step('picker_level2');
        let sawL2 = false;
        const level2 = await waitUntil(() => {
          guard();
          const liveMenus = cascaderMenus(panel);
          if (!liveMenus || liveMenus.length > 2) return { bad: 'control_not_supported' };
          if (liveMenus.length !== 2) return null;
          sawL2 = true;
          const rows = menuBranches(liveMenus[1]).filter(row => shown(row) && !row.classList.contains('has-child') && branchText(row) === fact.l2);
          if (rows.length > 1) return { bad: 'picker_level2_ambiguous' };
          return rows.length === 1 ? { row: rows[0] } : null;
        });
        if (level2?.bad) await abort(level2.bad === 'control_not_supported' ? 'control_not_supported' : level2.bad);
        if (!level2?.row) await abort(sawL2 ? 'picker_level2_missing' : 'picker_level2_menu_missing');
        await commitPickerRow(panel, level2.row, leaf, input, item, singleSelect(), markWrite, guard, abort);
      } else {
        step('picker_single');
        const menus = cascaderMenus(panel);
        const leaves = menuBranches(menus?.[0]).filter(row => shown(row) && !row.classList.contains('has-child') && branchText(row) === leaf);
        if (leaves.length !== 1) {
          step('picker_trigger_structure_unknown');
          await abort('control_not_supported');
        }
        await commitPickerRow(panel, leaves[0], leaf, input, item, true, markWrite, guard, abort);
      }
      opened = false;
      guard();
      const wrote = norm(target.input.value) === leaf;
      if (!wrote || shown(panel) || !siteValid(item, input)) stop('readback_mismatch');
      return { status: 'verified', reason: occupied ? 'readback_reapplied' : 'readback_matched' };
    }
    async function commitPickerRow(panel, row, leaf, input, item, single, markWrite, guard, abort) {
      const checkbox = [...row.querySelectorAll('input[type="checkbox"]')].find(node => row.contains(node)) || null;
      const clickable = (() => {
        const label = branchLabel(row);
        const span = branchSpan(row);
        if (label && norm(label.textContent) === leaf) return label;
        if (span && norm(span.textContent) === leaf) return span;
        return norm(row.textContent) === leaf ? row : null;
      })();
      if (!single && checkbox instanceof HTMLInputElement && visibleConfirms(panel).length) {
        if (!checkbox.checked) {
          guard();
          markWrite();
          await guardedClick(checkbox, boundAction);
        }
        const confirms = visibleConfirms(panel);
        if (confirms.length !== 1) await abort('control_not_supported');
        step('picker_confirm');
        guard();
        markWrite();
        await guardedClick(confirms[0], boundAction);
      } else {
        if (!clickable) await abort('control_not_supported');
        guard();
        markWrite();
        await guardedClick(clickable, boundAction);
        if (shown(panel)) {
          const confirms = visibleConfirms(panel);
          if (confirms.length !== 1) await abort('control_not_supported');
          step('picker_confirm');
          guard();
          markWrite();
          await guardedClick(confirms[0], boundAction);
        }
      }
      const matched = await waitUntil(() => norm(input.value) === leaf && !shown(panel) ? true : null);
      if (!matched || !siteValid(item, input)) await abort('readback_mismatch');
      await dispatchInputChange(input);
      if (norm(input.value) !== leaf || shown(panel)) await abort('readback_mismatch');
    }
    function strictMenus(panel) {
      return [...panel.querySelectorAll(':scope > div.eo-cascader-panel > div.eo-cascader-menu.simple-tree-outer')];
    }
    function visibleCascaderPanels() {
      return [...document.querySelectorAll('div.dialog-wrap.plugin-dialog-wrap.popover.blue')].filter(shown);
    }
    function cascaderDecision(target, fact, replaceExisting) {
      const existing = norm(target.input.value);
      const chips = pickerChips(target.panel);
      if (chips === null) return { action: 'fail', reason: 'control_not_supported', step: 'cascader_structure_unknown' };
      const texts = chips.map(entry => entry.text);
      if (texts.length === 1 && texts[0] === fact.leaf && existing === fact.leaf) return { action: 'same', existing };
      if ((texts.length > 0 || existing !== '') && replaceExisting !== true) return { action: 'fail', reason: 'existing_value', existing };
      return { action: 'fill', existing };
    }
    async function fillCascader(target, fact, replaceExisting, markWrite, guard) {
      const { item, panel, trigger, input } = target;
      const leaf = fact.leaf;
      let opened = false;
      const abort = async code => {
        if (opened) {
          opened = false;
          try { await clickPickerCancel(panel); } catch { /* keep the cascader reason */ }
        }
        stop(code);
      };
      step('picker_open');
      if (visibleCascaderPanels().length) stop('control_not_supported');
      guard();
      await guardedClick(trigger, boundAction);
      opened = true;
      const openedPanel = await waitUntil(() => {
        const open = visibleCascaderPanels();
        if (open.length > 1) return { bad: 'control_not_supported' };
        if (open.length === 1) return open[0] === panel ? { ok: true } : { bad: 'control_not_supported' };
        return null;
      });
      if (!openedPanel) {
        step('cascader_structure_unknown');
        opened = false;
        stop('control_not_supported');
      }
      if (openedPanel.bad) await abort('control_not_supported');
      guard();
      let chips = pickerChips(panel);
      if (chips === null) {
        step('cascader_structure_unknown');
        await abort('control_not_supported');
      }
      const singleSelect = () => footHidden(panel) || pickerCounter(panel)?.max === 1;
      if (chips.length === 1 && chips[0].text === leaf && norm(input.value) === leaf) {
        await clickPickerCancel(panel);
        opened = false;
        if (norm(input.value) !== leaf || shown(panel)) stop('readback_mismatch');
        return { status: 'verified', reason: 'preexisting_same_value' };
      }
      const occupied = chips.length > 0 || norm(input.value) !== '';
      if (occupied && replaceExisting !== true) await abort('existing_value');
      if (occupied && replaceExisting === true && chips.some(entry => entry.text !== leaf) && !singleSelect()) {
        while (chips.some(entry => entry.text !== leaf)) {
          const entry = chips.find(row => row.text !== leaf);
          if (!entry?.remove?.isConnected) await abort('control_not_supported');
          const beforeCount = chips.length;
          guard();
          markWrite();
          await guardedClick(entry.remove, boundAction);
          const next = await waitUntil(() => {
            const now = pickerChips(panel);
            if (now === null) return { bad: true };
            return now.length === beforeCount - 1 ? now : null;
          });
          if (!next || next.bad) await abort('control_not_supported');
          chips = next;
        }
      }
      step('picker_level1');
      const menus = strictMenus(panel);
      const level1 = menuBranches(menus?.[0]).filter(row => shown(row) && row.classList.contains('has-child'));
      const matches = level1.filter(row => norm(branchSpan(row)?.textContent) === fact.l1);
      if (matches.length !== 1) await abort(matches.length ? 'picker_level1_ambiguous' : 'picker_level1_missing');
      const span = branchSpan(matches[0]);
      if (!span || norm(span.textContent) !== fact.l1) await abort('picker_level1_missing');
      guard();
      await guardedClick(span, boundAction);
      step('picker_level2');
      let sawL2 = false;
      const level2 = await waitUntil(() => {
        guard();
        const liveMenus = strictMenus(panel);
        if (liveMenus.length > 2) return { bad: 'control_not_supported' };
        if (liveMenus.length !== 2) return null;
        sawL2 = true;
        const rows = menuBranches(liveMenus[1]).filter(row => shown(row) && !row.classList.contains('has-child') && branchText(row) === fact.l2);
        if (rows.length > 1) return { bad: 'picker_level2_ambiguous' };
        return rows.length === 1 ? { row: rows[0] } : null;
      });
      if (level2?.bad) await abort(level2.bad === 'control_not_supported' ? 'control_not_supported' : level2.bad);
      if (!level2?.row) await abort(sawL2 ? 'picker_level2_missing' : 'picker_level2_menu_missing');
      const counter = pickerCounter(panel);
      const single = singleSelect();
      if (!counter && !single) await abort('control_not_supported');
      if (!single && counter.current >= counter.max && !chips.some(entry => entry.text === leaf)) await abort('control_not_supported');
      await commitPickerRow(panel, level2.row, leaf, input, item, single, markWrite, guard, abort);
      opened = false;
      guard();
      if (norm(input.value) !== leaf || shown(panel) || !siteValid(item, input)) stop('readback_mismatch');
      return { status: 'verified', reason: occupied ? 'readback_reapplied' : 'readback_matched' };
    }
    async function trial(request) {
      try {
        const manifest = chrome.runtime.getManifest();
        if (manifest.background?.service_worker === 'src/license/guard-worker.mjs') {
          const verdict = await chrome.runtime.sendMessage({ type: 'RESUME_PAID_VERIFY' });
          if (verdict?.allowed !== true) throw new Stop('license_required');
        }
      } catch (error) {
        if (!(error instanceof Stop) || error.code === 'license_required') {
          const info = { reason: 'license_required', activeField: null, selectorStep: 'license_check', completedFields: [], writeStarted: false };
          if (!state.busy) state.last = { requestId: request?.requestId, outcome: 'failed_before_write', info };
          return baseResult(spec, request, { ok: false, ...info });
        }
      }
      const result = baseResult(spec, request, {});
      if (state.busy) return { ...result, ok: false, reason: 'fill_in_progress' };
      state.busy = true;
      activeBinding = request?.profileBinding;
      lastBinding = activeBinding;
      state.progress = { requestId: request?.requestId, activeField: null, selectorStep: 'request_validation', completedFields: [], writeStarted: false };
      const markWrite = () => { result.writeStarted = true; state.progress.writeStarted = true; };
      const record = (field, status, reason) => {
        const row = fieldRow(spec, field, status, reason, request?.profileIndex);
        const index = result.fields.findIndex(item => item.question === field.question);
        if (index >= 0) result.fields[index] = row; else result.fields.push(row);
        const covered = result.coverage.find(item => item.question === field.question);
        if (covered) Object.assign(covered, row);
        state.progress.completedFields = state.progress.completedFields.filter(item => item.question !== field.question);
        state.progress.completedFields.push({ question: field.question, status, reason });
      };
      let attempted = spec.fields;
      try {
        await checkBinding();
        if (typeof request?.requestId !== 'string' || !/^[A-Za-z0-9-]{10,100}$/u.test(request.requestId)
          || (request.replaceExisting !== undefined && typeof request.replaceExisting !== 'boolean')) stop('request_invalid');
        if ((spec.fact === 'education' || spec.fact === 'experience') && (!Number.isInteger(request.profileIndex) || request.profileIndex < 0 || request.profileIndex > 29))
          stop(spec.fact === 'education' ? 'education_profile_index_invalid' : 'experience_profile_index_invalid');
        const answers = Object.fromEntries(spec.fields.map(field => [field.question, factRow(spec, request, field)]));
        attempted = spec.fields.filter(field => !answers[field.question].skip);
        const unsettled = attempted.filter(field => answers[field.question].reason);
        if (unsettled.length) {
          for (const field of attempted) record(field, 'failed', answers[field.question].reason || 'blocked_by_unsettled_field');
          const info = { reason: answers[unsettled[0].question].reason, activeField: unsettled[0].question, selectorStep: 'field_decision',
            completedFields: state.progress.completedFields.map(item => ({ ...item })), writeStarted: false };
          state.last = { requestId: request.requestId, outcome: 'failed_before_write', info };
          return finish(spec, request, result, attempted, info);
        }
        step('page_preflight');
        let sections = page(spec);
        if (otherForms(sections, spec).length) stop('other_section_editor_open');
        const origin = performance.timeOrigin;
        const otherBefore = outside(sections, spec);
        const form = openForm(sections, spec);
        result.editorLeftOpen = true;
        const plans = [];
        for (const field of spec.fields) {
          state.progress.activeField = field.question;
          step('target_preflight');
          const answer = answers[field.question];
          const target = targetOf(form, field);
          if (target.unsupported) {
            const stepName = target.step || 'control_structure_unknown';
            if (answer.skip) {
              const covered = result.coverage.find(item => item.question === field.question);
              if (covered) Object.assign(covered, fieldRow(spec, field, 'failed', 'control_not_supported', request?.profileIndex));
              plans.push({ field, target, decision: { action: 'skip', step: stepName } });
            } else {
              plans.push({ field, target, decision: { action: 'fail', reason: 'control_not_supported', step: stepName } });
            }
            continue;
          }
          if (answer.skip) {
            plans.push({ field, target, decision: { action: 'skip' } });
            continue;
          }
          plans.push({
            field, target,
            decision: field.kind === 'cascader'
              ? cascaderDecision(target, answer, request.replaceExisting)
              : decide(target, field, answer, request.replaceExisting)
          });
        }
        const blocked = plans.find(plan => plan.decision.action === 'fail');
        if (blocked) {
          for (const plan of plans) {
            if (plan.decision.action === 'skip') continue;
            if (plan.decision.action === 'fail') record(plan.field, 'failed', plan.decision.reason);
            else if (plan.decision.action === 'same') record(plan.field, 'verified', 'preexisting_same_value');
            else record(plan.field, 'failed', 'blocked_by_unsettled_field');
          }
        } else {
          const rank = kind => (kind === 'monthRange' || kind === 'picker' || kind === 'cascader' ? 0 : (kind === 'select' || kind === 'radio' ? 1 : 2));
          const ordered = [...plans].sort((left, right) => rank(left.field.kind) - rank(right.field.kind));
          for (const plan of ordered) {
            if (plan.decision.action === 'skip') continue;
            state.progress.activeField = plan.field.question;
            const answer = answers[plan.field.question];
            if (plan.decision.action === 'same') {
              record(plan.field, 'verified', 'preexisting_same_value');
              continue;
            }
            const guard = () => {
              if (performance.timeOrigin !== origin || outside(page(spec), spec) !== otherBefore) stop('other_values_changed');
              const live = page(spec);
              if (openForm(live, spec) !== form || otherForms(live, spec).length) stop('other_values_changed');
            };
            if (plan.field.kind === 'monthRange') {
              const outcome = await fillMonthRange(plan.target, answer, markWrite, guard);
              record(plan.field, outcome.status, outcome.reason);
              continue;
            }
            if (plan.field.kind === 'picker') {
              const outcome = await fillPicker(plan.target, answer, request.replaceExisting, markWrite, guard);
              record(plan.field, outcome.status, outcome.reason);
              continue;
            }
            if (plan.field.kind === 'cascader') {
              const outcome = await fillCascader(plan.target, answer, request.replaceExisting, markWrite, guard);
              record(plan.field, outcome.status, outcome.reason);
              continue;
            }
            if (plan.field.kind === 'select') {
              const outcome = await fillSelect(plan.target, plan.field, answer.value, request.replaceExisting, markWrite, guard);
              record(plan.field, outcome.status, outcome.reason);
              continue;
            }
            if (plan.field.kind === 'radio') {
              const outcome = await fillRadio(plan.target, answer.value, request.replaceExisting, markWrite, guard);
              record(plan.field, outcome.status, outcome.reason);
              continue;
            }
            const selected = plan.target;
            const existing = plan.decision.existing;
            if (selected.input.maxLength >= 0 && answer.value.length > selected.input.maxLength) stop('value_too_long');
            const prototype = plan.field.kind === 'textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
            if (!setter) stop('native_setter_missing');
            const untouched = valuesExcept(form, selected.controls);
            const textGuard = expectedOwn => {
              guard();
              const current = targetOf(form, plan.field);
              const readVal = current.input.value;
              const progressOk = request.replaceExisting === true
                ? overwriteProgressOk(readVal, existing, answer.value)
                : readVal === expectedOwn;
              if (current.input !== selected.input || valuesExcept(form, selected.controls) !== untouched || !progressOk)
                stop('other_values_changed');
            };
            step('text_input_events');
            textGuard(existing);
            markWrite();
            await boundAction(() => { if (!selected.input?.isConnected) stop('profile_action_target_changed'); return setter.call(selected.input, answer.value); });
            textGuard(answer.value);
            await boundAction(() => { if (!selected.input?.isConnected) stop('profile_action_target_changed'); return selected.input.dispatchEvent(new Event('input', { bubbles: true })); });
            await boundAction(() => { if (!selected.input?.isConnected) stop('profile_action_target_changed'); return selected.input.dispatchEvent(new Event('change', { bubbles: true })); });
            await boundAction(() => { if (!selected.input?.isConnected) stop('profile_action_target_changed'); return selected.input.dispatchEvent(new Event('blur', { bubbles: true })); });
            step('field_readback');
            await pause(80);
            textGuard(answer.value);
            if (selected.input.value !== answer.value) stop('readback_mismatch');
            if (!siteValid(selected.item, selected.input)) stop('site_validation_failed');
            record(plan.field, 'verified', existing === '' ? 'readback_matched' : 'readback_reapplied');
          }
        }
        const primary = result.fields.find(row => row.status !== 'verified' && row.reason !== 'blocked_by_unsettled_field')
          || result.fields.find(row => row.status !== 'verified');
        const outcome = !primary && result.fields.some(row => row.reason === 'readback_matched' || row.reason === 'readback_reapplied')
          ? 'verified'
          : !primary ? 'verified_preexisting' : (result.writeStarted ? 'unknown' : 'failed_before_write');
        const info = { reason: primary ? primary.reason : null, activeField: null,
          selectorStep: primary ? (blocked?.decision?.step || 'field_decision') : 'complete',
          completedFields: result.fields.map(row => ({ question: row.question, status: row.status, reason: row.reason })),
          writeStarted: result.writeStarted };
        state.last = { requestId: request.requestId, outcome, info };
        return finish(spec, request, result, attempted, info);
      } catch (error) {
        const reason = error instanceof Stop ? error.code : 'fill_failed';
        const active = state.progress?.activeField || null;
        for (const field of attempted) {
          if (result.fields.some(row => row.question === field.question)) continue;
          record(field, 'failed', field.question === active ? reason : 'not_run');
        }
        const info = { reason, activeField: active, selectorStep: state.progress?.selectorStep || 'not_started',
          completedFields: (state.progress?.completedFields || []).map(item => ({ ...item })), writeStarted: result.writeStarted };
        state.last = { requestId: request?.requestId, outcome: result.writeStarted ? 'unknown' : 'failed_before_write', info };
        return finish(spec, request, result, attempted, info, false);
      } finally {
        state.busy = false;
        activeBinding = null;
      }
    }
    const listener = (message, sender, sendResponse) => {
      if (message?.type === spec.statusType) {
        (async () => {
          if (sender?.id !== chrome.runtime.id) { sendResponse({ ok: false, error: 'profile_wrong_sender', writeStarted: false }); return; }
          if (message.profileBinding) await checkBinding(message.profileBinding);
          await checkBinding(lastBinding || activeBinding);
          const running = state.busy && state.progress?.requestId === message.requestId;
          const last = state.last?.requestId === message.requestId ? state.last : null;
          const outcome = last?.outcome || 'unknown';
          sendResponse({ ok: true, data: { requestId: message.requestId, state: running ? 'running' : 'settled', outcome,
            ...(running ? { writeStarted: state.progress.writeStarted === true } : last?.info || { writeStarted: false }) } });
        })().catch(() => sendResponse({ ok: false, error: 'profile_binding_changed', data: { requestId: message?.requestId, state: 'settled', outcome: 'unknown' } }));
        return true;
      }
      if (message?.type !== spec.messageType) return;
      if (sender?.id !== chrome.runtime.id) { sendResponse({ ok: false, error: 'profile_wrong_sender', fillNotStarted: true, writeStarted: false }); return false; }
      trial(message).then(sendResponse, () => sendResponse({ ok: false, reason: 'fill_failed', writeStarted: false, supportedComplete: false, operableComplete: false, complete: false, liveSupportClaimed: false }));
      return true;
    };
    const api = Object.freeze({ implementationRevision: 1, installed: true, trial, listener, spec });
    installed.set(spec.messageType, api);
    globalThis[spec.globalName] = api;
    chrome.runtime.onMessage.addListener(listener);
    return api;
  }
  function decide(target, field, fact, replaceExisting) {
    const answer = fact.value;
    if (field.kind === 'monthRange') {
      const start = norm(target.inputs[0].value);
      const end = norm(target.inputs[1].value);
      const existing = `${start} | ${end}`;
      if (start === fact.start && end === fact.end) return { action: 'same', existing };
      if ((start !== '' || end !== '') && replaceExisting !== true) return { action: 'fail', reason: 'existing_value', existing };
      return { action: 'fill', existing };
    }
    if (field.kind === 'picker') {
      const existing = norm(target.input.value);
      if (existing === fact.leaf) return { action: 'same', existing };
      if (existing !== '' && replaceExisting !== true) return { action: 'fail', reason: 'existing_value', existing };
      return { action: 'fill', existing };
    }
    if (field.kind === 'radio') {
      const existing = target.read();
      if (existing === answer) return { action: 'same', existing };
      if (existing && replaceExisting !== true) return { action: 'fail', reason: 'existing_value', existing };
      return { action: 'fill', existing };
    }
    if (field.kind === 'select') {
      const existing = target.input.value;
      if (norm(existing) === answer) return { action: 'same', existing };
      if (existing !== '' && replaceExisting !== true) return { action: 'fail', reason: 'existing_value', existing };
      return { action: 'fill', existing };
    }
    const existing = target.input.value;
    if (existing !== '' && existing === answer) return { action: 'same', existing };
    if (existing !== '' && replaceExisting !== true) return { action: 'fail', reason: 'existing_value', existing };
    if (answer.length > field.max || (target.input.maxLength >= 0 && answer.length > target.input.maxLength))
      return { action: 'fail', reason: 'value_too_long', existing };
    return { action: 'fill', existing };
  }
  function baseResult(spec, request, extra) {
    return {
      fields: [], coverage: spec.fields.map(field => fieldRow(spec, field, 'failed', 'not_run', request?.profileIndex)),
      complete: false, supportedComplete: false, operableComplete: false, writeStarted: false, editorLeftOpen: false,
      savedOnSite: null, submitted: null, softwareClickedSave: false, softwareClickedSubmit: false, softwareClickedDelete: false,
      scope: spec.scope, liveSupportClaimed: false, section: spec.section,
      ...(collectionName(spec) ? { profileIndex: request?.profileIndex ?? null } : {}),
      ...extra
    };
  }
  function finish(spec, request, result, attempted, info, keepOk) {
    result.fields = attempted.map(field => result.fields.find(row => row.question === field.question) || fieldRow(spec, field, 'failed', 'not_run', request?.profileIndex));
    const verified = result.fields.length === attempted.length && attempted.length > 0 && result.fields.every(row => row.status === 'verified');
    result.supportedComplete = verified;
    result.operableComplete = verified;
    result.complete = false;
    result.liveSupportClaimed = false;
    result.editorLeftOpen = result.editorLeftOpen === true;
    const ok = keepOk === false ? false : verified;
    return { ok, ...result, ...info, complete: false, liveSupportClaimed: false };
  }
  globalThis.ResumeGthOpenFill = Object.freeze({
    install,
    registry: installed,
    implementationRevision: 1
  });
})();
