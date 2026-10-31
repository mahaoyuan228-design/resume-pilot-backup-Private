import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../src/content/controls/resume-form.js', import.meta.url), 'utf8');
const flags = { readOnly: true, activation: 'manual', navigationAttempted: false,
  writeStarted: false, writeAttempted: false, saved: false, skippedSave: true, liveSupportClaimed: false };
const tab = '<div role="tablist"><button type="button" role="tab" id="education-tab" aria-controls="education-panel">Education</button></div>'
  + '<section role="tabpanel" id="education-panel" aria-labelledby="education-tab" hidden></section>';

function fixture(t, html, url = 'https://fixture.example.test/resume?tenant=fixture') {
  const dom = new JSDOM(`<!doctype html><body>${html}<input id="neighbor" value="KEEP"></body>`, {
    url, runScripts: 'outside-only', pretendToBeVisual: true,
  });
  t.after(() => dom.window.close());
  const { window } = dom, { document } = window;
  const effects = { events: 0, assignments: 0, network: 0, forms: 0, history: 0, storage: 0 };
  for (const type of ['click', 'pointerdown', 'mousedown', 'focus', 'blur', 'input', 'change', 'submit', 'reset']) {
    document.addEventListener(type, event => { effects.events++; event.preventDefault(); event.stopImmediatePropagation(); }, true);
  }
  const value = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
  Object.defineProperty(window.HTMLInputElement.prototype, 'value', { ...value,
    set(next) { effects.assignments++; value.set.call(this, next); } });
  window.fetch = () => { effects.network++; throw Error('unexpected_fetch'); };
  window.XMLHttpRequest.prototype.open = () => { effects.network++; throw Error('unexpected_xhr'); };
  window.navigator.sendBeacon = () => { effects.network++; throw Error('unexpected_beacon'); };
  for (const name of ['submit', 'requestSubmit', 'reset']) window.HTMLFormElement.prototype[name] = () => {
    effects.forms++; throw Error('unexpected_form_action');
  };
  for (const name of ['pushState', 'replaceState', 'go', 'back', 'forward']) window.history[name] = () => {
    effects.history++; throw Error('unexpected_history_action');
  };
  window.Storage.prototype.setItem = () => { effects.storage++; throw Error('unexpected_storage_write'); };
  window.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  window.eval(source);
  const before = document.body.innerHTML;
  return { window, document, flow: window.ResumeFormFlow,
    target: () => document.querySelector('#target'),
    assertInert() {
      assert.equal(document.body.innerHTML, before);
      assert.equal(window.location.href, url);
      assert.equal(document.querySelector('#neighbor').value, 'KEEP');
      assert.deepEqual(effects, { events: 0, assignments: 0, network: 0, forms: 0, history: 0, storage: 0 });
    } };
}

function readonly(result) {
  for (const [key, expected] of Object.entries(flags)) assert.equal(result[key], expected, key);
  assert.doesNotThrow(() => JSON.stringify(result));
}

for (const [name, html, strategy, target] of [
  ['sidebar hash', '<aside><a id="target" href="#education">Education</a></aside><section id="education"></section>', 'hash', 'education'],
  ['encoded hash', '<nav><a id="target" href="#%E6%95%99%E8%82%B2">Education</a></nav><section id="教育"></section>', 'hash', '教育'],
  ['wizard query', '<nav><a id="target" href="?tenant=fixture&step=education">Education</a></nav>', 'query', '/resume?tenant=fixture&step=education'],
  ['section query', '<nav><a id="target" href="?tenant=fixture&section=education">Education</a></nav>', 'query', '/resume?tenant=fixture&section=education'],
  ['tab query', '<nav><a id="target" href="?tenant=fixture&tab=2">Education</a></nav>', 'query', '/resume?tenant=fixture&tab=2'],
  ['reciprocal ARIA tab', tab.replace('id="education-tab"', 'id="target"').replace('aria-labelledby="education-tab"', 'aria-labelledby="target"'), 'tab', 'education-panel'],
]) test(`read-only navigation plans ${name} without activation`, t => {
  const f = fixture(t, html), result = f.flow.navigation.plan(f.target());
  assert.equal(result.status, 'planned');
  assert.equal(result.reason, 'navigation_planned');
  assert.equal(result.strategy, strategy);
  assert.equal(result.target, target);
  readonly(result);
  const discovery = f.flow.navigation.inspect();
  assert.equal(discovery.status, 'observed');
  assert.equal(discovery.sections.length, 1);
  readonly(discovery);
  f.assertInert();
});

