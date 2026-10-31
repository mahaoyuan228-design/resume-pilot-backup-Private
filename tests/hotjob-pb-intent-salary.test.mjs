// Offline Never-Save trials for hotjob pb 求职意向 flat selects:
// 期望工作性质, 期望年薪, 到岗时间.
// Markup is built from tests/fixtures/hotjob-pb-intent-salary-probe-dom.json
// (2026-10-23 probe classes, labels, and captured display tokens only).
// A green run is not a live support claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../src/content/hotjob-pb-intent-salary.js', import.meta.url), 'utf8');
const basicSource = readFileSync(new URL('../src/content/hotjob-pb-basic.js', import.meta.url), 'utf8');
const regionSource = readFileSync(new URL('../src/content/hotjob-pb-region.js', import.meta.url), 'utf8');
const eduSource = readFileSync(new URL('../src/content/hotjob-pb-edu-intent.js', import.meta.url), 'utf8');
const eduHistorySource = readFileSync(new URL('../src/content/hotjob-pb-edu-history.js', import.meta.url), 'utf8');
const workSource = readFileSync(new URL('../src/content/hotjob-pb-work.js', import.meta.url), 'utf8');
const certsSource = readFileSync(new URL('../src/content/hotjob-pb-certs.js', import.meta.url), 'utf8');
const intentSource = readFileSync(new URL('../src/content/hotjob-pb-intent-location.js', import.meta.url), 'utf8');
const manifest = readFileSync(new URL('../manifest.json', import.meta.url), 'utf8');
const engine = readFileSync(new URL('../src/content/engine.js', import.meta.url), 'utf8');
const popup = readFileSync(new URL('../src/popup/popup.js', import.meta.url), 'utf8');
const cmsBasic = readFileSync(new URL('../src/background/cms-basic-auto.mjs', import.meta.url), 'utf8');
const cmsEdu = readFileSync(new URL('../src/background/cms-education-task-runner.mjs', import.meta.url), 'utf8');
const mcSource = readFileSync(new URL('../src/content/hotjob-mc-basic.js', import.meta.url), 'utf8');
const mcRunner = readFileSync(new URL('../src/background/hotjob-mc-basic-auto.mjs', import.meta.url), 'utf8');
const probe = JSON.parse(readFileSync(new URL('../tests/fixtures/hotjob-pb-intent-salary-probe-dom.json', import.meta.url), 'utf8'));

const PAGE = `https://${probe.page.hostname}${probe.page.samplePath}`;
const FIELD = Object.fromEntries(probe.select.fields.map((field) => [field.key, field]));
const NATURE = FIELD.nature.label;
const SALARY = FIELD.salary.label;
const ARRIVAL = FIELD.arrival.label;
const FORBIDDEN = probe.page.forbiddenButtons;
const LIVE = probe.select.liveReadback;
const PROFILE = Object.fromEntries(probe.select.fields.map((field) => [field.label, field.valueSample]));
const MODULE = 'hotjob-pb-intent-salary';

