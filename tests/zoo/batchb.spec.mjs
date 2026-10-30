import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { startZoo, SYNTHETIC } from './support.mjs';

const values = { allowExplicitValues: true, fullName: '离线申请人乙', mobile: '13800002222', email: 'applicant@example.test' };
const flow = 'src/content/controls/resume-form.js';

async function record(testInfo, zoo, result) {
  const evidence = await zoo.evidence();
  expect(evidence).toMatchObject({ neverSave: true, liveSupportClaimed: false,
    nonGetObserved: 0, nonGetBlocked: 0, responseToNonGet: 0,
    blacklistClickAttempts: 0, blacklistClicks: 0, guardFailed: false });
  expect(evidence.routing).toMatchObject({ rejected: [], nonGetReachedRoute: 0 });
  expect(zoo.page.url()).toBe(SYNTHETIC);
  const reads = await zoo.readback();
  expect(reads.model.neighbor).toBe('ZOO_NEIGHBOR_KEEP');
  expect(reads.model.disabledValue).toBe('ZOO_DISABLED_KEEP');
  if (reads.model.itemNeighbor != null) expect(reads.model.itemNeighbor).toBe('ZOO_ITEM_KEEP');
  expect(Object.keys(evidence.adapterHashes).length).toBeGreaterThan(0);
  await fs.writeFile(testInfo.outputPath('batchb-evidence.json'), JSON.stringify({ result, reads, evidence,
    execution: 'Exact built bytes; disposable CDP MAIN/ISOLATED contexts on loopback; no product host-permission changes' }, null, 2));
  await zoo.page.screenshot({ path: testInfo.outputPath('batchb-fixture.png'), fullPage: true });
  return reads;
}

for (const family of ['hotjob', 'beisen']) {
  test(`batch B ${family}: resume entry controls open the form before filling`, async ({}, testInfo) => {
    const zoo = await startZoo(family === 'hotjob' ? 'batchb-hotjob-entry' : 'batchb-beisen-summary');
    try {
      const file = family === 'hotjob' ? 'src/content/hotjob-mc-basic.js' : 'src/content/beisen-2022-basic.js';
      expect(await zoo.page.locator('input[id="fullName"]').count()).toBe(0);
      await zoo.inject([flow, file]);
      const result = await zoo.execute(async ({ family, values }) => {
        const api = family === 'hotjob' ? ResumeHotjobMcBasic : ResumeBeisen2022Basic;
        return api.fillBasic(values, { synthetic: true, restore: false, readinessTimeoutMs: 1200 });
      }, [{ family, values }]);
      expect(result, JSON.stringify(result)).toMatchObject({ ok: true, writeAttempted: true, liveSupportClaimed: false, saved: false, skippedSave: true });
      expect(result.results).toHaveLength(3);
      expect(result.results.every(row => row.ok)).toBe(true);
      for (const key of ['fullName', 'mobile', 'email']) expect(await zoo.page.locator(`#${key}`).inputValue()).toBe(values[key]);
      const reads = await record(testInfo, zoo, result);
      expect(reads.model).toMatchObject({ fullName: values.fullName, mobile: values.mobile, email: values.email });
      expect(reads.snapshot.effects.entryClicks).toEqual(family === 'hotjob' ? ['创建简历', '进入简历'] : ['编辑简历']);
    } finally { await zoo.close(); }
  });
}

for (const [name, variant] of [['batchb-hotjob-entry', 'submit'], ['batchb-beisen-summary', 'ambiguous']]) {
  test(`batch B entry rejects ${variant} controls without clicks or writes`, async ({}, testInfo) => {
    const zoo = await startZoo(name, variant);
    try {
      const family = name.includes('hotjob') ? 'hotjob' : 'beisen';
      await zoo.inject([flow, family === 'hotjob' ? 'src/content/hotjob-mc-basic.js' : 'src/content/beisen-2022-basic.js']);
      const before = await zoo.readback();
      const result = await zoo.execute(async ({ family, values }) => {
        const api = family === 'hotjob' ? ResumeHotjobMcBasic : ResumeBeisen2022Basic;
        return api.fillBasic(values, { synthetic: true, readinessTimeoutMs: 120 });
      }, [{ family, values }]);
      expect(result, JSON.stringify(result)).toMatchObject({ ok: false, writeAttempted: false, liveSupportClaimed: false });
      const reads = await record(testInfo, zoo, result);
      expect(reads).toEqual(before);
    } finally { await zoo.close(); }
  });
}

for (const variant of ['shared', 'owned', 'vue3']) {
  test(`batch B Moka: MAIN ${variant} model stays within each control root`, async ({}, testInfo) => {
    const zoo = await startZoo('batchb-moka-model', variant);
    try {
      const before = await zoo.readback();
      await zoo.inject(['src/content/controls/model.js'], 'MAIN');
      const isolated = await zoo.execute(() => ({ model: typeof ResumeControlModel,
        react: !!document.querySelector('#mobile').__reactFiber$offlineZoo,
        vue: !!document.querySelector('#mobile').__vueParentComponent }));
      expect(isolated).toEqual({ model: 'undefined', react: false, vue: false });
      const result = await zoo.execute(() => ['fullName', 'mobile', 'email'].map(key => {
        const input = document.getElementById(key), model = ResumeControlModel.inspect(input);
        return { key, framework: model.framework, available: model.available, value: model.value,
          rootId: model.controlRoot?.id, dom: input.value };
      }), [], 'MAIN');
      for (const row of result) {
        expect(row.framework).toBe(variant === 'vue3' ? 'vue3' : 'react');
        if (variant === 'owned') {
          expect(row.available).toBe(true);
          expect(row.value).toBe(before.model[row.key]);
          expect(row.dom).toBe(row.value);
        } else if (row.key !== 'fullName' || variant === 'vue3') {
          expect(row.available).toBe(false);
          expect(row.value).toBeNull();
        }
      }
      expect(result.slice(1).every(row => row.value !== before.model.fullName)).toBe(true);
      expect(await zoo.readback()).toEqual(before);
      await record(testInfo, zoo, { isolated, result });
    } finally { await zoo.close(); }
  });
}

