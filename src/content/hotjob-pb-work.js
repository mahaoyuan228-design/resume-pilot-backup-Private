// Hotjob pb (Ant Design resumeOperation) Never-Save fill for four probe-backed
// work/internship block fields only:
// text 企业名称, 职位名称 (input.ant-input);
// textarea 工作描述 (textarea.ant-input);
// flat ant-select allow-clear 工作性质.
// Probe 2026-10-23 display samples (not hardcoded values): 中信证券股份有限公司 / 实习生 / 实习.
// The 工作描述 prose sample is not stored here.
// 工作性质 was not interactively opened; its selector is the probed
// ant-select ant-select-enabled ant-select-allow-clear. Dropdown and
// ant-select-search__field match the same page's flat ant-select probes.
// The closed search field can have no client rects; the probe still clicked that
// class, so locate requires the field to exist and the select box to be visible.
// Display read uses visible leaves and drops a 请选择{label} placeholder so a
// filled 实习 can match preexisting_same_value.
// 工作描述 preserves authored whitespace and Unicode; only browser newline
// normalization (CRLF/CR to LF) is applied. A nonempty textarea is kept.
// Text and prose belong to the single resume wrapper. Focus and event handlers
// cannot move or replace the original control and still receive a write or verify.
// Pending live Never-Save. This does not claim the site is supported.
// liveSupportClaimed stays false. Never clicks 保存/提交/投递/删除/下一步/返回/确定.
// Does not target hotjob-mc, CMS core, uploads, readonly dates, education,
// certificate selects, region, basic profile, or edu-intent fields.
(() => {
  const ORG = '企业名称';
  const NATURE = '工作性质';
  const POSITION = '职位名称';
  const DESCRIPTION = '工作描述';
  const ORDER = Object.freeze([ORG, NATURE, POSITION, DESCRIPTION]);
  const KINDS = Object.freeze({
    [ORG]: 'text',
    [POSITION]: 'text',
    [DESCRIPTION]: 'textarea',
    [NATURE]: 'select'
  });
  const DROPDOWN_CLASSES = Object.freeze([
    'ant-select-dropdown',
    'ant-select-dropdown--single',
    'ant-select-dropdown-placement-bottomLeft'
  ]);
  const FORBIDDEN = /^(?:保存|提交|投递|删除|下一步|返回|确定|取消)$/u;
  const PATH = /^\/SU[0-9A-Za-z]{8,64}\/pb\/resumeOperation\.html$/u;

  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const exact = (value) => String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/gu, '')
    .replace(/[\s\u00a0]+/gu, '')
    .trim();
  const writable = (value) => String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/gu, '')
    .replace(/^[\s\u00a0]+|[\s\u00a0]+$/gu, '');
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

  function pageRoot() {
    const roots = document.querySelectorAll('.resume-operation-wrap');
    return roots.length === 1 ? roots[0] : null;
  }

  function onPage() {
    let url;
    try { url = new URL(location.href); } catch { return false; }
    if (url.protocol !== 'https:' || url.hostname !== 'wecruit.hotjob.cn') return false;
    if (!PATH.test(url.pathname)) return false;
    if (document.querySelector('.el-form, .el-form-item, .my-list-item')) return false;
    return !!pageRoot();
  }

  function ownedLabels(item) {
    return [...item.querySelectorAll('label')].filter((node) => node.closest('.ant-row.ant-form-item') === item);
  }

  function itemsFor(label) {
    const want = cleanLabel(label);
    const root = pageRoot();
    if (!root) return [];
    return [...root.querySelectorAll('.ant-row.ant-form-item')].filter((item) => {
      const labels = ownedLabels(item);
      return item.closest('.resume-operation-wrap') === root
        && labels.length === 1 && cleanLabel(labels[0].textContent) === want;
    });
  }

  function stray(item, selector) {
    return [...item.querySelectorAll(selector)].filter((node) => node.closest('.ant-row.ant-form-item') === item);
  }

  function locateText(item) {
    if (stray(item, '.ant-select, .cascader-plugins-wrap, input.ant-radio-input, input[type="file"], textarea, .ant-calendar-picker-input').length) {
      return { ok: false, reason: 'control_not_supported' };
    }
    const inputs = stray(item, 'input.ant-input');
    if (inputs.length !== 1) return { ok: false, reason: 'control_not_supported' };
    const input = inputs[0];
    const attr = input.getAttribute('type');
    const type = String(input.type || '').toLowerCase();
    if (type !== 'text' || (attr && attr.toLowerCase() !== 'text')) return { ok: false, reason: 'control_not_supported' };
    if (input.readOnly || input.disabled || input.classList.contains('ant-calendar-picker-input')) {
      return { ok: false, reason: 'control_not_supported' };
    }
    if (!visible(input)) return { ok: false, reason: 'control_not_supported' };
    return { ok: true, kind: 'text', item, input };
  }

  function locateTextarea(item) {
    if (stray(item, '.ant-select, .cascader-plugins-wrap, input.ant-radio-input, input.ant-input, input[type="file"], .ant-calendar-picker-input').length) {
      return { ok: false, reason: 'control_not_supported' };
    }
    const areas = stray(item, 'textarea.ant-input');
    if (areas.length !== 1) return { ok: false, reason: 'control_not_supported' };
    const area = areas[0];
    if (area.readOnly || area.disabled || !visible(area)) return { ok: false, reason: 'control_not_supported' };
    return { ok: true, kind: 'textarea', item, input: area };
  }

  function locateSelect(item) {
    if (item.querySelector('.cascader-plugins-wrap')) return { ok: false, reason: 'control_not_supported' };
    if (stray(item, 'input.ant-radio-input, input.ant-input, input[type="file"], textarea, .ant-calendar-picker-input').length) {
      return { ok: false, reason: 'control_not_supported' };
    }
    const selects = stray(item, '.ant-select');
    if (selects.length !== 1) return { ok: false, reason: 'control_not_supported' };
    const select = selects[0];
    const triggers = [...select.querySelectorAll('.ant-select-search__field')];
    if (!select.classList.contains('ant-select-enabled')
      || !select.classList.contains('ant-select-allow-clear')
      || select.classList.contains('ant-select-disabled')
      || triggers.length !== 1
      || !visible(select)) {
      return { ok: false, reason: 'control_not_supported' };
    }
    return { ok: true, kind: 'select', item, select, trigger: triggers[0] };
  }

  function locate(label) {
    if (!Object.hasOwn(KINDS, label)) return { ok: false, reason: 'label_not_allowed' };
    const items = itemsFor(label);
    if (items.length !== 1) return { ok: false, reason: 'control_not_supported' };
    const kind = KINDS[label];
    const found = kind === 'text' ? locateText(items[0])
      : (kind === 'textarea' ? locateTextarea(items[0]) : locateSelect(items[0]));
    if (found.ok) {
      found.label = label;
      found.root = pageRoot();
    }
    return found;
  }

  function invalidTextFound(found) {
    if (document.visibilityState === 'hidden') return 'fill_interrupted_page_hidden';
    if (!onPage()) return 'wrong_page';
    if (pageRoot() !== found.root) return 'control_not_supported';
    const current = locate(found.label);
    if (!current.ok || current.item !== found.item || current.input !== found.input
      || found.input.closest('.resume-operation-wrap') !== found.root) return 'control_not_supported';
    return '';
  }

  function readControl(found) {
    return found.kind === 'textarea' ? prose(found.input.value) : exact(found.input.value);
  }

  function prose(value) {
    return String(value ?? '').replace(/\r\n?/gu, '\n');
  }

  function leaves(container, excludeSelect) {
    return [...container.querySelectorAll('*')].filter((node) => {
      if (!visible(node)) return false;
      if (excludeSelect && node.closest('.ant-select')) return false;
      if (node.matches('input, textarea')) return false;
      if (node.closest('.ant-select-search__field, .ant-select-dropdown') && !container.classList.contains('ant-select-dropdown')) return false;
      const text = exact(node.textContent);
      if (!text) return false;
      return ![...node.children].some((child) => visible(child) && exact(child.textContent) === text);
    });
  }

  function readDisplay(found) {
    const caption = ownedLabels(found.item)[0];
    const placeholder = `请选择${cleanLabel(caption ? caption.textContent : '')}`;
    const texts = leaves(found.select, false)
      .map((node) => exact(node.textContent))
      .filter((text) => text && text !== placeholder && text !== '请选择');
    const stripped = texts
      .map((text) => (placeholder && text.startsWith(placeholder) ? text.slice(placeholder.length) : text))
      .filter(Boolean);
    const unique = [...new Set(stripped)];
    if (unique.length > 1) return { ok: false, reason: 'control_not_supported', value: '' };
    return { ok: true, value: unique[0] || '' };
  }

  function readFound(found) {
    if (found.kind === 'select') return readDisplay(found);
    return { ok: true, value: readControl(found) };
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
    const menus = visibleDropdowns();
    if (menus.length !== 1) return null;
    const nodes = leaves(menus[0], false);
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

  function writeControl(found, value) {
    const node = found.input;
    const invalid = () => invalidTextFound(found) || (anyOpen() ? 'control_busy' : '');
    let reason = invalid();
    if (reason) return reason;
    const owner = node instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    const proto = Object.getPrototypeOf(node);
    const desc = Object.getOwnPropertyDescriptor(proto, 'value')
      || Object.getOwnPropertyDescriptor(owner.prototype, 'value');
    if (!desc || typeof desc.set !== 'function') return 'control_not_supported';
    if (String(node.value ?? '') !== '') return 'existing_value';
    desc.set.call(node, value);
    for (const type of ['input', 'change', 'blur']) {
      reason = invalid();
      if (reason) return reason;
      if (String(node.value ?? '') !== value) return 'readback_mismatch';
      node.dispatchEvent(new Event(type, { bubbles: true }));
    }
    return invalid();
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

  async function fillText(found, label, raw, want) {
    const beforeRaw = String(found.input.value ?? '');
    const before = readControl(found);
    if (!want || (found.kind === 'textarea' && !want.trim())) {
      return refused(label, 'missing_profile_value', { before, after: before, expected: '' });
    }
    if (before === want) return kept(label, 'preexisting_same_value', before, want, 'verified', true);
    if (beforeRaw !== '') return kept(label, 'existing_value', beforeRaw, want, 'skipped', false);
    if (anyOpen()) return refused(label, 'control_busy', { before, after: before, expected: want });
    const paintedValue = found.kind === 'textarea' ? prose(raw) : writable(raw);
    if ((found.kind === 'textarea' ? paintedValue : exact(paintedValue)) !== want) {
      return refused(label, 'control_not_supported', { before, after: before, expected: want });
    }
    found.input.focus();
    const writeReason = writeControl(found, paintedValue);
    if (writeReason) {
      return refused(label, writeReason, { before, after: readControl(found), expected: want });
    }
    const painted = await waitFor(() => {
      const reason = invalidTextFound(found);
      return reason ? { reason } : (readControl(found) === want ? { matched: true } : null);
    });
    const after = readControl(found);
    const reason = painted?.reason || invalidTextFound(found);
    if (reason) return refused(label, reason, { before, after, expected: want });
    if (!painted || after !== want) {
      return refused(label, 'readback_mismatch', { before, after, expected: want, opened: false, canceled: false });
    }
    return result({
      ok: true, label, status: 'verified', reason: 'readback_matched',
      before, after, expected: want, opened: false, canceled: false, stillOpen: 0
    });
  }

  async function fillSelect(found, label, want) {
    const current = readDisplay(found);
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
      const afterRead = readDisplay(found);
      return refused(label, closed ? 'control_not_supported' : 'menu_cleanup_failed', {
        before, after: afterRead.ok ? afterRead.value : before, expected: want, opened: true, canceled: true,
        stillOpen: closed ? 0 : 1
      });
    }
    const matches = nodes.filter((node) => exact(node.textContent) === want);
    if (matches.length !== 1) {
      const closed = await closeMenus(found);
      const afterRead = readDisplay(found);
      const after = afterRead.ok ? afterRead.value : before;
      return refused(label, matches.length ? 'ambiguous_option' : 'option_not_found', {
        before, after, expected: want, opened: true, canceled: true,
        stillOpen: closed && !anyOpen() ? 0 : 1,
        reason: after !== before ? 'readback_mismatch' : (closed && !anyOpen()
          ? (matches.length ? 'ambiguous_option' : 'option_not_found')
          : 'menu_cleanup_failed')
      });
    }
    const forbidden = matches[0].closest?.('button, a, [type="submit"]');
    if (forbidden && FORBIDDEN.test(exact(forbidden.textContent || ''))) {
      const closed = await closeMenus(found);
      return refused(label, 'never_save', {
        before, after: before, expected: want, opened: true, canceled: true,
        stillOpen: closed && !anyOpen() ? 0 : 1
      });
    }
    safeClick(matches[0]);
    const painted = await waitFor(() => {
      const read = readDisplay(found);
      return read.ok && read.value === want && !anyOpen();
    });
    if (!painted) {
      const closed = await closeMenus(found);
      const afterRead = readDisplay(found);
      const after = afterRead.ok ? afterRead.value : before;
      const open = anyOpen();
      return refused(label, after === want && !open ? 'readback_matched' : (open || !closed ? 'menu_cleanup_failed' : 'readback_mismatch'), {
        ok: after === want && !open,
        status: after === want && !open ? 'verified' : 'failed',
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
      const raw = typeof value === 'string' ? value : '';
      const want = found.kind === 'textarea' ? prose(raw) : exact(raw);
      if (found.kind === 'text' || found.kind === 'textarea') return await fillText(found, label, raw, want);
      return await fillSelect(found, label, want);
    } catch (error) {
      if (error?.message === 'never_save' || error?.code === 'never_save') return refused(label, 'never_save');
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
      if (found.kind !== 'select') {
        return refused(label, 'cancel_not_applicable', { before, after: before, opened: false, canceled: false, stillOpen: 0 });
      }
      if (anyOpen()) return refused(label, 'control_busy', { before, after: before });
      safeClick(found.trigger);
      const nodes = await waitFor(() => opened(found));
      if (!nodes) {
        await closeMenus(found);
        const afterRead = readDisplay(found);
        return refused(label, 'control_not_supported', {
          before, after: afterRead.ok ? afterRead.value : before, opened: false, canceled: true
        });
      }
      const closed = await closeMenus(found);
      const afterRead = readDisplay(found);
      const after = afterRead.ok ? afterRead.value : before;
      const open = anyOpen();
      const ok = closed && !open && after === before && afterRead.ok;
      return result({
        ok, label, status: ok ? 'verified' : 'failed',
        reason: after !== before ? 'readback_mismatch' : (ok ? 'menu_closed' : 'menu_cleanup_failed'),
        before, after, expected: before, opened: true, canceled: true, stillOpen: open ? 1 : 0
      });
    } catch (error) {
      if (error?.message === 'never_save' || error?.code === 'never_save') return refused(label, 'never_save');
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

  globalThis.ResumeHotjobPbWork = Object.freeze({
    fillField,
    fillFields,
    cancelField,
    inspect,
    liveSupportClaimed: false,
    supportClaimed: false,
    neverSave: true
  });
})();
