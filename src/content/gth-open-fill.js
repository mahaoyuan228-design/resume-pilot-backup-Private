// Shipped GTH open-editor fill engine for 职业技能与特长 / 其他信息 / 教育经历.
// The caller opens the editor. This engine never opens or closes one, and never
// clicks 保存 / 提交 / 投递 / 删除 / 取消 / 编辑 or a.eduexp-opt-icon / .el-icon-delete.
// Exact el-form-item labels. Writes dispatch input and change. Readback is per field.
// liveSupportClaimed stays false: a writer is not a claim the live site is supported.
(() => {
  const previous = globalThis.ResumeGthOpenFill;
  const installed = previous?.registry instanceof Map ? previous.registry : new Map();
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
  function clickAllowed(node) {
    if (!node || node.nodeType !== 1) return false;
    if (FORBIDDEN.has(norm(node.textContent))) return false;
    if (node.matches?.('button, a.eduexp-opt-icon, .el-icon-delete')) return false;
    if (node.closest?.('a.eduexp-opt-icon, .el-icon-delete, button')) return false;
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
    if (field.shape === 'month') {
      const editors = [...item.querySelectorAll('.el-date-editor')].filter(node => node.closest('.el-form-item') === item);
      if (editors.length !== 2) stop('control_structure_changed');
      return { item, controls: [], unsupported: true };
    }
    if (field.shape === 'category') {
      const triggers = [...item.querySelectorAll('.input-l.pointer')].filter(node => node.closest('.el-form-item') === item);
      const inputs = triggers.flatMap(trigger => [...trigger.querySelectorAll('input')]);
      if (triggers.length !== 1 || inputs.length !== 1 || !(inputs[0] instanceof HTMLInputElement) || !inputs[0].readOnly)
        stop('control_structure_changed');
      return { item, controls: inputs, unsupported: true };
    }
    stop('control_not_supported');
  }
  function targetOf(form, field) {
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
  function factRow(spec, request, field) {
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
    if (spec.fact === 'education') {
      const row = request?.profile?.education?.[request.profileIndex];
      const raw = row?.[field.key];
      return typeof raw === 'string' ? raw : '';
    }
    const profile = request?.profile;
    const raw = profile && typeof profile === 'object' && !Array.isArray(profile)
      ? profile.customAnswers?.[field.question]
      : request?.answers?.[field.question];
    return typeof raw === 'string' ? raw : '';
  }
  function unsupportedAnswer(spec, request, field) {
    if (spec.fact !== 'education') return '';
    const row = request?.profile?.education?.[request.profileIndex];
    const keys = field.keys || [field.key];
    const values = keys.map(key => (typeof row?.[key] === 'string' ? row[key].trim() : '')).filter(Boolean);
    return values.join('|');
  }
  function factConfirmed(spec, request, field, answer) {
    const profile = request?.profile;
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return false;
    const confirmed = new Set(Array.isArray(profile.confirmedFields) ? profile.confirmedFields : []);
    if (spec.fact === 'education') {
      return confirmed.has(`education.${request.profileIndex}.${field.key}`);
    }
    const facts = (Array.isArray(profile.customFacts) ? profile.customFacts : []).filter(item => item?.question === field.question);
    const fact = facts.length === 1 ? facts[0] : null;
    return !!fact && fact.answer === answer && fact.sitePageUrl === PAGE
      && fact.sectionName === spec.section && fact.rowContext === 'none'
      && confirmed.has(`customAnswers.${field.question}`);
  }
  function fieldRow(spec, field, status, reason, index) {
    const path = spec.fact === 'education'
      ? `education.${index}.${field.key}`
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
        if (spec.fact === 'education' && (!Number.isInteger(request.profileIndex) || request.profileIndex < 0 || request.profileIndex > 29))
          stop('education_profile_index_invalid');
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
          if (answer.skip) {
            if (field.kind === 'unsupported') {
              const covered = result.coverage.find(item => item.question === field.question);
              if (covered) Object.assign(covered, fieldRow(spec, field, 'failed', 'control_not_supported', request?.profileIndex));
            }
            plans.push({ field, target, decision: { action: 'skip' } });
            continue;
          }
          if (field.kind === 'unsupported') {
            plans.push({ field, target, decision: { action: 'fail', reason: 'control_not_supported' } });
            continue;
          }
          plans.push({ field, target, decision: decide(target, field, answer.value, request.replaceExisting) });
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
          const ordered = [
            ...plans.filter(plan => plan.field.kind === 'select' || plan.field.kind === 'radio'),
            ...plans.filter(plan => plan.field.kind !== 'select' && plan.field.kind !== 'radio')
          ];
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
        const info = { reason: primary ? primary.reason : null, activeField: null, selectorStep: primary ? 'field_decision' : 'complete',
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
  function decide(target, field, answer, replaceExisting) {
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
      ...(spec.fact === 'education' ? { profileIndex: request?.profileIndex ?? null } : {}),
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
  if (previous?.installed) {
    for (const api of previous.registry || []) {
      try { chrome.runtime.onMessage.removeListener(api.listener); } catch { /* reload */ }
    }
  }
  globalThis.ResumeGthOpenFill = Object.freeze({
    install,
    registry: [...installed.values()],
    implementationRevision: 1
  });
})();
