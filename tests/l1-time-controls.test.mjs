import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { readControlCandidatesInPage } from '../src/background/controls-write.mjs';

const sources = ['model', 'registry', 'native', 'date-controls', 'vue-controls', 'time-controls'].map(name =>
  readFileSync(new URL(`../src/content/controls/${name}.js`, import.meta.url), 'utf8'));
const ctx = { allowWrite: true, check: async () => {} };

function boot(t, html = '<input id="target" type="time">') {
  const dom = new JSDOM(`<!doctype html><body>${html}<input id="neighbor" value="KEEP"></body>`,
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://offline.example.test/time' });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  w.ELEMENT = { version: '2.15.14' }; w.antd = { version: '1.7.8' };
  for (const source of sources) w.eval(source);
  const get = id => w.document.getElementById(id), el = get('target'), R = w.ResumeControls;
  return { w, R, el, get, plan: value => R.plan(el, { value }),
    component(root, name, props, extra = {}) {
      const vm = { $el: root, $options: { name }, $props: props, ...extra };
      root.__vue__ = vm;
      return vm;
    } };
}

test('native time detection and planning are passive with explicit local time precision', t => {
  const f = boot(t), effects = [];
  for (const event of ['focus', 'click', 'input', 'change', 'blur']) f.el.addEventListener(event, () => effects.push(event));
  assert.equal(f.R.resolve(f.el).name, 'native-time');
  const instruction = f.plan('09:30');
  assert.equal(instruction.status, 'planned');
  assert.equal(instruction.value, '09:30');
  assert.equal(instruction.liveSupportClaimed, false);
  assert.equal(instruction.writeStarted, false);
  assert.equal(f.R.liveSupportClaimed, false);
  assert.deepEqual(effects, []);
  assert.equal(f.plan('09:30:45').status, 'manual', 'default HTML step is sixty seconds');
  for (const value of ['9:30', '24:00', '12:60', '09:30Z', '09:30+08:00', '2024-02-29T09:30', ['09:30'], 930]) {
    assert.equal(f.plan(value).status, 'manual', String(value));
  }
});

test('native time enforces min/max and step without losing seconds', t => {
  const f = boot(t, '<input id="target" type="time" min="09:00" max="17:00" step="900">');
  assert.equal(f.plan('09:15').status, 'planned');
  for (const value of ['08:59', '17:01', '09:16']) assert.equal(f.plan(value).status, 'manual', value);
  f.el.step = '1';
  assert.equal(f.plan('09:15:23').status, 'planned');
  for (const value of ['09:15:60', '09:15:23.1']) assert.equal(f.plan(value).status, 'manual', value);
  f.el.step = 'any';
  assert.equal(f.plan('09:15:23').status, 'planned');
});

test('malformed time constraints fail before any write', t => {
  const f = boot(t);
  for (const [name, value] of [['min', 'morning'], ['max', '25:00'], ['step', '0'], ['step', '-1'], ['step', 'NaN']]) {
    f.el.setAttribute(name, value);
    assert.equal(f.plan('09:30').status, 'manual', `${name}=${value}`);
    f.el.removeAttribute(name);
  }
});

test('native time never treats the middle of a cross-midnight interval as allowed', t => {
  const f = boot(t, '<input id="target" type="time" min="22:00" max="02:00">');
  assert.equal(f.plan('12:00').status, 'manual');
  const late = f.plan('23:30'), early = f.plan('01:30');
  assert.ok(['manual', 'planned'].includes(late.status));
  assert.equal(early.status, late.status, 'a reviewed wrap contract may accept both ends; otherwise both remain manual');
});

test('native time shadow gate, checked input events and two sampled readbacks preserve neighbors', async t => {
  const f = boot(t), adapter = f.R.resolve(f.el), instruction = f.plan('09:30'), effects = [];
  for (const event of ['input', 'change', 'blur', 'click']) f.el.addEventListener(event, () => effects.push(event));
  assert.equal((await adapter.write(f.el, instruction)).reason, 'shadow_mode');
  assert.deepEqual(effects, []);
  await assert.rejects(adapter.write(f.el, instruction, { allowWrite: true, check: async () => { throw Error('guard_denied'); } }), /guard_denied/u);
  assert.deepEqual(effects, []);
  assert.equal((await adapter.write(f.el, instruction, ctx)).attempts, 1);
  assert.deepEqual(effects, ['input', 'change', 'blur']);
  const result = await adapter.verify(f.el, instruction, { settleMs: 0 });
  assert.equal(result.status, 'success');
  assert.equal(result.domReadback, '09:30');
  assert.equal(result.modelReadback, '09:30');
  assert.equal(f.get('neighbor').value, 'KEEP');
  f.w.setTimeout(() => { f.el.value = ''; }, 5);
  assert.equal((await adapter.verify(f.el, instruction, { settleMs: 20 })).status, 'reverted');
});

test('native time preserves existing, disabled, and readonly controls', async t => {
  const f = boot(t, '<input id="target" type="time" readonly><fieldset disabled><input id="disabled" type="time"></fieldset>');
  assert.equal(f.plan('09:30').reason, 'readonly');
  assert.equal(f.R.plan(f.get('disabled'), { value: '09:30' }).reason, 'disabled');
  f.el.readOnly = false; f.el.value = '08:00';
  assert.equal(f.plan('09:30').reason, 'existing_value');
  const instruction = f.plan('08:00');
  assert.equal(instruction.status, 'success');
  assert.equal((await f.R.resolve(f.el).write(f.el, instruction, ctx)).attempts, 0);
});

test('native time rechecks type, constraints, ownership and pending user edits before effects', async t => {
  for (const mutate of [f => { f.el.type = 'text'; }, f => { f.el.min = '10:00'; },
    f => { f.el.value = '08:00'; }, f => { f.el.disabled = true; },
    f => { f.el.__reactFiber$offline = { memoizedProps: { value: '' }, stateNode: f.el }; }]) {
    const f = boot(t), adapter = f.R.resolve(f.el), instruction = f.plan('09:30');
    let effects = 0; f.el.addEventListener('input', () => effects++);
    mutate(f);
    const result = await adapter.write(f.el, instruction, ctx);
    assert.equal(result.attempts, 0);
    assert.equal(result.status, 'unsupported');
    assert.equal(effects, 0);
  }
});

test('time instructions cannot move to another control or regain authority after serialization', async t => {
  const f = boot(t, '<input id="target" type="time"><input id="other" type="time">');
  const adapter = f.R.resolve(f.el), instruction = f.plan('09:30');
  for (const [el, plan] of [[f.get('other'), instruction], [f.el, JSON.parse(JSON.stringify(instruction))]]) {
    const result = await adapter.write(el, plan, ctx);
    assert.equal(result.status, 'unsupported');
    assert.equal(result.attempts, 0);
    assert.equal(el.value, '');
  }
});

test('an executable time plan cannot be retargeted by changing its fact or type', async t => {
  for (const mutate of [plan => { plan.value = '10:00'; plan.modelValue = '10:00'; plan.domValue = '10:00'; },
    plan => { plan.type = 'text'; }]) {
    const f = boot(t), instruction = f.plan('09:30'), adapter = f.R.resolve(f.el);
    mutate(instruction);
    const result = await adapter.write(f.el, instruction, ctx);
    assert.equal(result.status, 'unsupported');
    assert.equal(result.attempts, 0);
    assert.equal(f.el.value, '');
  }
});

test('unknown time surfaces and native type downgrades are consumed manually', t => {
  const f = boot(t, '<input id="target" type="time"><div class="custom-time-picker"><input id="custom"></div>'
    + '<div class="ant-time-picker"><input id="ant"></div><div class="el-date-editor--time"><input id="el"></div>');
  Object.defineProperty(f.el, 'type', { value: 'text' });
  for (const id of ['target', 'custom', 'ant', 'el']) {
    const plan = f.R.plan(f.get(id), { value: '09:30' });
    assert.equal(plan.status, 'manual', id);
    assert.equal(plan.liveSupportClaimed, false);
  }
});

test('an unconfirmed Element time owner cannot fall through to its generic input adapter', t => {
  const f = boot(t, '<div id="target" class="el-date-editor el-date-editor--time el-input"><input></div>');
  f.component(f.el, 'ElInput', { value: '', type: 'text' });
  assert.equal(f.R.resolve(f.el.querySelector('input')).name, 'time-unknown');
  assert.equal(f.R.plan(f.el.querySelector('input'), { value: '09:30' }).status, 'manual');
});

// First-party public contract replay. No captured site, endpoint or field ID.
function picker(t, lib, { seconds = false, formatted = true } = {}) {
  const ant = lib === 'ant', format = seconds ? 'HH:mm:ss' : 'HH:mm';
  const f = boot(t, ant ? '<span id="target" class="ant-time-picker"><input class="ant-time-picker-input" readonly></span>'
    : '<div id="target" class="el-date-editor el-date-editor--time el-input"><input class="el-input__inner"></div>');
  const input = f.el.querySelector('input'), props = { value: null, format, valueFormat: formatted ? format : null };
  const calls = { open: 0, choices: [], confirm: 0, emits: 0, inputs: 0, submits: 0 };
  const vm = f.component(f.el, ant ? 'ATimePicker' : 'ElTimePicker', props, { $emit() { calls.emits++; } });
  const panel = f.w.document.createElement('div');
  panel.className = ant ? 'ant-time-picker-panel' : 'el-time-panel';
  panel.style.display = 'none';
  if (ant) vm.$refs = { timePicker: { $refs: { panel: { $el: panel } } } };
  const parts = [0, 0, 0], columns = seconds ? 3 : 2;
  const update = () => {
    const value = parts.slice(0, columns).map(part => String(part).padStart(2, '0')).join(':');
    input.value = value;
    props.value = formatted ? value : ant
      ? { _isAMomentObject: true, isValid: () => true, format: selected => selected === format ? value : 'UNEXPECTED_FORMAT' }
      : new f.w.Date(2024, 1, 29, ...parts);
  };
  for (let column = 0; column < columns; column++) {
    const wrapper = f.w.document.createElement('div');
    wrapper.className = ant ? 'ant-time-picker-panel-select' : 'el-time-spinner__wrapper';
    const list = f.w.document.createElement('ul');
    for (let number = 0; number < (column === 0 ? 24 : 60); number++) {
      const item = f.w.document.createElement('li');
      item.className = ant ? 'ant-time-picker-panel-select-option' : 'el-time-spinner__item';
      item.textContent = String(number).padStart(2, '0');
      item.addEventListener('click', () => {
        calls.choices.push([column, number]); parts[column] = number; update();
      });
      list.append(item);
    }
    wrapper.append(list); panel.append(wrapper);
  }
  if (!ant) {
    const footer = f.w.document.createElement('div'); footer.className = 'el-time-panel__footer';
    const confirm = f.w.document.createElement('button');
    confirm.type = 'button'; confirm.className = 'el-time-panel__btn confirm'; confirm.textContent = 'OK';
    confirm.addEventListener('click', () => { calls.confirm++; panel.style.display = 'none'; });
    footer.append(confirm); panel.append(footer); vm.picker = { $el: panel };
  }
  f.w.document.body.append(panel);
  input.addEventListener('click', () => { calls.open++; panel.style.display = ''; });
  input.addEventListener('keydown', event => { if (event.key === 'Escape') panel.style.display = 'none'; });
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') panel.style.display = 'none'; });
  input.addEventListener('input', () => calls.inputs++);
  f.w.document.addEventListener('submit', event => { calls.submits++; event.preventDefault(); });
  return { ...f, input, props, panel, calls, vm, adapterName: ant ? 'antdv1-time' : 'el-time',
    option: (column, number) => panel.querySelectorAll('ul')[column].children[number] };
}

for (const lib of ['ant', 'el']) {
  test(`${lib} TimePicker plans passively and writes only through its hour/minute panel`, async t => {
    const f = picker(t, lib), adapter = f.R.resolve(f.input), instruction = f.R.plan(f.input, { value: '09:30' });
    assert.equal(adapter?.name, f.adapterName);
    assert.equal(instruction.status, 'planned');
    assert.equal(instruction.liveSupportClaimed, false);
    assert.equal(instruction.writeStarted, false);
    assert.equal(f.calls.open, 0);
    assert.equal((await adapter.write(f.input, instruction)).reason, 'shadow_mode');
    assert.equal(f.calls.open, 0);
    const written = await adapter.write(f.input, instruction, ctx);
    assert.equal(written.strategy, 'ui', JSON.stringify(written));
    assert.deepEqual(f.calls.choices, [[0, 9], [1, 30]]);
    const result = await adapter.verify(f.input, instruction, { settleMs: 0 });
    assert.equal(result.status, 'success', JSON.stringify(result));
    assert.equal(result.domReadback, '09:30');
    assert.equal(result.modelReadback, '09:30');
    assert.equal(f.panel.style.display, 'none');
    assert.equal(f.calls.emits, 0); assert.equal(f.calls.inputs, 0); assert.equal(f.calls.submits, 0);
    assert.equal(f.get('neighbor').value, 'KEEP');
  });

  test(`${lib} TimePicker default model keeps its time precision and seconds can use three columns`, async t => {
    for (const seconds of [false, true]) {
      const f = picker(t, lib, { seconds, formatted: false }), value = seconds ? '09:30:45' : '09:30';
      const instruction = f.R.plan(f.input, { value }), adapter = f.R.resolve(f.input);
      assert.equal(instruction.status, 'planned');
      const written = await adapter.write(f.input, instruction, ctx);
      assert.equal(written.strategy, 'ui', JSON.stringify(written));
      assert.equal((await adapter.verify(f.input, instruction, { settleMs: 0 })).status, 'success');
      assert.equal(f.calls.choices.length, seconds ? 3 : 2);
      if (lib === 'ant') assert.equal(f.props.value._isAMomentObject, true);
      else assert.equal(f.props.value instanceof f.w.Date, true);
    }
  });

  test(`${lib} TimePicker rejects unknown versions, formats, model kinds and time truncation`, t => {
    const f = picker(t, lib);
    for (const value of ['24:00', '09:60', '9:30', '09:30:45', '09:30Z', ['09:30']]) {
      assert.equal(f.R.plan(f.input, { value }).status, 'manual', String(value));
    }
    for (const mutate of [() => { f.props.format = 'h:mm A'; },
      () => { f.props.format = 'HH:mm'; f.props.valueFormat = 'HH:mm:ss'; },
      () => { f.props.valueFormat = 'HH:mm'; f.props.value = ['09:30']; },
      () => { f.props.value = null; f.w[lib === 'ant' ? 'antd' : 'ELEMENT'].version = '99.0.0'; }]) {
      mutate();
      assert.equal(f.R.plan(f.input, { value: '09:30' }).status, 'manual');
    }
    assert.equal(f.calls.open, 0); assert.deepEqual(f.calls.choices, []);
  });

  test(`${lib} TimePicker requires matching DOM/model and observes a later reversion`, async t => {
    const f = picker(t, lib), instruction = f.R.plan(f.input, { value: '09:30' }), adapter = f.R.resolve(f.input);
    f.input.value = '09:30';
    assert.equal((await adapter.verify(f.input, instruction, { settleMs: 0 })).status, 'mismatch');
    f.props.value = '09:30';
    assert.equal((await adapter.verify(f.input, instruction, { settleMs: 0 })).status, 'success');
    f.input.value = '08:00';
    assert.equal((await adapter.verify(f.input, instruction, { settleMs: 0 })).status, 'mismatch');
    f.input.value = '09:30';
    f.w.setTimeout(() => { f.props.value = null; f.input.value = ''; }, 5);
    assert.equal((await adapter.verify(f.input, instruction, { settleMs: 20 })).status, 'reverted');
  });

  test(`${lib} TimePicker preserves nonempty values and rechecks owner or state before opening`, async t => {
    for (const mutate of [f => { f.props.disabled = true; }, f => { f.props.readonly = true; },
      f => { f.props.value = '08:00'; f.input.value = '08:00'; },
      f => { f.el.__vue__ = { ...f.vm }; }]) {
      const f = picker(t, lib), instruction = f.R.plan(f.input, { value: '09:30' }), adapter = f.R.resolve(f.input);
      mutate(f);
      const result = await adapter.write(f.input, instruction, ctx);
      assert.equal(result.status, 'unsupported');
      assert.equal(result.attempts, 0);
      assert.equal(f.calls.open, 0); assert.deepEqual(f.calls.choices, []);
    }
  });

  test(`${lib} TimePicker checks its guard again between pointerdown and option click`, async t => {
    const f = picker(t, lib), instruction = f.R.plan(f.input, { value: '09:30' }), adapter = f.R.resolve(f.input);
    let downs = 0;
    f.option(0, 9).addEventListener('pointerdown', () => { downs++; f.props.disabled = true; });
    await assert.rejects(adapter.write(f.input, instruction, ctx), /changed|disabled|writable/u);
    assert.equal(downs, 1); assert.deepEqual(f.calls.choices, []);
    assert.equal(f.input.value, '');
  });

  test(`${lib} TimePicker notices an option list becoming ambiguous during pointerdown`, async t => {
    const f = picker(t, lib), instruction = f.R.plan(f.input, { value: '09:30' }), adapter = f.R.resolve(f.input);
    f.option(0, 9).addEventListener('pointerdown', event => {
      event.currentTarget.parentElement.append(event.currentTarget.cloneNode(true));
    });
    await assert.rejects(adapter.write(f.input, instruction, ctx), /option_changed|ambiguous/u);
    assert.deepEqual(f.calls.choices, []);
    assert.equal(f.input.value, '');
  });

  test(`${lib} TimePicker instructions stay bound to the original component`, async t => {
    const f = picker(t, lib), instruction = f.R.plan(f.input, { value: '09:30' }), adapter = f.R.resolve(f.input);
    const other = f.el.cloneNode(true); other.id = 'other'; f.w.document.body.append(other);
    f.component(other, lib === 'ant' ? 'ATimePicker' : 'ElTimePicker', { ...f.props });
    const result = await adapter.write(other.querySelector('input'), instruction, ctx);
    assert.equal(result.status, 'unsupported');
    assert.equal(result.attempts, 0);
    assert.equal(f.calls.open, 0);
    assert.deepEqual(f.calls.choices, []);
  });

  test(`${lib} TimePicker rejects disabled, duplicated or ambiguous panel options`, async t => {
    for (const mode of ['disabled', 'duplicate', 'extra-panel']) {
      const f = picker(t, lib), instruction = f.R.plan(f.input, { value: '09:30' }), adapter = f.R.resolve(f.input);
      if (mode === 'disabled') f.option(0, 9).classList.add(lib === 'ant' ? 'ant-time-picker-panel-select-option-disabled' : 'disabled');
      if (mode === 'duplicate') f.option(0, 9).parentElement.append(f.option(0, 9).cloneNode(true));
      if (mode === 'extra-panel') {
        const extra = f.panel.cloneNode(true); extra.style.display = '';
        f.w.document.body.append(extra);
      }
      const result = await adapter.write(f.input, instruction, ctx);
      assert.notEqual(result.strategy, 'ui', `${mode}: ${JSON.stringify(result)}`);
      assert.deepEqual(f.calls.choices, []);
    }
  });
}

test('time registration is inert when reinjected', t => {
  const f = boot(t), before = f.R.list().length;
  f.w.eval(sources.at(-1));
  assert.equal(f.R.list().length, before);
});

test('ordinary candidate discovery includes confirmed native and Vue time controls without effects', t => {
  for (const kind of ['native', 'ant', 'el']) {
    const f = kind === 'native' ? boot(t) : picker(t, kind);
    const result = f.w.eval(`(${readControlCandidatesInPage.toString()})`)(f.w.location.href, f.w.performance.timeOrigin);
    assert.equal(result.candidates.length, 1, kind);
    const row = result.candidates[0];
    assert.equal(row.adapter, kind === 'native' ? 'native-time' : f.adapterName);
    assert.equal(row.type, 'time');
    assert.equal(f.w.document.querySelector(row.selector), f.input || f.el);
    assert.equal(result.writeStarted, false); assert.equal(result.liveSupportClaimed, false);
    if (f.calls) { assert.equal(f.calls.open, 0); assert.deepEqual(f.calls.choices, []); }
  }
});

test('Element opening accepts only its visible owned panel date initialization', async t => {
  for (const validInitialization of [true, false]) {
    const f = picker(t, 'el'), instruction = f.R.plan(f.input, { value: '09:30' }), adapter = f.R.resolve(f.input);
    f.vm.picker.date = new f.w.Date(2024, 1, 29, 7, 15, 0);
    f.input.addEventListener('click', () => {
      f.props.value = validInitialization ? '07:15' : '08:00'; f.input.value = f.props.value;
    });
    if (validInitialization) {
      assert.equal((await adapter.write(f.input, instruction, ctx)).strategy, 'ui');
      assert.equal((await adapter.verify(f.input, instruction, { settleMs: 0 })).status, 'success');
    } else {
      await assert.rejects(adapter.write(f.input, instruction, ctx), /control_changed/u);
      assert.deepEqual(f.calls.choices, []);
    }
  }
});

test('Element confirmation cannot escape its owning time panel during pointerdown', async t => {
  const f = picker(t, 'el'), instruction = f.R.plan(f.input, { value: '09:30' }), adapter = f.R.resolve(f.input);
  f.panel.querySelector('button.confirm').addEventListener('pointerdown', event => {
    f.w.document.body.append(event.currentTarget);
  });
  await assert.rejects(adapter.write(f.input, instruction, ctx), /confirm_changed|control_changed|panel_changed/u);
  assert.equal(f.calls.confirm, 0);
});
