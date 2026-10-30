import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import { boot, adapters, ctx, writable } from './fixtures/rate-harness.mjs';

const families = ['el', 'plus', 'antdv1', 'aria'];
const copy = value => JSON.parse(JSON.stringify(value));
const safe = h => {
  assert.equal(h.neighbor.value, 'KEEP');
  assert.equal(h.effects.save, 0); assert.equal(h.effects.submit, 0);
  assert.equal(h.R.liveSupportClaimed, false);
};
const noEffects = h => { assert.deepEqual(h.events, []); safe(h); };
async function attempt(h, plan, writeContext = ctx) {
  try { return await h.adapter().write(h.el, plan, writeContext); }
  catch { return { status: 'unsupported' }; }
}

for (const family of families) {
  test(`${family} rate sets explicit values in both directions with exact numeric readback`, async t => {
    const h = boot(t, family), adapter = h.adapter();
    assert.equal(adapter?.name, adapters[family]);
    for (const value of [0, '5', 3, 2]) {
      const plan = h.plan({ value });
      assert.equal(plan.status, 'planned', JSON.stringify(plan));
      assert.equal(plan.type, 'rate'); assert.equal(plan.operation, 'set');
      assert.equal(plan.liveSupportClaimed, false); assert.equal(plan.writeStarted, false);
      for (const key of ['value', 'modelValue', 'domValue']) assert.equal(plan[key], Number(value));
      const before = h.events.length;
      assert.equal((await adapter.write(h.el, plan)).reason, 'shadow_mode');
      assert.equal((await adapter.write(h.el, plan, { allowWrite: true })).reason, 'shadow_mode');
      assert.equal(h.events.length, before);
      const written = await adapter.write(h.el, plan, ctx);
      assert.equal(written.strategy, 'ui'); assert.ok(written.attempts > 0);
      const result = await adapter.verify(h.el, plan, { settleMs: 0 });
      assert.equal(result.status, 'success', JSON.stringify(result));
      assert.equal(result.modelReadback, Number(value)); assert.equal(result.domReadback, Number(value));
      assert.equal(h.plan({ value }).status, 'success');
      const count = h.events.length;
      assert.equal((await adapter.write(h.el, plan, ctx)).reason, 'preexisting_same_value');
      assert.equal(h.events.length, count, 'replay emits no UI effects'); safe(h);
    }
  });

  test(`${family} rate click chooses owned stars and verifies the requested value`, async t => {
    const h = boot(t, family);
    for (const value of [4, 1]) {
      const plan = h.plan({ operation: 'click', value });
      assert.equal(plan.status, 'planned', JSON.stringify(plan));
      assert.equal(plan.operation, 'click');
      const before = h.events.length;
      const written = await h.adapter().write(h.el, plan, ctx);
      assert.equal(written.strategy, 'ui'); assert.ok(written.attempts > 0);
      const result = await h.R.verify(h.el, plan, { settleMs: 0 });
      assert.equal(result.status, 'success', JSON.stringify(result));
      assert.equal(result.modelReadback, value); assert.equal(result.domReadback, value);
      const clicks = h.events.slice(before).filter(event => event.type === 'click');
      assert.equal(clicks.length, 1);
      assert.ok(h.el === clicks[0].target || h.el.contains(clicks[0].target)); safe(h);
    }
  });

  test(`${family} rate rejects malformed values, non-star steps and unknown operations passively`, t => {
    const h = boot(t, family);
    for (const value of [true, false, [], {}, null, '', Infinity, -Infinity, NaN, '3 stars', '0x3', '1,000',
      '0.10000000000000001', '1e-99999', 9007199254740992, -1, 6, 2.5, 2.25]) {
      assert.equal(writable(h.plan({ value })), false, String(value));
    }
    for (const operation of ['inc', 'toggle', 'drag', '', 'CLICK']) {
      assert.equal(writable(h.plan({ operation, value: 3 })), false, operation);
    }
    noEffects(h);
  });

  test(`${family} rate plans bind payload, operation and original widget`, async t => {
    const h = boot(t, family), other = boot(t, family), adapter = h.adapter();
    const plan = h.plan({ operation: 'click', value: 4 });
    for (const [target, instruction] of [[other.el, plan], [h.el, copy(plan)]]) {
      assert.equal((await adapter.write(target, instruction, ctx)).status, 'unsupported');
      assert.notEqual((await adapter.verify(target, instruction, { settleMs: 0 })).status, 'success');
    }
    for (const [key, value] of [['value', 5], ['modelValue', '4'], ['domValue', 5], ['operation', 'set'], ['type', 'number']]) {
      const changed = h.plan({ operation: 'click', value: 4 }); changed[key] = value;
      assert.equal((await adapter.write(h.el, changed, ctx)).status, 'unsupported', key);
      assert.notEqual((await adapter.verify(h.el, changed, { settleMs: 0 })).status, 'success', key);
    }
    h.paint(3);
    assert.equal((await adapter.write(h.el, plan, ctx)).status, 'unsupported', 'changed source requires a new plan');
    noEffects(h); noEffects(other);
  });

  test(`${family} rate same-value plans cannot succeed after becoming hidden or label-unsafe`, async t => {
    for (const mutate of [h => { h.el.style.display = 'none'; }, h => h.el.setAttribute('hidden', ''), h => {
      const label = h.w.document.createElement('label'); label.htmlFor = 'save'; h.el.before(label); label.append(h.el);
    }]) {
      const h = boot(t, family), adapter = h.adapter(), plan = h.plan({ value: 2 });
      assert.equal(plan.status, 'success');
      mutate(h);
      const written = await adapter.write(h.el, plan, ctx);
      assert.equal(written.status, 'unsupported'); assert.equal(written.reason, 'rate_not_interactable');
      const verified = await adapter.verify(h.el, plan, { settleMs: 0 });
      assert.equal(verified.status, 'unsupported'); assert.equal(verified.reason, 'rate_not_interactable');
      noEffects(h);
    }
  });

  test(`${family} rate guards disabled, readonly and inert ancestors before and after planning`, async t => {
    for (const attribute of ['disabled', 'readonly', 'aria-disabled', 'aria-readonly', 'inert']) {
      const h = boot(t, family), wrapper = h.w.document.createElement('section');
      h.el.before(wrapper); wrapper.append(h.el);
      const plan = h.plan({ operation: 'click', value: 4 });
      wrapper.setAttribute(attribute, attribute.startsWith('aria-') ? 'true' : '');
      assert.equal(writable(h.plan({ value: 4 })), false, attribute);
      await attempt(h, plan); noEffects(h);
    }
  });

  test(`${family} rate rechecks awaited cancellation and readonly changes before each effect`, async t => {
    const h = boot(t, family), plan = h.plan({ operation: 'click', value: 4 });
    await assert.rejects(h.adapter().write(h.el, plan, { allowWrite: true, check: async () => { throw Error('cancelled'); } }), /cancelled/u);
    noEffects(h);
    let checks = 0;
    await attempt(h, plan, { allowWrite: true, async check() {
      if (++checks === 2) h.el.setAttribute('aria-readonly', 'true');
    } });
    noEffects(h);
  });

  test(`${family} rate stops an interaction when its first effect makes it readonly`, async t => {
    const h = boot(t, family), plan = h.plan({ operation: 'click', value: 4 });
    for (const type of ['pointermove', 'mousemove', 'pointerdown', 'mousedown']) {
      h.el.addEventListener(type, () => h.el.setAttribute('aria-readonly', 'true'), { once: true });
    }
    await attempt(h, plan);
    assert.equal(h.events.filter(event => event.type === 'click').length, 0);
    assert.equal(h.value(), 2); safe(h);
  });

  test(`${family} rate rejects detached, hidden, unsafe wrapper and missing click geometry`, async t => {
    for (const mutate of [h => h.el.remove(), h => { h.el.style.display = 'none'; },
      h => { h.el.style.visibility = 'hidden'; }, h => { h.geometry.width = 0; },
      h => { h.geometry.left = NaN; }, h => {
        const label = h.w.document.createElement('label'); label.htmlFor = 'save'; h.el.before(label); label.append(h.el);
      }, h => {
        const link = h.w.document.createElement('a'); link.href = 'https://offline.invalid/submit'; h.el.before(link); link.append(h.el);
      }]) {
      const h = boot(t, family), plan = h.plan({ operation: 'click', value: 4 });
      mutate(h); await attempt(h, plan); noEffects(h);
    }
  });

  test(`${family} rate requires matching independent readbacks and detects reversion`, async t => {
    const h = boot(t, family), plan = h.plan({ value: 4 });
    await h.adapter().write(h.el, plan, ctx);
    assert.equal((await h.R.verify(h.el, plan, { settleMs: 0 })).status, 'success');
    h.paint(3, { dom: false });
    assert.notEqual((await h.R.verify(h.el, plan, { settleMs: 0 })).status, 'success');
    assert.equal(writable(h.plan({ value: 5 })), false, 'model/DOM disagreement is passive');
    h.paint(4); h.paint(3, { model: false });
    assert.notEqual((await h.R.verify(h.el, plan, { settleMs: 0 })).status, 'success');
    h.paint(4); h.w.setTimeout(() => h.paint(2), 5);
    assert.equal((await h.R.verify(h.el, plan, { settleMs: 20 })).status, 'reverted'); safe(h);
  });

  test(`${family} rate a non-updating event handler never earns successful readback`, async t => {
    const h = boot(t, family, { sync: false }), plan = h.plan({ operation: 'click', value: 4 });
    await attempt(h, plan);
    assert.notEqual((await h.R.verify(h.el, plan, { settleMs: 0 })).status, 'success');
    assert.equal(h.value(), 2); safe(h);
  });

  test(`${family} rate set stops between keys after a newly readonly state`, async t => {
    const h = boot(t, family), plan = h.plan({ value: 5 });
    h.el.addEventListener('keydown', () => h.el.setAttribute('aria-readonly', 'true'), { once: true });
    await attempt(h, plan);
    assert.equal(h.events.filter(event => event.type === 'keydown').length, 1);
    assert.notEqual(h.value(), 5); safe(h);
  });

  test(`${family} rate click stops when hover changes owned geometry`, async t => {
    const h = boot(t, family), plan = h.plan({ operation: 'click', value: 4 });
    const first = family === 'aria' ? 'pointerdown' : 'mousemove';
    h.el.addEventListener(first, () => { h.geometry.left += 20; }, { once: true });
    await attempt(h, plan);
    assert.equal(h.events.filter(event => event.type === first).length, 1);
    assert.equal(h.events.filter(event => event.type === 'click').length, 0);
    assert.equal(h.value(), 2); safe(h);
  });
}

