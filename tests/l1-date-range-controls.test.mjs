import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { readControlCandidatesInPage } from '../src/background/controls-write.mjs';

const sources = ['model', 'registry', 'native', 'date-controls', 'vue-controls', 'time-controls', 'date-range-controls'].map(name =>
  readFileSync(new URL(`../src/content/controls/${name}.js`, import.meta.url), 'utf8'));
const ctx = { allowWrite: true, check: async () => {} };
const target = ['2024-02-29', '2024-03-02'];
const plain = value => JSON.parse(JSON.stringify(value));

function boot(t, html = '<fieldset id="target" data-date-range><input id="start" type="date"><input id="end" type="date"></fieldset>') {
  const dom = new JSDOM(`<!doctype html><body><form>${html}<input id="neighbor" value="KEEP"><button type="submit">提交</button><button type="button">保存</button></form></body>`,
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://offline.example.test/date-range' });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  w.ELEMENT = { version: '2.15.14' }; w.antd = { version: '1.7.8' };
  for (const source of sources) w.eval(source);
  const get = id => w.document.getElementById(id), el = get('target'), R = w.ResumeControls;
  const effects = [], forbidden = [];
  for (const type of ['focus', 'pointerdown', 'click', 'input', 'change', 'blur']) {
    el.addEventListener(type, event => effects.push([type, event.target.id]));
  }
  w.document.querySelector('form').addEventListener('submit', event => { forbidden.push('submit'); event.preventDefault(); });
  for (const button of w.document.querySelectorAll('button')) button.addEventListener('click', () => forbidden.push('business-button'));
  return { w, R, el, get, effects, forbidden, plan: value => R.plan(el, { value }),
    component(root, name, props, extra = {}) {
      const vm = { $el: root, $options: { name }, $props: props, ...extra };
      root.__vue__ = vm;
      return vm;
    } };
}

for (const lib of ['ant', 'el']) test(`${lib} paired calendars report a partial write if the second day is disabled`, async t => {
  const f = componentRange(t, lib, { paired: true }), adapter = f.R.resolve(f.input), instruction = f.R.plan(f.input, { value: target });
  f.cell(1, target[1]).classList.add(lib === 'ant' ? 'ant-calendar-disabled-cell' : 'disabled');
  const result = await adapter.write(f.input, instruction, ctx);
  assert.equal(result.status, 'unsupported');
  assert.equal(result.attempts, 1); assert.equal(result.writeStarted, true);
  assert.deepEqual(f.calls.choices, [target[0]]);
  assert.equal(f.records[0].inputs[0].value, target[0]);
  assert.equal(f.records[1].inputs[0].value, '');
  assert.equal((await adapter.verify(f.input, instruction, { settleMs: 0 })).status, 'mismatch');
  assert.deepEqual(f.forbidden, []);
});

test('native date pair resolves as one passive, precise date-range contract', t => {
  const f = boot(t);
  for (const el of [f.el, f.get('start'), f.get('end')]) {
    assert.equal(f.R.resolve(el)?.name, 'native-date-range');
    const instruction = f.R.plan(el, { value: target });
    assert.equal(instruction.status, 'planned', JSON.stringify(instruction));
    assert.equal(instruction.type, 'date-range');
    assert.deepEqual(plain(instruction.value), target);
    assert.deepEqual(plain(instruction.modelValue), target);
    assert.deepEqual(plain(instruction.domValue), target);
    assert.equal(instruction.liveSupportClaimed, false);
    assert.equal(instruction.writeStarted, false);
  }
  assert.equal(f.R.liveSupportClaimed, false);
  assert.equal(f.w.ResumeDateRangeControls.liveSupportClaimed, false);
  assert.deepEqual(f.effects, []);
});

test('date-range facts require exactly two real days in chronological order', t => {
  const f = boot(t);
  for (const value of [null, '', '2024-02-29', [], [target[0]], [...target, '2024-03-03'],
    [target[1], target[0]], ['2023-02-29', target[1]], ['2024-04-31', '2024-05-01'],
    ['2024-02', '2024-03'], ['2024-2-29', target[1]], ['2024-02-29T00:00', target[1]],
    [20240229, 20240302], [null, target[1]], { start: target[0], end: target[1] }]) {
    assert.ok(['manual', 'unsupported'].includes(f.plan(value).status), JSON.stringify(value));
  }
  assert.equal(f.plan([target[0], target[0]]).status, 'planned');
  assert.deepEqual(f.effects, []);
});

test('date-range grouping never borrows neighboring or ambiguous controls', t => {
  for (const html of [
    '<div id="target"><input type="date"><input type="date"></div>',
    '<fieldset id="target" data-date-range><input type="date"></fieldset><input type="date">',
    '<fieldset id="target" data-date-range><input type="date"><input type="date"><input></fieldset>',
    '<fieldset id="target" data-date-range><input type="date"><input type="date"><select></select></fieldset>',
    '<fieldset id="target" data-date-range><input type="date"><input type="month"></fieldset>',
    '<fieldset id="target" data-date-range><input type="date"><input type="date"><input type="date"></fieldset>',
  ]) {
    const f = boot(t, html), instruction = f.plan(target);
    assert.ok(['manual', 'unsupported'].includes(instruction.status), `${html}: ${JSON.stringify(instruction)}`);
    assert.deepEqual(f.effects, []);
  }
});

test('native date pair constraints are checked for both endpoints before effects', t => {
  const f = boot(t);
  f.get('start').min = '2024-02-28'; f.get('start').max = '2024-03-01';
  f.get('end').min = '2024-03-01'; f.get('end').max = '2024-03-03';
  assert.equal(f.plan(target).status, 'planned');
  for (const value of [['2024-02-27', target[1]], [target[0], '2024-03-04']]) assert.equal(f.plan(value).status, 'manual');
  f.get('end').step = '2';
  assert.equal(f.plan(target).status, 'manual');
  f.get('end').step = 'any';
  assert.equal(f.plan(target).status, 'planned');
  for (const [name, value] of [['min', 'tomorrow'], ['max', '2024-02-30'], ['step', '0'], ['step', '-1'], ['step', 'NaN']]) {
    f.get('end').setAttribute(name, value);
    assert.equal(f.plan(target).status, 'manual', `${name}=${value}`);
    f.get('end').removeAttribute(name);
  }
  assert.deepEqual(f.effects, []);
});

test('native date pair preserves existing endpoints and fills only a matching partial range', async t => {
  const f = boot(t), adapter = f.R.resolve(f.el);
  f.get('start').value = target[0];
  const instruction = f.plan(target);
  assert.equal(instruction.status, 'planned');
  const written = await adapter.write(f.el, instruction, ctx);
  assert.ok(written.attempts > 0, JSON.stringify(written));
  assert.deepEqual(f.effects, [['input', 'end'], ['change', 'end'], ['blur', 'end']]);
  assert.equal(f.plan(target).status, 'success');
  assert.equal((await adapter.write(f.el, f.plan(target), ctx)).attempts, 0);
  assert.equal(f.plan(['2024-02-28', target[1]]).reason, 'existing_value');
  assert.equal(f.get('start').value, target[0]);
  assert.equal(f.get('end').value, target[1]);
});

test('native range write uses the shadow gate and dual endpoint readback without business clicks', async t => {
  const f = boot(t), adapter = f.R.resolve(f.el), instruction = f.plan(target);
  assert.equal((await adapter.write(f.el, instruction)).reason, 'shadow_mode');
  await assert.rejects(adapter.write(f.el, instruction, { allowWrite: true, check: async () => { throw Error('guard_denied'); } }), /guard_denied/u);
  assert.deepEqual(f.effects, []);
  const written = await adapter.write(f.el, instruction, ctx);
  assert.equal(written.strategy, 'native', JSON.stringify(written));
  assert.deepEqual(f.effects, [['input', 'start'], ['change', 'start'], ['blur', 'start'], ['input', 'end'], ['change', 'end'], ['blur', 'end']]);
  const result = await adapter.verify(f.el, instruction, { settleMs: 0 });
  assert.equal(result.status, 'success', JSON.stringify(result));
  assert.deepEqual(plain(result.domReadback), target);
  assert.deepEqual(plain(result.modelReadback), target);
  assert.equal(f.get('neighbor').value, 'KEEP');
  assert.deepEqual(f.forbidden, []);
  f.w.setTimeout(() => { f.get('end').value = ''; }, 5);
  assert.equal((await adapter.verify(f.el, instruction, { settleMs: 20 })).status, 'reverted');
  assert.equal((await adapter.verify(f.el, instruction, { previousSuccess: true, settleMs: 0 })).status, 'reverted');
});

test('native range refuses stale structure, ownership, state and constraints before any event', async t => {
  for (const mutate of [
    f => { f.get('end').disabled = true; }, f => { f.get('end').readOnly = true; },
    f => { f.get('end').min = '2025-01-01'; }, f => { f.get('end').type = 'month'; },
    f => { f.get('end').value = '2024-03-03'; },
    f => { f.get('end').__reactFiber$offline = { memoizedProps: { value: '' }, stateNode: f.get('end') }; },
    f => { const replacement = f.get('end').cloneNode(); f.get('end').replaceWith(replacement); },
  ]) {
    const f = boot(t), adapter = f.R.resolve(f.el), instruction = f.plan(target);
    mutate(f);
    const result = await adapter.write(f.el, instruction, ctx);
    assert.equal(result.status, 'unsupported', JSON.stringify(result));
    assert.equal(result.attempts, 0);
    assert.deepEqual(f.effects, []);
  }
});

test('removing an explicit range marker invalidates a pending native pair instruction', async t => {
  const f = boot(t, '<div id="target" data-date-range><input id="start" type="date"><input id="end" type="date"></div>');
  const adapter = f.R.resolve(f.el), instruction = f.plan(target);
  f.el.removeAttribute('data-date-range');
  const result = await adapter.write(f.el, instruction, ctx);
  assert.equal(result.status, 'unsupported'); assert.equal(result.attempts, 0);
  assert.deepEqual(f.effects, []);
});

test('native range instructions stay bound to their group, endpoints and original fact', async t => {
  for (const mode of ['json', 'value', 'type', 'root']) {
    const f = boot(t), adapter = f.R.resolve(f.el);
    let instruction = f.plan(target), el = f.el;
    if (mode === 'json') instruction = plain(instruction);
    if (mode === 'value') { instruction.value = ['2024-03-01', target[1]]; instruction.modelValue = [...instruction.value]; instruction.domValue = [...instruction.value]; }
    if (mode === 'type') instruction.type = 'text';
    if (mode === 'root') { el = f.el.cloneNode(true); el.id = 'other'; f.el.after(el); }
    const result = await adapter.write(el, instruction, ctx);
    assert.equal(result.status, 'unsupported', `${mode}: ${JSON.stringify(result)}`);
    assert.equal(result.attempts, 0);
    assert.deepEqual(f.effects, []);
  }
});

test('native range rechecks both endpoints between every effect and preserves an intervening user edit', async t => {
  const f = boot(t), adapter = f.R.resolve(f.el), instruction = f.plan(target);
  f.get('start').addEventListener('input', () => { f.get('end').value = '2024-03-03'; });
  await assert.rejects(adapter.write(f.el, instruction, ctx), /changed|existing_value|stale/u);
  assert.equal(f.get('end').value, '2024-03-03');
  assert.deepEqual(f.effects, [['input', 'start']]);
  assert.deepEqual(f.forbidden, []);
});

test('native pair unknown ownership, downgraded types and readonly groups remain manual', t => {
  for (const mutate of [
    f => { f.get('end').readOnly = true; }, f => { f.el.disabled = true; },
    f => { f.el.setAttribute('aria-readonly', 'true'); },
    f => { f.get('end').setAttribute('aria-readonly', 'true'); },
    f => { f.get('end').setAttribute('aria-disabled', 'true'); },
    f => { const wrapper = f.w.document.createElement('div'); wrapper.setAttribute('inert', ''); f.get('end').before(wrapper); wrapper.append(f.get('end')); },
    f => { Object.defineProperty(f.get('end'), 'type', { value: 'text' }); },
    f => { f.get('end').__reactFiber$offline = { memoizedProps: { value: '' }, stateNode: f.get('end') }; },
  ]) {
    const f = boot(t); mutate(f);
    assert.equal(f.plan(target).status, 'manual');
    assert.deepEqual(f.effects, []);
  }
});

test('date-range registration is inert on reinjection', t => {
  const f = boot(t), before = f.R.list().length;
  f.w.eval(sources.at(-1));
  assert.equal(f.R.list().length, before);
  assert.deepEqual(f.effects, []);
});

test('ordinary discovery emits one native range candidate with its complete group', t => {
  const f = boot(t);
  const result = f.w.eval(`(${readControlCandidatesInPage.toString()})`)(f.w.location.href, f.w.performance.timeOrigin);
  assert.equal(result.candidates.length, 1, JSON.stringify(result));
  const row = result.candidates[0];
  assert.equal(row.adapter, 'native-date-range');
  assert.equal(row.type, 'date-range');
  assert.equal(f.w.document.querySelector(row.rootSelector), f.el);
  assert.equal(f.R.resolve(f.w.document.querySelector(row.selector)).readModel(f.w.document.querySelector(row.selector)).controlRoot, f.el);
  assert.equal(result.writeStarted, false);
  assert.equal(result.liveSupportClaimed, false);
  assert.deepEqual(f.effects, []);
});

// First-party contract replay: these controls expose only versioned public
// values, component-owned calendar views and their rendered calendar cells.
function momentFor(w, value) {
  let date = new w.Date(`${value}T12:00:00`);
  const api = { _isAMomentObject: true,
    isValid: () => Number.isFinite(+date),
    clone: () => momentFor(w, api.format('YYYY-MM-DD')),
    year: () => date.getFullYear(), month: () => date.getMonth(),
    date(day) { if (day == null) return date.getDate(); date.setDate(day); return api; },
    add(number, unit) { if (/year/u.test(unit)) date.setFullYear(date.getFullYear() + number); else date.setMonth(date.getMonth() + number); return api; },
    format(format) {
      const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
      if (format === 'LL') return `${y}年${m}月${d}日`;
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    },
  };
  return api;
}

function componentRange(t, lib, { formatted = true, paired = false } = {}) {
  const ant = lib === 'ant', format = ant ? 'YYYY-MM-DD' : 'yyyy-MM-dd';
  const face = (id, range) => ant
    ? `<span id="${id}" class="ant-calendar-picker"><span class="${range ? 'ant-calendar-range-picker' : 'ant-calendar-picker-input'}">${[0, ...(range ? [1] : [])].map(() => `<input readonly class="ant-calendar-${range ? 'range-picker-' : 'picker-'}input">`).join('')}</span></span>`
    : range ? `<div id="${id}" class="el-date-editor el-range-editor el-date-editor--daterange"><input class="el-range-input"><input class="el-range-input"></div>`
      : `<div id="${id}" class="el-date-editor el-input el-date-editor--date"><input class="el-input__inner"></div>`;
  const html = paired ? `<fieldset id="target" data-date-range>${face('first', false)}${face('second', false)}</fieldset>` : face('target', true);
  const f = boot(t, html), roots = paired ? [f.get('first'), f.get('second')] : [f.el];
  const calls = { open: 0, choices: [], emits: 0, inputs: 0, navigation: 0 };
  const records = [], model = values => formatted ? values : values.map(value => ant ? momentFor(f.w, value) : new f.w.Date(`${value}T12:00:00`));
  roots.forEach((root, endpoint) => {
    const inputs = [...root.querySelectorAll('input')], props = { value: null, format,
      ...(formatted ? { valueFormat: format } : {}), ...(!ant ? { type: paired ? 'date' : 'daterange' } : {}) };
    const vm = f.component(root, ant ? paired ? 'ADatePicker' : 'ARangePicker' : 'ElDatePicker', props,
      { $emit() { calls.emits++; } });
    const panel = f.w.document.createElement('div');
    panel.className = ant ? 'ant-calendar-picker-container' : paired ? 'el-picker-panel el-date-picker' : 'el-picker-panel el-date-range-picker';
    panel.style.display = 'none';
    const calendarRoot = ant ? f.w.document.createElement('div') : panel;
    if (ant) { calendarRoot.className = `ant-calendar${paired ? '' : ' ant-calendar-range'}`; panel.append(calendarRoot); }
    const calendar = { $el: calendarRoot,
      ...(ant ? { sValue: paired ? momentFor(f.w, target[endpoint]) : [momentFor(f.w, target[0]), momentFor(f.w, target[1])] }
        : paired ? { date: new f.w.Date(`${target[endpoint]}T12:00:00`) }
          : { leftDate: new f.w.Date(`${target[0]}T12:00:00`), rightDate: new f.w.Date(`${target[1]}T12:00:00`) }) };
    if (ant) {
      const popupRef = { $refs: { popupInstance: { $el: panel } } };
      vm.popupRef = popupRef;
      vm.$refs = { picker: { $el: root, $refs: { calendarInstance: calendar }, popupRef } };
      vm.$children = [vm.$refs.picker];
      vm.$refs.picker.$parent = vm;
    } else vm.picker = calendar;
    const record = { root, inputs, props, vm, panel, calendar, panes: [], selected: [] };
    const setValue = values => {
      if (paired) { props.value = model(values)[0]; inputs[0].value = values[0]; }
      else { props.value = model(values); values.forEach((value, i) => { inputs[i].value = value; }); }
    };
    record.setValue = setValue;
    const views = paired ? [target[endpoint]] : target;
    views.forEach((value, side) => {
      const pane = paired ? calendarRoot : f.w.document.createElement('div');
      if (!paired) {
        pane.className = ant ? `ant-calendar-range-part ant-calendar-range-${side ? 'right' : 'left'}`
          : `el-picker-panel__content el-date-range-picker__content is-${side ? 'right' : 'left'}`;
        calendarRoot.append(pane);
      }
      const viewAt = () => ant ? paired ? calendar.sValue : calendar.sValue[side]
        : paired ? calendar.date : side ? calendar.rightDate : calendar.leftDate;
      const setView = date => {
        if (ant) { if (paired) calendar.sValue = date; else calendar.sValue[side] = date; }
        else if (paired) calendar.date = date;
        else calendar[side ? 'rightDate' : 'leftDate'] = date;
      };
      const header = f.w.document.createElement('div');
      header.className = ant ? 'ant-calendar-header' : paired ? 'el-date-picker__header' : 'el-date-range-picker__header';
      const renderHeader = () => {
        const view = viewAt(), year = ant ? view.year() : view.getFullYear(), month = (ant ? view.month() : view.getMonth()) + 1;
        for (const label of [...header.querySelectorAll('[data-view-label]')]) label.remove();
        if (ant) {
          for (const [kind, label] of [['year', `${year}年`], ['month', `${month}月`]]) {
            const span = f.w.document.createElement('span'); span.className = `ant-calendar-${kind}-select`;
            span.dataset.viewLabel = ''; span.textContent = label; header.append(span);
          }
        } else if (paired) {
          for (const label of [`${year} 年`, `${month} 月`]) {
            const span = f.w.document.createElement('span'); span.className = 'el-date-picker__header-label';
            span.dataset.viewLabel = ''; span.textContent = label; header.append(span);
          }
        } else { const div = f.w.document.createElement('div'); div.dataset.viewLabel = ''; div.textContent = `${year} 年 ${month} 月`; header.append(div); }
      };
      const table = f.w.document.createElement('table'); table.className = ant ? 'ant-calendar-table' : 'el-date-table';
      const tbody = f.w.document.createElement('tbody'); table.append(tbody);
      const renderCells = () => {
        tbody.replaceChildren();
        const view = viewAt(), y = ant ? view.year() : view.getFullYear(), month = ant ? view.month() : view.getMonth();
        const days = new f.w.Date(y, month + 1, 0).getDate();
        for (let day = 1; day <= days; day++) {
          const date = `${y}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const cell = f.w.document.createElement('td'); cell.className = ant ? 'ant-calendar-cell' : 'available';
          cell.dataset.fixtureDate = date;
          if (ant) cell.title = momentFor(f.w, date).format('LL');
          const label = f.w.document.createElement(ant ? 'div' : 'span');
          if (ant) label.className = 'ant-calendar-date';
          label.textContent = String(day); cell.append(label);
          cell.addEventListener('click', () => {
            calls.choices.push(date);
            if (paired) { setValue([date]); panel.style.display = 'none'; }
            else {
              record.selected.push(date);
              if (record.selected.length === 2) { setValue(record.selected.slice()); panel.style.display = 'none'; }
            }
          });
          const row = f.w.document.createElement('tr'); row.append(cell); tbody.append(row);
        }
      };
      for (const [direction, delta] of [['prev', -1], ['next', 1]]) {
        const button = f.w.document.createElement(ant ? 'a' : 'button');
        if (!ant) button.type = 'button';
        button.className = ant ? `ant-calendar-${direction}-month-btn` : `el-picker-panel__icon-btn el-icon-arrow-${delta < 0 ? 'left' : 'right'}`;
        button.addEventListener('click', () => {
          calls.navigation++;
          const view = viewAt();
          if (ant) setView(view.clone().add(delta, 'months'));
          else { const next = new f.w.Date(+view); next.setDate(1); next.setMonth(next.getMonth() + delta); setView(next); }
          renderHeader(); renderCells();
        }); header.append(button);
      }
      pane.append(header, table); renderHeader(); renderCells();
      record.panes.push({ pane, header, table, viewAt, setView, renderHeader, renderCells });
    });
    f.w.document.body.append(panel);
    for (const input of inputs) {
      input.addEventListener('click', () => { calls.open++; panel.style.display = ''; });
      input.addEventListener('input', () => calls.inputs++);
    }
    records.push(record);
  });
  return { ...f, calls, records, adapterName: paired ? 'date-range-pair' : ant ? 'antdv1-date-range' : 'el-date-range',
    input: records[0].inputs[0],
    cell: (index, value) => records[index].panel.querySelector(`[data-fixture-date="${value}"]`),
    setValue(values) { records.forEach((record, i) => record.setValue(paired ? [values[i]] : values)); } };
}

for (const lib of ['ant', 'el']) {
  for (const paired of [false, true]) {
    const label = `${lib} ${paired ? 'paired calendars' : 'RangePicker'}`;
    test(`${label} plans passively and selects both days through owned calendar panels`, async t => {
      const f = componentRange(t, lib, { paired }), adapter = f.R.resolve(f.input), instruction = f.R.plan(f.input, { value: target });
      assert.equal(adapter?.name, f.adapterName);
      assert.equal(instruction.status, 'planned', JSON.stringify(instruction));
      assert.equal(instruction.liveSupportClaimed, false); assert.equal(instruction.writeStarted, false);
      assert.equal(f.calls.open, 0); assert.deepEqual(f.calls.choices, []);
      assert.equal((await adapter.write(f.input, instruction)).reason, 'shadow_mode');
      const written = await adapter.write(f.input, instruction, ctx);
      assert.equal(written.strategy, 'ui', JSON.stringify(written));
      assert.deepEqual(f.calls.choices, target);
      const result = await adapter.verify(f.input, instruction, { settleMs: 0 });
      assert.equal(result.status, 'success', JSON.stringify(result));
      assert.deepEqual(plain(result.domReadback), target); assert.deepEqual(plain(result.modelReadback), target);
      assert.equal(f.records.every(record => record.panel.style.display === 'none'), true);
      assert.equal(f.calls.emits, 0); assert.equal(f.calls.inputs, 0);
      assert.deepEqual(f.forbidden, []); assert.equal(f.get('neighbor').value, 'KEEP');
    });

    test(`${label} supports default public Moment or Date models without emitting strings`, async t => {
      const f = componentRange(t, lib, { paired, formatted: false }), adapter = f.R.resolve(f.input), instruction = f.R.plan(f.input, { value: target });
      assert.equal(instruction.status, 'planned', JSON.stringify(instruction));
      assert.equal((await adapter.write(f.input, instruction, ctx)).strategy, 'ui');
      assert.equal((await adapter.verify(f.input, instruction, { settleMs: 0 })).status, 'success');
      const values = paired ? f.records.map(record => record.props.value) : f.records[0].props.value;
      assert.equal(values.every(value => lib === 'ant' ? value._isAMomentObject === true : value instanceof f.w.Date), true);
      assert.equal(f.calls.emits, 0);
    });

    test(`${label} requires both displayed endpoints and public values for readback`, async t => {
      const f = componentRange(t, lib, { paired }), adapter = f.R.resolve(f.input), instruction = f.R.plan(f.input, { value: target });
      f.setValue(target);
      assert.equal((await adapter.verify(f.input, instruction, { settleMs: 0 })).status, 'success');
      const inputs = f.records.flatMap(record => record.inputs);
      inputs[1].value = '2024-03-03';
      assert.equal((await adapter.verify(f.input, instruction, { settleMs: 0 })).status, 'mismatch');
      inputs[1].value = target[1];
      const record = f.records[paired ? 1 : 0];
      const previous = record.props.value;
      record.props.value = paired ? '2024-03-03' : [target[0], '2024-03-03'];
      assert.equal((await adapter.verify(f.input, instruction, { settleMs: 0 })).status, 'mismatch');
      record.props.value = previous;
      f.w.setTimeout(() => { inputs[1].value = ''; record.props.value = null; }, 5);
      assert.equal((await adapter.verify(f.input, instruction, { settleMs: 20 })).status, 'reverted');
    });

    test(`${label} rejects unsupported versions, precision and model shapes without opening`, t => {
      for (const mutate of [
        f => { f.w[lib === 'ant' ? 'antd' : 'ELEMENT'].version = '99.0.0'; },
        f => { f.records[0].props.format = 'DD/MM/YYYY'; },
        f => { f.records[0].props.valueFormat = 'yyyy-MM'; },
        f => { f.records[0].props.showTime = true; },
        f => { f.records[0].props.value = paired ? ['2024-02-29'] : ['2024-02-29']; },
        f => { f.records[0].props.disabled = true; },
        f => { f.records[0].props.readonly = true; },
      ]) {
        const f = componentRange(t, lib, { paired }); mutate(f);
        const instruction = f.R.plan(f.input, { value: target });
        assert.ok(['manual', 'unsupported'].includes(instruction.status), JSON.stringify(instruction));
        assert.equal(f.calls.open, 0); assert.deepEqual(f.calls.choices, []);
      }
    });

    test(`${label} preserves existing data and refuses stale owner or constraints before opening`, async t => {
      for (const mutate of [
        f => { f.setValue(['2024-02-28', target[1]]); },
        f => { f.records[0].props.disabled = true; },
        f => { f.records[0].props.readonly = true; },
        f => { f.records[0].root.__vue__ = { ...f.records[0].vm }; },
        f => { f.records[paired ? 1 : 0].props.disabledDate = () => true; },
      ]) {
        const f = componentRange(t, lib, { paired }), adapter = f.R.resolve(f.input), instruction = f.R.plan(f.input, { value: target });
        mutate(f);
        const result = await adapter.write(f.input, instruction, ctx);
        assert.equal(result.status, 'unsupported', JSON.stringify(result)); assert.equal(result.attempts, 0);
        assert.equal(f.calls.open, 0); assert.deepEqual(f.calls.choices, []);
      }
    });

    test(`${label} does not select disabled or ambiguous days or use an unrelated overlay`, async t => {
      for (const mode of ['disabled', 'duplicate', 'foreign-panel', 'wrong-owner']) {
        const f = componentRange(t, lib, { paired }), adapter = f.R.resolve(f.input), instruction = f.R.plan(f.input, { value: target });
        const cell = f.cell(0, target[0]);
        if (mode === 'disabled') cell.classList.add(lib === 'ant' ? 'ant-calendar-disabled-cell' : 'disabled');
        if (mode === 'duplicate') cell.parentElement.append(cell.cloneNode(true));
        if (mode === 'foreign-panel') {
          const extra = f.records[0].panel.cloneNode(true); extra.style.display = ''; f.w.document.body.append(extra);
        }
        if (mode === 'wrong-owner') {
          const record = f.records[0];
          if (lib === 'ant') record.vm.popupRef.$refs.popupInstance.$el = record.panel.cloneNode(true);
          else record.vm.picker = { ...record.calendar, $el: record.panel.cloneNode(true) };
        }
        if (mode === 'wrong-owner') await assert.rejects(adapter.write(f.input, instruction, ctx), /ownership|overlay/u);
        else {
          const result = await adapter.write(f.input, instruction, ctx);
          assert.equal(result.status, 'unsupported', `${mode}: ${JSON.stringify(result)}`);
        }
        assert.deepEqual(f.calls.choices, [], mode);
        assert.deepEqual(f.forbidden, []);
      }
    });

    test(`${label} rechecks state and cell identity between pointerdown and day click`, async t => {
      for (const mode of ['disabled', 'duplicate', 'moved']) {
        const f = componentRange(t, lib, { paired }), adapter = f.R.resolve(f.input), instruction = f.R.plan(f.input, { value: target });
        f.cell(0, target[0]).addEventListener('pointerdown', event => {
          if (mode === 'disabled') f.records[0].props.disabled = true;
          if (mode === 'duplicate') event.currentTarget.parentElement.append(event.currentTarget.cloneNode(true));
          if (mode === 'moved') f.w.document.body.append(event.currentTarget);
        });
        await assert.rejects(adapter.write(f.input, instruction, ctx), /changed|disabled|ambiguous|ownership/u, mode);
        assert.deepEqual(f.calls.choices, [], mode);
        assert.equal(f.calls.emits, 0); assert.equal(f.calls.inputs, 0); assert.deepEqual(f.forbidden, []);
      }
    });

    test(`${label} plans cannot move between components or regain write authority after serialization`, async t => {
      for (const mode of ['json', 'value', 'type']) {
        const f = componentRange(t, lib, { paired }), adapter = f.R.resolve(f.input);
        let instruction = f.R.plan(f.input, { value: target });
        if (mode === 'json') instruction = plain(instruction);
        if (mode === 'value') { instruction.value = ['2024-03-01', target[1]]; instruction.modelValue = [...instruction.value]; instruction.domValue = [...instruction.value]; }
        if (mode === 'type') instruction.type = 'text';
        const result = await adapter.write(f.input, instruction, ctx);
        assert.equal(result.status, 'unsupported', `${mode}: ${JSON.stringify(result)}`); assert.equal(result.attempts, 0);
        assert.equal(f.calls.open, 0); assert.deepEqual(f.calls.choices, []);
      }
    });

    test(`${label} normal discovery emits one candidate for both endpoints`, t => {
      const f = componentRange(t, lib, { paired });
      const result = f.w.eval(`(${readControlCandidatesInPage.toString()})`)(f.w.location.href, f.w.performance.timeOrigin);
      assert.equal(result.candidates.length, 1, JSON.stringify(result));
      const row = result.candidates[0];
      assert.equal(row.adapter, f.adapterName); assert.equal(row.type, 'date-range');
      assert.equal(f.w.document.querySelector(row.rootSelector), f.el);
      assert.equal(f.calls.open, 0); assert.deepEqual(f.calls.choices, []);
    });

    test(`${label} cannot click a navigation button moved outside its pane during pointerdown`, async t => {
      const f = componentRange(t, lib, { paired });
      for (const [recordIndex, record] of f.records.entries()) {
        for (const [side, pane] of record.panes.entries()) {
          const value = `2024-${String((paired ? recordIndex : side) + 1).padStart(2, '0')}-01`;
          pane.setView(lib === 'ant' ? momentFor(f.w, value) : new f.w.Date(`${value}T12:00:00`));
          pane.renderHeader(); pane.renderCells();
          for (const button of pane.header.querySelectorAll(lib === 'ant' ? 'a' : 'button')) {
            button.addEventListener('pointerdown', event => f.w.document.body.append(event.currentTarget));
          }
        }
      }
      const adapter = f.R.resolve(f.input), instruction = f.R.plan(f.input, { value: target });
      await assert.rejects(adapter.write(f.input, instruction, ctx), /changed|navigation|ownership/u);
      assert.equal(f.calls.navigation, 0);
      assert.equal(f.calls.choices.includes(target[1]), false);
      assert.deepEqual(f.forbidden, []);
    });

    if (!paired) test(`${label} navigates to target months between separated left and right views`, async t => {
      const f = componentRange(t, lib), record = f.records[0];
      for (const [side, pane] of record.panes.entries()) {
        const value = side ? '2024-04-01' : '2024-01-01';
        pane.setView(lib === 'ant' ? momentFor(f.w, value) : new f.w.Date(`${value}T12:00:00`));
        pane.renderHeader(); pane.renderCells();
      }
      const adapter = f.R.resolve(f.input), instruction = f.R.plan(f.input, { value: target });
      const written = await adapter.write(f.input, instruction, ctx);
      assert.equal(written.strategy, 'ui', JSON.stringify(written));
      assert.deepEqual(f.calls.choices, target);
      assert.equal((await adapter.verify(f.input, instruction, { settleMs: 0 })).status, 'success');
    });
  }
}
