import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../src/content/controls/native.js', import.meta.url), 'utf8');

// These tests isolate the HTML control contract. Registry gate and dual-model
// verification are covered by registry tests and the built-extension zoo.
function boot(html) {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const adapters = new Map(), calls = [];
  const norm = value => String(value ?? '').normalize('NFKC').trim();
  async function check(ctx) {
    if (ctx?.allowWrite !== true || typeof ctx.check !== 'function') throw Error('shadow_mode');
    await ctx.check();
  }
  window.ResumeControls = {
    register(adapter) { adapters.set(adapter.name, adapter); }, createAdapter: adapter => adapter,
    helpers: {
      norm, equal: (a, b) => JSON.stringify(a) === JSON.stringify(b), tick: async () => {},
      async nativeSet(el, value, ctx) { await check(ctx); calls.push(['set', el.id, value]); el.value = value; },
      async safeClick(el, ctx) {
        await check(ctx);
        el.dispatchEvent(new window.MouseEvent('pointerdown', { bubbles: true }));
        await check(ctx);
        calls.push(['click', el.id]); el.click();
      }
    }
  };
  window.eval(source);
  const ctx = { allowWrite: true, check: async () => calls.push(['check']) };
  const get = id => window.document.getElementById(id);
  const probe = { framework: 'native', lib: 'native', available: true };
  return { dom, window, adapters, calls, ctx, get, probe };
}

test('native claiming excludes unknown framework controls and complex display inputs', t => {
  const f = boot(`<input id="plain"><textarea id="area"></textarea><select id="select"></select>
    <div class="el-form"><input id="element"></div><div class="ant-select"><input id="ant"></div>
    <div class="ivu-input-wrapper"><input id="ivu"></div><div class="ud-select"><input id="ud"></div>
    <div class="phoenix-picker"><input id="phoenix"></div><div class="cascader-plugins-wrap"><input id="pair"></div>
    <input id="password" type="password"><input id="date" type="date"><input id="radio" type="radio">`);
  t.after(() => f.dom.window.close());
  const adapter = f.adapters.get('native-text');
  assert.equal(adapter.matches(f.get('plain'), f.probe), true);
  for (const id of ['area', 'select', 'element', 'ant', 'ivu', 'ud', 'phoenix', 'pair', 'password', 'date', 'radio']) {
    assert.equal(adapter.matches(f.get(id), f.probe), false, id);
  }
  assert.equal(adapter.matches(f.get('plain'), { framework: 'react' }), false);
  assert.equal(adapter.matches(f.get('plain'), { lib: 'unrecognised' }), false);
  assert.equal(f.adapters.get('native-textarea').matches(f.get('area'), f.probe), true);
});

test('native text writers recheck existing, readonly, and disabled values before any helper effect', async t => {
  const f = boot('<input id="existing" value="keep"><input id="readonly" readonly><input id="disabled" disabled><textarea id="area"></textarea>');
  t.after(() => f.dom.window.close());
  const adapter = f.adapters.get('native-text');
  for (const [id, reason] of [['existing', 'existing_value'], ['readonly', 'readonly'], ['disabled', 'disabled']]) {
    const result = await adapter.performWrite(f.get(id), { value: 'replace' }, f.ctx);
    assert.equal(result.reason, reason);
  }
  assert.deepEqual(f.calls, []);
  assert.equal(f.get('existing').value, 'keep');
  await f.adapters.get('native-textarea').performWrite(f.get('area'), { value: 'two\nlines' }, f.ctx);
  assert.equal(f.get('area').value, 'two\nlines');
  assert.deepEqual(f.calls, [['check'], ['set', 'area', 'two\nlines']]);
});

test('native select exposes option codes, display labels, and disabled optgroups separately', async t => {
  const f = boot(`<select id="choice"><option value="">请选择</option><option value="UG">本科</option>
    <optgroup label="disabled" disabled><option value="PG">硕士</option></optgroup></select>`);
  t.after(() => f.dom.window.close());
  const adapter = f.adapters.get('native-select'), el = f.get('choice');
  const before = adapter.readModel(el, f.probe);
  assert.equal(before.value, '');
  assert.equal(before.domValue, '请选择');
  assert.equal(before.options.find(option => option.value === 'UG').label, '本科');
  assert.equal(before.options.find(option => option.value === 'PG').disabled, true);
  assert.equal((await adapter.performWrite(el, { value: 'PG' }, f.ctx)).reason, 'option_missing');
  assert.deepEqual(f.calls, []);
  await adapter.performWrite(el, { value: 'UG' }, f.ctx);
  const after = adapter.readModel(el, f.probe);
  assert.equal(after.value, 'UG');
  assert.equal(after.domValue, '本科');
});

