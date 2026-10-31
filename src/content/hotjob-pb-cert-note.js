// Hotjob pb Never-Save trial for 说明（通过科目） only.
// Evidence: the existing 2026-10-23 contact-eval and certs probe fixtures record
// textarea.ant-input and the exact 请填写说明（通过科目） placeholder.
// Caller text is explicit data, never generated prose. Internal spaces/newlines stay.
// Repeated notes use DOM order, never an inferred association with an exam.
// Default fill chooses the first literally empty row; options.rowIndex is zero-based.
// Reuse the returned rowIndex to inspect or cancel that specific note.
// Standalone injection API only; liveSupportClaimed remains false.
(() => {
  const FIELD = '说明（通过科目）';
  const PLACEHOLDER = '请填写说明（通过科目）';
  const PATH = /^\/SU[0-9A-Za-z]{8,64}\/pb\/resumeOperation\.html$/u;
  const STRAY = '.ant-select, select, .cascader-plugins-wrap, input, .ant-calendar-picker-input';
  const exact = (value) => String(value ?? '').normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/gu, '').replace(/[\s\u00a0]+/gu, '');
  const labelKey = (value) => exact(value).replace(/[＊*？?]/gu, '').replace(/[：:]+$/gu, '');
  const prose = (value) => typeof value === 'string' ? value.normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/gu, '').replace(/\r\n?/gu, '\n').trim() : '';
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
  function locateRows() {
    const roots = [...document.querySelectorAll('.resume-operation-wrap')];
    if (roots.length !== 1) return { ok: false, reason: 'control_not_supported' };
    const root = roots[0];
    const items = [...root.querySelectorAll('.ant-row.ant-form-item')].filter((item) => {
      if (item.closest('.resume-operation-wrap') !== root) return false;
      const labels = [...new Set(owned(item, 'label').map(caption).filter(Boolean))];
      return labels.includes(labelKey(FIELD));
    });
    const rowCount = items.length;
    if (!rowCount) return { ok: false, reason: 'control_not_supported', rowCount };
    const rows = [];
    for (const [rowIndex, item] of items.entries()) {
      const labels = [...new Set(owned(item, 'label').map(caption).filter(Boolean))];
      const areas = owned(item, 'textarea');
      if (labels.length !== 1 || areas.length !== 1 || owned(item, STRAY).length) {
        return { ok: false, reason: 'control_not_supported', rowCount };
      }
      const control = areas[0];
      if (!control.classList.contains('ant-input') || control.getAttribute('placeholder') !== PLACEHOLDER
        || control.disabled || control.readOnly || !visible(control)) {
        return { ok: false, reason: 'control_not_supported', rowCount };
      }
      rows.push({ item, control, rowIndex, rowCount });
    }
    return { ok: true, root, rows, rowCount };
  }
  function selection(options) {
    if (options === undefined) return { ok: true, explicit: false };
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      return { ok: false, reason: 'invalid_row_index' };
    }
    if (!Object.hasOwn(options, 'rowIndex')) return { ok: true, explicit: false };
    const rowIndex = options.rowIndex;
    if (!Number.isInteger(rowIndex) || rowIndex < 0) return { ok: false, reason: 'invalid_row_index' };
    return { ok: true, explicit: true, rowIndex };
  }
  function locate(options) {
    const choice = selection(options);
    if (!choice.ok) return choice;
    const found = locateRows();
    if (!found.ok) return found;
    if (choice.explicit && choice.rowIndex >= found.rowCount) {
      return { ok: false, reason: 'row_index_out_of_range', rowIndex: choice.rowIndex, rowCount: found.rowCount };
    }
    // A singleton retains exact-value verification. Several occupied notes do not
    // establish which exam the caller means, even if one text happens to match.
    const rowIndex = choice.explicit ? choice.rowIndex
      : found.rows.findIndex((row) => read(row.control) === '');
    if (rowIndex < 0 && found.rowCount !== 1) return { ok: false, reason: 'row_not_empty', rowCount: found.rowCount };
    const chosen = found.rows[Math.max(rowIndex, 0)];
    return { ...found, ...chosen, values: found.rows.map((row) => read(row.control)) };
  }
  function pinned(found) {
    const live = locateRows();
    if (!live.ok || live.root !== found.root || live.rowCount !== found.rowCount
      || live.rows.some((row, index) => row.item !== found.rows[index].item)) {
      return { ok: false, reason: 'control_not_supported' };
    }
    const chosen = live.rows[found.rowIndex];
    // A replacement may be read within the original row, but a control moved
    // from another row must never stand in for the selected control.
    if (chosen.control !== found.control && (found.control.isConnected
      || found.rows.some((row) => row.control === chosen.control))) {
      return { ok: false, reason: 'control_not_supported' };
    }
    if (live.rows.some((row, index) => index !== found.rowIndex && read(row.control) !== found.values[index])) {
      return { ok: false, reason: 'readback_mismatch' };
    }
    return { ok: true, ...chosen };
  }
  function rowInfo(found) {
    return { rowIndex: found.rowIndex, rowCount: found.rowCount };
  }
  function anyOpen() {
    if ([...document.querySelectorAll('.ant-select.ant-select-open, .ant-select-dropdown')].some(visible)) return true;
    return [...document.querySelectorAll('.cascader-plugins-wrap *')].some((node) =>
      visible(node) && !node.closest('.ant-select') && exact(node.textContent)
      && ![...node.children].some((child) => visible(child) && exact(child.textContent) === exact(node.textContent)));
  }
  function read(control) { return String(control.value ?? ''); }
  function inspect(options) {
    if (!onPage()) return result({ ok: false, reason: 'wrong_page', fields: [] });
    const choice = selection(options);
    if (!choice.ok) return result({ ok: false, reason: choice.reason, fields: [] });
    const found = locateRows();
    if (!found.ok) return result({ ok: false, reason: found.reason, rowCount: found.rowCount,
      fields: [{ label: FIELD, kind: 'textarea', supported: false, reason: found.reason, value: '' }] });
    if (choice.explicit && choice.rowIndex >= found.rowCount) return result({ ok: false,
      reason: 'row_index_out_of_range', rowIndex: choice.rowIndex, rowCount: found.rowCount, fields: [] });
    const rows = choice.explicit ? [found.rows[choice.rowIndex]] : found.rows;
    return result({ ok: true, reason: 'structure_matched', rowCount: found.rowCount,
      fields: rows.map((row) => ({ label: FIELD, kind: 'textarea', supported: false,
        reason: 'structure_matched', value: read(row.control), ...rowInfo(row) })) });
  }
  async function fillField(label, value, options) {
    try {
      if (document.visibilityState === 'hidden') return refused('fill_interrupted_page_hidden');
      if (!onPage()) return refused('wrong_page');
      if (!allowed(label)) return refused('label_not_allowed');
      const found = locate(options);
      if (!found.ok) return refused(found.reason, rowInfo(found));
      const before = read(found.control);
      const want = prose(value);
      const info = rowInfo(found);
      const kept = { before, after: before, expected: want, ...info };
      if (!exact(want)) return refused('missing_profile_value', kept);
      if (before === want) return result({ ok: true, label: FIELD,
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
      const ready = pinned(found);
      if (!ready.ok || ready.control !== found.control) return refused(ready.reason || 'control_not_supported', kept);
      const focusedValue = read(ready.control);
      if (focusedValue !== '') return result({ ok: false, label: FIELD, status: 'skipped',
        reason: 'existing_value', opened: false, canceled: false, stillOpen: 0,
        before, after: focusedValue, expected: want, ...info });
      if (anyOpen()) return refused('control_busy', kept);
      setter.call(found.control, want);
      for (const type of ['input', 'change', 'blur']) {
        if (document.visibilityState === 'hidden' || !onPage()) break;
        const current = pinned(found);
        if (!current.ok || current.control !== found.control) break;
        found.control.dispatchEvent(new Event(type, { bubbles: true }));
      }
      // Let event handlers settle before reading the current framework-owned control.
      await pause(0);
      // Re-locate after events: framework replacement must not verify a detached old node.
      let after = before;
      for (let i = 0; i < 12; i += 1) {
        if (document.visibilityState === 'hidden') return refused('fill_interrupted_page_hidden', { before, after, expected: want, ...info });
        if (!onPage()) return refused('wrong_page', { before, after, expected: want, ...info });
        const live = pinned(found);
        if (!live.ok) return refused(live.reason, { before, after, expected: want, ...info });
        after = read(live.control);
        if (after === want) return result({ ok: true, label: FIELD, status: 'verified',
          reason: 'readback_matched', before, after, expected: want, ...info,
          opened: false, canceled: false, stillOpen: 0 });
        await pause(10);
      }
      return refused('readback_mismatch', { before, after, expected: want, ...info });
    } catch { return refused('control_error'); }
  }
  async function fillFields(values, options) {
    const field = await fillField(FIELD, values?.[FIELD], options);
    return result({ ok: field.ok && field.status === 'verified', fields: [field] });
  }
  async function cancelField(label, options) {
    try {
      if (document.visibilityState === 'hidden') return refused('fill_interrupted_page_hidden');
      if (!onPage()) return refused('wrong_page');
      if (!allowed(label)) return refused('label_not_allowed');
      const found = locate(options);
      if (!found.ok) return refused(found.reason, rowInfo(found));
      const before = read(found.control);
      for (const target of [found.control, document.activeElement, document.body]) {
        const event = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true });
        try { Object.defineProperties(event, { keyCode: { get: () => 27 }, which: { get: () => 27 } }); } catch { /* key remains Escape */ }
        target?.dispatchEvent(event);
      }
      for (let i = 0; i < 8 && anyOpen(); i += 1) await pause(10);
      const live = pinned(found);
      const after = live.ok ? read(live.control) : before;
      const open = anyOpen();
      const ok = live.ok && !open && before === after;
      return result({ ok, label: FIELD, status: ok ? 'verified' : 'failed',
        reason: !live.ok ? live.reason : after !== before ? 'readback_mismatch' : open ? 'menu_cleanup_failed' : 'left_unsaved',
        before, after, expected: before, ...rowInfo(found), opened: false, canceled: true, stillOpen: open ? 1 : 0 });
    } catch { return refused('control_error'); }
  }
  async function fillProfile(profile, options) {
    const path = `customAnswers.${FIELD}`;
    const value = profile?.customAnswers?.[FIELD];
    if (!exact(prose(value))) return refused('missing_profile_value', { path });
    if (!Array.isArray(profile?.confirmedFields) || !profile.confirmedFields.includes(path)) {
      return refused('unconfirmed_profile_value', { path });
    }
    // Do not turn several scoped answers into an arbitrary global answer.
    const facts = (Array.isArray(profile?.customFacts) ? profile.customFacts : [])
      .filter((row) => labelKey(row?.question) === labelKey(FIELD) && exact(prose(row?.answer)));
    if (facts.length > 1) return refused('ambiguous_profile_value', { path });
    if (facts.length === 1 && prose(facts[0].answer) !== prose(value)) {
      return refused('conflicting_profile_value', { path });
    }
    if (facts.length === 1 && facts[0].sitePageUrl) {
      let page;
      try { page = new URL(facts[0].sitePageUrl); } catch { return refused('profile_scope_mismatch', { path }); }
      if (`${page.origin}${page.pathname}` !== `${location.origin}${location.pathname}`) {
        return refused('profile_scope_mismatch', { path });
      }
    }
    return result({ ...(await fillField(FIELD, value, options)), path });
  }
  globalThis.ResumeHotjobPbCertNote = Object.freeze({
    fillField, fillFields, fillProfile, cancelField, inspect,
    liveSupportClaimed: false, supportClaimed: false, neverSave: true, leftUnsaved: true
  });
})();