for (const family of ['el', 'plus', 'antdv1']) {
  test(`${family} rate supports exact half-star set and click values`, async t => {
    const h = boot(t, family, { props: { allowHalf: true } });
    for (const [operation, value] of [['set', 2.5], ['click', 4.5], ['click', 1], ['set', 0]]) {
      const plan = h.plan({ operation, value });
      assert.equal(plan.status, 'planned', JSON.stringify(plan));
      await h.adapter().write(h.el, plan, ctx);
      const result = await h.R.verify(h.el, plan, { settleMs: 0 });
      assert.equal(result.status, 'success', JSON.stringify(result));
      assert.equal(result.domReadback, value); assert.equal(result.modelReadback, value);
    }
    assert.equal(writable(h.plan({ value: 1.25 })), false); safe(h);
  });

  test(`${family} rate refuses class-only or unknown-version widgets and malformed star collections`, t => {
    const h = boot(t, family);
    const library = family === 'el' ? h.w.ELEMENT : family === 'plus' ? h.w.ElementPlus : h.w.antd;
    const version = library.version; library.version = '99.0.0';
    assert.equal(writable(h.plan({ value: 4 })), false);
    library.version = version;
    const duplicate = h.items[0].cloneNode(true); h.el.append(duplicate);
    assert.equal(writable(h.plan({ value: 4 })), false);
    duplicate.remove();
    if (family === 'plus') delete h.el.__vueParentComponent;
    else delete h.el.__vue__;
    assert.equal(writable(h.plan({ value: 4 })), false);
    assert.notEqual(h.adapter()?.name, 'aria-rate'); noEffects(h);
  });

  test(`${family} rate invalidates owner, star target and constraints changed after planning`, async t => {
    for (const mutate of [h => {
      if (family === 'plus') h.el.__vueParentComponent = { ...h.owner, props: { ...h.props } };
      else h.el.__vue__ = { ...h.owner, $props: { ...h.props } };
    }, h => h.targets[0].replaceWith(h.targets[0].cloneNode(true)),
    h => { h.props.allowHalf = true; }, h => { h.props[family === 'antdv1' ? 'count' : 'max'] = 6; },
    h => { h.props[h.key] = '2'; }]) {
      const h = boot(t, family), plan = h.plan({ operation: 'click', value: 4 });
      mutate(h); await attempt(h, plan); noEffects(h);
    }
  });

  test(`${family} rate descendant readonly and non-direct stars invalidate the whole widget`, async t => {
    for (const mutate of [h => h.targets[0].setAttribute('aria-readonly', 'true'),
      h => h.targets[0].setAttribute('aria-disabled', 'true'), h => {
        const wrapper = h.w.document.createElement('span'); h.items[0].before(wrapper); wrapper.append(h.items[0]);
      }]) {
      const h = boot(t, family), plan = h.plan({ operation: 'click', value: 4 });
      mutate(h); assert.equal(writable(h.plan({ value: 4 })), false);
      await attempt(h, plan); noEffects(h);
    }
  });
}

