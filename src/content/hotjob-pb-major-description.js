// Hotjob pb Never-Save trial for 专业描述 only.
// Evidence: the existing 2026-10-23 contact-eval and certs probe fixtures record
// textarea.ant-input and the exact 请填写专业描述 placeholder.
// Caller text is explicit data, never generated prose. Internal spaces/newlines stay.
// Standalone injection API only; liveSupportClaimed remains false.
(() => {
  const FIELD = '专业描述';
  const PLACEHOLDER = '请填写专业描述';
  const PATH = /^\/SU[0-9A-Za-z]{8,64}\/pb\/resumeOperation\.html$/u;
  const STRAY = '.ant-select, select, .cascader-plugins-wrap, input, .ant-calendar-picker-input';
  const exact = (value) => String(value ?? '').normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/gu, '').replace(/[\s\u00a0]+/gu, '');
  const labelKey = (value) => exact(value).replace(/[＊*？?]/gu, '').replace(/[：:]+$/gu, '');
  const prose = (value) => typeof value === 'string' ? value.normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/gu, '').trim() : '';
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const allowed = (label) => labelKey(label) === labelKey(FIELD);

  function result(extra = {}) {
    return {
      ...extra, liveSupportClaimed: false, supportClaimed: false,
      neverSave: true, leftUnsaved: true, saved: false, skippedSave: true, complete: false,
      softwareClickedSave: false, softwareClickedSubmit: false,
      softwareClickedDeliver: false, softwareClickedDelete: false, softwareClickedNext: false
    };
  }
  function refused(reason, extra = {}) {
    return result({ ok: false, label: FIELD, status: 'failed', reason,
      opened: false, canceled: false, stillOpen: 0, ...extra });
  }
  function visible(node) {
    if (!node?.isConnected || node.nodeType !== 1) return false;
    for (let part = node; part; part = part.parentElement) {
      const style = getComputedStyle(part);
      if (part.hidden || style.display === 'none' || style.visibility === 'hidden') return false;
    }
    return node.getClientRects().length > 0;
  }
  function onPage() {
    let url;
    try { url = new URL(location.href); } catch { return false; }
    return url.protocol === 'https:' && url.hostname === 'wecruit.hotjob.cn'
      && PATH.test(url.pathname) && !!document.querySelector('.resume-operation-wrap')
      && !document.querySelector('.el-form, .el-form-item, .my-list-item');
  }
  function owned(item, selector) {
    return [...item.querySelectorAll(selector)]
      .filter((node) => node.closest('.ant-row.ant-form-item') === item);
  }
  function caption(node) {
    const clone = node.cloneNode(true);
    clone.querySelectorAll('input, textarea, select, button, .ant-select, .cascader-plugins-wrap')
      .forEach((child) => child.remove());
    return labelKey(clone.textContent);
  }
  function locate() {
    const items = [...document.querySelectorAll('.ant-row.ant-form-item')].filter((item) => {
      const labels = [...new Set(owned(item, 'label').map(caption).filter(Boolean))];
      return labels.length === 1 && labels[0] === labelKey(FIELD);
    });
    if (items.length !== 1) return { ok: false, reason: 'control_not_supported' };
    const item = items[0];
    const areas = owned(item, 'textarea');
    if (areas.length !== 1 || owned(item, STRAY).length) return { ok: false, reason: 'control_not_supported' };
    const control = areas[0];
    if (!control.classList.contains('ant-input') || control.getAttribute('placeholder') !== PLACEHOLDER
      || control.disabled || control.readOnly || !visible(control)) {
      return { ok: false, reason: 'control_not_supported' };
    }
    return { ok: true, control };
  }
  function anyOpen() {
    if ([...document.querySelectorAll('.ant-select.ant-select-open, .ant-select-dropdown')].some(visible)) return true;
    return [...document.querySelectorAll('.cascader-plugins-wrap *')].some((node) =>
      visible(node) && !node.closest('.ant-select') && exact(node.textContent)
      && ![...node.children].some((child) => visible(child) && exact(child.textContent) === exact(node.textContent)));
  }
  function read(control) { return String(control.value ?? ''); }
  function inspect() {
    if (!onPage()) return result({ ok: false, reason: 'wrong_page', fields: [] });
    const found = locate();
    return result({ ok: found.ok, reason: found.ok ? 'structure_matched' : found.reason,
      fields: [{ label: FIELD, kind: 'textarea', supported: false,
        reason: found.ok ? 'structure_matched' : found.reason,
        value: found.ok ? read(found.control) : '' }] });
  }
  async function fillField(label, value) {
    try {
      if (document.visibilityState === 'hidden') return refused('fill_interrupted_page_hidden');
      if (!onPage()) return refused('wrong_page');
      if (!allowed(label)) return refused('label_not_allowed');
      const found = locate();
      if (!found.ok) return refused(found.reason);
      const before = read(found.control);
      const want = prose(value);
      const kept = { before, after: before, expected: want };
      if (!exact(want)) return refused('missing_profile_value', kept);
      if (exact(before) === exact(want)) return result({ ok: true, label: FIELD,
        status: 'verified', reason: 'preexisting_same_value', opened: false, canceled: false,
        stillOpen: 0, ...kept });
      if (before !== '') return result({ ok: false, label: FIELD, status: 'skipped',
        reason: 'existing_value', opened: false, canceled: false, stillOpen: 0, ...kept });
      if (anyOpen()) return refused('control_busy', kept);
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      if (!setter) return refused('control_not_supported', kept);
      found.control.focus();
      if (document.visibilityState === 'hidden') return refused('fill_interrupted_page_hidden', kept);
      if (!onPage()) return refused('wrong_page', kept);
      const ready = locate();
      if (!ready.ok || ready.control !== found.control) return refused('control_not_supported', kept);
      const focusedValue = read(ready.control);
      if (focusedValue !== '') return result({ ok: false, label: FIELD, status: 'skipped',
        reason: 'existing_value', opened: false, canceled: false, stillOpen: 0,
        before, after: focusedValue, expected: want });
      if (anyOpen()) return refused('control_busy', kept);
      setter.call(found.control, want);
      for (const type of ['input', 'change', 'blur']) found.control.dispatchEvent(new Event(type, { bubbles: true }));
      // Let event handlers settle before reading the current framework-owned control.
      await pause(0);
      // Re-locate after events: framework replacement must not verify a detached old node.
      let after = before;
      for (let i = 0; i < 12; i += 1) {
        if (document.visibilityState === 'hidden') return refused('fill_interrupted_page_hidden', { before, after, expected: want });
        if (!onPage()) return refused('wrong_page', { before, after, expected: want });
        const live = locate();
        if (!live.ok) return refused('control_not_supported', { before, after, expected: want });
        after = read(live.control);
        if (after === want) return result({ ok: true, label: FIELD, status: 'verified',
          reason: 'readback_matched', before, after, expected: want,
          opened: false, canceled: false, stillOpen: 0 });
        await pause(10);
      }
      return refused('readback_mismatch', { before, after, expected: want });
    } catch { return refused('control_error'); }
  }
  async function fillFields(values) {
    const field = await fillField(FIELD, values?.[FIELD]);
    return result({ ok: field.ok && field.status === 'verified', fields: [field] });
  }
  async function cancelField(label) {
    try {
      if (document.visibilityState === 'hidden') return refused('fill_interrupted_page_hidden');
      if (!onPage()) return refused('wrong_page');
      if (!allowed(label)) return refused('label_not_allowed');
      const found = locate();
      if (!found.ok) return refused(found.reason);
      const before = read(found.control);
      for (const target of [found.control, document.activeElement, document.body]) {
        const event = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true });
        try { Object.defineProperties(event, { keyCode: { get: () => 27 }, which: { get: () => 27 } }); } catch { /* key remains Escape */ }
        target?.dispatchEvent(event);
      }
      for (let i = 0; i < 8 && anyOpen(); i += 1) await pause(10);
      const live = locate();
      const after = live.ok ? read(live.control) : before;
      const open = anyOpen();
      const ok = live.ok && !open && before === after;
      return result({ ok, label: FIELD, status: ok ? 'verified' : 'failed',
        reason: !live.ok ? 'control_not_supported' : after !== before ? 'readback_mismatch' : open ? 'menu_cleanup_failed' : 'left_unsaved',
        before, after, expected: before, opened: false, canceled: true, stillOpen: open ? 1 : 0 });
    } catch { return refused('control_error'); }
  }
  async function fillProfile(profile, index = 0) {
    if (!Number.isInteger(index) || index < 0 || index > 29) return refused('invalid_profile_index');
    const path = `education.${index}.majorDescription`;
    const value = profile?.education?.[index]?.majorDescription;
    if (!exact(prose(value))) return refused('missing_profile_value', { path });
    if (!Array.isArray(profile?.confirmedFields) || !profile.confirmedFields.includes(path)) {
      return refused('unconfirmed_profile_value', { path });
    }
    return result({ ...(await fillField(FIELD, value)), path });
  }
  globalThis.ResumeHotjobPbMajorDescription = Object.freeze({
    fillField, fillFields, fillProfile, cancelField, inspect,
    liveSupportClaimed: false, supportClaimed: false, neverSave: true, leftUnsaved: true
  });
})();
