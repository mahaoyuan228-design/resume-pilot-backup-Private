/**
 * Offline Never-Save safety mutations of the existing provisional Beisen fixture.
 * This does not supply harvested live DOM or claim live Beisen support.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../src/content/beisen-2022-basic.js', import.meta.url), 'utf8');
const fixture = readFileSync(new URL('./fixtures/beisen-2022-basic-form.html', import.meta.url), 'utf8');
const ambiguousFixture = readFileSync(new URL('./fixtures/beisen-2022-basic-ambiguous.html', import.meta.url), 'utf8');
const options = { synthetic: true };
const values = {
  allowExplicitValues: true,
  fullName: '测试甲',
  mobile: '13800138000',
  email: 'beisen.user@example.com'
};

function boot(t, html = fixture) {
  const dom = new JSDOM(html, {
    url: 'http://127.0.0.1/beisen-fixture',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  const commits = { clicks: 0, submissions: 0 };
  // Enable the existing fixture buttons so the guard is stronger than disabled DOM.
  window.document.querySelectorAll('button').forEach((button) => { button.disabled = false; });
  window.document.addEventListener('click', () => { commits.clicks += 1; }, true);
  window.HTMLFormElement.prototype.submit = () => { commits.submissions += 1; };
  window.HTMLFormElement.prototype.requestSubmit = () => { commits.submissions += 1; };
  window.chrome = { runtime: { onMessage: { addListener() {}, removeListener() {} } } };
  window.eval(source);
  return { dom, window, document: window.document, api: window.ResumeBeisen2022Basic, commits };
}

function inputs(document) {
  return Object.fromEntries([...document.querySelectorAll('input')].map((input) => [input.name, input.value]));
}

function assertNeverSave(result, commits) {
  assert.equal(result.saved, false);
  assert.equal(result.skippedSave, true);
  assert.equal(result.liveSupportClaimed, false);
  assert.deepEqual(commits, { clicks: 0, submissions: 0 });
}

test('existing provisional fixture fills, preserves its neighbor, and skips a second occupied run', async (t) => {
  const { api, document, commits } = boot(t);
  assert.equal(api.liveSupportClaimed, false);
  const filled = await api.fillBasic(values, options);
  assertNeverSave(filled, commits);
  assert.equal(filled.ok, true);
  assert.equal(filled.writeAttempted, true);
  assert.deepEqual(inputs(document), {
    fullName: values.fullName, mobile: values.mobile, email: values.email, years: '0'
  });
  let events = 0;
  document.addEventListener('input', () => { events += 1; });
  document.addEventListener('change', () => { events += 1; });
  const repeated = await api.fillBasic({ ...values, fullName: '不应覆盖' }, options);
  assertNeverSave(repeated, commits);
  assert.equal(repeated.ok, true);
  assert.equal(repeated.writeAttempted, false);
  assert.ok(repeated.results.every((row) => row.reason === 'skipped_existing' && row.writeAttempted === false));
  assert.equal(document.querySelector('[name="fullName"]').value, values.fullName);
  assert.equal(events, 0);
});

test('all nonempty text is occupied, including zero and prompt-looking values', async (t) => {
  const { api, document, commits } = boot(t);
  const input = document.querySelector('[name="fullName"]');
  let events = 0;
  input.addEventListener('input', () => { events += 1; });
  input.addEventListener('change', () => { events += 1; });
  for (const value of ['KEEP', '0', '\u200b', '\u200c', '\u200d', '请选择', '请选择姓名', '请选择姓名（已填写）', '请填写姓名']) {
    input.value = value;
    input.placeholder = value;
    const result = await api.fillText('姓名', values.fullName, options);
    assertNeverSave(result, commits);
    assert.equal(result.ok, true, value);
    assert.equal(result.reason, 'skipped_existing', value);
    assert.equal(result.writeAttempted, false, value);
    assert.equal(input.value, value);
  }
  assert.equal(events, 0);
});

test('placeholder attributes on an empty existing input do not count as a value', async (t) => {
  const { api, document, commits } = boot(t);
  const input = document.querySelector('[name="fullName"]');
  input.placeholder = '请填写姓名';
  const result = await api.fillText('姓名', values.fullName, options);
  assertNeverSave(result, commits);
  assert.equal(result.ok, true);
  assert.equal(result.reason, 'matched');
  assert.equal(input.value, values.fullName);
  assert.equal(input.placeholder, '请填写姓名');
});

test('ancestor-hidden controls fail preflight before any field is written', async (t) => {
  for (const mutation of [
    (node) => { node.hidden = true; },
    (node) => { node.style.display = 'none'; },
    (node) => { node.style.visibility = 'hidden'; },
    (node) => { node.style.visibility = 'collapse'; },
    (node) => { node.style.opacity = '0'; },
    (node) => { node.style.contentVisibility = 'hidden'; },
    (node) => { node.setAttribute('aria-hidden', 'true'); },
    (node) => { node.setAttribute('inert', ''); }
  ]) {
    const { api, document, commits } = boot(t);
    const input = document.querySelector('[name="mobile"]');
    mutation(input.parentElement);
    input.style.visibility = 'visible';
    input.style.display = 'block';
    const before = inputs(document);
    const result = await api.fillBasic(values, options);
    assertNeverSave(result, commits);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'form_not_ready');
    assert.equal(result.writeAttempted, false);
    assert.equal(result.results.find((row) => row.label === '手机号码').reason, 'control_not_found');
    assert.deepEqual(inputs(document), before);
  }
});

test('readonly, disabled, and non-text input drift fail without writes', async (t) => {
  for (const mutation of [
    (input) => { input.readOnly = true; },
    (input) => { input.disabled = true; },
    ...['hidden', 'checkbox', 'radio', 'password', 'number', 'date', 'submit'].map((type) => (input) => { input.type = type; })
  ]) {
    const { api, document, commits } = boot(t);
    mutation(document.querySelector('[name="fullName"]'));
    const before = inputs(document);
    const result = await api.fillBasic(values, options);
    assertNeverSave(result, commits);
    assert.equal(result.ok, false);
    assert.equal(result.writeAttempted, false);
    assert.equal(result.results[0].reason, 'control_not_found');
    assert.deepEqual(inputs(document), before);
  }
});

test('direct text API refuses empty values, unknown labels, neighbors, and wrong hosts', async (t) => {
  const { api, document, dom, commits } = boot(t);
  for (const [label, value, reason] of [
    ['姓名', '  ', 'empty_value'], ['工作年限', '9', 'label_not_allowed'], ['未知字段', 'x', 'label_not_allowed']
  ]) {
    const result = await api.fillText(label, value, options);
    assertNeverSave(result, commits);
    assert.equal(result.ok, false);
    assert.equal(result.reason, reason);
    assert.equal(result.writeAttempted, false);
  }
  dom.reconfigure({ url: 'https://example.com/beisen-fixture' });
  const result = await api.fillText('姓名', values.fullName, options);
  assertNeverSave(result, commits);
  assert.equal(result.reason, 'wrong_page');
  const batch = await api.fillBasic(values, options);
  assertNeverSave(batch, commits);
  assert.equal(batch.writeAttempted, false);
  assert.deepEqual(inputs(document), { fullName: '', mobile: '', email: '', years: '0' });
});

test('existing ambiguous fixture and unconfirmed profiles remain read-only', async (t) => {
  const { api, document, commits } = boot(t, ambiguousFixture);
  const before = inputs(document);
  const ambiguous = await api.fillBasic(values, options);
  assertNeverSave(ambiguous, commits);
  assert.equal(ambiguous.reason, 'form_not_ready');
  assert.equal(ambiguous.writeAttempted, false);
  assert.equal(ambiguous.results[0].reason, 'field_ambiguous');
  const unconfirmed = await api.fillBasic({
    profile: { fullName: values.fullName, phone: values.mobile, email: values.email, confirmedFields: ['fullName'] }
  }, options);
  assertNeverSave(unconfirmed, commits);
  assert.equal(unconfirmed.reason, 'profile_fields_unavailable');
  assert.equal(unconfirmed.writeAttempted, false);
  assert.deepEqual(inputs(document), before);
});

test('reactive population on focus wins without an input or change write', async (t) => {
  const { api, document, commits } = boot(t);
  const input = document.querySelector('[name="fullName"]');
  let events = 0;
  input.addEventListener('focus', () => { input.value = 'REACTIVE-FOCUS'; });
  input.addEventListener('input', () => { events += 1; });
  input.addEventListener('change', () => { events += 1; });
  const result = await api.fillText('姓名', values.fullName, options);
  assertNeverSave(result, commits);
  assert.equal(result.reason, 'skipped_existing');
  assert.equal(result.writeAttempted, false);
  assert.equal(input.value, 'REACTIVE-FOCUS');
  assert.equal(events, 0);
});

test('reactive takeover rolls back earlier owned writes while preserving the competing value', async (t) => {
  const { api, document, commits } = boot(t);
  document.querySelector('[name="fullName"]').value = '  ';
  const mobile = document.querySelector('[name="mobile"]');
  mobile.addEventListener('input', () => { mobile.value = 'REACTIVE-PHONE'; });
  const result = await api.fillBasic(values, options);
  assertNeverSave(result, commits);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'readback_mismatch');
  assert.equal(result.writeAttempted, true);
  assert.equal(result.restored, false);
  assert.equal(result.results.find((row) => row.label === '邮箱').reason, 'skipped_after_failure');
  assert.equal(result.restore.find((row) => row.label === '姓名').restored, true);
  assert.equal(result.restore.find((row) => row.label === '手机号码').reason, 'competing_value_preserved');
  assert.deepEqual(inputs(document), { fullName: '  ', mobile: 'REACTIVE-PHONE', email: '', years: '0' });
});

test('final batch readback catches a late reactive change to an earlier field', async (t) => {
  const { api, document, commits } = boot(t);
  const fullName = document.querySelector('[name="fullName"]');
  document.querySelector('[name="email"]').addEventListener('input', () => { fullName.value = 'LATE-REACTIVE'; });
  const result = await api.fillBasic(values, options);
  assertNeverSave(result, commits);
  assert.equal(result.ok, false);
  assert.equal(result.results[0].reason, 'readback_mismatch');
  assert.equal(result.restored, false);
  assert.deepEqual(inputs(document), { fullName: 'LATE-REACTIVE', mobile: '', email: '', years: '0' });
});

test('post-write visibility drift restores the raw owned value without continuing the fill', async (t) => {
  const { api, document, commits } = boot(t);
  const input = document.querySelector('[name="fullName"]');
  input.value = ' \t ';
  input.addEventListener('input', () => { input.parentElement.hidden = true; });
  const result = await api.fillBasic(values, options);
  assertNeverSave(result, commits);
  assert.equal(result.ok, false);
  assert.equal(result.restored, true);
  assert.equal(result.results[0].reason, 'readback_mismatch');
  assert.deepEqual(inputs(document), { fullName: ' \t ', mobile: '', email: '', years: '0' });
});

test('a later control replaced after preflight is never written', async (t) => {
  const { api, document, commits } = boot(t);
  let replacementWrites = 0;
  document.querySelector('[name="fullName"]').addEventListener('input', () => {
    const mobile = document.querySelector('[name="mobile"]');
    const replacement = mobile.cloneNode(true);
    replacement.addEventListener('input', () => { replacementWrites += 1; });
    mobile.replaceWith(replacement);
  }, { once: true });
  const result = await api.fillBasic(values, options);
  assertNeverSave(result, commits);
  assert.equal(result.ok, false);
  assert.equal(result.results.find((row) => row.label === '手机号码').reason, 'control_changed_before_write');
  assert.equal(result.results.find((row) => row.label === '手机号码').writeAttempted, false);
  assert.equal(result.restored, true);
  assert.equal(replacementWrites, 0);
  assert.deepEqual(inputs(document), { fullName: '', mobile: '', email: '', years: '0' });
});

test('rollback reports a competing value introduced by a later cleanup event', async (t) => {
  const { api, document, commits } = boot(t);
  const fullName = document.querySelector('[name="fullName"]');
  const mobile = document.querySelector('[name="mobile"]');
  const email = document.querySelector('[name="email"]');
  fullName.addEventListener('input', () => {
    if (fullName.value === '') mobile.value = 'ROLLBACK-REACTIVE';
  });
  email.addEventListener('input', () => { email.value = 'EMAIL-REACTIVE'; });
  const result = await api.fillBasic(values, options);
  assertNeverSave(result, commits);
  assert.equal(result.ok, false);
  assert.equal(result.restored, false);
  const restoredMobile = result.restore.find((row) => row.label === '手机号码');
  assert.equal(restoredMobile.restored, false);
  assert.equal(restoredMobile.reason, 'restore_readback_mismatch');
  assert.deepEqual(inputs(document), { fullName: '', mobile: 'ROLLBACK-REACTIVE', email: 'EMAIL-REACTIVE', years: '0' });
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
  const { api, document, commits } = boot(t);
  const control = document.querySelector('[name="fullName"]');
  const originalItem = control.closest(api.ITEM_SEL);
  let writes = 0;
  control.addEventListener('focus', () => { rebindFixtureItem(api, control); }, { once: true });
  control.addEventListener('input', () => { writes += 1; });
  const result = await api.fillBasic(values, { synthetic: true });
  assertNeverSave(result, commits);
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
  const { api, document, commits } = boot(t);
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
  assertNeverSave(result, commits);
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
  const { api, document, commits } = boot(t);
  const name = document.querySelector('[name="fullName"]');
  const mobile = document.querySelector('[name="mobile"]');
  let nameWrites = 0;
  name.addEventListener('input', () => { nameWrites += 1; });
  mobile.addEventListener('input', () => {
    mobile.value = 'REACTIVE-PHONE';
    rebindFixtureItem(api, name);
  }, { once: true });
  const result = await api.fillBasic(values, { synthetic: true });
  assertNeverSave(result, commits);
  assert.equal(result.ok, false);
  assert.equal(result.restored, false);
  assert.equal(nameWrites, 1, 'the still-connected input no longer belongs to the original item');
  assert.equal(name.value, '测试甲');
  assert.equal(mobile.value, 'REACTIVE-PHONE');
  assert.equal(document.querySelector('[name="email"]').value, '');
  assert.equal(document.querySelector('[name="years"]').value, '0');
});

test('final readback detects same-input item rebind and rolls back only stable fields', async (t) => {
  const { api, document, commits } = boot(t);
  const name = document.querySelector('[name="fullName"]');
  const email = document.querySelector('[name="email"]');
  let nameWrites = 0;
  name.addEventListener('input', () => { nameWrites += 1; });
  email.addEventListener('input', () => { rebindFixtureItem(api, name); }, { once: true });
  const result = await api.fillBasic(values, { synthetic: true });
  assertNeverSave(result, commits);
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
  const { api, document, commits } = boot(t);
  const name = document.querySelector('[name="fullName"]');
  const mobile = document.querySelector('[name="mobile"]');
  const email = document.querySelector('[name="email"]');
  email.addEventListener('input', () => { email.value = 'reactive@example.com'; }, { once: true });
  name.addEventListener('input', () => {
    if (name.value === '') rebindFixtureItem(api, mobile);
  });
  const result = await api.fillBasic(values, { synthetic: true });
  assertNeverSave(result, commits);
  assert.equal(result.ok, false);
  assert.equal(result.restored, false);
  const restoredMobile = result.restore.find((row) => row.label === '手机号码');
  assert.equal(restoredMobile.restored, false, 'matching raw text does not prove the original field was restored');
  assert.equal(name.value, '');
  assert.equal(mobile.value, '');
  assert.equal(email.value, 'reactive@example.com');
  assert.equal(document.querySelector('[name="years"]').value, '0');
});

test('direct text cleanup refuses a change-event rebind and sends no stale blur', async (t) => {
  const { api, document, commits } = boot(t);
  const name = document.querySelector('[name="fullName"]');
  const events = [];
  for (const kind of ['input', 'change', 'blur']) {
    name.addEventListener(kind, () => { events.push(kind); });
  }
  name.addEventListener('change', () => { rebindFixtureItem(api, name); }, { once: true });
  const result = await api.fillText('姓名', '测试甲', { synthetic: true });
  assertNeverSave(result, commits);
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
