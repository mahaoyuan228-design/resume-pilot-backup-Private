#!/usr/bin/env node
/** One Edge tab, six sequential product trials, one Never-Save evidence file.
 * PowerShell (repo root):
 * $env:PORT='9239'; $env:OUTDIR='.'; node scripts/live/gth-full-resume-live.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectCdp, getJson } from '../../tools/live-harvest/cdp-client.mjs';
import { assertLoopback, EDIT_PAGE, looksLikeLogin, pageGuardExpression, redactUrl, selectResumeTarget } from '../probe-gth-intent.mjs';
import { readOutDir, readPort, readStepTimeout, readTipSha } from './gth-intent-live.mjs';
import { buildPageExpression as buildEducationPageExpression } from './gth-education-live.mjs';
import { buildPageExpression, isAllowedRequest } from './lib/gth-full-page.mjs';
import { ensureVisible, runSections } from './lib/gth-full-orchestrator.mjs';
import { LIVE_FILES, SECTIONS, chromeShimExpression, requestsFor } from './lib/gth-full-sections.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const EVIDENCE_NAME = 'gth-full-resume-live.json';
// Complete repo dependency closure: ESM imports and product sources evaluated in
// the page. Node built-ins and node_modules/ws are not repo files.
export const RUNTIME_FILES = Object.freeze([
  'scripts/live/gth-full-resume-live.mjs',
  'scripts/live/lib/gth-full-orchestrator.mjs',
  'scripts/live/lib/gth-full-page.mjs',
  'scripts/live/lib/gth-full-sections.mjs',
  'scripts/live/gth-education-live.mjs',
  'scripts/live/lib/gth-education-page.mjs',
  'scripts/live/gth-other-skills-live.mjs',
  'scripts/live/gth-intent-live.mjs',
  'scripts/probe-gth-section.mjs',
  'scripts/probe-gth-intent.mjs',
  'scripts/gth-option-reader.mjs',
  'tools/live-harvest/cdp-client.mjs',
  'tools/live-harvest/errors.mjs',
  'src/background/gth-open-fills.mjs',
  'src/background/gth-save-policy.mjs',
  ...LIVE_FILES
]);
export const HELP = `Usage (PowerShell, repo root; Node.js 20+):
  $env:PORT='9239'; $env:OUTDIR='.'; node scripts/live/gth-full-resume-live.mjs

Attaches once to the existing https://hr.gtht.com/resume/edit/ Edge tab.
Runs 基本信息 / 教育经历 / 工作经验 / 职业技能与特长 / 其他信息 / 求职意向.
PORT defaults to 9239; OUTDIR defaults to the current directory.
Writes ${EVIDENCE_NAME}. Never saves; liveSupportClaimed stays false.
Allowed clicks: known edit/add controls, 取消, basic/education radio groups,
in-panel options/checkboxes/radios, date-header arrows and month/day cells,
and visible in-panel 确定. 保存, 提交, 投递, 删除 and type=submit stay blocked.
POST lookups are getsalaryunit.json and getPhotoSize.json
(exact path, query stripped). A failed section cancels and, if the form
remains, removes that editor before the next section rebinds its writer.
STEP_TIMEOUT_MS defaults to 30000 (1000..120000).
`;

const failure = (reason) => Object.assign(new Error(reason), { reason });
const errorReason = (error) => error?.reason || (error?.name === 'StepTimeoutError' ? 'timeout' : 'live_runner_failed');

export function evidenceExitCode(evidence) {
  if (evidence.requests.some((row) => row.allowed === false || !isAllowedRequest(row.method, row.url))
    || evidence.clicks.some((row) => row.allowed !== true)) return 3;
  if (evidence.reason) return 1;
  return evidence.sections.length === SECTIONS.length
    && evidence.sections.every((run) => run.status === 'verified') ? 0 : 2;
}

export async function runGthFullResumeLive(options = {}) {
  const env = options.env || process.env;
  const root = options.repoRoot || repoRoot;
  const outDir = options.outDir || readOutDir(env);
  const evidence = {
    tipSha: options.tipSha || readTipSha(root), page: EDIT_PAGE,
    neverSave: true, liveSupportClaimed: false, reason: null,
    runtimeFiles: [...RUNTIME_FILES], sections: [], fields: [], clicks: [], requests: [],
    cleanup: {}, targetId: null
  };
  let session;
  let installed = false;
  let educationAdapterInstalled = false;
  let fetchEnabled = false;
  let focusEmulationEnabled = false;
  let currentSection = null;
  const pending = new Set();
  const cdpRequests = [];
  const requestJournal = [];
  let cdpRead = 0;
  let pageRead = 0;
  let lastClicks = [];
  const transportErrors = [];
  let timeoutMs = 30000;
  const send = (method, params = {}, step = method) => session.send(method, params, { timeoutMs, step });
  const evaluate = async (expression, step, awaitPromise = false) => {
    const reply = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise }, step);
    if (reply?.exceptionDetails) {
      const error = failure('eval_failed');
      error.message = String(reply.exceptionDetails.exception?.description || reply.exceptionDetails.text || 'eval_failed').slice(0, 300);
      throw error;
    }
    return reply?.result?.value;
  };
  const page = (method, args = []) => evaluate(`globalThis.__gthFullLive.${method}(${args.map((arg) => JSON.stringify(arg)).join(',')})`, method, true);
  const readEvidence = async () => {
    const value = await evaluate('({ clicks: globalThis.__gthFullLive.clicks(), requests: globalThis.__gthFullLive.requests() })', 'read_guard_evidence');
    lastClicks = value?.clicks || [];
    const pageRequests = value?.requests || [];
    requestJournal.push(...cdpRequests.slice(cdpRead), ...pageRequests.slice(pageRead));
    cdpRead = cdpRequests.length;
    pageRead = pageRequests.length;
    return { clicks: lastClicks.slice(), requests: requestJournal.slice() };
  };
  try {
    const port = options.port ?? readPort(env);
    timeoutMs = options.stepTimeoutMs ?? readStepTimeout(env);
    const targets = await (options.getJson || getJson)(port, '/json/list', { timeoutMs, step: 'target_list' });
    if (!Array.isArray(targets)) throw failure('cdp_targets_invalid');
    const selected = selectResumeTarget(targets, 'hr.gtht.com/resume/edit');
    if (selected.action !== 'attach') throw failure(selected.reason || 'tab_not_found');
    const target = selected.target;
    if (target.url !== EDIT_PAGE) throw failure('wrong_page');
    if (!assertLoopback(target.webSocketDebuggerUrl, port)) throw failure('cdp_endpoint_invalid');
    evidence.targetId = target.id;
    session = await (options.connectCdp || connectCdp)(target.webSocketDebuggerUrl, {
      timeoutMs, step: 'page_attach',
      onEvent(message) {
        const req = message.params?.request;
        if (!req) return;
        const method = String(req.method || '').toUpperCase();
        if (message.method === 'Network.requestWillBeSent' && method !== 'GET') {
          cdpRequests.push({ method, url: redactUrl(req.url), via: 'cdp', allowed: isAllowedRequest(method, req.url), section: currentSection });
        }
        if (message.method !== 'Fetch.requestPaused') return;
        const allowed = isAllowedRequest(method, req.url);
        if (method !== 'GET') cdpRequests.push({ method, url: redactUrl(req.url), via: 'cdp_fetch', allowed, blocked: !allowed, section: currentSection });
        const operation = Promise.resolve().then(() => send(allowed ? 'Fetch.continueRequest' : 'Fetch.failRequest', {
          requestId: message.params.requestId, ...(!allowed ? { errorReason: 'BlockedByClient' } : {})
        }, 'request_guard')).catch((error) => transportErrors.push(errorReason(error)));
        pending.add(operation);
        operation.finally(() => pending.delete(operation));
      }
    });
    await send('Runtime.enable');
    await send('Network.enable');
    // Enforce at the request boundary as well as fetch/XHR/beacon in the page.
    // Installation failure is fatal: an unguarded live trial must not begin.
    await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
    fetchEnabled = true;
    const initial = await evaluate(pageGuardExpression(), 'page_location');
    if (looksLikeLogin(initial)) throw failure('needs_login');
    if (initial?.href !== EDIT_PAGE) throw failure('wrong_page');
    // A prior standalone trial may have left its adapter installed. Remove its
    // taps before the shared guard captures originals; never layer a second
    // request policy over the full runner's exact lookup allowlist.
    await evaluate('globalThis.__gthEducationLive?.restore(); delete globalThis.__gthEducationLive', 'restore_previous_education_adapter');
    const result = await evaluate(buildPageExpression(), 'install_page_guard');
    if (!result?.ok) throw failure('guard_install_failed');
    installed = true;
    const educationAdapter = await evaluate(`(() => {
      const result = ${buildEducationPageExpression()};
      globalThis.__gthEducationLive?.restore();
      return result;
    })()`, 'install_education_readback');
    if (!educationAdapter?.ok) throw failure('education_adapter_failed');
    educationAdapterInstalled = true;
    const shim = await evaluate(chromeShimExpression(), 'chrome_shim');
    if (!shim?.ok) throw failure('chrome_shim_failed');
    const injectFailures = new Map();
    const bindWriters = async (section) => {
      for (const relative of LIVE_FILES) {
        try {
          const source = fs.readFileSync(path.join(root, relative), 'utf8');
          const installed = await evaluate(`(() => { ${source}\nreturn { ok: true }; })()`, `inject_${path.basename(relative)}`);
          if (installed?.ok) injectFailures.delete(relative);
          else injectFailures.set(relative, 'inject_failed');
        } catch (error) {
          injectFailures.set(relative, errorReason(error));
        }
      }
      const name = section?.globalName;
      const method = section?.method || 'trial';
      if (!/^ResumeGth[A-Za-z]+$/u.test(name || '')) throw failure('writer_not_bound');
      if (!['trial', 'fullTrial'].includes(method)) throw failure('writer_not_bound');
      const ready = await evaluate(`typeof globalThis.${name}?.${method} === 'function'`, `writer_ready_${section.id}`);
      if (ready !== true) throw failure('writer_not_bound');
    };
    const driver = {
      state: () => page('state'),
      async bringToFront() {
        // An unattended Edge tab may remain hidden after bringToFront. Wake
        // its lifecycle before falling back to session-local focus emulation;
        // ensureVisible still requires an actual visible state afterward.
        try { await send('Page.bringToFront'); } catch { /* try lifecycle recovery */ }
        if ((await page('state'))?.visible === true) return;
        try { await send('Page.setWebLifecycleState', { state: 'active' }); }
        catch { /* an older CDP target may still support focus emulation */ }
        if ((await page('state'))?.visible === true) return;
        await send('Emulation.setFocusEmulationEnabled', { enabled: true });
        focusEmulationEnabled = true;
      },
      bindWriters,
      forceClose: (section) => page('discard', [section.sectionIndex]),
      async open(section) {
        currentSection = section.id;
        if (section.id !== 'education') return page('open', [section.sectionIndex]);
        const active = await page('activate', [section.sectionIndex]);
        if (active?.ok !== true) return active;
        // The shipped fullTrial owns the row-icon edit, record identity and
        // editor wait. A title 编辑 click belongs to the legacy open-fill path.
        const inspected = await evaluate('globalThis.__gthEducationLive.inspect()', 'inspect_education');
        return { ...inspected, writerOpensEditor: true };
      },
      async fill(section) {
        const fills = [];
        for (const trial of requestsFor(section)) {
          const before = await readEvidence();
          let fill;
          const attempt = () => evaluate(`globalThis.${section.globalName}.${section.method || 'trial'}(${JSON.stringify(trial.request)})`, `fill_${section.id}`, true);
          try {
            await ensureVisible(driver);
            fill = await attempt();
            // A tab may lose visibility during a picker wait. Retry this fixed
            // Never-Save trial once after refocusing, including partial drafts.
            const state = await driver.state();
            if (state?.visible !== true) {
              await ensureVisible(driver);
              fill = await attempt();
              if ((await driver.state())?.visible !== true) throw failure('page_hidden');
            }
          } catch (error) {
            fill = { ok: false, reason: errorReason(error), fields: trial.questions.map((question) => ({ question, status: 'failed', reason: errorReason(error) })) };
          }
          const after = await readEvidence();
          const blockedClicks = after.clicks.slice(before.clicks.length).filter((row) => row.allowed !== true);
          const forbiddenRequests = after.requests.slice(before.requests.length).filter((row) => row.allowed === false || !isAllowedRequest(row.method, row.url));
          fills.push({ questions: trial.questions, fill, blockedClicks, forbiddenRequests });
        }
        return fills;
      },
      read: (section) => section.id === 'education'
        ? evaluate(`globalThis.__gthEducationLive.read(${JSON.stringify(section.questions)})`, 'read_education')
        : page('read', [section.sectionIndex, section.questions]),
      async cancel(section) {
        if (section.id !== 'education') return page('cancel', [section.sectionIndex]);
        const adapterCancel = await evaluate('globalThis.__gthEducationLive.cancel()', 'cancel_education', true);
        // The standalone helper accepts a hidden form as closed. The full
        // runner additionally disconnects it and any teleported picker before
        // a later section binds; generic cancel already owns that cleanup.
        return { ...(await page('cancel', [section.sectionIndex])), adapterCancel };
      },
      evidence: readEvidence
    };
    evidence.sections = await runSections(driver);
    if (injectFailures.size) evidence.injectionFailures = Object.fromEntries(injectFailures);
  } catch (error) {
    evidence.reason = errorReason(error);
    evidence.detail = String(error?.message || error).slice(0, 300);
  } finally {
    if (session) {
      if (educationAdapterInstalled) {
        // Its taps were already restored at installation. Calling restore()
        // again here would reinstall the full guard after its own cleanup.
        try { await evaluate('delete globalThis.__gthEducationLive', 'remove_education_readback'); evidence.cleanup.educationAdapterRemoved = true; }
        catch { evidence.cleanup.educationAdapterRemoved = false; }
      }
      if (installed) {
        try { Object.assign(evidence, await readEvidence()); }
        catch { evidence.cleanup.evidenceReadFailed = true; }
        try { await page('restore'); evidence.cleanup.pageGuardRestored = true; }
        catch { evidence.cleanup.pageGuardRestored = false; }
      }
      try {
        await evaluate('globalThis.__gthFullResumeChromeRestore?.()', 'restore_chrome_shim');
        evidence.cleanup.chromeShimRestored = true;
      } catch { evidence.cleanup.chromeShimRestored = false; }
      await Promise.all([...pending]);
      if (focusEmulationEnabled) {
        try { await send('Emulation.setFocusEmulationEnabled', { enabled: false }); evidence.cleanup.focusEmulationRestored = true; }
        catch { evidence.cleanup.focusEmulationRestored = false; }
      }
      if (fetchEnabled) {
        try { await send('Fetch.disable'); evidence.cleanup.requestGuardRestored = true; }
        catch { evidence.cleanup.requestGuardRestored = false; }
      }
      session.close();
    }
    if (transportErrors.length) evidence.reason ||= 'request_guard_failed';
    evidence.transportErrors = transportErrors;
    if (evidence.cleanup.evidenceReadFailed) evidence.reason ||= 'evidence_read_failed';
    if (Object.values(evidence.cleanup).includes(false)) evidence.reason ||= 'cleanup_failed';
    evidence.clicks = lastClicks.slice();
    // Preserve failures even if the page execution context disappeared.
    requestJournal.push(...cdpRequests.slice(cdpRead));
    evidence.requests = requestJournal.length ? requestJournal.slice() : [...cdpRequests];
    for (const section of SECTIONS) {
      if (!evidence.sections.some((run) => run.id === section.id)) {
        evidence.sections.push({ id: section.id, section: section.section, status: 'failed', reason: evidence.reason || 'not_run',
          fields: section.questions.map((q) => ({ q, status: 'failed', reason: evidence.reason || 'not_run', value: null })) });
      }
    }
    evidence.fields = evidence.sections.flatMap((run) => run.fields.map((field) => ({ section: run.section, ...field })));
    evidence.neverSave = true;
    evidence.liveSupportClaimed = false;
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, EVIDENCE_NAME), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  }
  return evidence;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--help')) console.log(HELP);
  else {
    try {
      const evidence = await runGthFullResumeLive();
      console.log(`${EVIDENCE_NAME}: ${evidence.sections.map((run) => `${run.id}=${run.status}`).join(', ')}`);
      process.exitCode = evidenceExitCode(evidence);
    } catch (error) {
      console.error(String(error?.message || error));
      process.exitCode = 1;
    }
  }
}
