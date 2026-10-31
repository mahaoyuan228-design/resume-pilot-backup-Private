import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const sources = ['model', 'registry', 'native', 'vue-controls', 'slider-controls'].map(name =>
  readFileSync(new URL(`../../src/content/controls/${name}.js`, import.meta.url), 'utf8'));
export const ctx = { allowWrite: true, check: async () => {} };
export const adapters = { native: 'native-slider', el: 'el-slider', antdv1: 'antdv1-slider' };
export const writable = result => ['planned', 'success'].includes(result.status);

// This DOM fixture models component event handlers; tests using the pinned real
// distributions below independently establish the supported UI contracts.
export function boot(t, family = 'native', { initial = 20, sync = true, props: extraProps = {} } = {}) {
  const markup = family === 'native' ? `<input id="target" type="range" value="${initial}">`
    : family === 'el' ? `<div id="target" class="el-slider" role="slider" aria-valuemin="0" aria-valuemax="100" tabindex="0">
      <div class="el-slider__runway"><div class="el-slider__bar"></div><div class="el-slider__button-wrapper" style="left:${initial}%" tabindex="0"><div class="el-slider__button"></div></div></div></div>`
      : `<div id="target" class="ant-slider"><div class="ant-slider-rail"></div><div class="ant-slider-track"></div>
      <div class="ant-slider-step"></div><div class="ant-slider-handle" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${initial}"></div></div>`;
  const dom = new JSDOM(`<form>${markup}<input id="neighbor" value="KEEP">`
    + '<button id="save" type="button">Save</button><button type="submit">Submit</button></form>',
  { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://offline.invalid/slider' });
  t.after(() => dom.window.close());
  const w = dom.window, el = w.document.getElementById('target');
  const runway = family === 'el' ? el.querySelector('.el-slider__runway') : el;
  const handle = family === 'el' ? el.querySelector('.el-slider__button-wrapper')
    : family === 'antdv1' ? el.querySelector('.ant-slider-handle') : el;
  const aria = family === 'antdv1' ? handle : el;
  const props = { value: initial, min: 0, max: 100, step: 1, ...extraProps };
  const owner = { $el: el, $options: { name: family === 'el' ? 'ElSlider' : 'ASlider' }, $props: props };
  if (family !== 'native') el.__vue__ = owner;
  w.ELEMENT = { version: '2.15.14' }; w.antd = { version: '1.7.8' };
  w.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  const geometry = { left: 100, top: 50, width: 200, height: 20 };
  const rect = () => ({ ...geometry, x: geometry.left, y: geometry.top,
    right: geometry.left + geometry.width, bottom: geometry.top + geometry.height });
  el.getBoundingClientRect = rect; runway.getBoundingClientRect = rect;
  if (handle !== el) handle.getBoundingClientRect = () => {
    const x = geometry.left + (props.value - props.min) / (props.max - props.min) * geometry.width;
    return { x: x - 6, y: geometry.top, left: x - 6, right: x + 6, top: geometry.top,
      bottom: geometry.top + geometry.height, width: 12, height: geometry.height };
  };
  Object.defineProperty(runway, 'clientWidth', { get: () => geometry.width });
  Object.defineProperty(runway, 'clientHeight', { get: () => geometry.height });
  w.document.elementFromPoint = () => runway;
  const events = [], effects = { updates: 0, save: 0, submit: 0 };
  for (const type of ['pointerdown', 'mousedown', 'pointermove', 'mousemove', 'pointerup', 'mouseup', 'click', 'input', 'change', 'blur']) {
    w.document.addEventListener(type, event => {
      events.push({ type, target: event.target, x: event.clientX, y: event.clientY });
    }, true);
  }
  const paint = (value, { model = true, dom = true } = {}) => {
    if (family === 'native') { if (dom) el.value = String(value); return; }
    if (model) props.value = value;
    if (dom) {
      if (family === 'el') handle.style[props.vertical ? 'bottom' : 'left'] = `${(value - props.min) / (props.max - props.min) * 100}%`;
      else aria.setAttribute('aria-valuenow', String(value));
    }
  };
  const update = event => {
    if (!sync || family === 'native') return;
    const ratio = props.vertical ? (geometry.top + geometry.height - event.clientY) / geometry.height
      : (event.clientX - geometry.left) / geometry.width;
    const raw = props.min + Math.max(0, Math.min(1, props.reverse ? 1 - ratio : ratio)) * (props.max - props.min);
    const value = Number((props.min + Math.round((raw - props.min) / props.step) * props.step).toFixed(10));
    effects.updates++; paint(value);
  };
  let dragging = false;
  runway.addEventListener('mousedown', event => {
    if (family === 'el' && !handle.contains(event.target)) return;
    dragging = true;
    if (family === 'antdv1') update(event);
  });
  w.document.addEventListener('mousemove', event => { if (dragging) update(event); });
  w.document.addEventListener('mouseup', () => { dragging = false; });
  if (family === 'el') runway.addEventListener('click', event => { if (!handle.contains(event.target)) update(event); });
  w.document.getElementById('save').addEventListener('click', () => effects.save++);
  w.document.querySelector('form').addEventListener('submit', event => { event.preventDefault(); effects.submit++; });
  for (const source of sources) w.eval(source);
  const R = w.ResumeControls;
  return { w, R, el, runway, handle, aria, props, owner, geometry, events, effects, paint,
    neighbor: w.document.getElementById('neighbor'), adapter: () => R.resolve(el), plan: fact => R.plan(el, fact) };
}
