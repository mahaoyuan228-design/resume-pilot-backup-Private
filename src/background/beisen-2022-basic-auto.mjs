// Beisen-2022 basic auto (tiny). Mirror CITICS_BASIC_AUTO / FEISHU_ATSX_BASIC_AUTO shape.
// Fill-without-save only. Never clicks 保存/提交/投递. Isolated siteId: beisen-2022.
// Live resume edit path is login-walled; host match only (*.zhiye.com). Not Beisen-legacy.
import {captureProfileBinding,assertProfileBinding,canonicalProfileHash,
  dispatchBoundSource} from '../profile/profile-lifecycle.js';
import {planBeisen2022BasicFromProfile,isBeisen2022Host} from '../content/beisen-2022-profile-map.mjs';

const SITE_ID = 'beisen-2022';
const SAMPLE_PAGE = 'https://junlebaoruye.zhiye.com/';
const HELP_HINT = '我需要帮助！请打开已登录的北森 portal-2022 简历编辑页（如 junlebaoruye.zhiye.com）';
const fail = (reason) => { throw Error(reason); };
const safe = (error) => {
  const value = typeof error === 'string' ? error : (error?.message || '');
  return typeof value === 'string' && /^[a-z0-9_]{2,100}$/u.test(value) ? value : 'beisen_2022_basic_auto_failed';
};
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** Fail-closed host/page resolver. Optional message.targetPage must be https on *.zhiye.com. */
export function resolveBeisen2022Target(targetPage) {
  if (targetPage === undefined || targetPage === null || targetPage === '') {
    return { page: SAMPLE_PAGE, host: 'junlebaoruye.zhiye.com', sample: true };
  }
  if (typeof targetPage !== 'string' || targetPage.length > 300) fail('beisen_2022_page_invalid');
  let u;
  try { u = new URL(targetPage); } catch { fail('beisen_2022_page_invalid'); }
  if (u.protocol !== 'https:') fail('beisen_2022_page_invalid');
  if (!isBeisen2022Host(u.hostname)) fail('beisen_2022_page_invalid');
  if (u.username || u.password || u.port) fail('beisen_2022_page_invalid');
  return { page: `${u.origin}${u.pathname}${u.search}${u.hash}`, host: u.hostname.toLowerCase(), sample: false };
}

export function isBeisen2022TabUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && isBeisen2022Host(u.hostname);
  } catch {
    return false;
  }
}

function probePageFunc() {
  const isHost = (hostname) => {
    const host = String(hostname || '').toLowerCase();
    if (!host) return false;
    return host === 'zhiye.com' || host.endsWith('.zhiye.com');
  };
  const href = location.href;
  let hostname = '';
  try { hostname = new URL(href).hostname; } catch { /* ignore */ }
  const looksLogin = /login|sso|auth|signin|passport|oauth|cas/i.test(href)
    || /登录|统一认证|扫码/u.test(document.title || '')
    || !!document.querySelector('input[type=password],.login-form,#login');
  if (!isHost(hostname)) {
    return { ok: false, reason: 'beisen_2022_wrong_page', href, readyState: document.readyState, visible: document.visibilityState, looksLogin };
  }
  if (document.readyState !== 'complete') {
    return { ok: false, reason: 'beisen_2022_page_loading', href, readyState: document.readyState, visible: document.visibilityState };
  }
  const need = ['姓名', '手机号码', '邮箱'];
  const items = [...document.querySelectorAll('.bs-form-item')];
  const labels = items.map((item) => {
    const label = item.querySelector('.bs-form-item-label, label');
    return String(label?.textContent || '').replace(/[\s\u00a0＊*：:]+/gu, ' ').trim();
  }).filter(Boolean);
  const found = need.filter((name) => labels.some((label) => label === name || label.startsWith(name)));
  const html = document.documentElement?.innerHTML || '';
  const looksPortal2022 = /ux-recruitment-portal-2022|recruitment-portal-2022/i.test(html);
  const looksLegacy = /CmsPortal|cms-portal/i.test(html);
  return {
    ok: found.length >= 3,
    reason: found.length >= 3 ? 'beisen_2022_page_ready' : (looksLogin ? 'beisen_2022_login_or_wrong_page' : (looksLegacy ? 'beisen_2022_legacy_shell' : (looksPortal2022 ? 'beisen_2022_shell_no_form' : 'beisen_2022_labels_incomplete'))),
    href,
    readyState: document.readyState,
    visible: document.visibilityState,
    labelCount: labels.length,
    foundLabels: found,
    looksLogin,
    looksPortal2022,
    looksLegacy,
    title: document.title || ''
  };
}

