// Hotjob pb (Ant Design resumeOperation) Never-Save fill for eight probe-backed
// flat selects only: 专业排名, 英语证书名称, 成绩, 证券从业资格考试,
// 注册会计师考试, 国家司法考试, FRM, CFA.
// These selects were not individually opened. Selector classes are
// ant-select ant-select-enabled ant-select-allow-clear. Dropdown class and
// ant-select-search__field match the same page's flat ant-select probes.
// Open/focused/enabled matches that ant-select contract.
// A closed .ant-select-search__field can have no client rects. The click
// then uses the visible .ant-select-selection / [role=combobox] face.
// Readback uses .ant-select-selection-selected-value and strips a
// 请选择+label placeholder. 成绩's page text is the placeholder 请选择成绩,
// so that placeholder reads empty. Option text is whatever the open menu
// shows. Nothing is hardcoded.
// Each attempt retains the original page, wrapper, row, search, and click face.
// Every awaited step rechecks that owner before accepting menu or display text.
// Pending live Never-Save. This does not claim the site is supported.
// liveSupportClaimed stays false. Never clicks 保存/提交/投递/删除/下一步/返回/确定.
// Close is Escape. Does not target hotjob-mc, CMS core, uploads, readonly
// dates, cascaders, radios, checkboxes, or basic, region, edu-intent, and work fields.
(() => {
  const RANK = '专业排名';
  const ENGLISH = '英语证书名称';
  const SCORE = '成绩';
  const SECURITIES = '证券从业资格考试';
  const CPA = '注册会计师考试';
  const BAR = '国家司法考试';
  const FRM = 'FRM';
  const CFA = 'CFA';
  const ORDER = Object.freeze([RANK, ENGLISH, SCORE, SECURITIES, CPA, BAR, FRM, CFA]);
  const KINDS = Object.freeze({
    [RANK]: 'select',
    [ENGLISH]: 'select',
    [SCORE]: 'select',
    [SECURITIES]: 'select',
    [CPA]: 'select',
    [BAR]: 'select',
    [FRM]: 'select',
    [CFA]: 'select'
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
    for (let ancestor = node; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.hidden || ancestor.hasAttribute('inert')) return false;
      const style = getComputedStyle(ancestor);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    }
    return node.getClientRects().length > 0;
  }

  function disabled(node) {
    return !!node.closest('[disabled], [aria-disabled="true"], [inert]');
  }

  function onPage() {
    let url;
    try { url = new URL(location.href); } catch { return false; }
    if (url.protocol !== 'https:' || url.hostname !== 'wecruit.hotjob.cn') return false;
    if (!PATH.test(url.pathname)) return false;
    if (document.querySelector('.el-form, .el-form-item, .my-list-item')) return false;
    const roots = [...document.querySelectorAll('.resume-operation-wrap')];
    return roots.length === 1 && visible(roots[0]) && !disabled(roots[0]);
  }

  function ownedLabels(item) {
    return [...item.querySelectorAll('label')].filter((node) => node.closest('.ant-row.ant-form-item') === item);
  }

  function itemsFor(label, root) {
    const want = cleanLabel(label);
    return [...root.querySelectorAll('.ant-row.ant-form-item')].filter((item) => {
      const labels = ownedLabels(item);
      return labels.length === 1 && cleanLabel(labels[0].textContent) === want;
    });
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

  function locateSelect(item, label) {
    if (!visible(item) || disabled(item)
      || item.parentElement?.closest('.ant-row.ant-form-item')
      || item.querySelector('.ant-row.ant-form-item')) return { ok: false, reason: 'control_not_supported' };
    const labels = ownedLabels(item);
    if (labels.length !== 1 || !visible(labels[0])) return { ok: false, reason: 'control_not_supported' };
    if (item.querySelector('.cascader-plugins-wrap')) return { ok: false, reason: 'control_not_supported' };
    if (stray(item, 'input.ant-radio-input, input.ant-checkbox-input, input[type="checkbox"], input.ant-input, input[type="file"], textarea, .ant-calendar-picker-input').length) {
      return { ok: false, reason: 'control_not_supported' };
    }
    const selects = stray(item, '.ant-select');
    if (selects.length !== 1) return { ok: false, reason: 'control_not_supported' };
    const select = selects[0];
    const triggers = [...select.querySelectorAll('.ant-select-search__field')]
      .filter((node) => node.closest('.ant-select') === select);
    const search = triggers[0];
    const face = selectFace(select);
    const trigger = search && visible(search) ? search : face;
    if (!select.classList.contains('ant-select-enabled')
      || !select.classList.contains('ant-select-allow-clear')
      || select.classList.contains('ant-select-disabled')
      || triggers.length !== 1
      || search.tagName !== 'INPUT' || search.type !== 'text'
      || search.disabled || search.readOnly || disabled(search)
      || search.value !== ''
      || stray(item, 'input, textarea, select').some((node) => node !== search)
      || !visible(select)
      || disabled(select) || !trigger || disabled(trigger)
      || !readSelectText(select, label).ok) {
      return { ok: false, reason: 'control_not_supported' };
    }
    return { ok: true, kind: 'select', item, select, search, face, trigger, caption: labels[0], label };
  }

  function locate(label) {
    if (!Object.hasOwn(KINDS, label)) return { ok: false, reason: 'label_not_allowed' };
    const root = document.querySelector('.resume-operation-wrap');
    if (!root) return { ok: false, reason: 'control_not_supported' };
    const items = itemsFor(label, root);
    if (items.length !== 1) return { ok: false, reason: 'control_not_supported' };
    const found = locateSelect(items[0], label);
    if (found.ok) {
      found.root = root;
      found.href = location.href;
    }
    return found;
  }

  function invalidFound(found) {
    if (document.visibilityState === 'hidden') return 'fill_interrupted_page_hidden';
    if (location.href !== found.href || !onPage()) return 'wrong_page';
    const current = locate(found.label);
    if (!current.ok) return current.reason;
    if (current.root !== found.root || current.item !== found.item
      || current.caption !== found.caption || current.select !== found.select
      || current.search !== found.search
      || !found.trigger.isConnected || !visible(found.trigger) || disabled(found.trigger)
      || found.item.closest('.resume-operation-wrap') !== found.root
      || found.select.closest('.ant-row.ant-form-item') !== found.item
      || found.trigger.closest('.ant-select') !== found.select
      || found.trigger.closest('.resume-operation-wrap') !== found.root
      || (found.trigger !== found.search && current.face !== found.trigger)) {
      return 'control_not_supported';
    }
    return '';
  }

  function readDisplay(found) {
    return readSelectText(found.select, found.label);
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
    return [...document.querySelectorAll('.ant-select-dropdown')].filter(visible);
  }

  function anyOpen() {
    if ([...document.querySelectorAll('.ant-select.ant-select-open')].some(visible)) return true;
    if (visibleDropdowns().length) return true;
    return [...document.querySelectorAll('.cascader-plugins-wrap')].some((wrap) => leaves(wrap, true).length > 0);
  }

  function opened(found) {
    const select = found.select;
    const openSelects = [...document.querySelectorAll('.ant-select.ant-select-open')].filter(visible);
    if (openSelects.length !== 1 || openSelects[0] !== select) return null;
    if (!select.classList.contains('ant-select-open')
      || !select.classList.contains('ant-select-focused')
      || !select.classList.contains('ant-select-enabled')) return null;
    const menus = visibleDropdowns();
    if (menus.length !== 1 || (found.menu && found.menu !== menus[0])
      || !DROPDOWN_CLASSES.every((name) => menus[0].classList.contains(name))
      || menus[0].querySelector('input, textarea, select')) return null;
    found.menu = menus[0];
    const nodes = leaves(menus[0]);
    if (!nodes.length) return null;
    return { menu: menus[0], nodes };
  }

  function beforeOption(found, before) {
    const invalid = invalidFound(found);
    if (invalid) return invalid;
    const read = readDisplay(found);
    return !read.ok ? 'control_not_supported' : (read.value !== before ? 'readback_mismatch' : '');
  }

  function captureMenu(found) {
    if (found.menu) return;
    const menus = visibleDropdowns();
    if (menus.length === 1) found.menu = menus[0];
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
    // Cleanup belongs only to an attempt that passed the initial busy check.
    // A replaced row is never adopted as a new Escape target.
    captureMenu(found);
    let invalid = invalidFound(found);
    const surfaces = [...new Set([found.trigger, found.select, found.menu].filter(Boolean))];
    for (const surface of surfaces) {
      const originalOwner = found.root.isConnected && found.item.isConnected
        && found.item.closest('.resume-operation-wrap') === found.root
        && found.select.closest('.ant-row.ant-form-item') === found.item
        && found.select.closest('.resume-operation-wrap') === found.root
        && (surface === found.select || surface.closest('.ant-select') === found.select);
      if (surface.isConnected && (originalOwner || surface === found.menu)) dispatchEscape(surface);
      invalid ||= invalidFound(found);
      if (!anyOpen()) return { closed: true, invalid };
    }
    for (let i = 0; i < 8; i += 1) {
      invalid ||= invalidFound(found);
      if (!anyOpen()) return { closed: true, invalid };
      await pause(10);
    }
    invalid ||= invalidFound(found);
    return { closed: !anyOpen(), invalid };
  }

  function safeClick(node) {
    const button = node.closest?.('button, a, [type="submit"], label');
    const label = exact((button || node).textContent || '');
    if (button || FORBIDDEN.test(label)) {
      const error = Error('never_save');
      error.code = 'never_save';
      throw error;
    }
    node.click();
  }

  function result(extra) {
    return {
      ...flags(),
      ...extra,
      saved: false,
      skippedSave: true,
      complete: false,
      liveSupportClaimed: false,
      supportClaimed: false,
      neverSave: true
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

  function forbiddenOption(node) {
    const button = node.closest?.('button, a, [type="submit"], label');
    if (button) return true;
    return FORBIDDEN.test(exact(node.textContent || ''));
  }

  async function refuseOpened(found, label, reason, before, want) {
    const invalidBeforeCleanup = invalidFound(found);
    const cleanup = await closeMenus(found);
    const invalid = invalidBeforeCleanup || cleanup.invalid || invalidFound(found);
    const read = invalid ? { ok: false, value: before } : readDisplay(found);
    const after = read.ok ? read.value : before;
    const open = anyOpen();
    return refused(label, invalid || (after !== before ? 'readback_mismatch'
      : (open || !cleanup.closed ? 'menu_cleanup_failed' : reason)), {
      before, after, expected: want, opened: true, canceled: true, stillOpen: open ? 1 : 0
    });
  }

  async function fillSelect(found, label, want) {
    const invalid = invalidFound(found);
    if (invalid) return refused(label, invalid);
    const current = readDisplay(found);
    if (!current.ok) return refused(label, 'control_not_supported', { before: '', after: '', expected: want });
    const before = current.value;
    if (!want) return refused(label, 'missing_profile_value', { before, after: before, expected: '' });
    if (before === want) return kept(label, 'preexisting_same_value', before, want, 'verified', true);
    if (before) return kept(label, 'existing_value', before, want, 'skipped', false);
    if (anyOpen()) return refused(label, 'control_busy', { before, after: before, expected: want });
    let attempted = false;
    try {
      const beforeOpen = beforeOption(found, before);
      if (beforeOpen) return refused(label, beforeOpen, { before, after: before, expected: want });
      attempted = true;
      safeClick(found.trigger);
      captureMenu(found);
      const ready = await waitFor(() => {
        const reason = beforeOption(found, before);
        return reason ? { reason } : opened(found);
      });
      const invalidAfterOpen = beforeOption(found, before);
      if (invalidAfterOpen || ready?.reason || !ready) {
        return await refuseOpened(found, label, invalidAfterOpen || ready?.reason || 'control_not_supported', before, want);
      }
      const matches = ready.nodes.filter((node) => exact(node.textContent) === want);
      if (matches.length !== 1) {
        return await refuseOpened(found, label, matches.length ? 'ambiguous_option' : 'option_not_found', before, want);
      }
      const option = matches[0];
      const latest = opened(found);
      const currentMatches = latest?.nodes.filter((node) => exact(node.textContent) === want) || [];
      // The awaited menu and leaf must still be the current menu and leaf.
      // In particular, replacing a leaf with identical text does not authorize it.
      const invalidBeforeClick = beforeOption(found, before);
      if (invalidBeforeClick || !latest || latest.menu !== ready.menu
        || currentMatches.length !== 1 || currentMatches[0] !== option
        || !visible(option) || disabled(option)
        || option.closest('.ant-select-dropdown') !== ready.menu) {
        return await refuseOpened(found, label, invalidBeforeClick || 'control_not_supported', before, want);
      }
      if (forbiddenOption(option)) return await refuseOpened(found, label, 'never_save', before, want);
      safeClick(option);
      const painted = await waitFor(() => {
        const reason = invalidFound(found);
        if (reason) return { reason };
        const read = readDisplay(found);
        if (!read.ok) return { reason: 'control_not_supported' };
        return read.value === want && !anyOpen() ? { matched: true } : null;
      });
      const invalidAfterClick = painted?.reason || invalidFound(found);
      if (invalidAfterClick) return await refuseOpened(found, label, invalidAfterClick, before, want);
      const read = readDisplay(found);
      if (painted?.matched && read.ok && read.value === want && !anyOpen()) {
        return result({
          ok: true, label, status: 'verified', reason: 'readback_matched',
          before, after: want, expected: want, opened: true, canceled: false, stillOpen: 0
        });
      }
      const cleanup = await closeMenus(found);
      const invalidAfterCleanup = cleanup.invalid || invalidFound(found);
      const afterRead = invalidAfterCleanup ? { ok: false, value: before } : readDisplay(found);
      const after = afterRead.ok ? afterRead.value : before;
      const open = anyOpen();
      const verified = !invalidAfterCleanup && cleanup.closed && !open && afterRead.ok && after === want;
      return result({
        ok: verified, label, status: verified ? 'verified' : 'failed',
        reason: invalidAfterCleanup || (verified ? 'readback_matched'
          : (open || !cleanup.closed ? 'menu_cleanup_failed' : 'readback_mismatch')),
        before, after, expected: want, opened: true, canceled: true, stillOpen: open ? 1 : 0
      });
    } catch (error) {
      const reason = error?.message === 'never_save' || error?.code === 'never_save' ? 'never_save' : 'control_error';
      return attempted ? await refuseOpened(found, label, reason, before, want)
        : refused(label, reason, { before, after: before, expected: want });
    }
  }

  async function fillField(label, value) {
    try {
      if (document.visibilityState === 'hidden') return refused(label, 'fill_interrupted_page_hidden');
      if (!onPage()) return refused(label, 'wrong_page');
      const found = locate(label);
      if (!found.ok) return refused(label, found.reason);
      const want = typeof value === 'string' ? exact(value) : '';
      return await fillSelect(found, label, want);
    } catch (error) {
      if (error?.message === 'never_save' || error?.code === 'never_save') return refused(label, 'never_save');
      return refused(label, 'control_error');
    }
  }

  async function cancelField(label) {
    let found;
    let before = '';
    let attempted = false;
    try {
      if (document.visibilityState === 'hidden') return refused(label, 'fill_interrupted_page_hidden');
      if (!onPage()) return refused(label, 'wrong_page');
      found = locate(label);
      if (!found.ok) return refused(label, found.reason);
      const invalid = invalidFound(found);
      if (invalid) return refused(label, invalid);
      const current = readDisplay(found);
      if (!current.ok) return refused(label, 'control_not_supported');
      before = current.value;
      if (anyOpen()) return refused(label, 'control_busy', { before, after: before });
      const beforeOpen = beforeOption(found, before);
      if (beforeOpen) return refused(label, beforeOpen, { before, after: before });
      attempted = true;
      safeClick(found.trigger);
      captureMenu(found);
      const ready = await waitFor(() => {
        const reason = beforeOption(found, before);
        return reason ? { reason } : opened(found);
      });
      const invalidAfterOpen = beforeOption(found, before);
      if (invalidAfterOpen || ready?.reason || !ready || !opened(found)) {
        return await refuseOpened(found, label, invalidAfterOpen || ready?.reason || 'control_not_supported', before, before);
      }
      const cleanup = await closeMenus(found);
      const invalidAfterCleanup = cleanup.invalid || invalidFound(found);
      const afterRead = invalidAfterCleanup ? { ok: false, value: before } : readDisplay(found);
      const after = afterRead.ok ? afterRead.value : before;
      const open = anyOpen();
      const ok = !invalidAfterCleanup && cleanup.closed && !open && after === before && afterRead.ok;
      return result({
        ok, label, status: ok ? 'verified' : 'failed',
        reason: invalidAfterCleanup || (after !== before ? 'readback_mismatch' : (ok ? 'menu_closed' : 'menu_cleanup_failed')),
        before, after, expected: before, opened: true, canceled: true, stillOpen: open ? 1 : 0
      });
    } catch (error) {
      const reason = error?.message === 'never_save' || error?.code === 'never_save' ? 'never_save' : 'control_error';
      return attempted ? await refuseOpened(found, label, reason, before, before) : refused(label, reason);
    }
  }

  function inspect() {
    if (!onPage()) return result({ ok: false, reason: 'wrong_page', fields: [] });
    const fields = ORDER.map((label) => {
      const found = locate(label);
      const read = found.ok ? readDisplay(found) : { ok: false, value: '' };
      return {
        label,
        kind: KINDS[label],
        supported: false,
        reason: found.ok && read.ok ? 'structure_matched' : (found.ok ? 'control_not_supported' : found.reason),
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
    const href = location.href;
    const root = document.querySelector('.resume-operation-wrap');
    const invalidBatch = () => {
      if (document.visibilityState === 'hidden') return 'fill_interrupted_page_hidden';
      if (location.href !== href || !onPage()) return 'wrong_page';
      return document.querySelector('.resume-operation-wrap') !== root ? 'control_not_supported' : '';
    };
    let interrupted = invalidBatch();
    for (const label of ORDER) {
      interrupted ||= invalidBatch();
      if (interrupted) {
        fields.push(refused(label, interrupted));
        continue;
      }
      const field = await fillField(label, values?.[label]);
      fields.push(field);
      interrupted = invalidBatch() || (['wrong_page', 'fill_interrupted_page_hidden'].includes(field.reason) ? field.reason : '');
    }
    return result({
      ok: !interrupted && fields.every((field) => field.ok === true && field.status === 'verified'),
      fields
    });
  }

  globalThis.ResumeHotjobPbCerts = Object.freeze({
    fillField,
    fillFields,
    cancelField,
    inspect,
    liveSupportClaimed: false,
    supportClaimed: false,
    neverSave: true
  });
})();
