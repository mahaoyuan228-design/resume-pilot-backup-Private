/**
 * Feishu ATSX / Beisen-2022 / Moka / hotjob-mc BASIC_AUTO wiring:
 * - resolve*Target refuses wrong hosts (fail-closed siteId isolation)
 * - trusted auto-page sender accepted; wrong sender rejected
 * - readiness probes without write; saveAttempted stays false
 * Offline only; never Save; no live claim.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFeishuAtsxBasicAutoRunner, resolveFeishuAtsxTarget, isFeishuAtsxTabUrl
} from '../src/background/feishu-atsx-basic-auto.mjs';
import {
  createBeisen2022BasicAutoRunner, resolveBeisen2022Target, isBeisen2022TabUrl
} from '../src/background/beisen-2022-basic-auto.mjs';
import {
  createMokaBasicAutoRunner, resolveMokaTarget, isMokaTabUrl
} from '../src/background/moka-basic-auto.mjs';
import {
  createHotjobMcBasicAutoRunner, resolveHotjobMcTarget, isHotjobMcTabUrl
} from '../src/background/hotjob-mc-basic-auto.mjs';

const epoch = '00000000-0000-4000-8000-000000000001';

test('resolveFeishuAtsxTarget: sample default + host accept/refuse', () => {
  const d = resolveFeishuAtsxTarget(undefined);
  assert.equal(d.sample, true);
  assert.match(d.page, /gffunds\.jobs\.feishu\.cn/);
  assert.equal(resolveFeishuAtsxTarget('https://jobs.bytedance.com/campus/').host, 'jobs.bytedance.com');
  assert.equal(resolveFeishuAtsxTarget('https://acme.jobs.feishu.cn/resume').sample, false);
  assert.equal(resolveFeishuAtsxTarget('https://xiaomi.jobs.f.mioffice.cn/index').host, 'xiaomi.jobs.f.mioffice.cn');
  for (const bad of [
    'http://gffunds.jobs.feishu.cn/',
    'https://jobs.feishu.cn.evil.com/',
    'https://jobs.f.mioffice.cn.evil.com/',
    'https://wecruit.hotjob.cn/SUx/pb/resumeOperation.html',
    'https://junlebaoruye.zhiye.com/',
    'https://app.mokahr.com/',
    'https://user:pass@gffunds.jobs.feishu.cn/',
    42, {}
  ]) assert.throws(() => resolveFeishuAtsxTarget(bad), /feishu_atsx_page_invalid/, String(bad));
  assert.equal(isFeishuAtsxTabUrl('https://gffunds.jobs.feishu.cn/index'), true);
  assert.equal(isFeishuAtsxTabUrl('https://xiaomi.jobs.f.mioffice.cn/index'), true);
  assert.equal(isFeishuAtsxTabUrl('https://careers.citics.com/my/jl'), false);
});

test('resolveBeisen2022Target: sample default + host accept/refuse', () => {
  const d = resolveBeisen2022Target(null);
  assert.equal(d.sample, true);
  assert.match(d.host, /zhiye\.com$/);
  assert.equal(resolveBeisen2022Target('https://invt.zhiye.com/').host, 'invt.zhiye.com');
  for (const bad of [
    'http://junlebaoruye.zhiye.com/',
    'https://zhiye.com.evil.com/',
    'https://gffunds.jobs.feishu.cn/',
    'https://app.mokahr.com/',
    'https://wecruit.hotjob.cn/SU1/pb/resumeOperation.html',
    'not-a-url'
  ]) assert.throws(() => resolveBeisen2022Target(bad), /beisen_2022_page_invalid/, String(bad));
  assert.equal(isBeisen2022TabUrl('https://jssoft.zhiye.com/x'), true);
  assert.equal(isBeisen2022TabUrl('https://jobs.bytedance.com/'), false);
});

test('resolveMokaTarget: sample default + host accept/refuse', () => {
  const d = resolveMokaTarget('');
  assert.equal(d.sample, true);
  assert.equal(d.host, 'app.mokahr.com');
  assert.equal(resolveMokaTarget('https://static-ats.mokahr.com/x').host, 'static-ats.mokahr.com');
  for (const bad of [
    'http://app.mokahr.com/',
    'https://mokahr.com.evil.com/',
    'https://gffunds.jobs.feishu.cn/',
    'https://junlebaoruye.zhiye.com/',
    'https://careers.citics.com/my/jl',
    []
  ]) assert.throws(() => resolveMokaTarget(bad), /moka_page_invalid/, String(bad));
  assert.equal(isMokaTabUrl('https://app.mokahr.com/campus-recruitment/ti/143986'), true);
  assert.equal(isMokaTabUrl('https://wecruit.hotjob.cn/x'), false);
});

function makeHarness({
  createRunner, autoHtml, messageType, tabUrl, probeReason, probeOk = true, fillResult = null,
  formReadiness = { status: 'ready', reason: 'visible_editable_form' }, formReadinessSequence = null, permission = true,
  preparation = { ok: true, status: 'ready', reason: 'form_ready', entryAttempted: false, writeAttempted: false }, foundLabels = ['姓名', '手机号码', '邮箱']
}) {
  const data = {
    resumeProfile: {
      schemaVersion: 1,
      fullName: 'Synthetic Customer B',
      phone: '13800138000',
      email: 'b@example.com',
      confirmedFields: ['fullName', 'phone', 'email']
    },
    resumeProfileLifecycle: { version: 1, epoch, state: 'ready' }
  };
  const clone = (value) => (value === undefined ? undefined : structuredClone(value));
  const stats = { fill: 0, inject: 0, prepare: 0, probe: 0, readiness: 0, readinessInject: 0 };
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
    url: `chrome-extension://synthetic-extension/${autoHtml}?mode=readiness`
  };
  const badSender = {
    id: 'synthetic-extension',
    url: 'chrome-extension://synthetic-extension/src/auto/citics-basic-auto.html'
  };
  const invoke = (message, sender = autoSender) =>
    new Promise((resolve) => {
      const handled = runner.listener(message, sender, resolve);
      if (handled === false) resolve({ ok: false, reason: 'listener_ignored' });
    });
  const api = {
    permissions: { getAll: async () => ({ origins: permission ? ['https://*/*'] : [] }), contains: async () => permission },
    storage: { local: storage },
    runtime: {
      id: autoSender.id,
      getURL: (path) => 'chrome-extension://synthetic-extension/' + path,
      getManifest: () => ({ background: { service_worker: 'src/background/worker.mjs' } })
    },
    windows: { update: async () => ({}) },
    tabs: {
      get: async () => ({ id: 42, url: tabUrl, windowId: 1, status: 'complete' }),
      create: async () => ({ id: 42, url: tabUrl, windowId: 1, status: 'complete' }),
      query: async () => [{ id: 42, url: tabUrl, active: true, lastAccessed: Date.now() }],
      update: async () => ({ id: 42, url: tabUrl, windowId: 1 })
    },
    scripting: {
      executeScript: async (request) => {
        if (request.files) {
          if (request.files.length === 1 && request.files[0] === 'src/content/controls/resume-form.js') {
            stats.readinessInject += 1;
            return [];
          }
          assert.deepEqual(request.files, ['src/core/matcher.js', 'src/content/controls/resume-form.js', 'src/content/engine.js']);
          stats.inject += 1;
          return [];
        }
        if (typeof request.func === 'function') {
          const src = String(request.func);
          if (src.includes('ResumeFormFlow') && src.includes('readiness')) {
            const result = formReadinessSequence?.[stats.readiness] ?? formReadiness;
            stats.readiness += 1;
            return [{ result: clone(result) }];
          }
          if (src.includes('prepareForm')) {
            stats.prepare += 1;
            return [{ result: clone(preparation) }];
          }
          if (src.includes('ResumeQuickFillFillCurrentPage')) {
            stats.fill += 1;
            if (fillResult) return [{ result: clone(fillResult) }];
            return [{
              result: {
                ok: true,
                siteId: messageType.includes('FEISHU') ? 'feishu-atsx'
                  : messageType.includes('BEISEN') ? 'beisen-2022'
                  : messageType.includes('HOTJOB_MC') ? 'hotjob-mc'
                  : 'moka',
                saved: false,
                skippedSave: true,
                writeAttempted: true,
                results: foundLabels.map((label) => ({ label, ok: true, status: 'verified' })),
                href: tabUrl
              }
            }];
          }
          stats.probe += 1;
          return [{
            result: {
              ok: probeOk,
              reason: probeReason,
              href: tabUrl,
              readyState: 'complete',
              visible: 'visible',
              foundLabels,
              looksLogin: false,
              title: 'synthetic'
            }
          }];
        }
        return [];
      }
    }
  };
  runner = createRunner({
    api,
    lifecycleOptions: { locks: { request: async (_n, _o, work) => work() }, cryptoImpl: globalThis.crypto }
  });
  return { invoke, autoSender, badSender, stats, data, messageType };
}

