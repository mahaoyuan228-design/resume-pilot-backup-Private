// CMB (招商银行 career.cmbchina.com) basic auto. Mirror MOKA/CMS basic-auto shape.
// Fill-without-save only. Never clicks 保存/提交/投递. Isolated siteId: cmb.
// Trial Edge injects per tab via scripting; host match is manifest host_permissions.
// Missing that match fails closed before any tab or script work. 招行 is not supported.
// A Save/submit/delete or saved/submitted claim is kept and fails closed. ok requires
// siteId cmb plus a non-empty verified result list. A requested field that is
// ambiguous, unsupported, or unsettled is failed and stays pending review.
// It is not omitted so the other rows can complete.
import {requireAutoFormReady,autoFormReadinessFailure} from './auto-form-readiness.mjs';
import {captureProfileBinding,assertProfileBinding,canonicalProfileHash,
  dispatchBoundSource,withProfileBinding} from '../profile/profile-lifecycle.js';
import {planCmbBasicFromProfile,cmbRequestedFillBlockers,cmbBirthDateReadinessView,CMB_REQUESTED_FILL_FAIL_CLOSED_REASONS,
  isCmbHost,isCmbResumeEditPath,isCmbResumeEditPage} from '../content/cmb-profile-map.mjs';

const SITE_ID = 'cmb';
const SAMPLE_PAGE = 'https://career.cmbchina.com/center/resume';
const pendingKey = (tabId) => `resumePendingFillReview:${tabId}`;
const VERIFIED_ROW_REASONS = new Set(['matched', 'readback_matched', 'preexisting_same_value']);
const NEVER_SAVE_CLAIMS = [
  'softwareClickedSave', 'softwareClickedSubmit', 'softwareClickedDelete',
  'softwareClickedNext', 'softwareClickedDeliver', 'saveAttempted',
  'submitAttempted', 'deleteAttempted', 'nextAttempted', 'deliverAttempted',
  'savedOnSite', 'submitted', 'delivered', 'saved'
];

function cmbReportRecords(report) {
  return [report, report?.birthDateHint,
    ...(Array.isArray(report?.results) ? report.results : []),
    ...(Array.isArray(report?.blockers) ? report.blockers : [])];
}

function cmbReportClaims(report) {
  const records = cmbReportRecords(report);
  return Object.fromEntries(NEVER_SAVE_CLAIMS.map((key) => [key,
    records.some((row) => row?.[key] === true)]));
}
const EXPLICIT_UNSETTLED_REASONS = new Set([
  'invalid_gender',
  'invalid_height',
  'invalid_weight',
  'invalid_formal_work',
  'invalid_marital_status',
  'invalid_politics',
  'invalid_ethnicity',
  'invalid_id_card_type',
  'invalid_education_level',
  'invalid_relationship_type',
  'invalid_relationship_type_row1',
  'invalid_award_level',
  'invalid_english_level',
  'invalid_channel_type',
  'invalid_interview_city'
]);
export const CMB_HOST_MATCH = 'https://career.cmbchina.com/*';
const HELP_HINT = '我需要帮助！请打开已登录的招行简历页 https://career.cmbchina.com/center/resume';
const fail = (reason) => { throw Error(reason); };
const safe = (error) => {
  const value = typeof error === 'string' ? error : (error?.message || '');
  return typeof value === 'string' && /^[a-z0-9_]{2,100}$/u.test(value) ? value : 'cmb_basic_auto_failed';
};
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** True only when the extension manifest requests the documented CMB host match. */
export function cmbHostPermissionGranted(manifest) {
  const list = manifest?.host_permissions;
  return Array.isArray(list) && list.includes(CMB_HOST_MATCH);
}

/** Fail-closed page resolver. Optional message.targetPage must be https resume edit. */
export function resolveCmbTarget(targetPage) {
  if (targetPage === undefined || targetPage === null || targetPage === '') {
    return { page: SAMPLE_PAGE, host: 'career.cmbchina.com', sample: true };
  }
  if (typeof targetPage !== 'string' || targetPage.length > 300) fail('cmb_page_invalid');
  let u;
  try { u = new URL(targetPage); } catch { fail('cmb_page_invalid'); }
  if (u.protocol !== 'https:') fail('cmb_page_invalid');
  if (!isCmbHost(u.hostname)) fail('cmb_page_invalid');
  if (!isCmbResumeEditPath(u.pathname)) fail('cmb_page_invalid');
  if (u.username || u.password || u.port) fail('cmb_page_invalid');
  return { page: `${u.origin}${u.pathname}`, host: u.hostname.toLowerCase(), sample: false };
}

