import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const sources = ['model', 'registry', 'native', 'date-controls'].map(name =>
  readFileSync(new URL(`../src/content/controls/${name}.js`, import.meta.url), 'utf8'));

function boot(t, { format = 'yyyy-MM-dd', handler, html = '<input id="target" class="Wdate">', library = true } = {}) {
  const dom = new JSDOM(`<!doctype html><body>${html}<input id="neighbor" value="KEEP"></body>`,
    { runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const { window } = dom, el = window.document.getElementById('target');
  const calls = { picker: 0, effects: [] };
  if (library) window.WdatePicker = () => { calls.picker++; };
  if (handler !== null) el.setAttribute('onfocus', handler ?? `WdatePicker({dateFmt:'${format}'})`);
  for (const event of ['focus', 'click', 'input', 'change', 'blur']) el.addEventListener(event, () => calls.effects.push(event));
  for (const source of sources) window.eval(source);
  const R = window.ResumeControls;
  return { window, el, R, calls, ctx: { allowWrite: true, check: async () => {} }, plan: value => R.plan(el, { value }) };
}

test('My97 detection reads only the reviewed literal config with explicit date/datetime precision', t => {
  for (const [format, adapter, precision, canonicalFormat] of [
    ['yyyy-MM-dd', 'my97-date', 'date', 'YYYY-MM-DD'],
    ['yyyy-MM-dd HH:mm', 'my97-datetime', 'datetime', 'YYYY-MM-DDTHH:mm'],
    ['yyyy-MM-dd HH:mm:ss', 'my97-datetime', 'datetime', 'YYYY-MM-DDTHH:mm:ss'],
  ]) {
    const f = boot(t, { format }), observation = f.window.ResumeDateControls.inspect(f.el);
    assert.equal(f.R.resolve(f.el).name, adapter);
    assert.equal(observation.status, 'observed');
    assert.equal(observation.precision, precision);
    assert.equal(observation.format, format);
    assert.equal(observation.canonicalFormat, canonicalFormat);
    assert.equal(observation.detectionEvidence, 'my97_function_and_literal_dateFmt');
    assert.equal(observation.readbackSource, 'html_input_value');
    assert.equal(observation.liveSupportClaimed, false);
    assert.deepEqual(f.calls, { picker: 0, effects: [] });
  }
});

test('My97 accepts harmless literal whitespace/return syntax without executing the handler', t => {
  const f = boot(t, { handler: ' return WdatePicker( { dateFmt : "yyyy-MM-dd" } ) ; ' });
  assert.equal(f.plan('2024-02-29').status, 'planned');
  assert.equal(f.calls.picker, 0);
  assert.deepEqual(f.calls.effects, []);
});

test('My97 rejects dynamic configuration, callbacks, redirected targets, and unsupported formats as manual', t => {
  const cases = [
    ["WdatePicker({dateFmt:dateFormat})", 'my97_config_unconfirmed'],
    ["WdatePicker({dateFmt:'yyyy-MM-dd',onpicked:save})", 'my97_config_unconfirmed'],
    ["WdatePicker({dateFmt:'yyyy-MM-dd',el:'neighbor'})", 'my97_config_unconfirmed'],
    ["WdatePicker({dateFmt:'yyyy-MM-dd',minDate:'2024-01-01'})", 'my97_config_unconfirmed'],
    ["WdatePicker({dateFmt:'yyyy-MM-dd'});save()", 'my97_config_unconfirmed'],
    ["WdatePicker({dateFmt:'dd/MM/yyyy'})", 'date_format_unconfirmed'],
    ["WdatePicker({dateFmt:'yyyy-MM'})", 'date_format_unconfirmed'],
  ];
  for (const [handler, reason] of cases) {
    const f = boot(t, { handler }), plan = f.plan('2024-02-29');
    assert.equal(f.R.resolve(f.el).name, 'date-unknown', handler);
    assert.equal(plan.status, 'manual', handler);
    assert.equal(plan.reason, reason, handler);
    assert.equal(plan.writeStarted, false);
    assert.equal(f.calls.picker, 0);
    assert.deepEqual(f.calls.effects, []);
  }
});

test('missing library, ambiguous handlers, wrong input type, and unknown picker identities stay manual', t => {
  const missing = boot(t, { library: false });
  assert.equal(missing.plan('2024-02-29').reason, 'my97_library_unconfirmed');
  const ambiguous = boot(t);
  ambiguous.el.setAttribute('onclick', "WdatePicker({dateFmt:'yyyy-MM-dd'})");
  assert.equal(ambiguous.plan('2024-02-29').reason, 'my97_config_unconfirmed');
  const wrongType = boot(t);
  wrongType.el.type = 'date';
  assert.equal(wrongType.plan('2024-02-29').status, 'manual');
  const unknown = boot(t, { handler: null, html: '<div class="unreviewed-date-picker"><input id="target"></div>' });
  assert.equal(unknown.R.resolve(unknown.el).name, 'date-unknown');
  assert.equal(unknown.plan('2024-02-29').status, 'manual');
  const attr = boot(t, { handler: null, html: '<input id="target" data-date-format="YYYY-MM-DD">' });
  assert.equal(attr.plan('2024-02-29').status, 'manual');
  const antUnknown = boot(t, { handler: null, html: '<div class="ant-picker"><div class="ant-picker-input"><input id="target"></div></div>' });
  assert.equal(antUnknown.R.resolve(antUnknown.el).name, 'date-unknown');
  assert.equal(antUnknown.plan('2024-02-29').status, 'manual');
  assert.equal(antUnknown.R.plan(antUnknown.el.closest('.ant-picker'), { value: '2024-02-29' }).status, 'manual');
  const downgraded = boot(t, { handler: null, html: '<input id="target" type="date">' });
  Object.defineProperty(downgraded.el, 'type', { value: 'text' });
  assert.equal(downgraded.R.resolve(downgraded.el).name, 'date-unknown');
  assert.equal(downgraded.plan('2024-02-29').status, 'manual');
});

test('My97 requires native model ownership and preserves readonly, disabled, and constrained controls', t => {
  const owned = boot(t);
  owned.el.__reactFiber$offline = { memoizedProps: { value: '' }, stateNode: owned.el };
  assert.equal(owned.plan('2024-02-29').reason, 'date_model_ownership_unconfirmed');
  const unknownWrapper = boot(t, { html: '<div class="ant-picker"><input id="target" class="Wdate"></div>' });
  assert.equal(unknownWrapper.plan('2024-02-29').reason, 'date_model_ownership_unconfirmed');
  for (const [attribute, reason] of [['readonly', 'readonly'], ['disabled', 'disabled'],
    ['min', 'date_constraint_unconfirmed'], ['max', 'date_constraint_unconfirmed'], ['step', 'date_constraint_unconfirmed']]) {
    const f = boot(t);
    f.el.setAttribute(attribute, '');
    const plan = f.plan('2024-02-29');
    assert.equal(plan.status, 'manual');
    assert.equal(plan.reason, reason);
    assert.deepEqual(f.calls.effects, []);
  }
  const fieldset = boot(t, { html: '<fieldset disabled><input id="target" class="Wdate"></fieldset>' });
  assert.equal(fieldset.plan('2024-02-29').reason, 'disabled');
});

test('My97 date and local datetime facts retain exact calendar and time precision', t => {
  const date = boot(t);
  assert.equal(date.plan('2024-02-29').status, 'planned');
  for (const value of ['2023-02-29', '2024-04-31', '2024-02', '2024-2-29', '2024-02-29T12:30', ['2024-02-29'], 2024]) {
    assert.equal(date.plan(value).reason, 'invalid_date_precision', String(value));
  }
  const minute = boot(t, { format: 'yyyy-MM-dd HH:mm' });
  assert.equal(minute.plan('2024-02-29T23:59').domValue, '2024-02-29 23:59');
  for (const value of ['2024-02-29T24:00', '2024-02-29T12:60', '2024-02-29 12:30',
    '2024-02-29T12:30:00', '2024-02-29T12:30Z', '2023-02-29T12:30']) {
    assert.equal(minute.plan(value).reason, 'invalid_date_precision', value);
  }
  const second = boot(t, { format: 'yyyy-MM-dd HH:mm:ss' });
  assert.equal(second.plan('2024-02-29T00:00:00').status, 'planned');
  assert.equal(second.plan('2024-02-29T12:30').reason, 'invalid_date_precision');
  assert.equal(second.plan('2024-02-29T12:30:60').reason, 'invalid_date_precision');
});

test('My97 preserves existing public values and refuses invalid readback shapes', t => {
  for (const [format, display, canonical] of [
    ['yyyy-MM-dd', '2024-02-29', '2024-02-29'],
    ['yyyy-MM-dd HH:mm', '2024-02-29 12:30', '2024-02-29T12:30'],
    ['yyyy-MM-dd HH:mm:ss', '2024-02-29 12:30:45', '2024-02-29T12:30:45'],
  ]) {
    const f = boot(t, { format });
    f.el.value = display;
    assert.equal(f.plan(canonical).status, 'success');
    assert.equal(f.plan(canonical.replace('2024', '2028')).reason, 'existing_value');
    assert.equal(f.el.value, display);
    assert.deepEqual(f.calls.effects, []);
  }
  const invalid = boot(t);
  invalid.el.value = '2023-02-29';
  assert.equal(invalid.plan('2024-02-29').reason, 'date_readback_unconfirmed');
  const invalidDisplay = boot(t, { format: 'yyyy-MM-dd HH:mm' });
  invalidDisplay.el.value = '2024-02-29T12:30';
  assert.equal(invalidDisplay.plan('2024-02-29T12:30').reason, 'date_readback_unconfirmed');
});

test('My97 writes require the existing guard and verify canonical plus display values without opening the picker', async t => {
  for (const [format, value, display] of [
    ['yyyy-MM-dd', '2024-02-29', '2024-02-29'],
    ['yyyy-MM-dd HH:mm', '2024-02-29T12:30', '2024-02-29 12:30'],
    ['yyyy-MM-dd HH:mm:ss', '2024-02-29T12:30:45', '2024-02-29 12:30:45'],
  ]) {
    const f = boot(t, { format }), adapter = f.R.resolve(f.el), instruction = f.plan(value);
    assert.equal((await adapter.write(f.el, instruction)).reason, 'shadow_mode');
    assert.deepEqual(f.calls, { picker: 0, effects: [] });
    assert.equal((await adapter.write(f.el, instruction, f.ctx)).attempts, 1);
    assert.equal(f.el.value, display);
    assert.deepEqual(f.calls, { picker: 0, effects: ['input', 'change', 'blur'] });
    const result = await adapter.verify(f.el, instruction, { settleMs: 0 });
    assert.equal(result.status, 'success');
    assert.equal(result.domReadback, display);
    assert.equal(result.modelReadback, value);
    assert.equal(f.window.document.getElementById('neighbor').value, 'KEEP');
  }
});

test('My97 stale configuration, library evidence, or user edits stop before any write events', async t => {
  for (const change of [f => f.el.setAttribute('onfocus', "WdatePicker({dateFmt:'yyyy-MM-dd HH:mm'})"),
    f => f.el.setAttribute('onfocus', "WdatePicker({dateFmt:'yyyy-MM-dd',onpicked:save})"),
    f => { delete f.window.WdatePicker; }, f => { f.el.value = '2024-03-01'; },
    f => { f.el.readOnly = true; }]) {
    const f = boot(t), adapter = f.R.resolve(f.el), instruction = f.plan('2024-02-29');
    change(f);
    const result = await adapter.write(f.el, instruction, f.ctx);
    assert.equal(result.status, 'unsupported');
    assert.equal(result.attempts, 0);
    assert.deepEqual(f.calls, { picker: 0, effects: [] });
  }
});

test('My97 verification rejects mismatches and observes later public-value reversion', async t => {
  const f = boot(t, { format: 'yyyy-MM-dd HH:mm' }), adapter = f.R.resolve(f.el);
  const instruction = f.plan('2024-02-29T12:30');
  assert.equal((await adapter.verify(f.el, instruction, { settleMs: 0 })).status, 'mismatch');
  await adapter.write(f.el, instruction, f.ctx);
  f.window.setTimeout(() => { f.el.value = ''; }, 5);
  assert.equal((await adapter.verify(f.el, instruction, { settleMs: 20 })).status, 'reverted');
  assert.equal((await adapter.verify(f.el, instruction, { previousSuccess: true })).status, 'reverted');
});

test('date registration is passive and safe to reinject', t => {
  const f = boot(t), before = f.R.list().length;
  f.window.eval(sources.at(-1));
  assert.equal(f.R.list().length, before);
  assert.deepEqual(f.calls, { picker: 0, effects: [] });
});
