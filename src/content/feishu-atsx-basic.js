// Feishu ATSX (saas-career) first-slice basic fill (fill-without-save).
// Isolated siteId: feishu-atsx. Never clicks 保存/提交/投递. Never touches CMS/GTH/citics.
//
// First slice fields (schema from gffunds.jobs.feishu.cn embedded resume form):
//   姓名 (text) · 手机号码 (text) · 邮箱 (text)
//
// DOM contract: `.atsx-form-item` + `.atsx-form-item-label` + `input.atsx-input`
// (JS-confirmed in public saas-career bundles pc.4481de59 / 8825.0e3d5ab8; Ant Design prefixCls=atsx).
// Live resume-edit page still login-walled — refine if harvested DOM differs.
// Family samples: gffunds.jobs.feishu.cn · thundersoft.jobs.feishu.cn · xiaomi.jobs.f.mioffice.cn (same saas-career JS as gffunds).
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
  const seal = (result) => ({ ...result, saved: false, skippedSave: true, liveSupportClaimed: false });

  function isFeishuAtsxHost(hostname = location.hostname) {
    const host = String(hostname || '').toLowerCase();
    if (!host) return false;
    if (host === 'jobs.bytedance.com' || host.endsWith('.jobs.bytedance.com')) return true;
    if (host === 'jobs.feishu.cn' || host.endsWith('.jobs.feishu.cn')) return true;
    if (host === 'jobs.f.mioffice.cn' || host.endsWith('.jobs.f.mioffice.cn')) return true;
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

  function visibleTextInputs(item) {
    return [...item.querySelectorAll(INPUT_SEL)].filter((node) => {
      if (!['text', 'tel', 'email'].includes(node.type)) return false;
      if (!node.isConnected || node.matches(':disabled') || node.readOnly) return false;
      for (let ancestor = node; ancestor; ancestor = ancestor.parentElement) {
        if (ancestor.hidden || ancestor.hasAttribute('inert')
          || ancestor.getAttribute('aria-hidden') === 'true'
          || ancestor.getAttribute('aria-disabled') === 'true'
          || ancestor.getAttribute('aria-readonly') === 'true') return false;
        const style = getComputedStyle(ancestor);
        if (style.display === 'none' || style.visibility === 'hidden'
          || style.visibility === 'collapse' || style.contentVisibility === 'hidden'
          || Number.parseFloat(style.opacity) === 0) return false;
      }
      return true;
    });
  }

  function textControl(item) {
    const inputs = visibleTextInputs(item);
    return inputs.length === 1 ? inputs[0] : null;
  }

  /**
   * Existing JS-confirmed `.atsx-*` contract only. Does not invent a new live class.
   * missing → item_not_found; duplicate label → field_ambiguous;
   * zero inputs → control_not_found; several inputs → control_ambiguous.
   */
  function classifyField(label) {
    const hits = matchingItems(label);
    if (hits.length === 0) {
      return { label, ready: false, reason: 'item_not_found', matchCount: 0 };
    }
    if (hits.length !== 1) {
      return { label, ready: false, reason: 'field_ambiguous', matchCount: hits.length };
    }
    const inputs = visibleTextInputs(hits[0]);
    if (inputs.length === 0) {
      return { label, ready: false, reason: 'control_not_found', matchCount: 1, controlCount: 0, item: hits[0] };
    }
    if (inputs.length !== 1) {
      return { label, ready: false, reason: 'control_ambiguous', matchCount: 1, controlCount: inputs.length, item: hits[0] };
    }
    return {
      label,
      ready: true,
      reason: 'unique',
      matchCount: 1,
      controlCount: 1,
      item: hits[0],
      control: inputs[0]
    };
  }

  // Cleanup may restore a hidden owned input, but never a node rebound to a
  // different field/item. Connectivity and value equality alone are not ownership.
  function hasTextBinding({ label, item, control }) {
    const hits = matchingItems(label);
    return control?.isConnected && item?.isConnected
      && hits.length === 1 && hits[0] === item && control.closest(ITEM_SEL) === item;
  }

  function setNativeValue(input, value, binding) {
    const proto = Object.getPrototypeOf(input);
    const desc = Object.getOwnPropertyDescriptor(proto, 'value')
      || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (desc?.set) desc.set.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    if (!hasTextBinding(binding)) return;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    if (!hasTextBinding(binding)) return;
    input.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function readText(item) {
    const control = textControl(item);
    return control ? norm(control.value) : '';
  }

  async function rollbackText(snapshots) {
    const restored = [];
    for (const snap of [...snapshots].reverse()) {
      if (!hasTextBinding(snap)) {
        restored.push({ label: snap.label, ok: false, reason: 'rollback_control_changed' });
        continue;
      }
      if (snap.control.value === snap.before) {
        restored.push({ label: snap.label, ok: true, reason: 'already_restored' });
        continue;
      }
      // A reactive or user edit owns its new value. Only undo our own exact write.
      if (snap.control.value !== snap.expected) {
        restored.push({ label: snap.label, ok: false, reason: 'rollback_skipped_value_changed' });
        continue;
      }
      setNativeValue(snap.control, snap.before, snap);
      await pause(80);
      restored.push({ label: snap.label, ok: snap.control.value === snap.before, reason: 'rollback_readback' });
    }
    for (const row of restored) {
      const snap = snapshots.find((candidate) => candidate.label === row.label);
      row.ok = hasTextBinding(snap) && snap.control.value === snap.before;
      row.after = snap.control.value;
    }
    return restored;
  }

  async function fillText(label, value, options = {}) {
    const expected = norm(value);
    if (!pageAllowed(options) || !TEXT_LABELS.includes(label) || !expected) {
      return seal({
        label, ok: false,
        reason: !pageAllowed(options) ? 'wrong_page' : !TEXT_LABELS.includes(label) ? 'label_not_allowed' : 'empty_value',
        before: '', after: '', expected, writeAttempted: false
      });
    }
    const row = classifyField(label);
    if (!row.ready) {
      return seal({
        label,
        ok: false,
        reason: row.reason,
        matchCount: row.matchCount,
        controlCount: row.controlCount ?? null,
        before: '',
        after: '',
        expected,
        writeAttempted: false
      });
    }
    const control = row.control;
    const before = norm(control.value);
    // The fixture has empty text values, with no text sentinel contract.
    // Prompt-looking strings and actual placeholder text in value are occupied too.
    if (String(control.value).trim() !== '') {
      return seal({ label, ok: true, reason: 'skipped_existing', before, after: before, expected, writeAttempted: false });
    }
    const snapshot = { label, item: row.item, control, before: control.value, expected: String(value ?? '') };
    control.focus();
    const focused = classifyField(label);
    if (!focused.ready || focused.item !== row.item || focused.control !== control) {
      return seal({ label, ok: false, reason: 'control_changed', before, after: norm(control.value), expected, writeAttempted: false });
    }
    if (String(control.value).trim() !== '') {
      return seal({ label, ok: true, reason: 'skipped_existing', before, after: norm(control.value), expected, writeAttempted: false });
    }
    setNativeValue(control, snapshot.expected, snapshot);
    await pause(80);
    const current = classifyField(label);
    const after = current.ready ? norm(current.control.value) : norm(control.value);
    const ok = current.ready && current.item === row.item && current.control === control && after === expected;
    const restore = ok ? [] : await rollbackText([snapshot]);
    return seal({
      label,
      ok,
      reason: ok ? 'matched' : 'readback_mismatch',
      before,
      after,
      expected,
      writeAttempted: true,
      restored: restore.length > 0 && restore.every((entry) => entry.ok),
      restore
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
      liveSupportClaimed: false,
      saved: false,
      skippedSave: true
    };
  }

  async function fillBasicUnsealed(rawValues = {}, options = {}) {
    if (!pageAllowed(options)) {
      return {
        ok: false,
        siteId: SITE_ID,
        reason: 'wrong_page',
        href: location.href,
        results: [],
        writeAttempted: false,
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
          writeAttempted: false,
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
    const classified = textPlan.map(([label, value]) => ({ ...classifyField(label), expected: norm(value) }));
    if (classified.some((row) => !row.ready)) {
      return {
        ok: false,
        siteId: SITE_ID,
        href: location.href,
        title: document.title,
        reason: 'form_not_ready',
        saved: false,
        skippedSave: true,
        writeAttempted: false,
        profileSource: allowExplicit ? 'explicit' : 'resumeProfile',
        results: classified.map((row) => ({
          label: row.label,
          ok: false,
          reason: row.ready ? 'skipped_form_not_ready' : row.reason,
          matchCount: row.matchCount,
          controlCount: row.controlCount ?? null,
          before: '',
          after: '',
          expected: row.expected
        }))
      };
    }
    const snapshots = classified.map((row) => ({
      label: row.label, item: row.item, control: row.control, before: row.control.value, expected: row.expected
    }));
    const results = [];
    let failed = false;
    for (const [label, value] of textPlan) {
      if (failed) {
        results.push({ label, ok: false, reason: 'skipped_previous_failure', writeAttempted: false, expected: norm(value) });
        continue;
      }
      const snap = snapshots.find((row) => row.label === label);
      const current = classifyField(label);
      if (!current.ready || current.item !== snap.item || current.control !== snap.control) {
        results.push({ label, ok: false, reason: 'control_changed', writeAttempted: false, expected: norm(value) });
        failed = true;
        continue;
      }
      const result = await fillText(label, value, options);
      results.push(result);
      failed = !result.ok;
    }
    // Later field events can replace an earlier successful readback.
    for (const result of results.filter((row) => row.writeAttempted && row.ok)) {
      const current = classifyField(result.label);
      const snap = snapshots.find((row) => row.label === result.label);
      if (!current.ready || current.item !== snap.item || current.control !== snap.control || norm(current.control.value) !== result.expected) {
        result.ok = false;
        result.reason = 'readback_mismatch';
        result.after = current.ready ? norm(current.control.value) : norm(snap.control.value);
      }
    }
    const ok = results.every((row) => row.ok);
    const attempted = snapshots.filter((snap) => results.find((row) => row.label === snap.label)?.writeAttempted);
    const restore = ok ? [] : await rollbackText(attempted);
    return {
      ok,
      reason: ok ? 'readback_matched' : 'readback_mismatch',
      siteId: SITE_ID,
      href: location.href,
      title: document.title,
      saved: false,
      skippedSave: true,
      writeAttempted: attempted.length > 0,
      restored: restore.length > 0 && restore.every((row) => row.ok),
      restore,
      profileSource: allowExplicit ? 'explicit' : 'resumeProfile',
      planSummary: plan
        ? { reason: plan.reason, readyCount: plan.fields.filter((f) => f.ready).length, blockerCount: plan.blockers.length }
        : { reason: 'explicit_override' },
      results
    };
  }

  async function fillBasic(rawValues = {}, options = {}) {
    return seal(await fillBasicUnsealed(rawValues, options));
  }

  const api = {
    siteId: SITE_ID,
    liveSupportClaimed: false,
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