function esc(value) {
  return String(value).replace(/[&<>"]/gu, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

function classes(value) {
  return String(value).split(/\s+/u).filter(Boolean);
}

function selectInner(field, value, state) {
  if (state.ambiguousValue && field.key === 'salary') {
    const prompt = `${LIVE.placeholderPrefix}${field.label}`;
    return `<span class="${esc(LIVE.selectedValueClass)}" id="${field.key}-value">${esc(value || field.valueSample)}</span><span class="${esc(LIVE.selectedValueClass)}">${esc(prompt)}</span>`;
  }
  if (state.placeholderMash === 'class') {
    const prompt = `${LIVE.placeholderPrefix}${field.label}`;
    return `<span class="${esc(LIVE.placeholderClass)}">${esc(prompt)}</span><span class="${esc(LIVE.selectedValueClass)}" id="${field.key}-value">${esc(value)}</span>`;
  }
  const shown = state.placeholderMash === 'text' ? `${LIVE.placeholderPrefix}${field.label}${value}` : value;
  return `<span id="${field.key}-value">${esc(shown)}</span>`;
}

function selectClassFor(field, state) {
  if (field.key !== 'salary') return probe.select.controlClass;
  if (state.dropAllowClear) return 'ant-select ant-select-enabled';
  if (state.dropEnabled) return 'ant-select ant-select-allow-clear';
  const disabled = state.selectDisabled ? ' ant-select-disabled' : '';
  return `${probe.select.controlClass}${disabled}`;
}

function selectField(field, value, state) {
  const selectClass = selectClassFor(field, state);
  const trigger = state.dropSearch && field.key === 'salary'
    ? ''
    : `<input class="${esc(probe.select.triggerClass)}" type="text" value="">`;
  const extra = state.extraSelect && field.key === 'salary'
    ? `<div class="${esc(probe.select.controlClass)}"><span></span><input class="${esc(probe.select.triggerClass)}" type="text" value=""></div>`
    : '';
  const inner = selectInner(field, value, state);
  const bare = state.closedSearchBare && field.key === 'salary';
  const faced = !bare && (state.closedSearch || state.placeholderMash === 'class')
    ? `<div class="${esc(LIVE.faceClass)}" role="${esc(LIVE.faceRole)}">${inner}</div>`
    : inner;
  const hidden = state.hiddenSelect && field.key === 'salary' ? ' hidden' : '';
  const itemClass = state.dropAntRow && field.key === 'salary' ? 'ant-form-item' : probe.page.itemClass;
  const noise = [];
  if (field.key === 'salary') {
    if (state.checkboxInside) noise.push(`<input class="${esc(probe.neighbors.research.controlClass)}" type="checkbox">`);
    if (state.radioInside) noise.push(`<input class="${esc(probe.neighbors.obey.controlClass)}" type="radio">`);
    if (state.textareaInside) noise.push(`<textarea class="${esc(probe.neighbors.note.controlClass)}"></textarea>`);
    if (state.fileInside) noise.push('<input type="file">');
    if (state.calendarInside) noise.push(`<input class="${esc(probe.neighbors.earned.controlClass)}" type="text" readonly value="">`);
    if (state.textInside) noise.push(`<input class="${esc(probe.neighbors.name.controlClass)}" type="text" value="">`);
    if (state.cascaderInside) noise.push(`<span class="${esc(probe.neighbors.residence.menuClass)}"></span>`);
  }
  const same = state.sameCaption && field.key === 'salary' ? `<label>${esc(field.label)}*</label>` : '';
  const disagree = state.disagreeCaption && field.key === 'salary' ? `<label>${esc(probe.neighbors.workNature.label)}*</label>` : '';
  return `<div class="${esc(itemClass)}" data-field="${field.key}"${hidden}><label>${esc(field.label)}*</label>${same}${disagree}<span class="${esc(probe.page.childrenClass)}">${noise.join('')}<div class="${esc(selectClass)}" id="${field.key}-select">${faced}${trigger}</div>${extra}</span></div>`;
}

function optionsFor(field, state) {
  if (state.confirmOption && field?.key === 'salary') return ['确定'];
  if (state.emptyMenu && field?.key === 'salary') return [];
  const rows = [...(field?.optionsSample || [])];
  if (state.duplicateOption && field?.key === 'arrival') rows.push(field.valueSample);
  return rows;
}

function neighborSelect(id, label, value, controlClass = probe.select.controlClass) {
  return `<div class="${esc(probe.page.itemClass)}" data-field="${id}"><label>${esc(label)}*</label><span class="${esc(probe.page.childrenClass)}"><div class="${esc(controlClass)}" id="${id}-select"><span id="${id}-value">${esc(value)}</span><input class="${esc(probe.select.triggerClass)}" type="text" value=""></div></span></div>`;
}

function cascaderRow(id, spec) {
  return `<div class="${esc(probe.page.itemClass)}" data-field="${id}"><label>${esc(spec.label)}*</label><span class="${esc(probe.page.childrenClass)}"><span class="${esc(spec.menuClass)}"><div class="${esc(spec.controlClass)}" id="${id}-select"><span id="${id}-value">${esc(spec.token)}</span></div></span></span></div>`;
}

function html(state) {
  const neighbor = probe.neighbors;
  const rootClass = state.dropRoot ? 'page-root' : probe.page.rootClass;
  const shell = state.elForm ? '<div class="el-form"></div>' : '';
  const dropdownClass = state.badDropdown
    ? 'ant-select-dropdown ant-select-dropdown-placement-bottomLeft'
    : probe.select.dropdownClass;
  const buttons = [...probe.page.buttonLabels, ...FORBIDDEN.filter((label) => !probe.page.buttonLabels.includes(label))]
    .map((label) => `<button type="button">${esc(label)}</button>`).join('');
  const fields = probe.select.fields.map((field) => selectField(field, state[field.key] ?? '', state)).join('');
  const salaryCopy = state.duplicateSalary
    ? selectField(FIELD.salary, '', { ...state, duplicateSalary: false }).replaceAll('id="salary-', 'id="salary-copy-').replace('data-field="salary"', 'data-field="salary-copy"')
    : '';
  const obey = neighbor.obey.options.map((text) => `<label><span><input class="${esc(neighbor.obey.controlClass)}" type="${esc(neighbor.obey.inputType)}" name="pb-obey"></span><span>${esc(text)}</span></label>`).join('');
  return `<!doctype html><body>${shell}<div class="${esc(rootClass)}"><div class="${esc(probe.page.contentClass)}">${fields}${salaryCopy
  }${cascaderRow('intent1', neighbor.intentFirst)
  }${cascaderRow('intent2', neighbor.intentSecond)
  }${`<div class="${esc(probe.page.itemClass)}"><label>${esc(neighbor.obey.label)}*</label><span class="${esc(probe.page.childrenClass)}">${obey}</span></div>`
  }${`<div class="${esc(probe.page.itemClass)}"><label>${esc(neighbor.research.label)}*</label><span class="${esc(probe.page.childrenClass)}"><label><input id="research" class="${esc(neighbor.research.controlClass)}" type="${esc(neighbor.research.inputType)}"><span>${esc(neighbor.research.option)}</span></label></span></div>`
  }${neighborSelect('work-nature', neighbor.workNature.label, neighbor.workNature.token)
  }${neighborSelect('interview', neighbor.interview.label, neighbor.interview.token)
  }${cascaderRow('residence', neighbor.residence)
  }${cascaderRow('origin', neighbor.origin)
  }${neighborSelect('degree', neighbor.degree.label, neighbor.degree.token)
  }${`<div class="${esc(probe.page.itemClass)}"><label>${esc(neighbor.note.label)}</label><span class="${esc(probe.page.childrenClass)}"><textarea id="note-input" class="${esc(neighbor.note.controlClass)}" placeholder="${esc(neighbor.note.placeholder)}">${esc(neighbor.note.token)}</textarea></span></div>`
  }${`<div class="${esc(probe.page.itemClass)}"><label>${esc(neighbor.name.label)}</label><span class="${esc(probe.page.childrenClass)}"><input id="name-input" class="${esc(neighbor.name.controlClass)}" type="text" placeholder="${esc(neighbor.name.placeholder)}" value="${esc(neighbor.name.token)}"></span></div>`
  }${`<div class="${esc(probe.page.itemClass)}"><label>${esc(neighbor.earned.label)}*</label><span class="${esc(probe.page.childrenClass)}"><input id="earned-input" class="${esc(neighbor.earned.controlClass)}" type="text" readonly placeholder="${esc(neighbor.earned.placeholder)}" value="${esc(neighbor.earned.token)}"></span></div>`
  }${`<div class="${esc(neighbor.photo.itemClass)}"><label>${esc(neighbor.photo.label)}*</label><input id="photo" type="file"></div>`
  }${`<div class="${esc(neighbor.portrait.itemClass)}"><label>${esc(neighbor.portrait.label)}*</label><input id="portrait" type="file"></div>`
  }${buttons}</div></div><div class="${esc(dropdownClass)}" id="select-menu" hidden><ul id="select-options"></ul></div></body>`;
}

function hide(node, hidden) {
  node.hidden = hidden;
  node.style.display = hidden ? 'none' : '';
}

function closeWidgets(document) {
  for (const select of document.querySelectorAll('.ant-select')) {
    select.classList.remove('ant-select-open', 'ant-select-focused');
  }
  hide(document.getElementById('select-menu'), true);
}

function paintMenu(document, select, state) {
  const field = probe.select.fields.find((row) => select.id === `${row.key}-select`);
  const options = field ? optionsFor(field, state) : [probe.neighbors.interview.token];
  const list = document.getElementById('select-options');
  list.replaceChildren();
  for (const text of options) {
    const li = document.createElement('li');
    if (state.confirmOption && field?.key === 'salary') {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = text;
      li.appendChild(button);
    } else {
      li.textContent = text;
    }
    list.appendChild(li);
  }
  hide(document.getElementById('select-menu'), false);
}

function wire(document, state) {
  const stats = {
    open: 0, option: 0, escape: 0, forbidden: 0, button: 0, file: 0, radio: 0, checkbox: 0,
    openClass: '', triggerClass: '', faceClass: ''
  };
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (button) {
      stats.button += 1;
      if (FORBIDDEN.includes(button.textContent.trim())) stats.forbidden += 1;
    }
    if (event.target.matches?.('input[type="file"]')) stats.file += 1;
    if (event.target.matches?.('input.ant-radio-input, input[type="radio"]')) stats.radio += 1;
    if (event.target.matches?.('input.ant-checkbox-input, input[type="checkbox"]')) stats.checkbox += 1;
  }, true);
  for (const select of document.querySelectorAll('.ant-select')) {
    select.addEventListener('click', (event) => {
      if (document.getElementById('select-menu').contains(event.target)) return;
      stats.open += 1;
      if (event.target.classList?.contains(probe.select.triggerClass)) stats.triggerClass = probe.select.triggerClass;
      if (event.target.closest?.(`.${LIVE.faceClass}`)) stats.faceClass = LIVE.faceClass;
      select.classList.add(...classes(probe.select.openClass));
      stats.openClass = select.className;
      paintMenu(document, select, state);
    });
  }
  document.getElementById('select-menu').addEventListener('click', (event) => {
    const li = event.target.closest('li');
    if (!li || state.confirmOption) return;
    const select = document.querySelector('.ant-select.ant-select-open');
    if (!select) return;
    stats.option += 1;
    const slot = select.querySelector('.ant-select-selection-selected-value, [id$="-value"]');
    slot.textContent = li.textContent.trim();
    if (!state.keepOpen) closeWidgets(document);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    stats.escape += 1;
    if (state.ignoreEscape) return;
    closeWidgets(document);
  });
  if (state.busy) {
    const select = document.getElementById('nature-select');
    select.classList.add('ant-select-open', 'ant-select-focused');
    paintMenu(document, select, state);
  }
  return stats;
}

function patch(window, state) {
  window.Element.prototype.getClientRects = function () {
    if ((state.closedSearch || state.closedSearchBare) && this.classList?.contains(probe.select.triggerClass)) return [];
    if (state.zeroRectSelect && this.id === 'salary-select') return [];
    for (let node = this; node?.nodeType === 1; node = node.parentElement) {
      if (node.hidden || node.style.display === 'none') return [];
    }
    return [{ width: 8, height: 8, top: 0, left: 0, right: 8, bottom: 8 }];
  };
}

async function boot(state = {}) {
  const dom = new JSDOM(html(state), { url: state.url || PAGE, pretendToBeVisual: true, runScripts: 'dangerously' });
  const { window } = dom;
  const { document } = window;
  patch(window, state);
  const stats = wire(document, state);
  window.eval(source);
  return { dom, window, document, stats, api: window.ResumeHotjobPbIntentSalary };
}

function textOf(document, id) {
  return document.getElementById(id).textContent;
}

function valueOf(document, id) {
  return document.getElementById(id).value;
}

function unchanged(document, stats) {
  const neighbor = probe.neighbors;
  assert.equal(textOf(document, 'intent1-value'), neighbor.intentFirst.token);
  assert.equal(textOf(document, 'intent2-value'), neighbor.intentSecond.token);
  assert.equal(textOf(document, 'work-nature-value'), neighbor.workNature.token);
  assert.equal(textOf(document, 'interview-value'), neighbor.interview.token);
  assert.equal(textOf(document, 'residence-value'), neighbor.residence.token);
  assert.equal(textOf(document, 'origin-value'), neighbor.origin.token);
  assert.equal(textOf(document, 'degree-value'), neighbor.degree.token);
  assert.equal(valueOf(document, 'note-input'), neighbor.note.token);
  assert.equal(valueOf(document, 'name-input'), neighbor.name.token);
  assert.equal(valueOf(document, 'earned-input'), neighbor.earned.token);
  assert.equal([...document.querySelectorAll('input[name="pb-obey"]')].some((node) => node.checked), false);
  assert.equal(document.getElementById('research').checked, false);
  assert.equal(document.getElementById('photo').files.length, 0);
  assert.equal(document.getElementById('portrait').files.length, 0);
  assert.equal(stats.forbidden, 0);
  assert.equal(stats.file, 0);
  assert.equal(stats.radio, 0);
  assert.equal(stats.checkbox, 0);
}

test('source stays on the probed pb classes and does not claim support', () => {
  assert.match(source, /ResumeHotjobPbIntentSalary/);
  assert.match(source, /liveSupportClaimed:\s*false/);
  assert.match(source, /supportClaimed:\s*false/);
  assert.match(source, /neverSave:\s*true/);
  assert.doesNotMatch(source, /liveSupportClaimed:\s*true/);
  assert.doesNotMatch(source, /supportClaimed:\s*true/);
  assert.doesNotMatch(source, /已支持/);
  assert.doesNotMatch(source, /hotjob-mc-basic|ResumeHotjobMc|ResumeHotjobPbBasic|ResumeHotjobPbRegion|ResumeHotjobPbWork|ResumeHotjobPbEdu|ResumeHotjobPbIntentLocation|ResumeHotjobPbCerts|mc\/deliver|cms-region|engine\.js/);
  assert.doesNotMatch(source, /textContent\s*=/);
  assert.doesNotMatch(source, /\.value\s*=[^=]/);
  assert.doesNotMatch(source, /\.checked\s*=/);
  assert.doesNotMatch(source, /innerHTML/);
  assert.doesNotMatch(source, /\bexport\s/);
  assert.doesNotMatch(source, /ant-cascader-menus|form-cell|ant-select-selection--single|ant-radio-wrapper|ant-select-dropdown-menu-item/);
  assert.doesNotMatch(source, /行业研究|服从分配|意向一|意向二/);
  assert.doesNotMatch(source, /全职|11-20万|一个月/);
  assert.doesNotMatch(source, /1\d{10}/);
  assert.match(source, /保存\|提交\|投递\|删除\|下一步\|返回\|确定/);
  const untouched = [
    manifest, engine, popup, cmsBasic, cmsEdu, mcSource, mcRunner,
    basicSource, regionSource, eduSource, eduHistorySource, workSource, certsSource, intentSource
  ];
  for (const file of untouched) {
    assert.equal(file.includes(MODULE), false);
    assert.equal(file.includes('ResumeHotjobPbIntentSalary'), false);
  }
  for (const token of [
    ...classes(probe.page.itemClass),
    ...classes(probe.select.controlClass),
    probe.select.triggerClass,
    ...classes(probe.select.dropdownClass),
    ...classes(probe.select.openClass),
    probe.page.rootClass,
    'ant-calendar-picker-input',
    LIVE.selectedValueClass,
    LIVE.placeholderClass,
    LIVE.placeholderPrefix,
    LIVE.faceClass,
    '[role="combobox"]',
    '.ant-select-selector',
    '.ant-select-selection-item',
    ...probe.select.fields.map((field) => field.label)
  ]) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  }
});

