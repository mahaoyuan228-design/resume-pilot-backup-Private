import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { startZoo } from './support.mjs';

const targets = [
  { id: 'switch-native', adapter: 'native-switch', key: 'native' },
  { id: 'switch-element', adapter: 'el-switch', key: 'element' },
  { id: 'switch-ant', adapter: 'antdv1-switch', key: 'ant' },
  { id: 'switch-aria', adapter: 'aria-switch', key: 'aria' },
];

async function fixture(work, testInfo) {
  // The existing harness fulfills every GET locally, blocks all non-GETs, and
  // checks the packaged extension against the checkout before MAIN injection.
  const zoo = await startZoo('cms-month');
  try {
    await zoo.page.evaluate(async () => {
      const form = document.createElement('form');
      form.id = 'switch-fixture';
      form.innerHTML = '<label>Native <input id="switch-native" type="checkbox" role="switch"></label>'
        + '<button id="switch-aria" type="button" role="switch" aria-checked="false">ARIA toggle</button>'
        + '<div id="switch-vue"></div>'
        + '<input id="switch-disabled" type="checkbox" role="switch" disabled>'
        + '<button id="switch-readonly" type="button" role="switch" aria-checked="false" aria-readonly="true">Read only</button>'
        + '<button id="switch-mixed" type="button" role="switch" aria-checked="mixed">Unknown state</button>'
        + '<input id="switch-checkbox" type="checkbox" checked>';
      const effects = window.__switchEffects = { submits: 0, clicks: { native: 0, element: 0, ant: 0, aria: 0 } };
      form.addEventListener('submit', event => { event.preventDefault(); effects.submits++; });
      const aria = form.querySelector('#switch-aria');
      aria.addEventListener('click', () => aria.setAttribute('aria-checked', String(aria.getAttribute('aria-checked') !== 'true')));
      document.body.append(form);
      window.__switchVue = new Vue({
        el: '#switch-vue', data: { element: false, ant: false },
        template: '<section><el-switch id="switch-element" v-model="element"></el-switch>'
          + '<a-switch id="switch-ant" v-model="ant"></a-switch></section>',
      });
      await Vue.nextTick();
      for (const [id, key] of [['switch-native', 'native'], ['switch-element', 'element'], ['switch-ant', 'ant'], ['switch-aria', 'aria']]) {
        const target = document.getElementById(id), role = target.closest('[role="switch"]') || target;
        // Element UI stops its switch click during the target/bubble phase.
        // Its id prop belongs to the internal input; the role owns the UI click.
        role.addEventListener('click', () => effects.clicks[key]++, true);
      }
      window.__switchReadback = () => ({
        native: document.querySelector('#switch-native').checked,
        element: window.__switchVue.element,
        ant: window.__switchVue.ant,
        aria: document.querySelector('#switch-aria').getAttribute('aria-checked') === 'true',
      });
    });
    const before = await zoo.readback();
    const shadow = await zoo.shadow(targets.map(({ id }) => ({ selector: `#${id}`, fact: { value: true } })));
    for (let index = 0; index < targets.length; index++) expect(shadow.plans[index], JSON.stringify(shadow)).toMatchObject({
      adapter: targets[index].adapter, type: 'switch', status: 'planned', liveSupportClaimed: false,
    });
    expect(await zoo.readback()).toEqual(before);
    expect(await zoo.page.evaluate(() => window.__switchReadback())).toEqual({ native: false, element: false, ant: false, aria: false });
    const result = await work(zoo), reads = await zoo.readback(), evidence = await zoo.evidence();
    expect(reads.model).toEqual(before.model);
    expect(reads.snapshot.effects.blacklistClicks).toBe(0);
    expect(await zoo.page.evaluate(() => window.__switchEffects.submits)).toBe(0);
    expect(evidence).toMatchObject({ neverSave: true, liveSupportClaimed: false, nonGetObserved: 0,
      nonGetBlocked: 0, responseToNonGet: 0, blacklistClickAttempts: 0, blacklistClicks: 0, guardFailed: false });
    expect(evidence.routing).toMatchObject({ rejected: [], nonGetReachedRoute: 0 });
    await fs.writeFile(testInfo.outputPath('switch-evidence.json'), JSON.stringify({ shadow, result, reads, evidence,
      execution: 'Disposable offline controls; pinned Element UI 2 and ant-design-vue 1; no live support claim' }, null, 2));
    await zoo.page.screenshot({ path: testInfo.outputPath('switch-fixture.png'), fullPage: true });
  } finally { await zoo.close(); }
}

