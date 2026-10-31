import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { readControlCandidatesInPage } from '../src/background/controls-write.mjs';

const sources = ['model', 'registry', 'native', 'vue-controls'].map(name =>
  readFileSync(new URL(`../src/content/controls/${name}.js`, import.meta.url), 'utf8'));
const families = ['native', 'aria', 'el', 'antdv1'];
const adapters = { native: 'native-number', aria: 'aria-number', el: 'el-number', antdv1: 'antdv1-number' };
const writable = result => ['planned', 'success'].includes(result.status);

function boot(t, family = 'native', { initial = null, sync = true, props: extraProps = {} } = {}) {
  const vue = ['el', 'antdv1'].includes(family);
  const prefix = family === 'el' ? 'el-input-number' : 'ant-input-number';
  const upClass = family === 'el' ? `${prefix}__increase` : `${prefix}-handler-up`;
  const downClass = family === 'el' ? `${prefix}__decrease` : `${prefix}-handler-down`;
  const input = `<input id="target" type="${family === 'native' ? 'number' : 'text'}" step="0.1"`
    + `${family === 'aria' ? ' role="spinbutton"' : ''}${initial == null ? '' : ` value="${initial}"`}>`;
  const html = vue ? `<div id="root" class="${prefix}">${input}`
    + `<button type="button" class="${upClass}" aria-label="Increase">+</button>`
    + `<button type="button" class="${downClass}" aria-label="Decrease">−</button></div>` : input;
  const dom = new JSDOM(`<form>${html}<input id="neighbor" value="KEEP">`
    + '<button id="save" type="button">Save</button><button type="submit">Submit</button></form>',
  { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://offline.invalid/number' });
  t.after(() => dom.window.close());
  const w = dom.window, el = w.document.getElementById('target'), root = w.document.getElementById('root') || el;
  w.Element.prototype.getClientRects = () => [{ width: 8, height: 8 }];
  w.ELEMENT = { version: '2.15.14' }; w.antd = { version: '1.7.8' };
  const props = { value: initial, step: 0.1, ...extraProps };
  const owner = { $el: root, $options: { name: family === 'el' ? 'ElInputNumber' : 'AInputNumber' }, $props: props };
  if (vue) root.__vue__ = owner;
  if (family === 'aria') el.setAttribute('aria-valuenow', initial == null ? '' : String(initial));
  const events = [], keyEvents = [], effects = { save: 0, submit: 0, stepClicks: 0, stepKeys: 0 };
  for (const type of ['input', 'change', 'blur']) el.addEventListener(type, () => events.push(type));
  el.addEventListener('input', () => {
    if (!sync) return;
    if (vue) props.value = el.value === '' ? null : Number(el.value);
    if (family === 'aria') el.setAttribute('aria-valuenow', el.value);
  });
  for (const type of ['keydown', 'keyup']) el.addEventListener(type, event => {
    keyEvents.push([type, event.key, event.code, event.keyCode, event.which]);
    if (type !== 'keydown' || !vue || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    effects.stepKeys++;
    if (sync) {
      props.value = Number((props.value + (event.key === 'ArrowUp' ? 1 : -1) * props.step).toFixed(10));
      el.value = String(props.value);
    }
  });
  const up = root.querySelector(`.${upClass}`), down = root.querySelector(`.${downClass}`);
  for (const [button, direction] of [[up, 1], [down, -1]]) button?.addEventListener('click', () => {
    effects.stepClicks++;
    if (sync) {
      props.value = Number((props.value + direction * props.step).toFixed(10));
      el.value = String(props.value);
    }
  });
  w.document.getElementById('save').addEventListener('click', () => effects.save++);
  w.document.querySelector('form').addEventListener('submit', event => { event.preventDefault(); effects.submit++; });
  for (const source of sources) w.eval(source);
  const R = w.ResumeControls, ctx = { allowWrite: true, check: async () => {} };
  return { w, el, root, props, owner, up, down, events, keyEvents, effects, R, ctx, adapter: () => R.resolve(el),
    plan: fact => R.plan(el, fact), neighbor: w.document.getElementById('neighbor') };
}

for (const family of families) {
  test(`${family} numeric L1 writes zero and decimal facts, reads numbers, and never saves`, async t => {
    const h = boot(t, family), plan = h.plan({ value: '0.2' });
    assert.equal(plan.adapter, adapters[family]);
    assert.equal(plan.status, 'planned');
    assert.equal(plan.operation, 'set');
    for (const key of ['value', 'modelValue', 'domValue']) assert.equal(plan[key], 0.2);
    assert.equal(plan.liveSupportClaimed, false);
    assert.equal((await h.adapter().write(h.el, plan)).reason, 'shadow_mode');
    assert.equal(h.el.value, '');
    assert.deepEqual(h.events, []);
    assert.equal((await h.adapter().write(h.el, plan, h.ctx)).attempts, 1);
    const result = await h.R.verify(h.el, plan, { settleMs: 0 });
    assert.equal(result.status, 'success');
    assert.equal(result.modelReadback, 0.2);
    assert.equal(result.domReadback, 0.2);
    assert.deepEqual(h.effects, { save: 0, submit: 0, stepClicks: 0, stepKeys: 0 });
    assert.equal(h.neighbor.value, 'KEEP');
    assert.equal(h.plan({ value: 0.2 }).status, 'success');
    assert.equal(writable(h.plan({ value: 0.3 })), false, 'absolute writes preserve an existing different number');
    const zero = boot(t, family);
    const zeroPlan = zero.plan({ value: 0 });
    assert.equal(zeroPlan.status, 'planned');
    await zero.adapter().write(zero.el, zeroPlan, zero.ctx);
    assert.equal((await zero.R.verify(zero.el, zeroPlan, { settleMs: 0 })).status, 'success');
  });

  test(`${family} explicit inc/dec changes one step and cannot replay a relative operation`, async t => {
    const h = boot(t, family, { initial: 0.2 });
    for (const [operation, expected] of [['inc', 0.3], ['dec', 0.2]]) {
      const plan = h.plan({ operation });
      assert.equal(plan.status, 'planned');
      assert.equal(plan.value, expected, 'decimal stepping has no binary rounding residue');
      await h.adapter().write(h.el, plan, h.ctx);
      assert.equal((await h.R.verify(h.el, plan, { settleMs: 0 })).status, 'success');
      const keys = h.effects.stepKeys;
      await h.adapter().write(h.el, plan, h.ctx);
      assert.equal(Number(h.el.value), expected, 'replay cannot apply a second step');
      assert.equal(h.effects.stepKeys, keys);
    }
    assert.equal(h.effects.stepKeys, ['el', 'antdv1'].includes(family) ? 2 : 0);
    assert.equal(h.effects.stepClicks, 0);
    if (['el', 'antdv1'].includes(family)) assert.deepEqual(h.keyEvents, [
      ['keydown', 'ArrowUp', 'ArrowUp', 38, 38], ['keyup', 'ArrowUp', 'ArrowUp', 38, 38],
      ['keydown', 'ArrowDown', 'ArrowDown', 40, 40], ['keyup', 'ArrowDown', 'ArrowDown', 40, 40]
    ]);
    assert.equal(h.effects.save, 0); assert.equal(h.effects.submit, 0);
    assert.equal(h.neighbor.value, 'KEEP');
    const empty = boot(t, family);
    assert.equal(writable(empty.plan({ operation: 'inc' })), false, 'an empty control has no inferred starting number');
    assert.equal(writable(empty.plan({ operation: 'dec' })), false);
  });

  test(`${family} plans are bound to their original widget and exact numeric instruction`, async t => {
    const h = boot(t, family), other = boot(t, family), plan = h.plan({ value: 0.2 });
    assert.equal((await other.adapter().write(other.el, plan, other.ctx)).status, 'unsupported');
    assert.equal((await h.adapter().write(h.el, JSON.parse(JSON.stringify(plan)), h.ctx)).status, 'unsupported');
    for (const [key, value] of [['value', 0.3], ['modelValue', '0.2'], ['domValue', '0.2'], ['operation', 'inc'], ['type', 'text']]) {
      const changed = h.plan({ value: 0.2 }); changed[key] = value;
      assert.equal((await h.adapter().write(h.el, changed, h.ctx)).status, 'unsupported', key);
      assert.notEqual((await h.R.verify(h.el, changed, { settleMs: 0 })).status, 'success', key);
    }
    assert.equal(h.el.value, ''); assert.equal(other.el.value, '');
    assert.deepEqual(h.events, []); assert.deepEqual(other.events, []);
  });

  test(`${family} readonly, disabled, inert, and stale sources stop before effects`, async t => {
    for (const attribute of ['readonly', 'disabled', 'aria-readonly', 'aria-disabled', 'inert']) {
      const h = boot(t, family);
      h.el.setAttribute(attribute, attribute.startsWith('aria-') ? 'true' : '');
      assert.equal(writable(h.plan({ value: 0.2 })), false, attribute);
      assert.deepEqual(h.events, []);
    }
    const h = boot(t, family, { initial: 0.2 }), plan = h.plan({ operation: 'inc' });
    h.el.value = '0.4';
    if (['el', 'antdv1'].includes(family)) h.props.value = 0.4;
    if (family === 'aria') h.el.setAttribute('aria-valuenow', '0.4');
    assert.equal((await h.adapter().write(h.el, plan, h.ctx)).status, 'unsupported');
    assert.equal(h.el.value, '0.4');
    assert.deepEqual(h.events, []); assert.equal(h.effects.stepClicks, 0);
  });

  test(`${family} stepping refuses boundaries and an initially out-of-range number`, t => {
    for (const [initial, operation] of [[1, 'inc'], [0, 'dec'], [-0.1, 'inc'], [1.1, 'dec']]) {
      const h = boot(t, family, { initial });
      if (['el', 'antdv1'].includes(family)) { h.props.min = 0; h.props.max = 1; }
      else {
        h.el.setAttribute(family === 'aria' ? 'aria-valuemin' : 'min', '0');
        h.el.setAttribute(family === 'aria' ? 'aria-valuemax' : 'max', '1');
      }
      assert.equal(writable(h.plan({ operation })), false, `${initial} ${operation}`);
      assert.deepEqual(h.events, []); assert.equal(h.effects.stepKeys, 0);
    }
  });
}

test('native number rejects nonnumeric facts, unsafe values, malformed bounds, and off-grid steps', t => {
  const h = boot(t);
  for (const value of [true, false, [], {}, Infinity, -Infinity, NaN, 'NaN', 'Infinity', '12px', '0x10', '1,000', '--1',
    9007199254740992, '9007199254740990.1', '0.10000000000000001', '1e99999', '1e-99999', '0e99999', '1e-324']) {
    assert.equal(writable(h.plan({ value })), false, String(value));
  }
  assert.equal(h.plan({ value: '2e-1' }).value, 0.2);
  h.el.min = '-1'; h.el.max = '1';
  assert.equal(h.plan({ value: -0.3 }).status, 'planned');
  assert.equal(writable(h.plan({ value: 1.1 })), false);
  assert.equal(writable(h.plan({ value: -1.1 })), false);
  h.el.step = '0.2';
  assert.equal(writable(h.plan({ value: 0.3 })), false);
  assert.equal(h.plan({ value: 0.4 }).status, 'planned');
  h.el.step = 'any';
  assert.equal(h.plan({ value: 0.3 }).status, 'planned');
  h.el.value = '0.3';
  assert.equal(writable(h.plan({ operation: 'inc' })), false);
  h.el.value = '';
  for (const [name, value] of [['min', 'zero'], ['max', 'NaN'], ['step', '0'], ['step', '-1'], ['step', 'two']]) {
    h.el.removeAttribute('min'); h.el.removeAttribute('max'); h.el.removeAttribute('step');
    h.el.setAttribute(name, value);
    assert.equal(writable(h.plan({ value: 0.2 })), false, `${name}=${value}`);
  }
  h.el.min = '2'; h.el.max = '1'; h.el.step = '1';
  assert.equal(writable(h.plan({ value: 2 })), false);
});

test('native number step uses its initial value attribute as base when minimum is absent', t => {
  const h = boot(t, 'native', { initial: 0.1 });
  h.el.value = ''; h.el.step = '0.2';
  assert.equal(h.plan({ value: 0.3 }).status, 'planned');
  assert.equal(writable(h.plan({ value: 0.2 })), false);
});

test('native number keeps its HTML model when an explicit spinbutton role repeats the implicit role', async t => {
  const h = boot(t);
  h.el.setAttribute('role', 'spinbutton');
  const plan = h.plan({ value: 0.2 });
  assert.equal(plan.adapter, 'native-number');
  assert.equal(plan.status, 'planned');
  await h.adapter().write(h.el, plan, h.ctx);
  assert.equal((await h.R.verify(h.el, plan, { settleMs: 0 })).status, 'success');
  assert.equal(h.el.hasAttribute('aria-valuenow'), false);
});

for (const family of ['el', 'antdv1']) {
  test(`${family} InputNumber owns its nested Input and rejects unknown versions and custom parsers`, t => {
    const h = boot(t, family);
    h.el.__vue__ = { $el: h.el, $options: { name: family === 'el' ? 'ElInput' : 'AInput' },
      $props: { value: '' }, $parent: h.owner };
    assert.equal(h.adapter().name, adapters[family]);
    for (const extra of [{ formatter: value => `${value}%` }, { parser: value => Number(value) }, { stringMode: true }]) {
      Object.assign(h.props, extra);
      assert.equal(writable(h.plan({ value: 0.2 })), false);
      for (const key of Object.keys(extra)) delete h.props[key];
    }
    const exported = family === 'el' ? h.w.ELEMENT : h.w.antd;
    exported.version = family === 'el' ? '3.0.0' : '4.0.0';
    assert.equal(writable(h.plan({ value: 0.2 })), false);
    assert.notEqual(h.adapter()?.name, 'native-text');
    assert.notEqual(h.adapter()?.name, 'native-number');
  });

  test(`${family} numeric verification requires both Vue model and DOM and detects reversion`, async t => {
    const h = boot(t, family, { sync: false }), plan = h.plan({ value: 0.2 });
    await h.adapter().write(h.el, plan, h.ctx);
    assert.equal((await h.R.verify(h.el, plan, { settleMs: 0 })).status, 'mismatch');
    h.props.value = 0.2;
    assert.equal((await h.R.verify(h.el, plan, { settleMs: 0 })).status, 'success');
    h.el.value = '0.3';
    assert.equal((await h.R.verify(h.el, plan, { settleMs: 0 })).status, 'mismatch');
    h.el.value = '0.2';
    h.w.setTimeout(() => { h.props.value = 0.1; h.el.value = '0.1'; }, 5);
    assert.equal((await h.R.verify(h.el, plan, { settleMs: 20 })).status, 'reverted');
  });

  test(`${family} rejects replaced Vue owners and changed constraints before write`, async t => {
    for (const mutate of [h => { h.root.__vue__ = { ...h.owner, $props: { ...h.props } }; },
      h => { h.props.step = 0.2; }, h => { h.props.max = 0.1; }, h => { h.props.precision = 0; }]) {
      const h = boot(t, family), plan = h.plan({ value: 0.2 });
      mutate(h);
      const result = await h.adapter().write(h.el, plan, h.ctx);
      assert.equal(result.status, 'unsupported');
      assert.equal(h.el.value, ''); assert.deepEqual(h.events, []);
    }
  });

  test(`${family} root plans reject replaced inputs before and during awaited effects`, async t => {
    for (const duringEffect of [false, true]) {
      const h = boot(t, family), adapter = h.R.resolve(h.root), plan = h.R.plan(h.root, { value: 0.2 });
      const replacement = h.el.cloneNode(true);
      let replacementEvents = 0;
      replacement.addEventListener('input', () => replacementEvents++);
      const replace = () => {
        h.el.replaceWith(replacement);
        h.neighbor.after(h.el); // Still connected: this input now belongs outside the planned widget.
      };
      let checks = 0;
      if (!duringEffect) replace();
      try { await adapter.write(h.root, plan, { allowWrite: true, async check() {
        if (duringEffect && ++checks === 2) replace();
      } }); } catch { /* A binding changed between awaited checks. */ }
      assert.equal(h.el.value, '', 'the former input must never be written after it moves');
      assert.equal(replacement.value, '', 'a replacement input receives no authority from the old plan');
      assert.deepEqual(h.events, []); assert.equal(replacementEvents, 0);
      assert.notEqual((await h.R.verify(h.root, plan, { settleMs: 0 })).status, 'success');
    }
  });

  test(`${family} changes during the final check cannot apply a second keyboard increment`, async t => {
    const h = boot(t, family, { initial: 0.2 }), plan = h.plan({ operation: 'inc' });
    let checks = 0;
    try { await h.adapter().write(h.el, plan, { allowWrite: true, async check() {
      if (++checks === 2) { h.props.value = 0.3; h.el.value = '0.3'; }
    } }); } catch { /* Rejecting a changed source is also valid. */ }
    assert.equal(h.props.value, 0.3);
    assert.equal(h.el.value, '0.3');
    assert.equal(h.effects.stepKeys, 0);
  });

  test(`${family} constraint changes in the final awaited check stop all input effects`, async t => {
    const h = boot(t, family), plan = h.plan({ value: 0.2 });
    let checks = 0;
    try { await h.adapter().write(h.el, plan, { allowWrite: true, async check() {
      if (++checks === 2) h.props.step = 0.2;
    } }); } catch { /* The privately bound numeric constraints changed. */ }
    assert.equal(h.el.value, ''); assert.deepEqual(h.events, []);
    assert.equal(h.effects.stepKeys, 0);
  });

  test(`${family} precision-invalid starting numbers cannot be repaired by an inferred step`, t => {
    const h = boot(t, family, { initial: 0.15, props: { precision: 1, step: 0.05 } });
    assert.equal(writable(h.plan({ operation: 'inc' })), false);
  });

  test(`${family} increment rechecks its awaited guard and uses keyboard without save or submit clicks`, async t => {
    const h = boot(t, family, { initial: 0.2 }), plan = h.plan({ operation: 'inc' });
    let checks = 0;
    try { await h.adapter().write(h.el, plan, { allowWrite: true, async check() {
      if (++checks === 2) h.props.disabled = true;
    } }); } catch { /* The per-effect guard rejects before a key event. */ }
    assert.equal(h.el.value, '0.2'); assert.equal(h.effects.stepKeys, 0); assert.equal(h.effects.stepClicks, 0);
    for (const mutate of [h => { h.up.type = 'submit'; }, h => { h.up.removeAttribute('type'); },
      h => { h.up.textContent = 'Save'; }, h => { h.root.append(h.up.cloneNode(true)); }]) {
      const adjacent = boot(t, family, { initial: 0.2 });
      mutate(adjacent);
      const instruction = adjacent.plan({ operation: 'inc' });
      await adjacent.adapter().write(adjacent.el, instruction, adjacent.ctx);
      assert.equal(adjacent.effects.stepKeys, 1);
      assert.equal(adjacent.effects.stepClicks, 0);
      assert.equal(adjacent.effects.save, 0); assert.equal(adjacent.effects.submit, 0);
      assert.equal(adjacent.el.value, '0.3');
    }
  });
}

test('Element stepStrictly uses a zero step base independently of its minimum', t => {
  const h = boot(t, 'el', { props: { min: 0.1, step: 0.2, stepStrictly: true } });
  assert.equal(h.plan({ value: 0.2 }).status, 'planned');
  assert.equal(writable(h.plan({ value: 0.3 })), false);
});

test('ARIA spinbutton exposes an independent numeric value and refuses divergent or missing readback', t => {
  const h = boot(t, 'aria', { initial: 0.2 });
  h.el.setAttribute('aria-valuemin', '0'); h.el.setAttribute('aria-valuemax', '0.2');
  assert.equal(writable(h.plan({ operation: 'inc' })), false);
  h.el.removeAttribute('aria-valuemax');
  h.el.setAttribute('aria-valuenow', '0.1');
  assert.equal(writable(h.plan({ operation: 'inc' })), false);
  h.el.removeAttribute('aria-valuenow');
  assert.equal(writable(h.plan({ operation: 'inc' })), false);
  h.el.setAttribute('aria-valuenow', '0.2'); h.el.value = '20%';
  assert.equal(writable(h.plan({ operation: 'inc' })), false);
});

test('class-only or unknown framework steppers cannot fall through to a text writer', t => {
  const h = boot(t);
  for (const markup of ['<div class="el-input-number"><input></div>', '<div class="ant-input-number"><input type="number"></div>',
    '<div class="stepper"><input role="spinbutton" value="1"></div>']) {
    const host = h.w.document.createElement('div'); host.innerHTML = markup; h.w.document.body.append(host);
    const el = host.querySelector('input');
    const plan = h.R.plan(el, { value: 2 });
    assert.equal(writable(plan), false);
    assert.notEqual(h.R.resolve(el)?.name, 'native-text');
  }
});

test('opt-in candidate discovery includes all numeric families and skips disabled or readonly inputs without effects', t => {
  for (const family of families) {
    const h = boot(t, family);
    const discover = h.w.eval(`(${readControlCandidatesInPage.toString()})`);
    const read = () => discover(h.w.location.href, h.w.performance.timeOrigin);
    const result = read();
    assert.equal(result.mode, 'candidates');
    assert.equal(result.writeStarted, false); assert.equal(result.liveSupportClaimed, false);
    assert.equal(result.candidates.length, 1, family);
    const candidate = result.candidates[0];
    assert.equal(candidate.adapter, adapters[family]); assert.equal(candidate.type, 'number');
    assert.equal(h.w.document.querySelector(candidate.selector), h.el);
    h.el.disabled = true;
    assert.equal(read().candidates.length, 0, `${family} disabled`);
    h.el.disabled = false; h.el.readOnly = true;
    assert.equal(read().candidates.length, 0, `${family} readonly`);
    assert.throws(() => discover(h.w.location.href, h.w.performance.timeOrigin + 1), /control_document_changed/u);
    assert.deepEqual(h.events, []);
    assert.deepEqual(h.effects, { save: 0, submit: 0, stepClicks: 0, stepKeys: 0 });
  }
});
