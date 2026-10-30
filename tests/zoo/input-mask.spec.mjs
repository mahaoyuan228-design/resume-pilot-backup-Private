import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { startZoo, SYNTHETIC } from './support.mjs';

const files = ['model', 'registry', 'upload', 'native', 'vue-controls']
  .map(name => `src/content/controls/${name}.js`);
const cases = [
  ['native', 'native-input-mask', '01234567890', '012 3456 7890'],
  ['element', 'el-input-mask', '01234567890', '012 3456 7890'],
  ['ant', 'antdv1-input-mask', '0011223344556677', '0011 2233 4455 6677'],
  ['identity', 'native-input-mask', '11010119900101001x', '110101 19900101 001X'],
];

async function fixture(work, testInfo) {
  // Reuse the existing loopback asset map and real pinned Vue input libraries.
  const zoo = await startZoo('slider-input-mask');
  try {
    await zoo.execute(async () => {
      const section = document.createElement('section');
      section.innerHTML = `<h2>Disposable generic input masks</h2>
        <input id="mask-native" type="tel" data-mask="### #### ####">
        <input id="mask-identity" name="idcard" data-format="###### ######## ###X">
        <input id="mask-unknown" type="tel" data-mask="unsupported-pattern">
        <input id="mask-disabled" type="tel" data-mask="### #### ####" disabled>
        <input id="mask-readonly" type="tel" data-mask="### #### ####" readonly>
        <main id="mask-app"></main>`;
      document.getElementById('slider-form').append(section);
      const raw = {}, nativeModel = { native: '', identity: '' };
      const format = (family, value) => {
        const clean = value.replace(/[\s-]/gu, '').toUpperCase();
        const sizes = family === 'ant' ? [4, 4, 4, 4] : family === 'identity' ? [6, 8, 4] : [3, 4, 4];
        let offset = 0;
        return sizes.map(size => { const part = clean.slice(offset, offset + size); offset += size; return part; }).filter(Boolean).join(' ');
      };
      const owner = new Vue({
        el: '#mask-app', data: () => ({ element: '', ant: '' }),
        methods: { update(family, value) { raw[family] = value; this[family] = format(family, value); } },
        template: `<div>
          <el-input id="mask-element" type="tel" :value="element" @input="update('element', $event)" />
          <a-input id="mask-ant" autocomplete="cc-number" :value="ant" @change="update('ant', $event.target.value)" />
        </div>`,
      });
      await Vue.nextTick();
      const input = family => {
        const root = document.getElementById(`mask-${family}`);
        return root.matches('input') ? root : root.querySelector('input');
      };
      input('element').setAttribute('data-mask', '### #### ####');
      input('ant').setAttribute('data-mask', '0000 0000 0000 0000');
      for (const family of ['native', 'identity']) input(family).addEventListener('input', event => {
        raw[family] = event.target.value;
        nativeModel[family] = format(family, event.target.value);
        event.target.value = nativeModel[family];
      });
      const events = [];
      section.addEventListener('input', event => events.push(event.target.id));
      const previousSnapshot = window.__zoo.snapshot;
      window.__zoo.snapshot = () => ({ ...previousSnapshot(), mask: {
        values: Object.fromEntries(['native', 'element', 'ant', 'identity'].map(family => [family, input(family).value])),
        models: { ...nativeModel, element: owner.element, ant: owner.ant }, raw: { ...raw }, events: events.slice(),
      } });
      window.__maskZoo = { input, owner, raw, events, nativeModel };
    }, [], 'MAIN');
    await zoo.inject(files, 'MAIN');
    const result = await work(zoo), reads = await zoo.readback(), evidence = await zoo.evidence();
    expect(reads.model.neighbor).toBe('ZOO_NEIGHBOR_KEEP');
    expect(reads.snapshot.effects).toMatchObject({ blacklistClicks: 0, submits: 0 });
    expect(evidence).toMatchObject({ neverSave: true, liveSupportClaimed: false, nonGetObserved: 0,
      nonGetBlocked: 0, responseToNonGet: 0, blacklistClickAttempts: 0, blacklistClicks: 0, guardFailed: false });
    expect(evidence.routing).toMatchObject({ rejected: [], nonGetReachedRoute: 0 });
    expect(zoo.page.url()).toBe(SYNTHETIC);
    for (const file of files) expect(evidence.adapterHashes[file]).toMatch(/^[a-f0-9]{64}$/u);
    await fs.writeFile(testInfo.outputPath('input-mask-evidence.json'), JSON.stringify({ result, reads, evidence,
      execution: 'Exact packaged bytes; disposable loopback; native and pinned real Vue inputs with first-party fixture formatters; offline contract only' }, null, 2));
    await zoo.page.screenshot({ path: testInfo.outputPath('input-mask-fixture.png'), fullPage: true });
  } finally { await zoo.close(); }
}

