// Hotjob pb (Ant Design resumeOperation) Never-Save fill for the intent
// location cluster only:
// 意向一：期望工作地点, 意向二：期望工作地点 (ant cascader),
// 期望工作地是否服从分配 (input.ant-radio-input).
// Probe 2026-10-23: both locations are wireable_cascader, class
// ant-select ant-select-enabled, display token shown twice in the page text
// (same dual-face shape as 现居住地). The assignment control is a radio.
// Its valueSample is an internal code triple, not a display label. The page
// text beside that label is the two choice captions.
// Cascader locate accepts one enabled ant-select, or two when both displays
// match and are non-empty. Disagreeing, empty, hidden, disabled, allow-clear,
// or any other count fails closed. A control outside the single
// cascader-plugins-wrap fails closed. Identical captions on one row still
// name it. Disagreeing captions stay fail-closed.
// Readback uses .ant-select-selection-selected-value and strips a
// 请选择+label placeholder. These two menus were not opened. The open /
// focused / enabled classes and the wrap are the same page's 现居住地
// cascader. Close is Escape.
// Radio mirrors the 性别 contract: option text is the caption beside each
// input.ant-radio-input. Nothing is hardcoded. There is no menu to cancel.
// Pending live Never-Save. This does not claim the site is supported.
// liveSupportClaimed and supportClaimed stay false.
// Never clicks 保存/提交/投递/删除/下一步/返回/确定.
// Does not target hotjob-mc, CMS core, uploads, or other pb blocks.
(() => {
  const FIRST = '意向一：期望工作地点';
  const SECOND = '意向二：期望工作地点';
  const OBEY = '期望工作地是否服从分配';
  const ORDER = Object.freeze([FIRST, SECOND, OBEY]);
  const KINDS = Object.freeze({
    [FIRST]: 'cascader',
    [SECOND]: 'cascader',
    [OBEY]: 'radio'
  });
  const FORBIDDEN = /^(?:保存|提交|投递|删除|下一步|返回|确定|取消)$/u;
  const PLACEHOLDER_PREFIX = '请选择';
  const SELECTED_VALUE = '.ant-select-selection-selected-value';
  const PATH = /^\/SU[0-9A-Za-z]{8,64}\/pb\/resumeOperation\.html$/u;
  const CASCADER_STRAY = 'input.ant-radio-input, input.ant-checkbox-input, input.ant-input, input[type="file"], textarea, .ant-calendar-picker-input';
  const RADIO_STRAY = '.ant-select, .cascader-plugins-wrap, input.ant-checkbox-input, input.ant-input, input[type="file"], textarea, .ant-calendar-picker-input';

  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const exact = (value) => String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/gu, '')
    .replace(/[\s\u00a0]+/gu, '')
    .trim();
  const cleanLabel = (value) => exact(value).replace(/[＊*？?]/gu, '').replace(/[：:]+$/gu, '');

  function flags() {
    return {
      liveSupportClaimed: false,
      supportClaimed: false,
      neverSave: true,
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

  function singleRadioLabel(node, item) {
    const radios = [...node.querySelectorAll('input.ant-radio-input')]
      .filter((radio) => radio.closest('.ant-row.ant-form-item') === item);
    return radios.length === 1;
  }

  function radioItem(item, want) {
    const labels = ownedLabels(item);
    const captions = labels.filter((node) => captionText(node) === want);
    if (captions.length !== 1) return false;
    return labels.every((node) => node === captions[0] || singleRadioLabel(node, item));
  }

  function itemsFor(label) {
    const want = cleanLabel(label);
    if (KINDS[label] === 'radio') return formItems().filter((item) => radioItem(item, want));
    return formItems().filter((item) => labelOf(item) === want);
  }

  function stray(item, selector) {
    return [...item.querySelectorAll(selector)].filter((node) => node.closest('.ant-row.ant-form-item') === item);
  }

  function stripPrompt(text, label) {
    const prompt = exact(`${PLACEHOLDER_PREFIX}${label || ''}`);
    if (text === prompt || text === PLACEHOLDER_PREFIX) return '';
    if (label && text.startsWith(prompt)) return text.slice(prompt.length);
    return text;
  }

  function readSelectText(select, label) {
    const selected = [...select.querySelectorAll(SELECTED_VALUE)]
      .filter((node) => node.closest('.ant-select') === select);
    const texts = [...new Set(selected.map((node) => exact(node.textContent)).filter(Boolean))];
    if (texts.length > 1) return { ok: false, value: '' };
    if (texts.length === 1) return { ok: true, value: stripPrompt(texts[0], label) };
    const clone = select.cloneNode(true);
    clone.querySelectorAll('input, textarea, .ant-select-search__field, .ant-select-dropdown, .ant-select-selection__placeholder').forEach((node) => node.remove());
    return { ok: true, value: stripPrompt(exact(clone.textContent), label) };
  }

  function cascaderSelectOk(select) {
    return select.classList.contains('ant-select-enabled')
      && !select.classList.contains('ant-select-allow-clear')
      && !select.classList.contains('ant-select-disabled');
  }

  function locateCascader(item, label) {
    if (stray(item, CASCADER_STRAY).length) return { ok: false, reason: 'control_not_supported' };
    const wraps = [...item.querySelectorAll('.cascader-plugins-wrap')]
      .filter((wrap) => wrap.closest('.ant-row.ant-form-item') === item);
    if (wraps.length !== 1) return { ok: false, reason: 'control_not_supported' };
    const wrap = wraps[0];
    const selects = [...wrap.querySelectorAll('.ant-select')]
      .filter((node) => node.closest('.cascader-plugins-wrap') === wrap);
    const outside = stray(item, '.ant-select').filter((node) => !wrap.contains(node));
    if (outside.length || selects.length < 1 || selects.length > 2) {
      return { ok: false, reason: 'control_not_supported' };
    }
    if (selects.some((select) => !cascaderSelectOk(select) || !visible(select))) {
      return { ok: false, reason: 'control_not_supported' };
    }
    const reads = selects.map((select) => readSelectText(select, label));
    if (reads.some((read) => !read.ok)) return { ok: false, reason: 'control_not_supported' };
    if (selects.length === 2 && (!reads[0].value || reads[0].value !== reads[1].value)) {
      return { ok: false, reason: 'control_not_supported' };
    }
    return {
      ok: true,
      kind: 'cascader',
      item,
      wrap,
      select: selects[0],
      selects,
      trigger: selects[0]
    };
  }

  function radioOptionText(input, item) {
    let node = input.parentElement;
    while (node && node !== item) {
      const radios = [...node.querySelectorAll('input.ant-radio-input')]
        .filter((radio) => radio.closest('.ant-row.ant-form-item') === item);
      if (radios.length === 1 && radios[0] === input) {
        const clone = node.cloneNode(true);
        clone.querySelectorAll('input, textarea').forEach((child) => child.remove());
        const text = exact(clone.textContent);
        if (text) return text;
      }
      node = node.parentElement;
    }
    return '';
  }

  function locateRadio(item) {
    if (stray(item, RADIO_STRAY).length) return { ok: false, reason: 'control_not_supported' };
    const radios = stray(item, 'input.ant-radio-input');
    if (radios.length < 2) return { ok: false, reason: 'control_not_supported' };
    const optionTexts = [];
    for (const radio of radios) {
      const attr = (radio.getAttribute('type') || '').toLowerCase();
      if (attr !== 'radio' || radio.disabled || radio.readOnly || !visible(radio)) {
        return { ok: false, reason: 'control_not_supported' };
      }
      const text = radioOptionText(radio, item);
      if (!text) return { ok: false, reason: 'control_not_supported' };
      optionTexts.push(text);
    }
    if (new Set(optionTexts).size !== optionTexts.length) return { ok: false, reason: 'control_not_supported' };
    return { ok: true, kind: 'radio', item, radios, optionTexts };
  }

  function locate(label) {
    if (!Object.hasOwn(KINDS, label)) return { ok: false, reason: 'label_not_allowed' };
    const items = itemsFor(label);
    if (items.length !== 1) return { ok: false, reason: 'control_not_supported' };
    const found = KINDS[label] === 'cascader' ? locateCascader(items[0], label) : locateRadio(items[0]);
    if (found.ok) found.label = label;
    return found;
  }

  function readCascader(found) {
    const reads = found.selects.map((select) => readSelectText(select, found.label));
    if (reads.some((read) => !read.ok)) return { ok: false, reason: 'control_not_supported', value: '' };
    if (found.selects.length === 2 && reads[0].value !== reads[1].value) {
      return { ok: false, reason: 'control_not_supported', value: '' };
    }
    return { ok: true, value: reads[0].value };
  }

  function readRadio(found) {
    const checked = found.radios.filter((radio) => radio.checked);
    if (checked.length > 1) return { ok: false, reason: 'control_not_supported', value: '' };
    if (!checked.length) return { ok: true, value: '' };
    const value = radioOptionText(checked[0], found.item);
    if (!value) return { ok: false, reason: 'control_not_supported', value: '' };
    return { ok: true, value };
  }

  function readFound(found) {
    if (found.kind === 'radio') return readRadio(found);
    return readCascader(found);
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

  function anyOpen() {
    if ([...document.querySelectorAll('.ant-select.ant-select-open')].some(visible)) return true;
    return [...document.querySelectorAll('.cascader-plugins-wrap')].some((wrap) => leaves(wrap, true).length > 0);
  }

  function opened(found) {
    const select = found.select;
    if (!select.classList.contains('ant-select-open')
      || !select.classList.contains('ant-select-focused')
      || !select.classList.contains('ant-select-enabled')) return null;
    const nodes = leaves(found.wrap, true);
    if (!nodes.length) return null;
    return nodes;
  }

  function dispatchEscape(target) {
    if (!target?.dispatchEvent) return;
    const event = new KeyboardEvent('keydown', {
      key: 'Escape', code: 'Escape', bubbles: true, cancelable: true
    });
    try {
      Object.defineProperties(event, { keyCode: { get: () => 27 }, which: { get: () => 27 } });
    } catch { /* key still Escape */ }
    target.dispatchEvent(event);
  }

  async function closeMenus(found) {
    const surfaces = [found?.trigger, found?.select, document.activeElement, document.body];
    for (const surface of surfaces) dispatchEscape(surface);
    for (let i = 0; i < 8; i += 1) {
      if (!anyOpen()) return true;
      await pause(10);
    }
    return !anyOpen();
  }

  function safeClick(node) {
    const button = node.closest?.('button, a, [type="submit"]');
    const label = exact((button || node).textContent || '');
    if (button && FORBIDDEN.test(label)) {
      const error = Error('never_save');
      error.code = 'never_save';
      throw error;
    }
    node.click();
  }

  function result(extra) {
    return {
      ...flags(),
      saved: false,
      skippedSave: true,
      complete: false,
      liveSupportClaimed: false,
      supportClaimed: false,
      neverSave: true,
      ...extra
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

  async function fillCascader(found, label, want) {
    const current = readCascader(found);
    if (!current.ok) return refused(label, current.reason);
    const before = current.value;
    if (!want) return refused(label, 'missing_profile_value', { before, after: before, expected: '' });
    if (before === want) return kept(label, 'preexisting_same_value', before, want, 'verified', true);
    if (before) return kept(label, 'existing_value', before, want, 'skipped', false);
    if (anyOpen()) return refused(label, 'control_busy', { before, after: before, expected: want });
    safeClick(found.trigger);
    const nodes = await waitFor(() => opened(found));
    if (!nodes) {
      const closed = await closeMenus(found);
      return refused(label, closed ? 'control_not_supported' : 'menu_cleanup_failed', {
        before, after: readCascader(found).value, expected: want, opened: true, canceled: true,
        stillOpen: closed ? 0 : 1
      });
    }
    const matches = nodes.filter((node) => exact(node.textContent) === want);
    if (matches.length !== 1) {
      const closed = await closeMenus(found);
      const afterRead = readCascader(found);
      const after = afterRead.ok ? afterRead.value : before;
      const open = anyOpen();
      return refused(label, matches.length ? 'ambiguous_option' : 'option_not_found', {
        before, after, expected: want, opened: true, canceled: true,
        stillOpen: closed && !open ? 0 : 1,
        reason: after !== before ? 'readback_mismatch' : (closed && !open
          ? (matches.length ? 'ambiguous_option' : 'option_not_found')
          : 'menu_cleanup_failed')
      });
    }
    safeClick(matches[0]);
    const painted = await waitFor(() => {
      const read = readCascader(found);
      return read.ok && read.value === want && !anyOpen();
    });
    if (!painted) {
      const closed = await closeMenus(found);
      const afterRead = readCascader(found);
      const after = afterRead.ok ? afterRead.value : before;
      const open = anyOpen();
      const ok = after === want && !open;
      return refused(label, ok ? 'readback_matched' : (open || !closed ? 'menu_cleanup_failed' : 'readback_mismatch'), {
        ok, status: ok ? 'verified' : 'failed',
        before, after, expected: want, opened: true, canceled: true, stillOpen: open ? 1 : 0
      });
    }
    return result({
      ok: true, label, status: 'verified', reason: 'readback_matched',
      before, after: want, expected: want, opened: true, canceled: false, stillOpen: 0
    });
  }

  async function fillRadio(found, label, want) {
    const current = readRadio(found);
    if (!current.ok) return refused(label, current.reason);
    const before = current.value;
    if (!want) return refused(label, 'missing_profile_value', { before, after: before, expected: '' });
    if (before === want) return kept(label, 'preexisting_same_value', before, want, 'verified', true);
    if (before) return kept(label, 'existing_value', before, want, 'skipped', false);
    if (anyOpen()) return refused(label, 'control_busy', { before, after: before, expected: want });
    const indexes = found.optionTexts.map((text, index) => (text === want ? index : -1)).filter((index) => index >= 0);
    if (indexes.length !== 1) {
      return refused(label, indexes.length ? 'ambiguous_option' : 'option_not_found', {
        before, after: before, expected: want, opened: false, canceled: false, stillOpen: 0
      });
    }
    safeClick(found.radios[indexes[0]]);
    const painted = await waitFor(() => {
      const read = readRadio(found);
      return read.ok && read.value === want;
    });
    const afterRead = readRadio(found);
    const after = afterRead.ok ? afterRead.value : before;
    if (!painted || after !== want) {
      return refused(label, 'readback_mismatch', {
        before, after, expected: want, opened: false, canceled: false, stillOpen: anyOpen() ? 1 : 0
      });
    }
    return result({
      ok: true, label, status: 'verified', reason: 'readback_matched',
      before, after, expected: want, opened: false, canceled: false, stillOpen: 0
    });
  }

  async function fillField(label, value) {
    try {
      if (document.visibilityState === 'hidden') return refused(label, 'fill_interrupted_page_hidden');
      if (!onPage()) return refused(label, 'wrong_page');
      const found = locate(label);
      if (!found.ok) return refused(label, found.reason);
      const want = typeof value === 'string' ? exact(value) : '';
      if (found.kind === 'radio') return await fillRadio(found, label, want);
      return await fillCascader(found, label, want);
    } catch (error) {
      if (error?.message === 'never_save') {
        await closeMenus();
        return refused(label, 'never_save', { canceled: true, stillOpen: anyOpen() ? 1 : 0 });
      }
      return refused(label, 'control_error');
    }
  }

  async function cancelField(label) {
    try {
      if (!onPage()) return refused(label, 'wrong_page');
      const found = locate(label);
      if (!found.ok) return refused(label, found.reason);
      const current = readFound(found);
      if (!current.ok) return refused(label, current.reason);
      const before = current.value;
      if (found.kind !== 'cascader') {
        return refused(label, 'cancel_not_applicable', { before, after: before, opened: false, canceled: false, stillOpen: 0 });
      }
      if (anyOpen()) return refused(label, 'control_busy', { before, after: before });
      safeClick(found.trigger);
      const nodes = await waitFor(() => opened(found));
      if (!nodes) {
        await closeMenus(found);
        return refused(label, 'control_not_supported', { before, after: readCascader(found).value, opened: false, canceled: true });
      }
      const closed = await closeMenus(found);
      const afterRead = readCascader(found);
      const after = afterRead.ok ? afterRead.value : before;
      const open = anyOpen();
      const ok = closed && !open && after === before;
      return result({
        ok, label, status: ok ? 'verified' : 'failed',
        reason: after !== before ? 'readback_mismatch' : (ok ? 'menu_closed' : 'menu_cleanup_failed'),
        before, after, expected: before, opened: true, canceled: true, stillOpen: open ? 1 : 0
      });
    } catch (error) {
      if (error?.message === 'never_save') {
        await closeMenus();
        return refused(label, 'never_save', { canceled: true, stillOpen: anyOpen() ? 1 : 0 });
      }
      return refused(label, 'control_error');
    }
  }

  function inspect() {
    if (!onPage()) return result({ ok: false, reason: 'wrong_page', fields: [] });
    const fields = ORDER.map((label) => {
      const found = locate(label);
      const read = found.ok ? readFound(found) : { ok: false, value: '' };
      return {
        label,
        kind: KINDS[label],
        supported: false,
        reason: found.ok && read.ok ? 'structure_matched' : (found.ok ? read.reason : found.reason),
        value: found.ok && read.ok ? read.value : ''
      };
    });
    return result({
      ok: fields.every((field) => field.reason === 'structure_matched'),
      reason: 'structure_matched',
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

  globalThis.ResumeHotjobPbIntentLocation = Object.freeze({
    fillField,
    fillFields,
    cancelField,
    inspect,
    liveSupportClaimed: false,
    supportClaimed: false,
    neverSave: true
  });
})();
