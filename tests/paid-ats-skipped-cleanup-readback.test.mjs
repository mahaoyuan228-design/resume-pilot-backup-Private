// Existing fixture nodes only. Cleanup receipt checks do not establish live ATS support.
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
const occupied = '  KEEP OCCUPIED  ';

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
  const skippedEvents = [];
  // Delegation also observes existing inputs cloned during a rebind probe.
  for (const kind of ['focus', 'input', 'change', 'blur']) document.addEventListener(kind, (event) => {
    if (event.target.name === 'fullName' || event.target.name === 'years') skippedEvents.push(kind);
  }, true);
  return { window, document, api: window[apiName], controls, actions, skippedEvents };
}

function triggerOwnedCleanup(ctx) {
  const { email } = ctx.controls;
  // Reuse the existing Never-Save visibility-failure probe. Cleanup owns only
  // phone/email; the occupied name has already been accepted without a write.
  email.addEventListener('input', () => {
    if (email.value === values.email) email.closest(ctx.api.ITEM_SEL).hidden = true;
  });
}

function safe(ctx, result, focusPopulated = false) {
  assert.equal(result.saved, false);
  assert.equal(result.skippedSave, true);
  assert.equal(result.liveSupportClaimed, false);
  assert.deepEqual(ctx.actions, { click: 0, submit: 0, submitCall: 0, requestSubmit: 0 });
  assert.equal(ctx.controls.years.value, '0');
  if (focusPopulated) assert.ok(ctx.skippedEvents.every((kind) => kind === 'focus' || kind === 'blur'));
  else assert.deepEqual(ctx.skippedEvents, [], 'skipped name and neighbor never receive write or cleanup events');
}

function assertOwnedRestored(ctx, result) {
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'readback_mismatch');
  assert.equal(result.writeAttempted, true);
  assert.equal(ctx.controls.mobile.value, '');
  assert.equal(ctx.controls.email.value, '');
  const cleanup = result.restore ?? result.rollback;
  assert.equal(cleanup.length, 2);
  assert.ok(cleanup.every((row) => row.restored ?? row.ok), 'owned phone/email rollback still succeeds');
  assert.ok(cleanup.every((row) => row.label !== '姓名'), 'skipped name never enters owned rollback');
  assert.equal(result.neighborsPreserved, true, 'unchanged years neighbor retains its separate scope');
  if ('restoredCount' in result) assert.equal(result.restoredCount, 2);
}

