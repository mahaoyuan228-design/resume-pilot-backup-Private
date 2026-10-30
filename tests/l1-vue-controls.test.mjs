import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const files = ['model.js', 'registry.js', 'vue-controls.js'].map(name =>
  fs.readFileSync(new URL(`../src/content/controls/${name}`, import.meta.url), 'utf8'));
function boot(html = '<div id="control"><input></div>') {
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true,
    url: 'https://wecruit.hotjob.cn/SUoffline/pb/resumeOperation.html' });
  const w = dom.window;
  w.Element.prototype.getClientRects = () => [{ width: 8, height: 8 }];
  Object.defineProperty(w.document, 'visibilityState', { configurable: true, get: () => 'visible' });
  w.ELEMENT = { version: '2.15.14' }; w.antd = { version: '1.7.8' };
  for (const file of files) w.eval(file);
  const component = (el, name, props, extra = {}) => {
    const instance = { $el: el, $options: { name }, $props: props, ...extra };
    el.__vue__ = instance; return instance;
  };
  return { dom, w, R: w.ResumeControls, el: w.document.querySelector('#control'), component };
}
const json = value => JSON.parse(JSON.stringify(value));

test('Vue month claims are versioned and more specific than plain inputs', () => {
  const { w, el, component, R } = boot();
  component(el, 'ElDatePicker', { value: '', type: 'month', valueFormat: 'yyyy-MM' });
  assert.equal(R.resolve(el).name, 'el-month');
  const planned = json(R.plan(el, { value: '2023-01' }));
  assert.equal(planned.status, 'planned');
  assert.equal(planned.value, '2023-01');
  w.ELEMENT.version = '3.0.0';
  assert.equal(R.plan(el, { value: '2023-01' }).status, 'manual');
  delete w.ELEMENT;
  assert.equal(R.plan(el, { value: '2023-01' }).status, 'manual');
});

test('date plans require proven precision and format, preserving existing values', () => {
  const { el, component, R } = boot();
  const props = { value: '', valueFormat: 'YYYY-MM' };
  component(el, 'AMonthPicker', props);
  assert.equal(R.plan(el, { value: '2023-02-01' }).reason, 'date_precision_mismatch');
  assert.equal(R.plan(el, { value: '2023-13' }).reason, 'invalid_date');
  props.valueFormat = 'MM/YYYY';
  assert.equal(R.plan(el, { value: '2023-02' }).reason, 'value_format_unverified');
  props.valueFormat = 'YYYY-MM'; props.value = '2021-04';
  assert.equal(R.plan(el, { value: '2023-02' }).reason, 'existing_value');
  props.value = ''; props.disabled = true;
  assert.equal(R.plan(el, { value: '2023-02' }).status, 'manual');
});

test('readonly date face is a normal UI contract; text readonly is manual', () => {
  const { el, component, R } = boot('<div id="control"><input readonly></div>');
  const props = { value: '', valueFormat: 'YYYY-MM' };
  component(el, 'AMonthPicker', props);
  assert.equal(R.plan(el, { value: '2023-01' }).status, 'planned');
  component(el, 'AInput', { value: '', readonly: true });
  assert.equal(R.plan(el, { value: 'text' }).status, 'manual');
});

test('Ant month defaults require a Moment model and verify the actual display format', t => {
  const { dom, el, component, R } = boot(); t.after(() => dom.window.close());
  const props = { value: null };
  component(el, 'AMonthPicker', props);
  assert.equal(R.plan(el, { value: '2024-02' }).status, 'planned');
  el.querySelector('input').value = '2022-04';
  assert.equal(R.plan(el, { value: '2024-02' }).reason, 'existing_value', 'pending display text is preserved');
  el.querySelector('input').value = '';
  for (const format of ['YYYY/MM', 'YYYY-MM-DD', ['YYYY-MM'], () => 'YYYY-MM']) {
    props.format = format;
    assert.deepEqual(json(R.plan(el, { value: '2024-02' })), {
      adapter: 'antdv1-month', lib: 'ant-design-vue', type: 'month',
      status: 'manual', reason: 'display_format_unverified'
    });
  }
  delete props.format;
  for (const value of ['2024-02', new Date('2024-02-01'), ['2024-02'],
    { _isAMomentObject: true, format: () => '2024-02', isValid: () => false }]) {
    props.value = value;
    assert.equal(R.resolve(el), null, 'unconfirmed default model cannot claim the picker');
  }
  props.valueFormat = 'YYYY-MM';
  for (const value of [new Date('2024-02-01'), ['2024-02'],
    { _isAMomentObject: true, format: () => '2024-02', isValid: () => true }]) {
    props.value = value;
    assert.equal(R.resolve(el), null, 'formatted model cannot silently accept Moment/Date/array values');
  }
  props.value = '';
  assert.equal(R.plan(el, { value: '2024-02' }).status, 'planned');
  props.valueFormat = 'yyyy-MM';
  assert.equal(R.plan(el, { value: '2024-02' }).status, 'manual');
});

