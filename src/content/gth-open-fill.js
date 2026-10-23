// Shipped GTH open-editor fill engine for 职业技能与特长 / 其他信息 / 教育经历 / 工作经验.
// The caller opens the editor. This engine never opens or closes one, and never
// clicks 保存 / 提交 / 投递 / 删除 / 取消 / 编辑 or a.eduexp-opt-icon / .el-icon-delete.
// Exact el-form-item labels. Writes dispatch input and change. Readback is per field.
// liveSupportClaimed stays false: a writer is not a claim the live site is supported.
// Work 薪资 uses the plain text setter only for the probed el-input.select-l
// shape. Pending live Never-Save. This does not claim the site is supported.
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
    // 薪资 is kind salaryText. A leftover unsupported shape still fail-closes below.
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
  // 2026-10-22 Never-Save probe: 薪资 is div.el-input.select-l > input.el-input__inner
  // (type=text, maxlength=10) with sibling text 元/月. Not .el-select.select-l.
  // The click produced no option list, so the plain text setter writes digits
  // and this function does not click the input. Any other shape fail-closes.
  // Pending live Never-Save. liveSupportClaimed stays false. This does not claim the site is supported.
  function salaryTextTarget(form, field) {
    const item = requireItem(form, field.question);
    const fail = () => unknownControl(item, 'control_not_supported');
    if (item.querySelector('.el-select, .el-select-dropdown, .el-cascader, .el-date-editor')) return fail();
    const widgets = [...item.querySelectorAll('div.el-input.select-l')].filter(node =>
      node.closest('.el-form-item') === item && !node.classList.contains('el-select'));
    if (widgets.length !== 1) return fail();
    const widget = widgets[0];
    const inputs = [...widget.querySelectorAll(':scope > input.el-input__inner')];
    if (inputs.length !== 1 || !(inputs[0] instanceof HTMLInputElement)) return fail();
    const input = inputs[0];
    const type = (input.getAttribute('type') || '').toLowerCase();
    if (type !== 'text' || input.readOnly || input.disabled || input.getAttribute('maxlength') !== '10' || !shown(input))
      return fail();
    const unit = widget.nextElementSibling;
    if (!unit || unit.tagName !== 'SPAN' || unit.closest('.el-form-item') !== item
      || norm(unit.textContent) !== '元/月' || !shown(unit)) return fail();
    return { item, input, controls: [input], unsupported: false };
  }
  // A month click can replace the editor's input and drop the panel. The value
  // then lives on the input that remains in that same editor. Follow it before
  // the bridge so a detached reference does not skip the ask or the other month.
  function editorInput(editor, fallback) {
    if (fallback?.isConnected && (!editor || editor.contains(fallback))) return fallback;
    if (!editor?.isConnected) return fallback;
    const found = [...editor.querySelectorAll('input')].filter(node => node.isConnected && !node.closest('.el-picker-panel'));
    return found.length === 1 ? found[0] : fallback;
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
    if (field.kind === 'salaryText') return salaryTextTarget(form, field);
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
    if (field.kind === 'salaryText') return /^\d{1,10}$/u.test(answer);
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
    let activeReceipts = null, lastReceipts = null;
    const retainedText = field => spec.revalidatePreexistingText === true && spec.fact === 'experience'
      && (field.kind === 'text' || field.kind === 'textarea');
    // Only work native text that was already the confirmed answer gets a
    // retained receipt. A no-write decision must stay bound to that same
    // editor, item and control while other fields or binding checks settle.
    function revalidateReceipts(receipts, forcedReason = null) {
      if (!receipts?.entries.length) return null;
      let editorCurrent = false;
      try {
        const sections = page(spec);
        editorCurrent = performance.timeOrigin === receipts.origin
          && openForm(sections, spec) === receipts.form && otherForms(sections, spec).length === 0
          && outside(sections, spec) === receipts.otherBefore;
      } catch { /* a changed editor cannot retain a receipt */ }
      for (const entry of receipts.entries) {
        let current = false;
        try {
          const target = targetOf(receipts.form, entry.field);
          current = editorCurrent && target.item === entry.item && target.input === entry.input
            && target.input.isConnected && target.input.closest('form') === receipts.form
            && shown(target.input) && !target.input.disabled && !target.input.readOnly
            && target.input.value === entry.answer && siteValid(target.item, target.input);
        } catch { /* missing, ambiguous or replaced native controls fail closed */ }
        if (forcedReason || !current || entry.failed) {
          entry.failed = true;
          receipts.failure ||= forcedReason || 'work_preexisting_receipt_changed';
          receipts.record(entry.field, 'failed', forcedReason || receipts.failure);
        }
      }
      if (receipts.failure) {
        receipts.result.supportedComplete = false;
        receipts.result.operableComplete = false;
        receipts.result.complete = false;
        if (state.last?.requestId === receipts.requestId) {
          state.last.outcome = receipts.result.writeStarted ? 'unknown' : 'failed_before_write';
          state.last.info = { ...state.last.info, reason: state.last.info.reason || receipts.failure,
            completedFields: receipts.result.fields.map(({ question, status, reason }) => ({ question, status, reason })),
            writeStarted: receipts.result.writeStarted };
        }
      }
      return receipts.failure || null;
    }
    function requireReceipts(receipts = activeReceipts) {
      const reason = revalidateReceipts(receipts);
      if (reason) stop(reason);
    }
    async function checkBinding(binding = activeBinding) {
      if (binding?.version !== 1 || typeof binding.epoch !== 'string' || !(/^[a-f0-9]{64}$/u.test(binding.profileHash || ''))) stop('profile_binding_required');
      let response;
      try { response = await chrome.runtime.sendMessage({ type: 'RESUME_PROFILE_BINDING_CHECK', profileBinding: binding }); } catch { /* unavailable */ }
      if (response?.allowed !== true) stop('profile_binding_changed');
    }
    async function boundAction(action) {
      await checkBinding();
      if (location.href !== PAGE || document.visibilityState !== 'visible') stop('profile_action_page_changed');
      requireReceipts();
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
    // Work 任职时间 and education 在校时间 share this writer. Element-UI teleports
    // each .el-picker-panel to document.body, so the panel is not inside the editor.
    // Bind the panel this open makes pending. A quiet start husk may stay connected;
    // removing it detaches the picker's own node and is not what makes the end month
    // commit. Two pending panels are ambiguous — do not click. A year step other than
    // ±1 fails closed. A month click that leaves the input empty is retried on the
    // cell (the table handler reads a TD target) only while that cell is still
    // connected. A click can paint input.value while the Element-UI model stays
    // empty; closing the panel then restores that empty model. Painted
    // input.value is not model acceptance, including when readMonth already sees
    // the target. The cell click may close or remove the panel before this gate
    // runs, and the input may stay empty or be replaced inside its editor.
    // After the click and any connected TD retry, follow the input that remains
    // in that editor. While that live input is connected and this pass has not
    // stopped for dual or drift, always run acceptGthMonthInPage. Do not skip
    // because the node opened at the start of the pass was replaced. Do not skip
    // when the panel node is gone and the input is empty, and do not skip because a leftover start
    // husk is still pending. Dismiss that husk before sendMessage whether or not
    // this panel is still connected, then ask. Do not return without asking
    // because the panel is connected beside one husk. If the dismiss unmounts
    // this panel, it is not marked and MAIN uses the editor Vue. If it stays
    // connected, it is marked so MAIN calls handleMonthPick. One leftover month
    // husk is not a second editor. Two active month panels (a month table and
    // one year each) still fail closed.
    // picked and emitted accept the model. dual, bad-year, and mismatch stop.
    // If the panel node is gone and neither pick nor emit runs, stop. After
    // dismiss, a blank or different value stops readback_mismatch. If the
    // bridge is unavailable, a still-empty input may be typed, and a painted
    // value is not typed over. A value that close clears still fails closed.
    // No <script> is inserted, so a strict script-src cannot skip the call.
    // input+change is kept only when the value is still there after close.
    // The range form-item is site-validated only after both months match.
    // A half-filled required item (任职时间: 请选择任职时间, 在校时间:
    // 请选择在校时间) is not a start-month readback failure. A remaining
    // error after both ends still stops readback_mismatch.
    // liveSupportClaimed stays false.
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
    function otherPendingPanels(panel) {
      return openMonthPanels().filter(node => node !== panel);
    }
    function activeOpenMonthPanels() {
      return openMonthPanels().filter(node => {
        if (node.querySelectorAll('.el-month-table').length !== 1) return false;
        const years = [...node.querySelectorAll('.el-date-picker__header-label')]
          .map(label => norm(label.textContent).match(/^(\d{4})\s*年$/u)).filter(Boolean);
        return years.length === 1;
      });
    }
    // One leftover month husk is not a second editor, including while the bound
    // panel is still connected. Two other active month panels (a month table
    // and one year each), or two active panels after this node is gone, conflict.
    function pendingMonthConflict(panel) {
      const active = activeOpenMonthPanels();
      if (panel?.isConnected) return active.filter(node => node !== panel).length > 1;
      return active.length > 1;
    }
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
          root.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          root.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
          root.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          return null;
        });
      } catch { /* keep the month reason */ }
    }
    async function dismissMonthSurfaces(inputs) {
      for (const input of inputs) await dismissMonthInput(input);
      await dismissMonthOutside();
    }
    async function closeMonthPanel(input) {
      await dismissMonthInput(input);
    }
    async function settleMonthPanels(inputs) {
      if (!openMonthPanels().length) return;
      await dismissMonthSurfaces(inputs);
      // Dismiss starts Element-UI's leave transition. The start panel stays
      // connected with el-zoom-in-top-leave-active, and monthPanelPending treats
      // that animation as open. Checking immediately fail-closes 任职时间 / 在校时间
      // (control_not_supported, month_panel_structure_unknown) before the end
      // month can open. Wait for the leave to finish, then fail closed if a
      // panel is still pending.
      if (openMonthPanels().length) await waitUntil(() => openMonthPanels().length ? null : true, 800);
      if (openMonthPanels().length) {
        step('month_panel_structure_unknown');
        stop('control_not_supported');
      }
    }
    async function bindOpenedMonthPanel(trigger, company) {
      if (openMonthPanels().length) await settleMonthPanels(company);
      const beforeOpen = monthPanelSnapshot();
      await guardedClick(trigger, boundAction);
      const opened = await waitUntil(() => {
        const found = panelOpenedByClick(beforeOpen);
        return found || null;
      }, 1600);
      if (!opened || opened.bad || otherPendingPanels(opened.panel).length || !monthPanelReady(opened.panel)) {
        step('month_panel_structure_unknown');
        await dismissMonthSurfaces(company);
        stop('control_not_supported');
      }
      return opened;
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
    // The fill runs in an isolated world, so it cannot see the page Vue instance.
    // Inserting a <script> is how PR#52 reached handleMonthPick, and a strict
    // script-src skips that element: the result attribute stays pending, input+change
    // paints the DOM, and panel close restores the empty model. The worker instead
    // runs acceptGthMonthInPage via chrome.scripting in world MAIN. That call is not
    // a page script, so script-src does not apply. A painted or typed value is still
    // not the model: picked and emitted are the only acceptances. Before
    // sendMessage, dismiss an unrelated pending month husk whether or not this
    // panel is still connected. One leftover husk must not skip the ask and is
    // not profile_action_target_changed. If this panel is still connected after
    // that dismiss, mark it so MAIN calls handleMonthPick. If the dismiss
    // unmounts it, omit the marker so MAIN uses the editor Vue. Two active
    // month panels still fail closed in the page world.
    async function acceptMonthInPage(panel, input, answer, company = []) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/u.test(answer)) return 'no';
      if (!document.documentElement?.isConnected || !input?.isConnected) return 'no';
      const panelLive = () => !!panel?.isConnected;
      if (otherPendingPanels(panel).length || (!panelLive() && openMonthPanels().length)) {
        await dismissMonthSurfaces(company);
        if (activeOpenMonthPanels().length > 1) {
          await waitUntil(() => activeOpenMonthPanels().length <= 1 ? true : null, 400);
        }
      }
      let result = 'pending';
      try {
        await boundAction(() => {
          if (!input.isConnected) stop('profile_action_target_changed');
          input.setAttribute('data-gth-month-role', 'input');
          input.setAttribute('data-gth-month-answer', answer);
          input.setAttribute('data-gth-month-result', 'pending');
          if (panelLive()) panel.setAttribute('data-gth-month-role', 'panel');
          return null;
        });
        let response = null;
        try {
          response = await chrome.runtime.sendMessage({ type: 'GTH_MONTH_MODEL_ACCEPT', answer });
        } catch { response = null; }
        result = typeof response?.result === 'string' ? response.result : 'pending';
      } catch (error) {
        if (error instanceof Stop) throw error;
        result = 'pending';
      } finally {
        try {
          input.removeAttribute('data-gth-month-role');
          input.removeAttribute('data-gth-month-answer');
          input.removeAttribute('data-gth-month-result');
          if (panel) panel.removeAttribute('data-gth-month-role');
        } catch { /* keep the month reason */ }
      }
      if (result === 'picked' || result === 'emitted') return 'ok';
      // A rejected request, changed marker, or thrown model call is an explicit
      // refusal. A surviving DOM paint cannot turn that verdict into acceptance.
      if (['dual', 'bad-year', 'mismatch', 'bad-answer', 'rejected', 'threw'].includes(result)) return 'stop';
      return 'no';
    }
    // input+change paints the DOM. Element-UI keeps it only when the picker
    // accepted it; closing the panel clears a value the model never took.
    async function commitMonthThroughInput(input, answer) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (!setter) stop('native_setter_missing');
      await boundAction(() => {
        if (!input?.isConnected) stop('profile_action_target_changed');
        setter.call(input, answer);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return null;
      });
    }
    async function fillOneMonth(item, input, trigger, answer, markWrite, guard, peers = []) {
      const company = [input, ...peers].filter(Boolean);
      const editor = input.closest('.el-date-editor');
      let monthInput = input;
      const followInput = () => {
        const live = editorInput(editor, monthInput);
        if (live && live !== monthInput) {
          monthInput = live;
          if (!company.includes(monthInput)) company.unshift(monthInput);
        }
        return monthInput;
      };
      if (norm(followInput().value) === answer) {
        if (openMonthPanels().length) await settleMonthPanels(company);
        return;
      }
      const peerBefore = peers.map(peer => norm(peer.value));
      const drifted = () => peers.some((peer, index) => norm(peer.value) !== peerBefore[index]);
      step('month_open');
      guard();
      const opened = await bindOpenedMonthPanel(trigger, company);
      const panel = opened.panel;
      const failStructure = async () => {
        step('month_panel_structure_unknown');
        await dismissMonthSurfaces(company);
        stop('control_not_supported');
      };
      const readMonth = () => {
        if (pendingMonthConflict(panel)) return { bad: 'dual' };
        if (drifted()) return { bad: 'drift' };
        const current = norm(monthInput.value);
        if (current && current !== answer) return { bad: 'mismatch' };
        if (current === answer) return { ok: true };
        return null;
      };
      try {
        await pause(40);
        if (!monthPanelReady(panel) || otherPendingPanels(panel).length) await failStructure();
        const year = Number(answer.slice(0, 4));
        const month = Number(answer.slice(5));
        const readYear = () => {
          if (!panel.isConnected || otherPendingPanels(panel).length) return null;
          const years = [...panel.querySelectorAll('.el-date-picker__header-label')].filter(shown)
            .map(node => norm(node.textContent).match(/^(\d{4})\s*年$/u)).filter(Boolean);
          if (years.length !== 1) return null;
          return Number(years[0][1]);
        };
        if (readYear() == null || drifted()) await failStructure();
        for (let count = 0; readYear() !== year; count += 1) {
          if (count >= 100 || readYear() == null || drifted() || otherPendingPanels(panel).length) await failStructure();
          guard();
          const current = readYear();
          const previous = current > year;
          const buttons = [...panel.querySelectorAll(previous ? '.el-icon-d-arrow-left' : '.el-icon-d-arrow-right')].filter(node => panel.contains(node) && shown(node));
          if (buttons.length !== 1) await failStructure();
          await guardedClick(buttons[0], boundAction);
          const moved = await waitUntil(() => {
            if (otherPendingPanels(panel).length) return { bad: 'dual' };
            if (drifted()) return { drift: true };
            const next = readYear();
            if (next == null) return null;
            const delta = next - current;
            const expect = previous ? -1 : 1;
            if (delta === expect) return { ok: true };
            if (delta !== 0) return { drift: true };
            return null;
          }, 1500);
          if (!moved || moved.bad || moved.drift) await failStructure();
        }
        if (readYear() !== year || drifted() || otherPendingPanels(panel).length) await failStructure();
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
        if (!panel.isConnected || !monthPanelReady(panel) || otherPendingPanels(panel).length) await failStructure();
        step('month_option');
        guard();
        markWrite();
        await guardedClick(clickTarget, boundAction);
        followInput();
        let matched = await waitUntil(readMonth, 320);
        const monthCell = clickTarget.closest('td');
        if (!matched && norm(monthInput.value) === '' && monthCell && monthCell !== clickTarget
            && monthCell.isConnected && panel.isConnected && panel.contains(monthCell)
            && !monthCellDisabled(monthCell)
            && !drifted() && !otherPendingPanels(panel).length) {
          await guardedClick(monthCell, boundAction);
          followInput();
          matched = await waitUntil(readMonth, 320);
        }
        if (matched?.bad === 'drift' || drifted()) {
          await dismissMonthSurfaces(company);
          stop('control_not_supported');
        }
        // DOM paint is not model acceptance. readMonth seeing the target does
        // not skip MAIN. After the cell click, follow a replaced editor input,
        // then while that live input is connected and this pass has not stopped
        // for drift, always ask the page-world bridge. A detached node from
        // the open must not skip the ask or abandon the other month. A
        // connected panel beside one pending start husk does not skip it:
        // dismiss that husk, then ask. If the panel stays connected, mark it
        // for handleMonthPick. If the dismiss unmounts it, omit the marker so
        // the editor Vue can pick or emit. picked/emitted continue; dual,
        // bad-year, and mismatch stop. Neither pick nor emit on a missing
        // panel stops. An unavailable bridge does not type over a painted value.
        followInput();
        const currentValue = norm(monthInput.value);
        const painted = currentValue !== '';
        const showsTarget = currentValue === answer;
        const panelHere = !!panel?.isConnected;
        let accepted = 'no';
        if (monthInput.isConnected) {
          accepted = await acceptMonthInPage(panel, monthInput, answer, company);
        }
        if (accepted === 'stop') {
          await dismissMonthSurfaces(company);
          stop(pendingMonthConflict(panel) ? 'control_not_supported' : 'readback_mismatch');
        }
        if (accepted === 'ok') {
          matched = await waitUntil(readMonth, 480);
        } else if (!panelHere && showsTarget) {
          await dismissMonthSurfaces(company);
          stop('readback_mismatch');
        } else if (!matched && !painted && norm(monthInput.value) === '' && !drifted() && !pendingMonthConflict(panel)) {
          await commitMonthThroughInput(monthInput, answer);
          matched = await waitUntil(readMonth, 320);
        }
        if (!matched || matched.bad || norm(monthInput.value) !== answer) {
          await dismissMonthSurfaces(company);
          stop(matched?.bad === 'dual' || matched?.bad === 'drift' ? 'control_not_supported' : 'readback_mismatch');
        }
        await dismissMonthSurfaces(company);
        if (norm(monthInput.value) !== answer || drifted() || pendingMonthConflict(panel))
          stop(drifted() || pendingMonthConflict(panel) ? 'control_not_supported' : 'readback_mismatch');
        await dispatchInputChange(monthInput);
        // Do not siteValid(item) here. The required range stays is-error
        // until the other month is set. This input is held when its value
        // matches and the peer did not drift. Model acceptance already
        // happened above. fillMonthRange checks the form-item once.
        const held = await waitUntil(() => item.isConnected && norm(monthInput.value) === answer && !drifted() ? true : null, 400);
        if (!held || !item.isConnected || norm(monthInput.value) !== answer || drifted()) stop('readback_mismatch');
        guard();
      } catch (error) {
        if (monthPanelPending(panel)) await closeMonthPanel(monthInput);
        throw error;
      }
    }
    async function fillMonthRange(target, fact, markWrite, guard) {
      const before = target.inputs.map(node => norm(node.value));
      const editors = target.editors || [];
      let inputs = [target.inputs[0], target.inputs[1]];
      const refresh = () => {
        inputs = [0, 1].map(index => editorInput(editors[index], inputs[index]));
      };
      refresh();
      await fillOneMonth(target.item, inputs[0], target.triggers[0], fact.start, markWrite, guard, [inputs[1]]);
      refresh();
      if (norm(inputs[0].value) !== fact.start || norm(inputs[1].value) !== before[1])
        stop('readback_mismatch');
      await fillOneMonth(target.item, inputs[1], target.triggers[1], fact.end, markWrite, guard, [inputs[0]]);
      refresh();
      const read = `${norm(inputs[0].value)} | ${norm(inputs[1].value)}`;
      if (read !== `${fact.start} | ${fact.end}`) stop('readback_mismatch');
      const paired = () => {
        refresh();
        return `${norm(inputs[0].value)} | ${norm(inputs[1].value)}` === `${fact.start} | ${fact.end}`;
      };
      const valid = await waitUntil(() => paired() && siteValid(target.item, inputs[0]) && siteValid(target.item, inputs[1]) ? true : null, 400);
      if (!valid || !paired()) stop('readback_mismatch');
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
    function samePickerChips(current, expected) {
      return current !== null && current.length === expected.length
        && current.every((entry, index) => entry.li === expected[index].li
          && entry.remove === expected[index].remove && entry.text === expected[index].text);
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
      if (chips.filter(entry => entry.text === leaf).length > 1) await abort('control_not_supported');
      if (occupied && replaceExisting === true && chips.some(entry => entry.text !== leaf) && !singleSelect()) {
        while (chips.some(entry => entry.text !== leaf)) {
          const entry = chips.find(row => row.text !== leaf);
          if (!entry?.remove?.isConnected) await abort('control_not_supported');
          const beforeCount = chips.length;
          const remaining = chips.filter(row => row !== entry);
          guard();
          await guardedClick(entry.remove, action => boundAction(() => {
            guard();
            if (!shown(panel) || !samePickerChips(pickerChips(panel), chips)) stop('control_not_supported');
            markWrite();
            return action();
          }));
          const next = await waitUntil(() => {
            const now = pickerChips(panel);
            if (now === null) return { bad: true };
            return now.length === beforeCount - 1 ? now : null;
          });
          if (!next || next.bad || !samePickerChips(next, remaining)) await abort('control_not_supported');
          chips = next;
        }
      }
      // Selected-view rows reflect the picker selection even when a cached
      // leaf checkbox is unchecked. Retain the requested row after removing
      // foreign rows; selecting that leaf again can create a duplicate or toggle
      // it off. The existing local confirmation commits the retained selection.
      if (!singleSelect() && chips.length === 1 && chips[0].text === leaf) {
        const confirms = visibleConfirms(panel);
        if (confirms.length !== 1) await abort('control_not_supported');
        const beforeValue = input.value;
        const form = item.closest('form');
        const question = ownLabel(item);
        step('picker_confirm');
        await guardedClick(confirms[0], action => boundAction(() => {
          guard();
          const current = cascaderTarget(form, { question });
          const open = visibleCascaderPanels();
          const liveConfirms = visibleConfirms(panel);
          if (current.unsupported || current.item !== item || current.wrap !== target.wrap
            || current.input !== input || current.trigger !== trigger || current.panel !== panel
            || open.length !== 1 || open[0] !== panel || input.value !== beforeValue
            || !samePickerChips(pickerChips(panel), chips)
            || liveConfirms.length !== 1 || liveConfirms[0] !== confirms[0]) stop('control_not_supported');
          markWrite();
          return action();
        }));
        const matched = await waitUntil(() => norm(input.value) === leaf && !shown(panel) ? true : null);
        if (!matched || !siteValid(item, input)) await abort('readback_mismatch');
        await dispatchInputChange(input);
        opened = false;
        guard();
        if (norm(input.value) !== leaf || shown(panel) || !samePickerChips(pickerChips(panel), chips)
          || !siteValid(item, input)) stop('readback_mismatch');
        return { status: 'verified', reason: 'readback_reapplied' };
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
      const selected = pickerChips(panel);
      if (norm(input.value) !== leaf || shown(panel) || !siteValid(item, input)
        || selected === null || selected.length !== 1 || selected[0].text !== leaf) stop('readback_mismatch');
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
      activeReceipts = null;
      lastReceipts = null;
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
          const decision = field.kind === 'cascader'
            ? cascaderDecision(target, answer, request.replaceExisting)
            : decide(target, field, answer, request.replaceExisting);
          if (retainedText(field) && decision.action === 'same' && !siteValid(target.item, target.input))
            Object.assign(decision, { action: 'fail', reason: 'site_validation_failed' });
          plans.push({ field, target, decision });
        }
        const entries = plans.filter(plan => retainedText(plan.field) && plan.decision.action === 'same')
          .map(plan => ({ field: plan.field, item: plan.target.item, input: plan.target.input,
            answer: answers[plan.field.question].value, failed: false }));
        if (entries.length) {
          activeReceipts = { requestId: request.requestId, entries, form, origin, otherBefore, result, record, failure: null };
          lastReceipts = activeReceipts;
          requireReceipts();
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
              requireReceipts();
              record(plan.field, 'verified', 'preexisting_same_value');
              continue;
            }
            const guard = () => {
              requireReceipts();
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
        if (activeReceipts) {
          await checkBinding();
          requireReceipts();
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
        revalidateReceipts(activeReceipts, reason === 'profile_binding_changed' || reason === 'profile_binding_required' ? reason : null);
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
        activeReceipts = null;
      }
    }
    const listener = (message, sender, sendResponse) => {
      if (message?.type === spec.statusType) {
        (async () => {
          if (sender?.id !== chrome.runtime.id) { sendResponse({ ok: false, error: 'profile_wrong_sender', writeStarted: false }); return; }
          if (message.profileBinding) await checkBinding(message.profileBinding);
          await checkBinding(lastBinding || activeBinding);
          const receipts = lastReceipts?.requestId === message.requestId ? lastReceipts : null;
          revalidateReceipts(receipts);
          const running = state.busy && state.progress?.requestId === message.requestId;
          const last = state.last?.requestId === message.requestId ? state.last : null;
          const outcome = last?.outcome || 'unknown';
          sendResponse({ ok: true, data: { requestId: message.requestId, state: running ? 'running' : 'settled', outcome,
            ...(running ? { writeStarted: state.progress.writeStarted === true } : last?.info || { writeStarted: false }) } });
        })().catch(() => {
          const receipts = lastReceipts?.requestId === message?.requestId ? lastReceipts : null;
          revalidateReceipts(receipts, 'profile_binding_changed');
          sendResponse({ ok: false, error: 'profile_binding_changed', data: {
            requestId: message?.requestId, state: 'settled', outcome: 'unknown',
            ...(receipts ? { writeStarted: receipts.result.writeStarted,
              completedFields: receipts.result.fields.map(({ question, status, reason }) => ({ question, status, reason })) } : {})
          } });
        });
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