for (const [site, apiName] of sites) {
  for (const mutation of ['value', 'raw whitespace', 'same-input item rebind', 'input replacement', 'queued value']) {
    test(`${site}: cleanup rechecks the skipped receipt after ${mutation}`, async (t) => {
      const ctx = boot(t, site, apiName);
      const { fullName, mobile } = ctx.controls;
      fullName.value = occupied;
      triggerOwnedCleanup(ctx);
      let replacement;
      mobile.addEventListener('input', () => {
        if (mobile.value !== '') return;
        if (mutation === 'value') fullName.value = 'CLEANUP-NAME';
        else if (mutation === 'raw whitespace') fullName.value = occupied.trim();
        else if (mutation === 'queued value') ctx.window.queueMicrotask(() => { fullName.value = 'CLEANUP-NAME'; });
        else if (mutation === 'same-input item rebind') {
          const item = fullName.closest(ctx.api.ITEM_SEL);
          replacement = item.cloneNode(true);
          replacement.querySelector('input').replaceWith(fullName);
          item.replaceWith(replacement);
        } else {
          replacement = fullName.cloneNode(true);
          fullName.replaceWith(replacement);
        }
      });
      const result = await ctx.api.fillBasic(values, options);
      safe(ctx, result);
      assertOwnedRestored(ctx, result);
      assert.equal(result.restored, false, 'owned rollback cannot claim full restoration after skipped-field drift');
      if ('restoreComplete' in result) assert.equal(result.restoreComplete, false);
      assert.equal(result.results[0].ok, false, 'the skipped receipt cannot remain a stale success');
      assert.equal(result.results[0].reason, 'readback_mismatch');
      assert.equal(result.results[0].writeAttempted, false);
      const expected = mutation.includes('value') ? 'CLEANUP-NAME' : mutation === 'raw whitespace' ? occupied.trim() : occupied;
      assert.equal(fullName.value, expected, 'cleanup never overwrites the changed skipped value');
      assert.equal(ctx.document.querySelector('[name="fullName"]').value, expected);
      if (mutation === 'input replacement') assert.equal(replacement.value, occupied);
    });
  }

  test(`${site}: cleanup retains a skipped receipt already marked as a mismatch`, async (t) => {
    const ctx = boot(t, site, apiName);
    const { fullName, mobile, email } = ctx.controls;
    fullName.value = occupied;
    email.addEventListener('input', () => {
      if (email.value === values.email) fullName.value = 'BEFORE-CLEANUP';
    });
    mobile.addEventListener('input', () => {
      if (mobile.value === '') fullName.value = 'AFTER-CLEANUP';
    });
    const result = await ctx.api.fillBasic(values, options);
    safe(ctx, result);
    assertOwnedRestored(ctx, result);
    assert.equal(result.restored, false, 'pre-cleanup reason changes cannot discard the accepted skipped receipt');
    if ('restoreComplete' in result) assert.equal(result.restoreComplete, false);
    assert.equal(result.results[0].ok, false);
    assert.equal(result.results[0].reason, 'readback_mismatch');
    assert.equal(result.results[0].after, 'AFTER-CLEANUP');
    assert.equal(result.results[0].writeAttempted, false);
    assert.equal(fullName.value, 'AFTER-CLEANUP');
  });

  test(`${site}: unchanged skipped receipt permits complete owned rollback`, async (t) => {
    const ctx = boot(t, site, apiName);
    ctx.controls.fullName.value = occupied;
    triggerOwnedCleanup(ctx);
    const result = await ctx.api.fillBasic(values, options);
    safe(ctx, result);
    assertOwnedRestored(ctx, result);
    assert.equal(result.restored, true);
    if ('restoreComplete' in result) assert.equal(result.restoreComplete, true);
    assert.equal(result.results[0].ok, true);
    assert.equal(result.results[0].reason, 'skipped_existing');
    assert.equal(ctx.controls.fullName.value, occupied);
  });

  test(`${site}: unchanged all-occupied batch remains a no-write success`, async (t) => {
    const ctx = boot(t, site, apiName);
    const before = [occupied, 'KEEP-PHONE', 'KEEP-EMAIL'];
    ['fullName', 'mobile', 'email'].forEach((name, i) => { ctx.controls[name].value = before[i]; });
    const result = await ctx.api.fillBasic(values, options);
    safe(ctx, result);
    assert.equal(result.ok, true);
    assert.equal(result.writeAttempted, false);
    assert.equal(result.restored, false);
    assert.ok(result.results.every((row) => row.ok && row.reason === 'skipped_existing' && !row.writeAttempted));
    assert.deepEqual(['fullName', 'mobile', 'email'].map((name) => ctx.controls[name].value), before);
    assert.equal((result.restore ?? result.rollback).length, 0);
  });

  // These adapters accept focus population as a skip; Moka deliberately refuses it.
  if (site === 'moka') continue;
  for (const changed of [false, true]) {
    test(`${site}: cleanup uses the accepted focus-populated receipt (${changed ? 'changed' : 'unchanged'})`, async (t) => {
      const ctx = boot(t, site, apiName);
      const { fullName, mobile } = ctx.controls;
      fullName.addEventListener('focus', () => { fullName.value = occupied; }, { once: true });
      triggerOwnedCleanup(ctx);
      if (changed) mobile.addEventListener('input', () => {
        if (mobile.value === '') fullName.value = occupied.trim();
      });
      const result = await ctx.api.fillBasic(values, options);
      safe(ctx, result, true);
      assertOwnedRestored(ctx, result);
      assert.equal(result.restored, !changed);
      assert.equal(result.results[0].ok, !changed);
      assert.equal(result.results[0].reason, changed ? 'readback_mismatch' : 'skipped_existing');
      assert.equal(result.results[0].writeAttempted, false);
      assert.equal(fullName.value, changed ? occupied.trim() : occupied);
    });
  }
}