for (const family of ['plus', 'antdv1']) {
  test(`${family} rate clear click uses the confirmed current star only when clearing is enabled`, async t => {
    const h = boot(t, family, { initial: 2.5, props: { allowHalf: true, clearable: true, allowClear: true } });
    const plan = h.plan({ operation: 'click', value: 0 });
    assert.equal(plan.status, 'planned', JSON.stringify(plan));
    await h.adapter().write(h.el, plan, ctx);
    assert.equal((await h.R.verify(h.el, plan, { settleMs: 0 })).status, 'success');
    assert.equal(h.value(), 0); assert.equal(h.events.filter(event => event.type === 'click').length, 1);
    safe(h);
    const disabled = boot(t, family, { props: { clearable: false, allowClear: false } });
    assert.equal(writable(disabled.plan({ operation: 'click', value: 0 })), false); noEffects(disabled);
  });
}

test('ant Rate contradictory radio metadata and non-contiguous filled stars remain passive', t => {
  for (const mutate of [h => h.targets[0].setAttribute('aria-checked', 'false'),
    h => h.targets[0].setAttribute('aria-posinset', '2'),
    h => h.targets[0].setAttribute('aria-setsize', '6'),
    h => { h.items[4].className = 'ant-rate-star ant-rate-star-full'; h.targets[4].setAttribute('aria-checked', 'true'); },
    h => h.items[0].classList.add('ant-rate-star-half')]) {
    const h = boot(t, 'antdv1'); mutate(h);
    assert.equal(writable(h.plan({ value: 4 })), false); noEffects(h);
  }
});

