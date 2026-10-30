import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const sources = ['model', 'registry', 'native', 'vue-controls'].map(name =>
  readFileSync(new URL(`../src/content/controls/${name}.js`, import.meta.url), 'utf8'));
const families = ['native', 'aria', 'el', 'antdv1'];
const adapters = { native: 'native-switch', aria: 'aria-switch', el: 'el-switch', antdv1: 'antdv1-switch' };
const writable = result => ['planned', 'success'].includes(result.status);
const ctx = { allowWrite: true, check: async () => {} };

function boot(t, family = 'native', { initial = false, sync = true, props: extraProps = {} } = {}) {
  const vue = ['el', 'antdv1'].includes(family);
  const markup = family === 'native' ? `<input id="target" type="checkbox" role="switch"${initial ? ' checked' : ''}>`
    : family === 'aria' ? `<button id="target" type="button" role="switch" aria-checked="${initial}">Enabled</button>`
      : family === 'el' ? `<div id="target" class="el-switch" role="switch" aria-checked="${initial}"><input type="checkbox"${initial ? ' checked' : ''}></div>`
        : `<button id="target" type="button" class="ant-switch${initial ? ' ant-switch-checked' : ''}" role="switch" aria-checked="${initial}"></button>`;
  const dom = new JSDOM(`<form>${markup}<input id="neighbor" value="KEEP">`
    + '<button id="save" type="button">Save</button><button type="submit">Submit</button></form>',
  { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://offline.invalid/switch' });
  t.after(() => dom.window.close());
  const w = dom.window, el = w.document.getElementById('target');
  w.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  w.ELEMENT = { version: '2.15.14' }; w.antd = { version: '1.7.8' };
  const key = family === 'antdv1' ? 'checked' : 'value';
  const props = { [key]: initial, ...extraProps };
  const owner = { $el: el, $options: { name: family === 'el' ? 'ElSwitch' : 'ASwitch' }, $props: props };
  if (vue) el.__vue__ = owner;
  const effects = { clicks: 0, save: 0, submit: 0 }, events = [];
  for (const type of ['pointerdown', 'mousedown', 'focus', 'mouseup', 'click']) {
    el.addEventListener(type, () => events.push(type));
  }
  el.addEventListener('click', () => {
    effects.clicks++;
    if (family === 'native' || !sync) return;
    const checked = el.getAttribute('aria-checked') !== 'true';
    el.setAttribute('aria-checked', String(checked));
    if (family === 'antdv1') el.classList.toggle('ant-switch-checked', checked);
    if (vue) props[key] = family === 'el'
      ? checked ? props.activeValue ?? true : props.inactiveValue ?? false : checked;
    const input = el.querySelector('input');
    if (input) input.checked = checked;
  });
  w.document.getElementById('save').addEventListener('click', () => effects.save++);
  w.document.querySelector('form').addEventListener('submit', event => { event.preventDefault(); effects.submit++; });
  for (const source of sources) w.eval(source);
  const R = w.ResumeControls;
  return { w, R, el, props, owner, key, events, effects,
    adapter: () => R.resolve(el), plan: fact => R.plan(el, fact),
    neighbor: w.document.getElementById('neighbor'),
    paint(checked, model = checked) {
      if (family === 'native') el.checked = checked;
      else {
        el.setAttribute('aria-checked', String(checked));
        if (family === 'antdv1') el.classList.toggle('ant-switch-checked', checked);
        if (el.querySelector('input')) el.querySelector('input').checked = checked;
      }
      if (vue) props[key] = model;
    },
  };
}

for (const family of families) {
  test(`${family} switch sets both boolean values through one click with exact readback and Never-Save`, async t => {
    const h = boot(t, family);
    for (const value of [true, false]) {
      const plan = h.plan({ value });
      assert.equal(plan.adapter, adapters[family]);
      assert.equal(plan.type, 'switch');
      assert.equal(plan.operation, 'set');
      assert.equal(plan.status, 'planned');
      assert.equal(plan.liveSupportClaimed, false);
      for (const key of ['value', 'modelValue', 'domValue']) assert.equal(plan[key], value);
      assert.equal((await h.adapter().write(h.el, plan)).reason, 'shadow_mode');
      assert.equal((await h.adapter().write(h.el, plan, { allowWrite: true })).reason, 'shadow_mode');
      const written = await h.adapter().write(h.el, plan, ctx);
      assert.equal(written.strategy, 'ui');
      assert.equal(written.attempts, 1);
      const verified = await h.R.verify(h.el, plan, { settleMs: 0 });
      assert.equal(verified.status, 'success');
      assert.equal(verified.modelReadback, value);
      assert.equal(verified.domReadback, value);
      const same = h.plan({ value });
      assert.equal(same.status, 'success');
      assert.equal((await h.adapter().write(h.el, same, ctx)).attempts, 0);
    }
    assert.equal(h.effects.clicks, 2);
    assert.equal(h.effects.save, 0); assert.equal(h.effects.submit, 0);
    assert.equal(h.neighbor.value, 'KEEP');
    assert.equal(h.R.liveSupportClaimed, false);
  });

  test(`${family} explicit toggle flips a confirmed origin once and replay does not click again`, async t => {
    const h = boot(t, family);
    for (const expected of [true, false]) {
      const plan = h.plan({ operation: 'toggle' });
      assert.equal(plan.status, 'planned');
      assert.equal(plan.operation, 'toggle');
      assert.equal(plan.domValue, expected);
      await h.adapter().write(h.el, plan, ctx);
      assert.equal((await h.R.verify(h.el, plan, { settleMs: 0 })).status, 'success');
      const clicks = h.effects.clicks;
      await h.adapter().write(h.el, plan, ctx);
      assert.equal(h.effects.clicks, clicks);
      assert.equal(h.adapter().readModel(h.el).domValue, expected);
    }
    assert.equal(h.effects.clicks, 2);
    assert.equal(h.effects.save, 0); assert.equal(h.effects.submit, 0);
  });

  test(`${family} switch facts require booleans and reject ambiguous operations without effects`, t => {
    const h = boot(t, family);
    for (const value of ['true', 'false', 'on', 'off', 0, 1, null, undefined, [], {}, NaN]) {
      assert.equal(writable(h.plan({ value })), false, String(value));
    }
    for (const fact of [{ operation: 'toggle', value: false }, { operation: 'toggle', value: true },
      { operation: 'inc' }, { operation: 'click' }, { operation: 'set' }, { operation: false }]) {
      assert.equal(writable(h.plan(fact)), false, JSON.stringify(fact));
    }
    assert.deepEqual(h.events, []);
  });

  test(`${family} switch plans reject serialization, edits, and cross-widget reuse`, async t => {
    const h = boot(t, family), other = boot(t, family), plan = h.plan({ operation: 'toggle' });
    assert.equal((await other.adapter().write(other.el, plan, ctx)).status, 'unsupported');
    assert.equal((await h.adapter().write(h.el, JSON.parse(JSON.stringify(plan)), ctx)).status, 'unsupported');
    for (const [key, value] of [['value', false], ['modelValue', 'true'], ['domValue', false],
      ['operation', 'set'], ['type', 'checkbox']]) {
      const edited = h.plan({ operation: 'toggle' }); edited[key] = value;
      assert.equal((await h.adapter().write(h.el, edited, ctx)).status, 'unsupported', key);
      assert.notEqual((await h.R.verify(h.el, edited, { settleMs: 0 })).status, 'success', key);
    }
    assert.equal(h.effects.clicks, 0); assert.equal(other.effects.clicks, 0);
    assert.deepEqual(h.events, []);
  });

  test(`${family} disabled, readonly, inert, hidden, and detached switches cannot click`, async t => {
    for (const attribute of ['disabled', 'readonly', 'aria-disabled', 'aria-readonly', 'inert', 'hidden']) {
      const h = boot(t, family);
      if (['el', 'antdv1'].includes(family) && ['disabled', 'readonly'].includes(attribute)) h.props[attribute] = true;
      else if (family === 'aria' && attribute === 'readonly') h.el.setAttribute('aria-readonly', 'true');
      else h.el.setAttribute(attribute, attribute.startsWith('aria-') ? 'true' : '');
      const plan = h.plan({ operation: 'toggle' });
      if (h.adapter()) {
        try { await h.adapter().write(h.el, plan, ctx); } catch { /* Per-effect rejection is valid. */ }
      }
      assert.equal(h.effects.clicks, 0, attribute);
    }
    const h = boot(t, family), plan = h.plan({ value: true }), adapter = h.adapter();
    h.el.remove();
    assert.equal((await adapter.write(h.el, plan, ctx)).status, 'unsupported');
    assert.equal(h.effects.clicks, 0);
  });

  test(`${family} a guard change during pointerdown stops before the click`, async t => {
    const h = boot(t, family), plan = h.plan({ operation: 'toggle' });
    h.el.addEventListener('pointerdown', () => h.el.setAttribute('aria-readonly', 'true'));
    try { await h.adapter().write(h.el, plan, ctx); } catch { /* A stopped pointer sequence may reject. */ }
    assert.equal(h.effects.clicks, 0);
    assert.equal(h.adapter().readModel(h.el).domValue, false);
    assert.equal(h.effects.save, 0); assert.equal(h.effects.submit, 0);
  });

  test(`${family} toggle checks the awaited origin before any pointer effects`, async t => {
    const h = boot(t, family), plan = h.plan({ operation: 'toggle' });
    let checks = 0;
    try { await h.adapter().write(h.el, plan, { allowWrite: true, async check() {
      if (++checks === 2) h.paint(true);
    } }); } catch { /* The source changed before dispatch. */ }
    assert.equal(h.effects.clicks, 0);
    assert.equal(h.events.includes('pointerdown'), false);
  });

  test(`${family} switch readback detects a mismatch and delayed reversion`, async t => {
    const h = boot(t, family), plan = h.plan({ value: true });
    await h.adapter().write(h.el, plan, ctx);
    h.paint(false);
    assert.equal((await h.R.verify(h.el, plan, { settleMs: 0 })).status, 'mismatch');
    h.paint(true);
    h.w.setTimeout(() => h.paint(false), 5);
    assert.equal((await h.R.verify(h.el, plan, { settleMs: 20 })).status, 'reverted');
  });
}

for (const family of ['el', 'antdv1']) {
  test(`${family} switch needs owning model, matching DOM, and a confirmed library version`, async t => {
    const h = boot(t, family), plan = h.plan({ value: true });
    h.paint(false, true);
    assert.equal(writable(h.plan({ operation: 'toggle' })), false);
    assert.equal(writable(h.plan({ value: true })), false);
    assert.equal((await h.R.verify(h.el, plan, { settleMs: 0 })).status, 'mismatch');
    h.paint(true, false);
    assert.equal((await h.R.verify(h.el, plan, { settleMs: 0 })).status, 'mismatch');
    h.paint(false);
    const exported = family === 'el' ? h.w.ELEMENT : h.w.antd;
    for (const version of [undefined, family === 'el' ? '3.0.0' : '4.0.0']) {
      exported.version = version;
      assert.equal(writable(h.plan({ value: true })), false);
      assert.notEqual(h.adapter()?.name, 'native-switch');
      assert.notEqual(h.adapter()?.name, 'aria-switch');
    }
    assert.equal(h.effects.clicks, 0);
  });

  test(`${family} a replaced model owner cannot receive the old switch plan`, async t => {
    const h = boot(t, family), plan = h.plan({ operation: 'toggle' });
    h.el.__vue__ = { ...h.owner, $props: { ...h.props } };
    assert.equal((await h.adapter().write(h.el, plan, ctx)).status, 'unsupported');
    assert.notEqual((await h.R.verify(h.el, plan, { settleMs: 0 })).status, 'success');
    assert.equal(h.effects.clicks, 0);
  });
}

test('Element switch maps boolean set/toggle to exact custom and inverted model codes', async t => {
  for (const [activeValue, inactiveValue] of [[7, 0], ['on', 'off'], [false, true]]) {
    const h = boot(t, 'el', { props: { value: inactiveValue, activeValue, inactiveValue } });
    for (const [fact, expected, checked] of [[{ value: true }, activeValue, true],
      [{ operation: 'toggle' }, inactiveValue, false], [{ operation: 'toggle' }, activeValue, true],
      [{ value: false }, inactiveValue, false]]) {
      const plan = h.plan(fact);
      assert.equal(plan.status, 'planned');
      assert.equal(plan.value, expected); assert.equal(plan.modelValue, expected); assert.equal(plan.domValue, checked);
      await h.adapter().write(h.el, plan, ctx);
      const verified = await h.R.verify(h.el, plan, { settleMs: 0 });
      assert.equal(verified.status, 'success');
      assert.equal(verified.modelReadback, expected); assert.equal(verified.domReadback, checked);
    }
    assert.equal(h.effects.clicks, 4);
    if (typeof activeValue !== 'boolean') assert.equal(writable(h.plan({ value: activeValue })), false);
  }
});

test('Element switch custom-code changes during an awaited effect invalidate the instruction', async t => {
  const h = boot(t, 'el', { props: { value: 0, activeValue: 7, inactiveValue: 0 } });
  const plan = h.plan({ operation: 'toggle' });
  let checks = 0;
  try { await h.adapter().write(h.el, plan, { allowWrite: true, async check() {
    if (++checks === 2) h.props.activeValue = '7';
  } }); } catch { /* The model mapping is part of the private binding. */ }
  assert.equal(h.effects.clicks, 0);
});

test('ARIA switch needs an explicit binary checked state and refuses mixed, missing, or nested controls', t => {
  const h = boot(t, 'aria');
  for (const state of [null, '', 'mixed', 'TRUE', '0', 'undefined']) {
    if (state === null) h.el.removeAttribute('aria-checked'); else h.el.setAttribute('aria-checked', state);
    assert.equal(writable(h.plan({ value: true })), false, String(state));
    assert.equal(writable(h.plan({ operation: 'toggle' })), false, String(state));
  }
  h.el.setAttribute('aria-checked', 'false');
  h.el.innerHTML = '<button type="button" role="switch" aria-checked="false">Nested</button>';
  assert.equal(writable(h.plan({ operation: 'toggle' })), false);
  assert.equal(h.effects.clicks, 0);
});

test('native checkbox-as-switch rejects indeterminate and conflicting explicit ARIA states', t => {
  const h = boot(t);
  h.el.indeterminate = true;
  assert.equal(writable(h.plan({ value: true })), false);
  assert.equal(writable(h.plan({ operation: 'toggle' })), false);
  h.el.indeterminate = false;
  for (const state of ['true', 'mixed']) {
    h.el.setAttribute('aria-checked', state);
    assert.equal(writable(h.plan({ value: true })), false);
  }
  assert.equal(h.effects.clicks, 0);
});

test('a plain focusable ARIA switch owns its explicit boolean state without framework selectors', async t => {
  const h = boot(t, 'aria'), el = h.w.document.createElement('div');
  el.tabIndex = 0; el.setAttribute('role', 'switch'); el.setAttribute('aria-checked', 'false');
  el.textContent = 'Enabled'; h.el.replaceWith(el);
  let clicks = 0;
  el.addEventListener('click', () => { clicks++; el.setAttribute('aria-checked', String(el.getAttribute('aria-checked') !== 'true')); });
  for (const expected of [true, false]) {
    const plan = h.R.plan(el, { operation: 'toggle' });
    assert.equal(plan.adapter, 'aria-switch'); assert.equal(plan.status, 'planned');
    await h.R.resolve(el).write(el, plan, ctx);
    const verified = await h.R.verify(el, plan, { settleMs: 0 });
    assert.equal(verified.status, 'success'); assert.equal(verified.domReadback, expected);
  }
  assert.equal(clicks, 2); assert.equal(h.effects.save, 0); assert.equal(h.effects.submit, 0);
});

test('switches never click Save actions, links, or implicit submit buttons', async t => {
  for (const family of ['aria', 'antdv1']) {
    for (const mutate of [h => { h.el.textContent = 'Save'; }, h => { h.el.type = 'submit'; },
      h => { h.el.removeAttribute('type'); }]) {
      const h = boot(t, family), plan = h.plan({ value: true });
      mutate(h);
      try { await h.adapter()?.write(h.el, plan, ctx); } catch { /* Never-Save guard denial. */ }
      assert.equal(h.effects.clicks, 0); assert.equal(h.effects.save, 0); assert.equal(h.effects.submit, 0);
    }
  }
  const h = boot(t, 'aria'), anchor = h.w.document.createElement('a');
  anchor.href = 'https://offline.invalid/next'; anchor.setAttribute('role', 'switch'); anchor.setAttribute('aria-checked', 'false');
  h.el.replaceWith(anchor);
  assert.equal(writable(h.R.plan(anchor, { operation: 'toggle' })), false);
});

test('ARIA and Element switch clicks cannot activate an external label target before or during the pointer sequence', async t => {
  for (const kind of ['aria-span', 'aria-div', 'aria-button', 'el']) {
    for (const externalType of ['submit', 'button', 'checkbox']) {
      for (const timing of kind === 'aria-button' ? ['before', 'wrap-pointerdown', 'for-pointerdown'] : ['before', 'wrap-pointerdown']) {
        const h = boot(t, kind === 'el' ? 'el' : 'aria');
        let el = h.el;
        if (kind !== 'el' && kind !== 'aria-button') {
          el = h.w.document.createElement(kind === 'aria-span' ? 'span' : 'div');
          el.tabIndex = 0; el.setAttribute('role', 'switch'); el.setAttribute('aria-checked', 'false'); el.textContent = 'Enabled';
          h.el.replaceWith(el);
          el.addEventListener('click', () => { h.effects.clicks++; el.setAttribute('aria-checked', 'true'); });
        }
        const external = externalType === 'checkbox' ? h.w.document.createElement('input') : h.w.document.getElementById('save');
        external.id = 'external-label-target'; external.type = externalType;
        if (externalType === 'checkbox') h.w.document.querySelector('form').append(external);
        let externalClicks = 0;
        external.addEventListener('click', () => externalClicks++);
        const label = h.w.document.createElement('label');
        const wrap = () => { el.before(label); label.append(el); };
        if (timing === 'for-pointerdown') { label.htmlFor = el.id; wrap(); }
        const adapter = h.R.resolve(el), plan = h.R.plan(el, { operation: 'toggle' });
        assert.equal(plan.status, 'planned', `${kind} ${externalType} ${timing}: safe initial plan`);
        if (timing === 'before') {
          label.htmlFor = external.id; wrap();
          assert.equal(writable(h.R.plan(el, { operation: 'toggle' })), false, `${kind} ${externalType}: unsafe label plan`);
        }
        else el.addEventListener('pointerdown', () => {
          if (timing === 'wrap-pointerdown') wrap();
          label.htmlFor = external.id;
        });
        try { await adapter.write(el, plan, ctx); } catch { /* A changed label association stops the effect sequence. */ }
        const scenario = `${kind} ${externalType} ${timing}`;
        assert.equal(h.effects.clicks, 0, `${scenario}: switch click`);
        assert.equal(externalClicks, 0, `${scenario}: external activation`);
        assert.equal(h.effects.save, 0, `${scenario}: Save`);
        assert.equal(h.effects.submit, 0, `${scenario}: submit`);
        if (externalType === 'checkbox') assert.equal(external.checked, false, `${scenario}: neighboring checkbox`);
        assert.equal(h.neighbor.value, 'KEEP', `${scenario}: neighboring text`);
      }
    }
  }
});

test('Element switch rejects an internal checkbox that contradicts its true model and ARIA readback', async t => {
  for (const mutate of [input => { input.checked = false; }, input => { input.indeterminate = true; }]) {
    const h = boot(t, 'el', { initial: true }), plan = h.plan({ value: true });
    assert.equal(plan.status, 'success');
    mutate(h.el.querySelector('input'));
    assert.equal(writable(h.plan({ value: true })), false);
    assert.equal(writable(h.plan({ operation: 'toggle' })), false);
    assert.notEqual((await h.R.verify(h.el, plan, { settleMs: 0 })).status, 'success');
    try { await h.adapter().write(h.el, plan, ctx); } catch { /* Conflicting readback grants no write authority. */ }
    assert.equal(h.effects.clicks, 0);
  }
});

test('Vue switches honor aria-readonly ancestors before and during a pointer sequence', async t => {
  for (const family of ['el', 'antdv1']) {
    for (const timing of ['before-plan', 'after-plan', 'pointerdown']) {
      const h = boot(t, family), wrapper = h.w.document.createElement('section');
      h.el.before(wrapper); wrapper.append(h.el);
      if (timing === 'before-plan') wrapper.setAttribute('aria-readonly', 'true');
      const adapter = h.adapter(), plan = h.plan({ operation: 'toggle' });
      if (timing === 'before-plan') assert.equal(writable(plan), false);
      else assert.equal(plan.status, 'planned');
      if (timing === 'after-plan') wrapper.setAttribute('aria-readonly', 'true');
      if (timing === 'pointerdown') h.el.addEventListener('pointerdown', () => wrapper.setAttribute('aria-readonly', 'true'));
      try { await adapter.write(h.el, plan, ctx); } catch { /* Ancestor readonly is checked at every effect. */ }
      assert.equal(h.effects.clicks, 0, `${family} ${timing}`);
      assert.equal(h.props[h.key], false); assert.equal(h.el.getAttribute('aria-checked'), 'false');
      assert.equal(h.effects.save, 0); assert.equal(h.effects.submit, 0);
    }
  }
});

test('class-only and unknown framework switches cannot fall through to an ARIA/native writer', t => {
  const h = boot(t);
  for (const markup of ['<button type="button" role="switch" aria-checked="false" class="ant-switch"></button>',
    '<div class="el-switch"><input type="checkbox" role="switch"></div>',
    '<div class="ant-switch" role="switch" aria-checked="false"></div>']) {
    const host = h.w.document.createElement('div'); host.innerHTML = markup; h.w.document.body.append(host);
    const el = host.querySelector('input') || host.firstElementChild;
    assert.equal(writable(h.R.plan(el, { value: true })), false);
  }
});

test('ordinary checkbox remains additive and does not gain switch toggle authority', t => {
  const h = boot(t);
  h.el.removeAttribute('role'); h.el.checked = true;
  assert.equal(h.adapter()?.name, 'native-checkbox');
  assert.equal(h.plan({ value: false }).reason, 'existing_value');
  assert.equal(writable(h.plan({ operation: 'toggle' })), false);
});

test('real Element UI and ant-design-vue Switch models accept both UI directions and toggle', async t => {
  const dom = new JSDOM('<!doctype html><body><form><div id="app"></div></form></body>',
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://offline.invalid/real-switch' });
  const w = dom.window;
  let app;
  t.after(() => { app?.$destroy(); w.close(); });
  w.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  for (const name of ['vue/dist/vue.js', 'moment/min/moment.min.js', 'element-ui/lib/index.js', 'ant-design-vue/dist/antd.js']) {
    w.eval(readFileSync(require.resolve(name), 'utf8'));
  }
  w.Vue.config.productionTip = false; w.Vue.config.devtools = false;
  w.Vue.use(w.ELEMENT); w.Vue.use(w.antd);
  for (const source of sources) w.eval(source);
  let submits = 0;
  w.document.querySelector('form').addEventListener('submit', event => { submits++; event.preventDefault(); });
  app = new w.Vue({ el: '#app', data: () => ({ element: false, ant: false }),
    template: '<section><el-switch id="element" v-model="element"></el-switch><a-switch id="ant" v-model="ant"></a-switch></section>' });
  await w.Vue.nextTick();
  for (const [id, adapterName, modelKey] of [['element', 'el-switch', 'element'], ['ant', 'antdv1-switch', 'ant']]) {
    const el = w.document.getElementById(id), adapter = w.ResumeControls.resolve(el);
    assert.equal(adapter?.name, adapterName);
    for (const [fact, expected] of [[{ value: true }, true], [{ value: false }, false], [{ operation: 'toggle' }, true]]) {
      const plan = w.ResumeControls.plan(el, fact);
      assert.equal(plan.status, 'planned', JSON.stringify(plan));
      const result = await adapter.write(el, plan, ctx);
      assert.equal(result.strategy, 'ui');
      const verified = await w.ResumeControls.verify(el, plan, { settleMs: 0 });
      assert.equal(verified.status, 'success', JSON.stringify(verified));
      assert.equal(app[modelKey], expected); assert.equal(verified.domReadback, expected);
    }
  }
  assert.equal(submits, 0);
});