export function isCmbTabUrl(url) {
  return isCmbResumeEditPage(url);
}

const CMB_LABEL_PATH = {
  姓名: 'fullName',
  手机号: 'phone',
  邮箱: 'email',
  性别: 'gender',
  身高: 'height',
  体重: 'weight',
  出生日期: 'birthDate'
};

function rowVerified(row) {
  if (!row || row.ok !== true) return false;
  const reason = typeof row.reason === 'string' ? row.reason : '';
  if (CMB_REQUESTED_FILL_FAIL_CLOSED_REASONS.includes(reason)) return false;
  return reason === '' || VERIFIED_ROW_REASONS.has(reason);
}

function failClosedReason(report) {
  const rows = [
    ...(Array.isArray(report?.results) ? report.results : []),
    ...(Array.isArray(report?.blockers) ? report.blockers : [])
  ];
  const hit = rows.find((row) => CMB_REQUESTED_FILL_FAIL_CLOSED_REASONS.includes(row?.reason));
  if (hit) return hit.reason;
  if (report?.birthDateHint?.reason === 'datepicker_hint_only') return 'datepicker_hint_only';
  if (CMB_REQUESTED_FILL_FAIL_CLOSED_REASONS.includes(report?.reason)) return report.reason;
  const blocker = Array.isArray(report?.blockers) ? report.blockers.find(Boolean) : null;
  if (blocker) return typeof blocker.reason === 'string' && blocker.reason ? blocker.reason : 'cmb_fill_partial';
  return null;
}

/**
 * Keep a reported Save/submit claim. Do not drop requested blockers so the
 * remaining rows can look complete.
 */
export function sealCmbRequestedFill(report, plan) {
  const blocked = cmbRequestedFillBlockers(plan);
  if (!blocked.length || !report || typeof report !== 'object') return report;
  const results = Array.isArray(report.results) ? report.results.slice() : [];
  for (const row of blocked) {
    if (results.some((item) => item && (row.path ? item.path === row.path : item.label === row.label))) continue;
    results.push({
      label: row.label || '',
      path: row.path || null,
      ok: false,
      reason: row.reason,
      before: '',
      after: '',
      expected: row.value || '',
      saved: false,
      skippedSave: true,
      writeAttempted: false
    });
  }
  const hinted = blocked.some((row) => row.reason === 'datepicker_hint_only');
  return {
    ...report,
    ok: false,
    reason: report.ok === false && typeof report.reason === 'string' && report.reason
      ? report.reason
      : blocked[0].reason,
    results,
    blockers: [...(Array.isArray(report.blockers) ? report.blockers : []), ...blocked],
    ...(hinted && !report.birthDateHint ? {
      birthDateHint: { reason: 'datepicker_hint_only', saveAllowed: false, saved: false, skippedSave: true, writeAttempted: false }
    } : {})
  };
}

/** Ambiguous, unsupported, or unsettled fill outcomes stay pending review. */
export function cmbOutcomeKeepsPendingReview(reason) {
  return reason === 'cmb_basic_status_unsettled'
    || reason === 'cmb_save_policy_violation'
    || reason === 'cmb_live_support_unverified'
    || reason === 'wrong_page'
    || reason === 'cmb_fill_partial'
    || CMB_REQUESTED_FILL_FAIL_CLOSED_REASONS.includes(reason)
    || EXPLICIT_UNSETTLED_REASONS.has(reason);
}

/**
 * Fail-closed reading of a cmb-basic fill body.
 * ok requires siteId cmb, skippedSave, and a non-empty list of verified rows.
 * A requested ambiguous, unsupported, or unsettled field is failed, not skipped.
 * A Save/submit/delete or saved/submitted claim is kept and is not ok.
 * ok:true with no verified rows is unsettled.
 */
