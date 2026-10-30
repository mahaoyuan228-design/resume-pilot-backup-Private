import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { startZoo, SYNTHETIC } from './support.mjs';

const files = ['model', 'registry', 'upload', 'native', 'date-controls', 'time-controls', 'vue-controls',
  'extended-controls', 'date-range-controls', 'tree-select-controls', 'slider-controls', 'rate-controls', 'transfer-controls']
  .map(name => `src/content/controls/${name}.js`);
const families = [['element', 'el-transfer'], ['ant', 'ant-transfer']];
const sorted = values => [...values].sort();

async function write(zoo, value, operation = 'set') {
  return zoo.execute(async ({ value, operation }) => {
    const el = window.__zooTransfer.root(), adapter = ResumeControls.resolve(el);
    const plan = ResumeControls.plan(el, { value, operation });
    window.__zooTransferPlan = plan;
    if (!adapter) return { plan, inspect: ResumeControls.inspect(el) };
    const denied = await adapter.write(el, plan);
    const written = await adapter.write(el, plan, { allowWrite: true, check: async () => {
      if (!el.isConnected || document.visibilityState !== 'visible') throw Error('offline_transfer_target_changed');
    } });
    return { plan, denied, written, verified: await ResumeControls.verify(el, plan, { settleMs: 40 }) };
  }, [{ value, operation }], 'MAIN');
}

async function fixture(family, work, testInfo) {
  const zoo = await startZoo(`transfer-${family}`);
  try {
    await zoo.inject(files, 'MAIN');
    const result = await work(zoo), reads = await zoo.readback(), evidence = await zoo.evidence();
    expect(reads.model).toMatchObject({ second: ['keep'], disabled: ['keep'], readonly: ['keep'], hidden: ['keep'],
      neighbor: 'ZOO_NEIGHBOR_KEEP', disabledValue: 'ZOO_DISABLED_KEEP' });
    expect(reads.snapshot.effects).toMatchObject({ blacklistClicks: 0, submits: 0 });
    expect(evidence).toMatchObject({ neverSave: true, liveSupportClaimed: false, nonGetObserved: 0,
      nonGetBlocked: 0, responseToNonGet: 0, blacklistClickAttempts: 0, blacklistClicks: 0, guardFailed: false });
    expect(evidence.routing).toMatchObject({ rejected: [], nonGetReachedRoute: 0 });
    expect(zoo.page.url()).toBe(SYNTHETIC);
    for (const file of files) expect(evidence.adapterHashes[file]).toMatch(/^[a-f0-9]{64}$/u);
    await fs.writeFile(testInfo.outputPath('transfer-evidence.json'), JSON.stringify({ family, result, reads, evidence,
      execution: 'Exact packaged bytes on disposable loopback; pinned real transfers; offline contract only' }, null, 2));
    await zoo.page.screenshot({ path: testInfo.outputPath('transfer-fixture.png'), fullPage: true });
  } finally { await zoo.close(); }
}

