// Feishu ATSX (saas-career) first-slice basic fill (fill-without-save).
// Isolated siteId: feishu-atsx. Never clicks 保存/提交/投递. Never touches CMS/GTH/citics.
//
// First slice fields (schema from gffunds.jobs.feishu.cn embedded resume form):
//   姓名 (text) · 手机号码 (text) · 邮箱 (text)
//
// DOM contract: `.atsx-form-item` + `.atsx-form-item-label` + `input.atsx-input`
// (JS-confirmed in public saas-career bundles pc.4481de59 / 8825.0e3d5ab8; Ant Design prefixCls=atsx).
// Live resume-edit page still login-walled — refine if harvested DOM differs.
// Family samples: gffunds.jobs.feishu.cn · thundersoft.jobs.feishu.cn (same saas-career JS as gffunds).
(() => {
  const previous = globalThis.ResumeFeishuAtsxBasic;
  if (previous?.listener) {
    try { chrome.runtime.onMessage.removeListener(previous.listener); } catch {}
  }

  const SITE_ID = 'feishu-atsx';
  const TEXT_LABELS = ['姓名', '手机号码', '邮箱'];
  /** JS-confirmed first-slice root (saas-career); live resume edit may still differ — fail-closed if missing. */
  const ITEM_SEL = '.atsx-form-item';
  const LABEL_SEL = '.atsx-form-item-label, label';
  const INPUT_SEL = 'input.atsx-input, input[type="text"], input[type="tel"], input[type="email"], input:not([type])';

  const norm = (value) => String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/gu, '')
    .replace(/[\s\u00a0]+/gu, ' ')
    .trim();
  const cleanLabel = (value) => norm(value).replace(/^\*\s*/u, '').replace(/\s*\*$/u, '').replace(/[：:]\s*$/u, '').trim();
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function isFeishuAtsxHost(hostname = location.hostname) {
    const host = String(hostname || '').toLowerCase();
    if (!host) return false;
    if (host === 'jobs.bytedance.com' || host.endsWith('.jobs.bytedance.com')) return true;
    if (host === 'jobs.feishu.cn' || host.endsWith('.jobs.feishu.cn')) return true;
    return false;
  }

  /** True on known ATSX hosts (any path). Resume edit path is login-gated; path not hard-coded yet. */
  function onFeishuAtsxPage(url = location.href) {
    try {
      const u = new URL(url);
      return (u.protocol === 'https:' || u.protocol === 'http:') && isFeishuAtsxHost(u.hostname);
    } catch {
      return false;
    }
  }

  function pageAllowed(options) {
    if (onFeishuAtsxPage()) return true;
    if (options?.synthetic !== true) return false;
    return location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  }

  function labelText(node) {
    if (!node) return '';
    const clone = node.cloneNode(true);
    clone.querySelectorAll('span,i,svg,em').forEach((child) => {
      const t = norm(child.textContent);
      if (!t || t === '*' || t === '：') child.remove();
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
      if (node.type === 'hidden' || node.type === 'radio' || node.type === 'checkbox') return false;
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
      { label: '手机号码', path: 'phone', value: mobile },
      { label: '邮箱', path: 'email', value: email }
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
    const html = document.documentElement?.innerHTML || '';
    const title = document.title || '';
    const hints = {
      atsx: /atsx/i.test(html) || /atsx/i.test(title),
      saasCareer: /saas-career/i.test(html),
      feishuCdn: /feishucdn\.com|larksuite\.com/i.test(html),
      hotjob: /wecruit\.hotjob\.cn|hotjob\.cn/i.test(html)
    };
    return {
      ...hints,
      looksAtsx: (hints.atsx || hints.saasCareer) && !hints.hotjob,
      inputCount: document.querySelectorAll('input:not([type=hidden])').length,
      formItemCount: formItems().length,
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
        value: item ? readText(item) : ''
      };
    });
    const foundCount = labels.filter((row) => row.found && row.hasTextControl).length;
    const onPage = pageAllowed(options);
    return {
      ok: onPage && (foundCount >= 1 || fp.looksAtsx || options?.synthetic === true),
      siteId: SITE_ID,
      href: location.href,
      title: document.title,
      onFeishuAtsxHost: onFeishuAtsxPage(),
      synthetic: options?.synthetic === true,
      fingerprint: fp,
      labels,
      foundCount,
      reason: !onPage
        ? 'wrong_page'
        : foundCount >= 3
          ? 'labels_ready'
          : foundCount >= 1
            ? 'labels_partial'
            : fp.looksAtsx
              ? 'atsx_shell_no_form_dom'
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
      ['手机号码', values.mobile],
      ['邮箱', values.email]
    ];
    const results = [];
    for (const [label, value] of textPlan) {
      results.push(await fillText(label, value));
    }
    const ok = results.every((row) => row.ok);
    return {
      ok,
      siteId: SITE_ID,
      href: location.href,
      title: document.title,
      saved: false,
      skippedSave: true,
      writeAttempted: true,
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
    isFeishuAtsxHost,
    onFeishuAtsxPage,
    findItem,
    textControl,
    fillText,
    fillBasic,
    probeLabels,
    probeFingerprint,
    planFromProfile,
    listener: null
  };

  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    api.listener = (message, _sender, sendResponse) => {
      if (!message || (message.siteId && message.siteId !== SITE_ID)) return false;
      if (message.type === 'FEISHU_ATSX_BASIC_PROBE') {
        probeLabels(message.options || {}).then(sendResponse);
        return true;
      }
      if (message.type === 'FEISHU_ATSX_BASIC_FILL') {
        fillBasic(message.values || { profile: message.profile }, message.options || {}).then(sendResponse);
        return true;
      }
      return false;
    };
    chrome.runtime.onMessage.addListener(api.listener);
  }

  globalThis.ResumeFeishuAtsxBasic = api;
})();
