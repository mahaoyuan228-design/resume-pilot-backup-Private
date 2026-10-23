import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const controller = fs.readFileSync(new URL('../src/content/cms-record-controller.js', import.meta.url), 'utf8');
const adapterSource = controller.slice(controller.indexOf('async function textAdapter'), controller.indexOf('// The owned normal-popup worker'));
const fixtureHtml = fs.readFileSync(new URL('./fixtures/cms-ant-form-synthetic.html', import.meta.url), 'utf8');
const page = 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';

// Reuse the adapter interface already exercised by cms-text-blur-commit.test.mjs.
// These are offline lifecycle refusals, not evidence of a live React commit.
function adapterFixture({ tag = 'INPUT', refuseFocus = false, refuseBlur = false,
  disconnectOnBlur = false, rejectCommit = false, failCheck = 0 } = {}) {
  const log = [];
  const doc = { activeElement: null, hasFocus: () => true };
  let checks = 0;
  class Input {
    constructor() {
      this.tagName = tag;
      this.disabled = false;
      this.readOnly = false;
      this.isConnected = true;
      this._value = 'occupied';
      this.listeners = new Map();
    }
    addEventListener(type, fn) { this.listeners.set(type, fn); }
    removeEventListener(type, fn) { if (this.listeners.get(type) === fn) this.listeners.delete(type); }
    focus() { log.push('focus'); if (!refuseFocus) doc.activeElement = this; }
    blur() {
      log.push('blur');
      if (refuseBlur) return;
      doc.activeElement = null;
      this.listeners.get('blur')?.();
      this.listeners.get('focusout')?.();
      if (disconnectOnBlur) this.isConnected = false;
      if (rejectCommit) this._value = 'occupied';
    }
    dispatchEvent(event) { log.push(event.type); return true; }
  }
  Object.defineProperty(Input.prototype, 'value', {
    get() { return this._value; },
    set(value) { log.push('set'); this._value = value; }
  });
  const input = new Input();
  const context = {
    document: doc, HTMLInputElement: Input, HTMLTextAreaElement: Input,
    Event: class { constructor(type) { this.type = type; } },
    overlayOpen: () => false, requirePage: () => {}, pause: async () => {},
    checkProfileWrite: async () => { if (++checks === failCheck) throw Error('profile_binding_changed'); }
  };
  return {
    input, log,
    run: (binding = { replaceExisting: true }) => vm.runInNewContext(`(${adapterSource})`, context)({ input }, { value: 'confirmed' }, binding)
  };
}

for (const tag of ['INPUT', 'TEXTAREA']) {
  test(`${tag}: occupied values and equal preexisting values never focus or dispatch`, async () => {
    const h = adapterFixture({ tag });
    const occupied = await h.run({ replaceExisting: false });
    assert.equal(occupied.status, 'skipped');
    assert.equal(occupied.reason, 'existing_value');
    assert.equal(h.input.value, 'occupied');
    assert.deepEqual(h.log, []);
    h.input._value = 'confirmed';
    const same = await h.run({ replaceExisting: false });
    assert.equal(same.status, 'verified');
    assert.equal(same.reason, 'preexisting_same_value');
    assert.deepEqual(h.log, []);
  });

  test(`${tag}: focus refusal stops before the setter and removes listeners`, async () => {
    const h = adapterFixture({ tag, refuseFocus: true });
    const result = await h.run();
    assert.equal(result.status, 'failed');
    assert.equal(result.reason, 'text_focus_not_observed');
    assert.deepEqual(h.log, ['focus']);
    assert.equal(h.input.value, 'occupied');
    assert.equal(h.input.listeners.size, 0);
  });

  test(`${tag}: a control retaining focus cannot claim a blur commit`, async () => {
    const h = adapterFixture({ tag, refuseBlur: true });
    const result = await h.run();
    assert.equal(result.status, 'failed');
    assert.equal(result.reason, 'text_blur_not_observed');
    assert.equal(h.input.listeners.size, 0);
  });

  for (const mode of ['disconnectOnBlur', 'rejectCommit']) {
    test(`${tag}: ${mode} fails final readback and removes listeners`, async () => {
      const h = adapterFixture({ tag, [mode]: true });
      const result = await h.run();
      assert.equal(result.status, 'failed');
      assert.equal(result.reason, 'text_readback_mismatch');
      assert.equal(h.input.listeners.size, 0);
    });
  }

  for (const failCheck of [2, 3, 4, 5, 6]) {
    test(`${tag}: profile invalidation at write check ${failCheck} halts subsequent events`, async () => {
      const h = adapterFixture({ tag, failCheck });
      await assert.rejects(h.run(), /profile_binding_changed/);
      assert.deepEqual(h.log, ['focus', 'set', 'input', 'change', 'blur'].slice(0, failCheck - 1));
      assert.equal(h.input.listeners.size, 0);
    });
  }
}