for (const family of ['el', 'plus', 'antdv1']) {
  test(`${family} rate an active hover cannot earn a same-value no-op or successful verification`, async t => {
    const h = boot(t, family), plan = h.plan({ value: 2 });
    assert.equal(plan.status, 'success');
    if (family === 'el') h.owner.hoverIndex = 2;
    else if (family === 'plus') h.targets[1].classList.add('hover');
    else h.inner.hoverValue = 2;
    assert.equal(writable(h.plan({ value: 2 })), false);
    assert.equal((await h.adapter().write(h.el, plan, ctx)).status, 'unsupported');
    const verified = await h.R.verify(h.el, plan, { settleMs: 0 });
    assert.equal(verified.status, 'unsupported'); assert.equal(verified.reason, 'rate_busy'); noEffects(h);
  });
}

test('Vue3 wrappers containing more than one rating cannot borrow a child rate model', t => {
  const h = boot(t, 'plus'), wrapper = h.w.document.createElement('section');
  h.el.before(wrapper); wrapper.append(h.el);
  const other = h.el.cloneNode(true); other.id = 'second'; wrapper.append(other);
  const otherOwner = { ...h.owner, props: { ...h.props }, subTree: { el: other } };
  other.__vueParentComponent = otherOwner;
  wrapper.__vueParentComponent = { type: { name: 'RatingFormRow' }, props: { modelValue: 2 },
    subTree: { el: wrapper, children: [{ component: h.owner }, { component: otherOwner }] } };
  assert.equal(writable(h.R.plan(wrapper, { value: 4 })), false);
  assert.equal(h.R.resolve(h.targets[0])?.name, 'elplus-rate', 'owned descendant still resolves its own widget');
  noEffects(h);
});