test('fixture html uses only the probe class list, labels, and captured tokens', () => {
  const built = html({});
  for (const token of [
    probe.page.rootClass, probe.page.contentClass, probe.page.childrenClass,
    ...classes(probe.page.itemClass),
    ...classes(probe.select.controlClass), probe.select.triggerClass,
    ...classes(probe.select.dropdownClass),
    probe.neighbors.residence.menuClass, probe.neighbors.photo.itemClass,
    probe.neighbors.portrait.itemClass, probe.neighbors.research.controlClass,
    probe.neighbors.obey.controlClass, probe.neighbors.earned.controlClass
  ]) assert.match(built, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  for (const field of probe.select.fields) {
    assert.match(built, new RegExp(`>${field.label}\\*`));
    assert.deepEqual(field.optionsSample, [field.valueSample]);
    assert.equal(built.includes(`>${field.valueSample}<`), false);
  }
  for (const label of probe.page.buttonLabels) assert.match(built, new RegExp(`>${label}<`));
  assert.match(built, new RegExp(probe.neighbors.research.label.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  assert.doesNotMatch(built, /ant-radio-wrapper|ant-select-selection--single|ant-cascader-menus|ant-select-dropdown-menu-item/);
  assert.doesNotMatch(built, /1\d{10}|@|悉尼/);
  assert.doesNotMatch(JSON.stringify(probe), /1\d{10}|@|悉尼/);
});

test('inspect matches the three probed selects and does not claim support', async () => {
  const state = Object.fromEntries(probe.select.fields.map((field) => [field.key, field.valueSample]));
  const h = await boot(state);
  try {
    const view = h.api.inspect();
    assert.equal(h.api.liveSupportClaimed, false);
    assert.equal(h.api.supportClaimed, false);
    assert.equal(h.api.neverSave, true);
    assert.equal(h.window.ResumeHotjobPbBasic, undefined);
    assert.equal(h.window.ResumeHotjobPbRegion, undefined);
    assert.equal(h.window.ResumeHotjobPbEduIntent, undefined);
    assert.equal(h.window.ResumeHotjobPbIntentLocation, undefined);
    assert.equal(h.window.ResumeHotjobPbCerts, undefined);
    assert.equal(view.liveSupportClaimed, false);
    assert.equal(view.supportClaimed, false);
    assert.equal(view.neverSave, true);
    assert.equal(view.saved, false);
    assert.equal(view.skippedSave, true);
    assert.equal(view.complete, false);
    assert.equal(view.fields.length, 3);
    assert.equal(view.fields.every((field) => field.supported === false), true);
    assert.equal(view.fields.every((field) => field.kind === 'select'), true);
    assert.equal(view.fields.every((field) => field.reason === 'structure_matched'), true);
    assert.deepEqual(Array.from(view.fields, (field) => field.label), [NATURE, SALARY, ARRIVAL]);
    for (const field of probe.select.fields) {
      assert.equal(view.fields.find((row) => row.label === field.label).value, field.valueSample, field.label);
    }
    const labels = view.fields.map((field) => field.label);
    assert.equal(labels.includes(probe.neighbors.intentFirst.label), false);
    assert.equal(labels.includes(probe.neighbors.obey.label), false);
    assert.equal(labels.includes(probe.neighbors.research.label), false);
    assert.equal(labels.includes(probe.neighbors.workNature.label), false);
    assert.equal(h.stats.open, 0);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('empty selects read back the probed tokens without save or a support claim', async () => {
  const h = await boot({});
  try {
    const rows = [];
    for (const field of probe.select.fields) rows.push(await h.api.fillField(field.label, ` ${field.valueSample} `));
    for (const row of rows) {
      assert.equal(row.ok, true, JSON.stringify(row));
      assert.equal(row.reason, 'readback_matched');
      assert.equal(row.status, 'verified');
      assert.equal(row.after, row.expected);
      assert.equal(row.opened, true);
      assert.equal(row.canceled, false);
      assert.equal(row.stillOpen, 0);
      assert.equal(row.liveSupportClaimed, false);
      assert.equal(row.supportClaimed, false);
      assert.equal(row.neverSave, true);
      assert.equal(row.saved, false);
      assert.equal(row.skippedSave, true);
      assert.equal(row.complete, false);
      assert.equal(row.softwareClickedSave, false);
      assert.equal(row.softwareClickedSubmit, false);
      assert.equal(row.softwareClickedDeliver, false);
      assert.equal(row.softwareClickedDelete, false);
      assert.equal(row.softwareClickedNext, false);
    }
    assert.equal(h.stats.triggerClass, probe.select.triggerClass);
    assert.equal(h.stats.faceClass, '');
    assert.match(h.stats.openClass, /ant-select-open/);
    assert.match(h.stats.openClass, /ant-select-focused/);
    assert.match(h.stats.openClass, /ant-select-enabled/);
    assert.equal(h.stats.option, 3);
    assert.equal(h.stats.button, 0);
    assert.equal(h.document.querySelectorAll('.ant-select-open').length, 0);
    assert.equal(h.document.getElementById('select-menu').hidden, true);
    for (const field of probe.select.fields) {
      assert.equal(textOf(h.document, `${field.key}-value`), field.valueSample, field.label);
    }
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('a query string on the probed pb path still fills all three', async () => {
  const h = await boot({ url: `${PAGE}?recruitType=1&resumeId=synthetic&tid=synthetic&lang=1` });
  try {
    const filled = await h.api.fillFields(PROFILE);
    assert.equal(filled.ok, true, JSON.stringify(filled.fields));
    assert.equal(filled.liveSupportClaimed, false);
    assert.equal(filled.supportClaimed, false);
    assert.equal(filled.complete, false);
    assert.equal(filled.saved, false);
    assert.equal(filled.skippedSave, true);
    assert.equal(filled.neverSave, true);
    assert.deepEqual(Array.from(filled.fields, (field) => field.label), [NATURE, SALARY, ARRIVAL]);
    assert.equal(filled.fields.every((field) => field.reason === 'readback_matched'), true);
    assert.equal(textOf(h.document, 'nature-value'), FIELD.nature.valueSample);
    assert.equal(textOf(h.document, 'salary-value'), FIELD.salary.valueSample);
    assert.equal(textOf(h.document, 'arrival-value'), FIELD.arrival.valueSample);
    assert.equal(h.stats.option, 3);
    assert.equal(h.document.getElementById('select-menu').hidden, true);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('preexisting same display values, including a placeholder mash, do not reopen', async () => {
  const state = { placeholderMash: 'text' };
  for (const field of probe.select.fields) state[field.key] = field.valueSample;
  const h = await boot(state);
  try {
    for (const field of probe.select.fields) {
      const row = await h.api.fillField(field.label, ` ${field.valueSample} `);
      assert.equal(row.reason, 'preexisting_same_value', JSON.stringify(row));
      assert.equal(row.status, 'verified');
      assert.equal(row.ok, true);
      assert.equal(row.before, field.valueSample);
      assert.equal(row.after, field.valueSample);
      assert.equal(row.opened, false);
      assert.equal(row.canceled, false);
      assert.equal(row.saved, false);
      assert.equal(row.liveSupportClaimed, false);
      assert.equal(row.supportClaimed, false);
      assert.equal(textOf(h.document, `${field.key}-value`), `${LIVE.placeholderPrefix}${field.label}${field.valueSample}`);
    }
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.option, 0);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('a placeholder class is ignored and the selected token is kept without opening', async () => {
  const state = { placeholderMash: 'class' };
  for (const field of probe.select.fields) state[field.key] = field.valueSample;
  const h = await boot(state);
  try {
    const view = h.api.inspect();
    assert.equal(view.liveSupportClaimed, false);
    assert.equal(view.supportClaimed, false);
    for (const field of probe.select.fields) {
      const row = view.fields.find((item) => item.label === field.label);
      assert.equal(row.value, field.valueSample, field.label);
      assert.equal(row.supported, false);
      const filled = await h.api.fillField(field.label, field.valueSample);
      assert.equal(filled.reason, 'preexisting_same_value', JSON.stringify(filled));
      assert.equal(filled.opened, false);
    }
    assert.equal(h.stats.open, 0);
    const salary = h.document.querySelector('#salary-select .ant-select-selection-selected-value');
    const prompt = h.document.querySelector('#salary-select .ant-select-selection__placeholder');
    assert.equal(salary.textContent, FIELD.salary.valueSample);
    assert.equal(prompt.textContent, `${LIVE.placeholderPrefix}${SALARY}`);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('a different existing value is kept and the empty selects still paint', async () => {
  const h = await boot({ nature: FIELD.salary.valueSample });
  try {
    const filled = await h.api.fillFields(PROFILE);
    assert.equal(filled.ok, false);
    assert.equal(filled.liveSupportClaimed, false);
    const byLabel = Object.fromEntries(filled.fields.map((field) => [field.label, field]));
    assert.equal(byLabel[NATURE].reason, 'existing_value');
    assert.equal(byLabel[NATURE].status, 'skipped');
    assert.equal(byLabel[NATURE].ok, false);
    assert.equal(byLabel[NATURE].opened, false);
    assert.equal(byLabel[NATURE].before, FIELD.salary.valueSample);
    assert.equal(byLabel[SALARY].reason, 'readback_matched');
    assert.equal(byLabel[ARRIVAL].reason, 'readback_matched');
    assert.equal(h.stats.open, 2);
    assert.equal(h.stats.option, 2);
    assert.equal(textOf(h.document, 'nature-value'), FIELD.salary.valueSample);
    assert.equal(textOf(h.document, 'salary-value'), FIELD.salary.valueSample);
    assert.equal(textOf(h.document, 'arrival-value'), FIELD.arrival.valueSample);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('an identical extra caption still locates and a disagreeing caption fails closed', async () => {
  const same = await boot({ sameCaption: true });
  try {
    const row = await same.api.fillField(SALARY, ` ${FIELD.salary.valueSample} `);
    assert.equal(row.reason, 'readback_matched', JSON.stringify(row));
    assert.equal(row.after, FIELD.salary.valueSample);
    assert.equal(textOf(same.document, 'salary-value'), FIELD.salary.valueSample);
    unchanged(same.document, same.stats);
  } finally { same.dom.window.close(); }

  const disagree = await boot({ disagreeCaption: true });
  try {
    const row = await disagree.api.fillField(SALARY, FIELD.salary.valueSample);
    assert.equal(row.reason, 'control_not_supported');
    assert.equal(row.ok, false);
    assert.equal(row.opened, false);
    assert.equal(disagree.stats.open, 0);
    assert.equal(textOf(disagree.document, 'salary-value'), '');
    unchanged(disagree.document, disagree.stats);
  } finally { disagree.dom.window.close(); }
});

test('empty values, unknown options, and out-of-scope labels fail closed', async () => {
  const h = await boot({});
  try {
    for (const value of ['', '   ', null, 1]) {
      const row = await h.api.fillField(SALARY, value);
      assert.equal(row.reason, 'missing_profile_value', String(value));
      assert.equal(row.ok, false);
      assert.equal(row.opened, false);
      assert.equal(row.liveSupportClaimed, false);
      assert.equal(row.supportClaimed, false);
    }
    const unknown = await h.api.fillField(ARRIVAL, FIELD.nature.valueSample);
    assert.equal(unknown.reason, 'option_not_found', JSON.stringify(unknown));
    assert.equal(unknown.opened, true);
    assert.equal(unknown.canceled, true);
    assert.equal(unknown.stillOpen, 0);
    assert.equal(unknown.after, '');
    assert.ok(h.stats.escape >= 1);
    assert.equal(h.stats.option, 0);
    assert.equal(textOf(h.document, 'arrival-value'), '');
    assert.equal(h.document.getElementById('select-menu').hidden, true);
    for (const label of [
      probe.neighbors.intentFirst.label,
      probe.neighbors.intentSecond.label,
      probe.neighbors.obey.label,
      probe.neighbors.research.label,
      probe.neighbors.workNature.label,
      probe.neighbors.interview.label,
      probe.neighbors.residence.label,
      probe.neighbors.origin.label,
      probe.neighbors.degree.label,
      probe.neighbors.note.label,
      probe.neighbors.name.label,
      probe.neighbors.photo.label,
      probe.neighbors.portrait.label,
      probe.neighbors.earned.label,
      '年薪',
      '到岗',
      '学历',
      '专业排名'
    ]) {
      const row = await h.api.fillField(label, FIELD.nature.valueSample);
      assert.equal(row.reason, 'label_not_allowed', label);
      assert.equal(row.ok, false);
      const canceled = await h.api.cancelField(label);
      assert.equal(canceled.reason, 'label_not_allowed', label);
    }
    const none = await h.api.fillFields(null);
    assert.equal(none.ok, false);
    assert.equal(none.liveSupportClaimed, false);
    assert.equal(none.supportClaimed, false);
    assert.equal(none.fields.every((field) => field.reason === 'missing_profile_value'), true);
    assert.equal(textOf(h.document, 'nature-value'), '');
    assert.equal(textOf(h.document, 'salary-value'), '');
    assert.equal(h.stats.checkbox, 0);
    assert.equal(h.document.getElementById('research').checked, false);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('Escape closes an open flat select and does not change the value', async () => {
  const h = await boot({ nature: FIELD.nature.valueSample, arrival: '' });
  try {
    const canceled = await h.api.cancelField(ARRIVAL);
    assert.equal(canceled.ok, true, JSON.stringify(canceled));
    assert.equal(canceled.reason, 'menu_closed');
    assert.equal(canceled.canceled, true);
    assert.equal(canceled.stillOpen, 0);
    assert.equal(canceled.before, '');
    assert.equal(canceled.after, '');
    assert.equal(canceled.expected, '');
    assert.equal(canceled.liveSupportClaimed, false);
    assert.equal(canceled.supportClaimed, false);
    assert.equal(canceled.saved, false);
    assert.equal(canceled.neverSave, true);
    assert.equal(h.stats.open, 1);
    assert.equal(h.stats.option, 0);
    assert.equal(h.stats.button, 0);
    assert.ok(h.stats.escape >= 1);
    assert.equal(h.document.getElementById('select-menu').hidden, true);
    assert.equal(h.document.querySelectorAll('.ant-select-open').length, 0);
    assert.equal(textOf(h.document, 'nature-value'), FIELD.nature.valueSample);
    assert.equal(textOf(h.document, 'arrival-value'), '');
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('a menu that ignores Escape fails closed and does not keep a painted value', async () => {
  const h = await boot({ ignoreEscape: true });
  try {
    const canceled = await h.api.cancelField(SALARY);
    assert.equal(canceled.ok, false);
    assert.equal(canceled.reason, 'menu_cleanup_failed');
    assert.equal(canceled.stillOpen, 1);
    assert.equal(canceled.after, '');
    assert.equal(h.stats.option, 0);
    const blocked = await h.api.fillField(ARRIVAL, FIELD.arrival.valueSample);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.reason, 'control_busy');
    assert.equal(blocked.opened, false);
    assert.equal(textOf(h.document, 'arrival-value'), '');
    assert.equal(textOf(h.document, 'salary-value'), '');
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('duplicate options and a confirm button fail closed before a write', async () => {
  const ambiguous = await boot({ duplicateOption: true });
  try {
    const row = await ambiguous.api.fillField(ARRIVAL, FIELD.arrival.valueSample);
    assert.equal(row.reason, 'ambiguous_option', JSON.stringify(row));
    assert.equal(row.after, '');
    assert.equal(row.stillOpen, 0);
    assert.equal(row.canceled, true);
    assert.equal(ambiguous.stats.option, 0);
    assert.equal(ambiguous.document.getElementById('select-menu').hidden, true);
    assert.equal(textOf(ambiguous.document, 'arrival-value'), '');
    unchanged(ambiguous.document, ambiguous.stats);
  } finally { ambiguous.dom.window.close(); }

  const confirm = await boot({ confirmOption: true });
  try {
    const row = await confirm.api.fillField(SALARY, '确定');
    assert.equal(row.reason, 'never_save', JSON.stringify(row));
    assert.equal(row.ok, false);
    assert.equal(row.canceled, true);
    assert.equal(row.stillOpen, 0);
    assert.equal(confirm.stats.option, 0);
    assert.equal(confirm.stats.button, 0);
    assert.equal(confirm.stats.forbidden, 0);
    assert.equal(textOf(confirm.document, 'salary-value'), '');
    assert.equal(confirm.document.getElementById('select-menu').hidden, true);
    unchanged(confirm.document, confirm.stats);
  } finally { confirm.dom.window.close(); }
});

test('two selected display tokens fail closed before a click', async () => {
  const h = await boot({ ambiguousValue: true, salary: FIELD.salary.valueSample });
  try {
    const view = h.api.inspect();
    assert.equal(view.ok, false);
    assert.equal(view.liveSupportClaimed, false);
    assert.equal(view.fields.find((field) => field.label === SALARY).reason, 'control_not_supported');
    assert.equal(view.fields.find((field) => field.label === NATURE).reason, 'structure_matched');
    const row = await h.api.fillField(SALARY, FIELD.salary.valueSample);
    assert.equal(row.reason, 'control_not_supported');
    assert.equal(row.opened, false);
    assert.equal(h.stats.open, 0);
    assert.equal(textOf(h.document, 'salary-value'), FIELD.salary.valueSample);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('missing, duplicate, and drifted controls fail closed', async () => {
  const cases = [
    [{ dropSearch: true }, SALARY, FIELD.salary.valueSample],
    [{ closedSearchBare: true }, SALARY, FIELD.salary.valueSample],
    [{ dropAllowClear: true }, SALARY, FIELD.salary.valueSample],
    [{ dropEnabled: true }, SALARY, FIELD.salary.valueSample],
    [{ selectDisabled: true }, SALARY, FIELD.salary.valueSample],
    [{ extraSelect: true }, SALARY, FIELD.salary.valueSample],
    [{ dropAntRow: true }, SALARY, FIELD.salary.valueSample],
    [{ hiddenSelect: true }, SALARY, FIELD.salary.valueSample],
    [{ zeroRectSelect: true }, SALARY, FIELD.salary.valueSample],
    [{ ambiguousValue: true }, SALARY, FIELD.salary.valueSample],
    [{ checkboxInside: true }, SALARY, FIELD.salary.valueSample],
    [{ radioInside: true }, SALARY, FIELD.salary.valueSample],
    [{ textareaInside: true }, SALARY, FIELD.salary.valueSample],
    [{ fileInside: true }, SALARY, FIELD.salary.valueSample],
    [{ calendarInside: true }, SALARY, FIELD.salary.valueSample],
    [{ textInside: true }, SALARY, FIELD.salary.valueSample],
    [{ cascaderInside: true }, SALARY, FIELD.salary.valueSample],
    [{ disagreeCaption: true }, SALARY, FIELD.salary.valueSample],
    [{ duplicateSalary: true }, SALARY, FIELD.salary.valueSample],
    [{ badDropdown: true }, ARRIVAL, FIELD.arrival.valueSample],
    [{ emptyMenu: true }, SALARY, FIELD.salary.valueSample],
    [{ busy: true }, NATURE, FIELD.nature.valueSample],
    [{ dropRoot: true }, NATURE, FIELD.nature.valueSample],
    [{ elForm: true }, NATURE, FIELD.nature.valueSample],
    [{ url: 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/mc/deliver/operationResumer' }, ARRIVAL, FIELD.arrival.valueSample],
    [{ url: 'https://gszq.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html' }, NATURE, FIELD.nature.valueSample]
  ];
  for (const [state, label, value] of cases) {
    const h = await boot(state);
    try {
      const row = await h.api.fillField(label, value);
      assert.notEqual(row.reason, 'readback_matched', JSON.stringify(state));
      assert.equal(row.ok, false, JSON.stringify({ state, row }));
      assert.ok(['control_not_supported', 'control_busy', 'wrong_page'].includes(row.reason), JSON.stringify({ state, row }));
      assert.equal(row.liveSupportClaimed, false);
      assert.equal(row.supportClaimed, false);
      assert.equal(row.saved, false);
      assert.equal(h.stats.option, 0, JSON.stringify(state));
      assert.equal(h.stats.forbidden, 0, JSON.stringify(state));
      assert.equal(h.stats.file, 0, JSON.stringify(state));
      assert.equal(h.stats.button, 0, JSON.stringify(state));
      assert.equal(h.stats.checkbox, 0, JSON.stringify(state));
      assert.equal(h.stats.radio, 0, JSON.stringify(state));
    } finally { h.dom.window.close(); }
  }
});

test('an empty closed flat select opens from the visible face and reads the selected token', async () => {
  const h = await boot({ closedSearch: true });
  try {
    const salary = await h.api.fillField(SALARY, FIELD.salary.valueSample);
    assert.equal(salary.ok, true, JSON.stringify(salary));
    assert.equal(salary.reason, 'readback_matched');
    assert.equal(salary.after, FIELD.salary.valueSample);
    assert.equal(salary.before, '');
    assert.equal(salary.opened, true);
    assert.equal(salary.stillOpen, 0);
    assert.equal(salary.liveSupportClaimed, false);
    assert.equal(salary.supportClaimed, false);
    assert.equal(salary.saved, false);
    assert.equal(salary.neverSave, true);
    assert.equal(h.stats.open, 1);
    assert.equal(h.stats.option, 1);
    assert.equal(h.stats.triggerClass, '');
    assert.equal(h.stats.faceClass, LIVE.faceClass);
    assert.equal(textOf(h.document, 'salary-value'), FIELD.salary.valueSample);
    assert.equal(h.document.getElementById('select-menu').hidden, true);
    const nature = await h.api.fillField(NATURE, FIELD.nature.valueSample);
    const arrival = await h.api.fillField(ARRIVAL, FIELD.arrival.valueSample);
    assert.equal(nature.reason, 'readback_matched');
    assert.equal(arrival.reason, 'readback_matched');
    assert.equal(h.stats.faceClass, LIVE.faceClass);
    assert.equal(h.stats.triggerClass, '');
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('a menu that stays open after the option click is closed with Escape', async () => {
  const h = await boot({ keepOpen: true });
  try {
    const row = await h.api.fillField(ARRIVAL, FIELD.arrival.valueSample);
    assert.equal(row.ok, true, JSON.stringify(row));
    assert.equal(row.reason, 'readback_matched');
    assert.equal(row.after, FIELD.arrival.valueSample);
    assert.equal(row.stillOpen, 0);
    assert.equal(row.saved, false);
    assert.ok(h.stats.escape >= 1);
    assert.equal(h.document.querySelectorAll('.ant-select-open').length, 0);
    assert.equal(h.document.getElementById('select-menu').hidden, true);
    assert.equal(textOf(h.document, 'arrival-value'), FIELD.arrival.valueSample);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('a hidden page fails closed before a click', async () => {
  const h = await boot({});
  try {
    Object.defineProperty(h.document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    const row = await h.api.fillField(NATURE, FIELD.nature.valueSample);
    const salary = await h.api.fillField(SALARY, FIELD.salary.valueSample);
    assert.equal(row.reason, 'fill_interrupted_page_hidden');
    assert.equal(salary.reason, 'fill_interrupted_page_hidden');
    assert.equal(row.ok, false);
    assert.equal(row.liveSupportClaimed, false);
    assert.equal(row.supportClaimed, false);
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.option, 0);
    assert.equal(textOf(h.document, 'nature-value'), '');
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('inspect on the wrong host does not claim support', async () => {
  const h = await boot({ url: 'https://gszq.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html' });
  try {
    const view = h.api.inspect();
    assert.equal(view.ok, false);
    assert.equal(view.reason, 'wrong_page');
    assert.deepEqual(Array.from(view.fields), []);
    assert.equal(view.liveSupportClaimed, false);
    assert.equal(view.supportClaimed, false);
    assert.equal(view.neverSave, true);
    assert.equal(view.saved, false);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});
