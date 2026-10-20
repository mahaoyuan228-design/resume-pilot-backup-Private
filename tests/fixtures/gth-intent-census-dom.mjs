/**
 * DOM fixture built from the 2026-10-20 opened 求职意向 census.
 * Option text and element shapes come from that JSON. Counter text is ASCII
 * "(n/5)" or the live full-width "（n/m）". Level-2 for a branch other than
 * the one that was open is not in the census and is left empty on purpose.
 * l1Only omits the level-2 menu until a level-1 click, matching the editor
 * after 取消. single hides the chip strip and 确定/取消; a level-2 click
 * applies that one value and closes the panel.
 */
import { readFileSync } from 'node:fs';

const census = JSON.parse(readFileSync(new URL('./gth-intent-census-20261020.json', import.meta.url), 'utf8'));

export const CENSUS = census;
export const ARRIVAL_OPTIONS = Object.freeze(['一周内', '一个月内', '一个月以上', '即时', '面议']);
export const ARRIVAL_WITH_PLACEHOLDER = Object.freeze(['请选择', ...ARRIVAL_OPTIONS]);

function esc(value) {
  return String(value).replace(/[&<>"']/gu, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function norm(value) {
  return String(value ?? '').replace(/[\s\u00a0]+/gu, ' ').trim();
}

export function levelSplit(options) {
  const branches = (options || []).filter((row) => String(row?.c || '').includes('branch'));
  const spe = branches.findIndex((row) => String(row.c).includes('spe'));
  if (spe >= 0) return { l1: branches.slice(0, spe), l2: branches.slice(spe) };
  const leaf = branches.findIndex((row) => !String(row.c).includes('has-child'));
  if (leaf < 0) return { l1: branches, l2: [] };
  return { l1: branches.slice(0, leaf), l2: branches.slice(leaf) };
}

export function censusItem(label) {
  const item = census.items.find((row) => row.label === label);
  if (!item) throw new Error(`census item missing: ${label}`);
  return item;
}

export function pickerModel(label) {
  const item = censusItem(label);
  const { l1, l2 } = levelSplit(item.options);
  const observed = l1.filter((row) => String(row.c).includes('has-child') && String(row.c).includes('selected'));
  if (observed.length !== 1) throw new Error(`census L1 selected branch not unique: ${label}`);
  const trigger = item.inputs.find((input) => input.cls === 'el-input__inner' && input.vis);
  return {
    label,
    l1,
    l2,
    observedL1: observed[0].x,
    observedL2: l2.map((row) => row.x),
    trigger: trigger ? trigger.value : '',
    placeholder: item.inputs.find((input) => input.cls === 'search-input')?.ph || ''
  };
}

function l1Item(row) {
  return `<li class="${esc(row.c)}"><span>${esc(row.x)}</span></li>`;
}

function l2Item(row) {
  return `<li class="${esc(row.c)}"><label><input type="checkbox">${esc(row.x)}</label></li>`;
}

function pickerHtml(label, override = {}) {
  const model = pickerModel(label);
  const chips = override.chips ?? (model.trigger ? [model.trigger] : []);
  const trigger = override.trigger ?? model.trigger;
  const single = override.single === true;
  const counter = override.counter ?? (single ? `（${chips.length}/1）` : `(${chips.length}/5)`);
  const l2Rows = override.emptyL2 ? '' : model.l2.map(l2Item).join('');
  const triggerClass = label === '期望工作地区' ? 'input-l pointer local---222' : 'input-l pointer';
  const chipHtml = chips.map((text) => `<li><p>${esc(text)}</p><i></i></li>`).join('');
  const l2Menu = override.l1Only === true
    ? ''
    : `<div class="eo-cascader-menu simple-tree-outer"><ul class="simple-tree-wrapper">${l2Rows}</ul></div>`;
  const viewStyle = single ? ' style="display:none"' : '';
  const footStyle = single ? ' style="display:none"' : '';
  return `<div class="el-form-item is-required">
    <label class="el-form-item__label">${esc(label)}</label>
    <div class="el-form-item__content cascader-wrap">
      <div class="${triggerClass}">
        <div class="input-l pointer el-input">
          <input class="el-input__inner" readonly value="${esc(trigger)}">
        </div>
        <span class="el-input__suffix"><span class="el-input__suffix-inner"><i class="el-select__caret el-input__icon el-icon-arrow-up"></i></span></span>
      </div>
      <div class="dialog-wrap plugin-dialog-wrap popover blue" style="display:none">
        <div class="eo-checked-wrap selected-view-outer"${viewStyle}>
          <ul class="selected-view-data">${chipHtml}</ul>
          <div class="selected-counter"><p>${esc(counter)}</p></div>
        </div>
        <div class="search-outer">
          <div class="search-leaves-outer"><ul class="search-leaves-wrapper"></ul></div>
          <div class="search-input-wrapper">
            <input class="search-input" placeholder="请输入关键字">
            <i class="clear-input"></i>
          </div>
        </div>
        <div class="eo-cascader-panel">
          <div class="eo-cascader-menu simple-tree-outer"><ul class="simple-tree-wrapper">${model.l1.map(l1Item).join('')}</ul></div>
          ${l2Menu}
        </div>
        <div class="pop-foot plugin-dialog-pop-foot"${footStyle}><div class="btn-group-outer">
          <a class="confirm pop-btn">确定</a>
          <a class="cancel pop-btn">取消</a>
        </div></div>
        <div class="dialog-search-wrap"></div>
      </div>
    </div>
  </div>`;
}

function salaryHtml(label, value) {
  return `<div class="el-form-item is-required">
    <label class="el-form-item__label">${esc(label)}</label>
    <div class="el-form-item__content">
      <div class="el-input select-l"><input class="el-input__inner" type="text" value="${esc(value)}"></div>
      <span>元/月</span>
    </div>
  </div>`;
}

function arrivalHtml(value) {
  const options = ARRIVAL_WITH_PLACEHOLDER.map((text) => `<li class="el-select-dropdown__item">${esc(text)}</li>`).join('');
  return `<div class="el-form-item select-item">
    <label class="el-form-item__label">到岗日期</label>
    <div class="el-form-item__content">
      <div class="el-select select-l">
        <div class="el-input el-input--suffix">
          <input class="el-input__inner" readonly placeholder="请选择" value="${esc(value)}">
          <span class="el-input__suffix"><span class="el-input__suffix-inner"><i class="el-select__caret el-input__icon el-icon-arrow-up"></i></span></span>
        </div>
        <div class="el-select-dropdown el-popper" style="display:none">
          <div class="el-scrollbar"><div class="el-select-dropdown__wrap el-scrollbar__wrap">
            <ul class="el-scrollbar__view el-select-dropdown__list">${options}</ul>
          </div></div>
        </div>
      </div>
    </div>
  </div>`;
}

export function intentFormHtml({
  pickers = {},
  salaries = {},
  arrival = '',
  duplicateLabel = '',
  salaryHtmlOverride = ''
} = {}) {
  const salary = {
    期望薪资: salaries.期望薪资 ?? '12000',
    现薪资: salaries.现薪资 ?? '12000'
  };
  const salaryBlock = salaryHtmlOverride || salaryHtml('期望薪资', salary.期望薪资);
  const duplicate = duplicateLabel
    ? `<div class="el-form-item"><label class="el-form-item__label">${esc(duplicateLabel)}</label><div class="el-form-item__content"><input type="text" value="duplicate"></div></div>`
    : '';
  return `<form class="el-form sec-form" id="intent-form">
    ${pickerHtml('期望工作地区', pickers.期望工作地区)}
    ${pickerHtml('期望从事职位类别', pickers.期望从事职位类别)}
    ${salaryBlock}
    ${arrivalHtml(arrival)}
    ${pickerHtml('现从事行业', pickers.现从事行业)}
    ${pickerHtml('现从事职位类别', pickers.现从事职位类别)}
    ${salaryHtml('现薪资', salary.现薪资)}
    ${duplicate}
    <button type="button" class="el-button el-button--default is-plain" id="intent-cancel">取消</button>
    <button type="button" class="el-button el-button--primary" id="intent-save">保存</button>
  </form>`;
}

function itemByLabel(form, label) {
  return [...form.querySelectorAll('.el-form-item')].find((item) => {
    const labels = [...item.querySelectorAll('.el-form-item__label')].filter((node) => node.closest('.el-form-item') === item);
    return labels.length === 1 && norm(labels[0].textContent) === label;
  });
}

function checkedText(box) {
  return norm(box.closest('label')?.textContent);
}

export function wireIntentForm(form, { pickers = {}, arrivalWrites = true } = {}) {
  const stats = {
    save: 0, formCancel: 0, confirm: 0, panelCancel: 0, checkbox: 0, level1: 0, level2: 0, option: 0
  };
  form.querySelector('#intent-save')?.addEventListener('click', () => { stats.save += 1; });
  form.querySelector('#intent-cancel')?.addEventListener('click', () => { stats.formCancel += 1; });
  for (const label of ['期望工作地区', '期望从事职位类别', '现从事行业', '现从事职位类别']) {
    const item = itemByLabel(form, label);
    const panel = item.querySelector('.dialog-wrap.plugin-dialog-wrap.popover.blue');
    const trigger = item.querySelector('.el-form-item__content.cascader-wrap > .input-l.pointer');
    const input = trigger.querySelector('input.el-input__inner');
    const cascader = panel.querySelector(':scope > .eo-cascader-panel');
    const menuNodes = () => [...cascader.querySelectorAll(':scope > .eo-cascader-menu.simple-tree-outer')];
    const initialL2 = menuNodes()[1]?.querySelector(':scope > ul.simple-tree-wrapper');
    const l2Html = initialL2 ? initialL2.innerHTML : pickerModel(label).l2.map(l2Item).join('');
    const observed = pickerModel(label).observedL1;
    const hook = pickers[label] || {};
    const ensureL2Menu = () => {
      let menusNow = menuNodes();
      if (menusNow.length === 1) {
        const menu = form.ownerDocument.createElement('div');
        menu.className = 'eo-cascader-menu simple-tree-outer';
        menu.innerHTML = '<ul class="simple-tree-wrapper"></ul>';
        cascader.appendChild(menu);
        menusNow = menuNodes();
      }
      return menusNow[1] || null;
    };
    const panelIsSingle = () => {
      const foot = panel.querySelector(':scope > .pop-foot.plugin-dialog-pop-foot');
      if (foot && foot.style.display === 'none') return true;
      const raw = norm(panel.querySelector('.selected-counter > p')?.textContent);
      const match = raw.match(/^[（(]\d+\/(\d+)[）)]$/u);
      return !!match && Number(match[1]) === 1;
    };
    trigger.addEventListener('click', () => {
      panel.style.display = 'block';
      if (typeof hook.onOpen === 'function') hook.onOpen({ panel, input });
    });
    cascader.addEventListener('click', (event) => {
      const menusNow = menuNodes();
      if (menusNow[0]?.contains(event.target)) {
        const li = event.target.closest('li.branch.has-child');
        if (!li || !menusNow[0].contains(li)) return;
        stats.level1 += 1;
        const text = norm(li.querySelector(':scope > span')?.textContent);
        if (typeof hook.onLevel1 === 'function') {
          hook.onLevel1({
            text,
            list: menusNow[1]?.querySelector(':scope > ul.simple-tree-wrapper') || null,
            observed,
            l2Html,
            ensureL2: ensureL2Menu
          });
          return;
        }
        const list = ensureL2Menu()?.querySelector(':scope > ul.simple-tree-wrapper');
        if (list) list.innerHTML = text === observed ? l2Html : '';
        return;
      }
      const l2Menu = menuNodes()[1];
      if (!l2Menu?.contains(event.target)) return;
      if (panelIsSingle()) {
        if (event.target.closest('input')) return;
        const li = event.target.closest('li.branch');
        if (!li || li.classList.contains('has-child') || !l2Menu.contains(li)) return;
        const text = norm(li.querySelector('label')?.textContent || li.querySelector(':scope > span')?.textContent);
        if (!text) return;
        stats.level2 += 1;
        const chips = panel.querySelector('.selected-view-data');
        chips.innerHTML = `<li><p>${esc(text)}</p><i></i></li>`;
        input.value = text;
        panel.style.display = 'none';
        return;
      }
      const box = event.target.closest('input[type="checkbox"]');
      if (!box || !l2Menu.contains(box)) return;
      stats.checkbox += 1;
      const text = checkedText(box);
      const chips = panel.querySelector('.selected-view-data');
      if (box.checked) {
        if (![...chips.querySelectorAll(':scope > li p')].some((node) => norm(node.textContent) === text)) {
          const li = form.ownerDocument.createElement('li');
          li.innerHTML = `<p>${esc(text)}</p><i></i>`;
          chips.appendChild(li);
        }
      } else {
        for (const li of [...chips.querySelectorAll(':scope > li')]) {
          if (norm(li.querySelector('p')?.textContent) === text) li.remove();
        }
      }
    });
    panel.querySelector('a.confirm.pop-btn').addEventListener('click', () => {
      stats.confirm += 1;
      if (typeof hook.onConfirm === 'function') {
        hook.onConfirm({ input, panel, stats });
        return;
      }
      const chips = [...panel.querySelectorAll('.selected-view-data > li p')].map((node) => norm(node.textContent));
      input.value = chips.length === 1 ? chips[0] : '';
      panel.style.display = 'none';
    });
    panel.querySelector('a.cancel.pop-btn').addEventListener('click', () => {
      stats.panelCancel += 1;
      menuNodes()[1]?.remove();
      panel.style.display = 'none';
    });
  }
  const arrival = itemByLabel(form, '到岗日期');
  const arrivalInput = arrival.querySelector('input.el-input__inner');
  const menu = arrival.querySelector('.el-select-dropdown.el-popper');
  arrivalInput.addEventListener('click', () => {
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  });
  if (arrivalWrites) {
    for (const option of menu.querySelectorAll('li.el-select-dropdown__item')) {
      option.addEventListener('click', () => {
        stats.option += 1;
        arrivalInput.value = norm(option.textContent);
        menu.style.display = 'none';
      });
    }
  }
  return stats;
}