export function assessCmbFillReport(report) {
  const claims = cmbReportClaims(report);
  const claimed = Object.values(claims).some(Boolean) || report?.skippedSave !== true;
  const results = Array.isArray(report?.results) ? report.results : [];
  const closed = failClosedReason(report);
  const rowsVerified = report?.ok === true && results.length > 0 && results.every(rowVerified) && !closed;
  const isolated = report?.siteId === SITE_ID;
  const wrongPage = report?.onCmbResumeEdit === false || report?.reason === 'wrong_page'
    || (typeof report?.href === 'string' && !isCmbResumeEditPage(report.href))
    || (report?.ok === true && !isCmbResumeEditPage(report?.href));
  const reason = claimed
    ? 'cmb_save_policy_violation'
    : !isolated
      ? 'cmb_site_isolation'
      : wrongPage
        ? 'wrong_page'
        : cmbReportRecords(report).some((row) => row?.liveSupportClaimed === true)
          ? 'cmb_live_support_unverified'
          : closed
            ? closed
            : !rowsVerified
              ? (report?.ok === true ? 'cmb_basic_status_unsettled' : (report?.reason || 'cmb_fill_partial'))
              : null;
  return {
    state: reason ? 'failed' : 'completed',
    reason,
    writeStarted: report?.writeAttempted === true,
    ...claims,
    skippedSave: report?.skippedSave === true && !claimed,
    results,
    isolated,
    rowsVerified
  };
}

function cmbFieldFromResult(row) {
  const ok = row?.ok === true;
  const before = row?.before ?? '';
  const after = row?.after ?? '';
  const expected = row?.expected ?? after;
  const same = ok && before === after && after === expected;
  const label = typeof row?.label === 'string' ? row.label : '';
  const reason = ok
    ? ((row?.reason === 'matched' || !row?.reason) ? (same ? 'preexisting_same_value' : 'readback_matched') : row.reason)
    : (row?.reason || 'readback_mismatch');
  return {
    id: `cmb:${label || 'field'}`,
    labels: [label],
    path: typeof row?.path === 'string' && row.path ? row.path : (CMB_LABEL_PATH[label] || null),
    status: ok ? 'verified' : 'failed',
    reason
  };
}

export function cmbProbeView(report) {
  const labels = Array.isArray(report?.labels) ? report.labels : [];
  const fields = labels.map((row) => {
    const ready = row?.found === true && row?.hasTextControl === true;
    const label = typeof row?.label === 'string' ? row.label : '';
    return {
      id: `cmb:${label || 'field'}`,
      labels: [label],
      path: CMB_LABEL_PATH[label] || null,
      status: ready ? 'identified' : 'failed',
      reason: ready ? 'ready' : (row?.found ? 'control_not_found' : 'item_not_found')
    };
  });
  return {
    url: typeof report?.href === 'string' ? report.href : '',
    title: typeof report?.title === 'string' && report.title ? report.title : '招商银行简历',
    siteId: SITE_ID,
    cmbBasic: true,
    liveSupportClaimed: false,
    saved: false,
    skippedSave: true,
    softwareClickedSave: false,
    softwareClickedSubmit: false,
    fields
  };
}

export function cmbFillView(report) {
  const fields = (Array.isArray(report?.results) ? report.results : []).map(cmbFieldFromResult);
  return {
    url: typeof report?.href === 'string' ? report.href : '',
    title: typeof report?.title === 'string' && report.title ? report.title : '招商银行简历',
    siteId: SITE_ID,
    cmbBasic: true,
    liveSupportClaimed: false,
    saved: report?.saved === true,
    skippedSave: report?.skippedSave === true,
    softwareClickedSave: report?.softwareClickedSave === true,
    softwareClickedSubmit: report?.softwareClickedSubmit === true,
    fields
  };
}

