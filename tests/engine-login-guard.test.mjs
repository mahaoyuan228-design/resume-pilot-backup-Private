import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { writeControlInPage } from '../src/background/controls-write.mjs';

const sources = ['src/core/matcher.js', 'src/content/engine.js'].map(path =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const profile = { fullName: 'OFFLINE_NAME', phone: '00000000000', email: 'offline@example.test',
  confirmedFields: ['fullName', 'phone', 'email'] };
const phone = '<label>手机号码<input id="phone" type="tel"></label>';
const name = '<label>姓名<input id="name"></label>';

function boot(t, markup, { enabled = false, onBinding } = {}) {
  const dom = new JSDOM(`<!doctype html><body>${markup}</body>`, {
    url: 'https://fixture.example.test/resume', pretendToBeVisual: true, runScripts: 'outside-only',
  });
  t.after(() => dom.window.close());
  const { window } = dom, { document } = window;
  window.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  window.getComputedStyle = () => ({ display: 'block', visibility: 'visible' });
  let listener, effects = 0, assignments = 0, bindingChecks = 0, bridgeWrites = 0;
  for (const event of ['click', 'input', 'change', 'blur', 'submit', 'pointerdown', 'keydown'])
    document.addEventListener(event, () => { effects++; }, true);
  const original = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
  Object.defineProperty(window.HTMLInputElement.prototype, 'value', { ...original, set(value) {
    assignments++;
    original.set.call(this, value);
  } });
  window.fetch = () => { throw Error('unexpected_network'); };
  window.HTMLFormElement.prototype.submit = () => { throw Error('unexpected_submit'); };
  window.HTMLFormElement.prototype.requestSubmit = () => { throw Error('unexpected_submit'); };
  window.chrome = { storage: { local: { async get() {
    return enabled ? { resumeAtsEngineWriteEnabled: true } : {};
  } } }, runtime: { id: 'fixture', onMessage: { addListener(value) { listener = value; } },
    async sendMessage(message) {
      if (message.type === 'RESUME_ATS_CONTROL_CANDIDATES') return {
        ok: true, mode: 'candidates', candidates: [], writeStarted: false, liveSupportClaimed: false,
      };
      if (message.type === 'RESUME_ATS_CONTROL_WRITE') {
        bridgeWrites++;
        throw Error('unexpected_login_bridge_write');
      }
      assert.equal(message.type, 'RESUME_PROFILE_BINDING_CHECK');
      onBinding?.(++bindingChecks, window);
      return { allowed: true };
    } } };
  for (const source of sources) window.eval(source);
  return { window, document, get effects() { return effects; }, get assignments() { return assignments; },
    get bridgeWrites() { return bridgeWrites; }, async request(type) {
      const result = await new Promise(resolve => listener({ type, profile, profileBinding: {} }, { id: 'fixture' }, resolve));
      assert.equal(result.ok, true, result.error);
      return result.data;
    } };
}

const signals = [
  ['password', '<input type="password">'],
  ['hidden password', '<input type="password" hidden>'],
  ['OTP autocomplete', '<input autocomplete="one-time-code">'],
  ['captcha data wrapper', '<div data-captcha><input></div>'],
  ['captcha class wrapper', '<div class="GateCaptcha"><input></div>'],
  ['captcha id wrapper', '<div id="CaptchaPanel"><input></div>'],
  ['captcha name wrapper', '<div name="CaptchaAnswer"><input></div>'],
  ['verification label', '<label>验证码<input></label>'],
  ['verification placeholder', '<input placeholder="请输入验证码">'],
  ['verification aria label', '<input aria-label="Verification code">'],
  ['verification labelledby', '<span id="challenge">验证码</span><input aria-labelledby="challenge">'],
  ['form-item verification label', '<div class="ant-form-item"><div class="ant-form-item-label"><label>验证码</label></div><input></div>'],
  ['send code button', '<button type="button">获取验证码</button>'],
  ['resend code button', '<button type="button">重新发送验证码(60秒)</button>'],
  ['login button', '<button type="button">登 录</button>'],
  ['login submit input', '<input type="submit" value="登录">'],
  ['ARIA button', '<div role="button" aria-label="Sign in"></div>'],
];

function bootMain(t, markup, { onPlan, onWrite, onAfterValue } = {}) {
  const dom = new JSDOM(`<!doctype html><body>${markup}</body>`, {
    url: 'https://fixture.example.test/resume', pretendToBeVisual: true, runScripts: 'outside-only',
  });
  t.after(() => dom.window.close());
  const { window } = dom, { document } = window;
  let assignments = 0, events = 0;
  const original = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
  Object.defineProperty(window.HTMLInputElement.prototype, 'value', { ...original, set(value) {
    assignments++;
    original.set.call(this, value);
  } });
  for (const type of ['input', 'change', 'click', 'submit']) document.addEventListener(type, () => events++, true);
  const adapter = { name: 'offline-text', type: 'text', readModel: element => ({
    controlRoot: element, version: 1, available: true, disabled: false, readonly: false,
  }), async write(element, plan, { check }) {
    await Promise.resolve();
    onWrite?.(window);
    await check();
    element.value = profile.fullName;
    onAfterValue?.(window);
    await check();
    element.dispatchEvent(new window.Event('input', { bubbles: true }));
    return { status: 'success' };
  }, async verify() { return { status: 'success' }; } };
  window.ResumeControls = { version: 1, liveSupportClaimed: false, resolve: () => adapter,
    plan() { onPlan?.(window); return { status: 'planned', adapter: adapter.name }; } };
  window.ResumeControlModel = { resolve: () => ({ framework: 'native', vm: null, componentType: 'input' }) };
  const write = window.eval(`(${writeControlInPage.toString()})`);
  return { document, get assignments() { return assignments; }, get events() { return events; },
    run: (selector = '#name') => write({ selector, expectedUrl: window.location.href,
      timeOrigin: window.performance.timeOrigin, value: profile.fullName, path: 'fullName', profileBinding: {} }) };
}

for (const [kind, signal] of signals) test(`MAIN independently blocks login ${kind} before any write`, async t => {
  const f = bootMain(t, `<form>${phone}${name}${signal}</form>`);
  const result = await f.run();
  assert.equal(result.reason, 'login_form_detected');
  assert.equal(result.writeStarted, false);
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(f.assignments, 0);
  assert.equal(f.events, 0);
});

for (const tag of ['section', 'fieldset', 'article', 'div role="form"', 'div role="region"', 'div role="dialog"',
  'div role="group"', 'div class="section"', 'div class="form-section"', 'div data-section="login"', 'div'])
  test(`MAIN keeps independent resume forms writable beside login ${tag}`, async t => {
    const end = tag.split(' ')[0];
    const f = bootMain(t, `<${tag}>${phone}<div><input type="password"></div></${end}><form>${name}</form>`);
    const blocked = await f.run('#phone');
    assert.equal(blocked.reason, 'login_form_detected');
    assert.equal(f.assignments, 0);
    const resume = await f.run();
    assert.equal(resume.status, 'success');
    assert.equal(f.assignments, 1);
    assert.equal(f.events, 1);
  });

test('MAIN handles native form= owners without blocking a neighboring form', async t => {
  const f = bootMain(t, '<form id="login"><input type="password"></form><label>手机号码<input id="phone" form="login"></label>'
    + `<form>${name}</form>`);
  assert.equal((await f.run('#phone')).reason, 'login_form_detected');
  assert.equal(f.assignments, 0);
  assert.equal((await f.run()).status, 'success');
  assert.equal(f.assignments, 1);
});

for (const main of [false, true]) test(`a semantic login region protects a nested native form from its external login action (MAIN ${main})`, async t => {
  const markup = `<section><form>${phone}</form><button type="button">登录</button></section><form>${name}</form>`;
  if (main) {
    const f = bootMain(t, markup);
    assert.equal((await f.run('#phone')).reason, 'login_form_detected');
    assert.equal(f.assignments, 0);
    assert.equal((await f.run()).status, 'success');
    assert.equal(f.assignments, 1);
  } else {
    const f = boot(t, markup);
    const result = await f.request('RESUME_FILL');
    assert.equal(result.fields.find(row => row.id === 'phone').reason, 'login_form_detected');
    assert.equal(result.fields.find(row => row.id === 'name').status, 'verified');
    assert.equal(f.document.getElementById('phone').value, '');
    assert.equal(f.assignments, 1);
  }
});

for (const main of [false, true]) test(`one ARIA form protects sibling groups while an independent ARIA form remains writable (MAIN ${main})`, async t => {
  const markup = `<div role="form"><div role="group">${name}${phone}</div>`
    + '<div role="group"><input type="password"></div></div>'
    + '<div role="form"><div role="group"><label>姓名<input id="resume"></label></div></div>';
  if (main) {
    const f = bootMain(t, markup);
    for (const selector of ['#name', '#phone']) assert.equal((await f.run(selector)).reason, 'login_form_detected');
    assert.equal(f.assignments, 0);
    assert.equal(f.events, 0);
    assert.equal((await f.run('#resume')).status, 'success');
    assert.equal(f.assignments, 1);
  } else {
    const f = boot(t, markup);
    const result = await f.request('RESUME_FILL');
    for (const id of ['name', 'phone']) {
      assert.equal(result.fields.find(row => row.id === id).reason, 'login_form_detected');
      assert.equal(f.document.getElementById(id).value, '');
    }
    assert.equal(result.fields.find(row => row.id === 'resume').status, 'verified');
    assert.equal(f.document.getElementById('resume').value, profile.fullName);
    assert.equal(f.assignments, 1);
    assert.equal(f.effects, 3);
  }
});

const addPassword = window => {
  const password = window.document.createElement('input');
  password.type = 'password';
  window.document.querySelector('form').append(password);
};
for (const phase of ['onPlan', 'onWrite', 'onAfterValue']) test(`MAIN rechecks a login signal appearing during ${phase}`, async t => {
  const f = bootMain(t, `<form>${name}</form>`, { [phase]: addPassword });
  const result = await f.run();
  assert.equal(result.reason, 'login_form_detected');
  assert.equal(result.status, 'unsupported');
  assert.equal(f.assignments, phase === 'onAfterValue' ? 1 : 0);
  assert.equal(f.events, 0);
});

for (const enabled of [false, true]) for (const [kind, signal] of signals)
  test(`login ${kind} blocks every field in its form with zero effects (opt-in ${enabled})`, async t => {
    const f = boot(t, `<form>${phone}${name}${signal}</form>`, { enabled });
    for (const type of ['RESUME_INSPECT', 'RESUME_FILL']) {
      const data = await f.request(type);
      for (const id of ['phone', 'name']) {
        const field = data.fields.find(row => row.id === id);
        assert.ok(field, id);
        assert.equal(field.reason, 'login_form_detected');
        assert.equal(field.semanticStatus, 'manual');
        assert.equal(field.path, undefined);
        assert.equal(field.mappingContext, undefined);
        if (type === 'RESUME_FILL') assert.equal(field.status, 'skipped');
        assert.equal(f.document.getElementById(id).value, '');
      }
      const hint = data.advisoryHints.find(row => row.reason === 'login_form_detected');
      assert.equal(hint.message, '请先登录');
      assert.equal(hint.advisory, true);
      assert.equal(hint.blocking, false);
      assert.equal(hint.liveSupportClaimed, false);
      assert.equal(f.effects, 0);
      assert.equal(f.assignments, 0);
      assert.equal(f.bridgeWrites, 0);
    }
  });

for (const tag of ['section', 'fieldset', 'article', 'div role="form"', 'div role="region"', 'div role="dialog"',
  'div role="group"', 'div class="section"', 'div class="form-section"', 'div data-section="login"', 'div'])
  test(`form-less login ${tag} keeps an independent resume form writable`, async t => {
    const end = tag.split(' ')[0];
    const f = boot(t, `<${tag}>${phone}<div><input type="password"></div></${end}><form>${name}</form>`);
    const result = await f.request('RESUME_FILL');
    assert.equal(result.fields.find(row => row.id === 'phone').reason, 'login_form_detected');
    assert.equal(f.document.getElementById('phone').value, '');
    assert.equal(result.fields.find(row => row.id === 'name').status, 'verified');
    assert.equal(f.document.getElementById('name').value, profile.fullName);
    assert.equal(f.assignments, 1);
    assert.equal(f.effects, 3);
    assert.equal(result.softwareClickedSubmit, false);
    assert.equal(result.liveSupportClaimed, false);
  });

test('a login form cannot contaminate a separate form-less resume region', async t => {
  const f = boot(t, `<div>${phone}<button type="button">登录</button></div><section>${name}</section>`);
  const result = await f.request('RESUME_FILL');
  assert.equal(result.fields.find(row => row.id === 'phone').reason, 'login_form_detected');
  assert.equal(result.fields.find(row => row.id === 'name').status, 'verified');
  assert.equal(f.document.getElementById('phone').value, '');
  assert.equal(f.document.getElementById('name').value, profile.fullName);
});

test('a header login navigation action does not claim a resume form', async t => {
  const f = boot(t, `<header><button type="button">登录</button></header><form>${name}</form>`);
  const result = await f.request('RESUME_FILL');
  assert.equal(result.fields.find(row => row.id === 'name').status, 'verified');
  assert.equal(f.document.getElementById('name').value, profile.fullName);
});

for (const main of [false, true]) for (const navigation of ['header', 'nav', 'div role="navigation"'])
  for (const resume of ['div role="group" aria-label="基本信息"', 'div class="section"',
    'div class="form-section"', 'div data-section="basic"', 'div'])
    test(`navigation ${navigation} cannot borrow an editor from ${resume} (MAIN ${main})`, async t => {
      const markup = `<${navigation}><button type="button">登录</button></${navigation.split(' ')[0]}>`
        + `<${resume}>${name}</div>`;
      if (main) {
        const f = bootMain(t, markup);
        assert.equal((await f.run()).status, 'success');
        assert.equal(f.assignments, 1);
        assert.equal(f.events, 1);
      } else {
        const f = boot(t, markup);
        const result = await f.request('RESUME_FILL');
        assert.equal(result.fields.find(row => row.id === 'name').status, 'verified');
        assert.equal(f.document.getElementById('name').value, profile.fullName);
        assert.equal(f.assignments, 1);
        assert.equal(f.effects, 3);
        assert.equal(result.advisoryHints.some(row => row.reason === 'login_form_detected'), false);
      }
    });

for (const main of [false, true]) for (const navigation of ['header', 'nav', 'div role="navigation"'])
  test(`a real login editor inside ${navigation} remains protected (MAIN ${main})`, async t => {
    const markup = `<section><${navigation}>${phone}<input type="password"></${navigation.split(' ')[0]}></section><div>${name}</div>`;
    if (main) {
      const f = bootMain(t, markup);
      assert.equal((await f.run('#phone')).reason, 'login_form_detected');
      assert.equal(f.assignments, 0);
      assert.equal(f.events, 0);
      assert.equal((await f.run()).status, 'success');
      assert.equal(f.assignments, 1);
    } else {
      const f = boot(t, markup);
      const result = await f.request('RESUME_FILL');
      assert.equal(result.fields.find(row => row.id === 'phone').reason, 'login_form_detected');
      assert.equal(f.document.getElementById('phone').value, '');
      assert.equal(result.fields.find(row => row.id === 'name').status, 'verified');
      assert.equal(f.assignments, 1);
      assert.equal(f.effects, 3);
    }
  });

for (const main of [false, true]) test(`a bare login action cannot use body as its owner (MAIN ${main})`, async t => {
  const markup = `<button type="button">登录</button><div>${name}</div>`;
  if (main) {
    const f = bootMain(t, markup);
    assert.equal((await f.run()).status, 'success');
    assert.equal(f.assignments, 1);
  } else {
    const f = boot(t, markup);
    const result = await f.request('RESUME_FILL');
    assert.equal(result.fields.find(row => row.id === 'name').status, 'verified');
    assert.equal(f.assignments, 1);
  }
});

test('native form= associations are protected across the form subtree boundary', async t => {
  const f = boot(t, '<form id="login"><input type="password"></form><label>姓名<input id="name" form="login"></label>'
    + '<form><label>邮箱<input id="email"></label></form>');
  const result = await f.request('RESUME_FILL');
  assert.equal(result.fields.find(row => row.id === 'name').reason, 'login_form_detected');
  assert.equal(f.document.getElementById('name').value, '');
  assert.equal(result.fields.find(row => row.id === 'email').status, 'verified');
  assert.equal(f.document.getElementById('email').value, profile.email);
});

for (const mutateAt of [2, 3, 4, 5, 6]) test(`a login signal appearing at binding check ${mutateAt} prevents later effects`, async t => {
  const f = boot(t, `<form>${name}</form>`, { onBinding(count, window) {
    if (count === mutateAt) {
      const password = window.document.createElement('input');
      password.type = 'password';
      window.document.querySelector('form').append(password);
    }
  } });
  const result = await f.request('RESUME_FILL');
  const field = result.fields.find(row => row.id === 'name');
  assert.equal(field.reason, 'login_form_detected');
  assert.equal(field.semanticStatus, 'manual');
  const written = mutateAt > 3;
  assert.equal(field.status, written ? 'failed' : 'skipped');
  assert.equal(f.assignments, written ? 1 : 0);
  assert.equal(f.effects, Math.max(0, mutateAt - 4));
  assert.equal(result.advisoryHints.some(row => row.reason === 'login_form_detected'), true);
});
