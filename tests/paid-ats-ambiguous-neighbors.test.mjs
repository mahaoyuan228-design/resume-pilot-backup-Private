// Existing duplicate-label fixtures only; no live DOM or lifecycle is asserted.
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
const phone = '13800138000';

function boot(t, site, apiName) {
  const fixture = readFileSync(new URL(`./fixtures/${site}-basic-ambiguous.html`, import.meta.url), 'utf8');
  const source = readFileSync(new URL(`../src/content/${site}-basic.js`, import.meta.url), 'utf8');
  const dom = new JSDOM(fixture, { url: 'http://127.0.0.1/fixture', runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const { window } = dom;
  const { document } = window;
  const actions = { click: 0, submit: 0, submitCall: 0, requestSubmit: 0 };
  for (const kind of ['click', 'submit']) document.addEventListener(kind, (event) => {
    actions[kind] += 1;
    event.preventDefault();
  }, true);
  window.HTMLFormElement.prototype.submit = () => { actions.submitCall += 1; };
  window.HTMLFormElement.prototype.requestSubmit = () => { actions.requestSubmit += 1; };
  const a = document.querySelector('[name="fullName-a"]');
  const b = document.querySelector('[name="fullName-b"]');
  const mobile = document.querySelector('[name="mobile"]');
  const neighborEvents = [];
  const watch = (input) => {
    for (const kind of ['focus', 'input', 'change', 'blur']) input.addEventListener(kind, () => neighborEvents.push(kind));
  };
  watch(a);
  watch(b);
  window.eval(source);
  return { window, document, api: window[apiName], a, b, mobile, actions, neighborEvents, watch };
}

function safe(ctx, result) {
  assert.equal(result.saved, false);
  assert.equal(result.skippedSave, true);
  assert.equal(result.liveSupportClaimed, false);
  assert.deepEqual(ctx.actions, { click: 0, submit: 0, submitCall: 0, requestSubmit: 0 });
  assert.deepEqual(ctx.neighborEvents, [], 'ambiguous neighbors receive no focus/write/cleanup events');
}

function refused(ctx, result, beforeRaw, afterRaw, reason = 'neighbor_value_changed') {
  safe(ctx, result);
  assert.equal(result.ok, false, 'a changed duplicate-label neighbor must not report successful fill');
  assert.equal(result.reason, 'neighbor_changed');
  assert.equal(result.neighborsPreserved, false);
  assert.equal(result.restored, false, 'owned rollback does not restore the changed neighbor');
  if ('restoreComplete' in result) assert.equal(result.restoreComplete, false);
  const neighbors = result.neighbors.filter((row) => row.label === '姓名');
  assert.equal(neighbors.length, 2, 'both existing duplicate-label controls are observed separately');
  const changed = neighbors.find((row) => row.beforeRaw === beforeRaw);
  assert.ok(changed);
  assert.equal(changed.afterRaw, afterRaw);
  assert.equal(changed.preserved, false);
  assert.equal(changed.reason, reason);
}

for (const [site, apiName] of sites) {
  test(`${site}: duplicate-label neighbor drift on focus stops the unique target before writing`, async (t) => {
    const ctx = boot(t, site, apiName);
    ctx.mobile.value = '';
    const writes = [];
    for (const kind of ['input', 'change']) ctx.mobile.addEventListener(kind, () => writes.push(kind));
    ctx.mobile.addEventListener('focus', () => { ctx.b.value = ' KEEP-B '; }, { once: true });
    const result = await ctx.api.fillText('手机号码', phone, options);
    refused(ctx, result, 'KEEP-B', ' KEEP-B ');
    assert.equal(result.writeAttempted, false);
    assert.equal(ctx.mobile.value, '');
    assert.equal(ctx.a.value, 'KEEP-A');
    assert.equal(ctx.b.value, ' KEEP-B ');
    assert.deepEqual(writes, []);
  });

  for (const stage of ['input', 'change', 'blur']) {
    test(`${site}: duplicate-label neighbor drift on ${stage} rolls back only the unique target`, async (t) => {
      const ctx = boot(t, site, apiName);
      ctx.mobile.value = '';
      ctx.mobile.addEventListener(stage, () => { ctx.b.value = ' KEEP-B '; }, { once: true });
      const result = await ctx.api.fillText('手机号码', phone, options);
      refused(ctx, result, 'KEEP-B', ' KEEP-B ');
      assert.equal(result.writeAttempted, true);
      assert.equal(ctx.mobile.value, '', 'owned phone write is restored');
      assert.equal(ctx.a.value, 'KEEP-A');
      assert.equal(ctx.b.value, ' KEEP-B ');
    });
  }

  test(`${site}: microtask drift of the first duplicate is also observed`, async (t) => {
    const ctx = boot(t, site, apiName);
    ctx.mobile.value = '';
    ctx.mobile.addEventListener('input', () => {
      ctx.window.queueMicrotask(() => { ctx.a.value = 'REACTIVE-A'; });
    }, { once: true });
    const result = await ctx.api.fillText('手机号码', phone, options);
    refused(ctx, result, 'KEEP-A', 'REACTIVE-A');
    assert.equal(ctx.mobile.value, '');
    assert.equal(ctx.a.value, 'REACTIVE-A');
    assert.equal(ctx.b.value, 'KEEP-B');
  });

  for (const mutation of ['input replacement', 'same-input item replacement', 'swap existing inputs']) {
    test(`${site}: duplicate-label neighbor ${mutation} cannot borrow another binding`, async (t) => {
      const ctx = boot(t, site, apiName);
      ctx.mobile.value = '';
      // Equal raw values make identity, rather than a convenient text comparison, decisive.
      ctx.a.value = 'KEEP-B';
      ctx.mobile.addEventListener('input', () => {
        if (mutation === 'input replacement') {
          const replacement = ctx.b.cloneNode(true);
          ctx.watch(replacement);
          ctx.b.replaceWith(replacement);
        } else if (mutation === 'same-input item replacement') {
          const item = ctx.b.closest(ctx.api.ITEM_SEL);
          const replacement = item.cloneNode(true);
          replacement.querySelector('input').replaceWith(ctx.b);
          item.replaceWith(replacement);
        } else {
          const parentA = ctx.a.parentElement;
          const parentB = ctx.b.parentElement;
          parentA.append(ctx.b);
          parentB.append(ctx.a);
        }
      }, { once: true });
      const result = await ctx.api.fillText('手机号码', phone, options);
      safe(ctx, result);
      assert.equal(result.ok, false, 'equal raw text cannot hide ambiguous neighbor rebind');
      assert.equal(result.reason, 'neighbor_changed');
      assert.equal(result.neighborsPreserved, false);
      assert.equal(result.restored, false);
      const neighbors = result.neighbors.filter((row) => row.label === '姓名');
      assert.equal(neighbors.length, 2);
      assert.ok(neighbors.some((row) => !row.preserved && row.reason === 'neighbor_binding_changed'));
      assert.equal(ctx.a.value, 'KEEP-B');
      assert.equal(ctx.b.value, 'KEEP-B');
      assert.equal(ctx.document.querySelector('[name="fullName-b"]').value, 'KEEP-B');
      assert.equal(ctx.mobile.value, '');
    });
  }

  test(`${site}: cleanup-only duplicate-label drift prevents a complete restoration claim`, async (t) => {
    const ctx = boot(t, site, apiName);
    ctx.mobile.value = '';
    ctx.mobile.addEventListener('input', () => {
      if (ctx.mobile.value === phone) ctx.mobile.closest(ctx.api.ITEM_SEL).hidden = true;
      else ctx.b.value = 'CLEANUP-B';
    });
    const result = await ctx.api.fillText('手机号码', phone, options);
    refused(ctx, result, 'KEEP-B', 'CLEANUP-B');
    assert.equal(ctx.mobile.value, '');
    assert.equal(ctx.a.value, 'KEEP-A');
    assert.equal(ctx.b.value, 'CLEANUP-B');
  });

  for (const occupied of [false, true]) {
    test(`${site}: unchanged duplicate-label neighbors permit ${occupied ? 'occupied skip' : 'unique direct fill'}`, async (t) => {
      const ctx = boot(t, site, apiName);
      if (!occupied) ctx.mobile.value = '';
      const result = await ctx.api.fillText('手机号码', phone, options);
      safe(ctx, result);
      assert.equal(result.ok, true);
      assert.equal(result.writeAttempted, !occupied);
      assert.equal(ctx.mobile.value, occupied ? 'KEEP-PHONE' : phone);
      assert.equal(ctx.a.value, 'KEEP-A');
      assert.equal(ctx.b.value, 'KEEP-B');
      assert.equal(result.neighborsPreserved, true);
    });
  }

  for (const mode of ['direct ambiguous target', 'batch incomplete form']) {
    test(`${site}: observing duplicate neighbors never authorizes ${mode}`, async (t) => {
      const ctx = boot(t, site, apiName);
      const result = mode === 'direct ambiguous target'
        ? await ctx.api.fillText('姓名', 'FILL-NAME', options)
        : await ctx.api.fillBasic({ allowExplicitValues: true, fullName: 'FILL-NAME', mobile: phone, email: 'fixture@example.com' }, options);
      safe(ctx, result);
      assert.equal(result.ok, false);
      assert.equal(result.writeAttempted, false);
      assert.equal(result.reason, mode === 'direct ambiguous target' ? 'field_ambiguous' : 'form_not_ready');
      assert.equal(ctx.a.value, 'KEEP-A');
      assert.equal(ctx.b.value, 'KEEP-B');
      assert.equal(ctx.mobile.value, 'KEEP-PHONE');
    });
  }
}
