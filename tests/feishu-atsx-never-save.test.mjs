/**
 * Offline state variations of the existing JS-confirmed Feishu ATSX fixture.
 * These tests add no site selectors or live DOM claims; resume edit is login-walled.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../src/content/feishu-atsx-basic.js', import.meta.url), 'utf8');
const fixture = readFileSync(new URL('./fixtures/feishu-atsx-basic-form.html', import.meta.url), 'utf8');
const ambiguousFixture = readFileSync(new URL('./fixtures/feishu-atsx-basic-ambiguous.html', import.meta.url), 'utf8');
const options = { synthetic: true };
const values = () => ({ allowExplicitValues: true, fullName: '测试甲', mobile: '13800138000', email: 'atsx.user@example.com' });

function boot(t, { html = fixture, url = 'http://127.0.0.1/feishu-atsx-basic-form.html' } = {}) {
  const dom = new JSDOM(html, { url, pretendToBeVisual: true, runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const { document } = dom.window;
  const actions = { clicks: 0, submits: 0, submitCalls: 0, requestSubmitCalls: 0 };
  for (const button of document.querySelectorAll('button')) button.disabled = false;
  document.addEventListener('click', () => { actions.clicks += 1; }, true);
  document.addEventListener('submit', (event) => { actions.submits += 1; event.preventDefault(); }, true);
  dom.window.HTMLFormElement.prototype.submit = () => { actions.submitCalls += 1; };
  dom.window.HTMLFormElement.prototype.requestSubmit = () => { actions.requestSubmitCalls += 1; };
  dom.window.chrome = { runtime: { onMessage: { addListener() {}, removeListener() {} } } };
  vm.runInContext(source, dom.getInternalVMContext());
  return { window: dom.window, document, api: dom.window.ResumeFeishuAtsxBasic, actions };
}

function input(document, name) {
  return document.querySelector(`input[name="${name}"]`);
}

function snapshot(document) {
  return [...document.querySelectorAll('input')].map((node) => ({ name: node.name, value: node.value }));
}

function assertNeverSave(result, actions) {
  assert.equal(result.saved, false);
  assert.equal(result.skippedSave, true);
  assert.equal(result.liveSupportClaimed, false);
  assert.deepEqual(actions, { clicks: 0, submits: 0, submitCalls: 0, requestSubmitCalls: 0 });
}

test('fixture basic fill and repeated occupied skip leave the neighbor and commit controls untouched', async (t) => {
  const { api, document, actions } = boot(t);
  assert.equal(api.liveSupportClaimed, false);
  const result = await api.fillBasic(values(), options);
  assert.equal(result.ok, true);
  assert.equal(result.writeAttempted, true);
  assert.equal(result.restored, false);
  assert.equal(input(document, 'fullName').value, '测试甲');
  assert.equal(input(document, 'mobile').value, '13800138000');
  assert.equal(input(document, 'email').value, 'atsx.user@example.com');
  assert.equal(input(document, 'years').value, '0');
  assertNeverSave(result, actions);

  let events = 0;
  for (const type of ['focus', 'input', 'change', 'blur']) document.addEventListener(type, () => { events += 1; }, true);
  const again = await api.fillBasic(values(), options);
  assert.equal(again.ok, true);
  assert.equal(again.writeAttempted, false);
  assert.ok(again.results.every((row) => row.reason === 'skipped_existing' && !row.writeAttempted));
  assert.equal(events, 0);
  assertNeverSave(again, actions);
});

test('occupied fields skip without focus or events while empty fields still fill', async (t) => {
  const { api, document, actions } = boot(t);
  input(document, 'fullName').value = '  KEEP-A  ';
  input(document, 'email').value = 'keep@example.com';
  let occupiedEvents = 0;
  for (const name of ['fullName', 'email']) {
    for (const type of ['focus', 'input', 'change', 'blur']) input(document, name).addEventListener(type, () => { occupiedEvents += 1; });
  }
  const result = await api.fillBasic(values(), options);
  assert.equal(result.ok, true);
  assert.equal(result.results[0].reason, 'skipped_existing');
  assert.equal(result.results[2].reason, 'skipped_existing');
  assert.equal(input(document, 'fullName').value, '  KEEP-A  ');
  assert.equal(input(document, 'email').value, 'keep@example.com');
  assert.equal(input(document, 'mobile').value, '13800138000');
  assert.equal(occupiedEvents, 0);
  assertNeverSave(result, actions);
});

test('prompt-looking text values are occupied because the fixture has no text sentinel contract', async (t) => {
  for (const existing of ['请选择', '请输入姓名', '请选择张三', '0', '--', '未填写', 'null', '\u200b']) {
    const { api, document, actions } = boot(t);
    for (const name of ['fullName', 'mobile']) input(document, name).value = existing;
    input(document, 'email').value = 'keep@example.com';
    const before = snapshot(document);
    const result = await api.fillBasic(values(), options);
    assert.equal(result.ok, true, existing);
    assert.equal(result.writeAttempted, false, existing);
    assert.ok(result.results.every((row) => row.reason === 'skipped_existing'), existing);
    assert.deepEqual(snapshot(document), before);
    assertNeverSave(result, actions);
  }
});

test('HTML placeholder attributes do not make empty text values occupied', async (t) => {
  const { api, document, actions } = boot(t);
  // Standard input state variation, not evidence of a live ATSX placeholder string.
  input(document, 'fullName').placeholder = '请输入姓名';
  const result = await api.fillBasic(values(), options);
  assert.equal(result.ok, true);
  assert.equal(input(document, 'fullName').value, '测试甲');
  assert.equal(input(document, 'fullName').placeholder, '请输入姓名');
  assertNeverSave(result, actions);
});

test('hidden targets stay manual while other editable fields fill', async (t) => {
  const variations = [
    (node) => { node.style.display = 'none'; },
    (node, control) => { node.style.visibility = 'hidden'; control.style.visibility = 'visible'; },
    (node) => { node.style.visibility = 'collapse'; },
    (node) => { node.hidden = true; node.style.display = 'block'; },
    (node) => { node.setAttribute('inert', ''); },
    (node) => { node.setAttribute('aria-hidden', 'true'); },
    (node) => { node.style.opacity = '0'; },
    (node) => { node.style.contentVisibility = 'hidden'; }
  ];
  for (const vary of variations) {
    const { api, document, actions } = boot(t);
    const control = input(document, 'mobile');
    vary(control.closest('.atsx-form-item-control'), control);
    const before = snapshot(document);
    const result = await api.fillBasic(values(), options);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'form_not_ready');
    assert.equal(result.writeAttempted, true);
    assert.equal(result.results[1].status, 'manual');
    assert.equal(input(document, 'mobile').value, before.find(row => row.name === 'mobile').value);
    assert.equal(input(document, 'fullName').value, values().fullName);
    assert.equal(input(document, 'email').value, values().email);
    assertNeverSave(result, actions);
  }
});

test('readonly and unsupported targets stay untouched while other fields fill', async (t) => {
  const variations = [
    (control) => { control.readOnly = true; },
    (control) => { control.disabled = true; },
    (control) => { control.closest('.atsx-form-item-control').setAttribute('aria-disabled', 'true'); },
    (control) => { control.closest('.atsx-form-item-control').setAttribute('aria-readonly', 'true'); },
    (control) => { control.type = 'password'; },
    (control) => { control.type = 'hidden'; },
    (control) => { control.type = 'number'; }
  ];
  for (const vary of variations) {
    const { api, document, actions } = boot(t);
    vary(input(document, 'mobile'));
    const before = snapshot(document);
    const result = await api.fillBasic(values(), options);
    assert.equal(result.ok, false);
    assert.equal(result.writeAttempted, true);
    assert.equal(result.results[1].reason, 'control_not_found');
    assert.equal(input(document, 'mobile').value, before.find(row => row.name === 'mobile').value);
    assert.equal(input(document, 'fullName').value, values().fullName);
    assert.equal(input(document, 'email').value, values().email);
    assertNeverSave(result, actions);
  }
});

test('existing ambiguous/missing fixture rejects with no writes or commit actions', async (t) => {
  const { api, document, actions } = boot(t, { html: ambiguousFixture });
  const before = snapshot(document);
  const result = await api.fillBasic(values(), options);
  assert.equal(result.ok, false);
  assert.equal(result.writeAttempted, false);
  assert.equal(result.results[0].reason, 'field_ambiguous');
  assert.equal(result.results[2].reason, 'item_not_found');
  assert.deepEqual(snapshot(document), before);
  assertNeverSave(result, actions);
});

test('direct text guards reject unsafe requests while batch wrong-page hints remain advisory', async (t) => {
  const { api, document, actions } = boot(t);
  const before = snapshot(document);
  for (const [label, value, reason] of [['工作年限', '9', 'label_not_allowed'], ['姓名', '  ', 'empty_value']]) {
    const result = await api.fillText(label, value, options);
    assert.equal(result.reason, reason);
    assert.equal(result.writeAttempted, false);
    assertNeverSave(result, actions);
  }
  const withoutSynthetic = await api.fillText('姓名', '测试甲');
  assert.equal(withoutSynthetic.reason, 'wrong_page');
  assert.equal(withoutSynthetic.writeAttempted, false);
  assertNeverSave(withoutSynthetic, actions);
  assert.deepEqual(snapshot(document), before);

  const wrong = boot(t, { url: 'https://example.com/feishu-atsx-basic-form.html' });
  const result = await wrong.api.fillBasic(values(), options);
  assert.equal(result.advisoryHints[0].reason, 'wrong_page');
  assert.equal(result.writeAttempted, true);
  assert.equal(input(wrong.document, 'fullName').value, values().fullName);
  assertNeverSave(result, wrong.actions);
});

test('focus-driven reactive fill wins and is skipped before a native write', async (t) => {
  const { api, document, actions } = boot(t);
  const control = input(document, 'fullName');
  let inputEvents = 0;
  control.addEventListener('focus', () => { control.value = 'REACTIVE-FOCUS'; });
  control.addEventListener('input', () => { inputEvents += 1; });
  const result = await api.fillBasic(values(), options);
  assert.equal(result.ok, true);
  assert.equal(result.results[0].reason, 'skipped_existing');
  assert.equal(result.results[0].writeAttempted, false);
  assert.equal(control.value, 'REACTIVE-FOCUS');
  assert.equal(inputEvents, 0);
  assertNeverSave(result, actions);
});

test('focus-driven hidden ancestors are rechecked before a native write', async (t) => {
  const { api, document, actions } = boot(t);
  const name = input(document, 'fullName');
  let events = 0;
  name.addEventListener('focus', () => { name.closest('.atsx-form-item-control').hidden = true; });
  name.addEventListener('input', () => { events += 1; });
  const result = await api.fillBasic(values(), options);
  assert.equal(result.ok, false);
  assert.equal(result.writeAttempted, false);
  assert.equal(result.results[0].reason, 'control_changed');
  assert.equal(result.results[1].reason, 'skipped_previous_failure');
  assert.equal(events, 0);
  assert.equal(name.value, '');
  assert.equal(input(document, 'mobile').value, '');
  assertNeverSave(result, actions);
});

test('reactive readback mismatch preserves the competing value and rolls back earlier owned writes', async (t) => {
  const { api, document, window, actions } = boot(t);
  const name = input(document, 'fullName');
  const phone = input(document, 'mobile');
  phone.addEventListener('input', () => { window.setTimeout(() => { phone.value = 'REACTIVE-PHONE'; }, 0); }, { once: true });
  const result = await api.fillBasic(values(), options);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'readback_mismatch');
  assert.equal(result.writeAttempted, true);
  assert.equal(result.restored, false);
  assert.equal(result.results[1].reason, 'readback_mismatch');
  assert.equal(result.results[2].reason, 'skipped_previous_failure');
  assert.equal(name.value, '');
  assert.equal(phone.value, 'REACTIVE-PHONE');
  assert.equal(input(document, 'email').value, '');
  assert.equal(result.restore.find((row) => row.label === '姓名').ok, true);
  assert.equal(result.restore.find((row) => row.label === '手机号码').reason, 'rollback_skipped_value_changed');
  assert.equal(input(document, 'years').value, '0');
  assertNeverSave(result, actions);
});

test('later field events cannot hide an earlier reactive winner behind a stale successful readback', async (t) => {
  const { api, document, actions } = boot(t);
  const name = input(document, 'fullName');
  input(document, 'email').addEventListener('input', () => { name.value = 'REACTIVE-LATE'; }, { once: true });
  const result = await api.fillBasic(values(), options);
  assert.equal(result.ok, false);
  assert.equal(result.results[0].reason, 'readback_mismatch');
  assert.equal(name.value, 'REACTIVE-LATE');
  assert.equal(input(document, 'mobile').value, '');
  assert.equal(input(document, 'email').value, '');
  assert.equal(result.restored, false);
  assertNeverSave(result, actions);
});

test('earlier field events replacing a later control stop filling and roll back only the original owned input', async (t) => {
  const { api, document, actions } = boot(t);
  const phone = input(document, 'mobile');
  input(document, 'fullName').addEventListener('input', () => {
    const replacement = phone.cloneNode(true);
    replacement.value = 'REACTIVE-REPLACEMENT';
    phone.replaceWith(replacement);
  }, { once: true });
  const result = await api.fillBasic(values(), options);
  assert.equal(result.ok, false);
  assert.equal(result.results[1].reason, 'control_changed');
  assert.equal(result.results[1].writeAttempted, false);
  assert.equal(result.results[2].reason, 'skipped_previous_failure');
  assert.equal(input(document, 'fullName').value, '');
  assert.equal(input(document, 'mobile').value, 'REACTIVE-REPLACEMENT');
  assert.equal(input(document, 'email').value, '');
  assert.equal(result.restored, true);
  assertNeverSave(result, actions);
});

test('failed fill restores exact raw whitespace in earlier owned controls', async (t) => {
  const { api, document, actions } = boot(t);
  input(document, 'fullName').value = '  ';
  input(document, 'mobile').addEventListener('input', () => { input(document, 'mobile').value = 'REACTIVE-PHONE'; }, { once: true });
  const result = await api.fillBasic(values(), options);
  assert.equal(result.ok, false);
  assert.equal(input(document, 'fullName').value, '  ');
  assert.equal(result.restore.find((row) => row.label === '姓名').ok, true);
  assertNeverSave(result, actions);
});

test('rollback restores exact original whitespace and reports a reactive rollback rejection accurately', async (t) => {
  const { api, document, actions } = boot(t);
  const name = input(document, 'fullName');
  name.value = '  ';
  name.addEventListener('input', () => { if (name.value === '  ') name.value = 'REACTIVE-RESTORE'; });
  input(document, 'mobile').addEventListener('input', () => { input(document, 'mobile').value = 'REACTIVE-PHONE'; }, { once: true });
  const result = await api.fillBasic(values(), options);
  assert.equal(result.ok, false);
  assert.equal(name.value, 'REACTIVE-RESTORE');
  assert.equal(result.restored, false);
  assert.equal(result.restore.find((row) => row.label === '姓名').ok, false);
  assertNeverSave(result, actions);
});

test('later cleanup events revalidate fields that were already restored', async (t) => {
  const { api, document, actions } = boot(t);
  const name = input(document, 'fullName');
  const phone = input(document, 'mobile');
  name.addEventListener('input', () => { if (name.value === '') phone.value = 'REACTIVE-CLEANUP'; });
  input(document, 'email').addEventListener('input', () => { input(document, 'email').value = 'reactive@example.com'; }, { once: true });
  const result = await api.fillBasic(values(), options);
  assert.equal(result.ok, false);
  assert.equal(result.restored, false);
  assert.equal(name.value, '');
  assert.equal(phone.value, 'REACTIVE-CLEANUP');
  assert.equal(result.restore.find((row) => row.label === '手机号码').ok, false);
  assertNeverSave(result, actions);
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
  const { api, document, actions } = boot(t);
  const control = document.querySelector('[name="fullName"]');
  const originalItem = control.closest(api.ITEM_SEL);
  let writes = 0;
  control.addEventListener('focus', () => { rebindFixtureItem(api, control); }, { once: true });
  control.addEventListener('input', () => { writes += 1; });
  const result = await api.fillBasic(values(), { synthetic: true });
  assertNeverSave(result, actions);
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
  const { api, document, actions } = boot(t);
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
  const result = await api.fillBasic(values(), { synthetic: true });
  assertNeverSave(result, actions);
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
  const { api, document, actions } = boot(t);
  const name = document.querySelector('[name="fullName"]');
  const mobile = document.querySelector('[name="mobile"]');
  let nameWrites = 0;
  name.addEventListener('input', () => { nameWrites += 1; });
  mobile.addEventListener('input', () => {
    mobile.value = 'REACTIVE-PHONE';
    rebindFixtureItem(api, name);
  }, { once: true });
  const result = await api.fillBasic(values(), { synthetic: true });
  assertNeverSave(result, actions);
  assert.equal(result.ok, false);
  assert.equal(result.restored, false);
  assert.equal(nameWrites, 1, 'the still-connected input no longer belongs to the original item');
  assert.equal(name.value, '测试甲');
  assert.equal(mobile.value, 'REACTIVE-PHONE');
  assert.equal(document.querySelector('[name="email"]').value, '');
  assert.equal(document.querySelector('[name="years"]').value, '0');
});

test('final readback detects same-input item rebind and rolls back only stable fields', async (t) => {
  const { api, document, actions } = boot(t);
  const name = document.querySelector('[name="fullName"]');
  const email = document.querySelector('[name="email"]');
  let nameWrites = 0;
  name.addEventListener('input', () => { nameWrites += 1; });
  email.addEventListener('input', () => { rebindFixtureItem(api, name); }, { once: true });
  const result = await api.fillBasic(values(), { synthetic: true });
  assertNeverSave(result, actions);
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
  const { api, document, actions } = boot(t);
  const name = document.querySelector('[name="fullName"]');
  const mobile = document.querySelector('[name="mobile"]');
  const email = document.querySelector('[name="email"]');
  email.addEventListener('input', () => { email.value = 'reactive@example.com'; }, { once: true });
  name.addEventListener('input', () => {
    if (name.value === '') rebindFixtureItem(api, mobile);
  });
  const result = await api.fillBasic(values(), { synthetic: true });
  assertNeverSave(result, actions);
  assert.equal(result.ok, false);
  assert.equal(result.restored, false);
  const restoredMobile = result.restore.find((row) => row.label === '手机号码');
  assert.equal(restoredMobile.ok, false, 'matching raw text does not prove the original field was restored');
  assert.equal(name.value, '');
  assert.equal(mobile.value, '');
  assert.equal(email.value, 'reactive@example.com');
  assert.equal(document.querySelector('[name="years"]').value, '0');
});

test('direct text cleanup refuses a change-event rebind and sends no stale blur', async (t) => {
  const { api, document, actions } = boot(t);
  const name = document.querySelector('[name="fullName"]');
  const events = [];
  for (const kind of ['input', 'change', 'blur']) {
    name.addEventListener(kind, () => { events.push(kind); });
  }
  name.addEventListener('change', () => { rebindFixtureItem(api, name); }, { once: true });
  const result = await api.fillText('姓名', '测试甲', { synthetic: true });
  assertNeverSave(result, actions);
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