test('FEISHU_ATSX_BASIC_AUTO: wrong sender rejected; readiness no write', async () => {
  const h = makeHarness({
    createRunner: createFeishuAtsxBasicAutoRunner,
    autoHtml: 'src/auto/feishu-atsx-basic-auto.html',
    messageType: 'FEISHU_ATSX_BASIC_AUTO',
    tabUrl: 'https://gffunds.jobs.feishu.cn/resume',
    probeReason: 'feishu_atsx_page_ready'
  });
  const bad = await h.invoke({ type: 'FEISHU_ATSX_BASIC_AUTO', mode: 'readiness' }, h.badSender);
  assert.equal(bad.reason, 'feishu_atsx_basic_wrong_sender');
  assert.equal(h.stats.fill, 0);
  const ready = await h.invoke({ type: 'FEISHU_ATSX_BASIC_AUTO', mode: 'readiness', openIfMissing: false });
  assert.equal(ready.ok, true);
  assert.equal(ready.siteId, 'feishu-atsx');
  assert.equal(ready.saveAttempted, false);
  assert.equal(ready.skippedSave, true);
  assert.equal(ready.liveSupportClaimed, false);
  assert.equal(h.stats.fill, 0);
  assert.ok(h.stats.probe >= 1);
});

test('BEISEN_2022_BASIC_AUTO: wrong sender rejected; fill path never save', async () => {
  const h = makeHarness({
    createRunner: createBeisen2022BasicAutoRunner,
    autoHtml: 'src/auto/beisen-2022-basic-auto.html',
    messageType: 'BEISEN_2022_BASIC_AUTO',
    tabUrl: 'https://junlebaoruye.zhiye.com/resume',
    probeReason: 'beisen_2022_page_ready'
  });
  const bad = await h.invoke({ type: 'BEISEN_2022_BASIC_AUTO', mode: 'fill' }, h.badSender);
  assert.equal(bad.reason, 'beisen_2022_basic_wrong_sender');
  const filled = await h.invoke({ type: 'BEISEN_2022_BASIC_AUTO', mode: 'fill', openIfMissing: false });
  assert.equal(filled.ok, true);
  assert.equal(filled.siteId, 'beisen-2022');
  assert.equal(filled.saveAttempted, false);
  assert.equal(filled.skippedSave, true);
  assert.equal(filled.writeAttempted, true);
  assert.equal(h.stats.inject, 1);
  assert.equal(h.stats.prepare, 0);
  assert.equal(h.stats.fill, 1);
});

