// Paid Edge Never-Save QA runner.
// Drives the extension's own auto pages over CDP. Does not click 保存/提交/Save/Submit
// and does not invent site DOM selectors.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PAID_EXT_ID = 'decggijdlhflkjkgmofbclglilpaooij';

export const REASON = {
  EXT_NOT_LOADED: 'EXT_NOT_LOADED',
  EXT_BLOCKED_BY_CLIENT: 'EXT_BLOCKED_BY_CLIENT',
  CDP_UNREACHABLE: 'CDP_UNREACHABLE',
  SITE_TAB_MISSING: 'SITE_TAB_MISSING',
  AUTO_PAGE_NO_REPORT: 'AUTO_PAGE_NO_REPORT',
  BG_NO_RESPONSE: 'BG_NO_RESPONSE',
  SAVE_CLICK_FORBIDDEN: 'SAVE_CLICK_FORBIDDEN',
  AUTO_FILL_NOT_VERIFIED: 'AUTO_FILL_NOT_VERIFIED',
};

export const HINTS = {
  [REASON.EXT_NOT_LOADED]: '请在 edge://extensions 开发者模式加载解压缩的扩展，选 extension 文件夹',
  [REASON.EXT_BLOCKED_BY_CLIENT]: '请在 edge://extensions 开发者模式加载解压缩的扩展，选 extension 文件夹',
  [REASON.CDP_UNREACHABLE]: '连不上本机 Edge CDP。请确认 Edge 已用远程调试端口启动',
  [REASON.SITE_TAB_MISSING]: '缺少站点标签：cms 需要已打开的 wecruit.hotjob.cn，gth 需要已打开的 hr.gtht.com',
  [REASON.AUTO_PAGE_NO_REPORT]: '自动页已打开，但在超时前没有回传报告',
  [REASON.BG_NO_RESPONSE]: '自动页已打开，但卡在请求后台 *_AUTO，超时前没有报告',
  [REASON.SAVE_CLICK_FORBIDDEN]: '检测到保存或提交点击，本段已失败（Never Save）',
  [REASON.AUTO_FILL_NOT_VERIFIED]: '基本信息填充缺少已核对完成的结果或完成合约，本段未通过',
};

export const SITE_HOSTS = {
  cms: 'wecruit.hotjob.cn',
  gth: 'hr.gtht.com',
};

export const BG_WAIT_RE = /正在请求后台\s+[A-Z0-9_]+_AUTO/;
export const SAVE_TEXT_RE = /保存|提交|Save|Submit/;

export const BG_PROBE_HTML = '<!doctype html><html><head><meta charset="utf-8"><title>paid-qa-bg-probe</title></head><body><p id="status">bg-probe</p></body></html>';

export const SECTIONS = [
  { id: 'cms-basic', site: 'cms', autoPath: 'src/auto/cms-basic-auto.html', qs: (p) => `mode=fill&openIfMissing=1&reportPort=${p}` },
  { id: 'cms-education', site: 'cms', autoPath: 'src/auto/cms-education-auto.html', qs: (p) => `mode=fill&profileIndex=5&replaceExisting=1&also=0&reportPort=${p}` },
  { id: 'cms-internship', site: 'cms', autoPath: 'src/auto/cms-education-auto.html', qs: (p) => `mode=internship_fill&profileIndex=0&replaceExisting=1&reportPort=${p}` },
  { id: 'gth-basic', site: 'gth', autoPath: 'src/auto/gth-basic-auto.html', qs: (p) => `mode=fill&openIfMissing=1&reportPort=${p}` },
  { id: 'gth-education', site: 'gth', autoPath: 'src/auto/gth-education-auto.html', qs: (p) => `mode=fill&openIfMissing=1&profileIndex=0&replaceExisting=1&reportPort=${p}` },
  { id: 'gth-intent', site: 'gth', autoPath: 'src/auto/gth-intent-auto.html', qs: (p) => `mode=fill&openIfMissing=1&reportPort=${p}` },
  { id: 'gth-other', site: 'gth', autoPath: 'src/auto/gth-other-auto.html', qs: (p) => `mode=fill&openIfMissing=1&reportPort=${p}` },
  { id: 'gth-simple', site: 'gth', autoPath: 'src/auto/gth-simple-auto.html', qs: (p) => `mode=fill&openIfMissing=1&reportPort=${p}` },
];

const repoRootDefault = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function hintFor(reason, extra = {}) {
  const base = HINTS[reason] || String(reason || '');
  if (reason === REASON.SITE_TAB_MISSING && Array.isArray(extra.missingHosts) && extra.missingHosts.length) {
    return `${base}（缺少 ${extra.missingHosts.join('、')}）`;
  }
  return base;
}

