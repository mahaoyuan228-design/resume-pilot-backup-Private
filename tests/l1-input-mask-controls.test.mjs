import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const sources = ['model', 'registry', 'native', 'vue-controls'].map(name =>
  readFileSync(new URL(`../src/content/controls/${name}.js`, import.meta.url), 'utf8'));
const writable = result => ['planned', 'success'].includes(result.status);
const cases = {
  phone: { attributes: 'type="tel"', mask: '### #### ####', raw: '13800138000' },
  bank: { attributes: 'autocomplete="cc-number" name="bankCard"', mask: '0000 0000 0000 0000', raw: '0011223344556677' },
  identity: { attributes: 'name="idcard"', mask: '###### ######## ###X', raw: '00112233445566778X' },
};
const ctx = { allowWrite: true, check: async () => {} };

function boot(t, family = 'native', kind = 'phone', { initial = '', sync = true, propMask = false } = {}) {
  const config = cases[kind], vue = family !== 'native';
  const input = `<input id="target" ${config.attributes}${propMask ? '' : ` data-mask="${config.mask}"`}>`;
  const html = vue ? `<div id="root" class="${family === 'el' ? 'el-input' : 'ant-input-wrapper'}">${input}</div>` : input;
  const dom = new JSDOM(`<!doctype html><body><form>${html}<input id="neighbor" value="KEEP">`
    + '<button id="save" type="button">Save</button><button type="submit">Submit</button></form></body>',
  { url: 'https://offline.invalid/input-mask', runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const w = dom.window, el = w.document.getElementById('target'), root = w.document.getElementById('root') || el;
  w.Element.prototype.getClientRects = () => [{ width: 12, height: 12 }];
  w.ELEMENT = { version: '2.15.14' }; w.antd = { version: '1.7.8' };
  const props = { value: initial, type: kind === 'phone' ? 'tel' : 'text', ...(propMask ? { mask: config.mask } : {}) };
  const owner = { $el: root, $props: props, $options: { name: family === 'el' ? 'ElInput' : 'AInput' } };
  if (vue) root.__vue__ = owner;
  el.value = initial;
  const effects = { clicks: 0, submit: 0, nonGet: 0 }, events = [], rawInputs = [];
  const format = value => {
    const raw = value.replace(/[\s()-]/gu, '').toUpperCase();
    let index = 0;
    return [...config.mask].map(token => /[#90X]/u.test(token) ? raw[index++] || '' : token).join('');
  };
  w.document.addEventListener('click', () => effects.clicks++);
  w.document.querySelector('form').addEventListener('submit', event => { event.preventDefault(); effects.submit++; });
  w.fetch = async (_url, options = {}) => { if ((options.method || 'GET') !== 'GET') effects.nonGet++; throw Error('offline'); };
  for (const name of ['input', 'change', 'blur']) el.addEventListener(name, () => events.push(name));
  el.addEventListener('input', () => {
    rawInputs.push(el.value);
    if (!sync) return;
    const displayed = format(el.value);
    if (vue) props.value = displayed;
    el.value = displayed;
  });
  for (const source of sources) w.eval(source);
  const R = w.ResumeControls;
  return { w, R, el, root, props, owner, effects, events, rawInputs, format, config,
    adapter: () => R.resolve(el), plan: value => R.plan(el, { value }),
    neighbor: w.document.getElementById('neighbor') };
}

for (const family of ['native', 'el', 'antdv1']) {
  for (const kind of Object.keys(cases)) {
    test(`${family} masked ${kind} writes raw strings and verifies formatted or canonical readback without saving`, async t => {
      const h = boot(t, family, kind), { raw } = h.config, instruction = h.plan(h.format(raw));
      assert.equal(instruction.adapter, `${family}-input-mask`);
      assert.equal(instruction.status, 'planned');
      for (const key of ['value', 'modelValue', 'domValue']) assert.equal(instruction[key], raw);
      assert.equal(instruction.liveSupportClaimed, false);
      assert.equal(instruction.writeStarted, false);
      assert.equal(h.R.liveSupportClaimed, false);
      assert.equal((await h.adapter().write(h.el, instruction)).reason, 'shadow_mode');
      assert.deepEqual(h.events, []);
      await h.adapter().write(h.el, instruction, ctx);
      assert.deepEqual(h.rawInputs, [raw]);
      assert.equal(h.el.value, h.format(raw));
      assert.equal((await h.R.verify(h.el, instruction, { settleMs: 0 })).status, 'success');
      h.el.value = raw;
      assert.equal((await h.R.verify(h.el, instruction, { settleMs: 0 })).status, 'success');
      assert.equal(h.plan(raw).status, 'success');
      const count = h.events.length;
      await h.adapter().write(h.el, instruction, ctx);
      assert.equal(h.events.length, count, 'a repeated canonical value emits no events');
      assert.equal(h.neighbor.value, 'KEEP');
      assert.deepEqual(h.effects, { clicks: 0, submit: 0, nonGet: 0 });
    });
  }
}

test('mask values retain leading zeros, normalize fullwidth digits and uppercase the explicit ID checksum', async t => {
  const phone = boot(t), instruction = phone.plan('１３８００１３８０００');
  assert.equal(instruction.value, cases.phone.raw);
  const identity = boot(t, 'native', 'identity');
  assert.equal(identity.plan(cases.identity.raw.toLowerCase()).value, cases.identity.raw);
  const bank = boot(t, 'native', 'bank');
  assert.equal(bank.plan(cases.bank.raw).value, cases.bank.raw);
  for (const value of [13800138000, null, true, ['13800138000'], {}, '1380013800', '138001380000',
    '138****8000', '138-ABCD-8000', '138/0013/8000']) {
    assert.equal(writable(phone.plan(value)), false, String(value));
  }
  assert.deepEqual(phone.events, []);
});

test('explicit format and reviewed Vue mask props use the same family', t => {
  const native = boot(t);
  native.el.removeAttribute('data-mask'); native.el.setAttribute('format', cases.phone.mask);
  assert.equal(native.plan(cases.phone.raw).adapter, 'native-input-mask');
  assert.equal(native.plan(cases.phone.raw).status, 'planned');
  for (const family of ['el', 'antdv1']) {
    const h = boot(t, family, 'phone', { propMask: true });
    assert.equal(h.plan(cases.phone.raw).adapter, `${family}-input-mask`);
    assert.equal(h.plan(cases.phone.raw).status, 'planned');
  }
});

test('explicit plus prefixes preserve all phone digits and never infer a country code', async t => {
  const h = boot(t);
  h.el.setAttribute('data-mask', '+## ### #### ####');
  const instruction = h.plan('+86 138 0013 8000');
  assert.equal(instruction.status, 'planned');
  assert.equal(instruction.value, '+8613800138000');
  assert.equal(h.plan('8613800138000').value, instruction.value);
  assert.equal(writable(h.plan(cases.phone.raw)), false, 'short national digits are not expanded');
  h.el.value = '+86 138 0013 8000';
  assert.equal((await h.R.verify(h.el, instruction, { settleMs: 0 })).status, 'success');
  const plain = boot(t);
  assert.equal(writable(plain.plan('+13800138000')), false, 'an undeclared plus is not discarded');
});

test('mask slot counts, maxlength and complete checksum values are enforced before any effect', t => {
  const h = boot(t);
  h.el.maxLength = 10;
  assert.equal(writable(h.plan(cases.phone.raw)), false);
  const identity = boot(t, 'native', 'identity');
  assert.equal(identity.plan('001122334455667789').status, 'planned', 'checksum slot also permits a digit');
  for (const value of ['00112233445566778', '00112233445566778*', '00112233445566778Y']) {
    assert.equal(writable(identity.plan(value)), false, value);
  }
  identity.el.setAttribute('data-mask', '###### ######## ####');
  assert.equal(writable(identity.plan(cases.identity.raw)), false, 'X requires an explicit checksum slot');
  assert.deepEqual(h.events, []);
  assert.deepEqual(identity.events, []);
});

test('unknown masks, function formats and ambiguous owners cannot fall through to ordinary text writes', t => {
  for (const mask of ['xxx-xxxx-xxxx', '### [####] ####', '### 9999 ####', '###/####/####', '']) {
    const h = boot(t); h.el.setAttribute('data-mask', mask);
    assert.equal(writable(h.plan(cases.phone.raw)), false, mask);
    assert.notEqual(h.R.resolve(h.el)?.name, 'native-text');
  }
  const vue = boot(t, 'el', 'phone', { propMask: true });
  let calls = 0;
  vue.props.mask = () => { calls++; return cases.phone.mask; };
  assert.equal(writable(vue.plan(cases.phone.raw)), false);
  assert.notEqual(vue.R.resolve(vue.el)?.name, 'el-input');
  assert.equal(calls, 0, 'page mask functions are never invoked');
  const ambiguous = boot(t, 'el');
  ambiguous.root.appendChild(ambiguous.w.document.createElement('input'));
  assert.equal(writable(ambiguous.plan(cases.phone.raw)), false);
});

test('date component display formats retain the existing date family', t => {
  const h = boot(t, 'el');
  h.el.removeAttribute('data-mask'); h.el.type = 'text';
  h.root.className = 'el-date-editor';
  h.owner.$options.name = 'ElDatePicker';
  Object.assign(h.props, { type: 'date', format: 'YYYY-MM-DD', valueFormat: 'yyyy-MM-dd' });
  assert.equal(h.R.resolve(h.el)?.name, 'el-date');
});

test('both existing sources are preserved and readback requires model plus DOM agreement', async t => {
  const existing = boot(t, 'el', 'phone', { initial: '139 0013 9000' });
  assert.equal(writable(existing.plan(cases.phone.raw)), false);
  assert.deepEqual(existing.events, []);
  const h = boot(t, 'el', 'phone', { sync: false }), instruction = h.plan(cases.phone.raw);
  await h.adapter().write(h.el, instruction, ctx);
  assert.equal((await h.R.verify(h.el, instruction, { settleMs: 0 })).status, 'mismatch');
  assert.equal(writable(h.plan('13900139000')), false, 'the changed DOM is also protected');
  h.props.value = cases.phone.raw;
  assert.equal((await h.R.verify(h.el, instruction, { settleMs: 0 })).status, 'success');
  const verification = h.R.verify(h.el, instruction, { settleMs: 25 });
  h.w.setTimeout(() => { h.props.value = ''; h.el.value = ''; }, 0);
  assert.equal((await verification).status, 'reverted');
});

test('original mask instructions bind their target, owner and format contract', async t => {
  for (const mutation of ['copied', 'peer', 'mask', 'owner']) {
    const h = boot(t, 'el'), instruction = h.plan(cases.phone.raw);
    let target = h.el, plan = instruction;
    if (mutation === 'copied') plan = { ...instruction };
    if (mutation === 'peer') {
      const clone = h.root.cloneNode(true); clone.id = 'peer'; h.root.after(clone);
      clone.__vue__ = { ...h.owner, $el: clone }; target = clone.querySelector('input'); target.id = 'peer-input';
    }
    if (mutation === 'mask') h.el.setAttribute('data-mask', '###-####-####');
    if (mutation === 'owner') h.root.__vue__ = { ...h.owner };
    const result = await h.adapter().write(target, plan, ctx);
    assert.equal(writable(result), false, mutation);
    assert.equal(target.value, '', mutation);
    assert.deepEqual(h.events, []);
  }
});

test('readonly, disabled, inert and changes between effects stop mask writes', async t => {
  for (const name of ['readonly', 'disabled', 'inert']) {
    const h = boot(t), instruction = h.plan(cases.phone.raw), adapter = h.adapter();
    h.el.setAttribute(name, '');
    const result = await adapter.write(h.el, instruction, ctx);
    assert.equal(writable(result), false, name);
    assert.deepEqual(h.events, []);
  }
  for (const mutation of ['disabled', 'mask', 'owner', 'aria-readonly', 'aria-disabled', 'inert']) {
    const h = boot(t, 'el'), instruction = h.plan(cases.phone.raw), adapter = h.adapter();
    h.el.addEventListener('input', () => {
      if (mutation === 'disabled') h.el.disabled = true;
      else if (mutation === 'mask') h.el.setAttribute('data-mask', '(###) #### ####');
      else if (mutation === 'owner') h.root.__vue__ = { ...h.owner };
      else h.root.setAttribute(mutation, mutation === 'inert' ? '' : 'true');
    });
    await assert.rejects(adapter.write(h.el, instruction, ctx), undefined, mutation);
    assert.deepEqual(h.events, ['input'], `${mutation} after input prevents change and blur`);
    assert.equal(h.neighbor.value, 'KEEP');
    assert.deepEqual(h.effects, { clicks: 0, submit: 0, nonGet: 0 });
  }
});
