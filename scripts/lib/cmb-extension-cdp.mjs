// Drive the existing CMB_BASIC_AUTO page over loopback CDP. Never Save.
// Read its terminal #out packet, not chrome.storage or the recruitment DOM.
import { randomUUID } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import { connectCdp, getJson } from '../../tools/live-harvest/cdp-client.mjs';
import { isTimeout, StepTimeoutError } from '../../tools/live-harvest/errors.mjs';
import { resolveCmbTarget } from '../../src/background/cmb-basic-auto.mjs';

const AUTO_PATH = '/src/auto/cmb-basic-auto.html';
const EXT_ID = /^[a-p]{32}$/u;
const KNOWN_PATHS = new Set([
  AUTO_PATH, '/src/background/worker.mjs', '/src/license/guard-worker.mjs',
  '/src/popup/popup.html', '/src/profile/options.html'
]);

function fail(reason, exitCode = 3) {
  throw Object.assign(new Error(reason), { reason, exitCode });
}

function integer(value, max, reason) {
  if (!/^\d+$/u.test(String(value))) fail(reason);
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || n > max) fail(reason);
  return n;
}

export function cmbExtensionOptions(argv = [], env = process.env) {
  const values = {};
  let openIfMissing = env.OPEN_IF_MISSING ?? '0';
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--extension') continue;
    if (arg === '--open-if-missing') { openIfMissing = '1'; continue; }
    if (!['--port', '--extension-id', '--mode', '--timeout-ms', '--step-timeout-ms'].includes(arg)) {
      fail('cmb_extension_argument_invalid');
    }
    if (values[arg] !== undefined || !argv[i + 1] || argv[i + 1].startsWith('--')) {
      fail('cmb_extension_argument_invalid');
    }
    values[arg] = argv[++i];
  }
  const mode = values['--mode'] ?? env.MODE ?? 'readiness';
  if (!['readiness', 'fill'].includes(mode)) fail('cmb_extension_mode_invalid');
  const extensionId = values['--extension-id'] ?? env.RESUME_EXT_ID ?? null;
  if (extensionId !== null && !EXT_ID.test(extensionId)) fail('cmb_extension_id_invalid');
  if (!['0', '1'].includes(openIfMissing)) fail('cmb_extension_argument_invalid');
  let targetPage;
  try { targetPage = resolveCmbTarget(env.CMB_PAGE).page; }
  catch { fail('cmb_page_invalid'); }
  return {
    mode, extensionId, openIfMissing: openIfMissing === '1',
    port: integer(values['--port'] ?? env.CDP_PORT ?? '9237', 65535, 'cmb_extension_port_invalid'),
    timeoutMs: integer(values['--timeout-ms'] ?? env.AUTO_TIMEOUT_MS ?? '180000', 600000, 'cmb_extension_timeout_invalid'),
    stepTimeoutMs: integer(values['--step-timeout-ms'] ?? env.CDP_STEP_TIMEOUT_MS ?? '5000', 60000, 'cmb_extension_timeout_invalid'),
    targetPage
  };
}

function extensionUrl(target) {
  try {
    const url = new URL(target.url);
    return url.protocol === 'chrome-extension:' && EXT_ID.test(url.hostname) ? url : null;
  } catch { return null; }
}

function chooseExtension(targets, explicitId) {
  if (explicitId) return explicitId;
  const ids = new Set(targets.map(extensionUrl).filter((url) => url && KNOWN_PATHS.has(url.pathname)).map((url) => url.hostname));
  if (ids.size === 0) fail('cmb_extension_target_missing');
  if (ids.size > 1) fail('cmb_extension_target_ambiguous');
  return [...ids][0];
}

