import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import {
  BG_PROBE_HTML,
  HINTS,
  PAID_EXT_ID,
  REASON,
  SITE_HOSTS,
  autoPageSnapshotExpression,
  bgProbeExpression,
  classifyManifestProbe,
  classifyNoReport,
  classifyStuckAutoPage,
  createCdpClient,
  evidencePaths,
  extractFillCounts,
  findExtensionWorker,
  findSiteTab,
  hintFor,
  interpretBgProbe,
  missingSiteHosts,
  readConfig,
  requiredHostsForSections,
  runPaidHandoff,
  saveClickGuardSource,
  sectionStatus,
  staleAutoTargets,
  startReportServer,
  SECTIONS,
} from '../scripts/lib/paid-qa-runner.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXT = PAID_EXT_ID;
const LIVE_STUCK_TEXT = '正在请求后台 GTH_BASIC_AUTO（mode=fill）…\n{"educationIndex":5,"replaceExisting":true,"openIfMissing":true,"reportPort":53754}';

function baseTargets(extra = []) {
  return [
    { id: 'sw', type: 'service_worker', url: `chrome-extension://${EXT}/src/background/worker.mjs` },
    { id: 'cms-tab', type: 'page', url: 'https://wecruit.hotjob.cn/resumeOperation.html?from=qa' },
    { id: 'gth-tab', type: 'page', url: 'https://hr.gtht.com/resume/edit/' },
    { id: 'edge-ext', type: 'page', url: 'edge://extensions/' },
    ...extra,
  ];
}

function createMockDriver(state = {}) {
  const calls = [];
  const driver = {
    calls,
    async createTarget(url) {
      calls.push(['create', url]);
      return `t${calls.length}`;
    },
    async closeTarget(id) {
      calls.push(['close', id]);
    },
    async setDocumentContent(_id, html) {
      calls.push(['html', html === BG_PROBE_HTML]);
      assert.equal(html.includes('paid-qa-bg-probe'), true);
    },
    async evaluate(targetId, expression) {
      const evalKind = expression.includes('PAID_QA_BG_PING')
        ? 'ping'
        : expression.includes('lastReport')
          ? 'snap'
          : expression.includes('__rqfSaveClicks')
            ? 'clicks'
            : 'other';
      calls.push(['eval', targetId, evalKind]);
      if (expression.includes('PAID_QA_BG_PING')) {
        if (state.probeError) throw state.probeError;
        return state.probeResult ?? { ok: true, answered: true, resp: null, lastError: null };
      }
      if (expression.includes('__rqfSaveGuardInstalled')) return true;
      if (expression.includes('lastReport')) {
        if (targetId === 'stale-1') {
          return state.staleSnapshot ?? { bodyText: '', lastReport: null, readyState: 'complete', errors: null };
        }
        return state.autoSnapshot ?? { bodyText: 'done', lastReport: null, readyState: 'complete', errors: null };
      }
      if (expression.includes('__rqfSaveClicks')) {
        state.clickReads = (state.clickReads || 0) + 1;
        if (state.clickReads === 1) return state.clicksBefore ?? [];
        return state.clicksAfter ?? [];
      }
      if (expression.includes('document.title')) {
        return state.manifest ?? {
          href: `chrome-extension://${EXT}/manifest.json`,
          title: 'manifest',
          bodyText: '{ "manifest_version": 3 }',
        };
      }
      throw new Error(`unexpected expression ${expression.slice(0, 100)}`);
    },
    async captureScreenshot() {
      if (state.screenshotError) throw new Error(state.screenshotError);
      return Buffer.from('PNG').toString('base64');
    },
    close() {
      calls.push(['ws-close']);
    },
  };
  return driver;
}

function okServer(body, events = [{ event: 'auto_begin', at: 1 }]) {
  return {
    server: { close() {} },
    port: 53754,
    events,
    resultPromise: Promise.resolve({ body, events }),
    rejectResult() {},
  };
}

function hangingServer(events = [{ event: 'auto_begin', at: 1 }]) {
  let rejectResult;
  const resultPromise = new Promise((resolve, reject) => {
    rejectResult = reject;
  });
  return {
    server: { close() {} },
    port: 53754,
    events,
    resultPromise,
    rejectResult,
  };
}

