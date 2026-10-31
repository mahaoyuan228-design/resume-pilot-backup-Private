import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const sources = ['src/core/matcher.js', 'src/content/engine.js'].map(path =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const html = `<form>
  <iframe id="frame" src="https://other.example.test/challenge"></iframe>
  <iframe id="hidden-frame" hidden></iframe>
  <div data-captcha><label>姓名<input id="data-challenge"></label></div>
  <div class="GateCaptcha"><label>姓名<input id="class-challenge"></label></div>
  <div id="CaptchaPanel"><label>姓名<input id="id-challenge"></label></div>
  <label>姓名<input id="name-challenge" name="CaptchaAnswer"></label>
  <label>姓名<input id="otp" autocomplete="one-time-code"></label>
  <div id="widget" class="h-captcha"></div>
  <label>未识别题目<input id="unknown"></label>
  <label>邮箱<input id="neighbor" value="KEEP"></label>
</form>`;

function boot(t, enabled, { markup = html, profile = { fullName: '离线姓名', email: 'offline@example.test', confirmedFields: ['fullName', 'email'] },
  attachment, onBinding, setup } = {}) {
  const dom = new JSDOM(`<!doctype html><body>${markup}</body>`, {
    url: 'https://fixture.example.test/resume', pretendToBeVisual: true, runScripts: 'outside-only',
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  window.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  // jsdom's default :focus stylesheet itself reads iframe.contentDocument.
  window.getComputedStyle = element => ({ display: element.style.display || 'block', visibility: 'visible' });
  let listener, effects = 0, frameReads = 0, writes = 0, bindingChecks = 0;
  for (const event of ['click', 'input', 'change', 'blur', 'pointerdown', 'mousedown'])
    window.document.addEventListener(event, () => { effects++; }, true);
  const frame = window.document.getElementById('frame');
  for (const key of frame ? ['contentDocument', 'contentWindow'] : []) Object.defineProperty(frame, key, {
    get() { frameReads++; throw new window.DOMException('Blocked cross-origin frame', 'SecurityError'); },
  });
  window.chrome = { storage: { local: {
    async get() { return enabled ? { resumeAtsEngineWriteEnabled: true } : {}; },
    async set() { writes++; },
  } }, runtime: { id: 'fixture', onMessage: { addListener(value) { listener = value; } },
    async sendMessage(message) {
      if (message.type === 'RESUME_ATS_CONTROL_CANDIDATES')
        return { ok: true, mode: 'candidates', candidates: [], writeStarted: false, liveSupportClaimed: false };
      assert.equal(message.type, 'RESUME_PROFILE_BINDING_CHECK');
      onBinding?.(++bindingChecks, window);
      return { allowed: true };
    } } };
  setup?.(window);
  for (const source of sources) window.eval(source);
  return { window, get effects() { return effects; }, async request(type) {
    const result = await new Promise(resolve => listener({ type, profile, attachment, profileBinding: {} }, { id: 'fixture' }, resolve));
    assert.equal(result.ok, true, result.error);
    return result.data;
  }, assertInert() {
    assert.equal(effects, 0); assert.equal(frameReads, 0); assert.equal(writes, 0);
    for (const input of window.document.querySelectorAll('input'))
      assert.equal(input.value, input.id === 'neighbor' ? 'KEEP' : '');
  } };
}

for (const enabled of [false, true]) test(`ordinary inspect/fill leaves challenge forms, frames and unknown fields inert (opt-in ${enabled})`, async t => {
  const f = boot(t, enabled);
  const ids = ['frame', 'data-challenge', 'class-challenge', 'id-challenge', 'name-challenge', 'otp', 'widget'];
  for (const type of ['RESUME_INSPECT', 'RESUME_FILL']) {
    const { fields } = await f.request(type);
    assert.equal(fields.length, 9);
    for (const id of ids) {
      const field = fields.find(row => row.id === id);
      assert.ok(field, id);
      assert.equal(field.semanticStatus, 'manual', id);
      assert.equal(field.reason, 'login_form_detected', id);
      assert.equal(field.path, undefined, id);
      assert.equal(field.mappingContext, undefined, id);
      if (type === 'RESUME_FILL') assert.equal(field.status, 'skipped', id);
    }
    assert.equal(fields.find(row => row.id === 'unknown').semanticStatus, 'manual');
    // OTP evidence protects the entire containing form, including a known
    // email field. The existing value is neither inspected for filling nor changed.
    assert.equal(fields.find(row => row.id === 'neighbor').reason, 'login_form_detected');
    assert.equal(fields.find(row => row.id === 'neighbor').path, undefined);
    f.assertInert();
  }
});

const dynamicCases = [
  { kind: 'text', markup: '<label>姓名<input id="target"></label>', key: 'fullName', value: '离线姓名', checks: [3, 4, 5, 6] },
  { kind: 'textarea', markup: '<label>姓名<textarea id="target"></textarea></label>', key: 'fullName', value: '离线姓名', checks: [3] },
  { kind: 'select', markup: '<label>性别<select id="target"><option value="">请选择</option><option value="男">男</option></select></label>', key: 'gender', value: '男', checks: [3, 4, 5] },
  { kind: 'radio', markup: '<div class="ant-form-item"><div class="ant-form-item-label"><label>性别</label></div><label class="ant-radio-wrapper">男<input id="target" type="radio" value="男"></label><label class="ant-radio-wrapper">女<input type="radio" value="女"></label></div>', key: 'gender', value: '男', checks: [3] },
  { kind: 'file', markup: '<label>简历<input id="target" type="file"></label>', key: 'fullName', value: '离线姓名', checks: [3, 4, 5] },
];
for (const scenario of dynamicCases) for (const mutateAt of scenario.checks)
  test(`legacy ${scenario.kind} rechecks dynamic challenges before effect ${mutateAt - 2}`, async t => {
    let assignments = 0;
    const f = boot(t, false, { markup: `<form>${scenario.markup}</form>`,
      profile: { [scenario.key]: scenario.value, confirmedFields: [scenario.key] },
      attachment: scenario.kind === 'file' ? { bytes: [65], name: 'offline.txt', type: 'text/plain', size: 1 } : undefined,
      onBinding(count, window) {
        if (count === mutateAt) window.document.getElementById('target').setAttribute('data-captcha', '');
      },
      setup(window) {
        const target = window.document.getElementById('target');
        if (scenario.kind === 'file') {
          let files = [];
          Object.defineProperty(target, 'files', { get: () => files, set(value) { assignments++; files = value; } });
          window.DataTransfer = class { files = []; items = { add: file => this.files.push(file) }; };
        } else {
          const proto = scenario.kind === 'select' ? window.HTMLSelectElement.prototype
            : scenario.kind === 'textarea' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
          const key = scenario.kind === 'select' ? 'selectedIndex' : 'value';
          const descriptor = Object.getOwnPropertyDescriptor(proto, key);
          Object.defineProperty(proto, key, { ...descriptor, set(value) {
            if (this === target) assignments++;
            descriptor.set.call(this, value);
          } });
        }
      } });
    const { fields } = await f.request('RESUME_FILL');
    assert.equal(fields.length, 1);
    const field = fields[0], written = mutateAt > 3;
    assert.equal(field.semanticStatus, 'manual');
    assert.equal(field.reason, ['text', 'radio', 'file'].includes(scenario.kind) ? 'login_form_detected' : 'iframe_or_captcha_manual');
    assert.equal(field.status, written ? 'failed' : 'skipped');
    assert.equal(field.writeStarted, written);
    assert.equal(field.mappingContext, undefined);
    assert.equal(assignments, written ? 1 : 0);
    assert.equal(f.effects, Math.max(0, mutateAt - 4));
    const target = f.window.document.getElementById('target');
    if (scenario.kind === 'radio') assert.equal(target.checked, false);
    else if (scenario.kind === 'file') assert.equal(target.files.length, written ? 1 : 0);
    else assert.equal(target.value, written ? scenario.value : '');
    assert.equal(field.currentValue, written ? scenario.kind === 'file' ? 'offline.txt' : scenario.value : '');
  });