function loopbackSocket(value, port) {
  let url;
  try { url = new URL(value); } catch { fail('cmb_cdp_endpoint_invalid'); }
  if (url.protocol !== 'ws:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      || Number(url.port) !== port || url.username || url.password) fail('cmb_cdp_endpoint_invalid');
  return url.href;
}

function resultExitCode(result) {
  if (result.ok) return 0;
  if (result.reason === 'BG_NO_RESPONSE' || /timeout/u.test(result.reason || '')) return 1;
  if (['cmb_host_permission_missing', 'cmb_page_invalid', 'cmb_basic_wrong_sender',
    'extension_reload_required', 'cmb_site_isolation', 'cmb_save_policy_violation'].includes(result.reason)) return 3;
  return 2;
}

function validateResult(result, mode) {
  if ((!result.ok && typeof result.reason !== 'string')
      || (result.writeAttempted !== undefined && typeof result.writeAttempted !== 'boolean')) {
    fail('cmb_extension_result_invalid');
  }
  if (result.siteId && result.siteId !== 'cmb') fail('cmb_site_isolation');
  if (result.mode && result.mode !== mode) fail('cmb_extension_result_invalid');
  if (result.saved === true || result.saveAttempted === true || result.softwareClickedSave === true
      || result.softwareClickedSubmit === true || result.job?.saved === true
      || result.job?.softwareClickedSave === true || result.job?.softwareClickedSubmit === true) {
    fail('cmb_save_policy_violation');
  }
  if (result.ok && (result.siteId !== 'cmb' || result.kind !== 'cmb_basic_auto'
      || result.mode !== mode || result.saveAttempted !== false || result.skippedSave !== true
      || result.liveSupportClaimed !== false || typeof result.writeAttempted !== 'boolean'
      || (mode === 'readiness' && result.writeAttempted))) fail('cmb_extension_result_invalid');
}

export async function runCmbExtensionCdp({ argv = [], env = process.env } = {}) {
  const report = {
    version: 1, kind: 'cmb_extension_cdp', siteId: 'cmb', surface: 'extension-cdp',
    runId: randomUUID(), startedAt: new Date().toISOString(), mode: 'readiness',
    ok: false, reason: null, exitCode: 1, timedOut: false, steps: [],
    neverSave: true, saved: false, skippedSave: true, saveAttempted: false,
    supported: false, claimedSupported: false, liveSupportClaimed: false, formFillClaimed: false,
    writeAttempted: false, writeUnconfirmed: false, resultSource: 'auto-page-out',
    backgroundResult: null
  };
  const sessions = new Set();
  let config;
  let deadline;
  let step = 'configuration';
  let dispatched = false;
  const budget = () => {
    const left = deadline - Date.now();
    if (left <= 0) throw new StepTimeoutError(step);
    return Math.min(config.stepTimeoutMs, left);
  };
  const perform = async (name, work) => {
    step = name;
    try {
      const value = await work(budget());
      report.steps.push({ step: name, ok: true });
      return value;
    } catch (error) {
      report.steps.push({ step: name, ok: false, reason: isTimeout(error) ? 'timeout' : (error.reason || 'cdp_error') });
      throw error;
    }
  };
  const attach = async (url, name) => perform(name, async (timeoutMs) => {
    const session = await connectCdp(loopbackSocket(url, config.port), { timeoutMs, step: name });
    sessions.add(session);
    return session;
  });
  try {
    config = cmbExtensionOptions(argv, env);
    Object.assign(report, config);
    deadline = Date.now() + config.timeoutMs;
    let targets = await perform('target_list', (timeoutMs) => getJson(config.port, '/json/list', { timeoutMs, step }));
    if (!Array.isArray(targets)) fail('cmb_cdp_targets_invalid');
    const extensionId = chooseExtension(targets, config.extensionId);
    report.extensionId = extensionId;
    const ackMs = Math.min(15000, Math.max(100, Math.floor(config.timeoutMs / 10)));
    const responseMs = Math.min(160000, Math.max(100, config.timeoutMs - ackMs - 5000));
    const params = new URLSearchParams({
      mode: config.mode, openIfMissing: config.openIfMissing ? '1' : '0',
      targetPage: config.targetPage, runId: report.runId,
      bgAckTimeoutMs: String(ackMs), bgResponseTimeoutMs: String(responseMs)
    });
    report.autoUrl = `chrome-extension://${extensionId}${AUTO_PATH}?${params}`;
    let target = targets.find((t) => t.type === 'page' && extensionUrl(t)?.hostname === extensionId
      && extensionUrl(t)?.pathname === AUTO_PATH);
    let page;
    if (target) {
      report.targetAction = 'reused';
      page = await attach(target.webSocketDebuggerUrl, 'page_attach');
      // A fresh runId forces a new document. Old #out data cannot finish this run.
      dispatched = true;
      const navigation = await perform('auto_navigate', (timeoutMs) => page.send('Page.navigate', { url: report.autoUrl }, { timeoutMs, step }));
      if (navigation.errorText) fail('cmb_auto_navigation_failed', 1);
    } else {
      report.targetAction = 'created';
      const version = await perform('browser_version', (timeoutMs) => getJson(config.port, '/json/version', { timeoutMs, step }));
      const browser = await attach(version.webSocketDebuggerUrl, 'browser_attach');
      dispatched = true;
      const created = await perform('auto_create', (timeoutMs) => browser.send('Target.createTarget', { url: report.autoUrl }, { timeoutMs, step }));
      if (!created.targetId) fail('cmb_auto_target_missing', 1);
      report.targetId = created.targetId;
      // Target creation can precede the page's appearance in /json/list.
      while (!target) {
        targets = await perform('auto_target_list', (timeoutMs) => getJson(config.port, '/json/list', { timeoutMs, step }));
        if (!Array.isArray(targets)) fail('cmb_cdp_targets_invalid');
        target = targets.find((t) => t.id === created.targetId && t.type === 'page');
        if (!target) await pause(Math.min(100, budget()));
      }
      page = await attach(target.webSocketDebuggerUrl, 'page_attach');
    }
    report.targetId = target.id;
    // No awaitPromise and no extension storage access. The CDP client still
    // terminates its WebSocket if even this synchronous snapshot never replies.
    step = 'auto_result';
    while (true) {
      let packet;
      try {
        packet = await page.send('Runtime.evaluate', {
          expression: '({ href: location.href, output: document.getElementById("out")?.textContent || "" })',
          returnByValue: true, awaitPromise: false
        }, { timeoutMs: budget(), step });
      } catch (error) {
        // Page.navigate can resolve before the new execution context commits.
        // Retry only the read, never the navigation or the fill request.
        if (!/Execution context was destroyed|Cannot find context with specified id/u.test(error.message || '')) throw error;
        await pause(Math.min(100, budget()));
        continue;
      }
      if (packet.exceptionDetails) fail('cmb_auto_evaluate_failed', 1);
      const snapshot = packet.result?.value;
      if (snapshot?.href === report.autoUrl) {
        let result;
        try { result = JSON.parse(snapshot.output); } catch { /* startup or incomplete text */ }
        if (result && typeof result === 'object' && typeof result.ok === 'boolean') {
          report.backgroundResult = result;
          validateResult(result, config.mode);
          report.ok = result.ok;
          report.reason = result.reason || (result.ok ? `cmb_${config.mode}_complete` : 'cmb_basic_auto_failed');
          report.exitCode = resultExitCode(result);
          report.step = step;
          report.timedOut = report.reason === 'BG_NO_RESPONSE' || /timeout/u.test(report.reason);
          report.writeUnconfirmed = result.writeUnconfirmed === true;
          report.writeAttempted = report.writeUnconfirmed ? null : (result.writeAttempted ?? false);
          report.steps.push({ step, ok: report.ok, reason: report.reason });
          break;
        }
      }
      await pause(Math.min(100, budget()));
    }
  } catch (error) {
    report.ok = false;
    report.reason = isTimeout(error) ? 'timeout' : (error.reason || (step === 'target_list' ? 'cdp_unreachable' : 'cmb_cdp_error'));
    report.step = error.step || step;
    report.exitCode = isTimeout(error) ? 1 : (error.exitCode || 1);
    report.timedOut = isTimeout(error);
    report.error = String(error.message || error).slice(0, 500);
    if (!report.steps.some((row) => row.step === report.step && row.ok === false)) {
      report.steps.push({ step: report.step, ok: false, reason: report.reason });
    }
    if (dispatched && config?.mode === 'fill') {
      report.writeUnconfirmed = true;
      report.writeAttempted = null;
    }
  } finally {
    for (const session of sessions) session.close();
    report.finishedAt = new Date().toISOString();
  }
  return report;
}
