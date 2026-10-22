// Hotjob pb (Ant Design resumeOperation) Never-Save fill for three fields only:
// 现居住地, 籍贯 (ant cascader), 期望面试地点 (ant-select allow-clear).
// DOM is the 2026-10-23 probe: ant-row/ant-form-item, ant-select-enabled,
// cascader-plugins-wrap, ant-select-search__field, and the single-select dropdown.
// Pending live Never-Save. This does not claim the site is supported.
// liveSupportClaimed stays false. Never clicks 保存/提交/投递/删除/下一步/返回/确定.
// Does not target hotjob-mc.
(() => {
  const LABELS = Object.freeze({
    '现居住地': 'cascader',
    '籍贯': 'cascader',
    '期望面试地点（供参考，实际安排将根据笔试通过名单确定）': 'select'
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
  const cleanLabel = (value) => exact(value).replace(/[＊*？?]/gu, '').replace(/[：:]+$/gu, '');

  function flags() {
    return {
      liveSupportClaimed: false,
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

  function ownedLabels(item) {
    return [...item.querySelectorAll('label')].filter((node) => node.closest('.ant-row.ant-form-item') === item);
  }

  function itemsFor(label) {
    const want = cleanLabel(label);
    return [...document.querySelectorAll('.ant-row.ant-form-item')].filter((item) => {
      const labels = ownedLabels(item);
      return labels.length === 1 && cleanLabel(labels[0].textContent) === want;
    });
  }

  function locateCascader(item) {
    const wraps = [...item.querySelectorAll('.cascader-plugins-wrap')]
      .filter((wrap) => wrap.closest('.ant-row.ant-form-item') === item);
    if (wraps.length !== 1) return { ok: false, reason: 'control_not_supported' };
    const wrap = wraps[0];
    const selects = [...wrap.querySelectorAll('.ant-select')]
      .filter((node) => node.closest('.cascader-plugins-wrap') === wrap);
    if (selects.length !== 1) return { ok: false, reason: 'control_not_supported' };
    const select = selects[0];
    if (!select.classList.contains('ant-select-enabled')
      || select.classList.contains('ant-select-allow-clear')
      || select.classList.contains('ant-select-disabled')) {
      return { ok: false, reason: 'control_not_supported' };
    }
    return { ok: true, kind: 'cascader', item, wrap, select, trigger: select };
  }

  function locateSelect(item) {
    if (item.querySelector('.cascader-plugins-wrap')) return { ok: false, reason: 'control_not_supported' };
    const selects = [...item.querySelectorAll('.ant-select')]
      .filter((node) => node.closest('.ant-row.ant-form-item') === item);
    if (selects.length !== 1) return { ok: false, reason: 'control_not_supported' };
    const select = selects[0];
    const triggers = [...select.querySelectorAll('.ant-select-search__field')];
    if (!select.classList.contains('ant-select-enabled')
      || !select.classList.contains('ant-select-allow-clear')
      || select.classList.contains('ant-select-disabled')
      || triggers.length !== 1) {
      return { ok: false, reason: 'control_not_supported' };
    }
    return { ok: true, kind: 'select', item, select, trigger: triggers[0] };
  }

  function locate(label) {
    if (!Object.hasOwn(LABELS, label)) return { ok: false, reason: 'label_not_allowed' };
    const items = itemsFor(label);
    if (items.length !== 1) return { ok: false, reason: 'control_not_supported' };
    return LABELS[label] === 'cascader' ? locateCascader(items[0]) : locateSelect(items[0]);
  }

  function readDisplay(found) {
    const clone = found.select.cloneNode(true);
    clone.querySelectorAll('input, textarea, .ant-select-search__field, .ant-select-dropdown').forEach((node) => node.remove());
    return exact(clone.textContent);
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

  function menuLeaves(found) {
    if (found.kind === 'cascader') return leaves(found.wrap, true);
    const menus = visibleDropdowns();
    if (menus.length !== 1) return null;
    return leaves(menus[0], false);
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
    const nodes = menuLeaves(found);
    if (!nodes || !nodes.length) return null;
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
    return { ...flags(), saved: false, skippedSave: true, complete: false, liveSupportClaimed: false, ...extra };
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

  async function fillField(label, value) {
    try {
      if (document.visibilityState === 'hidden') return refused(label, 'fill_interrupted_page_hidden');
      if (!onPage()) return refused(label, 'wrong_page');
      const found = locate(label);
      if (!found.ok) return refused(label, found.reason);
      const want = typeof value === 'string' ? exact(value) : '';
      const before = readDisplay(found);
      if (!want) return refused(label, 'missing_profile_value', { before, after: before, expected: '' });
      if (before === want) {
        return result({
          ok: true, label, status: 'verified', reason: 'preexisting_same_value',
          before, after: before, expected: want, opened: false, canceled: false
        });
      }
      if (before) {
        return result({
          ok: false, label, status: 'skipped', reason: 'existing_value',
          before, after: before, expected: want, opened: false, canceled: false
        });
      }
      if (anyOpen()) return refused(label, 'control_busy', { before, after: before, expected: want });
      safeClick(found.trigger);
      const nodes = await waitFor(() => opened(found));
      if (!nodes) {
        const closed = await closeMenus(found);
        return refused(label, closed ? 'control_not_supported' : 'menu_cleanup_failed', {
          before, after: readDisplay(found), expected: want, opened: true, canceled: true,
          stillOpen: closed ? 0 : 1
        });
      }
      const matches = nodes.filter((node) => exact(node.textContent) === want);
      if (matches.length !== 1) {
        const closed = await closeMenus(found);
        const after = readDisplay(found);
        return refused(label, matches.length ? 'ambiguous_option' : 'option_not_found', {
          before, after, expected: want, opened: true, canceled: true,
          stillOpen: closed && !anyOpen() ? 0 : 1,
          reason: after !== before ? 'readback_mismatch' : (closed && !anyOpen()
            ? (matches.length ? 'ambiguous_option' : 'option_not_found')
            : 'menu_cleanup_failed')
        });
      }
      safeClick(matches[0]);
      const painted = await waitFor(() => readDisplay(found) === want && !anyOpen());
      if (!painted) {
        const closed = await closeMenus(found);
        const after = readDisplay(found);
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
    } catch (error) {
      if (error?.message === 'never_save') return refused(label, 'never_save');
      return refused(label, 'control_error');
    }
  }

  async function cancelField(label) {
    try {
      if (!onPage()) return refused(label, 'wrong_page');
      const found = locate(label);
      if (!found.ok) return refused(label, found.reason);
      const before = readDisplay(found);
      if (anyOpen()) return refused(label, 'control_busy', { before, after: before });
      safeClick(found.trigger);
      const nodes = await waitFor(() => opened(found));
      if (!nodes) {
        await closeMenus(found);
        return refused(label, 'control_not_supported', { before, after: readDisplay(found), opened: false, canceled: true });
      }
      const closed = await closeMenus(found);
      const after = readDisplay(found);
      const open = anyOpen();
      const ok = closed && !open && after === before;
      return result({
        ok, label, status: ok ? 'verified' : 'failed',
        reason: after !== before ? 'readback_mismatch' : (ok ? 'menu_closed' : 'menu_cleanup_failed'),
        before, after, expected: before, opened: true, canceled: true, stillOpen: open ? 1 : 0
      });
    } catch (error) {
      if (error?.message === 'never_save') return refused(label, 'never_save');
      return refused(label, 'control_error');
    }
  }

  function inspect() {
    if (!onPage()) return result({ ok: false, reason: 'wrong_page', fields: [] });
    const fields = Object.keys(LABELS).map((label) => {
      const found = locate(label);
      return {
        label,
        kind: LABELS[label],
        supported: false,
        reason: found.ok ? 'structure_matched' : found.reason,
        value: found.ok ? readDisplay(found) : ''
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
    for (const label of Object.keys(LABELS)) fields.push(await fillField(label, values?.[label]));
    return result({
      ok: fields.every((field) => field.ok === true && field.status === 'verified'),
      fields
    });
  }

  globalThis.ResumeHotjobPbRegion = Object.freeze({
    fillField,
    fillFields,
    cancelField,
    inspect,
    liveSupportClaimed: false
  });
})();
