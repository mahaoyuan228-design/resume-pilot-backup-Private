import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { startZoo, SYNTHETIC } from './support.mjs';

const files = ['model', 'registry', 'upload', 'native', 'date-controls', 'vue-controls', 'extended-controls']
  .map(name => `src/content/controls/${name}.js`);

async function fixture(name, work, testInfo) {
  const zoo = await startZoo(name);
  try {
    await zoo.inject(files, 'MAIN');
    const result = await work(zoo);
    const reads = await zoo.readback(), evidence = await zoo.evidence();
    expect(reads.model.neighbor).toBe('ZOO_NEIGHBOR_KEEP');
    expect(reads.model.disabledValue).toBe('ZOO_DISABLED_KEEP');
    expect(reads.snapshot.effects).toMatchObject({ blacklistClicks: 0, pickerCalls: 0, submits: 0 });
    expect(evidence).toMatchObject({ neverSave: true, liveSupportClaimed: false,
      nonGetObserved: 0, nonGetBlocked: 0, responseToNonGet: 0,
      blacklistClickAttempts: 0, blacklistClicks: 0, guardFailed: false });
    expect(evidence.routing).toMatchObject({ rejected: [], nonGetReachedRoute: 0 });
    expect(zoo.page.url()).toBe(SYNTHETIC);
    for (const file of files) expect(evidence.adapterHashes[file]).toMatch(/^[a-f0-9]{64}$/u);
    await fs.writeFile(testInfo.outputPath('dates-evidence.json'), JSON.stringify({ result, reads, evidence,
      execution: 'Exact built bytes in loopback MAIN; native and first-party My97 replay plus pinned Ant Vue; no live compatibility claim' }, null, 2));
    await zoo.page.screenshot({ path: testInfo.outputPath('dates-fixture.png'), fullPage: true });
  } finally { await zoo.close(); }
}

async function write(zoo, selector, value) {
  return zoo.execute(async ({ selector, value }) => {
    const el = document.querySelector(selector), instruction = ResumeControls.plan(el, { value });
    const adapter = ResumeControls.resolve(el);
    const written = await adapter.write(el, instruction, { allowWrite: true, check: async () => {
      if (!el.isConnected || document.visibilityState !== 'visible') throw Error('offline_date_target_changed');
    } });
    return { instruction, written, verified: await ResumeControls.verify(el, instruction) };
  }, [{ selector, value }], 'MAIN');
}

test('generic dates: native detect/plan and default writer gate leave the page unchanged', async ({}, testInfo) => {
  await fixture('dates-native', async zoo => {
    const before = await zoo.readback();
    const result = await zoo.execute(async () => {
      const rows = [];
      for (const [id, value] of [['target', '2024-02-29'], ['month', '2024-02']]) {
        const el = document.getElementById(id), plan = ResumeControls.plan(el, { value });
        rows.push({ plan, written: await ResumeControls.resolve(el).write(el, plan) });
      }
      return rows;
    }, [], 'MAIN');
    expect(result.map(row => row.plan.adapter)).toEqual(['native-date', 'native-month']);
    for (const row of result) {
      expect(row.plan.status).toBe('planned');
      expect(row.written).toMatchObject({ status: 'unsupported', reason: 'shadow_mode', attempts: 0 });
    }
    expect(await zoo.readback()).toEqual(before);
    return result;
  }, testInfo);
});

test('generic dates: native date/month writes preserve precision and reject calendar or constraint violations', async ({}, testInfo) => {
  await fixture('dates-native', async zoo => {
    const rejected = await zoo.execute(() => {
      const facts = [['target', '2024-02'], ['target', '2023-02-29'], ['month', '2024-02-01'],
        ['limits', '2024-03-01'], ['limits', '2024-02-02'], ['month-limits', '2024-02'],
        ['readonly', '2024-02-29'], ['disabled', '2024-02-29'], ['existing', '2024-02-29']];
      return facts.map(([id, value]) => ResumeControls.plan(document.getElementById(id), { value }));
    }, [], 'MAIN');
    for (const plan of rejected) expect(['planned', 'success']).not.toContain(plan.status);
    const date = await write(zoo, '#target', '2024-02-29'), month = await write(zoo, '#month', '2024-02');
    expect(date.verified.status, JSON.stringify(date)).toBe('success');
    expect(month.verified.status, JSON.stringify(month)).toBe('success');
    expect((await zoo.readback()).model).toMatchObject({ target: '2024-02-29', month: '2024-02', existing: '2023-01-01' });
    return { rejected, date, month };
  }, testInfo);
});

