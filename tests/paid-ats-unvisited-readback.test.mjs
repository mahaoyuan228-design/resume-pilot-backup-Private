// Existing fixture controls only. Early-failure observations do not establish live ATS support.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const sites = [
  ['beisen-2022', 'ResumeBeisen2022Basic'],
  ['feishu-atsx', 'ResumeFeishuAtsxBasic'],
  ['moka', 'ResumeMokaBasic']
];
const values = { allowExplicitValues: true, fullName: 'FILL-NAME', mobile: '13800138000', email: 'fixture@example.com' };
const options = { synthetic: true };
const occupied = '  KEEP PHONE  ';

function boot(t, site, apiName, unvisitedNames = ['mobile', 'email', 'years']) {
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
  const unvisitedEvents = [];
  for (const kind of ['focus', 'input', 'change', 'blur']) document.addEventListener(kind, (event) => {
    if (unvisitedNames.includes(event.target.name)) unvisitedEvents.push(kind);
  }, true);
  return { window, document, api: window[apiName], controls, actions, unvisitedEvents };
}

function failFirstWrite(ctx, mutate = () => {}) {
  const { fullName } = ctx.controls;
  fullName.addEventListener('input', () => {
    // Existing Never-Save visibility-failure probe, without changing fixture markup.
    if (fullName.value === values.fullName) fullName.closest(ctx.api.ITEM_SEL).hidden = true;
    mutate(fullName.value === values.fullName ? 'write' : 'cleanup');
  });
}

function assertSafeOwnedRollback(ctx, result, ownedLabels = ['姓名']) {
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'readback_mismatch');
  assert.equal(result.saved, false);
  assert.equal(result.skippedSave, true);
  assert.equal(result.liveSupportClaimed, false);
  assert.deepEqual(ctx.actions, { click: 0, submit: 0, submitCall: 0, requestSubmit: 0 });
  assert.deepEqual(ctx.unvisitedEvents, [], 'unvisited fields and years never receive focus, write, or cleanup events');
  assert.equal(ctx.controls.fullName.value, '');
  assert.equal(ctx.controls.years.value, '0');
  assert.equal(result.neighborsPreserved, true, 'years retains its existing separate neighbor scope');
  const cleanup = result.restore ?? result.rollback;
  assert.deepEqual(Array.from(cleanup, (row) => row.label).sort(), [...ownedLabels].sort());
  assert.ok(cleanup.every((row) => row.restored ?? row.ok), 'owned rollback still succeeds');
  if ('restoredCount' in result) assert.equal(result.restoredCount, ownedLabels.length);
  assert.ok(result.results.every((row) => ownedLabels.includes(row.label) || row.writeAttempted === false));
}

