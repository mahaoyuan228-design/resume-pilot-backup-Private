import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const files = ['model', 'registry', 'native', 'vue-controls'];
const sources = files.map(name => readFileSync(new URL(`../src/content/controls/${name}.js`, import.meta.url), 'utf8'));

function boot(html = '<input id="target">') {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  for (const source of sources) window.eval(source);
  return { dom, window, R: window.ResumeControls, M: window.ResumeControlModel,
    el: window.document.getElementById('target'), get: id => window.document.getElementById(id) };
}
const json = value => JSON.parse(JSON.stringify(value));

test('ordered registry gives the most specific claimant priority and preserves first claim for ties', t => {
  const f = boot(); t.after(() => f.dom.window.close());
  const spec = (name, priority) => ({ name, priority, lib: 'native', type: 'text',
    matches: el => el.id === 'target', libVersionProbe: () => ({ lib: 'native', version: 'html' }),
    readModel: el => ({ available: true, value: el.value, domValue: el.value }) });
  f.R.register(spec('generic-test', 5));
  f.R.register(spec('specific-first', 9000));
  f.R.register(spec('specific-second', 9000));
  assert.equal(f.R.resolve(f.el).name, 'specific-first');
  assert.throws(() => f.R.register(spec('specific-first', 9000)), /adapter_duplicate/u);
  const list = f.R.list();
  assert.equal(list[0].name, 'specific-first');
  assert.equal(list[1].name, 'specific-second');
});

test('four-state verification requires both DOM and model and observes a later reversion', async t => {
  const f = boot(); t.after(() => f.dom.window.close());
  let value = '', available = true;
  f.R.register({ name: 'dual-test', lib: 'native', type: 'text', priority: 9000,
    libVersionProbe: () => ({ lib: 'native', version: 'html' }), matches: el => el.id === 'target',
    readModel: el => ({ available, value, domValue: el.value }) });
  const adapter = f.R.resolve(f.el), instruction = f.R.plan(f.el, { value: 'expected' });
  assert.equal(instruction.status, 'planned');
  value = 'expected';
  assert.equal((await adapter.verify(f.el, instruction, { settleMs: 0 })).status, 'mismatch');
  f.el.value = 'expected'; value = '';
  assert.equal((await adapter.verify(f.el, instruction, { settleMs: 0 })).status, 'mismatch');
  value = 'expected';
  assert.equal((await adapter.verify(f.el, instruction, { settleMs: 0 })).status, 'success');
  f.window.setTimeout(() => { value = ''; }, 5);
  assert.equal((await adapter.verify(f.el, instruction, { settleMs: 20 })).status, 'reverted');
  assert.equal((await adapter.verify(f.el, instruction, { previousSuccess: true })).status, 'reverted');
  available = false;
  assert.equal((await adapter.verify(f.el, instruction)).status, 'unsupported');
});

test('native public writer stays inert by default and detects stale existing values at execution', async t => {
  const f = boot(); t.after(() => f.dom.window.close());
  const adapter = f.R.resolve(f.el), instruction = f.R.plan(f.el, { value: 'desired' });
  const before = await adapter.write(f.el, instruction);
  assert.equal(before.status, 'unsupported');
  assert.equal(before.reason, 'shadow_mode');
  assert.equal(f.el.value, '');
  f.el.value = 'user changed';
  const result = await adapter.write(f.el, instruction, { allowWrite: true, check: async () => {} });
  assert.equal(result.status, 'unsupported');
  assert.equal(result.reason, 'existing_value');
  assert.equal(f.el.value, 'user changed');
});

test('native module can be injected repeatedly without duplicate registration', t => {
  const f = boot(); t.after(() => f.dom.window.close());
  const before = f.R.list().length;
  f.window.eval(sources[2]);
  assert.equal(f.R.list().length, before);
  assert.equal(f.R.resolve(f.el).name, 'native-text');
});

test('an option label change invalidates an earlier instruction before any write effect', async t => {
  const f = boot('<select id="target"><option value="">请选择</option><option value="code">Old</option></select>');
  t.after(() => f.dom.window.close());
  const adapter = f.R.resolve(f.el), instruction = f.R.plan(f.el, { value: 'Old' });
  assert.equal(instruction.status, 'planned');
  assert.equal(instruction.value, 'code');
  assert.equal(instruction.domValue, 'Old');
  f.el.options[1].textContent = 'New';
  let effects = 0;
  for (const event of ['input', 'change', 'blur', 'click', 'pointerdown', 'mousedown']) f.el.addEventListener(event, () => { effects++; });
  const result = await adapter.write(f.el, instruction, { allowWrite: true, check: async () => {} });
  assert.equal(result.status, 'unsupported');
  assert.equal(result.reason, 'instruction_stale');
  assert.equal(result.attempts, 0);
  assert.equal(f.el.value, '');
  assert.equal(effects, 0);
});

test('loss of compatibility evidence after planning prevents the saved adapter from writing', async t => {
  const f = boot(); t.after(() => f.dom.window.close());
  let compatible = true, effects = 0;
  const adapter = f.R.register({ name: 'version-change-test', priority: 9000, lib: 'fixture-native', type: 'text',
    matches: el => el.id === 'target',
    libVersionProbe: () => compatible ? { lib: 'native', version: 'html' } : null,
    readModel: el => ({ available: true, value: el.value, domValue: el.value }),
    performWrite() { effects++; return { strategy: 'native', attempts: 1 }; }
  });
  const instruction = f.R.plan(f.el, { value: 'desired' });
  assert.equal(instruction.adapter, 'version-change-test');
  compatible = false;
  const result = await adapter.write(f.el, instruction, { allowWrite: true, check: async () => {} });
  assert.equal(result.status, 'unsupported');
  assert.equal(result.reason, 'control_or_version_changed');
  assert.equal(result.attempts, 0);
  assert.equal(f.el.value, '');
  assert.equal(effects, 0);
});

