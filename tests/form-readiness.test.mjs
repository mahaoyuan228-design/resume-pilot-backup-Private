import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const flowSource = source('src/content/controls/resume-form.js');
const engineSources = ['src/core/matcher.js', 'src/content/engine.js'].map(source);
const flags = { readOnly: true, neverSave: true, saveAttempted: false,
  writeStarted: false, writeAttempted: false, saved: false, skippedSave: true, liveSupportClaimed: false };

function fixture(t, html, { engine = false, enabled = false } = {}) {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, {
    url: 'https://fixture.example.test/application', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  t.after(() => dom.window.close());
  const { window } = dom, { document } = window;
  window.Element.prototype.getClientRects = () => [{ width: 20, height: 20 }];
  // Avoid jsdom's :focus stylesheet reading iframe documents while retaining
  // the ancestor visibility properties used by the passive page-state probe.
  window.getComputedStyle = node => ({ display: node.style.display || 'block',
    visibility: node.style.visibility || 'visible', opacity: node.style.opacity || '1',
    contentVisibility: node.style.contentVisibility || 'visible' });
  const effects = { events: 0, network: 0, formActions: 0, history: 0, storage: 0, frameReads: 0 };
  for (const type of ['click', 'pointerdown', 'mousedown', 'focus', 'blur', 'input', 'change', 'submit', 'reset', 'keydown', 'hashchange'])
    window.addEventListener(type, () => effects.events++, true);
  window.fetch = () => { effects.network++; throw Error('unexpected_fetch'); };
  window.XMLHttpRequest.prototype.open = () => { effects.network++; throw Error('unexpected_xhr'); };
  window.navigator.sendBeacon = () => { effects.network++; throw Error('unexpected_beacon'); };
  for (const name of ['submit', 'requestSubmit', 'reset']) window.HTMLFormElement.prototype[name] = () => {
    effects.formActions++; throw Error('unexpected_form_action');
  };
  for (const name of ['pushState', 'replaceState', 'go', 'back', 'forward']) window.history[name] = () => {
    effects.history++; throw Error('unexpected_navigation');
  };
  window.Storage.prototype.setItem = () => { effects.storage++; throw Error('unexpected_storage_write'); };
  for (const frame of document.querySelectorAll('iframe')) for (const key of ['contentDocument', 'contentWindow'])
    Object.defineProperty(frame, key, { get() { effects.frameReads++; throw Error('unexpected_frame_read'); } });
  let listener;
  if (engine) window.chrome = { storage: { local: {
    async get() { return enabled ? { resumeAtsEngineWriteEnabled: true } : {}; },
    async set() { effects.storage++; throw Error('unexpected_extension_storage_write'); },
  } }, runtime: { id: 'offline-fixture', onMessage: { addListener(fn) { listener = fn; } },
    async sendMessage(message) {
      if (message.type === 'RESUME_PROFILE_BINDING_CHECK') return { allowed: true };
      assert.equal(message.type, 'RESUME_ATS_CONTROL_CANDIDATES');
      return { ok: true, mode: 'candidates', candidates: [], writeStarted: false, liveSupportClaimed: false };
    } } };
  window.eval(flowSource);
  if (engine) for (const text of engineSources) window.eval(text);
  const before = document.body.innerHTML, initialUrl = window.location.href;
  const values = () => [...document.querySelectorAll('input,select,textarea')].map(node => ({
    id: node.id, value: node.value, checked: node.checked, selectedIndex: node.selectedIndex,
  }));
  const originalValues = values();
  return { window, document, effects, inspect: options => window.ResumeFormFlow.readiness.inspect(options),
    request: type => new Promise(resolve => listener({ type,
      profile: { fullName: '离线示例', email: 'offline@example.test', confirmedFields: ['fullName', 'email'] },
      profileBinding: {} }, { id: 'offline-fixture' }, resolve)),
    assertInert() {
      assert.equal(document.body.innerHTML, before);
      assert.equal(window.location.href, initialUrl);
      assert.deepEqual(values(), originalValues);
      assert.deepEqual(effects, { events: 0, network: 0, formActions: 0, history: 0, storage: 0, frameReads: 0 });
    } };
}

function assertReadiness(result, status, counts = {}) {
  assert.equal(result.status, status, JSON.stringify(result));
  assert.equal(typeof result.reason, 'string');
  assert.ok(result.reason.length > 0);
  for (const [key, value] of Object.entries({ ...flags, ...counts })) assert.equal(result[key], value, key);
  for (const key of ['visibleControlCount', 'editableControlCount', 'visibleRequiredCount', 'editableRequiredCount'])
    assert.ok(Number.isInteger(result[key]) && result[key] >= 0, key);
  assert.doesNotThrow(() => JSON.stringify(result));
}

for (const [name, html, counts] of [
  ['native required', '<form><label>姓名<input required></label></form>', [1, 1, 1, 1]],
  ['ARIA required', '<section role="form"><label>姓名<input aria-required="true"></label></section>', [1, 1, 1, 1]],
  ['optional form controls', '<form><label>姓名<input></label><label>邮箱<input type="email"></label></form>', [2, 2, 0, 0]],
  ['required label region', '<form><label for="applicant" class="ant-form-item-required">姓名</label><input id="applicant"></form>', [1, 1, 1, 1]],
  ['required form-item region', '<form><div class="ant-form-item"><div class="ant-form-item-label"><label class="ant-form-item-required">姓名</label></div><div class="ant-form-item-control"><input></div></div></form>', [1, 1, 1, 1]],
  ['mixed editable and disabled neighbors', '<form><label>姓名<input required></label><label>备注<input disabled value="KEEP"></label></form>', [2, 1, 1, 1]],
]) test(`form readiness observes ${name} without effects`, t => {
  const f = fixture(t, html);
  assertReadiness(f.inspect(), 'ready', Object.fromEntries(
    ['visibleControlCount', 'editableControlCount', 'visibleRequiredCount', 'editableRequiredCount'].map((key, index) => [key, counts[index]])));
  f.assertInert();
});

for (const attribute of ['hidden', 'inert', 'aria-hidden="true"', 'style="display:none"',
  'style="visibility:hidden"', 'style="opacity:0"', 'style="content-visibility:hidden"'])
  test(`hidden required ancestors do not enter page readiness: ${attribute}`, t => {
    const f = fixture(t, `<form><label>姓名<input required></label><section ${attribute}><label>隐藏字段<input required readonly></label><div aria-required="true"></div></section></form>`);
    assertReadiness(f.inspect(), 'ready', { visibleControlCount: 1, editableControlCount: 1,
      visibleRequiredCount: 1, editableRequiredCount: 1 });
    f.assertInert();
  });

test('zero-geometry required control does not create an editable form', t => {
  const f = fixture(t, '<form><label>姓名<input required></label></form>');
  f.document.querySelector('input').getClientRects = () => [];
  assertReadiness(f.inspect(), 'form_not_ready', { visibleControlCount: 0, editableControlCount: 0 });
  f.assertInert();
});

for (const [name, html] of [
  ['password login form', '<form><label>账号<input autocomplete="username"></label><label>密码<input type="password"></label><button>登录</button></form>'],
  ['password login page without form wrapper', '<h1>Sign in</h1><label>Account<input autocomplete="username"></label><label>Password<input type="password"></label>'],
  ['current-password login wrong page', '<main><form><input autocomplete="username"><input type="password" autocomplete="current-password"></form></main>'],
  ['OTP login form', '<form><h1>验证码登录</h1><label>手机<input type="tel"></label><input autocomplete="one-time-code"><button>登录</button></form>'],
  ['session wall', '<main><h1>会话已过期，请重新登录</h1></main>'],
  ['login-required alert before editor', '<div role="alert">Please sign in to continue</div><form><label>姓名<input required></label></form>'],
]) test(`generic ${name} reports login_required`, t => {
  const f = fixture(t, html);
  assertReadiness(f.inspect(), 'login_required');
  f.assertInert();
});

test('a header login link does not turn an editable application into a login wall', t => {
  const f = fixture(t, '<header><a href="/login">登录</a><input type="search" placeholder="搜索"></header>'
    + '<form><label>姓名<input required></label><button type="button">保存</button><button>提交</button></form>');
  assertReadiness(f.inspect(), 'ready', { visibleControlCount: 1, editableControlCount: 1,
    visibleRequiredCount: 1, editableRequiredCount: 1 });
  f.assertInert();
});

test('header login and business email in the same main do not create a login form', t => {
  const f = fixture(t, '<main><header><button type="button">登录</button></header>'
    + '<form><label>联系邮箱<input type="email" required></label></form></main>');
  assertReadiness(f.inspect(), 'ready', { visibleControlCount: 1, editableControlCount: 1,
    visibleRequiredCount: 1, editableRequiredCount: 1 });
  f.assertInert();
});

test('hidden login forms and expired-session headings are excluded from page evidence', t => {
  const f = fixture(t, '<section hidden><h1>会话已过期，请重新登录</h1><form><input autocomplete="username">'
    + '<input type="password" autocomplete="current-password"><button>登录</button></form></section>'
    + '<form><label>姓名<input required></label></form>');
  assertReadiness(f.inspect(), 'ready', { visibleControlCount: 1, editableControlCount: 1,
    visibleRequiredCount: 1, editableRequiredCount: 1 });
  f.assertInert();
});

const blockedCases = [
  ['empty body', '', 'form_not_ready'],
  ['empty application root', '<div id="root"></div>', 'form_not_ready'],
  ['busy application root', '<div aria-busy="true"></div>', 'form_not_ready'],
  ['readonly summary', '<form><label>姓名<input readonly value="KEEP_NAME" required></label></form>', 'form_not_ready'],
  ['disabled form', '<form><fieldset disabled><label>姓名<input value="KEEP_NAME" required></label></fieldset></form>', 'form_not_ready'],
  ['ARIA readonly form', '<form aria-readonly="true"><label>姓名<input required></label></form>', 'form_not_ready'],
  ['empty shell', '<main><form></form></main>', 'form_not_ready'],
  ['missing required region', '<form><div aria-required="true"></div><label>备注<input></label></form>', 'form_not_ready'],
  ['busy hydrated shell', '<main><form aria-busy="true"><label>姓名<input required></label></form></main>', 'form_not_ready'],
  ['busy empty shell', '<main aria-busy="true"><form></form></main>', 'form_not_ready'],
  ['unknown page', '<main><h1>职位介绍</h1><p>请选择职位</p></main>', 'manual'],
  ['unknown required widget', '<form><div role="combobox" aria-label="学校" aria-required="true"></div></form>', 'manual'],
  ['readonly custom combobox', '<form><label>学校<input readonly role="combobox" aria-required="true"></label></form>', 'manual'],
  ['OTP challenge without login evidence', '<form><label>验证码<input autocomplete="one-time-code"></label></form>', 'manual'],
  ['cross-origin iframe', '<form><iframe src="https://other.example.test/form"></iframe></form>', 'manual'],
];
for (const [name, html, status] of blockedCases) test(`generic ${name} fails closed without effects`, t => {
  const f = fixture(t, html);
  assertReadiness(f.inspect(), status);
  f.assertInert();
});

test('confirmed writable widget evidence admits a readonly display without activating it', t => {
  const f = fixture(t, '<form><label>学校<input readonly role="combobox" aria-required="true"></label></form>');
  const input = f.document.querySelector('input');
  assertReadiness(f.inspect(), 'manual');
  assertReadiness(f.inspect({ confirmedEditable: [input] }), 'ready', { visibleControlCount: 1,
    editableControlCount: 1, visibleRequiredCount: 1, editableRequiredCount: 1 });
  f.assertInert();
});

for (const [name, html] of [
  ['inputless combobox', '<div id="target" role="combobox" aria-label="学校" aria-required="true"></div>'],
  ['inputless slider', '<div id="target" role="slider" aria-label="评分" aria-required="true" aria-valuenow="2"></div>'],
  ['rating radiogroup', '<div id="target" role="radiogroup" aria-label="评分" aria-required="true"><span role="radio" aria-checked="false">1</span><span role="radio" aria-checked="true">2</span><span role="radio" aria-checked="false">3</span></div>'],
]) test(`confirmed ${name} is one editable control without counting owned descendants`, t => {
  const f = fixture(t, `<form>${html}</form>`);
  const root = f.document.getElementById('target');
  assertReadiness(f.inspect(), 'manual');
  assertReadiness(f.inspect({ confirmedEditable: [root] }), 'ready', { visibleControlCount: 1,
    editableControlCount: 1, visibleRequiredCount: 1, editableRequiredCount: 1 });
  f.assertInert();
});

test('a readonly required field cannot borrow readiness from an optional editor', t => {
  const f = fixture(t, '<form><label>姓名<input readonly required value="KEEP_NAME"></label><label>备注<input></label></form>');
  assertReadiness(f.inspect(), 'form_not_ready', { visibleControlCount: 2, editableControlCount: 1,
    visibleRequiredCount: 1, editableRequiredCount: 0 });
  f.assertInert();
});

const engineBlockedCases = [
  ['login', '<form><label>账号<input autocomplete="username"></label><label>密码<input type="password"></label><button>登录</button></form>', 'login_required'],
  ['shell', '<main><form><button type="button">保存</button><button>提交</button></form></main>', 'form_not_ready'],
  ['readonly', '<form><label>姓名<input readonly value="KEEP_NAME" required></label><button type="button">保存</button><button>提交</button></form>', 'form_not_ready'],
  ['unknown', '<main><h1>未知页面</h1><button type="button">保存</button></main>', 'manual'],
];
for (const enabled of [false, true]) for (const [name, html, status] of engineBlockedCases)
  test(`ordinary inspect and fill share ${name} page readiness before writes (opt-in ${enabled})`, async t => {
    const f = fixture(t, html, { engine: true, enabled });
    const inspected = await f.request('RESUME_INSPECT');
    assert.equal(inspected.ok, true, JSON.stringify(inspected));
    assertReadiness(inspected.data.formReadiness, status);
    f.assertInert();
    const filled = await f.request('RESUME_FILL');
    assert.equal(filled.ok, false, JSON.stringify(filled));
    assert.equal(filled.fillNotStarted, true);
    assert.equal(filled.writeStarted, false);
    assert.equal(filled.error, status);
    assert.equal(filled.status, status);
    assert.equal(filled.reason, inspected.data.formReadiness.reason);
    assert.equal(filled.writeAttempted, false);
    assert.equal(filled.saveAttempted, false);
    assert.equal(filled.liveSupportClaimed, false);
    assertReadiness(filled.readiness, status);
    f.assertInert();
  });

test('non-ready engine stops before legacy entry preparation and preserves its reason', async t => {
  const f = fixture(t, '<main><form></form><button type="button">进入简历</button></main>', { engine: true });
  let preparations = 0;
  f.window.ResumeFormFlow = { readiness: f.window.ResumeFormFlow.readiness,
    inspect() { preparations++; throw Error('unexpected_entry_inspection'); },
    ensure() { preparations++; throw Error('unexpected_entry_preparation'); } };
  const result = await f.request('RESUME_FILL');
  assert.equal(result.ok, false);
  assert.equal(result.status, 'form_not_ready');
  assert.equal(result.reason, 'form_shell');
  assert.equal(result.writeStarted, false);
  assert.equal(preparations, 0);
  f.assertInert();
});

for (const enabled of [false, true]) test(`ordinary inspect reports an editable required application (opt-in ${enabled})`, async t => {
  const f = fixture(t, '<form><label>姓名<input id="applicant" required></label><label>邮箱<input id="neighbor" value="KEEP" readonly></label>'
    + '<button type="button">保存</button><button>提交</button></form>', { engine: true, enabled });
  const result = await f.request('RESUME_INSPECT');
  assert.equal(result.ok, true, JSON.stringify(result));
  assertReadiness(result.data.formReadiness, 'ready', { visibleControlCount: 2, editableControlCount: 1,
    visibleRequiredCount: 1, editableRequiredCount: 1 });
  f.assertInert();
});

test('ordinary native fill passes readiness and preserves the Never-Save boundary', async t => {
  const f = fixture(t, '<form><label>姓名<input id="applicant" required></label><label>邮箱<input id="neighbor" value="KEEP" readonly></label>'
    + '<button type="button">保存</button><button>提交</button></form>', { engine: true });
  const before = await f.request('RESUME_INSPECT');
  assert.equal(before.ok, true, JSON.stringify(before));
  assertReadiness(before.data.formReadiness, 'ready');
  f.assertInert();
  const filled = await f.request('RESUME_FILL');
  assert.equal(filled.ok, true, JSON.stringify(filled));
  assert.equal(filled.data.fields.find(row => row.id === 'applicant').status, 'verified');
  assert.equal(f.document.getElementById('applicant').value, '离线示例');
  assert.equal(f.document.getElementById('neighbor').value, 'KEEP');
  assert.equal(f.window.location.href, 'https://fixture.example.test/application');
  assert.equal(filled.data.softwareClickedSubmit, false);
  assert.ok(f.effects.events > 0, 'the disposable native control receives ordinary fill events');
  assert.deepEqual({ ...f.effects, events: 0 }, { events: 0, network: 0, formActions: 0, history: 0, storage: 0, frameReads: 0 });
});
