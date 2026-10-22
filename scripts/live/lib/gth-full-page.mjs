// Browser-side Never-Save harness. Selectors come from the shipped GTH writers
// and the existing gth-intent-live / gth-other-skills-live harnesses.
import { SECTION_TITLES, decideOpen, decideCancel } from '../gth-intent-live.mjs';
import { EDIT_PAGE, redactUrl } from '../../probe-gth-intent.mjs';

export const SALARY_UNIT_LOOKUP = 'https://hr.gtht.com/interface/js/type/getsalaryunit.json';
// Dictionary lookup observed during 基本信息. Exact path after the query is
// stripped. Save and submit paths are not lookups.
export const PHOTO_SIZE_LOOKUP = 'https://hr.gtht.com/interface/photo/type/getPhotoSize.json';

export function isAllowedRequest(method, rawUrl) {
  const verb = String(method || 'GET').toUpperCase();
  if (verb === 'GET') return true;
  if (verb !== 'POST') return false;
  try {
    const url = new URL(String(rawUrl), 'https://hr.gtht.com/resume/edit/');
    if (url.username || url.password) return false;
    const exact = `${url.origin}${url.pathname}`;
    return exact === SALARY_UNIT_LOOKUP || exact === PHOTO_SIZE_LOOKUP;
  } catch { return false; }
}

export function buildPageExpression(options = {}) {
  return `(() => {
    const SALARY_UNIT_LOOKUP = ${JSON.stringify(SALARY_UNIT_LOOKUP)};
    const PHOTO_SIZE_LOOKUP = ${JSON.stringify(PHOTO_SIZE_LOOKUP)};
    const isAllowedRequest = ${isAllowedRequest.toString()};
    const redactUrl = ${redactUrl.toString()};
    const decideOpen = ${decideOpen.toString()};
    const decideCancel = ${decideCancel.toString()};
    return (${installGthFullLive.toString()})(globalThis.document, ${JSON.stringify({
      titles: SECTION_TITLES, pageUrl: EDIT_PAGE, waitTimeoutMs: 4000, pollMs: 60, ...options
    })});
  })()`;
}

