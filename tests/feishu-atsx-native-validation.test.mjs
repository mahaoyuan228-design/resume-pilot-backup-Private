// Native validation on existing fixture inputs only; no new DOM or live claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../src/content/feishu-atsx-basic.js', import.meta.url), 'utf8');
const fixture = readFileSync(new URL('./fixtures/feishu-atsx-basic-form.html', import.meta.url), 'utf8');
const options = { synthetic: true };
const values = { allowExplicitValues: true, fullName: '测试甲', mobile: '13800138000', email: 'valid@example.com' };

function boot(t) {
  const dom = new JSDOM(fixture, { url: 'http://127.0.0.1/fixture', pretendToBeVisual: true, runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const { document } = dom.window;
  const actions = { click: 0, submit: 0, submitCall: 0, requestSubmit: 0, invalid: 0, checkValidity: 0, reportValidity: 0 };
  const events = [];
  for (const button of document.querySelectorAll('button')) button.disabled = false;
  for (const kind of ['click', 'submit', 'invalid']) document.addEventListener(kind, (event) => {
    actions[kind] += 1;
    event.preventDefault();
  }, true);
  for (const kind of ['focus', 'input', 'change', 'blur']) document.addEventListener(kind, (event) => {
    events.push({ kind, name: event.target.name });
  }, true);
  dom.window.HTMLFormElement.prototype.submit = () => { actions.submitCall += 1; };
  dom.window.HTMLFormElement.prototype.requestSubmit = () => { actions.requestSubmit += 1; };
  for (const proto of [dom.window.HTMLInputElement.prototype, dom.window.HTMLFormElement.prototype]) {
    for (const method of ['checkValidity', 'reportValidity']) proto[method] = () => { actions[method] += 1; return false; };
  }
  dom.window.chrome = { runtime: { onMessage: { addListener() {}, removeListener() {} } } };
  vm.runInContext(source, dom.getInternalVMContext());
  const controls = Object.fromEntries(['fullName', 'mobile', 'email', 'years'].map((name) => [name, document.querySelector('input[name="' + name + '"]')]));
  const snapshot = () => [...document.querySelectorAll('input')].map((node) => [node.name, node.value]);
  return { api: dom.window.ResumeFeishuAtsxBasic, controls, events, actions, snapshot };
}

function safe(result, actions) {
  assert.equal(result.saved, false);
  assert.equal(result.skippedSave, true);
  assert.equal(result.liveSupportClaimed, false);
  assert.ok(Object.values(actions).every((count) => count === 0), JSON.stringify(actions));
}

test('direct malformed email is refused without focus, validation events, or writes', async (t) => {
  const { api, controls, events, actions, snapshot } = boot(t);
  assert.equal(controls.email.type, 'email', 'constraint comes from the unchanged fixture');
  const before = snapshot();
  for (const email of ['not-an-email', 'one@example.com,two@example.com']) {
    const candidate = controls.email.cloneNode(false);
    candidate.value = email;
    assert.equal(candidate.validity.typeMismatch, true);
    const result = await api.fillText('邮箱', email, options);
    safe(result, actions);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'native_validation_failed');
    assert.equal(result.writeAttempted, false);
    assert.deepEqual(snapshot(), before);
    assert.deepEqual(events, []);
  }
});

for (const mode of ['explicit', 'confirmed profile']) {
  test(mode + ' invalid email refuses the whole batch before writing earlier fields', async (t) => {
    const { api, events, actions, snapshot } = boot(t);
    const before = snapshot();
    const invalid = mode === 'explicit'
      ? { ...values, email: 'not-an-email' }
      : { profile: { fullName: values.fullName, phone: values.mobile, email: 'not-an-email', confirmedFields: ['fullName', 'phone', 'email'] } };
    const result = await api.fillBasic(invalid, options);
    safe(result, actions);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'form_not_ready');
    assert.equal(result.writeAttempted, false);
    assert.equal(result.results.find((row) => row.label === '邮箱').reason, 'native_validation_failed');
    assert.deepEqual(snapshot(), before);
    assert.deepEqual(events, []);
  });
}