test('MOKA_BASIC_AUTO: wrong sender + invalid targetPage refused before tab work', async () => {
  const h = makeHarness({
    createRunner: createMokaBasicAutoRunner,
    autoHtml: 'src/auto/moka-basic-auto.html',
    messageType: 'MOKA_BASIC_AUTO',
    tabUrl: 'https://app.mokahr.com/campus-recruitment/ti/143986',
    probeReason: 'moka_page_ready'
  });
  const bad = await h.invoke({ type: 'MOKA_BASIC_AUTO', mode: 'readiness' }, h.badSender);
  assert.equal(bad.reason, 'moka_basic_wrong_sender');
  const refused = await h.invoke({
    type: 'MOKA_BASIC_AUTO',
    mode: 'readiness',
    openIfMissing: false,
    targetPage: 'https://gffunds.jobs.feishu.cn/'
  });
  assert.equal(refused.ok, false);
  assert.match(refused.reason, /moka_page_invalid|moka_basic/);
  assert.equal(refused.saveAttempted, false);
  assert.equal(h.stats.probe, 0);
  const ready = await h.invoke({ type: 'MOKA_BASIC_AUTO', mode: 'readiness', openIfMissing: false });
  assert.equal(ready.ok, true);
  assert.equal(ready.siteId, 'moka');
  assert.equal(ready.liveSupportClaimed, false);
});