for (const variant of ['', 'busy']) test(`batch B Feishu: waits for delayed ${variant || 'empty'} shell hydration before writing`, async ({}, testInfo) => {
  const zoo = await startZoo('batchb-feishu-shell', variant);
  try {
    await zoo.inject([flow, 'src/content/feishu-atsx-basic.js']);
    await zoo.execute(() => window.__zoo.startHydration(150), [], 'MAIN');
    const result = await zoo.execute(async values => ResumeFeishuAtsxBasic.fillBasic(values,
      { synthetic: true, readinessTimeoutMs: 1200 }), [values]);
    expect(result, JSON.stringify(result)).toMatchObject({ ok: true, writeAttempted: true, saved: false, skippedSave: true, liveSupportClaimed: false });
    const reads = await record(testInfo, zoo, result);
    expect(reads.model).toMatchObject({ fullName: values.fullName, mobile: values.mobile, email: values.email });
    expect(reads.snapshot.effects.entryClicks).toEqual([]);
    expect(reads.snapshot.effects.preHydrationInputEvents).toBe(0);
    for (const key of ['fullName', 'mobile', 'email']) expect(await zoo.page.locator(`#${key}`).inputValue()).toBe(values[key]);
  } finally { await zoo.close(); }
});

for (const variant of ['', 'partial', 'busy']) {
  test(`batch B Feishu: ${variant || 'empty'} shell times out without fake writes`, async ({}, testInfo) => {
    const zoo = await startZoo('batchb-feishu-shell', variant);
    try {
      await zoo.inject([flow, 'src/content/feishu-atsx-basic.js']);
      const before = await zoo.readback();
      const result = await zoo.execute(async values => ResumeFeishuAtsxBasic.fillBasic(values,
        { synthetic: true, readinessTimeoutMs: 120 }), [values]);
      expect(result, JSON.stringify(result)).toMatchObject({ ok: false, reason: 'form_not_ready',
        writeAttempted: false, saved: false, skippedSave: true, liveSupportClaimed: false });
      expect(['unsupported', 'manual']).toContain(result.status);
      expect(result.results.every(row => !row.ok)).toBe(true);
      expect(await zoo.readback()).toEqual(before);
      await record(testInfo, zoo, result);
    } finally { await zoo.close(); }
  });
}

for (const variant of ['routes', 'manual']) {
  test(`navigation engine: ${variant} stays passive in MAIN and ISOLATED worlds`, async ({}, testInfo) => {
    const zoo = await startZoo('batchb-navigation', variant);
    try {
      const before = await zoo.readback();
      const beforeDom = await zoo.page.content();
      const results = {};
      const flags = { readOnly: true, activation: 'manual', navigationAttempted: false,
        writeStarted: false, writeAttempted: false, saved: false, skippedSave: true, liveSupportClaimed: false };
      for (const world of ['MAIN', 'ISOLATED']) {
        await zoo.inject([flow], world);
        const result = await zoo.execute(() => ({
          inspection: ResumeFormFlow.navigation.inspect(),
          plans: [...document.querySelectorAll('#app button,#app a')].map(node => ({ id: node.id,
            ...ResumeFormFlow.navigation.plan(node) })),
        }), [], world);
        expect(result.inspection).toMatchObject(flags);
        expect(result.plans.length).toBeGreaterThan(0);
        for (const plan of result.plans) expect(plan).toMatchObject(flags);
        if (variant === 'routes') {
          expect(result.inspection.status).toBe('observed');
          expect(result.inspection.sections.map(row => row.strategy)).toEqual(['hash', 'query', 'tab']);
          expect(result.plans.every(row => row.status === 'planned')).toBe(true);
          expect(result.plans.find(row => row.id === 'nav-hash')).toMatchObject({ strategy: 'hash', target: 'education' });
          expect(result.plans.find(row => row.id === 'nav-tab')).toMatchObject({ strategy: 'tab', target: 'tab-panel' });
        } else {
          expect(result.inspection.status).toBe('manual');
          expect(result.inspection.sections.length).toBeGreaterThan(0);
          expect(result.inspection.sections.every(row => row.status === 'manual')).toBe(true);
          expect(result.plans.every(row => row.status === 'manual' && row.strategy === 'none')).toBe(true);
        }
        results[world] = result;
      }
      expect(results.MAIN).toEqual(results.ISOLATED);
      expect(await zoo.page.content()).toBe(beforeDom);
      expect(await zoo.readback()).toEqual(before);
      const reads = await record(testInfo, zoo, results);
      expect(reads.snapshot.effects).toEqual({ blacklistClicks: 0, entryClicks: [], inputEvents: 0,
        preHydrationInputEvents: 0, navigationEvents: 0, navigationHandlerCalls: 0 });
    } finally { await zoo.close(); }
  });
}
