/**
 * Read-only page expressions. They observe labels, values lengths, and
 * control attributes already used by the 2026-10-19 harvest.
 * No pointer activation, no typing, no persist. Not a support claim.
 */

export const CMB_CONTEXT_EXPR = `(() => {
  const href = location.href;
  const title = document.title;
  const body = (document.body && document.body.innerText || '').slice(0, 1200);
  const loginHints = /登录|验证码|手机号登录|扫码登录|获取验证码/.test(body) && !document.querySelector('#resume_basicInfo_name, #resume_basicInfo_birthday');
  const hasForm = !!document.querySelector('#resume_basicInfo_birthday, #resume_basicInfo_name, .ant-form-item');
  const resumeIds = [...document.querySelectorAll('[id^="resume_"]')].map(e => e.id);
  return { href, title, loginHints, hasForm, resumeIdCount: resumeIds.length, resumeIds: resumeIds.slice(0, 80), bodySample: body.slice(0, 400) };
})()`;

export const CMB_RANKING_SNAP1_EXPR = `(() => {
  const norm = (s) => String(s || '').replace(/\\s+/g, ' ').trim();
  const labels = [];
  for (const it of document.querySelectorAll('.ant-form-item')) {
    const lab = it.querySelector('.ant-form-item-label');
    const text = lab ? norm(lab.textContent) : '';
    if (!text) continue;
    if (/排名|RankingMajor|专业排名|成绩排名|学业排名/.test(text) || /rank/i.test(text)) {
      const input = it.querySelector('input, select, textarea, [role=combobox]');
      const select = it.querySelector('.ant-select');
      const picker = it.querySelector('.ant-picker');
      labels.push({
        labelText: text,
        hasInput: !!input,
        inputId: input ? (input.id || null) : null,
        inputName: input ? (input.getAttribute('name') || null) : null,
        inputType: input ? (input.type || input.tagName || null) : null,
        inputPlaceholder: input ? (input.placeholder || null) : null,
        inputDisabled: input ? !!input.disabled : null,
        inputReadOnly: input ? !!input.readOnly : null,
        inputValue: input && 'value' in input ? (input.value || null) : null,
        hasAntSelect: !!select,
        selectOpen: select ? select.classList.contains('ant-select-open') : null,
        selectDisabled: select ? select.classList.contains('ant-select-disabled') : null,
        hasPicker: !!picker,
        itemHtmlSnippet: it.outerHTML.slice(0, 800),
        visible: it.getClientRects().length > 0
      });
    }
  }
  const eduBlocks = [...document.querySelectorAll('[id*="education"], [class*="education"], .ant-form')].slice(0, 5).map(el => ({
    id: el.id || null,
    className: typeof el.className === 'string' ? el.className.slice(0, 120) : null,
    textHit: /排名|RankingMajor/.test(el.innerText || '')
  }));
  const allLabelTexts = [...document.querySelectorAll('.ant-form-item-label')].map(l => norm(l.textContent)).filter(Boolean);
  const rankingishLabels = allLabelTexts.filter(t => /排名|Rank|成绩|GPA|绩点/.test(t));
  const idHits = [...document.querySelectorAll('[id]')].map(e => e.id).filter(id => /rank|Rank|排名|majorRank|RankingMajor/i.test(id));
  const nameHits = [...document.querySelectorAll('[name]')].map(e => e.getAttribute('name')).filter(n => n && /rank|Rank|RankingMajor|排名/i.test(n));
  return {
    labelHits: labels,
    rankingishLabels,
    idHits,
    nameHits,
    eduBlocks,
    allLabelCount: allLabelTexts.length,
    sampleLabels: allLabelTexts.slice(0, 40)
  };
})()`;

