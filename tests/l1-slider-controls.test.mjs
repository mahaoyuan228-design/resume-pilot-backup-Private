import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import { boot, adapters, ctx, writable } from './fixtures/slider-harness.mjs';

const families = ['native', 'el', 'antdv1'];
const copy = value => JSON.parse(JSON.stringify(value));
function safe(h) {
  assert.equal(h.neighbor.value, 'KEEP');
  assert.equal(h.effects.save, 0); assert.equal(h.effects.submit, 0);
  assert.equal(h.R.liveSupportClaimed, false);
}

for (const family of families) {
  test(`${family} slider writes explicit values in both directions and verifies numeric readback`, async t => {
    const h = boot(t, family), adapter = h.adapter();
    assert.equal(adapter?.name, adapters[family]);
    for (const value of [0, '75', 100, 20]) {
      const plan = h.plan({ value });
      assert.equal(plan.status, 'planned', JSON.stringify(plan));
      assert.equal(plan.type, 'slider'); assert.equal(plan.operation, 'set');
      assert.equal(plan.liveSupportClaimed, false); assert.equal(plan.writeStarted, false);
      for (const key of ['value', 'modelValue', 'domValue']) assert.equal(plan[key], Number(value));
      const before = h.events.length;
      assert.equal((await adapter.write(h.el, plan)).reason, 'shadow_mode');
      assert.equal((await adapter.write(h.el, plan, { allowWrite: true })).reason, 'shadow_mode');
      assert.equal(h.events.length, before);
      const written = await adapter.write(h.el, plan, ctx);
      assert.equal(written.attempts, 1, JSON.stringify(written));
      assert.equal(written.strategy, family === 'native' ? 'native' : 'ui');
      const result = await adapter.verify(h.el, plan, { settleMs: 0 });
      assert.equal(result.status, 'success', JSON.stringify(result));
      assert.equal(result.modelReadback, Number(value)); assert.equal(result.domReadback, Number(value));
      assert.equal(h.plan({ value }).status, 'success');
      const count = h.events.length;
      assert.equal((await adapter.write(h.el, plan, ctx)).reason, 'preexisting_same_value');
      assert.equal(h.events.length, count, 'replaying a completed set emits no UI effects');
      safe(h);
    }
  });

  for (const operation of ['click', 'drag']) {
    test(`${family} slider ${operation} uses target coordinates and reads the requested step`, async t => {
      const h = boot(t, family), plan = h.plan({ operation, value: 70 });
      assert.equal(plan.status, 'planned', JSON.stringify(plan)); assert.equal(plan.operation, operation);
      const written = await h.adapter().write(h.el, plan, ctx);
      assert.equal(written.strategy, 'ui'); assert.equal(written.attempts, 1);
      const result = await h.R.verify(h.el, plan, { settleMs: 0 });
      assert.equal(result.status, 'success', JSON.stringify(result));
      assert.equal(result.modelReadback, 70); assert.equal(result.domReadback, 70);
      const mouse = h.events.filter(event => ['mousedown', 'mousemove', 'mouseup', 'click'].includes(event.type));
      assert.ok(mouse.some(event => event.x === 240 && event.y === 60), '70% coordinate within the owned 200px runway');
      assert.ok(mouse.some(event => event.type === 'mousedown'));
      assert.ok(mouse.some(event => event.type === 'mouseup'));
      if (operation === 'drag') assert.ok(mouse.some(event => event.type === 'mousemove'));
      safe(h);
    });
  }

  test(`${family} slider rejects invalid values and bounds without clamping or guessing a step`, t => {
    const h = boot(t, family);
    for (const value of [true, false, [], {}, null, '', Infinity, -Infinity, NaN, '12px', '0x10', '1,000',
      '0.10000000000000001', '1e-99999', 9007199254740992, -1, 101, 20.5]) {
      assert.equal(writable(h.plan({ value })), false, String(value));
    }
    for (const operation of ['inc', 'toggle', '', 'DRAG']) {
      assert.equal(writable(h.plan({ operation, value: 30 })), false, operation);
    }
    const set = (name, value) => family === 'native' ? h.el.setAttribute(name, String(value)) : h.props[name] = value;
    for (const [name, value] of [['min', 'bad'], ['max', 'NaN'], ['step', 0], ['step', -1],
      ...(family === 'native' ? [] : [['step', 'any']])]) {
      set('min', 0); set('max', 100); set('step', 1); set(name, value);
      assert.equal(writable(h.plan({ value: 30 })), false, `${name}=${value}`);
    }
    set('min', 50); set('max', 10); set('step', 1);
    assert.equal(writable(h.plan({ value: 30 })), false);
    assert.deepEqual(h.events, []); safe(h);
  });

  test(`${family} slider plans bind the widget, operation, numeric payload and observed source`, async t => {
    const h = boot(t, family), other = boot(t, family), adapter = h.adapter();
    const plan = h.plan({ operation: 'drag', value: 70 });
    for (const [target, instruction] of [[other.el, plan], [h.el, copy(plan)]]) {
      assert.equal((await adapter.write(target, instruction, ctx)).status, 'unsupported');
      assert.notEqual((await adapter.verify(target, instruction, { settleMs: 0 })).status, 'success');
    }
    for (const [key, value] of [['value', 80], ['modelValue', '70'], ['domValue', 80], ['operation', 'click'], ['type', 'number']]) {
      const changed = h.plan({ operation: 'drag', value: 70 }); changed[key] = value;
      assert.equal((await adapter.write(h.el, changed, ctx)).status, 'unsupported', key);
      assert.notEqual((await adapter.verify(h.el, changed, { settleMs: 0 })).status, 'success', key);
    }
    h.paint(30);
    assert.equal((await adapter.write(h.el, plan, ctx)).status, 'unsupported', 'a changed source needs a new instruction');
    assert.deepEqual(h.events, []); assert.deepEqual(other.events, []); safe(h); safe(other);
  });

  test(`${family} slider honors disabled and readonly ancestors before and after planning`, async t => {
    for (const attribute of ['disabled', 'readonly', 'aria-disabled', 'aria-readonly', 'inert']) {
      const h = boot(t, family), wrapper = h.w.document.createElement('section');
      h.el.before(wrapper); wrapper.append(h.el);
      const plan = h.plan({ operation: 'drag', value: 70 }), adapter = h.adapter();
      const target = ['disabled', 'readonly'].includes(attribute) ? h.el : wrapper;
      target.setAttribute(attribute, attribute.startsWith('aria-') ? 'true' : '');
      assert.equal(writable(h.plan({ value: 70 })), false, attribute);
      try { await adapter.write(h.el, plan, ctx); } catch { /* A newly forbidden target must have no effects. */ }
      assert.deepEqual(h.events, [], attribute); safe(h);
    }
  });

  test(`${family} slider rechecks awaited guards and never starts a gesture after cancellation`, async t => {
    const h = boot(t, family), plan = h.plan({ operation: 'drag', value: 70 });
    await assert.rejects(h.adapter().write(h.el, plan, { allowWrite: true, check: async () => { throw Error('cancelled'); } }), /cancelled/u);
    assert.deepEqual(h.events, []);
    let checks = 0;
    try { await h.adapter().write(h.el, plan, { allowWrite: true, async check() {
      if (++checks === 2) h.el.setAttribute('aria-disabled', 'true');
    } }); } catch { /* The guard may reject the changed contract. */ }
    assert.equal(h.events.filter(event => ['pointerdown', 'mousedown', 'mousemove', 'click', 'input', 'change'].includes(event.type)).length, 0);
    safe(h);
  });

  test(`${family} slider stops a pointer sequence when the first event makes the target readonly`, async t => {
    const h = boot(t, family), plan = h.plan({ operation: 'click', value: 70 });
    h.runway.addEventListener('pointerdown', () => h.el.setAttribute('aria-readonly', 'true'));
    try { await h.adapter().write(h.el, plan, ctx); } catch { /* The next effect observes the new readonly state. */ }
    assert.equal(h.events.filter(event => event.type === 'pointerdown').length, 1);
    assert.equal(h.events.filter(event => ['mousedown', 'mousemove', 'mouseup', 'click', 'input', 'change'].includes(event.type)).length, 0);
    assert.equal(family === 'native' ? Number(h.el.value) : h.props.value, 20); safe(h);
  });

  test(`${family} slider rejects detached targets, invisible tracks and missing geometry`, async t => {
    for (const mutate of [h => h.el.remove(), h => { h.el.style.display = 'none'; },
      h => { h.geometry.width = 0; }, h => { h.geometry.left = NaN; }]) {
      const h = boot(t, family), plan = h.plan({ operation: 'click', value: 70 }), adapter = h.adapter();
      mutate(h);
      try { await adapter.write(h.el, plan, ctx); } catch { /* Geometry and liveness are checked before effects. */ }
      assert.deepEqual(h.events, []); safe(h);
    }
  });
}