test('generic dates: My97 literal date/datetime plans are passive and editable-input writes read back exactly', async ({}, testInfo) => {
  await fixture('dates-my97', async zoo => {
    const before = await zoo.readback();
    const shadow = await zoo.execute(() => ['target', 'datetime'].map(id => {
      const el = document.getElementById(id);
      return { observation: ResumeDateControls.inspect(el), plan: ResumeControls.plan(el,
        { value: id === 'target' ? '2024-02-29' : '2024-02-29T14:30:45' }) };
    }), [], 'MAIN');
    expect(shadow.map(row => row.plan.adapter)).toEqual(['my97-date', 'my97-datetime']);
    expect(shadow.every(row => row.plan.status === 'planned')).toBe(true);
    expect(await zoo.readback()).toEqual(before);
    const rejected = await zoo.execute(() => [
      ['target', '2024-02'], ['target', '2023-02-29'], ['datetime', '2024-02-29'],
      ['datetime', '2024-02-29T24:00:00'], ['existing', '2024-02-29'],
    ].map(([id, value]) => ResumeControls.plan(document.getElementById(id), { value })), [], 'MAIN');
    for (const plan of rejected) expect(['planned', 'success']).not.toContain(plan.status);
    const date = await write(zoo, '#target', '2024-02-29');
    const datetime = await write(zoo, '#datetime', '2024-02-29T14:30:45');
    expect(date.verified.status, JSON.stringify(date)).toBe('success');
    expect(datetime.verified.status, JSON.stringify(datetime)).toBe('success');
    expect((await zoo.readback()).model).toMatchObject({ target: '2024-02-29', datetime: '2024-02-29 14:30:45', existing: '2023-01-01' });
    return { shadow, rejected, date, datetime };
  }, testInfo);
});

test('generic dates: readonly, unknown formats, dynamic/callback/cross-target My97 remain manual without effects', async ({}, testInfo) => {
  await fixture('dates-my97-manual', async zoo => {
    const before = await zoo.readback();
    const result = await zoo.execute(() => ['readonly', 'disabled', 'format', 'dynamic', 'callback',
      'cross-target', 'constraint', 'unknown', 'custom'].map(id => ({ id,
      plan: ResumeControls.plan(document.getElementById(id), { value: '2024-02-29' }) })), [], 'MAIN');
    for (const row of result) expect(row.plan.status, JSON.stringify(row)).toBe('manual');
    expect(await zoo.readback()).toEqual(before);
    return result;
  }, testInfo);
});

for (const mode of ['default', 'explicit']) {
  test(`generic dates: Ant Vue month ${mode} proves DOM/model agreement and detects mismatch/reversion`, async ({}, testInfo) => {
    await fixture(`dates-ant-${mode}`, async zoo => {
      const before = await zoo.readback();
      const plan = await zoo.execute(() => ResumeControls.plan(document.querySelector('#target input'), { value: '2024-02' }), [], 'MAIN');
      expect(plan).toMatchObject({ adapter: 'antdv1-month', status: 'planned' });
      expect(await zoo.readback()).toEqual(before);
      const result = await write(zoo, '#target input', '2024-02');
      expect(result.verified.status, JSON.stringify(result)).toBe('success');
      expect(result.written.strategy, JSON.stringify(result)).toBe('ui');
      expect((await zoo.readback()).model).toMatchObject({ target: '2024-02', momentBacked: mode === 'default' });
      const precision = await zoo.execute(() => ResumeControls.plan(document.querySelector('#target input'), { value: '2024-02-29' }), [], 'MAIN');
      expect(['planned', 'success']).not.toContain(precision.status);
      const mismatch = await zoo.execute(async instruction => {
        const el = document.querySelector('#target input');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '2040-12');
        return ResumeControls.verify(el, instruction, { settleMs: 0 });
      }, [result.instruction], 'MAIN');
      expect(mismatch.status, JSON.stringify(mismatch)).toBe('mismatch');
      expect((await zoo.readback()).model.target).toBe('2024-02');
      const reverted = await zoo.execute(async instruction => {
        const el = document.querySelector('#target input'), setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, '2024-02'); setTimeout(() => setter.call(el, ''), 20);
        return ResumeControls.verify(el, instruction, { settleMs: 80 });
      }, [result.instruction], 'MAIN');
      expect(reverted.status, JSON.stringify(reverted)).toBe('reverted');
      return { plan, result, precision, mismatch, reverted };
    }, testInfo);
  });
}

test('generic dates: Ant custom display format stays manual without opening a calendar', async ({}, testInfo) => {
  await fixture('dates-ant-format', async zoo => {
    const before = await zoo.readback();
    const result = await zoo.execute(() => ResumeControls.plan(document.querySelector('#target input'), { value: '2024-02' }), [], 'MAIN');
    expect(result.status).toBe('manual');
    expect(await zoo.readback()).toEqual(before);
    return result;
  }, testInfo);
});
