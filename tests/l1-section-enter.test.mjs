import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../src/content/controls/resume-form.js', import.meta.url), 'utf8');
const defaultUrl = 'https://fixture.example.test/resume?tenant=fixture';

function fixture(t, html, url = defaultUrl) {
  const dom = new JSDOM(`<!doctype html><body>${html}<input id="neighbor" value="KEEP"></body>`, {
    url, runScripts: 'outside-only', pretendToBeVisual: true,
  });
  t.after(() => dom.window.close());
  const { window } = dom, { document } = window;
  const effects = { events: 0, handlers: 0, requests: 0, forms: 0, history: 0, storage: 0 };
  for (const type of ['click', 'pointerdown', 'mousedown', 'focus', 'blur', 'input', 'change', 'submit', 'hashchange']) {
    window.addEventListener(type, () => effects.events++, true);
  }
  window.fetch = () => { effects.requests++; throw Error('unexpected_fetch'); };
  window.XMLHttpRequest.prototype.open = () => { effects.requests++; throw Error('unexpected_xhr'); };
  window.navigator.sendBeacon = () => { effects.requests++; throw Error('unexpected_beacon'); };
  for (const name of ['submit', 'requestSubmit', 'reset']) window.HTMLFormElement.prototype[name] = () => {
    effects.forms++; throw Error('unexpected_form_action');
  };
  for (const name of ['pushState', 'replaceState', 'go', 'back', 'forward']) window.history[name] = () => {
    effects.history++; throw Error('unexpected_history_action');
  };
  window.Storage.prototype.setItem = () => { effects.storage++; throw Error('unexpected_storage_write'); };
  document.querySelector('#entry')?.addEventListener('click', event => {
    event.preventDefault();
    effects.handlers++;
    window.fetch('/synthetic-save', { method: 'POST' });
  });
  window.eval(source);
  const before = document.body.innerHTML;
  return { window, document, effects, flow: window.ResumeFormFlow,
    entry: () => document.querySelector('#entry'),
    assertInert({ unchangedDom = true } = {}) {
      if (unchangedDom) assert.equal(document.body.innerHTML, before);
      assert.equal(window.location.href, url);
      assert.equal(document.querySelector('#neighbor').value, 'KEEP');
      assert.deepEqual(effects, { events: 0, handlers: 0, requests: 0, forms: 0, history: 0, storage: 0 });
    } };
}

function manualEntry(result) {
  assert.equal(result.ok, false);
  assert.equal(result.status, 'manual');
  assert.equal(result.entryAttempted, false);
  assert.equal(result.transitions.length, 0);
  assert.equal(result.writeAttempted, false);
  assert.equal(result.saved, false);
  assert.equal(result.skippedSave, true);
  assert.equal(result.liveSupportClaimed, false);
}

function passivePlan(plan) {
  assert.equal(plan.readOnly, true);
  assert.equal(plan.activation, 'manual');
  assert.equal(plan.navigationAttempted, false);
  assert.equal(plan.writeStarted, false);
  assert.equal(plan.writeAttempted, false);
  assert.equal(plan.saved, false);
  assert.equal(plan.skippedSave, true);
  assert.equal(plan.liveSupportClaimed, false);
  assert.doesNotThrow(() => JSON.stringify(plan));
}

for (const [name, html, strategy, target] of [
  ['hash', '<a id="entry" href="#editor">编辑简历</a><section id="editor"></section>', 'hash', 'editor'],
  ['query', '<a id="entry" href="?tenant=fixture&section=editor">编辑简历</a>', 'query', '/resume?tenant=fixture&section=editor'],
  ['tab', '<div role="tablist"><button type="button" role="tab" id="entry" aria-controls="editor">编辑简历</button></div>'
    + '<section id="editor" role="tabpanel" aria-labelledby="entry" hidden></section>', 'tab', 'editor'],
  ['named anchor', '<a id="entry" href="#editor">编辑简历</a><a name="editor"></a>', 'anchor', 'editor'],
]) test(`L1 section enter reports a ${name} route without activating its POST handler`, async t => {
  const f = fixture(t, html), plan = f.flow.navigation.plan(f.entry());
  assert.equal(plan.status, 'planned');
  assert.equal(plan.strategy, strategy);
  assert.equal(plan.target, target);
  passivePlan(plan);
  const inspection = f.flow.inspect();
  assert.equal(inspection.entryPlan.strategy, strategy);
  passivePlan(inspection.entryPlan);
  const result = await f.flow.ensure({ ready: () => false, allowEntry: true, timeoutMs: 20 });
  manualEntry(result);
  assert.equal(result.reason, 'entry_activation_manual');
  assert.equal(result.entryPlan.status, 'planned');
  assert.equal(result.entryPlan.strategy, strategy);
  assert.equal(result.entryPlan.target, target);
  passivePlan(result.entryPlan);
  f.assertInert();
});

