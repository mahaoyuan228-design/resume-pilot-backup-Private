// Internal GTH education trial. It never saves, deletes, or submits.
// The site record is matched to a unique confirmed profile record by its
// already present school/major, not by array position.
(() => {
  // Extension reload can leave this isolated-world global behind after the
  // runtime has dropped its old message listener. Replace the old listener on
  // reinjection so the toolbar action still receives exactly one response.
  const previous = globalThis.ResumeGthEducationTextTrial;
  if (previous?.listener) {
    try { chrome.runtime.onMessage.removeListener(previous.listener); } catch {}
  }
  const PAGE = 'https://hr.gtht.com/resume/edit/';
  const TITLES = ['基本信息', '教育经历', '求职意向', '工作经验',
    '职业技能与特长', '附件简历', '其他信息'];
  const TEXT_FIELDS = [
    { question: '毕业学校', key: 'school', kind: 'text', max: 200 },
    { question: '专业名称', key: 'major', kind: 'text', max: 200 }
  ];
  const FULL_FIELDS = [
    ...TEXT_FIELDS,
    { question: '在校活动/职务', key: 'campusActivities', kind: 'textarea', max: 4000 },
    { question: '在校成绩排名', key: 'gradeRank', kind: 'text', max: 200 },
    { question: '专业描述', key: 'majorDescription', kind: 'textarea', max: 4000 },
    { question: '绩点', key: 'gpa', kind: 'text', max: 200 },
    { question: '学校所在地', key: 'schoolLocation', kind: 'text', max: 200 },
    { question: '是否统招', key: 'unifiedAdmissions', kind: 'radio', max: 1 }
  ];
  const COMPLEX_FIELDS = [
    { question: '学历', key: 'degree', kind: 'select', max: 200 },
    { question: '在校时间（开始）', itemQuestion: '在校时间', key: 'startDate', kind: 'month', index: 0, max: 7 },
    { question: '在校时间（结束）', itemQuestion: '在校时间', key: 'endDate', kind: 'month', index: 1, max: 7 },
    { question: '专业类别', key: 'majorCategory', kind: 'category', max: 500 }
  ];
  const norm = value => String(value ?? '').replace(/[\s\u00a0]+/gu, ' ').trim();
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const visible = node => !!node?.getClientRects().length
    && getComputedStyle(node).display !== 'none'
    && getComputedStyle(node).visibility !== 'hidden';
  const state = { busy: false, last: null, progress: null };
  const selectorStep = name => {if (state.progress) state.progress.selectorStep = name;};
  const diagnostic = (progress, reason = null) => ({reason,
    activeField:progress?.activeField || null,
    selectorStep:progress?.selectorStep || 'not_started',
    completedFields:(progress?.completedFields || []).map(field => ({...field}))});
  class TrialStop extends Error {
    constructor(code) { super(code); this.code = code; }
  }
  const stop = code => { throw new TrialStop(code); };
  let activeBinding=null,lastBinding=null;
  async function checkBinding(binding=activeBinding) {
    if(binding?.version!==1||typeof binding.epoch!=='string'||!(/^[a-f0-9]{64}$/u.test(binding.profileHash||'')))stop('profile_binding_required');
    let response;try{response=await chrome.runtime.sendMessage({type:'RESUME_PROFILE_BINDING_CHECK',profileBinding:binding});}catch{}
    if(response?.allowed!==true)stop('profile_binding_changed');
  }
  async function boundAction(action){await checkBinding();if(location.href!==PAGE||document.visibilityState!=='visible')stop('profile_action_page_changed');return action();}


  function page() {
    if (location.href !== PAGE) stop('wrong_page');
    if (document.readyState !== 'complete') stop('page_not_ready');
    if (document.visibilityState !== 'visible') stop('page_hidden');
    const sections = [...document.querySelectorAll('.r-section')];
    const titleOf = section => {
      const title = section.querySelector('.title_')?.cloneNode(true);
      title?.querySelectorAll('a,button').forEach(node => node.remove());
      return norm(title?.textContent);
    };
    if (JSON.stringify(sections.map(titleOf)) !== JSON.stringify(TITLES))
      stop('section_structure_changed');
    return sections;
  }
  const controls = root => [...root.querySelectorAll('input,select,textarea')]
    .map(node => [node.tagName, node.type || '', node.value || '',
      !!node.checked, node.selectedIndex ?? null]);
  const snapshot = root => JSON.stringify([root.textContent || '', controls(root),
    [...root.querySelectorAll('[contenteditable]')].map(node => node.textContent || '')]);
  const outside = sections => JSON.stringify(sections
    .filter((_, index) => index !== 1).map(snapshot));
  // Education editor identity is scoped to 教育经历 only. Other-section forms
  // (基本信息 leftover etc.) used to trip editor_structure_changed falsely —
  // same class of bug as gth_editor_ambiguous before probe harden.
  const forms = sections => [...sections[1].querySelectorAll('form')];
  const otherSectionForms = sections => sections.flatMap((section, index) =>
    index === 1 ? [] : [...section.querySelectorAll('form')]);
  const cancelButtons = form => [...form.querySelectorAll('button')].filter(node =>
    visible(node) && node.type === 'button' && norm(node.textContent) === '取消'
    && !node.disabled && !node.hasAttribute('formaction'));
  const records = section => [...section.querySelectorAll('.sec-context > .sec-detail')];
  const itemLabel = item => {
    const labels = [...item.querySelectorAll('.el-form-item__label')]
      .filter(label => label.closest('.el-form-item') === item);
    return labels.length === 1 ? norm(labels[0].textContent) : '';
  };
  function target(form, field) {
    const question = field.itemQuestion || field.question;
    const items = [...form.querySelectorAll('.el-form-item')]
      .filter(item => itemLabel(item) === question);
    if (items.length !== 1) stop('education_target_not_unique');
    const item = items[0];
    if (['select', 'month', 'category'].includes(field.kind))
      return complexTarget(item, field);
    if (field.kind === 'radio') {
      const radios = [...item.querySelectorAll('input[type="radio"]')]
        .filter(node => node.closest('.el-form-item') === item);
      const options = radios.map(control => {
        const label = control.closest('label.el-radio');
        const ownLabel = label?.querySelector('.el-radio__label');
        // Element UI hides its native input. Only its visible choice label is
        // clicked; the native checked state remains the readback authority.
        const text = norm(ownLabel?.textContent || label?.textContent);
        if (!label || !item.contains(label) || !visible(label)
          || label.querySelectorAll('input[type="radio"]').length !== 1
          || (text !== '是' && text !== '否')) stop('education_radio_structure_changed');
        return { control, label, text };
      });
      const group = radios[0]?.closest('.el-radio-group');
      const nativeGroup = new Set(radios.map(control => control.name)).size === 1
        && !!radios[0]?.name;
      const componentGroup = !!group && item.contains(group)
        && radios.every(control => control.closest('.el-radio-group') === group);
      if (options.length !== 2 || new Set(options.map(option => option.text)).size !== 2
        || !nativeGroup && !componentGroup) stop('education_radio_structure_changed');
      return { item, kind: 'radio', controls: radios, options,
        read() {
          const selected = options.filter(option => option.control.checked);
          if (selected.length > 1) stop('education_radio_structure_changed');
          return selected[0]?.text || '';
        } };
    }
    const fields = [...item.querySelectorAll('input,select,textarea')]
      .filter(node => node.closest('.el-form-item') === item && visible(node));
    const control = fields[0];
    const rightType = field.kind === 'textarea'
      ? control instanceof HTMLTextAreaElement
      : control instanceof HTMLInputElement && control.type === 'text';
    if (fields.length !== 1 || !rightType || control.readOnly || control.disabled
      || item.querySelector('.el-select,.el-date-editor,.el-cascader,.cascader-wrap'))
      stop('education_target_not_plain_text');
    return { item, control, controls: [control], kind: field.kind,
      read: () => control.value };
  }
  function validateCandidates(input, full) {
    if (!Array.isArray(input) || input.length < 1 || input.length > 30)
      stop('profile_candidates_invalid');
    const indexes = new Set();
    return input.map(row => {
      if (!row || !Number.isInteger(row.profileIndex) || row.profileIndex < 0
        || row.profileIndex > 29 || indexes.has(row.profileIndex)
        || !Array.isArray(row.confirmedPaths)
        || row.confirmedPaths.some(path => typeof path !== 'string'))
        stop('profile_candidates_invalid');
      indexes.add(row.profileIndex);
      const candidate = { profileIndex: row.profileIndex,
        confirmedPaths: new Set(row.confirmedPaths) };
      for (const field of full ? [...FULL_FIELDS, ...COMPLEX_FIELDS] : TEXT_FIELDS) {
        const key = field.key;
        const value = typeof row[key] === 'string' ? row[key] : '';
        candidate[key] = value;
        const invalidControls = field.kind === 'textarea'
          ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u : /[\u0000-\u001f]/u;
        if (row[key] != null && typeof row[key] !== 'string'
          || value.length > field.max || invalidControls.test(value)
          || field.kind === 'radio' && value && value !== '是' && value !== '否'
          || field.kind === 'month' && value && !/^(19|20)\d{2}-(0[1-9]|1[0-2])$/u.test(value)
          || field.kind === 'category' && value && value.split('/').some(part => !norm(part)))
          stop('profile_candidates_invalid');
        if (value && (!full || key === 'school' || key === 'major')
          && !candidate.confirmedPaths.has(`education.${row.profileIndex}.${key}`))
          stop('profile_fact_unconfirmed');
      }
      if (full && candidate.startDate && candidate.endDate
        && candidate.confirmedPaths.has(`education.${row.profileIndex}.startDate`)
        && candidate.confirmedPaths.has(`education.${row.profileIndex}.endDate`)
        && candidate.startDate > candidate.endDate) stop('education_date_range_invalid');
      if (!full && !candidate.school && !candidate.major) stop('profile_candidates_invalid');
      return candidate;
    });
  }
  function matchingCandidate(candidates, current) {
    const present = TEXT_FIELDS.filter(field => norm(current[field.key]));
    if (!present.length) stop('row_mapping_unknown');
    const matches = candidates.filter(candidate => present.every(field =>
      norm(candidate[field.key]) === norm(current[field.key])));
    if (matches.length !== 1) stop('row_mapping_unknown');
    return matches[0];
  }
  function validationClear(item, control) {
    return !item.classList.contains('is-error')
      && !item.classList.contains('is-validating')
      && control.getAttribute('aria-invalid') !== 'true'
      && ![...item.querySelectorAll('.el-form-item__error')]
        .some(node => visible(node) && norm(node.textContent))
      && (!control.validity || control.validity.valid);
  }
  const openMenus = () => [...document.querySelectorAll(
    '.el-select-dropdown,.el-picker-panel,.popover.plugin-dialog-wrap')].filter(visible);
  async function waitFor(read, timeout = 5000) {
    const end = Date.now() + timeout;
    do { const value = read(); if (value) return value; await pause(70); }
    while (Date.now() < end);
    stop('education_widget_timeout');
  }
  const enabled = node => !node.disabled && !node.classList.contains('is-disabled')
    && !node.classList.contains('disabled') && node.getAttribute('aria-disabled') !== 'true';
  function complexTarget(item, field) {
    const visibleInputs = [...item.querySelectorAll('input[type="text"]')]
      .filter(node => visible(node) && !node.closest('.popover.plugin-dialog-wrap'));
    let control, trigger;
    if (field.kind === 'month') {
      const editors = [...item.querySelectorAll('.el-date-editor')];
      if (editors.length !== 2 || !editors.every(node => node.classList.contains('el-date-editor--month')))
        stop('education_month_structure_changed');
      const inputs = editors.map(node => [...node.querySelectorAll('input[type="text"]')].filter(visible));
      if (inputs.some(nodes => nodes.length !== 1)) stop('education_month_structure_changed');
      control = inputs[field.index][0];
      const icons = [...editors[field.index].querySelectorAll('.el-input__prefix .el-input__icon.el-icon-date')]
        .filter(node => visible(node) && enabled(node));
      if (icons.length !== 1) stop('education_month_trigger_not_unique');
      trigger = icons[0];
    } else if (field.kind === 'select') {
      if (item.querySelectorAll('.el-select').length !== 1 || visibleInputs.length !== 1)
        stop('education_select_structure_changed');
      control = visibleInputs[0];
      if (!control.closest('.el-select')) stop('education_select_structure_changed');
    } else {
      // Live GTH 专业类别 is .cascader-wrap (same shape as draft-save / intent).
      // Keep .professional-category as a secondary match for older markup.
      const widgets = [...item.querySelectorAll('.cascader-wrap')];
      const cascaderOk = widgets.length === 1
        && !item.querySelector('.el-select,.el-cascader,.el-date-editor')
        && visibleInputs.length === 1
        && visibleInputs[0] instanceof HTMLInputElement
        && visibleInputs[0].readOnly
        && widgets[0].contains(visibleInputs[0])
        && !!widgets[0].querySelector(':scope > .input-l.pointer')?.contains(visibleInputs[0])
        && widgets[0].querySelectorAll(':scope > .popover.plugin-dialog-wrap').length === 1
        && widgets[0].querySelectorAll(':scope > .popover.plugin-dialog-wrap .search-input').length === 1;
      let triggers = cascaderOk
        ? [...widgets[0].querySelectorAll(':scope > .input-l.pointer')].filter(visible)
        : [...item.querySelectorAll('.professional-category > .input-l.pointer')].filter(visible);
      if (triggers.length !== 1 || visibleInputs.length !== 1
        || !triggers[0].contains(visibleInputs[0])
        || (!cascaderOk && item.querySelectorAll('.popover.plugin-dialog-wrap').length !== 1)) {
        // Soft-skip unknown category widget so other education fields can fill.
        return {item, control:visibleInputs[0]||null,
          controls:visibleInputs[0]?[visibleInputs[0]]:[], kind:'category',
          structureUnsupported:true, siteControlDisabled:false,
          read:()=>visibleInputs[0] instanceof HTMLInputElement ? visibleInputs[0].value : ''};
      }
      control = visibleInputs[0];trigger = triggers[0];
    }
    const siteControlDisabled=field.kind==='select'&&field.key==='degree'
      &&control instanceof HTMLInputElement&&control.disabled&&control.readOnly;
    if (!(control instanceof HTMLInputElement) || control.disabled&&!siteControlDisabled)
      stop('education_complex_input_unavailable');
    const target = {item, control, controls:[control], kind:field.kind,siteControlDisabled, read:()=>control.value};
    target.write = async (answer, guard, commit) => {
      if(siteControlDisabled)stop('site_control_disabled');
      if (openMenus().length) stop('education_other_menu_open');
      guard();
      let popup, committed = false;
      const close = async () => {
        if (!popup || !visible(popup) || document.visibilityState !== 'visible'
          || location.href !== PAGE) return;
        if (field.kind === 'category') await boundAction(()=>{if(!(trigger)?.isConnected)stop('profile_action_target_changed');return trigger.click();});
        else if (field.kind === 'select') await boundAction(()=>{if(!(control)?.isConnected)stop('profile_action_target_changed');return control.click();});
        else {await boundAction(()=>{if(!(control)?.isConnected)stop('profile_action_target_changed');return control.dispatchEvent(new KeyboardEvent('keydown',
          {key:'Escape',code:'Escape',keyCode:27,which:27,bubbles:true}));});await boundAction(()=>{if(!(control)?.isConnected)stop('profile_action_target_changed');return control.blur();});}
        await pause(650);
      };
      try {
        selectorStep(field.kind === 'month' ? 'month_open'
          : field.kind === 'select' ? 'degree_open' : 'category_open');
        await boundAction(()=>{if(!((trigger || control))?.isConnected)stop('profile_action_target_changed');return (trigger || control).click();});
        popup = await waitFor(() => {
          const candidates = openMenus();
          if (candidates.length > 1) stop('education_menu_not_unique');
          return candidates[0] || null;
        });
        const selector = field.kind === 'select' ? '.el-select-dropdown'
          : field.kind === 'month' ? '.el-picker-panel' : '.popover.plugin-dialog-wrap';
        if (!popup.matches(selector) || field.kind === 'category' && !item.contains(popup))
          stop('education_wrong_widget_menu');
        guard();
        if (field.kind === 'select') {
          selectorStep('degree_option_lookup');
          const choices = await waitFor(() => {
            guard();
            const exact = [...popup.querySelectorAll('.el-select-dropdown__item')]
              .filter(node => visible(node) && norm(node.textContent) === norm(answer));
            if (exact.length > 1) stop('education_option_ambiguous');
            return exact.length === 1 ? exact : null;
          });
          await pause(120);guard();
          const exact = [...popup.querySelectorAll('.el-select-dropdown__item')]
            .filter(node => visible(node) && norm(node.textContent) === norm(answer));
          if (exact.length !== 1 || exact[0] !== choices[0]) stop('education_option_changed');
          if (!enabled(exact[0])) stop('education_option_disabled');
          selectorStep('degree_option_click');commit();await boundAction(()=>{if(!(exact[0])?.isConnected)stop('profile_action_target_changed');return exact[0].click();});
        } else if (field.kind === 'month') {
          selectorStep('month_year_read');
          const year = Number(answer.slice(0,4));const month = Number(answer.slice(5));
          const readYear = () => {
            const years = [...popup.querySelectorAll('.el-date-picker__header-label')]
              .filter(visible).map(node => norm(node.textContent).match(/^(\d{4})\s*年$/u))
              .filter(Boolean);
            if (years.length !== 1) stop('education_month_year_unknown');
            return Number(years[0][1]);
          };
          for (let step = 0; readYear() !== year; step += 1) {
            selectorStep('month_year_navigation');
            if (step >= 100) stop('education_month_year_too_far');
            guard();const previous = readYear() > year;
            const buttons = [...popup.querySelectorAll(previous ? '.el-icon-d-arrow-left' : '.el-icon-d-arrow-right')]
              .filter(node => visible(node) && enabled(node));
            if (buttons.length !== 1) stop('education_month_navigation_unknown');
            const old = readYear();await boundAction(()=>{if(!(buttons[0])?.isConnected)stop('profile_action_target_changed');return buttons[0].click();});
            await waitFor(() => readYear() === old + (previous ? -1 : 1), 1500);
          }
          const tables = [...popup.querySelectorAll('.el-month-table')].filter(visible);
          selectorStep('month_option_lookup');
          if (tables.length !== 1) stop('education_month_table_unknown');
          const cells = [...tables[0].querySelectorAll('td')].filter(visible);
          const names = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
          const choices = cells.filter(node => norm(node.textContent).replace(/\s/gu,'') === names[month-1]
            || norm(node.textContent).replace(/\s/gu,'') === `${month}月`);
          if (cells.length !== 12 || choices.length !== 1) stop('education_month_option_unknown');
          if (!enabled(choices[0])) stop('education_option_disabled');
          selectorStep('month_option_click');guard();commit();await boundAction(()=>{if(!(choices[0])?.isConnected)stop('profile_action_target_changed');return choices[0].click();});
        } else {
          selectorStep('category_option_lookup');
          const path = answer.split('/').map(norm);
          if (!path.length || path.length > 6) stop('education_category_path_invalid');
          const labelOf = row => row.querySelector(':scope > label > span[uid],:scope > label > span,:scope > span');
          const selectedRows = () => [...popup.querySelectorAll('.selected-view-data > li')];
          const confirmCategory = async (uid, text) => {
            // This is only the local picker confirmation. A matching leaf name
            // alone cannot bind a selected row with a different category UID.
            selectorStep('category_confirm');
            await boundAction(() => {
              const selected = selectedRows();
              const confirm = [...popup.querySelectorAll('a.pop-btn.confirm')].filter(visible);
              const href = confirm[0]?.getAttribute('href');
              if (selected.length !== 1 || selected[0].getAttribute('uid') !== uid
                || norm(selected[0].textContent) !== text || confirm.length !== 1
                || !enabled(confirm[0]) || norm(confirm[0].textContent) !== '确定'
                || href && !/^(#|javascript:(?:;|void\(0\)))$/iu.test(href))
                stop('education_category_selection_unknown');
              if (!popup?.isConnected || !visible(popup) || !confirm[0]?.isConnected
                || !popup.contains(confirm[0])) stop('profile_action_target_changed');
              return confirm[0].click();
            });
          };
          const acceptsCategory = value => norm(value) === norm(answer) || norm(value) === path.at(-1)
            || path.length === 1 && norm(value).split('/').at(-1) === path[0];
          const reopenCategory = async () => {
            if (openMenus().length) stop('education_other_menu_open');
            selectorStep('category_reopen');
            await boundAction(()=>{if(!(trigger)?.isConnected)stop('profile_action_target_changed');return trigger.click();});
            popup = await waitFor(() => {
              guard(true);
              const menus = openMenus();
              if (menus.length > 1) stop('education_menu_not_unique');
              const menu = menus[0];
              if (menu && (!menu.matches('.popover.plugin-dialog-wrap') || !item.contains(menu)))
                stop('education_wrong_widget_menu');
              return menu;
            });
          };
          // Clear a single foreign selected-view row when replaceExisting/new.
          // Soft-skip remains correct when overwrite is NOT allowed, when more
          // than one selected-view row exists, or when deselect cannot empty it.
          const clearSearchInput = async () => {
            const search = [...popup.querySelectorAll('.search-input')].filter(visible);
            if (search.length !== 1 || !(search[0] instanceof HTMLInputElement)) return;
            if (search[0].value === '') return;
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
            if (!setter) stop('native_setter_missing');
            await boundAction(()=>{if(!(search[0])?.isConnected)stop('profile_action_target_changed');return setter.call(search[0], '');});
            await boundAction(()=>{if(!(search[0])?.isConnected)stop('profile_action_target_changed');return search[0].dispatchEvent(new Event('input',{bubbles:true}));});
            await pause(100);
          };
          const clearForeignSelection = async (row) => {
            const uid = row.getAttribute('uid');
            const text = norm(row.textContent);
            if (!uid || !text) stop('education_category_existing_selection_unknown');
            selectorStep('category_clear_foreign');
            commit();
            // Prefer the leaf checkbox for this UID. Selected-view alone often
            // does not toggle storageChecked; search brings the leaf on-screen.
            let boxes = [...popup.querySelectorAll('input[type="checkbox"][uid]')]
              .filter(node => node.getAttribute('uid') === uid && !node.disabled);
            if (boxes.length !== 1) {
              const searches = [...popup.querySelectorAll('.search-input')].filter(visible);
              if (searches.length === 1 && searches[0] instanceof HTMLInputElement
                && !searches[0].readOnly && !searches[0].disabled) {
                const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
                if (!setter) stop('native_setter_missing');
                await boundAction(()=>{if(!(searches[0])?.isConnected)stop('profile_action_target_changed');return setter.call(searches[0], text);});
                await boundAction(()=>{if(!(searches[0])?.isConnected)stop('profile_action_target_changed');return searches[0].dispatchEvent(new Event('input',{bubbles:true}));});
                const deadline = Date.now() + 2500;
                do {
                  boxes = [...popup.querySelectorAll('input[type="checkbox"][uid]')]
                    .filter(node => node.getAttribute('uid') === uid && !node.disabled
                      && visible(node.closest('li.branch') || node));
                  if (boxes.length === 1) break;
                  await pause(70);
                } while (Date.now() < deadline);
              }
            }
            // Only toggle the leaf checkbox/label for this UID. Do not click
            // arbitrary selected-view icons/spans — those can disturb other fields.
            const clickTargets = [];
            if (boxes.length === 1) clickTargets.push(boxes[0], boxes[0].closest('label'));
            let cleared = false;
            for (const clickTarget of clickTargets.filter(Boolean)) {
              if (!clickTarget?.isConnected) continue;
              await boundAction(()=>{if(!(clickTarget)?.isConnected)stop('profile_action_target_changed');return clickTarget.click();});
              await pause(160);
              guard(true);
              if (selectedRows().length === 0) { cleared = true; break; }
            }
            if (!cleared) stop('education_category_existing_selection_unknown');
            if (!visible(popup)) await reopenCategory();
            await clearSearchInput();
          };
          {
            // Selected-view can lag the closed input; wait briefly when overwrite
            // is needed so clearForeignSelection sees the foreign row.
            if (target.allowCategoryOverwrite === true && !acceptsCategory(control.value)
              && selectedRows().length === 0) {
              const deadline = Date.now() + 1200;
              while (Date.now() < deadline && selectedRows().length === 0) await pause(70);
            }
            const preexisting = selectedRows();
            if (preexisting.length > 1) stop('education_category_existing_selection_unknown');
            if (preexisting.length === 1 && target.allowCategoryOverwrite === true
              && !acceptsCategory(control.value))
              await clearForeignSelection(preexisting[0]);
          }
          const chooseLeaf = async choice => {
            if (!enabled(choice) || choice.classList.contains('has-child'))
              stop('education_option_disabled');
            const checkbox = choice.querySelector(':scope > label > input[type="checkbox"][uid]');
            if (!checkbox || checkbox.disabled
              || checkbox.getAttribute('uid') !== labelOf(choice)?.getAttribute('uid'))
              stop('education_category_leaf_unknown');
            const knownUid = checkbox.getAttribute('uid');
            const knownText = norm(labelOf(choice)?.textContent);
            if (!knownUid || !knownText) stop('education_category_leaf_unknown');
            // EoCascader's search checkbox.checked comes from a cached node,
            // while clicks toggle storageChecked regardless of DOM checked.
            // Its selected-view rows reflect storageChecked even when hidden
            // for single choice; bind the existing selection to the exact UID.
            const selected = selectedRows();
            if (selected.length > 1)
              stop('education_category_existing_selection_unknown');
            if (selected.length === 1
              && (selected[0].getAttribute('uid') !== knownUid || norm(selected[0].textContent) !== knownText)) {
              // Foreign page selection reached only after search/path opened the
              // leaf list. Clear when overwrite allowed, then ask the outer
              // category pass to re-run lookup once (choice nodes go stale).
              if (target.allowCategoryOverwrite === true) {
                await clearForeignSelection(selected[0]);
                stop('education_category_cleared_need_reselect');
              }
              stop('education_category_existing_selection_unknown');
            }
            if (selected.length === 1) {
              if (!acceptsCategory(control.value))
                stop('education_category_existing_selection_unknown');
              // Explicit replacement must operate the actual selected leaf.
              // A single-choice widget may commit the empty value and close
              // when the selected checkbox is clicked; pick that same UID back.
              selectorStep('category_deselect');commit();
              const deselectTargets = [checkbox, checkbox.closest('label')].filter(Boolean);
              let deselected = false;
              for (const node of deselectTargets) {
                if (!node?.isConnected) continue;
                await boundAction(()=>{if(!(node)?.isConnected)stop('profile_action_target_changed');return node.click();});
                await pause(160);
                guard(true);
                if (selectedRows().length === 0) { deselected = true; break; }
              }
              if (!deselected) stop('education_category_existing_selection_unknown');
              if (!visible(popup)) {
                if (openMenus().length) stop('education_other_menu_open');
                selectorStep('category_reopen');
                await boundAction(()=>{if(!(trigger)?.isConnected)stop('profile_action_target_changed');return trigger.click();});
                popup = await waitFor(() => {
                  guard(true);
                  const menus = openMenus();
                  if (menus.length > 1) stop('education_menu_not_unique');
                  const menu = menus[0];
                  if (menu && (!menu.matches('.popover.plugin-dialog-wrap') || !item.contains(menu)))
                    stop('education_wrong_widget_menu');
                  return menu;
                });
                const search = [...popup.querySelectorAll('.search-input')].filter(visible);
                if (search.length !== 1 || !(search[0] instanceof HTMLInputElement)
                  || search[0].readOnly || search[0].disabled)
                  stop('education_category_search_unknown');
                const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
                if (!setter) stop('native_setter_missing');
                await boundAction(()=>{if(!(search[0])?.isConnected)stop('profile_action_target_changed');return setter.call(search[0], knownText);});
                selectorStep('category_reselect_search');
                await boundAction(()=>{if(!(search[0])?.isConnected)stop('profile_action_target_changed');return search[0].dispatchEvent(new Event('input',{bubbles:true}));});
              }
              const sameLeaf = () => {
                guard(true);
                const exact = [...popup.querySelectorAll('li.branch:not(.has-child)')]
                  .filter(node => visible(node) && norm(labelOf(node)?.textContent) === knownText
                    && labelOf(node)?.getAttribute('uid') === knownUid);
                if (exact.length > 1) stop('education_option_ambiguous');
                return exact[0] || null;
              };
              let again;
              selectorStep('category_reselect_lookup');
              const deadline = Date.now() + 3500;
              do {again = sameLeaf();if (again) break;await pause(70);} while (Date.now() < deadline);
              if (!again) stop('education_category_reselect_missing');
              await pause(150);
              if (sameLeaf() !== again || !enabled(again)) stop('education_option_changed');
              const againCheckbox = again.querySelector(':scope > label > input[type="checkbox"][uid]');
              if (!againCheckbox || againCheckbox.disabled || selectedRows().length !== 0
                || againCheckbox.getAttribute('uid') !== knownUid)
                stop('education_category_reselect_unknown');
              selectorStep('category_reselect_click');await boundAction(()=>{if(!(againCheckbox)?.isConnected)stop('profile_action_target_changed');return againCheckbox.click();});await pause(180);
              if (visible(popup)) {
                await confirmCategory(knownUid, knownText);
              }
              return;
            }
            selectorStep('category_option_click');commit();await boundAction(()=>{if(!(checkbox)?.isConnected)stop('profile_action_target_changed');return checkbox.click();});await pause(150);
            if (visible(popup)) {
              await confirmCategory(knownUid, knownText);
            }
          };
          let categoryReselectAttempt = 0;
          for (;;) {
            try {
          if (path.length === 1) {
            selectorStep('category_search');
            const searches = [...popup.querySelectorAll('.search-input')].filter(visible);
            const results = popup.querySelector(':scope > .dialog-search-wrap');
            if (searches.length !== 1 || !(searches[0] instanceof HTMLInputElement)
              || searches[0].readOnly || searches[0].disabled || searches[0].value !== '' || !results)
              stop('education_category_search_unknown');
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
            if (!setter) stop('native_setter_missing');
            // Search is an ephemeral filter, never an applicant field write.
            await boundAction(()=>{if(!(searches[0])?.isConnected)stop('profile_action_target_changed');return setter.call(searches[0], answer);});
            await boundAction(()=>{if(!(searches[0])?.isConnected)stop('profile_action_target_changed');return searches[0].dispatchEvent(new Event('input',{bubbles:true}));});
            const candidates = () => {
              guard();
              if (!visible(results)) return [];
              const rows = [...results.querySelectorAll(':scope > .eo-cascader-menu.simple-tree-outer > .simple-tree-wrapper > li.branch')]
                .filter(visible);
              if (rows.length > 100) stop('education_category_search_too_broad');
              const exact = rows.filter(row => !row.classList.contains('has-child')
                && norm(labelOf(row)?.textContent) === norm(answer));
              if (exact.length > 1) stop('education_option_ambiguous');
              return exact;
            };
            const first = await waitFor(() => {const found=candidates();return found.length===1?found[0]:null;});
            await pause(160);
            const stable = candidates();
            if (stable.length !== 1 || stable[0] !== first) stop('education_option_changed');
            await chooseLeaf(first);
          } else for (let depth = 0; depth < path.length; depth += 1) {
            selectorStep('category_path_lookup');
            guard();
            const columns = [...popup.querySelectorAll('.eo-cascader-menu.simple-tree-outer')]
              .filter(node => visible(node) && !node.closest('.dialog-search-wrap'));
            if (columns.length < depth+1) stop('education_category_level_missing');
            const rows = [...columns[depth].querySelectorAll(':scope > .simple-tree-wrapper > li.branch')]
              .filter(visible);
            const matches = rows.filter(row => norm(labelOf(row)?.textContent) === path[depth]);
            if (matches.length !== 1) stop(matches.length ? 'education_option_ambiguous' : 'education_category_option_missing');
            const choice = matches[0];
            if (!enabled(choice)) stop('education_option_disabled');
            const isBranch = choice.classList.contains('has-child');
            if (depth < path.length-1) {
              if (!isBranch) stop('education_category_path_incomplete');
              selectorStep('category_path_expand');await boundAction(()=>{if(!(labelOf(choice))?.isConnected)stop('profile_action_target_changed');return labelOf(choice).click();});
              await waitFor(() => [...popup.querySelectorAll('.eo-cascader-menu.simple-tree-outer')]
                .filter(node=>visible(node)&&!node.closest('.dialog-search-wrap')).length >= depth+2);
            } else {
              if (isBranch) stop('education_category_path_incomplete');
              await chooseLeaf(choice);
            }
          }

              break;
            } catch (error) {
              if (!(error instanceof TrialStop)
                || error.code !== 'education_category_cleared_need_reselect'
                || categoryReselectAttempt >= 1)
                throw error;
              categoryReselectAttempt += 1;
              selectorStep('category_reselect_after_clear');
              guard(true);
              if (!visible(popup)) await reopenCategory();
              if (selectedRows().length !== 0)
                stop('education_category_existing_selection_unknown');
            }
          }
          // The known path was chosen through its exact parent columns. The
          // site's display may retain the full path or just its terminal name.
          target.acceptsReadback = value => norm(control.value) === norm(value)
            || norm(control.value) === path.at(-1)
            || path.length === 1 && norm(control.value).split('/').at(-1) === path[0];
        }
        selectorStep(field.kind === 'month' ? 'month_close'
          : field.kind === 'select' ? 'degree_close' : 'category_close');
        await waitFor(() => !visible(popup));
        committed = true;
      } finally {
        if (!committed) await close();
      }
    };
    return target;
  }
  const valuesExcept = (form, excluded) => JSON.stringify(
    [...form.querySelectorAll('input,select,textarea')]
      .filter(node => !excluded.includes(node) && !node.closest('.popover.plugin-dialog-wrap'))
      .map(node => [node.tagName,node.type || '',node.value || '',!!node.checked,
        node.selectedIndex ?? null]));
  const sameTarget = (before, after) => before.item === after.item
    && before.controls.length === after.controls.length
    && before.controls.every((node, index) => node === after.controls[index]);

  async function dismissCancelOnly(form) {
    const cancel = cancelButtons(form);
    if (cancel.length !== 1) return false;
    await boundAction(() => {
      if (!(cancel[0])?.isConnected) stop('profile_action_target_changed');
      return cancel[0].click();
    });
    return true;
  }
  // Close foreign editors before education fill. Never clicks 保存/提交/删除.
  async function clearForeignEditors(wantMarker, request) {
    let sections = page();
    for (const form of otherSectionForms(sections)) {
      if (!(await dismissCancelOnly(form))) stop('other_section_editor_open');
    }
    let deadline = Date.now() + 4000;
    do {
      await pause(80);
      sections = page();
      if (!otherSectionForms(sections).length) break;
    } while (Date.now() < deadline);
    if (otherSectionForms(sections).length) stop('other_section_editor_open');
    let edu = forms(sections);
    if (edu.length > 1) stop('editor_structure_changed');
    if (edu.length === 1) {
      const form = edu[0];
      const marker = form.dataset.resumeGthEducationRecordIndex;
      const newTarget = wantMarker === 'new';
      const matches = marker === wantMarker
        && (!newTarget || (form.dataset.resumeGthEducationRequestId === request.requestId
          && form.dataset.resumeGthEducationProfileIndex === String(request.profileIndex)));
      // Wrong leftover education editor from a prior fill-wo-save: cancel so we
      // can open the intended row. Matching marker stays for reuse path.
      if (!matches) {
        if (!(await dismissCancelOnly(form))) stop('unmarked_education_editor');
        deadline = Date.now() + 4000;
        do {
          await pause(80);
          sections = page();
          if (!forms(sections).length) break;
        } while (Date.now() < deadline);
        if (forms(sections).length) stop('unmarked_education_editor');
      }
    }
    return page();
  }

  async function trial(request, full = false) {
    const FIELDS = full ? [...FULL_FIELDS, ...COMPLEX_FIELDS] : TEXT_FIELDS;
    const result = { fields: [], editorLeftOpen: false, writeStarted: false, liveSupportClaimed: false,
      savedOnSite: null, submitted: null, softwareClickedSave: false,
      softwareClickedSubmit: false, softwareClickedDelete: false };
    if (state.busy) return { ok: false, reason: 'fill_in_progress', ...result };
    state.busy = true;activeBinding=request?.profileBinding;lastBinding=activeBinding;
    const progress = {requestId:request?.requestId,activeField:null,
      selectorStep:'request_validation',completedFields:[]};
    state.progress = progress;
    const recordField = (key, field) => {
      result.fields.push(field);
      progress.completedFields.push({key,status:field.status,reason:field.reason});
    };
    const timeOrigin = performance.timeOrigin;
    let openedByUs = false, form;
    const targetMode=request?.targetMode??'existing',newTarget=targetMode==='new';
    result.targetMode=targetMode;result.addClickCount=0;
    try {
      await checkBinding();
      if (!['existing','new'].includes(targetMode)||newTarget&&!full
        ||newTarget&&request?.rowIndex!=null
        ||!newTarget&&(!Number.isInteger(request?.rowIndex)||request.rowIndex<0||request.rowIndex>29)
        || typeof request.requestId !== 'string'
        || request.requestId.length < 8 || request.requestId.length > 120)
        stop('trial_request_invalid');
      if (request.replaceExisting !== undefined && typeof request.replaceExisting !== 'boolean')
        stop('trial_request_invalid');
      if (request.replaceExisting === true && (!full || !Number.isInteger(request.profileIndex)))
        stop('education_replacement_requires_binding');
      const candidates = validateCandidates(request.educationCandidates, full);
      // FULL always binds one explicitly selected source to one target. A
      // blank/missing source fact may be skipped, never borrowed from row 0.
      let explicitCandidate=null;
      if(full){
        if(!Number.isInteger(request.profileIndex)||request.profileIndex<0||request.profileIndex>29)stop('education_binding_invalid');
        const matches=candidates.filter(row=>row.profileIndex===request.profileIndex);
        if(matches.length!==1)stop('education_binding_invalid');explicitCandidate=matches[0];
      }
      selectorStep('page_preflight');
      const wantMarker = newTarget ? 'new' : String(request.rowIndex);
      let sections = await clearForeignEditors(wantMarker, request);
      let allForms = forms(sections);
      const section = sections[1];
      // Capture outside fingerprint only after foreign editors are closed.
      const outsideBefore = outside(sections);
      let targetRecordCount;
      if (allForms.length > 1 || allForms.length === 1 && !section.contains(allForms[0]))
        stop('editor_structure_changed');
      if (otherSectionForms(sections).length)
        stop('other_section_editor_open');
      if (!allForms.length) {
        selectorStep('editor_open');
        const rows = records(section);
        if(rows.length>30||newTarget&&rows.length>=30)stop('education_record_count_not_supported');
        if(!newTarget&&rows.length===0)stop('education_target_record_missing');
        if(!newTarget&&request.rowIndex>=rows.length)stop('education_target_record_missing');
        targetRecordCount=rows.length;
        const edits = newTarget?[...section.querySelectorAll('.title_ a.h-e-btn')]
          .filter(link=>visible(link)&&['添加','新增'].includes(norm(link.textContent))&&enabled(link))
          :[...rows[request.rowIndex].querySelectorAll('a')]
            .filter(link => visible(link) && link.querySelector('.el-icon-edit-outline'));
        if (edits.length !== 1 || edits[0].getAttribute('href')
          && !/^(#|javascript:(?:;|void\(0\)))$/iu.test(edits[0].getAttribute('href')))
          stop(newTarget?'education_add_not_unique':'education_edit_not_unique');
        const otherRecordsBefore=JSON.stringify(rows.filter((_,index)=>newTarget||index!==request.rowIndex).map(snapshot));
        if(outside(page())!==outsideBefore||forms(page()).length!==0)stop('editor_structure_changed');
        await boundAction(()=>{if(!(edits[0])?.isConnected)stop('profile_action_target_changed');return edits[0].click();});if(newTarget)result.addClickCount=1;
        openedByUs = true;
        const deadline = Date.now() + 5000;
        do {
          await pause(80);
          sections = page();
          allForms = forms(sections);
          form = sections[1].querySelector('form');
          if (allForms.length > 1 || allForms.length === 1 && allForms[0] !== form)
            stop('editor_structure_changed');
          if (form && form.querySelector('.el-form-item')) break;
        } while (Date.now() < deadline);
        if (!form || !form.querySelector('.el-form-item') || records(sections[1]).length !== targetRecordCount-(newTarget?0:1)
          || JSON.stringify(records(sections[1]).map(snapshot)) !== otherRecordsBefore)
          stop('education_editor_not_safe');
      } else {
        form = allForms[0];
        targetRecordCount=records(section).length+(newTarget?0:1);
        const markedCount=form.dataset.resumeGthEducationRecordCount;
        if (form.dataset.resumeGthEducationRecordIndex !== (newTarget?'new':String(request.rowIndex))
          ||newTarget&&(form.dataset.resumeGthEducationRequestId!==request.requestId
            ||form.dataset.resumeGthEducationProfileIndex!==String(request.profileIndex))
          ||targetRecordCount>30||!newTarget&&request.rowIndex>=targetRecordCount
          ||markedCount!==undefined&&markedCount!==String(targetRecordCount))
          stop('unmarked_education_editor');
      }
      result.editorLeftOpen = true;
      if (performance.timeOrigin !== timeOrigin || outside(sections) !== outsideBefore
        || forms(sections).length !== 1 || forms(sections)[0] !== form)
        stop('editor_structure_changed');
      const targets = Object.fromEntries(FIELDS.map(field => {
        progress.activeField = field.key;selectorStep('target_preflight');
        return [field.key, target(form, field)];
      }));
      const current = Object.fromEntries(FIELDS.map(field =>
        [field.key, targets[field.key].read()]));
      let candidate;
      progress.activeField = null;selectorStep('row_binding');
      if (full) candidate=explicitCandidate;
      else candidate = matchingCandidate(candidates, current);
      // Check a site's locked qualification before any applicant field is
      // written. A different old qualification must never survive beside a
      // newly written record from another explicit source.
      if(full&&targets.degree?.siteControlDisabled&&candidate.degree
        &&candidate.confirmedPaths.has(`education.${candidate.profileIndex}.degree`)){
        progress.activeField='degree';selectorStep('field_preflight');
        if(norm(targets.degree.read())!==norm(candidate.degree))stop('locked_degree_conflict');
      }
      result.matchedProfileIndex = candidate.profileIndex;
      result.rowIndex = newTarget?null:request.rowIndex;
      result.targetRecordCount=targetRecordCount;
      result.binding=newTarget?'explicit_source_new_provisional':full?'explicit_source_target':'existing_fact_match';
      result.supportsNewRecord=true;
      result.provisionalNewRecord=newTarget;
      form.dataset.resumeGthEducationRecordIndex = newTarget?'new':String(request.rowIndex);
      form.dataset.resumeGthEducationTargetMode=targetMode;
      form.dataset.resumeGthEducationRequestId=request.requestId;
      form.dataset.resumeGthEducationProfileIndex=String(candidate.profileIndex);
      form.dataset.resumeGthEducationRecordCount = String(targetRecordCount);
      const otherRecordsBefore = JSON.stringify(records(sections[1]).map(snapshot));
      let allValuesBefore = valuesExcept(form, []);
      const verifiedReads = new Map();
      const dateKeys=['startDate','endDate'],confirmedDate=key=>!!candidate[key]
        &&candidate.confirmedPaths.has(`education.${candidate.profileIndex}.${key}`);
      const validMonth=value=>/^(19|20)\d{2}-(0[1-9]|1[0-2])$/u.test(value||'');
      const effectiveDates=full?Object.fromEntries(dateKeys.map(key=>[key,confirmedDate(key)?candidate[key]:newTarget?'':current[key]])):{};
      const datePairReady=full&&dateKeys.every(key=>validMonth(effectiveDates[key]));
      if(datePairReady&&effectiveDates.startDate>effectiveDates.endDate)stop('education_date_range_invalid');
      const executionFields=[...FIELDS];
      // Moving a complete existing range later requires the end month first;
      // otherwise the site's old end can reject a valid new start mid-change.
      if(full&&datePairReady&&validMonth(current.endDate)&&effectiveDates.startDate>current.endDate){
        const start=executionFields.findIndex(field=>field.key==='startDate'),end=executionFields.findIndex(field=>field.key==='endDate');
        [executionFields[start],executionFields[end]]=[executionFields[end],executionFields[start]];
      }
      let pendingMonth=null;
      for (const field of executionFields) {
        progress.activeField = field.key;selectorStep('field_decision');
        const path = `education.${candidate.profileIndex}.${field.key}`;
        const answer = candidate[field.key];
        const selectedTarget = targets[field.key];
        const { item, control } = selectedTarget;
        const existing = selectedTarget.read();
        if(full&&field.kind==='month'&&!datePairReady){
          recordField(field.key,{question:field.question,path,status:'skipped',reason:!answer?'missing_profile_value'
            :!candidate.confirmedPaths.has(path)?'profile_fact_unconfirmed':'incomplete_date_pair'});
          continue;
        }
        if(selectedTarget.structureUnsupported){
          recordField(field.key,{question:field.question,path,status:'skipped',
            reason:'education_category_structure_changed'});
          continue;
        }
        if(selectedTarget.siteControlDisabled) {
          recordField(field.key,{question:field.question,path,status:'skipped',reason:'site_control_disabled',
            lockedValueState:existing===''?'empty':!answer?'profile_missing'
              :!candidate.confirmedPaths.has(path)?'profile_unconfirmed'
                :norm(existing)===norm(answer)?'same_as_profile':'different_from_profile'});
          continue;
        }
        if (!answer) {
          recordField(field.key,{question:field.question,path,status:'skipped',
            reason:'missing_profile_value'});
          continue;
        }
        if (!candidate.confirmedPaths.has(path)) {
          recordField(field.key,{question:field.question,path,status:'skipped',
            reason:'profile_fact_unconfirmed'});
          continue;
        }
        // Category already matches intended profile value: verify without
        // reopening the cascader. Under replaceExisting, search/clear still
        // trips original_value_changed → education_category_overwrite_guard
        // even when existingDisplay is already correct (e.g. 金融学).
        if (field.kind === 'category' && existing !== '') {
          const pathParts = String(answer).split('/').map(norm);
          const categoryAlreadyMatches = norm(existing) === norm(answer)
            || norm(existing) === pathParts.at(-1)
            || pathParts.length === 1
              && norm(existing).split('/').at(-1) === pathParts[0];
          if (categoryAlreadyMatches) {
            recordField(field.key,{question:field.question,path,status:'verified',
              reason:'preexisting_same_value',existingDisplay:existing});
            verifiedReads.set(field.key, existing);
            continue;
          }
        }
        if (existing !== '' && request.replaceExisting !== true && !newTarget) {
          recordField(field.key,{question:field.question,path,
            status: norm(existing) === norm(answer) ? 'verified' : 'skipped',
            reason: norm(existing) === norm(answer)
              ? 'preexisting_same_value' : 'existing_value'});
          if (norm(existing) === norm(answer)) verifiedReads.set(field.key, existing);
          continue;
        }
        if (control?.maxLength >= 0 && answer.length > control.maxLength)
          stop('value_too_long');
        const untouchedBefore = valuesExcept(form, selectedTarget.controls);
        selectorStep('field_guard');
        await pause(60);
        sections = page();
        if (performance.timeOrigin !== timeOrigin
          || outside(sections) !== outsideBefore || forms(sections).length !== 1
          || forms(sections)[0] !== form || !sameTarget(selectedTarget, target(form, field))
          || selectedTarget.read() !== existing || valuesExcept(form, []) !== allValuesBefore
          || JSON.stringify(records(sections[1]).map(snapshot)) !== otherRecordsBefore)
          stop('original_value_changed');
        if (selectedTarget.write) {
          try {
            if (selectedTarget.kind === 'category')
              selectedTarget.allowCategoryOverwrite =
                request.replaceExisting === true || newTarget;
            await selectedTarget.write(answer, (allowOwnIntermediate = false) => {
              const live = page();
              // Overwrite clearForeignSelection empties the cascader control before
              // category_search. Plain guard() (no true) must still allow '' / the
              // intended answer, or original_value_changed → overwrite_guard mid-search.
              const categoryOverwrite = selectedTarget.kind === 'category'
                && selectedTarget.allowCategoryOverwrite === true
                && (request.replaceExisting === true || newTarget);
              const ownIntermediate = categoryOverwrite || (allowOwnIntermediate === true
                && selectedTarget.kind === 'category'
                && (request.replaceExisting === true || newTarget));
              let categoryProgressOk = true;
              if (ownIntermediate && selectedTarget.kind === 'category') {
                const readVal = selectedTarget.read();
                const pathParts = String(answer).split('/').map(norm);
                categoryProgressOk = readVal === '' || readVal === existing
                  || norm(readVal) === norm(answer)
                  || norm(readVal) === pathParts.at(-1)
                  || pathParts.length === 1
                    && norm(readVal).split('/').at(-1) === pathParts[0];
              }
              const valuesUnchanged = ownIntermediate
                ? valuesExcept(form, selectedTarget.controls) === untouchedBefore
                  && categoryProgressOk
                : valuesExcept(form, []) === allValuesBefore;
              if (performance.timeOrigin !== timeOrigin || forms(live).length !== 1
                || forms(live)[0] !== form || outside(live) !== outsideBefore
                || !valuesUnchanged
                || JSON.stringify(records(live[1]).map(snapshot)) !== otherRecordsBefore
                || !sameTarget(selectedTarget, target(form, field))) stop('original_value_changed');
            }, () => {result.writeStarted = true;});
          } catch (error) {
            // Soft-skip is correct when: overwrite not allowed; multi selected-view
            // rows; or clearForeignSelection could not uniquely empty the foreign
            // selection. When replaceExisting/new, write clears foreign selection
            // first (category_clear_foreign) so this path should be rare.
            // Chinese: 专业类别已有其他选择，暂未覆盖。
            if (error instanceof TrialStop && field.key === 'majorCategory'
              && (error.code === 'education_category_existing_selection_unknown'
                || error.code === 'education_category_cleared_need_reselect'
                || error.code === 'original_value_changed'
                  && selectedTarget.allowCategoryOverwrite===true)) {
              // Belt-and-suspenders: page already shows intended category →
              // treat as verified rather than overwrite_guard skip.
              const pathParts = String(answer).split('/').map(norm);
              const categoryAlreadyMatches = !!existing && (norm(existing) === norm(answer)
                || norm(existing) === pathParts.at(-1)
                || pathParts.length === 1
                  && norm(existing).split('/').at(-1) === pathParts[0]);
              if (categoryAlreadyMatches) {
                recordField(field.key,{question:field.question,path,status:'verified',
                  reason:'preexisting_same_value',
                  selectorStep:progress?.selectorStep||null,
                  existingDisplay:existing||''});
                verifiedReads.set(field.key, existing);
                continue;
              }
              recordField(field.key,{question:field.question,path,status:'skipped',
                reason:error.code==='original_value_changed'
                  ?'education_category_overwrite_guard'
                  :'education_category_existing_selection_unknown',
                selectorStep:progress?.selectorStep||null,
                allowCategoryOverwrite:selectedTarget.allowCategoryOverwrite===true,
                existingDisplay:existing||'',
                intendedDisplay:String(answer||''),
                liveDisplay:selectedTarget.read?.()||'',
                stopCode:error.code||null});
              continue;
            }
            throw error;
          }
        } else if (selectedTarget.kind === 'radio') {
          selectorStep('radio_option_click');
          const option = selectedTarget.options.find(option => option.text === answer);
          if (!option || option.control.disabled || option.label.classList.contains('is-disabled')
            || option.label.getAttribute('aria-disabled') === 'true')
            stop('education_radio_option_disabled');
          result.writeStarted = true;
          await boundAction(()=>{if(!(option.label)?.isConnected)stop('profile_action_target_changed');return option.label.click();});
        } else {
          selectorStep('text_input_events');
          const prototype = selectedTarget.kind === 'textarea'
            ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
          if (!setter) stop('native_setter_missing');
          // Binding verification yields to the page before every action. Keep
          // the guard inside that await boundary so a connected old control or
          // a newly typed value cannot be overwritten or receive stale events.
          const guardTextAction = expected => {
            if (!control?.isConnected) stop('profile_action_target_changed');
            const live = page();
            if (performance.timeOrigin !== timeOrigin || forms(live).length !== 1
              || forms(live)[0] !== form || outside(live) !== outsideBefore
              || !sameTarget(selectedTarget, target(form, field))
              || selectedTarget.read() !== expected
              || valuesExcept(form, selectedTarget.controls) !== untouchedBefore
              || JSON.stringify(records(live[1]).map(snapshot)) !== otherRecordsBefore)
              stop('original_value_changed');
            if (control.maxLength >= 0 && answer.length > control.maxLength)
              stop('value_too_long');
          };
          await boundAction(() => {
            guardTextAction(existing);
            result.writeStarted = true;
            return setter.call(control, answer);
          });
          await boundAction(() => {
            guardTextAction(answer);
            return control.dispatchEvent(new Event('input', {bubbles:true}));
          });
          await boundAction(() => {
            guardTextAction(answer);
            return control.dispatchEvent(new Event('change', {bubbles:true}));
          });
        }
        selectorStep('field_readback');await pause(250);
        sections = page();
        if (performance.timeOrigin !== timeOrigin || forms(sections).length !== 1
          || forms(sections)[0] !== form || outside(sections) !== outsideBefore
          || !sameTarget(selectedTarget, target(form, field))
          || JSON.stringify(records(sections[1]).map(snapshot)) !== otherRecordsBefore)
          stop('education_editor_changed_after_fill');
        if (!(selectedTarget.acceptsReadback
          ? selectedTarget.acceptsReadback(answer) : selectedTarget.read() === answer))
          stop('readback_mismatch');
        const otherDateKey=field.key==='startDate'?'endDate':'startDate';
        const awaitDatePair=full&&field.kind==='month'&&datePairReady
          &&targets[otherDateKey].item===item&&targets[otherDateKey].read()==='';
        if (!selectedTarget.controls.every(node => validationClear(item, node))){
          // The required monthRangeField validates both months after its first
          // pick. This one proven empty-half message is an intermediate state,
          // never a successful field. Both supplied facts must already exist.
          const errors=[...item.querySelectorAll('.el-form-item__error')].filter(visible).map(node=>norm(node.textContent));
          if(!awaitDatePair||item.classList.contains('is-validating')||errors.length!==1||errors[0]!=='请选择在校时间'
            ||selectedTarget.controls.some(node=>node.validity&&node.validity.valid===false))stop('site_validation_failed');
        }
        if (valuesExcept(form, selectedTarget.controls) !== untouchedBefore)
          stop('other_values_changed');
        allValuesBefore = valuesExcept(form, []);
        verifiedReads.set(field.key, selectedTarget.read());
        const verifiedField={question:field.question,path,
          status:'verified',reason:selectedTarget.reasonOverride
            || (existing === '' ? 'readback_matched' : 'readback_reapplied')};
        if(awaitDatePair){pendingMonth={key:field.key,field:verifiedField};}
        else{
          if(field.kind==='month'&&pendingMonth){
            if(dateKeys.some(key=>targets[key].read()!==effectiveDates[key]
              ||!targets[key].controls.every(node=>validationClear(targets[key].item,node))))stop('site_validation_failed');
            recordField(pendingMonth.key,pendingMonth.field);pendingMonth=null;
          }
          recordField(field.key,verifiedField);
        }
      }
      if(pendingMonth)stop('education_date_pair_incomplete');
      if (full) {
        result.complete = result.fields.length === 12
          && result.fields.every(field => field.status === 'verified');
        result.scope = 'education_all_controls';
      }
      const outcome = result.fields.some(field => field.reason === 'readback_matched'
        || field.reason === 'readback_reapplied')
        ? 'verified' : result.fields.every(field => field.status === 'verified'
          && field.reason === 'preexisting_same_value')
          ? 'verified_preexisting' : 'failed_before_write';
      progress.activeField = null;selectorStep('complete');
      const diagnostics = diagnostic(progress);
      await checkBinding();state.last = {requestId:request.requestId, outcome, diagnostics,targetMode,profileIndex:candidate.profileIndex,
        recordMarker:newTarget?'new':String(request.rowIndex),targetRecordCount,provisionalNewRecord:newTarget,
        currentCheck: () => {
          try {
            const live = page();
            return forms(live).length === 1 && forms(live)[0] === form
              && outside(live) === outsideBefore
              && JSON.stringify(records(live[1]).map(snapshot)) === otherRecordsBefore
              && valuesExcept(form, []) === allValuesBefore
              && result.fields.every(field => {
                if (field.status !== 'verified') return true;
                const spec = FIELDS.find(item => item.question === field.question);
                return !!spec && sameTarget(targets[spec.key], target(form, spec))
                  && targets[spec.key].read() === verifiedReads.get(spec.key);
              });
          } catch { return false; }
        }};
      return {ok:true, ...result, ...diagnostics};
    } catch (error) {
      const reason = error instanceof TrialStop ? error.code : 'education_trial_failed';
      if (openedByUs && !result.writeStarted && form?.isConnected) {
        const cancel = cancelButtons(form);
        if (cancel.length === 1) {
          try{await boundAction(()=>{if(!(cancel[0])?.isConnected)stop('profile_action_target_changed');return cancel[0].click();});
          result.editorLeftOpen = false;}catch{}
        }
      }
      const diagnostics = diagnostic(progress,reason);
      if (request?.requestId) state.last = {requestId:request.requestId,
        outcome: result.writeStarted ? 'unknown' : 'failed_before_write',diagnostics};
      return {ok:false, ...result, ...diagnostics};
    } finally { state.busy = false;activeBinding=null; }
  }
  const listener = (message, _sender, sendResponse) => {
    if (message?.type === 'GTH_EDUCATION_TEXT_TRIAL_STATUS'
      || message?.type === 'GTH_EDUCATION_FULL_TRIAL_STATUS') {
      (async()=>{if(message.profileBinding)await checkBinding(message.profileBinding);await checkBinding(lastBinding||activeBinding);
      const last = state.last;
      const valid = last && last.requestId === message.requestId;
      const outcome = valid && last.currentCheck
        ? last.currentCheck() ? last.outcome : 'unknown'
        : valid ? last.outcome : 'unknown';
      const running = state.busy && state.progress?.requestId === message.requestId;
      const diagnostics = running ? diagnostic(state.progress)
        : valid ? last.diagnostics || diagnostic(null) : diagnostic(null);
      sendResponse({ok:true,data:{requestId:message.requestId,
        state:running ? 'running' : 'settled',outcome,...diagnostics,
        ...(valid?{targetMode:last.targetMode,profileIndex:last.profileIndex,recordMarker:last.recordMarker,
          targetRecordCount:last.targetRecordCount,provisionalNewRecord:last.provisionalNewRecord}:{})}});
      
      })().catch(()=>sendResponse({ok:false,error:'profile_binding_changed',data:{requestId:message.requestId,state:'settled',outcome:'unknown'}}));return true;
    }
    if (message?.type !== 'GTH_EDUCATION_TEXT_TRIAL'
      && message?.type !== 'GTH_EDUCATION_FULL_TRIAL') return;
    trial(message, message.type === 'GTH_EDUCATION_FULL_TRIAL').then(sendResponse, () => sendResponse({ok:false,
      reason:'education_trial_failed'}));
    return true;
  };
  globalThis.ResumeGthEducationTextTrial = Object.freeze({implementationRevision:4,installed:true,
    trial: request => trial(request, false),
    fullTrial: request => trial(request, true), listener});
  chrome.runtime.onMessage.addListener(listener);
})();
