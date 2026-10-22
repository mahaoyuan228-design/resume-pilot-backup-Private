// Browser-side GTH education Never-Save guard and DOM readback.
// Selectors mirror shipped writers; runtime observations are not live-support claims.
export function installGthEducationLive(doc, options) {
  const view = doc.defaultView;
  view.__gthEducationLive?.restore();
  const titles = options.titles;
  const pageUrl = options.pageUrl;
  const sectionIndex = options.sectionIndex;
  const posts = [];
  const clicks = [];
  const norm = (value) => String(value ?? '').replace(/[\s\u00a0]+/gu, ' ').trim();
  const banned = ['保存', '提交', '投递', '删除'];
  const panelSelector = '.el-select-dropdown,.el-picker-panel,.popover.plugin-dialog-wrap';
  let activePicker = null;
  let beforeCancel = [];
  function visible(node) {
    if (!node || node.nodeType !== 1 || !node.isConnected) return false;
    let cur = node;
    while (cur && cur.nodeType === 1) {
      if (cur.hasAttribute('hidden')) return false;
      const style = view.getComputedStyle(cur);
      if (!style || style.display === 'none' || style.visibility === 'hidden') return false;
      cur = cur.parentElement;
    }
    return !!node.getClientRects().length;
  }
  function hrefSafe(node) {
    if (!node || node.tagName !== 'A') return false;
    const href = node.getAttribute('href');
    if (href == null) return true;
    const text = href.trim();
    if (text === '' || text === '#') return true;
    return /^javascript:(?:;|void\(0\))$/iu.test(text);
  }
  function enabled(node) {
    return !!node && !node.disabled && node.getAttribute('aria-disabled') !== 'true'
      && !node.classList.contains('is-disabled') && !node.classList.contains('disabled');
  }
  function ownLabel(item) {
    const labels = [...item.querySelectorAll('.el-form-item__label')]
      .filter(node => node.closest('.el-form-item') === item);
    return labels.length === 1 ? norm(labels[0].textContent) : '';
  }
  function uniqueItem(form, question) {
    const items = [...form.querySelectorAll('.el-form-item')]
      .filter(item => item.closest('form') === form && ownLabel(item) === question);
    return items.length === 1 ? items[0] : null;
  }
  function openPanels() {
    return [...doc.querySelectorAll(panelSelector)].filter(visible);
  }
  function ownedPanel() {
    if (!activePicker || !activePicker.trigger.isConnected || !activePicker.input.isConnected) return null;
    const form = editorForm().form;
    if (!form || !form.contains(activePicker.item)) return null;
    const panels = openPanels();
    if (panels.length !== 1) return null;
    const panel = panels[0];
    const expected = activePicker.kind === 'degree' ? '.el-select-dropdown'
      : activePicker.kind === 'month' ? '.el-picker-panel' : '.popover.plugin-dialog-wrap';
    if (!panel.matches(expected) || activePicker.before.has(panel)) return null;
    const section = panel.closest('.r-section');
    if (section && section !== educationSection().section) return null;
    if (activePicker.kind === 'category' && !activePicker.item.contains(panel)) return null;
    const references = ['aria-controls', 'aria-owns'].flatMap(name =>
      (activePicker.input.getAttribute(name) || '').split(/\s+/u).filter(Boolean));
    if (references.length && !references.includes(panel.id)) return null;
    if (activePicker.panel && activePicker.panel !== panel) return null;
    activePicker.panel = panel;
    return panel;
  }
  function triggerInfo(node, form) {
    for (const [question, kind] of [['学历', 'degree'], ['在校时间', 'month'], ['专业类别', 'category']]) {
      const item = uniqueItem(form, question);
      if (!item || !item.contains(node) || node.closest(panelSelector)) continue;
      const inputs = [...item.querySelectorAll('input[type="text"]')]
        .filter(input => input.closest('.el-form-item') === item && !input.closest(panelSelector) && visible(input));
      if (kind === 'degree') {
        const selects = [...item.querySelectorAll('.el-select')];
        if (selects.length === 1 && inputs.length === 1 && node === inputs[0]
          && selects[0].contains(node) && enabled(node)) return { item, kind, input: node, trigger: node };
      } else if (kind === 'month') {
        const editors = [...item.querySelectorAll('.el-date-editor')];
        if (editors.length !== 2 || inputs.length !== 2
          || !editors.every(editor => editor.matches('.el-date-editor--month'))) continue;
        for (const editor of editors) {
          const icons = [...editor.querySelectorAll('.el-input__prefix .el-input__icon.el-icon-date')].filter(visible);
          const input = inputs.find(control => editor.contains(control));
          if (icons.length === 1 && node === icons[0] && enabled(node) && enabled(input))
            return { item, kind, input, trigger: node };
        }
      } else {
        const triggers = [...item.querySelectorAll('.cascader-wrap > .input-l.pointer,.professional-category > .input-l.pointer')].filter(visible);
        if (triggers.length === 1 && inputs.length === 1 && node === triggers[0]
          && triggers[0].contains(inputs[0]) && inputs[0].readOnly && enabled(inputs[0]))
          return { item, kind, input: inputs[0], trigger: triggers[0] };
      }
    }
    return null;
  }
  function radioChoice(node, form) {
    const item = uniqueItem(form, '是否统招');
    if (!item || !item.contains(node)) return null;
    const radios = [...item.querySelectorAll('input[type="radio"]')];
    const labels = radios.map(input => input.closest('label.el-radio'));
    if (radios.length !== 2 || labels.some(label => !label || !visible(label))) return null;
    const texts = labels.map(label => norm(label.querySelector('.el-radio__label')?.textContent || label.textContent));
    if (!texts.includes('是') || !texts.includes('否')) return null;
    const group = radios[0].closest('.el-radio-group');
    const sharedGroup = group && item.contains(group) && radios.every(input => input.closest('.el-radio-group') === group);
    if (!sharedGroup && !(radios[0].name && radios.every(input => input.name === radios[0].name))) return null;
    const index = labels.findIndex(label => label.contains(node));
    if (index < 0 || !enabled(labels[index]) || !enabled(radios[index])
      || node !== radios[index] && !visible(node)
      || node !== labels[index] && node !== radios[index]
        && !node.matches('.el-radio__label,.el-radio__input,.el-radio__inner')) return null;
    return texts[index];
  }
  function classify(target) {
    const node = target?.nodeType === 1 ? target : target?.parentElement;
    const text = norm(node?.textContent);
    const denied = () => ({ type: 'click', kind: 'forbidden', label: (text || 'empty').slice(0, 40), allowed: false });
    const allow = (kind, label = text) => ({ type: 'click', kind, label: (label || kind).slice(0, 40), allowed: true });
    const found = educationSection();
    if (!node || !node.isConnected || !found.section) return denied();
    const host = node.closest('button,a,input[type="submit"],input[type="image"]');
    if (host && ((host.matches('button') && host.type !== 'button')
      || host.matches('input[type="submit"],input[type="image"]')
      || host.hasAttribute('formaction') || host.matches('a') && !hrefSafe(host)
      || !enabled(host))) return denied();
    const hostText = norm(host?.textContent || node.textContent);
    if (banned.some(word => hostText.includes(word) || text.includes(word))) return denied();
    const form = editorForm().form;
    // The writer first discards stale editors in other sections. Restrict that
    // exception to one inert 取消 button in a visible form on this exact page.
    const cancel = node.closest('button');
    if (cancel && cancel.type === 'button' && norm(cancel.textContent) === '取消'
      && visible(cancel) && enabled(cancel) && !cancel.hasAttribute('formaction')) {
      const owner = cancel.closest('form');
      const section = owner?.closest('.r-section');
      const cancels = owner ? [...owner.querySelectorAll('button')].filter(button =>
        visible(button) && button.type === 'button' && norm(button.textContent) === '取消') : [];
      if (section && found.page.list.includes(section) && cancels.length === 1
        && !cancel.closest(panelSelector)) return allow('cancel', '取消');
    }
    const anchor = node.closest('a');
    if (anchor && visible(anchor) && hrefSafe(anchor) && !form
      && anchor.closest('.r-section') === found.section) {
      const row = anchor.closest('.sec-context > .sec-detail');
      const iconEdit = row && anchor.querySelector('.el-icon-edit-outline')
        && ['', '编辑'].includes(norm(anchor.textContent));
      const add = anchor.matches('a.h-e-btn') && anchor.closest('.title_')
        && ['添加', '新增'].includes(norm(anchor.textContent));
      if (iconEdit || add) return allow(iconEdit ? 'edit' : 'add', norm(anchor.textContent) || '编辑');
    }
    if (!form) return denied();
    const radio = radioChoice(node, form);
    if (radio && !node.closest(panelSelector)) return allow('radio_option', radio);
    if (!visible(node) && !node.matches('input[type="checkbox"]')) return denied();
    const trigger = triggerInfo(node, form);
    if (trigger) {
      const panels = openPanels();
      if (panels.length) {
        if (activePicker?.trigger !== node || !ownedPanel()) return denied();
      } else {
        activePicker = { ...trigger, before: new Set(panels), panel: null };
      }
      return allow('picker_trigger', trigger.kind);
    }
    const panel = ownedPanel();
    if (!panel || !panel.contains(node)) return denied();
    if (activePicker.kind === 'degree') {
      const option = node.closest('.el-select-dropdown__item');
      if (option && panel.contains(option) && visible(option) && enabled(option)
        && !option.querySelector('button,a,input')) return allow('select_option', norm(option.textContent));
    } else if (activePicker.kind === 'month') {
      const arrow = node.closest('.el-icon-d-arrow-left,.el-icon-d-arrow-right');
      if (arrow && panel.contains(arrow) && visible(arrow) && enabled(arrow)
        && arrow.closest('.el-date-picker__header')) return allow('month_navigation', arrow.classList.contains('el-icon-d-arrow-left') ? 'previous_year' : 'next_year');
      const cell = node.closest('.el-month-table td');
      const tables = [...panel.querySelectorAll('.el-month-table')].filter(visible);
      if (cell && tables.length === 1 && tables[0].contains(cell) && visible(cell) && enabled(cell)
        && !cell.querySelector('button,input,select,textarea')
        && (node === cell || node.matches('a.cell,span'))
        && tables[0].querySelectorAll('td').length === 12
        && /^(?:[一二三四五六七八九十]{1,3}|[1-9]|1[0-2])月$/u.test(norm(cell.textContent)))
        return allow('month_option', norm(cell.textContent));
    } else {
      const confirm = node.closest('a.pop-btn.confirm');
      if (confirm && panel.contains(confirm) && visible(confirm) && enabled(confirm)
        && norm(confirm.textContent) === '确定' && hrefSafe(confirm)
        && [...panel.querySelectorAll('a.pop-btn.confirm')].filter(visible).length === 1) {
        const selected = [...panel.querySelectorAll('.selected-view-data > li')].filter(visible);
        if (activePicker.lastLeaf && selected.length === 1
          && selected[0].getAttribute('uid') === activePicker.lastLeaf.uid
          && norm(selected[0].textContent) === activePicker.lastLeaf.text)
          return allow('category_confirm', '确定');
        return denied();
      }
      if (hostText.includes('确定') || text.includes('确定')) return denied();
      const branch = node.closest('li.branch');
      if (!branch || !panel.contains(branch) || !branch.closest('.eo-cascader-menu')
        || !visible(branch) || !enabled(branch)) return denied();
      const label = branch.querySelector(':scope > label');
      const span = branch.querySelector(':scope > label > span[uid],:scope > label > span,:scope > span');
      if (branch.classList.contains('has-child')) {
        if (node === span) return allow('category_branch', norm(span.textContent));
      } else {
        const boxes = [...branch.querySelectorAll(':scope > label > input[type="checkbox"][uid]')];
        if (boxes.length === 1 && enabled(boxes[0]) && boxes[0].getAttribute('uid')
          && boxes[0].getAttribute('uid') === span?.getAttribute('uid')
          && (node === boxes[0] || node === label || node === span)) {
          activePicker.lastLeaf = { uid: boxes[0].getAttribute('uid'), text: norm(span.textContent) };
          return allow('category_option', norm(span.textContent));
        }
      }
    }
    return denied();
  }

  function note(method, url, via) {
    const verb = String(method || 'GET').toUpperCase();
    if (!verb || verb === 'GET' || verb === 'HEAD' || verb === 'OPTIONS') return true;
    if (posts.length < 80) posts.push({ via, method: verb, url: redactUrl(url) });
    return false;
  }
  function blockedRequest() {
    const error = new Error('disallowed_non_get');
    error.reason = 'disallowed_non_get';
    return error;
  }
  function installTap() {
    const originalFetch = view.fetch;
    const xhr = view.XMLHttpRequest;
    const originalOpen = xhr?.prototype?.open;
    const originalSend = xhr?.prototype?.send;
    const originalBeacon = view.navigator?.sendBeacon;
    const originalClick = view.HTMLElement?.prototype?.click;
    const originalDispatch = view.EventTarget.prototype.dispatchEvent;
    const formPrototype = view.HTMLFormElement?.prototype;
    const originalSubmit = formPrototype?.submit;
    const originalRequestSubmit = formPrototype?.requestSubmit;
    if (typeof originalFetch === 'function') {
      view.fetch = function fetchTap(input, init, ...rest) {
        const method = String((init && init.method) || (typeof input === 'object' && input ? input.method : '') || 'GET').toUpperCase();
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        if (!note(method, url, 'fetch')) return Promise.reject(blockedRequest());
        return originalFetch.call(this, input, init, ...rest);
      };
    }
    if (originalOpen && originalSend) {
      xhr.prototype.open = function openTap(method, url, ...rest) {
        this.__gthEducationLive = { method: String(method || 'GET').toUpperCase(), url: String(url || '') };
        return originalOpen.call(this, method, url, ...rest);
      };
      xhr.prototype.send = function sendTap(...rest) {
        if (this.__gthEducationLive && !note(this.__gthEducationLive.method, this.__gthEducationLive.url, 'xhr')) {
          throw blockedRequest();
        }
        return originalSend.call(this, ...rest);
      };
    }
    if (typeof originalBeacon === 'function' && view.navigator) {
      view.navigator.sendBeacon = function beaconTap(url, ...rest) {
        if (!note('POST', url, 'beacon')) return false;
        return originalBeacon.call(this, url, ...rest);
      };
    }
    function recordClick(decision) {
      if (clicks.length < 500) clicks.push(decision);
      else if (clicks.length === 500) clicks.push({ type: 'click', kind: 'forbidden', label: 'click_log_overflow', allowed: false });
    }
    function guardClick(node) {
      const decision = classify(node);
      if (!decision.allowed) {
        recordClick(decision);
        const error = new Error('refusing_forbidden_click');
        error.reason = 'refusing_forbidden_click';
        throw error;
      }
    }
    if (typeof originalClick === 'function') {
      view.HTMLElement.prototype.click = function clickTap(...rest) {
        guardClick(this);
        return originalClick.call(this, ...rest);
      };
    }
    view.EventTarget.prototype.dispatchEvent = function dispatchTap(event) {
      if (event?.type === 'click') guardClick(this);
      return originalDispatch.call(this, event);
    };
    function clickCapture(event) {
      const decision = classify(event.target);
      recordClick(decision);
      if (decision.allowed && decision.kind === 'cancel'
        && event.target.closest('form') === editorForm().form) {
        // The writer may discard an invalid editor before returning. Retain
        // only bounded structure, never a stale value that could verify a fill.
        beforeCancel = read(options.questions || []).readback.map(row => ({
          q: row.q, detail: row.detail || null, dom: row.dom
        }));
      }
      if (!decision.allowed) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }
    view.addEventListener('click', clickCapture, true);
    function blockSubmit(event) {
      recordClick({ type: 'submit', kind: 'forbidden', label: 'form_submit', allowed: false });
      const form = event?.target && event.target.tagName === 'FORM' ? event.target : this;
      note(form?.method || 'GET', form?.action || '', 'submit');
      if (event?.preventDefault) event.preventDefault();
      if (event?.stopImmediatePropagation) event.stopImmediatePropagation();
      throw blockedRequest();
    }
    if (formPrototype) {
      formPrototype.submit = function submitTap() { return blockSubmit.call(this); };
      if (originalRequestSubmit) formPrototype.requestSubmit = function requestSubmitTap() { return blockSubmit.call(this); };
    }
    doc.addEventListener('submit', blockSubmit, true);
    return function removeTap() {
      if (typeof originalFetch === 'function') view.fetch = originalFetch;
      if (originalOpen) xhr.prototype.open = originalOpen;
      if (originalSend) xhr.prototype.send = originalSend;
      if (typeof originalBeacon === 'function' && view.navigator) view.navigator.sendBeacon = originalBeacon;
      if (typeof originalClick === 'function') view.HTMLElement.prototype.click = originalClick;
      view.EventTarget.prototype.dispatchEvent = originalDispatch;
      view.removeEventListener('click', clickCapture, true);
      if (formPrototype) {
        if (originalSubmit) formPrototype.submit = originalSubmit;
        if (originalRequestSubmit) formPrototype.requestSubmit = originalRequestSubmit;
      }
      doc.removeEventListener('submit', blockSubmit, true);
    };
  }
  const removeTap = installTap();

  function sections() {
    return [...doc.querySelectorAll('.r-section')];
  }
  function titleOf(section) {
    const node = section.querySelector('.title_')?.cloneNode(true);
    node?.querySelectorAll('a,button').forEach((child) => child.remove());
    return norm(node?.textContent);
  }
  function pageState() {
    let href = '';
    try { href = String(view.location.href || ''); } catch { href = ''; }
    const list = sections();
    return {
      href,
      hrefOk: href === pageUrl,
      readyState: doc.readyState,
      visible: doc.visibilityState === 'visible',
      titlesOk: JSON.stringify(list.map(titleOf)) === JSON.stringify(titles),
      list
    };
  }
  function educationSection() {
    const page = pageState();
    if (!page.hrefOk || page.readyState !== 'complete' || !page.visible || !page.titlesOk) return { page, section: null };
    return { page, section: page.list[sectionIndex] || null };
  }
  function inspect() {
    const found = educationSection();
    const section = found.section;
    if (!section) {
      return { ok: false, reason: found.page.hrefOk ? 'section_structure_changed' : 'wrong_page', titleEditCount: 0, addCount: 0, rowCount: 0, rowIconCounts: [] };
    }
    const titleLinks = [...section.querySelectorAll('.title_ a.h-e-btn')];
    const rows = [...section.querySelectorAll('.sec-context > .sec-detail')];
    return {
      ok: true,
      reason: null,
      titleEditCount: titleLinks.filter((node) => visible(node) && norm(node.textContent) === '编辑').length,
      addCount: titleLinks.filter((node) => visible(node) && (norm(node.textContent) === '添加' || norm(node.textContent) === '新增')).length,
      rowCount: rows.length,
      rowIconCounts: rows.map((row) => [...row.querySelectorAll('a')].filter((node) => visible(node) && node.querySelector('.el-icon-edit-outline')).length)
    };
  }
  function formsInSection() {
    const section = educationSection().section;
    return section ? [...section.querySelectorAll('form')] : [];
  }
  function editorForm() {
    const forms = formsInSection();
    if (forms.length !== 1) {
      return { ok: false, reason: 'control_not_supported', detail: forms.length ? 'editor_not_unique' : 'editor_not_open', form: null };
    }
    return { ok: true, form: forms[0] };
  }
  function read(questions) {
    const found = editorForm();
    const wanted = Array.isArray(questions) ? questions : [];
    if (!found.ok) {
      return {
        ok: false,
        reason: found.reason,
        detail: found.detail,
        readback: wanted.map(q => {
          const previous = beforeCancel.find(row => row.q === q);
          return { q, value: null, reason: 'control_not_supported',
            detail: previous ? 'editor_closed_after_trial' : found.detail,
            dom: previous ? { ...previous.dom, stage: 'before_cancel',
              readDetail: previous.detail, currentFormCount: formsInSection().length }
              : { formCount: formsInSection().length } };
        }),
        extraLabels: [],
        unlabeled: 0
      };
    }
    const form = found.form;
    const items = [...form.querySelectorAll('.el-form-item')].filter((item) => item.closest('form') === form);
    const labeled = [];
    let unlabeled = 0;
    for (const item of items) {
      const labels = [...item.querySelectorAll('.el-form-item__label')].filter((node) => node.closest('.el-form-item') === item);
      if (labels.length !== 1) {
        unlabeled += 1;
        continue;
      }
      labeled.push({ item, q: norm(labels[0].textContent) });
    }
    const describe = matches => ({
      itemCount: matches.length,
      items: matches.slice(0, 3).map(({ item }) => ({
        tag: item.tagName.toLowerCase(),
        classes: [...item.classList].slice(0, 8),
        controls: [...item.querySelectorAll('input,select,textarea')].slice(0, 12).map(node => ({
          tag: node.tagName.toLowerCase(), type: String(node.type || '').slice(0, 20),
          classes: [...node.classList].slice(0, 8), visible: visible(node),
          disabled: !!node.disabled, readOnly: !!node.readOnly,
          inPopup: !!node.closest(panelSelector)
        })),
        selectCount: item.querySelectorAll('.el-select').length,
        monthEditorCount: item.querySelectorAll('.el-date-editor--month').length,
        dateEditorCount: item.querySelectorAll('.el-date-editor').length,
        categoryCount: item.querySelectorAll('.cascader-wrap,.professional-category').length,
        popupCount: item.querySelectorAll(panelSelector).length
      })),
      visiblePanels: openPanels().slice(0, 4).map(panel => ({
        tag: panel.tagName.toLowerCase(), classes: [...panel.classList].slice(0, 8),
        inEducation: educationSection().section?.contains(panel) === true,
        owned: activePicker?.panel === panel
      }))
    });
    const readback = wanted.map((q) => {
      const matches = labeled.filter(row => row.q === q);
      const dom = describe(matches);
      const unsupported = detail => ({ q, value: null, reason: 'control_not_supported', detail, dom });
      if (matches.length !== 1) return unsupported('item_not_unique');
      const item = matches[0].item;
      const controls = [...item.querySelectorAll('input,textarea,select')].filter(node =>
        node.closest('.el-form-item') === item && !node.closest(panelSelector) && visible(node));
      const textInputs = controls.filter(node => node instanceof view.HTMLInputElement && node.type === 'text');
      let value;
      if (q === '是否统招') {
        const radios = [...item.querySelectorAll('input[type="radio"]')]
          .filter(node => node.closest('.el-form-item') === item && !node.closest(panelSelector));
        if (radios.length !== 2 || radios.some(node => !radioChoice(node, form)))
          return unsupported('radio_structure_changed');
        const selected = radios.filter(node => node.checked);
        if (selected.length > 1) return unsupported('radio_selection_ambiguous');
        value = selected.length ? radioChoice(selected[0], form) : '';
      } else if (q === '在校时间') {
        const editors = [...item.querySelectorAll('.el-date-editor')];
        if (editors.length !== 2 || textInputs.length !== 2 || controls.length !== 2
          || !editors.every(editor => editor.matches('.el-date-editor--month')))
          return unsupported('month_structure_changed');
        const inputs = editors.map(editor => textInputs.filter(input => editor.contains(input)));
        if (inputs.some(list => list.length !== 1)) return unsupported('month_input_not_unique');
        const values = inputs.map(list => String(list[0].value));
        if (values.some(part => part !== '' && !/^(19|20)\d{2}-(0[1-9]|1[0-2])$/u.test(part)))
          return unsupported('month_value_unknown');
        return { q, value: values.join(' 至 '), values, reason: null, dom };
      } else if (q === '学历') {
        const selects = [...item.querySelectorAll('.el-select')];
        if (selects.length !== 1 || textInputs.length !== 1 || controls.length !== 1
          || !selects[0].contains(textInputs[0])) return unsupported('select_structure_changed');
        if (textInputs[0].disabled) return unsupported('site_control_disabled');
        value = String(textInputs[0].value);
      } else if (q === '专业类别') {
        const widgets = [...item.querySelectorAll('.cascader-wrap,.professional-category')];
        if (widgets.length !== 1 || textInputs.length !== 1 || controls.length !== 1
          || !textInputs[0].readOnly || textInputs[0].disabled
          || !widgets[0].querySelector(':scope > .input-l.pointer')?.contains(textInputs[0])
          || widgets[0].querySelectorAll(':scope > .popover.plugin-dialog-wrap').length !== 1)
          return unsupported('category_structure_changed');
        value = String(textInputs[0].value);
      } else {
        const textarea = ['在校活动/职务', '专业描述'].includes(q);
        const known = ['毕业学校', '专业名称', '在校活动/职务', '在校成绩排名', '专业描述', '绩点', '学校所在地'].includes(q);
        if (!known || controls.length !== 1 || item.querySelector('.el-select,.el-date-editor,.el-cascader,.cascader-wrap')
          || textarea && !(controls[0] instanceof view.HTMLTextAreaElement)
          || !textarea && !(controls[0] instanceof view.HTMLInputElement && controls[0].type === 'text'))
          return unsupported('plain_structure_changed');
        value = String(controls[0].value);
      }
      return { q, value, reason: null, dom };
    });
    const known = new Set(wanted);
    const extraLabels = labeled.map((row) => row.q).filter((q) => q && !known.has(q));
    return { ok: true, readback, extraLabels, unlabeled };
  }
  async function waitFor(readWait, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    do {
      const found = readWait();
      if (found) return found;
      await new Promise((resolve) => view.setTimeout(resolve, 60));
    } while (Date.now() < deadline);
    return null;
  }
  async function cancel() {
    const forms = formsInSection();
    if (forms.length === 0) return { ok: true, closed: true, alreadyClosed: true, reason: null };
    const found = editorForm();
    if (!found.ok) return { ok: false, closed: false, reason: 'control_not_supported', detail: found.detail || 'editor_not_open' };
    const form = found.form;
    const buttons = [...form.querySelectorAll('button')].filter((node) => visible(node) && norm(node.textContent) === '取消');
    const decision = decideCancel({
      cancelCount: buttons.length,
      cancelText: buttons.length === 1 ? norm(buttons[0].textContent) : '',
      cancelType: buttons.length === 1 ? String(buttons[0].type || '').toLowerCase() : ''
    });
    if (decision.action !== 'click_cancel') return { ok: false, closed: false, ...decision };
    buttons[0].click();
    const gone = await waitFor(() => (!form.isConnected || !visible(form) ? true : null), 2000);
    return gone
      ? { ok: true, closed: true, reason: null }
      : { ok: false, closed: false, reason: 'editor_still_open' };
  }

  const api = {
    inspect,
    read,
    cancel,
    posts: () => posts.slice(),
    clicks: () => clicks.slice(),
    restore: () => {
      try { removeTap(); } catch { /* leave the hooks if restore throws */ }
    }
  };
  view.__gthEducationLive = api;
  return { ok: true };
}