test('native select refuses ambiguous option codes and stale plans that overwrite an existing choice', async t => {
  const f = boot(`<select id="duplicate"><option value="">请选择</option><option value="same">甲</option><option value="same">乙</option></select>
    <select id="existing"><option value="keep">原值</option><option value="new">新值</option></select>`);
  t.after(() => f.dom.window.close());
  const adapter = f.adapters.get('native-select');
  assert.equal((await adapter.performWrite(f.get('duplicate'), { value: 'same' }, f.ctx)).reason, 'ambiguous_option');
  assert.equal((await adapter.performWrite(f.get('existing'), { value: 'new' }, f.ctx)).reason, 'existing_value');
  assert.deepEqual(f.calls, []);
  assert.equal(f.get('existing').value, 'keep');
});

test('native radio grouping follows form ownership and keeps coded values distinct from labels', async t => {
  const f = boot(`<form id="first"><label><input id="a" name="gender" type="radio" value="1">男</label>
    <label><input id="b" name="gender" type="radio" value="2">女</label></form>
    <form id="second"><label><input id="other" name="gender" type="radio" value="1" checked>另一个表单</label></form>`);
  t.after(() => f.dom.window.close());
  const adapter = f.adapters.get('native-radio');
  const before = adapter.readModel(f.get('a'), f.probe);
  assert.equal(before.options.length, 2);
  assert.equal(before.value, '');
  await adapter.performWrite(f.get('a'), { value: '2' }, f.ctx);
  const after = adapter.readModel(f.get('a'), f.probe);
  assert.equal(after.value, '2');
  assert.equal(after.domValue, '女');
  assert.equal(f.get('other').checked, true);
  const calls = f.calls.length;
  assert.equal((await adapter.performWrite(f.get('a'), { value: '1' }, f.ctx)).reason, 'existing_value');
  assert.equal(f.calls.length, calls);
  assert.equal(f.get('b').checked, true);
});

test('native checkbox only adds a checked value and never toggles an existing selection off', async t => {
  const f = boot('<label><input id="check" type="checkbox">同意</label>');
  t.after(() => f.dom.window.close());
  const adapter = f.adapters.get('native-checkbox'), el = f.get('check');
  assert.equal(adapter.readModel(el, f.probe).value, false);
  await adapter.performWrite(el, { value: true }, f.ctx);
  assert.equal(el.checked, true);
  const calls = f.calls.length;
  assert.equal((await adapter.performWrite(el, { value: false }, f.ctx)).reason, 'existing_value');
  assert.equal(el.checked, true);
  assert.equal(f.calls.length, calls);
  assert.equal((await adapter.performWrite(el, { value: 'true' }, f.ctx)).reason, 'invalid_checkbox_value');
});

test('native radios include external form-associated options and exclude other form owners', async t => {
  const f = boot(`<form id="owner"><label><input id="inside" type="radio" name="choice" value="a">A</label></form>
    <label><input id="external" form="owner" type="radio" name="choice" value="b">B</label>
    <form id="other-owner"><input id="other" type="radio" name="choice" value="b" checked></form>
    <input id="unowned" type="radio" name="choice" value="b" checked>`);
  t.after(() => f.dom.window.close());
  const adapter = f.adapters.get('native-radio'), inside = f.get('inside');
  assert.deepEqual(Array.from(adapter.readModel(inside, f.probe).options, option => option.value), ['a', 'b']);
  assert.equal(adapter.readModel(inside, f.probe).value, '', 'the unowned checked radio is outside this group');
  assert.equal(adapter.readModel(f.get('unowned'), f.probe).options.length, 1);
  // jsdom's native radio activation uses DOM ancestry instead of form= ownership.
  // Check that ownership above, then isolate the external option's click/readback.
  f.get('unowned').checked = false;
  await adapter.performWrite(inside, { value: 'b' }, f.ctx);
  assert.deepEqual(f.calls.filter(call => call[0] === 'click'), [['click', 'external']]);
  assert.equal(f.get('external').checked, true);
  assert.equal(adapter.readModel(inside, f.probe).value, 'b');
  assert.equal(adapter.readModel(inside, f.probe).domValue, 'B');
  assert.equal(f.get('other').checked, true);
  assert.equal(f.get('unowned').checked, false);
});