function engineFixture() {
  const dom = new JSDOM(fixtureHtml, { url: page, pretendToBeVisual: true, runScripts: 'dangerously' });
  const { window } = dom;
  window.Element.prototype.getClientRects = () => [{ width: 8, height: 8 }];
  Object.defineProperty(window.document, 'readyState', { get: () => 'complete' });
  Object.defineProperty(window.document, 'visibilityState', { get: () => 'visible' });
  window.fetch = async () => ({ ok: true, json: async () => ({ state: 200 }) });
  window.chrome = { runtime: {
    id: 'cms-offline-text', getManifest: () => ({ background: { service_worker: 'src/background/worker.mjs' } }),
    sendMessage: async message => ({ allowed: message.type === 'RESUME_PROFILE_BINDING_CHECK' }),
    onMessage: { addListener() {}, removeListener() {} }
  } };
  for (const rel of ['src/core/matcher.js', 'src/content/cms-session.js', 'src/content/engine.js']) {
    window.eval(fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8'));
  }
  const events = [];
  for (const type of ['click', 'submit', 'input', 'change', 'blur']) {
    window.document.addEventListener(type, event => events.push({ type, id: event.target.id }), true);
  }
  const fill = profile => new Promise(resolve => {
    const accepted = window.__resumeQuickFillEngineListener({ type: 'RESUME_FILL', profile }, { id: window.chrome.runtime.id }, resolve);
    assert.equal(accepted, true);
  });
  return { dom, window, events, fill };
}

const fields = [
  ['fullName', 'basic-name', 'Synthetic Name'],
  ['phone', 'basic-phone', '13800002222'],
  ['email', 'basic-email', 'synthetic@example.test'],
  ['selfEvaluation', 'self-evaluation', 'Synthetic evaluation']
];

for (const mode of ['occupied', 'unconfirmed', 'missing']) {
  test(`shipped CMS basic and self-evaluation fields ${mode}: no input, blur, click, or submit`, async () => {
    const h = engineFixture();
    try {
      const profile = { education: [], projects: [], familyMembers: [], customAnswers: {}, confirmedFields: [] };
      for (const [key, id, value] of fields) {
        if (mode !== 'missing') profile[key] = value;
        if (mode !== 'unconfirmed') profile.confirmedFields.push(key);
        if (mode === 'occupied') h.window.document.getElementById(id).value = `kept-${key}`;
      }
      const before = h.window.syntheticCmsFixture.snapshot();
      const result = await h.fill(profile);
      assert.equal(result.ok, true, JSON.stringify(result));
      for (const [key] of fields) {
        const rows = result.data.fields.filter(row => row.path === key);
        assert.equal(rows.length, 1, key);
        assert.equal(rows[0].status, 'skipped', key);
        assert.equal(rows[0].reason, mode === 'occupied' ? 'existing_value' : `${mode}_profile_value`, key);
      }
      assert.deepEqual(h.events, []);
      assert.deepEqual(h.window.syntheticCmsFixture.snapshot(), before);
      assert.equal(result.data.softwareClickedSubmit, false);
      assert.equal(result.data.savedOnSite, null);
      assert.equal(result.data.submitted, null);
      assert.equal(h.window.ResumeProfileWriteContext, undefined);
    } finally { h.dom.window.close(); }
  });
}
