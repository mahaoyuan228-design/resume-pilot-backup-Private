// Hotjob pb (Ant Design resumeOperation) Never-Save fill for the education-history
// row only: 学校 (flat ant-select allow-clear) and 城市 (ant cascader).
// Probe 2026-10-23: 学校 is ant-select ant-select-enabled ant-select-allow-clear
// and opens a select dropdown. 城市 is ant-select ant-select-enabled, clickOpens
// cascader, and the page text shows that city token twice.
// These two menus were not opened. Dropdown class and ant-select-search__field
// are the same page's flat ant-select probes. Open/focused/enabled and
// cascader-plugins-wrap are the same page's 现居住地 cascader.
// A closed .ant-select-search__field can have no client rect while
// .ant-select-selection / [role=combobox] is the visible face.
// Readback uses .ant-select-selection-selected-value and strips a 请选择+label
// placeholder. Option text is whatever the open menu shows. Nothing is hardcoded.
// Cascader locate accepts one enabled ant-select, or two when both displays
// match and are non-empty. Disagreeing, empty, hidden, disabled, allow-clear,
// or any other count fails closed. A control outside the single wrap fails closed.
// Identical captions on one row still name it. Disagreeing captions stay fail-closed.
// Two 学校 rows: use the visible allow-clear ant-select when it already shows a
// value and the other row is a display:none text input with no ant-select.
// Do not write that text input. An empty select, a second select, a visible
// text row, or any other count stays fail-closed. City still requires one form-item.
// Basic-block 毕业院校 and the other education-history rows stay on their own labels.
// Pending live Never-Save. This does not claim the site is supported.
// liveSupportClaimed and supportClaimed stay false.
// Close is Escape. Never clicks 保存/提交/投递/删除/下一步/返回/确定.
// Does not target hotjob-mc, CMS runners, uploads, or other pb blocks.
(() => {
  const SCHOOL = '学校';
  const CITY = '城市';
  const ORDER = Object.freeze([SCHOOL, CITY]);
  const KINDS = Object.freeze({
    [SCHOOL]: 'select',
    [CITY]: 'cascader'
  });
  const DROPDOWN_CLASSES = Object.freeze([
    'ant-select-dropdown',
    'ant-select-dropdown--single',
    'ant-select-dropdown-placement-bottomLeft'
  ]);
  const FORBIDDEN = /^(?:保存|提交|投递|删除|下一步|返回|确定|取消)$/u;
  const PLACEHOLDER_PREFIX = '请选择';
  const SELECTED_VALUE = '.ant-select-selection-selected-value';
  const SELECT_FACE = '.ant-select-selection, .ant-select-selector, .ant-select-selection-item, .ant-select-selection-selected-value, [role="combobox"]';
  const PATH = /^\/SU[0-9A-Za-z]{8,64}\/pb\/resumeOperation\.html$/u;
  const SELECT_STRAY = 'input.ant-radio-input, input.ant-checkbox-input, input[type="checkbox"], input.ant-input, input[type="file"], textarea, .ant-calendar-picker-input';
  const CASCADER_STRAY = SELECT_STRAY;
  const TEXT_STRAY = '.ant-select, .cascader-plugins-wrap, input.ant-radio-input, input.ant-checkbox-input, input[type="checkbox"], input[type="file"], textarea, .ant-calendar-picker-input';

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

  function itemsFor(label) {
    const want = cleanLabel(label);
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

  function selectFace(select) {
    const faces = [...select.querySelectorAll(SELECT_FACE)]
      .filter((node) => node.closest('.ant-select') === select
        && !node.matches('input, textarea, .ant-select-search__field')
        && visible(node));
    if (!faces.length) return null;
    return faces.find((node) => faces.every((other) => other === node || node.contains(other))) || faces[0];
  }

  function cascaderSelectOk(select) {
    return select.classList.contains('ant-select-enabled')
      && !select.classList.contains('ant-select-allow-clear')
      && !select.classList.contains('ant-select-disabled');
  }

  function locateSelect(item, label) {
    if (item.querySelector('.cascader-plugins-wrap')) return { ok: false, reason: 'control_not_supported' };
    if (stray(item, SELECT_STRAY).length) return { ok: false, reason: 'control_not_supported' };
    const selects = stray(item, '.ant-select');
    if (selects.length !== 1) return { ok: false, reason: 'control_not_supported' };
    const select = selects[0];
    const triggers = [...select.querySelectorAll('.ant-select-search__field')]
      .filter((node) => node.closest('.ant-select') === select);
    const search = triggers[0];
    const trigger = search && visible(search) ? search : selectFace(select);
    if (!select.classList.contains('ant-select-enabled')
      || !select.classList.contains('ant-select-allow-clear')
      || select.classList.contains('ant-select-disabled')
      || triggers.length !== 1
      || !visible(select)
      || !trigger
      || !readSelectText(select, label).ok) {
      return { ok: false, reason: 'control_not_supported' };
    }
    return { ok: true, kind: 'select', item, select, trigger };
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

  function schoolTextInput(item) {
    if (stray(item, TEXT_STRAY).length) return null;
    const inputs = stray(item, 'input.ant-input');
    if (inputs.length !== 1) return null;
    const control = inputs[0];
    const attr = control.getAttribute('type');
    const type = String(control.type || '').toLowerCase();
    if (type !== 'text' || (attr && attr.toLowerCase() !== 'text')) return null;
    if (control.readOnly || control.disabled || control.classList.contains('ant-calendar-picker-input')) return null;
    return control;
  }

  // A display:none 学校 row can hold the harvested text input. It is not written.
  function hiddenTextSchool(item) {
    const control = schoolTextInput(item);
    if (!control || visible(item) || visible(control)) return false;
    return true;
  }

  // One 学校 row stays the flat allow-clear select, including an empty one.
  // Two rows: keep that select only when it already shows a value and the other
  // row is a hidden text input with no ant-select. Anything else fails closed.
  function locateSchool(items) {
    if (items.length === 1) return locateSelect(items[0], SCHOOL);
    if (items.length !== 2) return { ok: false, reason: 'control_not_supported' };
    const hidden = items.filter((item) => hiddenTextSchool(item));
    const rest = items.filter((item) => !hidden.includes(item));
    if (hidden.length !== 1 || rest.length !== 1) return { ok: false, reason: 'control_not_supported' };
    const found = locateSelect(rest[0], SCHOOL);
    if (!found.ok) return found;
    const read = readSelectText(found.select, SCHOOL);
    if (!read.ok || !read.value) return { ok: false, reason: 'control_not_supported' };
    return found;
  }

  function locate(label) {
    if (!Object.hasOwn(KINDS, label)) return { ok: false, reason: 'label_not_allowed' };
    const items = itemsFor(label);
    const found = label === SCHOOL
      ? locateSchool(items)
      : (items.length === 1 ? locateCascader(items[0], label) : { ok: false, reason: 'control_not_supported' });
    if (found.ok) found.label = label;
    return found;
  }

  function readSelect(found) {
    const read = readSelectText(found.select, found.label);
    if (!read.ok) return { ok: false, reason: 'control_not_supported', value: '' };
    return { ok: true, value: read.value };
  }

  function readCascader(found) {
    const reads = found.selects.map((select) => readSelectText(select, found.label));
    if (reads.some((read) => !read.ok)) return { ok: false, reason: 'control_not_supported', value: '' };
    if (found.selects.length === 2 && reads[0].value !== reads[1].value) {
      return { ok: false, reason: 'control_not_supported', value: '' };
    }
    return { ok: true, value: reads[0].value };
  }

  function readFound(found) {
    if (found.kind === 'cascader') return readCascader(found);
    return readSelect(found);
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

  function opened(found) {
    const select = found.select;
    if (!select.classList.contains('ant-select-open')
      || !select.classList.contains('ant-select-focused')
      || !select.classList.contains('ant-select-enabled')) return null;
    if (found.kind === 'cascader') {
      const nodes = leaves(found.wrap, true);
      if (!nodes.length) return null;
      return nodes;
    }
    const menus = visibleDropdowns();
    if (menus.length !== 1) return null;
    const nodes = leaves(menus[0]);
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

  function forbiddenOption(node) {
    const button = node.closest?.('button, a, [type="submit"]');
    if (button && FORBIDDEN.test(exact(button.textContent || ''))) return true;
    return FORBIDDEN.test(exact(node.textContent || ''));
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

  async function fillMenu(found, label, want) {
    const current = readFound(found);
    if (!current.ok) return refused(label, current.reason, { before: '', after: '', expected: want });
    const before = current.value;
    if (!want) return refused(label, 'missing_profile_value', { before, after: before, expected: '' });
    if (before === want) return kept(label, 'preexisting_same_value', before, want, 'verified', true);
    if (before) return kept(label, 'existing_value', before, want, 'skipped', false);
    if (anyOpen()) return refused(label, 'control_busy', { before, after: before, expected: want });
    safeClick(found.trigger);
    const nodes = await waitFor(() => opened(found));
    if (!nodes) {
      const closed = await closeMenus(found);
      const afterRead = readFound(found);
      return refused(label, closed ? 'control_not_supported' : 'menu_cleanup_failed', {
        before, after: afterRead.ok ? afterRead.value : before, expected: want, opened: true, canceled: true,
        stillOpen: closed ? 0 : 1
      });
    }
    const matches = nodes.filter((node) => exact(node.textContent) === want);
    if (matches.length !== 1) {
      const closed = await closeMenus(found);
      const afterRead = readFound(found);
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
    if (forbiddenOption(matches[0])) {
      const closed = await closeMenus(found);
      const open = anyOpen();
      return refused(label, 'never_save', {
        before, after: before, expected: want, opened: true, canceled: true,
        stillOpen: closed && !open ? 0 : 1
      });
    }
    safeClick(matches[0]);
    const painted = await waitFor(() => {
      const read = readFound(found);
      return read.ok && read.value === want && !anyOpen();
    });
    if (!painted) {
      const closed = await closeMenus(found);
      const afterRead = readFound(found);
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

  async function fillField(label, value) {
    try {
      if (document.visibilityState === 'hidden') return refused(label, 'fill_interrupted_page_hidden');
      if (!onPage()) return refused(label, 'wrong_page');
      const found = locate(label);
      if (!found.ok) return refused(label, found.reason);
      const want = typeof value === 'string' ? exact(value) : '';
      return await fillMenu(found, label, want);
    } catch (error) {
      if (error?.message === 'never_save' || error?.code === 'never_save') {
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
      if (anyOpen()) return refused(label, 'control_busy', { before, after: before });
      safeClick(found.trigger);
      const nodes = await waitFor(() => opened(found));
      if (!nodes) {
        await closeMenus(found);
        const afterRead = readFound(found);
        return refused(label, 'control_not_supported', {
          before, after: afterRead.ok ? afterRead.value : before, opened: false, canceled: true
        });
      }
      const closed = await closeMenus(found);
      const afterRead = readFound(found);
      const after = afterRead.ok ? afterRead.value : before;
      const open = anyOpen();
      const ok = closed && !open && after === before && afterRead.ok;
      return result({
        ok, label, status: ok ? 'verified' : 'failed',
        reason: after !== before ? 'readback_mismatch' : (ok ? 'menu_closed' : 'menu_cleanup_failed'),
        before, after, expected: before, opened: true, canceled: true, stillOpen: open ? 1 : 0
      });
    } catch (error) {
      if (error?.message === 'never_save' || error?.code === 'never_save') {
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

  globalThis.ResumeHotjobPbEduHistory = Object.freeze({
    fillField,
    fillFields,
    cancelField,
    inspect,
    liveSupportClaimed: false,
    supportClaimed: false,
    neverSave: true
  });
})();