const manualCases = [
  ['unknown action', '<nav><button type="button" id="target">Education</button></nav>'],
  ['submit', '<form><nav><button id="target">Education</button></nav></form>'],
  ['submit input', '<nav><input type="submit" id="target" value="Education"></nav>'],
  ['disabled', '<nav><a id="target" aria-disabled="true" href="#panel">Education</a></nav><section id="panel"></section>'],
  ['hidden ancestor', '<nav hidden><a id="target" href="#panel">Education</a></nav><section id="panel"></section>'],
  ['busy ancestor', '<nav aria-busy="true"><a id="target" href="#panel">Education</a></nav><section id="panel"></section>'],
  ['missing hash target', '<nav><a id="target" href="#missing">Education</a></nav>'],
  ['duplicate hash target', '<nav><a id="target" href="#panel">Education</a></nav><section id="panel"></section><section id="panel"></section>'],
  ['empty hash', '<nav><a id="target" href="#">Education</a></nav>'],
  ['invalid hash encoding', '<nav><a id="target" href="#%ZZ">Education</a></nav>'],
  ['cross origin', '<nav><a id="target" href="https://other.example.test/resume?tenant=fixture#panel">Education</a></nav><section id="panel"></section>'],
  ['new pathname', '<nav><a id="target" href="/other?tenant=fixture#panel">Education</a></nav><section id="panel"></section>'],
  ['javascript URL', '<nav><a id="target" href="javascript:void(0)">Education</a></nav>'],
  ['download', '<nav><a id="target" download href="#panel">Education</a></nav><section id="panel"></section>'],
  ['new window', '<nav><a id="target" target="_blank" href="#panel">Education</a></nav><section id="panel"></section>'],
  ['external document base', '<base href="https://other.example.test/"><nav><a id="target" href="#panel">Education</a></nav><section id="panel"></section>'],
  ['link ping', '<nav><a id="target" ping="/track" href="#panel">Education</a></nav><section id="panel"></section>'],
  ['hidden save caption', '<nav><a id="target" aria-label="Education" href="#panel">保存</a></nav><section id="panel"></section>'],
  ['business query', '<nav><a id="target" href="?tenant=fixture&action=save">Education</a></nav>'],
  ['changed binding query', '<nav><a id="target" href="?tenant=other&step=2">Education</a></nav>'],
  ['two changed navigation keys', '<nav><a id="target" href="?tenant=fixture&step=2&tab=2">Education</a></nav>'],
  ['duplicate navigation key', '<nav><a id="target" href="?tenant=fixture&step=1&step=2">Education</a></nav>'],
  ['empty navigation query', '<nav><a id="target" href="?tenant=fixture&section=">Education</a></nav>'],
  ['query and hash change', '<nav><a id="target" href="?tenant=fixture&step=2#panel">Education</a></nav><section id="panel"></section>'],
  ['unowned tab', '<button type="button" role="tab" id="target" aria-controls="panel">Education</button><section id="panel" role="tabpanel" aria-labelledby="target"></section>'],
  ['tab without reciprocal label', '<div role="tablist"><button type="button" role="tab" id="target" aria-controls="panel">Education</button></div><section id="panel" role="tabpanel"></section>'],
  ['shared tab panel', '<div role="tablist"><button type="button" role="tab" id="target" aria-controls="panel">Education</button><button type="button" role="tab" id="other" aria-controls="panel">Work</button></div><section id="panel" role="tabpanel" aria-labelledby="target"></section>'],
  ['unsafe link cannot fall back to tab', '<div role="tablist"><a role="tab" id="target" aria-controls="panel" href="/save">Education</a></div><section id="panel" role="tabpanel" aria-labelledby="target"></section>'],
];
for (const caption of ['保存', '提交', '下一步', '继续', '确认', 'Save', 'Submit', 'Next']) {
  manualCases.push([`forbidden ${caption}`, `<nav><a id="target" href="#panel">${caption}</a></nav><section id="panel"></section>`]);
}
for (const [name, html] of manualCases) test(`navigation leaves ${name} manual and inert`, t => {
  const f = fixture(t, html), result = f.flow.navigation.plan(f.target());
  assert.equal(result.status, 'manual');
  assert.equal(result.strategy, 'none');
  readonly(result);
  readonly(f.flow.navigation.inspect());
  f.assertInert();
});

