/**
 * Offline tests only: the repository's fictional education fixture, shipped
 * product controller/serialization, and fake CDP. No live site is contacted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { webcrypto } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { integrationFixture } from './fixtures/cms-education-fixture.mjs';
import { hash, validatePlan } from '../src/profile/cms-education-plan.mjs';
import * as runner from '../scripts/live/cms-education-live.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';
const LIVE_URL = `${PAGE}?resumeId=private-applicant-token&tid=private-query#private-fragment`;
const plain = value => JSON.parse(JSON.stringify(value));
const FIELD_IDS = { major: '14_53_0', description: '14_55_0' };
const fixtureHtml = integrationFixture({
  schools: ['虚构学院甲', '虚构学院乙'],
  regions: [
    { province: '虚构省甲', city: '虚构市甲' },
    { province: '虚构省乙', city: '虚构市乙' }
  ]
});

function target(url = LIVE_URL, id = 'education-tab') {
  return { type: 'page', id, url, title: '简历操作', webSocketDebuggerUrl: `ws://127.0.0.1:9239/devtools/page/${id}` };
}

async function educationDom(t, { originals, rowCount = 1, rowIndex = 0, installTrial = true, url = LIVE_URL, mutate } = {}) {
  const dom = new JSDOM(await fixtureHtml, {
    url,
    pretendToBeVisual: true,
    runScripts: 'dangerously',
    beforeParse(window) {
      window.structuredClone = structuredClone;
      window.TextEncoder = TextEncoder;
      Object.defineProperty(window.crypto, 'subtle', { configurable: true, value: webcrypto.subtle });
      window.Element.prototype.getClientRects = function () {
        return this.isConnected ? [{ width: 10, height: 10 }] : [];
      };
    }
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  Object.defineProperty(window.document, 'readyState', { configurable: true, get: () => 'complete' });
  Object.defineProperty(window.document, 'visibilityState', { configurable: true, get: () => 'visible' });
  window.document.hasFocus = () => true;
  window.fetch = async () => ({ ok: true, json: async () => ({ state: 200 }) });
  // Mount extra fictional rows before the Never-Save guard/trial starts.
  for (let index = 1; index < rowCount; index += 1) window.document.querySelector('.add-more').click();
  const inputs = Object.fromEntries(Object.entries(FIELD_IDS).map(([key, id]) => [key,
    window.document.getElementById(id.replace(/_0$/u, `_${Math.min(rowIndex, rowCount - 1)}`)).querySelector('input,textarea')]));
  for (const [key, value] of Object.entries(originals || {})) {
    inputs[key].value = value;
    inputs[key].dispatchEvent(new window.Event('input', { bubbles: true }));
  }
  if (mutate) await mutate(window, inputs);
  const install = installTrial ? window.eval(runner.buildPageExpression(repoRoot, rowIndex)) : null;
  if (install?.ok) {
    for (const rel of runner.LIVE_FILES) window.eval(fs.readFileSync(path.join(repoRoot, rel), 'utf8'));
  }
  return { dom, window, inputs, install, api: window.__cmsEducationLive };
}

test('Windows options, runtime files, and help keep the trial narrowly scoped', () => {
  assert.equal(runner.DEFAULT_PORT, 9239);
  assert.equal(runner.EVIDENCE_NAME, 'cms-education-live.json');
  assert.equal(runner.READBACK_WAIT_MS, 500);
  assert.equal(runner.readPort({}), 9239);
  assert.equal(runner.readPort({ PORT: '9239' }), 9239);
  assert.equal(runner.readRowIndex({}), 0);
  assert.equal(runner.readRowIndex({ ROW_INDEX: '0' }), 0);
  assert.equal(runner.readRowIndex({ ROW_INDEX: '1' }), 1);
  for (const ROW_INDEX of ['', ' ', '-1', '1.5', '1x', '1e1', '0x1', '+1', 'Infinity', 'NaN', '9007199254740992']) {
    assert.throws(() => runner.readRowIndex({ ROW_INDEX }), /ROW_INDEX/u);
  }
  for (const PORT of ['0', '65536', 'http://localhost', '-1', '9239x']) assert.throws(() => runner.readPort({ PORT }));
  assert.equal(runner.readStepTimeout({}), 30000);
  for (const STEP_TIMEOUT_MS of ['999', '120001', 'x']) assert.throws(() => runner.readStepTimeout({ STEP_TIMEOUT_MS }));
  assert.equal(runner.readOutDir({ OUTDIR: 'nested-output' }, '/tmp'), path.resolve('/tmp/nested-output'));
  assert.deepEqual(runner.LIVE_FILES, ['src/content/cms-session.js', 'src/content/cms-record-controller.js', 'src/content/cms-education-multi.js']);
  for (const file of runner.LIVE_FILES) assert.equal(fs.existsSync(path.join(repoRoot, file)), true);
  assert.match(runner.POWERSHELL, /PORT='9239'/u);
  assert.match(runner.POWERSHELL, /Desktop/u);
  assert.match(runner.POWERSHELL, /ResumeQuickFill-Dev/u);
  assert.match(runner.POWERSHELL, /_temp-scripts/u);
  const help = spawnSync(process.execPath, ['scripts/live/cms-education-live.mjs', '--help'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /liveSupportClaimed remains false/u);
  assert.match(help.stdout, /9239/u);
  assert.match(help.stdout, /ROW_INDEX/u);
  assert.match(help.stdout, /Zero-based/u);
});

test('target selection accepts only one exact baseline tenant over loopback CDP', () => {
  assert.equal(runner.classifyCmsTabUrl(LIVE_URL).ok, true);
  for (const url of [PAGE.replace('https:', 'http:'), PAGE.replace('SU629dbc0c0dcad452299bc0f7', 'SUother'), `${PAGE}/other`, PAGE.replace('wecruit.hotjob.cn', 'wecruit.hotjob.cn.evil.test'), PAGE.replace('https://', 'https://user:password@')]) {
    assert.equal(runner.classifyCmsTabUrl(url).ok, false, url);
  }
  assert.equal(runner.selectCmsResumeTarget([target()]).action, 'attach');
  assert.equal(runner.selectCmsResumeTarget([target(), target(LIVE_URL, 'second')]).reason, 'tab_ambiguous');
  assert.equal(runner.selectCmsResumeTarget([{ ...target(), type: 'iframe' }]).reason, 'tab_not_found');
  assert.equal(runner.assertLoopback('ws://127.0.0.1:9239/devtools/page/1', 9239), true);
  for (const url of ['ws://remote.test:9239/page/1', 'ws://127.0.0.1:9240/page/1', 'https://127.0.0.1:9239/page/1', 'ws://user:secret@127.0.0.1:9239/page/1']) assert.equal(runner.assertLoopback(url, 9239), false);
});

test('every method except GET fails, including HEAD and OPTIONS; evidence redacts URL secrets', () => {
  assert.equal(runner.isNonGetMethod('GET'), false);
  assert.equal(runner.isNonGetMethod('get'), false);
  for (const method of ['HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE', '', undefined]) assert.equal(runner.isNonGetMethod(method), true, String(method));
  const rows = runner.partitionTraffic([
    { method: 'GET', url: LIVE_URL, via: 'cdp' },
    { method: 'HEAD', url: LIVE_URL, via: 'cdp' },
    { method: 'OPTIONS', url: LIVE_URL, via: 'fetch' },
    { method: 'POST', url: LIVE_URL, via: 'xhr' }
  ]);
  assert.equal(rows.nonGet.length, 3);
  assert.equal(JSON.stringify(rows).includes('private-'), false);
  assert.deepEqual(rows.saveLikePost, rows.nonGet);
});

test('the fixture plan confirms only the two supported product text paths and binds an existing row', async () => {
  const identity = JSON.stringify(['14_53_0', '14_55_0']);
  const plan = await runner.createLivePlan(identity);
  assert.equal(plan.page, PAGE);
  assert.equal(plan.records.length, 1);
  assert.deepEqual(plan.records[0].target, { mode: 'existing', identity });
  assert.equal(plan.records[0].replaceExisting, true);
  assert.deepEqual(runner.fixtureProfile().confirmedFields, ['education.0.major', 'education.0.majorDescription']);
  assert.deepEqual(Object.entries(plan.records[0].facts).filter(([, fact]) => fact.status === 'ready').map(([key]) => key), ['major', 'description']);
  assert.equal((await validatePlan(runner.fixtureProfile(), plan, plan.ownerBinding.epoch)).ok, true);
  assert.deepEqual(runner.UNCLAIMED, ['学校', '学历', '学位', '开始时间', '结束时间', '城市', '专业排名']);
});

test('multi-row plans bind every existing identity but authorize exactly the selected two text facts', async () => {
  const identities = [0, 1].map(index => JSON.stringify([`14_53_${index}`, `14_55_${index}`]));
  for (const rowIndex of [0, 1]) {
    const plan = await runner.createLivePlan(identities, rowIndex);
    assert.equal((await validatePlan(runner.fixtureProfile(rowIndex, 2), plan, plan.ownerBinding.epoch)).ok, true);
    assert.deepEqual(plan.records.map(row => row.target), identities.map(identity => ({ mode: 'existing', identity })));
    assert.deepEqual(plan.records.map(row => row.replaceExisting), [rowIndex === 0, rowIndex === 1]);
    const ready = plan.records.flatMap(row => Object.values(row.facts).filter(fact => fact.status === 'ready'));
    assert.deepEqual(ready.map(fact => fact.path), [`education.${rowIndex}.major`, `education.${rowIndex}.majorDescription`]);
  }
  await assert.rejects(runner.createLivePlan(identities, 2), /education_row_index_out_of_range/u);
  await assert.rejects(runner.createLivePlan([], 0), /education_row_count_not_supported/u);
  await assert.rejects(runner.createLivePlan(Array.from({ length: 31 }, (_, index) => String(index))), /education_row_count_not_supported/u);
});

for (const rowIndex of [0, 1]) {
  for (const originals of [undefined, { major: '  原专业私有内容  ', description: '\n原描述私有内容\n' }]) {
    test(`two existing rows: row ${rowIndex} alone receives trial/restore events (${originals ? 'nonempty' : 'empty'})`, async t => {
      const { api, window, inputs } = await educationDom(t, { rowCount: 2, rowIndex, originals });
      const untouchedIndex = 1 - rowIndex;
      const untouched = window.document.getElementById(`14_53_${untouchedIndex}`).querySelector('input');
      untouched.value = '另一行私有内容';
      untouched.dispatchEvent(new window.Event('input', { bubbles: true }));
      const before = window.fixtureSnapshot();
      const events = [];
      for (const type of ['input', 'change', 'focus', 'blur']) window.document.addEventListener(type, event => events.push(event.target), true);
      const prepared = api.prepare();
      assert.equal(prepared.ok, true, JSON.stringify(prepared));
      assert.equal(prepared.rowIndex, rowIndex);
      assert.equal(prepared.recordCount, 2);
      assert.equal(prepared.identity, prepared.identities[rowIndex]);
      const result = await api.run(await runner.createLivePlan(plain(prepared.identities), rowIndex));
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(result.restored, true);
      assert.equal(result.pageLeftAsFound, true);
      assert.equal(result.otherChanged, false);
      assert.equal(result.liveSupportClaimed, false);
      assert.deepEqual(plain(result.readbacks.map(row => row.path)), runner.fieldSpecsForRow(rowIndex).map(spec => spec.path));
      assert.ok(events.length > 0);
      assert.ok(events.every(input => Object.values(inputs).includes(input)), 'no events on the untouched row');
      for (const [key, input] of Object.entries(inputs)) assert.equal(input.value, originals?.[key] || '');
      assert.equal(untouched.value, '另一行私有内容');
      const after = window.fixtureSnapshot();
      const untouchedData = data => Object.fromEntries(Object.entries(data).filter(([key]) => key.endsWith(`_${untouchedIndex + 1}`)));
      assert.deepEqual(plain(untouchedData(after.formData)), plain(untouchedData(before.formData)));
      for (const key of ['records', 'schools', 'dates', 'regions', 'outside']) assert.deepEqual(plain(after[key]), plain(before[key]));
      for (const key of ['adds', 'saves', 'submits', 'selects']) assert.equal(after.counts[key], before.counts[key]);
      assert.deepEqual(plain(api.clicks()), []);
      assert.deepEqual(plain(api.posts()), []);
      assert.equal(JSON.stringify(result).includes('私有内容'), false);
      await api.cleanup();
    });
  }
}

test('zero rows and an out-of-range index fail before writes and retain row-count diagnostics', async t => {
  for (const [rowIndex, expectedCount, mutate] of [
    [2, 2, undefined],
    [0, 0, window => {
      window.document.querySelectorAll('.form-cell-inner').forEach(row => row.remove());
      window.fixtureProps.infoData = [];
    }]
  ]) {
    const { api, window } = await educationDom(t, { rowCount: 2, rowIndex, mutate });
    const before = window.fixtureCounts.textEvents;
    assert.deepEqual(plain(api.prepare()), { ok: false, reason: 'education_row_index_out_of_range', rowIndex, recordCount: expectedCount });
    assert.equal(window.fixtureCounts.textEvents, before);
    assert.deepEqual(plain(api.clicks()), []);
    await api.cleanup();
  }
});

test('multi-row plan tampering cannot authorize another row, new rows, or unbound rows', async t => {
  for (const change of [
    plan => { plan.records[0].facts.major = { status: 'ready', value: '金融学', path: 'education.0.major' }; },
    plan => { plan.records[0].replaceExisting = true; },
    plan => { plan.records[0].target = { mode: 'new' }; },
    plan => { plan.records.reverse(); },
    plan => { plan.records.pop(); },
    plan => { plan.records[1].target.identity = plan.records[0].target.identity; }
  ]) {
    const { api, window } = await educationDom(t, { rowCount: 2, rowIndex: 1 });
    const prepared = api.prepare();
    const plan = await runner.createLivePlan(plain(prepared.identities), 1);
    change(plan);
    plan.fingerprint = await hash({ ...plan, fingerprint: undefined });
    const result = await api.run(plan);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'education_trial_plan_invalid');
    assert.equal(window.fixtureCounts.textEvents, 0);
    assert.deepEqual(plain(api.clicks()), []);
    await api.cleanup();
  }
});

test('row removal, reorder, and identity drift after prepare cannot retarget the trial', async t => {
  for (const change of [
    window => window.document.querySelector('.form-cell-inner').remove(),
    window => {
      const rows = window.document.querySelectorAll('.form-cell-inner');
      rows[0].before(rows[1]);
    },
    window => { window.document.getElementById('14_53_0').id = '14_53_7'; }
  ]) {
    const { api, window } = await educationDom(t, { rowCount: 2, rowIndex: 1 });
    const prepared = api.prepare();
    const plan = await runner.createLivePlan(plain(prepared.identities), 1);
    change(window);
    const result = await api.run(plan);
    assert.equal(result.ok, false);
    assert.equal(window.fixtureCounts.textEvents, 0);
    assert.deepEqual(plain(api.clicks()), []);
    await api.cleanup();
  }
});

test('untouched DOM, React props, and absent-to-empty drift fail without overwriting the other row', async t => {
  for (const mutate of [
    (window, input) => { input.value = '其他行私有变更'; },
    window => { window.fixtureProps.formData['14_53_1'] = '其他行私有变更'; },
    window => { window.fixtureProps.formData['14_53_1'] = ''; }
  ]) {
    const { api, window, inputs } = await educationDom(t, { rowCount: 2, rowIndex: 1 });
    const other = window.document.getElementById('14_53_0').querySelector('input');
    let changed = false;
    inputs.major.addEventListener('input', () => {
      if (!changed) { changed = true; mutate(window, other); }
    });
    const prepared = api.prepare();
    const result = await api.run(await runner.createLivePlan(plain(prepared.identities), 1));
    assert.equal(result.ok, false);
    assert.equal(result.otherChanged, true);
    assert.equal(result.pageLeftAsFound, false);
    assert.equal(result.liveSupportClaimed, false);
    assert.equal(inputs.major.value, '');
    assert.equal(inputs.description.value, '');
    assert.deepEqual(plain(api.clicks()), []);
    assert.equal(JSON.stringify(result).includes('私有'), false);
    await api.cleanup();
  }
});

for (const [label, originals] of [
  ['nonempty', { major: '原专业私有内容', description: '原专业描述私有内容' }],
  ['empty and previously absent from React formData', undefined]
]) {
  test(`shipped text writer verifies both fields and restores ${label} originals without widget clicks`, async t => {
    const { window, inputs, api, install } = await educationDom(t, { originals });
    assert.equal(install.ok, true);
    const before = window.fixtureSnapshot();
    const prepared = await api.prepare();
    assert.equal(prepared.ok, true, JSON.stringify(prepared));
    assert.equal(typeof prepared.identity, 'string');
    const result = await api.run(await runner.createLivePlan(prepared.identity));
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.liveSupportClaimed, false);
    assert.equal(result.pageLeftAsFound, true);
    assert.equal(result.restored, true);
    for (const spec of runner.FIELD_SPECS) {
      assert.equal(inputs[spec.key].value, originals?.[spec.key] || '');
      const row = result.readbacks.find(row => row.path === spec.path);
      assert.equal(row?.ok, true);
      assert.equal(row?.value, spec.fixture);
    }
    const after = window.fixtureSnapshot();
    assert.equal(after.counts.adds, before.counts.adds);
    assert.equal(after.counts.saves, 0);
    assert.equal(after.counts.submits, 0);
    assert.equal(after.counts.selects, 0);
    assert.equal(after.outside, before.outside);
    assert.deepEqual(plain(after.schools), plain(before.schools));
    assert.deepEqual(plain(after.dates), plain(before.dates));
    assert.deepEqual(plain(after.regions), plain(before.regions));
    assert.deepEqual(plain(api.posts()), []);
    assert.deepEqual(plain(api.clicks()), []);
    assert.equal(JSON.stringify(result).includes('私有内容'), false);
    await api.cleanup();
  });
}

test('missing React public props stops before writing or clicking', async t => {
  const { api, window, inputs } = await educationDom(t, { mutate(window) { delete window.document.getElementById('14').__reactFiber$offline; } });
  const result = await api.prepare();
  assert.equal(result.ok, false);
  assert.equal(inputs.major.value, '');
  assert.equal(inputs.description.value, '');
  assert.equal(window.fixtureCounts.textEvents, 0);
  assert.deepEqual(plain(api.clicks()), []);
  await api.cleanup();
});

for (const [label, mutate] of [
  ['readonly text control', (_window, inputs) => { inputs.major.readOnly = true; }],
  ['calendar-wrapped text control', (window, inputs) => { const wrapper = window.document.createElement('span'); wrapper.className = 'ant-calendar-picker'; inputs.major.replaceWith(wrapper); wrapper.append(inputs.major); }],
  ['duplicate question', (window) => { const wrapper = window.document.getElementById('14_53_0'); wrapper.append(wrapper.querySelector('.ant-form-item').cloneNode(true)); }]
]) {
  test(`preflight rejects ${label} without exercising any writer`, async t => {
    const { api, window } = await educationDom(t, { mutate });
    const before = window.fixtureCounts.textEvents;
    const result = await api.prepare();
    assert.equal(result.ok, false, JSON.stringify(result));
    assert.equal(window.fixtureCounts.textEvents, before);
    assert.deepEqual(plain(api.clicks()), []);
    await api.cleanup();
  });
}

test('busy product context rejects installation and preserves the existing controller', async t => {
  const prior = { version: 3, implementationRevision: 16, marker: 'prior' };
  const { install, window } = await educationDom(t, { mutate(window) { window.ResumeProfileWriteContext = { check: async () => {} }; window.ResumeCmsEducationMulti = prior; } });
  assert.equal(install.ok, false);
  assert.equal(window.ResumeCmsEducationMulti, prior);
  assert.equal(window.fixtureCounts.textEvents, 0);
});

test('unsafe existing globals are rejected without replacing the controller or installing hooks', async t => {
  for (const key of ['ResumeCmsEducationMulti', 'installResumeCmsRecordController', 'ResumeCmsSession']) {
    let prior;
    let originalClick;
    const { install, window } = await educationDom(t, { mutate(window) {
      prior = key === 'installResumeCmsRecordController' ? () => {} : { marker: key, version: 3, implementationRevision: 16 };
      Object.defineProperty(window, key, { configurable: false, writable: false, value: prior });
      originalClick = window.HTMLElement.prototype.click;
    } });
    assert.equal(install.ok, false, key);
    assert.equal(window[key], prior);
    assert.equal(window.HTMLElement.prototype.click, originalClick);
    assert.equal(window.fixtureCounts.textEvents, 0);
  }
});

test('cleanup restores existing product globals and exact original network/click hooks', async t => {
  const priorController = { version: 3, implementationRevision: 16, marker: 'previous-controller' };
  const priorFactory = () => {};
  const priorSession = { check: async () => ({ ok: false }) };
  let before;
  const { api, window } = await educationDom(t, { mutate(window) {
    window.ResumeCmsEducationMulti = priorController;
    // A configurable but readonly old factory must be replaced for this run,
    // then restored with its original descriptor, rather than silently reused.
    Object.defineProperty(window, 'installResumeCmsRecordController', {
      configurable: true, writable: false, enumerable: false, value: priorFactory
    });
    window.ResumeCmsSession = priorSession;
    before = {
      fetch: window.fetch, click: window.HTMLElement.prototype.click,
      submit: window.HTMLFormElement.prototype.submit,
      requestSubmit: window.HTMLFormElement.prototype.requestSubmit,
      open: window.XMLHttpRequest.prototype.open, send: window.XMLHttpRequest.prototype.send
    };
  } });
  assert.notEqual(window.ResumeCmsEducationMulti, priorController);
  const cleanup = await api.cleanup();
  assert.equal(cleanup.ok, true);
  assert.equal(window.__cmsEducationLive, undefined);
  assert.equal(window.ResumeCmsEducationMulti, priorController);
  assert.equal(window.installResumeCmsRecordController, priorFactory);
  assert.equal(Object.getOwnPropertyDescriptor(window, 'installResumeCmsRecordController').writable, false);
  assert.equal(window.ResumeCmsSession, priorSession);
  assert.equal(window.fetch, before.fetch);
  assert.equal(window.HTMLElement.prototype.click, before.click);
  assert.equal(window.HTMLFormElement.prototype.submit, before.submit);
  assert.equal(window.HTMLFormElement.prototype.requestSubmit, before.requestSubmit);
  assert.equal(window.XMLHttpRequest.prototype.open, before.open);
  assert.equal(window.XMLHttpRequest.prototype.send, before.send);
});

test('expired server session prevents product writes and cleanup events', async t => {
  let requests = 0;
  const { api, window, inputs } = await educationDom(t, { mutate(window) {
    window.fetch = async (_url, init) => {
      requests += 1;
      assert.equal(init.method, 'GET');
      return { ok: true, json: async () => ({ state: 809 }) };
    };
  } });
  const prepared = await api.prepare();
  assert.equal(prepared.ok, true);
  const result = await api.run(await runner.createLivePlan(prepared.identity));
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'site_session_expired');
  assert.equal(requests, 1);
  assert.equal(window.fixtureCounts.textEvents, 0);
  assert.equal(inputs.major.value, '');
  assert.equal(inputs.description.value, '');
  await api.cleanup();
});

test('a changed fingerprint, unsupported ready fact, or changed row identity is rejected before events', async t => {
  for (const change of [
    plan => { plan.fingerprint = '0'.repeat(64); },
    plan => { plan.records[0].facts.school = { status: 'ready', value: '虚构学校', path: 'education.0.school' }; },
    (_plan, window) => { window.document.getElementById('14_53_0').id = '14_53_7'; }
  ]) {
    const { api, window } = await educationDom(t);
    const prepared = await api.prepare();
    assert.equal(prepared.ok, true);
    const plan = await runner.createLivePlan(prepared.identity);
    change(plan, window);
    const result = await api.run(plan);
    assert.equal(result.ok, false);
    assert.equal(window.fixtureCounts.textEvents, 0);
    assert.deepEqual(plain(api.clicks()), []);
    await api.cleanup();
  }
});

test('DOM-only writes cannot pass React serialization verification', async t => {
  const { api, window } = await educationDom(t);
  const prepared = await api.prepare();
  assert.equal(prepared.ok, true);
  const existing = window.ResumeCmsEducationMulti;
  window.ResumeCmsEducationMulti = {
    ...existing,
    async run(plan, services) {
      const originalData = plain(window.fixtureProps.formData);
      const reply = await existing.run(plan, services);
      window.fixtureProps.formData = originalData;
      return reply;
    }
  };
  const result = await api.run(await runner.createLivePlan(prepared.identity));
  assert.equal(result.ok, false);
  assert.equal(result.liveSupportClaimed, false);
  await api.cleanup();
});

test('page guards install click/submit blockers without invoking them and block non-GET transports', async t => {
  let fetches = 0;
  let sends = 0;
  let beacons = 0;
  const originalMethods = {};
  const captureGuards = new Map();
  const { api, window } = await educationDom(t, { mutate(window) {
    originalMethods.click = window.HTMLElement.prototype.click;
    originalMethods.submit = window.HTMLFormElement.prototype.submit;
    originalMethods.requestSubmit = window.HTMLFormElement.prototype.requestSubmit;
    const add = window.document.addEventListener;
    window.document.addEventListener = function (type, listener, options) {
      if (['click', 'submit'].includes(type) && options === true) captureGuards.set(type, listener);
      return add.call(this, type, listener, options);
    };
    window.fetch = async () => { fetches += 1; return { ok: true }; };
    window.XMLHttpRequest.prototype.send = () => { sends += 1; };
    window.navigator.sendBeacon = () => { beacons += 1; return true; };
  } });
  // The Never-Save policy also applies to fixture tests. Verify installation
  // and the rejecting handler bodies without probing Save or submit actions.
  assert.notEqual(window.HTMLElement.prototype.click, originalMethods.click);
  assert.match(window.HTMLElement.prototype.click.toString(), /clickNote\(this\)/u);
  for (const method of ['submit', 'requestSubmit']) {
    assert.notEqual(window.HTMLFormElement.prototype[method], originalMethods[method]);
    assert.match(window.HTMLFormElement.prototype[method].toString(), /clickNote\(this, 'submit'\)/u);
  }
  for (const type of ['click', 'submit']) {
    assert.equal(typeof captureGuards.get(type), 'function');
    assert.match(captureGuards.get(type).toString(), /event\.preventDefault\(\); event\.stopImmediatePropagation\(\)/u);
  }
  await assert.rejects(window.fetch(LIVE_URL, { method: 'POST' }));
  await assert.rejects(window.fetch(LIVE_URL, { method: 'HEAD' }));
  await assert.rejects(window.fetch(LIVE_URL, { method: 'OPTIONS' }));
  await window.fetch(LIVE_URL, { method: 'GET' });
  const xhr = new window.XMLHttpRequest();
  xhr.open('PUT', LIVE_URL);
  xhr.send('private-body');
  assert.equal(window.navigator.sendBeacon(LIVE_URL, 'private-body'), false);
  assert.equal(fetches, 1);
  assert.equal(sends, 0);
  assert.equal(beacons, 0);
  assert.equal(window.fixtureCounts.saves, 0);
  assert.equal(window.fixtureCounts.submits, 0);
  assert.deepEqual(plain(api.clicks()), []);
  assert.deepEqual(plain(api.posts().map(row => row.method)), ['POST', 'HEAD', 'OPTIONS', 'PUT', 'POST']);
  assert.equal(JSON.stringify(api.posts()).includes('private-'), false);
  const prepared = await api.prepare();
  assert.equal(prepared.ok, false);
  await api.cleanup();
});

function happyOutcome(rowIndex = 0, recordCount = 1) {
  return {
    ok: true,
    reason: null,
    liveSupportClaimed: false,
    rowIndex, recordCount,
    productReason: 'education_records_partial',
    readbacks: runner.fieldSpecsForRow(rowIndex).map(spec => ({ path: spec.path, key: spec.key, ok: true, reason: 'readback_matched', value: spec.fixture })),
    restored: true,
    pageLeftAsFound: true,
    otherChanged: false,
    clicks: [],
    clickCount: 0,
    waitedMs: 500
  };
}

function happyAnswers(overrides = {}) {
  return {
    page_guard: { href: LIVE_URL, title: '简历操作', readyState: 'complete', visible: 'visible', password: false },
    install_live: { ok: true },
    'inject_cms-session': { ok: true },
    'inject_cms-record-controller': { ok: true },
    'inject_cms-education-multi': { ok: true },
    education_prepare: { ok: true, rowIndex: 0, recordCount: 1, identity: JSON.stringify(['14_53_0', '14_55_0']),
      identities: [JSON.stringify(['14_53_0', '14_55_0'])] },
    education_run: happyOutcome(),
    read_posts: [],
    read_clicks: [],
    cleanup: { ok: true, posts: overrides.read_posts || [], clicks: overrides.read_clicks || [] },
    ...overrides
  };
}

async function runFake(t, { answers = happyAnswers(), targets = [target()], errors = {}, onStep, connectionError, listError, env = {}, pageWindow } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-education-live-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const calls = [];
  let eventHandler;
  const session = {
    async send(method, params = {}, options = {}) {
      const step = options.step || method;
      calls.push({ method, params, step });
      if (onStep) await onStep(step, event => eventHandler(event), calls);
      if (errors[step] || errors[method]) throw errors[step] || errors[method];
      if (method !== 'Runtime.evaluate') return {};
      const value = pageWindow ? await pageWindow.eval(params.expression) : answers[step];
      if (value instanceof Error) throw value;
      return { result: { value } };
    },
    close() { calls.push({ method: 'close', step: 'close' }); }
  };
  const evidence = await runner.runCmsEducationLive({
    env, port: 9239, outDir: dir, tipSha: runner.BASE_TIP, stepTimeoutMs: 1000,
    getJson: async (port, pathname) => {
      assert.equal(port, 9239);
      assert.equal(pathname, '/json/list');
      if (listError) throw listError;
      return targets;
    },
    connectCdp: async (_url, options) => {
      if (connectionError) throw connectionError;
      eventHandler = options.onEvent;
      return session;
    }
  });
  return { evidence, calls, dir };
}

test('ROW_INDEX reaches the real page harness, shipped writer, restore, and redacted evidence via fake CDP', async t => {
  for (const rowIndex of [0, 1]) {
    const { window, inputs } = await educationDom(t, { rowCount: 2, rowIndex, installTrial: false,
      originals: { major: '原专业私有内容', description: '原描述私有内容' } });
    const before = window.fixtureSnapshot();
    const { evidence, calls } = await runFake(t, { pageWindow: window, env: rowIndex === 0 ? {} : { ROW_INDEX: '1' } });
    assert.equal(evidence.finalDetails.exitCode, 0, JSON.stringify(evidence));
    assert.equal(evidence.finalDetails.rowIndex, rowIndex);
    assert.equal(evidence.finalDetails.recordCount, 2);
    assert.equal(evidence.finalDetails.clickCount, 0);
    assert.equal(evidence.finalDetails.otherChanged, false);
    assert.equal(evidence.liveSupportClaimed, false);
    assert.equal(evidence.finalDetails.liveSupportClaimed, false);
    assert.deepEqual(evidence.fields.slice(0, 2).map(field => field.path), runner.fieldSpecsForRow(rowIndex).map(spec => spec.path));
    assert.equal(inputs.major.value, '原专业私有内容');
    assert.equal(inputs.description.value, '原描述私有内容');
    assert.deepEqual(plain(window.fixtureSnapshot().formData), plain(before.formData));
    assert.equal(window.fixtureCounts.adds, before.counts.adds);
    assert.equal(window.fixtureCounts.saves, 0);
    assert.equal(window.fixtureCounts.submits, 0);
    assert.equal(window.__cmsEducationLive, undefined);
    assert.equal(calls.some(call => /^Page\.navigate|Input\./u.test(call.method)), false);
    assert.deepEqual(evidence.nonGet, []);
    assert.equal(JSON.stringify(evidence).includes('私有内容'), false);
    assert.equal(JSON.stringify(evidence).includes('private-'), false);
  }
});

test('invalid ROW_INDEX is rejected before CDP discovery or connection', async () => {
  for (const ROW_INDEX of ['', '-1', '1.5', 'garbage', '9007199254740992']) {
    let called = false;
    const connect = async () => { called = true; throw new Error('must not connect'); };
    await assert.rejects(runner.runCmsEducationLive({ env: { ROW_INDEX }, getJson: connect, connectCdp: connect }), /ROW_INDEX/u);
    assert.equal(called, false);
  }
});

test('out-of-range ROW_INDEX produces failed evidence with the observed count and no writes', async t => {
  const { window } = await educationDom(t, { rowCount: 2, installTrial: false });
  const { evidence, calls } = await runFake(t, { pageWindow: window, env: { ROW_INDEX: '2' } });
  assert.equal(evidence.finalDetails.exitCode, 2);
  assert.equal(evidence.finalDetails.reason, 'education_row_index_out_of_range');
  assert.equal(evidence.finalDetails.rowIndex, 2);
  assert.equal(evidence.finalDetails.recordCount, 2);
  assert.equal(calls.some(call => call.step === 'education_run'), false);
  assert.equal(window.fixtureCounts.textEvents, 0);
  assert.equal(evidence.liveSupportClaimed, false);
});

test('fake CDP success requires interception before injection and leaves all widget fields unsupported', async t => {
  const { evidence, calls, dir } = await runFake(t);
  assert.equal(evidence.finalDetails.exitCode, 0, JSON.stringify(evidence));
  assert.equal(evidence.neverSave, true);
  assert.equal(evidence.liveSupportClaimed, false);
  assert.equal(evidence.tipSha, runner.BASE_TIP);
  assert.equal(evidence.finalDetails.pageLeftAsFound, true);
  const steps = calls.map(call => call.step);
  assert.ok(steps.indexOf('fetch_enable') < steps.indexOf('install_live'));
  assert.ok(steps.indexOf('install_live') < steps.indexOf('inject_cms-record-controller'));
  assert.ok(steps.indexOf('inject_cms-record-controller') < steps.indexOf('inject_cms-education-multi'));
  assert.ok(steps.indexOf('education_prepare') < steps.indexOf('education_run'));
  for (const spec of runner.FIELD_SPECS) {
    const field = evidence.fields.find(field => field.q === spec.q);
    assert.equal(field.status, 'verified');
    assert.equal(field.value, spec.fixture);
  }
  for (const question of runner.UNCLAIMED) {
    const field = evidence.fields.find(field => field.q === question);
    assert.equal(field.status, 'skipped');
    assert.equal(field.reason, 'control_not_supported');
    assert.equal(field.value, null);
  }
  assert.equal(calls.some(call => /^Page\.navigate|Input\./u.test(call.method)), false);
  assert.ok(steps.includes('cleanup'));
  assert.equal(steps.at(-1), 'close');
  assert.equal(JSON.stringify(evidence).includes('private-'), false);
  const saved = JSON.parse(fs.readFileSync(path.join(dir, runner.EVIDENCE_NAME), 'utf8'));
  assert.deepEqual(saved, evidence);
});

for (const method of ['POST', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']) {
  test(`fake CDP aborts intercepted ${method} and fails the run`, async t => {
    let emitted = false;
    const { evidence, calls } = await runFake(t, { onStep(step, emit) {
      if (step !== 'education_run' || emitted) return;
      emitted = true;
      emit({ method: 'Fetch.requestPaused', params: { requestId: 'blocked-request', request: { method, url: LIVE_URL } } });
    } });
    assert.equal(evidence.finalDetails.exitCode, 3, JSON.stringify(evidence));
    assert.equal(evidence.nonGet.some(row => row.method === method), true);
    assert.equal(calls.some(call => call.method === 'Fetch.failRequest' && call.params.requestId === 'blocked-request'), true);
    assert.equal(calls.some(call => call.method === 'Fetch.continueRequest' && call.params.requestId === 'blocked-request'), false);
  });
}

test('fake CDP continues GET and records non-GET observed outside the page hook', async t => {
  let emitted = false;
  const { evidence, calls } = await runFake(t, { onStep(step, emit) {
    if (step !== 'education_run' || emitted) return;
    emitted = true;
    emit({ method: 'Fetch.requestPaused', params: { requestId: 'safe-get', request: { method: 'GET', url: LIVE_URL } } });
    emit({ method: 'Network.requestWillBeSent', params: { request: { method: 'PATCH', url: LIVE_URL } } });
  } });
  assert.equal(evidence.finalDetails.exitCode, 3);
  assert.ok(calls.some(call => call.method === 'Fetch.continueRequest' && call.params.requestId === 'safe-get'));
  assert.equal(evidence.nonGet.some(row => row.method === 'PATCH'), true);
});

test('an early non-GET observation stops before page injection or product writes', async t => {
  let emitted = false;
  const { evidence, calls } = await runFake(t, { onStep(step, emit) {
    if (step !== 'page_guard' || emitted) return;
    emitted = true;
    emit({ method: 'Network.requestWillBeSent', params: { request: { method: 'POST', url: LIVE_URL } } });
  } });
  assert.equal(evidence.finalDetails.exitCode, 3);
  assert.equal(calls.some(call => call.step === 'install_live' || call.step === 'education_run'), false);
});

test('failed request interception and failed guard reads cannot produce successful evidence', async t => {
  for (const [method, command] of [['GET', 'Fetch.continueRequest'], ['POST', 'Fetch.failRequest']]) {
    let emitted = false;
    const { evidence, calls } = await runFake(t, {
      errors: { [command]: new Error('command rejected') },
      onStep(step, emit) {
        if (step !== 'education_run' || emitted) return;
        emitted = true;
        emit({ method: 'Fetch.requestPaused', params: { requestId: 'unresolved', request: { method, url: LIVE_URL } } });
      }
    });
    assert.notEqual(evidence.finalDetails.exitCode, 0);
    assert.ok(calls.some(call => call.method === command));
  }
  for (const step of ['read_posts', 'read_clicks']) {
    const { evidence } = await runFake(t, { answers: happyAnswers({ [step]: new Error('guard unavailable') }) });
    assert.notEqual(evidence.finalDetails.exitCode, 0);
  }
});

test('cleanup cannot erase a forbidden click already observed by the host', async t => {
  const { evidence } = await runFake(t, { answers: happyAnswers({
    read_clicks: [{ type: 'click', label: '保存' }],
    cleanup: { ok: true, posts: [], clicks: [] }
  }) });
  assert.equal(evidence.finalDetails.exitCode, 3);
  assert.ok(evidence.finalDetails.clickCount > 0);
});

for (const method of ['Network.enable', 'Fetch.enable']) {
  test(`fake CDP refuses all product writes when mandatory ${method} fails`, async t => {
    const { evidence, calls } = await runFake(t, { errors: { [method]: new Error('unsupported') } });
    assert.notEqual(evidence.finalDetails.exitCode, 0);
    assert.equal(calls.some(call => call.step === 'education_run'), false);
    assert.equal(calls.some(call => call.step === 'install_live'), false);
    assert.equal(calls.at(-1).step, 'close');
  });
}

for (const [label, answers] of [
  ['login', { page_guard: { href: LIVE_URL, title: '登录', readyState: 'complete', visible: 'visible', password: true } }],
  ['wrong page after attach', { page_guard: { href: 'https://example.test/', readyState: 'complete', visible: 'visible' } }],
  ['hidden page', { page_guard: { href: LIVE_URL, readyState: 'complete', visible: 'hidden' } }],
  ['failed install', { install_live: { ok: false, reason: 'profile_write_context_busy' } }],
  ['failed injection', { 'inject_cms-record-controller': { ok: false } }],
  ['unsupported structure', { education_prepare: { ok: false, reason: 'control_not_supported' } }]
]) {
  test(`fake CDP stops before the runner for ${label}`, async t => {
    const { evidence, calls } = await runFake(t, { answers: happyAnswers(answers) });
    assert.notEqual(evidence.finalDetails.exitCode, 0);
    assert.equal(calls.some(call => call.step === 'education_run'), false);
    assert.equal(evidence.liveSupportClaimed, false);
  });
}

test('missing and ambiguous tabs, invalid endpoints, and unavailable CDP never run page code', async t => {
  for (const options of [
    { targets: [] },
    { targets: [target(), target(LIVE_URL, 'second')] },
    { targets: [{ ...target(), webSocketDebuggerUrl: 'ws://remote.test:9239/page/1' }] },
    { targets: {} },
    { listError: new Error('not listening') },
    { connectionError: new Error('connection refused') }
  ]) {
    const { evidence, calls } = await runFake(t, options);
    assert.notEqual(evidence.finalDetails.exitCode, 0);
    assert.equal(calls.some(call => call.method === 'Runtime.evaluate'), false);
  }
});

test('readback failure, restore failure, support claims, and cleanup failure cannot pass', async t => {
  for (const patch of [
    { ok: false, reason: 'readback_mismatch' },
    { restored: false, pageLeftAsFound: false },
    { liveSupportClaimed: true },
    { readbacks: [] },
    { otherChanged: true },
    { rowIndex: 1 },
    { recordCount: 2 }
  ]) {
    const { evidence } = await runFake(t, { answers: happyAnswers({ education_run: { ...happyOutcome(), ...patch } }) });
    assert.notEqual(evidence.finalDetails.exitCode, 0, JSON.stringify(patch));
    assert.equal(evidence.liveSupportClaimed, false);
  }
  const { evidence } = await runFake(t, { answers: happyAnswers({ cleanup: { ok: false } }) });
  assert.notEqual(evidence.finalDetails.exitCode, 0);
});

test('page click/non-GET evidence fails even if the product returned a successful readback', async t => {
  for (const patch of [
    { read_clicks: [{ type: 'click', label: '保存' }] },
    { read_clicks: [{ type: 'click', label: '选择' }] },
    { read_posts: [{ method: 'OPTIONS', url: LIVE_URL, via: 'fetch' }] }
  ]) {
    const { evidence } = await runFake(t, { answers: happyAnswers(patch) });
    assert.equal(evidence.finalDetails.exitCode, 3);
    assert.equal(evidence.liveSupportClaimed, false);
  }
});

test('timeout attempts cleanup, reports failure, and never claims an untouched page', async t => {
  const timeout = new Error('timeout');
  timeout.reason = 'timeout';
  const { evidence, calls } = await runFake(t, { answers: happyAnswers({ education_run: timeout }) });
  assert.notEqual(evidence.finalDetails.exitCode, 0);
  assert.notEqual(evidence.finalDetails.pageLeftAsFound, true);
  assert.ok(calls.some(call => call.step === 'cleanup'));
  assert.equal(calls.at(-1).step, 'close');
});
