/* Disposable real pinned components. All assets are fulfilled locally. */
(async () => {
  const effects = { blacklistClicks: 0, submits: 0, inputEvents: 0, changeEvents: 0,
    clicks: { native: 0, element: 0, ant: 0 }, downs: { native: 0, element: 0, ant: 0 } };
  const native = document.getElementById('slider-native');
  const nativeModel = { value: Number(native.value) };
  native.addEventListener('input', () => { nativeModel.value = Number(native.value); });
  const owner = new Vue({
    el: '#app',
    data: () => ({ element: 10, ant: 10, disabledElement: 10, disabledAnt: 10,
      readonlyElement: 10, readonlyAnt: 10, rangeElement: [10, 30], rangeAnt: [10, 30] }),
    template: `<section>
      <div class="slider-row"><label>Element UI slider</label><el-slider id="slider-element" v-model="element" :min="0" :max="100" :step="5" :show-tooltip="false" /></div>
      <div class="slider-row"><label>Ant Design Vue slider</label><a-slider id="slider-ant" v-model="ant" :min="0" :max="100" :step="5" :tooltip-visible="false" /></div>
      <div class="slider-row"><label>Disabled Element slider</label><el-slider id="slider-element-disabled" v-model="disabledElement" :step="5" disabled :show-tooltip="false" /></div>
      <div class="slider-row"><label>Disabled Ant slider</label><a-slider id="slider-ant-disabled" v-model="disabledAnt" :step="5" disabled :tooltip-visible="false" /></div>
      <div class="slider-row"><label>Readonly Element slider</label><el-slider id="slider-element-readonly" v-model="readonlyElement" :step="5" aria-readonly="true" :show-tooltip="false" /></div>
      <div class="slider-row"><label>Readonly Ant slider</label><a-slider id="slider-ant-readonly" v-model="readonlyAnt" :step="5" aria-readonly="true" :tooltip-visible="false" /></div>
      <div class="slider-row"><label>Element range mode</label><el-slider id="slider-element-range" v-model="rangeElement" :step="5" range :show-tooltip="false" /></div>
      <div class="slider-row"><label>Ant range mode</label><a-slider id="slider-ant-range" v-model="rangeAnt" :step="5" range :tooltip-visible="false" /></div>
    </section>`,
  });
  await Vue.nextTick();
  for (const [id, key] of [['slider-native', 'native'], ['slider-element', 'element'], ['slider-ant', 'ant']]) {
    const root = document.getElementById(id);
    root.addEventListener('click', () => effects.clicks[key]++, true);
    root.addEventListener('mousedown', () => effects.downs[key]++, true);
  }
  document.addEventListener('click', event => {
    const action = event.target.closest('button,a,[role="button"],input[type="submit"]');
    if (action && /^(保存|提交|下一步|投递|删除)$/u.test((action.textContent || action.value || '').trim())) {
      effects.blacklistClicks++; event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
  document.addEventListener('input', () => effects.inputEvents++, true);
  document.addEventListener('change', () => effects.changeEvents++, true);
  document.addEventListener('submit', event => { effects.submits++; event.preventDefault(); }, true);
  const root = family => document.getElementById(`slider-${family}`);
  const displayed = family => {
    const target = root(family);
    if (family === 'native') return Number(target.value);
    if (family === 'element') {
      const percent = Number.parseFloat(target.querySelector('.el-slider__button-wrapper').style.left);
      const min = Number(target.getAttribute('aria-valuemin')), max = Number(target.getAttribute('aria-valuemax'));
      return min + (max - min) * percent / 100;
    }
    const slider = target.matches('[role="slider"]') ? target : target.querySelector('[role="slider"]');
    return slider ? Number(slider.getAttribute('aria-valuenow')) : null;
  };
  const readModel = () => ({ native: nativeModel.value, element: owner.element, ant: owner.ant,
    disabledElement: owner.disabledElement, disabledAnt: owner.disabledAnt,
    readonlyElement: owner.readonlyElement, readonlyAnt: owner.readonlyAnt,
    rangeElement: owner.rangeElement.slice(), rangeAnt: owner.rangeAnt.slice(),
    neighbor: document.getElementById('neighbor').value, disabledValue: document.getElementById('disabled-neighbor').value });
  window.__zooSlider = { owner, nativeModel, root, displayed, tick: Vue.nextTick };
  window.__zoo = { ready: true, case: window.__ZOO_CASE__, liveSupportClaimed: false, readModel,
    snapshot: () => ({ model: readModel(), display: Object.fromEntries(['native', 'element', 'ant'].map(family => [family, displayed(family)])),
      effects: { ...effects, clicks: { ...effects.clicks }, downs: { ...effects.downs } } }) };
})();
