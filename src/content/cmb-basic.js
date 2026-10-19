// CMB (招商银行 career.cmbchina.com) first-slice basic fill (fill-without-save).
// Isolated siteId: cmb. Never clicks 保存/提交. Never touches CMS/GTH/citics/feishu.
//
// First slice fields (labels from CDP bodyText 2026-10-18 /center/resume):
//   姓名 (text) · 手机号 (text) · 邮箱 (text)
// Gender (性别) is offline/synthetic only: 男 / 女 inside one label-scoped form item.
// Live radio DOM was NOT harvested. Class names are public CSS candidates only.
// Height (身高) is offline/synthetic text only. The label may include a CM suffix.
// The written value is numeric centimeters. Never write a CM suffix into the value.
// Live height label string and input DOM were NOT harvested.
// Weight (体重) is offline/synthetic text only. The label may include a KG suffix.
// The written value is numeric kilograms. Never write a KG suffix into the value.
// Live weight label string and input DOM were NOT harvested.
//
// DOM contract (CSS-confirmed in public main.02cda64a.css; live form layout unproven):
//   `.ant-form-item` + `.ant-form-item-label` + `input.ant-input`
// Gender candidates (public CSS only, synthetic fixture, not a live contract):
//   `.ant-form-item` scoped by label 性别 + `.ant-radio-wrapper` + `.ant-radio`
// Height reuses the text path above (synthetic fixture, not a live contract):
//   `.ant-form-item` scoped by label 身高, optional CM suffix, + `input.ant-input`
// Weight reuses the text path above (synthetic fixture, not a live contract):
//   `.ant-form-item` scoped by label 体重, optional KG suffix, + `input.ant-input`
// CDP fingerprint wrongly flagged vue; public bundle is React createRoot + ant-design.
// Hard warning: page copy says 姓名/证件* 保存后不可再改 — Never Save is mandatory.
(() => {
  const previous = globalThis.ResumeCmbBasic;
  if (previous?.listener) {
    try { chrome.runtime.onMessage.removeListener(previous.listener); } catch {}
  }

  const SITE_ID = 'cmb';
  const TEXT_LABELS = ['姓名', '手机号', '邮箱'];
  const GENDER_LABEL = '性别';
  const GENDER_VALUES = ['男', '女'];
  const HEIGHT_LABEL = '身高';
  /** Digits only. A CM suffix is rejected so the unit is never written into the value. */
  const HEIGHT_VALUE_RE = /^\d+(?:\.\d+)?$/u;
  /** 身高, or 身高 plus an optional CM suffix. Not a harvested live label string. */
  const HEIGHT_LABEL_RE = /^身高(?:\s*(?:[（(]\s*)?cm(?:\s*[）)])?)?$/iu;
  const WEIGHT_LABEL = '体重';
  /** Digits only. A KG suffix is rejected so the unit is never written into the value. */
  const WEIGHT_VALUE_RE = /^\d+(?:\.\d+)?$/u;
  /** 体重, or 体重 plus an optional KG suffix. Not a harvested live label string. */
  const WEIGHT_LABEL_RE = /^体重(?:\s*(?:[（(]\s*)?kg(?:\s*[）)])?)?$/iu;
  /** CSS-confirmed ant-design classes in public main.02cda64a.css — live resume DOM may still differ. */
  const ITEM_SEL = '.ant-form-item';
  const LABEL_SEL = '.ant-form-item-label, label';
  const INPUT_SEL = 'input.ant-input, input[type="text"], input[type="tel"], input[type="email"], input:not([type])';
  /** Public CSS candidates only. Not harvested from a logged-in resume. */
  const RADIO_WRAP_SEL = '.ant-radio-wrapper';
  const RADIO_MARK_SEL = '.ant-radio';

  const norm = (value) => String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/gu, '')
    .replace(/[\s\u00a0]+/gu, ' ')
    .trim();
  const cleanLabel = (value) => norm(value).replace(/^\*\s*/u, '').replace(/\s*\*$/u, '').replace(/[：:]\s*$/u, '').trim();
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function isCmbHost(hostname = location.hostname) {
    return String(hostname || '').toLowerCase() === 'career.cmbchina.com';
  }

  function onCmbResumeEditPage(url = location.href) {
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
      if (!isCmbHost(u.hostname)) return false;
      return u.pathname === '/center/resume' || u.pathname.startsWith('/center/resume/');
    } catch {
      return false;
    }
  }

  function pageAllowed(options) {
    if (onCmbResumeEditPage()) return true;
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

  function isHeightLabel(text) {
    return HEIGHT_LABEL_RE.test(cleanLabel(text));
  }

  function findHeightItem() {
    const hits = formItems().filter((item) => {
      const label = item.querySelector(LABEL_SEL);
      return label && isHeightLabel(labelText(label));
    });
    return hits.length === 1 ? hits[0] : null;
  }

  function isWeightLabel(text) {
    return WEIGHT_LABEL_RE.test(cleanLabel(text));
  }

  function findWeightItem() {
    const hits = formItems().filter((item) => {
      const label = item.querySelector(LABEL_SEL);
      return label && isWeightLabel(labelText(label));
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

  function genderOptions(item) {
    return [...item.querySelectorAll(RADIO_WRAP_SEL)].map((wrap) => {
      const mark = wrap.querySelector(RADIO_MARK_SEL);
      const control = wrap.querySelector('input[type="radio"]');
      const clone = wrap.cloneNode(true);
      clone.querySelectorAll(RADIO_MARK_SEL).forEach((node) => node.remove());
      return { wrap, mark, control, text: norm(clone.textContent) };
    }).filter((row) => row.text === '男' || row.text === '女');
  }

  function genderStructureOk(options) {
    if (options.length !== 2) return false;
    const texts = new Set(options.map((row) => row.text));
    if (texts.size !== 2 || !texts.has('男') || !texts.has('女')) return false;
    return options.every((row) => row.mark && row.control && row.control.type === 'radio' && !row.control.disabled);
  }

  function readGender(item) {
    const options = genderOptions(item);
    if (!genderStructureOk(options)) return { ok: false, value: '', reason: 'radio_structure_changed' };
    const checked = options.filter((row) => row.control.checked);
    if (checked.length > 1) return { ok: false, value: '', reason: 'radio_readback_ambiguous' };
    return { ok: true, value: checked[0]?.text || '', reason: checked.length ? 'checked' : 'empty' };
  }

  async function fillGender(value, options = {}) {
    const want = norm(value);
    const base = {
      label: GENDER_LABEL,
      saved: false,
      skippedSave: true,
      expected: want,
      before: '',
      after: ''
    };
    if (!pageAllowed(options)) return { ...base, ok: false, reason: 'wrong_page' };
    if (!GENDER_VALUES.includes(want)) {
      return { ...base, ok: false, reason: 'invalid_profile_value' };
    }
    const item = findItem(GENDER_LABEL);
    if (!item) return { ...base, ok: false, reason: 'item_not_found' };
    const radios = genderOptions(item);
    if (!genderStructureOk(radios)) {
      return { ...base, ok: false, reason: 'radio_structure_changed' };
    }
    const beforeRead = readGender(item);
    const before = beforeRead.ok ? beforeRead.value : '';
    const target = radios.find((row) => row.text === want);
    if (!target) {
      return { ...base, ok: false, reason: 'option_not_found', before, after: before };
    }
    target.wrap.click();
    if (!target.control.checked) target.control.click();
    target.control.dispatchEvent(new Event('input', { bubbles: true }));
    target.control.dispatchEvent(new Event('change', { bubbles: true }));
    await pause(80);
    const afterRead = readGender(item);
    const after = afterRead.ok ? afterRead.value : '';
    const matched = afterRead.ok && after === want;
    return {
      ...base,
      ok: matched,
      reason: matched ? 'matched' : (afterRead.ok ? 'readback_mismatch' : afterRead.reason),
      before,
      after
    };
  }

  async function fillHeight(value, options = {}) {
    const raw = norm(value);
    const want = HEIGHT_VALUE_RE.test(raw) ? raw : '';
    const base = {
      label: HEIGHT_LABEL,
      saved: false,
      skippedSave: true,
      expected: want || raw,
      before: '',
      after: ''
    };
    if (!pageAllowed(options)) return { ...base, ok: false, reason: 'wrong_page' };
    if (!want) return { ...base, ok: false, reason: 'invalid_profile_value', expected: raw };
    const item = findHeightItem();
    if (!item) return { ...base, ok: false, reason: 'item_not_found' };
    const control = textControl(item);
    if (!control) return { ...base, ok: false, reason: 'control_not_found' };
    const before = norm(control.value);
    control.focus();
    setNativeValue(control, want);
    await pause(80);
    const after = readText(item);
    const matched = after === want && !/cm/iu.test(after);
    return {
      ...base,
      ok: matched,
      reason: matched ? 'matched' : 'readback_mismatch',
      before,
      after,
      expected: want
    };
  }

  async function fillWeight(value, options = {}) {
    const raw = norm(value);
    const want = WEIGHT_VALUE_RE.test(raw) ? raw : '';
    const base = {
      label: WEIGHT_LABEL,
      saved: false,
      skippedSave: true,
      expected: want || raw,
      before: '',
      after: ''
    };
    if (!pageAllowed(options)) return { ...base, ok: false, reason: 'wrong_page' };
    if (!want) return { ...base, ok: false, reason: 'invalid_profile_value', expected: raw };
    const item = findWeightItem();
    if (!item) return { ...base, ok: false, reason: 'item_not_found' };
    const control = textControl(item);
    if (!control) return { ...base, ok: false, reason: 'control_not_found' };
    const before = norm(control.value);
    control.focus();
    setNativeValue(control, want);
    await pause(80);
    const after = readText(item);
    const matched = after === want && !/kg/iu.test(after);
    return {
      ...base,
      ok: matched,
      reason: matched ? 'matched' : 'readback_mismatch',
      before,
      after,
      expected: want
    };
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
    const genderRaw = norm(profile.gender || '');
    const heightRaw = norm(profile.height || '');
    const weightRaw = norm(profile.weight || '');
    const core = [
      { label: '姓名', path: 'fullName', value: fullName },
      { label: '手机号', path: 'phone', value: mobile },
      { label: '邮箱', path: 'email', value: email }
    ].map((row) => {
      let reason = null;
      if (!row.value) reason = 'missing_profile_value';
      else if (!confirmed.has(row.path)) reason = 'profile_fact_unconfirmed';
      return { ...row, ready: reason === null, reason };
    });
    const genderFields = [];
    if (genderRaw) {
      let reason = null;
      if (!confirmed.has('gender')) reason = 'profile_fact_unconfirmed';
      else if (!GENDER_VALUES.includes(genderRaw)) reason = 'invalid_profile_value';
      genderFields.push({
        label: GENDER_LABEL,
        path: 'gender',
        value: genderRaw,
        ready: reason === null,
        reason
      });
    }
    const heightFields = [];
    if (heightRaw) {
      let reason = null;
      if (!confirmed.has('height')) reason = 'profile_fact_unconfirmed';
      else if (!HEIGHT_VALUE_RE.test(heightRaw)) reason = 'invalid_profile_value';
      heightFields.push({
        label: HEIGHT_LABEL,
        path: 'height',
        value: heightRaw,
        ready: reason === null,
        reason
      });
    }
    const weightFields = [];
    if (weightRaw) {
      let reason = null;
      if (!confirmed.has('weight')) reason = 'profile_fact_unconfirmed';
      else if (!WEIGHT_VALUE_RE.test(weightRaw)) reason = 'invalid_profile_value';
      weightFields.push({
        label: WEIGHT_LABEL,
        path: 'weight',
        value: weightRaw,
        ready: reason === null,
        reason
      });
    }
    const fields = [...core, ...genderFields, ...heightFields, ...weightFields];
    const coreBlockers = core.filter((row) => !row.ready);
    const genderBlockers = genderFields.filter((row) => !row.ready);
    const heightBlockers = heightFields.filter((row) => !row.ready);
    const weightBlockers = weightFields.filter((row) => !row.ready);
    if (coreBlockers.length) {
      return {
        ok: false,
        reason: 'profile_fields_unavailable',
        values: null,
        fields,
        blockers: [...coreBlockers, ...genderBlockers, ...heightBlockers, ...weightBlockers]
      };
    }
    return {
      ok: true,
      reason: 'profile_ready',
      values: {
        fullName,
        mobile,
        email,
        gender: genderFields.find((row) => row.ready)?.value || '',
        height: heightFields.find((row) => row.ready)?.value || '',
        weight: weightFields.find((row) => row.ready)?.value || ''
      },
      fields,
      blockers: [...genderBlockers, ...heightBlockers, ...weightBlockers]
    };
  }

  function probeFingerprint() {
    const html = document.documentElement?.innerHTML || '';
    const title = document.title || '';
    const hints = {
      antDesign: /\bant-(?:form|input|select|btn)\b/i.test(html) || !!document.querySelector('.ant-form-item, .ant-input, .ant-btn'),
      reactRoot: !!document.getElementById('root'),
      cmbStatic: /\/static\/js\/main\./i.test(html) || /career\.cmbchina\.com/i.test(location.href),
      hotjob: /wecruit\.hotjob\.cn|hotjob\.cn/i.test(html),
      citics: /careers\.citics\.com/i.test(html)
    };
    return {
      ...hints,
      looksCmb: hints.cmbStatic && !hints.hotjob && !hints.citics,
      inputCount: document.querySelectorAll('input:not([type=hidden])').length,
      formItemCount: formItems().length,
      foundLabels: TEXT_LABELS.filter((label) => !!findItem(label)),
      title
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
      ok: onPage && (foundCount >= 1 || fp.looksCmb || options?.synthetic === true),
      siteId: SITE_ID,
      href: location.href,
      title: document.title,
      onCmbResumeEdit: onCmbResumeEditPage(),
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
            : fp.looksCmb
              ? 'cmb_shell_no_form_dom'
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
      const gender = rawValues.gender == null ? '' : norm(rawValues.gender);
      const height = rawValues.height == null ? '' : norm(rawValues.height);
      const weight = rawValues.weight == null ? '' : norm(rawValues.weight);
      if (gender && !GENDER_VALUES.includes(gender)) {
        return {
          ok: false,
          siteId: SITE_ID,
          reason: 'invalid_gender',
          href: location.href,
          results: [],
          saved: false,
          skippedSave: true,
          writeAttempted: false
        };
      }
      if (height && !HEIGHT_VALUE_RE.test(height)) {
        return {
          ok: false,
          siteId: SITE_ID,
          reason: 'invalid_height',
          href: location.href,
          results: [],
          saved: false,
          skippedSave: true,
          writeAttempted: false
        };
      }
      if (weight && !WEIGHT_VALUE_RE.test(weight)) {
        return {
          ok: false,
          siteId: SITE_ID,
          reason: 'invalid_weight',
          href: location.href,
          results: [],
          saved: false,
          skippedSave: true,
          writeAttempted: false
        };
      }
      values = {
        fullName: norm(rawValues.fullName || ''),
        mobile: norm(rawValues.mobile || rawValues.phone || ''),
        email: norm(rawValues.email || ''),
        gender,
        height,
        weight
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
      ['手机号', values.mobile],
      ['邮箱', values.email]
    ];
    const results = [];
    for (const [label, value] of textPlan) {
      results.push(await fillText(label, value));
    }
    if (GENDER_VALUES.includes(values.gender)) {
      results.push(await fillGender(values.gender, options));
    }
    if (HEIGHT_VALUE_RE.test(values.height || '')) {
      results.push(await fillHeight(values.height, options));
    }
    if (WEIGHT_VALUE_RE.test(values.weight || '')) {
      results.push(await fillWeight(values.weight, options));
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
    GENDER_LABEL,
    GENDER_VALUES,
    HEIGHT_LABEL,
    HEIGHT_VALUE_RE,
    WEIGHT_LABEL,
    WEIGHT_VALUE_RE,
    ITEM_SEL,
    RADIO_WRAP_SEL,
    RADIO_MARK_SEL,
    isCmbHost,
    onCmbResumeEditPage,
    findItem,
    textControl,
    fillText,
    fillGender,
    fillHeight,
    fillWeight,
    fillBasic,
    probeLabels,
    probeFingerprint,
    planFromProfile,
    listener: null
  };

  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    api.listener = (message, _sender, sendResponse) => {
      if (!message || (message.siteId && message.siteId !== SITE_ID)) return false;
      if (message.type === 'CMB_BASIC_PROBE') {
        probeLabels(message.options || {}).then(sendResponse);
        return true;
      }
      if (message.type === 'CMB_BASIC_FILL') {
        fillBasic(message.values || { profile: message.profile }, message.options || {}).then(sendResponse);
        return true;
      }
      return false;
    };
    chrome.runtime.onMessage.addListener(api.listener);
  }

  globalThis.ResumeCmbBasic = api;
})();
