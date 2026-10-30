import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const sources = ['model.js', 'registry.js', 'native.js', 'vue-controls.js'].map(name =>
  readFileSync(new URL(`../src/content/controls/${name}`, import.meta.url), 'utf8'));
const prose = value => value.replace(/\r\n?/gu, '\n');
function boot(name, { sync = true } = {}) {
  const dom = new JSDOM('<form><div id="editor"><textarea></textarea></div>'
    + '<input id="neighbor" value="keep"><button>Save</button></form>',
  { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://offline.invalid/' });
  const w = dom.window, root = w.document.getElementById('editor'), input = root.querySelector('textarea');
  w.ELEMENT = { version: '2.15.14' }; w.antd = { version: '1.7.8' };
  w.Element.prototype.getClientRects = () => [{ width: 8, height: 8 }];
  const props = { value: '', ...(name === 'ElInput' ? { type: 'textarea' } : {}) };
  const owner = { $el: root, $options: { name }, $props: props };
  root.__vue__ = owner;
  const events = [], effects = { submit: 0, save: 0 };
  for (const type of ['input', 'change', 'blur']) input.addEventListener(type, () => events.push(type));
  input.addEventListener('input', () => { if (sync) props.value = input.value; });
  w.document.querySelector('form').addEventListener('submit', event => { event.preventDefault(); effects.submit++; });
  w.document.querySelector('button').addEventListener('click', () => { effects.save++; });
  for (const source of sources) w.eval(source);
  return { dom, w, root, input, props, owner, events, effects, R: w.ResumeControls,
    ctx: { allowWrite: true, check: async () => {} } };
}

for (const [name, adapter] of [['ElInput', 'el-textarea'], ['ATextarea', 'antdv1-textarea']]) {
  test(`${adapter} rejects altered plan type or model channel without effects`, async t => {
    const h = boot(name); t.after(() => h.dom.window.close());
    for (const [key, value] of [['type', 'text'], ['modelValue', 'changed'], ['domValue', 'changed']]) {
      const plan = h.R.plan(h.input, { value: 'first\nsecond' });
      plan[key] = value;
      assert.equal((await h.R.resolve(h.input).write(h.input, plan, h.ctx)).reason, 'invalid_instruction');
      assert.equal((await h.R.verify(h.input, plan, { settleMs: 0 })).reason, 'invalid_instruction');
      assert.equal(h.input.value, '');
      assert.equal(h.props.value, '');
      assert.deepEqual(h.events, []);
    }
  });

  test(`${adapter} writes exact multiline prose and reads DOM plus Vue model without save effects`, async t => {
    const h = boot(name); t.after(() => h.dom.window.close());
    const value = ' Ａ  alpha\tbeta\r\n\r\n next \r尾\n', expected = prose(value);
    const plan = h.R.plan(h.input, { value });
    assert.equal(plan.adapter, adapter);
    assert.equal(plan.status, 'planned');
    assert.equal((await h.R.resolve(h.input).write(h.input, plan)).reason, 'shadow_mode');
    assert.equal(h.input.value, '');
    assert.equal((await h.R.resolve(h.input).write(h.input, plan, h.ctx)).attempts, 1);
    assert.equal(h.input.value, expected);
    assert.equal(h.props.value, expected);
    const verified = await h.R.verify(h.input, plan, { settleMs: 0 });
    assert.equal(verified.status, 'success');
    assert.equal(verified.domReadback, expected);
    assert.equal(verified.modelReadback, expected);
    assert.deepEqual(h.events, ['input', 'change', 'blur']);
    assert.deepEqual(h.effects, { submit: 0, save: 0 });
    assert.equal(h.w.document.getElementById('neighbor').value, 'keep');
    assert.equal(h.R.liveSupportClaimed, false);
  });

  test(`${adapter} only treats CRLF/CR as equivalent prose`, async t => {
    const h = boot(name, { sync: false }); t.after(() => h.dom.window.close());
    for (const [expected, changed] of [['a\nb', 'a b'], ['a\n\nb', 'a\nb'], ['a\tb', 'a b'], ['Ａ', 'A'], [' x ', 'x']]) {
      h.props.value = ''; h.input.value = '';
      const plan = h.R.plan(h.input, { value: expected });
      h.props.value = changed; h.input.value = expected;
      assert.equal((await h.R.verify(h.input, plan, { settleMs: 0 })).status, 'mismatch', 'model difference');
      h.props.value = expected; h.input.value = changed;
      assert.equal((await h.R.verify(h.input, plan, { settleMs: 0 })).status, 'mismatch', 'DOM difference');
      assert.equal(h.R.plan(h.input, { value: expected }).reason, 'existing_value');
    }
    h.props.value = 'a\r\nb\rc'; h.input.value = 'a\nb\nc';
    assert.equal(h.R.plan(h.input, { value: 'a\nb\nc' }).status, 'success');
  });

  test(`${adapter} preserves pending DOM prose and whitespace-only existing values`, t => {
    const h = boot(name); t.after(() => h.dom.window.close());
    for (const value of ['pending\ntext', ' ', '\n', '\t']) {
      h.props.value = ''; h.input.value = value;
      assert.equal(h.R.plan(h.input, { value: 'new prose' }).reason, 'existing_value');
      h.props.value = value; h.input.value = '';
      assert.equal(h.R.plan(h.input, { value: 'new prose' }).reason, 'existing_value');
    }
    assert.deepEqual(h.events, []);
  });

  test(`${adapter} fails readback when the framework ignores input and detects delayed reversion`, async t => {
    const h = boot(name, { sync: false }); t.after(() => h.dom.window.close());
    const plan = h.R.plan(h.input, { value: 'a\nb' });
    await h.R.resolve(h.input).write(h.input, plan, h.ctx);
    assert.equal((await h.R.verify(h.input, plan, { settleMs: 0 })).status, 'mismatch');
    h.props.value = 'a\nb';
    h.w.setTimeout(() => { h.props.value = 'a b'; }, 5);
    assert.equal((await h.R.verify(h.input, plan, { settleMs: 20 })).status, 'reverted');
  });

  test(`${adapter} respects DOM readonly, disabled fieldsets and maxlength before writing`, t => {
    const h = boot(name); t.after(() => h.dom.window.close());
    for (const attribute of ['readonly', 'aria-readonly', 'disabled']) {
      h.input.setAttribute(attribute, attribute.startsWith('aria-') ? 'true' : '');
      assert.equal(h.R.plan(h.input, { value: 'text' }).status, 'manual', attribute);
      h.input.removeAttribute(attribute);
    }
    h.root.setAttribute('aria-readonly', 'true');
    assert.equal(h.R.plan(h.input, { value: 'text' }).status, 'manual');
    h.root.removeAttribute('aria-readonly');
    h.root.setAttribute('aria-disabled', 'true');
    assert.equal(h.R.plan(h.input, { value: 'text' }).status, 'manual');
    h.root.removeAttribute('aria-disabled');
    const fieldset = h.w.document.createElement('fieldset');
    h.root.before(fieldset); fieldset.append(h.root); fieldset.disabled = true;
    assert.equal(h.R.plan(h.input, { value: 'text' }).status, 'manual');
    fieldset.disabled = false;
    h.input.maxLength = 3;
    assert.equal(h.R.plan(h.input, { value: 'a\r\nb' }).status, 'planned');
    assert.equal(h.R.plan(h.input, { value: 'a\nbc' }).reason, 'value_too_long');
    assert.deepEqual(h.events, []);
  });

  test(`${adapter} binds readback to the original Vue owner`, async t => {
    const h = boot(name); t.after(() => h.dom.window.close());
    const plan = h.R.plan(h.input, { value: 'new\nprose' });
    await h.R.resolve(h.input).write(h.input, plan, h.ctx);
    h.root.__vue__ = { ...h.owner, $props: { ...h.props } };
    assert.equal((await h.R.verify(h.input, plan, { settleMs: 0 })).status, 'unsupported');
    assert.equal((await h.R.resolve(h.input).write(h.input, plan, h.ctx)).reason, 'control_target_changed');
  });

  test(`${adapter} rechecks prose after an awaited effect guard`, async t => {
    const h = boot(name); t.after(() => h.dom.window.close());
    const plan = h.R.plan(h.input, { value: 'new\nprose' });
    let checks = 0;
    await assert.rejects(h.R.resolve(h.input).write(h.input, plan, { allowWrite: true, async check() {
      if (++checks === 2) h.input.value = 'arrived\nwhile waiting';
    } }), /existing_value/u);
    assert.equal(h.input.value, 'arrived\nwhile waiting');
    assert.deepEqual(h.events, []);
    assert.deepEqual(h.effects, { submit: 0, save: 0 });
  });

  test(`${adapter} never falls back to native textarea on an unknown library version`, t => {
    const h = boot(name); t.after(() => h.dom.window.close());
    if (name === 'ElInput') h.w.ELEMENT.version = '3.0.0';
    else h.w.antd.version = '4.0.0';
    assert.equal(h.R.resolve(h.input), null);
    assert.equal(h.R.plan(h.input, { value: 'text' }).status, 'manual');
  });
}
