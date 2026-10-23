// Hotjob pb (Ant Design resumeOperation) Never-Save locate/fill for two fields only:
// 联系地址 (wireable_text, input.ant-input, placeholder 请填写联系地址) and
// 评价内容 (textarea.ant-input, placeholder 请填写评价内容).
// The live 评价内容 control can already hold a long intro. That prose is not stored
// here. A display that matches the profile after NFKC/whitespace clean is verified
// and not rewritten. An empty 评价内容 is painted once with the profile string after
// NFKC, zero-width strip, and edge trim. Internal spaces and newlines stay. Nothing
// is added and no essay is invented.
// 联系地址 follows the basic text path: exact() is both the compare key and the
// painted string.
// A row label matches only when it equals the field name after NFKC/whitespace clean,
// star/question-mark strip, and a trailing colon strip. 评价内容 does not match a
// different textarea label. Identical captions on one row still name it. Disagreeing
// captions and a second row stay fail-closed.
// Textarea locate rejects selects, radios, files, and any extra or non-ant textarea.
// Placeholder drift fails closed.
// Pending live Never-Save. This does not claim the site is supported.
// liveSupportClaimed and supportClaimed stay false. leftUnsaved stays true.
// Never clicks 保存/提交/投递/删除/下一步/返回/确定.
// Cancel sends Escape and leaves the current value.
// Does not target the mc deliver page, CMS runners, uploads, or other pb blocks.
(() => {
  const ADDRESS = '联系地址';
  const NOTE = '评价内容';
  const ORDER = Object.freeze([ADDRESS, NOTE]);
  const KINDS = Object.freeze({
    [ADDRESS]: 'text',
    [NOTE]: 'textarea'
  });
  const PLACEHOLDERS = Object.freeze({
    [ADDRESS]: '请填写联系地址',
    [NOTE]: '请填写评价内容'
  });
  const DROPDOWN_CLASSES = Object.freeze([
    'ant-select-dropdown',
    'ant-select-dropdown--single',
    'ant-select-dropdown-placement-bottomLeft'
  ]);
  const FORBIDDEN = /^(?:保存|提交|投递|删除|下一步|返回|确定|取消)$/u;
  const PATH = /^\/SU[0-9A-Za-z]{8,64}\/pb\/resumeOperation\.html$/u;
  const TEXT_STRAY = '.ant-select, select, .cascader-plugins-wrap, input.ant-radio-input, input[type="radio"], input.ant-checkbox-input, input[type="checkbox"], input[type="file"], textarea, .ant-calendar-picker-input';
  const AREA_STRAY = '.ant-select, select, .cascader-plugins-wrap, input.ant-radio-input, input[type="radio"], input.ant-checkbox-input, input[type="checkbox"], input.ant-input, input[type="file"], .ant-calendar-picker-input';

  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const exact = (value) => String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/gu, '')
    .replace(/[\s\u00a0]+/gu, '')
    .trim();
  const cleanLabel = (value) => exact(value).replace(/[＊*？?]/gu, '').replace(/[：:]+$/gu, '');
  const profileText = (value) => {
    if (typeof value !== 'string') return '';
    return value
      .normalize('NFKC')
      .replace(/[\u200b-\u200d\ufeff]/gu, '')
      .replace(/^[\s\u00a0]+|[\s\u00a0]+$/gu, '');
  };

  function flags() {
    return {
      liveSupportClaimed: false,
      supportClaimed: false,
      neverSave: true,
      saved: false,
      skippedSave: true,
      complete: false,
      leftUnsaved: true,
      softwareClickedSave: false,
      softwareClickedSubmit: false,
      softwareClickedDeliver: false,
      softwareClickedDelete: false,
      softwareClickedNext: false
    };
  }

  function visible(node) {
    if (!node || node.nodeType !== 1 || !node.isConnected) return false;
    if (node.hidden || node.closest('[hidden]')) return false;
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return node.getClientRects().length > 0;
  }

  function onPage() {
    let url;
    try { url = new URL(location.href); } catch { return false; }
    if (url.protocol !== 'https:' || url.hostname !== 'wecruit.hotjob.cn') return false;
    if (!PATH.test(url.pathname)) return false;
    if (document.querySelector('.el-form, .el-form-item, .my-list-item')) return false;
    return !!document.querySelector('.resume-operation-wrap');
  }

  function canonical(label) {
    const want = cleanLabel(label);
    return ORDER.find((item) => item === want) || '';
  }

  function formItems() {
    return [...document.querySelectorAll('.ant-row.ant-form-item')];
  }

  function ownedLabels(item) {
    return [...item.querySelectorAll('label')].filter((node) => node.closest('.ant-row.ant-form-item') === item);
  }

  function captionText(node) {
    const clone = node.cloneNode(true);
    clone.querySelectorAll('input, textarea, select, button, .ant-select, .cascader-plugins-wrap, .ant-calendar-picker, .ant-select-dropdown').forEach((child) => child.remove());
    return cleanLabel(clone.textContent);
  }

  function labelOf(item) {
    const captions = [...new Set(ownedLabels(item).map(captionText).filter(Boolean))];
    if (captions.length !== 1) return '';
    return captions[0];
  }

  function itemsFor(label) {
    const want = cleanLabel(label);
    return formItems().filter((item) => labelOf(item) === want);
  }

  function stray(item, selector) {
    return [...item.querySelectorAll(selector)].filter((node) => node.closest('.ant-row.ant-form-item') === item);
  }

  function locateText(item, placeholder) {
    if (stray(item, TEXT_STRAY).length) return { ok: false, reason: 'control_not_supported' };
    const inputs = stray(item, 'input.ant-input');
    if (inputs.length !== 1) return { ok: false, reason: 'control_not_supported' };
    const control = inputs[0];
    const attr = control.getAttribute('type');
    const type = String(control.type || '').toLowerCase();
    if (type !== 'text' || (attr && attr.toLowerCase() !== 'text')) return { ok: false, reason: 'control_not_supported' };
    if (placeholder != null && control.getAttribute('placeholder') !== placeholder) {
      return { ok: false, reason: 'control_not_supported' };
    }
    if (control.readOnly || control.disabled || control.classList.contains('ant-calendar-picker-input')) {
      return { ok: false, reason: 'control_not_supported' };
    }
    if (!visible(control)) return { ok: false, reason: 'control_not_supported' };
    return { ok: true, kind: 'text', item, control };
  }

  function locateTextarea(item, placeholder) {
    if (stray(item, AREA_STRAY).length) return { ok: false, reason: 'control_not_supported' };
    const areas = stray(item, 'textarea');
    if (areas.length !== 1) return { ok: false, reason: 'control_not_supported' };
    const control = areas[0];
    if (control.tagName !== 'TEXTAREA' || !control.classList.contains('ant-input')) {
      return { ok: false, reason: 'control_not_supported' };
    }
    if (placeholder != null && control.getAttribute('placeholder') !== placeholder) {
      return { ok: false, reason: 'control_not_supported' };
    }
    if (control.readOnly || control.disabled || !visible(control)) {
      return { ok: false, reason: 'control_not_supported' };
    }
    return { ok: true, kind: 'textarea', item, control };
  }

  function locate(label) {
    const name = canonical(label);
    if (!name) return { ok: false, reason: 'label_not_allowed' };
    const items = itemsFor(name);
    if (items.length !== 1) return { ok: false, reason: 'control_not_supported' };
    const found = KINDS[name] === 'textarea'
      ? locateTextarea(items[0], PLACEHOLDERS[name])
      : locateText(items[0], PLACEHOLDERS[name]);
    if (found.ok) found.label = name;
    return found;
  }

  function readRaw(found) {
    return String(found.control.value ?? '');
  }

  function leaves(container, excludeSelect) {
    return [...container.querySelectorAll('*')].filter((node) => {
      if (!visible(node)) return false;
      if (excludeSelect && node.closest('.ant-select')) return false;
      const text = exact(node.textContent);
      if (!text) return false;
      return ![...node.children].some((child) => visible(child) && exact(child.textContent) === text);
    });
  }

  function visibleDropdowns() {
    return [...document.querySelectorAll('.ant-select-dropdown')].filter((node) => visible(node)
      && DROPDOWN_CLASSES.every((name) => node.classList.contains(name)));
  }

  function anyOpen() {
    if ([...document.querySelectorAll('.ant-select.ant-select-open')].some(visible)) return true;
    if (visibleDropdowns().length) return true;
    return [...document.querySelectorAll('.cascader-plugins-wrap')].some((wrap) => leaves(wrap, true).length > 0);
  }

  function dispatchEscape(target) {
    if (!target?.dispatchEvent) return;
    const button = target.closest?.('button, a, [type="submit"]');
    if (button && FORBIDDEN.test(exact(button.textContent || ''))) return;
    const event = new KeyboardEvent('keydown', {
      key: 'Escape', code: 'Escape', bubbles: true, cancelable: true
    });
    try {
      Object.defineProperties(event, { keyCode: { get: () => 27 }, which: { get: () => 27 } });
    } catch { /* key still Escape */ }
    target.dispatchEvent(event);
  }

  async function leaveUnsaved(found) {
    const surfaces = [found?.control, document.activeElement, document.body];
    for (const surface of surfaces) dispatchEscape(surface);
    for (let i = 0; i < 8; i += 1) {
      if (!anyOpen()) return true;
      await pause(10);
    }
    return !anyOpen();
  }

  function writeControl(control, value) {
    const proto = Object.getPrototypeOf(control);
    const fallback = control.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value')
      || Object.getOwnPropertyDescriptor(fallback, 'value');
    if (!desc || typeof desc.set !== 'function') return false;
    desc.set.call(control, value);
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
    control.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  }

  function result(extra) {
    return {
      ...flags(),
      ...extra,
      liveSupportClaimed: false,
      supportClaimed: false,
      neverSave: true,
      leftUnsaved: true,
      saved: false,
      skippedSave: true,
      complete: false,
      softwareClickedSave: false,
      softwareClickedSubmit: false,
      softwareClickedDeliver: false,
      softwareClickedDelete: false,
      softwareClickedNext: false
    };
  }

  async function waitFor(read) {
    for (let i = 0; i < 12; i += 1) {
      const value = read();
      if (value) return value;
      await pause(10);
    }
    return null;
  }

  function refused(label, reason, extra = {}) {
    return result({ ok: false, label, status: 'failed', reason, opened: false, canceled: false, ...extra });
  }

  function kept(label, reason, before, want, status, ok) {
    return result({
      ok, label, status, reason,
      before, after: before, expected: want, opened: false, canceled: false, stillOpen: 0
    });
  }

  async function fillText(found, label, value) {
    const before = exact(readRaw(found));
    const want = typeof value === 'string' ? exact(value) : '';
    if (!want) return refused(label, 'missing_profile_value', { before, after: before, expected: '' });
    if (before === want) return kept(label, 'preexisting_same_value', before, want, 'verified', true);
    if (before) return kept(label, 'existing_value', before, want, 'skipped', false);
    if (anyOpen()) return refused(label, 'control_busy', { before, after: before, expected: want });
    found.control.focus();
    if (!writeControl(found.control, want)) {
      return refused(label, 'control_not_supported', { before, after: exact(readRaw(found)), expected: want });
    }
    const painted = await waitFor(() => exact(readRaw(found)) === want);
    const after = exact(readRaw(found));
    if (!painted || after !== want) {
      return refused(label, 'readback_mismatch', { before, after, expected: want, opened: false, canceled: false });
    }
    return result({
      ok: true, label, status: 'verified', reason: 'readback_matched',
      before, after, expected: want, opened: false, canceled: false, stillOpen: 0
    });
  }

  async function fillArea(found, label, value) {
    const beforeRaw = readRaw(found);
    const before = exact(beforeRaw);
    const want = profileText(value);
    const wantKey = exact(want);
    if (!wantKey) return refused(label, 'missing_profile_value', { before: beforeRaw, after: beforeRaw, expected: '' });
    if (before === wantKey) return kept(label, 'preexisting_same_value', beforeRaw, want, 'verified', true);
    if (before) return kept(label, 'existing_value', beforeRaw, want, 'skipped', false);
    if (anyOpen()) return refused(label, 'control_busy', { before: beforeRaw, after: beforeRaw, expected: want });
    found.control.focus();
    if (!writeControl(found.control, want)) {
      return refused(label, 'control_not_supported', { before: beforeRaw, after: readRaw(found), expected: want });
    }
    const painted = await waitFor(() => readRaw(found) === want);
    const after = readRaw(found);
    if (!painted || after !== want) {
      return refused(label, 'readback_mismatch', { before: beforeRaw, after, expected: want, opened: false, canceled: false });
    }
    return result({
      ok: true, label, status: 'verified', reason: 'readback_matched',
      before: beforeRaw, after, expected: want, opened: false, canceled: false, stillOpen: 0
    });
  }

  async function fillField(label, value) {
    const name = canonical(label) || String(label ?? '');
    try {
      if (document.visibilityState === 'hidden') return refused(name, 'fill_interrupted_page_hidden');
      if (!onPage()) return refused(name, 'wrong_page');
      if (!canonical(label)) return refused(name, 'label_not_allowed');
      const found = locate(label);
      if (!found.ok) return refused(name, found.reason);
      if (found.kind === 'textarea') return fillArea(found, name, value);
      return fillText(found, name, value);
    } catch (error) {
      if (error?.message === 'never_save' || error?.code === 'never_save') return refused(name, 'never_save');
      return refused(name, 'control_error');
    }
  }

  async function cancelField(label) {
    const name = canonical(label) || String(label ?? '');
    try {
      if (!onPage()) return refused(name, 'wrong_page');
      if (!canonical(label)) return refused(name, 'label_not_allowed');
      const found = locate(label);
      if (!found.ok) return refused(name, found.reason);
      const before = readRaw(found);
      const closed = await leaveUnsaved(found);
      const after = readRaw(found);
      const open = anyOpen();
      const ok = closed && !open && after === before;
      return result({
        ok, label: name, status: ok ? 'verified' : 'failed',
        reason: after !== before ? 'readback_mismatch' : (ok ? 'left_unsaved' : 'menu_cleanup_failed'),
        before, after, expected: before, opened: false, canceled: true, stillOpen: open ? 1 : 0
      });
    } catch (error) {
      if (error?.message === 'never_save' || error?.code === 'never_save') return refused(name, 'never_save');
      return refused(name, 'control_error');
    }
  }

  function inspect() {
    if (!onPage()) return result({ ok: false, reason: 'wrong_page', fields: [] });
    const fields = ORDER.map((label) => {
      const found = locate(label);
      return {
        label,
        kind: KINDS[label],
        supported: false,
        reason: found.ok ? 'structure_matched' : found.reason,
        value: found.ok ? readRaw(found) : ''
      };
    });
    const ok = fields.every((field) => field.reason === 'structure_matched');
    return result({
      ok,
      reason: ok ? 'structure_matched' : 'control_not_supported',
      fields
    });
  }

  async function fillFields(values) {
    const fields = [];
    for (const label of ORDER) fields.push(await fillField(label, values?.[label]));
    return result({
      ok: fields.every((field) => field.ok === true && field.status === 'verified'),
      fields
    });
  }

  globalThis.ResumeHotjobPbContactEval = Object.freeze({
    fillField,
    fillFields,
    cancelField,
    inspect,
    liveSupportClaimed: false,
    supportClaimed: false,
    neverSave: true,
    leftUnsaved: true
  });
})();
