/**
 * CMB basic auto (trial Edge / worker.mjs):
 * - manifest host match is required; missing permission fails closed before tabs
 * - trial service worker registers CMB_BASIC_AUTO
 * - readiness does not write; fill never Save
 * Offline only. 招行 is not supported.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  CMB_HOST_MATCH,
  cmbHostPermissionGranted,
  createCmbBasicAutoRunner,
  resolveCmbTarget,
  isCmbTabUrl
} from '../src/background/cmb-basic-auto.mjs';

const root = resolve(import.meta.dirname, '..');
const epoch = '00000000-0000-4000-8000-000000000001';
const TAB = 'https://career.cmbchina.com/center/resume';

function grantedManifest(extra = {}) {
  return {
    background: { service_worker: 'src/background/worker.mjs' },
    host_permissions: [
      'https://hr.gtht.com/*',
      'https://wecruit.hotjob.cn/*',
      CMB_HOST_MATCH
    ],
    ...extra
  };
}

test('trial manifest host match is career.cmbchina.com and the content script is packed', async () => {
  const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.name.includes('试用'), true);
  assert.equal(manifest.background.service_worker, 'src/background/worker.mjs');
  assert.equal(cmbHostPermissionGranted(manifest), true);
  assert.equal(CMB_HOST_MATCH, 'https://career.cmbchina.com/*');
  assert.equal(manifest.host_permissions.includes(CMB_HOST_MATCH), true);
  const internal = await readFile(resolve(root, 'scripts/build-internal.ps1'), 'utf8');
  const paid = await readFile(resolve(root, 'scripts/build-paid.ps1'), 'utf8');
  for (const script of [internal, paid]) {
    assert.match(script, /'src\/background\/cmb-basic-auto\.mjs'/);
    assert.match(script, /'src\/auto\/cmb-basic-auto\.html'/);
    assert.match(script, /'src\/auto\/cmb-basic-auto\.js'/);
    assert.match(script, /'src\/content\/cmb-basic\.js'/);
    assert.match(script, /'src\/content\/cmb-profile-map\.mjs'/);
    assert.match(script, /'src\/content\/cmb-gated-dicts\.mjs'/);
  }
  const runner = await readFile(resolve(root, 'src/background/cmb-basic-auto.mjs'), 'utf8');
  const page = await readFile(resolve(root, 'src/auto/cmb-basic-auto.js'), 'utf8');
  assert.match(page, /requestBackground\(/);
  assert.doesNotMatch(page, /chrome\.runtime\.sendMessage/);
  assert.doesNotMatch(runner, /\.click\s*\(/);
  assert.doesNotMatch(runner, /已支持/);
  assert.doesNotMatch(page, /已支持/);
  assert.match(runner, /files:\s*\['src\/content\/cmb-basic\.js'\]/);
  assert.match(runner, /\.ant-form-item/);
  const worker = await readFile(resolve(root, 'src/background/worker.mjs'), 'utf8');
  assert.match(worker, /boot\('cmb-basic-auto',\s*installCmbBasicAutoRunner\)/);
});

test('resolveCmbTarget accepts the resume edit host and refuses aliases that are not CMB', () => {
  const sample = resolveCmbTarget(undefined);
  assert.equal(sample.sample, true);
  assert.equal(sample.page, TAB);
  assert.equal(sample.host, 'career.cmbchina.com');
  const exact = resolveCmbTarget('https://career.cmbchina.com/center/resume/');
  assert.equal(exact.sample, false);
  assert.equal(exact.host, 'career.cmbchina.com');
  assert.equal(isCmbTabUrl(TAB), true);
  assert.equal(isCmbTabUrl('https://career.cmbchina.com/login?redirect=%2Fcenter%2Fresume'), false);
  for (const bad of [
    'http://career.cmbchina.com/center/resume',
    'https://cmb-recruitment-mobile.paas.cmbchina.com/',
    'https://career.cmbc.com.cn/',
    'https://wecruit.hotjob.cn/SU1/pb/resumeOperation.html',
    'https://hr.gtht.com/',
    'https://user:pass@career.cmbchina.com/center/resume',
    'https://career.cmbchina.com/login',
    42,
    {}
  ]) assert.throws(() => resolveCmbTarget(bad), /cmb_page_invalid/, String(bad));
});

function harness({ hostPermissions = grantedManifest().host_permissions, probeOk = true, serviceWorker = 'src/background/worker.mjs', fillResult = null } = {}) {
  const data = {
    resumeProfile: {
      schemaVersion: 1,
      fullName: '测试甲',
      phone: '13800138000',
      email: 'cmb.user@example.com',
      confirmedFields: ['fullName', 'phone', 'email']
    },
    resumeProfileLifecycle: { version: 1, epoch, state: 'ready' }
  };
  const clone = (value) => (value === undefined ? undefined : structuredClone(value));
  const stats = { fill: 0, inject: 0, probe: 0, query: 0, files: [] };
  const storage = {
    get: async (keys) =>
      keys === null
        ? clone(data)
        : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map((key) => [key, clone(data[key])])),
    set: async (values) => Object.assign(data, clone(values)),
    remove: async (keys) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key];
    }
  };
  let runner;
  const autoSender = {
    id: 'synthetic-extension',
    url: 'chrome-extension://synthetic-extension/src/auto/cmb-basic-auto.html?mode=readiness'
  };
  const badSender = {
    id: 'synthetic-extension',
    url: 'chrome-extension://synthetic-extension/src/auto/cms-basic-auto.html'
  };
  const invoke = (message, sender = autoSender) =>
    new Promise((resolve) => {
      const handled = runner.listener(message, sender, resolve);
      if (handled === false && message?.type === 'CMB_BASIC_AUTO') {
        /* sendResponse already called for a sync refusal */
      } else if (handled === false) resolve({ ok: false, reason: 'listener_ignored' });
    });
  const api = {
    storage: { local: storage },
    runtime: {
      id: autoSender.id,
      getURL: (path) => 'chrome-extension://synthetic-extension/' + path,
      getManifest: () => ({
        background: { service_worker: serviceWorker },
        host_permissions: hostPermissions
      })
    },
    windows: { update: async () => ({}) },
    tabs: {
      get: async () => ({ id: 42, url: TAB, windowId: 1, status: 'complete' }),
      create: async () => ({ id: 42, url: TAB, windowId: 1, status: 'complete' }),
      query: async () => {
        stats.query += 1;
        return [{ id: 42, url: TAB, active: true, lastAccessed: Date.now() }];
      },
      update: async () => ({ id: 42, url: TAB, windowId: 1 })
    },
    scripting: {
      executeScript: async (request) => {
        if (request.files) {
          stats.inject += 1;
          stats.files.push(request.files);
          return [];
        }
        if (typeof request.func === 'function') {
          const src = String(request.func);
          if (src.includes('fillBasic')) {
            stats.fill += 1;
            return [{
              result: fillResult || {
                ok: true,
                siteId: 'cmb',
                saved: false,
                skippedSave: true,
                writeAttempted: true,
                results: [{ label: '姓名', ok: true }],
                href: TAB
              }
            }];
          }
          stats.probe += 1;
          return [{
            result: {
              ok: probeOk,
              reason: probeOk ? 'cmb_page_ready' : 'cmb_labels_incomplete',
              href: TAB,
              readyState: 'complete',
              visible: 'visible',
              foundLabels: probeOk ? ['姓名', '手机号', '邮箱'] : [],
              looksLogin: false,
              looksCmb: true,
              title: 'synthetic'
            }
          }];
        }
        return [];
      }
    }
  };
  runner = createCmbBasicAutoRunner({
    api,
    lifecycleOptions: { locks: { request: async (_n, _o, work) => work() }, cryptoImpl: globalThis.crypto }
  });
  return { invoke, autoSender, badSender, stats, api, runner, data };
}

