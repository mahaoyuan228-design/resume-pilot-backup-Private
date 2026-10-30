import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const sources = ['model', 'registry', 'native'].map(name =>
  readFileSync(new URL(`../src/content/controls/${name}.js`, import.meta.url), 'utf8'));
const ctx = { allowWrite: true, check: async () => {} };
function boot(html) {
  const dom = new JSDOM(`<!doctype html><body><form>${html}<input id="neighbor" value="keep">
    <button type="submit">保存</button></form></body>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom, effects = [];
  window.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  for (const type of ['input', 'change', 'blur', 'click', 'submit']) {
    window.document.addEventListener(type, event => effects.push([type, event.target.id]), true);
  }
  for (const source of sources) window.eval(source);
  return { dom, window, R: window.ResumeControls, effects, get: id => window.document.getElementById(id) };
}
function safeNeighbor(f) {
  assert.equal(f.get('neighbor').value, 'keep');
  assert.equal(f.effects.some(([type, id]) => ['click', 'submit'].includes(type) || id === 'neighbor'), false);
  assert.equal(f.R.liveSupportClaimed, false);
}

test('country-code and phone selects use exact option codes and separate visible readback', async t => {
  const f = boot(`<select id="country" autocomplete="tel-country-code"><option value="">请选择</option>
    <option value="+86">中国 (+86)</option><option value="+852">香港 (+852)</option></select>
    <select id="phone" autocomplete="tel-national"><option value="">请选择</option>
    <option value="13900000000">手机 13900000000</option></select>`);
  t.after(() => f.dom.window.close());
  for (const [id, value, display] of [['country', '+86', '中国 (+86)'], ['phone', '13900000000', '手机 13900000000']]) {
    const el = f.get(id), adapter = f.R.resolve(el), plan = f.R.plan(el, { value });
    assert.equal(adapter.name, 'native-select');
    assert.equal(plan.status, 'planned'); assert.equal(plan.value, value); assert.equal(plan.domValue, display);
    assert.equal(plan.writeStarted, false); assert.equal(plan.liveSupportClaimed, false);
    assert.equal((await adapter.write(el, plan)).reason, 'shadow_mode');
    assert.equal(f.effects.length, id === 'country' ? 0 : 3);
    assert.equal((await adapter.write(el, plan, ctx)).attempts, 1);
    const verified = await adapter.verify(el, plan, { settleMs: 0 });
    assert.equal(verified.status, 'success'); assert.equal(verified.modelReadback, value); assert.equal(verified.domReadback, display);
    assert.equal(f.R.plan(el, { value }).status, 'success');
  }
  safeNeighbor(f);
});

test('year/month/day placeholders read empty for only reviewed tokens and sentinel values', async t => {
  const cases = [['年', '-1', '2000'], ['月', '0', '2'], ['日', '', '29'],
    ['year', 'year', '2000'], ['month', '-1', '2'], ['day', '0', '29'],
    ['YYYY', 'yyyy', '2000'], ['MM', 'MM', '02'], ['DD', '', '29']];
  const f = boot(cases.map(([label, sentinel, value], i) => `<select id="part${i}">
    <option value="${sentinel}">${label}</option><option value="${value}">${value}</option></select>`).join(''));
  t.after(() => f.dom.window.close());
  for (const [i, [, , value]] of cases.entries()) {
    const el = f.get(`part${i}`), adapter = f.R.resolve(el), model = adapter.readModel(el);
    assert.equal(model.value, ''); assert.equal(model.domValue, ''); assert.equal(model.options[0].disabled, true);
    const plan = f.R.plan(el, { value });
    assert.equal(plan.status, 'planned');
    assert.equal((await adapter.write(el, plan, ctx)).attempts, 1);
    assert.equal((await adapter.verify(el, plan, { settleMs: 0 })).status, 'success');
    const missing = f.R.plan(el, { value: cases[i][0] });
    assert.equal(missing.status, 'manual'); assert.equal(missing.reason, 'option_missing');
  }
  safeNeighbor(f);
});

test('ordinary empty prompts retain their display while real values never become placeholders', async t => {
  const f = boot(`<select id="prompt"><option value="">请选择</option><option value="2000">2000年</option></select>
    <select id="real"><option value="1999">年</option><option value="2000">2000年</option></select>
    <select id="unknown"><option value="-1">请选择年份</option><option value="2000">2000年</option></select>`);
  t.after(() => f.dom.window.close());
  assert.equal(f.R.resolve(f.get('prompt')).readModel(f.get('prompt')).domValue, '请选择');
  for (const [id, value] of [['real', '1999'], ['unknown', '-1']]) {
    const el = f.get(id), adapter = f.R.resolve(el), model = adapter.readModel(el);
    assert.equal(model.value, value); assert.equal(model.options[0].disabled, false);
    const plan = f.R.plan(el, { value: '2000' });
    assert.equal(plan.status, 'manual'); assert.equal(plan.reason, 'existing_value');
    assert.equal((await adapter.performWrite(el, { value: '2000' }, ctx)).reason, 'existing_value');
    assert.equal((await adapter.write(el, plan, ctx)).attempts, 0);
    assert.equal(el.value, value);
  }
  assert.deepEqual(f.effects, []); safeNeighbor(f);
});

test('dash prompts require sentinel codes and an agreeing year option family', t => {
  const f = boot(`${['', '-1', '0', '----'].map((value, i) => `<select id="dash${i}">
    <option value="${value}">----</option><option value="2000">2000年</option></select>`).join('')}
    <select id="real-dash"><option value="1999">----</option><option value="2000">2000年</option></select>
    <select id="mixed-dash"><option value="-1">----</option><option value="2000">2000年</option><option value="other">Other</option></select>
    <select id="mismatch-dash"><option value="0">----</option><option value="2000">2001年</option></select>
    <select id="numeric-dash"><option value="0">----</option><option value="2">2</option></select>`);
  t.after(() => f.dom.window.close());
  for (let i = 0; i < 4; i++) {
    const el = f.get(`dash${i}`), model = f.R.resolve(el).readModel(el);
    assert.equal(model.value, ''); assert.equal(model.domValue, ''); assert.equal(model.options[0].disabled, true);
    assert.equal(f.R.plan(el, { value: '----' }).reason, 'option_missing');
    assert.equal(f.R.plan(el, { value: '2000' }).status, 'planned');
  }
  for (const [id, value] of [['real-dash', '1999'], ['mixed-dash', '-1'], ['mismatch-dash', '0'], ['numeric-dash', '0']]) {
    const model = f.R.resolve(f.get(id)).readModel(f.get(id));
    assert.equal(model.value, value); assert.equal(model.domValue, '----'); assert.equal(model.options[0].disabled, false);
    assert.equal(f.R.plan(f.get(id), { value: '2000' }).status, 'manual');
  }
  assert.deepEqual(f.effects, []); safeNeighbor(f);
});

test('date-part prompts require a complete numeric option family and preserve self-described frequency codes', t => {
  const f = boot(`<select id="frequency"><option value="month">Month</option><option value="year">Year</option></select>
    <select id="mixed"><option value="0">月</option><option value="2">2月</option><option value="other">其他</option></select>
    <select id="mismatch"><option value="-1">年</option><option value="2000">2001年</option></select>
    <select id="bounds"><option value="0">日</option><option value="32">32日</option></select>
    <select id="empty"><option value="-1">年</option><option value="2000" disabled>2000年</option></select>
    <select id="proto"><option value="__proto__">__proto__</option><option value="29">29</option></select>
    <select id="suffix"><option value="0">月</option><option value="02">2月</option>
      <optgroup disabled><option value="unknown">未知</option></optgroup></select>`);
  t.after(() => f.dom.window.close());
  for (const [id, value, label] of [['frequency', 'month', 'Month'], ['mixed', '0', '月'],
    ['mismatch', '-1', '年'], ['bounds', '0', '日'], ['empty', '-1', '年'], ['proto', '__proto__', '__proto__']]) {
    const model = f.R.resolve(f.get(id)).readModel(f.get(id));
    assert.equal(model.value, value); assert.equal(model.domValue, label); assert.equal(model.options[0].disabled, false);
  }
  assert.equal(f.R.plan(f.get('frequency'), { value: 'year' }).reason, 'existing_value');
  assert.equal(f.R.plan(f.get('mixed'), { value: '2' }).reason, 'existing_value');
  const suffix = f.R.resolve(f.get('suffix')).readModel(f.get('suffix'));
  assert.equal(suffix.value, ''); assert.equal(suffix.domValue, ''); assert.equal(suffix.options[0].disabled, true);
  assert.deepEqual(f.effects, []); safeNeighbor(f);
});

test('unknown, ambiguous and disabled options remain manual without code inference or effects', t => {
  const f = boot(`<select id="codes"><option value="">请选择</option><option value="CN">中国 (+86)</option>
    <option value="+1">美国 (+1)</option><option value="+1">加拿大 (+1)</option>
    <option value="+852" disabled>香港 (+852)</option>
    <optgroup disabled><option value="+853">澳门 (+853)</option></optgroup></select>
    <div class="unknown-picker"><select id="framework"><option value="+86">中国 (+86)</option></select></div>
    <select id="disabled" disabled><option value="">请选择</option><option value="+86">中国 (+86)</option></select>`);
  t.after(() => f.dom.window.close());
  for (const [id, value, reason] of [['codes', '+86', 'option_missing'], ['codes', '+1', 'option_ambiguous'],
    ['codes', '+852', 'option_missing'], ['codes', '+853', 'option_missing'],
    ['framework', '+86', 'control_or_version_unconfirmed'], ['disabled', '+86', 'disabled']]) {
    const plan = f.R.plan(f.get(id), { value });
    assert.equal(plan.status, 'manual'); assert.equal(plan.reason, reason);
    assert.equal(plan.writeStarted, false); assert.equal(plan.liveSupportClaimed, false);
  }
  assert.deepEqual(f.effects, []); safeNeighbor(f);
});

test('select verification rejects either changed readback and observes later reversion', async t => {
  const f = boot(`<select id="country"><option value="">请选择</option><option value="+86">中国 (+86)</option>
    <option value="+852">香港 (+852)</option></select>`);
  t.after(() => f.dom.window.close());
  const el = f.get('country'), adapter = f.R.resolve(el), plan = f.R.plan(el, { value: '+86' });
  await adapter.write(el, plan, ctx);
  el.options[1].textContent = 'changed';
  assert.equal((await adapter.verify(el, plan, { settleMs: 0 })).status, 'mismatch');
  el.options[1].textContent = plan.domValue;
  assert.equal((await adapter.verify(el, plan, { settleMs: 0 })).status, 'success');
  f.window.setTimeout(() => { el.value = '+852'; }, 5);
  assert.equal((await adapter.verify(el, plan, { settleMs: 20 })).status, 'reverted');
  assert.equal(f.R.plan(el, { value: '+86' }).reason, 'existing_value');
  assert.equal((await adapter.write(el, plan, ctx)).reason, 'existing_value');
  assert.equal(el.value, '+852'); safeNeighbor(f);
});

test('reinjection replaces revision 6 select contracts before reading a date-part sentinel', t => {
  const f = boot('<select id="year"><option value="-1">年</option><option value="2000">2000</option></select>');
  t.after(() => f.dom.window.close());
  f.window.ResumeControls = { version: 1, revision: 6, list: () => [{ name: 'native-text' }] };
  for (const source of sources) f.window.eval(source);
  const R = f.window.ResumeControls;
  assert.equal(R.revision, 10);
  assert.equal(R.inspect(f.get('year')).model.value, '');
  assert.equal(R.plan(f.get('year'), { value: '2000' }).status, 'planned');
  assert.deepEqual(f.effects, []);
});