test('discovery prioritizes hash, query and tabs while retaining unknown controls as manual', t => {
  const f = fixture(t, tab + '<nav><button type="button">Unknown</button><a href="?tenant=fixture&section=work">Work</a>'
    + '<a href="#basic">Basic</a><a href="#hidden" hidden>Hidden</a></nav><section id="basic"></section><section id="hidden"></section>');
  const result = f.flow.navigation.inspect();
  assert.deepEqual(Array.from(result.sections, row => row.strategy), ['hash', 'query', 'tab', 'none']);
  assert.equal(result.sections.at(-1).status, 'manual');
  assert.equal(new Set(Array.from(result.sections, row => row.index)).size, 4);
  readonly(result);
  f.window.eval(source);
  assert.equal(f.flow.navigation.inspect().sections.length, 4);
  f.assertInert();
});

test('replanning rejects removed controls and changed target ownership without caching a prior success', t => {
  const f = fixture(t, '<nav><a id="target" href="#panel">Education</a></nav><section id="panel"></section>');
  const control = f.target();
  assert.equal(f.flow.navigation.plan(control).status, 'planned');
  f.document.querySelector('#panel').remove();
  assert.equal(f.flow.navigation.plan(control).status, 'manual');
  control.remove();
  assert.equal(f.flow.navigation.plan(control).status, 'manual');
});

test('reinjection upgrades the old entry API and keeps the new API stable', t => {
  const f = fixture(t, '<nav><a id="target" href="#panel">Education</a></nav><section id="panel"></section>');
  f.window.ResumeFormFlow = Object.freeze({ version: 1, navigation: { version: 1 }, inspect() {}, ensure() {} });
  f.window.eval(source);
  assert.equal(typeof f.window.ResumeFormFlow.ensure, 'function');
  assert.equal(f.window.ResumeFormFlow.inspect().entryCount, 0);
  assert.equal(f.window.ResumeFormFlow.navigation.plan(f.target()).strategy, 'hash');
  const upgraded = f.window.ResumeFormFlow;
  f.window.eval(source);
  assert.equal(f.window.ResumeFormFlow, upgraded);
  f.assertInert();
});

test('ordinary engine inspect exposes read-only navigation without entering or filling the form', async t => {
  const f = fixture(t, '<nav><a id="target" href="#education">Education</a><button type="button">下一步</button></nav>'
    + '<section id="education"><label>姓名<input id="fullName"></label></section><button type="button">编辑简历</button>');
  let listener;
  f.window.chrome = { storage: { local: { async get() { return {}; } } }, runtime: { id: 'offline-extension',
    onMessage: { addListener(fn) { listener = fn; }, hasListeners: () => false },
    async sendMessage(message) {
      assert.equal(message.type, 'RESUME_ATS_CONTROL_CANDIDATES');
      return { ok: true, mode: 'candidates', candidates: [], writeStarted: false, liveSupportClaimed: false };
    } } };
  for (const name of ['src/core/matcher.js', 'src/content/engine.js']) {
    f.window.eval(readFileSync(new URL(`../${name}`, import.meta.url), 'utf8'));
  }
  const reply = await new Promise(resolve => listener({ type: 'RESUME_INSPECT', profile: {
    fullName: 'Synthetic Person', confirmedFields: ['fullName'],
  } }, { id: 'offline-extension' }, resolve));
  assert.equal(reply.ok, true, reply.error);
  assert.equal(reply.data.entry.entryPlan.status, 'manual');
  readonly(reply.data.entry.entryPlan);
  assert.equal(reply.data.navigation.status, 'observed');
  assert.deepEqual(Array.from(reply.data.navigation.sections, row => row.status), ['planned', 'manual']);
  readonly(reply.data.navigation);
  assert.equal(f.document.querySelector('#fullName').value, '');
  f.assertInert();
});
