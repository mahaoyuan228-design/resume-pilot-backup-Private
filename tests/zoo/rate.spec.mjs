import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { startZoo, SYNTHETIC } from './support.mjs';

const files = ['model', 'registry', 'upload', 'native', 'date-controls', 'time-controls', 'vue-controls',
  'extended-controls', 'date-range-controls', 'tree-select-controls', 'slider-controls', 'rate-controls']
  .map(name => `src/content/controls/${name}.js`);
const families = [['element', 'el-rate'], ['plus', 'elplus-rate'], ['ant', 'antdv1-rate'], ['aria', 'aria-rate']];

async function write(zoo, value, operation = 'set') {
  return zoo.execute(async ({ value, operation }) => {
    const el = window.__zooRate.root(), adapter = ResumeControls.resolve(el);
    const plan = ResumeControls.plan(el, { value, operation });
    if (!adapter) return { plan, inspect: ResumeControls.inspect(el) };
    const denied = await adapter.write(el, plan);
    const written = await adapter.write(el, plan, { allowWrite: true, check: async () => {
      if (!el.isConnected || document.visibilityState !== 'visible') throw Error('offline_rate_target_changed');
    } });
    return { plan, denied, written, verified: await ResumeControls.verify(el, plan, { settleMs: 40 }) };
  }, [{ value, operation }], 'MAIN');
}

async function fixture(family, work, testInfo) {
  const zoo = await startZoo(`rate-${family}`);
  try {
    await zoo.inject(files, 'MAIN');
    const result = await work(zoo), reads = await zoo.readback(), evidence = await zoo.evidence();
    expect(reads.model).toMatchObject({ second: 1, disabled: 1, readonly: 1, hidden: 1,
      neighbor: 'ZOO_NEIGHBOR_KEEP', disabledValue: 'ZOO_DISABLED_KEEP' });
    expect(reads.snapshot.effects).toMatchObject({ blacklistClicks: 0, submits: 0 });
    expect(evidence).toMatchObject({ neverSave: true, liveSupportClaimed: false, nonGetObserved: 0,
      nonGetBlocked: 0, responseToNonGet: 0, blacklistClickAttempts: 0, blacklistClicks: 0, guardFailed: false });
    expect(evidence.routing).toMatchObject({ rejected: [], nonGetReachedRoute: 0 });
    expect(zoo.page.url()).toBe(SYNTHETIC);
    for (const file of files) expect(evidence.adapterHashes[file]).toMatch(/^[a-f0-9]{64}$/u);
    await fs.writeFile(testInfo.outputPath('rate-evidence.json'), JSON.stringify({ family, result, reads, evidence,
      execution: 'Exact packaged bytes on disposable loopback; pinned real Vue rates and explicit ARIA rating; offline contract only' }, null, 2));
    await zoo.page.screenshot({ path: testInfo.outputPath('rate-fixture.png'), fullPage: true });
  } finally { await zoo.close(); }
}

