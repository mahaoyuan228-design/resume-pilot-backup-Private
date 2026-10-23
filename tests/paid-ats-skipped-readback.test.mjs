// Existing fixture nodes only. Offline soft-skip preservation, not live ATS evidence.
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
  const events = [];
  for (const kind of ['focus', 'input', 'change', 'blur']) controls.fullName.addEventListener(kind, () => events.push(kind));
  return { window, document, api: window[apiName], controls, actions, events };
}

function safe(ctx, result) {
  assert.equal(result.saved, false);
  assert.equal(result.skippedSave, true);
  assert.equal(result.liveSupportClaimed, false);
  assert.ok(Object.values(ctx.actions).every((count) => count === 0), JSON.stringify(ctx.actions));
  assert.equal(ctx.controls.years.value, '0');
}

function refused(ctx, result) {
  safe(ctx, result);
  assert.equal(result.ok, false, 'a skipped field lost its value or binding');
  assert.equal(result.reason, 'readback_mismatch');
  assert.equal(result.results[0].ok, false);
  assert.equal(result.results[0].reason, 'readback_mismatch');
  assert.equal(result.results[0].writeAttempted, false, 'skipped fields never become rollback writes');
  assert.equal(ctx.controls.mobile.value, '', 'owned phone write rolls back');
  assert.equal(ctx.controls.email.value, '', 'owned email write rolls back');
}

for (const [site, apiName] of sites) {
  for (const mutation of ['value', 'raw whitespace', 'same-input item rebind', 'input replacement']) {
    test(`${site}: final readback refuses skipped-field ${mutation}`, async (t) => {
      const ctx = boot(t, site, apiName);
      const { fullName, email } = ctx.controls;
      fullName.value = occupied;
      let replacement;
      email.addEventListener('input', () => {
        if (mutation === 'value') fullName.value = 'COMPETING-NAME';
        else if (mutation === 'raw whitespace') fullName.value = occupied.trim();
        else if (mutation === 'same-input item rebind') {
          const item = fullName.closest(ctx.api.ITEM_SEL);
          replacement = item.cloneNode(true);
          replacement.querySelector('input').replaceWith(fullName);
          item.replaceWith(replacement);
        } else {
          replacement = fullName.cloneNode(true);
          fullName.replaceWith(replacement);
        }
      }, { once: true });
      const result = await ctx.api.fillBasic(values, options);
      refused(ctx, result);
      assert.equal(fullName.value, mutation === 'value' ? 'COMPETING-NAME' : mutation === 'raw whitespace' ? occupied.trim() : occupied);
      if (mutation === 'input replacement') assert.equal(replacement.value, occupied);
      assert.deepEqual(ctx.events, [], 'no focus, write, or cleanup events on the skipped input');
    });
  }

  test(`${site}: unchanged raw occupied value remains a successful soft-skip`, async (t) => {
    const ctx = boot(t, site, apiName);
    ctx.controls.fullName.value = occupied;
    const result = await ctx.api.fillBasic(values, options);
    safe(ctx, result);
    assert.equal(result.ok, true);
    assert.equal(result.results[0].reason, 'skipped_existing');
    assert.equal(result.results[0].writeAttempted, false);
    assert.equal(ctx.controls.fullName.value, occupied);
    assert.equal(ctx.controls.mobile.value, values.mobile);
    assert.equal(ctx.controls.email.value, values.email);
    assert.deepEqual(ctx.events, []);
  });

  // Moka deliberately refuses focus/next-field population already. These two
  // adapters accept it as a soft-skip, so retain the value observed at that skip.
  if (site === 'moka') continue;
  for (const stage of ['focus', 'before turn', 'focus then late change']) {
    test(`${site}: snapshot the occupied value at the skip (${stage})`, async (t) => {
      const ctx = boot(t, site, apiName);
      const skipped = stage === 'before turn' ? ctx.controls.mobile : ctx.controls.fullName;
      if (stage === 'before turn') {
        ctx.controls.fullName.addEventListener('input', () => { skipped.value = occupied; }, { once: true });
      } else {
        skipped.addEventListener('focus', () => { skipped.value = occupied; }, { once: true });
      }
      if (stage === 'focus then late change') {
        ctx.controls.email.addEventListener('input', () => {
          ctx.window.queueMicrotask(() => { skipped.value = 'LATE-COMPETING'; });
        }, { once: true });
      }
      const result = await ctx.api.fillBasic(values, options);
      safe(ctx, result);
      if (stage === 'focus then late change') {
        refused(ctx, result);
        assert.equal(skipped.value, 'LATE-COMPETING');
      } else {
        assert.equal(result.ok, true);
        const row = result.results[stage === 'before turn' ? 1 : 0];
        assert.equal(row.reason, 'skipped_existing');
        assert.equal(row.writeAttempted, false);
        assert.equal(skipped.value, occupied);
        assert.equal(ctx.controls.email.value, values.email);
      }
      if (stage !== 'before turn') assert.ok(ctx.events.every((kind) => kind === 'focus' || kind === 'blur'), 'no input/change writes on a focus-populated skip');
    });
  }
}
