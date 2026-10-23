import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import {
  BG_PROBE_HTML,
  HINTS,
  PAID_EXT_ID,
  READ_SAVE_CLICKS,
  REASON,
  SAVE_TEXT_RE,
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
  postedReportBreach,
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

// Guard installed on a retained tab by ff0c5dd, before 投递 coverage was added.
const LEGACY_SAVE_GUARD_SOURCE = `(() => {
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
      if (expression === saveClickGuardSource()) {
        if (state.guardInstallError) throw state.guardInstallError;
        return Object.hasOwn(state, 'guardInstallResult') ? state.guardInstallResult : true;
      }
      if (expression.includes('lastReport')) {
        if (targetId === 'stale-1') {
          return state.staleSnapshot ?? { bodyText: '', lastReport: null, readyState: 'complete', errors: null };
        }
        return state.autoSnapshot ?? { bodyText: 'done', lastReport: null, readyState: 'complete', errors: null };
      }
      if (expression.includes('__rqfSaveClicks')) {
        state.clickReads = (state.clickReads || 0) + 1;
        const phase = state.clickReads === 1 ? 'Before' : 'After';
        if (state[`clickReadError${phase}`]) throw state[`clickReadError${phase}`];
        return Object.hasOwn(state, `clicks${phase}`) ? state[`clicks${phase}`] : [];
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

// Synthetic auto-report contract; no employer DOM or live support claim.
function verifiedBasicReport() {
  return {
    ok: true, mode: 'fill', helpNeeded: false, writeAttempted: true,
    softwareClickedSave: false, softwareClickedSubmit: false,
    filled: 2, expected: 6,
    job: {
      state: 'completed', outcome: 'verified', writeStarted: true,
      supportedComplete: true, operableComplete: true,
      softwareClickedSave: false, softwareClickedSubmit: false,
      fields: [{ status: 'verified', reason: 'readback_matched' }],
    },
    fill: { ok: true, softwareClickedSave: false, softwareClickedSubmit: false },
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
    startReportServer: async () => (typeof server === 'function' ? server() : (server || okServer(verifiedBasicReport()))),
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
  assert.equal(sectionStatus({ ok: false, reason: REASON.UNSETTLED_SUCCESS }), 'fail');
  assert.equal(postedReportBreach({ ok: true, mode: 'fill', savedOnSite: null, softwareClickedSave: false }), null);
  assert.equal(postedReportBreach({ ok: true, job: { savedOnSite: true, softwareClickedSave: false } }), REASON.SAVE_CLICK_FORBIDDEN);
  assert.equal(postedReportBreach({ ok: true, job: { state: 'stopped_before_write', softwareClickedSave: false } }), REASON.UNSETTLED_SUCCESS);
  assert.equal(postedReportBreach({ ok: false, reason: 'page_hidden', job: { state: 'stopped_before_write' } }), null);
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

test('save-click guard records capture-phase 保存/提交/投递/Save/Submit only', () => {
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
    fire(el('投递'));
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
  assert.deepEqual(result.texts, ['保存', '提交简历', '投递', 'Save draft', 'Submit', '提交']);
});

for (const site of ['beisen-2022', 'feishu-atsx', 'moka']) {
  test(`paid QA rejects 投递 captured from the existing ${site} fixture`, async () => {
    const fixturePath = path.join(root, 'tests', 'fixtures', `${site}-basic-ambiguous.html`);
    const dom = new JSDOM(fs.readFileSync(fixturePath, 'utf8'), { runScripts: 'outside-only' });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-qa-deliver-'));
    try {
      const button = dom.window.document.getElementById('deliver-btn');
      assert.equal(button.disabled, false);
      assert.equal(button.textContent, '投递');
      assert.equal(SAVE_TEXT_RE.test(button.textContent), true);
      dom.window.eval(saveClickGuardSource());
      button.click();
      const clicksAfter = JSON.parse(JSON.stringify(dom.window.eval(READ_SAVE_CLICKS)));
      assert.equal(clicksAfter.length, 1);
      assert.equal(clicksAfter[0].text, '投递');
      assert.equal(clicksAfter[0].tag, 'BUTTON');
      const { outcome } = await runWith(dir, { state: { clicksAfter } });
      assert.equal(outcome.results[0].summary.status, 'fail');
      assert.equal(outcome.results[0].summary.reason, REASON.SAVE_CLICK_FORBIDDEN);
      assert.deepEqual(outcome.results[0].evidence.saveClicksAfter, clicksAfter);
    } finally {
      dom.window.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test(`paid QA upgrades the existing ${site} fixture legacy guard once and preserves history`, () => {
    const fixturePath = path.join(root, 'tests', 'fixtures', `${site}-basic-ambiguous.html`);
    const dom = new JSDOM(fs.readFileSync(fixturePath, 'utf8'), { runScripts: 'outside-only' });
    try {
      assert.equal(dom.window.eval(LEGACY_SAVE_GUARD_SOURCE), true);
      const history = dom.window.__rqfSaveClicks;
      dom.window.document.getElementById('save-btn').click();
      dom.window.document.getElementById('deliver-btn').click();
      assert.deepEqual(Array.from(history, row => row.text), ['保存']);
      const originalEntry = history[0];
      for (let install = 0; install < 3; install++) {
        assert.equal(dom.window.eval(saveClickGuardSource()), true);
      }
      assert.equal(dom.window.__rqfSaveClicks, history);
      assert.equal(history[0], originalEntry);
      assert.equal(dom.window.__rqfSaveGuardDeliveryCovered, true);
      dom.window.document.getElementById('deliver-btn').click();
      dom.window.document.getElementById('save-btn').click();
      dom.window.document.getElementById('submit-btn').click();
      assert.deepEqual(Array.from(history, row => row.text), ['保存', '投递', '保存', '提交']);
    } finally {
      dom.window.close();
    }
  });
}

test('upgrading a legacy save guard does not repair unavailable history', () => {
  for (const legacy of [
    { __rqfSaveGuardInstalled: true },
    { __rqfSaveGuardInstalled: true, __rqfSaveClicks: null },
    { __rqfSaveGuardInstalled: true, __rqfSaveClicks: {} },
  ]) {
    const window = { ...legacy };
    let listeners = 0;
    assert.equal(vm.runInNewContext(saveClickGuardSource(), {
      window, document: { addEventListener() { listeners++; } },
    }), true);
    assert.deepEqual(window, legacy);
    assert.equal(listeners, 0);
    assert.equal(vm.runInNewContext(READ_SAVE_CLICKS, { window }), null);
  }
});

test('legacy delivery supplement does not duplicate labels already captured by the old guard', () => {
  const listeners = [];
  const window = {};
  const context = {
    window,
    document: { addEventListener(_type, listener) { listeners.push(listener); } },
  };
  vm.runInNewContext(LEGACY_SAVE_GUARD_SOURCE, context);
  vm.runInNewContext(saveClickGuardSource(), context);
  vm.runInNewContext(saveClickGuardSource(), context);
  const labels = ['保存 投递', '提交 投递', 'Save 投递', 'Submit 投递'];
  for (const textContent of labels) {
    for (const listener of listeners) listener({ target: { textContent, tagName: 'BUTTON' } });
  }
  assert.equal(listeners.length, 2);
  assert.deepEqual(Array.from(window.__rqfSaveClicks, row => row.text), labels);
});

test('save guard readback requires the installed guard and an array history', () => {
  for (const window of [
    {},
    { __rqfSaveClicks: [] },
    { __rqfSaveGuardInstalled: true },
    { __rqfSaveGuardInstalled: true, __rqfSaveClicks: {} },
  ]) {
    assert.equal(vm.runInNewContext(READ_SAVE_CLICKS, { window }), null);
  }
  const clicks = [];
  assert.equal(vm.runInNewContext(READ_SAVE_CLICKS, {
    window: { __rqfSaveGuardInstalled: true, __rqfSaveClicks: clicks },
  }), clicks);
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
    server: okServer(verifiedBasicReport()),
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

test('paid QA final save guard readback failure cannot pass a verified report', async () => {
  for (const state of [
    { clickReadErrorAfter: new Error('Execution context was destroyed.') },
    { clicksAfter: null },
    { clicksAfter: {} },
    { clicksAfter: 'unavailable' },
  ]) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-qa-guard-'));
    const body = verifiedBasicReport();
    const { outcome, driver } = await runWith(dir, { state, server: okServer(body) });
    assert.equal(outcome.exitCode, 1);
    const { summary, evidence } = outcome.results[0];
    assert.equal(summary.status, 'fail');
    assert.equal(summary.reason, 'SAVE_GUARD_READBACK_FAILED');
    assert.equal(evidence.ok, false);
    assert.equal(evidence.helpNeeded, true);
    assert.equal(evidence.writeAttempted, true);
    assert.equal(typeof evidence.saveGuardError, 'string');
    if (state.clickReadErrorAfter) assert.match(evidence.saveGuardError, /Execution context was destroyed/);
    assert.deepEqual(evidence.body, body);
    assert.deepEqual(evidence.events, [{ event: 'auto_begin', at: 1 }]);
    assert.equal(fs.readFileSync(summary.evidencePng).toString(), 'PNG');
    assert.equal(driver.calls.filter(call => call[0] === 'close').length, 3);
  }
});

test('paid QA initial save guard readback failure prevents reload and fill launch', async () => {
  for (const state of [
    { guardInstallError: new Error('guard install failed') },
    { guardInstallResult: false },
    { clickReadErrorBefore: new Error('guard read failed') },
    { clicksBefore: null },
    { clicksBefore: {} },
  ]) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-qa-guard-'));
    const { outcome, driver } = await runWith(dir, { state });
    assert.equal(outcome.exitCode, 1);
    assert.equal(outcome.results[0].summary.reason, 'SAVE_GUARD_INSTALL_FAILED');
    assert.equal(typeof outcome.results[0].evidence.saveGuardError, 'string');
    assert.equal(driver.calls.some(call => call[0] === 'create' && String(call[1]).includes('mode=')), false);
  }
});

test('posted Save breach takes precedence over unavailable final save guard readback', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-qa-guard-'));
  const body = verifiedBasicReport();
  body.fill.softwareClickedSave = true;
  const { outcome } = await runWith(dir, {
    state: { clickReadErrorAfter: new Error('guard read failed'), screenshotError: 'screenshot failed' },
    server: okServer(body),
  });
  assert.equal(outcome.results[0].summary.reason, REASON.SAVE_CLICK_FORBIDDEN);
  assert.equal(outcome.results[0].evidence.saveGuardError, 'guard read failed');
  assert.equal(outcome.results[0].evidence.screenshotError, 'screenshot failed');
  assert.deepEqual(outcome.results[0].evidence.body, body);
});

test('timeout keeps its reason and exposes unavailable final save guard readback', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-qa-guard-'));
  const { outcome } = await runWith(dir, {
    env: { AUTO_TIMEOUT_MS: '20' },
    state: { clickReadErrorAfter: new Error('guard read failed') },
    server: () => hangingServer(),
  });
  const { summary, evidence } = outcome.results[0];
  assert.equal(summary.status, 'timeout');
  assert.equal(summary.reason, REASON.AUTO_PAGE_NO_REPORT);
  assert.equal(evidence.saveGuardError, 'guard read failed');
  assert.equal(fs.readFileSync(summary.evidencePng).toString(), 'PNG');
});

test('posted ok with a site save or an unsettled job fails closed without a DOM click', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-qa-'));
  const saved = await runWith(dir, {
    server: okServer({
      ok: true,
      mode: 'fill',
      kind: 'cms_basic_auto',
      saveAttempted: false,
      softwareClickedSave: false,
      job: { state: 'completed', savedOnSite: true, softwareClickedSave: false },
    }),
  });
  assert.equal(saved.outcome.exitCode, 1);
  const savedSummary = JSON.parse(fs.readFileSync(saved.outcome.summaryPath, 'utf8'));
  assert.equal(savedSummary.sections[0].status, 'fail');
  assert.equal(savedSummary.sections[0].reason, REASON.SAVE_CLICK_FORBIDDEN);

  const unsettled = await runWith(dir, {
    server: okServer({
      ok: true,
      mode: 'fill',
      saveAttempted: false,
      job: { state: 'stopped_before_write', softwareClickedSave: false, savedOnSite: null },
    }),
  });
  const unsettledSummary = JSON.parse(fs.readFileSync(unsettled.outcome.summaryPath, 'utf8'));
  assert.equal(unsettledSummary.sections[0].status, 'fail');
  assert.equal(unsettledSummary.sections[0].reason, REASON.UNSETTLED_SUCCESS);
});

test('PAID_QA_BG_PROBE=0 skips the ping and still runs the section', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-qa-'));
  const { outcome, driver } = await runWith(dir, { env: { PAID_QA_BG_PROBE: '0' } });
  assert.equal(outcome.exitCode, 0);
  assert.equal(driver.calls.some((call) => call[2] === 'ping'), false);
  assert.equal(driver.calls.some((call) => call[0] === 'html'), false);
});

for (const section of ['cms-basic', 'gth-basic']) {
  test(`paid QA ${section} rejects a green envelope without verified completion`, async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-qa-'));
    for (const patch of [
      body => { delete body.job; },
      body => { body.mode = 'readiness'; },
      body => { body.job.state = 'unknown'; },
      body => { body.job.state = 'stopped_before_write'; },
      body => { body.job.outcome = 'unknown'; },
      body => { delete body.job.writeStarted; },
      body => { delete body.job.supportedComplete; },
      body => { delete body.job.operableComplete; },
      body => { body.job.operableComplete = false; },
      body => { body.job.fields[0].status = 'unknown'; },
      body => { body.job.fields = []; },
      body => { body.fill.ok = false; },
      body => { delete body.fill; },
      body => { body.job.outcome = 'verified_preexisting'; },
      body => { body.writeAttempted = false; },
      body => {
        body.job.outcome = 'verified_preexisting';
        body.job.writeStarted = false;
        body.writeAttempted = false;
      },
    ]) {
      const body = verifiedBasicReport();
      patch(body);
      const { outcome } = await runWith(dir, { env: { ONLY: section }, server: okServer(body) });
      assert.equal(outcome.exitCode, 1);
      const summary = JSON.parse(fs.readFileSync(outcome.summaryPath, 'utf8'));
      assert.equal(summary.sections[0].status, 'fail');
      assert.equal(summary.sections[0].reason, REASON.UNSETTLED_SUCCESS);
      const evidence = JSON.parse(fs.readFileSync(summary.sections[0].evidenceJson, 'utf8'));
      assert.equal(evidence.ok, false);
      assert.deepEqual(evidence.body, body, 'retain the original report for review');
    }
  });
}

for (const flag of ['softwareClickedSave', 'softwareClickedSubmit', 'savedOnSite', 'submitted']) {
  test(`paid QA rejects reported ${flag} without a captured DOM click and retains evidence`, async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-qa-'));
    for (const location of ['top', 'job', 'fill', 'trial']) {
      const body = verifiedBasicReport();
      if (location === 'top') body[flag] = true;
      else if (location === 'trial') body.fill.trial = { data: { [flag]: true } };
      else body[location][flag] = true;
      const { outcome } = await runWith(dir, { server: okServer(body) });
      assert.equal(outcome.exitCode, 1);
      const summary = JSON.parse(fs.readFileSync(outcome.summaryPath, 'utf8'));
      assert.equal(summary.sections[0].reason, REASON.SAVE_CLICK_FORBIDDEN);
      const evidence = JSON.parse(fs.readFileSync(summary.sections[0].evidenceJson, 'utf8'));
      assert.equal(evidence.ok, false);
      assert.equal(evidence.status, 'fail');
      assert.deepEqual(evidence.saveClicksAfter, []);
      assert.deepEqual(evidence.body, body);
    }
  });
}

test('paid QA accepts explicit verified/preexisting basic reports without Save', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-qa-'));
  for (const section of ['cms-basic', 'gth-basic']) {
    const body = verifiedBasicReport();
    body.job.outcome = 'verified_preexisting';
    body.job.writeStarted = false;
    body.writeAttempted = false;
    body.job.fields[0].reason = 'preexisting_same_value';
    const { outcome } = await runWith(dir, { env: { ONLY: section }, server: okServer(body) });
    assert.equal(outcome.exitCode, 0);
  }
});

test('paid QA keeps the verified GTH phone/email read-only exception', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-qa-'));
  const body = verifiedBasicReport();
  body.job.supportedComplete = false;
  body.job.fields.push({ path: 'phone', status: 'skipped', reason: 'site_readonly', readOnlyState: 'same' });
  const { outcome } = await runWith(dir, { env: { ONLY: 'gth-basic' }, server: okServer(body) });
  assert.equal(outcome.exitCode, 0);
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
