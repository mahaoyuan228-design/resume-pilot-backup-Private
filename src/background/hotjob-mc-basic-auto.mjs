// ATS auto fills the current page with the shared engine; page probes are advisory.
// Fill-without-save only. Never clicks 下一步/保存/提交. Isolated siteId: hotjob-mc.
// Host validation protects URL isolation; a differing form path is advisory.
import {requireAutoFormReady,autoFormReadinessFailure,appendAutoAdvisory as recordAutoAdvisory} from './auto-form-readiness.mjs';
import {captureProfileBinding,assertProfileBinding,canonicalProfileHash,
  dispatchBoundSource} from '../profile/profile-lifecycle.js';
import {planHotjobMcBasicFromProfile,isHotjobMcHost,isHotjobMcPath} from '../content/hotjob-mc-profile-map.mjs';

const SITE_ID = 'hotjob-mc';
const SAMPLE_SU = 'SU661f37091eb8053acd6cdf3d';
const SAMPLE_PAGE = `https://wecruit.hotjob.cn/${SAMPLE_SU}/mc/deliver/operationResumer`;
const HELP_HINT = '我需要帮助！请打开已登录的 hotjob mc 简历编辑页（如中联 /SU*/mc/deliver/operationResumer）';
const fail = (reason) => { throw Error(reason); };
const safe = (error) => {
  const value = typeof error === 'string' ? error : (error?.message || '');
  return typeof value === 'string' && /^[a-z0-9_]{2,100}$/u.test(value) ? value : 'hotjob_mc_basic_auto_failed';
};

/** Validate the target host; users open their own form page. */
export function resolveHotjobMcTarget(targetPage) {
  if (targetPage === undefined || targetPage === null || targetPage === '') {
    return { page: SAMPLE_PAGE, host: 'wecruit.hotjob.cn', su: SAMPLE_SU, sample: true };
  }
  if (typeof targetPage !== 'string' || targetPage.length > 400) fail('hotjob_mc_page_invalid');
  let u;
  try { u = new URL(targetPage); } catch { fail('hotjob_mc_page_invalid'); }
  if (u.protocol !== 'https:') fail('hotjob_mc_page_invalid');
  if (!isHotjobMcHost(u.hostname)) fail('hotjob_mc_page_invalid');
  if (u.username || u.password || u.port) fail('hotjob_mc_page_invalid');
  const suMatch = /^\/(SU[0-9A-Za-z]{8,64})\//u.exec(u.pathname);
  return {
    page: `${u.origin}${u.pathname}${u.search}${u.hash}`,
    host: u.hostname.toLowerCase(),
    su: suMatch ? suMatch[1] : null,
    sample: false,
    advisoryHints: isHotjobMcPath(u.pathname) ? [] : [{ reason: 'hotjob_mc_page_invalid', advisory: true, blocking: false }]
  };
}

export function isHotjobMcTabUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && isHotjobMcHost(u.hostname);
  } catch {
    return false;
  }
}

function probePageFunc() {
  const isHost = (hostname) => {
    const host = String(hostname || '').toLowerCase();
    if (!host) return false;
    return host === 'wecruit.hotjob.cn' || host === 'hotjob.cn' || host.endsWith('.hotjob.cn');
  };
  const isMcPath = (pathname) =>
    /^\/SU[0-9A-Za-z]{8,64}\/mc\/deliver\/operationResumer$/u.test(String(pathname || ''));
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
  if (!isHost(hostname) || !isMcPath(pathname)) {
    return { ok: false, reason: 'hotjob_mc_wrong_page', href, readyState: document.readyState, visible: document.visibilityState, looksLogin };
  }
  if (document.readyState !== 'complete') {
    return { ok: false, reason: 'hotjob_mc_page_loading', href, readyState: document.readyState, visible: document.visibilityState };
  }
  const need = ['姓名', '移动电话', '电子邮箱'];
  const clean = (raw) => String(raw || '').replace(/[\s\u00a0]+/gu, ' ').trim()
    .replace(/^\*\s*/u, '').replace(/\s*\*$/u, '').replace(/[：:]\s*$/u, '').trim();
  const items = [...document.querySelectorAll('.my-list-item')];
  const labels = items.map((item) => {
    const label = item.querySelector('.header-title');
    if (!label) return '';
    const clone = label.cloneNode(true);
    clone.querySelectorAll('span.iconfont, span, i, svg, em').forEach((child) => {
      const t = String(child.textContent || '').replace(/\s+/gu, '').trim();
      if (!t || t === '*' || t === '：' || child.classList?.contains('iconfont')) child.remove();
    });
    return clean(clone.textContent);
  }).filter(Boolean);
  const found = need.filter((name) => labels.some((label) => label === name || label.startsWith(name)));
  const titleNode = document.querySelector('.resume-info-title');
  const sectionTitle = clean(titleNode?.textContent || '');
  const looksMc = sectionTitle === '基本信息' || items.length > 0
    || /am-list|am-input|my-list-item/i.test(document.documentElement?.innerHTML || '');
  return {
    ok: found.length >= 3,
    reason: found.length >= 3 ? 'hotjob_mc_page_ready' : (looksLogin ? 'hotjob_mc_login_or_wrong_page' : (looksMc ? 'hotjob_mc_shell_no_form' : 'hotjob_mc_labels_incomplete')),
    href,
    readyState: document.readyState,
    visible: document.visibilityState,
    labelCount: labels.length,
    foundLabels: found,
    sectionTitle,
    looksLogin,
    looksMc,
    title: document.title || ''
  };
}