async function runWith(dir, { targets, env, state, server, fetchError, connectError }) {
  const driver = createMockDriver(state);
  const outcome = await runPaidHandoff({
    env: {
      CDP_PORT: '9239',
      RESUME_EXT_ID: EXT,
      ONLY: 'cms-basic',
      AUTO_TIMEOUT_MS: '250',
      RELOAD_WAIT_MS: '0',
      PAID_QA_BG_PROBE: '1',
      ...env,
    },
    repoRoot: dir,
    runId: 'run1',
    now: () => new Date('2026-10-19T12:07:38.357Z'),
    sleep: async () => {},
    fetchJson: async (_port, urlPath) => {
      if (fetchError) throw fetchError;
      if (urlPath === '/json/version') return { webSocketDebuggerUrl: 'ws://127.0.0.1:9239/devtools/browser/test' };
      if (urlPath === '/json/list') return targets ?? baseTargets();
      throw new Error(`unexpected path ${urlPath}`);
    },
    createDriver: async () => {
      if (connectError) throw connectError;
      return driver;
    },
    startReportServer: async () => (typeof server === 'function' ? server() : (server || okServer({ ok: true, mode: 'fill', helpNeeded: false, writeAttempted: true, filled: 2, expected: 6 }))),
  });
  return { outcome, driver };
}

test('evidence path builder uses paid-edge-<port>/<runId>', () => {
  const paths = evidencePaths({ repoRoot: '/repo', port: 9239, runId: 'run1', sectionId: 'cms-basic' });
  assert.equal(paths.dir, path.join('/repo', 'dist', 'auto-runs', 'paid-edge-9239', 'run1'));
  assert.equal(paths.summary, path.join(paths.dir, 'summary.json'));
  assert.equal(paths.preflightFail, path.join(paths.dir, 'preflight-fail.json'));
  assert.equal(paths.sectionJson, path.join(paths.dir, 'cms-basic.json'));
  assert.equal(paths.sectionPng, path.join(paths.dir, 'cms-basic.png'));
});

test('site host requirements follow ONLY sections', () => {
  const cms = SECTIONS.filter((section) => section.id === 'cms-basic');
  const both = SECTIONS.filter((section) => section.id === 'cms-basic' || section.id === 'gth-basic');
  assert.deepEqual(requiredHostsForSections(cms), [SITE_HOSTS.cms]);
  assert.deepEqual(requiredHostsForSections(both), [SITE_HOSTS.cms, SITE_HOSTS.gth]);
  const targets = baseTargets();
  assert.equal(findSiteTab(targets, SITE_HOSTS.cms).id, 'cms-tab');
  assert.deepEqual(missingSiteHosts(targets.filter((target) => target.id !== 'gth-tab'), [SITE_HOSTS.gth]), [SITE_HOSTS.gth]);
  assert.equal(findSiteTab([{ type: 'service_worker', url: 'https://hr.gtht.com/resume/edit/' }], SITE_HOSTS.gth), null);
});

test('extension worker and stale auto tabs are detected from the target list', () => {
  const targets = baseTargets([
    { id: 'stale-1', type: 'page', url: `chrome-extension://${EXT}/src/auto/gth-basic-auto.html?mode=fill&openIfMissing=1&reportPort=53754`, title: 'GTH 基本信息自动就绪' },
  ]);
  assert.equal(findExtensionWorker(targets, EXT).id, 'sw');
  assert.equal(findExtensionWorker(targets.filter((target) => target.id !== 'sw'), EXT), null);
  assert.equal(staleAutoTargets(targets, EXT).length, 1);
});

test('manifest probe reason codes prefer ERR_BLOCKED_BY_CLIENT', () => {
  assert.equal(classifyManifestProbe({ bodyText: '{ "manifest_version": 3 }' }, { hasWorker: true }), null);
  assert.equal(classifyManifestProbe({ bodyText: '' }, { hasWorker: false }), REASON.EXT_NOT_LOADED);
  assert.equal(
    classifyManifestProbe({ url: 'chrome-error://chromewebdata/', errorText: 'net::ERR_BLOCKED_BY_CLIENT' }, { hasWorker: false }),
    REASON.EXT_BLOCKED_BY_CLIENT,
  );
  assert.equal(
    classifyManifestProbe({ title: 'net::ERR_BLOCKED_BY_CLIENT' }, { hasWorker: true }),
    REASON.EXT_BLOCKED_BY_CLIENT,
  );
});