async function write(zoo, family, value) {
  return zoo.execute(async ({ family, value }) => {
    const el = __maskZoo.input(family), adapter = ResumeControls.resolve(el);
    const plan = ResumeControls.plan(el, { value });
    if (!adapter) return { plan };
    const denied = await adapter.write(el, plan);
    const written = await adapter.write(el, plan, { allowWrite: true, check: async () => {
      if (!el.isConnected || document.visibilityState !== 'visible') throw Error('offline_mask_target_changed');
    } });
    return { plan, denied, written, verified: await ResumeControls.verify(el, plan, { settleMs: 30 }) };
  }, [{ family, value }], 'MAIN');
}

test('generic input masks: passive plans, raw writes, formatted readback and equivalent repeated values', async ({}, testInfo) => {
  await fixture(async zoo => {
    const before = await zoo.readback();
    const plans = await zoo.execute(cases => cases.map(([family, , value]) =>
      ResumeControls.plan(__maskZoo.input(family), { value })), [cases], 'MAIN');
    expect(await zoo.readback()).toEqual(before);
    const results = [];
    for (let index = 0; index < cases.length; index++) {
      const [family, adapter, value, formatted] = cases[index];
      expect(plans[index], JSON.stringify(plans)).toMatchObject({ adapter, type: 'input-mask', status: 'planned', liveSupportClaimed: false });
      const result = await write(zoo, family, value);
      expect(result.denied).toMatchObject({ status: 'unsupported', reason: 'shadow_mode', attempts: 0 });
      expect(result.written.attempts, JSON.stringify(result)).toBe(1);
      expect(result.verified, JSON.stringify(result)).toMatchObject({ status: 'success',
        modelReadback: value.toUpperCase(), domReadback: value.toUpperCase() });
      const snapshot = (await zoo.readback()).snapshot.mask;
      expect(snapshot.raw[family]).toBe(value.toUpperCase());
      expect(snapshot.values[family]).toBe(formatted);
      const repeatedBefore = await zoo.readback(), repeated = await write(zoo, family, formatted);
      expect(repeated.plan.status, JSON.stringify(repeated)).toBe('success');
      expect(repeated.written).toMatchObject({ status: 'success', attempts: 0 });
      expect(await zoo.readback()).toEqual(repeatedBefore);
      results.push({ family, result, repeated });
    }
    return { plans, results };
  }, testInfo);
});

test('generic input masks: unknown, disabled, readonly and copied plans stay effect free', async ({}, testInfo) => {
  await fixture(async zoo => {
    const before = await zoo.readback();
    const result = await zoo.execute(async () => {
      const guarded = ['unknown', 'disabled', 'readonly'].map(family =>
        ResumeControls.plan(__maskZoo.input(family), { value: '01234567890' }));
      const el = __maskZoo.input('native'), adapter = ResumeControls.resolve(el);
      const invalid = [12345678900, '0123456789', '012****7890', '012ABC67890'].map(value => ResumeControls.plan(el, { value }));
      const plan = ResumeControls.plan(el, { value: '01234567890' });
      const copied = await adapter.write(el, JSON.parse(JSON.stringify(plan)), { allowWrite: true, check: async () => {} });
      return { guarded, invalid, copied };
    }, [], 'MAIN');
    for (const plan of [...result.guarded, ...result.invalid]) expect(['planned', 'success'], JSON.stringify(plan)).not.toContain(plan.status);
    expect(result.copied).toMatchObject({ status: 'unsupported', attempts: 0 });
    expect(await zoo.readback()).toEqual(before);
    return result;
  }, testInfo);
});

test('generic input masks: model disagreement and delayed reversion fail verification', async ({}, testInfo) => {
  await fixture(async zoo => {
    const results = [];
    for (const family of ['element', 'ant']) {
      const value = cases.find(row => row[0] === family)[2];
      const initial = await write(zoo, family, value);
      expect(initial.verified.status, JSON.stringify(initial)).toBe('success');
      const result = await zoo.execute(async ({ family, value }) => {
        const el = __maskZoo.input(family), plan = ResumeControls.plan(el, { value });
        const displayed = el.value;
        el.value = family === 'ant' ? '9999 9999 9999 9999' : '999 9999 9999';
        const mismatch = await ResumeControls.verify(el, plan, { settleMs: 0 });
        el.value = displayed;
        setTimeout(() => { __maskZoo.owner[family] = ''; }, 15);
        const reverted = await ResumeControls.verify(el, plan, { settleMs: 60 });
        return { mismatch, reverted };
      }, [{ family, value }], 'MAIN');
      expect(result.mismatch.status, JSON.stringify(result)).toBe('mismatch');
      expect(result.reverted.status, JSON.stringify(result)).toBe('reverted');
      results.push({ family, result });
    }
    return results;
  }, testInfo);
});