test('ARIA rating refuses nested editors and special controls instead of borrowing their semantics', t => {
  for (const markup of ['<input type="range">', '<textarea></textarea>', '<select></select>',
    '<div contenteditable="true"></div>', '<div role="slider"></div>', '<div role="combobox"></div>',
    '<div role="listbox"></div>', '<div role="tree"></div>', '<div class="el-rate"></div>',
    '<div class="ant-slider"></div>']) {
    const h = boot(t, 'aria'); h.el.insertAdjacentHTML('beforeend', markup);
    assert.equal(writable(h.plan({ value: 4 })), false, markup); noEffects(h);
  }
});

test('ARIA ordinary sliders, missing rating text, inconsistent bounds and unsupported orientations remain manual', t => {
  for (const mutate of [h => h.el.removeAttribute('aria-roledescription'),
    h => h.el.setAttribute('aria-roledescription', 'volume'),
    h => h.el.removeAttribute('aria-valuetext'), h => h.el.setAttribute('aria-valuetext', 'four stars'),
    h => h.el.setAttribute('aria-valuetext', '2 of 6 stars'),
    h => h.el.setAttribute('aria-valuemin', '1'), h => h.el.setAttribute('aria-valuemax', '5.5'),
    h => h.el.setAttribute('aria-valuemax', '100'), h => h.el.setAttribute('aria-valuenow', '2.5'),
    h => h.el.setAttribute('aria-orientation', 'vertical'), h => h.el.setAttribute('aria-orientation', 'diagonal'),
    h => { h.el.style.direction = 'rtl'; },
    h => h.el.setAttribute('tabindex', '-1')]) {
    const h = boot(t, 'aria'); mutate(h);
    assert.equal(writable(h.plan({ value: 4 })), false); noEffects(h);
  }
});

test('ARIA rating accepts explicit numeric out-of text and never guesses a zero click', async t => {
  const h = boot(t, 'aria');
  h.el.setAttribute('aria-valuetext', '2 out of 5 stars');
  assert.equal(h.plan({ value: 4 }).status, 'planned');
  assert.equal(writable(h.plan({ operation: 'click', value: 0 })), false);
  const plan = h.plan({ value: 0 });
  await h.adapter().write(h.el, plan, ctx);
  assert.equal((await h.R.verify(h.el, plan, { settleMs: 0 })).status, 'success'); safe(h);
});

