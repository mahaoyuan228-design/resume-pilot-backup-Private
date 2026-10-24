import {readFile} from 'node:fs/promises';

export const harvestSelects = JSON.parse(await readFile(new URL('./cms-education-harvest-selects.json', import.meta.url), 'utf8'));

// Synthetic form/section/row scaffold around exact captured item prefixes. The
// HTML parser closes truncated tails; no absent city continuation is fabricated.
export function harvestSelectFixture() {
  const wrappers = new Map();
  for (const field of harvestSelects.fields) {
    wrappers.set(field.wrapperId, `${wrappers.get(field.wrapperId) || ''}${field.itemHTML}`);
  }
  // Parse each prefix independently before concatenating, so one truncated SVG
  // cannot swallow the next wrapper. Browser DOMParser is supplied by caller.
  return {fields: harvestSelects.fields, wrappers, menus: harvestSelects.menus};
}

export function mountHarvestSelectFixture(window, {scaffold = true, onCommit = () => {}} = {}) {
  const {document} = window, data = harvestSelectFixture();
  if (scaffold) document.body.innerHTML = '<form><div class="form-cell" id="14"><div class="tit-wrap"><span class="tit">教育经历必填</span></div><div class="form-cell-right"><div class="form-cell-inner"></div></div></div></form>';
  const row = document.querySelector('.form-cell[id="14"] .form-cell-inner');
  for (const [id] of data.wrappers) {
    const fields = data.fields.filter(field => field.wrapperId === id);
    // Overlay mode intentionally retains the independent synthetic region/date
    // fixture behavior; its absent city continuation is never reconstructed.
    if (!scaffold && !fields.some(field => ['学校','学历','学位','专业排名'].includes(field.question))) continue;
    const wrapper = document.getElementById(id) || document.createElement('div');
    wrapper.id = id;
    wrapper.replaceChildren();
    for (const field of fields) {
      const template = document.createElement('template');
      template.innerHTML = field.itemHTML;
      // Decorative tail is unrelated to any control assertion or interaction.
      template.content.querySelectorAll('svg,.ant-select-selection__clear,.ant-select-arrow').forEach(node => node.remove());
      wrapper.append(template.content);
    }
    row.append(wrapper);
  }
  let owner = null;
  const counts = {opens: 0, selections: 0, forbidden: 0, searches: 0};
  const choices = [];
  function close() {
    document.querySelectorAll('.ant-select-dropdown').forEach(node => node.remove());
    if (!owner) return;
    owner.closest('.ant-select').classList.remove('ant-select-open');
    owner.setAttribute('aria-expanded', 'false');
    const searchWrap = owner.querySelector('.ant-select-search');
    if (searchWrap) searchWrap.style.display = 'none';
    owner = null;
  }
  for (const field of data.fields) {
    if (field.question === '城市') continue; // Second menu was not harvested.
    const wrapper = document.getElementById(field.wrapperId);
    const selection = wrapper?.querySelector('.ant-select-selection');
    const menuData = data.menus[field.question];
    if (!selection || !menuData || selection.dataset.fixtureBound) continue;
    selection.dataset.fixtureBound = 'true';
    selection.addEventListener('click', () => {
      close(); owner = selection; counts.opens++;
      selection.closest('.ant-select').classList.add('ant-select-open');
      selection.setAttribute('aria-expanded', 'true');
      const searchWrap = selection.querySelector('.ant-select-search');
      if (searchWrap) searchWrap.style.display = 'block';
      const template = document.createElement('template'); template.innerHTML = menuData.html;
      const menu = template.content.firstElementChild;
      menu.classList.remove('ant-select-dropdown-hidden'); menu.style.display = 'block';
      document.body.append(menu);
      for (const option of menu.querySelectorAll('.ant-select-dropdown-menu-item')) option.addEventListener('click', () => {
        const selected = selection.querySelector('.ant-select-selection-selected-value');
        const text = option.textContent.trim(); selected.textContent = text; selected.title = text;
        counts.selections++; choices.push({wrapperId: field.wrapperId, text}); onCommit({wrapperId: field.wrapperId, text}); close();
      });
    });
    selection.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
    selection.querySelector('input')?.addEventListener('input', () => { counts.searches++; });
  }
  // Button labels are never needed by adapters. Click auditing in the tests
  // rejects every target outside the harvested selection/option surfaces.
  return {counts, choices, close, row};
}
