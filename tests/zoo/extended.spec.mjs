import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { startZoo } from './support.mjs';

const adapters = ['ivu-select', 'ivu-date', 'ud-select', 'ud-date', 'ud-cascader', 'phoenix-select', 'phoenix-cascader', 'phoenix-date'];
for (const adapter of adapters) {
  test(`packaged ${adapter}: shadow, guarded write, dual readback and preservation`, async ({}, testInfo) => {
    const zoo = await startZoo(`extended-${adapter}`);
    try {
      const value = adapter.endsWith('cascader') ? ['中国', '北京'] : adapter.endsWith('date') ? '2023-01-02' : '本科';
      const before = await zoo.readback();
      const shadow = await zoo.shadow([{ selector: '#extended-control', field: adapter, fact: { value } }]);
      expect(shadow.plans[0], JSON.stringify(shadow)).toMatchObject({ adapter, status: 'planned' });
      expect(await zoo.readback()).toEqual(before);
      const outcome = await zoo.execute(async instruction => {
        const el = document.querySelector('#extended-control'), selected = ResumeControls.resolve(el);
        const denied = await selected.write(el, instruction);
        const written = await selected.write(el, instruction, { allowWrite: true, check: async () => {
          if (!el.isConnected || document.visibilityState !== 'visible') throw Error('zoo_effect_denied');
        } });
        const verified = await selected.verify(el, instruction);
        return { denied, written, verified };
      }, [shadow.plans[0]], 'MAIN');
      expect(outcome.denied).toMatchObject({ status: 'unsupported', reason: 'shadow_mode', attempts: 0 });
      expect(outcome.written.strategy, JSON.stringify(outcome)).toBe('ui');
      expect(outcome.verified.status, JSON.stringify(outcome)).toBe('success');
      const after = await zoo.readback();
      expect(after.model.value).toEqual(shadow.plans[0].modelValue);
      expect(after.model.neighbor).toBe(before.model.neighbor);
      expect(await zoo.page.locator('#neighbor').inputValue()).toBe('ZOO_NEIGHBOR_KEEP');
      expect(await zoo.page.locator('#disabled-neighbor').inputValue()).toBe('ZOO_DISABLED_KEEP');
      const preserved = await zoo.shadow([{ selector: '#extended-control', fact: { value: adapter.endsWith('cascader') ? ['未知'] : adapter.endsWith('date') ? '2024-01-02' : '原有值' } }]);
      expect(preserved.plans[0].status).toBe('unsupported');
      expect(await zoo.readback()).toEqual(after);
      // One-sided visible changes must fail even when the component model holds.
      const fourState = await zoo.execute(async instruction => {
        const el = document.querySelector('#extended-control');
        const input = el.querySelector('input:not([type="hidden"])');
        if (!input) return { checked: false };
        const original = input.value;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'VISIBLE_MISMATCH');
        const mismatch = await ResumeControls.verify(el, instruction, { settleMs: 0 });
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, original);
        const restored = await ResumeControls.verify(el, instruction, { settleMs: 0 });
        setTimeout(() => Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ''), 10);
        const reverted = await ResumeControls.verify(el, instruction, { settleMs: 40 });
        return { checked: true, mismatch, restored, reverted };
      }, [shadow.plans[0]], 'MAIN');
      if (fourState.checked) {
        expect(fourState.mismatch.status).toBe('mismatch');
        expect(fourState.restored.status).toBe('success');
        expect(fourState.reverted.status).toBe('reverted');
      }
      const evidence = await zoo.evidence();
      expect(evidence).toMatchObject({ nonGetObserved: 0, responseToNonGet: 0, nonGetBlocked: 0,
        blacklistClickAttempts: 0, blacklistClicks: 0, guardFailed: false, liveSupportClaimed: false });
      expect(evidence.routing.rejected).toEqual([]);
      expect(evidence.routing.nonGetReachedRoute).toBe(0);
      await fs.writeFile(testInfo.outputPath('adapter-evidence.json'), JSON.stringify({ adapter, shadow, outcome, preserved, fourState, evidence,
        fixture: adapter.startsWith('ivu') ? 'actual iview@3.5.4' : 'synthetic fixture-contract-1; real version pending samples' }, null, 2));
      await zoo.page.screenshot({ path: testInfo.outputPath('fixture.png'), fullPage: true });
    } finally { await zoo.close(); }
  });
}