test('occupied invalid email remains a soft skip while valid empty neighbors fill', async (t) => {
  const { api, controls, events, actions } = boot(t);
  controls.email.value = 'KEEP-EXISTING-INVALID';
  controls.email.setCustomValidity('Existing site validation state');
  const result = await api.fillBasic({ ...values, email: 'also-invalid' }, options);
  safe(result, actions);
  assert.equal(result.ok, true);
  assert.equal(result.results.find((row) => row.label === '邮箱').reason, 'skipped_existing');
  assert.equal(controls.email.value, 'KEEP-EXISTING-INVALID');
  assert.equal(controls.email.validity.customError, true);
  assert.equal(controls.fullName.value, values.fullName);
  assert.equal(controls.mobile.value, values.mobile);
  assert.equal(controls.years.value, '0');
  assert.deepEqual(events.filter((event) => event.name === 'email'), []);
});

test('browser-valid short domain and unconstrained telephone require no invented format rule', async (t) => {
  const { api, controls, actions } = boot(t);
  const result = await api.fillBasic({ ...values, email: 'a@b', mobile: '+44 20 7946 0958' }, options);
  safe(result, actions);
  assert.equal(result.ok, true);
  assert.equal(controls.email.value, 'a@b');
  assert.equal(controls.email.validity.valid, true);
  assert.equal(controls.mobile.value, '+44 20 7946 0958');
  assert.equal(controls.years.value, '0');
});

test('existing native custom error on an empty input refuses preflight without validation events', async (t) => {
  const { api, controls, events, actions, snapshot } = boot(t);
  controls.email.setCustomValidity('Site refusal');
  const before = snapshot();
  const result = await api.fillBasic(values, options);
  safe(result, actions);
  assert.equal(result.ok, false);
  assert.equal(result.writeAttempted, false);
  assert.equal(result.results.find((row) => row.label === '邮箱').reason, 'native_validation_failed');
  assert.deepEqual(snapshot(), before);
  assert.deepEqual(events, []);
});

test('native refusal introduced by focus stops the direct write', async (t) => {
  const { api, controls, events, actions, snapshot } = boot(t);
  const before = snapshot();
  controls.email.addEventListener('focus', () => controls.email.setCustomValidity('Focus refusal'), { once: true });
  const result = await api.fillText('邮箱', values.email, options);
  safe(result, actions);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'native_validation_failed');
  assert.equal(result.writeAttempted, false);
  assert.deepEqual(snapshot(), before);
  assert.deepEqual(events.map((event) => event.kind), ['focus']);
});

test('native refusal with unchanged text stops the batch and uses existing owned rollback', async (t) => {
  const { api, controls, events, actions, snapshot } = boot(t);
  const before = snapshot();
  controls.mobile.addEventListener('input', () => controls.mobile.setCustomValidity('Input refusal'), { once: true });
  const result = await api.fillBasic(values, options);
  safe(result, actions);
  assert.equal(result.ok, false);
  assert.equal(result.writeAttempted, true);
  assert.equal(result.results.find((row) => row.label === '手机号码').reason, 'native_validation_failed');
  assert.equal(result.restored, true);
  assert.deepEqual(snapshot(), before);
  assert.deepEqual(events.filter((event) => event.name === 'email'), []);
});

test('final readback catches a late native refusal of an earlier written field', async (t) => {
  const { api, controls, actions, snapshot } = boot(t);
  const before = snapshot();
  controls.email.addEventListener('input', () => controls.fullName.setCustomValidity('Late refusal'), { once: true });
  const result = await api.fillBasic(values, options);
  safe(result, actions);
  assert.equal(result.ok, false);
  assert.equal(result.results.find((row) => row.label === '姓名').reason, 'native_validation_failed');
  assert.equal(result.restored, true);
  assert.deepEqual(snapshot(), before);
});
