import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { startZoo, SYNTHETIC } from './support.mjs';

const files = ['model', 'registry', 'upload', 'native', 'date-controls', 'time-controls', 'vue-controls', 'extended-controls', 'date-range-controls', 'tree-select-controls']
  .map(name => `src/content/controls/${name}.js`);
const path = ['Root', 'Branch', 'Leaf'];
const families = [['ant', 'antdv1-tree-select'], ['plus', 'el-tree-select'], ['search', 'el-search-tree-select']];

async function fixture(family, work, testInfo) {
  const zoo = await startZoo(`tree-select-${family}`);
  try {
    await zoo.inject(files, 'MAIN');
    const result = await work(zoo), reads = await zoo.readback(), evidence = await zoo.evidence();
    expect(reads.model).toMatchObject({ second: null, neighbor: 'ZOO_NEIGHBOR_KEEP', disabledValue: 'ZOO_DISABLED_KEEP' });
    expect(reads.snapshot.effects).toMatchObject({ blacklistClicks: 0, submits: 0 });
    expect(evidence).toMatchObject({ neverSave: true, liveSupportClaimed: false, nonGetObserved: 0,
      nonGetBlocked: 0, responseToNonGet: 0, blacklistClickAttempts: 0, blacklistClicks: 0, guardFailed: false });
    expect(evidence.routing).toMatchObject({ rejected: [], nonGetReachedRoute: 0 });
    expect(zoo.page.url()).toBe(SYNTHETIC);
    for (const file of files) expect(evidence.adapterHashes[file]).toMatch(/^[a-f0-9]{64}$/u);
    await fs.writeFile(testInfo.outputPath('tree-select-evidence.json'), JSON.stringify({ result, reads, evidence,
      execution: 'Exact packaged bytes in disposable loopback MAIN; real pinned tree components; offline contract only' }, null, 2));
    await zoo.page.screenshot({ path: testInfo.outputPath('tree-select-fixture.png'), fullPage: true });
  } finally { await zoo.close(); }
}

async function write(zoo, value = path) {
  return zoo.execute(async value => {
    const el = window.__zooTree.root(), plan = ResumeControls.plan(el, { value });
    window.__zooTreePlan = plan;
    const written = await ResumeControls.resolve(el).write(el, plan, { allowWrite: true, check: async () => {
      if (!el.isConnected || document.visibilityState !== 'visible') throw Error('offline_tree_target_changed');
    } });
    return { plan, written, verified: await ResumeControls.verify(el, plan, { settleMs: 30 }) };
  }, [value], 'MAIN');
}

