// Hotjob mc (antd-mobile H5) first-slice basic fill + mc-select (fill-without-save).
// Isolated siteId: hotjob-mc. Never clicks 下一步/保存/提交. Never touches pb CMS_BASIC.
//
// First slice fields (live CDP 中联 SU661f… /mc/deliver/operationResumer 2026-10-18):
//   姓名 (text) · 移动电话 (text) · 电子邮箱 (text)
// Flat select knives (shared fillSelect): 性别 · 证件类型
//   via .select-am-list-extra + .am-modal.mc-select-popup (no search box; small option list)
// Out of scope (same extra class but NOT flat allowlist):
//   国籍/地区 — same mc-select-popup + 搜索 + ~199 options (search-heavy) → select_search_heavy
//   籍贯 / 出生日期 / 英语等级 — cascader/date/picker or unverified
//
// DOM contract (verified live):
//   item  = .my-list-item
//   label = .header-title  (iconfont.icon-bitian + text)
//   input = .am-input-control input
//   select extra = .am-list-extra.select-am-list-extra (placeholder 请选择性别 / value + .active)
//   popup = .am-modal.mc-select-popup · options .am-list.mc-select-list .am-list-item · confirm .am-picker-popup-header-right
//   readiness: .resume-info-title === 基本信息 && my-list-item count > 0
(() => {
  const previous = globalThis.ResumeHotjobMcBasic;
  if (previous?.listener) {
    try { chrome.runtime.onMessage.removeListener(previous.listener); } catch {}
  }

  const SITE_ID = 'hotjob-mc';
  const TEXT_LABELS = ['姓名', '移动电话', '电子邮箱'];
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
  const ITEM_SEL = '.my-list-item';
  const LABEL_SEL = '.header-title';
  const INPUT_SEL = '.am-input-control input, input[type="text"], input[type="tel"], input[type="email"], input:not([type])';
  const EXTRA_SEL = '.select-am-list-extra, .am-list-extra';
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

  function findItem(wanted) {
    const want = cleanLabel(wanted);
    const hits = formItems().filter((item) => {
      const label = item.querySelector(LABEL_SEL);
      return label && labelText(label) === want;
    });
    return hits.length === 1 ? hits[0] : null;
  }

  function textControl(item) {
    const inputs = [...item.querySelectorAll(INPUT_SEL)].filter((node) => {
      if (node.type === 'hidden' || node.type === 'radio' || node.type === 'checkbox' || node.type === 'file') return false;
      if (node.disabled) return false;
      const style = getComputedStyle(node);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
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

  async function fillText(label, value) {
    const item = findItem(label);
    if (!item) return { label, ok: false, reason: 'item_not_found', before: '', after: '', expected: value };
    const control = textControl(item);
    if (!control) return { label, ok: false, reason: 'control_not_found', before: '', after: '', expected: value };
    const before = norm(control.value);
    control.focus();
    setNativeValue(control, String(value ?? ''));
    await pause(80);
    const after = readText(item);
    return {
      label,
      ok: after === norm(value),
      reason: after === norm(value) ? 'matched' : 'readback_mismatch',
      before,
      after,
      expected: norm(value)
    };
  }

  async function restoreText(label, previousValue) {
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

  function selectExtra(item) {
    if (!item) return null;
    const nodes = [...item.querySelectorAll(EXTRA_SEL)].filter((node) => {
      const style = getComputedStyle(node);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
    // Prefer the select-am-list-extra class when both match.
    const preferred = nodes.filter((n) => n.classList.contains('select-am-list-extra'));
    const pool = preferred.length ? preferred : nodes;
    return pool.length === 1 ? pool[0] : (pool[0] || null);
  }

  function readSelect(item) {
    const extra = selectExtra(item);
    if (!extra) return { ok: false, reason: 'select_extra_missing', value: '' };
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

  function pointerClick(node) {
    if (!node) return;
    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click']) {
      node.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, button: 0 }));
    }
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
    pointerClick(matches[0]);
    await pause(80);
    const confirm = opened.popup.querySelector(CONFIRM_SEL);
    if (!confirm) {
      await closeSelectPopup();
      return { ok: false, reason: 'select_confirm_missing', clickedOption: true, confirmed: false, sampleOptions };
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

  function selectEnvelope(partial) {
    return {
      ok: false,
      siteId: SITE_ID,
      label: '',
      reason: 'select_failed',
      before: null,
      after: null,
      expected: null,
      final: null,
      restored: false,
      saved: false,
      skippedSave: true,
      clickedOption: false,
      confirmed: false,
      liveEdge: false,
      surface: null,
      sampleOptions: [],
      neverClickedNext: true,
      ...partial
    };
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

    const item = findItem(activeLabel);
    if (!item) return fail({ reason: 'item_not_found' });
    const beforeRead = readSelect(item);
    if (!beforeRead.ok) return fail({ reason: beforeRead.reason });
    const before = beforeRead.value;

    let target = expected == null ? '' : norm(expected);
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
    return {
      ok: ready,
      siteId: SITE_ID,
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
                : 'labels_missing',
      saved: false,
      skippedSave: true
    };
  }

  async function fillBasic(rawValues = {}, options = {}) {
    if (!pageAllowed(options)) {
      return {
        ok: false,
        siteId: SITE_ID,
        reason: 'wrong_page',
        href: location.href,
        results: [],
        saved: false,
        skippedSave: true
      };
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
        return {
          ok: false,
          siteId: SITE_ID,
          reason: 'explicit_values_incomplete',
          href: location.href,
          results: [],
          saved: false,
          skippedSave: true
        };
      }
    } else {
      plan = planFromProfile(profile);
      if (!plan.ok) {
        return {
          ok: false,
          siteId: SITE_ID,
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
          saved: false,
          skippedSave: true,
          writeAttempted: false
        };
      }
      values = plan.values;
    }

    const textPlan = [
      ['姓名', values.fullName],
      ['移动电话', values.mobile],
      ['电子邮箱', values.email]
    ];
    const snapshots = textPlan.map(([label]) => {
      const item = findItem(label);
      return { label, before: item ? readText(item) : '' };
    });
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
    const neighborItem = findItem('证件号码');
    const neighbor = neighborItem
      ? { label: '证件号码', value: readText(neighborItem) }
      : { label: '证件号码', value: null, missing: true };

    return {
      ok: fillOk,
      siteId: SITE_ID,
      href: location.href,
      title: document.title,
      saved: false,
      skippedSave: true,
      writeAttempted: true,
      restored: doRestore === true,
      restore,
      neighbor,
      profileSource: allowExplicit ? 'explicit' : 'resumeProfile',
      planSummary: plan
        ? { reason: plan.reason, readyCount: plan.fields.filter((f) => f.ready).length, blockerCount: plan.blockers.length }
        : { reason: 'explicit_override' },
      results
    };
  }

  const api = {
    siteId: SITE_ID,
    TEXT_LABELS,
    SELECT_SPECS,
    ALLOWED_SELECT_LABELS,
    SELECT_OUT_OF_SCOPE,
    FLAT_SELECT_MAX_OPTIONS,
    GENDER,
    ID_TYPE,
    popupSearchHeavy,
    ITEM_SEL,
    LABEL_SEL,
    isHotjobMcHost,
    onHotjobMcPage,
    findItem,
    textControl,
    selectExtra,
    readSelect,
    fillText,
    restoreText,
    fillSelect,
    fillBasic,
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
      return false;
    };
    chrome.runtime.onMessage.addListener(api.listener);
  }

  globalThis.ResumeHotjobMcBasic = api;
})();