test('stuck auto page from the 2026-10-19 Edge 9239 run is BG_NO_RESPONSE', () => {
  const snapshot = {
    bodyText: LIVE_STUCK_TEXT,
    lastReport: null,
    errors: null,
    readyState: 'complete',
    status: '正在请求后台 GTH_BASIC_AUTO（mode=fill）…',
  };
  assert.equal(classifyStuckAutoPage(snapshot), REASON.BG_NO_RESPONSE);
  assert.equal(classifyNoReport({ autoOpened: true, events: [{ event: 'auto_begin' }], snapshot }), REASON.BG_NO_RESPONSE);
  assert.equal(classifyStuckAutoPage({ ...snapshot, lastReport: { ok: false } }), null);
  assert.equal(
    classifyNoReport({ autoOpened: true, events: [{ event: 'open_reload' }, { event: 'auto_begin' }], snapshot: { bodyText: '已打开', lastReport: null } }),
    REASON.AUTO_PAGE_NO_REPORT,
  );
  assert.equal(classifyNoReport({ autoOpened: false, events: [], snapshot: null }), null);
});

test('background ping timeout is BG_NO_RESPONSE and a port-closed answer is not', () => {
  assert.equal(interpretBgProbe({ pending: true, reason: 'BG_NO_RESPONSE' }, false).reason, REASON.BG_NO_RESPONSE);
  assert.equal(interpretBgProbe(null, true).reason, REASON.BG_NO_RESPONSE);
  assert.equal(
    interpretBgProbe({ ok: true, answered: true, lastError: 'The message port closed before a response was received.' }, false).reason,
    null,
  );
  assert.equal(interpretBgProbe({ reason: 'NO_RUNTIME' }, false).reason, 'NO_RUNTIME');
  assert.match(bgProbeExpression(4000), /PAID_QA_BG_PING/);
  assert.match(autoPageSnapshotExpression(), /lastReport/);
});

test('section status and fill counts', () => {
  assert.equal(sectionStatus({ ok: true, reason: null }), 'pass');
  assert.equal(sectionStatus({ ok: false, reason: REASON.BG_NO_RESPONSE }), 'timeout');
  assert.equal(sectionStatus({ ok: false, reason: REASON.AUTO_PAGE_NO_REPORT }), 'timeout');
  assert.equal(sectionStatus({ ok: false, reason: 'timeout_180000' }), 'timeout');
  assert.equal(sectionStatus({ ok: false, reason: REASON.SAVE_CLICK_FORBIDDEN }), 'fail');
  assert.deepEqual(extractFillCounts({ filled: 2, expected: 6 }), { filled: 2, expected: 6 });
  assert.deepEqual(extractFillCounts({
    job: {
      fields: [
        { status: 'verified', reason: 'preexisting_same_value' },
        { status: 'skipped', reason: 'site_readonly' },
      ],
    },
  }), { filled: 1, expected: 2 });
  assert.equal(hintFor(REASON.EXT_NOT_LOADED), HINTS.EXT_NOT_LOADED);
  assert.match(hintFor(REASON.SITE_TAB_MISSING, { missingHosts: ['wecruit.hotjob.cn'] }), /wecruit\.hotjob\.cn/);
  assert.match(HINTS.EXT_BLOCKED_BY_CLIENT, /edge:\/\/extensions/);
});

test('save-click guard records capture-phase 保存/提交/Save/Submit only', () => {
  const script = `
    const listeners = [];
    const window = {};
    const document = {
      addEventListener(type, fn, capture) {
        listeners.push({ type, fn, capture });
      },
    };
    ${saveClickGuardSource()};
    const fire = (el) => listeners[0].fn({ target: el });
    const el = (text, extra) => Object.assign({
      tagName: 'BUTTON',
      innerText: text,
      textContent: text,
      value: '',
      parentElement: null,
      getAttribute: () => null,
    }, extra || {});
    fire(el('保存'));
    fire(el('提交简历'));
    fire(el('Save draft'));
    fire(el('Submit'));
    fire(el('下一步'));
    fire(el('${'表单说明'.repeat(12)}里面出现保存两个字但不是按钮'));
    fire(el('', { getAttribute: (name) => (name === 'aria-label' ? '提交' : null) }));
    JSON.stringify({
      type: listeners[0].type,
      capture: listeners[0].capture,
      count: listeners.length,
      texts: window.__rqfSaveClicks.map((row) => row.text),
      twice: ${saveClickGuardSource()} === true ? listeners.length : -1,
    });
  `;
  const result = JSON.parse(vm.runInNewContext(script, {}));
  assert.equal(result.type, 'click');
  assert.equal(result.capture, true);
  assert.equal(result.count, 1);
  assert.equal(result.twice, 1);
  assert.deepEqual(result.texts, ['保存', '提交简历', 'Save draft', 'Submit', '提交']);
});

