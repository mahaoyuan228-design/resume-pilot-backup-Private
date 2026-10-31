import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const sources = ['model', 'registry', 'native'].map(name =>
  readFileSync(new URL(`../src/content/controls/${name}.js`, import.meta.url), 'utf8'));
const ctx = { allowWrite: true, check: async () => {} };
const desired = 'Example University';

function fixture({ delayed = false, commit = true, close = true } = {}) {
  const dom = new JSDOM(`<!doctype html><body><form>
    <input id="combo" type="search" role="combobox" aria-autocomplete="list" aria-controls="choices" aria-expanded="false">
    <div id="choices" role="listbox" hidden></div><input id="neighbor" value="KEEP">
    <button type="submit">Save</button></form></body>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, effects = [], clicks = [];
  w.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  for (const source of sources) w.eval(source);
  const input = w.document.getElementById('combo'), list = w.document.getElementById('choices');
  for (const type of ['input', 'change', 'blur', 'submit']) w.document.addEventListener(type, event => effects.push([type, event.target.id]));
  w.document.addEventListener('click', event => clicks.push(event.target));
  input.addEventListener('click', () => { list.hidden = false; input.setAttribute('aria-expanded', 'true'); });
  function option(label, attributes = {}) {
    const node = w.document.createElement('div'); node.setAttribute('role', 'option'); node.textContent = label;
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    node.addEventListener('click', () => {
      if (commit) {
        for (const sibling of list.querySelectorAll('[role="option"]')) sibling.setAttribute('aria-selected', 'false');
        node.setAttribute('aria-selected', 'true');
      }
      if (close) { list.hidden = true; input.setAttribute('aria-expanded', 'false'); }
    });
    list.append(node); return node;
  }
  const wrong = option('Unrelated University');
  let target;
  input.addEventListener('input', () => {
    wrong.hidden = true;
    if (delayed) {
      list.setAttribute('aria-busy', 'true');
      w.setTimeout(() => { target = option(desired); list.removeAttribute('aria-busy'); }, 30);
    } else target ||= option(desired);
  });
  const R = w.ResumeControls, plan = () => R.plan(input, { value: desired });
  return { dom, w, input, list, effects, clicks, option, R, plan, get target() { return target; } };
}
function preserved(f) {
  assert.equal(f.w.document.getElementById('neighbor').value, 'KEEP');
  assert.equal(f.effects.some(([type, id]) => type === 'submit' || id === 'neighbor'), false);
  assert.equal(f.clicks.some(node => node.matches('button,input[type="submit"]')), false);
  assert.equal(f.R.liveSupportClaimed, false);
}

for (const delayed of [false, true]) test(`ARIA combobox filters then clicks an exact owned option (delayed=${delayed})`, async t => {
  const f = fixture({ delayed }); t.after(() => f.dom.window.close());
  const adapter = f.R.resolve(f.input), plan = f.plan();
  assert.equal(adapter.name, 'native-combobox-search'); assert.equal(plan.status, 'planned');
  assert.equal((await adapter.write(f.input, plan)).reason, 'shadow_mode');
  assert.equal(f.effects.length, 0); assert.equal(f.clicks.length, 0);
  const written = await adapter.write(f.input, plan, ctx);
  assert.equal(written.strategy, 'ui'); assert.equal(written.interaction, 'search');
  assert.deepEqual(f.effects, [['input', 'combo']], 'filtering must not dispatch change/blur');
  assert.deepEqual(f.clicks, [f.input, f.target]);
  const readback = await adapter.verify(f.input, plan, { settleMs: 0 });
  assert.equal(readback.status, 'success'); assert.equal(readback.modelReadback, desired); assert.equal(readback.domReadback, desired);
  assert.equal(f.plan().status, 'success'); assert.equal(f.list.hidden, true); preserved(f);
});

test('typed query alone and a noncommitting option cannot verify a selection', async t => {
  const f = fixture({ commit: false }); t.after(() => f.dom.window.close());
  const adapter = f.R.resolve(f.input), plan = f.plan();
  f.input.value = desired;
  assert.equal((await adapter.verify(f.input, plan, { settleMs: 0 })).status, 'mismatch');
  assert.equal(f.plan().status, 'planned');
  await adapter.write(f.input, plan, ctx);
  assert.equal(f.clicks.includes(f.target), true);
  assert.equal((await adapter.verify(f.input, plan, { settleMs: 0 })).status, 'mismatch'); preserved(f);
});

test('a stale aria-selected flag cannot turn filtering into a clicked option', async t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  const adapter = f.R.resolve(f.input), plan = f.plan();
  f.option(desired, { 'aria-selected': 'true' }); f.input.value = desired;
  assert.equal((await adapter.verify(f.input, plan, { settleMs: 0 })).status, 'mismatch');
  assert.equal(f.clicks.length, 0); preserved(f);
});

test('selection readback detects reversion and cannot borrow a sibling or serialized plan', async t => {
  const f = fixture(); t.after(() => f.dom.window.close());
  const adapter = f.R.resolve(f.input), plan = f.plan();
  assert.equal((await adapter.write(f.input, JSON.parse(JSON.stringify(plan)), ctx)).reason, 'control_target_changed');
  await adapter.write(f.input, plan, ctx);
  f.w.setTimeout(() => f.target.setAttribute('aria-selected', 'false'), 5);
  assert.equal((await adapter.verify(f.input, plan, { settleMs: 20 })).status, 'reverted');
  const other = f.input.cloneNode(); other.id = 'other'; f.w.document.body.append(other);
  assert.equal((await adapter.verify(other, plan, { settleMs: 0 })).status, 'unsupported'); preserved(f);
});

test('duplicates are refused while hidden and disabled options cannot steal an exact click', async t => {
  for (const duplicate of [false, true]) {
    const f = fixture(); t.after(() => f.dom.window.close());
    const hidden = f.option(desired, { hidden: '' }), disabled = f.option(desired, { 'aria-disabled': 'true' });
    if (duplicate) f.option(desired);
    const adapter = f.R.resolve(f.input), plan = f.plan();
    const result = await adapter.write(f.input, plan, ctx);
    assert.equal(f.clicks.includes(hidden), false); assert.equal(f.clicks.includes(disabled), false);
    if (duplicate) { assert.equal(result.reason, 'option_ambiguous'); assert.deepEqual(f.clicks, [f.input]); }
    else { assert.equal(result.strategy, 'ui'); assert.deepEqual(f.clicks, [f.input, f.target]); }
    preserved(f);
  }
});

test('unknown or ambiguous combobox ownership stays manual without native-text fallback', t => {
  const mutations = [
    f => f.input.removeAttribute('aria-controls'),
    f => f.input.setAttribute('aria-controls', 'choices missing'),
    f => f.w.document.body.append(f.list.cloneNode()),
    f => { const peer = f.input.cloneNode(); peer.id = 'peer'; f.w.document.body.append(peer); },
    f => f.list.append(f.w.document.createElement('input')),
    f => f.input.setAttribute('aria-autocomplete', 'none'),
    f => f.input.removeAttribute('aria-expanded'),
    f => { f.input.parentElement.className = 'ant-select'; },
    f => { f.input.__vue__ = { $el: f.input, $props: { value: '' }, $options: { name: 'UnknownAutocomplete' } }; }
  ];
  for (const mutate of mutations) {
    const f = fixture(); t.after(() => f.dom.window.close()); mutate(f);
    assert.equal(f.R.resolve(f.input), null); assert.equal(f.plan().status, 'manual');
    assert.deepEqual(f.effects, []); assert.deepEqual(f.clicks, []); preserved(f);
  }
});

test('readonly, disabled, busy and existing data do not start interaction', async t => {
  for (const state of ['readonly', 'disabled', 'busy', 'existing', 'open']) {
    const f = fixture(); t.after(() => f.dom.window.close());
    if (state === 'readonly') f.input.readOnly = true;
    if (state === 'disabled') f.input.disabled = true;
    if (state === 'busy') f.list.setAttribute('aria-busy', 'true');
    if (state === 'existing') f.input.value = 'KEEP_EXISTING';
    if (state === 'open') { f.list.hidden = false; f.input.setAttribute('aria-expanded', 'true'); }
    const adapter = f.R.resolve(f.input), plan = f.plan();
    const result = await adapter.write(f.input, plan, ctx);
    assert.equal(result.status, 'unsupported'); assert.deepEqual(f.effects, []); assert.deepEqual(f.clicks, []); preserved(f);
  }
});

test('changed binding, detached input, busy options and new overlays stop before a later click effect', async t => {
  for (const change of ['binding', 'detached', 'overlay', 'option', 'busy']) {
    const f = fixture(); t.after(() => f.dom.window.close());
    const adapter = f.R.resolve(f.input), plan = f.plan();
    f.input.addEventListener('input', () => {
      f.target.addEventListener('pointerdown', () => {
        if (change === 'binding') f.input.setAttribute('aria-controls', 'other');
        if (change === 'detached') f.input.remove();
        if (change === 'overlay') { const foreign = f.w.document.createElement('div'); foreign.setAttribute('role', 'listbox'); f.w.document.body.append(foreign); }
        if (change === 'option') f.target.textContent = 'Changed';
        if (change === 'busy') f.list.setAttribute('aria-busy', 'true');
      });
    });
    await assert.rejects(adapter.write(f.input, plan, ctx), /control_target_changed|control_or_version_changed|control_changed|overlay_ambiguous|option_changed/u);
    assert.deepEqual(f.clicks, [f.input]); assert.equal(f.target.hasAttribute('aria-selected'), false); preserved(f);
  }
});