test('Ant month calendar rechecks its owner and disabled state before each UI effect', async t => {
  const { dom, w, el, component, R } = boot(); t.after(() => dom.window.close());
  const props = { value: null };
  component(el, 'AMonthPicker', props);
  let navigations = 0, selections = 0, pointerdowns = 0;
  el.querySelector('input').addEventListener('click', () => {
    const panel = w.document.createElement('div');
    panel.className = 'ant-calendar-picker-container';
    panel.innerHTML = '<span class="ant-calendar-month-panel-year-select-content">2023</span><a class="ant-calendar-month-panel-next-year-btn">›</a><table><tbody><tr>'
      + Array.from({ length: 12 }, () => '<td class="ant-calendar-month-panel-cell"><a>Month</a></td>').join('')
      + '</tr></tbody></table>';
    panel.querySelector('.ant-calendar-month-panel-next-year-btn').addEventListener('pointerdown', () => {
      pointerdowns++; props.disabled = true;
    });
    panel.querySelector('.ant-calendar-month-panel-next-year-btn').addEventListener('click', () => { navigations++; });
    panel.querySelectorAll('td').forEach(cell => cell.addEventListener('click', () => { selections++; }));
    w.document.body.append(panel);
  });
  const instruction = R.plan(el, { value: '2024-02' });
  await assert.rejects(R.resolve(el).write(el, instruction, { allowWrite: true, check: async () => {} }), /control_changed/u);
  assert.equal(pointerdowns, 1);
  assert.equal(navigations, 0);
  assert.equal(selections, 0);
  assert.equal(el.querySelector('input').value, '');
});

test('remote school options are deferred, never invented as observed options', () => {
  const { el, component, R } = boot('<div id="control" class="ant-select"><div class="ant-select-selection"><input></div></div>');
  component(el, 'ASelect', { value: undefined, showSearch: true, filterOption: false }, { $slots: { default: [] } });
  const plan = R.plan(el, { value: '离线示例大学' });
  assert.equal(plan.adapter, 'antdv1-select-search');
  assert.equal(plan.status, 'planned');
  assert.equal(plan.requiresOptionResolution, true);
  assert.deepEqual(json(R.resolve(el).readOptions(el)), []);
});

test('dependent pair uses both component probes and allows initially disabled city', () => {
  const { w, el, component, R } = boot('<span id="control" class="cascader-plugins-wrap"><div class="ant-select"><input></div><div class="ant-select"><input disabled></div></span>');
  const [a, b] = el.querySelectorAll('.ant-select');
  const first = { value: '', options: [{ value: 'beijing', label: '北京市' }] };
  const second = { value: '', options: [], disabled: true };
  component(a, 'ASelect', first); component(b, 'ASelect', second);
  const plan = R.plan(el, { value: ['北京市', '北京市'] });
  assert.equal(plan.adapter, 'hotjob-pair-cascader');
  assert.equal(plan.status, 'planned');
  assert.equal(plan.requiresOptionResolution, true);
  assert.deepEqual(json(plan.labels), ['北京市', '北京市']);
  assert.equal(plan.value[0], 'beijing');
  // The child option's ID remains unknown until the dependency has loaded.
  assert.equal(plan.value[1], '北京市');
  w.antd.version = '4.0.0';
  assert.equal(R.plan(el, { value: ['北京市', '北京市'] }).status, 'manual');
});