test('CDP client resolves ids, session ids, and errors', async () => {
  const ws = new EventEmitter();
  ws.send = (data) => { ws.sent = JSON.parse(data); };
  ws.close = () => {};
  const client = createCdpClient(ws);
  ws.emit('open');
  await client.ready;
  const pending = client.send('Runtime.evaluate', { expression: '1' }, 'sid-1');
  assert.equal(ws.sent.sessionId, 'sid-1');
  assert.equal(ws.sent.method, 'Runtime.evaluate');
  ws.emit('message', JSON.stringify({ id: ws.sent.id, result: { result: { value: 1 } } }));
  assert.deepEqual(await pending, { result: { value: 1 } });
  const failed = client.send('Target.closeTarget', {});
  ws.emit('message', JSON.stringify({ id: ws.sent.id, error: { message: 'nope' } }));
  await assert.rejects(failed, /nope/);
});

test('local report server records auto_begin and the result body', async () => {
  const handle = await startReportServer();
  try {
    const eventRes = await fetch(`http://127.0.0.1:${handle.port}/event`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: 'auto_begin', autoMode: 'fill' }),
    });
    assert.equal(eventRes.status, 200);
    const resultRes = await fetch(`http://127.0.0.1:${handle.port}/result`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, filled: 1, expected: 6 }),
    });
    assert.equal(resultRes.status, 200);
    const outcome = await handle.resultPromise;
    assert.equal(outcome.body.expected, 6);
    assert.equal(outcome.events[0].event, 'auto_begin');
    const health = await fetch(`http://127.0.0.1:${handle.port}/health`);
    assert.equal(health.status, 200);
  } finally {
    handle.server.close();
  }
});

test('preflight CDP_UNREACHABLE exits 2 without opening targets', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-qa-'));
  const { outcome, driver } = await runWith(dir, { fetchError: new Error('connect ECONNREFUSED') });
  assert.equal(outcome.exitCode, 2);
  assert.equal(outcome.reason, REASON.CDP_UNREACHABLE);
  const file = JSON.parse(fs.readFileSync(outcome.summaryPath, 'utf8'));
  assert.equal(file.reason, REASON.CDP_UNREACHABLE);
  assert.match(file.hint, /CDP/);
  assert.equal(driver.calls.some((call) => call[0] === 'create'), false);
});

test('preflight EXT_NOT_LOADED and EXT_BLOCKED_BY_CLIENT', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-qa-'));
  const missing = await runWith(dir, {
    targets: baseTargets().filter((target) => target.id !== 'sw'),
    state: { manifest: { href: `chrome-extension://${EXT}/manifest.json`, title: '', bodyText: '' } },
  });
  assert.equal(missing.outcome.exitCode, 2);
  assert.equal(missing.outcome.reason, REASON.EXT_NOT_LOADED);
  assert.match(missing.outcome.hint, /加载解压缩的扩展/);

  const blocked = await runWith(dir, {
    targets: baseTargets().filter((target) => target.id !== 'sw'),
    state: { manifest: { href: 'chrome-error://chromewebdata/', title: '', bodyText: 'net::ERR_BLOCKED_BY_CLIENT' } },
  });
  assert.equal(blocked.outcome.reason, REASON.EXT_BLOCKED_BY_CLIENT);
  assert.equal(blocked.outcome.exitCode, 2);
});

