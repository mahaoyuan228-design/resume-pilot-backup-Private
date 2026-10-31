import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const sources = ['model', 'registry', 'native', 'vue-controls', 'rate-controls'].map(name =>
  readFileSync(new URL(`../../src/content/controls/${name}.js`, import.meta.url), 'utf8'));
export const ctx = { allowWrite: true, check: async () => {} };
export const adapters = { el: 'el-rate', plus: 'elplus-rate', antdv1: 'antdv1-rate', aria: 'aria-rate' };
export const writable = result => ['planned', 'success'].includes(result.status);

// Synthetic event handlers make guard races deterministic. Independent tests
// mount the pinned library distributions to establish each real UI contract.
export function boot(t, family = 'el', { initial = 2, sync = true, props: extraProps = {} } = {}) {
  const max = extraProps.max ?? extraProps.count ?? 5;
  const ant = family === 'antdv1', aria = family === 'aria', plus = family === 'plus';
  const stars = Array.from({ length: max }, (_, i) => ant
    ? `<li class="ant-rate-star ant-rate-star-zero"><div role="radio" aria-checked="false" aria-posinset="${i + 1}" aria-setsize="${max}" tabindex="0"><div class="ant-rate-star-first">★</div><div class="ant-rate-star-second">★</div></div></li>`
    : `<span class="el-rate__item"><i class="el-rate__icon el-icon-star-off"></i></span>`).join('');
  const markup = ant ? `<ul id="target" class="ant-rate" role="radiogroup" tabindex="0">${stars}</ul>`
    : `<div id="target" ${aria ? 'aria-roledescription="rating"' : 'class="el-rate"'} role="slider" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${initial}" aria-valuetext="${initial} of ${max} stars" tabindex="0">${aria ? '' : stars}</div>`;
  const dom = new JSDOM(`<form>${markup}<input id="neighbor" value="KEEP">`
    + '<button id="save" type="button">Save</button><button type="submit">Submit</button></form>',
  { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://offline.invalid/rate' });
  t.after(() => dom.window.close());
  const w = dom.window, el = w.document.getElementById('target');
  w.Element.prototype.getClientRects = () => [{ width: 20, height: 20 }];
  w.ELEMENT = { version: '2.15.14' }; w.ElementPlus = { version: '2.14.7' }; w.antd = { version: '1.7.8' };
  const key = plus ? 'modelValue' : 'value';
  const props = { [key]: initial, [ant ? 'count' : 'max']: max, allowHalf: false,
    ...(ant ? { allowClear: true, prefixCls: 'ant-rate' } : plus ? { clearable: false } : {}), ...extraProps };
  const owner = plus ? { props, type: { name: 'ElRate' }, subTree: { el }, isUnmounted: false }
    : { $el: el, $options: { name: ant ? 'ARate' : 'ElRate' }, $props: props,
      currentValue: initial, hoverIndex: -1, pointerAtLeftHalf: false };
  const inner = ant ? { $el: el, $options: { name: 'Rate' }, $props: props, $parent: owner,
    sValue: initial, hoverValue: undefined, cleanedValue: null } : null;
  if (ant) { owner.$children = [inner]; owner.$refs = { refRate: inner }; el.__vue__ = inner; }
  else if (plus) el.__vueParentComponent = owner;
  else if (!aria) el.__vue__ = owner;
  const items = [...el.querySelectorAll(ant ? '.ant-rate-star' : '.el-rate__item')];
  const targets = ant ? items.map(item => item.querySelector('[role="radio"]'))
    : items.map(item => item.querySelector('.el-rate__icon'));
  const geometry = { left: 100, top: 40, width: max * 20, height: 20 };
  const rect = (left, width = geometry.width / max) => ({ x: left, y: geometry.top, left, right: left + width,
    top: geometry.top, bottom: geometry.top + geometry.height, width, height: geometry.height });
  el.getBoundingClientRect = () => rect(geometry.left, geometry.width);
  for (const [index, item] of items.entries()) {
    for (const node of [item, ...item.querySelectorAll('*')]) {
      node.getBoundingClientRect = () => rect(geometry.left + index * 20);
      Object.defineProperty(node, 'clientWidth', { configurable: true, get: () => geometry.width / max });
    }
  }
  Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => geometry.width });
  w.document.elementFromPoint = (x) => targets[Math.floor((x - geometry.left) / 20)] || el;
  const events = [], effects = { updates: 0, save: 0, submit: 0 };
  for (const type of ['pointermove', 'mousemove', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'mouseleave', 'keydown', 'keyup', 'input', 'change']) {
    w.document.addEventListener(type, event => events.push({ type, target: event.target, key: event.key,
      code: event.code, keyCode: event.keyCode, x: event.clientX, y: event.clientY }), true);
  }
  const value = () => aria ? Number(el.getAttribute('aria-valuenow')) : props[key];
  const paint = (next, { model = true, dom = true } = {}) => {
    if (model) {
      if (aria) el.setAttribute('aria-valuenow', String(next));
      else { props[key] = next; owner.currentValue = next; if (inner) inner.sValue = next; }
    }
    if (!dom) return;
    if (!ant) {
      if (!aria) el.setAttribute('aria-valuenow', String(next));
      el.setAttribute('aria-valuetext', `${next} of ${max} stars`);
    }
    for (const [index, item] of items.entries()) {
      const full = index + 1 <= next, half = index + .5 === next;
      if (ant) {
        item.className = `ant-rate-star ant-rate-star-${half ? 'half ant-rate-star-active' : full ? 'full' : 'zero'}`;
        item.querySelector('[role="radio"]').setAttribute('aria-checked', String(next > index));
      } else {
        const icon = item.querySelector('.el-rate__icon');
        icon.className = `el-rate__icon ${plus ? full ? 'is-active' : '' : full ? 'el-icon-star-on' : 'el-icon-star-off'}`;
        icon.querySelector('.el-rate__decimal')?.remove();
        if (half) icon.insertAdjacentHTML('beforeend', '<i class="el-rate__decimal el-icon-star-on" style="width:50%"></i>');
      }
    }
  };
  paint(initial);
  const update = next => { effects.updates++; if (sync) paint(next); };
  el.addEventListener('keydown', event => {
    const current = value(), step = props.allowHalf ? .5 : 1;
    if (['ArrowLeft', 'ArrowDown'].includes(event.key) || [37, 40].includes(event.keyCode)) update(Math.max(0, current - step));
    else if (['ArrowRight', 'ArrowUp'].includes(event.key) || [38, 39].includes(event.keyCode)) update(Math.min(max, current + step));
    else if (event.key === 'Home') update(0);
    else if (event.key === 'End') update(max);
  });
  let hovered = initial;
  for (const [index, item] of items.entries()) {
    const clickTarget = ant ? targets[index] : item;
    item.addEventListener('mousemove', event => {
      const half = props.allowHalf && (ant ? event.pageX - (geometry.left + index * 20) < 10 : event.offsetX <= 10);
      hovered = index + (half ? .5 : 1);
      if (sync) { if (inner) inner.hoverValue = hovered; paint(hovered, { model: false }); }
    });
    clickTarget.addEventListener('click', event => {
      const half = props.allowHalf && (ant ? event.pageX - (geometry.left + index * 20) < 10 : hovered % 1 !== 0);
      let next = index + (half ? .5 : 1);
      if ((ant && props.allowClear || plus && props.clearable) && value() === next) next = 0;
      if (inner) inner.hoverValue = undefined;
      update(next);
    });
    item.addEventListener('mouseleave', () => { if (sync) paint(value(), { model: false }); if (inner) inner.hoverValue = undefined; });
  }
  if (aria) el.addEventListener('click', event => update(Math.min(max, Math.max(1,
    Math.ceil((event.clientX - geometry.left) / geometry.width * max)))));
  w.document.getElementById('save').addEventListener('click', () => effects.save++);
  w.document.querySelector('form').addEventListener('submit', event => { event.preventDefault(); effects.submit++; });
  for (const source of sources) w.eval(source);
  const R = w.ResumeControls;
  return { w, R, el, props, owner, inner, key, items, targets, geometry, events, effects, paint, value,
    neighbor: w.document.getElementById('neighbor'), adapter: () => R.resolve(el), plan: fact => R.plan(el, fact) };
}