for (const [name, html] of [
  ['unknown button handler', '<button id="entry" type="button">编辑简历</button>'],
  ['default submit', '<form method="post"><button id="entry">编辑简历</button></form>'],
  ['link data-method POST', '<a id="entry" href="#editor" data-method="post">编辑简历</a><section id="editor"></section>'],
  ['link data-turbo-method PUT', '<a id="entry" href="#editor" data-turbo-method="PUT">编辑简历</a><section id="editor"></section>'],
  ['link data-http-method PATCH', '<a id="entry" href="#editor" data-http-method="patch">编辑简历</a><section id="editor"></section>'],
  ['link method DELETE', '<a id="entry" href="#editor" method="DELETE">编辑简历</a><section id="editor"></section>'],
  ['formmethod POST', '<button id="entry" type="button" formmethod="post">编辑简历</button>'],
  ['ancestor data-method POST', '<div data-method="post"><a id="entry" href="#editor">编辑简历</a></div><section id="editor"></section>'],
  ['ancestor htmx POST', '<div hx-post="/synthetic-save"><a id="entry" href="#editor">编辑简历</a></div><section id="editor"></section>'],
  ['data htmx PUT', '<a id="entry" href="#editor" data-hx-put="/synthetic-save">编辑简历</a><section id="editor"></section>'],
  ['htmx PATCH tab', '<div role="tablist"><button id="entry" type="button" role="tab" aria-controls="editor" hx-patch="/synthetic-save">编辑简历</button></div>'
    + '<section id="editor" role="tabpanel" aria-labelledby="entry"></section>'],
  ['data htmx DELETE', '<a id="entry" href="#editor" data-hx-delete="/synthetic-save">编辑简历</a><section id="editor"></section>'],
]) test(`L1 section enter keeps ${name} manual before any request`, async t => {
  const f = fixture(t, html), plan = f.flow.navigation.plan(f.entry());
  assert.equal(plan.status, 'manual');
  passivePlan(plan);
  const result = await f.flow.ensure({ ready: () => false, allowEntry: true, timeoutMs: 20 });
  manualEntry(result);
  assert.equal(result.entryPlan.status, 'manual');
  assert.notEqual(result.reason, 'entry_activation_manual');
  passivePlan(result.entryPlan);
  f.assertInert();
});

for (const [name, target] of [
  ['duplicate names', '<a name="editor"></a><a name="editor"></a>'],
  ['id and name conflict', '<section id="editor"></section><a name="editor"></a>'],
  ['duplicate ids', '<section id="editor"></section><section id="editor"></section>'],
  ['non-anchor name', '<input name="editor">'],
  ['missing named anchor', '<a name="different"></a>'],
]) test(`L1 same-document anchor rejects ${name}`, async t => {
  const f = fixture(t, `<a id="entry" href="#editor">编辑简历</a>${target}`);
  assert.equal(f.flow.navigation.plan(f.entry()).status, 'manual');
  manualEntry(await f.flow.ensure({ ready: () => false, allowEntry: true, timeoutMs: 20 }));
  f.assertInert();
});

test('L1 same-document anchor decodes a unique named target without touching it', async t => {
  const f = fixture(t, '<a id="entry" href="#%E7%BC%96%E8%BE%91%E5%8C%BA">编辑简历</a><a name="编辑区" hidden></a>');
  const plan = f.flow.navigation.plan(f.entry());
  assert.equal(plan.status, 'planned');
  assert.equal(plan.strategy, 'anchor');
  assert.equal(plan.target, '编辑区');
  passivePlan(plan);
  manualEntry(await f.flow.ensure({ ready: () => false, allowEntry: true, timeoutMs: 20 }));
  assert.equal(f.document.querySelector('[name="编辑区"]').hidden, true);
  f.assertInert();
});

for (const [name, href, url] of [
  ['removed navigation value', '?tenant=fixture', `${defaultUrl}&section=editor`],
  ['duplicate navigation value', '?tenant=fixture&section=editor&section=work', defaultUrl],
  ['changed duplicate binding value', '?tenant=fixture&tenant=other&section=editor', `${defaultUrl}&tenant=fixture`],
  ['changed binding plus section', '?tenant=other&section=editor', defaultUrl],
]) test(`L1 query route rejects ${name}`, async t => {
  const f = fixture(t, `<a id="entry" href="${href}">编辑简历</a>`, url);
  assert.equal(f.flow.navigation.plan(f.entry()).status, 'manual');
  manualEntry(await f.flow.ensure({ ready: () => false, allowEntry: true, timeoutMs: 20 }));
  f.assertInert();
});