for (const [family, adapter] of families) {
  test(`generic transfers ${family}: exact target, both directions, independent readback and idempotence`, async ({}, testInfo) => {
    await fixture(family, async zoo => {
      const before = await zoo.readback();
      const passive = await zoo.execute(() => ResumeControls.plan(window.__zooTransfer.root(), { value: ['Alpha', 'Beta'] }), [], 'MAIN');
      expect(passive).toMatchObject({ adapter, type: 'transfer', status: 'planned', liveSupportClaimed: false });
      expect(await zoo.readback()).toEqual(before);
      const operations = [];
      for (const [operation, value, codes, labels] of [
        ['set', ['Alpha', 'Beta'], ['a', 'b'], ['Alpha', 'Beta']],
        ['add', ['Keep'], ['a', 'b', 'keep'], ['Alpha', 'Beta', 'Keep']],
        ['remove', ['Alpha'], ['b', 'keep'], ['Beta', 'Keep']],
        ['set', [], [], []], ['add', ['Alpha'], ['a'], ['Alpha']],
      ]) {
        const result = await write(zoo, value, operation);
        expect(result.plan.status, JSON.stringify(result)).toBe('planned');
        expect(result.denied).toMatchObject({ status: 'unsupported', reason: 'shadow_mode', attempts: 0 });
        expect(result.written.strategy, JSON.stringify(result)).toBe('ui');
        expect(result.verified.status, JSON.stringify(result)).toBe('success');
        expect(sorted(result.verified.modelReadback)).toEqual(sorted(codes));
        expect(sorted(result.verified.domReadback)).toEqual(sorted(labels));
        const reads = await zoo.readback();
        expect(sorted(reads.model.target)).toEqual(sorted(codes));
        expect(sorted(reads.snapshot.display)).toEqual(sorted(labels));
        operations.push(result);
      }
      const repeatedBefore = await zoo.readback(), repeated = await write(zoo, ['Alpha']);
      expect(repeated.plan.status).toBe('success');
      expect(repeated.written).toMatchObject({ status: 'success', attempts: 0 });
      expect(await zoo.readback()).toEqual(repeatedBefore);
      expect(repeatedBefore.snapshot.effects.moveClicks).toBeGreaterThanOrEqual(6);
      expect(repeatedBefore.snapshot.effects.rowClicks).toBeGreaterThan(0);
      return { passive, operations, repeated };
    }, testInfo);
  });

  test(`generic transfers ${family}: blocked values, guarded writes and replayed targets have no effects`, async ({}, testInfo) => {
    await fixture(family, async zoo => {
      const before = await zoo.readback();
      const result = await zoo.execute(async () => {
        const { root } = window.__zooTransfer, el = root(), adapter = ResumeControls.resolve(el);
        const invalid = ['Missing', 'Twin', 'Blocked', null, {}, true].map(value => ResumeControls.plan(el, { value: Array.isArray(value) ? value : [value] }));
        invalid.push(ResumeControls.plan(el, { value: ['Alpha'], operation: 'submit' }));
        const boundaries = ['disabled', 'readonly', 'hidden'].map(name => ResumeControls.plan(root(name), { value: ['Alpha'] }));
        const plan = ResumeControls.plan(el, { value: ['Alpha'] });
        const context = { allowWrite: true, check: async () => {} };
        const bound = [];
        for (const [target, instruction] of [[root('second'), plan], [el, JSON.parse(JSON.stringify(plan))]]) bound.push({
          written: await adapter.write(target, instruction, context), verified: await adapter.verify(target, instruction, { settleMs: 0 }),
        });
        const guarded = await adapter.write(el, plan, { allowWrite: true, check: async () => { throw Error('offline_transfer_guard'); } })
          .catch(error => ({ reason: error.message }));
        return { invalid, boundaries, bound, guarded };
      }, [], 'MAIN');
      for (const plan of [...result.invalid, ...result.boundaries]) expect(['planned', 'success'], JSON.stringify(plan)).not.toContain(plan.status);
      for (const row of result.bound) {
        expect(row.written).toMatchObject({ status: 'unsupported', attempts: 0 });
        expect(row.verified.status).toBe('unsupported');
      }
      expect(result.guarded.reason).toBe('offline_transfer_guard');
      expect(await zoo.readback()).toEqual(before);
      return result;
    }, testInfo);
  });

  test(`generic transfers ${family}: painted labels and delayed model reversion fail readback`, async ({}, testInfo) => {
    await fixture(family, async zoo => {
      const result = await write(zoo, ['Alpha', 'Beta']);
      expect(result.verified.status, JSON.stringify(result)).toBe('success');
      const readback = await zoo.execute(async () => {
        const { root, panels, labelSelector, owner, family } = window.__zooTransfer, el = root(), plan = window.__zooTransferPlan;
        const row = panels()[1].querySelector(family === 'ant' ? '.ant-transfer-list-content-item' : '.el-transfer-panel__item');
        const label = row.querySelector(labelSelector), previous = label.textContent;
        label.textContent = 'Painted wrong';
        const mismatch = await ResumeControls.verify(el, plan, { settleMs: 0 });
        label.textContent = previous;
        setTimeout(() => { owner.value = ['keep']; }, 10);
        const reverted = await ResumeControls.verify(el, plan, { settleMs: 80 });
        return { mismatch, reverted };
      }, [], 'MAIN');
      expect(readback.mismatch.status, JSON.stringify(readback)).toBe('mismatch');
      expect(readback.reverted.status, JSON.stringify(readback)).toBe('reverted');
      expect((await zoo.readback()).model.target).toEqual(['keep']);
      return { result, readback };
    }, testInfo);
  });
}
