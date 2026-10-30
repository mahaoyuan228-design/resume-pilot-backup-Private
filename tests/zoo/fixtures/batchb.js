/* First-party synthetic controls. No captured acceptance page, URL, credentials,
 * ATS implementation code or claim of live compatibility is included. */
(() => {
  'use strict';
  const name = window.__ZOO_CASE__, variant = window.__ZOO_VARIANT__ || '';
  const app = document.querySelector('#app');
  const effects = { blacklistClicks: 0, entryClicks: [], inputEvents: 0, preHydrationInputEvents: 0 };
  const values = { fullName: '', mobile: '', email: '' };
  const keys = ['fullName', 'mobile', 'email'];
  const labels = name.includes('hotjob') ? ['姓名', '移动电话', '电子邮箱'] : ['姓名', '手机号码', '邮箱'];
  function mountForm(count = 3) {
    const prefix = name.includes('hotjob') ? 'mc' : name.includes('beisen') ? 'bs' : name.includes('moka') ? 'moka' : 'atsx';
    app.innerHTML = '<div class="resume-info-title">基本信息</div><form id="editor"></form>';
    const form = document.querySelector('#editor');
    for (let index = 0; index < count; index++) {
      const root = document.createElement('div');
      root.id = `field-${keys[index]}`;
      root.className = prefix === 'mc' ? 'my-list-item' : `${prefix}-form-item`;
      root.innerHTML = prefix === 'mc'
        ? `<div class="header-title">${labels[index]}</div><div class="am-input-control"><input id="${keys[index]}" type="text"></div>`
        : `<label class="${prefix}-form-item-label" for="${keys[index]}">${labels[index]}</label><input class="${prefix}-input" id="${keys[index]}" type="${['text', 'tel', 'email'][index]}">`;
      form.append(root);
    }
    const neighbor = document.createElement('div');
    neighbor.className = prefix === 'mc' ? 'my-list-item' : `${prefix}-form-item`;
    neighbor.innerHTML = prefix === 'mc'
      ? '<div class="header-title">证件号码</div><div class="am-input-control"><input id="item-neighbor" value="ZOO_ITEM_KEEP"></div>'
      : `<label class="${prefix}-form-item-label" for="item-neighbor">离线邻项</label><input class="${prefix}-input" id="item-neighbor" value="ZOO_ITEM_KEEP">`;
    form.append(neighbor);
    app.removeAttribute('aria-busy');
  }
  function entryButton(caption, action, { submit = false } = {}) {
    const button = document.createElement('button');
    if (!submit) button.type = 'button';
    button.textContent = caption;
    button.addEventListener('click', () => { effects.entryClicks.push(caption); action(); });
    return button;
  }
  function showEnter() {
    app.innerHTML = '<p>离线简历草稿</p>';
    app.append(entryButton('进入简历', () => mountForm()));
  }
  function showCreate() {
    app.innerHTML = '<p>还没有简历</p>';
    const form = document.createElement('form');
    form.append(entryButton('创建简历', showEnter, { submit: variant === 'submit' }));
    app.append(form);
  }
  function showSummary() {
    app.innerHTML = '<article><h2>离线简历摘要</h2><p>只读摘要，不是可填表单。</p></article>';
    app.append(entryButton('编辑简历', () => setTimeout(mountForm, 90)));
    if (variant === 'ambiguous') app.append(entryButton('编辑简历', mountForm));
  }
  function model() {
    return { ...values,
      neighbor: document.querySelector('#neighbor').value,
      itemNeighbor: document.querySelector('#item-neighbor')?.value ?? null,
      disabledValue: document.querySelector('#disabled-neighbor').value };
  }
  if (name === 'batchb-hotjob-entry') showCreate();
  else if (name === 'batchb-beisen-summary') showSummary();
  else if (name === 'batchb-feishu-shell') {
    app.innerHTML = '<section id="editor-shell" aria-busy="true"><h2>编辑简历</h2><p>正在加载表单</p></section>';
    if (variant === 'partial') mountForm(1);
    if (variant === 'busy') { mountForm(); app.setAttribute('aria-busy', 'true'); }
  } else if (name === 'batchb-moka-model') {
    mountForm();
    const fullName = document.querySelector('#fullName');
    fullName.value = values.fullName = '离线姓名甲';
    if (variant === 'owned') {
      document.querySelector('#mobile').value = values.mobile = '13800001111';
      document.querySelector('#email').value = values.email = 'offline@example.test';
    }
    if (variant === 'vue3') {
      const shared = { type: { name: 'SyntheticMultiFieldForm' }, props: { modelValue: values.fullName }, subTree: { el: app } };
      app.__vueParentComponent = shared;
      for (const key of keys) document.querySelector(`#${key}`).__vueParentComponent = shared;
    } else {
      function SyntheticForm() {} SyntheticForm.displayName = 'SyntheticMokaMultiFieldForm';
      const host = { type: 'main', stateNode: app };
      const parent = { type: SyntheticForm, stateNode: null, child: host, memoizedProps: { value: values.fullName }, return: null };
      host.return = parent;
      app.__reactFiber$offlineZoo = parent;
      for (const key of keys) {
        const input = document.querySelector(`#${key}`);
        input.__reactFiber$offlineZoo = { type: 'input', stateNode: input,
          memoizedProps: key === 'fullName' || variant === 'owned' ? { value: values[key] } : {}, return: parent };
      }
    }
  } else throw Error(`unknown_batchb_case:${name}`);
  document.addEventListener('input', event => {
    if (keys.includes(event.target.id)) { values[event.target.id] = event.target.value; effects.inputEvents++; }
  });
  document.addEventListener('submit', event => event.preventDefault(), true);
  document.addEventListener('click', event => {
    const action = event.target.closest('button,a,input[type="submit"]');
    if (action && /^(保存|提交|下一步|投递|删除)$/u.test(action.textContent.trim())) effects.blacklistClicks++;
  }, true);
  window.__zoo = { ready: true, case: name, variant, liveSupportClaimed: false,
    readModel: model,
    snapshot: () => ({ model: model(), effects: JSON.parse(JSON.stringify(effects)), liveSupportClaimed: false }),
    startHydration: delay => setTimeout(() => { effects.preHydrationInputEvents = effects.inputEvents; mountForm(); }, delay),
  };
})();