for (const family of ['el', 'antdv1']) {
  test(`${family} slider requires independent matching model and DOM readback and detects reversion`, async t => {
    const h = boot(t, family), plan = h.plan({ value: 70 });
    await h.adapter().write(h.el, plan, ctx);
    assert.equal((await h.R.verify(h.el, plan, { settleMs: 0 })).status, 'success');
    h.paint(40, { dom: false });
    assert.equal((await h.R.verify(h.el, plan, { settleMs: 0 })).status, 'mismatch');
    h.paint(70); h.paint(40, { model: false });
    assert.equal((await h.R.verify(h.el, plan, { settleMs: 0 })).status, 'mismatch');
    h.paint(70); h.w.setTimeout(() => h.paint(20), 5);
    assert.equal((await h.R.verify(h.el, plan, { settleMs: 20 })).status, 'reverted');
    safe(h);
  });

  test(`${family} slider unknown versions, class-only roots and multi handles remain manual`, t => {
    const h = boot(t, family);
    h.props.range = true;
    assert.equal(writable(h.plan({ value: 70 })), false);
    h.props.range = false; h.props.value = [20, 80];
    assert.equal(writable(h.plan({ value: 70 })), false);
    h.props.value = 20;
    const clone = h.handle.cloneNode(true); h.runway.append(clone);
    assert.equal(writable(h.plan({ value: 70 })), false);
    clone.remove();
    const library = family === 'el' ? h.w.ELEMENT : h.w.antd;
    library.version = '99.0.0';
    assert.equal(writable(h.plan({ value: 70 })), false);
    assert.notEqual(h.adapter()?.name, 'native-text');
    library.version = family === 'el' ? '2.15.14' : '1.7.8';
    delete h.el.__vue__;
    assert.equal(writable(h.plan({ value: 70 })), false);
    assert.deepEqual(h.events, []); safe(h);
  });

  test(`${family} slider owner, handle and step changes invalidate an executable plan`, async t => {
    for (const mutate of [h => { h.el.__vue__ = { ...h.owner, $props: { ...h.props } }; },
      h => { h.handle.replaceWith(h.handle.cloneNode(true)); }, h => { h.props.step = 2; },
      h => { h.props.max = 200; }, h => { h.props.value = '20'; }]) {
      const h = boot(t, family), plan = h.plan({ operation: 'drag', value: 70 }), adapter = h.adapter();
      mutate(h);
      try { await adapter.write(h.el, plan, ctx); } catch { /* Component identity and constraints are private bindings. */ }
      assert.deepEqual(h.events, []); safe(h);
    }
  });
}

