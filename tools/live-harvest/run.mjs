/**
 * Read-only live harvest runner. Never Save. No site is claimed supported.
 * Every CDP call is bounded by the step timeout and the run deadline.
 * summary.json is written on the way out, including after a timed-out step.
 */
import fs from 'node:fs';
import path from 'node:path';
import { connectCdp, getJson } from './cdp-client.mjs';
import { isTimeout, StepTimeoutError } from './errors.mjs';
import {
  CMB_BIRTHDATE_EXPR,
  CMB_CONTEXT_EXPR,
  CMB_RANKING_SNAP1_EXPR,
  CMB_RANKING_SNAP2_EXPR,
  EXT_STORAGE_EXPR,
  NANYUE_EXPR,
  PAID_PAGE_EXPR,
  PAID_STORAGE_SNIPPET_EXPR
} from './probes.mjs';
import { classifyReadinessProbe } from './readiness.mjs';
import { assessCmbRankingMajor } from '../../src/content/cmb-rankingmajor-gate.mjs';
import { assessCmbBirthDateHint } from '../../src/content/cmb-birthdate-hint-gate.mjs';

export const DEFAULT_SITES = Object.freeze(['cmb', 'nanyue', 'gth', 'cms', 'ext-storage']);
export const DEFAULT_PORTS = Object.freeze([9237, 9239]);

const MATCHERS = Object.freeze({
  cmb: (url) => url.includes('career.cmbchina.com/center/resume'),
  nanyue: (url) => url.includes('wecruit.hotjob.cn/SU670a291d6202cc7666c744bc'),
  gth: (url) => url.includes('hr.gtht.com/resume'),
  cms: (url) => url.includes('wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7') && url.includes('resumeOperation')
});

export function stampEvidence(obj, meta) {
  return {
    ...obj,
    neverSave: true,
    claimedSupported: false,
    harvestedAt: meta.harvestedAt,
    harvestedAtAsiaShanghai: meta.harvestedAtAsiaShanghai,
    runId: meta.runId
  };
}

function sanitizeRunId(runId) {
  return String(runId || 'run').replace(/[^A-Za-z0-9._-]+/g, '-');
}

function sleep(ms) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isExtensionTarget(tab) {
  const url = String(tab?.url || '');
  if (!url.startsWith('chrome-extension://')) return false;
  if (tab.type === 'service_worker') return true;
  return tab.type === 'page' && /popup|options|auto/i.test(url);
}