test('plain native controls cannot absorb unconfirmed component versions or shadow roots', t => {
  const f = boot('<input id="target"><div class="el-select"><input id="element"></div><div class="ant-picker"><input id="ant"></div><div class="phoenix-select"><input id="phoenix"></div><div id="host"></div>');
  t.after(() => f.dom.window.close());
  assert.equal(f.R.resolve(f.el).name, 'native-text');
  for (const id of ['element', 'ant', 'phoenix']) {
    assert.equal(f.R.resolve(f.get(id)), null);
    assert.equal(f.R.plan(f.get(id), { value: 'example' }).status, 'unsupported');
  }
  const shadow = f.get('host').attachShadow({ mode: 'open' });
  const input = f.window.document.createElement('input'); shadow.append(input);
  assert.equal(f.R.plan(input, { value: 'example' }).status, 'manual');
});

test('planner rejects ambiguous options and protects coded existing values, including pending remote searches', t => {
  const f = boot(); t.after(() => f.dom.window.close());
  const model = { available: true, value: '', domValue: '', options: [
    { value: 'first', label: '同名' }, { value: 'second', label: '同名' } ] };
  assert.equal(f.R.helpers.makePlan({ value: '同名' }, model, { type: 'select' }).reason, 'option_ambiguous');
  const existing = { ...model, value: 'existing', domValue: '原值', options: [{ value: 'new', label: '新值' }] };
  assert.equal(f.R.helpers.makePlan({ value: '新值' }, existing, { type: 'select' }).reason, 'existing_value');
  const remote = { ...existing, options: [], remote: true };
  assert.equal(f.R.helpers.makePlan({ value: '另一个学校' }, remote, { type: 'select-search' }).reason, 'existing_value');
});

test('date plans preserve precision, real calendar dates, known formats, and range ordering', t => {
  const f = boot(); t.after(() => f.dom.window.close());
  const month = { available: true, value: '', domValue: '', valueFormat: 'YYYY-MM' };
  assert.equal(f.R.helpers.makePlan({ value: '2023-01' }, month, { type: 'month' }).status, 'planned');
  assert.equal(f.R.helpers.makePlan({ value: '2023-01-12' }, month, { type: 'month' }).status, 'unsupported');
  assert.equal(f.R.helpers.makePlan({ value: '2023-13' }, month, { type: 'month' }).status, 'unsupported');
  const day = { ...month, valueFormat: 'YYYY-MM-DD' };
  assert.equal(f.R.helpers.makePlan({ value: '2023-02-29' }, day, { type: 'date' }).status, 'unsupported');
  assert.equal(f.R.helpers.makePlan({ value: '2024-02-29' }, day, { type: 'date' }).status, 'planned');
  assert.equal(f.R.helpers.makePlan({ value: '2024-01' }, { ...month, valueFormat: null }, { type: 'month' }).status, 'unsupported');
  assert.equal(f.R.helpers.makePlan({ value: ['2024-06', '2023-01'] }, month, { type: 'month-range' }).status, 'unsupported');
});

test('checkbox plans allow false to true and never remove existing group selections', t => {
  const f = boot('<input id="target" type="checkbox">'); t.after(() => f.dom.window.close());
  const plan = f.R.plan(f.el, { value: true });
  assert.equal(plan.status, 'planned');
  const grouped = f.R.helpers.makePlan({ value: ['乙'] }, { available: true, value: ['a'], domValue: ['甲'],
    options: [{ value: 'a', label: '甲' }, { value: 'b', label: '乙' }] }, { type: 'checkbox' });
  assert.deepEqual(json(grouped.value), ['a', 'b']);
  assert.deepEqual(json(grouped.domValue), ['甲', '乙']);
});

test('click guard rejects forbidden actions, input button values, links, implicit submits, disabled fieldsets and hidden pages', async t => {
  const f = boot('<button id="target" type="button">保存</button><input id="save-input" type="button" value="保存"><button id="apply" type="button">Apply</button><a id="link" href="/">选项</a><button id="submit">确定</button><fieldset disabled><input id="disabled" type="radio"></fieldset><button id="ok" type="button">确定</button>');
  t.after(() => f.dom.window.close());
  const ctx = { allowWrite: true, check: async () => {} };
  for (const id of ['target', 'save-input', 'apply', 'link', 'submit', 'disabled']) {
    const el = f.get(id); let clicks = 0;
    el.addEventListener('click', () => { clicks++; });
    assert.equal(f.R.helpers.clickAllowed(el), false, id);
    await assert.rejects(f.R.helpers.safeClick(el, ctx), /forbidden_click/u, id);
    assert.equal(clicks, 0, id);
  }
  let clicks = 0; f.get('ok').addEventListener('click', () => { clicks++; });
  await f.R.helpers.safeClick(f.get('ok'), ctx); assert.equal(clicks, 1);
  Object.defineProperty(f.window.document, 'visibilityState', { configurable: true, value: 'hidden' });
  await assert.rejects(f.R.helpers.safeClick(f.get('ok'), ctx), /fill_interrupted_page_hidden/u);
  assert.equal(clicks, 1);
});

test('native writes refuse effects while the page is hidden', async t => {
  const f = boot(); t.after(() => f.dom.window.close());
  const instruction = f.R.plan(f.el, { value: 'desired' });
  Object.defineProperty(f.window.document, 'visibilityState', { configurable: true, value: 'hidden' });
  await assert.rejects(f.R.resolve(f.el).write(f.el, instruction, { allowWrite: true, check: async () => {} }), /fill_interrupted_page_hidden/u);
  assert.equal(f.el.value, '');
});
