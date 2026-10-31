import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { startZoo, SYNTHETIC } from './support.mjs';

const files = ['model', 'registry', 'upload', 'native', 'date-controls', 'time-controls', 'vue-controls', 'extended-controls', 'date-range-controls']
  .map(name => `src/content/controls/${name}.js`);
const value = ['2024-02-10', '2024-02-20'];

async function fixture(name, work, testInfo) {
  const zoo = await startZoo(name);
  try {
    await zoo.inject(files, 'MAIN');
    const result = await work(zoo), reads = await zoo.readback(), evidence = await zoo.evidence();
    expect(reads.model).toMatchObject({ neighbor: 'ZOO_NEIGHBOR_KEEP', disabledValue: 'ZOO_DISABLED_KEEP' });
    expect(reads.snapshot.effects).toMatchObject({ blacklistClicks: 0, submits: 0 });
    expect(reads.snapshot.calendars).toBe(0);
    expect(evidence).toMatchObject({ neverSave: true, liveSupportClaimed: false,
      nonGetObserved: 0, nonGetBlocked: 0, responseToNonGet: 0,
      blacklistClickAttempts: 0, blacklistClicks: 0, guardFailed: false });
    expect(evidence.routing).toMatchObject({ rejected: [], nonGetReachedRoute: 0 });
    expect(zoo.page.url()).toBe(SYNTHETIC);
    for (const file of files) expect(evidence.adapterHashes[file]).toMatch(/^[a-f0-9]{64}$/u);
    await fs.writeFile(testInfo.outputPath(`${name}-evidence.json`), JSON.stringify({ result, reads, evidence,
      execution: 'Exact built bytes in disposable loopback MAIN; pinned Vue libraries; offline contract only' }, null, 2));
    await zoo.page.screenshot({ path: testInfo.outputPath(`${name}-fixture.png`), fullPage: true });
  } finally { await zoo.close(); }
}

async function write(zoo, selector, target = value) {
  return zoo.execute(async ({ selector, target }) => {
    const el = document.querySelector(selector), instruction = ResumeControls.plan(el, { value: target });
    globalThis.__zooRangeInstruction = instruction;
    const written = await ResumeControls.resolve(el).write(el, instruction, { allowWrite: true, check: async () => {
      if (!el.isConnected || document.visibilityState !== 'visible') throw Error('offline_range_target_changed');
    } });
    return { instruction, written, verified: await ResumeControls.verify(el, instruction, { settleMs: 20 }) };
  }, [{ selector, target }], 'MAIN');
}

test('generic date ranges: native pair planning and default writer gate have zero effects', async ({}, testInfo) => {
  await fixture('date-range-native', async zoo => {
    const before = await zoo.readback();
    const result = await zoo.execute(async value => {
      const el = document.querySelector('#target'), instruction = ResumeControls.plan(el, { value });
      return { instruction, written: await ResumeControls.resolve(el).write(el, instruction) };
    }, [value], 'MAIN');
    expect(result.instruction).toMatchObject({ adapter: 'native-date-range', type: 'date-range', status: 'planned', liveSupportClaimed: false });
    expect(result.written).toMatchObject({ status: 'unsupported', reason: 'shadow_mode', attempts: 0 });
    expect(await zoo.readback()).toEqual(before);
    return result;
  }, testInfo);
});

test('generic date ranges: native pairs preserve both endpoints, constraints and existing partial values', async ({}, testInfo) => {
  await fixture('date-range-native', async zoo => {
    const rejected = await zoo.execute(() => [
      ['target', ['2024-02', '2024-03']], ['target', ['2023-02-29', '2024-02-20']],
      ['target', ['2024-02-20', '2024-02-10']], ['target', ['2024-02-10']],
      ['target', '2024-02-10'], ['limits', ['2024-02-02', '2024-02-20']],
      ['limits', ['2024-02-03', '2024-03-01']], ['readonly', ['2024-02-10', '2024-02-20']],
      ['disabled', ['2024-02-10', '2024-02-20']], ['existing', ['2024-02-10', '2024-02-20']],
      ['partial', ['2024-02-11', '2024-02-20']], ['ambiguous', ['2024-02-10', '2024-02-20']],
    ].map(([id, value]) => ResumeControls.plan(document.getElementById(id), { value })), [], 'MAIN');
    for (const plan of rejected) expect(['planned', 'success'], JSON.stringify(plan)).not.toContain(plan.status);
    const result = await write(zoo, '#target'), partial = await write(zoo, '#partial');
    expect(result.verified).toMatchObject({ status: 'success', modelReadback: value, domReadback: value });
    expect(partial.verified.status, JSON.stringify(partial)).toBe('success');
    expect((await zoo.readback()).model.target).toEqual(value);
    const endpoints = await zoo.execute(() => ({ existing: [...document.querySelectorAll('#existing input')].map(el => el.value),
      partial: [...document.querySelectorAll('#partial input')].map(el => el.value) }), [], 'MAIN');
    expect(endpoints).toEqual({ existing: ['2023-01-01', ''], partial: value });
    return { rejected, result, partial, endpoints };
  }, testInfo);
});