test('L1 query route preserves duplicate unrelated binding values', t => {
  const url = `${defaultUrl}&tenant=fixture`;
  const f = fixture(t, '<a id="entry" href="?tenant=fixture&tenant=fixture&tab=editor">编辑简历</a>', url);
  const plan = f.flow.navigation.plan(f.entry());
  assert.equal(plan.status, 'planned');
  assert.equal(plan.strategy, 'query');
  passivePlan(plan);
  f.assertInert();
});

test('L1 section enter honors a failing profile binding check before handlers', async t => {
  const f = fixture(t, '<a id="entry" href="#editor">编辑简历</a><section id="editor"></section>');
  await assert.rejects(f.flow.ensure({ ready: () => false, allowEntry: true, timeoutMs: 20,
    check() { throw Error('profile_binding_changed'); } }), /profile_binding_changed/);
  f.assertInert();
});

test('L1 section enter replans changed route ownership after inspection', async t => {
  const f = fixture(t, '<a id="entry" href="#editor">编辑简历</a><section id="editor"></section>');
  assert.equal(f.flow.inspect().entryPlan.status, 'planned');
  f.document.querySelector('#editor').remove();
  const result = await f.flow.ensure({ ready: () => false, allowEntry: true, timeoutMs: 20 });
  manualEntry(result);
  assert.equal(result.entryPlan.status, 'manual');
  passivePlan(result.entryPlan);
  f.assertInert({ unchangedDom: false });
});

test('L1 section enter rechecks non-GET evidence after the binding callback', async t => {
  const f = fixture(t, '<a id="entry" href="#editor">编辑简历</a><section id="editor"></section>');
  assert.equal(f.flow.inspect().entryPlan.status, 'planned');
  let checks = 0;
  const result = await f.flow.ensure({ ready: () => false, allowEntry: true, timeoutMs: 20,
    check() { if (++checks === 2) f.entry().setAttribute('data-method', 'post'); } });
  manualEntry(result);
  assert.equal(checks, 2);
  assert.equal(result.entryPlan.status, 'manual');
  passivePlan(result.entryPlan);
  f.assertInert({ unchangedDom: false });
});

test('L1 section enter rejects an identically labelled replacement during revalidation', async t => {
  const f = fixture(t, '<a id="entry" href="#editor">编辑简历</a><section id="editor"></section>');
  let checks = 0;
  const result = await f.flow.ensure({ ready: () => false, allowEntry: true, timeoutMs: 20,
    check() { if (++checks === 2) f.entry().replaceWith(f.entry().cloneNode(true)); } });
  manualEntry(result);
  assert.equal(checks, 2);
  assert.equal(result.reason, 'entry_changed');
  f.assertInert();
});

test('L1 existing writable readiness succeeds without activating an entry route', async t => {
  const f = fixture(t, '<button id="entry" type="button">编辑简历</button><input id="editor">');
  const result = await f.flow.ensure({ ready: () => true, allowEntry: true, timeoutMs: 100 });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'ready');
  assert.equal(result.entryAttempted, false);
  assert.equal(result.transitions.length, 0);
  assert.equal(result.writeAttempted, false);
  assert.equal(result.liveSupportClaimed, false);
  f.assertInert();
});

test('L1 transient readiness never becomes success or activates a fallback handler', async t => {
  const f = fixture(t, '<button id="entry" type="button">编辑简历</button>');
  let checks = 0;
  const result = await f.flow.ensure({ ready: () => ++checks === 1, allowEntry: true, timeoutMs: 100 });
  assert.equal(result.ok, false);
  assert.equal(result.entryAttempted, false);
  assert.equal(result.transitions.length, 0);
  assert.equal(result.saved, false);
  assert.equal(result.liveSupportClaimed, false);
  f.assertInert();
});

for (const drift of ['url', 'visibility', 'binding']) test(`L1 final async readiness revalidates ${drift}`, async t => {
  const dom = new JSDOM('<input id="editor">', {
    url: defaultUrl, runScripts: 'outside-only', pretendToBeVisual: true,
  });
  t.after(() => dom.window.close());
  dom.window.eval(source);
  let reads = 0, allowed = true;
  const pending = dom.window.ResumeFormFlow.ensure({ timeoutMs: 150,
    ready: async () => {
      await Promise.resolve();
      if (++reads === 2) {
        if (drift === 'url') dom.reconfigure({ url: `${defaultUrl}&section=changed` });
        if (drift === 'visibility') Object.defineProperty(dom.window.document, 'visibilityState', { value: 'hidden' });
        if (drift === 'binding') allowed = false;
      }
      return true;
    },
    check: () => { if (!allowed) throw Error('profile_binding_changed'); },
  });
  if (drift === 'binding') await assert.rejects(pending, /profile_binding_changed/);
  else {
    const result = await pending;
    manualEntry(result);
    assert.equal(result.reason, drift === 'url' ? 'form_document_changed' : 'fill_interrupted_page_hidden');
  }
  assert.equal(dom.window.document.querySelector('#editor').value, '');
});