export function createBeisen2022BasicAutoRunner({ api = globalThis.chrome, verifyBeforeFill = null, timeoutMs = 90000, lifecycleOptions = {} } = {}) {
  const get = async (key) => (await api.storage.local.get(key))[key];
  const autoPageUrl = () => api.runtime.getURL('src/auto/beisen-2022-basic-auto.html');
  const trustedUi = (sender) => {
    if (sender?.id !== api.runtime.id || typeof sender.url !== 'string') return false;
    const url = sender.url.split('?')[0].split('#')[0];
    return url === autoPageUrl();
  };
  const bounded = (work, ms = timeoutMs) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('beisen_2022_basic_auto_timeout')), ms);
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

  async function findTab(excludeTabId = null, { openIfMissing = false, page = SAMPLE_PAGE } = {}) {
    const tabs = await api.tabs.query({});
    const exact = tabs.filter((tab) => typeof tab.url === 'string' && isBeisen2022TabUrl(tab.url) && tab.id !== excludeTabId);
    if (exact.length === 1) return { tab: exact[0], kind: 'exact' };
    if (exact.length > 1) {
      const ranked = [...exact].sort((a, b) => ((b.lastAccessed || 0) - (a.lastAccessed || 0)) || ((b.id || 0) - (a.id || 0)));
      return { tab: ranked.find((tab) => tab.active) || ranked[0], kind: 'exact_multi' };
    }
    const related = tabs.filter((tab) => typeof tab.url === 'string' && tab.id !== excludeTabId && /zhiye\.com/u.test(tab.url));
    if (related.length) {
      const err = Error('beisen_2022_basic_login_or_wrong_page');
      err.helpUrl = related[0].url;
      err.helpReason = 'Beisen-2022 host tab not open; related tab may need login';
      throw err;
    }
    if (openIfMissing) {
      const created = await api.tabs.create({ url: page, active: true });
      for (let i = 0; i < 30; i += 1) {
        await sleep(500);
        const tab = await api.tabs.get(created.id);
        if (isBeisen2022TabUrl(tab.url) && tab.status === 'complete') return { tab, kind: 'opened' };
        if (typeof tab.url === 'string' && /zhiye\.com/u.test(tab.url) && !isBeisen2022TabUrl(tab.url)) {
          const err = Error('beisen_2022_basic_login_or_wrong_page');
          err.helpUrl = tab.url;
          err.helpReason = 'Opened zhiye URL redirected off host; login likely required';
          throw err;
        }
      }
      const tab = await api.tabs.get(created.id);
      if (isBeisen2022TabUrl(tab.url)) return { tab, kind: 'opened_partial' };
      const err = Error('beisen_2022_basic_login_or_wrong_page');
      err.helpUrl = tab.url || page;
      err.helpReason = 'Opened Beisen portal but did not settle on zhiye host';
      throw err;
    }
    fail('beisen_2022_basic_tab_missing');
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
    return replies?.[0]?.result || { ok: false, reason: 'beisen_2022_probe_empty' };
  }

  async function collectReadiness(tab, probeResult) {
    const raw = await get('resumeProfile');
    const plan = planBeisen2022BasicFromProfile(raw);
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

  async function prepareForm(tab) {
    await license();
    const binding = await captureProfileBinding(api.storage.local, lifecycleOptions);
    const raw = await get('resumeProfile');
    if (await canonicalProfileHash(raw, lifecycleOptions.cryptoImpl) !== binding.profileHash) fail('profile_binding_changed');
    const plan = planBeisen2022BasicFromProfile(raw);
    if (!plan.ok) fail(plan.reason || 'profile_fields_unavailable');
    await bounded(() => dispatchBoundSource(api.storage.local, binding,
      () => api.scripting.executeScript({ target: { tabId: tab.id },
        files: ['src/content/controls/resume-form.js', 'src/content/beisen-2022-basic.js'] }), lifecycleOptions), 15000);
    const replies = await bounded(() => dispatchBoundSource(api.storage.local, binding,
      () => api.scripting.executeScript({ target: { tabId: tab.id },
        func: profileBinding => globalThis.ResumeBeisen2022Basic.prepareForm({ readinessTimeoutMs: 2000, profileBinding }),
        args: [binding],
      }), lifecycleOptions), 10000);
    await assertProfileBinding(api.storage.local, binding, lifecycleOptions);
    return replies?.[0]?.result || { ok: false, status: 'unsupported', reason: 'form_not_ready', writeAttempted: false };
  }

  async function runFill(tab, readiness) {
    await license();
    const binding = readiness.profileBinding || await captureProfileBinding(api.storage.local, lifecycleOptions);
    await assertProfileBinding(api.storage.local, binding, lifecycleOptions);
    const raw = await get('resumeProfile');
    if (await canonicalProfileHash(raw, lifecycleOptions.cryptoImpl) !== binding.profileHash) fail('profile_binding_changed');
    const plan = planBeisen2022BasicFromProfile(raw);
    if (!plan.ok) fail(plan.reason || 'profile_fields_unavailable');

    await bounded(() => dispatchBoundSource(
      api.storage.local,
      binding,
      () => api.scripting.executeScript({ target: { tabId: tab.id }, files: ['src/content/controls/resume-form.js', 'src/content/beisen-2022-basic.js'] }),
      lifecycleOptions
    ), 15000);

    const replies = await bounded(() => dispatchBoundSource(
      api.storage.local,
      binding,
      () => api.scripting.executeScript({
        target: { tabId: tab.id },
        func: (profile, profileBinding) => globalThis.ResumeBeisen2022Basic.fillBasic({ profile, profileBinding }),
        args: [raw, binding]
      }),
      lifecycleOptions
    ), 60000);

    await assertProfileBinding(api.storage.local, binding, lifecycleOptions);
    const report = replies?.[0]?.result;
    if (!report || typeof report !== 'object') fail('beisen_2022_fill_empty_response');
    if (report.siteId && report.siteId !== SITE_ID) fail('beisen_2022_site_isolation');
    if (report.saved === true || report.skippedSave !== true) fail('beisen_2022_save_policy_violation');
    return {
      state: report.ok === true ? 'completed' : 'failed',
      reason: report.ok === true ? null : (report.reason || 'beisen_2022_fill_partial'),
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
    const mode = ['readiness', 'fill'].includes(message.mode) ? message.mode : 'fill';
    const openIfMissing = message.openIfMissing !== false;
    const target = resolveBeisen2022Target(message.targetPage);
    const report = {
      version: 1,
      kind: 'beisen_2022_basic_auto',
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
    report.steps.push('focused_beisen_2022_tab');
    if (mode === 'fill') {
      report.preparation = await prepareForm(found.tab);
      if (!report.preparation.ok) {
        report.ok = false;
        report.status = report.preparation.status || 'unsupported';
        report.reason = report.preparation.reason || 'form_not_ready';
        await api.storage.local.set({ resumeBeisen2022BasicAutoRun: report });
        return report;
      }
    }
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
        || /login_or_wrong_page|wrong_page|shell_no_form|legacy_shell/u.test(probeResult.reason || '');
      if (login) {
        const err = Error('beisen_2022_basic_login_or_wrong_page');
        err.helpUrl = probeResult.href || found.tab.url || target.page;
        err.helpReason = 'Beisen-2022 resume form not ready; login or DOM harvest still needed';
        throw err;
      }
      fail(probeResult.reason || 'beisen_2022_basic_probe_failed');
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
      await api.storage.local.set({ resumeBeisen2022BasicAutoRun: report });
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
    if (!report.ok) report.reason = filled.reason || 'beisen_2022_fill_failed';
    await api.storage.local.set({ resumeBeisen2022BasicAutoRun: report });
    return report;
  }

  const listener = (message, sender, sendResponse) => {
    if (message?.type !== 'BEISEN_2022_BASIC_AUTO') return false;
    if (!trustedUi(sender)) {
      sendResponse({ ok: false, reason: 'beisen_2022_basic_wrong_sender' });
      return false;
    }
    auto(message, sender).then(sendResponse, (error) => {
      const reason = safe(error);
      const helpUrl = error?.helpUrl || SAMPLE_PAGE;
      const help = reason === 'beisen_2022_basic_login_or_wrong_page' || reason === 'beisen_2022_basic_tab_missing';
      const payload = {
        ok: false,
        reason,
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
        kind: 'beisen_2022_basic_auto',
        siteId: SITE_ID
      };
      api.storage.local.set({ resumeBeisen2022BasicAutoRun: payload }).catch(() => {});
      sendResponse(payload);
    });
    return true;
  };
  return { listener };
}

export function installBeisen2022BasicAutoRunner(options = {}) {
  const runner = createBeisen2022BasicAutoRunner(options);
  (options.api || globalThis.chrome).runtime.onMessage.addListener(runner.listener);
  return runner;
}
