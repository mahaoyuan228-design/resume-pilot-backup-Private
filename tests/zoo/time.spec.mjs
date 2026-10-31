import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { startZoo, SYNTHETIC } from './support.mjs';

const files = ['model', 'registry', 'upload', 'native', 'date-controls', 'time-controls', 'vue-controls', 'extended-controls']
  .map(name => `src/content/controls/${name}.js`);
const target = '#target input,input#target';

async function fixture(name, work, testInfo) {
  const zoo = await startZoo(name);
  try {
    await zoo.inject(files, 'MAIN');
    const result = await work(zoo), reads = await zoo.readback(), evidence = await zoo.evidence();
    expect(reads.model).toMatchObject({ neighbor: 'ZOO_NEIGHBOR_KEEP', disabledValue: 'ZOO_DISABLED_KEEP' });
    expect(reads.snapshot.effects).toMatchObject({ blacklistClicks: 0, submits: 0 });
    expect(evidence).toMatchObject({ neverSave: true, liveSupportClaimed: false,
      nonGetObserved: 0, nonGetBlocked: 0, responseToNonGet: 0,
      blacklistClickAttempts: 0, blacklistClicks: 0, guardFailed: false });
    expect(evidence.routing).toMatchObject({ rejected: [], nonGetReachedRoute: 0 });
    expect(zoo.page.url()).toBe(SYNTHETIC);
    for (const file of files) expect(evidence.adapterHashes[file]).toMatch(/^[a-f0-9]{64}$/u);
    await fs.writeFile(testInfo.outputPath(`${name}-evidence.json`), JSON.stringify({ result, reads, evidence,
      execution: 'Exact built bytes in loopback MAIN; pinned Vue components; offline contract only' }, null, 2));
    await zoo.page.screenshot({ path: testInfo.outputPath(`${name}-fixture.png`), fullPage: true });
  } finally { await zoo.close(); }
}

async function write(zoo, selector, value) {
  return zoo.execute(async ({ selector, value }) => {
    const el = document.querySelector(selector), instruction = ResumeControls.plan(el, { value });
    // Plans retain their MAIN-world owner binding; serialization is evidence only.
    globalThis.__zooTimeInstruction = instruction;
    const written = await ResumeControls.resolve(el).write(el, instruction, { allowWrite: true, check: async () => {
      if (!el.isConnected || document.visibilityState !== 'visible') throw Error('offline_time_target_changed');
    } });
    return { instruction, written, verified: await ResumeControls.verify(el, instruction) };
  }, [{ selector, value }], 'MAIN');
}

test('generic time: passive native planning and default writer gate have zero effects', async ({}, testInfo) => {
  await fixture('time-native', async zoo => {
    const before = await zoo.readback();
    const result = await zoo.execute(async () => {
      const el = document.querySelector('#target'), plan = ResumeControls.plan(el, { value: '14:30' });
      return { plan, written: await ResumeControls.resolve(el).write(el, plan) };
    }, [], 'MAIN');
    expect(result.plan).toMatchObject({ adapter: 'native-time', status: 'planned', liveSupportClaimed: false });
    expect(result.written).toMatchObject({ status: 'unsupported', reason: 'shadow_mode', attempts: 0 });
    expect(await zoo.readback()).toEqual(before);
    return result;
  }, testInfo);
});

test('generic time: native minute/second writes read back and preserve constraints and existing values', async ({}, testInfo) => {
  await fixture('time-native', async zoo => {
    const rejected = await zoo.execute(() => [
      ['target', '24:00'], ['target', '14:60'], ['target', '2:30'], ['target', '14:30Z'],
      ['limits', '18:00'], ['limits', '09:10'], ['readonly', '14:30'], ['disabled', '14:30'], ['existing', '14:30'],
    ].map(([id, value]) => ResumeControls.plan(document.getElementById(id), { value })), [], 'MAIN');
    for (const plan of rejected) expect(['planned', 'success']).not.toContain(plan.status);
    const minute = await write(zoo, '#target', '14:30'), second = await write(zoo, '#seconds', '14:30:45');
    expect(minute.verified.status, JSON.stringify(minute)).toBe('success');
    expect(second.verified.status, JSON.stringify(second)).toBe('success');
    expect((await zoo.readback()).model).toMatchObject({ target: '14:30', seconds: '14:30:45', existing: '08:15' });
    return { rejected, minute, second };
  }, testInfo);
});

for (const lib of ['ant', 'el']) for (const mode of ['default', 'explicit']) {
  test(`generic time: ${lib} ${mode} hour/minute panel clicks prove public model and detect mismatch/reversion`, async ({}, testInfo) => {
    await fixture(`time-${lib}-${mode}`, async zoo => {
      const before = await zoo.readback();
      const plan = await zoo.execute(selector => ResumeControls.plan(document.querySelector(selector), { value: '14:30' }), [target], 'MAIN');
      expect(plan).toMatchObject({ adapter: lib === 'ant' ? 'antdv1-time' : 'el-time', status: 'planned', liveSupportClaimed: false });
      expect(await zoo.readback()).toEqual(before);
      const result = await write(zoo, target, '14:30');
      expect(result.verified.status, JSON.stringify(result)).toBe('success');
      expect(result.written.strategy, JSON.stringify(result)).toBe('ui');
      const after = await zoo.readback();
      expect(after.model).toMatchObject({ target: '14:30', modelKind: mode === 'explicit' ? 'string' : lib === 'ant' ? 'moment' : 'date' });
      expect(after.snapshot.effects.panelClicks).toBeGreaterThanOrEqual(2);
      expect(after.snapshot.panels).toBe(0);
      const mismatch = await zoo.execute(async selector => {
        const el = document.querySelector(selector);
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '15:45');
        return ResumeControls.verify(el, globalThis.__zooTimeInstruction, { settleMs: 0 });
      }, [target], 'MAIN');
      expect(mismatch.status, JSON.stringify(mismatch)).toBe('mismatch');
      expect((await zoo.readback()).model.target).toBe('14:30');
      const reverted = await zoo.execute(async selector => {
        const el = document.querySelector(selector), setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, '14:30'); setTimeout(() => setter.call(el, ''), 20);
        return ResumeControls.verify(el, globalThis.__zooTimeInstruction, { settleMs: 80 });
      }, [target], 'MAIN');
      expect(reverted.status, JSON.stringify(reverted)).toBe('reverted');
      return { plan, result, mismatch, reverted };
    }, testInfo);
  });
}

test('generic time: unknown picker and 12-hour display contracts stay manual without opening panels', async ({}, testInfo) => {
  for (const name of ['time-unknown', 'time-ant-format', 'time-el-format']) {
    await fixture(name, async zoo => {
      const before = await zoo.readback();
      const result = await zoo.execute(selector => ResumeControls.plan(document.querySelector(selector), { value: '14:30' }), [target], 'MAIN');
      expect(result.status, JSON.stringify(result)).toBe('manual');
      expect(await zoo.readback()).toEqual(before);
      return result;
    }, testInfo);
  }
});
