/* First-party disposable configurations of pinned public rating components.
 * Labels and values are synthetic; all assets are fulfilled locally. */
(async () => {
  'use strict';
  const family = window.__ZOO_CASE__.replace('rate-', '');
  for (const name of ['ant', 'element', 'plus']) document.querySelector(`#rate-${name}-css`).disabled = name !== family;
  const effects = { blacklistClicks: 0, submits: 0, inputEvents: 0, changeEvents: 0, clicks: 0, keys: 0, moves: 0 };
  const initial = () => ({ value: 1, second: 1, disabled: 1, readonly: 1, hidden: 1 });
  let owner, tick, setValue;
  if (family === 'aria') {
    owner = initial(); tick = async () => {};
    const app = document.getElementById('app');
    for (const [name, label] of [['target', 'ARIA rating'], ['second', 'Whole-star rating'], ['disabled', 'Disabled rating'],
      ['readonly', 'Readonly rating'], ['hidden', 'Hidden rating']]) {
      const row = document.createElement('div'); row.className = 'rate-row'; row.hidden = name === 'hidden';
      const root = document.createElement('div');
      root.id = `rate-${name}`; root.className = 'aria-rating';
      root.setAttribute('role', 'slider'); root.setAttribute('aria-roledescription', 'rating');
      root.setAttribute('aria-label', label); root.setAttribute('aria-valuemin', '0'); root.setAttribute('aria-valuemax', '5');
      root.setAttribute('aria-valuenow', '1'); root.tabIndex = 0;
      if (name === 'disabled') root.setAttribute('aria-disabled', 'true');
      if (name === 'readonly') root.setAttribute('aria-readonly', 'true');
      for (let index = 1; index <= 5; index++) {
        const star = document.createElement('span'); star.textContent = '★'; star.setAttribute('aria-hidden', 'true');
        root.append(star);
      }
      const key = name === 'target' ? 'value' : name;
      const render = value => {
        owner[key] = value; root.setAttribute('aria-valuenow', String(value));
        root.setAttribute('aria-valuetext', `${value} of 5 stars`);
        for (const [index, star] of [...root.children].entries()) star.setAttribute('aria-selected', String(index < value));
      };
      render(1);
      root.addEventListener('click', event => {
        if (['disabled', 'readonly', 'hidden'].includes(name)) return;
        const rect = root.getBoundingClientRect();
        render(Math.max(1, Math.min(5, Math.ceil((event.clientX - rect.left) / rect.width * 5))));
      });
      root.addEventListener('keydown', event => {
        if (['disabled', 'readonly', 'hidden'].includes(name)) return;
        const delta = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];
        if (delta) { render(Math.max(0, Math.min(5, owner[key] + delta))); event.preventDefault(); }
        else if (event.key === 'Home') { render(0); event.preventDefault(); }
        else if (event.key === 'End') { render(5); event.preventDefault(); }
      });
      row.append(root); app.append(row);
      if (name === 'target') setValue = render;
    }
    const ordinary = document.createElement('div');
    ordinary.id = 'ordinary-slider'; ordinary.setAttribute('role', 'slider'); ordinary.tabIndex = 0;
    ordinary.setAttribute('aria-label', 'Volume'); ordinary.setAttribute('aria-valuemin', '0');
    ordinary.setAttribute('aria-valuemax', '5'); ordinary.setAttribute('aria-valuenow', '1');
    ordinary.textContent = 'Ordinary slider'; app.append(ordinary);
  } else {
    const component = family === 'ant' ? 'a-rate' : 'el-rate';
    const markup = (name, key, attributes = '') => `<div class="rate-row" ${name === 'hidden' ? 'hidden' : ''}>
      <label>${family} ${name} rating</label><${component} id="rate-${name}" v-model="${key}" ${attributes} /></div>`;
    const template = `<section>${markup('target', 'value', 'allow-half')}${markup('second', 'second')}
      ${markup('disabled', 'disabled', 'disabled')}${markup('readonly', 'readonly', 'aria-readonly="true"')}
      ${markup('hidden', 'hidden')}</section>`;
    if (family === 'plus') {
      const app = Vue.createApp({ data: initial, template }); app.use(ElementPlus); owner = app.mount('#app'); tick = Vue.nextTick;
    } else {
      window.Vue = window.ZooVue2; Vue.use(antd); Vue.use(ELEMENT);
      owner = new Vue({ el: '#app', data: initial, template }); tick = Vue.nextTick;
    }
    setValue = value => { owner.value = value; };
  }
  await tick();
  const root = (name = 'target') => document.getElementById(`rate-${name}`);
  const display = () => {
    const target = root();
    return family === 'ant' ? target.querySelectorAll('.ant-rate-star-full').length
      + target.querySelectorAll('.ant-rate-star-half').length / 2 : Number(target.getAttribute('aria-valuenow'));
  };
  root().addEventListener('click', () => effects.clicks++, true);
  root().addEventListener('keydown', () => effects.keys++, true);
  root().addEventListener('mousemove', () => effects.moves++, true);
  document.addEventListener('click', event => {
    const action = event.target.closest('button,a,[role="button"],input[type="submit"]');
    if (action && /^(保存|提交|下一步|投递|删除)$/u.test((action.textContent || action.value || '').trim())) {
      effects.blacklistClicks++; event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
  document.addEventListener('input', () => effects.inputEvents++, true);
  document.addEventListener('change', () => effects.changeEvents++, true);
  document.addEventListener('submit', event => { effects.submits++; event.preventDefault(); }, true);
  const readModel = () => ({ target: owner.value, second: owner.second, disabled: owner.disabled,
    readonly: owner.readonly, hidden: owner.hidden, neighbor: document.getElementById('neighbor').value,
    disabledValue: document.getElementById('disabled-neighbor').value });
  window.__zooRate = { owner, tick, root, display, family, setValue };
  window.__zoo = { ready: true, case: window.__ZOO_CASE__, liveSupportClaimed: false, readModel,
    snapshot: () => ({ model: readModel(), display: display(), effects: { ...effects } }) };
})();