export function makeRunId(date = new Date()) {
  const p = (n, width = 2) => String(n).padStart(width, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}-${p(date.getMilliseconds(), 3)}`;
}

export function evidencePaths({ repoRoot, port, runId, sectionId }) {
  const dir = path.join(repoRoot, 'dist', 'auto-runs', `paid-edge-${port}`, String(runId));
  const paths = {
    dir,
    summary: path.join(dir, 'summary.json'),
    preflightFail: path.join(dir, 'preflight-fail.json'),
  };
  if (sectionId) {
    paths.sectionJson = path.join(dir, `${sectionId}.json`);
    paths.sectionPng = path.join(dir, `${sectionId}.png`);
  }
  return paths;
}

export function readConfig(env = process.env) {
  const port = Number.parseInt(env.CDP_PORT || '9239', 10);
  const extId = env.RESUME_EXT_ID || PAID_EXT_ID;
  const timeoutMs = Number.parseInt(env.AUTO_TIMEOUT_MS || '90000', 10);
  const reloadWaitMs = Number.parseInt(env.RELOAD_WAIT_MS || '4000', 10);
  const only = String(env.ONLY || '').split(',').map((item) => item.trim()).filter(Boolean);
  const known = new Set(SECTIONS.map((section) => section.id));
  const unknown = only.filter((id) => !known.has(id));
  const sections = only.length ? SECTIONS.filter((section) => only.includes(section.id)) : SECTIONS.slice();
  return {
    port,
    extId,
    timeoutMs,
    reloadWaitMs,
    only,
    unknown,
    sections,
    enableBgProbe: env.PAID_QA_BG_PROBE !== '0',
  };
}

export function requiredHostsForSections(sections) {
  const hosts = [];
  for (const section of sections) {
    const host = SITE_HOSTS[section.site];
    if (host && !hosts.includes(host)) hosts.push(host);
  }
  return hosts;
}

export function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

export function findSiteTab(targets, host) {
  return (targets || []).find((target) => {
    if (target.type && target.type !== 'page') return false;
    return hostOf(target.url) === host;
  }) || null;
}

export function missingSiteHosts(targets, hosts) {
  return hosts.filter((host) => !findSiteTab(targets, host));
}

export function findExtensionWorker(targets, extId) {
  const prefix = `chrome-extension://${extId}/`;
  return (targets || []).find((target) => {
    if (typeof target.url !== 'string' || !target.url.startsWith(prefix)) return false;
    return target.type === 'service_worker'
      || target.type === 'background_page'
      || /\/worker\.mjs|service_worker/i.test(target.url);
  }) || null;
}

export function staleAutoTargets(targets, extId) {
  const prefix = `chrome-extension://${extId}/src/auto/`;
  return (targets || []).filter((target) => typeof target.url === 'string' && target.url.startsWith(prefix));
}

export function classifyManifestProbe(probe, { hasWorker = false } = {}) {
  const blob = [probe?.errorText, probe?.url, probe?.bodyText, probe?.title].filter(Boolean).join('\n');
  if (/ERR_BLOCKED_BY_CLIENT/i.test(blob)) return REASON.EXT_BLOCKED_BY_CLIENT;
  if (/manifest_version/.test(probe?.bodyText || '')) return null;
  if (!hasWorker) return REASON.EXT_NOT_LOADED;
  if (/chrome-error:|net::ERR_|ERR_[A-Z_]+/i.test(blob)) return REASON.EXT_NOT_LOADED;
  return null;
}

export function classifyStuckAutoPage(snapshot, { reportPosted = false } = {}) {
  if (!snapshot || reportPosted) return null;
  const text = `${snapshot.bodyText || ''}\n${snapshot.status || ''}`;
  const waiting = BG_WAIT_RE.test(text);
  const noReport = snapshot.lastReport == null && reportPosted !== true;
  if (waiting && noReport) return REASON.BG_NO_RESPONSE;
  return null;
}

export function classifyNoReport({ autoOpened = false, events = [], reportPosted = false, snapshot = null } = {}) {
  if (reportPosted) return null;
  const stuck = classifyStuckAutoPage(snapshot, { reportPosted });
  if (stuck) return stuck;
  const sawAutoPage = autoOpened || events.some((event) => event && (event.event === 'auto_begin' || event.event === 'reload_begin' || event.step === 'auto_begin'));
  if (sawAutoPage) return REASON.AUTO_PAGE_NO_REPORT;
  return null;
}

export function interpretBgProbe(result, timedOut = false) {
  if (timedOut) return { reason: REASON.BG_NO_RESPONSE, result: result || null };
  if (!result || typeof result !== 'object') return { reason: REASON.BG_NO_RESPONSE, result: result ?? null };
  if (result.reason === 'NO_RUNTIME') return { reason: 'NO_RUNTIME', result };
  if (result.reason === REASON.BG_NO_RESPONSE || result.pending === true) return { reason: REASON.BG_NO_RESPONSE, result };
  if (result.answered === true || result.ok === true) return { reason: null, result };
  return { reason: REASON.BG_NO_RESPONSE, result };
}

