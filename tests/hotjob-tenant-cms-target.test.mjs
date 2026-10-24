/**
 * hotjob tenant CMS basic target:
 * - scripts/lib/cms-page-target.mjs env resolution / validation (default = 招商 baseline)
 * - SW CMS_BASIC_AUTO honours message.cmsPage for a tenant SU, refuses non-hotjob URLs, keeps baseline unchanged
 * - harness smoke with a stub Edge: refuses bad CMS_PAGE; writes tenant-tagged evidence for non-baseline SU
 * Offline only; no live site, never Save.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  resolveCmsTarget, parseCmsPage, CMS_BASELINE_PAGE, CMS_BASELINE_SU, HOTJOB_TENANTS, tenantEvidenceName,
  cmsPageForSu
} from '../scripts/lib/cms-page-target.mjs';
import { createCmsBasicAutoRunner, resolveCmsBasicTarget } from '../src/background/cms-basic-auto.mjs';
import { CMS_QUESTION_PAGE } from '../src/profile/site-question-templates.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ZL = HOTJOB_TENANTS.zhonglian.su;
const ZL_PAGE = `https://wecruit.hotjob.cn/${ZL}/pb/resumeOperation.html`;

test('resolveCmsTarget default is 招商 baseline and matches extension constant', () => {
  const t = resolveCmsTarget({});
  assert.equal(t.page, CMS_BASELINE_PAGE);
  assert.equal(t.page, CMS_QUESTION_PAGE);
  assert.equal(t.su, CMS_BASELINE_SU);
  assert.equal(t.isBaseline, true);
  assert.equal(t.source, 'default');
  assert.equal(resolveCmsTarget({ CMS_PAGE: '', CMS_SU: '  ' }).isBaseline, true);
});

test('resolveCmsTarget accepts CMS_PAGE / CMS_SU for each tenant', () => {
  for (const [key, row] of Object.entries(HOTJOB_TENANTS)) {
    const pbPage = `https://wecruit.hotjob.cn/${row.su}/pb/resumeOperation.html`;
    const suPage = row.shell === 'mc'
      ? `https://wecruit.hotjob.cn/${row.su}/mc/deliver/operationResumer`
      : pbPage;
    const a = resolveCmsTarget({ CMS_PAGE: pbPage });
    const b = resolveCmsTarget({ CMS_SU: row.su });
    const c = resolveCmsTarget({ CMS_PAGE: pbPage, CMS_SU: row.su });
    assert.equal(a.page, pbPage);
    assert.equal(a.shell, 'pb');
    assert.equal(b.page, suPage);
    assert.equal(b.shell, row.shell === 'mc' ? 'mc' : 'pb');
    assert.equal(c.page, pbPage);
    assert.equal(c.shell, 'pb');
    for (const t of [a, b, c]) {
      assert.equal(t.su, row.su);
      assert.equal(t.isBaseline, false);
      assert.equal(t.tenantKey, key);
      assert.equal(t.tag, row.su.slice(2, 8));
    }
  }
  assert.equal(resolveCmsTarget({ CMS_SU: CMS_BASELINE_SU }).isBaseline, true);
  assert.equal(resolveCmsTarget({ CMS_SU: CMS_BASELINE_SU }).shell, 'pb');
});

test('resolveCmsTarget refuses non wecruit/SU/resumeOperation targets', () => {
  const bad = [
    'http://wecruit.hotjob.cn/SU661f37091eb8053acd6cdf3d/pb/resumeOperation.html',
    'https://gszq.hotjob.cn/SU6879a7b3e57172288b60df9d/pb/resumeOperation.html',
    'https://wecruit.hotjob.cn.evil.com/SU661f37091eb8053acd6cdf3d/pb/resumeOperation.html',
    'https://wecruit.hotjob.cn/SU661f37091eb8053acd6cdf3d/pb/index.html',
    'https://wecruit.hotjob.cn/XX661f37091eb8053acd6cdf3d/pb/resumeOperation.html',
    'https://wecruit.hotjob.cn:8443/SU661f37091eb8053acd6cdf3d/pb/resumeOperation.html',
    'https://u:p@wecruit.hotjob.cn/SU661f37091eb8053acd6cdf3d/pb/resumeOperation.html',
    `${ZL_PAGE}?x=1`,
    `${ZL_PAGE}#/`,
    'https://campus.jd.com/',
    'not a url'
  ];
  for (const value of bad) assert.throws(() => resolveCmsTarget({ CMS_PAGE: value }), /cms_page_invalid/, value);
  for (const value of [
    'https://wecruit.hotjob.cn/SU661f37091eb8053acd6cdf3d/mc/index',
    'https://wecruit.hotjob.cn/SU661f37091eb8053acd6cdf3d/mc/operationResumer'
  ]) assert.throws(() => resolveCmsTarget({ CMS_PAGE: value }), /cms_page_invalid/, value);
  const mcPage = `https://wecruit.hotjob.cn/${ZL}/mc/deliver/operationResumer`;
  const mc = resolveCmsTarget({ CMS_PAGE: `${mcPage}?x=1` });
  assert.equal(mc.shell, 'mc');
  assert.equal(mc.page, mcPage);
  assert.equal(mc.su, ZL);
  assert.throws(() => resolveCmsTarget({ CMS_SU: 'SU../x' }), /cms_su_invalid/);
  assert.throws(() => resolveCmsTarget({ CMS_SU: 'zhonglian' }), /cms_su_invalid/);
  assert.throws(() => resolveCmsTarget({ CMS_PAGE: ZL_PAGE, CMS_SU: HOTJOB_TENANTS.nanyue.su }), /cms_target_conflict/);
  assert.deepEqual(parseCmsPage(ZL_PAGE), { su: ZL, page: ZL_PAGE, shell: 'pb' });
  assert.equal(tenantEvidenceName(ZL, '20261018-193000'), 'hotjob-tenant-661f37-cms-basic-20261018-193000.json');
});

test('SW resolveCmsBasicTarget: baseline default, tenant scope, refusal', () => {
  assert.deepEqual(resolveCmsBasicTarget(undefined), { page: CMS_QUESTION_PAGE, su: CMS_BASELINE_SU, baseline: true, trustScope: 'https://wecruit.hotjob.cn' });
  assert.equal(resolveCmsBasicTarget(CMS_QUESTION_PAGE).baseline, true);
  const t = resolveCmsBasicTarget(ZL_PAGE);
  assert.equal(t.baseline, false);
  assert.equal(t.su, ZL);
  assert.equal(t.trustScope, `https://wecruit.hotjob.cn/${ZL}/`);
  for (const bad of [`${ZL_PAGE}?a=1`, 'https://gszq.hotjob.cn/SU6879a7b3e57172288b60df9d/pb/resumeOperation.html', 42, {}])
    assert.throws(() => resolveCmsBasicTarget(bad), /cms_basic_page_invalid/);
});

function swHarness({ tabUrl, trusted = [] }) {
  const data = {
    resumeProfile: {
      schemaVersion: 1, fullName: 'Synthetic Customer B',
      customAnswers: { 婚姻状况: '未婚' }, confirmedFields: ['customAnswers.婚姻状况']
    },
    resumeProfileLifecycle: { version: 1, epoch: '00000000-0000-4000-8000-000000000001', state: 'ready' },
    resumeTrustedOrigins: trusted
  };
  const clone = (v) => (v === undefined ? undefined : structuredClone(v));
  const storage = {
    get: async (keys) => keys === null ? clone(data)
      : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map((k) => [k, clone(data[k])])),
    set: async (values) => Object.assign(data, clone(values)),
    remove: async (keys) => { for (const k of Array.isArray(keys) ? keys : [keys]) delete data[k]; }
  };
  const stats = { fill: 0, probeArgs: [], probeSigs: [], created: [] };
  const sender = { id: 'ext', url: 'chrome-extension://ext/src/auto/cms-basic-auto.html?mode=readiness' };
  const tabBase = (() => { const u = new URL(tabUrl); return u.origin + u.pathname; })();
  const api = {
    storage: { local: storage },
    runtime: { id: 'ext', getURL: (p) => 'chrome-extension://ext/' + p,
      getManifest: () => ({ background: { service_worker: 'src/background/worker.mjs' } }) },
    windows: { update: async () => ({}) },
    tabs: {
      get: async () => ({ id: 5, url: tabUrl, windowId: 1, status: 'complete' }),
      create: async (o) => { stats.created.push(o.url); return { id: 5 }; },
      query: async () => [{ id: 5, url: tabUrl, active: true, lastAccessed: Date.now() }],
      update: async () => ({ id: 5, windowId: 1 }),
      sendMessage: async (_id, message) => {
        assert.equal(message.type, 'RESUME_FILL');
        stats.fill += 1;
        // Unsettled legacy reply: status verified, no readback reason, no
        // writeStarted/supportedComplete/operableComplete contract. Must not complete.
        return { ok: true, data: { fields: [{ id: 'x', path: 'customAnswers.婚姻状况', status: 'verified',
          scope: { sectionName: '个人基本信息必填' } }], softwareClickedSubmit: false } };
      }
    },
    scripting: {
      executeScript: async (req) => {
        if (req.files) return [];
        if (String(req.func).includes('hasFocus')) return [{ frameId: 0, result: { hasFocus: true, visible: true } }];
        stats.probeArgs.push(req.args?.[1]);
        stats.probeSigs.push(req.args?.[0]);
        const pageUrl = req.args?.[1];
        return [{ frameId: 0, result: tabBase === pageUrl
          ? { ok: true, reason: 'cms_page_ready', sectionPresent: true, itemCount: 9 }
          : { ok: false, reason: 'cms_wrong_page', looksLogin: false } }];
      }
    }
  };
  const runner = createCmsBasicAutoRunner({ api, timeoutMs: 5000,
    lifecycleOptions: { locks: { request: async (_n, _o, work) => work() }, cryptoImpl: globalThis.crypto } });
  const invoke = (message) => new Promise((resolve) => {
    if (runner.listener(message, sender, resolve) === false) resolve({ ok: false, reason: 'listener_ignored' });
  });
  return { invoke, stats, data };
}

test('SW tenant cmsPage: readiness finds tenant tab and probes tenant page', async () => {
  const h = swHarness({ tabUrl: ZL_PAGE + '?r=1' });
  const r = await h.invoke({ type: 'CMS_BASIC_AUTO', mode: 'readiness', cmsPage: ZL_PAGE });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.tenantSu, ZL);
  assert.equal(r.cmsPage, ZL_PAGE);
  assert.equal(r.baselineSu, false);
  assert.equal(r.readiness.pageState, 'ready');
  assert.ok(h.stats.probeArgs.every((p) => p === ZL_PAGE));
  assert.deepEqual(h.stats.probeSigs[0], ['个人基本信息必填']);
  const sig = r.steps.find((step) => step && step.signatureMode);
  assert.equal(sig.signatureMode, 'tenant');
  assert.deepEqual(sig.signature, ['个人基本信息必填']);
  assert.equal(h.stats.fill, 0);
});

test('SW 南粤 cmsPage uses the short tenant signature and never Save', async () => {
  const page = cmsPageForSu(HOTJOB_TENANTS.nanyue.su);
  const h = swHarness({ tabUrl: page + '?r=1' });
  const r = await h.invoke({ type: 'CMS_BASIC_AUTO', mode: 'readiness', cmsPage: page });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.tenantSu, HOTJOB_TENANTS.nanyue.su);
  assert.equal(r.baselineSu, false);
  assert.equal(r.saveAttempted, false);
  assert.equal(r.writeAttempted, false);
  assert.deepEqual(h.stats.probeSigs[0], ['个人基本信息必填']);
  const sig = r.steps.find((step) => step && step.signatureMode);
  assert.equal(sig.signatureMode, 'tenant');
  assert.deepEqual(sig.signature, ['个人基本信息必填']);
  assert.equal(h.stats.fill, 0);
});

test('SW baseline probe keeps the full three-heading signature', async () => {
  const h = swHarness({ tabUrl: CMS_BASELINE_PAGE + '?r=1' });
  const r = await h.invoke({ type: 'CMS_BASIC_AUTO', mode: 'readiness' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.baselineSu, true);
  assert.equal(r.tenantSu, CMS_BASELINE_SU);
  assert.deepEqual(h.stats.probeSigs[0], ['个人基本信息必填', '自我评价必填', '教育经历必填']);
  const sig = r.steps.find((step) => step && step.signatureMode);
  assert.equal(sig.signatureMode, 'baseline');
  assert.deepEqual(sig.signature, ['个人基本信息必填', '自我评价必填', '教育经历必填']);
});

test('SW without cmsPage still rejects a tenant tab (baseline unchanged)', async () => {
  const h = swHarness({ tabUrl: ZL_PAGE });
  const r = await h.invoke({ type: 'CMS_BASIC_AUTO', mode: 'readiness' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'cms_basic_login_or_wrong_page');
  assert.equal(r.tenantSu, CMS_BASELINE_SU);
});

test('SW tenant fill: per-SU trust scope, one RESUME_FILL, never Save', async () => {
  const h = swHarness({ tabUrl: ZL_PAGE, trusted: ['https://wecruit.hotjob.cn'] });
  const denied = await h.invoke({ type: 'CMS_BASIC_AUTO', mode: 'fill', cmsPage: ZL_PAGE });
  assert.equal(denied.ok, false);
  assert.equal(denied.reason, 'cms_basic_origin_unconfirmed', 'baseline origin trust must not cover tenant');
  assert.equal(h.stats.fill, 0);
  const r = await h.invoke({ type: 'CMS_BASIC_AUTO', mode: 'fill', cmsPage: ZL_PAGE, originConfirmed: true });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'cms_basic_status_unsettled');
  assert.equal(r.fill.ok, false);
  assert.equal(r.job.state, 'unknown');
  assert.equal(r.job.outcome, 'unknown');
  assert.equal(r.job.complete, false);
  assert.equal(h.stats.fill, 1);
  assert.equal(r.saveAttempted, false);
  assert.equal(r.writeAttempted, false);
  assert.equal(r.job.softwareClickedSave, false);
  assert.equal(r.job.softwareClickedSubmit, false);
  assert.equal(h.data['resumePendingFillReview:5']?.kind, 'cms_basic_auto');
  assert.ok(h.data.resumeTrustedOrigins.includes(`https://wecruit.hotjob.cn/${ZL}/`));
});

test('SW refuses invalid cmsPage before touching tabs', async () => {
  const h = swHarness({ tabUrl: ZL_PAGE });
  const r = await h.invoke({ type: 'CMS_BASIC_AUTO', mode: 'fill', originConfirmed: true,
    cmsPage: 'https://gszq.hotjob.cn/SU6879a7b3e57172288b60df9d/pb/resumeOperation.html' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'cms_basic_page_invalid');
  assert.equal(h.stats.fill, 0);
  assert.equal(h.stats.probeArgs.length, 0);
  assert.equal(h.stats.created.length, 0);
});

const harnessScript = path.join(root, 'scripts', 'auto-cms-basic.mjs');
const fakeEdge = path.join(root, 'tests', 'fixtures', 'fake-edge-cms-basic.mjs');

test('harness refuses mc shell with exit 4 and opens nothing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-mc-'));
  const log = path.join(dir, 'edge.log');
  const r = spawnSync(process.execPath, [harnessScript], { encoding: 'utf8', timeout: 15000,
    env: { ...process.env, CMS_PAGE: 'https://wecruit.hotjob.cn/SU661f37091eb8053acd6cdf3d/mc/deliver/operationResumer',
      AUTO_RUNS_DIR: dir, EDGE_PATH: fakeEdge, FAKE_EDGE_LOG: log } });
  assert.equal(r.status, 4, r.stderr);
  assert.match(r.stderr, /hotjob_mc_shell_requires_adapter/);
  assert.match(r.stderr, /auto-hotjob-mc-basic/);
  assert.equal(fs.existsSync(log), false);
  assert.deepEqual(fs.readdirSync(dir), []);
  const suOnly = spawnSync(process.execPath, [harnessScript], { encoding: 'utf8', timeout: 15000,
    env: { ...process.env, CMS_SU: ZL, CMS_PAGE: '',
      AUTO_RUNS_DIR: dir, EDGE_PATH: fakeEdge, FAKE_EDGE_LOG: log } });
  assert.equal(suOnly.status, 4, suOnly.stderr);
  assert.match(suOnly.stderr, /hotjob_mc_shell_requires_adapter/);
  assert.equal(fs.existsSync(log), false);
});

test('harness refuses bad CMS_PAGE with exit 3 and opens nothing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-target-'));
  const log = path.join(dir, 'edge.log');
  const r = spawnSync(process.execPath, [harnessScript], { encoding: 'utf8', timeout: 15000,
    env: { ...process.env, CMS_PAGE: 'https://gszq.hotjob.cn/x', AUTO_RUNS_DIR: dir, EDGE_PATH: fakeEdge, FAKE_EDGE_LOG: log } });
  assert.equal(r.status, 3, r.stderr);
  assert.match(r.stderr, /cms_page_invalid/);
  assert.equal(fs.existsSync(log), false);
  assert.deepEqual(fs.readdirSync(dir), []);
});

function runHarness(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [harnessScript], { env: { ...process.env, ...env } });
    let out = '', err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('exit', (code) => resolve({ code, out, err }));
  });
}

test('harness tenant run (stub Edge): passes cmsPage, records tenantSu, writes tenant-tagged copy, keeps baseline latest', { timeout: 30000 }, async () => {
  if (process.platform === 'win32') return; // stub relies on shebang exec
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-target-'));
  const log = path.join(dir, 'edge.log');
  const r = await runHarness({ CMS_PAGE: ZL_PAGE, CMS_SU: ZL, OPEN_CMS_PAGE: '0', MODE: 'readiness', AUTO_RUNS_DIR: dir,
    EDGE_PATH: fakeEdge, FAKE_EDGE_LOG: log, AUTO_TIMEOUT_MS: '15000' });
  assert.equal(r.code, 0, r.err + r.out);
  const urls = fs.readFileSync(log, 'utf8').trim().split('\n');
  assert.equal(urls.length, 1);
  assert.equal(new URL(urls[0]).searchParams.get('cmsPage'), ZL_PAGE);
  const files = fs.readdirSync(dir);
  const tenant = files.filter((f) => /^hotjob-tenant-661f37-cms-basic-\d{8}-\d{6}\.json$/.test(f));
  assert.equal(tenant.length, 1, files.join(','));
  assert.ok(files.some((f) => /^cms-basic-auto-\d{8}-\d{6}\.json$/.test(f)));
  assert.ok(files.includes('hotjob-tenant-cms-basic-latest.json'));
  assert.ok(!files.includes('cms-basic-latest.json'), 'tenant run must not clobber baseline latest');
  assert.ok(!files.includes('latest-cms-basic.json'));
  const ev = JSON.parse(fs.readFileSync(path.join(dir, tenant[0]), 'utf8'));
  assert.equal(ev.tenantSu, ZL);
  assert.equal(ev.harnessTarget.page, ZL_PAGE);
  assert.equal(ev.harnessTarget.tenantKey, 'zhonglian');
  assert.equal(ev.saveAttempted, false);
});

test('harness baseline run (stub Edge, OPEN_CMS_PAGE=1): opens 招商 page, no cmsPage qs, baseline pointers', { timeout: 30000 }, async () => {
  if (process.platform === 'win32') return;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-target-'));
  const log = path.join(dir, 'edge.log');
  const r = await runHarness({ CMS_PAGE: '', CMS_SU: '', MODE: 'readiness', AUTO_RUNS_DIR: dir,
    EDGE_PATH: fakeEdge, FAKE_EDGE_LOG: log, AUTO_TIMEOUT_MS: '20000' });
  assert.equal(r.code, 0, r.err + r.out);
  const urls = fs.readFileSync(log, 'utf8').trim().split('\n');
  assert.equal(urls[0], CMS_BASELINE_PAGE);
  assert.equal(new URL(urls[1]).searchParams.has('cmsPage'), false);
  const files = fs.readdirSync(dir);
  assert.ok(files.includes('cms-basic-latest.json'));
  assert.ok(files.includes('latest-cms-basic.json'));
  assert.ok(!files.some((f) => f.startsWith('hotjob-tenant-')));
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'cms-basic-latest.json'), 'utf8')).tenantSu, CMS_BASELINE_SU);
});
