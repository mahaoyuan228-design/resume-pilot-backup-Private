import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { startZoo, SYNTHETIC } from './support.mjs';

const files = ['model', 'registry', 'upload', 'native', 'date-controls', 'time-controls', 'vue-controls', 'extended-controls', 'date-range-controls', 'tree-select-controls', 'slider-controls']
  .map(name => `src/content/controls/${name}.js`);
const families = [['native', 'native-slider'], ['element', 'el-slider'], ['ant', 'antdv1-slider']];

async function fixture(work, testInfo) {
  const zoo = await startZoo('slider-generic');
  try {
    await zoo.inject(files, 'MAIN');
    const result = await work(zoo), reads = await zoo.readback(), evidence = await zoo.evidence();
    expect(reads.model).toMatchObject({ neighbor: 'ZOO_NEIGHBOR_KEEP', disabledValue: 'ZOO_DISABLED_KEEP',
      disabledElement: 10, disabledAnt: 10, readonlyElement: 10, readonlyAnt: 10,
      rangeElement: [10, 30], rangeAnt: [10, 30] });
    expect(reads.snapshot.effects).toMatchObject({ blacklistClicks: 0, submits: 0 });
    expect(evidence).toMatchObject({ neverSave: true, liveSupportClaimed: false, nonGetObserved: 0,
      nonGetBlocked: 0, responseToNonGet: 0, blacklistClickAttempts: 0, blacklistClicks: 0, guardFailed: false });
    expect(evidence.routing).toMatchObject({ rejected: [], nonGetReachedRoute: 0 });
    expect(zoo.page.url()).toBe(SYNTHETIC);
    for (const file of files) expect(evidence.adapterHashes[file]).toMatch(/^[a-f0-9]{64}$/u);
    await fs.writeFile(testInfo.outputPath('slider-evidence.json'), JSON.stringify({ result, reads, evidence,
      execution: 'Exact packaged bytes on disposable loopback; native range and pinned real Vue sliders; offline contract only' }, null, 2));
    await zoo.page.screenshot({ path: testInfo.outputPath('slider-fixture.png'), fullPage: true });
  } finally { await zoo.close(); }
}

async function write(zoo, family, value, operation = 'set') {
  return zoo.execute(async ({ family, value, operation }) => {
    const el = window.__zooSlider.root(family), adapter = ResumeControls.resolve(el);
    const plan = ResumeControls.plan(el, { value, operation });
    const denied = await adapter.write(el, plan);
    const written = await adapter.write(el, plan, { allowWrite: true, check: async () => {
      if (!el.isConnected || document.visibilityState !== 'visible') throw Error('offline_slider_target_changed');
    } });
    return { plan, denied, written, verified: await ResumeControls.verify(el, plan, { settleMs: 40 }) };
  }, [{ family, value, operation }], 'MAIN');
}

test('generic sliders: passive plans, value writes, owned clicks and drags read back native and real Vue models', async ({}, testInfo) => {
  await fixture(async zoo => {
    const before = await zoo.readback();
    const passive = await zoo.execute(() => ['native', 'element', 'ant'].map(family => {
      const el = window.__zooSlider.root(family);
      return ResumeControls.plan(el, { value: 75 });
    }), [], 'MAIN');
    for (let index = 0; index < families.length; index++) expect(passive[index], JSON.stringify(passive)).toMatchObject({
      adapter: families[index][1], type: 'slider', status: 'planned', liveSupportClaimed: false,
    });
    expect(await zoo.readback()).toEqual(before);
    const results = [];
    for (const [family] of families) {
      const operations = [];
      for (const [operation, value] of [['set', 75], ['click', 25], ['drag', 90]]) {
        const result = await write(zoo, family, value, operation);
        expect(result.plan.status, JSON.stringify(result)).toBe('planned');
        expect(result.denied).toMatchObject({ status: 'unsupported', reason: 'shadow_mode', attempts: 0 });
        expect(result.written.attempts, JSON.stringify(result)).toBeGreaterThan(0);
        expect(result.verified, JSON.stringify(result)).toMatchObject({ status: 'success', modelReadback: value, domReadback: value });
        const reads = await zoo.readback();
        expect(reads.model[family]).toBe(value);
        expect(reads.snapshot.display[family]).toBe(value);
        operations.push(result);
      }
      const repeatedBefore = await zoo.readback(), repeated = await write(zoo, family, 90, 'drag');
      expect(repeated.plan.status, JSON.stringify(repeated)).toBe('success');
      expect(repeated.written).toMatchObject({ status: 'success', attempts: 0 });
      expect(await zoo.readback()).toEqual(repeatedBefore);
      expect(repeatedBefore.snapshot.effects.clicks[family] + repeatedBefore.snapshot.effects.downs[family]).toBeGreaterThan(0);
      results.push({ family, operations, repeated });
    }
    return { passive, results };
  }, testInfo);
});

