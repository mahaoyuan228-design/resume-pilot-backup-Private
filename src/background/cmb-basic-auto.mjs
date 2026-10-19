// CMB (招商银行 career.cmbchina.com) basic auto. Mirror MOKA/CMS basic-auto shape.
// Fill-without-save only. Never clicks 保存/提交/投递. Isolated siteId: cmb.
// Trial Edge injects per tab via scripting; host match is manifest host_permissions.
// Missing that match fails closed before any tab or script work. 招行 is not supported.
import {captureProfileBinding,assertProfileBinding,canonicalProfileHash,
  dispatchBoundSource} from '../profile/profile-lifecycle.js';
import {planCmbBasicFromProfile,isCmbHost,isCmbResumeEditPath} from '../content/cmb-profile-map.mjs';

const SITE_ID = 'cmb';
const SAMPLE_PAGE = 'https://career.cmbchina.com/center/resume';
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
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && isCmbHost(u.hostname) && isCmbResumeEditPath(u.pathname);
  } catch {
    return false;
  }
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
    title: document.title || ''
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
    const plan = planCmbBasicFromProfile(raw);
    const binding = await captureProfileBinding(api.storage.local, lifecycleOptions);
    return {
      pageState: probeResult.reason,
      page: probeResult,
      profilePlan: {
        ok: plan.ok === true,
        reason: plan.reason,
        readyCount: (plan.fields || []).filter((row) => row.ready).length,
        blockers: (plan.blockers || []).map((row) => ({
          label: row.label || null,
          path: row.path || null,
          reason: row.reason
        }))
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
    const plan = planCmbBasicFromProfile(raw);
    if (!plan.ok) fail(plan.reason || 'profile_fields_unavailable');

    await bounded(() => dispatchBoundSource(
      api.storage.local,
      binding,
      () => api.scripting.executeScript({ target: { tabId: tab.id }, files: ['src/content/cmb-basic.js'] }),
      lifecycleOptions
    ), 15000);

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
    const report = replies?.[0]?.result;
    if (!report || typeof report !== 'object') fail('cmb_fill_empty_response');
    if (report.siteId && report.siteId !== SITE_ID) fail('cmb_site_isolation');
    if (report.saved === true || report.skippedSave !== true || report.softwareClickedSave === true) fail('cmb_save_policy_violation');
    return {
      state: report.ok === true ? 'completed' : 'failed',
      reason: report.ok === true ? null : (report.reason || 'cmb_fill_partial'),
      writeStarted: report.writeAttempted === true,
      softwareClickedSave: false,
      softwareClickedSubmit: false,
      saved: false,
      results: Array.isArray(report.results) ? report.results : [],
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
      liveSupportClaimed: false
    };
    const found = await findTab(sender?.tab?.id, { openIfMissing, page: target.page });
    report.steps.push({ find: found.kind, tabId: found.tab.id, url: found.tab.url || null });
    await focusTab(found.tab);
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
      await api.storage.local.set({ resumeCmbBasicAutoRun: report });
      return report;
    }

    const filled = await runFill(found.tab, readiness);
    report.writeAttempted = filled.writeStarted === true;
    report.steps.push({ fill: filled.state, reason: filled.reason });
    report.job = filled;
    report.fill = {
      ok: filled.state === 'completed',
      fieldCount: filled.results.length,
      matched: filled.results.filter((row) => row.ok).length
    };
    report.ok = filled.state === 'completed';
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