export function sectionStatus({ ok, reason }) {
  if (reason === REASON.SAVE_CLICK_FORBIDDEN) return 'fail';
  if (
    reason === REASON.AUTO_PAGE_NO_REPORT
    || reason === REASON.BG_NO_RESPONSE
    || (typeof reason === 'string' && reason.startsWith('timeout_'))
  ) return 'timeout';
  if (ok === true) return 'pass';
  return 'fail';
}

function reportsForbiddenClick(body) {
  const pending = [body];
  const seen = new Set();
  while (pending.length) {
    const value = pending.pop();
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    if (['softwareClickedSave', 'softwareClickedSubmit', 'softwareClickedDelete', 'saveAttempted']
      .some(key => value[key] === true)) return true;
    pending.push(...Object.values(value).filter(item => item && typeof item === 'object'));
  }
  return false;
}

function basicFillVerified(section, body) {
  if (!['cms-basic', 'gth-basic'].includes(section.id)) return true;
  const job = body?.job;
  const fields = job?.fields;
  if (body?.mode !== 'fill' || job?.state !== 'completed'
    || !['verified', 'verified_preexisting'].includes(job.outcome)
    || typeof job.writeStarted !== 'boolean' || typeof job.supportedComplete !== 'boolean'
    || job.operableComplete !== true || body.fill?.ok !== true
    || job.outcome !== (job.writeStarted ? 'verified' : 'verified_preexisting')
    || body.writeAttempted !== job.writeStarted
    || !Array.isArray(fields) || !fields.length) return false;
  const verified = row => row?.status === 'verified'
    && ['readback_matched', 'readback_reapplied', 'preexisting_same_value'].includes(row.reason);
  const allVerified = fields.every(verified);
  if (job.supportedComplete !== allVerified) return false;
  if (!job.writeStarted && fields.some(row => verified(row)
    && ['readback_matched', 'readback_reapplied'].includes(row.reason))) return false;
  // CMS has no read-only exception contract. GTH keeps its existing phone/email
  // site_readonly result; the QA gate does not claim these fields were filled.
  return fields.every(row => verified(row) || section.id === 'gth-basic'
    && row?.status === 'skipped' && row.reason === 'site_readonly'
    && ['phone', 'email'].includes(row.path)
    && ['same', 'different', 'empty', 'source_unavailable'].includes(row.readOnlyState));
}

function asNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function extractFillCounts(body) {
  if (!body || typeof body !== 'object') return {};
  const job = body.job && typeof body.job === 'object' ? body.job : null;
  const filled = asNumber(body.filled) ?? asNumber(body.filledCount) ?? asNumber(job?.filled) ?? asNumber(job?.filledCount);
  const expected = asNumber(body.expected) ?? asNumber(body.expectedCount) ?? asNumber(job?.expected) ?? asNumber(job?.expectedCount);
  if (filled != null || expected != null) {
    const counts = {};
    if (filled != null) counts.filled = filled;
    if (expected != null) counts.expected = expected;
    return counts;
  }
  const fields = Array.isArray(body.fields) ? body.fields : (Array.isArray(job?.fields) ? job.fields : null);
  const rawCounts = job?.counts && typeof job.counts === 'object' ? job.counts : null;
  if (fields) {
    const filledRows = fields.filter((row) => {
      if (!row) return false;
      if (/^(verified|filled|written|ok)$/i.test(String(row.status || ''))) return true;
      return /^(readback_matched|readback_reapplied|preexisting_same_value)$/i.test(String(row.reason || ''));
    }).length;
    return { filled: filledRows, expected: fields.length };
  }
  if (rawCounts && (asNumber(rawCounts.newlyFilled) != null || asNumber(rawCounts.reapplied) != null || asNumber(rawCounts.originalSame) != null)) {
    return {
      filled: (asNumber(rawCounts.newlyFilled) || 0) + (asNumber(rawCounts.reapplied) || 0) + (asNumber(rawCounts.originalSame) || 0),
    };
  }
  return {};
}

export function saveClickGuardSource() {
  return `(() => {
    if (window.__rqfSaveGuardInstalled) return true;
    window.__rqfSaveGuardInstalled = true;
    if (!Array.isArray(window.__rqfSaveClicks)) window.__rqfSaveClicks = [];
    const re = /保存|提交|Save|Submit/;
    const own = (el) => {
      if (!el) return '';
      const aria = el.getAttribute ? (el.getAttribute('aria-label') || el.getAttribute('title') || '') : '';
      const value = el.value || '';
      const text = String(el.innerText || el.textContent || '').trim();
      return [aria, value, text.length <= 40 ? text : ''].filter(Boolean).join(' ');
    };
    document.addEventListener('click', (event) => {
      try {
        const el = event.target;
        const label = own(el) || own(el && el.parentElement);
        if (re.test(label)) {
          window.__rqfSaveClicks.push({ text: String(label).slice(0, 180), tag: (el && el.tagName) || '', at: Date.now() });
        }
      } catch { /* ignore */ }
    }, true);
    return true;
  })()`;
}

export const READ_SAVE_CLICKS = 'Array.isArray(window.__rqfSaveClicks) ? window.__rqfSaveClicks : []';

