import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const sources = ['model', 'registry', 'native'].map(name =>
  readFileSync(new URL(`../src/content/controls/${name}.js`, import.meta.url), 'utf8'));

function boot(t, html = '<input id="target" type="date">') {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  for (const source of sources) dom.window.eval(source);
  const { window } = dom, R = window.ResumeControls;
  const get = id => window.document.getElementById(id);
  const el = get('target');
  return { window, R, el, get, ctx: { allowWrite: true, check: async () => {} },
    plan: value => R.plan(el, { value }) };
}

test('date and month detection requires native input type and rejects framework/My97 fallthrough', t => {
  const f = boot(t, `<input id="target" type="date"><input id="month" type="month">
    <input id="text"><input id="unknown" type="datetime-local">
    <input id="my97" class="Wdate" onfocus="WdatePicker({dateFmt:'yyyy-MM-dd'})">
    <input id="marker" onclick="unreviewed(WdatePicker)">
    <div class="ant-picker"><input id="framework" type="date"></div>
    <input id="react" type="month">`);
  f.get('react').__reactFiber$offline = { memoizedProps: { value: '' }, stateNode: f.get('react') };
  assert.equal(f.R.resolve(f.el).name, 'native-date');
  assert.equal(f.R.resolve(f.get('month')).name, 'native-month');
  assert.equal(f.R.resolve(f.get('text')).name, 'native-text');
  for (const id of ['unknown', 'my97', 'marker', 'framework', 'react']) assert.equal(f.R.resolve(f.get(id)), null, id);
  const model = f.R.inspect(f.el).model;
  assert.equal(model.valueFormat, 'YYYY-MM-DD');
  assert.equal(model.datePrecision, 'date');
  assert.equal(model.detectionEvidence, 'html_input_type');
  assert.equal(model.readbackSource, 'html_input_value');
  assert.equal(f.R.liveSupportClaimed, false);
});

test('native date planning accepts real leap days and requires exact fact precision', t => {
  const f = boot(t);
  assert.equal(f.plan('2024-02-29').status, 'planned');
  for (const value of ['2023-02-29', '2024-04-31', '2024-01', '2024-2-01', '2024-01-01T00:00', '01/02/2024', ['2024-01-01'], 2024]) {
    assert.equal(f.plan(value).status, 'manual', String(value));
    assert.equal(f.plan(value).reason, 'invalid_date_precision', String(value));
  }
  assert.equal(f.plan('').reason, 'no_fact');
});

test('native month planning never invents or truncates a day', t => {
  const f = boot(t, '<input id="target" type="month">');
  assert.equal(f.plan('2024-02').status, 'planned');
  for (const value of ['2024-02-01', '2024-13', '2024-2', '2024-00']) assert.equal(f.plan(value).reason, 'invalid_date_precision');
  assert.equal(f.R.inspect(f.el).model.valueFormat, 'YYYY-MM');
});

test('native dates enforce minimum, maximum, and step with HTML units and base rules', t => {
  const f = boot(t, '<input id="target" type="date" min="2024-02-28" max="2024-03-02" step="2">');
  assert.equal(f.plan('2024-02-28').status, 'planned');
  assert.equal(f.plan('2024-03-01').status, 'planned');
  assert.equal(f.plan('2024-02-29').reason, 'date_step_mismatch');
  assert.equal(f.plan('2024-02-27').reason, 'date_out_of_range');
  assert.equal(f.plan('2024-03-03').reason, 'date_out_of_range');
  f.el.removeAttribute('min');
  f.el.removeAttribute('max');
  f.el.setAttribute('value', '2024-02-29');
  f.el.value = '';
  assert.equal(f.plan('2024-03-02').status, 'planned');
  assert.equal(f.plan('2024-03-01').reason, 'date_step_mismatch');
  f.el.step = 'any';
  assert.equal(f.plan('2024-03-01').status, 'planned');
});

test('native month step uses whole months rather than millisecond day approximations', t => {
  const f = boot(t, '<input id="target" type="month" min="2023-11" max="2024-08" step="3">');
  for (const value of ['2023-11', '2024-02', '2024-05', '2024-08']) assert.equal(f.plan(value).status, 'planned', value);
  assert.equal(f.plan('2024-01').reason, 'date_step_mismatch');
  assert.equal(f.plan('2024-11').reason, 'date_out_of_range');
});

test('unknown or malformed native date constraints stay manual', t => {
  const f = boot(t);
  for (const [name, value] of [['min', 'tomorrow'], ['max', '2024-02-30'], ['step', '0'], ['step', '-1'], ['step', 'NaN'], ['step', 'two']]) {
    f.el.setAttribute(name, value);
    assert.equal(f.plan('2024-02-29').status, 'manual');
    assert.equal(f.plan('2024-02-29').reason, 'date_constraint_unconfirmed');
    f.el.removeAttribute(name);
  }
  f.el.min = '2025-01-01'; f.el.max = '2024-01-01';
  assert.equal(f.plan('2024-02-29').reason, 'date_constraint_unconfirmed');
});

test('native date readonly, disabled fieldsets, and existing values are preserved', async t => {
  const f = boot(t, '<input id="target" type="date" readonly><fieldset disabled><input id="disabled" type="month"></fieldset>');
  assert.equal(f.plan('2024-02-29').reason, 'readonly');
  assert.equal(f.R.plan(f.get('disabled'), { value: '2024-02' }).reason, 'disabled');
  f.el.readOnly = false;
  f.el.value = '2024-02-29';
  assert.equal(f.plan('2024-02-29').status, 'success');
  assert.equal(f.plan('2024-03-01').reason, 'existing_value');
  const adapter = f.R.resolve(f.el);
  assert.equal((await adapter.write(f.el, f.plan('2024-02-29'), f.ctx)).attempts, 0);
  assert.equal(f.el.value, '2024-02-29');
});

test('native date write is shadow by default, then verifies HTML value across settled readbacks', async t => {
  const f = boot(t), adapter = f.R.resolve(f.el), instruction = f.plan('2024-02-29');
  const effects = [];
  for (const event of ['input', 'change', 'blur', 'click']) f.el.addEventListener(event, () => effects.push(event));
  assert.equal((await adapter.write(f.el, instruction)).reason, 'shadow_mode');
  assert.deepEqual(effects, []);
  assert.equal((await adapter.write(f.el, instruction, f.ctx)).attempts, 1);
  assert.deepEqual(effects, ['input', 'change', 'blur']);
  const readback = await adapter.verify(f.el, instruction, { settleMs: 0 });
  assert.equal(readback.status, 'success');
  assert.equal(readback.domReadback, '2024-02-29');
  assert.equal(readback.modelReadback, '2024-02-29');
  f.window.setTimeout(() => { f.el.value = ''; }, 5);
  assert.equal((await adapter.verify(f.el, instruction, { settleMs: 20 })).status, 'reverted');
});

test('stale native date constraints, ownership, or existing values stop before events', async t => {
  for (const mutate of [el => { el.min = '2025-01-01'; }, el => { el.value = '2024-03-01'; },
    el => { el.type = 'month'; }, el => { el.className = 'Wdate'; }]) {
    const f = boot(t), adapter = f.R.resolve(f.el), instruction = f.plan('2024-02-29');
    let effects = 0;
    f.el.addEventListener('input', () => effects++);
    mutate(f.el);
    const result = await adapter.write(f.el, instruction, f.ctx);
    assert.equal(result.status, 'unsupported');
    assert.equal(result.attempts, 0);
    assert.equal(effects, 0);
  }
});