const require = createRequire(import.meta.url);
for (const family of ['el', 'plus', 'antdv1']) {
  test(`pinned real ${family} Rate handlers set and click whole and half stars with independent readback`, async t => {
    const dom = new JSDOM('<!doctype html><body><form><div id="app"></div><input id="neighbor" value="KEEP">'
      + '<button id="save" type="button">Save</button><button type="submit">Submit</button></form></body>',
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://offline.invalid/real-rate' });
    const w = dom.window; let app, instance;
    t.after(() => { if (family === 'plus') app?.unmount(); else app?.$destroy(); w.close(); });
    w.Element.prototype.getClientRects = () => [{ width: 20, height: 20 }];
    w.Element.prototype.getBoundingClientRect = function () {
      const item = this.closest('.el-rate__item,.ant-rate-star');
      const index = item ? [...item.parentElement.children].indexOf(item) : 0;
      const left = 100 + index * 20, width = this.matches('.el-rate,.ant-rate') ? 100 : 20;
      return { x: left, y: 40, left, right: left + width, top: 40, bottom: 60, width, height: 20 };
    };
    Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get: () => 20 });
    const vendors = family === 'plus' ? ['vue3/dist/vue.global.js', 'element-plus/dist/index.full.js']
      : ['vue/dist/vue.js', ...(family === 'el' ? ['element-ui/lib/index.js'] : ['moment/min/moment.min.js', 'ant-design-vue/dist/antd.js'])];
    for (const name of vendors) w.eval(readFileSync(require.resolve(name), 'utf8'));
    const component = { data: () => ({ value: 2, allowHalf: false }),
      template: family === 'antdv1'
        ? '<section><a-rate id="target" v-model="value" :allow-half="allowHalf"></a-rate></section>'
        : '<section><el-rate id="target" v-model="value" :allow-half="allowHalf"></el-rate></section>' };
    if (family === 'plus') { app = w.Vue.createApp(component); app.use(w.ElementPlus); instance = app.mount('#app'); }
    else {
      w.Vue.config.productionTip = false; w.Vue.config.devtools = false;
      w.Vue.use(family === 'el' ? w.ELEMENT : w.antd);
      app = new w.Vue({ el: '#app', ...component }); instance = app;
    }
    await w.Vue.nextTick();
    for (const name of ['model', 'registry', 'native', 'vue-controls', 'rate-controls']) {
      w.eval(readFileSync(new URL(`../src/content/controls/${name}.js`, import.meta.url), 'utf8'));
    }
    let forbidden = 0;
    w.document.getElementById('save').addEventListener('click', () => forbidden++);
    w.document.querySelector('form').addEventListener('submit', event => { forbidden++; event.preventDefault(); });
    const root = w.document.getElementById('target'), adapter = w.ResumeControls.resolve(root);
    assert.equal(adapter?.name, adapters[family]);
    for (const half of [false, true]) {
      instance.allowHalf = half; await w.Vue.nextTick();
      for (const [operation, value] of [['set', 0], ['set', half ? 3.5 : 3], ['click', half ? 4.5 : 5], ['click', 1]]) {
        const plan = w.ResumeControls.plan(root, { operation, value });
        assert.equal(plan.status, 'planned', JSON.stringify({ family, half, plan }));
        const written = await adapter.write(root, plan, ctx);
        assert.equal(written.strategy, 'ui', JSON.stringify(written));
        await w.Vue.nextTick();
        const result = await adapter.verify(root, plan, { settleMs: 0 });
        assert.equal(result.status, 'success', JSON.stringify({ family, half, operation, value, result }));
        assert.equal(instance.value, value); assert.equal(result.modelReadback, value); assert.equal(result.domReadback, value);
      }
    }
    assert.equal(forbidden, 0); assert.equal(w.document.getElementById('neighbor').value, 'KEEP');
    assert.equal(w.ResumeControls.liveSupportClaimed, false);
  });
}