test('native radio writers guard both the requested element and the selected target', async t => {
  for (const change of ['requested-disabled', 'requested-readonly', 'target-readonly', 'detached']) {
    const f = boot('<label><input id="a" type="radio" name="choice" value="a">A</label><label><input id="b" type="radio" name="choice" value="b">B</label>');
    t.after(() => f.dom.window.close());
    if (change === 'requested-disabled') f.get('a').disabled = true;
    if (change === 'requested-readonly') f.get('a').readOnly = true;
    if (change === 'target-readonly') f.get('b').setAttribute('aria-readonly', 'true');
    const el = f.get('a');
    if (change === 'detached') el.remove();
    const result = await f.adapters.get('native-radio').performWrite(el, { value: 'b' }, f.ctx);
    assert.equal(result.reason, change === 'requested-disabled' ? 'disabled' : change === 'detached' ? 'target_detached' : 'readonly', change);
    assert.deepEqual(f.calls, [], change);
    assert.equal(f.get('b').checked, false, change);
  }
});

test('native radio writers stop before click when an option or its owner changes during pointerdown', async t => {
  const mutations = {
    name: f => { f.get('b').name = 'changed'; },
    form: f => { f.get('b').setAttribute('form', 'other'); },
    value: f => { f.get('b').value = 'changed'; },
    label: f => { f.get('b').setAttribute('aria-label', 'changed'); },
    disabled: f => { f.get('b').disabled = true; },
    readonly: f => { f.get('b').setAttribute('aria-readonly', 'true'); },
    selection: f => { f.get('a').checked = true; },
    detached: f => { f.get('b').remove(); },
    framework: f => { f.get('b').parentElement.className = 'ant-radio-wrapper'; }
  };
  for (const [name, mutate] of Object.entries(mutations)) {
    const f = boot('<form id="other"></form><label><input id="a" type="radio" name="choice" value="a">A</label><label><input id="b" type="radio" name="choice" value="b">B</label>');
    t.after(() => f.dom.window.close());
    const target = f.get('b');
    let clicks = 0;
    target.addEventListener('click', () => { clicks++; });
    target.addEventListener('pointerdown', () => mutate(f));
    await assert.rejects(f.adapters.get('native-radio').performWrite(f.get('a'), { value: 'b' }, f.ctx), /control_changed/u, name);
    assert.equal(clicks, 0, name);
    assert.equal(target.checked, false, name);
  }
});

test('native switch is a distinct boolean checkbox contract with additive writes and readback', async t => {
  const f = boot('<label><input id="toggle" type="checkbox" role="switch">开关</label>');
  t.after(() => f.dom.window.close());
  const el = f.get('toggle'), adapter = f.adapters.get('native-switch');
  assert.equal(adapter.matches(el, f.probe), true);
  assert.equal(f.adapters.get('native-checkbox').matches(el, f.probe), false);
  assert.equal(adapter.readModel(el, f.probe).value, false);
  await adapter.performWrite(el, { value: true }, f.ctx);
  assert.equal(adapter.readModel(el, f.probe).value, true);
  assert.equal(adapter.readModel(el, f.probe).domValue, true);
  const calls = f.calls.length;
  assert.equal((await adapter.performWrite(el, { value: false }, f.ctx)).reason, 'existing_value');
  assert.equal((await adapter.performWrite(el, { value: 'true' }, f.ctx)).reason, 'invalid_switch_value');
  assert.equal(f.calls.length, calls);
});

test('native checkbox and switch recheck readonly and checked state before the click', async t => {
  for (const type of ['checkbox', 'switch']) {
    for (const mutation of ['readonly', 'checked', 'role', 'type']) {
      const f = boot(`<input id="toggle" type="checkbox"${type === 'switch' ? ' role="switch"' : ''}>`);
      t.after(() => f.dom.window.close());
      const el = f.get('toggle');
      let clicks = 0;
      el.addEventListener('click', () => { clicks++; });
      el.addEventListener('pointerdown', () => {
        if (mutation === 'readonly') el.readOnly = true;
        if (mutation === 'checked') el.checked = true;
        if (mutation === 'role') el.setAttribute('role', 'radio');
        if (mutation === 'type') el.type = 'submit';
      });
      await assert.rejects(f.adapters.get(`native-${type}`).performWrite(el, { value: true }, f.ctx), /control_changed/u);
      assert.equal(clicks, 0, `${type}/${mutation}`);
    }
  }
});

test('uploads stay manual even inside a framework wrapper', async t => {
  const f = boot('<div class="ant-upload"><input id="file" type="file"></div>');
  t.after(() => f.dom.window.close());
  const adapter = f.adapters.get('upload'), el = f.get('file');
  assert.equal(adapter.matches(el, { lib: 'ant-design-vue' }), true);
  assert.equal(adapter.plan({ value: 'file.pdf' }, adapter.readModel(el, f.probe)).status, 'manual');
  assert.equal((await adapter.performWrite(el, { value: 'file.pdf' }, f.ctx)).reason, 'upload_manual');
  assert.equal(el.files.length, 0);
  assert.deepEqual(f.calls, []);
});
