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
    const result = await ctx.api.fillText(label, value, { synthetic: true });
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
  const result = await ctx.api.fillText('姓名', values.fullName, { synthetic: true });
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
  const result = await ctx.api.fillText('姓名', values.fullName, { synthetic: true });
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
// Rebind only existing fixture nodes/classes. These adversarial state changes
// are offline safety cases, not a claim that a live tenant uses this lifecycle.
function rebindFixtureItem(api, control) {
  const item = control.closest(api.ITEM_SEL);
  const replacement = item.cloneNode(true);
  replacement.querySelector('input').replaceWith(control);
  item.replaceWith(replacement);
  return replacement;
}

test('focus rebind retaining the same input refuses writes through a new item', async (t) => {
  const ctx = boot();
  t.after(() => ctx.window.close());
  const { api, document } = ctx;
  const control = document.querySelector('[name="fullName"]');
  const originalItem = control.closest(api.ITEM_SEL);
  let writes = 0;
  control.addEventListener('focus', () => { rebindFixtureItem(api, control); }, { once: true });
  control.addEventListener('input', () => { writes += 1; });
  const result = await api.fillBasic(values, { synthetic: true });
  neverSave(ctx, result);
  assert.equal(result.ok, false);
  assert.equal(result.writeAttempted, false);
  assert.equal(writes, 0);
  assert.equal(originalItem.isConnected, false);
  assert.equal(control.isConnected, true);
  assert.equal(control.value, '');
  assert.equal(document.querySelector('[name="mobile"]').value, '');
  assert.equal(document.querySelector('[name="email"]').value, '');
  assert.equal(document.querySelector('[name="years"]').value, '0');
});

test('post-write reparent preserves the occupied skip and the rebound neighbor', async (t) => {
  const ctx = boot();
  t.after(() => ctx.window.close());
  const { api, document } = ctx;
  const name = document.querySelector('[name="fullName"]');
  const mobile = document.querySelector('[name="mobile"]');
  const years = document.querySelector('[name="years"]');
  name.value = '  KEEP OCCUPIED  ';
  let occupiedEvents = 0;
  for (const kind of ['focus', 'input', 'change', 'blur']) {
    name.addEventListener(kind, () => { occupiedEvents += 1; });
  }
  let mobileWrites = 0;
  const mobileEvents = [];
  for (const kind of ['input', 'change', 'blur']) {
    mobile.addEventListener(kind, () => { mobileEvents.push(kind); });
  }
  mobile.addEventListener('input', () => { mobileWrites += 1; });
  mobile.addEventListener('input', () => {
    const mobileParent = mobile.parentElement;
    const yearsParent = years.parentElement;
    mobileParent.append(years);
    yearsParent.append(mobile);
  }, { once: true });
  const result = await api.fillBasic(values, { synthetic: true });
  neverSave(ctx, result);
  assert.equal(result.ok, false);
  assert.equal(result.writeAttempted, true);
  assert.equal(result.restored, false);
  assert.equal(result.results[0].reason, 'skipped_existing');
  assert.equal(result.results[0].writeAttempted, false);
  assert.equal(name.value, '  KEEP OCCUPIED  ');
  assert.equal(occupiedEvents, 0);
  assert.equal(mobileWrites, 1, 'cleanup must not write through the rebound neighbor');
  assert.deepEqual(mobileEvents, ['input'], 'no change/blur events may escape into the rebound item');
  assert.equal(mobile.value, '13800138000');
  assert.equal(years.value, '0');
  assert.equal(document.querySelector('[name="email"]').value, '');
});

test('rollback refuses an earlier input rebound by the failing field event', async (t) => {
  const ctx = boot();
  t.after(() => ctx.window.close());
  const { api, document } = ctx;
  const name = document.querySelector('[name="fullName"]');
  const mobile = document.querySelector('[name="mobile"]');
  let nameWrites = 0;
  name.addEventListener('input', () => { nameWrites += 1; });
  mobile.addEventListener('input', () => {
    mobile.value = 'REACTIVE-PHONE';
    rebindFixtureItem(api, name);
  }, { once: true });
  const result = await api.fillBasic(values, { synthetic: true });
  neverSave(ctx, result);
  assert.equal(result.ok, false);
  assert.equal(result.restored, false);
  assert.equal(nameWrites, 1, 'the still-connected input no longer belongs to the original item');
  assert.equal(name.value, '测试甲');
  assert.equal(mobile.value, 'REACTIVE-PHONE');
  assert.equal(document.querySelector('[name="email"]').value, '');
  assert.equal(document.querySelector('[name="years"]').value, '0');
});

test('final readback detects same-input item rebind and rolls back only stable fields', async (t) => {
  const ctx = boot();
  t.after(() => ctx.window.close());
  const { api, document } = ctx;
  const name = document.querySelector('[name="fullName"]');
  const email = document.querySelector('[name="email"]');
  let nameWrites = 0;
  name.addEventListener('input', () => { nameWrites += 1; });
  email.addEventListener('input', () => { rebindFixtureItem(api, name); }, { once: true });
  const result = await api.fillBasic(values, { synthetic: true });
  neverSave(ctx, result);
  assert.equal(result.ok, false);
  assert.equal(result.results[0].reason, 'readback_mismatch');
  assert.equal(result.restored, false);
  assert.equal(nameWrites, 1);
  assert.equal(name.value, '测试甲');
  assert.equal(document.querySelector('[name="mobile"]').value, '');
  assert.equal(email.value, '');
  assert.equal(document.querySelector('[name="years"]').value, '0');
});

test('cleanup rebind invalidates a previously restored field even when its raw value still matches', async (t) => {
  const ctx = boot();
  t.after(() => ctx.window.close());
  const { api, document } = ctx;
  const name = document.querySelector('[name="fullName"]');
  const mobile = document.querySelector('[name="mobile"]');
  const email = document.querySelector('[name="email"]');
  email.addEventListener('input', () => { email.value = 'reactive@example.com'; }, { once: true });
  name.addEventListener('input', () => {
    if (name.value === '') rebindFixtureItem(api, mobile);
  });
  const result = await api.fillBasic(values, { synthetic: true });
  neverSave(ctx, result);
  assert.equal(result.ok, false);
  assert.equal(result.restored, false);
  const restoredMobile = result.rollback.find((row) => row.label === '手机号码');
  assert.equal(restoredMobile.restored, false, 'matching raw text does not prove the original field was restored');
  assert.equal(name.value, '');
  assert.equal(mobile.value, '');
  assert.equal(email.value, 'reactive@example.com');
  assert.equal(document.querySelector('[name="years"]').value, '0');
});

test('direct text cleanup refuses a change-event rebind and sends no stale blur', async (t) => {
  const ctx = boot();
  t.after(() => ctx.window.close());
  const { api, document } = ctx;
  const name = document.querySelector('[name="fullName"]');
  const events = [];
  for (const kind of ['input', 'change', 'blur']) {
    name.addEventListener(kind, () => { events.push(kind); });
  }
  name.addEventListener('change', () => { rebindFixtureItem(api, name); }, { once: true });
  const result = await api.fillText('姓名', '测试甲', { synthetic: true });
  neverSave(ctx, result);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'readback_mismatch');
  assert.equal(result.writeAttempted, true);
  assert.equal(result.restored, false);
  assert.deepEqual(events, ['input', 'change']);
  assert.equal(name.value, '测试甲');
  assert.equal(document.querySelector('[name="mobile"]').value, '');
  assert.equal(document.querySelector('[name="email"]').value, '');
  assert.equal(document.querySelector('[name="years"]').value, '0');
});
