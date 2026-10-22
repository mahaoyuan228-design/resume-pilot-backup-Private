// Shipped GTH 求职意向 fill. Message: GTH_INTENT_FILL (not the removed test hook).
// Control shapes are the opened editor census of 2026-10-20 on
// hr.gtht.com/resume/edit/ (期望工作地区 / 职位类别 / 行业 pickers,
// 期望薪资 / 现薪资 plain text, optional 到岗日期 el-select).
// A later opened editor (2026-10-20 17:40 UTC+8) keeps one cascader menu
// after 取消, renders counters as （n/m） (U+FF08/U+FF09), and uses a
// single-select level-2 click for 现从事行业 / 现从事职位类别 (counter max
// 1, hidden 确定/取消). A 18:01 UTC+8 run then leaves the 到岗日期 dropdown
// on <body> (Element UI append-to-body). Same-value is decided from the
// input before a menu is required; a new value accepts the in-widget menu
// or exactly one body-level arrival menu after the select opens.
// replaceExisting re-picks a single-select level-2 or, for a multi-select,
// removes non-target chips through the one <i> on each chip and confirms.
// Closed-card guesses used kind:'unsupported' until that census. Unknown
// shapes still fail closed ('control_not_supported').
// Picker answers are exact "一级||二级" text. No fuzzy match. Never clicks 保存 / 提交 / 投递.
// liveSupportClaimed stays false: a writer is not a claim the live site is supported.
// omitAbsent === true leaves a required question untouched when its answer is
// blank, so a never-save trial can fill 到岗日期, 期望工作地区, and 期望薪资
// without inventing the other four facts. Any other call still fail-closes:
// a missing required answer is missing_profile_value and nothing is written.
(() => {
  const previous = globalThis.ResumeGthIntent;
  if (previous?.listener) try { chrome.runtime.onMessage.removeListener(previous.listener); } catch { /* reload */ }
  const PAGE = 'https://hr.gtht.com/resume/edit/';
  const SECTION = '求职意向';
  const SECTION_INDEX = 2;
  const TITLES = ['基本信息','教育经历','求职意向','工作经验','职业技能与特长','附件简历','其他信息'];
  const CENSUS = 'gth-intent census 2026-10-20 opened editor';
  const FIELDS = [
    {question:'期望从事职位类别', kind:'picker', evidence:CENSUS+' cascader-wrap exact L1 then L2'},
    {question:'期望薪资', kind:'text', evidence:'engine.js gthSalaryTrial plain text; census div.el-input.select-l'},
    {question:'现从事行业', kind:'picker', evidence:CENSUS+' cascader-wrap exact L1 then L2; single-select when counter max is 1 or 确定/取消 is hidden'},
    {question:'现从事职位类别', kind:'picker', evidence:CENSUS+' cascader-wrap exact L1 then L2; single-select when counter max is 1 or 确定/取消 is hidden'},
    {question:'现薪资', kind:'text', evidence:CENSUS+' plain input.el-input__inner'}
  ];
  const OPTIONAL = [
    {question:'期望工作地区', kind:'picker', evidence:CENSUS+' cascader-wrap exact L1 then L2'},
    {question:'到岗日期', kind:'select', evidence:CENSUS+' el-select.select-l exact option'}
  ];
  const ARRIVAL = ['一周内','一个月内','一个月以上','即时','面议'];
  const ARRIVAL_LIST = ['请选择', ...ARRIVAL];
  const norm = value => String(value ?? '').replace(/[\s\u00a0]+/gu,' ').trim();
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
  const state = {busy:false, last:null, progress:null};
  class Stop extends Error { constructor(code){ super(code); this.code = code; } }
  const stop = code => { throw new Stop(code); };
  let activeBinding = null, lastBinding = null;
  async function checkBinding(binding = activeBinding) {
    if (binding?.version !== 1 || typeof binding.epoch !== 'string' || !(/^[a-f0-9]{64}$/u.test(binding.profileHash || ''))) stop('profile_binding_required');
    let response;
    try { response = await chrome.runtime.sendMessage({type:'RESUME_PROFILE_BINDING_CHECK', profileBinding:binding}); } catch { /* unavailable */ }
    if (response?.allowed !== true) stop('profile_binding_changed');
  }
  async function boundAction(action) {
    await checkBinding();
    if (location.href !== PAGE || document.visibilityState !== 'visible') stop('profile_action_page_changed');
    return action();
  }
  const step = value => { if (state.progress) state.progress.selectorStep = value; };
  const valueRows = root => [...root.querySelectorAll('input,select,textarea')].map(node => [
    node.tagName, node.type || '', node.value || '', !!node.checked, node.selectedIndex ?? null,
    [...(node.files || [])].map(file => [file.name, file.size, file.type])]);
  const snapshot = root => JSON.stringify([root.textContent || '', valueRows(root)]);
  const outside = sections => JSON.stringify(sections.filter((_, index) => index !== SECTION_INDEX).map(snapshot));
  const sectionForms = sections => [...sections[SECTION_INDEX].querySelectorAll('form')];
  const otherSectionForms = sections => sections.flatMap((section, index) => index === SECTION_INDEX ? [] : [...section.querySelectorAll('form')]);
  const cancelButtons = form => [...form.querySelectorAll('button')].filter(node =>
    visible(node) && node.type === 'button' && norm(node.textContent) === '取消'
    && !node.disabled && !node.hasAttribute('formaction'));
  const valuesExcept = (form, excluded = []) => JSON.stringify(
    [...form.querySelectorAll('input,select,textarea')].filter(node => !excluded.includes(node)).map(node => [
      node.tagName, node.type || '', node.value || '', !!node.checked, node.selectedIndex ?? null,
      [...(node.files || [])].map(file => [file.name, file.size, file.type])]));
  function page() {
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
    return sections;
  }
  async function dismissCancelOnly(form) {
    const cancel = cancelButtons(form);
    if (cancel.length !== 1) return false;
    await boundAction(() => { if (!cancel[0]?.isConnected) stop('profile_action_target_changed'); return cancel[0].click(); });
    return true;
  }
  async function clearForeignEditors() {
    let sections = page();
    for (const form of otherSectionForms(sections)) {
      if (!(await dismissCancelOnly(form))) stop('other_section_editor_open');
    }
    const deadline = Date.now() + 4000;
    do {
      await pause(40);
      sections = page();
      if (!otherSectionForms(sections).length) break;
    } while (Date.now() < deadline);
    if (otherSectionForms(sections).length) stop('other_section_editor_open');
    return page();
  }
  function ownLabel(item) {
    const labels = [...item.querySelectorAll('.el-form-item__label')].filter(node => node.closest('.el-form-item') === item);
    return labels.length === 1 ? norm(labels[0].textContent) : '';
  }
  function itemsFor(form, question) {
    return [...form.querySelectorAll('.el-form-item')].filter(item => item.closest('form') === form && ownLabel(item) === question);
  }
  function textTarget(form, question) {
    const items = itemsFor(form, question);
    if (items.length !== 1) stop('intent_target_not_unique');
    const item = items[0];
    const controls = [...item.querySelectorAll('input,select,textarea')]
      .filter(node => node.closest('.el-form-item') === item && !node.closest('.popover.plugin-dialog-wrap'));
    const exposed = controls.filter(visible);
    const input = exposed[0];
    if (controls.length !== 1 || exposed.length !== 1 || !(input instanceof HTMLInputElement)
      || input.type !== 'text' || input.readOnly || input.disabled || !visible(input)
      || input.closest('.el-select,.el-date-editor,.el-cascader,.cascader-wrap'))
      stop('intent_target_not_plain_text');
    return {item, input, controls};
  }
  function pickerTarget(form, question) {
    const items = itemsFor(form, question);
    if (items.length === 0) stop('picker_structure_changed');
    if (items.length !== 1) stop('picker_label_ambiguous');
    const item = items[0];
    const wraps = [...item.querySelectorAll('.el-form-item__content.cascader-wrap')].filter(node => node.closest('.el-form-item') === item);
    if (wraps.length !== 1) stop('picker_structure_changed');
    const wrap = wraps[0];
    const triggers = [...wrap.querySelectorAll(':scope > div.input-l.pointer')].filter(shown);
    const panels = [...wrap.querySelectorAll(':scope > div.dialog-wrap.plugin-dialog-wrap.popover.blue')];
    if (triggers.length !== 1 || panels.length !== 1) stop('picker_structure_changed');
    const panel = panels[0];
    const inputs = [...triggers[0].querySelectorAll('input.el-input__inner')].filter(node => !panel.contains(node));
    const search = [...panel.querySelectorAll('input.search-input')];
    const menus = cascaderMenus(panel);
    if (inputs.length !== 1 || !(inputs[0] instanceof HTMLInputElement) || inputs[0].type !== 'text'
      || !inputs[0].readOnly || inputs[0].disabled || !shown(inputs[0])
      || search.length !== 1 || search[0].getAttribute('placeholder') !== '请输入关键字'
      || menus.length < 1 || menus.length > 2
      || panel.querySelectorAll('.selected-view-data').length !== 1
      || panel.querySelectorAll('.selected-counter').length !== 1
      || panel.querySelectorAll('.pop-foot a.confirm.pop-btn').length !== 1
      || panel.querySelectorAll('.pop-foot a.cancel.pop-btn').length !== 1)
      stop('picker_structure_changed');
    return {item, wrap, panel, trigger:triggers[0], input:inputs[0]};
  }
  function selectTarget(form, question) {
    const items = itemsFor(form, question);
    if (items.length === 0) stop('select_structure_changed');
    if (items.length !== 1) stop('select_label_ambiguous');
    const item = items[0];
    const widgets = [...item.querySelectorAll('.el-select.select-l')].filter(node => node.closest('.el-form-item') === item);
    if (widgets.length !== 1) stop('select_structure_changed');
    const widget = widgets[0];
    // After the first open, Element UI may have moved the dropdown to <body>.
    // The input is enough to decide preexisting_same_value; the menu is located
    // after a later open, and only when the value still needs a click.
    const dropdowns = [...widget.querySelectorAll('.el-select-dropdown.el-popper')].filter(node => widget.contains(node));
    if (dropdowns.length > 1) stop('select_structure_changed');
    const inputs = [...widget.querySelectorAll('input.el-input__inner')].filter(node => !dropdowns.some(menu => menu.contains(node)));
    if (inputs.length !== 1 || !(inputs[0] instanceof HTMLInputElement) || inputs[0].type !== 'text'
      || !inputs[0].readOnly || inputs[0].disabled || !shown(inputs[0]))
      stop('select_structure_changed');
    return {item, widget, input:inputs[0]};
  }
  const sameTarget = (left, right) => left.item === right.item && left.input === right.input;
  function siteValid(target) {
    return !target.item.classList.contains('is-error') && !target.item.classList.contains('is-validating')
      && ![...target.item.querySelectorAll('.el-form-item__error')].some(node => visible(node) && norm(node.textContent))
      && target.input.getAttribute('aria-invalid') !== 'true'
      && (!target.input.validity || target.input.validity.valid);
  }
  function overwriteProgressOk(readVal, existing, answer) {
    return readVal === '' || readVal === existing || norm(readVal) === norm(answer);
  }
  async function waitFor(read, timeout = 4000) {
    const deadline = Date.now() + timeout;
    do {
      const found = read();
      if (found) return found;
      await pause(40);
    } while (Date.now() < deadline);
    stop('intent_widget_timeout');
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
  function splitPicker(answer) {
    const parts = String(answer ?? '').split('||');
    if (parts.length !== 2) return null;
    const [l1, l2] = parts;
    if (!l1 || !l2 || l1 !== l1.trim() || l2 !== l2.trim()) return null;
    if (/[\r\n\u0000-\u001f]/u.test(l1 + l2)) return null;
    return {l1, l2};
  }
  function shapeOk(field, answer) {
    if (!String(answer ?? '').trim() || answer.length > 80 || /[\r\n\u0000-\u001f]/u.test(answer)) return false;
    if (field.kind === 'text') return /^\d{1,10}$/u.test(answer.trim());
    if (field.kind === 'picker') return !!splitPicker(answer);
    if (field.kind === 'select') return ARRIVAL.includes(answer);
    return false;
  }
  function factRow(request, field) {
    const question = field.question;
    const profile = request?.profile;
    const fromProfile = profile && typeof profile === 'object' && !Array.isArray(profile);
    const raw = fromProfile ? profile.customAnswers?.[question] : request?.answers?.[question];
    const answer = typeof raw === 'string' ? raw : '';
    const parts = field.kind === 'picker' ? splitPicker(answer) : null;
    if (!shapeOk(field, answer)) return {value:'', reason: answer.trim() ? 'invalid_profile_value' : 'missing_profile_value', parts:null};
    if (!fromProfile) return {value:answer, reason:'profile_fact_unconfirmed', parts};
    const confirmed = new Set(Array.isArray(profile.confirmedFields) ? profile.confirmedFields : []);
    const facts = (Array.isArray(profile.customFacts) ? profile.customFacts : []).filter(item => item?.question === question);
    const fact = facts.length === 1 ? facts[0] : null;
    const factOk = !!fact && fact.answer === answer && fact.sitePageUrl === PAGE
      && fact.sectionName === SECTION && fact.rowContext === 'none';
    if (!factOk || !confirmed.has(`customAnswers.${question}`)) return {value:answer, reason:'profile_fact_unconfirmed', parts};
    return {value:answer, reason:null, parts};
  }
  function optionalFact(request, field) {
    const profile = request?.profile;
    const fromProfile = profile && typeof profile === 'object' && !Array.isArray(profile);
    const raw = fromProfile ? profile.customAnswers?.[field.question] : request?.answers?.[field.question];
    if (typeof raw !== 'string' || raw.trim() === '') return {skip:true, value:'', reason:null, parts:null};
    return {...factRow(request, field), skip:false};
  }
  function fieldRow(field, status, reason) {
    return {id:`gth:求职意向:${field.question}`, question:field.question, labels:[field.question],
      path:`customAnswers.${field.question}`, status, reason, supported:field.kind !== 'unsupported'};
  }
  function chipTexts(panel) {
    const rows = [...panel.querySelectorAll('.selected-view-data > li')];
    const texts = [];
    for (const li of rows) {
      if (li.closest('.dialog-wrap.plugin-dialog-wrap') !== panel && !panel.contains(li)) continue;
      const ps = [...li.children].filter(node => node.tagName === 'P');
      if (ps.length !== 1) return null;
      texts.push(norm(ps[0].textContent));
    }
    return texts;
  }
  function chipEntries(panel) {
    const lists = [...panel.querySelectorAll('.selected-view-data')].filter(node => panel.contains(node));
    if (lists.length !== 1) return null;
    const entries = [];
    for (const li of lists[0].querySelectorAll(':scope > li')) {
      const children = [...li.children];
      const ps = children.filter(node => node.tagName === 'P');
      const icons = children.filter(node => node.tagName === 'I');
      if (ps.length !== 1 || icons.length !== 1 || li.querySelectorAll('i').length !== 1) return null;
      entries.push({li, text:norm(ps[0].textContent), remove:icons[0]});
    }
    return entries;
  }
  function readCounter(panel) {
    const nodes = [...panel.querySelectorAll('.selected-counter > p')];
    if (nodes.length !== 1) return null;
    const match = norm(nodes[0].textContent).match(/^[（(](\d+)\/(\d+)[）)]$/u);
    if (!match) return null;
    const current = Number(match[1]);
    const max = Number(match[2]);
    if (!Number.isInteger(current) || !Number.isInteger(max) || max < 1 || current < 0) return null;
    return {current, max};
  }
  function visiblePanels() {
    return [...document.querySelectorAll('div.dialog-wrap.plugin-dialog-wrap.popover.blue')].filter(shown);
  }
  async function clickPanelCancel(panel) {
    const nodes = [...panel.querySelectorAll('.pop-foot a.cancel.pop-btn')].filter(node => norm(node.textContent) === '取消');
    if (nodes.length !== 1 || !nodes[0].isConnected) stop('picker_cancel_not_unique');
    await boundAction(() => { if (!nodes[0].isConnected) stop('profile_action_target_changed'); return nodes[0].click(); });
  }
  function cascaderMenus(panel) {
    return [...panel.querySelectorAll(':scope > div.eo-cascader-panel > div.eo-cascader-menu.simple-tree-outer')];
  }
  function footHidden(panel) {
    const feet = [...panel.querySelectorAll(':scope > div.pop-foot.plugin-dialog-pop-foot')];
    return feet.length === 1 && !shown(feet[0]);
  }
  function l1Rows(panel) {
    const menus = cascaderMenus(panel);
    if (menus.length < 1 || menus.length > 2) stop('picker_structure_changed');
    return [...menus[0].querySelectorAll(':scope > ul.simple-tree-wrapper > li.branch.has-child')];
  }
  function l2Rows(panel) {
    const menus = cascaderMenus(panel);
    if (menus.length !== 2) return [];
    return [...menus[1].querySelectorAll(':scope > ul.simple-tree-wrapper > li.branch')]
      .filter(row => !row.classList.contains('has-child'));
  }
  function l2LeafText(row) {
    const label = rowLabel(row);
    if (label) return norm(label.textContent);
    return rowSpanText(row);
  }
  function l2Clickable(row, text) {
    const label = rowLabel(row);
    if (label && norm(label.textContent) === text) return label;
    const span = [...row.children].find(node => node.tagName === 'SPAN');
    if (span && norm(span.textContent) === text) return span;
    return norm(row.textContent) === text ? row : null;
  }
  function rowSpanText(row) {
    const span = [...row.children].find(node => node.tagName === 'SPAN');
    return span ? norm(span.textContent) : '';
  }
  function rowLabel(row) {
    return [...row.children].find(node => node.tagName === 'LABEL') || null;
  }
  async function fillPicker(target, parts, replaceExisting, markWrite, guard) {
    const {panel, trigger, input} = target;
    const {l1, l2} = parts;
    let opened = false;
    const abort = async code => {
      if (opened) {
        opened = false;
        try { await clickPanelCancel(panel); } catch { /* keep the picker reason */ }
      }
      stop(code);
    };
    step('picker_open');
    if (visiblePanels().length) stop('picker_panel_already_open');
    guard();
    await boundAction(() => { if (!trigger.isConnected) stop('profile_action_target_changed'); return trigger.click(); });
    opened = true;
    const openedPanel = await waitUntil(() => {
      const open = visiblePanels();
      if (open.length > 1) return {bad:'picker_panel_not_unique'};
      if (open.length === 1) return open[0] === panel ? {ok:true} : {bad:'picker_panel_not_unique'};
      return null;
    });
    if (!openedPanel) await abort('picker_panel_not_unique');
    if (openedPanel.bad) await abort(openedPanel.bad);
    guard();
    const chips = chipTexts(panel);
    if (!chips) await abort('picker_chip_unknown');
    const triggerValue = norm(input.value);
    if (chips.length === 1 && chips[0] === l2 && triggerValue === l2) {
      await clickPanelCancel(panel);
      opened = false;
      if (norm(input.value) !== l2 || shown(panel)) stop('picker_readback_mismatch');
      return {status:'verified', reason:'preexisting_same_value'};
    }
    const counterNow = readCounter(panel);
    const single = footHidden(panel) || counterNow?.max === 1;
    const occupied = chips.length > 0 || triggerValue !== '';
    if (occupied && replaceExisting !== true) await abort('picker_existing_selection_conflict');
    if (occupied && replaceExisting === true && !single) {
      if (!counterNow) await abort('picker_counter_unknown');
      let entries = chipEntries(panel);
      if (!entries) await abort('picker_structure_changed');
      while (entries.some(entry => entry.text !== l2)) {
        const entry = entries.find(row => row.text !== l2);
        const before = readCounter(panel);
        if (!before || !entry?.remove?.isConnected) await abort(before ? 'picker_structure_changed' : 'picker_counter_unknown');
        const beforeCount = entries.length;
        guard();
        markWrite();
        await boundAction(() => { if (!entry.remove.isConnected) stop('profile_action_target_changed'); return entry.remove.click(); });
        const next = await waitUntil(() => {
          const nowCounter = readCounter(panel);
          const nowEntries = chipEntries(panel);
          if (nowEntries === null) return {bad:'picker_structure_changed'};
          if (!nowCounter) return {bad:'picker_counter_unknown'};
          if (nowCounter.current === before.current - 1 && nowEntries.length === beforeCount - 1) return {ok:true};
          return null;
        });
        if (next?.bad) await abort(next.bad);
        if (!next) await abort('picker_replace_unverified');
        entries = chipEntries(panel);
        if (!entries) await abort('picker_structure_changed');
      }
      if (entries.length > 1 || (entries.length === 1 && entries[0].text !== l2)) await abort('picker_structure_changed');
    }
    step('picker_level1');
    const level1 = l1Rows(panel).filter(shown);
    const l1Matches = level1.filter(row => rowSpanText(row) === l1);
    if (l1Matches.length !== 1) await abort(l1Matches.length ? 'picker_level1_ambiguous' : 'picker_level1_missing');
    const span = [...l1Matches[0].children].find(node => node.tagName === 'SPAN');
    if (!span || norm(span.textContent) !== l1) await abort('picker_level1_missing');
    guard();
    await boundAction(() => { if (!span.isConnected) stop('profile_action_target_changed'); return span.click(); });
    step('picker_level2');
    let sawL2Menu = false;
    const found = await waitUntil(() => {
      guard();
      const menus = cascaderMenus(panel);
      if (menus.length > 2) return {bad:'picker_structure_changed'};
      if (menus.length !== 2) return null;
      sawL2Menu = true;
      const rows = l2Rows(panel).filter(shown);
      const matches = rows.filter(row => l2LeafText(row) === l2);
      if (matches.length > 1) return {ambiguous:true};
      return matches.length === 1 ? {row:matches[0]} : null;
    });
    if (found?.bad) await abort(found.bad);
    if (found?.ambiguous) await abort('picker_level2_ambiguous');
    if (!found) await abort(sawL2Menu ? 'picker_level2_missing' : 'picker_level2_menu_missing');
    const counter = readCounter(panel);
    if (!counter && !single) await abort('picker_counter_unknown');
    if (!single && counter.current >= counter.max) await abort('picker_selection_limit');
    const beforeChips = chipTexts(panel);
    if (!beforeChips) await abort('picker_chip_unknown');
    if (replaceExisting === true && !single) {
      if (beforeChips.length > 1 || (beforeChips.length === 1 && beforeChips[0] !== l2)) await abort('picker_structure_changed');
    } else if (beforeChips.length && !(replaceExisting === true && single)) await abort('picker_existing_selection_conflict');
    const replaced = occupied && replaceExisting === true;
    if (single) {
      const clickable = l2Clickable(found.row, l2);
      if (!clickable) await abort('picker_level2_missing');
      step('picker_single');
      guard();
      markWrite();
      await boundAction(() => { if (!clickable.isConnected) stop('profile_action_target_changed'); return clickable.click(); });
      const matched = await waitUntil(() => {
        const now = chipTexts(panel);
        const ok = !shown(panel) && norm(input.value) === l2 && now && now.length === 1 && now[0] === l2;
        if (ok) return {ok:true};
        if (replaced && !shown(panel)) return {bad:'picker_replace_unverified'};
        return null;
      });
      if (matched?.bad) { opened = false; stop('picker_replace_unverified'); }
      if (!matched?.ok || !siteValid(target)) {
        if (replaced && !shown(panel)) { opened = false; stop('picker_replace_unverified'); }
        await abort(replaced ? 'picker_replace_unverified' : 'picker_readback_mismatch');
      }
      opened = false;
      guard();
      return {status:'verified', reason:replaced ? 'readback_reapplied' : 'readback_matched'};
    }
    const label = rowLabel(found.row);
    const box = label ? [...label.querySelectorAll('input[type="checkbox"]')].find(node => label.contains(node)) : null;
    if (!label || norm(label.textContent) !== l2 || !(box instanceof HTMLInputElement) || box.disabled)
      await abort('picker_level2_checkbox_missing');
    const already = beforeChips.length === 1 && beforeChips[0] === l2;
    if (box.checked && !already) await abort('picker_level2_checkbox_missing');
    if (!box.checked) {
      step('picker_checkbox');
      guard();
      markWrite();
      await boundAction(() => { if (!box.isConnected) stop('profile_action_target_changed'); return box.click(); });
      const applied = await waitUntil(() => {
        const now = chipTexts(panel);
        return now && now.length === 1 && now[0] === l2 ? now : null;
      });
      if (!applied) await abort(replaced ? 'picker_replace_unverified' : 'picker_selection_not_applied');
    }
    const confirms = [...panel.querySelectorAll('.pop-foot a.confirm.pop-btn')].filter(node => shown(node) && norm(node.textContent) === '确定');
    if (confirms.length !== 1) await abort('picker_confirm_not_unique');
    step('picker_confirm');
    guard();
    markWrite();
    await boundAction(() => { if (!confirms[0].isConnected) stop('profile_action_target_changed'); return confirms[0].click(); });
    const matched = await waitUntil(() => {
      const now = chipTexts(panel);
      const ok = norm(input.value) === l2 && now && now.length === 1 && now[0] === l2 && !shown(panel);
      if (ok) return {ok:true};
      if (replaced && !shown(panel)) return {bad:'picker_replace_unverified'};
      return null;
    });
    if (matched?.bad || !matched?.ok || !siteValid(target)) await abort(replaced ? 'picker_replace_unverified' : 'picker_readback_mismatch');
    opened = false;
    guard();
    return {status:'verified', reason:replaced ? 'readback_reapplied' : 'readback_matched'};
  }
  function arrivalOptions(menu) {
    if (!menu) return null;
    const options = [...menu.querySelectorAll('li.el-select-dropdown__item')];
    const texts = options.map(node => norm(node.textContent));
    if (texts.length !== ARRIVAL_LIST.length || ARRIVAL_LIST.some(text => !texts.includes(text)) || new Set(texts).size !== texts.length) return null;
    return options;
  }
  function resolveArrivalMenu(widget) {
    const inWidget = [...widget.querySelectorAll('.el-select-dropdown.el-popper')].filter(node => widget.contains(node));
    const body = [...document.body.children].filter(node => node.matches?.('.el-select-dropdown.el-popper'));
    const inOk = inWidget.filter(menu => arrivalOptions(menu));
    const bodyOk = body.filter(menu => arrivalOptions(menu));
    if (bodyOk.length > 1 || inOk.length > 1 || (inOk.length > 0 && bodyOk.length > 0)) return {bad:'select_structure_changed'};
    if (inOk.length === 1) return {menu:inOk[0], options:arrivalOptions(inOk[0])};
    if (bodyOk.length === 1) return {menu:bodyOk[0], options:arrivalOptions(bodyOk[0])};
    if (inWidget.length || body.length) return {bad:'select_structure_changed'};
    return {menu:null, options:null};
  }
  async function fillSelect(target, answer, replaceExisting, markWrite, guard) {
    const {input, widget} = target;
    const existing = input.value;
    if (norm(existing) === answer) return {status:'verified', reason:'preexisting_same_value'};
    if (existing !== '' && replaceExisting !== true) return {status:'failed', reason:'existing_value'};
    const openMenus = () => [...document.querySelectorAll('.el-select-dropdown.el-popper')].filter(shown);
    if (openMenus().length) stop('select_menu_not_unique');
    step('select_open');
    guard();
    await boundAction(() => { if (!input.isConnected) stop('profile_action_target_changed'); return input.click(); });
    const closeMenu = async () => {
      if (openMenus().length) {
        try { await boundAction(() => { if (!input.isConnected) stop('profile_action_target_changed'); return input.click(); }); } catch { /* keep the select reason */ }
      }
    };
    const opened = await waitUntil(() => {
      const open = openMenus();
      if (open.length > 1) return {bad:'select_menu_not_unique'};
      const resolved = resolveArrivalMenu(widget);
      if (resolved.bad) return resolved;
      if (!resolved.menu || !shown(resolved.menu)) return null;
      if (open.length !== 1 || open[0] !== resolved.menu) return {bad:'select_menu_not_unique'};
      const options = (resolved.options || []).filter(shown);
      if (!arrivalOptions(resolved.menu) || options.length !== ARRIVAL_LIST.length) return {bad:'select_structure_changed'};
      return {menu:resolved.menu, options};
    });
    if (!opened || opened.bad) { await closeMenu(); stop(opened?.bad || 'select_menu_not_unique'); }
    const {menu, options} = opened;
    const texts = options.map(node => norm(node.textContent));
    if (texts.length !== ARRIVAL_LIST.length || ARRIVAL_LIST.some(text => !texts.includes(text)) || new Set(texts).size !== texts.length) {
      await closeMenu();
      stop('select_structure_changed');
    }
    const matches = options.filter(node => norm(node.textContent) === answer);
    if (matches.length !== 1) {
      await closeMenu();
      stop(matches.length ? 'select_option_ambiguous' : 'select_option_missing');
    }
    step('select_option');
    guard();
    markWrite();
    await boundAction(() => { if (!matches[0].isConnected) stop('profile_action_target_changed'); return matches[0].click(); });
    const matched = await waitUntil(() => norm(input.value) === answer && !shown(menu) ? true : null);
    if (!matched || !siteValid(target)) {
      await closeMenu();
      stop('intent_readback_mismatch');
    }
    guard();
    return {status:'verified', reason:existing === '' ? 'readback_matched' : 'readback_reapplied'};
  }
  function closedPickerDecision(target, parts) {
    const chips = chipTexts(target.panel);
    if (!chips) return {action:'fail', reason:'picker_chip_unknown'};
    const triggerValue = norm(target.input.value);
    if (chips.length === 1 && chips[0] === parts.l2 && triggerValue === parts.l2) return {action:'same'};
    // A different chip is confirmed after the panel opens. replaceExisting false
    // cancels it; replaceExisting true re-picks inside that open panel.
    return {action:'fill'};
  }
  function closedTextDecision(target, answer, replaceExisting) {
    const existing = target.input.value;
    if (existing !== '' && norm(existing) === norm(answer)) return {action:'same', existing};
    if (existing !== '' && replaceExisting !== true) return {action:'fail', reason:'existing_value', existing};
    return {action:'fill', existing};
  }
  async function trial(request) {
    try {
      const manifest = chrome.runtime.getManifest();
      if (manifest.background?.service_worker === 'src/license/guard-worker.mjs') {
        const verdict = await chrome.runtime.sendMessage({type:'RESUME_PAID_VERIFY'});
        if (verdict?.allowed !== true) throw new Stop('license_required');
      }
    } catch {
      const info = {reason:'license_required', activeField:null, selectorStep:'license_check', completedFields:[], writeStarted:false};
      if (!state.busy) state.last = {requestId:request?.requestId, outcome:'failed_before_write', info};
      return {ok:false, ...info, fields:[], complete:false, supportedComplete:false, operableComplete:false,
        writeStarted:false, editorLeftOpen:false, savedOnSite:null, submitted:null, softwareClickedSave:false,
        softwareClickedSubmit:false, softwareClickedDelete:false, scope:'gth_intent_five', liveSupportClaimed:false};
    }
    const result = {fields:[], coverage:FIELDS.map(field => fieldRow(field, 'failed', 'not_run')),
      complete:false, supportedComplete:false, operableComplete:false, writeStarted:false, editorLeftOpen:false,
      savedOnSite:null, submitted:null, softwareClickedSave:false, softwareClickedSubmit:false, softwareClickedDelete:false,
      scope:'gth_intent_five', liveSupportClaimed:false, section:SECTION};
    if (state.busy) return {ok:false, reason:'fill_in_progress', ...result};
    state.busy = true;
    activeBinding = request?.profileBinding;
    lastBinding = activeBinding;
    state.progress = {requestId:request?.requestId, activeField:null, selectorStep:'request_validation', completedFields:[], writeStarted:false};
    const markWrite = () => { result.writeStarted = true; state.progress.writeStarted = true; };
    const record = (field, status, reason) => {
      const row = fieldRow(field, status, reason);
      const index = result.fields.findIndex(item => item.question === field.question);
      if (index >= 0) result.fields[index] = row; else result.fields.push(row);
      const covered = result.coverage.find(item => item.question === field.question);
      if (covered) Object.assign(covered, row);
      state.progress.completedFields = state.progress.completedFields.filter(item => item.question !== field.question);
      state.progress.completedFields.push({question:field.question, status, reason});
    };
    let form = null, openedByUs = false, attempted = FIELDS;
    try {
      await checkBinding();
      if (typeof request?.requestId !== 'string' || !/^[A-Za-z0-9-]{10,100}$/u.test(request.requestId)
        || request.replaceExisting !== undefined && typeof request.replaceExisting !== 'boolean'
        || request.omitAbsent !== undefined && typeof request.omitAbsent !== 'boolean') stop('intent_request_invalid');
      const requiredAnswers = Object.fromEntries(FIELDS.map(field => [field.question,
        request.omitAbsent === true ? optionalFact(request, field) : {...factRow(request, field), skip:false}]));
      const optionalAnswers = Object.fromEntries(OPTIONAL.map(field => [field.question, optionalFact(request, field)]));
      attempted = [...FIELDS.filter(field => !requiredAnswers[field.question].skip), ...OPTIONAL.filter(field => !optionalAnswers[field.question].skip)];
      if (!attempted.length) stop('missing_profile_value');
      const answerOf = field => (OPTIONAL.some(item => item.question === field.question) ? optionalAnswers : requiredAnswers)[field.question];
      const unsettled = attempted.filter(field => answerOf(field).reason);
      if (unsettled.length) {
        for (const field of attempted) record(field, 'failed', answerOf(field).reason || 'blocked_by_unsettled_field');
        const info = {reason:answerOf(unsettled[0]).reason, activeField:unsettled[0].question, selectorStep:'field_decision',
          completedFields:state.progress.completedFields.map(item => ({...item})), writeStarted:false};
        state.last = {requestId:request.requestId, outcome:'failed_before_write', info};
        return {ok:false, ...result, fields:attempted.map(field => result.fields.find(row => row.question === field.question)), ...info};
      }
      step('page_preflight');
      let sections = await clearForeignEditors();
      const origin = performance.timeOrigin;
      const otherBefore = outside(sections);
      let editors = sectionForms(sections);
      if (editors.length > 1) stop('intent_editor_not_unique');
      if (otherSectionForms(sections).length) stop('other_section_editor_open');
      if (!editors.length) {
        const links = [...sections[SECTION_INDEX].querySelectorAll('.title_ a.h-e-btn')]
          .filter(node => visible(node) && norm(node.textContent) === '编辑');
        if (links.length !== 1) stop('intent_edit_not_unique');
        const href = links[0].getAttribute('href');
        if (href && !/^(#|javascript:(?:;|void\(0\)))$/iu.test(href)) stop('intent_edit_not_unique');
        step('editor_open');
        await boundAction(() => { if (!links[0]?.isConnected) stop('profile_action_target_changed'); return links[0].click(); });
        openedByUs = true;
        form = await waitFor(() => {
          sections = page();
          const found = sectionForms(sections);
          if (found.length > 1) stop('intent_editor_not_unique');
          if (otherSectionForms(sections).length) stop('other_section_editor_open');
          return found.length === 1 && found[0].querySelector('.el-form-item') ? found[0] : null;
        });
      } else form = editors[0];
      result.editorLeftOpen = true;
      if (outside(page()) !== otherBefore || performance.timeOrigin !== origin) stop('intent_other_values_changed');
      const plans = [];
      for (const field of attempted) {
        state.progress.activeField = field.question;
        step('target_preflight');
        if (field.kind === 'text') plans.push({field, target:textTarget(form, field.question)});
        else if (field.kind === 'picker') plans.push({field, target:pickerTarget(form, field.question)});
        else if (field.kind === 'select') plans.push({field, target:selectTarget(form, field.question)});
        else {
          record(field, 'failed', 'control_not_supported');
          plans.push({field, target:null, decision:{action:'fail', reason:'control_not_supported'}});
        }
      }
      for (const plan of plans) {
        if (plan.decision) continue;
        const answer = answerOf(plan.field);
        if (plan.field.kind === 'picker') plan.decision = closedPickerDecision(plan.target, answer.parts);
        else plan.decision = closedTextDecision(plan.target, answer.value, request.replaceExisting);
      }
      const blocked = plans.find(plan => plan.decision.action === 'fail');
      if (blocked) {
        for (const plan of plans) {
          if (plan.decision.action === 'fail') record(plan.field, 'failed', plan.decision.reason);
          else if (plan.decision.action === 'same') record(plan.field, 'verified', 'preexisting_same_value');
          else record(plan.field, 'failed', 'blocked_by_unsettled_field');
        }
      } else {
        const ordered = [...plans.filter(plan => plan.field.kind !== 'text'), ...plans.filter(plan => plan.field.kind === 'text')];
        for (const plan of ordered) {
          state.progress.activeField = plan.field.question;
          const answer = answerOf(plan.field);
          if (plan.decision.action === 'same') {
            record(plan.field, 'verified', 'preexisting_same_value');
            continue;
          }
          if (plan.field.kind === 'picker') {
            const outcome = await fillPicker(plan.target, answer.parts, request.replaceExisting, markWrite, () => {
              if (performance.timeOrigin !== origin || outside(page()) !== otherBefore) stop('intent_other_values_changed');
              const live = page();
              if (sectionForms(live).length !== 1 || sectionForms(live)[0] !== form) stop('intent_other_values_changed');
            });
            record(plan.field, outcome.status, outcome.reason);
            continue;
          }
          if (plan.field.kind === 'select') {
            const outcome = await fillSelect(plan.target, answer.value, request.replaceExisting, markWrite, () => {
              if (performance.timeOrigin !== origin || outside(page()) !== otherBefore) stop('intent_other_values_changed');
            });
            record(plan.field, outcome.status, outcome.reason);
            continue;
          }
          step('field_decision');
          const selected = plan.target;
          const existing = plan.decision.existing;
          if (selected.input.maxLength >= 0 && answer.value.length > selected.input.maxLength) stop('intent_value_too_long');
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          if (!setter) stop('native_setter_missing');
          const untouched = valuesExcept(form, selected.controls);
          const guard = expectedOwn => {
            const live = page();
            const current = textTarget(form, plan.field.question);
            const readVal = current.input.value;
            const progressOk = request.replaceExisting === true
              ? overwriteProgressOk(readVal, existing, answer.value)
              : readVal === expectedOwn;
            if (performance.timeOrigin !== origin || outside(live) !== otherBefore
              || sectionForms(live).length !== 1 || sectionForms(live)[0] !== form
              || !sameTarget(selected, current) || valuesExcept(form, selected.controls) !== untouched || !progressOk)
              stop('intent_other_values_changed');
          };
          step('field_guard');
          guard(existing);
          step('text_input_events');
          markWrite();
          await boundAction(() => { if (!selected.input?.isConnected) stop('profile_action_target_changed'); return setter.call(selected.input, answer.value); });
          guard(answer.value);
          await boundAction(() => { if (!selected.input?.isConnected) stop('profile_action_target_changed'); return selected.input.dispatchEvent(new Event('input', {bubbles:true})); });
          await boundAction(() => { if (!selected.input?.isConnected) stop('profile_action_target_changed'); return selected.input.dispatchEvent(new Event('change', {bubbles:true})); });
          await boundAction(() => { if (!selected.input?.isConnected) stop('profile_action_target_changed'); return selected.input.dispatchEvent(new Event('blur', {bubbles:true})); });
          step('field_readback');
          await pause(80);
          guard(answer.value);
          if (selected.input.value !== answer.value) stop('intent_readback_mismatch');
          if (!siteValid(selected)) stop('intent_site_validation_failed');
          record(plan.field, 'verified', existing === '' ? 'readback_matched' : 'readback_reapplied');
        }
      }
      result.fields = attempted.map(field => result.fields.find(row => row.question === field.question) || fieldRow(field, 'failed', 'not_run'));
      result.supportedComplete = result.fields.length === attempted.length && result.fields.every(row => row.status === 'verified');
      result.operableComplete = result.supportedComplete;
      result.complete = false;
      if (openedByUs && !result.writeStarted && result.supportedComplete !== true && form?.isConnected) {
        if (await dismissCancelOnly(form)) result.editorLeftOpen = false;
      }
      const primary = result.fields.find(row => row.status !== 'verified' && row.reason !== 'blocked_by_unsettled_field')
        || result.fields.find(row => row.status !== 'verified');
      const outcome = !primary && result.fields.some(row => row.reason === 'readback_matched' || row.reason === 'readback_reapplied')
        ? 'verified'
        : !primary ? 'verified_preexisting' : (result.writeStarted ? 'unknown' : 'failed_before_write');
      const info = {reason:primary ? primary.reason : null, activeField:null, selectorStep:primary ? 'field_decision' : 'complete',
        completedFields:result.fields.map(row => ({question:row.question, status:row.status, reason:row.reason})),
        writeStarted:result.writeStarted, supportedComplete:result.supportedComplete, operableComplete:result.operableComplete, complete:false};
      state.last = {requestId:request.requestId, outcome, info, currentCheck:() => {
        try {
          if (!result.supportedComplete) return false;
          const live = page();
          if (performance.timeOrigin !== origin || outside(live) !== otherBefore || sectionForms(live)[0] !== form) return false;
          return attempted.every(field => {
            const answer = answerOf(field);
            if (field.kind === 'text') {
              const current = textTarget(form, field.question);
              return current.input.value === answer.value && siteValid(current);
            }
            if (field.kind === 'picker') return norm(pickerTarget(form, field.question).input.value) === answer.parts.l2;
            if (field.kind === 'select') return norm(selectTarget(form, field.question).input.value) === answer.value;
            return false;
          });
        } catch { return false; }
      }};
      return {ok:result.supportedComplete === true, ...result, ...info};
    } catch (error) {
      const reason = error instanceof Stop ? error.code : 'intent_fill_failed';
      const active = state.progress?.activeField || null;
      for (const field of attempted) {
        if (result.fields.some(row => row.question === field.question)) continue;
        record(field, 'failed', field.question === active ? reason : 'not_run');
      }
      result.fields = attempted.map(field => result.fields.find(row => row.question === field.question) || fieldRow(field, 'failed', 'not_run'));
      if (openedByUs && !result.writeStarted && form?.isConnected) {
        const cancel = cancelButtons(form);
        if (cancel.length === 1) {
          try {
            await boundAction(() => { if (!cancel[0]?.isConnected) stop('profile_action_target_changed'); return cancel[0].click(); });
            result.editorLeftOpen = false;
          } catch { /* leave the editor; the failure is already recorded */ }
        }
      }
      const info = {reason, activeField:state.progress?.activeField || null, selectorStep:state.progress?.selectorStep || 'not_started',
        completedFields:(state.progress?.completedFields || []).map(item => ({...item})), writeStarted:result.writeStarted,
        supportedComplete:false, operableComplete:false, complete:false};
      state.last = {requestId:request?.requestId, outcome:result.writeStarted ? 'unknown' : 'failed_before_write', info};
      return {ok:false, ...result, supportedComplete:false, operableComplete:false, ...info};
    } finally {
      state.busy = false;
      activeBinding = null;
    }
  }
  const listener = (message, sender, sendResponse) => {
    if (message?.type === 'GTH_INTENT_FILL_STATUS') {
      (async () => {
        if (sender?.id !== chrome.runtime.id) { sendResponse({ok:false, error:'profile_wrong_sender', writeStarted:false}); return; }
        if (message.profileBinding) await checkBinding(message.profileBinding);
        await checkBinding(lastBinding || activeBinding);
        const running = state.busy && state.progress?.requestId === message.requestId;
        const last = state.last?.requestId === message.requestId ? state.last : null;
        const outcome = last?.currentCheck ? (last.currentCheck() ? last.outcome : 'unknown') : (last?.outcome || 'unknown');
        sendResponse({ok:true, data:{requestId:message.requestId, state:running ? 'running' : 'settled', outcome,
          ...(running ? {writeStarted:state.progress.writeStarted === true} : last?.info || {writeStarted:false})}});
      })().catch(() => sendResponse({ok:false, error:'profile_binding_changed', data:{requestId:message?.requestId, state:'settled', outcome:'unknown'}}));
      return true;
    }
    if (message?.type !== 'GTH_INTENT_FILL') return;
    if (sender?.id !== chrome.runtime.id) { sendResponse({ok:false, error:'profile_wrong_sender', fillNotStarted:true, writeStarted:false}); return false; }
    trial(message).then(sendResponse, () => sendResponse({ok:false, reason:'intent_fill_failed', writeStarted:false, supportedComplete:false, operableComplete:false, complete:false}));
    return true;
  };
  globalThis.ResumeGthIntent = Object.freeze({
    implementationRevision:5, installed:true, trial, listener,
    fields:FIELDS.map(field => ({question:field.question, kind:field.kind, evidence:field.evidence})),
    optional:OPTIONAL.map(field => ({question:field.question, kind:field.kind, evidence:field.evidence}))
  });
  chrome.runtime.onMessage.addListener(listener);
})();