test('native slider decimal bounds honor a minimum-based step grid', async t => {
  const h = boot(t);
  h.el.min = '-0.3'; h.el.max = '0.9'; h.el.step = '0.2'; h.el.value = '-0.3';
  assert.equal(writable(h.plan({ value: 0.2 })), false);
  const plan = h.plan({ value: '0.3' });
  assert.equal(plan.status, 'planned', JSON.stringify(plan));
  await h.adapter().write(h.el, plan, ctx);
  assert.equal((await h.R.verify(h.el, plan, { settleMs: 0 })).domReadback, 0.3);
  safe(h);
});

test('native slider step any accepts an exact numeric fact without rounding it to a guessed grid', async t => {
  const h = boot(t);
  h.el.step = 'any';
  const plan = h.plan({ value: 20.125 });
  assert.equal(plan.status, 'planned', JSON.stringify(plan));
  await h.adapter().write(h.el, plan, ctx);
  const result = await h.R.verify(h.el, plan, { settleMs: 0 });
  assert.equal(result.status, 'success'); assert.equal(result.domReadback, 20.125); safe(h);
});

test('native slider step grid uses the HTML value attribute until an explicit minimum takes precedence', async t => {
  const h = boot(t, 'native', { initial: 0.5 });
  h.el.step = '1';
  assert.equal(writable(h.plan({ value: 2 })), false);
  const plan = h.plan({ value: 1.5 });
  assert.equal(plan.status, 'planned', JSON.stringify(plan));
  await h.adapter().write(h.el, plan, ctx);
  assert.equal((await h.R.verify(h.el, plan, { settleMs: 0 })).status, 'success');
  const pending = h.plan({ value: 2.5 });
  h.el.setAttribute('value', '0.7');
  assert.equal((await h.adapter().write(h.el, pending, ctx)).status, 'unsupported', 'changing the HTML step base invalidates prior authority');
  h.el.min = '0'; h.el.value = '2';
  assert.equal(writable(h.plan({ value: 2.5 })), false);
  assert.equal(h.plan({ value: 3 }).status, 'planned'); safe(h);
});

