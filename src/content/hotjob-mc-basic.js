// Hotjob mc (antd-mobile H5) first-slice basic fill + mc-select.
// Isolated siteId: hotjob-mc. Never touches pb CMS_BASIC.
// 待真机 Never-Save，未宣称已支持。liveSupportClaimed stays false.
// Never clicks 下一步 / 保存 / 提交 / 投递 / 删除. Picker 确定/取消 is not a form save.
//
// First slice fields (live CDP 中联 SU661f… /mc/deliver/operationResumer 2026-10-18):
//   姓名 (text) · 移动电话 (text) · 电子邮箱 (text)
//   Never-Save only: 身高 / 体重 (exact probe placeholders; no live support claim)
// Flat select knives (shared fillSelect): 性别 · 证件类型
//   via .select-am-list-extra + .am-modal.mc-select-popup (no search box; small option list)
// Out of scope (same extra class but NOT flat allowlist):
//   国籍/地区 — same mc-select-popup + 搜索 + ~199 options (search-heavy) → select_search_heavy
//   籍贯 / 出生日期 / 英语等级 — cascader/date/picker or unverified
// Empty values and unknown/drifted controls fail closed before any write.
//
// DOM contract (verified live; do not invent a wider selector):
//   item  = .my-list-item
//   label = .header-title  (iconfont.icon-bitian + text)
//   input = .am-input-control input
//   select extra = .select-am-list-extra (placeholder 请选择性别 / value + .active)
//   popup = .am-modal.mc-select-popup · options .am-list.mc-select-list .am-list-item · confirm .am-picker-popup-header-right
//   readiness: .resume-info-title === 基本信息 && my-list-item count > 0
(() => {
  const previous = globalThis.ResumeHotjobMcBasic;
  if (previous?.listener) {
    try { chrome.runtime.onMessage.removeListener(previous.listener); } catch {}
  }

  const SITE_ID = 'hotjob-mc';
  const TEXT_LABELS = ['姓名', '移动电话', '电子邮箱'];
  /** Raw probe 2026-10-18: exact plain input contracts on 基本信息 1/9 only. */
  const NEVER_SAVE_TEXT_SPECS = Object.freeze({
    身高: Object.freeze({ key: 'height', placeholder: '请填写身高(cm)' }),
    体重: Object.freeze({ key: 'weight', placeholder: '请填写体重(kg)' })
  });
  const NEVER_SAVE_TEXT_LABELS = Object.freeze(Object.keys(NEVER_SAVE_TEXT_SPECS));
  const GENDER = '性别';
  const ID_TYPE = '证件类型';
  /** Flat mc-select allowlist only. 性别 + 证件类型 share one fillSelect / fillSelectOnce path. */
  const SELECT_SPECS = {
    [GENDER]: { key: 'gender', alternates: ['男', '女'] },
    [ID_TYPE]: {
      key: 'idType',
      alternates: [
        '居民身份证',
        '中国护照',
        '外国护照',
        '港澳居民来往内地通行证',
        '港澳居民居住证',
        '台湾居民居住证',
        '台湾居民来往大陆通行证'
      ]
    }
  };
  const ALLOWED_SELECT_LABELS = Object.keys(SELECT_SPECS);
  /** Live labels that look like selects but are search-heavy / cascader / date — never allowlist. */
  const SELECT_OUT_OF_SCOPE = Object.freeze(['国籍/地区', '国籍', '籍贯', '出生日期', '英语等级']);
  /** Flat lists stay small; live 国籍/地区 opens ~199 rows + 搜索. */
  const FLAT_SELECT_MAX_OPTIONS = 24;
  /** 待真机 Never-Save，未宣称已支持. */
  const NEVER_SAVE_NOTE = '待真机 Never-Save，未宣称已支持';
  const LIVE_SUPPORT_CLAIMED = false;
  const FORBIDDEN_ACTIONS = Object.freeze(['下一步', '保存', '提交', '投递', '删除']);
  const FORBIDDEN_CLICK_RE = /下一步|保存|提交|投递|删除/u;
  const OUT_OF_SCOPE_KEYS = new Set([
    'nationality', '国籍', '国籍/地区',
    'nativePlace', '籍贯',
    'birthDate', '出生日期',
    'englishLevel', '英语等级'
  ]);
  const FILL_BASIC_KEYS = new Set([
    'profile', 'profileBinding', 'allowExplicitValues',
    'fullName', 'mobile', 'phone', 'email'
  ]);
  const NEVER_SAVE_KEYS = new Set([
    ...FILL_BASIC_KEYS,
    'gender', 'idType', '性别', '证件类型',
    'height', 'weight', '身高', '体重'
  ]);
  let forbiddenClickRefusals = 0;
  const ITEM_SEL = '.my-list-item';
  const LABEL_SEL = '.header-title';
  const INPUT_SEL = '.am-input-control input';
  const EXTRA_SEL = '.select-am-list-extra';
  const POPUP_SEL = '.am-modal.mc-select-popup';
  const OPTION_ROW_SEL = '.am-list.mc-select-list .am-list-item, .mc-select-list .am-list-item';
  const SEARCH_INPUT_SEL = '.mc-search-input input, input[placeholder="搜索"], input[placeholder*="搜索"]';
  const CONFIRM_SEL = '.am-picker-popup-header-right';
  const CANCEL_SEL = '.am-picker-popup-header-left';
  const TITLE_SEL = '.resume-info-title';
  const MC_PATH_RE = /^\/SU[0-9A-Za-z]{8,64}\/mc\/deliver\/operationResumer$/u;

  const norm = (value) => String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/gu, '')
    .replace(/[\s\u00a0]+/gu, ' ')
    .trim();
  const cleanLabel = (value) => norm(value).replace(/^\*\s*/u, '').replace(/\s*\*$/u, '').replace(/[：:]\s*$/u, '').trim();
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function isHotjobMcHost(hostname = location.hostname) {
    const host = String(hostname || '').toLowerCase();
    if (!host) return false;
    return host === 'wecruit.hotjob.cn' || host === 'hotjob.cn' || host.endsWith('.hotjob.cn');
  }

  function onHotjobMcPage(url = location.href) {
    try {
      const u = new URL(url);
      return (u.protocol === 'https:' || u.protocol === 'http:')
        && isHotjobMcHost(u.hostname)
        && MC_PATH_RE.test(u.pathname);
    } catch {
      return false;
    }
  }

  function pageAllowed(options) {
    if (onHotjobMcPage()) return true;
    if (options?.synthetic !== true) return false;
    return location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  }

  function labelText(node) {
    if (!node) return '';
    const clone = node.cloneNode(true);
    clone.querySelectorAll('span.iconfont, span, i, svg, em').forEach((child) => {
      const t = norm(child.textContent);
      if (!t || t === '*' || t === '：' || child.classList?.contains('iconfont')) child.remove();
    });
    return cleanLabel(clone.textContent);
  }

  function formItems() {
    return [...document.querySelectorAll(ITEM_SEL)];
  }

  function matchingItems(wanted) {
    const want = cleanLabel(wanted);
    return formItems().filter((item) => {
      const label = item.querySelector(LABEL_SEL);
      return label && labelText(label) === want;
    });
  }

  /** Unique label only. Zero or many matches fail closed (no guessed item). */
  function findItem(wanted) {
    const hits = matchingItems(wanted);
    return hits.length === 1 ? hits[0] : null;
  }

  function visibleTextLike(node) {
    if (!node || node.disabled) return false;
    const type = String(node.type || '').toLowerCase();
    if (type === 'hidden' || type === 'radio' || type === 'checkbox' || type === 'file' || type === 'button' || type === 'submit') return false;
    const style = getComputedStyle(node);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function contractInputs(item) {
    if (!item) return [];
    return [...item.querySelectorAll(INPUT_SEL)].filter(visibleTextLike);
  }

  function strayTextInputs(item) {
    if (!item) return [];
    const contract = new Set(contractInputs(item));
    return [...item.querySelectorAll('input')].filter((node) => visibleTextLike(node) && !contract.has(node));
  }

  /**
   * Verified contract only: one .my-list-item and one .am-input-control input.
   * Duplicate labels, missing inputs, extra inputs, or a stray input fail closed.
   */
  function classifyText(label) {
    const activeLabel = cleanLabel(label);
    if (NEVER_SAVE_TEXT_SPECS[activeLabel]) return classifyNeverSaveText(activeLabel);
    const hits = matchingItems(label);
    if (hits.length === 0) return { label, ready: false, reason: 'item_not_found', matchCount: 0 };
    if (hits.length !== 1) return { label, ready: false, reason: 'field_ambiguous', matchCount: hits.length };
    const item = hits[0];
    const inputs = contractInputs(item);
    const stray = strayTextInputs(item);
    if (stray.length) {
      return { label, ready: false, reason: 'control_drift', matchCount: 1, controlCount: inputs.length, strayCount: stray.length, item };
    }
    if (inputs.length === 0) return { label, ready: false, reason: 'control_not_found', matchCount: 1, controlCount: 0, item };
    if (inputs.length !== 1) return { label, ready: false, reason: 'control_ambiguous', matchCount: 1, controlCount: inputs.length, item };
    return { label, ready: true, reason: null, matchCount: 1, controlCount: 1, item, control: inputs[0] };
  }

  /** No fallback selector, unit conversion, picker, or guessed label for these fields. */
  function verifiedNeverSaveTextControl(item, label) {
    const spec = NEVER_SAVE_TEXT_SPECS[label];
    if (!item || !spec || item.querySelectorAll(LABEL_SEL).length !== 1) return null;
    const inputs = [...item.querySelectorAll(INPUT_SEL)];
    if (inputs.length !== 1 || item.querySelectorAll('input').length !== 1) return null;
    const control = inputs[0];
    if (!visibleTextLike(control) || control.readOnly || control.type !== 'text' || item.querySelector('textarea, select')) return null;
    for (let node = control; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return null;
    }
    if (control.getAttribute('placeholder') !== spec.placeholder) return null;
    return control;
  }

  function classifyNeverSaveText(label) {
    const hits = matchingItems(label);
    const fail = (partial = {}) => ({
      label, ready: false, reason: 'control_not_supported', matchCount: hits.length, ...partial
    });
    if (hits.length !== 1) return fail();
    const control = verifiedNeverSaveTextControl(hits[0], label);
    if (!control) return fail({ controlCount: hits[0].querySelectorAll(INPUT_SEL).length });
    return {
      label, ready: true, reason: 'structure_matched', matchCount: 1, controlCount: 1,
      item: hits[0], control
    };
  }

  function textControl(item) {
    if (!item) return null;
    const label = labelText(item.querySelector(LABEL_SEL));
    if (NEVER_SAVE_TEXT_SPECS[label]) return verifiedNeverSaveTextControl(item, label);
    if (strayTextInputs(item).length) return null;
    const inputs = contractInputs(item);
    return inputs.length === 1 ? inputs[0] : null;
  }

  function setNativeValue(input, value) {
    const proto = Object.getPrototypeOf(input);
    const desc = Object.getOwnPropertyDescriptor(proto, 'value')
      || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (desc?.set) desc.set.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function readText(item) {
    const control = textControl(item);
    return control ? norm(control.value) : '';
  }

  async function fillText(label, value, options = {}) {
    if (NEVER_SAVE_TEXT_SPECS[cleanLabel(label)]) return fillField(label, value, options);
    const expected = norm(value);
    if (!expected) {
      return {
        label,
        ok: false,
        reason: 'empty_value',
        before: '',
        after: '',
        expected: '',
        writeAttempted: false
      };
    }
    const classified = classifyText(label);
    if (!classified.ready) {
      return {
        label,
        ok: false,
        reason: classified.reason,
        before: '',
        after: '',
        expected,
        writeAttempted: false,
        matchCount: classified.matchCount,
        controlCount: classified.controlCount ?? null
      };
    }
    const item = classified.item;
    const control = classified.control;
    const before = norm(control.value);
    control.focus();
    setNativeValue(control, expected);
    await pause(80);
    const after = readText(item);
    return {
      label,
      ok: after === expected,
      reason: after === expected ? 'matched' : 'readback_mismatch',
      before,
      after,
      expected,
      writeAttempted: true
    };
  }

  async function restoreText(label, previousValue, options = {}) {
    if (NEVER_SAVE_TEXT_SPECS[cleanLabel(label)]) {
      if (!pageAllowed(options) || !basicInfoReady()) return seal({ label, ok: false, reason: 'wrong_page', writeAttempted: false });
      const classified = classifyNeverSaveText(cleanLabel(label));
      if (!classified.ready) return seal({ label, ok: false, reason: 'control_not_supported', writeAttempted: false });
      setNativeValue(classified.control, String(previousValue ?? ''));
      await pause(60);
      const current = classifyNeverSaveText(cleanLabel(label));
      const after = current.ready ? norm(current.control.value) : null;
      const ok = current.ready && after === norm(previousValue);
      return seal({ label, ok, reason: !current.ready ? 'control_not_supported' : ok ? 'restored' : 'restore_mismatch', restoredTo: norm(previousValue), after, writeAttempted: true });
    }
    const item = findItem(label);
    if (!item) return { label, ok: false, reason: 'item_not_found', restoredTo: previousValue };
    const control = textControl(item);
    if (!control) return { label, ok: false, reason: 'control_not_found', restoredTo: previousValue };
    control.focus();
    setNativeValue(control, String(previousValue ?? ''));
    await pause(60);
    const after = readText(item);
    return {
      label,
      ok: after === norm(previousValue),
      reason: after === norm(previousValue) ? 'restored' : 'restore_mismatch',
      restoredTo: norm(previousValue),
      after
    };
  }

  function isPlaceholderSelect(value) {
    return /^请选择/u.test(norm(value));
  }

  function selectExtras(item) {
    if (!item) return [];
    return [...item.querySelectorAll(EXTRA_SEL)].filter((node) => {
      if (!node.classList.contains('select-am-list-extra')) return false;
      const style = getComputedStyle(node);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }

  /** Exactly one verified .select-am-list-extra. Zero or many fail closed. */
  function selectExtra(item) {
    const pool = selectExtras(item);
    return pool.length === 1 ? pool[0] : null;
  }

  function selectExtraReason(item) {
    const pool = selectExtras(item);
    if (pool.length === 0) return 'select_extra_missing';
    if (pool.length !== 1) return 'select_extra_ambiguous';
    return null;
  }

  function classifySelect(label) {
    const activeLabel = cleanLabel(label);
    const spec = SELECT_SPECS[activeLabel];
    if (!spec) {
      if (SELECT_OUT_OF_SCOPE.includes(activeLabel) || /^国籍/u.test(activeLabel)) {
        return { label: activeLabel, ready: false, reason: 'select_out_of_scope_search_or_cascader' };
      }
      return { label: activeLabel, ready: false, reason: 'label_not_allowed' };
    }
    const hits = matchingItems(activeLabel);
    if (hits.length === 0) return { label: activeLabel, ready: false, reason: 'item_not_found', matchCount: 0 };
    if (hits.length !== 1) return { label: activeLabel, ready: false, reason: 'field_ambiguous', matchCount: hits.length };
    const extraReason = selectExtraReason(hits[0]);
    if (extraReason) return { label: activeLabel, ready: false, reason: extraReason, matchCount: 1, item: hits[0] };
    return { label: activeLabel, ready: true, reason: null, matchCount: 1, item: hits[0], extra: selectExtra(hits[0]) };
  }

  function readSelect(item) {
    const reason = selectExtraReason(item);
    if (reason) return { ok: false, reason, value: '' };
    const extra = selectExtra(item);
    const value = norm(extra.textContent);
    return { ok: true, value, placeholder: isPlaceholderSelect(value), active: extra.classList.contains('active') };
  }

  function visiblePopup() {
    return [...document.querySelectorAll(POPUP_SEL)].find((node) => {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      return node.getClientRects().length > 0;
    }) || null;
  }

  function forbiddenActionLabel(node) {
    if (!node || typeof node.closest !== 'function') return '';
    const button = node.closest('button, a, .my-button, input[type="submit"]');
    if (!button) return '';
    const text = norm(button.value || button.textContent || button.getAttribute('aria-label') || '');
    if (!text || text.length > 24) return '';
    if (FORBIDDEN_ACTIONS.includes(text) || FORBIDDEN_CLICK_RE.test(text)) return text;
    return '';
  }

  /** Form actions are never clicked. Returns false when the click is refused. */
  function pointerClick(node) {
    if (!node) return false;
    const forbidden = forbiddenActionLabel(node);
    if (forbidden) {
      forbiddenClickRefusals += 1;
      return false;
    }
    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click']) {
      node.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, button: 0 }));
    }
    return true;
  }

  function optionRows(popup) {
    if (!popup) return [];
    return [...popup.querySelectorAll(OPTION_ROW_SEL)].filter((row) => {
      const text = norm(row.querySelector('.am-list-content')?.textContent || row.dataset?.value || row.textContent);
      if (!text || text === '搜索' || /^请选择/u.test(text)) return false;
      if (row.querySelector('input[placeholder="搜索"], .am-input-control')) return false;
      return row.getClientRects().length > 0;
    });
  }

  function optionText(row) {
    return norm(row.querySelector('.am-list-content')?.textContent || row.dataset?.value || row.textContent);
  }

  /** True when popup has a 搜索 box or too many options (国籍/地区 live pattern). */
  function popupSearchHeavy(popup) {
    if (!popup) return { heavy: false, optionCount: 0, hasSearch: false };
    const hasSearch = !!popup.querySelector(SEARCH_INPUT_SEL);
    const optionCount = optionRows(popup).length;
    const heavy = hasSearch || optionCount > FLAT_SELECT_MAX_OPTIONS;
    return { heavy, optionCount, hasSearch };
  }

  async function closeSelectPopup() {
    const popup = visiblePopup();
    if (!popup) return;
    const cancel = popup.querySelector(CANCEL_SEL);
    if (cancel) pointerClick(cancel);
    await pause(80);
    if (visiblePopup()) {
      const wrap = document.querySelector('.am-modal-wrap-popup');
      if (wrap) pointerClick(wrap);
    }
    const started = Date.now();
    while (visiblePopup() && Date.now() - started < 800) await pause(40);
  }

  async function openSelectPopup(extra) {
    if (visiblePopup()) await closeSelectPopup();
    pointerClick(extra);
    const started = Date.now();
    while (Date.now() - started < 2500) {
      const popup = visiblePopup();
      if (popup) return { ok: true, popup };
      await pause(40);
    }
    return { ok: false, reason: 'select_popup_missing', popup: null };
  }

  async function fillSelectOnce(item, expected) {
    const beforeRead = readSelect(item);
    if (!beforeRead.ok) return { ok: false, reason: beforeRead.reason, clickedOption: false, confirmed: false };
    const extra = selectExtra(item);
    if (!extra) return { ok: false, reason: 'select_extra_missing', clickedOption: false, confirmed: false };
    const opened = await openSelectPopup(extra);
    if (!opened.ok) return { ok: false, reason: opened.reason, clickedOption: false, confirmed: false };
    const heavy = popupSearchHeavy(opened.popup);
    if (heavy.heavy) {
      const sampleOptions = optionRows(opened.popup).map(optionText).filter(Boolean).slice(0, 12);
      await closeSelectPopup();
      return {
        ok: false,
        reason: 'select_search_heavy',
        clickedOption: false,
        confirmed: false,
        sampleOptions,
        optionCount: heavy.optionCount,
        hasSearch: heavy.hasSearch
      };
    }
    const rows = optionRows(opened.popup);
    const sampleOptions = rows.map(optionText).filter(Boolean).slice(0, 12);
    const matches = rows.filter((row) => optionText(row) === norm(expected));
    if (matches.length !== 1) {
      await closeSelectPopup();
      return {
        ok: false,
        reason: matches.length ? 'select_option_not_unique' : 'select_option_missing',
        clickedOption: false,
        confirmed: false,
        sampleOptions
      };
    }
    const optionClicked = pointerClick(matches[0]);
    if (!optionClicked) {
      await closeSelectPopup();
      return { ok: false, reason: 'forbidden_click', clickedOption: false, confirmed: false, sampleOptions };
    }
    await pause(80);
    const confirm = opened.popup.querySelector(CONFIRM_SEL);
    if (!confirm) {
      await closeSelectPopup();
      return { ok: false, reason: 'select_confirm_missing', clickedOption: true, confirmed: false, sampleOptions };
    }
    if (forbiddenActionLabel(confirm)) {
      await closeSelectPopup();
      return { ok: false, reason: 'forbidden_click', clickedOption: true, confirmed: false, sampleOptions };
    }
    pointerClick(confirm);
    const started = Date.now();
    let after = readSelect(item);
    while (Date.now() - started < 2000) {
      after = readSelect(item);
      if (after.ok && after.value === norm(expected) && !visiblePopup()) break;
      await pause(40);
    }
    if (visiblePopup()) await closeSelectPopup();
    after = readSelect(item);
    const matched = after.ok && after.value === norm(expected);
    return {
      ok: matched,
      reason: matched ? 'readback_matched' : 'select_readback_mismatch',
      clickedOption: true,
      confirmed: true,
      after: after.ok ? after.value : null,
      sampleOptions
    };
  }

  function seal(result) {
    return {
      ...result,
      siteId: SITE_ID,
      saved: false,
      skippedSave: true,
      liveSupportClaimed: LIVE_SUPPORT_CLAIMED,
      neverSave: true,
      supportClaimed: false,
      neverClickedNext: true,
      softwareClickedNext: false,
      softwareClickedSave: false,
      softwareClickedSubmit: false,
      softwareClickedDeliver: false,
      softwareClickedDelete: false,
      forbiddenClickRefusals,
      note: NEVER_SAVE_NOTE
    };
  }

  function selectEnvelope(partial) {
    return seal({
      ok: false,
      label: '',
      reason: 'select_failed',
      before: null,
      after: null,
      expected: null,
      final: null,
      restored: false,
      clickedOption: false,
      confirmed: false,
      liveEdge: false,
      surface: null,
      sampleOptions: [],
      ...partial
    });
  }

  function requestBlock(rawValues, allowedKeys) {
    if (!rawValues || typeof rawValues !== 'object' || Array.isArray(rawValues)) {
      return { reason: 'profile_missing' };
    }
    const keys = Object.keys(rawValues);
    const scoped = keys.filter((key) => OUT_OF_SCOPE_KEYS.has(key) || SELECT_OUT_OF_SCOPE.includes(cleanLabel(key)));
    if (scoped.length) return { reason: 'select_out_of_scope_search_or_cascader', denied: scoped };
    const unknown = keys.filter((key) => !allowedKeys.has(key));
    if (unknown.length) return { reason: 'field_not_allowed', denied: unknown };
    return null;
  }

  function readNeighbor() {
    const neighborItem = findItem('证件号码');
    return neighborItem
      ? { label: '证件号码', value: readText(neighborItem) }
      : { label: '证件号码', value: null, missing: true };
  }

  async function fillSelect(label, expected, options = {}) {
    const liveEdge = onHotjobMcPage();
    const surface = liveEdge ? 'wecruit.hotjob.cn-mc' : (options.synthetic === true ? 'synthetic-fixture' : null);
    const activeLabel = cleanLabel(label);
    const spec = SELECT_SPECS[activeLabel];
    const fail = (partial) => selectEnvelope({
      label: activeLabel || String(label ?? ''),
      liveEdge,
      surface,
      expected: expected == null ? null : norm(expected),
      ...partial
    });
    if (!spec) {
      if (SELECT_OUT_OF_SCOPE.includes(activeLabel) || /^国籍/u.test(activeLabel)) {
        return fail({ reason: 'select_out_of_scope_search_or_cascader' });
      }
      return fail({ reason: 'label_not_allowed' });
    }
    if (!pageAllowed(options)) return fail({ reason: 'wrong_page', href: location.href });

    let target = expected == null ? '' : norm(expected);
    if (target && !(spec.alternates || []).includes(target)) {
      return fail({ reason: 'select_option_not_allowed', expected: target });
    }

    const classified = classifySelect(activeLabel);
    if (!classified.ready) return fail({ reason: classified.reason });
    const item = classified.item;
    const beforeRead = readSelect(item);
    if (!beforeRead.ok) return fail({ reason: beforeRead.reason });
    const before = beforeRead.value;

    if (!target && options.pickAlternate === true) {
      const opened = await openSelectPopup(selectExtra(item));
      if (!opened.ok) return fail({ before, reason: opened.reason });
      const heavy = popupSearchHeavy(opened.popup);
      const texts = optionRows(opened.popup).map(optionText);
      await closeSelectPopup();
      if (heavy.heavy) {
        return fail({
          before,
          reason: 'select_search_heavy',
          sampleOptions: texts.slice(0, 12),
          optionCount: heavy.optionCount,
          hasSearch: heavy.hasSearch
        });
      }
      target = (spec.alternates || []).find((option) => option !== before && texts.includes(option)) || '';
      if (!target) {
        return fail({
          before,
          reason: 'select_option_missing',
          sampleOptions: texts.slice(0, 12)
        });
      }
    }
    if (!target || target.length > 32) return fail({ before, reason: 'expected_required' });

    if (target === before && options.force !== true) {
      return selectEnvelope({
        label: activeLabel,
        ok: true,
        reason: 'preexisting_same_value',
        before,
        after: before,
        expected: target,
        final: before,
        restored: false,
        liveEdge,
        surface,
        clickedOption: false
      });
    }

    const written = await fillSelectOnce(item, target);
    let final = written.after ?? null;
    let restored = false;
    let reason = written.reason;
    let ok = written.ok;

    if (written.ok && options.restore === true) {
      if (isPlaceholderSelect(before)) {
        // Empty placeholder cannot be re-selected in mc popup; leave filled value.
        ok = false;
        reason = 'select_restore_empty_unsupported';
        restored = false;
        final = written.after ?? null;
      } else if (written.after !== before) {
        const againItem = findItem(activeLabel);
        const back = againItem ? await fillSelectOnce(againItem, before) : { ok: false, after: null, reason: 'select_restore_target_missing' };
        final = back.after ?? null;
        restored = back.ok && final === before;
        if (!restored) {
          ok = false;
          reason = 'select_restore_mismatch';
        } else {
          reason = 'readback_matched';
          ok = true;
        }
      } else {
        restored = true;
        final = before;
      }
    }

    // Neighbor text must stay untouched.
    const neighborItem = findItem('证件号码');
    const neighbor = neighborItem
      ? { label: '证件号码', value: readText(neighborItem) }
      : { label: '证件号码', value: null, missing: true };

    return selectEnvelope({
      label: activeLabel,
      ok,
      reason,
      before,
      after: written.after ?? null,
      expected: target,
      final,
      restored,
      clickedOption: written.clickedOption === true,
      confirmed: written.confirmed === true,
      liveEdge,
      surface,
      sampleOptions: written.sampleOptions || [],
      neighbor,
      commitClicks: typeof globalThis.__hotjobMcCommitClicks === 'number' ? globalThis.__hotjobMcCommitClicks : null
    });
  }

  function planFromProfile(profile) {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
      return { ok: false, reason: 'profile_missing', values: null, fields: [], blockers: [{ reason: 'profile_missing' }] };
    }
    if (!Array.isArray(profile.confirmedFields)) {
      return {
        ok: false,
        reason: 'profile_missing',
        values: null,
        fields: [],
        blockers: [{ reason: 'confirmed_fields_missing' }]
      };
    }
    const confirmed = new Set(profile.confirmedFields.filter((path) => typeof path === 'string'));
    const fullName = norm(profile.fullName || '');
    const mobile = norm(profile.phone || '');
    const email = norm(profile.email || '');
    const core = [
      { label: '姓名', path: 'fullName', value: fullName },
      { label: '移动电话', path: 'phone', value: mobile },
      { label: '电子邮箱', path: 'email', value: email }
    ].map((row) => {
      let reason = null;
      if (!row.value) reason = 'missing_profile_value';
      else if (!confirmed.has(row.path)) reason = 'profile_fact_unconfirmed';
      return { ...row, ready: reason === null, reason };
    });
    const blockers = core.filter((row) => !row.ready);
    if (blockers.length) {
      return { ok: false, reason: 'profile_fields_unavailable', values: null, fields: core, blockers };
    }
    return {
      ok: true,
      reason: 'profile_ready',
      values: { fullName, mobile, email },
      fields: core,
      blockers: []
    };
  }

  function probeFingerprint() {
    const titleNode = document.querySelector(TITLE_SEL);
    const resumeTitle = cleanLabel(titleNode?.textContent || '');
    const bodyHead = (document.body?.innerText || '').slice(0, 800);
    return {
      amList: !!document.querySelector('.am-list'),
      myListItem: document.querySelectorAll(ITEM_SEL).length,
      amInputControl: document.querySelectorAll('.am-input-control input').length,
      resumeTitle,
      resumeTitleOk: resumeTitle === '基本信息',
      loginHints: /登录|注册/.test(bodyHead),
      loading: /正在加载中/.test(bodyHead),
      hasNextButton: [...document.querySelectorAll('.my-button, button')].some((b) => /下一步/.test(b.textContent || '')),
      antFormItem: !!document.querySelector('.ant-form-item'),
      formCell: !!document.querySelector('.form-cell'),
      foundLabels: TEXT_LABELS.filter((label) => !!findItem(label))
    };
  }

  async function probeLabels(options = {}) {
    const fp = probeFingerprint();
    const labels = TEXT_LABELS.map((label) => {
      const item = findItem(label);
      return {
        label,
        found: !!item,
        hasTextControl: !!item && !!textControl(item),
        value: item ? readText(item) : '',
        placeholder: (() => {
          const c = item ? textControl(item) : null;
          return c?.placeholder || '';
        })()
      };
    });
    const foundCount = labels.filter((row) => row.found && row.hasTextControl).length;
    const onPage = pageAllowed(options);
    const ready = onPage
      && !fp.loginHints
      && !fp.loading
      && (options?.synthetic === true || fp.resumeTitleOk || foundCount >= 1)
      && foundCount >= 3;
    return seal({
      ok: ready,
      href: location.href,
      title: document.title,
      onHotjobMcPage: onHotjobMcPage(),
      synthetic: options?.synthetic === true,
      fingerprint: fp,
      labels,
      foundCount,
      reason: !onPage
        ? 'wrong_page'
        : fp.loginHints
          ? 'login_wall'
          : fp.loading
            ? 'still_loading'
            : foundCount >= 3
              ? 'labels_ready'
              : foundCount >= 1
                ? 'labels_partial'
                : 'labels_missing'
    });
  }

  async function fillBasic(rawValues = {}, options = {}) {
    if (!pageAllowed(options)) {
      return seal({
        ok: false,
        reason: 'wrong_page',
        href: location.href,
        results: [],
        writeAttempted: false
      });
    }
    const blocked = requestBlock(rawValues, FILL_BASIC_KEYS);
    if (blocked) {
      return seal({
        ok: false,
        reason: blocked.reason,
        denied: blocked.denied || null,
        href: location.href,
        results: [],
        writeAttempted: false
      });
    }

    const profile = rawValues.profile;
    const allowExplicit = rawValues.allowExplicitValues === true;
    const doRestore = options?.restore !== false;
    let values = null;
    let plan = null;

    if (allowExplicit && (rawValues.fullName || rawValues.mobile || rawValues.email)) {
      values = {
        fullName: norm(rawValues.fullName || ''),
        mobile: norm(rawValues.mobile || rawValues.phone || ''),
        email: norm(rawValues.email || '')
      };
      if (!values.fullName || !values.mobile || !values.email) {
        return seal({
          ok: false,
          reason: 'explicit_values_incomplete',
          href: location.href,
          results: [],
          writeAttempted: false
        });
      }
    } else {
      plan = planFromProfile(profile);
      if (!plan.ok) {
        return seal({
          ok: false,
          reason: plan.reason,
          href: location.href,
          title: document.title,
          results: (plan.fields || []).map((row) => ({
            label: row.label,
            ok: false,
            reason: row.reason || plan.reason,
            before: '',
            after: '',
            expected: row.value || '',
            path: row.path
          })),
          blockers: plan.blockers,
          writeAttempted: false
        });
      }
      values = plan.values;
    }

    const textPlan = [
      ['姓名', values.fullName],
      ['移动电话', values.mobile],
      ['电子邮箱', values.email]
    ];
    const classified = textPlan.map(([label, value]) => ({ ...classifyText(label), expected: norm(value) }));
    if (classified.some((row) => !row.ready)) {
      return seal({
        ok: false,
        reason: 'control_drift',
        href: location.href,
        title: document.title,
        writeAttempted: false,
        profileSource: allowExplicit ? 'explicit' : 'resumeProfile',
        results: classified.map((row) => ({
          label: row.label,
          ok: false,
          reason: row.ready ? 'skipped_control_drift' : row.reason,
          matchCount: row.matchCount ?? null,
          controlCount: row.controlCount ?? null,
          before: '',
          after: '',
          expected: row.expected
        }))
      });
    }
    const snapshots = classified.map((row) => ({ label: row.label, before: readText(row.item) }));
    const results = [];
    for (const [label, value] of textPlan) {
      results.push(await fillText(label, value));
    }
    const fillOk = results.every((row) => row.ok);

    let restore = null;
    if (doRestore) {
      restore = [];
      for (const snap of snapshots) {
        restore.push(await restoreText(snap.label, snap.before));
      }
    }

    // Neighbor text field must stay untouched (证件号码 on live / fixture).
    const neighbor = readNeighbor();

    return seal({
      ok: fillOk,
      href: location.href,
      title: document.title,
      writeAttempted: true,
      restored: doRestore === true,
      restore,
      neighbor,
      profileSource: allowExplicit ? 'explicit' : 'resumeProfile',
      planSummary: plan
        ? { reason: plan.reason, readyCount: plan.fields.filter((f) => f.ready).length, blockerCount: plan.blockers.length }
        : { reason: 'explicit_override' },
      results
    });
  }

  /** 基本信息 is the first mc step; an explicit different progress fails closed. */
  function basicInfoReady() {
    const fp = probeFingerprint();
    if (!fp.resumeTitleOk || fp.loading || fp.loginHints) return false;
    const bodyText = document.body?.innerText || document.body?.textContent || '';
    const progress = bodyText.match(/填写进度\s*[：:]\s*(\d+)\s*\/\s*(\d+)/u);
    return !progress || (progress[1] === '1' && progress[2] === '9');
  }

  /**
   * Independent Never-Save text paint. Existing nonempty values are preserved.
   * Only exact 身高/体重 labels and raw probe placeholders are supported.
   */
  async function fillField(label, value, options = {}) {
    const activeLabel = cleanLabel(label);
    const expected = norm(value);
    const finish = (partial) => seal({
      label: activeLabel, ok: false, reason: 'control_not_supported',
      before: '', after: '', final: '', expected,
      writeAttempted: false, painted: false, skipped: false, restored: false,
      ...partial
    });
    if (!pageAllowed(options) || !basicInfoReady()) return finish({ reason: 'wrong_page' });
    if (!NEVER_SAVE_TEXT_SPECS[activeLabel]) return finish({ reason: 'label_not_allowed' });
    const classified = classifyNeverSaveText(activeLabel);
    if (!classified.ready) return finish({
      reason: 'control_not_supported',
      matchCount: classified.matchCount,
      controlCount: classified.controlCount ?? null
    });
    const before = norm(classified.control.value);
    if (!expected) return finish({
      reason: 'missing_profile_value', before, after: before, final: before, skipped: true
    });
    if (before) return finish({
      ok: true, reason: before === expected ? 'preexisting_same_value' : 'existing_value',
      before, after: before, final: before, skipped: true
    });

    classified.control.focus();
    setNativeValue(classified.control, expected);
    await pause(80);
    const current = classifyNeverSaveText(activeLabel);
    const after = current.ready ? norm(current.control.value) : null;
    if (!current.ready) return finish({
      reason: 'control_not_supported', before, after, final: after,
      writeAttempted: true, painted: true
    });
    if (after !== expected) return finish({
      reason: 'readback_mismatch', before, after, final: after,
      writeAttempted: true, painted: true
    });
    if (options.restore === true) {
      const restore = await restoreText(activeLabel, before, options);
      return finish({
        ok: restore.ok, reason: restore.ok ? 'readback_matched' : restore.reason,
        before, after, final: restore.after, writeAttempted: true, painted: true,
        restored: restore.ok, restore
      });
    }
    return finish({
      ok: true, reason: 'readback_matched', before, after, final: after,
      writeAttempted: true, painted: true
    });
  }

  /** Read-only structure inspection; no input, focus, pointer, or picker actions. */
  function inspect(options = {}) {
    if (!pageAllowed(options) || !basicInfoReady()) return seal({
      ok: false, reason: 'wrong_page', fields: [], results: [], writeAttempted: false
    });
    const fields = [...TEXT_LABELS, ...NEVER_SAVE_TEXT_LABELS].map((label) => {
      const row = classifyText(label);
      return seal({
        label, ready: row.ready, found: row.matchCount === 1, hasTextControl: row.ready,
        reason: row.ready ? 'structure_matched' : row.reason,
        matchCount: row.matchCount, controlCount: row.controlCount ?? null,
        value: row.ready ? norm(row.control.value) : '',
        placeholder: row.ready ? row.control.getAttribute('placeholder') || '' : '',
        writeAttempted: false
      });
    });
    for (const label of ALLOWED_SELECT_LABELS) {
      const row = classifySelect(label);
      fields.push(seal({
        label, ready: row.ready, found: row.matchCount === 1,
        reason: row.ready ? 'structure_matched' : row.reason,
        value: row.ready ? readSelect(row.item).value : '', writeAttempted: false
      }));
    }
    const ok = fields.every((row) => row.ready);
    return seal({
      ok, reason: ok ? 'structure_matched' : 'control_not_supported',
      fields, results: fields, writeAttempted: false
    });
  }

  function commitClicks() {
    return typeof globalThis.__hotjobMcCommitClicks === 'number' ? globalThis.__hotjobMcCommitClicks : null;
  }

  /**
   * Offline Never-Save fill: allowed text + optional 性别/证件类型.
   * 待真机 Never-Save，未宣称已支持. Does not click 下一步/保存/提交/投递/删除.
   * Empty values, unknown keys, 国籍/地区, and drifted controls fail closed before write.
   */
  async function fillNeverSave(rawValues = {}, options = {}) {
    const commitsBefore = commitClicks();
    const finish = (partial) => {
      const commitsAfter = commitClicks();
      const commitDelta = commitsBefore == null || commitsAfter == null ? 0 : commitsAfter - commitsBefore;
      const stamped = seal({
        href: location.href,
        title: document.title,
        results: [],
        writeAttempted: false,
        commitClicksBefore: commitsBefore,
        commitClicksAfter: commitsAfter,
        ...partial
      });
      if (commitDelta !== 0) {
        return {
          ...stamped,
          ok: false,
          reason: 'forbidden_click',
          saved: false,
          skippedSave: true,
          liveSupportClaimed: false
        };
      }
      return stamped;
    };

    if (!pageAllowed(options)) return finish({ ok: false, reason: 'wrong_page' });
    const blocked = requestBlock(rawValues, NEVER_SAVE_KEYS);
    if (blocked) return finish({ ok: false, reason: blocked.reason, denied: blocked.denied || null });

    const allowExplicit = rawValues.allowExplicitValues === true;
    let textValues = null;
    let plan = null;
    if (allowExplicit) {
      textValues = {
        fullName: norm(rawValues.fullName || ''),
        mobile: norm(rawValues.mobile || rawValues.phone || ''),
        email: norm(rawValues.email || '')
      };
      if (!textValues.fullName || !textValues.mobile || !textValues.email) {
        return finish({ ok: false, reason: 'empty_value' });
      }
    } else {
      plan = planFromProfile(rawValues.profile);
      if (!plan.ok) {
        return finish({
          ok: false,
          reason: plan.reason,
          blockers: plan.blockers,
          results: (plan.fields || []).map((row) => ({
            label: row.label,
            ok: false,
            reason: row.reason || plan.reason,
            before: '',
            after: '',
            expected: row.value || '',
            path: row.path
          }))
        });
      }
      textValues = plan.values;
    }

    const extraTextPlan = [];
    for (const [label, spec] of Object.entries(NEVER_SAVE_TEXT_SPECS)) {
      const present = [spec.key, label].filter((key) => Object.prototype.hasOwnProperty.call(rawValues, key));
      const fromProfile = !present.length && rawValues.profile
        && Object.prototype.hasOwnProperty.call(rawValues.profile, spec.key);
      if (!present.length && !fromProfile) continue;
      const values = fromProfile ? [norm(rawValues.profile[spec.key])] : present.map((key) => norm(rawValues[key]));
      const value = values[0];
      const reason = new Set(values).size !== 1 ? 'field_ambiguous'
        : !value ? 'missing_profile_value'
          : fromProfile && (!Array.isArray(rawValues.profile.confirmedFields) || !rawValues.profile.confirmedFields.includes(spec.key)) ? 'profile_fact_unconfirmed'
            : null;
      if (reason) return finish({
        ok: false, reason, label,
        results: [seal({ label, path: spec.key, ok: false, reason, expected: value, writeAttempted: false })]
      });
      extraTextPlan.push({ label, value });
    }
    if (extraTextPlan.length && !basicInfoReady()) return finish({ ok: false, reason: 'wrong_page' });

    const selectPlan = [];
    const selectRequests = [
      { keys: ['gender', '性别'], label: GENDER },
      { keys: ['idType', '证件类型'], label: ID_TYPE }
    ];
    for (const spec of selectRequests) {
      const present = spec.keys.filter((key) => Object.prototype.hasOwnProperty.call(rawValues, key));
      if (!present.length) continue;
      const presentValues = present.map((key) => norm(rawValues[key]));
      if (new Set(presentValues).size !== 1) {
        return finish({ ok: false, reason: 'field_ambiguous', label: spec.label });
      }
      const value = presentValues[0];
      if (!value) return finish({ ok: false, reason: 'empty_value', label: spec.label });
      if (!SELECT_SPECS[spec.label].alternates.includes(value)) {
        return finish({ ok: false, reason: 'select_option_not_allowed', label: spec.label, expected: value });
      }
      selectPlan.push({ label: spec.label, value });
    }

    const textRows = [
      ['姓名', textValues.fullName],
      ['移动电话', textValues.mobile],
      ['电子邮箱', textValues.email],
      ...extraTextPlan.map((row) => [row.label, row.value])
    ].map(([label, value]) => ({ ...classifyText(label), expected: norm(value) }));
    if (textRows.some((row) => !row.ready)) {
      return finish({
        ok: false,
        reason: textRows.some((row) => !row.ready && NEVER_SAVE_TEXT_SPECS[row.label]) ? 'control_not_supported' : 'control_drift',
        results: textRows.map((row) => seal({
          label: row.label,
          ok: false,
          reason: row.reason,
          before: '',
          after: '',
          expected: row.expected,
          writeAttempted: false
        }))
      });
    }
    const selectRows = selectPlan.map((row) => ({ ...classifySelect(row.label), expected: row.value }));
    if (selectRows.some((row) => !row.ready)) {
      return finish({
        ok: false,
        reason: 'control_drift',
        results: selectRows.map((row) => ({
          label: row.label,
          ok: false,
          reason: row.reason,
          before: '',
          after: '',
          expected: row.expected
        }))
      });
    }

    const neighborBefore = readNeighbor();
    const textSnapshots = textRows
      .filter((row) => !NEVER_SAVE_TEXT_SPECS[row.label] || !norm(row.control.value))
      .map((row) => ({ label: row.label, before: readText(row.item) }));
    const selectSnapshots = selectRows.map((row) => ({ label: row.label, before: readSelect(row.item).value }));
    const selectOptions = { ...options, restore: false };
    const results = [];
    for (const row of textRows) {
      results.push(await fillText(row.label, row.expected, { ...options, restore: false }));
    }
    for (const row of selectPlan) {
      results.push(await fillSelect(row.label, row.value, selectOptions));
    }

    const paintedTextSnapshots = textSnapshots.filter((snap) => !NEVER_SAVE_TEXT_SPECS[snap.label]
      || results.find((row) => row.label === snap.label)?.writeAttempted === true);
    const rollback = async () => {
      const restore = [];
      for (const snap of paintedTextSnapshots) {
        if (NEVER_SAVE_TEXT_SPECS[snap.label]) {
          const current = classifyNeverSaveText(snap.label);
          const written = results.find((row) => row.label === snap.label);
          if (!current.ready) {
            restore.push(seal({ label: snap.label, ok: false, reason: 'control_not_supported', writeAttempted: false }));
            continue;
          }
          const value = norm(current.control.value);
          if (value === norm(snap.before)) {
            restore.push(seal({ label: snap.label, ok: true, reason: 'restored', after: value, writeAttempted: false }));
            continue;
          }
          if (value !== written.after) {
            restore.push(seal({ label: snap.label, ok: false, reason: 'existing_value', after: value, writeAttempted: false }));
            continue;
          }
        }
        restore.push(await restoreText(snap.label, snap.before, options));
      }
      for (const snap of [...selectSnapshots].reverse()) {
        const current = readSelect(findItem(snap.label));
        if (current.ok && current.value !== snap.before && snap.before && !isPlaceholderSelect(snap.before)) {
          restore.push(await fillSelect(snap.label, snap.before, { ...selectOptions, force: true }));
        }
      }
      return restore;
    };

    if (!results.every((row) => row.ok)) {
      const restore = await rollback();
      return finish({
        ok: false,
        reason: results.some((row) => NEVER_SAVE_TEXT_SPECS[row.label] && row.reason === 'control_not_supported')
          ? 'control_not_supported' : 'readback_mismatch',
        writeAttempted: true,
        restored: false,
        restore,
        results,
        neighbor: readNeighbor(),
        neighborBefore
      });
    }

    if (options.restore === true) {
      const restore = await rollback();
      const textBack = paintedTextSnapshots.every((snap) => readText(findItem(snap.label)) === norm(snap.before));
      const selectBack = selectSnapshots.every((snap) => {
        const current = readSelect(findItem(snap.label));
        return current.ok && current.value === snap.before;
      });
      const neighbor = readNeighbor();
      const ok = textBack && selectBack && neighbor.value === neighborBefore.value;
      return finish({
        ok,
        reason: ok ? 'readback_matched' : 'restore_mismatch',
        writeAttempted: true,
        restored: ok,
        restore,
        results,
        neighbor,
        neighborBefore
      });
    }

    const readback = {
      姓名: readText(findItem('姓名')),
      移动电话: readText(findItem('移动电话')),
      电子邮箱: readText(findItem('电子邮箱'))
    };
    for (const row of extraTextPlan) readback[row.label] = readText(findItem(row.label));
    for (const row of selectPlan) readback[row.label] = readSelect(findItem(row.label)).value;
    const neighbor = readNeighbor();
    const textMatch = readback['姓名'] === textValues.fullName
      && readback['移动电话'] === textValues.mobile
      && readback['电子邮箱'] === textValues.email
      && extraTextPlan.every((row) => {
        const result = results.find((entry) => entry.label === row.label);
        return readback[row.label] === (result?.reason === 'existing_value' ? result.before : row.value);
      });
    const selectMatch = selectPlan.every((row) => readback[row.label] === row.value);
    const neighborOk = neighbor.value === neighborBefore.value;
    const ok = textMatch && selectMatch && neighborOk;
    return finish({
      ok,
      reason: ok ? 'readback_matched' : 'readback_mismatch',
      writeAttempted: true,
      restored: false,
      results,
      readback,
      neighbor,
      neighborBefore,
      profileSource: allowExplicit ? 'explicit' : 'resumeProfile',
      planSummary: plan
        ? { reason: plan.reason, readyCount: plan.fields.filter((field) => field.ready).length, blockerCount: plan.blockers.length }
        : { reason: 'explicit_override' }
    });
  }

  const api = {
    siteId: SITE_ID,
    TEXT_LABELS,
    NEVER_SAVE_TEXT_SPECS,
    NEVER_SAVE_TEXT_LABELS,
    SELECT_SPECS,
    ALLOWED_SELECT_LABELS,
    SELECT_OUT_OF_SCOPE,
    FLAT_SELECT_MAX_OPTIONS,
    GENDER,
    ID_TYPE,
    NEVER_SAVE_NOTE,
    LIVE_SUPPORT_CLAIMED,
    FORBIDDEN_ACTIONS,
    popupSearchHeavy,
    ITEM_SEL,
    LABEL_SEL,
    INPUT_SEL,
    EXTRA_SEL,
    isHotjobMcHost,
    onHotjobMcPage,
    findItem,
    textControl,
    classifyText,
    classifySelect,
    selectExtra,
    readSelect,
    pointerClick,
    fillText,
    fillField,
    inspect,
    restoreText,
    fillSelect,
    fillBasic,
    fillNeverSave,
    probeLabels,
    probeFingerprint,
    planFromProfile,
    listener: null
  };

  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    api.listener = (message, _sender, sendResponse) => {
      if (!message || (message.siteId && message.siteId !== SITE_ID)) return false;
      if (message.type === 'HOTJOB_MC_BASIC_PROBE') {
        probeLabels(message.options || {}).then(sendResponse);
        return true;
      }
      if (message.type === 'HOTJOB_MC_BASIC_FILL') {
        fillBasic(message.values || { profile: message.profile }, message.options || {}).then(sendResponse);
        return true;
      }
      if (message.type === 'HOTJOB_MC_SELECT_FILL') {
        fillSelect(message.label || GENDER, message.expected, message.options || {}).then(sendResponse);
        return true;
      }
      if (message.type === 'HOTJOB_MC_NEVER_SAVE_FILL') {
        fillNeverSave(message.values || { profile: message.profile }, message.options || {}).then(sendResponse);
        return true;
      }
      return false;
    };
    chrome.runtime.onMessage.addListener(api.listener);
  }

  globalThis.ResumeHotjobMcBasic = api;
})();