for (const [family, adapter] of families) test(`generic ratings ${family}: set, star click, independent readback and effect-free boundaries`, async ({}, testInfo) => {
  await fixture(family, async zoo => {
    const before = await zoo.readback();
    const passive = await zoo.execute(() => ResumeControls.plan(window.__zooRate.root(), { value: 4 }), [], 'MAIN');
    expect(passive).toMatchObject({ adapter, type: 'rate', status: 'planned', liveSupportClaimed: false });
    expect(await zoo.readback()).toEqual(before);
    const operations = [];
    for (const [operation, value] of [['set', 4], ['click', family === 'aria' ? 2 : 2.5], ['set', 0],
      ['set', family === 'aria' ? 1 : 1.5], ['click', 3]]) {
      const result = await write(zoo, value, operation);
      expect(result.plan.status, JSON.stringify(result)).toBe('planned');
      expect(result.denied).toMatchObject({ status: 'unsupported', reason: 'shadow_mode', attempts: 0 });
      expect(result.written.attempts, JSON.stringify(result)).toBeGreaterThan(0);
      expect(result.verified, JSON.stringify(result)).toMatchObject({ status: 'success', modelReadback: value, domReadback: value });
      const reads = await zoo.readback();
      expect(reads.model.target).toBe(value); expect(reads.snapshot.display).toBe(value);
      operations.push(result);
    }
    const repeatedBefore = await zoo.readback(), repeated = await write(zoo, 3, 'click');
    expect(repeated.plan.status).toBe('success');
    expect(repeated.written).toMatchObject({ status: 'success', attempts: 0 });
    expect(await zoo.readback()).toEqual(repeatedBefore);
    expect(repeatedBefore.snapshot.effects.clicks).toBeGreaterThan(0);
    expect(repeatedBefore.snapshot.effects.keys).toBeGreaterThan(0);

    const guarded = await zoo.execute(async () => {
      const el = window.__zooRate.root(), adapter = ResumeControls.resolve(el);
      const invalid = [null, true, {}, [], '4 stars', 6, -1, 2.25].map(value => ResumeControls.plan(el, { value }));
      const boundaries = ['disabled', 'readonly', 'hidden'].map(name => ResumeControls.plan(window.__zooRate.root(name), { value: 4 }));
      boundaries.push(ResumeControls.plan(window.__zooRate.root('second'), { value: 2.5 }));
      const ordinary = document.getElementById('ordinary-slider');
      if (ordinary) boundaries.push(ResumeControls.plan(ordinary, { value: 4 }));
      const plan = ResumeControls.plan(el, { value: 4 });
      const replayed = await adapter.write(el, JSON.parse(JSON.stringify(plan)), { allowWrite: true, check: async () => {} });
      const rejected = await adapter.write(el, plan, { allowWrite: true, check: async () => { throw Error('offline_rate_guard'); } })
        .catch(error => ({ reason: error.message }));
      return { invalid, boundaries, replayed, rejected };
    }, [], 'MAIN');
    expect(guarded.invalid.map(plan => [plan.status, plan.reason])).toEqual([
      ...Array.from({ length: 5 }, () => ['manual', 'invalid_rate_value']),
      ['manual', 'rate_out_of_range'], ['manual', 'rate_out_of_range'], ['manual', 'rate_step_mismatch'],
    ]);
    expect(guarded.boundaries.map(plan => [plan.status, plan.reason])).toEqual([
      ['manual', 'disabled'], ['manual', 'readonly'], ['manual', 'rate_not_interactable'], ['manual', 'rate_step_mismatch'],
      ...(family === 'aria' ? [['manual', 'control_or_version_unconfirmed']] : []),
    ]);
    expect(guarded.replayed).toMatchObject({ status: 'unsupported', reason: 'control_target_changed', attempts: 0 });
    expect(guarded.rejected.reason).toBe('offline_rate_guard');
    expect(await zoo.readback()).toEqual(repeatedBefore);

    const readback = await zoo.execute(async () => {
      const { root, family, setValue, tick } = window.__zooRate, el = root();
      const plan = ResumeControls.plan(el, { value: 3 });
      const restore = [];
      if (family === 'ant') {
        for (const [index, star] of [...el.querySelectorAll('.ant-rate-star')].entries()) {
          restore.push([star, 'class', star.getAttribute('class')]);
          star.className = `ant-rate-star ant-rate-star-${index < 4 ? 'full' : 'zero'}`;
          const radio = star.querySelector('[role="radio"]');
          restore.push([radio, 'aria-checked', radio.getAttribute('aria-checked')]); radio.setAttribute('aria-checked', String(index < 4));
        }
      } else {
        const attribute = family === 'aria' ? 'aria-valuetext' : 'aria-valuenow';
        restore.push([el, attribute, el.getAttribute(attribute)]);
        el.setAttribute(attribute, family === 'aria' ? '4 of 5 stars' : '4');
      }
      const mismatch = await ResumeControls.verify(el, plan, { settleMs: 0 });
      for (const [node, attribute, value] of restore) node.setAttribute(attribute, value);
      setTimeout(() => { setValue(1); }, 10);
      const reverted = await ResumeControls.verify(el, plan, { settleMs: 80 });
      await tick();
      return { mismatch, reverted };
    }, [], 'MAIN');
    expect(readback.mismatch, JSON.stringify(readback)).toMatchObject({ status: 'mismatch', modelReadback: 3, domReadback: 4 });
    expect(readback.reverted, JSON.stringify(readback)).toMatchObject({ status: 'reverted', modelReadback: 1, domReadback: 1 });
    expect((await zoo.readback()).model.target).toBe(1);
    return { passive, operations, repeated, guarded, readback };
  }, testInfo);
});