export function autoPageSnapshotExpression() {
  return `({
    href: location.href,
    readyState: document.readyState,
    title: document.title,
    bodyText: document.body ? String(document.body.innerText || '').slice(0, 2000) : '',
    status: (document.getElementById('status') && document.getElementById('status').textContent) || '',
    lastReport: window.lastReport ?? null,
    errors: window.errors ?? null
  })`;
}

export function manifestProbeExpression() {
  return `({
    href: location.href,
    title: document.title,
    bodyText: document.body ? String(document.body.innerText || '').slice(0, 800) : ''
  })`;
}

export function bgProbeExpression(timeoutMs = 4000) {
  const limit = Math.max(500, Math.min(4500, Number(timeoutMs) || 4000));
  return `(async () => {
    const limit = ${limit};
    if (typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
      return { ok: false, reason: 'NO_RUNTIME' };
    }
    const timeout = new Promise((resolve) => setTimeout(() => resolve({ ok: false, reason: 'BG_NO_RESPONSE', pending: true }), limit));
    const ping = new Promise((resolve) => {
      let settled = false;
      const done = (value) => { if (!settled) { settled = true; resolve(value); } };
      try {
        const ret = chrome.runtime.sendMessage({ type: 'PAID_QA_BG_PING' }, (resp) => {
          const err = chrome.runtime && chrome.runtime.lastError;
          done({ ok: true, answered: true, resp: resp ?? null, lastError: err ? String(err.message || err) : null });
        });
        if (ret && typeof ret.then === 'function') {
          ret.then(
            (resp) => done({ ok: true, answered: true, resp: resp ?? null }),
            (error) => done({ ok: true, answered: true, error: String(error && error.message || error) })
          );
        }
      } catch (error) {
        done({ ok: true, answered: true, error: String(error && error.message || error) });
      }
    });
    return await Promise.race([ping, timeout]);
  })()`;
}

export function withTimeout(promise, ms, label = 'timeout') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`timeout_${ms}`);
      error.code = 'TIMEOUT';
      error.label = label;
      reject(error);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function createCdpClient(ws) {
  const pending = new Map();
  let id = 0;
  const api = {
    ws,
    ready: new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
    }),
    send(method, params = {}, sessionId) {
      const messageId = ++id;
      return new Promise((resolve, reject) => {
        pending.set(messageId, { resolve, reject });
        const payload = { id: messageId, method, params };
        if (sessionId) payload.sessionId = sessionId;
        ws.send(JSON.stringify(payload));
      });
    },
    close() {
      try { ws.close(); } catch { /* ignore */ }
      for (const [messageId, waiter] of pending) {
        pending.delete(messageId);
        waiter.reject(new Error('cdp_closed'));
      }
    },
  };
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(String(raw)); } catch { return; }
    if (msg.id && pending.has(msg.id)) {
      const waiter = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) waiter.reject(new Error(JSON.stringify(msg.error)));
      else waiter.resolve(msg.result);
    }
  });
  return api;
}

export function httpGetJson({ host = '127.0.0.1', port, path: urlPath, timeoutMs = 5000 }) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host, port, path: urlPath, timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(data.slice(0, 300))); }
      });
    });
    req.on('timeout', () => {
      req.destroy();
      reject(Object.assign(new Error('CDP_UNREACHABLE'), { code: REASON.CDP_UNREACHABLE }));
    });
    req.on('error', (error) => reject(error));
  });
}

export async function connectBrowser(versionInfo) {
  const url = versionInfo?.webSocketDebuggerUrl;
  if (!url) throw Object.assign(new Error('CDP_UNREACHABLE'), { code: REASON.CDP_UNREACHABLE });
  let WebSocket;
  try {
    ({ default: WebSocket } = await import('ws'));
  } catch (error) {
    throw Object.assign(new Error('缺少依赖 ws，请在仓库根执行 npm install'), { code: REASON.CDP_UNREACHABLE, cause: error });
  }
  const ws = new WebSocket(url);
  const client = createCdpClient(ws);
  await withTimeout(client.ready, 5000, 'cdp-ws');
  return client;
}