test('resolveHotjobMcTarget: sample default + host/SU path accept/refuse', () => {
  const d = resolveHotjobMcTarget(undefined);
  assert.equal(d.sample, true);
  assert.equal(d.host, 'wecruit.hotjob.cn');
  assert.equal(d.su, 'SU661f37091eb8053acd6cdf3d');
  assert.match(d.page, /\/mc\/deliver\/operationResumer$/);
  const ok = resolveHotjobMcTarget(
    'https://wecruit.hotjob.cn/SU661f37091eb8053acd6cdf3d/mc/deliver/operationResumer?x=1'
  );
  assert.equal(ok.sample, false);
  assert.equal(ok.su, 'SU661f37091eb8053acd6cdf3d');
  assert.equal(ok.page, 'https://wecruit.hotjob.cn/SU661f37091eb8053acd6cdf3d/mc/deliver/operationResumer?x=1');
  for (const bad of [
    'http://wecruit.hotjob.cn/SU661f37091eb8053acd6cdf3d/mc/deliver/operationResumer',
    'https://hotjob.cn.evil.com/SU661f37091eb8053acd6cdf3d/mc/deliver/operationResumer',
    'https://gffunds.jobs.feishu.cn/',
    'https://app.mokahr.com/',
    'https://user:pass@wecruit.hotjob.cn/SU661f37091eb8053acd6cdf3d/mc/deliver/operationResumer',
    42, {}
  ]) assert.throws(() => resolveHotjobMcTarget(bad), /hotjob_mc_page_invalid/, String(bad));
  assert.equal(
    isHotjobMcTabUrl('https://wecruit.hotjob.cn/SU661f37091eb8053acd6cdf3d/mc/deliver/operationResumer'),
    true
  );
  assert.equal(isHotjobMcTabUrl('https://wecruit.hotjob.cn/SU661f37091eb8053acd6cdf3d/pb/resumeOperation.html'), true);
  assert.equal(resolveHotjobMcTarget('https://fixture.hotjob.cn/').advisoryHints[0].reason, 'hotjob_mc_page_invalid');
  assert.equal(isHotjobMcTabUrl('https://app.mokahr.com/x'), false);
});

test('HOTJOB_MC_BASIC_AUTO: wrong sender refused; same-system page warning does not block', async () => {
  const h = makeHarness({
    createRunner: createHotjobMcBasicAutoRunner,
    autoHtml: 'src/auto/hotjob-mc-basic-auto.html',
    messageType: 'HOTJOB_MC_BASIC_AUTO',
    tabUrl: 'https://wecruit.hotjob.cn/SU661f37091eb8053acd6cdf3d/mc/deliver/operationResumer',
    probeReason: 'hotjob_mc_page_ready',
    foundLabels: ['姓名', '移动电话', '电子邮箱']
  });
  const bad = await h.invoke({ type: 'HOTJOB_MC_BASIC_AUTO', mode: 'readiness' }, h.badSender);
  assert.equal(bad.reason, 'hotjob_mc_basic_wrong_sender');
  assert.equal(h.stats.fill, 0);
  const refused = await h.invoke({
    type: 'HOTJOB_MC_BASIC_AUTO',
    mode: 'readiness',
    openIfMissing: false,
    targetPage: 'https://wecruit.hotjob.cn/SU661f37091eb8053acd6cdf3d/pb/resumeOperation.html'
  });
  assert.equal(refused.ok, true);
  assert.equal(refused.advisoryHints[0].reason, 'hotjob_mc_page_invalid');
  assert.equal(refused.saveAttempted, false);
  assert.equal(h.stats.probe, 1);
  const ready = await h.invoke({ type: 'HOTJOB_MC_BASIC_AUTO', mode: 'readiness', openIfMissing: false });
  assert.equal(ready.ok, true);
  assert.equal(ready.siteId, 'hotjob-mc');
  assert.equal(ready.saveAttempted, false);
  assert.equal(ready.skippedSave, true);
  assert.equal(ready.liveSupportClaimed, false);
  assert.equal(h.stats.fill, 0);
  assert.ok(h.stats.probe >= 1);
  const filled = await h.invoke({ type: 'HOTJOB_MC_BASIC_AUTO', mode: 'fill', openIfMissing: false });
  assert.equal(filled.ok, true);
  assert.equal(filled.siteId, 'hotjob-mc');
  assert.equal(filled.saveAttempted, false);
  assert.equal(filled.skippedSave, true);
  assert.equal(filled.writeAttempted, true);
  assert.equal(h.stats.inject, 1);
  assert.equal(h.stats.prepare, 0);
  assert.equal(h.stats.fill, 1);
});

