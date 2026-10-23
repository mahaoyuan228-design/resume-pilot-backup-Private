// Existing fixture controls only; these reactive probes do not establish live ATS behavior.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const sites = [
  ['beisen-2022', 'ResumeBeisen2022Basic'],
  ['feishu-atsx', 'ResumeFeishuAtsxBasic'],
  ['moka', 'ResumeMokaBasic']
];
const options = { synthetic: true };
const values = { allowExplicitValues: true, fullName: 'FILL-NAME', mobile: '13800138000', email: 'fixture@example.com' };

function boot(t, site, apiName) {
  const fixture = readFileSync(new URL(`./fixtures/${site}-basic-form.html`, import.meta.url), 'utf8');
  const source = readFileSync(new URL(`../src/content/${site}-basic.js`, import.meta.url), 'utf8');
  const dom = new JSDOM(fixture, { url: 'http://127.0.0.1/fixture', runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const { window } = dom;
  const { document } = window;
  const actions = { click: 0, submit: 0, submitCall: 0, requestSubmit: 0 };
  for (const button of document.querySelectorAll('button')) button.disabled = false;
  for (const kind of ['click', 'submit']) document.addEventListener(kind, (event) => {
    actions[kind] += 1;
    event.preventDefault();
  }, true);
  window.HTMLFormElement.prototype.submit = () => { actions.submitCall += 1; };
  window.HTMLFormElement.prototype.requestSubmit = () => { actions.requestSubmit += 1; };
  window.eval(source);
  const controls = Object.fromEntries(['fullName', 'mobile', 'email', 'years'].map((name) => [name, document.querySelector(`[name="${name}"]`)]));
  const neighborEvents = [];
  for (const kind of ['focus', 'input', 'change', 'blur']) controls.years.addEventListener(kind, () => neighborEvents.push(kind));
  return { window, document, api: window[apiName], controls, actions, neighborEvents };
}

function safe(ctx, result) {
  assert.equal(result.saved, false);
  assert.equal(result.skippedSave, true);
  assert.equal(result.liveSupportClaimed, false);
  assert.ok(Object.values(ctx.actions).every((count) => count === 0), JSON.stringify(ctx.actions));
  assert.deepEqual(ctx.neighborEvents, [], 'the unowned years input receives no focus or write/cleanup events');
}

function refused(ctx, result, afterRaw, beforeRaw = '0') {
  safe(ctx, result);
  assert.equal(result.ok, false, 'neighbor drift must not report successful fill');
  assert.equal(result.reason, 'neighbor_changed');
  assert.equal(result.neighborsPreserved, false);
  assert.equal(result.restored, false, 'owned rollback does not restore the changed neighbor');
  if ('restoreComplete' in result) assert.equal(result.restoreComplete, false);
  const neighbor = result.neighbors.find((row) => row.label === '工作年限');
  assert.ok(neighbor, 'neighbor evidence is returned');
  assert.equal(neighbor.beforeRaw, beforeRaw);
  assert.equal(neighbor.afterRaw, afterRaw);
  assert.equal(neighbor.preserved, false);
  assert.equal(ctx.controls.years.value, afterRaw, 'the reactive neighbor is preserved exactly');
}

for (const [site, apiName] of sites) {
  test(`${site}: direct focus refuses raw neighbor drift before writing`, async (t) => {
    const ctx = boot(t, site, apiName);
    const targetEvents = [];
    for (const kind of ['input', 'change']) ctx.controls.fullName.addEventListener(kind, () => targetEvents.push(kind));
    ctx.controls.fullName.addEventListener('focus', () => { ctx.controls.years.value = ' 0 '; }, { once: true });
    const result = await ctx.api.fillText('姓名', values.fullName, options);
    refused(ctx, result, ' 0 ');
    assert.equal(result.writeAttempted, false);
    assert.equal(ctx.controls.fullName.value, '');
    assert.deepEqual(targetEvents, []);
  });

  for (const stage of ['input', 'change', 'blur']) {
    test(`${site}: direct ${stage} neighbor drift rolls back only the target`, async (t) => {
      const ctx = boot(t, site, apiName);
      ctx.controls.fullName.addEventListener(stage, () => { ctx.controls.years.value = `  REACTIVE-${stage}  `; }, { once: true });
      const result = await ctx.api.fillText('姓名', values.fullName, options);
      refused(ctx, result, `  REACTIVE-${stage}  `);
      assert.equal(result.writeAttempted, true);
      assert.equal(ctx.controls.fullName.value, '', 'owned direct write is restored');
      assert.equal(ctx.controls.mobile.value, '');
      assert.equal(ctx.controls.email.value, '');
    });
  }

  test(`${site}: batch late microtask refuses exact raw neighbor drift`, async (t) => {
    const ctx = boot(t, site, apiName);
    ctx.controls.email.addEventListener('input', () => {
      ctx.window.queueMicrotask(() => { ctx.controls.years.value = ' 0 '; });
    }, { once: true });
    const result = await ctx.api.fillBasic(values, options);
    refused(ctx, result, ' 0 ');
    assert.equal(result.writeAttempted, true);
    for (const name of ['fullName', 'mobile', 'email']) assert.equal(ctx.controls[name].value, '', `${name} owned write is restored`);
  });

  test(`${site}: batch phone focus refuses neighbor drift and stops later writes`, async (t) => {
    const ctx = boot(t, site, apiName);
    ctx.controls.mobile.addEventListener('focus', () => { ctx.controls.years.value = 'FOCUS-NEIGHBOR'; }, { once: true });
    const result = await ctx.api.fillBasic(values, options);
    refused(ctx, result, 'FOCUS-NEIGHBOR');
    assert.equal(result.results.find((row) => row.label === '手机号码').writeAttempted, false);
    for (const name of ['fullName', 'mobile', 'email']) assert.equal(ctx.controls[name].value, '');
  });

  for (const mutation of ['same-input item replacement', 'input replacement']) {
    test(`${site}: batch refuses neighbor ${mutation} despite equal raw value`, async (t) => {
      const ctx = boot(t, site, apiName);
      const original = ctx.controls.years;
      let replacement;
      ctx.controls.email.addEventListener('input', () => {
        if (mutation === 'same-input item replacement') {
          const item = original.closest(ctx.api.ITEM_SEL);
          replacement = item.cloneNode(true);
          replacement.querySelector('input').replaceWith(original);
          item.replaceWith(replacement);
        } else {
          replacement = original.cloneNode(true);
          for (const kind of ['focus', 'input', 'change', 'blur']) replacement.addEventListener(kind, () => ctx.neighborEvents.push(kind));
          original.replaceWith(replacement);
        }
      }, { once: true });
      const result = await ctx.api.fillBasic(values, options);
      refused(ctx, result, '0');
      assert.equal(result.neighbors.find((row) => row.label === '工作年限').reason, 'neighbor_binding_changed');
      assert.equal(ctx.document.querySelector('[name="years"]').value, '0');
      assert.equal(original.value, '0');
      for (const name of ['fullName', 'mobile', 'email']) assert.equal(ctx.controls[name].value, '');
    });
  }

  test(`${site}: target failure cleanup reports newly changed neighbor`, async (t) => {
    const ctx = boot(t, site, apiName);
    ctx.controls.email.addEventListener('input', () => { ctx.controls.fullName.value = 'COMPETING-NAME'; }, { once: true });
    ctx.controls.mobile.addEventListener('input', () => {
      if (ctx.controls.mobile.value === '') ctx.controls.years.value = '  CLEANUP-NEIGHBOR  ';
    });
    const result = await ctx.api.fillBasic(values, options);
    refused(ctx, result, '  CLEANUP-NEIGHBOR  ');
    assert.equal(ctx.controls.fullName.value, 'COMPETING-NAME', 'existing ownership rule preserves the competing target');
    assert.equal(ctx.controls.mobile.value, '');
    assert.equal(ctx.controls.email.value, '');
  });

  test(`${site}: direct target failure cleanup also reports neighbor drift`, async (t) => {
    const ctx = boot(t, site, apiName);
    ctx.controls.fullName.addEventListener('input', () => {
      if (ctx.controls.fullName.value === values.fullName) ctx.controls.fullName.closest(ctx.api.ITEM_SEL).hidden = true;
      else ctx.controls.years.value = 'DIRECT-CLEANUP';
    });
    const result = await ctx.api.fillText('姓名', values.fullName, options);
    refused(ctx, result, 'DIRECT-CLEANUP');
    assert.equal(ctx.controls.fullName.value, '');
  });

  test(`${site}: direct fill treats another existing target as unowned`, async (t) => {
    const ctx = boot(t, site, apiName);
    ctx.controls.fullName.addEventListener('input', () => { ctx.controls.mobile.value = '  PAGE-PHONE  '; }, { once: true });
    const result = await ctx.api.fillText('姓名', values.fullName, options);
    safe(ctx, result);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'neighbor_changed');
    assert.equal(result.restored, false);
    const phone = result.neighbors.find((row) => row.label === '手机号码');
    assert.equal(phone.beforeRaw, '');
    assert.equal(phone.afterRaw, '  PAGE-PHONE  ');
    assert.equal(phone.preserved, false);
    assert.equal(ctx.controls.mobile.value, '  PAGE-PHONE  ');
    assert.equal(ctx.controls.fullName.value, '');
  });

  for (const mode of ['direct', 'batch']) {
    test(`${site}: ${mode} preserves unchanged raw neighbors`, async (t) => {
      const ctx = boot(t, site, apiName);
      ctx.controls.years.value = ' 0 ';
      const result = mode === 'direct'
        ? await ctx.api.fillText('姓名', values.fullName, options)
        : await ctx.api.fillBasic(values, options);
      safe(ctx, result);
      assert.equal(result.ok, true);
      assert.equal(ctx.controls.years.value, ' 0 ');
      // The positive control does not demand new metadata from the old implementation.
      if ('neighborsPreserved' in result) assert.equal(result.neighborsPreserved, true);
      assert.equal(ctx.controls.fullName.value, values.fullName);
      assert.equal(ctx.controls.mobile.value, mode === 'batch' ? values.mobile : '');
      assert.equal(ctx.controls.email.value, mode === 'batch' ? values.email : '');
    });
  }
}