test('generic sliders: disabled, readonly, range mode, invalid values and stale targets stay effect free', async ({}, testInfo) => {
  await fixture(async zoo => {
    const before = await zoo.readback();
    const result = await zoo.execute(async () => {
      const guarded = ['slider-native-disabled', 'slider-native-readonly', 'slider-element-disabled', 'slider-ant-disabled',
        'slider-element-readonly', 'slider-ant-readonly', 'slider-element-range', 'slider-ant-range']
        .map(id => ResumeControls.plan(document.getElementById(id), { value: 75, operation: 'drag' }));
      const invalid = [null, true, {}, [], '75px', 101, -1, 12].map(value => ResumeControls.plan(window.__zooSlider.root('native'), { value }));
      const el = window.__zooSlider.root('element'), adapter = ResumeControls.resolve(el);
      const plan = ResumeControls.plan(el, { value: 75 }), copied = JSON.parse(JSON.stringify(plan));
      const replayed = await adapter.write(el, copied, { allowWrite: true, check: async () => {} });
      const guardedWrite = await adapter.write(el, plan, { allowWrite: true, check: async () => { throw Error('offline_slider_guard'); } })
        .catch(error => ({ reason: error.message }));
      return { guarded, invalid, replayed, guardedWrite };
    }, [], 'MAIN');
    for (const plan of [...result.guarded, ...result.invalid]) expect(['planned', 'success'], JSON.stringify(plan)).not.toContain(plan.status);
    expect(result.replayed).toMatchObject({ status: 'unsupported', attempts: 0 });
    expect(result.guardedWrite.reason).toBe('offline_slider_guard');
    expect(await zoo.readback()).toEqual(before);
    return result;
  }, testInfo);
});

test('generic sliders: public model and displayed thumb disagreement plus delayed reversion cannot verify as success', async ({}, testInfo) => {
  await fixture(async zoo => {
    const results = [];
    for (const [family] of families.filter(([family]) => family !== 'native')) {
      const written = await write(zoo, family, 75);
      expect(written.verified.status, JSON.stringify(written)).toBe('success');
      const result = await zoo.execute(async family => {
        const el = window.__zooSlider.root(family), plan = ResumeControls.plan(el, { value: 75 });
        const display = family === 'element' ? el.querySelector('.el-slider__button-wrapper') : el.querySelector('[role="slider"]');
        const previous = family === 'element' ? display.style.left : display.getAttribute('aria-valuenow');
        if (family === 'element') display.style.left = '30%'; else display.setAttribute('aria-valuenow', '30');
        const mismatch = await ResumeControls.verify(el, plan, { settleMs: 0 });
        if (family === 'element') display.style.left = previous; else display.setAttribute('aria-valuenow', previous);
        setTimeout(() => { window.__zooSlider.owner[family] = 20; }, 10);
        const reverted = await ResumeControls.verify(el, plan, { settleMs: 80 });
        return { mismatch, reverted };
      }, [family], 'MAIN');
      expect(result.mismatch.status, JSON.stringify(result)).toBe('mismatch');
      expect(result.reverted.status, JSON.stringify(result)).toBe('reverted');
      expect((await zoo.readback()).model[family]).toBe(20);
      results.push({ family, written, ...result });
    }
    return results;
  }, testInfo);
});