test('native vertical and RTL ranges and an unreviewed ARIA-only slider remain manual', t => {
  const h = boot(t);
  for (const mutate of [() => h.el.setAttribute('orient', 'vertical'), () => { h.el.style.direction = 'rtl'; }]) {
    h.el.removeAttribute('orient'); h.el.style.direction = '';
    mutate(); assert.equal(writable(h.plan({ value: 70 })), false);
  }
  const aria = h.w.document.createElement('div');
  aria.setAttribute('role', 'slider'); aria.setAttribute('aria-valuenow', '20');
  aria.setAttribute('aria-valuemin', '0'); aria.setAttribute('aria-valuemax', '100');
  h.w.document.body.append(aria);
  assert.equal(writable(h.R.plan(aria, { value: 70 })), false); safe(h);
});

test('slider gestures cannot activate a surrounding label or business action', async t => {
  for (const family of families) {
    for (const wrapperTag of ['label', 'button', 'a']) {
      const h = boot(t, family), wrapper = h.w.document.createElement(wrapperTag);
      if (wrapperTag === 'label') wrapper.htmlFor = 'save';
      if (wrapperTag === 'button') { wrapper.type = 'submit'; wrapper.setAttribute('aria-label', 'Save'); }
      if (wrapperTag === 'a') wrapper.href = 'https://offline.invalid/submit';
      h.el.before(wrapper); wrapper.append(h.el);
      const plan = h.plan({ operation: 'click', value: 70 });
      assert.equal(writable(plan), false, `${family} ${wrapperTag}`);
      assert.deepEqual(h.events, []); safe(h);
    }
  }
});