export async function runLiveHarvest(options = {}) {
  const ports = options.ports?.length ? options.ports : [...DEFAULT_PORTS];
  const sites = options.sites?.length ? options.sites : [...DEFAULT_SITES];
  const outDir = options.outDir;
  const runId = options.runId || new Date().toISOString().replace(/[:.]/g, '-');
  const stepTimeoutMs = Number.isFinite(options.stepTimeoutMs) ? options.stepTimeoutMs : 8000;
  const deadlineMs = Number.isFinite(options.deadlineMs) ? options.deadlineMs : 120000;
  const started = Date.now();
  const deadlineAt = started + deadlineMs;
  const sessions = new Set();
  const fileRunId = sanitizeRunId(runId);

  const summary = {
    neverSave: true,
    claimedSupported: false,
    supported: false,
    runId,
    startedAt: new Date(started).toISOString(),
    finishedAt: null,
    ports,
    sites,
    results: {},
    steps: [],
    skipped: [],
    evidencePaths: [],
    timedOut: false,
    hardFailure: false,
    exitCode: 0,
    ok: false,
    summaryPath: null
  };

  const remaining = () => deadlineAt - Date.now();
  const budget = () => Math.min(stepTimeoutMs, remaining());

  function noteTimeout(step, site) {
    const row = { ok: false, reason: 'timeout', step };
    if (site) row.site = site;
    summary.steps.push(row);
    summary.timedOut = true;
    if (site) summary.results[site] = row;
    return row;
  }

  function evidenceMeta() {
    return {
      harvestedAt: new Date().toISOString(),
      harvestedAtAsiaShanghai: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
      runId
    };
  }

  function writeEvidence(name, obj) {
    const payload = stampEvidence(obj, evidenceMeta());
    fs.mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, `${name}-${fileRunId}.json`);
    fs.writeFileSync(file, JSON.stringify(payload, null, 2));
    summary.evidencePaths.push(file);
    return file;
  }

  function closeSession(session) {
    if (!session) return;
    sessions.delete(session);
    try { session.close(); } catch { /* already terminated */ }
  }

  async function openTarget(wsUrl) {
    const connectBudget = budget();
    if (connectBudget <= 0) throw new StepTimeoutError('connect');
    const session = await connectCdp(wsUrl, { timeoutMs: connectBudget, step: 'connect' });
    sessions.add(session);
    const attachBudget = budget();
    if (attachBudget <= 0) {
      closeSession(session);
      throw new StepTimeoutError('target_attach');
    }
    try {
      await session.send('Runtime.enable', {}, { step: 'target_attach', timeoutMs: attachBudget });
    } catch (err) {
      closeSession(session);
      throw err;
    }
    return session;
  }

  async function evalOn(session, expression, { awaitPromise = false, step = 'runtime_evaluate' } = {}) {
    const left = budget();
    if (left <= 0) throw new StepTimeoutError(step);
    const result = await session.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise
    }, { step, timeoutMs: left });
    if (result?.exceptionDetails) {
      const detail = result.exceptionDetails.exception?.description
        || result.exceptionDetails.text
        || 'eval_fail';
      throw new Error(detail);
    }
    return result?.result?.value;
  }

  let allTabs = [];

  try {
    if (!outDir) throw new Error('out_dir_required');
    fs.mkdirSync(outDir, { recursive: true });

    for (const port of ports) {
      if (remaining() <= 0) {
        noteTimeout('connect');
        break;
      }
      try {
        const tabs = await getJson(port, '/json/list', { timeoutMs: budget(), step: 'connect' });
        const list = Array.isArray(tabs) ? tabs : [];
        for (const tab of list) allTabs.push({ ...tab, port });
      } catch (err) {
        if (isTimeout(err)) noteTimeout(err.step || 'connect');
        else summary.skipped.push({ site: `port${port}`, reason: 'cdp_unreachable', detail: String(err.message || err) });
      }
    }

    function findTab(pred) {
      return allTabs.find((tab) => tab.type === 'page' && tab.webSocketDebuggerUrl && pred(String(tab.url || '')));
    }

    async function harvestCmb() {
      const tab = findTab(MATCHERS.cmb);
      if (!tab) {
        summary.skipped.push({ site: 'cmb', reason: 'tab_not_found' });
        summary.results.cmb = { ok: false, reason: 'tab_not_found', supported: false };
        return;
      }
      let session;
      try {
        session = await openTarget(tab.webSocketDebuggerUrl);
        const context = await evalOn(session, CMB_CONTEXT_EXPR, { step: 'runtime_evaluate' });
        if (context?.loginHints && !context?.hasForm) {
          const file = writeEvidence('cmb-skipped-login', { ok: false, site: 'CMB', context });
          summary.skipped.push({ site: 'cmb', reason: 'needs_login' });
          summary.results.cmb = { ok: false, reason: 'needs_login', path: file, supported: false };
          return;
        }
        const snap1 = await evalOn(session, CMB_RANKING_SNAP1_EXPR, { step: 'runtime_evaluate' });
        await sleep(Math.min(300, Math.max(0, remaining())));
        const snap2 = await evalOn(session, CMB_RANKING_SNAP2_EXPR, { step: 'runtime_evaluate' });
        const rankingPacket = {
          ok: true,
          site: 'CMB',
          url: tab.url,
          pageContext: context && typeof context === 'object' ? context : { hasForm: false },
          snap1: snap1 && typeof snap1 === 'object' ? snap1 : { labelHits: [], idHits: [], rankingishLabels: [] },
          snap2: snap2 && typeof snap2 === 'object' ? snap2 : { labelHits: [], idHits: [], rankingishLabels: [] },
          note: 'No click/expand/fill/save. Dict RankingMajor options known offline; this probe is DOM presence only. NOT claimed supported.'
        };
        const decision = assessCmbRankingMajor(rankingPacket);
        rankingPacket.verdict = decision.verdict;
        const rankingPath = writeEvidence('cmb-rankingmajor', rankingPacket);
        const birthInfo = await evalOn(session, CMB_BIRTHDATE_EXPR, { step: 'runtime_evaluate' });
        const birthPacket = {
          ok: !!birthInfo?.ok,
          site: 'CMB',
          url: tab.url,
          field: birthInfo || { ok: false }
        };
        const hint = assessCmbBirthDateHint(birthPacket);
        birthPacket.hintVerdict = hint.verdict;
        const birthPath = writeEvidence('cmb-birthDate-hint', birthPacket);
        summary.results.cmb = {
          ok: true,
          rankingVerdict: decision.verdict,
          birthHint: hint.verdict,
          supported: false,
          paths: [rankingPath, birthPath]
        };
      } finally {
        closeSession(session);
      }
    }

    async function harvestReadiness(siteKey, siteName, pred, expression) {
      const tab = findTab(pred);
      if (!tab) {
        summary.skipped.push({ site: siteKey, reason: 'tab_not_found' });
        summary.results[siteKey] = { ok: false, reason: 'tab_not_found', supported: false };
        return;
      }
      let session;
      try {
        session = await openTarget(tab.webSocketDebuggerUrl);
        const snap = await evalOn(session, expression, { step: 'runtime_evaluate' });
        const readiness = classifyReadinessProbe(snap);
        if (snap && typeof snap === 'object') snap.readiness = readiness;
        let lastAutoSnippet = null;
        if (siteKey !== 'nanyue' && snap?.storageHints?.local?.length) {
          lastAutoSnippet = await evalOn(session, PAID_STORAGE_SNIPPET_EXPR, { step: 'runtime_evaluate' });
        }
        if (snap?.loginHints) summary.skipped.push({ site: siteKey, reason: 'needs_login', readiness });
        const body = {
          ok: !snap?.loginHints,
          site: siteName,
          url: tab.url,
          probe: snap,
          note: siteKey === 'nanyue'
            ? 'Never-Save readiness only. No fill. NOT claimed supported.'
            : 'Never-Save readiness only. No new fill forced. NOT claimed supported.'
        };
        if (siteKey !== 'nanyue') {
          body.port = tab.port;
          body.lastAutoSnippet = lastAutoSnippet;
        }
        const file = writeEvidence(`${siteKey === 'nanyue' ? 'nanyue' : siteName.toLowerCase()}-readiness`, body);
        summary.results[siteKey] = {
          ok: !snap?.loginHints,
          readiness,
          path: file,
          supported: false
        };
      } finally {
        closeSession(session);
      }
    }

    async function harvestExtension() {
      const extPages = allTabs.filter((tab) => isExtensionTarget(tab) && tab.webSocketDebuggerUrl).slice(0, 3);
      if (!extPages.length) {
        summary.skipped.push({ site: 'ext-storage', reason: 'no_extension_popup_tab_open' });
        const file = writeEvidence('paid-ext-storage', {
          ok: false,
          results: [],
          note: 'Read-only chrome.storage.local. No extension target was already open. Never Save.'
        });
        summary.results['ext-storage'] = { ok: false, mode: 'no_extension_target', path: file, supported: false };
        return;
      }
      const results = [];
      for (const tab of extPages) {
        let session;
        try {
          session = await openTarget(tab.webSocketDebuggerUrl);
          const value = await evalOn(session, EXT_STORAGE_EXPR, {
            awaitPromise: true,
            step: 'extension_storage'
          });
          results.push({ tabUrl: tab.url, value });
        } catch (err) {
          if (isTimeout(err)) {
            results.push({ ok: false, reason: 'timeout', step: err.step || 'extension_storage', tabUrl: tab.url });
            writeEvidence('paid-ext-storage', {
              ok: false,
              results,
              note: 'Read-only chrome.storage.local timed out. Never Save. No new fill.'
            });
            throw err;
          }
          results.push({ tabUrl: tab.url, error: String(err.message || err) });
        } finally {
          closeSession(session);
        }
      }
      const file = writeEvidence('paid-ext-storage', {
        ok: results.some((row) => row.value && !row.error),
        results,
        note: 'Read-only chrome.storage.local interesting keys. Never Save. No new fill.'
      });
      summary.results['ext-storage'] = { ok: results.some((row) => row.value && !row.error), mode: 'extension_tab', path: file, supported: false };
    }

    for (const site of sites) {
      if (remaining() <= 0) {
        noteTimeout(site === 'ext-storage' ? 'extension_storage' : 'connect', site);
        continue;
      }
      try {
        if (site === 'cmb') await harvestCmb();
        else if (site === 'nanyue') await harvestReadiness('nanyue', 'NANYUE', MATCHERS.nanyue, NANYUE_EXPR);
        else if (site === 'gth') await harvestReadiness('gth', 'GTH', MATCHERS.gth, PAID_PAGE_EXPR);
        else if (site === 'cms') await harvestReadiness('cms', 'CMS', MATCHERS.cms, PAID_PAGE_EXPR);
        else if (site === 'ext-storage') await harvestExtension();
        else {
          summary.hardFailure = true;
          summary.skipped.push({ site, reason: 'unknown_site' });
          summary.results[site] = { ok: false, reason: 'unknown_site', step: site };
        }
      } catch (err) {
        if (isTimeout(err)) noteTimeout(err.step || site, site);
        else {
          summary.hardFailure = true;
          summary.skipped.push({ site, reason: 'exception', detail: String(err.message || err) });
          summary.results[site] = { ok: false, reason: 'exception', step: site, detail: String(err.message || err) };
        }
      }
    }
  } catch (err) {
    if (isTimeout(err)) noteTimeout(err.step || 'connect');
    else {
      summary.hardFailure = true;
      summary.skipped.push({ site: 'run', reason: 'exception', detail: String(err.message || err) });
    }
  } finally {
    for (const session of [...sessions]) closeSession(session);
    summary.finishedAt = new Date().toISOString();
    summary.exitCode = summary.timedOut || summary.hardFailure ? 1 : 0;
    summary.ok = summary.exitCode === 0;
    if (outDir) {
      try {
        fs.mkdirSync(outDir, { recursive: true });
        const summaryPath = path.join(outDir, 'summary.json');
        summary.summaryPath = summaryPath;
        fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
      } catch (err) {
        summary.hardFailure = true;
        summary.exitCode = 1;
        summary.ok = false;
        summary.summaryError = String(err.message || err);
      }
    }
  }

  return summary;
}