function installGthFullLive(doc, options) {
  const view = doc.defaultView;
  view.__gthFullLive?.restore();
  const clickRows = [];
  const requestRows = [];
  let activeSectionIndex = null;
  let monthDismissal = null;
  let monthDismissClick = null;
  let workLabelForward = null;
  const norm = value => String(value ?? '').replace(/[\s\u00a0]+/gu, ' ').trim();
  const sections = () => [...doc.querySelectorAll('.r-section')];
  const forms = () => sections().flatMap(section => [...section.querySelectorAll('form')]);
  function visible(node) {
    if (!node || node.nodeType !== 1 || !node.isConnected) return false;
    for (let cur = node; cur?.nodeType === 1; cur = cur.parentElement) {
      const style = view.getComputedStyle(cur);
      if (cur.hasAttribute('hidden') || !style || style.display === 'none' || style.visibility === 'hidden') return false;
    }
    return !!node.getClientRects().length;
  }
  function titleOf(section) {
    const title = section.querySelector('.title_')?.cloneNode(true);
    title?.querySelectorAll('a,button').forEach(child => child.remove());
    return norm(title?.textContent);
  }
  function state() {
    const href = String(view.location.href || '');
    const list = sections();
    const sectionFormCounts = options.titles.map((_, index) => list[index]?.querySelectorAll('form').length || 0);
    const formCount = forms().length;
    const basicForms = list[0] ? [...list[0].querySelectorAll('form.el-form.sec-form')] : [];
    const basicEdits = list[0] ? [...list[0].querySelectorAll('.title_ a.h-e-btn')]
      .filter(node => norm(node.textContent) === '编辑') : [];
    const basicCancels = basicForms.length === 1 ? [...basicForms[0].querySelectorAll('button')]
      .filter(node => visible(node) && norm(node.textContent) === '取消') : [];
    // The census-backed initial basic form has no 编辑 link. This narrowly
    // identifies it for the orchestrator's first section; it is not permission
    // to adopt an arbitrary editor that was already open when the run began.
    const basicInitialEditor = formCount === 1 && sectionFormCounts[0] === 1
      && basicForms.length === 1 && basicEdits.length === 0
      && basicCancels.length === 1 && basicCancels[0].type === 'button';
    return {
      href, hrefOk: href === options.pageUrl, readyState: doc.readyState,
      visible: doc.visibilityState === 'visible',
      titlesOk: JSON.stringify(list.map(titleOf)) === JSON.stringify(options.titles),
      formCount, editorFormCount: formCount, activeSectionIndex,
      sectionFormCounts, basicInitialEditor
    };
  }
  function wouldNavigate(node) {
    const href = node?.getAttribute('href')?.trim();
    return !!href && href !== '#' && !/^javascript:(?:;|void\(0\))$/iu.test(href);
  }
  // The work writer only accepts an already-open form. Reuse the section
  // probe's record-first opener, defaulting to its first record. A title 编辑
  // is a fallback only for one record without an edit; an empty card may use
  // its existing 添加/新增 affordance. Never treat a delete icon as an edit.
  function workOpeningControls(section) {
    const entries = [...section.querySelectorAll('.sec-context > .sec-detail')]
      .filter(node => node.closest('.r-section') === section);
    const titleLinks = [...section.querySelectorAll('.title_ a.h-e-btn')]
      .filter(node => node.closest('.r-section') === section);
    const name = node => norm(node.getAttribute('aria-label') || node.textContent);
    const notDelete = node => !node.matches('.eduexp-opt-icon,.el-icon-delete')
      && !node.querySelector('.eduexp-opt-icon,.el-icon-delete')
      && !/delete\.json/iu.test((node.getAttribute('url') || '') + ' ' + (node.getAttribute('href') || ''));
    const edits = nodes => nodes.filter(node => notDelete(node) && !node.closest(PANEL_SELECTOR)
      && (name(node) === '编辑' || name(node) === '' && node.querySelector('.el-icon-edit-outline,.el-icon-edit')));
    const titleEdits = edits(titleLinks).filter(node => name(node) === '编辑');
    if (entries.length) {
      const recordEdits = edits([...entries[0].querySelectorAll('a')]
        .filter(node => node.closest('.sec-context > .sec-detail') === entries[0]));
      if (recordEdits.length || entries.length > 1) {
        return { links: recordEdits, kind: 'record_edit', entryIndex: 0, entryCount: entries.length };
      }
      return { links: titleEdits, kind: 'title_edit', entryIndex: 0, entryCount: 1 };
    }
    if (titleEdits.length) return { links: titleEdits, kind: 'title_edit', entryCount: 0 };
    return { links: titleLinks.filter(node => notDelete(node) && ['添加', '新增'].includes(name(node))),
      kind: 'title_add', entryCount: 0 };
  }
  function snapshot(sectionIndex) {
    const list = sections();
    const section = list[sectionIndex];
    const work = sectionIndex === 3 && section && !section.querySelector('form')
      ? workOpeningControls(section) : null;
    const links = work?.links || (section ? [...section.querySelectorAll('.title_ a.h-e-btn')]
      .filter(node => norm(node.textContent) === '编辑') : []);
    const shownLinks = links.filter(visible);
    return {
      ...state(),
      foreignFormCount: list.reduce((sum, node, index) => sum + (index === sectionIndex ? 0 : node.querySelectorAll('form').length), 0),
      formCount: section?.querySelectorAll('form').length || 0,
      secFormCount: section?.querySelectorAll('form.el-form.sec-form').length || 0,
      editLinkCount: shownLinks.length, editLinkPresentCount: links.length,
      editWouldNavigate: shownLinks.length === 1 && wouldNavigate(shownLinks[0])
    };
  }
  function activeForm() {
    if (activeSectionIndex == null) return null;
    const section = sections()[activeSectionIndex];
    const matches = section ? [...section.querySelectorAll('form.el-form.sec-form')] : [];
    return matches.length === 1 && forms().length === 1 ? matches[0] : null;
  }
  const PANEL_SELECTOR = '.el-select-dropdown,.el-picker-panel,.popover.plugin-dialog-wrap';
  function enabled(node) {
    return !!node && !node.disabled && !node.hasAttribute('formaction')
      && node.getAttribute('aria-disabled') !== 'true'
      && !node.classList.contains('is-disabled') && !node.classList.contains('disabled');
  }
  function submitControl(node) {
    const control = node.closest('button, input[type="submit"], input[type="image"]');
    if (!control) return false;
    if (control.matches('input[type="submit"],input[type="image"]')) return true;
    return String(control.type || '').toLowerCase() === 'submit';
  }
  function controlText(node) {
    const host = node.closest('button, a, input[type="submit"]');
    return norm(host ? host.textContent : node.textContent);
  }
  function openPanel(node) {
    const panel = node.closest(PANEL_SELECTOR);
    if (!panel || !visible(panel) || !activeForm()) return null;
    const owner = panel.closest('.r-section');
    if (owner && owner !== sections()[activeSectionIndex]) return null;
    return panel;
  }
  function isPanelCancel(node, panel) {
    const host = node.closest('a.cancel.pop-btn');
    return !!host && panel.contains(host) && norm(host.textContent) === '取消' && !wouldNavigate(host);
  }
  function isPanelConfirm(node, panel) {
    const host = node.closest('a.confirm.pop-btn, a.pop-btn, button');
    if (!host || !panel.contains(host) || norm(host.textContent) !== '确定') return false;
    if (host.matches('button') && host.type !== 'button') return false;
    const foot = host.closest('.pop-foot, .el-picker-panel__footer');
    return !!foot && panel.contains(foot) && visible(host);
  }
  function isDateControl(node, panel) {
    const picker = node.closest('.el-picker-panel');
    if (!picker || !panel.contains(node) || !visible(picker)) return false;
    // Arrows and cells match gth-basic / gth-open-fill month panels, plus the
    // Element date-table day cell those panels sit beside.
    const arrow = node.closest('.el-icon-d-arrow-left,.el-icon-d-arrow-right,.el-icon-arrow-left,.el-icon-arrow-right');
    if (arrow && picker.contains(arrow) && arrow.closest('.el-date-picker__header')
      && visible(arrow) && enabled(arrow)) return true;
    const cell = node.closest('.el-month-table td,.el-date-table td');
    return !!cell && picker.contains(cell) && visible(cell) && enabled(cell);
  }
  function isPanelOption(node, panel) {
    if (!panel.contains(node)) return false;
    const selectOption = node.closest('.el-select-dropdown__item');
    if (selectOption && panel.contains(selectOption)) return true;
    const branch = node.closest('.eo-cascader-panel li, .eo-cascader-menu li');
    if (branch && panel.contains(branch)) return true;
    const choice = node.closest('input[type="checkbox"], input[type="radio"], label.el-checkbox, label.el-radio');
    if (choice && panel.contains(choice)) return true;
    const chip = node.closest('.selected-view-data i');
    if (chip && chip.tagName === 'I' && panel.contains(chip) && !norm(chip.textContent)) return true;
    // Empty-label nodes that are the option row, or sit inside one, in an
    // already open picker or date panel. A bare empty node outside those
    // rows is not an option.
    if (!norm(node.textContent)) {
      const row = node.closest('li, td, [role="option"], [role="radio"], [role="checkbox"]');
      if (row && row !== panel && panel.contains(row)
          && row.closest('.el-select-dropdown, .el-picker-panel, .eo-cascader-panel, .eo-cascader-menu, .el-month-table, .el-date-table')) {
        return true;
      }
    }
    return false;
  }
  function isWriterTrigger(node, form) {
    if (!form.contains(node) || openPanel(node)) return false;
    if (node.closest('.el-date-editor .el-input__icon.el-icon-date')) return true;
    if (node.closest('.el-select input.el-input__inner') && !node.closest('.el-select-dropdown')) return true;
    const pointer = node.closest('div.input-l.pointer, input.input-l.pointer');
    return !!pointer && form.contains(pointer)
      && !pointer.closest('.plugin-dialog-wrap, .el-picker-panel, .el-select-dropdown');
  }
  // Basic gender and education admissions are the two in-form radio groups
  // clicked by the shipped writers. A hidden native radio may receive the
  // label's forwarded click; its visible, enabled label still owns the action.
  function isWriterRadio(node, form) {
    const question = activeSectionIndex === 0 ? '性别' : activeSectionIndex === 1 ? '是否统招' : null;
    const expected = activeSectionIndex === 0 ? ['男', '女'] : ['是', '否'];
    if (!question || !form.contains(node) || node.closest(PANEL_SELECTOR)) return false;
    const items = [...form.querySelectorAll('.el-form-item')].filter(item => {
      const labels = [...item.querySelectorAll('.el-form-item__label')]
        .filter(label => label.closest('.el-form-item') === item);
      return labels.length === 1 && norm(labels[0].textContent) === question;
    });
    if (items.length !== 1 || !items[0].contains(node)) return false;
    const item = items[0];
    const radios = [...item.querySelectorAll('input[type="radio"]')]
      .filter(input => input.closest('.el-form-item') === item);
    if (radios.length !== 2) return false;
    const labels = radios.map(input => input.closest('label.el-radio'));
    if (labels.some(label => !label || !item.contains(label) || !visible(label) || !enabled(label))
      || radios.some(input => !enabled(input))) return false;
    const values = labels.map(label => norm(label.querySelector('.el-radio__label')?.textContent));
    if (new Set(values).size !== 2 || !expected.every(value => values.includes(value))) return false;
    const group = radios[0].closest('.el-radio-group');
    if (!(group && item.contains(group) && radios.every(input => input.closest('.el-radio-group') === group))
      && !(radios[0].name && radios.every(input => input.name === radios[0].name))) return false;
    return labels.some((label, index) => label.contains(node)
      && (node === label || node === radios[index]
        || node.matches('.el-radio__label,.el-radio__input,.el-radio__inner')));
  }
  // Both shipped writers use this census-shaped cascader. Only these exact
  // questions in the sole active form may own a no-layout native leaf or a
  // hidden-footer discard. A body-level panel cannot borrow that ownership.
  function writerCascaderPanel(node, form) {
    const questions = activeSectionIndex === 2 ? ['期望工作地区']
      : activeSectionIndex === 3 ? ['职位类别', '公司所属行业'] : [];
    if (!questions.length || node.closest('form') !== form) return null;
    const item = node.closest('.el-form-item');
    if (!item || item.closest('form') !== form) return null;
    const labels = [...item.querySelectorAll('.el-form-item__label')]
      .filter(label => label.closest('.el-form-item') === item);
    if (labels.length !== 1 || !questions.includes(norm(labels[0].textContent))) return null;
    const question = norm(labels[0].textContent);
    const items = [...form.querySelectorAll('.el-form-item')].filter(item => {
      const labels = [...item.querySelectorAll('.el-form-item__label')]
        .filter(label => label.closest('.el-form-item') === item);
      return item.closest('form') === form && labels.length === 1 && norm(labels[0].textContent) === question;
    });
    if (items.length !== 1 || items[0] !== item) return null;
    const wraps = [...items[0].querySelectorAll(':scope > .el-form-item__content.cascader-wrap')];
    if (wraps.length !== 1) return null;
    const panels = [...wraps[0].querySelectorAll(':scope > div.dialog-wrap.plugin-dialog-wrap.popover.blue')];
    const open = [...doc.querySelectorAll('div.dialog-wrap.plugin-dialog-wrap.popover.blue')].filter(visible);
    return panels.length === 1 && open.length === 1 && open[0] === panels[0] && panels[0].contains(node)
      ? panels[0] : null;
  }
  function isWriterCascaderCheckbox(node, form) {
    if (!node.matches('input[type="checkbox"]') || node.form !== form || node.hasAttribute('form')) return false;
    const panel = writerCascaderPanel(node, form);
    if (!panel) return false;
    const menus = [...panel.querySelectorAll(':scope > div.eo-cascader-panel > div.eo-cascader-menu.simple-tree-outer')];
    const label = node.parentElement;
    const row = label?.parentElement;
    if (menus.length !== 2 || !label?.matches('label') || !row?.matches('li.branch:not(.has-child)')
      || !row.parentElement?.matches('ul.simple-tree-wrapper') || row.parentElement.parentElement !== menus[1]
      || !visible(label) || !visible(row) || !enabled(label) || !enabled(row)) return false;
    const labels = [...row.children].filter(child => child.tagName === 'LABEL');
    const inputs = [...label.querySelectorAll('input')];
    const text = norm(label.textContent);
    return labels.length === 1 && labels[0] === label && inputs.length === 1 && inputs[0] === node
      && !label.querySelector('a,button,select,textarea') && !!text
      && !['保存', '提交', '投递', '删除', '确定', '取消'].some(word => text.includes(word));
  }
  function isWorkHiddenPickerCancel(node, form) {
    if (activeSectionIndex !== 3 || !node.matches('a.cancel.pop-btn')
      || norm(node.textContent) !== '取消' || wouldNavigate(node)) return false;
    const panel = writerCascaderPanel(node, form);
    if (!panel) return false;
    const feet = [...panel.querySelectorAll('.pop-foot')];
    const cancels = [...panel.querySelectorAll('a.cancel.pop-btn')];
    return feet.length === 1 && feet[0].parentElement === panel && node.parentElement === feet[0]
      && cancels.length === 1 && cancels[0] === node && !visible(feet[0]) && enabled(feet[0]);
  }
  function isWorkMonthInput(node, form) {
    if (activeSectionIndex !== 3 || !form || node?.nodeType !== 1 || node.closest('form') !== form
      || node.form !== form || node.hasAttribute('form')) return false;
    const items = [...form.querySelectorAll('.el-form-item')].filter(item => {
      const labels = [...item.querySelectorAll('.el-form-item__label')]
        .filter(label => label.closest('.el-form-item') === item);
      return item.closest('form') === form && labels.length === 1 && norm(labels[0].textContent) === '任职时间';
    });
    if (items.length !== 1 || !items[0].contains(node)) return false;
    const editors = [...items[0].querySelectorAll('.el-date-editor')];
    const inputs = editors.flatMap(editor => [...editor.querySelectorAll('input')]);
    return editors.length === 2 && editors.every(editor => editor.closest('.el-form-item') === items[0]
      && editor.matches('.el-date-editor--month') && editor.querySelectorAll('input').length === 1
      && !editor.closest(PANEL_SELECTOR))
      && inputs.length === 2 && new Set(inputs).size === 2 && inputs.includes(node)
      && inputs.every(input => input.type === 'text' && input.readOnly && input.form === form
        && !input.hasAttribute('form') && visible(input) && enabled(input)
        && !input.closest('[disabled],[aria-disabled="true"],.is-disabled,.disabled,[formaction]'));
  }
  function classifyClick(target, event, allowLabelForwarding = false) {
    const node = target?.nodeType === 1 ? target : target?.parentElement;
    const denied = { allowed: false, kind: 'forbidden', reason: 'refusing_forbidden_click' };
    if (!node || !node.isConnected || !state().hrefOk || !state().visible) return denied;
    // The shared month writer dismisses with Escape on its exact inputs,
    // followed synchronously by root mousedown/up/click. Only that one event
    // may bypass the generic empty/unknown-click refusal, even after Escape
    // has hidden the month panel. Bare root clicks remain forbidden.
    if (node === doc.documentElement && event && event === monthDismissClick)
      return { allowed: true, kind: 'date_dismiss', reason: null };
    // type=submit is never a discard or picker action, including a footer
    // button whose default type is submit.
    if (submitControl(node)) return denied;
    const control = node.closest('button,a,input,label.el-radio,label.el-checkbox,li,td');
    const anchorHost = node.closest('a');
    if (node.closest('[disabled],[aria-disabled="true"],.is-disabled,.disabled,[formaction]')
      || control && !enabled(control) || anchorHost && wouldNavigate(anchorHost)) return denied;
    const hostText = controlText(node);
    if (['保存', '提交', '投递', '删除'].some(word => hostText.includes(word) || norm(node.textContent).includes(word))) return denied;
    const form = activeForm();
    // A single-select label may close its panel before the browser forwards
    // the activation to its native checkbox. Only capture may admit that one
    // event, within the validated label's synchronous click() call. Explicit
    // click()/dispatchEvent() calls on a hidden checkbox still fail closed.
    const forward = workLabelForward;
    if (allowLabelForwarding && forward && !forward.used && activeSectionIndex === 3
      && node === forward.input && form === forward.form && node.form === form && !node.hasAttribute('form')
      && event instanceof view.MouseEvent && event.target === node && node.matches('input[type="checkbox"]')
      && node.parentElement === forward.label && forward.label.parentElement === forward.row
      && forward.panel.contains(forward.row) && forward.panel.closest('form') === form && visible(form)
      && forward.label.querySelectorAll('input').length === 1
      && !forward.label.querySelector('a,button,select,textarea') && norm(forward.label.textContent) === forward.text) {
      forward.used = true;
      return { allowed: true, kind: 'picker_option', reason: null };
    }
    if (form && isWriterRadio(node, form)) return { allowed: true, kind: 'radio_option', reason: null };
    if (form && isWriterCascaderCheckbox(node, form)) return { allowed: true, kind: 'picker_option', reason: null };
    // The work writer uses this exact discard on a failed single-select
    // reveal even when the picker footer is hidden. The panel must be open.
    if (form && isWorkHiddenPickerCancel(node, form)) return { allowed: true, kind: 'cancel', reason: null };
    if (!visible(node)) return denied;
    const edit = node.closest('.title_ a.h-e-btn');
    if (activeSectionIndex !== 3 && edit && norm(edit.textContent) === '编辑' && !wouldNavigate(edit)
        && edit.closest('.r-section') === sections()[activeSectionIndex] && forms().length === 0) {
      return { allowed: true, kind: 'edit', reason: null };
    }
    if (activeSectionIndex === 3 && forms().length === 0) {
      const work = workOpeningControls(sections()[3]);
      const candidates = work.links.filter(visible);
      const anchor = node.closest('a');
      if (candidates.length === 1 && anchor === candidates[0] && !anchor.closest('form')) {
        return { allowed: true, kind: work.kind === 'title_add' ? 'add' : 'edit', reason: null };
      }
    }
    // Education's current writer opens an existing record through its icon,
    // or starts a new one through 添加/新增. These are the existing page roles.
    const anchor = node.closest('a');
    if (activeSectionIndex === 1 && anchor && !wouldNavigate(anchor) && forms().length === 0
      && anchor.closest('.r-section') === sections()[1]) {
      const row = anchor.closest('.sec-context > .sec-detail');
      const editRecord = row && anchor.querySelector('.el-icon-edit-outline')
        && ['', '编辑'].includes(norm(anchor.textContent));
      const addRecord = anchor.matches('a.h-e-btn') && anchor.closest('.title_')
        && ['添加', '新增'].includes(norm(anchor.textContent));
      if (editRecord || addRecord) return { allowed: true, kind: editRecord ? 'edit' : 'add', reason: null };
    }
    const panel = openPanel(node);
    const cancel = node.closest('button');
    if (form && cancel && form.contains(cancel) && cancel.type === 'button' && norm(cancel.textContent) === '取消' && !panel) {
      return { allowed: true, kind: 'cancel', reason: null };
    }
    if (panel && isPanelCancel(node, panel)) return { allowed: true, kind: 'cancel', reason: null };
    if (panel && isPanelConfirm(node, panel)) return { allowed: true, kind: 'panel_confirm', reason: null };
    if (hostText.includes('确定') || norm(node.textContent).includes('确定')) return denied;
    if (panel && isDateControl(node, panel)) return { allowed: true, kind: 'date_panel', reason: null };
    if (panel && isPanelOption(node, panel)) return { allowed: true, kind: 'picker_option', reason: null };
    // Known empty-label triggers the shipped writers click before a panel
    // exists. Any other empty click outside a panel stays forbidden.
    if (form && isWriterTrigger(node, form)) return { allowed: true, kind: 'picker_trigger', reason: null };
    return denied;
  }
  function noteClick(node, classification) {
    clickRows.push({ label: norm(node?.textContent).slice(0, 100), ...classification, sectionIndex: activeSectionIndex });
  }
  function forbiddenClick(node, event) {
    const classification = classifyClick(node, event);
    if (classification.allowed) return false;
    noteClick(node, classification);
    return true;
  }
  function refusal() {
    const error = new Error('refusing_forbidden_click');
    error.reason = 'refusing_forbidden_click';
    return error;
  }
  const originalClick = view.HTMLElement.prototype.click;
  view.HTMLElement.prototype.click = function guardedClick() {
    monthDismissal = null;
    if (forbiddenClick(this)) throw refusal();
    const form = activeForm();
    const input = this.matches('label') ? this.querySelector('input[type="checkbox"]') : null;
    const previous = workLabelForward;
    workLabelForward = activeSectionIndex === 3 && form && input && isWriterCascaderCheckbox(input, form)
      ? { input, form, label: this, row: this.parentElement, panel: this.closest(PANEL_SELECTOR),
        text: norm(this.textContent), used: false } : null;
    try { return originalClick.call(this); }
    finally { workLabelForward = previous; }
  };
  const originalDispatch = view.EventTarget.prototype.dispatchEvent;
  view.EventTarget.prototype.dispatchEvent = function guardedDispatch(event) {
    const form = activeForm();
    if (event?.type === 'keydown' && event.key === 'Escape' && isWorkMonthInput(this, form)) {
      monthDismissal = { form, input: this, stage: 0 };
    } else if (this === doc.documentElement && event instanceof view.MouseEvent && monthDismissal
      && monthDismissal.form === form && isWorkMonthInput(monthDismissal.input, form)
      && event.type === ['mousedown', 'mouseup', 'click'][monthDismissal.stage]) {
      monthDismissal.stage += 1;
      if (event.type === 'click') { monthDismissClick = event; monthDismissal = null; }
    } else {
      monthDismissal = null;
    }
    try {
      if (event?.type === 'click' && forbiddenClick(this, event)) throw refusal();
      return originalDispatch.call(this, event);
    } finally { monthDismissClick = null; }
  };
  function clickCapture(event) {
    const classification = classifyClick(event.target, event, true);
    noteClick(event.target, classification);
    if (!classification.allowed) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
  view.addEventListener('click', clickCapture, true);

  function noteRequest(method, rawUrl, via, forceBlock = false) {
    const verb = String(method || 'GET').toUpperCase();
    const allowed = !forceBlock && isAllowedRequest(verb, rawUrl);
    if (verb !== 'GET' || forceBlock) requestRows.push({
      method: verb, url: redactUrl(rawUrl), via, allowed, blocked: !allowed, sectionIndex: activeSectionIndex
    });
    return allowed;
  }
  function blockedRequest() {
    const error = new Error('disallowed_non_get');
    error.reason = 'disallowed_non_get';
    return error;
  }
  const originalFetch = view.fetch;
  if (typeof originalFetch === 'function') view.fetch = function guardedFetch(input, init, ...rest) {
    const method = init?.method || input?.method || 'GET';
    const url = typeof input === 'string' || input instanceof view.URL ? String(input) : input?.url || '';
    if (!noteRequest(method, url, 'fetch')) return Promise.reject(blockedRequest());
    return originalFetch.call(this, input, init, ...rest);
  };
  const xhr = view.XMLHttpRequest?.prototype;
  const originalOpen = xhr?.open;
  const originalSend = xhr?.send;
  const xhrRequests = new WeakMap();
  if (originalOpen && originalSend) {
    xhr.open = function guardedOpen(method, url, ...rest) {
      xhrRequests.set(this, { method, url: String(url) });
      return originalOpen.call(this, method, url, ...rest);
    };
    xhr.send = function guardedSend(...rest) {
      const request = xhrRequests.get(this) || { method: 'GET', url: '' };
      if (!noteRequest(request.method, request.url, 'xhr')) throw blockedRequest();
      return originalSend.call(this, ...rest);
    };
  }
  const originalBeacon = view.navigator?.sendBeacon;
  if (typeof originalBeacon === 'function') view.navigator.sendBeacon = function guardedBeacon(url, ...rest) {
    if (!noteRequest('POST', String(url), 'beacon')) return false;
    return originalBeacon.call(this, url, ...rest);
  };
  function submitCapture(event) {
    noteRequest(event.target?.method || 'GET', event.target?.action || '', 'submit', true);
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  view.addEventListener('submit', submitCapture, true);
  const formPrototype = view.HTMLFormElement.prototype;
  const originalSubmit = formPrototype.submit;
  const originalRequestSubmit = formPrototype.requestSubmit;
  const blockSubmit = function blockedSubmit() {
    noteRequest(this.method || 'GET', this.action || '', 'submit', true);
    throw blockedRequest();
  };
  formPrototype.submit = blockSubmit;
  if (originalRequestSubmit) formPrototype.requestSubmit = blockSubmit;

  async function waitFor(read) {
    const deadline = Date.now() + options.waitTimeoutMs;
    do {
      if (read()) return true;
      await new Promise(resolve => view.setTimeout(resolve, options.pollMs));
    } while (Date.now() < deadline);
    return false;
  }
  // Some shipped section writers own their open action. Arm the same guard
  // without substituting the generic title 编辑 path for that writer's opener.
  function activate(sectionIndex) {
    const shot = state();
    if (!Number.isInteger(sectionIndex) || sectionIndex < 0 || sectionIndex >= options.titles.length)
      return { ok: false, reason: 'section_not_supported' };
    if (!shot.hrefOk || !shot.titlesOk || shot.readyState !== 'complete' || !shot.visible)
      return { ok: false, reason: !shot.visible ? 'page_hidden' : 'page_not_ready' };
    if (shot.sectionFormCounts.some((count, index) => count > 0 && index !== sectionIndex))
      return { ok: false, reason: 'other_section_editor_open' };
    const ownForms = sections()[sectionIndex].querySelectorAll('form');
    if (ownForms.length > 1 || ownForms.length === 1 && !ownForms[0].matches('form.el-form.sec-form'))
      return { ok: false, reason: 'editor_not_unique' };
    activeSectionIndex = sectionIndex;
    return { ok: true, activeSectionIndex };
  }
  async function open(sectionIndex) {
    const decision = decideOpen(snapshot(sectionIndex));
    if (decision.action === 'stop') return { ok: false, openedByUs: false, ...decision };
    activeSectionIndex = sectionIndex;
    const openedByUs = decision.action === 'click_edit';
    const work = sectionIndex === 3 && openedByUs ? workOpeningControls(sections()[3]) : null;
    if (openedByUs) {
      const link = work ? work.links.find(visible)
        : [...sections()[sectionIndex].querySelectorAll('.title_ a.h-e-btn')]
          .find(node => norm(node.textContent) === '编辑' && visible(node));
      if (work && !classifyClick(link).allowed) {
        return { ok: false, openedByUs: false, action: 'stop', reason: 'control_not_supported', detail: 'edit_not_safe' };
      }
      link.click();
    }
    const ready = await waitFor(() => {
      const shot = snapshot(sectionIndex);
      return decideOpen(shot).action === 'already_open' && !!activeForm()?.querySelector('.el-form-item');
    });
    return ready
      ? { ok: true, openedByUs, alreadyOpen: !openedByUs,
        action: work?.kind === 'title_add' ? 'click_add' : decision.action,
        ...(work ? { opener: work.kind, entryCount: work.entryCount,
          ...(work.entryIndex == null ? {} : { entryIndex: work.entryIndex }) } : {}) }
      : { ok: false, openedByUs, reason: state().visible ? 'editor_items_not_rendered' : 'page_hidden' };
  }
  // Click 取消 first. If the form only hides, or a picker panel stays
  // teleported on document.body, disconnect those nodes. This is not a save.
  function discardEditor(sectionIndex) {
    const section = sections()[sectionIndex];
    if (section) section.querySelectorAll('form').forEach(node => node.remove());
    for (const panel of [...doc.querySelectorAll(PANEL_SELECTOR)]) {
      const owner = panel.closest('.r-section');
      if (!owner || owner === section) panel.remove();
    }
    if (forms().length === 0) activeSectionIndex = null;
    return forms().length === 0 && !section?.querySelector('form');
  }
  async function cancel(sectionIndex) {
    if (activeSectionIndex !== sectionIndex && forms().length > 0) {
      return { ok: false, closed: false, reason: 'editor_not_owned' };
    }
    const ownedForm = activeSectionIndex === sectionIndex ? activeForm() : null;
    if (forms().length === 0) {
      discardEditor(sectionIndex);
      activeSectionIndex = null;
      return { ok: true, closed: true, reason: null, alreadyClosed: true };
    }
    if (!ownedForm) {
      const closed = discardEditor(sectionIndex);
      return { ok: closed, closed, forced: closed, reason: closed ? null : 'editor_not_unique' };
    }
    const cancels = [...ownedForm.querySelectorAll('button')].filter(node => visible(node) && norm(node.textContent) === '取消');
    const decision = decideCancel({ cancelCount: cancels.length,
      cancelText: cancels.length === 1 ? norm(cancels[0].textContent) : '',
      cancelType: cancels.length === 1 ? cancels[0].type : '' });
    if (decision.action === 'click_cancel') {
      cancels[0].click();
      await waitFor(() => !ownedForm.isConnected && forms().length === 0);
    }
    const clickedClosed = !ownedForm.isConnected && forms().length === 0;
    const closed = clickedClosed ? (discardEditor(sectionIndex) || true) : discardEditor(sectionIndex);
    if (closed) activeSectionIndex = null;
    return { ok: closed, closed, forced: closed && !clickedClosed, reason: closed ? null : 'editor_still_open' };
  }
  function read(sectionIndex, questions) {
    const form = activeSectionIndex === sectionIndex ? activeForm() : null;
    const wanted = Array.isArray(questions) ? questions : [];
    const unsupported = q => ({ q, value: null, reason: 'control_not_supported' });
    if (!form) return { ok: false, reason: 'editor_not_open', readback: wanted.map(unsupported), extraLabels: [], unlabeled: 0 };
    const labeled = [];
    let unlabeled = 0;
    for (const item of form.querySelectorAll('.el-form-item')) {
      if (item.closest('form') !== form) continue;
      const labels = [...item.querySelectorAll('.el-form-item__label')].filter(node => node.closest('.el-form-item') === item);
      if (labels.length !== 1) { unlabeled += 1; continue; }
      labeled.push({ item, q: norm(labels[0].textContent) });
    }
    const readback = wanted.map(q => {
      const rows = labeled.filter(row => row.q === q);
      if (rows.length !== 1) return unsupported(q);
      const item = rows[0].item;
      const contact = [...item.querySelectorAll('.e-direct-row > span')].filter(visible);
      if (item.classList.contains('custom-direct-form-item') && contact.length === 1) {
        return { q, value: norm(contact[0].textContent), reason: 'site_readonly' };
      }
      const radios = [...item.querySelectorAll('input[type="radio"]')];
      if (radios.length) {
        const checked = radios.filter(node => node.checked);
        return checked.length <= 1 ? { q, value: norm(checked[0]?.closest('label.el-radio')?.querySelector('.el-radio__label')?.textContent), reason: null } : unsupported(q);
      }
      const controls = [...item.querySelectorAll('input,textarea')].filter(node => node.closest('.el-form-item') === item
        && !node.closest('.popover.plugin-dialog-wrap') && visible(node));
      if (controls.length === 2 && controls.every(node => node.closest('.el-date-editor--month'))) {
        const [startMonth, endMonth] = controls.map(node => String(node.value ?? ''));
        return { q, value: `${startMonth} | ${endMonth}`, startMonth, endMonth, reason: null,
          siteValidationFailed: item.classList.contains('is-error') || item.classList.contains('is-validating')
            || controls.some(node => node.getAttribute('aria-invalid') === 'true' || node.validity && !node.validity.valid)
            || [...item.querySelectorAll('.el-form-item__error')].some(node => visible(node) && norm(node.textContent)) };
      }
      return controls.length === 1 ? { q, value: String(controls[0].value ?? ''), reason: null } : unsupported(q);
    });
    return { ok: true, readback, extraLabels: labeled.map(row => row.q).filter(q => q && !wanted.includes(q)), unlabeled };
  }
  let restored = false;
  function restore() {
    if (restored) return;
    restored = true;
    view.removeEventListener('click', clickCapture, true);
    view.removeEventListener('submit', submitCapture, true);
    view.HTMLElement.prototype.click = originalClick;
    view.EventTarget.prototype.dispatchEvent = originalDispatch;
    formPrototype.submit = originalSubmit;
    if (originalRequestSubmit) formPrototype.requestSubmit = originalRequestSubmit;
    if (originalFetch) view.fetch = originalFetch;
    if (originalOpen) xhr.open = originalOpen;
    if (originalSend) xhr.send = originalSend;
    if (originalBeacon) view.navigator.sendBeacon = originalBeacon;
  }
  view.__gthFullLive = {
    open, activate, cancel, discard: discardEditor, read, state, snapshot,
    clicks: () => clickRows.slice(), requests: () => requestRows.slice(), restore
  };
  return { ok: true };
}