async function write(zoo, id, fact) {
  return zoo.execute(async ({ id, fact }) => {
    const el = document.getElementById(id), plan = ResumeControls.plan(el, fact), adapter = ResumeControls.resolve(el);
    const denied = await adapter.write(el, plan);
    const written = await adapter.write(el, plan, { allowWrite: true, check: async () => {
      if (!el.isConnected || document.visibilityState !== 'visible') throw Error('offline_switch_target_changed');
    } });
    return { plan, denied, written, verified: await ResumeControls.verify(el, plan) };
  }, [{ id, fact }], 'MAIN');
}

test('generic switches: true/false and explicit toggle click once with DOM and real Vue model readback', async ({}, testInfo) => {
  await fixture(async zoo => {
    const results = [];
    for (const { id, key } of targets) {
      const operations = [];
      for (const [fact, expected] of [[{ value: true }, true], [{ value: false }, false], [{ operation: 'toggle' }, true], [{ operation: 'toggle' }, false]]) {
        const result = await write(zoo, id, fact);
        expect(result.plan.status, JSON.stringify(result)).toBe('planned');
        expect(result.denied).toMatchObject({ status: 'unsupported', reason: 'shadow_mode', attempts: 0 });
        expect(result.written).toMatchObject({ strategy: 'ui', attempts: 1 });
        expect(result.verified, JSON.stringify(result)).toMatchObject({ status: 'success', modelReadback: expected, domReadback: expected });
        expect((await zoo.page.evaluate(() => window.__switchReadback()))[key]).toBe(expected);
        operations.push(result);
      }
      const same = await write(zoo, id, { value: false });
      expect(same.plan.status).toBe('success');
      expect(same.written).toMatchObject({ status: 'success', attempts: 0 });
      expect((await zoo.page.evaluate(() => window.__switchEffects.clicks))[key]).toBe(4);
      results.push({ id, operations, same });
    }
    expect(await zoo.page.evaluate(() => window.__switchReadback())).toEqual({ native: false, element: false, ant: false, aria: false });
    return results;
  }, testInfo);
});

test('generic switches: readonly, disabled, mixed state and ordinary checkbox remain guarded', async ({}, testInfo) => {
  await fixture(async zoo => {
    const result = await zoo.execute(() => {
      const plan = (id, fact) => ResumeControls.plan(document.getElementById(id), fact);
      return { guarded: ['switch-disabled', 'switch-readonly', 'switch-mixed'].map(id => plan(id, { operation: 'toggle' })),
        invalid: ['true', 1, null, []].map(value => plan('switch-native', { value })),
        checkbox: plan('switch-checkbox', { value: false }), checkboxToggle: plan('switch-checkbox', { operation: 'toggle' }) };
    }, [], 'MAIN');
    for (const plan of [...result.guarded, ...result.invalid, result.checkboxToggle]) expect(['planned', 'success']).not.toContain(plan.status);
    expect(result.checkbox).toMatchObject({ status: 'unsupported', reason: 'existing_value' });
    expect(await zoo.page.evaluate(() => window.__switchEffects.clicks)).toEqual({ native: 0, element: 0, ant: 0, aria: 0 });
    return result;
  }, testInfo);
});

test('generic switches: real Vue readback detects inconsistent display and delayed reversion', async ({}, testInfo) => {
  await fixture(async zoo => {
    const written = await write(zoo, 'switch-element', { value: true });
    expect(written.verified.status, JSON.stringify(written)).toBe('success');
    const result = await zoo.execute(async () => {
      const el = document.getElementById('switch-element'), plan = ResumeControls.plan(el, { value: true });
      const role = el.closest('[role="switch"]') || el, previous = role.getAttribute('aria-checked');
      role.setAttribute('aria-checked', 'false');
      const mismatch = await ResumeControls.verify(el, plan, { settleMs: 0 });
      if (previous === null) role.removeAttribute('aria-checked'); else role.setAttribute('aria-checked', previous);
      setTimeout(() => { window.__switchVue.element = false; }, 20);
      const reverted = await ResumeControls.verify(el, plan, { settleMs: 100 });
      return { mismatch, reverted };
    }, [], 'MAIN');
    expect(result.mismatch.status, JSON.stringify(result)).toBe('mismatch');
    expect(result.reverted.status, JSON.stringify(result)).toBe('reverted');
    expect(await zoo.page.evaluate(() => window.__switchVue.element)).toBe(false);
    expect(await zoo.page.evaluate(() => window.__switchEffects.clicks)).toEqual({ native: 0, element: 1, ant: 0, aria: 0 });
    return { written, ...result };
  }, testInfo);
});