for (const [family, adapter, kind] of [['ant', 'antdv1-date-range', 'moment'], ['el', 'el-date-range', 'date']]) {
  for (const mode of ['default', 'explicit']) {
    test(`generic date ranges: ${family} ${mode} RangePicker panel commits and reads both endpoints`, async ({}, testInfo) => {
      await fixture(`date-range-${family}-${mode}`, async zoo => {
        const rangeValue = mode === 'explicit' ? ['2024-02-10', '2024-03-20'] : value;
        const before = await zoo.readback();
        const plan = await zoo.execute(value => ResumeControls.plan(document.querySelector('#target input'), { value }), [rangeValue], 'MAIN');
        expect(plan).toMatchObject({ adapter, type: 'date-range', status: 'planned', value: rangeValue, liveSupportClaimed: false });
        expect(await zoo.readback()).toEqual(before);
        const result = await write(zoo, '#target input', rangeValue);
        expect(result.written.strategy, JSON.stringify(result)).toBe('ui');
        expect(result.verified, JSON.stringify(result)).toMatchObject({ status: 'success', modelReadback: rangeValue, domReadback: rangeValue });
        const reads = await zoo.readback();
        expect(reads.model).toMatchObject({ target: rangeValue, modelKinds: [mode === 'default' ? kind : 'string', mode === 'default' ? kind : 'string'] });
        expect(reads.snapshot.effects.dayClicks).toBe(2);
        if (mode === 'explicit') expect(reads.snapshot.effects.navigationClicks).toBeGreaterThan(0);
        const repeated = await write(zoo, '#target input', rangeValue);
        expect(repeated.instruction.status).toBe('success');
        expect(repeated.written.attempts).toBe(0);
        const readbackChecks = await zoo.execute(async () => {
          const el = document.querySelector('#target input'), end = document.querySelectorAll('#target input')[1];
          const instruction = globalThis.__zooRangeInstruction;
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          setter.call(end, '2040-12-31');
          const mismatch = await ResumeControls.verify(el, instruction, { settleMs: 0 });
          setter.call(end, instruction.domValue[1]);
          setTimeout(() => setter.call(end, ''), 10);
          const reverted = await ResumeControls.verify(el, instruction, { settleMs: 50 });
          setter.call(end, instruction.domValue[1]);
          return { mismatch, reverted, restored: await ResumeControls.verify(el, instruction, { settleMs: 0 }) };
        }, [], 'MAIN');
        expect(readbackChecks.mismatch.status).toBe('mismatch');
        expect(readbackChecks.reverted.status).toBe('reverted');
        expect(readbackChecks.restored.status).toBe('success');
        return { plan, result, repeated, readbackChecks };
      }, testInfo);
    });
  }
}

for (const family of ['el', 'ant']) {
  test(`generic date ranges: two ${family} calendars commit separately and verify as one range`, async ({}, testInfo) => {
    await fixture(`date-range-pair-${family}`, async zoo => {
      const before = await zoo.readback();
      const plan = await zoo.execute(value => ResumeControls.plan(document.querySelector('#target'), { value }), [value], 'MAIN');
      expect(plan).toMatchObject({ adapter: 'date-range-pair', type: 'date-range', status: 'planned', value });
      expect(await zoo.readback()).toEqual(before);
      const result = await write(zoo, '#target');
      expect(result.verified, JSON.stringify(result)).toMatchObject({ status: 'success', modelReadback: value, domReadback: value });
      expect(result.written.strategy, JSON.stringify(result)).toContain('ui');
      const reads = await zoo.readback();
      expect(reads.model.target).toEqual(value);
      expect(reads.snapshot.effects.dayClicks).toBe(2);
      expect(reads.snapshot.effects.navigationClicks).toBeGreaterThan(0);
      return { plan, result };
    }, testInfo);
  });

  test(`generic date ranges: unreviewed ${family} display formats remain manual and passive`, async ({}, testInfo) => {
    await fixture(`date-range-${family}-format`, async zoo => {
      const before = await zoo.readback();
      const result = await zoo.execute(value => ResumeControls.plan(document.querySelector('#target input'), { value }), [value], 'MAIN');
      expect(result.status).toBe('manual');
      expect(await zoo.readback()).toEqual(before);
      return result;
    }, testInfo);
  });
}