test('CMB_BASIC_AUTO fail-closed when host permission is missing', async () => {
  const h = harness({ hostPermissions: ['https://hr.gtht.com/*', 'https://wecruit.hotjob.cn/*'] });
  const refused = await h.invoke({ type: 'CMB_BASIC_AUTO', mode: 'fill', openIfMissing: true });
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, 'cmb_host_permission_missing');
  assert.equal(refused.saveAttempted, false);
  assert.equal(refused.writeAttempted, false);
  assert.equal(refused.skippedSave, true);
  assert.equal(refused.liveSupportClaimed, false);
  assert.equal(h.stats.query, 0);
  assert.equal(h.stats.inject, 0);
  assert.equal(h.stats.fill, 0);
  assert.equal(h.stats.probe, 0);
});

test('CMB_BASIC_AUTO wrong sender and foreign target refused; readiness does not write', async () => {
  const h = harness();
  const bad = await h.invoke({ type: 'CMB_BASIC_AUTO', mode: 'readiness' }, h.badSender);
  assert.equal(bad.reason, 'cmb_basic_wrong_sender');
  assert.equal(bad.saveAttempted, false);
  assert.equal(h.stats.query, 0);
  const foreign = await h.invoke({
    type: 'CMB_BASIC_AUTO',
    mode: 'readiness',
    targetPage: 'https://wecruit.hotjob.cn/SU1/pb/resumeOperation.html'
  });
  assert.equal(foreign.ok, false);
  assert.equal(foreign.reason, 'cmb_page_invalid');
  assert.equal(foreign.saveAttempted, false);
  assert.equal(h.stats.probe, 0);
  const ignored = await h.invoke({ type: 'CMS_BASIC_AUTO', mode: 'readiness' });
  assert.equal(ignored.reason, 'listener_ignored');
  const ready = await h.invoke({ type: 'CMB_BASIC_AUTO', mode: 'readiness', openIfMissing: false });
  assert.equal(ready.ok, true);
  assert.equal(ready.siteId, 'cmb');
  assert.equal(ready.kind, 'cmb_basic_auto');
  assert.equal(ready.mode, 'readiness');
  assert.equal(ready.saveAttempted, false);
  assert.equal(ready.writeAttempted, false);
  assert.equal(ready.skippedSave, true);
  assert.equal(ready.liveSupportClaimed, false);
  assert.equal(h.stats.fill, 0);
  assert.equal(h.stats.inject, 0);
  assert.ok(h.stats.probe >= 1);
});