export function createDriverFromClient(client) {
  const sessions = new Map();
  async function sessionFor(targetId) {
    if (sessions.has(targetId)) return sessions.get(targetId);
    const attached = await client.send('Target.attachToTarget', { targetId, flatten: true });
    const sessionId = attached.sessionId;
    sessions.set(targetId, sessionId);
    return sessionId;
  }
  return {
    async createTarget(url) {
      const created = await client.send('Target.createTarget', { url });
      return created.targetId;
    },
    async closeTarget(targetId) {
      sessions.delete(targetId);
      await client.send('Target.closeTarget', { targetId });
    },
    async evaluate(targetId, expression, { awaitPromise = true, timeoutMs = 5000 } = {}) {
      const sessionId = await sessionFor(targetId);
      const raw = await withTimeout(client.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: awaitPromise === true,
      }, sessionId), timeoutMs, 'evaluate');
      if (raw?.exceptionDetails) {
        const text = raw.exceptionDetails.exception?.description || raw.exceptionDetails.text || 'evaluate_exception';
        throw new Error(text);
      }
      return raw?.result?.value;
    },
    async setDocumentContent(targetId, html) {
      const sessionId = await sessionFor(targetId);
      await client.send('Page.enable', {}, sessionId);
      const tree = await client.send('Page.getFrameTree', {}, sessionId);
      const frameId = tree?.frameTree?.frame?.id;
      if (!frameId) throw new Error('no_frame');
      await client.send('Page.setDocumentContent', { frameId, html }, sessionId);
    },
    async captureScreenshot(targetId) {
      const sessionId = await sessionFor(targetId);
      try { await client.send('Page.enable', {}, sessionId); } catch { /* already enabled */ }
      const shot = await client.send('Page.captureScreenshot', { format: 'png' }, sessionId);
      if (!shot?.data) throw new Error('empty_screenshot');
      return shot.data;
    },
    close() { client.close(); },
  };
}

export function startReportServer() {
  const events = [];
  let resolveResult;
  let rejectResult;
  let settled = false;
  const resultPromise = new Promise((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  const finish = (fn, value) => {
    if (settled) return;
    settled = true;
    fn(value);
  };
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    const chunks = [];
    if (req.method === 'POST') {
      for await (const chunk of req) chunks.push(chunk);
    }
    let body = {};
    try {
      body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') : {};
    } catch {
      res.writeHead(400); res.end('bad'); return;
    }
    if (req.method === 'POST' && req.url === '/event') {
      events.push(body);
      console.log(JSON.stringify({ event: 'page_event', sectionHint: body?.kind || body?.step || body?.event || null, ...Object.fromEntries(Object.entries(body).slice(0, 8)) }));
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (req.method === 'POST' && req.url === '/result') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      finish(resolveResult, { body, events });
      return;
    }
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    res.writeHead(404); res.end('no');
  });
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        server,
        port: server.address().port,
        events,
        resultPromise,
        rejectResult: (error) => finish(rejectResult, error),
      });
    });
    server.on('error', reject);
  });
}

function targetIdOf(target) {
  return target?.id || target?.targetId || null;
}

async function readManifest(driver, extId, timeoutMs) {
  const url = `chrome-extension://${extId}/manifest.json`;
  let targetId = null;
  try {
    targetId = await withTimeout(driver.createTarget(url), timeoutMs, 'manifest-open');
  } catch (error) {
    return { errorText: String(error?.message || error), url, bodyText: '', title: '', targetId };
  }
  try {
    const value = await withTimeout(
      driver.evaluate(targetId, manifestProbeExpression(), { awaitPromise: false, timeoutMs }),
      timeoutMs,
      'manifest-eval',
    );
    return {
      errorText: '',
      url: value?.href || url,
      bodyText: value?.bodyText || '',
      title: value?.title || '',
      targetId,
    };
  } catch (error) {
    return { errorText: String(error?.message || error), url, bodyText: '', title: '', targetId };
  }
}

async function runBackgroundProbe(driver, { extId, manifestTargetId, workerTargetId, timeoutMs = 5000 }) {
  const budget = Math.min(5000, timeoutMs);
  const started = Date.now();
  const remaining = () => Math.max(0, budget - (Date.now() - started));
  let targetId = manifestTargetId;
  if (!targetId) {
    targetId = await driver.createTarget(`chrome-extension://${extId}/manifest.json`);
  }
  try {
    await withTimeout(driver.setDocumentContent(targetId, BG_PROBE_HTML), Math.min(1000, Math.max(200, remaining())), 'bg-html');
  } catch { /* JSON document may still be an extension page */ }
  const expression = bgProbeExpression(Math.max(500, Math.min(4000, remaining() - 200)));
  let timedOut = false;
  let result;
  const pageBudget = workerTargetId ? Math.min(remaining(), 2500) : remaining();
  try {
    result = await withTimeout(
      driver.evaluate(targetId, expression, { awaitPromise: true, timeoutMs: pageBudget }),
      pageBudget,
      'bg-probe',
    );
  } catch (error) {
    timedOut = error?.code === 'TIMEOUT' || /timeout_/i.test(String(error?.message || error));
    result = { error: String(error?.message || error) };
  }
  let interpreted = interpretBgProbe(result, timedOut);
  if (interpreted.reason === 'NO_RUNTIME' && workerTargetId && remaining() > 200) {
    const swBudget = remaining();
    timedOut = false;
    try {
      result = await withTimeout(
        driver.evaluate(workerTargetId, bgProbeExpression(Math.max(500, swBudget - 200)), { awaitPromise: true, timeoutMs: swBudget }),
        swBudget,
        'bg-probe-sw',
      );
    } catch (error) {
      timedOut = error?.code === 'TIMEOUT' || /timeout_/i.test(String(error?.message || error));
      result = { error: String(error?.message || error) };
    }
    interpreted = interpretBgProbe(result, timedOut);
    if (interpreted.reason === 'NO_RUNTIME') interpreted = { reason: REASON.BG_NO_RESPONSE, result };
  }
  return interpreted;
}

