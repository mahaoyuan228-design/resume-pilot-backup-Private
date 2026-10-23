// Additive hotjob-mc 证件号码 Never-Save experiment. Not wired into CMS or the engine.
// DOM provenance: existing hotjob-mc-basic-form.html #29_ref, backed by
// HOTJOB_MC_OPERATIONRESUMER_raw.json (2026-10-18): 请填写证件号码.
// Only fills an empty verified text input. No click, submit, save, or overwrite path.
// 待真机 Never-Save，未宣称已支持。liveSupportClaimed stays false.
(() => {
  const LABEL = '证件号码';
  const PLACEHOLDER = '请填写证件号码';
  const PATH = /^\/SU[0-9A-Za-z]{8,64}\/mc\/deliver\/operationResumer$/u;
  let busy = false;

  const norm = (value) => String(value ?? '').replace(/[\s\u00a0]+/gu, ' ').trim();
  const cleanLabel = (value) => norm(value).replace(/^\*\s*/u, '').replace(/\s*\*$/u, '').replace(/[：:]\s*$/u, '').trim();
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function result(partial) {
    return {
      ok: false,
      label: LABEL,
      status: 'refused',
      before: null,
      after: null,
      expected: '',
      writeAttempted: false,
      ...partial,
      siteId: 'hotjob-mc',
      neverSave: true,
      saved: false,
      skippedSave: true,
      saveClicks: 0,
      liveSupportClaimed: false,
      supportClaimed: false,
      softwareClickedNext: false,
      softwareClickedSave: false,
      softwareClickedSubmit: false,
      softwareClickedDeliver: false,
      softwareClickedDelete: false,
      note: '待真机 Never-Save，未宣称已支持'
    };
  }

  function visible(node) {
    if (!node || !node.isConnected) return false;
    for (let cursor = node; cursor?.nodeType === 1; cursor = cursor.parentElement) {
      const style = getComputedStyle(cursor);
      if (cursor.hidden || style.display === 'none' || style.visibility === 'hidden') return false;
    }
    return node.getClientRects().length > 0;
  }

  function onPage() {
    let url;
    try { url = new URL(location.href); } catch { return false; }
    if (url.protocol !== 'https:' || url.hostname !== 'wecruit.hotjob.cn' || !PATH.test(url.pathname)) return false;
    if (document.querySelector('.ant-form-item, .form-cell, .el-form')) return false;
    const titles = [...document.querySelectorAll('.resume-info-title')];
    return titles.length === 1 && cleanLabel(titles[0].textContent) === '基本信息' && visible(titles[0]);
  }

  function labelText(node) {
    const clone = node.cloneNode(true);
    clone.querySelectorAll('.iconfont').forEach((icon) => icon.remove());
    return cleanLabel(clone.textContent);
  }

  function locate() {
    const hits = [...document.querySelectorAll('.my-list-item')].filter((item) => {
      const titles = [...item.querySelectorAll('.header-title')]
        .filter((title) => title.closest('.my-list-item') === item);
      return titles.some((title) => labelText(title) === LABEL);
    });
    if (hits.length !== 1) return { ok: false, reason: hits.length ? 'field_ambiguous' : 'field_missing' };
    const item = hits[0];
    const titles = [...item.querySelectorAll('.header-title')]
      .filter((title) => title.closest('.my-list-item') === item);
    const controls = [...item.querySelectorAll('input, textarea, select, [contenteditable="true"]')];
    const inputs = [...item.querySelectorAll('.am-input-control input')];
    const input = inputs[0];
    if (item.id !== '29_ref' || titles.length !== 1 || labelText(titles[0]) !== LABEL
      || inputs.length !== 1 || controls.length !== 1 || controls[0] !== input
      || input.closest('.my-list-item') !== item
      || input.getAttribute('type') !== 'text' || input.type !== 'text'
      || input.getAttribute('placeholder') !== PLACEHOLDER
      || input.disabled || input.readOnly || !visible(item) || !visible(input)) {
      return { ok: false, reason: 'control_drift' };
    }
    return { ok: true, item, input };
  }

  function neighbors(target) {
    return [...document.querySelectorAll('input, textarea, select, .select-am-list-extra')]
      .filter((node) => node !== target)
      .map((node) => ({
        node,
        value: node.matches('.select-am-list-extra') ? node.textContent : node.value,
        checked: 'checked' in node ? node.checked : null
      }));
  }

  function neighborsUnchanged(before, target) {
    const after = neighbors(target);
    return before.length === after.length && before.every((row, index) => {
      const current = after[index];
      return row.node === current.node && row.node.isConnected
        && row.value === current.value && row.checked === current.checked;
    });
  }

  async function fillField(label, value) {
    const expected = typeof value === 'string' ? value.trim() : '';
    const state = { expected };
    if (label !== LABEL) return result({ reason: 'label_not_allowed', requestedLabel: label });
    if (!expected) return result({ reason: 'empty_value' });
    if (busy) return result({ reason: 'control_busy', ...state });
    busy = true;
    try {
      if (document.visibilityState === 'hidden') return result({ reason: 'page_hidden', ...state });
      if (!onPage()) return result({ reason: 'wrong_page', ...state });
      const found = locate();
      if (!found.ok) return result({ reason: found.reason, ...state });
      const input = found.input;
      state.before = input.value;
      state.after = input.value;
      // Raw nonempty values, including whitespace, never count as empty.
      if (input.value !== '') {
        const same = input.value === expected;
        return result({
          ...state, ok: same, status: same ? 'verified' : 'skipped',
          reason: same ? 'preexisting_same_value' : 'existing_value', neighborsUnchanged: true
        });
      }
      const snapshot = neighbors(input);
      input.focus();
      const again = locate();
      if (!onPage() || !again.ok || again.input !== input || input.value !== '' || !neighborsUnchanged(snapshot, input)) {
        return result({ ...state, after: input.value, reason: 'control_changed_before_write', neighborsUnchanged: neighborsUnchanged(snapshot, input) });
      }
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (!setter) return result({ ...state, reason: 'native_setter_missing' });
      state.writeAttempted = true;
      setter.call(input, expected);
      for (const type of ['input', 'change', 'blur']) input.dispatchEvent(new Event(type, { bubbles: true }));
      await pause(80);
      const readback = locate();
      state.after = input.value;
      const unchanged = neighborsUnchanged(snapshot, input);
      const matched = onPage() && document.visibilityState !== 'hidden'
        && readback.ok && readback.input === input && state.after === expected;
      return result({
        ...state, ok: matched && unchanged, status: matched && unchanged ? 'verified' : 'failed',
        reason: !unchanged ? 'neighbors_changed' : matched ? 'readback_matched' : 'readback_mismatch',
        neighborsUnchanged: unchanged
      });
    } catch {
      return result({ ...state, reason: 'control_error' });
    } finally {
      busy = false;
    }
  }

  async function fillProfile(profile) {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return result({ reason: 'profile_missing' });
    if (!Array.isArray(profile.confirmedFields) || !profile.confirmedFields.includes('identityNumber')) {
      return result({ reason: 'profile_fact_unconfirmed', path: 'identityNumber' });
    }
    if (!Object.hasOwn(profile, 'identityNumber') || typeof profile.identityNumber !== 'string' || !profile.identityNumber.trim()) {
      return result({ reason: 'missing_profile_value', path: 'identityNumber' });
    }
    return { ...await fillField(LABEL, profile.identityNumber), path: 'identityNumber' };
  }

  globalThis.ResumeHotjobMcIdNumber = Object.freeze({
    fillField,
    fillProfile,
    label: LABEL,
    neverSave: true,
    liveSupportClaimed: false
  });
})();