export const CMB_RANKING_SNAP2_EXPR = `(() => {
  const norm = (s) => String(s || '').replace(/\\s+/g, ' ').trim();
  const labels = [];
  for (const it of document.querySelectorAll('.ant-form-item')) {
    const lab = it.querySelector('.ant-form-item-label');
    const text = lab ? norm(lab.textContent) : '';
    if (!text) continue;
    if (/排名|RankingMajor|专业排名|成绩排名|学业排名/.test(text) || /rank/i.test(text)) {
      const input = it.querySelector('input, select, textarea, [role=combobox]');
      labels.push({
        labelText: text,
        hasInput: !!input,
        inputId: input ? (input.id || null) : null,
        visible: it.getClientRects().length > 0,
        itemHtmlSnippet: it.outerHTML.slice(0, 800)
      });
    }
  }
  const rankingishLabels = [...document.querySelectorAll('.ant-form-item-label')]
    .map(l => norm(l.textContent)).filter(t => /排名|Rank|成绩|GPA|绩点/.test(t));
  const idHits = [...document.querySelectorAll('[id]')].map(e => e.id).filter(id => /rank|Rank|排名|majorRank|RankingMajor/i.test(id));
  return { labelHits: labels, rankingishLabels, idHits };
})()`;

export const CMB_BIRTHDATE_EXPR = `(() => {
  const input = document.querySelector('#resume_basicInfo_birthday');
  const item = input ? input.closest('.ant-form-item') : null;
  const labelNode = item ? item.querySelector('.ant-form-item-label') : null;
  const label = labelNode ? String(labelNode.textContent || '').replace(/\\s+/g, ' ').trim() : null;
  const picker = input ? input.closest('.ant-picker') : null;
  const panel = document.querySelector('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)');
  let panelInfo = null;
  if (panel) {
    panelInfo = {
      panelClass: panel.className,
      hasYear: !!panel.querySelector('.ant-picker-year-btn,.ant-picker-header-year-btn'),
      hasMonth: !!panel.querySelector('.ant-picker-month-btn,.ant-picker-header-month-btn'),
      cellsSample: [...panel.querySelectorAll('.ant-picker-cell-inner')].slice(0, 8).map((c) => c.textContent ? c.textContent.trim() : ''),
      formatHint: input ? (input.getAttribute('placeholder') || null) : null
    };
  }
  return {
    ok: !!input,
    label,
    kindGuess: 'DatePicker',
    input: input ? {
      id: input.id,
      placeholder: input.placeholder || null,
      readOnly: !!input.readOnly,
      disabled: !!input.disabled,
      value: input.value || null,
      ariaControls: input.getAttribute('aria-controls')
    } : null,
    pickerClass: picker ? String(picker.className || '') : null,
    panel: panelInfo,
    fillHint: 'antd DatePicker readonly; hint-only; Never Save; NOT auto-filled'
  };
})()`;

export const NANYUE_EXPR = `(() => {
  const href = location.href;
  const title = document.title;
  const body = (document.body && document.body.innerText || '').slice(0, 2000);
  const loginHints = /登录|请先登录|验证码|手机号登录|扫码/.test(body) && !/基本信息|个人信息|姓名/.test(body);
  const inputs = [...document.querySelectorAll('input, select, textarea')].slice(0, 80).map((el) => ({
    tag: el.tagName,
    type: el.type || null,
    id: el.id || null,
    name: el.name || null,
    placeholder: el.placeholder || null,
    ariaLabel: el.getAttribute('aria-label'),
    disabled: !!el.disabled,
    readOnly: !!el.readOnly,
    valueLen: (el.value || '').length,
    hasValue: !!(el.value && String(el.value).trim())
  }));
  const labelTexts = [...document.querySelectorAll('label, .label, .form-label, .el-form-item__label, .ant-form-item-label, .van-field__label, [class*="label"]')]
    .map((n) => String(n.textContent || '').replace(/\\s+/g, ' ').trim())
    .filter((t) => t && t.length < 40)
    .slice(0, 60);
  const personalKeys = ['姓名','手机','电话','邮箱','性别','民族','政治','婚姻','出生','证件','身份证','户籍','现居','地址','学历','学校','专业'];
  const personalLabelHits = labelTexts.filter((t) => personalKeys.some((k) => t.includes(k)));
  const buttons = [...document.querySelectorAll('button, a.btn, [role=button], .el-button')]
    .map((b) => String(b.textContent || '').replace(/\\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 30);
  const commitLabels = buttons.filter((t) => /保存|提交|下一步|确认/.test(t));
  return {
    href, title, loginHints,
    inputCount: inputs.length,
    inputsFilled: inputs.filter((i) => i.hasValue).length,
    inputs,
    labelTexts: labelTexts.slice(0, 40),
    personalLabelHits,
    buttons,
    saveLikeButtonsPresent: commitLabels,
    bodySample: body.slice(0, 500),
    readiness: loginHints ? 'needs_login' : (inputs.length > 0 ? 'form_visible_readonly_ok' : 'empty_or_spa_loading')
  };
})()`;