/** Popup inspect/fill decision. Never treats an unsettled or save-claiming body as complete. */
export function cmbPopupOutcome(report, mode = 'inspect') {
  if (mode === 'fill') {
    if (!report || typeof report !== 'object') {
      return { ok: false, reason: 'cmb_fill_empty_response', fillNotStarted: true, writeStarted: false };
    }
    const assessed = assessCmbFillReport(report);
    if (assessed.state !== 'completed') {
      // Unsettled or a save claim stays pending even when writeAttempted is false:
      // the popup must not clear the review marker or present a completed fill.
      const settledBeforeWrite = assessed.writeStarted !== true
        && !cmbOutcomeKeepsPendingReview(assessed.reason)
        && !assessed.results.length
        && !(Array.isArray(report.blockers) && report.blockers.some(Boolean));
      return {
        ok: false,
        reason: assessed.reason,
        fillNotStarted: settledBeforeWrite,
        writeStarted: assessed.writeStarted === true
      };
    }
    return { ok: true, view: cmbFillView(report), fillNotStarted: false, writeStarted: assessed.writeStarted };
  }
  if (!report || typeof report !== 'object' || report.siteId !== SITE_ID) {
    return { ok: false, reason: 'cmb_site_isolation', fillNotStarted: true, helpNeeded: false };
  }
  if (Object.values(cmbReportClaims(report)).some(Boolean) || report.skippedSave !== true) {
    return { ok: false, reason: 'cmb_save_policy_violation', fillNotStarted: true, helpNeeded: false };
  }
  const href = typeof report.href === 'string' ? report.href : '';
  const onEdit = isCmbResumeEditPage(href) && report.onCmbResumeEdit !== false;
  if (!onEdit || report.reason === 'wrong_page') {
    return { ok: false, reason: 'wrong_page', fillNotStarted: true, helpNeeded: true };
  }
  const liveClaimed = cmbReportRecords(report).some((row) => row?.liveSupportClaimed === true);
  if (liveClaimed || report.ok !== true) {
    return { ok: false, reason: liveClaimed ? 'cmb_live_support_unverified'
      : (report.reason || 'cmb_probe_unsettled'), fillNotStarted: true, helpNeeded: false };
  }
  return { ok: true, view: cmbProbeView(report), fillNotStarted: true, helpNeeded: false };
}

function probePageFunc() {
  const isHost = (hostname) => String(hostname || '').toLowerCase() === 'career.cmbchina.com';
  const href = location.href;
  let hostname = '';
  let pathname = '';
  try {
    const u = new URL(href);
    hostname = u.hostname;
    pathname = u.pathname;
  } catch { /* ignore */ }
  const looksLogin = /login|sso|auth|signin|passport|oauth|cas/i.test(href)
    || /登录|统一认证|扫码/u.test(document.title || '')
    || !!document.querySelector('input[type=password],.login-form,#login');
  const onResume = pathname === '/center/resume' || pathname.startsWith('/center/resume/');
  if (!isHost(hostname) || !onResume) {
    return {
      ok: false,
      reason: looksLogin ? 'cmb_login_or_wrong_page' : 'cmb_wrong_page',
      href,
      readyState: document.readyState,
      visible: document.visibilityState,
      looksLogin
    };
  }
  if (document.readyState !== 'complete') {
    return { ok: false, reason: 'cmb_page_loading', href, readyState: document.readyState, visible: document.visibilityState };
  }
  // Same CSS-confirmed contract as src/content/cmb-basic.js and tests/fixtures/cmb-basic-form.html.
  const need = ['姓名', '手机号', '邮箱'];
  const clean = (value) => String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/gu, '')
    .replace(/[\s\u00a0]+/gu, ' ')
    .trim()
    .replace(/^\*\s*/u, '')
    .replace(/\s*\*$/u, '')
    .replace(/[：:]\s*$/u, '')
    .trim();
  const items = [...document.querySelectorAll('.ant-form-item')];
  const labels = items.map((item) => clean(item.querySelector('.ant-form-item-label, label')?.textContent || '')).filter(Boolean);
  const found = need.filter((name) => labels.includes(name));
  const html = document.documentElement?.innerHTML || '';
  const looksCmb = /career\.cmbchina\.com|\/static\/js\/main\./i.test(html) || !!document.getElementById('root');
  const birthNodes = [...document.querySelectorAll('[id="resume_basicInfo_birthday"]')];
  return {
    ok: found.length >= 3,
    reason: found.length >= 3
      ? 'cmb_page_ready'
      : (looksLogin ? 'cmb_login_or_wrong_page' : (looksCmb ? 'cmb_shell_no_form' : 'cmb_labels_incomplete')),
    href,
    readyState: document.readyState,
    visible: document.visibilityState,
    labelCount: labels.length,
    foundLabels: found,
    looksLogin,
    looksCmb,
    title: document.title || '',
    birthDatePicker: {
      count: birthNodes.length,
      input: birthNodes.length === 1 && birthNodes[0].tagName === 'INPUT'
    }
  };
}