export function createHotjobMcBasicAutoRunner({ api = globalThis.chrome, verifyBeforeFill = null, timeoutMs = 90000, lifecycleOptions = {} } = {}) {
  const get = async (key) => (await api.storage.local.get(key))[key];
  const autoPageUrl = () => api.runtime.getURL('src/auto/hotjob-mc-basic-auto.html');
  const trustedUi = (sender) => {
    if (sender?.id !== api.runtime.id || typeof sender.url !== 'string') return false;
    const url = sender.url.split('?')[0].split('#')[0];
    return url === autoPageUrl();
  };
  const bounded = (work, ms = timeoutMs) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('hotjob_mc_basic_auto_timeout')), ms);
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

  async function findTab(excludeTabId = null) {
    // The user opens the editor. Never navigate to an edit/new-resume page.
    const tabs = await api.tabs.query({});
    const candidates = tabs.filter(tab => tab.id !== excludeTabId && isHotjobMcTabUrl(tab.url));
    const ranked = [...candidates].sort((a, b) => ((b.lastAccessed || 0) - (a.lastAccessed || 0)) || ((b.id || 0) - (a.id || 0)));
    const tab = ranked.find(row => row.active) || ranked[0];
    if (!tab) fail('hotjob_mc_basic_tab_missing');
    return { tab, kind: candidates.length > 1 ? 'exact_multi' : 'exact' };
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
    return replies?.[0]?.result || { ok: false, reason: 'hotjob_mc_probe_empty' };
  }

  async function collectReadiness(tab, probeResult) {
    const raw = await get('resumeProfile');
    const plan = planHotjobMcBasicFromProfile(raw);
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
      profileHash: binding?.profileHash || null
    };
  }


  async function runFill(tab, readiness) {
    await license();
    const binding = readiness.profileBinding || await captureProfileBinding(api.storage.local, lifecycleOptions);
    await assertProfileBinding(api.storage.local, binding, lifecycleOptions);
    const raw = await get('resumeProfile');
    if (await canonicalProfileHash(raw, lifecycleOptions.cryptoImpl) !== binding.profileHash) fail('profile_binding_changed');

    await bounded(() => dispatchBoundSource(
      api.storage.local,
      binding,
      () => api.scripting.executeScript({ target: { tabId: tab.id }, files: ['src/core/matcher.js', 'src/content/controls/resume-form.js', 'src/content/engine.js'] }),
      lifecycleOptions
    ), 15000);

    recordAutoAdvisory(readiness, await requireAutoFormReady(api, tab.id));

    const replies = await bounded(() => dispatchBoundSource(
      api.storage.local,
      binding,
      () => api.scripting.executeScript({
        target: { tabId: tab.id },
        func: (profile, profileBinding) => globalThis.ResumeQuickFillFillCurrentPage(profile, profileBinding),
        args: [raw, binding]
      }),
      lifecycleOptions
    ), 60000);

    await assertProfileBinding(api.storage.local, binding, lifecycleOptions);
    const response = replies?.[0]?.result;
    const report = response?.data ? { ...response, ...response.data } : response;
    if (!report || typeof report !== 'object') fail('hotjob_mc_fill_empty_response');
    if (report.saved === true || report.skippedSave !== true || report.saveAttempted === true
      || report.softwareClickedSave === true || report.softwareClickedSubmit === true
      || report.softwareClickedDelete === true || report.savedOnSite === true || report.submitted === true) fail('hotjob_mc_save_policy_violation');
    if (Array.isArray(report.advisoryHints)) recordAutoAdvisory(readiness, report);
    return {
      state: report.ok === true ? 'completed' : 'failed',
      reason: report.ok === true ? null : (report.reason || 'hotjob_mc_fill_partial'),
      writeStarted: report.writeStarted === true || report.writeAttempted === true,
      softwareClickedSave: false,
      softwareClickedSubmit: false,
      saved: false,
      advisoryHints: readiness.advisoryHints,
      results: Array.isArray(report.fields) ? report.fields : Array.isArray(report.results) ? report.results : [],
      profileSource: report.profileSource || 'resumeProfile',
      href: report.href || tab.url || null
    };
  }

  async function auto(message, sender = null) {
    const mode = ['readiness', 'fill'].includes(message.mode) ? message.mode : 'fill';
    const openIfMissing = message.openIfMissing !== false;
    const target = resolveHotjobMcTarget(message.targetPage);
    const report = {
      version: 1,
      kind: 'hotjob_mc_basic_auto',
      siteId: SITE_ID,
      mode,
      at: Date.now(),
      steps: [],
      helpNeeded: false,
      saveAttempted: false,
      writeAttempted: false,
      skippedSave: true,
      liveSupportClaimed: false,
      tenantSu: target.su || null
    };
    report.advisoryHints = [...(target.advisoryHints || [])];
    const found = await findTab(sender?.tab?.id, { openIfMissing, page: target.page });
    report.steps.push({ find: found.kind, tabId: found.tab.id, url: found.tab.url || null });
    await focusTab(found.tab);
    report.formReadiness = await requireAutoFormReady(api, found.tab.id);
    recordAutoAdvisory(report, report.formReadiness);
    report.steps.push('focused_hotjob_mc_tab');
    const probeResult = await probe(found.tab.id);
    report.steps.push({ probe: probeResult.reason, ok: probeResult.ok === true });
    recordAutoAdvisory(report, probeResult);
    const readiness = await collectReadiness(found.tab, probeResult);
    readiness.advisoryHints = report.advisoryHints;
    report.readiness = {
      pageState: readiness.pageState,
      foundLabels: readiness.page?.foundLabels || [],
      profilePlan: readiness.profilePlan
    };
    report.tabId = found.tab.id;
    report.pageUrl = found.tab.url || null;

    if (mode === 'readiness') {
      report.ok = true;
      await api.storage.local.set({ resumeHotjobMcBasicAutoRun: report });
      return report;
    }

    const filled = await runFill(found.tab, readiness);
    report.writeAttempted = filled.writeStarted === true;
    report.steps.push({ fill: filled.state, reason: filled.reason });
    report.job = filled;
    report.fill = {
      ok: filled.state === 'completed',
      fieldCount: filled.results.length,
      matched: filled.results.filter((row) => row.status === 'verified').length
    };
    report.ok = filled.state === 'completed';
    if (!report.ok) report.reason = filled.reason || 'hotjob_mc_fill_failed';
    await api.storage.local.set({ resumeHotjobMcBasicAutoRun: report });
    return report;
  }

  const listener = (message, sender, sendResponse) => {
    if (message?.type !== 'HOTJOB_MC_BASIC_AUTO') return false;
    if (!trustedUi(sender)) {
      sendResponse({ ok: false, reason: 'hotjob_mc_basic_wrong_sender' });
      return false;
    }
    auto(message, sender).then(sendResponse, (error) => {
      const reason = safe(error);
      const helpUrl = error?.helpUrl || SAMPLE_PAGE;
      const help = reason === 'hotjob_mc_basic_login_or_wrong_page' || reason === 'hotjob_mc_basic_tab_missing';
      const payload = {
        ok: false,
        reason,
        ...autoFormReadinessFailure(error),
        helpNeeded: help,
        helpUrl,
        helpReason: error?.helpReason || (help ? HELP_HINT : ''),
        mode: message?.mode || 'fill',
        saveAttempted: false,
        writeAttempted: false,
        skippedSave: true,
        liveSupportClaimed: false,
        at: Date.now(),
        version: 1,
        kind: 'hotjob_mc_basic_auto',
        siteId: SITE_ID
      };
      api.storage.local.set({ resumeHotjobMcBasicAutoRun: payload }).catch(() => {});
      sendResponse(payload);
    });
    return true;
  };
  return { listener };
}

export function installHotjobMcBasicAutoRunner(options = {}) {
  const runner = createHotjobMcBasicAutoRunner(options);
  (options.api || globalThis.chrome).runtime.onMessage.addListener(runner.listener);
  return runner;
}