for (const [family, adapter] of families) {
  test(`generic tree select: ${family} plans passively, clicks owned nodes and reads scalar code plus label`, async ({}, testInfo) => {
    await fixture(family, async zoo => {
      const before = await zoo.readback();
      const passive = await zoo.execute(async value => {
        const el = window.__zooTree.root(), plan = ResumeControls.plan(el, { value });
        const adapter = ResumeControls.resolve(el);
        return { plan, denied: await adapter.write(el, plan),
          guarded: await adapter.write(el, plan, { allowWrite: true, check: async () => { throw Error('offline_guard'); } })
            .catch(error => ({ reason: error.message })) };
      }, [path], 'MAIN');
      expect(passive.plan).toMatchObject({ adapter, type: 'tree-select', status: 'planned', value: 30, domValue: 'Leaf', liveSupportClaimed: false });
      expect(passive.denied).toMatchObject({ status: 'unsupported', reason: 'shadow_mode', attempts: 0 });
      expect(passive.guarded.reason).toBe('offline_guard');
      expect(await zoo.readback()).toEqual(before);
      const result = await write(zoo);
      expect(result.written.strategy, JSON.stringify(result)).toBe('ui');
      expect(result.verified, JSON.stringify(result)).toMatchObject({ status: 'success', modelReadback: 30, domReadback: 'Leaf' });
      const reads = await zoo.readback();
      expect(reads.model.target).toBe(30);
      expect(reads.snapshot.display).toBe('Leaf');
      expect(reads.snapshot.effects.nodeClicks).toEqual(['Leaf']);
      expect(reads.snapshot.effects.expansionClicks).toBeGreaterThanOrEqual(2);
      expect(reads.snapshot.panels).toBe(0);
      const repeated = await write(zoo, 'Leaf');
      expect(repeated.plan.status).toBe('success');
      expect(repeated.written).toMatchObject({ status: 'success', attempts: 0 });
      expect((await zoo.readback()).snapshot.effects).toEqual(reads.snapshot.effects);
      return { passive, result, repeated };
    }, testInfo);
  });

  test(`generic tree select: ${family} rejects ambiguous, disabled, multiple and replayed targets before effects`, async ({}, testInfo) => {
    await fixture(family, async zoo => {
      const before = await zoo.readback();
      const result = await zoo.execute(async value => {
        const el = window.__zooTree.root(), sibling = document.querySelector('.sibling.ant-select,.sibling.el-select');
        const adapter = ResumeControls.resolve(el), plan = ResumeControls.plan(el, { value });
        const context = { allowWrite: true, check: async () => {} };
        const rejected = ['Missing', 'Twin', 'Blocked', ['Root', 'Missing'], [], {}, null]
          .map(value => ResumeControls.plan(el, { value }));
        const copied = JSON.parse(JSON.stringify(plan));
        const bound = [];
        for (const [target, instruction] of [[sibling, plan], [el, copied]]) bound.push({
          written: await adapter.write(target, instruction, context),
          verified: await adapter.verify(target, instruction, { settleMs: 0 }),
        });
        window.__zooTree.owner.disabled = true; await window.__zooTree.tick();
        const disabled = ResumeControls.plan(window.__zooTree.root(), { value });
        window.__zooTree.owner.disabled = false; window.__zooTree.owner.multiple = true; await window.__zooTree.tick();
        const multiple = ResumeControls.plan(window.__zooTree.root(), { value });
        window.__zooTree.owner.multiple = false; await window.__zooTree.tick();
        return { rejected, bound, disabled, multiple };
      }, [path], 'MAIN');
      for (const plan of [...result.rejected, result.disabled, result.multiple]) expect(['planned', 'success'], JSON.stringify(plan)).not.toContain(plan.status);
      expect(result.disabled).toMatchObject({ status: 'manual', reason: 'disabled' });
      expect(result.multiple).toMatchObject({ status: 'manual', reason: 'tree_mode_unconfirmed' });
      for (const row of result.bound) {
        expect(row.written).toMatchObject({ status: 'unsupported', attempts: 0 });
        expect(row.verified.status).toBe('unsupported');
      }
      expect((await zoo.readback()).snapshot.effects).toEqual(before.snapshot.effects);
      expect((await zoo.readback()).model).toEqual(before.model);
      return result;
    }, testInfo);
  });

  test(`generic tree select: ${family} independent readbacks reject painted labels and delayed model reversion`, async ({}, testInfo) => {
    await fixture(family, async zoo => {
      const written = await write(zoo);
      expect(written.verified.status, JSON.stringify(written)).toBe('success');
      const result = await zoo.execute(async () => {
        const el = window.__zooTree.root(), plan = window.__zooTreePlan, family = window.__zooTree.family;
        const label = family === 'ant' ? el.querySelector('.ant-select-selection-selected-value')
          : family === 'plus' ? el.querySelector('.el-select__selected-item.el-select__placeholder:not(.is-transparent)') : null;
        const input = label ? null : el.querySelector('input');
        const previous = label ? label.textContent : input.value;
        if (label) label.textContent = 'Painted wrong'; else input.value = 'Painted wrong';
        const mismatch = await ResumeControls.verify(el, plan, { settleMs: 0 });
        if (label) label.textContent = previous; else input.value = previous;
        setTimeout(() => { window.__zooTree.owner.value = 31; }, 10);
        const reverted = await ResumeControls.verify(el, plan, { settleMs: 60 });
        return { mismatch, reverted };
      }, [], 'MAIN');
      expect(result.mismatch.status, JSON.stringify(result)).toBe('mismatch');
      expect(result.reverted.status, JSON.stringify(result)).toBe('reverted');
      expect((await zoo.readback()).model.target).toBe(31);
      return { written, ...result };
    }, testInfo);
  });
}