const autoScenarios = [
  { createRunner: createMokaBasicAutoRunner, autoHtml: 'src/auto/moka-basic-auto.html', messageType: 'MOKA_BASIC_AUTO', tabUrl: 'https://app.mokahr.com/resume', probeReason: 'moka_page_ready', storageKey: 'resumeMokaBasicAutoRun' },
  { createRunner: createHotjobMcBasicAutoRunner, autoHtml: 'src/auto/hotjob-mc-basic-auto.html', messageType: 'HOTJOB_MC_BASIC_AUTO', tabUrl: 'https://wecruit.hotjob.cn/SU00000000/mc/deliver/operationResumer', probeReason: 'hotjob_mc_page_ready', storageKey: 'resumeHotjobMcBasicAutoRun' },
  { createRunner: createBeisen2022BasicAutoRunner, autoHtml: 'src/auto/beisen-2022-basic-auto.html', messageType: 'BEISEN_2022_BASIC_AUTO', tabUrl: 'https://synthetic.zhiye.com/resume', probeReason: 'beisen_2022_page_ready', storageKey: 'resumeBeisen2022BasicAutoRun' },
  { createRunner: createFeishuAtsxBasicAutoRunner, autoHtml: 'src/auto/feishu-atsx-basic-auto.html', messageType: 'FEISHU_ATSX_BASIC_AUTO', tabUrl: 'https://synthetic.jobs.feishu.cn/resume', probeReason: 'feishu_atsx_page_ready', storageKey: 'resumeFeishuAtsxBasicAutoRun' }
];
const advisoryStates = [
  { status: 'login_required', reason: 'visible_login_wall' },
  { status: 'form_not_ready', reason: 'form_loading' },
  { status: 'manual', reason: 'iframe_or_captcha_manual' }
];

for (const scenario of autoScenarios) {
  test(`${scenario.messageType}: missing host permission stops before any injection or write`, async () => {
    for (const mode of ['readiness', 'fill']) {
      const h = makeHarness({ ...scenario, permission: false });
      const result = await h.invoke({ type: scenario.messageType, mode, openIfMissing: false });
      assert.equal(result.ok, false);
      assert.equal(result.status, 'no_permission');
      assert.equal(result.reason, 'host_permission_missing');
      assert.equal(result.formReadiness.reason, result.reason);
      assert.equal(result.fillNotStarted, true);
      assert.equal(result.writeStarted, false);
      assert.equal(result.writeAttempted, false);
      assert.equal(result.saveAttempted, false);
      assert.equal(result.skippedSave, true);
      assert.equal(result.liveSupportClaimed, false);
      assert.deepEqual(h.stats, { fill: 0, inject: 0, prepare: 0, probe: 0, readiness: 0, readinessInject: 0 });
      assert.equal(h.data[scenario.storageKey].reason, 'host_permission_missing');
      assert.equal(h.data[scenario.storageKey].writeStarted, false);
    }
  });

  test(`${scenario.messageType}: ready is observed before probe and writing without opening an editor`, async () => {
    const h = makeHarness(scenario);
    const result = await h.invoke({ type: scenario.messageType, mode: 'fill', openIfMissing: false });
    assert.equal(result.ok, true);
    assert.equal(result.formReadiness.status, 'ready');
    assert.equal(h.stats.readiness, 2);
    assert.equal(h.stats.fill, 1);
    assert.equal(h.stats.prepare, 0);
    assert.equal(result.saveAttempted, false);
    assert.equal(result.liveSupportClaimed, false);
  });

  for (const formReadiness of advisoryStates) {
    test(`${scenario.messageType}: ${formReadiness.status} is retained as a hint while fill/readback continues`, async () => {
      for (const mode of ['readiness', 'fill']) {
        const h = makeHarness({ ...scenario, formReadiness });
        const result = await h.invoke({ type: scenario.messageType, mode, openIfMissing: false });
        assert.equal(result.ok, true);
        assert.equal(result.formReadiness.reason, formReadiness.reason);
        assert.equal(result.advisoryHints[0].reason, formReadiness.reason);
        assert.equal(result.advisoryHints[0].blocking, false);
        assert.equal(result.writeAttempted, mode === 'fill');
        assert.equal(result.saveAttempted, false);
        assert.equal(result.skippedSave, true);
        assert.equal(result.liveSupportClaimed, false);
        assert.equal(h.stats.readiness, mode === 'fill' ? 2 : 1);
        assert.equal(h.stats.prepare, 0);
        assert.equal(h.stats.probe, 1);
        assert.equal(h.stats.fill, mode === 'fill' ? 1 : 0);
        assert.equal(h.data[scenario.storageKey].advisoryHints[0].reason, formReadiness.reason);
        if (mode === 'fill') assert.ok(result.job.results.every(row => row.ok));
      }
    });
  }

  test(`${scenario.messageType}: readiness changes and failed ATS probe remain hints while filling`, async () => {
    const blocked = advisoryStates[0];
    const h = makeHarness({ ...scenario, probeOk: false, probeReason: 'login_or_wrong_page',
      formReadinessSequence: [{ status: 'ready', reason: 'visible_editable_form' }, blocked] });
    const result = await h.invoke({ type: scenario.messageType, mode: 'fill', openIfMissing: false });
    assert.equal(result.ok, true);
    assert.deepEqual(result.advisoryHints.map(row => row.reason), ['login_or_wrong_page', blocked.reason]);
    assert.equal(result.writeAttempted, true);
    assert.equal(result.saveAttempted, false);
    assert.equal(result.liveSupportClaimed, false);
    assert.equal(h.stats.readiness, 2);
    assert.equal(h.stats.probe, 1);
    assert.equal(h.stats.fill, 1);
    assert.ok(result.job.results.every(row => row.ok));
    assert.equal(h.data[scenario.storageKey].advisoryHints[1].reason, blocked.reason);
  });
}