test('month range preserves an existing different endpoint and rejects reversed dates', () => {
  const { el, component, R } = boot('<div id="control" class="el-form-item"><div class="el-date-editor--month"><input></div><div class="el-date-editor--month"><input></div></div>');
  const [a, b] = el.querySelectorAll('.el-date-editor--month');
  const start = { value: '', type: 'month', valueFormat: 'yyyy-MM' };
  const end = { value: '', type: 'month', valueFormat: 'yyyy-MM' };
  component(a, 'ElDatePicker', start); component(b, 'ElDatePicker', end);
  assert.equal(R.plan(el, { value: ['2023-01', '2024-06'] }).adapter, 'el-month-range');
  assert.equal(R.plan(el, { value: ['2024-06', '2023-01'] }).reason, 'invalid_month_range');
  start.value = '2021-01';
  assert.equal(R.plan(el, { value: ['2023-01', '2024-06'] }).reason, 'existing_value');
});

test('component writes are shadow by default and a rejected effect guard cannot emit', async () => {
  const { el, component, R } = boot();
  let emits = 0;
  component(el, 'ADatePicker', { value: '', valueFormat: 'YYYY-MM-DD' }, { $emit() { emits++; } });
  const adapter = R.resolve(el), plan = R.plan(el, { value: '2023-01-02' });
  assert.equal((await adapter.write(el, plan)).reason, 'shadow_mode');
  await assert.rejects(adapter.write(el, plan, { allowWrite: true, check: async () => { throw new Error('binding_changed'); } }), /binding_changed/u);
  assert.equal(emits, 0);
});

test('component verification requires both DOM and model and detects later reversion', async () => {
  const { el, component, R } = boot();
  const props = { value: '' };
  component(el, 'AInput', props);
  const plan = R.plan(el, { value: 'expected' });
  el.querySelector('input').value = 'expected';
  assert.equal((await R.verify(el, plan, { settleMs: 0 })).status, 'mismatch');
  props.value = 'expected';
  assert.equal((await R.verify(el, plan, { settleMs: 0 })).status, 'success');
  props.value = 'old';
  assert.equal((await R.verify(el, plan, { previousSuccess: true, settleMs: 0 })).status, 'reverted');
});

test('checkbox plans preserve previous checks and duplicate injection is inert', () => {
  const { w, el, component, R } = boot('<div id="control"><label><input type="checkbox" value="a" checked>A</label><label><input type="checkbox" value="b">B</label></div>');
  component(el, 'ACheckboxGroup', { value: ['a'] });
  const plan = R.plan(el, { value: ['B'] });
  assert.deepEqual(json(plan.value), ['a', 'b']);
  const before = R.list().length;
  w.eval(files[2]);
  assert.equal(R.list().length, before);
});

test('dependent pair waits for its first closing portal before opening the next select', async () => {
  const { w, el, component, R } = boot('<span id="control" class="cascader-plugins-wrap"><div class="ant-select"><div class="ant-select-selection"><input></div></div><div class="ant-select"><div class="ant-select-selection"><input disabled></div></div></span>');
  const children = [...el.querySelectorAll('.ant-select')];
  const props = [{ value: '', options: [{ value: '北京市', label: '北京市' }] },
    { value: '', options: [], disabled: true }];
  const journal = [];
  children.forEach((child, index) => {
    component(child, 'ASelect', props[index]);
    const menu = w.document.createElement('div');
    menu.className = 'ant-select-dropdown'; menu.style.display = 'none';
    menu.innerHTML = '<li class="ant-select-dropdown-menu-item">北京市</li>';
    w.document.body.append(menu);
    child.querySelector('.ant-select-selection').addEventListener('click', () => {
      journal.push(`open:${index}`); menu.style.display = 'block';
    });
    menu.querySelector('li').addEventListener('click', () => {
      journal.push(`select:${index}`); props[index].value = '北京市';
      const selected = w.document.createElement('span');
      selected.className = 'ant-select-selection-selected-value'; selected.textContent = '北京市'; child.append(selected);
      if (index === 0) {
        props[1].disabled = false;
        props[1].options = [{ value: '北京市', label: '北京市' }];
        children[1].querySelector('input').disabled = false;
      }
      w.setTimeout(() => { menu.style.display = 'none'; journal.push(`closed:${index}`); }, 40);
    });
  });
  const plan = R.plan(el, { value: ['北京市', '北京市'] });
  const result = await R.resolve(el).write(el, plan, { allowWrite: true, check: async () => {} });
  assert.equal(result.strategy, 'ui');
  assert.deepEqual(journal, ['open:0', 'select:0', 'closed:0', 'open:1', 'select:1', 'closed:1']);
  assert.equal((await R.verify(el, plan, { settleMs: 0 })).status, 'success');
});
