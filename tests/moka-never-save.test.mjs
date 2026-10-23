/**
 * Offline safety mutations of the existing provisional Moka fixture only.
 * Live resume DOM is login-walled; live support remains unclaimed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../src/content/moka-basic.js', import.meta.url), 'utf8');
const fixture = readFileSync(new URL('./fixtures/moka-basic-form.html', import.meta.url), 'utf8');
const ambiguousFixture = readFileSync(new URL('./fixtures/moka-basic-ambiguous.html', import.meta.url), 'utf8');
const values = { allowExplicitValues: true, fullName: '测试甲', mobile: '13800138000', email: 'moka.user@example.com' };

function boot(html = fixture, url = 'http://127.0.0.1/moka-basic-form.html') {
  const dom = new JSDOM(html, { url, pretendToBeVisual: true, runScripts: 'outside-only' });
  const { window } = dom;
  window.chrome = { runtime: { onMessage: { addListener() {}, removeListener() {} } } };
  const actions = [];
  for (const button of window.document.querySelectorAll('button')) button.disabled = false;
  window.document.addEventListener('click', () => actions.push('click'), true);
  window.document.addEventListener('submit', () => actions.push('submit'), true);
  window.HTMLElement.prototype.click = () => actions.push('native_click');
  window.HTMLFormElement.prototype.submit = () => actions.push('native_submit');
  window.HTMLFormElement.prototype.requestSubmit = () => actions.push('request_submit');
  vm.runInContext(source, dom.getInternalVMContext());
  return { dom, window, document: window.document, api: window.ResumeMokaBasic, actions };
}

const input = (ctx, name) => ctx.document.querySelector(`input[name="${name}"]`);
const snapshot = (ctx) => [...ctx.document.querySelectorAll('input[name]')].map((node) => [node.name, node.value]);
const fill = (ctx) => ctx.api.fillBasic(values, { synthetic: true });

function neverSave(ctx, result) {
  assert.equal(result.saved, false);
  assert.equal(result.skippedSave, true);
  assert.equal(result.neverSave, true);
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.supportClaimed, false);
  assert.deepEqual(ctx.actions, []);
  assert.equal(input(ctx, 'years')?.value ?? '0', '0');
}

test('fixture-backed empty controls fill with matching readback and zero commit actions', async (t) => {
  const ctx = boot();
  t.after(() => ctx.window.close());
  const result = await fill(ctx);
  neverSave(ctx, result);
  assert.equal(result.ok, true);
  assert.equal(result.writeAttempted, true);
  assert.equal(result.restored, false);
  assert.equal(result.reason, 'readback_matched');
  assert.deepEqual(snapshot(ctx), [['fullName', values.fullName], ['mobile', values.mobile], ['email', values.email], ['years', '0']]);
});

test('occupied values, including prompt-looking text, are strict successful skips', async (t) => {
  // The fixture provides no placeholder-value sentinel. No value is interpreted as one.
  for (const existing of ['保留姓名', '请选择', '请输入姓名', '0', '\u200b', '  KEEP EXACT  ', values.fullName]) {
    const ctx = boot();
    t.after(() => ctx.window.close());
    const name = input(ctx, 'fullName');
    name.value = existing;
    const events = [];
    for (const kind of ['focus', 'input', 'change', 'blur']) name.addEventListener(kind, () => events.push(kind));
    const result = await fill(ctx);
    neverSave(ctx, result);
    assert.equal(result.ok, true, existing);
    const row = result.results.find((entry) => entry.label === '姓名');
    assert.equal(row.reason, 'skipped_existing', existing);
    assert.equal(row.writeAttempted, false, existing);
    assert.equal(name.value, existing, existing);
    assert.deepEqual(events, [], existing);
    assert.equal(input(ctx, 'mobile').value, values.mobile);
    assert.equal(input(ctx, 'email').value, values.email);
  }
});

test('an entirely occupied form causes no writes or focus events', async (t) => {
  const ctx = boot();
  t.after(() => ctx.window.close());
  for (const name of ['fullName', 'mobile', 'email']) input(ctx, name).value = `KEEP-${name}`;
  const before = snapshot(ctx);
  let events = 0;
  for (const kind of ['focusin', 'input', 'change']) ctx.document.addEventListener(kind, () => { events += 1; });
  const result = await fill(ctx);
  neverSave(ctx, result);
  assert.equal(result.ok, true);
  assert.equal(result.reason, 'skipped_existing');
  assert.equal(result.writeAttempted, false);
  assert.ok(result.results.every((row) => row.reason === 'skipped_existing'));
  assert.deepEqual(snapshot(ctx), before);
  assert.equal(events, 0);
});

test('ancestor-hidden, inert, readonly, disabled, and nontext controls fail preflight without writes', async (t) => {
  const mutations = {
    'ancestor display:none': (node) => { node.parentElement.style.display = 'none'; },
    'ancestor visibility:hidden': (node) => { node.parentElement.style.visibility = 'hidden'; },
    'ancestor visibility:collapse': (node) => { node.parentElement.style.visibility = 'collapse'; },
    'ancestor opacity:0': (node) => { node.parentElement.style.opacity = '0'; },
    'ancestor content-visibility:hidden': (node) => { node.parentElement.style.contentVisibility = 'hidden'; },
    'ancestor hidden': (node) => { node.parentElement.hidden = true; },
    'ancestor aria-hidden': (node) => { node.parentElement.setAttribute('aria-hidden', 'true'); },
    'ancestor inert': (node) => { node.parentElement.setAttribute('inert', ''); },
    readonly: (node) => { node.readOnly = true; },
    disabled: (node) => { node.disabled = true; },
    password: (node) => { node.type = 'password'; },
    date: (node) => { node.type = 'date'; }
  };
  for (const [name, mutate] of Object.entries(mutations)) {
    const ctx = boot();
    t.after(() => ctx.window.close());
    mutate(input(ctx, 'mobile'));
    const before = snapshot(ctx);
    const result = await fill(ctx);
    neverSave(ctx, result);
    assert.equal(result.ok, false, name);
    assert.equal(result.reason, 'form_not_ready', name);
    assert.equal(result.writeAttempted, false, name);
    assert.equal(result.results.find((row) => row.label === '手机号码').reason, 'control_not_found', name);
    assert.deepEqual(snapshot(ctx), before, name);
  }
});

test('existing ambiguous fixture fails closed without touching occupied values', async (t) => {
  const ctx = boot(ambiguousFixture);
  t.after(() => ctx.window.close());
  const before = snapshot(ctx);
  const result = await fill(ctx);
  neverSave(ctx, result);
  assert.equal(result.reason, 'form_not_ready');
  assert.equal(result.writeAttempted, false);
  assert.equal(result.results.find((row) => row.label === '姓名').reason, 'field_ambiguous');
  assert.equal(result.results.find((row) => row.label === '邮箱').reason, 'item_not_found');
  assert.deepEqual(snapshot(ctx), before);
});

test('direct text fill refuses empty data and out-of-slice neighbor labels', async (t) => {
  const ctx = boot();
  t.after(() => ctx.window.close());
  const before = snapshot(ctx);
  for (const [label, value, reason] of [['姓名', '  ', 'empty_value'], ['工作年限', '9', 'label_not_allowed']]) {
    const result = await ctx.api.fillText(label, value);
    neverSave(ctx, result);
    assert.equal(result.ok, false);
    assert.equal(result.reason, reason);
    assert.equal(result.writeAttempted, false);
  }
  assert.deepEqual(snapshot(ctx), before);
});

test('focus-triggered competing fill wins before the native setter', async (t) => {
  const ctx = boot();
  t.after(() => ctx.window.close());
  input(ctx, 'fullName').addEventListener('focus', () => { input(ctx, 'fullName').value = 'REACTIVE-NAME'; });
  const result = await fill(ctx);
  neverSave(ctx, result);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'control_changed_before_write');
  assert.equal(result.writeAttempted, false);
  assert.equal(input(ctx, 'fullName').value, 'REACTIVE-NAME');
  assert.equal(input(ctx, 'mobile').value, '');
  assert.equal(input(ctx, 'email').value, '');
});

test('direct text fill restores its owned value when an input event hides the ancestor', async (t) => {
  const ctx = boot();
  t.after(() => ctx.window.close());
  const name = input(ctx, 'fullName');
  name.addEventListener('input', () => { name.parentElement.hidden = true; });
  const result = await ctx.api.fillText('姓名', values.fullName);
  neverSave(ctx, result);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'readback_mismatch');
  assert.equal(result.writeAttempted, true);
  assert.equal(result.restored, true);
  assert.equal(result.restoreComplete, true);
  assert.equal(result.final, '');
  assert.equal(name.value, '');
});

test('direct text fill preserves a competing value on readback mismatch', async (t) => {
  const ctx = boot();
  t.after(() => ctx.window.close());
  const name = input(ctx, 'fullName');
  name.addEventListener('input', () => { name.value = 'REACTIVE-NAME'; });
  const result = await ctx.api.fillText('姓名', values.fullName);
  neverSave(ctx, result);
  assert.equal(result.ok, false);
  assert.equal(result.restored, false);
  assert.equal(result.restoreComplete, false);
  assert.equal(result.rollback[0].reason, 'competing_value_preserved');
  assert.equal(result.final, 'REACTIVE-NAME');
  assert.equal(name.value, 'REACTIVE-NAME');
});

test('reactive occupation of the next field rolls back earlier owned writes', async (t) => {
  const ctx = boot();
  t.after(() => ctx.window.close());
  input(ctx, 'fullName').addEventListener('input', () => {
    if (input(ctx, 'fullName').value === values.fullName) input(ctx, 'mobile').value = 'REACTIVE-PHONE';
  });
  const result = await fill(ctx);
  neverSave(ctx, result);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'control_changed_before_write');
  assert.equal(result.writeAttempted, true);
  assert.equal(result.restored, true);
  assert.equal(result.restoreComplete, true);
  assert.equal(result.rollback.length, 1);
  assert.equal(result.rollback[0].reason, 'restored');
  assert.deepEqual(snapshot(ctx), [['fullName', ''], ['mobile', 'REACTIVE-PHONE'], ['email', ''], ['years', '0']]);
});

test('rollback reports a reactive rejection accurately instead of claiming restoration', async (t) => {
  const ctx = boot();
  t.after(() => ctx.window.close());
  const name = input(ctx, 'fullName');
  name.addEventListener('input', () => {
    if (name.value === values.fullName) input(ctx, 'mobile').value = 'REACTIVE-PHONE';
    else if (name.value === '') name.value = 'REACTIVE-RESTORE';
  });
  const result = await fill(ctx);
  neverSave(ctx, result);
  assert.equal(result.ok, false);
  assert.equal(result.restored, false);
  assert.equal(result.restoreComplete, false);
  assert.equal(result.restoredCount, 0);
  assert.equal(result.rollback[0].reason, 'restore_mismatch');
  assert.equal(result.results[0].final, 'REACTIVE-RESTORE');
  assert.deepEqual(snapshot(ctx), [['fullName', 'REACTIVE-RESTORE'], ['mobile', 'REACTIVE-PHONE'], ['email', ''], ['years', '0']]);
});

test('reactive mismatch preserves its winner and rolls back earlier owned values', async (t) => {
  const ctx = boot();
  t.after(() => ctx.window.close());
  input(ctx, 'mobile').addEventListener('input', () => {
    if (input(ctx, 'mobile').value === values.mobile) input(ctx, 'mobile').value = 'REACTIVE-PHONE';
  });
  const result = await fill(ctx);
  neverSave(ctx, result);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'readback_mismatch');
  assert.equal(result.restored, false);
  assert.equal(result.restoredCount, 1);
  assert.equal(result.restoreComplete, false);
  assert.equal(result.rollback.find((row) => row.label === '手机号码').reason, 'competing_value_preserved');
  assert.deepEqual(snapshot(ctx), [['fullName', ''], ['mobile', 'REACTIVE-PHONE'], ['email', ''], ['years', '0']]);
});

test('final readback catches later reactive changes to an earlier field', async (t) => {
  const ctx = boot();
  t.after(() => ctx.window.close());
  input(ctx, 'email').addEventListener('input', () => {
    if (input(ctx, 'email').value === values.email) input(ctx, 'fullName').value = 'LATE-REACTIVE-NAME';
  });
  const result = await fill(ctx);
  neverSave(ctx, result);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'readback_mismatch');
  assert.equal(result.restored, false);
  assert.equal(result.restoredCount, 2);
  assert.equal(result.restoreComplete, false);
  assert.equal(result.rollback.find((row) => row.label === '姓名').reason, 'competing_value_preserved');
  assert.deepEqual(snapshot(ctx), [['fullName', 'LATE-REACTIVE-NAME'], ['mobile', ''], ['email', ''], ['years', '0']]);
});

test('wrong pages and unconfirmed profiles remain unclaimed and never write', async (t) => {
  const ctx = boot();
  const wrong = boot(fixture, 'https://example.com/moka-basic-form.html');
  t.after(() => { ctx.window.close(); wrong.window.close(); });
  const blocked = await ctx.api.fillBasic({ profile: { fullName: values.fullName, phone: values.mobile, email: values.email, confirmedFields: ['fullName'] } }, { synthetic: true });
  neverSave(ctx, blocked);
  assert.equal(blocked.reason, 'profile_fields_unavailable');
  assert.equal(blocked.writeAttempted, false);
  const wrongPage = await fill(wrong);
  neverSave(wrong, wrongPage);
  assert.equal(wrongPage.reason, 'wrong_page');
  assert.equal(wrongPage.writeAttempted, false);
  assert.equal(input(ctx, 'fullName').value, '');
  assert.equal(input(wrong, 'fullName').value, '');
});