for (const scenario of autoScenarios) {
  test(`${scenario.messageType}: generic field readbacks and manual rows survive the runner`, async () => {
    const fields = [
      { id: 'contact-name', path: 'fullName', status: 'verified', reason: 'readback_matched', beforeValue: '', currentValue: 'Synthetic Customer B' },
      { id: 'unknown-field', status: 'manual', reason: 'field_unrecognized', beforeValue: '', currentValue: '' }
    ];
    const h = makeHarness({ ...scenario, fillResult: { ok: true, data: {
      fields, writeStarted: true, saved: false, skippedSave: true,
      advisoryHints: [{ reason: 'form_unrecognized', advisory: true, blocking: false }]
    } } });
    const result = await h.invoke({ type: scenario.messageType, mode: 'fill', openIfMissing: false });
    assert.equal(result.ok, true);
    assert.deepEqual(result.job.results, fields);
    assert.equal(result.fill.fieldCount, 2);
    assert.equal(result.fill.matched, 1);
    assert.equal(result.advisoryHints[0].reason, 'form_unrecognized');
    assert.equal(h.stats.fill, 1);
    assert.equal(h.stats.prepare, 0);
    assert.equal(result.saveAttempted, false);
  });

  test(`${scenario.messageType}: generic engine save/submit claims still fail closed`, async () => {
    for (const claim of ['saved', 'saveAttempted', 'softwareClickedSave', 'softwareClickedSubmit', 'softwareClickedDelete', 'savedOnSite', 'submitted']) {
      const h = makeHarness({ ...scenario, fillResult: { ok: true, data: {
        fields: [], skippedSave: true, [claim]: true
      } } });
      const result = await h.invoke({ type: scenario.messageType, mode: 'fill', openIfMissing: false });
      assert.equal(result.ok, false, claim);
      assert.match(result.reason, /save_policy_violation/);
      assert.equal(result.liveSupportClaimed, false);
      assert.equal(h.stats.fill, 1);
    }
  });
}

test('cross-site message types do not share listeners', async () => {
  const feishu = makeHarness({
    createRunner: createFeishuAtsxBasicAutoRunner,
    autoHtml: 'src/auto/feishu-atsx-basic-auto.html',
    messageType: 'FEISHU_ATSX_BASIC_AUTO',
    tabUrl: 'https://gffunds.jobs.feishu.cn/',
    probeReason: 'feishu_atsx_page_ready'
  });
  const ignored = await feishu.invoke({ type: 'MOKA_BASIC_AUTO', mode: 'readiness' });
  assert.equal(ignored.reason, 'listener_ignored');
  const ignored2 = await feishu.invoke({ type: 'BEISEN_2022_BASIC_AUTO', mode: 'readiness' });
  assert.equal(ignored2.reason, 'listener_ignored');
  const ignored3 = await feishu.invoke({ type: 'HOTJOB_MC_BASIC_AUTO', mode: 'readiness' });
  assert.equal(ignored3.reason, 'listener_ignored');
});