function looksLicenseBlocked(body) {
  return /license|entitlement|禁止填写|not_allowed_to_fill|requireSigned|signedEntitlement/i.test(JSON.stringify(body || {}));
}

async function closeQuiet(driver, targetId) {
  if (!targetId) return;
  try { await driver.closeTarget(targetId); } catch { /* ignore */ }
}

function writeJson(file, value, writeFile) {
  writeFile(file, JSON.stringify(value, null, 2));
}

export async function runPaidHandoff(options = {}) {
  const env = options.env || process.env;
  const config = options.config || readConfig(env);
  const repoRoot = options.repoRoot || repoRootDefault;
  const now = options.now || (() => new Date());
  const sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const writeFile = options.writeFile || fs.writeFileSync;
  const mkdir = options.mkdir || fs.mkdirSync;
  const fetchJson = options.fetchJson || ((port, urlPath) => httpGetJson({ port, path: urlPath, timeoutMs: 5000 }));
  const createDriver = options.createDriver || (async (version) => createDriverFromClient(await connectBrowser(version)));
  const openReportServer = options.startReportServer || startReportServer;
  const runId = options.runId || makeRunId(now());
  const paths = evidencePaths({ repoRoot, port: config.port, runId });
  mkdir(paths.dir, { recursive: true });

  const failPreflight = (reason, detail = {}) => {
    const hint = hintFor(reason, detail);
    const payload = {
      ok: false,
      reason,
      hint,
      cdpPort: config.port,
      extId: config.extId,
      runId,
      at: now().toISOString(),
      missingHosts: detail.missingHosts || [],
      detail: detail.detail || null,
    };
    writeJson(paths.preflightFail, payload, writeFile);
    console.log(hint);
    console.log(JSON.stringify({ event: 'preflight_fail', reason, hint, evidence: paths.preflightFail }));
    console.log(`PAID_QA_SUMMARY=${paths.preflightFail}`);
    return { exitCode: 2, reason, hint, summaryPath: paths.preflightFail, results: [] };
  };

  let version;
  let targets;
  try {
    version = await fetchJson(config.port, '/json/version');
    targets = await fetchJson(config.port, '/json/list');
  } catch (error) {
    return failPreflight(REASON.CDP_UNREACHABLE, { detail: String(error?.message || error) });
  }
  if (!Array.isArray(targets)) targets = [];

  let driver;
  try {
    driver = await createDriver(version);
  } catch (error) {
    return failPreflight(REASON.CDP_UNREACHABLE, { detail: String(error?.message || error) });
  }

  try {
    const worker = findExtensionWorker(targets, config.extId);
    const manifest = await readManifest(driver, config.extId, 5000);
    const extensionReason = classifyManifestProbe(manifest, { hasWorker: !!worker });
    if (extensionReason) {
      await closeQuiet(driver, manifest.targetId);
      return failPreflight(extensionReason, { detail: { url: manifest.url, title: manifest.title, errorText: manifest.errorText } });
    }

    const hosts = requiredHostsForSections(config.sections);
    const missingHosts = missingSiteHosts(targets, hosts);
    if (missingHosts.length) {
      await closeQuiet(driver, manifest.targetId);
      return failPreflight(REASON.SITE_TAB_MISSING, { missingHosts });
    }
    if (!config.sections.length) {
      await closeQuiet(driver, manifest.targetId);
      const summary = {
        at: now().toISOString(),
        runId,
        cdpPort: config.port,
        extId: config.extId,
        only: config.only,
        sections: config.unknown.map((id) => ({
          section: id,
          status: 'fail',
          reason: 'UNKNOWN_SECTION',
          durationMs: 0,
        })),
      };
      writeJson(paths.summary, summary, writeFile);
      console.log(`PAID_QA_SUMMARY=${paths.summary}`);
      return { exitCode: 1, reason: 'UNKNOWN_SECTION', hint: null, summaryPath: paths.summary, results: [] };
    }

    if (config.enableBgProbe) {
      console.log(JSON.stringify({ event: 'bg_probe_begin', timeoutMs: 5000 }));
      const probed = await runBackgroundProbe(driver, {
        extId: config.extId,
        manifestTargetId: manifest.targetId,
        workerTargetId: targetIdOf(worker),
        timeoutMs: 5000,
      });
      console.log(JSON.stringify({ event: 'bg_probe_done', reason: probed.reason }));
      if (probed.reason === REASON.BG_NO_RESPONSE) {
        await closeQuiet(driver, manifest.targetId);
        return failPreflight(REASON.BG_NO_RESPONSE, { detail: probed.result || null });
      }
    }
    await closeQuiet(driver, manifest.targetId);

    let staleAutoStuck = false;
    for (const stale of staleAutoTargets(targets, config.extId)) {
      const staleId = targetIdOf(stale);
      try {
        const snap = await withTimeout(
          driver.evaluate(staleId, autoPageSnapshotExpression(), { awaitPromise: false, timeoutMs: 1500 }),
          1500,
          'stale-auto',
        );
        if (classifyStuckAutoPage(snap) === REASON.BG_NO_RESPONSE) staleAutoStuck = true;
      } catch { /* leftover tab may already be dead */ }
      await closeQuiet(driver, staleId);
    }
    if (staleAutoStuck) {
      console.log(JSON.stringify({ event: 'stale_auto_stuck', reason: REASON.BG_NO_RESPONSE }));
    }

    console.log(JSON.stringify({ event: 'cdp_attached', port: config.port, ext: config.extId, runId }));
    const results = [];
    for (const section of config.sections) {
      results.push(await runSection({
        section,
        driver,
        config,
        fetchJson,
        openReportServer,
        sleep,
        now,
        writeFile,
        paths,
      }));
    }

    const summary = {
      at: now().toISOString(),
      runId,
      cdpPort: config.port,
      extId: config.extId,
      only: config.only,
      staleAutoStuck,
      sections: [
        ...results.map((row) => row.summary),
        ...config.unknown.map((id) => ({
          section: id,
          status: 'fail',
          reason: 'UNKNOWN_SECTION',
          durationMs: 0,
        })),
      ],
    };
    writeJson(paths.summary, summary, writeFile);
    const exitCode = summary.sections.every((row) => row.status === 'pass') ? 0 : 1;
    console.log(JSON.stringify({ event: 'partial_summary', summaryPath: paths.summary, sections: summary.sections }));
    console.log(`PAID_QA_SUMMARY=${paths.summary}`);
    return { exitCode, reason: null, hint: null, summaryPath: paths.summary, results };
  } finally {
    try { driver.close?.(); } catch { /* ignore */ }
  }
}

