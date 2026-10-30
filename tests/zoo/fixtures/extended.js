/* First-party offline fixtures. iView uses its real pinned 3.5.4 components.
 * Ud/Phoenix are deliberately synthetic React-prop/ARIA contract replays;
 * they are not captured recruitment DOM and establish no live version. */
window.createExtendedZoo = function createExtendedZoo(name, variant) {
  'use strict';
  const adapter = name.slice('extended-'.length), [family, kind] = adapter.split('-');
  const effects = { blacklistClicks: 0, changes: 0, opens: 0 };
  const initial = { neighbor: 'ZOO_NEIGHBOR_KEEP', disabledValue: 'ZOO_DISABLED_KEEP' };
  const appRoot = document.querySelector('#app');
  appRoot.innerHTML = `<div id="extended-control"></div><input id="neighbor" value="ZOO_NEIGHBOR_KEEP"><input id="disabled-neighbor" value="ZOO_DISABLED_KEEP" disabled>
    <div>${['保存', '提交', '下一步', '投递', '删除'].map(label => `<button type="button">${label}</button>`).join('')}</div>`;
  let readValue;
  const existing = variant === 'existing';
  if (family === 'ivu') {
    const Component = kind === 'select' ? iview.Select : iview.DatePicker;
    const app = new Vue({
      el: '#extended-control',
      components: { Option: iview.Option },
      data: () => ({ value: existing ? (kind === 'select' ? 'keep' : new Date(2022, 2, 1)) : '' }),
      render(h) {
        const props = { value: this.value, disabled: variant === 'disabled' };
        if (kind === 'date') Object.assign(props, { type: 'date', format: 'yyyy-MM-dd', editable: false, clearable: false, startDate: new Date(2023, 0, 1) });
        return h('div', [h(Component, { attrs: { id: 'extended-control' }, props,
          on: { input: value => { this.value = value; effects.changes++; } } }, kind === 'select'
          ? [h('Option', { props: { value: 'degree-bs', label: '本科' } }, ['本科']), h('Option', { props: { value: 'keep', label: '原有值' } }, ['原有值'])] : [])]);
      }
    });
    readValue = () => app.value instanceof Date
      ? `${app.value.getFullYear()}-${String(app.value.getMonth() + 1).padStart(2, '0')}-${String(app.value.getDate()).padStart(2, '0')}` : app.value;
  } else {
    const root = document.querySelector('#extended-control');
    root.className = family === 'ud' ? 'ud__select' : 'phoenix-select';
    root.innerHTML = '<input readonly role="combobox" aria-controls="extended-portal" aria-expanded="false">';
    const input = root.querySelector('input');
    const portal = document.createElement('div');
    portal.id = 'extended-portal'; portal.setAttribute('role', kind === 'date' ? 'dialog' : 'listbox');
    portal.hidden = true; document.body.append(portal);
    window[family === 'ud' ? 'UD' : 'Phoenix'] = { version: 'fixture-contract-1' };
    const options = kind === 'cascader'
      ? [{ value: 'cn', label: '中国', children: [{ value: 'bj', label: '北京' }] }]
      : [{ value: 'degree-bs', label: '本科' }, { value: 'keep', label: '原有值' }];
    const props = { value: existing ? (kind === 'cascader' ? ['keep'] : 'keep') : kind === 'cascader' ? [] : '',
      options, disabled: variant === 'disabled', separator: ' / ', valueFormat: 'YYYY-MM-DD',
      onChange(value) {
        props.value = value; effects.changes++;
        input.value = kind === 'select' ? options.find(option => option.value === value)?.label || value
          : kind === 'cascader' ? ['中国', '北京'].slice(0, value.length).join(' / ') : value;
        portal.hidden = true; input.setAttribute('aria-expanded', 'false');
      } };
    const component = { displayName: `${family === 'ud' ? 'Ud' : 'Phoenix'}${kind === 'date' ? 'DatePicker' : kind === 'select' ? 'Select' : 'Cascader'}`,
      library: { name: family, version: 'fixture-contract-1' } };
    root.__reactFiber$zoo = { type: component, memoizedProps: props, return: null };
    if (existing) input.value = '原有值';
    input.disabled = props.disabled;
    const optionNode = (option, action) => {
      const node = document.createElement('div'); node.setAttribute('role', 'option'); node.tabIndex = 0;
      node.textContent = option.label; node.addEventListener('click', event => { event.stopPropagation(); action(); }); return node;
    };
    if (kind === 'date') {
      const date = document.createElement('button'); date.type = 'button'; date.setAttribute('role', 'gridcell');
      date.setAttribute('aria-label', '2023-01-02'); date.textContent = '2'; date.addEventListener('click', () => props.onChange('2023-01-02')); portal.append(date);
    } else if (kind === 'cascader') {
      const group = document.createElement('div'); group.setAttribute('role', 'group');
      group.append(optionNode(options[0], () => {
        if (portal.querySelectorAll('[role="group"]').length > 1) return;
        const child = document.createElement('div'); child.setAttribute('role', 'group');
        child.append(optionNode(options[0].children[0], () => props.onChange(['cn', 'bj']))); portal.append(child);
      })); portal.append(group);
    } else for (const option of options) portal.append(optionNode(option, () => props.onChange(option.value)));
    root.addEventListener('click', () => { if (!props.disabled) { portal.hidden = false; effects.opens++; input.setAttribute('aria-expanded', 'true'); } });
    readValue = () => JSON.parse(JSON.stringify(props.value));
  }
  document.addEventListener('click', event => {
    if (/^(保存|提交|下一步|投递|删除)$/u.test(event.target.closest('button')?.textContent.trim() || '')) effects.blacklistClicks++;
  }, true);
  const model = () => ({ ...initial, value: readValue() });
  window.__zoo = { ready: false, case: name, variant, liveSupportClaimed: false,
    readModel: model, snapshot: () => ({ model: model(), effects: { ...effects }, liveSupportClaimed: false }) };
  Vue.nextTick(() => { window.__zoo.ready = true; });
};

window.createWriteRouteZoo = function createWriteRouteZoo() {
  document.querySelector('#app').innerHTML = `<form><label for="fullName">姓名</label><input id="fullName" name="fullName">
    <input id="neighbor" value="ZOO_NEIGHBOR_KEEP"><input id="disabled-neighbor" value="ZOO_DISABLED_KEEP" disabled>
    <button type="button">保存</button><button type="submit">提交</button></form>`;
  document.querySelector('form').addEventListener('submit', event => event.preventDefault());
  const model = () => ({ fullName: document.querySelector('#fullName').value, neighbor: document.querySelector('#neighbor').value,
    disabledValue: document.querySelector('#disabled-neighbor').value });
  window.__zoo = { ready: true, case: 'write-route', liveSupportClaimed: false, readModel: model,
    snapshot: () => ({ model: model(), effects: { blacklistClicks: 0 }, liveSupportClaimed: false }) };
};