export const PAID_PAGE_EXPR = `(() => {
  const href = location.href;
  const title = document.title;
  const body = (document.body && document.body.innerText || '').slice(0, 1800);
  const loginHints = /登录|请先登录|验证码|会话已过期|重新登录/.test(body) && !/基本信息|简历|个人信息|姓名/.test(body);
  const inputs = [...document.querySelectorAll('input, select, textarea')].slice(0, 60).map((el) => ({
    tag: el.tagName, type: el.type || null, id: el.id || null, name: el.name || null,
    placeholder: el.placeholder || null, disabled: !!el.disabled, readOnly: !!el.readOnly,
    hasValue: !!(el.value && String(el.value).trim()), valueLen: (el.value || '').length
  }));
  const labels = [...document.querySelectorAll('label, .el-form-item__label, .ant-form-item-label, .form-label')]
    .map((n) => String(n.textContent || '').replace(/\\s+/g, ' ').trim())
    .filter((t) => t && t.length < 40)
    .slice(0, 40);
  let extMarker = null;
  try {
    extMarker = {
      hasChromeRuntime: typeof chrome !== 'undefined' && !!(chrome && chrome.runtime)
    };
  } catch (_) { extMarker = { err: true }; }
  let storageHints = { local: [], session: [] };
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (/auto|fill|resume|quick|last|rqf|cms|gth/i.test(k || '')) storageHints.local.push({ key: k, len: (localStorage.getItem(k) || '').length });
    }
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (/auto|fill|resume|quick|last|rqf|cms|gth/i.test(k || '')) storageHints.session.push({ key: k, len: (sessionStorage.getItem(k) || '').length });
    }
  } catch (e) { storageHints.error = String(e); }
  return {
    href, title, loginHints,
    inputCount: inputs.length,
    inputsFilled: inputs.filter((i) => i.hasValue).length,
    inputs: inputs.slice(0, 40),
    labels,
    extMarker,
    storageHints,
    bodySample: body.slice(0, 400),
    readiness: loginHints ? 'needs_login' : (inputs.length > 0 ? 'form_visible_readonly_ok' : 'empty_or_spa_loading')
  };
})()`;

export const PAID_STORAGE_SNIPPET_EXPR = `(() => {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!/auto|fill|resume|quick|last|rqf|cms|gth/i.test(k || '')) continue;
    const v = localStorage.getItem(k) || '';
    if (/BEGIN (RSA |OPENSSH |EC )?PRIVATE|private[_-]?key|secret|password|token/i.test(k) || /BEGIN (RSA |OPENSSH |EC )?PRIVATE/.test(v)) {
      out.push({ key: k, skipped: 'secret_like' });
      continue;
    }
    out.push({ key: k, len: v.length, preview: v.slice(0, 500) });
  }
  return out.slice(0, 20);
})()`;

export const EXT_STORAGE_EXPR = `(async () => {
  const out = { url: location.href, id: (chrome && chrome.runtime && chrome.runtime.id) || null };
  try {
    if (chrome.storage && chrome.storage.local) {
      const all = await new Promise((resolve) => chrome.storage.local.get(null, resolve));
      const keys = Object.keys(all || {});
      out.storageKeyCount = keys.length;
      out.interesting = {};
      for (const k of keys) {
        if (!/auto|last|fill|run|cms|gth|resume|prefs|license|status/i.test(k)) continue;
        if (/private|secret|password|token|key/i.test(k)) { out.interesting[k] = { skipped: 'secret_like' }; continue; }
        const v = all[k];
        const s = typeof v === 'string' ? v : JSON.stringify(v);
        if (/BEGIN (RSA |OPENSSH |EC )?PRIVATE/.test(s || '')) { out.interesting[k] = { skipped: 'secret_like' }; continue; }
        out.interesting[k] = typeof v === 'string' ? v.slice(0, 800) : (s || '').slice(0, 800);
      }
    } else out.noStorage = true;
  } catch (e) { out.err = String(e); }
  return out;
})()`;