for (const [site, apiName] of sites) {
  for (const phase of ['write', 'cleanup']) {
    test(`${site}: unvisited occupied phone drift during ${phase} prevents complete restoration`, async (t) => {
      const ctx = boot(t, site, apiName);
      ctx.controls.mobile.value = occupied;
      failFirstWrite(ctx, (currentPhase) => {
        if (currentPhase === phase) ctx.controls.mobile.value = 'PAGE-PHONE';
      });
      const result = await ctx.api.fillBasic(values, options);
      assertSafeOwnedRollback(ctx, result);
      assert.equal(result.restored, false, 'restored owned name cannot hide unvisited phone drift');
      if ('restoreComplete' in result) assert.equal(result.restoreComplete, false);
      assert.equal(ctx.controls.mobile.value, 'PAGE-PHONE', 'the page value remains untouched');
      assert.equal(result.unvisitedPreserved, false);
      const readback = result.unvisited.find((row) => row.label === '手机号码');
      assert.equal(readback.beforeRaw, occupied);
      assert.equal(readback.afterRaw, 'PAGE-PHONE');
      assert.equal(readback.preserved, false);
      assert.equal(result.unvisited.find((row) => row.label === '邮箱').preserved, true);
    });
  }

  for (const mutation of ['raw whitespace', 'queued value', 'input replacement', 'same-input item rebind']) {
    test(`${site}: unvisited cleanup readback detects ${mutation}`, async (t) => {
      const ctx = boot(t, site, apiName);
      const { mobile } = ctx.controls;
      mobile.value = occupied;
      let replacement;
      failFirstWrite(ctx, (phase) => {
        if (phase !== 'cleanup') return;
        if (mutation === 'raw whitespace') mobile.value = occupied.trim();
        else if (mutation === 'queued value') ctx.window.queueMicrotask(() => { mobile.value = 'QUEUED-PHONE'; });
        else if (mutation === 'input replacement') {
          replacement = mobile.cloneNode(true);
          mobile.replaceWith(replacement);
        } else {
          const item = mobile.closest(ctx.api.ITEM_SEL);
          replacement = item.cloneNode(true);
          replacement.querySelector('input').replaceWith(mobile);
          item.replaceWith(replacement);
        }
      });
      const result = await ctx.api.fillBasic(values, options);
      assertSafeOwnedRollback(ctx, result);
      assert.equal(result.restored, false);
      if ('restoreComplete' in result) assert.equal(result.restoreComplete, false);
      assert.equal(result.unvisitedPreserved, false);
      const readback = result.unvisited.find((row) => row.label === '手机号码');
      assert.equal(readback.beforeRaw, occupied);
      assert.equal(readback.preserved, false);
      const expected = mutation === 'raw whitespace' ? occupied.trim() : mutation === 'queued value' ? 'QUEUED-PHONE' : occupied;
      assert.equal(mobile.value, expected);
      assert.equal(ctx.document.querySelector('[name="mobile"]').value, expected);
      if (replacement) assert.equal(replacement.isConnected, true);
    });
  }

  test(`${site}: unvisited empty email populated during cleanup prevents complete restoration`, async (t) => {
    const ctx = boot(t, site, apiName);
    failFirstWrite(ctx, (phase) => {
      if (phase === 'cleanup') ctx.controls.email.value = 'page@example.com';
    });
    const result = await ctx.api.fillBasic(values, options);
    assertSafeOwnedRollback(ctx, result);
    assert.equal(result.restored, false);
    if ('restoreComplete' in result) assert.equal(result.restoreComplete, false);
    assert.equal(result.unvisitedPreserved, false);
    assert.equal(ctx.controls.email.value, 'page@example.com');
  });

  test(`${site}: unchanged unvisited fields permit complete owned rollback`, async (t) => {
    const ctx = boot(t, site, apiName);
    ctx.controls.mobile.value = occupied;
    failFirstWrite(ctx);
    const result = await ctx.api.fillBasic(values, options);
    assertSafeOwnedRollback(ctx, result);
    assert.equal(result.restored, true);
    if ('restoreComplete' in result) assert.equal(result.restoreComplete, true);
    assert.equal(ctx.controls.mobile.value, occupied);
    assert.equal(ctx.controls.email.value, '');
  });

  test(`${site}: second-field failure observes email drift during earlier name cleanup`, async (t) => {
    const ctx = boot(t, site, apiName, ['email', 'years']);
    const { fullName, mobile, email } = ctx.controls;
    mobile.addEventListener('input', () => {
      if (mobile.value === values.mobile) mobile.closest(ctx.api.ITEM_SEL).hidden = true;
    });
    fullName.addEventListener('input', () => {
      if (fullName.value === '') email.value = 'cleanup@example.com';
    });
    const result = await ctx.api.fillBasic(values, options);
    assertSafeOwnedRollback(ctx, result, ['姓名', '手机号码']);
    assert.equal(mobile.value, '');
    assert.equal(email.value, 'cleanup@example.com');
    assert.equal(result.restored, false);
    if ('restoreComplete' in result) assert.equal(result.restoreComplete, false);
    assert.equal(result.unvisitedPreserved, false);
    assert.equal(result.unvisited.length, 1, 'only the email was never visited');
    assert.equal(result.unvisited[0].label, '邮箱');
    assert.equal(result.unvisited[0].beforeRaw, '');
    assert.equal(result.unvisited[0].afterRaw, 'cleanup@example.com');
    assert.equal(result.unvisited[0].preserved, false);
  });
}
