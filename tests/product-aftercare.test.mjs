import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { JSDOM } from 'jsdom';
import { manualFields, createLocalErrorReport } from '../src/popup/recent-result.js';

const popup = readFileSync(new URL('../src/popup/popup.js', import.meta.url), 'utf8');
const markup = readFileSync(new URL('../src/popup/popup.html', import.meta.url), 'utf8');
const controller = popup.slice(popup.indexOf('function renderAftercare('), popup.indexOf('async function rememberResult('));
const reasons = popup.match(/const reasons = (\{[\s\S]*?\n\});/u)[1];

test('manual list keeps unresolved rows in order, including duplicate labels and failed ready rows', () => {
  const fields = [
    { reason: 'ready' },
    { labels: ['重复题目'], semanticStatus: 'manual', reason: 'ready' },
    { labels: ['重复题目'], status: 'failed', reason: 'ready' },
    { status: 'skipped', reason: 'ready' },
    { status: 'unsupported', reason: 'ready' },
    { status: 'manual', reason: 'ready' },
    { reason: 'unknown_question' },
    { status: 'verified', reason: 'readback_matched' },
    null,
  ];
  const before = JSON.stringify(fields);
  assert.deepEqual(manualFields(fields).map(row => row.position), [2, 3, 4, 5, 6, 7]);
  assert.equal(manualFields(fields)[0].field, fields[1]);
  assert.deepEqual(manualFields(fields, true).map(row => row.position), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(JSON.stringify(fields), before);
  assert.deepEqual(manualFields(undefined), []);
});

test('local report projects bounded diagnostics and drops all applicant/page/raw-error content', () => {
  const secret = 'PRIVATE_APPLICANT_TOKEN';
  const fields = [
    { status: 'verified', reason: 'readback_matched', value: secret },
    { status: 'failed', reason: 'readback_mismatch', labels: [secret], id: secret,
      url: `https://fixture.invalid/${secret}`, value: secret, currentValue: secret,
      profile: { fullName: secret }, html: `<input value="${secret}">`, error: new Error(secret) },
    { status: secret, reason: secret, labels: [secret], semanticStatus: 'manual' },
    { status: 'skipped', reason: '__proto__', stack: secret },
  ];
  const report = createLocalErrorReport(fields, true);
  assert.deepEqual(report, {
    schemaVersion: 1, localOnly: true, liveSupportClaimed: false, neverSave: true,
    stage: 'fill_readback', result: 'fields_returned', fieldCount: 4, manualCount: 3,
    manual: [
      { position: 2, outcome: 'failed', reason: 'readback_mismatch' },
      { position: 3, outcome: 'unverified', reason: 'unclassified' },
      { position: 4, outcome: 'skipped', reason: 'unclassified' },
    ],
  });
  assert.equal(JSON.stringify(report).includes(secret), false);
  assert.equal(JSON.stringify(report).includes('https:'), false);
});

test('empty and failed operations produce redacted reports without fabricating field results', () => {
  for (const fields of [undefined, null, []]) {
    const report = createLocalErrorReport(fields, false, true);
    assert.equal(report.result, 'operation_failed');
    assert.equal(report.stage, 'inspect');
    assert.equal(report.fieldCount, 0);
    assert.equal(report.manualCount, 0);
    assert.deepEqual(report.manual, []);
  }
  assert.equal(createLocalErrorReport([], true, true).stage, 'fill_readback');
  assert.equal(createLocalErrorReport([]).result, 'fields_returned');
});

function fixture(t) {
  const dom = new JSDOM(markup, { url: 'https://popup.invalid/', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const { document } = dom.window;
  const elements = Object.fromEntries(Object.entries({
    aftercare: 'aftercare', aftercareTitle: 'aftercare-title', manualList: 'manual-list',
    exportReport: 'export-error-report', aftercareNote: 'aftercare-note',
  }).map(([name, id]) => [name, document.getElementById(id)]));
  const tab = { id: 4, url: 'https://fixture.invalid/form?private=not-exported' };
  const state = { tab, blobs: [], clicks: [], revoked: [], timers: [], forbidden: [], messages: [] };
  const deny = name => () => { state.forbidden.push(name); throw Error(`forbidden:${name}`); };
  const chrome = {
    tabs: { query: async () => {
      if (state.queryError) throw Error('PRIVATE query error');
      return state.queryOverride ? state.queryOverride() : [state.tab];
    }, sendMessage: deny('tabs.sendMessage') },
    runtime: { sendMessage: deny('runtime.sendMessage') },
    storage: { local: { get: deny('storage.get'), set: deny('storage.set'), remove: deny('storage.remove') } },
  };
  dom.window.HTMLFormElement.prototype.submit = deny('form.submit');
  dom.window.HTMLFormElement.prototype.requestSubmit = deny('form.requestSubmit');
  dom.window.HTMLAnchorElement.prototype.click = function () {
    state.clicks.push({ href: this.href, download: this.download });
    if (state.clickError) throw Error('PRIVATE download error');
  };
  const api = runInNewContext(`
    let busy = false, aftercareSnapshot = null;
    const activeTab = ${JSON.stringify(tab)};
    const reasons = ${reasons};
    ${controller}
    ({ render: renderAftercare, download: exportLocalErrorReport,
      busy(value) { busy = value; }, snapshot() { return aftercareSnapshot; } });
  `, {
    document, elements, manualFields, createLocalErrorReport, chrome, Blob,
    URL: { createObjectURL(blob) { state.blobs.push(blob); return 'blob:local-report'; },
      revokeObjectURL(url) { state.revoked.push(url); } },
    setTimeout(callback, delay) { state.timers.push({ callback, delay }); },
    setMessage(...args) { state.messages.push(args); },
    fetch: deny('fetch'), XMLHttpRequest: deny('XMLHttpRequest'), WebSocket: deny('WebSocket'),
    navigator: { sendBeacon: deny('sendBeacon') },
  });
  t.after(() => assert.deepEqual(state.forbidden, []));
  return { api, state, elements, document };
}

test('manual UI renders literal labels, replaces old rows, and clears exportable state', t => {
  const { api, elements, document } = fixture(t);
  assert.equal(elements.aftercare.hidden, true);
  assert.equal(elements.exportReport.disabled, true);
  api.render([{ semanticStatus: 'manual', labels: ['<img src=x onerror=alert(1)>'], reason: 'unknown_question' }]);
  assert.equal(elements.aftercare.hidden, false);
  assert.equal(elements.exportReport.disabled, false);
  assert.match(elements.manualList.textContent, /<img src=x onerror=alert\(1\)>/u);
  assert.equal(elements.manualList.querySelector('img'), null);
  assert.equal(document.querySelectorAll('#manual-list li').length, 1);
  api.render([{ status: 'failed', reason: 'control_error' }], true);
  assert.equal(elements.manualList.children.length, 1);
  assert.match(elements.manualList.textContent, /失败/u);
  assert.equal(elements.manualList.textContent.includes('<img'), false);
  api.render([], false, true);
  assert.match(elements.aftercareNote.textContent, /未取得完整结果/u);
  assert.equal(api.snapshot().report.result, 'operation_failed');
  api.render();
  assert.equal(elements.aftercare.hidden, true);
  assert.equal(elements.exportReport.disabled, true);
  assert.equal(api.snapshot(), null);
  assert.equal(elements.manualList.children.length, 0);
});

test('export creates a local JSON Blob, downloads once, and cleans temporary resources', async t => {
  const { api, state, elements, document } = fixture(t);
  api.render([{ status: 'failed', reason: 'readback_mismatch', labels: ['PRIVATE_LABEL'], value: 'PRIVATE_VALUE' }], true);
  await api.download();
  assert.deepEqual(state.clicks, [{ href: 'blob:local-report', download: 'resume-quick-fill-error-report.json' }]);
  assert.equal(state.blobs[0].type, 'application/json');
  const report = JSON.parse(await state.blobs[0].text());
  assert.deepEqual(report, createLocalErrorReport([{ status: 'failed', reason: 'readback_mismatch' }], true));
  assert.equal(JSON.stringify(report).includes('PRIVATE'), false);
  assert.equal(document.querySelector('[download]'), null);
  assert.equal(state.timers[0].delay, 1000);
  state.timers[0].callback();
  assert.deepEqual(state.revoked, ['blob:local-report']);
  assert.match(elements.aftercareNote.textContent, /下载到本机/u);
});

test('busy, cleared and changed-page snapshots cannot export', async t => {
  const { api, state, elements } = fixture(t);
  await api.download();
  api.busy(true);
  api.render([{ semanticStatus: 'manual' }]);
  assert.equal(elements.exportReport.disabled, true);
  await api.download();
  assert.equal(state.clicks.length, 0);
  api.busy(false);
  state.tab = { ...state.tab, url: 'https://fixture.invalid/another-form' };
  await api.download();
  assert.equal(elements.aftercare.hidden, true);
  assert.equal(api.snapshot(), null);
  assert.equal(state.clicks.length, 0);
  assert.equal(state.messages.length, 1);
});

test('a report invalidated while checking the active tab cannot export', async t => {
  const { api, state } = fixture(t);
  api.render([{ semanticStatus: 'manual' }]);
  let resolveQuery;
  state.queryOverride = () => new Promise(resolve => { resolveQuery = resolve; });
  const download = api.download();
  api.render();
  resolveQuery([state.tab]);
  await download;
  assert.equal(state.blobs.length, 0);
  assert.equal(state.clicks.length, 0);
});

test('download failures show a fixed local error and still release resources', async t => {
  const { api, state, elements, document } = fixture(t);
  api.render([{ semanticStatus: 'manual' }]);
  state.queryError = true;
  await api.download();
  assert.equal(state.blobs.length, 0);
  assert.match(elements.aftercareNote.textContent, /本地导出未完成/u);
  assert.equal(elements.aftercareNote.textContent.includes('PRIVATE'), false);
  state.queryError = false;
  state.clickError = true;
  await api.download();
  assert.equal(document.querySelector('[download]'), null);
  assert.equal(state.timers.length, 1);
  state.timers[0].callback();
  assert.deepEqual(state.revoked, ['blob:local-report']);
  assert.match(elements.aftercareNote.textContent, /本地导出未完成/u);
});