test('missing cms or gth site tab fails fast with SITE_TAB_MISSING', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-qa-'));
  const started = Date.now();
  const cms = await runWith(dir, {
    env: { ONLY: 'cms-basic', AUTO_TIMEOUT_MS: '180000' },
    targets: baseTargets().filter((target) => target.id !== 'cms-tab'),
  });
  assert.equal(cms.outcome.exitCode, 2);
  assert.equal(cms.outcome.reason, REASON.SITE_TAB_MISSING);
  assert.ok(Date.now() - started < 3000);
  const payload = JSON.parse(fs.readFileSync(cms.outcome.summaryPath, 'utf8'));
  assert.deepEqual(payload.missingHosts, ['wecruit.hotjob.cn']);
  assert.equal(cms.driver.calls.some((call) => call[0] === 'create' && String(call[1]).includes('mode=fill')), false);

  const gth = await runWith(dir, {
    env: { ONLY: 'gth-basic' },
    targets: baseTargets().filter((target) => target.id !== 'gth-tab'),
  });
  assert.equal(gth.outcome.reason, REASON.SITE_TAB_MISSING);
  assert.deepEqual(JSON.parse(fs.readFileSync(gth.outcome.summaryPath, 'utf8')).missingHosts, ['hr.gtht.com']);
});

test('background probe timeout is preflight BG_NO_RESPONSE within the ping budget', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-qa-'));
  const started = Date.now();
  const { outcome, driver } = await runWith(dir, {
    env: { AUTO_TIMEOUT_MS: '180000' },
    state: { probeError: Object.assign(new Error('timeout_2500'), { code: 'TIMEOUT' }) },
  });
  assert.equal(outcome.exitCode, 2);
  assert.equal(outcome.reason, REASON.BG_NO_RESPONSE);
  assert.ok(Date.now() - started < 3000);
  assert.equal(driver.calls.some((call) => call[0] === 'html' && call[1] === true), true);
  assert.equal(driver.calls.some((call) => call[0] === 'create' && String(call[1]).includes('mode=fill')), false);
  assert.match(fs.readFileSync(outcome.summaryPath, 'utf8'), /BG_NO_RESPONSE/);
});

test('passing section writes summary, counts, and site-tab png', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-qa-'));
  const { outcome } = await runWith(dir, {
    targets: baseTargets([
      { id: 'stale-1', type: 'page', url: `chrome-extension://${EXT}/src/auto/cms-basic-auto.html?mode=fill&reportPort=1` },
    ]),
    state: {
      probeResult: { ok: true, answered: true, lastError: 'The message port closed before a response was received.' },
      staleSnapshot: { bodyText: LIVE_STUCK_TEXT, lastReport: null, readyState: 'complete' },
    },
    server: okServer({
      ok: true,
      mode: 'fill',
      helpNeeded: false,
      writeAttempted: true,
      filled: 2,
      expected: 6,
    }),
  });
  assert.equal(outcome.exitCode, 0);
  const summary = JSON.parse(fs.readFileSync(outcome.summaryPath, 'utf8'));
  assert.equal(summary.sections[0].status, 'pass');
  assert.equal(summary.sections[0].filled, 2);
  assert.equal(summary.sections[0].expected, 6);
  assert.equal(typeof summary.sections[0].durationMs, 'number');
  assert.equal(summary.staleAutoStuck, true);
  const section = JSON.parse(fs.readFileSync(summary.sections[0].evidenceJson, 'utf8'));
  assert.equal(section.writeAttempted, true);
  assert.equal(section.helpNeeded, false);
  assert.equal(fs.readFileSync(summary.sections[0].evidencePng).toString(), 'PNG');
});