export function createCmbBasicAutoRunner({ api = globalThis.chrome, verifyBeforeFill = null, timeoutMs = 90000, lifecycleOptions = {} } = {}) {
  const get = async (key) => (await api.storage.local.get(key))[key];
  const autoPageUrl = () => api.runtime.getURL('src/auto/cmb-basic-auto.html');
  const trustedUi = (sender) => {
    if (sender?.id !== api.runtime.id || typeof sender.url !== 'string') return false;
    const url = sender.url.split('?')[0].split('#')[0];
    return url === autoPageUrl();
  };
  const bounded = (work, ms = timeoutMs) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('cmb_basic_auto_timeout')), ms);
    Promise.resolve().then(work).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
  const license = async () => {
    const paid = api.runtime.getManifest?.().background?.service_worker === 'src/license/guard-worker.mjs';
    if (paid && typeof verifyBeforeFill !== 'function') fail('license_required');
    if (verifyBeforeFill) {
      try { await bounded(verifyBeforeFill, 15000); } catch { fail('license_required'); }
    }
  };
  const assertHostPermission = () => {
    if (!cmbHostPermissionGranted(api.runtime.getManifest?.())) fail('cmb_host_permission_missing');
  };

  async function findTab(excludeTabId = null, { openIfMissing = false, page = SAMPLE_PAGE } = {}) {
    const tabs = await api.tabs.query({});
    const exact = tabs.filter((tab) => typeof tab.url === 'string' && isCmbTabUrl(tab.url) && tab.id !== excludeTabId);
    if (exact.length === 1) return { tab: exact[0], kind: 'exact' };
    if (exact.length > 1) {
      const ranked = [...exact].sort((a, b) => ((b.lastAccessed || 0) - (a.lastAccessed || 0)) || ((b.id || 0) - (a.id || 0)));
      return { tab: ranked.find((tab) => tab.active) || ranked[0], kind: 'exact_multi' };
    }
    const related = tabs.filter((tab) => typeof tab.url === 'string' && tab.id !== excludeTabId && /career\.cmbchina\.com/u.test(tab.url));
    if (related.length) {
      const err = Error('cmb_basic_login_or_wrong_page');
      err.helpUrl = related[0].url;
      err.helpReason = 'CMB resume edit tab not open; related tab may need login';
      throw err;
    }
    if (openIfMissing) {
      const created = await api.tabs.create({ url: page, active: true });
      for (let i = 0; i < 30; i += 1) {
        await sleep(500);
        const tab = await api.tabs.get(created.id);
        if (isCmbTabUrl(tab.url) && tab.status === 'complete') return { tab, kind: 'opened' };
        if (typeof tab.url === 'string' && /career\.cmbchina\.com/u.test(tab.url) && !isCmbTabUrl(tab.url)) {
          const err = Error('cmb_basic_login_or_wrong_page');
          err.helpUrl = tab.url;
          err.helpReason = 'Opened CMB URL redirected off the resume edit path; login likely required';
          throw err;
        }
      }
      const tab = await api.tabs.get(created.id);
      if (isCmbTabUrl(tab.url)) return { tab, kind: 'opened_partial' };
      const err = Error('cmb_basic_login_or_wrong_page');
      err.helpUrl = tab.url || page;
      err.helpReason = 'Opened CMB portal but did not settle on /center/resume';
      throw err;
    }
    fail('cmb_basic_tab_missing');
  }

  async function focusTab(tab) {
    await api.tabs.update(tab.id, { active: true });
    if (Number.isSafeInteger(tab.windowId) && api.windows?.update) {
      try { await api.windows.update(tab.windowId, { focused: true }); } catch { /* ignore */ }
    }
  }

  async function probe(tabId) {
    const replies = await bounded(() => api.scripting.executeScript({
      target: { tabId },
      func: probePageFunc
    }), 20000);
    return replies?.[0]?.result || { ok: false, reason: 'cmb_probe_empty' };
  }

  async function collectReadiness(tab, probeResult) {
    const raw = await get('resumeProfile');
    const plan = planCmbBasicFromProfile(raw, probeResult?.birthDatePicker);
    const binding = await captureProfileBinding(api.storage.local, lifecycleOptions);
    return {
      pageState: probeResult.reason,
      page: probeResult,
      profilePlan: {
        ok: plan.ok === true,
        reason: plan.reason,
        readyCount: (plan.fields || []).filter((row) => row.ready).length,
        requestedFillBlocked: cmbRequestedFillBlockers(plan).length > 0,
        fillAllowed: plan.ok === true && cmbRequestedFillBlockers(plan).length === 0,
        complete: false,
        blockers: (plan.blockers || []).map((row) => ({
          label: row.label || null,
          path: row.path || null,
          reason: row.reason
        })),
        birthDate: plan.birthDateReadiness || cmbBirthDateReadinessView(plan)
      },
      profileBinding: binding,
      profileHash: binding?.profileHash || null,
      tabUrl: tab.url || null
    };
  }

  async function runFill(tab, readiness) {
    await license();
    const binding = readiness.profileBinding || await captureProfileBinding(api.storage.local, lifecycleOptions);
    await assertProfileBinding(api.storage.local, binding, lifecycleOptions);
    const raw = await get('resumeProfile');
    if (await canonicalProfileHash(raw, lifecycleOptions.cryptoImpl) !== binding.profileHash) fail('profile_binding_changed');
    const plan = planCmbBasicFromProfile(raw, readiness.page?.birthDatePicker);
    if (!plan.ok) fail(plan.reason || 'profile_fields_unavailable');
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const review = {
      tabId: tab.id,
      origin: 'https://career.cmbchina.com',
      at: Date.now(),
      requestId,
      kind: 'cmb_basic_auto',
      profileBinding: binding,
      pendingReviewRequired: true,
      auto: true
    };
    await bounded(() => dispatchBoundSource(
      api.storage.local,
      binding,
      () => api.scripting.executeScript({ target: { tabId: tab.id }, files: ['src/content/cmb-basic.js'] }),
      lifecycleOptions
    ), 15000);

    await requireAutoFormReady(api, tab.id);

    await withProfileBinding(
      api.storage.local,
      binding,
      () => api.storage.local.set({ [pendingKey(tab.id)]: review }),
      lifecycleOptions
    );

    const replies = await bounded(() => dispatchBoundSource(
      api.storage.local,
      binding,
      () => api.scripting.executeScript({
        target: { tabId: tab.id },
        func: (profile, profileBinding) => globalThis.ResumeCmbBasic.fillBasic({ profile, profileBinding }),
        args: [raw, binding]
      }),
      lifecycleOptions
    ), 60000);

    await assertProfileBinding(api.storage.local, binding, lifecycleOptions);
    const rawReport = replies?.[0]?.result;
    if (!rawReport || typeof rawReport !== 'object') fail('cmb_fill_empty_response');
    const report = sealCmbRequestedFill(rawReport, plan);
    const assessed = assessCmbFillReport(report);
    if (assessed.state === 'completed') {
      await withProfileBinding(
        api.storage.local,
        binding,
        () => api.storage.local.remove(pendingKey(tab.id)),
        lifecycleOptions
      );
    } else {
      await withProfileBinding(
        api.storage.local,
        binding,
        () => api.storage.local.set({
          [pendingKey(tab.id)]: { ...review, at: Date.now(), reason: assessed.reason, pendingReviewRequired: true }
        }),
        lifecycleOptions
      );
    }
    return {
      state: assessed.state,
      reason: assessed.reason,
      writeStarted: assessed.writeStarted,
      ...Object.fromEntries(NEVER_SAVE_CLAIMS.map((key) => [key, assessed[key]])),
      skippedSave: assessed.skippedSave,
      results: assessed.results,
      profileSource: report.profileSource || 'resumeProfile',
      href: report.href || tab.url || null
    };
  }

  async function auto(message, sender = null) {
    assertHostPermission();
    const mode = ['readiness', 'fill'].includes(message.mode) ? message.mode : 'readiness';
    const openIfMissing = message.openIfMissing === true;
    const target = resolveCmbTarget(message.targetPage);
    const report = {
      version: 1,
      kind: 'cmb_basic_auto',
      siteId: SITE_ID,
      mode,
      at: Date.now(),
      steps: [],
      helpNeeded: false,
      saveAttempted: false,
      writeAttempted: false,
      skippedSave: true,
      liveSupportClaimed: false,
      complete: false,
      pendingReviewRequired: false
    };
    const found = await findTab(sender?.tab?.id, { openIfMissing, page: target.page });
    report.steps.push({ find: found.kind, tabId: found.tab.id, url: found.tab.url || null });
    await focusTab(found.tab);
    report.formReadiness = await requireAutoFormReady(api, found.tab.id);
    report.steps.push('focused_cmb_tab');
    let probeResult = await probe(found.tab.id);
    if (!probeResult.ok) {
      for (let i = 0; i < 8 && !probeResult.ok; i += 1) {
        await sleep(500);
        probeResult = await probe(found.tab.id);
      }
    }
    report.steps.push({ probe: probeResult.reason, ok: probeResult.ok === true });
    if (!probeResult.ok) {
      const login = probeResult.looksLogin === true
        || /login_or_wrong_page|wrong_page|shell_no_form/u.test(probeResult.reason || '');
      if (login) {
        const err = Error('cmb_basic_login_or_wrong_page');
        err.helpUrl = probeResult.href || found.tab.url || target.page;
        err.helpReason = 'CMB resume form not ready; login or DOM harvest still needed';
        throw err;
      }
      fail(probeResult.reason || 'cmb_basic_probe_failed');
    }
    const readiness = await collectReadiness(found.tab, probeResult);
    report.readiness = {
      pageState: readiness.pageState,
      foundLabels: readiness.page?.foundLabels || [],
      profilePlan: readiness.profilePlan
    };
    report.tabId = found.tab.id;
    report.pageUrl = found.tab.url || null;

    if (mode === 'readiness') {
      report.ok = true;
      report.complete = false;
      report.pendingReviewRequired = false;
      await api.storage.local.set({ resumeCmbBasicAutoRun: report });
      return report;
    }

    const filled = await runFill(found.tab, readiness);
    report.writeAttempted = filled.writeStarted === true;
    for (const key of NEVER_SAVE_CLAIMS) report[key] = filled[key] === true;
    report.steps.push({ fill: filled.state, reason: filled.reason });
    report.softwareClickedSave = filled.softwareClickedSave === true;
    report.softwareClickedSubmit = filled.softwareClickedSubmit === true;
    report.softwareClickedDelete = filled.softwareClickedDelete === true;
    report.savedOnSite = filled.savedOnSite === true;
    report.submitted = filled.submitted === true;
    report.saved = filled.saved === true;
    report.skippedSave = filled.skippedSave === true;
    report.job = filled;
    report.fill = {
      ok: filled.state === 'completed',
      fieldCount: filled.results.length,
      matched: filled.results.filter((row) => row && row.ok).length
    };
    report.ok = filled.state === 'completed'
      && report.fill.ok === true
      && !report.softwareClickedSave
      && !report.softwareClickedSubmit
      && !report.softwareClickedDelete
      && !report.savedOnSite
      && !report.submitted
      && !report.saved;
    report.liveSupportClaimed = false;
    report.complete = false;
    report.pendingReviewRequired = filled.state !== 'completed';
    if (!report.ok) report.reason = filled.reason || 'cmb_fill_failed';
    await api.storage.local.set({ resumeCmbBasicAutoRun: report });
    return report;
  }

  const listener = (message, sender, sendResponse) => {
    if (message?.type !== 'CMB_BASIC_AUTO') return false;
    if (!trustedUi(sender)) {
      sendResponse({
        ok: false,
        reason: 'cmb_basic_wrong_sender',
        saveAttempted: false,
        writeAttempted: false,
        skippedSave: true,
        liveSupportClaimed: false
      });
      return false;
    }
    auto(message, sender).then(sendResponse, (error) => {
      const reason = safe(error);
      const helpUrl = error?.helpUrl || SAMPLE_PAGE;
      const help = reason === 'cmb_basic_login_or_wrong_page' || reason === 'cmb_basic_tab_missing';
      const payload = {
        ok: false,
        reason,
        ...autoFormReadinessFailure(error),
        helpNeeded: help,
        helpUrl,
        helpReason: error?.helpReason || (help ? HELP_HINT : ''),
        mode: message?.mode || 'readiness',
        saveAttempted: false,
        writeAttempted: false,
        skippedSave: true,
        liveSupportClaimed: false,
        at: Date.now(),
        version: 1,
        kind: 'cmb_basic_auto',
        siteId: SITE_ID
      };
      api.storage.local.set({ resumeCmbBasicAutoRun: payload }).catch(() => {});
      sendResponse(payload);
    });
    return true;
  };
  return { listener };
}

export function installCmbBasicAutoRunner(options = {}) {
  const runner = createCmbBasicAutoRunner(options);
  (options.api || globalThis.chrome).runtime.onMessage.addListener(runner.listener);
  return runner;
}