async function runSection({ section, driver, config, fetchJson, openReportServer, sleep, now, writeFile, paths }) {
  const startedAt = now().toISOString();
  const startedMs = Date.now();
  const jsonPath = path.join(paths.dir, `${section.id}.json`);
  const pngPath = path.join(paths.dir, `${section.id}.png`);
  console.log(JSON.stringify({ event: 'section_start', id: section.id }));

  const finish = (row) => {
    const durationMs = Date.now() - startedMs;
    const status = row.status || sectionStatus({ ok: row.ok, reason: row.reason });
    const counts = extractFillCounts(row.body);
    const evidence = {
      ok: row.ok === true,
      reason: row.reason || null,
      section: section.id,
      site: section.site,
      status,
      cdpPort: config.port,
      extId: config.extId,
      startedAt,
      durationMs,
      helpNeeded: row.body?.helpNeeded === true || status !== 'pass',
      writeAttempted: row.body?.writeAttempted === true,
      licenseBlocked: looksLicenseBlocked(row.body),
      saveClicksBefore: row.saveClicksBefore || [],
      saveClicksAfter: row.saveClicksAfter || [],
      snapshot: row.snapshot || null,
      screenshotError: row.screenshotError || null,
      body: row.body || null,
      events: row.events || [],
      bodySummary: row.body ? {
        ok: row.body.ok,
        mode: row.body.mode,
        reason: row.body.reason || row.body.job?.reason || null,
        helpNeeded: row.body.helpNeeded,
        helpUrl: row.body.helpUrl || null,
        pageUrl: row.body.pageUrl || row.body.job?.pageUrl || null,
        state: row.body.job?.state || row.body.readiness?.pageState || row.body.state || null,
        message: row.body.message || row.body.error || null,
      } : null,
    };
    writeJson(jsonPath, evidence, writeFile);
    if (row.pngBase64) {
      writeFile(pngPath, Buffer.from(row.pngBase64, 'base64'));
    }
    const summary = {
      section: section.id,
      site: section.site,
      status,
      durationMs,
      reason: row.reason || null,
      evidenceJson: jsonPath,
      evidencePng: row.pngBase64 ? pngPath : null,
      ...counts,
    };
    console.log(JSON.stringify({ event: status === 'pass' ? 'section_done' : 'section_error', section: section.id, status, reason: summary.reason, evidence: jsonPath }));
    return { summary, evidence };
  };

  let targets = [];
  try {
    targets = await fetchJson(config.port, '/json/list');
  } catch (error) {
    return finish({ ok: false, reason: REASON.CDP_UNREACHABLE, body: { ok: false, reason: String(error?.message || error) } });
  }
  const siteTab = findSiteTab(targets, SITE_HOSTS[section.site]);
  if (!siteTab) {
    return finish({
      ok: false,
      reason: REASON.SITE_TAB_MISSING,
      body: { ok: false, reason: REASON.SITE_TAB_MISSING, helpNeeded: true, writeAttempted: false },
    });
  }
  const siteTargetId = targetIdOf(siteTab);

  let saveClicksBefore = [];
  try {
    await driver.evaluate(siteTargetId, saveClickGuardSource(), { awaitPromise: false, timeoutMs: 5000 });
    saveClicksBefore = await driver.evaluate(siteTargetId, READ_SAVE_CLICKS, { awaitPromise: false, timeoutMs: 5000 }) || [];
  } catch (error) {
    return finish({ ok: false, reason: 'SAVE_GUARD_INSTALL_FAILED', body: { ok: false, reason: String(error?.message || error), helpNeeded: true, writeAttempted: false } });
  }
  if (saveClicksBefore.length) {
    return finish({
      ok: false,
      reason: REASON.SAVE_CLICK_FORBIDDEN,
      saveClicksBefore,
      body: { ok: false, reason: REASON.SAVE_CLICK_FORBIDDEN, helpNeeded: true, writeAttempted: false },
    });
  }

  const report = await openReportServer();
  let reloadId = null;
  let autoId = null;
  let autoOpened = false;
  let timer;
  try {
    timer = setTimeout(() => {
      report.rejectResult(Object.assign(new Error(`timeout_${config.timeoutMs}`), { code: 'TIMEOUT' }));
    }, config.timeoutMs);
    const reloadUrl = `chrome-extension://${config.extId}/${section.autoPath}?mode=reload&reportPort=${report.port}`;
    console.log(JSON.stringify({ event: 'open_reload', reloadUrl }));
    reloadId = await driver.createTarget(reloadUrl);
    await sleep(config.reloadWaitMs);
    const autoUrl = `chrome-extension://${config.extId}/${section.autoPath}?${section.qs(report.port)}`;
    console.log(JSON.stringify({ event: 'open_auto', autoUrl }));
    autoId = await driver.createTarget(autoUrl);
    autoOpened = true;
    const outcome = await report.resultPromise;
    clearTimeout(timer);
    const saveClicksAfter = await readClicks(driver, siteTargetId);
    const shot = await shotOf(driver, siteTargetId);
    if (saveClicksAfter.length || reportsForbiddenClick(outcome.body)) {
      return finish({
        ok: false,
        reason: REASON.SAVE_CLICK_FORBIDDEN,
        saveClicksBefore,
        saveClicksAfter,
        body: outcome.body,
        events: outcome.events,
        pngBase64: shot.data,
        screenshotError: shot.error,
      });
    }
    const verified = basicFillVerified(section, outcome.body);
    const ok = outcome.body?.ok === true && verified;
    return finish({
      ok,
      reason: ok ? null : (outcome.body?.reason || outcome.body?.job?.reason
        || (!verified ? REASON.AUTO_FILL_NOT_VERIFIED : 'section_failed')),
      saveClicksBefore,
      saveClicksAfter,
      body: outcome.body,
      events: outcome.events,
      pngBase64: shot.data,
      screenshotError: shot.error,
    });
  } catch (error) {
    clearTimeout(timer);
    const timedOut = error?.code === 'TIMEOUT' || /^timeout_\d+/.test(String(error?.message || error));
    let snapshot = null;
    if (autoId) {
      try {
        snapshot = await driver.evaluate(autoId, autoPageSnapshotExpression(), { awaitPromise: false, timeoutMs: 5000 });
      } catch { /* page may already be gone */ }
    }
    const saveClicksAfter = await readClicks(driver, siteTargetId);
    const shot = await shotOf(driver, siteTargetId);
    if (saveClicksAfter.length) {
      return finish({
        ok: false,
        reason: REASON.SAVE_CLICK_FORBIDDEN,
        saveClicksBefore,
        saveClicksAfter,
        snapshot,
        events: report.events,
        pngBase64: shot.data,
        screenshotError: shot.error,
        body: { ok: false, reason: REASON.SAVE_CLICK_FORBIDDEN, helpNeeded: true, writeAttempted: false },
      });
    }
    const reason = timedOut
      ? (classifyNoReport({ autoOpened, events: report.events, reportPosted: false, snapshot }) || `timeout_${config.timeoutMs}`)
      : String(error?.message || error);
    return finish({
      ok: false,
      reason,
      saveClicksBefore,
      saveClicksAfter,
      snapshot,
      events: report.events,
      pngBase64: shot.data,
      screenshotError: shot.error,
      body: { ok: false, reason, helpNeeded: true, writeAttempted: false },
    });
  } finally {
    clearTimeout(timer);
    try { report.server.close(); } catch { /* ignore */ }
    await closeQuiet(driver, reloadId);
    await closeQuiet(driver, autoId);
  }
}

async function readClicks(driver, targetId) {
  try {
    return await driver.evaluate(targetId, READ_SAVE_CLICKS, { awaitPromise: false, timeoutMs: 5000 }) || [];
  } catch {
    return [];
  }
}

async function shotOf(driver, targetId) {
  try {
    return { data: await driver.captureScreenshot(targetId), error: null };
  } catch (error) {
    return { data: null, error: String(error?.message || error) };
  }
}

export async function main(options = {}) {
  const outcome = await runPaidHandoff(options);
  return outcome.exitCode;
}
