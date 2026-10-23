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
// 成绩 is the English-ability select beside 英语证书名称. Locate requires
// that one certificate select. A displayed score is kept and the menu stays
// closed. An empty control is filled only from a confirmed profile
// ieltsScore. emptyProfile has no IELTS score key. normalizeProfile keeps
// an explicit ieltsScore for Never-Save tests. The options form does not
// edit it. Live needs a real confirmed score. The probe captured no 成绩
// option text, so no band is hardcoded. The open menu must show that exact
// string. 请选择成绩 and the inventory token 成绩 are not scores.
// Pending live Never-Save. This does not claim the site is supported.
// liveSupportClaimed stays false. Never clicks 保存/提交/投递/删除/下一步/返回/确定.
// Close is Escape. Does not target hotjob-mc, CMS core, uploads, readonly
// dates, cascaders, radios, checkboxes, or basic, region, edu-intent, and work fields.
(() => {
  const RANK = '专业排名';
  const ENGLISH = '英语证书名称';
  const SCORE = '成绩';
  // Optional confirmed string. Not on emptyProfile. Never-Save tests only.
  // Live must supply a real score whose text matches one open menu option.
  const IELTS_SCORE_PATH = 'ieltsScore';
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
    return { ok: true, kind: 'select', item, select, trigger, label };
  }

  function englishCertificatePresent() {
    const items = itemsFor(ENGLISH);
    if (items.length !== 1) return false;
    return locateSelect(items[0], ENGLISH).ok;
  }

  function locate(label) {
    if (!Object.hasOwn(KINDS, label)) return { ok: false, reason: 'label_not_allowed' };
    const items = itemsFor(label);
    if (items.length !== 1) return { ok: false, reason: 'control_not_supported' };
    const found = locateSelect(items[0], label);
    if (!found.ok) return found;
    if (label === SCORE && !englishCertificatePresent()) return { ok: false, reason: 'control_not_supported' };
    return found;
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

  function forbiddenOption(node) {
    const button = node.closest?.('button, a, [type="submit"]');
    if (button && FORBIDDEN.test(exact(button.textContent || ''))) return true;
    return FORBIDDEN.test(exact(node.textContent || ''));
  }

  function scoreFromProfile(profile) {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
      return { ok: false, reason: 'missing_profile_value', value: '' };
    }
    const raw = profile[IELTS_SCORE_PATH];
    const value = typeof raw === 'string' ? exact(raw) : '';
    const placeholder = `${PLACEHOLDER_PREFIX}${SCORE}`;
    if (!value || value === SCORE || value === placeholder) {
      return { ok: false, reason: 'missing_profile_value', value: '' };
    }
    if (!Array.isArray(profile.confirmedFields) || !profile.confirmedFields.includes(IELTS_SCORE_PATH)) {
      return { ok: false, reason: 'unconfirmed_profile_value', value: '' };
    }
    return { ok: true, reason: 'ready', value };
  }

  function withScorePath(label, row) {
    if (label !== SCORE || !row || typeof row !== 'object') return row;
    return { ...row, path: IELTS_SCORE_PATH };
  }

  async function fillSelect(found, label, want, missingReason = 'missing_profile_value') {
    const current = readDisplay(found);
    if (!current.ok) return refused(label, 'control_not_supported', { before: '', after: '', expected: want });
    const before = current.value;
    if (label === SCORE && before && (!want || before === want)) {
      return kept(label, 'preexisting_same_value', before, want || before, 'verified', true);
    }
    if (!want) return refused(label, missingReason, { before, after: before, expected: '' });
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
    if (forbiddenOption(matches[0])) {
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

  async function fillField(label, value, profile) {
    try {
      if (document.visibilityState === 'hidden') return withScorePath(label, refused(label, 'fill_interrupted_page_hidden'));
      if (!onPage()) return withScorePath(label, refused(label, 'wrong_page'));
      const found = locate(label);
      if (!found.ok) return withScorePath(label, refused(label, found.reason));
      let want = typeof value === 'string' ? exact(value) : '';
      let missingReason = 'missing_profile_value';
      if (label === SCORE && !want) {
        const resolved = scoreFromProfile(profile);
        if (resolved.ok) want = resolved.value;
        else missingReason = resolved.reason;
      }
      return withScorePath(label, await fillSelect(found, label, want, missingReason));
    } catch (error) {
      if (error?.message === 'never_save' || error?.code === 'never_save') return withScorePath(label, refused(label, 'never_save'));
      return withScorePath(label, refused(label, 'control_error'));
    }
  }

  async function cancelField(label) {
    try {
      if (!onPage()) return refused(label, 'wrong_page');
      const found = locate(label);
      if (!found.ok) return refused(label, found.reason);
      const current = readDisplay(found);
      if (!current.ok) return refused(label, 'control_not_supported');
      const before = current.value;
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
      const read = found.ok ? readDisplay(found) : { ok: false, value: '' };
      return {
        label,
        kind: KINDS[label],
        supported: false,
        reason: found.ok && read.ok ? 'structure_matched' : (found.ok ? 'control_not_supported' : found.reason),
        value: found.ok && read.ok ? read.value : '',
        ...(label === SCORE ? { path: IELTS_SCORE_PATH } : {})
      };
    });
    return result({
      ok: fields.every((field) => field.reason === 'structure_matched'),
      reason: 'structure_matched',
      fields
    });
  }

  async function fillFields(values, profile) {
    const source = profile ?? (values && typeof values === 'object' && !Array.isArray(values) && Object.hasOwn(values, IELTS_SCORE_PATH) ? values : null);
    const fields = [];
    for (const label of ORDER) fields.push(await fillField(label, values?.[label], source));
    return result({
      ok: fields.every((field) => field.ok === true && field.status === 'verified'),
      fields
    });
  }

  globalThis.ResumeHotjobPbCerts = Object.freeze({
    fillField,
    fillFields,
    cancelField,
    inspect,
    englishScorePath: IELTS_SCORE_PATH,
    liveSupportClaimed: false,
    supportClaimed: false,
    neverSave: true
  });
})();