const require = createRequire(import.meta.url);
test('pinned real Element UI and ant-design-vue Slider handlers set, click and drag with both readbacks', async t => {
  const dom = new JSDOM('<!doctype html><body><form><div id="app"></div><input id="neighbor" value="KEEP">'
    + '<button type="button" id="save">Save</button><button type="submit">Submit</button></form></body>',
  { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://offline.invalid/real-slider' });
  const w = dom.window;
  let app;
  t.after(() => { app?.$destroy(); w.close(); });
  w.Element.prototype.getClientRects = () => [{ width: 200, height: 20 }];
  w.Element.prototype.getBoundingClientRect = () => ({ x: 100, y: 50, left: 100, right: app?.vertical ? 120 : 300,
    top: 50, bottom: app?.vertical ? 250 : 70, width: app?.vertical ? 20 : 200, height: app?.vertical ? 200 : 20 });
  Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get: () => app?.vertical ? 20 : 200 });
  Object.defineProperty(w.HTMLElement.prototype, 'clientHeight', { get: () => app?.vertical ? 200 : 20 });
  for (const name of ['vue/dist/vue.js', 'moment/min/moment.min.js', 'element-ui/lib/index.js', 'ant-design-vue/dist/antd.js']) {
    w.eval(readFileSync(require.resolve(name), 'utf8'));
  }
  w.Vue.config.productionTip = false; w.Vue.config.devtools = false;
  w.Vue.use(w.ELEMENT); w.Vue.use(w.antd);
  app = new w.Vue({ el: '#app', data: () => ({ element: 20, ant: 20, vertical: false, reverse: false }),
    template: '<section><el-slider id="element" v-model="element" :vertical="vertical" height="200px"></el-slider>'
      + '<a-slider id="ant" v-model="ant" :vertical="vertical" :reverse="reverse"></a-slider></section>' });
  await w.Vue.nextTick();
  for (const name of ['model', 'registry', 'native', 'vue-controls', 'slider-controls']) {
    w.eval(readFileSync(new URL(`../src/content/controls/${name}.js`, import.meta.url), 'utf8'));
  }
  let forbidden = 0;
  w.document.querySelector('form').addEventListener('submit', event => { forbidden++; event.preventDefault(); });
  w.document.getElementById('save').addEventListener('click', () => forbidden++);
  for (const [id, adapterName, modelKey] of [['element', 'el-slider', 'element'], ['ant', 'antdv1-slider', 'ant']]) {
    const root = w.document.getElementById(id), adapter = w.ResumeControls.resolve(root);
    const handle = root.querySelector('.el-slider__button-wrapper,.ant-slider-handle');
    handle.getBoundingClientRect = () => {
      const ratio = id === 'ant' && app.reverse ? 1 - app[modelKey] / 100 : app[modelKey] / 100;
      const x = app.vertical ? 110 : 100 + ratio * 200, y = app.vertical ? 50 + (1 - ratio) * 200 : 60;
      return { x: x - 6, y: y - 6, left: x - 6, right: x + 6, top: y - 6, bottom: y + 6, width: 12, height: 12 };
    };
    assert.equal(adapter?.name, adapterName);
    for (const [vertical, reverse] of id === 'element' ? [[false, false], [true, false]]
      : [[false, false], [false, true], [true, false], [true, true]]) {
      app.vertical = vertical; app.reverse = reverse;
      await w.Vue.nextTick();
      for (const [operation, value] of [['set', 70], ['click', 40], ['drag', 90], ['drag', 10]]) {
        const plan = w.ResumeControls.plan(root, { operation, value });
        assert.equal(plan.status, 'planned', JSON.stringify({ id, vertical, reverse, plan }));
        const written = await adapter.write(root, plan, ctx);
        assert.equal(written.strategy, 'ui', JSON.stringify(written));
        await w.Vue.nextTick();
        const result = await adapter.verify(root, plan, { settleMs: 0 });
        assert.equal(result.status, 'success', JSON.stringify({ id, vertical, reverse, result }));
        assert.equal(app[modelKey], value); assert.equal(result.modelReadback, value); assert.equal(result.domReadback, value);
        if (id === 'element' && value === 70) {
          assert.notEqual(root.getAttribute('aria-valuetext'), '70', 'Element mounted aria-valuetext is stale; rendered thumb provides DOM readback');
        }
      }
    }
    const cancelled = w.ResumeControls.plan(root, { operation: 'drag', value: 70 });
    root.addEventListener('mousedown', () => root.setAttribute('aria-readonly', 'true'), { once: true });
    await assert.rejects(adapter.write(root, cancelled, ctx), /control_changed/u);
    root.removeAttribute('aria-readonly');
    for (const type of ['mousemove', 'mouseup']) {
      w.document.dispatchEvent(new w.MouseEvent(type, { bubbles: true, clientX: 110, clientY: 80, buttons: type === 'mousemove' ? 1 : 0 }));
    }
    await w.Vue.nextTick();
    assert.equal(app[modelKey], 10, 'cancelling after mousedown removes component gesture listeners before subsequent document events');
  }
  assert.equal(forbidden, 0); assert.equal(w.document.getElementById('neighbor').value, 'KEEP');
});