test('CMB_BASIC_AUTO fill injects cmb-basic.js once and never Save', async () => {
  const h = harness();
  const filled = await h.invoke({ type: 'CMB_BASIC_AUTO', mode: 'fill', openIfMissing: false });
  assert.equal(filled.ok, true);
  assert.equal(filled.siteId, 'cmb');
  assert.equal(filled.saveAttempted, false);
  assert.equal(filled.skippedSave, true);
  assert.equal(filled.writeAttempted, true);
  assert.equal(filled.job.softwareClickedSave, false);
  assert.equal(filled.job.saved, false);
  assert.equal(filled.liveSupportClaimed, false);
  assert.equal(h.stats.inject, 1);
  assert.equal(h.stats.fill, 1);
  assert.deepEqual(h.stats.files, [['src/content/cmb-basic.js']]);
});

test('CMB_BASIC_AUTO keeps a submit or savedOnSite claim and does not report ok', async () => {
  for (const extra of [
    { softwareClickedSubmit: true },
    { softwareClickedDelete: true },
    { savedOnSite: true },
    { submitted: true },
    { saved: true, softwareClickedSave: true }
  ]) {
    const h = harness({
      fillResult: {
        ok: true,
        siteId: 'cmb',
        saved: false,
        skippedSave: true,
        writeAttempted: true,
        results: [{ label: '姓名', ok: true }],
        href: TAB,
        ...extra
      }
    });
    const filled = await h.invoke({ type: 'CMB_BASIC_AUTO', mode: 'fill', openIfMissing: false });
    assert.equal(filled.ok, false, JSON.stringify(extra));
    assert.equal(filled.reason, 'cmb_save_policy_violation');
    assert.equal(filled.liveSupportClaimed, false);
    assert.equal(filled.job.state, 'failed');
    for (const [key, value] of Object.entries(extra)) {
      assert.equal(filled.job[key], value, key);
      assert.equal(filled[key], value, key);
    }
    assert.equal(h.data.resumeCmbBasicAutoRun?.ok, false);
  }
});

test('CMB_BASIC_AUTO fails closed when ok is true without verified rows or siteId', async () => {
  const empty = harness({
    fillResult: {
      ok: true,
      siteId: 'cmb',
      saved: false,
      skippedSave: true,
      writeAttempted: false,
      results: [],
      href: TAB
    }
  });
  const unsettled = await empty.invoke({ type: 'CMB_BASIC_AUTO', mode: 'fill', openIfMissing: false });
  assert.equal(unsettled.ok, false);
  assert.equal(unsettled.reason, 'cmb_basic_status_unsettled');
  assert.equal(unsettled.job.saved, false);
  assert.equal(unsettled.liveSupportClaimed, false);
  const foreign = harness({
    fillResult: {
      ok: true,
      siteId: 'cms',
      saved: false,
      skippedSave: true,
      writeAttempted: true,
      results: [{ label: '姓名', ok: true }],
      href: TAB
    }
  });
  const isolated = await foreign.invoke({ type: 'CMB_BASIC_AUTO', mode: 'fill', openIfMissing: false });
  assert.equal(isolated.ok, false);
  assert.equal(isolated.reason, 'cmb_site_isolation');
  assert.equal(isolated.liveSupportClaimed, false);
});

test('trial worker install registers CMB_BASIC_AUTO', async () => {
  const previousChrome = globalThis.chrome;
  const listeners = [];
  globalThis.chrome = {
    runtime: {
      id: 'trial-ext',
      getURL: (path) => `chrome-extension://trial-ext/${path}`,
      getManifest: () => grantedManifest(),
      onMessage: { addListener(fn) { listeners.push(fn); } },
      onConnect: { addListener() {} }
    },
    storage: { local: { get: async () => ({}), set: async () => {}, remove: async () => {} } },
    tabs: {
      query: async () => [],
      get: async () => ({ id: 1 }),
      create: async () => ({ id: 1 }),
      update: async () => ({ id: 1 })
    },
    windows: { update: async () => ({}) },
    scripting: { executeScript: async () => [] }
  };
  try {
    await import('../src/background/worker.mjs');
    const stranger = { id: 'trial-ext', url: 'https://career.cmbchina.com/center/resume' };
    let response;
    let held = false;
    for (const listener of listeners) {
      const result = listener({ type: 'CMB_BASIC_AUTO', mode: 'readiness' }, stranger, (value) => { response = value; });
      if (result === true) held = true;
    }
    assert.equal(held, false);
    assert.equal(response?.ok, false);
    assert.equal(response?.reason, 'cmb_basic_wrong_sender');
    assert.equal(response?.saveAttempted, false);
    assert.equal(response?.liveSupportClaimed, false);
  } finally {
    if (previousChrome === undefined) delete globalThis.chrome;
    else globalThis.chrome = previousChrome;
  }
});