test('section timeout on the stuck auto page is BG_NO_RESPONSE and a silent auto page is AUTO_PAGE_NO_REPORT', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-qa-'));
  const stuck = await runWith(dir, {
    env: { ONLY: 'gth-basic', AUTO_TIMEOUT_MS: '80' },
    state: {
      autoSnapshot: {
        bodyText: LIVE_STUCK_TEXT,
        status: '正在请求后台 GTH_BASIC_AUTO（mode=fill）…',
        lastReport: null,
        errors: null,
        readyState: 'complete',
      },
    },
    server: () => hangingServer([{ event: 'auto_begin', at: 1 }]),
  });
  assert.equal(stuck.outcome.exitCode, 1);
  const stuckSummary = JSON.parse(fs.readFileSync(stuck.outcome.summaryPath, 'utf8'));
  assert.equal(stuckSummary.sections[0].status, 'timeout');
  assert.equal(stuckSummary.sections[0].reason, REASON.BG_NO_RESPONSE);
  const stuckJson = JSON.parse(fs.readFileSync(path.join(dir, 'dist', 'auto-runs', 'paid-edge-9239', 'run1', 'gth-basic.json'), 'utf8'));
  assert.equal(stuckJson.helpNeeded, true);
  assert.equal(stuckJson.writeAttempted, false);
  assert.equal(stuckJson.events[0].event, 'auto_begin');

  const silent = await runWith(dir, {
    env: { ONLY: 'cms-basic', AUTO_TIMEOUT_MS: '80' },
    state: { autoSnapshot: { bodyText: '自动页已打开', lastReport: null, readyState: 'complete' } },
    server: () => hangingServer([{ event: 'auto_begin', at: 1 }]),
  });
  const silentSummary = JSON.parse(fs.readFileSync(silent.outcome.summaryPath, 'utf8'));
  assert.equal(silentSummary.sections[0].reason, REASON.AUTO_PAGE_NO_REPORT);
  assert.equal(silentSummary.sections[0].status, 'timeout');
});

test('save clicks before or after fill fail the section and do not dispatch a click', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-qa-'));
  const before = await runWith(dir, {
    state: { clicksBefore: [{ text: '保存', tag: 'BUTTON', at: 1 }] },
  });
  assert.equal(before.outcome.exitCode, 1);
  const beforeSummary = JSON.parse(fs.readFileSync(before.outcome.summaryPath, 'utf8'));
  assert.equal(beforeSummary.sections[0].status, 'fail');
  assert.equal(beforeSummary.sections[0].reason, REASON.SAVE_CLICK_FORBIDDEN);
  assert.equal(before.driver.calls.some((call) => call[0] === 'create' && String(call[1]).includes('mode=fill')), false);

  const after = await runWith(dir, {
    state: { clicksAfter: [{ text: 'Submit', tag: 'BUTTON', at: 2 }] },
    server: okServer({ ok: true, mode: 'fill', helpNeeded: false, writeAttempted: true }),
  });
  const afterSummary = JSON.parse(fs.readFileSync(after.outcome.summaryPath, 'utf8'));
  assert.equal(afterSummary.sections[0].reason, REASON.SAVE_CLICK_FORBIDDEN);
  assert.equal(afterSummary.sections[0].status, 'fail');
});

test('PAID_QA_BG_PROBE=0 skips the ping and still runs the section', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-qa-'));
  const { outcome, driver } = await runWith(dir, { env: { PAID_QA_BG_PROBE: '0' } });
  assert.equal(outcome.exitCode, 0);
  assert.equal(driver.calls.some((call) => call[2] === 'ping'), false);
  assert.equal(driver.calls.some((call) => call[0] === 'html'), false);
});

test('runner source never dispatches a mouse click', () => {
  const files = [
    'scripts/run-paid-handoff-cdp.mjs',
    'scripts/lib/paid-qa-runner.mjs',
    'scripts/win/run-paid-qa.ps1',
  ];
  const src = files.map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
  assert.equal(/dispatchMouseEvent|Input\.dispatch|\.click\(/.test(src), false);
  const ps1 = fs.readFileSync(path.join(root, 'scripts/win/run-paid-qa.ps1'), 'utf8');
  assert.match(ps1, /param\(/);
  assert.match(ps1, /\$Port = 9239/);
  assert.match(ps1, /decggijdlhflkjkgmofbclglilpaooij/);
  assert.match(ps1, /cms-basic,gth-basic/);
  assert.match(ps1, /\$TimeoutMs = 180000/);
  assert.equal(ps1.includes("@'"), false);
  assert.match(ps1, /run-paid-handoff-cdp\.mjs/);
  const doc = fs.readFileSync(path.join(root, 'docs/PAID_QA_RUNNER.md'), 'utf8').trimEnd().split('\n');
  assert.ok(doc.length <= 20, `docs/PAID_QA_RUNNER.md has ${doc.length} lines`);
  assert.match(doc.join('\n'), /AUTO_PAGE_NO_REPORT/);
  assert.match(doc.join('\n'), /BG_NO_RESPONSE/);
  const config = readConfig({ ONLY: 'cms-basic,gth-basic', CDP_PORT: '9239' });
  assert.deepEqual(config.sections.map((section) => section.id), ['cms-basic', 'gth-basic']);
});
