// Hotjob mc (antd-mobile H5) first-slice basic fill (fill-without-save).
// Isolated siteId: hotjob-mc. Never clicks 下一步/保存/提交. Never touches pb CMS_BASIC.
//
// First slice fields (live CDP 中联 SU661f… /mc/deliver/operationResumer 2026-10-18):
//   姓名 (text) · 移动电话 (text) · 电子邮箱 (text)
//
// DOM contract (verified live):
//   item  = .my-list-item
//   label = .header-title  (iconfont.icon-bitian + text)
//   input = .am-input-control input
//   readiness: .resume-info-title === 基本信息 && my-list-item count > 0
(() => {
  const previous = globalThis.ResumeHotjobMcBasic;
  if (previous?.listener) {
    try { chrome.runtime.onMessage.removeListener(previous.listener); } catch {}
  }

  const SITE_ID = 'hotjob-mc';
  const TEXT_LABELS = ['姓名', '移动电话', '电子邮箱'];
  const ITEM_SEL = '.my-list-item';
  const LABEL_SEL = '.header-title';
  const INPUT_SEL = '.am-input-control input, input[type="text"], input[type="tel"], input[type="email"], input:not([type])';
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
    ITEM_SEL,
    LABEL_SEL,
    isHotjobMcHost,
    onHotjobMcPage,
    findItem,
    textControl,
    fillText,
    restoreText,
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
      return false;
    };
    chrome.runtime.onMessage.addListener(api.listener);
  }

  globalThis.ResumeHotjobMcBasic = api;
})();
